/**
 * Tour Guide journey — checks of the two wave-2 payloads to the prompt's bounds (WP-11f owns the JSON schemas; these
 * are the journey module's own checks, also against the trip's fixed facts).
 *   checkOutline(outline, trip) → [{ path, message }]   (empty = sound)
 *     shape and bounds; every option covers every trip date once, in order; a moving day is `travel` in every option;
 *     a dated booking (trip.bookings place + for_date, a candidate's own booking) is an anchor on its date in every
 *     option; no anchors on a free day; no place anchored on two dates of one option; option keys unique.
 *   checkDayVersions(payload) → [{ path, message }]
 */
import { journeyDays } from './journey-areas.mjs';
import { OUTLINE_KINDS } from '../planner/index.mjs';
import { LIMITS, KEYS } from './journey-text.mjs';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (x, max, min = 1) => typeof x === 'string' && x.length >= min && x.length <= max && x.trim() === x && !/[\r\n]/.test(x);
const nat = (x) => Number.isInteger(x) && x >= 0 && x <= 1440;
const keysOnly = (o, allowed, path, e) => { for (const k of Object.keys(o)) if (!allowed.includes(k)) e(path + '/' + k, 'unknown key'); };
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

export function checkOutline(o, trip) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  if (!isObj(o)) return [{ path: '', message: 'must be an object' }];
  keysOnly(o, ['v', 'kind', 'trip', 'build_id', 'options', 'notes'], '', e);
  if (o.v !== 1) e('/v', 'must be 1');
  if (o.kind !== 'outline') e('/kind', 'must be "outline"');
  if (!str(o.trip, 64) || !SLUG_RE.test(o.trip)) e('/trip', 'must be the trip slug');
  else if (trip && o.trip !== trip.id) e('/trip', `must be ${trip.id}`);
  if (!str(o.build_id, 80) || !/^[A-Za-z0-9_.-]+$/.test(o.build_id)) e('/build_id', 'letters, digits, _ . - (1–80)');
  if (o.notes !== undefined && !str(o.notes, LIMITS.NOTES)) e('/notes', `1–${LIMITS.NOTES} characters`);
  if (!Array.isArray(o.options) || o.options.length < LIMITS.OUTLINES_MIN || o.options.length > LIMITS.OPTIONS_MAX) { e('/options', `${LIMITS.OUTLINES_MIN}–${LIMITS.OPTIONS_MAX} options`); return errs; }
  let days = null;
  try { days = trip ? journeyDays(trip) : null; } catch (err) { e('', `the trip cannot be read: ${err.message}`); }
  const dates = days ? days.map((d) => d.date) : null;
  const moving = new Set(days ? days.filter((d) => d.travel).map((d) => d.date) : []);
  const booked = [];
  if (trip) for (const b of Array.isArray(trip.bookings) ? trip.bookings : []) if (b && b.place && b.for_date && (!dates || dates.includes(b.for_date))) booked.push([b.for_date, b.place]);
  const seenKeys = new Set();
  o.options.forEach((opt, i) => {
    const at = `/options/${i}`;
    if (!isObj(opt)) { e(at, 'must be an object'); return; }
    keysOnly(opt, ['key', 'title', 'gains', 'gives_up', 'days'], at, e);
    if (!KEYS.includes(opt.key)) e(at + '/key', 'A, B or C');
    else if (seenKeys.has(opt.key)) e(at + '/key', `duplicate key ${opt.key}`); else seenKeys.add(opt.key);
    if (!str(opt.title, LIMITS.TITLE)) e(at + '/title', `1–${LIMITS.TITLE} characters`);
    if (!str(opt.gains, LIMITS.GAINS)) e(at + '/gains', `1–${LIMITS.GAINS} characters`);
    if (!str(opt.gives_up, LIMITS.GIVES_UP)) e(at + '/gives_up', `1–${LIMITS.GIVES_UP} characters`);
    if (!Array.isArray(opt.days)) { e(at + '/days', 'must be an array'); return; }
    if (dates && (opt.days.length !== dates.length || opt.days.some((d, j) => !d || d.date !== dates[j]))) e(at + '/days', 'must cover every trip date once, in order');
    const anchoredOn = new Map();
    opt.days.forEach((d, j) => {
      const dp = `${at}/days/${j}`;
      if (!isObj(d)) { e(dp, 'must be an object'); return; }
      keysOnly(d, ['date', 'area', 'kind', 'anchors', 'note'], dp, e);
      if (!DATE_RE.test(d.date || '')) e(dp + '/date', 'YYYY-MM-DD');
      if (!str(d.area, LIMITS.AREA)) e(dp + '/area', `1–${LIMITS.AREA} characters`);
      if (!OUTLINE_KINDS.includes(d.kind)) e(dp + '/kind', OUTLINE_KINDS.join(', '));
      if (moving.has(d.date) && d.kind !== 'travel') e(dp + '/kind', `${d.date} is a moving day: "travel"`);
      if (d.note !== undefined && !str(d.note, LIMITS.NOTE)) e(dp + '/note', `1–${LIMITS.NOTE} characters`);
      if (!Array.isArray(d.anchors) || d.anchors.length > LIMITS.ANCHORS) { e(dp + '/anchors', `an array of at most ${LIMITS.ANCHORS}`); return; }
      if (d.kind === 'free' && d.anchors.length) e(dp + '/anchors', 'a free day has no anchors');
      d.anchors.forEach((a, k) => {
        const ap = `${dp}/anchors/${k}`;
        if (!isObj(a)) { e(ap, 'must be an object'); return; }
        keysOnly(a, ['slug', 'name'], ap, e);
        if (!SLUG_RE.test(a.slug || '')) e(ap + '/slug', 'a place slug');
        if (!str(a.name, LIMITS.NAME)) e(ap + '/name', `1–${LIMITS.NAME} characters`);
        if (anchoredOn.has(a.slug)) e(ap + '/slug', `${a.slug} is also an anchor on ${anchoredOn.get(a.slug)}`); else anchoredOn.set(a.slug, d.date);
      });
    });
    for (const [date, slug] of booked) {
      const day = opt.days.find((d) => d && d.date === date);
      if (day && Array.isArray(day.anchors) && !day.anchors.some((a) => a && a.slug === slug)) e(`${at}/days/${opt.days.indexOf(day)}/anchors`, `the booking for ${slug} on ${date} must be an anchor`);
    }
  });
  return errs;
}

export function checkDayVersions(p) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  if (!isObj(p)) return [{ path: '', message: 'must be an object' }];
  keysOnly(p, ['v', 'kind', 'trip', 'build_id', 'date', 'versions', 'chosen'], '', e);
  if (p.v !== 1) e('/v', 'must be 1');
  if (p.kind !== 'day_versions') e('/kind', 'must be "day_versions"');
  if (!SLUG_RE.test(p.trip || '')) e('/trip', 'must be the trip slug');
  if (!str(p.build_id, 80) || !/^[A-Za-z0-9_.-]+$/.test(p.build_id)) e('/build_id', 'letters, digits, _ . - (1–80)');
  if (!DATE_RE.test(p.date || '')) e('/date', 'YYYY-MM-DD');
  if (!Array.isArray(p.versions) || p.versions.length < LIMITS.VERSIONS_MIN || p.versions.length > LIMITS.OPTIONS_MAX) { e('/versions', `${LIMITS.VERSIONS_MIN}–${LIMITS.OPTIONS_MAX} versions`); return errs; }
  const keys = new Set();
  p.versions.forEach((v, i) => {
    const at = `/versions/${i}`;
    if (!isObj(v)) { e(at, 'must be an object'); return; }
    keysOnly(v, ['key', 'title', 'summary', 'stops', 'walk_minutes', 'transit_minutes', 'spare_minutes', 'bookings', 'leaves_out', 'warnings'], at, e);
    if (!KEYS.includes(v.key) || keys.has(v.key)) e(at + '/key', 'A, B or C, once'); else keys.add(v.key);
    if (!str(v.title, LIMITS.TITLE)) e(at + '/title', `1–${LIMITS.TITLE} characters`);
    if (!str(v.summary, LIMITS.SUMMARY)) e(at + '/summary', `1–${LIMITS.SUMMARY} characters`);
    for (const k of ['walk_minutes', 'transit_minutes', 'spare_minutes']) if (!nat(v[k])) e(`${at}/${k}`, 'whole minutes, 0–1440');
    const list = (name, max, each) => { if (!Array.isArray(v[name]) || v[name].length > max) e(`${at}/${name}`, `an array of at most ${max}`); else v[name].forEach((x, j) => each(x, `${at}/${name}/${j}`)); };
    const ref = (x, path, time) => {
      if (!isObj(x)) { e(path, 'must be an object'); return; }
      keysOnly(x, time ? ['slug', 'name', 'time'] : ['slug', 'name'], path, e);
      if (!SLUG_RE.test(x.slug || '')) e(path + '/slug', 'a place slug');
      if (!str(x.name, LIMITS.NAME)) e(path + '/name', `1–${LIMITS.NAME} characters`);
      if (time && x.time !== undefined && !TIME_RE.test(x.time)) e(path + '/time', 'HH:MM');
    };
    list('stops', LIMITS.STOPS, (x, path) => ref(x, path, true));
    list('leaves_out', LIMITS.LEAVES_OUT, (x, path) => ref(x, path, false));
    list('bookings', LIMITS.BOOKINGS, (x, path) => { if (!str(x, LIMITS.BOOKING)) e(path, `1–${LIMITS.BOOKING} characters`); });
    list('warnings', LIMITS.WARNINGS, (x, path) => { if (!str(x, LIMITS.WARNING)) e(path, `1–${LIMITS.WARNING} characters`); });
  });
  if (p.chosen !== undefined && !keys.has(p.chosen)) e('/chosen', 'one of the version keys');
  return errs;
}

// Developed by: LightAISolutions
