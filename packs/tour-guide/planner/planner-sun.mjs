/**
 * Tour Guide planner — sunset without a network call (Contract C11 DayPlan `sunset`). The NOAA Solar Calculator's
 * spreadsheet algorithm (NOAA Global Monitoring Laboratory, "Solar Calculation Details"; after Meeus, Astronomical
 * Algorithms): Julian century → the sun's apparent longitude and declination, the equation of time, and the hour angle at
 * the standard sunset zenith of 90.833° (refraction and the sun's radius). Iterated twice at the computed instant.
 *   sunsetUtcMinutes(date, lat, lng) → minutes after 00:00 UTC of `date` (may be < 0 or ≥ 1440 far from Greenwich), or
 *                                      null when the sun does not set (or does not rise) that day
 *   sunsetLocal(date, lat, lng, timeZone) → 'HH:MM' in the zone, or null
 * `date` is the local calendar date (YYYY-MM-DD) at the place; longitude is positive east.
 */
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
export const SUNSET_ZENITH = 90.833;

function solar(jd) {
  const jc = (jd - 2451545) / 36525;
  const l0 = (((280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360) + 360) % 360;
  const m = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const c = Math.sin(rad(m)) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) + Math.sin(rad(2 * m)) * (0.019993 - 0.000101 * jc) + Math.sin(rad(3 * m)) * 0.000289;
  const omega = 125.04 - 1934.136 * jc;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eqTime = 4 * deg(y * Math.sin(2 * rad(l0)) - 2 * e * Math.sin(rad(m)) + 4 * e * y * Math.sin(rad(m)) * Math.cos(2 * rad(l0))
    - 0.5 * y * y * Math.sin(4 * rad(l0)) - 1.25 * e * e * Math.sin(2 * rad(m)));
  return { decl, eqTime };
}

/** Minutes after 00:00 UTC of `date` at which the sun sets at (lat, lng); null without a sunset. */
export function sunsetUtcMinutes(date, lat, lng) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const jd0 = Date.UTC(y, mo - 1, d) / 86400000 + 2440587.5;   // 00:00 UTC of the date
  let t = 720 - 4 * lng + 360;                                  // first guess: six hours after local solar noon
  for (let i = 0; i < 3; i++) {
    const { decl, eqTime } = solar(jd0 + t / 1440);
    const cosHa = Math.cos(rad(SUNSET_ZENITH)) / (Math.cos(rad(lat)) * Math.cos(rad(decl))) - Math.tan(rad(lat)) * Math.tan(rad(decl));
    if (!(cosHa >= -1 && cosHa <= 1)) return null;           // midnight sun or polar night
    t = 720 - 4 * lng - eqTime + 4 * deg(Math.acos(cosHa));
  }
  return t;
}

/** 'HH:MM' of the sunset in `timeZone` on the local date `date` at (lat, lng); null without a sunset or a bad zone. */
export function sunsetLocal(date, lat, lng, timeZone) {
  const t = sunsetUtcMinutes(date, lat, lng);
  if (t === null) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const ms = Date.UTC(y, mo - 1, d) + Math.round(t) * 60000;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms));
    const g = (k) => parts.find((p) => p.type === k).value;
    return `${g('hour')}:${g('minute')}`;
  } catch { return null; }
}

// Developed by: LightAISolutions
