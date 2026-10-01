/**
 * Brochure kit — place cards, one per place in order of first appearance: a photo (the place's own image, or a Google
 * place photo credited to its author), what it is, the practical line (hours,
 * rating, price, links — Google-sourced fields are marked), then the notes written for these travellers, one
 * review with its author credited, and the sources behind the notes.
 */
import { esc, attr, join, clip, prettyUrl } from '../escape.mjs';
import { shortDate, number } from '../format.mjs';
import { icon, stars, MEAL_ICON } from '../icons.mjs';
import { secHead, hueStyle, link } from './common.mjs';

const NOTE_ORDER = [['why_you', 'Why you'], ['what_to_do', 'Do'], ['what_to_skip', 'Skip'], ['best_time', 'When'], ['tickets', 'Tickets'], ['food', 'Eat'], ['accessibility', 'Access']];
const PRICE = (n) => (Number.isInteger(n) && n > 0 ? '$'.repeat(Math.min(4, n)) : '');

function metaList(p, m) {
  const closedNow = p.business_status && p.business_status !== 'OPERATIONAL';
  const li = [];
  if (p.address) li.push(`<li>${icon('pin', 12)}<span>${esc(p.address)}</span></li>`);
  if (closedNow) li.push(`<li>${icon('warn', 12)}<span class="closed">${p.business_status === 'CLOSED_PERMANENTLY' ? 'Marked permanently closed' : 'Marked temporarily closed'} on Google Maps — check before going</span></li>`);
  const days = m.days.filter((d) => d.timeline.some((t) => t.place && t.place.id === p.id));
  const hoursText = days.map((d) => { const t = d.timeline.find((x) => x.place && x.place.id === p.id); const h = t.hours || p.hours_today; return t.closedToday ? `<span class="closed">closed ${shortDate(d.date, m.locale)}</span>` : h ? `${esc(h)} on ${shortDate(d.date, m.locale)}` : ''; }).filter(Boolean);
  if (hoursText.length) li.push(`<li>${icon('clock', 12)}<span>${hoursText.join('; ')}${p.closed_days && p.closed_days.length ? ` · closed ${p.closed_days.map(esc).join(', ')}` : ''}</span></li>`);
  else if (p.closed_days && p.closed_days.length) li.push(`<li>${icon('clock', 12)}<span>Closed ${p.closed_days.map(esc).join(', ')}</span></li>`);
  if (p.rating) li.push(`<li>${icon('star', 12)}<span>${stars(p.rating, 10)}${esc(p.rating)}${p.review_count ? ` · ${number(p.review_count, m.locale)} reviews` : ''}${PRICE(p.price_level) ? ` · ${PRICE(p.price_level)}` : ''}</span></li>`);
  const links = join([p.website ? link(p.website, esc(prettyUrl(p.website, 34))) : '', p.maps_url ? link(p.maps_url, 'Google Maps ↗') : ''], ' · ');
  if (links) li.push(`<li>${icon('link', 12)}<span>${links}</span></li>`);
  if (p.phone) li.push(`<li>${icon('globe', 12)}<span>${esc(p.phone)}</span></li>`);
  return li.length ? `<ul class="card-meta">${li.join('')}</ul>` : '';
}
function notes(p, m) {
  const n = p.note || {};
  const rows = NOTE_ORDER.filter(([k]) => n[k]).map(([k, label]) => `<div class="cn ${k === 'why_you' ? 'why' : k}"><h4>${label}</h4><p>${esc(clip(n[k], 420))}</p></div>`);
  const pairs = (n.pairings || []).map((id) => m.places[id]).filter(Boolean);
  if (pairs.length) rows.push(`<div class="cn card-pair"><h4>With</h4><p>${pairs.map((q) => `<b>${esc(q.name)}</b>`).join(', ')}</p></div>`);
  return rows.length ? `<div class="card-notes">${rows.join('')}</div>` : '';
}
function review(p) {
  const r = (p.reviews || [])[0];
  if (!r || !r.text) return '';
  const by = join([r.author ? link(r.author_url, esc(r.author)) : 'A Google Maps user', r.rating ? `${esc(r.rating)}/5` : '', r.when ? esc(r.when) : '', r.url ? link(r.url, 'on Google Maps ↗') : ''], ' · ');
  return `<div class="card-rev"><q>${esc(clip(r.text, 260))}</q><span class="by">${by}</span></div>`;
}
function sources(p) {
  const s = (p.sources || []).filter((x) => x && x.title);
  return s.length ? `<p class="card-src tiny">Sources: ${s.map((x) => `${link(x.url, esc(clip(x.title, 70)))}${x.accessed ? ` (${esc(shortDate(x.accessed))})` : ''}`).join('; ')}.</p>` : '';
}
function card(c, m) {
  const p = c.place;
  const badge = c.n ? `<span class="badge">${c.n}</span>` : `<span class="badge meal">${icon(MEAL_ICON[c.mealKind] || 'fork', 12)}</span>`;
  const gp = c.photo ? p.google_photo : null;
  const credit = gp ? `<figcaption class="photo-credit">Photo${gp.author ? ` by ${link(gp.author_url, esc(clip(gp.author, 60)))}` : ''} · Google Maps</figcaption>` : (p.image && p.image.credit ? `<figcaption class="photo-credit">${esc(p.image.credit)}</figcaption>` : '');
  const img = c.image ? `<figure class="card-fig"><img class="card-img${c.photo ? ' gphoto' : ''}" src="${c.image}" alt="${attr((c.photo ? gp && gp.alt : p.image && p.image.alt) || p.name)}">${credit}</figure>` : '';
  const edit = p.editorial ? `<p class="card-edit">${esc(clip(p.editorial, 240))} <span class="tiny">— Google Maps</span></p>` : '';
  return `<article class="card" id="place-${attr(p.id)}" style="${hueStyle(c.day - 1)}">${img}<div class="card-head">${badge}<div><p class="card-day">Day ${c.day}${p.category ? ` · ${esc(p.category)}` : ''}</p><h3>${esc(p.name)}</h3>${p.tagline ? `<p class="card-tag">${esc(clip(p.tagline, 140))}</p>` : ''}</div></div>${edit}${metaList(p, m)}${notes(p, m)}${review(p)}${sources(p)}</article>`;
}
export function cards(ctx) {
  const { m } = ctx;
  if (!m.cards.length) return '';
  // the place's own image wins; otherwise a Google place photo fetched for this build (credited with its author)
  const pic = (p) => {
    const own = p.image ? ctx.img.resolve(p.image, p.name) : '';
    if (own) return { image: own, photo: false };
    const g = p.google_photo && p.google_photo.src ? ctx.img.resolve(p.google_photo.src, `${p.name} photo`) : '';
    return { image: g, photo: Boolean(g) };
  };
  const items = m.cards.map((c) => card({ ...c, ...pic(c.place) }, m));
  return `<section class="sec sec-cards" data-pg="section" data-folio="The places">
${secHead(`<b>${m.cards.length}</b> places · in order of appearance`, 'The places', 'Numbers match the day timelines')}
<div class="cards" data-pg="cols">${items.join('\n')}</div>
</section>`;
}

// Developed by: LightAISolutions
