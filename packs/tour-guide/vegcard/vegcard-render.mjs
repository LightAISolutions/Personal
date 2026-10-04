/**
 * Tour Guide veg card — two renderings of a `veg_card` payload. Every string is escaped; nothing is fetched.
 *   vegCardTelegram(card) → chat HTML (Telegram's subset): a header, then each line's local text in bold with its
 *     English in italics beneath; the english_only values last, "show this in a translation app".
 *   vegCardHtml(card, { css = true }) → one self-contained, printable <section> in the brochure kit's page markup
 *     (data-pg="section" / "block", data-folio), so the private brochure can append it as its last page: large local
 *     text, English beneath, black on white, sized to fit one phone screen. VEGCARD_CSS is its stylesheet.
 */
import { esc } from '../../../kits/brochure/lib/escape.mjs';

export const TELEGRAM_HEADER = '🥗 Veg card — show this to the staff';
export const ENGLISH_ONLY_NOTE = 'Also cannot eat — show this in a translation app:';
export const NO_LANG_NOTE = 'No local-language phrases for this country yet — English only.';
const LANG_NAME = { ja: 'Japanese' };
/** Telegram HTML escapes only &, < and >. */
const tg = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sectionsOf = (card) => (card && Array.isArray(card.sections) ? card.sections : []);
const linesOf = (s) => (s && Array.isArray(s.lines) ? s.lines : []);
const eoOf = (card) => (card && Array.isArray(card.english_only) ? card.english_only : []);

/** vegCardTelegram(card) → one HTML string for sendMessage (parse_mode HTML). */
export function vegCardTelegram(card) {
  const out = [`<b>${tg(TELEGRAM_HEADER)}</b>`];
  if (card && card.lang === null) out.push(`<i>${tg(NO_LANG_NOTE)}</i>`);
  for (const s of sectionsOf(card)) {
    out.push('');
    for (const l of linesOf(s)) out.push(l.local ? `<b>${tg(l.local)}</b>\n<i>${tg(l.en)}</i>` : `<b>${tg(l.en)}</b>`);
  }
  const eo = eoOf(card);
  if (eo.length) out.push('', tg(ENGLISH_ONLY_NOTE), ...eo.map((v) => `• <b>${tg(v)}</b>`));
  return out.join('\n');
}

export const VEGCARD_CSS = `.sec-vegcard{background:#fff;color:#000;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif;padding:16px;max-width:430px;margin:0 auto;line-height:1.35}
.sec-vegcard .vc-head{border-bottom:3px solid #000;margin:0 0 12px;padding:0 0 8px}
.sec-vegcard .vc-head h2{font-size:24px;margin:0}
.sec-vegcard .vc-head p{font-size:14px;margin:4px 0 0}
.sec-vegcard .vc-sec{margin:0 0 12px}
.sec-vegcard .vc-line{margin:0 0 10px}
.sec-vegcard .vc-local{display:block;font-size:22px;font-weight:700}
.sec-vegcard .vc-en{display:block;font-size:14px;color:#222}
.sec-vegcard .vc-en.vc-only{font-size:18px;font-weight:700;color:#000}
.sec-vegcard .vc-eo{border:2px solid #000;padding:8px 10px;margin:12px 0 0}
.sec-vegcard .vc-eo p{margin:0 0 4px;font-size:14px}
.sec-vegcard .vc-eo ul{margin:0;padding-left:20px;font-size:18px;font-weight:700}
@media print{.sec-vegcard{max-width:none;padding:0}.sec-vegcard .vc-local{font-size:26pt}.sec-vegcard .vc-en{font-size:12pt}}`;

/** vegCardHtml(card, { css }) → `<section class="sec sec-vegcard" data-pg="section" data-folio="Veg card">…</section>`. */
export function vegCardHtml(card, { css = true } = {}) {
  const lang = card && card.lang ? card.lang : null;
  const head = `<header class="vc-head" data-pg="block" data-keep><h2>🥗 Veg card</h2><p>${lang ? `Show this to the staff · ${esc(LANG_NAME[lang] || lang)} and English` : esc(NO_LANG_NOTE)}</p></header>`;
  const line = (l) => (l.local
    ? `<p class="vc-line"><span class="vc-local" lang="${esc(lang)}">${esc(l.local)}</span><span class="vc-en" lang="en">${esc(l.en)}</span></p>`
    : `<p class="vc-line"><span class="vc-en vc-only" lang="en">${esc(l.en)}</span></p>`);
  const body = sectionsOf(card).map((s) => `<div class="vc-sec vc-${esc(s.id)}" data-pg="block">${linesOf(s).map(line).join('')}</div>`).join('\n');
  const eo = eoOf(card);
  const eoBlock = eo.length ? `\n<div class="vc-eo" data-pg="block"><p>${esc(ENGLISH_ONLY_NOTE)}</p><ul>${eo.map((v) => `<li lang="en">${esc(v)}</li>`).join('')}</ul></div>` : '';
  return `<section class="sec sec-vegcard" data-pg="section" data-folio="Veg card">
${css ? `<style>${VEGCARD_CSS}</style>\n` : ''}${head}
${body}${eoBlock}
</section>`;
}

// Developed by: LightAISolutions
