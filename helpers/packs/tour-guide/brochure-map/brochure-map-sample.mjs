/**
 * Tour Guide brochure-map — a small invented input (data contract v1) for tests and the coordinator's integration
 * test: a 2-day trip to the invented city of Harrowmere, five places, build-scoped snapshots, estimates, notes and a
 * hand-written Plan (day 1 TRANSIT with lines, day 2 WALK, one Later list with two items, one warning per severity).
 * sampleInput() → { trip, plan, places, notes, snapshots, estimates, options } (fresh objects on every call).
 */
import { directionsUrl, dayUrl } from '../../../kits/maps/lib/maps-urls.mjs';

const BUILD = 'fixture-build-0001', TRIP = 'harrowmere-spring', ON = '2027-04-20';
const LODGE = { id: 'quayside-rooms', name: 'Quayside Rooms', place_id: 'FixtureLodgingQuayside01', lat: 41.5021, lng: 12.3104, address: '2 Ropewalk, Harrowmere', from: '2027-05-13', to: '2027-05-15', check_in: '15:00', check_out: '11:00' };
const P = {
  'slate-museum': ['FixtureSlateMuseum001', 'Slate Museum', 'museum', 41.5062, 12.3188, 'museum highlights'],
  'copper-market': ['FixtureCopperMarket01', 'Copper Market', 'market', 41.5011, 12.3241, 'market browse and lunch'],
  'lark-hill': ['FixtureLarkHill00001', 'Lark Hill', 'viewpoint', 41.5133, 12.3022, 'sunrise walk up'],
  'fennel-park': ['FixtureFennelPark001', 'Fennel Park', 'park', 41.4987, 12.3150, 'lawns and the glasshouse'],
  'ember-hall': ['FixtureEmberHall0001', 'Ember Hall', 'church', 41.5040, 12.3122, 'frescoes']
};
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const lines = (closed, open) => DAYS.map((d) => `${d}: ${closed.includes(d) ? 'Closed' : open}`);
const pt = (slug) => ({ name: P[slug][1], placeId: P[slug][0] });
const home = { name: LODGE.name, placeId: LODGE.place_id };
const src = (url, accessed, title, supports) => ({ url, accessed, ...(title ? { title } : {}), ...(supports ? { supports } : {}) });

function snapshot(slug, content) {
  const [id, name, , lat, lng] = P[slug];
  return { build_id: BUILD, place_id: id, fetched_at: '2027-04-20T08:00:00.000Z', location: { lat, lng }, content: content && { display_name: name, address: `${content.n} ${name} Lane, Harrowmere`, business_status: 'OPERATIONAL', hours: content.hours, current_hours: null, rating: content.rating, review_count: content.count, website: `https://${slug}.example.com/`, maps_uri: `https://maps.example.com/place/${slug}`, time_zone: 'Etc/GMT-2' } };
}
function leg(from, to, mode, depart_at, arrive_at, minutes, distance_m, line) {
  const at = (s) => (s === 'lodging' ? home : pt(s));
  return { from, to, mode, depart_at, arrive_at, minutes, distance_m, source: 'route', maps_url: directionsUrl({ origin: at(from), destination: at(to), travelMode: mode }), ...(line ? { line } : {}) };
}
const stop = (slug, arrive, depart, minutes, window, confidence, extra = {}) => ({ place: slug, place_id: P[slug][0], arrive, depart, minutes, activity: P[slug][5], window, confidence, ...extra });
const solver = (order) => ({ method: 'fixture', matrix_elements: 9, route_calls: 3, cross_check: null, seed: 7, our_order: order });

export function sampleInput() {
  const trip = {
    v: 1, id: TRIP, title: 'Harrowmere in two days', destination: 'Harrowmere', country: 'Brindalia', timezone: 'Etc/GMT-2', locale: 'en-US',
    start_date: '2027-05-13', end_date: '2027-05-14', travelers: ['Traveller A', 'Traveller B'], pace: 'normal', day_start: '09:00', day_end: '19:00',
    lodging: [LODGE], modes: { default: 'TRANSIT', allowed: ['TRANSIT', 'WALK'], by_date: { '2027-05-14': 'WALK' } }, status: 'planned',
    intro: 'A slate-quarry town on a slow river: one museum morning, one hill at sunrise.',
    practical: [{ title: 'Getting around', items: [{ label: 'Tram pass', text: 'Day pass from the tram machines, card only.', url: 'https://transit.example.org/harrowmere/passes' }, 'Carry coins for the river ferry.'] }]
  };
  const places = Object.entries(P).map(([id, [place_id, name, category, , , activity]]) => ({
    v: 1, id, place_id, name, category, tags: [category], activity, priority: id === 'slate-museum' ? 1 : 2, why_fit: `Fixture reason to see ${name}.`,
    status: ['fennel-park', 'ember-hall'].includes(id) ? 'saved-for-later' : 'scheduled',
    ...(id === 'slate-museum' ? { booking: { date: '2027-05-13', time: '10:00', ref: 'FX-1001' }, indoor: true } : {})
  }));
  const snapshots = [
    snapshot('slate-museum', { n: 1, hours: { weekday_descriptions: lines(['Monday'], '9:00 AM – 5:00 PM'), periods: [] }, rating: 4.6, count: 812 }),
    snapshot('copper-market', { n: 2, hours: { weekday_descriptions: lines(['Sunday', 'Monday'], '8:00 AM – 2:00 PM'), periods: [] }, rating: 4.4, count: 530 }),
    snapshot('lark-hill', { n: 3, hours: null, rating: 4.8, count: 210 }),
    snapshot('fennel-park', null),
    snapshot('ember-hall', { n: 5, hours: { weekday_descriptions: lines(['Friday'], '10:00 AM – 4:00 PM'), periods: [] }, rating: 4.5, count: 98 })
  ];
  const est = (slug, min, max, chosen, sources, confidence) => ({ v: 1, place_id: P[slug][0], activity: P[slug][5], category: P[slug][2], range: { min, max }, typical: null, chosen_minutes: chosen, sources, confidence, calibration: null, estimated_on: ON });
  const estimates = [
    est('slate-museum', 90, 150, 120, [src('https://visit.example.org/harrowmere/slate-museum', '2027-04-18', 'Slate Museum — plan your visit'), src('https://blog.example.net/an-hour-in-slate', '2027-04-18')], 'confirmed'),
    est('copper-market', 45, 90, 75, [src('https://guide.example.com/harrowmere#markets', '2027-04-19', 'Harrowmere city guide')], 'single-source'),
    est('lark-hill', 45, 75, 60, [src('https://guide.example.com/harrowmere/', '2027-04-12', 'Harrowmere city guide')], 'single-source')
  ];
  const notes = [
    { v: 1, place_id: P['slate-museum'][0], why_you: 'You like museums with working machines.', what_to_do: 'Start with the splitting shed.', tickets: 'Timed entry, booked for 10:00.', pairings: ['copper-market'], sources: [src('https://visit.example.org/harrowmere/slate-museum/', '2027-04-10', 'Slate Museum — visiting', 'tickets')], last_researched: ON },
    { v: 1, place_id: P['lark-hill'][0], best_time: 'Sunrise; the path faces east.', sources: [src('https://guide.example.com/harrowmere', '2027-04-15', 'Harrowmere city guide', 'best time')], last_researched: ON }
  ];
  const day1 = {
    v: 1, trip_id: TRIP, date: '2027-05-13', build_id: BUILD, mode: 'TRANSIT', lodging_start: LODGE.id, lodging_end: LODGE.id, theme: 'Quarry stone and the copper market',
    stops: [stop('slate-museum', '10:00', '12:00', 120, { open: '09:00', close: '17:00' }, 'confirmed', { booked: 'Timed entry 10:00, booked' }), stop('copper-market', '12:30', '13:45', 75, { open: '08:00', close: '14:00' }, 'single-source')],
    legs: [leg('lodging', 'slate-museum', 'TRANSIT', '09:35', '09:58', 23, 5200, 'Tram 3'), leg('slate-museum', 'copper-market', 'TRANSIT', '12:05', '12:28', 23, 3100, 'Bus 12'), leg('copper-market', 'lodging', 'TRANSIT', '13:50', '14:15', 25, 4100, 'Tram 3')],
    meals: [{ kind: 'lunch', start: '13:00', end: '13:45', at: 'copper-market', note: 'Eat at the stalls.' }],
    free: [{ start: '14:15', end: '19:00', note: 'Rest, or wander the old quay.' }],
    warnings: [{ severity: 'alert', code: 'tight_connection', text: 'Only 5 minutes from the museum to the bus stop.', place: 'slate-museum' }],
    day_url: null, verified_on: ON, solver: solver(['slate-museum', 'copper-market'])
  };
  const day2 = {
    v: 1, trip_id: TRIP, date: '2027-05-14', build_id: BUILD, mode: 'WALK', lodging_start: LODGE.id, lodging_end: LODGE.id,
    stops: [stop('lark-hill', '09:30', '10:30', 60, null, 'unverified')],
    legs: [leg('lodging', 'lark-hill', 'WALK', '09:00', '09:30', 30, 2300), leg('lark-hill', 'lodging', 'WALK', '10:30', '11:00', 30, 2300)],
    meals: [{ kind: 'breakfast', start: '08:00', end: '08:45', at: 'lodging' }], free: [{ start: '11:00', end: '19:00' }],
    warnings: [{ severity: 'info', code: 'hours_unknown', text: 'Opening hours unknown; it is an open hillside.', place: 'lark-hill' }, { severity: 'warn', code: 'closed_day', text: 'Ember Hall is closed on Fridays; saved for later.', place: 'ember-hall' }],
    day_url: dayUrl([home, pt('lark-hill'), home], 'WALK'), verified_on: ON, solver: solver(['lark-hill'])
  };
  const later = [
    { v: 1, trip_id: TRIP, name: "Didn't fit", items: [
      { place: 'ember-hall', place_id: P['ember-hall'][0], reason: 'Closed on Fridays.', code: 'closed_day', added_on: ON, from_date: '2027-05-14' },
      { place: 'fennel-park', place_id: P['fennel-park'][0], reason: '', code: 'day_full', added_on: ON }] },
    { v: 1, trip_id: TRIP, name: 'Next time', items: [] }
  ];
  const plan = { v: 1, build_id: BUILD, trip_id: TRIP, built_on: ON, days: [day1, day2], later, places, budget: { skus: { 'routes.essentials': 5 }, usd_estimate: 0.03, within_ceiling: true }, usage: { matrix_elements: 9, route_calls: 5 } };
  return { trip, plan, places, notes, snapshots, estimates, options: { generator: 'Tour Guide · brochure-map (fixture)' } };
}

// Developed by: LightAISolutions
