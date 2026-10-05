/**
 * Tour Guide brochure-map — Contract C18 wave 1 (Phase 18, WP-18b): the day as instructions, computed from data the
 * pack already has. toBrochureModel calls addC18() on each mapped day only with `options.c18: true` (these fields come
 * from existing data, so without the gate every old brochure would change); `options.clock` / `options.temp` become
 * `trip.clock` / `trip.temp` only when given (tripDisplay()).
 *   · fixed: true — a stop with `booked`; a meal whose trip.bookings record for that date (or undated on the place's
 *     first planned day, as for the booking line) is `booked`; the day's real start and end (they carry the override's
 *     own time: an arrival, a departure).
 *   · tip (≤ 160) on stops and meals at a place: the place facts' payment, then its gate ("Enter by <gate>"); a meal at
 *     one of the day's stops leaves it to the stop.
 *   · checklist { must ≤ 6, carry ≤ 8, constraints ≤ 6 }: must = the fixed items in time order ("10:00 Timed entry —
 *     Slate Museum"); carry = the day's booked tickets (trip.bookings, not meals or lodging) with how to show them, a
 *     booked stop's reference, "Cash" when a stop or meal place takes cash and no cards, "Transit card, topped up" on a
 *     day with a transit leg, the bag step on a moving day; constraints = the travellers' diet (options.diet), last
 *     entries and the stops' check-on-the-day lines. Empty groups are left out, and the checklist with them.
 *   · prep { night_before ≤ 6, steps ≤ 6 } — only when the day's first leg leaves the lodging or a breakfast is planned:
 *     wake at the earlier of leave − PREP.READY_MIN and breakfast − PREP.BREAKFAST_LEAD, breakfast, leave, the first
 *     fixed thing (steps in time order); the night before: the alarm, the tickets to have ready, packing on a moving day.
 *   · departure — a day that ends at a real departure: to, at (the departure), by (the planned leg's departure),
 *     scenario "As planned" (leave, the leg, arrive, spare) and "Latest safe" (leave by at − leg − DEPART.SAFE_SPARE,
 *     spare DEPART.SAFE_SPARE) when it differs from the plan by at least DEPART.MIN_GAP minutes; fallbacks from the
 *     day override's `fallbacks`.
 *   · free[].title and free[].options from the planner (planner-free.mjs): a place keeps its card key, else a Maps link;
 *     an option scheduled anywhere in the plan is dropped (a journey mix can schedule it on another day).
 * Times inside texts follow the clock: options.clock '24h' (HH:MM), '12h' (9:30 am), else the trip locale's clock.
 *   addC18(day, dp, ctx) — mutates the mapped brochure day `day` built from DayPlan `dp`
 *   tripDisplay(options) → { clock?, temp? }
 */
import { placeUrl } from '../../../kits/maps/lib/maps-urls.mjs';
import { clockText } from '../../../kits/brochure/lib/format.mjs';
import { clip, compact } from './brochure-map-text.mjs';
import { dietText } from './brochure-map-facts.mjs';
import { bookingFor } from '../planner/planner-dinner.mjs';

export const PREP = Object.freeze({ READY_MIN: 75, BREAKFAST_LEAD: 45, NEXT_WITHIN: 180 });
export const DEPART = Object.freeze({ SAFE_SPARE: 15, MIN_GAP: 10 });
export const C18_CAPS = Object.freeze({ must: 6, carry: 8, constraints: 6, night_before: 6, steps: 6, scenarios: 2, scenario_steps: 5, fallbacks: 4, options: 4, title: 60, line: 160 });
export const CLOCKS = Object.freeze(['12h', '24h']);
export const TEMPS = Object.freeze(['c', 'f', 'both']);
export const TICKET_KINDS = Object.freeze(['sight', 'experience', 'train', 'other']);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_IN = /\b([01]\d|2[0-3]):[0-5]\d\b/g;
const tmin = (t) => (typeof t === 'string' && TIME.test(t) ? +t.slice(0, 2) * 60 + +t.slice(3) : null);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const line = (s) => clip(s, C18_CAPS.line);

/** tripDisplay(options) → the trip's `clock` and `temp` when the options give valid ones. */
export function tripDisplay(options = {}) {
  return compact({ clock: CLOCKS.includes(options.clock) ? options.clock : undefined, temp: TEMPS.includes(options.temp) ? options.temp : undefined });
}
/** A clock formatter for texts: '24h' → 09:30, '12h' → 9:30 am, else the locale's clock. */
export function clockFor(clock, locale) {
  const loc = clock === '24h' ? 'en-GB' : clock === '12h' ? 'en-US' : locale || 'en-US';
  const one = (t) => clockText(t, loc);
  return { one, all: (s) => (typeof s === 'string' ? s.replace(TIME_IN, (t) => one(t)) : s) };
}

/** The tip under a stop's or meal's row: payment, then the gate (≤ 160), from the place's facts. */
export function tipOf(facts) {
  if (!facts || typeof facts !== 'object') return undefined;
  const pay = clip(facts.payment, 80);
  const gate = clip(facts.gate_name, 80);
  const g = gate ? (/^(enter|use|go)\b/i.test(gate) ? gate : `Enter by ${gate}`) : undefined;
  return line([pay, g].filter(Boolean).join(' · ') || undefined);
}
/** true when the place's payment line says cash and no cards ("Cash only", "Cash at most stalls"). */
export const takesCashOnly = (facts) => !!(facts && typeof facts.payment === 'string' && /\bcash\b/i.test(facts.payment) && !/\bcards?\b|\bcontactless\b/i.test(facts.payment));

const LABEL = Object.freeze({ sight: 'Timed entry', experience: 'Session', train: 'Train', other: 'Booked', meal: 'Table booked' });
/** A leg as a few words: "Tram 5, 20 min", "Walk 20 min", "Drive 20 min". */
function legWords(l) {
  const m = Number.isFinite(l.minutes) ? `${Math.round(l.minutes)} min` : '';
  const mode = String(l.mode || '').toUpperCase();
  if (mode === 'TRANSIT') return l.line ? `${clip(l.line, 60)}, ${m}` : `Transit, ${m}`;
  if (mode === 'WALK') return `Walk ${m}`;
  if (mode === 'DRIVE') return `Drive ${m}`;
  if (mode === 'BICYCLE') return `Cycle ${m}`;
  return m;
}

/**
 * addC18(day, dp, ctx) — the C18 fields on a mapped brochure day (see the file header). ctx: { placesBySlug, cards,
 * lodgingName, override, bookings, firstDay, diet, locale, clock, scheduled }.
 */
export function addC18(day, dp, ctx) {
  const { placesBySlug, cards, lodgingName, override, bookings, firstDay, diet, scheduled } = ctx;
  const ck = clockFor(ctx.clock, ctx.locale);
  const ov = override || {};
  const nameOf = (slug, from) => (slug === 'lodging' ? lodgingName(from ? dp.lodging_start : dp.lodging_end) : slug === 'day-start' ? day.start && day.start.name : slug === 'day-end' ? day.end && day.end.name : slug === 'here' ? 'where you are' : (cards[slug] && cards[slug].name) || (placesBySlug.get(slug) || {}).name || slug);
  const factsOf = (slug) => { const p = slug && placesBySlug.get(slug); return p && p.facts && typeof p.facts === 'object' ? p.facts : null; };
  const fixed = [];   // { t, time, what }
  const fix = (time, what) => fixed.push({ t: tmin(time), time, what });

  // fixed and tip
  if (day.start && ov.start) { day.start.fixed = true; fix(day.start.time, `Arrive at ${day.start.name}`); }
  day.stops.forEach((s, i) => {
    const src = dp.stops[i] || {};
    const tip = tipOf(factsOf(s.place));
    if (tip) s.tip = tip;
    if (!s.booked) return;
    s.fixed = true;
    const rec = bookingFor(bookings, s.place, dp.date, firstDay);
    fix(s.arrive, `${LABEL[rec && rec.kind] || LABEL.sight} — ${nameOf(src.place || s.place)}`);
  });
  const stopSlugs = new Set(dp.stops.map((s) => s.place));
  (day.meals || []).forEach((m, i) => {
    const at = (dp.meals[i] || {}).at;
    if (!at || at === 'lodging') return;
    const tip = stopSlugs.has(at) ? undefined : tipOf(factsOf(at));   // a meal at one of the day's stops: the stop has it
    if (tip) m.tip = tip;
    const rec = bookingFor(bookings, at, dp.date, firstDay);
    if (!rec || rec.status !== 'booked') return;
    m.fixed = true;
    fix(m.start, `${LABEL.meal} — ${nameOf(at)}`);
  });
  if (day.end && ov.end) { day.end.fixed = true; fix(day.end.time, `Departure — ${day.end.name}`); }
  fixed.sort((a, b) => a.t - b.t);

  const tickets = ticketsOf(bookings, dp.date, firstDay);
  const checklist = checklistOf({ day, dp, fixed, tickets, ctx, factsOf, nameOf, ck });
  if (checklist) day.checklist = checklist;
  const prep = prepOf({ day, dp, fixed, tickets, nameOf, ck, lodgingName });
  if (prep) day.prep = prep;
  const departure = departureOf({ day, dp, ov, nameOf, ck });
  if (departure) day.departure = departure;
  freeOf(day, dp, { cards, placesBySlug, scheduled, ck });
}

/** The day's booked tickets (trip.bookings): booked, a ticket kind, for this date or undated on the place's first day. */
function ticketsOf(bookings, date, firstDay) {
  return (Array.isArray(bookings) ? bookings : []).filter((b) => b && b.status === 'booked' && TICKET_KINDS.includes(b.kind) && (b.for_date === date || (!b.for_date && b.place && firstDay && firstDay.get(b.place) === date)));
}

function checklistOf({ day, dp, fixed, tickets, ctx, factsOf, nameOf, ck }) {
  const must = fixed.map((f) => line(`${ck.one(f.time)} ${f.what}`)).slice(0, C18_CAPS.must);
  const carry = tickets.map((b) => line(b.how ? `${b.title} — ${b.how}` : b.title));
  const ticketed = new Set(tickets.map((b) => b.place).filter(Boolean));
  for (const s of day.stops) {
    const p = ctx.placesBySlug.get(s.place), ref = p && p.booking && p.booking.date === dp.date && p.booking.ref;
    if (s.booked && ref && !ticketed.has(s.place)) carry.push(line(`${nameOf(s.place)} booking ref ${ref}`));
  }
  const atPlaces = [...dp.stops.map((s) => s.place), ...(dp.meals || []).map((m) => m.at).filter((a) => a && a !== 'lodging')];
  if (atPlaces.some((slug) => takesCashOnly(factsOf(slug)))) carry.push('Cash');
  if ((dp.legs || []).some((l) => String(l.mode).toUpperCase() === 'TRANSIT')) carry.push('Transit card, topped up');
  if (day.bags && day.bags.text) carry.push(line(ck.all(day.bags.text)));
  else if (dp.lodging_start !== dp.lodging_end) carry.push(line(`Your bags: from ${ctx.lodgingName(dp.lodging_start) || 'the last lodging'} to ${ctx.lodgingName(dp.lodging_end) || 'tonight’s lodging'}`));
  const constraints = [];
  const diet = dietText(ctx.diet);
  if (diet) constraints.push(line(`Diet: ${diet}`));
  for (const s of day.stops) if (s.last_entry) constraints.push(line(`Last entry ${ck.one(s.last_entry)} at ${nameOf(s.place)}`));
  for (const s of day.stops) if (s.check_on_day) constraints.push(line(`${nameOf(s.place)}: ${ck.all(s.check_on_day)}`));
  const out = compact({ must, carry: carry.filter(Boolean).slice(0, C18_CAPS.carry), constraints: constraints.slice(0, C18_CAPS.constraints) });
  return Object.keys(out).length ? out : undefined;
}

function prepOf({ day, dp, fixed, tickets, nameOf, ck, lodgingName }) {
  const first = (dp.legs || [])[0];
  const leaves = first && first.from === 'lodging' && TIME.test(String(first.depart_at || ''));
  const bk = (dp.meals || []).find((m) => m.kind === 'breakfast' && TIME.test(String(m.start || '')));
  if (!leaves && !bk) return undefined;
  const leave = leaves ? tmin(first.depart_at) : null, bt = bk ? tmin(bk.start) : null;
  const wakes = [leave !== null ? leave - PREP.READY_MIN : null, bt !== null ? bt - PREP.BREAKFAST_LEAD : null].filter((x) => x !== null);
  const wake = Math.min(...wakes);
  const home = lodgingName(dp.lodging_start);
  const steps = [];
  if (wake >= 0) steps.push({ t: wake, text: 'Wake up' });
  if (bt !== null) steps.push({ t: bt, text: line(home ? `Breakfast at ${home}` : 'Breakfast') });
  if (leave !== null) steps.push({ t: leave, text: line(`Leave ${home || 'your lodging'} for ${nameOf(first.to)} (${legWords(first)})`) });
  const from = leave !== null ? leave : bt;
  const next = fixed.find((f) => f.t >= from && f.t - from <= PREP.NEXT_WITHIN);  // the morning's first fixed thing, not the evening's
  if (next) steps.push({ t: next.t, text: line(next.what) });
  steps.sort((a, b) => a.t - b.t);
  const night = [];
  if (wake >= 0) night.push(line(`Set an alarm for ${ck.one(hhmm(wake))}`));
  if (tickets.length) night.push(line(`Have ready: ${tickets.map((b) => b.title).join(', ')}`));
  if (dp.bags || dp.lodging_start !== dp.lodging_end) night.push(line(day.bags && day.bags.text ? `Pack tonight — ${ck.all(day.bags.text)}` : 'Pack tonight: you change lodging'));
  return compact({ night_before: night.slice(0, C18_CAPS.night_before), steps: steps.slice(0, C18_CAPS.steps).map((s) => ({ time: hhmm(s.t), text: s.text })) });
}

function departureOf({ day, dp, ov, nameOf, ck }) {
  if (!day.end || !ov.end) return undefined;
  const leg = (dp.legs || []).filter((l) => l.to === 'day-end' && TIME.test(String(l.depart_at || '')) && TIME.test(String(l.arrive_at || ''))).pop();
  if (!leg) return undefined;
  const at = tmin(day.end.time), dep = tmin(leg.depart_at), arr = tmin(leg.arrive_at);
  const mins = Number.isFinite(leg.minutes) ? Math.round(leg.minutes) : arr - dep;
  const from = nameOf(leg.from, true), to = day.end.name;
  const spare = (n) => Math.max(0, Math.min(240, n));
  const scenarios = [{ label: 'As planned', steps: [line(`Leave ${from} at ${ck.one(leg.depart_at)}`), line(legWords(leg)), line(`Arrive at ${to} ${ck.one(leg.arrive_at)}`)], spare_min: spare(at - arr) }];
  const latest = at - mins - DEPART.SAFE_SPARE;
  if (latest >= 0 && Math.abs(latest - dep) >= DEPART.MIN_GAP) {
    scenarios.push({ label: 'Latest safe', steps: [line(`Leave ${from} by ${ck.one(hhmm(latest))}`), line(legWords(leg)), line(`Arrive at ${to} ${ck.one(hhmm(latest + mins))}`)], spare_min: DEPART.SAFE_SPARE });
  }
  const fallbacks = (Array.isArray(ov.fallbacks) ? ov.fallbacks : []).map((f) => line(ck.all(String(f)))).filter(Boolean).slice(0, C18_CAPS.fallbacks);
  return compact({
    to, at: day.end.time, by: hhmm(Math.min(dep, at)), scenarios: scenarios.slice(0, C18_CAPS.scenarios), fallbacks,
    note: leg.estimated ? 'The travel time is an estimate; check the Maps link before you go' : undefined
  });
}

function freeOf(day, dp, { cards, placesBySlug, scheduled, ck }) {
  (day.free || []).forEach((f, i) => {
    const src = dp.free[i] || {};
    const title = clip(ck.all(src.title), C18_CAPS.title);
    if (title) f.title = title;
    const options = (Array.isArray(src.options) ? src.options : []).filter((o) => o && o.name && !(scheduled && scheduled.has(o.ref))).slice(0, C18_CAPS.options).map((o) => {
      const place = o.ref && cards[o.ref] ? o.ref : undefined;
      const p = !place && o.ref ? placesBySlug.get(o.ref) : null;
      let url;
      if (p) { try { url = placeUrl({ name: p.name, placeId: p.place_id }); } catch { url = undefined; } }
      return compact({
        name: line(o.name), place,
        km: Number.isFinite(o.km) && o.km >= 0 ? Math.min(100, Math.round(o.km * 10) / 10) : undefined,
        walk_min: Number.isInteger(o.walk_min) && o.walk_min >= 0 && o.walk_min <= 120 ? o.walk_min : undefined,
        open: line(ck.all(o.open)), note: line(o.note), url
      });
    });
    if (options.length) f.options = options;
  });
}

// Developed by: LightAISolutions
