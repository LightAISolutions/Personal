# Sample Components — Self-Updating GAS Starter Kit

Drop-in components for bootstrapping a new repo that follows the pattern used in this one: a static HTML page that polls a version file and auto-reloads, plus a Google Apps Script web app that pulls its own source from GitHub and redeploys itself on every push.

## What's in here

```
sample-components/
├── README.md                            — this file
├── sample.html                          — minimal page with version polling + auto-reload
├── sample.gs                            — minimal GAS web app with self-update
├── sample.config.json                   — GAS project config (single source of truth)
├── appsscript.json                      — GAS manifest (webapp + oauth scopes)
├── html-versions/
│   └── samplehtml.version.txt           — page version, polled by sample.html
├── gs-versions/
│   └── samplegs.version.txt             — GAS version (for cross-referencing)
└── workflows/
    └── auto-merge-and-deploy.yml        — minimal CI: merge claude/* → main + fire GAS deploy webhook
```

## How the auto-update works

**Browser side** — `sample.html` loads, fetches `html-versions/samplehtml.version.txt` to establish a baseline, then re-fetches every 10 seconds. When the version field changes, the page calls `window.location.reload()`.

**Server side** — `sample.gs` exposes `doPost(action=deploy)`. When called, it pulls the latest `.gs` source from GitHub using `UrlFetchApp`, compares the remote `VERSION` to the local one, overwrites the script content via the Apps Script API, mints a new GAS version, and re-points the existing deployment ID at that version.

**The link between them** — the GitHub Actions workflow merges `claude/*` branches into `main`, then `POST`s to the GAS web app's deployment URL with `action=deploy`. The GAS script self-updates within seconds of merge. The HTML page's version polling picks up any HTML-side changes on the next 10-second tick.

## Setup steps for a new repo

1. **Copy this folder** into the new repo. Move `workflows/auto-merge-and-deploy.yml` to `.github/workflows/auto-merge-and-deploy.yml`.
2. **Replace placeholders** in `sample.gs` and `sample.config.json`:
   - `YOUR_ORG_NAME`, `YOUR_REPO_NAME` — the new repo's `org/repo`
   - `YOUR_PROJECT_FOLDER` — wherever you keep `sample.gs` in the new repo (e.g. `gas/sample`)
   - `YOUR_PROJECT_TITLE` — page title shown in the browser tab
   - `YOUR_DEPLOYMENT_ID` — see step 4
3. **Create the GAS project**:
   - Go to <https://script.google.com>, create a project, paste `sample.gs` into `Code.gs`
   - Project Settings → Show `appsscript.json` → paste the contents of `appsscript.json`
   - Project Settings → Change GCP project (one you own); enable the Apps Script API in that GCP project
   - Run any function once from the editor to trigger the OAuth consent screen
4. **Deploy once and capture the DEPLOYMENT_ID**:
   - Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone
   - Copy the deployment ID (the `AKfycb...` string in the deployment URL) and paste it into `sample.gs` (`DEPLOYMENT_ID`) and `sample.config.json` (`DEPLOYMENT_ID`)
5. **Add `GITHUB_TOKEN` to Script Properties**:
   - Project Settings → Script Properties → Add: key `GITHUB_TOKEN`, value = a fine-grained PAT with read-only access to the new repo
6. **Push to a `claude/*` branch** (or directly to `main`) — the workflow merges, posts to the deploy webhook, and the GAS script self-updates from then on.

## Bootstrap caveat (chicken-and-egg)

The first deploy has to be manual because `DEPLOYMENT_ID` doesn't exist until you've deployed once. The workflow's deploy step is a no-op while `DEPLOYMENT_ID` is still the placeholder, so it won't error out during bootstrap.

## Renaming `sample` to your project name

The filenames (`sample.html`, `sample.gs`, `samplehtml.version.txt`, `samplegs.version.txt`, `sample.config.json`) embed the project key. To rename:

1. Rename all files together (`sample` → `yourname`)
2. Update `FILE_PATH` in `sample.gs` to the new path
3. The polling logic in `sample.html` derives the page name from the current URL, so it follows the HTML filename automatically — no edits needed

## What's *not* included (intentionally)

- Maintenance / inactive mode overlay
- Splash screens and sound playback
- Changelog popup
- Auth wall / Google Sign-In
- Spreadsheet caching, installable triggers
- Multi-project deploy steps in the workflow

These belong to the full template in this repo (`live-site-pages/templates/`). The sample-components folder is the **minimum** that makes the auto-update loop work; layer features on after that.

<!-- Developed by: LightAISolutions -->
