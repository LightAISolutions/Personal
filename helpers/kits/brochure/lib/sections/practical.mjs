/**
 * Brochure kit — practical information: short titled blocks of text, label/text pairs or plain lines.
 */
import { esc, clip } from '../escape.mjs';
import { secHead, link } from './common.mjs';

function block(b) {
  const paras = String(b.text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(clip(p, 600))}</p>`).join('');
  const items = (b.items || []).filter(Boolean);
  const labelled = items.filter((it) => typeof it === 'object' && it.label);
  const plain = items.filter((it) => typeof it === 'string' || !it.label);
  const dl = labelled.length ? `<dl>${labelled.map((it) => `<div><dt>${esc(it.label)}</dt><dd>${esc(clip(it.text, 300))}${it.url ? ` ${link(it.url, '↗')}` : ''}</dd></div>`).join('')}</dl>` : '';
  const ul = plain.length ? `<ul>${plain.map((it) => `<li class="plain">${esc(clip(typeof it === 'string' ? it : it.text, 300))}${it.url ? ` ${link(it.url, '↗')}` : ''}</li>`).join('')}</ul>` : '';
  return `<div class="pblock"><h3>${esc(b.title)}</h3>${paras}${dl}${ul}</div>`;
}
export function practical(ctx) {
  const { m } = ctx;
  const blocks = m.practical.filter((b) => b && b.title);
  if (!blocks.length) return '';
  return `<section class="sec sec-practical" data-pg="section" data-folio="Practical">
${secHead('Before and during', 'Practical')}
<div class="pblocks" data-pg="cols">${blocks.map(block).join('\n')}</div>
</section>`;
}

// Developed by: LightAISolutions
