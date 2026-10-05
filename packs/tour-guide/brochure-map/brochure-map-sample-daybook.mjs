/**
 * Tour Guide brochure-map — the invented Day book sample (Contract C18 wave 3, WP-18e), for tests and screenshots: the
 * C18 sample's first day (2027-05-13, the Slate Museum morning) as a Day book, with a briefing written at the Day
 * book's caps — eight food lines, eight if-thens, and the order inside the museum.
 * sampleInputDayBook() → sampleInputC18() with options { c18, book: 'day', date: '2027-05-13', briefing } (fresh objects).
 * DAYBOOK_BRIEFING — that briefing (book: "day"); frozen at the top level only, clone it before changing it.
 */
import { sampleInputC18 } from './brochure-map-sample-c18.mjs';

export const DAYBOOK_DATE = '2027-05-13';

export const DAYBOOK_BRIEFING = Object.freeze({
  v: 1, book: 'day', build_id: 'fixture-build-0001',
  days: {
    [DAYBOOK_DATE]: {
      theme: 'The Slate Museum, all of it',
      lead: 'The museum is the day: be at the door for the 10:00 entry and take the galleries in the order below; lunch at the market, dinner at 19:00.',
      key_times: [{ label: 'Train in', time: '08:55' }, { label: 'Museum entry', time: '10:00' }, { label: 'Market closes', time: '14:00' }, { label: 'Dinner', time: '19:00' }],
      contents: 'The Slate Museum in order, then the market',
      inside: {
        'slate-museum': [
          { time: '10:00', text: 'In by the quarry door; lockers on the left' },
          { time: '10:10', text: 'The splitting shed: the 10:15 demonstration' },
          { time: '10:40', text: 'The incline railway gallery, upstairs' },
          { time: '11:10', text: 'The miners’ cottages in the yard' },
          { time: '11:40', text: 'The roof of slates: the view over the river' },
          { text: 'Out through the shop; the café is beside it' }
        ]
      },
      food: [
        { name: 'Station kiosk', dish: 'Coffee and a seeded roll', price: '€4', fits: 'off the train, 09:00' },
        { name: 'Slate Museum café', place: 'slate-museum', dish: 'Barley scone and tea', price: '€5', fits: 'after the museum, about 12:00' },
        { name: 'Copper Market', place: 'copper-market', dish: 'Grilled halloumi flatbread', price: '€8', fits: 'lunch, 13:00–13:45', caveat: 'Cash only; the east arcade stalls close at 14:00.' },
        { name: 'Copper Market, the north stalls', dish: 'Fried courgette flowers', price: '€6', fits: 'lunch, 13:00–13:45' },
        { name: 'Ropewalk Bakery', dish: 'Honey cake', price: '€3', fits: 'the free afternoon' },
        { name: 'Weaver Gallery café', dish: 'Mint tea', price: '€3', fits: 'the free afternoon, until 19:00' },
        { name: 'Quay ice cart', dish: 'Lemon sorbet', price: '€3', fits: 'on the old quay, 17:00' },
        { name: 'Juniper Table', place: 'juniper-table', dish: 'The tasting menu, two courses meat-free on request', price: '€38', fits: 'dinner, 19:00', caveat: 'Booked; be there by 18:55.' }
      ],
      if_then: [
        { if: 'The train is late', then: 'Leave the bags for later and go straight to the museum on Tram 3.' },
        { if: 'You miss the 10:15 demonstration', then: 'The next one is at 11:15; do the cottages first.' },
        { if: 'The incline gallery is full', then: 'Go up to the roof first and come back down to it.' },
        { if: 'It rains on the yard', then: 'Skip the cottages; the covered walk joins the shed to the shop.' },
        { if: 'The market is closing early', then: 'Eat at the museum café and keep the market for the afternoon.' },
        { if: 'Someone is tired after lunch', then: 'Tram 3 back to Quayside Rooms, 22 minutes.' },
        { if: 'It rains in the afternoon', then: 'Weaver Gallery is 3 minutes from Quayside Rooms and open until 19:00.' },
        { if: 'Dinner is running late', then: 'Juniper Table holds the table for 15 minutes; call ahead.' }
      ],
      bail_out: 'After the museum, take Tram 3 back to Quayside Rooms and rest; keep only the 19:00 dinner.',
      why: ['The museum is the day’s one timed entry, so it takes the morning.', 'The galleries go in the order the guides walk them, so you never double back.'],
      kit: {
        weather: { high_c: 21, low_c: 11, rain_pct: 30, note: 'Showers pass quickly.' },
        items: ['The museum QR code on the phone', 'Cash for the market', 'A light layer for the evening'],
        closures: ['Banks closed for Founders Day; trams run a Sunday timetable'],
        not_missing: ['The river lantern walk starts at 20:30, after dinner']
      }
    }
  }
});

/** sampleInputDayBook() → the Day book of the C18 sample's first day (see the file header). */
export function sampleInputDayBook() {
  const s = sampleInputC18();
  s.options = { ...s.options, book: 'day', date: DAYBOOK_DATE, briefing: JSON.parse(JSON.stringify(DAYBOOK_BRIEFING)) };
  return s;
}

// Developed by: LightAISolutions
