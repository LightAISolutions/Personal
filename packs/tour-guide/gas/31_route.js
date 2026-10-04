/**
 * Tour Guide pack — /route A → B [walk|transit|drive] over the Apps Script built-in Maps service (owner: WP-5c; plan
 * §5.8 Lane A, fact 8: 1,000 direction queries a day, no API key). Also accepts "->" and " to " between the places.
 *   tgRoute(from, to, mode) → { ok, minutes, distance_m, mode, maps_url, summary, error? }   (mode walk | transit | drive)
 * Results are cached 6 h per (from, to, mode) and the pack stays under TG_ROUTE.MAX_PER_DAY live queries a day.
 * Nothing is stored in the Sheet; Google's addresses and line names are shown to the owner, escaped, and forgotten.
 */
var TG_ROUTE = { MAX_PER_DAY: 200, CACHE_SEC: 21600, ARG_MAX: 200, DEFAULT_MODE: 'transit', COUNTER: 'tg_route_calls' };
var TG_ROUTE_MODES = {
  walk: { maps: 'WALKING', url: 'walking', icon: '🚶', label: 'walk' },
  transit: { maps: 'TRANSIT', url: 'transit', icon: '🚆', label: 'transit' },
  drive: { maps: 'DRIVING', url: 'driving', icon: '🚗', label: 'drive' }
};
var TG_ROUTE_SYNONYMS = { walk: 'walk', walking: 'walk', foot: 'walk', transit: 'transit', train: 'transit', subway: 'transit', metro: 'transit',
  bus: 'transit', public: 'transit', drive: 'drive', driving: 'drive', car: 'drive', taxi: 'drive' };

/** Travel modes the owner may name that Maps here does not offer: a polite refusal instead of a search for "B bike". */
var TG_ROUTE_UNSUPPORTED = /^(bike|bicycle|bicycling|cycling)$/i;   // not boat/ferry: a place name may end in those
function tgRouteMode(s) { var k = String(s || '').toLowerCase().trim(); return Object.prototype.hasOwnProperty.call(TG_ROUTE_SYNONYMS, k) ? TG_ROUTE_SYNONYMS[k] : ''; }

function tgRouteMapsUrl(from, to, mode) {
  var m = TG_ROUTE_MODES[tgRouteMode(mode) || TG_ROUTE.DEFAULT_MODE];
  return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(String(from)) + '&destination=' + encodeURIComponent(String(to)) + '&travelmode=' + m.url;
}

/** "A → B [mode]" → { from, to, mode } or { error }. */
function tgRouteParse(args) {
  var s = String(args || '').replace(/\s+/g, ' ').trim();
  if (!s) return { error: 'usage' };
  var mode = '', words = s.split(' ');
  var lastWord = words[words.length - 1];
  if (words.length >= 2 && TG_ROUTE_UNSUPPORTED.test(lastWord)) return { error: 'mode', mode: lastWord.toLowerCase() };   // WP-6a F
  if (words.length >= 2 && tgRouteMode(lastWord)) {
    mode = tgRouteMode(lastWord); words.pop();
    if (words.length >= 2 && /^by$/i.test(words[words.length - 1])) words.pop();
    s = words.join(' ');
  }
  var m = /^(.+?)\s*(?:→|->|⟶|=>)\s*(.+)$/.exec(s) || /^(.+?)\s+to\s+(.+)$/i.exec(s);
  if (!m) return { error: 'usage' };
  var from = m[1].trim(), to = m[2].trim();
  if (!from || !to) return { error: 'usage' };
  if (from.length > TG_ROUTE.ARG_MAX || to.length > TG_ROUTE.ARG_MAX) return { error: 'too_long' };
  return { from: from, to: to, mode: mode || TG_ROUTE.DEFAULT_MODE };
}

function _tgRouteErr(status) {
  var s = String(status || '');
  if (s === 'ZERO_RESULTS') return 'no_route';
  if (s === 'NOT_FOUND') return 'not_found';
  if (s === 'OVER_QUERY_LIMIT' || /too many times|quota|rate/i.test(s)) return 'quota';
  return s ? truncate(s.toLowerCase().replace(/[^a-z0-9_]+/g, '_'), 40) : 'maps_error';
}
/** Transit: the line names in order ("Line 2 → Harbor Bus 7"); otherwise Google's route summary (a road name). */
function _tgRouteSummary(route, mode) {
  if (mode === 'transit') {
    var lines = [];
    (route.legs || []).forEach(function (l) { (l.steps || []).forEach(function (st) {
      var td = st.transit_details; var ln = td && td.line ? (td.line.short_name || td.line.name || '') : '';
      if (ln && lines[lines.length - 1] !== ln) lines.push(String(ln));
    }); });
    if (lines.length) return 'via ' + lines.slice(0, 6).join(' → ');
    return 'walk the whole way';
  }
  return route.summary ? 'via ' + String(route.summary) : '';
}

/** Directions over the built-in Maps service. Never throws. */
function tgRoute(from, to, mode) {
  var md = tgRouteMode(mode) || TG_ROUTE.DEFAULT_MODE;
  from = String(from || '').trim(); to = String(to || '').trim();
  var base = { ok: false, minutes: null, distance_m: null, mode: md, maps_url: tgRouteMapsUrl(from, to, md), summary: '' };
  if (!from || !to) { base.error = 'usage'; return base; }
  var cache = CacheService.getScriptCache(), key = 'tgroute:' + sha1Hex(from + '|' + to + '|' + md).slice(0, 24);
  var hit = safeJsonParse(cache.get(key) || '');
  if (hit.ok && isPlainObject(hit.value)) { hit.value.cached = true; return hit.value; }
  if (settingDailyCount(TG_ROUTE.COUNTER) >= TG_ROUTE.MAX_PER_DAY) { base.error = 'daily_cap'; return base; }
  var dir;
  try {
    settingIncrDaily(TG_ROUTE.COUNTER);
    var finder = Maps.newDirectionFinder().setOrigin(from).setDestination(to).setMode(Maps.DirectionFinder.Mode[TG_ROUTE_MODES[md].maps]);
    if (md === 'transit') finder.setDepart(nowDate());
    dir = finder.getDirections();
  } catch (e) {
    base.error = _tgRouteErr(describeError(e));
    auditFail('tg_route_error', md, { error: base.error });
    return base;
  }
  if (!dir || dir.status !== 'OK' || !Array.isArray(dir.routes) || !dir.routes.length) { base.error = _tgRouteErr(dir && dir.status); return base; }
  var route = dir.routes[0], sec = 0, meters = 0;
  (route.legs || []).forEach(function (l) { sec += (l.duration && +l.duration.value) || 0; meters += (l.distance && +l.distance.value) || 0; });
  var out = { ok: true, minutes: Math.max(1, Math.round(sec / 60)), distance_m: Math.round(meters), mode: md, maps_url: base.maps_url, summary: truncate(_tgRouteSummary(route, md), 200) };
  try { cache.put(key, toJson(out), TG_ROUTE.CACHE_SEC); } catch (e2) { /* cache full — fine */ }
  return out;
}

function tgRouteDistance(m) { m = +m || 0; return m < 1000 ? m + ' m' : (Math.round(m / 100) / 10) + ' km'; }

/**
 * The owner's words → Maps queries: "hotel" / "lodging" become the current trip's lodging; a place without a comma gets
 * ", <destination>" of the current trip so "Old Port → Fish Market" resolves in the right city.
 */
function tgRouteResolve(place, trip) {
  var p = String(place || '').trim();
  if (!trip) return p;
  if (/^(the )?(hotel|lodging|inn|airbnb|home)$/i.test(p)) {
    var lod = trip.lodging; if (typeof lod === 'string') { var j = safeJsonParse(lod); lod = j.ok ? j.value : null; }
    var tonight = typeof tgLgStayOn === 'function' ? tgLgStayOn(trip, tgTripToday(trip)) || tgLgStays(trip)[0] : null;   // WP-13c
    if (tonight) return String(tonight.text);
    if (lod && lod.text) return String(lod.text);
  }
  var dest = String(trip.destination || '');
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(dest)) dest = dest.replace(/-/g, ' '); // a slug-like destination reads better as words
  if (dest && p.indexOf(',') < 0 && p.toLowerCase().indexOf(dest.toLowerCase()) < 0) return p + ', ' + dest;
  return p;
}

var TG_ROUTE_ERRORS = {
  no_route: 'Google found no {mode} route', not_found: 'Google could not find one of the places', quota: 'the daily Maps quota is used up',
  daily_cap: 'the bot\'s daily route limit is reached', maps_error: 'Maps did not answer'
};
function tgRouteCommand(ctx) {
  var p = tgRouteParse(ctx.args);
  if (p.error === 'mode') { ctx.reply('I can route by walk, transit or drive — not “' + tgEscape(p.mode) + '”. Try <code>/route A → B walk</code>.'); return; }
  if (p.error) { ctx.reply(p.error === 'too_long' ? 'Those place names are too long (≤ ' + TG_ROUTE.ARG_MAX + ' characters each).' : 'Usage: /route A → B [walk|transit|drive] — also "A -> B" or "A to B". Default: transit.'); return; }
  var trip = null;
  try { trip = typeof tgTripCurrent === 'function' ? tgTripCurrent() : null; } catch (e) { trip = null; }
  var from = tgRouteResolve(p.from, trip), to = tgRouteResolve(p.to, trip);
  var r = tgRoute(from, to, p.mode), m = TG_ROUTE_MODES[r.mode];
  var head = '🧭 <b>' + tgEscape(p.from) + '</b> → <b>' + tgEscape(p.to) + '</b>';
  var link = '<a href="' + tgEscape(r.maps_url) + '">Open in Google Maps</a>';
  if (!r.ok) {
    var why = (TG_ROUTE_ERRORS[r.error] || 'Maps answered: ' + r.error).replace('{mode}', m.label);
    var hint = r.error === 'no_route' && r.mode === 'transit' ? '\nGoogle has no transit data in some countries — try <code>/route ' + tgEscape(p.from) + ' → ' + tgEscape(p.to) + ' walk</code>, or open the link.' : '';
    ctx.reply(head + '\n⚠️ ' + tgEscape(why) + '.' + hint + '\n' + link);
    return;
  }
  ctx.reply(head + '\n' + m.icon + ' ' + m.label + ' · <b>' + r.minutes + ' min</b> · ' + tgRouteDistance(r.distance_m) +
    (r.summary ? '\n' + tgEscape(r.summary) : '') + (from !== p.from || to !== p.to ? '\n<i>searched as ' + tgEscape(from) + ' → ' + tgEscape(to) + '</i>' : '') + '\n' + link);
}
registerCommand('/route', tgRouteCommand, 'directions: /route A → B [walk|transit|drive]');

// Developed by: LightAISolutions
