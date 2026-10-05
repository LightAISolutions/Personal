/**
 * Brochure kit — the season page (Contract C11), placed after the overview: typical weather, the leaf or blossom
 * forecast, the events by date with their links, and the sources with the date checked. Built from the practical
 * page's blocks (`.pblock`), so it reads as part of the same book; long event lists continue in further blocks.
 */
import { esc, clip, join } from '../escape.mjs';
import { shortDate, longDate, dateRange, temperature } from '../format.mjs';
import { secHead, link, clockPlain } from './common.mjs';

export const EVENT_KIND = { light_up: 'Evening light-up', special_opening: 'Special opening', festival: 'Festival', market: 'Market', exhibition: 'Exhibition', performance: 'Performance', holiday: 'Public holiday', closure: 'Closed' };   // C15: + exhibition, performance
export const BLOOM_STATUS = { before: 'not yet', starting: 'starting', peak: 'at its peak', past: 'past its best' };
export const EVENTS_PER_BLOCK = 10;

/** 'Sat Nov 14' or 'Nov 14 – 22' (the short form; the year is on the cover). */
export function dayRange(from, to, locale) {
  if (!to || to === from) return shortDate(from, locale);
  const fmt = (s, o) => { try { return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...o }).formatRange(new Date(from + 'T00:00:00Z'), new Date(s + 'T00:00:00Z')); } catch { return ''; } };
  return fmt(to, { month: 'short', day: 'numeric' }) || `${shortDate(from, locale)} – ${shortDate(to, locale)}`;
}
/** A temperature in the trip's unit (Contract C18 `trip.temp`: c, f or both; °C by default). */
export const temp = (c, unit = 'c') => temperature(c, unit);

function weatherBlock(w, unit) {
  const rows = [Number.isFinite(w.high_c) ? ['Highs', `about ${temp(w.high_c, unit)}`] : null, Number.isFinite(w.low_c) ? ['Lows', `about ${temp(w.low_c, unit)}`] : null, Number.isInteger(w.rain_days) ? ['Rain', `on about ${w.rain_days} ${w.rain_days === 1 ? 'day' : 'days'} a month`] : null].filter(Boolean);
  return `<div class="pblock season-weather"><h3>Weather</h3><p>${esc(clip(w.text, 220))}</p>${rows.length ? `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}</div>`;
}
function bloomBlock(list, locale) {
  const rows = list.map((b) => {
    const when = b.from || b.to ? dayRange(b.from || b.to, b.to || b.from, locale) : '';
    const status = BLOOM_STATUS[b.status] ? `<span class="chip${b.status === 'peak' ? ' hue' : ''} bloom-${b.status}">${BLOOM_STATUS[b.status]}</span>` : '';
    const text = join([when ? esc(when) : '', b.note ? esc(clip(b.note, 180)) : ''], ' · ');
    return `<div><dt>${esc(clip(b.label, 40))}</dt><dd>${status}${text ? `${status ? ' ' : ''}${text}` : ''}${b.url ? ` ${link(b.url, '↗')}` : ''}</dd></div>`;
  });
  return `<div class="pblock season-bloom"><h3>Leaves and blossom</h3><dl>${rows.join('')}</dl></div>`;
}
function eventBlocks(events, locale) {
  const sorted = events.slice().sort((a, b) => a.from.localeCompare(b.from) || (a.start || '').localeCompare(b.start || '') || a.name.localeCompare(b.name));
  const out = [];
  for (let i = 0; i < sorted.length; i += EVENTS_PER_BLOCK) {
    const rows = sorted.slice(i, i + EVENTS_PER_BLOCK).map((e) => {
      const hours = e.start ? `${clockPlain(e.start, locale)}${e.end ? `–${clockPlain(e.end, locale)}` : ''}` : '';
      const meta = join([`<span class="ev-kind ev-${e.kind}">${EVENT_KIND[e.kind] || 'Event'}</span>`, hours ? esc(hours) : '', e.area ? esc(clip(e.area, 80)) : ''], ' · ');
      return `<div><dt>${esc(dayRange(e.from, e.to, locale))}</dt><dd><b>${esc(clip(e.name, 120))}</b>${e.url ? ` ${link(e.url, '↗')}` : ''}<br><span class="ev-meta">${meta}</span>${e.note ? `<br><span class="muted">${esc(clip(e.note, 180))}</span>` : ''}</dd></div>`;
    });
    out.push(`<div class="pblock season-events"><h3>${i === 0 ? 'Events by date' : 'Events, continued'}</h3><dl>${rows.join('')}</dl></div>`);
  }
  return out;
}
function sourcesBlock(list, checked, locale) {
  const items = list.filter((s) => s && s.url).map((s) => `<li class="plain">${link(s.url, esc(clip(s.title || s.url, 120)))}${s.accessed ? ` <span class="muted">· read ${esc(shortDate(s.accessed, locale))}</span>` : ''}</li>`);
  return `<div class="pblock season-src"><h3>Sources</h3><p class="muted">Checked ${esc(longDate(checked, locale))}. Seasons move: check the forecasts again in the week before you go.</p>${items.length ? `<ul>${items.join('')}</ul>` : ''}</div>`;
}

export function season(ctx) {
  const { m, locale } = ctx;
  const s = m.season;
  if (!s) return '';
  const blocks = [s.weather ? weatherBlock(s.weather, m.temp) : '', (s.bloom || []).length ? bloomBlock(s.bloom, locale) : '', ...eventBlocks(s.events || [], locale), sourcesBlock(s.sources || [], s.checked, locale)].filter(Boolean);
  return `<section class="sec sec-season" data-pg="section" data-folio="${esc(clip(s.title || 'The season', 60))}">
${secHead(`<b>${esc(m.trip.destination || m.trip.title)}</b> · ${esc(dateRange(m.trip.start_date, m.trip.end_date, locale))}`, clip(s.title || 'The season', 80), `Checked ${esc(longDate(s.checked, locale))}`)}
${s.lead ? `<p class="lede season-lead" data-pg="block">${esc(clip(s.lead, 240))}</p>` : ''}
<div class="pblocks" data-pg="cols">${blocks.join('\n')}</div>
</section>`;
}

// Developed by: LightAISolutions
