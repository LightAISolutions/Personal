# Clasp-Push Deployment Pilot — Setup

A proof-of-concept that **GitHub Actions deploys an Apps Script project directly** (the *push* model), instead of the script pulling its own code from GitHub (the *pull* model the rest of this repo uses).

- **Project:** `googleAppsScripts/Claspdeploytest/` (`claspdeploytest.gs` + `appsscript.json`)
- **Workflow:** `.github/workflows/clasp-deploy-pilot.yml`
- **Coexists** with the existing pull-model projects — nothing else is changed. If the pilot proves out, this becomes the template for fixing the stale/empty-deployment problem (a push can restore even an empty project; a pull-webhook cannot).

## Why this is different

| | Pull model (current projects) | Push model (this pilot) |
|---|---|---|
| Who holds the token | the Apps Script (`GITHUB_TOKEN` in Script Properties) | GitHub (your clasp OAuth creds in repo secrets) |
| Direction | GAS fetches from GitHub | GitHub pushes into GAS |
| Recovers an *empty* deployment? | ❌ no handler to receive the trigger | ✅ code is pushed in regardless |
| Failure visibility | swallowed (`\|\| true`) | shows in the Actions log |

## One-time manual bootstrap (only you can do these — they need your Google login)

1. **Install + log in to clasp locally:**
   ```bash
   npm i -g @google/clasp
   clasp login
   ```
   This opens a browser, authenticates you, and writes `~/.clasprc.json` (contains the refresh token).
2. **Enable the Apps Script API** for your account: <https://script.google.com/home/usersettings> → *On*.
3. **Create the project** (gives you the `scriptId`):
   ```bash
   cd googleAppsScripts/Claspdeploytest
   clasp create --type webapp --title "Clasp Deploy Test"
   ```
   Note the `scriptId` it prints (also lands in a local `.clasp.json` — do **not** commit it).
4. **Add repo secrets** (Settings → Secrets and variables → Actions):
   - `CLASPRC_JSON` — the **full contents** of `~/.clasprc.json`
   - `CLASPDEPLOYTEST_SCRIPT_ID` — the `scriptId` from step 3
   - *(optional)* `CLASPDEPLOYTEST_DEPLOYMENT_ID` — a deployment id to pin so the web-app URL stays stable across deploys

## Run it

- **Actions tab → "Clasp Deploy Pilot" → Run workflow** (manual `workflow_dispatch`), or push a change under `googleAppsScripts/Claspdeploytest/` to `main`.
- Success = the Action's "Push + deploy" step completes and the web app reflects the new `VERSION`.

## Known wrinkle

The refresh token in `CLASPRC_JSON` can expire or rotate; if deploys start failing on auth, re-run `clasp login` and update the `CLASPRC_JSON` secret. This is the documented trade-off of clasp-in-CI — in exchange you get a deploy path that can heal empty deployments and surfaces its own failures.

## Notes on repo conventions

This pilot intentionally skips the live-site machinery (no embedding page, no `gs-versions/`/`gs-changelogs/` entry, not in the GAS Projects table) because nothing polls it — it is a standalone CI-deploy experiment, not a hosted page. `appsscript.json` carries no `Developed by:` line because JSON has no comment syntax.

Developed by: LightAISolutions
