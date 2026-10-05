/**
 * Brochure kit — bits every section shares: the section head, the hue of a day, time cells, page references.
 * Markup contract with the paginator (lib/paginate.mjs): `data-pg="sheet|section|block|split|cols|aside"`,
 * `data-keep` (keep with next), `data-folio` (running head text), `data-tab` (day tab text).
 */
import { esc, attr, safeUrl, join } from '../escape.mjs';
import { clock, pad2, duration } from '../format.mjs';
import { dayHue } from '../tokens.mjs';
import { icon } from '../icons.mjs';

export const hueStyle = (i) => { const [h, s] = dayHue(i); return `--hue:${h};--hue-soft:${s}`; };
export const hueOf = (i) => dayHue(i)[0];
export const minsToHm = (m) => (Number.isFinite(m) ? `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}` : '');

/** `<div class="sec-head">` with eyebrow + title on the left and optional meta on the right. */
export function secHead(eyebrow, title, meta = '') {
  return `<header class="sec-head" data-pg="block" data-keep><div><p class="eyebrow">${eyebrow}</p><h2>${esc(title)}</h2></div>${meta ? `<p class="sec-meta">${meta}</p>` : ''}</header>`;
}
/** Time as '9:30<small>am</small>' (en-US) or '09:30'. `m` is minutes from midnight or an 'HH:MM' string. */
export function clockHtml(m, locale) {
  const c = clock(typeof m === 'number' ? minsToHm(m) : m, locale);
  return c.text ? `${esc(c.text)}${c.suffix ? `<small>${c.suffix}</small>` : ''}` : '';
}
export function clockPlain(m, locale) {
  const c = clock(typeof m === 'number' ? minsToHm(m) : m, locale);
  return c.suffix ? `${c.text} ${c.suffix}` : c.text;
}
/**
 * The timeline's left column: start on the first line, end (or a duration) muted beneath. `fixed` (Contract C18): the
 * time cannot slide — set bold, with a small "fixed" tag under it.
 */
export function timeCell(start, end, locale, below = '', fixed = false) {
  const t = start === null || start === undefined ? '' : `<span class="t">${clockHtml(start, locale)}</span>`;
  const t2 = below || (end !== null && end !== undefined && end !== start ? `– ${clockPlain(end, locale)}` : '');
  const fx = fixed && t ? '<span class="fx-tag">fixed</span>' : '';
  return `<div class="ti-time${fx ? ' is-fixed' : ''}">${t}${t2 ? `<span class="t2">${t2}</span>` : ''}${fx}</div>`;
}
/** Reference to a place card: a link on screen, replaced by 'p. N' by the paginator. */
export const pageRef = (placeId, label = 'see card') => `<a class="pref" href="#place-${attr(placeId)}" data-pageref="${attr(placeId)}">${label}</a>`;
/** A link that survives safeUrl, else plain text. */
export const link = (url, text, extra = '') => { const u = safeUrl(url); return u ? `<a href="${attr(u)}"${extra}>${text}</a>` : text; };
/** Opening-hours fragment for a stop: 'open 9:30 AM – 5:00 PM' or a red 'closed today'. */
export function hoursFrag(stop) {
  if (stop.closedToday) return `<span class="closed">${icon('warn', 12)} closed on this day</span>`;
  return stop.hours ? `open ${esc(stop.hours)}` : '';
}
export const sep = '<span class="sep">·</span>';
export const metaLine = (parts) => join(parts, sep);
export const durationText = duration;

// Developed by: LightAISolutions
