# Phase 7 decisions — owner switch-on

*Started 2026-10-01 (Opus 5.5 · high, interactive). Live switch-on of the Tour Guide: deploy, pair, routines, interview, the pilot `/plan`. Generic facts only — no ids, secrets, trip or place data of the owner's.*

## 1 Live findings

| # | Step | Finding | Fix |
|---|---|---|---|
| F1 | 0.3 re-pin | With the v01.28r core, `tools/integration-dryrun.mjs` failed one of 392 checks: a `reply` with `html: true` that carries an entity (`&amp;`) reached Telegram as `&amp;amp;` — `tgSafeHtml` escaped the whole text and re-opened only the safe tags, so every entity the brain wrote showed literally in the chat | **Fixed v01.29r**: `tgSafeHtml` restores `&amp;` `&lt;` `&gt;` `&quot;` and numeric entities after the tags and links (last, so an escaped `&lt;b&gt;` stays visible text); two new assertions in `tests/core_telegram.test.js`. The private dry run passes 392/392 with the fixed core |
| F2 | 1 deploy | The guide's §1 asks for a first `clasp push` from a local Personal checkout. `deploy-helper.yml` already pushes a pack that has a script id but no deployment id ("pushed, not deployed"), so the owner needs no checkout: create the project in the browser, add `CLASPRC_JSON` + `TOURGUIDE_SCRIPT_ID`, run **Deploy helper**, then create the web-app deployment in the editor and add `TOURGUIDE_DEPLOYMENT_ID` | Guide §1 rewritten once verified live |
| F3 | 1 deploy | The workflow runs `@google/clasp@2`; a `clasp login` from the current major writes a different `~/.clasprc.json` layout. The owner logs in with `npx @google/clasp@2 login` | Guide §1 names the major once verified live |

## 2 Choices

*(filled as the owner decides)*

Developed by: LightAISolutions
