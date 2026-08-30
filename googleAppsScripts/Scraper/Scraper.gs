var VERSION = "v01.83g";
var TITLE = "News Scraper";
var GITHUB_OWNER  = "LightAISolutions";
var GITHUB_REPO   = "Sales";
var GITHUB_BRANCH = "main";
var FILE_PATH     = "googleAppsScripts/Scraper/Scraper.gs";
var DEPLOYMENT_ID = "AKfycby8nOR0AqLsDlZPcrTX9dWIInY48R9Jrl8oBDtN5t0emC06j7iwidEMdXttrD1zXnjUIg";
var EMBED_PAGE_URL = "https://lightaisolutions.github.io/Sales/Scraper.html";

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
var SPREADSHEET_ID = "19U0Wu25eUXEHPVz4VWjKQIpnRozgFycNSjFCTB-umkk";
var SHEET_NAME     = "Live_Sheet";
// Master ACL spreadsheet — centralized access control for all GAS-powered pages.
// Two tabs:
//   "Access" — Row 1 = headers (Email, Role, page1, page2, ...). Rows 2+ = email in col A, role in col B, TRUE/FALSE per page.
//   "Roles"  — Row 1 = headers (Role, perm1, perm2, ...). Rows 2+ = role name in col A, TRUE/FALSE per permission.
// UI element gating is handled client-side via data-requires-permission and data-requires-role attributes on HTML elements.
// If configured, this replaces the old editor/viewer sharing-list check.
// Leave as placeholder to fall back to SPREADSHEET_ID editor/viewer check.
var MASTER_ACL_SPREADSHEET_ID = "1kG2KftqfKOeYwBCEkxRpw-QBh9s-1-Dvy31sH037UvE";
var ACL_SHEET_NAME = "Access";
var ACL_PAGE_NAME  = "Scraper";
var PORTAL_ICON    = "📱";
var PORTAL_DESCRIPTION = "News Scraper application.";

// Unified toggleable auth configuration (see 6-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md)
// Select a preset, then apply per-project overrides.
var ACTIVE_PRESET = 'hipaa';     // 'standard' or 'hipaa' — hipaa matches the proven working configuration: its postMessage token exchange is what the auth HTML template hardcodes ('standard' defaults to 'url', which makes every sign-in time out on the reachability watchdog)
var PROJECT_OVERRIDES = {
  ENABLE_DOMAIN_RESTRICTION: false,
  ALLOWED_DOMAINS: [],
  SESSION_EXPIRATION: 7200,        // seconds — rolling session lifetime (2hr); overrides the hipaa preset's 900s default. The client countdown derives from this via the heartbeat's expiresIn, so no second constant is needed.
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
// ══════════════

/**
 * ── News Scraper · Phase 1 ─────────────────────────────────────────────
 * Data model + project management. Each research topic is a "Project"
 * owned by the signed-in user (rows keyed by owner email). All routes are
 * session-gated via validateSessionForData and reached through the
 * iframe-free fetch transport (doPost actions + doGet api mirror).
 */

var SCRAPER_TABS = {
  PROJECTS: 'Projects',
  SCHEDULES: 'Schedules',
  ARTICLES: 'Articles',
  REPORTS: 'Reports',
  PROFILES: 'Profiles',
  PREFERENCES: 'Preferences',
  USAGE: 'UsageLog',
  ARCHIVE: 'ArticlesArchive',
  QUERYPLANS: 'QueryPlans',
  INTERESTS: 'Interests',
  DIGESTS: 'Digests',
  DIGEST_INTAKE: 'DigestIntake',
  EDITIONS: 'Editions',
  SUBSCRIBERS: 'Subscribers',
  CLICK_LOG: 'ClickLog',
  SHARES: 'Shares'
};

var SCRAPER_TAB_HEADERS = {
  Projects: ['Project ID', 'Owner', 'Name', 'Topic', 'Industries', 'Keywords',
             'Exclusions', 'Sources', 'Regions', 'Status', 'Created At', 'Updated At'],
  Schedules: ['Schedule ID', 'Project ID', 'Owner', 'Frequency', 'Custom Config',
              'Delivery', 'Active', 'Next Run', 'Last Run'],
  Articles: ['Article ID', 'Project ID', 'Owner', 'URL', 'Title', 'Source',
             'Published At', 'Fetched At', 'Snippet', 'Summary', 'Relevance Score',
             'User Verdict', 'Report ID'],
  Reports: ['Report ID', 'Project ID', 'Owner', 'Frequency', 'Period Label',
            'Generated At', 'Status', 'Article Count', 'Content'],
  Profiles: ['Email', 'Drive Folder ID', 'Display Name', 'Created At'],
  Preferences: ['Project ID', 'Owner', 'Learned Preferences', 'Suggested Keywords',
                'Verdicts Used', 'Distilled At'],
  UsageLog: ['Date', 'Owner', 'AI Calls', 'Fetch Calls', 'Notes'],
  ArticlesArchive: ['Article ID', 'Project ID', 'Owner', 'URL', 'Title', 'Source',
                    'Published At', 'Fetched At', 'Snippet', 'Summary', 'Relevance Score',
                    'User Verdict', 'Report ID', 'Archived At'],
  QueryPlans: ['Project ID', 'Owner', 'Queries', 'Planned At', 'Manual'],
  Interests: ['Key', 'Type', 'Label', 'Enabled', 'Status', 'Flag', 'Categories',
              'Aliases', 'Weight', 'Source', 'Profiler Updated', 'First Seen',
              'Last Synced', 'Notes'],
  // 'Lead' is denormalised out of the Sections JSON on purpose: the News Stand
  // shows each issue's lead headline on its card, and parsing Sections to get it
  // would mean reading the one column the whole read-path fix exists to avoid.
  // 'No' is denormalised for the same reason 'Lead' is: the News Stand shows it
  // on every card and the renumber pass compares it on every stored issue, and
  // reading it out of the Sections JSON would mean pulling the heavy column to
  // answer a question about one small number.
  // 'Delivered' is what separates building an edition from sending it. The
  // send used to happen inside the render step, which meant every manual "Run
  // intake now" also mailed the subscribers. Now render marks the row pending
  // and a separate delivery pass mails it — so a manual build is silent, and
  // the scheduled send can be held until 7:00 regardless of when the build
  // finished.
  Digests: ['Digest ID', 'Date', 'Generated At', 'Status', 'Item Count',
            'Relevant Count', 'Sections', 'HTML', 'Notes', 'Edition', 'AI', 'Lead',
            'No', 'Delivered'],
  // 'Analysis' is kept apart from 'Summary' rather than appended to it. The two
  // are different kinds of claim — one reports what the article says, the other
  // is the desk's inference about what it means — and a reader is entitled to
  // see which is which. Splitting them in the data rather than in the prose is
  // what stops the boundary eroding whenever the model writes a long sentence.
  DigestIntake: ['Digest ID', 'URL', 'Title', 'Source', 'Published At', 'Snippet',
                 'Score', 'Signals', 'Summary', 'Section', 'Backstop', 'Analysis'],
  // 'Parent' makes an edition a variant of another one ("Your Morning Digest
  // (BESS)" under "Your Morning Digest") instead of a peer. Filtering by a
  // parent includes its variants; filtering by a variant does not reach back up.
  Editions: ['Edition ID', 'Name', 'Cadence', 'Anchor', 'Window Hours', 'Enabled',
             'Last Built Date', 'Created', 'Notes', 'Tuning', 'Preset', 'Parent'],
  Subscribers: ['Email', 'Name', 'Editions', 'Status', 'Admin', 'Token',
                'Added', 'Updated'],
  ClickLog: ['Timestamp', 'Digest ID', 'Item Key', 'URL', 'Title', 'Source',
             'Companies', 'Topics', 'Segments'],
  // One row per share link. The token IS the reference to the issue — nothing
  // in the share URL names a digest — so holding one token can never be
  // pivoted into reading a different edition.
  Shares: ['Token', 'Digest ID', 'Created By', 'Created', 'Revoked',
           'Views', 'Last Viewed']
};

var SCRAPER_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual', 'custom'];
var SCRAPER_DELIVERIES = ['inapp', 'email', 'both'];
var SCRAPER_MAX_PROJECTS_PER_USER = 10;
// Phase 5: the Projects feature is retired — Interests defines scope, the
// source roster defines reach, the rubric scores, and Editions deliver. Its
// routes are unregistered (unreachable) rather than deleted in this push; the
// function bodies and Sheets data are untouched pending a cleanup pass.
var SCRAPER_PROJECT_ACTIONS = ['getSchedulerHealth',
                               'listInterests', 'setInterestEnabled', 'syncInterestsNow',
                               'mineAllDossiers',
                               'rubricPreview', 'digestScoreReport',
                               'runDigestNow', 'getDigestStatus', 'listDigests', 'getDigest',
                               'deleteDigest',
                               'goLiveStatus', 'testAi', 'emailLatestDigest',
                               'setAiProvider', 'addDigestRecipient', 'removeDigestRecipient',
                               'listEditions', 'saveEdition', 'deleteEdition',
                               'setEditionTuning', 'resetEditionTuning',
                               'listSubscribers', 'saveSubscriber', 'removeSubscriber',
                               'searchArchive', 'companyTimeline', 'sourceStats',
                               'previewEdition', 'sendHeldBackRollup',
                               'listShares', 'createShareLink', 'revokeShareLink'];

// ── Phase 3: AI layer tuning ──
var SCRAPER_AI_PROVIDER = 'gemini';            // default; AI_PROVIDER Script Property overrides ('claude' | 'gemini')
var SCRAPER_CLAUDE_MODEL = 'claude-sonnet-5';  // stable Anthropic alias; ANTHROPIC_MODEL Script Property overrides
// No hardcoded Gemini model: Google retires model IDs without warning (2.5-flash-lite
// 404'd on 2026-07-09, months before its announced shutdown). The model is discovered
// live via ListModels, cached in the GEMINI_MODEL_AUTO Script Property, and
// re-discovered automatically when a cached model starts returning 404.
// A GEMINI_MODEL Script Property still overrides everything when set manually.
var SCRAPER_ANALYZE_ARTICLES_PER_CALL = 10;    // articles per AI request
// One AI request per analyzeArticles invocation: browser→GAS exec requests that run
// long die at Google's HTTP front-end (observed as http_404 while fast requests on the
// same deployment return 200). One Gemini call keeps each invocation compile-chunk-sized;
// the client loop provides both continuation and free-tier RPM spacing.
var SCRAPER_ANALYZE_CALLS_PER_INVOCATION = 1;
// Raised 50 -> 55 alongside the evidence gate in scRubricScore_. The gate
// alone already excludes the topic-and-good-writing case that prompted this;
// the extra five points are margin, and cost nothing real because a single
// covered-company match is worth 40 on its own, so a genuinely relevant
// article clears 55 comfortably.
var SCRAPER_RELEVANT_THRESHOLD = 55;           // score >= this counts as relevant
var SCRAPER_BRIEF_TOP_N = 30;                  // top-scored articles fed into the executive brief
var SCRAPER_FEEDBACK_EXAMPLES_MAX = 8;         // 👍/👎 exemplar titles per side injected into the scoring prompt
// ── Feedback distillation: all ratings → a learned-preferences note + search keywords ──
var SCRAPER_DISTILL_MIN_VERDICTS = 3;          // don't distill until at least this many total ratings exist
var SCRAPER_DISTILL_TITLES_MAX = 40;           // rated titles per side fed into the distillation prompt
var SCRAPER_PREFS_NOTE_MAX = 1500;             // stored learned-preferences note cap (chars)
var SCRAPER_CALIB_MIN_SCORE = 10;              // calibration never serves scores below this floor
var SCRAPER_PREFS_KEYWORDS_MAX = 12;           // stored suggested search keywords cap (incl. adjacent topics)

// ── Enrich tuning: harvest publisher abstracts for snippet-less articles ──
var SCRAPER_ENRICH_BATCH_FETCHES = 15;      // page fetches per enrichNow call (client loops)
var SCRAPER_ENRICH_TIME_BUDGET_MS = 40000;  // wall-clock budget per call
var SCRAPER_ENRICH_STATE_PREFIX = 'scEnrich_';

// ── Phase 2: compilation engine tuning ──
var SCRAPER_COMPILE_BATCH_FETCHES = 6;    // max URL fetches per compileNow call (client loops until done)
var SCRAPER_COMPILE_TIME_BUDGET_MS = 40000; // wall-clock budget per compileNow call
var SCRAPER_COMPILE_MAX_NEW = 200;        // cap on new articles per compilation run
var SCRAPER_ARTICLE_SNIPPET_MAX = 300;
var SCRAPER_LIST_ARTICLES_MAX = 100;
var SCRAPER_COMPILE_STATE_PREFIX = 'scCompile_';

// ── Phase 3.5: historical backfill tuning ──
var SCRAPER_BACKFILL_MONTHS = 24;              // GDELT history window (2 years)
var SCRAPER_BACKFILL_BATCH_FETCHES = 6;        // GDELT slice fetches per backfillNow call
var SCRAPER_BACKFILL_TIME_BUDGET_MS = 40000;   // wall-clock budget per backfillNow call
var SCRAPER_BACKFILL_STATE_PREFIX = 'scBackfill_';

// ── Query planner + fetch-time pre-filter + deep backfill tuning ──
var SCRAPER_PLAN_QUERIES_MAX = 24;      // max query groups the AI planner may store
var SCRAPER_PLAN_TOTAL_MAX = 40;        // hard cap incl. manually added groups
var SCRAPER_PLAN_GDELT_MAX = 16;        // plan groups used by GDELT backfill (was 6 auto-built)
var SCRAPER_PLAN_GNEWS_MAX = 24;        // plan groups added to the Compile queue (1 RSS fetch each)
var SCRAPER_PREFILTER_BATCH = 40;       // headlines per pre-filter AI call
var SCRAPER_DEEPBF_STATE_PREFIX = 'scDeepBF_';
var SCRAPER_DEEPBF_MODEL = 'claude-haiku-4-5';  // cheapest web-search-capable model
var SCRAPER_DEEPBF_QUARTERS = 8;        // 2 years of history in quarter slices
var SCRAPER_DEEPBF_GROUPS_MAX = 8;      // query groups per deep backfill run
var SCRAPER_DEEPBF_SEARCHES_PER_CALL = 3;
var SCRAPER_DEEPBF_ARTICLES_PER_CALL = 20;

// ── Rebuild Phase 1: Profiler-derived interest model ──
// The Interests tab mirrors Profiler's public company registry plus a seeded
// topic list. It is the store the Phase 3 digest engine scores against and
// the Phase 2 Interests panel edits. Sync design (approved 2026-08-27):
// a daily pull of the public GitHub Pages registry JSON — new companies
// arrive default-ON flagged "New coverage"; companies that leave the registry
// are marked stale, never deleted. Guidance topics sync at authoring time
// (the Industry Guidance Command adds a seed below), NOT via a runtime
// Profiler API probe.
var SCRAPER_INTERESTS_SYNC_ENABLED = true;   // registry-sync switch, independent of the pipeline pause
var SCRAPER_PROFILER_REGISTRY_URL =
  'https://lightaisolutions.github.io/Sales/profiler-data/profiler-companies.json';
var SCRAPER_INTERESTS_SYNC_MIN_MS = 20 * 3600 * 1000;  // hourly tick syncs at most ~once/day
var SCRAPER_INTERESTS_MAX_ROWS = 2000;       // read cap (registry is ~90 companies today)
var SCRAPER_INTEREST_FLAG_NEW = 'New coverage';
var SCRAPER_INTEREST_FLAG_STALE = 'Coverage ended';

// A SOURCE row leaving the roster is NOT the same event as a COMPANY leaving
// Profiler's registry, and must not borrow its wording. "Coverage ended" is
// true of a company we stopped following; applied to an outlet it asserts the
// publication stopped publishing — which was false for two of the three
// outlets dropped in the Phase 4 shakeout (developer caught this 2026-08-27:
// Data Centre Magazine was still live at datacentremagazine.com/news while
// Scraper displayed "coverage ended" against it).
var SCRAPER_SOURCE_FLAG_RETIRED = 'Dropped from roster';

// Why each dropped outlet was dropped, kept next to the roster so the reason
// survives in the UI instead of only in a changelog.
//   status 'blocked' — the publication is LIVE but refuses automated readers.
//                      Kept visible in Tune (frozen off, sorted last) so the
//                      developer can see the beat is intentionally uncovered.
//   status 'offline' — the publication is gone. Hidden from Tune entirely;
//                      the sheet row is kept for history but never rendered.
// Both are permanent "do not re-propose" records — see
// .claude/rules/scraper-sources.md before suggesting any new outlet. `label` is what Tune
// shows on the chip; `detail` is the hover text. Re-verified 2026-08-27 —
// none of these can be fixed by changing the feed URL, so this also stops a
// future pass from "restoring" a feed that provably cannot be fetched.
var SCRAPER_RETIRED_SOURCES = {
  'src-dc-magazine': {
    status: 'blocked',
    label: 'Blocked to automated readers',
    detail: 'Data Centre Magazine is live and publishing. Its pages sit behind a '
          + 'Cloudflare browser challenge (a JavaScript test no server-side reader can '
          + 'pass) and the site advertises no feed at any address. Re-checked 2026-08-27.'
  },
  'src-battery-technology': {
    status: 'blocked',
    label: 'Blocked to automated readers',
    detail: 'Battery Technology is live and publishing. The whole domain refuses '
          + 'automated readers, including with browser identification. Battery and '
          + 'storage stay covered by Energy-Storage.news and ESS News. Re-checked 2026-08-27.'
  },
  'src-solar-industry': {
    status: 'offline',
    label: 'Site offline',
    detail: 'The publication\'s site is gone — the address now serves a domain-parking '
          + 'page rather than articles. This is the one outlet of the three that genuinely '
          + 'ended. Solar stays covered by pv magazine USA and Solar Power World. '
          + 'Re-checked 2026-08-27.'
  }
};
var SCRAPER_INTEREST_FLAG_NEWTOPIC = 'New topic';

// Topic seeds — the source of truth for non-company interests. 'guidance:'
// seeds map 1:1 to Industry Guidance modules in Profiler.gs (authoring a new
// module adds a seed here per .claude/rules/industry-guidance.md); 'market'
// seeds are the standing US-AIDC-wide topics from the original rebuild
// request (geopolitical policy, public opposition, battery fire incidents).
// Terms are the default search/match aliases; once a seed lands in the
// Interests tab the developer's in-sheet edits win and are never overwritten.
var SCRAPER_INTEREST_TOPIC_SEEDS = [
  { key: 'topic-800vdc-power', label: '800 VDC & AI-factory power architecture',
    terms: ['800 VDC', '800V DC', 'sidecar power rack', 'solid-state transformer', 'power architecture'],
    source: 'guidance:nvidia-800vdc-2026-08' },
  { key: 'topic-china-policy', label: 'China trade policy & BESS supply chain',
    // 'supply chain' alone says nothing about China trade policy — it matched
    // a residential product story and padded its topic band.
    terms: ['tariff', 'export control', 'FEOC', 'Section 301', 'decoupling'],
    source: 'guidance:china-policy-stack-2026-08' },
  { key: 'topic-utility-procurement', label: 'Utility procurement & large-load interconnection',
    terms: ['interconnection', 'large load', 'tariff filing', 'ERCOT', 'PJM', 'co-location', 'behind-the-meter'],
    source: 'guidance:utility-aidc-procurement-2026-08' },
  { key: 'topic-bess-bankability', label: 'BESS bankability, certification & safety standards',
    terms: ['UL 9540A', 'NFPA 855', 'bankability', 'certification', 'warranty'],
    source: 'guidance:bess-bankability-2026-08' },
  { key: 'topic-bess-technology', label: 'BESS technology & battery cell supply',
    terms: ['LFP', 'battery cell', 'sodium-ion', 'grid-scale battery', 'energy storage system'],
    source: 'guidance:bess-tech-fundamentals-2026-08' },
  { key: 'topic-grid-infrastructure', label: 'Grid infrastructure & the AIDC power chain',
    terms: ['grid capacity', 'transformer shortage', 'gas turbine', 'transmission', 'NOGRR 282', 'SB 6'],
    source: 'guidance:power-infra-aidc-2026-08' },
  { key: 'topic-aidc-geopolitics', label: 'Geopolitical & federal policy affecting AIDC',
    terms: ['executive order', 'permitting reform', 'national security', 'chip export', 'energy policy'],
    source: 'market' },
  { key: 'topic-community-opposition', label: 'Data-center siting & public opposition',
    terms: ['moratorium', 'zoning', 'protest', 'opposition', 'noise complaint', 'water use'],
    source: 'market' },
  { key: 'topic-battery-incidents', label: 'Battery fire & safety incidents',
    terms: ['battery fire', 'thermal runaway', 'ESS fire', 'storage facility fire', 'recall'],
    source: 'market' },
  { key: 'topic-aidc-buildout', label: 'US data-center buildout, power deals & capex',
    terms: ['data center', 'gigawatt', 'capex', 'hyperscaler', 'power purchase', 'nuclear'],
    source: 'market' },
  // Supporting topics for the BESS and AIDC editions (v03.21r). Deliberately
  // NOT duplicating 'topic-utility-procurement', which already covers large-
  // load interconnection — a second near-identical topic would double-count
  // the same article in the rubric's topic band.
  { key: 'topic-storage-offtake', label: 'Storage EPC, offtake & tolling',
    terms: ['tolling agreement', 'offtake', 'epc contract', 'storage contract', 'capacity contract', 'ppa', 'resource adequacy'],
    source: 'market' },
  { key: 'topic-storage-degradation', label: 'Storage degradation, augmentation & warranties',
    // 'warranty' alone is not a degradation story and already sits in
    // topic-bess-bankability — one weak word matching two topics doubled the
    // topic band on articles about neither.
    terms: ['degradation', 'augmentation', 'capacity guarantee', 'state of health', 'round-trip efficiency', 'cycle life'],
    source: 'market' },
  { key: 'topic-capacity-markets', label: 'Interconnection queues & capacity markets',
    terms: ['interconnection queue', 'capacity market', 'capacity auction', 'pjm', 'ercot', 'caiso', 'miso', 'queue reform'],
    source: 'market' },
  { key: 'topic-dc-cooling', label: 'Data-center cooling & power density',
    terms: ['liquid cooling', 'power density', 'rack density', 'kilowatt per rack', 'thermal design', 'pue'],
    source: 'market' }
];

// Business-segment lenses (developer feedback 2026-08-27): covered companies
// span many segments (CATL/BYD sell EVs and chargers, Tesla sells cars, ABB
// sells robotics) but the digest should follow only the segments the
// developer cares about. Each seed becomes a toggleable 'segment' row in the
// Interests tab (default ON, insert-only — in-sheet term edits win). The
// rubric's segment gate: an article that matches a covered company but whose
// only segment hits are toggled-OFF segments loses its company + emphasis
// signals, so off-segment company news falls below the relevance bar.
// Articles with no segment-term hits at all are unaffected (neutral).
var SCRAPER_INTEREST_FLAG_NEWSEG = 'New segment';
var SCRAPER_SEGMENT_SEEDS = [
  { key: 'seg-bess', label: 'BESS & grid-scale storage',
    terms: ['bess', 'battery storage', 'energy storage', 'grid-scale battery', 'storage system', 'battery cell', 'lfp', 'sodium-ion', 'megawatt-hour'] },
  // --- Storage split by scale (v03.21r) -----------------------------------
  // `seg-bess` alone could not express "utility-scale yes, residential no",
  // which is exactly the distinction a BESS-supplier edition needs. The
  // parent stays for continuity; these narrow it.
  { key: 'seg-bess-utility', parent: 'seg-bess', label: 'Utility-scale BESS', tv: 2,
    // 'grid-scale battery' deliberately NOT here: it is the generic phrase for
    // the whole category (it lives in seg-bess) and matched a residential
    // product story, letting a sibling rescue a disabled child.
    terms: ['utility-scale storage', 'utility-scale battery', 'grid-scale storage', 'standalone storage', 'front-of-meter', 'transmission-connected', 'iso queue', 'merchant storage'] },
  { key: 'seg-bess-datacenter', parent: 'seg-bess', label: 'Data-center & behind-the-meter storage', tv: 1,
    terms: ['behind-the-meter storage', 'data center battery', 'data center storage', 'ups battery', 'bridging power', 'on-site storage', 'microgrid storage'] },
  // Consumer-portable gear lives here rather than in seg-consumer ON PURPOSE.
  // A portable power station on an Amazon sale used to match no segment at all:
  // the terms below did not cover it, so `excludedSegments` was empty and the
  // gate never fired, while the generic parent (seg-bess: 'energy storage',
  // 'storage system') did match and handed it segment evidence. Because this is
  // a CHILD of seg-bess, a hit here demotes the parent under the existing
  // specificity-beats-breadth rule — independentOn falls to 0, the article is
  // gated, and company/topic/clickBoost are zeroed. Putting these terms in the
  // parentless seg-consumer instead would not have demoted anything.
  // tv MUST be bumped whenever these terms change — the sync only rewrites a
  // sheet row whose seed-terms-vN marker is BEHIND the seed. v03.48r changed
  // the words here and left tv at 1, so the vocabulary never left this file and
  // the developer's next build printed the same consumer article. tv 1 -> 2.
  { key: 'seg-bess-residential', parent: 'seg-bess', label: 'Residential storage', tv: 2,
    terms: ['home battery', 'residential storage', 'residential battery', 'powerwall',
            'home energy storage', 'rooftop storage', 'portable power station',
            'portable battery', 'portable power', 'solar generator', 'home backup',
            'backup battery', 'balcony solar', 'plug-in solar'] },
  { key: 'seg-bess-ci', parent: 'seg-bess', label: 'C&I storage', tv: 1,
    terms: ['commercial and industrial storage', 'c&i storage', 'c&i battery', 'peak shaving', 'demand charge', 'behind-the-meter commercial'] },
  { key: 'seg-bess-longduration', parent: 'seg-bess', label: 'Long-duration storage', tv: 1,
    terms: ['long-duration', 'long duration energy storage', 'ldes', 'flow battery', 'iron-air', 'compressed air storage', 'thermal storage', 'eight-hour storage'] },
  // --- Data-center power chain, split (v03.21r) ---------------------------
  // `power-electronics` and `grid-equipment` squashed the whole AIDC power
  // chain into two buckets; an AIDC-supplier edition needs to follow the
  // pieces separately.
  { key: 'seg-mv-power-conversion', parent: 'seg-power-electronics', label: 'Medium-voltage power conversion', tv: 1,
    terms: ['medium-voltage', 'medium voltage', 'mv ups', 'solid-state transformer', 'power conversion system', 'pcs', 'static ups', '34.5 kv', '13.8 kv'] },
  { key: 'seg-inverters', parent: 'seg-power-electronics', label: 'Inverters & converters', tv: 1,
    terms: ['inverter', 'converter', 'rectifier', 'bidirectional converter', 'dc-dc', 'grid-forming', 'string inverter', 'central inverter'] },
  { key: 'seg-transformers', parent: 'seg-grid-equipment', label: 'Transformers & switchgear', tv: 1,
    terms: ['transformer', 'switchgear', 'substation', 'circuit breaker', 'ring main unit', 'gis switchgear', 'padmount', 'tap changer'] },
  { key: 'seg-gensets', parent: 'seg-gas-turbines', label: 'Diesel gensets & backup power', tv: 1,
    terms: ['diesel generator', 'genset', 'standby generator', 'backup generator', 'emergency power', 'prime power', 'generator set'] },
  { key: 'seg-gas-engines', parent: 'seg-gas-turbines', label: 'Gas turbines & reciprocating engines', tv: 1,
    terms: ['gas turbine', 'reciprocating engine', 'gas engine', 'aeroderivative', 'combined cycle', 'simple cycle', 'turbine order', 'linear generator'] },
  { key: 'seg-sidecar-power', parent: 'seg-aidc', label: 'Sidecar & skid power solutions', tv: 1,
    terms: ['sidecar', 'skid-mounted', 'power skid', 'containerized power', 'modular power block', 'prefabricated power', 'power module'] },
  { key: 'seg-rack-power', parent: 'seg-aidc', label: 'Rack PDU & busway', tv: 1,
    terms: ['rack pdu', 'busway', 'bus bar', 'busbar', 'power distribution unit', 'remote power panel', 'starline', 'whip'] },
  { key: 'seg-psu', parent: 'seg-aidc', label: 'Server PSUs & power shelves', tv: 1,
    terms: ['power supply unit', 'psu', 'power shelf', 'rectifier shelf', 'ors', 'open rack', 'bbu', 'battery backup unit'] },
  { key: 'seg-gpu-silicon', parent: 'seg-semiconductors', label: 'GPU & accelerator silicon', tv: 1,
    terms: ['gpu', 'accelerator', 'blackwell', 'rubin', 'hbm', 'tpu', 'ai chip', 'xpu', 'nvlink'] },
  { key: 'seg-cooling', parent: 'seg-aidc', label: 'Data-center cooling & thermal', tv: 1,
    terms: ['liquid cooling', 'direct-to-chip', 'immersion cooling', 'cdu', 'coolant distribution', 'rear-door heat exchanger', 'chiller', 'thermal management'] },
  { key: 'seg-aidc', label: 'Data centers & AI infrastructure',
    terms: ['data center', 'datacenter', 'ai infrastructure', 'hyperscale', 'colocation', 'ai factory', 'compute campus'] },
  { key: 'seg-grid-equipment', label: 'Transformers & grid equipment',
    terms: ['transformer', 'switchgear', 'substation', 'hvdc', 'grid equipment', 'transmission line'] },
  { key: 'seg-power-electronics', label: 'Power electronics & UPS',
    terms: ['inverter', 'uninterruptible power', 'power conversion system', 'rectifier', 'busway', 'medium-voltage'] },
  { key: 'seg-solar', label: 'Solar',
    terms: ['solar', 'photovoltaic', 'pv module', 'solar panel', 'solar farm'] },
  { key: 'seg-wind', label: 'Wind',
    terms: ['wind turbine', 'wind farm', 'offshore wind', 'onshore wind'] },
  { key: 'seg-nuclear', label: 'Nuclear & SMRs',
    terms: ['nuclear', 'reactor', 'small modular reactor', 'uranium'] },
  { key: 'seg-gas-turbines', label: 'Gas & turbines',
    terms: ['gas turbine', 'natural gas plant', 'combined cycle', 'aeroderivative', 'peaker'] },
  { key: 'seg-fuel-cells', label: 'Fuel cells & hydrogen',
    terms: ['fuel cell', 'hydrogen', 'electrolyzer'] },
  // tv (terms version): bump when a segment's default vocabulary improves —
  // the sync upgrades rows still carrying the auto marker (see scSyncInterests_).
  // tv 2 (2026-08-27): the launch vocabulary missed real automotive coverage
  // ("Full Self Driving", "Model Y", "recall campaign") — two Tesla stories
  // rode the company signal past toggled-off EV segments.
  { key: 'seg-ev', label: 'EVs & automotive', tv: 2,
    terms: ['electric vehicle', 'electric vehicles', 'electric car', 'electric cars',
      'automaker', 'carmaker', 'car maker', 'ev maker', 'vehicle recall', 'recall campaign',
      'vehicles recalled', 'million vehicles', 'nhtsa', 'car sales', 'autonomous driving',
      'self-driving', 'full self-driving', 'full self driving', 'driver assistance', 'fsd',
      'robotaxi', 'ev sales', 'ev market', 'sedan', 'suv', 'pickup truck', 'cybertruck',
      'model y', 'model 3', 'plug-in hybrid', 'dealership', 'test drive'] },
  { key: 'seg-ev-charging', label: 'EV charging', tv: 2,
    terms: ['charger', 'chargers', 'charging station', 'charging network', 'supercharger',
      'fast charging', 'ev charging', 'charging infrastructure', 'charge point',
      'chargepoint', 'wallbox', 'megawatt charging', 'nacs'] },
  { key: 'seg-semiconductors', label: 'Semiconductors & AI hardware',
    terms: ['semiconductor', 'chip', 'chips', 'foundry', 'wafer', 'accelerator'] },
  // Multi-word phrases only. A bare 'deal', 'discount' or 'power station' would
  // fire on genuine trade coverage — utilities discount bills and power
  // stations are power plants — so every retail marker here has to be one a
  // trade story would not write.
  { key: 'seg-consumer', label: 'Consumer electronics & appliances', tv: 2,
    terms: ['smartphone', 'consumer electronics', 'appliance', 'laptop', 'tablet', 'wearable',
            'e-bike', 'ebike', 'electric scooter', 'power bank', 'portable charger',
            'consumer-grade', 'consumer grade',
            'labor day sale', 'prime day', 'black friday', 'cyber monday',
            'early-bird pricing', 'promotional pricing', 'coupon code', 'deal of the day'] },
  { key: 'seg-industrial', label: 'Industrial automation & robotics',
    terms: ['robotics', 'robot', 'factory automation', 'industrial automation', 'humanoid'] }
];

// Four-signal scoring rubric (decision D3, 2026-08-27) — replaces 👍/👎
// feedback as the relevance model. Signals sum to a 0-100 score aligned
// with SCRAPER_RELEVANT_THRESHOLD. Phase 1 ships the deterministic
// scaffolding; Phase 3 wires it into the digest engine's scoring path
// (the legacy feedback-exemplar path stays in code per D3 — feedback is
// off and hidden, historical votes preserved).
var SCRAPER_RUBRIC_WEIGHTS = { company: 40, topic: 25, emphasis: 15, substance: 20 };
var SCRAPER_RUBRIC_RECENT_DAYS = 45;  // Profiler lastUpdated within this window earns the full emphasis recency

// ── Geographic priority (developer 2026-08-28) ───────────────────────────
// "I am specifically focused on the US BESS/AIDC market… the US market is a
// clear priority 1, greatly outpacing priority 2 countries closely related to
// this industry (China, Mexico, Chile, Canada). [Priority 2] should generally
// only be scored highly if whatever happened there directly affects the US
// market." The example given: the lead should never be an Australian
// transmission story.
//
// Applied as a MULTIPLIER on the finished rubric score rather than as another
// additive band. The requirement is proportional — an additive penalty leaves a
// strong company match on a foreign story still clearing the bar, whereas a
// multiplier scales the whole judgement down the way the developer described.
//
// THE LOAD-BEARING RULE IS THE DEFAULT: an article with no geographic marker at
// all scores 1.0, untouched. Most US trade coverage never says "United States"
// — it says ERCOT, or a county in Texas, or nothing. Penalising unmarked
// articles would empty the digest, so a penalty needs positive evidence of a
// foreign subject, never merely the absence of evidence of a US one.
var SCRAPER_GEO_FACTORS = {
  // Foreign subject, no US connection named anywhere in the article.
  tier2: 0.55,
  other: 0.25,
  // Foreign subject, but the article also names something US-market. This is
  // the "directly affects the US market" case — a tariff, an export, a US buyer.
  tier2Linked: 0.85,
  otherLinked: 0.60
};

// US-market markers. Deliberately excludes the bare token "us" (the text is
// lowercased before matching, so it would hit the pronoun in every other
// sentence) and other short ambiguous ones like "ira" and "doe".
var SCRAPER_GEO_US_TERMS = [
  'united states', 'u.s.', 'u.s.a.', 'usa', 'north america', 'north american',
  'washington d.c.', 'federal government',
  // Grid operators and markets — the strongest US signal in this trade press.
  'ercot', 'caiso', 'pjm', 'miso', 'nyiso', 'iso-ne', 'isone', 'spp',
  'wecc', 'serc', 'ferc', 'nerc', 'eia', 'epa', 'nrel', 'department of energy',
  'inflation reduction act', 'investment tax credit', 'production tax credit',
  'section 45x', 'section 48e', 'section 301', 'buy american', 'domestic content',
  // States and DC.
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois',
  'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
  'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana',
  'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york',
  'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
  'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah',
  'vermont', 'virginia', 'washington state', 'west virginia', 'wisconsin', 'wyoming'
];

// Priority 2 — closely related to this industry, devalued but not buried.
var SCRAPER_GEO_TIER2 = {
  china:  ['china', 'chinese', 'beijing', 'shanghai', 'shenzhen', 'prc'],
  mexico: ['mexico', 'mexican', 'cfe', 'sener'],
  chile:  ['chile', 'chilean', 'santiago', 'coordinador electrico'],
  canada: ['canada', 'canadian', 'ontario', 'alberta', 'quebec', 'british columbia',
           'ieso', 'aeso', 'hydro-quebec']
};

// Everything else. Not exhaustive by design — a country absent from this list
// simply scores as unmarked, which is the safe default. Add to it rather than
// widening the penalty when a region turns out to need devaluing.
var SCRAPER_GEO_OTHER = {
  // 'nem' is deliberately absent: in US solar coverage it means net energy
  // metering, so it would have mislabelled US stories as Australian. 'victoria'
  // likewise — too common a bare word to spend a 0.25 penalty on.
  australia:   ['australia', 'australian', 'aussie', 'aemo', 'new south wales',
                'queensland', 'south australia', 'snowy hydro', 'snowy 2.0'],
  // 'uk' is how a headline writes it nine times in ten. Its absence is why
  // "Green Party wants to slam the brakes on UK datacenter construction"
  // classified as unmarked and kept the full x1.00 factor. Two letters is safe
  // here because scTermsHit_ matches on word boundaries — it cannot fire
  // inside another word.
  uk:          ['uk', 'u.k.', 'united kingdom', 'britain', 'british', 'england',
                'scotland', 'wales', 'ofgem', 'national grid eso'],
  germany:     ['germany', 'german', 'berlin', 'bundesnetzagentur'],
  eu:          ['european union', 'e.u.', 'brussels', 'european commission'],
  france:      ['france', 'french', 'edf'],
  spain:       ['spain', 'spanish', 'iberdrola'],
  italy:       ['italy', 'italian', 'terna'],
  netherlands: ['netherlands', 'dutch'],
  nordics:     ['sweden', 'swedish', 'norway', 'norwegian', 'finland', 'finnish', 'denmark', 'danish'],
  poland:      ['poland', 'polish'],
  india:       ['india', 'indian', 'seci'],
  japan:       ['japan', 'japanese', 'tokyo'],
  korea:       ['south korea', 'korean', 'seoul'],
  taiwan:      ['taiwan', 'taiwanese'],
  brazil:      ['brazil', 'brazilian', 'aneel'],
  argentina:   ['argentina', 'argentine', 'argentinian'],
  latam:       ['latin america', 'latam', 'dominican republic', 'colombia', 'peru'],
  gulf:        ['saudi arabia', 'saudi', 'united arab emirates', 'uae', 'abu dhabi', 'dubai', 'qatar'],
  africa:      ['south africa', 'eskom', 'nigeria', 'egypt', 'morocco'],
  seasia:      ['vietnam', 'indonesia', 'philippines', 'thailand', 'malaysia', 'singapore'],
  other:       ['new zealand', 'israel', 'turkey', 'ukraine', 'russia', 'switzerland',
                'austria', 'belgium', 'portugal', 'greece', 'ireland', 'czech', 'romania']
};

// ── Rebuild Phase 3: weekday digest engine ──
// One interest-driven morning digest (Mon–Fri 7:00 AM ET; the Monday edition
// covers 72h) built from the D1 source roster + the D2 Google News
// company-name backstop, scored by the D3 rubric, AI-summarized, rendered as
// the approved "Night Ink" edition, and stored in the Digests tab. The
// scheduled path is gated by SCRAPER_SCHED_RUNS_ENABLED (still false — no
// unattended AI spend) and the email site by SCRAPER_SCHED_EMAIL_ENABLED;
// the manual runDigestNow route works while paused.
var SCRAPER_DIGEST_RUN_DAYS = [1, 2, 3, 4, 5];   // ISO day-of-week (Mon–Fri)

var SCRAPER_DIGEST_RUN_HOUR = 7;                 // hourly catch-up tick: no build before 7:00 ET
// Build early, send at 7:00. One Apps Script execution is capped at 6 minutes
// on a consumer account, and three editions need far longer than that — 30
// feeds at 6 per step, plus backstop, summarize and render. Building at 7:00
// therefore cannot deliver at 7:00. The build starts an hour earlier, works in
// budgeted invocations that chain one-off continuations, and the finished
// editions wait in the Digests tab until the 7:00 delivery pass.
// THE one timezone every schedule decision is made in. The build hour, the send
// hour and SCRAPER_DIGEST_RUN_DAYS are all read against it, as is every date key
// written to the sheet, and the triggers have to be created in the same zone or
// a 6:00 build would fire at 6:00 in whatever zone the script project happens to
// be set to.
//
// scDigestClock_ now formats against this rather than a hardcoded literal, so
// moving the desk to another zone is this line plus the label — not a
// search-and-replace across two dozen occurrences with as many chances to miss
// one. SCRAPER_DIGEST_TZ_LABEL is what the app shows the reader; keep it
// truthful to the zone above.
var SCRAPER_DIGEST_TZ = 'America/New_York';
var SCRAPER_DIGEST_TZ_LABEL = 'ET';
var SCRAPER_DIGEST_BUILD_HOUR = 6;               // daily build trigger, desk time
var SCRAPER_DIGEST_SEND_HOUR = 7;                // nothing is emailed before this hour, desk time
// Comfortably inside the 6-minute execution cap, leaving room for the step in
// flight to finish and for the continuation trigger to be created.
var SCRAPER_DIGEST_RUN_BUDGET_MS = 240000;
var SCRAPER_DIGEST_WINDOW_H = 24;                // Monday edition uses 72 (the weekend)
var SCRAPER_DIGEST_FETCHES_PER_STEP = 6;         // feed fetches per chunked step
var SCRAPER_DIGEST_TIME_BUDGET_MS = 40000;       // wall-clock budget per step
var SCRAPER_DIGEST_STATE_KEY = 'scDigestRun';    // Script Property: current run state
var SCRAPER_DIGEST_ITEMS_PER_SOURCE = 15;        // intake cap per source per run
var SCRAPER_DIGEST_MIN_INTAKE_SCORE = 25;        // rubric floor to enter the intake tab
var SCRAPER_DIGEST_BACKSTOP_PER_RUN = 12;        // D2: company-name queries per run (round-robin)
// Round-robin cursor for the backstop company queries. Per EDITION, and the
// day's pick is memoised per (edition, date) — see scDigestBackstopPick_ for
// why both matter. The bare key is the pre-v01.78g global one, kept only so
// scDigestBackstopCursorKey_ can migrate a fleet that still has it set.
var SCRAPER_DIGEST_BACKSTOP_CURSOR_KEY = 'scDigestBackstopCursor';
// D2: backstop items are down-weighted. 0.85 -> 0.70 (developer directive
// 2026-08-29): none of the Google News items seen so far had earned their
// place beside a roster source. Note what this does NOT do — a covered
// company match is worth 40 evidence on its own, so a story genuinely about
// one of their companies still clears the bar after the penalty. That is the
// backstop working as intended; the weight only decides how much else it takes.
var SCRAPER_DIGEST_BACKSTOP_PENALTY = 0.70;
var SCRAPER_DIGEST_SUMMARIZE_MAX = 70;           // ceiling on AI-summarized items per edition
// Caps raised 6/6/4 -> 12/10/8 (developer directive 2026-08-27): a daily
// digest of skimmable summaries should err toward completeness, since a
// missed story costs more than a longer scroll. Section caps sum to 30, and
// the summarize set now covers every relevant item rather
// than falling through to a raw feed snippet.
var SCRAPER_DIGEST_ITEMS_PER_AI_CALL = 5;        // items per summarize request (smaller batches → room for longer summaries)
// Free-tier pacing. At ~30 summarized items an edition fires ~7 AI calls back
// to back (6 summarize batches + 1 lead), and more on a heavy news day. Gemini's free tier enforces per-minute AND
// per-day request caps that are model-specific and have tightened over time,
// so an unpaced burst can trip a 429 — and before this, a single 429 aborted
// summarization for the WHOLE edition (no retry, no resume, no AI lead).
var SCRAPER_DIGEST_AI_PAUSE_MS = 1200;           // gap between consecutive AI calls
// Waits before each retry. Extended past two attempts because a provider
// OVERLOAD (HTTP 503) can persist for tens of seconds — a 2s+6s ladder gave up
// long before it cleared and dropped the whole edition to fallback summaries.
var SCRAPER_AI_RETRY_BACKOFF_MS = [2000, 6000, 15000, 30000];
// ── Per-edition summary lens (developer 2026-08-28) ─────────────────────
// Every summary used to close from one fixed viewpoint, because the prompt
// hardcoded "a US grid-scale battery (BESS) seller". That is right for the
// BESS edition and wrong for the others: the developer asked that an AIDC
// edition instead "highlight whichever part of the AIDC power infrastructure
// is within the scope of this article and why it matters to players in that
// scope", and explicitly asked NOT to be given rigid rules, "because I don't
// want every article summary to end in the same way".
//
// So each edition carries an AUDIENCE and a CLOSING INTENT rather than a
// sentence pattern. The intent says what the last line has to accomplish; the
// wording is left to the model, and the prompt asks outright for variety.
var SCRAPER_EDITION_LENS = {
  morning: {
    audience: 'a US grid-scale battery (BESS) seller who also tracks the AI '
      + 'data-center buildout, because that buildout is what drives their demand',
    closing: 'close by making clear why this particular story matters to that '
      + 'reader — the demand it signals, the competitor it exposes, the cost or '
      + 'schedule it moves, the precedent it sets. Draw the line to THIS story, '
      + 'not to the category it belongs to'
  },
  bess: {
    audience: 'a US grid-scale battery storage (BESS) seller — utility-scale '
      + 'projects, interconnection queues, offtake and procurement',
    closing: 'close on what it changes for someone selling grid-scale storage '
      + 'in the US: the demand, the competition, the pricing, the permitting or '
      + 'interconnection reality, the supply chain. Name the specific mechanism, '
      + 'not a general observation'
  },
  aidc: {
    audience: 'someone working in the US AI data-center power chain — '
      + 'generation, transmission and interconnection, substations and '
      + 'transformers, on-site generation, cooling and water, siting and '
      + 'permitting, utility tariffs and large-load agreements',
    closing: 'identify WHICH part of that power chain this story actually '
      + 'touches, and close on what it means for the people working in that '
      + 'part. A transformer lead-time story matters to different people than a '
      + 'water-permitting fight or a large-load tariff ruling — say which, and '
      + 'why it lands'
  }
};

/** The lens for one edition, falling back to its parent, then to the default.
    Kept out of the Editions sheet on purpose: this is editorial voice, not a
    per-edition setting the developer tunes from the UI. */
function scEditionLens_(editionId) {
  var id = String(editionId || SCRAPER_EDITION_DEFAULT.id);
  if (SCRAPER_EDITION_LENS[id]) return SCRAPER_EDITION_LENS[id];
  for (var i = 0; i < SCRAPER_EDITION_SEEDS.length; i++) {
    if (SCRAPER_EDITION_SEEDS[i].id === id && SCRAPER_EDITION_LENS[SCRAPER_EDITION_SEEDS[i].parent]) {
      return SCRAPER_EDITION_LENS[SCRAPER_EDITION_SEEDS[i].parent];
    }
  }
  return SCRAPER_EDITION_LENS[SCRAPER_EDITION_DEFAULT.id];
}

var SCRAPER_DIGEST_SUMMARY_MAX = 900;
var SCRAPER_DIGEST_ANALYSIS_MAX = 500;   // the desk's read, kept shorter than the reporting            // stored summary cap (chars) — generous; quality set by the prompt, not a hard length limit
// Output ceiling for one summarize call. Five items at 60-120 words is roughly
// 900 tokens of prose before JSON overhead, so 3000 looked like ample headroom
// — but thinking tokens count against this same budget on the current models,
// and a long reasoning pass can consume it before any text is emitted, which
// returns finishReason MAX_TOKENS with the JSON cut off or missing entirely.
// (ai.google.dev/gemini-api/docs/tokens.) Raised so reasoning and output are
// not competing for the same 3000.
var SCRAPER_DIGEST_SUMMARY_TOKENS = 8000;
var SCRAPER_DIGEST_MAX_SOFT_AI_FAILS = 3;        // batches that may fail to parse before the edition gives up on AI
var SCRAPER_DIGEST_CELL_MAX = 45000;             // Sheets cell safety cap (limit is 50k chars)
// Digests tab retention (rows). Was 60 — roughly four working days once three
// editions build daily — because every read of this tab pulled the Sections and
// HTML columns for every row, so the cap was really a cap on how much text each
// page load moved. Now that listDigests, getDigest, deleteDigest and
// emailLatestDigest all read narrow ranges, the row count no longer drives that
// cost and the archive can be deep enough to be worth browsing: 400 rows is
// about six months of three weekday editions. Beyond that the right answer is
// cold storage (move the HTML of old issues to Drive, keep the metadata row)
// rather than a bigger number here — a Sheets cell still caps at 50k characters.
var SCRAPER_DIGEST_KEEP = 400;

// How many editions keep their DigestIntake rows. Intake is what resolves an
// article link to its real destination, so this is really "how far back do
// links keep working" — and it has to be bounded, because several code paths
// scan the tab and ~150 intake rows per edition adds up fast. Beyond this
// window an edition stays readable but its links fall back to opening the app,
// which is the behaviour every edition had before this was fixed. 240 is about
// sixteen weeks at three editions a day (~36k rows). The permanent answer is a
// (digest id, item key) → URL index rather than a scan; until that exists,
// raising this trades link lifetime against the cost of every scan.
var SCRAPER_INTAKE_KEEP_EDITIONS = 240;
var SCRAPER_DIGEST_SECTION_CAPS = { companies: 12, market: 10, incidents: 8 };
// Editions (Phase 5): named digest products with their own cadence and
// subscriber lists. 'morning' is the built-in default (the weekday Morning
// Edition); more are added from the app. Cadences: daily (weekdays, 24h
// window / 72h Mondays), weekly (anchor ISO day, 168h), monthly (anchor
// day-of-month, 720h).
var SCRAPER_EDITION_DEFAULT = { id: 'morning', name: 'Your Morning Digest',
  cadence: 'daily', anchor: 0, windowH: 0 };  // windowH 0 = cadence default

// Editions seeded once (marker below), never re-seeded — deleting one has to
// stick. `tuning` is a SPARSE override map of interest key -> boolean applied
// on top of the global Tune. An edition that stores nothing behaves exactly
// like the global model, which is why 'morning' carries no overrides at all
// and its digests are byte-identical to before per-edition tuning existed.
var SCRAPER_EDITION_SEEDS_KEY = 'EDITION_SEEDS_V2';

// A preset is a RECOMMENDATION, expanded at edition-creation time into a FULL
// explicit map over every segment and topic. Materialising matters: with a
// sparse map an edition silently tracked whatever the global baseline did, so
// a new edition was really just "Your Morning Digest until told otherwise" —
// which is exactly what the developer did not want. A materialised edition is
// independent from birth, and `presetOff` is kept so the UI can show which
// switches the developer has since changed FROM the recommendation.
//
// 'global' is the one non-materialising preset: it means "inherit", and it is
// what 'morning' uses, which is why Your Morning Digest is unchanged.
var SCRAPER_TUNING_PRESETS = {
  global: { label: 'Follow the global baseline', off: null },
  all:    { label: 'Everything on', off: [] },
  bess:   { label: 'Utility-scale storage (BESS)', off: [
    'seg-bess-residential', 'seg-bess-ci',
    'seg-solar', 'seg-wind', 'seg-nuclear', 'seg-fuel-cells',
    'seg-ev', 'seg-ev-charging', 'seg-consumer', 'seg-industrial',
    'seg-semiconductors', 'seg-gpu-silicon', 'seg-cooling', 'seg-psu', 'seg-rack-power',
    'topic-aidc-buildout', 'topic-community-opposition', 'topic-dc-cooling'
  ] },
  aidc:   { label: 'Data-center power chain (AIDC)', off: [
    // Storage as a beat in its own right is out; storage SITED at a data
    // center stays in, because it is part of this power chain.
    'seg-bess', 'seg-bess-utility', 'seg-bess-residential', 'seg-bess-ci',
    'seg-bess-longduration',
    'seg-solar', 'seg-wind', 'seg-ev', 'seg-ev-charging', 'seg-consumer',
    'topic-bess-technology', 'topic-bess-bankability', 'topic-battery-incidents',
    'topic-china-policy', 'topic-storage-offtake', 'topic-storage-degradation'
  ] }
};

var SCRAPER_EDITION_SEEDS = [
  { id: 'bess', name: 'Your Morning Digest (BESS)', cadence: 'daily', anchor: 0, windowH: 0,
    notes: 'Utility-scale storage focus', preset: 'bess', parent: 'morning' },
  { id: 'aidc', name: 'Your Morning Digest (AIDC)', cadence: 'daily', anchor: 0, windowH: 0,
    notes: 'Data-center power chain focus', preset: 'aidc', parent: 'morning' }
];

// Masthead renames applied to already-created Editions rows and to archived
// editions on read. `from` is matched exactly, so an edition the developer
// renamed themselves is left alone, and a row already carrying the new name
// stops matching — which is what makes both back-fills idempotent. The parent
// name is a prefix of both variants, so the variants are listed first and the
// row rule is keyed to the id as well: an id can only ever take its own rule.
var SCRAPER_EDITION_RENAMES = [
  { id: 'bess', from: 'The Morning Edition (BESS)', to: 'Your Morning Digest (BESS)' },
  { id: 'aidc', from: 'The Morning Edition (AIDC)', to: 'Your Morning Digest (AIDC)' },
  { id: 'morning', from: 'The Morning Edition', to: 'Your Morning Digest' }
];

/** Rewrite retired mastheads in stored edition HTML on read, so the whole
    archive shows the current name rather than only editions built from here
    on. A blanket string swap, the same shape as scRewriteLegacyClickUrls_: an
    article headline that literally contained a retired edition name would be
    rewritten too, which is an acceptable trade for not parsing the stored
    HTML on every read. */
function scRewriteLegacyNames_(text) {
  if (!text) return text;
  var out = String(text);
  SCRAPER_EDITION_RENAMES.forEach(function(rn) {
    while (out.indexOf(rn.from) !== -1) { out = out.replace(rn.from, rn.to); }
  });
  return out;
}

/** Expand a preset into a full explicit map over every seeded segment + topic.
    Returns null for 'global' — the caller stores {} and the edition inherits. */
function scPresetMap_(preset) {
  var def = SCRAPER_TUNING_PRESETS[String(preset || 'all')];
  if (!def) def = SCRAPER_TUNING_PRESETS.all;
  if (!def.off) return null;
  var off = {};
  def.off.forEach(function(k) { off[k] = true; });
  var map = {};
  SCRAPER_SEGMENT_SEEDS.forEach(function(x) { map[x.key] = !off[x.key]; });
  SCRAPER_INTEREST_TOPIC_SEEDS.forEach(function(x) { map[x.key] = !off[x.key]; });
  return map;
}
var SCRAPER_CLICK_BOOST_CAP = 5;       // max rubric points from engagement (clicks)
var SCRAPER_CLICK_WINDOW_DAYS = 30;    // clicks older than this stop influencing scores
var SCRAPER_CORROB_CAP = 6;            // max score boost from multi-source corroboration
// How much the supporting signals (emphasis + substance + engagement +
// corroboration) may add, as a fraction of the evidence signals (company +
// topic) already earned. 0.5 keeps a strong match's full supporting score
// while denying an article with no covered match a route over the bar on
// writing quality alone. See the evidence gate in scRubricScore_.
var SCRAPER_SUPPORT_RATIO = 0.6;
// What an article earns for matching enabled segments, as evidence rather than
// as a gate. Sized so that a segment match plus a topic match clears the bar
// on its own (a policy or market story naming no covered company), while a
// topic match alone still cannot.
var SCRAPER_RUBRIC_SEGMENT_EVIDENCE = 12;
var SCRAPER_DOSSIER_MINE_PRIORITY_MAX = 30;  // dossiers per sync while new/changed ones are queued
var SCRAPER_DOSSIER_MINE_IDLE = 5;           // slow refresh trickle once the fleet is current
var SCRAPER_DOSSIER_MINE_BUDGET_MS = 60000;  // wall-clock guard for the SCHEDULED tick
// A user-triggered sync is a foreground request behind a 90s client abort.
// A 60s mining pass pushed the round trip to ~60-75s, so the button felt
// dead, a Refresh pressed meanwhile read the sheet before mining committed
// (showing the old count), and the results appeared minutes later 'on their
// own'. Interactive syncs get a shorter budget and report what they did.
var SCRAPER_DOSSIER_MINE_BUDGET_INTERACTIVE_MS = 25000;
// Forced full-drain budget ("Read all dossiers"). GAS kills an execution at
// 6 minutes, so this stops well short and reports what is left — the client
// simply calls again. Unlike the paced passes above this ignores the
// per-pass company cap entirely: the point is to finish, not to trickle.
var SCRAPER_DOSSIER_DRAIN_BUDGET_MS = 240000;

// Segment hygiene. `targetSegments` is schema-legal as BOTH a string[] and a
// comma-joined string (see PROFILER-SCHEMA.md), and the string form is often
// a full sentence rather than a list of segments. A sentence is useless as a
// segment key — the gate matches short vocabulary — so anything sentence-
// shaped is dropped rather than poisoning the per-company vocabulary.
var SCRAPER_SEGMENT_MAX_CHARS = 60;
var SCRAPER_SEGMENT_MAX_WORDS = 6;
var SCRAPER_SEGMENT_MAX_PER_COMPANY = 24;
var SCRAPER_HELD_BACK_MAX = 25;        // held-back items stored per edition (rollup feed)
var SCRAPER_HELD_BACK_SHOW = 60;       // held-back items embedded in an edition (View More)

// D1 (2026-08-27): 30-source free trade-press roster — 3rd-party outlets only
// (no paywalls, no company-owned newsrooms; RTO Insider et al. excluded as
// paywalled, leaving a known partial gap on ERCOT/PJM market-rule minutiae).
// The approved in-chat list was not persisted, so this roster reconstructs it
// to those recorded constraints. Each source seeds an Interests row
// ('src-<key>', default ON) via the daily sync — the sheet/panel toggle is the
// on/off switch; this constant remains the source of truth for name + feed.
// tier 1 = core AIDC/BESS/grid trade press · tier 2 = adjacent coverage.
var SCRAPER_SOURCE_ROSTER = [
  { key: 'utility-dive', name: 'Utility Dive', tier: 1, rss: 'https://www.utilitydive.com/feeds/news/' },
  { key: 'dcd', name: 'Data Center Dynamics', tier: 1, rss: 'https://www.datacenterdynamics.com/rss/' },
  { key: 'energy-storage-news', name: 'Energy-Storage.news', tier: 1, rss: 'https://www.energy-storage.news/feed/' },
  { key: 'ess-news', name: 'ESS News', tier: 1, rss: 'https://www.ess-news.com/feed/' },
  { key: 'canary-media', name: 'Canary Media', tier: 1, rss: 'https://www.canarymedia.com/rss.xml' },
  { key: 'power-magazine', name: 'POWER Magazine', tier: 1, rss: 'https://www.powermag.com/feed/' },
  { key: 'dc-knowledge', name: 'Data Center Knowledge', tier: 1, rss: 'https://www.datacenterknowledge.com/rss.xml' },
  // Feed path verified live 2026-08-27 (site moved to a Nuxt platform; old /rss.xml is 404)
  { key: 'dc-frontier', name: 'Data Center Frontier', tier: 1, rss: 'https://www.datacenterfrontier.com/__rss/website-scheduled-content.xml?input=%7B%22sectionAlias%22%3A%22home%22%7D' },
  { key: 'pv-magazine-usa', name: 'pv magazine USA', tier: 1, rss: 'https://pv-magazine-usa.com/feed/' },
  // Same platform move as Data Center Frontier — path verified live 2026-08-27
  { key: 'microgrid-knowledge', name: 'Microgrid Knowledge', tier: 1, rss: 'https://www.microgridknowledge.com/__rss/website-scheduled-content.xml?input=%7B%22sectionAlias%22%3A%22home%22%7D' },
  { key: 'td-world', name: 'T&D World', tier: 1, rss: 'https://www.tdworld.com/rss.xml' },
  // Replaced Battery Technology (Informa bot-wall 403s even browser UAs; battery
  // coverage continues via Energy-Storage.news + ESS News) — go-live shakeout 2026-08-27
  { key: 'next-platform', name: 'The Next Platform', tier: 1, rss: 'https://www.nextplatform.com/feed/' },
  { key: 'cleantechnica', name: 'CleanTechnica', tier: 2, rss: 'https://cleantechnica.com/feed/' },
  { key: 'renewable-energy-world', name: 'Renewable Energy World', tier: 2, rss: 'https://www.renewableenergyworld.com/feed/' },
  { key: 'power-engineering', name: 'Power Engineering', tier: 2, rss: 'https://www.power-eng.com/feed/' },
  { key: 'electrek', name: 'Electrek', tier: 2, rss: 'https://electrek.co/feed/' },
  // Section slug corrected (data_centre → on_prem, their datacenter desk) — verified live 2026-08-27
  { key: 'register-dc', name: 'The Register — Datacenters', tier: 2, rss: 'https://www.theregister.com/on_prem/headlines.atom' },
  { key: 'trellis', name: 'Trellis (ex-GreenBiz)', tier: 2, rss: 'https://trellis.net/feed/' },
  { key: 'latitude-media', name: 'Latitude Media', tier: 2, rss: 'https://www.latitudemedia.com/feed' },
  { key: 'facilities-dive', name: 'Facilities Dive', tier: 2, rss: 'https://www.facilitiesdive.com/feeds/news/' },
  { key: 'construction-dive', name: 'Construction Dive', tier: 2, rss: 'https://www.constructiondive.com/feeds/news/' },
  { key: 'solar-power-world', name: 'Solar Power World', tier: 2, rss: 'https://www.solarpowerworldonline.com/feed/' },
  { key: 'toms-hardware', name: "Tom's Hardware", tier: 2, rss: 'https://www.tomshardware.com/feeds/all' },
  { key: 'power-grid-intl', name: 'Power Grid International', tier: 2, rss: 'https://www.power-grid.com/feed/' },
  { key: 'electrive', name: 'Electrive', tier: 2, rss: 'https://www.electrive.com/feed/' },
  // Replaced Solar Industry (domain now parked/dead; solar coverage continues via
  // pv magazine USA + Solar Power World). RenewEconomy adds strong global BESS market
  // coverage — go-live shakeout 2026-08-27
  { key: 'reneweconomy', name: 'RenewEconomy', tier: 2, rss: 'https://reneweconomy.com.au/feed/' },
  { key: 'inside-climate-news', name: 'Inside Climate News', tier: 2, rss: 'https://insideclimatenews.org/feed/' },
  { key: 'ieee-spectrum', name: 'IEEE Spectrum', tier: 2, rss: 'https://spectrum.ieee.org/feeds/feed.rss' },
  { key: 'smart-energy-intl', name: 'Smart Energy International', tier: 2, rss: 'https://www.smart-energy.com/feed/' },
  // Replaced Data Centre Magazine (BizClik bot-wall 403s even browser UAs).
  // HPCwire covers the AI/HPC data-center hardware beat — go-live shakeout 2026-08-27
  { key: 'hpcwire', name: 'HPCwire', tier: 2, rss: 'https://www.hpcwire.com/feed/' }
];

function scraperSs_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID') {
    throw new Error('spreadsheet_not_configured');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** Create any missing Scraper tabs with their header rows (idempotent).
    Guarded by an execution-global + a 6h script-cache flag so the ~10
    getSheetByName probes run at most once per cache window instead of on
    every button press. The cache key embeds the tab count, so adding a new
    tab to SCRAPER_TAB_HEADERS auto-invalidates the flag and the new tab is
    created on the next call. */
var _scTabsChecked = false;
function ensureScraperTabs_(ss) {
  if (_scTabsChecked) return;
  // Keyed on the column count as well as the tab count. Keyed on tabs alone,
  // adding a column to an existing tab (Digests gaining 'No') left the key
  // unchanged, so a warm cache skipped the widening for up to six hours after
  // deploy and the new column silently did not exist.
  var tabsCols = 0;
  Object.keys(SCRAPER_TAB_HEADERS).forEach(function(t) {
    tabsCols += SCRAPER_TAB_HEADERS[t].length;
  });
  var tabsKey = 'scTabsReady_' + Object.keys(SCRAPER_TAB_HEADERS).length + '_' + tabsCols;
  var tabsCache = null;
  try {
    tabsCache = CacheService.getScriptCache();
    if (tabsCache.get(tabsKey)) { _scTabsChecked = true; return; }
  } catch (cacheErr) { tabsCache = null; }
  Object.keys(SCRAPER_TAB_HEADERS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(SCRAPER_TAB_HEADERS[name]);
      sheet.setFrozenRows(1);
    } else if (sheet.getLastColumn() < SCRAPER_TAB_HEADERS[name].length) {
      // Schema grew (e.g. Digests gained an Edition column) — rewrite the
      // header row so existing tabs pick up the new columns; data rows are
      // ragged-safe (getValues pads short rows with '').
      sheet.getRange(1, 1, 1, SCRAPER_TAB_HEADERS[name].length)
           .setValues([SCRAPER_TAB_HEADERS[name]]);
    }
  });
  _scTabsChecked = true;
  try { if (tabsCache) tabsCache.put(tabsKey, '1', 21600); } catch (putErr) {}
}

/** Trim a value to a bounded plain string. */
function scStr_(v, max) {
  var s = String(v == null ? '' : v).trim();
  return s.length > max ? s.substring(0, max) : s;
}

/** Normalize a list input (array, or comma/newline-separated string). */
function scList_(v, maxItems, maxLen) {
  var arr = Array.isArray(v) ? v : String(v || '').split(/[\n,]/);
  var out = [];
  for (var i = 0; i < arr.length && out.length < maxItems; i++) {
    var item = scStr_(arr[i], maxLen);
    if (item && out.indexOf(item) === -1) out.push(item);
  }
  return out;
}

/** Validate + normalize a createProject/updateProject payload (JSON string). */
function scNormalizeProjectPayload_(raw) {
  var p;
  try { p = JSON.parse(String(raw || '{}')); } catch (parseErr) { throw new Error('bad_payload'); }
  var name = scStr_(p.name, 120);
  var topic = scStr_(p.topic, 2000);
  if (!name) throw new Error('name_required');
  if (!topic) throw new Error('topic_required');
  var frequencies = scList_(p.frequencies, 7, 20).filter(function(f) {
    return SCRAPER_FREQUENCIES.indexOf(f) !== -1;
  });
  if (!frequencies.length) throw new Error('frequency_required');
  var sources = scList_(p.sources, 20, 300).filter(function(u) {
    return /^https?:\/\//i.test(u);
  });
  return {
    name: name,
    topic: topic,
    industries: scList_(p.industries, 15, 80),
    keywords: scList_(p.keywords, 30, 80),
    exclusions: scList_(p.exclusions, 30, 80),
    sources: sources,
    regions: scList_(p.regions, 10, 60),
    frequencies: frequencies,
    customConfig: scStr_(p.customConfig, 500),
    delivery: SCRAPER_DELIVERIES.indexOf(p.delivery) !== -1 ? p.delivery : 'inapp'
  };
}

/** Convert a Projects sheet row to the client-facing object. */
function scProjectFromRow_(row) {
  function parseList(cell) { try { return JSON.parse(cell || '[]'); } catch (e2) { return []; } }
  return {
    id: row[0],
    name: row[2],
    topic: row[3],
    industries: parseList(row[4]),
    keywords: parseList(row[5]),
    exclusions: parseList(row[6]),
    sources: parseList(row[7]),
    regions: parseList(row[8]),
    status: row[9],
    createdAt: row[10] ? new Date(row[10]).toISOString() : '',
    updatedAt: row[11] ? new Date(row[11]).toISOString() : ''
  };
}

/** Find the 1-based sheet row of a project owned by ownerEmail (0 = not found). */
function scFindProjectRow_(sheet, projectId, ownerEmail) {
  if (!projectId) return 0;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === projectId &&
        String(data[i][1]).toLowerCase() === String(ownerEmail).toLowerCase()) {
      return i + 1;
    }
  }
  return 0;
}

/** Replace the schedule rows for a project (delete existing, append fresh).
    Skips the rewrite when frequencies, delivery, and custom config are all
    unchanged — schedule rows carry live scheduler state (Next Run / Last Run)
    that a needless rewrite would wipe, and per-row deletes are the slowest
    part of updateProject (they made scope-only edits like suggestion-adds
    feel sluggish). */
function scWriteSchedules_(ss, projectId, ownerEmail, norm) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.SCHEDULES);
  var data = sheet.getDataRange().getValues();
  var existing = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === projectId) existing.push(data[i]);
  }
  var unchanged = existing.length === norm.frequencies.length &&
    existing.every(function(r) {
      return norm.frequencies.indexOf(String(r[3])) !== -1 &&
        String(r[5]) === norm.delivery &&
        (String(r[3]) !== 'custom' || String(r[4]) === norm.customConfig);
    });
  if (unchanged) return;
  for (var j = data.length - 1; j >= 1; j--) {
    if (data[j][1] === projectId) sheet.deleteRow(j + 1);
  }
  norm.frequencies.forEach(function(freq) {
    sheet.appendRow([Utilities.getUuid(), projectId, ownerEmail, freq,
      freq === 'custom' ? norm.customConfig : '', norm.delivery, true, '', '']);
  });
}

/** Map projectId → {frequencies, customConfig, delivery, nextRun, lastRun}
    for a set of projects. nextRun is the earliest upcoming run across the
    project's schedules; lastRun the most recent completed one. */
function scSchedulesFor_(ss, projectIds) {
  var map = {};
  var data = ss.getSheetByName(SCRAPER_TABS.SCHEDULES).getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var pid = data[i][1];
    if (projectIds.indexOf(pid) === -1) continue;
    if (!map[pid]) map[pid] = { frequencies: [], customConfig: '', delivery: data[i][5] || 'inapp',
                                nextRun: '', lastRun: '' };
    map[pid].frequencies.push(data[i][3]);
    if (data[i][3] === 'custom') map[pid].customConfig = data[i][4] || '';
    if (data[i][7]) {
      var nr = new Date(data[i][7]).toISOString();
      if (!map[pid].nextRun || nr < map[pid].nextRun) map[pid].nextRun = nr;
    }
    if (data[i][8]) {
      var lr = new Date(data[i][8]).toISOString();
      if (!map[pid].lastRun || lr > map[pid].lastRun) map[pid].lastRun = lr;
    }
  }
  return map;
}

/** Create a new research project for the signed-in user. */
function createProject(sessionToken, payloadJson) {
  var user = validateSessionForData(sessionToken, 'createProject');
  var norm = scNormalizeProjectPayload_(payloadJson);
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var data = sheet.getDataRange().getValues();
  var owned = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === user.email.toLowerCase() &&
        data[i][9] !== 'archived') owned++;
  }
  if (owned >= SCRAPER_MAX_PROJECTS_PER_USER) {
    return { success: false, error: 'project_limit_reached' };
  }
  var id = Utilities.getUuid();
  var now = new Date();
  sheet.appendRow([id, user.email, norm.name, norm.topic,
    JSON.stringify(norm.industries), JSON.stringify(norm.keywords),
    JSON.stringify(norm.exclusions), JSON.stringify(norm.sources),
    JSON.stringify(norm.regions), 'active', now, now]);
  scWriteSchedules_(ss, id, user.email, norm);
  dataAuditLog(user.email, 'create', 'project', id, norm.name);
  return { success: true, projectId: id };
}

/** List the signed-in user's projects (archived excluded unless requested). */
function listProjects(sessionToken, includeArchived) {
  var user = validateSessionForData(sessionToken, 'listProjects');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var data = ss.getSheetByName(SCRAPER_TABS.PROJECTS).getDataRange().getValues();
  var projects = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() !== user.email.toLowerCase()) continue;
    if (!includeArchived && data[i][9] === 'archived') continue;
    projects.push(scProjectFromRow_(data[i]));
  }
  var schedMap = scSchedulesFor_(ss, projects.map(function(p) { return p.id; }));
  projects.forEach(function(p) {
    var s = schedMap[p.id] || { frequencies: [], customConfig: '', delivery: 'inapp',
                                nextRun: '', lastRun: '' };
    p.frequencies = s.frequencies;
    p.customConfig = s.customConfig;
    p.delivery = s.delivery;
    p.nextRun = s.nextRun;
    p.lastRun = s.lastRun;
  });
  return { success: true, projects: projects };
}

/** Get one project (full detail + schedules) owned by the signed-in user. */
function getProject(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'getProject');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(sheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(sheet.getRange(rowNum, 1, 1, 12).getValues()[0]);
  var s = scSchedulesFor_(ss, [project.id])[project.id] ||
          { frequencies: [], customConfig: '', delivery: 'inapp' };
  project.frequencies = s.frequencies;
  project.customConfig = s.customConfig;
  project.delivery = s.delivery;
  return { success: true, project: project };
}

/** Update an existing project's scope and schedules (owner only). */
function updateProject(sessionToken, projectId, payloadJson) {
  var user = validateSessionForData(sessionToken, 'updateProject');
  var norm = scNormalizeProjectPayload_(payloadJson);
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(sheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var cur = sheet.getRange(rowNum, 1, 1, 12).getValues()[0];
  sheet.getRange(rowNum, 1, 1, 12).setValues([[cur[0], cur[1], norm.name, norm.topic,
    JSON.stringify(norm.industries), JSON.stringify(norm.keywords),
    JSON.stringify(norm.exclusions), JSON.stringify(norm.sources),
    JSON.stringify(norm.regions), cur[9], cur[10], new Date()]]);
  scWriteSchedules_(ss, cur[0], user.email, norm);
  dataAuditLog(user.email, 'update', 'project', cur[0], norm.name);
  return { success: true };
}

/** Change a project's lifecycle status: active | paused | archived. */
function setProjectStatus(sessionToken, projectId, status) {
  var user = validateSessionForData(sessionToken, 'setProjectStatus');
  var newStatus = String(status || '').toLowerCase();
  if (['active', 'paused', 'archived'].indexOf(newStatus) === -1) {
    return { success: false, error: 'bad_status' };
  }
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(sheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  sheet.getRange(rowNum, 10).setValue(newStatus);
  sheet.getRange(rowNum, 12).setValue(new Date());
  dataAuditLog(user.email, 'status:' + newStatus, 'project', String(projectId), '');
  return { success: true, status: newStatus };
}

// ── Phase 2: compilation engine ─────────────────────────────────────────
// Google News RSS + user-specified feeds → Articles tab. Compilation is
// chunked and resumable: each compileNow call fetches a bounded batch and
// persists progress in Script Properties, so the client loops until done
// while every call stays far under the 6-minute execution limit. The
// fetch-source list is built per project; a future paid news API slots in
// as one more queue entry kind.

/** Significant words from a topic (stopwords removed, first N kept). */
function scTopicTerms_(topic, n) {
  var stop = ['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'from',
              'about', 'with', 'news', 'articles', 'e.g', 'eg', 'etc', 'their', 'its',
              'this', 'that', 'these', 'those', 'as', 'by', 'at', 'is', 'are', 'be'];
  var words = String(topic || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/);
  var out = [];
  for (var i = 0; i < words.length && out.length < n; i++) {
    if (words[i].length > 2 && stop.indexOf(words[i]) === -1 && out.indexOf(words[i]) === -1) {
      out.push(words[i]);
    }
  }
  return out;
}

/** Build the ordered fetch queue (Google News RSS queries + user sources).
    learnedKeywords (from the distilled Preferences row) widen the net with
    queries shaped by what the user actually rated relevant; likedDomains adds
    per-outlet queries for the domains behind their 👍-rated articles;
    planQueries (AI query plan, optional) adds entity-level query groups. */
function scBuildFetchQueue_(project, learnedKeywords, likedDomains, planQueries) {
  var queue = [];
  var excl = (project.exclusions || []).slice(0, 5).map(function(t) {
    return '-"' + t + '"';
  }).join(' ');
  function gnews(q, label) {
    var full = (q + ' ' + excl).trim();
    queue.push({ kind: 'gnews', label: label,
      url: 'https://news.google.com/rss/search?q=' + encodeURIComponent(full)
           + '&hl=en-US&gl=US&ceid=US:en' });
  }
  var terms = scTopicTerms_(project.topic, 6);
  if (terms.length) gnews(terms.join(' '), 'topic');
  var kws = (project.keywords || []).slice(0, 12);
  for (var i = 0; i < kws.length; i += 3) {
    gnews(kws.slice(i, i + 3).map(function(k) { return '"' + k + '"'; }).join(' OR '), 'keywords');
  }
  (project.industries || []).slice(0, 3).forEach(function(ind) {
    gnews('"' + ind + '" ' + terms.slice(0, 2).join(' '), 'industry');
  });
  var learned = (learnedKeywords || []).slice(0, 9);
  for (var j = 0; j < learned.length; j += 3) {
    gnews(learned.slice(j, j + 3).map(function(k) { return '"' + k + '"'; }).join(' OR '), 'learned');
  }
  (likedDomains || []).slice(0, 3).forEach(function(d) {
    gnews(terms.slice(0, 3).join(' ') + ' site:' + d, 'liked-source');
  });
  // AI query plan groups — entity-level queries the auto-built ones miss.
  (planQueries || []).slice(0, SCRAPER_PLAN_GNEWS_MAX).forEach(function(pq) {
    gnews(pq, 'plan');
  });
  (project.sources || []).slice(0, 20).forEach(function(src) {
    queue.push({ kind: 'source', label: 'source', url: src });
  });
  return queue;
}

/** Parse an RSS 2.0 or Atom feed into [{url,title,source,publishedAt,snippet}]. */
function scParseFeed_(xmlText, fallbackSource) {
  var items = [];
  var doc = XmlService.parse(xmlText);
  var root = doc.getRootElement();
  // Strip tags, then decode the HTML entities feeds routinely double-encode
  // (Google News descriptions are full of &nbsp;/&amp;) so stored titles and
  // snippets are plain text. Rendering re-escapes via escapeHtml, so decoding
  // here is safe.
  function clean(s, max) {
    return scStr_(String(s || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#(\d+);/g, function(mm, n) {
        var c = Number(n);
        return (c >= 32 && c < 65536) ? String.fromCharCode(c) : ' ';
      })
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' '), max);
  }
  if (root.getName().toLowerCase() === 'rss') {
    var channel = root.getChild('channel');
    if (!channel) return items;
    channel.getChildren('item').forEach(function(it) {
      function ch(name) { var c = it.getChild(name); return c ? c.getText() : ''; }
      var srcEl = it.getChild('source');
      items.push({
        // 1500-char cap: Google News redirect URLs regularly exceed 500 chars
        // (live sample: 498 on a small query) — the old 500 cap truncated the
        // encoded article token and every click 400'd at Google.
        url: scStr_(ch('link'), 1500),
        title: clean(ch('title'), 300),
        source: clean(srcEl ? srcEl.getText() : fallbackSource, 120),
        publishedAt: scStr_(ch('pubDate'), 60),
        snippet: clean(ch('description'), SCRAPER_ARTICLE_SNIPPET_MAX)
      });
    });
  } else if (root.getName().toLowerCase() === 'feed') {
    var atom = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    root.getChildren('entry', atom).forEach(function(en) {
      function ch(name) { var c = en.getChild(name, atom); return c ? c.getText() : ''; }
      var linkUrl = '';
      en.getChildren('link', atom).forEach(function(l) {
        var rel = l.getAttribute('rel');
        if (!linkUrl || !rel || rel.getValue() === 'alternate') {
          linkUrl = l.getAttribute('href') ? l.getAttribute('href').getValue() : linkUrl;
        }
      });
      items.push({
        url: scStr_(linkUrl, 1500),   // same 1500-char cap as the RSS branch
        title: clean(ch('title'), 300),
        source: clean(fallbackSource, 120),
        publishedAt: scStr_(ch('published') || ch('updated'), 60),
        snippet: clean(ch('summary') || ch('content'), SCRAPER_ARTICLE_SNIPPET_MAX)
      });
    });
  }
  return items;
}

/** Existing article URLs for a project (dedupe set as an object map).
    Includes the ArticlesArchive tab so Compile/Backfill can never re-import
    an article the user archived as irrelevant — without this, the next
    Backfill would resurrect the whole archived junk pile. */
function scExistingArticleUrls_(ss, projectId) {
  var map = {};
  var data = ss.getSheetByName(SCRAPER_TABS.ARTICLES).getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === projectId) map[String(data[i][3])] = true;
  }
  var archSheet = ss.getSheetByName(SCRAPER_TABS.ARCHIVE);
  if (archSheet) {
    var arch = archSheet.getDataRange().getValues();
    for (var a = 1; a < arch.length; a++) {
      if (arch[a][1] === projectId) map[String(arch[a][3])] = true;
    }
  }
  return map;
}

/** Add AI/fetch call counts to today's UsageLog row for ownerEmail (create if absent). */
function scLogUsage_(ss, ownerEmail, aiCalls, fetchCalls) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.USAGE);
  var today = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var cell = data[i][0];
    var cellStr = (cell instanceof Date)
      ? Utilities.formatDate(cell, 'America/New_York', 'yyyy-MM-dd') : String(cell);
    if (cellStr === today && String(data[i][1]).toLowerCase() === ownerEmail.toLowerCase()) {
      sheet.getRange(i + 1, 3, 1, 2).setValues([[
        Number(data[i][2] || 0) + aiCalls, Number(data[i][3] || 0) + fetchCalls]]);
      return;
    }
  }
  sheet.appendRow([today, ownerEmail, aiCalls, fetchCalls, '']);
}

function scCompileStateKey_(projectId) { return SCRAPER_COMPILE_STATE_PREFIX + projectId; }

/** Run one bounded compilation chunk for a project. Client loops until done. */
function compileNow(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'compileNow');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(sheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(sheet.getRange(rowNum, 1, 1, 12).getValues()[0]);
  return scCompileChunk_(ss, user.email, project);
}

/** Session-free compile core — one bounded chunk. Shared by the compileNow
    action (session-validated wrapper above) and the scheduler, which runs as
    the script owner on a time-driven trigger with no session in scope.
    Ownership is the caller's responsibility: email must be the project owner. */
function scCompileChunk_(ss, email, project) {
  var props = PropertiesService.getScriptProperties();
  var key = scCompileStateKey_(project.id);
  var state = null;
  try { state = JSON.parse(props.getProperty(key) || 'null'); } catch (stErr) { state = null; }
  if (!state || state.done || String(state.owner).toLowerCase() !== email.toLowerCase()) {
    var cPrefs = scGetPrefs_(ss, project.id);
    var cPlan = scGetPlan_(ss, project.id);
    var queue = scBuildFetchQueue_(project, cPrefs ? cPrefs.keywords : [],
                                   scLikedDomains_(ss, project.id, email, 3),
                                   cPlan ? cPlan.queries : []);
    state = { owner: email, startedAt: new Date().toISOString(),
              urls: queue.map(function(q) { return q.url; }),
              labels: queue.map(function(q) { return q.label; }),
              index: 0, added: 0, errors: 0, filtered: 0, done: false };
  }

  var existing = scExistingArticleUrls_(ss, project.id);
  var articles = ss.getSheetByName(SCRAPER_TABS.ARTICLES);
  var pfPrefs = scGetPrefs_(ss, project.id);
  var pfNote = pfPrefs ? pfPrefs.note : '';
  var aiCalls = 0;
  var t0 = Date.now();
  var fetches = 0;
  var now = new Date();
  while (state.index < state.urls.length &&
         fetches < SCRAPER_COMPILE_BATCH_FETCHES &&
         (Date.now() - t0) < SCRAPER_COMPILE_TIME_BUDGET_MS &&
         state.added < SCRAPER_COMPILE_MAX_NEW) {
    var url = state.urls[state.index];
    var label = state.labels[state.index];
    state.index++;
    fetches++;
    try {
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      if (resp.getResponseCode() !== 200) { state.errors++; continue; }
      var host = (String(url).match(/^https?:\/\/([^\/]+)/) || [])[1] || '';
      var feedItems = scParseFeed_(resp.getContentText(),
        label === 'source' ? host : 'Google News');
      var fresh = [];
      feedItems.forEach(function(item) {
        if (!item.url || existing[item.url]) return;
        existing[item.url] = true;
        fresh.push(item);
      });
      // AI pre-filter: keep the collection clean at the door (fails open).
      var pf = scPrefilterItems_(project, pfNote, fresh);
      aiCalls += pf.aiCalls;
      state.filtered = (state.filtered || 0) + pf.dropped;
      pf.kept.forEach(function(item) {
        if (state.added >= SCRAPER_COMPILE_MAX_NEW) return;
        state.added++;
        articles.appendRow([Utilities.getUuid(), project.id, email, item.url,
          item.title, item.source, item.publishedAt, now, item.snippet, '', '', '', '']);
      });
    } catch (fetchErr) {
      state.errors++;
    }
  }
  scLogUsage_(ss, email, aiCalls, fetches);
  state.done = state.index >= state.urls.length || state.added >= SCRAPER_COMPILE_MAX_NEW;
  if (state.done) state.finishedAt = new Date().toISOString();
  props.setProperty(key, JSON.stringify(state));
  if (state.done) dataAuditLog(email, 'compile', 'project', project.id,
    state.added + ' new articles, ' + (state.filtered || 0) + ' filtered, '
    + state.errors + ' errors');
  return { success: true, done: state.done, processed: state.index,
           total: state.urls.length, added: state.added, errors: state.errors,
           filtered: state.filtered || 0 };
}

/** Current compilation progress for a project (owner only). */
function getCompileStatus(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'getCompileStatus');
  var state = null;
  try {
    state = JSON.parse(PropertiesService.getScriptProperties()
      .getProperty(scCompileStateKey_(String(projectId || ''))) || 'null');
  } catch (gsErr) { state = null; }
  if (!state || String(state.owner).toLowerCase() !== user.email.toLowerCase()) {
    return { success: true, state: null };
  }
  return { success: true, state: { done: state.done, processed: state.index,
    total: state.urls.length, added: state.added, errors: state.errors,
    startedAt: state.startedAt, finishedAt: state.finishedAt || '' } };
}

// ── Phase 3.5: historical backfill (GDELT DOC 2.0) ──────────────────────
// GDELT's free DOC API (no key, coverage back to 2017) supplies the 2-year
// history that Google News RSS cannot (its feeds only cover ~30 days).
// The window is sliced per month × per query; each slice is one UrlFetch
// returning ≤250 JSON articles. Same chunked/resumable pattern as
// compileNow: compact state in Script Properties (slices are derived, not
// stored — the 9KB property limit rules out storing ~100 task objects),
// client loops until done.

function scBackfillStateKey_(projectId) { return SCRAPER_BACKFILL_STATE_PREFIX + projectId; }

/** GDELT query strings for a project (quoted phrases, OR groups in parens).
    When an AI query plan exists, its entity-level groups REPLACE the
    auto-built topic/keyword queries (which only see the first words of the
    topic) — the liked-domain group is still appended. */
function scGdeltQueries_(project, learnedKeywords, likedDomains, planQueries) {
  if (planQueries && planQueries.length) {
    // GDELT requires OR groups wrapped in parens.
    var pq = planQueries.slice(0, SCRAPER_PLAN_GDELT_MAX).map(function(q) {
      return (/ OR /.test(q) && q.charAt(0) !== '(') ? '(' + q + ')' : q;
    });
    var pdoms = (likedDomains || []).slice(0, 3).map(function(d) { return 'domainis:' + d; });
    if (pdoms.length) {
      pq.push(pdoms.length > 1 ? '(' + pdoms.join(' OR ') + ')' : pdoms[0]);
    }
    return pq;
  }
  var queries = [];
  var terms = scTopicTerms_(project.topic, 4);
  if (terms.length) queries.push(terms.join(' '));
  var kws = (project.keywords || []).slice(0, 9);
  for (var i = 0; i < kws.length; i += 3) {
    var group = kws.slice(i, i + 3).map(function(k) { return '"' + k + '"'; });
    queries.push(group.length > 1 ? '(' + group.join(' OR ') + ')' : group[0]);
  }
  queries = queries.slice(0, 4);
  // One extra query group from the distilled learned keywords (if any) —
  // bounded to a single group so backfill total slices grow by at most 1×months.
  var learned = (learnedKeywords || []).slice(0, 3).map(function(k) { return '"' + k + '"'; });
  if (learned.length) {
    queries.push(learned.length > 1 ? '(' + learned.join(' OR ') + ')' : learned[0]);
  }
  // One liked-domain group: history from the outlets behind 👍-rated articles.
  var doms = (likedDomains || []).slice(0, 3).map(function(d) { return 'domainis:' + d; });
  if (doms.length) {
    var base = terms.slice(0, 2).join(' ');
    queries.push((base ? base + ' ' : '') + (doms.length > 1 ? '(' + doms.join(' OR ') + ')' : doms[0]));
  }
  return queries.slice(0, 6);
}

/** Task i for a backfill state: month slice × query, anchored to startedAt
    so boundaries stay identical across resumed invocations. */
function scBackfillTaskAt_(state, i) {
  var m = Math.floor(i / state.queries.length);
  var anchor = new Date(state.startedAt);
  var start = new Date(anchor.getFullYear(), anchor.getMonth() - m, 1);
  var end = (m === 0) ? anchor : new Date(anchor.getFullYear(), anchor.getMonth() - m + 1, 1);
  return { q: state.queries[i % state.queries.length],
    s: Utilities.formatDate(start, 'GMT', 'yyyyMMddHHmmss'),
    e: Utilities.formatDate(end, 'GMT', 'yyyyMMddHHmmss') };
}

/** Run one bounded backfill chunk for a project. Client loops until done. */
function backfillNow(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'backfillNow');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(sheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(sheet.getRange(rowNum, 1, 1, 12).getValues()[0]);

  var props = PropertiesService.getScriptProperties();
  var key = scBackfillStateKey_(project.id);
  var state = null;
  try { state = JSON.parse(props.getProperty(key) || 'null'); } catch (bfErr) { state = null; }
  if (!state || state.done || String(state.owner).toLowerCase() !== user.email.toLowerCase()) {
    var bPrefs = scGetPrefs_(ss, project.id);
    var bPlan = scGetPlan_(ss, project.id);
    state = { owner: user.email, startedAt: new Date().toISOString(),
              queries: scGdeltQueries_(project, bPrefs ? bPrefs.keywords : [],
                                       scLikedDomains_(ss, project.id, user.email, 3),
                                       bPlan ? bPlan.queries : []),
              months: SCRAPER_BACKFILL_MONTHS,
              index: 0, added: 0, errors: 0, filtered: 0, done: false };
  }
  var total = state.queries.length * state.months;

  var existing = scExistingArticleUrls_(ss, project.id);
  var articles = ss.getSheetByName(SCRAPER_TABS.ARTICLES);
  var bfPrefs = scGetPrefs_(ss, project.id);
  var bfNote = bfPrefs ? bfPrefs.note : '';
  var aiCalls = 0;
  var t0 = Date.now();
  var fetches = 0;
  var now = new Date();
  while (state.index < total &&
         fetches < SCRAPER_BACKFILL_BATCH_FETCHES &&
         (Date.now() - t0) < SCRAPER_BACKFILL_TIME_BUDGET_MS) {
    var task = scBackfillTaskAt_(state, state.index);
    state.index++;
    fetches++;
    try {
      var url = 'https://api.gdeltproject.org/api/v2/doc/doc'
        + '?query=' + encodeURIComponent(task.q + ' sourcelang:english')
        + '&mode=ArtList&format=json&maxrecords=250&sort=DateDesc'
        + '&startdatetime=' + task.s + '&enddatetime=' + task.e;
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      if (resp.getResponseCode() !== 200) { state.errors++; continue; }
      var list = [];
      // GDELT reports query errors as plain text with HTTP 200 — treat unparseable as error
      try { list = (JSON.parse(resp.getContentText()) || {}).articles || []; }
      catch (parseErr) { state.errors++; continue; }
      var fresh = [];
      list.forEach(function(item) {
        var u = scStr_(String(item.url || ''), 500);
        if (!u || existing[u]) return;
        existing[u] = true;
        fresh.push({ url: u, title: scStr_(String(item.title || ''), 300),
          source: scStr_(String(item.domain || ''), 120),
          seendate: scStr_(String(item.seendate || ''), 60) });
      });
      // AI pre-filter (fails open) — GDELT keyword matching is the junk firehose.
      var pf = scPrefilterItems_(project, bfNote, fresh);
      aiCalls += pf.aiCalls;
      state.filtered = (state.filtered || 0) + pf.dropped;
      var rows = pf.kept.map(function(item) {
        return [Utilities.getUuid(), project.id, user.email, item.url,
          item.title, item.source, item.seendate, now, '', '', '', '', ''];
      });
      if (rows.length) {
        articles.getRange(articles.getLastRow() + 1, 1, rows.length, 13).setValues(rows);
        state.added += rows.length;
      }
    } catch (gdeltErr) {
      state.errors++;
    }
  }
  scLogUsage_(ss, user.email, aiCalls, fetches);
  state.done = state.index >= total;
  if (state.done) state.finishedAt = new Date().toISOString();
  props.setProperty(key, JSON.stringify(state));
  if (state.done) dataAuditLog(user.email, 'backfill', 'project', project.id,
    state.added + ' historical articles, ' + (state.filtered || 0) + ' filtered, '
    + state.errors + ' errors');
  return { success: true, done: state.done, processed: state.index,
           total: total, added: state.added, errors: state.errors,
           filtered: state.filtered || 0 };
}

/** Current backfill progress for a project (owner only). */
function getBackfillStatus(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'getBackfillStatus');
  var state = null;
  try {
    state = JSON.parse(PropertiesService.getScriptProperties()
      .getProperty(scBackfillStateKey_(String(projectId || ''))) || 'null');
  } catch (gbErr) { state = null; }
  if (!state || String(state.owner).toLowerCase() !== user.email.toLowerCase()) {
    return { success: true, state: null };
  }
  return { success: true, state: { done: state.done, processed: state.index,
    total: state.queries.length * state.months, added: state.added, errors: state.errors,
    startedAt: state.startedAt, finishedAt: state.finishedAt || '' } };
}

// ── Phase 3.6: AI query planner, fetch-time pre-filter, deep backfill ──
// The auto-built queries (scTopicTerms_ takes the FIRST 6 words of the topic)
// were the root cause of an 84%-junk corpus: most entities named in a prose
// topic were never queried. The planner turns the FULL topic + keywords +
// learned preferences into entity-level query groups, stored per project in
// the QueryPlans tab and consumed by Compile, Backfill, and Deep backfill.

/** Stored query plan for a project, or null. */
function scGetPlan_(ss, projectId) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.QUERYPLANS);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] !== projectId) continue;
    var queries = [], manual = [];
    try { queries = JSON.parse(String(data[i][2] || '[]')) || []; } catch (qpErr) { queries = []; }
    try { manual = JSON.parse(String(data[i][4] || '[]')) || []; } catch (mErr) { manual = []; }
    return { row: i + 1, queries: queries, plannedAt: String(data[i][3] || ''), manual: manual };
  }
  return null;
}

/** Upsert a project's query plan row. `manual` tracks which groups the user
    added by hand, so Rebuild can regenerate the AI groups WITHOUT losing them. */
function scSavePlan_(ss, projectId, owner, queries, manual) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.QUERYPLANS);
  var existing = scGetPlan_(ss, projectId);
  var rowVals = [projectId, owner, JSON.stringify(queries), new Date().toISOString(),
                 JSON.stringify(manual || [])];
  if (existing) sheet.getRange(existing.row, 1, 1, 5).setValues([rowVals]);
  else sheet.appendRow(rowVals);
}

/** First JSON array in an AI reply, or null. Tolerates prose around it. */
function scJsonArray_(text) {
  var s = String(text || '');
  var a = s.indexOf('['), b = s.lastIndexOf(']');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.substring(a, b + 1)); } catch (jaErr) { return null; }
}

/** Build and store the AI query plan for a project (one AI call). */
function planQueries(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'planQueries');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);
  var prefs = scGetPrefs_(ss, project.id);

  var prompt = 'You are building a news-search query plan for a monitoring project.\n\n'
    + 'PROJECT TOPIC (full text — every entity mentioned here matters):\n'
    + project.topic + '\n\n'
    + 'KEYWORDS: ' + (project.keywords || []).join(', ') + '\n'
    + 'INDUSTRIES: ' + (project.industries || []).join(', ') + '\n'
    + 'EXCLUDED TERMS: ' + (project.exclusions || []).join(', ') + '\n\n'
    + scPrefsPrompt_(prefs ? prefs.note : '')
    + (prefs && prefs.keywords.length
        ? 'LEARNED SEARCH PHRASES: ' + prefs.keywords.join(', ') + '\n\n' : '')
    + 'Produce up to ' + SCRAPER_PLAN_QUERIES_MAX + ' search query strings that together '
    + 'cover EVERY company, organization, technology, and policy area the project cares '
    + 'about. Each query is a group of 1-3 quoted phrases joined by OR, focused on ONE '
    + 'entity or theme, including common aliases and product names, e.g. '
    + '"\\"Tesla Megapack\\" OR \\"Tesla Energy\\"". Prefer specific entity names over '
    + 'generic terms; do not include the excluded terms.\n\n'
    + 'Reply ONLY with a JSON array of query strings.';
  var queries;
  try {
    var text = aiComplete_(prompt, 4096);
    queries = scJsonArray_(text);
  } catch (aiErr) {
    return { success: false, error: String(aiErr.message || aiErr).split(' — ')[0] };
  }
  if (!queries || !queries.length) return { success: false, error: 'plan_parse_failed' };
  queries = queries.map(function(q) { return scStr_(String(q || ''), 200); })
    .filter(function(q) { return q; })
    .slice(0, SCRAPER_PLAN_QUERIES_MAX);
  // Rebuild preserves the user's manual additions: they go FIRST (inside every
  // consumer's slice window), then the fresh AI groups (minus exact dupes),
  // capped at the hard total. Only the AI-generated portion is replaced.
  var existingPlan = scGetPlan_(ss, project.id);
  var manual = (existingPlan && existingPlan.manual) ? existingPlan.manual.slice() : [];
  if (manual.length) {
    var manualLower = manual.map(function(m) { return String(m).toLowerCase(); });
    queries = manual.concat(queries.filter(function(q) {
      return manualLower.indexOf(String(q).toLowerCase()) === -1;
    })).slice(0, SCRAPER_PLAN_TOTAL_MAX);
  }
  scSavePlan_(ss, project.id, user.email, queries, manual);
  scLogUsage_(ss, user.email, 1, 0);
  dataAuditLog(user.email, 'plan_queries', 'project', project.id, queries.length + ' query groups');
  return { success: true, queries: queries, count: queries.length, manual: manual };
}

/** Read the stored query plan (owner-scoped via project lookup). */
function getQueryPlan(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'getQueryPlan');
  var ss = scraperSs_();
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var plan = scGetPlan_(ss, String(projectId));
  return { success: true, plan: plan
    ? { queries: plan.queries, plannedAt: plan.plannedAt, manual: plan.manual || [] }
    : null };
}

/** Evaluate one user-supplied term into a plan query group and PREPEND it —
    prepending guarantees the manual addition falls inside every consumer's
    slice window (Compile, GDELT backfill, Deep backfill all read from the
    front of the plan). One AI call shapes the group in the same style as the
    existing plan ("Sinexcel" → "Sinexcel" data center project OR deal); if
    the AI reply doesn't contain the term, a safe topic-terms fallback is
    used instead so the add never silently misses the entity. */
function addPlanQuery(sessionToken, projectId, term) {
  var user = validateSessionForData(sessionToken, 'addPlanQuery');
  var t = scStr_(String(term || ''), 80);
  if (!t) return { success: false, error: 'term_missing' };
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);

  // Script lock around the whole read-AI-write sequence. Without it, a retry
  // (or a second add) that overlaps a still-running first attempt reads the
  // pre-add plan and its save silently DROPS the first keyword (lost update).
  var addLock = LockService.getScriptLock();
  if (!addLock.tryLock(15000)) return { success: false, error: 'plan_busy' };
  try {
    var plan = scGetPlan_(ss, project.id);
    var queries = plan ? plan.queries.slice() : [];
    var lower = t.toLowerCase();
    for (var i = 0; i < queries.length; i++) {
      if (String(queries[i]).toLowerCase().indexOf(lower) !== -1) {
        return { success: false, error: 'plan_duplicate', existing: queries[i], queries: queries };
      }
    }
    if (queries.length >= SCRAPER_PLAN_TOTAL_MAX) return { success: false, error: 'plan_full' };

    var prompt = 'A user monitors this project:\n' + scStr_(String(project.topic || ''), 1000)
      + '\n\nExisting search query groups (match this style):\n'
      + queries.slice(0, 5).join('\n')
      + '\n\nThe user wants to add search coverage for: "' + t + '"\n\n'
      + 'Produce ONE search query string for it in the same style: the quoted term '
      + '(plus ONE quoted common alias joined by OR, only if a well-known alias exists) '
      + 'followed by 2-4 unquoted context words relevant to this project.\n'
      + 'Reply ONLY with a JSON array containing exactly one string.';
    var q = '';
    try {
      var arr = scJsonArray_(aiComplete_(prompt, 512));
      q = (arr && arr.length) ? scStr_(String(arr[0] || ''), 200) : '';
    } catch (apErr) {
      return { success: false, error: String(apErr.message || apErr).split(' — ')[0] };
    }
    if (!q || q.toLowerCase().indexOf(lower) === -1) {
      // AI drifted off the term — fall back to quoted term + topic context words.
      q = '"' + t + '" ' + scTopicTerms_(project.topic, 3).join(' ');
    }
    queries.unshift(q);
    var manual = (plan && plan.manual) ? plan.manual.slice() : [];
    manual.unshift(q);  // remember this group is user-added — Rebuild keeps it
    scSavePlan_(ss, project.id, user.email, queries, manual);
    scLogUsage_(ss, user.email, 1, 0);
    dataAuditLog(user.email, 'plan_add', 'project', project.id, q);
    return { success: true, query: q, queries: queries, count: queries.length, manual: manual };
  } finally {
    addLock.releaseLock();
  }
}

/** Batch keep/drop pre-filter over candidate items ({title, source} read).
    One AI call per SCRAPER_PREFILTER_BATCH headlines; drops only clear junk.
    FAILS OPEN: any AI error keeps the whole batch — a rate-limited or broken
    AI service must never cost the user articles. */
function scPrefilterItems_(project, prefsNote, items) {
  if (!items.length) return { kept: items, dropped: 0, aiCalls: 0 };
  var kept = [], dropped = 0, aiCalls = 0;
  for (var i = 0; i < items.length; i += SCRAPER_PREFILTER_BATCH) {
    var batch = items.slice(i, i + SCRAPER_PREFILTER_BATCH);
    var lines = batch.map(function(it, idx) {
      return (idx + 1) + '. ' + it.title + (it.source ? ' (' + it.source + ')' : '');
    }).join('\n');
    var prompt = 'PROJECT SCOPE:\n' + scStr_(String(project.topic || ''), 1500) + '\n'
      + 'KEYWORDS: ' + (project.keywords || []).join(', ') + '\n\n'
      + scPrefsPrompt_(prefsNote)
      + 'Below are candidate news headlines. Keep any headline that is plausibly relevant '
      + 'to the project scope — on-topic, a subtopic, or adjacent context (corporate moves, '
      + 'financing, policy, supply chain involving relevant players). Drop only headlines '
      + 'that are clearly unrelated junk. When unsure, KEEP the headline.\n\n'
      + lines + '\n\n'
      + 'Reply ONLY with a JSON array of the numbers to KEEP, e.g. [1,3,4].';
    try {
      var nums = scJsonArray_(aiComplete_(prompt, 1024));
      aiCalls++;
      if (!nums) throw new Error('prefilter_parse');
      var keep = {};
      nums.forEach(function(n) { keep[Number(n)] = true; });
      batch.forEach(function(it, idx) {
        if (keep[idx + 1]) kept.push(it); else dropped++;
      });
    } catch (pfErr) {
      kept = kept.concat(batch);  // fail open
    }
  }
  return { kept: kept, dropped: dropped, aiCalls: aiCalls };
}

function scDeepBFStateKey_(projectId) { return SCRAPER_DEEPBF_STATE_PREFIX + projectId; }

/** One Claude web-search call: articles about queryGroup during periodLabel.
    Returns { articles: [{url,title,source,published,summary}], searches: n }.
    Requires ANTHROPIC_API_KEY (independent of the AI_PROVIDER setting —
    web search is an Anthropic server-side tool). */
function scWebSearchArticles_(apiKey, project, queryGroup, periodLabel) {
  var prompt = 'Search the web for news articles about ' + queryGroup
    + ' published during ' + periodLabel + '.\n'
    + 'Context — the user monitors: ' + scStr_(String(project.topic || ''), 600) + '\n\n'
    + 'After searching, reply ONLY with a JSON array (max '
    + SCRAPER_DEEPBF_ARTICLES_PER_CALL + ' entries) of the most relevant articles you '
    + 'actually found in the search results:\n'
    + '[{"url":"https://...","title":"...","source":"publisher name",'
    + '"published":"YYYY-MM-DD","summary":"1-2 sentence factual summary"}]\n'
    + 'Only include real articles from the search results. If nothing relevant was '
    + 'found, reply [].';
  var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: SCRAPER_DEEPBF_MODEL,
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search',
                max_uses: SCRAPER_DEEPBF_SEARCHES_PER_CALL }],
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  var body = resp.getContentText() || '';
  if (code === 429) throw new Error('ai_rate_limited');
  if (code < 200 || code >= 300) {
    var apiMsg = '';
    try { apiMsg = (JSON.parse(body).error || {}).message || ''; } catch (weErr) {}
    throw new Error('ai_http_' + code + (apiMsg ? ' — ' + apiMsg.slice(0, 160) : ''));
  }
  var data;
  try { data = JSON.parse(body); } catch (wpErr) { throw new Error('ai_bad_json'); }
  var text = '';
  ((data && data.content) || []).forEach(function(b) {
    if (b && b.type === 'text') text += b.text || '';
  });
  var searches = Number(((data || {}).usage || {}).server_tool_use
    ? data.usage.server_tool_use.web_search_requests : 0) || 0;
  var articles = scJsonArray_(text) || [];
  return { articles: articles, searches: searches };
}

/** Deep backfill: one quarter × query-group task per invocation (a web-search
    turn can run 20-60s, so the client loops task by task). Same poison-safe
    pre-call state save as Enrich — a killed execution counts the task failed
    and moves on instead of re-hanging. Articles arrive WITH summaries, so
    they skip Enrich entirely; the pre-filter is unnecessary (search relevance
    already did that job). */
function deepBackfillNow(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'deepBackfillNow');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);

  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') || '';
  if (!apiKey) return { success: false, error: 'deepbf_key_missing' };

  var props = PropertiesService.getScriptProperties();
  var key = scDeepBFStateKey_(project.id);
  var state = null;
  try { state = JSON.parse(props.getProperty(key) || 'null'); } catch (dbErr) { state = null; }
  if (!state || state.done || String(state.owner).toLowerCase() !== user.email.toLowerCase()) {
    var plan = scGetPlan_(ss, project.id);
    var dPrefs = scGetPrefs_(ss, project.id);
    var groups = (plan && plan.queries.length
      ? plan.queries
      : scGdeltQueries_(project, dPrefs ? dPrefs.keywords : [],
                        scLikedDomains_(ss, project.id, user.email, 3)))
      .slice(0, SCRAPER_DEEPBF_GROUPS_MAX);
    state = { owner: user.email, startedAt: new Date().toISOString(),
              groups: groups, quarters: SCRAPER_DEEPBF_QUARTERS,
              index: 0, added: 0, errors: 0, searches: 0, done: false };
  }
  var total = state.groups.length * state.quarters;

  // Poison recovery: a leftover marker means the prior execution died
  // mid-call (uncatchable 6-min kill) — count it failed and move past it.
  if (state.attempting != null) {
    state.errors++;
    state.index = state.attempting + 1;
    state.attempting = null;
  }

  if (state.index < total) {
    var qIdx = state.index % state.groups.length;
    var quarter = Math.floor(state.index / state.groups.length);
    var anchor = new Date(state.startedAt);
    var qStart = new Date(anchor.getFullYear(), anchor.getMonth() - 3 * (quarter + 1), 1);
    var qEnd = (quarter === 0) ? anchor
      : new Date(anchor.getFullYear(), anchor.getMonth() - 3 * quarter, 1);
    var label = Utilities.formatDate(qStart, 'GMT', 'MMMM yyyy') + ' through '
      + Utilities.formatDate(qEnd, 'GMT', 'MMMM yyyy');

    state.attempting = state.index;
    props.setProperty(key, JSON.stringify(state));  // survives a mid-call kill
    try {
      var result = scWebSearchArticles_(apiKey, project, state.groups[qIdx], label);
      state.searches += result.searches;
      var existing = scExistingArticleUrls_(ss, project.id);
      var articles = ss.getSheetByName(SCRAPER_TABS.ARTICLES);
      var now = new Date();
      var rows = [];
      result.articles.forEach(function(a) {
        var u = scStr_(String((a && a.url) || ''), 500);
        if (!u || !/^https?:\/\//i.test(u) || existing[u]) return;
        existing[u] = true;
        rows.push([Utilities.getUuid(), project.id, user.email, u,
          scStr_(String(a.title || ''), 300), scStr_(String(a.source || ''), 120),
          scStr_(String(a.published || ''), 60), now,
          scStr_(String(a.summary || ''), SCRAPER_ARTICLE_SNIPPET_MAX), '', '', '', '']);
      });
      if (rows.length) {
        articles.getRange(articles.getLastRow() + 1, 1, rows.length, 13).setValues(rows);
        state.added += rows.length;
      }
    } catch (dbfErr) {
      state.errors++;
    }
    state.attempting = null;
    state.index++;
    scLogUsage_(ss, user.email, 1, 0);
  }

  state.done = state.index >= total;
  if (state.done) state.finishedAt = new Date().toISOString();
  props.setProperty(key, JSON.stringify(state));
  if (state.done) dataAuditLog(user.email, 'deep_backfill', 'project', project.id,
    state.added + ' articles via ' + state.searches + ' web searches, '
    + state.errors + ' failed tasks');
  return { success: true, done: state.done, processed: state.index, total: total,
           added: state.added, errors: state.errors, searches: state.searches };
}

/** Calibration band mixer (pure — unit-testable). Splits scored articles into
    mid (30-70) / high (>70) / low (<30, already floored at
    SCRAPER_CALIB_MIN_SCORE upstream) and interleaves ~60/20/20. The low band
    NEVER substitutes for empty mid/high bands: once the informative bands run
    dry the queue ends, instead of degrading into a junk-confirmation feed —
    ratings on articles the scorer already dismissed teach it almost nothing.
    Empty mid/high slots borrow from each other; empty low slots borrow from
    mid/high. Input order (newest first) is preserved within bands. */
function scCalibMix_(articles, max) {
  var mid = [], hi = [], lo = [];
  articles.forEach(function(a) {
    if (a.score > 70) hi.push(a);
    else if (a.score < 30) lo.push(a);
    else mid.push(a);
  });
  var bands = { mid: mid, hi: hi, lo: lo };
  var pattern = ['mid', 'mid', 'mid', 'hi', 'lo'];
  var picked = [];
  for (var pi = 0; picked.length < max && (mid.length || hi.length); pi++) {
    var want = pattern[pi % pattern.length];
    var b = bands[want];
    if (!b.length) {
      if (want === 'lo') b = mid.length ? mid : hi;
      else b = want === 'mid' ? hi : mid;
    }
    if (!b.length) continue;  // informative bands dry mid-cycle — loop condition ends it
    picked.push(b.shift());
  }
  return picked;
}

/** Articles for a project (owner only, capped).
    Standard mode: top-scored list with optional filters — minScore, days
    (fetched within N days), q (keyword needle over title/snippet/summary/source).
    Calibration mode: a stratified sample of UNRATED, scored articles mixed
    ~60% mid-band (30-70) / 20% high (>70) / 20% low (<30), newest first within
    each band — the mid band teaches the scorer the most per rating, the high
    band verifies precision, and the low band surfaces wrongly buried articles. */
function listArticles(sessionToken, projectId, limit, mode, minScore, days, q) {
  var user = validateSessionForData(sessionToken, 'listArticles');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(sheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var max = Math.min(Number(limit) || SCRAPER_LIST_ARTICLES_MAX, SCRAPER_LIST_ARTICLES_MAX);
  var calib = String(mode || '') === 'calibration';
  var minS = (minScore === '' || minScore == null) ? null : Number(minScore);
  var maxAgeMs = Number(days) > 0 ? Number(days) * 86400000 : 0;
  var needle = String(q || '').toLowerCase().trim();
  var data = ss.getSheetByName(SCRAPER_TABS.ARTICLES).getDataRange().getValues();
  var out = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1] !== projectId) continue;
    if (String(data[i][2]).toLowerCase() !== user.email.toLowerCase()) continue;
    if (calib) {
      if (data[i][11]) continue;         // calibration: unrated only
      if (data[i][10] === '') continue;  // calibration: needs a score for banding
      // Sub-floor articles are excluded entirely: the scorer is already
      // confident they're junk, so confirming with 👎 teaches almost nothing.
      if (Number(data[i][10]) < SCRAPER_CALIB_MIN_SCORE) continue;
    } else {
      if (minS != null && (data[i][10] === '' || Number(data[i][10]) < minS)) continue;
      if (maxAgeMs && (!data[i][7] || Date.now() - new Date(data[i][7]).getTime() > maxAgeMs)) continue;
      if (needle && (String(data[i][4]) + ' ' + String(data[i][8]) + ' ' + String(data[i][9]) + ' '
                     + String(data[i][5])).toLowerCase().indexOf(needle) === -1) continue;
    }
    out.push({ id: data[i][0], url: data[i][3], title: data[i][4], source: data[i][5],
      publishedAt: String(data[i][6] || ''), fetchedAt: data[i][7] ? new Date(data[i][7]).toISOString() : '',
      snippet: data[i][8], summary: data[i][9], score: data[i][10] === '' ? null : Number(data[i][10]),
      verdict: data[i][11] });
  }
  if (calib) {
    return { success: true, articles: scCalibMix_(out, max), calibration: true,
             unratedTotal: out.length };
  }
  // Cap AFTER sorting so the overlay shows the top-scored articles of the whole
  // corpus — capping the reverse walk returned the 100 most recently *fetched*
  // rows, which a big low-relevance backfill filled with junk. Stable sort keeps
  // newest-first (from the reverse walk) within ties; unscored rows sort last.
  out.sort(function(a, b) {
    var as = a.score == null ? -1 : a.score;
    var bs = b.score == null ? -1 : b.score;
    return bs - as;
  });
  out = out.slice(0, max);
  return { success: true, articles: out };
}

/** Record 👍/👎 feedback on an article ('up' | 'down' | '' clears). The verdict
    column feeds exemplars into every future scoring prompt (see scScoreBatch_). */
function setArticleVerdict(sessionToken, projectId, articleId, verdict) {
  var user = validateSessionForData(sessionToken, 'setArticleVerdict');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var v = String(verdict || '').toLowerCase();
  if (v !== 'up' && v !== 'down' && v !== '') return { success: false, error: 'bad_verdict' };
  var sheet = ss.getSheetByName(SCRAPER_TABS.ARTICLES);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] !== articleId) continue;
    if (data[i][1] !== projectId) continue;
    if (String(data[i][2]).toLowerCase() !== user.email.toLowerCase()) continue;
    sheet.getRange(i + 1, 12).setValue(v);
    dataAuditLog(user.email, 'verdict', 'article', String(articleId), v || 'cleared');
    return { success: true, verdict: v };
  }
  return { success: false, error: 'not_found' };
}

/** Batch verdict save: applies up to SCRAPER_VERDICT_BATCH_MAX absolute
    verdict values in ONE request + ONE Articles-tab scan. Exists because
    Google's /exec front-end intermittently 404s individual requests (serving
    flap) — the client queues ratings locally and flushes them here, so one
    successful call saves everything pending. Idempotent: values are absolute
    ('up' | 'down' | '' to clear), so re-sending after a lost reply is safe. */
var SCRAPER_VERDICT_BATCH_MAX = 40;
function setArticleVerdicts(sessionToken, projectId, payload) {
  var user = validateSessionForData(sessionToken, 'setArticleVerdicts');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var items;
  try { items = JSON.parse(String(payload || '[]')) || []; } catch (vbErr) { items = null; }
  if (!items || !items.length) return { success: false, error: 'bad_payload' };
  items = items.slice(0, SCRAPER_VERDICT_BATCH_MAX);
  var wanted = {};
  for (var k = 0; k < items.length; k++) {
    var vv = String(items[k].verdict || '').toLowerCase();
    if (vv !== 'up' && vv !== 'down' && vv !== '') continue;  // skip malformed
    wanted[String(items[k].articleId || items[k].id || '')] = vv;
  }
  var sheet = ss.getSheetByName(SCRAPER_TABS.ARTICLES);
  var data = sheet.getDataRange().getValues();
  var saved = [], failed = [];
  for (var i = 1; i < data.length; i++) {
    var aid = String(data[i][0]);
    if (!(aid in wanted)) continue;
    if (data[i][1] !== projectId) continue;
    if (String(data[i][2]).toLowerCase() !== user.email.toLowerCase()) continue;
    sheet.getRange(i + 1, 12).setValue(wanted[aid]);
    saved.push(aid);
    delete wanted[aid];
  }
  for (var missId in wanted) { if (missId) failed.push(missId); }
  dataAuditLog(user.email, 'verdict-batch', 'project', String(projectId),
    saved.length + ' saved' + (failed.length ? ', ' + failed.length + ' not found' : ''));
  return { success: true, saved: saved, failed: failed };
}

/** Domains of a project's 👍-rated articles, most-liked first. A breadth
    signal: Compile adds per-domain Google News queries and Backfill adds a
    domainis: group for these, so fetching leans toward proven-good outlets.
    Computed live from the Articles tab — no stored state to migrate. */
function scLikedDomains_(ss, projectId, ownerEmail, max) {
  var data = ss.getSheetByName(SCRAPER_TABS.ARTICLES).getDataRange().getValues();
  var counts = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] !== projectId) continue;
    if (String(data[i][2]).toLowerCase() !== ownerEmail.toLowerCase()) continue;
    if (String(data[i][11]) !== 'up') continue;
    var m = String(data[i][3] || '').match(/^https?:\/\/([^\/]+)/i);
    if (!m) continue;
    var d = m[1].toLowerCase().replace(/^www\./, '');
    counts[d] = (counts[d] || 0) + 1;
  }
  return Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; })
    .slice(0, max || 3);
}

/** On-demand distillation for calibration mode: re-distills when the rating
    count changed since the stored profile, otherwise returns the stored one.
    Also returns liked domains so the UI can offer keyword AND source
    suggestions for one-tap adding to the project scope. */
function distillPreferences(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'distillPreferences');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);

  var data = ss.getSheetByName(SCRAPER_TABS.ARTICLES).getDataRange().getValues();
  var rated = { ups: [], downs: [] };
  var totalVerdicts = 0;
  for (var i = data.length - 1; i >= 1; i--) {  // newest first, same as analyzeArticles
    if (data[i][1] !== project.id) continue;
    if (String(data[i][2]).toLowerCase() !== user.email.toLowerCase()) continue;
    var vd = String(data[i][11] || '');
    if (vd !== 'up' && vd !== 'down') continue;
    totalVerdicts++;
    var side = vd === 'up' ? 'ups' : 'downs';
    if (rated[side].length < SCRAPER_DISTILL_TITLES_MAX) rated[side].push(String(data[i][4]));
  }
  var prefs = scGetPrefs_(ss, project.id);
  var distilled = 0;
  if (totalVerdicts >= SCRAPER_DISTILL_MIN_VERDICTS
      && (!prefs || prefs.verdictsUsed !== totalVerdicts)) {
    try {
      var d = scDistillFeedback_(ss, user, project, rated, totalVerdicts);
      scLogUsage_(ss, user.email, 1, 0);
      prefs = { note: d.note, keywords: d.keywords, verdictsUsed: totalVerdicts };
      distilled = totalVerdicts;
    } catch (dpErr) {
      return { success: false, error: scStr_(String((dpErr && dpErr.message) || 'ai_failed'), 60) };
    }
  }
  return { success: true, distilled: distilled,
           note: prefs ? prefs.note : '', keywords: prefs ? prefs.keywords : [],
           verdictsUsed: prefs ? prefs.verdictsUsed : 0, totalVerdicts: totalVerdicts,
           likedDomains: scLikedDomains_(ss, project.id, user.email, 6) };
}

/** "Re-score collection": clear Summary + Relevance Score for all of a
    project's articles so the normal chunked Analyze loop re-scores everything
    with the current learned profile. Verdicts are preserved. One batched
    write for the whole column range — never per-row setValue. */
function resetScores(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'resetScores');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);
  var sheet = ss.getSheetByName(SCRAPER_TABS.ARTICLES);
  var data = sheet.getDataRange().getValues();
  var vals = [];
  var cleared = 0;
  for (var i = 1; i < data.length; i++) {
    var mine = data[i][1] === project.id
      && String(data[i][2]).toLowerCase() === user.email.toLowerCase();
    if (mine && data[i][10] !== '') {
      vals.push(['', '']);
      cleared++;
    } else {
      vals.push([data[i][9], data[i][10]]);
    }
  }
  if (vals.length) sheet.getRange(2, 10, vals.length, 2).setValues(vals);
  dataAuditLog(user.email, 'rescore', 'project', project.id, cleared + ' scores cleared');
  return { success: true, cleared: cleared };
}

/** Score distribution + corpus health for the Stats panel — one sheet scan.
    Bands mirror the scoring rubric so the panel reads directly against it. */
function getScoreStats(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'getScoreStats');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);

  var data = ss.getSheetByName(SCRAPER_TABS.ARTICLES).getDataRange().getValues();
  var s = { total: 0, scored: 0, unscored: 0, withSnippet: 0, over20: 0,
            b0: 0, b10: 0, b30: 0, b50: 0, b80: 0,
            p0: 0, p10: 0, p30: 0, p50: 0, p80: 0,
            ups: 0, downs: 0, ratablePool: 0, archivable: 0, archived: 0 };
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] !== project.id) continue;
    if (String(data[i][2]).toLowerCase() !== user.email.toLowerCase()) continue;
    s.total++;
    var hasPrev = data[i][8] !== '';
    if (hasPrev) s.withSnippet++;
    var vd = String(data[i][11] || '');
    if (vd === 'up') s.ups++;
    else if (vd === 'down') s.downs++;
    if (data[i][10] === '') { s.unscored++; continue; }
    var sc = Number(data[i][10]);
    s.scored++;
    if (sc >= 20) s.over20++;
    if (sc < 10) { s.b0++; if (hasPrev) s.p0++; if (!vd) s.archivable++; }
    else if (sc < 30) { s.b10++; if (hasPrev) s.p10++; }
    else if (sc < 50) { s.b30++; if (hasPrev) s.p30++; }
    else if (sc < 80) { s.b50++; if (hasPrev) s.p50++; }
    else { s.b80++; if (hasPrev) s.p80++; }
    if (!vd && sc >= SCRAPER_CALIB_MIN_SCORE) s.ratablePool++;
  }
  var archSheet = ss.getSheetByName(SCRAPER_TABS.ARCHIVE);
  if (archSheet && archSheet.getLastRow() > 1) {
    var arch = archSheet.getRange(2, 2, archSheet.getLastRow() - 1, 2).getValues();
    for (var a = 0; a < arch.length; a++) {
      if (arch[a][0] === project.id
          && String(arch[a][1]).toLowerCase() === user.email.toLowerCase()) s.archived++;
    }
  }
  return { success: true, stats: s };
}

/** Archive the confidently-irrelevant articles: scored under 10 AND unrated.
    User-rated articles are never archived (they are the training data), and
    unscored articles are never archived (no judgment exists yet). Rows move
    to the ArticlesArchive tab — physically shrinking the Articles tab so
    every collection-wide pass (list, calibration, Enrich, Analyze, Re-score,
    Stats, briefs) gets faster and cheaper. Archived URLs stay in the dedupe
    set (scExistingArticleUrls_), so Compile/Backfill cannot re-import them.
    Single-pass (read → append to archive → rewrite Articles), guarded by a
    script lock; archive append is idempotent by Article ID so a rare
    mid-operation death cannot duplicate rows on retry. */
function archiveJunk(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'archiveJunk');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: false, error: 'busy' };
  try {
    var sheet = ss.getSheetByName(SCRAPER_TABS.ARTICLES);
    var arch = ss.getSheetByName(SCRAPER_TABS.ARCHIVE);
    var data = sheet.getDataRange().getValues();
    var keep = [], move = [];
    var now = new Date().toISOString();
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      var mine = r[1] === project.id
        && String(r[2]).toLowerCase() === user.email.toLowerCase();
      var unrated = !String(r[11] || '');
      var scored = r[10] !== '';
      if (mine && scored && unrated && Number(r[10]) < SCRAPER_CALIB_MIN_SCORE) {
        move.push(r.slice(0, 13).concat([now]));
      } else {
        keep.push(r);
      }
    }
    var remaining = 0;
    for (var k = 0; k < keep.length; k++) {
      if (keep[k][1] === project.id
          && String(keep[k][2]).toLowerCase() === user.email.toLowerCase()) remaining++;
    }
    if (!move.length) return { success: true, archived: 0, remaining: remaining };

    // Idempotent append: skip rows whose Article ID is already archived
    // (crash-recovery — a prior run may have appended but died before the
    // Articles rewrite below).
    var have = {};
    if (arch.getLastRow() > 1) {
      var ids = arch.getRange(2, 1, arch.getLastRow() - 1, 1).getValues();
      for (var d = 0; d < ids.length; d++) have[String(ids[d][0])] = true;
    }
    var fresh = move.filter(function(m) { return !have[String(m[0])]; });
    if (fresh.length) {
      arch.getRange(arch.getLastRow() + 1, 1, fresh.length, fresh[0].length).setValues(fresh);
    }

    // Rewrite the Articles tab: header + kept rows in one write.
    var all = [data[0]].concat(keep);
    sheet.clearContents();
    sheet.getRange(1, 1, all.length, data[0].length).setValues(all);

    // The Enrich cursor is a row index into the pre-archive layout — drop it
    // so the next Enrich re-scans cleanly. (Analyze/Compile/Backfill state
    // is not row-indexed and stays valid.)
    PropertiesService.getScriptProperties()
      .deleteProperty(SCRAPER_ENRICH_STATE_PREFIX + project.id);

    return { success: true, archived: move.length, remaining: remaining };
  } finally {
    lock.releaseLock();
  }
}

/** Publisher abstract from a news page's HTML head: og:description first,
    then twitter:description, then plain meta description — the same summary
    publishers write for search results and social link previews. Handles
    either attribute order, decodes common entities, caps at snippet length.
    Pure — unit-testable. */
function scExtractAbstract_(html) {
  var head = String(html || '').substring(0, 60000);
  function meta(re) {
    var m = head.match(re);
    return m ? m[1] : '';
  }
  var val = meta(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || meta(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
    || meta(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i)
    || meta(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || meta(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  val = String(val)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return scStr_(val, SCRAPER_ARTICLE_SNIPPET_MAX);
}

/** "Enrich": fill empty Snippet columns by fetching each article's page and
    harvesting the publisher's own abstract — no AI cost. Backfill articles
    arrive snippet-less (GDELT's list API has no body text), which forced
    title-only scoring. Chunked/resumable like Backfill: the row cursor is a
    safe resume point because the Articles sheet is append-only. Failures
    (paywalls, bot blocks) are counted but not marked, so a later Enrich run
    retries them. */
function enrichNow(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'enrichNow');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);
  return scEnrichChunk_(ss, user.email, project);
}

/** Session-free enrich core — one bounded chunk. */
function scEnrichChunk_(ss, email, project) {
  var props = PropertiesService.getScriptProperties();
  var key = SCRAPER_ENRICH_STATE_PREFIX + project.id;
  var state = null;
  try { state = JSON.parse(props.getProperty(key) || 'null'); } catch (enErr) { state = null; }
  var sheet = ss.getSheetByName(SCRAPER_TABS.ARTICLES);
  var data = sheet.getDataRange().getValues();
  if (!state || state.done || String(state.owner).toLowerCase() !== email.toLowerCase()) {
    var empty = 0;
    for (var c = 1; c < data.length; c++) {
      if (data[c][1] === project.id
          && String(data[c][2]).toLowerCase() === email.toLowerCase()
          && data[c][8] === '') empty++;
    }
    state = { owner: email, startedAt: new Date().toISOString(),
              cursor: 1, total: empty, enriched: 0, failed: 0, done: false };
  }

  // Poison-URL recovery. UrlFetchApp has no timeout, so a single hanging site
  // can carry the execution into Google's hard 6-minute kill — which is not a
  // catchable exception; the script just stops, and nothing after the fetch
  // runs. State is therefore persisted BEFORE every fetch with an `attempting`
  // row marker: a leftover marker here means the previous execution died
  // mid-fetch on that row, so count it unavailable and skip past it instead of
  // re-hanging on it forever (the stall this replaced re-tried the same batch
  // — and the same poison URL — indefinitely).
  if (state.attempting != null) {
    state.failed++;
    state.cursor = state.attempting + 1;
    state.attempting = null;
  }

  var t0 = Date.now();
  var fetches = 0;
  var i = state.cursor;
  for (; i < data.length; i++) {
    if (fetches >= SCRAPER_ENRICH_BATCH_FETCHES) break;
    if ((Date.now() - t0) >= SCRAPER_ENRICH_TIME_BUDGET_MS) break;
    if (data[i][1] !== project.id) continue;
    if (String(data[i][2]).toLowerCase() !== email.toLowerCase()) continue;
    if (data[i][8] !== '') continue;  // already has a snippet
    var url = String(data[i][3] || '');
    if (!/^https?:\/\//i.test(url)) { state.failed++; continue; }
    fetches++;
    state.attempting = i;
    state.cursor = i;
    props.setProperty(key, JSON.stringify(state));  // survives a mid-fetch kill
    try {
      var resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true, followRedirects: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      var abs = resp.getResponseCode() === 200 ? scExtractAbstract_(resp.getContentText()) : '';
      if (abs) {
        sheet.getRange(i + 1, 9).setValue(abs);
        state.enriched++;
      } else {
        state.failed++;
      }
    } catch (fErr) {
      state.failed++;
    }
    state.attempting = null;
  }
  state.cursor = i;
  state.done = i >= data.length;
  if (state.done) state.finishedAt = new Date().toISOString();
  props.setProperty(key, JSON.stringify(state));
  scLogUsage_(ss, email, 0, fetches);
  if (state.done) dataAuditLog(email, 'enrich', 'project', project.id,
    state.enriched + ' abstracts, ' + state.failed + ' unavailable');
  return { success: true, done: state.done, processed: state.enriched + state.failed,
           total: state.total, enriched: state.enriched, failed: state.failed };
}

// ── Rebuild Phase 1: Profiler-registry → Interests sync ─────────────────
// Daily upsert of Profiler's public company registry (plus the topic seeds)
// into the Interests tab. Driven by the hourly scheduler tick ahead of the
// pipeline pause gate — the sync spends no AI tokens and sends no email.

/** Fetch + parse the public Profiler company registry (GitHub Pages). */
function scFetchProfilerRegistry_() {
  var resp = UrlFetchApp.fetch(SCRAPER_PROFILER_REGISTRY_URL + '?_cb=' + Date.now(),
                               { muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() !== 200) throw new Error('registry_http_' + resp.getResponseCode());
  var parsed = JSON.parse(resp.getContentText());
  if (!parsed || !Array.isArray(parsed.companies)) throw new Error('registry_shape');
  return parsed;
}

/** Manual fallback: run from the Apps Script editor to force a sync now. */
function syncProfilerInterests() {
  Logger.log(JSON.stringify(scSyncInterests_(true)));
}

/** Core registry → Interests upsert. Idempotent; never deletes a row.
    - New active registry company → row appended, Enabled=TRUE, flagged
      "New coverage" (default-ON per the approved interest model).
    - Existing row → only registry-owned fields refresh (Label, Categories,
      Profiler Updated, Status, Last Synced). Developer-owned fields
      (Enabled, Aliases, Weight, Notes, Flag) are never overwritten — except
      a stale→active return, which re-flags as new coverage.
    - Registry-sourced company no longer active in the registry → Status
      "stale" + "Coverage ended" flag; the row (and its toggle) stays.
    - Topic seeds upsert the same way (insert-only; in-sheet edits win).
    A failed fetch records the error and leaves the tab untouched — a bad
    pull must never stale-flag real coverage. Throttled to ~once/day unless
    forced; serialized under the script lock. */
function scSyncInterests_(force, mineBudgetMs) {
  if (!SCRAPER_INTERESTS_SYNC_ENABLED) return { skipped: 'disabled' };
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('INTERESTS_LAST_SYNC')) || 0;
  if (!force && (Date.now() - last) < SCRAPER_INTERESTS_SYNC_MIN_MS) {
    return { skipped: 'fresh', lastSync: last };
  }
  var registry;
  try {
    registry = scFetchProfilerRegistry_();
  } catch (fetchErr) {
    try {
      props.setProperty('INTERESTS_LAST_SYNC_RESULT', JSON.stringify({
        ok: false, error: String((fetchErr && fetchErr.message) || fetchErr).slice(0, 200),
        at: Date.now() }));
    } catch (recErr) {}
    return { skipped: 'fetch_failed' };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { skipped: 'locked' };
  try {
    var ss = scraperSs_();
    ensureScraperTabs_(ss);
    var sheet = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
    var width = SCRAPER_TAB_HEADERS.Interests.length;
    var data = sheet.getDataRange().getValues();
    var byKey = {};  // Key → 0-based index into data
    for (var i = 1; i < data.length && i < SCRAPER_INTERESTS_MAX_ROWS; i++) {
      var k = String(data[i][0]).trim();
      if (k) byKey[k] = i;
    }
    var now = new Date();
    var added = 0, addedTopics = 0, updated = 0, stale = 0, dirty = false;
    var appendRows = [];
    var seen = {};
    var companies = registry.companies || [];
    for (var c = 0; c < companies.length; c++) {
      var co = companies[c];
      var slug = String(co.slug || '').trim();
      if (!slug || String(co.status || 'active') !== 'active') continue;
      seen[slug] = true;
      var name = String(co.name || slug);
      var cats = (co.categories || []).join(', ');
      var pUpdated = String(co.lastUpdated || '');
      if (byKey[slug] === undefined) {
        appendRows.push([slug, 'company', name, true, 'active',
          SCRAPER_INTEREST_FLAG_NEW, cats, name, 1, 'profiler-registry',
          pUpdated, now, now, '']);
        added++;
      } else {
        var r = data[byKey[slug]];
        var wasStale = String(r[4]) === 'stale';
        r[2] = name; r[4] = 'active'; r[6] = cats; r[10] = pUpdated; r[12] = now;
        if (wasStale) r[5] = SCRAPER_INTEREST_FLAG_NEW;
        updated++; dirty = true;
      }
    }
    // Stale pass — registry-sourced companies that left the active registry.
    for (var s = 1; s < data.length; s++) {
      var row = data[s];
      if (String(row[1]) !== 'company' || String(row[9]) !== 'profiler-registry') continue;
      var key = String(row[0]).trim();
      if (!key || seen[key] || String(row[4]) === 'stale') continue;
      row[4] = 'stale'; row[5] = SCRAPER_INTEREST_FLAG_STALE; row[12] = now;
      stale++; dirty = true;
    }
    // Topic seeds — insert-only; existing topic rows are developer territory.
    for (var t = 0; t < SCRAPER_INTEREST_TOPIC_SEEDS.length; t++) {
      var seed = SCRAPER_INTEREST_TOPIC_SEEDS[t];
      if (byKey[seed.key] !== undefined) continue;
      appendRows.push([seed.key, 'topic', seed.label, true, 'active',
        SCRAPER_INTEREST_FLAG_NEWTOPIC, '', seed.terms.join(', '), 1, seed.source,
        '', now, now, '']);
      addedTopics++;
    }
    // Source roster seeds (Phase 3, D1) — insert-only, default ON. The sheet
    // toggle is the on/off switch; SCRAPER_SOURCE_ROSTER stays the source of
    // truth for the outlet name + feed URL.
    for (var sr = 0; sr < SCRAPER_SOURCE_ROSTER.length; sr++) {
      var rsrc = SCRAPER_SOURCE_ROSTER[sr];
      if (byKey['src-' + rsrc.key] !== undefined) continue;
      appendRows.push(['src-' + rsrc.key, 'source', rsrc.name, true, 'active', '',
        'tier ' + rsrc.tier, '', 1, 'roster', '', now, now, '']);
    }
    // Retired-outlet marking (Phase 4 shakeout): a source row whose key left the
    // roster has no feed URL any more — the fetch loop iterates the roster, so
    // the row is inert. Mark it stale so the Sources panel shows the retirement
    // honestly. Row is kept (never deleted); re-adding the key to the roster
    // reactivates it below.
    var rosterKeys = {};
    SCRAPER_SOURCE_ROSTER.forEach(function(r0) { rosterKeys['src-' + r0.key] = true; });
    for (var dr = 1; dr < data.length; dr++) {
      if (String(data[dr][1]) !== 'source') continue;
      var srcKey = String(data[dr][0]);
      if (!rosterKeys[srcKey] && String(data[dr][4]) === 'active') {
        data[dr][4] = 'stale'; data[dr][5] = SCRAPER_SOURCE_FLAG_RETIRED; data[dr][12] = now;
        dirty = true;
      } else if (!rosterKeys[srcKey] && String(data[dr][5]) === SCRAPER_INTEREST_FLAG_STALE) {
        // Migration: the branch above only fires while a row is still `active`,
        // so outlets retired before this flag existed would keep the company
        // wording forever. Re-label them in place.
        data[dr][5] = SCRAPER_SOURCE_FLAG_RETIRED; data[dr][12] = now;
        dirty = true;
      } else if (rosterKeys[srcKey] && String(data[dr][4]) === 'stale') {
        data[dr][4] = 'active'; data[dr][5] = ''; data[dr][12] = now;
        dirty = true;
      }
    }
    // Segment seeds (developer feedback 2026-08-27) — default ON. New rows
    // insert with a seed-terms version marker in Notes. When code ships an
    // improved default vocabulary (a higher tv), the sync upgrades rows that
    // still carry the auto marker (or the pre-versioning empty Notes) —
    // Enabled/Weight are never touched. To keep custom terms permanently,
    // put anything else in the row's Notes (e.g. "custom") and the sync
    // will never rewrite that row's terms again.
    for (var sg = 0; sg < SCRAPER_SEGMENT_SEEDS.length; sg++) {
      var sgs = SCRAPER_SEGMENT_SEEDS[sg];
      var sgTv = sgs.tv || 1;
      var sgIdx = byKey[sgs.key];
      if (sgIdx === undefined) {
        appendRows.push([sgs.key, 'segment', sgs.label, true, 'active',
          SCRAPER_INTEREST_FLAG_NEWSEG, '', sgs.terms.join(', '), 1, 'segments',
          '', now, now, 'seed-terms-v' + sgTv]);
        continue;
      }
      var sgRow = data[sgIdx];
      var sgNotes = String(sgRow[13] || '').trim();
      var sgM = /^seed-terms-v(\d+)$/.exec(sgNotes);
      if (sgNotes === '' || (sgM && Number(sgM[1]) < sgTv)) {
        sgRow[7] = sgs.terms.join(', ');
        sgRow[13] = 'seed-terms-v' + sgTv;
        sgRow[12] = now;
        dirty = true;
      }
    }
    if (dirty && data.length > 1) {
      sheet.getRange(2, 1, data.length - 1, width).setValues(
        data.slice(1).map(function(dr) { return dr.slice(0, width); }));
    }
    if (appendRows.length) {
      sheet.getRange(data.length + 1, 1, appendRows.length, width).setValues(appendRows);
    }
    // T1b/T1c — mine a few Profiler dossiers each sync for alias terms and
    // per-company operating segments (add-only; never overwrites your edits).
    //
    // ORDER IS LOAD-BEARING: this MUST run after the bulk write-back above.
    // `data` is a snapshot taken at the top of the sync; mining does its own
    // read and writes Aliases + the `mined:` tag straight to the sheet. When
    // mining ran first, the `setValues(data...)` write-back immediately
    // overwrote those cells with the pre-mining snapshot — so every mined
    // alias and stamp was silently erased and coverage never left 0/88, no
    // matter how many times the sync was run. Running last also means mining
    // sees companies appended by THIS sync, which is exactly the priority
    // case (newly covered companies mined on the very next pass).
    var mineResult = null;
    try { mineResult = scMineDossiersStep_(ss, mineBudgetMs); } catch (mineErr) {}
    var summary = { ok: true, added: added, addedTopics: addedTopics, updated: updated,
                    stale: stale, total: data.length - 1 + appendRows.length, at: Date.now(),
                    // Reported so the caller can say what the pass actually did
                    // instead of leaving the developer to infer it from a tile.
                    mined: (mineResult && mineResult.mined) || 0,
                    minePending: (mineResult && mineResult.pending) || 0 };
    props.setProperty('INTERESTS_LAST_SYNC', String(Date.now()));
    props.setProperty('INTERESTS_LAST_SYNC_RESULT', JSON.stringify(summary));
    return summary;
  } finally {
    lock.releaseLock();
  }
}

/** Load the interest model from the Interests tab (per-execution cache).
    Companies and topics load only when enabled + active (they add signal).
    Segments load in BOTH states — a disabled segment must stay in the model
    so the rubric's segment gate can subtract with it. Lower-cased match
    terms are precomputed; company/topic rows include their Label as a term
    (segment labels are category names, not match terms). */
var _scInterestModel = {};
function scLoadInterestModel_(ss, edition) {
  // Cache per edition, not globally: two editions build in the same execution
  // during a multi-edition tick, and a single shared cache would hand the
  // second one the first one's tuning.
  var tuning = (edition && edition.tuning) || {};
  var cacheKey = (edition && edition.id) || '__global';
  if (_scInterestModel[cacheKey]) return _scInterestModel[cacheKey];
  var model = { companies: [], topics: [], segments: [] };
  var sheet = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length && i < SCRAPER_INTERESTS_MAX_ROWS; i++) {
      var r = data[i];
      var type = String(r[1]);
      var on = r[3] === true || String(r[3]).toLowerCase() === 'true';
      var active = String(r[4]) === 'active';
      var label = String(r[2] || '').trim();
      var terms = String(r[7] || '').split(/[\n,]/).map(function(t) {
        return t.trim().toLowerCase();
      }).filter(function(t) { return t.length >= 3; });
      // Per-edition override, when the edition stores one for this key. An
      // absent key inherits the global toggle — which is why an edition with
      // an empty map is indistinguishable from no tuning at all.
      var key = String(r[0]);
      if (Object.prototype.hasOwnProperty.call(tuning, key)) on = tuning[key] === true;
      if (type === 'segment') {
        if (!active) continue;
        model.segments.push({ key: key, label: label, terms: terms, enabled: on,
                              parent: scSegmentParent_(key) });
        continue;
      }
      if (type !== 'company' && type !== 'topic') continue;
      if (!on || !active) continue;
      if (label.length >= 3 && terms.indexOf(label.toLowerCase()) === -1) {
        terms.push(label.toLowerCase());
      }
      var entry = { key: key, label: label, terms: terms,
                    weight: Math.max(0, Math.min(3, Number(r[8]) || 1)),
                    profilerUpdated: String(r[10] || '') };
      (type === 'company' ? model.companies : model.topics).push(entry);
    }
  }
  _scInterestModel[cacheKey] = model;
  return model;
}

/** True when any term hits the text on a word boundary (protects short
    company names like ABB/BYD from substring false-positives). */
function scTermsHit_(text, terms) {
  for (var i = 0; i < terms.length; i++) {
    var t = terms[i];
    if (!t) continue;
    var idx = text.indexOf(t);
    while (idx !== -1) {
      var before = idx === 0 ? '' : text.charAt(idx - 1);
      var after = idx + t.length >= text.length ? '' : text.charAt(idx + t.length);
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
      idx = text.indexOf(t, idx + 1);
    }
  }
  return false;
}

/** Four-signal relevance rubric (decision D3) — deterministic scaffolding.
    company (0-40): strongest matched company (developer Weight scales it),
      +15% of the band per extra matched company, capped at the band.
    topic (0-25): same shape over topic interests (+20% per extra match).
    emphasis (0-15): Profiler's emphasis on the matched companies — 0.3 base
      for being covered at all, +0.5 × dossier recency (linear falloff over
      SCRAPER_RUBRIC_RECENT_DAYS), +0.2 when the developer boosted Weight.
    substance (0-20): snippet-quality heuristics (length, figures, quotes,
      hard-news verbs) — the Phase 3 AI pass refines this signal.
    Returns { score, signals, matchedCompanies, matchedTopics }. */
/** Classify an article's geography and return the multiplier its score earns.

    Returns { factor, tier, regions, usLinked }. `tier` is one of:
      'unmarked'  no country evidence either way — factor 1.0, the safe default
      'us'        US markers and no foreign ones — factor 1.0
      'tier2'     China / Mexico / Chile / Canada
      'other'     everywhere else

    When both tiers appear, the one with MORE distinct regions matched wins, and
    a tie goes to the harsher tier. A Latin America round-up naming Chile and
    Mexico alongside Brazil and Argentina is a regional piece, not a Chile
    story, and should be treated as such. */
function scGeoClassify_(title, snippet) {
  var titleTxt = String(title || '').toLowerCase();
  var text = (titleTxt + ' ' + String(snippet || '')).toLowerCase();
  function regionsHit(group) {
    var out = [];
    for (var k in group) {
      if (Object.prototype.hasOwnProperty.call(group, k) && scTermsHit_(text, group[k])) out.push(k);
    }
    return out;
  }
  // "America" on its own is a US marker; "Latin America", "South America" and
  // "Central America" are the opposite. Strip the qualified forms before
  // matching rather than trying to express that in the term list — a Latin
  // America storage round-up was scoring as US-linked, which halved its
  // penalty. ("North America" is left in as a US marker: it includes the US.)
  var deQualified = text.replace(/\b(latin|south|central)\s+americ(an?s?)\b/g, ' ');
  var usLinked = scTermsHit_(deQualified, SCRAPER_GEO_US_TERMS)
              || /\bamericans?\b/.test(deQualified);
  var t2 = regionsHit(SCRAPER_GEO_TIER2);
  var ot = regionsHit(SCRAPER_GEO_OTHER);

  if (!t2.length && !ot.length) {
    // No foreign evidence. Unmarked and US-marked both score full — the point
    // of the rule is to devalue foreign subjects, not to demand US paperwork.
    return { factor: 1, tier: usLinked ? 'us' : 'unmarked', regions: [], usLinked: usLinked };
  }
  var tier = ot.length >= t2.length ? 'other' : 'tier2';
  var regions = tier === 'other' ? ot : t2;
  var factor = tier === 'tier2'
    ? (usLinked ? SCRAPER_GEO_FACTORS.tier2Linked : SCRAPER_GEO_FACTORS.tier2)
    : (usLinked ? SCRAPER_GEO_FACTORS.otherLinked : SCRAPER_GEO_FACTORS.other);
  return { factor: factor, tier: tier, regions: regions.concat(tier === 'other' ? t2 : ot),
           usLinked: usLinked };
}

function scRubricScore_(title, snippet, model, ctx) {
  var text = (String(title || '') + ' ' + String(snippet || '')).toLowerCase();
  var w = SCRAPER_RUBRIC_WEIGHTS;
  ctx = ctx || {};
  var matchedCompanies = [], bestCoWeight = 0;
  for (var i = 0; i < model.companies.length; i++) {
    var co = model.companies[i];
    if (scTermsHit_(text, co.terms)) {
      matchedCompanies.push(co.label);
      if (co.weight > bestCoWeight) bestCoWeight = co.weight;
    }
  }
  var company = 0;
  if (matchedCompanies.length) {
    company = w.company * Math.min(1, bestCoWeight);
    company = Math.min(w.company, company + w.company * 0.15 * (matchedCompanies.length - 1));
  }
  // Engagement boost (T1a): reward companies you actually click through to.
  var clickBoost = 0, cb = ctx.clickBoosts;
  if (cb) {
    matchedCompanies.forEach(function(l){ clickBoost = Math.max(clickBoost, cb.companies[l.toLowerCase()] || 0); });
  }
  var matchedTopics = [], bestTopicWeight = 0;
  for (var j = 0; j < model.topics.length; j++) {
    var tp = model.topics[j];
    if (scTermsHit_(text, tp.terms)) {
      matchedTopics.push(tp.label);
      if (tp.weight > bestTopicWeight) bestTopicWeight = tp.weight;
    }
  }
  var topic = 0;
  if (matchedTopics.length) {
    topic = w.topic * Math.min(1, bestTopicWeight);
    topic = Math.min(w.topic, topic + w.topic * 0.2 * (matchedTopics.length - 1));
  }
  if (cb) {
    matchedTopics.forEach(function(l){ clickBoost = Math.max(clickBoost, cb.topics[l.toLowerCase()] || 0); });
  }
  // Segment gate (developer feedback 2026-08-27): classify the article
  // against ALL segment lenses. If its only segment hits are toggled-off
  // segments, the company + emphasis signals are zeroed — a covered
  // company's off-segment news (e.g. an automaker's vehicle recall when
  // "EVs & automotive" is off) no longer rides the company match over the
  // relevance bar. Enabled hits, or no segment hits at all, change nothing.
  var matchedSegments = [], excludedSegments = [], offParents = {}, onHits = [];
  var segs = model.segments || [];
  for (var g = 0; g < segs.length; g++) {
    if (!scTermsHit_(text, segs[g].terms)) continue;
    if (segs[g].enabled) { matchedSegments.push(segs[g].label); onHits.push(segs[g]); }
    else {
      excludedSegments.push(segs[g].label);
      if (segs[g].parent) offParents[segs[g].parent] = true;
    }
  }
  // SPECIFICITY BEATS BREADTH. A disabled child used to be out-voted by its own
  // broader parent: "Residential storage" off still let a residential product
  // story through because the umbrella "BESS & grid-scale storage" matched the
  // same text. A parent whose disabled CHILD also matched is not independent
  // evidence that the article is on-segment, so it does not count as an ON hit.
  var independentOn = 0;
  for (var oh = 0; oh < onHits.length; oh++) {
    if (!offParents[onHits[oh].key]) independentOn++;
  }
  var gated = excludedSegments.length > 0 && independentOn === 0;
  // Per-company segment tightening (T1c): if every covered company this
  // article matched operates ONLY in currently-disabled segments (per its
  // mined dossier), gate it even when the article itself named no segment.
  var cs = ctx.companySegments;
  if (!gated && cs && matchedCompanies.length && ctx.disabledSegments) {
    var allOff = true;
    for (var mc = 0; mc < matchedCompanies.length; mc++) {
      var opSegs = cs[matchedCompanies[mc].toLowerCase()];
      if (!opSegs) { allOff = false; break; }              // unknown → don't gate
      var anyOn = false;
      for (var os in opSegs) { if (opSegs.hasOwnProperty(os) && !ctx.disabledSegments[os]) { anyOn = true; break; } }
      if (anyOn) { allOff = false; break; }
    }
    if (allOff) gated = true;
  }
  // Zero the TOPIC band too, not just company. Company-only gating was a no-op
  // for an article that matches no covered company — which is exactly how a
  // residential product from an uncovered vendor rode five loosely-matched
  // topics past the relevance bar and became the lead. Substance is left
  // intact, which alone cannot clear the bar.
  if (gated) { company = 0; topic = 0; }
  var emphasis = 0;
  if (matchedCompanies.length && !gated) {
    var freshest = 0;
    for (var k = 0; k < model.companies.length; k++) {
      var e = model.companies[k];
      if (matchedCompanies.indexOf(e.label) === -1 || !e.profilerUpdated) continue;
      var ts = new Date(e.profilerUpdated).getTime();
      if (ts && ts > freshest) freshest = ts;
    }
    var recency = freshest ?
      Math.max(0, 1 - (Date.now() - freshest) / (SCRAPER_RUBRIC_RECENT_DAYS * 86400000)) : 0;
    emphasis = w.emphasis * Math.min(1, 0.3 + 0.5 * recency + (bestCoWeight > 1 ? 0.2 : 0));
  }
  var substance = 0;
  var body = String(snippet || '');
  if (body.length >= 400) substance += 8;
  else if (body.length >= 150) substance += 5;
  else if (body.length >= 60) substance += 2;
  if (/[\$€£]\s?\d|\d+(\.\d+)?\s?(mw|gw|mwh|gwh|percent|%)|\b\d{4}\b/i.test(body)) substance += 6;
  if (/["“”].{10,}["“”]/.test(body)) substance += 3;
  if (/\b(announced|filed|signed|awarded|commissioned|acquired|ordered)\b/i.test(body)) substance += 3;
  substance = Math.min(w.substance, substance);
  var round1 = function(n) { return Math.round(n * 10) / 10; };
  if (gated) clickBoost = 0;
  var corrob = Math.min(SCRAPER_CORROB_CAP, Number(ctx.corrob) || 0);

  // ── Evidence gate (developer 2026-08-28: "strengthen the criteria to
  //    increase accuracy on which articles are relevant") ──────────────────
  //
  // company and topic are the only two signals that say an article is ABOUT
  // something covered. emphasis, substance, corroboration and engagement all
  // describe an article that has already been established as relevant —
  // substance in particular scores writing (length, a figure, a quotation, an
  // action verb), which a well-written piece about anything at all will earn.
  //
  // Summed flat, they let an article matching ZERO covered companies reach
  // topic 25 + substance 20 + corroboration 6 = 51, one point over the old
  // bar of 50. That is the leak: an article that merely brushed two topics and
  // was written well cleared the same bar as one naming a covered company.
  //
  // So the supporting signals are capped in PROPORTION to the evidence already
  // earned. They can amplify a real match; they can no longer manufacture one.
  // The topic-only article above tops out at 25 + 15 = 40 and is correctly
  // excluded. A company match (40) plus a topic (25) gives an evidence base of
  // 65 and a support allowance of 39 — the cap does still bind there, by a few
  // points, but at that level the total saturates near 100 either way, so it
  // changes the score of a clearly relevant article by nothing that matters.
  // An enabled SEGMENT match is evidence too, and it was previously only ever
  // used to gate. Without it the gate below reduces to "name a covered company
  // or you are out", which would drop genuinely relevant market and policy
  // stories — a FERC interconnection order naming no vendor is exactly the kind
  // of piece this digest exists to surface. `independentOn` is used rather than
  // matchedSegments.length so a segment that only matched via its own disabled
  // child still counts for nothing.
  // Binary on purpose. "This article is about one of your segments" is either
  // true or it is not; matching a second segment does not make it more true,
  // and scaling the first match down below full value left a policy story
  // short of the bar for no principled reason.
  var segment = (!gated && independentOn) ? SCRAPER_RUBRIC_SEGMENT_EVIDENCE : 0;
  var evidence = company + topic + segment;
  var supportCap = evidence * SCRAPER_SUPPORT_RATIO;
  var support = Math.min(emphasis + substance + clickBoost + corrob, supportCap);
  var raw = Math.min(100, evidence + support);
  // Geography multiplies the finished judgement rather than adding a band of
  // its own. An additive penalty would leave a strong company match on a
  // foreign story above the bar, which is exactly the case the developer
  // objected to (an Australian transmission story taking the lead).
  var geo = scGeoClassify_(title, snippet);
  return {
    score: Math.round(Math.min(100, raw * geo.factor)),
    signals: { company: round1(company), topic: round1(topic),
               emphasis: round1(emphasis), substance: substance,
               engagement: round1(clickBoost), corroboration: round1(corrob),
               geo: geo.factor },
    evidence: round1(evidence), support: round1(support), segment: round1(segment),
    geoFactorApplied: geo.factor,
    supportCapped: (emphasis + substance + clickBoost + corrob) > supportCap + 0.05,
    matchedCompanies: matchedCompanies, matchedTopics: matchedTopics,
    matchedSegments: matchedSegments, excludedSegments: excludedSegments,
    geoTier: geo.tier, geoRegions: geo.regions, geoUsLinked: geo.usLinked,
    gated: gated
  };
}

/** List the interest model (Phase 2 panel data source). */
function listInterests(sessionToken) {
  validateSessionForData(sessionToken, 'listInterests');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
  var data = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length && i < SCRAPER_INTERESTS_MAX_ROWS; i++) {
    var r = data[i];
    if (!String(r[0]).trim()) continue;
    items.push({
      key: String(r[0]), type: String(r[1]), label: String(r[2]),
      enabled: r[3] === true || String(r[3]).toLowerCase() === 'true',
      status: String(r[4]), flag: String(r[5]), categories: String(r[6]),
      aliases: String(r[7]), weight: Number(r[8]) || 1, source: String(r[9]),
      profilerUpdated: String(r[10]),
      firstSeen: r[11] ? new Date(r[11]).toISOString() : '',
      lastSynced: r[12] ? new Date(r[12]).toISOString() : '',
      notes: String(r[13] || '')
    });
    var ret = SCRAPER_RETIRED_SOURCES[String(r[0])];
    if (ret && String(r[4]) === 'stale') {
      // An outlet whose site is gone is not a filter the developer can act on,
      // so it is dropped from the payload rather than dimmed in the list. The
      // sheet row is deliberately left in place — nothing is destroyed, and
      // re-adding the key to the roster still reactivates it.
      if (ret.status === 'offline') { items.pop(); continue; }
      items[items.length - 1].retiredLabel = ret.label;
      items[items.length - 1].retiredNote = ret.detail;
      items[items.length - 1].retiredStatus = ret.status || 'blocked';
    }
  }
  var lastSync = null;
  try {
    lastSync = JSON.parse(PropertiesService.getScriptProperties()
      .getProperty('INTERESTS_LAST_SYNC_RESULT') || 'null');
  } catch (lsErr) {}
  return { success: true, interests: items, lastSync: lastSync };
}

/** Toggle one interest on/off. Clears its attention flag — toggling is the
    developer acknowledging the "New coverage"/"New topic" notice. */
function setInterestEnabled(sessionToken, key, enabled) {
  validateSessionForData(sessionToken, 'setInterestEnabled');
  var k = scStr_(key, 120);
  if (!k) return { success: false, error: 'key_required' };
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() !== k) continue;
    var on = scParamBool_(enabled);
    sheet.getRange(i + 1, 4).setValue(on);
    if (String(data[i][5])) sheet.getRange(i + 1, 6).setValue('');
    return { success: true, key: k, enabled: on };
  }
  return { success: false, error: 'not_found' };
}

/** Force a registry sync now (Phase 2 "Sync now" button). */
function syncInterestsNow(sessionToken) {
  validateSessionForData(sessionToken, 'syncInterestsNow');
  return { success: true,
           result: scSyncInterests_(true, SCRAPER_DOSSIER_MINE_BUDGET_INTERACTIVE_MS) };
}

/** Score an ad-hoc title/snippet against the current interest model — the
    rubric's test surface until Phase 3 wires it into the digest engine. */
function rubricPreview(sessionToken, payloadJson) {
  validateSessionForData(sessionToken, 'rubricPreview');
  var p;
  try { p = JSON.parse(String(payloadJson || '{}')); }
  catch (parseErr) { return { success: false, error: 'bad_payload' }; }
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  // Score against the SAME model the build uses. This loaded the global
  // interest model while every build loads the edition's materialised one, so
  // the tester and the digest could legitimately disagree — and the tester is
  // the tool the developer reaches for to ask why the digest did what it did.
  // A diagnostic that answers a different question than the one being asked is
  // worse than no diagnostic.
  var edId = scStr_(p.editionId || '', 40) || SCRAPER_EDITION_DEFAULT.id;
  var edition = null;
  try { edition = scEditionById_(ss, edId); } catch (edErr) {}
  var model = scLoadInterestModel_(ss, edition);
  var out = scRubricScore_(scStr_(p.title, 300), scStr_(p.snippet, 2000), model);
  out.success = true;
  out.edition = edId;
  out.editionName = edition ? edition.name : edId;
  out.threshold = SCRAPER_RELEVANT_THRESHOLD;
  out.passes = out.score >= SCRAPER_RELEVANT_THRESHOLD;
  out.modelCounts = { companies: model.companies.length, topics: model.topics.length,
                      segments: (model.segments || []).length };
  return out;
}

/** The intake columns the score report needs, for ONE edition.

    digestScoreReport originally called scDigestItems_, and that hung the app:
    that helper does `intake.getDataRange().getValues()` — every row of every
    edition ever built, all twelve columns, including the three largest
    (snippet, summary, analysis). It is written for the build pipeline, where
    it runs inside a budgeted step that resumes on a continuation trigger. A
    request a person is waiting on has neither, so it simply sat there while
    the transport aborted a POST at 90s and silently retried it as a GET.

    The lesson was already in this file twice — listDigests: "Two narrow reads
    instead of one wide one", and scHandleHeldBack_: "Column 7 only — the
    rendered HTML in column 8 is the largest cell in the sheet and this route
    never needs it". Reusing the wide helper walked straight back into it.

    So: one narrow pass over column 1 to find where this edition's rows are,
    then the five columns the report actually reads, over that span only. The
    id column is still read in full — rows for an edition are not guaranteed
    contiguous — but one column of ids carries no large cells. */
function scDigestScoreRows_(ss, digestId) {
  var intake = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE);
  var n = intake ? intake.getLastRow() - 1 : 0;
  if (n < 1) return [];
  var ids = intake.getRange(2, 1, n, 1).getValues();
  var first = -1, last = -1;
  for (var i = 0; i < n; i++) {
    if (String(ids[i][0]) !== digestId) continue;
    if (first === -1) first = i;
    last = i;
  }
  if (first === -1) return [];
  var span = last - first + 1;
  var base = first + 2;                                  // sheet row of `first`
  var titles = intake.getRange(base, 3, span, 2).getValues();   // title, source
  var scores = intake.getRange(base, 7, span, 2).getValues();   // score, signals
  var flags  = intake.getRange(base, 11, span, 1).getValues();  // backstop
  var out = [];
  for (var j = 0; j < span; j++) {
    if (String(ids[first + j][0]) !== digestId) continue;       // skip interleaved rows
    var sig = {};
    try { sig = JSON.parse(scores[j][1] || '{}'); } catch (pe) {}
    out.push({ title: String(titles[j][0] || ''), source: String(titles[j][1] || ''),
      score: Number(scores[j][0]) || 0,
      matchedCompanies: sig.mc || [], matchedTopics: sig.mt || [],
      evidence: Number(sig.ev) || 0, support: Number(sig.sup) || 0,
      geoFactor: sig.gf == null ? 1 : Number(sig.gf),
      backstop: String(flags[j][0]) === 'yes' });
  }
  return out;
}

/** Why was this edition thin?

    The per-article tester (rubricPreview) answers "why did THIS story fail",
    which only helps once you already suspect a story. It cannot answer the
    question the developer actually asks, which is about an edition as a whole:
    twelve relevant yesterday, three today, and nothing to look at but the two
    numbers. Guessing from those two numbers is what this replaces.

    Reads the run's own intake rows, so it reports what the build actually saw:
    how much came in, where the scores landed, how many missed the bar and by
    how little, what the geographic multiplier did, and how much of the intake
    came from the backstop rather than the roster. Near-misses are the useful
    part — a dozen items sitting at 50-54 says the bar is the constraint, while
    an empty band says the fetch was. */
function digestScoreReport(sessionToken, digestId) {
  validateSessionForData(sessionToken, 'digestScoreReport');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var want = scStr_(digestId || '', 60);
  var sheet = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var n = sheet ? sheet.getLastRow() - 1 : 0;
  // No id given → the most recently generated edition.
  if (!want && n > 0) {
    want = String(sheet.getRange(n + 1, 1).getValue() || '');
  }
  if (!want) return { success: false, error: 'no_edition' };
  // scDigestScoreRows_, not scDigestItems_ — see that function for why reusing
  // the build pipeline's wide reader hung this request.
  var items = scDigestScoreRows_(ss, want);
  if (!items.length) return { success: false, error: 'no_intake', id: want };

  var T = SCRAPER_RELEVANT_THRESHOLD;
  var bands = { '0-24': 0, '25-39': 0, '40-49': 0, '50-54': 0, '55-69': 0, '70-100': 0 };
  var nearMiss = [], backstopCount = 0, geoPenalised = 0, relevant = 0;
  items.forEach(function(it) {
    var sc = Number(it.score) || 0;
    bands[sc < 25 ? '0-24' : sc < 40 ? '25-39' : sc < 50 ? '40-49'
          : sc < 55 ? '50-54' : sc < 70 ? '55-69' : '70-100']++;
    if (it.backstop) backstopCount++;
    if ((it.geoFactor == null ? 1 : Number(it.geoFactor)) < 1) geoPenalised++;
    if (sc >= T) { relevant++; return; }
    // Within 10 of the bar: the items a small change would have admitted.
    if (sc >= T - 10) {
      nearMiss.push({ title: scStr_(it.title, 140), source: it.source, score: sc,
                      short: Math.round((T - sc) * 10) / 10,
                      geoFactor: it.geoFactor == null ? 1 : Number(it.geoFactor),
                      evidence: it.evidence, support: it.support,
                      companies: (it.matchedCompanies || []).slice(0, 4),
                      topics: (it.matchedTopics || []).slice(0, 4),
                      backstop: !!it.backstop });
    }
  });
  nearMiss.sort(function(a, b) { return b.score - a.score; });
  return {
    success: true, id: want, threshold: T,
    intake: items.length, relevant: relevant,
    fromBackstop: backstopCount, fromRoster: items.length - backstopCount,
    geoPenalised: geoPenalised, bands: bands,
    nearMiss: nearMiss.slice(0, 20),
    // The one-line read, so the answer does not depend on interpreting bands.
    verdict: relevant >= 10 ? 'healthy'
      : (bands['50-54'] + bands['40-49']) >= 8 ? 'bar-bound'
      : items.length < 60 ? 'intake-bound' : 'thin-day'
  };
}

// ── Rebuild Phase 3: digest engine ──────────────────────────────────────
// Chunked, resumable pipeline: start → fetch (roster feeds) → backstop
// (Google News company queries, D2) → summarize (AI key points, with a
// deterministic snippet fallback when no AI key is configured) → render
// (Night Ink HTML + section JSON into the Digests tab). Intake items live in
// the DigestIntake tab so every step is sheet-backed and inspectable.

/** ET clock facts for the digest scheduler (pure given a Date). */
function scDigestClock_(now) {
  var d = now || new Date();
  var iso = Number(Utilities.formatDate(d, SCRAPER_DIGEST_TZ, 'u'));   // 1=Mon … 7=Sun
  return {
    isoDay: iso,
    dom: Number(Utilities.formatDate(d, SCRAPER_DIGEST_TZ, 'd')),
    hour: Number(Utilities.formatDate(d, SCRAPER_DIGEST_TZ, 'H')),
    date: Utilities.formatDate(d, SCRAPER_DIGEST_TZ, 'yyyy-MM-dd'),
    windowH: iso === 1 ? 72 : SCRAPER_DIGEST_WINDOW_H   // Monday edition covers the weekend
  };
}

/** Section for a scored intake item — pure, node-testable.
    incidents: safety/community topic match wins (even with a company match);
    companies: any covered-company match; market: everything else. */
function scDigestSectionFor_(item) {
  var topics = item.matchedTopics || [];
  for (var i = 0; i < topics.length; i++) {
    if (/incident|opposition|fire|safety|siting/i.test(String(topics[i]))) return 'incidents';
  }
  if ((item.matchedCompanies || []).length) return 'companies';
  return 'market';
}

/** Wrap concrete figures in an already-HTML-escaped string with the Night
    Ink amber bold — pure, node-testable. */
/** Bold the figures in a passage.

    `color` defaults to the headline ink rather than amber. Amber now means one
    thing and one thing only — analysis, as the footer key states — so a figure
    inside a reported summary can no longer be amber without making that key a
    lie. Figures keep their emphasis through weight and a brighter ink instead.
    Inside the analysis the caller passes 'inherit', so a figure there bolds
    within the amber run rather than breaking out of it. */
function scNiBoldFigures_(escaped, color) {
  // Figures are bolded AND coloured. The colour used to be the headline ink,
  // which read as ordinary emphasis and said nothing; green gives the numbers
  // a meaning of their own without competing with the amber that means
  // analysis. Distinguished by hue rather than brightness — both sit near the
  // same luminance, and weight is already carrying the emphasis. Measured
  // 10.5:1 against the edition ground, comfortably past WCAG AAA.
  // Callers inside the analysis pass 'inherit', so a figure there stays amber
  // and cannot break out of the run the footer key describes.
  var c = color || '#4ade80';
  return String(escaped || '').replace(
    /((?:[\$€£]\s?)?\d[\d,]*(?:\.\d+)?\s?(?:(?:GWh?|MWh?|kWh?|GW|MW|kW|billion|million|bn)\b|%)|[\$€£]\s?\d[\d,]*(?:\.\d+)?)/g,
    '<b style="color:' + c + ';">$1</b>');
}

/** Enabled-state map for roster sources from the Interests tab
    ('src-<key>' rows). A source with no row yet defaults to ON. */
function scEnabledSources_(ss) {
  var enabled = {};
  SCRAPER_SOURCE_ROSTER.forEach(function(s) { enabled[s.key] = true; });
  var sheet = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
  if (!sheet) return enabled;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== 'source') continue;
    var key = String(data[i][0]).replace(/^src-/, '');
    if (enabled[key] === undefined) continue;
    enabled[key] = data[i][3] === true || String(data[i][3]).toLowerCase() === 'true';
  }
  return enabled;
}

/** In-flight build state, per edition.

    This used to be ONE global Script Property. The scheduler would be three or
    four steps into the morning edition, the developer would press "Run intake
    now" for BESS, and scDigestStart_ overwrote the slot wholesale — srcCursor
    back to 0 — throwing away the scheduled build's progress. With an hourly
    trigger that cost hours, and on a day of active use the scheduled build
    could be reset repeatedly and never finish. A slot per edition means a
    manual build and a scheduled one no longer collide. */
function scDigestStateKey_(editionId) {
  return SCRAPER_DIGEST_STATE_KEY + '_' + String(editionId || SCRAPER_EDITION_DEFAULT.id);
}
function scDigestState_(editionId) {
  var props = PropertiesService.getScriptProperties();
  try {
    scDigestMigrateLegacyState_(props);
    if (editionId) {
      return JSON.parse(props.getProperty(scDigestStateKey_(editionId)) || 'null');
    }
    // No edition named — "is anything running?". Prefer a slot still mid-build;
    // otherwise report the most recently started one so a finished run still
    // has a final state to report.
    var eds = [SCRAPER_EDITION_DEFAULT.id];
    SCRAPER_EDITION_SEEDS.forEach(function(sd) { eds.push(sd.id); });
    var newest = null;
    for (var i = 0; i < eds.length; i++) {
      var st = JSON.parse(props.getProperty(scDigestStateKey_(eds[i])) || 'null');
      if (!st) continue;
      if (st.phase !== 'done') return st;
      if (!newest || (st.startedAt || 0) > (newest.startedAt || 0)) newest = st;
    }
    return newest;
  } catch (e) { return null; }
}

/** Move the pre-per-edition single state property into its own slot, once.

    The legacy key is never written any more, so leaving it readable meant a
    stale state from before that change could still be picked up and RESUMED —
    which is how a completed build was re-rendered on every poll. Migrating it
    into the slot it belongs to and deleting it removes the possibility. */
function scDigestMigrateLegacyState_(props) {
  var raw = props.getProperty(SCRAPER_DIGEST_STATE_KEY);
  if (!raw) return;
  props.deleteProperty(SCRAPER_DIGEST_STATE_KEY);
  try {
    var st = JSON.parse(raw);
    if (!st || !st.editionId) return;
    var key = scDigestStateKey_(st.editionId);
    // Never overwrite a live per-edition slot with the older single one.
    if (!props.getProperty(key)) props.setProperty(key, raw);
  } catch (e) {}
}
function scDigestSaveState_(state) {
  PropertiesService.getScriptProperties()
    .setProperty(scDigestStateKey_(state && state.editionId), JSON.stringify(state));
}

/** Existing intake URLs for the current digest (dedupe set). Reads the two
    columns it needs — this runs on every fetch step, and the tab now holds
    every edition rather than just the run in progress. */
function scDigestIntakeUrls_(sheet, digestId) {
  var seen = {};
  var n = sheet.getLastRow() - 1;
  if (n < 1) return seen;
  var data = sheet.getRange(2, 1, n, 2).getValues();
  for (var i = 0; i < n; i++) {
    if (String(data[i][0]) === digestId) seen[String(data[i][1])] = true;
  }
  return seen;
}

/** Drop intake rows whose digest no longer has a Digests row — exactly what an
    aborted run, or a retention trim, leaves behind. Completed editions keep
    their rows, which is what makes their links resolvable for as long as the
    edition itself exists. Deletes contiguous blocks rather than row-by-row so
    a large first cleanup does not burn the execution budget. */
function scDigestPruneOrphanIntake_(ss) {
  var intake = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE);
  var n = intake.getLastRow() - 1;
  if (n < 1) return 0;
  var live = {};
  var digests = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var dn = digests.getLastRow() - 1;
  if (dn > 0) {
    // Newest-last in the sheet, so the most recent editions are the tail.
    var start = Math.max(0, dn - SCRAPER_INTAKE_KEEP_EDITIONS);
    digests.getRange(2 + start, 1, dn - start, 1).getValues()
      .forEach(function(r) { live[String(r[0])] = true; });
  }
  var ids = intake.getRange(2, 1, n, 1).getValues();
  var removed = 0, i = n - 1;
  while (i >= 0) {
    if (live[String(ids[i][0])]) { i--; continue; }
    var end = i;
    while (i >= 0 && !live[String(ids[i][0])]) i--;
    intake.deleteRows(i + 3, end - i);   // sheet rows (i+3)…(end+2)
    removed += end - i;
  }
  return removed;
}

/** Start a fresh run: clear stale intake and initialize state.

    This used to delete EVERY intake row. That was the bug behind "all the
    hyperlinks are broken": scHandleClickRedirect_ resolves a link's real
    destination from the intake rows of the digest it belongs to, so the moment
    the next edition was built, every article link in every earlier edition —
    in the app AND in already-delivered email — stopped resolving and fell back
    to EMBED_PAGE_URL, landing the reader on the app instead of the article.
    Three other features read the same rows and were silently reduced to the
    latest run only: Archive search, the company timeline, and source stats.
    Only orphans are cleared now. */
function scDigestStart_(ss, editionId) {
  var intake = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE);
  scDigestPruneOrphanIntake_(ss);
  var clock = scDigestClock_(new Date());
  var ed = scEditionById_(ss, editionId || SCRAPER_EDITION_DEFAULT.id);
  var state = {
    id: 'dg-' + clock.date + '-' + Utilities.getUuid().slice(0, 8),
    editionId: ed.id, editionName: ed.name,
    date: clock.date, windowH: scEditionWindowH_(ed, clock),
    phase: 'fetch', srcCursor: 0, bsCursor: 0, bsList: null,
    fetched: 0, kept: 0, startedAt: Date.now()
  };
  scDigestSaveState_(state);
  return state;
}

var _scRunCtx = null;
/** Scoring context shared across a run's steps: engagement boosts, mined
    per-company operating segments, and the set of currently-disabled
    segment labels. Memoized per execution (each chunked step is a fresh
    execution, so it naturally reflects the latest state). */
function scRunCtx_(ss, model) {
  if (_scRunCtx) return _scRunCtx;
  var disabled = {};
  (model.segments || []).forEach(function(sg) { if (!sg.enabled) disabled[sg.label.toLowerCase()] = true; });
  _scRunCtx = {
    clickBoosts: scClickBoosts_(ss),
    companySegments: scCompanySegments_(ss),
    disabledSegments: disabled
  };
  return _scRunCtx;
}

/** Score + append parsed feed items to the intake tab (shared by fetch and
    backstop). Returns the number kept. */
function scDigestIngest_(ss, intake, state, items, sourceLabel, isBackstop, seen, model, cutoffMs) {
  var ctx = scRunCtx_(ss, model);
  var out = [];
  for (var i = 0; i < items.length && out.length < SCRAPER_DIGEST_ITEMS_PER_SOURCE; i++) {
    var it = items[i];
    if (!it.url || seen[it.url]) continue;
    var ts = new Date(it.publishedAt || '').getTime();
    if (ts && ts < cutoffMs) continue;   // undated items pass; the window filters dated ones
    var title = it.title;
    var snippet = it.snippet;
    if (isBackstop) {
      // Google News titles carry a trailing " - Publisher"; the source label
      // already names the outlet, so drop it from the headline.
      title = title.replace(/\s+-\s+[^-]{2,60}$/, '');
    }
    // A snippet that just restates the headline (the usual Google News
    // description) adds nothing and inflates the substance signal — blank it.
    var normT = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    var normS = snippet.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (normS && normT && (normS === normT || normS.indexOf(normT) === 0)) snippet = '';
    var r = scRubricScore_(title, snippet, model, ctx);
    var score = isBackstop ? Math.round(r.score * SCRAPER_DIGEST_BACKSTOP_PENALTY) : r.score;
    if (score < SCRAPER_DIGEST_MIN_INTAKE_SCORE) continue;
    seen[it.url] = true;
    out.push([state.id, it.url, title, sourceLabel || it.source,
      it.publishedAt, snippet, score,
      JSON.stringify({ s: r.signals, mc: r.matchedCompanies, mt: r.matchedTopics,
        ms: r.matchedSegments, xs: r.excludedSegments, g: r.gated ? 1 : 0,
        // Persisted so the corroboration boost, which is applied later once the
        // whole set is known, can respect the same evidence cap the rubric
        // applied here rather than adding on top of it.
        ev: r.evidence, sup: r.support, gf: r.geoFactorApplied }).slice(0, 1200),
      '', scDigestSectionFor_(r), isBackstop ? 'yes' : '', '']);
  }
  if (out.length) {
    intake.getRange(intake.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
  }
  return out.length;
}

/** Fetch phase: walk enabled roster sources, a few feeds per step. */
function scDigestFetchStep_(ss, state, t0) {
  var intake = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE);
  var enabled = scEnabledSources_(ss);
  var model = scLoadInterestModel_(ss, scEditionById_(ss, state.editionId));
  var seen = scDigestIntakeUrls_(intake, state.id);
  var cutoffMs = Date.now() - state.windowH * 3600000;
  var fetches = 0;
  while (state.srcCursor < SCRAPER_SOURCE_ROSTER.length &&
         fetches < SCRAPER_DIGEST_FETCHES_PER_STEP &&
         (Date.now() - t0) < SCRAPER_DIGEST_TIME_BUDGET_MS) {
    var src = SCRAPER_SOURCE_ROSTER[state.srcCursor];
    state.srcCursor++;
    if (!enabled[src.key]) continue;
    fetches++;
    try {
      var resp = UrlFetchApp.fetch(src.rss, { muteHttpExceptions: true, followRedirects: true });
      if (resp.getResponseCode() !== 200) continue;
      var items = scParseFeed_(resp.getContentText(), src.name);
      state.fetched += items.length;
      state.kept += scDigestIngest_(ss, intake, state, items, src.name, false, seen, model, cutoffMs);
    } catch (feedErr) { /* a broken feed never breaks the run */ }
  }
  if (state.srcCursor >= SCRAPER_SOURCE_ROSTER.length) state.phase = 'backstop';
  scDigestSaveState_(state);
  return { phase: state.phase, cursor: state.srcCursor, total: SCRAPER_SOURCE_ROSTER.length };
}

/** Cursor key for an edition's backstop rotation.

    The cursor used to be one global script property. Two consequences, both
    of which the developer felt as "my rebuild has far fewer articles":

    1. Building the morning edition advanced the cursor, so the BESS build that
       followed queried a DIFFERENT twelve companies — one edition was eating
       another's rotation.
    2. Rebuilding an edition advanced it again, so the rebuild could not query
       what the build it replaced had queried. A rebuild was not a repeat; it
       was a roll of different dice, and each rebuild rolled again.

    Per-edition keys fix (1). scDigestBackstopPick_ fixes (2). */
function scDigestBackstopCursorKey_(editionId) {
  return SCRAPER_DIGEST_BACKSTOP_CURSOR_KEY + '_' +
    String(editionId || SCRAPER_EDITION_DEFAULT.id);
}

/** The twelve company names this edition queries today.

    Memoised per (edition, date), so a rebuild re-queries exactly what the run
    it replaces did. The rotation is meant to spread company coverage across
    DAYS — a name not queried today comes up tomorrow. It was never meant to
    move under a rebuild, which is the one case where the developer is directly
    comparing two editions and expects them to be comparable.

    The cursor advances once per edition per day, on the first build of that
    day, and the pick is stored so later builds reuse it. */
function scDigestBackstopPick_(props, names, editionId, date) {
  if (!names.length) return [];
  var memoKey = scDigestBackstopCursorKey_(editionId) + '_pick';
  var memo = null;
  try { memo = JSON.parse(props.getProperty(memoKey) || 'null'); } catch (e) {}
  // Same edition, same day, and the roster has not changed underneath it.
  if (memo && memo.date === date && memo.n === names.length &&
      memo.pick && memo.pick.length) {
    return memo.pick.filter(function(nm) { return names.indexOf(nm) !== -1; });
  }
  var cursorKey = scDigestBackstopCursorKey_(editionId);
  var start = Number(props.getProperty(cursorKey));
  if (!start) {
    // One-time migration off the shared global cursor, so an existing fleet
    // does not restart every edition's rotation from the top of the alphabet.
    start = Number(props.getProperty(SCRAPER_DIGEST_BACKSTOP_CURSOR_KEY)) || 0;
  }
  var pick = [];
  for (var i = 0; i < Math.min(SCRAPER_DIGEST_BACKSTOP_PER_RUN, names.length); i++) {
    pick.push(names[(start + i) % names.length]);
  }
  props.setProperty(cursorKey, String((start + pick.length) % names.length));
  props.setProperty(memoKey, JSON.stringify({ date: date, n: names.length, pick: pick }));
  return pick;
}

/** Backstop phase (D2): rotating Google News company-name queries —
    down-weighted, labeled, capped per run. Kept only as a covered-company
    safety net, never a primary source. */
function scDigestBackstopStep_(ss, state, t0) {
  var intake = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE);
  var model = scLoadInterestModel_(ss, scEditionById_(ss, state.editionId));
  var props = PropertiesService.getScriptProperties();
  if (!state.bsList) {
    state.bsList = scDigestBackstopPick_(props,
      model.companies.map(function(c) { return c.label; }).sort(),
      state.editionId || SCRAPER_EDITION_DEFAULT.id, state.date);
    state.bsCursor = 0;
  }
  var seen = scDigestIntakeUrls_(intake, state.id);
  var cutoffMs = Date.now() - state.windowH * 3600000;
  var when = state.windowH > 24 ? '3d' : '1d';
  var fetches = 0;
  while (state.bsCursor < state.bsList.length &&
         fetches < SCRAPER_DIGEST_FETCHES_PER_STEP &&
         (Date.now() - t0) < SCRAPER_DIGEST_TIME_BUDGET_MS) {
    var name = state.bsList[state.bsCursor];
    state.bsCursor++;
    fetches++;
    try {
      var url = 'https://news.google.com/rss/search?q=' +
        encodeURIComponent('"' + name + '" when:' + when) + '&hl=en-US&gl=US&ceid=US:en';
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      if (resp.getResponseCode() !== 200) continue;
      var items = scParseFeed_(resp.getContentText(), 'Google News');
      state.fetched += items.length;
      state.kept += scDigestIngest_(ss, intake, state, items,
        'Google News · ' + name + ' (backstop)', true, seen, model, cutoffMs);
    } catch (bsErr) { /* tolerated */ }
  }
  if (state.bsCursor >= state.bsList.length) state.phase = 'summarize';
  scDigestSaveState_(state);
  return { phase: state.phase, cursor: state.bsCursor, total: state.bsList.length };
}

/** Intake rows for a digest as objects, sorted by score (desc). */
function scDigestItems_(ss, digestId) {
  var intake = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE);
  var data = intake.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== digestId) continue;
    var sig = {};
    try { sig = JSON.parse(data[i][7] || '{}'); } catch (e) {}
    items.push({ row: i + 1, url: String(data[i][1]), title: String(data[i][2]),
      source: String(data[i][3]), publishedAt: String(data[i][4]),
      snippet: String(data[i][5]), score: Number(data[i][6]) || 0,
      matchedCompanies: sig.mc || [], matchedTopics: sig.mt || [],
      evidence: Number(sig.ev) || 0, support: Number(sig.sup) || 0,
      geoFactor: sig.gf == null ? 1 : Number(sig.gf),
      summary: String(data[i][8] || ''), section: String(data[i][9] || 'market'),
      backstop: String(data[i][10]) === 'yes',
      analysis: String(data[i][11] || '') });
  }
  // Corroboration (T2a): a story covered by 2+ distinct sources in the window
  // matters more. Group by a normalized title signature; add a bounded boost
  // to each member's effective score. Deterministic, no extra storage.
  var groups = {};
  items.forEach(function(it) {
    var sig = String(it.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 8).join(' ');
    (groups[sig] = groups[sig] || []).push(it);
  });
  Object.keys(groups).forEach(function(sig) {
    var g = groups[sig];
    var sources = {};
    g.forEach(function(it){ sources[String(it.source).toLowerCase()] = true; });
    var distinct = Object.keys(sources).length;
    if (distinct >= 2) {
      var boost = Math.min(SCRAPER_CORROB_CAP, (distinct - 1) * 3);
      g.forEach(function(it) {
        it.corrob = distinct;
        // Corroboration is only knowable once the whole set is in hand, so it
        // is added here rather than inside scRubricScore_. That made it a hole
        // in the evidence gate: it was added raw to a score whose supporting
        // signals had already been capped, so an item at 52 became 58 without
        // any new evidence that it was relevant. The boost now spends whatever
        // support allowance the article had left, and nothing more — scaled by
        // the same geographic factor the rest of its score was.
        var room = Math.max(0, (it.evidence || 0) * SCRAPER_SUPPORT_RATIO - (it.support || 0));
        var allowed = Math.min(boost, room) * (it.geoFactor == null ? 1 : it.geoFactor);
        it.score = Math.min(100, Math.round(it.score + allowed));
      });
    }
  });
  items.sort(function(a, b) { return b.score - a.score; });
  // One row per story, AFTER corroboration.
  //
  // The developer saw the same Oracle headline printed twice in one edition,
  // both from the backstop. Intake dedupes on URL, and Google News hands out a
  // distinct URL for each republication of a syndicated story, so an identical
  // headline slips through.
  //
  // The obvious fix — dedupe by title at ingest — would have broken the thing
  // directly above: corroboration groups by title signature to reward a story
  // two or more sources carried. Dedupe before it and no group can ever have
  // two members, so the boost silently dies. Doing it here keeps both rows in
  // the intake for the boost and collapses them only for the reader.
  //
  // Exact normalized title, not the 8-word signature corroboration uses. That
  // signature is deliberately loose because a false grouping there only nudges
  // a score; here a false grouping DELETES a story, so it has to be strict.
  // The list is score-sorted, so the first of a group is the highest-scoring
  // copy — usually the roster source rather than the penalised backstop one.
  var bestByTitle = {}, deduped = [];
  items.forEach(function(it) {
    var key = String(it.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key) { deduped.push(it); return; }      // untitled: never collapse
    if (bestByTitle[key]) { bestByTitle[key].duplicates = (bestByTitle[key].duplicates || 1) + 1; return; }
    bestByTitle[key] = it;
    deduped.push(it);
  });
  return deduped;
}

/** The provider/model an edition was actually built with. Recorded on every
    edition so "was this one free?" is answerable after the fact — previously
    a Gemini-built and a Claude-built edition were indistinguishable once
    stored, because only failures wrote anything to the Notes column. */
function scActiveAiLabel_() {
  var props = PropertiesService.getScriptProperties();
  var provider = (props.getProperty('AI_PROVIDER') || SCRAPER_AI_PROVIDER).toLowerCase();
  var model = provider === 'claude'
    ? (props.getProperty('ANTHROPIC_MODEL') || SCRAPER_CLAUDE_MODEL)
    : (props.getProperty('GEMINI_MODEL') || props.getProperty('GEMINI_MODEL_AUTO') || 'auto');
  return provider + '/' + model;
}

/** aiComplete_ with bounded retry on rate limiting. A free-tier 429 is a
    transient, self-clearing condition — treating it as terminal dropped the
    entire remainder of an edition to raw snippets and skipped the AI lead.
    Other errors (bad key, HTTP 400) are NOT retried: they will not fix
    themselves and retrying just burns quota. */
/** Is this AI failure worth retrying?

    Retrying a bad key or a malformed request only burns quota, so only
    TRANSIENT conditions qualify: a rate limit (429) and the transient 5xx
    family. 503 in particular is the provider saying "overloaded, try again" —
    it was previously treated as fatal, which is how a single 503 sent an
    entire edition to fallback summaries with `ai_unavailable: ai_http_503`. */
function scAiRetryable_(msg) {
  var m = String(msg || '');
  if (m.indexOf('ai_rate_limited') !== -1) return true;
  // A model that returns malformed JSON, gets cut off at the token ceiling, or
  // returns nothing at all is the same class of transient as a 503: the next
  // attempt usually succeeds, because generation is not deterministic. These
  // were treated as terminal, which is how one unlucky reply sent a whole
  // edition to raw snippets with `ai_unavailable: ai_bad_json` — the identical
  // failure this function was written to stop happening for 503.
  if (m.indexOf('ai_bad_json') !== -1) return true;
  if (m.indexOf('ai_truncated') !== -1) return true;
  if (m.indexOf('ai_empty_response') !== -1) return true;
  return /ai_http_(500|502|503|504|529)\b/.test(m);
}

/** Is this failure one batch's problem rather than the edition's?

    A malformed, truncated, or empty reply says nothing about whether the NEXT
    call will work. A missing key, an unconfigured provider or a rejected
    request says the opposite — those are terminal and the edition should stop
    asking. Kept separate from scAiRetryable_ because these two questions are
    genuinely different: "retry this call" and "keep going after giving up on
    this call". */
function scAiSoftFail_(msg) {
  var m = String(msg || '');
  return m.indexOf('ai_bad_json') !== -1
      || m.indexOf('ai_truncated') !== -1
      || m.indexOf('ai_empty_response') !== -1
      || m.indexOf('ai_blocked_') !== -1;
}

function scAiWithRetry_(prompt, maxTokens) {
  var attempt = 0;
  for (;;) {
    try {
      return aiComplete_(prompt, maxTokens);
    } catch (err) {
      var msg = String((err && err.message) || err);
      if (!scAiRetryable_(msg) || attempt >= SCRAPER_AI_RETRY_BACKOFF_MS.length) throw err;
      try { Utilities.sleep(SCRAPER_AI_RETRY_BACKOFF_MS[attempt]); } catch (sleepErr) {}
      attempt++;
    }
  }
}

/** The items an edition will spend AI summaries on.

    This used to be an unfiltered `items.slice(0, 30)`, which was wrong at both
    ends. On a thin day it paid for summaries of items that scored below the
    relevance bar and therefore could never be printed — the lead, the sections
    and the held-back list all filter on that bar. On a heavy day it stopped at
    30 while the relevant set ran past it, so items ranked 31+ cleared the bar,
    got held back by a section cap, and reached View More carrying nothing but
    the raw feed snippet.

    Relevance is the honest boundary: summarize exactly what the edition can
    display, in score order, bounded so one enormous news day cannot run the
    AI budget away. The build starts an hour before send and resumes across
    continuation triggers, so a larger set costs steps, not a missed delivery. */
function scDigestSummarizeSet_(items) {
  var relevant = items.filter(function (it) {
    return it.score >= SCRAPER_RELEVANT_THRESHOLD;
  });
  return relevant.slice(0, SCRAPER_DIGEST_SUMMARIZE_MAX);
}

/** Summarize phase: AI key-point summaries for the top items, then the lead.
    No AI key / AI failure → deterministic fallback (snippets serve as
    summaries, top item becomes the lead) so the digest always builds. */
function scDigestSummarizeStep_(ss, state, t0) {
  var items = scDigestItems_(ss, state.id);
  var intake = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE);
  var top = scDigestSummarizeSet_(items);
  var pending = top.filter(function(it) { return !it.summary; });
  var softFails = 0;
  while (pending.length && (Date.now() - t0) < SCRAPER_DIGEST_TIME_BUDGET_MS && !state.aiNote) {
    var batch = pending.slice(0, SCRAPER_DIGEST_ITEMS_PER_AI_CALL);
    // Longer summaries (developer feedback 2026-08-27): substance over
    // brevity — no hard sentence cap, the prompt sets the quality bar.
    var lens = scEditionLens_(state.editionId);
    var prompt = 'You are writing a morning digest read by ' + lens.audience + '. '
      + 'For each item return TWO SEPARATE fields.\n\n'
      // Two fields rather than one paragraph. The developer asked to "explicitly
      // differentiate between the standard article summary and your analysis
      // from different players' perspectives" — a boundary drawn in the data
      // holds, where one drawn in prose erodes the moment a sentence runs long.
      + '"summary" — what the article REPORTS. Typically 3-5 sentences (~60-120 words): '
      + 'what happened and who is involved; every concrete figure (MW/MWh/GW, $, %, dates, '
      + 'locations, counterparties); and the mechanics of the deal, policy or incident. '
      + 'Confine this to what the article states. Put no interpretation of your own here, '
      + 'and do not restate the headline.\n\n'
      + '"analysis" — your own read, 1-2 sentences. ' + lens.closing + '.\n\n'
      + 'The analysis is inference, not reporting, and its language must match how strongly '
      + 'the article actually supports it. Where the article states something plainly you may '
      + 'say so plainly; where you are extrapolating — which is most of the time — write like '
      + 'someone who knows they are extrapolating. Prefer the conditional over the certain '
      + '("may", "could", "points toward", "suggests", "is likely to" rather than "will", '
      + '"always", "definitely", "guarantees"). Those are illustrations of the register, not a '
      + 'word list to work from: the aim is that a reader can tell how much weight the claim '
      + 'carries. Do not manufacture confidence you do not have, and equally do not hedge a '
      + 'fact the article reports directly.\n\n'
      // Same reasoning as before: the closing thought is specified by what it
      // must achieve, never by a sentence pattern.
      + 'Vary how you write the analysis across the items — do not open it with the same '
      + 'construction every time, and do not use a standard phrase like "For X, this…" on '
      + 'more than one item in this batch.\n\n'
      + 'Reply ONLY with a JSON array like '
      + '[{"i":0,"summary":"...","analysis":"..."}] covering every item.\n\nItems:\n'
      + JSON.stringify(batch.map(function(it, n) {
          return { i: n, title: it.title, snippet: it.snippet.slice(0, 280), source: it.source };
        }));
    try {
      var parsed = scParseJsonArray_(scAiWithRetry_(prompt, SCRAPER_DIGEST_SUMMARY_TOKENS)) || [];
      var byIdx = {};
      parsed.forEach(function(p) {
        if (p && typeof p.i === 'number') {
          byIdx[p.i] = { summary: scStr_(p.summary, SCRAPER_DIGEST_SUMMARY_MAX),
                         analysis: scStr_(p.analysis, SCRAPER_DIGEST_ANALYSIS_MAX) };
        }
      });
      batch.forEach(function(it, n) {
        var got = byIdx[n] || {};
        // A batch that fell back to its raw snippet has no analysis to show —
        // better an item with no desk read than a laundered snippet presented
        // as one.
        var sum = got.summary || it.snippet;
        var ana = got.summary ? (got.analysis || '') : '';
        intake.getRange(it.row, 9).setValue(sum);
        intake.getRange(it.row, 12).setValue(ana);
        it.summary = sum;
        it.analysis = ana;
      });
      scLogUsage_(ss, 'digest', 1, 0);
      if (!state.aiLabel) state.aiLabel = scActiveAiLabel_();
    } catch (aiErr) {
      var aiMsg = String((aiErr && aiErr.message) || aiErr);
      // A batch that will not parse even after the retries costs THAT batch,
      // not the edition. Previously any AI error broke the loop, so one bad
      // reply out of six calls dropped all thirty items to raw snippets. The
      // items here fall back to their snippet — exactly what they would have
      // got anyway — and the next batch is still attempted.
      if (scAiSoftFail_(aiMsg) && softFails < SCRAPER_DIGEST_MAX_SOFT_AI_FAILS) {
        softFails++;
        state.aiSoftNote = 'ai_partial: ' + aiMsg.slice(0, 80)
          + ' (' + softFails + (softFails === 1 ? ' batch' : ' batches') + ')';
        batch.forEach(function(it) {
          intake.getRange(it.row, 9).setValue(it.snippet);
          it.summary = it.snippet;
        });
        pending = pending.filter(function(it) { return !it.summary; });
        continue;
      }
      state.aiNote = 'ai_unavailable: ' + aiMsg.slice(0, 120);
      break;
    }
    pending = pending.filter(function(it) { return !it.summary; });
    // Space out consecutive calls so a 30-item edition doesn't burst ~7
    // requests at the free tier's per-minute cap.
    if (pending.length) { try { Utilities.sleep(SCRAPER_DIGEST_AI_PAUSE_MS); } catch (pErr) {} }
  }
  var stillPending = top.some(function(it) { return !it.summary; });
  if ((!stillPending || state.aiNote) && !state.leadDone) {
    state.leadIdx = 0;
    state.leadText = '';
    state.leadAnalysis = '';
    // The lead is picked from the SAME pool the render step indexes into —
    // items that clear the relevance bar, in the same order. Offering the model
    // the unfiltered top 30 and then applying its answer to the filtered list
    // would point the chosen index at a different article than the one the
    // lead paragraph describes.
    var leadPool = items.filter(function(it) { return it.score >= SCRAPER_RELEVANT_THRESHOLD; });
    if (!state.aiNote && leadPool.length) {
      try {
        var lens2 = scEditionLens_(state.editionId);
        var lp = 'From these scored industry items, pick the single most consequential as "the lead" '
          + 'for a morning digest read by ' + lens2.audience + '. Return the index and TWO '
          + 'SEPARATE fields.\n\n'
          + '"text" — what the article reports, 3-5 sentences: what happened, the key figures, '
          + 'and the mechanism behind it. Reporting only.\n\n'
          + '"analysis" — your own read, 1-2 sentences. ' + lens2.closing + '. This is inference, '
          + 'so write it in a register that matches how strongly the article supports it — '
          + 'conditional where you are extrapolating, plain only where the article is plain.\n\n'
          + 'Reply ONLY with a JSON array: '
          + '[{"lead": <item index>, "text": "...", "analysis": "..."}].\n\nItems:\n'
          + JSON.stringify(leadPool.slice(0, 6).map(function(it, n) {
              return { i: n, title: it.title, summary: it.summary || it.snippet.slice(0, 200) };
            }));
        var lr = scParseJsonArray_(scAiWithRetry_(lp, 1200)) || [];
        if (lr[0]) {
          state.leadIdx = Math.max(0, Math.min(5, Number(lr[0].lead) || 0));
          state.leadText = scStr_(lr[0].text, 1200);
          state.leadAnalysis = scStr_(lr[0].analysis, SCRAPER_DIGEST_ANALYSIS_MAX);
        }
        scLogUsage_(ss, 'digest', 1, 0);
      } catch (leadErr) { /* fallback below */ }
    }
    state.leadDone = true;
  }
  if (state.leadDone) state.phase = 'render';
  scDigestSaveState_(state);
  return { phase: state.phase, summarized: top.length - pending.length, top: top.length };
}

/** Serialise a digest for its Sheets cell, guaranteeing it parses back.

    This replaces `JSON.stringify(d).slice(0, SCRAPER_DIGEST_CELL_MAX)`, which
    cut the string at a fixed offset — mid-key, mid-value, wherever it landed —
    producing a cell that JSON.parse could never read again. Every consumer of
    column 7 then failed silently: getDigest fell back, and View More reported
    "Nothing was held back", which is not a smaller truth but a false one.

    It was not a theoretical cap. Measured against the real payload sizes, an
    edition with the sections full and its held-back list carrying summaries
    runs 90,000-160,000 characters against a 45,000 cap.

    So drop by value instead of by offset, cheapest first: the held-back
    analysis, then the held-back summaries, then the held-back list itself
    (its count survives in heldBackTotal, so the footer stays honest), and only
    then the section analyses. Each step re-measures. `truncated` records what
    was given up, so a shrunken edition can say so rather than look complete.
    The final slice is unreachable in practice and kept only so this can never
    return something longer than the cell accepts. */
function scDigestFitJson_(d) {
  var out = JSON.stringify(d);
  if (out.length <= SCRAPER_DIGEST_CELL_MAX) return out;
  var c = JSON.parse(out);                       // a copy; never mutate the caller's
  var steps = [
    function() { (c.heldBack || []).forEach(function(it) { it.analysis = ''; }); },
    function() { (c.heldBack || []).forEach(function(it) { it.summary = ''; }); },
    // Drop items, not the list. Halving keeps the highest-scored ones the
    // reader most wants, and the overlay already says "showing the top N of
    // <total>" whenever the list is shorter than heldBackTotal — so a partial
    // list reads correctly with no further work. Only a list that shrinks to
    // nothing sets heldBackTrimmed, which is what makes the overlay explain
    // itself instead of claiming nothing was held back.
    function() {
      while (c.heldBack && c.heldBack.length &&
             JSON.stringify(c).length > SCRAPER_DIGEST_CELL_MAX) {
        c.heldBack = c.heldBack.slice(0, Math.floor(c.heldBack.length / 2));
      }
      if (c.heldBack && !c.heldBack.length) c.heldBackTrimmed = true;
    },
    function() {
      ['companies', 'market', 'incidents'].forEach(function(sec) {
        ((c.sections && c.sections[sec]) || []).forEach(function(it) { it.analysis = ''; });
      });
    }
  ];
  for (var i = 0; i < steps.length; i++) {
    steps[i]();
    c.trimmed = true;
    out = JSON.stringify(c);
    if (out.length <= SCRAPER_DIGEST_CELL_MAX) return out;
  }
  return out.slice(0, SCRAPER_DIGEST_CELL_MAX);
}

/** Render phase: section grouping → Night Ink HTML → Digests row. */
function scDigestRenderStep_(ss, state) {
  var items = scDigestItems_(ss, state.id);
  var relevant = items.filter(function(it) { return it.score >= SCRAPER_RELEVANT_THRESHOLD; });
  // The lead is chosen from items that CLEAR the bar. It used to be picked out
  // of an unfiltered top-30, so on a thin day the AI's lead pick could land on
  // an article that never qualified — and the lead is the most prominent thing
  // in the edition. Sections were already filtered; this was the one hole left.
  var leadPool = relevant.length ? relevant : [];
  var lead = leadPool.length
    ? leadPool[Math.min(state.leadIdx || 0, leadPool.length - 1)] : null;
  var sections = { companies: [], market: [], incidents: [] };
  items.forEach(function(it) {
    if (lead && it.url === lead.url) return;
    if (it.score < SCRAPER_RELEVANT_THRESHOLD) return;
    var sec = it.section || 'market';
    if (sections[sec] && sections[sec].length < SCRAPER_DIGEST_SECTION_CAPS[sec]) {
      sections[sec].push(it);
    }
  });
  // "Newly covered this week" box — companies still carrying the sync flag.
  var newNames = [];
  var interests = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
  if (interests) {
    var idata = interests.getDataRange().getValues();
    for (var i = 1; i < idata.length && newNames.length < 6; i++) {
      if (String(idata[i][1]) === 'company' && String(idata[i][4]) === 'active' &&
          String(idata[i][5]) === SCRAPER_INTEREST_FLAG_NEW) newNames.push(String(idata[i][2]));
    }
  }
  var digests = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  // Rebuilding an edition REPLACES that day's row rather than adding another.
  // Defence in depth: a bug that re-entered the render step used to leave one
  // visible copy of the edition per pass (nine, in the case that prompted
  // this), and the developer then had to delete them by hand. With this, the
  // worst a repeat render can do is rewrite the same row.
  //
  // v03.42r briefly keyed this on the run id instead, so a deliberate rebuild
  // stood beside the earlier build of the same day. The developer tried it and
  // preferred one row per day, so the day key is back. The delivery pass keeps
  // the per-edition grouping that change introduced — under replacement it can
  // only ever find one row, but it means a duplicate row could never become a
  // duplicate EMAIL if this guard were ever to miss.
  var priorRow = scDigestDropSameDayRows_(digests,
    state.editionId || SCRAPER_EDITION_DEFAULT.id, state.date);
  // Numbered against the editions that actually exist for THIS masthead —
  // see scIssueNumbers_ for why the old getLastRow() counter was wrong.
  var no = scNextIssueNo_(ss, state.editionId || SCRAPER_EDITION_DEFAULT.id, state.date);
  var clock = scDigestClock_(new Date());
  // Held-back = cleared the relevance bar, did not fit a section cap. Computed
  // here rather than after the render (where the weekly-rollup stash still
  // happens) so it can travel inside the stored edition: "View More" has to
  // work on any edition the reader opens, and the HELDBACK_ script property
  // only ever holds the newest run of each edition.
  // `sections` and `lead` are the pre-trackAll intake items, so their urls are
  // still raw — which is what makes them comparable.
  var shownUrls = {};
  [sections.companies, sections.market, sections.incidents].forEach(function(sec) {
    sec.forEach(function(it) { shownUrls[it.url] = true; });
  });
  if (lead) shownUrls[lead.url] = true;
  var heldBack = relevant.filter(function(it) { return !shownUrls[it.url]; });
  var d = {
    id: state.id, date: state.date, no: no, windowH: state.windowH,
    generatedAt: new Date().toISOString(), aiNote: state.aiNote || '',
    aiSoftNote: state.aiSoftNote || '',
    aiLabel: state.aiLabel || '',
    lead: lead ? { title: lead.title, source: lead.source, publishedAt: lead.publishedAt,
                   url: lead.url, score: lead.score,
                   text: state.leadText || lead.summary || lead.snippet,
                   analysis: state.leadAnalysis || lead.analysis || '' } : null,
    sections: {
      companies: sections.companies.map(scDigestItemOut_),
      market: sections.market.map(scDigestItemOut_),
      incidents: sections.incidents.map(scDigestItemOut_)
    },
    newCoverage: { count: newNames.length, names: newNames },
    counts: { intake: items.length, relevant: relevant.length,
              shown: (lead ? 1 : 0) + sections.companies.length
                     + sections.market.length + sections.incidents.length }
  };
  d.editionId = state.editionId || SCRAPER_EDITION_DEFAULT.id;
  d.editionName = state.editionName || SCRAPER_EDITION_DEFAULT.name;
  // T1a — route every article link through the logging redirect. The intake
  // keeps the raw URL; the redirect resolves + logs, then forwards.
  function trackAll(list) { list.forEach(function(it) { it.url = scClickUrl_(state.id, it.url); }); }
  trackAll(d.sections.companies); trackAll(d.sections.market); trackAll(d.sections.incidents);
  if (d.lead) d.lead.url = scClickUrl_(state.id, d.lead.url);
  // Slim, capped, and click-tracked like every other link in the edition — the
  // items are in this digest's intake rows, so the redirect resolves them.
  // Held-back items carry their summary and analysis too — View More used to
  // show a bare headline for an article the desk had already read. The
  // summarize set is the relevant set (scDigestSummarizeSet_), so every item
  // that reaches this list has been through the AI; the snippet fallback only
  // catches an edition whose summarize phase was cut short by an AI outage.
  d.heldBack = heldBack.slice(0, SCRAPER_HELD_BACK_SHOW).map(function(it) {
    return { title: scStr_(it.title, 180), source: it.source,
             publishedAt: it.publishedAt, score: it.score,
             url: scClickUrl_(state.id, it.url),
             summary: scStr_(it.summary || it.snippet, SCRAPER_DIGEST_SUMMARY_MAX),
             analysis: scStr_(it.analysis || '', SCRAPER_DIGEST_ANALYSIS_MAX) };
  });
  d.heldBackTotal = heldBack.length;

  var html = scRenderDigestNightInk_(d);
  digests.appendRow([state.id, state.date, new Date(), 'generated',
    items.length, relevant.length,
    scDigestFitJson_(d),
    html.slice(0, SCRAPER_DIGEST_CELL_MAX),
    state.aiNote || state.aiSoftNote || '', d.editionId,
    state.aiLabel || (state.aiNote ? 'none (fallback)' : ''),
    lead ? scStr_(lead.title, 300) : '', no,
    priorRow.delivered || '']);   // '' = built, not yet delivered
  var extra = digests.getLastRow() - 1 - SCRAPER_DIGEST_KEEP;
  if (extra > 0) digests.deleteRows(2, extra);
  var props = PropertiesService.getScriptProperties();
  props.setProperty('DIGEST_LAST_DATE', state.date);
  // F5 — stash the relevant-but-not-shown items for the weekly rollup. Same
  // list the edition embedded above; computed once, before the render.
  scStoreHeldBack_(props, d.editionId, heldBack);
  // Stamp the edition's last-built date.
  try {
    var edSheet = ss.getSheetByName(SCRAPER_TABS.EDITIONS);
    var eds = edSheet.getDataRange().getValues();
    for (var ei = 1; ei < eds.length; ei++) {
      if (String(eds[ei][0]) === d.editionId) { edSheet.getRange(ei + 1, 7).setValue(state.date); break; }
    }
  } catch (edErr) {}
  // Deliver to this edition's subscribers (Phase 5). Legacy DIGEST_RECIPIENT
  // entries were migrated into Subscribers on first read.
  // Rendering no longer sends. The row is left with an empty Delivered cell and
  // scDigestDeliverPending_ mails it, which is what makes a manual build silent
  // and lets the scheduled send wait for SCRAPER_DIGEST_SEND_HOUR however early
  // the build actually finished.
  state.phase = 'done';
  scDigestSaveState_(state);
  return { phase: 'done', relevant: relevant.length, sectionsBuilt: true };
}


/** Remove any existing rows for one edition on one date, newest-first so the
    indices stay valid as they go. Called immediately before a render appends,
    which is what makes rebuilding idempotent — and what collapses duplicates a
    previous bug already created, the next time that edition is built.

    Returns the delivery stamp carried by any row it removed, so the caller can
    put it back on the replacement. Without that, rebuilding an edition that had
    already been emailed would clear its Delivered cell and the next delivery
    pass would send it a second time — the opposite of what the split between
    building and sending is for.

    Scoped deliberately tight: same edition AND same date only. It will never
    touch another masthead or another day. */
function scDigestDropSameDayRows_(digests, editionId, date) {
  var n = digests.getLastRow() - 1;
  if (n < 1) return { dropped: 0, delivered: '' };
  var dates = digests.getRange(2, 2, n, 1).getValues();
  var eds = digests.getRange(2, 10, n, 1).getValues();
  var wide = digests.getMaxColumns() >= 14;
  var deliv = wide ? digests.getRange(2, 14, n, 1).getValues() : null;
  var dropped = 0, delivered = '';
  for (var i = n - 1; i >= 0; i--) {
    var ed = String(eds[i][0] || '').trim() || SCRAPER_EDITION_DEFAULT.id;
    if (ed !== editionId) continue;
    if (scIssueDateKey_(dates[i][0]) !== date) continue;
    if (deliv && !delivered) {
      var d = deliv[i][0];
      if (d instanceof Date || String(d || '').trim()) delivered = d;
    }
    digests.deleteRow(i + 2);
    dropped++;
  }
  return { dropped: dropped, delivered: delivered };
}

function scDigestItemOut_(it) {
  return { title: it.title, source: it.source, publishedAt: it.publishedAt,
           url: it.url, rawUrl: it.url, score: it.score, backstop: it.backstop,
           summary: it.summary || it.snippet,
           // Absent on editions built before the split, and on any item that
           // fell back to its raw snippet — the renderer omits the block rather
           // than printing an empty label.
           analysis: it.analysis || '' };
}

function scDigestNo_(n) { return ('000' + Math.max(1, n)).slice(-3); }

/** ---- Issue numbering ------------------------------------------------- */

/** Issue number for every stored edition, as { digestId: n }.

    The number used to be `digests.getLastRow()` — a row-position counter over
    the whole tab, which is wrong three separate ways: it is shared across every
    masthead (a first-ever BESS issue inherited the count of every morning one),
    it counts builds rather than issues (rebuilding a day appends a row, so the
    number climbed for the same edition), and it moves when an unrelated
    edition's rows are deleted.

    The rule here instead: an issue's number is the rank of its DATE among the
    distinct dates stored for its OWN edition, oldest first. So each masthead
    counts its own issues from 001, a rebuild of a day keeps that day's number,
    and deleting issues reflows the rest to stay contiguous.

    Reads columns 1, 2 and 10 only — never the two 45,000-character cells. */
function scIssueNumbers_(ss) {
  var out = {};
  var sheet = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var n = sheet ? sheet.getLastRow() - 1 : 0;
  if (n < 1) return out;
  var ids = sheet.getRange(2, 1, n, 2).getValues();     // id, date
  var eds = sheet.getRange(2, 10, n, 1).getValues();    // edition
  var byEd = {};
  for (var i = 0; i < n; i++) {
    var id = String(ids[i][0] || '').trim();
    if (!id) continue;
    var ed = String(eds[i][0] || '').trim() || SCRAPER_EDITION_DEFAULT.id;
    var date = scIssueDateKey_(ids[i][1]);
    if (!byEd[ed]) byEd[ed] = { dates: {}, rows: [] };
    byEd[ed].dates[date] = true;
    byEd[ed].rows.push({ id: id, date: date });
  }
  for (var edId in byEd) {
    if (!Object.prototype.hasOwnProperty.call(byEd, edId)) continue;
    var order = Object.keys(byEd[edId].dates).sort();   // ISO dates sort lexically
    var rank = {};
    for (var k = 0; k < order.length; k++) { rank[order[k]] = k + 1; }
    byEd[edId].rows.forEach(function(r) { out[r.id] = rank[r.date] || 1; });
  }
  return out;
}

/** The number the NEXT issue of `editionId` takes, for a build on `date`.
    A rebuild of a date this edition already has keeps that date's number
    rather than claiming a new one. */
function scNextIssueNo_(ss, editionId, date) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var n = sheet ? sheet.getLastRow() - 1 : 0;
  var want = String(editionId || SCRAPER_EDITION_DEFAULT.id);
  var key = scIssueDateKey_(date);
  if (n < 1) return 1;
  var meta = sheet.getRange(2, 2, n, 1).getValues();    // date
  var eds = sheet.getRange(2, 10, n, 1).getValues();    // edition
  var dates = {};
  for (var i = 0; i < n; i++) {
    var ed = String(eds[i][0] || '').trim() || SCRAPER_EDITION_DEFAULT.id;
    if (ed !== want) continue;
    var d = scIssueDateKey_(meta[i][0]);
    if (d) dates[d] = true;
  }
  if (key && dates[key]) {
    // Same-day rebuild: this date already has a number — reuse it.
    var order = Object.keys(dates).sort();
    return order.indexOf(key) + 1;
  }
  return Object.keys(dates).length + 1;
}

/** Normalise a Digests 'Date' cell (a string on some rows, a Date on others,
    depending on how Sheets typed it) to a sortable YYYY-MM-DD key. */
function scIssueDateKey_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'America/New_York', 'yyyy-MM-dd');
  }
  var s = String(v == null ? '' : v).trim();
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s;
}

/** Renumber every stored issue so the archive is congruent with itself.

    Called after a deletion and again before an edition is emailed. The read
    path (getDigest / the share route) already corrects the number it serves,
    but that leaves the stored row stale — and the row is what gets emailed, so
    without this a delete could still put a wrong number in someone's inbox.

    Cheap in the common case: the numbers live in their own narrow column, so
    the comparison never reads the two 45,000-character cells. Only rows whose
    number actually moved pay for a stored-HTML rewrite. Returns how many
    changed, so callers can skip work when nothing did. */
function scRenumberIssues_(ss) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var n = sheet ? sheet.getLastRow() - 1 : 0;
  if (n < 1) return 0;
  var want = scIssueNumbers_(ss);
  var ids = sheet.getRange(2, 1, n, 1).getValues();
  var hasNoCol = sheet.getMaxColumns() >= 13;
  var stored = hasNoCol ? sheet.getRange(2, 13, n, 1).getValues() : null;
  var changed = 0;
  for (var i = 0; i < n; i++) {
    var id = String(ids[i][0] || '').trim();
    if (!id) continue;
    var target = want[id] || 0;
    if (!target) continue;
    var current = stored ? Number(stored[i][0]) || 0 : 0;
    if (current === target) continue;
    var row = i + 2;
    if (hasNoCol) sheet.getRange(row, 13).setValue(target);
    // Only now is the heavy pair worth reading.
    try {
      var cells = sheet.getRange(row, 7, 1, 2).getValues()[0];
      var d = null;
      try { d = JSON.parse(String(cells[0] || 'null')); } catch (pe) {}
      if (d) { d.no = target; sheet.getRange(row, 7).setValue(scDigestFitJson_(d)); }
      var html = String(cells[1] || '');
      if (html) sheet.getRange(row, 8).setValue(
        scRewriteIssueNo_(html, target).slice(0, SCRAPER_DIGEST_CELL_MAX));
    } catch (hErr) { /* the narrow column is already correct; do not fail the caller */ }
    changed++;
  }
  return changed;
}

/** Rewrite the issue number baked into a stored edition's masthead.

    The number is rendered into the HTML at build time, so an edition stored
    before an earlier issue was deleted keeps a number that no longer matches
    the archive. Anchored on the full surrounding phrase rather than the digits
    alone, so it cannot match a number inside a headline or a summary. */
function scRewriteIssueNo_(html, no) {
  if (!html || !no) return html;
  return String(html).replace(/(\u00b7 No\. )\d{3,}( \u00b7 covering the last )/,
                              '$1' + scDigestNo_(no) + '$2');
}

/** Night Ink edition renderer (approved digest design: Your Morning Digest's
    ceremony on the Wire Desk palette — Newsreader serif masthead, double
    rules, charcoal #15171c + amber #f2a33c). Inline styles only: this HTML is
    the email body. Dark-mode client-proofing happens at Phase 4 go-live. */
function scRenderDigestNightInk_(d) {
  function esc(s) { return escapeHtml(String(s == null ? '' : s)); }
  function longDate(iso) {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York',
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      }).format(new Date(iso + 'T12:00:00Z'));
    } catch (e) { return iso; }
  }
  function timeOf(pub) {
    var t = new Date(pub || '').getTime();
    if (!t) return '';
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York',
        hour: 'numeric', minute: '2-digit' }).format(new Date(t));
    } catch (e) { return ''; }
  }
  var serif = "font-family:'Newsreader',Georgia,'Times New Roman',serif;";
  var sans = "font-family:'IBM Plex Sans','Segoe UI',system-ui,sans-serif;";
  var mono = "font-family:'IBM Plex Mono',Consolas,monospace;";
  var caps = 'font-size:9px;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;';
  function srcLine(it) {
    var t = timeOf(it.publishedAt);
    return '<div style="' + mono + caps + 'color:#7b828e;margin-top:2px;">'
      + esc(it.source) + (t ? ' · ' + esc(t) : '') + '</div>';
  }
  // The desk's read runs on from the reporting in the same paragraph, marked
  // only by colour. It had its own labelled block with a rule above it, which
  // read clearly but cost four lines of height on every single item — and the
  // developer reads these on a phone. Colour carries the distinction for a
  // fraction of the space, with one key in the footer to say what it means.
  function analysisRun(text) {
    if (!text) return '';
    return ' <span style="color:#f2a33c;">'
      + scNiBoldFigures_(esc(text), 'inherit') + '</span>';
  }
  function itemHtml(it) {
    return '<div style="margin:0 0 20px;">'
      + '<div class="ni-hed" style="' + serif + 'font-size:18px;font-weight:600;line-height:1.29;color:#eceae4;">'
      + '<a href="' + esc(it.url) + '" style="color:#eceae4;text-decoration:none;">' + esc(it.title) + '</a></div>'
      + '<div class="ni-body" style="' + sans + 'font-size:15px;line-height:1.52;color:#c2c8d2;margin-top:5px;">'
      + scNiBoldFigures_(esc(it.summary)) + analysisRun(it.analysis) + '</div>'
      + srcLine(it) + '</div>';
  }
  function sectionHtml(label, items, color, ruleColor) {
    if (!items.length) return '';
    return '<div style="margin:0 0 6px;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 9px;"><tr>'
      + '<td style="' + sans + caps + 'color:' + color + ';white-space:nowrap;padding-right:12px;">' + label + '</td>'
      + '<td width="100%" style="border-top:1px solid ' + ruleColor + ';font-size:0;line-height:0;">&nbsp;</td>'
      + '</tr></table>'
      + items.map(itemHtml).join('') + '</div>';
  }
  // Email-client proofing (Phase 4): bgcolor attributes alongside inline
  // background styles (attributes survive the aggressive sanitizers), and solid
  // inline colors on every element so dark-mode-inverting clients (Gmail) have
  // nothing transparent to repaint.
  //
  // Mobile (2026-08-28): fluid-hybrid shell. The body used to be a table with a
  // literal width="860" attribute, which no phone client will collapse — the
  // reader got a 860px canvas on a 390px screen and had to pan sideways. The
  // inner table is width="100%" + max-width:860px now, wrapped in an MSO
  // conditional ghost table at 860 so Outlook's Word engine — which really does
  // ignore max-width and margin centering, the reason the nested tables were
  // there in the first place — still gets a fixed frame. Every other client
  // gets a table that shrinks to the screen.
  //
  // The @media block only fires at <=600px, so the app's own reader (the
  // landing page column is far wider) renders exactly as it did before.
  var html = '<style>' + scNiMobileCss_() + '</style>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
    + 'bgcolor="#101216" style="background:#101216;margin:0;padding:0;border-collapse:collapse;">'
    + '<tr><td align="center" style="padding:16px 8px;">'
    + '<!--[if mso]><table role="presentation" width="860" cellpadding="0" cellspacing="0" '
    + 'border="0"><tr><td><![endif]-->'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
    + 'bgcolor="#15171c" style="background:#15171c;width:100%;max-width:860px;margin:0 auto;'
    + 'border-collapse:collapse;">'
    + '<tr><td class="ni-pad" style="color:#e6e4de;padding:20px 16px 18px;' + sans + '">'
    // Masthead
    + '<div style="text-align:center;border-bottom:3px double #d8dbe1;padding-bottom:14px;margin-bottom:16px;">'
    + '<div class="ni-mast" style="' + serif + 'font-size:27px;font-weight:700;line-height:1.15;color:#f0eee8;">'
    + esc(d.editionName || SCRAPER_EDITION_DEFAULT.name) + '</div>'
    + '<div style="' + caps + 'color:#f2a33c;margin-top:6px;">Scraper · Trade news, distilled daily</div>'
    + '<div style="font-size:12px;color:#9aa0ab;margin-top:4px;">' + esc(longDate(d.date))
    + ' · No. ' + scDigestNo_(d.no) + ' · covering the last ' + Number(d.windowH) + ' hours</div>'
    + '</div>';
  if (d.lead) {
    html += '<div style="border-bottom:1px solid #2c313a;padding-bottom:16px;margin-bottom:16px;">'
      + '<div style="' + caps + 'color:#f2a33c;">The lead</div>'
      + '<div class="ni-lead" style="' + serif + 'font-size:22px;font-weight:600;line-height:1.27;color:#f0eee8;margin-top:6px;">'
      + '<a href="' + esc(d.lead.url) + '" style="color:#f0eee8;text-decoration:none;">' + esc(d.lead.title) + '</a></div>'
      + '<div class="ni-lede" style="font-size:15px;line-height:1.52;color:#c2c8d2;margin-top:7px;">'
      + scNiBoldFigures_(esc(d.lead.text)) + analysisRun(d.lead.analysis) + '</div>'
      + srcLine(d.lead) + '</div>';
  }
  html += sectionHtml('Covered companies', d.sections.companies, '#e6e4de', '#2c313a')
    + sectionHtml('US AIDC market &amp; policy', d.sections.market, '#e6e4de', '#2c313a')
    + sectionHtml('Incidents &amp; community', d.sections.incidents, '#e05d5d', '#4a2c2c');
  if (d.newCoverage && d.newCoverage.count) {
    html += '<div style="border:1px solid #363c45;background:#1b1e24;border-radius:4px;'
      + 'padding:12px 16px;margin:6px 0 14px;">'
      + '<div style="' + caps + 'color:#e6e4de;">Newly covered</div>'
      + '<div style="font-size:15px;line-height:1.52;color:#c2c8d2;margin-top:5px;">Profiler added '
      + '<b style="color:#f2a33c;">' + Number(d.newCoverage.count) + ' compan'
      + (d.newCoverage.count === 1 ? 'y' : 'ies') + '</b>'
      + (d.newCoverage.names.length ? ' — ' + esc(d.newCoverage.names.join(', ')) : '')
      + '; folded into this edition automatically. Review them from the Interests panel.</div></div>';
  }
  // The count printed here and the list View More opens must be the SAME fact.
  // This used to be `relevant - shown` — arithmetic over counts, computed with
  // no reference to d.heldBack at all. So the footer could confidently promise
  // "6 more held back" while the stored list the overlay reads was empty or
  // unreadable, and the reader got "Nothing was held back" one click later.
  // Two independent sources for one number can only ever drift; taking the
  // number FROM the list makes the contradiction impossible to express.
  // heldBackTotal is the true count (d.heldBack itself is capped for display,
  // and the overlay says "showing the top N of total" when they differ).
  // Editions built before heldBackTotal existed fall back to the arithmetic.
  var held = d.heldBackTotal == null
    ? Math.max(0, Number(d.counts.relevant) - Number(d.counts.shown || 0))
    : Number(d.heldBackTotal) || 0;
  // The key for the amber run above. Only printed when the edition actually
  // contains analysis — an edition built before the split, or one whose
  // summaries all fell back to raw source text, has nothing amber in it and a
  // key would be explaining something that is not there.
  var hasAnalysis = !!(d.lead && d.lead.analysis);
  ['companies', 'market', 'incidents'].forEach(function(sec) {
    ((d.sections && d.sections[sec]) || []).forEach(function(it) {
      if (it && it.analysis) hasAnalysis = true;
    });
  });
  // "View More" opens the held-back stories — the ones that cleared the
  // relevance bar but did not fit a section cap. It points at the embedding
  // page, never at /exec directly: a direct link is a cookie-carrying
  // navigation that Google resolves against the reader's default account (see
  // scClickUrl_). With nothing held back the slot is left empty — an edition
  // that showed everything relevant has nothing more to offer, and any link
  // there would only be a link to somewhere the reader did not ask to go.
  var moreLink = held
    ? '<a href="' + esc(EMBED_PAGE_URL + '?more=' + encodeURIComponent(d.id))
      + '" style="font-size:11px;font-weight:600;color:#f2a33c;text-decoration:none;">'
      + 'View More (' + held + ') →</a>'
    : '';
  // One stacked block, not a two-column row. The old footer needed a media query
  // to stack on a phone, and a query that can be stripped is not something a
  // layout should depend on. Stacked unconditionally it is correct at every
  // width with no CSS at all.
  html += '<div style="border-top:3px double #d8dbe1;margin-top:9px;padding-top:11px;">'
    + '<div class="ni-foot" style="font-size:11px;line-height:1.5;color:#8a919d;">'
    + 'Published by your Scraper desk · '
    + (hasAnalysis ? '<span style="color:#f2a33c;">Amber = analysis</span> · ' : '')
    + Number(d.counts.shown || 0) + ' of ' + Number(d.counts.relevant)
    + ' relevant · ' + Number(d.counts.intake) + ' scanned'
    + (held ? ' · ' + held + ' more held back by the per-section caps' : '')
    + (d.aiNote ? ' · summaries in fallback mode'
        : (d.aiLabel ? ' · summarized by ' + esc(d.aiLabel)
             + (d.aiSoftNote ? ' · a few summaries fell back to source text' : '')
           : '')) + '</div>'
    + (moreLink ? '<div style="margin-top:8px;">' + moreLink + '</div>' : '')
    + '</div>'
    + '</td></tr></table>'
    + '<!--[if mso]></td></tr></table><![endif]-->'
    + '</td></tr></table>';
  return html;
}

/** Desktop enlargement. Note the direction: the INLINE styles carry the phone
    sizes and this block scales them UP above 600px — the opposite of how it was
    written, and the reason it is written that way now.

    A max-width block that shrinks for phones only works if the block survives.
    Gmail drops the whole <style> element when it contains anything it does not
    support (Outlook-targeting code is a documented trigger, and this shell has
    MSO conditional comments in it), and when that happened the email fell back
    to the inline DESKTOP sizes: a 44px masthead wrapping to three lines on a
    390px screen, which is what the developer was sent.

    Inverted, the failure mode is harmless. Inline styles are never stripped, so
    a lost <style> block leaves a phone-shaped email — correct on the surface it
    is mostly read on, and merely a little large on a desktop. The landing page
    is a browser, where the block always applies, so it is unchanged. */
function scNiMobileCss_() {
  return '@media only screen and (min-width:601px){'
    + '.ni-pad{padding:32px 30px 26px!important}'
    + '.ni-mast{font-size:44px!important;line-height:1.06!important}'
    + '.ni-lead{font-size:32px!important;line-height:1.18!important}'
    + '.ni-lede{font-size:17px!important;line-height:1.62!important}'
    + '.ni-hed{font-size:22px!important;line-height:1.3!important}'
    + '.ni-body{font-size:16px!important;line-height:1.62!important}'
    + '}';
}

/** One budget-bounded step of the digest state machine. A run left over
    from a previous day is abandoned and a fresh one starts. */
function scDigestStep_(editionId) {
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var t0 = Date.now();
  var today = scDigestClock_(new Date()).date;
  var wantEd = editionId || SCRAPER_EDITION_DEFAULT.id;
  // Read the SAME slot the steps write. This read used to be the no-argument
  // form, which falls back to the legacy single key — a key nothing writes any
  // more. Read and write then pointed at different properties: the loop set
  // phase 'done' on the per-edition slot, read a stale non-done state back from
  // the legacy one, reported done:false, and the client called again 600ms
  // later — re-running render and appending another Digests row every pass.
  var state = scDigestState_(wantEd);
  if (!state || state.phase === 'done' || state.date !== today ||
      (state.editionId || SCRAPER_EDITION_DEFAULT.id) !== wantEd) {
    state = scDigestStart_(ss, wantEd);
  }
  var info = null;
  if (state.phase === 'fetch') info = scDigestFetchStep_(ss, state, t0);
  else if (state.phase === 'backstop') info = scDigestBackstopStep_(ss, state, t0);
  else if (state.phase === 'summarize') info = scDigestSummarizeStep_(ss, state, t0);
  else if (state.phase === 'render') info = scDigestRenderStep_(ss, state);
  state = scDigestState_(wantEd) || state;
  return { success: true, id: state.id, date: state.date, phase: state.phase,
           edition: state.editionId || SCRAPER_EDITION_DEFAULT.id,
           done: state.phase === 'done', fetched: state.fetched || 0,
           kept: state.kept || 0, aiNote: state.aiNote || '',
           aiSoftNote: state.aiSoftNote || '', detail: info };
}

/** Scheduled entry (called from scSchedulerTick AFTER the pipeline pause
    gate): weekday mornings only, one step per tick, stops once today's
    edition exists. Never throws into the tick. */
function scDigestScheduledTick_() {
  var clock = scDigestClock_(new Date());
  if (clock.hour < SCRAPER_DIGEST_RUN_HOUR) return;
  var ss = scraperSs_();
  var state = scDigestState_();
  // A build already in flight today → keep advancing it to completion first.
  if (state && state.phase !== 'done' && state.date === clock.date) {
    var edId = state.editionId;
    var info = null;
    try { info = scDigestStep_(edId); } catch (e0) {}
    // The tick can be the pass that finishes a build the 06:00 run started, so
    // the marker has to be written here too or the schedule would re-run it.
    if (info && info.done) scMarkSchedBuilt_(edId, clock.date);
    return;
  }
  // Otherwise pick the first enabled edition that is DUE and not built today.
  var editions = scEditions_(ss);
  for (var i = 0; i < editions.length; i++) {
    if (scEditionDue_(editions[i], clock)) {
      var due = editions[i].id, r = null;
      try { r = scDigestStep_(due); } catch (e1) {}
      if (r && r.done) scMarkSchedBuilt_(due, clock.date);
      return;
    }
  }
}

/** ---- Delivery (separated from building, 2026-08-28) ------------------
    The send used to be the last thing scDigestRenderStep_ did, which had two
    consequences the developer asked to undo: every manual "Run intake now"
    also mailed the subscribers, and a scheduled edition went out whenever its
    build happened to finish — which, with an hourly trigger advancing one
    pipeline step per fire, was mid-afternoon rather than 7:00.

    Delivery is its own pass now. It mails every edition built today that has
    an empty Delivered cell, and refuses to send before SCRAPER_DIGEST_SEND_HOUR
    so an edition finished at 06:20 still lands at 7:00. */
function scDigestDeliverPending_(ss, opts) {
  opts = opts || {};
  var clock = scDigestClock_(new Date());
  if (!opts.force && clock.hour < SCRAPER_DIGEST_SEND_HOUR) return { sent: 0, held: 0 };
  // WEEKDAYS ONLY, CHECKED HERE — at the point of sending, not in the callers.
  //
  // The day guard lived in scDigestMorningRun and scDigestDeliveryRun but not
  // in this function, and scSchedulerTick calls this directly as an hourly
  // catch-up with no day check of its own. So an edition built on a Saturday —
  // which a manual build at 00:30 produces, and which is entirely legitimate —
  // sat undelivered until 07:00 and the tick mailed it, because the only gate
  // it passed through asked about the hour and never the day.
  //
  // Three callers each having to remember the same rule is how one of them
  // forgets. The rule belongs where the send happens: this is the only line of
  // code that can put an edition in a subscriber's inbox, so it is the only
  // place the weekday rule cannot be routed around. The two callers keep their
  // checks — they gate expensive work, not just the send — but nothing now
  // depends on them for correctness.
  //
  // `force` bypasses this exactly as it bypasses the hour check above. No
  // caller passes it today — the developer's manual "email me latest" is
  // emailLatestDigest, which sends through MailApp directly and never reaches
  // this function — so the flag is here for symmetry with the hour gate and for
  // a future caller that legitimately needs an off-schedule scheduled send.
  if (!opts.force && SCRAPER_DIGEST_RUN_DAYS.indexOf(clock.isoDay) === -1) {
    return { sent: 0, held: 0, skipped: 'weekend' };
  }
  if (!SCRAPER_SCHED_EMAIL_ENABLED) return { sent: 0, held: 0 };
  var sheet = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var n = sheet ? sheet.getLastRow() - 1 : 0;
  if (n < 1) return { sent: 0, held: 0 };
  if (sheet.getMaxColumns() < 14) return { sent: 0, held: 0 };   // schema not widened yet
  var meta = sheet.getRange(2, 1, n, 3).getValues();             // id, date, generatedAt
  var eds  = sheet.getRange(2, 10, n, 1).getValues();            // edition
  var deliv = sheet.getRange(2, 14, n, 1).getValues();           // delivered
  // Numbering first: the mailed copy is the one that can never be corrected
  // afterwards, so it is the one that most needs to be right.
  try { scRenumberIssues_(ss); } catch (renErr) {}
  var nos = {};
  try { nos = scIssueNumbers_(ss); } catch (noErr) {}

  // ONE email per edition per day, however many rows are stored.
  //
  // Under the current drop guard a rebuild replaces that day's row, so this
  // grouping normally finds exactly one candidate per edition and changes
  // nothing. It is kept as the second line of defence, because the loop below
  // mails EVERY undelivered row dated today and runs hourly from
  // scSchedulerTick: if the drop guard ever missed — a sheet read that failed,
  // two rows whose date cells typed differently — the duplicate row would
  // become a duplicate email to every subscriber. A duplicate row is a
  // nuisance; a duplicate send cannot be taken back.
  //
  // So group today's rows by edition and choose one: the newest by
  // generatedAt. Any other undelivered row in the group is stamped
  // 'superseded' — a real value, so the hourly pass stops reconsidering it, and
  // a named one, so the cell says why it never went out. If any row in the
  // group already carries a genuine send (a Date, as opposed to a marker like
  // 'no-recipients'), nothing in that group mails at all.
  var groups = {};
  for (var g = 0; g < n; g++) {
    if (!String(meta[g][0] || '').trim()) continue;
    if (scIssueDateKey_(meta[g][1]) !== clock.date) continue;
    var gEd = String(eds[g][0] || '').trim() || SCRAPER_EDITION_DEFAULT.id;
    var grp = groups[gEd] || (groups[gEd] = { rows: [], sentAlready: false });
    var gd = deliv[g][0];
    if (gd instanceof Date) grp.sentAlready = true;
    grp.rows.push({ i: g, at: meta[g][2] ? new Date(meta[g][2]).getTime() : 0 });
  }
  var chosen = {};      // sheet index -> true, the one row per edition that may mail
  for (var edKey in groups) {
    if (!Object.prototype.hasOwnProperty.call(groups, edKey)) continue;
    var grp2 = groups[edKey];
    if (grp2.sentAlready) continue;                              // nothing mails today
    var best = grp2.rows[0];
    for (var r = 1; r < grp2.rows.length; r++) {
      // >= so an equal timestamp resolves to the later row, which is the later
      // append — two builds inside the same second are still ordered.
      if (grp2.rows[r].at >= best.at) best = grp2.rows[r];
    }
    chosen[best.i] = true;
  }

  var sent = 0, held = 0;
  for (var i = 0; i < n; i++) {
    var id = String(meta[i][0] || '').trim();
    if (!id) continue;
    if (String(deliv[i][0] || '').trim()) continue;              // already delivered
    if (scIssueDateKey_(meta[i][1]) !== clock.date) continue;    // only today's
    var edId = String(eds[i][0] || '').trim() || SCRAPER_EDITION_DEFAULT.id;
    var row = i + 2;
    // A scheduled build for this edition is still running today. The 06:00 run
    // is chunked across continuation triggers, so it can still be working at
    // 07:00 — and this row is the one it is about to replace. Sending it now
    // would deliver exactly the stale copy the rebuild exists to discard.
    // Left pending, not stamped: the pass that follows the finished build
    // picks it up.
    if (scDigestBuildInFlight_(edId, clock.date)) { held++; continue; }
    if (!chosen[i]) {
      // Superseded by a newer build of the same day, or the day already mailed.
      sheet.getRange(row, 14).setValue('superseded');
      held++;
      continue;
    }
    var to = scEditionRecipients_(ss, edId).join(',');
    if (!to) {
      // Nobody is subscribed to this edition. Stamp it so the pass does not
      // reconsider the same row every hour, and say why in the cell — a silent
      // skip is exactly how "it just did not email" goes undiagnosed.
      sheet.getRange(row, 14).setValue('no-recipients');
      held++;
      continue;
    }
    try {
      var edName = scRewriteLegacyNames_(String(scEditionById_(ss, edId).name || edId));
      var html = scRewriteIssueNo_(
        scRewriteLegacyNames_(scRewriteLegacyClickUrls_(String(sheet.getRange(row, 8).getValue() || ''))),
        nos[id] || 0);
      if (!html) { sheet.getRange(row, 14).setValue('no-html'); held++; continue; }
      MailApp.sendEmail({ to: to,
        subject: edName + ' — ' + clock.date + ' (No. ' + scDigestNo_(nos[id] || 1) + ')',
        htmlBody: html });
      sheet.getRange(row, 14).setValue(new Date());
      sent++;
    } catch (mailErr) {
      // Leave Delivered empty so the next pass retries rather than dropping it.
      held++;
    }
  }
  return { sent: sent, held: held };
}

/** ---- The 7:00 weekday delivery, and the build that feeds it ----------

    Apps Script caps one execution at 6 minutes on a consumer account
    (developers.google.com/apps-script/guides/services/quotas), and the pipeline
    needs far longer than that for three editions: 30 feeds at 6 per step, plus
    backstop, summarize and render. So the build cannot be "one run at 7:00".

    Instead the build starts at SCRAPER_DIGEST_BUILD_HOUR, works to a budget
    safely inside the execution cap, and schedules a one-off continuation a
    minute out when there is more to do. Delivery is held until
    SCRAPER_DIGEST_SEND_HOUR, so editions finished early wait and go out
    together at 7:00. */
function scDigestMorningRun() {
  var t0 = Date.now();
  try {
    PropertiesService.getScriptProperties().setProperty('SCHEDULER_LAST_TICK', String(Date.now()));
  } catch (hbErr) {}
  scDigestClearContinuations_();
  if (!SCRAPER_SCHED_RUNS_ENABLED) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  var more = false;
  try {
    var ss = scraperSs_();
    ensureScraperTabs_(ss);
    var clock = scDigestClock_(new Date());
    if (SCRAPER_DIGEST_RUN_DAYS.indexOf(clock.isoDay) === -1) return;
    // Same change as scEditionDue_: the 06:00 run rebuilds even when the day
    // already has an edition, because replacing it is the point.
    var editions = scEditions_(ss).filter(function(ed) {
      return ed.enabled && !scSchedBuiltToday_(ed.id, clock.date)
        && scEditionCadenceDue_(ed, clock);
    });
    // Every due edition, in roster order, to completion — within the budget.
    for (var i = 0; i < editions.length; i++) {
      var finished = false;
      while ((Date.now() - t0) < SCRAPER_DIGEST_RUN_BUDGET_MS) {
        var info = null;
        try { info = scDigestStep_(editions[i].id); } catch (stepErr) { break; }
        if (info && info.done) { finished = true; break; }
      }
      // Marked only on completion. A build cut short by the budget resumes on
      // the continuation trigger and is marked when it actually finishes — so
      // an interrupted build is retried rather than silently counted as done.
      if (finished) scMarkSchedBuilt_(editions[i].id, clock.date);
      if ((Date.now() - t0) >= SCRAPER_DIGEST_RUN_BUDGET_MS) { more = true; break; }
    }
    try { scDigestDeliverPending_(ss); } catch (delErr) {}
  } finally {
    lock.releaseLock();
  }
  // Out of budget with work left → come back in a minute rather than in an hour.
  if (more) scDigestScheduleContinuation_();
}

/** The 7:00 pass. Sends whatever is built and pending; if the build is still
    running it will be sent by the continuation that finishes it. */
function scDigestDeliveryRun() {
  try {
    PropertiesService.getScriptProperties().setProperty('SCHEDULER_LAST_TICK', String(Date.now()));
  } catch (hbErr) {}
  if (!SCRAPER_SCHED_RUNS_ENABLED) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var ss = scraperSs_();
    ensureScraperTabs_(ss);
    var clock = scDigestClock_(new Date());
    if (SCRAPER_DIGEST_RUN_DAYS.indexOf(clock.isoDay) === -1) return;
    scDigestDeliverPending_(ss);
  } finally { lock.releaseLock(); }
}

/** Cadence only — the hour and built-today checks belong to the caller, which
    is what lets the morning run apply them once for the whole batch. */
function scEditionCadenceDue_(ed, clock) {
  if (ed.cadence === 'daily') return SCRAPER_DIGEST_RUN_DAYS.indexOf(clock.isoDay) !== -1;
  if (ed.cadence === 'weekly') return clock.isoDay === (ed.anchor || 5);
  if (ed.cadence === 'monthly') return clock.dom === (ed.anchor || 1);
  return false;
}

/** Continuations get their own handler name purely so the cleanup below can
    tell them apart from the daily build trigger. Both do the same work — if
    they shared a name, clearing spent continuations would also delete the
    daily trigger and the schedule would silently stop after one morning. */
function scDigestContinueRun() { scDigestMorningRun(); }

function scDigestScheduleContinuation_() {
  try {
    ScriptApp.newTrigger('scDigestContinueRun').timeBased().after(60000).create();
  } catch (trigErr) { /* no scriptapp scope — the hourly tick still catches up */ }
}

/** Spent one-off continuations stay in the project's trigger list forever
    unless deleted, and Apps Script caps triggers per script — an unbounded
    daily leak would eventually refuse to create any trigger at all, including
    the daily ones. Cleared at the top of every run. */
function scDigestClearContinuations_() {
  try {
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === 'scDigestContinueRun') ScriptApp.deleteTrigger(t);
    });
  } catch (clrErr) {}
}

/** Advance the digest build one step (the app loops until done). */
function runDigestNow(sessionToken, editionId) {
  validateSessionForData(sessionToken, 'runDigestNow');
  return scDigestStep_(editionId || SCRAPER_EDITION_DEFAULT.id);
}

/** Current run state, if any. */
function getDigestStatus(sessionToken) {
  validateSessionForData(sessionToken, 'getDigestStatus');
  var state = scDigestState_();
  return { success: true, state: state ? {
    id: state.id, date: state.date, phase: state.phase, done: state.phase === 'done',
    fetched: state.fetched || 0, kept: state.kept || 0, aiNote: state.aiNote || '',
    aiSoftNote: state.aiSoftNote || '' } : null };
}

/** The News Stand's read path: recent editions newest-first, filtered and paged
    on the server.

    This used to call getDataRange().getValues(), which pulls all twelve columns
    — including the stored Night Ink HTML and the sections JSON, each capped at
    45,000 characters — for every issue ever built, and then kept six small
    fields. At ~60 KB of markup per issue that is the ceiling this app reaches
    first, well before the interface feels crowded, and it is why the Digests
    tab had to be trimmed so aggressively. Reading only the narrow columns is
    what makes a deep archive affordable.

    `payload` (JSON, optional): { edition, from, to, q, offset, limit }.
    `limit` is still honoured on its own so existing callers keep working. */
function listDigests(sessionToken, limit, payload) {
  validateSessionForData(sessionToken, 'listDigests');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var p = {};
  if (payload) { try { p = JSON.parse(payload) || {}; } catch (pErr) { p = {}; } }
  var sheet = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var n = sheet.getLastRow() - 1;
  var max = Math.max(1, Math.min(60, Number(p.limit) || Number(limit) || 12));
  var empty = { success: true, digests: [], total: 0, offset: 0, limit: max,
                counts: { all: 0, byEdition: {} } };
  if (n < 1) return empty;

  // Two narrow reads instead of one wide one: columns 1–6 (id → relevantCount)
  // and 9–12 (notes, edition, ai, lead). Columns 7 and 8 — Sections and HTML —
  // are never touched here.
  var meta = sheet.getRange(2, 1, n, 6).getValues();
  // Lead (column 12) may not exist yet on a sheet created before it was added.
  // ensureScraperTabs_ widens the header, but the grid itself can still be
  // narrower, so clamp and pad rather than throwing.
  var tailW = Math.max(1, Math.min(6, sheet.getMaxColumns() - 8));
  var tail = sheet.getRange(2, 9, n, tailW).getValues();

  var edNames = {}, edParent = {};
  try {
    scEditions_(ss).forEach(function(e) {
      edNames[e.id] = e.name;
      if (e.parent) edParent[e.id] = e.parent;
    });
  } catch (edErr) {}

  // Numbers computed here rather than trusted from the sheet, so the list is
  // right even between a deletion and the renumber pass that follows it.
  var issueNos = {};
  try { issueNos = scIssueNumbers_(ss); } catch (noErr) {}

  var rows = [];
  for (var i = 0; i < n; i++) {
    var t = tail[i] || [];
    var edId = String(t[1] || SCRAPER_EDITION_DEFAULT.id);
    var id = String(meta[i][0]);
    rows.push({
      id: id,
      date: meta[i][1] instanceof Date
        ? Utilities.formatDate(meta[i][1], 'America/New_York', 'yyyy-MM-dd') : String(meta[i][1]),
      generatedAt: meta[i][2] ? new Date(meta[i][2]).toISOString() : '',
      status: String(meta[i][3]),
      itemCount: Number(meta[i][4]) || 0,
      relevantCount: Number(meta[i][5]) || 0,
      notes: String(t[0] || ''),
      edition: edId, editionName: edNames[edId] || edId,
      ai: String(t[2] || ''), lead: String(t[3] || ''),
      no: issueNos[id] || Number(t[4]) || 0,
      delivered: t[5] instanceof Date ? t[5].toISOString() : String(t[5] || '')
    });
  }
  // Sort by the edition's own date, newest first — NOT by sheet row order.
  // Rows are appended in build order, so a rebuilt older day used to jump to
  // the top of the News Stand ahead of newer issues. Ties (two builds of one
  // day) fall back to which was generated later, then to the id so the order is
  // total and a redraw never reshuffles equal rows.
  rows.sort(function(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.generatedAt !== b.generatedAt) return a.generatedAt < b.generatedAt ? 1 : -1;
    return a.id < b.id ? 1 : (a.id > b.id ? -1 : 0);
  });

  // Selecting a parent masthead includes its variants; selecting a variant does
  // not reach back up to the parent.
  var want = null;
  var edPick = scStr_(p.edition || '', 40);
  if (edPick && edPick !== 'all') {
    want = {}; want[edPick] = true;
    for (var kid in edParent) { if (edParent[kid] === edPick) want[kid] = true; }
  }
  var from = scStr_(p.from || '', 10), to = scStr_(p.to || '', 10);
  var q = scStr_(p.q || '', 120).toLowerCase();
  function passOthers(r) {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    if (q && (r.lead + ' ' + r.editionName + ' ' + r.notes).toLowerCase().indexOf(q) === -1) {
      return false;
    }
    return true;
  }

  // Rail counts answer "how many would I get if I clicked this", so they honour
  // every active filter EXCEPT the edition one they are offering. A count that
  // ignored the date range would promise 200 issues and then show 23.
  var byEdition = {}, all = 0;
  rows.forEach(function(r) {
    if (!passOthers(r)) return;
    all++;
    byEdition[r.edition] = (byEdition[r.edition] || 0) + 1;
  });

  var matched = rows.filter(function(r) {
    return (!want || want[r.edition]) && passOthers(r);
  });
  var offset = Math.min(Math.max(0, Number(p.offset) || 0), matched.length);
  return { success: true, digests: matched.slice(offset, offset + max),
           total: matched.length, offset: offset, limit: max,
           counts: { all: all, byEdition: byEdition } };
}

/** One edition: parsed section JSON + the Night Ink HTML. Empty id = latest.

    Locates the row by scanning the id column alone, then reads the two heavy
    columns for that single row. Reading the whole sheet to return one issue
    scaled with the size of the archive rather than with the request. */
function getDigest(sessionToken, digestId) {
  validateSessionForData(sessionToken, 'getDigest');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var n = sheet.getLastRow() - 1;
  if (n < 1) return { success: false, error: 'not_found' };
  var want = scStr_(digestId, 60);
  var row = 0;
  if (!want) {
    row = n + 1;                       // newest issue is the last sheet row
  } else {
    var ids = sheet.getRange(2, 1, n, 1).getValues();
    for (var i = n - 1; i >= 0; i--) {
      if (String(ids[i][0]) === want) { row = i + 2; break; }
    }
  }
  if (!row) return { success: false, error: 'not_found' };
  var heavy = sheet.getRange(row, 7, 1, 2).getValues()[0];
  var sections = null;
  try { sections = JSON.parse(String(heavy[0] || 'null')); } catch (e) {}
  // Editions built before the click-link fix carry direct /exec links, which
  // hit Google's account routing; editions built before 2026-08-28 carry the
  // retired "The Morning Edition" masthead. Both are upgraded on read so the
  // whole archive is current, not just editions built from here on.
  if (sections && sections.editionName) {
    sections.editionName = scRewriteLegacyNames_(sections.editionName);
  }
  // Issue numbers are congruent with the archive as it stands now, not as it
  // stood when the edition was built: deleting an issue reflows the rest, so
  // the stored number has to be recomputed rather than trusted.
  var thisId = String(sheet.getRange(row, 1).getValue());
  var issueNo = scIssueNumbers_(ss)[thisId] || 0;
  if (sections && issueNo) sections.no = issueNo;
  var body = scRewriteLegacyNames_(scRewriteLegacyClickUrls_(String(heavy[1] || '')));
  return { success: true, id: thisId, no: issueNo || null,
           digest: sections, html: scRewriteIssueNo_(body, issueNo) };
}

/** Delete one edition (Digests row + its DigestIntake rows). The developer
    curates which Morning Digests to keep; deletion is permanent. */
function deleteDigest(sessionToken, digestId) {
  var user = validateSessionForData(sessionToken, 'deleteDigest');
  var id = scStr_(digestId, 60);
  if (!id) return { success: false, error: 'digest_id_required' };
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: false, error: 'busy' };
  try {
    var digests = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
    // Scan the id column only — matching a row never needed the stored HTML.
    var dn = digests.getLastRow() - 1;
    var found = false;
    if (dn > 0) {
      var dids = digests.getRange(2, 1, dn, 1).getValues();
      for (var i = dn - 1; i >= 0; i--) {
        if (String(dids[i][0]) === id) { digests.deleteRow(i + 2); found = true; }
      }
    }
    if (!found) return { success: false, error: 'not_found' };
    var intake = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE);
    var idata = intake.getDataRange().getValues();
    for (var j = idata.length - 1; j >= 1; j--) {
      if (String(idata[j][0]) === id) intake.deleteRow(j + 1);
    }
    // Deleting an issue moves every later issue of the same masthead up one.
    // Persist that now rather than leaving the stored rows disagreeing with
    // what the app shows.
    var renumbered = 0;
    try { renumbered = scRenumberIssues_(ss); } catch (renErr) {}
    dataAuditLog((user && user.email) || 'unknown', 'delete', 'digest', id,
                 'edition removed' + (renumbered ? '; ' + renumbered + ' renumbered' : ''));
    return { success: true, id: id, renumbered: renumbered };
  } finally {
    lock.releaseLock();
  }
}

/** Masked email for status display — never returns the full address. */
function scMaskEmail_(addr) {
  var m = /^(.)[^@]*(@.+)$/.exec(String(addr || ''));
  return m ? m[1] + '***' + m[2] : '';
}

// Gate for the digest control actions that change spend or delivery — the AI
// provider switch and the recipient list. While false (single-user owner),
// any signed-in user may manage them. Flip to true once other Gmails can log
// in with their own access levels (the multi-user expansion) and only admin /
// developer roles will be allowed to switch providers or edit recipients;
// everyone else sees the controls read-only. Reading go-live status and the
// self-service "email me latest" test are never gated.
var SCRAPER_DIGEST_ADMIN_ONLY = false;

/** Whether `user` may change the AI provider or the recipient list. */
function scCanManageDigest_(user) {
  if (!SCRAPER_DIGEST_ADMIN_ONLY) return true;
  var role = (user && user.role) || '';
  return role === 'admin' || role === 'developer';
}

/** Basic email shape check (server-side guard for recipient input). */
function scValidEmail_(addr) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(addr || '').trim());
}

/** Current digest recipients as a de-duplicated array. DIGEST_RECIPIENT is a
    comma-separated list (MailApp.sendEmail accepts the same form for `to`). */
function scDigestRecipients_() {
  var raw = PropertiesService.getScriptProperties().getProperty('DIGEST_RECIPIENT') || '';
  var seen = {}, out = [];
  raw.split(',').forEach(function(e) {
    var v = String(e || '').trim();
    var k = v.toLowerCase();
    if (v && !seen[k]) { seen[k] = true; out.push(v); }
  });
  return out;
}

/** Go-live readiness snapshot (Phase 4): provider config, delivery config,
    trigger health. Reads state only — makes no AI call (testAi does that)
    and never returns secret values, only presence booleans. */
function goLiveStatus(sessionToken) {
  var user = validateSessionForData(sessionToken, 'goLiveStatus');
  var props = PropertiesService.getScriptProperties();
  var provider = (props.getProperty('AI_PROVIDER') || SCRAPER_AI_PROVIDER).toLowerCase();
  var model;
  if (provider === 'claude') {
    model = props.getProperty('ANTHROPIC_MODEL') || SCRAPER_CLAUDE_MODEL;
  } else {
    model = props.getProperty('GEMINI_MODEL') || props.getProperty('GEMINI_MODEL_AUTO')
            || '(auto-discovers on first call)';
  }
  var trigger = 'unknown';
  try {
    trigger = ScriptApp.getProjectTriggers().some(function(t) {
      return t.getHandlerFunction() === 'scSchedulerTick';
    }) ? 'installed' : 'missing';
  } catch (trigErr) {
    trigger = 'unverifiable — authorize the script.scriptapp permission to check';
  }
  var lastTick = Number(props.getProperty('SCHEDULER_LAST_TICK')) || 0;
  var canManage = scCanManageDigest_(user);
  // Delivery is driven by the Subscribers roster (Phase 5), NOT by the legacy
  // DIGEST_RECIPIENT property — scDigestSend_ resolves who gets an edition
  // through scEditionRecipients_. Reading the property here made the landing
  // tile and the Digest overlay report a list nothing sends to, so a
  // subscriber added in Tune showed up in neither. Read the roster instead;
  // the property survives only as the one-time migration source.
  var roster = [];
  try {
    var glSs = scraperSs_();
    scMigrateLegacyRecipients_(glSs);
    roster = scSubscribers_(glSs);
  } catch (rosterErr) {}
  var mining = { total: 0, mined: 0, pending: 0, lastMined: 0 };
  try { mining = scDossierMiningStats_(scraperSs_()); } catch (mnErr) {}
  var activeSubs = roster.filter(function(s) { return s.status === 'active'; });
  // Managers see full addresses (they need them to identify the right row);
  // everyone else sees them masked.
  var subscribers = roster.map(function(s) {
    return { email: canManage ? s.email : scMaskEmail_(s.email), name: s.name,
             editions: s.editions, status: s.status, admin: s.admin };
  });
  return { success: true,
    provider: provider, model: model,
    hasGeminiKey: !!props.getProperty('GEMINI_API_KEY'),
    hasAnthropicKey: !!props.getProperty('ANTHROPIC_API_KEY'),
    // The full roster, so the Digest overlay can scope recipients to whichever
    // edition is selected without a second round trip.
    subscribers: subscribers,
    recipients: activeSubs.map(function(s) {
      return canManage ? s.email : scMaskEmail_(s.email);
    }),
    recipientCount: activeSubs.length,
    subscriberCount: activeSubs.length,
    canManageRecipients: canManage,
    runsEnabled: SCRAPER_SCHED_RUNS_ENABLED,
    emailEnabled: SCRAPER_SCHED_EMAIL_ENABLED,
    trigger: trigger,
    lastTickAgeMin: lastTick ? Math.round((Date.now() - lastTick) / 60000) : null,
    lastEditionDate: props.getProperty('DIGEST_LAST_DATE') || '',
    mining: mining };
}

/** Switch the AI provider between the free Gemini tier and Claude (Sonnet).
    Writes only the AI_PROVIDER property — the model each provider uses is the
    code default (Claude → claude-sonnet-5) unless an ANTHROPIC_MODEL /
    GEMINI_MODEL override is set. Gated: changes spend for the whole app. */
function setAiProvider(sessionToken, provider) {
  var user = validateSessionForData(sessionToken, 'setAiProvider');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var p = String(provider || '').toLowerCase().trim();
  if (p !== 'gemini' && p !== 'claude') return { success: false, error: 'invalid_provider' };
  PropertiesService.getScriptProperties().setProperty('AI_PROVIDER', p);
  dataAuditLog((user && user.email) || 'unknown', 'update', 'config', 'AI_PROVIDER', p);
  return { success: true, provider: p };
}

/** Add one recipient to the digest delivery list (gated). */
function addDigestRecipient(sessionToken, email) {
  var user = validateSessionForData(sessionToken, 'addDigestRecipient');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var addr = String(email || '').trim();
  if (!scValidEmail_(addr)) return { success: false, error: 'invalid_email' };
  var list = scDigestRecipients_();
  if (list.some(function(e) { return e.toLowerCase() === addr.toLowerCase(); })) {
    return { success: true, recipients: list };  // idempotent — already present
  }
  list.push(addr);
  PropertiesService.getScriptProperties().setProperty('DIGEST_RECIPIENT', list.join(','));
  dataAuditLog((user && user.email) || 'unknown', 'update', 'config', 'DIGEST_RECIPIENT', 'add ' + scMaskEmail_(addr));
  return { success: true, recipients: list };
}

/** Remove one recipient from the digest delivery list (gated). */
function removeDigestRecipient(sessionToken, email) {
  var user = validateSessionForData(sessionToken, 'removeDigestRecipient');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var addr = String(email || '').trim().toLowerCase();
  if (!addr) return { success: false, error: 'invalid_email' };
  var kept = scDigestRecipients_().filter(function(e) { return e.toLowerCase() !== addr; });
  PropertiesService.getScriptProperties().setProperty('DIGEST_RECIPIENT', kept.join(','));
  dataAuditLog((user && user.email) || 'unknown', 'update', 'config', 'DIGEST_RECIPIENT', 'remove ' + scMaskEmail_(email));
  return { success: true, recipients: kept };
}

/** One tiny live call through the configured provider (~30 tokens — free on
    Gemini's tier, well under a cent on Claude). Proves the whole AI path
    end-to-end and surfaces the exact failure when it is broken. */
function testAi(sessionToken) {
  validateSessionForData(sessionToken, 'testAi');
  var props = PropertiesService.getScriptProperties();
  var provider = (props.getProperty('AI_PROVIDER') || SCRAPER_AI_PROVIDER).toLowerCase();
  try {
    var reply = aiComplete_('Reply with exactly one word: READY', 16);
    return { success: true, ok: true, provider: provider, reply: scStr_(reply, 80) };
  } catch (aiErr) {
    return { success: true, ok: false, provider: provider,
             error: scStr_(String((aiErr && aiErr.message) || aiErr), 200) };
  }
}

/** Real-inbox test: mail the latest stored edition to the signed-in user.
    Deliberately independent of DIGEST_RECIPIENT — this is the pre-go-live
    rendering check, sent only to whoever pressed the button. */
function emailLatestDigest(sessionToken) {
  var user = validateSessionForData(sessionToken, 'emailLatestDigest');
  var to = (user && user.email) || '';
  if (!to) return { success: false, error: 'no_session_email' };
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  // Only the newest row is needed — reading the whole sheet loaded every stored
  // edition's HTML to send one of them.
  var dSheet = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var lastRow = dSheet.getLastRow();
  if (lastRow < 2) return { success: false, error: 'no_editions' };
  var row = dSheet.getRange(lastRow, 1, 1, Math.min(11, dSheet.getMaxColumns())).getValues()[0];
  var html = String(row[7] || '');
  if (!html) return { success: false, error: 'edition_has_no_html' };
  var date = row[1] instanceof Date
    ? Utilities.formatDate(row[1], 'America/New_York', 'yyyy-MM-dd') : String(row[1]);
  MailApp.sendEmail({ to: to,
    subject: scEditionById_(ss, String(row[9] || '')).name + ' — ' + date + ' (inbox test)',
    htmlBody: html });
  dataAuditLog(to, 'email', 'digest', String(row[0]), 'inbox test sent');
  return { success: true, to: scMaskEmail_(to),
           truncated: html.length >= SCRAPER_DIGEST_CELL_MAX };
}

// ── Scheduler ───────────────────────────────────────────────────────────
// An hourly time-driven trigger walks the Schedules tab and drives each due
// schedule through the same chunked pipeline the UI buttons use:
// compile → analyze (scoring + auto-distill) → brief → deliver (Reports tab
// + email). Long runs phase-step within a tick budget and resume next tick;
// per-schedule run state persists in Script Properties. The trigger installs
// itself on page load (doGet) and can also be created manually by running
// setupSchedulerTrigger() in the Apps Script editor.

var SCRAPER_SCHED_TICK_BUDGET_MS = 240000;  // wall-clock budget per tick (under the 6-min GAS limit)
var SCRAPER_SCHED_MAX_FAILS = 6;            // consecutive failed ticks before a run is abandoned (+ failure email)
var SCRAPER_SCHED_RUN_HOUR = 7;             // scheduled runs anchor at 7:00 AM ET
var SCRAPER_SCHED_STATE_PREFIX = 'scSchedRun_';
var SCRAPER_SCHED_AI_PAUSE_MS = 4000;       // pause between analyze chunks (free-tier RPM safety)
// Master kill switch for ALL scheduled email delivery — Your Morning Digest
// send and (when the legacy pipeline is enabled) the brief email + failure
// notice. Phase 4 go-live (2026-08-27): flipped to true. Your Morning Digest
// send additionally requires a DIGEST_RECIPIENT Script Property — with the
// property unset, nothing is emailed even though this flag is on.
var SCRAPER_SCHED_EMAIL_ENABLED = true;
// Master pause for the scheduled pipeline. Phase 4 go-live (2026-08-27):
// flipped to true — the hourly tick now advances the weekday Morning Digest
// build (weekday ≥7:00 AM ET, one budget-bounded step per tick). AI tokens
// are spent only if an AI provider key is configured; without one the
// edition builds in $0 fallback mode. Flip to false and merge to re-pause.
var SCRAPER_SCHED_RUNS_ENABLED = true;
// The pre-rebuild schedule-based pipeline (Schedules tab → compile/analyze/
// brief → per-schedule brief emails) stays OFF at go-live: the Morning
// Edition replaces it, and reviving old Schedules rows unattended would
// double-email and double-spend. The code path is preserved — flip to true
// and merge to run legacy schedules again alongside Your Morning Digest.
var SCRAPER_LEGACY_SCHEDULES_ENABLED = false;

/** Manual fallback: run once from the Apps Script editor to install the trigger. */
function setupSchedulerTrigger() {
  scEnsureSchedulerTrigger_(true);
}

/** Idempotent hourly-trigger install. Cheap after the first call (property
    guard); delete the SCHEDULER_TRIGGER_SET Script Property to force a re-check. */
function scEnsureSchedulerTrigger_(force) {
  var props = PropertiesService.getScriptProperties();
  // The property stores the last VERIFICATION time, not a one-shot flag: a
  // trigger can be deleted (manually, or by project re-authorization) after
  // the flag was set, silently killing all scheduled runs. Re-verify against
  // the real trigger list at most once per 24h (legacy value '1' counts as
  // stale, so existing deployments re-verify on their next page load).
  var last = Number(props.getProperty('SCHEDULER_TRIGGER_SET')) || 0;
  if (!force && last && (Date.now() - last) < 86400000) return;
  var handlers = {};
  ScriptApp.getProjectTriggers().forEach(function(t) { handlers[t.getHandlerFunction()] = true; });
  // The hourly tick stays: it carries the heartbeat and the daily Interests
  // sync, and it is the catch-up path if a morning run is missed entirely.
  if (!handlers.scSchedulerTick) {
    ScriptApp.newTrigger('scSchedulerTick').timeBased().everyHours(1).create();
  }
  // The build, an hour ahead of delivery so the pipeline has time to finish.
  if (!handlers.scDigestMorningRun) {
    ScriptApp.newTrigger('scDigestMorningRun').timeBased()
      .atHour(SCRAPER_DIGEST_BUILD_HOUR).nearMinute(0).everyDays(1)
      .inTimezone(SCRAPER_DIGEST_TZ).create();
  }
  // The send. Separate from the build on purpose: whatever is ready goes out
  // at 7:00 even if another edition is still building, and an edition that
  // finished at 06:20 is not mailed early.
  if (!handlers.scDigestDeliveryRun) {
    ScriptApp.newTrigger('scDigestDeliveryRun').timeBased()
      .atHour(SCRAPER_DIGEST_SEND_HOUR).nearMinute(0).everyDays(1)
      .inTimezone(SCRAPER_DIGEST_TZ).create();
  }
  props.setProperty('SCHEDULER_TRIGGER_SET', String(Date.now()));
}

/** Next run for a frequency, anchored at SCRAPER_SCHED_RUN_HOUR (project TZ),
    stepping forward from `from`. Custom parses "every N days" / "N days" from
    customConfig, falling back to weekly. Pure — unit-testable. */
function scNextRun_(freq, from, customConfig) {
  var d = new Date(from.getTime());
  var addMonths = { monthly: 1, quarterly: 3, biannual: 6, annual: 12 };
  if (addMonths[freq]) {
    d.setMonth(d.getMonth() + addMonths[freq]);
  } else {
    var days = freq === 'weekly' ? 7 : 1;
    if (freq === 'custom') {
      var m = String(customConfig || '').match(/(\d+)\s*day/i);
      days = (m && Number(m[1]) > 0) ? Number(m[1]) : 7;
    }
    d.setDate(d.getDate() + days);
  }
  d.setHours(SCRAPER_SCHED_RUN_HOUR, 0, 0, 0);
  return d;
}

/** Hourly trigger entry point. */
function scSchedulerTick() {
  // Heartbeat FIRST (before the lock): proof-of-life for getSchedulerHealth.
  // ScriptApp-based verification needs the script.scriptapp scope, which many
  // deployments lack — a recent heartbeat proves the trigger fires without
  // needing any permission at all.
  try {
    PropertiesService.getScriptProperties().setProperty('SCHEDULER_LAST_TICK', String(Date.now()));
  } catch (hbErr) {}
  // Rebuild Phase 1: daily Profiler-registry → Interests sync. Deliberately
  // BEFORE the pipeline pause gate — the sync spends no AI tokens and sends
  // no email (one static GitHub Pages fetch + sheet writes), and keeping the
  // Interests tab current while the digest pipeline is paused is what lets
  // the Phase 2 panel and the Phase 4 go-live start from live data. It
  // throttles itself to ~once/day and must never break the tick.
  try { scSyncInterests_(false); } catch (interestsErr) {}
  if (!SCRAPER_SCHED_RUNS_ENABLED) return;  // pipeline paused — heartbeat only
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;  // a previous tick is still running
  try {
    var ss = scraperSs_();
    ensureScraperTabs_(ss);
    // Rebuild Phase 3: the weekday Morning Digest — one budget-bounded step
    // per tick (weekday-morning + built-today checks live inside). Sits after
    // the pipeline pause gate, so it cannot spend AI tokens while paused.
    scDigestScheduledTick_();
    // Catch-up delivery. The 7:00 pass is the normal path; this covers the case
    // where the morning build was still running at 7:00, or the day the daily
    // triggers were missing entirely. It refuses to send before the send hour,
    // so it can never mail an edition early.
    try { scDigestDeliverPending_(ss); } catch (delErr) {}
    // Phase 4 go-live: the legacy Schedules-tab pipeline below stays gated off
    // (Your Morning Digest replaces it) — see SCRAPER_LEGACY_SCHEDULES_ENABLED.
    if (!SCRAPER_LEGACY_SCHEDULES_ENABLED) return;
    var t0 = Date.now();
    var sheet = ss.getSheetByName(SCRAPER_TABS.SCHEDULES);
    var data = sheet.getDataRange().getValues();
    var now = new Date();
    var props = PropertiesService.getScriptProperties();
    for (var i = 1; i < data.length; i++) {
      if ((Date.now() - t0) >= SCRAPER_SCHED_TICK_BUDGET_MS) break;
      var active = data[i][6] === true || String(data[i][6]).toLowerCase() === 'true';
      if (!active) continue;
      var inFlight = !!props.getProperty(SCRAPER_SCHED_STATE_PREFIX + String(data[i][0]));
      var nextRun = data[i][7] ? new Date(data[i][7]) : null;
      // Due when: a run is already in flight (finish it), or Next Run has
      // passed, or Next Run was never set (fresh schedule → first run now).
      if (!inFlight && nextRun && nextRun.getTime() > now.getTime()) continue;
      scRunScheduleStep_(ss, sheet, i + 1, data[i], t0);
    }
  } finally {
    lock.releaseLock();
  }
}

/** Report whether the hourly scheduler trigger actually exists — attempting a
    (re)install first. The auto-install in doGet swallows errors to protect
    page loads, which let a missing `script.scriptapp` OAuth scope hide for
    weeks: every install attempt failed silently and no schedule ever ran.
    This action surfaces the real error so the UI can show a fix-it banner. */
function getSchedulerHealth(sessionToken) {
  validateSessionForData(sessionToken, 'getSchedulerHealth');
  // Evidence first: a tick heartbeat within the last 2h proves the trigger is
  // live — even when the script.scriptapp scope is missing, so a MANUALLY
  // added trigger verifies correctly. (The previous version only trusted
  // ScriptApp.getProjectTriggers(), which throws without the scope — it kept
  // reporting "not installed" even after the user added the trigger by hand.)
  var lastTick = 0;
  try {
    lastTick = Number(PropertiesService.getScriptProperties()
      .getProperty('SCHEDULER_LAST_TICK')) || 0;
  } catch (ltErr) {}
  if (lastTick && (Date.now() - lastTick) < 7200000) {
    return { success: true, installed: true, verifiedBy: 'heartbeat', lastTick: lastTick };
  }
  try {
    scEnsureSchedulerTrigger_(true);
    var n = ScriptApp.getProjectTriggers().filter(function(t) {
      return t.getHandlerFunction() === 'scSchedulerTick';
    }).length;
    return { success: true, installed: n > 0, triggers: n, verifiedBy: 'scriptapp' };
  } catch (thErr) {
    // Can't verify either way: no heartbeat yet AND no permission to look.
    // A just-added manual trigger lands here until its first hourly run.
    return { success: true, installed: false, unverified: true,
             error: String((thErr && thErr.message) || thErr).slice(0, 300) };
  }
}

/** Advance one schedule's run as far as the tick budget allows. */
function scRunScheduleStep_(ss, sheet, rowNum, row, t0) {
  var scheduleId = String(row[0]);
  var owner = String(row[2]);
  var freq = String(row[3]);
  var customConfig = String(row[4] || '');
  var delivery = String(row[5] || 'inapp');
  var props = PropertiesService.getScriptProperties();
  var key = SCRAPER_SCHED_STATE_PREFIX + scheduleId;

  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var pRow = scFindProjectRow_(pSheet, String(row[1]), owner);
  var project = pRow ? scProjectFromRow_(pSheet.getRange(pRow, 1, 1, 12).getValues()[0]) : null;
  if (!project || project.status !== 'active') {
    // Paused/archived/deleted: skip this cycle but advance Next Run so the
    // row isn't perpetually due, and drop any half-finished run state.
    sheet.getRange(rowNum, 8).setValue(scNextRun_(freq, new Date(), customConfig));
    props.deleteProperty(key);
    return;
  }

  var run = null;
  try { run = JSON.parse(props.getProperty(key) || 'null'); } catch (runErr) { run = null; }
  if (!run) run = { phase: 'compile', startedAt: new Date().toISOString() };

  while ((Date.now() - t0) < SCRAPER_SCHED_TICK_BUDGET_MS) {
    try {
      if (run.phase === 'compile') {
        if (scCompileChunk_(ss, owner, project).done) run.phase = 'analyze';
      } else if (run.phase === 'analyze') {
        var a = scAnalyzeChunk_(ss, owner, project);
        if (a.done) run.phase = 'brief';
        else Utilities.sleep(SCRAPER_SCHED_AI_PAUSE_MS);  // free-tier RPM spacing
      } else {  // brief + deliver + finish
        var b = scBriefCore_(ss, owner, project);
        if (b) scDeliverBrief_(ss, owner, project, freq, delivery, b);
        var now2 = new Date();
        sheet.getRange(rowNum, 8, 1, 2).setValues([[scNextRun_(freq, now2, customConfig), now2]]);
        props.deleteProperty(key);
        dataAuditLog(owner, 'scheduled-run', 'project', project.id,
          freq + (b ? ' — brief ' + b.articleCount + ' articles' : ' — no relevant articles'));
        return;
      }
    } catch (stepErr) {
      // Transient failure (AI hiccup, feed timeout): persist progress and let
      // the next hourly tick resume this phase. A consecutive-failure counter
      // caps the retries — without it a persistent error (bad key, quota,
      // malformed feed) leaves the run stuck in flight FOREVER: no brief, no
      // email, no Next Run advance, and total silence toward the user.
      run.fails = (run.fails || 0) + 1;
      run.lastError = String((stepErr && stepErr.message) || stepErr).slice(0, 200);
      if (run.fails >= SCRAPER_SCHED_MAX_FAILS) {
        // Abandon this cycle: reschedule, clear state, and TELL the user.
        sheet.getRange(rowNum, 8).setValue(scNextRun_(freq, new Date(), customConfig));
        props.deleteProperty(key);
        dataAuditLog(owner, 'scheduled-run-failed', 'project', project.id,
          run.phase + ' failed ' + run.fails + 'x — ' + run.lastError);
        if ((delivery === 'email' || delivery === 'both') && SCRAPER_SCHED_EMAIL_ENABLED) {
          try {
            MailApp.sendEmail({
              to: owner,
              subject: 'News brief FAILED — ' + project.name,
              body: 'Your scheduled news brief for "' + project.name + '" could not be generated after '
                + run.fails + ' attempts.\n\nLast error (' + run.phase + ' step): ' + run.lastError
                + '\n\nThe schedule has moved to its next cycle and will try again automatically. '
                + 'You can also run Compile / Analyze manually from the app.'
            });
          } catch (failMailErr) { /* email quota/permission — audit row above still records the failure */ }
        }
        return;
      }
      props.setProperty(key, JSON.stringify(run));
      return;
    }
    run.fails = 0;  // a phase step succeeded — reset the consecutive-failure counter
  }
  props.setProperty(key, JSON.stringify(run));  // budget exhausted — resume next tick
}

/** Write the brief to the Reports tab and email it per the delivery setting. */
function scDeliverBrief_(ss, owner, project, freq, delivery, b) {
  var periodLabel = Utilities.formatDate(new Date(), 'America/New_York', 'MMM d, yyyy');
  var status = 'generated';
  if ((delivery === 'email' || delivery === 'both') && SCRAPER_SCHED_EMAIL_ENABLED) {
    try {
      MailApp.sendEmail({
        to: owner,
        subject: 'News brief — ' + project.name + ' (' + freq + ', ' + periodLabel + ')',
        body: b.brief + '\n\n—\nGenerated automatically by your News Scraper schedule ('
          + freq + '). Based on ' + b.articleCount + ' relevant articles.'
      });
      status = 'emailed';
    } catch (mailErr) {
      status = 'email_failed';
      // Surface the reason — 'email_failed' alone gives the user nothing to act on.
      dataAuditLog(owner, 'brief-email-failed', 'project', project.id,
        String((mailErr && mailErr.message) || mailErr).slice(0, 200));
    }
  }
  ss.getSheetByName(SCRAPER_TABS.REPORTS).appendRow([
    Utilities.getUuid(), project.id, owner, freq, periodLabel, new Date(),
    status, b.articleCount, b.brief]);
}

// ── Phase 3: AI layer ───────────────────────────────────────────────────
// Swappable provider abstraction: everything above this layer calls
// aiComplete_() only. Two providers are wired: Claude (Anthropic, paid — set
// ANTHROPIC_API_KEY + AI_PROVIDER=claude in Script Properties) and Gemini
// (free-tier fallback). The AI_PROVIDER Script Property switches providers
// without a code change; SCRAPER_AI_PROVIDER is the default when unset.

/** Provider-agnostic completion. Returns plain text or throws ai_* errors. */
function aiComplete_(prompt, maxTokens) {
  var provider = (PropertiesService.getScriptProperties().getProperty('AI_PROVIDER') ||
                  SCRAPER_AI_PROVIDER).toLowerCase();
  if (provider === 'claude') return scClaudeComplete_(prompt, maxTokens);
  if (provider === 'gemini') return scGeminiComplete_(prompt, maxTokens);
  throw new Error('ai_provider_not_configured');
}

function scClaudeComplete_(prompt, maxTokens) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('ANTHROPIC_API_KEY') || '';
  if (!key) throw new Error('ai_key_missing');
  var model = props.getProperty('ANTHROPIC_MODEL') || SCRAPER_CLAUDE_MODEL;
  var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: model,
      max_tokens: maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  var body = resp.getContentText() || '';
  if (code === 429) throw new Error('ai_rate_limited');
  if (code < 200 || code >= 300) {
    var apiMsg = '';
    try { apiMsg = (JSON.parse(body).error || {}).message || ''; } catch (e) {}
    throw new Error('ai_http_' + code + (apiMsg ? ' — ' + apiMsg.slice(0, 160) : ''));
  }
  var data;
  try { data = JSON.parse(body); } catch (e2) { throw new Error('ai_bad_json'); }
  var text = '';
  var blocks = (data && data.content) || [];
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i] && blocks[i].type === 'text') text += blocks[i].text || '';
  }
  // Same reason as the Gemini path: a reply cut off at the token ceiling must
  // not be reported as a parse failure further down.
  if (data && data.stop_reason === 'max_tokens') throw new Error('ai_truncated');
  if (!text) throw new Error('ai_empty_response');
  return text;
}

function scGeminiComplete_(prompt, maxTokens) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
  if (!key) throw new Error('ai_key_missing');
  var picked = scGeminiPickModel_(key, false);
  var resp = scGeminiCall_(key, picked.model, prompt, maxTokens);
  if (resp.getResponseCode() === 404 && !picked.explicit) {
    // Cached/auto model likely retired by Google — rediscover once and retry.
    picked = scGeminiPickModel_(key, true);
    resp = scGeminiCall_(key, picked.model, prompt, maxTokens);
  }
  var code = resp.getResponseCode();
  if (code === 429) throw new Error('ai_rate_limited');
  if (code !== 200) {
    var apiMsg = '';
    try { apiMsg = JSON.parse(resp.getContentText()).error.message || ''; } catch (emErr) {}
    throw new Error('ai_http_' + code + (apiMsg ? ' — ' + apiMsg.substring(0, 160) : ''));
  }
  var body = JSON.parse(resp.getContentText());
  var cand = (body.candidates && body.candidates[0]) || {};
  var parts = cand.content && cand.content.parts;
  var text = '';
  (parts || []).forEach(function(p) { if (p.text) text += p.text; });
  // finishReason was never read, so a reply the model had to cut short came
  // back looking like a clean success — and the caller then failed to parse a
  // JSON array with no closing bracket and reported `ai_bad_json`, which says
  // nothing about the actual cause. Thinking tokens count against
  // maxOutputTokens on the current models, so a long reasoning pass can eat the
  // whole budget and leave the text truncated or empty.
  // Refs: ai.google.dev/gemini-api/docs/tokens and the MAX_TOKENS-with-empty-text
  // reports on discuss.ai.google.dev.
  var finish = String(cand.finishReason || '');
  if (finish === 'MAX_TOKENS') throw new Error('ai_truncated');
  if (finish === 'SAFETY' || finish === 'RECITATION' || finish === 'PROHIBITED_CONTENT') {
    throw new Error('ai_blocked_' + finish.toLowerCase());
  }
  if (!text.trim()) throw new Error('ai_empty_response');
  return text;
}

function scGeminiCall_(key, model, prompt, maxTokens) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
          + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  return UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens || 2048, temperature: 0.2 }
    })
  });
}

/** Model choice: explicit GEMINI_MODEL property > cached auto-pick > live discovery. */
function scGeminiPickModel_(key, forceRefresh) {
  var props = PropertiesService.getScriptProperties();
  var explicit = props.getProperty('GEMINI_MODEL');
  if (explicit) return { model: explicit, explicit: true };
  if (!forceRefresh) {
    var cached = props.getProperty('GEMINI_MODEL_AUTO');
    if (cached) return { model: cached, explicit: false };
  }
  var model = scGeminiDiscoverModel_(key);
  props.setProperty('GEMINI_MODEL_AUTO', model);
  return { model: model, explicit: false };
}

/** Query ListModels and pick the best stable generateContent-capable Gemini model. */
function scGeminiDiscoverModel_(key) {
  var names = [];
  var pageToken = '';
  for (var page = 0; page < 5; page++) {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key='
            + encodeURIComponent(key)
            + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      throw new Error('ai_model_discovery_failed_http_' + resp.getResponseCode());
    }
    var body = JSON.parse(resp.getContentText());
    (body.models || []).forEach(function(m) {
      if ((m.supportedGenerationMethods || []).indexOf('generateContent') === -1) return;
      names.push(String(m.name || '').replace(/^models\//, ''));
    });
    pageToken = body.nextPageToken || '';
    if (!pageToken) break;
  }
  // Stable text models only; prefer flash-lite (cheapest/highest free quota),
  // then flash, then any Gemini; newest version wins, shortest (unsuffixed) name breaks ties.
  var usable = names.filter(function(n) {
    return /^gemini-/.test(n) && !/preview|exp|image|tts|live|audio|embed|thinking/.test(n);
  });
  function ver(n) { var m = n.match(/^gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; }
  function pick(re) {
    var c = usable.filter(function(n) { return re.test(n); });
    c.sort(function(a, b) { return (ver(b) - ver(a)) || (a.length - b.length); });
    return c[0] || '';
  }
  var model = pick(/flash-lite/) || pick(/flash/) || pick(/^gemini-/);
  if (!model) throw new Error('ai_model_not_found');
  return model;
}

/** Extract a JSON array from an AI response, in three widening passes.

    The old version took everything between the first '[' and the LAST ']' and
    parsed it or threw. That fails two ways that both really happen:

      - A reply cut off at the token ceiling has no closing bracket, so the
        whole batch was discarded even though the first four of five objects
        were complete and perfectly good.
      - lastIndexOf(']') is not string-aware, so a ']' inside a summary (or in
        trailing prose after the array) moved the boundary and broke an
        otherwise valid reply.

    Passes: (1) the fast whole-array parse, unchanged for the common case;
    (2) a string-aware scan for the array's real matching bracket; (3) salvage
    — every complete {...} object inside the array region, parsed one at a
    time. Only if all three come back empty is this a genuine ai_bad_json. */
function scParseJsonArray_(text) {
  var s = String(text == null ? '' : text);
  var start = s.indexOf('[');
  if (start === -1) throw new Error('ai_bad_json');

  var end = s.lastIndexOf(']');
  if (end > start) {
    try { return JSON.parse(s.substring(start, end + 1)); } catch (fastErr) {}
  }
  var balanced = scScanBalanced_(s, start, '[', ']');
  if (balanced) {
    try { return JSON.parse(balanced); } catch (balErr) {}
  }
  var salvaged = scSalvageObjects_(s, start);
  if (salvaged.length) return salvaged;
  throw new Error('ai_bad_json');
}

/** The substring from `from` to the bracket that actually closes it, or ''.
    String-aware: brackets inside quoted values, and escaped quotes, do not
    move the depth — which is the whole point of not using lastIndexOf. */
function scScanBalanced_(s, from, open, close) {
  var depth = 0, inStr = false, esc = false;
  for (var i = from; i < s.length; i++) {
    var c = s.charAt(i);
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return s.substring(from, i + 1); }
  }
  return '';
}

/** Every complete JSON object inside the array region, parsed individually.
    This is what rescues a truncated reply: the last object is half-written and
    is dropped, and everything before it is kept. */
function scSalvageObjects_(s, from) {
  var out = [];
  for (var i = from; i < s.length; i++) {
    if (s.charAt(i) !== '{') continue;
    var block = scScanBalanced_(s, i, '{', '}');
    if (!block) break;                 // truncated mid-object — nothing left to save
    try { out.push(JSON.parse(block)); } catch (objErr) { /* skip the bad one */ }
    i += block.length - 1;
  }
  return out;
}

/** The project scope as prompt lines (shared by scoring and the brief). */
function scScopePrompt_(project) {
  var lines = ['Topic: ' + project.topic];
  if (project.industries.length) lines.push('Industries: ' + project.industries.join(', '));
  if (project.keywords.length) lines.push('Priority keywords: ' + project.keywords.join(', '));
  if (project.exclusions.length) lines.push('Exclude coverage of: ' + project.exclusions.join(', '));
  if (project.regions.length) lines.push('Regions/languages: ' + project.regions.join(', '));
  return lines.join('\n');
}

/** 👍/👎 exemplar titles as prompt lines — the immediate "learning" channel:
    every scoring batch sees what the user personally confirmed or rejected. */
function scFeedbackPrompt_(feedback) {
  if (!feedback || (!feedback.ups.length && !feedback.downs.length)) return '';
  // Balance the channels: a 👎-heavy history (common early on, when calibration
  // served mostly junk) must not read as a one-sided lesson in rejection.
  // Downs shown are capped at ups + 2 and framed as filtered junk rather than
  // a relevance ceiling — an all-downs prompt measurably collapsed scores to
  // near-zero across a 2000-article corpus.
  var downs = feedback.downs.slice(0, feedback.ups.length + 2);
  var fb = 'USER FEEDBACK (articles this user personally rated in this project):\n';
  if (feedback.ups.length) {
    fb += 'Rated RELEVANT — score articles like these HIGH:\n'
      + feedback.ups.map(function(t) { return '- ' + t; }).join('\n') + '\n';
  }
  if (downs.length) {
    fb += 'Obvious junk the user filtered out (unrelated to their interests — do NOT '
      + 'treat this as a relevance ceiling for adjacent coverage):\n'
      + downs.map(function(t) { return '- ' + t; }).join('\n') + '\n';
  }
  return fb + '\n';
}

/** Load a project's learned-preferences row from the Preferences tab.
    Returns {row, note, keywords, verdictsUsed} or null when never distilled.
    Ownership is enforced upstream: callers only pass project IDs the session
    owner was already matched against via scFindProjectRow_. */
function scGetPrefs_(ss, projectId) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.PREFERENCES);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] !== projectId) continue;
    return {
      row: i + 1,
      note: String(data[i][2] || ''),
      keywords: scList_(data[i][3], SCRAPER_PREFS_KEYWORDS_MAX, 60),
      verdictsUsed: Number(data[i][4] || 0)
    };
  }
  return null;
}

/** Learned-preferences note as prompt lines (scoring + brief context). */
function scPrefsPrompt_(prefsNote) {
  if (!prefsNote) return '';
  return 'LEARNED USER PREFERENCES (distilled from all of this user\'s ratings — '
    + 'weigh these heavily):\n' + prefsNote + '\n\n';
}

/** Distill ALL of a project's 👍/👎 ratings into a learned-preferences note plus
    suggested search keywords, persisted to the Preferences tab (one AI call).
    The note feeds every future scoring prompt; the keywords widen Compile and
    Backfill queries — the "improve fetching" half of the feedback loop. */
function scDistillFeedback_(ss, user, project, rated, totalVerdicts) {
  var prompt = 'You are learning a user\'s news preferences from their article ratings '
    + 'in a monitoring project.\n\n'
    + 'PROJECT SCOPE:\n' + scScopePrompt_(project) + '\n\n'
    + (rated.ups.length ? 'ARTICLES THE USER RATED RELEVANT:\n'
        + rated.ups.map(function(t) { return '- ' + t; }).join('\n') + '\n\n' : '')
    + (rated.downs.length ? 'ARTICLES THE USER RATED NOT RELEVANT:\n'
        + rated.downs.map(function(t) { return '- ' + t; }).join('\n') + '\n\n' : '')
    + 'From these ratings, distill:\n'
    + '1. "preferences": a concise note (under 150 words) describing what this user '
    + 'actually values and what they reject — specific themes, angles, technologies, '
    + 'and coverage types. Focus on what the ratings reveal that the project scope '
    + 'alone does not say. State the preferences POSITIVELY first — lead with what '
    + 'the user values (inferred from the scope plus the relevant-rated articles), '
    + 'even when most ratings are rejections; rejections get at most a short final '
    + 'sentence.\n'
    + '2. "keywords": up to ' + SCRAPER_PREFS_KEYWORDS_MAX + ' short search phrases '
    + '(2-4 words each) likely to find MORE articles like the ones rated relevant — '
    + 'concrete and searchable, no boolean operators. Go beyond literal phrases from '
    + 'the titles: include adjacent topics, synonyms, related technologies, and '
    + 'entities the relevant articles imply, to widen the search net.\n\n'
    + 'Respond with ONLY a JSON object, no markdown fences: '
    + '{"preferences":"...","keywords":["..."]}';
  var text = aiComplete_(prompt, 1024);
  var start = text.indexOf('{');
  var end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('ai_bad_json');
  var parsed;
  try { parsed = JSON.parse(text.substring(start, end + 1)); }
  catch (djErr) { throw new Error('ai_bad_json'); }
  var note = scStr_(parsed.preferences, SCRAPER_PREFS_NOTE_MAX);
  var keywords = scList_(parsed.keywords, SCRAPER_PREFS_KEYWORDS_MAX, 60);
  if (!note) throw new Error('ai_bad_json');

  var sheet = ss.getSheetByName(SCRAPER_TABS.PREFERENCES);
  var existing = scGetPrefs_(ss, project.id);
  var rowVals = [project.id, user.email, note, keywords.join(', '), totalVerdicts, new Date()];
  if (existing) sheet.getRange(existing.row, 1, 1, 6).setValues([rowVals]);
  else sheet.appendRow(rowVals);
  dataAuditLog(user.email, 'distill', 'project', project.id,
    totalVerdicts + ' verdicts -> ' + keywords.length + ' keywords');
  return { note: note, keywords: keywords };
}

/** Score one batch of articles against the project scope. Returns parsed items. */
function scScoreBatch_(project, batch, feedback, prefsNote) {
  var lines = [];
  batch.forEach(function(a, idx) {
    lines.push((idx + 1) + '. ' + a.title + ' — ' + a.source
      + (a.snippet ? '\n   ' + a.snippet : ''));
  });
  var prompt = 'You are a research analyst filtering news for a monitoring project.\n\n'
    + 'PROJECT SCOPE:\n' + scScopePrompt_(project) + '\n\n'
    + scPrefsPrompt_(prefsNote)
    + scFeedbackPrompt_(feedback)
    + 'ARTICLES:\n' + lines.join('\n') + '\n\n'
    + 'Score each article\'s relevance to the project scope using this rubric:\n'
    + '- 80-100: squarely on-topic\n'
    + '- 50-79: clearly relevant subtopic\n'
    + '- 30-49: adjacent context worth awareness — corporate moves, financing, policy, '
    + 'supply chain, or partnerships involving players relevant to the scope\n'
    + '- 10-29: weak or speculative connection\n'
    + '- 0-9: unrelated\n'
    + 'Anything matching the "Exclude coverage of" list scores under 20. '
    + 'Some articles are headline-only (no body text): a missing body is NOT evidence '
    + 'of irrelevance — score these on what the headline plausibly covers, using the '
    + 'same rubric. Use the full range; do not default to the extremes.\n'
    + 'For articles scoring ' + SCRAPER_RELEVANT_THRESHOLD + ' or above, also write a factual 1-2 sentence summary '
    + 'based only on the title and text given. '
    + 'Respond with ONLY a JSON array, no markdown fences, one object per article in order: '
    + '[{"i":1,"score":85,"summary":"..."}] — omit or empty the summary for scores under '
    + SCRAPER_RELEVANT_THRESHOLD + '.';
  return scParseJsonArray_(aiComplete_(prompt, 2048));
}

/** Chunked relevance scoring: unscored articles are the natural resume state. */
function analyzeArticles(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'analyzeArticles');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);
  return scAnalyzeChunk_(ss, user.email, project);
}

/** Session-free analyze core — one bounded chunk (scoring + auto-distill).
    Shared by the analyzeArticles action and the scheduler. */
function scAnalyzeChunk_(ss, email, project) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.ARTICLES);
  var data = sheet.getDataRange().getValues();
  var pending = [];
  var hasArticles = false;
  var feedback = { ups: [], downs: [] };
  var rated = { ups: [], downs: [] };   // fuller lists for distillation
  var totalVerdicts = 0;
  for (var i = data.length - 1; i >= 1; i--) {  // reverse: newest verdicts win the exemplar slots
    if (data[i][1] !== project.id) continue;
    if (String(data[i][2]).toLowerCase() !== email.toLowerCase()) continue;
    hasArticles = true;
    var vd = String(data[i][11] || '');
    if (vd === 'up' || vd === 'down') {
      totalVerdicts++;
      var side = vd === 'up' ? 'ups' : 'downs';
      if (feedback[side].length < SCRAPER_FEEDBACK_EXAMPLES_MAX) feedback[side].push(String(data[i][4]));
      if (rated[side].length < SCRAPER_DISTILL_TITLES_MAX) rated[side].push(String(data[i][4]));
    }
    if (data[i][10] !== '') continue;  // already scored
    pending.push({ row: i + 1, title: String(data[i][4]), source: String(data[i][5]),
                   snippet: String(data[i][8]) });
  }
  pending.reverse();  // keep the original oldest-first scoring order

  // Distill when enough ratings exist AND the count changed since the last
  // distillation. Runs at most once per Analyze cycle: the first invocation
  // stores the new count, so the client's follow-up chunk calls skip it.
  var aiCalls = 0;
  var prefs = scGetPrefs_(ss, project.id);
  var distilledCount = 0;
  if (totalVerdicts >= SCRAPER_DISTILL_MIN_VERDICTS
      && (!prefs || prefs.verdictsUsed !== totalVerdicts)) {
    try {
      var d = scDistillFeedback_(ss, { email: email }, project, rated, totalVerdicts);
      aiCalls++;
      prefs = { note: d.note, keywords: d.keywords, verdictsUsed: totalVerdicts };
      distilledCount = totalVerdicts;
    } catch (dErr) {
      // Non-fatal: scoring proceeds with the previous note (or none). The next
      // Analyze retries because the stored verdict count still won't match.
    }
  }
  var prefsNote = prefs ? prefs.note : '';

  if (!pending.length) {
    if (aiCalls) scLogUsage_(ss, email, aiCalls, 0);
    return { success: true, done: true, analyzed: 0, remaining: 0, hasArticles: hasArticles,
             distilled: distilledCount };
  }

  var analyzed = 0;
  while (pending.length && aiCalls < SCRAPER_ANALYZE_CALLS_PER_INVOCATION + (distilledCount ? 1 : 0)) {
    var batch = pending.splice(0, SCRAPER_ANALYZE_ARTICLES_PER_CALL);
    var results = scScoreBatch_(project, batch, feedback, prefsNote);
    aiCalls++;
    results.forEach(function(r) {
      var idx = Number(r.i) - 1;
      if (idx < 0 || idx >= batch.length) return;
      var score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
      var summary = score >= SCRAPER_RELEVANT_THRESHOLD ? scStr_(r.summary, 500) : '';
      sheet.getRange(batch[idx].row, 10, 1, 2).setValues([[summary, score]]);
      analyzed++;
    });
  }
  scLogUsage_(ss, email, aiCalls, 0);
  var done = pending.length === 0;
  if (done) dataAuditLog(email, 'analyze', 'project', project.id, analyzed + ' articles scored');
  return { success: true, done: done, analyzed: analyzed, remaining: pending.length,
           distilled: distilledCount };
}

/** Executive brief synthesized from the top-scored relevant articles. */
function previewBrief(sessionToken, projectId) {
  var user = validateSessionForData(sessionToken, 'previewBrief');
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var pSheet = ss.getSheetByName(SCRAPER_TABS.PROJECTS);
  var rowNum = scFindProjectRow_(pSheet, String(projectId || ''), user.email);
  if (!rowNum) return { success: false, error: 'not_found' };
  var project = scProjectFromRow_(pSheet.getRange(rowNum, 1, 1, 12).getValues()[0]);
  var b = scBriefCore_(ss, user.email, project);
  if (!b) return { success: false, error: 'no_relevant_articles' };
  return { success: true, brief: b.brief, articleCount: b.articleCount };
}

/** Session-free brief core — shared by the previewBrief action and the
    scheduler. Returns {brief, articleCount} or null when no relevant articles. */
function scBriefCore_(ss, email, project) {
  var data = ss.getSheetByName(SCRAPER_TABS.ARTICLES).getDataRange().getValues();
  var relevant = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] !== project.id) continue;
    if (String(data[i][2]).toLowerCase() !== email.toLowerCase()) continue;
    if (data[i][10] === '' || Number(data[i][10]) < SCRAPER_RELEVANT_THRESHOLD) continue;
    relevant.push({ score: Number(data[i][10]), title: String(data[i][4]),
                    source: String(data[i][5]), summary: String(data[i][9] || data[i][8]) });
  }
  if (!relevant.length) return null;
  relevant.sort(function(a, b) { return b.score - a.score; });
  relevant = relevant.slice(0, SCRAPER_BRIEF_TOP_N);

  var lines = relevant.map(function(a, idx) {
    return (idx + 1) + '. [' + a.score + '] ' + a.title + ' (' + a.source + '): ' + a.summary;
  });
  var brPrefs = scGetPrefs_(ss, project.id);
  var prompt = 'You are writing an executive brief for a busy reader monitoring this scope:\n'
    + scScopePrompt_(project) + '\n\n'
    + scPrefsPrompt_(brPrefs ? brPrefs.note : '')
    + 'Source articles (relevance-scored):\n' + lines.join('\n') + '\n\n'
    + 'Write a plain-text executive brief: one short overview paragraph, then 4-8 concise '
    + 'bullet points (start each with "• ") grouping the most important developments. '
    + 'Base it ONLY on the articles above. No markdown, no headings, no preamble.';
  var brief = aiComplete_(prompt, 2048);
  scLogUsage_(ss, email, 1, 0);
  return { brief: brief.trim(), articleCount: relevant.length };
}

/** Route dispatcher shared by the doPost actions and the doGet api mirror. */

// ══════════════════════════════════════════════════════════════════════════
// Phase 5 — Editions, Subscribers, Click tracking, Dossier mining, Signals
// (all project-specific; lives in the PROJECT block)
// ══════════════════════════════════════════════════════════════════════════

var SCRAPER_DOSSIER_BASE = 'https://lightaisolutions.github.io/Sales/profiler-data/';

/** ---- Editions -------------------------------------------------------- */

/** All editions (default seeded if the tab is empty). */
function scEditions_(ss) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.EDITIONS);
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (!String(data[i][0]).trim()) continue;
    out.push({
      id: String(data[i][0]), name: String(data[i][1]),
      cadence: String(data[i][2] || 'daily'), anchor: Number(data[i][3]) || 0,
      windowH: Number(data[i][4]) || 0,
      enabled: data[i][5] === true || String(data[i][5]).toLowerCase() === 'true',
      lastBuilt: String(data[i][6] || ''), created: data[i][7], notes: String(data[i][8] || ''),
      tuning: scParseTuning_(data[i][9]), preset: String(data[i][10] || 'global'),
      parent: String(data[i][11] || '')
    });
  }
  if (!out.length) {
    var d = SCRAPER_EDITION_DEFAULT;
    sheet.appendRow([d.id, d.name, d.cadence, d.anchor, d.windowH, true, '', new Date(), '', '{}', 'global']);
    out.push({ id: d.id, name: d.name, cadence: d.cadence, anchor: d.anchor,
               windowH: d.windowH, enabled: true, lastBuilt: '', created: new Date(),
               notes: '', tuning: {}, preset: 'global' });
  }
  // Seeded ONCE, tracked by a Script Property rather than by absence: seeding
  // on absence would resurrect an edition the developer deliberately deleted.
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(SCRAPER_EDITION_SEEDS_KEY) !== 'done') {
    var have = {};
    out.forEach(function(e) { have[e.id] = true; });
    SCRAPER_EDITION_SEEDS.forEach(function(sd) {
      var map = scPresetMap_(sd.preset) || {};
      if (have[sd.id]) {
        // Already created by an earlier seed pass with a sparse map — upgrade
        // it in place rather than skipping, otherwise the edition keeps
        // silently inheriting for every key the old map did not mention.
        for (var h = 0; h < out.length; h++) {
          if (out[h].id !== sd.id) continue;
          out[h].tuning = map; out[h].preset = sd.preset;
          for (var hr = 1; hr < data.length; hr++) {
            if (String(data[hr][0]) !== sd.id) continue;
            sheet.getRange(hr + 1, 10, 1, 2).setValues([[JSON.stringify(map), sd.preset]]);
            break;
          }
          break;
        }
        return;
      }
      sheet.appendRow([sd.id, sd.name, sd.cadence, sd.anchor, sd.windowH, true, '',
                       new Date(), sd.notes || '', JSON.stringify(map), sd.preset,
                       sd.parent || '']);
      out.push({ id: sd.id, name: sd.name, cadence: sd.cadence, anchor: sd.anchor,
                 windowH: sd.windowH, enabled: true, lastBuilt: '', created: new Date(),
                 notes: sd.notes || '', tuning: map, preset: sd.preset,
                 parent: sd.parent || '' });
    });
    props.setProperty(SCRAPER_EDITION_SEEDS_KEY, 'done');
  }

  // Parent back-fill. The seeds gained a `parent` only after these editions
  // were already created, and the seed block above is gated 'done' so it never
  // runs again — without this the BESS and AIDC rows stay parentless and the
  // masthead rail cannot roll them up under Your Morning Digest. Idempotent:
  // it only fills an empty cell, so a parent the developer clears stays clear
  // until they say otherwise… except that an empty cell is exactly what
  // "cleared" looks like, so this is deliberately keyed to the seeded pairs
  // only and never invents a parent for an edition the developer created.
  var liveIds = {};
  out.forEach(function(e) { liveIds[e.id] = true; });
  SCRAPER_EDITION_SEEDS.forEach(function(sd) {
    if (!sd.parent || !liveIds[sd.parent]) return;
    for (var oi = 0; oi < out.length; oi++) {
      if (out[oi].id !== sd.id || out[oi].parent) continue;
      out[oi].parent = sd.parent;
      for (var pr = 1; pr < data.length; pr++) {
        if (String(data[pr][0]) !== sd.id) continue;
        sheet.getRange(pr + 1, 12).setValue(sd.parent);
        break;
      }
      break;
    }
  });

  // Masthead rename back-fill (2026-08-28). "Your Morning Digest" became
  // "Your Morning Digest". The seed block above is gated 'done', so the rows
  // created under the old names would keep them forever without this. Keyed to
  // the exact old string on the exact seeded id, so an edition the developer
  // renamed themselves is never touched — and once rewritten the comparison
  // no longer matches, which is what makes it idempotent.
  SCRAPER_EDITION_RENAMES.forEach(function(rn) {
    for (var oi = 0; oi < out.length; oi++) {
      if (out[oi].id !== rn.id || out[oi].name !== rn.from) continue;
      out[oi].name = rn.to;
      for (var rr = 1; rr < data.length; rr++) {
        if (String(data[rr][0]) !== rn.id) continue;
        sheet.getRange(rr + 1, 2).setValue(rn.to);
        break;
      }
      break;
    }
  });

  // Self-healing top-up: a materialised edition must carry an explicit value
  // for EVERY seeded interest. Without this, a segment shipped after the
  // edition was created would be absent from its map and quietly inherit the
  // global toggle — reintroducing the very coupling materialising removes.
  out.forEach(function(e) {
    if (e.preset === 'global') return;
    var full = scPresetMap_(e.preset);
    if (!full) return;
    var added = 0;
    for (var k in full) {
      if (!Object.prototype.hasOwnProperty.call(e.tuning, k)) { e.tuning[k] = full[k]; added++; }
    }
    if (!added) return;
    for (var r2 = 1; r2 < data.length; r2++) {
      if (String(data[r2][0]) !== e.id) continue;
      sheet.getRange(r2 + 1, 10).setValue(JSON.stringify(e.tuning));
      break;
    }
  });
  return out;
}

/** A split segment's broader parent, from the seed table. Sheet rows do not
    store the link — the seeds are its single source of truth. */
function scSegmentParent_(key) {
  for (var i = 0; i < SCRAPER_SEGMENT_SEEDS.length; i++) {
    if (SCRAPER_SEGMENT_SEEDS[i].key === key) return SCRAPER_SEGMENT_SEEDS[i].parent || '';
  }
  return '';
}

/** Parse a boolean that arrived over the wire.

    Values reach the server as STRINGS: the client sends '1' / '0'. Checking
    only for 'true' silently reads '1' as false, which is exactly how a
    per-edition toggle came back flipped — the write "succeeded", stored the
    opposite, and the client adopted the server's answer a second later.
    `setInterestEnabled` had always handled '1'; the newer endpoint retyped
    the check and dropped that case. One helper so a third endpoint cannot
    drift again.

    NOTE: this is for PARAMS only. The sheet-cell readers elsewhere parse
    stored booleans (`true` / 'TRUE'), never '1', and are correct as they are. */
function scParamBool_(v) {
  if (v === true) return true;
  var s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

/** Tuning cell -> override map. Never throws: a hand-mangled cell degrades to
    "no overrides" (i.e. the global model) rather than breaking every digest. */
function scParseTuning_(cell) {
  var raw = String(cell || '').trim();
  if (!raw) return {};
  try {
    var o = JSON.parse(raw);
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  } catch (e) { return {}; }
}

function scEditionById_(ss, id) {
  var want = String(id || SCRAPER_EDITION_DEFAULT.id);
  var all = scEditions_(ss);
  for (var i = 0; i < all.length; i++) if (all[i].id === want) return all[i];
  return all[0];
}

/** Cadence → window hours (pure). */
function scEditionWindowH_(ed, clock) {
  if (ed.windowH) return ed.windowH;
  if (ed.cadence === 'weekly') return 168;
  if (ed.cadence === 'monthly') return 720;
  return clock.isoDay === 1 ? 72 : SCRAPER_DIGEST_WINDOW_H;  // daily: 72h Mondays
}

/** Has TODAY'S SCHEDULED build already run for this edition?

    Distinct from `lastBuilt`, which any build sets — including a manual "Run
    intake now". That is the whole point. The morning run filtered on
    `ed.lastBuilt !== clock.date`, so an edition the developer had built by hand
    at 02:00 looked already-built at 06:00 and the scheduled run skipped it —
    leaving the hand-built copy to be emailed at 07:00. The developer asked for
    the opposite: the 06:00 run should produce a fresh edition and REPLACE
    whatever the day already had.

    `lastBuilt` still does its original job of stopping the hourly tick from
    rebuilding all day. This marker answers the narrower question the schedule
    actually needs, and only the scheduled path writes it. */
function scSchedBuiltKey_(editionId) {
  return 'scDigestSchedBuilt_' + String(editionId || SCRAPER_EDITION_DEFAULT.id);
}
function scSchedBuiltToday_(editionId, date) {
  try {
    return PropertiesService.getScriptProperties()
      .getProperty(scSchedBuiltKey_(editionId)) === date;
  } catch (e) { return false; }
}
function scMarkSchedBuilt_(editionId, date) {
  try {
    PropertiesService.getScriptProperties().setProperty(scSchedBuiltKey_(editionId), date);
  } catch (e) { /* a marker that fails to save costs one duplicate build, not a send */ }
}

/** Is a scheduled build for this edition still running today? Delivery has to
    know: if the 06:00 build overruns past 07:00 — it is chunked across
    continuation triggers — the send pass would otherwise ship the row the
    rebuild is about to replace, which is precisely the stale test edition the
    developer is trying not to receive. */
function scDigestBuildInFlight_(editionId, date) {
  var st = null;
  try { st = scDigestState_(editionId); } catch (e) { return false; }
  return !!(st && st.date === date && st.phase && st.phase !== 'done');
}

/** Is this edition due to build now? (pure given clock + lastBuilt) */
function scEditionDue_(ed, clock) {
  if (!ed.enabled) return false;
  if (clock.hour < SCRAPER_DIGEST_RUN_HOUR) return false;
  // The catch-up tick asks whether the SCHEDULED build has run, not whether
  // anything has. A manual test build must not satisfy the schedule.
  if (scSchedBuiltToday_(ed.id, clock.date)) return false;
  if (ed.cadence === 'daily') return SCRAPER_DIGEST_RUN_DAYS.indexOf(clock.isoDay) !== -1;
  if (ed.cadence === 'weekly') return clock.isoDay === (ed.anchor || 5);   // default Friday
  if (ed.cadence === 'monthly') return clock.dom === (ed.anchor || 1);
  return false;
}

function listEditions(sessionToken) {
  validateSessionForData(sessionToken, 'listEditions');
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var eds = scEditions_(ss);
  // Ship each edition's RECOMMENDED map alongside its current one so the UI
  // can mark the switches the developer has changed from the recommendation —
  // the client must not re-derive a recommendation, or the two definitions
  // drift and the markers start lying.
  eds.forEach(function(e) { e.recommended = scPresetMap_(e.preset) || {}; });
  var presets = [];
  for (var k in SCRAPER_TUNING_PRESETS) {
    presets.push({ key: k, label: SCRAPER_TUNING_PRESETS[k].label });
  }
  return { success: true, editions: eds, presets: presets };
}

function saveEdition(sessionToken, payload) {
  var user = validateSessionForData(sessionToken, 'saveEdition');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var p;
  try { p = JSON.parse(payload || '{}'); } catch (e) { return { success: false, error: 'bad_payload' }; }
  var name = scStr_(p.name, 80);
  if (!name) return { success: false, error: 'name_required' };
  var cadence = ['daily', 'weekly', 'monthly'].indexOf(String(p.cadence)) !== -1 ? p.cadence : 'daily';
  var anchor = Math.max(0, Math.min(31, Number(p.anchor) || 0));
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.EDITIONS);
  var data = sheet.getDataRange().getValues();
  var id = scStr_(p.id, 40);
  var enabled = p.enabled !== false;

  // `parent` makes this edition a variant of another masthead. Validated here
  // rather than trusted, because a bad value is not cosmetic: the News Stand
  // rail walks these links, so a self-reference or a chain would either hide an
  // edition from its own filter or recurse. Variants are deliberately capped at
  // one level — a variant cannot itself have variants, which makes cycles
  // impossible by construction instead of by cycle detection.
  var parent = scStr_(p.parent || '', 40);
  if (parent) {
    if (parent === id) return { success: false, error: 'parent_is_self' };
    var parentRow = null;
    for (var pi = 1; pi < data.length; pi++) {
      if (String(data[pi][0]) === parent) { parentRow = data[pi]; break; }
    }
    if (!parentRow) return { success: false, error: 'parent_not_found' };
    if (String(parentRow[11] || '')) return { success: false, error: 'parent_is_variant' };
    // Re-parenting an edition that already has variants of its own would create
    // the second level the rule above forbids.
    for (var ci = 1; ci < data.length; ci++) {
      if (id && String(data[ci][11] || '') === id) {
        return { success: false, error: 'has_variants' };
      }
    }
  }

  if (id) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        sheet.getRange(i + 1, 2, 1, 4).setValues([[name, cadence, anchor, Number(p.windowH) || 0]]);
        sheet.getRange(i + 1, 6).setValue(enabled);
        sheet.getRange(i + 1, 12).setValue(parent);
        dataAuditLog(user.email, 'update', 'edition', id, name + (parent ? ' ⊂ ' + parent : ''));
        return { success: true, id: id };
      }
    }
  }
  // A NEW edition is materialised from its preset, never left to inherit —
  // "start as a copy of Your Morning Digest until told otherwise" is precisely
  // the behaviour the developer rejected. Default 'all' rather than 'global'.
  var preset = SCRAPER_TUNING_PRESETS[String(p.preset)] ? String(p.preset) : 'all';
  var map = scPresetMap_(preset) || {};
  id = 'ed-' + Utilities.getUuid().slice(0, 8);
  sheet.appendRow([id, name, cadence, anchor, Number(p.windowH) || 0, enabled, '', new Date(), '',
                   JSON.stringify(map), preset, parent]);
  dataAuditLog(user.email, 'create', 'edition', id, name + (parent ? ' ⊂ ' + parent : ''));
  return { success: true, id: id, preset: preset };
}

/** Set (or clear) one interest override on one edition.

    `enabled` null/'' CLEARS the override, which is not the same as setting it
    false: cleared means "inherit the global toggle" and the key is removed
    from the map entirely, so an edition only ever stores what it actually
    changes. Writes only this edition's row, so tuning one edition can never
    disturb another — that isolation is the whole reason tuning lives on the
    edition row rather than as extra columns on the Interests sheet. */
function setEditionTuning(sessionToken, editionId, key, enabled) {
  var user = validateSessionForData(sessionToken, 'setEditionTuning');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_permitted' };
  var k = String(key || '').trim();
  if (!k) return { success: false, error: 'bad_key' };
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.EDITIONS);
  var data = sheet.getDataRange().getValues();
  var want = String(editionId || '');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== want) continue;
    var tuning = scParseTuning_(data[i][9]);
    if (enabled === null || enabled === undefined || enabled === '') delete tuning[k];
    else tuning[k] = scParamBool_(enabled);
    sheet.getRange(i + 1, 10).setValue(JSON.stringify(tuning));
    _scInterestModel = {};   // the cached model for this edition is now stale
    return { success: true, editionId: want, tuning: tuning };
  }
  return { success: false, error: 'not_found' };
}

/** Re-apply an edition's preset, discarding every change made since. Also
    accepts a NEW preset, which is how the developer re-bases an edition onto
    a different recommendation without deleting and recreating it. */
function resetEditionTuning(sessionToken, editionId, preset) {
  var user = validateSessionForData(sessionToken, 'resetEditionTuning');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_permitted' };
  var ss = scraperSs_();
  ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.EDITIONS);
  var data = sheet.getDataRange().getValues();
  var want = String(editionId || '');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== want) continue;
    var pk = SCRAPER_TUNING_PRESETS[String(preset)] ? String(preset)
                                                    : String(data[i][10] || 'all');
    var map = scPresetMap_(pk) || {};
    sheet.getRange(i + 1, 10, 1, 2).setValues([[JSON.stringify(map), pk]]);
    _scInterestModel = {};
    dataAuditLog(user.email, 'update', 'edition-tuning', want, pk);
    return { success: true, editionId: want, preset: pk, tuning: map };
  }
  return { success: false, error: 'not_found' };
}

function deleteEdition(sessionToken, editionId) {
  var user = validateSessionForData(sessionToken, 'deleteEdition');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var id = scStr_(editionId, 40);
  if (id === SCRAPER_EDITION_DEFAULT.id) return { success: false, error: 'cannot_delete_default' };
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.EDITIONS);
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === id) { sheet.deleteRow(i + 1); dataAuditLog(user.email, 'delete', 'edition', id, ''); return { success: true }; }
  }
  return { success: false, error: 'not_found' };
}

/** ---- Subscribers ----------------------------------------------------- */

function scSubscribers_(ss) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.SUBSCRIBERS);
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var email = String(data[i][0] || '').trim();
    if (!email) continue;
    out.push({
      email: email, name: String(data[i][1] || ''),
      editions: String(data[i][2] || '').split(',').map(function(x){return x.trim();}).filter(Boolean),
      status: String(data[i][3] || 'active'),
      admin: data[i][4] === true || String(data[i][4]).toLowerCase() === 'true',
      token: String(data[i][5] || ''), added: data[i][6], updated: data[i][7]
    });
  }
  return out;
}

/** Recipients (comma string) for one edition — active subscribers opted into
    it, OR into 'all'. Legacy DIGEST_RECIPIENT entries are migrated in once. */
function scEditionRecipients_(ss, editionId) {
  scMigrateLegacyRecipients_(ss);
  var subs = scSubscribers_(ss);
  var out = [];
  subs.forEach(function(s) {
    if (s.status !== 'active') return;
    if (s.editions.indexOf('all') !== -1 || s.editions.indexOf(editionId) !== -1) out.push(s.email);
  });
  return out;
}

/** One-time migration of the old DIGEST_RECIPIENT list into Subscribers. */
function scMigrateLegacyRecipients_(ss) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SUBSCRIBERS_MIGRATED') === '1') return;
  var legacy = scDigestRecipients_();
  if (legacy.length) {
    var sheet = ss.getSheetByName(SCRAPER_TABS.SUBSCRIBERS);
    var existing = {};
    scSubscribers_(ss).forEach(function(s){ existing[s.email.toLowerCase()] = true; });
    legacy.forEach(function(email) {
      if (existing[email.toLowerCase()]) return;
      sheet.appendRow([email, '', 'all', 'active', false,
        Utilities.getUuid().replace(/-/g, ''), new Date(), new Date()]);
    });
  }
  props.setProperty('SUBSCRIBERS_MIGRATED', '1');
}

function listSubscribers(sessionToken) {
  var user = validateSessionForData(sessionToken, 'listSubscribers');
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  scMigrateLegacyRecipients_(ss);
  var can = scCanManageDigest_(user);
  var subs = scSubscribers_(ss).map(function(s) {
    return { email: can ? s.email : scMaskEmail_(s.email), name: s.name,
             editions: s.editions, status: s.status, admin: s.admin };
  });
  return { success: true, subscribers: subs, canManage: can };
}

function saveSubscriber(sessionToken, payload) {
  var user = validateSessionForData(sessionToken, 'saveSubscriber');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var p;
  try { p = JSON.parse(payload || '{}'); } catch (e) { return { success: false, error: 'bad_payload' }; }
  var email = scStr_(p.email, 160).trim();
  if (!scValidEmail_(email)) return { success: false, error: 'invalid_email' };
  var eds = (p.editions || []).map(function(x) { return scStr_(x, 40).trim(); }).filter(Boolean);
  // "All editions" is absolute — pairing it with a specific edition is
  // contradictory, so it wins and the rest are discarded.
  if (eds.indexOf('all') !== -1) eds = ['all'];
  // An empty selection used to fall back to 'all'. On a first add that is a
  // harmless default; on an EDIT it silently re-subscribed someone to every
  // edition the moment their last box was unticked. Make it an explicit error
  // so an unsubscribe is done by pausing the row, never by emptying it.
  if (!eds.length) return { success: false, error: 'no_editions' };
  var seenEd = {}, uniqEds = [];
  eds.forEach(function(id) { if (!seenEd[id]) { seenEd[id] = true; uniqEds.push(id); } });
  eds = uniqEds;
  var status = p.status === 'paused' ? 'paused' : 'active';
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.SUBSCRIBERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email.toLowerCase()) {
      sheet.getRange(i + 1, 2, 1, 4).setValues([[scStr_(p.name, 80), eds.join(','),
        status, p.admin === true]]);
      sheet.getRange(i + 1, 8).setValue(new Date());
      dataAuditLog(user.email, 'update', 'subscriber', scMaskEmail_(email), eds.join(','));
      return { success: true };
    }
  }
  sheet.appendRow([email, scStr_(p.name, 80), eds.join(','), status, p.admin === true,
    Utilities.getUuid().replace(/-/g, ''), new Date(), new Date()]);
  dataAuditLog(user.email, 'create', 'subscriber', scMaskEmail_(email), eds.join(','));
  return { success: true };
}

function removeSubscriber(sessionToken, email) {
  var user = validateSessionForData(sessionToken, 'removeSubscriber');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var addr = scStr_(email, 160).trim().toLowerCase();
  if (!addr) return { success: false, error: 'invalid_email' };
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var sheet = ss.getSheetByName(SCRAPER_TABS.SUBSCRIBERS);
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim().toLowerCase() === addr) {
      sheet.deleteRow(i + 1);
      dataAuditLog(user.email, 'delete', 'subscriber', scMaskEmail_(email), '');
      return { success: true };
    }
  }
  return { success: false, error: 'not_found' };
}

/** ---- Share links ------------------------------------------------------

    A share link lets someone without an account read exactly one stored
    edition. The security model is deliberately narrow:

      · The token IS the reference. The share URL carries no digest id, so a
        holder of one token cannot pivot to another edition by editing the URL
        — the same reason scHandleClickRedirect_ resolves its target from the
        stored intake rows rather than from a query parameter.
      · 128 bits of entropy (a UUID with the dashes removed), so guessing is
        not a practical attack.
      · Revocable, and revocation is immediate — the serve path re-reads the
        row on every request rather than trusting a cached decision.
      · Read-only and single-purpose: the route returns one stored HTML body.
        It never accepts input that reaches a sheet write beyond a view counter,
        and it never exposes the app shell, a session, or any other tab.
      · Not secret-bearing: the Night Ink HTML is trade-press summaries, the
        same content that is emailed to subscribers.

    What a leaked link exposes is one edition — the same blast radius as
    forwarding the email. Revoke it and the link dies. */

function scShares_(ss) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.SHARES);
  var n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  var data = sheet.getRange(2, 1, n, 7).getValues();
  var out = [];
  for (var i = 0; i < n; i++) {
    if (!String(data[i][0]).trim()) continue;
    out.push({ token: String(data[i][0]), digestId: String(data[i][1]),
               createdBy: String(data[i][2]), created: data[i][3],
               revoked: data[i][4] === true || String(data[i][4]).toLowerCase() === 'true',
               views: Number(data[i][5]) || 0, lastViewed: data[i][6], row: i + 2 });
  }
  return out;
}

/** Share links for one edition (manager-only — a link is a grant). */
function listShares(sessionToken, digestId) {
  var user = validateSessionForData(sessionToken, 'listShares');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var id = scStr_(digestId, 60);
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var out = scShares_(ss).filter(function(sh) {
    return !sh.revoked && (!id || sh.digestId === id);
  }).map(function(sh) {
    return { token: sh.token, digestId: sh.digestId, views: sh.views,
             url: scShareUrl_(sh.token) };
  });
  return { success: true, shares: out };
}

function scShareUrl_(token) {
  return 'https://script.google.com/macros/s/' + DEPLOYMENT_ID + '/exec?action=share&t=' + token;
}

/** Mint a share link for one edition. Reuses the live link when one already
    exists, so pressing Share twice does not scatter tokens that all have to be
    revoked separately later. */
function createShareLink(sessionToken, digestId) {
  var user = validateSessionForData(sessionToken, 'createShareLink');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var id = scStr_(digestId, 60);
  if (!id) return { success: false, error: 'digest_id_required' };
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  // The edition must exist — minting a link for a deleted or mistyped id would
  // hand out a URL that can only ever 404.
  var digests = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var dn = digests.getLastRow() - 1;
  var found = false;
  if (dn > 0) {
    var ids = digests.getRange(2, 1, dn, 1).getValues();
    for (var i = 0; i < dn; i++) { if (String(ids[i][0]) === id) { found = true; break; } }
  }
  if (!found) return { success: false, error: 'not_found' };

  var existing = null;
  scShares_(ss).forEach(function(sh) {
    if (!sh.revoked && sh.digestId === id) existing = sh;
  });
  if (existing) {
    return { success: true, token: existing.token, url: scShareUrl_(existing.token),
             reused: true, views: existing.views };
  }
  var token = Utilities.getUuid().replace(/-/g, '');
  ss.getSheetByName(SCRAPER_TABS.SHARES)
    .appendRow([token, id, user.email, new Date(), false, 0, '']);
  dataAuditLog(user.email, 'create', 'share', id, 'share link minted');
  return { success: true, token: token, url: scShareUrl_(token), reused: false, views: 0 };
}

/** Revoke one share link. Takes effect on the next request — the serve path
    reads the row every time rather than caching the decision. */
function revokeShareLink(sessionToken, token) {
  var user = validateSessionForData(sessionToken, 'revokeShareLink');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var want = scStr_(token, 64);
  if (!want) return { success: false, error: 'token_required' };
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var hit = null;
  scShares_(ss).forEach(function(sh) { if (sh.token === want) hit = sh; });
  if (!hit) return { success: false, error: 'not_found' };
  ss.getSheetByName(SCRAPER_TABS.SHARES).getRange(hit.row, 5).setValue(true);
  dataAuditLog(user.email, 'delete', 'share', hit.digestId, 'share link revoked');
  return { success: true };
}

/** Serve one shared edition. Unauthenticated by design — that is the feature —
    but strictly bounded: the token names the edition, a revoked or unknown
    token gets a plain refusal, and nothing else about the app is reachable. */
function scHandleSharedEdition_(e) {
  var token = scStr_((e && e.parameter && e.parameter.t) || '', 64);
  // Every refusal message below is a literal in this file — no request input is
  // ever echoed back, which is why no escaping is needed here and why an
  // invalid token can never be reflected into the response.
  var deny = function(msg) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">'
      + '<title>Link unavailable</title>'
      + '<body style="font-family:system-ui,sans-serif;background:#15171c;color:#c9cdd4;'
      + 'display:flex;align-items:center;justify-content:center;height:100vh;margin:0">'
      + '<p>' + msg + '</p></body>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  };
  if (!/^[0-9a-f]{32}$/.test(token)) return deny('This link is not valid.');
  var ss, hit = null;
  try {
    ss = scraperSs_(); ensureScraperTabs_(ss);
    scShares_(ss).forEach(function(sh) { if (sh.token === token) hit = sh; });
  } catch (shErr) { return deny('This link could not be opened right now.'); }
  if (!hit || hit.revoked) return deny('This link has been revoked.');

  // Read only the row the token points at, and only its HTML column.
  var digests = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
  var dn = digests.getLastRow() - 1;
  var row = 0;
  if (dn > 0) {
    var ids = digests.getRange(2, 1, dn, 1).getValues();
    for (var i = dn - 1; i >= 0; i--) {
      if (String(ids[i][0]) === hit.digestId) { row = i + 2; break; }
    }
  }
  // An edition trimmed by retention leaves its link pointing at nothing. Say
  // so plainly rather than showing an empty page.
  if (!row) return deny('This edition is no longer available.');
  var html = String(digests.getRange(row, 8).getValue() || '');
  if (!html) return deny('This edition is no longer available.');
  // Same read-path upgrades getDigest applies: retired masthead, and legacy
  // direct-/exec article links that Google's account routing breaks. A share
  // recipient is the least likely of all readers to be signed into the right
  // Google account, so this one matters here more than anywhere.
  html = scRewriteLegacyNames_(scRewriteLegacyClickUrls_(html));
  html = scRewriteIssueNo_(html, scIssueNumbers_(ss)[hit.digestId] || 0);

  try {
    var sh = ss.getSheetByName(SCRAPER_TABS.SHARES);
    sh.getRange(hit.row, 6, 1, 2).setValues([[hit.views + 1, new Date()]]);
  } catch (cntErr) { /* a view counter must never block the read */ }

  // The stored body is server-rendered from escaped content (see the Night Ink
  // renderer), so it is emitted as-is inside a minimal, noindex wrapper. No app
  // shell, no session, no scripts of our own.
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Shared edition</title>'
    + '<body style="margin:0;background:#15171c">' + html + '</body>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** ---- Click tracking (T1a) -------------------------------------------- */

/** Log a click and 302-redirect to the real article. Unauthenticated by
    design: it only reads the stored edition's own intake rows to resolve the
    target URL (no open redirect — an arbitrary ?url= is never honored), and
    only appends one ClickLog row. Called from doGet(action=go). */
function scHandleClickRedirect_(e) {
  var digestId = (e && e.parameter && e.parameter.d) || '';
  var itemKey = (e && e.parameter && e.parameter.i) || '';
  var target = '', title = '', source = '', companies = '', topics = '', segments = '';
  try {
    var ss = scraperSs_();
    var intake = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE);
    var rows = intake ? intake.getLastRow() - 1 : 0;
    if (rows > 0) {
      // Narrow reads. The intake tab now retains every edition's rows rather
      // than only the last run's, so pulling all eleven columns — Snippet and
      // Summary included — would make one click cost the whole archive.
      var head = intake.getRange(2, 1, rows, 4).getValues();   // id, url, title, source
      var sigs = intake.getRange(2, 8, rows, 1).getValues();   // signals
      for (var i = rows - 1; i >= 0; i--) {
        if (String(head[i][0]) !== digestId) continue;
        if (scClickKey_(String(head[i][1])) !== itemKey) continue;
        target = String(head[i][1]); title = String(head[i][2]); source = String(head[i][3]);
        var sig = {};
        try { sig = JSON.parse(String(sigs[i][0] || '{}')); } catch (se) {}
        companies = (sig.mc || []).join('|'); topics = (sig.mt || []).join('|');
        segments = (sig.ms || []).join('|');
        break;
      }
    }
    if (target && /^https?:\/\//i.test(target)) {
      ss.getSheetByName(SCRAPER_TABS.CLICK_LOG).appendRow(
        [new Date(), digestId, itemKey, target, title, source, companies, topics, segments]);
    }
  } catch (clkErr) { /* logging must never block the redirect */ }
  var safe = (target && /^https?:\/\//i.test(target)) ? target : EMBED_PAGE_URL;
  // JSON mode: what the embedding page asks for over its cookie-less fetch.
  // Same resolution, same fallback — only the envelope differs.
  if (String((e && e.parameter && e.parameter.fmt) || '') === 'json') {
    return ContentService.createTextOutput(JSON.stringify({
      success: !!target, url: safe })).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta http-equiv="refresh" content="0;url=' + scAttr_(safe) + '">'
    + '<script>location.replace(' + JSON.stringify(safe) + ');</script>'
    + '<p style="font-family:sans-serif">Opening article… '
    + '<a href="' + scAttr_(safe) + '">continue</a></p>');
}

/** Serve one edition's held-back stories — what cleared the relevance bar but
    did not fit a section cap. Unauthenticated by design, and bounded exactly
    the way the click redirect is: the digest id names the edition, the payload
    is read from that edition's own stored JSON, nothing is echoed back from
    the request, and there is no write of any kind. A subscriber opening
    "View More" from their email has no session and needs none.

    The reply is always JSON: the embedding page is what fetches this, over the
    same cookie-less path the click hop uses. Nothing navigates to /exec. */
function scHandleHeldBack_(e) {
  var want = scStr_((e && e.parameter && e.parameter.more) || '', 60);
  var out = { success: false, items: [], total: 0, editionName: '', date: '' };
  var json = function(o) {
    return ContentService.createTextOutput(JSON.stringify(o))
      .setMimeType(ContentService.MimeType.JSON);
  };
  // Every failure below used to return this same empty payload, which the
  // reader's overlay renders as "Nothing was held back — every relevant story
  // made this edition." That is a false statement, not a degraded one: the
  // edition it could not find or could not read may have held back plenty.
  // `unavailable` separates "could not answer" from "the answer is none".
  var gone = function(why) { out.unavailable = why; return json(out); };
  if (!want) return gone('no-id');
  try {
    var ss = scraperSs_();
    var sheet = ss.getSheetByName(SCRAPER_TABS.DIGESTS);
    var n = sheet ? sheet.getLastRow() - 1 : 0;
    if (n < 1) return gone('no-editions');
    var ids = sheet.getRange(2, 1, n, 1).getValues();
    var row = 0;
    for (var i = n - 1; i >= 0; i--) {
      if (String(ids[i][0]) === want) { row = i + 2; break; }
    }
    // The commonest real cause: the edition was rebuilt, which replaces the
    // row and its id, so a link in an older rendering of the day now points at
    // an edition that no longer exists.
    if (!row) return gone('not-found');
    // Column 7 only — the rendered HTML in column 8 is the largest cell in the
    // sheet and this route never needs it.
    var d = null;
    try { d = JSON.parse(String(sheet.getRange(row, 7).getValue() || 'null')); } catch (pe) {}
    if (!d) return gone('unreadable');
    out.editionName = scRewriteLegacyNames_(String(d.editionName || ''));
    out.date = String(d.date || '');
    // Editions built before 2026-08-28 carry no embedded held-back list. Say so
    // with an explicit flag rather than an empty list, so the reader is told the
    // edition predates the feature instead of "nothing was held back".
    if (!d.heldBack) { out.legacy = true; return json(out); }
    out.items = (d.heldBack || []).map(function(it) {
      return { title: String(it.title || ''), source: String(it.source || ''),
               publishedAt: String(it.publishedAt || ''), url: String(it.url || ''),
               summary: String(it.summary || ''), analysis: String(it.analysis || '') };
    });
    out.total = Number(d.heldBackTotal) || out.items.length;
    // The stored list was dropped to fit the cell (scDigestFitJson_) while the
    // count survived. Saying so beats showing a total with nothing under it.
    if (d.heldBackTrimmed && !out.items.length && out.total) out.unavailable = 'trimmed';
    out.success = true;
  } catch (err) {
    // A read-only side route must never throw at the reader — but it must not
    // present a failure as an empty list either.
    out.unavailable = out.unavailable || 'error';
  }
  return json(out);
}

/** Short stable per-URL key for click links (avoids putting the full URL in
    the redirect querystring). */
function scClickKey_(url) {
  var h = 0, str = String(url || '');
  for (var i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}

function scAttr_(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

/** Build the tracking redirect URL for one item — the app's own /exec
    endpoint with action=go, which scHandleClickRedirect_ resolves and logs. */
/** The click-tracking link for one article.

    Points at the EMBEDDING PAGE, not at the /exec endpoint directly. A plain
    <a href> to script.google.com is a cookie-carrying top-level navigation, so
    Google resolves it against the browser's DEFAULT signed-in account — and
    when that is not the account owning the script, it serves an account
    chooser or "unable to open the file" instead of the app. That is the same
    multi-account routing failure the embedded iframe already dodges by being
    credentialless, and the same reason every data call uses a cookie-less
    fetch. Article links were the one path still going direct.

    The embedding page resolves the destination over that same cookie-less
    fetch and replaces the location. It is not an open redirect: the URL still
    carries only (digest id, item key) and the destination is still looked up
    server-side from the stored intake rows. */
function scClickUrl_(digestId, url) {
  return EMBED_PAGE_URL + '?go=' + encodeURIComponent(digestId)
       + '&i=' + encodeURIComponent(scClickKey_(url));
}

/** The legacy direct-to-/exec form. Kept because every already-delivered email
    contains links in this shape — they still resolve, they just route through
    Google's authenticated host. scRewriteLegacyClickUrls_ upgrades them when a
    stored edition is re-read in the app. */
function scLegacyClickPrefix_() {
  return 'https://script.google.com/macros/s/' + DEPLOYMENT_ID + '/exec?action=go&';
}

/** Rewrite legacy click links in stored edition HTML to the embedding-page
    form, so editions built before this fix stop hitting account routing the
    moment they are opened in the app. Handles both the raw and the
    HTML-escaped ampersand, since the stored body is escaped markup. */
function scRewriteLegacyClickUrls_(html) {
  if (!html) return html;
  var exec = 'https://script.google.com/macros/s/' + DEPLOYMENT_ID + '/exec?action=go&';
  var out = html;
  ['&amp;', '&'].forEach(function(amp) {
    var from = exec.slice(0, -1) + amp + 'd=';
    while (out.indexOf(from) !== -1) {
      out = out.replace(from, EMBED_PAGE_URL + '?go=');
    }
  });
  return out;
}

/** Engagement boost map: label(lower) → points, from clicks in the window.
    A covered thing you actually open scores higher next time. Capped. */
function scClickBoosts_(ss) {
  var out = { companies: {}, topics: {}, segments: {} };
  var sheet = ss.getSheetByName(SCRAPER_TABS.CLICK_LOG);
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  var cutoff = Date.now() - SCRAPER_CLICK_WINDOW_DAYS * 86400000;
  var tally = { companies: {}, topics: {}, segments: {} };
  for (var i = 1; i < data.length; i++) {
    var ts = new Date(data[i][0]).getTime();
    if (!ts || ts < cutoff) continue;
    [['companies', 6], ['topics', 7], ['segments', 8]].forEach(function(pair) {
      String(data[i][pair[1]] || '').split('|').forEach(function(lbl) {
        var k = lbl.trim().toLowerCase();
        if (k) tally[pair[0]][k] = (tally[pair[0]][k] || 0) + 1;
      });
    });
  }
  ['companies', 'topics', 'segments'].forEach(function(cat) {
    Object.keys(tally[cat]).forEach(function(k) {
      // diminishing: 1 click ~1.8pts, 3 ~3.4, saturating at the cap
      out[cat][k] = Math.min(SCRAPER_CLICK_BOOST_CAP, Math.round(SCRAPER_CLICK_BOOST_CAP * (1 - Math.pow(0.6, tally[cat][k])) * 10) / 10);
    });
  });
  return out;
}

/** ---- Dossier mining (T1b / T1c) -------------------------------------- */

/** Extract alias terms + operating segments from one dossier JSON (pure). */
/** Coerce a schema field to an array. `(x || []).forEach` is NOT a safe guard:
    it only rescues null/undefined, so a field that arrived as a string threw
    "forEach is not a function" and took the whole dossier read down with it. */
function scAsList_(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined || v === '') return [];
  return [v];
}

/** Split on commas/semicolons that sit OUTSIDE brackets, so a parenthetical
    list stays whole: "Enterprises, frontier labs (Anthropic, OpenAI), gov"
    yields three segments, not four with a severed "(Anthropic". */
function scSplitTopLevel_(str) {
  var out = [], buf = '', depth = 0;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charAt(i);
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') { if (depth > 0) depth--; }
    if ((ch === ',' || ch === ';') && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}

/** Normalise a segment-ish value (string[] OR comma-joined string) into short
    segment keys, discarding prose. */
function scSegmentList_(v) {
  var raw;
  if (Array.isArray(v)) {
    raw = v.map(function(x) { return String(x === null || x === undefined ? '' : x); });
  } else if (typeof v === 'string') {
    raw = scSplitTopLevel_(v);
  } else {
    return [];
  }
  var out = [];
  raw.forEach(function(x) {
    var t = String(x).replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '').trim();
    if (!t) return;
    if (t.length > SCRAPER_SEGMENT_MAX_CHARS) return;          // a sentence, not a segment
    if (t.split(' ').length > SCRAPER_SEGMENT_MAX_WORDS) return;
    out.push(t);
  });
  return out;
}

function scMineDossier_(profile) {
  var terms = {}, segs = {};
  function add(t) {
    var v = String(t === null || t === undefined ? '' : t).trim();
    if (v.length >= 3 && v.length <= 40 && !/^https?:/i.test(v)) terms[v.toLowerCase()] = v;
  }
  if (!profile || typeof profile !== 'object') return { terms: [], segments: [] };
  add(profile.name); add(profile.legalName);
  // ticker symbol tail (e.g. "SIX: ABBN" -> "ABBN", "NASDAQ: NVDA" -> "NVDA")
  var tk = String(profile.ticker || '');
  var tm = /([A-Za-z]{2,6})\s*$/.exec(tk.split(':').pop() || tk);
  if (tm) add(tm[1]);
  // product + tech names (flagship signal per schema)
  scAsList_(profile.productsAndServices).forEach(function(p) {
    if (!p || typeof p !== 'object') return;
    add(p.name);
    scSegmentList_(p.targetSegments).forEach(function(seg) { segs[seg.toLowerCase()] = true; });
  });
  // technicalSpecs entries are keyed `product`, never `name` — reading `.name`
  // matched nothing in any dossier, so flagship product names were silently
  // never mined. `name` is kept as a fallback in case a future shape uses it.
  scAsList_(profile.technicalSpecs).forEach(function(t) {
    if (t && typeof t === 'object') add(t.product || t.name);
  });
  // decision-maker surnames are too noisy — skip. categories → segment hints
  scSegmentList_(profile.categories).forEach(function(c) { segs[c.toLowerCase()] = true; });
  return { terms: Object.keys(terms).map(function(k){return terms[k];}),
           segments: Object.keys(segs).slice(0, SCRAPER_SEGMENT_MAX_PER_COMPANY) };
}

/** Notes-tag helpers. Company rows carry machine tags alongside any free text
    the developer typed. Tags are ';'-terminated because segment labels legally
    contain spaces ("data centers") — a whitespace-delimited tag silently
    truncated them, losing every segment after the first multi-word one. */
function scNotesGetTag_(notes, name) {
  var m = new RegExp('\\b' + name + ':([^;]*);').exec(String(notes || ''));
  return m ? m[1] : null;
}
function scNotesSetTag_(notes, name, value) {
  var stripped = String(notes || '').replace(new RegExp('\\b' + name + ':[^;]*;\\s*', 'g'), '').trim();
  return (stripped ? stripped + ' ' : '') + name + ':' + value + ';';
}

/** Dossier-mining pass. Runs inside the daily interests sync, so it repeats
    forever with no manual action — the developer never has to trigger it.

    Selection is PRIORITY-ordered, not round-robin, because the dossiers that
    matter most are the ones that just changed:
      1. never mined            — a newly covered company, mined next sync
      2. changed since mined    — Profiler refreshed it (e.g. post-earnings)
      3. oldest mined           — slow background refresh of everything else
    Budget adapts: a bigger allowance while there is priority work (so the
    initial backfill of every company completes in a few days on its own),
    a small trickle once the fleet is current. A wall-clock guard keeps the
    pass well inside the scheduler tick's budget. */
function scMineDossiersStep_(ss, budgetMs) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  var never = [], changed = [], aged = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== 'company' || String(data[i][4]) !== 'active') continue;
    var minedAt = Number(scNotesGetTag_(data[i][13], 'mined')) || 0;
    if (!minedAt) { never.push(i); continue; }
    var pUpd = new Date(String(data[i][10] || '')).getTime();
    if (pUpd && pUpd > minedAt) changed.push(i);
    else aged.push({ row: i, at: minedAt });
  }
  aged.sort(function(a, b) { return a.at - b.at; });
  var queue = never.concat(changed, aged.map(function(x) { return x.row; }));
  if (!queue.length) return { mined: 0, pending: 0 };
  var priority = never.length + changed.length;
  // The idle trickle is a FLOOR, not an alternative: capping the budget at the
  // priority count starved the background refresh whenever one or two new
  // companies were queued, so aged dossiers would never be re-read.
  var budget = Math.max(SCRAPER_DOSSIER_MINE_IDLE,
                        Math.min(SCRAPER_DOSSIER_MINE_PRIORITY_MAX, priority));
  var t0 = Date.now();
  var done = 0;
  for (var n = 0; n < Math.min(budget, queue.length); n++) {
    if (Date.now() - t0 > (budgetMs || SCRAPER_DOSSIER_MINE_BUDGET_MS)) break;
    var ri = queue[n];
    var slug = String(data[ri][0]);
    var notes = String(data[ri][13] || '');
    try {
      var resp = UrlFetchApp.fetch(SCRAPER_DOSSIER_BASE + slug + '.profile.json?_cb=' + Date.now(),
        { muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) {
        // No dossier published for this slug — stamp it so the queue moves on
        // instead of retrying the same 404 every single sync forever.
        sheet.getRange(ri + 1, 14).setValue(scNotesSetTag_(notes, 'mined', String(Date.now())));
        continue;
      }
      var profile = JSON.parse(resp.getContentText());
      var mined = scMineDossier_(profile);
      var existing = String(data[ri][7] || '').split(/[\n,]/).map(function(t) { return t.trim(); }).filter(Boolean);
      var lower = {};
      existing.forEach(function(t) { lower[t.toLowerCase()] = true; });
      mined.terms.forEach(function(t) {
        if (!lower[t.toLowerCase()]) { existing.push(t); lower[t.toLowerCase()] = true; }
      });
      sheet.getRange(ri + 1, 8).setValue(existing.slice(0, 40).join(', '));
      // Stamp segments AND the mine time on every successful read — the old
      // code only wrote when new terms appeared, which left no way to tell a
      // mined company from an unmined one.
      notes = scNotesSetTag_(notes, 'seg', mined.segments.join('|'));
      notes = scNotesSetTag_(notes, 'mined', String(Date.now()));
      sheet.getRange(ri + 1, 14).setValue(notes);
      done++;
    } catch (mErr) { /* one bad dossier never breaks the pass */ }
  }
  return { mined: done, pending: Math.max(0, priority - done) };
}

/** Forced full drain — the "Read all dossiers" button.

    Three things make this finish where the paced pass stalls:

    1. NO PER-PASS CAP. `scMineDossiersStep_` reads at most
       SCRAPER_DOSSIER_MINE_PRIORITY_MAX companies because it is a background
       trickle riding along with the daily sync. This reads the whole queue.
    2. BATCHED WRITES. The paced pass issues two setValue() calls per company
       (Aliases, then Notes) — ~176 individual Sheets round-trips for a full
       fleet, which is what actually consumed the wall-clock budget. Here the
       columns are mutated in memory and written back with ONE setValues each,
       so the pass is bounded by dossier fetches rather than by sheet I/O.
    3. IT REPORTS FAILURES. The paced pass swallows every error
       (`catch (mErr) {}`), so a company that cannot be read looks identical
       to one that was never reached — a queue stuck behind bad rows is
       invisible. Outcomes are counted and the first few messages returned.

    Partial progress is ALWAYS persisted: the write-back is in a finally, so a
    timeout, a bad dossier or a thrown fetch still commits everything read up
    to that point. `remaining > 0` means call again. */
function scMineDossiersAll_(ss, sinceMs) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
  if (!sheet) return { ok: false, error: 'no_interests_tab' };
  var data = sheet.getDataRange().getValues();
  var rows = data.length - 1;
  if (rows < 1) return { ok: true, read: 0, noDossier: 0, failed: 0, remaining: 0, errors: [] };

  // EPOCH, not a boolean "force": the button means "re-read everything", but a
  // plain force flag cannot converge — each round would rebuild the same full
  // queue and the client would loop until its round cap. Anchoring on the
  // server clock at the start of the run makes a row leave the queue as soon
  // as THIS run stamps it, so successive rounds shrink and terminate. The
  // epoch is server-side on purpose; a browser-supplied timestamp would drift.
  var epoch = Number(sinceMs) || Date.now();
  var queue = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== 'company' || String(data[i][4]) !== 'active') continue;
    var minedAt = Number(scNotesGetTag_(data[i][13], 'mined')) || 0;
    if (minedAt < epoch) { queue.push(i); continue; }
    var pUpd = new Date(String(data[i][10] || '')).getTime();
    if (pUpd && pUpd > minedAt) queue.push(i);
  }

  var t0 = Date.now();
  var read = 0, noDossier = 0, failed = 0, errors = [], touched = false, n = 0;
  try {
    for (n = 0; n < queue.length; n++) {
      if (Date.now() - t0 > SCRAPER_DOSSIER_DRAIN_BUDGET_MS) break;
      var ri = queue[n];
      var slug = String(data[ri][0]);
      try {
        var resp = UrlFetchApp.fetch(SCRAPER_DOSSIER_BASE + slug + '.profile.json?_cb=' + Date.now(),
          { muteHttpExceptions: true });
        var code = resp.getResponseCode();
        if (code !== 200) {
          // Same contract as the paced pass: stamp it so the queue moves on
          // rather than retrying an absent dossier forever. Counted separately
          // so "read" never overstates what was actually learned.
          data[ri][13] = scNotesSetTag_(String(data[ri][13] || ''), 'mined', String(Date.now()));
          noDossier++; touched = true;
          if (errors.length < 8) errors.push(slug + ': HTTP ' + code);
          continue;
        }
        var mined = scMineDossier_(JSON.parse(resp.getContentText()));
        var existing = String(data[ri][7] || '').split(/[\n,]/)
          .map(function(t) { return t.trim(); }).filter(Boolean);
        var lower = {};
        existing.forEach(function(t) { lower[t.toLowerCase()] = true; });
        mined.terms.forEach(function(t) {
          if (!lower[t.toLowerCase()]) { existing.push(t); lower[t.toLowerCase()] = true; }
        });
        data[ri][7] = existing.slice(0, 40).join(', ');
        var notes = scNotesSetTag_(String(data[ri][13] || ''), 'seg', mined.segments.join('|'));
        data[ri][13] = scNotesSetTag_(notes, 'mined', String(Date.now()));
        read++; touched = true;
      } catch (mErr) {
        // Recorded, not swallowed — an unreadable dossier is left unstamped so
        // it retries, but the developer can now SEE that it is the blocker.
        failed++;
        if (errors.length < 8) errors.push(slug + ': ' + ((mErr && mErr.message) || mErr));
      }
    }
  } finally {
    if (touched) {
      var aliasCol = [], notesCol = [];
      for (var w = 1; w < data.length; w++) {
        aliasCol.push([data[w][7]]);
        notesCol.push([data[w][13]]);
      }
      sheet.getRange(2, 8, rows, 1).setValues(aliasCol);
      sheet.getRange(2, 14, rows, 1).setValues(notesCol);
      SpreadsheetApp.flush();
    }
  }
  return { ok: true, read: read, noDossier: noDossier, failed: failed,
           errors: errors, remaining: Math.max(0, queue.length - n),
           queued: queue.length, epoch: epoch, elapsedMs: Date.now() - t0 };
}

/** "Read all dossiers" — drain the mining queue in one call.

    A longer lock wait than the paced sync on purpose: the failure mode the
    developer hit was pressing a button whose previous run still held the
    5-second lock, so the press returned `skipped: locked` and nothing moved.
    Waiting is the correct behaviour for an explicit "do it now" action. */
function mineAllDossiers(sessionToken, sinceMs) {
  validateSessionForData(sessionToken, 'mineAllDossiers');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(45000)) return { success: false, error: 'busy' };
  try {
    var ss = scraperSs_();
    ensureScraperTabs_(ss);
    // No `since` = first round: re-read every covered company. The client
    // echoes the returned epoch back on later rounds so the run converges.
    return { success: true, result: scMineDossiersAll_(ss, sinceMs) };
  } finally {
    lock.releaseLock();
  }
}

/** Mining coverage for the status strip: how many covered companies have been
    read, how many are queued, and when the fleet was last touched. */
function scDossierMiningStats_(ss) {
  var sheet = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
  var out = { total: 0, mined: 0, pending: 0, lastMined: 0 };
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== 'company' || String(data[i][4]) !== 'active') continue;
    out.total++;
    var minedAt = Number(scNotesGetTag_(data[i][13], 'mined')) || 0;
    if (!minedAt) { out.pending++; continue; }
    out.mined++;
    if (minedAt > out.lastMined) out.lastMined = minedAt;
    var pUpd = new Date(String(data[i][10] || '')).getTime();
    if (pUpd && pUpd > minedAt) out.pending++;   // refreshed since we read it
  }
  return out;
}

/** Per-company operating segments mined from dossiers: company label(lower) →
    {segLabel(lower): true}. Read from the Interests Notes 'seg:' tag. */
function scCompanySegments_(ss) {
  var out = {};
  var sheet = ss.getSheetByName(SCRAPER_TABS.INTERESTS);
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== 'company') continue;
    var raw = scNotesGetTag_(data[i][13], 'seg');
    if (!raw) continue;
    var m = [null, raw];
    var set = {};
    m[1].split('|').forEach(function(s){ if (s) set[s.trim().toLowerCase()] = true; });
    out[String(data[i][2] || '').trim().toLowerCase()] = set;
  }
  return out;
}

/** ---- Held-back rollup (F5) ------------------------------------------- */

function scStoreHeldBack_(props, editionId, items) {
  try {
    var slim = items.slice(0, SCRAPER_HELD_BACK_MAX).map(function(it) {
      return { t: scStr_(it.title, 160), u: it.url, s: it.source, sc: it.score };
    });
    props.setProperty('HELDBACK_' + editionId, JSON.stringify(slim));
  } catch (e) {}
}


/** ---- Archive search (F2) + company timeline (F3) --------------------- */

/** Search stored editions' intake rows. Free-text over title/source, with
    optional company/segment filters and a date range. */
function searchArchive(sessionToken, payload) {
  validateSessionForData(sessionToken, 'searchArchive');
  var p;
  try { p = JSON.parse(payload || '{}'); } catch (e) { p = {}; }
  var q = String(p.q || '').trim().toLowerCase();
  var company = String(p.company || '').trim().toLowerCase();
  var fromMs = p.from ? new Date(p.from).getTime() : 0;
  var toMs = p.to ? new Date(p.to).getTime() + 86400000 : 0;
  var limit = Math.max(1, Math.min(100, Number(p.limit) || 40));
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var data = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE).getDataRange().getValues();
  var out = [];
  for (var i = data.length - 1; i >= 1 && out.length < limit; i--) {
    var title = String(data[i][2]), source = String(data[i][3]);
    var pub = String(data[i][4]);
    if (q && (title + ' ' + source).toLowerCase().indexOf(q) === -1) continue;
    var sig = {};
    try { sig = JSON.parse(String(data[i][7] || '{}')); } catch (se) {}
    if (company && (sig.mc || []).join('|').toLowerCase().indexOf(company) === -1) continue;
    var ts = new Date(pub).getTime();
    if (fromMs && ts && ts < fromMs) continue;
    if (toMs && ts && ts > toMs) continue;
    out.push({ digestId: String(data[i][0]), url: String(data[i][1]), title: title,
      source: source, publishedAt: pub, score: Number(data[i][6]) || 0,
      companies: sig.mc || [], summary: String(data[i][8] || '') });
  }
  return { success: true, results: out, count: out.length };
}

/** Every stored article that matched one covered company, newest first —
    the bridge from a Profiler dossier to the news since it was written. */
function companyTimeline(sessionToken, company, limit) {
  validateSessionForData(sessionToken, 'companyTimeline');
  var want = String(company || '').trim().toLowerCase();
  if (!want) return { success: false, error: 'company_required' };
  var max = Math.max(1, Math.min(100, Number(limit) || 30));
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var data = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE).getDataRange().getValues();
  var out = [];
  for (var i = data.length - 1; i >= 1 && out.length < max; i--) {
    var sig = {};
    try { sig = JSON.parse(String(data[i][7] || '{}')); } catch (se) {}
    var mc = (sig.mc || []).map(function(x){ return String(x).toLowerCase(); });
    if (mc.indexOf(want) === -1) continue;
    out.push({ url: String(data[i][1]), title: String(data[i][2]),
      source: String(data[i][3]), publishedAt: String(data[i][4]),
      score: Number(data[i][6]) || 0, summary: String(data[i][8] || '') });
  }
  return { success: true, company: company, items: out, count: out.length };
}

/** ---- Source performance (T2c) ---------------------------------------- */

/** Per-source stats: items ingested, how many cleared the relevance bar, and
    clicks earned. Lets a noisy source be switched off with evidence. */
function sourceStats(sessionToken) {
  validateSessionForData(sessionToken, 'sourceStats');
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var data = ss.getSheetByName(SCRAPER_TABS.DIGEST_INTAKE).getDataRange().getValues();
  var tally = {};
  for (var i = 1; i < data.length; i++) {
    var src = String(data[i][3] || '(unknown)');
    var t = tally[src] || (tally[src] = { source: src, items: 0, relevant: 0, clicks: 0 });
    t.items++;
    if ((Number(data[i][6]) || 0) >= SCRAPER_RELEVANT_THRESHOLD) t.relevant++;
  }
  var clicks = ss.getSheetByName(SCRAPER_TABS.CLICK_LOG);
  if (clicks) {
    var cd = clicks.getDataRange().getValues();
    for (var j = 1; j < cd.length; j++) {
      var cs = String(cd[j][5] || '');
      if (tally[cs]) tally[cs].clicks++;
    }
  }
  var out = Object.keys(tally).map(function(k) {
    var t = tally[k];
    t.hitRate = t.items ? Math.round((t.relevant / t.items) * 100) : 0;
    return t;
  }).sort(function(a, b) { return b.relevant - a.relevant || b.items - a.items; });
  return { success: true, sources: out };
}

/** ---- Preview + send-test (F4) ---------------------------------------- */

/** Render the CURRENT top-scored intake as an edition preview without
    storing it or emailing anyone. */
function previewEdition(sessionToken, editionId) {
  validateSessionForData(sessionToken, 'previewEdition');
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var state = scDigestState_();
  if (!state || !state.id) return { success: false, error: 'no_run_yet' };
  var items = scDigestItems_(ss, state.id);
  if (!items.length) return { success: false, error: 'no_items' };
  var ed = scEditionById_(ss, editionId || state.editionId);
  var lead = items[0];
  var sections = { companies: [], market: [], incidents: [] };
  items.forEach(function(it) {
    if (it.url === lead.url || it.score < SCRAPER_RELEVANT_THRESHOLD) return;
    var sec = it.section || 'market';
    if (sections[sec] && sections[sec].length < SCRAPER_DIGEST_SECTION_CAPS[sec]) sections[sec].push(it);
  });
  var d = {
    id: state.id, date: state.date, no: 0, windowH: state.windowH,
    generatedAt: new Date().toISOString(), aiNote: state.aiNote || '',
    editionId: ed.id, editionName: ed.name,
    lead: { title: lead.title, source: lead.source, publishedAt: lead.publishedAt,
            url: lead.url, score: lead.score, text: lead.summary || lead.snippet },
    sections: { companies: sections.companies.map(scDigestItemOut_),
                market: sections.market.map(scDigestItemOut_),
                incidents: sections.incidents.map(scDigestItemOut_) },
    newCoverage: { count: 0, names: [] },
    counts: { intake: items.length,
              relevant: items.filter(function(it){ return it.score >= SCRAPER_RELEVANT_THRESHOLD; }).length,
              shown: 1 + sections.companies.length + sections.market.length + sections.incidents.length }
  };
  return { success: true, html: scRenderDigestNightInk_(d), preview: true };
}

/** ---- Weekly held-back rollup (F5) ------------------------------------ */

/** Email the admin subscribers the relevant stories that did NOT make the
    last edition — "what your sources published that you didn't see". */
function sendHeldBackRollup(sessionToken, editionId) {
  var user = validateSessionForData(sessionToken, 'sendHeldBackRollup');
  if (!scCanManageDigest_(user)) return { success: false, error: 'not_authorized' };
  var ss = scraperSs_(); ensureScraperTabs_(ss);
  var edId = String(editionId || SCRAPER_EDITION_DEFAULT.id);
  var raw = PropertiesService.getScriptProperties().getProperty('HELDBACK_' + edId) || '[]';
  var items;
  try { items = JSON.parse(raw); } catch (e) { items = []; }
  if (!items.length) return { success: false, error: 'nothing_held_back' };
  var to = scSubscribers_(ss).filter(function(s) { return s.admin && s.status === 'active'; })
                             .map(function(s) { return s.email; });
  if (!to.length) to = [user.email];
  var html = scRenderHeldBackRollup_(items, edId);
  MailApp.sendEmail({ to: to.join(','), subject: 'Held back — what did not make the last edition', htmlBody: html });
  dataAuditLog(user.email, 'email', 'rollup', edId, String(items.length) + ' items');
  return { success: true, sent: items.length, recipients: to.length };
}

function scRenderHeldBackRollup_(items, edId) {
  function esc(x) { return escapeHtml(String(x == null ? '' : x)); }
  var rows = items.map(function(it) {
    return '<tr><td style="padding:8px 0;border-bottom:1px solid #262b33;">'
      + '<a href="' + esc(it.u) + '" style="color:#eceae4;text-decoration:none;font-size:15px;">'
      + esc(it.t) + '</a>'
      + '<div style="font-family:monospace;font-size:11px;color:#7b828e;margin-top:3px;">'
      + esc(it.s) + ' · score ' + Number(it.sc) + '</div></td></tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
    + 'bgcolor="#101216" style="background:#101216;"><tr><td align="center" style="padding:20px 10px;">'
    + '<table role="presentation" width="720" cellpadding="0" cellspacing="0" border="0" bgcolor="#15171c" '
    + 'style="background:#15171c;width:720px;max-width:100%;"><tr><td style="padding:30px 34px;color:#e6e4de;'
    + "font-family:'IBM Plex Sans',Segoe UI,system-ui,sans-serif;\">"
    + '<div style="font-size:26px;font-weight:700;color:#f0eee8;">Held back</div>'
    + '<div style="font-size:13px;color:#9aa0ab;margin:4px 0 16px;">'
    + Number(items.length) + ' stories cleared your relevance bar but did not fit '
    + esc(edId) + '\\u2019s section caps.</div>'
    + '<table role="presentation" width="100%">' + rows + '</table>'
    + '</td></tr></table></td></tr></table>';
}

function handleProjectAction_(op, sessionToken, e) {
  function param(k) { return (e && e.parameter && e.parameter[k]) || ''; }
  // Phase 5 surface: interests + rubric, editions + digests, subscribers,
  // archive/timeline/stats, go-live controls. (Projects retired.)
  if (op === 'getSchedulerHealth') return getSchedulerHealth(sessionToken);
  if (op === 'listInterests') return listInterests(sessionToken);
  if (op === 'setInterestEnabled') return setInterestEnabled(sessionToken, param('key'), param('enabled'));
  if (op === 'syncInterestsNow') return syncInterestsNow(sessionToken);
  if (op === 'mineAllDossiers') return mineAllDossiers(sessionToken, param('since'));
  if (op === 'rubricPreview') return rubricPreview(sessionToken, param('payload'));
  if (op === 'digestScoreReport') return digestScoreReport(sessionToken, param('digestId'));
  if (op === 'runDigestNow') return runDigestNow(sessionToken, param('editionId'));
  if (op === 'getDigestStatus') return getDigestStatus(sessionToken);
  if (op === 'listDigests') return listDigests(sessionToken, param('limit'), param('payload'));
  if (op === 'getDigest') return getDigest(sessionToken, param('digestId'));
  if (op === 'deleteDigest') return deleteDigest(sessionToken, param('digestId'));
  if (op === 'goLiveStatus') return goLiveStatus(sessionToken);
  if (op === 'testAi') return testAi(sessionToken);
  if (op === 'emailLatestDigest') return emailLatestDigest(sessionToken);
  if (op === 'setAiProvider') return setAiProvider(sessionToken, param('provider'));
  if (op === 'addDigestRecipient') return addDigestRecipient(sessionToken, param('email'));
  if (op === 'removeDigestRecipient') return removeDigestRecipient(sessionToken, param('email'));
  if (op === 'listEditions') return listEditions(sessionToken);
  if (op === 'saveEdition') return saveEdition(sessionToken, param('payload'));
  if (op === 'deleteEdition') return deleteEdition(sessionToken, param('editionId'));
  if (op === 'setEditionTuning') return setEditionTuning(sessionToken, param('editionId'), param('key'), param('enabled'));
  if (op === 'resetEditionTuning') return resetEditionTuning(sessionToken, param('editionId'), param('preset'));
  if (op === 'listShares') return listShares(sessionToken, param('digestId'));
  if (op === 'createShareLink') return createShareLink(sessionToken, param('digestId'));
  // NOT param('token') — that is the session token the client already sends,
  // so reusing the name would silently revoke nothing and look like a miss.
  if (op === 'revokeShareLink') return revokeShareLink(sessionToken, param('shareToken'));
  if (op === 'listSubscribers') return listSubscribers(sessionToken);
  if (op === 'saveSubscriber') return saveSubscriber(sessionToken, param('payload'));
  if (op === 'removeSubscriber') return removeSubscriber(sessionToken, param('email'));
  if (op === 'searchArchive') return searchArchive(sessionToken, param('payload'));
  if (op === 'companyTimeline') return companyTimeline(sessionToken, param('company'), param('limit'));
  if (op === 'sourceStats') return sourceStats(sessionToken);
  if (op === 'previewEdition') return previewEdition(sessionToken, param('editionId'));
  if (op === 'sendHeldBackRollup') return sendHeldBackRollup(sessionToken, param('editionId'));
  return { success: false, error: 'unknown_op' };
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

  // PROJECT: Scraper project management via fetch() — session-validated routes
  if (SCRAPER_PROJECT_ACTIONS.indexOf(action) !== -1) {
    var pmToken = (e && e.parameter && e.parameter.token) || "";
    var pmResult;
    try {
      pmResult = handleProjectAction_(action, pmToken, e);
    } catch (pmErr) {
      pmResult = { success: false, error: String((pmErr && pmErr.message) || pmErr) };
    }
    return ContentService.createTextOutput(JSON.stringify(pmResult))
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

  // PROJECT OVERRIDE START: API-first routing. The page-boot work
  // (ensureScriptProperties_ / registerSelfProject / scEnsureSchedulerTrigger_)
  // used to run before action routing, so every GET api call paid the full
  // boot cost — registerSelfProject alone opens the Master ACL spreadsheet
  // (~1–2s). The api/deploy routes are matched first now; the boot work runs
  // further down, only for page-shell and listener-page loads.
  // PROJECT OVERRIDE END

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

  // PROJECT: digest click-tracking redirect (T1a). Unauthenticated by design —
  // subscribers open these links straight from their email, with no session.
  // It is NOT an open redirect: the destination is resolved server-side from
  // the stored edition's own intake rows by (digest id, item key); an
  // arbitrary URL cannot be passed in. It only appends one ClickLog row.
  if (action === 'go') {
    return scHandleClickRedirect_(e);
  }

  // PROJECT: held-back stories for one edition ("View More"). Unauthenticated
  // for the same reason the redirect above is — the reader arrives from their
  // email with no session. Read-only, and scoped to the named edition.
  if (action === 'more') {
    return scHandleHeldBack_(e);
  }

  // PROJECT: shared-edition view. Unauthenticated by design — the point of a
  // share link is that the recipient has no account. Bounded the same way the
  // click redirect is: the token names the edition (no digest id is accepted
  // from the URL), an unknown or revoked token gets a flat refusal, and the
  // only write is a view counter on the share's own row.
  if (action === 'share') {
    return scHandleSharedEdition_(e);
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
      } else if (SCRAPER_PROJECT_ACTIONS.indexOf(apiOp) !== -1) {
        // PROJECT: Scraper project management (GET fallback)
        apiResult = handleProjectAction_(apiOp, apiToken, e);
      } else {
        apiResult = { error: 'unknown_op' };
      }
    } catch (apiErr) {
      apiResult = { error: String((apiErr && apiErr.message) || apiErr) };
    }
    return ContentService.createTextOutput(JSON.stringify(apiResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Page-shell / listener-page boot (moved below the api routes — see the
  // PROJECT OVERRIDE note above): auto-initialize required Script Properties,
  // register this project in the Master ACL directory, and self-install the
  // hourly scheduler trigger (idempotent; never blocks page load).
  ensureScriptProperties_();
  registerSelfProject();
  try { scEnsureSchedulerTrigger_(); } catch (trgErr) {}

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
