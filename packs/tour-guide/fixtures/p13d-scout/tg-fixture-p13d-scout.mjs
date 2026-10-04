/**
 * Tour Guide — Phase 13 WP-13d fixtures for the Scout engine (invented data only). Wrenmouth and Gullhaven are
 * invented towns, Old Harbour and Kiln Row invented quarters; every place id, name, date and hour below is made up.
 *
 *   GRAMMAR       the owner's words → parseScoutText's { what, where, city, area } (TG-SCOUT.md §9). `core_same`
 *                 marks a case where the core's acknowledgement parse (`tgScoutParse`) gives the same what / where,
 *                 for the coordinator's parity test; the others are cases the core does not word the same way.
 *   TRIP / CITY   a fourteen-day trip whose last ten days are in Wrenmouth (the searched city), first four in Gullhaven
 *   SHORT_*       a ten-day trip whose Wrenmouth days hold no Monday (a Monday-closed place is closed only elsewhere)
 *   week(...)     a Google `regularOpeningHours` shape
 */
export const GRAMMAR = Object.freeze([
  { text: 'matcha in Wrenmouth', what: 'matcha', where: 'Wrenmouth', city: 'Wrenmouth', area: '', core_same: true },
  { text: '/scout matcha in Wrenmouth', what: 'matcha', where: 'Wrenmouth', city: 'Wrenmouth', area: '', core_same: false },
  { text: '/scout@TourGuideBot yuzu sweets in Wrenmouth', what: 'yuzu sweets', where: 'Wrenmouth', city: 'Wrenmouth', area: '', core_same: false },
  { text: 'matcha near Old Harbour, Wrenmouth', what: 'matcha', where: 'Old Harbour, Wrenmouth', city: 'Wrenmouth', area: 'Old Harbour', core_same: true },
  { text: '/scout ramen near Kiln Row, Old Harbour, Wrenmouth', what: 'ramen', where: 'Kiln Row, Old Harbour, Wrenmouth', city: 'Wrenmouth', area: 'Kiln Row, Old Harbour', core_same: false },
  { text: 'matcha NEAR Old Harbour , Wrenmouth', what: 'matcha', where: 'Old Harbour , Wrenmouth', city: 'Wrenmouth', area: 'Old Harbour', core_same: true },
  { text: 'matcha near Old Harbour', what: 'matcha', where: 'Old Harbour', city: '', area: 'Old Harbour', core_same: true },
  { text: 'ramen near the ferry pier in Wrenmouth', what: 'ramen', where: 'the ferry pier, Wrenmouth', city: 'Wrenmouth', area: 'the ferry pier', core_same: false },
  { text: 'tea ceremony in a temple in Wrenmouth', what: 'tea ceremony in a temple', where: 'Wrenmouth', city: 'Wrenmouth', area: '', core_same: true },
  { text: 'matcha @ Wrenmouth', what: 'matcha', where: 'Wrenmouth', city: 'Wrenmouth', area: '', core_same: true },
  { text: 'matcha@Wrenmouth', what: 'matcha', where: 'Wrenmouth', city: 'Wrenmouth', area: '', core_same: true },
  { text: 'matcha, Wrenmouth', what: 'matcha', where: 'Wrenmouth', city: 'Wrenmouth', area: '', core_same: true },
  { text: 'green tea, matcha near Old Harbour', what: 'green tea, matcha', where: 'Old Harbour', city: '', area: 'Old Harbour', core_same: true },
  { text: 'kelp crisps, seaweed @ Gullhaven', what: 'kelp crisps, seaweed', where: 'Gullhaven', city: 'Gullhaven', area: '', core_same: true },
  { text: 'oysters in Gullhaven, Wren Coast', what: 'oysters', where: 'Gullhaven, Wren Coast', city: 'Gullhaven, Wren Coast', area: '', core_same: true },
  { text: 'oysters in Gullhaven?', what: 'oysters', where: 'Gullhaven', city: 'Gullhaven', area: '', core_same: false },
  { text: 'yuzu', what: 'yuzu', where: '', city: '', area: '', core_same: true },
  { text: '/scout', what: '', where: '', city: '', area: '', core_same: false },
  { text: 'driftwood in', what: 'driftwood in', where: '', city: '', area: '', core_same: true }
]);

export const week = (days, open = 9, close = 18) => ({ periods: days.map((day) => ({ open: { day, hour: open, minute: 0 }, close: { day, hour: close, minute: 0 } })) });
export const EVERYDAY = week([0, 1, 2, 3, 4, 5, 6]);
/** Closed on Mondays, 10:00–16:00 on Sundays, 09:00–18:00 the other days. */
export const MON_CLOSED_SHORT_SUNDAY = { periods: [...week([2, 3, 4, 5, 6]).periods, ...week([0], 10, 16).periods] };

const span = (from, n) => Array.from({ length: n }, (_, i) => new Date(Date.parse(from + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10));
/** Saturday 1 March 2031 … Friday 14 March 2031; Gullhaven for the first four nights' days, Wrenmouth for the last ten. */
export const TRIP = Object.freeze(span('2031-03-01', 14));
export const CITY = Object.freeze(TRIP.slice(4));
/** Saturday 1 … Monday 10 March 2031; Wrenmouth Tuesday 4 … Sunday 9 (no Monday), Gullhaven on both Mondays. */
export const SHORT_TRIP = Object.freeze(span('2031-03-01', 10));
export const SHORT_CITY = Object.freeze(SHORT_TRIP.slice(3, 9));

export const HOTEL = Object.freeze({ label: 'your inn', lat: -37.2, lng: 144.8 });
const at = (km) => ({ latitude: HOTEL.lat + km / 111, longitude: HOTEL.lng });
/** A raw Places (New) result, invented. */
export function rawPlace(id, name, o = {}) {
  const types = o.types || ['cafe'];
  return { id: 'FixtureP13d' + id, displayName: { text: name }, types, primaryType: types[0], rating: o.rating === undefined ? 4.5 : o.rating,
    userRatingCount: o.count === undefined ? 120 : o.count, businessStatus: 'OPERATIONAL', location: at(o.km === undefined ? 0.6 : o.km),
    regularOpeningHours: o.hours === undefined ? EVERYDAY : o.hours, servesVegetarianFood: o.veg };
}

// Developed by: LightAISolutions
