# Template Update Plan: Sync Auth Templates with testauthgas1

> **Status:** Draft — awaiting developer approval
> **Created:** 2026-03-19
> **Approach:** Copy-then-modify (copy testauthgas1 files as new templates, then make targeted edits)
> **Scope:** Update `gas-minimal-auth-template-code.js.txt`, `gas-test-auth-template-code.js.txt`, `HtmlAndGasTemplateAutoUpdate-auth.html.txt`, and `setup-gas-project.sh`

---

## Overview

Instead of writing thousands of lines from scratch, **copy testauthgas1's working files as the new templates** and make ~20-30 targeted modifications to genericize them. This is dramatically simpler than the previous approach because testauthgas1 already has every feature we want in the templates.

### Why copy-then-modify?

| Approach | Lines to write | Risk |
|----------|---------------|------|
| Build from scratch (old plan) | ~2,000+ new lines across GAS + HTML | High — easy to miss subtle interactions |
| Copy + modify (this plan) | ~20-30 targeted edits per file | Low — starting from known-working code |

---

## Phase 1: GAS Auth Template (`gas-minimal-auth-template-code.js.txt`)

**Source:** `googleAppsScripts/Testauthgas1/testauthgas1.gs` (2,116 lines)
**Target:** `live-site-pages/templates/gas-minimal-auth-template-code.js.txt`
**Estimated edits:** ~20-25

### Step 1.1: Copy

```bash
cp googleAppsScripts/Testauthgas1/testauthgas1.gs live-site-pages/templates/gas-minimal-auth-template-code.js.txt
```

### Step 1.2: Replace project-specific values with placeholders

| Value in testauthgas1 | Template placeholder |
|---------------------|---------------------|
| `var TITLE = 'testauthgas1';` | `var TITLE = 'TEMPLATE_TITLE';` |
| `var DEPLOYMENT_ID = '...'` | `var DEPLOYMENT_ID = 'TEMPLATE_DEPLOYMENT_ID';` |
| `var SPREADSHEET_ID = '...'` | `var SPREADSHEET_ID = 'TEMPLATE_SPREADSHEET_ID';` |
| `var SHEET_NAME     = 'Testauthgas1Data';` | `var SHEET_NAME     = 'Sheet1';` |
| `var GITHUB_OWNER  = 'ShadowAISolutions';` | `var GITHUB_OWNER  = 'TEMPLATE_GITHUB_OWNER';` |
| `var GITHUB_REPO   = 'lightaisolutions';` | `var GITHUB_REPO   = 'TEMPLATE_GITHUB_REPO';` |
| `var CLIENT_ID = '...'` | `var CLIENT_ID = 'TEMPLATE_CLIENT_ID';` |
| `var SOUND_FILE_ID = '...'` | `var SOUND_FILE_ID = '';` |
| Any hardcoded `testauthgas1` references in strings | Generic equivalents |

### Step 1.3: Swap test values for production values

All lines marked with `⚡ TEST VALUE` comments need production values:

| Config key | Test value | Production value |
|-----------|-----------|-----------------|
| `SESSION_EXPIRATION` | `180` (3 min) | `3600` (1 hr) / `900` (HIPAA) |
| `ABSOLUTE_SESSION_TIMEOUT` | `600` (10 min) | `28800` (8 hr) |
| `HEARTBEAT_INTERVAL` | `30` (30 sec) | `300` (5 min) |
| `OAUTH_TOKEN_LIFETIME` | `180` | `3600` |
| `OAUTH_REFRESH_BUFFER` | `60` | `300` |
| `MAX_FAILED_ATTEMPTS` | test value | `5` |
| `LOCKOUT_DURATION` | test value | `900` (15 min) |

Also remove all `⚡ TEST VALUE` comment annotations.

### Step 1.4: Genericize RBAC roles

Replace project-specific roles with generic ones:

```javascript
// FROM (testauthgas1):
var RBAC_ROLES_FALLBACK = {
  admin:     ['read', 'write', 'delete', 'export', 'admin'],
  clinician: ['read', 'write', 'export'],
  billing:   ['read', 'export'],
  viewer:    ['read']
};

// TO (template):
var RBAC_ROLES_FALLBACK = {
  admin:  ['read', 'write', 'delete', 'export', 'admin'],
  editor: ['read', 'write', 'export'],
  viewer: ['read']
};
```

Remove the `billing` role. Rename `clinician` → `editor`.

### Step 1.5: Strip PROJECT START/END content

Remove everything between `// ===== PROJECT START =====` and `// ===== PROJECT END =====` markers. This includes:
- `saveNote()` function and related code
- Any other project-specific functions

**Important — keep these (move OUT of PROJECT block into template section):**
- `clearAccessCacheForUser(email)` — generic admin utility
- `clearAllAccessCache()` — generic admin utility (increments cache epoch)
- `inspectCache()` — generic diagnostic tool
- `listActiveSessions(sessionToken)` — generic admin function
- `adminSignOutUser(sessionToken, targetEmail)` — generic admin function

These are NOT project-specific — they work on any auth project. Move them to the template section before stripping.

### Step 1.6: Reset version

```javascript
var VERSION = "v01.00g";
```

### Step 1.7: Clean up

- Remove `saveNote` UI elements from `doGet()` inline HTML (input fields, save button, related JavaScript)
- Verify `ACTIVE_PRESET` defaults to `'standard'`
- Ensure `ALLOWED_DOMAINS: []` and `ENABLE_DOMAIN_RESTRICTION: false` are present
- Remove any remaining testauthgas1-specific comments or references
- Update the `Developed by:` footer

---

## Phase 2: HTML Auth Template (`HtmlAndGasTemplateAutoUpdate-auth.html.txt`)

**Source:** `live-site-pages/testauthgas1.html`
**Target:** `live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt`
**Estimated edits:** ~20-25

### Step 2.1: Copy

```bash
cp live-site-pages/testauthgas1.html live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt
```

### Step 2.2: Replace project-specific values with placeholders

| Value in testauthgas1.html | Template placeholder |
|-------------------------|---------------------|
| `<title>testauthgas1</title>` | `<title>TEMPLATE_TITLE</title>` |
| `var _e = '...'` (encoded deployment URL) | `var _e = '';` |
| `LOGO_URL` value | `'YOUR_ORG_LOGO_URL'` or template default |
| Any hardcoded `testauthgas1` references | Generic equivalents |

### Step 2.3: Swap test values for production values

HTML-side config values that mirror the GAS test values:
- `SESSION_TIMEOUT` → match GAS production value
- `ABSOLUTE_TIMEOUT` → match GAS production value
- `HEARTBEAT_INTERVAL` → match GAS production value
- Warning banner thresholds → adjust to production timing
- Remove `⚡ TEST VALUE` annotations

### Step 2.4: Remove test-specific UI panels

- **Security test panel** — remove `#security-test-panel` and "Run Security Tests" button + all related JavaScript
- **Force heartbeat panel** — remove `#force-heartbeat-panel` and related JavaScript
- **saveNote UI** — remove any note-saving input fields, buttons, and handlers

### Step 2.5: Reset version

- Update `<meta name="build-version" content="v01.00w">`
- Remove any testauthgas1-specific version references

### Step 2.6: Clean up

- Ensure `ALLOWED_DOMAINS: []` is present in HTML_CONFIG
- Verify all GAS iframe references use the `_e` variable (not hardcoded URLs)
- Remove any remaining testauthgas1-specific comments
- Update the `Developed by:` footer

---

## Phase 3: GAS Test Auth Template (`gas-test-auth-template-code.js.txt`)

**Source:** The Phase 1 output (new `gas-minimal-auth-template-code.js.txt`)
**Target:** `live-site-pages/templates/gas-test-auth-template-code.js.txt`
**Estimated edits:** ~5-10

The test-auth template = minimal-auth template + test/diagnostic functions.

### Step 3.1: Copy the Phase 1 output

```bash
cp live-site-pages/templates/gas-minimal-auth-template-code.js.txt \
   live-site-pages/templates/gas-test-auth-template-code.js.txt
```

### Step 3.2: Add test functions back

Add back the test-only functions that the current `gas-test-auth-template-code.js.txt` has:
- `getSoundBase64()` — test sound playback
- `writeVersionToSheet()` — version write test
- `readB1()` — spreadsheet read test
- Test UI in `doGet()` — the diagnostic panel with test buttons

### Step 3.3: Verify postMessage security

Ensure all `postMessage` calls use `PARENT_ORIGIN` instead of `"*"` (fixing a known security gap in the current test template).

---

## Phase 4: Verify `setup-gas-project.sh` sed Patterns

**Estimated edits:** ~5-10 (if any patterns changed)

### Step 4.1: Compare variable declaration formats

After Phases 1-2, verify that the following sed patterns in `setup-gas-project.sh` still match the new template code:

| Pattern | What it matches | Check |
|---------|----------------|-------|
| `var TITLE = .*;` | Title declaration | Verify spacing + semicolon |
| `var DEPLOYMENT_ID = .*;` | Deployment ID | Verify format |
| `var SHEET_NAME     = .*;` | Sheet name (5 spaces) | **Verify exact spacing** |
| `var GITHUB_OWNER  = .*;` | GitHub owner (2 spaces) | **Verify exact spacing** |
| `var GITHUB_REPO   = .*;` | GitHub repo (3 spaces) | **Verify exact spacing** |
| `var _e = '[^']*';` | Encoded deployment URL | Verify quote style |
| `<title>.*</title>` | HTML title | Verify tag format |
| `var CLIENT_ID = '[^']*';` | OAuth client ID | Verify format |
| `var ACTIVE_PRESET = '[^']*';` | Active preset | Verify format |
| `ALLOWED_DOMAINS: \[\]` | Domain restriction | Verify presence |
| `ENABLE_DOMAIN_RESTRICTION: false` | Domain toggle | Verify presence |

### Step 4.2: Fix any mismatches

If testauthgas1 uses different spacing or formatting than what the sed patterns expect, update the sed patterns in `setup-gas-project.sh` to match the new template format.

### Step 4.3: Verify config.json template

If any new config fields need to be in `<page-name>.config.json`, update the JSON template in `setup-gas-project.sh`.

---

## Phase 5: Noauth Template Sync

**Estimated edits:** ~5-10

Features from the updated auth template that also apply to noauth:
- CSP meta tag (simpler policy — no auth endpoints)
- Changelog sanitization (`sanitizeChangelogHtml()`)
- Deferred AudioContext initialization
- Any CSS/structural improvements

Features that do **NOT** apply to noauth:
- Everything auth-related (session, HMAC, RBAC, admin, tab takeover, warning banners, nonces, etc.)

---

## What Gets EXCLUDED from Templates

These testauthgas1-specific items are **not** brought to the templates:

1. **Test timeout values** — 30s heartbeat, 3min session, etc. → use production values
2. **Project-specific RBAC roles** — `clinician`, `billing` → use generic `admin`, `editor`, `viewer`
3. **Security test panel UI** — `#security-test-panel`, "Run Security Tests" button → test-only diagnostic
4. **Force heartbeat panel** — `#force-heartbeat-panel` → test-only
5. **`saveNote()` function + UI** — example data operation → removed entirely
6. **`⚡ TEST VALUE` annotations** — not applicable to templates
7. **PROJECT START/END content** — project-specific code blocks (but admin utilities are moved out first)

---

## What Gets INCLUDED (features the templates gain)

All of these come "for free" by copying testauthgas1:

1. **RBAC system** — roles, permissions, spreadsheet-driven, 3-tier caching
2. **Cache epoch system** — nuclear cache invalidation
3. **HMAC-SHA256 signing** — server-side and client-side (Web Crypto API)
4. **Admin session management** — list/kick active sessions + admin panel UI
5. **Cross-device session enforcement** — eviction tombstones
6. **Tab takeover system** — BroadcastChannel-based single-tab enforcement
7. **Warning banners** — dual session + absolute timeout banners with countdown
8. **CSP meta tag** — Content Security Policy
9. **Nonce-based CSRF protection** — auth nonce + postMessage nonce exchange
10. **Origin validation** — `_isValidGasOrigin()`
11. **Auth UI state variations** — reconnecting, signing-in states
12. **Deferred AudioContext** — initialized on first user gesture
13. **Security event reporting** — postMessage-based with rate limiting
14. **Data operation validation** — `validateSessionForData()`
15. **Data audit logging** — toggle-gated
16. **Escalating lockout** — 3-tier progressive lockout
17. **Enhanced config toggles** — 10+ new configurable flags
18. **Server-side message signing** — `signAppMessage()`

---

## Execution Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
 GAS       HTML      Test GAS   Scripts   Noauth
(copy+mod) (copy+mod) (copy+add) (verify)  (selective)
```

Phases 1-2 are the heavy lifting (~20-25 edits each). Phases 3-5 are lightweight.
All phases can be done in a single session.

---

## Risk Mitigation

1. **Backup templates before starting** — copy current templates to `repository-information/backups/`
2. **Verify sed patterns after Phase 1-2** — dry-run `setup-gas-project.sh` or manually compare patterns
3. **Test propagation** — after template updates, verify Pre-Commit #20 (Template Source Propagation) correctly identifies changes
4. **Preserve PROJECT OVERRIDE markers** — any overrides in existing pages must be respected during propagation
5. **Diff check** — after each phase, diff the new template against testauthgas1 to confirm only the intended changes were made

Developed by: LightAISolutions
