'use strict';
/**
 * Helpers — Apps Script mock harness. Loads helpers/core/*.js (+ a pack's gas/*.js) into a node:vm context with
 * in-memory mocks of the services the core uses: Properties, Cache, Lock, Spreadsheet, Drive, UrlFetch, HtmlService,
 * ContentService, Utilities, ScriptApp (one-off triggers), Session.
 *
 *   const H = require('./harness/gas-mocks');
 *   const { ctx, state } = H.loadGas({ pack: 'hello' });
 *   H.bootstrap(ctx, state);            // token, secrets, owner, Sheet + tabs, mailbox folders
 *   ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text: '/ping' })));
 *   state.fetch.telegram('sendMessage') // → recorded calls
 */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const HELPERS_ROOT = path.resolve(__dirname, '..', '..');
let _ids = 0;
const nid = (p) => `${p}_${(++_ids).toString(36)}${crypto.randomBytes(3).toString('hex')}`;

/* ---------------- Spreadsheet ---------------- */
/** A value as Sheets stores it: a leading apostrophe marks literal text and is dropped; unescaped text starting with = is a formula. */
function sheetsStore(sheet, v) {
  if (typeof v !== 'string') return v;
  if (v.startsWith("'")) return v.slice(1);
  if (v.startsWith('=')) sheet.formulas.push(v);
  return v;
}
class Range {
  constructor(sheet, row, col, numRows, numCols) { Object.assign(this, { sheet, row, col, numRows, numCols }); }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const line = this.sheet.data[this.row - 1 + r] || [];
      out.push(Array.from({ length: this.numCols }, (_, c) => (line[this.col - 1 + c] === undefined ? '' : line[this.col - 1 + c])));
    }
    return out;
  }
  setValues(vals) {
    if (vals.length !== this.numRows || vals.some((v) => v.length !== this.numCols)) throw new Error('setValues: dimension mismatch');
    for (let r = 0; r < this.numRows; r++) {
      const idx = this.row - 1 + r;
      while (this.sheet.data.length <= idx) this.sheet.data.push([]);
      for (let c = 0; c < this.numCols; c++) this.sheet.data[idx][this.col - 1 + c] = sheetsStore(this.sheet, vals[r][c]);
    }
    return this;
  }
  getValue() { return this.getValues()[0][0]; }
  setValue(v) { return this.setValues([[v]]); }
  clearContent() { return this.setValues(Array.from({ length: this.numRows }, () => Array(this.numCols).fill(''))); }
}
class Sheet {
  constructor(ss, name) { this.ss = ss; this.name = name; this.data = []; this.frozen = 0; this.formulas = []; }
  getName() { return this.name; }
  getLastRow() { let last = 0; this.data.forEach((row, i) => { if (row.some((c) => c !== '' && c !== undefined && c !== null)) last = i + 1; }); return last; }
  getLastColumn() { let last = 0; this.data.forEach((row) => row.forEach((c, j) => { if (c !== '' && c !== undefined && c !== null) last = Math.max(last, j + 1); })); return last; }
  getMaxRows() { return Math.max(this.data.length, 1000); }
  getMaxColumns() { return 26; }
  getRange(row, col, numRows = 1, numCols = 1) { if (row < 1 || col < 1) throw new Error('getRange: bad coordinates'); return new Range(this, row, col, numRows, numCols); }
  getDataRange() { const r = this.getLastRow(), c = this.getLastColumn(); return new Range(this, 1, 1, Math.max(1, r), Math.max(1, c)); }
  appendRow(values) { const idx = this.getLastRow(); while (this.data.length < idx) this.data.push([]); this.data[idx] = values.map((v) => sheetsStore(this, v)); return this; }
  deleteRow(r) { this.data.splice(r - 1, 1); return this; }
  deleteRows(r, n) { this.data.splice(r - 1, n); return this; }
  insertRowsAfter() { return this; }
  clear() { this.data = []; return this; }
  setFrozenRows(n) { this.frozen = n; return this; }
  hideSheet() { return this; }
  getSheetId() { return 1; }
  rows() { return this.data; }
}
class Spreadsheet {
  constructor(name) { this.id = nid('ss'); this.name = name; this.sheets = [new Sheet(this, 'Sheet1')]; this.tz = 'America/New_York'; }
  getSpreadsheetTimeZone() { return this.tz; }
  setSpreadsheetTimeZone(tz) { this.tz = tz; }
  getId() { return this.id; }
  getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}`; }
  getName() { return this.name; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { if (this.getSheetByName(n)) throw new Error('sheet exists'); const s = new Sheet(this, n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
}

/* ---------------- Drive ---------------- */
// Drive dates follow the test clock of the most recent loadGas() (set below), so date-based pruning sees test time.
let driveNow = () => Date.now();
const iter = (arr) => { let i = 0; return { hasNext: () => i < arr.length, next: () => { if (i >= arr.length) throw new Error('iterator exhausted'); return arr[i++]; } }; };
class DFile {
  constructor(parent, name, content, mime) { Object.assign(this, { id: nid('file'), parent, name, content: String(content ?? ''), mime: mime || 'text/plain', trashed: false, created: new Date(driveNow()), updated: new Date(driveNow()) }); }
  getId() { return this.id; } getName() { return this.name; } setName(n) { this.name = n; return this; }
  getBlob() { const c = this.content; return { getDataAsString: () => c, getBytes: () => Array.from(Buffer.from(c, 'utf8')), getContentType: () => this.mime }; }
  getSize() { return Buffer.byteLength(this.content, 'utf8'); } getMimeType() { return this.mime; }
  setContent(c) { this.content = String(c); this.updated = new Date(driveNow()); return this; }
  moveTo(folder) { if (this.parent) this.parent.files = this.parent.files.filter((f) => f !== this); this.parent = folder; folder.files.push(this); return this; }
  setTrashed(b) { this.trashed = !!b; return this; } isTrashed() { return this.trashed; }
  getUrl() { return `https://drive.google.com/file/d/${this.id}`; } getDateCreated() { return this.created; } getLastUpdated() { return this.updated; }
  getParents() { return iter(this.parent ? [this.parent] : []); }
  path() { return (this.parent ? this.parent.path() + '/' : '') + this.name; }
}
class DFolder {
  constructor(parent, name) { Object.assign(this, { id: nid('folder'), parent, name, folders: [], files: [], trashed: false, created: new Date(driveNow()) }); }
  getId() { return this.id; } getName() { return this.name; } getUrl() { return `https://drive.google.com/drive/folders/${this.id}`; }
  getFolders() { return iter(this.folders.filter((f) => !f.trashed)); }
  getFoldersByName(n) { return iter(this.folders.filter((f) => !f.trashed && f.name === n)); }
  getFiles() { return iter(this.files.filter((f) => !f.trashed)); }
  getFilesByName(n) { return iter(this.files.filter((f) => !f.trashed && f.name === n)); }
  createFolder(n) { const f = new DFolder(this, n); this.folders.push(f); return f; }
  createFile(a, b, c) { const f = typeof a === 'string' ? new DFile(this, a, b, c) : new DFile(this, a.getName ? a.getName() : 'blob', a.getDataAsString ? a.getDataAsString() : '', a.getContentType ? a.getContentType() : ''); this.files.push(f); return f; }
  moveTo(folder) { if (this.parent) this.parent.folders = this.parent.folders.filter((f) => f !== this); this.parent = folder; folder.folders.push(this); return this; }
  setTrashed(b) { this.trashed = !!b; return this; } isTrashed() { return this.trashed; } getDateCreated() { return this.created; }
  getParents() { return iter(this.parent ? [this.parent] : []); }
  path() { return this.parent ? this.parent.path() + '/' + this.name : ''; }
}
function driveState() {
  const root = new DFolder(null, '');
  const all = (f, acc) => { acc.folders.set(f.id, f); f.files.forEach((x) => acc.files.set(x.id, x)); f.folders.forEach((c) => all(c, acc)); return acc; };
  const index = () => all(root, { folders: new Map(), files: new Map() });
  return {
    root,
    findFolder(p) { let f = root; for (const part of p.split('/').filter(Boolean)) { f = f.folders.find((x) => x.name === part && !x.trashed); if (!f) return null; } return f; },
    ensureFolder(p) { let f = root; for (const part of p.split('/').filter(Boolean)) { let c = f.folders.find((x) => x.name === part && !x.trashed); if (!c) c = f.createFolder(part); f = c; } return f; },
    putFile(p, name, content, mime = 'application/json') { return this.ensureFolder(p).createFile(name, content, mime); },
    listFiles(p) { const f = this.findFolder(p); return f ? f.files.filter((x) => !x.trashed).map((x) => x.name) : null; },
    readFile(p, name) { const f = this.findFolder(p); const x = f && f.files.find((y) => y.name === name && !y.trashed); return x ? x.content : null; },
    folderById(id) { return index().folders.get(id) || null; },
    fileById(id) { return index().files.get(id) || null; }
  };
}

/* ---------------- Utilities.formatDate ---------------- */
function formatDate(date, tz, fmt) {
  const d = new Date(date.getTime ? date.getTime() : date);
  const parts = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short' })
    .formatToParts(d).forEach((p) => { parts[p.type] = p.value; });
  const H = parseInt(parts.hour, 10) % 24, h12 = H % 12 === 0 ? 12 : H % 12;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const M = parseInt(parts.month, 10);
  const map = { yyyy: parts.year, yy: parts.year.slice(2), MMMM: months[M - 1], MMM: months[M - 1], MM: parts.month, M: String(M), dd: parts.day, d: String(parseInt(parts.day, 10)),
    EEEE: parts.weekday, EEE: parts.weekday, HH: String(H).padStart(2, '0'), H: String(H), hh: String(h12).padStart(2, '0'), h: String(h12), mm: parts.minute, m: String(parseInt(parts.minute, 10)),
    ss: parts.second, s: String(parseInt(parts.second, 10)), a: H < 12 ? 'AM' : 'PM', SSS: String(d.getMilliseconds()).padStart(3, '0'), z: tz || 'UTC', Z: '+0000' };
  return String(fmt).replace(/'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|m|ss|s|a|SSS|z|Z/g, (t, lit) => (lit !== undefined ? lit : map[t]));
}

/* ---------------- Context factory ---------------- */
let _last = null; // { ctx, state } of the most recent loadGas(); envelope()/putEnvelope() default to it
function createMocks(opts = {}) {
  _last = null; // envelope()/putEnvelope() fall back to wall time and 'Helper' until the next loadGas() (WP-6a R4)
  // opts.state: reuse a previous load's state (props, Sheet, Drive, fetch log) so a second context behaves like a fresh
  // Apps Script execution against the same stored data — used to test that state survives a new execution.
  const state = opts.state || {
    props: {}, userProps: {}, cache: new Map(), logs: [], triggers: [], spreadsheets: new Map(),
    drive: driveState(), lock: { busy: false, acquired: 0 },
    fetch: { requests: [], responder: null, tgMessageId: 100 },
    tz: opts.tz || 'Etc/UTC',
    now: () => (sandbox.__TEST_NOW ? new Date(sandbox.__TEST_NOW).getTime() : Date.now())
  };
  driveNow = () => state.now();
  state.fetch.telegram = (method) => state.fetch.requests.filter((r) => /api\.telegram\.org/.test(r.url) && (!method || r.url.endsWith('/' + method)));
  state.fetch.lastTelegramText = () => { const c = state.fetch.telegram('sendMessage'); return c.length ? c[c.length - 1].json.text : null; };
  state.fetch.routine = () => state.fetch.requests.filter((r) => /api\.anthropic\.com|\/fire\b/.test(r.url));
  const propsStore = (obj) => ({
    getProperty: (k) => (Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : null), setProperty(k, v) { obj[k] = String(v); return this; },
    deleteProperty(k) { delete obj[k]; return this; }, getProperties: () => ({ ...obj }), getKeys: () => Object.keys(obj),
    setProperties(o, del) { if (del) Object.keys(obj).forEach((k) => delete obj[k]); Object.assign(obj, o); return this; }, deleteAllProperties() { Object.keys(obj).forEach((k) => delete obj[k]); return this; }
  });
  const cache = {
    get: (k) => { const e = state.cache.get(k); if (!e) return null; if (e.exp < state.now()) { state.cache.delete(k); return null; } return e.v; },
    put: (k, v, ttl = 600) => { state.cache.set(k, { v: String(v), exp: state.now() + ttl * 1000 }); },
    remove: (k) => state.cache.delete(k), removeAll: (ks) => ks.forEach((k) => state.cache.delete(k)),
    getAll: (ks) => Object.fromEntries(ks.map((k) => [k, cache.get(k)]).filter((x) => x[1] !== null)), putAll: (o, ttl) => Object.keys(o).forEach((k) => cache.put(k, o[k], ttl))
  };
  const lock = { tryLock: () => { if (state.lock.busy) return false; state.lock.busy = true; state.lock.acquired++; return true; },
    waitLock: () => { if (state.lock.busy) throw new Error('Lock timeout'); state.lock.busy = true; state.lock.acquired++; }, releaseLock: () => { state.lock.busy = false; }, hasLock: () => state.lock.busy };
  const response = (code, body, headers = {}) => ({ getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)), getHeaders: () => headers, getAllHeaders: () => headers, getBlob: () => ({ getDataAsString: () => body }) });
  const defaultResponder = (url, options) => {
    if (/api\.telegram\.org/.test(url)) {
      const method = url.split('/').pop();
      if (method === 'getMe') return response(200, { ok: true, result: { id: 1, is_bot: true, username: 'helper_test_bot' } });
      if (method === 'sendMessage' || method === 'editMessageText') return response(200, { ok: true, result: { message_id: ++state.fetch.tgMessageId, chat: { id: 1 }, text: options.json && options.json.text } });
      if (method === 'getFile') return response(200, { ok: true, result: { file_id: options.json.file_id, file_path: 'voice/file_1.oga' } });
      return response(200, { ok: true, result: true });
    }
    if (/api\.anthropic\.com/.test(url)) return response(200, { id: 'run_test', status: 'queued' });
    return response(200, '{}');
  };
  const trigger = (fn, spec) => ({ id: nid('trg'), fn, spec, getHandlerFunction: () => fn, getUniqueId() { return this.id; }, getTriggerSource: () => 'CLOCK', getEventType: () => 'CLOCK' });
  const digest = (alg, value) => { const algo = { MD5: 'md5', SHA_1: 'sha1', SHA_256: 'sha256', SHA_512: 'sha512' }[alg] || 'sha1'; return Array.from(crypto.createHash(algo).update(String(value), 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)); };
  const toBuf = (d) => (typeof d === 'string' ? Buffer.from(d, 'utf8') : Buffer.from(d.map((b) => (b < 0 ? b + 256 : b))));
  const blob = (data, contentType, name) => ({ getDataAsString: () => (typeof data === 'string' ? data : toBuf(data).toString('utf8')), getBytes: () => Array.from(toBuf(data)), getContentType: () => contentType || 'application/octet-stream', getName: () => name || null, setName(n) { name = n; return this; } });

  const sandbox = {
    __TEST_NOW: opts.now || null,
    console: { log: (...a) => state.logs.push(a.join(' ')), warn: (...a) => state.logs.push(a.join(' ')), error: (...a) => state.logs.push(a.join(' ')), info: (...a) => state.logs.push(a.join(' ')) },
    Logger: { log: (...a) => state.logs.push(a.join(' ')), getLog: () => state.logs.join('\n'), clear: () => { state.logs.length = 0; } },
    SpreadsheetApp: {
      create: (name) => { const ss = new Spreadsheet(name); state.spreadsheets.set(ss.id, ss); return ss; },
      openById: (id) => { const ss = state.spreadsheets.get(id); if (!ss) throw new Error('Spreadsheet not found: ' + id); return ss; },
      getActiveSpreadsheet: () => null, flush() {}
    },
    DriveApp: {
      getRootFolder: () => state.drive.root,
      getFolderById: (id) => { const f = state.drive.folderById(id); if (!f) throw new Error('Folder not found: ' + id); return f; },
      getFileById: (id) => { const f = state.drive.fileById(id); if (!f) throw new Error('File not found: ' + id); return f; },
      createFile: (a, b, c) => state.drive.root.createFile(a, b, c), createFolder: (n) => state.drive.root.createFolder(n),
      getFiles: () => state.drive.root.getFiles(), getFolders: () => state.drive.root.getFolders()
    },
    UrlFetchApp: {
      fetch(url, options = {}) {
        let json = null; try { json = options.payload ? JSON.parse(options.payload) : null; } catch (e) { /* not json */ }
        const rec = { url, options, json, method: (options.method || 'get').toLowerCase(), headers: options.headers || {} };
        state.fetch.requests.push(rec);
        const r = state.fetch.responder ? state.fetch.responder(url, rec) : null;
        if (r) return r.getResponseCode ? r : response(r.code || 200, r.body === undefined ? '' : r.body, r.headers);
        return defaultResponder(url, rec);
      },
      fetchAll: (reqs) => reqs.map((r) => sandbox.UrlFetchApp.fetch(r.url, r)),
      getRequest: (url, options) => ({ url, ...options })
    },
    PropertiesService: { getScriptProperties: () => propsStore(state.props), getUserProperties: () => propsStore(state.userProps), getDocumentProperties: () => propsStore({}) },
    CacheService: { getScriptCache: () => cache, getUserCache: () => cache, getDocumentCache: () => cache },
    LockService: { getScriptLock: () => lock, getUserLock: () => lock, getDocumentLock: () => lock },
    HtmlService: {
      createHtmlOutput: (html = '') => { const o = { __type: 'html', content: String(html), title: '', getContent() { return this.content; }, setTitle(t) { this.title = t; return this; }, setXFrameOptionsMode() { return this; }, append(s) { this.content += s; return this; }, setSandboxMode() { return this; } }; return o; },
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' }, SandboxMode: { IFRAME: 'IFRAME' }
    },
    ContentService: {
      createTextOutput: (text = '') => ({ __type: 'text', content: String(text), mime: 'TEXT', getContent() { return this.content; }, setMimeType(m) { this.mime = m; return this; }, getMimeType() { return this.mime; }, append(s) { this.content += s; return this; } }),
      MimeType: { JSON: 'JSON', TEXT: 'TEXT', JAVASCRIPT: 'JAVASCRIPT', CSV: 'CSV', XML: 'XML' }
    },
    Utilities: {
      formatDate, getUuid: () => crypto.randomUUID(), computeDigest: (alg, value) => digest(alg, value),
      computeHmacSha256Signature: (value, key) => Array.from(crypto.createHmac('sha256', toBuf(key)).update(toBuf(value)).digest()).map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { MD5: 'MD5', SHA_1: 'SHA_1', SHA_256: 'SHA_256', SHA_512: 'SHA_512' }, Charset: { UTF_8: 'UTF_8', US_ASCII: 'US_ASCII' },
      base64Encode: (d) => toBuf(d).toString('base64'), base64EncodeWebSafe: (d) => toBuf(d).toString('base64url'),
      base64Decode: (s) => Array.from(Buffer.from(String(s), 'base64')), base64DecodeWebSafe: (s) => Array.from(Buffer.from(String(s), 'base64url')),
      newBlob: blob, sleep: () => {}, parseCsv: (s) => String(s).split('\n').map((l) => l.split(',')), jsonStringify: (o) => JSON.stringify(o), jsonParse: (s) => JSON.parse(s)
    },
    ScriptApp: {
      newTrigger: (fn) => {
        const spec = {}; const builder = { timeBased: () => builder, everyMinutes(n) { spec.everyMinutes = n; return builder; }, everyHours(n) { spec.everyHours = n; return builder; }, everyDays(n) { spec.everyDays = n; return builder; },
          atHour(h) { spec.atHour = h; return builder; }, nearMinute(m) { spec.nearMinute = m; return builder; }, inTimezone(tz) { spec.tz = tz; return builder; }, onWeekDay(d) { spec.weekDay = d; return builder; }, at(d) { spec.at = d; return builder; },
          after(ms) { spec.afterMs = ms; spec.at = new Date(state.now() + ms); return builder; },
          create() { const t = trigger(fn, spec); state.triggers.push(t); return t; } };
        return builder;
      },
      getProjectTriggers: () => state.triggers.slice(), deleteTrigger: (t) => { state.triggers = state.triggers.filter((x) => x !== t); },
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec', isEnabled: () => true }),
      getScriptId: () => 'TEST_SCRIPT_ID', getOAuthToken: () => 'oauth.test', WeekDay: { MONDAY: 'MONDAY', SUNDAY: 'SUNDAY' }, TriggerSource: { CLOCK: 'CLOCK' }
    },
    Session: { getScriptTimeZone: () => state.tz, getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }), getActiveUser: () => ({ getEmail: () => '' }), getTemporaryActiveUserKey: () => 'k' }
  };
  if (opts.state) state.now = () => (sandbox.__TEST_NOW ? new Date(sandbox.__TEST_NOW).getTime() : Date.now());
  return { sandbox, state };
}

function listJs(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir).sort().filter((n) => n.endsWith('.js')).map((n) => path.join(dir, n)) : []; }
/** listGasFiles({pack, extra}) → core files, then the pack's gas files, then extras. */
function listGasFiles({ pack = null, extra = [] } = {}) {
  const files = listJs(path.join(HELPERS_ROOT, 'core'));
  if (pack) files.push(...listJs(path.join(HELPERS_ROOT, 'packs', pack, 'gas')));
  return files.concat(extra.map((p) => path.resolve(HELPERS_ROOT, p)));
}
/** Manifest object for loadGas: `manifest` wins, else the pack's helper.json, else none (core defaults). */
function manifestFor({ pack = null, manifest = undefined } = {}) {
  if (manifest !== undefined) return manifest;
  if (!pack) return null;
  return JSON.parse(fs.readFileSync(path.join(HELPERS_ROOT, 'packs', pack, 'helper.json'), 'utf8'));
}

/** loadGas({pack, manifest, extra, now, tz, state}) → { ctx, state, files }. `state` reuses an earlier load's state (new execution, same data). ctx is the vm global: every GAS function/var is a property. */
function loadGas(opts = {}) {
  const { sandbox, state } = createMocks(opts);
  const ctx = vm.createContext(sandbox);
  const m = manifestFor(opts);
  if (m) new vm.Script('var HELPER_MANIFEST = ' + JSON.stringify(m) + ';', { filename: 'manifest.js' }).runInContext(ctx);
  const files = listGasFiles(opts);
  for (const f of files) new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }).runInContext(ctx);
  _last = { ctx, state };
  return { ctx, state, files };
}

/** Typical switched-on state: token, secrets, owner paired, Sheet with tabs, mailbox folders. Property names follow ctx.PROP. */
function bootstrap(ctx, state, overrides = {}) {
  const P = ctx.PROP;
  Object.assign(state.props, {
    [P.BOT_TOKEN]: '123456:TESTTOKENTESTTOKENTESTTOKEN', [P.OWNER_CHAT_ID]: '777', [P.WEBHOOK_SECRET]: 'whsecret-test-0123456789',
    [P.ADMIN_SECRET]: 'adminsecret-test-0123456789', [P.WEBAPP_URL]: 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec'
  }, overrides);
  if (!state.props[P.SHEET_ID]) { const ss = ctx.SpreadsheetApp.create('test-state'); state.props[P.SHEET_ID] = ss.getId(); }
  ctx._HB_SS_CACHE = null;
  ctx.ensureSheets();
  ctx.getMailboxFolders();
  return state;
}
/** Make the inbound routine (or `name`) fireable: URL + token properties. */
function configureRoutine(ctx, state, name) {
  const n = (name || ctx.HELPER.inbound_routine).toUpperCase();
  state.props[ctx.routineProp(n, 'URL')] = 'https://api.anthropic.com/v1/routines/test_' + n.toLowerCase() + '/fire';
  state.props[ctx.routineProp(n, 'TOKEN')] = 'routine-token-test-' + n.toLowerCase();
  return n;
}

/** Build a Telegram update. tgUpdate({text}) | tgUpdate({callback:'a:x:y', messageText?, replyMarkup?}) | tgUpdate({document:{...}}) */
let _updateId = 1000;
function tgUpdate(o = {}) {
  const from = { id: o.fromId !== undefined ? o.fromId : 777, is_bot: false, first_name: 'Owner', username: 'owner' };
  const chat = { id: o.chatId !== undefined ? o.chatId : from.id, type: o.chatType || 'private' };
  const update_id = o.update_id !== undefined ? o.update_id : ++_updateId;
  if (o.callback) {
    const msg = { message_id: o.messageId || 55, chat: o.callbackChat || chat, text: o.messageText !== undefined ? o.messageText : 'msg' };
    if (o.replyMarkup) msg.reply_markup = o.replyMarkup;   // the keyboard the tapped message carried (for in-place redraws)
    return { update_id, callback_query: { id: 'cq' + update_id, from, message: msg, chat_instance: 'ci', data: o.callback } };
  }
  const message = { message_id: o.messageId || update_id, from, chat, date: Math.floor(Date.now() / 1000) };
  if (o.text !== undefined) message.text = o.text;
  if (o.caption !== undefined) message.caption = o.caption;
  if (o.voice) message.voice = { file_id: 'VOICE1', duration: 3, mime_type: 'audio/ogg', ...o.voice };
  if (o.document) message.document = { file_id: 'DOC1', file_name: 'x.pdf', mime_type: 'application/pdf', ...o.document };
  return { update_id, message };
}
/** Build a doGet/doPost event: postEvent('tg', {k}, bodyObj) — body objects are JSON-encoded. */
function postEvent(route, params = {}, body) {
  const contents = body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body));
  return { parameter: { route, ...params }, postData: { contents, type: 'application/json', length: contents.length }, queryString: '', contextPath: '' };
}
function getEvent(route, params = {}) { return { parameter: { route, ...params }, queryString: '' }; }
/** Build a from-brain envelope (defaults are valid). created_at follows the current test clock (ctx.__TEST_NOW). */
function envelope(type, payload, overrides = {}) {
  const now = _last ? _last.state.now() : Date.now();
  return { v: 1, id: crypto.randomUUID(), type, created_at: new Date(now).toISOString(), producer: 'test-skill', payload, ...overrides };
}
/** Drop an envelope file into <drive_root>/mailbox/from-brain (drive_root from the loaded manifest). */
function putEnvelope(state, env, name, root) {
  const content = typeof env === 'string' ? env : JSON.stringify(env);
  const dr = root || (_last ? _last.ctx.HELPER.drive_root : 'Helper');
  return state.drive.putFile(dr + '/mailbox/from-brain', name || `${(env && env.id) || 'x'}.json`, content);
}
/** Run every pending one-off trigger whose handler matches (default: all), as Apps Script would, passing {triggerUid}. */
function fireTriggers(ctx, state, handler) {
  const due = state.triggers.filter((t) => !handler || t.fn === handler);
  return due.map((t) => ctx[t.fn]({ triggerUid: t.id }));
}

/**
 * A signed Telegram Mini App initData string for the bootstrap bot token (tgVerifyInitData accepts it as the owner 777):
 * initData(ctx, state, { userId?, authDate? (unix s, default: the test clock), startParam?, extra? (more fields) }).
 * Tamper with the returned string in the test (change a field, drop the hash) to make it fail.
 */
function initData(ctx, state, o = {}) {
  const token = state.props[ctx.PROP.BOT_TOKEN];
  const fields = {
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify({ id: o.userId !== undefined ? o.userId : 777, first_name: 'Owner', username: 'owner', language_code: 'en', allows_write_to_pm: true }),
    auth_date: String(o.authDate !== undefined ? o.authDate : Math.floor(state.now() / 1000)),
    ...(o.startParam ? { start_param: o.startParam } : {}), ...(o.extra || {})
  };
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  return Object.keys(fields).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(fields[k])}`).join('&') + '&hash=' + hash;
}
/** POST a Mini App call to a registered route and parse the JSON answer: appPost(ctx, state, 'app', { op, args }, { initData?, params? }). */
function appPost(ctx, state, route, body = {}, o = {}) {
  const payload = { initData: o.initData !== undefined ? o.initData : initData(ctx, state, o), ...body };
  const out = ctx.doPost(postEvent(route, o.params || {}, payload));
  return JSON.parse(out.content);
}

module.exports = { HELPERS_ROOT, loadGas, createMocks, listGasFiles, bootstrap, configureRoutine, tgUpdate, postEvent, getEvent, envelope, putEnvelope, fireTriggers, formatDate, initData, appPost };

// Developed by: LightAISolutions
