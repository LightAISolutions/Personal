/**
 * Tour Guide pack — the Mini App's route `?route=app` (WP-9b; plan §5.11, contract helpers/prompts/TG-PHASE-9.md row 9b).
 * registerRoute('app', { methods: ['POST'], auth: 'webapp' }): the core verified the owner's initData and counted the call
 * before tgAppHandle(req) runs; req.body = { initData, op, args }. Every operation IS the request or callback the chat
 * sends (the same storage functions, requests and flow events), so the chat keeps working with the app switched off:
 *   home · shortlist.get · shortlist.choose · shortlist.choose_many · shortlist.more · shortlist.done · trip.digest ·
 *   brochure.get · places.search · places.get · places.note · places.check · interview.bank · interview.submit · facts.get · facts.confirm
 * Answers: { status: 200, body: { ok: true, … } } or { status: 400 | 404 | 409 | 503, body: { ok: false, reason, … } }.
 * No Google call and no Google content: the app shows the pack's own rows only, and no key is read here.
 * Also here: the setup step `app_menu_button`, tgAppRows (the one `web_app` button the shortlist, plan_digest and /places
 * messages carry when APP_SHELL_URL is set) and the store of the shortlist messages' ids, so a choice made in the app
 * re-marks the chat's keyboard (tgAppSendRound · tgAppRememberRound · tgAppRefresh). Reasons: helpers/decisions/WP-9b.md.
 */
var TG_APP_BROCHURE_MAX_CHARS = 200000;  // brochure.get answers the HTML inline up to this length, else the Drive link
var TG_APP_ROWS_MAX = 24;                // places.search rows · places.check slugs
var TG_APP_QUERY_MAX = 200;              // places.search query
var TG_APP_FILTER_MAX = 64;              // places.search destination · status · tag
var TG_APP_CHOICES_MAX = 200;            // shortlist.choose_many
var TG_APP_ANSWERS_MAX = 200;            // interview.submit
var TG_APP_FACTS_MAX = 40;               // facts.confirm facts · edits (the plan flow's TG_PLAN_FACTS_MAX)
var TG_APP_MSGS_KEY = 'tg_app_sl_msgs';  // Settings: JSON [{ trip, run, round, chat, mid, kb }] — shortlist messages sent
var TG_APP_MSGS_MAX_CHARS = 30000;       // oldest entries go first past this
var TG_APP_LOCK_MS = 10000;
var TG_APP_RUN_RE = /^[A-Za-z0-9_.-]{1,64}$/;
var TG_APP_KEY_RE = /^[a-z]\d{1,3}$/;
var TG_APP_FACT_N_RE = /^x?\d{1,3}$/;
var TG_APP_CHOICES = ['w', 'l', 's'];

/* ==================== answers and argument checks ==================== */

function TgAppRefusal(status, reason, extra) { this.status = status; this.reason = reason; this.extra = extra || null; }
function tgAppRefuse(status, reason, extra) { throw new TgAppRefusal(status, reason, extra); }
function tgAppOk(fields) {
  var b = { ok: true };
  Object.keys(fields || {}).forEach(function (k) { b[k] = fields[k]; });
  return { status: 200, body: b };
}
function tgAppNo(status, reason, extra) {
  var b = { ok: false, reason: reason };
  if (extra) Object.keys(extra).forEach(function (k) { b[k] = extra[k]; });
  return { status: status, body: b };
}
/** Unknown argument names are refused (400 bad_args, field). */
function tgAppKeys(args, allowed) {
  Object.keys(args).forEach(function (k) { if (allowed.indexOf(k) < 0) tgAppRefuse(400, 'bad_args', { field: truncate(k, 40) }); });
}
/** A string argument: opts = { required, max, re }. Absent → '' (or 400 missing_arg). */
function tgAppStr(args, k, opts) {
  opts = opts || {};
  var v = args[k];
  if (v === undefined || v === null) { if (opts.required) tgAppRefuse(400, 'missing_arg', { field: k }); return ''; }
  if (typeof v !== 'string') tgAppRefuse(400, 'bad_args', { field: k });
  if (opts.max && v.length > opts.max) tgAppRefuse(400, 'too_long', { field: k, max: opts.max });
  if (opts.required && !v) tgAppRefuse(400, 'missing_arg', { field: k });
  if (v && opts.re && !opts.re.test(v)) tgAppRefuse(400, 'bad_args', { field: k });
  return v;
}
function tgAppArr(args, k, max, required) {
  var v = args[k];
  if (v === undefined || v === null) { if (required) tgAppRefuse(400, 'missing_arg', { field: k }); return []; }
  if (!Array.isArray(v)) tgAppRefuse(400, 'bad_args', { field: k });
  if (v.length > max) tgAppRefuse(400, 'too_many', { field: k, max: max });
  return v;
}
function tgAppBool(args, k, def) {
  var v = args[k];
  if (v === undefined || v === null) return def;
  if (typeof v !== 'boolean') tgAppRefuse(400, 'bad_args', { field: k });
  return v;
}
/** A Maps link the app may show: the chat's rule (tgCmdHref) — Google Maps hosts only, ≤ TG_CMD_URL_MAX; else ''. */
function tgAppMaps(u) {
  u = String(u || '');
  return TG_CMD_MAPS_URL.test(u) && u.length <= TG_CMD_URL_MAX ? u : '';
}
function tgAppS(v) { return v === undefined || v === null ? '' : String(v); }
/** Ops that write (Choices, flows, requests) run under the script lock, like a Telegram update. */
function tgAppLocked(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(TG_APP_LOCK_MS)) return tgAppNo(503, 'busy');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ==================== links into the app (web_app buttons, menu button) ==================== */

/** The shell's launch URL: APP_SHELL_URL?core=<WEBAPP_URL>[&screen=…][&trip=…]; '' when the property is unset or not https. */
function tgAppUrl(screen, trip) {
  var shell = getProp(PROP.APP_SHELL_URL);
  if (!shell) return '';
  if (!/^https:\/\/[^\s"'<>]+$/.test(shell)) {
    if (!seenOnce('tg_app_shell_url_invalid')) auditFail('tg_app_shell_url_invalid', PROP.APP_SHELL_URL, null);
    return '';
  }
  var core = webAppUrl();
  if (!core) return '';
  var u = shell + (shell.indexOf('?') >= 0 ? '&' : '?') + 'core=' + encodeURIComponent(core);
  if (screen) u += '&screen=' + encodeURIComponent(screen);
  if (trip) u += '&trip=' + encodeURIComponent(trip);
  return u;
}
/** Keyboard rows with the one `web_app` button for a chat message — [] without APP_SHELL_URL (the message stays as it was). */
function tgAppRows(screen, trip, label) {
  var u = tgAppUrl(screen, trip);
  return u ? [[{ text: label, web_app: { url: u } }]] : [];
}

registerSetupStep('app_menu_button', {
  label: 'Tour Guide: point the chat menu button at the app',
  description: 'Needs the APP_SHELL_URL property; without it nothing changes',
  run: function () {
    if (!getProp(PROP.APP_SHELL_URL)) return 'skipped: ' + PROP.APP_SHELL_URL + ' is not set — the menu button is unchanged';
    var url = tgAppUrl('', '');
    if (!url) return 'skipped: ' + PROP.APP_SHELL_URL + ' must be an https URL (and the web app URL must be known)';
    var r = tgSetMenuButton(url, HELPER.display_name || 'Tour Guide');
    return r && r.ok ? 'menu button set: it opens the app' : 'failed: ' + truncate(String((r && r.description) || '?'), 200);
  }
});

/* ==================== the shortlist messages in the chat (keyboard refresh after an app choice) ==================== */

function tgAppMsgsLoad() {
  var p = safeJsonParse(settingGet(TG_APP_MSGS_KEY, '[]'));
  return p.ok && Array.isArray(p.value) ? p.value.filter(isPlainObject) : [];
}
function tgAppMsgsSave(list) {
  var s = toJson(list);
  while (list.length && s.length > TG_APP_MSGS_MAX_CHARS) { list.shift(); s = toJson(list); }
  settingSet(TG_APP_MSGS_KEY, s, 'shortlist messages in the chat (an app choice re-marks their keyboard)');
}
function tgAppHasSl(kb) {
  return !!kb && Array.isArray(kb.inline_keyboard) && kb.inline_keyboard.some(function (row) {
    return Array.isArray(row) && row.some(function (b) { return b && String(b.callback_data || '').indexOf('sl:') === 0; });
  });
}
/**
 * Remember the chat messages of one shortlist round that carry sl: buttons: sent = [{ m: { html, keyboard }, r: the
 * sendMessage answer }]. A re-delivered round replaces its own entries. Never throws (the chat must not depend on it).
 */
function tgAppRememberRound(chat, trip, run, round, sent) {
  try {
    var keep = (sent || []).filter(function (x) {
      return x && x.m && x.r && x.r.ok && x.r.result && x.r.result.message_id && tgAppHasSl(x.m.keyboard);
    });
    if (!keep.length || !chat || !getProp(PROP.APP_SHELL_URL)) return 0;   // no app, no app choices to re-mark
    trip = String(trip); run = String(run); round = parseInt(round, 10) || 0;
    var list = tgAppMsgsLoad().filter(function (e) { return !(e.trip === trip && e.run === run && e.round === round); });
    keep.forEach(function (x) {
      list.push({ trip: trip, run: run, round: round, chat: String(chat), mid: x.r.result.message_id, kb: x.m.keyboard.inline_keyboard });
    });
    tgAppMsgsSave(list);
    return keep.length;
  } catch (e) { auditFail('tg_app_msgs_error', String(trip), describeError(e)); return 0; }
}
/** Send a round's messages (as tgCmdSendAll does) and remember their ids; returns the last answer. */
function tgAppSendRound(chat, trip, run, round, msgs) {
  var sent = [], last = null;
  (msgs || []).forEach(function (m) {
    if (!m || !m.html) return;
    last = tgSend(chat, m.html, m.keyboard ? { keyboard: m.keyboard } : undefined);
    sent.push({ m: m, r: last });
  });
  tgAppRememberRound(chat, trip, run, round, sent);
  return last;
}
/**
 * Re-mark the remembered chat keyboards of (trip, run) that hold any of `keys` (item keys like a3): the same "• " marks the
 * sl: callback puts on the tapped message (tgCmdRemark). One editMessageReplyMarkup per affected message; returns how many
 * went through. Never throws.
 */
function tgAppRefresh(trip, run, keys) {
  try {
    var want = {};
    (keys || []).forEach(function (k) { want[k] = true; });
    var list = tgAppMsgsLoad().filter(function (e) { return e.trip === trip && e.run === run && Array.isArray(e.kb); });
    if (!list.length) return 0;
    var by = tgAppSlots(trip, run).by, val = tgAppChoiceVals(trip, run), n = 0;
    list.forEach(function (e) {
      var hit = e.kb.some(function (row) {
        return Array.isArray(row) && row.some(function (b) { var p = String((b && b.callback_data) || '').split(':'); return p[0] === 'sl' && p[1] === run && want[p[2]]; });
      });
      if (!hit) return;
      var rows = e.kb.map(function (row) {
        return row.map(function (b) {
          var out = {}, k;
          for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
          var d = String(b.callback_data || '');
          if (d.indexOf('sl:') !== 0) return out;
          var p = d.split(':').slice(1), x = p[0] === run && by[p[1]];
          out.text = (x && val[x.slug] === p[2] ? '• ' : '') + String(b.text || '').replace(/^• /, '');
          return out;
        });
      });
      var r = tgApi('editMessageReplyMarkup', { chat_id: e.chat, message_id: e.mid, reply_markup: { inline_keyboard: rows } });
      if (r && r.ok) n++;
    });
    return n;
  } catch (err) { auditFail('tg_app_refresh_error', String(trip), describeError(err)); return 0; }
}

/* ==================== shared readers ==================== */

/** Items of a run by item key (a later round's item wins a key, as in the sl: callback) and the highest round. */
function tgAppSlots(trip, run) {
  var by = {}, round = 0;
  tgShortlistItems(trip, run).forEach(function (it) {
    by[tgPlanItemKey(it.group, it.n)] = it;
    if (it.round > round) round = it.round;
  });
  return { by: by, round: round };
}
/** slug → the owner's choice w | l | s in a run. */
function tgAppChoiceVals(trip, run) {
  var val = {};
  tgChoiceList(trip, run, 'shortlist').forEach(function (c) { val[c.key] = c.value; });
  return val;
}
/** The plan flow of the owner chat when it belongs to `trip` (else null). */
function tgAppPlanFlow(trip) {
  var chat = tgOwnerChat();
  var f = chat ? tgPlanActive(chat) : null;
  return f && (!trip || f.state.trip === trip) ? f : null;
}
/** A shortlist round: run given → its trip (the chat's own lookup), else the open round of the snapshot. → { trip, run }. */
function tgAppRound(run) {
  if (!run) {
    var cr = tgSnapshot().choice_round;
    if (!cr) tgAppRefuse(404, 'no_round');
    return { trip: cr.trip, run: cr.run };
  }
  var trip = tgPlanRunTrip(tgOwnerChat(), run);
  if (!trip) tgAppRefuse(404, 'no_round');
  return { trip: trip, run: tgShortlistRunKey(trip, run) };
}
function tgAppTripOut(t) {
  return { slug: tgAppS(t.slug), title: tgAppS(t.title), destination: tgAppS(t.destination), start: tgAppS(t.start), end: tgAppS(t.end),
    status: tgAppS(t.status), build_id: tgAppS(t.build_id), has_brochure: !!(t.drive_brochure_html || t.drive_brochure_pdf) };
}
function tgAppTrip(args) {
  var slug = tgAppStr(args, 'slug', { required: true, max: 64, re: TG_SLUG_RE });
  var t = tgTripGet(slug);
  if (!t) tgAppRefuse(404, 'no_trip');
  return t;
}
function tgAppPlaceOut(p) {
  return { slug: p.slug, name: p.name, destination: p.destination, area: p.area, category: p.category, tags: p.tags.slice(),
    status: p.status, last_trip: p.last_trip, last_researched: p.last_researched, last_verified: p.last_verified,
    note_line: p.note_line, maps_url: tgAppMaps(p.maps_url), history_summary: p.history_summary };
}

/* ==================== operations: home, shortlist ==================== */

/** home — the snapshot provider's data (tgSnapshot) with each trip's title and brochure flag, plus an open facts form. */
function tgAppOpHome() {
  var snap = tgSnapshot();
  var trips = (snap.trips || []).map(function (s) { return tgAppTripOut(tgTripGet(s.slug) || s); });
  var f = tgAppPlanFlow('');
  var pending = f && f.state.stage === 'confirm' && !f.state.ask ? { trip: f.state.trip } : null;
  return tgAppOk({ trips: trips, trips_total: snap.trips_total, choice_round: snap.choice_round, pending_facts: pending,
    profile_summary: snap.profile_summary, places: snap.places });
}

var TG_APP_GROUP_ORDER = ['activities', 'food'];
/** shortlist.get { run? } — the round's groups and items with their sl: item keys and the owner's choices so far. */
function tgAppOpShortlistGet(args) {
  var r = tgAppRound(tgAppStr(args, 'run', { max: 64, re: TG_APP_RUN_RE }));
  var s = tgAppSlots(r.trip, r.run), val = tgAppChoiceVals(r.trip, r.run);
  var groups = {}, order = [];
  Object.keys(s.by).forEach(function (k) {
    var it = s.by[k], g = it.group, x = isPlainObject(it.item) ? it.item : {};
    if (!groups[g]) { groups[g] = { id: g, title: TG_PLAN_GROUPS[g] ? TG_PLAN_GROUPS[g].title : g, items: [] }; order.push(g); }
    var seen = isPlainObject(x.seen_before) ? { trip: tgAppS(x.seen_before.trip), on: tgAppS(x.seen_before.on), outcome: tgAppS(x.seen_before.outcome) } : null;
    groups[g].items.push({ key: k, n: it.n, slug: it.slug, name: it.name, why_you: tgAppS(x.why_you),
      est_minutes: typeof x.est_minutes === 'number' ? x.est_minutes : null, area: tgAppS(x.area), maps_url: tgAppMaps(x.maps_url),
      gem: it.gem === true, gem_line: it.gem === true ? tgAppS(x.gem_line) : '', labels: Array.isArray(x.labels) ? x.labels.map(String) : [],
      new: x.new === true, seen_before: seen, changes: Array.isArray(x.changes) ? x.changes.slice(0, 3).map(String) : [],
      round: it.round, choice: val[it.slug] || '' });
  });
  if (!order.length) tgAppRefuse(404, 'no_round');
  var rank = function (g) { var i = TG_APP_GROUP_ORDER.indexOf(g); return i < 0 ? TG_APP_GROUP_ORDER.length : i; };
  order.sort(function (a, b) { return rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0); });
  var f = tgAppPlanFlow(r.trip), st = f ? f.state : null, choosing = !!st && st.stage === 'choose';
  var t = tgTripGet(r.trip) || { slug: r.trip };
  return tgAppOk({ trip: r.trip, title: tgAppS(t.title || t.destination || t.slug), run: r.run, round: s.round, flow: choosing,
    more: choosing && !!st.more && (st.more_rounds || 0) < TG_PLAN_MORE_MAX,
    groups: order.map(function (g) { groups[g].items.sort(function (a, b) { return a.n - b.n; }); return groups[g]; }) });
}
/** { n: item key, choice: w | l | s } from an object; nested entries refuse unknown keys. */
function tgAppChoiceArg(o, nested) {
  if (!isPlainObject(o)) tgAppRefuse(400, 'bad_args', { field: 'choices' });
  if (nested) tgAppKeys(o, ['n', 'choice']);
  var n = tgAppStr(o, 'n', { required: true, max: 4, re: TG_APP_KEY_RE });
  var c = tgAppStr(o, 'choice', { required: true, max: 1 });
  if (TG_APP_CHOICES.indexOf(c) < 0) tgAppRefuse(400, 'bad_args', { field: 'choice' });
  return { n: n, choice: c };
}
/** shortlist.choose { run, n, choice } — the sl:<run>:<n>:<choice> tap: one Choices row, then the chat keyboard re-marked. */
function tgAppOpChoose(args) {
  var run = tgAppStr(args, 'run', { required: true, max: 64, re: TG_APP_RUN_RE });
  var c = tgAppChoiceArg(args, false);
  var r = tgAppRound(run), it = tgAppSlots(r.trip, r.run).by[c.n];
  if (!it) tgAppRefuse(404, 'no_item', { n: c.n });
  tgChoiceSet(r.trip, r.run, 'shortlist', it.slug, c.choice, it.name);
  return tgAppOk({ n: c.n, choice: c.choice, slug: it.slug, refreshed: tgAppRefresh(r.trip, r.run, [c.n]) });
}
/**
 * shortlist.choose_many { run, choices: [{ n, choice }] } — the batch the app sends on submit: every entry is checked first
 * (one bad entry refuses the call), a key given twice counts once (the last), each applied like shortlist.choose; one
 * keyboard refresh per chat message at most.
 */
function tgAppOpChooseMany(args) {
  var run = tgAppStr(args, 'run', { required: true, max: 64, re: TG_APP_RUN_RE });
  var list = tgAppArr(args, 'choices', TG_APP_CHOICES_MAX, true).map(function (o) { return tgAppChoiceArg(o, true); });
  var r = tgAppRound(run), by = tgAppSlots(r.trip, r.run).by;
  var last = {}, keys = [];
  list.forEach(function (c) { if (!last[c.n]) keys.push(c.n); last[c.n] = c.choice; });
  var applied = 0, refused = [], done = [];
  keys.forEach(function (k) {
    var it = by[k];
    if (!it) { refused.push({ n: k, reason: 'no_item' }); return; }
    tgChoiceSet(r.trip, r.run, 'shortlist', it.slug, last[k], it.name);
    applied++; done.push(k);
  });
  return tgAppOk({ applied: applied, refused: refused, refreshed: done.length ? tgAppRefresh(r.trip, r.run, done) : 0 });
}
/** The plan flow of the round's trip at stage choose, holding the run (an `adopt` event adds a run it does not hold). */
function tgAppChooseFlow(r, needMore) {
  var f = tgAppPlanFlow(r.trip);
  if (!f || f.state.stage !== 'choose') tgAppRefuse(409, 'no_flow', f ? { stage: tgAppS(f.state.stage) } : null);
  if (needMore && (!f.state.more || (f.state.more_rounds || 0) >= TG_PLAN_MORE_MAX)) tgAppRefuse(409, 'no_more');
  return f;
}
function tgAppAdopt(f, r) {
  if ((f.state.runs || []).indexOf(r.run) >= 0) return false;
  flowResume(tgOwnerChat(), { type: 'resume', event: 'adopt', run: r.run, more: !!f.state.more });
  return true;
}
/** shortlist.more { run, gems? } — the choose stage's ➕ More options (💎 More gems with gems: true). */
function tgAppOpMore(args) {
  var run = tgAppStr(args, 'run', { required: true, max: 64, re: TG_APP_RUN_RE });
  var gems = tgAppBool(args, 'gems', false);
  var r = tgAppRound(run), f = tgAppChooseFlow(r, true);
  tgAppAdopt(f, r);
  flowResume(tgOwnerChat(), { type: 'button', value: gems ? 'gems' : 'more' });
  var after = tgAppPlanFlow(r.trip);
  return after && after.state.stage === 'research' ? tgAppOk({ started: true, gems: gems }) : tgAppNo(409, 'no_flow');
}
/**
 * shortlist.done { run } — ✅ Done choosing. With the trip's plan flow at stage choose: that flow (the round adopted when it
 * is not one of its runs). With no flow at all and the run being the latest round of a trip still `choosing`: the pl:sc
 * adopt path (a plan flow started in adopt mode), then done. Anything else: 409 no_flow (busy when another flow is open).
 * No ✅ pick yet → 400 no_picks and the flow is left as it was.
 */
function tgAppOpDone(args) {
  var run = tgAppStr(args, 'run', { required: true, max: 64, re: TG_APP_RUN_RE });
  var r = tgAppRound(run), chat = tgOwnerChat();
  if (!chat) tgAppRefuse(409, 'no_flow');
  var f = tgAppPlanFlow(r.trip), adopted = false;
  if (f) {
    tgAppChooseFlow(r, false);
    var runs = (f.state.runs || []).concat((f.state.runs || []).indexOf(r.run) < 0 ? [r.run] : []);
    if (!tgPlanTaps({ trip: r.trip, runs: runs }).picks.length) tgAppRefuse(400, 'no_picks');
    tgAppAdopt(f, r);
  } else {
    var other = flowActive(chat);
    if (other) tgAppRefuse(409, 'busy', { flow: tgAppS(other.flow) });
    var t = tgTripGet(r.trip), latest = tgShortlistLatest(r.trip);
    if (!t || t.status !== 'choosing' || !latest || latest.run !== r.run) tgAppRefuse(409, 'no_flow');
    if (!tgPlanTaps({ trip: r.trip, runs: [r.run] }).picks.length) tgAppRefuse(400, 'no_picks');
    flowStart(chat, 'plan', { adopt: { trip: r.trip, run: r.run, more: false } });
    adopted = true;
  }
  flowResume(chat, { type: 'button', value: 'done' });
  var after = tgAppPlanFlow(r.trip);
  return after && after.state.stage === 'planning' ? tgAppOk({ started: true, adopted: adopted }) : tgAppNo(409, 'no_flow');
}

/* ==================== operations: the trip, the brochure ==================== */

function tgAppNum(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
/** trip.digest { slug } — the trip (title, dates, status, lodging) and its stored days and Later list (DayPlans · Later). */
function tgAppOpDigest(args) {
  var t = tgAppTrip(args);
  var trip = tgAppTripOut(t);
  trip.verified_on = tgAppS(t.verified_on);
  trip.lodging = t.lodging && t.lodging.text ? { text: tgAppS(t.lodging.text), nights: tgAppNum(t.lodging.nights) } : null;
  var days = tgDigestDays(t.slug).map(function (d) {
    var arr = function (a) { return Array.isArray(a) ? a.filter(isPlainObject) : []; };
    return {
      date: d.date, n: d.n, theme: tgAppS(d.theme),
      stops: arr(d.stops).map(function (s) {
        return { n: tgAppNum(s.n), slug: tgAppS(s.slug), name: tgAppS(s.name), arrive: tgAppS(s.arrive), depart: tgAppS(s.depart),
          minutes: tgAppNum(s.minutes), maps_url: tgAppMaps(s.maps_url), note_line: tgAppS(s.note_line) };
      }),
      legs: arr(d.legs).map(function (l) {
        return { from: tgAppS(l.from), to: tgAppS(l.to), mode: tgAppS(l.mode), minutes: tgAppNum(l.minutes), maps_url: tgAppMaps(l.maps_url) };
      }),
      warnings: (Array.isArray(d.warnings) ? d.warnings : []).map(tgAppS),
      rain: arr(d.rain).map(function (r) {
        return { slug: tgAppS(r.slug), name: tgAppS(r.name), instead_of: tgAppS(r.instead_of), km: tgAppNum(r.km), maps_url: tgAppMaps(r.maps_url) };
      })
    };
  });
  var later = tgLaterList(t.slug).map(function (l) {
    var known = Object.prototype.hasOwnProperty.call(TG_CMD_LATER_REASONS, l.reason);
    return { slug: l.place_slug, name: l.name, reason: l.reason, reason_text: known ? TG_CMD_LATER_REASONS[l.reason] : l.reason };
  });
  return tgAppOk({ trip: trip, days: days, later: later });
}
/**
 * brochure.get { slug } — the stored brochure HTML (Trips.drive_brochure_html) inline when ≤ TG_APP_BROCHURE_MAX_CHARS,
 * else its Drive link. The file must sit inside the helper's Drive folder (the /brochure rule, tgCmdDriveWhere): an id
 * pointing elsewhere is refused and audited, like a missing file (no_brochure).
 */
function tgAppOpBrochure(args) {
  var t = tgAppTrip(args), id = t.drive_brochure_html;
  if (!id) return tgAppNo(404, 'no_brochure');
  var where = tgCmdDriveWhere(id);
  if (where === 'outside') { auditFail('tg_app_brochure_outside_root', String(id), { trip: t.slug }); return tgAppNo(404, 'no_brochure'); }
  if (where !== 'in') return tgAppNo(404, 'no_brochure');
  var file = DriveApp.getFileById(String(id));
  var head = { verified_on: tgAppS(t.verified_on), build_id: tgAppS(t.build_id) };
  var link = function () { head.link = file.getUrl(); return tgAppOk(head); };
  if (file.getSize() > 4 * TG_APP_BROCHURE_MAX_CHARS) return link();   // bytes; never read a file that cannot fit
  if (String(file.getMimeType() || '').toLowerCase().indexOf('text/html') !== 0) return link();   // only HTML goes inline (security review, INFO)
  var html = file.getBlob().getDataAsString();
  if (html.length > TG_APP_BROCHURE_MAX_CHARS) return link();
  head.html = html;
  return tgAppOk(head);
}

/* ==================== operations: places ==================== */

/**
 * places.search { query?, destination?, status?, tag? } — the Places tab, own fields only. Every word of the query must
 * match the name, area, tags or slug (case- and accent-insensitive, as /places); the current trip's destination first,
 * then names starting with the query, containing it, the rest. No query: newest first (last verified or researched).
 * total counts the matches before the TG_APP_ROWS_MAX cut; filters lists the values the tab holds.
 */
function tgAppOpPlacesSearch(args) {
  var q = tgShFold(tgAppStr(args, 'query', { max: TG_APP_QUERY_MAX })).trim().replace(/\s+/g, ' ');
  var dest = tgAppStr(args, 'destination', { max: TG_APP_FILTER_MAX });
  var status = tgAppStr(args, 'status', { max: TG_APP_FILTER_MAX });
  var tag = tgShFold(tgAppStr(args, 'tag', { max: TG_APP_FILTER_MAX })).trim();
  var all = storeAll(TG_SHEETS.PLACES).map(tgShPlaceOut);
  var fd = {}, fs = {}, ft = {};
  all.forEach(function (p) {
    if (p.destination) fd[p.destination] = true;
    if (p.status) fs[p.status] = true;
    p.tags.forEach(function (x) { if (x) ft[x] = true; });
  });
  var cur = tgTripCurrent(), here = cur && cur.destination ? tgSlug(cur.destination) : '';
  var words = q ? q.split(' ') : [], hits = [];
  all.forEach(function (p, i) {
    if (dest && p.destination !== dest) return;
    if (status && p.status !== status) return;
    if (tag && !p.tags.some(function (x) { return tgShFold(x).trim() === tag; })) return;
    var name = tgShFold(p.name);
    if (words.length) {
      var hay = name + ' ' + tgShFold(p.area) + ' ' + tgShFold(p.tags.join(' ')) + ' ' + tgShFold(p.slug.replace(/-/g, ' '));
      if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
    }
    hits.push({ p: p, i: i, name: name, d: here && p.destination === here ? 0 : 1,
      rank: name.indexOf(q) === 0 ? 0 : name.indexOf(q) > 0 ? 1 : 2,
      when: [p.last_verified, p.last_researched].sort().pop() || '' });
  });
  if (words.length) hits.sort(function (a, b) { return a.d - b.d || a.rank - b.rank || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
  else hits.sort(function (a, b) { return a.when !== b.when ? (a.when < b.when ? 1 : -1) : b.i - a.i; });
  var cap = function (o) { return Object.keys(o).sort().slice(0, 200); };
  return tgAppOk({ rows: hits.slice(0, TG_APP_ROWS_MAX).map(function (h) { return tgAppPlaceOut(h.p); }), total: hits.length,
    filters: { destinations: cap(fd), statuses: cap(fs), tags: cap(ft) } });
}
function tgAppPlace(args) {
  var slug = tgAppStr(args, 'slug', { required: true, max: 64, re: TG_SLUG_RE });
  var p = tgPlacesGet(slug);
  if (!p) tgAppRefuse(404, 'no_place', { slug: slug });
  return p;
}
/** The 📝 Full note button of /places: a notes request (with the current trip when there is one) → its id. */
function tgAppNoteRequest(p) {
  var trip = tgTripCurrent(), payload = { places: [p.slug] };
  if (trip) payload.trip = trip.slug;
  return tgOpenKindRequest('notes', payload, { text: 'full note: ' + p.name, ack: '📝 Writing the full note for <b>' + tgEscape(p.name) + '</b>…' }).id;
}
/**
 * places.get { slug, note? } — one place; history is the stored history summary (the Places tab keeps no more than that).
 * note: true also asks for the full note (request_id), under the script lock like any write.
 */
function tgAppOpPlacesGet(args) {
  var p = tgAppPlace(args), out = tgAppPlaceOut(p), note = tgAppBool(args, 'note', false);
  out.history = p.history_summary ? [{ trip: p.last_trip, date: p.last_verified || p.last_researched, text: p.history_summary }] : [];
  if (!note) return tgAppOk({ place: out });
  return tgAppLocked(function () { return tgAppOk({ place: out, request_id: tgAppNoteRequest(p) }); });
}
/** places.note { slug } — the full note alone. */
function tgAppOpPlacesNote(args) { return tgAppOk({ request_id: tgAppNoteRequest(tgAppPlace(args)) }); }
/**
 * places.check { slugs } — the 🔁 fresh check of /places for several places at once: one places request (scope check).
 * All the places must share one destination (else 400 mixed_destinations); a place with none takes the current trip's.
 */
function tgAppOpPlacesCheck(args) {
  var list = tgAppArr(args, 'slugs', TG_APP_ROWS_MAX, true), slugs = [], places = [];
  list.forEach(function (s) {
    if (typeof s !== 'string' || !TG_SLUG_RE.test(s)) tgAppRefuse(400, 'bad_args', { field: 'slugs' });
    if (slugs.indexOf(s) >= 0) return;
    var p = tgPlacesGet(s);
    if (!p) tgAppRefuse(404, 'no_place', { slug: s });
    slugs.push(s); places.push(p);
  });
  if (!slugs.length) tgAppRefuse(400, 'missing_arg', { field: 'slugs' });
  var dests = [];
  places.forEach(function (p) { if (p.destination && dests.indexOf(p.destination) < 0) dests.push(p.destination); });
  if (dests.length > 1) tgAppRefuse(400, 'mixed_destinations');
  var trip = tgTripCurrent();
  var dest = dests[0] || (trip && trip.destination ? tgSlug(trip.destination) : '');
  if (!dest) tgAppRefuse(400, 'no_destination');
  var label = places.length === 1 ? places[0].name : places.length + ' places';
  var r = tgOpenKindRequest('places', { scope: 'check', destination: dest, slugs: slugs },
    { text: 'check ' + label, ack: '🔁 Checking <b>' + tgEscape(label) + '</b>…' });
  return tgAppOk({ request_id: r.id, count: slugs.length });
}

/* ==================== operations: the interview ==================== */

/** interview.bank — the bank as generated, plus the answers of an interview in progress in the chat ([] otherwise). */
function tgAppOpInterviewBank() {
  var chat = tgOwnerChat(), f = chat ? flowActive(chat) : null, answers = [];
  var live = !!f && f.flow === 'interview' && isPlainObject(f.state);
  if (live && isPlainObject(f.state.ans)) {
    (Array.isArray(f.state.qids) ? f.state.qids : []).forEach(function (qid) {
      (Array.isArray(f.state.ans[qid]) ? f.state.ans[qid] : []).forEach(function (a) {
        if (isPlainObject(a)) answers.push({ qid: tgAppS(a.qid), value: tgAppS(a.value), polarity: tgAppS(a.polarity), kind: tgAppS(a.kind) });
      });
    });
  }
  return tgAppOk({ bank: tgIvBank(), answers: answers, in_progress: live });
}
/** One answered question → kit answers, mapped exactly as the chat's interview does (_tgIvAnswer). */
function tgAppIvAnswers(q, values) {
  var byValue = {}, picked = [], typed = [];
  q.options.forEach(function (o, k) { byValue[o.value] = k; });
  values.forEach(function (v) {
    if (q.kind !== 'text' && Object.prototype.hasOwnProperty.call(byValue, v)) { if (picked.indexOf(byValue[v]) < 0) picked.push(byValue[v]); }
    else if (typed.indexOf(v) < 0) typed.push(v);
  });
  if (q.kind === 'text') {
    if (typed.length > TG_IV_TEXT_VALUES_MAX) tgAppRefuse(400, 'too_many', { qid: q.qid, max: TG_IV_TEXT_VALUES_MAX });
    return typed.map(function (v) { return _tgIvAnswer(q, v, '+'); });
  }
  if (q.kind !== 'multi') {
    if (typed.length || picked.length !== 1) tgAppRefuse(400, 'bad_value', { qid: q.qid });
    return [_tgIvAnswer(q, q.options[picked[0]].value, q.options[picked[0]].polarity)];
  }
  if (typed.length && !q.other) tgAppRefuse(400, 'bad_value', { qid: q.qid });
  if (typed.length > TG_IV_TEXT_VALUES_MAX) tgAppRefuse(400, 'too_many', { qid: q.qid, max: TG_IV_TEXT_VALUES_MAX });
  var pol = q.options.length ? q.options[0].polarity : '+';
  return picked.sort(function (a, b) { return a - b; }).map(function (k) { return _tgIvAnswer(q, q.options[k].value, q.options[k].polarity); })
    .concat(typed.map(function (t) { var a = _tgIvAnswer(q, t, pol); a.kind = 'text'; return a; }));
}
/**
 * interview.submit { version: 1, answers: [{ qid, values }] } — the whole form at once: values are option values or typed
 * words (≤ TG_IV_TEXT_VALUES_MAX typed per question, each ≤ TG_IV_VALUE_MAX after whitespace is folded). Answers go in bank
 * order into one prefs request exactly like the chat's last question (tgIvFinish); an interview open in the chat ends.
 */
function tgAppOpInterviewSubmit(args) {
  if (args.version === undefined || args.version === null) tgAppRefuse(400, 'missing_arg', { field: 'version' });
  if (args.version !== 1) tgAppRefuse(400, 'bad_args', { field: 'version' });
  var by = {};
  tgAppArr(args, 'answers', TG_APP_ANSWERS_MAX, true).forEach(function (o) {
    if (!isPlainObject(o)) tgAppRefuse(400, 'bad_args', { field: 'answers' });
    tgAppKeys(o, ['qid', 'values']);
    var qid = tgAppStr(o, 'qid', { required: true, max: 64 });
    var f = tgIvFind(qid);
    if (!f) tgAppRefuse(400, 'unknown_qid', { qid: qid });
    if (by[qid]) tgAppRefuse(400, 'duplicate_qid', { qid: qid });
    var values = tgAppArr(o, 'values', f.q.options.length + TG_IV_TEXT_VALUES_MAX, false).map(function (v) {
      if (typeof v !== 'string') tgAppRefuse(400, 'bad_value', { qid: qid });
      var s = v.replace(/\s+/g, ' ').trim();
      if (!s) tgAppRefuse(400, 'bad_value', { qid: qid });
      if (s.length > TG_IV_VALUE_MAX) tgAppRefuse(400, 'too_long', { qid: qid, max: TG_IV_VALUE_MAX });
      return s;
    });
    by[qid] = values.length ? tgAppIvAnswers(f.q, values) : [];
  });
  var answers = [];
  tgIvQids('').forEach(function (qid) { (by[qid] || []).forEach(function (a) { answers.push(a); }); });
  if (!answers.length) tgAppRefuse(400, 'empty');
  var chat = tgOwnerChat(), live = chat ? flowActive(chat) : null;
  if (live && live.flow === 'interview') flowCancel(chat);
  var n = answers.length;
  var r = tgOpenKindRequest('prefs', { interview: { version: 1, answers: answers } }, { text: 'interview answers (' + n + ') · app',
    ack: '✅ ' + n + ' answer' + (n === 1 ? '' : 's') + ' from the app noted. Building your profile…' });
  return tgAppOk({ request_id: r.id, answers: n });
}

/* ==================== operations: the trip facts (plan flow, stage confirm) ==================== */

/** The trip's plan flow while its facts are open (stage confirm, before the questions) — else 409 no_flow. */
function tgAppFactsFlow(args) {
  var trip = tgAppStr(args, 'trip', { required: true, max: 64, re: TG_SLUG_RE });
  var f = tgAppPlanFlow(trip);
  if (!f || f.state.stage !== 'confirm' || f.state.ask) tgAppRefuse(409, 'no_flow', f ? { stage: tgAppS(f.state.stage) } : null);
  return f;
}
function tgAppFactsOut(f) {
  var taps = tgPlanFactTaps(f.state.trip);
  return (f.state.facts || []).map(function (x) {
    var t = taps[String(x.n)], edited = !!t && t.value === 'e' && !!t.text;
    var o = { n: x.n, kind: tgAppS(x.kind), text: edited ? t.text : tgAppS(x.text), start: tgAppS(x.start), end: tgAppS(x.end),
      choice: !t ? '' : t.value === 'n' ? 'n' : 'y', edited: edited, original: tgAppS(x.text) };
    if (edited && x.kind === 'dates') { var d = tgPlanParseDates(t.text); o.start = d ? d.start : ''; o.end = d ? d.end : ''; }
    return o;
  });
}
/** facts.get { trip } — the found facts with the taps so far (✏️ corrections shown as edited) and what is still missing. */
function tgAppOpFactsGet(args) {
  var f = tgAppFactsFlow(args);
  return tgAppOk({ trip: f.state.trip, found: tgAppFactsOut(f), missing: (f.state.missing || []).slice() });
}
/**
 * facts.confirm { trip, facts: [{ n, choice: y | n }], edits: [{ n, text }], advance? } — the ✅ ❌ taps and ✏️ lines, stored
 * as the tf: callback and the edit step store them (edits after taps, so an edit wins its fact). Then, unless advance is
 * false or an entry was refused, the ▶️ Continue tap: the flow moves on to its questions (or the research) in the chat.
 * done = the facts stage is over.
 */
function tgAppOpFactsConfirm(args) {
  var f = tgAppFactsFlow(args), trip = f.state.trip;
  var byN = {};
  (f.state.facts || []).forEach(function (x) { byN[String(x.n)] = x; });
  var nOf = function (o) {
    var n = typeof o.n === 'number' && isFinite(o.n) ? String(o.n) : tgAppStr(o, 'n', { required: true, max: 4 });
    if (!TG_APP_FACT_N_RE.test(n)) tgAppRefuse(400, 'bad_args', { field: 'n' });
    return n;
  };
  var taps = tgAppArr(args, 'facts', TG_APP_FACTS_MAX, false).map(function (o) {
    if (!isPlainObject(o)) tgAppRefuse(400, 'bad_args', { field: 'facts' });
    tgAppKeys(o, ['n', 'choice']);
    var c = tgAppStr(o, 'choice', { required: true, max: 1 });
    if (c !== 'y' && c !== 'n') tgAppRefuse(400, 'bad_args', { field: 'choice' });
    return { n: nOf(o), choice: c };
  });
  var edits = tgAppArr(args, 'edits', TG_APP_FACTS_MAX, false).map(function (o) {
    if (!isPlainObject(o)) tgAppRefuse(400, 'bad_args', { field: 'edits' });
    tgAppKeys(o, ['n', 'text']);
    return { n: nOf(o), text: tgAppStr(o, 'text', { required: true, max: 2000 }).replace(/\s+/g, ' ').trim() };
  });
  var advance = tgAppBool(args, 'advance', true);
  var applied = 0, refused = [];
  taps.forEach(function (t) {
    if (!byN[t.n]) { refused.push({ n: t.n, reason: 'no_fact' }); return; }
    tgChoiceSet(trip, TG_PLAN_INTAKE_RUN, 'fact', t.n, t.choice, '');
    applied++;
  });
  edits.forEach(function (e) {
    var x = byN[e.n];
    if (!x) { refused.push({ n: e.n, reason: 'no_fact' }); return; }
    if (!e.text) { refused.push({ n: e.n, reason: 'empty' }); return; }
    if (tgPlanTextProblem(e.text, TG_PLAN_FACT_CHARS)) { refused.push({ n: e.n, reason: 'too_long' }); return; }
    if (x.kind === 'dates' && /\d{4}-\d{2}-\d{2}/.test(e.text) && tgPlanDatesProblem(e.text)) { refused.push({ n: e.n, reason: 'bad_dates' }); return; }
    tgChoiceSet(trip, TG_PLAN_INTAKE_RUN, 'fact', e.n, 'e', e.text);
    applied++;
  });
  if (advance && !refused.length) flowResume(tgOwnerChat(), { type: 'button', value: 'go' });
  var after = tgAppPlanFlow(trip);
  return tgAppOk({ applied: applied, refused: refused, done: !(after && after.state.stage === 'confirm' && !after.state.ask) });
}

/* ==================== the route ==================== */

/** op → { args: allowed argument names, write: runs under the script lock, fn }. */
var TG_APP_OPS = {
  'home': { args: [], fn: tgAppOpHome },
  'shortlist.get': { args: ['run'], fn: tgAppOpShortlistGet },
  'shortlist.choose': { args: ['run', 'n', 'choice'], write: true, fn: tgAppOpChoose },
  'shortlist.choose_many': { args: ['run', 'choices'], write: true, fn: tgAppOpChooseMany },
  'shortlist.more': { args: ['run', 'gems'], write: true, fn: tgAppOpMore },
  'shortlist.done': { args: ['run'], write: true, fn: tgAppOpDone },
  'trip.digest': { args: ['slug'], fn: tgAppOpDigest },
  'brochure.get': { args: ['slug'], fn: tgAppOpBrochure },
  'places.search': { args: ['query', 'destination', 'status', 'tag'], fn: tgAppOpPlacesSearch },
  'places.get': { args: ['slug', 'note'], fn: tgAppOpPlacesGet },
  'places.note': { args: ['slug'], write: true, fn: tgAppOpPlacesNote },
  'places.check': { args: ['slugs'], write: true, fn: tgAppOpPlacesCheck },
  'interview.bank': { args: [], fn: tgAppOpInterviewBank },
  'interview.submit': { args: ['version', 'answers'], write: true, fn: tgAppOpInterviewSubmit },
  'facts.get': { args: ['trip'], fn: tgAppOpFactsGet },
  'facts.confirm': { args: ['trip', 'facts', 'edits', 'advance'], write: true, fn: tgAppOpFactsConfirm }
};
/** The route handler: body = { op, args }. A refusal (TgAppRefusal) becomes its answer; anything else is the core's 500. */
function tgAppHandle(req) {
  var b = req && isPlainObject(req.body) ? req.body : {};
  if (b.op === undefined || b.op === null || b.op === '') return tgAppNo(400, 'missing_arg', { field: 'op' });
  var op = typeof b.op === 'string' ? b.op : '';
  var def = op && Object.prototype.hasOwnProperty.call(TG_APP_OPS, op) ? TG_APP_OPS[op] : null;
  if (!def) return tgAppNo(400, 'unknown_op');
  var args = b.args === undefined || b.args === null ? {} : b.args;
  if (!isPlainObject(args)) return tgAppNo(400, 'bad_args', { field: 'args' });
  try {
    tgAppKeys(args, def.args);
    return def.write ? tgAppLocked(function () { return def.fn(args); }) : def.fn(args);
  } catch (e) {
    if (e instanceof TgAppRefusal) return tgAppNo(e.status, e.reason, e.extra);
    throw e;
  }
}

registerRoute('app', { methods: ['POST'], auth: 'webapp', handler: tgAppHandle });

// Developed by: LightAISolutions
