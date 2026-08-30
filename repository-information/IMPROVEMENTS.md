# Potential Improvements

Ideas and optimizations to explore — no commitment, investigated when time allows.

## When to use which tracking file

Several files in `repository-information/` hold forward-looking notes. They look similar on first read but serve different timescales and audiences. Use this table to decide where a new note belongs:

| File | Purpose | Timescale | Who writes |
|------|---------|-----------|-----------|
| `TODO.md` | Active, actionable items that show in every response's `📋📋TODO📋📋` section. **Max 10 items.** | Days to weeks | Developer or Claude, as direct outputs of a session |
| `REMINDERS.md` | Developer's own notes to self — "remind me next time X". Surfaced at session start as `📌 Reminders For Developer`. | Session-to-session | Developer (Claude surfaces but does not modify without approval) |
| `SESSION-CONTEXT.md` | Snapshot of the most recent 1–2 sessions — what was done, where we left off, active context. Auto-reconstructs from CHANGELOG if stale. | Last 1–2 sessions | Claude on "Remember Session"; auto-reconstructed if missing |
| `IMPROVEMENTS.md` | Backlog-sized ideas — specific, scoped, investigated-when-time-allows items. Each has a clear scope and rough cost. | Weeks to months | Developer or Claude when a concrete improvement is identified |
| `FUTURE-CONSIDERATIONS.md` | Long-horizon strategic thinking — open-ended directions, architectural moves, speculative ideas. Not scoped. | Months to never | Developer primarily |
| `DEFERRED-GAS-IFRAME-PLAN.md` | A **single** deferred technical plan (GAS iframe rework) preserved in detail. Named for its specific subject. | Paused until resumed | Created once when the plan is deferred |

**Quick decision tree** when you're about to add a note:
- "I need to do this soon and want it visible in every response" → `TODO.md`
- "I want to remember this next session starts" → `REMINDERS.md`
- "This is an idea worth exploring, not urgent" → `IMPROVEMENTS.md`
- "This is a direction or philosophy we might take someday" → `FUTURE-CONSIDERATIONS.md`
- "I'm closing a session" → `SESSION-CONTEXT.md` (via "Remember Session" command)

Addresses review finding §9 — file-purpose drift between TODO / IMPROVEMENTS / FUTURE-CONSIDERATIONS.

## GAS Auto-Update: Switch from CacheService to PropertiesService

**Current approach:** When a new GAS version is deployed, `pullAndDeployFromGitHub()` writes the version string to `CacheService.getScriptCache()` with key `"pushed_version"`. Client-side JS polls `readPushedVersionFromCache()` every 15 seconds. If the version differs, it triggers the "Code Ready" blue splash reload.

**Problem:** CacheService entries expire after 1 hour (max 6 hours). If a client doesn't poll within that window — e.g. a tab left open overnight — it never learns about the update. The cache can also vanish if Google recycles the GAS runtime before the TTL expires.

**Proposed improvement:** Replace `CacheService.getScriptCache()` with `PropertiesService.getScriptProperties()` for storing the deployed version:
- **Persists indefinitely** — survives runtime recycling, no TTL expiration
- **Same broadcast semantics** — script-level properties are shared across all clients
- **No cleanup needed** — overwrite the same key each deploy
- **Negligible performance difference** — slightly slower than CacheService, but irrelevant at a 15-second polling interval

**Changes required:**
1. In the deploy function: replace `cache.put("pushed_version", version, 3600)` with `PropertiesService.getScriptProperties().setProperty("pushed_version", version)`
2. In `readPushedVersionFromCache()`: replace `CacheService.getScriptCache().get("pushed_version")` with `PropertiesService.getScriptProperties().getProperty("pushed_version")`
3. Rename the function to `readPushedVersion()` (dropping "FromCache") for accuracy
4. Update CLAUDE.md GAS Code Constraints section to reflect the new storage mechanism

## Test Assumptions Before Committing to an Approach

**Context:** When a proposed solution combines multiple individually-confirmed facts into an untested conclusion (e.g. "browser API X does Y" + "browser API Z does W" → "therefore X+Z together do Q"), the combined behavior is an inference, not a confirmed fact. In high-stakes scenarios, committing to the approach across all files before verifying the combination can lead to wasted work if the inference is wrong.

**Proposed improvement:** Before applying a novel-combination solution repo-wide, build a minimal verification step:
- Create a small test page or script that exercises the exact combined behavior
- Verify it works in the target environment (browser, runtime, etc.)
- Only then propagate the approach to all affected files

**When this matters:**
- The solution depends on undocumented or sparsely-documented behavior
- Multiple API surfaces or specs need to interact in a specific way
- Rollback would be expensive (many files touched, version bumps already committed)

**When this is overkill:**
- The solution uses well-documented, commonly-used patterns
- The deployment model allows instant verification and easy rollback (e.g. this repo's auto-refresh via html.version.txt — push, verify live, fix if wrong)
- The risk of the inference being wrong is negligible

**Current status:** Not codified as a rule in CLAUDE.md. The Confidence Disclosure rule covers *flagging* untested inferences; this would cover *verifying* them before committing. Worth adding if a failure pattern emerges where an untested inference was wrong and caused significant rework.

## HTML Page Config Files (html.config.json)

**Context:** GAS projects have a `<page-name>.config.json` that serves as the single source of truth for project-unique variables (`TITLE`, `DEPLOYMENT_ID`, `SPREADSHEET_ID`, `SHEET_NAME`). Pre-Commit item #15 syncs these values to the `.gs` code file and the embedding HTML page. The config exists because the same value must appear in multiple files and needs a coordination point.

**Current state of HTML config variables:** Each embedding HTML page has a `// ── CONFIG ──` block with page-local variables:
- `DEVELOPER_LOGO_URL` — logo shown on splash screens
- `YOUR_ORG_LOGO_URL` — org logo URL
- `SPLASH_LOGO_URL` — which logo to actually display on splash screens (defaults to `DEVELOPER_LOGO_URL`)
- `AUTO_REFRESH` — enable/disable build-version polling
- `SHOW_WEB_VERSION` — show/hide the version indicator pill

**Why a config file is NOT needed today:** None of these variables sync to another file. They live exclusively in the HTML's `<script>` block. The cross-file sync needs (title → `<title>` tag, deployment ID → `var _e`) are already handled by the GAS `config.json`. Adding an `html.config.json` would introduce an extra file, an extra sync rule in CLAUDE.md, and extra Pre-Commit overhead — all to centralize values that already live in exactly one place.

**When to introduce html.config.json:** Consider adding `<page-name>.html.config.json` files (or extending the existing `<page-name>.config.json` with an `html` section) if any of these scenarios emerge:
1. **Cross-page shared config** — an HTML variable (like `LOGO_URL` or `AUTO_REFRESH`) needs to be consistent across multiple pages and manually keeping them in sync becomes error-prone
2. **External consumer** — a workflow, build script, or other file needs to read an HTML config value (e.g. a CI step that validates logo URLs, or a script that toggles `AUTO_REFRESH` across all pages)
3. **Non-developer configuration** — a user who shouldn't edit HTML needs to configure page behavior via a simple JSON file
4. **New page-specific variables** — a feature adds new per-page settings (e.g. custom theme colors, feature flags, API endpoints) that would clutter the HTML `CONFIG` block and benefit from external configuration

**Design considerations if implemented:**
- **Naming**: `<page-name>html.config.json` (following the existing `html.version.txt` naming pattern) or extend `<page-name>.config.json` with an `"html"` key to keep one config per page
- **Sync rule**: would need a new Pre-Commit item (or extension of #15) to sync JSON values → HTML `<script>` CONFIG block
- **Template**: the HTML template files (`HtmlAndGasTemplateAutoUpdate-noauth.html.txt` and `HtmlAndGasTemplateAutoUpdate-auth.html.txt`) would need corresponding template configs with placeholder values
- **Init script**: `scripts/init-repo.sh` would need to handle HTML config files during initialization (logo URLs, etc.)

**Current status:** Not needed. Revisit when adding features that introduce new per-page configuration or cross-page shared settings.

Developed by: LightAISolutions
