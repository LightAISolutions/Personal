/**
 * Tour Guide brochure-map — the invented C11 sample (brochure-map-sample-c11.mjs) with Contract C18's sources filled,
 * for tests and screenshots (Phase 18, WP-18b): the Slate Museum's timed entry is a booked trip.bookings record (shown
 * by QR code), Juniper Table's dinner is booked, the Copper Market takes cash only and has a gate, day 1's afternoon
 * window carries the planner's title and two saved places near the lodging (one with a card, one without), day 2 has a
 * breakfast at the lodging, a first leg from it, a check-on-the-day line, and ends at a train with two fallbacks.
 * options: c18 true, the vegetarian diet from the C11 sample.
 * sampleInputC18() → { trip, plan, places, notes, snapshots, estimates, options } (fresh objects on every call).
 * C18_BRIEFING — the matching written briefing (wave 2, WP-18d): options.briefing.
 */
import { sampleInputC11 } from './brochure-map-sample-c11.mjs';

const WEAVER = { id: 'weaver-gallery', place_id: 'FixtureWeaverGallery1', name: 'Weaver Gallery', lat: 41.5010, lng: 12.3090 };
export const C18_FALLBACKS = Object.freeze(['Next train 18:10 from platform 2', 'Last coach 19:40 from the bus station forecourt']);

/** sampleInputC18() → the C11 sample with every C18 source (see the file header). */
export function sampleInputC18() {
  const s = sampleInputC11();
  const { trip, plan } = s;
  const [d1, d2] = plan.days;
  trip.bookings = [
    { id: 'slate-entry', title: 'Slate Museum timed entry', kind: 'sight', rule: 'opens 30 days ahead at 09:00', status: 'booked', place: 'slate-museum', for_date: '2027-05-13', how: 'QR code in the confirmation e-mail' },
    { id: 'juniper-dinner', title: 'Dinner at Juniper Table', kind: 'meal', rule: 'book 2 days ahead by phone', status: 'booked', place: 'juniper-table', for_date: '2027-05-13', how: 'by phone' }
  ];
  trip.day_overrides[1].fallbacks = [...C18_FALLBACKS];
  const market = s.places.find((p) => p.id === 'copper-market');
  market.facts = { ...market.facts, payment: 'Cash only', gate_name: 'the east arcade gate' };
  s.places.push({ v: 1, id: WEAVER.id, place_id: WEAVER.place_id, name: WEAVER.name, category: 'gallery', tags: ['gallery'], activity: 'tapestry rooms', priority: 3, why_fit: 'Fixture reason to see Weaver Gallery.', status: 'saved-for-later' });
  s.snapshots.push({ build_id: plan.build_id, place_id: WEAVER.place_id, fetched_at: '2027-04-20T08:00:00.000Z', location: { lat: WEAVER.lat, lng: WEAVER.lng }, content: { display_name: WEAVER.name, address: '9 Loom Street, Harrowmere', business_status: 'OPERATIONAL', hours: { weekday_descriptions: ['Monday: Closed', 'Tuesday: 11:00 AM – 7:00 PM', 'Wednesday: 11:00 AM – 7:00 PM', 'Thursday: 11:00 AM – 7:00 PM', 'Friday: 11:00 AM – 7:00 PM', 'Saturday: 11:00 AM – 7:00 PM', 'Sunday: Closed'], periods: [2, 3, 4, 5, 6].map((day) => ({ open: { day, hour: 11, minute: 0 }, close: { day, hour: 19, minute: 0 } })) }, rating: 4.3, review_count: 57, website: 'https://weaver-gallery.example.com/', maps_uri: 'https://maps.example.com/place/weaver-gallery', time_zone: 'Etc/GMT-2' } });
  // Day 1: the afternoon back at the lodging, as the planner's C18 pass leaves it (planner-free.mjs).
  d1.free = [{
    start: '14:15', end: '18:45', note: 'Rest, or wander the old quay.', title: 'Free time near Quayside Rooms',
    options: [
      { kind: 'saved', ref: WEAVER.id, name: WEAVER.name, km: 0.2, walk_min: 3, open: 'open until 19:00', note: 'Tapestry rooms upstairs.' },
      { kind: 'later', ref: 'ember-hall', name: 'Ember Hall', km: 0.3, walk_min: 5, open: 'open until 16:00' }
    ]
  }];
  // Day 2: a check-on-the-day line, and the train leg leaves earlier, so "latest safe" differs from the plan.
  d2.stops[0] = { ...d2.stops[0], check_on_day: 'The hill path closes in high wind; check the board at 08:30' };
  const out = d2.legs[d2.legs.length - 1];
  Object.assign(out, { depart_at: '16:30', arrive_at: '16:50' });
  d2.free = [{ start: '11:00', end: '16:30', title: 'Before you leave for Harrowmere Central Station' }];
  s.options = { ...s.options, c18: true };
  return s;
}

/**
 * C18_BRIEFING — an invented written briefing for the sample's two days (Contract C18 wave 2, WP-18d), for tests and
 * screenshots: pass it as options.briefing with options.c18. Every food place has a card, so the merge warns nothing.
 * Frozen at the top level only; clone it before changing it.
 */
export const C18_BRIEFING = Object.freeze({
  v: 1, build_id: 'fixture-build-0001',
  days: {
    '2027-05-13': {
      lead: 'Two fixed points: the 10:00 museum entry and the 19:00 table at Juniper Table. The afternoon between them is yours.',
      key_times: [{ label: 'Train in', time: '08:55' }, { label: 'Museum entry', time: '10:00' }, { label: 'Dinner', time: '19:00' }, { label: 'Sunset', time: '20:12' }],
      contents: 'The museum, the market, a free afternoon',
      food: [
        { name: 'Slate Museum café', place: 'slate-museum', dish: 'Barley scone and tea', price: '€5', fits: 'after the museum, about 12:00' },
        { name: 'Copper Market', place: 'copper-market', dish: 'Grilled halloumi flatbread', price: '€8', fits: 'lunch, 13:00–13:45', caveat: 'Cash only; the east arcade stalls close at 14:00.' },
        { name: 'Juniper Table', place: 'juniper-table', dish: 'The tasting menu, two courses meat-free on request', price: '€38', fits: 'dinner, 19:00', caveat: 'Booked; be there by 18:55.' }
      ],
      if_then: [
        { if: 'The train is late', then: 'Leave the bags for later and go straight to the museum on Tram 3.' },
        { if: 'It rains in the afternoon', then: 'Weaver Gallery is 3 minutes from Quayside Rooms and open until 19:00.' }
      ],
      bail_out: 'After the market, take Tram 3 back to Quayside Rooms and rest; keep only the 19:00 dinner.',
      why: ['The museum takes the morning because it is the only timed entry.', 'Lunch is at the market, so the afternoon starts on the tram home.'],
      kit: {
        weather: { high_c: 21, low_c: 11, rain_pct: 30, note: 'Showers pass quickly.' },
        items: ['A light layer for the evening', 'Cash for the market'],
        closures: ['Banks closed for Founders Day; trams run a Sunday timetable'],
        not_missing: ['The river lantern walk starts at 20:30, after dinner']
      }
    },
    '2027-05-14': {
      theme: 'Lark Hill and the train out',
      lead: 'A short walk up Lark Hill before checkout, then a free afternoon; leave Quayside Rooms by 16:30 for the 17:30 train.',
      key_times: [{ label: 'Breakfast', time: '08:00' }, { label: 'Check out', time: '11:00' }, { label: 'Leave', time: '16:30' }, { label: 'Train', time: '17:30' }],
      contents: 'Lark Hill, then the train',
      if_then: [{ if: 'The hill path is closed for wind', then: 'Walk the old quay instead and keep the same times.' }],
      bail_out: 'Skip the afternoon and wait at the station; the next train is at 18:10.',
      why: ['Lark Hill goes first, before the wind picks up and before checkout.'],
      kit: { weather: { high_c: 20, low_c: 12 }, items: ['Bags packed before breakfast'] }
    }
  }
});

// Developed by: LightAISolutions
