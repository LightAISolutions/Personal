/**
 * Helpers core — Sheet store. Header-mapped rows; the header row is the schema.
 * Rows are plain objects keyed by header; `_row` is the 1-based sheet row number.
 * Non-primitive values are JSON-stringified on write; Date cells become ISO strings on read.
 */
var _HB_SS_CACHE = null, _HB_SCHEMA_SYNCED = false;

function _openSpreadsheet() {
  if (_HB_SS_CACHE) return _HB_SS_CACHE;
  var id = getProp(PROP.SHEET_ID);
  if (!id) throw new Error(PROP.SHEET_ID + ' not set — run setup first');
  _HB_SS_CACHE = SpreadsheetApp.openById(id);
  syncSheetTimeZone(_HB_SS_CACHE);
  return _HB_SS_CACHE;
}
function getSpreadsheet() {
  var ss = _openSpreadsheet();
  if (!_HB_SCHEMA_SYNCED) { _HB_SCHEMA_SYNCED = true; syncSheetSchemas(ss); }
  return ss;
}

/**
 * Keep the Sheet's own time zone on the owner's zone (getTz()). Sheets turns a written "2026-11-17" into a date cell at
 * midnight in the Sheet's zone; read back in another zone that midnight lands on the day before (a Sheet left in the
 * manifest's zone, east of the owner's, shifted every stored date back one day). The serial date itself does not change,
 * so switching the zone fixes cells already written. Runs once per zone: SHEET_TZ records the zone last set.
 */
function syncSheetTimeZone(ss) {
  var tz = getTz();
  if (!tz || getProp(PROP.SHEET_TZ) === tz) return false;
  try {
    if (ss.getSpreadsheetTimeZone() !== tz) ss.setSpreadsheetTimeZone(tz);
    setProp(PROP.SHEET_TZ, tz);
    return true;
  } catch (e) { return false; }
}

function allSheetSchemas() {
  var out = {};
  Object.keys(SHEET_HEADERS).forEach(function (n) { out[n] = SHEET_HEADERS[n].slice(); });
  Object.keys(HB_REGISTRY.sheet).forEach(function (n) {
    out[n] = (out[n] || []).concat(HB_REGISTRY.sheet[n].filter(function (h) { return !out[n] || out[n].indexOf(h) < 0; }));
  });
  return out;
}

/** The registered headers of one tab (core SHEET_HEADERS plus registerSheet columns), or null for a tab nobody registered. */
function sheetSchema(name) {
  var own = Object.prototype.hasOwnProperty, base = own.call(SHEET_HEADERS, name) ? SHEET_HEADERS[name].slice() : null;
  var reg = own.call(HB_REGISTRY.sheet, name) ? HB_REGISTRY.sheet[name] : null;
  if (!base && !reg) return null;
  base = base || [];
  (reg || []).forEach(function (h) { if (base.indexOf(h) < 0) base.push(h); });
  return base;
}
/** A short fingerprint of every registered tab and column; SHEET_SCHEMA records the one last ensured. */
function sheetSchemaHash() {
  var s = toJson(allSheetSchemas()), h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 'v1:' + h.toString(16) + ':' + s.length;
}
/**
 * A deploy that registers a new tab or column never ran ensureSheets: setup ran it once, on the first install, so later tabs
 * were missing and every read or write of them threw (a routine's answer then failed and nobody heard). The first run
 * after each such deploy creates them: SHEET_SCHEMA holds the fingerprint last ensured. A failure is left for the next run
 * (getSheet heals a missing tab on its own meanwhile).
 */
function syncSheetSchemas(ss) {
  if (getProp(PROP.SHEET_SCHEMA) === sheetSchemaHash()) return false;
  try { ensureSheets(ss); return true; } catch (e) { return false; }
}

/**
 * Create every tab + header row; append any missing headers after the last one (never reorders, deletes or overwrites a
 * header — a blank header cell is left alone). Records the schema fingerprint it ensured (SHEET_SCHEMA).
 */
function ensureSheets(ss) {
  ss = ss || _openSpreadsheet();
  var schemas = allSheetSchemas();
  var created = [];
  Object.keys(schemas).forEach(function (name) {
    var headers = schemas[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      try { sh = ss.insertSheet(name); created.push(name); }
      catch (e) { sh = ss.getSheetByName(name); if (!sh) throw e; }   // another run created it a moment ago
    }
    var row = sh.getLastRow() >= 1 ? sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0] : [];
    var existing = [], lastHead = 0;
    row.forEach(function (h, i) { if (h !== '' && h !== null && h !== undefined) { existing.push(String(h)); lastHead = i + 1; } });
    if (!existing.length) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      if (sh.setFrozenRows) sh.setFrozenRows(1);
    } else {
      var missing = headers.filter(function (h) { return existing.indexOf(h) < 0; });
      if (missing.length) sh.getRange(1, lastHead + 1, 1, missing.length).setValues([missing]);
    }
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0 && ss.deleteSheet) { try { ss.deleteSheet(def); } catch (e) { /* ignore */ } }
  setProp(PROP.SHEET_SCHEMA, sheetSchemaHash());
  _HB_SCHEMA_SYNCED = true;
  return created;
}

/**
 * The tab, created first when it is registered but missing (a deploy added it, or someone deleted it): every tab and column
 * is ensured once per run and the repair audited as sheets_healed. A tab nobody registered still throws.
 */
var _HB_HEALED = false;
function _healSheets(ss, ref, missing) {
  if (_HB_HEALED) return false;
  _HB_HEALED = true;
  var created = null, error = '';
  try { created = ensureSheets(ss); } catch (e) { error = describeError(e); }
  try { audit('sheets_healed', ref, { missing: missing, created: created || [], error: error || undefined }, !error); } catch (e2) { /* audit never blocks */ }
  return !error;
}
function getSheet(name) {
  var ss = getSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh && sheetSchema(name)) { _healSheets(ss, name, 'tab'); sh = ss.getSheetByName(name); }
  if (!sh) throw new Error('Sheet tab missing: ' + name + ' (run ensureSheets)');
  return sh;
}
function sheetHeaders(sh) {
  if (sh.getLastRow() < 1) return [];
  return sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
}
function _cellOut(v) {
  if (v === undefined || v === null) return '';
  if (isDate(v)) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}
/**
 * What actually goes to the Sheet: text that Sheets would read as a formula (or as a number / control character)
 * — a leading = + - @ tab or CR — is written as literal text with a leading apostrophe, so chat or page text can never
 * become a live formula (formula injection). A leading apostrophe is escaped too, so it survives the round trip.
 * Sheets hides the apostrophe: reads return the text exactly as written.
 */
var _CELL_ESCAPE_RE = /^[=+\-@\t\r']/;
function _cellEsc(v) { return typeof v === 'string' && _CELL_ESCAPE_RE.test(v) ? "'" + v : v; }
function _cellIn(v) { return isDate(v) ? v.toISOString() : v; }
/**
 * Settings values are text read back as text (settingGet), so every non-empty string goes in literal: Sheets would turn
 * "2026-10-04" into a date cell (read back as an ISO timestamp, so last_daily_date never matched today and the daily jobs
 * ran on every sweep), "09:00" into a time and "TRUE" into a boolean. Numbers stay numbers.
 */
function _cellText(v) { return typeof v === 'string' && v !== '' ? "'" + v : v; }
function _cellWriter(name) { return name === SHEETS.SETTINGS ? _cellText : _cellEsc; }
/**
 * The tab's headers for a write of `obj`: when obj names a registered column the tab lacks (a deploy added it), the
 * columns are ensured first, so a write never drops a registered field. Unregistered keys and `_row` are ignored.
 */
function _headersFor(sh, name, obj) {
  var headers = sheetHeaders(sh), schema = obj ? sheetSchema(name) : null;
  if (!schema) return headers;
  var missing = Object.keys(obj).filter(function (k) { return k.charAt(0) !== '_' && headers.indexOf(k) < 0 && schema.indexOf(k) >= 0; });
  if (!missing.length || !_healSheets(getSpreadsheet(), name, missing)) return headers;
  return sheetHeaders(sh);
}

function storeAppend(name, obj) {
  var sh = getSheet(name);
  var headers = _headersFor(sh, name, obj);
  var row = headers.map(function (h) { return _cellOut(obj[h]); });
  sh.appendRow(row.map(_cellWriter(name)));
  var out = {}; headers.forEach(function (h, i) { out[h] = row[i]; });
  out._row = sh.getLastRow();
  return out;
}
function storeAll(name) {
  var sh = getSheet(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var headers = sheetHeaders(sh);
  var values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var o = { _row: i + 2 };
    var empty = true;
    for (var j = 0; j < headers.length; j++) { o[headers[j]] = _cellIn(values[i][j]); if (o[headers[j]] !== '') empty = false; }
    if (!empty) out.push(o);
  }
  return out;
}
function storeFind(name, pred, limit) {
  var rows = storeAll(name), out = [];
  for (var i = 0; i < rows.length; i++) { if (pred(rows[i])) { out.push(rows[i]); if (limit && out.length >= limit) break; } }
  return out;
}
function storeGet(name, id) { return storeFind(name, function (r) { return String(r.id) === String(id); }, 1)[0] || null; }
function storeUpdate(name, rowNumber, patch) {
  var sh = getSheet(name);
  var headers = _headersFor(sh, name, patch);
  var range = sh.getRange(rowNumber, 1, 1, headers.length);
  var vals = range.getValues()[0];
  Object.keys(patch).forEach(function (k) { var i = headers.indexOf(k); if (i >= 0) vals[i] = _cellOut(patch[k]); });
  range.setValues([vals.map(_cellWriter(name))]);   // every cell, not just the patched ones: reads come back unescaped
  var o = { _row: rowNumber }; headers.forEach(function (h, i) { o[h] = _cellIn(vals[i]); });
  return o;
}
function storeUpdateById(name, id, patch) {
  var r = storeGet(name, id);
  if (!r) return null;
  return storeUpdate(name, r._row, patch);
}
function storeUpsertById(name, obj) {
  var r = storeGet(name, obj.id);
  return r ? storeUpdate(name, r._row, obj) : storeAppend(name, obj);
}
/** Delete rows by 1-based row numbers (processed bottom-up so numbering stays valid). */
function storeDeleteRows(name, rowNumbers) {
  var sh = getSheet(name);
  rowNumbers.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  return rowNumbers.length;
}
function storeCount(name, pred) { return pred ? storeFind(name, pred).length : storeAll(name).length; }

/** Settings tab: small key/value store shared by core + packs (namespace keys: "<pack>:<key>"). */
function settingGet(key, def) {
  var r = storeFind(SHEETS.SETTINGS, function (x) { return x.key === key; }, 1)[0];
  return r ? String(r.value) : (def === undefined ? '' : def);
}
function settingSet(key, value, note) {
  var r = storeFind(SHEETS.SETTINGS, function (x) { return x.key === key; }, 1)[0];
  var patch = { key: key, value: value, updated_at: nowIso(), note: note || (r ? r.note : '') };
  return r ? storeUpdate(SHEETS.SETTINGS, r._row, patch) : storeAppend(SHEETS.SETTINGS, patch);
}
function settingIncrDaily(key) {
  var today = isoDateLocal();
  var cur = settingGet(key, '');
  var parts = cur.split('|');
  var n = (parts[0] === today) ? (parseInt(parts[1], 10) || 0) : 0;
  n += 1;
  settingSet(key, today + '|' + n);
  return n;
}
function settingDailyCount(key) {
  var parts = settingGet(key, '').split('|');
  return parts[0] === isoDateLocal() ? (parseInt(parts[1], 10) || 0) : 0;
}

// Developed by: LightAISolutions
