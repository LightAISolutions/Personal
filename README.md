# ​‌‌‌‌‌‌‌​​‌‌‌‌‌​ReadMe - Personal

A GitHub Pages deployment framework with automatic version polling, auto-refresh, and Google Apps Script (GAS) embedding support.

Last updated: `2026-08-30 02:55:41 AM EST` · Repo version: `v01.01r`

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
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/RULE-COST-AUDIT.md">RULE-COST-AUDIT.md</a>       — Rule cost audit — ranked table, trim-recommendation checklist (T1–T9), progress tracking
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/TODO.md">TODO.md</a>                 — [template · initialized] Actionable to-do items
│   ├── <a href="https://github.com/LightAISolutions/Personal/blob/main/repository-information/FUTURE-CONSIDERATIONS.md">FUTURE-CONSIDERATIONS.md</a> — [template] Deferred architectural ideas for scale
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
