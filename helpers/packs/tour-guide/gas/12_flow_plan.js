/**
 * Tour Guide pack — the /plan <destination> journey (WP-5a; plan §5.9, decisions 15–17, 22, 26; contract §1.4).
 * A core flow `plan` whose state always carries `trip` (the slug) and `stage`:
 *   intake   → research (scope intake) is out; paused until WP-5b resumes with event trip_facts
 *   confirm  → the facts with tf:<trip key>:<n>:y|e|n taps (✏️ captures the next text), then text questions for what is missing
 *              (dates first, the rest skippable; state.ask names the open question), then research (scope new) with the
 *              confirmed values
 *   research → paused until event shortlist
 *   choose   → one message per group with sl:<run>:<g><n>:w|l|s taps; fl buttons More options · More gems (scope more,
 *              decided, gems_only; three More rounds at most) · Done choosing; free text or /seed = owner seeds
 *   planning → plan request (picks, later, skip, deliverables) is out; paused until event plan_digest → the day list,
 *              the Later reasons and the 📄 · 🔁 · 🔖 buttons; the flow ends (the core sends the files from the reply)
 * Renderers for envelopes that arrive with no plan flow: tg_trip_facts, tg_shortlist, tg_plan_digest (pack prefixes only).
 * Taps go to WP-5b's Choices tab (tgChoiceSet); shortlist items resolve n → slug through tgShortlistItems.
 */
var TG_PLAN_TTL_MIN = 14 * 24 * 60;
var TG_PLAN_MORE_MAX = 3;          // More options + More gems rounds per /plan
var TG_PLAN_ITEMS_PER_MSG = 8;
var TG_PLAN_FACTS_PER_MSG = 10;
var TG_PLAN_MSG_MAX = 3700;        // room under LIMITS.TG_SPLIT_AT for one chunk of item lines
var TG_PLAN_SEEDS_MAX = 10;        // owner seeds per message
var TG_PLAN_SEED_CHARS = 80;
var TG_PLAN_INTAKE_RUN = 'intake'; // Choices run for the fact taps
var TG_PLAN_GROUPS = { activities: { title: 'Activities', key: 'a' }, food: { title: 'Food', key: 'f' } };
var TG_PLAN_FACT_LABEL = { dates: 'Dates', lodging: 'Staying', flight: 'Flight', booking: 'Booked', companions: 'With', other: 'Also' };
var TG_PLAN_ASK_ORDER = ['dates', 'lodging', 'flight', 'booking', 'companions', 'other'];
var TG_PLAN_ASK = {
  dates: '📅 What are the dates? Send them like <code>2027-05-12 to 2027-05-16</code>.',
  lodging: '🏨 Where are you staying? A name, area or address — or Skip.',
  flight: '✈️ Any flights I should plan around? Or Skip.',
  booking: '🎟 Anything already booked (tours, tickets, tables)? Or Skip.',
  companions: '👥 Who is travelling with you? Or Skip.',
  other: '📝 Anything else I should know? Or Skip.'
};
var TG_PLAN_TAP = { w: '✅ Want', l: '🔖 Later', s: '❌ Skip' };

/* ==================== renderers (pure) ==================== */

function tgPlanTripTitle(slug) {
  var t = tgTripGet(slug);
  return t ? tgCmdTitle(t) : tgEscape(slug);
}
/**
 * Split entries ({ html, row? }) into messages ≤ TG_PLAN_MSG_MAX chars and ≤ per entries each; head goes first on the
 * first message; each message carries the keyboard rows of its own entries; extraRows ride on the last one.
 */
function tgPlanChunk(head, entries, per, extraRows) {
  var msgs = [], cur = null;
  var flush = function () { if (cur) msgs.push(cur); cur = null; };
  entries.forEach(function (e) {
    if (cur && (cur.n >= per || cur.html.length + 1 + e.html.length > TG_PLAN_MSG_MAX)) flush();
    if (!cur) cur = { html: msgs.length || !head ? '' : head, rows: [], n: 0 };
    cur.html = cur.html ? cur.html + '\n' + e.html : e.html;
    if (e.row) cur.rows.push(e.row);
    cur.n++;
  });
  flush();
  if (!msgs.length && head) msgs.push({ html: head, rows: [] });
  if (extraRows && extraRows.length && msgs.length) msgs[msgs.length - 1].rows = msgs[msgs.length - 1].rows.concat(extraRows);
  return msgs.map(function (m) { return m.rows.length ? { html: m.html, keyboard: tgKeyboard(m.rows) } : { html: m.html }; });
}

/** trip_facts → messages: one line per fact with ✅ ✏️ ❌ (tf:<trip key>:<n>:y|e|n), then what is still missing. */
function tgPlanFactsMessages(p) {
  var tk = tgCmdTripKey(p.trip);
  var head = '🧾 <b>What I found for ' + tgPlanTripTitle(p.trip) + '</b>' + ((p.found || []).length ? ' — ✅ keep · ✏️ correct · ❌ drop' : '');
  var entries = (p.found || []).map(function (f) {
    var dates = f.start ? ' <i>(' + tgCmdDate(f.start) + (f.end && f.end !== f.start ? ' → ' + tgCmdDate(f.end) : '') + ')</i>' : '';
    return {
      html: '<b>' + tgEscape(f.n) + '.</b> ' + tgEscape(TG_PLAN_FACT_LABEL[f.kind] || f.kind) + ': ' + tgEscape(f.text) + dates,
      row: ['y', 'e', 'n'].map(function (v) { return { text: f.n + ' ' + { y: '✅', e: '✏️', n: '❌' }[v], data: cbEncode('tf', tk, f.n, v) }; })
    };
  });
  if (!entries.length) entries.push({ html: '<i>Nothing booked that I can see.</i>' });
  if ((p.missing || []).length) {
    entries.push({ html: 'Still missing: ' + p.missing.map(function (k) { return tgEscape(String(TG_PLAN_FACT_LABEL[k] || k).toLowerCase()); }).join(', ') });
  }
  return tgPlanChunk(head, entries, TG_PLAN_FACTS_PER_MSG);
}

function tgPlanFold(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
/** An item the owner seeded: the name matches a seed case-insensitively (equal, or one contains the other when ≥ 4 chars). */
function tgPlanIsSeed(item, seeds) {
  if ((item.labels || []).indexOf('owner_seed') >= 0) return true;
  var n = tgPlanFold(item.name);
  return (seeds || []).some(function (s) {
    s = tgPlanFold(s);
    return s && (s === n || (s.length >= 4 && (n.indexOf(s) >= 0 || s.indexOf(n) >= 0)));
  });
}
function tgPlanItemHtml(it, seeds) {
  var bits = [];
  if (it.est_minutes) bits.push('~' + tgCmdMinutes(it.est_minutes));
  if (it.area) bits.push(tgEscape(truncate(it.area, 60)));
  if (tgPlanIsSeed(it, seeds)) bits.push('<b>your pick</b>');
  if (it.seen_before) bits.push('seen ' + tgEscape(it.seen_before.on) + ' (' + tgEscape(it.seen_before.outcome) + ')');
  var labels = it.labels || [];
  if (labels.indexOf('conflicting') >= 0) bits.push('<i>conflicting sources</i>');
  else if (labels.indexOf('unverified') >= 0) bits.push('<i>unverified</i>');
  var out = '<b>' + tgEscape(it.n) + '.</b> ' + (it.gem ? '💎 ' : '') + '<b>' + tgCmdHref(it.maps_url, it.name) + '</b>' + (bits.length ? ' · ' + bits.join(' · ') : '');
  if (it.why_you) out += '\n   ' + tgEscape(it.why_you);
  if (it.gem && it.gem_line) out += '\n   💎 <i>' + tgEscape(it.gem_line) + '</i>';
  if ((it.changes || []).length) out += '\n   <i>Changed: ' + it.changes.slice(0, 3).map(tgEscape).join('; ') + '</i>';
  return out;
}
/** The sl key of an item: group letter + n (numbers are unique within a group). */
function tgPlanItemKey(group, n) { return (TG_PLAN_GROUPS[group] ? TG_PLAN_GROUPS[group].key : 'x') + n; }
function tgPlanRunKey(trip, runId) { return tgShortlistRunKey(trip, runId); }

/**
 * shortlist → messages, one or more per group: numbered lines (💎 + gem line, your pick, seen before) with
 * ✅ 🔖 ❌ (sl:<run>:<g><n>:w|l|s); a line when the 💎 floor was not met. opts = { seeds?: [names], adopt?: true } —
 * adopt adds "▶️ Continue choosing" (pl:sc:<trip key>:<run>:<more 1|0>) for a round that arrived with no plan flow.
 */
function tgPlanShortlistMessages(p, opts) {
  opts = opts || {};
  var run = tgPlanRunKey(p.trip, p.run_id), msgs = [];
  var groups = (p.groups || []).filter(function (g) { return (g.items || []).length; });
  groups.forEach(function (g, gi) {
    var title = TG_PLAN_GROUPS[g.id] ? TG_PLAN_GROUPS[g.id].title : g.id;
    var head = (gi === 0 ? '🗺 <b>' + tgPlanTripTitle(p.trip) + ' — round ' + tgEscape(p.round) + '</b> · ✅ want · 🔖 later · ❌ skip\n' : '') + '<b>' + tgEscape(title) + '</b>';
    var entries = g.items.map(function (it) {
      var k = tgPlanItemKey(g.id, it.n);
      return { html: tgPlanItemHtml(it, opts.seeds), row: ['w', 'l', 's'].map(function (v) { return { text: it.n + ' ' + TG_PLAN_TAP[v].split(' ')[0], data: cbEncode('sl', run, k, v) }; }) };
    });
    if (g.gems_wanted !== undefined && (g.gems_shown || 0) < g.gems_wanted) {
      entries.push({ html: '<i>💎 Only ' + (g.gems_shown || 0) + ' of the ' + g.gems_wanted + ' hidden gems I aim for met the bar this round.</i>' });
    }
    msgs = msgs.concat(tgPlanChunk(head, entries, TG_PLAN_ITEMS_PER_MSG));
  });
  if (!msgs.length) msgs.push({ html: '🗺 <b>' + tgPlanTripTitle(p.trip) + '</b> — nothing new this round.' });
  if (opts.adopt) {
    var more = p.more === true || (typeof p.more === 'number' && p.more > 0);
    var extra = { text: '▶️ Continue choosing', data: cbEncode('pl', 'sc', tgCmdTripKey(p.trip), run, more ? 1 : 0) };
    var last = msgs[msgs.length - 1];
    var rows = last.keyboard ? last.keyboard.inline_keyboard.map(function (r) { return r.map(function (b) { return { text: b.text, data: b.callback_data }; }); }) : [];
    rows.push([extra]);
    last.keyboard = tgKeyboard(rows);
  }
  return msgs;
}

/** plan_digest → the day list, the Later reasons and 📄 · 🔁 · 🔖 + day buttons. The files come with the core's reply. */
function tgPlanDigestMessages(p) {
  var tk = tgCmdTripKey(p.trip), days = p.days || [], later = p.later || [];
  var lines = ['🗓 <b>' + tgPlanTripTitle(p.trip) + '</b> — ' + days.length + ' day' + (days.length === 1 ? '' : 's') + (p.verified_on ? ' · checked on ' + tgEscape(p.verified_on) : '')];
  var warn = 0;
  days.forEach(function (d, i) {
    var k = (d.stops || []).length;
    warn += (d.warnings || []).length;
    lines.push('<b>' + (i + 1) + '.</b> ' + tgCmdDate(d.date) + (d.theme ? ' — ' + tgEscape(d.theme) : '') + ' <i>(' + k + ' stop' + (k === 1 ? '' : 's') + ')</i>');
  });
  if (warn) lines.push('⚠️ ' + warn + ' note' + (warn === 1 ? '' : 's') + ' on the days — tap a day to see them.');
  if (later.length) {
    lines.push('', '🔖 <b>Later</b>');
    later.slice(0, 12).forEach(function (l) { lines.push('• ' + tgEscape(l.name) + ' — <i>' + tgEscape(truncate(TG_CMD_LATER_REASONS[l.reason] || l.reason, 160)) + '</i>'); });
    if (later.length > 12) lines.push('<i>+ ' + (later.length - 12) + ' more — /later</i>');
  }
  var rows = tgCmdRows(days.map(function (d, i) { return { text: String(i + 1), data: cbEncode('dy', tk, i + 1) }; }), 7);
  var act = [{ text: '📄 Brochure', data: cbEncode('pl', 'br', tk) }];
  if (days.length) act.push({ text: '🔁 Replan a day', data: cbEncode('pl', 'rp', tk) });
  if (later.length) act.push({ text: '🔖 Later', data: cbEncode('pl', 'lt', tk) });
  rows.push(act);
  return tgCmdMessages(lines, tgKeyboard(rows));
}

/* ==================== the flow ==================== */

var TG_PLAN_FACTS_MAX = 40;
var TG_PLAN_FACT_CHARS = 300;
var TG_PLAN_ANSWER_CHARS = 300;
var TG_PLAN_SPAN_MAX_DAYS = 60;    // longest trip /plan accepts from a dates answer
var TG_PLAN_SEED_NAMES_MAX = 30;   // remembered seed names per /plan
var TG_PLAN_DECIDED_MAX = 200;     // the research schema's decided maxItems
var TG_PLAN_BOOKED_KINDS = ['flight', 'booking', 'companions', 'other'];

/** A fresh slug for /plan <destination>: the destination's slug, or -2, -3 … when that trip is already done. */
function tgPlanSlugFor(dest) {
  var base = tgSlug(dest) || ('trip-' + sha1Hex(String(dest)).slice(0, 8));
  base = base.slice(0, 56).replace(/-+$/, '');
  var slug = base, i = 2, t = tgTripGet(slug);
  while (t && t.status === 'done') { slug = base + '-' + i++; t = tgTripGet(slug); }
  return slug;
}
/** Dates from text: one or two YYYY-MM-DD → { start, end } (one date = a single day), or null. */
function tgPlanParseDates(text) {
  var m = String(text || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
  m = m.filter(function (d) {
    var p = d.split('-').map(Number), t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return t.getUTCFullYear() === p[0] && t.getUTCMonth() === p[1] - 1 && t.getUTCDate() === p[2];
  });
  if (!m.length || m.length > 2) return null;
  var start = m[0], end = m[1] || m[0];
  if (end < start) { var x = start; start = end; end = x; }
  if (tgCmdDaysBetween(start, end) + 1 > TG_PLAN_SPAN_MAX_DAYS) return null;
  return { start: start, end: end };
}
function tgPlanSeedsFrom(text) {
  return String(text || '').split(/[\n,;]+/).map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
    .filter(function (s) { return !!s && s.charAt(0) !== '/'; }).slice(0, TG_PLAN_SEEDS_MAX)
    .map(function (s) { return s.length > TG_PLAN_SEED_CHARS ? s.slice(0, TG_PLAN_SEED_CHARS).trim() : s; });
}
function tgPlanNewState(trip, dest) {
  return { trip: trip, dest: dest, stage: 'intake', facts: [], missing: [], asks: [], ask: null, edit: null, answers: {},
    runs: [], round: 0, more: false, more_rounds: 0, seed_names: [], seeds_pending: [] };
}
/** fact n → { value: y|e|n, text } from the taps (untapped = y). */
function tgPlanFactTaps(trip) {
  var out = {};
  tgChoiceList(trip, TG_PLAN_INTAKE_RUN, 'fact').forEach(function (c) { out[c.key] = { value: c.value, text: c.text }; });
  return out;
}
/** The confirmed facts: [{ n, kind, text, start?, end? }] with ✏️ corrections applied and ❌ dropped. */
function tgPlanConfirmed(state) {
  var taps = tgPlanFactTaps(state.trip), out = [];
  (state.facts || []).forEach(function (f) {
    var t = taps[String(f.n)] || { value: 'y' };
    if (t.value === 'n') return;
    var c = { n: f.n, kind: f.kind, text: f.text };
    if (f.start) { c.start = f.start; c.end = f.end || f.start; }
    if (t.value === 'e' && t.text) {
      c.text = truncate(t.text, TG_PLAN_FACT_CHARS);
      if (f.kind === 'dates') { var d = tgPlanParseDates(t.text); delete c.start; delete c.end; if (d) { c.start = d.start; c.end = d.end; } }
    }
    out.push(c);
  });
  return out;
}
/** Seeds, picks, later, skip and every slug shown, over all the flow's runs (a later tap wins). */
function tgPlanTaps(state) {
  var val = {}, shown = [], names = {};
  (state.runs || []).forEach(function (run) {
    tgShortlistItems(state.trip, run).forEach(function (it) { if (shown.indexOf(it.slug) < 0) shown.push(it.slug); names[it.slug] = it.name; });
    tgChoiceList(state.trip, run, 'shortlist').forEach(function (c) { val[c.key] = c.value; });
  });
  var out = { picks: [], later: [], skip: [], shown: shown, names: names };
  Object.keys(val).forEach(function (slug) {
    var v = val[slug];
    if (v === 'w') out.picks.push(slug); else if (v === 'l') out.later.push(slug); else if (v === 's') out.skip.push(slug);
  });
  return out;
}

/* ---------------- steps ---------------- */
function tgPlanWait(state, html) { return { prompt: html, pause: true, state: state }; }
function tgPlanConfirmStep(state, note) {
  var lines = [];
  if (note) lines.push(note);
  lines.push('Tap ✅ ✏️ ❌ on the lines above (untapped lines count as ✅), then <b>Continue</b>. Anything to add? Just type it.');
  return { prompt: lines.join('\n'), keyboard: [[{ text: '▶️ Continue', value: 'go' }]], expect: 'any', state: state };
}
function tgPlanEditStep(state, n) {
  var f = (state.facts || []).filter(function (x) { return String(x.n) === String(n); })[0];
  state.edit = String(n);
  return { prompt: '✏️ Send the corrected line for <b>' + tgEscape(n) + '</b>' + (f ? ' — now: <i>' + tgEscape(f.text) + '</i>' : '') + '.',
    keyboard: [[{ text: '↩️ Back', value: 'back' }]], expect: 'any', state: state };
}
function tgPlanAskStep(state, note) {
  if (!state.asks.length) return tgPlanResearchNew(state);
  state.stage = 'confirm';   // the questions are the second half of confirm; state.ask says which one is open
  state.ask = state.asks[0];
  var p = (note ? note + '\n' : '') + TG_PLAN_ASK[state.ask];
  if (state.ask === 'dates') return { prompt: p, expect: 'text', state: state };
  return { prompt: p, keyboard: [[{ text: '⏭ Skip', value: 'skip' }]], expect: 'any', state: state };
}
function tgPlanChooseStep(state, note) {
  state.stage = 'choose';
  var t = tgPlanTaps(state);
  var lines = [];
  if (note) lines.push(note);
  lines.push('So far: ' + t.picks.length + ' ✅ · ' + t.later.length + ' 🔖 · ' + t.skip.length + ' ❌. Tap on the lines above; type a place name to add your own pick.');
  var kb = [], canMore = !!state.more && state.more_rounds < TG_PLAN_MORE_MAX;
  if (canMore) kb.push([{ text: '➕ More options', value: 'more' }, { text: '💎 More gems', value: 'gems' }]);
  else if (state.seeds_pending.length) kb.push([{ text: '🔎 Look up my picks', value: 'seeds' }]);
  kb.push([{ text: '✅ Done choosing', value: 'done' }]);
  return { prompt: lines.join('\n'), keyboard: kb, expect: 'any', state: state };
}
/** Re-show where the flow is (/plan again, /seed with nothing new, an unknown event). */
function tgPlanSame(state, note) {
  if (state.stage === 'confirm' && state.ask) return tgPlanAskStep(state, note);
  if (state.stage === 'confirm') return state.edit ? tgPlanEditStep(state, state.edit) : tgPlanConfirmStep(state, note);
  if (state.stage === 'choose') return tgPlanChooseStep(state, note);
  var what = state.stage === 'planning' ? 'the plan' : state.stage === 'intake' ? 'what I already know' : 'the shortlist';
  return tgPlanWait(state, (note ? note + '\n' : '') + '⏳ Still working on ' + what + ' for <b>' + tgEscape(state.dest || state.trip) + '</b> — I will message you. /cancel stops it.');
}

/* ---------------- requests ---------------- */
function tgPlanResearchNew(state) {
  var conf = tgPlanConfirmed(state), a = state.answers || {}, trip = tgTripGet(state.trip) || {};
  var dates = conf.filter(function (f) { return f.kind === 'dates' && f.start; })[0] || null;
  var start = a.dates ? a.dates.start : dates ? dates.start : trip.start || '';
  var end = a.dates ? a.dates.end : dates ? dates.end : trip.end || '';
  var lodg = conf.filter(function (f) { return f.kind === 'lodging'; }).map(function (f) { return f.text; });
  if (a.lodging) lodg.push(a.lodging);
  var lodging = lodg.join('; ') || tgCmdLodgingText(trip) || '';
  var booked = [];
  conf.forEach(function (f) { if (TG_PLAN_BOOKED_KINDS.indexOf(f.kind) >= 0) booked.push(TG_PLAN_FACT_LABEL[f.kind] + ': ' + f.text); });
  TG_PLAN_BOOKED_KINDS.forEach(function (k) { if (a[k]) booked.push(TG_PLAN_FACT_LABEL[k] + ': ' + a[k]); });
  var patch = { slug: state.trip };
  if (start) { patch.start = start; patch.end = end || start; }
  if (lodg.length) patch.lodging = { text: truncate(lodg.join('; '), 500) };
  tgTripUpsert(patch);
  var payload = { trip: state.trip, scope: 'new', destination: state.dest };
  if (start) { payload.start_date = start; payload.end_date = end || start; }
  if (lodging) payload.lodging = truncate(lodging, 500);
  if (booked.length) payload.booked = booked.slice(0, 20).map(function (b) { return truncate(b, 300); });
  if (state.seeds_pending.length) payload.seeds = state.seeds_pending.slice();
  state.seeds_pending = [];
  tgOpenKindRequest('research', payload, { text: 'research new · ' + state.trip });
  state.stage = 'research'; state.ask = null; state.edit = null;
  var when = start ? ' for ' + tgCmdDate(start) + (end && end !== start ? ' → ' + tgCmdDate(end) : '') : '';
  return tgPlanWait(state, '🔎 Researching <b>' + tgEscape(state.dest) + '</b>' + when + ' — the shortlist follows.');
}
function tgPlanResearchMore(state, kind) {
  var t = tgPlanTaps(state);
  var payload = { trip: state.trip, scope: 'more', destination: state.dest, decided: t.shown.slice(-TG_PLAN_DECIDED_MAX) };
  if (kind === 'gems') payload.gems_only = true;
  if (state.seeds_pending.length) payload.seeds = state.seeds_pending.slice();
  if (kind !== 'seeds') state.more_rounds++;
  state.seeds_pending = [];
  tgOpenKindRequest('research', payload, { text: 'research more · ' + state.trip + (kind === 'gems' ? ' · gems' : '') });
  state.stage = 'research';
  return tgPlanWait(state, kind === 'gems' ? '💎 Looking for more hidden gems…' : kind === 'seeds' ? '🔎 Looking up your picks…' : '🔎 Looking for more options…');
}
function tgPlanBuild(state) {
  var t = tgPlanTaps(state);
  if (!t.picks.length) return tgPlanChooseStep(state, 'Tap ✅ on at least one place first.');
  tgOpenKindRequest('plan', { trip: state.trip, picks: t.picks, later: t.later, skip: t.skip, deliverables: ['plan', 'notes', 'brochure'] },
    { text: 'plan · ' + state.trip + ' (' + t.picks.length + ' picks)' });
  state.stage = 'planning';
  return tgPlanWait(state, '🧭 Building the days from ' + t.picks.length + ' pick' + (t.picks.length === 1 ? '' : 's') + (t.later.length ? ' (' + t.later.length + ' for Later)' : '') + '…');
}

/* ---------------- events ---------------- */
function tgPlanOnFacts(state, p, chatId) {
  state.facts = (p.found || []).slice(0, TG_PLAN_FACTS_MAX).map(function (f) {
    var o = { n: f.n, kind: f.kind, text: truncate(String(f.text || ''), TG_PLAN_FACT_CHARS) };
    if (f.start) { o.start = f.start; o.end = f.end || f.start; }
    return o;
  });
  state.missing = (p.missing || []).slice(0, TG_PLAN_ASK_ORDER.length);
  state.stage = 'confirm'; state.edit = null; state.ask = null; state.asks = []; state.answers = {};
  tgChoiceClear(state.trip, TG_PLAN_INTAKE_RUN, 'fact');
  tgCmdSendAll(chatId, tgPlanFactsMessages(p));
  return tgPlanConfirmStep(state);
}
function tgPlanOnShortlist(state, p, chatId) {
  var run = tgPlanRunKey(p.trip, p.run_id);
  if (state.runs.indexOf(run) < 0) state.runs.push(run);
  state.round = p.round;
  state.more = p.more === true || (typeof p.more === 'number' && p.more > 0);
  tgCmdSendAll(chatId, tgPlanShortlistMessages(p, { seeds: state.seed_names }));
  return tgPlanChooseStep(state);
}
/** After ✅ Continue: the questions for what is still unknown — dates first (required), then the missing kinds. */
function tgPlanAsks(state) {
  var conf = tgPlanConfirmed(state), trip = tgTripGet(state.trip) || {}, asks = [];
  var have = {};
  conf.forEach(function (f) { have[f.kind] = true; });
  var dated = conf.some(function (f) { return f.kind === 'dates' && f.start; }) || !!trip.start;
  if (!dated) asks.push('dates');
  TG_PLAN_ASK_ORDER.forEach(function (k) {
    if (k === 'dates' || have[k] || state.missing.indexOf(k) < 0) return;
    if (k === 'lodging' && tgCmdLodgingText(trip)) return;
    asks.push(k);
  });
  return asks;
}

registerFlow('plan', {
  ttl_min: TG_PLAN_TTL_MIN,
  /** seed = { destination } — or { adopt: { trip, run } } for a shortlist that arrived with no flow. */
  start: function (seed) {
    seed = seed || {};
    if (seed.adopt) {
      var t = tgTripGet(seed.adopt.trip) || { slug: seed.adopt.trip };
      var st = tgPlanNewState(t.slug, t.destination || t.title || t.slug);
      st.runs = [seed.adopt.run];
      st.more = !!seed.adopt.more;
      settingSet(TG_SETTINGS.CURRENT_TRIP, t.slug, 'trip being planned');
      return tgPlanChooseStep(st);
    }
    var dest = truncate(String(seed.destination || '').replace(/\s+/g, ' ').trim(), 80);
    var slug = tgPlanSlugFor(dest);
    var trip = tgTripGet(slug);
    if (!trip) tgTripUpsert({ slug: slug, title: dest, destination: dest, status: 'intake' });
    settingSet(TG_SETTINGS.CURRENT_TRIP, slug, 'trip being planned');
    var state = tgPlanNewState(slug, dest);
    tgOpenKindRequest('research', { trip: slug, scope: 'intake', destination: dest }, { text: 'research intake · ' + slug });
    return tgPlanWait(state, '🔎 Looking at what I already know about <b>' + tgEscape(dest) + '</b> — bookings, dates, where you stay…');
  },
  next: function (state, input, fctx) {
    var chatId = fctx.chatId;
    if (input.type === 'resume') {
      var p = input.payload || {};
      if (input.event === 'trip_facts') return tgPlanOnFacts(state, p, chatId);
      if (input.event === 'shortlist') return tgPlanOnShortlist(state, p, chatId);
      if (input.event === 'plan_digest') {
        tgCmdSendAll(chatId, tgPlanDigestMessages(p));
        return { prompt: '', done: true, state: state, result: { trip: state.trip, build_id: p.build_id } };
      }
      if (input.event === 'tf_edit' && state.stage === 'confirm' && !state.ask) return tgPlanEditStep(state, input.n);
      if (input.event === 'seed') return tgPlanAddSeeds(state, input.names || []);
      if (input.event === 'adopt' && input.run) {
        if (state.runs.indexOf(input.run) < 0) state.runs.push(input.run);
        state.more = !!input.more;
        return tgPlanChooseStep(state);
      }
      return tgPlanSame(state);
    }
    var v = input.type === 'button' ? String(input.value || '') : '';
    var text = input.type === 'text' ? String(input.text || '').trim() : '';
    if (state.stage === 'confirm' && !state.ask) {
      if (v === 'back') { state.edit = null; return tgPlanConfirmStep(state); }
      if (v === 'go') { state.edit = null; state.asks = tgPlanAsks(state); return tgPlanAskStep(state); }
      if (text && state.edit) {
        var n = state.edit;
        state.edit = null;
        tgChoiceSet(state.trip, TG_PLAN_INTAKE_RUN, 'fact', n, 'e', truncate(text, TG_PLAN_FACT_CHARS));
        return tgPlanConfirmStep(state, '✏️ Noted for ' + tgEscape(n) + ': <i>' + tgEscape(truncate(text, 200)) + '</i>');
      }
      if (text) {
        var nn = 'x' + ((state.facts || []).length + 1);
        state.facts.push({ n: nn, kind: 'other', text: truncate(text, TG_PLAN_FACT_CHARS) });
        return tgPlanConfirmStep(state, '📝 Added: <i>' + tgEscape(truncate(text, 200)) + '</i>');
      }
      return tgPlanSame(state);
    }
    if (state.stage === 'confirm') {   // answering the questions for what is missing
      var k = state.ask;
      if (v === 'skip' && k !== 'dates') { state.asks.shift(); return tgPlanAskStep(state); }
      if (text) {
        if (k === 'dates') {
          var d = tgPlanParseDates(text);
          if (!d) return tgPlanAskStep(state, 'I could not read those dates (one or two dates, at most ' + TG_PLAN_SPAN_MAX_DAYS + ' days).');
          state.answers.dates = d;
        } else state.answers[k] = truncate(text, TG_PLAN_ANSWER_CHARS);
        state.asks.shift();
        return tgPlanAskStep(state);
      }
      return tgPlanSame(state);
    }
    if (state.stage === 'choose') {
      if (v === 'done') return tgPlanBuild(state);
      if (v === 'more' || v === 'gems') {
        if (!state.more || state.more_rounds >= TG_PLAN_MORE_MAX) return tgPlanChooseStep(state, 'No more rounds for this plan.');
        return tgPlanResearchMore(state, v);
      }
      if (v === 'seeds' && state.seeds_pending.length) return tgPlanResearchMore(state, 'seeds');
      if (text) return tgPlanAddSeeds(state, tgPlanSeedsFrom(text));
      return tgPlanSame(state);
    }
    return tgPlanSame(state);
  }
});
/** Owner seeds: remembered for matching (your pick) and sent with the next research round. */
function tgPlanAddSeeds(state, names) {
  var added = [];
  (names || []).forEach(function (s) {
    s = String(s || '').trim();
    if (!s) return;
    var f = tgPlanFold(s);
    if (state.seed_names.some(function (x) { return tgPlanFold(x) === f; })) return;
    if (state.seed_names.length >= TG_PLAN_SEED_NAMES_MAX) return;
    state.seed_names.push(s); state.seeds_pending.push(s); added.push(s);
  });
  var note = added.length ? '📌 Noted: ' + added.map(tgEscape).join(', ') + ' — they go with the next round.' : 'Nothing new to add.';
  if (state.stage === 'choose') return tgPlanChooseStep(state, note);
  return tgPlanSame(state, note);
}

/* ==================== callbacks, commands, renderers ==================== */

/** The active plan flow of a chat, or null. */
function tgPlanActive(chatId) {
  var f = flowActive(chatId);
  return f && f.flow === 'plan' && isPlainObject(f.state) ? f : null;
}
/** The trip a shortlist run belongs to: the plan flow's runs, then the current trip, then any trip that has the run. */
function tgPlanRunTrip(chatId, run) {
  var f = tgPlanActive(chatId);
  if (f && (f.state.runs || []).indexOf(run) >= 0) return f.state.trip;
  var cur = tgTripCurrent();
  if (cur && tgShortlistItems(cur.slug, run).length) return cur.slug;
  var all = tgTripList();
  for (var i = all.length - 1; i >= 0; i--) if (tgShortlistItems(all[i].slug, run).length) return all[i].slug;
  return null;
}

// tf:<trip key>:<n>:y|e|n — a trip fact tap; it counts only inside the plan flow of that trip (✏️ asks for the line).
registerCallback('tf', function (ctx) {
  var trip = tgCmdTripByKey(ctx.parts[0]), n = String(ctx.parts[1] || ''), v = String(ctx.parts[2] || '');
  if (!n || ['y', 'e', 'n'].indexOf(v) < 0) { ctx.answer('Unknown button'); return; }
  var f = tgPlanActive(ctx.chatId);
  if (!trip || !f || f.state.trip !== trip.slug || f.state.stage !== 'confirm' || f.state.ask) {
    ctx.answer('Send /plan ' + truncate(trip ? (trip.destination || trip.title || trip.slug) : '<destination>', 60) + ' to confirm these.');
    return;
  }
  if (v === 'e') {
    ctx.answer('');
    flowResume(ctx.chatId, { type: 'resume', event: 'tf_edit', n: n });
    return;
  }
  tgChoiceSet(trip.slug, TG_PLAN_INTAKE_RUN, 'fact', n, v, '');
  ctx.answer(v === 'y' ? '✅ Kept' : '❌ Dropped');
  var taps = tgPlanFactTaps(trip.slug);
  tgCmdRemark(ctx, 'tf', function (p) { var t = taps[p[1]]; return !!t && t.value === p[2]; });
});

// sl:<run>:<g><n>:w|l|s — a shortlist tap, stored by place slug.
registerCallback('sl', function (ctx) {
  var run = String(ctx.parts[0] || ''), key = String(ctx.parts[1] || ''), v = String(ctx.parts[2] || '');
  var m = /^([a-z])(\d{1,3})$/.exec(key);
  if (!run || !m || !TG_PLAN_TAP[v]) { ctx.answer('Unknown button'); return; }
  var trip = tgPlanRunTrip(ctx.chatId, run);
  if (!trip) { ctx.answer('That shortlist is gone.'); return; }
  var items = tgShortlistItems(trip, run), bySlot = {};
  items.forEach(function (it) { bySlot[tgPlanItemKey(it.group, it.n)] = it; });
  var it = bySlot[key];
  if (!it) { ctx.answer('That place is gone from the list.'); return; }
  tgChoiceSet(trip, run, 'shortlist', it.slug, v, it.name);
  ctx.answer(TG_PLAN_TAP[v] + ' — ' + truncate(it.name, 60));
  var val = {};
  tgChoiceList(trip, run, 'shortlist').forEach(function (c) { val[c.key] = c.value; });
  tgCmdRemark(ctx, 'sl', function (p) { var x = p[0] === run && bySlot[p[1]]; return !!x && val[x.slug] === p[2]; });
});

// pl:sc:<trip key>:<run>:<more 1|0> — "Continue choosing" on a shortlist that arrived with no plan flow.
tgCmdPlAction('sc', function (ctx, args) {
  var trip = tgCmdTripByKey(args[0]), run = String(args[1] || ''), more = String(args[2] || '') === '1';
  if (!trip || !run || !tgShortlistItems(trip.slug, run).length) { ctx.answer('That shortlist is gone.'); return; }
  var f = flowActive(ctx.chatId);
  if (f && f.flow === 'plan' && isPlainObject(f.state) && f.state.trip === trip.slug) {
    ctx.answer('');
    flowResume(ctx.chatId, { type: 'resume', event: 'adopt', run: run, more: more });
    return;
  }
  if (f) { ctx.answer('Finish or /cancel /' + f.flow + ' first.', true); return; }
  ctx.answer('');
  flowStart(ctx.chatId, 'plan', { adopt: { trip: trip.slug, run: run, more: more } });
});

registerCommand('/plan', function (ctx) {
  var dest = String(ctx.args || '').replace(/\s+/g, ' ').trim();
  var f = flowActive(ctx.chatId);
  if (!dest) {
    if (f && f.flow === 'plan') return flowResume(ctx.chatId, { type: 'resume', event: 'reprompt' });
    ctx.reply('Send <code>/plan &lt;destination&gt;</code>, e.g. <code>/plan Lisbon</code>.');
    return null;
  }
  if (f && f.flow === 'plan' && isPlainObject(f.state) && tgPlanFold(f.state.dest) === tgPlanFold(dest)) {
    return flowResume(ctx.chatId, { type: 'resume', event: 'reprompt' });
  }
  if (f) {
    ctx.reply('You are in the middle of /' + tgEscape(f.flow) + (f.flow === 'plan' && f.state ? ' for <b>' + tgEscape(f.state.dest || f.state.trip) + '</b>' : '') + ' — finish it or send /cancel first.');
    return null;
  }
  return flowStart(ctx.chatId, 'plan', { destination: dest });
}, 'plan a trip: /plan <destination> (again to see where you are)');

registerCommand('/seed', function (ctx) {
  var names = tgPlanSeedsFrom(ctx.args);
  if (!tgPlanActive(ctx.chatId)) { ctx.reply('Seeds go with a /plan in progress — start one with <code>/plan &lt;destination&gt;</code>.'); return null; }
  if (!names.length) { ctx.reply('Send <code>/seed &lt;place&gt;, &lt;place&gt;</code> — places you already want in the plan.'); return null; }
  return flowResume(ctx.chatId, { type: 'resume', event: 'seed', names: names });
}, 'places you already want: /seed <name>, <name>');

// Envelopes that arrive with no plan flow (WP-5b hands them here).
registerRenderer('tg_trip_facts', function (p) {
  var msgs = tgPlanFactsMessages(p);
  var t = tgTripGet(p.trip);
  msgs.push({ html: 'Send <code>/plan ' + tgEscape(t && t.destination ? t.destination : p.trip) + '</code> to confirm these and carry on.' });
  return { messages: msgs };
});
registerRenderer('tg_shortlist', function (p) { return { messages: tgPlanShortlistMessages(p, { adopt: true }) }; });
registerRenderer('tg_plan_digest', function (p) { return { messages: tgPlanDigestMessages(p) }; });

// Developed by: LightAISolutions
