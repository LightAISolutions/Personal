'use strict';
// Shared invented world for the Phase 12 (WP-12b) GAS tests: the trip "Lark Bay" in a zone far from UTC
// (Pacific/Kiritimati, UTC+14 all year), three invented days, the user-assigned country code ZZ, invented stations, and
// Open-Meteo answers in the shapes the coordinator recorded on 2026-10-03 (TG-PHASE-12 §2) with invented values.
// Nothing here is a real place, booking or forecast. Not a test file (no .test.js): the Phase 12 tests require it.
const H = require('./harness/gas-mocks');

const TZ = 'Pacific/Kiritimati';
const TRIP = 'lark-bay';
const CC = 'ZZ';
const DATES = ['2027-06-10', '2027-06-11', '2027-06-12'];
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;
/** The UTC instant (ISO) of a trip-local wall time: the zone is UTC+14 all year. */
function at(date, hhmm) {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, mi) - 14 * 3600e3).toISOString();
}

/** Day 1: a free day (arrival), no stops. */
const day1 = () => ({ date: DATES[0], theme: 'Arrival', stops: [], legs: [], warnings: [], areas: ['Lark Bay'], sunset: '18:50' });

/**
 * Day 2: a full day with every C12 stop field on stop 1, a stop without its own hours (3), and three stops that "running
 * late 30" at 13:00 drops for three different reasons: 4 (last entry 15:15), 5 (closes 17:45), 6 (the booked 19:00
 * dinner). Two train legs carry stations from own access notes.
 */
const day2 = () => ({
  date: DATES[1], theme: 'Shore and harbour', leave_by: '08:45', areas: ['Lark Bay'], sunset: '18:52',
  stops: [
    { n: 1, slug: 'tide-hall', name: 'Tide Hall', arrive: '09:00', depart: '10:30', minutes: 90, maps_url: maps('Tide'), note_line: 'Top floor first.',
      time_style: 'about', check_on_day: 'Check the tide table.', last_entry: '16:00', close: '17:00', local_name: '潮見館',
      address: '1-2 Shore Row, Lark Bay', payment: 'Cash only at the gate', price_line: 'Adults 800 · children free' },
    { n: 2, slug: 'glass-works', name: 'Glass Works', arrive: '11:00', depart: '12:30', minutes: 90, maps_url: maps('Glass'), note_line: '',
      close: '17:30', local_name: 'ガラス工房', address: '7 Kiln Lane, Lark Bay' },
    { n: 3, slug: 'ropewalk', name: 'The Ropewalk', arrive: '13:30', depart: '14:30', minutes: 60, maps_url: maps('Rope'), note_line: '' },
    { n: 4, slug: 'kite-museum', name: 'Kite Museum', arrive: '15:00', depart: '16:00', minutes: 60, maps_url: maps('Kite'), note_line: '',
      last_entry: '15:15', close: '17:00', payment: 'Cards accepted' },
    { n: 5, slug: 'harbour-tower', name: 'Harbour Tower', arrive: '16:30', depart: '17:30', minutes: 60, maps_url: maps('Tower'), note_line: '', close: '17:45' },
    { n: 6, slug: 'sea-steps', name: 'Sea Steps', arrive: '18:00', depart: '18:40', minutes: 40, maps_url: maps('Steps'), note_line: '', close: '21:00' }
  ],
  legs: [
    { from: 'lodging', to: 'tide-hall', mode: 'WALK', minutes: 15 },
    { from: 'tide-hall', to: 'glass-works', mode: 'WALK', minutes: 10 },
    { from: 'glass-works', to: 'ropewalk', mode: 'TRANSIT', minutes: 25, stations: { from: 'Lark Bay', from_line: 'Shore Line', to: 'Old Pier', to_line: 'Shore Line' } },
    { from: 'ropewalk', to: 'kite-museum', mode: 'WALK', minutes: 10 },
    { from: 'kite-museum', to: 'harbour-tower', mode: 'TRANSIT', minutes: 20, stations: { from: 'Old Pier', to: 'Tower Gate' } },
    { from: 'harbour-tower', to: 'sea-steps', mode: 'WALK', minutes: 15 },
    { from: 'sea-steps', to: 'salt-house', mode: 'WALK', minutes: 10 },
    { from: 'salt-house', to: 'lodging', mode: 'WALK', minutes: 20 }
  ],
  warnings: [],
  dinner: { name: 'Salt House', slug: 'salt-house', start: '19:00', end: '20:30', maps_url: maps('Salt'), booking_line: 'Booked for 2 at 19:00.',
    local_name: '塩の家', address: '3 Quay Steps, Lark Bay', payment: 'Cash or card', price_line: 'Set menu 4 500' }
});
/** Day 3: a moving day — two towns, a fixed 17:30 departure, a train leg to the station with its stations. */
const day3 = () => ({
  date: DATES[2], theme: 'On to Fernmoor', leave_by: '09:40', areas: ['Lark Bay', 'Fernmoor'],
  end: { name: 'Fernmoor Station', time: '17:30', maps_url: maps('FernSt') },
  stops: [
    { n: 1, slug: 'cliff-gardens', name: 'Cliff Gardens', arrive: '10:00', depart: '12:00', minutes: 120, maps_url: maps('Cliff'), note_line: '' },
    { n: 2, slug: 'lantern-hall', name: 'Lantern Hall', arrive: '14:00', depart: '16:30', minutes: 150, maps_url: maps('Lantern'), note_line: '', close: '18:00' }
  ],
  legs: [
    { from: 'lodging', to: 'cliff-gardens', mode: 'WALK', minutes: 20 },
    { from: 'cliff-gardens', to: 'lantern-hall', mode: 'DRIVE', minutes: 30 },
    { from: 'lantern-hall', to: 'day-end', mode: 'TRANSIT', minutes: 30, stations: { from: 'Lantern Quay', to: 'Fernmoor' } }
  ],
  warnings: []
});
const days = () => [day1(), day2(), day3()];
/** A whole C12 digest of the trip (one envelope). */
const digest = (over = {}) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-lb-1', verified_on: '2027-05-30', tz: TZ, country_code: CC,
  drive: { plan: 'fixtureDrivePlanFileLB', brochure_html: null, brochure_pdf: null }, days: days(), later: [], ...over });
/** The bookings envelope: the day-2 dinner booked; one sight still to book on day 3. */
const bookings = () => ({ v: 1, kind: 'bookings', trip: TRIP, tz: TZ, bookings: [
  { id: 'salt-house-dinner', title: 'Salt House dinner', kind: 'meal', rule: 'book a week ahead', status: 'booked', place: 'salt-house', for_date: DATES[1] },
  { id: 'lantern-hall-tickets', title: 'Lantern Hall tickets', kind: 'sight', rule: 'timed tickets online', status: 'todo', place: 'lantern-hall', for_date: DATES[2] }
] });

/* ---------------- Open-Meteo answers (recorded shapes, invented values) ---------------- */
const GEO = {
  'lark bay': { id: 9900001, name: 'Lark Bay', latitude: 12.5, longitude: 160.25, elevation: 4, feature_code: 'PPL', country_code: CC, admin1: 'Shore', timezone: TZ, population: 5000 },
  fernmoor: { id: 9900002, name: 'Fernmoor', latitude: 12.75, longitude: 160.5, elevation: 40, feature_code: 'PPL', country_code: CC, admin1: 'Moor', timezone: TZ }
};
/** A forecast answer for one date: weather code, °C min/max, the day's max rain chance, and hourly chances (24). */
function forecast(date, code, tmin, tmax, pmax, hourly) {
  const hours = Array.from({ length: 24 }, (_, h) => date + 'T' + String(h).padStart(2, '0') + ':00');
  return { latitude: 12.5, longitude: 160.25, timezone: TZ, utc_offset_seconds: 50400, daily_units: {},
    daily: { time: [date], weather_code: [code], temperature_2m_max: [tmax], temperature_2m_min: [tmin], precipitation_probability_max: [pmax] },
    hourly_units: {}, hourly: { time: hours, precipitation_probability: hourly || hours.map(() => 10) } };
}
/**
 * A fetch responder for the weather service. byTown: { 'lark bay': (date) => answer | { code, body } }. Telegram and
 * everything else fall through to the harness default. Returns the responder; calls are in state.fetch.requests.
 */
function weather(byTown) {
  return (url) => {
    if (url.startsWith('https://geocoding-api.open-meteo.com/')) {
      const name = decodeURIComponent((/[?&]name=([^&]*)/.exec(url) || [])[1] || '').toLowerCase();
      return { code: 200, body: GEO[name] ? { results: [GEO[name]], generationtime_ms: 0.5 } : { generationtime_ms: 0.5 } };
    }
    if (url.startsWith('https://api.open-meteo.com/')) {
      const lat = Number((/latitude=([^&]*)/.exec(url) || [])[1]), date = (/start_date=([^&]*)/.exec(url) || [])[1];
      const town = Object.keys(GEO).find((k) => GEO[k].latitude === lat);
      const f = byTown && byTown[town] ? byTown[town](date) : null;
      if (f && f.code) return f;
      if (f) return { code: 200, body: f };
      return { code: 400, body: { error: true, reason: "Parameter 'start_date' is out of allowed range from 2027-03-01 to 2027-06-26" } };
    }
    return null;
  };
}
const wxCalls = (state) => state.fetch.requests.filter((r) => /open-meteo\.com/.test(r.url));

/* ---------------- a loaded core ---------------- */
/** A fresh core at `now` with the routines configured and the trip planned (digest + bookings stored). */
function fresh(now, opts = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: now || at(DATES[0], '12:00') });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES'].forEach((n) => H.configureRoutine(ctx, state, n));
  ctx.tgTripUpsert({ slug: TRIP, title: 'Lark Bay', destination: 'Lark Bay', start: DATES[0], end: DATES[2], tz: TZ });
  if (opts.digest !== false) deliver(ctx, state, 'plan_digest', opts.digest || digest());
  if (opts.bookings !== false) deliver(ctx, state, 'bookings', bookings());
  state.fetch.requests.length = 0;
  return { ctx, state };
}
function deliver(ctx, state, type, payload, over) {
  H.putEnvelope(state, H.envelope(type, payload, over));
  return J(ctx.pollFromBrain());
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const tap = (ctx, state, data, extra = {}) => post(ctx, state, H.tgUpdate({ callback: data, ...extra }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const last = (state) => texts(state).pop();
const audits = (ctx, ev) => J(ctx.storeAll('AuditLog')).filter((a) => a.event === ev);
const reqEnvs = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)));
const reqOf = (state, kind) => reqEnvs(state).map((e) => e.payload).filter((r) => r.kind === kind);
const setNow = (ctx, iso) => { ctx.__TEST_NOW = iso; };
/** Every button's callback_data of a sent message's inline keyboard. */
const cbData = (m) => ((m && m.reply_markup && m.reply_markup.inline_keyboard) || []).flat().map((b) => b.callback_data);

/* ---------------- shared checks (WP-12r, the rehearsal) ---------------- */
/**
 * Where any of `needles` is kept: every sheet's cells, Script Properties and logs, every reply sent, and every Drive file
 * except the request files (a request is a shared location's one transport). → ['sheet <name>' | 'props/logs' | 'a reply'
 * | 'drive <path>'], [] when kept nowhere.
 */
function keptAnywhere(state, needles) {
  const hits = [];
  for (const ss of state.spreadsheets.values()) {
    for (const sh of ss.getSheets()) {
      const v = JSON.stringify(sh.getDataRange().getValues());
      needles.forEach((n) => { if (v.includes(n)) hits.push('sheet ' + sh.getName()); });
    }
  }
  const props = JSON.stringify(state.props) + JSON.stringify(state.logs);
  needles.forEach((n) => { if (props.includes(n)) hits.push('props/logs'); });
  texts(state).forEach((t) => needles.forEach((n) => { if (t.includes(n)) hits.push('a reply'); }));
  const walk = (f) => {
    f.files.forEach((x) => { if (!/^req_/.test(x.name)) needles.forEach((n) => { if (x.content.includes(n)) hits.push('drive ' + x.path()); }); });
    f.folders.forEach(walk);
  };
  walk(state.drive.root);
  return hits;
}
/**
 * Today's prefs request shape as /review has sent it since WP-5a: { kind: 'prefs', review: { trip, items } }, items in stop
 * order, each { slug, rating up|down|skipped, calibration? longer|shorter|right (never on skipped) }, ≤ 40, unique.
 * slugs: the trip's stop slugs in order. → [] when it validates, else the problems.
 */
function checkPrefsReview(p, trip, slugs) {
  const errs = [];
  if (!p || p.kind !== 'prefs' || !p.review || p.decisions !== undefined) errs.push('not a review prefs request');
  const r = (p && p.review) || {};
  if (Object.keys(r).sort().join() !== 'items,trip') errs.push('review keys ' + Object.keys(r));
  if (r.trip !== trip) errs.push('trip');
  if (!Array.isArray(r.items) || !r.items.length || r.items.length > 40) errs.push('items');
  const seen = new Set();
  (r.items || []).forEach((it, i) => {
    if (Object.keys(it).some((k) => !['slug', 'rating', 'calibration'].includes(k))) errs.push(i + ' keys');
    if (!slugs.includes(it.slug) || seen.has(it.slug)) errs.push(i + ' slug');
    seen.add(it.slug);
    if (!['up', 'down', 'skipped'].includes(it.rating)) errs.push(i + ' rating');
    if (it.calibration !== undefined && (!['longer', 'shorter', 'right'].includes(it.calibration) || it.rating === 'skipped')) errs.push(i + ' calibration');
  });
  const order = (r.items || []).map((it) => slugs.indexOf(it.slug));
  if (order.some((x, i) => i && x < order[i - 1])) errs.push('order');
  return errs;
}

module.exports = { H, TZ, TRIP, CC, DATES, J, maps, at, day1, day2, day3, days, digest, bookings, GEO, forecast, weather, wxCalls,
  fresh, deliver, post, say, tap, sends, texts, last, audits, reqEnvs, reqOf, setNow, cbData, keptAnywhere, checkPrefsReview };

// Developed by: LightAISolutions
