/**
 * Tour Guide brochure-map — the invented sample (brochure-map-sample.mjs) with every Contract C11 field filled, for
 * tests and screenshots: day 1 is a moving day (arrival at a station, bags left at the lodging, a dinner at a real
 * restaurant with its booking rule, sunset and two evening extras); day 2 ends at a departure with the bags carried;
 * places carry researched facts (one stale) and the local-favourite / crowd-magnet flags; the trip has a season sheet
 * (weather, two blooms, events in and out of the trip's dates, one with a non-https link that must be dropped).
 * sampleInputC11() → { trip, plan, places, notes, snapshots, estimates, options } (fresh objects on every call).
 */
import { directionsUrl } from '../../../kits/maps/lib/maps-urls.mjs';
import { sampleInput } from './brochure-map-sample.mjs';

const ON = '2027-04-20';
const STATION = { name: 'Harrowmere Central Station', place_id: 'FixtureStationCentral1', lat: 41.4968, lng: 12.3071 };
const JUNIPER = { id: 'juniper-table', place_id: 'FixtureJuniperTable01', name: 'Juniper Table', lat: 41.5032, lng: 12.3139 };
const src = (url, title, accessed = ON) => ({ url, title, accessed });
const pt = (p) => ({ name: p.name, placeId: p.place_id });

/** Researched facts per place slug (C11 `place.facts`), all invented. */
export const C11_FACTS = {
  'slate-museum': {
    checked: '2027-04-18', sources: [src('https://visit.example.org/harrowmere/slate-museum/hours', 'Slate Museum — hours and tickets')],
    visit_minutes: { min: 90, max: 150 }, last_entry: '16:30', last_entry_note: '30 min before closing', close: '17:00', closed_weekdays: [1],
    booking: { required: true, lead: '1 day ahead', how: 'online' }, price: { text: '€14 adult', includes: 'the splitting-shed demonstration' },
    payment: 'Card only', gate_name: 'Quarry Gate, on Ropewalk'
  },
  'copper-market': {
    checked: '2026-12-01', sources: [src('https://guide.example.com/harrowmere/markets', 'Harrowmere city guide — markets', '2026-12-01')],
    visit_minutes: { min: 45, max: 90 }, closed_weekdays: [0, 1], payment: 'Cash at most stalls'
  },
  'juniper-table': {
    checked: '2027-04-15', sources: [src('https://juniper-table.example.com/visit', 'Juniper Table — book a table'), { url: 'http://insecure.example.com/menu', title: 'Old menu page' }],
    booking: { required: true, party_min: 2, lead: '2 days ahead', how: 'by phone' }, price: { text: '€38 tasting menu', includes: 'bread, water and coffee' },
    payment: 'Card or cash', menu: { checked: '2027-03-01', fits: 'partly', note: 'two meat-free courses on request' }
  }
};
export const C11_FLAGS = { 'copper-market': ['local_favourite'], 'juniper-table': ['local_favourite'], 'slate-museum': ['crowd_magnet'] };

/** The trip's season sheet (C11 `trip.season`). */
export function c11Season() {
  return {
    checked: ON,
    sources: [src('https://weather.example.org/harrowmere/may', 'Harrowmere in May — climate'), src('https://events.example.org/harrowmere/2027', 'What is on in Harrowmere, 2027'), { url: 'http://insecure.example.com/season', title: 'An insecure page' }],
    weather: { text: 'Mild days and cool evenings; showers pass quickly, so carry a light layer.', high_c: 21, low_c: 11, rain_days: 8 },
    bloom: [
      { kind: 'roses', from: '2027-05-10', to: '2027-05-30', status: 'starting', note: 'The first rose beds open on the Fennel Park terraces.', url: 'https://fennel-park.example.com/roses' },
      { kind: 'wisteria', from: '2027-04-20', to: '2027-05-12', status: 'past', note: 'The quay arbours finish just before you arrive.' }
    ],
    events: [
      { id: 'river-lanterns', name: 'River lantern walk', kind: 'light_up', from: '2027-05-12', to: '2027-05-16', start: '20:30', end: '22:00', area: 'Old quay', note: 'Free; lanterns along both banks.', url: 'https://events.example.org/harrowmere/lanterns' },
      { id: 'founders-day', name: 'Founders Day', kind: 'holiday', from: '2027-05-13', to: '2027-05-13', note: 'Banks closed; trams run a Sunday timetable.' },
      { id: 'museum-late', name: 'Slate Museum late opening', kind: 'special_opening', from: '2027-05-14', to: '2027-05-14', start: '18:00', end: '21:00', place: 'slate-museum', url: 'http://insecure.example.com/late' },
      { id: 'spring-fair', name: 'Spring fair', kind: 'festival', from: '2027-05-20', to: '2027-05-22', area: 'Copper Market' }
    ]
  };
}
const leg = (from, to, mode, depart_at, arrive_at, minutes, distance_m, ends, line) => ({ from, to, mode, depart_at, arrive_at, minutes, distance_m, source: 'route', maps_url: directionsUrl({ origin: ends[0], destination: ends[1], travelMode: mode }), ...(line ? { line } : {}) });

/** sampleInputC11() → the sample with every C11 field (see the file header). */
export function sampleInputC11() {
  const s = sampleInput();
  const { trip, plan } = s;
  const lodge = trip.lodging[0], home = pt(lodge), station = pt(STATION);
  trip.season = c11Season();
  trip.day_overrides = [
    { date: '2027-05-13', start: { ...STATION, time: '08:55' }, bags: 'hotel', note: 'Arriving on the early train from the coast.' },
    { date: '2027-05-14', end: { ...STATION, time: '17:30' }, bags: 'carry' }
  ];
  const juniper = { v: 1, id: JUNIPER.id, place_id: JUNIPER.place_id, name: JUNIPER.name, category: 'restaurant', tags: ['restaurant'], activity: 'dinner', priority: 2, why_fit: 'Fixture reason to eat at Juniper Table.', status: 'scheduled' };
  s.places.push(juniper);
  for (const p of s.places) {
    if (C11_FACTS[p.id]) p.facts = structuredClone(C11_FACTS[p.id]);
    if (C11_FLAGS[p.id]) p.flags = [...C11_FLAGS[p.id]];
  }
  s.snapshots.push({ build_id: plan.build_id, place_id: JUNIPER.place_id, fetched_at: '2027-04-20T08:00:00.000Z', location: { lat: JUNIPER.lat, lng: JUNIPER.lng }, content: { display_name: JUNIPER.name, address: '7 Lantern Row, Harrowmere', business_status: 'OPERATIONAL', hours: { weekday_descriptions: ['Monday: Closed', 'Tuesday: 6:00 – 10:30 PM', 'Wednesday: 6:00 – 10:30 PM', 'Thursday: 6:00 – 10:30 PM', 'Friday: 6:00 – 11:00 PM', 'Saturday: 6:00 – 11:00 PM', 'Sunday: Closed'], periods: [] }, rating: 4.7, review_count: 341, website: 'https://juniper-table.example.com/', maps_uri: 'https://maps.example.com/place/juniper-table', time_zone: 'Etc/GMT-2' } });

  const [d1, d2] = plan.days;
  // Day 1: arrival at the station, bags to the lodging, the museum (at opening; it draws crowds), the market, dinner.
  Object.assign(d1, {
    start: { name: STATION.name, time: '08:55' },
    bags: { kind: 'hotel', at: 'lodging', start: '09:15', end: '09:30', text: 'Leave your bags at Quayside Rooms' },
    sunset: '20:12',
    extras: [
      { kind: 'event', ref: 'river-lanterns', name: 'River lantern walk', time: '20:30', km: 0.6, note: 'Free; lanterns along both banks.' },
      { kind: 'saved', ref: 'fennel-park', name: 'Fennel Park', time: '21:00', km: 1.1, note: 'Open late on Thursdays; the rose terraces are just opening.' }
    ]
  });
  d1.legs.unshift(leg('day-start', 'lodging', 'TRANSIT', '09:00', '09:15', 15, 2600, [station, home], 'Tram 5'));
  d1.stops[0] = { ...d1.stops[0], last_entry: '16:30', minutes_source: 'official', crowd_slot: 'opening' };
  d1.stops[1] = { ...d1.stops[1], minutes_source: 'research' };
  d1.meals.push({ kind: 'dinner', start: '19:00', end: '20:30', at: JUNIPER.id, booking: 'Book 2 days ahead by phone · 2 people or more' });
  d1.legs.push(leg('lodging', JUNIPER.id, 'WALK', '18:45', '18:58', 13, 900, [home, pt(JUNIPER)]));
  d1.free = [{ start: '14:15', end: '18:45', note: 'Rest, or wander the old quay.' }];
  // Day 2: the hill at sunrise, then the bags and the train out.
  Object.assign(d2, { end: { name: STATION.name, time: '17:30' }, bags: { kind: 'carry', at: 'lodging', text: 'Check out by 11:00 and carry your bags to the train' }, sunset: '20:13' });
  d2.stops[0] = { ...d2.stops[0], minutes_source: 'estimate', last_entry: undefined };
  d2.legs.push(leg('lodging', 'day-end', 'TRANSIT', '16:50', '17:10', 20, 2600, [home, station], 'Tram 5'));
  d2.free = [{ start: '11:00', end: '16:50' }];
  s.options = { ...s.options, now: '2027-04-21', diet: 'vegetarian' };
  return s;
}

// Developed by: LightAISolutions
