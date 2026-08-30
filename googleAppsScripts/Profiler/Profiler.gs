var VERSION = "v01.27g";
var TITLE = "Profiler — Ecosystem Company Dossiers";
var GITHUB_OWNER  = "LightAISolutions";
var GITHUB_REPO   = "Sales";
var GITHUB_BRANCH = "main";
var FILE_PATH     = "googleAppsScripts/Profiler/Profiler.gs";
var DEPLOYMENT_ID = "AKfycbwnpv-PYXK_7Wvp5ZAtnhZawcTWgc-8Df_1qKKoLsg9gGawIukAzU7H14aw9DOrVSJ3Tw";
var EMBED_PAGE_URL = "https://lightaisolutions.github.io/Sales/Profiler.html";

// Derive the parent page's origin from EMBED_PAGE_URL for postMessage targeting.
// postMessage calls from the GAS iframe to the parent page use this as the targetOrigin
// to restrict who can receive the messages. This is safer than "*" because it ensures
// only the intended embedding page can intercept session tokens and auth state.
// CRITICAL: .toLowerCase() is MANDATORY — browsers normalize origins to lowercase,
// but EMBED_PAGE_URL may contain mixed-case (e.g. "LightAISolutions"). Without
// toLowerCase(), the browser silently drops ALL postMessages because the targetOrigin
// doesn't match the actual lowercase origin. This exact bug (missing toLowerCase)
// broke sign-in in v02.79r and was never fixed live (the v02.80r fix never deployed
// because the auto-deploy pipeline was already broken).
var PARENT_ORIGIN = EMBED_PAGE_URL.replace(/^(https?:\/\/[^\/]+).*$/, '$1').toLowerCase();

// ══════════════
// AUTH CONFIG
// ══════════════
// Spreadsheet ID for project data (the GAS app reads/writes user data here).
var SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";
var SHEET_NAME     = "YOUR_SHEET_NAME";
// Master ACL spreadsheet — centralized access control for all GAS-powered pages.
// Two tabs:
//   "Access" — Row 1 = headers (Email, Role, page1, page2, ...). Rows 2+ = email in col A, role in col B, TRUE/FALSE per page.
//   "Roles"  — Row 1 = headers (Role, perm1, perm2, ...). Rows 2+ = role name in col A, TRUE/FALSE per permission.
// UI element gating is handled client-side via data-requires-permission and data-requires-role attributes on HTML elements.
// If configured, this replaces the old editor/viewer sharing-list check.
// Leave as placeholder to fall back to SPREADSHEET_ID editor/viewer check.
var MASTER_ACL_SPREADSHEET_ID = "1kG2KftqfKOeYwBCEkxRpw-QBh9s-1-Dvy31sH037UvE";
var ACL_SHEET_NAME = "Access";
var ACL_PAGE_NAME  = "Profiler";
var PORTAL_ICON    = "📝";
var PORTAL_DESCRIPTION = "Profiler Field Notes";

// Unified toggleable auth configuration (see 6-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md)
// Select a preset, then apply per-project overrides.
var ACTIVE_PRESET = 'standard';     // 'standard' or 'hipaa'
var PROJECT_OVERRIDES = {
  ENABLE_DOMAIN_RESTRICTION: false,
  ALLOWED_DOMAINS: [],
  SESSION_EXPIRATION: 7200,   // default new projects to a 2-hour rolling session (overrides the preset's shorter default; absolute ceiling stays at the preset's ABSOLUTE_SESSION_TIMEOUT). The client countdown derives from this via the heartbeat's expiresIn, so no second constant is needed.
  // MANDATORY for this project: the note ops are exposed on the public fetch
  // API (doPost action=note + GET api mirror), so every data op MUST fully
  // validate its session token. The standard preset's false setting assumes
  // google.script.run transport (only reachable from the signed-in served
  // page) — that assumption does not hold for a public HTTP route.
  ENABLE_DATA_OP_VALIDATION: true,
};

// ══════════════
// RBAC — Role-Based Access Control
// ══════════════
// Roles and permissions are read from the "Roles" tab of the centralized ACL spreadsheet.
// The "Access" tab has a "Role" column (col B) that assigns one role per user.
// UI element gating is handled client-side via data-requires-permission and data-requires-role HTML attributes.
// HIPAA: §164.308(a)(4)(ii) — access authorization based on role.

// Hardcoded fallback — used ONLY when the Roles tab is missing or unreadable.
// In normal operation, getRolesFromSpreadsheet() reads from the spreadsheet.
// Mirrors the ACL spreadsheet's Roles tab — keys are the .toLowerCase() of each
// Roles-tab row name, matching how getRolesFromSpreadsheet() normalizes them.
// Roles are permission TIERS (what a user can do), NOT job titles and NOT
// program access — per-program visibility lives in the Access tab's page columns.
// Keep this matrix in sync with the spreadsheet whenever roles are added,
// renamed, or their permissions change, so a Roles-tab outage cannot silently
// widen or narrow access.
var RBAC_ROLES_FALLBACK = {
  'developer':   ['read', 'write', 'delete', 'export', 'amend', 'admin'],
  'admin':       ['read', 'write', 'delete', 'export', 'amend', 'admin'],
  'editor':      ['read', 'write', 'export', 'amend'],
  'contributor': ['read', 'write'],
  'analyst':     ['read', 'export'],
  'viewer':      ['read'],
  'medical_director':  ['read', 'write', 'export', 'amend']
};

// Default role when ACL does not specify one (fallback access via editor/viewer list)
var RBAC_DEFAULT_ROLE = 'viewer';

// In-memory cache for the current execution (avoids repeated spreadsheet reads within a single request)
var _rbacRolesCache = null;
var _rbacRolesCacheExpiry = 0;

/**
 * Cache epoch — a counter stored in ScriptProperties that prefixes all CacheService keys.
 * Incrementing the epoch instantly orphans ALL existing cache entries (they have the old
 * prefix and will never be read again). This is a nuclear cache clear without needing to
 * know individual cache keys. The epoch is read once per execution and cached in memory.
 *
 * getEpochCache() returns a wrapper around CacheService.getScriptCache() that auto-prefixes
 * all keys with the epoch. Use this instead of CacheService.getScriptCache() directly.
 */
var _cacheEpoch = null;
function _getCacheEpoch() {
  if (_cacheEpoch !== null) return _cacheEpoch;
  _cacheEpoch = PropertiesService.getScriptProperties().getProperty('CACHE_EPOCH') || '0';
  return _cacheEpoch;
}
function getEpochCache() {
  var raw = CacheService.getScriptCache();
  var pfx = 'e' + _getCacheEpoch() + '_';
  return {
    get: function(key) { return raw.get(pfx + key); },
    put: function(key, value, ttl) { raw.put(pfx + key, value, ttl); },
    remove: function(key) { raw.remove(pfx + key); },
    removeAll: function(keys) { raw.removeAll(keys.map(function(k) { return pfx + k; })); }
  };
}

/**
 * Read roles and permissions from the "Roles" tab of the centralized ACL spreadsheet.
 * Expected layout: Row 1 = headers (Role, permission1, permission2, ...).
 *                  Rows 2+ = role name in col A, TRUE/FALSE per permission column.
 * Returns an object like { admin: ['read','write','delete',...], viewer: ['read'], ... }
 * Falls back to RBAC_ROLES_FALLBACK if the spreadsheet/tab is unavailable.
 * Results are cached in CacheService for 10 minutes and in memory for the current execution.
 */
function getRolesFromSpreadsheet() {
  // In-memory cache for same-execution reuse (avoids even CacheService overhead)
  var now = Date.now();
  if (_rbacRolesCache && now < _rbacRolesCacheExpiry) {
    return _rbacRolesCache;
  }

  var cache = getEpochCache();
  var cacheKey = 'rbac_roles_matrix';
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
      _rbacRolesCache = JSON.parse(cached);
      _rbacRolesCacheExpiry = now + 60000; // 1 min in-memory
      return _rbacRolesCache;
    } catch (e) { /* fall through to spreadsheet read */ }
  }

  var hasAcl = MASTER_ACL_SPREADSHEET_ID && MASTER_ACL_SPREADSHEET_ID !== "YOUR_MASTER_ACL_SPREADSHEET_ID";
  if (!hasAcl) {
    _rbacRolesCache = RBAC_ROLES_FALLBACK;
    _rbacRolesCacheExpiry = now + 60000;
    return RBAC_ROLES_FALLBACK;
  }

  try {
    var ss = SpreadsheetApp.openById(MASTER_ACL_SPREADSHEET_ID);
    var rolesSheet = ss.getSheetByName('Roles');
    if (!rolesSheet) {
      Logger.log('RBAC: "Roles" tab not found — using hardcoded fallback');
      _rbacRolesCache = RBAC_ROLES_FALLBACK;
      _rbacRolesCacheExpiry = now + 60000;
      return RBAC_ROLES_FALLBACK;
    }

    var data = rolesSheet.getDataRange().getValues();
    if (data.length < 2) {
      _rbacRolesCache = RBAC_ROLES_FALLBACK;
      _rbacRolesCacheExpiry = now + 60000;
      return RBAC_ROLES_FALLBACK;
    }

    // Row 0 = headers: [Role, perm1, perm2, ...]
    var headers = data[0];
    var permNames = [];
    for (var c = 1; c < headers.length; c++) {
      permNames.push(String(headers[c]).trim().toLowerCase());
    }

    var roles = {};
    for (var r = 1; r < data.length; r++) {
      var roleName = String(data[r][0]).trim().toLowerCase();
      if (!roleName) continue;
      var perms = [];
      for (var p = 0; p < permNames.length; p++) {
        var val = data[r][p + 1];
        if (val === true || String(val).trim().toUpperCase() === 'TRUE') {
          perms.push(permNames[p]);
        }
      }
      roles[roleName] = perms;
    }

    // Cache for 10 minutes in CacheService
    cache.put(cacheKey, JSON.stringify(roles), 600);
    _rbacRolesCache = roles;
    _rbacRolesCacheExpiry = now + 60000;
    return roles;
  } catch (e) {
    Logger.log('RBAC: Error reading Roles tab — ' + e.message + ' — using hardcoded fallback');
    _rbacRolesCache = RBAC_ROLES_FALLBACK;
    _rbacRolesCacheExpiry = now + 60000;
    return RBAC_ROLES_FALLBACK;
  }
}

// Check if a role has a specific permission (reads from spreadsheet)
function hasPermission(role, permission) {
  var roles = getRolesFromSpreadsheet();
  var perms = roles[role];
  if (!perms) return false;
  return perms.indexOf(permission) !== -1;
}

// Validate and gate a data operation by permission.
// Throws PERMISSION_DENIED if the user's role lacks the required permission.
// Returns the user object (from validateSessionForData) on success.
function checkPermission(user, requiredPermission, operationName) {
  var role = user.role || RBAC_DEFAULT_ROLE;
  if (!hasPermission(role, requiredPermission)) {
    var roles = getRolesFromSpreadsheet();
    auditLog('security_alert', user.email, 'permission_denied', {
      operation: operationName,
      role: role,
      requiredPermission: requiredPermission,
      availablePermissions: (roles[role] || []).join(',')
    });
    throw new Error('PERMISSION_DENIED');
  }
  return user;
}

// ══════════════
// AUTH PRESETS
// ══════════════
var PRESETS = {
  standard: {
    SESSION_EXPIRATION: 3600,          // seconds — rolling session lifetime, reset by heartbeats (1hr)
    ABSOLUTE_SESSION_TIMEOUT: 28800,   // seconds — hard ceiling, never resets regardless of activity (8hr)
    ENABLE_HEARTBEAT: true,
    HEARTBEAT_INTERVAL: 300,           // seconds — how often GAS checks/extends the session when user is active (5min)
    MAX_SESSIONS_PER_USER: 1,
    OAUTH_TOKEN_LIFETIME: 3600,        // seconds — expected lifetime of the Google OAuth access token (1hr)
    OAUTH_REFRESH_BUFFER: 300,         // seconds — show "expiring soon" banner this long before token expires (5min)
    ENABLE_DOMAIN_RESTRICTION: false,
    ALLOWED_DOMAINS: [],
    ENABLE_AUDIT_LOG: false,
    AUDIT_LOG_SHEET_NAME: 'SessionAuditLog',
    AUDIT_LOG_RETENTION_YEARS: 6,
    ENABLE_HMAC_INTEGRITY: true,
    HMAC_SECRET_PROPERTY: 'HMAC_SECRET',
    ENABLE_EMERGENCY_ACCESS: false,
    EMERGENCY_ACCESS_PROPERTY: 'EMERGENCY_ACCESS_EMAILS',
    TOKEN_EXCHANGE_METHOD: 'url',
    ENABLE_CROSS_DEVICE_ENFORCEMENT: true,
    ENABLE_DATA_OP_VALIDATION: false,  // Data ops execute without session re-validation (current behavior)
    ENABLE_DOM_CLEARING_ON_EXPIRY: false,  // Auth wall overlay only (current behavior)
    ENABLE_ESCALATING_LOCKOUT: false,  // Use existing flat rate limit (5/5min)
    ENABLE_IP_LOGGING: false,          // Do not fetch or log client IP
    ENABLE_DATA_AUDIT_LOG: false,      // No per-operation audit logging (current behavior)
    DATA_AUDIT_LOG_SHEET_NAME: 'DataAuditLog'
  },
  hipaa: {
    SESSION_EXPIRATION: 900,           // seconds — rolling session lifetime, reset by heartbeats (15min)
    ABSOLUTE_SESSION_TIMEOUT: 28800,   // seconds — hard ceiling, never resets regardless of activity (8hr)
    ENABLE_HEARTBEAT: true,
    HEARTBEAT_INTERVAL: 300,           // seconds — how often GAS checks/extends the session when user is active (5min)
    MAX_SESSIONS_PER_USER: 1,
    OAUTH_TOKEN_LIFETIME: 3600,        // seconds — expected lifetime of the Google OAuth access token (1hr)
    OAUTH_REFRESH_BUFFER: 300,         // seconds — show "expiring soon" banner this long before token expires (5min)
    ENABLE_DOMAIN_RESTRICTION: true,
    ALLOWED_DOMAINS: [],
    ENABLE_AUDIT_LOG: true,
    AUDIT_LOG_SHEET_NAME: 'SessionAuditLog',
    AUDIT_LOG_RETENTION_YEARS: 6,
    ENABLE_HMAC_INTEGRITY: true,
    HMAC_SECRET_PROPERTY: 'HMAC_SECRET',
    ENABLE_EMERGENCY_ACCESS: true,
    EMERGENCY_ACCESS_PROPERTY: 'EMERGENCY_ACCESS_EMAILS',
    TOKEN_EXCHANGE_METHOD: 'postMessage',
    ENABLE_CROSS_DEVICE_ENFORCEMENT: true,
    ENABLE_DATA_OP_VALIDATION: true,   // Every google.script.run data op validates session first
    ENABLE_DOM_CLEARING_ON_EXPIRY: true,   // Destroy GAS iframe content on session expiry
    ENABLE_ESCALATING_LOCKOUT: true,   // Escalating lockout tiers (5min → 30min → 6hr)
    ENABLE_IP_LOGGING: false,          // DISABLED — ipify.org lacks BAA, violates HIPAA (Phase 3: C-3)
    ENABLE_DATA_AUDIT_LOG: true,       // Log individual data access events (reads, writes)
    DATA_AUDIT_LOG_SHEET_NAME: 'DataAuditLog'
  }
};

// ══════════════
// AUTH CONFIG RESOLUTION
// ══════════════
function resolveConfig(presetName, overrides) {
  var preset = PRESETS[presetName];
  if (!preset) {
    throw new Error('Unknown preset: ' + presetName + '. Valid presets: standard, hipaa');
  }
  var resolved = {};
  for (var key in preset) {
    if (preset.hasOwnProperty(key)) resolved[key] = preset[key];
  }
  for (var key in overrides) {
    if (overrides.hasOwnProperty(key)) resolved[key] = overrides[key];
  }
  if (presetName === 'hipaa') {
    if (resolved.ENABLE_DOMAIN_RESTRICTION &&
        (!resolved.ALLOWED_DOMAINS || resolved.ALLOWED_DOMAINS.length === 0)) {
      throw new Error('HIPAA preset with ENABLE_DOMAIN_RESTRICTION requires ALLOWED_DOMAINS — set your Workspace domain(s)');
    }
    if (resolved.SESSION_EXPIRATION > 900) {
      Logger.log('WARNING: HIPAA recommends SESSION_EXPIRATION ≤ 900s (15 min). Current: '
        + resolved.SESSION_EXPIRATION + 's');
    }
  }
  return resolved;
}

var AUTH_CONFIG = resolveConfig(ACTIVE_PRESET, PROJECT_OVERRIDES);
// ══════════════
// AUTH CONFIG END
// ══════════════

// ══════════════
// PROJECT START — Add your project-specific code here

// PROJECT: ── Role + Access matrix (developer directive, 2026-08-22) ──────
// The server half of the Profiler page's access matrix. The page hides UI per
// tier (OV_ROLE_CAPS in Profiler.html); these checks are the boundary:
//   admin / developer — every feature
//   contributor       — Industry Guidance, dossier export
//   analyst           — dossier export
//   viewer            — dossiers only
// Field notes (submit/list/edit/delete) stay admin-only and are gated in
// handleNoteOp_. Dossier versions are static archive JSONs on Pages, so their
// gate is the page's alone. Keep GUIDANCE_ROLES in sync with OV_ROLE_CAPS.
var GUIDANCE_ROLES = ['contributor'];
function guidanceAllowed_(sess) {
  if ((sess && sess.permissions || []).indexOf('admin') >= 0) return true;
  var gr = String((sess && sess.role) || '').toLowerCase().trim();
  return GUIDANCE_ROLES.indexOf(gr) >= 0;
}

// PROJECT: ── Industry Guidance ───────────────────────────────────────────
// Document-analysis modules rendered by the Profiler page's Industry Guidance
// overlay (v01.38w). Content is authored from
// repository-information/industry-guidance/*.md (the source of truth) and
// served only after the server-side role check above — the page's role-gated
// button is UI convenience; this boundary is the real one. The module JSON
// never lands on public Pages.
function handleGuidanceOp_(e) {
  var p = (e && e.parameter) || {};
  var op = p.gop || '';
  var session = p.session || '';
  if (!session || session.length < 32) return { success: false, error: 'SESSION_EXPIRED' };
  try {
    var sess = validateSessionForData(session, 'guidance_' + op);
    if (!guidanceAllowed_(sess)) {
      return { success: false, error: 'ROLE_DENIED', role: sess.role || RBAC_DEFAULT_ROLE };
    }
    if (op === 'index') return { success: true, docs: guidanceIndex_() };
    if (op === 'doc') {
      var doc = guidanceDoc_(String(p.id || ''));
      if (!doc) return { success: false, error: 'UNKNOWN_DOC' };
      return { success: true, doc: doc };
    }
    if (op === 'mentions') {
      var men = guidanceMentions_();
      return { success: true, mentions: men.mentions, built: men.built };
    }
    if (op === 'progress') return { success: true, progress: gdProgressRead_(sess) };
    if (op === 'setprogress') return gdProgressWrite_(sess, p);
    return { success: false, error: 'unknown_gop' };
  } catch (gErr) {
    var gMsg = String((gErr && gErr.message) || gErr);
    if (gMsg.indexOf('SESSION_EXPIRED') >= 0) return { success: false, error: 'SESSION_EXPIRED' };
    return { success: false, error: gMsg };
  }
}

function guidanceDocs_() {
  // Ordered by topic lane (the library renders these as grouped sections):
  // fundamentals first, then the AI data-center wave, then market access.
  return [guidanceDocBessTech_(), guidanceDocPowerInfra_(),
          guidanceDocNvidia800_(), guidanceDocUtilityAidc_(),
          guidanceDocChinaPolicy_(), guidanceDocBankability_()];
}

function guidanceIndex_() {
  var docs = guidanceDocs_();
  var out = [];
  for (var i = 0; i < docs.length; i++) {
    out.push({ id: docs[i].id, title: docs[i].title, short: docs[i].short,
               group: docs[i].group || '',
               date: docs[i].source && docs[i].source.date, updated: docs[i].updated,
               reviewBy: docs[i].reviewBy || '',
               revised: (docs[i].revisions && docs[i].revisions.length)
                 ? docs[i].revisions[docs[i].revisions.length - 1].date : '',
               sections: (docs[i].sections || []).length });
  }
  return out;
}

function guidanceDoc_(id) {
  var docs = guidanceDocs_();
  for (var i = 0; i < docs.length; i++) if (docs[i].id === id) return docs[i];
  return null;
}

// Which guidance modules mention each covered company (gop=mentions —
// role-gated like index/doc, so module titles never reach tiers without
// guidance access). The registry on public Pages is the name authority;
// the scan mirrors the client's ovRelDerive ambiguity guard: one-word
// common-word names only count mid-sentence (never right after a field
// start or sentence-ending punctuation in the module JSON). Result is
// cached 6h — module content only changes on deploys.
function guidanceMentions_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('gd_mentions_v1');
  if (hit) return JSON.parse(hit);
  var base = EMBED_PAGE_URL.replace(/[^\/]*$/, '');
  var reg = JSON.parse(UrlFetchApp.fetch(base + 'profiler-data/profiler-companies.json',
    { muteHttpExceptions: true }).getContentText());
  var docs = guidanceDocs_();
  var blobs = docs.map(function(d) { return JSON.stringify(d); });
  var out = {};
  (reg.companies || []).forEach(function(c) {
    var name = String(c.name || '');
    if (!name) return;
    var ambiguous = name.indexOf(' ') < 0 && /^[A-Z][a-z]+$/.test(name);
    var src = '\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b';
    var hits = [];
    for (var i = 0; i < docs.length; i++) {
      var re = new RegExp(src, 'g'), m, ok = false;
      while ((m = re.exec(blobs[i]))) {
        if (!ambiguous) { ok = true; break; }
        var prev = blobs[i].slice(0, m.index).replace(/\s+$/, '').slice(-1);
        if (prev && '"{[.!?:'.indexOf(prev) === -1) { ok = true; break; }
      }
      if (ok) hits.push({ id: docs[i].id, title: docs[i].title });
    }
    if (hits.length) out[c.slug] = hits;
  });
  var res = { mentions: out, built: new Date().toISOString() };
  try { cache.put('gd_mentions_v1', JSON.stringify(res), 21600); } catch (ce) { /* oversized — serve uncached */ }
  return res;
}

// PROJECT: ── Guidance reading progress (server-side, per account) ─────────
// gop=progress / gop=setprogress — same role gate as index/doc. The account's
// section ticks live server-side so progress follows the account across
// devices; the page keeps localStorage as its offline fallback and migrates
// local-only ticks up in one batch on its first successful sync. Storage is
// one Script Property per account ('gd_progress:<email>' →
// {docId:{secId:true}}): the blobs are tiny (well under the 9KB/value cap)
// and have no cross-project consumers, so PropertiesService beats the Master
// ACL spreadsheet pattern here — no spreadsheet round-trip per tick. Doc and
// section ids are validated against the registered modules so junk params
// can never grow the store.
var GD_PROGRESS_PROP_PREFIX = 'gd_progress:';

function gdProgressAcct_(sess) {
  var em = String((sess && sess.email) || '').toLowerCase().trim();
  if (!em || em === 'unvalidated' || em.indexOf('@') < 0) return '';
  return em;
}

function gdProgressRead_(sess) {
  var acct = gdProgressAcct_(sess);
  if (!acct) return {};
  try {
    var raw = PropertiesService.getScriptProperties()
      .getProperty(GD_PROGRESS_PROP_PREFIX + acct);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (e) { return {}; }
}

function gdProgressWrite_(sess, p) {
  var acct = gdProgressAcct_(sess);
  if (!acct) return { success: false, error: 'NO_ACCOUNT' };
  var valid = {};
  var docs = guidanceDocs_();
  for (var i = 0; i < docs.length; i++) {
    var set = {}, secs = docs[i].sections || [];
    for (var j = 0; j < secs.length; j++) if (secs[j].id) set[secs[j].id] = true;
    valid[docs[i].id] = set;
  }
  // Delta: a single tick (id + sec + done=1|0) or a batch merge (merge=
  // JSON {docId:{secId:bool}}) used by the page's first-sync migration.
  var delta = {};
  if (p.merge) {
    try { delta = JSON.parse(String(p.merge)) || {}; }
    catch (me) { return { success: false, error: 'BAD_MERGE' }; }
  } else if (p.id && p.sec) {
    var one = {}; one[String(p.sec)] = String(p.done) === '1';
    delta[String(p.id)] = one;
  } else {
    return { success: false, error: 'NO_DELTA' };
  }
  var lock = null;
  try { lock = LockService.getScriptLock(); lock.waitLock(5000); }
  catch (le) { lock = null; /* best effort — same-account collisions are rare */ }
  try {
    var props = PropertiesService.getScriptProperties();
    var key = GD_PROGRESS_PROP_PREFIX + acct;
    var cur = {};
    try { cur = JSON.parse(props.getProperty(key) || '{}') || {}; } catch (pe) { cur = {}; }
    for (var docId in delta) {
      if (!delta.hasOwnProperty(docId) || !valid[docId]) continue;
      var secMap = delta[docId] || {};
      for (var secId in secMap) {
        if (!secMap.hasOwnProperty(secId) || !valid[docId][secId]) continue;
        if (secMap[secId]) {
          if (!cur[docId]) cur[docId] = {};
          cur[docId][secId] = true;
        } else if (cur[docId]) {
          delete cur[docId][secId];
        }
      }
      if (cur[docId] && !Object.keys(cur[docId]).length) delete cur[docId];
    }
    if (Object.keys(cur).length) props.setProperty(key, JSON.stringify(cur));
    else props.deleteProperty(key);
    return { success: true, progress: cur };
  } finally {
    if (lock) try { lock.releaseLock(); } catch (re) { /* already released */ }
  }
}

// Content: NVIDIA 800 VDC white paper (Aug 2026) analysis module.
// Derived from repository-information/industry-guidance/nvidia-800vdc-analysis.md;
// every quantitative claim verified against the source PDF by two independent
// extraction passes (2026-08-22).
function guidanceDocNvidia800_() {
  return {
 "id": "nvidia-800vdc-2026-08",
 "group": "The AI Data-Center Wave",
 "title": "NVIDIA 800 VDC: Industry Alignment & Execution",
 "short": "The industry's steering document for AI-factory power, 2026-2027 - analyzed.",
 "source": {
  "doc": "800 VDC Architecture: Industry Alignment & Execution (White Paper)",
  "publisher": "NVIDIA",
  "authors": "Jared Huntington & Mike Tu",
  "date": "August 2026",
  "pages": 36,
  "series": "2nd paper - follows the October 2025 feasibility paper",
  "repo": "repository-information/industry-guidance/ (source PDF + full analysis)"
 },
 "updated": "2026-08-22",
 "reviewBy": "2026-11-30",
 "revisions": [
  { "date": "2026-08-29",
    "note": "Generalized to supplier/buyer-group guidance - single-company analysis moved to the admin-lens report overlays; statutory company lists retained as objective fact." }
 ],
 "tiles": [
  {
   "k": "800 VDC",
   "v": "the converged voltage",
   "sub": "coexists with 415/480 VAC - not a replacement (p4)"
  },
  {
   "k": "145 → 330 → 570 → ~1,000 kW",
   "v": "rack power, Gen 1→4",
   "sub": "the number line to memorize (p7)"
  },
  {
   "k": "4.8 MW",
   "v": "the standardized power block",
   "sub": "Option B cluster = Option C block (p19)"
  },
  {
   "k": "Q3 2026 / Q3 2027 / ~2029",
   "v": "Power Rack / Power Center / next-gen SST",
   "sub": "the execution calendar (p11, p17, p23)"
  }
 ],
 "sections": [
  {
   "id": "what",
   "title": "What this document is",
   "read": "3 min",
   "kind": "prose",
   "ps": [
    "The second paper in NVIDIA's 800 VDC series. The first (October 2025) argued **feasibility** - why 800 VDC beats 415/480 VAC as racks pass 200 kW. This one declares that settled and pivots to **execution**: converged deployment architectures with real ratings and dates, engineering design rules ({{grounding}}, protection, fault control), a certification strategy built with UL Solutions, and a 12-month industry work plan. Its own closing words: the work is \"no longer about proving the feasibility of 800 VDC. It is about executing together.\"",
    "Three structural signals make it the steering document: **CSP alignment is explicit** - a joint Google / Microsoft / NVIDIA position from GTC Taipei 2026 covering the converged direction, phased AC/DC coexistence, common power-block sizing and redundancy philosophy, open OEM development, {{power smoothing}} requirements, and {{OCP}}-hosted standards work. **The equipment scope is bounded** - a deliberately limited set of deployable configurations so OEMs stop spreading engineering across incompatible designs. **Coexistence is doctrine** - 800 VDC \"is not intended to replace existing 415/480 VAC systems\"; every option overlays existing AC facilities, and the {{DSX}} reference design gains 800 VDC options rather than being replaced.",
    "Equally important is what is *absent*: no efficiency percentages, no copper-savings claims, no TCO math. The sales numbers you know (+157% power through the same copper, -45% copper, ~+5% efficiency) come from the **October 2025 paper** - this one is engineering execution, and its business-value study is explicitly future work (p34)."
   ],
   "sales": "When a counterpart cites efficiency numbers, know which paper they came from. This paper's authority is architectural: it defines the slots, the ratings, and the calendar."
  },
  {
   "id": "roadmap",
   "title": "The rack power roadmap (Gen 1 → 4)",
   "read": "4 min",
   "kind": "timeline",
   "intro": "Figure 3 (\"800 VDC Imperative\", p7) maps rack generations against an approximate 2024-2032 axis with 72-GPU and 144-GPU trendlines. Positions below are approximate per that figure; ratings and dates in gold/blue are stated in the text.",
   "lanes": {
    "gen": "Rack generations",
    "deploy": "Deployment milestones",
    "eco": "Ecosystem"
   },
   "items": [
    {
     "x": 2024.6,
     "lane": "gen",
     "label": "Gen 1 - GB200/GB300",
     "sub": "145 kW - 54 VDC in-rack, 60 A whips, 8-to-make-6 (p7)"
    },
    {
     "x": 2026.0,
     "lane": "gen",
     "label": "Gen 2 - Vera Rubin NVL72",
     "sub": "330 kW - AC and DC input options: the hinge generation (p7)"
    },
    {
     "x": 2027.6,
     "lane": "gen",
     "label": "Gen 3",
     "sub": "570 kW - 100% liquid-cooled shelves, 800 VDC into the PSUs (p7)"
    },
    {
     "x": 2029.6,
     "lane": "gen",
     "label": "Gen 4 - native 800 VDC",
     "sub": "~1 MW-class; facility power down-converted at point of load (p7)"
    },
    {
     "x": 2026.6,
     "lane": "deploy",
     "label": "Option A Power Rack production",
     "sub": "Q3 2026 - ~660 kW rack-level conversion (p11)"
    },
    {
     "x": 2027.6,
     "lane": "deploy",
     "label": "Option B Power Center deployment",
     "sub": "as soon as Q3 2027 - 1.6 MW units, 4.8 MW clusters (p17, p19)"
    },
    {
     "x": 2028.3,
     "lane": "deploy",
     "label": "Option C DC Power Blocks",
     "sub": "4.8 MW TRU/SST blocks, containerized; 20 MW Deployment Units (p18-20)"
    },
    {
     "x": 2025.75,
     "lane": "eco",
     "label": "First 800 VDC white paper",
     "sub": "October 2025 - the feasibility argument (p4)"
    },
    {
     "x": 2026.35,
     "lane": "eco",
     "label": "GTC Taipei: Google + Microsoft + NVIDIA",
     "sub": "joint alignment on 800 VDC for AI factories (p6)"
    },
    {
     "x": 2026.62,
     "lane": "eco",
     "label": "This paper - shift to execution",
     "sub": "August 2026 - architectures, engineering, certification (p4)"
    },
    {
     "x": 2029.2,
     "lane": "eco",
     "label": "Next-gen SST target",
     "sub": "\"expected to be launched toward 2029\" - unlocks 34.5 kV MV-direct (p23)"
    }
   ],
   "sales": "The 2029 date belongs to next-gen SST specifically. TRU-based power blocks are being specified now - the competitive window for a shipping TRU fleet is real but tighter than 'nothing until 2029.'"
  },
  {
   "id": "power",
   "title": "Rack power by generation",
   "read": "1 min",
   "kind": "bars",
   "unit": "kW per rack",
   "items": [
    {
     "label": "Gen 1 - GB200/GB300",
     "v": 145,
     "sub": "54 VDC"
    },
    {
     "label": "Gen 2 - VR NVL72",
     "v": 330,
     "sub": "54 VDC, AC+DC input"
    },
    {
     "label": "Gen 3",
     "v": 570,
     "sub": "800 VDC into PSUs"
    },
    {
     "label": "Gen 4 - native 800 VDC",
     "v": 1000,
     "sub": "~1 MW-class (planned)"
    }
   ],
   "note": "Gen 4 plotted at the ~1,000 kVA band shown in Figure 3; the text says \"megawatt-class\" (p7). Why voltage must rise: NVLink packs GPUs within copper reach, density outruns 54 VDC current practicality, and 800 VDC \"significantly reduces current and shrinks the power distribution footprint\" (p7)."
  },
  {
   "id": "options",
   "title": "The four deployment architectures",
   "read": "7 min",
   "kind": "proscons",
   "intro": "The paper's core claim (p8): these are \"not sequential requirements, but flexible deployment options.\" All coexist inside the {{DSX}} reference design, and the 800 VDC scope is deliberately confined to the GPU-compute slice of the electrical plan so upstream facility design survives. Pick by facility, timeline, and density.",
   "cards": [
    {
     "t": "Existing - AC baseline",
     "meta": "480 VAC to the rack · today's default",
     "adv": [
      "Fully supported; the coexistence anchor",
      "No new certification or grounding work",
      "Known supply chain, known electricians"
     ],
     "dis": [
      "100 A AC whips, 4-to-make-3 feeds - interface complexity grows with density",
      "Conversion to low-voltage DC inside every rack",
      "Runs out of road as racks pass the hundreds-of-kW mark"
     ]
    },
    {
     "t": "Option A - Power Rack (rack-level)",
     "meta": "~660 kW · production Q3 2026 · UL 62368-1 certifiable now",
     "adv": [
      "Fastest path - zero upstream facility change",
      "Standard 19-inch rack; point-to-point 125 A interlocked DC whips (no busbar)",
      "BBU option: 4 x 20 kW = 80 kW for 60 s, N+1",
      "Any {{MGX}}-form-factor rack becomes 800 VDC-capable via the 800→54 V shelf (6 x 15 kW)"
     ],
     "dis": [
      "Consumes row footprint next to compute",
      "12-24 x 100 A AC whips per Power Rack to manage",
      "Existing row-level AC capacity may need validation",
      "Density ceiling - explicitly a bridge, not the destination"
     ]
    },
    {
     "t": "Option B - Power Center (cluster-level)",
     "meta": "up to 2 MW; deployed ~1.6 MW in 4-to-make-3 = 4.8 MW clusters · as soon as Q3 2027",
     "adv": [
      "Eliminates side Power Racks - white space back",
      "Selective row-by-row 800 VDC inside an AC hall; retrofit without touching upstream electrical rooms",
      "Mature rectifier families: aggregated SiC shelves or IGBT UPS-derived",
      "Controlled 800 VDC exposure zones; overhead busway + 125 A {{tap can}}s"
     ],
     "dis": [
      "New certification chain: busway, tap cans, DC breakers, connectors",
      "Facility-grade grounding and protection coordination now required",
      "MCCB clearing at the 125 A branch can reach ~20 ms - SSCBs not assumed Day 1",
      "Depends on the OEM ecosystem delivering (multiple OEMs actively developing)"
     ]
    },
    {
     "t": "Option C - DC Power Block (data-hall level)",
     "meta": "~4.8 MW blocks (5 MVA/4.8 MW) · 6000 A switchboard · 20 MW Deployment Units",
     "adv": [
      "Fewest conversion stages; MV AC → transformer → rectification → DC switchboard → 1250 A busways",
      "Block-redundant 4+1 catcher via DC {{STS}} - DC needs no phase synchronization",
      "Modularized outdoor containerized packages: prefab, factory-tested, less indoor electrical room",
      "Scales as 20 MW DUs (4 Scalable Units) toward gigawatt campuses; ready for ~1 MW native racks and 8 MW clusters at 1+1",
      "Future flexibility: DC UPS with batteries, BESS, renewables, DC microgrid"
     ],
     "dis": [
      "Biggest certification and {{AHJ}} lift of the three",
      "TRU/SST supply chain still forming",
      "Whole-hall architectural commitment rather than incremental adoption"
     ]
    },
    {
     "t": "Option C next-gen - MV direct conversion",
     "meta": "34.5 kV AC → 800 VDC · ~10 MW blocks · future roadmap",
     "adv": [
      "Eliminates intermediate LV stages entirely",
      "Named enabler: matured SSTs - high density, compact, integrated control",
      "Simplified expansion for multi-hundred-MW and GW-scale factories"
     ],
     "dis": [
      "Explicitly \"beyond the deployment horizons of current 800 VDC architectures\"",
      "Gated on next-gen SST (~2029) and 34.5 kV-class development"
     ]
    }
   ],
   "sales": "Option C initial implementation is TRU-or-SST - and its containerized-prefab definition matches what containerized TRU suppliers already ship. The competitive question a buyer will ask any supplier whose modules are rated below the standard block: how does the lineup compose into NVIDIA's standardized 4.8 MW blocks, 1250 A busways and tap-can interfaces?"
  },
  {
   "id": "trusst",
   "title": "TRU vs SST - and the Panama name-check",
   "read": "4 min",
   "kind": "table",
   "intro": "The paper's own device-class framing (p21-23). Three TRU implementation families are named: IGBT UPS-derived conversion; aggregated SiC power shelves behind front-end transformers; and **the \"Panama Architecture\"** - a line-frequency phase-shifting transformer at the MV entry feeding centralized rectification, relying \"more heavily on passive magnetic components, offering a simpler and highly familiar design philosophy\" (p22).",
   "cols": [
    "",
    "TRU - the near-term block",
    "SST - the 2029 device"
   ],
   "rows": [
    [
     "Conversion",
     "Line-frequency transformer + centralized rectification",
     "High-frequency switching + high-frequency isolation transformer"
    ],
    [
     "Maturity",
     "\"Mature transformer technologies\" - utility/industrial precedent",
     "\"Actively evaluated as a potential future implementation path\""
    ],
    [
     "Fault behavior",
     "\"Strong fault isolation capability\"",
     "Integrated control; current-limiting by design"
    ],
    [
     "MV compatibility",
     "\"Improved compatibility with existing 34.5 kV utility distribution\"",
     "Today ~15 kV-class; 34.5 kV needs insulation, protection, thermal, interconnection work"
    ],
    [
     "Practical scale",
     "\"Highly practical for approximately 5 MW-class power block deployment\"",
     "Future blocks toward ~10 MW as the tech matures"
    ],
    [
     "Timing",
     "Initial Option C implementation - now",
     "\"Next generation SST is expected to be launched toward 2029\""
    ]
   ],
   "note": "Analysis: NVIDIA has formally blessed the TRU path - naming Panama as one of its three canonical implementations - for the first-deployed power-block slot. \"Mature magnetics, shipping today\" is now the reference document's own logic, not just a vendor pitch.",
   "sales": "The 'simpler and highly familiar' phrase is verified at p22, and the document is in the repo. Cite it as 'NVIDIA's August 2026 white paper' and paraphrase in customer settings - the notice bars verbatim reproduction, and the paper names an architecture, not a company."
  },
  {
   "id": "faults",
   "title": "AC vs DC fault behavior (Table 1)",
   "read": "4 min",
   "kind": "table",
   "intro": "The genuinely new technical territory. The counter-intuitive teaching point: DC's weakness (no zero crossing) is paired with a structural strength - **converter-fed systems can limit fault current at the source**, which a stiff AC utility feed cannot. The paper's whole arc-flash strategy stands on that: reduce available current (I) via current-limited sources, reduce clearing time (t) via {{SSCB}}s (p32).",
   "cols": [
    "Topic",
    "AC behavior",
    "DC behavior",
    "Key consideration"
   ],
   "rows": [
    [
     "Fault current",
     "Natural zero-crossings every cycle",
     "**Continuous - no zero-crossing**",
     "Faster interruption, current limiting, arc-fault detection"
    ],
    [
     "Fault energy",
     "Higher contribution from utility and rotating machines",
     "**Often lower in converter-limited systems**",
     "Depends on source type and control architecture"
    ],
    [
     "Shock hazard",
     "Can cause muscle lock-on",
     "Often a single muscle contraction",
     "Strict personnel protection either way"
    ],
    [
     "Protection devices",
     "Mechanical breakers widely used",
     "**SSCBs and hybrid breakers - ultra-fast clearing**",
     "Faster clearing = less fault energy"
    ],
    [
     "Ground-fault detection",
     "Overcurrent + ground-fault relays",
     "**{{IMD}} and/or {{RCM}} commonly required**",
     "Depends on grounding architecture"
    ],
    [
     "Series arcing",
     "Periodically weakened; easier to self-extinguish",
     "**Can sustain; harder to extinguish**",
     "Connector design + arc detection critical"
    ],
    [
     "Parallel arcing / arc flash",
     "High fault current, significant arc-flash energy",
     "Converter-limited systems may reduce incident energy",
     "Current limiting + rapid isolation"
    ]
   ],
   "note": "Row labels verified against p24. This table is the vocabulary of every 800 VDC engineering conversation for the next two years."
  },
  {
   "id": "grounding",
   "title": "Grounding: four schemes under evaluation",
   "read": "4 min",
   "kind": "table",
   "intro": "800 VDC distribution is **two-wire** - positive and return conductors - so grounding architecture decides both personnel safety and fault detectability (p24-26). Four candidates:",
   "cols": [
    "Scheme",
    "Mechanism",
    "Strengths",
    "Weaknesses"
   ],
   "rows": [
    [
     "**HRMG** - high-resistance midpoint",
     "Midpoint resistor network grounds both conductors symmetrically",
     "Balanced conductor-to-ground voltages; better EMC; **uniform detection on both conductors**; keeps operating after a first fault",
     "More components; resistor sizing discipline"
    ],
    [
     "**HRRG** - high-resistance return",
     "Return conductor grounded through resistance",
     "Same current-limiting benefit; simpler",
     "**Delayed detection of return-conductor faults**"
    ],
    [
     "Floating / ungrounded",
     "No intentional ground",
     "Near-zero first-fault current; rides through one fault",
     "Leakage and capacitance still create paths; **detection and location are hard** - needs IMD + locator systems"
    ],
    [
     "Solid",
     "Return bonded to ground",
     "Simplest; **fast, sensitive detection**; may suit future native racks",
     "**Highest fault current** - needs fast devices and minimal ground-bond impedance"
    ]
   ],
   "note": "The paper's lean, reading p25: HRMG \"provides a more uniform fault monitoring, earlier fault identification, and improved system reliability while maintaining low ground-fault current levels.\" The final choice is deferred to system-level studies - so in conversation, say 'under evaluation, HRMG favored on balance.'"
  },
  {
   "id": "zones",
   "title": "Protection zones, the interlock, and SSCBs",
   "read": "5 min",
   "kind": "prose",
   "ps": [
    "**Two protection zones (p26-27).** The *Facility Distribution Zone* (TRU/SST output → tap-can input) is qualified-personnel territory: continuous {{IMD}}/IRM insulation monitoring, alarms **without** immediate shutdown to preserve service, and protective relays that coordinate fast source shutdown through the rectifiers on real overcurrent. The *Rack Interface Zone* (tap can → compute rack) sees the most human hands, so it gets {{RCM}} for fast leakage detection and the strictest hardware discipline.",
    "**The interlock sequence (p27)** is EV-charging lineage made explicit: the 125 A DC whip is hardwired to the tap can behind a normally-open contactor and **stays de-energized during installation and removal**. The rack-side connector's mechanical lock must engage before an enable signal closes the upstream contactor; on release, the contactor opens *before* the connector unlocks. Nothing is hot in a human hand.",
    "**SSCBs (p27-29)** interrupt electronically before fault current peaks - sub-millisecond isolation versus several milliseconds - slashing let-through energy (I²t), damage and arc-flash risk. NVIDIA's two target ratings: **125 A air-cooled** for the 800→54 V shelves inside compute racks, and **1250 A, likely liquid-cooled**, for future native-800 VDC rack interfaces; the practical ceiling of air-cooled SSCB current is under evaluation. The sober counterweight: **MCCBs remain the primary Day-1 branch device** (availability, supply chain, certification familiarity) with ~20 ms clearing at 125 A branches. Figure 15 (Siemens data, 200 A/µs rise) shows the shape: a fuse peaks near 9.4 kA around 3 ms; a thermal-mag breaker near 5.7 kA clearing in ~6-7 ms; a hybrid in ~2.5 ms; the SSCB holds current near zero inside a millisecond. *(Chart values read from an image - treat as shape, not datasheet.)*",
    "**Power smoothing moves rack-side (p4).** AI training's synchronized swings are tamed *at the compute rack*: \"localized peak shaving, power smoothing, and slew rate control using minimal energy storage (e.g., electrolytic capacitors)\" so the grid sees a stable rack interface; facility/BTM storage is optional for interconnection needs. The 1,200 J per PSU (p12) is that philosophy in hardware."
   ],
   "sales": "Grid-code compliance is where ERCOT knowledge composes with this: NVIDIA specifies the rack-interface behavior; NOGRR282/FERC govern the facility's behavior at the meter. Deep storage on the DC bus remains the compliance-by-construction story for ride-through - and off-grid, generator protection."
  },
  {
   "id": "cert",
   "title": "Certification, regulation, and the 12-month plan",
   "read": "3 min",
   "kind": "prose",
   "ps": [
    "**System-level requirements first (p31).** The stated lesson of the alignment year: \"equipment certification alone is insufficient.\" Eight workstreams define the system contract - power quality, voltage regulation and transient limits, {{power smoothing}} expectations, grounding methodologies, protection coordination, fault-current management, rack interface requirements, and end-to-end stability criteria. Simulation comes before hardware: frequency-domain stability, source output impedance and module sharing, distribution inductance restrictions, ripple limits - so multi-OEM interoperability is designed in, not discovered.",
    "**The regulatory strategy is reuse, not invention (p31, p33).** Work with UL Solutions, OEMs and operators; lean on existing frameworks (the Power Rack is already certifiable under UL 62368-1 for UL and IEC regions); engage UL, NFPA, IEEE and IEC on the targeted gaps - DC grounding and protection methods, arc-flash evaluation methodology, busway/connector/breaker qualification, installation safety. {{AHJ}} enablement gets its own workstream: installation best practices, inspection guidelines, commissioning procedures and training so local inspectors can approve these builds.",
    "**The next 12 months (p4, p32-34):** accelerate equipment development, validate system-level performance, run pilot deployments, and advance standards - plus, explicitly future work, FAT/SAT operational procedures and a **business value and reliability assessment**. The TCO case is promised, not delivered, in this paper."
   ]
  },
  {
   "id": "suppliers",
   "title": "For TRU and SST suppliers",
   "read": "4 min",
   "kind": "callout",
   "ps": [
    "**1 - The quote is verified, in hand.** Page 22 names the \"Panama Architecture\" as a TRU implementation with the exact phrase - *\"a simpler and highly familiar design philosophy.\"* Cite it as NVIDIA's August 2026 white paper; paraphrase in customer settings (the notice bars verbatim reproduction) and remember it names an architecture, not any company - it puts nobody on a roster.",
    "**2 - The window holds but tightens.** The 2029 date attaches to **next-gen SST** and MV-direct conversion specifically. TRU-based ~4.8 MW blocks are being specified now, containerized, with OEMs converging - and Option B hits deployment as soon as Q3 2027. The defensible claim for any TRU supplier with a delivered fleet: *the industry's own reference document says the near-term block is a TRU, while the SST future arrives ~2029.* The edge is a shipping fleet and prefab maturity, not an empty Western calendar.",
    "**3 - 4.8 MW is the block to answer for.** NVIDIA standardizes 4.8 MW blocks, 4+1 catcher STS, 6000 A switchboards, 1250 A busways, tap-can interfaces, 20 MW Deployment Units. Suppliers whose module ratings sit below 4.8 MW must prepare the composition story: paralleling to 4.8 MW, busway and tap-can interface compatibility, catcher participation.",
    "**4 - Prefab containers are now table stakes.** Option C is *defined* as modularized, factory-tested, containerized delivery. The differentiator shifts to delivered fleet history at these voltages and speed-to-power - 'shipping the 2027 slot today.'",
    "**5 - Vocabulary upgrade.** HRMG/HRRG grounding, IMD/RCM monitoring, the two protection zones, interlocked 125 A whips, SSCB ratings (125 A air / 1250 A liquid), 4+1 catcher STS. Fluency here is what 'knows the space' sounds like in late 2026."
   ]
  },
  {
   "id": "ledger",
   "title": "Claims ledger - every number, page-referenced",
   "read": "reference",
   "kind": "ledger",
   "intro": "Independently verified by two extraction passes over the source PDF. Use these as citations in dossier work.",
   "rows": [
    [
     "Gen 1 (GB200/GB300): 145 kW, 54 VDC, 60 A whips, 8-to-make-6",
     "p7"
    ],
    [
     "Gen 2 (Vera Rubin NVL72): 330 kW, AC and DC input options",
     "p7"
    ],
    [
     "Gen 3: 570 kW, 100% liquid-cooled shelves, 800 VDC into PSUs",
     "p7"
    ],
    [
     "Gen 4: native 800 VDC, ~1 MW-class (Fig 3 band ~1,000 kVA), axis 2024-2032",
     "p7"
    ],
    [
     "Existing baseline: 480 VAC, 100 A whips, 4-to-make-3",
     "p9"
    ],
    [
     "Option A Power Rack: ~660 kW; production Q3 2026",
     "p10-11"
    ],
    [
     "Power Rack input: 12 x 100 A whips, IEC 60309, 415-480 VAC 3-phase, no neutral",
     "p12"
    ],
    [
     "Power Rack shelves: 6 x 18.3 kW PSUs, air-cooled, 1,200 J each",
     "p12"
    ],
    [
     "BBU option: 4 x 20 kW = 80 kW for 60 s, N+1; 125 A 800 VDC cross cables",
     "p12-13"
    ],
    [
     "Compute-rack DC shelf: 800→54 V, 6 x 15 kW PSUs (MGX); ~90 kW 1RU",
     "p13-14"
    ],
    [
     "Power Rack certified under UL 62368-1; UL + IEC regions",
     "p14"
    ],
    [
     "Next-gen Power Rack: 100% liquid-cooled; 55 kW/RU shelves",
     "p14"
    ],
    [
     "Option B Power Center: adjustable to 2 MW; ~1.6 MW x 4-to-make-3 = 4.8 MW cluster",
     "p15, p19"
    ],
    [
     "Option B distribution: 1250 A feeders, overhead busway, 125 A tap cans (MCCB/SSCB)",
     "p15"
    ],
    [
     "MCCB clearing at 125 A branch: up to ~20 ms",
     "p16"
    ],
    [
     "Option B deployment as soon as Q3 2027; multiple OEMs developing",
     "p17"
    ],
    [
     "Option C: ~4.8 MW blocks (5 MVA/4.8 MW), 6000 A switchboard, parallel 1250 A busways",
     "p18-21"
    ],
    [
     "Option C redundancy: 4+1 catcher via DC STS - no phase-sync needed on DC",
     "p19"
    ],
    [
     "20 MW Deployment Unit = 4 Scalable Units; ~1 MW native racks; 8 MW clusters 1+1",
     "p20"
    ],
    [
     "Option C delivery: modularized outdoor containerized packages, factory-tested",
     "p18"
    ],
    [
     "TRU: mature, strong fault isolation, 34.5 kV-compatible, practical at ~5 MW-class",
     "p21-22"
    ],
    [
     "TRU approaches: IGBT UPS-derived; aggregated SiC shelves; \"Panama Architecture\" (\"simpler and highly familiar\")",
     "p22"
    ],
    [
     "SST: ~15 kV-class today; 34.5 kV needs development; next-gen toward 2029",
     "p22-23"
    ],
    [
     "MV direct: 34.5 kV AC → 800 VDC, ~10 MW blocks, future roadmap",
     "p23"
    ],
    [
     "800 VDC is two-wire; grounding candidates HRMG / HRRG / floating / solid",
     "p24-25"
    ],
    [
     "Two protection zones: facility (IMD/IRM) and rack interface (RCM); whip de-energized until locked",
     "p26-27"
    ],
    [
     "SSCB targets: 125 A air-cooled and 1250 A liquid-cooled; MCCB primary Day 1",
     "p28-29"
    ],
    [
     "Fig 15 (Siemens, 200 A/µs): fuse ~9.4 kA peak; thermal-mag ~5.7 kA ~6-7 ms; hybrid ~2.5 ms; SSCB sub-ms (approx, read from image)",
     "p29-30"
    ],
    [
     "Google/Microsoft/NVIDIA alignment at GTC Taipei 2026; OCP is the standards forum",
     "p5-6"
    ],
    [
     "Power smoothing at the rack with minimal storage; facility/BTM storage optional",
     "p4"
    ],
    [
     "Certification: system-level requirements first; UL Solutions collaboration; AHJ enablement",
     "p30-33"
    ],
    [
     "Future work: FAT/SAT practices; business-value/TCO study still to come",
     "p34"
    ],
    [
     "Coexistence doctrine: 800 VDC complements 415/480 VAC - no replacement",
     "p4, p35"
    ],
    [
     "Next 12 months: equipment development, validation, pilots, standards/regulatory",
     "p4"
    ]
   ]
  },
  {
   "id": "guardrails",
   "title": "What the paper does NOT say",
   "read": "1 min",
   "kind": "callout",
   "tone": "warn",
   "ps": [
    "**No efficiency percentages, copper-savings figures, or TCO numbers** - those live in the October 2025 paper and vendor decks. Do not attribute them to this document.",
    "**No power-equipment vendor names** beyond the Siemens chart credit and UL Solutions. \"Panama\" names an architecture, not a company - it is not a roster.",
    "**No TRU-vs-SST efficiency comparison** - only qualitative attributes.",
    "**No AC retirement** - coexistence \"for the foreseeable future\" (p35)."
   ]
  },
  {
   "id": "cards",
   "title": "Flashcards",
   "read": "drill",
   "kind": "flashcards",
   "cards": [
    {
     "q": "Rack power by generation, Gen 1 → 4?",
     "a": "145 kW (GB200/GB300) → 330 kW (Vera Rubin NVL72) → 570 kW → ~1 MW-class native 800 VDC. (p7)"
    },
    {
     "q": "Which generation is the hinge, and why?",
     "a": "Gen 2 (VR NVL72, 330 kW): the first with both AC and DC input options - the coexistence pivot in hardware. (p7)"
    },
    {
     "q": "Option A in one line?",
     "a": "Power Rack: ~660 kW of rack-level AC→800 VDC conversion in a 19-inch rack, 125 A interlocked DC whips, production Q3 2026, UL 62368-1. (p10-14)"
    },
    {
     "q": "Option B in one line?",
     "a": "Power Center: end-of-row rectification, ~1.6 MW units in 4-to-make-3 for 4.8 MW clusters, overhead 800 VDC busway + 125 A tap cans, deployment as soon as Q3 2027. (p14-17)"
    },
    {
     "q": "Option C in one line?",
     "a": "DC Power Block: ~4.8 MW TRU/SST blocks at the hall edge, 6000 A switchboard, 1250 A busways, 4+1 catcher via DC STS, 20 MW Deployment Units, containerized delivery. (p17-21)"
    },
    {
     "q": "The two Power Rack storage numbers?",
     "a": "1,200 J per PSU for input-current shaping; BBU option 4 x 20 kW = 80 kW for 60 seconds. (p12)"
    },
    {
     "q": "Why can DC sources be *safer* than AC on fault energy?",
     "a": "Converter-fed systems can current-limit at the source (rectifiers, DC/DCs, batteries), so available fault current - and arc-flash incident energy - can be engineered down. AC utility feeds cannot do this. (p24, p32)"
    },
    {
     "q": "The four grounding candidates - and the paper's lean?",
     "a": "HRMG, HRRG, floating, solid. HRMG favored on balance: symmetric grounding, uniform detection on both conductors, operation continues after a first fault. Final choice deferred to system studies. (p24-26)"
    },
    {
     "q": "The two protection zones?",
     "a": "Facility Distribution Zone (TRU/SST output → tap cans): IMD/IRM monitoring, alarm-before-shutdown. Rack Interface Zone (tap can → rack): RCM, interlocked de-energized whips. (p26-27)"
    },
    {
     "q": "Recite the interlock sequence.",
     "a": "Whip hardwired to tap can behind a normally-open contactor → connector mechanically locks at the rack → enable signal closes the contactor → power flows. Release: contactor opens BEFORE the lock releases. (p27)"
    },
    {
     "q": "NVIDIA's two SSCB target ratings?",
     "a": "125 A air-cooled (800→54 V shelves inside compute racks) and 1250 A likely liquid-cooled (future native-800 VDC rack interfaces). MCCBs remain the Day-1 device (~20 ms at 125 A). (p16, p28-29)"
    },
    {
     "q": "TRU vs SST in two lines?",
     "a": "TRU: line-frequency transformer + rectification - mature, strong fault isolation, 34.5 kV-compatible, practical at ~5 MW-class. SST: kHz switching + HF isolation - denser and controllable, but ~15 kV-class today; next-gen toward 2029. (p21-23)"
    },
    {
     "q": "What exactly does the paper say about 'Panama'?",
     "a": "One of three TRU implementation approaches: a line-frequency phase-shifting transformer at the MV entry feeding centralized rectification - passive magnetics, 'a simpler and highly familiar design philosophy.' (p22)"
    },
    {
     "q": "The standardized building blocks of Option C scale-out?",
     "a": "4.8 MW power blocks → 20 MW Deployment Unit (4 Scalable Units) → replicate toward hundreds of MW and GW-scale factories. (p19-20)"
    },
    {
     "q": "Who aligned publicly, where, and in what forum does the standards work live?",
     "a": "Google, Microsoft and NVIDIA at GTC Taipei 2026; open standards work hosted at OCP. (p5-6)"
    },
    {
     "q": "What business question does this paper explicitly NOT answer yet?",
     "a": "TCO / business value - a 'Business Value and Reliability Assessment' is listed as future work. Efficiency percentages live in the October 2025 paper. (p34)"
    }
   ]
  },
  {
   "id": "quiz",
   "title": "Self-test",
   "read": "10 questions",
   "kind": "quiz",
   "items": [
    {
     "q": "A colleague says 'NVIDIA's roadmap replaces AC with 800 VDC.' The paper's actual position?",
     "c": [
      "Correct - AC is deprecated at Gen 4",
      "800 VDC complements and coexists with 415/480 VAC; adoption is incremental by option",
      "AC remains only for network/support racks",
      "Undefined - left to operators"
     ],
     "a": 1,
     "why": "Coexistence is doctrine (p4, p35): options overlay existing AC facilities; DSX keeps AC-based pods fully supported."
    },
    {
     "q": "Which statement about Gen 3 racks is right?",
     "c": [
      "330 kW with AC input only",
      "570 kW, 100% liquid-cooled shelves, 800 VDC into the PSUs",
      "145 kW on 60 A whips",
      "Native 800 VDC in-rack distribution"
     ],
     "a": 1,
     "why": "Gen 3 = 570 kW, liquid-cooled shelves, 800 VDC into the PSUs; native 800 VDC in-rack is Gen 4 (p7)."
    },
    {
     "q": "Option B's cluster math is…",
     "c": [
      "2 MW x 2 = 4 MW",
      "1.6 MW x 4-to-make-3 = 4.8 MW effective",
      "4.8 MW x 4+1 catcher",
      "660 kW x 8"
     ],
     "a": 1,
     "why": "~1.6 MW Power Centers in 4-to-make-3 redundancy give 4.8 MW effective cluster capacity (p19). 4+1 catcher belongs to Option C."
    },
    {
     "q": "Why does Option C's DC STS catcher work more simply than an AC transfer switch?",
     "c": [
      "DC contacts are smaller",
      "DC sources need no phase synchronization to parallel or transfer",
      "It uses fuses instead of breakers",
      "The catcher is never loaded"
     ],
     "a": 1,
     "why": "Unlike AC, DC sources parallel/transfer through voltage regulation and current sharing - no phase sync (p19)."
    },
    {
     "q": "The whip you can touch during install is safe because…",
     "c": [
      "It is only 54 V",
      "Rubber shrouds",
      "It is de-energized until the connector locks and an enable signal closes the upstream contactor",
      "Current is limited to 5 A"
     ],
     "a": 2,
     "why": "Normally-open contactor + mechanical lock + enable signal; on release the contactor opens before unlock (p27)."
    },
    {
     "q": "Which grounding scheme detects faults uniformly on BOTH conductors and keeps operating after a first fault?",
     "c": [
      "Solid",
      "Floating",
      "HRRG",
      "HRMG"
     ],
     "a": 3,
     "why": "HRMG's midpoint resistor network grounds both conductors symmetrically - uniform monitoring, earlier identification, continued operation (p25)."
    },
    {
     "q": "Day 1 at a 125 A tap can, the branch protection is most likely…",
     "c": [
      "A 1250 A SSCB",
      "An MCCB with clearing up to ~20 ms",
      "A fuse only",
      "A hybrid breaker mandated by UL"
     ],
     "a": 1,
     "why": "MCCBs are the practical Day-1 device on availability and certification grounds; SSCBs are the long-term preference (p16, p29)."
    },
    {
     "q": "DC arc-flash strategy in the paper reduces incident energy by…",
     "c": [
      "Bigger enclosures",
      "Reducing available fault current at sources AND clearing time via SSCBs",
      "PPE requirements only",
      "Lowering the bus to 400 V"
     ],
     "a": 1,
     "why": "Incident energy is I and t: current-limited sources cut I; SSCB-class interruption cuts t (p32)."
    },
    {
     "q": "What does the paper say about SST readiness for hyperscale MV?",
     "c": [
      "Ready now at 34.5 kV",
      "Most platforms are ~15 kV-class; 34.5 kV needs development; next-gen toward 2029",
      "SST is rejected in favor of TRU permanently",
      "SSTs are only for EV charging"
     ],
     "a": 1,
     "why": "p22-23: 15 kV-class today, 34.5 kV work needed, next-gen SST expected toward 2029 - the future path, not the present one."
    },
    {
     "q": "Which claim should you NOT attribute to this paper?",
     "c": [
      "4.8 MW standardized power blocks",
      "'~+5% end-to-end efficiency vs AC'",
      "125 A / 1250 A SSCB targets",
      "Power Rack production Q3 2026"
     ],
     "a": 1,
     "why": "Efficiency and copper numbers come from the October 2025 paper; this one deliberately omits the sales math (analysis section 11)."
    }
   ]
  }
 ],
 "glossary": [
  {
   "t": "DSX",
   "d": "NVIDIA's reference design framework for AI-factory deployment - pod architecture, rack methodology, power/cooling integration. Today standardizes AC-based (480 VAC) GPU pods; gaining 800 VDC options."
  },
  {
   "t": "OCP",
   "d": "Open Compute Project - the open-standards forum where the 800 VDC data-hall architecture work and lessons-learned sharing are hosted."
  },
  {
   "t": "Power Rack",
   "d": "Option A's 19-inch rack of AC→800 VDC power shelves placed beside compute racks; ~660 kW initially; production Q3 2026."
  },
  {
   "t": "Power Center",
   "d": "Option B's end-of-row rectification unit - adjustable to 2 MW, deployed ~1.6 MW in 4-to-make-3 for 4.8 MW clusters."
  },
  {
   "t": "DC Power Block",
   "d": "Option C's hall-edge conversion block (~4.8 MW, drawn 5 MVA/4.8 MW): MV in, transformer, rectification, 6000 A DC switchboard, 1250 A busways out."
  },
  {
   "t": "TRU",
   "d": "Transformer Rectifier Unit - line-frequency transformer plus centralized rectification. Mature, strong fault isolation, 34.5 kV-compatible, practical at ~5 MW-class."
  },
  {
   "t": "SST",
   "d": "Solid-State Transformer - high-frequency switching with high-frequency isolation. Denser and controllable; ~15 kV-class today; next-gen expected toward 2029."
  },
  {
   "t": "Panama Architecture",
   "d": "A TRU approach named in the paper: line-frequency phase-shifting transformer at the MV entry, multiple phase-shifted AC outputs, centralized rectification - passive magnetics, 'simpler and highly familiar.'"
  },
  {
   "t": "BBU",
   "d": "Battery Backup Unit - in Option A: 4 x 20 kW shelves giving 80 kW for 60 seconds, N+1."
  },
  {
   "t": "PSU",
   "d": "Power Supply Unit. Power Rack shelves use 6 x 18.3 kW (AC→800 V, 1,200 J each); compute racks use 6 x 15 kW (800→54 V)."
  },
  {
   "t": "MGX",
   "d": "NVIDIA's modular rack/server form factor; any MGX rack gains 800 VDC capability via the 800→54 V power shelf."
  },
  {
   "t": "tap can",
   "d": "The 125 A branch take-off box on the 800 VDC busway - houses branch protection (MCCB or SSCB) and feeds the interlocked power whip."
  },
  {
   "t": "power whip",
   "d": "The flexible branch cable from tap can (or facility) to a rack. AC: 100 A whips. DC: 125 A interlocked, de-energized until locked."
  },
  {
   "t": "busway",
   "d": "Overhead prefabricated power distribution bus. Option B/C row-level: 1250 A, 800 VDC."
  },
  {
   "t": "STS",
   "d": "Static Transfer Switch - solid-state source transfer. Option C uses a DC STS for 4+1 block-catcher redundancy; DC needs no phase synchronization."
  },
  {
   "t": "catcher",
   "d": "A spare power block standing behind N active blocks (4+1), picking up load on block failure via the STS."
  },
  {
   "t": "Deployment Unit",
   "d": "Option C's 20 MW replication unit - four 4.8 MW Scalable Units - the building block toward GW-scale campuses."
  },
  {
   "t": "SSCB",
   "d": "Solid-State Circuit Breaker - interrupts electronically in sub-milliseconds, before fault current peaks, cutting I²t. NVIDIA targets 125 A air-cooled and 1250 A liquid-cooled."
  },
  {
   "t": "MCCB",
   "d": "Molded-Case Circuit Breaker - the mature mechanical device; Day-1 branch protection at ~20 ms clearing."
  },
  {
   "t": "IMD",
   "d": "Insulation Monitoring Device - continuously watches insulation resistance in the facility zone; degradation alarms before shutdown."
  },
  {
   "t": "RCM",
   "d": "Residual Current Monitoring - compares positive vs return current at tap cans to catch leakage/ground faults fast; preferred in the rack-interface zone."
  },
  {
   "t": "HRMG",
   "d": "High-Resistance Midpoint Grounding - both conductors grounded symmetrically through a midpoint resistor network. The paper's favored balance of safety and detectability."
  },
  {
   "t": "HRRG",
   "d": "High-Resistance Return Grounding - return conductor grounded through resistance; simpler than HRMG but slower to see return-side faults."
  },
  {
   "t": "AHJ",
   "d": "Authority Having Jurisdiction - the local electrical inspector/approver. The paper funds training and guidelines so AHJs can approve 800 VDC builds."
  },
  {
   "t": "grounding",
   "d": "How the DC system references earth - decides fault current magnitude, detection method, and personnel safety. Four schemes under evaluation."
  },
  {
   "t": "power smoothing",
   "d": "Taming AI training's synchronized load swings at the rack interface with minimal storage (electrolytic caps) - peak shaving and slew-rate control - so the grid sees a stable load."
  },
  {
   "t": "4-to-make-3",
   "d": "Redundancy scheme: four feeds/units sized so any three carry the load - one can fail with no capacity loss."
  },
  {
   "t": "I²t",
   "d": "Let-through energy - the integral of fault current squared over clearing time. What SSCBs minimize and equipment damage scales with."
  },
  {
   "t": "UL 62368-1",
   "d": "The IT/AV equipment safety standard the Option A Power Rack certifies under today - the reuse-existing-frameworks strategy in action."
  },
  {
   "t": "IEC 60309",
   "d": "The industrial connector family used for the Power Rack's 100 A AC input whips (4100P6W/P7W, 3-phase, no neutral)."
  }
 ]
};
}
// Content: The China Policy Stack for a BESS Seller (research synthesis, 2026-08-24).
// Derived from repository-information/industry-guidance/china-policy-stack-analysis.md;
// claims verified against statute text, IRS notices, USTR determinations, and law-firm analyses.
function guidanceDocChinaPolicy_() {
  return {
 "id": "china-policy-stack-2026-08",
 "group": "Market Access & Bankability",
 "title": "The China Policy Stack for a BESS Seller",
 "short": "The four federal machines constraining Chinese battery storage in the US - and the lanes that remain.",
 "source": {
  "doc": "Research synthesis - ~55 sources (statute text, IRS notices, USTR, Federal Register, law-firm analyses)",
  "publisher": "Internal analysis",
  "date": "August 2026",
  "pages": 6,
  "series": "Industry Guidance - policy module 1 of 3",
  "repo": "repository-information/industry-guidance/china-policy-stack-analysis.md"
 },
 "updated": "2026-08-24",
 "reviewBy": "2026-12-31",
 "revisions": [
  { "date": "2026-08-29",
    "note": "Generalized to supplier/buyer-group guidance - single-company analysis moved to the admin-lens report overlays; statutory company lists retained as objective fact." }
 ],
 "tiles": [
  {
   "k": "55% → 75%",
   "v": "the storage MACR ladder",
   "sub": "non-PFE cost floor, 2026 → 2030+ construction starts"
  },
  {
   "k": "~40.9%",
   "v": "the current tariff stack",
   "sub": "3.4 MFN + 25 §301 + 12.5 §301 forced-labor (Aug 2026)"
  },
  {
   "k": "Dec 31, 2025",
   "v": "the safe-harbor line",
   "sub": "begin construction by then → exempt from the MACR test"
  },
  {
   "k": "Oct 1, 2027",
   "v": "the DoD ban",
   "sub": "§154 names six makers; FY2026 NDAA phases FEOC-free 2028-31"
  }
 ],
 "sections": [
  {
   "id": "what",
   "title": "The four levers",
   "read": "4 min",
   "kind": "prose",
   "ps": [
    "Four separate federal machines constrain Chinese battery storage in the US, on four different legal levers: **tax law** (the OBBBA {{PFE}} rules attached to the §48E storage ITC), **trade law** (tariffs), **defense procurement law** (NDAA bans), and the **domestic-content adder**. They have different dates, different tests, and different remedies - conflating them is the most common seller error.",
    "The tax lever is the decisive one. Since July 4, 2025 the tax code disqualifies projects tied to prohibited foreign entities from the storage ITC - worth ~30%+ of a buyer's capex. Six makers are statutory {{SFE}}s **by name**: the code incorporates the FY2024 NDAA §154(b) list (CATL, BYD, Envision, EVE, Gotion, Hithium) directly - and any Chinese-organized company qualifies independently of the list. This is statute, not agency discretion - no delisting process short of Congress.",
    "The consequence chain to memorize: a 2026-construction-start BESS needs a {{MACR}} of at least 55% non-PFE manufactured-product cost. The battery pack is ~65.6% of that cost under the IRS tables - so a system built on listed-maker cells lands around 34% and loses the **entire ITC**, not a bonus. The escape: projects that began construction (tax rules) by **December 31, 2025** are exempt from the MACR test entirely.",
    "**Field note:** When a buyer says 'the FEOC thing', find out which lever they actually mean - tax eligibility, tariff cost, defense scope, or the adder. Each has a different answer and a different date."
   ]
  },
  {
   "id": "levers",
   "title": "The four machines side by side",
   "read": "3 min",
   "kind": "table",
   "cols": [
    "",
    "What it does",
    "Key dates",
    "Severity for listed suppliers"
   ],
   "rows": [
    [
     "Tax (OBBBA FEOC/PFE)",
     "Kills the §48E ITC for projects failing the MACR test; entity-level bans on SFE/FIE taxpayers",
     "Enacted Jul 4, 2025; MACR applies to post-2025 construction starts; 55% floor in 2026",
     "Decisive - full ITC loss on 2026+ starts with listed-maker cells"
    ],
    [
     "Trade (tariffs)",
     "~40.9% stacked duty on Chinese lithium-ion (HTS 8507.60.00) - cells and containers alike",
     "§301 25% from Jan 1, 2026; forced-labor 12.5% from Jul 24, 2026",
     "Real but survivable - a cost, not a prohibition; no exclusion process"
    ],
    [
     "Defense (NDAA)",
     "DoD cannot buy batteries from the six named makers; FEOC-free phase-in for defense batteries",
     "§154 ban Oct 1, 2027; FY2026 NDAA phases 2028-2031",
     "Narrow - commercial sales untouched, but the §154 list was written into the tax code"
    ],
    [
     "Domestic content (+10% adder)",
     "Bonus requires 50% (2026) / 55% (2027+) US manufactured-product content",
     "Notice 2025-08 tables: BESS maxes ~40% without a US-made cell",
     "Already lost - and moot once the base credit fails"
    ]
   ]
  },
  {
   "id": "macr",
   "title": "The storage MACR ladder",
   "read": "1 min",
   "kind": "bars",
   "unit": "% non-PFE manufactured-product cost required (§48E storage)",
   "items": [
    {
     "label": "2026 construction start",
     "v": 55,
     "sub": "current floor"
    },
    {
     "label": "2027",
     "v": 60,
     "sub": ""
    },
    {
     "label": "2028",
     "v": 65,
     "sub": ""
    },
    {
     "label": "2029",
     "v": 70,
     "sub": ""
    },
    {
     "label": "2030 and later",
     "v": 75,
     "sub": "steepest ladder in the statute"
    }
   ],
   "note": "Storage was deliberately given the steepest facility-level ladder (non-storage facilities run 40-60%). A listed-maker-cell system computes to ~34% - the pack/module is ~65.6% of manufactured-product cost under the IRS tables, and a listed maker's output (including its US assembly plants) counts as PFE-made."
  },
  {
   "id": "mechanics",
   "title": "Entity tests, MACR math, and the paper trail",
   "read": "6 min",
   "kind": "prose",
   "ps": [
    "**Who is a PFE.** Two routes: a **Specified Foreign Entity** ({{SFE}} - the §154(b) six by name, DoD §1260H companies, UFLPA-listed entities, and any company organized in or majority-owned from China/Russia/Iran/North Korea) or a **Foreign-Influenced Entity** ({{FIE}} - an SFE can appoint a board member or executive; a single SFE owns ≥25%; SFEs aggregate ≥40%; SFEs hold ≥15% of debt; or payments under a contract giving an SFE 'effective control'). A listed maker's US subsidiary that is ≥25% SFE-owned is an FIE → its US-assembled product is PFE-made for tax purposes. **US soil does not cleanse the product.**",
    "**The licensing kill-switch.** For IP-license deals signed on or after July 4, 2025, 'effective control' includes: licensor rights to specify component sources, direct operations, or limit IP use; royalties beyond year 10; service agreements longer than 2 years; or any license that fails to transfer all know-how needed to operate independently. Outright bona fide IP purchase is carved out. Ford's CATL-license plant proceeds under this standard (Ford owns site and equipment) - but every indicium is a diligence item tax counsel will run against any listed maker's license structure.",
    "**The paper trail.** IRS Notice 2026-15 (Feb 12, 2026) provides three interim safe harbors - Identification, Cost Percentage (use the Notice 2025-08 tables), and supplier Certification. Certifications must carry the supplier's EIN, be signed under penalties of perjury, and be retained six years; you cannot rely on one you have reason to doubt. Enforcement: a supplier penalty of the greater of 10% of the underpayment or $5,000 for false certifications; the substantial-understatement penalty trigger drops to 1% for energy-credit disallowances; and the IRS gets a 6-year statute of limitations. **A listed maker's entity cannot sign a non-PFE certification for its own product - and a seller should never facilitate one.**",
    "**Timing traps.** The taxpayer-level prohibition (no credit for an SFE/FIE claimant) applies to tax years beginning after July 4, 2025 regardless of construction date. The 10-year recapture rule (tax years beginning after July 4, 2027) claws back the full ITC if the owner makes an effective-control payment to an SFE post-COD - which is why buyers will keep post-COD service contracts with listed suppliers short and non-exclusive; sellers should structure for that rather than fight it."
   ]
  },
  {
   "id": "timeline",
   "title": "The policy timeline, 2023-2031",
   "read": "4 min",
   "kind": "timeline",
   "intro": "Three lanes: tax (gold), trade (blue), defense (rose). The 2026 tariff story is a genuine rollercoaster - four different stacked rates in eight months.",
   "lanes": {
    "tax": "Tax lever",
    "trade": "Trade lever",
    "def": "Defense lever"
   },
   "items": [
    {
     "x": 2023.98,
     "lane": "def",
     "label": "FY2024 NDAA §154",
     "sub": "six makers named; DoD ban set for Oct 1, 2027"
    },
    {
     "x": 2024.75,
     "lane": "trade",
     "label": "§301 EV batteries → 25%",
     "sub": "Sep 27, 2024; non-EV increase scheduled for 2026"
    },
    {
     "x": 2025.05,
     "lane": "tax",
     "label": "Notice 2025-08 tables",
     "sub": "BESS: pack/module 65.6%, container 29.8% of MP cost"
    },
    {
     "x": 2025.5,
     "lane": "tax",
     "label": "OBBBA enacted (Jul 4)",
     "sub": "PFE regime created; §154 list imported into the tax code"
    },
    {
     "x": 2025.97,
     "lane": "def",
     "label": "FY2026 NDAA (Dec 18)",
     "sub": "FEOC-free defense batteries phased 2028-2031; no-FEOC-license exception"
    },
    {
     "x": 2026.0,
     "lane": "tax",
     "label": "MACR era begins (Jan 1)",
     "sub": "55% storage floor; Dec 31, 2025 was the safe-harbor line"
    },
    {
     "x": 2026.0,
     "lane": "trade",
     "label": "§301 non-EV → 25%",
     "sub": "stack 48.4%"
    },
    {
     "x": 2026.13,
     "lane": "trade",
     "label": "SCOTUS strikes IEEPA (Feb 20)",
     "sub": "6-3; both IEEPA layers die; §122 10% bridge → stack 38.4%"
    },
    {
     "x": 2026.12,
     "lane": "tax",
     "label": "Notice 2026-15 (Feb 12)",
     "sub": "interim MACR safe harbors; PFE tables due Dec 31, 2026"
    },
    {
     "x": 2026.23,
     "lane": "trade",
     "label": "Graphite case dies (Mar 31)",
     "sub": "ITC negative injury - no AD/CVD orders on finished batteries"
    },
    {
     "x": 2026.56,
     "lane": "trade",
     "label": "Current stack ~40.9% (Jul 24)",
     "sub": "§122 expires; §301 forced-labor 12.5% begins"
    },
    {
     "x": 2027.75,
     "lane": "def",
     "label": "§154 ban live (Oct 1, 2027)",
     "sub": "DoD funds cannot buy the six makers' batteries"
    },
    {
     "x": 2028.0,
     "lane": "tax",
     "label": "MACR 65% (2028) → 75% (2030+)",
     "sub": "the ladder keeps climbing"
    },
    {
     "x": 2029.0,
     "lane": "def",
     "label": "FY2026 NDAA phases",
     "sub": "standard batteries FEOC-free 2029; existing acquisitions Jan 30, 2031"
    }
   ]
  },
  {
   "id": "interaction",
   "title": "A developer buying §154-listed cells in 2026 - the interaction map",
   "read": "4 min",
   "kind": "table",
   "intro": "Standalone 200 MWh grid-scale project, evaluated August 2026. The layers stack; the ITC layer decides.",
   "cols": [
    "Layer",
    "Safe-harbored 2025 start",
    "2026 construction start"
   ],
   "rows": [
    [
     "§48E ITC (~30%+ of capex)",
     "Survives - MACR test does not apply. Conditions: claimant not itself a PFE/FIE; no effective-control contracts; post-2027, no effective-control payments in the 10-yr recapture window",
     "Lost entirely - ~34% computed MACR vs 55% floor. Transferability value gone; tax equity walks"
    ],
    [
     "Domestic-content adder (+10%)",
     "Unavailable (~40% max without a US cell) but moot - base credit survives",
     "Moot - base credit already lost"
    ],
    [
     "Tariff",
     "~40.9% on imported customs value; importing cells into US assembly roughly halves the base vs a finished container",
     "Same"
    ],
    [
     "Defense adjacency",
     "Any DoD-funded offtake blocked from Oct 1, 2027; FEOC-free phases from 2028",
     "Same"
    ],
    [
     "Texas overlay",
     "LSIPA no-remote-access architecture; NPRR1199 attestations; Paxton CATL precedent (Nov 2025)",
     "Same"
    ],
    [
     "Financeability",
     "Diligence-heavy but bankable; BOC documentation is the package to bring",
     "Merchant/tax-indifferent buyers only - must beat FEOC-compliant rivals net of their ITC"
    ]
   ]
  },
  {
   "id": "pathways",
   "title": "What remains possible - the compliant lanes",
   "read": "6 min",
   "kind": "proscons",
   "intro": "Five lanes, in priority order. The first is where Chinese vendors are actually still shipping in 2026-27.",
   "cards": [
    {
     "t": "Safe-harbored 2025 pipeline",
     "meta": "the primary 2026-27 lane",
     "adv": [
      "Full ITC preserved through completion",
      "Physical-work or 5% test under the pre-2025 notices, with ~4-yr continuity",
      "Pre-Jun-16-2025 binding contracts get their own cost exclusion"
     ],
     "dis": [
      "Finite and shrinking inventory of projects",
      "Effective-control contracting discipline required (services ≤2 yrs, no exclusivity, full data access)",
      "Recapture rule looms after Jul 2027"
     ]
    },
    {
     "t": "Merchant / tax-indifferent buyers",
     "meta": "nothing prohibits the sale",
     "adv": [
      "No ITC to lose - ERCOT merchant, industrial BtM, buyers without tax appetite",
      "Wins where speed, availability, or cycle-life economics dominate"
     ],
     "dis": [
      "Must absorb ~40.9% duty on imported content",
      "Competitively must beat a FEOC-clean rival minus its ITC - roughly a 40-50% capex gap to close"
     ]
    },
    {
     "t": "Tariff engineering via US assembly",
     "meta": "cost lever, not a tax fix",
     "adv": [
      "Duty applies to cell customs value only - roughly halves the tariff burden vs finished containers",
      "US logistics, delivery speed, and optics"
     ],
     "dis": [
      "Fixes nothing on FEOC or the adder - a listed maker's US output is still PFE-made",
      "Overpromising tax outcomes on 'Made in Texas' is the fastest way to lose a customer"
     ]
    },
    {
     "t": "Outright IP sale (not a royalty license)",
     "meta": "the structurally available play",
     "adv": [
      "Bona fide IP purchase is carved out of effective control",
      "Puts the listed maker's technology inside someone else's compliant supply chain"
     ],
     "dis": [
      "A royalty-bearing license is the dangerous version - every indicium was written for it",
      "FY2026 NDAA already closed the license door in the defense channel; Treasury regs may tighten further"
     ]
    },
    {
     "t": "Non-US markets",
     "meta": "none of this stack applies",
     "adv": [
      "LatAm, Middle East, Australia, Southeast Asia fully open",
      "Same containerized product, no tariff or tax penalty"
     ],
     "dis": [
      "Different bankability and certification regimes",
      "Does not build the US reference fleet"
     ]
    }
   ]
  },
  {
   "id": "redlines",
   "title": "Compliance red lines for listed-supplier sales teams",
   "read": "2 min",
   "kind": "callout",
   "ps": [
    "**1 - Never assert ITC eligibility** for a 2026+ construction-start project using §154-listed content. It is not supportable under current law.",
    "**2 - Never sign or facilitate a non-PFE certification** for listed-maker product - certifications are penalties-of-perjury documents with supplier penalties attached.",
    "**3 - Route all begin-construction and safe-harbor representations through counsel.** Support the buyer's documentation; never opine on their tax position.",
    "**4 - Disclose the ~40.9% duty stack in TCO models** - and date-stamp it: the rate changed four times in 2026 and must be re-verified at quote time.",
    "**5 - In Texas, lead with the no-remote-access security architecture** (LSIPA / NPRR1199) before it is asked for."
   ]
  },
  {
   "id": "ledger",
   "title": "Claims ledger",
   "read": "reference",
   "kind": "ledger",
   "intro": "Every load-bearing figure with its source. Full ledger with links: the analysis file in the repo.",
   "rows": [
    [
     "Storage MACR ladder 55/60/65/70/75 (2026→2030+)",
     "26 USC 7701(a)(52)(B); Notice 2026-15 example"
    ],
    [
     "SFE includes the §154(b) six by name; FIE tests (25%/40%/15%/officer/control)",
     "Notice 2026-15 §2"
    ],
    [
     "Effective-control licensing indicia (royalties >10 yr, services >2 yr, know-how transfer)",
     "Notice 2026-15; §7701(a)(51)(D)(ii)(III)"
    ],
    [
     "BOC exemption before Jan 1, 2026 under Notices 2013-29/2018-59 (as of Jan 1, 2025)",
     "Notice 2026-15 fn. 11/14"
    ],
    [
     "Certification mechanics; §6695B penalty; 1% understatement trigger; 6-yr SOL",
     "Notice 2026-15 §2"
    ],
    [
     "10-yr recapture, tax years beginning after Jul 4, 2027",
     "Bracewell; Stoel Rives"
    ],
    [
     "§301 non-EV 7.5→25% Jan 1, 2026; no exclusion process",
     "USTR Sept 2024 determination"
    ],
    [
     "2026 stack: 48.4 → 38.4 (Feb 24) → 40.9 (Jul 24, current)",
     "Pacific Battery / Gateway Lines / TariffsTool layer math"
    ],
    [
     "SCOTUS strikes IEEPA tariffs 6-3 (Feb 20, 2026); refund claims live",
     "WilmerHale; K&L Gates; SCOTUSblog"
    ],
    [
     "Graphite AAM: no AD/CVD orders - ITC negative injury Mar 31, 2026; scope excluded finished batteries",
     "Federal Register; USITC"
    ],
    [
     "§154: DoD ban Oct 1, 2027; 'produced' = final assembly or majority of components",
     "OpenSanctions; Bloomberg"
    ],
    [
     "FY2026 NDAA (Dec 18, 2025): FEOC-free 2028/2029/2031; >95% + no-FEOC-license exception",
     "Pillsbury; White & Case"
    ],
    [
     "Domestic content: 50% (2026) / 55% (2027+); BESS ~40% max without US cell (pack 65.6% of MP cost)",
     "Stoel Rives; Notice 2025-08; Energy-Storage.News"
    ],
    [
     "Storage ITC: 100% through 2033 starts, then 75/50/0 - exempt from the wind/solar 2027 cliff",
     "Stoel Rives; pv magazine USA"
    ],
    [
     "Texas: LSIPA access ban; NPRR1199 attestations; Paxton CATL/Mabank investigation (Nov 2025)",
     "Norton Rose Fulbright; Texas AG"
    ]
   ]
  },
  {
   "id": "cards",
   "title": "Flashcards",
   "read": "drill",
   "kind": "flashcards",
   "cards": [
    {
     "q": "How does a maker end up a Specified Foreign Entity?",
     "a": "Two routes: by name - the tax code incorporates the FY2024 NDAA §154(b) list (CATL, BYD, Envision, EVE, Gotion, Hithium) directly - or by organization, for any Chinese-organized or majority-Chinese-owned company. Statutory - no delisting short of Congress."
    },
    {
     "q": "The storage MACR floor for a 2026 construction start - and what a listed-maker-cell system computes to?",
     "a": "55% non-PFE manufactured-product cost required; a listed-maker-cell system lands ~34% because the pack/module is ~65.6% of MP cost - the entire ITC is lost."
    },
    {
     "q": "What escapes the MACR test entirely?",
     "a": "Projects that began construction (physical-work test or 5% safe harbor, per Notices 2013-29/2018-59 as of Jan 1, 2025) by December 31, 2025 - plus a cost exclusion for pre-Jun-16-2025 binding contracts."
    },
    {
     "q": "Does US assembly by a listed maker fix the tax problem?",
     "a": "No. A US subsidiary ≥25% SFE-owned is a Foreign-Influenced Entity and its output is PFE-made. US assembly is a tariff lever (duty on cell value only, not the full container) - never a tax fix."
    },
    {
     "q": "The current tariff stack on Chinese BESS, and its 2026 path?",
     "a": "~40.9% as of Aug 2026 (3.4 MFN + 25 §301 + 12.5 §301 forced-labor). Path: 48.4% Jan 1 → 38.4% after SCOTUS struck the IEEPA layers Feb 20 → 40.9% from Jul 24. Re-verify at quote time."
    },
    {
     "q": "What does NDAA §154 actually prohibit?",
     "a": "DoD obligating funds to procure batteries produced by the six named makers, from Oct 1, 2027. 'Produced' = final assembly or majority of components. Commercial sales are untouched."
    },
    {
     "q": "Why is a royalty license to a US partner dangerous but an IP sale workable?",
     "a": "Effective-control indicia target licenses: royalties beyond year 10, services >2 years, source-specification rights, incomplete know-how transfer. A bona fide outright IP purchase is carved out."
    },
    {
     "q": "The two ratios people confuse?",
     "a": "The FEOC material-assistance cost ratio (a disqualifier - failure kills the whole ITC; 55→75% for storage) vs the domestic-content adjusted percentage (a +10% bonus - 50%/55%; failure only forfeits the adder)."
    }
   ]
  },
  {
   "id": "quiz",
   "title": "Self-test",
   "read": "6 questions",
   "kind": "quiz",
   "items": [
    {
     "q": "A developer's project began construction in November 2025 (documented 5% spend). They buy §154-listed DC blocks in 2026. The ITC?",
     "c": [
      "Lost - the maker is an SFE",
      "Survives - the MACR test doesn't apply to pre-2026 starts, provided the owner avoids effective-control contracts",
      "Reduced to 50%",
      "Survives only if assembled in the US"
     ],
     "a": 1,
     "why": "The begin-construction exemption is the primary 2026-27 sales lane. Entity-level rules still apply to the claimant, and effective-control contracting discipline matters."
    },
    {
     "q": "A colleague drafts a proposal claiming the +10% domestic-content adder because the system ships from Texas. What's wrong?",
     "c": [
      "Nothing - US assembly qualifies",
      "The adder needs 50%+ US manufactured-product content and a BESS maxes ~40% without a US-made cell - and for 2026 starts the base credit is already lost anyway",
      "The adder was repealed",
      "Only solar gets the adder"
     ],
     "a": 1,
     "why": "Notice 2025-08's table puts the pack/module at 65.6% of MP cost. Chinese cells cap the ratio near 40% - below every threshold."
    },
    {
     "q": "Which statement about the August 2026 tariff position is correct?",
     "c": [
      "58.4% including IEEPA layers",
      "25% flat",
      "~40.9%: MFN 3.4 + §301 25 + §301 forced-labor 12.5; the IEEPA layers died at the Supreme Court in February",
      "Zero - tariffs were struck down entirely"
     ],
     "a": 2,
     "why": "SCOTUS struck only the IEEPA-based layers (Feb 20, 2026). Section 301 rests on different authority and stands; the 12.5% forced-labor action began Jul 24."
    },
    {
     "q": "A DoD contractor wants §154-listed batteries inside a 2028 deliverable. The cleanest answer?",
     "c": [
      "Fine - §154 only covers direct DoD purchases forever",
      "Blocked or at severe risk: the §154 funds ban runs from Oct 1, 2027 and FY2026 NDAA FEOC-free phases begin Jan 1, 2028; scope details await DFARS",
      "Fine if assembled in Texas",
      "Fine with a supplier certification"
     ],
     "a": 1,
     "why": "The defense channel closes hardest. Contractor-embedded gray zones exist but the trajectory is unambiguous - do not build a defense-adjacent pipeline."
    },
    {
     "q": "A buyer asks a listed maker to sign a certification that its product is not PFE-made, 'just paperwork.' You:",
     "c": [
      "Sign it - it speeds the deal",
      "Decline: the product is PFE-made by statute; the certification is penalties-of-perjury with §6695B supplier penalties",
      "Sign it only for US-assembled product",
      "Refer to marketing"
     ],
     "a": 1,
     "why": "Red line #2. A false certification exposes the supplier to the greater of 10% of the underpayment or $5,000 - and destroys the relationship."
    },
    {
     "q": "Where does a listed maker's license-to-US-partner model stand?",
     "c": [
      "Prohibited outright",
      "Safe - Ford proved it",
      "A tightrope: viable only if the license transfers complete know-how, royalties ≤10 yrs, services ≤2 yrs, no source-specification - and the defense channel already bans FEOC-licensed tech",
      "Only allowed for sodium-ion"
     ],
     "a": 2,
     "why": "The Ford/CATL precedent survives the indicia so far; Treasury's year-end 2026 regs may tighten. Flag every licensing pitch as contingent on forthcoming regulations."
    }
   ]
  }
 ],
 "glossary": [
  {
   "t": "PFE",
   "d": "Prohibited Foreign Entity - the OBBBA umbrella term: any Specified Foreign Entity or Foreign-Influenced Entity. PFE ties disqualify projects and taxpayers from §45Y/48E/45X credits."
  },
  {
   "t": "SFE",
   "d": "Specified Foreign Entity - includes the FY2024 NDAA §154(b) six by name, DoD §1260H companies, UFLPA-listed entities, and Chinese/Russian/Iranian/North Korean-organized or majority-owned companies."
  },
  {
   "t": "FIE",
   "d": "Foreign-Influenced Entity - an entity an SFE can influence: covered-officer appointment rights, ≥25% single-SFE ownership, ≥40% aggregate SFE ownership, ≥15% SFE-held debt, or effective-control payments. A listed maker's ≥25%-SFE-owned US subsidiaries are FIEs."
  },
  {
   "t": "MACR",
   "d": "Material Assistance Cost Ratio - share of a project's manufactured-product cost NOT attributable to PFE suppliers. Storage floor: 55% (2026) rising to 75% (2030+). Below the floor = entire ITC lost."
  },
  {
   "t": "BOC",
   "d": "Begin(ning) of construction - the tax-law trigger date, established by the Physical Work Test or the 5% Safe Harbor under Notices 2013-29/2018-59 (as in effect Jan 1, 2025), with ~4-year continuity."
  },
  {
   "t": "effective control",
   "d": "Contractual rights that make a counterparty an SFE's instrument: production/offtake control, data or site-access restrictions, exclusive O&M - and for licenses: royalties >10 yrs, services >2 yrs, source-specification, incomplete know-how transfer."
  },
  {
   "t": "§154",
   "d": "FY2024 NDAA §154 - names CATL, BYD, Envision, EVE, Gotion, Hithium; bans DoD battery procurement from them starting Oct 1, 2027. OBBBA imported this list into the tax code's SFE definition."
  },
  {
   "t": "§301",
   "d": "Section 301 of the Trade Act of 1974 - the statutory basis for the China tariffs that survived 2026: 25% on non-EV lithium-ion from Jan 1, 2026, plus the 12.5% forced-labor action from Jul 24, 2026."
  },
  {
   "t": "IEEPA",
   "d": "International Emergency Economic Powers Act - basis for the 2025 fentanyl/reciprocal tariff layers, struck down 6-3 by the Supreme Court on Feb 20, 2026 (Learning Resources v. Trump). Refund claims for duties paid are live."
  },
  {
   "t": "domestic content adder",
   "d": "The +10-percentage-point ITC bonus for meeting the US manufactured-product threshold (50% for 2026 starts, 55% after). A grid-scale BESS cannot reach it without a US-made cell."
  },
  {
   "t": "Notice 2026-15",
   "d": "IRS guidance (Feb 12, 2026) implementing the material-assistance rules: three interim safe harbors (Identification, Cost Percentage, Certification), certification mechanics, and penalties. Proposed regs and PFE tables due by end-2026."
  },
  {
   "t": "LSIPA",
   "d": "Texas Lone Star Infrastructure Protection Act (2021, strengthened 2025) - bars agreements giving Chinese-controlled entities remote access to or control of grid-connected infrastructure."
  }
 ]
};
}
// Content: When Utility Procurement Meets AI Data-Center Load (research synthesis, 2026-08-24).
// Derived from repository-information/industry-guidance/utility-aidc-procurement-analysis.md;
// claims verified against utility releases, commission orders, ERCOT dockets, and trade press.
function guidanceDocUtilityAidc_() {
  return {
 "id": "utility-aidc-procurement-2026-08",
 "group": "The AI Data-Center Wave",
 "title": "When Utility Procurement Meets AI Data-Center Load",
 "short": "How five gatekeeping utilities are answering the AI load wave - and where BESS actually enters their procurement.",
 "source": {
  "doc": "Research synthesis - ~60 sources (utility releases and RFPs, PUC/PSC/SCC orders, ERCOT dockets, PJM reports, trade press)",
  "publisher": "Internal analysis",
  "date": "August 2026",
  "pages": 5,
  "series": "Industry Guidance - policy module 2 of 3",
  "repo": "repository-information/industry-guidance/utility-aidc-procurement-analysis.md"
 },
 "updated": "2026-08-24",
 "reviewBy": "2026-12-10",
 "revisions": [
  { "date": "2026-08-29",
    "note": "Generalized to supplier/buyer-group guidance - single-company analysis moved to the admin-lens report overlays; statutory company lists retained as objective fact." }
 ],
 "tiles": [
  {
   "k": "~474 GW",
   "v": "ERCOT's large-load queue",
   "sub": "~5x its all-time peak; ~87% data centers (Aug 2026)"
  },
  {
   "k": "85%",
   "v": "the minimum-take norm",
   "sub": "AEP Ohio set it; Dominion GS-5 echoed it - contracted capacity billed whether used or not"
  },
  {
   "k": "30 GW → 5.6 GW",
   "v": "what a real tariff does",
   "sub": "AEP Ohio's pipeline once financial commitment was required"
  },
  {
   "k": "3,022.5 MW",
   "v": "Georgia Power's owned-BESS certification",
   "sub": "approved unanimously Dec 19, 2025 - the AIDC storage proof-point"
  }
 ],
 "sections": [
  {
   "id": "what",
   "title": "The gatekeeper thesis",
   "read": "3 min",
   "kind": "prose",
   "ps": [
    "The AI buildout made utilities the gatekeepers of compute. Interconnection queues detached from reality - ERCOT fields ~474 GW of large-load requests against a system that has never peaked above ~86 GW; AEP holds ~190 GW of inquiries against a 37 GW system; Dominion has ~70 GW of requests against a 24.7 GW peak. Most of it will never be built - the question every utility answered in 2024-2026 was how to find the real demand and make someone else carry the risk of the rest.",
    "The answer converged on a four-move playbook: **large-load tariff classes** (minimum take, long terms, exit fees, collateral), **massive gas procurement** as the firm-capacity anchor, **storage procurement growth** as the fast certifiable companion, and **flexibility/curtailment as interconnection currency**. The proof that tariffs work: AEP Ohio's 30 GW of requests collapsed to ~5.6 GW of signed, financially committed load once real money was required.",
    "For a BESS OEM the playbook generates three distinct demand streams with three different buyers: rate-based utility procurement (RFPs and self-build), merchant ERCOT storage monetizing AIDC-driven volatility, and a new code-driven buffering market at the data centers themselves ({{NOGRR 282}} ride-through). Selling into each requires knowing who actually signs the purchase order - Section 'The buyer map' below.",
    "**Field note:** The queue numbers are conversation openers, not demand. Certified IRP megawatts are demand. Track commission dockets, not press releases."
   ]
  },
  {
   "id": "playbook",
   "title": "The four-move playbook",
   "read": "3 min",
   "kind": "table",
   "cols": [
    "Response",
    "Mechanism",
    "Flagship examples"
   ],
   "rows": [
    [
     "1. Large-load tariff classes",
     "Minimum take (85% norm), 12-15 yr terms, ramp schedules, exit fees, collateral, customized contracts",
     "AEP Ohio (85%/12 yr, Jul 2025); Dominion GS-5 (85%/60%, 14 yr, Nov 2025); Georgia ≥100 MW rules (Jan 2025); Entergy 15-yr Meta ESA; Texas SB 6 commitment standards"
    ],
    [
     "2. Massive gas procurement",
     "Expedited CCGT/CT certification, often customer-funded",
     "Entergy: ten plants ~7.5 GW for Meta; Georgia Power 3,692 MW of CCs; Dominion Chesterfield + 5.9 GW gas plan"
    ],
    [
     "3. Storage procurement growth",
     "IRP-certified self-build, storage-specific RFPs, all-source RFPs where BESS wins, statutory mandates",
     "Georgia Power ~3.8 GW owned + 500 MW RFP; Dominion 2.7 GW VCEA mandate / 4.5 GW plan; Entergy's first BESS RFP (2026); PSO/SWEPCO 4.5 GW all-source"
    ],
    [
     "4. Flexible / curtailable interconnection",
     "Curtailment as a condition of faster connection; DR in PPAs; ride-through rules",
     "SB 6 curtailment + ERCOT kill switch; Batch Zero; Google's 1 GW DR across five utilities; NOGRR 282"
    ]
   ]
  },
  {
   "id": "texas",
   "title": "Texas: SB 6, Batch Zero, and the audit",
   "read": "5 min",
   "kind": "prose",
   "ps": [
    "**Oncor** (wires-only, Sempra-majority) carries the biggest queue in the country: ~271 GW of data-center requests plus ~18 GW industrial across 697 requests (Q1 2026), a $47.5B 2026-2030 capital plan, and the Permian Basin Reliability Plan bringing Texas its first 765 kV network. It builds wires, not generation - its AIDC role is interconnection, and it is the lightning rod for Texas large-load policy.",
    "**SB 6** (signed Jun 20, 2025; loads ≥75 MW) is the national template for large-load law: $100k+ screening-study fees and proof of site control; mandatory curtailment protocols for post-2025 interconnections during firm load-shed; disclosure of on-site backup ≥50% of demand (deployable on ERCOT order); co-location review with an **ERCOT-controlled kill switch** for behind-the-meter arrangements; competitively procured emergency demand response; and a re-examination of {{4CP}} cost allocation so large loads cannot ride free while driving buildout.",
    "**{{NOGRR 282}}** requires new ≥75 MW electronic loads (grandfathered if energized or study-complete by Nov 14, 2025) to ride through voltage and frequency disturbances rather than mass-tripping - which practically mandates buffering between grid and GPUs: grid-forming UPS, on-site generation, or BESS. This is a code-driven product category at the data center itself; competitors are already positioned (a BESS-based medium-voltage 'AI UPS' demonstrated zero-voltage ride-through in independent testing in May 2026).",
    "**The live wildcard:** on Aug 3, 2026 Gov. Abbott ordered a comprehensive audit of the data-center queue and ERCOT paused the Batch Zero schedule (completion target Dec 10, 2026). BNEF estimates ~49.8 GW could slip with up to $15B of project cost at risk. Texas AIDC timelines are in flux - which raises the value of anything that de-risks grid timing, storage included."
   ]
  },
  {
   "id": "tariffs",
   "title": "The large-load tariffs compared",
   "read": "3 min",
   "kind": "table",
   "intro": "The 85% minimum-take is now the national norm. These terms are what converts a hyperscaler's press release into bankable demand - and they are why regulated buyers scrutinize supplier bankability so hard.",
   "cols": [
    "",
    "AEP Ohio (Jul 2025)",
    "Dominion GS-5 (Nov 2025)",
    "Georgia Power (Jan 2025)",
    "Entergy/Meta ESA"
   ],
   "rows": [
    [
     "Threshold",
     ">25 MW data centers",
     "≥25 MW all large loads",
     "≥100 MW",
     "Single-customer contract"
    ],
    [
     "Term",
     "12 years (incl. 4-yr ramp)",
     "14 years",
     "Customized contracts",
     "15 years (plants live 30-40)"
    ],
    [
     "Minimum take",
     "85% of subscribed capacity (ramp 50→90%)",
     "85% of T&D demand / 60% of generation",
     "Minimum-bill protections",
     "Full cost of dedicated infrastructure"
    ],
    [
     "Exit",
     "~3 years of minimum charges",
     "Exit fees apply",
     "Contractual",
     "Stranded-cost fight post-year-15"
    ],
    [
     "Effect",
     "30 GW → 5,642 MW signed; on appeal (Ohio S.Ct. 2025-1458)",
     "Effective Jan 1, 2027",
     "Rate freeze through 2028; shareholder backstop (Dec 2025)",
     "LPSC approved 4-1; ten plants now Meta-funded"
    ]
   ]
  },
  {
   "id": "southeast",
   "title": "The Southeast machine: Entergy, Georgia, Dominion",
   "read": "6 min",
   "kind": "prose",
   "ps": [
    "**Entergy** is the most aggressive gas-for-AI builder: a $57B four-year plan against a 7-12 GW data-center pipeline. The Meta Hyperion deal (Richland Parish, LA) is the biggest single-customer utility arrangement in US history - three CCGTs (~2.26 GW, ~$3.2B) approved Aug 2025, then seven more Meta-funded plants (~5.2 GW; ten total) in Mar 2026, as Hyperion scaled to 5 GW and >$50B. Storage is Entergy's newest muscle: its **first standalone BESS RFP** posted final documents Mar 3, 2026 (MISO Zone 9 only) - the least storage-mature of the five utilities, which makes it the least crowded vendor field.",
    "**Georgia Power** is the cleanest case of AIDC load transforming a resource plan - and of BESS riding the wave. Its ~7-year capacity need went 400 MW (2022) → 6,600 MW (2023 - the famous '17x') → 8,500 MW (2025). On Dec 19, 2025 the PSC unanimously certified **9,885 MW / ~$16.3B**: 3,692 MW of gas CCs, **3,022.5 MW of company-owned BESS across ten facilities** (Bowen, Thomson, Wansley at 500 MW each; Yates 570 MW), 350 MW of BESS+solar, and 2,821 MW of PPAs - with shareholders backstopping the build if data-center demand fails. Already operating/building: Mossy Branch (65 MW, Tesla Megapack 2 XL, COD 2024) and 765 MW under construction under a ~2 GWh Tesla master supply agreement. Open now: a 500 MW third-party ESS RFP (≥2-hr, Ascend Analytics evaluating) with ~1,000 MW more signaled.",
    "**Dominion** serves the world's largest data-center cluster and pairs the GS-5 tariff with a statutory storage machine: the VCEA mandates 2.7 GW of Dominion storage by 2035, the 2024 IRP plans ~4.5 GW of BESS by 2039 (alongside 5.9 GW of gas), and an annual RFP cycle executes it - the Nov 2025 filing was its largest yet (845 MW solar, 155 MW owned storage, 439 MW of PPAs, ~$2.9B). EVLO (Hydro-Québec) is delivering >300 MWh across three Dominion projects. PJM context: the 2026/27 capacity auction cleared at its $329.17/MW-day cap, and PJM approved $11.8B of transmission with Dominion winning ~$4.8B including a 185-mile 525 kV HVDC line into Loudoun."
   ]
  },
  {
   "id": "channels",
   "title": "Where BESS enters - the five channels",
   "read": "6 min",
   "kind": "proscons",
   "intro": "Same hardware, five different buyers and sales motions. The first two are the regulated growth story; the last is the new code-driven category.",
   "cards": [
    {
     "t": "Storage-specific RFPs",
     "meta": "the purest channel",
     "adv": [
      "Named MW with commission certification behind them (Georgia 500 MW; Entergy ELL; Dominion annual)",
      "Independent evaluators run clean processes",
      "12-36-month fuse from award to PO"
     ],
     "dis": [
      "Slow cycles (IRP → RFP → certification runs 2-4 years)",
      "Bankability scrutiny at PUC-prudence level"
     ]
    },
    {
     "t": "All-source RFPs where BESS wins",
     "meta": "storage beats peakers on winter/peak economics",
     "adv": [
      "Georgia's all-source produced 3,022.5 MW of owned BESS",
      "PSO (1,500 MW) and SWEPCO (3,000 MW) explicitly include standalone BESS"
     ],
     "dis": [
      "Competing against gas on firm-capacity accreditation",
      "Winner selection sits with the developer or utility, not the OEM"
     ]
    },
    {
     "t": "Utility self-build supply agreements",
     "meta": "the OEM sells to the utility directly",
     "adv": [
      "Master supply agreements are real: Georgia Power-Tesla ~2 GWh; Dominion-EVLO >300 MWh",
      "Entry point is the EPC (Burns & McDonnell, Crowder) and the approved-vendor process"
     ],
     "dis": [
      "Incumbency and domestic-supply narratives won every self-build award to date",
      "Vendor qualification must happen before the RFP cycle, not during"
     ]
    },
    {
     "t": "ERCOT merchant",
     "meta": "the volume channel, maturing",
     "adv": [
      "~16.3 GW fleet (Jul 2026); AIDC volatility is a named revenue force",
      "Buyer is the developer/IPP - fast decisions, cost- and availability-driven"
     ],
     "dis": [
      "Growth decelerating - queue entries fell ~50% in H2 2025",
      "Saturation pressure on ancillary revenues"
     ]
    },
    {
     "t": "Ride-through buffering at the data center",
     "meta": "the new code-driven category",
     "adv": [
      "NOGRR 282 effectively mandates buffering for new ≥75 MW electronic loads",
      "SB 6 curtailment strengthens the pitch: storage converts curtailable interconnection into firm compute",
      "Buyer moves in quarters, not regulatory years"
     ],
     "dis": [
      "First-mover competitors already positioned (BESS-based MV 'AI UPS' with a 5 GW deployment agreement)",
      "FEOC-clean supply chains are being specified from day one"
     ]
    }
   ]
  },
  {
   "id": "buyermap",
   "title": "The buyer map - who signs the PO",
   "read": "3 min",
   "kind": "callout",
   "ps": [
    "**Regulated chain:** IRP (need certified) → RFP (independent evaluator) → one of two outcomes. **Self-build:** the utility signs an EPC contract and a direct OEM master supply agreement - the sale is to the utility, specified through the EPC. **PPA/acquisition:** the developer or IPP who bid the RFP picks the OEM - the utility never sees the cell brand except in technical review.",
    "**The two-lane motion that follows:** Lane A - design-win with the developer/IPP community bidding the RFPs, early, because bid-stage pricing locks the BOM. Lane B - get onto utility and EPC approved-vendor lists before the next self-build cycle (Georgia's next ~1,000 MW; Dominion's mandate ramp; Entergy's second RFP).",
    "**ERCOT merchant:** the buyer is always the developer/IPP/fund. **Ride-through buffering:** the buyer is the data-center developer or its power-infrastructure partner - a different call sheet entirely.",
    "**The bankability throughline:** an 85%-minimum-take world is a bankability world. Regulated buyers answer to commissions and consumer advocates; their supplier diligence mirrors that scrutiny. A container that cannot survive an SCC or PSC prudence review is unsellable in these markets regardless of price."
   ]
  },
  {
   "id": "ercotreg",
   "title": "ERCOT merchant vs regulated states",
   "read": "2 min",
   "kind": "table",
   "cols": [
    "",
    "ERCOT (merchant)",
    "Regulated Southeast / PJM states"
   ],
   "rows": [
    [
     "Revenue",
     "Energy arbitrage + ancillary services; AIDC volatility a named force",
     "Rate-based recovery or 10-20 yr PPAs certified in IRP dockets"
    ],
    [
     "Contract",
     "Tolling/merchant/hedges; developer takes market risk",
     "PUC-approved; Georgia shifted demand risk to shareholders (Dec 2025)"
    ],
    [
     "Speed",
     "Months to NTP - but SB 6, Batch Zero, and the audit add load-side friction",
     "2-4 years IRP-to-certification, then bankable, large-lot POs"
    ],
    [
     "Cycle risk",
     "Saturation: additions decelerating, queue entries -50% H2 2025",
     "Backlog building: GA ~3.5 GW certified + RFPs; VA 2.7 GW mandated; LA/MS first cycles; SPP 4.5 GW open"
    ],
    [
     "What wins",
     "Cost, availability, augmentation strategy",
     "Bankability: UL 9540A data, NFPA 855, domestic content, PUC-defensible supply chains"
    ]
   ]
  },
  {
   "id": "awards",
   "title": "Concrete AIDC-driven BESS procurements",
   "read": "3 min",
   "kind": "table",
   "cols": [
    "Utility / market",
    "Program",
    "Size",
    "OEM / EPC",
    "Status (Aug 2026)"
   ],
   "rows": [
    [
     "Georgia Power",
     "2022 IRP first own BESS (Mossy Branch)",
     "65 MW / 260 MWh",
     "Tesla Megapack 2 XL; Burns & McDonnell",
     "COD late 2024"
    ],
    [
     "Georgia Power",
     "IRP-authorized portfolio (McGrau Ford I+II, Robins, Moody, Hammond)",
     "765 MW",
     "Tesla Megapack 2 XL (~2 GWh master supply); B&M, Crowder",
     "Under construction, CODs 2026"
    ],
    [
     "Georgia Power",
     "Dec 19, 2025 certification (all-source)",
     "3,022.5 MW owned + 350 MW hybrid + BESS in 2,821 MW PPAs",
     "OEMs TBD - procurement underway",
     "Certified; CODs 2029-2031"
    ],
    [
     "Georgia Power",
     "2025 ESS RFP",
     "500 MW ≥2-hr",
     "Developer-selected",
     "Bids in evaluation (Ascend Analytics)"
    ],
    [
     "Dominion (VA)",
     "VCEA mandate + annual RFP",
     "2.7 GW by 2035 mandated; ~4.5 GW planned; Nov 2025: 155 MW owned + PPAs",
     "EVLO >300 MWh delivered; others TBD",
     "Rolling annual cycle"
    ],
    [
     "Entergy Louisiana",
     "2025 ELL BESS RFP (first standalone)",
     "Size unconfirmed",
     "Developer-selected",
     "Final docs Mar 3, 2026; MISO Zone 9"
    ],
    [
     "AEP PSO / SWEPCO (SPP)",
     "2026 all-source RFPs",
     "1,500 MW + up to 3,000 MW incl. BESS",
     "Developer-selected",
     "Issued Feb 2026 / 2026"
    ],
    [
     "ERCOT merchant",
     "Market-driven",
     "~16.3 GW fleet",
     "Full OEM spectrum - incumbents and §154-listed suppliers alike",
     "Continuous, decelerating"
    ]
   ]
  },
  {
   "id": "sales",
   "title": "Sales implications",
   "read": "3 min",
   "kind": "callout",
   "ps": [
    "**1 - Sell where the money is certified, not where the queue is loud.** 474 GW of ERCOT requests will not get built; 9,885 MW of Georgia PSC-certified resources will. IRP dockets and certification orders are the true pipeline - certified BESS MW are purchase orders on a 12-36-month fuse.",
    "**2 - Run the two-lane motion.** Lane A: the developers/IPPs bidding Georgia's 500 MW, Entergy's ELL RFP, Dominion's annual cycle, PSO/SWEPCO - engage at bid stage, when pricing locks the BOM. Lane B: utility/EPC approved-vendor qualification before the next self-build cycle.",
    "**3 - Bankability is the product in regulated markets.** Lead with the complete safety dossier, warranty/augmentation economics, and a commission-defensible supply-chain story (the FEOC/tariff math lives in the companion China-policy module).",
    "**4 - NOGRR 282 + SB 6 opened a buffering category at the data center itself** - sold to developers and power partners in quarters, not years. First movers are ahead; the counter is speed, containerized delivery record, and ride-through test data.",
    "**5 - Build account plans around regulatory calendars:** the Texas audit (Dec 10, 2026), Dominion GS-5 effectiveness (Jan 1, 2027), Georgia's 2028 rate case, the Ohio Supreme Court appeal, Louisiana's stranded-cost fight."
   ]
  },
  {
   "id": "ledger",
   "title": "Claims ledger",
   "read": "reference",
   "kind": "ledger",
   "intro": "Load-bearing figures with sources. Full linked ledger: the analysis file in the repo.",
   "rows": [
    [
     "ERCOT queue ~474 GW (Aug 2026); ~410 GW / 87% data centers (spring)",
     "Utility Dive; RTO Insider"
    ],
    [
     "Oncor: 697 requests, ~271 GW DC + 18 GW industrial; $47.5B 2026-30 plan",
     "Oncor Q1 2026 / Feb 2026 releases"
    ],
    [
     "SB 6 (Jun 20, 2025): ≥75 MW; fees; curtailment; kill switch; DR; 4CP review",
     "Pillsbury; McGuireWoods; Mayer Brown"
    ],
    [
     "Abbott audit Aug 3, 2026; Batch Zero paused; ~49.8 GW / $15B at risk (BNEF)",
     "Texas Tribune; Utility Dive; POWER"
    ],
    [
     "NOGRR 282: ≥75 MW electronic-load ride-through; grandfather Nov 14, 2025",
     "ERCOT docket; vendor guidance"
    ],
    [
     "AEP: 69 GW contracted through 2030; ~190 GW inquiries; ~$70B capex",
     "AEP Q1/Q2 2026"
    ],
    [
     "AEP Ohio tariff (PUCO Jul 9, 2025): 85% min, 12-yr, 3-yr exit fee; 30 GW → 5,642 MW",
     "PUCO; KJK; mgrid; DCD"
    ],
    [
     "Entergy/Meta: 3 CCGTs ~2.26 GW/$3.2B (Aug 2025); +7 plants (Mar 2026); Hyperion 5 GW/>$50B (Jul 2026)",
     "Entergy; UCS; Data Center Knowledge; Tom's Hardware"
    ],
    [
     "Entergy ELL BESS RFP final docs Mar 3, 2026 (MISO Zone 9)",
     "Entergy RFP site"
    ],
    [
     "Dominion: ~70 GW requests (Feb 2026); GS-5 (SCC Nov 25, 2025): 14-yr, 85%/60% minimums, eff. Jan 1, 2027",
     "Virginia Business; Virginia Mercury; SCC"
    ],
    [
     "Dominion storage: 2.7 GW VCEA mandate; ~4.5 GW by 2039; EVLO >300 MWh",
     "Utility Dive; WHRO; Electric Energy Online"
    ],
    [
     "PJM: $11.8B RTEP ($4.8B Dominion HVDC); 2026/27 capacity at $329.17/MW-day cap",
     "Utility Dive; IEEFA"
    ],
    [
     "Georgia: need 400 → 6,600 ('17x') → 8,500 MW; ≥100 MW rules Jan 2025; rate freeze to 2028",
     "GA PSC fact sheet; Georgia Power"
    ],
    [
     "Georgia Dec 19, 2025: 9,885 MW/$16.3B - 3,692 MW gas, 3,022.5 MW owned BESS, 350 MW hybrid, 2,821 MW PPAs; shareholder backstop",
     "Georgia Power; GA PSC; AJC"
    ],
    [
     "Georgia BESS: Mossy Branch 65 MW (Tesla, COD 2024); 765 MW building; ~2 GWh Tesla supply; 500 MW ESS RFP",
     "Georgia Power; Energy-Storage.News; PR Newswire"
    ],
    [
     "ERCOT BESS ~16.3 GW (Jul 2026); queue entries -50% H2 2025",
     "Modo Energy; ess-news"
    ],
    [
     "Google 1 GW of contracted DR across five utilities",
     "Renewable Energy World; DCD (Mar 2026)"
    ]
   ]
  },
  {
   "id": "cards",
   "title": "Flashcards",
   "read": "drill",
   "kind": "flashcards",
   "cards": [
    {
     "q": "The four-move utility playbook for AIDC load?",
     "a": "1) Large-load tariff classes (85% minimum take, long terms, exit fees); 2) massive gas procurement; 3) storage procurement growth; 4) flexibility/curtailment as interconnection currency."
    },
    {
     "q": "What did AEP Ohio's tariff prove?",
     "a": "Tariffs, not engineering, separate real demand from vapor: 30 GW of requests collapsed to ~5,642 MW of signed, financially committed load once minimum-take money was required."
    },
    {
     "q": "The two lanes of the regulated BESS sales motion?",
     "a": "Lane A: design-win with developers/IPPs bidding utility RFPs (bid-stage pricing locks the BOM). Lane B: utility/EPC approved-vendor qualification before the next self-build cycle (the Tesla and EVLO precedent)."
    },
    {
     "q": "Georgia Power's Dec 19, 2025 certification - the storage numbers?",
     "a": "9,885 MW / ~$16.3B total: 3,022.5 MW company-owned BESS across ten facilities + 350 MW BESS+solar + BESS inside 2,821 MW of PPAs; CODs 2029-2031; shareholders backstop demand risk."
    },
    {
     "q": "What does NOGRR 282 require, and of whom?",
     "a": "New ≥75 MW large electronic loads (data centers/crypto; grandfathered if energized/studied by Nov 14, 2025) must ride through voltage and frequency disturbances - practically mandating buffering (UPS, BESS, or generation) between grid and GPUs. It is a LOAD rule, not a storage standard."
    },
    {
     "q": "ERCOT merchant vs regulated Southeast - what wins each?",
     "a": "ERCOT: cost, availability, augmentation strategy - buyer is the developer/IPP; fleet ~16.3 GW and decelerating. Regulated: bankability - safety data, domestic content, PUC-defensible supply chains; backlog building across GA/VA/LA/SPP."
    },
    {
     "q": "The minimum-take norms at AEP Ohio and Dominion?",
     "a": "AEP Ohio: 85% of subscribed capacity after a 4-year ramp, 12-year contracts, ~3-year exit fee. Dominion GS-5: 85% of T&D demand / 60% of generation, 14-year contracts, effective Jan 1, 2027."
    },
    {
     "q": "The live Texas wildcard as of Aug 2026?",
     "a": "Abbott's Aug 3 audit of the data-center queue paused ERCOT's Batch Zero (target Dec 10, 2026); BNEF estimates ~49.8 GW could slip with up to $15B at risk - raising the value of anything that de-risks grid timing."
    }
   ]
  },
  {
   "id": "quiz",
   "title": "Self-test",
   "read": "6 questions",
   "kind": "quiz",
   "items": [
    {
     "q": "A prospect cites ERCOT's 474 GW queue as proof of demand. Your read?",
     "c": [
      "Agree - 474 GW of batteries will follow",
      "Queue numbers are conversation openers; certified IRP megawatts are demand - track commission dockets",
      "ERCOT demand is fake",
      "The queue only contains crypto"
     ],
     "a": 1,
     "why": "AEP Ohio's 30 GW → 5.6 GW collapse under a real tariff is the proof-point. Sell where the money is certified."
    },
    {
     "q": "Who picked the battery OEM for Georgia Power's Mossy Branch and 765 MW portfolio?",
     "c": [
      "The Georgia PSC",
      "The data-center customers",
      "Georgia Power itself, with its EPCs - a direct ~2 GWh master supply agreement (Tesla)",
      "ERCOT"
     ],
     "a": 2,
     "why": "Self-build means the utility+EPC sign the OEM supply agreement. That is Lane B: approved-vendor qualification before the cycle."
    },
    {
     "q": "Which is TRUE about NOGRR 282?",
     "c": [
      "It is ERCOT's BESS ride-through standard",
      "It requires large electronic LOADS (≥75 MW) to ride through disturbances - storage rules are NOGRR 245 / 272",
      "It bans batteries at data centers",
      "It applies only to crypto"
     ],
     "a": 1,
     "why": "A vocabulary trap that separates credible sellers from tourists. 282 = loads; 245/272 = storage resources."
    },
    {
     "q": "Where is the least crowded regulated BESS vendor field among the five case studies?",
     "c": [
      "Georgia (Tesla incumbent)",
      "Virginia (EVLO delivering)",
      "Entergy Louisiana/Mississippi - first standalone BESS RFP cycle just opening",
      "AEP Ohio (wires-only)"
     ],
     "a": 2,
     "why": "Entergy is the least storage-mature of the five; its first RFP posted final docs Mar 2026. AEP Ohio buys no generation at all."
    },
    {
     "q": "The 2026/27 PJM capacity price and its relevance?",
     "c": [
      "$28.92/MW-day - capacity is cheap",
      "$329.17/MW-day at the cap - AIDC-driven scarcity pricing that improves storage economics in PJM",
      "Zero - PJM abolished the auction",
      "It only affects gas"
     ],
     "a": 1,
     "why": "The price ran $28.92 → $269.92 → the $329.17 cap in three auctions; the IMM attributes ~40% of capacity cost to data centers."
    },
    {
     "q": "A developer bidding Georgia's 500 MW ESS RFP asks when to lock battery pricing. Your answer?",
     "c": [
      "After the award",
      "At COD",
      "At bid stage - bid pricing locks the BOM, so the design-win happens before submission",
      "Whenever Tesla raises prices"
     ],
     "a": 2,
     "why": "Lane A's whole logic: the OEM decision is effectively made when the bid is priced. Engage early or lose silently."
    }
   ]
  }
 ],
 "glossary": [
  {
   "t": "IRP",
   "d": "Integrated Resource Plan - the regulated utility's commission-approved forecast and procurement roadmap. Certified IRP megawatts are the true demand pipeline for a BESS OEM."
  },
  {
   "t": "all-source RFP",
   "d": "A competitive solicitation open to any technology (gas, storage, renewables, PPAs). Georgia's produced 3,022.5 MW of owned BESS; PSO and SWEPCO run 4.5 GW of them in SPP."
  },
  {
   "t": "minimum take",
   "d": "Contracted-capacity billing whether or not the energy is used - 85% is the national norm (AEP Ohio, Dominion GS-5). Converts speculative load into bankable demand."
  },
  {
   "t": "4CP",
   "d": "Four Coincident Peak - ERCOT's transmission cost allocation method, based on demand during the four summer system peaks. SB 6 ordered its re-examination so large loads cannot avoid their share."
  },
  {
   "t": "Batch Zero",
   "d": "ERCOT's one-time transitional batch study of the large-load queue (approved Jun 2026), replacing serial studies - paused Aug 2026 by the Abbott audit."
  },
  {
   "t": "NOGRR 282",
   "d": "ERCOT rule requiring new ≥75 MW Large Electronic Loads to ride through grid disturbances (grandfather cutoff Nov 14, 2025). A load rule that creates buffering demand - not a storage standard (those are NOGRR 245/272)."
  },
  {
   "t": "VCEA",
   "d": "Virginia Clean Economy Act - mandates 2.7 GW of Dominion energy storage by 2035 (interim: 1.2 GW by 2030), executed through annual RFP filings."
  },
  {
   "t": "GS-5",
   "d": "Dominion's new rate class for ≥25 MW loads (SCC, Nov 2025; effective Jan 2027): 14-year contracts, 85% T&D / 60% generation minimums, exit fees."
  },
  {
   "t": "self-build",
   "d": "The utility owns the asset and signs the EPC + OEM supply agreements directly (Georgia Power-Tesla, Dominion-EVLO). The OEM's entry point is the EPC and the approved-vendor list."
  },
  {
   "t": "kill switch",
   "d": "SB 6's requirement that ERCOT be able to isolate co-located (behind-the-meter) load in emergencies - a condition of the co-location review for ≥75 MW arrangements."
  }
 ]
};
}
// Content: Bankability & Certification for Grid-Scale BESS (research synthesis, 2026-08-24).
// Derived from repository-information/industry-guidance/bess-bankability-certification-analysis.md;
// claims verified against standards bodies, regulator dockets, the WECC Moss Landing report, and IE/insurer publications.
function guidanceDocBankability_() {
  return {
 "id": "bess-bankability-2026-08",
 "group": "Market Access & Bankability",
 "title": "Bankability & Certification for Grid-Scale BESS",
 "short": "The three approval gauntlets - safety code, grid, and money - and what 'bankable' concretely means in 2026.",
 "source": {
  "doc": "Research synthesis - ~50 sources (UL, NFPA/CSA analyses, FERC/NERC/ERCOT dockets, WECC's Moss Landing report, EPRI, DNV/CEA/BNEF, insurer and IE publications)",
  "publisher": "Internal analysis",
  "date": "August 2026",
  "pages": 6,
  "series": "Industry Guidance - policy module 3 of 3",
  "repo": "repository-information/industry-guidance/bess-bankability-certification-analysis.md"
 },
 "updated": "2026-08-24",
 "reviewBy": "2026-10-01",
 "revisions": [
  { "date": "2026-08-29",
    "note": "Generalized to supplier/buyer-group guidance - single-company analysis moved to the admin-lens report overlays; statutory company lists retained as objective fact." }
 ],
 "tiles": [
  {
   "k": "UL 9540A",
   "v": "a test, not a cert",
   "sub": "no pass/fail - it produces design data; never say '9540A certified'"
  },
  {
   "k": "NFPA 855-2026",
   "v": "the inflection edition",
   "sub": "large-scale fire testing goes from best practice to effectively mandatory"
  },
  {
   "k": "~97-99%",
   "v": "failure-rate decline",
   "sub": "per deployed GWh, 2018 → 2025 (EPRI database - state the caveat)"
  },
  {
   "k": "72%",
   "v": "of defects are system-level",
   "sub": "CEA factory data: fire detection 28%, aux panels 19%, thermal 15%"
  }
 ],
 "sections": [
  {
   "id": "what",
   "title": "The three gauntlets",
   "read": "3 min",
   "kind": "prose",
   "ps": [
    "Selling grid-scale BESS in the US means clearing **three overlapping approval gauntlets at once**: the **safety/code gauntlet** (UL listings + fire-test data + {{NFPA 855}}, enforced by fire marshals and {{AHJ}}s), the **grid gauntlet** (UL 1741/IEEE 1547 at distribution; IEEE 2800, NERC {{PRC-029-1}}, and ERCOT NOGRR 245 at transmission), and the **money gauntlet** ({{IE}} due diligence, warranty/{{LTSA}} structures, insurance underwriting, and - dominant in 2026 - FEOC/tariff compliance for tax-credit eligibility).",
    "The core thesis: **a product can be certified and still not be bankable.** Bankability is the lender's judgment that the *supplier* (balance sheet, factory quality, field record, warranty capacity, service network) and the *project paperwork* (test reports, guarantees, FEOC certifications) together de-risk twenty years of cash flow. Certifications are necessary inputs; the IE report is the gate.",
    "Vocabulary discipline is a sales skill in this domain. Three traps that instantly mark a seller as a tourist: saying 'UL 9540A **certified**' (it is a test method with no pass/fail); confusing **NOGRR 282** (data-center load ride-through) with the storage rules (NOGRR 245, NOGRR 272/PGRR 121); and treating '**BNEF Tier 1**' as a quality award (it is a bank-financeability screen: ≥6 projects ≥10 MW/10 MWh in two years, to ≥3 independent buyers, with non-recourse financing).",
    "**Field note:** Completeness is differentiation: buyers have been burned by cell-level-only 9540A submissions. Handing over the full stack unprompted - cell, module, AND unit reports plus LSFT - is the cheapest credibility win available."
   ]
  },
  {
   "id": "stack",
   "title": "The certification stack",
   "read": "5 min",
   "kind": "table",
   "intro": "Teach from this table. The 'nature' column matters as much as the coverage - a listing, a test method, and an installation code are three different things demanded by three different authorities.",
   "cols": [
    "Standard",
    "What it covers",
    "Nature",
    "Who demands it"
   ],
   "rows": [
    [
     "UN 38.3",
     "8 transport abuse tests on cells/batteries",
     "Test regime + Test Summary (manufacturer responsibility)",
     "Carriers, customs; buyers ask for the summary"
    ],
    [
     "UL 1973",
     "Cell/module/rack safety, stationary applications",
     "Certification (listing)",
     "Integrators, AHJs, lenders"
    ],
    [
     "UL 9540",
     "The complete ESS as an integrated assembly",
     "Certification (listing) - the umbrella mark",
     "AHJs (NFPA 855/IFC require listed ESS), utilities, lenders, insurers"
    ],
    [
     "UL 9540A (5th ed., Mar 2025)",
     "Thermal-runaway propagation: cell → module → unit → installation",
     "TEST METHOD - no pass/fail; produces the data AHJs use for spacing/venting/suppression design",
     "AHJs, insurers, lenders, nearly every RFP"
    ],
    [
     "CSA TS-800:24 / C800:25",
     "Large-Scale Fire Test: one unit fully alight, suppression off, no propagation",
     "Standardized test procedure",
     "AHJs and developers under NFPA 855-2026; RFPs"
    ],
    [
     "NFPA 855 (2026 ed.) / IFC §1207",
     "Siting, spacing, hazard mitigation analysis, detection, explosion control, emergency planning",
     "Installation standard / adopted fire code",
     "Fire marshals/AHJs; insurers; lenders check compliance"
    ],
    [
     "UL 1741 SB + IEEE 1547/1547.1",
     "Inverter grid-support functions, anti-islanding ≤2 s, interoperability",
     "Certification to the interconnection standard",
     "Distribution utilities, state rules"
    ],
    [
     "IEEE 2800-2022",
     "Transmission-level inverter-based-resource performance",
     "Performance standard flowing into enforceable rules",
     "Transmission interconnection"
    ],
    [
     "NERC PRC-029-1",
     "Mandatory IBR ride-through, explicitly including BESS",
     "Enforceable NERC standard (FERC Order 909, Jul 2025; effective ~Oct 1, 2026)",
     "NERC/FERC; generator owners"
    ],
    [
     "ERCOT NOGRR 245 (+272/PGRR 121)",
     "ERCOT IBR ride-through; advanced grid support / grid-forming expectations",
     "Nodal Operating Guide revisions (245 maximization deadline: Dec 31, 2025)",
     "ERCOT resource entities"
    ]
   ]
  },
  {
   "id": "ninefortya",
   "title": "UL 9540A and NFPA 855-2026, precisely",
   "read": "5 min",
   "kind": "prose",
   "ps": [
    "**What the 9540A test actually does:** the lab forces a cell into thermal runaway and observes, at four escalating levels (cell → module → unit → installation), whether runaway propagates, what gases vent and how flammable they are, flame extension, heat release, and whether deflagration occurs. **There is no 'pass.'** The output is a data report that a fire-protection engineer and the AHJ use to design and approve the installation - spacing deviations, deflagration venting or prevention, suppression. The correct sales claim: *'UL 9540A tested at cell, module and unit level, with reports available.'* A 5th edition published March 12, 2025, aligned to NFPA 855-2026's large-scale fire-testing expectations.",
    "**NFPA 855-2026 - the changes that matter:** (1) **Large-Scale Fire Testing elevated from best practice to a central, effectively mandatory requirement** for lithium-ion installations - one unit fully involved, suppression and detection disabled, demonstrating no spread to neighbors; CSA TS-800:24 is the standardized procedure the industry uses to satisfy it. (2) **Hazard Mitigation Analysis becomes the default requirement.** (3) Fire-detection options broadened. (4) **Explosion-control philosophy shifts: NFPA 68 deflagration venting is no longer accepted as the primary strategy** - the push is toward gas-accumulation prevention and management. (5) Spacing, outdoor-exemption and listing requirements updated.",
    "**The grid gauntlet hardens on Oct 1, 2026:** FERC Order 909 (Jul 24, 2025) approved NERC PRC-029-1 - mandatory ride-through for inverter-based resources *explicitly including BESS*, banning momentary cessation in must-ride-through zones, aligned with IEEE 2800. In ERCOT, NOGRR 245's firmware/settings maximization deadline passed Dec 31, 2025, and the advanced-grid-support rules (NOGRR 272 / PGRR 121) push grid-forming expectations for storage. Offer IEEE 2800-conformant PCS/controls documentation as part of the package, unprompted."
   ]
  },
  {
   "id": "fires",
   "title": "The fire record and what it costs",
   "read": "5 min",
   "kind": "prose",
   "ps": [
    "**Moss Landing (Jan 16, 2025)** defined 2025-26 perception: Vistra's Phase 1 (300 MW) - **LG Energy Solution NMC batteries in a legacy indoor design** (a repurposed turbine hall) with an earlier-standards water-suppression scheme - burned, forcing evacuation of ~1,200-1,500 residents, with a Feb 18 flare-up. Vistra wrote off ~$400M; toxic-plume litigation followed; San Luis Obispo and Orange counties imposed moratoria. Policy outcome: the 3,200-ft-setback bill (AB 303) **died in committee** April 2025; the CPUC instead advanced maintenance/operation standards (SB 1383) and emergency-response oversight (SB 38) and opened an investigation. The honest sales framing, which insurers themselves reached: indoor, NMC, early-2020s vintage - **a categorically different risk object from modern outdoor containerized LFP** with unit-level propagation data.",
    "**The legacy incident behind the rules:** APS McMicken (Apr 2019) - internal cell failure, cascading runaway, flammable-gas accumulation, and an explosion that injured firefighters. DNV's investigation (missing thermal barriers, suppression that could not stop runaway, gas accumulation, responder-coordination gaps) is why 9540A data, deflagration management, and emergency-response planning are now table stakes.",
    "**The statistics are the good news:** analyses of EPRI's BESS Failure Incident Database show the failure rate per deployed GWh fell on the order of **~97-99% between 2018 and 2025** as early-generation lessons were designed out. State the caveat honestly - the database is media/report-derived and may undercount minor events - and the number still lands.",
    "**How incidents price:** brokers' consensus was that Moss Landing was *'not a market-moving event'* precisely because underwriters distinguish legacy indoor NMC from modern outdoor LFP; NMC-vs-LFP claims severity is now priced; premium softening continues but slower in 2026; the best deductibles go to operators demonstrating granular monitoring and disciplined O&M. Complete 9540A documentation is effectively an insurance prerequisite."
   ]
  },
  {
   "id": "bankability",
   "title": "What 'bankable' concretely means",
   "read": "6 min",
   "kind": "prose",
   "ps": [
    "**The Independent Engineer report is the gate.** Lenders and tax equity will not close without one (DNV, Sargent & Lundy, Black & Veatch, Leidos, ICF, UL Solutions and peers). The IE tests: the revenue model against the equipment's real capability (cycling regime vs warranty limits - a two-cycles-per-day contract against a one-cycle warranty voids coverage, and IEs check for exactly this); technology and integration quality; **degradation and warranty terms** (do the guaranteed retention curves support the pro forma? is {{augmentation}} costed and physically provided for?); grid compliance; commercial agreements; and **supplier counterparty strength** - financial health, factory-audit results, field record, spares and service network.",
    "**The contractual skeleton:** commissioning guarantees (capacity + round-trip efficiency at COD); long-term energy-retention warranties conditioned on an operating envelope; **availability guarantees delivered through the LTSA** with liquidated damages - and suppliers generally will not give long-term warranties without holding the LTSA, since the LTSA controls the conditions the warranty depends on. Lenders now expect availability-anchored LTSA structures as standard.",
    "**The scorecards buyers consult:** the {{BNEF Tier 1}} storage list (a financeability screen - Chinese firms held ~85% of the Q2 2026 list); DNV's annual Battery Performance Scorecard (independent lab degradation/safety testing); and CEA's factory-audit reporting - whose headline finding reframed diligence: **72% of BESS manufacturing defects are now found at system level** (fire detection & suppression 28% of system-level findings, auxiliary circuit panels 19%, thermal management 15%). Cell quality is no longer where most defects live - which is why factory-audit rights are in every serious RFP. (No dedicated PVEL/Kiwa BESS scorecard was confirmed - their famous scorecard is PV modules; do not cite one.)",
    "**The China overlay:** lenders cannot avoid Chinese content (90-100% of US BESS carries some), so they price and paper it - MACR documentation, FEOC certifications, ITC-eligibility representations, recapture indemnities (mechanics in the companion China-policy module). The FCC moved mid-2026 to ban **new** equipment authorizations for Chinese-made inverters (prospective; DOE's January 2026 inspection of 30 units found no malicious hardware). The practical pairing: Chinese DC blocks with **non-Chinese PCS/EMS**, plus unprompted cybersecurity documentation (SBOM, firmware provenance, remote-access policy)."
   ]
  },
  {
   "id": "counterparty",
   "title": "The counterparty file - what an IE will say",
   "read": "4 min",
   "kind": "proscons",
   "intro": "Every supplier walks into diligence with both columns. Know the categories cold: the tailwinds are proof points to quantify in every proposal; the headwinds will be raised in every diligence process, and a sales team should raise them first, with the structural answers attached.",
   "cards": [
    {
     "t": "Tailwinds IEs credit",
     "meta": "the proof points to quantify in every proposal",
     "adv": [
      "Shipment-volume rank from independent trackers (InfoLink, SMM) - scale implies process maturity",
      "BNEF Tier 1 listing - the financeability screen lenders actually run",
      "A quantified US operating fleet: GWh delivered, availability achieved, named reference projects",
      "US assembly capacity and demonstrated delivery speed"
     ],
     "dis": []
    },
    {
     "t": "Headwinds IEs flag",
     "meta": "raise them first, with answers",
     "adv": [],
     "dis": [
      "Financing dependency - an unclosed IPO or thin balance sheet reads as a flag against a 20-year warranty",
      "Margin compression despite fast revenue growth - IEs read it as pricing-war exposure",
      "Live litigation with competitors - injunction and reputational tail risk",
      "For China-linked suppliers, the FEOC/tariff overlay per the companion module"
     ]
    },
    {
     "t": "Structural answers that work in project finance",
     "meta": "the counterparty-risk toolkit",
     "adv": [
      "Parent guarantees and warranty insurance/bonding",
      "Escrowed spare parts; availability-LD LTSAs backed by the US entity",
      "Named bank references; quantified US fleet performance (GWh delivered, availability achieved)",
      "Factory-audit invitations before they are demanded"
     ],
     "dis": []
    }
   ]
  },
  {
   "id": "checklist",
   "title": "The RFP diligence checklist",
   "read": "3 min",
   "kind": "table",
   "intro": "A composite of 2025-26 utility-scale RFP and IE data requests. Arriving with all ten assembled is the differentiation.",
   "cols": [
    "#",
    "What the buyer asks for"
   ],
   "rows": [
    [
     "1",
     "UL 1973 + UL 9540 listings (NRTL); PCS certs - UL 1741 SB / IEEE 1547 (distribution) or IEEE 2800 / PRC-029 conformance evidence (transmission)"
    ],
    [
     "2",
     "COMPLETE UL 9540A reports - cell, module, AND unit level (cell-only submissions are a known dodge) + large-scale fire test results (CSA TS-800 basis) + deflagration-management design data"
    ],
    [
     "3",
     "NFPA 855 package: hazard mitigation analysis support, spacing drawings, gas detection design, emergency response plan template, first-responder training offer"
    ],
    [
     "4",
     "UN 38.3 Test Summaries + dangerous-goods shipping documentation"
    ],
    [
     "5",
     "Cycle-life, degradation, and round-trip-efficiency data with independent-lab validation"
    ],
    [
     "6",
     "Capacity warranty (term, annual state-of-health table, operating envelope), availability guarantee, throughput terms, liquidated damages, LTSA scope, augmentation plan"
    ],
    [
     "7",
     "Counterparty proof: audited financials, parent guarantees or warranty insurance, bank references, US fleet references"
    ],
    [
     "8",
     "Trade/tax: country-of-origin + HTS documentation, domestic-content declarations, FEOC/MACR certifications with cost breakdowns, recapture indemnities"
    ],
    [
     "9",
     "Quality: pre-shipment inspection and in-line factory audit rights, FAT/SAT protocols, non-conformance reporting"
    ],
    [
     "10",
     "Cybersecurity: EMS/BMS architecture, SBOM, firmware chain of custody, remote-access policy, FCC equipment-authorization status"
    ]
   ]
  },
  {
   "id": "sales",
   "title": "Implications for the sales motion",
   "read": "2 min",
   "kind": "callout",
   "ps": [
    "**1 - Lead with the complete safety dossier** - full 9540A stack (cell + module + unit, 5th-edition testing), LSFT results, listings, UN 38.3 summaries, NFPA 855-2026 package. Completeness IS differentiation.",
    "**2 - Reframe Moss Landing proactively** - indoor, NMC, legacy design; cite the insurers' own 'not a market-moving event' verdict and the EPRI ~97-99% decline with its caveat stated honestly.",
    "**3 - Own the FEOC/tariff conversation before diligence raises it** - the MACR narrative, the certifications a supplier can and cannot sign, and the indemnity/recapture structure on offer (companion module).",
    "**4 - Neutralize the counterparty file with structure** - guarantees, bonding, escrowed spares, US-entity-backed LTSAs, bank references, quantified US fleet performance.",
    "**5 - Bundle for the grid gauntlet** - IEEE 2800-conformant PCS documentation, non-Chinese PCS/EMS pairing options, and cybersecurity documentation, all unprompted.",
    "**6 - Enforce the vocabulary** - 9540A is a test, not a cert; NOGRR 282 is a load rule; Tier 1 is a financeability screen. Precision is credibility."
   ]
  },
  {
   "id": "ledger",
   "title": "Claims ledger",
   "read": "reference",
   "kind": "ledger",
   "intro": "Load-bearing claims with sources. Full 30-row linked ledger: the analysis file in the repo.",
   "rows": [
    [
     "UL 9540A: test method, no pass/fail, 4 levels; 5th edition Mar 12, 2025",
     "UL Solutions; ShopULStandards; Mayfield"
    ],
    [
     "NFPA 855-2026: LSFT effectively mandatory; HMA default; NFPA 68 venting no longer primary",
     "Telgian; Energy-Storage.News; EnergyTech"
    ],
    [
     "CSA TS-800:24 LSFT procedure (one unit fully alight, no propagation)",
     "CSA Group; ACP; Jensen Hughes"
    ],
    [
     "PRC-029-1 approved by FERC Order 909 (Jul 24, 2025); effective ~Oct 1, 2026; includes BESS",
     "Federal Register; Keentel"
    ],
    [
     "NOGRR 245 eff. Oct 1, 2024 (maximization Dec 31, 2025); NOGRR 282 = large electronic loads, not storage",
     "ERCOT notices and dockets"
    ],
    [
     "Moss Landing: Jan 16, 2025; LG NMC, legacy indoor design; ~$400M Vistra write-off; SLO/Orange moratoria",
     "WECC report (Dec 2025); Energy-Storage.News; Canary Media"
    ],
    [
     "AB 303 died Apr 2025; CPUC advanced SB 1383/SB 38 rules + investigation",
     "Brownstein; Energy-Storage.News"
    ],
    [
     "McMicken 2019: runaway → explosion; DNV findings drove the modern rules",
     "Utility Dive; NFPA"
    ],
    [
     "EPRI database: failure rate down ~97-99% per GWh, 2018 → 2025 (media-derived; caveat required)",
     "EPRI wiki/white paper; Battery Design"
    ],
    [
     "Insurers: Moss Landing 'not a market-moving event'; NMC>LFP severity priced; softening slows in 2026",
     "Energy-Storage.News (Lockton); kWh Analytics; NARDAC"
    ],
    [
     "IE scope and role as the financial-close gatekeeper",
     "Sargent & Lundy; DNV; Sunraise"
    ],
    [
     "BNEF Tier 1 criteria (≥6 projects ≥10 MW/MWh, 2 yrs, ≥3 buyers); ~85% Chinese Q2 2026",
     "BNEF methodology; EnergyTrend"
    ],
    [
     "CEA: 72% of defects at system level - fire detection 28%, aux panels 19%, thermal 15% (680+ inspections)",
     "ess-news; CEA report"
    ],
    [
     "Warranty/LTSA norms: suppliers won't warranty without the LTSA; availability-anchored structures lender-standard",
     "Foot Anstey; TWAICE"
    ],
    [
     "FCC ban on new Chinese-inverter authorizations (mid-2026, prospective); DOE found no malicious hardware (Jan 2026)",
     "pv magazine USA; Reuters/US News; Canary Media"
    ]
   ]
  },
  {
   "id": "cards",
   "title": "Flashcards",
   "read": "drill",
   "kind": "flashcards",
   "cards": [
    {
     "q": "What does UL 9540A produce, and what may you never call it?",
     "a": "A data report on thermal-runaway propagation at four levels (cell → module → unit → installation) used by fire-protection engineers and AHJs to design spacing, venting, and suppression. It has no pass/fail - never say '9540A certified'; say 'tested at cell, module and unit level, reports available.'"
    },
    {
     "q": "The three biggest changes in NFPA 855-2026?",
     "a": "Large-scale fire testing becomes effectively mandatory (CSA TS-800 procedure); hazard mitigation analysis becomes the default; NFPA 68 deflagration venting is no longer accepted as the primary explosion-control strategy."
    },
    {
     "q": "NOGRR 282 vs NOGRR 245 - who does each bind?",
     "a": "282 binds large electronic LOADS (≥75 MW data centers/crypto) to ride through disturbances. 245 (plus 272/PGRR 121) binds STORAGE and other inverter-based resources. Confusing them marks you as a tourist."
    },
    {
     "q": "Why was Moss Landing 'not a market-moving event' for insurers?",
     "a": "Underwriters distinguish legacy indoor NMC designs (which Moss Landing Phase 1 was - LG NMC in a repurposed turbine hall) from modern outdoor containerized LFP with unit-level propagation data. The distinction is priced."
    },
    {
     "q": "CEA's headline factory-quality finding?",
     "a": "72% of BESS manufacturing defects are now found at SYSTEM level - fire detection & suppression 28%, auxiliary circuit panels 19%, thermal management 15%. Cell quality is no longer where most defects live; hence factory-audit rights in every serious RFP."
    },
    {
     "q": "What is BNEF Tier 1, precisely?",
     "a": "A bank-financeability screen: supply to ≥6 projects of ≥10 MW/10 MWh in the past two years, to ≥3 independent buyers, with tracked non-recourse financing. Not a quality award."
    },
    {
     "q": "Why won't a supplier give a long-term warranty without holding the LTSA?",
     "a": "The LTSA controls the operating conditions the warranty depends on (cycling regime, maintenance, envelope). Lenders now expect availability-anchored LTSA structures as standard - and IEs check for warranty-vs-revenue-contract mismatches."
    },
    {
     "q": "What hardens on October 1, 2026?",
     "a": "NERC PRC-029-1 (FERC Order 909) - mandatory ride-through for inverter-based resources explicitly including BESS, banning momentary cessation, aligned with IEEE 2800. Bring conformant PCS documentation unprompted."
    }
   ]
  },
  {
   "id": "quiz",
   "title": "Self-test",
   "read": "6 questions",
   "kind": "quiz",
   "items": [
    {
     "q": "A proposal draft says 'our system is UL 9540A certified.' You:",
     "c": [
      "Ship it - sounds strong",
      "Correct it: 9540A is a test method with no pass/fail - claim 'tested at cell, module and unit level, reports available' and attach them",
      "Change it to 'UL 9540B certified'",
      "Delete all certification claims"
     ],
     "a": 1,
     "why": "The mislabel is a credibility tell that IEs and AHJs notice immediately. The real differentiation is report completeness."
    },
    {
     "q": "An AHJ asks how the design handles explosion control under NFPA 855-2026. The strongest answer leads with:",
     "c": [
      "NFPA 68 deflagration vents",
      "Gas-accumulation prevention/management, backed by unit-level 9540A gas data and LSFT results",
      "Bigger sprinklers",
      "A letter from the OEM"
     ],
     "a": 1,
     "why": "The 2026 edition shifted philosophy: venting is no longer accepted as the primary strategy. Prevention/management backed by test data is the compliant posture."
    },
    {
     "q": "A lender's IE asks about a project cycling twice daily against a warranty covering 365 cycles/year. This is:",
     "c": [
      "Fine - warranties are flexible",
      "The classic warranty-mismatch trap: the revenue contract would void coverage; restructure the warranty/LTSA or the dispatch",
      "Only a problem after year 10",
      "The developer's issue, not the OEM's"
     ],
     "a": 1,
     "why": "IEs check for exactly this. Warranty envelope vs revenue model is a standard kill-item in diligence."
    },
    {
     "q": "Which is a TRUE statement about the fire-safety statistics?",
     "c": [
      "Failure rates are rising with deployment",
      "EPRI-database analyses show failure rates per deployed GWh fell ~97-99% from 2018 to 2025 - with the caveat that the database is media-derived",
      "There is no failure data",
      "Only NMC systems fail"
     ],
     "a": 1,
     "why": "The number lands hardest when the caveat is stated honestly - that discipline is what separates a credible seller's materials from vendor puff."
    },
    {
     "q": "A buyer asks why they should trust a 20-year warranty from a company whose IPO hasn't closed. The professional answer:",
     "c": [
      "The IPO will close soon",
      "Acknowledge the flag and answer with structure: parent guarantees, warranty insurance/bonding, escrowed spares, a US-entity-backed availability-LD LTSA, bank references, and quantified US fleet performance",
      "Point to revenue growth",
      "Change the subject to price"
     ],
     "a": 1,
     "why": "IEs score counterparty risk structurally. Raising the headwind first with the toolkit attached converts a weakness into a professionalism signal."
    },
    {
     "q": "The FCC's mid-2026 inverter action means:",
     "c": [
      "All Chinese BESS is banned",
      "New equipment authorizations for Chinese-made inverters are barred prospectively - pair Chinese DC blocks with non-Chinese PCS/EMS and bring cyber documentation unprompted",
      "Existing systems must be removed",
      "Nothing - DOE found no malicious hardware"
     ],
     "a": 1,
     "why": "Prospective scope; existing authorized models unaffected. The pairing strategy simultaneously helps MACR, the FCC issue, and utility cyber reviews."
    }
   ]
  }
 ],
 "glossary": [
  {
   "t": "AHJ",
   "d": "Authority Having Jurisdiction - the fire marshal or local official who approves an ESS installation under NFPA 855 / the fire code. The consumer of UL 9540A data and LSFT results."
  },
  {
   "t": "NFPA 855",
   "d": "The installation standard for stationary energy storage - siting, spacing, hazard mitigation analysis, detection, explosion control, emergency planning. The 2026 edition makes large-scale fire testing effectively mandatory."
  },
  {
   "t": "LSFT",
   "d": "Large-Scale Fire Test - one full BESS unit set fully alight with suppression disabled, demonstrating no propagation to adjacent units. CSA TS-800:24 is the standardized procedure."
  },
  {
   "t": "HMA",
   "d": "Hazard Mitigation Analysis - the engineered risk assessment NFPA 855-2026 makes the default requirement for most installations."
  },
  {
   "t": "IE",
   "d": "Independent Engineer - the lender's technical diligence firm (DNV, Sargent & Lundy, Black & Veatch, Leidos, ICF...). The IE report is the definitive gatekeeper for financial close."
  },
  {
   "t": "LTSA",
   "d": "Long-Term Service Agreement - the O&M contract through which availability guarantees are delivered. Suppliers generally will not give long-term warranties without holding it."
  },
  {
   "t": "augmentation",
   "d": "Planned addition of modules/containers in later years to restore capacity lost to degradation. IEs verify it is both costed in the pro forma and physically provided for (space, power, controls headroom)."
  },
  {
   "t": "BNEF Tier 1",
   "d": "BloombergNEF's quarterly energy-storage financeability screen: ≥6 projects ≥10 MW/10 MWh in two years, ≥3 independent buyers, non-recourse financing. A screen, not a quality award."
  },
  {
   "t": "PRC-029-1",
   "d": "NERC's mandatory ride-through standard for inverter-based resources including BESS (FERC Order 909, Jul 2025; effective ~Oct 1, 2026). The transmission-level teeth behind IEEE 2800."
  },
  {
   "t": "UN 38.3",
   "d": "The UN transport test regime for lithium batteries - eight abuse tests plus a Test Summary the manufacturer must supply. No third-party certification, but buyers routinely request the summary."
  },
  {
   "t": "MACR",
   "d": "The FEOC material-assistance cost ratio from the companion China-policy module - the 55% (2026) → 75% (2030+) non-PFE cost floor for storage ITC eligibility. Now a standard RFP documentation item."
  }
 ]
};
}
// Content: BESS Technology Fundamentals for the Sales Team (teaching synthesis, 2026-08-24).
// Derived from repository-information/industry-guidance/bess-technology-fundamentals-analysis.md;
// no new external claims - specs are class-typical figures drawn from the covered supplier
// dossiers, safety/certification claims via the bankability analysis. Phase 5 (team training) module 1 of 2.
function guidanceDocBessTech_() {
  return {
 "id": "bess-tech-fundamentals-2026-08",
 "group": "Technology Foundations",
 "title": "BESS Technology Fundamentals for the Sales Team",
 "short": "The machine BESS suppliers sell - cells, containers, the spec sheet, sodium, and the safety vocabulary - taught from zero.",
 "source": {
  "doc": "Teaching synthesis - covered supplier dossiers + the bankability analysis",
  "publisher": "Internal analysis",
  "date": "August 2026",
  "pages": 4,
  "series": "Industry Guidance - training module 1 of 2 (Phase 5)",
  "repo": "repository-information/industry-guidance/bess-technology-fundamentals-analysis.md"
 },
 "updated": "2026-08-24",
 "reviewBy": "2027-02-24",
 "revisions": [
  { "date": "2026-08-29",
    "note": "Generalized to supplier/buyer-group guidance - single-company analysis moved to the admin-lens report overlays; statutory company lists retained as objective fact." }
 ],
 "tiles": [
  {
   "k": "LFP",
   "v": "the storage chemistry",
   "sub": "cycle life and safety over energy density - the stationary tradeoff"
  },
  {
   "k": "280 → 1300 Ah",
   "v": "the cell ladder",
   "sub": "larger cells, fewer parts - the industry's large-cell race"
  },
  {
   "k": "≥10-13k cycles",
   "v": "the second-decade sale",
   "sub": "the warranty curve plus augmentation is where deals are won"
  },
  {
   "k": "2h · 4h · 8h",
   "v": "duration classes",
   "sub": "8h-native LDES is the newest tier - kAh-class cells make it native, not stacked"
  }
 ],
 "sections": [
  {
   "id": "what",
   "title": "What this module is",
   "read": "2 min",
   "kind": "prose",
   "ps": [
    "The core-technical half of a seller's onboarding: what a storage cell is, how cells become the containers suppliers actually sell, what every line on a spec sheet means and why a buyer cares, where sodium-ion honestly stands, and the safety vocabulary you must not fumble in front of a technical audience. After this module you can hold a products conversation without a spec sheet in your hand; its companion (Power Infrastructure & the AIDC Power Chain) teaches the grid those products plug into.",
    "Sourcing discipline: cell and container figures here are class-typical values drawn from the covered supplier dossiers, which carry the original citations - always quote a specific vendor's spec sheet, not this module, in a proposal. Safety and certification facts come from the bankability research module. Where a teaching simplification is used, it is flagged in place - never repeat a simplification as a fact in a customer room."
   ]
  },
  {
   "id": "cell",
   "title": "The cell - LFP in plain terms",
   "read": "4 min",
   "kind": "prose",
   "ps": [
    "A battery cell stores energy chemically. Charging pushes lithium ions from one electrode into the other and holds them there; discharging lets them flow back, releasing energy as electric current. The two electrode materials define the chemistry: grid-storage cells are overwhelmingly {{LFP}} (lithium iron phosphate); the EV world leans {{NMC}} (nickel manganese cobalt). That single choice drives almost everything a buyer experiences.",
    "Why stationary storage chose LFP: it is thermally stable (harder to push into dangerous overheating), it cycles for longer, and it is cheaper per kWh - at the cost of energy density, which a parked container barely cares about. Storage-first makers sharpen this: cells purpose-built for storage rather than repurposed from EV lines - {{prismatic cell}} formats sized for containers, tuned for cycle count over weight.",
    "Four words carry most spec conversations. {{cycle life}}: how many full charge-discharge round trips before capacity falls to the warranty floor (distinct from calendar life - degradation that happens with time regardless of use). {{DoD}}: how much of the stored energy each cycle actually uses. {{C-rate}}: how fast energy moves relative to capacity - a 0.25C system empties in four hours, a 1C system in one. {{RTE}}: energy out divided by energy in - every lost percentage point is paid for twice, once buying the charge and once in forgone discharge revenue.",
    "**Field note:** buyers rarely ask how the chemistry works - they ask what happens in year 12. The chemistry answer is the setup; the warranty-curve-plus-augmentation answer is the sale."
   ]
  },
  {
   "id": "specsheet",
   "title": "The spec sheet decoded",
   "read": "4 min",
   "kind": "table",
   "cols": [
    "Spec",
    "Plain meaning",
    "Why the buyer cares"
   ],
   "rows": [
    [
     "Cycle life",
     "Full round trips before capacity hits the warranty floor",
     "Sets project life and augmentation cadence - modern storage-class LFP cells rate ≥10,000-13,000 cycles by class"
    ],
    [
     "Energy density (Wh/kg · Wh/L)",
     "Energy per unit weight / volume",
     "In stationary it is footprint economics, not vehicle range - never lead with Wh/kg to a developer; lead with kWh per square meter of site"
    ],
    [
     "Round-trip efficiency",
     "Energy out ÷ energy in",
     "Every lost percent is bought twice; current systems run ≥95% DC-side"
    ],
    [
     "Degradation / SoH curve",
     "Capacity remaining, year by year",
     "The pro forma is built on it - independent engineers test the revenue model against the warranty envelope"
    ],
    [
     "Duration class",
     "Hours of discharge at rated power",
     "Maps to the revenue duty (see the power-infrastructure module) - 2h/4h/8h are different products, not one product throttled"
    ],
    [
     "Operating window",
     "Temperatures without derating",
     "Siting reach - hardened extreme-climate variants rate -30°C to 60°C; sodium reaches -40°C"
    ],
    [
     "Footprint density",
     "kWh per square meter of site",
     "Land is a cost line - transport-optimized 10-ft modular formats push past ~400 kWh/m²"
    ],
    [
     "Augmentation path",
     "Adding modules/containers later to restore capacity",
     "Space, power, and controls headroom must exist on day one - it cannot be retrofitted into a full site"
    ]
   ]
  },
  {
   "id": "ladder",
   "title": "The grid-scale cell ladder",
   "read": "2 min",
   "kind": "bars",
   "unit": "Ah per cell (class-representative sizes)",
   "items": [
    {
     "label": "280Ah class",
     "v": 280,
     "sub": "the long-time catalog standard across vendors"
    },
    {
     "label": "314Ah class",
     "v": 314,
     "sub": "≥10,000-cycle class - the current volume workhorse industry-wide"
    },
    {
     "label": "500-600Ah class",
     "v": 587,
     "sub": "mass production and first deliveries across vendors since 2025"
    },
    {
     "label": "kAh class",
     "v": 1175,
     "sub": "1,000+ Ah cells - first mass production 2025"
    },
    {
     "label": "8h-native kAh",
     "v": 1300,
     "sub": "LDES-native designs - mass deliveries ramping from late 2026"
    }
   ]
  },
  {
   "id": "stack",
   "title": "From cell to container - the integration stack",
   "read": "4 min",
   "kind": "prose",
   "ps": [
    "The chain: cell → module → liquid-cooled DC block (the container) → {{PCS}} → AC block → site. Cell makers and system suppliers sell DC blocks; the {{BMS}} rides inside them; the PCS that converts DC to grid AC is usually another vendor's scope. Keeping the layers straight tells you what a DC-block spec sheet does and does not answer for.",
    "The container landscape, by duty: standard 20-ft frames now carry ~4-5 MWh on 314Ah-class cells - the delivered fleet's building block; ~6 MWh-class 2h and 4h builds on 500-600 Ah and kAh-class cells; 8-hour LDES-native units approaching ~7 MWh per container as kAh-class cells reach mass delivery; transport-optimized 10-ft modular formats staying under road-weight limits; and hardened variants for extreme-climate sites.",
    "The large-cell logic, and its honest tradeoff: fewer cells per container means fewer welds, fewer connections, fewer failure points, and lower integration cost - a directional argument, not a costed bill-of-materials claim. The tradeoffs are thermal management and propagation behavior, which is exactly why the fire-test file (next sections) must keep pace with the ladder: a bigger cell without matching test data is a harder bankability story, not an easier one.",
    "**Field note:** the owner-furnished norm - project owners pick the cell brand; EPCs install what the owner supplies. If you find yourself explaining this stack to an EPC, you are collecting approved-vendor intel, not closing a sale."
   ]
  },
  {
   "id": "sodium",
   "title": "Sodium-ion, honestly",
   "read": "3 min",
   "kind": "prose",
   "ps": [
    "Same shuttle idea, different ion: sodium instead of lithium, typically an NFPP (sodium iron pyrophosphate) cathode with a hard-carbon anode. Shipping utility-scale sodium cells sit around 2.8 V nominal and ~95 Wh/kg, with ≥20,000-cycle class ratings and a -40°C to 60°C operating window - typically packaged as ~1-hour containerized systems.",
    "What sodium is for: power duty (short, hard, frequent cycling), brutal cold, and extreme cycle counts. What it is not for: energy duty - at roughly ~95 Wh/kg against LFP's ~170+ Wh/kg (314Ah class), a sodium container carries far less energy per footprint, so it is the wrong tool for 4h+ shifting today. Sell it as the specialist, not the successor.",
    "The claim discipline (enforced, not stylistic): sodium roadmaps across the industry run ahead of **confirmed mass production** - the defensible line for any seller is *\"here is what ships today; here is the roadmap; here is what we will commit to in writing.\"* Context that makes this matter: domestic sodium specialists are positioning inside major US accounts precisely on the sodium story - an overclaimed sodium slide is exactly the opening they need."
   ]
  },
  {
   "id": "durations",
   "title": "Duration classes - which cell serves which duty",
   "read": "4 min",
   "kind": "proscons",
   "intro": "Four duration classes, four different products. The duty descriptions are functional teaching shorthand - actual compensation varies by market (the power-infrastructure module).",
   "cards": [
    {
     "t": "1h - power duty",
     "meta": "typically served by sodium (~1h containerized systems)",
     "adv": [
      "Millisecond-to-minutes smoothing and frequency work",
      "Cold-climate reach (-40°C) and extreme cycle tolerance"
     ],
     "dis": [
      "Weakest economics per MWh of energy delivered",
      "A specialist niche today, not volume"
     ]
    },
    {
     "t": "2h - ancillary + peaks",
     "meta": "typically served by 500-600 Ah-class cells",
     "adv": [
      "The classic ERCOT merchant duty - ancillary services plus peak arbitrage",
      "Fast payback where price volatility is high"
     ],
     "dis": [
      "The most crowded field - commodity pricing pressure",
      "Ancillary markets saturate as fleets grow"
     ]
    },
    {
     "t": "4h - the capacity workhorse",
     "meta": "served by 314Ah-class and kAh-class cells alike",
     "adv": [
      "Where most US RFP volume sits - the capacity-market standard",
      "The volume SKU every serious buyer benchmarks"
     ],
     "dis": [
      "Every OEM's core product - differentiation shifts to bankability, warranty, and augmentation terms",
      "ITC-driven 4h demand is exactly where the policy fence bites hardest"
     ]
    },
    {
     "t": "8h - LDES-native",
     "meta": "served by 8h-native kAh-class designs",
     "adv": [
      "Native 8-hour design rather than two 4h systems stacked - the thinnest competitive field of the four classes",
      "Policy tailwinds in duration-mandating markets; policy risk is lowest where technical substitutability is lowest"
     ],
     "dis": [
      "Mass deliveries are only starting - the operating record is still ahead; sell the design, commit conservatively",
      "Long-duration revenue models are less standardized - expect heavier IE scrutiny"
     ]
    }
   ]
  },
  {
   "id": "safety",
   "title": "Safety and the certification words",
   "read": "4 min",
   "kind": "prose",
   "ps": [
    "{{thermal runaway}} is the failure that matters: a cell overheats past the point of self-acceleration and its neighbors follow - propagation. Everything in modern container design (liquid cooling, cell spacing, venting, gas detection, suppression) exists to prevent the first event and contain it if it happens. LFP's thermal stability is the chemistry-level head start.",
    "The vocabulary, precisely: **UL 1973** covers cells, modules, and racks (a certification listing); **UL 9540** covers the complete integrated system (the umbrella listing AHJs require); **UL 9540A is a test method with no pass/fail** - it produces propagation data at cell, module, and unit level. Never say \"9540A certified\" - say *\"tested at cell, module, and unit level; reports available.\"* **NFPA 855 (2026 edition)** is the installation standard that makes Large-Scale Fire Testing - one unit fully alight, suppression off, no propagation - effectively mandatory as states adopt it.",
    "The track record, framed honestly: the Moss Landing fire (Jan 2025) was NMC chemistry in a legacy *indoor* facility with suppression deactivated - a different device class from a modern outdoor LFP container, and the insurance market priced it exactly that way (\"not a market-moving event\"). Industry failure rates per deployed GWh fell roughly 97-99% from 2018 to 2025 per EPRI's database - which is media-derived, a caveat you state whenever you use the number.",
    "**Field note:** this section is vocabulary only. The full approval gauntlet - grid interconnection standards, IE diligence, warranty structures, the RFP checklist - lives in the bankability module, which is week-3 material in the training sequence."
   ]
  },
  {
   "id": "cards",
   "title": "Flashcards",
   "read": "drill",
   "kind": "flashcards",
   "cards": [
    {
     "q": "Why LFP for storage when EVs use NMC?",
     "a": "LFP trades energy density for thermal stability, cycle life, and cost - the exact trade a parked container wants. NMC's density advantage buys vehicle range, which stationary storage doesn't need."
    },
    {
     "q": "A developer asks about energy density. What do you answer with instead?",
     "a": "Footprint economics - kWh per square meter of site (transport-optimized modular formats push past ~400 kWh/m²). Wh/kg is a vehicle metric; land cost is the stationary equivalent."
    },
    {
     "q": "The 314Ah-class cell's headline numbers?",
     "a": "≥10,000-cycle class ratings and ~170+ Wh/kg - the industry's volume workhorse, inside the ~4-5 MWh 20-ft containers that make up most of the delivered fleet."
    },
    {
     "q": "The large-cell argument - and its tradeoff?",
     "a": "Fewer cells means fewer welds, connections, and failure points, and lower integration cost (directional claim). The tradeoff: thermal management and propagation test data must keep pace - a bigger cell without matching 9540A/LSFT data is a harder bankability story."
    },
    {
     "q": "Why does a 1-point RTE difference matter commercially?",
     "a": "Energy lost in the round trip is paid for twice - once purchased at charge, once as forgone discharge revenue. Over thousands of cycles it compounds into real money; current systems run ≥95% DC-side."
    },
    {
     "q": "What is sodium-ion for - and not for?",
     "a": "For: power duty (1h), extreme cold (-40°C), extreme cycle counts (≥20,000 class). Not for: energy duty - ~95 Wh/kg vs LFP's ~173, so far less energy per footprint. The specialist, not the successor."
    },
    {
     "q": "The defensible sodium sales line?",
     "a": "\"Here is what ships today; here is the roadmap; here is what we will commit to in writing.\" Sodium roadmaps industry-wide run ahead of confirmed mass production - overclaiming hands ammunition to the domestic sodium specialists positioning inside major accounts."
    },
    {
     "q": "What makes an 8h-native product different from two 4h systems?",
     "a": "It is LDES-native on kAh-class cells (~7 MWh per container) rather than doubled-up 4h hardware - the thinnest competitive field of the duration classes. Caveat honestly: mass deliveries are only starting."
    }
   ]
  },
  {
   "id": "quiz",
   "title": "Self-test",
   "read": "5 questions",
   "kind": "quiz",
   "items": [
    {
     "q": "A buyer asks: \"What happens to this system in year 12?\" The strongest answer leads with:",
     "c": [
      "LFP chemistry fundamentals",
      "The warranty SoH curve plus the augmentation plan designed in on day one",
      "Shipment rankings",
      "A price discount for the out-years"
     ],
     "a": 1,
     "why": "Year-12 questions are degradation-economics questions. The warranty envelope and augmentation headroom are the substantive answer; chemistry is only the setup."
    },
    {
     "q": "Which duration class is the capacity workhorse where most US RFP volume sits?",
     "c": [
      "1h",
      "2h",
      "4h",
      "8h"
     ],
     "a": 2,
     "why": "4h is the capacity-market standard every serious buyer benchmarks; 2h serves ancillary-plus-peaks; 1h is power duty (sodium's niche); 8h is bulk shifting via LDES-native designs."
    },
    {
     "q": "A prospect asks: \"Is your container UL 9540A certified?\" You say:",
     "c": [
      "Yes, fully certified",
      "9540A is a test method with no pass/fail - we provide reports at cell, module, and unit level; the certification listings are UL 1973 and UL 9540",
      "No, but we're working on it",
      "That standard doesn't apply to LFP"
     ],
     "a": 1,
     "why": "Saying \"9540A certified\" marks you as imprecise in front of any technical audience. The distinction between the test method and the listings is a credibility signal."
    },
    {
     "q": "Moss Landing comes up in a safety objection. The accurate frame is:",
     "c": [
      "An overblown media story",
      "Proof all batteries are dangerous",
      "NMC chemistry in a legacy indoor design with suppression deactivated - a different device class from modern outdoor LFP containers, and insurers priced it that way",
      "Irrelevant because it was another vendor"
     ],
     "a": 2,
     "why": "Concede the true part, then answer with structure: device-class distinction, the insurance market's read, the improving EPRI failure data (with its media-derived caveat), then your test reports."
    },
    {
     "q": "A colleague's deck claims a sodium SKU is in mass production when only a roadmap exists. You:",
     "c": [
      "Let it ship - it's roughly true",
      "Correct it - commit only to what ships today plus a written roadmap; sodium claim discipline is enforced",
      "Add a footnote",
      "Escalate to legal"
     ],
     "a": 1,
     "why": "Claim discipline is enforced. The overclaim is exactly the opening a domestic sodium specialist needs inside a major account."
    }
   ]
  },
  {
   "id": "ledger",
   "title": "Claims ledger",
   "read": "reference",
   "kind": "ledger",
   "intro": "Pointer form - this module introduces no new external claims. Each row names the internal source that carries the original citations.",
   "rows": [
    [
     "Cell and container class figures (class-typical, cross-vendor)",
     "covered supplier dossiers in profiler-data (company-published specs, cited per dossier)"
    ],
    [
     "Shipment rankings and US assembly footprints",
     "covered supplier dossiers - ecosystemRole (InfoLink/SMM/ICC per dossier)"
    ],
    [
     "9540A / NFPA 855 / LSFT mechanics; certification stack",
     "bess-bankability-certification-analysis.md - certification table"
    ],
    [
     "Moss Landing framing; insurer read; EPRI failure-rate decline (with caveat)",
     "bess-bankability-certification-analysis.md - claims ledger"
    ],
    [
     "Sodium class figures and mass-production caveats",
     "covered supplier dossiers - strategyRead sections"
    ]
   ]
  }
 ],
 "glossary": [
  {
   "t": "LFP",
   "d": "Lithium iron phosphate - the storage chemistry: thermally stable, long-cycling, cheaper per kWh, lower energy density than NMC. The default chemistry of new US grid storage."
  },
  {
   "t": "NMC",
   "d": "Nickel manganese cobalt - the energy-dense chemistry EVs favor. Higher fire severity when it fails (Moss Landing was NMC); largely displaced by LFP in new US grid storage."
  },
  {
   "t": "prismatic cell",
   "d": "A flat rectangular cell format that packs efficiently into modules and containers - the stationary-storage norm, vs the cylindrical cells of some EV lines."
  },
  {
   "t": "cycle life",
   "d": "Full charge-discharge round trips before capacity falls to the warranty floor. Distinct from calendar life (time-driven degradation regardless of use)."
  },
  {
   "t": "DoD",
   "d": "Depth of discharge - how much of the stored energy each cycle uses. Cycle-life ratings assume a stated DoD; comparing ratings across different DoD assumptions is apples to oranges."
  },
  {
   "t": "C-rate",
   "d": "Charge/discharge speed relative to capacity: 1C empties in one hour, 0.25C in four. Duration class and C-rate are two views of the same design choice."
  },
  {
   "t": "RTE",
   "d": "Round-trip efficiency - energy out divided by energy in. Losses are paid twice (bought at charge, lost at discharge); current systems run ≥95% DC-side."
  },
  {
   "t": "SoH",
   "d": "State of health - remaining capacity as a share of nameplate. The warranty carries an annual SoH table; the pro forma is financed against it."
  },
  {
   "t": "augmentation",
   "d": "Planned later addition of modules/containers to restore degraded capacity. Requires day-one space, power, and controls headroom - and is a structural incumbent advantage at renewal time."
  },
  {
   "t": "LDES",
   "d": "Long-duration energy storage - 8+ hour discharge. kAh-class cells enable 8h-native units rather than doubled-up 4h hardware."
  },
  {
   "t": "BMS",
   "d": "Battery management system - the electronics inside the container watching every cell's voltage and temperature. In Texas conversations, the no-remote-access BMS architecture is the lead, not the concession."
  },
  {
   "t": "PCS",
   "d": "Power conversion system - the inverter layer converting the container's DC to grid AC. Usually another vendor's scope; certification of the PCS (UL 1741 SB / IEEE 2800) is part of the project's file, not the cell maker's."
  },
  {
   "t": "thermal runaway",
   "d": "Self-accelerating overheating of a cell; propagation is its spread to neighbors. The failure mode all container design and all fire testing is organized around."
  }
 ]
};
}
// Content: Power Infrastructure & the AIDC Power Chain (teaching synthesis, 2026-08-24).
// Derived from repository-information/industry-guidance/power-infrastructure-aidc-analysis.md;
// no new external claims - grid/market facts via the utility-AIDC and bankability analyses,
// chain/socket structure via the relationship web and the ON.energy dossier. Phase 5 module 2 of 2.
function guidanceDocPowerInfra_() {
  return {
 "id": "power-infra-aidc-2026-08",
 "group": "Technology Foundations",
 "title": "Power Infrastructure & the AIDC Power Chain",
 "short": "The grid BESS suppliers sell into, what a battery earns, and the data-center power chain - with the three BESS sockets.",
 "source": {
  "doc": "Teaching synthesis - the utility-AIDC, bankability, China-policy and NVIDIA analyses + the relationship web + the ON.energy dossier",
  "publisher": "Internal analysis",
  "date": "August 2026",
  "pages": 4,
  "series": "Industry Guidance - training module 2 of 2 (Phase 5)",
  "repo": "repository-information/industry-guidance/power-infrastructure-aidc-analysis.md"
 },
 "updated": "2026-08-24",
 "reviewBy": "2026-12-10",
 "revisions": [
  { "date": "2026-08-29",
    "note": "Generalized to supplier/buyer-group guidance - single-company analysis moved to the admin-lens report overlays; statutory company lists retained as objective fact." }
 ],
 "tiles": [
  {
   "k": "MW vs MWh",
   "v": "power vs energy",
   "sub": "rate vs amount - the first confusion to kill in week one"
  },
  {
   "k": "~474 GW asked",
   "v": "queue ≠ demand",
   "sub": "AEP Ohio's tariff filter: a 30 GW pipeline became ~5.6 GW of signed load"
  },
  {
   "k": "85% minimum take",
   "v": "the tariff norm",
   "sub": "how utilities convert AI hype into bankable, financeable load"
  },
  {
   "k": "3 sockets",
   "v": "where BESS earns",
   "sub": "grid-side (core) · campus BtM (contested) · in-rack (incumbent-held)"
  }
 ],
 "sections": [
  {
   "id": "what",
   "title": "What this module is",
   "read": "2 min",
   "kind": "prose",
   "ps": [
    "The infrastructure half of a seller's onboarding: how the US grid is organized and paid, the two market designs a BESS is sold into, what a grid battery actually earns money doing, the power chain between a utility substation and a GPU rack, and the three sockets where batteries plug into the AI buildout. Its companion (BESS Technology Fundamentals) teaches the machine; this module teaches the world the machine is sold into.",
    "Sourcing discipline: this module introduces no new external claims. Market figures come from the utility-procurement research module, grid rules from the bankability research, chain structure from the relationship-web analysis and the ON.energy dossier - each carries the original citations. Teaching simplifications are flagged in place."
   ]
  },
  {
   "id": "grid",
   "title": "How the grid is organized - and paid",
   "read": "4 min",
   "kind": "prose",
   "ps": [
    "Three stages: generation makes power, transmission moves it at high voltage across distances, distribution steps it down and delivers it. A grid-scale BESS interconnects like a small power plant - {{FOM}}, in front of the customer's meter, paid by markets or contracts. Equipment on a customer's own site - {{BTM}} - is a different business with different buyers, which is why the distinction opens nearly every qualification call.",
    "MW versus MWh, the week-one confusion: **MW is a rate** (how fast energy flows - the pipe's width); **MWh is an amount** (how much is stored - the tank's size). Duration is simply MWh ÷ MW: a 100 MW / 400 MWh battery is a \"4-hour\" system. Misusing these in a technical room is the fastest credibility loss available to a new seller.",
    "Interconnection queues have detached from reality: ERCOT carries ~474 GW of large-load requests (about five times its all-time peak); AEP has fielded ~190 GW of inquiries against a 37 GW system. The filter that separates real from vapor is the **large-load tariff**: AEP Ohio's terms (12-year contracts, ramp schedule, then {{minimum take}} at 85%, exit fees, collateral) collapsed a 30 GW pipeline to ~5.6 GW of signed, financially committed load. That is the single number pair to remember when someone quotes a queue.",
    "**Field note:** certified and contracted MW are purchase orders on a 12-36-month fuse; queue GW are press releases. Track IRP dockets and certification orders, not headlines."
   ]
  },
  {
   "id": "markets",
   "title": "The two market designs",
   "read": "4 min",
   "kind": "table",
   "cols": [
    "",
    "ERCOT merchant",
    "Regulated states"
   ],
   "rows": [
    [
     "Who buys the BESS",
     "The developer/IPP/fund - procurement teams buying on economics",
     "The utility via IRP → RFP: either self-build (utility + EPC approved-vendor list signs the OEM) or a PPA whose bidding developer picks the cell brand"
    ],
    [
     "What wins the deal",
     "Cost, availability, speed, augmentation terms",
     "Bankability - the certification file, IE-defensible warranty, prudence-proof supply chain"
    ],
    [
     "Contract flavor",
     "Merchant revenue, tolls, hedges - tax-indifferent capital common",
     "Rate-based recovery; the 85% minimum-take world; PUC oversight"
    ],
    [
     "Fit for China-linked suppliers",
     "The core lane - ~16.3 GW ERCOT fleet (Jul 2026), buyers without ITC exposure",
     "Self-build effectively fenced for Chinese cells (Georgia → Tesla; Dominion → EVLO) - a relationship long game, not a quota lane"
    ],
    [
     "The watch item",
     "The Texas queue audit - Batch Zero target Dec 10, 2026",
     "RFP calendars: Georgia's 500 MW ESS RFP, Entergy Louisiana's first BESS RFP, PSO/SWEPCO 4.5 GW all-source, Dominion's annual cycle"
    ]
   ]
  },
  {
   "id": "revenue",
   "title": "What a grid battery earns",
   "read": "3 min",
   "kind": "prose",
   "ps": [
    "Five jobs, in plain terms. **Arbitrage**: buy energy cheap, sell it expensive - the spread is the revenue. **{{ancillary services}}**: get paid to stand ready to stabilize frequency at seconds' notice - a power job, not an energy job. **Capacity**: get paid for existing and being available at the system peak. **T&D deferral**: a well-placed battery postpones a wires upgrade, and the utility pays for the postponement. **Renewable firming**: soak up midday solar, deliver it into the evening.",
    "Duration maps to duty: 1h systems live on power jobs, 2h on ancillary-plus-peaks, 4h is the capacity workhorse where most US RFP volume sits, 8h does bulk shifting. *(Teaching simplification, flagged: this is a functional taxonomy - actual compensation rules differ by market and change; the revenue stack is modeled per project, never quoted from this table.)*",
    "Augmentation extends the earning life - and it is bought in year one: the space, power, and controls headroom either exists on day one or the second decade's economics don't. This is the same augmentation story as the technology module, seen from the revenue side - and it is a structural incumbent advantage at every renewal conversation."
   ]
  },
  {
   "id": "chain",
   "title": "The AIDC power chain - grid to GPU",
   "read": "4 min",
   "kind": "prose",
   "ps": [
    "The walk from fence to silicon: utility interconnection → campus substation → medium-voltage distribution → transformers and switchgear → the {{UPS}} layer → power distribution units → racks. *(Teaching simplification, flagged: real campuses run redundancy topologies - N+1, catcher/reserve buses - compressed here into \"the UPS layer.\")* Grid-scale containers live at or outside the fence line; a DC-block supplier's scope typically stops at the substation.",
    "The buffering problem that created a product category: GPU fleets swing between roughly 30% and 100% of load in milliseconds to seconds - a load profile the grid has never served at this scale. The rules answered: {{NOGRR 282}} requires new ≥75 MW electronic loads in ERCOT to ride through grid disturbances (grandfathered if energized or studied by Nov 14, 2025), effectively mandating a buffer - UPS, BESS, or on-site generation - between grid and GPUs. Texas's SB 6 adds curtailment protocols and a co-location kill switch for big loads: **storage converts curtailable interconnection into firm compute**, which is the cleanest sentence in the BtM pitch.",
    "**Field note:** the NVIDIA 800 VDC module teaches the inside-the-rack half of this chain - it is advanced material, not week-one material. A seller needs the fence-line view first: know where the product stops, and whose problem each layer is."
   ]
  },
  {
   "id": "sockets",
   "title": "The three BESS sockets in the AI buildout",
   "read": "4 min",
   "kind": "proscons",
   "intro": "Where batteries plug into the AI story - and the honest fit for a BESS supplier in each. The orienting rule across all three: sell to the grid, not to the data centre.",
   "cards": [
    {
     "t": "Grid-side FOM storage",
     "meta": "the core lane",
     "adv": [
      "Judged on duration, cycle life, and price - storage criteria, not AI criteria",
      "AI load growth drives utility and IPP storage procurement regardless of what happens inside any campus",
      "Merchant and safe-harbored owners buying on economics live here"
     ],
     "dis": [
      "Not \"AI-branded\" revenue - it is ordinary FOM storage (which is precisely the point)",
      "The regulated half of this lane is fenced by bankability-plus-FEOC (see the policy module)"
     ]
    },
    {
     "t": "Campus / BtM buffering",
     "meta": "contested",
     "adv": [
      "New, code-driven demand (NOGRR 282 ride-through, SB 6 curtailment) at every large campus",
      "Decided in quarters by developers and power partners, not in rate-case years"
     ],
     "dis": [
      "ON.energy defines the US category: a medium-voltage AI UPS, ride-through-certified, FEOC-clean by design, anchored by a 5 GW Crusoe deployment",
      "FEOC optics dominate hyperscale specs - realistic wins are non-US campuses and operators without ITC/FEOC exposure; qualify hard before spending pipeline time"
     ]
    },
    {
     "t": "Inside the data hall",
     "meta": "incumbent-held",
     "adv": [
      "Worth tracking: enormous category spend, and its specs cascade outward to the campus level",
      "The honest no is itself credibility - knowing your layer is a technical-audience signal"
     ],
     "dis": [
      "No entry for a BESS supplier without a rack form factor or UPS/BBU product",
      "The most China-averse buyer class in the market, served by entrenched incumbents (Vertiv, Eaton, Schneider)"
     ]
    }
   ]
  },
  {
   "id": "calendar",
   "title": "The 2026-28 gates",
   "read": "4 min",
   "kind": "timeline",
   "intro": "The dated events a seller navigates, in three lanes. Positions are approximate on the axis; dates in the labels are exact.",
   "lanes": {
    "rules": "Grid rules",
    "proc": "Procurement",
    "tx": "Texas"
   },
   "items": [
    {
     "x": 2025.5,
     "lane": "tx",
     "label": "SB 6 signed (Jun 20, 2025)",
     "sub": "≥75 MW loads: study fees, curtailment protocols, co-location kill-switch review"
    },
    {
     "x": 2025.87,
     "lane": "rules",
     "label": "NOGRR 282 grandfather line (Nov 14, 2025)",
     "sub": "new ≥75 MW electronic loads must ride through disturbances"
    },
    {
     "x": 2025.97,
     "lane": "proc",
     "label": "Georgia certification (Dec 19, 2025)",
     "sub": "9,885 MW approved incl. 3,022.5 MW company-owned BESS"
    },
    {
     "x": 2026.0,
     "lane": "rules",
     "label": "NOGRR 245 maximization deadline passed (Dec 31, 2025)",
     "sub": "ERCOT storage/IBR ride-through obligations in force"
    },
    {
     "x": 2026.17,
     "lane": "proc",
     "label": "Entergy Louisiana first BESS RFP (final docs Mar 3, 2026)",
     "sub": "the greenest vendor field among the five utility case studies"
    },
    {
     "x": 2026.6,
     "lane": "tx",
     "label": "Queue audit - Batch Zero paused (Aug 3, 2026)",
     "sub": "~49.8 GW / up to $15B at risk per BNEF"
    },
    {
     "x": 2026.75,
     "lane": "rules",
     "label": "PRC-029-1 enforceable (~Oct 1, 2026)",
     "sub": "mandatory IBR ride-through incl. BESS - FERC Order 909"
    },
    {
     "x": 2026.94,
     "lane": "tx",
     "label": "Batch Zero target (Dec 10, 2026)",
     "sub": "Texas queue repricing lands - re-verify TX-dependent forecasts"
    },
    {
     "x": 2027.0,
     "lane": "proc",
     "label": "Dominion GS-5 effective (Jan 1, 2027)",
     "sub": "≥25 MW loads: 14-yr contracts, 85%/60% minimums"
    },
    {
     "x": 2027.3,
     "lane": "proc",
     "label": "Georgia 500 MW ESS RFP cycle",
     "sub": "third-party storage, independent evaluator; ~1,000 MW more signaled"
    },
    {
     "x": 2028.0,
     "lane": "rules",
     "label": "NFPA 855-2026 adoption spreads",
     "sub": "Large-Scale Fire Testing effectively mandatory as states adopt"
    }
   ]
  },
  {
   "id": "vocab",
   "title": "The seller's vocabulary discipline",
   "read": "2 min",
   "kind": "callout",
   "ps": [
    "**MW is a rate, MWh is an amount** - duration is MWh ÷ MW. Misuse is the fastest credibility loss available.",
    "**NOGRR 245 is storage/IBR ride-through; NOGRR 282 is large electronic loads** (data centers). Mixing them in an ERCOT room costs you the technical audience.",
    "**Certified MW, not queue GW** - queues are ~5x reality; tariff-committed and certification-order MW are the real pipeline.",
    "**Minimum take** (85% is the national norm) is how a utility makes AI load bankable - and a bankability world is a certification-file world.",
    "**Sell to the grid, not to the data centre** - the largest storage buildout AI causes is ordinary FOM storage judged on storage criteria.",
    "**In Texas, lead with the no-remote-access architecture** (LSIPA / NPRR1199) before it is asked for - it converts an objection into a spec you wrote."
   ]
  },
  {
   "id": "cards",
   "title": "Flashcards",
   "read": "drill",
   "kind": "flashcards",
   "cards": [
    {
     "q": "A 200 MW / 800 MWh battery - the duration, and which number is 'power'?",
     "a": "4 hours (800 ÷ 200). MW is the power (rate); MWh is the energy (amount)."
    },
    {
     "q": "Why do interconnection queues mislead, and what filters them?",
     "a": "Speculative and duplicated requests - ERCOT's ~474 GW is ~5x its peak. The large-load tariff is the filter: AEP Ohio's terms collapsed 30 GW of pipeline to ~5.6 GW of signed load."
    },
    {
     "q": "Who signs the cell PO in a regulated utility's PPA procurement?",
     "a": "The developer who bid the RFP - the utility never picks the cell brand except in self-build, where the utility and its EPC's approved-vendor list decide."
    },
    {
     "q": "NOGRR 245 vs NOGRR 282?",
     "a": "245: ride-through for storage and other inverter-based resources. 282: ride-through for ≥75 MW electronic loads (data centers). Different rules, different parties, never interchangeable."
    },
    {
     "q": "What does SB 6 do to big Texas loads - and the pitch sentence it enables?",
     "a": "Study fees, mandatory curtailment protocols, co-location kill-switch review for ≥75 MW loads. The pitch: storage converts curtailable interconnection into firm compute."
    },
    {
     "q": "The three BESS sockets and the supplier fit in each?",
     "a": "Grid-side FOM (the core lane - judged on duration, cycle life, price); campus BtM buffering (contested - ON.energy's FEOC-clean AI UPS defines the US category); inside the data hall (incumbent-held - no entry without a rack or UPS product)."
    },
    {
     "q": "What is ON.energy's AI UPS in one sentence?",
     "a": "A medium-voltage, BESS-based UPS sitting inline between grid and AI campus - ride-through-certified, FEOC-clean by design, anchored by a 5 GW Crusoe deployment - the product defining the US BtM buffering category."
    },
    {
     "q": "Five things a grid battery gets paid to do?",
     "a": "Arbitrage, ancillary/frequency services, capacity, T&D deferral, renewable firming - with duration class deciding which jobs a system can hold."
    }
   ]
  },
  {
   "id": "quiz",
   "title": "Self-test",
   "read": "5 questions",
   "kind": "quiz",
   "items": [
    {
     "q": "A prospect brags their project is '2 GW in the ERCOT queue.' Your internal read:",
     "c": [
      "A strong buying signal - prioritize the account",
      "Queue position is weak evidence - qualify for tariff commitment, site control, and certification status before it enters the pipeline",
      "Disqualify immediately",
      "Ask for the queue number to verify"
     ],
     "a": 1,
     "why": "Queues run ~5x reality. The tariff filter (minimum take, collateral, exit fees) separates committed load from vapor."
    },
    {
     "q": "A regulated Southeast utility announces a self-build BESS program. The realistic motion for a §154-listed supplier is:",
     "c": [
      "Bid aggressively on price",
      "Relationship coverage - EPC approved-vendor lists and the IE ecosystem - because self-build is effectively closed to Chinese cells on prudence/FEOC grounds",
      "Offer the ITC adder",
      "Wait for the RFP"
     ],
     "a": 1,
     "why": "Georgia went Tesla, Dominion went EVLO. Self-build is the long game; the addressable regulated entry is the developer bidding a PPA on a safe-harbored or non-ITC structure."
    },
    {
     "q": "A data-center developer in ERCOT asks how to satisfy NOGRR 282. The correct frame:",
     "c": [
      "Offer 282-certified containers",
      "282 requires their ≥75 MW load to ride through disturbances - a buffering layer (UPS, BESS, or generation) between grid and GPUs; a supplier's fit depends on the buyer's FEOC/ITC posture, and the US category leader is a FEOC-clean MV AI UPS",
      "282 doesn't apply to data centers",
      "Storage is exempt under SB 6"
     ],
     "a": 1,
     "why": "Honest qualification: the socket is real, code-driven - and contested. Claiming '282-certified containers' would also repeat the 245/282 vocabulary error."
    },
    {
     "q": "Which pairing is correct?",
     "c": [
      "MW = amount, MWh = rate",
      "NOGRR 245 = data-center loads, 282 = storage",
      "MW = rate, MWh = amount; 245 = storage/IBR, 282 = large electronic loads",
      "Duration = MW ÷ MWh"
     ],
     "a": 2,
     "why": "The two vocabulary pairs this module exists to make automatic."
    },
    {
     "q": "Why does 'sell to the grid, not to the data centre' hold even in the AI boom?",
     "c": [
      "Data centers don't buy batteries",
      "The largest storage buildout AI causes is utility- and IPP-owned FOM storage judged on duration, cycle life, and price - storage criteria - while the inside-the-fence sockets are FEOC-contested or incumbent-held",
      "Grid sales close faster",
      "Utilities pay more per MWh"
     ],
     "a": 1,
     "why": "The orienting rule: a BESS supplier does not need to be inside a data centre to be paid by data-centre demand growth."
    }
   ]
  },
  {
   "id": "ledger",
   "title": "Claims ledger",
   "read": "reference",
   "kind": "ledger",
   "intro": "Pointer form - this module introduces no new external claims. Each row names the internal source that carries the original citations.",
   "rows": [
    [
     "Queue figures (ERCOT ~474 GW; AEP ~190 GW); AEP Ohio tariff terms and 30 GW → 5.6 GW; 85% norm",
     "utility-aidc-procurement-analysis.md - executive read + AEP case study"
    ],
    [
     "SB 6 provisions; NOGRR 282 mechanics and grandfather date; Batch Zero audit",
     "utility-aidc-procurement-analysis.md - Oncor case study + ledger"
    ],
    [
     "Georgia certification (9,885 MW / 3,022.5 MW BESS); ELL RFP; GS-5; ERCOT fleet ~16.3 GW",
     "utility-aidc-procurement-analysis.md - case studies + ledger"
    ],
    [
     "PRC-029-1 and NOGRR 245 dates and scope",
     "bess-bankability-certification-analysis.md - grid-gauntlet rows"
    ],
    [
     "The buyer map (self-build vs PPA vs merchant); owner-furnished norm; the three sockets",
     "utility-aidc-procurement-analysis.md buyer map + the internal relationship-web analysis"
    ],
    [
     "AI UPS category facts (MV, ride-through, FEOC-clean, 5 GW Crusoe)",
     "on-energy.profile.json - summary + strategy reads"
    ],
    [
     "GPU transient behavior (30→100% in ms-s)",
     "nvidia-800vdc-analysis.md + on-energy.profile.json (paraphrased; page cites there)"
    ],
    [
     "Texas LSIPA / NPRR1199 no-remote-access overlay",
     "china-policy-stack-analysis.md - Texas overlay"
    ]
   ]
  }
 ],
 "glossary": [
  {
   "t": "FOM",
   "d": "Front-of-meter - interconnected to the grid like a power plant, paid by markets or contracts. Grid-scale BESS is FOM - the core of the business."
  },
  {
   "t": "BTM",
   "d": "Behind-the-meter - on the customer's side of the meter, offsetting their load or protecting their operations. The campus buffering socket is BTM."
  },
  {
   "t": "minimum take",
   "d": "The share of contracted capacity a large-load customer must pay for whether or not they use it - 85% is the national norm (AEP Ohio's template). What makes AI load bankable."
  },
  {
   "t": "ancillary services",
   "d": "Grid-stability products - chiefly frequency response - paid for readiness at seconds' notice. A power (MW) job that favors short-duration, fast-cycling systems."
  },
  {
   "t": "IRP",
   "d": "Integrated Resource Plan - the regulated utility's filed roadmap of future needs. IRP dockets and certification orders are the true pipeline signal; certified MW become POs on a 12-36-month fuse."
  },
  {
   "t": "IBR",
   "d": "Inverter-based resource - anything grid-connected through power electronics (solar, wind, BESS). The ride-through rules (IEEE 2800, PRC-029-1, NOGRR 245) attach to IBRs."
  },
  {
   "t": "ride-through",
   "d": "Staying connected and behaving predictably through a grid disturbance instead of tripping offline. Required of storage (NOGRR 245, PRC-029-1) and now of big data-center loads (NOGRR 282)."
  },
  {
   "t": "curtailment",
   "d": "Reducing a load or resource on grid instruction. SB 6 makes curtailment capability a condition of big-load interconnection in Texas - which is what makes buffering storage valuable."
  },
  {
   "t": "UPS",
   "d": "Uninterruptible power supply - the layer keeping IT load alive through disturbances. The BESS-based medium-voltage AI UPS (ON.energy's category) moves this function to the campus scale."
  },
  {
   "t": "NOGRR 282",
   "d": "ERCOT's ride-through rule for ≥75 MW electronic loads (data centers), grandfather line Nov 14, 2025. Not a storage rule - storage is NOGRR 245."
  },
  {
   "t": "PPA",
   "d": "Power purchase agreement - a long-term contract for a project's output. In regulated RFPs won via PPA, the developer holding the PPA picks the cell brand."
  },
  {
   "t": "ESA",
   "d": "Energy services agreement - the contract structure behind utility-built capacity funded by a specific customer (e.g. Meta funding Entergy's gas plants). How anchor tenants cascade procurement norms downstream."
  }
 ]
};
}
// PROJECT: ── end Industry Guidance ───────────────────────────────────────

// PROJECT END
// ══════════════

// ══════════════
// CROSS-PROJECT SESSION MANAGEMENT
// Enables the GlobalACL "Global Sessions" feature to query and manage
// sessions on this project remotely via UrlFetchApp. The shared secret
// is read from the "Config" tab of the Master ACL Spreadsheet.
// ══════════════

/**
 * Check if a row in the Access tab is a metadata row (#NAME, #URL, #AUTH).
 */
function isMetadataRow(row) { return String(row[0]).trim().charAt(0) === '#'; }

/**
 * Ensure the Access tab has the 3 metadata rows (#NAME, #URL, #AUTH) after the header.
 * If missing, inserts them and shifts existing user data down.
 */
function ensureMetadataRows(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2 || String(data[1][0]).trim() !== '#NAME') {
    sheet.insertRowsAfter(1, 5);
    sheet.getRange(2, 1).setValue('#NAME');
    sheet.getRange(3, 1).setValue('#URL');
    sheet.getRange(4, 1).setValue('#AUTH');
    sheet.getRange(5, 1).setValue('#ICON');
    sheet.getRange(6, 1).setValue('#DESC');
  } else if (data.length < 5 || String(data[4][0]).trim() !== '#ICON') {
    // Existing spreadsheet with 3 metadata rows — add #ICON and #DESC
    sheet.insertRowsAfter(4, 2);
    sheet.getRange(5, 1).setValue('#ICON');
    sheet.getRange(6, 1).setValue('#DESC');
  }
}

/**
 * Auto-register this project in the Access tab metadata rows of the Master ACL Spreadsheet.
 * Metadata is stored in rows 2-6 (#NAME, #URL, #AUTH, #ICON, #DESC) under the project's page column.
 * Runs once per execution (cached flag).
 */
var _selfRegistered = false;
function registerSelfProject() {
  if (_selfRegistered) return;
  _selfRegistered = true;
  try {
    // Throttle. The five metadata cells this writes (#NAME/#URL/#AUTH/#ICON/#DESC)
    // only change when the project is redeployed, but this ran on EVERY page load.
    // With several projects sharing one Access tab, that is a constant stream of
    // writes against the same sheet the sign-in check has to read — the contention
    // that makes an ACL read fail in the first place. Keyed on VERSION so a new
    // build always re-registers, and the deploy route clears the marker outright.
    var regCache = getEpochCache();
    var regKey = 'selfreg_' + ACL_PAGE_NAME;
    if (regCache.get(regKey) === VERSION) return;

    var ss = SpreadsheetApp.openById(MASTER_ACL_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(ACL_SHEET_NAME);
    if (!sheet) return;

    ensureMetadataRows(sheet);

    // Find column for this project
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colIdx = -1;
    for (var c = 0; c < headers.length; c++) {
      if (String(headers[c]).trim().toLowerCase() === ACL_PAGE_NAME.toLowerCase()) {
        colIdx = c;
        break;
      }
    }

    // If column doesn't exist, add it
    if (colIdx === -1) {
      colIdx = headers.length;
      sheet.getRange(1, colIdx + 1).setValue(ACL_PAGE_NAME);
      sheet.getRange(2, colIdx + 1).setValue('');
      sheet.getRange(3, colIdx + 1).setValue('');
      sheet.getRange(4, colIdx + 1).setValue(false);
      sheet.getRange(5, colIdx + 1).setValue('');
      sheet.getRange(6, colIdx + 1).setValue('');
      var lastRow = sheet.getLastRow();
      if (lastRow > 6) {
        // Auto-authorize developers on new-project registration: users whose Role
        // (col B) is "developer" start authorized (TRUE); everyone else starts FALSE.
        // Only runs when the column is first created — never overwrites admin edits.
        var roleValues = sheet.getRange(7, 2, lastRow - 6, 1).getValues();
        var accessValues = [];
        for (var f = 0; f < lastRow - 6; f++) {
          accessValues.push([String(roleValues[f][0]).trim().toLowerCase() === 'developer']);
        }
        sheet.getRange(7, colIdx + 1, lastRow - 6, 1).setValues(accessValues);
        sheet.getRange(7, colIdx + 1, lastRow - 6, 1).insertCheckboxes();
      }
    }

    // Determine this project's URL
    var isSelfProject = (ACL_PAGE_NAME === 'globalacl');
    var myUrl = isSelfProject ? 'SELF'
      : (DEPLOYMENT_ID && DEPLOYMENT_ID !== 'YOUR_DEPLOYMENT_ID')
        ? 'https://script.google.com/macros/s/' + DEPLOYMENT_ID + '/exec'
        : '';
    if (!myUrl) return;

    // Write/update metadata rows for this project's column.
    // Placeholder guards — if TITLE / PORTAL_ICON / PORTAL_DESCRIPTION were left as
    // template placeholders (fields left blank in the GAS project creator), derive
    // presentable values from ACL_PAGE_NAME instead of writing raw placeholder tokens.
    var derivedTitle = ACL_PAGE_NAME.split(/[-_]/).map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
    var regTitle = (!TITLE || TITLE === 'TEMPLATE_TITLE' || TITLE === 'YOUR_PROJECT_TITLE' || TITLE.indexOf('CHANGE THIS PROJECT TITLE') === 0) ? derivedTitle : TITLE;
    var regIcon = (typeof PORTAL_ICON !== 'undefined' && PORTAL_ICON && PORTAL_ICON !== 'TEMPLATE_PORTAL_ICON') ? PORTAL_ICON : '📱';
    var regDesc = (typeof PORTAL_DESCRIPTION !== 'undefined' && PORTAL_DESCRIPTION && PORTAL_DESCRIPTION !== 'TEMPLATE_PORTAL_DESCRIPTION' && PORTAL_DESCRIPTION.indexOf('CHANGE THIS PROJECT TITLE') !== 0) ? PORTAL_DESCRIPTION : regTitle + ' application.';
    var col = colIdx + 1;
    sheet.getRange(2, col).setValue(regTitle);
    sheet.getRange(3, col).setValue(myUrl);
    sheet.getRange(4, col).setValue(true);
    sheet.getRange(5, col).setValue(regIcon);
    sheet.getRange(6, col).setValue(regDesc);
    // Only marked done after a fully successful pass, so a failed registration
    // retries on the next page load instead of being suppressed for 6 hours.
    regCache.put(regKey, VERSION, 21600);
  } catch (e) {
    Logger.log('registerSelfProject error: ' + e.message);
  }
}

/**
 * Read the cross-project admin secret from Script Properties.
 * Cached in-memory for the duration of a single GAS execution.
 */
var _crossProjectSecret = null;
function getCrossProjectSecret() {
  if (_crossProjectSecret) return _crossProjectSecret;
  try {
    _crossProjectSecret = PropertiesService.getScriptProperties()
      .getProperty('CROSS_PROJECT_ADMIN_SECRET') || '';
    return _crossProjectSecret;
  } catch (e) {
    Logger.log('getCrossProjectSecret error: ' + e.message);
  }
  return '';
}

/**
 * Validate a cross-project request: shared secret must match and caller must be admin.
 */
function validateCrossProjectAdmin(params) {
  var secret = (params && params.secret) || '';
  var callerEmail = (params && params.callerEmail) || '';
  if (!secret || !callerEmail) return { valid: false, reason: 'missing_params' };
  var expected = getCrossProjectSecret();
  if (!expected || secret !== expected) return { valid: false, reason: 'invalid_secret' };
  // Verify caller has admin role via ACL
  var access = checkSpreadsheetAccess(callerEmail);
  if (!access.hasAccess || access.role !== 'admin') return { valid: false, reason: 'not_admin' };
  return { valid: true, email: callerEmail };
}

/**
 * List active sessions for cross-project aggregation (skips session-token validation).
 * Called by the cross-project listSessions endpoint after secret+admin validation.
 */
function listActiveSessionsInternal(callerEmail) {
  var cache = getEpochCache();
  var activeSessions = [];
  try {
    var ss = SpreadsheetApp.openById(MASTER_ACL_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(ACL_SHEET_NAME);
    if (!sheet) return activeSessions;
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      var email = String(data[r][0]).trim().toLowerCase();
      if (!email || email.indexOf('@') === -1) continue;
      var trackKey = 'sessions_' + email;
      var raw = cache.get(trackKey);
      if (!raw) continue;
      var tokens;
      try { tokens = JSON.parse(raw); } catch (e) { continue; }
      for (var i = 0; i < tokens.length; i++) {
        var sessionRaw = cache.get('session_' + tokens[i]);
        if (!sessionRaw) continue;
        var sess;
        try { sess = JSON.parse(sessionRaw); } catch (e) { continue; }
        var absRemaining = 0;
        if (sess.absoluteCreatedAt && AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
          absRemaining = Math.max(0, Math.round(
            AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT - ((Date.now() - sess.absoluteCreatedAt) / 1000)
          ));
        }
        var rollingRemaining = Math.max(0, Math.round(
          AUTH_CONFIG.SESSION_EXPIRATION - ((Date.now() - sess.createdAt) / 1000)
        ));
        activeSessions.push({
          email: sess.email,
          displayName: sess.displayName || '',
          role: sess.role || RBAC_DEFAULT_ROLE,
          createdAt: sess.absoluteCreatedAt || sess.createdAt,
          lastActivity: sess.lastActivity,
          absoluteRemaining: absRemaining,
          rollingRemaining: rollingRemaining,
          isEmergencyAccess: sess.isEmergencyAccess || false,
          isSelf: (sess.email || '').toLowerCase() === (callerEmail || '').toLowerCase(),
          project: TITLE
        });
      }
    }
  } catch (e) {
    Logger.log('listActiveSessionsInternal error: ' + e.message);
  }
  return activeSessions;
}

// ══════════════
// ADMIN UTILITIES — run from the GAS Editor (select function → Run)
// These are generic admin tools that work with any auth project.
// ══════════════

/**
 * Clear the access cache for a specific user so their next login reads the ACL fresh.
 * @param {string} email — the user's email address. When called from the GAS editor
 *   (no parameter), reads from Script Properties key "CLEAR_CACHE_EMAIL".
 *   Usage: Script Properties → CLEAR_CACHE_EMAIL = user@example.com → Run this function.
 * Note: uses the same epoch bump as clearAllAccessCache — all users are affected.
 * GAS CacheService does not support per-key enumeration, so targeted clearing is not possible.
 */
function clearAccessCacheForUser(email) {
  if (!email) {
    email = PropertiesService.getScriptProperties().getProperty('CLEAR_CACHE_EMAIL');
  }
  if (!email) {
    Logger.log('No email specified. Set Script Properties key "CLEAR_CACHE_EMAIL" or pass email as parameter.');
    return;
  }
  // Bump epoch to invalidate all cache (no way to target individual keys in GAS)
  clearAllAccessCache();
  Logger.log('Cache cleared for all users (epoch bumped). Target user: ' + email);
}

/**
 * Nuclear cache clear — increments the cache epoch so ALL existing CacheService entries
 * are instantly orphaned (they have the old epoch prefix and will never be read again).
 * No need to enumerate individual keys — everything is invalidated at once.
 * After incrementing, all users must re-authenticate on their next request.
 */
function clearAllAccessCache() {
  var props = PropertiesService.getScriptProperties();
  var oldEpoch = parseInt(props.getProperty('CACHE_EPOCH') || '0', 10);
  var newEpoch = String(oldEpoch + 1);
  props.setProperty('CACHE_EPOCH', newEpoch);

  // Reset in-memory cache for this execution
  _cacheEpoch = newEpoch;
  _rbacRolesCache = null;
  _rbacRolesCacheExpiry = 0;

  Logger.log('Cache epoch bumped from ' + oldEpoch + ' to ' + newEpoch
    + ' — ALL cached access, roles, and sessions are now invalidated.'
    + ' Old entries will expire naturally from CacheService within 10 minutes.');
}

/**
 * Diagnostic — probe all known cache key patterns and log what's found.
 * Run from the GAS editor to see what's currently in the cache.
 * Checks both the current epoch and the previous epoch (to detect stale entries).
 */
function inspectCache() {
  var props = PropertiesService.getScriptProperties();
  var epoch = parseInt(props.getProperty('CACHE_EPOCH') || '0', 10);
  var raw = CacheService.getScriptCache();

  // Collect emails from ACL + sharing list
  var emails = [];
  var hasAcl = MASTER_ACL_SPREADSHEET_ID && MASTER_ACL_SPREADSHEET_ID !== "YOUR_MASTER_ACL_SPREADSHEET_ID";
  if (hasAcl) {
    try {
      var aclSs = SpreadsheetApp.openById(MASTER_ACL_SPREADSHEET_ID);
      var aclSheet = aclSs.getSheetByName(ACL_SHEET_NAME);
      if (aclSheet) {
        var data = aclSheet.getDataRange().getValues();
        for (var r = 1; r < data.length; r++) {
          var em = String(data[r][0]).trim().toLowerCase();
          if (em && em.indexOf('@') > -1) emails.push(em);
        }
      }
    } catch(e) { Logger.log('ACL read error: ' + e.message); }
  }
  var hasSheet = SPREADSHEET_ID && SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID";
  if (hasSheet) {
    try {
      var dataSs = SpreadsheetApp.openById(SPREADSHEET_ID);
      var allUsers = dataSs.getEditors().concat(dataSs.getViewers());
      for (var u = 0; u < allUsers.length; u++) {
        var ue = allUsers[u].getEmail().toLowerCase();
        if (ue && emails.indexOf(ue) === -1) emails.push(ue);
      }
    } catch(e) { Logger.log('Sharing list read error: ' + e.message); }
  }

  Logger.log('══════ CACHE INSPECTION ══════');
  Logger.log('Current epoch: ' + epoch);
  Logger.log('Users found: ' + emails.length);
  Logger.log('');

  // Check both current and previous epoch
  var epochs = [epoch, epoch - 1];
  for (var ei = 0; ei < epochs.length; ei++) {
    var ep = epochs[ei];
    if (ep < 0) continue;
    var pfx = 'e' + ep + '_';
    var label = (ep === epoch) ? 'CURRENT (e' + ep + ')' : 'PREVIOUS (e' + ep + ' — should be empty)';
    Logger.log('── ' + label + ' ──');

    // Roles matrix
    var rolesVal = raw.get(pfx + 'rbac_roles_matrix');
    Logger.log('  rbac_roles_matrix: ' + (rolesVal ? rolesVal.substring(0, 100) + '...' : '(empty)'));

    // Per-user keys
    for (var i = 0; i < emails.length; i++) {
      var email = emails[i];
      var access = raw.get(pfx + 'access_' + email);
      var role = raw.get(pfx + 'role_' + email);
      var sessions = raw.get(pfx + 'sessions_' + email);
      if (access || role || sessions) {
        Logger.log('  ' + email + ':');
        if (access) Logger.log('    access_: ' + access);
        if (role) Logger.log('    role_: ' + role);
        if (sessions) {
          try {
            var tokens = JSON.parse(sessions);
            Logger.log('    sessions_: ' + tokens.length + ' active token(s)');
            for (var t = 0; t < tokens.length; t++) {
              var sessRaw = raw.get(pfx + 'session_' + tokens[t]);
              if (sessRaw) {
                try {
                  var sess = JSON.parse(sessRaw);
                  Logger.log('      session ' + (t+1) + ': role=' + sess.role + ', created=' + new Date(sess.createdAt).toISOString());
                } catch(pe) {
                  Logger.log('      session ' + (t+1) + ': (unparseable)');
                }
              } else {
                Logger.log('      session ' + (t+1) + ': (expired/missing)');
              }
            }
          } catch(je) { Logger.log('    sessions_: (unparseable)'); }
        }
      }
    }
    Logger.log('');
  }
  Logger.log('══════ END INSPECTION ══════');
}

/**
 * List all active sessions by walking the ACL spreadsheet.
 * Admin-only — requires a valid session with 'admin' permission.
 * Called via google.script.run from the admin session panel.
 */
function listActiveSessions(sessionToken) {
  var user = validateSessionForData(sessionToken, 'listActiveSessions');
  checkPermission(user, 'admin', 'listActiveSessions');

  var cache = getEpochCache();
  var activeSessions = [];

  try {
    var ss = SpreadsheetApp.openById(MASTER_ACL_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(ACL_SHEET_NAME);
    if (!sheet) return activeSessions;
    var data = sheet.getDataRange().getValues();

    for (var r = 1; r < data.length; r++) {
      var email = String(data[r][0]).trim().toLowerCase();
      if (!email || email.indexOf('@') === -1) continue;

      var trackKey = 'sessions_' + email;
      var raw = cache.get(trackKey);
      if (!raw) continue;

      var tokens;
      try { tokens = JSON.parse(raw); } catch (e) { continue; }

      for (var i = 0; i < tokens.length; i++) {
        var sessionRaw = cache.get('session_' + tokens[i]);
        if (!sessionRaw) continue;

        var sess;
        try { sess = JSON.parse(sessionRaw); } catch (e) { continue; }

        var absRemaining = 0;
        if (sess.absoluteCreatedAt && AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
          absRemaining = Math.max(0, Math.round(
            AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT - ((Date.now() - sess.absoluteCreatedAt) / 1000)
          ));
        }
        var rollingRemaining = Math.max(0, Math.round(
          AUTH_CONFIG.SESSION_EXPIRATION - ((Date.now() - sess.createdAt) / 1000)
        ));

        activeSessions.push({
          email: sess.email,
          displayName: sess.displayName || '',
          role: sess.role || RBAC_DEFAULT_ROLE,
          createdAt: sess.absoluteCreatedAt || sess.createdAt,
          lastActivity: sess.lastActivity,
          absoluteRemaining: absRemaining,
          rollingRemaining: rollingRemaining,
          isEmergencyAccess: sess.isEmergencyAccess || false,
          isSelf: (sess.email || '').toLowerCase() === (user.email || '').toLowerCase()
        });
      }
    }
  } catch (e) {
    Logger.log('listActiveSessions error: ' + e.message);
  }

  auditLog('admin_action', user.email, 'list_active_sessions',
    { sessionCount: activeSessions.length });

  return activeSessions;
}

/**
 * Sign out a specific user by email (invalidate all their sessions).
 * Admin-only — requires a valid session with 'admin' permission.
 * Called via google.script.run from the admin session panel.
 */
function adminSignOutUser(sessionToken, targetEmail) {
  var user = validateSessionForData(sessionToken, 'adminSignOutUser');
  checkPermission(user, 'admin', 'adminSignOutUser');

  if (!targetEmail) return { success: false, error: 'no_email' };

  invalidateAllSessions(targetEmail, 'admin_signout');

  auditLog('admin_action', user.email, 'admin_sign_out_user',
    { targetEmail: targetEmail });

  return { success: true, email: targetEmail };
}

// ══════════════
// TEMPLATE START
// ══════════════

// =============================================
// NOAUTH — Web App Entry Point (doGet)
// Shared baseline structure; auth-specific routing added in AUTH section.
// =============================================

// (doGet is defined in the AUTH section below because it requires auth routing)

function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) || "";

  // ⚠️ CRITICAL: Do NOT add authentication, secret checks, or any guards to this deploy handler.
  // The GitHub Actions workflow calls doPost(action=deploy) via webhook to trigger GAS self-update.
  // Adding auth here (e.g. DEPLOY_SECRET check) will silently break auto-updates — the workflow
  // gets "Unauthorized" and the GAS script never pulls new code from GitHub.
  // The deploy action only calls pullAndDeployFromGitHub() which is safe — it overwrites the
  // script with whatever is on GitHub (the source of truth), so there is no abuse vector.
  if (action === "deploy") {
    var result = pullAndDeployFromGitHub();
    // Deploy-time self-registration — a brand-new project appears in the Master ACL
    // Access tab as soon as CI deploys it, without anyone having to open the app first.
    // Clear the registration throttle first so a deploy always rewrites the metadata
    // even when the cached marker is still fresh.
    try { getEpochCache().remove('selfreg_' + ACL_PAGE_NAME); } catch (eReg) {}
    registerSelfProject();
    return ContentService.createTextOutput(result);
  }

  // Data poll via fetch() — eliminates iframe navigation churn that caused
  // "A listener indicated an asynchronous response" errors in the console.
  // Uses doPost + ContentService (which sets CORS headers on ANYONE_ANONYMOUS
  // deployments) instead of doGet + HtmlService iframe navigation.
  if (action === "getData") {
    var dpToken = (e && e.parameter && e.parameter.token) || "";
    var dpResult = processDataPoll(dpToken);
    return ContentService.createTextOutput(JSON.stringify(dpResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Heartbeat via fetch() — same pattern as getData to eliminate iframe churn.
  if (action === "heartbeat") {
    var hbToken = (e && e.parameter && e.parameter.token) || "";
    var hbResult = processHeartbeat(hbToken);
    return ContentService.createTextOutput(JSON.stringify(hbResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Token exchange via fetch() — iframe-free sign-in transport. The iframe flow
  // auto-creates HMAC_SECRET via doGet page loads; the fetch flow enters through
  // doPost, so ensure required Script Properties here too.
  if (action === "exchangeToken") {
    var xtToken = (e && e.parameter && e.parameter.token) || "";
    var xtResult;
    try {
      ensureScriptProperties_();
      xtResult = exchangeTokenForSession(xtToken);
    } catch (xtErr) {
      xtResult = { success: false, error: String((xtErr && xtErr.message) || xtErr) };
    }
    if (xtResult && xtResult.success) xtResult.version = VERSION;
    return ContentService.createTextOutput(JSON.stringify(xtResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Sign-out via fetch() — same iframe-free pattern.
  if (action === "signOut") {
    var soToken = (e && e.parameter && e.parameter.token) || "";
    var soResult;
    try {
      soResult = processSignOut(soToken);
    } catch (soErr) {
      soResult = { type: 'gas-signed-out', success: false, error: String((soErr && soErr.message) || soErr) };
    }
    return ContentService.createTextOutput(JSON.stringify(soResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // PROJECT: field-note ops via fetch() — the note box in Profiler.html talks
  // to this backend exclusively over cookie-less fetch (the fleet's reliable
  // transport; document-loads of /exec break in cookie-carrying browsers).
  // POST is the primary path (required for file payloads); the GET api route
  // mirrors the no-file ops as a fallback.
  if (action === "note") {
    return ContentService.createTextOutput(JSON.stringify(handleNoteOp_(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // PROJECT: Industry Guidance ops via fetch() — same transport rationale as
  // the note ops above; admin-gated server-side in handleGuidanceOp_.
  if (action === "guidance") {
    return ContentService.createTextOutput(JSON.stringify(handleGuidanceOp_(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput("Unknown action");
}

function getAppData() {
  var data = { version: VERSION, title: TITLE };
  return data;
}

/**
 * Ensure HMAC_SECRET and CACHE_EPOCH exist in Script Properties.
 * Called after a successful deploy — generates defaults if missing.
 * Existing values are never overwritten.
 */
function ensureScriptProperties_() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (!props.getProperty('CACHE_EPOCH')) {
      props.setProperty('CACHE_EPOCH', '1');
    }
    if (!props.getProperty('HMAC_SECRET')) {
      var chars = '0123456789abcdef';
      var secret = '';
      for (var i = 0; i < 64; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      props.setProperty('HMAC_SECRET', secret);
    }
  } catch (e) {
    Logger.log('ensureScriptProperties_ error: ' + e.message);
  }
}

function pullAndDeployFromGitHub() {
  // Audit: Log every deploy trigger for security monitoring
  var auditCache = getEpochCache();
  var deployLog = auditCache.get('deploy_audit_log') || '[]';
  var log;
  try { log = JSON.parse(deployLog); } catch(e) { log = []; }
  log.push({
    timestamp: new Date().toISOString(),
    trigger: 'doPost(action=deploy)',
    currentVersion: VERSION
  });
  if (log.length > 20) log = log.slice(-20);
  auditCache.put('deploy_audit_log', JSON.stringify(log), 21600);

  var GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");

  var apiUrl = "https://api.github.com/repos/"
    + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + FILE_PATH
    + "?ref=" + GITHUB_BRANCH + "&t=" + new Date().getTime();

  var fetchHeaders = { "Accept": "application/vnd.github.v3.raw" };
  if (GITHUB_TOKEN) {
    fetchHeaders["Authorization"] = "token " + GITHUB_TOKEN;
  }

  var response = UrlFetchApp.fetch(apiUrl, { headers: fetchHeaders });
  var newCode = response.getContentText();

  var versionMatch = newCode.match(/var VERSION\s*=\s*"([^"]+)"/);
  var pulledVersion = versionMatch ? versionMatch[1] : null;

  if (pulledVersion && pulledVersion === VERSION) {
    return "Already up to date (" + VERSION + ")";
  }

  var scriptId = ScriptApp.getScriptId();
  var url = "https://script.googleapis.com/v1/projects/" + scriptId + "/content";
  var current = UrlFetchApp.fetch(url, {
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() }
  });
  var currentFiles = JSON.parse(current.getContentText()).files;
  var manifest = currentFiles.find(function(f) { return f.name === "appsscript"; });

  var payload = {
    files: [
      { name: "Code", type: "SERVER_JS", source: newCode },
      manifest
    ]
  };

  UrlFetchApp.fetch(url, {
    method: "put",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(payload)
  });

  // Count existing versions first so we can fail *clearly* if the project has hit Apps Script's
  // version ceiling. Otherwise versions.create throws AFTER the code was already overwritten,
  // leaving the editor on the new version but the live deployment stuck on the old one.
  var totalVersions = 0;
  try {
    var vPageToken = null;
    do {
      var vListUrl = "https://script.googleapis.com/v1/projects/" + scriptId + "/versions"
        + (vPageToken ? "?pageToken=" + vPageToken : "");
      var vListResp = UrlFetchApp.fetch(vListUrl, {
        muteHttpExceptions: true,
        headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() }
      });
      var vListData = JSON.parse(vListResp.getContentText());
      if (vListData.versions) totalVersions += vListData.versions.length;
      vPageToken = vListData.nextPageToken || null;
    } while (vPageToken);
  } catch (countErr) { totalVersions = -1; }

  if (totalVersions >= 200) {
    return "DEPLOY HALTED — code updated to " + pulledVersion + " but the version limit ("
      + totalVersions + "/200) is reached, so the live deployment is STILL on the old version. "
      + "Free up versions in the Apps Script editor, then redeploy.";
  }

  var versionUrl = "https://script.googleapis.com/v1/projects/" + scriptId + "/versions";
  var versionResponse = UrlFetchApp.fetch(versionUrl, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ description: pulledVersion + " — from GitHub " + new Date().toLocaleString() })
  });
  if (versionResponse.getResponseCode() >= 300) {
    return "DEPLOY FAILED creating a new version — code was updated to " + pulledVersion
      + " but the live deployment was NOT advanced (still on the old version). HTTP "
      + versionResponse.getResponseCode() + ": " + versionResponse.getContentText();
  }
  var newVersion = JSON.parse(versionResponse.getContentText()).versionNumber;

  var deployUrl = "https://script.googleapis.com/v1/projects/" + scriptId
    + "/deployments/" + DEPLOYMENT_ID;
  var deployResp = UrlFetchApp.fetch(deployUrl, {
    method: "put",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({
      deploymentConfig: {
        scriptId: scriptId,
        versionNumber: newVersion,
        description: pulledVersion + " (deployment " + newVersion + ")"
      }
    })
  });
  if (deployResp.getResponseCode() >= 300) {
    return "DEPLOY FAILED repointing the deployment — version " + newVersion
      + " was created but the live deployment was NOT updated to it. HTTP "
      + deployResp.getResponseCode() + ": " + deployResp.getContentText();
  }

  // Auto-initialize required Script Properties on first deploy
  ensureScriptProperties_();

  return "Updated to " + pulledVersion + " (deployment " + newVersion + ") | "
    + (totalVersions + 1) + "/200";
}

// ══════════════
// TEMPLATE END
// ══════════════

// ══════════════
// AUTH START
// ══════════════

// =============================================
// AUTH — HTML/JS Output Escaping (XSS Prevention)
// Prevents injection via user-controlled values in generated HTML/JS strings.
// =============================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJs(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

// =============================================
// AUTH — Conditional Audit Logger (Toggle-Gated)
// No-op when AUTH_CONFIG.ENABLE_AUDIT_LOG === false.
// =============================================

function auditLog(event, user, result, details) {
  if (!AUTH_CONFIG.ENABLE_AUDIT_LOG) return;
  _writeAuditLogEntry(event, user, result, details);
}

function _writeAuditLogEntry(event, user, result, details) {
  try {
    if (!SPREADSHEET_ID || SPREADSHEET_ID === "YOUR_SPREADSHEET_ID") return;
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(AUTH_CONFIG.AUDIT_LOG_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(AUTH_CONFIG.AUDIT_LOG_SHEET_NAME);
      sheet.appendRow(['Timestamp', 'Event', 'User', 'Result', 'Details']);
      var protection = sheet.protect();
      protection.setDescription('Session Audit Log — protected');
      protection.setWarningOnly(true);
    }
    sheet.appendRow([
      new Date().toISOString(),
      event,
      user,
      result,
      JSON.stringify(details || {})
    ]);
  } catch(e) {
    Logger.log('Audit log error: ' + e.message);
  }
}

// =============================================
// AUTH — Data-Level Audit Logger (Toggle-Gated, Phase 8)
// No-op when AUTH_CONFIG.ENABLE_DATA_AUDIT_LOG === false.
// Separate from session audit log — captures per-operation PHI access events.
// =============================================

function dataAuditLog(user, action, resourceType, resourceId, details) {
  if (!AUTH_CONFIG.ENABLE_DATA_AUDIT_LOG) return;
  try {
    if (!SPREADSHEET_ID || SPREADSHEET_ID === "YOUR_SPREADSHEET_ID") return;
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetName = AUTH_CONFIG.DATA_AUDIT_LOG_SHEET_NAME || 'DataAuditLog';
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        'Timestamp',
        'User',
        'Action',
        'ResourceType',
        'ResourceId',
        'Details',
        'SessionId',
        'IsEmergencyAccess'
      ]);
      var protection = sheet.protect();
      protection.setDescription('HIPAA Data Audit Log — protected');
      protection.setWarningOnly(true);
    }
    sheet.appendRow([
      new Date().toISOString(),
      user.email || user,
      action,
      resourceType,
      resourceId || '',
      JSON.stringify(details || {}),
      details && details.sessionId ? details.sessionId.substring(0, 8) + '...' : '',
      details && details.isEmergencyAccess ? 'YES' : 'NO'
    ]);
  } catch(e) {
    Logger.log('Data audit log error: ' + e.message);
  }
}

// =============================================
// AUTH — HMAC Session Integrity (Toggle-Gated)
// =============================================

function generateSessionHmac(sessionData) {
  if (!AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) return '';
  var secret = PropertiesService.getScriptProperties().getProperty(AUTH_CONFIG.HMAC_SECRET_PROPERTY);
  if (!secret) {
    // FAIL CLOSED: HMAC is enabled but secret is missing — this is a misconfiguration.
    // Log a security alert and throw to prevent session creation without integrity protection.
    auditLog('security_alert', sessionData.email || 'system', 'hmac_secret_missing',
      { property: AUTH_CONFIG.HMAC_SECRET_PROPERTY });
    throw new Error('HMAC integrity is enabled but HMAC_SECRET is not configured in Script Properties. '
      + 'This should auto-generate on first deploy via pullAndDeployFromGitHub(). '
      + 'If missing, verify deployment completed successfully or set manually: GAS Editor → Project Settings → Script Properties → Add: '
      + AUTH_CONFIG.HMAC_SECRET_PROPERTY + ' = <random-64-char-hex-string>');
  }
  var payload = sessionData.email
    + '|' + sessionData.createdAt
    + '|' + sessionData.lastActivity
    + '|' + (sessionData.absoluteCreatedAt || '')
    + '|' + (sessionData.displayName || '')
    + '|' + (sessionData.tokenObtainedAt || '');
  var signature = Utilities.computeHmacSha256Signature(payload, secret);
  return Utilities.base64Encode(signature);
}

function verifySessionHmac(sessionData) {
  if (!AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) return true;
  var secret = PropertiesService.getScriptProperties().getProperty(AUTH_CONFIG.HMAC_SECRET_PROPERTY);
  if (!secret) {
    // FAIL CLOSED: cannot verify without a secret — reject the session
    auditLog('security_alert', sessionData.email || 'unknown', 'hmac_secret_missing_verify',
      { property: AUTH_CONFIG.HMAC_SECRET_PROPERTY });
    return false;
  }
  if (!sessionData.hmac) return false;  // Secret exists but session has no HMAC → reject
  var expected = generateSessionHmac(sessionData);
  return expected === sessionData.hmac;
}

// ── GAS-Side HMAC-SHA256 Message Signing ──
// Uses Utilities.computeHmacSha256Signature() — native GAS API.
// This is the SAME algorithm as Web Crypto API HMAC-SHA256.
// The outputs are byte-for-byte identical when given the same key and payload.

/**
 * Sign a message object with HMAC-SHA256 using the session's messageKey.
 * @param {Object} msgObj - The message to sign (will have _sig added)
 * @param {string} messageKey - The session's HMAC key
 * @returns {Object} - The message with _sig field containing hex-encoded signature
 */
function signMessage(msgObj, messageKey) {
  if (!messageKey) return msgObj;

  // Create a deterministic payload — sorted keys, exclude _sig
  var copy = {};
  var keys = Object.keys(msgObj).sort();
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] !== '_sig') copy[keys[i]] = msgObj[keys[i]];
  }
  var payload = JSON.stringify(copy);

  // Compute HMAC-SHA256 using GAS native API
  var signature = Utilities.computeHmacSha256Signature(payload, messageKey);

  // Convert signed byte array to hex string
  // GAS returns signed bytes (-128 to 127), must mask to unsigned (0-255)
  var hex = signature.map(function(byte) {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');

  msgObj._sig = hex;
  return msgObj;
}

// =============================================
// AUTH — Session Management (Server-Side)
// Toggle-gated: domain restriction, HMAC, audit, emergency access
// =============================================

function exchangeTokenForSession(accessToken) {
  if (!accessToken) {
    return { success: false, error: "no_token" };
  }

  // Rate limiting: configurable via ENABLE_ESCALATING_LOCKOUT toggle
  var rlCache = getEpochCache();
  var tokenFingerprint = 'ratelimit_' + accessToken.substring(0, 16);
  var attempts = rlCache.get(tokenFingerprint);
  var attemptCount = attempts ? parseInt(attempts, 10) : 0;

  if (!AUTH_CONFIG.ENABLE_ESCALATING_LOCKOUT) {
    // Standard preset: flat rate limit (5 failures / 5-minute window)
    if (attemptCount >= 5) {
      auditLog('login_failed', '', 'rate_limited', { fingerprint: tokenFingerprint.substring(0, 20) });
      return { success: false, error: "rate_limited" };
    }
  } else {
    // HIPAA preset: escalating lockout tiers
    // Tier 1: 5 failures → 5 min lockout
    // Tier 2: 10 cumulative failures → 30 min lockout
    // Tier 3: 20 cumulative failures → 6 hr lockout
    var LOCKOUT_TIER1 = 5;
    var LOCKOUT_TIER2 = 10;
    var LOCKOUT_TIER3 = 20;
    var LOCKOUT_TIER1_DURATION = 300;    // 5 minutes
    var LOCKOUT_TIER2_DURATION = 1800;   // 30 minutes
    var LOCKOUT_TIER3_DURATION = 21600;  // 6 hours

    if (attemptCount >= LOCKOUT_TIER3) {
      auditLog('security_alert', '', 'account_locked_tier3',
        { fingerprint: tokenFingerprint.substring(0, 20), attempts: attemptCount });
      return { success: false, error: "account_locked" };
    }
    if (attemptCount >= LOCKOUT_TIER2) {
      auditLog('login_failed', '', 'rate_limited_tier2',
        { fingerprint: tokenFingerprint.substring(0, 20), attempts: attemptCount });
      return { success: false, error: "rate_limited" };
    }
    if (attemptCount >= LOCKOUT_TIER1) {
      auditLog('login_failed', '', 'rate_limited',
        { fingerprint: tokenFingerprint.substring(0, 20), attempts: attemptCount });
      return { success: false, error: "rate_limited" };
    }
  }

  // Compute lockout TTL for failed login increments
  var rlTtl = 300;  // Default: 5 minutes (standard preset flat rate limit)
  if (AUTH_CONFIG.ENABLE_ESCALATING_LOCKOUT) {
    var nextCount = attemptCount + 1;
    if (nextCount >= 20) rlTtl = 21600;       // Tier 3: 6 hours
    else if (nextCount >= 10) rlTtl = 1800;   // Tier 2: 30 minutes
    // else rlTtl stays 300 (Tier 1: 5 minutes)
  }

  var userInfo = validateGoogleToken(accessToken);
  if (!userInfo || userInfo.status === "not_signed_in") {
    auditLog('login_failed', '', 'invalid_token', { reason: 'Google token validation failed' });
    rlCache.put(tokenFingerprint, String(attemptCount + 1), rlTtl);
    return { success: false, error: "invalid_token" };
  }

  // Domain restriction (toggle-gated)
  if (AUTH_CONFIG.ENABLE_DOMAIN_RESTRICTION) {
    // Fail closed: empty allowlist with domain restriction enabled is a misconfiguration
    if (!AUTH_CONFIG.ALLOWED_DOMAINS || AUTH_CONFIG.ALLOWED_DOMAINS.length === 0) {
      auditLog('security_alert', userInfo.email, 'domain_restriction_misconfigured',
        { reason: 'ENABLE_DOMAIN_RESTRICTION is true but ALLOWED_DOMAINS is empty' });
      return { success: false, error: "domain_not_configured" };
    }
    var emailDomain = userInfo.email.split('@')[1].toLowerCase();
    var domainAllowed = false;
    for (var i = 0; i < AUTH_CONFIG.ALLOWED_DOMAINS.length; i++) {
      if (emailDomain === AUTH_CONFIG.ALLOWED_DOMAINS[i].toLowerCase()) {
        domainAllowed = true;
        break;
      }
    }
    if (!domainAllowed) {
      auditLog('login_failed', userInfo.email, 'domain_rejected',
        { domain: emailDomain, allowed: AUTH_CONFIG.ALLOWED_DOMAINS.join(',') });
      rlCache.put(tokenFingerprint, String(attemptCount + 1), rlTtl);
      return { success: false, error: "domain_not_allowed" };
    }
  }

  // Check access via master ACL spreadsheet (or fall back to SPREADSHEET_ID editor/viewer list)
  // Returns RBAC-aware object: { hasAccess, role, isEmergencyAccess }
  var hasAcl = MASTER_ACL_SPREADSHEET_ID && MASTER_ACL_SPREADSHEET_ID !== "YOUR_MASTER_ACL_SPREADSHEET_ID";
  var hasSheet = SPREADSHEET_ID && SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID";
  var accessResult = { hasAccess: true, role: RBAC_DEFAULT_ROLE, isEmergencyAccess: false };
  if (hasAcl || hasSheet) {
    accessResult = checkSpreadsheetAccess(userInfo.email);
    // The access list could not be read, so we do not know whether this user is
    // authorized. Reported separately from a denial, and deliberately NOT counted
    // as a failed attempt — otherwise a Sheets outage walks legitimate users up
    // the lockout tiers while they retry.
    if (accessResult.aclUnavailable) {
      return { success: false, error: "acl_unavailable", reason: accessResult.reason };
    }
    if (!accessResult.hasAccess) {
      auditLog('login_failed', userInfo.email, 'access_denied',
        { reason: 'No spreadsheet access' });
      rlCache.put(tokenFingerprint, String(attemptCount + 1), rlTtl);
      return { success: false, error: "not_authorized" };
    }
  }

  // Enforce single-session (configurable)
  if (AUTH_CONFIG.MAX_SESSIONS_PER_USER > 0) {
    invalidateAllSessions(userInfo.email);
  }

  // Create session token (cryptographically random UUID)
  var sessionToken = Utilities.getUuid() + Utilities.getUuid();
  sessionToken = sessionToken.replace(/-/g, "").substring(0, 48);

  // Generate a per-session message signing key for cryptographic message authentication.
  // GAS signs outgoing postMessages with this key; the HTML parent verifies signatures.
  var messageKey = Utilities.getUuid().replace(/-/g, '');

  var sessionData = {
    email: userInfo.email,
    displayName: userInfo.displayName,
    // accessToken intentionally NOT stored — only needed for the initial
    // validateGoogleToken() call above, then discarded (least privilege)
    createdAt: Date.now(),
    absoluteCreatedAt: Date.now(),
    lastActivity: Date.now(),
    tokenObtainedAt: Date.now(),
    messageKey: messageKey,
    // RBAC: role and permissions stored in session for fast permission checks
    // HIPAA: §164.308(a)(4)(ii) — access authorization based on role
    role: accessResult.role,
    permissions: getRolesFromSpreadsheet()[accessResult.role] || [],
    isEmergencyAccess: accessResult.isEmergencyAccess
  };

  // HMAC integrity (toggle-gated)
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) {
    sessionData.hmac = generateSessionHmac(sessionData);
  }

  var cache = getEpochCache();
  cache.put("session_" + sessionToken, JSON.stringify(sessionData), AUTH_CONFIG.SESSION_EXPIRATION);

  trackUserSession(userInfo.email, sessionToken);

  // Clear rate limit on successful login
  rlCache.remove(tokenFingerprint);

  auditLog('login_success', userInfo.email, 'session_created',
    { sessionId: sessionToken.substring(0, 8) + '...', role: accessResult.role,
      isEmergencyAccess: accessResult.isEmergencyAccess });

  return {
    success: true,
    sessionToken: sessionToken,
    email: userInfo.email,
    displayName: userInfo.displayName,
    absoluteTimeout: AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT || 0,
    messageKey: messageKey,
    role: accessResult.role,
    permissions: getRolesFromSpreadsheet()[accessResult.role] || []
  };
}

function validateSession(sessionToken) {
  if (!sessionToken || sessionToken.length < 32) {
    return { status: "not_signed_in" };
  }

  var cache = getEpochCache();
  var raw = cache.get("session_" + sessionToken);
  if (!raw) {
    // Check for eviction tombstone — tells the client WHY the session is gone.
    // Don't remove it — let it expire naturally (5 min TTL) so both heartbeat
    // and page refresh can read it independently.
    var evictionReason = cache.get("evicted_" + sessionToken) || '';
    if (evictionReason) {
      return { status: "not_signed_in", evictionReason: evictionReason };
    }
    return { status: "not_signed_in" };
  }

  var sessionData;
  try {
    sessionData = JSON.parse(raw);
  } catch (e) {
    return { status: "not_signed_in" };
  }

  // HMAC verification (toggle-gated)
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) {
    if (!verifySessionHmac(sessionData)) {
      auditLog('security_alert', sessionData.email || 'unknown', 'hmac_mismatch',
        { sessionId: sessionToken.substring(0, 8) + '...' });
      cache.remove("session_" + sessionToken);
      return { status: "not_signed_in" };
    }
  }

  // Absolute session timeout — hard ceiling that heartbeats cannot extend
  if (sessionData.absoluteCreatedAt && AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
    var absoluteElapsed = (Date.now() - sessionData.absoluteCreatedAt) / 1000;
    if (absoluteElapsed > AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
      auditLog('session_expired', sessionData.email, 'absolute_timeout',
        { elapsed: Math.round(absoluteElapsed) + 's', limit: AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT + 's' });
      cache.remove("session_" + sessionToken);
      return { status: "not_signed_in" };
    }
  }

  // Authoritative expiry check (rolling — reset by heartbeats)
  var elapsed = (Date.now() - sessionData.createdAt) / 1000;
  if (elapsed > AUTH_CONFIG.SESSION_EXPIRATION) {
    auditLog('session_expired', sessionData.email, 'timeout',
      { elapsed: Math.round(elapsed) + 's', limit: AUTH_CONFIG.SESSION_EXPIRATION + 's' });
    cache.remove("session_" + sessionToken);
    return { status: "not_signed_in" };
  }

  // Check if Google token needs refresh
  var needsReauth = checkGoogleTokenExpiry(sessionData);

  // Update last activity (extends the CacheService TTL)
  sessionData.lastActivity = Date.now();
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) {
    sessionData.hmac = generateSessionHmac(sessionData);
  }
  cache.put("session_" + sessionToken, JSON.stringify(sessionData), AUTH_CONFIG.SESSION_EXPIRATION);

  return {
    status: "authorized",
    email: sessionData.email,
    displayName: sessionData.displayName,
    needsReauth: needsReauth,
    role: sessionData.role || RBAC_DEFAULT_ROLE,
    permissions: sessionData.permissions || getRolesFromSpreadsheet()[sessionData.role] || getRolesFromSpreadsheet()[RBAC_DEFAULT_ROLE]
  };
}

// =============================================
// AUTH — Data Operation Session Gate
// Every google.script.run that touches patient data must call this first.
// Returns the validated session data (email, etc.) or throws if invalid.
// HIPAA: 45 CFR § 164.312(a)(1) — verify identity before every data access
// =============================================

function validateSessionForData(sessionToken, operationName) {
  // Toggle check — standard preset skips full validation but still extracts
  // role/permissions from the session cache so permission checks work correctly
  if (!AUTH_CONFIG.ENABLE_DATA_OP_VALIDATION) {
    var skipResult = { email: 'unvalidated', displayName: '', role: RBAC_DEFAULT_ROLE, permissions: [] };
    if (sessionToken) {
      try {
        var skipCache = getEpochCache();
        var skipRaw = skipCache.get("session_" + sessionToken);
        if (skipRaw) {
          var skipSession = JSON.parse(skipRaw);
          skipResult.email = skipSession.email || 'unvalidated';
          skipResult.role = skipSession.role || RBAC_DEFAULT_ROLE;
          skipResult.permissions = skipSession.permissions || getRolesFromSpreadsheet()[skipResult.role] || [];
        }
      } catch (e) { /* fall through with defaults */ }
    }
    return skipResult;
  }

  if (!sessionToken || sessionToken.length < 32) {
    auditLog('security_alert', 'unknown', 'data_access_no_token',
      { operation: operationName });
    throw new Error('SESSION_EXPIRED');
  }

  var cache = getEpochCache();
  var raw = cache.get("session_" + sessionToken);
  if (!raw) {
    // Check for eviction tombstone
    var evicted = cache.get("evicted_" + sessionToken);
    auditLog('security_alert', 'unknown', 'data_access_expired_session',
      { operation: operationName, reason: evicted || 'timeout' });
    throw new Error(evicted ? 'SESSION_EVICTED' : 'SESSION_EXPIRED');
  }

  var sessionData;
  try {
    sessionData = JSON.parse(raw);
  } catch (e) {
    auditLog('security_alert', 'unknown', 'data_access_corrupt_session',
      { operation: operationName });
    throw new Error('SESSION_CORRUPT');
  }

  // HMAC verification
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY && !verifySessionHmac(sessionData)) {
    auditLog('security_alert', sessionData.email || 'unknown', 'data_access_hmac_failed',
      { operation: operationName });
    cache.remove("session_" + sessionToken);
    throw new Error('SESSION_INTEGRITY_VIOLATION');
  }

  // Absolute timeout check
  if (sessionData.absoluteCreatedAt && AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
    var absElapsed = (Date.now() - sessionData.absoluteCreatedAt) / 1000;
    if (absElapsed > AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
      auditLog('security_alert', sessionData.email, 'data_access_absolute_timeout',
        { operation: operationName, elapsed: Math.round(absElapsed) + 's' });
      cache.remove("session_" + sessionToken);
      throw new Error('SESSION_EXPIRED');
    }
  }

  // Rolling timeout check
  var elapsed = (Date.now() - sessionData.createdAt) / 1000;
  if (elapsed > AUTH_CONFIG.SESSION_EXPIRATION) {
    auditLog('security_alert', sessionData.email, 'data_access_rolling_timeout',
      { operation: operationName, elapsed: Math.round(elapsed) + 's' });
    cache.remove("session_" + sessionToken);
    throw new Error('SESSION_EXPIRED');
  }

  // Session is valid — return user identity, role, and context for audit logging
  return {
    email: sessionData.email,
    displayName: sessionData.displayName,
    clientIp: sessionData.clientIp || 'not-collected',
    isEmergencyAccess: sessionData.isEmergencyAccess || false,
    role: sessionData.role || RBAC_DEFAULT_ROLE,
    permissions: sessionData.permissions || getRolesFromSpreadsheet()[sessionData.role] || getRolesFromSpreadsheet()[RBAC_DEFAULT_ROLE]
  };
}

// =============================================
// DATA OPERATIONS — Session-gated
// Every function that reads/writes data must call validateSessionForData() first.
// Add your project-specific data operations here. Example:
//
// function saveRecord(sessionToken, recordData) {
//   var user = validateSessionForData(sessionToken, 'saveRecord');
//   checkPermission(user, 'write', 'saveRecord');
//   // ... your data operation here ...
//   bumpDataRev();   // let other signed-in viewers pick up the change (live sync)
//   return { success: true, email: user.email };
// }
// =============================================

// ── Live data revision (multi-user sync) ──
// A cheap CacheService token bumped on every shared-data write. The client polls
// getDataRev() (no sheet read) and only re-fetches data when the token changes — so
// multiple users see each other's edits within seconds without hammering the sheet or
// quota. Call bumpDataRev() at the end of EVERY project function that writes shared
// data (see the DATA OPERATIONS example above); the polling countdown UI and the poll
// loop itself are template code — projects only override window._onLiveDataChange
// (client side) to re-fetch and re-render their own data.
function bumpDataRev() {
  try { CacheService.getScriptCache().put('DATA_REV', String(Date.now()) + '-' + Math.floor(Math.random() * 100000), 21600); } catch (e) {}
}
function getDataRev(sessionToken) {
  validateSessionForData(sessionToken, 'getDataRev');   // throws on invalid/expired session
  return { rev: (CacheService.getScriptCache().get('DATA_REV') || '') };
}

function invalidateSession(sessionToken) {
  if (!sessionToken) return;
  var cache = getEpochCache();
  var raw = cache.get("session_" + sessionToken);
  if (raw) {
    try {
      var sessionData = JSON.parse(raw);
      removeUserSession(sessionData.email, sessionToken);
      auditLog('sign_out', sessionData.email, 'session_invalidated',
        { sessionId: sessionToken.substring(0, 8) + '...' });
    } catch (e) {}
  }
  cache.remove("session_" + sessionToken);
}

// Generates a one-time-use nonce that binds a validated session to a single page load.
// Flow: GAS serves handshake page → parent sends session token via postMessage →
// handshake page calls generatePageNonce() → navigates to ?page_nonce=NONCE →
// doGet() validates nonce → serves authenticated content.
// This ensures the session token NEVER appears in the URL.

function generatePageNonce(sessionToken) {
  var session = validateSession(sessionToken);
  if (session.status !== 'authorized') {
    return { success: false, error: session.status };
  }
  var nonce = Utilities.getUuid();
  var cache = getEpochCache();
  // Store nonce → session token mapping with 60-second TTL (one-time use).
  // 60s allows for the two-step flow: load getNonce listener → get nonce → reload iframe.
  cache.put('page_nonce_' + nonce, sessionToken, 60);
  return { success: true, nonce: nonce };
}

function validatePageNonce(nonce) {
  if (!nonce || nonce.length < 10) return null;
  var cache = getEpochCache();
  var sessionToken = cache.get('page_nonce_' + nonce);
  if (!sessionToken) return null;
  // One-time use: delete the nonce immediately
  cache.remove('page_nonce_' + nonce);
  return sessionToken;
}

function invalidateAllSessions(email, reason) {
  if (!email) return;
  var evictionReason = reason || 'new_sign_in';
  var cache = getEpochCache();
  var trackKey = "sessions_" + email.toLowerCase();
  var raw = cache.get(trackKey);
  if (!raw) return;
  try {
    var tokens = JSON.parse(raw);
    for (var i = 0; i < tokens.length; i++) {
      cache.remove("session_" + tokens[i]);
      // Leave a tombstone so the heartbeat/validateSession handler knows WHY
      // the session disappeared. Short TTL (5 minutes) — just needs to survive
      // until the old device's next heartbeat fires or page refresh.
      // After that, natural expiry is assumed (no tombstone = timed out normally).
      cache.put("evicted_" + tokens[i], evictionReason, 300);
    }
    if (tokens.length > 0) {
      auditLog('session_management', email, 'all_sessions_invalidated',
        { count: tokens.length });
    }
  } catch (e) {}
  cache.remove(trackKey);
}

// =============================================
// AUTH — Google Token Operations (Server-Side Only)
// =============================================

function validateGoogleToken(accessToken) {
  try {
    var resp = UrlFetchApp.fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { "Authorization": "Bearer " + accessToken },
        muteHttpExceptions: true
      }
    );
    if (resp.getResponseCode() !== 200) {
      return { status: "not_signed_in" };
    }
    var info = JSON.parse(resp.getContentText());
    if (!info.email) {
      return { status: "not_signed_in" };
    }
    var prefix = info.email.split("@")[0];
    var displayName = prefix.split(/[._-]/).map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(" ");
    return { status: "authorized", email: info.email, displayName: displayName };
  } catch (e) {
    return { status: "not_signed_in" };
  }
}

function checkGoogleTokenExpiry(sessionData) {
  var tokenAge = (Date.now() - sessionData.tokenObtainedAt) / 1000;
  return tokenAge >= (AUTH_CONFIG.OAUTH_TOKEN_LIFETIME - AUTH_CONFIG.OAUTH_REFRESH_BUFFER);
}

// =============================================
// AUTH — Session Tracking (for single-session enforcement)
// =============================================

function trackUserSession(email, sessionToken) {
  var cache = getEpochCache();
  var trackKey = "sessions_" + email.toLowerCase();
  var raw = cache.get(trackKey);
  var tokens = [];
  if (raw) {
    try { tokens = JSON.parse(raw); } catch (e) {}
  }
  tokens.push(sessionToken);
  cache.put(trackKey, JSON.stringify(tokens), AUTH_CONFIG.SESSION_EXPIRATION);
}

function removeUserSession(email, sessionToken) {
  if (!email) return;
  var cache = getEpochCache();
  var trackKey = "sessions_" + email.toLowerCase();
  var raw = cache.get(trackKey);
  if (!raw) return;
  try {
    var tokens = JSON.parse(raw);
    tokens = tokens.filter(function(t) { return t !== sessionToken; });
    if (tokens.length > 0) {
      cache.put(trackKey, JSON.stringify(tokens), AUTH_CONFIG.SESSION_EXPIRATION);
    } else {
      cache.remove(trackKey);
    }
  } catch (e) {}
}

// =============================================
// AUTH — Authorization (Spreadsheet Access + Emergency Access)
// Toggle-gated: emergency access override
// =============================================

// checkSpreadsheetAccess returns an RBAC-aware result object:
//   { hasAccess: true,  role: 'admin', isEmergencyAccess: false }
//   { hasAccess: false, role: null,    isEmergencyAccess: false }
// ── OWNER-RUN DIAGNOSTIC — authorization grant ───────────────────────
// Run this from the editor's Run dropdown when a Google service call fails on
// permissions even though appsscript.json already declares the scope.
//
// Declaring a scope and holding a grant for it are different things. The
// manifest is only the REQUEST list; the grant is a separate record tied to the
// account that authorized the script, and Google's granular consent lets a user
// approve some permissions while leaving others unticked. Apps Script re-prompts
// only when the requested set CHANGES or the grant is revoked — never on a
// failure — so reading the manifest, finding it correct and changing nothing
// cannot produce a consent screen, and a partial grant persists indefinitely.
//
// Deliberately has NO trailing underscore: underscore-suffixed functions are
// hidden from the editor's Run dropdown, and this one must be runnable by hand.
function diagnoseAuthorization() {
  Logger.log('== Authorization diagnosis ==');
  try {
    Logger.log('Running as: ' + Session.getEffectiveUser().getEmail()
      + '   (must be the account that owns / deploys this script)');
  } catch (eU) {
    Logger.log('Could not read the effective user: ' + eU.message);
  }

  var info;
  try {
    info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  } catch (eI) {
    Logger.log('Could not read authorization info: ' + eI.message);
    return;
  }
  Logger.log('Authorization status: ' + String(info.getAuthorizationStatus()));

  // Optional: not present on every runtime. When it is, it settles the question
  // outright — this is what the grant actually covers, as against what the
  // manifest merely asks for.
  try {
    var granted = info.getAuthorizedScopes();
    if (granted && granted.length) {
      Logger.log('Scopes actually GRANTED (' + granted.length + '):');
      for (var g = 0; g < granted.length; g++) Logger.log('      ' + granted[g]);
      Logger.log('   -> Anything the manifest declares that is NOT in this list is the gap.');
    }
  } catch (eS) { /* unavailable on this runtime — status + URL below still decide it */ }

  // Always report the DECLARED list too. A scope can be absent from the grant
  // for two opposite reasons — the manifest never asked for it, or the manifest
  // asked and the user did not approve it — and the granted list alone cannot
  // tell them apart. Printing both side by side makes the gap self-evident and,
  // importantly, gives diagnoseOauthScopes_ a caller: it is hidden from the Run
  // dropdown by its trailing underscore, so without this it is unreachable in
  // every project that lacks diagnoseAclAccess.
  Logger.log('Declared in the manifest:');
  diagnoseOauthScopes_();

  var url = info.getAuthorizationUrl();
  if (url) {
    Logger.log('THE GRANT IS INCOMPLETE. Open this URL, approve, then re-run diagnoseAclAccess:');
    Logger.log('   ' + url);
    Logger.log('   Open it signed in as the account named above, and approve EVERY permission shown — '
      + 'one unticked box reproduces this exact failure.');
    return;
  }

  Logger.log('No authorization is outstanding — the grant already covers every scope the manifest DECLARES.');
  Logger.log('-> Read the two lists above against each other before anything else:');
  Logger.log('   * A scope this app uses that is missing from BOTH lists = the manifest under-declares it. '
    + 'Add it to oauthScopes (Project Settings -> "Show appsscript.json"), save, then run this again — '
    + 'changing the declared set is what makes Apps Script finally prompt for consent.');
  Logger.log('   * A scope in the DECLARED list but not the GRANTED list would have produced an '
    + 'authorization URL above, so if none appeared, that is not what is happening here.');
  Logger.log('-> If both lists already cover everything and a call still fails, check these, in order:');
  Logger.log('   1. Project Settings -> Google Cloud Platform (GCP) Project. If this is a STANDARD project '
    + 'rather than the default one, its OAuth consent screen must list the scope, and the app must not be '
    + 'stuck in Testing with this account missing from the test users.');
  Logger.log('   2. The account named above. A second signed-in Google account is the usual cause of '
    + '"it works when I open the file but not when the script does".');
  Logger.log('   3. Force a completely fresh consent: revoke this project at '
    + 'https://myaccount.google.com/permissions, then run any function here again.');
}

// ── OWNER-RUN DIAGNOSTIC — OAuth scope report ────────────────────────
// Prints the project's declared oauthScopes and names any this app needs but
// does not declare. Pairs with diagnoseAuthorization: this one covers what is
// REQUESTED, that one covers what is GRANTED, and a permissions error can come
// from either — the two are indistinguishable from the error text alone.
//
// The manifest is not in the repo (the self-deploy preserves whatever manifest
// the project already has), so reading it back at runtime is the only way to
// see it without opening the editor.
function diagnoseOauthScopes_() {
  var REQUIRED = {
    'https://www.googleapis.com/auth/spreadsheets': 'SpreadsheetApp — the Master ACL and every data sheet',
    'https://www.googleapis.com/auth/drive': 'DriveApp / Drive REST — file storage',
    'https://www.googleapis.com/auth/script.external_request': 'UrlFetchApp — GitHub pulls and self-deploy',
    'https://www.googleapis.com/auth/script.projects': 'self-deploy — reads and rewrites its own source',
    'https://www.googleapis.com/auth/script.deployments': 'self-deploy — creates versions and deployments',
    'https://www.googleapis.com/auth/script.send_mail': 'MailApp — alerting',
    'https://www.googleapis.com/auth/script.scriptapp': 'ScriptApp.newTrigger — self-installed triggers'
  };
  try {
    var resp = UrlFetchApp.fetch(
      'https://script.googleapis.com/v1/projects/' + ScriptApp.getScriptId() + '/content',
      { muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
    if (resp.getResponseCode() >= 300) {
      Logger.log('   Could not read the manifest (HTTP ' + resp.getResponseCode() + '). Check by hand: '
        + 'Project Settings -> tick "Show appsscript.json manifest file in editor".');
      return;
    }
    var files = JSON.parse(resp.getContentText()).files || [];
    var manifest = null;
    for (var i = 0; i < files.length; i++) {
      if (files[i].name === 'appsscript') manifest = files[i];
    }
    if (!manifest) { Logger.log('   No appsscript manifest was returned.'); return; }
    var declared = JSON.parse(manifest.source).oauthScopes;
    if (!declared || !declared.length) {
      Logger.log('   The manifest declares NO explicit oauthScopes, so Apps Script derives them from the '
        + 'code. A permissions error in that case means the grant is incomplete — run diagnoseAuthorization.');
      return;
    }
    Logger.log('   Declared oauthScopes (' + declared.length + '):');
    for (var d = 0; d < declared.length; d++) Logger.log('      ' + declared[d]);
    var missing = [];
    for (var need in REQUIRED) {
      if (REQUIRED.hasOwnProperty(need) && declared.indexOf(need) === -1) missing.push(need);
    }
    if (!missing.length) {
      Logger.log('   Every scope this app uses IS declared — so the declaration is not the problem. '
        + 'Compare this list against the GRANTED list printed above: if they match, the grant is '
        + 'complete and a permissions error is coming from somewhere else (see the checks below).');
      return;
    }
    Logger.log('   MISSING ' + missing.length + ' declaration(s) — each one breaks the feature named after it:');
    for (var m = 0; m < missing.length; m++) {
      Logger.log('      ' + missing[m] + '   <- ' + REQUIRED[missing[m]]);
    }
    Logger.log('   -> Fix: Project Settings -> tick "Show appsscript.json manifest file in editor" -> add '
      + 'the scope(s) to oauthScopes -> save -> run any function here and APPROVE the consent screen.');
  } catch (e) {
    Logger.log('   Scope check failed: ' + e.message);
  }
}

// Legacy boolean callers: use checkSpreadsheetAccess(email).hasAccess
function checkSpreadsheetAccess(email, opt_ss) {
  var denied = { hasAccess: false, role: null, isEmergencyAccess: false };
  if (!email) return denied;
  var lowerEmail = email.toLowerCase();

  // Emergency access override (toggle-gated)
  if (AUTH_CONFIG.ENABLE_EMERGENCY_ACCESS) {
    var emergencyEmails = PropertiesService.getScriptProperties()
      .getProperty(AUTH_CONFIG.EMERGENCY_ACCESS_PROPERTY);
    if (emergencyEmails) {
      var emergencyList = emergencyEmails.split(',').map(function(e) {
        return e.trim().toLowerCase();
      });
      if (emergencyList.indexOf(lowerEmail) > -1) {
        auditLog('emergency_access', email, 'granted',
          { reason: 'Emergency access override via Script Properties' });
        return { hasAccess: true, role: 'admin', isEmergencyAccess: true };
      }
    }
  }

  var cache = getEpochCache();
  var cacheKey = "access_" + lowerEmail;
  var roleCacheKey = "role_" + lowerEmail;
  var cached = cache.get(cacheKey);
  if (cached !== null) {
    if (cached === "1") {
      var cachedRole = cache.get(roleCacheKey) || RBAC_DEFAULT_ROLE;
      return { hasAccess: true, role: cachedRole, isEmergencyAccess: false };
    }
    return denied;
  }

  // Method 1: Master ACL spreadsheet
  // Expected layout: col A = Email, col B = Role, cols C+ = page names (TRUE/FALSE)
  var hasAcl = MASTER_ACL_SPREADSHEET_ID && MASTER_ACL_SPREADSHEET_ID !== "YOUR_MASTER_ACL_SPREADSHEET_ID";
  // aclReadOk records whether the list was actually READ. Without it, "the ACL
  // says no" and "the ACL could not be opened" both fell through to the same
  // cached denial at the bottom of this function, so a transient Sheets fault
  // was reported to the user as `not_authorized` — indistinguishable from being
  // genuinely off the list, and sticky for the full 10-minute cache TTL.
  var aclReadOk = false;
  var aclFailReason = '';
  if (hasAcl) {
    // Every project rewrites its metadata columns on the shared Access tab, so
    // read failures here are usually momentary contention. One retry absorbs
    // that without materially slowing a genuine sign-in.
    for (var attempt = 0; attempt < 2 && !aclReadOk; attempt++) {
      if (attempt > 0) {
        try { Utilities.sleep(400); } catch (eSleep) {}
      }
      try {
        var aclSs = SpreadsheetApp.openById(MASTER_ACL_SPREADSHEET_ID);
        var aclSheet = aclSs.getSheetByName(ACL_SHEET_NAME);
        if (!aclSheet) { aclFailReason = 'acl_tab_missing'; continue; }
        var data = aclSheet.getDataRange().getValues();
        if (data.length < 2) { aclFailReason = 'acl_empty'; continue; }
        var headers = data[0];
        // Find the page column index (page access TRUE/FALSE)
        var colIdx = -1;
        for (var c = 0; c < headers.length; c++) {
          if (String(headers[c]).trim().toLowerCase() === ACL_PAGE_NAME.toLowerCase()) {
            colIdx = c; break;
          }
        }
        // A missing page column denies every user of this app at once. That is a
        // broken ACL, not a per-user decision, so it must not be cached as one.
        if (colIdx === -1) { aclFailReason = 'acl_column_missing'; continue; }
        // Find the Role column index (expected col B, but search by header name for flexibility)
        var roleColIdx = -1;
        for (var rc = 0; rc < headers.length; rc++) {
          if (String(headers[rc]).trim().toLowerCase() === 'role') {
            roleColIdx = rc; break;
          }
        }
        // Past this point the list was read and understood, so a "no" below is a
        // real denial and is safe to cache.
        aclReadOk = true;
        aclFailReason = '';
        for (var r = 1; r < data.length; r++) {
          if (String(data[r][0]).trim().toLowerCase() === lowerEmail) {
            var val = data[r][colIdx];
            if (val === true || String(val).trim().toUpperCase() === 'TRUE') {
              // Read role from the Role column (default to RBAC_DEFAULT_ROLE if missing)
              var userRole = RBAC_DEFAULT_ROLE;
              if (roleColIdx !== -1 && data[r][roleColIdx]) {
                var rawRole = String(data[r][roleColIdx]).trim().toLowerCase();
                if (getRolesFromSpreadsheet()[rawRole]) {
                  userRole = rawRole;
                }
              }
              cache.put(cacheKey, "1", 600);
              cache.put(roleCacheKey, userRole, 600);
              return { hasAccess: true, role: userRole, isEmergencyAccess: false };
            }
            break; // Found email but not granted — continue to method 2
          }
        }
      } catch(e) {
        aclFailReason = 'acl_unreachable';
        Logger.log('checkSpreadsheetAccess: ACL read failed on attempt '
          + (attempt + 1) + ' for ' + ACL_PAGE_NAME + ': ' + e.message);
      }
    }
    // When an ACL is configured it is the sole authority — the sharing-list
    // fallback below is deliberately skipped. So an unreadable ACL means the
    // verdict is UNKNOWN, not "no". Return that uncached and let the caller
    // present it as a retryable outage.
    if (!aclReadOk) {
      auditLog('security_alert', email, 'acl_unavailable',
        { reason: aclFailReason || 'acl_unreachable', page: ACL_PAGE_NAME });
      return { hasAccess: false, role: null, isEmergencyAccess: false,
               aclUnavailable: true, reason: aclFailReason || 'acl_unreachable' };
    }
  }

  // Method 2: Editor/viewer sharing-list check on SPREADSHEET_ID
  // ONLY used when the ACL tab is NOT configured — when ACL exists, it is the
  // sole authority and the sharing list is not consulted.
  var hasSheet = SPREADSHEET_ID && SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID";
  if (!hasAcl && hasSheet) {
    var ss = opt_ss || SpreadsheetApp.openById(SPREADSHEET_ID);
    var editors = ss.getEditors();
    for (var i = 0; i < editors.length; i++) {
      if (editors[i].getEmail().toLowerCase() === lowerEmail) {
        cache.put(cacheKey, "1", 600);
        cache.put(roleCacheKey, RBAC_DEFAULT_ROLE, 600);
        return { hasAccess: true, role: RBAC_DEFAULT_ROLE, isEmergencyAccess: false };
      }
    }
    var viewers = ss.getViewers();
    for (var i = 0; i < viewers.length; i++) {
      if (viewers[i].getEmail().toLowerCase() === lowerEmail) {
        cache.put(cacheKey, "1", 600);
        cache.put(roleCacheKey, RBAC_DEFAULT_ROLE, 600);
        return { hasAccess: true, role: RBAC_DEFAULT_ROLE, isEmergencyAccess: false };
      }
    }
  }

  // Neither method granted access (or neither is configured)
  if (!hasAcl && !hasSheet) {
    return { hasAccess: true, role: RBAC_DEFAULT_ROLE, isEmergencyAccess: false };
  }
  cache.put(cacheKey, "0", 600);
  return denied;
}

// PROJECT START — Add your project-specific code here
// ── Profiler field-note intake ──
// Notes are stored VERBATIM with a developer-rated 0–100 confidence and triage
// "pending" (schema: repository-information/PROFILER-SCHEMA.md — Field Notes).
// Storage is the script owner's Drive, NOT this repo — see the Drive-backed
// private store below for why. The repo-write helpers this module used to carry
// were removed with the store: keeping a repo-write path for note data would
// invite exactly the exposure the migration closed.
var REGISTRY_FILE_PATH = "live-site-pages/profiler-data/profiler-companies.json";
var NOTE_SOURCE_TYPES = ["contact", "event", "call", "news", "other"];
// Attachment rules — transcripts (.txt/.md/.vtt/.srt) and Word/PDF note files.
// Base64 payload cap ~8MB binary; large meeting AUDIO does not come through
// here at all (M5 uploads it browser-side straight to Drive).
var NOTE_FILE_EXT_RE = /\.(docx?|pdf|txt|md|vtt|srt)$/i;
var NOTE_FILE_MAX_COUNT = 3;
var NOTE_FILE_MAX_B64 = 11000000;
// Non-admin users suggest notes instead of writing them — suggestions are
// emailed here (with any files as attachments) and nothing is committed
var NOTE_SUGGEST_EMAIL = "jonyang92@gmail.com";

// Best-effort deploy dispatch — pushes made via the contents API don't need it
// (they trigger the push-event workflow directly since they're made with the
// developer's PAT, not the Actions GITHUB_TOKEN), but dispatching guarantees
// the deploy even if that push-event path ever changes. Failures are swallowed:
// the commits are already on main and deploy on the next merge regardless.
function ghDispatchDeploy_() {
  try {
    var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
    UrlFetchApp.fetch("https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO
      + "/actions/workflows/auto-merge-claude.yml/dispatches", {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json" },
      payload: JSON.stringify({ ref: GITHUB_BRANCH }),
      muteHttpExceptions: true
    });
  } catch (err) { /* non-fatal — see comment above */ }
}

function ghContentsGet_(path) {
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("CONFIG_ERROR");
  var url = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO
    + "/contents/" + path + "?ref=" + GITHUB_BRANCH + "&t=" + new Date().getTime();
  var res = UrlFetchApp.fetch(url, {
    headers: { "Accept": "application/vnd.github.v3+json", "Authorization": "token " + token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error("GITHUB_READ_FAILED");
  var body = JSON.parse(res.getContentText());
  var decoded = Utilities.newBlob(Utilities.base64Decode(body.content.replace(/\n/g, ""))).getDataAsString("UTF-8");
  return { sha: body.sha, json: JSON.parse(decoded) };
}

// ── Drive-backed private store (M3) ──
// Notes and note files live in the script owner's Drive, NOT the repo. The repo
// is public, so anything committed there is world-readable via raw.github-
// usercontent.com and clone regardless of the app's sign-in wall — moving a
// file out of live-site-pages/ only closes the Pages vector, not the git ones.
// Drive + the Master-ACL check on every op is what actually makes them private.
// Folder/file IDs are cached in Script Properties so a steady-state read costs
// one getFileById rather than a name search.
var DRIVE_ROOT_NAME = "Profiler";
var DRIVE_NOTES_FILE = "profiler-notes.json";
var DRIVE_FILES_DIR = "note-files";
var PROP_DRIVE_ROOT_ID = "DRIVE_ROOT_FOLDER_ID";
var PROP_DRIVE_NOTES_ID = "DRIVE_NOTES_FILE_ID";
// Transcripts are plain text and read back for the "Copy for Claude" button;
// Word/PDF stay binary and are download-only.
var NOTE_FILE_TEXT_RE = /\.(txt|md|vtt|srt)$/i;

function driveChildFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function driveRoot_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_DRIVE_ROOT_ID);
  if (id) { try { return DriveApp.getFolderById(id); } catch (err) { /* recreate below */ } }
  var folder = driveChildFolder_(DriveApp.getRootFolder(), DRIVE_ROOT_NAME);
  props.setProperty(PROP_DRIVE_ROOT_ID, folder.getId());
  return folder;
}

function driveNotesFile_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_DRIVE_NOTES_ID);
  if (id) { try { return DriveApp.getFileById(id); } catch (err) { /* recreate below */ } }
  var root = driveRoot_();
  var it = root.getFilesByName(DRIVE_NOTES_FILE);
  var file = it.hasNext() ? it.next() : root.createFile(
    DRIVE_NOTES_FILE, JSON.stringify({ schemaVersion: 1, notes: [] }, null, 2) + "\n", MimeType.PLAIN_TEXT);
  props.setProperty(PROP_DRIVE_NOTES_ID, file.getId());
  return file;
}

// Shape-compatible with the ghContentsGet_ call it replaces, minus `sha` —
// Drive needs no optimistic-concurrency token because every writer already
// runs inside the same LockService critical section.
function driveNotesGet_() {
  var json;
  try { json = JSON.parse(driveNotesFile_().getBlob().getDataAsString("UTF-8")); }
  catch (err) { throw new Error('DRIVE_READ_FAILED'); }
  if (!json || typeof json !== 'object') throw new Error('DRIVE_READ_FAILED');
  if (!Array.isArray(json.notes)) json.notes = [];
  return { json: json };
}

function driveNotesPut_(data) {
  driveNotesFile_().setContent(JSON.stringify(data, null, 2) + "\n");
}

// One folder per company slug. Returns a "drive:<fileId>" reference, stored as
// the note's sourceFile in place of the old repo-relative path.
function drivePutNoteFile_(slug, name, base64) {
  var dir = driveChildFolder_(driveChildFolder_(driveRoot_(), DRIVE_FILES_DIR), slug);
  var type = NOTE_FILE_TEXT_RE.test(name) ? MimeType.PLAIN_TEXT : "application/octet-stream";
  return "drive:" + dir.createFile(Utilities.newBlob(Utilities.base64Decode(base64), type, name)).getId();
}

function driveNoteFileId_(ref) {
  return (ref && ref.indexOf("drive:") === 0) ? ref.slice(6) : null;
}

// ── Meeting recordings ──────────────────────────────────────────────────────
// The recordings folder tree is created BROWSER-side with the user's own
// drive.file credential, exactly like the Receipts app's "Receipts App"
// folder — so it appears in the signed-in user's Drive rather than in the
// Drive of whichever account owns this script. (DriveApp here acts as the
// deploying account, which is not necessarily the person using the app.)
// The browser cannot reliably re-find a drive.file folder after the fact,
// so the script only persists the folder IDs on the browser's behalf.
var PROP_REC_FOLDERS = "REC_FOLDER_IDS";

function recFoldersGet_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_REC_FOLDERS);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function recFoldersSet_(ids) {
  var clean = {
    root: String(ids.root || ''),
    pending: String(ids.pending || ''),
    done: String(ids.done || '')
  };
  if (!clean.root || !clean.pending || !clean.done) throw new Error('INVALID_INPUT');
  PropertiesService.getScriptProperties().setProperty(PROP_REC_FOLDERS, JSON.stringify(clean));
  return clean;
}

function driveDeleteNoteFile_(ref) {
  var id = driveNoteFileId_(ref);
  if (!id) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (err) { /* non-fatal — log entry is source of truth */ }
}

// Text of an attached transcript, for the app's "Copy for Claude" button.
// Binary attachments (Word/PDF) return null — nothing useful to put on a clipboard.
function driveReadNoteFile_(ref) {
  var id = driveNoteFileId_(ref);
  if (!id) return null;
  try {
    var file = DriveApp.getFileById(id);
    if (!NOTE_FILE_TEXT_RE.test(file.getName())) return null;
    return file.getBlob().getDataAsString("UTF-8");
  } catch (err) { return null; }
}

// Name of an attached note file, for extension tests that must not pay for a
// full content read. Notes written before sourceName existed fall back to Drive.
function driveNoteFileName_(ref) {
  var id = driveNoteFileId_(ref);
  if (!id) return null;
  try { return DriveApp.getFileById(id).getName(); } catch (err) { return null; }
}

// True only when the note's attachment is something driveReadNoteFile_ can
// actually return text for. A Word/PDF attachment sets sourceFile just the same,
// so testing sourceFile alone offered Copy-with-transcript and Summarize on notes
// where both were guaranteed to fail.
function noteHasTextTranscript_(n) {
  if (!n || !n.sourceFile || !driveNoteFileId_(n.sourceFile)) return false;
  var name = (typeof n.sourceName === 'string' && n.sourceName)
    ? n.sourceName
    : driveNoteFileName_(n.sourceFile);
  return !!name && NOTE_FILE_TEXT_RE.test(name);
}

// ── Meeting-notes summarization ─────────────────────────────────────────────
// A transcript filed through the note box lands in Drive as plain text, and the
// note itself carries a "[file note: … — summary pending triage]" placeholder
// that a Claude session had to replace by hand at the next triage pass. This
// turns that manual step into one API call, so a recording becomes shareable
// meeting notes minutes after the meeting rather than at the next session.
//
// Deliberately a SEPARATE op rather than part of submitFieldNote: a submit must
// never fail because the model was slow or the key was missing. The note is
// written first with its placeholder, then summarization fills it in — and can
// be re-run any time from the log, including on notes filed before this existed.
var PROP_ANTHROPIC_KEY = "ANTHROPIC_API_KEY";
var PROP_ANTHROPIC_MODEL = "ANTHROPIC_MODEL";
// Haiku is the default because UrlFetchApp gives up around 60 seconds and a
// slow response costs the whole op. Set ANTHROPIC_MODEL in Script Properties to
// trade latency for depth (e.g. "claude-sonnet-5") without touching this file.
var ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001";
var ANTHROPIC_MAX_TOKENS = 1600;
// ~30k tokens of transcript, roughly a 2.5-hour meeting. Past this the tail is
// dropped rather than the request failing, and the note says it was truncated.
var TRANSCRIPT_MAX_CHARS = 120000;
var NOTE_PLACEHOLDER_RE = /\[file note: [^\]]*? — summary pending triage\]/;

// VTT is mostly timing scaffolding. Whisper also repeats a cue's text when a
// segment spans a boundary, so identical consecutive lines are collapsed.
function vttToPlainText_(raw) {
  var lines = String(raw || '').split(/\r?\n/);
  var out = [];
  var last = null;
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].trim();
    if (!l) continue;
    if (/^WEBVTT/.test(l) || /^(NOTE|STYLE|REGION)\b/.test(l)) continue;
    if (/^\d+$/.test(l)) continue;            // cue number
    if (l.indexOf('-->') >= 0) continue;      // timing line
    l = l.replace(/<[^>]*>/g, '').trim();     // inline cue tags
    if (!l || l === last) continue;
    out.push(l);
    last = l;
  }
  return out.join(' ');
}

function meetingNotesPrompt_(company, date, sourceType, transcript, truncated) {
  return [
    'You are writing meeting notes for a salesperson who just met with ' + company + '.',
    'The transcript below is machine-transcribed from an audio recording, so expect',
    'garbled names, missing punctuation, and no speaker labels. Do not invent speakers.',
    truncated ? 'NOTE: the transcript was truncated — the end of the meeting is missing.' : '',
    '',
    'Meeting date: ' + date + ' · Captured via: ' + sourceType,
    '',
    'Write notes the salesperson could paste into a follow-up email. Use exactly these',
    'sections, in this order, omitting any section with nothing real to put in it:',
    '',
    'SUMMARY — 2-4 sentences on what the meeting was about and where it landed.',
    'DISCUSSED — bullets of the substantive topics, with specifics (products, volumes,',
    '  timelines, prices, sites) wherever the transcript states them.',
    'CUSTOMER SIGNALS — bullets on what the customer wants, objects to, or is deciding.',
    'ACTION ITEMS — bullets, each naming the owner if the transcript makes that clear,',
    '  otherwise prefixed "Us:" or "Them:".',
    'OPEN QUESTIONS — bullets of anything left unresolved.',
    '',
    'Rules: plain text, no markdown headers or bold. Never state a number, name, date or',
    'commitment the transcript does not support — if something is unclear, write that it',
    'is unclear rather than guessing. If the transcript is too garbled or too short to be',
    'a real meeting, say so in one line and stop.',
    '',
    '--- TRANSCRIPT ---',
    transcript
  ].filter(function(l) { return l !== ''; }).join('\n');
}

function anthropicSummarize_(prompt) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty(PROP_ANTHROPIC_KEY);
  if (!key) throw new Error('SUMMARY_NOT_CONFIGURED');
  var model = props.getProperty(PROP_ANTHROPIC_MODEL) || ANTHROPIC_DEFAULT_MODEL;
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('SUMMARY_API_FAILED_' + res.getResponseCode());
  var body = JSON.parse(res.getContentText());
  var text = (body.content || []).filter(function(b) { return b.type === 'text'; })
    .map(function(b) { return b.text; }).join('\n').trim();
  if (!text) throw new Error('SUMMARY_EMPTY');
  return { text: text, model: model };
}

// Replaces the note's placeholder with generated meeting notes. The developer's
// own typed text is never touched — it is captured once into `typedText` and
// re-prepended on every run, so re-summarizing is idempotent rather than
// stacking summaries or eating what they wrote.
function summarizeNoteTranscript_(sessionToken, id) {
  var session = validateSessionForData(sessionToken, 'summarize_note');
  id = String(id || '');
  if (!id) throw new Error('INVALID_INPUT');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var data = driveNotesGet_().json;
    var note = (data.notes || []).filter(function(x) { return x.id === id; })[0];
    if (!note) throw new Error('NOT_FOUND');
    var transcript = driveReadNoteFile_(note.sourceFile);
    if (!transcript) throw new Error('NO_TRANSCRIPT');
    var plain = vttToPlainText_(transcript);
    if (plain.length < 200) throw new Error('TRANSCRIPT_TOO_SHORT');
    var truncated = plain.length > TRANSCRIPT_MAX_CHARS;
    if (truncated) plain = plain.slice(0, TRANSCRIPT_MAX_CHARS);
    var company = note.slug === 'general' ? 'an industry contact' : note.slug;
    var result = anthropicSummarize_(
      meetingNotesPrompt_(company, note.date, note.sourceType, plain, truncated));
    // First run captures whatever the developer typed alongside the file, so it
    // survives this run and every later re-run.
    if (typeof note.typedText !== 'string') {
      note.typedText = String(note.note || '').replace(NOTE_PLACEHOLDER_RE, '').trim();
    }
    var head = 'Auto-summary (' + result.model + (truncated ? ', transcript truncated' : '') + ')';
    note.note = (note.typedText ? note.typedText + '\n\n' : '') + head + '\n' + result.text;
    note.summarized = Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM-dd");
    // triage stays "pending" on purpose — a machine summary is an input to
    // promotion, not a decision to promote (see profiler-app.md).
    driveNotesPut_(data);
    auditLog('data_write', session.email || 'unknown', 'field_note_summarized',
             { id: note.id, slug: note.slug, model: result.model, chars: plain.length });
    return { success: true, id: note.id, note: note.note, model: result.model, truncated: truncated };
  } finally {
    lock.releaseLock();
  }
}

// ── Unattended transcript watcher (zero-click path) ─────────────────────────
// The browser import needs the developer to open the app. This does the same
// work on a timer instead, but it can only see 2-transcribed/ if that folder is
// SHARED with the account this script runs as — the folder lives in the
// developer's Drive, and DriveApp here acts as the deploying account. Sharing is
// the whole authorisation story: no new credential, no new endpoint.
var PROP_AUTO_CONFIDENCE = "TRANSCRIPT_AUTO_CONFIDENCE";
var WATCHER_TRIGGER_FN = "transcriptWatcherTick";
// Apps Script kills an execution at six minutes and each file costs a Drive read
// plus a model call, so a backlog is drained a few per tick rather than risking a
// mid-file kill that leaves a note filed but never written up.
var WATCHER_MAX_PER_RUN = 3;

// Which account to share the folder with. diagnoseAuthorization cannot print
// this — Session.getEffectiveUser needs userinfo.email, which this project's
// grant does not include. The notes file is owned by the script account by
// construction, so its owner is the answer, and reading it needs only `drive`.
function whoIsTheScriptAccount() {
  var email = null;
  try { email = driveNotesFile_().getOwner().getEmail(); } catch (err) { /* fall through */ }
  if (!email) { try { email = DriveApp.getRootFolder().getOwner().getEmail(); } catch (err2) { /* give up */ } }
  Logger.log(email
    ? 'Share your "Profiler App" Drive folder with this account (Editor):\n\n    ' + email + '\n'
    : 'Could not read the owning account. Check that the drive scope is granted.');
  return email;
}

function slugFromTranscriptName_(name) {
  var s = String(name || '');
  var head = (s.indexOf('--') >= 0 ? s.split('--')[0] : s.split(' ')[0]).trim().toLowerCase();
  if (!head) return 'general';
  var reg = ghContentsGet_(REGISTRY_FILE_PATH).json;
  var known = (reg.companies || []).some(function(c) { return c.slug === head; });
  return known ? head : 'general';
}

// Mirrors submitFieldNote's write, minus the session check — a trigger has no
// request to validate. Returns the new note id.
function createTranscriptNote_(slug, fileName, text, confidence) {
  var today = Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM-dd");
  var stamp = Utilities.formatDate(new Date(), "America/New_York", "HHmmss");
  var idDate = today.replace(/-/g, "");
  var safe = fileName.replace(/[^A-Za-z0-9._ -]/g, "_");
  var stored = today + "-" + stamp + "-" + safe;
  var ref = drivePutNoteFile_(slug, stored, Utilities.base64Encode(text, Utilities.Charset.UTF_8));
  var data = driveNotesGet_().json;
  var seq = 1;
  (data.notes || []).forEach(function(n) {
    if (n.id && n.id.indexOf("note-" + idDate + "-") === 0) {
      var num = parseInt(n.id.split("-")[2], 10);
      if (num >= seq) seq = num + 1;
    }
  });
  var note = {
    id: "note-" + idDate + "-" + (seq < 10 ? "0" + seq : String(seq)),
    date: today, slug: slug, sourceType: "contact",
    note: "[file note: " + stored + " — summary pending triage]",
    confidence: confidence, tags: [], triage: "pending",
    submittedVia: "transcript-watcher",
    sourceFile: ref, sourceName: fileName
  };
  data.notes = [note].concat(data.notes || []);
  driveNotesPut_(data);
  return note.id;
}

// One pass over the shared folder. Safe to run by hand from the editor — that is
// the only way to see its log, and the fastest way to tell a sharing problem
// from an empty queue.
function transcriptWatcherTick() {
  var props = PropertiesService.getScriptProperties();
  var conf = props.getProperty(PROP_AUTO_CONFIDENCE);
  if (conf === null || conf === '' || isNaN(Number(conf))) {
    Logger.log('Set ' + PROP_AUTO_CONFIDENCE + ' (0-100) in Script Properties first. '
      + 'The confidence rating is yours to choose, so nothing is imported until it is set.');
    return 0;
  }
  conf = Math.round(Number(conf));
  var folders = recFoldersGet_();
  if (!folders || !folders.done) { Logger.log('No recording folders registered yet. Open the app once first.'); return 0; }
  var dir;
  try { dir = DriveApp.getFolderById(folders.done); }
  catch (err) {
    Logger.log('Cannot open the transcribed folder. Share it with ' + (whoIsTheScriptAccount() || 'the script account')
      + ' as Editor, then run this again.');
    return 0;
  }
  var claimed = {};
  (driveNotesGet_().json.notes || []).forEach(function(n) { if (n.sourceName) claimed[n.sourceName] = true; });
  var done = 0, it = dir.getFiles();
  while (it.hasNext() && done < WATCHER_MAX_PER_RUN) {
    var f = it.next();
    var name = f.getName();
    if (!NOTE_FILE_TEXT_RE.test(name) || claimed[name]) continue;
    try {
      var text = f.getBlob().getDataAsString("UTF-8");
      var plain = vttToPlainText_(text);
      if (plain.length < 200) { Logger.log('Skipped ' + name + ' (too short to be a meeting).'); continue; }
      var slug = slugFromTranscriptName_(name);
      var id = createTranscriptNote_(slug, name, text, conf);
      var truncated = plain.length > TRANSCRIPT_MAX_CHARS;
      if (truncated) plain = plain.slice(0, TRANSCRIPT_MAX_CHARS);
      var result = anthropicSummarize_(meetingNotesPrompt_(slug, Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM-dd"), 'contact', plain, truncated));
      var data = driveNotesGet_().json;
      var note = (data.notes || []).filter(function(x) { return x.id === id; })[0];
      if (note) {
        note.typedText = '';
        note.note = 'Auto-summary (' + result.model + (truncated ? ', transcript truncated' : '') + ')\n' + result.text;
        note.summarized = Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM-dd");
        driveNotesPut_(data);
      }
      auditLog('data_write', 'transcript-watcher', 'field_note_summarized', { id: id, slug: slug, model: result.model });
      Logger.log('Wrote up ' + name + ' as ' + id + ' (' + slug + ').');
      done++;
    } catch (e) {
      Logger.log('Failed on ' + name + ': ' + ((e && e.message) || e));
    }
  }
  Logger.log(done ? done + ' transcript(s) written up this run.' : 'Nothing new to write up.');
  return done;
}

// Run once from the editor to arm the watcher. Removes any previous copy first
// so repeated runs cannot stack duplicate triggers.
function installTranscriptWatcher() {
  removeTranscriptWatcher();
  ScriptApp.newTrigger(WATCHER_TRIGGER_FN).timeBased().everyMinutes(15).create();
  Logger.log('Watcher armed. It checks the transcribed folder every 15 minutes.');
}

function removeTranscriptWatcher() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === WATCHER_TRIGGER_FN) { ScriptApp.deleteTrigger(t); n++; }
  });
  Logger.log(n ? 'Removed ' + n + ' existing watcher trigger(s).' : 'No watcher trigger was installed.');
  return n;
}

function getIntakeBootstrap(sessionToken) {
  validateSessionForData(sessionToken, 'intake_bootstrap');
  var reg = ghContentsGet_(REGISTRY_FILE_PATH).json;
  var companies = (reg.companies || []).map(function(c) { return { slug: c.slug, name: c.name }; });
  companies.push({ slug: "general", name: "General (ecosystem-wide)" });
  return { companies: companies, sourceTypes: NOTE_SOURCE_TYPES };
}

function submitFieldNote(sessionToken, payload) {
  var session = validateSessionForData(sessionToken, 'submit_field_note');
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_INPUT');
  var slug = String(payload.slug || '').toLowerCase().trim();
  var sourceType = String(payload.sourceType || '').toLowerCase().trim();
  var text = String(payload.note || '').trim();
  var confidence = Math.round(Number(payload.confidence));
  var files = Array.isArray(payload.files) ? payload.files : [];
  // M5 — Drive link to a browser-uploaded meeting recording. Constrained to
  // Google's own hosts so the field can't be used to park an arbitrary URL.
  var recordingLink = String(payload.recordingLink || '').trim();
  if (recordingLink && !/^https:\/\/(drive|docs)\.google\.com\//.test(recordingLink)) throw new Error('INVALID_INPUT');
  if (recordingLink.length > 500) throw new Error('INVALID_INPUT');
  // A submission needs typed text, attached files, or both
  if (!text && !files.length) throw new Error('INVALID_INPUT');
  if (text.length > 4000) throw new Error('INVALID_INPUT');
  if (files.length > NOTE_FILE_MAX_COUNT) throw new Error('INVALID_INPUT');
  files.forEach(function(f) {
    if (!f || typeof f.name !== 'string' || typeof f.base64 !== 'string') throw new Error('INVALID_INPUT');
    if (!NOTE_FILE_EXT_RE.test(f.name)) throw new Error('FILE_TYPE_NOT_ALLOWED');
    if (!f.base64.length || f.base64.length > NOTE_FILE_MAX_B64) throw new Error('FILE_TOO_LARGE');
  });
  if (NOTE_SOURCE_TYPES.indexOf(sourceType) < 0) throw new Error('INVALID_INPUT');
  if (!(confidence >= 0 && confidence <= 100)) throw new Error('INVALID_INPUT');

  var reg = ghContentsGet_(REGISTRY_FILE_PATH).json;
  var validSlugs = (reg.companies || []).map(function(c) { return c.slug; });
  validSlugs.push('general');
  if (validSlugs.indexOf(slug) < 0) throw new Error('INVALID_INPUT');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);   // serialize submissions so concurrent writes can't clobber
  try {
    var current = driveNotesGet_();
    var data = current.json;
    var today = Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM-dd");
    var idDate = today.replace(/-/g, "");

    // Store attached files in Drive first — a timestamp in the name keeps
    // same-day uploads from colliding inside the slug folder
    var savedFiles = [];
    var stamp = Utilities.formatDate(new Date(), "America/New_York", "HHmmss");
    files.forEach(function(f) {
      var safe = f.name.replace(/[^A-Za-z0-9._-]/g, "_");
      var name = today + "-" + stamp + "-" + safe;
      // `orig` is the name as the developer's Drive knows it, kept so the app can
      // tell which transcripts in 2-transcribed/ have already been imported.
      // `name` carries a date+time prefix and would never match.
      savedFiles.push({ name: name, orig: f.name, ref: drivePutNoteFile_(slug, name, f.base64) });
    });
    var seq = 1;
    (data.notes || []).forEach(function(n) {
      if (n.id && n.id.indexOf("note-" + idDate + "-") === 0) {
        var num = parseInt(n.id.split("-")[2], 10);
        if (num >= seq) seq = num + 1;
      }
    });
    var noteText = text;
    if (savedFiles.length) {
      var names = savedFiles.map(function(f) { return f.name; }).join(", ");
      noteText = (text ? text + " " : "") + "[file note: " + names + " — summary pending triage]";
    }
    var note = {
      id: "note-" + idDate + "-" + (seq < 10 ? "0" + seq : String(seq)),
      date: today,
      slug: slug,
      sourceType: sourceType,
      note: noteText,
      confidence: confidence,
      tags: [],
      triage: "pending",
      submittedVia: "profiler-intake"
    };
    if (savedFiles.length) { note.sourceFile = savedFiles[0].ref; note.sourceName = savedFiles[0].orig; }
    // M5 — meeting audio is uploaded browser-side with the user's own
    // drive.file credential (GAS never handles the bytes, so the 6-minute
    // execution ceiling and the 50MB UrlFetchApp cap never come into play).
    // Only the resulting Drive link is stored, and only if it IS a Drive link.
    if (recordingLink) note.recordingLink = recordingLink;
    data.notes = [note].concat(data.notes || []);
    driveNotesPut_(data);
    // No ghDispatchDeploy_ — notes no longer live in the repo, so a note write
    // needs no site rebuild to become visible. Writes are now instant.
    auditLog('data_write', session.email || 'unknown', 'field_note_submitted', { id: note.id, slug: slug, files: savedFiles.length });
    // Tells the page whether it is worth calling `summarize` straight after —
    // only a text transcript can be summarized, Word/PDF attachments cannot.
    var textFiles = savedFiles.filter(function(f) { return NOTE_FILE_TEXT_RE.test(f.name); });
    return { success: true, id: note.id, slug: slug, confidence: confidence,
             files: savedFiles.length, canSummarize: textFiles.length > 0 };
  } finally {
    lock.releaseLock();
  }
}

// ── Note management (list / edit / delete) — developer-owned content, so the
// signed-in developer may edit or delete their own notes; Claude's triage
// passes never alter note text (see profiler-app.md). Edits stamp an "edited"
// date so the log stays honest about post-hoc changes.

function listFieldNotes(sessionToken) {
  validateSessionForData(sessionToken, 'list_field_notes');
  var notes = driveNotesGet_().json.notes || [];
  return notes.map(function(n) {
    return { id: n.id, date: n.date, slug: n.slug, sourceType: n.sourceType, note: n.note,
             confidence: n.confidence, triage: n.triage, submittedVia: n.submittedVia,
             sourceFile: n.sourceFile || null, edited: n.edited || null,
             summarized: n.summarized || null,
             recordingLink: n.recordingLink || null,
             sourceName: n.sourceName || null,
             // Drives the "Copy for Claude" and "Summarize" affordances. Only a
             // TEXT attachment qualifies — a Word/PDF note has a sourceFile too,
             // but driveReadNoteFile_ returns null for it, so offering either
             // button on one produced a guaranteed NO_TRANSCRIPT failure.
             hasTranscript: noteHasTextTranscript_(n) };
  });
}

// "Copy for Claude" — returns one note plus its transcript text, pre-formatted
// for pasting into a session. Notes left the repo, so an unattended session can
// no longer read them; this is the developer-present path that replaces it.
function getNoteForClaude(sessionToken, id) {
  validateSessionForData(sessionToken, 'get_note_for_claude');
  id = String(id || '');
  var notes = driveNotesGet_().json.notes || [];
  var n = notes.filter(function(x) { return x.id === id; })[0];
  if (!n) throw new Error('NOT_FOUND');
  var body = [
    "Field note " + n.id + " (" + n.slug + ")",
    "Date: " + n.date + " · Source: " + n.sourceType + " · Confidence: " + n.confidence + "/100",
    "Triage: " + (n.triage || "pending"),
    "",
    n.note
  ];
  var transcript = driveReadNoteFile_(n.sourceFile);
  if (transcript) body.push("", "--- transcript ---", transcript);
  return { id: n.id, slug: n.slug, text: body.join("\n") };
}

// Every pending note in one blob — the manual replacement for the weekly
// unattended triage sweep the Drive move traded away.
function getPendingNotesForClaude(sessionToken) {
  validateSessionForData(sessionToken, 'get_pending_for_claude');
  var notes = (driveNotesGet_().json.notes || []).filter(function(n) {
    return (n.triage || 'pending') === 'pending';
  });
  if (!notes.length) return { count: 0, text: "No pending field notes." };
  var parts = notes.map(function(n) {
    var seg = [
      "### " + n.id + " — " + n.slug,
      "Date: " + n.date + " · Source: " + n.sourceType + " · Confidence: " + n.confidence + "/100",
      "",
      n.note
    ];
    var t = driveReadNoteFile_(n.sourceFile);
    if (t) seg.push("", "--- transcript ---", t);
    return seg.join("\n");
  });
  return { count: notes.length, text: "Triage these pending field notes:\n\n" + parts.join("\n\n") };
}

function updateFieldNote(sessionToken, payload) {
  var session = validateSessionForData(sessionToken, 'update_field_note');
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_INPUT');
  var id = String(payload.id || '');
  var text = String(payload.note || '').trim();
  var confidence = Math.round(Number(payload.confidence));
  if (!id || !text || text.length > 4000) throw new Error('INVALID_INPUT');
  if (!(confidence >= 0 && confidence <= 100)) throw new Error('INVALID_INPUT');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var current = driveNotesGet_();
    var data = current.json;
    var target = (data.notes || []).filter(function(n) { return n.id === id; })[0];
    if (!target) throw new Error('NOT_FOUND');
    target.note = text;
    target.confidence = confidence;
    target.edited = Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM-dd");
    driveNotesPut_(data);
    auditLog('data_write', session.email || 'unknown', 'field_note_edited', { id: id });
    return { success: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function deleteFieldNote(sessionToken, id) {
  var session = validateSessionForData(sessionToken, 'delete_field_note');
  id = String(id || '');
  if (!id) throw new Error('INVALID_INPUT');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var current = driveNotesGet_();
    var data = current.json;
    var target = (data.notes || []).filter(function(n) { return n.id === id; })[0];
    if (!target) throw new Error('NOT_FOUND');
    data.notes = data.notes.filter(function(n) { return n.id !== id; });
    driveNotesPut_(data);
    // Best-effort trash of the attached file — the log entry is the source of
    // truth; a leftover file is harmless and recoverable from Drive's bin
    driveDeleteNoteFile_(target.sourceFile);
    auditLog('data_write', session.email || 'unknown', 'field_note_deleted', { id: id });
    return { success: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

// Fetch-transport dispatcher for the note ops. Session token in `session`;
// op in `op`; payload fields as flat params (files as a JSON string, POST only).
// Every branch returns a plain object; callers JSON-encode via ContentService.
function handleNoteOp_(e) {
  var p = (e && e.parameter) || {};
  // `nop` (note-op) — the GET mirror already uses `op` for outer routing
  var op = p.nop || '';
  var session = p.session || '';
  // Defense-in-depth: reject obviously invalid tokens before dispatch, so a
  // future toggle regression can never silently reopen the ops (real
  // validation happens in validateSessionForData with
  // ENABLE_DATA_OP_VALIDATION forced true in PROJECT_OVERRIDES)
  if (!session || session.length < 32) return { success: false, error: 'SESSION_EXPIRED' };
  try {
    // Separation of power — the write pipeline (submit/list/edit/delete) is
    // admin-only; every other ACL-approved user gets `suggest`, which emails
    // the note to NOTE_SUGGEST_EMAIL for consideration and commits nothing.
    // Enforced HERE (server-side): the page's role-aware UI is convenience,
    // not the boundary.
    var noteSess = validateSessionForData(session, 'note_' + op);
    var noteIsAdmin = (noteSess.permissions || []).indexOf('admin') >= 0;
    if (['submit', 'list', 'edit', 'delete', 'claudeone', 'claudepending',
         'recfolders', 'setrecfolders'].indexOf(op) >= 0 && !noteIsAdmin) {
      return { success: false, error: 'ADMIN_ONLY', role: noteSess.role || 'viewer' };
    }
    if (op === 'whoami') {
      return { success: true, email: noteSess.email, role: noteSess.role || 'viewer', isAdmin: noteIsAdmin };
    }
    if (op === 'suggest') {
      var sSlug = String(p.slug || '').toLowerCase().trim();
      var sSource = String(p.sourceType || '').toLowerCase().trim();
      var sText = String(p.note || '').trim();
      var sConf = Math.round(Number(p.confidence));
      var sFiles = [];
      if (p.files) {
        try { sFiles = JSON.parse(p.files); } catch (se) { return { success: false, error: 'bad_files_payload' }; }
      }
      if (!sText && !sFiles.length) return { success: false, error: 'INVALID_INPUT' };
      if (sText.length > 4000 || sFiles.length > NOTE_FILE_MAX_COUNT) return { success: false, error: 'INVALID_INPUT' };
      if (NOTE_SOURCE_TYPES.indexOf(sSource) < 0) return { success: false, error: 'INVALID_INPUT' };
      if (!(sConf >= 0 && sConf <= 100)) return { success: false, error: 'INVALID_INPUT' };
      var blobs = [];
      for (var bi = 0; bi < sFiles.length; bi++) {
        var sf = sFiles[bi];
        if (!sf || typeof sf.name !== 'string' || typeof sf.base64 !== 'string') return { success: false, error: 'INVALID_INPUT' };
        if (!NOTE_FILE_EXT_RE.test(sf.name)) return { success: false, error: 'FILE_TYPE_NOT_ALLOWED' };
        if (!sf.base64.length || sf.base64.length > NOTE_FILE_MAX_B64) return { success: false, error: 'FILE_TOO_LARGE' };
        var safeName = sf.name.replace(/[^A-Za-z0-9._-]/g, "_");
        blobs.push(Utilities.newBlob(Utilities.base64Decode(sf.base64),
          /pdf$/i.test(safeName) ? 'application/pdf' : 'application/octet-stream', safeName));
      }
      MailApp.sendEmail({
        to: NOTE_SUGGEST_EMAIL,
        subject: '[Profiler] Field note suggestion — ' + (sSlug || 'general') + ' (from ' + (noteSess.email || 'unknown') + ')',
        body: 'A field note was suggested in the Profiler app.\n\n'
          + 'From: ' + (noteSess.email || 'unknown') + ' (role: ' + (noteSess.role || 'viewer') + ')\n'
          + 'Company: ' + (sSlug || 'general') + '\n'
          + 'Source type: ' + sSource + '\n'
          + 'Suggested confidence: ' + sConf + '/100\n'
          + 'Attachments: ' + (blobs.length ? blobs.map(function(b2) { return b2.getName(); }).join(', ') : 'none') + '\n\n'
          + 'Note:\n' + (sText || '(no typed text — see attachments)') + '\n\n'
          + 'To accept it, add it yourself via the Profiler note box or tell Claude '
          + '(e.g. "profiler note ' + (sSlug || 'general') + ': …") with your own confidence rating.',
        attachments: blobs
      });
      auditLog('data_write', noteSess.email || 'unknown', 'field_note_suggested', { slug: sSlug, files: blobs.length });
      return { success: true, suggested: true };
    }
    if (op === 'bootstrap') {
      return { success: true, data: getIntakeBootstrap(session) };
    }
    if (op === 'submit') {
      var files = [];
      if (p.files) {
        try { files = JSON.parse(p.files); } catch (fe) { return { success: false, error: 'bad_files_payload' }; }
      }
      return submitFieldNote(session, {
        slug: p.slug, sourceType: p.sourceType, note: p.note,
        confidence: Number(p.confidence), files: files,
        recordingLink: p.recordingLink
      });
    }
    if (op === 'list') {
      return { success: true, notes: listFieldNotes(session) };
    }
    if (op === 'edit') {
      return updateFieldNote(session, { id: p.id, note: p.note, confidence: Number(p.confidence) });
    }
    if (op === 'delete') {
      return deleteFieldNote(session, p.id);
    }
    // "Copy for Claude" — read-only but returns full note + transcript text,
    // so it sits behind the same admin gate as `list`, not outside it
    if (op === 'claudeone') {
      return { success: true, payload: getNoteForClaude(session, p.id) };
    }
    if (op === 'claudepending') {
      return { success: true, payload: getPendingNotesForClaude(session) };
    }
    // Turns a filed transcript into meeting notes. Same admin gate as `edit`,
    // since it rewrites the note body.
    if (op === 'summarize') {
      return summarizeNoteTranscript_(session, p.id);
    }
    // Folder-ID registry for the browser-owned recordings tree. The browser
    // creates and reads the folders itself; it just cannot re-find them
    // across devices, so the IDs are parked here.
    if (op === 'recfolders') {
      return { success: true, folders: recFoldersGet_() };
    }
    if (op === 'setrecfolders') {
      try {
        var savedFolders = recFoldersSet_({ root: p.root, pending: p.pending, done: p.done });
        auditLog('data_write', noteSess.email || 'unknown', 'recording_folders_registered', savedFolders);
        return { success: true, folders: savedFolders };
      } catch (sf) { return { success: false, error: 'bad_folder_ids' }; }
    }
    return { success: false, error: 'unknown_note_op' };
  } catch (err) {
    return { success: false, error: String((err && err.message) || err) };
  }
}

// Unauthenticated ACL health probe backing GET ?action=api&op=aclhealth (see the
// dispatch in doGet). Runs the exact read sequence checkSpreadsheetAccess performs
// before it trusts the list — openById, Access-tab lookup, data read, page-column
// scan — and reports which stage failed. Exists because an `acl_unreachable`
// sign-in outage is otherwise diagnosable only from the Apps Script editor's
// execution log, which costs a developer round-trip per incident.
// Safe without auth: it returns only reason codes the sign-in screen already
// shows to any visitor, plus the caught exception's message with the spreadsheet
// ID redacted — never emails, row data, or ACL contents. A 60-second result
// cache keeps unauthenticated callers from burning Sheets quota.
function aclHealthProbe_() {
  var out = { probe: 'aclhealth', page: ACL_PAGE_NAME, gasVersion: VERSION,
              ok: false, stage: 'config', reason: '', detail: '' };
  var hasAcl = MASTER_ACL_SPREADSHEET_ID && MASTER_ACL_SPREADSHEET_ID !== "YOUR_MASTER_ACL_SPREADSHEET_ID";
  if (!hasAcl) { out.reason = 'acl_not_configured'; return out; }
  var cache = getEpochCache();
  var cached = cache.get('aclhealth_probe');
  if (cached) { try { return JSON.parse(cached); } catch (eCache) {} }
  try {
    out.stage = 'open';
    var ss = SpreadsheetApp.openById(MASTER_ACL_SPREADSHEET_ID);
    out.stage = 'tab';
    var sheet = ss.getSheetByName(ACL_SHEET_NAME);
    if (!sheet) {
      out.reason = 'acl_tab_missing';
    } else {
      out.stage = 'read';
      var data = sheet.getDataRange().getValues();
      if (data.length < 2) {
        out.reason = 'acl_empty';
      } else {
        out.stage = 'column';
        var headers = data[0], colIdx = -1;
        for (var c = 0; c < headers.length; c++) {
          if (String(headers[c]).trim().toLowerCase() === ACL_PAGE_NAME.toLowerCase()) { colIdx = c; break; }
        }
        if (colIdx === -1) {
          out.reason = 'acl_column_missing';
        } else {
          out.ok = true; out.stage = 'done'; out.reason = 'acl_ok';
        }
      }
    }
  } catch (e) {
    out.reason = 'acl_unreachable';
    out.detail = String((e && e.message) || e).split(MASTER_ACL_SPREADSHEET_ID).join('[ACL_ID]').slice(0, 200);
  }
  try { cache.put('aclhealth_probe', JSON.stringify(out), 60); } catch (ePut) {}
  return out;
}
// PROJECT END
// =============================================
// AUTH — Web App Entry Point (doGet)
// Toggle-gated: TOKEN_EXCHANGE_METHOD controls token exchange path.
// =============================================

// ── Phase 7 (H-5): Server-side heartbeat processing ──
// Called via google.script.run from the heartbeat listener page (action=heartbeat).
// Token is received via postMessage, NOT URL parameters — eliminates token-in-URL exposure.
function processHeartbeat(token) {
  if (!token || !AUTH_CONFIG.ENABLE_HEARTBEAT) {
    return {type: 'gas-heartbeat-error', error: 'invalid_request'};
  }

  var cache = getEpochCache();

  // Rate limit: max 20 per session per 5-minute window
  var hbRlKey = 'hb_ratelimit_' + token.substring(0, 16);
  var hbAttempts = cache.get(hbRlKey);
  var hbCount = hbAttempts ? parseInt(hbAttempts, 10) : 0;
  if (hbCount >= 20) {
    return {type: 'gas-heartbeat-error', error: 'rate_limited'};
  }
  cache.put(hbRlKey, String(hbCount + 1), 300);

  var raw = cache.get("session_" + token);
  if (!raw) {
    var evictionReason = cache.get("evicted_" + token) || 'timeout';
    // Don't remove the tombstone — let it expire naturally (5 min TTL).
    // Multiple consumers may need it: heartbeat, page refresh (validateSession),
    // and the same heartbeat may retry if the first response was dropped.
    return {type: 'gas-heartbeat-expired', reason: evictionReason};
  }

  var hbData;
  try { hbData = JSON.parse(raw); } catch (err) {
    return {type: 'gas-heartbeat-expired', reason: 'corrupt_session'};
  }

  // Retrieve messageKey from session data for signing response
  var msgKey = hbData.messageKey || '';

  // Check HMAC if enabled
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY && !verifySessionHmac(hbData)) {
    cache.remove("session_" + token);
    return signMessage({type: 'gas-heartbeat-expired', reason: 'integrity_violation'}, msgKey);
  }

  // Absolute session timeout — hard ceiling, heartbeats cannot extend past this
  if (hbData.absoluteCreatedAt && AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
    var hbAbsElapsed = (Date.now() - hbData.absoluteCreatedAt) / 1000;
    if (hbAbsElapsed > AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
      cache.remove("session_" + token);
      auditLog('session_expired', hbData.email, 'absolute_timeout_heartbeat',
        { elapsed: Math.round(hbAbsElapsed) + 's', limit: AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT + 's', clientIp: 'not-collected' });
      return signMessage({type: 'gas-heartbeat-expired', reason: 'absolute_timeout'}, msgKey);
    }
  }

  // Rolling session timeout
  var hbElapsed = (Date.now() - hbData.createdAt) / 1000;
  if (hbElapsed > AUTH_CONFIG.SESSION_EXPIRATION) {
    cache.remove("session_" + token);
    auditLog('session_expired', hbData.email, 'heartbeat_too_late',
      { elapsed: Math.round(hbElapsed) + 's', clientIp: 'not-collected' });
    return signMessage({type: 'gas-heartbeat-expired', reason: 'timeout'}, msgKey);
  }

  // Session valid — reset createdAt to extend
  hbData.createdAt = Date.now();
  hbData.lastActivity = Date.now();
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) {
    hbData.hmac = generateSessionHmac(hbData);
  }
  cache.put("session_" + token, JSON.stringify(hbData), AUTH_CONFIG.SESSION_EXPIRATION);

  var hbAbsRemaining = hbData.absoluteCreatedAt && AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT
    ? Math.round(AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT - ((Date.now() - hbData.absoluteCreatedAt) / 1000))
    : 0;
  return signMessage({type: 'gas-heartbeat-ok', expiresIn: AUTH_CONFIG.SESSION_EXPIRATION, absoluteRemaining: hbAbsRemaining}, msgKey);
}

// ── Live viewer presence ──
// Reports/returns who is currently viewing the app, with active/away derived from each
// client's window focus. Soft state only: one CacheService roster key holding
// { emailLower: {name, state, ts} }; entries self-expire after PRESENCE_STALE_MS, so a
// viewer who closes the tab simply ages out (no reliable unload signal is needed). No PHI —
// display name + focus state, keyed by the caller's own validated session. Read-modify-write
// on a single key (last-write-wins); clients re-report on a ~30s cadence, so transient
// races self-heal on the next report.
var PRESENCE_KEY = 'presence_roster';
var PRESENCE_STALE_MS = 75000;   // drop a viewer whose last report is older than 75s
var PRESENCE_TTL = 120;          // CacheService TTL for the roster key (seconds)

function updatePresence(sessionToken, state) {
  try {
    var id = validateSessionForData(sessionToken, 'presence');   // throws on invalid/expired session
    var email = String(id.email || '').toLowerCase();
    if (!email || email === 'unvalidated') return { viewers: [] };
    var st = (state === 'away') ? 'away' : 'active';
    var now = Date.now();
    var cache = getEpochCache();
    var roster = {};
    try { var raw = cache.get(PRESENCE_KEY); if (raw) roster = JSON.parse(raw) || {}; } catch (e) { roster = {}; }
    roster[email] = { name: id.displayName || id.email || email, state: st, ts: now };
    var out = [];
    for (var k in roster) {
      if (!roster.hasOwnProperty(k)) continue;
      var r = roster[k];
      if (!r || (now - (r.ts || 0)) > PRESENCE_STALE_MS) { delete roster[k]; continue; }
      out.push({ email: k, name: r.name || k, state: (r.state === 'away') ? 'away' : 'active', self: (k === email) });
    }
    cache.put(PRESENCE_KEY, JSON.stringify(roster), PRESENCE_TTL);
    out.sort(function (a, b) {
      if (a.self !== b.self) return a.self ? -1 : 1;                       // yourself first
      if (a.state !== b.state) return a.state === 'active' ? -1 : 1;       // active before away
      return String(a.name).localeCompare(String(b.name));                 // then by name
    });
    return { viewers: out };
  } catch (e) {
    return { viewers: [], error: String((e && e.message) || e) };
  }
}

// ── Phase 7 (H-6): Server-side sign-out processing ──
// Called via google.script.run from the signout listener page (action=signout).
// Token is received via postMessage, NOT URL parameters.
function processSignOut(token) {
  if (!token) {
    return {type: 'gas-signed-out', success: false, error: 'no_token'};
  }
  // Read messageKey before invalidation (for signing the response)
  var cache = getEpochCache();
  var raw = cache.get("session_" + token);
  var msgKey = '';
  if (raw) { try { msgKey = JSON.parse(raw).messageKey || ''; } catch(e) {} }
  invalidateSession(token);
  return signMessage({type: 'gas-signed-out', success: true}, msgKey);
}

// ── Phase 7 (M-4): Server-side security event processing ──
// Called via google.script.run from the securityEvent listener page (action=securityEvent).
// Event details are received via postMessage, NOT URL parameters.
function processSecurityEvent(eventType, details) {
  if (!eventType) return;
  var cache = getEpochCache();

  // Global rate limit: max 50 security events per 5-minute window
  var seGlobalKey = 'se_ratelimit_global';
  var seGlobalAttempts = cache.get(seGlobalKey);
  var seGlobalCount = seGlobalAttempts ? parseInt(seGlobalAttempts, 10) : 0;

  if (seGlobalCount < 50) {
    cache.put(seGlobalKey, String(seGlobalCount + 1), 300);
    var seDetails = {};
    try {
      if (typeof details === 'string') {
        seDetails = JSON.parse(details.substring(0, 500));
      } else if (details && typeof details === 'object') {
        seDetails = details;
      }
    } catch(ex) {}
    auditLog('security_event', 'not-collected', String(eventType).substring(0, 50), {
      details: seDetails,
      clientIp: 'not-collected',
      page: EMBED_PAGE_URL
    });
  } else if (seGlobalCount === 50) {
    cache.put(seGlobalKey, String(seGlobalCount + 1), 300);
    auditLog('security_event_flood', 'system', 'Global rate limit reached', {
      message: 'Max 50 security events per 5 minutes — further events suppressed regardless of source IP',
      lastEvent: String(eventType).substring(0, 50),
      page: EMBED_PAGE_URL
    });
  }
}

// ── DJB2→HMAC Migration: Server-side message signing for GAS session HTML ──
// Called via google.script.run from the session HTML inline script.
// Replaces client-side _s() (DJB2) with server-side HMAC-SHA256 signing.
// Same pattern as processHeartbeat/processSignOut (Phase 7).
function signAppMessage(sessionToken, messageType, params) {
  if (!sessionToken || !messageType) {
    return { type: 'error', error: 'missing_parameters' };
  }

  var cache = getEpochCache();

  // Validate session — retrieve messageKey from cache regardless of session validity
  var raw = cache.get('session_' + sessionToken);
  var msgKey = '';
  if (raw) {
    try { msgKey = JSON.parse(raw).messageKey || ''; } catch(e) {}
  }

  var session = validateSession(sessionToken);
  if (session.status !== 'authorized') {
    // Session is invalid — expected for 'gas-session-invalid' callers.
    // Use recovered messageKey from cache (may still exist even after expiry).
    return signMessage({
      type: 'gas-session-invalid',
      reason: 'SESSION_EXPIRED'
    }, msgKey);
  }

  switch (messageType) {
    case 'gas-auth-ok':
      var authRole = session.role || RBAC_DEFAULT_ROLE;
      return signMessage({
        type: 'gas-auth-ok',
        version: VERSION,
        needsReauth: session.needsReauth || false,
        messageKey: msgKey,
        role: authRole,
        permissions: session.permissions || getRolesFromSpreadsheet()[authRole] || getRolesFromSpreadsheet()[RBAC_DEFAULT_ROLE]
      }, msgKey);

    case 'gas-version':
      var appData = getAppData();
      return signMessage({
        type: 'gas-version',
        version: appData.version
      }, msgKey);

    case 'gas-user-activity':
      return signMessage({
        type: 'gas-user-activity'
      }, msgKey);

    case 'gas-session-invalid':
      return signMessage({
        type: 'gas-session-invalid',
        reason: (params && params.reason) || 'unknown'
      }, msgKey);

    default:
      return { type: 'error', error: 'unknown_message_type' };
  }
}

function doGet(e) {
  var sessionToken = (e && e.parameter && e.parameter.session) || "";
  // Phase 7: signOutToken, heartbeatToken, and msgKey URL parameters removed —
  // heartbeat and sign-out now use postMessage via action listener pages
  // (processHeartbeat/processSignOut called via google.script.run)

  // Phase 3 (C-3): Client IP collection removed — ipify.org lacks BAA coverage.
  // GAS doGet(e) does not expose client IP — no compliant server-side method exists.
  // All audit log entries use 'not-collected' for the IP field.
  // To re-enable, uncomment below and set AUTH_CONFIG.ENABLE_IP_LOGGING = true:
  // var rawIp = (e && e.parameter && e.parameter.clientIp) || '';
  // var clientIp = '';
  // if (rawIp) {
  //   var t = String(rawIp).trim().substring(0, 45);
  //   clientIp = (/^(\d{1,3}\.){3}\d{1,3}$/.test(t) || /^[0-9a-fA-F:]+$/.test(t)) ? t : 'invalid';
  // }
  var clientIp = 'not-collected';

  // Auto-initialize required Script Properties (HMAC_SECRET, CACHE_EPOCH) on first page load
  ensureScriptProperties_();

  // Auto-register this project in the Master ACL Projects sheet
  registerSelfProject();

  // ── Phase 7: postMessage-based action routes ──
  // These routes return lightweight listener pages that receive sensitive data
  // via postMessage instead of URL parameters. The listener pages use
  // google.script.run to call the server-side processing functions.
  var action = (e && e.parameter && e.parameter.action) || '';

  // GET deploy fallback — the CI deploy webhook's POST can fail on Google's redirect
  // (the workflow runner's curl loses the POST body → error page), so the workflow
  // retries as GET ?action=api&op=deploy. Same bare, unauthenticated semantics as the
  // protected doPost(action=deploy) handler (see its ⚠️ CRITICAL comment): it can only
  // re-pull what GitHub already contains. Do NOT add guards, secrets, or auth here.
  if (action === 'api' && ((e && e.parameter && e.parameter.op) || '') === 'deploy') {
    return ContentService.createTextOutput(pullAndDeployFromGitHub());
  }

  // PROJECT: unauthenticated ACL health probe — GET ?action=api&op=aclhealth.
  // Same trust model as the deploy fallback above: it exposes only reason codes
  // the sign-in screen already shows to anyone, never ACL contents (details on
  // aclHealthProbe_). Lets an acl_unavailable sign-in outage be diagnosed
  // remotely instead of from the editor's execution log.
  if (action === 'api' && ((e && e.parameter && e.parameter.op) || '') === 'aclhealth') {
    return ContentService.createTextOutput(JSON.stringify(aclHealthProbe_()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // GET API fallback for the fetch transport — Google's serving can drop POST
  // bodies on its redirect, so the HTML layer retries every doPost call on this
  // route. Mirrors the doPost fetch routes (JSON in, JSON out).
  if (action === 'api') {
    var apiOp = (e && e.parameter && e.parameter.op) || '';
    var apiToken = (e && e.parameter && e.parameter.token) || '';
    var apiResult;
    try {
      if (apiOp === 'exchangeToken') {
        ensureScriptProperties_();
        apiResult = exchangeTokenForSession(apiToken);
        if (apiResult && apiResult.success) apiResult.version = VERSION;
      } else if (apiOp === 'signOut') {
        apiResult = processSignOut(apiToken);
      } else if (apiOp === 'heartbeat') {
        apiResult = processHeartbeat(apiToken);
      } else if (apiOp === 'note') {
        // PROJECT: GET mirror of the doPost note ops (no-file calls only —
        // file payloads exceed URL limits and must use the POST path)
        apiResult = handleNoteOp_(e);
      } else if (apiOp === 'guidance') {
        // PROJECT: GET mirror of the guidance ops (read-only, no payloads)
        apiResult = handleGuidanceOp_(e);
      } else {
        apiResult = { error: 'unknown_op' };
      }
    } catch (apiErr) {
      apiResult = { error: String((apiErr && apiErr.message) || apiErr) };
    }
    return ContentService.createTextOutput(JSON.stringify(apiResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Heartbeat action — returns page that listens for token via postMessage
  if (action === 'heartbeat') {
    var hbListenerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
      + 'var PARENT_ORIGIN = ' + JSON.stringify(PARENT_ORIGIN) + ';'
      + 'window.top.postMessage({type:"gas-heartbeat-ready"}, PARENT_ORIGIN);'
      + 'window.addEventListener("message", function(evt) {'
      + '  if (evt.origin !== PARENT_ORIGIN) return;'
      + '  if (!evt.data || evt.data.type !== "heartbeat-token") return;'
      + '  google.script.run'
      + '    .withSuccessHandler(function(r) {'
      + '      window.top.postMessage(r, PARENT_ORIGIN);'
      + '    })'
      + '    .withFailureHandler(function(e) {'
      + '      window.top.postMessage({type:"gas-heartbeat-error",'
      + '        error:String(e)}, PARENT_ORIGIN);'
      + '    })'
      + '    .processHeartbeat(evt.data.token);'
      + '});'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(hbListenerHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Sign-out action — returns page that listens for token via postMessage
  if (action === 'signout') {
    var soListenerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
      + 'var PARENT_ORIGIN = ' + JSON.stringify(PARENT_ORIGIN) + ';'
      + 'window.top.postMessage({type:"gas-signout-ready"}, PARENT_ORIGIN);'
      + 'window.addEventListener("message", function(evt) {'
      + '  if (evt.origin !== PARENT_ORIGIN) return;'
      + '  if (!evt.data || evt.data.type !== "signout-token") return;'
      + '  google.script.run'
      + '    .withSuccessHandler(function(r) {'
      + '      window.top.postMessage(r, PARENT_ORIGIN);'
      + '    })'
      + '    .withFailureHandler(function(e) {'
      + '      window.top.postMessage({type:"gas-signed-out", success:false,'
      + '        error:String(e)}, PARENT_ORIGIN);'
      + '    })'
      + '    .processSignOut(evt.data.token);'
      + '});'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(soListenerHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Admin session management — returns page that listens for admin commands via postMessage
  if (action === 'adminSessions') {
    var adminListenerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
      + 'var PARENT_ORIGIN = ' + JSON.stringify(PARENT_ORIGIN) + ';'
      + 'window.top.postMessage({type:"gas-admin-sessions-ready"}, PARENT_ORIGIN);'
      + 'window.addEventListener("message", function(evt) {'
      + '  if (evt.origin !== PARENT_ORIGIN) return;'
      + '  if (!evt.data) return;'
      + '  if (evt.data.type === "admin-list-sessions") {'
      + '    google.script.run'
      + '      .withSuccessHandler(function(r) {'
      + '        window.top.postMessage({type:"gas-admin-sessions-list", sessions:r}, PARENT_ORIGIN);'
      + '      })'
      + '      .withFailureHandler(function(e) {'
      + '        window.top.postMessage({type:"gas-admin-sessions-error",'
      + '          error:String(e)}, PARENT_ORIGIN);'
      + '      })'
      + '      .listActiveSessions(evt.data.token);'
      + '  }'
      + '  if (evt.data.type === "admin-signout-user") {'
      + '    google.script.run'
      + '      .withSuccessHandler(function(r) {'
      + '        window.top.postMessage({type:"gas-admin-signout-result", result:r}, PARENT_ORIGIN);'
      + '      })'
      + '      .withFailureHandler(function(e) {'
      + '        window.top.postMessage({type:"gas-admin-signout-error",'
      + '          error:String(e)}, PARENT_ORIGIN);'
      + '      })'
      + '      .adminSignOutUser(evt.data.token, evt.data.email);'
      + '  }'
      + '});'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(adminListenerHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Cross-project session listing — called by GlobalACL's Global Sessions feature
  // Returns JSON via ContentService (not HTML). Authenticated by shared secret.
  if (action === 'listSessions') {
    var cpParams = { secret: (e.parameter && e.parameter.secret) || '', callerEmail: (e.parameter && e.parameter.callerEmail) || '' };
    var cpAuth = validateCrossProjectAdmin(cpParams);
    if (!cpAuth.valid) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: cpAuth.reason }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var cpSessions = listActiveSessionsInternal(cpAuth.email);
    return ContentService.createTextOutput(JSON.stringify({ success: true, sessions: cpSessions, project: TITLE }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Cross-project admin secret distribution — called by globalacl's distributeSecret_()
  if (action === 'setAdminSecret') {
    var newSecret = (e.parameter && e.parameter.newSecret) || '';
    var oldSecret = (e.parameter && e.parameter.oldSecret) || '';
    if (!newSecret) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'missing_secret' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var props = PropertiesService.getScriptProperties();
    var current = props.getProperty('CROSS_PROJECT_ADMIN_SECRET') || '';
    // Accept if: no current secret (first setup) OR oldSecret matches current
    if (current && oldSecret !== current) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    props.setProperty('CROSS_PROJECT_ADMIN_SECRET', newSecret);
    _crossProjectSecret = null; // clear cache
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Cross-project admin sign-out — called by globalacl's adminGlobalSignOutUser via UrlFetchApp
  if (action === 'adminSignOut') {
    var cpParams2 = { secret: (e.parameter && e.parameter.secret) || '', callerEmail: (e.parameter && e.parameter.callerEmail) || '' };
    var cpAuth2 = validateCrossProjectAdmin(cpParams2);
    if (!cpAuth2.valid) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var cpTarget = (e.parameter && e.parameter.targetEmail) || '';
    if (cpTarget) {
      invalidateAllSessions(cpTarget, 'admin_signout');
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, email: cpTarget }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Cross-project access-cache clear — called by globalacl's adminGlobalClearAccessCaches
  // via UrlFetchApp. Bumps this app's cache epoch so ALL cached access, roles, and sessions
  // are invalidated (users re-authenticate on their next request). Used after ACL/role
  // changes (e.g. role renames) so stale cached grants don't linger anywhere.
  if (action === 'clearAccessCache') {
    // Secret-only validation (like setAdminSecret): the shared secret proves the request
    // comes from the Global ACL app, and ANY signed-in Global ACL user may trigger the
    // clear (developer decision — being granted the ACL manager IS the authorization;
    // the action forces re-authentication but exposes no data). callerEmail is
    // informational for audit trails only — no admin-role check on the caller.
    var ccSecret = (e.parameter && e.parameter.secret) || '';
    var ccExpected = getCrossProjectSecret();
    if (!ccExpected || ccSecret !== ccExpected) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    clearAllAccessCache();
    return ContentService.createTextOutput(JSON.stringify({ success: true, project: TITLE }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Nonce generation action — returns page that generates a one-time-use page nonce
  // via google.script.run, replacing the insecure ?session=TOKEN URL pattern.
  // The parent page loads this, sends the session token via postMessage, and receives
  // a short-lived nonce to use in ?page_nonce=NONCE for the actual app load.
  if (action === 'getNonce') {
    var nonceListenerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
      + 'var PARENT_ORIGIN = ' + JSON.stringify(PARENT_ORIGIN) + ';'
      + 'window.top.postMessage({type:"gas-nonce-ready"}, PARENT_ORIGIN);'
      + 'window.addEventListener("message", function(evt) {'
      + '  if (evt.origin !== PARENT_ORIGIN) return;'
      + '  if (!evt.data || evt.data.type !== "request-nonce") return;'
      + '  google.script.run'
      + '    .withSuccessHandler(function(r) {'
      + '      window.top.postMessage({type:"gas-nonce-result", success:r.success, nonce:r.nonce||"", error:r.error||""}, PARENT_ORIGIN);'
      + '    })'
      + '    .withFailureHandler(function(e) {'
      + '      window.top.postMessage({type:"gas-nonce-result", success:false, error:String(e)}, PARENT_ORIGIN);'
      + '    })'
      + '    .generatePageNonce(evt.data.sessionToken);'
      + '});'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(nonceListenerHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Phase A — HIPAA Privacy Rule operations listener
  if (action === 'phaseA') {
    var phaseAListenerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
      + 'var PARENT_ORIGIN = ' + JSON.stringify(PARENT_ORIGIN) + ';'
      + 'window.top.postMessage({type:"phase-a-ready"}, PARENT_ORIGIN);'
      + 'window.addEventListener("message", function(evt) {'
      + '  if (evt.origin !== PARENT_ORIGIN) return;'
      + '  if (!evt.data) return;'
      + '  var d = evt.data;'
      + '  function ok(type, payload) { window.top.postMessage(Object.assign({type:type}, payload), PARENT_ORIGIN); }'
      + '  function fail(type, e) { window.top.postMessage({type:type, error:String(e)}, PARENT_ORIGIN); }'
      // Disclosure Accounting
      + '  if (d.type === "phase-a-get-disclosures") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-disclosures-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-disclosures-result", {result:{success:false,message:String(e)}}); })'
      + '      .getDisclosureAccounting(d.token);'
      + '  }'
      + '  if (d.type === "phase-a-export-disclosures") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-export-disclosures-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-export-disclosures-result", {result:{success:false,message:String(e)}}); })'
      + '      .exportDisclosureAccounting(d.token, d.format);'
      + '  }'
      // Right of Access
      + '  if (d.type === "phase-a-request-export") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-export-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-export-result", {result:{success:false,message:String(e)}}); })'
      + '      .requestDataExport(d.token, d.format);'
      + '  }'
      // Right to Amendment
      + '  if (d.type === "phase-a-request-amendment") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-amendment-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-amendment-result", {result:{success:false,message:String(e)}}); })'
      + '      .requestAmendment(d.token, d.recordId, d.currentContent, d.proposedChange, d.reason);'
      + '  }'
      + '  if (d.type === "phase-a-get-pending-amendments") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-pending-amendments-result", {amendments:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-pending-amendments-result", {amendments:[],error:String(e)}); })'
      + '      .getPendingAmendments(d.token);'
      + '  }'
      + '  if (d.type === "phase-a-review-amendment") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-review-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-review-result", {result:{success:false,message:String(e)}}); })'
      + '      .reviewAmendment(d.token, d.amendmentId, d.decision, d.decisionReason);'
      + '  }'
      + '  if (d.type === "phase-a-submit-disagreement") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-disagreement-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-disagreement-result", {result:{success:false,message:String(e)}}); })'
      + '      .submitDisagreement(d.token, d.amendmentId, d.statement);'
      + '  }'
      // Extension Workflows
      + '  if (d.type === "phase-a-request-access-extension") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-access-extension-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-access-extension-result", {result:{success:false,message:String(e)}}); })'
      + '      .requestAccessExtension(d.token, d.requestId, d.reason);'
      + '  }'
      + '  if (d.type === "phase-a-request-amendment-extension") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-amendment-extension-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-amendment-extension-result", {result:{success:false,message:String(e)}}); })'
      + '      .requestAmendmentExtension(d.token, d.amendmentId, d.reason);'
      + '  }'
      // Formal Denial Notice
      + '  if (d.type === "phase-a-generate-denial-notice") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-denial-notice-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-denial-notice-result", {result:{success:false,message:String(e)}}); })'
      + '      .generateDenialNotice(d.token, d.requestType, d.requestId, d.params);'
      + '  }'
      // HITECH EHR Disclosure Accounting
      + '  if (d.type === "phase-a-get-ehr-disclosures") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-a-ehr-disclosures-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-a-ehr-disclosures-result", {result:{success:false,message:String(e)}}); })'
      + '      .getDisclosureAccounting(d.token, d.targetEmail, {includeEhrTpo: true});'
      + '  }'
      // Phase B — P1: Grouped Disclosure Accounting
      + '  if (d.type === "phase-b-get-grouped-disclosures") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-grouped-disclosures-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-grouped-disclosures-result", {result:{success:false,message:String(e)}}); })'
      + '      .getGroupedDisclosureAccounting(d.token, d.targetEmail);'
      + '  }'
      // Phase B — P1: Summary PHI Export
      + '  if (d.type === "phase-b-generate-summary") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-summary-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-summary-result", {result:{success:false,message:String(e)}}); })'
      + '      .generateDataSummary(d.token, d.targetEmail);'
      + '  }'
      // Phase B — P1: Amendment Notifications
      + '  if (d.type === "phase-b-send-amendment-notifications") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-amendment-notifications-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-amendment-notifications-result", {result:{success:false,message:String(e)}}); })'
      + '      .sendAmendmentNotifications(d.token, d.amendmentId, d.recipients);'
      + '  }'
      + '  if (d.type === "phase-b-get-notification-status") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-notification-status-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-notification-status-result", {result:{success:false,message:String(e)}}); })'
      + '      .getNotificationStatus(d.token, d.amendmentId);'
      + '  }'
      + '  if (d.type === "phase-b-get-disclosure-recipients") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-disclosure-recipients-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-disclosure-recipients-result", {result:{success:false,message:String(e)}}); })'
      + '      .getDisclosureRecipientsForRecord(d.token, d.recordId);'
      + '  }'
      // Phase B — P2: Breach Logging
      + '  if (d.type === "phase-b-log-breach") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-log-breach-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-log-breach-result", {result:{success:false,message:String(e)}}); })'
      + '      .logBreach(d.token, d.params);'
      + '  }'
      + '  if (d.type === "phase-b-update-breach-status") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-update-breach-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-update-breach-result", {result:{success:false,message:String(e)}}); })'
      + '      .updateBreachStatus(d.token, d.breachId, d.updates);'
      + '  }'
      + '  if (d.type === "phase-b-get-breach-report") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-breach-report-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-breach-report-result", {result:{success:false,message:String(e)}}); })'
      + '      .getBreachReport(d.token, d.year);'
      + '  }'
      + '  if (d.type === "phase-b-get-breach-log") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-breach-log-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-breach-log-result", {result:{success:false,message:String(e)}}); })'
      + '      .getBreachLog(d.token, d.options);'
      + '  }'
      // Phase B — P3: Personal Representatives
      + '  if (d.type === "phase-b-register-representative") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-register-rep-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-register-rep-result", {result:{success:false,message:String(e)}}); })'
      + '      .registerPersonalRepresentative(d.token, d.params);'
      + '  }'
      + '  if (d.type === "phase-b-get-representatives") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-representatives-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-representatives-result", {result:{success:false,message:String(e)}}); })'
      + '      .getPersonalRepresentatives(d.token, d.targetEmail);'
      + '  }'
      + '  if (d.type === "phase-b-revoke-representative") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-b-revoke-rep-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-b-revoke-rep-result", {result:{success:false,message:String(e)}}); })'
      + '      .revokeRepresentative(d.token, d.representativeId, d.reason);'
      + '  }'
      // Phase C — P2: Legal Hold Management
      + '  if (d.type === "phase-c-place-legal-hold") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-c-place-hold-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-c-place-hold-result", {result:{success:false,message:String(e)}}); })'
      + '      .placeLegalHold(d.token, d.params);'
      + '  }'
      + '  if (d.type === "phase-c-release-legal-hold") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-c-release-hold-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-c-release-hold-result", {result:{success:false,message:String(e)}}); })'
      + '      .releaseLegalHold(d.token, d.holdId, d.reason);'
      + '  }'
      + '  if (d.type === "phase-c-get-legal-holds") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-c-legal-holds-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-c-legal-holds-result", {result:{success:false,message:String(e)}}); })'
      + '      .getLegalHolds(d.token, d.filters);'
      + '  }'
      // Phase C — P2: Retention Compliance Audit
      + '  if (d.type === "phase-c-audit-retention") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-c-audit-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-c-audit-result", {result:{success:false,message:String(e)}}); })'
      + '      .auditRetentionCompliance(d.token);'
      + '  }'
      + '  if (d.type === "phase-c-get-audit-report") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-c-audit-report-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-c-audit-report-result", {result:{success:false,message:String(e)}}); })'
      + '      .getComplianceAuditReport(d.token, d.format);'
      + '  }'
      // Phase C — P2: Archive Integrity Verification
      + '  if (d.type === "phase-c-verify-integrity") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-c-integrity-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-c-integrity-result", {result:{success:false,message:String(e)}}); })'
      + '      .verifyArchiveIntegrity(d.token);'
      + '  }'
      // Phase C — P2: Retention Policy Documentation
      + '  if (d.type === "phase-c-get-retention-policy") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-c-policy-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-c-policy-result", {result:{success:false,message:String(e)}}); })'
      + '      .getRetentionPolicyDocument(d.token);'
      + '  }'
      + '  if (d.type === "phase-c-export-retention-policy") {'
      + '    google.script.run.withSuccessHandler(function(r) { ok("phase-c-export-policy-result", {result:r}); })'
      + '      .withFailureHandler(function(e) { ok("phase-c-export-policy-result", {result:{success:false,message:String(e)}}); })'
      + '      .exportRetentionPolicy(d.token, d.format);'
      + '  }'
      + '});'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(phaseAListenerHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Security event action — returns page that listens for event data via postMessage
  if (action === 'securityEvent') {
    var seListenerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
      + 'var PARENT_ORIGIN = ' + JSON.stringify(PARENT_ORIGIN) + ';'
      + 'window.top.postMessage({type:"gas-security-event-ready"}, PARENT_ORIGIN);'
      + 'window.addEventListener("message", function(evt) {'
      + '  if (evt.origin !== PARENT_ORIGIN) return;'
      + '  if (!evt.data || evt.data.type !== "security-event-report") return;'
      + '  google.script.run'
      + '    .processSecurityEvent(evt.data.eventType, evt.data.details);'
      + '});'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(seListenerHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Security event reporting — client-side defense layers report blocked attacks
  // Phase 7: URL-parameter path kept for backwards compatibility during migration
  var securityEvent = (e && e.parameter && e.parameter.securityEvent) || '';
  if (securityEvent) {
    var seCache = getEpochCache();

    // Global rate limit: max 50 security events per 5-minute window (all sources combined)
    // Uses a single key independent of clientIp — prevents bypass via IP rotation
    var seGlobalKey = 'se_ratelimit_global';
    var seGlobalAttempts = seCache.get(seGlobalKey);
    var seGlobalCount = seGlobalAttempts ? parseInt(seGlobalAttempts, 10) : 0;

    if (seGlobalCount < 50) {
      seCache.put(seGlobalKey, String(seGlobalCount + 1), 300);
      var seDetails = {};
      try { seDetails = JSON.parse((e.parameter.details || '{}').substring(0, 500)); } catch(ex) {}
      auditLog('security_event', clientIp || 'unknown', securityEvent.substring(0, 50), {
        details: seDetails,
        clientIp: clientIp,
        userAgent: (e && e.parameter && e.parameter.ua) || '',
        page: EMBED_PAGE_URL
      });
    } else if (seGlobalCount === 50) {
      seCache.put(seGlobalKey, String(seGlobalCount + 1), 300);
      auditLog('security_event_flood', 'system', 'Global rate limit reached', {
        message: 'Max 50 security events per 5 minutes — further events suppressed regardless of source IP',
        lastClientIp: clientIp,
        lastEvent: securityEvent.substring(0, 50),
        page: EMBED_PAGE_URL
      });
    }
    // Return minimal response — no app HTML needed
    var seHtml = '<!DOCTYPE html><html><body></body></html>';
    return HtmlService.createHtmlOutput(seHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Phase 7 cleanup: Legacy URL-parameter heartbeat (?heartbeat=TOKEN) and
  // sign-out (?signOut=TOKEN) routes removed. These are now handled by:
  //   - processHeartbeat() via google.script.run from action=heartbeat listener page
  //   - processSignOut() via google.script.run from action=signout listener page
  // The postMessage-based approach eliminates token-in-URL exposure (H-5, H-6).

  // URL-parameter token exchange (standard mode)
  if (AUTH_CONFIG.TOKEN_EXCHANGE_METHOD === 'url') {
    var exchangeToken = (e && e.parameter && e.parameter.exchangeToken) || "";
    if (exchangeToken) {
      var result;
      try {
        result = exchangeTokenForSession(exchangeToken);
      } catch (err) {
        var errMsg = err.message || String(err);
        Logger.log("Token exchange error: " + errMsg);
        // Surface specific misconfiguration errors so the admin sees what to fix
        var errorCode = "server_error";
        if (errMsg.indexOf('HMAC_SECRET') !== -1) errorCode = "hmac_secret_missing";
        result = { success: false, error: errorCode };
      }
      var payload = JSON.stringify({
            type: "gas-session-created",
            success: result.success,
            sessionToken: result.sessionToken || "",
            email: result.email || "",
            displayName: result.displayName || "",
            error: result.error || "",
            reason: result.reason || "",   // acl_unavailable sub-cause — dropped by the whitelist otherwise
            absoluteTimeout: result.absoluteTimeout || 0,
            messageKey: result.messageKey || "",
            role: result.role || "",
            permissions: result.permissions || [],
            version: VERSION   // lets the host pill mirror the live GAS version on fresh sign-ins (gas-auth-ok already carries it for returning users)
          });
      var exchangeHtml = '<!DOCTYPE html><html><body><script>'
        + 'try { window.top.postMessage(' + payload + ', ' + JSON.stringify(PARENT_ORIGIN) + '); } catch(e) {}'
        + '</' + 'script></body></html>';
      return HtmlService.createHtmlOutput(exchangeHtml)
        .setTitle(TITLE)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  // postMessage token exchange (HIPAA mode)
  if (AUTH_CONFIG.TOKEN_EXCHANGE_METHOD === 'postMessage' && !sessionToken) {
    var listenerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
      + 'window.addEventListener("message", function(e) {'
      + '  if (!e.data || e.data.type !== "exchange-token") return;'
      + '  var token = e.data.accessToken;'
      + '  if (!token) return;'
      + '  var nonce = e.data.nonce || "";'  // Phase 2: echo nonce back for verification
      + '  google.script.run'
      + '    .withSuccessHandler(function(result) {'
      + '      window.top.postMessage({'
      + '        type: "gas-session-created",'
      + '        success: result.success,'
      + '        sessionToken: result.sessionToken || "",'
      + '        email: result.email || "",'
      + '        displayName: result.displayName || "",'
      + '        error: result.error || "",'
      + '        reason: result.reason || "",'
      + '        absoluteTimeout: result.absoluteTimeout || 0,'
      + '        messageKey: result.messageKey || "",'
      + '        role: result.role || "",'
      + '        permissions: result.permissions || [],'
      + '        version: ' + JSON.stringify(VERSION) + ','   // host pill mirrors the live GAS version on fresh sign-ins
      + '        nonce: nonce'
      + '      }, ' + JSON.stringify(PARENT_ORIGIN) + ');'
      + '    })'
      + '    .withFailureHandler(function(err) {'
      + '      var code = "server_error";'
      + '      if (err && err.message && err.message.indexOf("HMAC_SECRET") !== -1) code = "hmac_secret_missing";'
      + '      window.top.postMessage({'
      + '        type: "gas-session-created",'
      + '        success: false,'
      + '        error: code,'
      + '        nonce: nonce'
      + '      }, ' + JSON.stringify(PARENT_ORIGIN) + ');'
      + '    })'
      + '    .exchangeTokenForSession(token);'
      + '});'
      + 'window.top.postMessage({ type: "gas-ready-for-token" }, ' + JSON.stringify(PARENT_ORIGIN) + ');'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(listenerHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // ── Page nonce validation ──
  // The page_nonce is a one-time-use token generated by generatePageNonce()
  // via the action=getNonce listener page. It binds a validated session to a
  // single page load without ever exposing the session token in the URL.
  var pageNonce = (e && e.parameter && e.parameter.page_nonce) || '';
  if (pageNonce) {
    sessionToken = validatePageNonce(pageNonce) || '';
  }

  // Normal flow: validate session token (from page_nonce or ?session= parameter)
  var session = validateSession(sessionToken);

  if (session.status !== "authorized") {
    var evReason = session.evictionReason || '';
    var authHtml = '<!DOCTYPE html><html><body><script>'
      + 'window.top.postMessage({type:"gas-needs-auth",authStatus:"' + escapeJs(session.status) + '",email:"' + escapeJs(session.email || '') + '",version:"' + escapeJs(VERSION) + '",evictionReason:"' + escapeJs(evReason) + '"}, ' + JSON.stringify(PARENT_ORIGIN) + ');'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(authHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Retrieve messageKey from session data for signing outgoing messages
  var appMsgKey = '';
  try {
    var appCache = getEpochCache();
    var appRaw = appCache.get("session_" + sessionToken);
    if (appRaw) { appMsgKey = JSON.parse(appRaw).messageKey || ''; }
  } catch(e) {}


  // Admin role detection for conditional admin UI
  var isAdmin = (session.role === 'admin');
  var sessionTokenForAdmin = isAdmin ? sessionToken : '';

  // PROJECT: dossier slug prefill — the Profiler page embeds this app per-dossier
  // and passes ?slug=<company>; sanitized to slug charset before interpolation
  var prefillSlug = String((e && e.parameter && e.parameter.slug) || '').toLowerCase().replace(/[^a-z0-9-]/g, '');

  // Session valid — build the authenticated app UI
  var html = `
    <html>
    <head>
      <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
      <meta http-equiv="Pragma" content="no-cache">
      <meta http-equiv="Expires" content="0">
      <style>
        html, body { height: 100%; margin: 0; overflow: hidden; }
        body { font-family: sans-serif; background: #bdbdbd; }  /* shows through the 30px top/bottom bands around the app surface */
        /* PROJECT START — Add your project-specific styles here */
        #fi-app { max-width: 560px; margin: 0 auto; padding: 8px 4px 24px; }
        .fi-title { font-size: 20px; margin: 0 0 4px; }
        .fi-sub { font-size: 12.5px; opacity: 0.75; margin: 0 0 18px; }
        .fi-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.8; margin: 14px 0 5px; }
        #fi-app select, #fi-app textarea {
          width: 100%; box-sizing: border-box; padding: 9px 11px; font: inherit; font-size: 14px;
          background: rgba(255,255,255,0.06); color: inherit; border: 1px solid rgba(255,255,255,0.25); border-radius: 8px;
        }
        #fi-app textarea { resize: vertical; }
        #fi-conf { width: 100%; margin: 6px 0 2px; }
        .fi-conf-hints { display: flex; justify-content: space-between; font-size: 10px; opacity: 0.6; margin-bottom: 16px; }
        #fi-submit {
          padding: 11px 22px; font: inherit; font-size: 14px; font-weight: bold; cursor: pointer;
          background: #d8b45a; color: #13151c; border: none; border-radius: 8px;
        }
        #fi-submit:disabled { opacity: 0.45; cursor: default; }
        #fi-status { margin-top: 12px; font-size: 13px; min-height: 1.4em; }
        #fi-status.ok { color: #82b56d; } #fi-status.err { color: #e07a8b; }
        #fi-files { width: 100%; box-sizing: border-box; font: inherit; font-size: 12.5px; padding: 8px 0 2px; color: inherit; }
        #fi-file-list { font-size: 12px; opacity: 0.75; margin: 4px 0 0; }
        #fi-manage { margin-top: 26px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 14px; }
        #fi-manage-toggle {
          background: none; border: 1px solid rgba(255,255,255,0.25); border-radius: 8px;
          color: inherit; font: inherit; font-size: 13px; padding: 8px 14px; cursor: pointer;
        }
        .fi-note-row { border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 12px; margin-top: 10px; font-size: 13px; }
        .fi-note-meta { font-size: 11px; opacity: 0.65; margin-bottom: 4px; }
        .fi-note-text { white-space: pre-wrap; word-break: break-word; }
        .fi-note-actions { margin-top: 8px; display: flex; gap: 8px; }
        .fi-note-actions button {
          background: none; border: 1px solid rgba(255,255,255,0.25); border-radius: 6px;
          color: inherit; font: inherit; font-size: 12px; padding: 5px 12px; cursor: pointer;
        }
        .fi-note-actions button.fi-del { border-color: rgba(224,122,139,0.6); color: #e07a8b; }
        .fi-edit-area textarea { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 8px 10px; font: inherit; font-size: 13px; background: rgba(255,255,255,0.06); color: inherit; border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; }
        .fi-edit-area select { margin-top: 6px; padding: 6px 8px; font: inherit; font-size: 12px; background: rgba(255,255,255,0.06); color: inherit; border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; }
        /* PROJECT END */
        /* App surface inset 30px top/bottom: the GAS layer spans the full screen, but the app
           UI/background lives between the bands — only overlay chrome (version pill, signed-in
           email, usable-area readout) occupies the exposed strips. Projects restyle background/
           color freely; keep the insets so the framing matches the other apps */
        #main-content { position: fixed; top: 30px; left: 0; right: 0; bottom: 30px; overflow: auto; background: #fff; color: #000; }
        #version { position: fixed; bottom: 9px; left: 8px; z-index: 9999; color: #1565c0; font-size: 12px; margin: 0; font-family: monospace; opacity: 0.8; }
        /* Signed-in email is a flex row in the top band: the live pills nest inside it
           so they sit immediately after the username and track its width automatically.
           Color/opacity live on #user-email-text so the pills stay full-strength. */
        #user-email { position: fixed; top: 3px; left: 8px; z-index: 9999; display: flex; align-items: center; gap: 10px; font-size: 11px; font-family: monospace; }
        #user-email-text { color: #666; opacity: 0.7; }
        /* Discreet usable-area readout: live width×height of the app viewport. Sits on the
           bottom band, left of the HOST page's pill stack (which owns the bottom-right corner
           at right:22px with pills stacked up to ~86px high) */
        #app-dims { position: fixed; right: 185px; bottom: 10px; z-index: 9000; color: #888; font: 10px/1 monospace; opacity: 0.7; pointer-events: none; }
        /* Live sync + viewer presence pills — poll countdown + who is viewing.
           Not independently positioned: they live inside the #user-email flex row in the
           top spacer band, immediately after the signed-in username, and stay clear of
           the app area and the HOST page's signed-in pill (top-right, z-index 10012). */
        #live-status-bar { display: flex; align-items: center; gap: 6px; font-family: Arial, sans-serif; }
        .dt-live { display:inline-flex; align-items:center; gap:5px; font-size:11px; color:#8b949e; background:#0d1117; border:1px solid #30363d; border-radius:20px; padding:3px 9px; white-space:nowrap; }
        .dt-live-dot { width:8px; height:8px; border-radius:50%; background:#3fb950; }
        .dt-live.off .dt-live-dot { background:#d29922; }
        .dt-live #dt-live-lbl { color:#e6edf3; font-weight:600; }
        .dt-live .dt-live-sub { color:#6e7681; }
        .dt-presence { position:relative; display:inline-flex; align-items:center; gap:5px; font-size:11px; color:#8b949e; background:#0d1117; border:1px solid #30363d; border-radius:20px; padding:3px 9px; white-space:nowrap; cursor:default; }
        .dt-presence .dt-pres-ico { font-size:12px; }
        .dt-presence #dt-pres-count { color:#e6edf3; font-weight:600; }
        .dt-pres-pop { position:absolute; top:100%; left:0; margin-top:6px; min-width:190px; max-height:280px; overflow:auto; background:#161b22; border:1px solid #30363d; border-radius:8px; padding:6px; z-index:60; box-shadow:0 6px 20px rgba(0,0,0,.45); display:none; }
        .dt-presence:hover .dt-pres-pop, .dt-presence.open .dt-pres-pop { display:block; }
        .dt-pres-row { display:flex; align-items:center; gap:7px; padding:4px 7px; border-radius:5px; font-size:12px; color:#c9d1d9; white-space:nowrap; }
        .dt-pres-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; }
        .dt-pres-dot.active { background:#3fb950; }
        .dt-pres-dot.away { background:#d29922; }
        .dt-pres-you { color:#6e7681; }
        .dt-pres-empty { padding:6px 8px; color:#6e7681; font-size:11px; }
        ${isAdmin ? `
        /* Admin panel styles */
        #admin-badge { position: fixed; top: 7px; left: 12px; z-index: 100; background: rgba(0,0,0,0.55); padding: 3px 8px; border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; font: 10px/1 monospace; text-transform: uppercase; letter-spacing: 0.5px; color: #90caf9; cursor: pointer; opacity: 0.6; transition: opacity 0.2s; }
        #admin-dropdown-gas { display: none; position: fixed; top: 31px; left: 12px; z-index: 101; background: rgba(20,20,30,0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 4px 0; min-width: 140px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
        #admin-dropdown-gas button { display: block; width: 100%; text-align: left; padding: 6px 12px; background: none; border: none; color: #90caf9; cursor: pointer; font: 11px/1.4 monospace; white-space: nowrap; }
        #admin-dropdown-gas button:hover { background: rgba(144,202,249,0.1); color: #fff; }
        #admin-panel-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 200; background: rgba(0,0,0,0.6); }
        #admin-panel { position: fixed; top: 40px; left: 8px; z-index: 201; background: rgba(20,20,30,0.98); color: #ccc; border: 1px solid #444; border-radius: 8px; font: 12px/1.4 monospace; width: 480px; max-width: calc(100vw - 16px); max-height: calc(100vh - 80px); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
        #admin-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #444; flex-shrink: 0; }
        #admin-panel-header .admin-title { color: #90caf9; font-weight: bold; font-size: 13px; }
        #admin-panel-close { background: none; border: none; color: #999; cursor: pointer; font-size: 16px; padding: 0 4px; }
        #admin-panel-close:hover { color: #fff; }
        #admin-nav { display: flex; border-bottom: 1px solid #333; padding: 4px 8px; gap: 4px; flex-shrink: 0; }
        .admin-tab { background: none; border: 1px solid #555; color: #90caf9; cursor: pointer; font: 10px/1 monospace; padding: 3px 8px; border-radius: 3px; }
        .admin-tab:hover { background: rgba(144,202,249,0.1); }
        .admin-tab.active { background: rgba(144,202,249,0.15); border-color: #90caf9; }
        #admin-menu-gas { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 8px; border-bottom: 1px solid #333; flex-shrink: 0; }
        .admin-menu-btn { background: none; border: none; color: #90caf9; cursor: pointer; font: 11px/1 monospace; padding: 2px 6px; }
        .admin-menu-btn:hover { color: #fff; text-decoration: underline; }
        .admin-menu-btn.active { color: #fff; font-weight: bold; }
        #admin-content { flex: 1; overflow-y: auto; padding: 10px 12px; }
        .pa-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 8px; }
        .pa-title { color: #90caf9; font-weight: bold; font-size: 13px; }
        .pa-action { border: 1px solid #90caf9; color: #90caf9; background: none; cursor: pointer; font: 10px/1 monospace; padding: 2px 8px; border-radius: 3px; }
        .pa-action:hover { background: rgba(144,202,249,0.1); }
        .pa-body { margin-top: 8px; }
        .pa-body label { display: block; color: #aaa; font-size: 11px; margin: 8px 0 4px; }
        .pa-body input, .pa-body textarea, .pa-body select { width: 100%; background: rgba(255,255,255,0.08); border: 1px solid #555; color: #eee; padding: 6px 8px; border-radius: 4px; font: 12px monospace; box-sizing: border-box; }
        .pa-body textarea { resize: vertical; }
        .pa-format-picker { margin: 8px 0; }
        .pa-format-picker label { display: inline; margin-right: 12px; color: #ccc; font-size: 12px; }
        .pa-status { color: #999; font-size: 11px; margin-top: 8px; text-align: center; }
        .pa-empty { color: #888; font-size: 11px; text-align: center; padding: 16px 0; }
        .pa-card { background: rgba(255,255,255,0.05); border: 1px solid #444; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
        .pa-card-header { color: #90caf9; font-weight: bold; font-size: 11px; }
        .pa-card-meta { color: #888; font-size: 10px; margin: 4px 0; }
        .pa-card-field { font-size: 11px; margin: 4px 0; }
        .pa-card-field strong { color: #aaa; }
        .pa-card-actions { margin-top: 8px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .pa-approve { border: 1px solid #66bb6a; color: #66bb6a; background: none; cursor: pointer; font: 10px/1 monospace; padding: 2px 8px; border-radius: 3px; }
        .pa-approve:hover { background: rgba(102,187,106,0.15); }
        .pa-deny { border: 1px solid #ef5350; color: #ef5350; background: none; cursor: pointer; font: 10px/1 monospace; padding: 2px 8px; border-radius: 3px; }
        .pa-deny:hover { background: rgba(239,83,80,0.15); }
        .pa-deny-reason { width: 100%; background: rgba(255,255,255,0.08); border: 1px solid #555; color: #eee; padding: 4px 6px; border-radius: 3px; font: 10px monospace; margin-top: 4px; display: none; }
        .asp-session { background: rgba(255,255,255,0.05); border: 1px solid #333; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
        .asp-session.asp-self { border-color: #1565c0; }
        .asp-session.asp-emergency { border-color: #ef5350; }
        .asp-role-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; text-transform: uppercase; background: rgba(255,255,255,0.1); color: #90caf9; }
        .asp-meta { color: #888; font-size: 10px; margin: 4px 0; }
        .asp-kick { background: none; border: 1px solid #ef5350; color: #ef5350; cursor: pointer; font: 10px/1 monospace; padding: 2px 8px; border-radius: 3px; margin-top: 6px; }
        .asp-kick:hover { background: rgba(239,83,80,0.15); }
        ` : ''}
      </style>
    </head>
    <body>
      <h2 id="version">${escapeHtml(VERSION)}</h2>
      <div id="user-email">
        <span id="user-email-text">${escapeHtml(session.email)}</span>
        <!-- Live sync + viewer presence pills (template) — anchored right after the username -->
        <div id="live-status-bar">
          <div class="dt-live" id="dt-live" title="Live multi-user sync — others' changes appear automatically"><span class="dt-live-dot"></span><span id="dt-live-lbl">Live</span><span class="dt-live-sub" id="dt-live-since"></span><span class="dt-live-sub">|</span><span class="dt-live-sub" id="dt-live-next">▷ --</span></div>
          <div class="dt-presence" id="dt-presence" title="People currently viewing this app — green = active, amber = away (window not focused). Hover for the list."><span class="dt-pres-ico">👥</span><span id="dt-pres-count">–</span><span class="dt-pres-pop" id="dt-pres-pop"></span></div>
        </div>
      </div>
      <!-- GAS toggle moved to HTML layer for full iframe hide/show
      <button id="gas-layer-toggle" onclick="window._toggleGasLayer()" style="position:fixed;bottom:7px;left:135px;z-index:9999;background:rgba(0,0,0,0.55);color:#ccc;border:1px solid rgba(255,255,255,0.2);padding:3px 8px;border-radius:10px;font:10px/1 monospace;cursor:pointer;opacity:0.6;transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">GAS</button>
      -->
      ${isAdmin ? `
      <div id="admin-badge" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">ADMIN &#x25BE;</div>
      <div id="admin-dropdown-gas">
        <button data-admin-panel="sessions">Sessions</button>
        <button data-admin-panel="disclosures">Disclosures</button>
        <button data-admin-panel="data-export">My Data</button>
        <button data-admin-panel="amendment">Correction</button>
        <button data-admin-panel="amendment-review">Amendments</button>
        <button data-admin-panel="disagreement">Disagree</button>
        <button data-admin-panel="extension">Extensions</button>
        <button data-admin-panel="denial-notice">Denial Notice</button>
        <button data-admin-panel="ehr-disclosures">EHR Disclosures</button>
        <button data-admin-panel="breach-log">Breach Log</button>
        <button data-admin-panel="representatives">Representatives</button>
        <button data-admin-panel="legal-holds">Legal Holds</button>
        <button data-admin-panel="compliance-audit">Compliance Audit</button>
        <button data-admin-panel="archive-integrity">Archive Integrity</button>
        <button data-admin-panel="retention-policy">Retention Policy</button>
      </div>
      <div id="admin-panel-overlay">
        <div id="admin-panel">
          <div id="admin-panel-header">
            <span class="admin-title">Admin Tools</span>
            <button id="admin-panel-close">&times;</button>
          </div>
          <div id="admin-content">
            <div id="admin-loading" class="pa-empty">Select a tool from the admin menu.</div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- App surface (template): project content renders inside the inset framing -->
      <div id="main-content">
        <!-- PROJECT START — Add your project-specific content here -->
        <div id="fi-app">
          <h2 class="fi-title">📝 New Field Note</h2>
          <p class="fi-sub">Stored verbatim in the Profiler's public field-note log; a Claude triage pass decides dossier promotion later. Don't include NDA'd or personally identifying details.</p>
          <label class="fi-label" for="fi-company">Company</label>
          <select id="fi-company" disabled><option>Loading companies…</option></select>
          <label class="fi-label" for="fi-source">How you learned it</label>
          <select id="fi-source" disabled></select>
          <label class="fi-label" for="fi-note">What you learned</label>
          <textarea id="fi-note" rows="6" maxlength="4000" placeholder="e.g. Met their NA sales lead at RE+ — pushing the new PSU line hard into data centers next quarter."></textarea>
          <label class="fi-label" for="fi-files">Meeting notes file (optional — Word or PDF, up to 3, 8&nbsp;MB each)</label>
          <input id="fi-files" type="file" accept=".pdf,.doc,.docx" multiple>
          <div id="fi-file-list"></div>
          <label class="fi-label" for="fi-conf">Your confidence in this information: <b id="fi-conf-val">70</b>/100</label>
          <input id="fi-conf" type="range" min="0" max="100" step="5" value="70">
          <div class="fi-conf-hints"><span>0 · rumor</span><span>50 · plausible</span><span>100 · certain</span></div>
          <button id="fi-submit" type="button" disabled>Save note</button>
          <div id="fi-status" role="status"></div>
          <div id="fi-manage">
            <button id="fi-manage-toggle" type="button">Manage existing notes ▸</button>
            <div id="fi-manage-list" style="display:none"></div>
          </div>
        </div>
        <!-- PROJECT END -->
      </div>
      <span id="app-dims"></span>

      <script>
        // PostMessage handshake guard: verify we are embedded in the correct parent page.
        // Only runs on the ?session= path. Skipped on the ?page_nonce= path because
        // nonces are one-time-use — a copied nonce URL is already useless.
        var _loadedViaNonce = ${pageNonce ? 'true' : 'false'};
        if (!_loadedViaNonce) {
          document.body.style.visibility = 'hidden';
          var _hsId = Math.random().toString(36).substring(2) + Date.now().toString(36);
          var _hsOk = false;
          window.addEventListener('message', function(ev) {
            if (ev.data && ev.data.type === 'frame-handshake-response' && ev.data.handshakeId === _hsId) {
              _hsOk = true;
              document.body.style.visibility = 'visible';
            }
          });
          window.top.postMessage({type: 'frame-handshake-challenge', handshakeId: _hsId}, '${PARENT_ORIGIN}');
          setTimeout(function() {
            if (!_hsOk) {
              document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial;color:#666;"><p>Access denied. This application must be accessed through its authorized embedding page.</p></div>';
              document.body.style.visibility = 'visible';
            }
          }, 2000);
        }

        // Session token for data operation validation (Phase 3)
        var _sessionToken = '${escapeJs(sessionToken)}';
        // DJB2→HMAC migration complete: _s() and _mk removed.
        // All message signing now happens server-side via signAppMessage()
        // (called through google.script.run — same pattern as Phase 7 heartbeat/signout).

        // Phase 3 (C-3): Client IP collection removed — ipify.org lacks BAA coverage.
        // To re-enable, uncomment below and set AUTH_CONFIG.ENABLE_IP_LOGGING = true:
        // var _clientIp = '';
        // function _valIp(v) {
        //   if (!v || typeof v !== 'string') return 'unknown';
        //   var t = v.trim().substring(0, 45);
        //   if (/^(\\d{1,3}\\.){3}\\d{1,3}$/.test(t) || /^[0-9a-fA-F:]+$/.test(t)) return t;
        //   return 'invalid';
        // }
        // if (${AUTH_CONFIG.ENABLE_IP_LOGGING}) {
        //   try {
        //     var _ipXhr = new XMLHttpRequest();
        //     _ipXhr.open('GET', 'https://api.ipify.org?format=text', true);
        //     _ipXhr.timeout = 5000;
        //     _ipXhr.onload = function() { if (_ipXhr.status === 200) _clientIp = _valIp(_ipXhr.responseText); };
        //     _ipXhr.onerror = function() { _clientIp = 'unknown'; };
        //     _ipXhr.ontimeout = function() { _clientIp = 'unknown'; };
        //     _ipXhr.send();
        //   } catch(e) { _clientIp = 'unknown'; }
        // }

        // Notify wrapper that auth is OK — send immediately so the host page
        // can show the app without waiting for the async google.script.run call.
        window.top.postMessage({type: 'gas-auth-ok', version: '${escapeJs(VERSION)}',
          needsReauth: ${session.needsReauth || false},
          messageKey: '${escapeJs(appMsgKey)}',
          role: '${escapeJs(session.role || RBAC_DEFAULT_ROLE)}',
          permissions: ${JSON.stringify(session.permissions || getRolesFromSpreadsheet()[session.role] || getRolesFromSpreadsheet()[RBAC_DEFAULT_ROLE])}}, '${PARENT_ORIGIN}');

        // Also send a signed version via google.script.run (belt-and-suspenders)
        google.script.run
          .withSuccessHandler(function(signed) {
            window.top.postMessage(signed, '${PARENT_ORIGIN}');
          })
          .withFailureHandler(function(err) {
            // Fallback: send unsigned gas-auth-ok so the host page at least knows
            // the session is valid (verification will pass because no key is set yet)
            window.top.postMessage({type: 'gas-auth-ok', version: '${escapeJs(VERSION)}',
              needsReauth: ${session.needsReauth || false},
              messageKey: '${escapeJs(appMsgKey)}',
              role: '${escapeJs(session.role || RBAC_DEFAULT_ROLE)}',
              permissions: ${JSON.stringify(session.permissions || getRolesFromSpreadsheet()[session.role] || getRolesFromSpreadsheet()[RBAC_DEFAULT_ROLE])}}, '${PARENT_ORIGIN}');
          })
          .signAppMessage(_sessionToken, 'gas-auth-ok');

        window.addEventListener('message', function(e) {
          // Phase 3: IP receiver removed — uncomment to re-enable
          // if (e.data && e.data.type === 'host-client-ip') {
          //   _clientIp = _valIp(e.data.ip);
          // }
          if (e.data && e.data.type === 'gas-version-check') {
            // DJB2→HMAC migration: signed server-side via signAppMessage()
            google.script.run
              .withSuccessHandler(function(signed) {
                top.postMessage(signed, '${PARENT_ORIGIN}');
              })
              .withFailureHandler(function() {
                // Don't send an unsigned response — the version poll is periodic and will retry.
                // A missing response is safer than an unsigned one that gets dropped by HMAC verify.
              })
              .signAppMessage(_sessionToken, 'gas-version');
          }
        });

        // Usable-area readout (template): live width×height of the app viewport,
        // updated on resize and device rotation
        (function () {
          function updDims() {
            var el = document.getElementById('app-dims');
            if (el) el.textContent = (window.innerWidth || 0) + '×' + (window.innerHeight || 0);
          }
          window.addEventListener('resize', updDims);
          window.addEventListener('orientationchange', updDims);
          updDims();
        })();

        // Activity detection — notify host page on user interaction so it can
        // trigger an immediate heartbeat (catches expired sessions before data loss)
        // DJB2→HMAC migration: signed server-side via signAppMessage()
        var _lastActivityNotify = 0;
        var _pendingActivity = false;
        function _notifyActivity() {
          var now = Date.now();
          if (now - _lastActivityNotify < 5000) return; // 5s debounce
          if (_pendingActivity) return; // Prevent stacking server calls
          _lastActivityNotify = now;
          _pendingActivity = true;
          google.script.run
            .withSuccessHandler(function(signed) {
              _pendingActivity = false;
              window.top.postMessage(signed, '${PARENT_ORIGIN}');
            })
            .withFailureHandler(function() {
              _pendingActivity = false;
              // Silently drop — next activity event will retry
            })
            .signAppMessage(_sessionToken, 'gas-user-activity');
        }
        document.addEventListener('keydown', _notifyActivity, true);
        document.addEventListener('click', _notifyActivity, true);
        document.addEventListener('input', _notifyActivity, true);

        // GAS layer visibility toggle
        (function() {
          var _gasLayerVisible = true;
          var _gasLayerEls = ['version', 'user-email', 'main-content', 'app-dims', 'admin-badge', 'admin-dropdown-gas', 'admin-panel-overlay', 'live-status-bar'];
          window._toggleGasLayer = function() {
            _gasLayerVisible = !_gasLayerVisible;
            var btn = document.getElementById('gas-layer-toggle');
            _gasLayerEls.forEach(function(id) {
              var el = document.getElementById(id);
              if (!el) return;
              el.style.display = _gasLayerVisible ? '' : 'none';
            });
            if (btn) {
              btn.textContent = _gasLayerVisible ? 'GAS' : 'GAS \\u25CB';
              btn.style.borderColor = _gasLayerVisible ? 'rgba(255,255,255,0.2)' : '#58a6ff';
            document.body.style.background = _gasLayerVisible ? '' : 'transparent';
            }
          };
        })();

        // Admin panel logic (only included for admin users)
        ${isAdmin ? `
        (function() {
          var _adminToken = '${escapeJs(sessionTokenForAdmin)}';
          var _adminPanelOpen = false;
          var _activeAdminPanel = null;

          function _escA(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

          function _setStatus(elId, msg, color) {
            var el = document.getElementById(elId);
            if (el) { el.textContent = msg; if (color) el.style.color = color; }
          }

          function _gasCall(fn, args, onOk, onErr) {
            var r = google.script.run.withSuccessHandler(onOk || function(){}).withFailureHandler(onErr || function(e){ console.error('Admin GAS error:', e); });
            r[fn].apply(r, args);
          }

          // Admin badge toggle dropdown
          document.getElementById('admin-badge').addEventListener('click', function(e) {
            e.stopPropagation();
            var dd = document.getElementById('admin-dropdown-gas');
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
          });
          document.addEventListener('click', function(e) {
            var dd = document.getElementById('admin-dropdown-gas');
            if (dd && !dd.contains(e.target) && e.target.id !== 'admin-badge') dd.style.display = 'none';
          });

          // Dropdown button click → open panel
          var ddBtns = document.querySelectorAll('#admin-dropdown-gas button');
          for (var i = 0; i < ddBtns.length; i++) {
            ddBtns[i].addEventListener('click', function() {
              document.getElementById('admin-dropdown-gas').style.display = 'none';
              _openAdminPanel(this.getAttribute('data-admin-panel'));
            });
          }

          // Close panel
          document.getElementById('admin-panel-close').addEventListener('click', function() {
            document.getElementById('admin-panel-overlay').style.display = 'none';
            _adminPanelOpen = false;
            _activeAdminPanel = null;
          });
          document.getElementById('admin-panel-overlay').addEventListener('click', function(e) {
            if (e.target === this) {
              this.style.display = 'none';
              _adminPanelOpen = false;
              _activeAdminPanel = null;
            }
          });

          function _openAdminPanel(panelId) {
            _activeAdminPanel = panelId;
            _adminPanelOpen = true;
            document.getElementById('admin-panel-overlay').style.display = 'block';
            var content = document.getElementById('admin-content');
            content.innerHTML = _getAdminPanelHtml(panelId);
            _attachAdminListeners(panelId);
            _loadAdminData(panelId);
          }

          function _loadAdminData(id) {
            switch(id) {
              case 'sessions': _loadSessions(); break;
              case 'disclosures': _loadDisclosures(); break;
              case 'amendment-review': _loadPendingAmendments(); break;
              case 'ehr-disclosures': _loadEhrDisclosures(); break;
              case 'breach-log': _loadBreachLog(); break;
              case 'representatives': _loadRepresentatives(); break;
              case 'legal-holds': _loadLegalHolds(); break;
            }
          }

          // Sessions loader
          function _loadSessions() {
            var el = document.getElementById('admin-session-list');
            if (el) el.innerHTML = '<div class="pa-status">Loading sessions...</div>';
            _gasCall('listActiveSessions', [_adminToken], function(r) { _renderSessions(r); });
          }
          function _renderSessions(sessions) {
            var list = document.getElementById('admin-session-list');
            if (!list) return;
            if (!sessions || sessions.length === 0) { list.innerHTML = '<div class="pa-empty">No active sessions found.</div>'; return; }
            var html = '';
            for (var i = 0; i < sessions.length; i++) {
              var s = sessions[i];
              var selfClass = s.isSelf ? ' asp-self' : '';
              var selfLabel = s.isSelf ? ' (you)' : '';
              html += '<div class="asp-session' + selfClass + '">';
              html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
              html += '<strong style="color:#ccc;font-size:11px;">' + _escA(s.email || '') + selfLabel + '</strong>';
              html += '<span class="asp-role-badge">' + _escA(s.role || '') + '</span>';
              html += '</div>';
              html += '<div class="asp-meta">Created: ' + _escA(s.createdAt ? new Date(s.createdAt).toLocaleString() : '') + '</div>';
              html += '<div class="asp-meta">Last activity: ' + _escA(s.lastActivity ? new Date(s.lastActivity).toLocaleString() : '') + '</div>';
              if (!s.isSelf) {
                html += '<button class="asp-kick" data-kick-email="' + _escA(s.email) + '">Sign Out User</button>';
              }
              html += '</div>';
            }
            list.innerHTML = html;
            var kickBtns = list.querySelectorAll('.asp-kick');
            for (var k = 0; k < kickBtns.length; k++) {
              kickBtns[k].addEventListener('click', function() {
                var email = this.getAttribute('data-kick-email');
                this.textContent = 'Signing out...';
                this.disabled = true;
                _gasCall('adminSignOutUser', [_adminToken, email], function(r) {
                  if (r && r.success) { setTimeout(function(){ _loadSessions(); }, 500); }
                });
              });
            }
          }

          // HIPAA data loaders (same as Phase 1 but using google.script.run directly)
          function _loadDisclosures() {
            var el = document.getElementById('disclosure-list'); if(el) el.innerHTML = '';
            var empty = document.getElementById('disclosure-empty'); if(empty) empty.style.display = 'none';
            var period = document.getElementById('disclosure-period'); if(period) period.textContent = 'Loading disclosures (6-year lookback)...';
            var grouped = document.getElementById('disclosure-grouped-toggle');
            if (grouped && grouped.checked) {
              _gasCall('getGroupedDisclosureAccounting', [_adminToken], function(r) { _renderDisclosures(r); });
            } else {
              _gasCall('getDisclosureAccounting', [_adminToken], function(r) { _renderDisclosures(r); });
            }
          }
          function _loadPendingAmendments() {
            var el = document.getElementById('amend-review-list'); if(el) el.innerHTML = '';
            var empty = document.getElementById('amend-review-empty'); if(empty) empty.style.display = 'none';
            _gasCall('getPendingAmendments', [_adminToken], function(r) { _renderPendingAmendments(r); });
          }
          function _loadEhrDisclosures() {
            var el = document.getElementById('ehr-list'); if(el) el.innerHTML = '';
            var empty = document.getElementById('ehr-empty'); if(empty) empty.style.display = 'none';
            var period = document.getElementById('ehr-period'); if(period) period.textContent = 'Loading EHR TPO disclosures (3-year lookback)...';
            _gasCall('getDisclosureAccounting', [_adminToken, null, {includeEhrTpo: true}], function(r) { _renderEhrDisclosures(r); });
          }
          function _loadBreachLog() {
            var el = document.getElementById('breach-log-list'); if(el) el.innerHTML = '';
            var empty = document.getElementById('breach-empty'); if(empty) empty.style.display = 'none';
            _gasCall('getBreachLog', [_adminToken], function(r) { _renderBreachLog(r); });
          }
          function _loadRepresentatives() {
            var el = document.getElementById('rep-list'); if(el) el.innerHTML = '';
            var empty = document.getElementById('rep-empty'); if(empty) empty.style.display = 'none';
            _gasCall('getPersonalRepresentatives', [_adminToken], function(r) { _renderRepresentatives(r); });
          }
          function _loadLegalHolds() {
            var el = document.getElementById('lh-list'); if(el) el.innerHTML = '';
            var empty = document.getElementById('lh-empty'); if(empty) empty.style.display = 'none';
            var filter = document.getElementById('lh-status-filter');
            _gasCall('getLegalHolds', [_adminToken, filter ? {status: filter.value} : {}], function(r) { _renderLegalHolds(r); });
          }

          // Render functions
          function _renderDisclosures(result) {
            var container = document.getElementById('disclosure-list');
            var empty = document.getElementById('disclosure-empty');
            var period = document.getElementById('disclosure-period');
            if (!result || !result.success) { if(container) container.innerHTML = '<div style="color:#ef5350">Error: ' + _escA(result ? result.message : 'No response') + '</div>'; return; }
            if(period) period.textContent = result.period || '';
            if (!result.items || result.items.length === 0) { if(empty) empty.style.display = ''; return; }
            var html = '';
            for (var i = 0; i < result.items.length; i++) {
              var d = result.items[i];
              html += '<div class="pa-card"><div class="pa-card-header">' + _escA(d.recipient || 'Unknown') + '</div>';
              html += '<div class="pa-card-meta">' + _escA(d.date || '') + '</div>';
              html += '<div class="pa-card-field"><strong>Purpose:</strong> ' + _escA(d.purpose || '') + '</div>';
              if (d.description) html += '<div class="pa-card-field">' + _escA(d.description) + '</div>';
              if (d.count) html += '<div class="pa-card-field"><strong>Occurrences:</strong> ' + _escA(d.count) + '</div>';
              html += '</div>';
            }
            if(container) container.innerHTML = html;
          }
          function _renderEhrDisclosures(result) {
            var container = document.getElementById('ehr-list');
            var empty = document.getElementById('ehr-empty');
            var period = document.getElementById('ehr-period');
            if (!result || !result.success) { if(container) container.innerHTML = '<div style="color:#ef5350">Error: ' + _escA(result ? result.message : 'No response') + '</div>'; return; }
            if(period) period.textContent = result.period || '';
            if (!result.items || result.items.length === 0) { if(empty) empty.style.display = ''; return; }
            var html = '';
            for (var i = 0; i < result.items.length; i++) {
              var d = result.items[i];
              html += '<div class="pa-card"><div class="pa-card-header">' + _escA(d.recipient || 'Unknown') + '</div>';
              html += '<div class="pa-card-meta">' + _escA(d.date || '') + ' \\u2014 ' + _escA(d.purpose || 'TPO') + '</div>';
              if (d.description) html += '<div class="pa-card-field">' + _escA(d.description) + '</div>';
              html += '</div>';
            }
            if(container) container.innerHTML = html;
          }
          function _renderPendingAmendments(result) {
            var container = document.getElementById('amend-review-list');
            var empty = document.getElementById('amend-review-empty');
            if (!result || !result.success) { if(container) container.innerHTML = '<div style="color:#ef5350">Error: ' + _escA(result ? result.message : 'No response') + '</div>'; return; }
            if (!result.items || result.items.length === 0) { if(empty) empty.style.display = ''; return; }
            var html = '';
            for (var i = 0; i < result.items.length; i++) {
              var a = result.items[i];
              html += '<div class="pa-card"><div class="pa-card-header">Amendment #' + _escA(a.id || '') + '</div>';
              html += '<div class="pa-card-meta">Requested: ' + _escA(a.date || '') + ' by ' + _escA(a.requestor || '') + '</div>';
              html += '<div class="pa-card-field"><strong>Record:</strong> ' + _escA(a.recordId || '') + '</div>';
              html += '<div class="pa-card-field"><strong>Proposed:</strong> ' + _escA(a.proposed || '') + '</div>';
              if (a.reason) html += '<div class="pa-card-field"><strong>Reason:</strong> ' + _escA(a.reason) + '</div>';
              html += '<div class="pa-card-actions">';
              html += '<button class="pa-approve" data-amend-id="' + _escA(a.id) + '">Approve</button>';
              html += '<button class="pa-deny" data-amend-id="' + _escA(a.id) + '">Deny</button>';
              html += '<textarea class="pa-deny-reason" data-amend-id="' + _escA(a.id) + '" placeholder="Reason for denial"></textarea>';
              html += '</div></div>';
            }
            if(container) container.innerHTML = html;
            var appBtns = container.querySelectorAll('.pa-approve');
            for (var j = 0; j < appBtns.length; j++) {
              appBtns[j].addEventListener('click', function() {
                _gasCall('reviewAmendment', [_adminToken, this.getAttribute('data-amend-id'), 'Approved', ''], function() { _loadPendingAmendments(); });
              });
            }
            var denBtns = container.querySelectorAll('.pa-deny');
            for (var k = 0; k < denBtns.length; k++) {
              denBtns[k].addEventListener('click', function() {
                var id = this.getAttribute('data-amend-id');
                var reasonEl = container.querySelector('.pa-deny-reason[data-amend-id="' + id + '"]');
                if (reasonEl.style.display === 'none' || !reasonEl.style.display) { reasonEl.style.display = 'block'; return; }
                var reason = reasonEl.value.trim();
                if (!reason) { reasonEl.style.borderColor = '#ef5350'; return; }
                _gasCall('reviewAmendment', [_adminToken, id, 'Denied', reason], function() { _loadPendingAmendments(); });
              });
            }
          }
          function _renderBreachLog(result) {
            var container = document.getElementById('breach-log-list');
            var empty = document.getElementById('breach-empty');
            if (!result || !result.success) { if(container) container.innerHTML = '<div style="color:#ef5350">Error: ' + _escA(result ? result.message : 'No response') + '</div>'; return; }
            if (!result.items || result.items.length === 0) { if(empty) empty.style.display = ''; return; }
            if(empty) empty.style.display = 'none';
            var html = '';
            for (var i = 0; i < result.items.length; i++) {
              var b = result.items[i];
              html += '<div class="pa-card"><div class="pa-card-header">Breach #' + _escA(b.id || '') + '</div>';
              html += '<div class="pa-card-meta">Discovered: ' + _escA(b.discoveryDate || '') + ' | Status: ' + _escA(b.status || '') + '</div>';
              html += '<div class="pa-card-field">' + _escA(b.description || '') + '</div>';
              if (b.count) html += '<div class="pa-card-field"><strong>Affected:</strong> ' + _escA(b.count) + ' individuals</div>';
              html += '</div>';
            }
            if(container) container.innerHTML = html;
          }
          function _renderRepresentatives(result) {
            var container = document.getElementById('rep-list');
            var empty = document.getElementById('rep-empty');
            if (!result || !result.success) { if(container) container.innerHTML = '<div style="color:#ef5350">Error: ' + _escA(result ? result.message : 'No response') + '</div>'; return; }
            if (!result.items || result.items.length === 0) { if(empty) empty.style.display = ''; return; }
            if(empty) empty.style.display = 'none';
            var html = '';
            for (var i = 0; i < result.items.length; i++) {
              var r = result.items[i];
              html += '<div class="pa-card"><div class="pa-card-header">' + _escA(r.name || '') + '</div>';
              html += '<div class="pa-card-meta">' + _escA(r.email || '') + ' \\u2014 ' + _escA(r.relationship || '') + '</div>';
              html += '<div class="pa-card-field"><strong>Patient:</strong> ' + _escA(r.patientEmail || '') + '</div>';
              html += '<div class="pa-card-actions"><button class="pa-deny" data-rep-id="' + _escA(r.id) + '">Revoke</button></div>';
              html += '</div>';
            }
            if(container) container.innerHTML = html;
            var revBtns = container.querySelectorAll('.pa-deny[data-rep-id]');
            for (var j = 0; j < revBtns.length; j++) {
              revBtns[j].addEventListener('click', function() {
                _gasCall('revokeRepresentative', [_adminToken, this.getAttribute('data-rep-id'), 'Revoked by admin'], function() { _loadRepresentatives(); });
              });
            }
          }
          function _renderLegalHolds(result) {
            var container = document.getElementById('lh-list');
            var empty = document.getElementById('lh-empty');
            if (!result || !result.success) { if(container) container.innerHTML = '<div style="color:#ef5350">Error: ' + _escA(result ? result.message : 'No response') + '</div>'; return; }
            if (!result.items || result.items.length === 0) { if(empty) empty.style.display = ''; return; }
            if(empty) empty.style.display = 'none';
            var html = '';
            for (var i = 0; i < result.items.length; i++) {
              var h = result.items[i];
              html += '<div class="pa-card"><div class="pa-card-header">' + _escA(h.caseName || '') + '</div>';
              html += '<div class="pa-card-meta">Placed: ' + _escA(h.date || '') + ' | Custodian: ' + _escA(h.custodian || '') + '</div>';
              html += '<div class="pa-card-field"><strong>Scope:</strong> ' + _escA(h.scope || '') + '</div>';
              html += '<div class="pa-card-actions"><button class="pa-approve" data-hold-id="' + _escA(h.id) + '">Release</button></div>';
              html += '</div>';
            }
            if(container) container.innerHTML = html;
            var relBtns = container.querySelectorAll('.pa-approve[data-hold-id]');
            for (var j = 0; j < relBtns.length; j++) {
              relBtns[j].addEventListener('click', function() {
                _gasCall('releaseLegalHold', [_adminToken, this.getAttribute('data-hold-id'), 'Released by admin'], function() { _loadLegalHolds(); });
              });
            }
          }

          function _renderSimpleResult(elId, result, field) {
            var el = document.getElementById(elId);
            if (!el) return;
            if (!result || !result.success) { el.innerHTML = '<div style="color:#ef5350">Error: ' + _escA(result ? result.message : 'No response') + '</div>'; return; }
            el.innerHTML = '<div class="pa-card" style="white-space:pre-wrap;font-size:10px;">' + _escA(result[field] || '') + '</div>';
          }

          function _downloadResult(result, defaultName) {
            if (!result || !result.success || !result.data) return;
            var blob = new Blob([typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)], {type:'text/plain'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a'); a.href = url; a.download = defaultName; a.click();
            URL.revokeObjectURL(url);
          }

          // Panel HTML templates
          function _getAdminPanelHtml(id) {
            switch(id) {
              case 'sessions': return '<div class="pa-header"><span class="pa-title">Active Sessions</span><span><button id="admin-sessions-refresh" class="pa-action">Refresh</button></span></div><div id="admin-session-list"><div class="pa-status">Loading sessions...</div></div>';
              case 'disclosures': return '<div class="pa-header"><span class="pa-title">Disclosure Accounting</span><span><select id="disclosure-export-format" style="background:rgba(255,255,255,0.08);border:1px solid #555;color:#ccc;font:10px monospace;padding:1px 4px;border-radius:3px;"><option value="json">JSON</option><option value="csv">CSV</option></select><button id="disclosure-export-btn" class="pa-action">Export</button></span></div><div style="padding:4px 0;"><label style="display:inline;color:#aaa;font-size:11px;cursor:pointer;"><input type="checkbox" id="disclosure-grouped-toggle" checked /> Group repeated disclosures</label></div><div id="disclosure-period" class="pa-status"></div><div id="disclosure-list"></div><div id="disclosure-empty" class="pa-empty" style="display:none;">No disclosures found.</div>';
              case 'data-export': return '<div class="pa-header"><span class="pa-title">Download My Data</span></div><div class="pa-body"><p style="color:#aaa;font-size:11px;margin:0 0 8px;">Download a copy of all your data (HIPAA \\u00a7164.524).</p><div class="pa-format-picker"><label><input type="radio" name="export-format" value="json" checked> JSON</label><label><input type="radio" name="export-format" value="csv"> CSV</label><label><input type="radio" name="export-format" value="summary"> Summary</label></div><div id="summary-agreement" style="display:none;margin:6px 0;padding:6px;background:rgba(255,255,255,0.04);border-radius:4px;"><label style="font-size:10px;display:inline;cursor:pointer;"><input type="checkbox" id="summary-agree-checkbox" /> I agree to receive a summary</label></div><button id="data-export-download-btn" class="pa-action" style="margin-top:8px;">Download</button><div id="data-export-status" class="pa-status"></div></div>';
              case 'amendment': return '<div class="pa-header"><span class="pa-title">Request Record Correction</span></div><div class="pa-body"><label>Record to correct:<input type="text" id="amend-record-id" placeholder="Record ID" /></label><label>Current content:<textarea id="amend-current" rows="2"></textarea></label><label>Proposed correction:<textarea id="amend-proposed" rows="3"></textarea></label><label>Reason:<textarea id="amend-reason" rows="2"></textarea></label><button id="amend-submit-btn" class="pa-action" style="margin-top:8px;">Submit</button><div id="amend-status" class="pa-status"></div></div>';
              case 'amendment-review': return '<div class="pa-header"><span class="pa-title">Pending Amendments</span><span><button id="amend-review-refresh" class="pa-action">Refresh</button></span></div><div id="amend-review-list"></div><div id="amend-review-empty" class="pa-empty" style="display:none;">No pending amendments.</div>';
              case 'disagreement': return '<div class="pa-header"><span class="pa-title">Statement of Disagreement</span></div><div class="pa-body"><label>Amendment Request ID:<input type="text" id="disagree-amendment-id" /></label><label>Your statement:<textarea id="disagree-statement" rows="4"></textarea></label><button id="disagree-submit-btn" class="pa-action" style="margin-top:8px;">Submit</button><div id="disagree-status" class="pa-status"></div></div>';
              case 'extension': return '<div class="pa-header"><span class="pa-title">Grant 30-Day Extension</span></div><div class="pa-body"><label>Request type:<select id="extension-type" style="background:rgba(255,255,255,0.08);border:1px solid #555;color:#ccc;font:12px monospace;padding:4px;border-radius:4px;width:100%;"><option value="access">Access Request</option><option value="amendment">Amendment Request</option></select></label><label>Request ID:<input type="text" id="extension-request-id" /></label><label>Reason:<textarea id="extension-reason" rows="3"></textarea></label><button id="extension-submit-btn" class="pa-action" style="margin-top:8px;">Grant Extension</button><div id="extension-status" class="pa-status"></div></div>';
              case 'denial-notice': return '<div class="pa-header"><span class="pa-title">Formal Denial Notice</span></div><div class="pa-body"><label>Request Type:<select id="denial-request-type" style="background:rgba(255,255,255,0.08);border:1px solid #555;color:#ccc;font:11px monospace;padding:3px 6px;border-radius:3px;width:100%;"><option value="access">Access Request</option><option value="amendment">Amendment Request</option></select></label><label>Request/Amendment ID:<input type="text" id="denial-request-id" /></label><label>Basis for denial:<textarea id="denial-basis" rows="3"></textarea></label><label style="display:inline;color:#aaa;font-size:11px;cursor:pointer;"><input type="checkbox" id="denial-reviewable" checked /> Denial is reviewable</label><label>Contact person:<input type="text" id="denial-contact" value="HIPAA Privacy Officer" /></label><label>Contact office:<input type="text" id="denial-office" value="Privacy Office" /></label><button id="denial-generate-btn" class="pa-action" style="margin-top:8px;">Generate</button><div id="denial-status" class="pa-status"></div><div id="denial-notice-output" style="display:none;margin-top:8px;padding:8px;background:rgba(255,255,255,0.04);border-radius:4px;font-size:11px;color:#ccc;white-space:pre-wrap;"></div></div>';
              case 'ehr-disclosures': return '<div class="pa-header"><span class="pa-title">EHR Disclosure Accounting (HITECH)</span><span><button id="ehr-refresh-btn" class="pa-action">Refresh</button></span></div><div class="pa-body"><div id="ehr-period" class="pa-status"></div><div id="ehr-list"></div><div id="ehr-empty" class="pa-empty" style="display:none;">No EHR TPO disclosures found.</div></div>';
              case 'breach-log': return '<div class="pa-header"><span class="pa-title">Breach Log</span><span><button id="breach-refresh-btn" class="pa-action">Refresh</button></span></div><div class="pa-body"><div id="breach-log-list"></div><div id="breach-empty" class="pa-empty" style="display:none;">No breaches logged.</div><div style="margin-top:10px;border-top:1px solid #333;padding-top:10px;"><span style="color:#aaa;font-size:11px;font-weight:bold;">Log New Breach</span><label>Description:<textarea id="breach-description" rows="2"></textarea></label><label>Nature of PHI:<input type="text" id="breach-nature-phi" /></label><label>Affected count:<input type="number" id="breach-affected-count" min="0" value="0" /></label><label>Mitigation:<textarea id="breach-mitigation" rows="2"></textarea></label><button id="breach-log-submit-btn" class="pa-action" style="margin-top:8px;">Log Breach</button><div id="breach-log-status" class="pa-status"></div></div><div style="margin-top:10px;border-top:1px solid #333;padding-top:10px;"><span style="color:#aaa;font-size:11px;font-weight:bold;">Annual Report</span><label>Year:<input type="number" id="breach-report-year" style="width:80px;" /></label><button id="breach-report-btn" class="pa-action">Generate Report</button><div id="breach-report-result"></div></div></div>';
              case 'representatives': return '<div class="pa-header"><span class="pa-title">Personal Representatives</span><span><button id="rep-refresh-btn" class="pa-action">Refresh</button></span></div><div class="pa-body"><div id="rep-list"></div><div id="rep-empty" class="pa-empty">No representatives registered.</div><div style="margin-top:10px;border-top:1px solid #333;padding-top:10px;"><span style="color:#aaa;font-size:11px;font-weight:bold;">Register Representative</span><label>Rep Email:<input type="email" id="rep-email" /></label><label>Individual Email:<input type="email" id="rep-individual-email" /></label><label>Relationship:<select id="rep-relationship"><option value="">Select...</option><option value="Parent">Parent</option><option value="LegalGuardian">Legal Guardian</option><option value="HealthcarePOA">Healthcare POA</option><option value="CourtAppointed">Court Appointed</option><option value="Executor">Executor</option></select></label><label>Expiration:<input type="date" id="rep-expiration" /></label><label>Document Ref:<input type="text" id="rep-document-ref" /></label><label>Notes:<input type="text" id="rep-notes" /></label><button id="rep-register-btn" class="pa-action" style="margin-top:8px;">Register</button><div id="rep-register-status" class="pa-status"></div></div></div>';
              case 'legal-holds': return '<div class="pa-header"><span class="pa-title">Legal Holds</span><span><button id="lh-refresh-btn" class="pa-action">Refresh</button></span></div><div class="pa-body"><div style="margin-bottom:8px;"><label style="color:#aaa;font-size:11px;">Filter:<select id="lh-status-filter" style="font-size:11px;background:#1a1a2e;color:#ccc;border:1px solid #555;border-radius:3px;padding:2px 4px;"><option value="">All</option><option value="Active" selected>Active</option><option value="Released">Released</option><option value="Expired">Expired</option></select></label></div><div id="lh-list"></div><div id="lh-empty" class="pa-empty" style="display:none;">No legal holds found.</div><div style="margin-top:10px;border-top:1px solid #333;padding-top:10px;"><span style="color:#aaa;font-size:11px;font-weight:bold;">Place New Hold</span><label>Sheet:<select id="lh-sheet-name"><option value="">Select...</option><option value="SessionAuditLog">SessionAuditLog</option><option value="DataAuditLog">DataAuditLog</option><option value="DisclosureLog">DisclosureLog</option><option value="AccessRequests">AccessRequests</option><option value="AmendmentRequests">AmendmentRequests</option><option value="AmendmentNotifications">AmendmentNotifications</option><option value="BreachLog">BreachLog</option><option value="PersonalRepresentatives">PersonalRepresentatives</option><option value="LegalHolds">LegalHolds</option><option value="RetentionIntegrityLog">RetentionIntegrityLog</option></select></label><label>Hold Type:<select id="lh-hold-type"><option value="">Select...</option><option value="Litigation">Litigation</option><option value="Regulatory">Regulatory</option><option value="InternalInvestigation">Internal Investigation</option><option value="Audit">Audit</option><option value="Preservation">Preservation</option></select></label><label>Reason:<textarea id="lh-reason" rows="2"></textarea></label><label>Case Ref:<input type="text" id="lh-case-ref" /></label><label>Custodian:<input type="email" id="lh-custodian" /></label><label>Start Date:<input type="date" id="lh-start-date" /></label><label>End Date:<input type="date" id="lh-end-date" /></label><label>Expiration:<input type="date" id="lh-expiration" /></label><button id="lh-place-btn" class="pa-action" style="margin-top:8px;">Place Hold</button><div id="lh-place-status" class="pa-status"></div></div></div>';
              case 'compliance-audit': return '<div class="pa-header"><span class="pa-title">Retention Compliance Audit</span><span><button id="ca-run-btn" class="pa-action">Run Audit</button></span></div><div class="pa-body"><div id="ca-result"></div><div id="ca-empty" class="pa-empty">Click "Run Audit" to check retention compliance.</div><div style="margin-top:10px;border-top:1px solid #333;padding-top:10px;"><div class="pa-format-picker"><label><input type="radio" name="ca-export-format" value="json" checked /> JSON</label><label><input type="radio" name="ca-export-format" value="text" /> Text</label></div><button id="ca-export-btn" class="pa-action">Export</button><div id="ca-export-result"></div></div></div>';
              case 'archive-integrity': return '<div class="pa-header"><span class="pa-title">Archive Integrity Verification</span><span><button id="ai-verify-btn" class="pa-action">Verify All</button></span></div><div class="pa-body"><div id="ai-result"></div><div id="ai-empty" class="pa-empty">Click "Verify All" to check archive checksums.</div></div>';
              case 'retention-policy': return '<div class="pa-header"><span class="pa-title">Retention Policy</span><span><button id="rp-generate-btn" class="pa-action">Generate</button></span></div><div class="pa-body"><div id="rp-result"></div><div id="rp-empty" class="pa-empty">Click "Generate" to create a retention policy document.</div><div style="margin-top:10px;border-top:1px solid #333;padding-top:10px;"><div class="pa-format-picker"><label><input type="radio" name="rp-export-format" value="text" checked /> Text</label><label><input type="radio" name="rp-export-format" value="json" /> JSON</label></div><button id="rp-export-btn" class="pa-action">Export</button><div id="rp-export-result"></div></div></div>';
              default: return '<div class="pa-empty">Unknown panel.</div>';
            }
          }

          // Attach listeners per panel
          function _attachAdminListeners(id) {
            switch(id) {
              case 'sessions':
                var sRef = document.getElementById('admin-sessions-refresh');
                if (sRef) sRef.addEventListener('click', function() { _loadSessions(); });
                break;
              case 'disclosures':
                var gT = document.getElementById('disclosure-grouped-toggle');
                if (gT) gT.addEventListener('change', function() { _loadDisclosures(); });
                var eB = document.getElementById('disclosure-export-btn');
                if (eB) eB.addEventListener('click', function() {
                  _gasCall('exportDisclosureAccounting', [_adminToken, document.getElementById('disclosure-export-format').value], function(r) { _downloadResult(r, 'hipaa-disclosures.' + (r.format||'json')); });
                });
                break;
              case 'data-export':
                var radios = document.querySelectorAll('input[name="export-format"]');
                for (var ri = 0; ri < radios.length; ri++) radios[ri].addEventListener('change', function() { var sa = document.getElementById('summary-agreement'); if(sa) sa.style.display = this.value === 'summary' ? '' : 'none'; });
                var dl = document.getElementById('data-export-download-btn');
                if (dl) dl.addEventListener('click', function() {
                  var fmt = document.querySelector('input[name="export-format"]:checked').value;
                  if (fmt === 'summary') {
                    var cb = document.getElementById('summary-agree-checkbox'); if (!cb || !cb.checked) { _setStatus('data-export-status', 'Please agree first.', '#ef5350'); return; }
                    _gasCall('generateDataSummary', [_adminToken], function(r) { _downloadResult(r, 'hipaa-summary.json'); _setStatus('data-export-status', 'Ready.', '#66bb6a'); });
                  } else { _gasCall('requestDataExport', [_adminToken, fmt], function(r) { _downloadResult(r, 'hipaa-export.' + fmt); _setStatus('data-export-status', 'Ready.', '#66bb6a'); }); }
                });
                break;
              case 'amendment':
                var aS = document.getElementById('amend-submit-btn');
                if (aS) aS.addEventListener('click', function() {
                  var rId = document.getElementById('amend-record-id').value.trim(), cur = document.getElementById('amend-current').value.trim(), prop = document.getElementById('amend-proposed').value.trim(), rsn = document.getElementById('amend-reason').value.trim();
                  if (!rId || !prop) { _setStatus('amend-status', 'Record ID and proposed correction required.'); return; }
                  _setStatus('amend-status', 'Submitting...');
                  _gasCall('requestAmendment', [_adminToken, rId, cur, prop, rsn], function(r) { if (r&&r.success) _setStatus('amend-status', 'Submitted. ID: '+(r.id||'N/A'), '#66bb6a'); else _setStatus('amend-status', 'Error: '+(r?r.message:''), '#ef5350'); });
                });
                break;
              case 'amendment-review':
                var arR = document.getElementById('amend-review-refresh');
                if (arR) arR.addEventListener('click', function() { _loadPendingAmendments(); });
                break;
              case 'disagreement':
                var dS = document.getElementById('disagree-submit-btn');
                if (dS) dS.addEventListener('click', function() {
                  var aId = document.getElementById('disagree-amendment-id').value.trim(), stmt = document.getElementById('disagree-statement').value.trim();
                  if (!aId || !stmt) { _setStatus('disagree-status', 'Both fields required.'); return; }
                  _setStatus('disagree-status', 'Submitting...');
                  _gasCall('submitDisagreement', [_adminToken, aId, stmt], function(r) { if (r&&r.success) _setStatus('disagree-status', 'Filed.', '#66bb6a'); else _setStatus('disagree-status', 'Error: '+(r?r.message:''), '#ef5350'); });
                });
                break;
              case 'extension':
                var eS = document.getElementById('extension-submit-btn');
                if (eS) eS.addEventListener('click', function() {
                  var et = document.getElementById('extension-type').value, rId = document.getElementById('extension-request-id').value.trim(), rsn = document.getElementById('extension-reason').value.trim();
                  if (!rId || !rsn) { _setStatus('extension-status', 'Request ID and reason required.'); return; }
                  _setStatus('extension-status', 'Submitting...');
                  var fn = et === 'amendment' ? 'requestAmendmentExtension' : 'requestAccessExtension';
                  _gasCall(fn, [_adminToken, rId, rsn], function(r) { if (r&&r.success) _setStatus('extension-status', 'Granted. Deadline: '+(r.newDeadline||'N/A'), '#66bb6a'); else _setStatus('extension-status', 'Error: '+(r?r.message:''), '#ef5350'); });
                });
                break;
              case 'denial-notice':
                var dG = document.getElementById('denial-generate-btn');
                if (dG) dG.addEventListener('click', function() {
                  var rId = document.getElementById('denial-request-id').value.trim();
                  if (!rId) { _setStatus('denial-status', 'Request ID required.'); return; }
                  _setStatus('denial-status', 'Generating...');
                  var params = {basis:document.getElementById('denial-basis').value.trim(), reviewable:document.getElementById('denial-reviewable').checked, contact:document.getElementById('denial-contact').value.trim(), office:document.getElementById('denial-office').value.trim()};
                  _gasCall('generateDenialNotice', [_adminToken, document.getElementById('denial-request-type').value, rId, params], function(r) {
                    if (r&&r.success) { _setStatus('denial-status', 'Generated.', '#66bb6a'); var out=document.getElementById('denial-notice-output'); if(out){out.style.display='';out.textContent=r.notice||'';} }
                    else _setStatus('denial-status', 'Error: '+(r?r.message:''), '#ef5350');
                  });
                });
                break;
              case 'ehr-disclosures':
                var eR = document.getElementById('ehr-refresh-btn');
                if (eR) eR.addEventListener('click', function() { _loadEhrDisclosures(); });
                break;
              case 'breach-log':
                var bR = document.getElementById('breach-refresh-btn');
                if (bR) bR.addEventListener('click', function() { _loadBreachLog(); });
                var bS = document.getElementById('breach-log-submit-btn');
                if (bS) bS.addEventListener('click', function() {
                  var desc = document.getElementById('breach-description').value.trim();
                  if (!desc) { _setStatus('breach-log-status', 'Description required.'); return; }
                  _setStatus('breach-log-status', 'Logging...');
                  _gasCall('logBreach', [_adminToken, {description:desc, phiNature:document.getElementById('breach-nature-phi').value.trim(), count:document.getElementById('breach-affected-count').value, mitigation:document.getElementById('breach-mitigation').value.trim()}], function(r) {
                    if (r&&r.success) { _setStatus('breach-log-status', 'Logged. ID: '+(r.id||'N/A'), '#66bb6a'); _loadBreachLog(); } else _setStatus('breach-log-status', 'Error: '+(r?r.message:''), '#ef5350');
                  });
                });
                var bRpt = document.getElementById('breach-report-btn');
                if (bRpt) bRpt.addEventListener('click', function() {
                  document.getElementById('breach-report-result').innerHTML = '<div class="pa-status">Generating...</div>';
                  _gasCall('getBreachReport', [_adminToken, document.getElementById('breach-report-year').value||''], function(r) {
                    var el = document.getElementById('breach-report-result');
                    if (!r||!r.success) el.innerHTML = '<div style="color:#ef5350">Error: '+_escA(r?r.message:'')+'</div>';
                    else el.innerHTML = '<div class="pa-card" style="white-space:pre-wrap;font-size:10px;">'+_escA(r.report||'No breaches.')+'</div>';
                  });
                });
                break;
              case 'representatives':
                var rpR = document.getElementById('rep-refresh-btn');
                if (rpR) rpR.addEventListener('click', function() { _loadRepresentatives(); });
                var rpReg = document.getElementById('rep-register-btn');
                if (rpReg) rpReg.addEventListener('click', function() {
                  var re = document.getElementById('rep-email').value.trim(), ie = document.getElementById('rep-individual-email').value.trim();
                  if (!re || !ie) { _setStatus('rep-register-status', 'Both emails required.'); return; }
                  _setStatus('rep-register-status', 'Registering...');
                  _gasCall('registerPersonalRepresentative', [_adminToken, {repEmail:re, individualEmail:ie, relationship:document.getElementById('rep-relationship').value, expiration:document.getElementById('rep-expiration').value, documentRef:document.getElementById('rep-document-ref').value.trim(), notes:document.getElementById('rep-notes').value.trim()}], function(r) {
                    if (r&&r.success) { _setStatus('rep-register-status', 'Registered.', '#66bb6a'); _loadRepresentatives(); } else _setStatus('rep-register-status', 'Error: '+(r?r.message:''), '#ef5350');
                  });
                });
                break;
              case 'legal-holds':
                var lR = document.getElementById('lh-refresh-btn');
                if (lR) lR.addEventListener('click', function() { _loadLegalHolds(); });
                var lF = document.getElementById('lh-status-filter');
                if (lF) lF.addEventListener('change', function() { _loadLegalHolds(); });
                var lP = document.getElementById('lh-place-btn');
                if (lP) lP.addEventListener('click', function() {
                  var sh = document.getElementById('lh-sheet-name').value, ht = document.getElementById('lh-hold-type').value;
                  if (!sh || !ht) { _setStatus('lh-place-status', 'Sheet and hold type required.'); return; }
                  _setStatus('lh-place-status', 'Placing hold...');
                  _gasCall('placeLegalHold', [_adminToken, {sheetName:sh, holdType:ht, reason:document.getElementById('lh-reason').value.trim(), caseRef:document.getElementById('lh-case-ref').value.trim(), custodian:document.getElementById('lh-custodian').value.trim(), startDate:document.getElementById('lh-start-date').value, endDate:document.getElementById('lh-end-date').value, expiration:document.getElementById('lh-expiration').value}], function(r) {
                    if (r&&r.success) { _setStatus('lh-place-status', 'Hold placed. ID: '+(r.id||'N/A'), '#66bb6a'); _loadLegalHolds(); } else _setStatus('lh-place-status', 'Error: '+(r?r.message:''), '#ef5350');
                  });
                });
                break;
              case 'compliance-audit':
                var caR = document.getElementById('ca-run-btn');
                if (caR) caR.addEventListener('click', function() { document.getElementById('ca-result').innerHTML='<div class="pa-status">Running audit...</div>'; var ce=document.getElementById('ca-empty'); if(ce)ce.style.display='none'; _gasCall('auditRetentionCompliance', [_adminToken], function(r) { _renderSimpleResult('ca-result', r, 'report'); }); });
                var caE = document.getElementById('ca-export-btn');
                if (caE) caE.addEventListener('click', function() { var fmt=document.querySelector('input[name="ca-export-format"]:checked').value; _gasCall('getComplianceAuditReport', [_adminToken, fmt], function(r) { _downloadResult(r, 'audit-report.'+fmt); var el=document.getElementById('ca-export-result'); if(el)el.innerHTML='<div style="color:#66bb6a">Downloaded.</div>'; }); });
                break;
              case 'archive-integrity':
                var aiV = document.getElementById('ai-verify-btn');
                if (aiV) aiV.addEventListener('click', function() { document.getElementById('ai-result').innerHTML='<div class="pa-status">Verifying...</div>'; var ae=document.getElementById('ai-empty'); if(ae)ae.style.display='none'; _gasCall('verifyArchiveIntegrity', [_adminToken], function(r) { _renderSimpleResult('ai-result', r, 'report'); }); });
                break;
              case 'retention-policy':
                var rpG = document.getElementById('rp-generate-btn');
                if (rpG) rpG.addEventListener('click', function() { document.getElementById('rp-result').innerHTML='<div class="pa-status">Generating...</div>'; var re=document.getElementById('rp-empty'); if(re)re.style.display='none'; _gasCall('getRetentionPolicyDocument', [_adminToken], function(r) { _renderSimpleResult('rp-result', r, 'policy'); }); });
                var rpE = document.getElementById('rp-export-btn');
                if (rpE) rpE.addEventListener('click', function() { var fmt=document.querySelector('input[name="rp-export-format"]:checked').value; _gasCall('exportRetentionPolicy', [_adminToken, fmt], function(r) { _downloadResult(r, 'retention-policy.'+fmt); var el=document.getElementById('rp-export-result'); if(el)el.innerHTML='<div style="color:#66bb6a">Exported.</div>'; }); });
                break;
            }
          }
        })();
        ` : ''}


        // ── Live sync + viewer presence (TEMPLATE) ──
        // Two status pills (top-right): "Live Ns | ▷ Ns" — a visible countdown to the next
        // getDataRev() poll that watches for other users' writes — and "👥 N" — who is
        // viewing right now (green = active, amber = away by window focus; hover for the list).
        // Projects wire in two ways:
        //   1. Server: call bumpDataRev() after EVERY shared-data write (see DATA OPERATIONS).
        //   2. Client: override window._onLiveDataChange = function () { /* re-fetch + re-render */ }
        //      — called when another user's write changes the revision. Optionally override
        //      window._liveIsBusy = function () { /* return true while the user is mid-edit */ }
        //      to defer refreshes (a skipped round retries on the next poll).
        // Every path is wrapped in try/catch so a live/presence error can NEVER halt the
        // shared auth/app init that runs in this same inline script.
        (function () {
          function _lpCall(fn, args, onOk, onErr) {
            try {
              var r = google.script.run.withSuccessHandler(onOk || function () {}).withFailureHandler(onErr || function () {});
              r[fn].apply(r, args);
            } catch (e) { if (onErr) onErr(e); }
          }

          // — Viewer presence: report own state every 30s, render the roster —
          function _presEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
          function _presState() {
            try {
              var visible = (typeof document.visibilityState === 'undefined') ? true : (document.visibilityState === 'visible');
              var focused = (typeof document.hasFocus === 'function') ? document.hasFocus() : true;
              return (visible && focused) ? 'active' : 'away';
            } catch (e) { return 'active'; }
          }
          function _presRender(viewers) {
            try {
              var cnt = document.getElementById('dt-pres-count');
              var pop = document.getElementById('dt-pres-pop');
              var n = viewers ? viewers.length : 0;
              if (cnt) cnt.textContent = n ? String(n) : '–';
              if (!pop) return;
              if (!n) { pop.innerHTML = '<div class="dt-pres-empty">No one else viewing</div>'; return; }
              var html = '';
              for (var i = 0; i < viewers.length; i++) {
                var v = viewers[i] || {};
                var cls = (v.state === 'away') ? 'away' : 'active';
                var you = v.self ? ' <span class="dt-pres-you">(you)</span>' : '';
                var lbl = (v.state === 'away') ? ' — away' : '';
                html += '<div class="dt-pres-row"><span class="dt-pres-dot ' + cls + '"></span><span>' + _presEsc(v.name || v.email || '') + '</span>' + you + '<span class="dt-pres-you">' + lbl + '</span></div>';
              }
              pop.innerHTML = html;
            } catch (e) {}
          }
          function _presReport() {
            try {
              if (!_sessionToken) return;
              _lpCall('updatePresence', [_sessionToken, _presState()], function (res) { _presRender(res && res.viewers); }, function () {});
            } catch (e) {}
          }

          // — Live poll: visible countdown + cheap revision check, in lockstep —
          // The "next check" number is a simple counter decremented once per second and reset
          // with each poll cycle (countdown + poll chained via setTimeout — wall-clock math
          // against free-running setIntervals drifts under browser timer throttling). While a
          // check is actually in flight the display shows amber "polling...".
          var _lastRev = null, _liveTimer = null, _liveTickTimer = null, POLL_MS = 15000;
          var _liveLastOk = 0, _liveOk = false, _liveCountdown = 0, _liveChecking = false;
          function _updLive() {
            try {
              var el = document.getElementById('dt-live'); if (!el) return;
              el.classList.toggle('off', !_liveOk);
              var lbl = document.getElementById('dt-live-lbl'); if (lbl) lbl.textContent = _liveOk ? 'Live' : 'Reconnecting…';
              var since = _liveLastOk ? Math.max(0, Math.floor((Date.now() - _liveLastOk) / 1000)) : 0;
              var a = document.getElementById('dt-live-since'); if (a) a.textContent = since + 's';
              var b = document.getElementById('dt-live-next');
              if (b) {
                if (_liveChecking) { b.textContent = 'polling...'; b.style.color = '#d29922'; }
                else { b.textContent = '▷ ' + _liveCountdown + 's'; b.style.color = ''; }
              }
            } catch (e) {}
          }
          // Start the next poll cycle: reset the countdown, restart the 1s ticker, and schedule
          // the poll itself so ticker and poll can never drift apart. Called after EVERY poll
          // completion (success, failure, or busy-skip) — the chain must never die.
          function _scheduleLivePoll() {
            _liveChecking = false;
            _liveCountdown = POLL_MS / 1000;
            clearInterval(_liveTickTimer);
            _liveTickTimer = setInterval(function () { if (_liveCountdown > 0) _liveCountdown--; _updLive(); }, 1000);
            clearTimeout(_liveTimer);
            _liveTimer = setTimeout(_livePoll, POLL_MS);
            _updLive();
          }
          function _isBusy() {
            try { return (typeof window._liveIsBusy === 'function') ? !!window._liveIsBusy() : false; } catch (e) { return false; }
          }
          function _livePoll() {
            try {
              _liveChecking = true; _updLive();
              if (!_sessionToken || _isBusy()) { _scheduleLivePoll(); return; }   // skip this round but keep the chain alive
              _lpCall('getDataRev', [_sessionToken], function (res) {
                _liveLastOk = Date.now(); _liveOk = true; _scheduleLivePoll();
                var rev = (res && res.rev) || '';
                if (!rev) return;                                   // no writes recorded yet — nothing to compare
                if (_lastRev === null) { _lastRev = rev; return; }  // establish baseline
                if (rev === _lastRev || _isBusy()) return;          // unchanged, or user mid-edit (retries next poll)
                _lastRev = rev;
                try { if (typeof window._onLiveDataChange === 'function') window._onLiveDataChange(); } catch (e2) {}
              }, function () { _liveOk = false; _scheduleLivePoll(); });
            } catch (e) { try { _scheduleLivePoll(); } catch (e3) {} }
          }

          // Start both engines. Departures are handled server-side by staleness pruning
          // (no reliable unload signal), so there is nothing to tear down here.
          try {
            var onChange = function () { _presReport(); };
            document.addEventListener('visibilitychange', onChange);
            window.addEventListener('focus', onChange);
            window.addEventListener('blur', onChange);
            setInterval(_presReport, 30000);   // heartbeat every 30s; server prunes viewers unseen for 75s
            _presReport();                     // report immediately so the pill fills in on load
            _livePoll();                       // first poll now; each completion schedules the next cycle
          } catch (e) {}
        })();

        // PROJECT START — Add your project-specific UI logic here
        (function() {
          var companySel = document.getElementById('fi-company');
          var sourceSel = document.getElementById('fi-source');
          var noteTa = document.getElementById('fi-note');
          var fileInput = document.getElementById('fi-files');
          var fileList = document.getElementById('fi-file-list');
          var confRange = document.getElementById('fi-conf');
          var confVal = document.getElementById('fi-conf-val');
          var submitBtn = document.getElementById('fi-submit');
          var statusEl = document.getElementById('fi-status');
          if (!companySel) return;
          var prefillSlug = '${prefillSlug}';

          confRange.addEventListener('input', function() { confVal.textContent = confRange.value; });

          function setStatus(msg, cls) { statusEl.textContent = msg; statusEl.className = cls || ''; }

          fileInput.addEventListener('change', function() {
            var names = [];
            for (var i = 0; i < fileInput.files.length; i++) names.push(fileInput.files[i].name);
            fileList.textContent = names.length ? ('Attached: ' + names.join(', ')) : '';
          });

          google.script.run
            .withSuccessHandler(function(boot) {
              companySel.innerHTML = '';
              (boot.companies || []).forEach(function(c) {
                var o = document.createElement('option'); o.value = c.slug; o.textContent = c.name; companySel.appendChild(o);
              });
              sourceSel.innerHTML = '';
              (boot.sourceTypes || []).forEach(function(s) {
                var o = document.createElement('option'); o.value = s; o.textContent = s; sourceSel.appendChild(o);
              });
              sourceSel.value = 'contact';
              if (prefillSlug) companySel.value = prefillSlug;
              companySel.disabled = false; sourceSel.disabled = false; submitBtn.disabled = false;
            })
            .withFailureHandler(function(e) { setStatus('Could not load companies — reload the page. (' + (e && e.message || e) + ')', 'err'); })
            .getIntakeBootstrap(_sessionToken);

          // Read selected files as base64 (data-URL minus the prefix)
          function readFiles(cb) {
            var fl = fileInput.files;
            if (!fl.length) { cb([]); return; }
            if (fl.length > 3) { setStatus('Attach at most 3 files.', 'err'); cb(null); return; }
            var out = [], pending = fl.length, failed = false;
            for (var i = 0; i < fl.length; i++) (function(f) {
              if (!/\\.(docx?|pdf)$/i.test(f.name)) { failed = true; setStatus(f.name + ' is not a Word/PDF file.', 'err'); cb(null); return; }
              if (f.size > 8 * 1024 * 1024) { failed = true; setStatus(f.name + ' is over 8 MB.', 'err'); cb(null); return; }
              var r = new FileReader();
              r.onload = function() {
                if (failed) return;
                out.push({ name: f.name, base64: String(r.result).split(',')[1] || '' });
                if (--pending === 0) cb(out);
              };
              r.onerror = function() { if (!failed) { failed = true; setStatus('Could not read ' + f.name + '.', 'err'); cb(null); } };
              r.readAsDataURL(f);
            })(fl[i]);
          }

          submitBtn.addEventListener('click', function() {
            var text = noteTa.value.trim();
            if (!text && !fileInput.files.length) { setStatus('Type a note or attach a file first.', 'err'); noteTa.focus(); return; }
            submitBtn.disabled = true;
            setStatus(fileInput.files.length ? 'Uploading…' : 'Saving…');
            readFiles(function(files) {
              if (files === null) { submitBtn.disabled = false; return; }
              google.script.run
                .withSuccessHandler(function(res) {
                  submitBtn.disabled = false;
                  noteTa.value = ''; fileInput.value = ''; fileList.textContent = '';
                  setStatus('Saved ' + res.id + ' (' + res.slug + ', confidence ' + res.confidence
                    + (res.files ? ', ' + res.files + ' file' + (res.files > 1 ? 's' : '') : '')
                    + '). It appears in the Profiler ⚙ changelog after the next deploy (~1–2 min).', 'ok');
                })
                .withFailureHandler(function(e) {
                  submitBtn.disabled = false;
                  setStatus('Save failed: ' + (e && e.message || e) + ' — nothing was stored. Try again.', 'err');
                })
                .submitFieldNote(_sessionToken, {
                  slug: companySel.value,
                  sourceType: sourceSel.value,
                  note: text,
                  confidence: parseInt(confRange.value, 10),
                  files: files
                });
            });
          });

          // ── Manage existing notes (list / edit / delete) ──
          // try/catch so a fault here can never halt the auth flow that shares
          // this script context
          try {
            var mToggle = document.getElementById('fi-manage-toggle');
            var mList = document.getElementById('fi-manage-list');
            var mLoaded = false;

            function esc(s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

            function renderNotes(notes) {
              mList.innerHTML = '';
              if (!notes.length) { mList.innerHTML = '<div class="fi-note-meta" style="margin-top:10px">No notes in the log yet.</div>'; return; }
              notes.forEach(function(n) {
                var row = document.createElement('div');
                row.className = 'fi-note-row';
                row.innerHTML =
                  '<div class="fi-note-meta">' + esc(n.id) + ' · ' + esc(n.slug) + ' · via ' + esc(n.sourceType)
                  + ' · confidence ' + esc(n.confidence) + ' · ' + esc(n.triage)
                  + (n.sourceFile ? ' · 📎' : '') + (n.edited ? ' · edited ' + esc(n.edited) : '') + '</div>'
                  + '<div class="fi-note-text">' + esc(n.note) + '</div>'
                  + '<div class="fi-note-actions"><button type="button" class="fi-edit">Edit</button>'
                  + '<button type="button" class="fi-del">Delete</button></div>'
                  + '<div class="fi-edit-area" style="display:none"></div>';
                row.querySelector('.fi-del').addEventListener('click', function() {
                  if (!confirm('Delete ' + n.id + (n.sourceFile ? ' and its attached file' : '') + '? This cannot be undone.')) return;
                  setStatus('Deleting ' + n.id + '…');
                  google.script.run
                    .withSuccessHandler(function() { setStatus('Deleted ' + n.id + '. The public log updates after the next deploy (~1–2 min).', 'ok'); mLoaded = false; loadNotes(); })
                    .withFailureHandler(function(e) { setStatus('Delete failed: ' + (e && e.message || e), 'err'); })
                    .deleteFieldNote(_sessionToken, n.id);
                });
                row.querySelector('.fi-edit').addEventListener('click', function() {
                  var area = row.querySelector('.fi-edit-area');
                  if (area.style.display !== 'none') { area.style.display = 'none'; area.innerHTML = ''; return; }
                  area.style.display = 'block';
                  var ta = document.createElement('textarea'); ta.rows = 4; ta.maxLength = 4000; ta.value = n.note;
                  var sel = document.createElement('select');
                  for (var c = 100; c >= 0; c -= 5) { var o = document.createElement('option'); o.value = String(c); o.textContent = 'confidence ' + c; sel.appendChild(o); }
                  sel.value = String(Math.round(n.confidence / 5) * 5);
                  var saveB = document.createElement('button'); saveB.type = 'button'; saveB.textContent = 'Save changes';
                  saveB.style.cssText = 'display:block;margin-top:8px;padding:6px 14px;font:inherit;font-size:12px;cursor:pointer;background:#d8b45a;color:#13151c;border:none;border-radius:6px;';
                  saveB.addEventListener('click', function() {
                    var newText = ta.value.trim();
                    if (!newText) { setStatus('Note text cannot be empty — use Delete instead.', 'err'); return; }
                    setStatus('Saving ' + n.id + '…');
                    google.script.run
                      .withSuccessHandler(function() { setStatus('Updated ' + n.id + '. The public log updates after the next deploy (~1–2 min).', 'ok'); mLoaded = false; loadNotes(); })
                      .withFailureHandler(function(e) { setStatus('Edit failed: ' + (e && e.message || e), 'err'); })
                      .updateFieldNote(_sessionToken, { id: n.id, note: newText, confidence: parseInt(sel.value, 10) });
                  });
                  area.appendChild(ta); area.appendChild(sel); area.appendChild(saveB);
                });
                mList.appendChild(row);
              });
            }

            function loadNotes() {
              mList.innerHTML = '<div class="fi-note-meta" style="margin-top:10px">Loading…</div>';
              google.script.run
                .withSuccessHandler(function(notes) { mLoaded = true; renderNotes(notes || []); })
                .withFailureHandler(function(e) { mList.innerHTML = ''; setStatus('Could not load notes: ' + (e && e.message || e), 'err'); })
                .listFieldNotes(_sessionToken);
            }

            mToggle.addEventListener('click', function() {
              var open = mList.style.display !== 'none';
              mList.style.display = open ? 'none' : 'block';
              mToggle.textContent = open ? 'Manage existing notes ▸' : 'Manage existing notes ▾';
              if (!open && !mLoaded) loadNotes();
            });
          } catch (mErr) { /* management UI is optional — never block the form or auth */ }
        })();
        // PROJECT END
      </script>
    </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html)
    .setTitle(TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function serverSignOut(sessionToken) {
  invalidateSession(sessionToken);
  return { success: true };
}


// ═══════════════════════════════════════════════════════
// HIPAA COMPLIANCE — Configuration
// ═══════════════════════════════════════════════════════

/**
 * Breach alerting configuration.
 * Thresholds define how many security events of each type within WINDOW_MINUTES
 * trigger an email alert to the security officer.
 */
var BREACH_ALERT_CONFIG = {
  ENABLED: true,
  SECURITY_OFFICER_EMAIL: '',  // MUST be set before enabling — email address of designated security officer
  ALERT_COOLDOWN_MINUTES: 60,  // Minimum time between alerts of the same type
  WINDOW_MINUTES: 15,          // Rolling window for threshold evaluation
  THRESHOLDS: {
    'tier3_lockout': 1,        // Any Tier 3 lockout = immediate alert
    'hmac_integrity_violation': 3,  // 3 HMAC failures in window
    'session_hijack_attempt': 1,    // Any hijack attempt = immediate alert
    'brute_force': 5,          // 5 failed auth attempts in window
    'data_access_anomaly': 10, // 10 unusual data access patterns in window
    'permission_escalation': 1 // Any permission escalation attempt = immediate alert
  },
  // Event types that are ALWAYS logged to BreachLog (regardless of threshold)
  ALWAYS_LOG_EVENTS: ['tier3_lockout', 'session_hijack_attempt', 'permission_escalation']
};

/**
 * Retention enforcement configuration.
 * Controls how the retention trigger archives and protects audit data.
 */
var HIPAA_RETENTION_CONFIG = {
  RETENTION_YEARS: 6,          // Reads from AUTH_CONFIG.AUDIT_LOG_RETENTION_YEARS when available
  ARCHIVE_SHEET_SUFFIX: '_Archive',  // e.g. SessionAuditLog_Archive
  PROTECTION_LEVEL: 'warning', // 'warning' (shows dialog) or 'full' (blocks all edits)
  SHEETS_TO_PROTECT: [
    'SessionAuditLog', 'DataAuditLog', 'DisclosureLog',
    'AccessRequests', 'AmendmentRequests', 'AmendmentNotifications',
    'BreachLog', 'PersonalRepresentatives',
    'LegalHolds', 'RetentionIntegrityLog'
  ],
  // How many rows to process per trigger execution (to stay within 6-min GAS limit)
  BATCH_SIZE: 500
};

// ═══════════════════════════════════════════════════════
// PHASE C — RETENTION CONFIGURATION EXTENSIONS
// ═══════════════════════════════════════════════════════

/**
 * Legal hold configuration — controls litigation preservation behavior.
 * §164.316(b)(2)(i) + FRCP Rule 37(e)
 */
var LEGAL_HOLD_CONFIG = {
  ENABLED: true,
  MAX_HOLDS_PER_SHEET: 10,
  ALLOW_ARCHIVE_HOLDS: true,
  HOLD_TYPES: ['Litigation', 'Regulatory', 'InternalInvestigation', 'Audit', 'Preservation'],
  HOLD_NOTIFICATION_EMAIL: ''
};

/**
 * Archive integrity verification configuration — controls checksum behavior.
 * §164.312(c)(1) — Integrity controls
 */
var INTEGRITY_CONFIG = {
  ALGORITHM: 'SHA_256',
  CHECKSUM_BATCH_SIZE: 1000,
  STORAGE_MODE: 'tracking_sheet',
  TRACKING_SHEET_NAME: 'RetentionIntegrityLog'
};

/**
 * Personal representative configuration.
 */
var REPRESENTATIVE_CONFIG = {
  MAX_REPRESENTATIVES_PER_INDIVIDUAL: 5,  // Prevent abuse
  REQUIRE_ADMIN_APPROVAL: true,           // Admin must approve representative registrations
  ALLOW_SELF_REGISTRATION: false,         // Representatives cannot register themselves
  SUPPORTED_RELATIONSHIP_TYPES: [
    'Parent',
    'LegalGuardian',
    'HealthcarePOA',
    'CourtAppointed',
    'Executor'   // Estate executor for deceased individuals
  ]
};

/**
 * Configurable HIPAA compliance deadlines (in days/years).
 * Update these when regulations change — e.g. Privacy Rule NPRM
 * proposes reducing ACCESS_RESPONSE_DAYS from 30 to 15.
 * See: §164.524(b)(1), §164.526(b)(1), §164.528(c)(1)
 */
var HIPAA_DEADLINES = {
  ACCESS_RESPONSE_DAYS: 30,      // §164.524(b)(1) — proposed NPRM: 15
  ACCESS_EXTENSION_DAYS: 30,     // §164.524(b)(2)(iii)
  AMENDMENT_RESPONSE_DAYS: 60,   // §164.526(b)(1)
  AMENDMENT_EXTENSION_DAYS: 30,  // §164.526(b)(2)(ii)
  ACCOUNTING_RESPONSE_DAYS: 60,  // §164.528(c)(1)
  ACCOUNTING_PERIOD_YEARS: 6,    // §164.528(a)(1) — HITECH EHR: 3
  BREACH_NOTIFICATION_DAYS: 60   // §164.404(b) — individual notification
};


// ═══════════════════════════════════════════════════════
// HIPAA COMPLIANCE — Shared Utilities
// ═══════════════════════════════════════════════════════

/**
 * Generates a unique request ID for tracking compliance requests.
 * Format: PREFIX-YYYYMMDD-UUID8 (e.g. REQ-20260323-a1b2c3d4)
 */
function generateRequestId(prefix) {
  prefix = prefix || 'REQ';
  var date = Utilities.formatDate(new Date(), 'America/New_York', 'yyyyMMdd');
  var uuid = Utilities.getUuid().replace(/-/g, '').substring(0, 8);
  return prefix + '-' + date + '-' + uuid;
}

/**
 * Returns an EST-formatted ISO timestamp for audit entries.
 * Consistent with existing auditLog() timestamp format.
 */
function formatHipaaTimestamp() {
  return Utilities.formatDate(new Date(), 'America/New_York', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
}

/**
 * Validates that the authenticated user can access the specified individual's data.
 * Self-service: user can only access their OWN data.
 * Admin: can access any individual's data.
 *
 * @param {Object} user - Session user object (from validateSessionForData)
 * @param {string} targetEmail - The individual whose data is being accessed
 * @param {string} operationName - Name of the calling operation (for audit)
 * @returns {boolean} true if access is permitted
 * @throws {Error} 'ACCESS_DENIED' if user cannot access this individual's data
 */
/**
 * EXTENDED validateIndividualAccess() — now checks personal representatives.
 * Replaces the Phase A version. The function signature is unchanged, ensuring
 * all existing Phase A callers continue to work without modification.
 *
 * Authorization chain:
 * 1. Admin → access granted (existing behavior)
 * 2. Self-service (user.email === targetEmail) → access granted (existing behavior)
 * 3. Personal representative (user registered + approved + active + not expired) → access granted (NEW)
 * 4. None of the above → ACCESS_DENIED (existing behavior)
 */
function validateIndividualAccess(user, targetEmail, operationName) {
  // Admins can access any individual's data (unchanged from Phase A)
  if (hasPermission(user.role, 'admin')) {
    auditLog('individual_access', user.email, 'admin_access', {
      operation: operationName,
      targetEmail: targetEmail,
      accessType: 'admin_override'
    });
    return true;
  }

  // Self-service: user can access their own data (unchanged from Phase A)
  if (user.email.toLowerCase() === targetEmail.toLowerCase()) {
    return true;
  }

  // NEW: Check personal representative authorization
  var repAuth = isRepresentativeAuthorized(user.email, targetEmail);
  if (repAuth) {
    auditLog('individual_access', user.email, 'representative_access', {
      operation: operationName,
      targetEmail: targetEmail,
      accessType: 'personal_representative',
      representativeId: repAuth.representativeId,
      relationshipType: repAuth.relationshipType
    });
    return true;
  }

  // Not authorized
  auditLog('security_alert', user.email, 'individual_access_denied', {
    operation: operationName,
    targetEmail: targetEmail,
    reason: 'not_self_not_admin_not_representative'
  });
  throw new Error('ACCESS_DENIED');
}

/**
 * Gets or creates a sheet in the Project Data Spreadsheet.
 * Follows the existing _writeAuditLogEntry() auto-creation pattern.
 *
 * @param {string} sheetName - Name of the sheet to get/create
 * @param {string[]} headers - Column headers for new sheet creation
 * @returns {Sheet} The Google Sheet object
 */
function getOrCreateSheet(sheetName, headers) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    var protection = sheet.protect().setDescription('HIPAA Protected — ' + sheetName);
    protection.setWarningOnly(true);
    auditLog('sheet_created', 'system', 'success', {
      sheetName: sheetName,
      columnCount: headers.length,
      protection: 'warning_only'
    });
  }
  return sheet;
}

/**
 * Wraps a Phase A operation with standard error handling.
 * Catches known error types and returns structured responses.
 * HIPAA: never leaks PHI in error messages.
 */
function wrapPhaseAOperation(operationName, sessionToken, operationFn) {
  try {
    var user = validateSessionForData(sessionToken, operationName);
    return operationFn(user);
  } catch (e) {
    var errorType = e.message || 'UNKNOWN_ERROR';
    var safeErrors = {
      'SESSION_EXPIRED': { success: false, error: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' },
      'SESSION_INVALID': { success: false, error: 'SESSION_INVALID', message: 'Invalid session. Please sign in again.' },
      'SESSION_EVICTED': { success: false, error: 'SESSION_EVICTED', message: 'Your session was ended. Please sign in again.' },
      'SESSION_CORRUPT': { success: false, error: 'SESSION_CORRUPT', message: 'Session data is corrupted. Please sign in again.' },
      'SESSION_INTEGRITY_VIOLATION': { success: false, error: 'SESSION_INTEGRITY_VIOLATION', message: 'Session integrity check failed. Please sign in again.' },
      'PERMISSION_DENIED': { success: false, error: 'PERMISSION_DENIED', message: 'You do not have permission for this operation.' },
      'ACCESS_DENIED': { success: false, error: 'ACCESS_DENIED', message: 'You can only access your own data.' },
      'NOT_FOUND': { success: false, error: 'NOT_FOUND', message: 'The requested record was not found.' },
      'INVALID_INPUT': { success: false, error: 'INVALID_INPUT', message: 'Invalid input provided.' }
    };
    if (safeErrors[errorType]) {
      return safeErrors[errorType];
    }
    auditLog('phase_a_error', 'system', 'error', {
      operation: operationName,
      errorType: errorType,
      errorMessage: e.message,
      stack: e.stack
    });
    return { success: false, error: 'INTERNAL_ERROR', message: 'An internal error occurred. Please try again.' };
  }
}

// ═══════════════════════════════════════════════════════
// HIPAA COMPLIANCE — Phase A: Individual Rights
// ═══════════════════════════════════════════════════════

// PHASE A — ITEM #19: DISCLOSURE ACCOUNTING (§164.528)
// ═══════════════════════════════════════════════════════

/**
 * Records a PHI disclosure to the DisclosureLog sheet.
 * Called whenever PHI is shared with an external party.
 */
function recordDisclosure(params) {
  var required = ['recipientName', 'recipientType', 'phiDescription', 'purpose', 'individualEmail'];
  for (var i = 0; i < required.length; i++) {
    if (!params[required[i]]) {
      throw new Error('INVALID_INPUT');
    }
  }
  var disclosureId = generateRequestId('DISC');
  var timestamp = formatHipaaTimestamp();
  var isExempt = params.isExempt || false;
  var exemptionType = params.exemptionType || '';
  var triggeredBy = 'system';
  if (params.sessionToken) {
    try {
      var user = validateSessionForData(params.sessionToken, 'recordDisclosure');
      triggeredBy = user.email;
    } catch (e) {
      triggeredBy = 'system_automated';
    }
  }
  var dataCategory = params.dataCategory || 'General';
  var source = params.source || 'CoveredEntity';
  var headers = [
    'Timestamp', 'DisclosureID', 'IndividualEmail', 'RecipientName',
    'RecipientType', 'PHIDescription', 'Purpose', 'IsExempt',
    'ExemptionType', 'DataCategory', 'Source', 'TriggeredBy'
  ];
  var sheet = getOrCreateSheet('DisclosureLog', headers);
  sheet.appendRow([
    timestamp, disclosureId, params.individualEmail, params.recipientName,
    params.recipientType, params.phiDescription, params.purpose, isExempt,
    exemptionType, dataCategory, source, triggeredBy
  ]);
  auditLog('disclosure_recorded', triggeredBy, 'success', {
    disclosureId: disclosureId,
    recipientName: params.recipientName,
    purpose: params.purpose,
    isExempt: isExempt,
    individualEmail: params.individualEmail
  });
  return { success: true, disclosureId: disclosureId };
}

/**
 * Returns the disclosure accounting for the authenticated individual.
 * Filters to non-exempt disclosures within the configured lookback period.
 * Supports HITECH EHR dual-mode: when options.includeEhrTpo is true,
 * includes TPO disclosures with a 3-year lookback per HITECH §13405(c).
 *
 * @param {string} sessionToken — Session token
 * @param {string} [targetEmail] — Email to look up (defaults to authenticated user)
 * @param {Object} [options] — Optional settings
 * @param {boolean} [options.includeEhrTpo] — Include TPO disclosures with 3-year lookback (HITECH EHR mode)
 */
function getDisclosureAccounting(sessionToken, targetEmail, options) {
  return wrapPhaseAOperation('getDisclosureAccounting', sessionToken, function(user) {
    checkPermission(user, 'read', 'getDisclosureAccounting');
    var lookupEmail = targetEmail || user.email;
    validateIndividualAccess(user, lookupEmail, 'getDisclosureAccounting');
    var requestId = generateRequestId('ACCT');
    var now = new Date();
    options = options || {};
    var includeEhrTpo = options.includeEhrTpo || false;
    var lookbackYears = HIPAA_DEADLINES.ACCOUNTING_PERIOD_YEARS;
    var sixYearsAgo = new Date(now.getTime() - (lookbackYears * 365.25 * 24 * 60 * 60 * 1000));
    // HITECH §13405(c): EHR TPO disclosures use 3-year lookback
    var ehrTpoLookback = includeEhrTpo
      ? new Date(now.getTime() - (3 * 365.25 * 24 * 60 * 60 * 1000))
      : null;
    var headers = [
      'Timestamp', 'DisclosureID', 'IndividualEmail', 'RecipientName',
      'RecipientType', 'PHIDescription', 'Purpose', 'IsExempt',
      'ExemptionType', 'DataCategory', 'Source', 'TriggeredBy'
    ];
    var sheet = getOrCreateSheet('DisclosureLog', headers);
    var data = sheet.getDataRange().getValues();
    var disclosures = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var rowEmail = String(row[2]).toLowerCase();
      var rowIsExempt = row[7] === true || row[7] === 'TRUE' || row[7] === 'true';
      var rowDate = new Date(row[0]);
      var rowPurpose = String(row[6] || '').toLowerCase();
      var isTpoPurpose = (rowPurpose === 'treatment' || rowPurpose === 'payment' || rowPurpose === 'healthcare operations');
      if (rowEmail !== lookupEmail.toLowerCase()) continue;
      // Standard §164.528 accounting: non-exempt, non-TPO, 6-year lookback
      var includeStandard = !rowIsExempt && !isTpoPurpose && rowDate >= sixYearsAgo;
      // HITECH EHR mode: TPO disclosures with 3-year lookback
      var includeEhr = includeEhrTpo && !rowIsExempt && isTpoPurpose && ehrTpoLookback && rowDate >= ehrTpoLookback;
      if (includeStandard || includeEhr) {
        disclosures.push({
          disclosureId: row[1],
          date: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
          recipientName: row[3],
          recipientType: row[4],
          phiDescription: row[5],
          purpose: row[6],
          dataCategory: row[9] || 'General',
          source: row[10] || 'CoveredEntity',
          isEhrTpo: includeEhr && !includeStandard
        });
      }
    }
    disclosures.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    dataAuditLog(user, 'read', 'disclosure_accounting', requestId, {
      targetEmail: lookupEmail,
      disclosureCount: disclosures.length,
      periodStart: sixYearsAgo.toISOString(),
      periodEnd: now.toISOString(),
      includeEhrTpo: includeEhrTpo
    });
    return {
      success: true, requestId: requestId, individualEmail: lookupEmail,
      disclosures: disclosures, count: disclosures.length,
      periodStart: sixYearsAgo.toISOString(), periodEnd: now.toISOString(),
      includeEhrTpo: includeEhrTpo,
      generatedAt: formatHipaaTimestamp()
    };
  });
}

/**
 * Exports the disclosure accounting in JSON or CSV format.
 */
function exportDisclosureAccounting(sessionToken, format) {
  return wrapPhaseAOperation('exportDisclosureAccounting', sessionToken, function(user) {
    checkPermission(user, 'export', 'exportDisclosureAccounting');
    var accounting = getDisclosureAccounting(sessionToken);
    if (!accounting.success) return accounting;
    format = (format || 'json').toLowerCase();
    var dateStr = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
    var filename = 'disclosure-accounting-' + dateStr;
    if (format === 'csv') {
      var csvRows = ['Date,DisclosureID,RecipientName,RecipientType,PHIDescription,Purpose,DataCategory,Source'];
      for (var i = 0; i < accounting.disclosures.length; i++) {
        var d = accounting.disclosures[i];
        csvRows.push([
          '"' + d.date + '"',
          '"' + d.disclosureId + '"',
          '"' + (d.recipientName || '').replace(/"/g, '""') + '"',
          '"' + d.recipientType + '"',
          '"' + (d.phiDescription || '').replace(/"/g, '""') + '"',
          '"' + d.purpose + '"',
          '"' + (d.dataCategory || 'General') + '"',
          '"' + (d.source || 'CoveredEntity') + '"'
        ].join(','));
      }
      return { success: true, format: 'csv', data: csvRows.join('\n'), filename: filename + '.csv' };
    }
    return { success: true, format: 'json', data: JSON.stringify(accounting, null, 2), filename: filename + '.json' };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE A — ITEM #23: RIGHT OF ACCESS (§164.524)
// ═══════════════════════════════════════════════════════

/**
 * Creates an access request and immediately generates the export.
 * For testauthgas1 (small dataset), export is synchronous.
 */
function requestDataExport(sessionToken, format) {
  return wrapPhaseAOperation('requestDataExport', sessionToken, function(user) {
    checkPermission(user, 'export', 'requestDataExport');
    var requestId = generateRequestId('ACCESS');
    var requestDate = formatHipaaTimestamp();
    format = (format || 'json').toLowerCase();
    var arHeaders = [
      'RequestID', 'IndividualEmail', 'RequestDate', 'Format',
      'Status', 'ResponseDate', 'Notes'
    ];
    var arSheet = getOrCreateSheet('AccessRequests', arHeaders);
    arSheet.appendRow([requestId, user.email, requestDate, format, 'Processing', '', '']);
    var individualData;
    try {
      individualData = getIndividualData(sessionToken);
    } catch (e) {
      updateAccessRequestStatus(arSheet, requestId, 'Failed', 'Export generation failed: ' + e.message);
      throw e;
    }
    var dateStr = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
    var filename = 'my-data-export-' + dateStr;
    var exportData;
    if (format === 'csv') {
      exportData = convertToCSV(individualData);
      filename += '.csv';
    } else {
      exportData = JSON.stringify(individualData, null, 2);
      filename += '.json';
    }
    var responseDate = formatHipaaTimestamp();
    updateAccessRequestStatus(arSheet, requestId, 'Completed', '');
    dataAuditLog(user, 'export', 'designated_record_set', requestId, {
      format: format,
      recordCount: individualData.summary.totalRecords,
      sheetsQueried: individualData.summary.sheetsQueried
    });
    return {
      success: true, requestId: requestId, format: format,
      data: exportData, filename: filename,
      requestDate: requestDate, responseDate: responseDate
    };
  });
}

/** Helper: update AccessRequests sheet status by requestId */
function updateAccessRequestStatus(sheet, requestId, status, notes) {
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === requestId) {
      sheet.getRange(r + 1, 5).setValue(status);
      sheet.getRange(r + 1, 6).setValue(formatHipaaTimestamp());
      if (notes) sheet.getRange(r + 1, 7).setValue(notes);
      return;
    }
  }
}

/**
 * Retrieves ALL records from the Designated Record Set for the authenticated individual.
 */
function getIndividualData(sessionToken) {
  var user = validateSessionForData(sessionToken, 'getIndividualData');
  checkPermission(user, 'read', 'getIndividualData');
  var email = user.email.toLowerCase();
  var result = {
    individual: {
      email: user.email, displayName: user.displayName,
      role: user.role, exportDate: formatHipaaTimestamp(),
      generatedBy: 'testauthgas1 v' + VERSION
    },
    records: {},
    summary: { totalRecords: 0, sheetsQueried: 0 }
  };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetNames = [
    { name: SHEET_NAME, key: 'notes' },
    { name: 'SessionAuditLog', key: 'sessionHistory' },
    { name: 'DataAuditLog', key: 'dataAccessHistory' },
    { name: 'DisclosureLog', key: 'disclosures' },
    { name: 'AmendmentRequests', key: 'amendments' },
    { name: 'AccessRequests', key: 'accessRequests' }
  ];
  for (var i = 0; i < sheetNames.length; i++) {
    var s = ss.getSheetByName(sheetNames[i].name);
    if (s) {
      result.records[sheetNames[i].key] = extractRecordsForEmail(s, email, sheetNames[i].key);
      result.summary.sheetsQueried++;
    }
  }
  for (var key in result.records) {
    result.summary.totalRecords += result.records[key].length;
  }
  return result;
}

/**
 * Extracts rows from a sheet that match the individual's email.
 * Generic helper — searches all columns for email match.
 */
function extractRecordsForEmail(sheet, email, recordType) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var records = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var matched = false;
    for (var c = 0; c < row.length; c++) {
      if (String(row[c]).toLowerCase() === email) {
        matched = true;
        break;
      }
    }
    if (matched) {
      var record = { _recordType: recordType, _rowIndex: r + 1 };
      for (var h = 0; h < headers.length; h++) {
        var _val = row[h];
        record[String(headers[h])] = _val instanceof Date ? _val.toISOString() : _val;
      }
      records.push(record);
    }
  }
  return records;
}

/**
 * Converts the getIndividualData() output to CSV format.
 */
function convertToCSV(individualData) {
  var lines = [];
  lines.push('# Data Export for ' + individualData.individual.email);
  lines.push('# Generated: ' + individualData.individual.exportDate);
  lines.push('# By: ' + individualData.individual.generatedBy);
  lines.push('');
  for (var recordType in individualData.records) {
    var records = individualData.records[recordType];
    if (records.length === 0) continue;
    lines.push('# === ' + recordType.toUpperCase() + ' (' + records.length + ' records) ===');
    var headers = [];
    for (var key in records[0]) {
      if (key.charAt(0) !== '_') headers.push(key);
    }
    lines.push(headers.join(','));
    for (var i = 0; i < records.length; i++) {
      var values = [];
      for (var h = 0; h < headers.length; h++) {
        var val = String(records[i][headers[h]] || '');
        if (/^[=+@\-]/.test(val)) val = "'" + val;
        if (val.indexOf(',') > -1 || val.indexOf('"') > -1 || val.indexOf('\n') > -1) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        values.push(val);
      }
      lines.push(values.join(','));
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════
// PHASE A — ITEM #24: RIGHT TO AMENDMENT (§164.526)
// ═══════════════════════════════════════════════════════

/**
 * Creates an amendment request for a specific record.
 */
function requestAmendment(sessionToken, recordId, currentContent, proposedChange, reason) {
  return wrapPhaseAOperation('requestAmendment', sessionToken, function(user) {
    checkPermission(user, 'amend', 'requestAmendment');
    if (!recordId || !proposedChange || !reason) {
      throw new Error('INVALID_INPUT');
    }
    var amendmentId = generateRequestId('AMEND');
    var requestDate = formatHipaaTimestamp();
    var deadline = new Date();
    deadline.setDate(deadline.getDate() + HIPAA_DEADLINES.AMENDMENT_RESPONSE_DAYS);
    var deadlineStr = Utilities.formatDate(deadline, 'America/New_York', "yyyy-MM-dd'T'HH:mm:ss");
    var headers = [
      'AmendmentID', 'IndividualEmail', 'RecordID', 'RequestDate',
      'CurrentContent', 'ProposedChange', 'Reason', 'Status',
      'ReviewerEmail', 'DecisionDate', 'DecisionReason',
      'DisagreementStatement', 'DisagreementDate', 'Deadline', 'Notes'
    ];
    var sheet = getOrCreateSheet('AmendmentRequests', headers);
    sheet.appendRow([
      amendmentId, user.email, recordId, requestDate,
      currentContent, proposedChange, reason, 'Pending',
      '', '', '', '', '', deadlineStr, ''
    ]);
    dataAuditLog(user, 'create', 'amendment_request', amendmentId, {
      recordId: recordId, reason: reason, deadline: deadlineStr
    });
    auditLog('amendment_requested', user.email, 'success', {
      amendmentId: amendmentId, recordId: recordId
    });
    return {
      success: true, amendmentId: amendmentId, status: 'Pending',
      deadline: deadlineStr,
      message: 'Your amendment request has been submitted. You will be notified of the decision within ' + HIPAA_DEADLINES.AMENDMENT_RESPONSE_DAYS + ' days.'
    };
  });
}

/**
 * Reviews an amendment request — approves or denies it.
 * Only users with 'admin' permission can review amendments.
 */
function reviewAmendment(sessionToken, amendmentId, decision, decisionReason) {
  return wrapPhaseAOperation('reviewAmendment', sessionToken, function(user) {
    checkPermission(user, 'admin', 'reviewAmendment');
    if (!amendmentId || !decision) throw new Error('INVALID_INPUT');
    if (decision !== 'Approved' && decision !== 'Denied') throw new Error('INVALID_INPUT');
    if (decision === 'Denied' && !decisionReason) throw new Error('INVALID_INPUT');
    var headers = [
      'AmendmentID', 'IndividualEmail', 'RecordID', 'RequestDate',
      'CurrentContent', 'ProposedChange', 'Reason', 'Status',
      'ReviewerEmail', 'DecisionDate', 'DecisionReason',
      'DisagreementStatement', 'DisagreementDate', 'Deadline', 'Notes'
    ];
    var sheet = getOrCreateSheet('AmendmentRequests', headers);
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var amendmentRow = null;
    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === amendmentId) {
        rowIndex = r + 1;
        amendmentRow = data[r];
        break;
      }
    }
    if (rowIndex === -1) throw new Error('NOT_FOUND');
    var currentStatus = amendmentRow[7];
    if (currentStatus !== 'Pending' && currentStatus !== 'UnderReview') {
      return { success: false, error: 'INVALID_STATE', message: 'This amendment is in status "' + currentStatus + '" and cannot be reviewed.' };
    }
    var decisionDate = formatHipaaTimestamp();
    sheet.getRange(rowIndex, 8).setValue(decision);
    sheet.getRange(rowIndex, 9).setValue(user.email);
    sheet.getRange(rowIndex, 10).setValue(decisionDate);
    sheet.getRange(rowIndex, 11).setValue(decisionReason || '');
    dataAuditLog(user, 'review', 'amendment_request', amendmentId, {
      decision: decision, decisionReason: decisionReason || '',
      individualEmail: amendmentRow[1], recordId: amendmentRow[2]
    });
    auditLog('amendment_reviewed', user.email, decision.toLowerCase(), {
      amendmentId: amendmentId, individualEmail: amendmentRow[1]
    });
    var message = decision === 'Approved'
      ? 'Amendment approved. The correction has been appended to the record.'
      : 'Amendment denied. Reason: ' + decisionReason + '. The individual has the right to file a statement of disagreement.';
    return { success: true, amendmentId: amendmentId, decision: decision, decisionDate: decisionDate, message: message };
  });
}

/**
 * Allows an individual to file a statement of disagreement after a denial.
 * Per §164.526(d)(3), the statement is appended to the record.
 */
function submitDisagreement(sessionToken, amendmentId, statement) {
  return wrapPhaseAOperation('submitDisagreement', sessionToken, function(user) {
    checkPermission(user, 'amend', 'submitDisagreement');
    if (!amendmentId || !statement) throw new Error('INVALID_INPUT');
    var headers = [
      'AmendmentID', 'IndividualEmail', 'RecordID', 'RequestDate',
      'CurrentContent', 'ProposedChange', 'Reason', 'Status',
      'ReviewerEmail', 'DecisionDate', 'DecisionReason',
      'DisagreementStatement', 'DisagreementDate', 'Deadline', 'Notes'
    ];
    var sheet = getOrCreateSheet('AmendmentRequests', headers);
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var amendmentRow = null;
    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === amendmentId) {
        rowIndex = r + 1;
        amendmentRow = data[r];
        break;
      }
    }
    if (rowIndex === -1) throw new Error('NOT_FOUND');
    validateIndividualAccess(user, amendmentRow[1], 'submitDisagreement');
    if (amendmentRow[7] !== 'Denied') {
      return { success: false, error: 'INVALID_STATE', message: 'A statement of disagreement can only be filed for denied amendments.' };
    }
    if (amendmentRow[11]) {
      return { success: false, error: 'ALREADY_EXISTS', message: 'A statement of disagreement has already been filed for this amendment.' };
    }
    var disagreementDate = formatHipaaTimestamp();
    sheet.getRange(rowIndex, 8).setValue('Denied — Disagreement Filed');
    sheet.getRange(rowIndex, 12).setValue(statement);
    sheet.getRange(rowIndex, 13).setValue(disagreementDate);
    dataAuditLog(user, 'create', 'disagreement_statement', amendmentId, {
      statementLength: statement.length
    });
    auditLog('disagreement_filed', user.email, 'success', { amendmentId: amendmentId });
    return { success: true, amendmentId: amendmentId, status: 'Denied — Disagreement Filed', message: 'Your statement of disagreement has been recorded and appended to the amendment record.' };
  });
}

/**
 * Returns the complete amendment history for a specific record.
 */
function getAmendmentHistory(sessionToken, recordId) {
  return wrapPhaseAOperation('getAmendmentHistory', sessionToken, function(user) {
    checkPermission(user, 'read', 'getAmendmentHistory');
    if (!recordId) throw new Error('INVALID_INPUT');
    var headers = [
      'AmendmentID', 'IndividualEmail', 'RecordID', 'RequestDate',
      'CurrentContent', 'ProposedChange', 'Reason', 'Status',
      'ReviewerEmail', 'DecisionDate', 'DecisionReason',
      'DisagreementStatement', 'DisagreementDate', 'Deadline', 'Notes'
    ];
    var sheet = getOrCreateSheet('AmendmentRequests', headers);
    var data = sheet.getDataRange().getValues();
    var amendments = [];
    for (var r = 1; r < data.length; r++) {
      if (data[r][2] === recordId) {
        validateIndividualAccess(user, data[r][1], 'getAmendmentHistory');
        var _rd = data[r][3], _dd = data[r][9], _dgd = data[r][12];
        amendments.push({
          amendmentId: data[r][0], requestDate: _rd instanceof Date ? _rd.toISOString() : String(_rd || ''),
          currentContent: data[r][4], proposedChange: data[r][5],
          reason: data[r][6], status: data[r][7],
          reviewerEmail: data[r][8] || null, decisionDate: _dd instanceof Date ? _dd.toISOString() : (_dd || null),
          decisionReason: data[r][10] || null,
          hasDisagreement: !!data[r][11], disagreementDate: _dgd instanceof Date ? _dgd.toISOString() : (_dgd || null)
        });
      }
    }
    amendments.sort(function(a, b) { return new Date(b.requestDate) - new Date(a.requestDate); });
    dataAuditLog(user, 'read', 'amendment_history', recordId, {
      amendmentCount: amendments.length
    });
    return { success: true, recordId: recordId, amendments: amendments, count: amendments.length };
  });
}

/**
 * Returns all pending/under-review amendment requests (admin only).
 * Used by the amendment review panel to list amendments needing action.
 */
function getPendingAmendments(sessionToken) {
  return wrapPhaseAOperation('getPendingAmendments', sessionToken, function(user) {
    checkPermission(user, 'admin', 'getPendingAmendments');
    var headers = [
      'AmendmentID', 'IndividualEmail', 'RecordID', 'RequestDate',
      'CurrentContent', 'ProposedChange', 'Reason', 'Status',
      'ReviewerEmail', 'DecisionDate', 'DecisionReason',
      'DisagreementStatement', 'DisagreementDate', 'Deadline', 'Notes'
    ];
    var sheet = getOrCreateSheet('AmendmentRequests', headers);
    var data = sheet.getDataRange().getValues();
    var pending = [];
    for (var r = 1; r < data.length; r++) {
      var status = data[r][7];
      if (status === 'Pending' || status === 'UnderReview') {
        pending.push({
          amendmentId: data[r][0], individualEmail: data[r][1],
          recordId: data[r][2], requestDate: data[r][3] instanceof Date ? data[r][3].toISOString() : String(data[r][3]),
          currentContent: data[r][4], proposedChange: data[r][5],
          reason: data[r][6], status: status, deadline: data[r][13] instanceof Date ? data[r][13].toISOString() : String(data[r][13])
        });
      }
    }
    pending.sort(function(a, b) { return new Date(a.requestDate) - new Date(b.requestDate); });
    auditLog('admin_action', user.email, 'list_pending_amendments', { count: pending.length });
    return pending;
  });
}

// ═══════════════════════════════════════════════════════
// PHASE A — 30-DAY EXTENSION WORKFLOWS (§164.524/§164.526)
// ═══════════════════════════════════════════════════════

/**
 * Requests a 30-day extension for an access request.
 * Per §164.524(b)(2)(i), a covered entity may extend the response period
 * by no more than 30 days with written notice to the individual.
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} requestId — The AccessRequests ID to extend
 * @param {string} reason — Written statement explaining why extension is needed
 */
function requestAccessExtension(sessionToken, requestId, reason) {
  return wrapPhaseAOperation('requestAccessExtension', sessionToken, function(user) {
    checkPermission(user, 'admin', 'requestAccessExtension');
    if (!requestId || !reason) throw new Error('INVALID_INPUT');
    var arHeaders = [
      'RequestID', 'IndividualEmail', 'RequestDate', 'Format',
      'Status', 'ResponseDate', 'Notes'
    ];
    var sheet = getOrCreateSheet('AccessRequests', arHeaders);
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var requestRow = null;
    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === requestId) {
        rowIndex = r + 1;
        requestRow = data[r];
        break;
      }
    }
    if (rowIndex === -1) throw new Error('NOT_FOUND');
    var currentStatus = String(requestRow[4]);
    if (currentStatus === 'Completed' || currentStatus === 'Denied' || currentStatus === 'Extended') {
      return { success: false, error: 'INVALID_STATE', message: 'Request is in status "' + currentStatus + '" and cannot be extended.' };
    }
    var originalDate = new Date(requestRow[2]);
    var extendedDeadline = new Date(originalDate.getTime() +
      ((HIPAA_DEADLINES.ACCESS_RESPONSE_DAYS + HIPAA_DEADLINES.ACCESS_EXTENSION_DAYS) * 24 * 60 * 60 * 1000));
    var extendedDeadlineStr = Utilities.formatDate(extendedDeadline, 'America/New_York', "yyyy-MM-dd'T'HH:mm:ss");
    sheet.getRange(rowIndex, 5).setValue('Extended');
    sheet.getRange(rowIndex, 7).setValue('Extension granted: ' + reason + ' | New deadline: ' + extendedDeadlineStr);
    dataAuditLog(user, 'update', 'access_extension', requestId, {
      reason: reason,
      originalDate: requestRow[2],
      newDeadline: extendedDeadlineStr,
      individualEmail: requestRow[1]
    });
    auditLog('access_extension', user.email, 'success', {
      requestId: requestId, individualEmail: requestRow[1]
    });
    return {
      success: true, requestId: requestId, status: 'Extended',
      newDeadline: extendedDeadlineStr,
      message: 'Extension granted. The individual must be notified in writing. New deadline: ' + extendedDeadlineStr
    };
  });
}

/**
 * Requests a 30-day extension for an amendment request.
 * Per §164.526(b)(2)(i), a covered entity may extend the amendment response
 * period by no more than 30 days with written notice to the individual.
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} amendmentId — The AmendmentRequests ID to extend
 * @param {string} reason — Written statement explaining why extension is needed
 */
function requestAmendmentExtension(sessionToken, amendmentId, reason) {
  return wrapPhaseAOperation('requestAmendmentExtension', sessionToken, function(user) {
    checkPermission(user, 'admin', 'requestAmendmentExtension');
    if (!amendmentId || !reason) throw new Error('INVALID_INPUT');
    var headers = [
      'AmendmentID', 'IndividualEmail', 'RecordID', 'RequestDate',
      'CurrentContent', 'ProposedChange', 'Reason', 'Status',
      'ReviewerEmail', 'DecisionDate', 'DecisionReason',
      'DisagreementStatement', 'DisagreementDate', 'Deadline', 'Notes'
    ];
    var sheet = getOrCreateSheet('AmendmentRequests', headers);
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var amendmentRow = null;
    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === amendmentId) {
        rowIndex = r + 1;
        amendmentRow = data[r];
        break;
      }
    }
    if (rowIndex === -1) throw new Error('NOT_FOUND');
    var currentStatus = String(amendmentRow[7]);
    if (currentStatus !== 'Pending' && currentStatus !== 'UnderReview') {
      return { success: false, error: 'INVALID_STATE', message: 'Amendment is in status "' + currentStatus + '" and cannot be extended.' };
    }
    var originalDate = new Date(amendmentRow[3]);
    var extendedDeadline = new Date(originalDate.getTime() +
      ((HIPAA_DEADLINES.AMENDMENT_RESPONSE_DAYS + HIPAA_DEADLINES.AMENDMENT_EXTENSION_DAYS) * 24 * 60 * 60 * 1000));
    var extendedDeadlineStr = Utilities.formatDate(extendedDeadline, 'America/New_York', "yyyy-MM-dd'T'HH:mm:ss");
    sheet.getRange(rowIndex, 8).setValue('Extended');
    sheet.getRange(rowIndex, 14).setValue(extendedDeadlineStr);
    sheet.getRange(rowIndex, 15).setValue('Extension: ' + reason);
    dataAuditLog(user, 'update', 'amendment_extension', amendmentId, {
      reason: reason,
      originalDeadline: amendmentRow[13],
      newDeadline: extendedDeadlineStr,
      individualEmail: amendmentRow[1]
    });
    auditLog('amendment_extension', user.email, 'success', {
      amendmentId: amendmentId, individualEmail: amendmentRow[1]
    });
    return {
      success: true, amendmentId: amendmentId, status: 'Extended',
      newDeadline: extendedDeadlineStr,
      message: 'Extension granted. The individual must be notified in writing. New deadline: ' + extendedDeadlineStr
    };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE A — FORMAL DENIAL NOTICE (§164.524(d))
// ═══════════════════════════════════════════════════════

/**
 * Generates a formal written denial notice per §164.524(d)(2).
 * Required elements:
 *   (i)   Basis for the denial
 *   (ii)  Individual's right to submit a statement of disagreement (for reviewable denials)
 *   (iii) Description of how the individual may complain to the covered entity
 *   (iv)  Name/title of contact person or office for complaints
 *   (v)   How to file a complaint with the HHS Secretary
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} requestType — 'access' or 'amendment'
 * @param {string} requestId — The request ID (AccessRequests or AmendmentRequests)
 * @param {Object} params — Additional denial parameters
 * @param {string} params.basisForDenial — The specific legal basis
 * @param {boolean} [params.isReviewable] — Whether the denial is reviewable (default: true)
 * @param {string} [params.contactPerson] — Name of complaint contact (default: HIPAA Privacy Officer)
 * @param {string} [params.contactOffice] — Office for complaints (default: Privacy Office)
 */
function generateDenialNotice(sessionToken, requestType, requestId, params) {
  return wrapPhaseAOperation('generateDenialNotice', sessionToken, function(user) {
    checkPermission(user, 'admin', 'generateDenialNotice');
    if (!requestType || !requestId || !params || !params.basisForDenial) {
      throw new Error('INVALID_INPUT');
    }
    if (requestType !== 'access' && requestType !== 'amendment') {
      throw new Error('INVALID_INPUT');
    }
    var isReviewable = params.isReviewable !== false;
    var contactPerson = params.contactPerson || 'HIPAA Privacy Officer';
    var contactOffice = params.contactOffice || 'Privacy Office';
    var noticeDate = formatHipaaTimestamp();
    var notice = {
      noticeType: 'HIPAA Formal Denial Notice',
      date: noticeDate,
      requestType: requestType,
      requestId: requestId,
      sections: {
        basisForDenial: {
          heading: '(i) Basis for Denial',
          content: params.basisForDenial
        },
        rightToDisagree: {
          heading: '(ii) Right to Submit Statement of Disagreement',
          content: isReviewable
            ? 'You have the right to submit a written statement of disagreement with the denial. '
              + 'Your statement will be appended to the designated record set and included with any future disclosures of the disputed information. '
              + 'If you choose not to submit a statement of disagreement, you may request that the covered entity include your request and the denial with any future disclosures.'
            : 'This denial is based on an unreviewable ground. The denied information was not created by this covered entity, '
              + 'is not part of the designated record set, or the information is exempted from access under the Privacy Rule.'
        },
        complaintProcess: {
          heading: '(iii) How to File a Complaint with the Covered Entity',
          content: 'You may file a complaint regarding this denial by contacting the ' + contactOffice + '. '
            + 'Contact person: ' + contactPerson + '. '
            + 'Complaints should be submitted in writing and will be reviewed within 30 days.'
        },
        contactInformation: {
          heading: '(iv) Complaint Contact',
          content: 'Name/Title: ' + contactPerson + ' | Office: ' + contactOffice
        },
        hhsComplaint: {
          heading: '(v) Filing a Complaint with the Secretary of HHS',
          content: 'You have the right to file a complaint with the Secretary of the U.S. Department of Health and Human Services. '
            + 'Complaints may be filed online at https://www.hhs.gov/hipaa/filing-a-complaint/ '
            + 'or by mail to: Office for Civil Rights, U.S. Department of Health and Human Services, '
            + '200 Independence Avenue S.W., Washington, D.C. 20201. '
            + 'Filing a complaint will not result in retaliation.'
        }
      },
      isReviewable: isReviewable,
      generatedBy: user.email,
      generatedAt: noticeDate
    };
    dataAuditLog(user, 'create', 'denial_notice', requestId, {
      requestType: requestType,
      basisForDenial: params.basisForDenial,
      isReviewable: isReviewable
    });
    auditLog('denial_notice_generated', user.email, 'success', {
      requestType: requestType, requestId: requestId
    });
    return { success: true, notice: notice };
  });
}


// ═══════════════════════════════════════════════════════
// HIPAA COMPLIANCE — Phase B: Organizational Compliance
// ═══════════════════════════════════════════════════════

// PHASE B — P3: PERSONAL REPRESENTATIVE ACCESS (#25)
// ═══════════════════════════════════════════════════════

/**
 * Registers a personal representative for an individual.
 * Only admins can register representatives.
 * The registration requires admin approval (separate step) unless auto-approved by config.
 *
 * @param {string} sessionToken — Admin session token
 * @param {Object} params
 * @param {string} params.representativeEmail — The representative's email
 * @param {string} params.individualEmail — The individual they will represent
 * @param {string} params.relationshipType — One of REPRESENTATIVE_CONFIG.SUPPORTED_RELATIONSHIP_TYPES
 * @param {string} [params.expirationDate] — When authorization expires (ISO 8601, null = indefinite)
 * @param {string} [params.documentReference] — Reference to authorization document
 * @param {string} [params.notes] — Additional notes
 * @returns {Object} { success, representativeId, approvalStatus }
 */
function registerPersonalRepresentative(sessionToken, params) {
  return wrapHipaaOperation('registerPersonalRepresentative', sessionToken, function(user) {
    checkPermission(user, 'admin', 'registerPersonalRepresentative');

    if (!params || !params.representativeEmail || !params.individualEmail || !params.relationshipType) {
      throw new Error('INVALID_INPUT');
    }

    // Validate relationship type
    if (REPRESENTATIVE_CONFIG.SUPPORTED_RELATIONSHIP_TYPES.indexOf(params.relationshipType) === -1) {
      throw new Error('INVALID_INPUT');
    }

    // Check representative limit per individual
    var headers = [
      'RepresentativeID', 'RepresentativeEmail', 'IndividualEmail',
      'RelationshipType', 'AuthorizationDate', 'ExpirationDate',
      'Status', 'ApprovalStatus', 'ApprovedBy', 'ApprovalDate',
      'DocumentReference', 'Notes'
    ];
    var sheet = getOrCreateSheet('PersonalRepresentatives', headers);
    var data = sheet.getDataRange().getValues();

    var activeCount = 0;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][2] || '').toLowerCase() === params.individualEmail.toLowerCase()
          && data[r][6] === 'Active') {
        activeCount++;
      }
      // Check for duplicate registration
      if (String(data[r][1] || '').toLowerCase() === params.representativeEmail.toLowerCase()
          && String(data[r][2] || '').toLowerCase() === params.individualEmail.toLowerCase()
          && data[r][6] === 'Active') {
        throw new Error('ALREADY_EXISTS');
      }
    }

    if (activeCount >= REPRESENTATIVE_CONFIG.MAX_REPRESENTATIVES_PER_INDIVIDUAL) {
      return {
        success: false,
        error: 'LIMIT_EXCEEDED',
        message: 'Maximum ' + REPRESENTATIVE_CONFIG.MAX_REPRESENTATIVES_PER_INDIVIDUAL
          + ' active representatives per individual.'
      };
    }

    var repId = generateRequestId('REP');
    var timestamp = formatHipaaTimestamp();
    var approvalStatus = REPRESENTATIVE_CONFIG.REQUIRE_ADMIN_APPROVAL ? 'Approved' : 'Pending';
    // Since admin is doing the registration, auto-approve
    var approvedBy = user.email;

    var row = [
      repId,
      params.representativeEmail,
      params.individualEmail,
      params.relationshipType,
      timestamp,  // AuthorizationDate
      params.expirationDate || '',
      'Active',
      approvalStatus,
      approvedBy,
      timestamp,  // ApprovalDate
      params.documentReference || '',
      params.notes || ''
    ];
    sheet.appendRow(row);

    dataAuditLog(user, 'create', 'personal_representative', repId, {
      representativeEmail: params.representativeEmail,
      individualEmail: params.individualEmail,
      relationshipType: params.relationshipType,
      approvalStatus: approvalStatus
    });

    return {
      success: true,
      representativeId: repId,
      approvalStatus: approvalStatus
    };
  });
}

/**
 * Returns the list of personal representatives for an individual.
 * Admin can query any individual; non-admin can only see their own representatives.
 *
 * @param {string} sessionToken — Session token
 * @param {string} [targetEmail] — For admin: specify individual's email
 * @returns {Object} { success, representatives: [...], count }
 */
function getPersonalRepresentatives(sessionToken, targetEmail) {
  return wrapHipaaOperation('getPersonalRepresentatives', sessionToken, function(user) {
    var email = targetEmail || user.email;
    validateIndividualAccess(user, email, 'getPersonalRepresentatives');

    var headers = [
      'RepresentativeID', 'RepresentativeEmail', 'IndividualEmail',
      'RelationshipType', 'AuthorizationDate', 'ExpirationDate',
      'Status', 'ApprovalStatus', 'ApprovedBy', 'ApprovalDate',
      'DocumentReference', 'Notes'
    ];
    var sheet = getOrCreateSheet('PersonalRepresentatives', headers);
    var data = sheet.getDataRange().getValues();

    var representatives = [];
    for (var r = 1; r < data.length; r++) {
      var indEmail = String(data[r][2] || '').toLowerCase();
      if (indEmail !== email.toLowerCase()) continue;

      representatives.push({
        representativeId: data[r][0],
        representativeEmail: data[r][1],
        relationshipType: data[r][3],
        authorizationDate: data[r][4] ? String(data[r][4]) : null,
        expirationDate: data[r][5] ? String(data[r][5]) : null,
        status: data[r][6],
        approvalStatus: data[r][7],
        documentReference: data[r][10] || null
      });
    }

    return {
      success: true,
      individualEmail: email,
      representatives: representatives,
      count: representatives.length
    };
  });
}

/**
 * Revokes a personal representative's authorization.
 * Supports the §164.502(g)(3) abuse/neglect override with documented reason.
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} representativeId — The representative record to revoke
 * @param {string} [reason] — Reason for revocation (required for abuse/neglect override)
 * @returns {Object} { success, representativeId, newStatus }
 */
function revokeRepresentative(sessionToken, representativeId, reason) {
  return wrapHipaaOperation('revokeRepresentative', sessionToken, function(user) {
    checkPermission(user, 'admin', 'revokeRepresentative');

    if (!representativeId) throw new Error('INVALID_INPUT');

    var headers = [
      'RepresentativeID', 'RepresentativeEmail', 'IndividualEmail',
      'RelationshipType', 'AuthorizationDate', 'ExpirationDate',
      'Status', 'ApprovalStatus', 'ApprovedBy', 'ApprovalDate',
      'DocumentReference', 'Notes'
    ];
    var sheet = getOrCreateSheet('PersonalRepresentatives', headers);
    var data = sheet.getDataRange().getValues();

    var targetRow = -1;
    var currentStatus = '';
    var repEmail = '';
    var indEmail = '';

    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === representativeId) {
        targetRow = r + 1;
        currentStatus = data[r][6];
        repEmail = data[r][1];
        indEmail = data[r][2];
        break;
      }
    }

    if (targetRow === -1) throw new Error('NOT_FOUND');
    if (currentStatus === 'Revoked') throw new Error('ALREADY_EXISTS');

    // Update status to Revoked
    sheet.getRange(targetRow, 7).setValue('Revoked'); // Status column
    // Append revocation reason to Notes
    var existingNotes = String(data[targetRow - 1][11] || '');
    var revocationNote = 'Revoked by ' + user.email + ' on ' + formatHipaaTimestamp();
    if (reason) {
      revocationNote += ' — Reason: ' + reason;
    }
    sheet.getRange(targetRow, 12).setValue(
      existingNotes ? existingNotes + ' | ' + revocationNote : revocationNote
    );

    dataAuditLog(user, 'update', 'personal_representative', representativeId, {
      previousStatus: currentStatus,
      newStatus: 'Revoked',
      representativeEmail: repEmail,
      individualEmail: indEmail,
      reason: reason || 'No reason provided'
    });

    return {
      success: true,
      representativeId: representativeId,
      previousStatus: currentStatus,
      newStatus: 'Revoked'
    };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE B — P2: RETENTION ENFORCEMENT (#18)
// ═══════════════════════════════════════════════════════

/**
 * Enforces HIPAA retention requirements across all protected sheets.
 * Designed to run as a daily time-driven trigger.
 *
 * Actions:
 * 1. Ensures sheet protection exists on all HIPAA sheets
 * 2. Archives records older than the retention period to *_Archive sheets
 * 3. Logs all actions to SessionAuditLog
 *
 * Does NOT delete any records — archival moves rows to a separate sheet.
 * The original sheet becomes smaller over time (performance improvement)
 * while the archive retains everything for the full retention period.
 */
function enforceRetention() {
  var startTime = new Date().getTime();
  var maxExecutionMs = 5 * 60 * 1000; // 5 minutes (leave 1-minute buffer for GAS 6-min limit)

  var retentionYears = HIPAA_RETENTION_CONFIG.RETENTION_YEARS
    || AUTH_CONFIG.AUDIT_LOG_RETENTION_YEARS || 6;
  var cutoffDate = getRetentionCutoffDate(retentionYears);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetsToProtect = HIPAA_RETENTION_CONFIG.SHEETS_TO_PROTECT;
  var batchSize = HIPAA_RETENTION_CONFIG.BATCH_SIZE || 500;

  var totalArchived = 0;
  var totalProtected = 0;

  for (var s = 0; s < sheetsToProtect.length; s++) {
    // Check execution time budget
    if (new Date().getTime() - startTime > maxExecutionMs) {
      auditLog('retention_timeout', 'system', 'partial', {
        processedSheets: s,
        totalSheets: sheetsToProtect.length,
        totalArchived: totalArchived,
        message: 'Trigger will resume on next daily execution'
      });
      break;
    }

    var sheetName = sheetsToProtect[s];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    // Step 1: Ensure sheet protection
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (protections.length === 0) {
      var protection = sheet.protect().setDescription('HIPAA Protected — ' + sheetName);
      protection.setWarningOnly(true);
      totalProtected++;
    }

    // Step 2: Archive old records
    // Find the timestamp column (first column that looks like a date/timestamp)
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue; // Header only

    var headers = data[0];
    var tsColIdx = -1;
    for (var h = 0; h < headers.length; h++) {
      var hdr = String(headers[h]).toLowerCase();
      if (hdr === 'timestamp' || hdr === 'createddate' || hdr === 'requestdate'
          || hdr === 'discoverydate' || hdr === 'authorizationdate') {
        tsColIdx = h;
        break;
      }
    }
    if (tsColIdx === -1) continue; // No timestamp column found

    // Get or create archive sheet
    var archiveSheetName = sheetName + HIPAA_RETENTION_CONFIG.ARCHIVE_SHEET_SUFFIX;
    var archiveSheet = ss.getSheetByName(archiveSheetName);
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet(archiveSheetName);
      archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      archiveSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      archiveSheet.setFrozenRows(1);
      var archiveProtection = archiveSheet.protect().setDescription('HIPAA Archive — ' + archiveSheetName);
      archiveProtection.setWarningOnly(true);
    }

    // Find rows to archive (older than cutoff, with legal hold check)
    var rowsToArchive = [];
    var rowsHeld = 0;

    for (var r = 1; r < data.length && rowsToArchive.length < batchSize; r++) {
      var ts = data[r][tsColIdx];
      var rowDate = ts instanceof Date ? ts : new Date(ts);
      if (isNaN(rowDate.getTime())) continue;

      // PHASE C: Use retention-relevant date (creation or last-in-effect, whichever is later)
      var retentionDate = getRetentionRelevantDate(headers, data[r]);
      if (retentionDate >= cutoffDate) continue; // Not yet eligible for archival

      // PHASE C: Check legal hold before archiving
      var hold = checkLegalHold(sheetName, rowDate);
      if (hold) {
        rowsHeld++;
        continue; // Skip this record — under legal hold
      }

      rowsToArchive.push({ rowIndex: r + 1, values: data[r] }); // 1-indexed for sheet ops
    }

    // PHASE C: Log held records count
    if (rowsHeld > 0) {
      auditLog('retention_hold_skipped', 'system', 'info', {
        sheetName: sheetName,
        rowsHeld: rowsHeld,
        holdReason: 'active_legal_hold'
      });
    }

    if (rowsToArchive.length === 0) continue;

    // Append archived rows to archive sheet
    var archiveValues = rowsToArchive.map(function(r) { return r.values; });
    var archiveStartRow = archiveSheet.getLastRow() + 1;
    archiveSheet.getRange(
      archiveStartRow, 1,
      archiveValues.length, archiveValues[0].length
    ).setValues(archiveValues);
    var archiveEndRow = archiveSheet.getLastRow();

    // Delete archived rows from source sheet (bottom-up to preserve indices)
    rowsToArchive.sort(function(a, b) { return b.rowIndex - a.rowIndex; });
    for (var d = 0; d < rowsToArchive.length; d++) {
      sheet.deleteRow(rowsToArchive[d].rowIndex);
    }

    totalArchived += rowsToArchive.length;

    // PHASE C: Compute and store integrity checksum for the archived batch
    computeArchiveChecksum(sheetName, archiveValues, archiveStartRow, archiveEndRow);
  }

  auditLog('retention_enforcement', 'system', 'success', {
    retentionYears: retentionYears,
    cutoffDate: cutoffDate.toISOString(),
    sheetsProcessed: sheetsToProtect.length,
    totalArchived: totalArchived,
    totalProtected: totalProtected,
    totalHeld: rowsHeld || 0
  });
}

/**
 * Sets up the daily time-driven trigger for retention enforcement.
 * Run this ONCE from the Apps Script editor (Run → setupRetentionTrigger).
 * The trigger fires once per day between 2:00-3:00 AM EST.
 */
function setupRetentionTrigger() {
  // Remove any existing retention triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'enforceRetention') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new daily trigger
  ScriptApp.newTrigger('enforceRetention')
    .timeBased()
    .atHour(2) // 2:00 AM
    .everyDays(1)
    .inTimezone('America/New_York')
    .create();

  auditLog('retention_trigger_installed', 'system', 'success', {
    schedule: 'Daily at 2:00 AM EST',
    handler: 'enforceRetention()'
  });
}

// ═══════════════════════════════════════════════════════
// PHASE B — P2: BREACH DETECTION & ALERTING (#28)
// ═══════════════════════════════════════════════════════

/**
 * Evaluates whether a security event warrants a breach alert.
 * Called by processSecurityEvent() after logging the event.
 * Checks event count against configurable thresholds and sends email if exceeded.
 *
 * @param {string} eventType — The security event type (e.g. 'tier3_lockout', 'hmac_integrity_violation')
 * @param {Object} eventDetails — Details about the event (for the alert email)
 */
function evaluateBreachAlert(eventType, eventDetails) {
  if (!BREACH_ALERT_CONFIG.ENABLED) return;

  if (!BREACH_ALERT_CONFIG.SECURITY_OFFICER_EMAIL) {
    auditLog('breach_alert_config_error', 'system', 'error', {
      message: 'SECURITY_OFFICER_EMAIL not configured — breach alerting disabled',
      eventType: eventType
    });
    return;
  }

  var threshold = BREACH_ALERT_CONFIG.THRESHOLDS[eventType];
  if (!threshold) return; // Event type not configured for alerting

  var cache = getEpochCache();
  var windowKey = 'breach_window_' + eventType;

  // Count events in the rolling window
  var windowData = cache.get(windowKey);
  var eventCount = windowData ? parseInt(windowData, 10) + 1 : 1;
  cache.put(windowKey, String(eventCount), BREACH_ALERT_CONFIG.WINDOW_MINUTES * 60);

  if (eventCount < threshold) return; // Below threshold

  // Threshold exceeded — check cooldown before sending
  var cooldownKey = 'breach_alert_cooldown_' + eventType;
  if (cache.get(cooldownKey)) {
    auditLog('breach_alert_suppressed', 'system', 'cooldown', {
      eventType: eventType,
      eventCount: eventCount,
      threshold: threshold,
      reason: 'alert_cooldown_active'
    });
    return;
  }

  // Send the alert via extracted function
  var alertResult = sendBreachAlert(eventType, eventCount, threshold, eventDetails);

  if (alertResult.success) {
    // Set cooldown to prevent alert storms
    cache.put(cooldownKey, 'sent', BREACH_ALERT_CONFIG.ALERT_COOLDOWN_MINUTES * 60);
  }

  // Always log to BreachLog for events in the ALWAYS_LOG_EVENTS list
  if (BREACH_ALERT_CONFIG.ALWAYS_LOG_EVENTS.indexOf(eventType) > -1) {
    logBreachFromAlert(eventType, eventCount, eventDetails);
  }
}

/**
 * Sends a breach alert email to the configured security officer.
 * Extracted from evaluateBreachAlert() for reusability and testability.
 *
 * @param {string} eventType — The security event type
 * @param {number} eventCount — Number of events that triggered the alert
 * @param {number} threshold — The configured threshold for this event type
 * @param {Object} eventDetails — Details about the event (for the alert email)
 * @returns {Object} { success, messageId } or { success: false, error }
 */
function sendBreachAlert(eventType, eventCount, threshold, eventDetails) {
  var alertSubject = 'HIPAA Security Alert — ' + eventType.replace(/_/g, ' ').toUpperCase();
  var alertBody = 'HIPAA SECURITY ALERT\n'
    + '━━━━━━━━━━━━━━━━━━━━\n\n'
    + 'Event Type: ' + eventType + '\n'
    + 'Threshold: ' + threshold + ' events in ' + BREACH_ALERT_CONFIG.WINDOW_MINUTES + ' minutes\n'
    + 'Actual Count: ' + eventCount + '\n'
    + 'Timestamp: ' + formatHipaaTimestamp() + '\n'
    + 'Environment: testauthgas1\n\n'
    + 'Event Details:\n'
    + JSON.stringify(eventDetails || {}, null, 2).substring(0, 500) + '\n\n'
    + 'ACTION REQUIRED:\n'
    + '1. Review the SessionAuditLog for related events\n'
    + '2. Determine if this constitutes a breach per the 4-factor analysis\n'
    + '3. If a breach is confirmed, log it via the Breach Dashboard\n'
    + '4. Begin the 60-day notification countdown if applicable\n\n'
    + 'This alert was generated automatically by the HIPAA breach detection system.\n'
    + 'Alert cooldown: ' + BREACH_ALERT_CONFIG.ALERT_COOLDOWN_MINUTES + ' minutes (no duplicate alerts during this period).';

  return sendHipaaEmail({
    to: BREACH_ALERT_CONFIG.SECURITY_OFFICER_EMAIL,
    subject: alertSubject,
    body: alertBody,
    emailType: 'breach_alert',
    triggeredBy: 'system',
    metadata: {
      eventType: eventType,
      eventCount: eventCount,
      threshold: threshold
    }
  });
}

/**
 * Returns the current breach alert configuration.
 * Security officer email is redacted — shows '***configured***' when set.
 *
 * @returns {Object} Breach alert config with redacted email
 */
function getBreachAlertConfig() {
  return {
    enabled: BREACH_ALERT_CONFIG.ENABLED,
    securityOfficerEmail: BREACH_ALERT_CONFIG.SECURITY_OFFICER_EMAIL ? '***configured***' : '',
    alertCooldownMinutes: BREACH_ALERT_CONFIG.ALERT_COOLDOWN_MINUTES,
    windowMinutes: BREACH_ALERT_CONFIG.WINDOW_MINUTES,
    thresholds: BREACH_ALERT_CONFIG.THRESHOLDS,
    alwaysLogEvents: BREACH_ALERT_CONFIG.ALWAYS_LOG_EVENTS
  };
}

// ═══════════════════════════════════════════════════════
// PHASE B — P2: BREACH LOGGING (#31)
// ═══════════════════════════════════════════════════════

/**
 * Logs a breach or potential breach to the BreachLog sheet.
 * Can be called manually by admin or automatically by evaluateBreachAlert().
 *
 * @param {string} sessionToken — Admin session token (null for system-generated entries)
 * @param {Object} params
 * @param {string} params.description — Brief description of the breach/incident
 * @param {string} params.discoveryDate — When the breach was discovered (ISO 8601)
 * @param {string} params.source — 'Manual' | 'Auto-Detected'
 * @param {string} [params.natureOfPhi] — What types of PHI were involved
 * @param {string} [params.unauthorizedPerson] — Who accessed/received the PHI
 * @param {string} [params.acquiredOrViewed] — Whether PHI was actually accessed
 * @param {string} [params.mitigationSteps] — Actions taken to reduce harm
 * @param {number} [params.affectedIndividuals] — Number of individuals affected
 * @param {string} [params.relatedEventType] — Security event type that triggered this entry
 * @returns {Object} { success, breachId }
 */
function logBreach(sessionToken, params) {
  var performLog = function(user) {
    if (user) {
      checkPermission(user, 'admin', 'logBreach');
    }

    if (!params || !params.description) {
      throw new Error('INVALID_INPUT');
    }

    var breachId = generateRequestId('BREACH');
    var timestamp = formatHipaaTimestamp();
    var discoveryDate = params.discoveryDate || timestamp;

    // Calculate notification deadline per §164.404(b)
    var deadline = new Date(discoveryDate);
    deadline.setDate(deadline.getDate() + HIPAA_DEADLINES.BREACH_NOTIFICATION_DAYS);

    var headers = [
      'BreachID', 'CreatedDate', 'DiscoveryDate', 'Description',
      'Source', 'Status', 'NatureOfPhi', 'UnauthorizedPerson',
      'AcquiredOrViewed', 'MitigationSteps', 'AffectedIndividuals',
      'RiskAssessment', 'NotificationDeadline', 'NotificationDate',
      'HhsReportDate', 'RelatedEventType', 'InvestigatorEmail',
      'ResolutionDate', 'ResolutionNotes'
    ];
    var sheet = getOrCreateSheet('BreachLog', headers);

    var row = [
      breachId,
      timestamp,
      discoveryDate,
      params.description,
      params.source || 'Manual',
      'Under Investigation',
      params.natureOfPhi || '',
      params.unauthorizedPerson || '',
      params.acquiredOrViewed || '',
      params.mitigationSteps || '',
      params.affectedIndividuals || 0,
      '',  // RiskAssessment — to be filled during investigation
      deadline.toISOString(),
      '',  // NotificationDate
      '',  // HhsReportDate
      params.relatedEventType || '',
      user ? user.email : 'system',
      '',  // ResolutionDate
      ''   // ResolutionNotes
    ];
    sheet.appendRow(row);

    auditLog('breach_logged', user ? user.email : 'system', 'success', {
      breachId: breachId,
      source: params.source || 'Manual',
      description: params.description.substring(0, 100)
    });

    return {
      success: true,
      breachId: breachId,
      notificationDeadline: deadline.toISOString()
    };
  };

  // If called with a session token (manual entry), validate session
  if (sessionToken) {
    return wrapHipaaOperation('logBreach', sessionToken, performLog);
  }

  // If called without session token (system-generated), execute directly
  return performLog(null);
}

/**
 * Automatically creates a BreachLog entry when evaluateBreachAlert() fires.
 * Called internally — not exposed as a user-callable endpoint.
 *
 * @param {string} eventType — The security event type
 * @param {number} eventCount — Number of events that triggered the alert
 * @param {Object} eventDetails — Details from the security event
 */
function logBreachFromAlert(eventType, eventCount, eventDetails) {
  // Deduplication: check if a BreachLog entry for this eventType was created recently
  var headers = [
    'BreachID', 'CreatedDate', 'DiscoveryDate', 'Description',
    'Source', 'Status', 'NatureOfPhi', 'UnauthorizedPerson',
    'AcquiredOrViewed', 'MitigationSteps', 'AffectedIndividuals',
    'RiskAssessment', 'NotificationDeadline', 'NotificationDate',
    'HhsReportDate', 'RelatedEventType', 'InvestigatorEmail',
    'ResolutionDate', 'ResolutionNotes'
  ];
  var sheet = getOrCreateSheet('BreachLog', headers);
  var data = sheet.getDataRange().getValues();
  var cooldownMs = BREACH_ALERT_CONFIG.ALERT_COOLDOWN_MINUTES * 60 * 1000;
  var now = new Date();

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][4]) !== 'Auto-Detected') continue;
    if (String(data[r][15]) !== eventType) continue;
    var created = data[r][1] instanceof Date ? data[r][1] : new Date(data[r][1]);
    if (!isNaN(created.getTime()) && (now.getTime() - created.getTime()) < cooldownMs) {
      auditLog('breach_log_dedup', 'system', 'suppressed', {
        eventType: eventType,
        existingBreachId: data[r][0],
        reason: 'duplicate_within_cooldown_window'
      });
      return; // Duplicate suppressed
    }
  }

  logBreach(null, {
    description: 'Auto-detected: ' + eventType + ' — ' + eventCount + ' events exceeded threshold within '
      + BREACH_ALERT_CONFIG.WINDOW_MINUTES + ' minutes',
    discoveryDate: formatHipaaTimestamp(),
    source: 'Auto-Detected',
    relatedEventType: eventType,
    natureOfPhi: 'To be determined during investigation',
    unauthorizedPerson: eventDetails && eventDetails.email ? eventDetails.email : 'Unknown — see audit logs',
    acquiredOrViewed: 'To be determined during investigation',
    mitigationSteps: 'Automatic escalating lockout applied. Alert sent to security officer.',
    affectedIndividuals: 0  // To be determined during investigation
  });
}

/**
 * Updates the status and investigation details of a breach record.
 * Used by admin during the investigation and notification process.
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} breachId — The breach to update
 * @param {Object} updates — Fields to update (only specified fields are changed)
 * @returns {Object} { success, breachId, newStatus }
 */
function updateBreachStatus(sessionToken, breachId, updates) {
  return wrapHipaaOperation('updateBreachStatus', sessionToken, function(user) {
    checkPermission(user, 'admin', 'updateBreachStatus');

    if (!breachId || !updates) throw new Error('INVALID_INPUT');

    var headers = [
      'BreachID', 'CreatedDate', 'DiscoveryDate', 'Description',
      'Source', 'Status', 'NatureOfPhi', 'UnauthorizedPerson',
      'AcquiredOrViewed', 'MitigationSteps', 'AffectedIndividuals',
      'RiskAssessment', 'NotificationDeadline', 'NotificationDate',
      'HhsReportDate', 'RelatedEventType', 'InvestigatorEmail',
      'ResolutionDate', 'ResolutionNotes'
    ];
    var sheet = getOrCreateSheet('BreachLog', headers);
    var data = sheet.getDataRange().getValues();

    // Valid status transitions
    var validTransitions = {
      'Under Investigation': ['Confirmed', 'Not a Breach'],
      'Confirmed': ['Notified', 'Closed'],
      'Not a Breach': ['Closed'],
      'Notified': ['Closed']
    };

    var targetRow = -1;
    var currentStatus = '';
    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === breachId) {
        targetRow = r + 1; // 1-indexed for sheet operations
        currentStatus = data[r][5];
        break;
      }
    }

    if (targetRow === -1) throw new Error('NOT_FOUND');

    // Validate status transition if status is being updated
    if (updates.status) {
      var allowed = validTransitions[currentStatus] || [];
      if (allowed.indexOf(updates.status) === -1) {
        throw new Error('INVALID_STATE');
      }
    }

    // Map update fields to column indices
    var fieldMap = {
      'status': 5, 'natureOfPhi': 6, 'unauthorizedPerson': 7,
      'acquiredOrViewed': 8, 'mitigationSteps': 9, 'affectedIndividuals': 10,
      'riskAssessment': 11, 'notificationDate': 13, 'hhsReportDate': 14,
      'resolutionDate': 17, 'resolutionNotes': 18
    };

    for (var field in updates) {
      if (updates.hasOwnProperty(field) && fieldMap[field] !== undefined) {
        sheet.getRange(targetRow, fieldMap[field] + 1).setValue(updates[field]);
      }
    }

    dataAuditLog(user, 'update', 'breach_record', breachId, {
      previousStatus: currentStatus,
      newStatus: updates.status || currentStatus,
      fieldsUpdated: Object.keys(updates)
    });

    return {
      success: true,
      breachId: breachId,
      previousStatus: currentStatus,
      newStatus: updates.status || currentStatus
    };
  });
}

/**
 * Generates a breach report for a specified calendar year.
 * Per §164.408(c), this report must be submitted to HHS within 60 days
 * after the end of the calendar year for breaches affecting <500 individuals.
 *
 * @param {string} sessionToken — Admin session token
 * @param {number} [year] — Calendar year to report (defaults to previous year)
 * @returns {Object} { success, year, breaches: [...], totalBreaches, totalAffected }
 */
function getBreachReport(sessionToken, year) {
  return wrapHipaaOperation('getBreachReport', sessionToken, function(user) {
    checkPermission(user, 'admin', 'getBreachReport');

    var reportYear = year || (new Date().getFullYear() - 1);
    var yearStart = new Date(reportYear, 0, 1);
    var yearEnd = new Date(reportYear, 11, 31, 23, 59, 59);

    var headers = [
      'BreachID', 'CreatedDate', 'DiscoveryDate', 'Description',
      'Source', 'Status', 'NatureOfPhi', 'UnauthorizedPerson',
      'AcquiredOrViewed', 'MitigationSteps', 'AffectedIndividuals',
      'RiskAssessment', 'NotificationDeadline', 'NotificationDate',
      'HhsReportDate', 'RelatedEventType', 'InvestigatorEmail',
      'ResolutionDate', 'ResolutionNotes'
    ];
    var sheet = getOrCreateSheet('BreachLog', headers);
    var data = sheet.getDataRange().getValues();

    var breaches = [];
    var totalAffected = 0;

    for (var r = 1; r < data.length; r++) {
      var discoveryDate = data[r][2];
      var date = discoveryDate instanceof Date ? discoveryDate : new Date(discoveryDate);
      if (isNaN(date.getTime())) continue;

      if (date >= yearStart && date <= yearEnd) {
        var affected = parseInt(data[r][10], 10) || 0;
        totalAffected += affected;

        breaches.push({
          breachId: data[r][0],
          discoveryDate: date.toISOString(),
          description: data[r][3],
          status: data[r][5],
          natureOfPhi: data[r][6],
          affectedIndividuals: affected,
          riskAssessment: data[r][11],
          notificationDate: data[r][13] ? String(data[r][13]) : null,
          hhsReportDate: data[r][14] ? String(data[r][14]) : null
        });
      }
    }

    dataAuditLog(user, 'read', 'breach_report', 'year_' + reportYear, {
      breachCount: breaches.length,
      totalAffected: totalAffected
    });

    return {
      success: true,
      year: reportYear,
      breaches: breaches,
      totalBreaches: breaches.length,
      totalAffected: totalAffected,
      hhsDeadline: new Date(reportYear + 1, 1, 28).toISOString(), // Feb 28 of following year (approx 60 days)
      note: breaches.length === 0
        ? 'No breaches discovered during ' + reportYear + '. Annual HHS notification may still be required if prior-year breaches were not yet reported.'
        : 'Report ' + breaches.length + ' breach(es) affecting ' + totalAffected + ' individuals to HHS by ' + new Date(reportYear + 1, 1, 28).toISOString().split('T')[0]
    };
  });
}

/**
 * Returns all breaches within the HIPAA retention window (default 6 years),
 * with optional filtering by status, year, or date range.
 * Unlike getBreachReport() which filters by a single calendar year, this function
 * provides a comprehensive view of all breaches for the full retention period.
 *
 * @param {string} sessionToken — Admin session token
 * @param {Object} [options] — Optional filters: { status, year, startDate, endDate }
 * @returns {Object} { success, breaches: [...], totalBreaches, totalAffected, dateRange }
 */
function getBreachLog(sessionToken, options) {
  return wrapHipaaOperation('getBreachLog', sessionToken, function(user) {
    checkPermission(user, 'admin', 'getBreachLog');

    var opts = options || {};
    var cutoff = getRetentionCutoffDate();

    var headers = [
      'BreachID', 'CreatedDate', 'DiscoveryDate', 'Description',
      'Source', 'Status', 'NatureOfPhi', 'UnauthorizedPerson',
      'AcquiredOrViewed', 'MitigationSteps', 'AffectedIndividuals',
      'RiskAssessment', 'NotificationDeadline', 'NotificationDate',
      'HhsReportDate', 'RelatedEventType', 'InvestigatorEmail',
      'ResolutionDate', 'ResolutionNotes'
    ];
    var sheet = getOrCreateSheet('BreachLog', headers);
    var data = sheet.getDataRange().getValues();

    var breaches = [];
    var totalAffected = 0;
    var earliestDate = null;
    var latestDate = null;

    for (var r = 1; r < data.length; r++) {
      var discoveryDate = data[r][2];
      var date = discoveryDate instanceof Date ? discoveryDate : new Date(discoveryDate);
      if (isNaN(date.getTime())) continue;

      // Must be within retention window
      if (date < cutoff) continue;

      // Optional status filter
      if (opts.status && String(data[r][5]) !== opts.status) continue;

      // Optional year filter
      if (opts.year && date.getFullYear() !== parseInt(opts.year, 10)) continue;

      // Optional date range filter
      if (opts.startDate) {
        var start = new Date(opts.startDate);
        if (!isNaN(start.getTime()) && date < start) continue;
      }
      if (opts.endDate) {
        var end = new Date(opts.endDate);
        if (!isNaN(end.getTime()) && date > end) continue;
      }

      var affected = parseInt(data[r][10], 10) || 0;
      totalAffected += affected;

      if (!earliestDate || date < earliestDate) earliestDate = date;
      if (!latestDate || date > latestDate) latestDate = date;

      breaches.push({
        breachId: data[r][0],
        createdDate: data[r][1] instanceof Date ? data[r][1].toISOString() : String(data[r][1]),
        discoveryDate: date.toISOString(),
        description: data[r][3],
        source: data[r][4],
        status: data[r][5],
        natureOfPhi: data[r][6],
        unauthorizedPerson: data[r][7],
        affectedIndividuals: affected,
        riskAssessment: data[r][11],
        notificationDeadline: data[r][12] ? String(data[r][12]) : null,
        notificationDate: data[r][13] ? String(data[r][13]) : null,
        hhsReportDate: data[r][14] ? String(data[r][14]) : null,
        relatedEventType: data[r][15] || null,
        resolutionDate: data[r][17] ? String(data[r][17]) : null,
        resolutionNotes: data[r][18] || null
      });
    }

    dataAuditLog(user, 'read', 'breach_log', 'full_log', {
      breachCount: breaches.length,
      totalAffected: totalAffected,
      filters: opts
    });

    return {
      success: true,
      breaches: breaches,
      totalBreaches: breaches.length,
      totalAffected: totalAffected,
      dateRange: {
        from: earliestDate ? earliestDate.toISOString() : null,
        to: latestDate ? latestDate.toISOString() : null,
        retentionCutoff: cutoff.toISOString()
      }
    };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE B — P1: AMENDMENT NOTIFICATIONS (#24b)
// ═══════════════════════════════════════════════════════

/**
 * Sends amendment notifications to specified third parties after an amendment is approved.
 * Called by admin after approving an amendment via reviewAmendment().
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} amendmentId — The approved amendment's ID
 * @param {Array<Object>} recipients — Array of { email, name } objects to notify
 * @returns {Object} { success, notificationsSent, notificationsFailed }
 */
function sendAmendmentNotifications(sessionToken, amendmentId, recipients) {
  return wrapHipaaOperation('sendAmendmentNotifications', sessionToken, function(user) {
    checkPermission(user, 'admin', 'sendAmendmentNotifications');

    if (!amendmentId || !recipients || !recipients.length) {
      throw new Error('INVALID_INPUT');
    }

    // Verify the amendment exists and is Approved
    var amHeaders = [
      'AmendmentID', 'IndividualEmail', 'RecordID', 'RequestDate',
      'CurrentContent', 'ProposedChange', 'Reason', 'Status',
      'ReviewerEmail', 'DecisionDate', 'DecisionReason',
      'DisagreementStatement', 'DisagreementDate', 'Deadline', 'Notes'
    ];
    var amSheet = getOrCreateSheet('AmendmentRequests', amHeaders);
    var amData = amSheet.getDataRange().getValues();

    var amendment = null;
    for (var r = 1; r < amData.length; r++) {
      if (amData[r][0] === amendmentId) {
        amendment = {
          id: amData[r][0],
          individualEmail: amData[r][1],
          recordId: amData[r][2],
          status: amData[r][7],
          decisionDate: amData[r][9]
        };
        break;
      }
    }

    if (!amendment) throw new Error('NOT_FOUND');
    if (amendment.status !== 'Approved') {
      throw new Error('INVALID_STATE');
    }

    // Create notification records and send emails
    var notifHeaders = [
      'NotificationID', 'AmendmentID', 'IndividualEmail',
      'NotificationType', 'RecipientEmail', 'RecipientName',
      'Status', 'SentDate', 'CreatedDate', 'ErrorDetails'
    ];
    var notifSheet = getOrCreateSheet('AmendmentNotifications', notifHeaders);

    var sent = 0;
    var failed = 0;
    var results = [];

    for (var i = 0; i < recipients.length; i++) {
      var recipient = recipients[i];
      var notifId = generateRequestId('NOTIF');
      var createdDate = formatHipaaTimestamp();

      // Send the notification email
      var emailResult = sendHipaaEmail({
        to: recipient.email,
        subject: 'Amendment Notification — ' + amendmentId,
        body: 'Dear ' + (recipient.name || recipient.email) + ',\n\n'
          + 'This notice is to inform you that a correction has been made to protected health '
          + 'information (PHI) that was previously disclosed to your organization.\n\n'
          + 'Amendment Reference: ' + amendmentId + '\n'
          + 'Date of Amendment Approval: ' + String(amendment.decisionDate) + '\n'
          + 'Record Affected: ' + amendment.recordId + '\n\n'
          + 'The correction has been approved and appended to the individual\'s designated record set. '
          + 'If you have previously relied on the disclosed information, please contact us to obtain '
          + 'the corrected information.\n\n'
          + 'This notification is provided in accordance with HIPAA §164.526(c)(3).',
        emailType: 'amendment_notification',
        triggeredBy: user.email,
        metadata: {
          amendmentId: amendmentId,
          recipientName: recipient.name,
          notificationId: notifId
        }
      });

      var status = emailResult.success ? 'Sent' : 'Failed';
      var sentDate = emailResult.success ? formatHipaaTimestamp() : '';
      var errorDetails = emailResult.success ? '' : (emailResult.error || 'Unknown error');

      notifSheet.appendRow([
        notifId, amendmentId, amendment.individualEmail,
        'ThirdPartyCorrection', recipient.email, recipient.name || '',
        status, sentDate, createdDate, errorDetails
      ]);

      if (emailResult.success) {
        sent++;
      } else {
        failed++;
      }

      results.push({
        notificationId: notifId,
        recipientEmail: recipient.email,
        status: status
      });
    }

    dataAuditLog(user, 'create', 'amendment_notifications', amendmentId, {
      recipientCount: recipients.length,
      sent: sent,
      failed: failed
    });

    return {
      success: true,
      amendmentId: amendmentId,
      notificationsSent: sent,
      notificationsFailed: failed,
      results: results
    };
  });
}

/**
 * Returns the notification history for a specific amendment.
 * Used by the admin review panel to show notification status.
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} amendmentId — The amendment to query notifications for
 * @returns {Object} { success, notifications: [...] }
 */
function getNotificationStatus(sessionToken, amendmentId) {
  return wrapHipaaOperation('getNotificationStatus', sessionToken, function(user) {
    checkPermission(user, 'admin', 'getNotificationStatus');

    if (!amendmentId) throw new Error('INVALID_INPUT');

    var notifHeaders = [
      'NotificationID', 'AmendmentID', 'IndividualEmail',
      'NotificationType', 'RecipientEmail', 'RecipientName',
      'Status', 'SentDate', 'CreatedDate', 'ErrorDetails'
    ];
    var sheet = getOrCreateSheet('AmendmentNotifications', notifHeaders);
    var data = sheet.getDataRange().getValues();

    var notifications = [];
    for (var r = 1; r < data.length; r++) {
      if (data[r][1] === amendmentId) {
        notifications.push({
          notificationId: data[r][0],
          notificationType: data[r][3],
          recipientEmail: data[r][4],
          recipientName: data[r][5],
          status: data[r][6],
          sentDate: data[r][7] ? String(data[r][7]) : null,
          createdDate: String(data[r][8]),
          errorDetails: data[r][9] || null
        });
      }
    }

    return {
      success: true,
      amendmentId: amendmentId,
      notifications: notifications,
      count: notifications.length
    };
  });
}

/**
 * Returns disclosure recipients who received PHI related to a specific record.
 * Helps admin identify who needs to be notified of an amendment.
 * Searches DisclosureLog for disclosures mentioning the record ID in PHIDescription.
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} recordId — The record that was amended
 * @returns {Object} { success, recipients: [{ email, name, lastDisclosureDate }] }
 */
function getDisclosureRecipientsForRecord(sessionToken, recordId) {
  return wrapHipaaOperation('getDisclosureRecipientsForRecord', sessionToken, function(user) {
    checkPermission(user, 'admin', 'getDisclosureRecipientsForRecord');

    if (!recordId) throw new Error('INVALID_INPUT');

    var headers = [
      'Timestamp', 'DisclosureID', 'IndividualEmail', 'RecipientName',
      'RecipientType', 'PHIDescription', 'Purpose', 'IsExempt',
      'ExemptionType', 'DataCategory', 'Source', 'TriggeredBy'
    ];
    var sheet = getOrCreateSheet('DisclosureLog', headers);
    var data = sheet.getDataRange().getValues();

    var recipientMap = {};
    for (var r = 1; r < data.length; r++) {
      var phiDesc = String(data[r][5] || '');
      if (phiDesc.indexOf(recordId) === -1) continue;

      var recipientName = String(data[r][3] || '');
      var recipientKey = recipientName.toLowerCase();

      if (!recipientMap[recipientKey]) {
        recipientMap[recipientKey] = {
          name: recipientName,
          recipientType: data[r][4],
          lastDisclosureDate: data[r][0]
        };
      } else {
        var existingDate = recipientMap[recipientKey].lastDisclosureDate;
        var newDate = data[r][0];
        if (newDate > existingDate) {
          recipientMap[recipientKey].lastDisclosureDate = newDate;
        }
      }
    }

    var recipients = [];
    for (var key in recipientMap) {
      if (recipientMap.hasOwnProperty(key)) {
        var rec = recipientMap[key];
        recipients.push({
          name: rec.name,
          recipientType: rec.recipientType,
          lastDisclosureDate: rec.lastDisclosureDate instanceof Date
            ? rec.lastDisclosureDate.toISOString()
            : String(rec.lastDisclosureDate)
        });
      }
    }

    return {
      success: true,
      recordId: recordId,
      recipients: recipients,
      count: recipients.length
    };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE B — P1: SUMMARY PHI EXPORT (#23b)
// ═══════════════════════════════════════════════════════

/**
 * Generates a metadata-only summary of the individual's designated record set.
 * Per §164.524(c)(3).
 */
function generateDataSummary(sessionToken, targetEmail) {
  return wrapHipaaOperation('generateDataSummary', sessionToken, function(user) {
    var email = targetEmail || user.email;
    validateIndividualAccess(user, email, 'generateDataSummary');
    checkPermission(user, 'export', 'generateDataSummary');

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetsToScan = ['Live_Sheet', 'DisclosureLog', 'AccessRequests', 'AmendmentRequests'];
    var summary = {
      recordTypes: [],
      countPerType: {},
      dateRange: { earliest: null, latest: null },
      totalRecords: 0,
      lastUpdated: null,
      dataCategories: [],
      exportFormatsAvailable: ['json', 'csv']
    };

    var categoryMap = {
      'Live_Sheet': 'Treatment notes',
      'DisclosureLog': 'Disclosure records',
      'AccessRequests': 'Access request history',
      'AmendmentRequests': 'Amendment request history'
    };

    for (var s = 0; s < sheetsToScan.length; s++) {
      var sheetName = sheetsToScan[s];
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) continue;

      var headers = data[0];
      var emailColIdx = -1;
      var timestampColIdx = -1;

      for (var h = 0; h < headers.length; h++) {
        var hdr = String(headers[h]).toLowerCase();
        if (hdr.indexOf('email') > -1 && emailColIdx === -1) emailColIdx = h;
        if ((hdr === 'timestamp' || hdr === 'requestdate' || hdr === 'date') && timestampColIdx === -1) timestampColIdx = h;
      }

      var count = 0;
      for (var r = 1; r < data.length; r++) {
        var rowEmail = emailColIdx >= 0 ? String(data[r][emailColIdx] || '').toLowerCase() : '';
        if (emailColIdx >= 0 && rowEmail !== email.toLowerCase()) continue;

        count++;

        if (timestampColIdx >= 0) {
          var ts = data[r][timestampColIdx];
          var date = ts instanceof Date ? ts : new Date(ts);
          if (!isNaN(date.getTime())) {
            if (!summary.dateRange.earliest || date < new Date(summary.dateRange.earliest)) {
              summary.dateRange.earliest = date.toISOString();
            }
            if (!summary.dateRange.latest || date > new Date(summary.dateRange.latest)) {
              summary.dateRange.latest = date.toISOString();
              summary.lastUpdated = date.toISOString();
            }
          }
        }
      }

      if (count > 0) {
        summary.recordTypes.push(sheetName);
        summary.countPerType[sheetName] = count;
        summary.totalRecords += count;
        if (categoryMap[sheetName]) {
          summary.dataCategories.push(categoryMap[sheetName]);
        }
      }
    }

    dataAuditLog(user, 'summary_export', 'designated_record_set', email, {
      recordTypes: summary.recordTypes,
      totalRecords: summary.totalRecords,
      note: 'Summary only — no PHI content included'
    });

    var arHeaders = [
      'RequestID', 'IndividualEmail', 'RequestDate', 'Format',
      'Status', 'ResponseDate', 'Notes'
    ];
    var arSheet = getOrCreateSheet('AccessRequests', arHeaders);
    var requestId = generateRequestId('ACCESS');
    arSheet.appendRow([
      requestId, email, formatHipaaTimestamp(), 'summary',
      'Completed', formatHipaaTimestamp(), 'Summary export generated'
    ]);

    return {
      success: true,
      requestId: requestId,
      summary: summary,
      fee: '$0 (electronic self-service)',
      notice: 'This is a summary of your records. For the complete designated record set, request a full JSON or CSV export.'
    };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE B — P1: GROUPED DISCLOSURE ACCOUNTING (#19b)
// ═══════════════════════════════════════════════════════

/**
 * Returns a grouped disclosure accounting for the authenticated individual.
 * Per §164.528(b)(2)(ii).
 */
function getGroupedDisclosureAccounting(sessionToken, targetEmail) {
  return wrapHipaaOperation('getGroupedDisclosureAccounting', sessionToken, function(user) {
    var email = targetEmail || user.email;
    validateIndividualAccess(user, email, 'getGroupedDisclosureAccounting');

    var headers = [
      'Timestamp', 'DisclosureID', 'IndividualEmail', 'RecipientName',
      'RecipientType', 'PHIDescription', 'Purpose', 'IsExempt',
      'ExemptionType', 'DataCategory', 'Source', 'TriggeredBy'
    ];
    var sheet = getOrCreateSheet('DisclosureLog', headers);
    var data = sheet.getDataRange().getValues();

    var sixYearsAgo = new Date();
    sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

    var rawDisclosures = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var indEmail = String(row[2] || '').toLowerCase();
      var isExempt = row[7] === true || row[7] === 'TRUE' || row[7] === 'true';
      var timestamp = row[0];

      if (indEmail !== email.toLowerCase()) continue;
      if (isExempt) continue;

      var discDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (discDate < sixYearsAgo) continue;

      rawDisclosures.push({
        timestamp: discDate,
        disclosureId: row[1],
        recipientName: row[3],
        recipientType: row[4],
        phiDescription: row[5],
        purpose: row[6]
      });
    }

    rawDisclosures.sort(function(a, b) { return a.timestamp - b.timestamp; });

    var groups = {};
    for (var i = 0; i < rawDisclosures.length; i++) {
      var disc = rawDisclosures[i];
      var groupKey = disc.recipientName + '||' + disc.purpose;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          recipientName: disc.recipientName,
          recipientType: disc.recipientType,
          purpose: disc.purpose,
          phiDescription: disc.phiDescription,
          firstDisclosureId: disc.disclosureId,
          firstDate: disc.timestamp.toISOString(),
          lastDate: disc.timestamp.toISOString(),
          count: 1
        };
      } else {
        groups[groupKey].lastDate = disc.timestamp.toISOString();
        groups[groupKey].count++;
      }
    }

    var grouped = [];
    for (var key in groups) {
      if (groups.hasOwnProperty(key)) {
        grouped.push(groups[key]);
      }
    }
    grouped.sort(function(a, b) { return new Date(b.firstDate) - new Date(a.firstDate); });

    dataAuditLog(user, 'read', 'grouped_disclosure_accounting', email, {
      totalRawDisclosures: rawDisclosures.length,
      groupedEntries: grouped.length
    });

    return {
      success: true,
      disclosures: grouped,
      totalDisclosures: rawDisclosures.length,
      groupedCount: grouped.length
    };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE B — SHARED UTILITIES
// ═══════════════════════════════════════════════════════

/**
 * Alias for wrapPhaseAOperation() — Phase B uses the same error handling pattern.
 * All HIPAA operations (Phase A, B, and future) share the same session validation
 * and error response structure.
 */
var wrapHipaaOperation = wrapPhaseAOperation;

/**
 * Sends an email via MailApp with HIPAA-compliant formatting and audit logging.
 * Centralized to ensure all outgoing emails are tracked and rate-limited.
 */
function sendHipaaEmail(params) {
  var required = ['to', 'subject', 'body', 'emailType', 'triggeredBy'];
  for (var i = 0; i < required.length; i++) {
    if (!params[required[i]]) {
      throw new Error('INVALID_INPUT');
    }
  }

  // Rate limiting: check cooldown per emailType + recipient
  var cache = getEpochCache();
  var cooldownKey = 'email_cooldown_' + params.emailType + '_' + params.to;
  if (cache.get(cooldownKey)) {
    auditLog('email_rate_limited', params.triggeredBy, 'skipped', {
      emailType: params.emailType,
      to: params.to,
      reason: 'cooldown_active'
    });
    return { success: false, error: 'RATE_LIMITED', message: 'Email cooldown active for this recipient and type.' };
  }

  try {
    var emailOptions = {
      to: params.to,
      subject: params.subject,
      body: params.body
    };
    if (params.htmlBody) {
      emailOptions.htmlBody = params.htmlBody;
    }

    MailApp.sendEmail(emailOptions);

    // Set cooldown
    var cooldownMinutes = params.emailType === 'breach_alert'
      ? BREACH_ALERT_CONFIG.ALERT_COOLDOWN_MINUTES
      : 5;
    cache.put(cooldownKey, 'sent', cooldownMinutes * 60);

    var messageId = generateRequestId('EMAIL');

    auditLog('hipaa_email_sent', params.triggeredBy, 'success', {
      messageId: messageId,
      emailType: params.emailType,
      to: params.to,
      subject: params.subject,
      metadata: params.metadata || {}
    });

    return { success: true, messageId: messageId };
  } catch (e) {
    auditLog('hipaa_email_failed', params.triggeredBy, 'error', {
      emailType: params.emailType,
      to: params.to,
      error: e.message
    });
    return { success: false, error: 'EMAIL_FAILED', message: 'Failed to send email.' };
  }
}

// ═══════════════════════════════════════════════════════
// HIPAA COMPLIANCE — Phase C: Data Governance
// ═══════════════════════════════════════════════════════

function getRetentionCutoffDate(retentionYears) {
  var years = retentionYears || HIPAA_RETENTION_CONFIG.RETENTION_YEARS
    || AUTH_CONFIG.AUDIT_LOG_RETENTION_YEARS || 6;
  var cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return cutoff;
}

/**
 * Checks whether a user is an authorized personal representative for a target individual.
 */
function isRepresentativeAuthorized(representativeEmail, individualEmail) {
  var headers = [
    'RepresentativeID', 'RepresentativeEmail', 'IndividualEmail',
    'RelationshipType', 'AuthorizationDate', 'ExpirationDate',
    'Status', 'ApprovalStatus', 'ApprovedBy', 'ApprovalDate',
    'DocumentReference', 'Notes'
  ];
  var sheet = getOrCreateSheet('PersonalRepresentatives', headers);
  var data = sheet.getDataRange().getValues();

  var now = new Date();
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var repEmail = String(row[1] || '').toLowerCase();
    var indEmail = String(row[2] || '').toLowerCase();
    var status = String(row[6] || '');
    var approvalStatus = String(row[7] || '');
    var expirationDate = row[5];

    if (repEmail === representativeEmail.toLowerCase()
        && indEmail === individualEmail.toLowerCase()
        && status === 'Active'
        && approvalStatus === 'Approved') {
      if (expirationDate && expirationDate instanceof Date && expirationDate < now) {
        continue;
      }
      return {
        representativeId: row[0],
        relationshipType: row[3],
        authorizationDate: row[4],
        expirationDate: expirationDate,
        documentReference: row[10]
      };
    }
  }

  return null;
}

// ══════════════════════════════════════════════════════════════
// PHASE C — RETENTION ENFORCEMENT EXTENSIONS
// §164.316(b)(2)(i), §164.312(c)(1-2), §164.308(a)(8), FRCP 37(e)
// ══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// PHASE C — LEGAL HOLD QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Checks whether a specific sheet (and optionally a date range) is under
 * an active legal hold. Called by enforceRetention() before archiving.
 *
 * @param {string} sheetName — Name of the sheet to check
 * @param {Date} [recordDate] — Date of the specific record being checked
 * @returns {Object|null} The active hold object if under hold, null otherwise
 */
function checkLegalHold(sheetName, recordDate) {
  if (!LEGAL_HOLD_CONFIG.ENABLED) return null;

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var holdSheet = ss.getSheetByName('LegalHolds');
  if (!holdSheet) return null;

  var data = holdSheet.getDataRange().getValues();
  var now = new Date();

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[1]) !== sheetName) continue;
    if (row[10] !== 'Active') continue;

    // Check expiration
    if (row[9] && new Date(row[9]) < now) {
      holdSheet.getRange(r + 1, 11).setValue('Expired');
      auditLog('legal_hold_expired', 'system', 'auto_expired', {
        holdId: row[0], sheetName: sheetName
      });
      continue;
    }

    // Check date range (if hold has a date range and record has a date)
    if (recordDate && row[5] && row[6]) {
      var holdStart = new Date(row[5]);
      var holdEnd = new Date(row[6]);
      if (recordDate < holdStart || recordDate > holdEnd) {
        continue;
      }
    }

    return {
      holdId: row[0],
      sheetName: row[1],
      holdType: row[2],
      reason: row[3],
      caseReference: row[4]
    };
  }

  return null;
}

/**
 * Returns all legal holds, optionally filtered by sheet name and/or status.
 *
 * @param {string} sessionToken — Admin session token
 * @param {Object} [filters] — { sheetName?, status? }
 * @returns {Object} { success, holds: [...], count }
 */
function getLegalHolds(sessionToken, filters) {
  return wrapRetentionOperation('getLegalHolds', sessionToken, function(user) {
    checkPermission(user, 'admin', 'getLegalHolds');

    filters = filters || {};
    var headers = [
      'HoldID', 'SheetName', 'HoldType', 'Reason', 'CaseReference',
      'StartDate', 'EndDate', 'PlacedBy', 'PlacedDate', 'ExpirationDate',
      'Status', 'ReleasedBy', 'ReleasedDate', 'ReleaseReason'
    ];
    var sheet = getOrCreateSheet('LegalHolds', headers);
    var data = sheet.getDataRange().getValues();
    var holds = [];

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (filters.sheetName && String(row[1]) !== filters.sheetName) continue;
      if (filters.status && row[10] !== filters.status) continue;

      holds.push({
        holdId: row[0],
        sheetName: row[1],
        holdType: row[2],
        reason: row[3],
        caseReference: row[4],
        startDate: row[5],
        endDate: row[6],
        placedBy: row[7],
        placedDate: row[8],
        expirationDate: row[9],
        status: row[10],
        releasedBy: row[11],
        releasedDate: row[12],
        releaseReason: row[13]
      });
    }

    holds.sort(function(a, b) {
      return new Date(b.placedDate) - new Date(a.placedDate);
    });

    dataAuditLog(user, 'read', 'legal_holds', 'query', {
      filters: JSON.stringify(filters),
      resultCount: holds.length
    });

    return {
      success: true,
      holds: holds,
      count: holds.length
    };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE C — LEGAL HOLD FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Places a legal hold on a specific sheet, preventing records within
 * the specified date range from being archived by enforceRetention().
 * §164.316(b)(2)(i) + FRCP Rule 37(e)
 *
 * @param {string} sessionToken — Admin session token
 * @param {Object} params — { sheetName, holdType, reason, startDate?, endDate?, caseReference?, expirationDate? }
 * @returns {Object} { success, holdId, sheetName, holdType, status }
 */
function placeLegalHold(sessionToken, params) {
  return wrapRetentionOperation('placeLegalHold', sessionToken, function(user) {
    checkPermission(user, 'admin', 'placeLegalHold');

    if (!params || !params.sheetName || !params.holdType || !params.reason) {
      throw new Error('INVALID_INPUT');
    }

    // Validate sheet name is in protected list
    var allProtected = HIPAA_RETENTION_CONFIG.SHEETS_TO_PROTECT.slice();
    if (LEGAL_HOLD_CONFIG.ALLOW_ARCHIVE_HOLDS) {
      for (var i = 0; i < HIPAA_RETENTION_CONFIG.SHEETS_TO_PROTECT.length; i++) {
        allProtected.push(HIPAA_RETENTION_CONFIG.SHEETS_TO_PROTECT[i]
          + HIPAA_RETENTION_CONFIG.ARCHIVE_SHEET_SUFFIX);
      }
    }
    if (allProtected.indexOf(params.sheetName) === -1) {
      return {
        success: false,
        error: 'INVALID_SHEET',
        message: 'Sheet "' + escapeHtml(params.sheetName) + '" is not a HIPAA-protected sheet.'
      };
    }

    // Validate hold type
    if (LEGAL_HOLD_CONFIG.HOLD_TYPES.indexOf(params.holdType) === -1) {
      throw new Error('INVALID_INPUT');
    }

    // Check hold limit
    var headers = [
      'HoldID', 'SheetName', 'HoldType', 'Reason', 'CaseReference',
      'StartDate', 'EndDate', 'PlacedBy', 'PlacedDate', 'ExpirationDate',
      'Status', 'ReleasedBy', 'ReleasedDate', 'ReleaseReason'
    ];
    var sheet = getOrCreateSheet('LegalHolds', headers);
    var data = sheet.getDataRange().getValues();
    var activeHoldsForSheet = 0;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][1]) === params.sheetName && data[r][10] === 'Active') {
        activeHoldsForSheet++;
      }
    }

    if (activeHoldsForSheet >= LEGAL_HOLD_CONFIG.MAX_HOLDS_PER_SHEET) {
      return {
        success: false,
        error: 'LIMIT_EXCEEDED',
        message: 'Maximum ' + LEGAL_HOLD_CONFIG.MAX_HOLDS_PER_SHEET
          + ' active holds per sheet. Release an existing hold first.'
      };
    }

    var holdId = generateRequestId('HOLD');
    var timestamp = formatHipaaTimestamp();

    var row = [
      holdId,
      params.sheetName,
      params.holdType,
      params.reason,
      params.caseReference || '',
      params.startDate || '',
      params.endDate || '',
      user.email,
      timestamp,
      params.expirationDate || '',
      'Active',
      '',  // ReleasedBy
      '',  // ReleasedDate
      ''   // ReleaseReason
    ];
    sheet.appendRow(row);

    dataAuditLog(user, 'create', 'legal_hold', holdId, {
      sheetName: params.sheetName,
      holdType: params.holdType,
      reason: params.reason,
      dateRange: (params.startDate || 'beginning') + ' to ' + (params.endDate || 'present')
    });

    // Optional notification
    var notifyEmail = getHoldNotificationEmail();
    if (notifyEmail) {
      sendHipaaEmail({
        to: notifyEmail,
        subject: 'Legal Hold Placed — ' + params.sheetName,
        body: 'Hold ID: ' + holdId + '\n'
          + 'Sheet: ' + params.sheetName + '\n'
          + 'Type: ' + params.holdType + '\n'
          + 'Reason: ' + params.reason + '\n'
          + 'Placed by: ' + user.email + '\n'
          + 'Date: ' + timestamp,
        emailType: 'legal_hold',
        triggeredBy: user.email
      });
    }

    return {
      success: true,
      holdId: holdId,
      sheetName: params.sheetName,
      holdType: params.holdType,
      status: 'Active'
    };
  });
}

/**
 * Releases an active legal hold, allowing the previously held records
 * to be processed by the next enforceRetention() trigger run.
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} holdId — ID of the hold to release
 * @param {string} reason — Reason for releasing the hold
 * @returns {Object} { success, holdId, status }
 */
function releaseLegalHold(sessionToken, holdId, reason) {
  return wrapRetentionOperation('releaseLegalHold', sessionToken, function(user) {
    checkPermission(user, 'admin', 'releaseLegalHold');

    if (!holdId || !reason) {
      throw new Error('INVALID_INPUT');
    }

    var headers = [
      'HoldID', 'SheetName', 'HoldType', 'Reason', 'CaseReference',
      'StartDate', 'EndDate', 'PlacedBy', 'PlacedDate', 'ExpirationDate',
      'Status', 'ReleasedBy', 'ReleasedDate', 'ReleaseReason'
    ];
    var sheet = getOrCreateSheet('LegalHolds', headers);
    var data = sheet.getDataRange().getValues();

    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === holdId) {
        if (data[r][10] !== 'Active') {
          return {
            success: false,
            error: 'INVALID_STATE',
            message: 'Hold ' + holdId + ' is not active (current status: ' + data[r][10] + ').'
          };
        }

        var timestamp = formatHipaaTimestamp();
        sheet.getRange(r + 1, 11).setValue('Released');
        sheet.getRange(r + 1, 12).setValue(user.email);
        sheet.getRange(r + 1, 13).setValue(timestamp);
        sheet.getRange(r + 1, 14).setValue(reason);

        dataAuditLog(user, 'update', 'legal_hold', holdId, {
          action: 'released',
          sheetName: data[r][1],
          releaseReason: reason
        });

        var notifyEmail = getHoldNotificationEmail();
        if (notifyEmail) {
          sendHipaaEmail({
            to: notifyEmail,
            subject: 'Legal Hold Released — ' + data[r][1],
            body: 'Hold ID: ' + holdId + '\n'
              + 'Sheet: ' + data[r][1] + '\n'
              + 'Released by: ' + user.email + '\n'
              + 'Reason: ' + reason + '\n'
              + 'Date: ' + timestamp,
            emailType: 'legal_hold',
            triggeredBy: user.email
          });
        }

        return {
          success: true,
          holdId: holdId,
          status: 'Released'
        };
      }
    }

    throw new Error('NOT_FOUND');
  });
}

// ═══════════════════════════════════════════════════════
// PHASE C — RETENTION POLICY DOCUMENTATION
// ═══════════════════════════════════════════════════════

/**
 * Generates a formal retention policy document based on live system configuration.
 * §164.316(b)(1) — Documentation (Required)
 * §164.316(b)(2)(ii) — Availability (Required)
 *
 * @param {string} sessionToken — Admin session token
 * @returns {Object} { success, document: { sections: [...] }, generatedAt }
 */
function getRetentionPolicyDocument(sessionToken) {
  return wrapRetentionOperation('getRetentionPolicyDocument', sessionToken, function(user) {
    checkPermission(user, 'admin', 'getRetentionPolicyDocument');

    var timestamp = formatHipaaTimestamp();
    var retentionYears = HIPAA_RETENTION_CONFIG.RETENTION_YEARS || 6;
    var sheetsProtected = HIPAA_RETENTION_CONFIG.SHEETS_TO_PROTECT;

    var latestAudit = null;
    try {
      var auditResult = auditRetentionCompliance(sessionToken);
      if (auditResult.success) latestAudit = auditResult.report;
    } catch (e) { /* Non-fatal */ }

    var legalHolds = [];
    try {
      var holdResult = getLegalHolds(sessionToken, { status: 'Active' });
      if (holdResult.success) legalHolds = holdResult.holds;
    } catch (e) { /* Non-fatal */ }

    var document = {
      title: 'HIPAA Record Retention Policy — testauthgas1',
      version: '1.0',
      generatedAt: timestamp,
      generatedBy: user.email,
      regulatoryBasis: '45 CFR §164.316(b)(2)(i)',
      sections: [
        {
          heading: '1. Purpose',
          content: 'This document establishes the record retention policy for the testauthgas1 '
            + 'environment, as required by the HIPAA Security Rule §164.316(b). It defines '
            + 'retention periods, enforcement mechanisms, and exception handling procedures '
            + 'for all electronic protected health information (ePHI) and security documentation.'
        },
        {
          heading: '2. Scope',
          content: 'This policy applies to all electronic records maintained in the testauthgas1 '
            + 'Project Data Spreadsheet, including but not limited to:',
          items: sheetsProtected.map(function(name) {
            return name + ' — protected, ' + retentionYears + '-year retention';
          })
        },
        {
          heading: '3. Retention Period',
          content: 'All records identified in Section 2 shall be retained for a minimum of '
            + retentionYears + ' years from the date of creation or the date when the record '
            + 'last was in effect, whichever is later, per §164.316(b)(2)(i). Records subject '
            + 'to a legal hold (Section 6) shall be retained beyond the standard retention period '
            + 'until the hold is released.'
        },
        {
          heading: '4. Enforcement Mechanism',
          content: 'Retention is enforced by an automated daily trigger (enforceRetention()) '
            + 'that executes at 2:00 AM EST. The trigger: (1) verifies sheet-level protection '
            + 'on all covered sheets, (2) identifies records older than the retention cutoff, '
            + '(3) checks for active legal holds, (4) archives eligible records to protected '
            + 'archive sheets (*_Archive), (5) computes integrity checksums for archived batches, '
            + 'and (6) logs all actions to the SessionAuditLog.',
          details: {
            triggerSchedule: 'Daily at 2:00 AM EST',
            batchSize: HIPAA_RETENTION_CONFIG.BATCH_SIZE,
            protectionLevel: HIPAA_RETENTION_CONFIG.PROTECTION_LEVEL,
            archiveSuffix: HIPAA_RETENTION_CONFIG.ARCHIVE_SHEET_SUFFIX
          }
        },
        {
          heading: '5. Archive Integrity',
          content: 'Archived records are protected by SHA-256 checksums computed at archival '
            + 'time and stored in the RetentionIntegrityLog sheet. Integrity can be verified '
            + 'on demand or via automated audit. Any discrepancy between stored and recomputed '
            + 'checksums indicates potential tampering or corruption and triggers a CRITICAL finding.'
        },
        {
          heading: '6. Legal Hold Exceptions',
          content: 'Records subject to active legal holds are exempt from routine archival. '
            + 'Legal holds may be placed by admin-role users for litigation, regulatory investigation, '
            + 'internal investigation, audit, or preservation purposes. Holds may cover entire sheets '
            + 'or specific date ranges within a sheet.',
          activeHolds: legalHolds.length,
          holdDetails: legalHolds.map(function(h) {
            return h.holdId + ': ' + h.sheetName + ' (' + h.holdType + ') — ' + h.reason;
          })
        },
        {
          heading: '7. Compliance Monitoring',
          content: 'Retention compliance is audited weekly by an automated trigger '
            + '(auditRetentionCompliance()) that evaluates sheet protection status, record counts, '
            + 'archival completeness, legal hold coverage, and audit trail continuity. Audit reports '
            + 'are retained as organizational compliance artifacts.',
          latestAudit: latestAudit ? {
            auditId: latestAudit.auditId,
            date: latestAudit.timestamp,
            status: latestAudit.overallStatus,
            findings: latestAudit.findings.length
          } : 'No audit data available'
        },
        {
          heading: '8. Destruction Prohibited',
          content: 'No record within the retention period shall be destroyed, deleted, or made '
            + 'inaccessible, except through the automated archival process described in Section 4. '
            + 'Manual deletion of HIPAA-protected records is prohibited and will trigger a warning '
            + 'dialog (sheet protection level: ' + HIPAA_RETENTION_CONFIG.PROTECTION_LEVEL + '). '
            + 'All deletion attempts are logged.'
        },
        {
          heading: '9. Responsible Parties',
          content: 'The system administrator (admin role) is responsible for: (1) ensuring the '
            + 'retention trigger is installed and operational, (2) placing and releasing legal holds '
            + 'as needed, (3) reviewing weekly compliance audit reports, (4) verifying archive '
            + 'integrity, and (5) generating and distributing this policy document to relevant parties '
            + 'per §164.316(b)(2)(ii).'
        },
        {
          heading: '10. Policy Review',
          content: 'This policy shall be reviewed and updated per §164.316(b)(2)(iii) in response '
            + 'to: (1) changes in the regulatory environment (new HIPAA rules, state law changes), '
            + '(2) changes in the operating environment (new data types, new sheets, new functionality), '
            + '(3) security incidents that reveal retention gaps, or (4) organizational changes '
            + '(new staff, new roles, new BAA requirements). This document is auto-generated from '
            + 'live system configuration — regenerate it after any configuration change to ensure '
            + 'the policy reflects the current implementation.'
        }
      ]
    };

    dataAuditLog(user, 'generate', 'retention_policy_document', document.version, {
      sectionsGenerated: document.sections.length,
      sheetsDocumented: sheetsProtected.length,
      activeHolds: legalHolds.length
    });

    return { success: true, document: document, generatedAt: timestamp };
  });
}

/**
 * Exports the retention policy document as formatted text or JSON.
 * §164.316(b)(2)(ii) — Make documentation available
 *
 * @param {string} sessionToken — Admin session token
 * @param {string} [format='text'] — 'text' or 'json'
 * @returns {Object} { success, format, data, filename }
 */
function exportRetentionPolicy(sessionToken, format) {
  return wrapRetentionOperation('exportRetentionPolicy', sessionToken, function(user) {
    checkPermission(user, 'admin', 'exportRetentionPolicy');

    var policyResult = getRetentionPolicyDocument(sessionToken);
    if (!policyResult.success) return policyResult;

    var doc = policyResult.document;
    format = (format || 'text').toLowerCase();
    var dateStr = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
    var filename = 'hipaa-retention-policy-' + dateStr;

    if (format === 'json') {
      return {
        success: true,
        format: 'json',
        data: JSON.stringify(doc, null, 2),
        filename: filename + '.json'
      };
    }

    var lines = [
      '════════════════════════════════════════════════════════════════',
      '',
      '  ' + doc.title,
      '',
      '  Generated: ' + doc.generatedAt,
      '  Generated by: ' + doc.generatedBy,
      '  Regulatory basis: ' + doc.regulatoryBasis,
      '  Document version: ' + doc.version,
      '',
      '════════════════════════════════════════════════════════════════',
      ''
    ];

    for (var i = 0; i < doc.sections.length; i++) {
      var section = doc.sections[i];
      lines.push(section.heading);
      lines.push('');
      lines.push(section.content);

      if (section.items) {
        lines.push('');
        for (var j = 0; j < section.items.length; j++) {
          lines.push('  • ' + section.items[j]);
        }
      }

      if (section.holdDetails && section.holdDetails.length > 0) {
        lines.push('');
        lines.push('  Active holds (' + section.activeHolds + '):');
        for (var k = 0; k < section.holdDetails.length; k++) {
          lines.push('    ' + section.holdDetails[k]);
        }
      }

      if (section.latestAudit && typeof section.latestAudit === 'object') {
        lines.push('');
        lines.push('  Latest audit: ' + section.latestAudit.auditId
          + ' (' + section.latestAudit.date + ') — ' + section.latestAudit.status
          + ', ' + section.latestAudit.findings + ' finding(s)');
      }

      if (section.details) {
        lines.push('');
        for (var key in section.details) {
          lines.push('  ' + key + ': ' + section.details[key]);
        }
      }

      lines.push('');
      lines.push('─────────────────────────────────────────');
      lines.push('');
    }

    return {
      success: true,
      format: 'text',
      data: lines.join('\n'),
      filename: filename + '.txt'
    };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE C — ARCHIVE INTEGRITY VERIFICATION
// ═══════════════════════════════════════════════════════

/**
 * Computes and stores a checksum for a batch of archived records.
 * Called by enforceRetention() after moving rows to the archive sheet.
 * §164.312(c)(1) — Integrity controls
 *
 * @param {string} sheetName — Source sheet name (e.g. 'SessionAuditLog')
 * @param {Array[]} archivedRows — The rows that were just archived
 * @param {number} archiveStartRow — Starting row number in the archive sheet
 * @param {number} archiveEndRow — Ending row number in the archive sheet
 */
function computeArchiveChecksum(sheetName, archivedRows, archiveStartRow, archiveEndRow) {
  if (!INTEGRITY_CONFIG) return;

  var checksum = computeRowsChecksum(archivedRows);
  var timestamp = formatHipaaTimestamp();

  var headers = [
    'ChecksumID', 'Timestamp', 'SheetName', 'ArchiveSheetName',
    'StartRow', 'EndRow', 'RowCount', 'Checksum', 'Algorithm',
    'VerificationStatus', 'LastVerified', 'VerificationNote'
  ];
  var logSheet = getOrCreateSheet(INTEGRITY_CONFIG.TRACKING_SHEET_NAME, headers);

  var checksumId = generateRequestId('CHK');
  var archiveSheetName = sheetName + HIPAA_RETENTION_CONFIG.ARCHIVE_SHEET_SUFFIX;

  logSheet.appendRow([
    checksumId,
    timestamp,
    sheetName,
    archiveSheetName,
    archiveStartRow,
    archiveEndRow,
    archivedRows.length,
    checksum,
    INTEGRITY_CONFIG.ALGORITHM,
    'PENDING',
    '',
    ''
  ]);

  auditLog('archive_checksum_stored', 'system', 'success', {
    checksumId: checksumId,
    sheetName: sheetName,
    rowCount: archivedRows.length,
    checksum: checksum.substring(0, 16) + '...'
  });
}

/**
 * Verifies the integrity of all archived records by recomputing checksums
 * and comparing against stored values.
 * §164.312(c)(2) — Mechanism to Authenticate ePHI (Addressable)
 *
 * @param {string} sessionToken — Admin session token
 * @returns {Object} { success, report: { archives: [...], findings: [...], overallStatus } }
 */
function verifyArchiveIntegrity(sessionToken) {
  return wrapRetentionOperation('verifyArchiveIntegrity', sessionToken, function(user) {
    checkPermission(user, 'admin', 'verifyArchiveIntegrity');

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var timestamp = formatHipaaTimestamp();

    var report = {
      verificationId: generateRequestId('VRFY'),
      timestamp: timestamp,
      verifier: user.email,
      overallStatus: 'PASS',
      archives: [],
      findings: []
    };

    var logHeaders = [
      'ChecksumID', 'Timestamp', 'SheetName', 'ArchiveSheetName',
      'StartRow', 'EndRow', 'RowCount', 'Checksum', 'Algorithm',
      'VerificationStatus', 'LastVerified', 'VerificationNote'
    ];
    var logSheet = getOrCreateSheet(INTEGRITY_CONFIG.TRACKING_SHEET_NAME, logHeaders);
    var logData = logSheet.getDataRange().getValues();

    if (logData.length <= 1) {
      report.findings.push({
        severity: 'INFO',
        finding: 'No checksums stored yet — no archives to verify'
      });
      return { success: true, report: report };
    }

    // Group checksums by archive sheet
    var checksumsBySheet = {};
    for (var r = 1; r < logData.length; r++) {
      var archiveName = logData[r][3];
      if (!checksumsBySheet[archiveName]) {
        checksumsBySheet[archiveName] = [];
      }
      checksumsBySheet[archiveName].push({
        logRow: r + 1,
        checksumId: logData[r][0],
        startRow: logData[r][4],
        endRow: logData[r][5],
        expectedRowCount: logData[r][6],
        storedChecksum: logData[r][7],
        algorithm: logData[r][8]
      });
    }

    for (var archiveName in checksumsBySheet) {
      var archiveSheet = ss.getSheetByName(archiveName);
      var archiveReport = {
        archiveSheetName: archiveName,
        exists: !!archiveSheet,
        checksumEntries: checksumsBySheet[archiveName].length,
        passed: 0,
        failed: 0,
        status: 'PASS'
      };

      if (!archiveSheet) {
        archiveReport.status = 'MISSING';
        report.overallStatus = 'FAIL';
        report.findings.push({
          severity: 'CRITICAL',
          finding: 'Archive sheet "' + archiveName + '" is MISSING — archived records may be lost'
        });
        report.archives.push(archiveReport);
        continue;
      }

      var archiveData = archiveSheet.getDataRange().getValues();
      var entries = checksumsBySheet[archiveName];

      for (var e = 0; e < entries.length; e++) {
        var entry = entries[e];
        var startIdx = entry.startRow - 1;
        var endIdx = entry.endRow;

        if (endIdx > archiveData.length) {
          report.findings.push({
            severity: 'HIGH',
            finding: 'Checksum ' + entry.checksumId + ': archive "' + archiveName
              + '" has ' + archiveData.length + ' rows but checksum covers rows '
              + entry.startRow + '-' + entry.endRow + ' — ROW_COUNT_MISMATCH'
          });
          logSheet.getRange(entry.logRow, 10).setValue('FAIL');
          logSheet.getRange(entry.logRow, 11).setValue(timestamp);
          logSheet.getRange(entry.logRow, 12).setValue('ROW_COUNT_MISMATCH');
          archiveReport.failed++;
          archiveReport.status = 'FAIL';
          report.overallStatus = 'FAIL';
          continue;
        }

        var rows = archiveData.slice(startIdx, endIdx);
        var recomputed = computeRowsChecksum(rows);

        if (recomputed === entry.storedChecksum) {
          logSheet.getRange(entry.logRow, 10).setValue('PASS');
          logSheet.getRange(entry.logRow, 11).setValue(timestamp);
          logSheet.getRange(entry.logRow, 12).setValue('');
          archiveReport.passed++;
        } else {
          report.findings.push({
            severity: 'CRITICAL',
            finding: 'Checksum ' + entry.checksumId + ': INTEGRITY_MISMATCH in "'
              + archiveName + '" rows ' + entry.startRow + '-' + entry.endRow
              + ' — archived records may have been tampered with or corrupted'
          });
          logSheet.getRange(entry.logRow, 10).setValue('FAIL');
          logSheet.getRange(entry.logRow, 11).setValue(timestamp);
          logSheet.getRange(entry.logRow, 12).setValue('INTEGRITY_MISMATCH: stored='
            + entry.storedChecksum.substring(0, 16) + ' recomputed='
            + recomputed.substring(0, 16));
          archiveReport.failed++;
          archiveReport.status = 'FAIL';
          report.overallStatus = 'FAIL';
        }
      }

      report.archives.push(archiveReport);
    }

    dataAuditLog(user, 'verify', 'archive_integrity', report.verificationId, {
      overallStatus: report.overallStatus,
      archivesChecked: report.archives.length,
      findingsCount: report.findings.length
    });

    return { success: true, report: report };
  });
}

// ═══════════════════════════════════════════════════════
// PHASE C — RETENTION COMPLIANCE AUDIT
// ═══════════════════════════════════════════════════════

/**
 * Performs a comprehensive audit of retention enforcement across all HIPAA sheets.
 * §164.308(a)(8) — Evaluation (Required)
 * §164.316(b)(2)(iii) — Updates (Required)
 *
 * @param {string} [sessionToken] — Admin session token (null when triggered)
 * @returns {Object} Structured compliance audit report
 */
function auditRetentionCompliance(sessionToken) {
  var user = null;
  if (sessionToken) {
    user = validateSessionForData(sessionToken, 'auditRetentionCompliance');
    checkPermission(user, 'admin', 'auditRetentionCompliance');
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var retentionYears = HIPAA_RETENTION_CONFIG.RETENTION_YEARS || 6;
  var cutoffDate = getRetentionCutoffDate(retentionYears);
  var timestamp = formatHipaaTimestamp();

  var report = {
    auditId: generateRequestId('AUDIT'),
    timestamp: timestamp,
    auditor: user ? user.email : 'system_trigger',
    retentionYears: retentionYears,
    cutoffDate: cutoffDate.toISOString(),
    overallStatus: 'COMPLIANT',
    sheets: [],
    legalHolds: [],
    findings: [],
    summary: {
      totalSheets: 0,
      protectedSheets: 0,
      unprotectedSheets: 0,
      totalActiveRecords: 0,
      totalArchivedRecords: 0,
      overageRecords: 0,
      activeHolds: 0,
      continuityGaps: 0
    }
  };

  var sheetsToProtect = HIPAA_RETENTION_CONFIG.SHEETS_TO_PROTECT;

  for (var s = 0; s < sheetsToProtect.length; s++) {
    var sheetName = sheetsToProtect[s];
    var sheet = ss.getSheetByName(sheetName);
    var archiveSheet = ss.getSheetByName(sheetName + HIPAA_RETENTION_CONFIG.ARCHIVE_SHEET_SUFFIX);

    var sheetReport = {
      sheetName: sheetName,
      exists: !!sheet,
      isProtected: false,
      activeRecords: 0,
      archivedRecords: 0,
      oldestActiveRecord: null,
      newestActiveRecord: null,
      overageRecords: 0,
      archiveExists: !!archiveSheet,
      status: 'OK'
    };

    if (!sheet) {
      sheetReport.status = 'MISSING';
      report.findings.push({
        severity: 'INFO',
        sheet: sheetName,
        finding: 'Sheet does not exist (may not have been created yet — created on first use)'
      });
      report.sheets.push(sheetReport);
      report.summary.totalSheets++;
      continue;
    }

    // Check protection
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    sheetReport.isProtected = protections.length > 0;
    if (!sheetReport.isProtected) {
      sheetReport.status = 'NON_COMPLIANT';
      report.overallStatus = 'NON_COMPLIANT';
      report.summary.unprotectedSheets++;
      report.findings.push({
        severity: 'HIGH',
        sheet: sheetName,
        finding: 'Sheet is NOT protected — records can be deleted without warning'
      });
    } else {
      report.summary.protectedSheets++;
    }

    // Count records and check dates
    var data = sheet.getDataRange().getValues();
    sheetReport.activeRecords = Math.max(0, data.length - 1);
    report.summary.totalActiveRecords += sheetReport.activeRecords;

    if (data.length > 1) {
      var headers = data[0];
      var tsColIdx = -1;
      for (var h = 0; h < headers.length; h++) {
        var hdr = String(headers[h]).toLowerCase();
        if (hdr === 'timestamp' || hdr === 'createddate' || hdr === 'requestdate'
            || hdr === 'discoverydate' || hdr === 'authorizationdate') {
          tsColIdx = h;
          break;
        }
      }

      if (tsColIdx !== -1) {
        var dates = [];
        for (var r = 1; r < data.length; r++) {
          var d = data[r][tsColIdx];
          var dateVal = d instanceof Date ? d : new Date(d);
          if (!isNaN(dateVal.getTime())) {
            dates.push(dateVal);
            if (dateVal < cutoffDate) {
              sheetReport.overageRecords++;
            }
          }
        }
        if (dates.length > 0) {
          dates.sort(function(a, b) { return a - b; });
          sheetReport.oldestActiveRecord = dates[0].toISOString();
          sheetReport.newestActiveRecord = dates[dates.length - 1].toISOString();
        }
      }

      report.summary.overageRecords += sheetReport.overageRecords;
      if (sheetReport.overageRecords > 0) {
        report.findings.push({
          severity: 'MEDIUM',
          sheet: sheetName,
          finding: sheetReport.overageRecords + ' record(s) past retention cutoff not yet archived'
            + ' (may be under legal hold or pending next trigger run)'
        });
      }
    }

    // Check archive
    if (archiveSheet) {
      var archiveData = archiveSheet.getDataRange().getValues();
      sheetReport.archivedRecords = Math.max(0, archiveData.length - 1);
      report.summary.totalArchivedRecords += sheetReport.archivedRecords;
    }

    report.sheets.push(sheetReport);
    report.summary.totalSheets++;
  }

  // Check legal holds
  var holdSheet = ss.getSheetByName('LegalHolds');
  if (holdSheet) {
    var holdData = holdSheet.getDataRange().getValues();
    for (var hr = 1; hr < holdData.length; hr++) {
      if (holdData[hr][10] === 'Active') {
        report.legalHolds.push({
          holdId: holdData[hr][0],
          sheetName: holdData[hr][1],
          holdType: holdData[hr][2],
          reason: holdData[hr][3],
          placedDate: holdData[hr][8],
          expirationDate: holdData[hr][9] || 'Indefinite'
        });
        report.summary.activeHolds++;
      }
    }
  }

  auditLog('retention_compliance_audit', user ? user.email : 'system', report.overallStatus, {
    auditId: report.auditId,
    totalSheets: report.summary.totalSheets,
    protectedSheets: report.summary.protectedSheets,
    overageRecords: report.summary.overageRecords,
    activeHolds: report.summary.activeHolds,
    findingsCount: report.findings.length
  });

  return { success: true, report: report };
}

/**
 * Generates a formatted compliance audit report for export.
 * Admin users get the full report; other roles get a summary-only view.
 *
 * @param {string} sessionToken
 * @param {string} [format='json'] — 'json' or 'text'
 * @returns {Object} { success, format, data, filename }
 */
function getComplianceAuditReport(sessionToken, format) {
  return wrapRetentionOperation('getComplianceAuditReport', sessionToken, function(user) {
    var isAdmin = hasPermission(user.role, 'admin');

    var audit = auditRetentionCompliance(sessionToken);
    if (!audit.success) return audit;

    var report = audit.report;
    format = (format || 'json').toLowerCase();
    var dateStr = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
    var filename = 'retention-compliance-audit-' + dateStr;

    if (!isAdmin) {
      var summary = {
        auditId: report.auditId,
        timestamp: report.timestamp,
        overallStatus: report.overallStatus,
        sheetsAudited: report.summary.totalSheets,
        protectedSheets: report.summary.protectedSheets,
        activeHolds: report.summary.activeHolds,
        findingsCount: report.findings.length
      };
      return {
        success: true,
        format: format,
        data: format === 'json' ? JSON.stringify(summary, null, 2) : formatComplianceTextSummary(summary),
        filename: filename + '-summary.' + (format === 'json' ? 'json' : 'txt')
      };
    }

    if (format === 'json') {
      return {
        success: true,
        format: 'json',
        data: JSON.stringify(report, null, 2),
        filename: filename + '.json'
      };
    }

    var lines = [
      '═══════════════════════════════════════════',
      '  HIPAA RETENTION COMPLIANCE AUDIT REPORT',
      '  Audit ID: ' + report.auditId,
      '  Date: ' + report.timestamp,
      '  Auditor: ' + report.auditor,
      '  Overall Status: ' + report.overallStatus,
      '═══════════════════════════════════════════',
      '',
      'SUMMARY',
      '  Total sheets: ' + report.summary.totalSheets,
      '  Protected: ' + report.summary.protectedSheets,
      '  Unprotected: ' + report.summary.unprotectedSheets,
      '  Active records: ' + report.summary.totalActiveRecords,
      '  Archived records: ' + report.summary.totalArchivedRecords,
      '  Overage (past cutoff): ' + report.summary.overageRecords,
      '  Active legal holds: ' + report.summary.activeHolds,
      '',
      'SHEET DETAILS',
    ];

    for (var i = 0; i < report.sheets.length; i++) {
      var sht = report.sheets[i];
      lines.push('  ' + sht.sheetName + ': ' + sht.status
        + ' (' + sht.activeRecords + ' active, ' + sht.archivedRecords + ' archived)');
    }

    if (report.findings.length > 0) {
      lines.push('');
      lines.push('FINDINGS');
      for (var f = 0; f < report.findings.length; f++) {
        lines.push('  [' + report.findings[f].severity + '] '
          + report.findings[f].sheet + ': ' + report.findings[f].finding);
      }
    }

    if (report.legalHolds.length > 0) {
      lines.push('');
      lines.push('ACTIVE LEGAL HOLDS');
      for (var lh = 0; lh < report.legalHolds.length; lh++) {
        var hold = report.legalHolds[lh];
        lines.push('  ' + hold.holdId + ': ' + hold.sheetName
          + ' (' + hold.holdType + ') — ' + hold.reason);
      }
    }

    return {
      success: true,
      format: 'text',
      data: lines.join('\n'),
      filename: filename + '.txt'
    };
  });
}

/**
 * Formats a summary object as plain text for non-admin compliance report view.
 */
function formatComplianceTextSummary(summary) {
  return 'Retention Compliance Summary\n'
    + '  Audit ID: ' + summary.auditId + '\n'
    + '  Date: ' + summary.timestamp + '\n'
    + '  Status: ' + summary.overallStatus + '\n'
    + '  Sheets audited: ' + summary.sheetsAudited + '\n'
    + '  Protected: ' + summary.protectedSheets + '\n'
    + '  Active holds: ' + summary.activeHolds + '\n'
    + '  Findings: ' + summary.findingsCount;
}

/**
 * Sets up a weekly time-driven trigger for automated compliance auditing.
 * Run this ONCE from the Apps Script editor (Run → setupComplianceAuditTrigger).
 * The trigger fires once per week on Sunday at 3:00 AM EST.
 */
function setupComplianceAuditTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'auditRetentionCompliance') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('auditRetentionCompliance')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(3)
    .inTimezone('America/New_York')
    .create();

  auditLog('compliance_audit_trigger_installed', 'system', 'success', {
    schedule: 'Weekly on Sunday at 3:00 AM EST',
    handler: 'auditRetentionCompliance()'
  });
}

// ═══════════════════════════════════════════════════════
// PHASE C — SHARED UTILITIES
// ═══════════════════════════════════════════════════════

/**
 * Computes a SHA-256 checksum for an array of row values.
 * Used to verify archive integrity — the checksum is stored at archival time
 * and can be recomputed later to detect tampering or corruption.
 *
 * @param {Array[]} rows - Array of row arrays (each row is an array of cell values)
 * @returns {string} Hex-encoded SHA-256 digest
 */
function computeRowsChecksum(rows) {
  var serialized = rows.map(function(row) {
    return row.map(function(cell) {
      if (cell instanceof Date) return cell.toISOString();
      if (cell === null || cell === undefined) return '';
      return String(cell);
    }).join('|');
  }).join('\n');

  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    serialized,
    Utilities.Charset.UTF_8
  );

  return digest.map(function(byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

/**
 * Wraps a Phase C retention operation with standard error handling.
 * Delegates to wrapHipaaOperation() with Phase C-specific audit logging.
 *
 * @param {string} operationName - Name of the operation
 * @param {string} sessionToken - Session token
 * @param {Function} operationFn - The operation to execute (receives user object)
 * @returns {Object} Operation result or structured error
 */
function wrapRetentionOperation(operationName, sessionToken, operationFn) {
  return wrapHipaaOperation(operationName, sessionToken, function(user) {
    auditLog('retention_operation', user.email, 'started', {
      operation: operationName
    });
    var result = operationFn(user);
    auditLog('retention_operation', user.email, 'completed', {
      operation: operationName
    });
    return result;
  });
}

/**
 * Returns the notification email for legal hold events.
 * Falls back to BREACH_ALERT_CONFIG.SECURITY_OFFICER_EMAIL if not configured.
 *
 * @returns {string} Email address or empty string if not configured
 */
function getHoldNotificationEmail() {
  return LEGAL_HOLD_CONFIG.HOLD_NOTIFICATION_EMAIL
    || BREACH_ALERT_CONFIG.SECURITY_OFFICER_EMAIL
    || '';
}

/**
 * Determines the retention-relevant date for a record.
 * Per §164.316(b)(2)(i): 6 years from creation or "last in effect", whichever is later.
 *
 * @param {Object[]} headers - Column headers from the sheet
 * @param {Array} row - Row data
 * @returns {Date} The later of creation date or last-in-effect date
 */
function getRetentionRelevantDate(headers, row) {
  var creationDate = null;
  var lastInEffectDate = null;

  var creationCols = ['timestamp', 'createddate', 'requestdate', 'discoverydate', 'authorizationdate'];
  var lastInEffectCols = ['resolutiondate', 'revocationdate', 'expirationdate', 'approvaldate', 'releasedate', 'completiondate'];

  for (var i = 0; i < headers.length; i++) {
    var hdr = String(headers[i]).toLowerCase().replace(/[^a-z]/g, '');
    var val = row[i];
    if (!val) continue;

    var dateVal = val instanceof Date ? val : new Date(val);
    if (isNaN(dateVal.getTime())) continue;

    if (creationCols.indexOf(hdr) !== -1 && !creationDate) {
      creationDate = dateVal;
    }
    if (lastInEffectCols.indexOf(hdr) !== -1) {
      if (!lastInEffectDate || dateVal > lastInEffectDate) {
        lastInEffectDate = dateVal;
      }
    }
  }

  if (creationDate && lastInEffectDate) {
    return creationDate > lastInEffectDate ? creationDate : lastInEffectDate;
  }
  return creationDate || lastInEffectDate || new Date(0);
}


// ══════════════
// AUTH END
// ══════════════
// Developed by: LightAISolutions
