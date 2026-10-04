/**
 * Tour Guide — Quiet: the board's ranking (TG-PHASE-16 WP-16a, Contract C16). Pure; no clock, no network.
 *   quietRatio(count, magnetCount) → the candidate's rating count (0 when none) over the magnet's (a positive number, else it throws)
 *   quietPart(ratio)               → 100 at or below 0.05, 0 at or above MAX_RATIO, linear in log10 between, rounded
 *   quieterWord(ratio)             → 'much' up to 0.1, 'clearly' up to 0.25, else 'somewhat'
 *   isBusy(magnet, pool)           → Phase 11's crowd-magnet rule: gems' crowdMagnetIds over the magnet and the pool includes the magnet
 *   rankQuiet(candidates, { magnet, group, date, cityDates, diet, dietRule, visited }) → { items (≤ 3, numbered), more, left_out (≤ 12) }
 *   quietLine({ hours, always_open, tip }) → the magnet's quiet line, ≤ 160 characters
 *   pickRadius(counts)             → the search radius whose pool is big enough, or null
 * Only our own words, scores and ids go out: an item is rebuilt field by field from the record, the reach and the
 * judgment, so no Google field the record carries in-run (rating, count, hours, location) reaches the payload.
 */
import { normalizeScoutRecord, screenFlags, qualityPart, muFor, reachValue, vegOf } from '../scout/scout-rank.mjs';
import { LOCAL_PER_MENTION, FIT_DEFAULT } from '../scout/scout-weights.mjs';
import { crowdMagnetIds } from '../gems/gems-screen.mjs';
import { mentionCount, slugFor } from '../gems/gems-record.mjs';
import { MASS_TOURISM_TOP_N, LOCAL_FAVOURITE_MIN_PUBLISHERS } from '../gems/gems-weights.mjs';
import { crowdWindows } from '../planner/planner-crowd.mjs';
import { normName } from '../daytrip/daytrip-rank.mjs';
import { placeUrl } from '../../../kits/maps/lib/maps-urls.mjs';

/** Every number the board uses, each with why. */
export const QUIET = Object.freeze({
  MAX_MINUTES: 30,        // an alternative is a swap, not a detour: half an hour from the magnet, by foot or transit, at most
  MAX_RATIO: 0.5,         // at least twice as quiet as the magnet (by rating count), or it is not an escape worth offering
  FULL_RATIO: 0.05,       // a twentieth of the magnet's count or less counts as fully quiet (quietPart 100)
  MUCH_RATIO: 0.1,        // a tenth or less reads "much quieter"
  CLEARLY_RATIO: 0.25,    // a quarter or less reads "clearly quieter"; up to MAX_RATIO "somewhat"
  RADII: Object.freeze([1000, 2000, 3500]),   // metres searched around the magnet, nearest first: walkable, then a short ride
  MIN_POOL: 6,            // places found before a radius is big enough: enough to fill 3 items after the screens
  ITEMS: 3,               // the board's length: a choice the owner can make standing outside the magnet
  MORE_MAX: 20,           // `more` counts the rest, up to the schema's bound
  LEFT_MAX: 12,           // what was left out, first 12 in candidate order (the app shows it)
  LABELS_MAX: 6,
  WEIGHTS: Object.freeze({
    quiet: 0.35,          // the point of the board: how much quieter it is
    quality: 0.20,        // still worth going: the Bayesian rating (Scout's qualityPart)
    fit: 0.20,            // the party's tastes, from the judgment
    local: 0.10,          // locals name it (Scout's LOCAL_PER_MENTION per publisher)
    reach: 0.15           // the nearer the better (Scout's reachValue)
  })
});
export const LABELS = Object.freeze(['local_favourite', 'veg_verified', 'veg_likely', 'booking', 'rain_ok', 'seen_before']);
export const REASONS = Object.freeze(['the_magnet', 'duplicate', 'not_same_kind', 'closed', 'closed_on_dates', 'low_rating', 'unproven', 'diet', 'also_busy', 'not_quieter', 'too_far', 'other']);
export const QUIETER = Object.freeze(['much', 'clearly', 'somewhat']);
export const MODES = Object.freeze(['WALK', 'TRANSIT']);
/** Scout's screenFlags words → our left-out reasons, in the order they apply (too_far is ours: reach is passed as null). */
const FLAG_REASON = Object.freeze({ closed: 'closed', closed_on_trip: 'closed_on_dates', low_rating: 'low_rating', unproven: 'unproven', diet: 'diet', diet_unproven: 'diet' });

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (s, max) => { const t = String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;

/** quietRatio(count, magnetCount) — see the header. */
export function quietRatio(count, magnetCount) {
  if (!(typeof magnetCount === 'number' && Number.isFinite(magnetCount) && magnetCount > 0)) {
    throw new Error(`quiet: the magnet's rating count must be a positive number (got ${JSON.stringify(magnetCount)})`);
  }
  const c = typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : 0;
  return c / magnetCount;
}

/** quietPart(ratio) — 0.1 → 70, 0.25 → 30. */
export function quietPart(ratio) {
  if (!(typeof ratio === 'number' && Number.isFinite(ratio) && ratio >= 0)) throw new Error(`quiet: ratio must be a number ≥ 0 (got ${JSON.stringify(ratio)})`);
  if (ratio <= QUIET.FULL_RATIO) return 100;
  if (ratio >= QUIET.MAX_RATIO) return 0;
  return Math.round((100 * Math.log10(QUIET.MAX_RATIO / ratio)) / Math.log10(QUIET.MAX_RATIO / QUIET.FULL_RATIO));
}

/** quieterWord(ratio) — see the header. */
export function quieterWord(ratio) {
  if (ratio <= QUIET.MUCH_RATIO) return 'much';
  if (ratio <= QUIET.CLEARLY_RATIO) return 'clearly';
  return 'somewhat';
}

/** isBusy(magnet, pool) — the magnet and the pool are records with place ids (the magnet counted once). */
export function isBusy(magnet, pool) {
  if (!isObj(magnet) || !magnet.place_id) return false;
  const others = (Array.isArray(pool) ? pool : []).filter((r) => isObj(r) && r.place_id && r.place_id !== magnet.place_id);
  return crowdMagnetIds([magnet, ...others]).has(magnet.place_id);
}

/** The left-out reason of one candidate, or null when it passes every screen. */
function screenOf(record, c, ctx) {
  const j = isObj(c.judgment) ? c.judgment : {};
  if (record.place_id === ctx.magnetId || j.part_of_magnet === true) return 'the_magnet';
  const nm = normName(record.name);
  if (ctx.ids.has(record.place_id) || (nm && ctx.names.has(nm))) return 'duplicate';
  ctx.ids.add(record.place_id); if (nm) ctx.names.add(nm);
  if (j.same_kind !== true) return 'not_same_kind';
  const flags = screenFlags(record, { reach: null, judgment: j, group: ctx.group, diet: ctx.diet, diet_rule: ctx.dietRule, what: ctx.kind,
    trip_dates: [], city_dates: ctx.dates });
  const flag = flags.find((f) => FLAG_REASON[f]);
  if (flag) return FLAG_REASON[flag];
  if (record.mass_tourism_rank != null && record.mass_tourism_rank <= MASS_TOURISM_TOP_N) return 'also_busy';
  if (quietRatio(record.rating_count, ctx.magnetCount) > QUIET.MAX_RATIO) return 'not_quieter';
  const r = c.reach;
  if (!isObj(r) || !Number.isFinite(r.minutes) || r.minutes < 0 || r.minutes > QUIET.MAX_MINUTES) return 'too_far';
  return null;
}

function labelsOf(record, j, slug, ctx) {
  const on = new Set();
  if (mentionCount(record) >= LOCAL_FAVOURITE_MIN_PUBLISHERS) on.add('local_favourite');
  if (ctx.group === 'food') {
    const veg = vegOf(j);
    if (veg === 'verified') on.add('veg_verified');
    else if (veg === 'likely') on.add('veg_likely');
  }
  if (j.booking === true) on.add('booking');
  if (j.rain_ok === true) on.add('rain_ok');
  if (ctx.visited.has(slug)) on.add('seen_before');
  return LABELS.filter((l) => on.has(l)).slice(0, QUIET.LABELS_MAX);
}

function itemOf(record, c, ctx) {
  const j = isObj(c.judgment) ? c.judgment : {};
  const W = QUIET.WEIGHTS;
  const ratio = quietRatio(record.rating_count, ctx.magnetCount);
  const minutes = c.reach.minutes;
  const fit = Number.isFinite(j.fit) ? clamp(j.fit, 0, 1) : FIT_DEFAULT;
  const quality = qualityPart(record, muFor(ctx.group)), local = Math.min(1, mentionCount(record) * LOCAL_PER_MENTION), reach = reachValue(minutes);
  const quiet = quietPart(ratio);
  const score = clamp(Math.round(W.quiet * quiet + W.quality * quality * 100 + W.fit * fit * 100 + W.local * local * 100 + W.reach * reach * 100), 0, 100);
  const slug = slugFor(record);
  const name = text(record.name, 120);
  const it = { slug, name };
  if (PLACE_ID_RE.test(record.place_id)) it.place_id = record.place_id;
  it.kind = text(typeof j.kind === 'string' && j.kind.trim() ? j.kind : ctx.kind, 40);
  it.reach = { minutes: clamp(Math.round(minutes), 0, 180), mode: c.reach.mode === 'WALK' ? 'WALK' : 'TRANSIT', estimated: c.reach.estimated === true };
  it.quieter = quieterWord(ratio);
  it.why = text(j.why, 200) || text(`${it.quieter[0].toUpperCase() + it.quieter.slice(1)} quieter than ${ctx.magnetName}`, 200);
  const best = text(j.best, 120);
  if (best) it.best = best;
  it.score = score;
  it.parts = { quiet, quality: Math.round(quality * 100), fit: Math.round(fit * 100), local: Math.round(local * 100), reach: Math.round(reach * 100) };
  it.labels = labelsOf(record, j, slug, ctx);
  it.maps_url = placeUrl({ name: record.name, placeId: record.place_id });
  return { it, ratio, minutes };
}

/**
 * rankQuiet(candidates, { magnet: { record, kind }, group, date, cityDates, diet, dietRule, visited }) → { items, more, left_out }.
 * A candidate is { record, reach, judgment }: `record` Scout's normalizeScoutRecord of a place (with its local mentions and
 * mass-tourism rank), `reach` estimateReach's answer from the magnet or null, `judgment` { same_kind, part_of_magnet?, fit
 * 0–1, why, best?, veg?, relevance?, booking?, rain_ok?, kind? }. Screens, in order: the_magnet · duplicate · not_same_kind ·
 * Scout's screenFlags (closed, closed_on_dates, low_rating, unproven, diet) · also_busy · not_quieter · too_far.
 */
export function rankQuiet(candidates, { magnet, group = 'activities', date = null, cityDates, diet = null, dietRule = null, visited = [] } = {}) {
  const m = isObj(magnet) && isObj(magnet.record) ? magnet.record : magnet;
  if (!isObj(m)) throw new Error('quiet: rankQuiet needs the magnet ({ record, kind })');
  const magnetCount = m.rating_count;
  quietRatio(0, magnetCount);   // throws early when the magnet has no positive count
  const kind = text(isObj(magnet) && magnet.kind ? magnet.kind : '', 40);
  if (!kind) throw new Error('quiet: rankQuiet needs the magnet\'s kind (our word for what it is)');
  const ctx = {
    magnetId: m.place_id, magnetName: text(m.name, 120), magnetCount, kind, group, diet, dietRule,
    dates: date ? [date] : (Array.isArray(cityDates) ? cityDates : undefined),
    visited: new Set(Array.isArray(visited) ? visited : []), ids: new Set(), names: new Set([normName(m.name)].filter(Boolean))
  };
  const left = [], pass = [];
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (!isObj(c) || !isObj(c.record)) continue;
    const record = normalizeScoutRecord(c.record);
    const why = screenOf(record, c, ctx);
    if (why) { left.push({ name: text(record.name, 120) || 'unnamed', reason: why }); continue; }
    pass.push(itemOf(record, c, ctx));
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  pass.sort((a, b) => b.it.score - a.it.score || a.ratio - b.ratio || a.minutes - b.minutes || cmp(a.it.name.toLowerCase(), b.it.name.toLowerCase()) || cmp(a.it.slug, b.it.slug));
  const items = pass.slice(0, QUIET.ITEMS).map((x, i) => ({ n: i + 1, ...x.it }));
  return { items, more: Math.min(QUIET.MORE_MAX, Math.max(0, pass.length - QUIET.ITEMS)), left_out: left.slice(0, QUIET.LEFT_MAX) };
}

const toMin = (s) => { const x = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(s ?? '').trim()); return x ? +x[1] * 60 + +x[2] : null; };
const hm = (n) => { const d = ((n % 1440) + 1440) % 1440; return String(Math.floor(d / 60)).padStart(2, '0') + ':' + String(d % 60).padStart(2, '0'); };

/**
 * quietLine({ hours: { open, close, last_entry? } ("HH:MM", from the magnet's own site), always_open, tip }) → by the first
 * rule that applies: the planner's crowdWindows as "Quietest at opening (09:00–10:00) or late (from 15:30; last entry
 * 16:30)" (the opening part alone when no late slot fits), then "; <tip>" when there is one · the tip · "Open all day;
 * early morning is usually quietest" when always open · "No quiet hours found; early is usually quieter". ≤ 160 characters.
 */
export function quietLine({ hours = null, always_open = false, tip = '' } = {}) {
  const t = text(tip, 160);
  const open = isObj(hours) ? toMin(hours.open) : null;
  let close = isObj(hours) ? toMin(hours.close) : null;
  if (open !== null && close !== null) {
    if (close <= open) close += 1440;   // closes after midnight
    let last = toMin(hours.last_entry);
    if (last !== null && last < open) last += 1440;
    const win = { open, close, ...(last !== null && last <= close ? { last } : {}) };
    const slots = crowdWindows([win]);
    const op = slots.find((s) => s.slot === 'opening'), late = slots.find((s) => s.slot === 'late');
    let line = `Quietest at opening (${hm(op.open)}–${hm(op.last)})`;
    if (late) line += ` or late (from ${hm(late.open)}${win.last !== undefined ? '; last entry ' + hm(win.last) : ''})`;
    return text(t ? line + '; ' + t : line, 160);
  }
  if (t) return t;
  if (always_open === true) return 'Open all day; early morning is usually quietest';
  return 'No quiet hours found; early is usually quieter';
}

/** pickRadius([{ radius, count }]) → the smallest radius with a count ≥ MIN_POOL, else the largest with a count ≥ 1, else null. */
export function pickRadius(counts) {
  const ok = (Array.isArray(counts) ? counts : []).filter((x) => isObj(x) && Number.isFinite(x.radius) && x.radius > 0 && Number.isFinite(x.count))
    .sort((a, b) => a.radius - b.radius);
  const full = ok.find((x) => x.count >= QUIET.MIN_POOL);
  if (full) return full.radius;
  const some = ok.filter((x) => x.count >= 1);
  return some.length ? some[some.length - 1].radius : null;
}

// Developed by: LightAISolutions
