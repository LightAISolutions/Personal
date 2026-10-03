/**
 * Tour Guide Scout — the Scout board (helpers/decisions/TG-SCOUT.md §1, §7): one question answered across a city as a
 * comparison sheet, not an itinerary. Masthead, one map with every pick numbered (and the anchor), compact cards,
 * a compare table, the left-out list, then Google's attribution and the photo credits.
 * Built-scoped Google content (rating, count, price, hours, website, address, photos) arrives in `google` and is shown
 * here only; the board file is a build artefact like the brochure. Every string is escaped, images are `data:` URIs
 * only, links `https:` only, and the document carries no script (a Content-Security-Policy meta says so too).
 * Mobile-first single column on screen; two columns in print. `options.app` drops embedded fonts and any photo wider
 * than 360 px (or heavier than APP_PHOTO_MAX_CHARS) so a 10-pick board stays well under the app's 900 000 chars.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, attr, safeUrl, prettyUrl, clip } from '../../../kits/brochure/lib/escape.mjs';
import { fontFaceCss, STACK } from '../../../kits/brochure/lib/fonts.mjs';
import { COLORS, pageSpec } from '../../../kits/brochure/lib/tokens.mjs';
import { launch, pdfAvailable } from '../../../kits/brochure/lib/pdf.mjs';
import { mapFigure } from '../../../kits/brochure/lib/mapframe.mjs';
import { routeSketch } from '../../../kits/brochure/lib/sketch.mjs';
import { openWindows } from '../gems/gems-hours.mjs';
import { validatePayload, formatErrors, isDate, weekdayOf, fromMinutes } from '../schemas/index.mjs';

export { pdfAvailable };
export const APP_PHOTO_MAX_PX = 360;
export const APP_PHOTO_MAX_CHARS = 40000;
export const APP_MAP_MAX_CHARS = 240000;
export const BOARD_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";
const LOGO_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'kits', 'brochure', 'assets', 'google-maps-logo.svg');
const CJK = '"Noto Sans CJK JP","Noto Serif CJK JP","Hiragino Mincho ProN","Yu Mincho","WenQuanYi Zen Hei"';
const DATA_IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

/** httpsUrl(u) → u when it is a plain https URL (safeUrl rules), else ''. */
export const httpsUrl = (u) => { const s = safeUrl(u); return /^https:\/\//i.test(s) ? s : ''; };
/** dataImage(u) → u when it is a base64 PNG / JPEG / WebP / GIF data URI, else ''. SVG is refused (it can carry markup). */
export const dataImage = (u) => (typeof u === 'string' && DATA_IMG_RE.test(u) ? u : '');

export const LABEL_TEXT = Object.freeze({
  gem: '💎 hidden gem', veg_verified: '🌱 vegetarian verified', veg_likely: '🌱 vegetarian likely', booking: 'book ahead',
  queue: 'expect a queue', cash_only: 'cash only', chain: 'chain', new: 'new', seen_before: 'been before', far: 'far'
});
export const REASON_TEXT = Object.freeze({
  off_topic: 'not really about it', diet: 'nothing vegetarian-safe', diet_unproven: 'no proof of a vegetarian option',
  low_rating: 'poorly rated', unproven: 'too few ratings and no local word', closed: 'closed', closed_on_trip: 'closed on every trip day',
  too_far: 'too far', duplicate: 'listed twice', other: 'other'
});
const PRICE_TEXT = { PRICE_LEVEL_FREE: 'free', PRICE_LEVEL_INEXPENSIVE: 'inexpensive', PRICE_LEVEL_MODERATE: 'moderate', PRICE_LEVEL_EXPENSIVE: 'expensive', PRICE_LEVEL_VERY_EXPENSIVE: 'very expensive' };
const MODE_TEXT = { WALK: 'walk', TRANSIT: 'by transit', DRIVE: 'drive' };
const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const num = (x) => Number.isFinite(x);

export const priceText = (p) => PRICE_TEXT[p] || '';
/** ratingText(g) → '★ 4.6 (312)' from build-scoped Google numbers ('' without a rating). */
export function ratingText(g) {
  if (!g || !num(g.rating)) return '';
  return `★ ${g.rating.toFixed(1)}${num(g.count) ? ` (${Math.round(g.count).toLocaleString('en-US')})` : ''}`;
}
/** reachText(r, from) → 'about 12 min walk from your hotel' ('' without reach). */
export function reachText(r, from) {
  if (!r) return '';
  return `${r.estimated ? 'about ' : ''}${r.minutes} min ${MODE_TEXT[r.mode] || ''}${from ? ` from ${from}` : ''}`.replace(/\s+/g, ' ').trim();
}
const dayLabel = (d) => `${DAY3[weekdayOf(d)]} ${Number(d.slice(8, 10))} ${MON3[Number(d.slice(5, 7)) - 1]}`;
const hasHours = (h) => !!h && typeof h === 'object' && (Array.isArray(h.periods) || (h.by_date && typeof h.by_date === 'object'));

/** tripHours(hours, dates) → [{ date, label, text, closed }] or null when hours are unknown; ≤ 7 dates. */
export function tripHours(hours, dates = []) {
  if (!hasHours(hours) || !dates.length) return null;
  return dates.filter(isDate).slice(0, 7).map((d) => {
    const w = openWindows(hours, d);
    if (w === null) return { date: d, label: dayLabel(d), text: 'hours unknown', closed: false };
    if (!w.length) return { date: d, label: dayLabel(d), text: 'closed', closed: true };
    return { date: d, label: dayLabel(d), text: w.map((x) => `${fromMinutes(x.open)}–${x.close >= 1440 ? '24:00' : fromMinutes(x.close)}`).join(', '), closed: false };
  });
}
/** openSummary(hours, dates) → 'all 4' | '3 of 4' | 'none' | '—' for the compare table. */
export function openSummary(hours, dates = []) {
  const rows = tripHours(hours, dates);
  if (!rows) return '—';
  const known = rows.filter((r) => r.text !== 'hours unknown');
  if (!known.length) return '—';
  const open = known.filter((r) => !r.closed).length;
  return open === known.length ? `all ${known.length}` : open === 0 ? 'none' : `${open} of ${known.length}`;
}
function photoOk(photo, app) {
  if (!photo || typeof photo !== 'object') return '';
  const src = dataImage(photo.data_uri);
  if (!src) return '';
  if (app && ((num(photo.width) && photo.width > APP_PHOTO_MAX_PX) || src.length > APP_PHOTO_MAX_CHARS)) return '';
  return src;
}
const credits = (photo) => (Array.isArray(photo && photo.attributions) ? photo.attributions : []).slice(0, 5)
  .map((a) => { const n = esc(clip(a && a.name, 80)) || 'Google user'; const u = httpsUrl(a && a.uri); return u ? `<a href="${attr(u)}">${n}</a>` : n; });

function css({ page, fontCss }) {
  const C = COLORS;
  return `${fontCss}
:root{--ink:${C.ink};--ink2:${C.ink2};--muted:${C.muted};--rule:${C.rule};--hair:${C.hair};--cream:${C.cream};--accent:${C.accent};--accent-soft:${C.accentSoft};--sea:${C.sea};--moss:${C.moss};--alert:${C.alert}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#fff;color:var(--ink);font:15px/1.45 ${STACK},${CJK};overflow-wrap:anywhere}
a{color:var(--sea)}
.board{max-width:720px;margin:0 auto;padding:16px}
.mast{border-bottom:2px solid var(--ink);padding-bottom:10px;margin-bottom:14px}
.kicker{text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:var(--accent);font-weight:700}
h1{font-size:28px;line-height:1.15;margin:4px 0 6px}
.sub{color:var(--ink2);font-size:13px}
.diet{display:inline-block;margin-top:6px;font-size:12px;background:#e3e8d4;color:var(--moss);border-radius:10px;padding:2px 9px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:22px 0 8px;border-bottom:1px solid var(--rule);padding-bottom:4px}
.map-fig{margin:0}
.gmap{position:relative;width:100%;border-radius:6px;overflow:hidden;border:1px solid var(--rule)}
.gmap img{display:block;width:100%;height:auto}
.gmap-marks{position:absolute;inset:0;width:100%;height:100%}
.sketch{display:block;width:100%;height:auto}
.mapnote{font-size:11px;color:var(--muted);margin-top:4px}
.cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr;gap:12px}
.card{border:1px solid var(--rule);border-radius:8px;padding:10px 12px;break-inside:avoid;page-break-inside:avoid}
.card-head{display:flex;gap:10px;align-items:flex-start}
.rank{flex:none;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px}
.name{font-size:17px;font-weight:700;line-height:1.2}
.name a{color:var(--ink);text-decoration:none}
.area{font-size:12px;color:var(--muted)}
.score{margin-left:auto;font-size:12px;color:var(--ink2);white-space:nowrap}
.ph{margin:8px 0 0}
.ph img{display:block;width:100%;max-height:220px;object-fit:cover;border-radius:5px}
.ph figcaption{font-size:10px;color:var(--muted);margin-top:2px}
.facts{font-size:13px;color:var(--ink2);margin-top:6px}
.hours{font-size:12px;margin-top:4px;color:var(--ink2)}
.hours .closed{color:var(--alert);font-weight:700}
.try{margin-top:6px;font-size:13px}
.why{margin-top:4px;font-size:13px;font-style:italic;color:var(--ink2)}
.bars{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.bar{font-size:10px;color:var(--muted)}
.bar i{display:block;height:5px;background:var(--hair);border-radius:3px;margin-top:2px;overflow:hidden}
.bar b{display:block;height:100%;background:var(--sea)}
.chips{margin-top:6px;display:flex;flex-wrap:wrap;gap:4px}
.chip{font-size:11px;border:1px solid var(--rule);border-radius:10px;padding:1px 7px;background:var(--cream)}
.links{font-size:12px;margin-top:6px;color:var(--muted)}
table.compare{width:100%;border-collapse:collapse;font-size:12px}
.compare th,.compare td{text-align:left;padding:4px 5px;border-bottom:1px solid var(--hair);vertical-align:top}
.compare th,.compare td{overflow-wrap:normal;word-break:normal}
.compare th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);white-space:nowrap}
.compare td:nth-child(n+3){white-space:nowrap}
.tablewrap{overflow-x:auto}
.left{margin:0;padding-left:18px;font-size:13px;color:var(--ink2)}
.more{font-size:13px;color:var(--ink2);margin-top:8px}
.attrib{margin-top:24px;border-top:1px solid var(--rule);padding-top:8px;font-size:11px;color:var(--muted)}
.attrib .logo svg{height:14px;width:auto;vertical-align:middle}
.attrib ol{margin:4px 0 0;padding-left:18px}
footer{margin-top:10px;font-size:10px;color:var(--muted)}
@page{size:${page.css};margin:0.5in}
@media print{
  body{font-size:11.5px}
  .board{max-width:none;padding:0}
  h1{font-size:24px}
  .cards{grid-template-columns:1fr 1fr;gap:10px}
  .ph img{max-height:140px}
  .map-fig{max-width:6.4in;margin:0 auto}
  .sketch{max-height:3.8in;width:auto;margin:0 auto}
  .tablewrap{overflow:visible}
  a{color:var(--ink);text-decoration:none}
}`;
}

const okPoint = (p) => p && num(p.lat) && num(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

function mapSection({ payload, map, anchor, locations, app }) {
  const points = [];
  if (okPoint(anchor)) points.push({ lat: anchor.lat, lng: anchor.lng, kind: 'lodging', label: clip(anchor.label || 'start', 30) });
  for (const it of payload.items) {
    const p = it.place_id && locations[it.place_id];
    if (okPoint(p)) points.push({ lat: p.lat, lng: p.lng, kind: 'stop', n: it.n });
  }
  if (!points.some((p) => p.kind === 'stop')) return '';
  const title = `Map of the ${payload.items.length} picks`;
  let src = map && dataImage(map.data_uri);
  const v = map && map.view;
  const viewOk = v && okPoint(v.center) && num(v.zoom) && num(v.width) && num(v.height) && v.width > 0 && v.height > 0;
  if (src && app && src.length > APP_MAP_MAX_CHARS) src = '';
  if (src && viewOk) {
    const view = { center: { lat: v.center.lat, lng: v.center.lng }, zoom: v.zoom, width: v.width, height: v.height };
    return `<section class="map"><h2>Map</h2>${mapFigure({ src, image: { view, alt: title }, points, hue: COLORS.accent, title })}<div class="mapnote">Numbers match the ranks below${okPoint(anchor) ? '; the house is ' + esc(clip(anchor.label || 'the start', 40)) : ''}. Map data © Google.</div></section>`;
  }
  return `<section class="map"><h2>Map</h2>${routeSketch({ points, legs: [], w: 640, h: 420, hue: COLORS.accent, title: 'Sketch of the picks' })}<div class="mapnote">A drawn sketch (not to scale with streets); numbers match the ranks below.</div></section>`;
}

function cardHtml(it, { g, payload, trip_dates, app }) {
  const url = httpsUrl(it.maps_url);
  const name = esc(it.name);
  const photo = photoOk(g.photo, app);
  const cr = photo ? credits(g.photo) : [];
  const facts = [ratingText(g), priceText(g.price_level), reachText(it.reach, payload.from)].filter(Boolean).map(esc).join(' · ');
  const hrs = tripHours(g.hours, trip_dates);
  const hoursHtml = hrs ? `<div class="hours">${hrs.map((h) => `${esc(h.label)} <span${h.closed ? ' class="closed"' : ''}>${esc(h.text)}</span>`).join(' · ')}</div>`
    : (g.hours && Array.isArray(g.hours.weekdayDescriptions) && g.hours.weekdayDescriptions.length ? `<div class="hours">${esc(clip(g.hours.weekdayDescriptions.join('; '), 320))}</div>` : '');
  const bars = [['on topic', it.parts.topic], ['quality', it.parts.quality], ['fit', it.parts.fit], ['reach', it.parts.reach]]
    .map(([k, v]) => `<div class="bar">${esc(k)}<i><b style="width:${Math.min(100, Math.max(0, Math.round(v)))}%"></b></i></div>`).join('');
  const chips = it.labels.map((l) => `<span class="chip">${esc(LABEL_TEXT[l] || l)}</span>`).join('');
  const site = httpsUrl(g.website);
  const links = [url ? `<a href="${attr(url)}">Open in Google Maps</a>` : '', site ? `<a href="${attr(site)}">${esc(prettyUrl(site))}</a>` : '', g.address ? esc(clip(g.address, 160)) : ''].filter(Boolean).join(' · ');
  return `<li class="card" id="pick-${esc(it.n)}">
<div class="card-head"><div class="rank">${esc(it.n)}</div><div><div class="name">${url ? `<a href="${attr(url)}">${name}</a>` : name}</div><div class="area">${esc([it.area, it.category].filter(Boolean).join(' · '))}</div></div><div class="score">${esc(it.score)}/100</div></div>
${photo ? `<figure class="ph"><img src="${attr(photo)}" alt="${attr('Photo of ' + it.name)}" loading="lazy"><figcaption>Photo: ${cr.join(', ') || 'Google user'} · via Google</figcaption></figure>` : ''}
${facts ? `<div class="facts">${facts}</div>` : ''}${hoursHtml}
${it.try ? `<div class="try"><b>Try:</b> ${esc(it.try)}</div>` : ''}
<div class="why">${esc(it.why_you)}</div>
<div class="bars">${bars}</div>
${chips ? `<div class="chips">${chips}</div>` : ''}
${links ? `<div class="links">${links}</div>` : ''}
</li>`;
}

function compareHtml(payload, google, trip_dates) {
  const veg = (it) => (it.labels.includes('veg_verified') ? 'verified' : it.labels.includes('veg_likely') ? 'likely' : '—');
  const rows = payload.items.map((it) => {
    const g = google[it.place_id] || {};
    return `<tr><td>${esc(it.n)}</td><td>${esc(it.name)}</td><td>${esc(ratingText(g).replace(/^★ /, '') || '—')}</td><td>${esc(priceText(g.price_level) || '—')}</td><td>${esc(it.reach ? `${it.reach.minutes} min` : '—')}</td><td>${esc(openSummary(g.hours, trip_dates))}</td><td>${esc(veg(it))}</td></tr>`;
  }).join('');
  return `<section class="compare-sec"><h2>Compare</h2><div class="tablewrap"><table class="compare"><thead><tr><th>#</th><th>Name</th><th>Rating</th><th>Price</th><th>Reach</th><th>Open on your days</th><th>Veg</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

/**
 * renderScoutBoard({ payload, google, map?, anchor?, locations, trip_dates?, options }) → { html }
 *   payload    a valid `scout` payload (validated here; throws when invalid)
 *   google     { <place_id>: { rating?, count?, price_level?, hours?, website?, address?, photo?: { data_uri, width?, attributions } } }
 *   map        { data_uri, width, height, view }  one Static Maps image fitted with fitView(); without it, a drawn sketch
 *   anchor     { label, lat, lng }  where reach is measured from (drawn as the house)
 *   locations  { <place_id>: { lat, lng } }   trip_dates  ['YYYY-MM-DD', …]
 *   options    { built_on?, page = 'letter', embedFonts = true, app = false, owner_tz? }
 */
export function renderScoutBoard({ payload, google = {}, map = null, anchor = null, locations = {}, trip_dates = [], options = {} } = {}) {
  const r = validatePayload('scout', payload);
  if (!r.ok) throw Object.assign(new Error('scout: renderScoutBoard needs a valid scout payload:\n' + formatErrors(r.errors)), { errors: r.errors });
  const app = options.app === true;
  const page = pageSpec(options.page);
  const fontCss = app || options.embedFonts === false ? '' : fontFaceCss({ embed: true }).css;
  const G = google && typeof google === 'object' ? google : {};
  const L = locations && typeof locations === 'object' ? locations : {};
  const dates = (Array.isArray(trip_dates) ? trip_dates : []).filter(isDate);
  const n = payload.items.length;
  const title = `${payload.query.charAt(0).toUpperCase()}${payload.query.slice(1)} in ${payload.place_label}`;
  const sub = [`${n} pick${n === 1 ? '' : 's'}, ranked for you`, payload.from ? `reach from ${payload.from}` : '', options.built_on && isDate(options.built_on) ? `built ${options.built_on}` : ''].filter(Boolean).map(esc).join(' · ');
  const cards = payload.items.map((it) => cardHtml(it, { g: G[it.place_id] || {}, payload, trip_dates: dates, app })).join('\n');
  const left = payload.left_out.length ? `<section><h2>Left out</h2><ul class="left">${payload.left_out.map((l) => `<li>${esc(l.name)} — ${esc(REASON_TEXT[l.reason] || l.reason)}</li>`).join('')}</ul></section>` : '';
  const more = payload.more ? `<div class="more">${esc(payload.more)} more ranked pick${payload.more === 1 ? '' : 's'} not shown.</div>` : '';
  const logo = existsSync(LOGO_PATH) ? readFileSync(LOGO_PATH, 'utf8').replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').trim() : '';
  const photoCredits = payload.items.filter((it) => photoOk((G[it.place_id] || {}).photo, app)).map((it) => `<li value="${esc(it.n)}">${esc(it.name)}: ${credits(G[it.place_id].photo).join(', ') || 'Google user'}</li>`).join('');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${attr(BOARD_CSP)}">
<meta name="referrer" content="no-referrer"><meta name="brochure-page" content="${esc(page.key)}"><meta name="scout-id" content="${attr(payload.scout_id)}">
<title>${esc('Scout — ' + title)}</title>
<style>${css({ page, fontCss })}</style></head>
<body><main class="board">
<header class="mast"><div class="kicker">Scout</div><h1>${esc(title)}</h1><div class="sub">${sub}</div>${payload.diet ? `<div class="diet">${esc('Every pick has something ' + payload.diet)}</div>` : ''}</header>
${mapSection({ payload, map, anchor, locations: L, app })}
<section><h2>The picks</h2><ol class="cards">
${cards}
</ol>${more}</section>
${n ? compareHtml(payload, G, dates) : ''}
${left}
<section class="attrib"><div class="logo">${logo ? `<span role="img" aria-label="Google Maps">${logo}</span> ` : ''}Places data, ratings, hours, photos and map © Google. Ranks, scores and notes are ours.</div>${photoCredits ? `<div>Photo credits:</div><ol>${photoCredits}</ol>` : ''}</section>
<footer>Scout board ${esc(payload.scout_id)} · a comparison sheet, not an itinerary.</footer>
</main></body></html>
`;
  return { html };
}

/** renderScoutBoardPdf(args, outPdf) → { html, pdf|null, available, error? } — the HTML is always returned. */
export async function renderScoutBoardPdf(args = {}, outPdf) {
  const { html } = renderScoutBoard(args);
  if (!outPdf) return { html, pdf: null, available: pdfAvailable(), error: 'no output path' };
  if (!pdfAvailable()) return { html, pdf: null, available: false, error: 'Playwright or Chromium not available' };
  const page = pageSpec(args.options && args.options.page);
  let browser;
  try {
    browser = await launch();
    const pg = await (await browser.newContext()).newPage();
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.emulateMedia({ media: 'print' });
    await pg.pdf({ path: outPdf, format: page.css, printBackground: true, preferCSSPageSize: true });
    return { html, pdf: outPdf, available: true };
  } catch (e) {
    return { html, pdf: null, available: false, error: String(e && e.message || e) };
  } finally {
    if (browser) await browser.close();
  }
}

// Developed by: LightAISolutions
