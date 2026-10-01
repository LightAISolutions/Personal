/**
 * Brochure kit — a day spread: the big numeral and theme, the day's statistics, a timeline rail of stops, legs,
 * meals and free time in clock order, and an aside with the day's map (a real Google map when the build fetched one,
 * otherwise the drawn route sketch), the night's lodging and any warnings.
 */
import { esc, attr, join, clip } from '../escape.mjs';
import { longDate, shortDate, duration, distance } from '../format.mjs';
import { routeSketch, sketchLegend } from '../sketch.mjs';
import { daySequence, mapFigure, mapCredit } from '../mapframe.mjs';
import { icon, MODE_LABEL, MEAL_ICON } from '../icons.mjs';
import { hueStyle, hueOf, timeCell, clockPlain, pageRef, link, hoursFrag, metaLine, sep } from './common.mjs';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';

function stopRow(t, locale) {
  const name = `<h3 class="ti-name">${esc(t.place.name)}${t.booked ? `<span class="chip hue">booked</span>` : ''}</h3>`;
  const meta = metaLine([t.place.category ? esc(t.place.category) : '', t.minutes ? `about ${duration(t.minutes)}` : '', hoursFrag(t), pageRef(t.place.id)]);
  return `<div class="ti ti-stop" data-pg="block">${timeCell(t.start, t.end, locale)}<div class="ti-mark"><span class="badge">${t.n}</span></div><div class="ti-body">${name}${t.activity ? `<p class="ti-act">${esc(t.activity)}</p>` : ''}${meta ? `<p class="ti-meta">${meta}</p>` : ''}${t.booked ? `<p class="ti-meta">${icon('ticket', 12)} ${esc(t.booked)}</p>` : ''}${t.note ? `<p class="ti-note">${esc(clip(t.note, 400))}</p>` : ''}</div></div>`;
}
function legRow(t, locale) {
  const to = t.toPlace ? `to ${esc(t.toPlace.name)}` : (t.to === 'lodging' ? 'back to the inn' : '');
  const from = t.fromPlace ? '' : (t.from === 'lodging' ? 'from the inn' : '');
  const facts = join([t.minutes ? duration(t.minutes) : '', distance(t.distance_m)], ', ');
  const body = `<b>${MODE_LABEL[t.mode] || 'Travel'}</b>${facts ? ` ${facts}` : ''}${from ? ` ${from}` : ''}${to ? ` ${to}` : ''}`;
  const map = link(t.maps_url, 'map ↗');
  return `<div class="ti ti-leg" data-pg="block">${timeCell(t.start, null, locale)}<div class="ti-mark"><span>${icon(t.mode, 12)}</span></div><div class="ti-body">${body}${map !== 'map ↗' ? map : ''}${t.line ? `<span class="line">${esc(t.line)}</span>` : ''}${t.note ? `<span class="line">${esc(t.note)}</span>` : ''}</div></div>`;
}
function mealRow(t, locale) {
  const name = t.place ? esc(t.place.name) : esc(t.name || '');
  const meta = t.place ? metaLine([t.place.category && t.place.category.toLowerCase() !== t.meal ? esc(t.place.category) : '', hoursFrag({ hours: t.place.hours_today, closedToday: false }), pageRef(t.place.id)]) : '';
  return `<div class="ti ti-meal" data-pg="block">${timeCell(t.start, t.end, locale)}<div class="ti-mark"><span class="badge meal">${icon(MEAL_ICON[t.meal] || 'fork', 12)}</span></div><div class="ti-body"><h3 class="ti-name"><span class="ti-kind">${cap(t.meal)}</span>${name ? ` · ${name}` : ''}</h3>${meta ? `<p class="ti-meta">${meta}</p>` : ''}${t.note ? `<p class="ti-note">${esc(clip(t.note, 300))}</p>` : ''}</div></div>`;
}
function freeRow(t, locale) {
  return `<div class="ti ti-free" data-pg="block">${timeCell(t.start, t.end, locale)}<div class="ti-mark"><span></span></div><div class="ti-body"><b>Free</b>${t.note ? ` — ${esc(clip(t.note, 300))}` : ''}</div></div>`;
}
const ROW = { stop: stopRow, leg: legRow, meal: mealRow, free: freeRow };

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
  const warnings = d.warnings.length ? `<div class="aside-block"><p class="eyebrow">Mind</p><div class="warnings">${d.warnings.map((w) => `<p class="warning ${attr(w.severity || 'warn')}">${icon(w.severity === 'info' ? 'info' : 'warn', 13)}<span>${esc(clip(w.text, 260))}</span></p>`).join('')}</div></div>` : '';
  const verified = d.verified_on ? `<p class="aside-block verified">Hours and bookings checked ${esc(shortDate(d.verified_on, locale))}.</p>` : '';
  return `<aside class="day-aside" data-pg="aside">${daySketch(d, i, ctx)}${lodging}${warnings}${verified}</aside>`;
}
function stats(d, locale) {
  const s = d.stats;
  const rows = [['Stops', String(s.stops)], ['Visiting', duration(s.visitMin)], ['On foot', duration(s.walkMin)], ['Transit', duration(s.transitMin)], ['By road', duration(s.driveMin)], ['Day runs', s.firstStart !== null && s.lastEnd !== null ? `${clockPlain(s.firstStart, locale)} – ${clockPlain(s.lastEnd, locale)}` : '']].filter(([, v]) => v);
  return `<dl class="day-stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}
/** One day. The paginator keeps the head with the first rail items, floats the aside, and continues the rail. */
export function day(d, i, ctx) {
  const { locale } = ctx;
  const folio = `Day ${d.index} · ${shortDate(d.date, locale)}`;
  return `<section class="sec sec-day" data-pg="section" data-folio="${attr(folio)}" data-tab="${attr(`Day ${d.index}`)}" style="${hueStyle(i)}">
<header class="day-head" data-pg="block" data-keep><div class="day-n">${d.index}</div><div class="day-titles"><p class="eyebrow">Day <b>${WORDS[d.index] || d.index}</b> · ${esc(longDate(d.date, locale))}</p><h2>${esc(d.theme)}</h2>${d.summary ? `<p class="day-summary">${esc(clip(d.summary, 400))}</p>` : ''}</div>${stats(d, locale)}</header>
${aside(d, i, ctx)}
<div class="rail" data-pg="split" data-cont="${attr(`Day ${d.index}, continued`)}">${d.timeline.map((t) => (ROW[t.kind] || (() => ''))(t, locale)).join('\n')}</div>
</section>`;
}

// Developed by: LightAISolutions
