/**
 * Tour Guide display settings (Phase 18, item 13): how brochures show times and temperatures.
 *   /units            → the current values, one line
 *   /units 24h | 12h  → the clock;  /units c | f | both → temperatures (both may go in one message: /units 12h f)
 * Stored in Settings (tg_units_clock, tg_units_temp); unset or unknown reads as the default, 24 h and both: a traveller
 * reads local timetables in 24 h and thinks in their home unit. tgUnits() → { clock, temp } feeds the app's Settings
 * (settings.get → display, 46_settings_app.js) and the state snapshot (tour_guide.display, 21_sheets.js), from which the
 * private brochure routine passes them to the build. Defaults: helpers/decisions/TG-PHASE-18.md §2.
 */
var TG_UNITS = {
  SET_CLOCK: 'tg_units_clock', SET_TEMP: 'tg_units_temp',
  CLOCKS: ['24h', '12h'], TEMPS: ['c', 'f', 'both'],
  DEF_CLOCK: '24h', DEF_TEMP: 'both'
};
var TG_UNITS_USAGE = 'Usage: /units 24h|12h · /units c|f|both · /units (show them)';

/** → { clock: '24h'|'12h', temp: 'c'|'f'|'both' }, defaults applied. */
function tgUnits() {
  var c = String(settingGet(TG_UNITS.SET_CLOCK, '') || '').trim().toLowerCase(), t = String(settingGet(TG_UNITS.SET_TEMP, '') || '').trim().toLowerCase();
  return { clock: TG_UNITS.CLOCKS.indexOf(c) >= 0 ? c : TG_UNITS.DEF_CLOCK, temp: TG_UNITS.TEMPS.indexOf(t) >= 0 ? t : TG_UNITS.DEF_TEMP };
}
/** "Brochures: 24-hour clock, °C and °F." */
function tgUnitsLine(u) {
  var temp = u.temp === 'c' ? '°C' : u.temp === 'f' ? '°F' : '°C and °F';
  return 'Brochures: ' + (u.clock === '12h' ? '12-hour' : '24-hour') + ' clock, ' + temp + '.';
}
/** One word → { clock } | { temp } | null. Accepts 24/12, 24h/12h, c/f/both, °c/°f. */
function tgUnitsWord(w) {
  var s = String(w || '').toLowerCase().replace(/^°/, '');
  if (s === '24' || s === '24h') return { clock: '24h' };
  if (s === '12' || s === '12h') return { clock: '12h' };
  if (TG_UNITS.TEMPS.indexOf(s) >= 0) return { temp: s };
  return null;
}

registerCommand('/units', function (ctx) {
  var words = String(ctx.args || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) { ctx.reply(tgUnitsLine(tgUnits())); return null; }
  var set = {}, bad = words.length > 2;
  words.forEach(function (w) {
    var p = tgUnitsWord(w);
    if (!p) { bad = true; return; }
    Object.keys(p).forEach(function (k) { if (set[k]) bad = true; set[k] = p[k]; });   // two clocks or two temps: refuse
  });
  if (bad) { ctx.reply(TG_UNITS_USAGE); return null; }   // nothing changed
  if (set.clock) settingSet(TG_UNITS.SET_CLOCK, set.clock, 'owner /units (brochure clock)');
  if (set.temp) settingSet(TG_UNITS.SET_TEMP, set.temp, 'owner /units (brochure temperatures)');
  audit('tg_units', words.join(' '), set);
  ctx.reply(tgUnitsLine(tgUnits()));
  return null;
}, 'brochure clock and temperatures: /units 24h|12h · /units c|f|both');

// Developed by: LightAISolutions
