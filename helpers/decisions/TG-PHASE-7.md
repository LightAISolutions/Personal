# Phase 7 decisions — owner switch-on

*Started 2026-10-01 (Opus 5.5 · high, interactive). Live switch-on of the Tour Guide: deploy, pair, routines, interview, the pilot `/plan`. Generic facts only — no ids, secrets, trip or place data of the owner's.*

## 1 Live findings

| # | Step | Finding | Fix |
|---|---|---|---|
| F1 | 0.3 re-pin | With the v01.28r core, `tools/integration-dryrun.mjs` failed one of 392 checks: a `reply` with `html: true` that carries an entity (`&amp;`) reached Telegram as `&amp;amp;` — `tgSafeHtml` escaped the whole text and re-opened only the safe tags, so every entity the brain wrote showed literally in the chat | **Fixed v01.29r**: `tgSafeHtml` restores `&amp;` `&lt;` `&gt;` `&quot;` and numeric entities after the tags and links (last, so an escaped `&lt;b&gt;` stays visible text); two new assertions in `tests/core_telegram.test.js`. The private dry run passes 392/392 with the fixed core |
| F2 | 1 deploy | The guide's §1 asks for a first `clasp push` from a local Personal checkout. `deploy-helper.yml` already pushes a pack that has a script id but no deployment id ("pushed, not deployed"), so the owner needs no checkout: create the project in the browser, add `CLASPRC_JSON` + `TOURGUIDE_SCRIPT_ID`, run **Deploy helper**, then create the web-app deployment in the editor and add `TOURGUIDE_DEPLOYMENT_ID` | Guide §1 rewritten once verified live |
| F3 | 1 deploy | The workflow runs `@google/clasp@2`; a `clasp login` from the current major writes a different `~/.clasprc.json` layout. The owner logs in with `npx @google/clasp@2 login` | Guide §1 names the major once verified live |
| F4 | 1 deploy | `npx @google/clasp@2 login` typed into the Node.js REPL fails with a syntax error; it is a shell command. The working route on Windows: Command Prompt, then `notepad %USERPROFILE%\.clasprc.json` to copy the file into the `CLASPRC_JSON` secret | Guide §1 says where to type it |
| F5 | 1 deploy | The "web app URL" is the deployment's `/exec` URL under **Deploy → Manage deployments**, not the repo's GitHub Pages site (an owner opened the Pages URL and got a 404). The `production` environment may already exist in Personal (it did); the three secrets are added to it | Guide §1 points at Manage deployments |
| F6 | 2 setup | `printSetupUrl()` run from the editor builds the link from the `/dev` URL (the core logs the WARNING; Telegram cannot reach `/dev`). Set Script Property `WEBAPP_URL` to the `/exec` URL **before** the first `printSetupUrl()`. Never screenshot the `SETUP URL:` log line: it carries `ADMIN_SECRET` (one owner screenshot did; rotated by deleting the property and re-running `printSetupUrl()`, which regenerates it) | Guide §3 reordered |
| F7 | 2 setup | Setup page steps 0–6, pairing, the test message and `/status` worked first time once `WEBAPP_URL` pointed at `/exec`; `/status` shows the owner's zone | none |
| F8 | 3 routines | The routine service wraps a fire's `text` in a `<routine-fire-payload>` block labelled untrusted and treats it as inert unless the saved prompt refers to it; the pack's prompts did not, so a routine could ignore the request id the core sends. The fire URL and token appear only after the routine is saved (Edit → Select a trigger → API; **Generate token** shows the token once), and every connected connector is included by default | All seven prompts name the block and limit it to a request id (TourGuide PR #6; `templates/private-repo/routines/README.md`); guide §4 rewritten |
| F9 | 3 routines | `/ask` end to end on the first try with the amended prompt: "Working on it…" about 30 s after the message (the webhook waits for the `/fire` call), a cited answer about 2 minutes later; the run's log line reached TourGuide `main` through `merge-routine-memory.yml` | none |
| F10 | 3 smoke | Places Aggregate live smoke: one `INSIGHT_COUNT` call around a public landmark (800 m, restaurants ≥ 4.5, operational) through the proxy answered in 682 ms; scratch ledger 1 unit, 0 failed. `areainsights.googleapis.com` is in the credential's hosts, so the Gem Funnel's stream 3 is live | none |
| F11 | 3 routines | A screenshot of the setup page's address bar showed most of `ADMIN_SECRET` (truncated). Guide §3 now says never to share the address bar either; the owner rotated the secret | Guide §3 |

## 2 Choices

- **Cloud project**: still on the free trial, so the per-API daily caps of TG-PHASE-6 §3 are deferred until billing is upgraded; the owner added a project budget alert. `MAPS_STATIC_KEY` was already in the routines' Claude environment.
- **Secrets home**: the existing `production` environment of the Personal repo, restricted to `main` (not the private repo).
- **`TIMEZONE`**: the owner's own IANA zone (not the core default); trip-check's `CRON_TZ` uses the same zone.
- **`MAX_ROUTINE_FIRES_PER_DAY`**: `24` as the guide recommends.
- **Routine environment**: the owner's existing Claude environment that already holds the Maps credentials, with `MAPS_USAGE_LEDGER`, `MAPS_SNAPSHOT_STORE` and `PREFS_REF_SALT` added.

Developed by: LightAISolutions
