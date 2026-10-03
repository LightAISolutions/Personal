/**
 * Tour Guide journey — one Plan for the chosen mix.
 *   assembleChosen({ input, outline, choices: { <date>: { key, version } } }) → { plan, alternatives, notes }
 * `input` is the plan input (trip, places, snapshots, estimates, dinners, choices, build_id, now, maps…; no request is
 * sent), `outline` the planner outline the versions were planned under (outlineInput), and `version` the planVersions
 * result for that date (or one of its versions). Every trip date needs a choice.
 *   · days: each date's chosen DayPlan (build_id set to input.build_id); a place that is a stop on two days is an error;
 *   · dinner: a place never serves dinner on two days — the earlier date keeps it and the later day goes back to its
 *     plan before dinner (dinner "near <lodging>"), with an info warning; a dinner place is never also a stop;
 *   · rain swaps and saved extras: a place scheduled anywhere is dropped from them, and each is offered on one day only;
 *   · Later ("Didn't fit"): the outline's own drops (outlinePools), each chosen version's drops, and every pool place
 *     the chosen version left out — "in another version of <date> that you did not choose" when another version
 *     scheduled it, else no room on that date; dinner places no evening took; saved places go to "Next time";
 *   · places, choices, budget (the version sets' counted budgets) and usage (every version's real requests) as planTrip.
 * alternatives: { <date>: [{ key, summary, day }] } — the versions not chosen, for the routine to keep.
 */
import { outlinePools, mergeLater, normalizeChoices, applyChoices, OWNER_CHOICE_REASON, BACK_EARLY_NOTE, DIDNT_FIT } from '../planner/index.mjs';
import { choiceStatus } from '../planner/planner-choices.mjs';
import { clip } from './journey-text.mjs';

const fail = (m) => { throw new Error('journey: ' + m); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const dinnerAt = (d) => { const m = d.meals.find((x) => x.kind === 'dinner' && x.at && x.at !== 'lodging'); return m ? m.at : null; };

export async function assembleChosen({ input, outline, choices }) {
  if (!input || !input.trip) fail('assembleChosen needs the plan input');
  if (!choices || typeof choices !== 'object') fail('choices must be { <date>: { key, version } }');
  const full = outline ? { ...input, outline } : input;
  const P = await outlinePools(full);
  const extra = Object.keys(choices).filter((d) => !P.dates.includes(d));
  if (extra.length) fail(`choices name ${extra.join(', ')}, not trip dates`);
  const picked = {}, sets = {};
  for (const date of P.dates) {
    const c = choices[date];
    if (!c || !c.version) fail(`no chosen version for ${date}`);
    const set = Array.isArray(c.version.versions) ? c.version : { versions: [c.version], budget: null, usage: null };
    const v = set.versions.find((x) => x.key === (c.key || x.key));
    if (!v || !v.day || v.day.date !== date) fail(`the chosen version ${c.key} is not a version of ${date}`);
    picked[date] = v; sets[date] = set;
  }
  const names = new Map([...(input.places || []), ...(input.dinners || [])].filter((p) => p && p.id).map((p) => [p.id, p.name]));
  const days = P.dates.map((date) => ({ ...clone(picked[date].day), build_id: String(input.build_id) }));
  const notes = [];
  // Stops: one day each.
  const stopDay = new Map();
  for (const d of days) for (const s of d.stops) { if (stopDay.has(s.place)) fail(`${s.place} is a stop on ${stopDay.get(s.place)} and ${d.date}`); stopDay.set(s.place, d.date); }
  // Dinner: the earlier date keeps a place; a later day goes back to its plan before dinner.
  const dinnerDay = new Map();
  for (const d of days) {
    const at = dinnerAt(d);
    if (!at) continue;
    if (!dinnerDay.has(at) && !stopDay.has(at)) { dinnerDay.set(at, d.date); continue; }
    const undo = picked[d.date].undo;
    if (!undo) fail(`${at} has dinner on two days and ${d.date} has no plan before dinner to go back to`);
    Object.assign(d, clone(undo));
    if (d.extras && d.extras.length) d.free = d.free.filter((f) => f.note !== BACK_EARLY_NOTE);
    const text = clip(`Dinner at ${names.get(at) || at} is on ${dinnerDay.get(at) || stopDay.get(at)}; tonight's dinner is near your lodging`, 200);
    if (d.warnings.length < 40) d.warnings.push({ severity: 'info', code: 'other', text });
    notes.push(`${d.date}: ${text}`);
  }
  const scheduled = new Set([...stopDay.keys(), ...dinnerDay.keys()]);
  // Rain swaps and saved extras: never a scheduled place, each offered once.
  const swapped = new Set(), offered = new Set();
  for (const d of days) {
    if (d.rain_swaps) { d.rain_swaps = d.rain_swaps.filter((r) => !scheduled.has(r.place) && !swapped.has(r.place)); d.rain_swaps.forEach((r) => swapped.add(r.place)); if (!d.rain_swaps.length) delete d.rain_swaps; }
    if (d.extras) { d.extras = d.extras.filter((x) => x.kind !== 'saved' || (!scheduled.has(x.ref) && !offered.has(x.ref))); d.extras.forEach((x) => x.kind === 'saved' && offered.add(x.ref)); if (!d.extras.length) delete d.extras; }
  }
  // The Later list, rebuilt for the mix.
  const placeById = new Map((input.places || []).map((p) => [p.id, p]));
  const cand = (id) => ({ id, place_id: (placeById.get(id) || (input.dinners || []).find((x) => x.id === id) || {}).place_id });
  const dropped = [], decided = new Set();
  const drop = (id, code, reason, from_date) => { if (scheduled.has(id) || decided.has(id)) return; decided.add(id); dropped.push({ cand: cand(id), code, reason: clip(reason, 300), from_date: from_date || null }); };
  for (const u of P.unplaced) drop(u.cand.id, u.code, u.reason, u.from_date);
  for (const date of P.dates) {
    const v = picked[date];
    const own = new Map(((v.plan && v.plan.later) || []).filter((l) => l.name === DIDNT_FIT).flatMap((l) => l.items).map((it) => [it.place, it]));
    const elsewhere = new Set(sets[date].versions.filter((x) => x !== v).flatMap((x) => x.day.stops.map((s) => s.place)));
    for (const c of P.pools[date]) {
      if (scheduled.has(c.id)) continue;
      const it = own.get(c.id);
      if (it && !elsewhere.has(c.id)) drop(c.id, it.code, it.reason, it.from_date || date);
      else if (elsewhere.has(c.id)) drop(c.id, 'day_full', `${names.get(c.id) || c.id} is in another version of ${date} that you did not choose`, date);
      else drop(c.id, 'day_full', `no room left on ${date} for ${names.get(c.id) || c.id}`, date);
    }
  }
  for (const id of P.withheld) drop(id, 'day_full', `kept for dinner, but no evening had room for ${names.get(id) || id}`, null);
  const ch = input.choices ? resolve(input.places, input.choices) : null;
  const extraLater = ch && ch.explicit ? { refresh: new Set([...ch.keep, ...ch.skip]), kept: input.places.filter((p) => ch.keep.has(p.id)).map((p) => ({ id: p.id, place_id: p.place_id, reason: OWNER_CHOICE_REASON })) } : {};
  const pool = new Set([...Object.values(P.pools).flat().map((c) => c.id), ...P.unplaced.map((u) => u.cand.id), ...P.withheld]);
  const saved = (input.places || []).filter((p) => P.saved.includes(p.id));
  let later = mergeLater({ trip_id: P.trip.id, previous: null, pool, dropped, saved, today: P.today, ...extraLater });
  later = later.map((l) => ({ ...l, items: l.items.filter((it) => !scheduled.has(it.place)) }));
  const inLater = new Set(later.flatMap((l) => l.items.map((it) => it.place)));
  const places = input.places.map((p) => {   // as planTrip's build
    const { scheduled_hint, ...rest } = p; // eslint-disable-line no-unused-vars
    if (ch) return choiceStatus(p, rest, { ch, scheduled, inLater });
    if (scheduled.has(p.id)) return { ...rest, status: 'scheduled' };
    if (inLater.has(p.id)) return { ...rest, status: 'saved-for-later' };
    return pool.has(p.id) && p.status === 'scheduled' ? { ...rest, status: 'candidate' } : rest;
  });
  const known = new Set(places.map((p) => p.id));
  for (const id of dinnerDay.keys()) if (!known.has(id)) { const r = (input.dinners || []).find((x) => x.id === id); if (r) { const { scheduled_hint, ...rest } = r; places.push({ ...rest, status: 'scheduled' }); } } // eslint-disable-line no-unused-vars
  const skus = {}, usage = { matrix_elements: 0, route_calls: 0 };
  let usd = 0, within = true;
  for (const date of P.dates) {
    const s = sets[date];
    if (s.budget) { for (const [k, n] of Object.entries(s.budget.skus)) skus[k] = (skus[k] || 0) + n; usd += s.budget.usd_estimate; within = within && s.budget.within_ceiling; }
    const spent = s.usage ? [s.usage] : s.versions.map((v) => v.usage || v.day.solver);   // the set's own count covers set-aside tries
    for (const u of spent) { usage.matrix_elements += u.matrix_elements || 0; usage.route_calls += u.route_calls || 0; }
  }
  const plan = { v: 1, build_id: String(input.build_id), trip_id: P.trip.id, built_on: P.today, days, later, places, budget: { skus, usd_estimate: Math.round(usd * 10000) / 10000, within_ceiling: within }, usage };
  if (ch) plan.choices = { picks: [...ch.effective.picks].sort(), later: [...ch.effective.later].sort(), skip: [...ch.effective.skip].sort() };
  const alternatives = {};
  for (const date of P.dates) {
    const others = sets[date].versions.filter((x) => x !== picked[date]);
    if (others.length) alternatives[date] = others.map((x) => ({ key: x.key, summary: x.summary || null, day: clone(x.day) }));
  }
  return { plan, alternatives, notes };
}

function resolve(places, raw) {
  const c = normalizeChoices(raw, places);
  return c ? applyChoices(places, c, { explicit: true }) : null;
}

// Developed by: LightAISolutions
