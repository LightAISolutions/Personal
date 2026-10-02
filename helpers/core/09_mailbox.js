/**
 * Helpers core — Drive mailbox relay. The ONLY bridge between the brain (Claude Code Routines) and the core.
 * Folders: <drive_root>/mailbox/{to-brain, from-brain, archive/{processed,rejected,failed}}.
 * from-brain: JSON envelopes written by routines → validated here → dispatched to registerEnvelopeHandler(type).
 * to-brain:   state.json snapshot + req_<id>.json requests written by the core (see 12_wake.js openRequest()).
 */
var ENVELOPE_KEYS = ['v', 'id', 'type', 'created_at', 'producer', 'payload', 'in_reply_to', 'dedupe_key'];

function getRootFolder() {
  var id = getProp(PROP.ROOT_FOLDER_ID);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreate below */ } }
  var it = DriveApp.getRootFolder().getFoldersByName(HELPER.drive_root);
  var folder = it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(HELPER.drive_root);
  setProp(PROP.ROOT_FOLDER_ID, folder.getId());
  return folder;
}
/**
 * Where a Drive file sits relative to the helper's own folder: 'in' (a descendant of getRootFolder(), found within
 * DRIVE_WHERE_DEPTH parent levels), 'outside' (anywhere else in the owner's Drive) or 'missing' (Drive refuses the id).
 * The brain lane names files by id and the script runs as the owner, so a file is attached to the chat only when it is
 * 'in' — otherwise a forged id could make the bot send any file the owner can open (Phase 6 red-team I7 / R3).
 */
var DRIVE_WHERE_DEPTH = 8, DRIVE_WHERE_FANOUT = 20;
function driveFileWhere(fileId) {
  var file;
  try { file = DriveApp.getFileById(String(fileId)); } catch (e) { return 'missing'; }
  try {
    var rootId = getRootFolder().getId(), level = [], depth = 0, it = file.getParents();
    while (it.hasNext()) level.push(it.next());
    while (level.length && depth < DRIVE_WHERE_DEPTH) {
      var up = [];
      for (var i = 0; i < level.length; i++) {
        if (level[i].getId() === rootId) return 'in';
        var p = level[i].getParents();
        while (p.hasNext() && up.length < DRIVE_WHERE_FANOUT) up.push(p.next());
      }
      level = up; depth++;
    }
  } catch (e2) { return 'outside'; }
  return 'outside';
}
function _childFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
/** ensureFolderPath(['trips','2026']) → <drive_root>/trips/2026 (created if missing). */
function ensureFolderPath(parts) {
  var f = getRootFolder();
  for (var i = 0; i < parts.length; i++) { if (parts[i]) f = _childFolder(f, parts[i]); }
  return f;
}
function getMailboxFolders() {
  var mailbox = ensureFolderPath([MAILBOX.MAILBOX]);
  if (getProp(PROP.MAILBOX_FOLDER_ID) !== mailbox.getId()) setProp(PROP.MAILBOX_FOLDER_ID, mailbox.getId());
  var archive = _childFolder(mailbox, MAILBOX.ARCHIVE);
  return {
    mailbox: mailbox, toBrain: _childFolder(mailbox, MAILBOX.TO_BRAIN), fromBrain: _childFolder(mailbox, MAILBOX.FROM_BRAIN),
    archive: archive, processed: _childFolder(archive, MAILBOX.PROCESSED), rejected: _childFolder(archive, MAILBOX.REJECTED),
    failed: _childFolder(archive, MAILBOX.FAILED)
  };
}

/** validateEnvelope(rawText, sizeBytes) → {ok, envelope, errors}. Pure; no side effects. */
function validateEnvelope(raw, sizeBytes) {
  var errs = [];
  if (sizeBytes > LIMITS.ENVELOPE_MAX_FILE_BYTES) return { ok: false, errors: ['file too large (' + sizeBytes + ' bytes)'] };
  var parsed = safeJsonParse(raw);
  if (!parsed.ok) return { ok: false, errors: ['invalid JSON: ' + parsed.error] };
  var env = parsed.value;
  if (!isPlainObject(env)) return { ok: false, errors: ['envelope must be a JSON object'] };
  Object.keys(env).forEach(function (k) { if (ENVELOPE_KEYS.indexOf(k) < 0) errs.push('unknown key: ' + k); });
  if (env.v !== 1) errs.push('v must be 1');
  if (typeof env.id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(env.id)) errs.push('id must match ^[A-Za-z0-9_-]{8,64}$');
  if (typeof env.type !== 'string' || ENVELOPE_TYPES.indexOf(env.type) < 0) errs.push('unknown type');
  var created = parseIso(env.created_at);
  if (!created) errs.push('created_at must be ISO datetime');
  else {
    var age = nowMs() - created.getTime();
    if (age > LIMITS.ENVELOPE_MAX_AGE_DAYS * 86400000) errs.push('created_at older than ' + LIMITS.ENVELOPE_MAX_AGE_DAYS + ' days');
    if (age < -86400000) errs.push('created_at is in the future');
  }
  if (typeof env.producer !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(env.producer)) errs.push('producer must match ^[a-z0-9_-]{1,64}$');
  if (!isPlainObject(env.payload)) errs.push('payload must be an object');
  else {
    var pj = toJson(env.payload);
    if (pj.length > LIMITS.ENVELOPE_MAX_PAYLOAD_CHARS) errs.push('payload too large (' + pj.length + ' chars)');
    if (longestString(env.payload) > LIMITS.ENVELOPE_MAX_TEXT_CHARS) errs.push('a payload string exceeds ' + LIMITS.ENVELOPE_MAX_TEXT_CHARS + ' chars');
  }
  if (env.in_reply_to !== undefined && (typeof env.in_reply_to !== 'string' || env.in_reply_to.length > 64)) errs.push('in_reply_to invalid');
  if (env.dedupe_key !== undefined && (typeof env.dedupe_key !== 'string' || env.dedupe_key.length > 120)) errs.push('dedupe_key invalid');
  if (errs.length) return { ok: false, errors: errs };
  var handler = getEnvelopeHandler(env.type);
  if (!handler) return { ok: false, errors: ['no handler registered for type ' + env.type] };
  if (handler.validate) {
    var herrs = handler.validate(env.payload, env) || [];
    if (herrs.length) return { ok: false, errors: herrs.map(function (x) { return 'payload: ' + x; }) };
  }
  return { ok: true, envelope: env, errors: [] };
}

function _envelopeSeen(key) {
  var cache = CacheService.getScriptCache();
  var k = 'env:' + key;
  if (cache.get(k)) return true;
  cache.put(k, '1', LIMITS.DEDUPE_TTL_SEC);
  return false;
}
function _archive(file, folder) { try { file.moveTo(folder); } catch (e) { auditFail('mailbox_archive_error', file.getName(), describeError(e)); } }

/** Read + validate + dispatch every envelope in from-brain. Returns counts. Time-boxed. */
function pollFromBrain(budgetMs) {
  var started = nowMs();
  budgetMs = budgetMs || LIMITS.SWEEP_BUDGET_MS / 2;
  var f = getMailboxFolders();
  var stats = { processed: 0, rejected: 0, failed: 0, duplicate: 0 };
  var it = f.fromBrain.getFiles();
  var n = 0;
  while (it.hasNext() && n < LIMITS.MAILBOX_BATCH && (nowMs() - started) < budgetMs) {
    var file = it.next(); n++;
    var name = file.getName();
    if (!/\.json$/i.test(name)) { auditFail('envelope_rejected', name, ['not a .json file']); _archive(file, f.rejected); stats.rejected++; continue; }
    var size = file.getSize();
    var raw = size <= LIMITS.ENVELOPE_MAX_FILE_BYTES ? file.getBlob().getDataAsString('UTF-8') : '';
    var v = validateEnvelope(raw, size);
    if (!v.ok) { auditFail('envelope_rejected', name, v.errors); _archive(file, f.rejected); stats.rejected++; continue; }
    var env = v.envelope;
    if (_envelopeSeen(env.dedupe_key || env.id)) { audit('envelope_duplicate', env.id, { file: name }); _archive(file, f.processed); stats.duplicate++; continue; }
    var r = dispatchEnvelope(env, name);
    if (r.ok) { _archive(file, f.processed); stats.processed++; } else { _archive(file, f.failed); stats.failed++; }
  }
  return stats;
}
function dispatchEnvelope(env, fileName) {
  var handler = getEnvelopeHandler(env.type);
  if (!handler) { auditFail('envelope_no_handler', env.id, { type: env.type }); return { ok: false, error: 'no handler' }; }
  try {
    var result = handler.handle(env);
    audit('envelope_processed', env.id, { type: env.type, producer: env.producer, file: fileName || '', result: truncate(toJson(result === undefined ? null : result), 300) }, true, env.producer);
    Object.keys(HB_REGISTRY.observer).sort().forEach(function (name) {
      try { HB_REGISTRY.observer[name](env, result); } catch (e) { auditFail('envelope_observer_error', env.id, { observer: name, error: describeError(e) }); }
    });
    if (env.in_reply_to) { markRequestAnswered(env.in_reply_to, env); _archiveRequest(env.in_reply_to); }
    return { ok: true, result: result };
  } catch (e) {
    auditFail('envelope_failed', env.id, { type: env.type, error: describeError(e) }, env.producer);
    return { ok: false, error: describeError(e) };
  }
}
function _archiveRequest(reqId) {
  var f = getMailboxFolders();
  var it = f.toBrain.getFilesByName('req_' + reqId + '.json');
  while (it.hasNext()) _archive(it.next(), f.processed);
}

/** The request the brain is answering, read back from to-brain/req_<id>.json — null once archived or never written. Packs
 * use it from an envelope observer: the Requests row keeps only kind/status/chat, the payload lives in the file. */
function mailboxReadRequest(reqId) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(reqId || ''))) return null;
  var it = getMailboxFolders().toBrain.getFilesByName('req_' + reqId + '.json');
  if (!it.hasNext()) return null;
  try { var env = JSON.parse(it.next().getBlob().getDataAsString('UTF-8')); return isPlainObject(env) ? env : null; } catch (e) { return null; }
}

/** Write a request for the brain: to-brain/req_<id>.json with type "request" and payload {kind, text, chat, …}. Returns id. */
function mailboxWriteRequest(payload) {
  payload = payload || {};
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(payload.kind || '')) throw new Error('mailboxWriteRequest: bad kind');
  var id = uuid();
  var key = uploadKey(id);
  if (key) payload = Object.assign({}, payload, { upload_key: key });   // lets the routine POST files to ?route=upload
  var env = { v: 1, id: id, type: REQUEST_TYPE, created_at: nowIso(), producer: HELPER.producer, payload: payload };
  var pj = toJson(env);
  if (pj.length > LIMITS.ENVELOPE_MAX_PAYLOAD_CHARS) throw new Error('request too large');
  getMailboxFolders().toBrain.createFile('req_' + id + '.json', pj, 'application/json');
  audit('mailbox_request', id, { kind: payload.kind });
  return id;
}

/** to-brain/state.json: core fields + every registerSnapshotProvider(). */
function buildSnapshot() {
  var state = { v: 1, generated_at: nowIso(), tz: getTz(), helper: HELPER.name, version: HELPER.version, core_version: CORE_VERSION, wake_url: wakeUrl() };
  Object.keys(HB_REGISTRY.snapshot).sort().forEach(function (name) {
    try { state[name] = HB_REGISTRY.snapshot[name](); } catch (e) { state[name] = { error: describeError(e) }; }
  });
  return state;
}
function writeSnapshot() {
  var f = getMailboxFolders();
  var json = toJson(buildSnapshot());
  var it = f.toBrain.getFilesByName(MAILBOX.STATE_FILE);
  var file;
  if (it.hasNext()) { file = it.next(); file.setContent(json); } else { file = f.toBrain.createFile(MAILBOX.STATE_FILE, json, 'application/json'); }
  audit('snapshot_written', file.getId(), { chars: json.length });
  return file;
}
/** Daily: trash stale requests in to-brain and old archive files (trash, never delete). */
function pruneMailbox() {
  var f = getMailboxFolders();
  var trashed = 0;
  var reqCut = nowMs() - LIMITS.MAILBOX_TO_BRAIN_KEEP_DAYS * 86400000;
  var it = f.toBrain.getFiles();
  while (it.hasNext()) { var x = it.next(); if (/^req_/.test(x.getName()) && x.getDateCreated().getTime() < reqCut) { x.setTrashed(true); trashed++; } }
  var arcCut = nowMs() - LIMITS.MAILBOX_ARCHIVE_KEEP_DAYS * 86400000;
  [f.processed, f.rejected, f.failed].forEach(function (folder) {
    var it2 = folder.getFiles();
    while (it2.hasNext()) { var y = it2.next(); if (y.getDateCreated().getTime() < arcCut) { y.setTrashed(true); trashed++; } }
  });
  audit('mailbox_pruned', '', { trashed: trashed });
  return trashed;
}

/** Text fields are cleaned of hidden characters in place (validate and handle share the object) before the checks. */
function _textPayloadErrors(p, max) {
  var errs = [];
  if (typeof p.text === 'string') p.text = stripHidden(p.text);
  if (typeof p.text !== 'string' || !p.text.trim()) errs.push('text required');
  else if (p.text.length > max) errs.push('text > ' + max + ' chars');
  return errs;
}
/** Core envelope: notice — plain text to the owner. payload {text (≤4000), title?, level?: info|warn} */
registerEnvelopeHandler('notice', {
  validate: function (p) {
    var errs = _textPayloadErrors(p, 4000);
    if (typeof p.title === 'string') p.title = stripHidden(p.title);
    if (p.title !== undefined && (typeof p.title !== 'string' || p.title.length > 120)) errs.push('title invalid');
    if (p.level !== undefined && ['info', 'warn'].indexOf(p.level) < 0) errs.push('level must be info|warn');
    return errs;
  },
  handle: function (env) {
    var p = env.payload;
    var html = (p.level === 'warn' ? '⚠️ ' : 'ℹ️ ') + (p.title ? '<b>' + tgEscape(p.title) + '</b>\n' : '') + tgEscape(p.text);
    var r = tgSendOwner(html);
    return { sent: !!(r && r.ok) };
  }
});
/**
 * Core envelope: reply — the brain's answer to a request (envelope in_reply_to = request id).
 * payload {text (≤4000), html?: boolean, drive_file_ids?: { <label>: <Drive file id> }}. Sent to the owner as a Telegram
 * reply to the message that opened the request; each Drive file then follows as a document captioned with its label
 * (tgSendDocument — over-size files arrive as a link). `html: true` text goes through tgSafeHtml (Telegram's plain tags
 * and https links only); a file outside the helper's Drive folder is never attached (`document_outside_root`).
 */
function _driveFileIdsErrors(ids) {
  var errs = [];
  if (ids === undefined) return errs;
  if (!isPlainObject(ids)) { errs.push('drive_file_ids must be an object { label: id }'); return errs; }
  var keys = Object.keys(ids);
  if (keys.length > LIMITS.REPLY_MAX_DOCUMENTS) errs.push('drive_file_ids: at most ' + LIMITS.REPLY_MAX_DOCUMENTS + ' files');
  keys.forEach(function (k) {
    if (!/^[A-Za-z0-9 _.()-]{1,60}$/.test(k)) errs.push('drive_file_ids: bad label "' + truncate(k, 40) + '"');
    if (typeof ids[k] !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(ids[k])) errs.push('drive_file_ids["' + truncate(k, 40) + '"] must be a Drive file id');
  });
  return errs;
}
registerEnvelopeHandler('reply', {
  validate: function (p, env) {
    var errs = _textPayloadErrors(p, 4000);
    if (p.html !== undefined && typeof p.html !== 'boolean') errs.push('html must be boolean');
    if (env && !env.in_reply_to) errs.push('reply needs in_reply_to');
    return errs.concat(_driveFileIdsErrors(p.drive_file_ids));
  },
  handle: function (env) {
    var p = env.payload;
    var req = getRequest(env.in_reply_to);
    var html = p.html ? tgSafeHtml(p.text) : tgEscape(p.text);
    var opts = req && req.tg_message_id ? { replyTo: req.tg_message_id } : {};
    var chat = req && req.tg_chat_id ? req.tg_chat_id : tgOwnerChatId();
    var r = chat ? tgSend(chat, html, opts) : tgSendOwner(html, opts);
    var docs = 0, docsOk = 0;
    if (isPlainObject(p.drive_file_ids) && chat) {
      Object.keys(p.drive_file_ids).forEach(function (label) {
        docs++;
        if (driveFileWhere(p.drive_file_ids[label]) === 'outside') { auditFail('document_outside_root', p.drive_file_ids[label], { label: label }); return; }
        var d = tgSendDocument(chat, { driveFileId: p.drive_file_ids[label], caption: tgEscape(label), silent: true });
        if (d && d.ok) docsOk++;
      });
    }
    return { sent: !!(r && r.ok), request: req ? req.id : null, documents: docs, documents_sent: docsOk };
  }
});
/**
 * Core envelope: proposal — the brain proposes an allowlisted action; the owner still taps ✅.
 * payload {action: <ACTION_ALLOWLIST>, payload: {...}, rationale? (≤300), idempotency_key?, expires_in_min?}
 * Packs refuse proposals they do not want with registerProposalGuard().
 */
registerEnvelopeHandler('proposal', {
  validate: function (p) {
    var errs = [];
    if (ACTION_ALLOWLIST.indexOf(p.action) < 0) errs.push('action must be one of ' + ACTION_ALLOWLIST.join('|'));
    if (!isPlainObject(p.payload)) errs.push('payload object required');
    if (p.rationale !== undefined && (typeof p.rationale !== 'string' || p.rationale.length > 300)) errs.push('rationale ≤300 chars');
    if (p.idempotency_key !== undefined && (typeof p.idempotency_key !== 'string' || p.idempotency_key.length > 120)) errs.push('idempotency_key invalid');
    if (!errs.length) { var def = getActionDef(p.action); if (def) errs = (def.validate(p.payload) || []).map(function (e) { return p.action + ': ' + e; }); }
    return errs;
  },
  handle: function (env) {
    var p = env.payload;
    var names = Object.keys(HB_REGISTRY.proposal_guard).sort();
    for (var i = 0; i < names.length; i++) {
      var why = HB_REGISTRY.proposal_guard[names[i]](env, p);
      if (why) {
        auditFail('proposal_refused', env.id, { guard: names[i], action: p.action, reason: truncate(String(why), 200) }, env.producer);
        return { refused: truncate(String(why), 200), guard: names[i] };
      }
    }
    var row = proposeAction({ type: p.action, payload: p.payload, origin: env.producer + (p.rationale ? ' — ' + truncate(p.rationale, 60) : ''),
      idempotency_key: p.idempotency_key || ('env:' + env.id), expires_in_min: p.expires_in_min });
    return { pending_id: row.id, status: row.status };
  }
});

/** Core snapshot providers. */
registerSnapshotProvider('pending_actions', function () {
  return listPendingActions().map(function (r) { return { id: r.id, type: r.type, status: r.status, expires_at: r.expires_at, origin: r.origin }; });
});
registerSnapshotProvider('queue', function () { return { depth: queueDepth() }; });

// Developed by: LightAISolutions
