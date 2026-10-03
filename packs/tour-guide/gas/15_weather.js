/**
 * Tour Guide pack — the day's weather from Open-Meteo (WP-12b, TG-PHASE-12 §2): the core's only outside call besides
 * Telegram and the routines. Free for non-commercial use, no key, under 10 000 calls a day; data CC BY 4.0, credited
 * "Weather data by Open-Meteo.com" with a link; place names from GeoNames (CC BY 4.0). Decisions: helpers/decisions/WP-12b.md.
 *   tgWxDay(trip, day) → { lines: [escaped html], credit: bool, calls } — one line per town of the day (day.areas, or the
 *   owner's /dates <date> weather <town>), e.g. "☀️ Clear, 9–17 °C (48–63 °F) · rain 10%". Never throws: a missing
 *   country or town, a failed call or an unexpected answer drops the line, never the message.
 *   Settings: tg_geo (coordinates by country|town — GeoNames data, not Google content), tg_weather (one forecast per
 *   town, target date and asking day, plus the attempt marks), tg_weather_town ({ trip: { date: town } }, core only).
 */
var TG_WX = {
  GEO_URL: 'https://geocoding-api.open-meteo.com/v1/search',
  FORECAST_URL: 'https://api.open-meteo.com/v1/forecast',
  CREDIT_URL: 'https://open-meteo.com/',
  GEONAMES_URL: 'https://www.geonames.org/',
  SETTING_GEO: 'tg_geo',
  SETTING_CACHE: 'tg_weather',
  SETTING_TOWN: 'tg_weather_town',
  SETTING_CALLS: 'tg_weather_calls',   // settingIncrDaily counter of outside weather calls (home date)
  AHEAD_DAYS: 15,          // the forecast reaches today + 15 (16 days); a later date says "not available yet"
  RAIN_PCT: 50,            // "Rain likely from HH:00": the first hour from RAIN_FROM_HOUR whose chance reaches this
  RAIN_FROM_HOUR: 6,
  TRIES: 2,                // calls tried per town, date and asking day (a hung or failed call is not retried forever)
  RETRY_MIN: 10,           // …and not again sooner than this (the morning's 15-minute backstop run may try once more)
  MAX_CALLS_PER_DAY: 60,   // a safety cap far under the service's 10 000 a day
  GEO_KEEP: 100,           // cached towns
  CACHE_KEEP: 80,          // cached forecasts and marks
  TOWN_MAX: 60,
  NAME_MAX: 60
};
/** WMO weather codes → [emoji, words]. */
var TG_WX_WMO = {
  0: ['☀️', 'Clear'], 1: ['🌤', 'Mainly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'], 45: ['🌫', 'Fog'], 48: ['🌫', 'Fog'],
  51: ['🌦', 'Light drizzle'], 53: ['🌦', 'Drizzle'], 55: ['🌦', 'Heavy drizzle'], 56: ['🌧', 'Freezing drizzle'], 57: ['🌧', 'Freezing drizzle'],
  61: ['🌦', 'Light rain'], 63: ['🌧', 'Rain'], 65: ['🌧', 'Heavy rain'], 66: ['🌧', 'Freezing rain'], 67: ['🌧', 'Freezing rain'],
  71: ['🌨', 'Light snow'], 73: ['🌨', 'Snow'], 75: ['❄️', 'Heavy snow'], 77: ['🌨', 'Snow grains'],
  80: ['🌦', 'Rain showers'], 81: ['🌧', 'Rain showers'], 82: ['⛈', 'Violent rain showers'], 85: ['🌨', 'Snow showers'], 86: ['🌨', 'Snow showers'],
  95: ['⛈', 'Thunderstorm'], 96: ['⛈', 'Thunderstorm with hail'], 99: ['⛈', 'Thunderstorm with hail']
};

/* ---------------- Settings maps ---------------- */
function _tgWxMap(key) { var v = tgShJson(settingGet(key, ''), {}); return isPlainObject(v) ? v : {}; }
/** Keep the newest `keep` entries (by their `at`). */
function _tgWxPrune(map, keep) {
  var keys = Object.keys(map);
  if (keys.length <= keep) return map;
  keys.sort(function (a, b) { return String((map[b] || {}).at || '') < String((map[a] || {}).at || '') ? -1 : 1; });
  var out = {};
  keys.slice(0, keep).forEach(function (k) { out[k] = map[k]; });
  return out;
}
function _tgWxSave(key, map, keep, note) { settingSet(key, toJson(_tgWxPrune(map, keep)), note); }

/** The town the owner named for one date (/dates <date> weather <town>), or ''. */
function tgWxTown(trip, date) {
  var m = _tgWxMap(TG_WX.SETTING_TOWN)[String(trip)];
  var t = isPlainObject(m) ? m[String(date)] : '';
  return typeof t === 'string' ? t : '';
}
/** Set (town) or clear (town '' / null) the weather town of one date; returns the town stored or ''. */
function tgWxTownSet(trip, date, town) {
  var all = _tgWxMap(TG_WX.SETTING_TOWN), t = typeof town === 'string' ? stripHidden(town).replace(/\s+/g, ' ').trim() : '';
  if (!isPlainObject(all[trip])) all[trip] = {};
  if (t) all[trip][date] = truncate(t, TG_WX.TOWN_MAX); else delete all[trip][date];
  if (!Object.keys(all[trip]).length) delete all[trip];
  settingSet(TG_WX.SETTING_TOWN, toJson(all), 'weather towns the owner set with /dates <date> weather');
  return t ? all[trip][date] : '';
}
/** The towns whose weather the day shows: the owner's town for the date, else the day's areas (1–2), else []. */
function tgWxTowns(trip, day) {
  var own = tgWxTown(trip.slug, day.date);
  if (own) return [own];
  return (Array.isArray(day.areas) ? day.areas : []).filter(function (a) { return typeof a === 'string' && a.trim(); })
    .slice(0, 2).map(function (a) { return truncate(a.trim(), TG_WX.NAME_MAX); });
}

/**
 * /dates <date> weather <town> | clear — the town whose forecast that date shows (≤ 60 characters), kept in the core only;
 * a date of the trip (its dates or a planned day).
 */
function tgWxDatesCmd(ctx, trip, date, rest) {
  var inTrip = tgEnvRealDate(date) && (!!tgDigestDay(trip.slug, date) || (!!trip.start && date >= trip.start && date <= (trip.end || trip.start)));
  if (!inTrip) { ctx.reply(tgCmdDate(date) + ' is not a date of ' + tgCmdTitle(trip) + '. Nothing was saved.'); return; }
  var t = stripHidden(String(rest || '')).replace(/\s+/g, ' ').trim();
  if (!t) {
    var cur = tgWxTown(trip.slug, date);
    ctx.reply('🌤 ' + tgCmdDate(date) + ': ' + (cur ? 'weather for <b>' + tgEscape(cur) + '</b>' : 'weather for the day\'s towns') +
      '. <code>/dates ' + date + ' weather &lt;town&gt;</code> sets it, <code>… weather clear</code> goes back to the day\'s towns.');
    return;
  }
  if (/^clear$/i.test(t)) { tgWxTownSet(trip.slug, date, ''); ctx.reply('🌤 ' + tgCmdDate(date) + ': back to the weather of the day\'s towns.'); return; }
  if (t.length > TG_WX.TOWN_MAX) { ctx.reply('At most ' + TG_WX.TOWN_MAX + ' characters for the town, please. Nothing was saved.'); return; }
  tgWxTownSet(trip.slug, date, t);
  ctx.reply('🌤 Saved: ' + tgCmdDate(date) + ' shows the weather for <b>' + tgEscape(t) + '</b>.');
}

/* ---------------- calls ---------------- */
/** One GET; { code, body } with body the parsed JSON (null when not JSON), or { error } when the fetch threw. */
function _tgWxGet(url) {
  if (settingDailyCount(TG_WX.SETTING_CALLS) >= TG_WX.MAX_CALLS_PER_DAY) return { error: 'daily cap' };
  settingIncrDaily(TG_WX.SETTING_CALLS);
  var res;
  try { res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true }); }
  catch (e) { auditFail('tg_weather_fetch', url.split('?')[0], describeError(e)); return { error: 'fetch' }; }
  var p = safeJsonParse(res.getContentText());
  return { code: res.getResponseCode(), body: p.ok ? p.value : null };
}
function _tgWxNum(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi; }
/** Coordinates of a town in a country, from the cache or the geocoding answer's first result; null when none. */
function tgWxGeo(cc, name, calls) {
  var key = cc + '|' + name.toLowerCase(), cache = _tgWxMap(TG_WX.SETTING_GEO), hit = cache[key];
  if (isPlainObject(hit) && _tgWxNum(hit.lat, -90, 90) && _tgWxNum(hit.lng, -180, 180)) return { lat: hit.lat, lng: hit.lng };
  var url = TG_WX.GEO_URL + '?name=' + encodeURIComponent(name) + '&count=5&language=en&format=json&countryCode=' + cc;
  calls.n++;
  var r = _tgWxGet(url), first = r.body && Array.isArray(r.body.results) ? r.body.results[0] : null;
  if (r.code !== 200 || !isPlainObject(first) || !_tgWxNum(first.latitude, -90, 90) || !_tgWxNum(first.longitude, -180, 180)) {
    if (!r.error) auditFail('tg_weather_geo', cc, { code: r.code || 0, found: !!first });
    return null;
  }
  cache[key] = { lat: first.latitude, lng: first.longitude, at: nowIso() };
  _tgWxSave(TG_WX.SETTING_GEO, cache, TG_WX.GEO_KEEP, 'town coordinates from Open-Meteo geocoding (GeoNames)');
  return { lat: first.latitude, lng: first.longitude };
}
/** The forecast answer → { code, tmax, tmin, pmax, rainFrom } for the date, or null when its shape is not the recorded one. */
function tgWxParse(body, date) {
  if (!isPlainObject(body) || !isPlainObject(body.daily)) return null;
  var d = body.daily, h = isPlainObject(body.hourly) ? body.hourly : {};
  var at0 = function (a) { return Array.isArray(a) && a.length ? a[0] : null; };
  if (at0(d.time) !== date) return null;
  var code = at0(d.weather_code), tmax = at0(d.temperature_2m_max), tmin = at0(d.temperature_2m_min), pmax = at0(d.precipitation_probability_max);
  if (!_tgWxNum(code, 0, 99) || Math.floor(code) !== code || !_tgWxNum(tmax, -90, 70) || !_tgWxNum(tmin, -90, 70) || tmin > tmax) return null;
  if (pmax !== null && !_tgWxNum(pmax, 0, 100)) return null;
  var rainFrom = null;
  if (Array.isArray(h.time) && Array.isArray(h.precipitation_probability)) {
    for (var i = 0; i < h.time.length && i < 48 && !rainFrom; i++) {
      var m = typeof h.time[i] === 'string' ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):00$/.exec(h.time[i]) : null, p = h.precipitation_probability[i];
      if (m && m[1] === date && Number(m[2]) >= TG_WX.RAIN_FROM_HOUR && _tgWxNum(p, 0, 100) && p >= TG_WX.RAIN_PCT) rainFrom = m[2] + ':00';
    }
  }
  return { code: code, tmax: tmax, tmin: tmin, pmax: pmax, rainFrom: rainFrom };
}
/** "☀️ Clear, 9–17 °C (48–63 °F) · rain 10%" or "🌧 Rain likely from 15:00, 8–12 °C (46–54 °F) · rain 80%" (plain text). */
function tgWxLine(f) {
  var w = TG_WX_WMO[f.code] || ['🌡', 'Weather'], F = function (c) { return Math.round(c * 9 / 5 + 32); };
  return (f.rainFrom ? '🌧 Rain likely from ' + f.rainFrom : w[0] + ' ' + w[1]) + ', ' + Math.round(f.tmin) + '–' + Math.round(f.tmax) + ' °C (' +
    F(f.tmin) + '–' + F(f.tmax) + ' °F)' + (f.pmax === null ? '' : ' · rain ' + Math.round(f.pmax) + '%');
}
/**
 * One town's line for one date: { line } | { later: true } (beyond the forecast window) | null (no line). At most one
 * forecast per town, date and asking day (the trip's today): a rehearsal days ahead never stands in for the morning's own.
 * The attempt is marked before the calls, so an execution that dies inside a slow call does not try again and again.
 */
function tgWxForecast(trip, cc, town, date, calls) {
  var tz = tgTripTz(trip), asked = isoDateIn(tz), ahead = tgCmdDaysBetween(asked, date);
  if (ahead === null || ahead > TG_WX.AHEAD_DAYS) return { later: true };
  var key = [cc, town.toLowerCase(), date, asked].join('|'), cache = _tgWxMap(TG_WX.SETTING_CACHE), e = isPlainObject(cache[key]) ? cache[key] : {};
  if (typeof e.line === 'string') return { line: e.line };
  if (e.later) return { later: true };
  if ((e.tries || 0) >= TG_WX.TRIES || (e.last && nowMs() - Date.parse(e.last) < TG_WX.RETRY_MIN * 60000)) return null;
  var keepFrom = isoDateAdd(asked, -1);
  Object.keys(cache).forEach(function (k) { if (String(k.split('|')[3] || '') < keepFrom) delete cache[k]; });   // a cached day has ended
  e.tries = (e.tries || 0) + 1; e.last = nowIso(); e.at = e.last; cache[key] = e;
  _tgWxSave(TG_WX.SETTING_CACHE, cache, TG_WX.CACHE_KEEP, 'day forecasts from Open-Meteo');
  var g = tgWxGeo(cc, town, calls);
  if (!g) return null;
  var url = TG_WX.FORECAST_URL + '?latitude=' + g.lat + '&longitude=' + g.lng +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=precipitation_probability' +
    '&timezone=' + encodeURIComponent(tz) + '&start_date=' + date + '&end_date=' + date;
  calls.n++;
  var r = _tgWxGet(url), f = r.code === 200 ? tgWxParse(r.body, date) : null;
  cache = _tgWxMap(TG_WX.SETTING_CACHE);
  e = isPlainObject(cache[key]) ? cache[key] : e;
  if (r.code === 400 && isPlainObject(r.body) && /out of allowed range/i.test(String(r.body.reason || ''))) e.later = true;
  else if (f) e.line = tgWxLine(f);
  else { if (!r.error) auditFail('tg_weather_forecast', cc, { code: r.code || 0 }); return null; }
  cache[key] = e;
  _tgWxSave(TG_WX.SETTING_CACHE, cache, TG_WX.CACHE_KEEP, 'day forecasts from Open-Meteo');
  return e.later ? { later: true } : { line: e.line };
}
/** The credit the licence asks for, as escaped HTML with https links. */
function tgWxCredit() {
  return '<i>Weather data by <a href="' + TG_WX.CREDIT_URL + '">Open-Meteo.com</a> · places from <a href="' + TG_WX.GEONAMES_URL + '">GeoNames</a></i>';
}
/**
 * The day's weather lines: { lines: [escaped html], credit, calls }. Two towns (a moving day) each get their name in
 * front. A trip without country_code, a day without towns, or any failure gives no lines; never throws.
 */
function tgWxDay(trip, day) {
  var out = { lines: [], credit: false, calls: 0 }, calls = { n: 0 };
  try {
    var cc = String(trip && trip.country_code || '');
    var towns = /^[A-Z]{2}$/.test(cc) && day ? tgWxTowns(trip, day) : [];
    var later = false;
    towns.forEach(function (t) {
      var r = tgWxForecast(trip, cc, t, String(day.date), calls);
      if (r && r.line) { out.lines.push((towns.length > 1 ? '<b>' + tgEscape(t) + '</b>: ' : '') + tgEscape(r.line)); out.credit = true; }
      else if (r && r.later) later = true;
    });
    if (!out.lines.length && later) out.lines.push('🌤 <i>Forecast not available yet</i>');
  } catch (e) {
    auditFail('tg_weather_error', trip && trip.slug || '', describeError(e));
    out.lines = []; out.credit = false;
  }
  out.calls = calls.n;
  return out;
}

// Developed by: LightAISolutions
