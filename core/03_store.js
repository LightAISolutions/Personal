/**
 * Helpers core — Sheet store. Header-mapped rows; the header row is the schema.
 * Rows are plain objects keyed by header; `_row` is the 1-based sheet row number.
 * Non-primitive values are JSON-stringified on write; Date cells become ISO strings on read.
 */
var _HB_SS_CACHE = null;

function getSpreadsheet() {
  if (_HB_SS_CACHE) return _HB_SS_CACHE;
  var id = getProp(PROP.SHEET_ID);
  if (!id) throw new Error(PROP.SHEET_ID + ' not set — run setup first');
  _HB_SS_CACHE = SpreadsheetApp.openById(id);
  return _HB_SS_CACHE;
}

function allSheetSchemas() {
  var out = {};
  Object.keys(SHEET_HEADERS).forEach(function (n) { out[n] = SHEET_HEADERS[n].slice(); });
  Object.keys(HB_REGISTRY.sheet).forEach(function (n) {
    out[n] = (out[n] || []).concat(HB_REGISTRY.sheet[n].filter(function (h) { return !out[n] || out[n].indexOf(h) < 0; }));
  });
  return out;
}

/** Create every tab + header row; append any missing headers (never reorders or deletes). */
function ensureSheets(ss) {
  ss = ss || getSpreadsheet();
  var schemas = allSheetSchemas();
  var created = [];
  Object.keys(schemas).forEach(function (name) {
    var headers = schemas[name];
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); created.push(name); }
    var existing = sh.getLastRow() >= 1 ? sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0] : [];
    existing = existing.filter(function (h) { return h !== '' && h !== null && h !== undefined; }).map(String);
    if (!existing.length) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      if (sh.setFrozenRows) sh.setFrozenRows(1);
    } else {
      var missing = headers.filter(function (h) { return existing.indexOf(h) < 0; });
      if (missing.length) sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    }
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0 && ss.deleteSheet) { try { ss.deleteSheet(def); } catch (e) { /* ignore */ } }
  return created;
}

function getSheet(name) {
  var sh = getSpreadsheet().getSheetByName(name);
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
function _cellIn(v) { return isDate(v) ? v.toISOString() : v; }

function storeAppend(name, obj) {
  var sh = getSheet(name);
  var headers = sheetHeaders(sh);
  var row = headers.map(function (h) { return _cellOut(obj[h]); });
  sh.appendRow(row);
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
  var headers = sheetHeaders(sh);
  var range = sh.getRange(rowNumber, 1, 1, headers.length);
  var vals = range.getValues()[0];
  Object.keys(patch).forEach(function (k) { var i = headers.indexOf(k); if (i >= 0) vals[i] = _cellOut(patch[k]); });
  range.setValues([vals]);
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
