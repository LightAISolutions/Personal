var VERSION = "v01.06g";
var TITLE = "Testauthhtml1 Title";
var GITHUB_OWNER  = "LightAISolutions";
var GITHUB_REPO   = "lightaisolutions";
var GITHUB_BRANCH = "main";
var FILE_PATH     = "googleAppsScripts/Testauthhtml1/testauthhtml1.gs";
var DEPLOYMENT_ID = "YOUR_DEPLOYMENT_ID";
var EMBED_PAGE_URL = "https://lightaisolutions.github.io/lightaisolutions/testauthhtml1.html";

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
var SHEET_NAME     = "Live_Sheet";
// Master ACL spreadsheet — centralized access control for all GAS-powered pages.
// Two tabs:
//   "Access" — Row 1 = headers (Email, Role, page1, page2, ...). Rows 2+ = email in col A, role in col B, TRUE/FALSE per page.
//   "Roles"  — Row 1 = headers (Role, perm1, perm2, ...). Rows 2+ = role name in col A, TRUE/FALSE per permission.
// UI element gating is handled client-side via data-requires-permission and data-requires-role attributes on HTML elements.
// If configured, this replaces the old editor/viewer sharing-list check.
// Leave as placeholder to fall back to SPREADSHEET_ID editor/viewer check.
var MASTER_ACL_SPREADSHEET_ID = "YOUR_MASTER_ACL_SPREADSHEET_ID";
var ACL_SHEET_NAME = "Access";
var ACL_PAGE_NAME  = "testauthhtml1";
var PORTAL_ICON    = "🔐";
var PORTAL_DESCRIPTION = "Authentication testing environment with full security features.";

// Unified toggleable auth configuration (see 6-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md)
// Select a preset, then apply per-project overrides.
var ACTIVE_PRESET = 'hipaa';     // 'standard' or 'hipaa'
var PROJECT_OVERRIDES = {
  ENABLE_DOMAIN_RESTRICTION: false,  // allow any Google account (override hipaa default)
  // ALLOWED_DOMAINS: ['yourdomain.com'],  // set this if you enable domain restriction
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
    // PROJECT OVERRIDE START: test environment shortened timeouts
    SESSION_EXPIRATION: 180,           // ⚡ TEST VALUE (3min) — production: 3600
    ABSOLUTE_SESSION_TIMEOUT: 300,     // ⚡ TEST VALUE (5min) — production: 28800
    // PROJECT OVERRIDE END
    ENABLE_HEARTBEAT: true,
    // PROJECT OVERRIDE START: test environment shortened timeouts
    HEARTBEAT_INTERVAL: 30,            // ⚡ TEST VALUE (30s) — production: 300
    // PROJECT OVERRIDE END
    MAX_SESSIONS_PER_USER: 1,
    // PROJECT OVERRIDE START: test environment shortened timeouts
    OAUTH_TOKEN_LIFETIME: 180,         // ⚡ TEST VALUE (3min) — production: 3600
    OAUTH_REFRESH_BUFFER: 60,          // ⚡ TEST VALUE (1min) — production: 300
    // PROJECT OVERRIDE END
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
    // PROJECT OVERRIDE START: test environment shortened timeouts
    SESSION_EXPIRATION: 180,           // ⚡ TEST VALUE (3min) — production: 900
    ABSOLUTE_SESSION_TIMEOUT: 300,     // ⚡ TEST VALUE (5min) — production: 28800
    // PROJECT OVERRIDE END
    ENABLE_HEARTBEAT: true,
    // PROJECT OVERRIDE START: test environment shortened timeouts
    HEARTBEAT_INTERVAL: 30,            // ⚡ TEST VALUE (30s) — production: 300
    // PROJECT OVERRIDE END
    MAX_SESSIONS_PER_USER: 1,
    // PROJECT OVERRIDE START: test environment shortened timeouts
    OAUTH_TOKEN_LIFETIME: 180,         // ⚡ TEST VALUE (3min) — production: 3600
    OAUTH_REFRESH_BUFFER: 60,          // ⚡ TEST VALUE (1min) — production: 300
    // PROJECT OVERRIDE END
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
// PROJECT START
// ══════════════

// ── Live Data via CacheService ──
// PROJECT OVERRIDE: Data reads via CacheService — refreshed by installable onEdit
// trigger bound to the target spreadsheet. Spreadsheet stays private.
// processHeartbeat() piggybacks cached data on existing heartbeat calls (zero extra quota).
// Heartbeat reads re-up the cache TTL so data never expires while viewers are present.
// One-time setup: run installEditTrigger() from the script editor.

/**
 * refreshDataCache() — reads the private spreadsheet and stores data in CacheService.
 * Called by the installable onEdit trigger when the data sheet is edited, and as a
 * self-repair fallback when getCachedData() finds an empty cache.
 */
function refreshDataCache() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      // Auto-create the sheet with default headers if it was deleted
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, 6).setValues([['Timestamp', 'Barcode', 'Item Name', 'Quantity', 'Last Updated', 'Last User']]);
      // Clear stale cache so old data doesn't persist
      CacheService.getScriptCache().remove('livedata_' + SHEET_NAME);
    }
    var data = sheet.getDataRange().getValues();
    var headers = data[0] || [];
    var rows = data.slice(1);
    var result = JSON.stringify({ headers: headers, rows: rows, ts: Date.now() });
    // 100KB CacheService limit per key — large sheets may need chunking in the future
    // 21600s (6h) TTL — heartbeat reads re-up this TTL so it never expires while viewers
    // are present. The long TTL is a safety net for gaps between the last viewer leaving
    // and the next one arriving.
    CacheService.getScriptCache().put('livedata_' + SHEET_NAME, result, 21600);
  } catch (e) {
    Logger.log('refreshDataCache error: ' + e.message);
  }
}

/**
 * getCachedData() — reads live data from CacheService with self-healing.
 * On cache hit: re-ups the TTL so data stays alive as long as viewers are present.
 * On cache miss: self-repairs by calling refreshDataCache() to read the spreadsheet.
 * Returns parsed object { headers, rows, ts } or null if spreadsheet is unavailable.
 */
function getCachedData() {
  var cache = CacheService.getScriptCache();
  var key = 'livedata_' + SHEET_NAME;
  var cached = cache.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  // Self-repair: cache miss → read spreadsheet, warm cache
  refreshDataCache();
  cached = cache.get(key);
  return cached ? JSON.parse(cached) : null;
}

/**
 * onEditInstallable(e) — refreshes CacheService immediately when the data sheet is edited.
 * Installable trigger — required because this is a standalone script (not container-bound).
 * One-time setup: run installEditTrigger() from the Apps Script editor.
 * Only refreshes when the edited sheet matches SHEET_NAME.
 */
function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;
    if (e.range.getSheet().getName() === SHEET_NAME) {
      refreshDataCache();
    }
  } catch (err) {
    Logger.log('onEditInstallable cache refresh error: ' + err.message);
  }
}

/**
 * installEditTrigger() — one-time setup function. Run this manually from the
 * Apps Script editor (Run → installEditTrigger) to create an installable onEdit
 * trigger bound to the target spreadsheet.
 * Safe to run multiple times — removes existing triggers before creating a new one.
 */
function installEditTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditInstallable') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('onEditInstallable')
    .forSpreadsheet(SPREADSHEET_ID)
    .onEdit()
    .create();
  Logger.log('Edit trigger installed for spreadsheet: ' + SPREADSHEET_ID);
}

/**
 * writeCell(token, row, col, value) — writes a single cell value to the data spreadsheet.
 * Validates the session first (requires 'write' permission via RBAC).
 * After writing, refreshes the cache immediately for instant feedback.
 * Returns signed response with updated live data.
 */
function writeCell(token, row, col, value) {
  var user = validateSessionForData(token, 'writeCell');
  checkPermission(user, 'write', 'writeCell');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    return signMessage({ type: 'gas-write-error', error: 'sheet_not_found' }, user.messageKey || '');
  }

  // +2 for header row offset (row 0 = data row 0 = spreadsheet row 2), +1 for 1-indexed
  sheet.getRange(row + 2, col + 1).setValue(value);

  // Refresh cache immediately for instant feedback (onEditInstallable will also fire)
  refreshDataCache();

  auditLog('data_write', user.email, 'cell_edit', {
    row: row, col: col, sheet: SHEET_NAME
  });

  var writeResult = signMessage({ type: 'gas-write-ok' }, user.messageKey || '');
  // Attach liveData AFTER signing — nested objects cause HMAC mismatch
  writeResult.liveData = getCachedData();
  return writeResult;
}

/**
 * addRow(token, valuesJSON) — appends a new row to the data spreadsheet.
 * valuesJSON is a JSON string of an array of cell values matching the header columns.
 * Accepts JSON string because google.script.run can mangle array parameters.
 * Validates the session first (requires 'write' permission via RBAC).
 * After writing, refreshes the cache immediately for instant feedback.
 * Returns signed response with updated live data.
 */
function addRow(token, valuesJSON) {
  var user = validateSessionForData(token, 'addRow');
  checkPermission(user, 'write', 'addRow');

  var values;
  try {
    values = JSON.parse(valuesJSON);
  } catch (e) {
    return signMessage({ type: 'gas-write-error', error: 'invalid_values: ' + e.message }, user.messageKey || '');
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    return signMessage({ type: 'gas-write-error', error: 'sheet_not_found' }, user.messageKey || '');
  }

  sheet.appendRow(values);

  // Refresh cache immediately for instant feedback
  refreshDataCache();

  auditLog('data_write', user.email, 'add_row', {
    cols: values.length, sheet: SHEET_NAME
  });

  var addResult = signMessage({ type: 'gas-write-ok' }, user.messageKey || '');
  addResult.liveData = getCachedData();
  return addResult;
}

/**
 * getAuthenticatedData(token) — validates session then returns cached data.
 * Used by the GAS-internal data poll (google.script.run from the GAS UI).
 * Requires 'read' permission via RBAC.
 */
function getAuthenticatedData(token) {
  var user = validateSessionForData(token, 'getAuthenticatedData');
  checkPermission(user, 'read', 'getAuthenticatedData');
  return getCachedData();
}

/**
 * deleteRow(token, rowIndex) — deletes a data row from the spreadsheet by its 0-based index.
 * rowIndex 0 = first data row (spreadsheet row 2, after header).
 * Validates the session first (requires 'write' permission via RBAC).
 * After deleting, refreshes the cache immediately for instant feedback.
 * Returns signed response with updated live data.
 */
function deleteRow(token, rowIndex) {
  var user = validateSessionForData(token, 'deleteRow');
  checkPermission(user, 'write', 'deleteRow');

  rowIndex = parseInt(rowIndex, 10);
  if (isNaN(rowIndex) || rowIndex < 0) {
    return signMessage({ type: 'gas-write-error', error: 'invalid_row_index' }, user.messageKey || '');
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    return signMessage({ type: 'gas-write-error', error: 'sheet_not_found' }, user.messageKey || '');
  }

  // +2 for header row offset (row 0 = data row 0 = spreadsheet row 2)
  var sheetRow = rowIndex + 2;
  if (sheetRow > sheet.getLastRow()) {
    return signMessage({ type: 'gas-write-error', error: 'row_out_of_range' }, user.messageKey || '');
  }

  sheet.deleteRow(sheetRow);

  // Refresh cache immediately for instant feedback
  refreshDataCache();

  auditLog('data_write', user.email, 'delete_row', {
    row: rowIndex, sheet: SHEET_NAME
  });

  var deleteResult = signMessage({ type: 'gas-write-ok' }, user.messageKey || '');
  deleteResult.liveData = getCachedData();
  return deleteResult;
}

// ══════════════
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
//   return { success: true, email: user.email };
// }
// =============================================
// PROJECT START — testauthhtml1 data operations
// Phase 3: clientIp parameter removed — to re-enable, change signature to:
// function saveNote(sessionToken, noteText, clientIp) {
function saveNote(sessionToken, noteText) {
  var user = validateSessionForData(sessionToken, 'saveNote');
  // RBAC: require 'write' permission — throws PERMISSION_DENIED if denied
  checkPermission(user, 'write', 'saveNote');
  // Phase 3 (C-3): Client IP no longer collected — use 'not-collected' for audit trail
  // To re-enable: var ip = clientIp || user.clientIp || '';
  var ip = user.clientIp || 'not-collected';
  // Data operation (only runs if session is valid AND permission granted)
  // Security: sessionId omitted from session audit log details (it's already in the SessionId column via dataAuditLog)
  auditLog('data_access', user.email, 'write',
    { operation: 'saveNote', noteLength: (noteText || '').length, clientIp: ip,
      role: user.role });
  // Data-level audit log (Phase 8 — HIPAA per-operation logging)
  // Security: sessionId truncated to 8 chars to prevent token theft from audit logs.
  // To log the full token, change the line below to: sessionId: sessionToken,
  var truncatedSessionId = sessionToken ? sessionToken.substring(0, 8) + '...' : '';
  var noteId = Utilities.getUuid();
  dataAuditLog(user, 'write', 'patient_note', noteId, {
    sessionId: truncatedSessionId,
    isEmergencyAccess: user.isEmergencyAccess,
    noteLength: (noteText || '').length,
    clientIp: ip,
    role: user.role,
    permissionChecked: 'write'
  });
  return { success: true, email: user.email, note: noteText, role: user.role };
}
// PROJECT END

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

// PROJECT START — testauthhtml1 data polling
// ── Authenticated data poll — lightweight session check + data return ──
// Called from doGet(action=getData) with token passed as URL parameter.
// Unlike processHeartbeat(), this does NOT extend the session — it only verifies
// the session exists in CacheService, then returns cached data. ~2x lighter than
// heartbeat (no HMAC regen, no session write, no absolute timeout check).
function processDataPoll(token) {
  if (!token) {
    return {type: 'live-data', data: null, error: 'no_token'};
  }
  var cache = getEpochCache();
  var sessionRaw = cache.get("session_" + token);
  if (!sessionRaw) {
    return {type: 'live-data', data: null, error: 'no_session'};
  }
  // Session exists — user is authenticated. Return cached data.
  return {type: 'live-data', data: getCachedData()};
}
// PROJECT END
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
    // PROJECT: Evaluate breach alert thresholds after logging
    evaluateBreachAlert(String(eventType).substring(0, 50), seDetails); // PROJECT: breach alert
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
  // PROJECT START — testauthhtml1 data poll action handler
  // Data poll action — validates session token then returns cached data inline.
  // Token is passed as URL parameter (not postMessage — Google's nested iframe
  // wrapper drops parent→child messages, making the ready/token handshake unreliable).
  // Security: token is HTTPS-encrypted in transit, and only validates session existence
  // (read-only CacheService check, no session extension).
  if (action === 'getData') {
    var dpToken = (e && e.parameter && e.parameter.token) || '';
    var dpResult = processDataPoll(dpToken);
    var dataListenerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
      + 'var PARENT_ORIGIN = ' + JSON.stringify(PARENT_ORIGIN) + ';'
      + 'window.top.postMessage(' + JSON.stringify(dpResult) + ', PARENT_ORIGIN);'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(dataListenerHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  // PROJECT END

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

  // PROJECT START — Worker RPC bridge for HTML-layer UI
  // Returns a lightweight page that proxies google.script.run calls via postMessage.
  // The HTML layer sends {type:'gas-rpc', callId:N, fn:'functionName', args:[...]}
  // and receives {type:'gas-rpc-result', callId:N, result:...} or {type:'gas-rpc-error',...}.
  // Also sends gas-auth-ok on load so the existing auth flow works unchanged.
  if (action === 'worker') {
    var workerSessionToken = sessionToken || '';
    var workerSession = validateSession(workerSessionToken);
    if (workerSession.status !== 'authorized') {
      var workerAuthHtml = '<!DOCTYPE html><html><body><script>'
        + 'window.top.postMessage({type:"gas-needs-auth",authStatus:"' + escapeJs(workerSession.status) + '",email:"' + escapeJs(workerSession.email || '') + '",version:"' + escapeJs(VERSION) + '",evictionReason:"' + escapeJs(workerSession.evictionReason || '') + '"}, ' + JSON.stringify(PARENT_ORIGIN) + ');'
        + '</' + 'script></body></html>';
      return HtmlService.createHtmlOutput(workerAuthHtml)
        .setTitle(TITLE)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    // Retrieve messageKey for signing outgoing messages
    var workerMsgKey = '';
    try {
      var wCache = getEpochCache();
      var wRaw = wCache.get('session_' + workerSessionToken);
      if (wRaw) { workerMsgKey = JSON.parse(wRaw).messageKey || ''; }
    } catch(ex) {}
    var workerIsAdmin = (workerSession.role === 'admin');
    var workerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
      + 'var PARENT_ORIGIN = ' + JSON.stringify(PARENT_ORIGIN) + ';'
      // Send gas-auth-ok on load (same as the old doGet session page)
      + 'window.top.postMessage({type:"gas-auth-ok",'
      + '  version:' + JSON.stringify(VERSION) + ','
      + '  needsReauth:' + (workerSession.needsReauth || false) + ','
      + '  messageKey:' + JSON.stringify(workerMsgKey) + ','
      + '  role:' + JSON.stringify(workerSession.role || RBAC_DEFAULT_ROLE) + ','
      + '  permissions:' + JSON.stringify(workerSession.permissions || getRolesFromSpreadsheet()[workerSession.role] || getRolesFromSpreadsheet()[RBAC_DEFAULT_ROLE]) + ','
      + '  isAdmin:' + workerIsAdmin
      + '}, PARENT_ORIGIN);'
      // Also send signed version via google.script.run (belt-and-suspenders)
      + 'google.script.run'
      + '  .withSuccessHandler(function(signed) {'
      + '    window.top.postMessage(signed, PARENT_ORIGIN);'
      + '  })'
      + '  .withFailureHandler(function() {})'
      + '  .signAppMessage(' + JSON.stringify(workerSessionToken) + ', "gas-auth-ok");'
      // RPC bridge: listen for gas-rpc messages and proxy to google.script.run
      + 'window.addEventListener("message", function(evt) {'
      + '  if (evt.origin !== PARENT_ORIGIN) return;'
      + '  if (!evt.data) return;'
      // Handle gas-version-check (existing protocol)
      + '  if (evt.data.type === "gas-version-check") {'
      + '    google.script.run'
      + '      .withSuccessHandler(function(signed) { window.top.postMessage(signed, PARENT_ORIGIN); })'
      + '      .withFailureHandler(function() {})'
      + '      .signAppMessage(' + JSON.stringify(workerSessionToken) + ', "gas-version");'
      + '    return;'
      + '  }'
      // Handle generic RPC calls
      + '  if (evt.data.type !== "gas-rpc") return;'
      + '  var callId = evt.data.callId;'
      + '  var fn = evt.data.fn;'
      + '  var args = evt.data.args || [];'
      + '  try {'
      + '    var runner = google.script.run'
      + '      .withSuccessHandler(function(r) {'
      + '        window.top.postMessage({type:"gas-rpc-result",callId:callId,result:r}, PARENT_ORIGIN);'
      + '      })'
      + '      .withFailureHandler(function(e) {'
      + '        window.top.postMessage({type:"gas-rpc-error",callId:callId,error:String(e)}, PARENT_ORIGIN);'
      + '      });'
      + '    runner[fn].apply(runner, args);'
      + '  } catch(ex) {'
      + '    window.top.postMessage({type:"gas-rpc-error",callId:callId,error:String(ex)}, PARENT_ORIGIN);'
      + '  }'
      + '});'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(workerHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  // PROJECT END

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


  // PROJECT OVERRIDE START: Full GAS UI removed — migrated to HTML layer
  // The session route now returns the same worker RPC bridge as ?action=worker.
  // All visual UI is rendered by the HTML page (testauthhtml1.html).
  var isAdmin = (session.role === 'admin');
  var fallbackWorkerHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>'
    + 'var PARENT_ORIGIN = ' + JSON.stringify(PARENT_ORIGIN) + ';'
    + 'window.top.postMessage({type:"gas-auth-ok",'
    + '  version:' + JSON.stringify(VERSION) + ','
    + '  needsReauth:' + (session.needsReauth || false) + ','
    + '  messageKey:' + JSON.stringify(appMsgKey) + ','
    + '  role:' + JSON.stringify(session.role || RBAC_DEFAULT_ROLE) + ','
    + '  permissions:' + JSON.stringify(session.permissions || getRolesFromSpreadsheet()[session.role] || getRolesFromSpreadsheet()[RBAC_DEFAULT_ROLE]) + ','
    + '  isAdmin:' + isAdmin
    + '}, PARENT_ORIGIN);'
    + 'google.script.run'
    + '  .withSuccessHandler(function(signed) {'
    + '    window.top.postMessage(signed, PARENT_ORIGIN);'
    + '  })'
    + '  .withFailureHandler(function() {})'
    + '  .signAppMessage(' + JSON.stringify(sessionToken) + ', "gas-auth-ok");'
    + 'window.addEventListener("message", function(evt) {'
    + '  if (evt.origin !== PARENT_ORIGIN) return;'
    + '  if (!evt.data) return;'
    + '  if (evt.data.type === "gas-version-check") {'
    + '    google.script.run'
    + '      .withSuccessHandler(function(signed) { window.top.postMessage(signed, PARENT_ORIGIN); })'
    + '      .withFailureHandler(function() {})'
    + '      .signAppMessage(' + JSON.stringify(sessionToken) + ', "gas-version");'
    + '    return;'
    + '  }'
    + '  if (evt.data.type !== "gas-rpc") return;'
    + '  var callId = evt.data.callId;'
    + '  var fn = evt.data.fn;'
    + '  var args = evt.data.args || [];'
    + '  try {'
    + '    var runner = google.script.run'
    + '      .withSuccessHandler(function(r) {'
    + '        window.top.postMessage({type:"gas-rpc-result",callId:callId,result:r}, PARENT_ORIGIN);'
    + '      })'
    + '      .withFailureHandler(function(e) {'
    + '        window.top.postMessage({type:"gas-rpc-error",callId:callId,error:String(e)}, PARENT_ORIGIN);'
    + '      });'
    + '    runner[fn].apply(runner, args);'
    + '  } catch(ex) {'
    + '    window.top.postMessage({type:"gas-rpc-error",callId:callId,error:String(ex)}, PARENT_ORIGIN);'
    + '  }'
    + '});'
    + '</' + 'script></body></html>';
  return HtmlService.createHtmlOutput(fallbackWorkerHtml)
    .setTitle(TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  // PROJECT OVERRIDE END
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
 * For testauthhtml1 (small dataset), export is synchronous.
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
      generatedBy: 'testauthhtml1 v' + VERSION
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
    + 'Environment: testauthhtml1\n\n'
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
      title: 'HIPAA Record Retention Policy — testauthhtml1',
      version: '1.0',
      generatedAt: timestamp,
      generatedBy: user.email,
      regulatoryBasis: '45 CFR §164.316(b)(2)(i)',
      sections: [
        {
          heading: '1. Purpose',
          content: 'This document establishes the record retention policy for the testauthhtml1 '
            + 'environment, as required by the HIPAA Security Rule §164.316(b). It defines '
            + 'retention periods, enforcement mechanisms, and exception handling procedures '
            + 'for all electronic protected health information (ePHI) and security documentation.'
        },
        {
          heading: '2. Scope',
          content: 'This policy applies to all electronic records maintained in the testauthhtml1 '
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
