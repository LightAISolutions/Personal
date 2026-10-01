# ​‌‌‌‌‌‌‌​​‌‌‌‌‌​ReadMe - Personal

A GitHub Pages deployment framework with automatic version polling, auto-refresh, and Google Apps Script (GAS) embedding support.

Last updated: `2026-10-01 03:27:41 AM EST` · Repo version: `v01.18r`

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
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/core/14_setup.js">14_setup.js</a>         — Owner setup page (?route=setup&amp;k=ADMIN_SECRET) and printSetupUrl()
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/decisions">decisions/</a>              — One decisions file per phase / work package
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-0.md">TG-PHASE-0.md</a>       — Phase 0: the thirteen owner decisions, owner actions, session findings
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-1.md">TG-PHASE-1.md</a>       — Phase 1: scrub report (owner gate), subtree decision, every default chosen
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-2.md">TG-PHASE-2.md</a>       — Phase 2: coordinator defaults, findings, brochure rating
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-3.md">TG-PHASE-3.md</a>   — Phase 3: coordinator defaults, ownership-map extension, solver design and limits, requests carried
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/TG-PHASE-4.md">TG-PHASE-4.md</a>   — Phase 4: coordinator defaults, request-kind contract, payloads, Drive and memory layout, drivers, routine table, "For Phase 4b"
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2a.md">WP-2a.md</a>            — WP-2a Maps kit: defaults, Maps terms finding, credential header, live smoke results
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2b.md">WP-2b.md</a>            — WP-2b Research kit: defaults (budgets, independence, labels, scanner)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2c.md">WP-2c.md</a>            — WP-2c Brochure kit: defaults, design rationale, Playwright for routines
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2d.md">WP-2d.md</a>            — WP-2d Prefs kit: defaults (formats, review payload, invariants)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-2e.md">WP-2e.md</a> — WP-2e real Google maps and place photos in the brochure: defaults, terms, costs
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-3a.md">WP-3a.md</a>        — WP-3a schemas / estimator / Later / fixtures: defaults and fixture design
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-3b.md">WP-3b.md</a>        — WP-3b planner + solver: defaults, solver limits, the booked-stop wait rule
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-3c.md">WP-3c.md</a>        — WP-3c brochure map: defaults, what the brochure shows and hides
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-4a.md">WP-4a.md</a>        — WP-4a trip-research + plan-days: defaults, the Phase 4 delta (statuses, choices, chaining, shortlist, intake)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-4b.md">WP-4b.md</a>        — WP-4b prefs-build + place-notes + brochure-build: defaults, interview answers
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/WP-4c.md">WP-4c.md</a>        — WP-4c chat + trip-check + routine table: defaults (request check, hand-offs, Enterprise tier, change codes)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/decisions/hidden-gems-proposal.md">hidden-gems-proposal.md</a> — Hidden gems: the sweep idea evaluated against other methods, the Gem Funnel recommendation, costs, plan changes implied, decisions 18–22
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
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/fixtures/sample-trip.json">sample-trip.json</a> — Invented 3-day trip on reserved domains (the sample brochure)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/index.mjs">index.mjs</a>       — Library exports + CLI (validate, render, build, sample)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/brochure/lib">lib/</a>            — Implementation, one concern per file
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/art.mjs">art.mjs</a>     — Decorative contour art and ornaments generated from data
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/css.mjs">css.mjs</a>     — The stylesheet, assembled from per-section parts
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/escape.mjs">escape.mjs</a>  — Escaping and URL safety: model text is always data
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/fonts.mjs">fonts.mjs</a>   — Embeds the Charter faces as data URIs
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/format.mjs">format.mjs</a>  — Dates, times and durations on the trip's wall clock
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
│   │   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sections/practical.mjs">practical.mjs</a> — Practical information blocks
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/sketch.mjs">sketch.mjs</a>  — Route sketch drawn as SVG from coordinates (fallback without a Google map) and the shared markers
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/tokens.mjs">tokens.mjs</a>  — Design tokens: type scale, ink, accent, day hues
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/lib/validate.mjs">validate.mjs</a> — Minimal JSON Schema validator
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/README.md">README.md</a>       — Contract: model schema, commands, pagination, attribution rules, what routines need (Playwright)
│   │   │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/brochure/schema">schema/</a>         — JSON Schemas
│   │   │       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/brochure/schema/brochure.schema.json">brochure.schema.json</a> — The brochure input model
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/maps">maps/</a>               — Places API (New) + Routes API client: fixed masks, SKU ledger with a hard stop, snapshot purge, Maps URLs
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/maps/fixtures">fixtures/</a>       — Hand-written responses in the real API shapes (invented city)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-compute-routes-optimized.json">maps-fixture-compute-routes-optimized.json</a> — Compute Routes with optimizeWaypointOrder
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-compute-routes-transit.json">maps-fixture-compute-routes-transit.json</a> — Compute Routes, TRANSIT
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-compute-routes-walk.json">maps-fixture-compute-routes-walk.json</a> — Compute Routes, WALK
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-error-403.json">maps-fixture-error-403.json</a> — An upstream 403 error body
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-place-details-enterprise.json">maps-fixture-place-details-enterprise.json</a> — Place Details, Enterprise mask
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-route-matrix.json">maps-fixture-route-matrix.json</a> — Compute Route Matrix elements
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/fixtures/maps-fixture-text-search-pro.json">maps-fixture-text-search-pro.json</a> — Text Search, Pro mask
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/maps/index.mjs">index.mjs</a>       — Library exports + CLI (masks, usage, purge, url, details, search, route, matrix, smoke --live)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/maps/lib">lib/</a>            — Implementation, one concern per file
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
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/fixtures/evidence-sample.json">evidence-sample.json</a> — Sample evidence, with one planted injection
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/index.mjs">index.mjs</a>       — Library exports + CLI (check, ingest, review, apply)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/prefs/lib">lib/</a>            — Implementation, one concern per file
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/candidates.mjs">candidates.mjs</a> — Groups evidence into candidate preferences with support and conflicts
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/confirmed-prefs.mjs">confirmed-prefs.mjs</a> — The owner's decision ledger and the confirmed-preferences document (size-capped)
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/decisions.mjs">decisions.mjs</a> — Owner decisions: the only input that can change the profile
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/evidence.mjs">evidence.mjs</a> — Evidence records: validation, hashed source refs, sanitized excerpts, injection flag
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/held-notes.mjs">held-notes.mjs</a> — One Markdown held note per candidate in a caller-named directory
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/review.mjs">review.mjs</a>  — The ✅ / ✏️ / ❌ review payload, sized for Telegram
│   │   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/util.mjs">util.mjs</a>    — Hashing, normalization, slugs, text sanitizing, token estimate
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/lib/vocab.mjs">vocab.mjs</a>   — Caller-supplied preference vocabulary
│   │   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/kits/prefs/presets">presets/</a>        — Named vocabularies
│   │   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/kits/prefs/presets/travel.vocab.json">travel.vocab.json</a> — Travel vocabulary (pace, interests, food, budget, mobility, crowds, …)
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
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-cards.mjs">brochure-map-cards.mjs</a> — Place cards: notes, hours today, one credited review
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-days.mjs">brochure-map-days.mjs</a> — Day spreads: stops, legs, meals, free time, warnings
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-later.mjs">brochure-map-later.mjs</a> — Saved-for-later lists with reasons
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-practical.mjs">brochure-map-practical.mjs</a> — Practical blocks: lodging, transit, bookings
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-sample.mjs">brochure-map-sample.mjs</a> — Renders a fixture end to end (preview helper)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/brochure-map-text.mjs">brochure-map-text.mjs</a> — Text helpers: clipping, joining, wall-clock labels
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/brochure-map/index.mjs">index.mjs</a>       — toBrochureModel, renderPlan, renderPlanPdf
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/estimator">estimator/</a>      — Visit-duration estimator (WP-3a): sources → minutes → calibration
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/estimator-build.mjs">estimator-build.mjs</a> — buildEstimate from notes, snapshot and category defaults
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/estimator-calibration.mjs">estimator-calibration.mjs</a> — createCalibration, applyTap, calibrationFactor
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/estimator-defaults.mjs">estimator-defaults.mjs</a> — Per-category default ranges
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/estimator-minutes.mjs">estimator-minutes.mjs</a> — chooseMinutes with pace and calibration
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/estimator/index.mjs">index.mjs</a>       — Estimator exports
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures">fixtures/</a>       — Two invented trips with replayed Maps answers (no network)
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
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/index.mjs">index.mjs</a>       — Fixture exports
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/fixtures/transit-city">transit-city/</a>   — Three-day TRANSIT city break, reserved domains
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-calibration.json">tg-fixture-transit-city-calibration.json</a> — Calibration state (per-category taps)
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-estimates.json">tg-fixture-transit-city-estimates.json</a> — Visit estimates per place
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-notes.json">tg-fixture-transit-city-notes.json</a> — Place notes from invented sources
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-places.json">tg-fixture-transit-city-places.json</a> — Places with invented Google place ids
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-profile.json">tg-fixture-transit-city-profile.json</a> — Profile excerpt (pace, meals, interests)
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-routes.json">tg-fixture-transit-city-routes.json</a> — Route Matrix + Compute Routes answers the responder replays
│   │       │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-snapshots.json">tg-fixture-transit-city-snapshots.json</a> — Google snapshots in the Maps kit shape (hours, rating)
│   │       │       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/fixtures/transit-city/tg-fixture-transit-city-trip.json">tg-fixture-transit-city-trip.json</a> — The trip: dates, lodging, mode, bookings
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/gas">gas/</a>            — Pack-side Apps Script (empty until Phase 5)
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/gas/.gitkeep">.gitkeep</a>        — Keeps the directory
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/helper.json">helper.json</a>     — Pack manifest: name, drive root, memory dirs, timezone default
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/later">later/</a>          — Saved-for-later lists (WP-3a)
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/later/index.mjs">index.mjs</a>       — Later exports
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/later/later-lists.mjs">later-lists.mjs</a> — createLists, addItem
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/later/later-moves.mjs">later-moves.mjs</a> — promote (→ affected_days) and demote
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/planner">planner/</a>        — Day planner + exact solver (WP-3b): matrix → order → real legs → DayPlan
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/index.mjs">index.mjs</a>       — planTrip, replanDays, estimateBudget, PlanBudgetError, hoursOn, dateRange
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-assign.mjs">planner-assign.mjs</a> — Assigns candidates to dates by hours, bookings and geography
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-budget.mjs">planner-budget.mjs</a> — SKU budget estimate and the ceiling check before any call
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-day.mjs">planner-day.mjs</a> — One date end to end: matrix, solve, real legs, retime, cross-check
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-geo.mjs">planner-geo.mjs</a> — Haversine distances and the too_far rule
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-hours.mjs">planner-hours.mjs</a> — Opening windows per date from the snapshot; earliestFit
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-input.mjs">planner-input.mjs</a> — Normalises trip, places, estimates and profile into candidates
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-later.mjs">planner-later.mjs</a> — Collects dropped candidates into Later lists with codes
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-legs.mjs">planner-legs.mjs</a> — Maps kit calls: route matrix, one leg, cross-check, Maps URLs
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-rng.mjs">planner-rng.mjs</a> — Seeded RNG for deterministic tie-breaks
│   │       │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-solve.mjs">planner-solve.mjs</a> — Held-Karp with time windows, bookings and the lunch slot
│   │       │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/planner/planner-time.mjs">planner-time.mjs</a> — Minutes-of-day helpers and local → ISO times
│   │       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/README.md">README.md</a>       — Pack contract: schemas, estimator, Later, fixtures, planner, brochure map, what it never does
│   │       └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/packs/tour-guide/schemas">schemas/</a>        — JSON Schemas for every entity + semantic checks (WP-3a)
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/index.mjs">index.mjs</a>       — validate(entity, kind) → { ok, errors }
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-calibration.schema.json">tour-guide-calibration.schema.json</a> — Calibration state
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-checks.mjs">tour-guide-checks.mjs</a> — Cross-field checks the schema cannot express
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-dates.mjs">tour-guide-dates.mjs</a> — Date and time-of-day validation
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-day-plan.schema.json">tour-guide-day-plan.schema.json</a> — DayPlan
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-google-snapshot.schema.json">tour-guide-google-snapshot.schema.json</a> — GoogleSnapshot (as the Maps kit emits it)
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-later-list.schema.json">tour-guide-later-list.schema.json</a> — LaterList
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-place-note.schema.json">tour-guide-place-note.schema.json</a> — PlaceNote
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-place.schema.json">tour-guide-place.schema.json</a> — Place
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-plan.schema.json">tour-guide-plan.schema.json</a> — Plan (days, Later lists, budget, usage)
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-profile-excerpt.schema.json">tour-guide-profile-excerpt.schema.json</a> — Profile excerpt
│   │           ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-trip.schema.json">tour-guide-trip.schema.json</a> — Trip
│   │           └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/packs/tour-guide/schemas/tour-guide-visit-estimate.schema.json">tour-guide-visit-estimate.schema.json</a> — VisitEstimate
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/prompts">prompts/</a>                — The prompt each phase's session starts from
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-1.md">TG-PHASE-1.md</a>       — Phase 1 kickoff: helper framework foundation (Fable 5.1 · Xhigh)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-2.md">TG-PHASE-2.md</a>       — Phase 2 kickoff: shared kits 2a–2d in worktrees (coordinator Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-3.md">TG-PHASE-3.md</a>       — Phase 3 kickoff: Tour Guide engine (solver Fable 5.1 · high, rest Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-4.md">TG-PHASE-4.md</a>   — Phase 4 kickoff: private repo, memory, trip-research and plan-days (Fable 5.1 · high; rest Opus 5.5 · high)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-4-DELTA.md">TG-PHASE-4-DELTA.md</a> — Phase 4 delta for the running session: plan picks/later/skip/deliverables, shortlist, intake, interview answers, hand-off to 4b
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-4B.md">TG-PHASE-4B.md</a>  — Phase 4b kickoff: core flows + document delivery, prefs interview, engine choices and envelope types, skill deltas (Fable 5.1 · high)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/prompts/TG-PHASE-5.md">TG-PHASE-5.md</a>       — Phase 5 kickoff: Telegram commands, /interview and /plan flows, envelope handlers, sheets (Opus 5.5 · high)
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/README.md">README.md</a>               — Framework overview, "how to add a helper", the public/private rules
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/SPEC.md">SPEC.md</a>                 — Framework contract v1 — envelope, mailbox, wake route, manifest, registries, properties, sheet, limits, ownership map
│   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/status">status/</a>                 — One status file per work package
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2a.md">WP-2a.md</a>            — WP-2a progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2b.md">WP-2b.md</a>            — WP-2b progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2c.md">WP-2c.md</a>            — WP-2c progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-2d.md">WP-2d.md</a>            — WP-2d progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-3a.md">WP-3a.md</a>        — WP-3a progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-3b.md">WP-3b.md</a>        — WP-3b progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-3c.md">WP-3c.md</a>        — WP-3c progress and requests to the coordinator
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-4a.md">WP-4a.md</a>        — WP-4a progress, dry runs and requests (generic copy from the private repo)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-4b.md">WP-4b.md</a>        — WP-4b progress, dry runs and requests (generic copy from the private repo)
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/status/WP-4c.md">WP-4c.md</a>        — WP-4c progress, dry runs, memory-merge experiment and requests (generic copy from the private repo)
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
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_config.test.js">core_config.test.js</a> — 00_config.js — manifest merge, prefixed property names, time zone, secret redaction
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_executor.test.js">core_executor.test.js</a> — 07_executor.js + 08_actions_builtin.js — proposals, ✅ gate, dedupe, expiry, cap
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_mailbox.test.js">core_mailbox.test.js</a> — 09_mailbox.js — envelope validation, dispatch, archive folders, dedupe, snapshot, pruning
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_queue.test.js">core_queue.test.js</a>  — 06_queue.js — one worker trigger per enqueue, retries, dead letters, pruning
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_registry.test.js">core_registry.test.js</a> — 02_registry.js — validation, duplicates, allowlist gating
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_router.test.js">core_router.test.js</a> — 10_router.js + 11_commands_builtin.js — webhook auth, pairing, commands, free text → request, callbacks, lock
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_setup.test.js">core_setup.test.js</a>  — 14_setup.js — admin-secret gate, every setup action, pack steps
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_store.test.js">core_store.test.js</a>  — 03_store.js + 04_audit.js — header-mapped rows, settings, daily counters, pack sheets
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/core_wake.test.js">core_wake.test.js</a>   — 12_wake.js + 13_routines.js — wake route, sweeps, one-off triggers, request lifecycle, daily jobs
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/tests/harness">harness/</a>
│   │   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/harness/gas-mocks.js">gas-mocks.js</a>    — In-memory Apps Script mocks + loader (Properties, Cache, Lock, Drive, Spreadsheet, UrlFetch, triggers)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/index.js">index.js</a>            — Loads every *.test.js in this directory
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_cli.test.js">kit_brochure_cli.test.js</a> — Brochure kit: CLI exit codes, build without Playwright
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_google_images.test.js">kit_brochure_google_images.test.js</a> — Brochure kit: Google maps, photos, projection and overlay
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_render.test.js">kit_brochure_render.test.js</a> — Brochure kit: self-contained render, hostile strings escaped
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_sketch.test.js">kit_brochure_sketch.test.js</a> — Brochure kit: route sketch projection and drawing
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_brochure_validate.test.js">kit_brochure_validate.test.js</a> — Brochure kit: schema and semantic checks on the model
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_client.test.js">kit_maps_client.test.js</a> — Maps kit: masks bill their SKU, Places and Routes calls, matrix caps
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_ledger.test.js">kit_maps_ledger.test.js</a> — Maps kit: SKU ledger and hard stop
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_static_photos.test.js">kit_maps_static_photos.test.js</a> — Maps kit: Static Maps (key handling, limits, signing) and Place Photos
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_transport.test.js">kit_maps_transport.test.js</a> — Maps kit: proxy tunnel transport, no key leaks; live smoke (skipped unless asked)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_maps_urls_snapshots.test.js">kit_maps_urls_snapshots.test.js</a> — Maps kit: Maps URLs and the snapshot purge
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_prefs_cli.test.js">kit_prefs_cli.test.js</a> — Prefs kit: CLI end to end
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_prefs_evidence.test.js">kit_prefs_evidence.test.js</a> — Prefs kit: evidence validation, sanitizing, injection flag
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_prefs_flow.test.js">kit_prefs_flow.test.js</a> — Prefs kit: the five invariants (no owner word, no profile entry)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_research_cli.test.js">kit_research_cli.test.js</a> — Research kit: CLI end to end
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_research_core.test.js">kit_research_core.test.js</a> — Research kit: budgets, ledger, two-source rule, labels, durations
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/kit_research_injection.test.js">kit_research_injection.test.js</a> — Research kit: hostile pages are flagged and change nothing
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_hello.test.js">pack_hello.test.js</a>  — The hello pack extends the core through registries only and runs end to end
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_brochure-map.test.js">pack_tour-guide_brochure-map.test.js</a> — Tour Guide pack: plan → brochure model → kit-valid HTML on both fixtures
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_brochure-map_units.test.js">pack_tour-guide_brochure-map_units.test.js</a> — Tour Guide pack: brochure-map unit checks (hours, cards, later, text)
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_estimator.test.js">pack_tour-guide_estimator.test.js</a> — Tour Guide pack: estimates, calibration taps, bounds
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_fixtures.test.js">pack_tour-guide_fixtures.test.js</a> — Tour Guide pack: fixtures validate, responder replays every pair
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_integration.test.js">pack_tour-guide_integration.test.js</a> — Tour Guide pack: fixtures → estimator → planner → schemas → brochure, the Phase 3 property set
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_later.test.js">pack_tour-guide_later.test.js</a> — Tour Guide pack: Later lists, promote / demote
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner.test.js">pack_tour-guide_planner.test.js</a> — Tour Guide pack: solver and planner properties on a generated world
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_planner_world.js">pack_tour-guide_planner_world.js</a> — Generated planner world (seeded cities, hours, bookings) used by the planner tests
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/pack_tour-guide_schemas.test.js">pack_tour-guide_schemas.test.js</a> — Tour Guide pack: every schema accepts its fixture and rejects hostile shapes
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_boundary.test.js">tools_boundary.test.js</a> — Plants a fake secret and a personal-data path; the boundary check must fail on them
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_bundle.test.js">tools_bundle.test.js</a> — Manifest validation, bundle layout, appsscript.json, CLI, bundle runs in the mocks
│   │   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_envelope.test.js">tools_envelope.test.js</a> — Envelope stamping with a real id + clock; types from core and manifest
│   │   └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tests/tools_new_helper.test.js">tools_new_helper.test.js</a> — Scaffolds a pack and a private repo; the result bundles and runs in the mocks
│   └── <a href="https://github.com/LightAISolutions/Personal/tree/main/helpers/tools">tools/</a>                  — Node tools, no dependencies
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/boundary-allowlist.txt">boundary-allowlist.txt</a> — Domains, literals and paths the boundary check accepts
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/boundary-check.mjs">boundary-check.mjs</a>  — Fails on secrets, PII and personal-data paths under helpers/ (CI gate)
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/bundle.mjs">bundle.mjs</a>          — Reads packs/&lt;name&gt;/helper.json and emits one Apps Script project from core + pack gas/
│       ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/envelope.mjs">envelope.mjs</a>        — Stamps a mailbox envelope with a real id + clock (same CLI as the first helper)
│       └── <a href="https://github.com/LightAISolutions/Personal/blob/main/helpers/tools/new-helper.mjs">new-helper.mjs</a>      — Scaffolds a pack and a private repo from the template
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
