/**
 * Helpers core — config.
 * Plain global-scope Apps Script (V8). tools/bundle.mjs concatenates: a generated manifest block
 * (var HELPER_MANIFEST = {...} from helpers/packs/<name>/helper.json), then helpers/core/*.js (sorted),
 * then the pack's gas/*.js (sorted). Pack files never edit core files; they extend via 02_registry.js.
 */
var CORE_VERSION = '1.0.0';

/** Pack manifest defaults; every field may be set in helper.json (see helpers/SPEC.md §4). */
var HELPER_DEFAULTS = {
  name: 'helper',              // [a-z][a-z0-9-]{1,31} — the pack directory name
  display_name: 'Helper',      // shown in Telegram and on the setup page
  drive_root: 'Helper',        // Drive folder under My Drive that holds mailbox/ and everything the helper writes
  producer: 'helper-core',     // producer id on envelopes the core writes (req_<id>.json)
  property_prefix: 'HELPER',   // Script Property prefix: <PREFIX>_BOT_TOKEN … ('' for none)
  version: '0.0.0',            // the pack's version, shown by /ping and the health route
  envelope_types: [],          // extra from-brain envelope types the pack registers handlers for
  action_allowlist: [],        // extra action types the pack registers (executor refuses anything else)
  inbound_routine: 'CHAT',     // routine fired for a free-text message / /ask when the pack registers no message handler
  memory_dirs: [],             // private-repo memory dirs besides log/ and quarantine/ (informational for the core)
  scopes: []                   // extra OAuth scopes merged into appsscript.json by the bundler
};
function _helperMerge(defaults, manifest) {
  var out = {};
  Object.keys(defaults).forEach(function (k) {
    var v = manifest && manifest[k] !== undefined && manifest[k] !== null ? manifest[k] : defaults[k];
    out[k] = Array.isArray(defaults[k]) ? (Array.isArray(v) ? v.slice() : []) : String(v);
  });
  return out;
}
var HELPER = _helperMerge(HELPER_DEFAULTS, typeof HELPER_MANIFEST !== 'undefined' ? HELPER_MANIFEST : null);

/** Script Property names. Resolved through the manifest's property_prefix (see propName()). */
var PROP_KEYS = ['BOT_TOKEN', 'OWNER_CHAT_ID', 'WEBHOOK_SECRET', 'ADMIN_SECRET', 'PAIR_CODE', 'SHEET_ID', 'ROOT_FOLDER_ID',
  'MAILBOX_FOLDER_ID', 'TIMEZONE', 'WEBAPP_URL', 'MAX_ROUTINE_FIRES_PER_DAY', 'MAX_PROPOSALS_PER_DAY', 'MAX_WAKES_PER_DAY',
  'WAKE_MIN_INTERVAL_SEC'];
function propName(key) { return (HELPER.property_prefix ? HELPER.property_prefix + '_' : '') + key; }
var PROP = {};
PROP_KEYS.forEach(function (k) { PROP[k] = propName(k); });
/** Secret properties: redacted from every persisted/shown string (01_util.js redactSecrets). */
var SECRET_PROP_KEYS = ['BOT_TOKEN', 'WEBHOOK_SECRET', 'ADMIN_SECRET', 'PAIR_CODE'];
/** routineProp('CHAT', 'URL') → <PREFIX>_ROUTINE_FIRE_URL_CHAT; kind is URL or TOKEN. */
function routineProp(name, kind) {
  return propName('ROUTINE_FIRE_' + String(kind).toUpperCase() + '_' + String(name).toUpperCase().replace(/[^A-Z0-9]/g, '_'));
}

var LIMITS = {
  TG_MAX_CHARS: 4096,
  TG_SPLIT_AT: 3900,
  CB_DATA_MAX_BYTES: 64,
  ENVELOPE_MAX_FILE_BYTES: 200000,
  ENVELOPE_MAX_PAYLOAD_CHARS: 65536,
  ENVELOPE_MAX_TEXT_CHARS: 16000,
  ENVELOPE_MAX_AGE_DAYS: 14,
  QUEUE_MAX_PAYLOAD_CHARS: 32768,
  QUEUE_MAX_ATTEMPTS: 3,
  QUEUE_BATCH: 20,
  QUEUE_STALE_MIN: 10,
  QUEUE_KEEP_DAYS: 7,
  SWEEP_BUDGET_MS: 120000,
  PENDING_DEFAULT_EXPIRY_MIN: 24 * 60,
  PENDING_MAX_EXPIRY_MIN: 7 * 24 * 60,
  PENDING_PREVIEW_CHARS: 3000,
  AUDIT_DETAIL_CHARS: 2000,
  DEDUPE_TTL_SEC: 21600,
  MAX_ROUTINE_FIRES_PER_DAY: 12,
  MAX_PROPOSALS_PER_DAY: 30,
  MAX_WAKES_PER_DAY: 500,
  WAKE_MIN_INTERVAL_SEC: 15,
  WAKE_AUDIT_TTL_SEC: 3600,
  REQUEST_TEXT_CHARS: 4000,
  REQUEST_MAX_AGE_HOURS: 24,
  FALLBACK_SWEEP_MIN: [3, 10],
  HOURLY_SWEEP_MIN: 60,
  MAILBOX_TO_BRAIN_KEEP_DAYS: 3,
  MAILBOX_ARCHIVE_KEEP_DAYS: 30,
  MAILBOX_BATCH: 25,
  FLOW_STATE_MAX_CHARS: 40000,
  FLOW_DEFAULT_TTL_MIN: 24 * 60,
  DOCUMENT_MAX_BYTES: 50 * 1024 * 1024,
  DOCUMENT_CAPTION_CHARS: 1024,
  REPLY_MAX_DOCUMENTS: 10,
  UPLOAD_MAX_BYTES: 30 * 1024 * 1024,      // one file through ?route=upload (decoded)
  UPLOAD_MAX_BODY_CHARS: 42 * 1024 * 1024, // the JSON body carrying it as base64
  UPLOAD_MAX_PER_REQUEST: 6,
  UPLOAD_AFTER_ANSWER_MIN: 60              // an answered request still takes uploads this long
};

/** From-brain envelope types the core handles. The manifest's envelope_types are appended at load. */
var ENVELOPE_TYPES = ['notice', 'reply', 'proposal'];
ENVELOPE_TYPES = ENVELOPE_TYPES.concat(HELPER.envelope_types.filter(function (t) { return ENVELOPE_TYPES.indexOf(t) < 0; }));
/** Core → brain request type (to-brain/req_<id>.json). Never accepted from the brain. */
var REQUEST_TYPE = 'request';

/** Action types the executor may run. The manifest's action_allowlist is appended at load. */
var ACTION_ALLOWLIST = ['drive_create_file'];
ACTION_ALLOWLIST = ACTION_ALLOWLIST.concat(HELPER.action_allowlist.filter(function (t) { return ACTION_ALLOWLIST.indexOf(t) < 0; }));

var MAILBOX = {
  MAILBOX: 'mailbox', TO_BRAIN: 'to-brain', FROM_BRAIN: 'from-brain', ARCHIVE: 'archive',
  PROCESSED: 'processed', REJECTED: 'rejected', FAILED: 'failed', STATE_FILE: 'state.json'
};

var SHEETS = { QUEUE: 'Queue', PENDING: 'PendingActions', REQUESTS: 'Requests', AUDIT: 'AuditLog', SETTINGS: 'Settings', FLOWS: 'Flows' };

/** Exact column headers. Never reorder or rename; packs may add columns via registerSheet(). */
var SHEET_HEADERS = {
  Queue: ['id', 'created_at', 'kind', 'source', 'status', 'attempts', 'payload_json', 'last_error',
    'claimed_at', 'processed_at', 'result_json'],
  PendingActions: ['id', 'created_at', 'type', 'status', 'preview', 'payload_json', 'idempotency_key',
    'expires_at', 'decided_at', 'executed_at', 'result_json', 'error', 'tg_chat_id', 'tg_message_id', 'origin'],
  Requests: ['id', 'created_at', 'kind', 'status', 'routine', 'fired', 'answered_at', 'tg_chat_id', 'tg_message_id', 'text_preview'],
  AuditLog: ['id', 'ts', 'actor', 'event', 'ref', 'detail_json', 'ok'],
  Settings: ['key', 'value', 'updated_at', 'note'],
  Flows: ['chat_id', 'flow', 'step', 'expect', 'state_json', 'updated_at', 'expires_at']
};

function getProp(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return (v === null || v === undefined) ? '' : String(v);
}
function setProp(key, value) { PropertiesService.getScriptProperties().setProperty(key, String(value)); }
function delProp(key) { PropertiesService.getScriptProperties().deleteProperty(key); }
/** Owner time zone: TIMEZONE property, else the script's zone (appsscript.json, set by the bundler from the manifest). */
function getTz() {
  var tz = getProp(PROP.TIMEZONE);
  if (tz) return tz;
  try { tz = Session.getScriptTimeZone(); } catch (e) { tz = ''; }
  return tz || 'Etc/UTC';
}
function getIntProp(key, def) {
  var v = parseInt(getProp(key), 10);
  return isNaN(v) ? def : v;
}

// Developed by: LightAISolutions
