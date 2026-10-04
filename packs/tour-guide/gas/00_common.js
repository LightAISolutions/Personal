/**
 * Tour Guide pack — shared helpers for every pack file (owner: the Phase 5 coordinator; WPs call, never edit).
 * Loads first among the pack files (bundle order is by file name). Registries only; no core file is touched.
 *   tgKindRoutine(kind)               → routine fire name for a request kind (TourGuide routines/README.md table)
 *   tgOpenKindRequest(kind, payload, opts) → openRequest() with the right routine (research / plan / replan add the
 *                                     owner's trip_update; plan / replan carry lodging_fp, C13); acknowledges in the chat
 *   tgSlug(text)                      → lower-case [a-z0-9-] slug, ≤ 60 chars
 *   tgOwnerChat()                     → the owner chat id ('' before pairing)
 *   tgLines(lines, max)               → join escaped lines into messages ≤ max chars (default LIMITS.TG_SPLIT_AT)
 *   TG_SETTINGS                       → Settings keys the pack files share
 */
var TG_KIND_ROUTINE = {
  research: 'RESEARCH', plan: 'PLAN', replan: 'PLAN', notes: 'NOTES', brochure: 'BROCHURE',
  prefs: 'PREFS', places: 'PLACES', message: 'CHAT', ask: 'CHAT',
  outline: 'PLAN', day_versions: 'PLAN'   // WP-11f: the journey's outlines and day versions go to the planning routine
};
/** Request kinds that carry the owner's trip_update (22_people.js tgTripUpdateOf). */
var TG_TRIP_UPDATE_KINDS = ['research', 'plan', 'replan', 'outline', 'day_versions'];
var TG_SETTINGS = {
  PROFILE_SUMMARY: 'tg_profile_summary',   // JSON { text, dimensions_count?, updated?, received_at } — written by 20_envelopes.js
  CURRENT_TRIP: 'tg_current_trip',         // slug of the trip the owner is working on — written by 12_flow_plan.js
  REVIEW_OFFERED: 'tg_review_offered',     // JSON { <trip slug>: <ISO> } — written by the review daily job
  SMART: 'tg_smart'                        // 'on' | 'off' — the owner's /smart toggle for Lane B (30_chat_api.js); unset = CHAT_API_ENABLED, default off
};

function tgKindRoutine(kind) {
  var k = String(kind || '');
  if (k === 'scout') return routineConfigured('SCOUT') ? 'SCOUT' : 'RESEARCH';   // TG-SCOUT §2: own routine when set
  return Object.prototype.hasOwnProperty.call(TG_KIND_ROUTINE, k) ? TG_KIND_ROUTINE[k] : HELPER.inbound_routine;
}

/**
 * Open a request for the brain. payload holds the kind's fields (TG-PHASE-4B §5); text is the owner's words (or a
 * short description the pack writes). opts = { chat?, text?, ack?: html | false, replyTo? }.
 * Returns openRequest()'s result plus { routine }. Never throws on a routine that is not configured: the request file
 * is still written and the next run sees it; the owner is told which property is missing.
 */
function tgOpenKindRequest(kind, payload, opts) {
  opts = opts || {};
  var routine = tgKindRoutine(kind);
  payload = payload || {};
  if (TG_TRIP_UPDATE_KINDS.indexOf(kind) >= 0 && payload.trip && !payload.trip_update && typeof tgTripUpdateOf === 'function') {
    var tu = tgTripUpdateOf(payload.trip);   // the owner's /dates and app choices reach trips/<slug>.md through the routine
    if (tu) payload.trip_update = tu;
  }
  var fp = '';
  if ((kind === 'plan' || kind === 'replan') && typeof tgLgStampFp === 'function') {   // C13: stamped here, in one place (WP-13c)
    delete payload.lodging_fp;
    fp = payload.trip ? _safe('tg_lodging_fp', function () { return tgLgStampFp(tgTripGet(payload.trip), kind, payload); }) || '' : '';
    if (fp) payload.lodging_fp = fp;
  }
  var r = openRequest({ kind: kind, text: String(opts.text || kind), chat: opts.chat || null, routine: routine, payload: payload });
  r.routine = routine;
  if (fp && r.id) _safe('tg_lodging_req', function () { return tgLgReqRemember(r.id, fp); });
  var chat = tgOwnerChat();
  if (chat && opts.ack !== false) {
    var send = { silent: true };
    if (opts.replyTo) send.replyTo = opts.replyTo;
    if (r.fired && r.fired.ok) { if (opts.ack) tgSend(chat, opts.ack, send); }
    else if (r.fired && r.fired.skipped === 'not_configured') {
      tgSend(chat, '⏳ Saved, but no routine answers <code>' + tgEscape(kind) + '</code> yet — set <code>' + tgEscape(routineProp(routine, 'URL')) + '</code> and <code>' + tgEscape(routineProp(routine, 'TOKEN')) + '</code>.', send);
    } else {
      tgSend(chat, '⏳ Saved — the routine could not be fired right now (' + tgEscape((r.fired && (r.fired.skipped || r.fired.error || ('HTTP ' + r.fired.code))) || '?') + '). It will see the request on its next run.', send);
    }
  }
  return r;
}

function tgSlug(text) {
  var s = String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, 60).replace(/-+$/, '');
}

function tgOwnerChat() { return tgOwnerChatId() || ''; }

/**
 * One line of escaped HTML cut to ≤ max chars in its visible text only (WP-13c, A11): never inside a tag, an entity or a
 * surrogate pair; a link (<a …>…</a>) is kept whole or dropped whole; '…' marks the cut and every tag still open is closed
 * after it; a tag opened right at the cut is dropped rather than left empty. A line that fits is returned unchanged.
 */
var TG_HTML_TOKEN_RE = /<a\b[^>]*>[\s\S]*?<\/a>|<[^>]*>|&(?:[a-zA-Z]{1,8}|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g;
function tgHtmlClip(html, max) {
  html = String(html === undefined || html === null ? '' : html);
  max = Math.max(1, Number(max) || LIMITS.TG_SPLIT_AT);
  if (html.length <= max) return html;
  var toks = html.match(TG_HTML_TOKEN_RE) || [], kept = [], stack = [], len = 0;
  var closers = function (st) { var c = 0; for (var i = 0; i < st.length; i++) c += st[i].length + 3; return c; };
  for (var i = 0; i < toks.length; i++) {
    var t = toks[i], next = stack, whole = /^<a\b[\s\S]*<\/a>$/i.test(t), m = whole ? null : /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)[^>]*>$/.exec(t);
    if (m) {
      var name = m[2].toLowerCase();
      next = stack.slice();
      if (m[1]) { var at = next.lastIndexOf(name); if (at >= 0) next.length = at; }
      else if (!/\/\s*>$/.test(t)) next.push(name);
    }
    if (len + t.length + 1 + closers(next) > max) break;
    kept.push({ t: t, open: next.length > stack.length });
    len += t.length; stack = next;
  }
  // A tag opened right before the cut would only wrap the '…': drop it.
  while (kept.length && kept[kept.length - 1].open) { kept.pop(); stack = stack.slice(0, -1); }
  return kept.map(function (k) { return k.t; }).join('') + '…' + stack.slice().reverse().map(function (n) { return '</' + n + '>'; }).join('');
}

/** Lines are already-escaped HTML; returns an array of messages, each ≤ max chars, never splitting a line. */
function tgLines(lines, max) {
  max = max || LIMITS.TG_SPLIT_AT;
  var out = [], cur = '';
  (lines || []).forEach(function (l) {
    l = String(l);
    if (l.length > max) l = tgHtmlClip(l, max);   // A11: never inside a tag, an entity or a link
    if (cur && cur.length + 1 + l.length > max) { out.push(cur); cur = ''; }
    cur = cur ? cur + '\n' + l : l;
  });
  if (cur) out.push(cur);
  return out;
}

// Developed by: LightAISolutions
