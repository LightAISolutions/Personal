/**
 * Helpers core — queue + worker.
 * Router handlers enqueue and return fast; the worker runs from a one-off trigger scheduled by enqueue()
 * (no permanent tick) and dispatches each item to the handler registered with registerQueueHandler(kind, fn).
 * Statuses: new → processing → done | failed(retry, back to new) | dead (no handler / attempts exhausted).
 */
function enqueue(kind, payload, source) {
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(kind || '')) throw new Error('enqueue: bad kind');
  var pj = toJson(payload === undefined ? {} : payload);
  if (pj.length > LIMITS.QUEUE_MAX_PAYLOAD_CHARS) throw new Error('enqueue: payload too large');
  var row = storeAppend(SHEETS.QUEUE, {
    id: newId('q'), created_at: nowIso(), kind: kind, source: source || '', status: 'new', attempts: 0,
    payload_json: pj, last_error: '', claimed_at: '', processed_at: '', result_json: ''
  });
  audit('enqueue', row.id, { kind: kind, source: source || '' });
  scheduleWorker();
  return row;
}
function queueDepth() { return storeCount(SHEETS.QUEUE, function (r) { return r.status === 'new' || r.status === 'processing'; }); }

/** One-off trigger for the worker in ~1 minute, at most one outstanding at a time. */
function scheduleWorker() {
  try {
    if (seenOnce('q:scheduled')) return false;
    scheduleOneOff('queueTrigger', 1);
    return true;
  } catch (e) { auditFail('worker_schedule_error', '', describeError(e)); return false; }
}
function queueTrigger(e) {
  deleteOneOffTrigger(e);
  CacheService.getScriptCache().remove('q:scheduled');
  var r = workerTick();
  if (queueDepth() > 0) scheduleWorker();
  return r;
}

function _queueClaimable(r) {
  if (r.status === 'new') return true;
  if (r.status === 'processing') {
    var c = parseIso(r.claimed_at);
    return !c || (nowMs() - c.getTime()) > LIMITS.QUEUE_STALE_MIN * 60000;
  }
  return false;
}

/** Process up to LIMITS.QUEUE_BATCH claimable items within the time budget. Returns counts. */
function workerTick(budgetMs) {
  var started = nowMs();
  budgetMs = budgetMs || LIMITS.SWEEP_BUDGET_MS;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) { audit('worker_skip_locked', '', null); return { processed: 0, skipped: true }; }
  var stats = { processed: 0, done: 0, failed: 0, dead: 0 };
  try {
    var items = storeFind(SHEETS.QUEUE, _queueClaimable, LIMITS.QUEUE_BATCH);
    for (var i = 0; i < items.length; i++) {
      if (nowMs() - started > budgetMs) break;
      var r = processQueueItem(items[i]);
      stats.processed++; stats[r.status] = (stats[r.status] || 0) + 1;
    }
  } finally { lock.releaseLock(); }
  return stats;
}

function processQueueItem(row) {
  var attempts = (parseInt(row.attempts, 10) || 0) + 1;
  storeUpdate(SHEETS.QUEUE, row._row, { status: 'processing', attempts: attempts, claimed_at: nowIso() });
  var handler = getQueueHandler(row.kind);
  if (!handler) {
    storeUpdate(SHEETS.QUEUE, row._row, { status: 'dead', last_error: 'no_handler', processed_at: nowIso() });
    auditFail('queue_no_handler', row.id, { kind: row.kind });
    return { status: 'dead' };
  }
  var parsed = safeJsonParse(row.payload_json || '{}');
  var item = { id: row.id, kind: row.kind, source: row.source, created_at: row.created_at, attempts: attempts, payload: parsed.ok ? parsed.value : {} };
  try {
    var result = handler(item);
    storeUpdate(SHEETS.QUEUE, row._row, { status: 'done', processed_at: nowIso(), result_json: truncate(toJson(result === undefined ? null : result), 2000), last_error: '' });
    audit('queue_done', row.id, { kind: row.kind });
    return { status: 'done', result: result };
  } catch (e) {
    var err = describeError(e);
    var dead = attempts >= LIMITS.QUEUE_MAX_ATTEMPTS;
    storeUpdate(SHEETS.QUEUE, row._row, { status: dead ? 'dead' : 'new', last_error: err, processed_at: dead ? nowIso() : '' });
    auditFail(dead ? 'queue_dead' : 'queue_retry', row.id, { kind: row.kind, attempts: attempts, error: err });
    return { status: dead ? 'dead' : 'failed', error: err };
  }
}

/** Re-open dead items of one kind (e.g. after a pack that handles it is deployed). */
function requeueDead(kind) {
  var rows = storeFind(SHEETS.QUEUE, function (r) { return r.status === 'dead' && (!kind || r.kind === kind); });
  rows.forEach(function (r) { storeUpdate(SHEETS.QUEUE, r._row, { status: 'new', attempts: 0, last_error: '' }); });
  audit('queue_requeue', kind || '*', { count: rows.length });
  if (rows.length) scheduleWorker();
  return rows.length;
}
/** Delete done rows older than N days (daily job). */
function pruneQueue(days) {
  var cutoff = nowMs() - (days || LIMITS.QUEUE_KEEP_DAYS) * 86400000;
  var rows = storeFind(SHEETS.QUEUE, function (r) {
    var d = parseIso(r.processed_at || r.created_at);
    return r.status === 'done' && d && d.getTime() < cutoff;
  });
  return storeDeleteRows(SHEETS.QUEUE, rows.map(function (r) { return r._row; }));
}

// Developed by: LightAISolutions
