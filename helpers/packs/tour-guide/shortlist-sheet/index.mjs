/**
 * Tour Guide pack — the shortlist sheet. One research round (the `shortlist` payload) as a printable page the owner
 * opens from a link: the same numbers as the chat, each place with its time, area, why-you line, gem line and a Maps
 * link, then the round's notes. Built from the payload only (no Google content beyond the Maps link), styled with the
 * brochure kit's typeface and colours, printed by the kit's Chromium step.
 *   import { shortlistSheetHtml, renderShortlistPdf, pdfAvailable } from '…/packs/tour-guide/shortlist-sheet/index.mjs';
 *   node helpers/packs/tour-guide/shortlist-sheet/index.mjs shortlist.json out.pdf [--title T] [--dates D] [--stay S]
 *     [--notes notes.json] [--built-on YYYY-MM-DD] [--page letter|a4]      exit 0 PDF · 1 error · 3 HTML only
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { esc, safeUrl, clip } from '../../../kits/brochure/lib/escape.mjs';
import { fontFaceCss, STACK } from '../../../kits/brochure/lib/fonts.mjs';
import { COLORS, pageSpec } from '../../../kits/brochure/lib/tokens.mjs';
import { launch, pdfAvailable } from '../../../kits/brochure/lib/pdf.mjs';

export { pdfAvailable };
export const GROUP_TITLE = { activities: 'Things to do', food: 'Food' };
export const MAX_NOTES = 12;
const CJK = '"Noto Sans CJK JP","Noto Serif CJK JP","Hiragino Mincho ProN","Yu Mincho","WenQuanYi Zen Hei","Unifont-JP"';

/** 30 → "~30 min", 60 → "~1 h", 75 → "~1 h 15". */
export function minutesLabel(m) {
  const n = Math.max(0, Math.round(Number(m) || 0));
  if (n < 60) return `~${n} min`;
  const h = Math.floor(n / 60), r = n % 60;
  return r ? `~${h} h ${String(r).padStart(2, '0')}` : `~${h} h`;
}

const GEM_SVG = '<svg class="gem-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h8l3 4-7 8-7-8z" fill="currentColor"/></svg>';

function itemHtml(it) {
  const url = safeUrl(it.maps_url);
  const name = esc(clip(it.name, 120));
  const meta = [minutesLabel(it.est_minutes), clip(it.area, 120), ...(it.labels || [])].filter(Boolean).map(esc).join(' · ');
  const seen = it.seen_before ? `You were here on ${esc(it.seen_before.trip)} (${esc(it.seen_before.on)}, ${esc(it.seen_before.outcome)}).` : '';
  const changes = Array.isArray(it.changes) && it.changes.length ? 'Since then: ' + it.changes.map((c) => esc(clip(typeof c === 'string' ? c : c.what || c.text || '', 120))).join('; ') + '.' : '';
  return `<li class="item${it.gem ? ' is-gem' : ''}">
  <div class="num">${esc(it.n)}</div>
  <div class="body">
    <div class="name">${url ? `<a href="${esc(url)}">${name}</a>` : name}${it.gem ? ` <span class="gem">${GEM_SVG}hidden gem</span>` : ''}</div>
    <div class="meta">${meta}</div>
    ${it.why_you ? `<div class="why">${esc(clip(it.why_you, 160))}</div>` : ''}
    ${it.gem && it.gem_line ? `<div class="gemline">${esc(clip(it.gem_line, 200))}</div>` : ''}
    ${seen || changes ? `<div class="seen">${[seen, changes].filter(Boolean).join(' ')}</div>` : ''}
    ${url ? `<div class="maps"><a href="${esc(url)}">Open in Google Maps</a></div>` : ''}
  </div>
</li>`;
}

function groupHtml(g) {
  const items = (g.items || []).slice().sort((a, b) => a.n - b.n);
  if (!items.length) return '';
  const floor = g.gems_wanted > (g.gems_shown || 0) ? `<p class="floor">${esc(g.gems_shown || 0)} of the ${esc(g.gems_wanted)} hidden gems you asked for met the bar this round.</p>` : '';
  return `<section class="group"><h2>${esc(GROUP_TITLE[g.id] || g.id)}</h2>${floor}<ol class="items">${items.map(itemHtml).join('\n')}</ol></section>`;
}

/** The sheet's stylesheet: brochure typeface and colours, one flowing column, cards never split across pages. */
export function sheetCss(page = pageSpec()) {
  const c = COLORS, m = page.margins;
  return `@page{size:${page.css};margin:${m.top}in ${m.right}in ${m.bottom}in ${m.left}in}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:${STACK},${CJK};color:${c.ink};background:${c.paper};font-size:10.5pt;line-height:1.38}
a{color:${c.accentInk};text-decoration:none}
header{border-bottom:2px solid ${c.accent};padding-bottom:10pt;margin-bottom:14pt}
.kicker{font-size:8.5pt;letter-spacing:.14em;text-transform:uppercase;color:${c.accent};font-weight:700}
h1{font-size:24pt;line-height:1.1;margin:4pt 0 4pt;font-weight:700}
.sub{color:${c.ink2};font-size:10pt}
.howto{background:${c.cream};border-radius:6pt;padding:8pt 11pt;margin:0 0 14pt;font-size:9.5pt;color:${c.ink2}}
h2{font-size:15pt;margin:16pt 0 6pt;color:${c.ink};border-bottom:1px solid ${c.rule};padding-bottom:3pt}
.floor{font-size:9pt;color:${c.muted};font-style:italic;margin:0 0 6pt}
ol.items{list-style:none;margin:0;padding:0}
.item{display:flex;gap:11pt;padding:8pt 0;border-bottom:1px solid ${c.hair};break-inside:avoid;page-break-inside:avoid}
.num{flex:0 0 24pt;height:24pt;border-radius:50%;background:${c.accentSoft};color:${c.accentInk};font-weight:700;font-size:12pt;display:flex;align-items:center;justify-content:center}
.is-gem .num{background:${c.seaSoft};color:${c.sea}}
.body{flex:1;min-width:0}
.name{font-size:12.5pt;font-weight:700;line-height:1.25}.name a{color:${c.ink}}
.gem{display:inline-flex;align-items:center;gap:3pt;font-size:8pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${c.sea};background:${c.seaSoft};border-radius:8pt;padding:1pt 6pt;margin-left:4pt;vertical-align:2pt}
.gem-ico{width:8pt;height:8pt}
.meta{font-size:9pt;color:${c.muted};margin-top:1pt}
.why{margin-top:3pt}.gemline{margin-top:2pt;font-style:italic;color:${c.sea}}
.seen{margin-top:2pt;font-size:9.5pt;color:${c.ink2}}
.maps{margin-top:3pt;font-size:9pt}
.notes{margin-top:18pt;background:${c.cream};border-radius:6pt;padding:9pt 12pt;break-inside:avoid}
.notes h3{margin:0 0 4pt;font-size:11pt}.notes ul{margin:0;padding-left:14pt}.notes li{margin:2pt 0;font-size:9.5pt;color:${c.ink2}}
footer{margin-top:16pt;font-size:8pt;color:${c.faint}}`;
}

/**
 * shortlistSheetHtml(payload, { title, dates, stay, notes, built_on, page, embedFonts }) → HTML string.
 * `title`/`dates`/`stay` are display text (the trip's destination, date range and where the owner stays);
 * `notes` are the round's plain-text lines (fewer gems than asked, heads-ups), at most MAX_NOTES.
 */
export function shortlistSheetHtml(sl, o = {}) {
  const page = pageSpec(o.page);
  const fonts = fontFaceCss({ embed: o.embedFonts !== false });
  const title = clip(o.title || sl.trip, 120);
  const sub = [o.dates, o.stay ? `staying at ${o.stay}` : ''].filter(Boolean).map((s) => esc(clip(s, 160))).join(' · ');
  const notes = (o.notes || []).map((s) => clip(s, 300)).filter(Boolean).slice(0, MAX_NOTES);
  const count = (sl.groups || []).reduce((n, g) => n + (g.items || []).length, 0);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} — shortlist</title>
<style>${fonts.css}${sheetCss(page)}</style></head><body>
<header><div class="kicker">Shortlist · round ${esc(sl.round)} · ${esc(count)} places</div><h1>${esc(title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</header>
<div class="howto">Pick in Telegram with the same numbers: ✅ want it, 🔖 later, ❌ skip. Names open the place in Google Maps.</div>
${(sl.groups || []).map(groupHtml).join('\n')}
${notes.length ? `<section class="notes"><h3>About this round</h3><ul>${notes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>` : ''}
<footer>Tour Guide${o.built_on ? ` · built ${esc(o.built_on)}` : ''} · times are estimates; check opening hours before you go.</footer>
</body></html>`;
}

/** renderShortlistPdf(payload, outPdf, opts) → { html, pdf|null, available, error? } — HTML is always returned. */
export async function renderShortlistPdf(sl, outPdf, o = {}) {
  const html = shortlistSheetHtml(sl, o);
  if (!pdfAvailable()) return { html, pdf: null, available: false, error: 'Playwright or Chromium not available' };
  const page = pageSpec(o.page);
  const browser = await launch();
  try {
    const pg = await (await browser.newContext()).newPage();
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.emulateMedia({ media: 'print' });
    await pg.pdf({ path: outPdf, format: page.css, printBackground: true, preferCSSPageSize: true });
    return { html, pdf: outPdf, available: true };
  } finally {
    await browser.close();
  }
}

async function main(argv) {
  const pos = [], o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--title', '--dates', '--stay', '--notes', '--built-on', '--page'].includes(a)) o[a.slice(2).replace('-', '_')] = argv[++i];
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else pos.push(a);
  }
  if (pos.length !== 2) throw new Error('usage: index.mjs shortlist.json out.pdf [--title T] [--dates D] [--stay S] [--notes notes.json] [--built-on D] [--page letter|a4]');
  const sl = JSON.parse(readFileSync(pos[0], 'utf8'));
  if (o.notes) o.notes = JSON.parse(readFileSync(o.notes, 'utf8'));
  const r = await renderShortlistPdf(sl, pos[1], o);
  const htmlPath = pos[1].replace(/\.pdf$/i, '') + '.html';
  writeFileSync(htmlPath, r.html);
  console.log(JSON.stringify({ ok: true, pdf: r.pdf, html: htmlPath, available: r.available, error: r.error }));
  return r.available ? 0 : 3;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.log(JSON.stringify({ ok: false, error: e.message })); process.exit(1); });
}

// Developed by: LightAISolutions
