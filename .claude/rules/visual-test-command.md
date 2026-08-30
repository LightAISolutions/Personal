---
paths:
  - "live-site-pages/**/*.html"
  - "googleAppsScripts/**/*.gs"
---

# Visual Test Command

*Path-scoped: auto-injects when editing HTML pages or GAS scripts. User-triggered by the "visual test" keyword — Claude Code auto-loads this file when the paths match, and the command body below is always available for on-demand invocation. Cross-referenced from `CLAUDE.md`.*

If the user says **"visual test"** (or similar: "test it", "screenshot it", "verify it visually", "take a screenshot", "show me what it looks like", "playwright test"):

Run a Playwright-based visual verification of one or more HTML pages and their GAS-served UI. This command can target specific pages or all pages. It opens each page in a headless Chromium browser, simulates the signed-in state, and takes screenshots that Claude reads and visually inspects. GAS scripts (`.gs` files) are included because `doGet()` serves HTML and most user-facing UI is written inside GAS files — when a `.gs` file is modified, the visual test opens its embedding HTML page.

## Procedure

1. **Chromium is PRE-INSTALLED — do NOT run `playwright install`** (it tries to re-download the browser and fails behind the network policy). The Python `playwright` package is available; the bundled build number won't match the pre-installed one, so launch with an explicit `executable_path`:
   ```bash
   pip install playwright 2>/dev/null | tail -1        # package only — never run "playwright install"
   ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome  # locate the pre-installed executable
   ```
   In the launch call: `p.chromium.launch(executable_path='/opt/pw-browsers/chromium-<build>/chrome-linux/chrome', args=['--no-sandbox'])`. **A ready-made harness already does all of this** — `scripts/playwright-harness.py` smoke-tests every tracked project (or a named subset: `python3 scripts/playwright-harness.py index globalacl`). Run `python3 scripts/playwright-harness.py` for a quick all-pages pass, or copy it as the starting point for a page-specific interaction test. It finds the Chromium build via glob, so it keeps working when the build number changes.

2. **Determine target pages** — if the user specifies pages, test those. If the user says "all pages" or doesn't specify, test all `.html` files in `live-site-pages/` (excluding `templates/`). If the user just says "test it" after making changes, test only the pages that were modified in the current response

3. **For each target page**, write and run a Python Playwright script that:
   - Opens the page at `file:///home/user/lightaisolutions/live-site-pages/<page>.html`
   - Uses a mobile viewport (`390×844`) for pages that target mobile, or desktop (`1280×800`) otherwise
   - Listens for console errors and page errors
   - Simulates the signed-in state where applicable (hide auth wall, activate the app, show relevant UI sections)
   - Takes a screenshot to `/tmp/visual-test-<page>.png`
   - If the page has specific interactive elements to verify (modals, panels, overlays), activates them and takes additional screenshots
   - Reports: screenshot path, console errors (if any), element visibility checks

4. **Read each screenshot** and visually verify:
   - Layout renders correctly (no overlapping elements, no broken styling)
   - Text is readable (no white-on-white, no cut-off labels)
   - Interactive elements are visible and properly positioned
   - z-index layering is correct (modals above content, overlays above modals)
   - Mobile viewport: content fits without horizontal scroll

5. **Report findings** — present results to the user:
   - For each page: PASS (looks correct) or FAIL (describe the visual issue)
   - Include screenshots for the user to review
   - If console errors were detected, list them

## Limitations
- **No real authentication** — Google Sign-In must be simulated by hiding the auth wall and setting state variables
- **No real GAS backend** — API calls to Google Apps Script fail; data-dependent features show empty/placeholder state
- **No real camera/sensors** — BarcodeDetector, camera access, etc. must be simulated via JS injection
- **`file://` protocol restrictions** — some `fetch()` calls fail (version polling, sound loading); these errors are expected and should be ignored
- **Static only** — tests verify the rendered DOM state, not runtime animations or real-time data flow

## What it replaces
This does NOT replace real-device testing — it catches layout bugs, z-index issues, missing elements, and CSS errors before they reach the deployed site. The user should still test interactive flows on real devices.

## Automatic mode
Visual verification also runs automatically after UI changes per the rule in `.claude/rules/html-pages-reference.md` — see "Visual Verification After UI Changes". The user can disable automatic mode by saying "skip visual test" for a specific change, or by asking to remove the rule.

Developed by: LightAISolutions
