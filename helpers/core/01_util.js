/** Helpers core — utilities. */

/** Tests may set __TEST_NOW (ms or ISO) to freeze the clock. */
function nowDate() {
  if (typeof __TEST_NOW !== 'undefined' && __TEST_NOW) return new Date(__TEST_NOW);
  return new Date();
}
function nowMs() { return nowDate().getTime(); }
function nowIso() { return nowDate().toISOString(); }
function isoAfterMinutes(min) { return new Date(nowMs() + min * 60000).toISOString(); }
function isoDateLocal(d) { return Utilities.formatDate(d || nowDate(), getTz(), 'yyyy-MM-dd'); }
function localHour(d) { return parseInt(Utilities.formatDate(d || nowDate(), getTz(), 'H'), 10); }
function localWeekday(d) { return Utilities.formatDate(d || nowDate(), getTz(), 'EEE'); }
function fmtLocal(d) { return Utilities.formatDate(d || nowDate(), getTz(), 'EEE MMM d, h:mm a'); }
/** Render a stored ISO timestamp in the owner's time zone; unparseable → as-is, empty → fallback. */
function fmtLocalIso(s, fallback) {
  var d = parseIso(s);
  if (!d) return s ? String(s) : (fallback === undefined ? 'never' : fallback);
  return Utilities.formatDate(d, getTz(), 'EEE MMM d, h:mm a z');
}

function parseIso(s) {
  if (typeof s !== 'string' || !s) return null;
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function isIsoDateOnly(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !!parseIso(s); }

/** Short unique id: <prefix>_<12 base36 chars>. Safe inside callback_data. */
function newId(prefix) {
  var u = Utilities.getUuid().replace(/-/g, '');
  var n = parseInt(u.slice(0, 12), 16).toString(36) + parseInt(u.slice(12, 24), 16).toString(36);
  return (prefix ? prefix + '_' : '') + n.slice(0, 12);
}
function uuid() { return Utilities.getUuid(); }

function sha1Hex(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, String(str), Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}
/** Stable record id: sha1(source_ref + kind + title) hex prefix 16. */
function stableId(sourceRef, kind, title) { return sha1Hex(String(sourceRef) + '|' + kind + '|' + title).slice(0, 16); }

function randomToken(len) {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var out = '';
  var u = (Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  for (var i = 0; i < (len || 32); i++) {
    var h = parseInt(u.slice((i * 2) % u.length, (i * 2) % u.length + 2), 16);
    out += alphabet.charAt((h + i * 7) % alphabet.length);
  }
  return out;
}

function safeJsonParse(s) {
  try { return { ok: true, value: JSON.parse(s) }; } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
function toJson(v) { return JSON.stringify(v === undefined ? null : v); }
function isDate(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && !isDate(v); }
function truncate(s, n) { s = String(s === undefined || s === null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function utf8Bytes(s) { return unescape(encodeURIComponent(String(s))).length; }
function clampInt(v, lo, hi, def) { var n = parseInt(v, 10); if (isNaN(n)) return def; return Math.max(lo, Math.min(hi, n)); }

/** Constant-time-ish string compare (no early exit on mismatch). */
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b) return false;
  var diff = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) diff |= (a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length));
  return diff === 0;
}

/** Deep-walk an object and return the longest string length (for size validation). */
function longestString(v) {
  var max = 0;
  (function walk(x, depth) {
    if (depth > 20) return;
    if (typeof x === 'string') { if (x.length > max) max = x.length; return; }
    if (Array.isArray(x)) { for (var i = 0; i < x.length; i++) walk(x[i], depth + 1); return; }
    if (isPlainObject(x)) { for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) walk(x[k], depth + 1); }
  })(v, 0);
  return max;
}

function describeError(e) {
  if (!e) return 'unknown error';
  var m = e.message ? String(e.message) : String(e);
  return truncate(redactSecrets(m + (e.stack ? ' | ' + String(e.stack).split('\n').slice(0, 2).join(' / ') : '')), 500);
}

/**
 * Strip secrets from any text that may be persisted or shown. UrlFetchApp exception messages contain the request
 * URL, which for Telegram carries the bot token (…/bot<token>/method) — so errors, audit rows and Queue.last_error
 * are redacted. Pattern-based (bot tokens, bearer tokens, ?k= secrets) plus the exact values of the secret properties.
 */
function redactSecrets(s) {
  s = String(s === undefined || s === null ? '' : s);
  if (!s) return s;
  s = s.replace(/bot\d{5,}:[A-Za-z0-9_-]{20,}/g, 'bot[redacted]')
    .replace(/\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/g, '[redacted]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]{8,}=*/g, '$1[redacted]')
    .replace(/([?&](?:k|token|secret)=)[A-Za-z0-9_-]{8,}/g, '$1[redacted]');
  try {
    var all = PropertiesService.getScriptProperties().getProperties() || {};
    var secretNames = SECRET_PROP_KEYS.map(propName);
    Object.keys(all).forEach(function (k) {
      if (secretNames.indexOf(k) < 0 && !/ROUTINE_FIRE_TOKEN_/.test(k) && !/_API_KEY$/.test(k)) return;
      var v = String(all[k] || '');
      if (v.length >= 8 && s.indexOf(v) >= 0) s = s.split(v).join('[redacted]');
    });
  } catch (e) { /* properties unavailable — pattern redaction already applied */ }
  return s;
}

/**
 * Invisible and direction-changing characters: C0/C1 controls except tab, newline and CR; the Arabic letter mark; the
 * zero-width space; left-to-right / right-to-left marks; bidi embeddings, overrides and isolates; the word joiner and the
 * invisible operators; the BOM. Text from the brain lane carrying them could reorder or hide what the owner reads
 * (Phase 6 red-team A7), so every envelope string is cleaned before it is validated. ZWNJ and ZWJ (U+200C, U+200D)
 * stay: scripts and emoji sequences need them.
 */
var HIDDEN_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u061C\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
function stripHidden(s) { return String(s === undefined || s === null ? '' : s).replace(HIDDEN_CHARS_RE, ''); }

// Developed by: LightAISolutions
