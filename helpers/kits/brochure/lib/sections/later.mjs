/**
 * Brochure kit — "saved for later": the lists of things researched but not scheduled (next time, rainy-day
 * swaps, dinner ideas…), each item with its one-line reason.
 */
import { esc, clip } from '../escape.mjs';
import { secHead } from './common.mjs';

function item(it) {
  const p = it.place;
  const name = p ? esc(p.name) : esc(it.name || '');
  const chip = p && p.category ? `<span class="chip">${esc(p.category)}</span>` : '';
  const closed = p && p.business_status && p.business_status !== 'OPERATIONAL' ? `<p class="li-note li-closed">Marked closed on Google Maps</p>` : '';
  return `<li><p class="li-name">${name}${chip}</p>${it.reason ? `<p class="li-reason">${esc(clip(it.reason, 200))}</p>` : ''}${it.note ? `<p class="li-note">${esc(clip(it.note, 200))}</p>` : ''}${closed}</li>`;
}
export function later(ctx) {
  const { m } = ctx;
  const lists = m.later.filter((l) => l.items && l.items.length);
  if (!lists.length) return '';
  const n = lists.reduce((a, l) => a + l.items.length, 0);
  return `<section class="sec sec-later" data-pg="section" data-folio="Saved for later">
${secHead(`<b>${n}</b> ideas · not scheduled`, 'Saved for later')}
<div class="later-lists" data-pg="cols">${lists.map((l) => `<div class="later-list"><h3>${esc(l.name)}</h3>${l.description ? `<p class="desc">${esc(clip(l.description, 200))}</p>` : ''}<ul>${l.items.map(item).join('')}</ul></div>`).join('\n')}</div>
</section>`;
}

// Developed by: LightAISolutions
