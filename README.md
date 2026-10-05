# ​‌‌‌‌‌‌‌​​‌‌‌‌‌​ReadMe - Personal

A GitHub Pages deployment framework with automatic version polling, auto-refresh, and Google Apps Script (GAS) embedding support.

Last updated: `2026-10-05 12:50:31 AM EST` · Repo version: `v01.80r`

**Live site:** [lightaisolutions.github.io/Personal](https://lightaisolutions.github.io/Personal/)

<p align="center">
  <img src="repository-information/readme-qr-code.png" alt="QR code to live site" width="200">
</p>

## Table of Contents

- [Project Structure](#project-structure)
- [Commands](#commands)
- [How It Works](#how-it-works)
- [GCP Project Setup & Troubleshooting](#gcp-project-setup--troubleshooting)

## Project Structure

> <sub>**Tip:** Links below navigate away from this page. `Right-click` → `Open link in new window` to keep this ReadMe visible while you work.</sub>

<pre>
<b>─── Emoji Legend ──────────────────────────────────────────────────────────────</b>
│
│   <b>Page Resources</b> (shown after → on each page entry)
│   🌐  Webpage  🟢 Active · 🟡 Maintenance · 🔴 Inactive
│   📊  Google Spreadsheet    — 🔸  No spreadsheet
│   📁  Google Drive folder   — ◽  No Drive folder
│   ⛽  Google Apps Script    — 🔻  No GAS script
│   🧜‍♀️  Architecture diagram  — ◽  No diagram

<b>Repository Root ─────────────────────────────────────────────────────────────</b>
<a href="https://github.com/LightAISolutions/Personal">Personal/</a> · <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/REPO-ARCHITECTURE.md">🧜‍♀️</a>  — <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/CHANGELOG.md">v01.00r</a>
│
<b>─── Live Site ────────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages">live-site-pages/</a>             — [template] Deployed to GitHub Pages
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/favicon.ico">favicon.ico</a>                            — Placeholder favicon (replace with your own)
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/robots.txt">robots.txt</a>                            — Crawler directives (points at the sitemap)
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/sitemap.xml">sitemap.xml</a>                            — Sitemap for search engines
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/.deploy-trigger">.deploy-trigger</a>                        — Touch-file to force a Pages redeploy when no page content changed
│   <b>│ ─ Public Website ──────────────────────────────────────────────────────────</b>
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/index.html">index.html</a>  →  <a href="https://lightaisolutions.github.io/Personal/">🌐</a>🟢  — [template · modified] Landing page (replace with your own site)
│   │
│   <b>│ ─ Internal Sites ──────────────────────────────────────────────────────────</b>
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gas-project-creator.html">gas-project-creator.html</a>  →  <a href="https://lightaisolutions.github.io/Personal/gas-project-creator.html">🌐</a>🟢 · 🔸 · ◽ · 🔻 · <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/diagrams/gas-project-creator-diagram.md">🧜‍♀️</a>  — <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/gas-project-creatorhtml.changelog.md">v01.00w</a> · vNoGASg | [template · modified] GAS project creator dashboard
│   │
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/testauthgas1.html">testauthgas1.html</a>  →  <a href="https://lightaisolutions.github.io/Personal/testauthgas1.html">🌐</a>🟢 · 🔸 · ◽ · <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Testauthgas1/testauthgas1.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/testauthgas1html.changelog.md">v01.00w</a> · <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/testauthgas1gs.changelog.md">v01.00g</a> | [template] Testauthgas1 Title page
│   │
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/testauthhtml1.html">testauthhtml1.html</a>  →  <a href="https://lightaisolutions.github.io/Personal/testauthhtml1.html">🌐</a>🟢 · 🔸 · ◽ · <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Testauthhtml1/testauthhtml1.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/testauthhtml1html.changelog.md">v01.00w</a> · <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/testauthhtml1gs.changelog.md">v01.00g</a> | [template] Testauthhtml1 Title page
│   │
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/globalacl.html">globalacl.html</a>  →  <a href="https://lightaisolutions.github.io/Personal/globalacl.html">🌐</a>🟢 · 🔸 · ◽ · <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Globalacl/globalacl.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/globalaclhtml.changelog.md">v01.00w</a> · <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/globalaclgs.changelog.md">v01.00g</a> | [template] Global ACL page
│   │
│   │
│   <b>│ ─ Standalone Utilities ─────────────────────────────────────────────────────</b>
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/helper-app.html">helper-app.html</a>  →  <a href="https://lightaisolutions.github.io/Personal/helper-app.html">🌐</a>  — <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/helper-apphtml.changelog.md">v01.19w</a> · vNoGASg | Helper app: the generic Telegram Mini App shell a helper opens from its bot's menu button — no data and no helper-specific text in the page; it talks to the helper's core `?route=app` with the Mini App's signed launch data
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/text-compare.html">text-compare.html</a>  →  <a href="https://lightaisolutions.github.io/Personal/text-compare.html">🌐</a>  — <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/text-comparehtml.changelog.md">v01.00w</a> · vNoGASg | [template] Text comparison tool with side-by-side diff highlighting
│   │
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/MasterACL.html">MasterACL.html</a>  →  <a href="https://LightAISolutions.github.io/Personal/MasterACL.html">🌐</a>🟢 · 🔸 · ◽ · <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/MasterACL/MasterACL.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/MasterACLhtml.changelog.md">v01.00w</a> · <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/MasterACLgs.changelog.md">v01.00g</a> | [template] MasterACL page
│   │
│   │
│   │
│   │
│   <b>│ ─ External Sites (Placeholder) ────────────────────────────────────────────</b>
│   │   <i>(No external-site pages yet)</i>
│   │
│   <b>│ ─ Not Yet Integrated ──────────────────────────────────────────────────────</b>
│   │   <i>(Pages that exist on disk but are not yet wired into the versioning / auto-refresh / changelog system — file link and live URL only; versions and setup will come when each is integrated)</i>
│   │
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/404.html">404.html</a>  →  <a href="https://lightaisolutions.github.io/Personal/404.html">🌐</a>
│   │
│   <b>│ ─ Supporting Files ──────────────────────────────────────────────────────</b>
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/.nojekyll">.nojekyll</a>               — [template] Disables Jekyll processing on GitHub Pages
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/templates">templates/</a>               — [template] Template source files for creating new pages and GAS scripts
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-noauth.html.txt">HtmlAndGasTemplateAutoUpdate-noauth.html.txt</a> — [template] HTML page template without auth
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt">HtmlAndGasTemplateAutoUpdate-auth.html.txt</a> — [template · modified] HTML page template with Google Authentication
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/templates/gas-minimal-noauth-template-code.js.txt">gas-minimal-noauth-template-code.js.txt</a> — [template] GAS template (version display + auto-update)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/templates/gas-minimal-auth-template-code.js.txt">gas-minimal-auth-template-code.js.txt</a> — [template] GAS template with Google auth
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/html-versions">html-versions/</a>           — [template] HTML page version files for auto-refresh polling
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-versions/gas-project-creatorhtml.version.txt">gas-project-creatorhtml.version.txt</a> — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-versions/testauthgas1html.version.txt">testauthgas1html.version.txt</a>          — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-versions/testauthhtml1html.version.txt">testauthhtml1html.version.txt</a>          — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-versions/globalaclhtml.version.txt">globalaclhtml.version.txt</a>          — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-versions/MasterACLhtml.version.txt">MasterACLhtml.version.txt</a>          — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-versions/helper-apphtml.version.txt">helper-apphtml.version.txt</a>         — Helper app shell version (shown in the app's footer)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-versions/text-comparehtml.version.txt">text-comparehtml.version.txt</a>       — [template]
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/gs-versions">gs-versions/</a>             — [template] GAS version files for GAS version pill polling
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-versions/testauthgas1gs.version.txt">testauthgas1gs.version.txt</a>            — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-versions/testauthhtml1gs.version.txt">testauthhtml1gs.version.txt</a>            — [template]
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-versions/globalaclgs.version.txt">globalaclgs.version.txt</a>            — [template]
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-versions/MasterACLgs.version.txt">MasterACLgs.version.txt</a>            — [template]
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/ahk-versions">ahk-versions/</a>            — [template] AHK version files for auto-update polling
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/ahk-versions/autoupdateahk.version.txt">autoupdateahk.version.txt</a>                      — [template · modified] Version for AutoUpdate.ahk
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/ahk-versions/test1ahkahk.version.txt">test1ahkahk.version.txt</a>                        — Version for Test1.ahk.ahk (auto-update pipeline test placeholder)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/ahk-changelogs">ahk-changelogs/</a>          — [template] AHK changelogs (user-facing change history)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/ahk-changelogs/autoupdateahk.changelog.md">autoupdateahk.changelog.md</a>                     — [template · modified] AutoUpdate.ahk changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/ahk-changelogs/test1ahkahk.changelog.md">test1ahkahk.changelog.md</a>                       — Test1.ahk.ahk changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/ahk-changelogs/test1ahkahk.changelog-archive.md">test1ahkahk.changelog-archive.md</a>       — Older sections (rotated)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/ahk-changelogs/autoupdateahk.changelog-archive.md">autoupdateahk.changelog-archive.md</a>             — [template] Older sections (rotated)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/auto-update-html-versions">auto-update-html-versions/</a>  — Version files for HTML auto-update payloads (polled by AutoUpdate.ahk)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/auto-update-html-changelogs">auto-update-html-changelogs/</a>  — Changelogs for HTML auto-update payloads (user-facing change history)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/html-changelogs">html-changelogs/</a>         — [template] HTML changelogs (source of truth + deployed)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/gas-project-creatorhtml.changelog.md">gas-project-creatorhtml.changelog.md</a>   — [template] GAS Project Creator changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/gas-project-creatorhtml.changelog-archive.md">gas-project-creatorhtml.changelog-archive.md</a>  — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/testauthgas1html.changelog.md">testauthgas1html.changelog.md</a>             — [template] Testauthgas1 page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/testauthgas1html.changelog-archive.md">testauthgas1html.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/testauthhtml1html.changelog.md">testauthhtml1html.changelog.md</a>             — [template] Testauthhtml1 page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/testauthhtml1html.changelog-archive.md">testauthhtml1html.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/globalaclhtml.changelog.md">globalaclhtml.changelog.md</a>             — [template] Globalacl page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/globalaclhtml.changelog-archive.md">globalaclhtml.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/MasterACLhtml.changelog.md">MasterACLhtml.changelog.md</a>             — [template] MasterACL page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/MasterACLhtml.changelog-archive.md">MasterACLhtml.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/helper-apphtml.changelog.md">helper-apphtml.changelog.md</a>           — Helper app shell changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/helper-apphtml.changelog-archive.md">helper-apphtml.changelog-archive.md</a>   — Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/text-comparehtml.changelog.md">text-comparehtml.changelog.md</a>         — [template] Text Compare page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-changelogs/text-comparehtml.changelog-archive.md">text-comparehtml.changelog-archive.md</a> — [template] Older sections (rotated)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/gs-changelogs">gs-changelogs/</a>           — [template] GAS changelogs (source of truth + deployed)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/testauthgas1gs.changelog.md">testauthgas1gs.changelog.md</a>               — [template] Testauthgas1 GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/testauthgas1gs.changelog-archive.md">testauthgas1gs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/testauthhtml1gs.changelog.md">testauthhtml1gs.changelog.md</a>               — [template] Testauthhtml1 GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/testauthhtml1gs.changelog-archive.md">testauthhtml1gs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/globalaclgs.changelog.md">globalaclgs.changelog.md</a>               — [template] Globalacl GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/globalaclgs.changelog-archive.md">globalaclgs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/MasterACLgs.changelog.md">MasterACLgs.changelog.md</a>               — [template] MasterACL GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-changelogs/MasterACLgs.changelog-archive.md">MasterACLgs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/images">images/</a>                  — Test images and visual assets
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/images/logo-placeholder.svg">logo-placeholder.svg</a>    — [template] Placeholder logo (replace with your own)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/images/dog-marquee4.png">dog-marquee4.png</a>        — Marquee image used by the auth pages
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/images/dog-logoff-left.png">dog-logoff-left.png</a>     — Sign-out illustration used by the auth pages
│   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/live-site-pages/sounds">sounds/</a>                 — [template] Audio feedback files
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/sounds/Website_Ready_Voice_1.mp3">Website_Ready_Voice_1.mp3</a>   — [template] "Website Ready" splash sound
│       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/sounds/Code_Ready_Voice_1.mp3">Code_Ready_Voice_1.mp3</a>      — [template] "Code Ready" splash sound
│
<b>─── Google Apps Scripts ───────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/googleAppsScripts">googleAppsScripts/</a>          — [template] Google Apps Script projects
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/googleAppsScripts/Testauthgas1">Testauthgas1/</a>             — [template] GAS for live-site-pages/testauthgas1.html
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Testauthgas1/testauthgas1.gs">testauthgas1.gs</a>              — [template] Self-updating GAS web app (auth)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Testauthgas1/testauthgas1.config.json">testauthgas1.config.json</a>     — [template] Project config (source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/googleAppsScripts/Testauthhtml1">Testauthhtml1/</a>             — [template] GAS for live-site-pages/testauthhtml1.html
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Testauthhtml1/testauthhtml1.gs">testauthhtml1.gs</a>              — [template] Self-updating GAS web app (auth)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Testauthhtml1/testauthhtml1.config.json">testauthhtml1.config.json</a>     — [template] Project config (source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/googleAppsScripts/Claspdeploytest">Claspdeploytest/</a>           — Pilot: GAS deployed via GitHub Actions (clasp push, not the pull model)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Claspdeploytest/claspdeploytest.gs">claspdeploytest.gs</a>           — Minimal pilot web app (push model — no GITHUB_TOKEN)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Claspdeploytest/appsscript.json">appsscript.json</a>          — Apps Script manifest (pushed by clasp)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/googleAppsScripts/MasterACL">MasterACL/</a>             — [template] GAS for live-site-pages/MasterACL.html
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/MasterACL/MasterACL.gs">MasterACL.gs</a>              — [template] Self-updating GAS web app
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/MasterACL/MasterACL.config.json">MasterACL.config.json</a>     — [template] Project config (source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/googleAppsScripts/Globalacl">Globalacl/</a>             — [template] GAS for live-site-pages/globalacl.html
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Globalacl/globalacl.gs">globalacl.gs</a>              — [template] Self-updating GAS web app (auth)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/googleAppsScripts/Globalacl/globalacl.config.json">globalacl.config.json</a>     — [template] Project config (source of truth)
│
<b>─── Sample Components ────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/sample-components">sample-components/</a>          — Self-contained starter kit (HTML version-polling + GAS self-update) for bootstrapping a new repo
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/sample-components/README.md">README.md</a>                   — Setup guide for new repos (placeholders, GAS deploy bootstrap, file-by-file map)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/sample-components/sample.html">sample.html</a>                 — Minimal page with active 10s version-polling + auto-reload
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/sample-components/sample.gs">sample.gs</a>                   — Minimal GAS web app: doPost(action=deploy) + pullAndDeployFromGitHub
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/sample-components/sample.config.json">sample.config.json</a>          — GAS project config (single source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/sample-components/appsscript.json">appsscript.json</a>             — GAS manifest (webapp settings + oauth scopes)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/sample-components/html-versions">html-versions/</a>              — Page-version files (polled by sample.html)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/sample-components/html-versions/samplehtml.version.txt">samplehtml.version.txt</a>  — `|v01.00w|`
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/html-versions/MasterACLhtml.version.txt">MasterACLhtml.version.txt</a>          — [template]
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/sample-components/gs-versions">gs-versions/</a>                — GAS-version files (cross-referenced from page changelogs)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/sample-components/gs-versions/samplegs.version.txt">samplegs.version.txt</a>    — `|v01.00g|`
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/live-site-pages/gs-versions/MasterACLgs.version.txt">MasterACLgs.version.txt</a>            — [template]
│   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/sample-components/workflows">workflows/</a>                  — Workflow stubs (drop into `.github/workflows/` in the new repo)
│       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/sample-components/workflows/auto-merge-and-deploy.yml">auto-merge-and-deploy.yml</a>  — Minimal CI: merge claude/* → main + fire GAS deploy webhook
│
<b>─── AutoHotkey ───────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/autoHotkey">autoHotkey/</a>                — [template] AutoHotkey v2 scripts
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/autoHotkey/AutoUpdate.ahk">AutoUpdate.ahk</a>                                  — [template · modified] Pull-based auto-updater (polls GitHub Pages, fetches via api.github.com, writes to local paths) + Manual Targets scratchpad panel with "Copy for Claude" handoff; reads the repo manifest below to discover active targets
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/autoHotkey/Test1.ahk.ahk">Test1.ahk.ahk</a>                                   — Pipeline-test placeholder (no-op, registers for hot-reload, stays resident with tray icon)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/autoHotkey/auto-update-targets.ini">auto-update-targets.ini</a>                         — Repo-tracked manifest of active auto-update targets; AutoUpdate joins each entry with a matching local intent's Local Folder to compute the per-machine target path
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/autoHotkey/AutoUpdate.config.ini.example">AutoUpdate.config.ini.example</a>                   — PAT config template; real AutoUpdate.config.ini is gitignored
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/autoHotkey/AutoUpdate.manual-targets.ini.example">AutoUpdate.manual-targets.ini.example</a>           — Manual-targets scratchpad template; real AutoUpdate.manual-targets.ini is gitignored
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/autoHotkey/ReloadHandler.ahk">ReloadHandler.ahk</a>                              — [template] Optional #Include for auto-reload via IPC
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/autoHotkey/AutoReloadThisScriptOnEdit.ahk">AutoReloadThisScriptOnEdit.ahk</a>            — [template] Hot-reload helper: reloads the edited script on save
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/autoHotkey/AutoReloadThisScriptAndSaveVersionOnEdit.ahk">AutoReloadThisScriptAndSaveVersionOnEdit.ahk</a> — [template] Hot-reload helper that also writes the version file on save
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/autoHotkey/What%20to%20add%20SaveVersionOnEdit.txt">What to add SaveVersionOnEdit.txt</a>          — Snippet to paste into a script for save-version-on-edit support
│
└── <a href="https://github.com/LightAISolutions/Personal/tree/main/auto-update-payloads">auto-update-payloads/</a>        — Non-AHK files delivered to local machines by AutoUpdate.ahk
│
<b>─── Scripts ──────────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/scripts">scripts/</a>                   — [template]
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/scripts/init-repo.sh">init-repo.sh</a>            — [template] One-shot fork initialization script
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/scripts/setup-gas-project.sh">setup-gas-project.sh</a>    — [template] GAS project file creation script
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/scripts/compute-csp-hash.sh">compute-csp-hash.sh</a>     — [template] CSP SHA-256 hash computation for inline scripts
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/scripts/check-gas-inner-scripts.js">check-gas-inner-scripts.js</a> — CI check: validates served inner &lt;script&gt; syntax in GAS files
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/scripts/playwright-harness.py">playwright-harness.py</a>   — Chromium smoke-test harness for all projects (load + console-error + screenshot)
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/scripts/transcribe.ps1">transcribe.ps1</a>          — Local Whisper launcher (large-v3-turbo on GPU) — copy to the transcribing PC; wraps venv, CUDA DLL path and output location
│
<b>─── Tests ────────────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/tests">tests/</a>                     — [template] Security &amp; integration tests
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/tests/offensive-security">offensive-security/</a>    — [template] Offensive security tests (Playwright)
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/HTML-AUTH-SECURITY-AUDIT.md">HTML-AUTH-SECURITY-AUDIT.md</a>        — [template] Independent security audit of HTML auth layer (HIPAA context)
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/README.md">README.md</a>                         — [template · initialized] Test suite documentation
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/SECURITY-FINDINGS.md">SECURITY-FINDINGS.md</a>              — [template] Comprehensive findings from all tests
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/XSS-EXPLAINER.md">XSS-EXPLAINER.md</a>                  — [template] XSS explanation, Playwright god mode, threat model context
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/test_01_xss_postmessage.py">test_01_xss_postmessage.py</a>        — [template] XSS via postMessage injection
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/test_02_session_forgery.py">test_02_session_forgery.py</a>         — [template] Session token forgery &amp; fixation
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/test_03_message_type_injection.py">test_03_message_type_injection.py</a>  — [template] Message type spoofing &amp; protocol confusion
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/test_04_csrf_token_replay.py">test_04_csrf_token_replay.py</a>       — [template] OAuth token replay &amp; CSRF attacks
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/test_05_clickjacking_iframe_embedding.py">test_05_clickjacking_iframe_embedding.py</a> — [template] Clickjacking &amp; iframe embedding
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/test_06_deploy_endpoint_abuse.py">test_06_deploy_endpoint_abuse.py</a>   — [template] Deploy endpoint probing &amp; flood
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/test_07_session_race_timing.py">test_07_session_race_timing.py</a>     — [template] Session race conditions &amp; timing
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/test_08_csp_bypass_resource_injection.py">test_08_csp_bypass_resource_injection.py</a> — [template] CSP bypass &amp; resource injection
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/test_09_auth_state_manipulation.py">test_09_auth_state_manipulation.py</a> — [template] Auth state manipulation &amp; privilege escalation
│       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/offensive-security/GAS-HIPAA-COMPLIANCE-ANALYSIS.md">GAS-HIPAA-COMPLIANCE-ANALYSIS.md</a>  — [template] GAS HIPAA compliance analysis under Workspace BAA
│   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/tests/defensive-security">defensive-security/</a>    — Defensive security validation tests (Playwright)
│       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/tests/defensive-security/test_01_csp_headers_validation.py">test_01_csp_headers_validation.py</a> — CSP &amp; security headers validation across all pages
│
<b>─── Helper Framework ─────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers">helpers/</a>                   — Reusable helper framework (Tour Guide build; plan in repository-information/TOUR-GUIDE-BUILD-PLAN.md)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/BUILD-STATE.md">BUILD-STATE.md</a>          — Phase tracker for the Tour Guide build (generic progress only)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/core">core/</a>                   — Generic Apps Script core; tools/bundle.mjs concatenates it with a pack
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/00_config.js">00_config.js</a>        — HELPER manifest merge, prefixed property names, LIMITS, envelope types, sheets
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/01_util.js">01_util.js</a>          — Shared helpers: time, strings, JSON, ids, truncation
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/02_registry.js">02_registry.js</a>      — Extension registries — the only way a pack extends the core
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/03_store.js">03_store.js</a>         — Sheet store: header-mapped rows, settings, daily counters
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/04_audit.js">04_audit.js</a>         — AuditLog writer (audit / auditFail, once-per-key notices)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/05_telegram.js">05_telegram.js</a>      — Telegram client: send, split, escape, inline buttons, callback data
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/06_queue.js">06_queue.js</a>         — Queue + one-off worker trigger: retries, dead letters, pruning
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/07_executor.js">07_executor.js</a>      — Proposals → PendingActions → owner ✅ → allowlisted action
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/08_actions_builtin.js">08_actions_builtin.js</a> — Built-in action drive_create_file (validate / preview / execute)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/09_mailbox.js">09_mailbox.js</a>       — Drive mailbox relay: envelope validation, dispatch, archive, snapshot
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/10_router.js">10_router.js</a>        — Web-app router: ?route=tg / wake / setup, health JSON
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/11_commands_builtin.js">11_commands_builtin.js</a> — Built-in Telegram commands (/start /help /ping /id /status /pending /expire /ask /wake)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/12_wake.js">12_wake.js</a>          — Wake route, sweeps, requests (req_&lt;id&gt;.json) and one-off triggers
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/13_routines.js">13_routines.js</a>      — Claude Code Routine fire client with the daily cap
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/14_setup.js">14_setup.js</a>         — Owner setup page (?route=setup&amp;k=ADMIN_SECRET) and printSetupUrl()
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/15_flows.js">15_flows.js</a> — Multi-step conversations: registerFlow, Flows tab, fl callbacks, /cancel, pause/resume, expiry (WP-1b)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/16_upload.js">16_upload.js</a> — ?route=upload: a routine stores a PDF/HTML it made under the helper root (per-request HMAC key)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/17_alarms.js">17_alarms.js</a> — registerAlarm: pack code that runs at a time; one pending alarmTrigger serves every alarm (booking reminders)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/18_command_forms.js">18_command_forms.js</a> — Command form templates: one grammar ({field}, [optional]) and the field kinds the app draws a picker for; parse, fill and match
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/decisions">decisions/</a>              — One decisions file per phase / work package
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-0.md">TG-PHASE-0.md</a>       — Phase 0: the thirteen owner decisions, owner actions, session findings
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-1.md">TG-PHASE-1.md</a>       — Phase 1: scrub report (owner gate), subtree decision, every default chosen
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-2.md">TG-PHASE-2.md</a>       — Phase 2: coordinator defaults, findings, brochure rating
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-3.md">TG-PHASE-3.md</a>   — Phase 3: coordinator defaults, ownership-map extension, solver design and limits, requests carried
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-4.md">TG-PHASE-4.md</a>   — Phase 4: coordinator defaults, request-kind contract, payloads, Drive and memory layout, drivers, routine table, "For Phase 4b"
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-4B.md">TG-PHASE-4B.md</a> — Phase 4b: coordinator defaults, flows and documents as built, the six payload schemas, request kinds (final table), Gem Funnel and transit fallback as built, what changed vs the Phase 4 delta, requests carried
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-5.md">TG-PHASE-5.md</a> — Phase 5: cross-WP contract, the Lane B toggle, defaults, trigger minutes, carried items
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-6.md">TG-PHASE-6.md</a> — Phase 6 decisions: WP-6a/6b/6c briefs, red-team findings and fixes, cost and quota audit with sources, carried items, accepted risk
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-7.md">TG-PHASE-7.md</a> — Phase 7 decisions: live switch-on findings and the owner's choices
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-8.md">TG-PHASE-8.md</a> — Phase 8 part 1 decisions: owner questions, carried findings fixed before the trip, the Phase 9 follow-ups
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-9.md">TG-PHASE-9.md</a> — Phase 9 decisions: the finalized values, the Step 0 cross-origin verification, WP pointers, the live check
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-10.md">TG-PHASE-10.md</a> — Phase 10 decisions: the coordinator's merge choices, the private-repo side, the live check, what moves to Phase 11
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-11.md">TG-PHASE-11.md</a> — Phase 11 decisions: the coordinator's merge choices for both waves, the private-repo side, the live checks, what moves to Phase 12
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-12.md">TG-PHASE-12.md</a> — Phase 12 decisions: the coordinator's merge choices and fixes, the private-repo side, the live checks, the old output that moves, what is carried on
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-13.md">TG-PHASE-13.md</a> — Phase 13 decisions: the morning review's fix package — merge order and the coordinator's changes, probe P, checks, the private-repo side, the old output that moves, what is carried on
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-14.md">TG-PHASE-14.md</a> — Phase 14 decisions: wave 1 (the scaffold, Scout's ranking, the veg card and PDF) — merge order and the coordinator's changes, the probe, checks, the wave 2 brief corrections, the owner's order after Phase 14
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-15.md">TG-PHASE-15.md</a> — Phase 15 decisions: Day trip and What's on — the skeleton, merge choices and the coordinator's changes (one choice per trip and place), the probes, checks, the private-repo side, what is carried on
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-16.md">TG-PHASE-16.md</a> — Phase 16 decisions: Quiet and Menu check — the skeleton, merge order and the requests acted on, the probes and the coordinator's fix (an old menu check), checks, the private-repo side, what is carried on
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-17.md">TG-PHASE-17.md</a> — Phase 17 decisions: commands as app buttons and forms — Run from the app, forms from the registry, the "/" menu, the defaults chosen, the next steps
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-18.md">TG-PHASE-18.md</a> — Phase 18 decisions: brochures as instructions for the day — the thirteen approved changes, Contract C18, where wave 1's values come from, the choices made
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-COMMANDS.md">TG-COMMANDS.md</a> — The app's Commands tab: the registry is the list (listCommands), the pack's descriptions, the commands.list op, the screen, how it stays current
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-SCOUT.md">TG-SCOUT.md</a> — Scout contract: the /scout request, the scout payload, ranking, the board, places, and the decisions log
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-1b.md">WP-1b.md</a> — WP-1b core flows + document delivery: defaults (step shape, claim order, expiry, size fallback)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2a.md">WP-2a.md</a>            — WP-2a Maps kit: defaults, Maps terms finding, credential header, live smoke results
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2b.md">WP-2b.md</a>            — WP-2b Research kit: defaults (budgets, independence, labels, scanner)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2c.md">WP-2c.md</a>            — WP-2c Brochure kit: defaults, design rationale, Playwright for routines
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2d.md">WP-2d.md</a>            — WP-2d Prefs kit: defaults (formats, review payload, invariants)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2e.md">WP-2e.md</a> — WP-2e real Google maps and place photos in the brochure: defaults, terms, costs
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2f.md">WP-2f.md</a> — WP-2f prefs interview: defaults (vocabulary dimensions, bank shape, answer shapes, supersede rule, profile summary)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2g-engine.md">WP-2g-engine.md</a> — WP-2g engine (Gem Funnel): score weights, 💎 rule, floors, evidence flags, what is build-scoped
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2g-kits.md">WP-2g-kits.md</a> — WP-2g kits (Gem Funnel): Nearby Search tiers, minRating steps, Places Aggregate, research mentions and source kinds
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-3a.md">WP-3a.md</a>        — WP-3a schemas / estimator / Later / fixtures: defaults and fixture design
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-3b.md">WP-3b.md</a>        — WP-3b planner + solver: defaults, solver limits, the booked-stop wait rule
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-3c.md">WP-3c.md</a>        — WP-3c brochure map: defaults, what the brochure shows and hides
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-3d.md">WP-3d.md</a> — WP-3d engine choices, statuses and payload schemas: defaults (choice lists, status enum, digest caps)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-3e.md">WP-3e.md</a> — WP-3e transit fallback: defaults (20 km/h + 12 min, route factor 1.3, one warning per day)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-4a.md">WP-4a.md</a>        — WP-4a trip-research + plan-days: defaults, the Phase 4 delta (statuses, choices, chaining, shortlist, intake)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-4b.md">WP-4b.md</a>        — WP-4b prefs-build + place-notes + brochure-build: defaults, interview answers
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-4c.md">WP-4c.md</a>        — WP-4c chat + trip-check + routine table: defaults (request check, hand-offs, Enterprise tier, change codes)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-4d.md">WP-4d.md</a>        — WP-4d Phase 4b skill deltas: defaults (one places digest, known-place re-check, choices and evidence, review paths, routine table)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-5a.md">WP-5a.md</a> — WP-5a commands and flows: deviations and defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-5b.md">WP-5b.md</a> — WP-5b envelope handlers and sheets: defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-5c.md">WP-5c.md</a> — WP-5c Lane B, /route, trigger-minute measurement
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-6a.md">WP-6a.md</a> — WP-6a pack gas red-team + PDF delivery: assumptions and defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-6b.md">WP-6b.md</a> — WP-6b kits and engines red-team: assumptions and defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-6c.md">WP-6c.md</a> — WP-6c integration dry run and skills red-team: assumptions and defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-9a.md">WP-9a.md</a> — WP-9a core route contract: status in the JSON body, initData verification order, daily cap, menu button
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-9b.md">WP-9b.md</a> — WP-9b app route and operations: defaults and refusals
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-9c.md">WP-9c.md</a> — WP-9c shell page: design, behaviour decisions, the core-only-from-URL rule, screenshot table
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-10a.md">WP-10a.md</a> — WP-10a trip time zones, Contract C10, bookings and the alarm: defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-10b.md">WP-10b.md</a> — WP-10b honest travel legs and the planner tidy-up: defaults and the Google facts checked
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-11a.md">WP-11a.md</a> — WP-11a planner: a day's own start, end and bag step, dinners, evening extras, sunset, researched visit lengths, crowd slots: defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-11b.md">WP-11b.md</a> — WP-11b place facts, the season sheet, local favourites and crowd magnets: defaults and bloom-month sources
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-11c.md">WP-11c.md</a> — WP-11c core: Contract C11 through the digest and the day card, plans in parts, per-day /dates: defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-11d.md">WP-11d.md</a> — WP-11d brochure pass for the C11 fields: design choices and the pinned old-HTML hashes
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-11e.md">WP-11e.md</a> — WP-11e journey: outlines, day versions and the chosen mix: defaults (the coordinator's wave-2 changes marked)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-11f.md">WP-11f.md</a> — WP-11f core and Mini App: outlines and day versions compared in the chat and the app: defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-12a.md">WP-12a.md</a> — WP-12a planner and contracts: when to leave, the day's town, re-plans from where you are (C12): defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-12b.md">WP-12b.md</a> — WP-12b core: the morning message, the weather, running late, re-plan from here, the evening check-in: defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-12d.md">WP-12d.md</a> — WP-12d brochure: the re-planned day, the phone clock, dates in words, undated bookings: defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-12r.md">WP-12r.md</a> — WP-12r the rehearsal: one invented trip day played through the bot, the faults it found, the lodging-change offer
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-13a.md">WP-13a.md</a> — WP-13a planner, the day's shape: a departure day that cannot fit, bookings at a day's edge or outside the trip, an inverted override, the day's end, evening timing, old own facts: defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-13b.md">WP-13b.md</a> — WP-13b planner: hours on one weekday, opening days that vary, conventional-line rail, bloom months, menus never checked, local fact dates: defaults
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-13c.md">WP-13c.md</a> — WP-13c core: dated stays and Contract C13 (the lodging fingerprint, the stale-plan line), /dates refusals, links cut safely, one booking reminder, Scout's own words, the scouted group: defaults (superseded notes from the coordinator)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-13d.md">WP-13d.md</a> — WP-13d Scout engine: been before, the board's hours over every day in the city, one grammar, the vegetarian flag under a diet rule, own names: decisions
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-14a.md">WP-14a.md</a> — WP-14a branch scaffold: the shape, file numbers, routing from the module, refusals, --force, the @branch line and --check: decisions
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-14b.md">WP-14b.md</a> — WP-14b Scout's ranking: a fixed quality anchor, chain and crowd penalties, rescue by judgment, likely drinks and cafés, not judged, one reach estimator: decisions
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-14c.md">WP-14c.md</a> — WP-14c veg card and brochure PDF: phrases, the party rule, the fingerprint, send-or-silent, the morning line, the PDF op: decisions
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-14d.md">WP-14d.md</a> — WP-14d the owner's saved Google Maps lists: the Takeout reader, link forms, the merge and the resolution rule, destinations, notes, the commands
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-14e.md">WP-14e.md</a> — WP-14e compare and one Discover routine: the command, compare mode, flags, the cap, the board and card, the discovery kinds
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-14f.md">WP-14f.md</a> — WP-14f the Takeout fetch: the route, its key and refusals, where exports are looked for, the daily check, the client, exports in parts, compare's cut
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-15a.md">WP-15a.md</a> — WP-15a Day trip (item 19) and the rail estimate: the command and its words, the ranking and its screens, the board and card, keep and put on a day, the 15–40 km rail band
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-15b.md">WP-15b.md</a> — WP-15b What's on (item 20): the command and window, the board and card, choosing a day, the weekly check, the season sheet's new kinds, the evening (change E)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-16a.md">WP-16a.md</a> — WP-16a Quiet (item 13): the words, the ranking and its screens, the card and buttons, the 🕊 rows under a day, the app
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-16b.md">WP-16b.md</a> — WP-16b Menu check (item 14): the words, the engine, the validators, the card's re-plan offer, the 🍽 row, menu_checks, the app
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-S-engine.md">WP-S-engine.md</a> — WP-S engine decisions: weights, screens, the gem rule, payload and board choices
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-S-gas.md">WP-S-gas.md</a> — WP-S core decisions: /scout, the Scouts tab, the ➕ callback, the app operations
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/hidden-gems-proposal.md">hidden-gems-proposal.md</a> — Hidden gems: the sweep idea evaluated against other methods, the Gem Funnel recommendation, costs, plan changes implied, decisions 22–26 (answered by the owner)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/decisions/screenshots">screenshots/</a> — Screenshots a work package attached to its decisions file
│   │       └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/decisions/screenshots/wp-9c">wp-9c/</a> — The helper app shell at 390×844: six screens in light and dark, the error and closed-round states (from the shell test, invented fixtures)
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/dark-1-home.png">dark-1-home.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/dark-2-shortlist.png">dark-2-shortlist.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/dark-3-facts.png">dark-3-facts.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/dark-4-interview.png">dark-4-interview.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/dark-5-brochure.png">dark-5-brochure.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/dark-6-places.png">dark-6-places.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/light-1-home.png">light-1-home.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/light-2-shortlist.png">light-2-shortlist.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/light-3-facts.png">light-3-facts.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/light-4-interview.png">light-4-interview.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/light-5-brochure.png">light-5-brochure.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/light-6-places.png">light-6-places.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/state-403.png">state-403.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/state-429.png">state-429.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/state-brochure-link.png">state-brochure-link.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/state-no-telegram.png">state-no-telegram.png</a>
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/state-round-closed.png">state-round-closed.png</a>
│   │           └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/screenshots/wp-9c/state-shortlist-done.png">state-shortlist-done.png</a>
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/docs">docs/</a> — Owner-facing guides written by a phase for the owner to follow
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/docs/TG-SWITCH-ON.md">TG-SWITCH-ON.md</a> — Tour Guide switch-on guide (Phase 6 → Phase 7): Cloud project and keys, Apps Script deploy, Script Properties, the seven routines, pairing, the first trip, costs and caps, what to do when something fails
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits">kits/</a>                   — Shared Node kits (no runtime dependencies except Playwright for the brochure PDF step)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/brochure">brochure/</a>           — Brochure renderer: brochure model → one self-contained HTML document → paginated PDF via Playwright
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/brochure/assets">assets/</a>         — Embedded assets (no network at render or view time)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/brochure/assets/fonts">fonts/</a>      — Bitstream Charter, four faces, converted once to WOFF2
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/assets/fonts/Charter-Bold.woff2">Charter-Bold.woff2</a> — Charter Bold
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/assets/fonts/Charter-BoldItalic.woff2">Charter-BoldItalic.woff2</a> — Charter Bold Italic
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/assets/fonts/Charter-Italic.woff2">Charter-Italic.woff2</a> — Charter Italic
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/assets/fonts/Charter-Regular.woff2">Charter-Regular.woff2</a> — Charter Regular
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/assets/fonts/convert-charter.py">convert-charter.py</a> — One-time Type 1 → WOFF2 conversion script (fontTools)
│   │   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/assets/fonts/NOTICE-charter.txt">NOTICE-charter.txt</a> — Bitstream Charter licence notice (kept with the fonts)
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/assets/google-maps-logo.svg">google-maps-logo.svg</a> — Google Maps attribution logo
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/brochure/fixtures">fixtures/</a>       — Invented sample trip
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/fixtures/sample-trip.json">sample-trip.json</a> — Invented 3-day trip on reserved domains (the sample brochure)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/fixtures/sample-trip-c18.json">sample-trip-c18.json</a> — The invented sample with every Contract C18 field
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/fixtures/sample-trip-c18b.json">sample-trip-c18b.json</a> — The invented sample with every Contract C18 wave 2 (briefing) field
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/index.mjs">index.mjs</a>       — Library exports + CLI (validate, render, build, sample)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/brochure/lib">lib/</a>            — Implementation, one concern per file
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/art.mjs">art.mjs</a>     — Decorative contour art and ornaments generated from data
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/css.mjs">css.mjs</a>     — The stylesheet, assembled from per-section parts
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/escape.mjs">escape.mjs</a>  — Escaping and URL safety: model text is always data
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/fonts.mjs">fonts.mjs</a>   — Embeds the Charter faces as data URIs
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/format.mjs">format.mjs</a>  — Dates, times and durations on the trip's wall clock
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/directions.mjs">directions.mjs</a> — Google Maps directions link per leg (Maps URLs, no key); taxi legs link the train options
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/google-images.mjs">google-images.mjs</a> — Build step: Google static maps, place photos and route lines inlined into a copy of the model
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/icons.mjs">icons.mjs</a>   — Inline SVG glyphs
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/images.mjs">images.mjs</a>  — Inlines local images; remote URLs dropped with a warning
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/mapframe.mjs">mapframe.mjs</a> — Web Mercator fit and projection; brochure markers drawn over a Google map
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/model.mjs">model.mjs</a>   — Model preparation: schema, semantic checks, merged day timelines
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/paginate.mjs">paginate.mjs</a> — In-browser paginator that re-homes blocks into fixed-size sheets
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/pdf.mjs">pdf.mjs</a>     — PDF step: Chromium via the global Playwright, one PDF page per sheet
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/render.mjs">render.mjs</a>  — The renderer: sections + fonts + logo + images → one HTML file
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/brochure/lib/sections">sections/</a>   — One module per brochure section
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/attribution.mjs">attribution.mjs</a> — Google Maps attribution, other sources, colophon
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/cards.mjs">cards.mjs</a> — Place cards with notes, one credited review and sources
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/common.mjs">common.mjs</a> — Shared section bits and the paginator markup contract
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/cover.mjs">cover.mjs</a> — The cover
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/day.mjs">day.mjs</a> — Day spread: timeline rail, route sketch, lodging, warnings
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/glance.mjs">glance.mjs</a> — The trip at a glance
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/later.mjs">later.mjs</a> — Saved for later lists with reasons
│   │   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/practical.mjs">practical.mjs</a> — Practical information blocks
│   │   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/season.mjs">season.mjs</a> — The season page (C11): weather, blooms, the events on trip dates and their sources
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sketch.mjs">sketch.mjs</a>  — Route sketch drawn as SVG from coordinates (fallback without a Google map) and the shared markers
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/tokens.mjs">tokens.mjs</a>  — Design tokens: type scale, ink, accent, day hues
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/validate.mjs">validate.mjs</a> — Minimal JSON Schema validator
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/README.md">README.md</a>       — Contract: model schema, commands, pagination, attribution rules, what routines need (Playwright)
│   │   │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/brochure/schema">schema/</a>         — JSON Schemas
│   │   │       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/schema/brochure.schema.json">brochure.schema.json</a> — The brochure input model
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/maps">maps/</a>               — Places API (New) + Routes API client: fixed masks, SKU ledger with a hard stop, snapshot purge, Maps URLs
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/maps/fixtures">fixtures/</a>       — Hand-written responses in the real API shapes (invented city)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-aggregate-count.json">maps-fixture-aggregate-count.json</a> — Places Aggregate, INSIGHT_COUNT
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-aggregate-places.json">maps-fixture-aggregate-places.json</a> — Places Aggregate, INSIGHT_PLACES
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-compute-routes-optimized.json">maps-fixture-compute-routes-optimized.json</a> — Compute Routes with optimizeWaypointOrder
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-compute-routes-transit.json">maps-fixture-compute-routes-transit.json</a> — Compute Routes, TRANSIT
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-compute-routes-walk.json">maps-fixture-compute-routes-walk.json</a> — Compute Routes, WALK
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-error-403.json">maps-fixture-error-403.json</a> — An upstream 403 error body
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-nearby-search-enterprise.json">maps-fixture-nearby-search-enterprise.json</a> — Nearby Search, Enterprise mask
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-place-details-atmosphere.json">maps-fixture-place-details-atmosphere.json</a> — Place Details, Enterprise + Atmosphere mask
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-place-details-enterprise.json">maps-fixture-place-details-enterprise.json</a> — Place Details, Enterprise mask
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-route-matrix.json">maps-fixture-route-matrix.json</a> — Compute Route Matrix elements
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-text-search-enterprise.json">maps-fixture-text-search-enterprise.json</a> — Text Search, Enterprise mask
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-text-search-pro.json">maps-fixture-text-search-pro.json</a> — Text Search, Pro mask
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/index.mjs">index.mjs</a>       — Library exports + CLI (masks, usage, purge, url, details, search, nearby, aggregate, route, matrix, smoke --live)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/maps/lib">lib/</a>            — Implementation, one concern per file
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-aggregate.mjs">maps-aggregate.mjs</a> — Places Aggregate (computeInsights): circle areas, type filters, count and place-id insights
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-cli.mjs">maps-cli.mjs</a> — Command-line front end; network commands need --live and a ledger
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-client.mjs">maps-client.mjs</a> — createMapsClient(): every method goes through the SKU ledger
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-errors.mjs">maps-errors.mjs</a> — Typed errors with stable codes (SKU_CEILING, BAD_INPUT, AUTH, QUOTA, …)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-http.mjs">maps-http.mjs</a> — One guarded call: reserve units (hard stop before sending), send, normalize
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-ledger.mjs">maps-ledger.mjs</a> — Monthly SKU usage ledger in a caller-named JSON file
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-masks.mjs">maps-masks.mjs</a> — The only field masks the kit sends, one per tier
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-mock-transport.mjs">maps-mock-transport.mjs</a> — In-memory transport over the fixtures (tests, offline smoke)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-photos.mjs">maps-photos.mjs</a> — Place Photos (New): media lookup, image download, author attribution
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-places.mjs">maps-places.mjs</a> — Place Details and Text Search
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-png-stub.mjs">maps-png-stub.mjs</a> — Offline stand-in PNGs for static maps and photos (tests, --mock)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-polyline.mjs">maps-polyline.mjs</a> — Encoded polylines: encode, decode, simplify
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-routes.mjs">maps-routes.mjs</a> — Compute Routes and Compute Route Matrix (caps, chunking, SKU choice)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-skus.mjs">maps-skus.mjs</a> — SKU table: free monthly caps, list prices, default ceilings
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-snapshots.mjs">maps-snapshots.mjs</a> — GoogleSnapshot records and the terms-driven purge
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-static.mjs">maps-static.mjs</a> — Maps Static API: keyless URL builder, length reducer, signing, keyed fetch
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-transport.mjs">maps-transport.mjs</a> — Zero-dependency HTTPS transport through the HTTPS_PROXY tunnel
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/lib/maps-urls.mjs">maps-urls.mjs</a> — Google Maps URLs: directions, place and whole-day links
│   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/README.md">README.md</a>       — Contract: library, masks and SKUs, the hard stop, snapshot purge per the Maps terms, CLI
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/prefs">prefs/</a>              — Connector-reader pattern: evidence → held notes (quarantine) → owner review → confirmed profile
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/prefs/fixtures">fixtures/</a>       — Invented evidence and decisions
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/fixtures/decisions-sample.json">decisions-sample.json</a> — Sample owner decisions
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/fixtures/evidence-sample.json">evidence-sample.json</a> — Sample evidence, with one planted injection
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/fixtures/interview-answers-sample.json">interview-answers-sample.json</a> — Invented interview answers, with one planted injection
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/index.mjs">index.mjs</a>       — Library exports + CLI (check, ingest, review, apply, interview)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/prefs/lib">lib/</a>            — Implementation, one concern per file
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/candidates.mjs">candidates.mjs</a> — Groups evidence into candidate preferences with support and conflicts
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/confirmed-prefs.mjs">confirmed-prefs.mjs</a> — The owner's decision ledger and the confirmed-preferences document (size-capped)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/decisions.mjs">decisions.mjs</a> — Owner decisions: the only input that can change the profile
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/evidence.mjs">evidence.mjs</a> — Evidence records: validation, hashed source refs, sanitized excerpts, injection flag
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/held-notes.mjs">held-notes.mjs</a> — One Markdown held note per candidate in a caller-named directory
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/interview-bank.mjs">interview-bank.mjs</a> — Question bank: load and validate against the schema and the vocabulary
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/interview.mjs">interview.mjs</a> — Interview answers: three input shapes, supersede, bank warnings, profile summary
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/review.mjs">review.mjs</a>  — The ✅ / ✏️ / ❌ review payload, sized for Telegram
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/util.mjs">util.mjs</a>    — Hashing, normalization, slugs, text sanitizing, token estimate
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/vocab.mjs">vocab.mjs</a>   — Caller-supplied preference vocabulary
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/prefs/presets">presets/</a>        — Named vocabularies
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/presets/travel.interview.json">travel.interview.json</a> — Travel interview question bank (39 questions, 13 sections)
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/presets/travel.vocab.json">travel.vocab.json</a> — Travel vocabulary (22 dimensions: pace, food, climate, … hidden-gem appetite)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/prefs/schemas">schemas/</a> — JSON Schema for interview question banks
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/schemas/travel.interview.schema.json">travel.interview.schema.json</a> — Question-bank schema (2020-12 subset)
│   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/README.md">README.md</a>       — Contract: flow, commands, file formats, invariants, what the core and routines must do
│   │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/research">research/</a>           — Research-run contract: budgets, source ledger, two-source rule, confidence labels, injection handling
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/research/fixtures">fixtures/</a>       — Invented pages on reserved domains
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/fixtures/research-fake-web.mjs">research-fake-web.mjs</a> — Fake search and fetch over the fixture pages
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/fixtures/research-fixture-web.json">research-fixture-web.json</a> — Fixture pages, including hostile ones
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/index.mjs">index.mjs</a>       — Library exports + CLI (run start, record-search, record-fetch, claim, check, finish, …)
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/research/lib">lib/</a>            — Implementation, one concern per file
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/budget.mjs">budget.mjs</a>  — Per-run budgets: searches, fetches, wall time
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/claims.mjs">claims.mjs</a>  — Claims, the two-source rule and confidence labels
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/cli.mjs">cli.mjs</a>     — Command-line front end (one JSON object on stdout)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/domain.mjs">domain.mjs</a>  — Registrable domain and the source-independence key
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/duration.mjs">duration.mjs</a> — Visit-duration mentions → range, typical value, label
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/injection.mjs">injection.mjs</a> — Prompt-injection scanner for untrusted text
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/ledger.mjs">ledger.mjs</a>  — Source-ledger entries
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/run.mjs">run.mjs</a>     — Run state shared by the CLI and the library
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/sanitize.mjs">sanitize.mjs</a> — Sanitizer for stored excerpts (caps, control and zero-width characters)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/schema.mjs">schema.mjs</a>  — Minimal JSON Schema validator
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/lib/session.mjs">session.mjs</a> — Library form with injected search and fetch
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/README.md">README.md</a>       — Contract written as the steps a routine follows
│   │       └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/research/schemas">schemas/</a>        — JSON Schemas
│   │           └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/research/schemas/research-run.schema.json">research-run.schema.json</a> — Run file and ledger entry schema
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs">packs/</a>                  — One directory per helper: manifest + pack-side Apps Script
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/hello">hello/</a>              — The smallest pack — proves the registries and the test harness
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/hello/gas">gas/</a>            — Pack-side Apps Script, appended to the core by the bundler
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/hello/gas/hello.js">hello.js</a>    — greeting envelope, /hello, message handler, snapshot, daily job, setup step
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/hello/helper.json">helper.json</a>     — Pack manifest (fields in helpers/SPEC.md §4)
│   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/hello/README.md">README.md</a>       — What the hello pack registers and how to bundle and test it
│   │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide">tour-guide/</a>     — Tour Guide engine: schemas, estimator, planner + solver, Later lists, fixtures, brochure map (no Apps Script yet)
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/brochure-map">brochure-map/</a>   — Plan → brochure model (WP-3c): the kit renders, this maps
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-attribution.mjs">brochure-map-attribution.mjs</a> — Google Maps attribution and other-sources block
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-bookings.mjs">brochure-map-bookings.mjs</a> — The "Bookings" practical section: both times, still to book first, booked after
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-briefing.mjs">brochure-map-briefing.mjs</a> — Contract C18 wave 2: merges the routine-written briefing into the days, with its drop and clip rules
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-c18.mjs">brochure-map-c18.mjs</a> — Contract C18 values: fixed times, tips, checklist, morning countdown, departure, free windows
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-cards.mjs">brochure-map-cards.mjs</a> — Place cards: notes, hours today, one credited review
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-days.mjs">brochure-map-days.mjs</a> — Day spreads: stops, legs, meals, free time, warnings
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-facts.mjs">brochure-map-facts.mjs</a> — The one adapter from place facts and the season sheet to the brochure's lines (C11)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-later.mjs">brochure-map-later.mjs</a> — Saved-for-later lists with reasons
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-practical.mjs">brochure-map-practical.mjs</a> — Practical blocks: lodging, transit, bookings
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-sample.mjs">brochure-map-sample.mjs</a> — Renders a fixture end to end (preview helper)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-sample-c11.mjs">brochure-map-sample-c11.mjs</a> — The invented sample with every C11 field filled (tests and screenshots)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-sample-c18.mjs">brochure-map-sample-c18.mjs</a> — The invented C18 sample input
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-text.mjs">brochure-map-text.mjs</a> — Text helpers: clipping, joining, wall-clock labels
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/index.mjs">index.mjs</a>       — buildModel, toBrochureModel, renderPlan, renderPlanPdf
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/compare">compare/</a> — Compare: two to four places or one list side by side with Scout's scores and warnings (WP-14e)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/compare/fixtures">fixtures/</a> — Invented data for the branch's test
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/compare/fixtures/compare-sample.json">compare-sample.json</a> — An invented trip
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/compare/index.mjs">index.mjs</a> — The branch's names
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/compare/README.md">README.md</a> — Where compare lives: the command, compare mode, the payload, the card, the board
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/daytrip">daytrip/</a> — Day trip: a ranked board of up to 8 day trips from any base within a one-way ride limit, kept trips and their outline day (WP-15a)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/daytrip/daytrip-outline.mjs">daytrip-outline.mjs</a> — dayTripOutlineEntry: a kept trip as the planner's full-day outline entry (a 3 km circle, its anchors)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/daytrip/daytrip-payload.mjs">daytrip-payload.mjs</a> — validateDaytripPayload and checkDaytrip: the daytrip payload, rule for rule with the core
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/daytrip/daytrip-rank.mjs">daytrip-rank.mjs</a> — rankDayTrips and reachPart: the screens in order, the score, the 8 shown, more and what was left out
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/daytrip/daytrip-text.mjs">daytrip-text.mjs</a> — parseDaytripText: the owner's words — the base, the ride limit and the day
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/daytrip/fixtures">fixtures/</a> — Invented data for the branch's tests
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/daytrip/fixtures/daytrip-parse-cases.json">daytrip-parse-cases.json</a> — The words cases the engine and the core share
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/daytrip/fixtures/daytrip-sample.json">daytrip-sample.json</a> — Invented boards: valid, invalid and semantic
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/daytrip/index.mjs">index.mjs</a> — Day trip exports
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/daytrip/README.md">README.md</a> — Where Day trip lives: the command, the board, keeping and putting a trip on a day, the private skill
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/estimator">estimator/</a>      — Visit-duration estimator (WP-3a): sources → minutes → calibration
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/estimator-build.mjs">estimator-build.mjs</a> — buildEstimate from notes, snapshot and category defaults
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/estimator-calibration.mjs">estimator-calibration.mjs</a> — createCalibration, applyTap, calibrationFactor
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/estimator-defaults.mjs">estimator-defaults.mjs</a> — Per-category default ranges
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/estimator-minutes.mjs">estimator-minutes.mjs</a> — chooseMinutes with pace and calibration
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/index.mjs">index.mjs</a>       — Estimator exports
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/facts">facts/</a> — Place facts (C11 place.facts, WP-11b): normalize, the display lines, staleness, conflicts with Google hours — pure functions
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/facts/facts-check.mjs">facts-check.mjs</a> — factsStale (90 days, a menu 30) and factsConflict with Google's hours
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/facts/facts-lines.mjs">facts-lines.mjs</a> — factsLines and menuLine: the facts, booking, price and menu lines (≤ 160 characters)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/facts/facts-normalize.mjs">facts-normalize.mjs</a> — normalizeFacts: mechanical clean-up, then the schema subset and the checks
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/facts/fixtures">fixtures/</a> — An invented place's full facts
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/facts/fixtures/facts-fixture-full.json">facts-fixture-full.json</a> — Every facts field filled
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/facts/index.mjs">index.mjs</a> — Place facts exports
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/facts/README.md">README.md</a> — Contract: the facts fields, the lines, staleness and conflicts
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures">fixtures/</a>       — Invented trips with replayed Maps answers (no network)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures/driving-loop">driving-loop/</a>   — Four-day DRIVE loop, reserved domains
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/driving-loop/tg-fixture-driving-loop-calibration.json">tg-fixture-driving-loop-calibration.json</a> — Calibration state (per-category taps)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/driving-loop/tg-fixture-driving-loop-estimates.json">tg-fixture-driving-loop-estimates.json</a> — Visit estimates per place
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/driving-loop/tg-fixture-driving-loop-notes.json">tg-fixture-driving-loop-notes.json</a> — Place notes from invented sources
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/driving-loop/tg-fixture-driving-loop-places.json">tg-fixture-driving-loop-places.json</a> — Places with invented Google place ids
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/driving-loop/tg-fixture-driving-loop-profile.json">tg-fixture-driving-loop-profile.json</a> — Profile excerpt (pace, meals, interests)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/driving-loop/tg-fixture-driving-loop-routes.json">tg-fixture-driving-loop-routes.json</a> — Route Matrix + Compute Routes answers the responder replays
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/driving-loop/tg-fixture-driving-loop-snapshots.json">tg-fixture-driving-loop-snapshots.json</a> — Google snapshots in the Maps kit shape (hours, rating)
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/driving-loop/tg-fixture-driving-loop-trip.json">tg-fixture-driving-loop-trip.json</a> — The trip: dates, lodging, mode, bookings
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/fixture-geo.mjs">fixture-geo.mjs</a> — Geometry for invented coordinates and distances
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/fixture-load.mjs">fixture-load.mjs</a> — listFixtures, loadFixture
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/fixture-responder.mjs">fixture-responder.mjs</a> — createFixtureResponder: a Maps mock transport fed by the routes file
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/fixture-travel.mjs">fixture-travel.mjs</a> — fixtureTravel: the answer the planner should get for a pair
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures/hill-town">hill-town/</a> — Two-day hill town with no transit: every leg walked, footpaths, a hill shrine and lookout, reserved domains
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/hill-town/tg-fixture-hill-town-calibration.json">tg-fixture-hill-town-calibration.json</a> — Calibration state (per-category taps)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/hill-town/tg-fixture-hill-town-estimates.json">tg-fixture-hill-town-estimates.json</a> — Visit estimates per place
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/hill-town/tg-fixture-hill-town-notes.json">tg-fixture-hill-town-notes.json</a> — Place notes from invented sources
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/hill-town/tg-fixture-hill-town-places.json">tg-fixture-hill-town-places.json</a> — Places with invented Google place ids
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/hill-town/tg-fixture-hill-town-profile.json">tg-fixture-hill-town-profile.json</a> — Profile excerpt (pace, meals, interests)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/hill-town/tg-fixture-hill-town-routes.json">tg-fixture-hill-town-routes.json</a> — Recorded WALK routes with path warnings and DRIVE routes; Google returns no TRANSIT route
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/hill-town/tg-fixture-hill-town-snapshots.json">tg-fixture-hill-town-snapshots.json</a> — Google snapshots in the Maps kit shape (hours, rating)
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/hill-town/tg-fixture-hill-town-trip.json">tg-fixture-hill-town-trip.json</a> — The trip: dates, lodging, modes
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/index.mjs">index.mjs</a>       — Fixture exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures/moving-day">moving-day/</a> — Three-day moving trip across two towns: a slow first morning, a station start with the bags to the hotel, a station end, a season sheet, researched facts, a crowd magnet and a dinner pool
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/moving-day/tg-fixture-moving-day-calibration.json">tg-fixture-moving-day-calibration.json</a> — Calibration state (per-category taps)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/moving-day/tg-fixture-moving-day-dinners.json">tg-fixture-moving-day-dinners.json</a> — Saved dinner places that fit the diet, with their facts
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/moving-day/tg-fixture-moving-day-estimates.json">tg-fixture-moving-day-estimates.json</a> — Visit estimates per place
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/moving-day/tg-fixture-moving-day-notes.json">tg-fixture-moving-day-notes.json</a> — Place notes from invented sources
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/moving-day/tg-fixture-moving-day-places.json">tg-fixture-moving-day-places.json</a> — Places with invented Google place ids, researched facts and flags
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/moving-day/tg-fixture-moving-day-profile.json">tg-fixture-moving-day-profile.json</a> — Profile excerpt (pace, meals, diet, avoid crowds)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/moving-day/tg-fixture-moving-day-routes.json">tg-fixture-moving-day-routes.json</a> — No recorded routes: every leg uses the straight-line fallback
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/moving-day/tg-fixture-moving-day-snapshots.json">tg-fixture-moving-day-snapshots.json</a> — Google snapshots in the Maps kit shape (hours, rating)
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/moving-day/tg-fixture-moving-day-trip.json">tg-fixture-moving-day-trip.json</a> — The trip: dates, two lodgings, day overrides, the season sheet
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures/p13d-scout">p13d-scout/</a> — Invented towns for the Phase 13 Scout engine tests: the grammar cases (with the core's parity marks), a trip split across two towns, opening-hours shapes
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/p13d-scout/tg-fixture-p13d-scout.mjs">tg-fixture-p13d-scout.mjs</a> — GRAMMAR, TRIP / CITY, SHORT_* and week(): the Scout engine's invented cases
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures/rehearsal-day">rehearsal-day/</a> — Three days on an invented coast for the Phase 12 rehearsal and the re-plan from where you are: two towns, a moving day by train, stations named only in the places' own access notes
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/rehearsal-day/tg-fixture-rehearsal-day-calibration.json">tg-fixture-rehearsal-day-calibration.json</a> — Calibration state (no taps yet)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/rehearsal-day/tg-fixture-rehearsal-day-dinners.json">tg-fixture-rehearsal-day-dinners.json</a> — Dinner places that fit the diet: three chosen and one saved for later
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/rehearsal-day/tg-fixture-rehearsal-day-estimates.json">tg-fixture-rehearsal-day-estimates.json</a> — Visit estimates per place
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/rehearsal-day/tg-fixture-rehearsal-day-notes.json">tg-fixture-rehearsal-day-notes.json</a> — Place notes from invented sources
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/rehearsal-day/tg-fixture-rehearsal-day-places.json">tg-fixture-rehearsal-day-places.json</a> — Places in both towns with invented Google place ids, three with access notes that name stations
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/rehearsal-day/tg-fixture-rehearsal-day-profile.json">tg-fixture-rehearsal-day-profile.json</a> — Profile excerpt (pace, interests, meals, diet, avoid)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/rehearsal-day/tg-fixture-rehearsal-day-routes.json">tg-fixture-rehearsal-day-routes.json</a> — No recorded routes: every leg uses the straight-line fallback
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/rehearsal-day/tg-fixture-rehearsal-day-snapshots.json">tg-fixture-rehearsal-day-snapshots.json</a> — Google snapshots in the Maps kit shape (hours, rating)
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/rehearsal-day/tg-fixture-rehearsal-day-trip.json">tg-fixture-rehearsal-day-trip.json</a> — The trip: three days, two lodgings with areas and access notes, a moving-day start at a station, country code ZZ, a zone far from UTC
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures/transit-city">transit-city/</a>   — Three-day TRANSIT city break, reserved domains
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-calibration.json">tg-fixture-transit-city-calibration.json</a> — Calibration state (per-category taps)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-estimates.json">tg-fixture-transit-city-estimates.json</a> — Visit estimates per place
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-notes.json">tg-fixture-transit-city-notes.json</a> — Place notes from invented sources
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-places.json">tg-fixture-transit-city-places.json</a> — Places with invented Google place ids
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-profile.json">tg-fixture-transit-city-profile.json</a> — Profile excerpt (pace, meals, interests)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-routes.json">tg-fixture-transit-city-routes.json</a> — Route Matrix + Compute Routes answers the responder replays
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-snapshots.json">tg-fixture-transit-city-snapshots.json</a> — Google snapshots in the Maps kit shape (hours, rating)
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-trip.json">tg-fixture-transit-city-trip.json</a> — The trip: dates, lodging, mode, bookings
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures/two-stays">two-stays/</a> — A week split between two towns: a morning train between them with the bags going ahead, a day trip to a waterfall, a booked dinner and a last day that ends at a station (the journey's fixture)
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/two-stays/tg-fixture-two-stays-calibration.json">tg-fixture-two-stays-calibration.json</a> — Calibration state (per-category taps)
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/two-stays/tg-fixture-two-stays-dinners.json">tg-fixture-two-stays-dinners.json</a> — Saved dinner places that fit the diet, one of them booked
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/two-stays/tg-fixture-two-stays-estimates.json">tg-fixture-two-stays-estimates.json</a> — Visit estimates per place
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/two-stays/tg-fixture-two-stays-notes.json">tg-fixture-two-stays-notes.json</a> — Place notes from invented sources
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/two-stays/tg-fixture-two-stays-places.json">tg-fixture-two-stays-places.json</a> — Places in both towns and a day trip away, with invented Google place ids
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/two-stays/tg-fixture-two-stays-profile.json">tg-fixture-two-stays-profile.json</a> — Profile excerpt (pace, interests, meals, diet)
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/two-stays/tg-fixture-two-stays-routes.json">tg-fixture-two-stays-routes.json</a> — No recorded routes: every leg uses the straight-line fallback
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/two-stays/tg-fixture-two-stays-snapshots.json">tg-fixture-two-stays-snapshots.json</a> — Google snapshots in the Maps kit shape (hours, rating)
│   │       │       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/two-stays/tg-fixture-two-stays-trip.json">tg-fixture-two-stays-trip.json</a> — The trip: a week, two lodgings, day overrides, a booking, the season sheet
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/gems">gems/</a> — Gem Funnel engine (WP-2g): screening, gem score and 💎 rule, evidence flags, gem line, shortlist floors, "Gems not chosen" — pure functions
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/gems/fixtures">fixtures/</a> — Invented pool for the funnel tests
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/fixtures/gems-fixture-port-sorrel.json">gems-fixture-port-sorrel.json</a> — An invented town's candidate pool
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/fixtures/index.mjs">index.mjs</a> — Fixture loader
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-chains.mjs">gems-chains.mjs</a> — Chain detection from repeated names
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-flags.mjs">gems-flags.mjs</a> — Evidence flags: unproven, tourist-oriented, closed-day conflict
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-geo.mjs">gems-geo.mjs</a> — Distances and minutes to the nearest anchor
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-hours.mjs">gems-hours.mjs</a> — Opening windows and closed dates
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-line.mjs">gems-line.mjs</a> — The "why it's a gem" line
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-project.mjs">gems-project.mjs</a> — toPlaceFields, toShortlistFields, assertNoGoogleFields
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-record.mjs">gems-record.mjs</a> — Pool record: normalizeRecord, fromSearchResult, streams, categories
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-score.mjs">gems-score.mjs</a> — Gem score (fit, quality, obscurity, localness, practicality) and the 💎 rule
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-screen.mjs">gems-screen.mjs</a> — Stage-2 screening with drop reasons
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-select.mjs">gems-select.mjs</a> — Shortlist floors by appetite and the "Gems not chosen" list
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/gems-weights.mjs">gems-weights.mjs</a> — Weights, floors, rough-edge tokens
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/index.mjs">index.mjs</a> — Gem Funnel exports
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gems/README.md">README.md</a> — Contract: the funnel in call order, the pool record, what stays build-scoped
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/gas">gas/</a>            — The Telegram chatbot (Phase 5): commands, flows, envelope handlers, sheets, Lane B, /route
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/00_common.js">00_common.js</a> — Request routing and shared helpers
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/10_commands.js">10_commands.js</a> — Instant commands and the /start interview offer
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/11_flow_interview.js">11_flow_interview.js</a> — The /interview flow
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/12_flow_plan.js">12_flow_plan.js</a> — The /plan journey and /seed
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/13_flow_review.js">13_flow_review.js</a> — The post-trip /review flow and daily offer
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/14_bookings.js">14_bookings.js</a> — Booking deadlines: Bookings tab, /bookings, reminders through one core alarm, ✅ Booked · Not needed · Tomorrow
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/15_weather.js">15_weather.js</a> — The day's weather from Open-Meteo (no key, credited, data CC BY 4.0, place names from GeoNames): one line per town, never throws
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/16_scout.js">16_scout.js</a> — /scout and /scouts: the scout request, the Scouts tab, the numbered list with ➕ Later buttons
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/17_journey.js">17_journey.js</a> — The journey before the days: outlines and day versions compared in the chat, 🧱 Build my plan, /outline, /versions, /journey on|off (off by default)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/18_morning.js">18_morning.js</a> — The morning message: the whole day, unasked, at the owner's morning time (/morning at HH:MM) or 30 min before leave-by; stored data plus the weather, readable in airplane mode
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/19_late.js">19_late.js</a> — Running late: /late <5–240> and the ⏰ buttons move the rest of today later as an overlay; each drop names its reason; Undo
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/20_envelopes.js">20_envelopes.js</a> — Handlers for the seven pack envelope types, prefs review buttons
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/21_sheets.js">21_sheets.js</a> — Pack tabs and their storage API
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/22_people.js">22_people.js</a> — People the owner travels with, who comes, /dates hours, trip_update
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/23_plan_parts.js">23_plan_parts.js</a> — Plans in parts (C11): the DigestParts tab, the join, the 24-hour tg_digest_parts alarm
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/24_here.js">24_here.js</a> — 📍 Re-plan from here on the trip's today: from the current stop, a shared location kept nowhere, or rain first; one replan request with from, visited and rain
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/25_checkin.js">25_checkin.js</a> — The evening check-in: the day's stops with 👍 👎 ⏭ ⏩ 👌 ⏪ and ✅ Done, at 21:00 or 15 min after the day's end; /review uses its taps
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/26_lodging.js">26_lodging.js</a> — A lodging change offers to re-plan the planned days it touches, or to keep the plan
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/27_vegcard.js">27_vegcard.js</a> — /vegcard and /vegcard rebuild, the VegCards tab, the veg_card envelope (sent when it answers or changed), the morning line
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/28_lists.js">28_lists.js</a> — /lists, /list &lt;name&gt; and /lists sync: the owner's saved lists from the Places tab's lists column; tgListNames()
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/29_compare.js">29_compare.js</a> — /compare two to four places or one list, in an optional place: opens a compare request
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/30_chat_api.js">30_chat_api.js</a> — Lane B (Claude API answers) and the /smart toggle
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/31_route.js">31_route.js</a> — /route through the Apps Script Maps service
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/32_app_api.js">32_app_api.js</a> — `?route=app` (registerRoute, auth webapp): the Mini App's operations — home, shortlist, facts, interview, brochure, places — and the `app_menu_button` setup step
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/33_daytrip_app.js">33_daytrip_app.js</a> — The Mini App's Day trip operations: daytrip.list, get, keep, new
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/34_whatson_app.js">34_whatson_app.js</a> — The Mini App's What's on operations: whatson.list, get, choose, new
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/35_scout_app.js">35_scout_app.js</a> — The Mini App's Scout operations: list, get, board, new, add
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/36_journey_app.js">36_journey_app.js</a> — The Mini App's Compare operations: journey.get, outline.choose, versions.get, versions.choose, versions.done
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/37_vegcard_app.js">37_vegcard_app.js</a> — The Mini App's veg card operation: vegcard.get
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/38_quiet_app.js">38_quiet_app.js</a> — The Mini App's Quiet operations: quiet.list, get, add, new, day
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/39_menu_app.js">39_menu_app.js</a> — The Mini App's Menu check operations: menu.list, get, new, replan, day
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/40_interview_bank.js">40_interview_bank.js</a> — Interview bank, generated by the bundler (never edit)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/41_daytrip.js">41_daytrip.js</a> — /daytrip and /daytrips: the request, the daytrip envelope, the DayTrips tab, the card, keep and put on a day, daytrips_kept
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/42_whatson.js">42_whatson.js</a> — /whatson: the request, the whatson envelope, the WhatsOn tab, the card, choosing a day, the weekly check, whatson_chosen
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/43_quiet.js">43_quiet.js</a> — /quiet: the request, the quiet envelope, the Quiet tab, the card, ➕ to Later, the 🕊 rows under a day
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/44_menu.js">44_menu.js</a> — /menu: the request, the menu envelope, the Menus tab, the card's re-plan offer, the 🍽 row under a day, menu_checks
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/45_commands_app.js">45_commands_app.js</a> — The app's Commands tab: every command the bot answers, grouped, described, with examples (commands.list)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/46_settings_app.js">46_settings_app.js</a> — The app's Settings screen: settings.get reads the switches, the profile and the /status numbers
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/47_units.js">47_units.js</a> — /units: the brochure clock and temperatures, in Settings and the snapshot
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/.gitkeep">.gitkeep</a>        — Keeps the directory
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/helper.json">helper.json</a>     — Pack manifest: name, drive root, memory dirs, timezone default
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/journey">journey/</a> — Whole-trip outlines, day versions and the chosen mix (WP-11e); no network call of its own
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/journey/index.mjs">index.mjs</a> — Journey exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/journey/journey-areas.mjs">journey-areas.mjs</a> — Where the candidates cluster and where the travellers sleep; the planner's day records
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/journey/journey-assemble.mjs">journey-assemble.mjs</a> — assembleChosen: one Plan for the chosen mix, its Later list rebuilt, the other versions kept
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/journey/journey-cache.mjs">journey-cache.mjs</a> — cachedMaps: one Maps request per point pair across a version set
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/journey/journey-check.mjs">journey-check.mjs</a> — checkOutline, checkDayVersions: the payloads against their bounds and the trip's fixed facts
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/journey/journey-outline.mjs">journey-outline.mjs</a> — outlineDraft, outlineInput: up to three outlines, the difference measure, the owner's mix
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/journey/journey-text.mjs">journey-text.mjs</a> — The payload bounds (LIMITS) and plain-words helpers
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/journey/journey-versions.mjs">journey-versions.mjs</a> — planVersions: up to three versions of a day, anchors held, a slower day, the set's budget
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/later">later/</a>          — Saved-for-later lists (WP-3a)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/later/index.mjs">index.mjs</a>       — Later exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/later/later-lists.mjs">later-lists.mjs</a> — createLists, addItem
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/later/later-moves.mjs">later-moves.mjs</a> — promote (→ affected_days) and demote
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/lists">lists/</a> — The owner's saved Google Maps lists from a Takeout export: reader, link parser, merge — pure functions (WP-14d)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/lists/fixtures">fixtures/</a> — Invented data (the town of Quillmere)
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/lists/fixtures/lists-export.json">lists-export.json</a> — The files of an invented Saved export, packed into a .tgz and a .zip by the tests
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/lists/fixtures/lists-sample.json">lists-sample.json</a> — An invented trip for the branch's test
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/lists/index.mjs">index.mjs</a> — Lists exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/lists/lists-fetch.mjs">lists-fetch.mjs</a> — The routine's Takeout fetch through ?route=takeout: takeoutUrl, listTakeout, fetchTakeout, the CLI (curl; never prints the key)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/lists/lists-merge.mjs">lists-merge.mjs</a> — mergeLists, recordResolution, lookupFor, acceptResult, destinationFor, listNotesFor, listedPlace, applyListTags
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/lists/lists-read.mjs">lists-read.mjs</a> — readSavedExport: .tgz, .zip or .csv; RFC 4180; limits, partial and truncated; readSavedExports for an export in parts
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/lists/lists-url.mjs">lists-url.mjs</a> — parseMapsUrl: CID, place id, pin, name, query or short link; never followed
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/lists/README.md">README.md</a> — Contract: the export, link forms, the merge, the resolution rule, limits, the owner's export steps
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/menu">menu/</a> — Menu check: a restaurant's own menu read against the party's diet, the dishes that fit and what to ask, and when a check counts for a dinner (WP-16b)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/menu/fixtures">fixtures/</a> — Invented data for the branch's tests
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/menu/fixtures/menu-parse-cases.json">menu-parse-cases.json</a> — The words cases the engine and the core share
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/menu/fixtures/menu-sample.json">menu-sample.json</a> — Invented checks: valid and invalid
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/menu/index.mjs">index.mjs</a> — Menu check exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/menu/menu-check.mjs">menu-check.mjs</a> — menuFits, menuNote, menuFact, CAVEAT_RE, menuCounts and menuCountsFrom: what fits, the note and fact, when a check counts for a dinner
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/menu/menu-payload.mjs">menu-payload.mjs</a> — validateMenuPayload and checkMenu: the menu payload, rule for rule with the core; menuPayload builds one
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/menu/menu-text.mjs">menu-text.mjs</a> — parseMenuText: the owner's words — the restaurant and the day
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/menu/README.md">README.md</a> — Where Menu check lives: the command, the check, the card's re-plan offer, the 🍽 button, the private skill
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/planner">planner/</a>        — Day planner + exact solver (WP-3b): matrix → order → real legs → DayPlan
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/index.mjs">index.mjs</a>       — planTrip (choices, rail estimates, transit fallback), replanDays, estimateBudget, PlanBudgetError, hoursOn, dateRange
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-anchors.mjs">planner-anchors.mjs</a> — A day's own start, end, hours and bag step (C11 day_overrides)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-assign.mjs">planner-assign.mjs</a> — Assigns candidates to dates by hours, bookings and geography
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-budget.mjs">planner-budget.mjs</a> — SKU budget estimate and the ceiling check before any call
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-buffer.mjs">planner-buffer.mjs</a> — Per-leg buffers and the day's spare time
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-category.mjs">planner-category.mjs</a> — Temple, shrine, garden, experience: refineCategory and the shortest sensible visits
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-chain.mjs">planner-chain.mjs</a> — checkDayChain re-exported from the schema checks (the leg chain and timeline)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-choices.mjs">planner-choices.mjs</a> — The owner's choices (picks, later, skip) applied to the pool before planning (WP-3d)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-crowd.mjs">planner-crowd.mjs</a> — Crowd timing: a crowd magnet at opening or late when the profile avoids crowds; noQuietSlotText, the warning when no quieter slot fits
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-day.mjs">planner-day.mjs</a> — One date end to end: matrix, solve, real legs, retime, cross-check
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-dinner.mjs">planner-dinner.mjs</a> — Dinner at a saved place that fits the diet, near the last stop or the lodging, with its booking line
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-evening.mjs">planner-evening.mjs</a> — Sunset and up to three evening extras (chosen What's on events first, season events, saved places)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-free.mjs">planner-free.mjs</a> — Named free windows and the saved places near them (Contract C18)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-facts.mjs">planner-facts.mjs</a> — A place's own facts in the schedule: closed weekdays, close, last entry, visit length
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-geo.mjs">planner-geo.mjs</a> — Haversine distances and the too_far rule
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-hours.mjs">planner-hours.mjs</a> — Opening windows per date from the snapshot; earliestFit
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-input.mjs">planner-input.mjs</a> — Normalises trip, places, estimates and profile into candidates
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-later.mjs">planner-later.mjs</a> — Collects dropped candidates into Later lists with codes
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-legs.mjs">planner-legs.mjs</a> — Maps kit calls: route matrix, one leg, walked-leg WALK and DRIVE checks (flags, taxi time), cross-check, Maps URLs
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-morning.mjs">planner-morning.mjs</a> — leaveBy and dayAreas: what the morning message needs from a built day (C12 outputs)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-notes.mjs">planner-notes.mjs</a> — The note guard: drops a note sentence whose timing advice the schedule contradicts
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-outline.mjs">planner-outline.mjs</a> — The journey outline as planner input: day kinds (full, light, travel, rain spare, free), areas, anchors
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-rail.mjs">planner-rail.mjs</a> — Station-based train estimates where Google has no transit route (Japan)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-rain.mjs">planner-rain.mjs</a> — Rainy-day swaps: covered indoor places off the plan, open that date, near the day's outdoor stops; straight-line only, no API call
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-restart.mjs">planner-restart.mjs</a> — replanDays from where you are (from, visited, rain): the rest of one day; visited stops keep their times
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-transit.mjs">planner-transit.mjs</a> — Rail first on TRANSIT days; buses only where rail has no route
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-rng.mjs">planner-rng.mjs</a> — Seeded RNG for deterministic tie-breaks
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-solve.mjs">planner-solve.mjs</a> — Held-Karp with time windows, bookings and the lunch slot
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-sun.mjs">planner-sun.mjs</a> — Sunset from the NOAA algorithm, no network call
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-time.mjs">planner-time.mjs</a> — Minutes-of-day helpers and local → ISO times
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/quiet">quiet/</a> — Quiet: up to 3 quieter places of the same kind near a crowd magnet, with the magnet's quietest hours (WP-16a)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/quiet/fixtures">fixtures/</a> — Invented data for the branch's tests
│   │       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/quiet/fixtures/quiet-parse-cases.json">quiet-parse-cases.json</a> — The words cases the engine and the core share
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/quiet/fixtures/quiet-sample.json">quiet-sample.json</a> — Invented boards: valid and invalid
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/quiet/index.mjs">index.mjs</a> — Quiet exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/quiet/quiet-payload.mjs">quiet-payload.mjs</a> — validateQuietPayload and checkQuiet: the quiet payload, rule for rule with the core; quietPayload builds one
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/quiet/quiet-rank.mjs">quiet-rank.mjs</a> — rankQuiet, isBusy, pickRadius and quietLine: the screens in order, the score, the 3 shown, the magnet's quiet line
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/quiet/quiet-text.mjs">quiet-text.mjs</a> — parseQuietText: the owner's words — the place and the day
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/quiet/README.md">README.md</a> — Where Quiet lives: the command, the board, which stops get a 🕊, the private skill
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/README.md">README.md</a>       — Pack contract: schemas, estimator, Later, fixtures, planner, brochure map, what it never does
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/schemas">schemas/</a>        — JSON Schemas for every entity + semantic checks (WP-3a)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/index.mjs">index.mjs</a>       — validate(entity, kind) → { ok, errors }
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-booking.schema.json">tour-guide-booking.schema.json</a> — One booking record: rule, opens at, book by, status
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-bookings.schema.json">tour-guide-bookings.schema.json</a> — bookings payload: the full list for one trip
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-briefing.schema.json">tour-guide-briefing.schema.json</a> — The written briefing a brochure build passes in (C18 wave 2)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-calibration.schema.json">tour-guide-calibration.schema.json</a> — Calibration state
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-checks.mjs">tour-guide-checks.mjs</a> — Cross-field checks the schema cannot express
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-dates.mjs">tour-guide-dates.mjs</a> — Date and time-of-day validation
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-day-plan.schema.json">tour-guide-day-plan.schema.json</a> — DayPlan
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-day-versions.schema.json">tour-guide-day-versions.schema.json</a> — day_versions payload: one to three versions of one date
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-daytrip.schema.json">tour-guide-daytrip.schema.json</a> — daytrip payload: up to 8 day trips from one base
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-google-snapshot.schema.json">tour-guide-google-snapshot.schema.json</a> — GoogleSnapshot (as the Maps kit emits it)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-later-list.schema.json">tour-guide-later-list.schema.json</a> — LaterList
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-menu.schema.json">tour-guide-menu.schema.json</a> — menu payload: one restaurant's menu checked against the party's diet
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-outline.schema.json">tour-guide-outline.schema.json</a> — outline payload: one to three outlines of the whole trip
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-place-note.schema.json">tour-guide-place-note.schema.json</a> — PlaceNote
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-place.schema.json">tour-guide-place.schema.json</a> — Place
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-places-digest.schema.json">tour-guide-places-digest.schema.json</a> — places_digest payload
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-plan.schema.json">tour-guide-plan.schema.json</a> — Plan (days, Later lists, budget, usage)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-plan-digest.schema.json">tour-guide-plan-digest.schema.json</a> — plan_digest payload
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-prefs-review.schema.json">tour-guide-prefs-review.schema.json</a> — prefs_review payload (the prefs kit's review)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-profile-excerpt.schema.json">tour-guide-profile-excerpt.schema.json</a> — Profile excerpt
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-profile-summary.schema.json">tour-guide-profile-summary.schema.json</a> — profile_summary payload
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-quiet.schema.json">tour-guide-quiet.schema.json</a> — quiet payload: up to 3 quieter places near one crowd magnet
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-scout.schema.json">tour-guide-scout.schema.json</a> — scout payload (one Scout board: ranked picks, left out, Drive ids)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-shortlist.schema.json">tour-guide-shortlist.schema.json</a> — shortlist payload (one /plan round)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-trip.schema.json">tour-guide-trip.schema.json</a> — Trip
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-trip-facts.schema.json">tour-guide-trip-facts.schema.json</a> — trip_facts payload (intake)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-veg-card.schema.json">tour-guide-veg-card.schema.json</a> — veg_card payload (the party's card in the local language)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-visit-estimate.schema.json">tour-guide-visit-estimate.schema.json</a> — VisitEstimate
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-whatson.schema.json">tour-guide-whatson.schema.json</a> — whatson payload: what is on in one place over up to 31 days
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/scout">scout/</a> — Scout engine: one food or activity across a destination, ranked, with a comparison board
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/scout/index.mjs">index.mjs</a> — Public API of the Scout engine
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/scout/scout-board.mjs">scout-board.mjs</a> — The Scout board: map, cards, compare table, left out (HTML for the app, PDF for the chat)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/scout/scout-payload.mjs">scout-payload.mjs</a> — The scout payload and the Place fields a pick writes (no Google field)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/scout/scout-rank.mjs">scout-rank.mjs</a> — Pool records, screens with reasons, the score and labels
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/scout/scout-text.mjs">scout-text.mjs</a> — "matcha in Kyoto" parsing, scout ids, groups, search queries
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/scout/scout-weights.mjs">scout-weights.mjs</a> — Weights, thresholds and limits
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/season">season/</a> — The trip's season sheet (C11 trip.season, WP-11b): normalize, events and blooms on a date, out-of-season gardens — pure functions
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/season/fixtures">fixtures/</a> — An invented season sheet
│   │       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/season/fixtures/season-fixture-full.json">season-fixture-full.json</a> — Weather, blooms and events filled
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/season/index.mjs">index.mjs</a> — Season sheet exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/season/README.md">README.md</a> — Contract: the sheet's fields, events, blooms and the out-of-season rule
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/season/season-bloom.mjs">season-bloom.mjs</a> — eventsOn, bloomOn, outOfSeason and the usual bloom months by hemisphere
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/season/season-normalize.mjs">season-normalize.mjs</a> — normalizeSeason: mechanical clean-up, then the schema subset and the checks
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/shortlist-sheet">shortlist-sheet/</a> — One research round as a printable PDF, numbered like the chat
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/shortlist-sheet/index.mjs">index.mjs</a>       — shortlistSheetHtml, renderShortlistPdf, CLI
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/travellers">travellers/</a>      — The travel profile as the planner reads it, and the party excerpt for trips with companions
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/travellers/index.mjs">index.mjs</a>       — Travellers exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/travellers/travellers-excerpt.mjs">travellers-excerpt.mjs</a> — profileExcerpt, dietOf: pace, interests, avoid, dietary and diet
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/travellers/travellers-party.mjs">travellers-party.mjs</a> — partyExcerpt: their limits, your lead
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/vegcard">vegcard/</a> — The veg card: the party's diet as short lines in the local language, to show staff — pure functions (WP-14c)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/vegcard/index.mjs">index.mjs</a> — Veg card exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/vegcard/README.md">README.md</a> — Contract: the card's sections, the party rule, languages, the fingerprint, how a skill sends it
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/vegcard/vegcard-fixture-party.json">vegcard-fixture-party.json</a> — Invented parties for the tests
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/vegcard/vegcard-payload.mjs">vegcard-payload.mjs</a> — validateVegCardPayload and checkVegCard: the schema subset, section order and lengths
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/vegcard/vegcard-phrases.json">vegcard-phrases.json</a> — The phrase table: diets, cannot-eat items and their lines per language
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/vegcard/vegcard-render.mjs">vegcard-render.mjs</a> — vegCardTelegram and vegCardHtml (the brochure's last page)
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/vegcard/vegcard.mjs">vegcard.mjs</a> — vegCard and vegCardFp: classify the party's limits, build the sections
│   │       └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/whatson">whatson/</a> — What's on: events, openings and closures in one place on given dates, grouped by date, chosen for days, carried into the plan (WP-15b)
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/whatson/fixtures">fixtures/</a> — Invented data for the branch's tests
│   │           │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/whatson/fixtures/whatson-parse-cases.json">whatson-parse-cases.json</a> — The words cases the engine and the core share
│   │           │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/whatson/fixtures/whatson-sample.json">whatson-sample.json</a> — Invented boards: valid, invalid and semantic
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/whatson/index.mjs">index.mjs</a> — What's on exports
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/whatson/README.md">README.md</a> — Where What's on lives: the command and window, the board, choosing, the weekly check, the private skill
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/whatson/whatson-check.mjs">whatson-check.mjs</a> — validateWhatsonPayload and checkWhatson: the whatson payload, rule for rule with the core (no imports)
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/whatson/whatson-events.mjs">whatson-events.mjs</a> — The board's items: stable ids, the clean-up, what is new, and a chosen item into the season sheet
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/whatson/whatson-payload.mjs">whatson-payload.mjs</a> — whatsonPayload and placeSlug: build a valid payload
│   │           └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/whatson/whatson-text.mjs">whatson-text.mjs</a> — parseWhatsonText: the owner's words — the place and the window
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/prompts">prompts/</a>                — The prompt each phase's session starts from
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-1.md">TG-PHASE-1.md</a>       — Phase 1 kickoff: helper framework foundation (Fable 5.1 · Xhigh)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-2.md">TG-PHASE-2.md</a>       — Phase 2 kickoff: shared kits 2a–2d in worktrees (coordinator Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-3.md">TG-PHASE-3.md</a>       — Phase 3 kickoff: Tour Guide engine (solver Fable 5.1 · high, rest Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-4.md">TG-PHASE-4.md</a>   — Phase 4 kickoff: private repo, memory, trip-research and plan-days (Fable 5.1 · high; rest Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-4-DELTA.md">TG-PHASE-4-DELTA.md</a> — Phase 4 delta for the running session: plan picks/later/skip/deliverables, shortlist, intake, interview answers, hand-off to 4b
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-4B.md">TG-PHASE-4B.md</a>  — Phase 4b kickoff: core flows + document delivery, prefs interview, engine choices and envelope types, skill deltas (Fable 5.1 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-4B-DELTA.md">TG-PHASE-4B-DELTA.md</a> — Phase 4b delta for the running session: places repository fields, sixth envelope type, re-check before re-research, review prefs, decisions 20–21
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-5.md">TG-PHASE-5.md</a>       — Phase 5 kickoff: Telegram commands, /interview and /plan flows, envelope handlers, sheets (Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-6.md">TG-PHASE-6.md</a> — Phase 6 kickoff: integration, red-team, cost audit, switch-on guide (Fable 5.1 · xhigh)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-7.md">TG-PHASE-7.md</a> — Phase 7 kickoff: owner switch-on — deploy, pair, the seven routines, the live interview, the first real `/plan` (Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-8.md">TG-PHASE-8.md</a> — Phase 8 kickoff (after the pilot trip): live review and tuning — owner questions, the carried Phase 7 findings, tuning from the pilot, the Phase 9 follow-ups (Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-9.md">TG-PHASE-9.md</a>       — Phase 9 kickoff (filled 2026-10-02 after Phase 7, pulled forward): the Tour Guide app as a Telegram Mini App — core route + signed launch data, app operations, generic data-free shell (Fable 5.1 · high; route Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-10.md">TG-PHASE-10.md</a> — Phase 10 kickoff: usefulness pass step 1 — the right day abroad, honest travel legs, a planner tidy-up, booking deadlines (Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-11.md">TG-PHASE-11.md</a> — Phase 11 kickoff: usefulness pass step 2 — real starts, dinners and evenings, researched place facts, season and local favourites, a brochure pass, then outlines and day versions to compare (Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-12.md">TG-PHASE-12.md</a> — Phase 12 kickoff: usefulness pass step 3 — the morning message, running late, re-plans from where you are, the evening check-in, a rehearsal before the trip (Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-13.md">TG-PHASE-13.md</a> — Phase 13 kickoff: the morning review's fix package — the planner's trip-breakers, real dated stays (C13), the vegetarian gaps, hours and rail, messages, Scout's faults (Opus 5.5 · high, no Fable)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-14.md">TG-PHASE-14.md</a> — Phase 14 kickoff: branches before the trip — the scaffold, Scout's ranking, the veg card and PDF, the owner's lists, compare, one Discover routine (Opus 5.5 · high, no Fable)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-15.md">TG-PHASE-15.md</a> — Phase 15 kickoff: Day trip and What's on before the trip — Contract C15, the rail fix for 15–40 km rides, chosen events and day trips in the plan (Opus 5.5 · high, no Fable)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-16.md">TG-PHASE-16.md</a> — Phase 16 kickoff: Quiet and Menu check before the trip — Contract C16, the two hooks under a day, the skeleton, WP-16a, WP-16b and the private side
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/README.md">README.md</a>               — Framework overview, "how to add a helper", the public/private rules
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/SPEC.md">SPEC.md</a>                 — Framework contract v1 — envelope, mailbox, wake route, manifest, registries, properties, sheet, limits, ownership map
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/status">status/</a>                 — One status file per work package
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/PHASE-5-RESUME.md">PHASE-5-RESUME.md</a> — Phase 5 resume note (usage-limit pause and resume)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/PHASE-6-RESUME.md">PHASE-6-RESUME.md</a> — Phase 6 resume note (usage-limit safety): step table and log
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/PHASE-7-RESUME.md">PHASE-7-RESUME.md</a> — Phase 7 resume note (usage-limit safety): which switch-on step the owner reached
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/PHASE-8-RESUME.md">PHASE-8-RESUME.md</a> — Phase 8 resume note: part 1 done, the post-trip tuning list
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-1b.md">WP-1b.md</a> — WP-1b progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2a.md">WP-2a.md</a>            — WP-2a progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2b.md">WP-2b.md</a>            — WP-2b progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2c.md">WP-2c.md</a>            — WP-2c progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2d.md">WP-2d.md</a>            — WP-2d progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2f.md">WP-2f.md</a> — WP-2f progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2g-engine.md">WP-2g-engine.md</a> — WP-2g engine progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2g-kits.md">WP-2g-kits.md</a> — WP-2g kits progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-3a.md">WP-3a.md</a>        — WP-3a progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-3b.md">WP-3b.md</a>        — WP-3b progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-3c.md">WP-3c.md</a>        — WP-3c progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-3d.md">WP-3d.md</a> — WP-3d progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-3e.md">WP-3e.md</a> — WP-3e progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-4a.md">WP-4a.md</a>        — WP-4a progress, dry runs and requests (generic copy from the private repo)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-4b.md">WP-4b.md</a>        — WP-4b progress, dry runs and requests (generic copy from the private repo)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-4c.md">WP-4c.md</a>        — WP-4c progress, dry runs, memory-merge experiment and requests (generic copy from the private repo)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-4d.md">WP-4d.md</a>        — WP-4d contract, checks, the `/plan` journey dry-run and requests R1–R9 (generic copy from the private repo)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-5a.md">WP-5a.md</a> — WP-5a progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-5b.md">WP-5b.md</a> — WP-5b progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-5c.md">WP-5c.md</a> — WP-5c progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-6a.md">WP-6a.md</a> — WP-6a progress, attack table A–I, requests and architect decisions
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-6b.md">WP-6b.md</a> — WP-6b progress, attack table, field-path trace, R3 report, requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-6c.md">WP-6c.md</a> — WP-6c progress, integration dry run, skills attack table, requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-9a.md">WP-9a.md</a> — WP-9a progress, files, tests, notes for 9b and 9c
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-9b.md">WP-9b.md</a> — WP-9b progress, files, tests, requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-9c.md">WP-9c.md</a> — WP-9c progress, the shell test, screenshots
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-10a.md">WP-10a.md</a> — WP-10a progress and checks
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-10b.md">WP-10b.md</a> — WP-10b progress and checks
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-11a.md">WP-11a.md</a> — WP-11a progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-11b.md">WP-11b.md</a> — WP-11b progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-11c.md">WP-11c.md</a> — WP-11c progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-11d.md">WP-11d.md</a> — WP-11d progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-11e.md">WP-11e.md</a> — WP-11e progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-11f.md">WP-11f.md</a> — WP-11f progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-12a.md">WP-12a.md</a> — WP-12a progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-12b.md">WP-12b.md</a> — WP-12b progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-12d.md">WP-12d.md</a> — WP-12d progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-12r.md">WP-12r.md</a> — WP-12r progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-13a.md">WP-13a.md</a> — WP-13a progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-13b.md">WP-13b.md</a> — WP-13b progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-13c.md">WP-13c.md</a> — WP-13c progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-13d.md">WP-13d.md</a> — WP-13d progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-14a.md">WP-14a.md</a> — WP-14a progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-14b.md">WP-14b.md</a> — WP-14b progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-14c.md">WP-14c.md</a> — WP-14c progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-14d.md">WP-14d.md</a> — WP-14d progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-14e.md">WP-14e.md</a> — WP-14e progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-14f.md">WP-14f.md</a> — WP-14f progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-15a.md">WP-15a.md</a> — WP-15a progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-15b.md">WP-15b.md</a> — WP-15b progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-16a.md">WP-16a.md</a> — WP-16a progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-16b.md">WP-16b.md</a> — WP-16b progress, checks and requests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-S-engine.md">WP-S-engine.md</a> — WP-S engine progress, checks and requests
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-S-gas.md">WP-S-gas.md</a> — WP-S core progress, checks and requests
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates">templates/</a>              — Skeletons copied by tools/new-helper.mjs
│   │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo">private-repo/</a>       — Skeleton of a helper's private repo ({{…}} placeholders filled by new-helper.mjs)
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/.gitattributes">.gitattributes</a>  — log/*.md merge=union so daily logs merge line by line; the Maps ledger uses the maps-ledger driver
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/.github">.github/</a>
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/.github/workflows">workflows/</a>
│   │       │       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/.github/workflows/merge-routine-memory.yml">merge-routine-memory.yml</a> — Merges memory-only claude/* branches into main
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/.gitignore">.gitignore</a>      — Scratch files and secrets never committed
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/CLAUDE.md">CLAUDE.md</a>       — Dual-mode: ROUTINE MODE (persona, two-lane rules, mailbox, memory) / development
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/log">log/</a>            — Append-only daily logs, one line per routine run
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/log/.gitkeep">.gitkeep</a>    — Keeps the directory
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/quarantine">quarantine/</a>     — Notes derived from untrusted content, awaiting owner promotion
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/quarantine/.gitkeep">.gitkeep</a>    — Keeps the directory
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/README.md">README.md</a>       — What lives in the private repo and where the framework comes from
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/repository-information">repository-information/</a> — Development-session files
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/repository-information/BUILD-STATE.md">BUILD-STATE.md</a> — Pointer to the framework tracker
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/repository-information/DEV-SESSION.md">DEV-SESSION.md</a> — Development rules + the /update-helpers pin bump
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/repository-information/SESSION-CONTEXT.md">SESSION-CONTEXT.md</a> — Saved by remember-session
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/routines">routines/</a>       — One &lt;name&gt;.prompt.md per routine
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/routines/README.md">README.md</a>   — The text pasted into the routine editor, one file per routine
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/scripts">scripts/</a>
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/scripts/merge-maps-ledger.mjs">merge-maps-ledger.mjs</a> — git merge driver for log/maps-usage-ledger.json: sums both sides' Maps spend
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/scripts/merge-routine-memory.sh">merge-routine-memory.sh</a> — Memory-only merge rules used by the workflow
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/skills">skills/</a>         — One SKILL.md per routine
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/skills/README.md">README.md</a>   — How skills are named and what each must state
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/skills/remember-session">remember-session/</a>
│   │       │       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/skills/remember-session/SKILL.md">SKILL.md</a> — Trimmed remember-session for development sessions (no version bookkeeping)
│   │       └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/vendor">vendor/</a>
│   │           └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/templates/private-repo/vendor/helpers">helpers/</a>    — Pinned copy of helpers-dist (git subtree)
│   │               └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/templates/private-repo/vendor/helpers/README.md">README.md</a> — Placeholder with the first-pin and /update-helpers instructions
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/tests">tests/</a>                  — node --test suites + in-memory Apps Script mocks
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_alarm.test.js">core_alarm.test.js</a> — 17_alarms.js: registerAlarm and the single pending alarmTrigger, re-armed after every run
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_command_forms.test.js">core_command_forms.test.js</a> — 18_command_forms.js: the template grammar, its refusals, fill and match
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_config.test.js">core_config.test.js</a> — 00_config.js — manifest merge, prefixed property names, time zone, secret redaction
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_executor.test.js">core_executor.test.js</a> — 07_executor.js + 08_actions_builtin.js — proposals, ✅ gate, dedupe, expiry, cap
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_flows.test.js">core_flows.test.js</a> — 15_flows.js + tgSendDocument — three-step flow, expiry, /cancel, interrupt, pause + resume, document size fallback
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_initdata.test.js">core_initdata.test.js</a> — 05_telegram.js: tgVerifyInitData (real HMAC, every refusal reason), tgSetMenuButton, web_app keyboard buttons
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_mailbox.test.js">core_mailbox.test.js</a> — 09_mailbox.js — envelope validation, dispatch, archive folders, dedupe, snapshot, pruning
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_queue.test.js">core_queue.test.js</a>  — 06_queue.js — one worker trigger per enqueue, retries, dead letters, pruning
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_registry.test.js">core_registry.test.js</a> — 02_registry.js — validation, duplicates, allowlist gating
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_router.test.js">core_router.test.js</a> — 10_router.js + 11_commands_builtin.js — webhook auth, pairing, commands, free text → request, callbacks, lock
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_routes.test.js">core_routes.test.js</a> — 02_registry.js + 10_router.js: registerRoute, core names refused, auth none/admin/webapp, status in the JSON body, daily cap
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_setup.test.js">core_setup.test.js</a>  — 14_setup.js — admin-secret gate, every setup action, pack steps
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_store.test.js">core_store.test.js</a>  — 03_store.js + 04_audit.js — header-mapped rows, settings, daily counters, pack sheets
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_telegram.test.js">core_telegram.test.js</a> — 05_telegram.js: tag- and entity-safe `tgSplit`/`tgClip`, plain-text retries, `tgSafeHtml`, `stripHidden`
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_upload.test.js">core_upload.test.js</a> — 16_upload.js: key per request, open/just-answered only, mime/name/folder/size/count refusals
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_wake.test.js">core_wake.test.js</a>   — 12_wake.js + 13_routines.js — wake route, sweeps, one-off triggers, request lifecycle, daily jobs
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/tests/harness">harness/</a>
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/harness/gas-mocks.js">gas-mocks.js</a>    — In-memory Apps Script mocks + loader (Properties, Cache, Lock, Drive, Spreadsheet, UrlFetch, triggers)
│   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/harness/tour-guide-digest.js">tour-guide-digest.js</a> — Test stand-in for the private repo's plan_digest builder (both Phase 11 end-to-end tests)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/index.js">index.js</a>            — Loads every *.test.js in this directory
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_c11.test.js">kit_brochure_c11.test.js</a> — Brochure kit: every C11 field, strict keys, old plans byte for byte
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_c12.test.js">kit_brochure_c12.test.js</a> — Brochure kit: the C12 fields (visited stops as done, "from where you were" with no origin and no coordinates anywhere) and the phone clock beside a stop badge (Chromium)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_c18.test.js">kit_brochure_c18.test.js</a> — Contract C18 in the kit: schema, checks, clock and temperature, every block, byte-identical older models
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_c18b.test.js">kit_brochure_c18b.test.js</a> — Contract C18 wave 2 in the kit: lead, key times, food, if-then, why, day kit; older models byte for byte
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_cli.test.js">kit_brochure_cli.test.js</a> — Brochure kit: CLI exit codes, build without Playwright
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_directions.test.js">kit_brochure_directions.test.js</a> — Brochure kit: Google Maps directions links per leg
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_google_images.test.js">kit_brochure_google_images.test.js</a> — Brochure kit: Google maps, photos, projection and overlay
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_redteam.test.js">kit_brochure_redteam.test.js</a> — Brochure kit red-team: escaping at every emit site, strict image data URIs, bidi and zero-width characters, oversize notes
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_render.test.js">kit_brochure_render.test.js</a> — Brochure kit: self-contained render, hostile strings escaped
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_sketch.test.js">kit_brochure_sketch.test.js</a> — Brochure kit: route sketch projection and drawing
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_validate.test.js">kit_brochure_validate.test.js</a> — Brochure kit: schema and semantic checks on the model
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_client.test.js">kit_maps_client.test.js</a> — Maps kit: masks bill their SKU, Places and Routes calls, matrix caps
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_gems.test.js">kit_maps_gems.test.js</a> — Maps kit: Nearby Search, minRating, atmosphere tier, Places Aggregate, new SKUs
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_ledger.test.js">kit_maps_ledger.test.js</a> — Maps kit: SKU ledger and hard stop
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_redteam.test.js">kit_maps_redteam.test.js</a> — Maps kit red-team: hostile Place Details answers capped, poisoned snapshot store sanitized, hostile names in URLs
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_static_photos.test.js">kit_maps_static_photos.test.js</a> — Maps kit: Static Maps (key handling, limits, signing) and Place Photos
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_transport.test.js">kit_maps_transport.test.js</a> — Maps kit: proxy tunnel transport, no key leaks; live smoke (skipped unless asked)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_urls_snapshots.test.js">kit_maps_urls_snapshots.test.js</a> — Maps kit: Maps URLs and the snapshot purge
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_prefs_cli.test.js">kit_prefs_cli.test.js</a> — Prefs kit: CLI end to end
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_prefs_evidence.test.js">kit_prefs_evidence.test.js</a> — Prefs kit: evidence validation, sanitizing, injection flag
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_prefs_flow.test.js">kit_prefs_flow.test.js</a> — Prefs kit: the five invariants (no owner word, no profile entry)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_prefs_interview.test.js">kit_prefs_interview.test.js</a> — Prefs kit: vocabulary, question bank and the interview command
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_prefs_redteam.test.js">kit_prefs_redteam.test.js</a> — Prefs kit red-team: evidence as instructions (also French/German), hostile decisions and values, hand-edited profile, interview free text
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_prefs_subject.test.js">kit_prefs_subject.test.js</a> — Prefs kit: a profile about a named companion (heading, opening line, /profile count) and refresh from the ledger
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_research_cli.test.js">kit_research_cli.test.js</a> — Research kit: CLI end to end
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_research_core.test.js">kit_research_core.test.js</a> — Research kit: budgets, ledger, two-source rule, labels, durations
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_research_injection.test.js">kit_research_injection.test.js</a> — Research kit: hostile pages are flagged and change nothing
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_research_redteam.test.js">kit_research_redteam.test.js</a> — Research kit red-team: instructions in pages, comments and attributes, multilingual, forged envelopes, one-host floods
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_research_sources.test.js">kit_research_sources.test.js</a> — Research kit: source kinds, languages and mentions
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_hello.test.js">pack_hello.test.js</a>  — The hello pack extends the core through registries only and runs end to end
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_brochure-map.test.js">pack_tour-guide_brochure-map.test.js</a> — Tour Guide pack: plan → brochure model → kit-valid HTML on both fixtures
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_brochure-map_bookings.test.js">pack_tour-guide_brochure-map_bookings.test.js</a> — Tour Guide pack: the Bookings practical section (both times, order, links, escaping)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_brochure-map_c11.test.js">pack_tour-guide_brochure-map_c11.test.js</a> — Tour Guide pack: the C11 fields in the brochure through the facts adapter
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_brochure-map_c12.test.js">pack_tour-guide_brochure-map_c12.test.js</a> — Tour Guide pack: a day re-planned from where you are reaches the brochure; the shared point appears nowhere
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_brochure-map_undated_booking.test.js">pack_tour-guide_brochure-map_undated_booking.test.js</a> — Tour Guide pack: a booking with no date belongs to the first day its place is planned; a dated one never moves
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_brochure-map_units.test.js">pack_tour-guide_brochure-map_units.test.js</a> — Tour Guide pack: brochure-map unit checks (hours, cards, later, text)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_brochure_legs.test.js">pack_tour-guide_brochure_legs.test.js</a> — Tour Guide pack: the brochure reads honest legs (estimates, flags, taxi, spare time, about times)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_c11_inputs.test.js">pack_tour-guide_c11_inputs.test.js</a> — Tour Guide pack: the C11 trip and place fields (schemas and checks)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_c12_contracts.test.js">pack_tour-guide_c12_contracts.test.js</a> — Tour Guide pack: every C12 field at its bounds, one past them refused, older records still valid
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_c16_hooks.test.js">pack_tour-guide_c16_hooks.test.js</a> — Tour Guide pack: the C16 hooks — noQuietSlotText word for word, where the Quiet and Menu rows land, nothing changes without them
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_choices.test.js">pack_tour-guide_choices.test.js</a> — Tour Guide pack: owner choices on planTrip, statuses, "Saved by you"
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_commands17b_shell.test.js">pack_tour-guide_commands17b_shell.test.js</a> — Tour Guide pack: the app's search box, Recent and Pinned, card buttons and Settings, run against the real bundle
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_commands17c_shell.test.js">pack_tour-guide_commands17c_shell.test.js</a> — Tour Guide pack: the app's five tabs, the Today tab and answers that open in the app, run against the real bundle
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_commands_app.test.js">pack_tour-guide_commands_app.test.js</a> — Tour Guide pack: listCommands, every registered command described once, commands.list follows the registry
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_commands_shell.test.js">pack_tour-guide_commands_shell.test.js</a> — Tour Guide pack: the app's Commands screen — nav, render from the real op, search, copy on tap, refusals
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_compare.test.js">pack_tour-guide_compare.test.js</a> — Tour Guide pack: /compare names or one list, in a place; the usage line; the real lists module
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_compare_cut.test.js">pack_tour-guide_compare_cut.test.js</a> — Tour Guide pack: compareCut on bare records before the lookups; already_cut added to more
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_c18_planner_free.test.js">pack_tour-guide_c18_planner_free.test.js</a> — The planner's free-window options
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_c18_planner_plan.test.js">pack_tour-guide_c18_planner_plan.test.js</a> — Free options inside a whole plan
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_c18_brochure_map.test.js">pack_tour-guide_c18_brochure_map.test.js</a> — brochure-map's C18 values
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_c18b_briefing.test.js">pack_tour-guide_c18b_briefing.test.js</a> — The briefing schema and its merge into the brochure model
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_daytrip.test.js">pack_tour-guide_daytrip.test.js</a> — Tour Guide pack: /daytrip and its words (parity with the engine), the routing, the validators agree on every fixture
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_daytrip_app.test.js">pack_tour-guide_daytrip_app.test.js</a> — Tour Guide pack: the app's Day trips screen
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_daytrip_engine.test.js">pack_tour-guide_daytrip_engine.test.js</a> — Tour Guide pack: the Day trip engine — words, the reach part, every screen, the score, the payload, the outline entry
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_daytrip_gas.test.js">pack_tour-guide_daytrip_gas.test.js</a> — Tour Guide pack: the daytrip envelope, the DayTrips tab and card, keep and put on a day, daytrips_kept, the app ops
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_engines_redteam.test.js">pack_tour-guide_engines_redteam.test.js</a> — Gems, planner, estimator, later list and schemas red-team: forged records, one-publisher floods, words-only `gem_line`
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_estimator.test.js">pack_tour-guide_estimator.test.js</a> — Tour Guide pack: estimates, calibration taps, bounds
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_facts.test.js">pack_tour-guide_facts.test.js</a> — Tour Guide pack: place facts (normalize, lines, staleness, conflicts)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_fixtures.test.js">pack_tour-guide_fixtures.test.js</a> — Tour Guide pack: fixtures validate, responder replays every pair
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_app.test.js">pack_tour-guide_gas_app.test.js</a> — Tour Guide chatbot: the Mini App route — every operation, refusals, no Google field stored
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_bookings.test.js">pack_tour-guide_gas_bookings.test.js</a> — Tour Guide chatbot: bookings envelope, Bookings tab, /bookings, reminders, Booked · Not needed · Tomorrow
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_c11.test.js">pack_tour-guide_gas_c11.test.js</a> — Tour Guide pack: C11 in both validators, plans in parts, the day card, trip.digest, per-day /dates
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_c12.test.js">pack_tour-guide_gas_c12.test.js</a> — Tour Guide pack: the C12 digest fields in both validators and in storage; an old digest reads as before
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_chat.test.js">pack_tour-guide_gas_chat.test.js</a> — Tour Guide chatbot: Lane B, /smart and the status line
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_checkin.test.js">pack_tour-guide_gas_checkin.test.js</a> — Tour Guide chatbot: the evening check-in, its taps and /review
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_commands.test.js">pack_tour-guide_gas_commands.test.js</a> — Tour Guide chatbot: Instant commands and callbacks
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_e2e.test.js">pack_tour-guide_gas_e2e.test.js</a> — Tour Guide chatbot: Mock end-to-end: interview, /plan, places, review, fallbacks
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_envelopes.test.js">pack_tour-guide_gas_envelopes.test.js</a> — Tour Guide chatbot: The six envelope handlers and prefs review
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_here.test.js">pack_tour-guide_gas_here.test.js</a> — Tour Guide chatbot: 📍 re-plan from here; a shared location serves one request and is kept nowhere
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_interview.test.js">pack_tour-guide_gas_interview.test.js</a> — Tour Guide chatbot: The /interview flow
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_journey.test.js">pack_tour-guide_gas_journey.test.js</a> — Tour Guide chatbot: outlines and day versions in the chat, the build, /versions, the switch and the app's Compare operations
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_late.test.js">pack_tour-guide_gas_late.test.js</a> — Tour Guide chatbot: running late, the overlay, drops with reasons, Undo
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_morning.test.js">pack_tour-guide_gas_morning.test.js</a> — Tour Guide chatbot: the morning message, its time and its weather line
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_plan.test.js">pack_tour-guide_gas_plan.test.js</a> — Tour Guide chatbot: The /plan flow
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_review.test.js">pack_tour-guide_gas_review.test.js</a> — Tour Guide chatbot: The /review flow and daily offer
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_route.test.js">pack_tour-guide_gas_route.test.js</a> — Tour Guide chatbot: /route
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_sheets.test.js">pack_tour-guide_gas_sheets.test.js</a> — Tour Guide chatbot: Pack sheets and storage API
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gas_trip_tz.test.js">pack_tour-guide_gas_trip_tz.test.js</a> — Tour Guide chatbot: each trip's own time zone and Contract C10 acceptance
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gems.test.js">pack_tour-guide_gems.test.js</a> — Tour Guide pack: the Gem Funnel on the invented pool
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_gems_c11.test.js">pack_tour-guide_gems_c11.test.js</a> — Tour Guide pack: local favourites, out-of-season gardens, crowd magnets
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_integration.test.js">pack_tour-guide_integration.test.js</a> — Tour Guide pack: fixtures → estimator → planner → schemas → brochure, the Phase 3 property set
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_journey.test.js">pack_tour-guide_journey.test.js</a> — Tour Guide pack: outlines, the planner's outline input, day versions and the chosen mix on the two-stays fixture
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_journey_payloads.test.js">pack_tour-guide_journey_payloads.test.js</a> — Tour Guide pack: every bound of the outline and day_versions payloads, the Node validator and the core's mirror agreeing
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_later.test.js">pack_tour-guide_later.test.js</a> — Tour Guide pack: Later lists, promote / demote
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_lists.test.js">pack_tour-guide_lists.test.js</a> — Tour Guide pack: /lists, /list, /lists sync, the Places tab's lists column, /places, the app's list filter
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_lists_engine.test.js">pack_tour-guide_lists_engine.test.js</a> — Tour Guide pack: the Takeout reader, link forms, the merge, the resolution rule, destinations, notes
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_lists_fetch.test.js">pack_tour-guide_lists_fetch.test.js</a> — Tour Guide pack: the Takeout fetch client — list, fetch, sizes, refusals, the CLI's exits; the key never shows
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_lists_parts.test.js">pack_tour-guide_lists_parts.test.js</a> — Tour Guide pack: readSavedExports — one export in parts (a zip and a tgz), the limits across parts
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_lists_takeout.test.js">pack_tour-guide_lists_takeout.test.js</a> — Tour Guide pack: ?route=takeout, the daily check, /lists sync and /lists auto, the /lists lines; Drive never changed
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_menu.test.js">pack_tour-guide_menu.test.js</a> — Tour Guide pack: /menu and its words (parity with the engine), the Menus tab and card, the re-plan offer, the 🍽 row, menu_checks, the app ops
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_menu_app.test.js">pack_tour-guide_menu_app.test.js</a> — Tour Guide pack: the app's Menu screen and the day view's 🍽 button
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_menu_engine.test.js">pack_tour-guide_menu_engine.test.js</a> — Tour Guide pack: the Menu check engine — words, what fits, the note and fact, when a check counts, the payload
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_note_table.js">pack_tour-guide_note_table.js</a> — The note guard's shared table (module and GAS port agree on it)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_payloads.test.js">pack_tour-guide_payloads.test.js</a> — Tour Guide pack: the seven payload schemas and validatePayload
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13_coord.test.js">pack_tour-guide_p13_coord.test.js</a> — Tour Guide pack: Phase 13 coordinator wiring — opening days that vary are not read as closed when the journey clusters
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13_parity.test.js">pack_tour-guide_p13_parity.test.js</a> — Tour Guide pack: the core's Scout parse and the engine's grammar agree on what and where
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13_probe.test.js">pack_tour-guide_p13_probe.test.js</a> — Tour Guide pack: probe P — four days, two stays, a departure too early to fit, through the planner, a two-part digest and the core, then a stay change and its re-plans
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13a_facts_age.test.js">pack_tour-guide_p13a_facts_age.test.js</a> — Tour Guide planner: own facts older than 90 days still set the times, with a check line
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13a_old_fixtures.test.js">pack_tour-guide_p13a_old_fixtures.test.js</a> — Tour Guide planner: the old fixtures plan byte for byte as before Phase 13
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13a_timing.test.js">pack_tour-guide_p13a_timing.test.js</a> — Tour Guide planner: a departure day's last leg leaves as late as allowed; evening extras never start before the day
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13a_trip_breakers.test.js">pack_tour-guide_p13a_trip_breakers.test.js</a> — Tour Guide planner: an unreachable end, an inverted override, a booking at a day's edge or outside the trip
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13b_dinner.test.js">pack_tour-guide_p13b_dinner.test.js</a> — Tour Guide planner: dinner menus never checked or checked long ago; the local day of a check date
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13b_hours.test.js">pack_tour-guide_p13b_hours.test.js</a> — Tour Guide planner: irregular wording on one weekday, opening days that vary, the rain swaps
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13b_rail_season.test.js">pack_tour-guide_p13b_rail_season.test.js</a> — Tour Guide planner: a conventional-line ride between towns; roses and autumn-flowering cherries
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13c_dates.test.js">pack_tour-guide_p13c_dates.test.js</a> — Tour Guide core: every /dates refusal about a day's length ends with a valid command
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13c_html.test.js">pack_tour-guide_p13c_html.test.js</a> — Tour Guide core: a line cut for length is cut only in its visible text, links whole or dropped
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13c_lodging.test.js">pack_tour-guide_p13c_lodging.test.js</a> — Tour Guide core: dated stays from the chat — add, replace, remove, clear, list, refusals, trip_update.lodging
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13c_parity.test.js">pack_tour-guide_p13c_parity.test.js</a> — Tour Guide core: every free-text length bound gives the same answer in the pack's validator and the core's
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13c_reminders.test.js">pack_tour-guide_p13c_reminders.test.js</a> — Tour Guide core: the trip's zone from its first day's start; one booking reminder on the travel day
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13c_scout.test.js">pack_tour-guide_p13c_scout.test.js</a> — Tour Guide core: Scout's ranked line marks and the request text as typed in the chat and the app
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13c_scouted.test.js">pack_tour-guide_p13c_scouted.test.js</a> — Tour Guide core: scouted candidates in the places digest, the Places tab, /places and the app
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13c_stale.test.js">pack_tour-guide_p13c_stale.test.js</a> — Tour Guide core: the lodging fingerprint, its stamp on plan requests and the stale-plan line, the /lodging re-plan offer and Keep
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13c_world.js">pack_tour-guide_p13c_world.js</a> — Shared invented world for the WP-13c tests: one trip, its plan digest and chat helpers (not a test file)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p13d_scout.test.js">pack_tour-guide_p13d_scout.test.js</a> — Tour Guide pack: the Scout engine's faults — been before, the city's days, one grammar, the vegetarian flag, own names
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p14b_scout.test.js">pack_tour-guide_p14b_scout.test.js</a> — Tour Guide pack: Scout's ranking, tuned — a fixed anchor, penalties, rescue, likely drinks, not judged, five parts, one estimator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p14e_compare.test.js">pack_tour-guide_p14e_compare.test.js</a> — Tour Guide pack: compare mode — both validators, the engine's flags and cap, the payload, the board, the card
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_p14e_routing.test.js">pack_tour-guide_p14e_routing.test.js</a> — Tour Guide pack: the discovery kinds go to Discover when it is set, and where they went before when not
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_phase10_e2e.test.js">pack_tour-guide_phase10_e2e.test.js</a> — Tour Guide pack: Phase 10 end to end (C10 day card abroad, bookings and reminders, the brochure Bookings page)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_phase11_e2e.test.js">pack_tour-guide_phase11_e2e.test.js</a> — Tour Guide pack: the moving-day trip through the planner, the brochure, a two-part digest, the day card and trip.digest
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_phase11_wave2_e2e.test.js">pack_tour-guide_phase11_wave2_e2e.test.js</a> — Tour Guide pack: the two-stays week through the journey, the core, the day cards and one brochure
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_phase12_rehearsal.test.js">pack_tour-guide_phase12_rehearsal.test.js</a> — Tour Guide pack: one invented trip day through the planner, the digest and the core: the morning, running late, re-plans from here, the check-in, /review, a lodging change
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_phase12_rehearsal_weather.js">pack_tour-guide_phase12_rehearsal_weather.js</a> — Recorded Open-Meteo answer shapes with invented towns and weather for the rehearsal (not a test file)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_phase12_world.js">pack_tour-guide_phase12_world.js</a> — Shared invented world for the Phase 12 chatbot tests: one trip in a zone far from UTC, stations, Open-Meteo answers (not a test file)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner.test.js">pack_tour-guide_planner.test.js</a> — Tour Guide pack: solver and planner properties on a generated world
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_rail.test.js">pack_tour-guide_rail.test.js</a> — Tour Guide pack: station-based train estimates where Google has no transit
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_rail-first.test.js">pack_tour-guide_rail-first.test.js</a> — Tour Guide pack: rail-first transit preferences and the bus fallback
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_world.js">pack_tour-guide_planner_world.js</a> — Generated planner world (seeded cities, hours, bookings) used by the planner tests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_transit-fallback.test.js">pack_tour-guide_planner_transit-fallback.test.js</a> — Tour Guide pack: distance estimates when Google has no transit route
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_c11.test.js">pack_tour-guide_planner_c11.test.js</a> — Tour Guide pack: moving days, dinners, evenings, facts, crowd slots and sunset on the moving-day fixture
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_c11_units.test.js">pack_tour-guide_planner_c11_units.test.js</a> — Tour Guide pack: the C11 planner modules one by one (old fixtures plan as before)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_c12.test.js">pack_tour-guide_planner_c12.test.js</a> — Tour Guide pack: the morning fields and the re-plan from where you are on the rehearsal-day fixture
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_dates.test.js">pack_tour-guide_planner_dates.test.js</a> — Tour Guide pack: dates in words; the planner's day words equal the chatbot's on every day of two years
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_legs.test.js">pack_tour-guide_planner_legs.test.js</a> — Tour Guide pack: honest travel legs on the hill-town fixture (WALK routes, taxi time, buffers, spare time)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_notes.test.js">pack_tour-guide_planner_notes.test.js</a> — Tour Guide pack: the note guard never lets a note contradict its scheduled time
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_rain.test.js">pack_tour-guide_planner_rain.test.js</a> — Tour Guide pack: rainy-day swaps near a day's outdoor stops, open that date
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_tidy.test.js">pack_tour-guide_planner_tidy.test.js</a> — Tour Guide pack: the six tidy-up fixes, each with a before and an after assertion
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_quiet.test.js">pack_tour-guide_quiet.test.js</a> — Tour Guide pack: /quiet and its words (parity with the engine), the routing, the three validators, the Quiet tab and card
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_quiet_app.test.js">pack_tour-guide_quiet_app.test.js</a> — Tour Guide pack: the app's Quiet screen and the day view's 🕊 buttons
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_quiet_engine.test.js">pack_tour-guide_quiet_engine.test.js</a> — Tour Guide pack: the Quiet engine — words, the ratio and its parts, busy magnets, every screen, the radius, the quiet line
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_quiet_gas.test.js">pack_tour-guide_quiet_gas.test.js</a> — Tour Guide pack: the quiet envelope, ➕ to Later through a rebuild, the 🕊 stops and rows, resend and ask
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_redteam_callbacks.test.js">pack_tour-guide_redteam_callbacks.test.js</a> — Pack red-team B: forged, stale and malformed callback data at the webhook
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_redteam_chat.test.js">pack_tour-guide_redteam_chat.test.js</a> — Pack red-team C–H: interview free text, renderer escaping, Lane B prompt structure, `/route`, `/plan` inputs, webhook shapes
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_redteam_envelopes.test.js">pack_tour-guide_redteam_envelopes.test.js</a> — Pack red-team A: hostile from-brain envelopes refused or neutralised
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_redteam_pdf.test.js">pack_tour-guide_redteam_pdf.test.js</a> — Pack red-team I: PDF delivery — `drive_file_ids`, over-size files, `/brochure` resend, files outside the helper root
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_schemas.test.js">pack_tour-guide_schemas.test.js</a> — Tour Guide pack: every schema accepts its fixture and rejects hostile shapes
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_scout.test.js">pack_tour-guide_scout.test.js</a> — Tour Guide pack: Scout parsing, ranking, payload, Place fields and board
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_scout_gas.test.js">pack_tour-guide_scout_gas.test.js</a> — Tour Guide pack: the core's /scout, Scouts tab, ➕ callback and app operations
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_scout_redteam.test.js">pack_tour-guide_scout_redteam.test.js</a> — Tour Guide pack: Scout red team (Google fields, hostile text, data URIs, injection)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_season.test.js">pack_tour-guide_season.test.js</a> — Tour Guide pack: the season sheet (normalize, events, blooms, out of season)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_settings_app.test.js">pack_tour-guide_settings_app.test.js</a> — Tour Guide pack: settings.get defaults, read back after each switch command, smart answers without and with a key
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_shortlist-sheet.test.js">pack_tour-guide_shortlist-sheet.test.js</a> — Shortlist sheet: chat numbering, escaping, gem badge, notes cap, real PDF when Chromium is present
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_travellers.test.js">pack_tour-guide_travellers.test.js</a> — Tour Guide pack: the excerpt keeps every dietary limit, overrides never lift one, the party excerpt
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_units.test.js">pack_tour-guide_units.test.js</a> — /units, its defaults, Settings, the snapshot and the guide form
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_vegcard.test.js">pack_tour-guide_vegcard.test.js</a> — Tour Guide pack: the veg card engine — phrases for every cannot-eat value, the four cases, the fingerprint, escaping, bounds
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_vegcard_app.test.js">pack_tour-guide_vegcard_app.test.js</a> — Tour Guide pack: the app's Veg card screen and the brochure PDF button
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_vegcard_gas.test.js">pack_tour-guide_vegcard_gas.test.js</a> — Tour Guide pack: /vegcard, the veg_card envelope, the VegCards tab, the morning line, vegcard.get and brochure.pdf
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_whatson.test.js">pack_tour-guide_whatson.test.js</a> — Tour Guide pack: /whatson and its words, the WhatsOn tab and card, choosing, the weekly check, one choice per trip and place, whatson_chosen, the app ops
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_whatson_app.test.js">pack_tour-guide_whatson_app.test.js</a> — Tour Guide pack: the app's What's on screen
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_whatson_engine.test.js">pack_tour-guide_whatson_engine.test.js</a> — Tour Guide pack: the What's on engine — words, ids, the clean-up, the payload, the bridge to the season sheet
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_whatson_evening.test.js">pack_tour-guide_whatson_evening.test.js</a> — Tour Guide pack: the evening (change E) — events under way, chosen events first, the 10 km radius
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/shell_helper-app.playwright.mjs">shell_helper-app.playwright.mjs</a> — Browser test of the shell (Playwright, no network): six screens light/dark, batch submit, brochure sandbox, error states, layout; writes the screenshots
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/shell_helper-app_17c.playwright.mjs">shell_helper-app_17c.playwright.mjs</a> — Browser test of the five tabs, the Today tab and a watched answer (Playwright, no network, the real bundle)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/shell_helper-app_commands.playwright.mjs">shell_helper-app_commands.playwright.mjs</a> — Browser test of the Commands screen (Playwright, no network): Run, a Fill in form, the Sent screen, light and dark; writes the screenshots
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/shell_helper-app_compare.playwright.mjs">shell_helper-app_compare.playwright.mjs</a> — Browser test of the Compare screen and the chat-style day card (Playwright, no network); writes the screenshots
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/shell_helper-app_shortcuts.playwright.mjs">shell_helper-app_shortcuts.playwright.mjs</a> — Browser test of the search box, shortcuts, card buttons and Settings (Playwright, no network, the real bundle)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_boundary.test.js">tools_boundary.test.js</a> — Plants a fake secret and a personal-data path; the boundary check must fail on them
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_bundle.test.js">tools_bundle.test.js</a> — Manifest validation, bundle layout, appsscript.json, CLI, bundle runs in the mocks
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_envelope.test.js">tools_envelope.test.js</a> — Envelope stamping with a real id + clock; types from core and manifest
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_new_branch.test.js">tools_new_branch.test.js</a> — new-branch.mjs: four branch shapes pass their check, their test and the whole suite on a copy; clashes, --force, --dry-run, --check
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_new_helper.test.js">tools_new_helper.test.js</a> — Scaffolds a pack and a private repo; the result bundles and runs in the mocks
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_upload.test.js">tools_upload.test.js</a> — upload.mjs builds what the route accepts; dry run never prints the key
│   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/tools">tools/</a>                  — Node tools, no dependencies
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/boundary-allowlist.txt">boundary-allowlist.txt</a> — Domains, literals and paths the boundary check accepts
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/boundary-check.mjs">boundary-check.mjs</a>  — Fails on secrets, PII and personal-data paths under helpers/ (CI gate)
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/tools/branch-templates">branch-templates/</a> — The files new-branch.mjs fills in
│       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/app.js.tmpl">app.js.tmpl</a> — The branch's app ops, added to TG_APP_OPS
│       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/core.js.tmpl">core.js.tmpl</a> — The core module: command, kind, routing, tab, envelope validator and handler, the @branch line
│       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/fixture.json.tmpl">fixture.json.tmpl</a> — An invented fixture: payloads every validator accepts or refuses
│       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/index.mjs.tmpl">index.mjs.tmpl</a> — The pack folder's index (BRANCH)
│       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/payload.mjs.tmpl">payload.mjs.tmpl</a> — The pack validator and payload builder, mirroring the core
│       │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/tools/branch-templates/private">private/</a> — The private skill: SKILL.md and its start and finish drivers
│       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/private/finish.mjs.tmpl">finish.mjs.tmpl</a> — Second driver: the judgment → a payload and the exact envelope command
│       │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/private/SKILL.md.tmpl">SKILL.md.tmpl</a> — The skill's purpose, inputs, example envelope, memory and silence rule
│       │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/private/start.mjs.tmpl">start.mjs.tmpl</a> — First driver: the request → the judgment step's input
│       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/README.md.tmpl">README.md.tmpl</a> — The pack folder's README
│       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/schema.json.tmpl">schema.json.tmpl</a> — The payload schema
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/branch-templates/test.js.tmpl">test.js.tmpl</a> — The branch's tests
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/bundle.mjs">bundle.mjs</a>          — Reads packs/&lt;name&gt;/helper.json and emits one Apps Script project from core + pack gas/
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/envelope.mjs">envelope.mjs</a>        — Stamps a mailbox envelope with a real id + clock (same CLI as the first helper)
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/new-branch.mjs">new-branch.mjs</a> — Writes a new branch of a pack (command → request kind → routine → envelope → tab → app); --check verifies any branch
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/new-helper.mjs">new-helper.mjs</a>      — Scaffolds a pack and a private repo from the template
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/README.md">README.md</a> — The tools' longer guides: Branches (the shape, the command, the check, what you still write)
│       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/upload.mjs">upload.mjs</a>        — Routine side of ?route=upload: POSTs a made file, prints the Drive file id
│
<b>─── Repository Information ───────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/repository-information">repository-information/</a>    — [template]
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/REPO-ARCHITECTURE.md">REPO-ARCHITECTURE.md</a>         — [template · initialized] System diagram (Mermaid)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/repository-information/diagrams">diagrams/</a>               — [template] Per-page architecture diagrams
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/diagrams/gas-project-creator-diagram.md">gas-project-creator-diagram.md</a> — [template] GAS Project Creator user flow
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/diagrams/testauthgas1-diagram.md">testauthgas1-diagram.md</a>         — [template] Testauthgas1 page GAS integration sequence (auth)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/diagrams/testauthhtml1-diagram.md">testauthhtml1-diagram.md</a>         — [template] Testauthhtml1 page GAS integration sequence (auth)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/diagrams/MasterACL-diagram.md">MasterACL-diagram.md</a>         — [template] MasterACL page GAS integration sequence
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/diagrams/globalacl-diagram.md">globalacl-diagram.md</a>         — [template] Global ACL page GAS integration sequence
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/CHANGELOG.md">CHANGELOG.md</a>            — [template · initialized] Version history
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/CHANGELOG-archive.md">CHANGELOG-archive.md</a>    — [template · initialized] Older changelog sections (rotated from CHANGELOG.md)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/CLASP-PUSH-PILOT-SETUP.md">CLASP-PUSH-PILOT-SETUP.md</a> — Setup for the GitHub Actions → clasp push deployment pilot
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/CODING-GUIDELINES.md">CODING-GUIDELINES.md</a>    — [template · initialized] Domain-specific coding knowledge
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/DATA-POLL-ARCHITECTURE.md">DATA-POLL-ARCHITECTURE.md</a> — Data poll vs heartbeat architecture &amp; quota reference
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/DEFERRED-GAS-IFRAME-PLAN.md">DEFERRED-GAS-IFRAME-PLAN.md</a> — Deferred GAS-iframe loading plan (design notes)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/GOVERNANCE.md">GOVERNANCE.md</a>           — [template · initialized] Project governance
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/HIPAA-CODING-REQUIREMENTS.md">HIPAA-CODING-REQUIREMENTS.md</a> — Complete HIPAA regulatory reference for coding (Security Rule, Privacy Rule, Breach Notification, 2025 NPRM, implementation checklist)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/IMPROVEMENTS.md">IMPROVEMENTS.md</a>         — [template · initialized] Potential improvements
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/KNOWN-CONSTRAINTS-AND-FIXES.md">KNOWN-CONSTRAINTS-AND-FIXES.md</a>    — Architectural constraints &amp; resolved bug fixes (GAS double-iframe, postMessage, HMAC, deploy webhook)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/PERSONAL-ASSISTANT-RESEARCH.md">PERSONAL-ASSISTANT-RESEARCH.md</a> — Personal assistant AI landscape research (Sept 2026) — products, OSS agents, Claude surfaces &amp; rules, building blocks, security, use cases, stack limits
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/PERSONAL-ASSISTANT-ROADMAP.md">PERSONAL-ASSISTANT-ROADMAP.md</a> — Personal assistant AI recommendations — architecture, phased roadmap, token-dump playbook
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/RULE-COST-AUDIT.md">RULE-COST-AUDIT.md</a>       — Rule cost audit — ranked table, trim-recommendation checklist (T1–T9), progress tracking
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/TOUR-GUIDE-BUILD-PLAN.md">TOUR-GUIDE-BUILD-PLAN.md</a> — Tour Guide helper + shared helper framework — phased build plan (Fable 5.1 · Xhigh) with verified facts and model/effort per phase
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/TODO.md">TODO.md</a>                 — [template · initialized] Actionable to-do items
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/FUTURE-CONSIDERATIONS.md">FUTURE-CONSIDERATIONS.md</a> — [template · modified] Deferred architectural ideas + potential future projects (ranked)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/readme-qr-code.png">readme-qr-code.png</a>             — [template · initialized] QR code linking to this repo
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/REMINDERS.md">REMINDERS.md</a>            — [template] Reminders for Developer (developer's own notes)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/SESSION-CONTEXT.md">SESSION-CONTEXT.md</a>      — [template] Previous Session Context (Claude-written session log)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/SKILLS-REFERENCE.md">SKILLS-REFERENCE.md</a>     — [template] Complete Claude Code skills inventory (custom + imported + bundled)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/repository.version.txt">repository.version.txt</a>  — [template] Repo version (v01.XXr — bumps every push)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/TOKEN-BUDGETS.md">TOKEN-BUDGETS.md</a>        — [template · initialized] Token cost reference for CLAUDE.md
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/SUPPORT.md">SUPPORT.md</a>              — [template · initialized] Getting help
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/repository-information/archive%20info">archive info/</a>         — [template] Archived plans, implementation guides, and design documents
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/01-CUSTOM-AUTH-PATTERN.md">01-CUSTOM-AUTH-PATTERN.md</a> — [template] Custom Auth implementation reference (GAS + custom domain)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/02-GOOGLE-OAUTH-AUTH-PATTERN.md">02-GOOGLE-OAUTH-AUTH-PATTERN.md</a> — [template] Google OAuth (GIS) auth implementation reference
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/03-IMPROVED-GOOGLE-OAUTH-PATTERN.md">03-IMPROVED-GOOGLE-OAUTH-PATTERN.md</a> — [template] Improved Google OAuth pattern with server-side sessions
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md">04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md</a> — [template] Research-validated OAuth pattern (strict origin, re-auth fallback, CacheService caveats)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/05-HIPAA-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md">05-HIPAA-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md</a> — [template] HIPAA-compliant OAuth pattern (audit logging, domain restriction, session integrity)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md">06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md</a> — [template] Unified config-driven auth pattern (toggleable features, standard &amp; HIPAA presets)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md">07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md</a> — [template] Security hardening plan for testauthgas1 (6 phases, implemented)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/08-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md">08-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md</a> — [template] Security update plan II for testauthgas1 (7 phases, 19 vulnerabilities — ready for implementation)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/09-CROSS-DEVICE-SESSION-ENFORCEMENT-PLAN.md">09-CROSS-DEVICE-SESSION-ENFORCEMENT-PLAN.md</a> — [template] Cross-device single-session enforcement plan (6 phases — ready for implementation)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/09.1-CROSS-DEVICE-SESSION-ENFORCEMENT-REVISED-PLAN.md">09.1-CROSS-DEVICE-SESSION-ENFORCEMENT-REVISED-PLAN.md</a> — [template] Revised cross-device enforcement plan (google.script.run approach — zero doGet overhead)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/09.1.1-CROSS-DEVICE-SESSION-ENFORCEMENT-DRIVE-PLAN.md">09.1.1-CROSS-DEVICE-SESSION-ENFORCEMENT-DRIVE-PLAN.md</a> — [template] Drive file approach for cross-device enforcement (zero server polling cost — with caveats)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/09.2-CROSS-DEVICE-SESSION-ENFORCEMENT-HEARTBEAT-PLAN.md">09.2-CROSS-DEVICE-SESSION-ENFORCEMENT-HEARTBEAT-PLAN.md</a> — [template] Heartbeat piggyback approach for cross-device enforcement (zero new polling — simplest mechanism)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/10-EMR-SECURITY-HARDENING-PLAN.md">10-EMR-SECURITY-HARDENING-PLAN.md</a> — [template] EMR security hardening plan — HIPAA technical safeguards for patient data protection
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/10.1-SECURITY-REMEDIATION-GUIDE.md">10.1-SECURITY-REMEDIATION-GUIDE.md</a> — [template] Implementation-ready remediation guide for all security audit findings
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/10.2-CATEGORY3-CODE-IMPLEMENTATION-GUIDE.md">10.2-CATEGORY3-CODE-IMPLEMENTATION-GUIDE.md</a> — [template] Category 3 code implementation guide — phased fixes for 12 must-implement findings
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/10.3-DJB2-TO-HMAC-MIGRATION-PLAN.md">10.3-DJB2-TO-HMAC-MIGRATION-PLAN.md</a> — [template] DJB2 → HMAC-SHA256 migration plan for GAS session HTML messages
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/10.4-SINGLE-LOAD-AUTH-OPTIMIZATION-PLAN.md">10.4-SINGLE-LOAD-AUTH-OPTIMIZATION-PLAN.md</a> — [template] Single-load auth optimization — reduce standard path login from 2 doGet() to 1
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/10.4.1-HIPAA-SINGLE-LOAD-AUTH-OPTIMIZATION-PLAN.md">10.4.1-HIPAA-SINGLE-LOAD-AUTH-OPTIMIZATION-PLAN.md</a> — [template] HIPAA single-load auth optimization — reduce HIPAA path login from 2 doGet() to 1 via innerHTML SPA technique
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/10.4.1-IMPLEMENTATION-FINDINGS.md">10.4.1-IMPLEMENTATION-FINDINGS.md</a> — [template] Implementation findings from 10.4.1 attempt — issues, learnings, and recommendations for future re-attempt
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/11-EMR-GAS-APPLICATION-LAYER-PLAN.md">11-EMR-GAS-APPLICATION-LAYER-PLAN.md</a> — [template] EMR GAS application layer plan — HIPAA data access, RBAC, consent &amp; disclosure
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/12-HIPAA-SSO-IMPLEMENTATION-PLAN.md">12-HIPAA-SSO-IMPLEMENTATION-PLAN.md</a> — [template] HIPAA-compliant SSO plan — portal HIPAA conversion + BroadcastChannel cross-page auth
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/13-SSO-TOKEN-REFRESH-AND-CROSS-TAB-ACTIVITY-PLAN.md">13-SSO-TOKEN-REFRESH-AND-CROSS-TAB-ACTIVITY-PLAN.md</a> — SSO token-refresh coordination (Plan 12 Phase 6) + cross-tab activity keepalive spec
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/AUTH-DIRECT-ACCESS-FIX.md">AUTH-DIRECT-ACCESS-FIX.md</a> — Troubleshooting write-up: fixing direct URL access to authenticated GAS apps (12 attempts, root causes, final fix)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/GAS-TEST-FUNCTIONS-REFERENCE.md">GAS-TEST-FUNCTIONS-REFERENCE.md</a> — [template] Archived test/diagnostic GAS functions for reference (6 functions with code blocks)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/HIPAA-COMPLIANCE-REFERENCE.md">HIPAA-COMPLIANCE-REFERENCE.md</a> — [Superseded] HIPAA Security Rule compliance reference (all safeguards, implementation status)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/HIPAA-PHASE-A-IMPLEMENTATION-GUIDE.md">HIPAA-PHASE-A-IMPLEMENTATION-GUIDE.md</a> — Phase A implementation guide (Privacy Rule: #19 Disclosure Accounting, #23 Right of Access, #24 Right to Amendment)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/HIPAA-PHASE-B-IMPLEMENTATION-GUIDE.md">HIPAA-PHASE-B-IMPLEMENTATION-GUIDE.md</a> — Phase B implementation guide (Extensions: #19b Grouped Disclosures, #23b Summary Export, #24b Amendment Notifications, #18 Retention, #28 Breach Detection, #31 Breach Logging, #25 Representatives)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/HIPAA-PHASE-C-IMPLEMENTATION-GUIDE.md">HIPAA-PHASE-C-IMPLEMENTATION-GUIDE.md</a> — Phase C implementation guide (Retention Deep Dive: #18 Last-in-Effect Date, #18b Legal Hold, Compliance Audit, Archive Integrity, Policy Documentation)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/HIPAA-TESTAUTHGAS1-ANALYSIS.md">HIPAA-TESTAUTHGAS1-ANALYSIS.md</a> — Deep compliance analysis: all 40 checklist items vs actual code (v01.00g, v01.00w)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/HIPAA-TESTAUTHGAS1-COMPLIANCE-REPORT.md">HIPAA-TESTAUTHGAS1-COMPLIANCE-REPORT.md</a> — testauthgas1 HIPAA compliance assessment (40 items evaluated, gaps &amp; strengths)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/HIPAA-TESTAUTHGAS1-IMPLEMENTATION-FOLLOWUP.md">HIPAA-TESTAUTHGAS1-IMPLEMENTATION-FOLLOWUP.md</a> — Follow-up compliance progress (v01.00g→v01.00g, v01.00w→v01.00w, updated scorecard &amp; gap analysis)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/MICROSOFT-AUTH-PLAN.md">MICROSOFT-AUTH-PLAN.md</a> — [template] Microsoft auth implementation plan (MSAL.js + Azure AD)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/SESSION-MANAGER-PLAN.md">SESSION-MANAGER-PLAN.md</a> — [template] Cross-project Session Manager implementation plan (reverted)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/TEMPLATE-UPDATE-PLAN.md">TEMPLATE-UPDATE-PLAN.md</a> — [template] Phased plan to sync auth templates with testauthgas1
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/archive%20info/pending-close-design-doc.md">pending-close-design-doc.md</a> — [Deferred] Server-side session invalidation on tab close (sendBeacon + pendingClose pattern)
│
<b>─── Claude Code ──────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/blob/main/CLAUDE.md">CLAUDE.md</a>                   — [template · initialized] Developer instructions
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude">.claude/</a>                   — [template]
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/settings.json">settings.json</a>           — [template · modified] Claude Code project settings (permissions + Stop hook wiring)
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/agents">agents/</a>                 — Build agents for the helper framework (model, effort, disallowedTools per role)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/agents/hb-architect.md">hb-architect.md</a>     — Fable 5.1 · xhigh — foundation, phase coordination, integration review
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/agents/hb-builder-fable.md">hb-builder-fable.md</a> — Fable 5.1 · high — judgment-heavy work packages (design, solver)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/agents/hb-builder-opus.md">hb-builder-opus.md</a>  — Opus 5.5 · high — well-specified work packages
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/agents/hb-builder-opus-medium.md">hb-builder-opus-medium.md</a> — Opus 5.5 · medium — well-specified work packages with a tight spec
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/agents/hb-reader.md">hb-reader.md</a>        — Fable 5.1 · high — read-only connector reader; no shell, web or account writes
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/hooks">hooks/</a>                  — Repo-tracked Claude Code hooks, wired via settings.json
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/hooks/stop-hook-git-check.sh">stop-hook-git-check.sh</a> — Stop event: checks for uncommitted/untracked/unpushed work; runs `git fetch --prune` first to avoid stale-ref false positives
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/rules">rules/</a>                  — [template] Always-loaded + path-scoped rules
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/behavioral-rules.md">behavioral-rules.md</a>        — [template · modified] Always loaded — execution style, pushback, etc.
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/changelog-security.md">changelog-security.md</a>     — [template · initialized] Path-scoped — HIPAA/PHI + attack-surface rules for public changelogs
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/changelogs.md">changelogs.md</a>              — [template · initialized · modified] Path-scoped — CHANGELOG rules
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/chat-bookends.md">chat-bookends.md</a>           — [template · modified] Always loaded — response formatting rules
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/chat-bookends-reference.md">chat-bookends-reference.md</a> — [template] Path-scoped — bookend examples &amp; tables
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/cli-styling-reference.md">cli-styling-reference.md</a>   — Path-scoped — CLI accent styling tables + patterns (triggers on chat-bookends.md + output-formatting.md + CLAUDE.md)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/dead-code-detection.md">dead-code-detection.md</a>     — Path-scoped — dead-code analysis methodology (triggers on HTML pages + GAS files + workflow files; user-invoked via "check for dead code")
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/gas-scripts.md">gas-scripts.md</a>             — [template · modified] Path-scoped — GAS core rules (version, config, commit naming, Deploy Handler Protection)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/gas-scripts-reference.md">gas-scripts-reference.md</a>   — Path-scoped — GAS reference material (architecture, setup, webhook, live version check, partial OAuth grants, Google multi-account routing, templates, UI, visual verification)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/html-pages.md">html-pages.md</a>             — [template · modified] Path-scoped — HTML page core rules (build version, private repo, template propagation, test quality, auth wall)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/html-pages-reference.md">html-pages-reference.md</a>   — Path-scoped — HTML page reference (setup, rename, directory structure, Template vs Project Code Separation, visual verification)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/imported-skills.md">imported-skills.md</a>         — Path-scoped — "Imported Skills — Do Not Modify" rule (triggers on `.claude/skills/imported--*/**`)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/init-scripts.md">init-scripts.md</a>           — [template] Path-scoped — init script rules
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/mermaid-diagrams.md">mermaid-diagrams.md</a>        — [template · initialized] Path-scoped — deep mermaid reference (rendering + pako URL encoding)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/output-formatting.md">output-formatting.md</a>      — [template · modified] Always loaded — CLI styling quick rule, attribution, reminders format
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/pre-commit-gates.md">pre-commit-gates.md</a>        — [template · initialized] Path-scoped — full TEMPLATE REPO / MULTI-SESSION gate logic
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/repo-docs.md">repo-docs.md</a>              — [template · initialized · modified] Path-scoped — documentation rules
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/rule-management.md">rule-management.md</a>         — Path-scoped — Rule Placement Autonomy + Rule Precedence + Section Placement Guide (triggers on CLAUDE.md + `.claude/rules/**`)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/rules-maintenance.md">rules-maintenance.md</a>       — Path-scoped — Diff Rules + Repo Audit command bodies (triggers on CLAUDE.md + `.claude/rules/**`)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/visual-test-command.md">visual-test-command.md</a>     — Path-scoped — Visual Test command body (triggers on HTML pages + GAS files)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/rules/workflows.md">workflows.md</a>              — [template] Path-scoped — workflow rules
│   │
│   <b>│ ─ Skills ────────────────────────────────────────────────────────────────</b>
│   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills">skills/</a>                  — [template] Invokable workflow skills
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/imported--diff-review">imported--diff-review/</a>       — [template] /diff-review — pre-push differential review
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/imported--diff-review/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/imported--frontend-design">imported--frontend-design/</a>   — [template] /frontend-design — distinctive UI creation
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/imported--frontend-design/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/imported--git-cleanup">imported--git-cleanup/</a>       — [template] /git-cleanup — stale branch/worktree cleanup
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/imported--git-cleanup/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/imported--security-review">imported--security-review/</a>   — [template] /security-review — OWASP/web security audit
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/imported--security-review/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/imported--skill-creator">imported--skill-creator/</a>     — [template] /skill-creator — create new skills
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/imported--skill-creator/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/imported--webapp-testing">imported--webapp-testing/</a>    — [template] /webapp-testing — Playwright page testing
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/imported--webapp-testing/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/initialize">initialize/</a>          — [template] /initialize — first deployment setup
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/initialize/SKILL.md">SKILL.md</a>        — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/maintenance-mode">maintenance-mode/</a>    — [template] /maintenance-mode — toggle maintenance overlay
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/maintenance-mode/SKILL.md">SKILL.md</a>        — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/new-page">new-page/</a>            — [template] /new-page — create new HTML page with boilerplate
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/new-page/SKILL.md">SKILL.md</a>        — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/phantom-update">phantom-update/</a>      — [template] /phantom-update — timestamp alignment
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/phantom-update/SKILL.md">SKILL.md</a>        — [template]
│       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/reconcile">reconcile/</a>           — [template] /reconcile — end multi-session mode
│       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/reconcile/SKILL.md">SKILL.md</a>        — [template]
│       └── <a href="https://github.com/LightAISolutions/Personal/tree/main/.claude/skills/remember-session">remember-session/</a>    — [template] /remember-session — save session context
│           └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.claude/skills/remember-session/SKILL.md">SKILL.md</a>        — [template]
│
<b>─── GitHub Configuration ─────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.github">.github/</a>                   — [template]
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.github/workflows">workflows/</a>              — [template] CI/CD pipeline
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/workflows/auto-merge-claude.yml">auto-merge-claude.yml</a> — [template · initialized] Auto-merge, GAS deploy, Pages deploy, library mirror
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/workflows/clasp-deploy-pilot.yml">clasp-deploy-pilot.yml</a> — clasp push deployment pilot
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/workflows/deploy-helper.yml">deploy-helper.yml</a> — Bundle + clasp push/deploy per helper pack on main (production environment, pinned deployment)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/workflows/helpers-ci.yml">helpers-ci.yml</a> — Tests + bundle check + boundary check on every push touching helpers/
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/workflows/helpers-dist.yml">helpers-dist.yml</a> — Publishes helpers/ as the helpers-dist branch after each merge to main
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/.github/ISSUE_TEMPLATE">ISSUE_TEMPLATE/</a>         — [template] Bug report &amp; feature request forms
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/ISSUE_TEMPLATE/bug_report.yml">bug_report.yml</a> — [template · initialized] Bug report form
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/ISSUE_TEMPLATE/feature_request.yml">feature_request.yml</a> — [template · initialized] Feature request form
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/ISSUE_TEMPLATE/config.yml">config.yml</a> — [template · initialized] Issue chooser config
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/PULL_REQUEST_TEMPLATE.md">PULL_REQUEST_TEMPLATE.md</a> — [template · initialized] PR checklist
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/FUNDING.yml">FUNDING.yml</a>             — [template · initialized] Sponsor button config
│   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/.github/last-processed-commit.sha">last-processed-commit.sha</a> — [template] Inherited branch guard (commit SHA tracking)
│
<b>─── Configuration ────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.gitattributes">.gitattributes</a>              — [template] Line ending normalization (LF)
├── <a href="https://github.com/LightAISolutions/Personal/blob/main/.editorconfig">.editorconfig</a>               — [template] Editor formatting rules (indent, charset, EOL)
└── <a href="https://github.com/LightAISolutions/Personal/blob/main/.gitignore">.gitignore</a>                  — [template] Git ignore patterns
│
<b>─── Community ────────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Personal/blob/main/CITATION.cff">CITATION.cff</a>                — [template · initialized] Citation metadata
├── <a href="https://github.com/LightAISolutions/Personal/blob/main/CODE_OF_CONDUCT.md">CODE_OF_CONDUCT.md</a>          — [template · initialized] Community standards
├── <a href="https://github.com/LightAISolutions/Personal/blob/main/CONTRIBUTING.md">CONTRIBUTING.md</a>             — [template · initialized] How to contribute
├── <a href="https://github.com/LightAISolutions/Personal/blob/main/LICENSE.md">LICENSE.md</a>                  — [template · initialized] Proprietary license
├── <a href="https://github.com/LightAISolutions/Personal/blob/main/SECURITY.md">SECURITY.md</a>                 — [template · initialized] Vulnerability reporting
└── <a href="https://github.com/LightAISolutions/Personal/blob/main/README.md">README.md</a>                   — [template · initialized] This file — project overview &amp; structure
</pre>

## Commands

<sub>[Back to Table of Contents](#table-of-contents)</sub>

> **Tip:** Links below navigate away from this page. **Ctrl + click** (or right-click → *Open in new tab*) to keep this ReadMe visible while you work.

All commands are invoked as slash commands in [Claude Code](https://github.com/anthropics/claude-code) or by typing the command name conversationally (e.g. "initialize", "remember session").

### Repo Workflow Commands

| Command | Origin | Description |
|---------|--------|-------------|
| [`/initialize`](.claude/skills/initialize/SKILL.md) | Custom | First deployment setup — resolves template placeholders, deploys to GitHub Pages |
| [`/new-page`](.claude/skills/new-page/SKILL.md) `<project-name>` | Custom | Create a new HTML page with full boilerplate (version polling, splash, auto-refresh) |
| [`/maintenance-mode`](.claude/skills/maintenance-mode/SKILL.md) `<page> <on\|off>` | Custom | Toggle maintenance overlay on/off for specific pages on the live site |
| [`/phantom-update`](.claude/skills/phantom-update/SKILL.md) | Custom | Timestamp alignment — touch every file so all share the same commit timestamp on GitHub |
| `setup gas project` | Custom | Create a new GAS project from config — run by pasting output from the Copy Config for Claude button |
| [`/remember-session`](.claude/skills/remember-session/SKILL.md) | Custom | Save session context so the next Claude session picks up where you left off |
| [`/reconcile`](.claude/skills/reconcile/SKILL.md) | Custom | End multi-session mode — bundle accumulated changes into versioned changelog sections |
| `diff rules` | Custom | Compare this fork's rules against the template repo to find additions, modifications, and upstream changes |
| `repo audit` | Custom | Comprehensive cross-system consistency audit of the entire repository |

### Code Quality Commands

| Command | Origin | Description |
|---------|--------|-------------|
| [`/diff-review`](.claude/skills/imported--diff-review/SKILL.md) | Imported | Security-focused differential review of staged changes before pushing |
| [`/security-review`](.claude/skills/imported--security-review/SKILL.md) | Imported | OWASP Top 10, XSS, and insecure defaults audit for HTML and GAS code |
| [`/webapp-testing`](.claude/skills/imported--webapp-testing/SKILL.md) | Imported | Playwright-based testing for live pages — screenshots, browser logs, UI verification |
| `/simplify` | Bundled | Review changed code for reuse, quality, and efficiency, then fix any issues found |

### Design & Tooling Commands

| Command | Origin | Description |
|---------|--------|-------------|
| [`/frontend-design`](.claude/skills/imported--frontend-design/SKILL.md) | Imported | Create distinctive, production-grade frontend interfaces with high design quality |
| [`/skill-creator`](.claude/skills/imported--skill-creator/SKILL.md) | Imported | Meta-skill for building and refining new Claude Code skills |
| [`/git-cleanup`](.claude/skills/imported--git-cleanup/SKILL.md) | Imported | Clean up stale branches, worktrees, and `claude/*` artifacts |

## How It Works

<sub>[Back to Table of Contents](#table-of-contents)</sub>

### Auto-Refresh via Version Polling
Every hosted page polls a lightweight `html.version.txt` file (from `live-site-pages/html-versions/`) every 10 seconds. When a new version is deployed, the page detects the mismatch and auto-reloads — showing a green "Website Ready" splash with audio feedback. A blue "Code Ready" splash plays when GAS script updates are detected.

### CI/CD Auto-Merge Flow
1. Push to a `claude/*` branch
2. GitHub Actions automatically merges into `main`, deploys to GitHub Pages, and cleans up the branch
3. No pull requests needed — the workflow handles everything

### GAS Embedding Architecture
Google Apps Script projects are embedded as iframes in GitHub Pages. The framework handles:

&emsp;Automatic GAS deployment via `doPost` when `.gs` files change<br>
&emsp;"Code Ready" blue splash on GAS updates (client-side polling)<br>
&emsp;Google Sign-In from the parent page (stable OAuth origin)

## GCP Project Setup & Troubleshooting

<sub>[Back to Table of Contents](#table-of-contents)</sub>

> **Tip:** Links below navigate away from this page. **Ctrl + click** (or right-click → *Open in new tab*) to keep this ReadMe visible while you work.

Each GAS web app deployment requires a Google Cloud Platform (GCP) project. To set up:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a **new project**
2. **Critical**: set the project **Location** to your organization root or "No organization" — do **not** place it inside any managed folder
3. Copy the **project number** (not project ID) from the project dashboard
4. In the GCP project, enable the **Apps Script API**: APIs & Services → Library → search "Apps Script API" → Enable
5. In Apps Script, go to Project Settings (gear icon) → Google Cloud Platform (GCP) Project → Change project → paste the project number

### "You cannot switch to a Cloud Platform project in an Apps Script-managed folder"

This error occurs when the GCP project you're targeting lives inside Google's hidden `apps-script` managed folder (`organization → system-gsuite → apps-script`). Even projects created from [console.cloud.google.com](https://console.cloud.google.com/) can end up there on Workspace accounts.

**How to diagnose:**
1. Go to [Google Cloud Console → Manage Resources](https://console.cloud.google.com/cloud-resource-manager)
2. Look for a folder hierarchy: **your org → system-gsuite → apps-script**
3. If your GCP project is inside the `apps-script` folder, that's the problem

**How to fix — Option A (move the project):**

Moving a project out of the managed folder requires the **Project Mover** IAM role, which you likely don't have by default — even as the organization owner/admin.

1. Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam) → use the top dropdown to select your **organization** (not a project or folder)
2. Click **Grant Access** → enter your own email
3. In "Select a role" → **Resource Manager** → **Project Mover** → **Save**
4. Go to [Manage Resources](https://console.cloud.google.com/cloud-resource-manager) → find your project inside the `apps-script` folder
5. Click the three-dot menu → **Migrate**
6. Move it to your organization root or "No organization"
7. Retry changing the GCP project in Apps Script settings

**How to fix — Option B (create a new project):**
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a new project
2. When setting the **Location**, explicitly choose your organization root or "No organization"
3. Verify the project number does **not** start with `sys-` (those are auto-created default projects and won't work)
4. Enable the Apps Script API in the new project
5. Use this project's number in Apps Script settings

**Key requirements:**
- The GCP project must be a **manually created, standard project** — not an auto-generated one
- It must live **outside** the `system-gsuite → apps-script` managed folder
- Project numbers starting with `sys-` are auto-created defaults and cannot be used
- You need **Project Browser** and **OAuth Config Editor** roles (or equivalent) on the project
- Moving projects requires the **Project Mover** role (`roles/resourcemanager.projectMover`) granted at the **organization level** — even org owners/admins don't have this by default
- Switching from a default project to a standard project is one-way — you cannot switch back
- On Google Workspace accounts, the GCP project must be in the **same Cloud Organization** as the script owner, just not inside the managed folder

### "Apps Script API has not been used in project X"

This error means the Apps Script API is not enabled in the GCP project associated with your script. Fix:
1. Note the project number from the error message
2. Go to [Google Cloud Console](https://console.cloud.google.com/) → select that project
3. APIs & Services → Library → search "Apps Script API" → **Enable**
4. If the project number doesn't match any project you own, your script is using a default GCP project that you can't access — follow the "cannot switch" fix above to assign your own GCP project first

Developed by: LightAISolutions
