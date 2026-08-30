---
paths:
  - "live-site-pages/**/*.html"
  - "live-site-pages/html-versions/**"
  - "live-site-pages/templates/**"
---

# HTML Pages Rules

*Actionable rules: see Pre-Commit Checklist items [PC-HTML-VERSION] #2, [PC-HTML-SOURCE] #3, [PC-TEMPLATE-FREEZE] #4, [PC-PRIVATE-REPO] #18, [PC-TEMPLATE-PROP] #19 in CLAUDE.md. Reference material (new embedding page setup checklist, page rename/move procedures, per-page directory structure, full Template vs Project Code Separation reference with divider formats and override markers, visual verification after UI changes): see `.claude/rules/html-pages-reference.md` — auto-injects with the same path scope as this file.*

## Build Version (Auto-Refresh for embedding pages)

- For standard template-style embedding pages, the version lives **solely** in `<page-name>html.version.txt` — the HTML contains no hardcoded version. **Exception:** standalone apps and auto-update payloads embed their own internal version (see "Internal/embedded version strings" below) — those internal copies must be bumped in lockstep with the version file
- Format uses pipe delimiters with the version in the middle field: e.g. `|v01.11w|` → `|v01.12w|`
- Each embedding page fetches `html.version.txt` from `live-site-pages/html-versions/` on load to establish its baseline version, then polls every 10 seconds — when the deployed version differs from the loaded version, it auto-reloads

### Internal/embedded version strings (standalone apps & auto-update payloads)
*Rule: see Pre-Commit Checklist item [PC-HTML-VERSION] #2.*

Standard template pages fetch and display `html.version.txt`, so they hold no hardcoded version. But **standalone apps** and **auto-update payloads** (`auto-update-payloads/`) embed their own version *inside* the file — typically a UI-displayed JS constant (e.g. `const APP_VERSION = 'vXX.XXw'`) and sometimes a hardcoded version label in the markup. These do **not** use the polling/auto-refresh mechanism (they aren't served as live-site pages).

- **Bump every internal occurrence** on every commit that modifies the file — the constant, any hardcoded label, and the `<meta name="build-version">` tag — in lockstep with the version file. Bumping only the version file leaves the visible in-app version stale and the user cannot confirm the update landed.
- **Single source of truth:** give each visible version label an `id` and set its text from the one constant at init (e.g. `document.getElementById('appVer').textContent = APP_VERSION`). A hardcoded literal that *duplicates* the constant is the failure mode — it silently goes stale. (This is exactly what happened with a dashboard payload page's sidebar version: `APP_VERSION` and the `<meta>` tag were bumped but a hardcoded sidebar literal was not, so the visible sidebar version stayed on the old number until a follow-up fix.)
- **Auto-update payload delivery:** payloads are pushed to their target machine by `autoHotkey/AutoUpdate.ahk`, driven by the manifest `autoHotkey/auto-update-targets.ini`. The AHK only re-delivers a payload when its `versionFile` (`live-site-pages/auto-update-html-versions/<page-name>html.version.txt`) changes — re-shipping the same version number will **not** redeliver corrected content. Always bump on every content change.

### Auto-Refresh via html.version.txt Polling
- **All embedding pages must use the `html.version.txt` polling method** — do NOT poll the page's own HTML
- **Version file naming**: the version file must be named `<page-name>html.version.txt`, matching the HTML file it tracks (e.g. `index.html` → `indexhtml.version.txt`, `dashboard.html` → `dashboardhtml.version.txt`). The `html.version.txt` extension distinguishes HTML page version files from GAS version files (`<page-name>gs.version.txt`) and the repo version file (`repository.version.txt`)
- Each version file uses pipe delimiters: `|v01.08w|`. The version is always the middle field (between the pipes). The polling logic splits on `|` and reads `parts[1]`, stripping the `v` prefix for internal comparison. The pipes stay in place at all times — switching to maintenance mode only changes the first field
- **html.version.txt is the single source of truth** — the HTML pages contain a `<meta name="build-version">` tag for informational purposes, but the polling logic does **not** read it. On page load, the polling logic immediately fetches html.version.txt, stores the version as the baseline, creates the version indicator pill, and begins the 10-second polling loop. This means bumping the version in html.version.txt alone (without editing the HTML meta tag) will trigger a reload correctly — after the reload, the page establishes the new version as its baseline, preventing an infinite loop. The meta tag is kept in sync with html.version.txt during commits for visibility, but it is never involved in the reload mechanism
- The polling logic fetches the version file (~7 bytes) instead of the full HTML page, reducing bandwidth per poll from kilobytes to bytes
- URL resolution: derive the version file URL relative to the current page's directory, using the page's own filename. See the HTML template files (`live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-noauth.html.txt` or `HtmlAndGasTemplateAutoUpdate-auth.html.txt`) for the implementation
- **The `if (!pageName)` fallback is critical** — when a page is accessed via a directory URL (e.g. `https://example.github.io/myapp/`), `pageName` resolves to an empty string. Without the fallback to `'index'`, the poll fetches `html.version.txt` (wrong file) and triggers an infinite reload loop
- Cache-bust with a query param: `fetch(versionUrl + '?_cb=' + Date.now(), { cache: 'no-store' })`
- The HTML templates in `live-site-pages/templates/` (`HtmlAndGasTemplateAutoUpdate-noauth.html.txt` and `HtmlAndGasTemplateAutoUpdate-auth.html.txt`) already implement this pattern — use them as a starting point for new projects

### Maintenance Mode via html.version.txt
The html.version.txt polling system supports a **maintenance mode** that displays a full-screen orange overlay when the first field is `maintenance`. The format always uses pipe (`|`) delimiters — you never need to add or remove pipes, just edit the fields:
- **Activate**: change the first field from empty to `maintenance` **and** fill the third field with the **exact display string** — the JS renders it verbatim with no reformatting. Use `As of:` prefix and pre-formatted date (e.g. `|v01.02w|` → `maintenance|v01.02w|As of: 10:00:00 PM EST 02/26/2026`). To get the value, run `TZ=America/New_York date '+As of: %I:%M:%S %p EST %m/%d/%Y'`. Custom messages also work (e.g. `maintenance|v01.02w|Back online soon!` → displays "Back online soon!")
- **Deactivate**: clear the first field back to empty (e.g. `maintenance|v01.02w|` → `|v01.02w|`)
- When the polling logic detects the `maintenance` prefix, it displays an orange full-screen overlay with the developer logo centered and a "🔧This Webpage is Undergoing Maintenance🔧" title — similar to the "Website Ready" splash but persistent
- The overlay stays visible as long as the html.version.txt content starts with `maintenance` — it does not auto-dismiss
- The version indicator pill remains visible on top of the maintenance overlay (the maintenance overlay uses `z-index: 9998`, below the version indicator's `z-index: 9999`)
- When the `maintenance` prefix is removed: if the underlying version also changed, the page auto-reloads; if the version is unchanged, the overlay fades out gracefully
- **No version bump for standalone maintenance activation** — if the user's request is solely to activate (or deactivate) maintenance mode and nothing else, do NOT bump the version in html.version.txt or the HTML meta tag. Only edit the first and third fields of html.version.txt (the `maintenance` prefix and the timestamp/message). The version field (middle) stays unchanged. If the user requests maintenance mode **combined** with other changes that would normally trigger a version bump (e.g. editing the HTML page, updating a `.gs` file), then bump the version as usual per Pre-Commit Checklist item [PC-HTML-VERSION] #2

### Inactive Mode via html.version.txt
The html.version.txt polling system also supports an **inactive mode** using the same first-field mechanism as maintenance mode. Inactive mode signals that a page is intentionally taken offline or disabled — distinct from maintenance (temporary, coming back) or active (normal operation).
- **Activate**: change the first field to `inactive` (e.g. `|v01.02w|` → `inactive|v01.02w|As of: 10:00:00 PM EST 03/10/2026`). Like maintenance mode, the third field is the display string
- **Deactivate**: clear the first field back to empty (e.g. `inactive|v01.02w|` → `|v01.02w|`)
- **No version bump for standalone inactive activation** — same rule as maintenance mode: only edit the first and third fields, leave the version field unchanged
- **Status indicators in chat output** — the page's status is reflected in the URL sections of every response (see `chat-bookends.md` — Page Enumeration). The three states map to: `🟢` Active (empty first field), `🟡` Maintenance (`maintenance` first field), `🔴` Inactive (`inactive` first field)

## Private Repo Compatibility
- **All client-side code in HTML pages must only access resources available on the public GitHub Pages URL.** The repo may be private while GitHub Pages remains public — `raw.githubusercontent.com` and `api.github.com` require authentication on private repos and will fail silently from browser JavaScript. Instead, deploy any needed resources alongside the HTML pages in `live-site-pages/` so they're served through the public GitHub Pages domain
- The GAS scripts (server-side) are exempt — they use authenticated API calls via `GITHUB_TOKEN` from script properties
- This applies to all existing and future features that run in the browser on the deployed site

### Changelog Files
- Each page's changelog lives directly in `live-site-pages/html-changelogs/` as a `.md` file — this is both the source of truth and the deployed file fetched by the changelog popup. No separate deployment copy is needed
- Naming: `live-site-pages/html-changelogs/PAGENAMEhtml.changelog.md`
- GAS changelogs follow the same pattern: `live-site-pages/gs-changelogs/PAGENAMEgs.changelog.md`
- Archive files live alongside their changelogs in the same subdirectory
- The HTML pages fetch changelog files via a relative URL from `html-changelogs/` (same base-path pattern as the version files in `html-versions/`), so the changelog popup works regardless of whether the repo is public or private
- **`.nojekyll` is required** — the `live-site-pages/.nojekyll` file **must** exist to prevent GitHub Pages from running Jekyll on the deployment. Without it, Jekyll processes `.md` files into rendered HTML (with `<h1>`, `<h2>`, `<ul>` tags wrapped in a Jekyll layout), which breaks the changelog popup parsers — the JavaScript regex expects raw markdown (`## [v01.01w]`, `### Added`, `- item`) and produces no matches against rendered HTML, resulting in "No changelog entries yet." for every page. **Never delete `.nojekyll`** — it is critical infrastructure for the changelog system. This file was added in v03.96r after diagnosing the bug introduced when changelogs migrated from `.txt` to `.md` in v03.88r (`.txt` files were unaffected because Jekyll only processes markdown)

## Template Source Propagation

*Rule: see Pre-Commit Checklist item [PC-TEMPLATE-PROP] #19 in CLAUDE.md.*

When any template source file is modified, **propagate the same changes to all existing pages/GAS scripts** in the repo. The template sources are:
- **HTML templates**: `live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-noauth.html.txt` and `HtmlAndGasTemplateAutoUpdate-auth.html.txt` → propagate to all `.html` pages in `live-site-pages/`. Changes to shared template logic in either variant must be applied to both variants and to all existing pages
- **GAS templates**: `live-site-pages/templates/gas-minimal-noauth-template-code.js.txt` (default) and `gas-minimal-auth-template-code.js.txt` (auth variant) → propagate to all `.gs` files in `googleAppsScripts/`. Shared template logic changes must be propagated across both variants

### What "propagate" means
- Apply the **same structural/feature change** (the diff) to each existing page or GAS script — do NOT blindly overwrite files. Each page has its own title, config values, deployment IDs, localStorage keys, and page-specific customizations that must be preserved
- If the template change adds a new feature (e.g. a new UI element, a new polling mechanism, a new function), add that same feature to every existing page/script in the equivalent location
- If the template change fixes a bug or modifies existing shared logic, apply the same fix/modification to every existing page/script that has that logic
- If the template change removes a feature, remove it from every existing page/script

### Conflict detection — alert before applying
Before propagating, check each target page/script for **customizations that would conflict** with the template change. A conflict exists when:
- The target has **modified the same code region** that the template change touches (e.g. the page replaced the standard splash overlay with a custom one, and the template change modifies the splash overlay)
- The target has **removed a feature** that the template change modifies (e.g. the page intentionally stripped out audio handling, and the template change adds new audio logic)
- The template change would **break page-specific behavior** (e.g. the change assumes a DOM structure that a page has customized)

When a conflict is detected:
1. **Stop propagation for that specific page** — do not force the change
2. **Alert the user** with the page name, the conflicting code region, and why it conflicts
3. **Let the user decide** — they may adjust the template source to accommodate all pages, manually adapt the conflicting page, or skip that page

### What is NOT a conflict
- Different `<title>` values, different GAS config variables (`DEPLOYMENT_ID`, `SPREADSHEET_ID`, etc.), different localStorage key prefixes — these are expected per-page customizations and are never touched during propagation
- Page-specific content (custom HTML sections, extra features unique to one page) that does not overlap with the template change — leave these untouched

### Version bumps
- Each propagated page/script gets its own version bump per Pre-Commit items [PC-GS-VERSION] #1 and [PC-HTML-VERSION] #2 — the template change counts as a modification to each file
- Templates don't have their own version files — [PC-TEMPLATE-FREEZE] #4 confirms templates are exempt from version tracking

### Propagation scope
- **HTML propagation**: all `.html` files in `live-site-pages/` (including subdirectories) that were originally created from the template. Exclude any HTML files that are not embedding pages (e.g. static content pages that don't use the template structure)
- **GAS propagation**: all `.gs` files in `googleAppsScripts/` that were originally created from a GAS template. The GAS templates (`gas-minimal-noauth-template-code.js.txt`, `gas-minimal-auth-template-code.js.txt`) use `.js.txt` extension but the deployed files use `.gs` — the propagation maps the change from the template's JS structure to each `.gs` file's equivalent location

## Test Quality — No Fake or Trivial Tests

When writing security tests, feature tests, or any automated verification:

- **Every test must verify real behavior** — call actual functions, feed real inputs, and check real outputs or side effects. Never write a test that assigns a variable and then checks that variable, or that queries the DOM for an element's existence without verifying its behavior
- **Banned patterns** (these produce false confidence and waste the developer's time auditing them):
  - Setting a variable to a value and asserting it equals that value (tests the test, not the code)
  - Checking `typeof fn === 'function'` or `document.getElementById(x) !== null` as the sole assertion (existence ≠ correctness)
  - Checking config constants match expected values (the test just hardcodes the same value — proves nothing)
  - Creating test-only objects/arrays to verify instead of testing the actual runtime data
- **Required patterns** (every test must do at least one of these):
  - Call a real function with controlled inputs and verify the output or side effect (e.g. `sanitizeChangelogHtml('<img onerror=alert(1)>')` → verify script stripped)
  - Inspect actual code via `fn.toString()` for destructive functions that can't be safely called (e.g. verify `performSignOut` calls `clearSession`)
  - Parse real runtime state (e.g. read the actual CSP meta tag content and verify directives)
  - Execute a real operation and verify state change (e.g. call `clearSession()`, verify storage cleared, then restore)
- **When in doubt, ask**: "if this test passed on broken code, would it catch the bug?" If the answer is no, the test is fake — rewrite it or remove it
- This applies to **all** test creation — security tests, unit tests, integration checks, validation scripts. The developer should never need to audit tests for legitimacy after the fact

## Auth Wall Completeness — Mandatory UI Deactivation

When `showAuthWall()` is called (whether from sign-out, session expiry, or any other code path), **every** authenticated UI element must be hidden and every background process must be stopped. Nothing behind the auth wall should remain visible or functional.

**Elements that `showAuthWall()` must always clean up:**
- `admin-sessions-panel` — local sessions panel (hide + reset `_adminPanelOpen`)
- `gcl-overlay` — GAS changelog popup (z-index 10004, floats above auth wall)
- `tab-takeover-wall` — single-tab enforcement overlay (hide + reset `_tabSurrendered`)
- `auth-timers` — session countdown pill (z-index 10003, call `stopCountdownTimers()`)
- Page-specific panels (e.g. `admin-global-sessions-panel` on Global ACL) — marked with `PROJECT OVERRIDE`

**When adding new authenticated UI elements** (floating panels, modals, popups, status indicators, or any element with z-index ≥ auth-wall's z-index):
1. Add cleanup code to `showAuthWall()` in the "Deactivate all authenticated UI" block
2. Use safe null-checks (`if (el) el.style.display = 'none'`) since not all pages have all elements
3. If the element is page-specific (not in the template), add it with a `PROJECT OVERRIDE` comment
4. Update the template's `showAuthWall()` if the element exists in the template

**The test:** after any sign-out or session expiry, open DevTools and verify no element with z-index ≥ 10002 is visible except the auth wall itself.

## GAS UI Layout Awareness

*Rule: see `.claude/rules/gas-scripts.md` — section "GAS UI Layout Awareness". GAS elements are guests in the host HTML page and must defer to its layout.*

Developed by: LightAISolutions
