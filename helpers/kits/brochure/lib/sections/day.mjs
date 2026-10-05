/**
 * Brochure kit — a day spread: the big numeral and theme, the day's statistics, a timeline rail of stops, legs,
 * meals and free time in clock order, and an aside with the day's map (a real Google map when the build fetched one,
 * otherwise the drawn route sketch), the night's lodging, any alternatives (e.g. "If it rains") and any warnings.
 */
import { esc, attr, join, clip } from '../escape.mjs';
import { longDate, shortDate, duration, distance, parseTime } from '../format.mjs';
import { routeSketch, sketchLegend } from '../sketch.mjs';
import { daySequence, mapFigure, mapCredit } from '../mapframe.mjs';
import { icon, MODE_LABEL, MEAL_ICON } from '../icons.mjs';
import { DIRECTIONS_LABEL } from '../directions.mjs';
import { hueStyle, hueOf, timeCell, clockHtml, clockPlain, pageRef, link, hoursFrag, metaLine, sep } from './common.mjs';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';
/** Google requires this notice wherever a walking or bicycling route is shown (Routes API RouteTravelMode). */
export const WALK_BETA = 'Walking routes from Google are in beta and may be missing sidewalks or footpaths.';
/** An estimated ("about") time: the arrival to the nearest 15 minutes, no end time. */
export const roundQuarter = (m) => Math.round(m / 15) * 15;
const aboutCell = (start, locale) => `<div class="ti-time"><span class="t2">about</span><span class="t">${clockHtml(roundQuarter(start) % 1440, locale)}</span></div>`;
/** A leg's flags, taxi time and buffer: 'footpath · uphill · taxi about 11 min · +5 min spare'. */
export const FLAG_ORDER = ['footpath', 'trail', 'uphill', 'downhill'];
export function legExtras(t) {
  const flags = Array.isArray(t.flags) ? t.flags : [];
  return join([...FLAG_ORDER.filter((f) => flags.includes(f)), t.taxi_minutes ? `taxi about ${duration(t.taxi_minutes)}` : '', t.buffer_minutes ? `+${duration(t.buffer_minutes)} spare` : ''], ' · ');
}

/** Contract C11 labels: where a visit length comes from, and the crowd note for a busy place timed on purpose. */
export const MINUTES_SOURCE_LABEL = { official: 'official site', research: 'researched', estimate: 'estimate' };
export const CROWD_NOTE = { opening: 'Go at opening; it gets busy later', late: 'Late is quieter' };
/** The tag a local favourite carries on the rail and on its card. */
export const favTag = (place) => (place && (place.flags || []).includes('local_favourite') ? '<span class="chip hue tag-fav">local favourite</span>' : '');
/** 'about 1 h 30 min' (+ ' (official site)' when the stop says where the length comes from). */
function visitText(t) {
  if (!t.minutes) return '';
  const src = MINUTES_SOURCE_LABEL[t.minutes_source];
  return `about ${duration(t.minutes)}${src ? ` <span class="src">(${src})</span>` : ''}`;
}
/** Contract C12: a stop already done when the day was re-planned — a tick and muted, still in its place. */
export const DONE_TAG = '<span class="chip tag-done">✓ visited</span>';
function stopRow(t, locale) {
  const name = `<h3 class="ti-name">${esc(t.place.name)}${t.booked ? `<span class="chip hue">booked</span>` : ''}${favTag(t.place)}${t.visited === true ? DONE_TAG : ''}</h3>`;
  const meta = metaLine([t.place.category ? esc(t.place.category) : '', visitText(t), hoursFrag(t), t.last_entry ? `last entry ${esc(clockPlain(t.last_entry, locale))}` : '', pageRef(t.place.id)]);
  // C18: a fixed time is exact by definition, so it never prints as an "about" time.
  const when = t.time_style === 'about' && t.start !== null && t.fixed !== true ? aboutCell(t.start, locale) : timeCell(t.start, t.end, locale, '', t.fixed === true);
  const rule = t.booking_line && !t.booked ? `<p class="ti-meta ti-book">${icon('ticket', 12)} ${esc(clip(t.booking_line, 160))}</p>` : '';
  const crowd = CROWD_NOTE[t.crowd_slot] ? `<p class="ti-meta ti-crowd">${icon('clock', 12)} ${CROWD_NOTE[t.crowd_slot]}</p>` : '';
  return `<div class="ti ti-stop${t.visited === true ? ' ti-done' : ''}" data-pg="block">${when}<div class="ti-mark"><span class="badge">${t.n}</span></div><div class="ti-body">${name}${t.activity ? `<p class="ti-act">${esc(t.activity)}</p>` : ''}${meta ? `<p class="ti-meta">${meta}</p>` : ''}${t.booked ? `<p class="ti-meta">${icon('ticket', 12)} ${esc(t.booked)}</p>` : ''}${rule}${crowd}${t.check_on_day ? `<p class="ti-meta ti-check">${icon('info', 12)} ${esc(t.check_on_day)}</p>` : ''}${tipLine(t)}${t.note ? `<p class="ti-note">${esc(clip(t.note, 400))}</p>` : ''}</div></div>`;
}
/** Contract C18: a field note under a stop or meal row ("Cash only", "Enter by the north gate"). */
export const tipLine = (t) => (t.tip ? `<p class="ti-meta ti-tip">${icon('pencil', 12)} <span class="tip-k">Tip</span> ${esc(clip(t.tip, 160))}</p>` : '');
function legRow(t, locale, d) {
  const inn = d && d.start && d.lodging ? `to ${esc(clip(d.lodging.name, 80))}` : 'back to the inn'; // a moving day reaches its lodging; it does not go back
  const to = t.toPlace ? `to ${esc(t.toPlace.name)}` : t.toPoint ? `to ${esc(clip(t.toPoint.name, 80))}` : (t.to === 'lodging' ? inn : '');
  const from = t.fromPlace ? '' : t.fromPoint ? `from ${esc(clip(t.fromPoint.name, 80))}` : (t.from === 'lodging' ? 'from the inn' : '');
  const mins = t.minutes ? (t.estimated ? `about ${duration(t.minutes)} (estimate)` : duration(t.minutes)) : '';
  const facts = join([mins, distance(t.distance_m)], ', ');
  const extras = legExtras(t);
  const body = `<b>${MODE_LABEL[t.mode] || 'Travel'}</b>${facts ? ` ${esc(facts)}` : ''}${from ? ` ${from}` : ''}${to ? ` ${to}` : ''}`;
  const label = t.maps_url ? 'map ↗' : (DIRECTIONS_LABEL[t.mode] || 'Google Maps ↗');
  const map = t.directions_url ? link(t.directions_url, label) : '';
  return `<div class="ti ti-leg" data-pg="block">${timeCell(t.start, null, locale)}<div class="ti-mark"><span>${icon(t.mode, 12)}</span></div><div class="ti-body">${body}${map.startsWith('<a') ? map : ''}${t.line ? `<span class="line">${esc(t.line)}</span>` : ''}${t.note ? `<span class="line">${esc(t.note)}</span>` : ''}${extras ? `<span class="line leg-extra">${esc(extras)}</span>` : ''}</div></div>`;
}
function mealRow(t, locale) {
  // The dinner card (C11): a meal with a booking line, or a dinner at a place with researched facts.
  const facts = t.place && t.place.facts;
  if (t.booking || (facts && t.meal === 'dinner')) return mealCard(t, locale, facts || {});
  const name = t.place ? esc(t.place.name) : esc(t.name || '');
  const meta = t.place ? metaLine([t.place.category && t.place.category.toLowerCase() !== t.meal ? esc(t.place.category) : '', hoursFrag({ hours: t.place.hours_today, closedToday: false }), pageRef(t.place.id)]) : '';
  return `<div class="ti ti-meal" data-pg="block">${timeCell(t.start, t.end, locale, '', t.fixed === true)}<div class="ti-mark"><span class="badge meal">${icon(MEAL_ICON[t.meal] || 'fork', 12)}</span></div><div class="ti-body"><h3 class="ti-name"><span class="ti-kind">${cap(t.meal)}</span>${name ? ` · ${name}` : ''}${favTag(t.place)}</h3>${meta ? `<p class="ti-meta">${meta}</p>` : ''}${tipLine(t)}${t.note ? `<p class="ti-note">${esc(clip(t.note, 300))}</p>` : ''}</div></div>`;
}
/** Contract C11: a meal at a researched place (dinner) as a small card — name, map link, booking, price, menu checked. */
function mealCard(t, locale, f) {
  const p = t.place;
  const name = p ? esc(p.name) : esc(t.name || '');
  const url = t.maps_url || (p && p.maps_url);
  const map = url ? link(url, 'map ↗') : '';
  const meta = metaLine([p && p.category && p.category.toLowerCase() !== t.meal ? esc(p.category) : '', p ? hoursFrag({ hours: p.hours_today, closedToday: false }) : '', map.startsWith('<a') ? map : '', p ? pageRef(p.id) : '']);
  const menu = f.menu_checked ? `menu checked ${esc(shortDate(f.menu_checked, locale))}${f.menu_stale ? ' <span class="stale">· check again</span>' : ''}` : '';
  const booking = t.booking || f.booking;
  const lines = [
    booking ? `<p class="ti-meta ti-book">${icon('ticket', 12)} ${esc(clip(booking, 160))}</p>` : '',
    f.price ? `<p class="ti-meta">${icon('coin', 12)} ${esc(clip(f.price, 160))}</p>` : '',
    f.menu || menu ? `<p class="ti-meta">${icon('check', 12)} ${join([f.menu ? esc(clip(f.menu, 160)) : '', menu], ' · ')}</p>` : ''
  ].join('');
  return `<div class="ti ti-meal ti-dine" data-pg="block">${timeCell(t.start, t.end, locale, '', t.fixed === true)}<div class="ti-mark"><span class="badge meal">${icon(MEAL_ICON[t.meal] || 'fork', 12)}</span></div><div class="ti-body"><div class="dine-card"><h3 class="ti-name"><span class="ti-kind">${cap(t.meal)}</span>${name ? ` · ${name}` : ''}${favTag(p)}</h3>${meta ? `<p class="ti-meta">${meta}</p>` : ''}${lines}${tipLine(t)}${t.note ? `<p class="ti-note">${esc(clip(t.note, 300))}</p>` : ''}</div></div></div>`;
}
/** The bag step's words when the model gives none. */
export const BAGS_TEXT = { hotel: (w) => `Leave your bags at ${w || 'the lodging'}`, locker: (w) => `Bags in a locker${w ? ` at ${w}` : ''}`, forward: () => 'Bags sent ahead', carry: () => 'Carry your bags today' };
const bagsText = (b) => clip(b.text || BAGS_TEXT[b.kind](b.where), 160);
/** The day's real start (an arrival) or end (a departure): the first or the last row of the rail. */
function pointRow(t, locale) {
  const p = t.point, isStart = t.kind === 'start';
  const map = p.maps_url ? link(p.maps_url, 'map ↗') : '';
  const meta = join([p.note ? esc(clip(p.note, 160)) : '', map.startsWith('<a') ? map : ''], sep);
  const bags = t.bags ? `<p class="ti-meta ti-bags-line">${icon('bag', 12)} ${esc(bagsText(t.bags))}</p>` : '';
  return `<div class="ti ti-point ti-${t.kind}" data-pg="block">${timeCell(t.start, null, locale, '', p.fixed === true)}<div class="ti-mark"><span class="pt">${icon(isStart ? 'pin' : 'arrow', 12)}</span></div><div class="ti-body"><h3 class="ti-name"><span class="ti-kind">${isStart ? 'Start' : 'End'}</span> · ${esc(clip(p.name, 120))}</h3>${meta ? `<p class="ti-meta">${meta}</p>` : ''}${bags}</div></div>`;
}
function bagsRow(t, locale) {
  return `<div class="ti ti-leg ti-bags" data-pg="block">${timeCell(t.start, t.end, locale)}<div class="ti-mark"><span>${icon('bag', 12)}</span></div><div class="ti-body"><b>Bags</b> · ${esc(bagsText(t.bags))}</div></div>`;
}
/** The "This evening" box: sunset in the time column, then the extras with their times and distances. */
export const EXTRA_ICON = { event: 'star', saved: 'heart' };
export const kmText = (km) => (km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${Math.round(km * 10) / 10} km`);
function extraItem(x, locale) {
  const name = esc(clip(x.place ? x.place.name : x.name, 120));
  const url = x.url || (x.place && x.place.maps_url);
  const map = url ? link(url, 'map ↗') : '';
  const facts = join([Number.isFinite(x.km) ? `${kmText(x.km)} away` : '', map.startsWith('<a') ? map : '', x.hasCard ? pageRef(x.place.id) : ''], sep);
  return `<li><span class="ev-t">${x.time ? clockHtml(x.time, locale) : ''}</span><span class="ev-i">${icon(EXTRA_ICON[x.kind] || 'star', 11)}</span><span class="ev-b"><b>${name}</b>${x.place ? favTag(x.place) : ''}${facts ? `<span class="ev-m">${facts}</span>` : ''}${x.note ? `<span class="ev-n">${esc(clip(x.note, 160))}</span>` : ''}</span></li>`;
}
function eveningRow(ev, locale) {
  const sun = ev.sunset !== null;
  const body = ev.extras.length
    ? `<div class="evening"><p class="eyebrow">This evening${sun ? ` · sunset <b>${esc(clockPlain(ev.sunset, locale))}</b>` : ''}</p><ul class="ev-list">${ev.extras.map((x) => extraItem(x, locale)).join('')}</ul></div>`
    : `<b>Sunset</b> — the light goes at ${esc(clockPlain(ev.sunset, locale))}`;
  return `<div class="ti ti-evening${ev.extras.length ? '' : ' ti-sunset'}" data-pg="block">${timeCell(sun ? ev.sunset : null, null, locale, sun ? 'sunset' : '')}<div class="ti-mark"><span>${icon('sunset', 12)}</span></div><div class="ti-body">${body}</div></div>`;
}
function freeRow(t, locale, d) {
  if (d && d.c18) return freeRowC18(t, locale);
  return `<div class="ti ti-free" data-pg="block">${timeCell(t.start, t.end, locale)}<div class="ti-mark"><span></span></div><div class="ti-body"><b>Free</b>${t.note ? ` — ${esc(clip(t.note, 300))}` : ''}</div></div>`;
}
/** Contract C18: a planned free window — its name and length, the note, then what is nearby (nearest first). */
function freeRowC18(t, locale) {
  const len = t.start !== null && t.end !== null ? duration(t.end - t.start) : '';
  const head = `<b>${esc(clip(t.title || 'Free', 60))}</b>${len ? ` <span class="fr-len">· ${esc(len)}</span>` : ''}${t.note ? ` — ${esc(clip(t.note, 300))}` : ''}`;
  const opts = (t.options || []).map((o) => {
    const name = esc(clip(o.name, 120));
    const facts = join([Number.isInteger(o.walk_min) ? `${o.walk_min} min walk` : Number.isFinite(o.km) ? `${kmText(o.km)} away` : '', o.open ? esc(clip(o.open, 160)) : '', o.hasCard ? pageRef(o.place.id) : ''], sep);
    return `<li><span class="fo-n">${o.url ? link(o.url, name) : name}</span>${facts ? `<span class="fo-m">${facts}</span>` : ''}${o.note ? `<span class="fo-x">${esc(clip(o.note, 160))}</span>` : ''}</li>`;
  });
  return `<div class="ti ti-free ti-free2" data-pg="block">${timeCell(t.start, t.end, locale)}<div class="ti-mark"><span></span></div><div class="ti-body">${head}${opts.length ? `<ul class="free-opts">${opts.join('')}</ul>` : ''}</div></div>`;
}
/** Contract C18: 'Getting out' — leave-by and departure, up to two worked scenarios with their spare minutes, fallbacks. */
function departRow(dep, locale) {
  const by = dep.by ? parseTime(dep.by) : null, at = parseTime(dep.at);
  const to = `<b>${esc(clip(dep.to, 120))}</b>`, departs = `departs <b>${esc(clockPlain(at, locale))}</b>`;
  const lead = by !== null ? `Leave by <b>${esc(clockPlain(by, locale))}</b> for ${to}, ${departs}` : `For ${to}, ${departs}`;
  const scen = (dep.scenarios || []).map((s) => `<div class="dep-s"><p class="dep-h"><b>${esc(clip(s.label, 120))}</b>${Number.isInteger(s.spare_min) ? ` <span class="spare">${s.spare_min} min spare</span>` : ''}</p>${(s.steps || []).length ? `<ol>${s.steps.map((x) => `<li>${esc(clip(x, 160))}</li>`).join('')}</ol>` : ''}</div>`);
  const fb = (dep.fallbacks || []).length ? `<div class="dep-fb"><p class="dep-k">If you miss it</p><ul>${dep.fallbacks.map((x) => `<li>${esc(clip(x, 160))}</li>`).join('')}</ul></div>` : '';
  const body = `<div class="depart"><p class="eyebrow">Getting out</p><p class="dep-lead">${lead}</p>${scen.length ? `<div class="dep-scen${scen.length > 1 ? ' two' : ''}">${scen.join('')}</div>` : ''}${fb}${dep.note ? `<p class="dep-note">${esc(clip(dep.note, 160))}</p>` : ''}</div>`;
  return `<div class="ti ti-depart" data-pg="block">${timeCell(by ?? at, null, locale, by !== null ? 'leave by' : 'departs')}<div class="ti-mark"><span>${icon('clock', 12)}</span></div><div class="ti-body">${body}</div></div>`;
}
/** Contract C18: "Today's checklist" and "Night before · This morning" — one block under the day's header, side by side. */
export const CHECK_GROUPS = [['must', 'Must'], ['carry', 'Carry'], ['constraints', 'Limits']];
function brief(d, locale) {
  const c = d.checklist || {}, groups = CHECK_GROUPS.filter(([k]) => (c[k] || []).length);
  const check = groups.length ? `<div class="brief-box brief-check"><p class="eyebrow">Today's checklist</p><div class="ck-groups">${groups.map(([k, label]) => `<div class="ck-g ck-${k}"><p class="ck-h">${label}</p><ul>${c[k].map((x) => `<li>${esc(clip(x, 160))}</li>`).join('')}</ul></div>`).join('')}</div></div>` : '';
  const p = d.prep || {}, night = p.night_before || [], steps = p.steps || [];
  const title = join([night.length ? 'Night before' : '', steps.length ? 'This morning' : ''], ' · ');
  const prep = title ? `<div class="brief-box brief-prep"><p class="eyebrow">${title}</p>${night.length ? `<ul class="prep-night">${night.map((x) => `<li>${esc(clip(x, 160))}</li>`).join('')}</ul>` : ''}${steps.length ? `<ol class="prep-steps">${steps.map((s) => `<li><b>${esc(clockPlain(s.time, locale))}</b><span>${esc(clip(s.text, 160))}</span></li>`).join('')}</ol>` : ''}</div>` : '';
  return check || prep ? `<div class="day-brief${check && prep ? ' two' : ''}" data-pg="block">${check}${prep}</div>` : '';
}
export const FIXED_LEGEND = 'Bold times are fixed by a booking, a timed entry or a train; the rest can slide.';
const anyFixed = (d) => d.timeline.some((t) => (t.kind === 'stop' || t.kind === 'meal') ? t.fixed === true : (t.kind === 'start' || t.kind === 'end') && t.point.fixed === true);
const ROW = { stop: stopRow, leg: legRow, meal: mealRow, free: freeRow, start: pointRow, end: pointRow, bags: bagsRow };

function daySketch(d, i, ctx) {
  const { points, pairs } = daySequence(d);
  const legs = pairs.map((q) => ({ from: q.from, to: q.to, mode: q.mode }));
  const modes = [...new Set(legs.map((l) => l.mode))];
  const src = d.map_image ? ctx.img.resolve(d.map_image, `Day ${d.index} map`) : '';
  if (src) return mapFigure({ src, image: d.map_image, points, hue: hueOf(i), title: `Day ${d.index} map`, caption: `<span class="legend-item"><svg viewBox="0 0 28 8" width="28" height="8" aria-hidden="true"><path d="M1 4H27" stroke="${hueOf(i)}" stroke-width="2.6" stroke-linecap="round"/></svg>the day's route</span><span class="legend-item">${mapCredit(d.map_image)}</span>` });
  return `<figure class="sketch-fig">${routeSketch({ points, legs, w: 245, h: 190, hue: hueOf(i), title: `Day ${d.index} route sketch` })}<figcaption class="legend">${sketchLegend(modes, hueOf(i))}<span class="legend-item">scale bar only</span></figcaption></figure>`;
}
function aside(d, i, ctx) {
  const { locale } = ctx;
  const l = d.lodging;
  const lodging = l ? `<div class="aside-block"><p class="eyebrow">The night</p><p>${icon('bed', 13)}<b>${esc(l.name)}</b>${l.address ? `<br>${esc(l.address)}` : ''}${l.maps_url ? `<br>${link(l.maps_url, 'map ↗', ' class="small"')}` : ''}${l.note ? `<br><span class="muted">${esc(clip(l.note, 220))}</span>` : ''}</p></div>` : '';
  const alts = d.alternatives ? `<div class="aside-block"><p class="eyebrow">${esc(clip(d.alternatives.title, 60))}</p>${d.alternatives.items.map((x) => `<p>${icon('umbrella', 13)}<b>${esc(x.place.name)}</b>${x.place.maps_url ? ` ${link(x.place.maps_url, 'map ↗', ' class="small"')}` : ''}${x.note ? `<br><span class="muted">${esc(clip(x.note, 160))}</span>` : ''}</p>`).join('')}</div>` : '';
  const warnings = d.warnings.length ? `<div class="aside-block"><p class="eyebrow">Mind</p><div class="warnings">${d.warnings.map((w) => `<p class="warning ${attr(w.severity || 'warn')}">${icon(w.severity === 'info' ? 'info' : 'warn', 13)}<span>${esc(clip(w.text, 260))}</span></p>`).join('')}</div></div>` : '';
  const beta = d.legs.some((l) => (l.mode === 'walk' || l.mode === 'bike') && !l.estimated) ? `<p class="aside-block muted walk-beta">${esc(WALK_BETA)}</p>` : '';
  const verified = d.verified_on ? `<p class="aside-block verified">Hours and bookings checked ${esc(shortDate(d.verified_on, locale))}.</p>` : '';
  return `<aside class="day-aside" data-pg="aside">${daySketch(d, i, ctx)}${lodging}${alts}${warnings}${beta}${verified}</aside>`;
}
/** '50 min' → '50 min, some estimated' when any of those legs is a distance estimate. */
export const estMark = (text, estimated) => (text && estimated ? `${text}, some estimated` : text);
function stats(d, locale) {
  const s = d.stats;
  const rows = [['Stops', String(s.stops)], ['Visiting', duration(s.visitMin)], ['On foot', estMark(duration(s.walkMin), s.walkEstimated)], ['Transit', estMark(duration(s.transitMin), s.transitEstimated)], ['By road', duration(s.driveMin)], ['Day runs', s.firstStart !== null && s.lastEnd !== null ? `${clockPlain(s.firstStart, locale)} – ${clockPlain(s.lastEnd, locale)}` : ''], ['Spare', s.spareMin === null || s.spareMin === undefined ? '' : (duration(s.spareMin) || 'none')]].filter(([, v]) => v);
  return `<dl class="day-stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}
/** One day. The paginator keeps the head with the first rail items, floats the aside, and continues the rail. */
export function day(d, i, ctx) {
  const { locale } = ctx;
  const folio = `Day ${d.index} · ${shortDate(d.date, locale)}`;
  return `<section class="sec sec-day" data-pg="section" data-folio="${attr(folio)}" data-tab="${attr(`Day ${d.index}`)}" style="${hueStyle(i)}">
<header class="day-head" data-pg="block" data-keep><div class="day-n">${d.index}</div><div class="day-titles"><p class="eyebrow">Day <b>${WORDS[d.index] || d.index}</b> · ${esc(longDate(d.date, locale))}</p><h2>${esc(d.theme)}</h2>${d.summary ? `<p class="day-summary">${esc(clip(d.summary, 400))}</p>` : ''}</div>${stats(d, locale)}</header>
${d.c18 ? c18Head(d, locale) : ''}${aside(d, i, ctx)}
<div class="rail" data-pg="split" data-cont="${attr(`Day ${d.index}, continued`)}">${railRows(d, locale)}</div>
</section>`;
}
/** When the evening box happens: sunset, else the first extra's time (minutes after midnight); null when untimed. */
export function eveningAt(ev) {
  if (ev.sunset !== null) return ev.sunset;
  const t = ev.extras.map((x) => /^(\d{1,2}):(\d{2})$/.exec(x.time || '')).filter(Boolean).map((m) => +m[1] * 60 + +m[2]);
  return t.length ? Math.min(...t) : null;
}
/** Contract C18: the blocks between the day's header and its rail — the brief (checklist, prep) and the fixed-time legend. */
function c18Head(d, locale) {
  const b = brief(d, locale);
  const legend = anyFixed(d) ? `<p class="fixed-legend" data-pg="block"><b>Bold</b> ${esc(FIXED_LEGEND.replace(/^Bold /, ''))}</p>` : '';
  return (b ? b + '\n' : '') + (legend ? legend + '\n' : '');
}
/**
 * The rail in clock order; the evening box goes in at its time (before the first row that starts later), else last.
 * C18: 'Getting out' goes before the first row at or after its leave-by time (the walk out), at the latest before the end row.
 */
function railRows(d, locale) {
  const rows = d.timeline.map((t) => ({ t, html: (ROW[t.kind] || (() => ''))(t, locale, d) }));
  const insertAt = (when, item) => {
    const at = when === null ? -1 : rows.findIndex((r) => r.t && r.t.start !== null && r.t.start > when);
    rows.splice(at < 0 ? rows.length : at, 0, item);
  };
  if (d.evening) insertAt(eveningAt(d.evening), { t: null, html: eveningRow(d.evening, locale) });
  if (d.departure) {
    const item = { t: null, html: departRow(d.departure, locale) };
    // Before the first row that starts at or after the leave-by time (the walk out), and never after the end row.
    const by = parseTime(d.departure.by || d.departure.at);
    const end = rows.findIndex((r) => r.t && r.t.kind === 'end');
    const at = by === null ? -1 : rows.findIndex((r) => r.t && r.t.start !== null && r.t.start >= by);
    const idx = at >= 0 && (end < 0 || at <= end) ? at : end;
    rows.splice(idx < 0 ? rows.length : idx, 0, item);
  }
  return rows.map((r) => r.html).join('\n');
}

// Developed by: LightAISolutions
