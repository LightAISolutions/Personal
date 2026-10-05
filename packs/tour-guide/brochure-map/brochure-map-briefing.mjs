/**
 * Tour Guide brochure-map — Contract C18 wave 2 (Phase 18, WP-18d): the written briefing merged into the brochure.
 * toBrochureModel calls mergeBriefing() only with `options.c18: true` and an `options.briefing` (the shape of
 * schemas/tour-guide-briefing.schema.json). The merge is tolerant where the schema is strict, so a briefing written
 * against an older plan still prints what fits; every drop, clip and cap is a "briefing: …" warning that renderPlan
 * returns with the kit's own warnings.
 *   · ignored whole: not an object, v ≠ 1, or a build_id that is not the plan's (the briefing was written for another build).
 *   · per date: a date that is not a brochure day (not in the plan, or a free day without stops) is dropped; unknown keys
 *     are dropped; `theme` replaces the plan's theme, the other keys are the kit's day fields.
 *   · texts: times inside them follow the clock (as wave 1's texts), then they are clipped to the kit's caps
 *     (BRIEF_CAPS[book] in kits/brochure/lib/model.mjs: the brochure's, or the Day book's); lists keep their first N usable entries.
 *   · key_times: an entry without a label or with a bad time is dropped; the first N are kept, then put in time order.
 *   · food: an entry without name, dish or fits is dropped; a `place` with no card in the brochure is dropped from the
 *     entry and the name stays as plain text.
 *   · kit.weather: needs high_c and low_c (−60…60); a low above the high drops the weather; rain_pct must be 0–100
 *     (rounded). An empty kit is left out.
 *   · Contract C18 wave 3 (WP-18e), `book`: the book being built ('brochure' or 'day') sets the caps. `inside` (per stop,
 *     keyed by the stop's place slug: the order inside it) is merged only into a Day book; in a brochure it is dropped
 *     with a warning. In a Day book: a slug that is not one of the day's stops is dropped; each step needs a text, up to
 *     10 are kept; a step's time that is not HH:MM, earlier than the step before, or outside the stop's arrive – depart
 *     is dropped from the step (the step stays). A briefing marked for the other book is still merged, with a warning.
 *   mergeBriefing(days, briefing, { cards, buildId, ck, book }) → warnings[] — mutates the mapped brochure days.
 */
import { briefCaps } from '../../../kits/brochure/lib/model.mjs';
import { clip, compact } from './brochure-map-text.mjs';

export const BRIEF_KEYS = Object.freeze(['theme', 'lead', 'key_times', 'contents', 'food', 'if_then', 'bail_out', 'why', 'kit', 'inside']);
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const hhmm = (t) => { const m = TIME.exec(typeof t === 'string' ? t.trim() : ''); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null; };

/** mergeBriefing(days, briefing, ctx) → warnings (see the file header). */
export function mergeBriefing(days, briefing, { cards = {}, buildId, ck, book = 'brochure' } = {}) {
  const warnings = [];
  const warn = (s) => warnings.push(`briefing: ${s}`);
  const dayBook = book === 'day', caps = briefCaps(dayBook ? 'day' : 'brochure');
  if (!isObj(briefing) || briefing.v !== 1 || !isObj(briefing.days)) { warn('ignored — not a v1 briefing with days'); return warnings; }
  if (briefing.build_id !== undefined && buildId !== undefined && String(briefing.build_id) !== String(buildId)) {
    warn(`ignored — written for build ${clip(briefing.build_id, 64)}, the plan is build ${buildId}`);
    return warnings;
  }
  if (briefing.book !== undefined && (briefing.book === 'day') !== dayBook) warn(`written for ${briefing.book === 'day' ? 'a Day book' : 'the brochure'}, merged into ${dayBook ? 'the Day book' : 'the brochure'} at its caps`);
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const [date, src] of Object.entries(briefing.days)) {
    const day = byDate.get(date);
    if (!day) { warn(`${clip(date, 32)} is not ${dayBook ? "the Day book's day" : 'a day of the brochure'} — dropped`); continue; }
    if (!isObj(src)) { warn(`${date}: not an object — dropped`); continue; }
    const at = (k) => `${date} ${k}`;
    for (const k of Object.keys(src)) if (!BRIEF_KEYS.includes(k)) warn(`${date}: unknown key "${clip(k, 40)}" — dropped`);
    // text(v, cap, where, times): converts the times inside it, clips it to the cap, and says so when it had to.
    const text = (v, cap, where, times = true) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v !== 'string') { warn(`${where}: not text — dropped`); return undefined; }
      const s = times && ck ? ck.all(v) : v;
      const out = clip(s, cap);
      if (out && out.length < s.trim().length) warn(`${where}: clipped to ${cap} characters`);
      return out;
    };
    const list = (v, where) => {
      if (v === undefined) return [];
      if (!Array.isArray(v)) { warn(`${where}: not a list — dropped`); return []; }
      return v;
    };
    // cap(kept, n, where): the first n usable entries (entries dropped as unusable do not count against the cap).
    const cap = (kept, n, where) => {
      if (kept.length > n) warn(`${where}: ${kept.length} entries, the first ${n} kept`);
      return kept.slice(0, n);
    };
    const extra = (o, keys, where) => { for (const k of Object.keys(o)) if (!keys.includes(k)) warn(`${where}: unknown key "${clip(k, 40)}" — dropped`); };

    const theme = text(src.theme, caps.theme, at('theme'));
    if (theme) day.theme = theme;
    const out = {
      lead: text(src.lead, caps.lead, at('lead')),
      key_times: keyTimes(src.key_times, { list, cap, text, warn, extra, at, caps }),
      contents: text(src.contents, caps.contents, at('contents')),
      food: food(src.food, { list, cap, text, warn, extra, at, cards, caps }),
      if_then: cap(list(src.if_then, at('if_then')).map((x, j) => {
        const where = at(`if_then ${j + 1}`);
        if (!isObj(x)) { warn(`${where}: not an object — dropped`); return null; }
        extra(x, ['if', 'then'], where);
        const r = { if: text(x.if, caps.line, `${where} if`), then: text(x.then, caps.line, `${where} then`) };
        if (!r.if || !r.then) { warn(`${where}: needs both "if" and "then" — dropped`); return null; }
        return r;
      }).filter(Boolean), caps.if_then, at('if_then')),
      bail_out: text(src.bail_out, caps.bail_out, at('bail_out')),
      why: cap(list(src.why, at('why')).map((x, j) => text(x, caps.line, at(`why ${j + 1}`))).filter(Boolean), caps.why, at('why')),
      kit: kit(src.kit, { list, cap, text, warn, extra, at, caps })
    };
    Object.assign(day, compact(out));
    if (src.inside !== undefined) {
      if (!dayBook) warn(`${at('inside')}: the order inside a stop is for the Day book — dropped`);
      else inside(day, src.inside, { list, cap, text, warn, extra, at, caps });
    }
  }
  return warnings;
}

/** Contract C18 wave 3: per stop (by its place slug), the order inside it, onto the Day book's stops (see the header). */
function inside(day, v, { list, cap, text, warn, extra, at, caps }) {
  if (!isObj(v)) { warn(`${at('inside')}: not an object — dropped`); return; }
  const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
  for (const [slug, steps] of Object.entries(v)) {
    const where = at(`inside ${clip(slug, 64)}`);
    const stop = day.stops.find((s) => s.place === slug);
    if (!stop) { warn(`${where}: not a stop of the day — dropped`); continue; }
    const lo = hhmm(stop.arrive), hi = hhmm(stop.depart);
    let last = -1;
    const kept = cap(list(steps, where).map((x, j) => {
      const w = `${where} ${j + 1}`;
      if (!isObj(x)) { warn(`${w}: not an object — dropped`); return null; }
      extra(x, ['time', 'text'], w);
      const t = text(x.text, caps.line, `${w} text`);
      if (!t) { warn(`${w}: needs a text — dropped`); return null; }
      return { time: x.time, text: t, w };
    }).filter(Boolean), caps.inside, where).map(({ time, text: t, w }) => {
      if (time === undefined) return { text: t };
      const hm = hhmm(time);
      if (!hm) { warn(`${w}: time is not HH:MM — the step kept without it`); return { text: t }; }
      if (mins(hm) < last) { warn(`${w}: ${hm} is earlier than the step before — the step kept without its time`); return { text: t }; }
      if ((lo && mins(hm) < mins(lo)) || (hi && mins(hm) > mins(hi))) { warn(`${w}: ${hm} is outside the stop (${lo} – ${hi}) — the step kept without its time`); return { text: t }; }
      last = mins(hm);
      return { time: hm, text: t };
    });
    if (kept.length) stop.inside = kept;
  }
}

function keyTimes(v, { list, cap, text, warn, extra, at, caps }) {
  const kept = list(v, at('key_times')).map((x, j) => {
    const where = at(`key_times ${j + 1}`);
    if (!isObj(x)) { warn(`${where}: not an object — dropped`); return null; }
    extra(x, ['label', 'time'], where);
    const label = text(x.label, caps.label, `${where} label`, false), time = hhmm(x.time);
    if (!label || !time) { warn(`${where}: needs a label and an HH:MM time — dropped`); return null; }
    return { label, time };
  }).filter(Boolean);
  // The first N in the briefing's own order, then in time order (a stable sort: equal times keep their order).
  return cap(kept, caps.key_times, at('key_times')).map((x, j) => ({ ...x, j })).sort((a, b) => a.time.localeCompare(b.time) || a.j - b.j).map(({ label, time }) => ({ label, time }));
}

function food(v, { list, cap, text, warn, extra, at, cards, caps }) {
  return cap(list(v, at('food')).map((x, j) => {
    const where = at(`food ${j + 1}`);
    if (!isObj(x)) { warn(`${where}: not an object — dropped`); return null; }
    extra(x, ['name', 'place', 'dish', 'price', 'fits', 'caveat'], where);
    const r = {
      name: text(x.name, caps.line, `${where} name`, false), dish: text(x.dish, caps.line, `${where} dish`),
      price: text(x.price, caps.price, `${where} price`, false), fits: text(x.fits, caps.line, `${where} fits`),
      caveat: text(x.caveat, caps.line, `${where} caveat`)
    };
    if (!r.name || !r.dish || !r.fits) { warn(`${where}: needs a name, a dish and where it fits — dropped`); return null; }
    if (x.place !== undefined) {
      if (typeof x.place === 'string' && Object.prototype.hasOwnProperty.call(cards, x.place)) r.place = x.place;
      else warn(`${where}: no place card for "${clip(String(x.place), 64)}" — kept as plain text`);
    }
    return compact({ name: r.name, place: r.place, dish: r.dish, price: r.price, fits: r.fits, caveat: r.caveat });
  }).filter(Boolean), caps.food, at('food'));
}

function kit(v, { list, cap, text, warn, extra, at, caps }) {
  if (v === undefined) return undefined;
  if (!isObj(v)) { warn(`${at('kit')}: not an object — dropped`); return undefined; }
  extra(v, ['weather', 'items', 'closures', 'not_missing'], at('kit'));
  const lines = (k, n) => cap(list(v[k], at(`kit ${k}`)).map((x, j) => text(x, caps.line, at(`kit ${k} ${j + 1}`))).filter(Boolean), n, at(`kit ${k}`));
  return compact({ weather: weather(v.weather, { text, warn, extra, at, caps }), items: lines('items', caps.kit_items), closures: lines('closures', caps.kit_closures), not_missing: lines('not_missing', caps.kit_not_missing) });
}

function weather(w, { text, warn, extra, at, caps }) {
  if (w === undefined) return undefined;
  const where = at('kit weather');
  if (!isObj(w)) { warn(`${where}: not an object — dropped`); return undefined; }
  extra(w, ['high_c', 'low_c', 'rain_pct', 'note'], where);
  const temp = (t) => (typeof t === 'number' && Number.isFinite(t) && t >= -60 && t <= 60 ? t : undefined);
  const high = temp(w.high_c), low = temp(w.low_c);
  if (high === undefined || low === undefined) { warn(`${where}: needs high_c and low_c between −60 and 60 — dropped`); return undefined; }
  if (low > high) { warn(`${where}: the low is above the high — dropped`); return undefined; }
  let rain;
  if (w.rain_pct !== undefined) {
    if (typeof w.rain_pct === 'number' && w.rain_pct >= 0 && w.rain_pct <= 100) rain = Math.round(w.rain_pct);
    else warn(`${where}: rain_pct must be 0–100 — dropped`);
  }
  return compact({ high_c: high, low_c: low, rain_pct: rain, note: text(w.note, caps.line, `${where} note`) });
}

// Developed by: LightAISolutions
