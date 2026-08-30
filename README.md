# ​‌‌‌‌‌‌‌​​‌‌‌‌‌​ReadMe - Sales

A GitHub Pages deployment framework with automatic version polling, auto-refresh, and Google Apps Script (GAS) embedding support.

Last updated: `2026-08-30 01:37:44 AM EST` · Repo version: `v03.84r`

**Live site:** [lightaisolutions.github.io/Sales](https://lightaisolutions.github.io/Sales/)

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
<a href="https://github.com/LightAISolutions/Sales">Sales/</a> · <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/REPO-ARCHITECTURE.md">🧜‍♀️</a>  — <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/CHANGELOG.md">v01.03r</a>
│
<b>─── Live Site ────────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages">live-site-pages/</a>             — [template] Deployed to GitHub Pages
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/favicon.ico">favicon.ico</a>                            — Placeholder favicon (replace with your own)
│   <b>│ ─ Public Website ──────────────────────────────────────────────────────────</b>
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/index.html">index.html</a>  →  <a href="https://lightaisolutions.github.io/Sales/">🌐</a>🟢  — [template · modified] Landing page (replace with your own site)
│   │
│   <b>│ ─ Internal Sites ──────────────────────────────────────────────────────────</b>
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gas-project-creator.html">gas-project-creator.html</a>  →  <a href="https://lightaisolutions.github.io/Sales/gas-project-creator.html">🌐</a>🟢 · 🔸 · ◽ · 🔻 · <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/diagrams/gas-project-creator-diagram.md">🧜‍♀️</a>  — <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/gas-project-creatorhtml.changelog.md">v01.03w</a> · vNoGASg | [template · modified] GAS project creator dashboard
│   │
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/testauthgas1.html">testauthgas1.html</a>  →  <a href="https://lightaisolutions.github.io/Sales/testauthgas1.html">🌐</a>🟢 · <a href="https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/">📊</a> · ◽ · <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Testauthgas1/testauthgas1.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/testauthgas1html.changelog.md">v01.03w</a> · <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/testauthgas1gs.changelog.md">v01.06g</a> | [template] Testauthgas1 Title page
│   │
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/testauthhtml1.html">testauthhtml1.html</a>  →  <a href="https://lightaisolutions.github.io/Sales/testauthhtml1.html">🌐</a>🟢 · <a href="https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/">📊</a> · ◽ · <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Testauthhtml1/testauthhtml1.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/testauthhtml1html.changelog.md">v01.03w</a> · <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/testauthhtml1gs.changelog.md">v01.06g</a> | [template] Testauthhtml1 Title page
│   │
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/globalacl.html">globalacl.html</a>  →  <a href="https://lightaisolutions.github.io/Sales/globalacl.html">🌐</a>🟢 · <a href="https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/">📊</a> · ◽ · <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Globalacl/globalacl.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/globalaclhtml.changelog.md">v01.05w</a> · <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/globalaclgs.changelog.md">v01.07g</a> | [template] Global ACL page
│   │
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/Profiler.html">Profiler.html</a>  →  <a href="https://lightaisolutions.github.io/Sales/Profiler.html">🌐</a>🟢 · 🔸 · ◽ · <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Profiler/Profiler.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/Profilerhtml.changelog.md">v01.68w</a> · <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/Profilergs.changelog.md">v01.27g</a> | Ecosystem company dossiers — products, decision makers, financials vs expectations, technical specs; in-dossier field-note intake
│   │
│   <b>│ ─ Standalone Utilities ─────────────────────────────────────────────────────</b>
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/text-compare.html">text-compare.html</a>  →  <a href="https://lightaisolutions.github.io/Sales/text-compare.html">🌐</a>  — <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/text-comparehtml.changelog.md">v01.01w</a> · vNoGASg | [template] Text comparison tool with side-by-side diff highlighting
│   │
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/MasterACL.html">MasterACL.html</a>  →  <a href="https://LightAISolutions.github.io/Sales/MasterACL.html">🌐</a>🟢 · <a href="https://docs.google.com/spreadsheets/d/1kG2KftqfKOeYwBCEkxRpw-QBh9s-1-Dvy31sH037UvE/">📊</a> · ◽ · <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/MasterACL/MasterACL.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/MasterACLhtml.changelog.md">v01.05w</a> · <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/MasterACLgs.changelog.md">v01.13g</a> | [template] MasterACL page
│   │
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/Scraper.html">Scraper.html</a>  →  <a href="https://LightAISolutions.github.io/Sales/Scraper.html">🌐</a>🟢 · <a href="https://docs.google.com/spreadsheets/d/19U0Wu25eUXEHPVz4VWjKQIpnRozgFycNSjFCTB-umkk/">📊</a> · ◽ · <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Scraper/Scraper.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/Scraperhtml.changelog.md">v01.66w</a> · <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/Scrapergs.changelog.md">v01.83g</a> | [template] News Scraper page
│   │
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/Receipts.html">Receipts.html</a>  →  <a href="https://LightAISolutions.github.io/Sales/Receipts.html">🌐</a>🟢 · <a href="https://docs.google.com/spreadsheets/d/1SfVRsHm6pUn1bq633BSKiQ8c3IsQeVAs7H0265ckdDM/">📊</a> · ◽ · <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Receipts/Receipts.gs">⛽</a> · ◽  — <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/Receiptshtml.changelog.md">v01.36w</a> · <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/Receiptsgs.changelog.md">v01.28g</a> | [template] Receipts page
│   │
│   │
│   <b>│ ─ External Sites (Placeholder) ────────────────────────────────────────────</b>
│   │   <i>(No external-site pages yet)</i>
│   │
│   <b>│ ─ Not Yet Integrated ──────────────────────────────────────────────────────</b>
│   │   <i>(Pages that exist on disk but are not yet wired into the versioning / auto-refresh / changelog system — file link and live URL only; versions and setup will come when each is integrated)</i>
│   │
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/404.html">404.html</a>  →  <a href="https://lightaisolutions.github.io/Sales/404.html">🌐</a>
│   │
│   <b>│ ─ Supporting Files ──────────────────────────────────────────────────────</b>
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/.nojekyll">.nojekyll</a>               — [template] Disables Jekyll processing on GitHub Pages
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/receipts.webmanifest">receipts.webmanifest</a>    — PWA manifest for the Receipts page (home-screen install)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler.webmanifest">profiler.webmanifest</a>    — PWA manifest for the Profiler page (home-screen install)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/profiler-data">profiler-data/</a>           — Company dossier JSON data for the Profiler app (schema: repository-information/PROFILER-SCHEMA.md)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/profiler-companies.json">profiler-companies.json</a> — Company registry (roster, categories, freshness)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/profiler-graph.json">profiler-graph.json</a> — Prebuilt ecosystem relationship graph (both sides' curated links + cross-mention evidence; built by scripts/build-profiler-graph.py)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/abb.profile.json">abb.profile.json</a>       — ABB dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/abb.study.json">abb.study.json</a> — ABB in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/aligned.profile.json">aligned.profile.json</a> — Aligned Data Centers dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/aligned.study.json">aligned.study.json</a> — Aligned Data Centers in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/amazon.profile.json">amazon.profile.json</a>    — Amazon dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/amazon.study.json">amazon.study.json</a> — Amazon in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/applied-digital.profile.json">applied-digital.profile.json</a> — Applied Digital dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/applied-digital.study.json">applied-digital.study.json</a> — Applied Digital in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/arevon.profile.json">arevon.profile.json</a> — Arevon Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/bechtel.profile.json">bechtel.profile.json</a>   — Bechtel dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/bechtel.study.json">bechtel.study.json</a>     — Bechtel in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/black-veatch.profile.json">black-veatch.profile.json</a> — Black &amp; Veatch dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/black-veatch.study.json">black-veatch.study.json</a> — Black &amp; Veatch in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/blattner.profile.json">blattner.profile.json</a> — Blattner dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/bloom-energy.profile.json">bloom-energy.profile.json</a> — Bloom Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/bloom-energy.study.json">bloom-energy.study.json</a> — Bloom Energy in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/burns-mcdonnell.profile.json">burns-mcdonnell.profile.json</a> — Burns &amp; McDonnell dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/burns-mcdonnell.study.json">burns-mcdonnell.study.json</a> — Burns &amp; McDonnell in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/byd.profile.json">byd.profile.json</a>       — BYD dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/byd.study.json">byd.study.json</a>     — BYD in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/canadian-solar.profile.json">canadian-solar.profile.json</a> — Canadian Solar (e-STORAGE) dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/catl.profile.json">catl.profile.json</a>      — CATL dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/catl.study.json">catl.study.json</a>     — CATL in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/constellation-energy.profile.json">constellation-energy.profile.json</a> — Constellation Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/constellation-energy.study.json">constellation-energy.study.json</a> — Constellation Energy in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/core-scientific.profile.json">core-scientific.profile.json</a> — Core Scientific dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/core-scientific.study.json">core-scientific.study.json</a> — Core Scientific in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/coreweave.profile.json">coreweave.profile.json</a> — CoreWeave dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/coreweave.study.json">coreweave.study.json</a> — CoreWeave in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/crrc-zhuzhou.profile.json">crrc-zhuzhou.profile.json</a> — CRRC Zhuzhou Institute dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/crusoe.profile.json">crusoe.profile.json</a>    — Crusoe dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/crusoe.study.json">crusoe.study.json</a> — Crusoe in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/delta-electronics.profile.json">delta-electronics.profile.json</a> — Delta Electronics dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/delta-electronics.study.json">delta-electronics.study.json</a> — Delta Electronics in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/dpr.profile.json">dpr.profile.json</a>       — DPR Construction dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/dpr.study.json">dpr.study.json</a>     — DPR Construction in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/eaton.profile.json">eaton.profile.json</a>     — Eaton dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/eaton.study.json">eaton.study.json</a> — Eaton in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/enchanted-rock.profile.json">enchanted-rock.profile.json</a> — ERock (Enchanted Rock) dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/envision-energy.profile.json">envision-energy.profile.json</a> — Envision Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/eolian.profile.json">eolian.profile.json</a> — Eolian dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/equinix.profile.json">equinix.profile.json</a>   — Equinix dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/equinix.study.json">equinix.study.json</a> — Equinix in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/eve-energy.profile.json">eve-energy.profile.json</a> — EVE Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/eve-energy.study.json">eve-energy.study.json</a> — EVE Energy in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/flexgen.profile.json">flexgen.profile.json</a>   — FlexGen dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/flexgen.study.json">flexgen.study.json</a>     — FlexGen in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/fluence.profile.json">fluence.profile.json</a>   — Fluence dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/fluence.study.json">fluence.study.json</a>     — Fluence in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/ge-vernova.profile.json">ge-vernova.profile.json</a> — GE Vernova dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/ge-vernova.study.json">ge-vernova.study.json</a> — GE Vernova in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/google.profile.json">google.profile.json</a>    — Google dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/google.study.json">google.study.json</a> — Google in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/hitachi-energy.profile.json">hitachi-energy.profile.json</a> — Hitachi Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/hitachi-energy.study.json">hitachi-energy.study.json</a> — Hitachi Energy in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/hithium.profile.json">hithium.profile.json</a>   — Hithium dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/hithium.study.json">hithium.study.json</a>     — Hithium in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/hitt.profile.json">hitt.profile.json</a>      — HITT Contracting dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/hitt.study.json">hitt.study.json</a>     — HITT Contracting in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/holder-construction.profile.json">holder-construction.profile.json</a> — Holder Construction dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/holder-construction.study.json">holder-construction.study.json</a> — Holder Construction in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/huawei-digital-power.profile.json">huawei-digital-power.profile.json</a> — Huawei Digital Power dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/huawei-digital-power.study.json">huawei-digital-power.study.json</a> — Huawei Digital Power in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/hyperstrong.profile.json">hyperstrong.profile.json</a> — HyperStrong dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/iren.profile.json">iren.profile.json</a> — IREN dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/iren.study.json">iren.study.json</a> — IREN in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/jinko.profile.json">jinko.profile.json</a>     — Jinko dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/jinko.study.json">jinko.study.json</a> — Jinko in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/jupiter-power.profile.json">jupiter-power.profile.json</a> — Jupiter Power dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/key-capture-energy.profile.json">key-capture-energy.profile.json</a> — Key Capture Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/kiewit.profile.json">kiewit.profile.json</a>    — Kiewit dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/kiewit.study.json">kiewit.study.json</a>     — Kiewit in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/lambda.profile.json">lambda.profile.json</a> — Lambda dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/lambda.study.json">lambda.study.json</a> — Lambda in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/lg-energy-solution.profile.json">lg-energy-solution.profile.json</a> — LG Energy Solution dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/lg-energy-solution.study.json">lg-energy-solution.study.json</a> — LG Energy Solution in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/lightsource-bp.profile.json">lightsource-bp.profile.json</a> — Lightsource bp dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/liteon.profile.json">liteon.profile.json</a>    — LITEON dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/liteon.study.json">liteon.study.json</a> — LITEON in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/ls-energy-solutions.profile.json">ls-energy-solutions.profile.json</a> — LS Energy Solutions dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/mainspring-energy.profile.json">mainspring-energy.profile.json</a> — Mainspring Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/mastec.profile.json">mastec.profile.json</a> — MasTec dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/megmeet.profile.json">megmeet.profile.json</a>   — Megmeet dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/megmeet.study.json">megmeet.study.json</a>     — Megmeet in-app technology study guide (concept sections + flashcards)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/meta.profile.json">meta.profile.json</a>      — Meta dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/meta.study.json">meta.study.json</a> — Meta in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/microsoft.profile.json">microsoft.profile.json</a> — Microsoft dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/microsoft.study.json">microsoft.study.json</a> — Microsoft in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/mortenson.profile.json">mortenson.profile.json</a> — Mortenson dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/mortenson.study.json">mortenson.study.json</a>   — Mortenson in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/narada.profile.json">narada.profile.json</a> — Narada Power dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/nebius.profile.json">nebius.profile.json</a> — Nebius dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/nebius.study.json">nebius.study.json</a> — Nebius in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/nextera-energy-resources.profile.json">nextera-energy-resources.profile.json</a> — NextEra Energy Resources dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/nvidia.profile.json">nvidia.profile.json</a>    — NVIDIA dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/nvidia.study.json">nvidia.study.json</a> — NVIDIA in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/on-energy.profile.json">on-energy.profile.json</a> — ON.energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/openai.profile.json">openai.profile.json</a>    — OpenAI dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/openai.study.json">openai.study.json</a> — OpenAI in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/oracle.profile.json">oracle.profile.json</a>    — Oracle dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/oracle.study.json">oracle.study.json</a> — Oracle in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/panasonic.profile.json">panasonic.profile.json</a> — Panasonic dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/panasonic.study.json">panasonic.study.json</a> — Panasonic in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/plus-power.profile.json">plus-power.profile.json</a> — Plus Power dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/prevalon.profile.json">prevalon.profile.json</a> — Prevalon Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/primoris.profile.json">primoris.profile.json</a>  — Primoris dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/primoris.study.json">primoris.study.json</a>   — Primoris in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/proenergy.profile.json">proenergy.profile.json</a> — ProEnergy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/qts.profile.json">qts.profile.json</a> — QTS Data Centers dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/qts.study.json">qts.study.json</a> — QTS Data Centers in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/quanta-services.profile.json">quanta-services.profile.json</a> — Quanta Services dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/quanta-services.study.json">quanta-services.study.json</a> — Quanta Services in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/rosendin.profile.json">rosendin.profile.json</a>  — Rosendin dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/rosendin.study.json">rosendin.study.json</a> — Rosendin in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/samsung-ct.profile.json">samsung-ct.profile.json</a> — Samsung C&T dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/samsung-sdi.profile.json">samsung-sdi.profile.json</a> — Samsung SDI dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/samsung-sdi.study.json">samsung-sdi.study.json</a> — Samsung SDI in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/schneider-electric.profile.json">schneider-electric.profile.json</a> — Schneider Electric dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/schneider-electric.study.json">schneider-electric.study.json</a> — Schneider Electric in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/siemens-energy.profile.json">siemens-energy.profile.json</a> — Siemens Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/siemens-energy.study.json">siemens-energy.study.json</a> — Siemens Energy in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/sinexcel.profile.json">sinexcel.profile.json</a>  — Sinexcel dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/sinexcel.study.json">sinexcel.study.json</a>     — Sinexcel in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/solv-energy.profile.json">solv-energy.profile.json</a> — SOLV Energy dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/stack-infrastructure.profile.json">stack-infrastructure.profile.json</a> — STACK Infrastructure dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/stack-infrastructure.study.json">stack-infrastructure.study.json</a> — STACK Infrastructure in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/sungrow.profile.json">sungrow.profile.json</a>   — Sungrow dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/sungrow.study.json">sungrow.study.json</a>     — Sungrow in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/sunwoda.profile.json">sunwoda.profile.json</a> — Sunwoda dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/switch.profile.json">switch.profile.json</a> — Switch dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/switch.study.json">switch.study.json</a> — Switch in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/terawulf.profile.json">terawulf.profile.json</a> — TeraWulf dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/terawulf.study.json">terawulf.study.json</a> — TeraWulf in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/terra-gen.profile.json">terra-gen.profile.json</a> — Terra-Gen dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/tesla.profile.json">tesla.profile.json</a>     — Tesla dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/tesla.study.json">tesla.study.json</a>     — Tesla in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/trina-storage.profile.json">trina-storage.profile.json</a> — Trina Storage dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/turner-construction.profile.json">turner-construction.profile.json</a> — Turner Construction dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/turner-construction.study.json">turner-construction.study.json</a> — Turner Construction in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/vantage.profile.json">vantage.profile.json</a> — Vantage Data Centers dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/vantage.study.json">vantage.study.json</a> — Vantage Data Centers in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/vertiv.profile.json">vertiv.profile.json</a>    — Vertiv dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/vertiv.study.json">vertiv.study.json</a> — Vertiv in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/voltagrid.profile.json">voltagrid.profile.json</a> — VoltaGrid dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/wartsila.profile.json">wartsila.profile.json</a>  — Wärtsilä dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/wartsila.study.json">wartsila.study.json</a>     — Wärtsilä in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/xai.profile.json">xai.profile.json</a>       — xAI dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/xai.study.json">xai.study.json</a> — xAI in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/zhonhen.profile.json">zhonhen.profile.json</a>   — Zhonhen Electric dossier profile
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/zhonhen.study.json">zhonhen.study.json</a>     — Zhonhen Electric in-app technology study guide
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/profiler-data/reports">reports/</a>                — Industry reports generated by the Profiler Report Command (immutable snapshot JSONs; schema: repository-information/PROFILER-SCHEMA.md)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/reports/reports-index.json">reports-index.json</a>  — Reports library index (the Reports view renders from this alone)
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/reports/grid-scale-bess--competitive--2026-08-29.report.json">grid-scale-bess--competitive--2026-08-29.report.json</a> — Competitive report: 12 grid-scale BESS system players, 42 dossier citations
│   │   └── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/profiler-data/archive">archive/</a>                — Superseded dossier versions, archived on each profile revision
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/archive-index.json">archive-index.json</a>  — Index of archived profile versions per company
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/abb.profile.v1.json">abb.profile.v1.json</a> — Archived v1 dossier (ABB)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/aligned.profile.v1.json">aligned.profile.v1.json</a> — Archived v1 dossier (Aligned Data Centers)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/amazon.profile.v1.json">amazon.profile.v1.json</a> — Archived v1 dossier (Amazon)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/amazon.profile.v2.json">amazon.profile.v2.json</a> — Archived v2 dossier (Amazon)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/amazon.profile.v3.json">amazon.profile.v3.json</a> — Archived v3 dossier (Amazon)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/applied-digital.profile.v1.json">applied-digital.profile.v1.json</a> — Archived v1 dossier (Applied Digital)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/bechtel.profile.v1.json">bechtel.profile.v1.json</a> — Archived v1 dossier (Bechtel)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/black-veatch.profile.v1.json">black-veatch.profile.v1.json</a> — Archived v1 dossier (Black & Veatch)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/bloom-energy.profile.v1.json">bloom-energy.profile.v1.json</a> — Archived v1 dossier (Bloom Energy)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/burns-mcdonnell.profile.v1.json">burns-mcdonnell.profile.v1.json</a> — Archived v1 dossier (Burns & McDonnell)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/byd.profile.v1.json">byd.profile.v1.json</a> — Archived v1 dossier (BYD)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/byd.profile.v2.json">byd.profile.v2.json</a> — Archived v2 dossier (BYD)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/byd.profile.v3.json">byd.profile.v3.json</a> — Archived v3 dossier (BYD)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/catl.profile.v1.json">catl.profile.v1.json</a> — Archived v1 dossier (CATL)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/catl.profile.v2.json">catl.profile.v2.json</a> — Archived v2 dossier (CATL)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/catl.profile.v3.json">catl.profile.v3.json</a> — Archived v3 dossier (CATL)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/constellation-energy.profile.v1.json">constellation-energy.profile.v1.json</a> — Archived v1 dossier (Constellation Energy)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/core-scientific.profile.v1.json">core-scientific.profile.v1.json</a> — Archived v1 dossier (Core Scientific)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/coreweave.profile.v1.json">coreweave.profile.v1.json</a> — Archived v1 dossier (CoreWeave)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/coreweave.profile.v2.json">coreweave.profile.v2.json</a> — Archived v2 dossier (CoreWeave)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/crusoe.profile.v1.json">crusoe.profile.v1.json</a> — Archived v1 dossier (Crusoe)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/crusoe.profile.v2.json">crusoe.profile.v2.json</a> — Archived v2 dossier (Crusoe)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/delta-electronics.profile.v1.json">delta-electronics.profile.v1.json</a> — Archived v1 dossier (Delta Electronics)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/dpr.profile.v1.json">dpr.profile.v1.json</a> — Archived v1 dossier (DPR Construction)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/eaton.profile.v1.json">eaton.profile.v1.json</a> — Archived v1 dossier (Eaton)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/equinix.profile.v1.json">equinix.profile.v1.json</a> — Archived v1 dossier (Equinix)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/eve-energy.profile.v1.json">eve-energy.profile.v1.json</a> — Archived v1 dossier (EVE Energy)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/flexgen.profile.v1.json">flexgen.profile.v1.json</a> — Archived v1 dossier (FlexGen)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/flexgen.profile.v2.json">flexgen.profile.v2.json</a> — Archived v2 dossier (FlexGen)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/flexgen.profile.v3.json">flexgen.profile.v3.json</a> — Archived v3 dossier (FlexGen)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/fluence.profile.v1.json">fluence.profile.v1.json</a> — Archived v1 dossier (Fluence)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/fluence.profile.v2.json">fluence.profile.v2.json</a> — Archived v2 dossier (Fluence)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/fluence.profile.v3.json">fluence.profile.v3.json</a> — Archived v3 dossier (Fluence)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/ge-vernova.profile.v1.json">ge-vernova.profile.v1.json</a> — Archived v1 dossier (GE Vernova)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/google.profile.v1.json">google.profile.v1.json</a> — Archived v1 dossier (Google)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/google.profile.v2.json">google.profile.v2.json</a> — Archived v2 dossier (Google)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/hitachi-energy.profile.v1.json">hitachi-energy.profile.v1.json</a> — Archived v1 dossier (Hitachi Energy)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/hithium.profile.v1.json">hithium.profile.v1.json</a> — Archived v1 dossier (Hithium)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/hithium.profile.v2.json">hithium.profile.v2.json</a> — Archived v2 dossier (Hithium)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/hithium.profile.v3.json">hithium.profile.v3.json</a> — Archived v3 dossier (Hithium)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/hithium.profile.v4.json">hithium.profile.v4.json</a> — Archived v4 dossier (Hithium)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/hitt.profile.v1.json">hitt.profile.v1.json</a> — Archived v1 dossier (HITT Contracting)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/holder-construction.profile.v1.json">holder-construction.profile.v1.json</a> — Archived v1 dossier (Holder Construction)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/huawei-digital-power.profile.v1.json">huawei-digital-power.profile.v1.json</a> — Archived v1 dossier (Huawei Digital Power)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/huawei-digital-power.profile.v2.json">huawei-digital-power.profile.v2.json</a> — Archived v2 dossier (Huawei Digital Power)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/iren.profile.v1.json">iren.profile.v1.json</a> — Archived v1 dossier (IREN)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/iren.profile.v2.json">iren.profile.v2.json</a> — Archived v2 dossier (IREN)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/jinko.profile.v1.json">jinko.profile.v1.json</a> — Archived v1 dossier (Jinko)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/kiewit.profile.v1.json">kiewit.profile.v1.json</a> — Archived v1 dossier (Kiewit)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/lambda.profile.v1.json">lambda.profile.v1.json</a> — Archived v1 dossier (Lambda)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/lambda.profile.v2.json">lambda.profile.v2.json</a> — Archived v2 dossier (Lambda)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/lg-energy-solution.profile.v1.json">lg-energy-solution.profile.v1.json</a> — Archived v1 dossier (LG Energy Solution)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/liteon.profile.v1.json">liteon.profile.v1.json</a> — Archived v1 dossier (LITEON)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/megmeet.profile.v1.json">megmeet.profile.v1.json</a> — Archived v1 dossier (Megmeet)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/megmeet.profile.v2.json">megmeet.profile.v2.json</a> — Archived v2 dossier (Megmeet)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/meta.profile.v1.json">meta.profile.v1.json</a> — Archived v1 dossier (Meta)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/meta.profile.v2.json">meta.profile.v2.json</a> — Archived v2 dossier (Meta)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/microsoft.profile.v1.json">microsoft.profile.v1.json</a> — Archived v1 dossier (Microsoft)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/microsoft.profile.v2.json">microsoft.profile.v2.json</a> — Archived v2 dossier (Microsoft)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/mortenson.profile.v1.json">mortenson.profile.v1.json</a> — Archived v1 dossier (Mortenson)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/nebius.profile.v1.json">nebius.profile.v1.json</a> — Archived v1 dossier (Nebius)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/nebius.profile.v2.json">nebius.profile.v2.json</a> — Archived v2 dossier (Nebius)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/nvidia.profile.v1.json">nvidia.profile.v1.json</a> — Archived v1 dossier (NVIDIA)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/openai.profile.v1.json">openai.profile.v1.json</a> — Archived v1 dossier (OpenAI)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/openai.profile.v2.json">openai.profile.v2.json</a> — Archived v2 dossier (OpenAI)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/oracle.profile.v1.json">oracle.profile.v1.json</a> — Archived v1 dossier (Oracle)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/oracle.profile.v2.json">oracle.profile.v2.json</a> — Archived v2 dossier (Oracle)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/panasonic.profile.v1.json">panasonic.profile.v1.json</a> — Archived v1 dossier (Panasonic)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/primoris.profile.v1.json">primoris.profile.v1.json</a> — Archived v1 dossier (Primoris)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/qts.profile.v1.json">qts.profile.v1.json</a> — Archived v1 dossier (QTS Data Centers)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/quanta-services.profile.v1.json">quanta-services.profile.v1.json</a> — Archived v1 dossier (Quanta Services)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/rosendin.profile.v1.json">rosendin.profile.v1.json</a> — Archived v1 dossier (Rosendin)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/samsung-sdi.profile.v1.json">samsung-sdi.profile.v1.json</a> — Archived v1 dossier (Samsung SDI)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/schneider-electric.profile.v1.json">schneider-electric.profile.v1.json</a> — Archived v1 dossier (Schneider Electric)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/siemens-energy.profile.v1.json">siemens-energy.profile.v1.json</a> — Archived v1 dossier (Siemens Energy)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/sinexcel.profile.v1.json">sinexcel.profile.v1.json</a> — Archived v1 dossier (Sinexcel)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/sinexcel.profile.v2.json">sinexcel.profile.v2.json</a> — Archived v2 dossier (Sinexcel)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/sinexcel.profile.v3.json">sinexcel.profile.v3.json</a> — Archived v3 dossier (Sinexcel)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/stack-infrastructure.profile.v1.json">stack-infrastructure.profile.v1.json</a> — Archived v1 dossier (STACK Infrastructure)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/sungrow.profile.v1.json">sungrow.profile.v1.json</a> — Archived v1 dossier (Sungrow)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/sungrow.profile.v2.json">sungrow.profile.v2.json</a> — Archived v2 dossier (Sungrow)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/sungrow.profile.v3.json">sungrow.profile.v3.json</a> — Archived v3 dossier (Sungrow)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/switch.profile.v1.json">switch.profile.v1.json</a> — Archived v1 dossier (Switch)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/terawulf.profile.v1.json">terawulf.profile.v1.json</a> — Archived v1 dossier (TeraWulf)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/tesla.profile.v1.json">tesla.profile.v1.json</a> — Archived v1 dossier (Tesla)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/tesla.profile.v2.json">tesla.profile.v2.json</a> — Archived v2 dossier (Tesla)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/tesla.profile.v3.json">tesla.profile.v3.json</a> — Archived v3 dossier (Tesla)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/turner-construction.profile.v1.json">turner-construction.profile.v1.json</a> — Archived v1 dossier (Turner Construction)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/vantage.profile.v1.json">vantage.profile.v1.json</a> — Archived v1 dossier (Vantage Data Centers)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/vertiv.profile.v1.json">vertiv.profile.v1.json</a> — Archived v1 dossier (Vertiv)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/wartsila.profile.v1.json">wartsila.profile.v1.json</a> — Archived v1 dossier (Wärtsilä)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/wartsila.profile.v2.json">wartsila.profile.v2.json</a> — Archived v2 dossier (Wärtsilä)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/wartsila.profile.v3.json">wartsila.profile.v3.json</a> — Archived v3 dossier (Wärtsilä)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/xai.profile.v1.json">xai.profile.v1.json</a> — Archived v1 dossier (xAI)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/xai.profile.v2.json">xai.profile.v2.json</a> — Archived v2 dossier (xAI)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/zhonhen.profile.v1.json">zhonhen.profile.v1.json</a> — Archived v1 dossier (Zhonhen Electric)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/zhonhen.profile.v2.json">zhonhen.profile.v2.json</a> — Archived v2 dossier (Zhonhen Electric)
│   │       └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/profiler-data/archive/zhonhen.profile.v3.json">zhonhen.profile.v3.json</a> — Archived v3 dossier (Zhonhen Electric)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/templates">templates/</a>               — [template] Template source files for creating new pages and GAS scripts
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-noauth.html.txt">HtmlAndGasTemplateAutoUpdate-noauth.html.txt</a> — [template] HTML page template without auth
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt">HtmlAndGasTemplateAutoUpdate-auth.html.txt</a> — [template · modified] HTML page template with Google Authentication
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/templates/gas-minimal-noauth-template-code.js.txt">gas-minimal-noauth-template-code.js.txt</a> — [template] GAS template (version display + auto-update)
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/templates/gas-minimal-auth-template-code.js.txt">gas-minimal-auth-template-code.js.txt</a> — [template] GAS template with Google auth
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/html-versions">html-versions/</a>           — [template] HTML page version files for auto-refresh polling
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-versions/gas-project-creatorhtml.version.txt">gas-project-creatorhtml.version.txt</a> — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-versions/testauthgas1html.version.txt">testauthgas1html.version.txt</a>          — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-versions/testauthhtml1html.version.txt">testauthhtml1html.version.txt</a>          — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-versions/globalaclhtml.version.txt">globalaclhtml.version.txt</a>          — [template]
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-versions/Profilerhtml.version.txt">Profilerhtml.version.txt</a>           — Profiler page version
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/gs-versions">gs-versions/</a>             — [template] GAS version files for GAS version pill polling
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-versions/testauthgas1gs.version.txt">testauthgas1gs.version.txt</a>            — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-versions/testauthhtml1gs.version.txt">testauthhtml1gs.version.txt</a>            — [template]
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-versions/globalaclgs.version.txt">globalaclgs.version.txt</a>            — [template]
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/ahk-versions">ahk-versions/</a>            — [template] AHK version files for auto-update polling
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/ahk-versions/autoupdateahk.version.txt">autoupdateahk.version.txt</a>                      — [template · modified] Version for AutoUpdate.ahk
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/ahk-versions/test1ahkahk.version.txt">test1ahkahk.version.txt</a>                        — Version for Test1.ahk.ahk (auto-update pipeline test placeholder)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/ahk-changelogs">ahk-changelogs/</a>          — [template] AHK changelogs (user-facing change history)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/ahk-changelogs/autoupdateahk.changelog.md">autoupdateahk.changelog.md</a>                     — [template · modified] AutoUpdate.ahk changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/ahk-changelogs/test1ahkahk.changelog.md">test1ahkahk.changelog.md</a>                       — Test1.ahk.ahk changelog
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/ahk-changelogs/autoupdateahk.changelog-archive.md">autoupdateahk.changelog-archive.md</a>             — [template] Older sections (rotated)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/auto-update-html-versions">auto-update-html-versions/</a>  — Version files for HTML auto-update payloads (polled by AutoUpdate.ahk)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/auto-update-html-changelogs">auto-update-html-changelogs/</a>  — Changelogs for HTML auto-update payloads (user-facing change history)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/html-changelogs">html-changelogs/</a>         — [template] HTML changelogs (source of truth + deployed)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/gas-project-creatorhtml.changelog.md">gas-project-creatorhtml.changelog.md</a>   — [template] GAS Project Creator changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/gas-project-creatorhtml.changelog-archive.md">gas-project-creatorhtml.changelog-archive.md</a>  — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/testauthgas1html.changelog.md">testauthgas1html.changelog.md</a>             — [template] Testauthgas1 page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/testauthgas1html.changelog-archive.md">testauthgas1html.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/testauthhtml1html.changelog.md">testauthhtml1html.changelog.md</a>             — [template] Testauthhtml1 page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/testauthhtml1html.changelog-archive.md">testauthhtml1html.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/globalaclhtml.changelog.md">globalaclhtml.changelog.md</a>             — [template] Globalacl page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/globalaclhtml.changelog-archive.md">globalaclhtml.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/MasterACLhtml.changelog.md">MasterACLhtml.changelog.md</a>             — [template] MasterACL page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/MasterACLhtml.changelog-archive.md">MasterACLhtml.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/Scraperhtml.changelog.md">Scraperhtml.changelog.md</a>             — [template] Scraper page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/Scraperhtml.changelog-archive.md">Scraperhtml.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/Receiptshtml.changelog.md">Receiptshtml.changelog.md</a>             — [template] Receipts page changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/Receiptshtml.changelog-archive.md">Receiptshtml.changelog-archive.md</a>     — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/Profilerhtml.changelog.md">Profilerhtml.changelog.md</a>             — Profiler page changelog
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-changelogs/Profilerhtml.changelog-archive.md">Profilerhtml.changelog-archive.md</a>     — Older sections (rotated)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/gs-changelogs">gs-changelogs/</a>           — [template] GAS changelogs (source of truth + deployed)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/testauthgas1gs.changelog.md">testauthgas1gs.changelog.md</a>               — [template] Testauthgas1 GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/testauthgas1gs.changelog-archive.md">testauthgas1gs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/testauthhtml1gs.changelog.md">testauthhtml1gs.changelog.md</a>               — [template] Testauthhtml1 GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/testauthhtml1gs.changelog-archive.md">testauthhtml1gs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/globalaclgs.changelog.md">globalaclgs.changelog.md</a>               — [template] Globalacl GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/globalaclgs.changelog-archive.md">globalaclgs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/MasterACLgs.changelog.md">MasterACLgs.changelog.md</a>               — [template] MasterACL GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/MasterACLgs.changelog-archive.md">MasterACLgs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/Scrapergs.changelog.md">Scrapergs.changelog.md</a>               — [template] Scraper GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/Scrapergs.changelog-archive.md">Scrapergs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/Receiptsgs.changelog.md">Receiptsgs.changelog.md</a>               — [template] Receipts GAS changelog
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/Receiptsgs.changelog-archive.md">Receiptsgs.changelog-archive.md</a>       — [template] Older sections (rotated)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/Profilergs.changelog.md">Profilergs.changelog.md</a>               — Profiler GAS changelog
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-changelogs/Profilergs.changelog-archive.md">Profilergs.changelog-archive.md</a>       — Older sections (rotated)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/images">images/</a>                  — Test images and visual assets
│   │   └── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/images/execs">execs/</a>               — Executive headshots for Profiler dossiers — company-published photos (leadership pages and PDF annual/ESG reports) plus verified free-licensed Wikimedia Commons portraits (164 images across 46 companies; CC-licensed files carry a photoCredit attribution shown in-app and in exports)
│   └── <a href="https://github.com/LightAISolutions/Sales/tree/main/live-site-pages/sounds">sounds/</a>                 — [template] Audio feedback files
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/sounds/Website_Ready_Voice_1.mp3">Website_Ready_Voice_1.mp3</a>   — [template] "Website Ready" splash sound
│       └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/sounds/Code_Ready_Voice_1.mp3">Code_Ready_Voice_1.mp3</a>      — [template] "Code Ready" splash sound
│
<b>─── Google Apps Scripts ───────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/tree/main/googleAppsScripts">googleAppsScripts/</a>          — [template] Google Apps Script projects
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/googleAppsScripts/Testauthgas1">Testauthgas1/</a>             — [template] GAS for live-site-pages/testauthgas1.html
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Testauthgas1/testauthgas1.gs">testauthgas1.gs</a>              — [template] Self-updating GAS web app (auth)
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Testauthgas1/testauthgas1.config.json">testauthgas1.config.json</a>     — [template] Project config (source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/googleAppsScripts/Testauthhtml1">Testauthhtml1/</a>             — [template] GAS for live-site-pages/testauthhtml1.html
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Testauthhtml1/testauthhtml1.gs">testauthhtml1.gs</a>              — [template] Self-updating GAS web app (auth)
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Testauthhtml1/testauthhtml1.config.json">testauthhtml1.config.json</a>     — [template] Project config (source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/googleAppsScripts/Claspdeploytest">Claspdeploytest/</a>           — Pilot: GAS deployed via GitHub Actions (clasp push, not the pull model)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Claspdeploytest/claspdeploytest.gs">claspdeploytest.gs</a>           — Minimal pilot web app (push model — no GITHUB_TOKEN)
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Claspdeploytest/appsscript.json">appsscript.json</a>          — Apps Script manifest (pushed by clasp)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/googleAppsScripts/MasterACL">MasterACL/</a>             — [template] GAS for live-site-pages/MasterACL.html
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/MasterACL/MasterACL.gs">MasterACL.gs</a>              — [template] Self-updating GAS web app
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/MasterACL/MasterACL.config.json">MasterACL.config.json</a>     — [template] Project config (source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/googleAppsScripts/Scraper">Scraper/</a>             — [template] GAS for live-site-pages/Scraper.html
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Scraper/Scraper.gs">Scraper.gs</a>              — [template] Self-updating GAS web app
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Scraper/Scraper.config.json">Scraper.config.json</a>     — [template] Project config (source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/googleAppsScripts/Receipts">Receipts/</a>             — [template] GAS for live-site-pages/Receipts.html
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Receipts/Receipts.gs">Receipts.gs</a>              — [template] Self-updating GAS web app
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Receipts/Receipts.config.json">Receipts.config.json</a>     — [template] Project config (source of truth)
│   └── <a href="https://github.com/LightAISolutions/Sales/tree/main/googleAppsScripts/Profiler">Profiler/</a>             — GAS for live-site-pages/Profiler.html (in-dossier field-note intake)
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Profiler/Profiler.gs">Profiler.gs</a>              — Self-updating GAS web app (note + Word/PDF intake)
│       └── <a href="https://github.com/LightAISolutions/Sales/blob/main/googleAppsScripts/Profiler/Profiler.config.json">Profiler.config.json</a>     — Project config (source of truth)
│
<b>─── Sample Components ────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/tree/main/sample-components">sample-components/</a>          — Self-contained starter kit (HTML version-polling + GAS self-update) for bootstrapping a new repo
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/sample-components/README.md">README.md</a>                   — Setup guide for new repos (placeholders, GAS deploy bootstrap, file-by-file map)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/sample-components/sample.html">sample.html</a>                 — Minimal page with active 10s version-polling + auto-reload
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/sample-components/sample.gs">sample.gs</a>                   — Minimal GAS web app: doPost(action=deploy) + pullAndDeployFromGitHub
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/sample-components/sample.config.json">sample.config.json</a>          — GAS project config (single source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/sample-components/appsscript.json">appsscript.json</a>             — GAS manifest (webapp settings + oauth scopes)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/sample-components/html-versions">html-versions/</a>              — Page-version files (polled by sample.html)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/sample-components/html-versions/samplehtml.version.txt">samplehtml.version.txt</a>  — `|v01.00w|`
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-versions/MasterACLhtml.version.txt">MasterACLhtml.version.txt</a>          — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-versions/Scraperhtml.version.txt">Scraperhtml.version.txt</a>          — [template]
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/html-versions/Receiptshtml.version.txt">Receiptshtml.version.txt</a>          — [template]
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/sample-components/gs-versions">gs-versions/</a>                — GAS-version files (cross-referenced from page changelogs)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/sample-components/gs-versions/samplegs.version.txt">samplegs.version.txt</a>    — `|v01.00g|`
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-versions/MasterACLgs.version.txt">MasterACLgs.version.txt</a>            — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-versions/Scrapergs.version.txt">Scrapergs.version.txt</a>            — [template]
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-versions/Receiptsgs.version.txt">Receiptsgs.version.txt</a>            — [template]
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/live-site-pages/gs-versions/Profilergs.version.txt">Profilergs.version.txt</a>            — Profiler GAS version
│   └── <a href="https://github.com/LightAISolutions/Sales/tree/main/sample-components/workflows">workflows/</a>                  — Workflow stubs (drop into `.github/workflows/` in the new repo)
│       └── <a href="https://github.com/LightAISolutions/Sales/blob/main/sample-components/workflows/auto-merge-and-deploy.yml">auto-merge-and-deploy.yml</a>  — Minimal CI: merge claude/* → main + fire GAS deploy webhook
│
<b>─── AutoHotkey ───────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/tree/main/autoHotkey">autoHotkey/</a>                — [template] AutoHotkey v2 scripts
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/autoHotkey/AutoUpdate.ahk">AutoUpdate.ahk</a>                                  — [template · modified] Pull-based auto-updater (polls GitHub Pages, fetches via api.github.com, writes to local paths) + Manual Targets scratchpad panel with "Copy for Claude" handoff; reads the repo manifest below to discover active targets
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/autoHotkey/Test1.ahk.ahk">Test1.ahk.ahk</a>                                   — Pipeline-test placeholder (no-op, registers for hot-reload, stays resident with tray icon)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/autoHotkey/auto-update-targets.ini">auto-update-targets.ini</a>                         — Repo-tracked manifest of active auto-update targets; AutoUpdate joins each entry with a matching local intent's Local Folder to compute the per-machine target path
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/autoHotkey/AutoUpdate.config.ini.example">AutoUpdate.config.ini.example</a>                   — PAT config template; real AutoUpdate.config.ini is gitignored
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/autoHotkey/AutoUpdate.manual-targets.ini.example">AutoUpdate.manual-targets.ini.example</a>           — Manual-targets scratchpad template; real AutoUpdate.manual-targets.ini is gitignored
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/autoHotkey/ReloadHandler.ahk">ReloadHandler.ahk</a>                              — [template] Optional #Include for auto-reload via IPC
│
└── <a href="https://github.com/LightAISolutions/Sales/tree/main/auto-update-payloads">auto-update-payloads/</a>        — Non-AHK files delivered to local machines by AutoUpdate.ahk
│
<b>─── Scripts ──────────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/tree/main/scripts">scripts/</a>                   — [template]
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/init-repo.sh">init-repo.sh</a>            — [template] One-shot fork initialization script
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/setup-gas-project.sh">setup-gas-project.sh</a>    — [template] GAS project file creation script
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/compute-csp-hash.sh">compute-csp-hash.sh</a>     — [template] CSP SHA-256 hash computation for inline scripts
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/check-gas-inner-scripts.js">check-gas-inner-scripts.js</a> — CI check: validates served inner &lt;script&gt; syntax in GAS files
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/build-profiler-graph.py">build-profiler-graph.py</a> — Profiler relationship-graph builder (merges both dossiers' curated links + full-sentence cross-mention evidence into profiler-graph.json; --check reports drift) — required after any profile write
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/check-profiler-reports.py">check-profiler-reports.py</a> — Profiler report verification (citation resolution against dossier sources, provenance tiers, KPI figure checks, index reconciliation) — required after any report write
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/playwright-harness.py">playwright-harness.py</a>   — Chromium smoke-test harness for all projects (load + console-error + screenshot)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/verify-profiler-roles.py">verify-profiler-roles.py</a> — Profiler app verifier (Role + Access matrix with per-tier screenshots, per-account guidance-progress isolation, Technical Annex render audit across all dossiers)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/sync-profiler-registry.py">sync-profiler-registry.py</a> — Profiler registry reconciliation (syncs denormalized lastUpdated / source counts / first-party share / KPI flag from the profile JSONs; --check reports drift)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/build-aidc-report-pdf.mjs">build-aidc-report-pdf.mjs</a> — Renders the AIDC market report HTML to paginated PDFs, one per Profiler writing style (headless Chromium, DevTools Protocol)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/build-study-prep-pdf.mjs">build-study-prep-pdf.mjs</a> — Typesets a study-prep Markdown brief to PDF; the Markdown stays the source of truth so the PDF cannot drift
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/harvest-exec-photos.py">harvest-exec-photos.py</a> — Executive-headshot harvester for Profiler dossiers (first-party leadership pages + license-verified Wikimedia Commons, contact-sheet verification, surgical JSON wiring)
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/scripts/transcribe.ps1">transcribe.ps1</a>          — Local Whisper launcher (large-v3-turbo on GPU) — copy to the transcribing PC; wraps venv, CUDA DLL path and output location
│
<b>─── Tests ────────────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/tree/main/tests">tests/</a>                     — [template] Security &amp; integration tests
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/tests/offensive-security">offensive-security/</a>    — [template] Offensive security tests (Playwright)
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/HTML-AUTH-SECURITY-AUDIT.md">HTML-AUTH-SECURITY-AUDIT.md</a>        — [template] Independent security audit of HTML auth layer (HIPAA context)
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/README.md">README.md</a>                         — [template · initialized] Test suite documentation
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/SECURITY-FINDINGS.md">SECURITY-FINDINGS.md</a>              — [template] Comprehensive findings from all tests
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/XSS-EXPLAINER.md">XSS-EXPLAINER.md</a>                  — [template] XSS explanation, Playwright god mode, threat model context
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/test_01_xss_postmessage.py">test_01_xss_postmessage.py</a>        — [template] XSS via postMessage injection
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/test_02_session_forgery.py">test_02_session_forgery.py</a>         — [template] Session token forgery &amp; fixation
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/test_03_message_type_injection.py">test_03_message_type_injection.py</a>  — [template] Message type spoofing &amp; protocol confusion
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/test_04_csrf_token_replay.py">test_04_csrf_token_replay.py</a>       — [template] OAuth token replay &amp; CSRF attacks
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/test_05_clickjacking_iframe_embedding.py">test_05_clickjacking_iframe_embedding.py</a> — [template] Clickjacking &amp; iframe embedding
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/test_06_deploy_endpoint_abuse.py">test_06_deploy_endpoint_abuse.py</a>   — [template] Deploy endpoint probing &amp; flood
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/test_07_session_race_timing.py">test_07_session_race_timing.py</a>     — [template] Session race conditions &amp; timing
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/test_08_csp_bypass_resource_injection.py">test_08_csp_bypass_resource_injection.py</a> — [template] CSP bypass &amp; resource injection
│       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/test_09_auth_state_manipulation.py">test_09_auth_state_manipulation.py</a> — [template] Auth state manipulation &amp; privilege escalation
│       └── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/offensive-security/GAS-HIPAA-COMPLIANCE-ANALYSIS.md">GAS-HIPAA-COMPLIANCE-ANALYSIS.md</a>  — [template] GAS HIPAA compliance analysis under Workspace BAA
│   └── <a href="https://github.com/LightAISolutions/Sales/tree/main/tests/defensive-security">defensive-security/</a>    — Defensive security validation tests (Playwright)
│       └── <a href="https://github.com/LightAISolutions/Sales/blob/main/tests/defensive-security/test_01_csp_headers_validation.py">test_01_csp_headers_validation.py</a> — CSP &amp; security headers validation across all pages
│
<b>─── Repository Information ───────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information">repository-information/</a>    — [template]
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/REPO-ARCHITECTURE.md">REPO-ARCHITECTURE.md</a>         — [template · initialized] System diagram (Mermaid)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/diagrams">diagrams/</a>               — [template] Per-page architecture diagrams
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/diagrams/gas-project-creator-diagram.md">gas-project-creator-diagram.md</a> — [template] GAS Project Creator user flow
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/diagrams/testauthgas1-diagram.md">testauthgas1-diagram.md</a>         — [template] Testauthgas1 page GAS integration sequence (auth)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/diagrams/testauthhtml1-diagram.md">testauthhtml1-diagram.md</a>         — [template] Testauthhtml1 page GAS integration sequence (auth)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/diagrams/MasterACL-diagram.md">MasterACL-diagram.md</a>         — [template] MasterACL page GAS integration sequence
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/diagrams/Scraper-diagram.md">Scraper-diagram.md</a>         — [template] Scraper page GAS integration sequence
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/diagrams/Receipts-diagram.md">Receipts-diagram.md</a>         — [template] Receipts page GAS integration sequence
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/diagrams/profiler-diagram.md">profiler-diagram.md</a>         — Profiler page GAS integration sequence (inline note-box iframe)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-MARKET-REPORT.md">AIDC-MARKET-REPORT.md</a>   — AIDC market report: an equity-research guide to the US AI data-center infrastructure market, written to teach it — 11 chapters of argument; the 40 per-company entries live in the Coverage Universe companion
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-MARKET-REPORT.pdf">AIDC-MARKET-REPORT.pdf</a>  — Formatted market report, BloombergNEF Research Report style (canonical edition; 109 pages, single-column contents on page 2, every chapter on a fresh page)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-MARKET-REPORT-analyst-prose.pdf">AIDC-MARKET-REPORT-analyst-prose.pdf</a> — Same report, Analyst Prose style (the Profiler house style)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-MARKET-REPORT-equity-research.pdf">AIDC-MARKET-REPORT-equity-research.pdf</a> — Same report, Sell-Side Research Note style
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-MARKET-REPORT-intel-briefing.pdf">AIDC-MARKET-REPORT-intel-briefing.pdf</a> — Same report, Intelligence Community Briefing style
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-MARKET-REPORT-smart-brevity.pdf">AIDC-MARKET-REPORT-smart-brevity.pdf</a> — Same report, Axios Smart Brevity style
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-COVERAGE-UNIVERSE.md">AIDC-COVERAGE-UNIVERSE.md</a> — Coverage Universe companion: the 40 companies under coverage, one entry each — position, evidence, falsifier and recommended strategy. Reissued on earnings, a faster clock than the report
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-COVERAGE-UNIVERSE.pdf">AIDC-COVERAGE-UNIVERSE.pdf</a> — Formatted coverage companion, BloombergNEF Research Report style (canonical edition; 51 pages)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-COVERAGE-UNIVERSE-analyst-prose.pdf">AIDC-COVERAGE-UNIVERSE-analyst-prose.pdf</a> — Same companion, Analyst Prose style
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-COVERAGE-UNIVERSE-equity-research.pdf">AIDC-COVERAGE-UNIVERSE-equity-research.pdf</a> — Same companion, Sell-Side Research Note style
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-COVERAGE-UNIVERSE-intel-briefing.pdf">AIDC-COVERAGE-UNIVERSE-intel-briefing.pdf</a> — Same companion, Intelligence Community Briefing style
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-COVERAGE-UNIVERSE-smart-brevity.pdf">AIDC-COVERAGE-UNIVERSE-smart-brevity.pdf</a> — Same companion, Axios Smart Brevity style
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/aidc-market-report-print.html">aidc-market-report-print.html</a> — Typeset source the PDFs are rendered from (self-contained; inline CSS + SVG figures; five style skins)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/aidc-coverage-universe-print.html">aidc-coverage-universe-print.html</a> — Typeset source for the Coverage Universe companion (same five style skins; rendered by the same build script via --doc coverage)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/CHANGELOG.md">CHANGELOG.md</a>            — [template · initialized] Version history
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/CHANGELOG-archive.md">CHANGELOG-archive.md</a>    — [template · initialized] Older changelog sections (rotated from CHANGELOG.md)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/CLASP-PUSH-PILOT-SETUP.md">CLASP-PUSH-PILOT-SETUP.md</a> — Setup for the GitHub Actions → clasp push deployment pilot
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/CODING-GUIDELINES.md">CODING-GUIDELINES.md</a>    — [template · initialized] Domain-specific coding knowledge
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/DATA-POLL-ARCHITECTURE.md">DATA-POLL-ARCHITECTURE.md</a> — Data poll vs heartbeat architecture &amp; quota reference
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/ENTERPRISE-SETUP.md">ENTERPRISE-SETUP.md</a>     — Enterprise PAT policies, GAS auto-deploy token config, 404 troubleshooting, rotation
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/GOVERNANCE.md">GOVERNANCE.md</a>           — [template · initialized] Project governance
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/HIPAA-CODING-REQUIREMENTS.md">HIPAA-CODING-REQUIREMENTS.md</a> — Complete HIPAA regulatory reference for coding (Security Rule, Privacy Rule, Breach Notification, 2025 NPRM, implementation checklist)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/IMPROVEMENTS.md">IMPROVEMENTS.md</a>         — [template · initialized] Potential improvements
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/KNOWN-CONSTRAINTS-AND-FIXES.md">KNOWN-CONSTRAINTS-AND-FIXES.md</a>    — Architectural constraints &amp; resolved bug fixes (GAS double-iframe, postMessage, HMAC, deploy webhook)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/PROFILER-SCHEMA.md">PROFILER-SCHEMA.md</a>      — Profiler app company-profile data schema (single source of truth)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/PROFILER-STYLES.md">PROFILER-STYLES.md</a>      — Profiler dossier writing-style registry (active style + Default/Bloomberg/alternative styles with mock-ups)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/industry-guidance">industry-guidance/</a>   — Analyses of industry-wide documents feeding the Profiler app's admin-only Industry Guidance modules (not deployed)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/industry-guidance/bess-bankability-certification-analysis.md">bess-bankability-certification-analysis.md</a> — Bankability &amp; certification for grid-scale BESS (research synthesis; source of truth for the in-app module)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/industry-guidance/bess-technology-fundamentals-analysis.md">bess-technology-fundamentals-analysis.md</a> — BESS technology fundamentals for the sales team (teaching synthesis from verified internal material; source of truth for the in-app training module)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/industry-guidance/china-policy-stack-analysis.md">china-policy-stack-analysis.md</a> — The China policy stack for a BESS seller (research synthesis; source of truth for the in-app module)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/industry-guidance/nvidia-800vdc-analysis.md">nvidia-800vdc-analysis.md</a> — Full analysis + study guide of NVIDIA's Aug 2026 800 VDC white paper (source of truth for the in-app module; claims ledger verified by two extraction passes)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/industry-guidance/power-infrastructure-aidc-analysis.md">power-infrastructure-aidc-analysis.md</a> — Power infrastructure &amp; the AIDC power chain (teaching synthesis from verified internal material; source of truth for the in-app training module)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/industry-guidance/utility-aidc-procurement-analysis.md">utility-aidc-procurement-analysis.md</a> — Utility procurement meets AIDC load, five case studies (research synthesis; source of truth for the in-app module)
│   │   └── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/industry-guidance/sources">sources/</a> — Committed source documents
│   │       └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/industry-guidance/sources/nvidia-800vdc-white-paper-2026-08.pdf">nvidia-800vdc-white-paper-2026-08.pdf</a> — NVIDIA, 800 VDC Architecture: Industry Alignment &amp; Execution (36 pp, image-only PDF)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep">study-prep/</a>           — Technology lesson plans from the Profiler Prep Command (not deployed)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/byd">byd/</a> — BYD technology curriculum
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/byd/byd-lesson-plan.md">byd-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/catl">catl/</a> — CATL technology curriculum
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/catl/catl-lesson-plan.md">catl-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/flexgen">flexgen/</a> — FlexGen technology curriculum
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/flexgen/flexgen-lesson-plan.md">flexgen-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/fluence">fluence/</a> — Fluence technology curriculum
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/fluence/fluence-lesson-plan.md">fluence-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/hithium">hithium/</a> — Hithium technology curriculum
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/hithium-lesson-plan.md">hithium-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/hithium-interview-brief.md">hithium-interview-brief.md</a> — Sales-role interview layer: the FEOC/tariff/FCC regulatory stack, objection handling, questions to ask, self-test
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/HITHIUM-INTERVIEW-BRIEF.pdf">HITHIUM-INTERVIEW-BRIEF.pdf</a> — The interview brief typeset for print/download, BloombergNEF Research Report style (21 pages)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/hithium-strategy-addendum.md">hithium-strategy-addendum.md</a> — Short companion to the brief: strategies to propose, the AI-data-centre position, questions to ask
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/HITHIUM-STRATEGY-ADDENDUM.pdf">HITHIUM-STRATEGY-ADDENDUM.pdf</a> — The addendum typeset for print/download, masthead-only shell with no contents block (3 pages)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/hithium-relationship-web.md">hithium-relationship-web.md</a> — The US AIDC containerized-BESS relationship web from Hithium's seat: the eight-layer value chain, verified-relationship grades, the cell-brand decision map, and Mermaid diagrams (synthesized from the 88-dossier base)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/hithium-ic-playbook.md">hithium-ic-playbook.md</a> — Phase 4 sales strategy, IC layer: the channel map &amp; account targeting, the one-call qualification script, the MACR-as-a-service play, objection handling, the Jupiter account defense, and the red-lines list
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/HITHIUM-IC-PLAYBOOK.pdf">HITHIUM-IC-PLAYBOOK.pdf</a> — The IC playbook typeset for print/download, BloombergNEF Research Report style (7 pages)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/hithium-team-lead-playbook.md">hithium-team-lead-playbook.md</a> — Phase 4 sales strategy, leadership layer: demand-pool coverage plan, the dated policy calendar, competitive rules of engagement, pipeline/forecast discipline, and the 2026-28 play
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/HITHIUM-TEAM-LEAD-PLAYBOOK.pdf">HITHIUM-TEAM-LEAD-PLAYBOOK.pdf</a> — The team-lead playbook typeset for print/download, BloombergNEF Research Report style (6 pages)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/hithium-team-training-curriculum.md">hithium-team-training-curriculum.md</a> — Phase 5 team training: the four-week onboarding program sequencing the guidance modules, playbooks, and dossier base, with competency gates and the trainer's manual
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/hithium/HITHIUM-TEAM-TRAINING-CURRICULUM.pdf">HITHIUM-TEAM-TRAINING-CURRICULUM.pdf</a> — The training curriculum typeset for print/download, BloombergNEF Research Report style (5 pages)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/megmeet">megmeet/</a> — Megmeet technology curriculum
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/megmeet/megmeet-lesson-plan.md">megmeet-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/megmeet/MEGMEET-LESSON-PLAN.pdf">MEGMEET-LESSON-PLAN.pdf</a> — The lesson plan typeset for print/download, BloombergNEF Research Report style (5 pages)
│   │   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/megmeet/megmeet-interview-brief.md">megmeet-interview-brief.md</a> — Sales-role interview layer: NA go-to-market, objection handling, questions to ask, self-test
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/megmeet/MEGMEET-INTERVIEW-BRIEF.pdf">MEGMEET-INTERVIEW-BRIEF.pdf</a> — The interview brief typeset for print/download, BloombergNEF Research Report style (13 pages)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/sinexcel">sinexcel/</a> — Sinexcel technology curriculum
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/sinexcel/sinexcel-lesson-plan.md">sinexcel-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/sungrow">sungrow/</a> — Sungrow technology curriculum
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/sungrow/sungrow-lesson-plan.md">sungrow-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/tesla">tesla/</a> — Tesla technology curriculum
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/tesla/tesla-lesson-plan.md">tesla-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/wartsila">wartsila/</a> — Wärtsilä technology curriculum
│   │   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/wartsila/wartsila-lesson-plan.md">wartsila-lesson-plan.md</a> — Full-depth 5-module lesson plan
│   │   └── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/study-prep/zhonhen">zhonhen/</a> — Zhonhen Electric interview preparation
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/zhonhen-deck-summary.md">zhonhen-deck-summary.md</a> — Absorption summary of the company-provided AIDC introduction deck (confidential source; summary for personal prep only)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/ZHONHEN-DECK-SUMMARY.pdf">ZHONHEN-DECK-SUMMARY.pdf</a> — The deck summary typeset for print/download (4 pages)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/zhonhen-lesson-plan.md">zhonhen-lesson-plan.md</a> — Technology lesson plan: the Western AC chain vs China's HVDC (240V/336V/800Vdc), five modules ending in interview scripts
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/ZHONHEN-LESSON-PLAN.pdf">ZHONHEN-LESSON-PLAN.pdf</a> — The lesson plan typeset for print/download, BloombergNEF Research Report style (6 pages)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/zhonhen-interview-brief.md">zhonhen-interview-brief.md</a> — First-round interview layer: the interviewer read, the HVDC/Panama architecture story, the US entry problem, regulatory stack, questions to ask, self-test
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/ZHONHEN-INTERVIEW-BRIEF.pdf">ZHONHEN-INTERVIEW-BRIEF.pdf</a> — The interview brief typeset for print/download, BloombergNEF Research Report style (11 pages)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/zhonhen-strategy-report.md">zhonhen-strategy-report.md</a> — US AIDC market-entry strategy report: SST/MV positioning, the ERCOT ride-through &amp; GPU-flicker sale, relationship leverage, verified neocloud targets (confidential — contains first-hand relationship intel)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/ZHONHEN-STRATEGY-REPORT.pdf">ZHONHEN-STRATEGY-REPORT.pdf</a> — The strategy report typeset for print/download, BloombergNEF Research Report style (15 pages)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/zhonhen-block-composition.md">zhonhen-block-composition.md</a> — Technical-sales argument: how the Panama/SuperX/container lineup composes into NVIDIA&#39;s 4.8 MW block standard, with the interface scorecard and ten engineering questions
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/ZHONHEN-BLOCK-COMPOSITION.pdf">ZHONHEN-BLOCK-COMPOSITION.pdf</a> — The composition story typeset for print/download (4 pages)
│   │       ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/zhonhen-one-pager.md">zhonhen-one-pager.md</a> — Interview-day scan sheet: the opener, TRU-vs-SST, ERCOT&#39;s binding numbers, the 473 kW/m³ argument segmented by buyer, landmines, and the Schneider question
│   │       └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/study-prep/zhonhen/ZHONHEN-ONE-PAGER.pdf">ZHONHEN-ONE-PAGER.pdf</a> — The scan sheet typeset for print/download, dense variant of the BloombergNEF skin (2 pages)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/RULE-COST-AUDIT.md">RULE-COST-AUDIT.md</a>       — Rule cost audit — ranked table, trim-recommendation checklist (T1–T9), progress tracking
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/TODO.md">TODO.md</a>                 — [template · initialized] Actionable to-do items
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/FUTURE-CONSIDERATIONS.md">FUTURE-CONSIDERATIONS.md</a> — [template] Deferred architectural ideas for scale
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/readme-qr-code.png">readme-qr-code.png</a>             — [template · initialized] QR code linking to this repo
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/REMINDERS.md">REMINDERS.md</a>            — [template] Reminders for Developer (developer's own notes)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/SESSION-CONTEXT.md">SESSION-CONTEXT.md</a>      — [template] Previous Session Context (Claude-written session log)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/SKILLS-REFERENCE.md">SKILLS-REFERENCE.md</a>     — [template] Complete Claude Code skills inventory (custom + imported + bundled)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/repository.version.txt">repository.version.txt</a>  — [template] Repo version (v01.XXr — bumps every push)
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/TOKEN-BUDGETS.md">TOKEN-BUDGETS.md</a>        — [template · initialized] Token cost reference for CLAUDE.md
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/SUPPORT.md">SUPPORT.md</a>              — [template · initialized] Getting help
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/repository-information/archive%20info">archive info/</a>         — [template] Archived plans, implementation guides, and design documents
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/01-CUSTOM-AUTH-PATTERN.md">01-CUSTOM-AUTH-PATTERN.md</a> — [template] Custom Auth implementation reference (GAS + custom domain)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/02-GOOGLE-OAUTH-AUTH-PATTERN.md">02-GOOGLE-OAUTH-AUTH-PATTERN.md</a> — [template] Google OAuth (GIS) auth implementation reference
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/03-IMPROVED-GOOGLE-OAUTH-PATTERN.md">03-IMPROVED-GOOGLE-OAUTH-PATTERN.md</a> — [template] Improved Google OAuth pattern with server-side sessions
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md">04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md</a> — [template] Research-validated OAuth pattern (strict origin, re-auth fallback, CacheService caveats)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/05-HIPAA-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md">05-HIPAA-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md</a> — [template] HIPAA-compliant OAuth pattern (audit logging, domain restriction, session integrity)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md">06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md</a> — [template] Unified config-driven auth pattern (toggleable features, standard &amp; HIPAA presets)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md">07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md</a> — [template] Security hardening plan for testauthgas1 (6 phases, implemented)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/08-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md">08-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md</a> — [template] Security update plan II for testauthgas1 (7 phases, 19 vulnerabilities — ready for implementation)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/09-CROSS-DEVICE-SESSION-ENFORCEMENT-PLAN.md">09-CROSS-DEVICE-SESSION-ENFORCEMENT-PLAN.md</a> — [template] Cross-device single-session enforcement plan (6 phases — ready for implementation)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/09.1-CROSS-DEVICE-SESSION-ENFORCEMENT-REVISED-PLAN.md">09.1-CROSS-DEVICE-SESSION-ENFORCEMENT-REVISED-PLAN.md</a> — [template] Revised cross-device enforcement plan (google.script.run approach — zero doGet overhead)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/09.1.1-CROSS-DEVICE-SESSION-ENFORCEMENT-DRIVE-PLAN.md">09.1.1-CROSS-DEVICE-SESSION-ENFORCEMENT-DRIVE-PLAN.md</a> — [template] Drive file approach for cross-device enforcement (zero server polling cost — with caveats)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/09.2-CROSS-DEVICE-SESSION-ENFORCEMENT-HEARTBEAT-PLAN.md">09.2-CROSS-DEVICE-SESSION-ENFORCEMENT-HEARTBEAT-PLAN.md</a> — [template] Heartbeat piggyback approach for cross-device enforcement (zero new polling — simplest mechanism)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/10-EMR-SECURITY-HARDENING-PLAN.md">10-EMR-SECURITY-HARDENING-PLAN.md</a> — [template] EMR security hardening plan — HIPAA technical safeguards for patient data protection
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/10.1-SECURITY-REMEDIATION-GUIDE.md">10.1-SECURITY-REMEDIATION-GUIDE.md</a> — [template] Implementation-ready remediation guide for all security audit findings
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/10.2-CATEGORY3-CODE-IMPLEMENTATION-GUIDE.md">10.2-CATEGORY3-CODE-IMPLEMENTATION-GUIDE.md</a> — [template] Category 3 code implementation guide — phased fixes for 12 must-implement findings
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/10.3-DJB2-TO-HMAC-MIGRATION-PLAN.md">10.3-DJB2-TO-HMAC-MIGRATION-PLAN.md</a> — [template] DJB2 → HMAC-SHA256 migration plan for GAS session HTML messages
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/10.4-SINGLE-LOAD-AUTH-OPTIMIZATION-PLAN.md">10.4-SINGLE-LOAD-AUTH-OPTIMIZATION-PLAN.md</a> — [template] Single-load auth optimization — reduce standard path login from 2 doGet() to 1
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/10.4.1-HIPAA-SINGLE-LOAD-AUTH-OPTIMIZATION-PLAN.md">10.4.1-HIPAA-SINGLE-LOAD-AUTH-OPTIMIZATION-PLAN.md</a> — [template] HIPAA single-load auth optimization — reduce HIPAA path login from 2 doGet() to 1 via innerHTML SPA technique
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/10.4.1-IMPLEMENTATION-FINDINGS.md">10.4.1-IMPLEMENTATION-FINDINGS.md</a> — [template] Implementation findings from 10.4.1 attempt — issues, learnings, and recommendations for future re-attempt
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/11-EMR-GAS-APPLICATION-LAYER-PLAN.md">11-EMR-GAS-APPLICATION-LAYER-PLAN.md</a> — [template] EMR GAS application layer plan — HIPAA data access, RBAC, consent &amp; disclosure
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/12-HIPAA-SSO-IMPLEMENTATION-PLAN.md">12-HIPAA-SSO-IMPLEMENTATION-PLAN.md</a> — [template] HIPAA-compliant SSO plan — portal HIPAA conversion + BroadcastChannel cross-page auth
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/13-SSO-TOKEN-REFRESH-AND-CROSS-TAB-ACTIVITY-PLAN.md">13-SSO-TOKEN-REFRESH-AND-CROSS-TAB-ACTIVITY-PLAN.md</a> — SSO token-refresh coordination (Plan 12 Phase 6) + cross-tab activity keepalive spec
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/AUTH-DIRECT-ACCESS-FIX.md">AUTH-DIRECT-ACCESS-FIX.md</a> — Troubleshooting write-up: fixing direct URL access to authenticated GAS apps (12 attempts, root causes, final fix)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/GAS-TEST-FUNCTIONS-REFERENCE.md">GAS-TEST-FUNCTIONS-REFERENCE.md</a> — [template] Archived test/diagnostic GAS functions for reference (6 functions with code blocks)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/HIPAA-COMPLIANCE-REFERENCE.md">HIPAA-COMPLIANCE-REFERENCE.md</a> — [Superseded] HIPAA Security Rule compliance reference (all safeguards, implementation status)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/HIPAA-PHASE-A-IMPLEMENTATION-GUIDE.md">HIPAA-PHASE-A-IMPLEMENTATION-GUIDE.md</a> — Phase A implementation guide (Privacy Rule: #19 Disclosure Accounting, #23 Right of Access, #24 Right to Amendment)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/HIPAA-PHASE-B-IMPLEMENTATION-GUIDE.md">HIPAA-PHASE-B-IMPLEMENTATION-GUIDE.md</a> — Phase B implementation guide (Extensions: #19b Grouped Disclosures, #23b Summary Export, #24b Amendment Notifications, #18 Retention, #28 Breach Detection, #31 Breach Logging, #25 Representatives)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/HIPAA-PHASE-C-IMPLEMENTATION-GUIDE.md">HIPAA-PHASE-C-IMPLEMENTATION-GUIDE.md</a> — Phase C implementation guide (Retention Deep Dive: #18 Last-in-Effect Date, #18b Legal Hold, Compliance Audit, Archive Integrity, Policy Documentation)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/HIPAA-TESTAUTHGAS1-ANALYSIS.md">HIPAA-TESTAUTHGAS1-ANALYSIS.md</a> — Deep compliance analysis: all 40 checklist items vs actual code (v01.00g, v01.00w)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/HIPAA-TESTAUTHGAS1-COMPLIANCE-REPORT.md">HIPAA-TESTAUTHGAS1-COMPLIANCE-REPORT.md</a> — testauthgas1 HIPAA compliance assessment (40 items evaluated, gaps &amp; strengths)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/HIPAA-TESTAUTHGAS1-IMPLEMENTATION-FOLLOWUP.md">HIPAA-TESTAUTHGAS1-IMPLEMENTATION-FOLLOWUP.md</a> — Follow-up compliance progress (v01.00g→v01.00g, v01.00w→v01.00w, updated scorecard &amp; gap analysis)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/MICROSOFT-AUTH-PLAN.md">MICROSOFT-AUTH-PLAN.md</a> — [template] Microsoft auth implementation plan (MSAL.js + Azure AD)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/SESSION-MANAGER-PLAN.md">SESSION-MANAGER-PLAN.md</a> — [template] Cross-project Session Manager implementation plan (reverted)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/TEMPLATE-UPDATE-PLAN.md">TEMPLATE-UPDATE-PLAN.md</a> — [template] Phased plan to sync auth templates with testauthgas1
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/repository-information/archive%20info/pending-close-design-doc.md">pending-close-design-doc.md</a> — [Deferred] Server-side session invalidation on tab close (sendBeacon + pendingClose pattern)
│
<b>─── Claude Code ──────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/blob/main/CLAUDE.md">CLAUDE.md</a>                   — [template · initialized] Developer instructions
├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude">.claude/</a>                   — [template]
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/settings.json">settings.json</a>           — [template · modified] Claude Code project settings (permissions + Stop hook wiring)
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/hooks">hooks/</a>                  — Repo-tracked Claude Code hooks, wired via settings.json
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/hooks/stop-hook-git-check.sh">stop-hook-git-check.sh</a> — Stop event: checks for uncommitted/untracked/unpushed work; runs `git fetch --prune` first to avoid stale-ref false positives
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/rules">rules/</a>                  — [template] Always-loaded + path-scoped rules
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/behavioral-rules.md">behavioral-rules.md</a>        — [template · modified] Always loaded — execution style, pushback, etc.
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/changelog-security.md">changelog-security.md</a>     — [template · initialized] Path-scoped — HIPAA/PHI + attack-surface rules for public changelogs
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/changelogs.md">changelogs.md</a>              — [template · initialized · modified] Path-scoped — CHANGELOG rules
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/chat-bookends.md">chat-bookends.md</a>           — [template · modified] Always loaded — response formatting rules
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/chat-bookends-reference.md">chat-bookends-reference.md</a> — [template] Path-scoped — bookend examples &amp; tables
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/cli-styling-reference.md">cli-styling-reference.md</a>   — Path-scoped — CLI accent styling tables + patterns (triggers on chat-bookends.md + output-formatting.md + CLAUDE.md)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/dead-code-detection.md">dead-code-detection.md</a>     — Path-scoped — dead-code analysis methodology (triggers on HTML pages + GAS files + workflow files; user-invoked via "check for dead code")
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/gas-scripts.md">gas-scripts.md</a>             — [template · modified] Path-scoped — GAS core rules (version, config, commit naming, Deploy Handler Protection)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/gas-scripts-reference.md">gas-scripts-reference.md</a>   — Path-scoped — GAS reference material (architecture, setup, webhook, live version check, partial OAuth grants, Google multi-account routing, templates, UI, visual verification)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/html-pages.md">html-pages.md</a>             — [template · modified] Path-scoped — HTML page core rules (build version, private repo, template propagation, test quality, auth wall)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/html-pages-reference.md">html-pages-reference.md</a>   — Path-scoped — HTML page reference (setup, rename, directory structure, Template vs Project Code Separation, visual verification)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/imported-skills.md">imported-skills.md</a>         — Path-scoped — "Imported Skills — Do Not Modify" rule (triggers on `.claude/skills/imported--*/**`)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/init-scripts.md">init-scripts.md</a>           — [template] Path-scoped — init script rules
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/mermaid-diagrams.md">mermaid-diagrams.md</a>        — [template · initialized] Path-scoped — deep mermaid reference (rendering + pako URL encoding)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/output-formatting.md">output-formatting.md</a>      — [template · modified] Always loaded — CLI styling quick rule, attribution, reminders format
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/industry-guidance.md">industry-guidance.md</a>       — Path-scoped — Industry Guidance Command (document analysis → admin-gated in-app study modules; user-invoked via "industry guidance: &lt;document&gt;")
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/profiler-app.md">profiler-app.md</a>            — Path-scoped — Profiler Command (company dossier research + generation; triggers on Profiler app files; user-invoked via "profiler &lt;Company&gt;")
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/scraper-sources.md">scraper-sources.md</a>         — Path-scoped — Scraper source roster: unavailable-outlet memory + mandatory feed probe before adding a source
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/pre-commit-gates.md">pre-commit-gates.md</a>        — [template · initialized] Path-scoped — full TEMPLATE REPO / MULTI-SESSION gate logic
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/repo-docs.md">repo-docs.md</a>              — [template · initialized · modified] Path-scoped — documentation rules
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/rule-management.md">rule-management.md</a>         — Path-scoped — Rule Placement Autonomy + Rule Precedence + Section Placement Guide (triggers on CLAUDE.md + `.claude/rules/**`)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/rules-maintenance.md">rules-maintenance.md</a>       — Path-scoped — Diff Rules + Repo Audit command bodies (triggers on CLAUDE.md + `.claude/rules/**`)
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/visual-test-command.md">visual-test-command.md</a>     — Path-scoped — Visual Test command body (triggers on HTML pages + GAS files)
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/rules/workflows.md">workflows.md</a>              — [template] Path-scoped — workflow rules
│   │
│   <b>│ ─ Skills ────────────────────────────────────────────────────────────────</b>
│   └── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills">skills/</a>                  — [template] Invokable workflow skills
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/imported--diff-review">imported--diff-review/</a>       — [template] /diff-review — pre-push differential review
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/imported--diff-review/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/imported--frontend-design">imported--frontend-design/</a>   — [template] /frontend-design — distinctive UI creation
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/imported--frontend-design/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/imported--git-cleanup">imported--git-cleanup/</a>       — [template] /git-cleanup — stale branch/worktree cleanup
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/imported--git-cleanup/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/imported--security-review">imported--security-review/</a>   — [template] /security-review — OWASP/web security audit
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/imported--security-review/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/imported--skill-creator">imported--skill-creator/</a>     — [template] /skill-creator — create new skills
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/imported--skill-creator/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/imported--webapp-testing">imported--webapp-testing/</a>    — [template] /webapp-testing — Playwright page testing
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/imported--webapp-testing/SKILL.md">SKILL.md</a>                — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/initialize">initialize/</a>          — [template] /initialize — first deployment setup
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/initialize/SKILL.md">SKILL.md</a>        — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/maintenance-mode">maintenance-mode/</a>    — [template] /maintenance-mode — toggle maintenance overlay
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/maintenance-mode/SKILL.md">SKILL.md</a>        — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/new-page">new-page/</a>            — [template] /new-page — create new HTML page with boilerplate
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/new-page/SKILL.md">SKILL.md</a>        — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/phantom-update">phantom-update/</a>      — [template] /phantom-update — timestamp alignment
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/phantom-update/SKILL.md">SKILL.md</a>        — [template]
│       ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/reconcile">reconcile/</a>           — [template] /reconcile — end multi-session mode
│       │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/reconcile/SKILL.md">SKILL.md</a>        — [template]
│       └── <a href="https://github.com/LightAISolutions/Sales/tree/main/.claude/skills/remember-session">remember-session/</a>    — [template] /remember-session — save session context
│           └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.claude/skills/remember-session/SKILL.md">SKILL.md</a>        — [template]
│
<b>─── GitHub Configuration ─────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.github">.github/</a>                   — [template]
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.github/workflows">workflows/</a>              — [template] CI/CD pipeline
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.github/workflows/auto-merge-claude.yml">auto-merge-claude.yml</a> — [template · initialized] Auto-merge, GAS deploy, Pages deploy, library mirror
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.github/workflows/clasp-deploy-pilot.yml">clasp-deploy-pilot.yml</a> — clasp push deployment pilot
│   ├── <a href="https://github.com/LightAISolutions/Sales/tree/main/.github/ISSUE_TEMPLATE">ISSUE_TEMPLATE/</a>         — [template] Bug report &amp; feature request forms
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.github/ISSUE_TEMPLATE/bug_report.yml">bug_report.yml</a> — [template · initialized] Bug report form
│   │   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.github/ISSUE_TEMPLATE/feature_request.yml">feature_request.yml</a> — [template · initialized] Feature request form
│   │   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.github/ISSUE_TEMPLATE/config.yml">config.yml</a> — [template · initialized] Issue chooser config
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.github/PULL_REQUEST_TEMPLATE.md">PULL_REQUEST_TEMPLATE.md</a> — [template · initialized] PR checklist
│   ├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.github/FUNDING.yml">FUNDING.yml</a>             — [template · initialized] Sponsor button config
│   └── <a href="https://github.com/LightAISolutions/Sales/blob/main/.github/last-processed-commit.sha">last-processed-commit.sha</a> — [template] Inherited branch guard (commit SHA tracking)
│
<b>─── Configuration ────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.gitattributes">.gitattributes</a>              — [template] Line ending normalization (LF)
├── <a href="https://github.com/LightAISolutions/Sales/blob/main/.editorconfig">.editorconfig</a>               — [template] Editor formatting rules (indent, charset, EOL)
└── <a href="https://github.com/LightAISolutions/Sales/blob/main/.gitignore">.gitignore</a>                  — [template] Git ignore patterns
│
<b>─── Community ────────────────────────────────────────────────────────────────</b>
├── <a href="https://github.com/LightAISolutions/Sales/blob/main/CITATION.cff">CITATION.cff</a>                — [template · initialized] Citation metadata
├── <a href="https://github.com/LightAISolutions/Sales/blob/main/CODE_OF_CONDUCT.md">CODE_OF_CONDUCT.md</a>          — [template · initialized] Community standards
├── <a href="https://github.com/LightAISolutions/Sales/blob/main/CONTRIBUTING.md">CONTRIBUTING.md</a>             — [template · initialized] How to contribute
├── <a href="https://github.com/LightAISolutions/Sales/blob/main/LICENSE.md">LICENSE.md</a>                  — [template · initialized] Proprietary license
├── <a href="https://github.com/LightAISolutions/Sales/blob/main/SECURITY.md">SECURITY.md</a>                 — [template · initialized] Vulnerability reporting
└── <a href="https://github.com/LightAISolutions/Sales/blob/main/README.md">README.md</a>                   — [template · initialized] This file — project overview &amp; structure
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
