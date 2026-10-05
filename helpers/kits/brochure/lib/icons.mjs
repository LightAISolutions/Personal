/**
 * Brochure kit — inline SVG glyphs (24-unit grid, stroked, currentColor). Hand-drawn here so the document needs
 * no icon font and no image fetch; the star is a filled path. icon(name, size) → markup, '' for unknown names.
 */
const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z';
const PATHS = {
  walk: `<circle cx="13" cy="4" r="1.8"/><path d="M10.5 21l2-6.5-2.5-2 1-5.5 2.5 1 2.5 3.5h2.5M8 13l1.5-5.5 3.5-1.5M13.5 14l2.5 2.5 1.5 4.5" ${S}/>`,
  transit: `<rect x="5" y="3" width="14" height="14" rx="3" ${S}/><path d="M5 11h14M9 17l-1.5 3M15 17l1.5 3" ${S}/><circle cx="9" cy="14" r=".9" fill="currentColor"/><circle cx="15" cy="14" r=".9" fill="currentColor"/>`,
  train: `<rect x="5" y="3" width="14" height="14" rx="3" ${S}/><path d="M5 11h14M9 17l-1.5 3M15 17l1.5 3" ${S}/><circle cx="9" cy="14" r=".9" fill="currentColor"/><circle cx="15" cy="14" r=".9" fill="currentColor"/>`,
  drive: `<path d="M4 13l2-5.5A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.5L20 13v5H4z M4 13h16" ${S}/><circle cx="7.5" cy="15.5" r="1" fill="currentColor"/><circle cx="16.5" cy="15.5" r="1" fill="currentColor"/>`,
  taxi: `<path d="M4 13l2-5.5A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.5L20 13v5H4z M4 13h16 M10 6V4h4v2" ${S}/><circle cx="7.5" cy="15.5" r="1" fill="currentColor"/><circle cx="16.5" cy="15.5" r="1" fill="currentColor"/>`,
  bike: `<circle cx="6" cy="16" r="3.5" ${S}/><circle cx="18" cy="16" r="3.5" ${S}/><path d="M6 16l4-8h5l3 8M10 8l4 8h-5" ${S}/>`,
  ferry: `<path d="M4 15l1.5 3.5h13L20 15l-8-3zM7 12V7h10v5M11 7V4h2v3M3 20c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" ${S}/>`,
  other: `<path d="M5 12h14M13 6l6 6-6 6" ${S}/>`,
  clock: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M12 7v5l3.2 2" ${S}/>`,
  pin: `<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" ${S}/><circle cx="12" cy="10" r="2.3" ${S}/>`,
  globe: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" ${S}/>`,
  ticket: `<path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z" ${S}/><path d="M10 6v12" stroke-dasharray="2 2" ${S}/>`,
  sun: `<circle cx="12" cy="12" r="4" ${S}/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" ${S}/>`,
  access: `<circle cx="12" cy="5" r="1.8" ${S}/><path d="M9 9.5h6.5l-1 5H12M12 9.5v5M8 14a4.5 4.5 0 1 0 7 3.5M15 14.5l2.5 4.5" ${S}/>`,
  skip: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M6 18L18 6" ${S}/>`,
  heart: `<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" ${S}/>`,
  link: `<path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" ${S}/>`,
  fork: `<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-1.5 1-2.5 3-2.5 6.5 0 2 1 3 2.5 3v8.5M16 3v9.5" ${S}/>`,
  cup: `<path d="M5 8h11v6a5 5 0 0 1-10 0zM16 9h2a2.5 2.5 0 0 1 0 5h-2M4 20h13" ${S}/>`,
  free: `<path d="M7 3h10M7 21h10M8 3c0 7 8 7 8 14M16 3c0 7-8 7-8 14" ${S}/>`,
  umbrella: `<path d="M3 12a9 9 0 0 1 18 0zM12 3v-.5M12 12v6.5a2 2 0 0 1-4 0" ${S}/>`,
  bed: `<path d="M3 18V8M3 14h18v4M21 14v-3a2 2 0 0 0-2-2h-9v5M3 11h4a2 2 0 0 1 2 2" ${S}/>`,
  warn: `<path d="M12 4l9 16H3zM12 10v4M12 17.5v.5" ${S}/>`,
  info: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M12 11v6M12 7.5v.5" ${S}/>`,
  book: `<path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z" ${S}/>`,
  star: `<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" fill="currentColor"/>`,
  compass: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M15 9l-2 6-4 2 2-6z" fill="currentColor"/>`,
  arrow: `<path d="M5 12h13M13 7l5 5-5 5" ${S}/>`,
  // Contract C11 (Phase 11): the bag step, the evening box, price and a checked menu
  bag: `<rect x="4" y="8" width="16" height="11" rx="2" ${S}/><path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M8 8v11M16 8v11" ${S}/>`,
  sunset: `<path d="M7 16a5 5 0 0 1 10 0M3 16h18M5 20h14M12 4v4M9.5 6.5L12 4l2.5 2.5M5.2 10.7l1.4 1.4M18.8 10.7l-1.4 1.4" ${S}/>`,
  coin: `<circle cx="12" cy="12" r="8.5" ${S}/><circle cx="12" cy="12" r="5" ${S}/>`,
  check: `<path d="M5 12.5l4.2 4.2L19 7" ${S}/>`,
  // Contract C18 (Phase 18): a field note on a timeline row
  pencil: `<path d="M4 20l1-4.2L16.2 4.6a1.9 1.9 0 0 1 2.7 0l.5.5a1.9 1.9 0 0 1 0 2.7L8.2 19zM14.5 6.3l3.2 3.2M4 20h5" ${S}/>`
};
export const MODE_LABEL = { walk: 'Walk', transit: 'Transit', train: 'Train', drive: 'Drive', taxi: 'Taxi', bike: 'Bike', ferry: 'Ferry', other: 'Travel' };
export const MEAL_ICON = { breakfast: 'cup', coffee: 'cup', lunch: 'fork', snack: 'cup', dinner: 'fork', drinks: 'cup' };

export function icon(name, size = 16, extraClass = '') {
  const p = PATHS[name];
  if (!p) return '';
  return `<svg class="ic ic-${name}${extraClass ? ' ' + extraClass : ''}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${p}</svg>`;
}
/** Five-star row: filled stars for the integer part, a half star when the fraction ≥ .25, outlines for the rest. */
export function stars(rating, size = 11) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  let out = '';
  for (let i = 1; i <= 5; i++) {
    const f = r - i + 1;
    const fill = f >= 0.75 ? 1 : f >= 0.25 ? 0.5 : 0;
    // clip ids repeat across rows on purpose: every "half" clip is the same rectangle, so a duplicate id is harmless
    out += `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${fill === 0.5 ? '<defs><clipPath id="star-half"><rect x="0" y="0" width="12" height="24"/></clipPath></defs>' : ''}<path d="${STAR}" fill="none" stroke="currentColor" stroke-width="1.4"/>${fill ? `<path d="${STAR}" fill="currentColor"${fill === 0.5 ? ' clip-path="url(#star-half)"' : ''}/>` : ''}</svg>`;
  }
  return `<span class="stars" title="${r} out of 5">${out}</span>`;
}

// Developed by: LightAISolutions
