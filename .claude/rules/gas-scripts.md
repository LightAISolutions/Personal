---
paths:
  - "googleAppsScripts/**/*.gs"
  - "googleAppsScripts/**/*.config.json"
  - "live-site-pages/gs-versions/**"
  - "live-site-pages/testauthgas1.html"
  - "live-site-pages/testauthhtml1.html"
  - "live-site-pages/globalacl.html"
  - "live-site-pages/MasterACL.html"
  - "live-site-pages/*-code.js.txt"
# Path scope rationale: GAS rules auto-inject for .gs / .config.json / gs-versions
# edits (directly GAS-related), plus for edits to the 3 GAS-backed HTML pages
# from the GAS-backed HTML pages in the GAS Projects table in this file (where [PC-GAS-CONFIG] #14's
# iframe-embed sync logic applies). The previous `live-site-pages/**/*.html`
# glob over-scoped — text-compare/gas-project-creator/404.html
# have no GAS backend, so injecting ~300 lines of GAS rules on every HTML edit
# to those pages was pure context noise. When a new GAS-backed page is added
# via setup-gas-project.sh, add its HTML path here too (and to the GAS Projects
# table below) to restore auto-injection for that page.
---

# Google Apps Script Rules

*Actionable rules: see Pre-Commit Checklist items [PC-GS-VERSION] #1, [PC-REPO-VERSION] #15 in CLAUDE.md. Reference material (architecture overview, setup steps for new projects, webhook auto-deploy, template source file, template vs project code separation, GAS UI layout awareness, visual verification): see `.claude/rules/gas-scripts-reference.md` — auto-injects with the same path scope as this file.*

## Version Bumping

- The `VERSION` variable is near the top of each `.gs` file (look for `var VERSION = "..."`)
- Format includes a `g` suffix with a `v` prefix: e.g. `"v01.13g"` → `"v01.14g"`
- Each GAS project also has a `<page-name>gs.version.txt` in `live-site-pages/gs-versions/` that stores the version in pipe-delimited format (e.g. `|v01.00g|`), matching the `html.version.txt` format. The `.gs` `VERSION` variable uses no pipes (e.g. `"v01.00g"`) — when writing to `gs.version.txt`, wrap the version in pipes. This file is bumped alongside `VERSION` by [PC-GS-VERSION] #1. There is no copy in `googleAppsScripts/` — the `live-site-pages/gs-versions/` file is the single location, polled by the HTML layer for GAS version display
- Do NOT bump VERSION if the commit doesn't touch the `.gs` file

### GAS Projects
Each GAS project has a code file and a corresponding embedding page. Register them in the table below as you add them. *For step-by-step instructions on adding a new GAS deploy step to the workflow, see the "HOW TO ADD A NEW GAS PROJECT" comment block at the top of `.github/workflows/auto-merge-claude.yml`.*

| Project | Code File | Config File | Embedding Page |
|---------|-----------|-------------|----------------|
| Testauthgas1 | `googleAppsScripts/Testauthgas1/testauthgas1.gs` | `googleAppsScripts/Testauthgas1/testauthgas1.config.json` | `live-site-pages/testauthgas1.html` |
| Testauthhtml1 | `googleAppsScripts/Testauthhtml1/testauthhtml1.gs` | `googleAppsScripts/Testauthhtml1/testauthhtml1.config.json` | `live-site-pages/testauthhtml1.html` |
| Globalacl | `googleAppsScripts/Globalacl/globalacl.gs` | `googleAppsScripts/Globalacl/globalacl.config.json` | `live-site-pages/globalacl.html` |
| MasterACL | `googleAppsScripts/MasterACL/MasterACL.gs` | `googleAppsScripts/MasterACL/MasterACL.config.json` | `live-site-pages/MasterACL.html` |


## GAS Project Config (config.json)

Each GAS project directory contains a `<page-name>.config.json` file that is the **single source of truth** for project-unique variables. This mirrors the `version.txt` pattern — one small file to edit, with sync rules that propagate values to `<page-name>.gs` and the embedding HTML page.

### Naming convention
All GAS files are named after the HTML page they serve — mirroring the `testauthgas1html.version.txt` pattern:
- `testauthgas1.gs` — GAS code for `testauthgas1.html`
- `testauthgas1.config.json` — config for `testauthgas1.html`
- `dashboard.gs` — GAS code for `dashboard.html`
- `dashboard.config.json` — config for `dashboard.html`

The `.config.json` double extension ensures the config file sorts **after** the `.gs` file alphabetically (same reasoning as `html.version.txt` sorting after `.html`).

### Config file contents

| Key | Description | Syncs to |
|-----|-------------|----------|
| `TITLE` | Project title shown in browser tabs and GAS UI | `<page-name>.gs` `var TITLE`, HTML `<title>` tag |
| `DEPLOYMENT_ID` | GAS deployment ID (`AKfycb...` string) | `<page-name>.gs` `var DEPLOYMENT_ID`, HTML `var _e` inside GAS IIFE (reverse+base64 encoded), `.github/workflows/auto-merge-claude.yml` (auto-read from `<page-name>.config.json` at merge time via `jq` — see [PC-GAS-CONFIG] #14) |
| `SPREADSHEET_ID` | Google Sheets ID for version tracking | `<page-name>.gs` `var SPREADSHEET_ID` |
| `SHEET_NAME` | Sheet tab name | `<page-name>.gs` `var SHEET_NAME` |

### What is NOT in config.json
- `VERSION` — auto-bumped by [PC-GS-VERSION] #1, lives only in `<page-name>.gs`
- `GITHUB_OWNER`, `GITHUB_REPO`, `FILE_PATH` — derived from repo structure, managed by init script
- `EMBED_PAGE_URL` — repo-wide setting, managed by init script
- `GITHUB_BRANCH` — always `main`

### Obfuscated deployment URL (var _e inside GAS IIFE)
The encoded deployment URL lives in `var _e` inside the GAS iframe IIFE — not as a global variable. This keeps it out of the browser console and DevTools Sources panel. The decode logic is inline (no named function). Derivation from `DEPLOYMENT_ID`:
- If `DEPLOYMENT_ID` is not a placeholder:
  1. Construct the full URL: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`
  2. Reverse the URL string
  3. Base64-encode the reversed string
  4. Store as `var _e = 'encoded_value';` inside the GAS IIFE
- If `DEPLOYMENT_ID` is a placeholder (`YOUR_DEPLOYMENT_ID`) → `var _e = '';` (empty, IIFE exits early)

To generate via command line: `echo -n 'https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec' | rev | base64 -w0`

The inline decode reverses this: `atob()` then string-reverse. The iframe is created dynamically via srcdoc trampoline (no `src` attribute set). This is obfuscation, not security — the Network tab still shows the URL

### Template config
The setup script (`scripts/setup-gas-project.sh`) generates config.json files inline with placeholder values when creating new projects — there is no separate template config file to maintain.

## Commit Message Naming
*Rule: see Pre-Commit Checklist item [PC-COMMIT-MSG] #8 in CLAUDE.md — the push commit message carries the repo version prefix ONLY.*
- All version types use the `v` prefix — suffix indicates type: `r` = repository, `g` = Google Apps Script, `w` = website. Only the `r` version ever appears in commit messages; `g`/`w` versions live in their version files and changelog headers
- The **push commit** (final commit before `git push`) starts with the repo version prefix followed by a descriptive message (e.g. `v01.05r Fix typo in CLAUDE.md`) — do NOT append `g`/`w` versions, even when those were bumped in the same commit. Which layers a push touched is recorded by the CHANGELOG version section (per-file subheadings) and by each page/GAS changelog header's repo-version cross-reference — the archive rotation's SHA lookups rely on that cross-reference and on the leading `vXX.XXr `, never on `g`/`w` prefixes in commit subjects
- **Intermediate commits** (earlier commits in the same session) use a plain descriptive message with no version prefix
- SHA backfill commit: always uses `Backfill CHANGELOG SHA` — no version prefix, exempt from all push commit rules (see [PC-COMMIT-MSG] #8)
- *(Superseded 2026-08-29, developer decision: this section previously instructed appending bumped `g`/`w` versions to push commits in `r`, `g`, `w` order, and prefixing intermediate commits with bumped `g`/`w` versions — both contradicted [PC-COMMIT-MSG] #8, the single source of truth, from the initial commit onward. Historical multi-version commit subjects remain valid history; SHA-enrichment greps anchor on the leading `vXX.XXr ` and match both forms.)*

## Test Quality

Automated testing for `.gs` code is **largely out of scope** for this repo. GAS runs server-side on Google's infrastructure and exposes entry points (`doGet`, `doPost`, time-driven triggers, event handlers) that require real GAS runtime context — spreadsheet state, session tokens, GAS services — to exercise meaningfully. There is no local test harness, and running tests through the GAS editor requires human interaction. As a result, GAS code is validated by: (a) manual invocation via the GAS editor during development, (b) the live auto-deploy webhook after push, and (c) observed behavior on the embedding HTML page.

**If a GAS project introduces testable pure-JS helpers** (e.g. string sanitization, config parsing, data-transform functions with no GAS API dependencies), those SHOULD follow the "No Fake or Trivial Tests" rule in `html-pages.md` — verify real behavior with controlled inputs, avoid the banned patterns (tautological assertions, existence-only checks, hardcoded-equals-hardcoded). But this is the narrow exception, not the default.

**Never add test stubs to `.gs` files just to have tests.** The GAS deploy pipeline doesn't run them, so an untested test is dead code that still adds version-counter pressure and public-changelog entries.

## Coding Guidelines Reference

Domain-specific coding constraints are maintained in a dedicated reference file. Consult these when working on the relevant feature area:

| Topic | Reference |
|-------|-----------|
| GAS Code Constraints | *See `repository-information/CODING-GUIDELINES.md` — section "GAS Code Constraints"* |
| Race Conditions — Config vs. Data Fetch | *See `repository-information/CODING-GUIDELINES.md` — section "Race Conditions — Config vs. Data Fetch"* |
| API Call Optimization (Scaling Goal) | *See `repository-information/CODING-GUIDELINES.md` — section "API Call Optimization (Scaling Goal)"* |
| UI Dialogs — No Browser Defaults | *See `repository-information/CODING-GUIDELINES.md` — section "UI Dialogs — No Browser Defaults"* |
| AudioContext & Browser Autoplay Policy | *See `repository-information/CODING-GUIDELINES.md` — section "AudioContext & Browser Autoplay Policy"* |
| Google Sign-In (GIS) for GAS Embedded Apps | *See `repository-information/CODING-GUIDELINES.md` — section "Google Sign-In (GIS) for GAS Embedded Apps"* |
| GCP Project Setup & Troubleshooting | *See `repository-information/CODING-GUIDELINES.md` — section "GCP Project Setup & Troubleshooting"* |

## ⚠️ Deploy Handler Protection (NEVER break this)

The `doPost(action=deploy)` handler is the critical link in the auto-update pipeline (push → merge → GAS pulls + redeploys). **It must remain completely unauthenticated and unguarded.** Specifically:

- **Do NOT** add secret/token/password checks to the deploy action
- **Do NOT** add origin validation, IP allowlists, or rate limiting
- **Do NOT** wrap it in any conditional that could return early before calling `pullAndDeployFromGitHub()`

**Why it's safe without auth:** the deploy action only calls `pullAndDeployFromGitHub()`, which fetches the `.gs` file from the GitHub repo and overwrites the GAS project with it. GitHub is the source of truth — an attacker calling `doPost(action=deploy)` can only trigger a re-pull of the *same code that's already on GitHub*. There is no abuse vector: no arbitrary code execution, no data exfiltration, no state mutation beyond what GitHub already contains.

**What happened when auth was added (v02.79r):** a `DEPLOY_SECRET` check was added to the deploy handler. Since no secret was configured in Script Properties (`!expectedSecret` was true), every deploy request returned "Unauthorized" — silently breaking auto-updates. The GAS script stopped pulling new code from GitHub, and no error was visible in the workflow logs (the HTTP call succeeded, it just returned "Unauthorized" as text). This went undetected for multiple versions.

**The pattern to watch for:** security hardening of GAS scripts that adds guards to `doPost()`. When reviewing or applying security changes to `.gs` files, **always verify the deploy handler remains bare** — no auth, no guards, just the direct `pullAndDeployFromGitHub()` call. The in-code `⚠️ CRITICAL` comment block serves as a last line of defense.

*Full architecture context (the auto-update pipeline, Dynamic Loader pattern, Auto-Deploy Flow step-by-step, Version Limit Management): see `.claude/rules/gas-scripts-reference.md` — section "GAS Architecture Overview".*

Developed by: LightAISolutions
