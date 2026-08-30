---
paths:
  - "live-site-pages/**/*.html"
  - "live-site-pages/html-versions/**"
  - "live-site-pages/templates/**"
# Same path scope as .claude/rules/html-pages.md — this reference auto-injects
# whenever the core rules file does, so the setup / rename / divider / visual
# verification reference is always available alongside the actionable rules.
---

# HTML Pages Reference

*Path-scoped reference companion to `.claude/rules/html-pages.md`. Both files use the same `paths:` frontmatter, so this reference auto-injects whenever the core rules do. Content: new embedding page setup checklist, page rename/move procedures, per-page directory structure diagram, Template vs Project Code Separation (full canonical reference with all divider formats and examples — GAS files cross-reference here), and visual verification after UI changes.*

## New Embedding Page Setup Checklist

> **Automated by `scripts/setup-gas-project.sh`** — for GAS-embedded pages, the setup script handles all mechanical file creation (steps 1–13). Claude runs the script, then handles REPO-ARCHITECTURE.md, README.md tree, and commit/push.

When creating a **new** HTML embedding page, follow every step below:

1. **Copy the template** — start from the appropriate HTML template in `live-site-pages/templates/` (`HtmlAndGasTemplateAutoUpdate-noauth.html.txt` for standard pages, or `HtmlAndGasTemplateAutoUpdate-auth.html.txt` for pages with Google Authentication), which already includes:
   - Version file polling logic (fetches html.version.txt on load, then polls every 10 seconds)
   - Version indicator pill (bottom-right corner)
   - Green "Website Ready" + blue "Code Ready" splash overlays + sound playback
   - Orange "Under Maintenance" splash overlay (triggered by `maintenance|` prefix in html.version.txt)
   - AudioContext handling and screen wake lock
   - GAS version pill + GAS version polling (auto-activates when `gs.version.txt` exists — stays hidden otherwise)
   - GAS changelog popup (auto-activates with GAS pill)
   - Green "Website Ready" + Blue "Code Ready" splash screens (for HTML and GAS updates respectively)
2. **Choose the directory** — create a new subdirectory under `live-site-pages/` named after the project (e.g. `live-site-pages/my-project/`)
3. **Create the version file** — place a `<page-name>html.version.txt` file in `live-site-pages/html-versions/` (e.g. `html-versions/indexhtml.version.txt` for `index.html`), containing the initial version string in pipe-delimited format (e.g. `|v01.00w|`). This is the **single source of truth** for the page version — the HTML contains no hardcoded version
4. **Update the polling URL in the template** — ensure the JS version-file URL derivation matches the HTML filename (the template defaults to deriving it from the page's own filename)
5. **Create `sounds/` directory** — copy the `sounds/` folder (containing `Website_Ready_Voice_1.mp3`) into the new page's directory so the splash sound works
6. **Set the initial version** — set `<page-name>html.version.txt` to `|v01.00w|`
7. **Update the page title** — replace `YOUR_PROJECT_TITLE` in `<title>` with the actual project name
8. **Register in GAS Projects table** — if this page embeds a GAS iframe, add a row to the GAS Projects table in `.claude/rules/gas-scripts.md`
9. **Create GAS config file** — if this page embeds a GAS iframe, copy an existing config file (e.g. `googleAppsScripts/Testauthgas1/testauthgas1.config.json`) into the new GAS project directory, renaming it to `<page-name>.config.json` (e.g. `googleAppsScripts/MyProject/my-project.config.json`). Fill in the project-specific values. This is the single source of truth for `TITLE`, `DEPLOYMENT_ID`, `SPREADSHEET_ID`, `SHEET_NAME` — [PC-GAS-CONFIG] #14 syncs these values to `<page-name>.gs` and the embedding HTML
10. **Create GAS version file and changelog** — if this page has a GAS project, create `<page-name>gs.version.txt` in `live-site-pages/gs-versions/` (initial value `|v01.00g|`). Also create `<page-name>gs.changelog.md` and `<page-name>gs.changelog-archive.md` in `live-site-pages/gs-changelogs/`, replacing `YOUR_PROJECT_TITLE` with the project name
11. **Add developer branding** — ensure `<!-- Developed by: DEVELOPER_NAME -->` is the last line of the HTML file
12. **Create page changelog** — create `<page-name>html.changelog.md` in `live-site-pages/html-changelogs/`. Replace `YOUR_PROJECT_TITLE` with the page's human-readable title and update the archive link filename. Also create `<page-name>html.changelog-archive.md` in the same directory and update its title and changelog link filename

## Page Rename/Move Checklist

When **renaming** an existing HTML page's project environment, follow every step below. **Renaming is high-risk for changelog drift** — the `gas-template` → `gas-example` rename caused 16 missing entries in the deployment changelog because associated files were not fully synced.

**Project Environment Name** (required) — the base name shared by the HTML page and all its associated files. This is the name without extensions — e.g. `gas-example`, `test`, `index`. All file paths below are derived from this name:
- **Old name**: `OLD` (e.g. `gas-example`)
- **New name**: `NEW` (e.g. `my-new-project`)

| # | File | Old path | New path |
|---|------|----------|----------|
| 1 | HTML page | `live-site-pages/OLD.html` | `live-site-pages/NEW.html` |
| 2 | Version file | `live-site-pages/html-versions/OLDhtml.version.txt` | `live-site-pages/html-versions/NEWhtml.version.txt` |
| 3 | Changelog | `live-site-pages/html-changelogs/OLDhtml.changelog.md` | `live-site-pages/html-changelogs/NEWhtml.changelog.md` |
| 4 | Changelog archive | `live-site-pages/html-changelogs/OLDhtml.changelog-archive.md` | `live-site-pages/html-changelogs/NEWhtml.changelog-archive.md` |
| 5 | GAS script (if applicable) | `googleAppsScripts/OLD_PROJECT/OLD.gs` | `googleAppsScripts/NEW_PROJECT/NEW.gs` |
| 6 | GAS config (if applicable) | `googleAppsScripts/OLD_PROJECT/OLD.config.json` | `googleAppsScripts/NEW_PROJECT/NEW.config.json` |
| 7 | GAS version file | `live-site-pages/gs-versions/OLDgs.version.txt` | `live-site-pages/gs-versions/NEWgs.version.txt` |
| 8 | GAS changelog | `live-site-pages/gs-changelogs/OLDgs.changelog.md` | `live-site-pages/gs-changelogs/NEWgs.changelog.md` |
| 9 | GAS changelog archive | `live-site-pages/gs-changelogs/OLDgs.changelog-archive.md` | `live-site-pages/gs-changelogs/NEWgs.changelog-archive.md` |

**Steps:**
1. **Rename all files** — rename every file in the table above from old path to new path. Update titles, archive links, and internal references within each renamed file
2. **Delete old files** — remove all old-path files that were renamed (they now have the wrong name)
4. **Update GAS Projects table** — if the page has a GAS project, update the row in `.claude/rules/gas-scripts.md` with the new environment name, file paths, and directory
5. **Update internal references** — search all files for the old environment name and update: localStorage keys, HTML `<title>`, REPO-ARCHITECTURE.md, README.md, and any cross-references in other pages
6. **Verify changelog continuity** — after renaming, confirm the source changelog has all version entries from v01.01w through the current version with no gaps. The rename should not lose any history

## Directory Structure (per embedding page)

```
live-site-pages/
├── <page-name>/
│   ├── index.html               # The embedding page (from template)
│   └── sounds/
│       └── Website_Ready_Voice_1.mp3
├── html-versions/
│   └── <page-name>html.version.txt     # Tracks page version (e.g. "|v01.00w|")
├── gs-versions/
│   └── <page-name>gs.version.txt       # Tracks GAS version (e.g. "|v01.00g|")
├── html-changelogs/
│   ├── <page-name>html.changelog.md         # HTML changelog (source of truth + deployed)
│   └── <page-name>html.changelog-archive.md # Older changelog sections (rotated)
└── gs-changelogs/
    ├── <page-name>gs.changelog.md           # GAS changelog (source of truth + deployed)
    └── <page-name>gs.changelog-archive.md   # Older changelog sections (rotated)
```
Version files live in `live-site-pages/html-versions/` and `live-site-pages/gs-versions/`. Changelogs and their archives live in `live-site-pages/html-changelogs/` and `live-site-pages/gs-changelogs/` — these are both the source of truth and the deployed files fetched by the changelog popup. See Pre-Commit item [PC-PAGE-CHANGELOG] #16.

**Note:** The `live-site-pages/.nojekyll` file must already exist in the repo (see `.claude/rules/html-pages.md` — "Changelog Files"). New pages inherit it automatically since it applies to the entire deployment directory.

## Template vs Project Code Separation

All framework files — both HTML pages and GAS scripts — use the same TEMPLATE/PROJECT divider system to distinguish **template code** (shared across all projects, propagated via [PC-TEMPLATE-PROP] #19) from **project-specific code** (unique to one project, never overwritten during propagation). This section is the **canonical reference** for marker semantics, inline-marker rules, override behavior, and propagation semantics. GAS files have their own file structure specifics — see `.claude/rules/gas-scripts-reference.md` — "Template vs Project Code Separation" — for the GAS-specific parts (file layout order, JS-only comment syntax). The divider format adapts to the file context:

### Divider format by context
Dividers use 14 `═` characters. Both TEMPLATE and PROJECT markers use the same 3-line format.

**HTML body sections** — use HTML comments:
```html
<!-- ══════════════ -->
<!-- TEMPLATE START -->
<!-- ══════════════ -->

<!-- ══════════════ -->
<!-- TEMPLATE END -->
<!-- ══════════════ -->

<!-- ══════════════ -->
<!-- PROJECT START -->
<!-- ══════════════ -->

<!-- ══════════════ -->
<!-- PROJECT END -->
<!-- ══════════════ -->
```

**CSS sections** — use CSS comments:
```css
/* ══════════════ */
/* TEMPLATE START */
/* ══════════════ */

/* ══════════════ */
/* TEMPLATE END */
/* ══════════════ */

/* ══════════════ */
/* PROJECT START */
/* ══════════════ */

/* ══════════════ */
/* PROJECT END */
/* ══════════════ */
```

**JavaScript sections** (inside `<script>`) — use JS comments (same as GAS files):
```javascript
// ══════════════
// TEMPLATE START
// ══════════════

// ══════════════
// TEMPLATE END
// ══════════════

// ══════════════
// PROJECT START
// ══════════════

// ══════════════
// PROJECT END
// ══════════════
```

### HTML page structure (top to bottom)
Each HTML page has three zones with both TEMPLATE and PROJECT markers:

1. **CSS** (`<style>` block) — `/* TEMPLATE START */` before template styles (splash, version indicator, changelog, GAS pill, maintenance), `/* TEMPLATE END */` after template styles, then `/* PROJECT START/END */` wrapping any page-specific styles. PROJECT block is empty on new pages
2. **Body HTML** — `<!-- TEMPLATE START -->` after `<body>` before template structural elements (splash divs, gas-pill, gcl-overlay), `<!-- TEMPLATE END -->` after template elements, then `<!-- PROJECT START/END -->` wrapping page-specific content (where `<!-- YOUR PAGE CONTENT HERE -->` appears in the template). PROJECT block is empty on new pages
3. **JavaScript** (`<script>` block) — CONFIG section first (not inside TEMPLATE markers), then `// TEMPLATE START` before template JS (splash logic, auto-refresh polling, GAS iframe, changelog popup, wake lock), `// TEMPLATE END` after template JS, then `// PROJECT START/END` wrapping page-specific scripts. PROJECT block is empty on new pages

### Inline project markers
Same as GAS files — when project-specific code must live within template territory, use inline markers:
```html
<!-- PROJECT: custom splash override -->
```
```javascript
// PROJECT: deploy gate initialization
```

### Project override markers
When a project **modifies existing template code** (not adding new code, but changing template behavior — e.g. different CSS values, altered logic, restructured DOM within a template region), the modified lines must be marked with `PROJECT OVERRIDE` so template propagation can detect them and stop before overwriting.

**Single-line overrides** — append `PROJECT OVERRIDE: reason` to the end of the line:
```html
<div id="splash-overlay" style="background: #1a1a2e;"> <!-- PROJECT OVERRIDE: custom brand color -->
```
```css
#splash-overlay { background: #1a1a2e; } /* PROJECT OVERRIDE: custom brand color */
```
```javascript
const SPLASH_DURATION = 5000; // PROJECT OVERRIDE: longer splash for animation
```

**Multi-line overrides** — wrap the modified block with start/end markers:
```html
<!-- PROJECT OVERRIDE START: custom splash layout -->
<div id="splash-overlay" class="custom-splash">
  <img src="custom-logo.png" />
  <div class="custom-tagline">Welcome</div>
</div>
<!-- PROJECT OVERRIDE END -->
```
```css
/* PROJECT OVERRIDE START: custom splash styles */
#splash-overlay {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  display: grid;
  place-items: center;
}
/* PROJECT OVERRIDE END */
```
```javascript
// PROJECT OVERRIDE START: custom splash sequence
function showSplash() {
  // entirely different splash logic
}
// PROJECT OVERRIDE END
```

**Key distinction from inline `PROJECT:` markers**: `PROJECT:` marks **additions** (new code inserted into template territory). `PROJECT OVERRIDE:` marks **modifications** (existing template code that was changed). Both live inside TEMPLATE regions, but they signal different things to the propagation system:
- `PROJECT:` lines are preserved as-is — template propagation works around them
- `PROJECT OVERRIDE:` lines trigger a **hard stop** — template propagation must halt for that file and ask the user what to do, because the template change may conflict with the override

### Rules
- Same rules as GAS files: TEMPLATE markers delineate shared template code, PROJECT markers delineate page-specific code. Template updates propagate only within TEMPLATE markers, PROJECT blocks are preserved as-is
- Inline `// PROJECT:` markers for project-specific additions that must live inside template territory (same as GAS files)
- `PROJECT OVERRIDE:` markers for project-specific modifications to existing template code — these trigger a propagation halt (see "Project override markers" above)
- **The HTML template sources** (`HtmlAndGasTemplateAutoUpdate-noauth.html.txt` and `HtmlAndGasTemplateAutoUpdate-auth.html.txt`) have empty PROJECT blocks — placeholders for page-specific content
- **Template propagation** ([PC-TEMPLATE-PROP] #19) respects TEMPLATE/PROJECT boundaries — changes are applied to TEMPLATE regions only, PROJECT blocks are never touched. When `PROJECT OVERRIDE` markers are found in a TEMPLATE region that a template change touches, propagation **stops for that file** and alerts the user
- **New pages** must include all 6 marker pairs (TEMPLATE START/END + PROJECT START/END in CSS, body HTML, and JS). The `setup-gas-project.sh` script creates pages from the template which already contains these markers

## Visual Verification After UI Changes

**After making any visual/UI change to an HTML page or a GAS script that serves HTML** (new elements, modals, overlays, CSS styling, layout changes, z-index adjustments), run a Playwright visual verification **before committing**. This catches layout bugs, z-index issues, and rendering problems before they reach the deployed site.

GAS scripts are a primary trigger because `doGet()` serves the HTML shell and `getAppData()` returns content that populates the UI — most of the user-facing HTML is written inside `.gs` files, not in the embedding HTML pages.

### When this triggers
- Adding or modifying modals, popups, overlays, panels, or floating UI elements — in **either** `.html` or `.gs` files
- Changing CSS that affects layout, positioning, or visibility (z-index, display, position, flex, grid)
- Adding new HTML sections or restructuring existing DOM
- Modifying splash screens, auth walls, or full-screen overlays
- Modifying `doGet()` HTML output or `getAppData()` UI content in a `.gs` file
- Modifying GAS-served UI elements (admin panels, data tables, forms, status indicators) in a `.gs` file
- Any change where "does this look right?" is a relevant question

### When this does NOT trigger
- Non-visual changes: JavaScript logic-only, variable renaming, config values, version bumps
- Documentation-only changes: CHANGELOG, README, markdown files
- GAS script changes that are purely server-side logic (data processing, API calls, sheet operations) with no HTML/CSS/UI output
- Template variable or metadata changes

### What to do
1. **Determine the target page** — if the change was to an `.html` file, open that file. If the change was to a `.gs` file, look up its **embedding page** from the GAS Projects table in `.claude/rules/gas-scripts.md` and open that HTML page instead (GAS-served HTML is rendered inside the embedding page's iframe/context)
2. Write a Python Playwright script that opens the target page in a headless Chromium browser
3. Simulate the authenticated state (hide auth wall, activate the app) if the page requires sign-in
4. For GAS UI changes: inject the modified HTML/CSS into the page DOM to simulate what `doGet()` or `getAppData()` would render — since the real GAS backend isn't available in local testing
5. Activate the specific UI element that was changed (show the modal, open the panel, trigger the overlay)
6. Take a screenshot to `/tmp/visual-test-<page>.png`
7. **Read the screenshot** and visually verify the change looks correct
8. If the verification reveals a problem, fix it before committing — do not commit broken UI

### Viewport
- Use `390×844` (mobile) for pages that primarily target mobile users (e.g. pages with QR scanner, touch-focused UIs)
- Use `1280×800` (desktop) for admin pages or desktop-focused UIs
- When in doubt, test both viewports

### Expected `file://` errors to ignore
When opening pages via `file://` protocol, these console errors are expected and harmless:
- `Fetch API cannot load file:///...` — version polling, sound loading, and changelog fetches require HTTP
- `Failed to load resource: net::ERR_FILE_NOT_FOUND` — relative resource paths that resolve differently under `file://`
- Google Sign-In / GIS library errors — auth libraries require HTTPS

### Skip override
The user can say **"skip visual test"** to bypass this for a specific change. This does not disable the rule permanently — it applies only to the current interaction.

### Untestable interactive changes — do not ship blind to an auth-bearing page

> **This gate blocks deploying an interactive UI change to a served auth-bearing page when the visual/interaction test cannot run.**

When **both** of these are true, do NOT deploy the change as-is:
1. The Playwright visual/interaction test **cannot run** in this environment (e.g. the Chromium download is blocked, or no browser is available), **AND**
2. The change is **interactive** behavior — event handlers, focus management, `contenteditable`, observers (`ResizeObserver`/`MutationObserver`), dynamic positioning, or timers/handlers that read or mutate layout — on a **served auth-bearing page**: a GAS `.gs` whose `doGet()` serves the app shell that also runs the sign-in/verify flow, or an HTML page that hosts the auth wall.

**Why:** the served auth flow and the feature code run in the **same inline `<script>`**. A runtime error — or a layout/observer feedback loop — in the feature halts that script before the auth/verify init completes, so a cosmetic UI bug becomes a total **sign-in outage**. (Reference incident: an inline Comments formatting bar on a production auth page, blocked authentication on fresh sign-in and had to be fully reverted to `v01.51g`. It "worked" in already-authenticated sessions because the init path never re-ran.)

**Instead, do one of:**
1. **Defer** the change until an environment where the browser test can actually run, **OR**
2. **Land it behind an off-by-default flag** so the new code path cannot execute on the live auth flow until explicitly enabled, **OR**
3. **Get explicit developer sign-off to ship untested** — stating plainly in the response that it is unverified and what the failure mode would be.

**Exempt** (ship normally even when the test can't run): static/cosmetic changes (CSS colors, text, copy, version bumps) and non-interactive server-side logic — these can't fail at runtime in the browser the way interactive code can. The **`"skip visual test"`** override above covers *skipping the test*; it does **not** authorize shipping interactive auth-page changes blind — that still requires option 1, 2, or 3.

### Full command reference
*For on-demand visual testing (user-triggered), see CLAUDE.md — "Visual Test Command"*

Developed by: LightAISolutions
