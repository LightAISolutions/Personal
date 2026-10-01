/**
 * Brochure kit — attribution. The Google Maps block (logo whenever the data came from Places, review authors
 * credited with links to the reviews), the list of every other source consulted, and the colophon.
 * Policy: https://developers.google.com/maps/documentation/places/web-service/policies (read 2026-10-01).
 */
import { esc, join, clip, prettyUrl } from '../escape.mjs';
import { shortDate, longDate } from '../format.mjs';
import { ornamentRule } from '../art.mjs';
import { secHead, link } from './common.mjs';
import { COLORS } from '../tokens.mjs';

function googleBlock(ctx) {
  const a = ctx.m.attribution;
  if (!a.google) return '';
  const logo = ctx.logo || '<b>Google Maps</b>';
  const reviews = a.reviews.length ? `<div class="attr"><h3>Reviews quoted</h3><ul class="attr-reviews">${a.reviews.map((r) => `<li><span>${r.author ? link(r.author_url, esc(r.author)) : 'A Google Maps user'} on ${esc(r.place.name)}${r.when ? `, ${esc(r.when)}` : ''}</span><span>${r.url ? link(r.url, 'the review ↗') : ''}</span></li>`).join('')}</ul></div>` : '';
  return `<div class="attr-google" data-pg="block"><div class="gm-logo">${logo}</div><div><p>Place names, addresses, opening hours, ratings, review counts, price levels and the reviews quoted on the place cards come from Google Maps. Hours and ratings are as read on the dates shown on each card; they change — check on the day.</p>${a.maps ? '<p>The maps are Google Maps (Maps Static API), fetched when this brochure was built; the route lines and numbered markers are drawn on them for this trip. Map data © Google.</p>' : ''}${a.photos ? '<p>Place photos come from Google Maps and are credited to their photographers on each card.</p>' : ''}${a.note ? `<p>${esc(clip(a.note, 400))}</p>` : ''}</div></div>${reviews}`;
}
function sourceList(ctx) {
  const { m } = ctx;
  const rows = [];
  for (const s of m.attribution.sources || []) rows.push({ ...s, place: '' });
  for (const p of Object.values(m.places)) for (const s of p.sources || []) rows.push({ ...s, place: p.name });
  const seen = new Set();
  const uniq = rows.filter((s) => s && s.title && !seen.has(s.url + s.title) && seen.add(s.url + s.title));
  if (!uniq.length) return '';
  // one flat split container: the heading (kept with the first row) and one block per source, so the list can continue across sheets
  return `<div class="attr src-list" role="list" data-pg="split" data-cont="Sources, continued"><h3 data-pg="block" data-keep>Sources consulted</h3>${uniq.map((s) => `<div class="src-row" role="listitem" data-pg="block"><span>${link(s.url, esc(clip(s.title, 90)))}${s.place ? ` <span class="place">· ${esc(s.place)}</span>` : ''}${prettyUrl(s.url, 70) ? `<span class="u">${esc(prettyUrl(s.url, 70))}</span>` : ''}</span><span class="what">${join([s.supports ? esc(clip(s.supports, 80)) : '', s.accessed ? `read ${esc(shortDate(s.accessed, m.locale))}` : ''], ' · ')}</span></div>`).join('')}</div>`;
}
export function attribution(ctx) {
  const { m, locale } = ctx;
  const t = m.trip, a = m.attribution;
  const colophon = `<div class="colophon" data-pg="block"><span>${join([a.generator ? esc(a.generator) : '', t.built_on ? `built ${esc(longDate(t.built_on, locale))}` : '', t.build_id ? `build ${esc(t.build_id)}` : ''], ' · ')}<br>Set in Bitstream Charter. ${a.maps ? 'Maps © Google; markers and routes added for this trip.' : 'Sketches are schematic, drawn from coordinates, and are not maps.'}</span>${ornamentRule(90, COLORS.accent)}</div>`;
  return `<section class="sec sec-attr" data-pg="section" data-folio="Sources">
${secHead('Where this came from', 'Sources & attribution')}
${googleBlock(ctx)}${sourceList(ctx)}${colophon}
</section>`;
}

// Developed by: LightAISolutions
