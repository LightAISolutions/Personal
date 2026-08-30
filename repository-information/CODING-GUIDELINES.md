# Coding Guidelines

Domain-specific coding knowledge and architectural reference for this project. Claude reads this file on demand when working on the relevant feature area.

CLAUDE.md sections reference this file with: *See `repository-information/CODING-GUIDELINES.md` — section "X"*

---

## GAS Code Constraints

### window.top is load-bearing in GAS client code — never "simplify" it to window.parent
GAS HtmlService pages run inside Google's own sandbox iframe **within a Google wrapper page**. From GAS client code, `window.parent` is Google's wrapper (messages sent there are silently dropped) and `window.top` is the real embedding page. Every `window.top.postMessage` in `.gs` client code is deliberate. (Learned the hard way in v15.43r→v15.44r: a fleet-wide swap to `window.parent` broke the sign-in handshake on every app and was emergency-reverted.) Consequence: app pages cannot be nested inside another same-origin container without a message relay at the top window.
- **All GAS `.gs` code must be valid Google Apps Script syntax** — test mentally that strings, escapes, and quotes parse correctly before committing
- Avoid deeply nested quote escaping in HTML strings built inside `.gs` files. Instead, store values in global JS variables and reference them in `onclick` handlers (e.g. `_signInUrl` pattern)
- **`readPushedVersionFromCache()` must NOT delete the cache entry** — it must return the value without calling `cache.remove()`. Deleting it causes only the first polling client to see the update; all others miss the "Code Ready" blue splash reload. The cache has a 1-hour TTL and expires naturally.
- The GAS auto-update "Code Ready" splash flow works as follows:
  1. GitHub Actions workflow calls `doPost(?action=deploy)` on the **old** deployed GAS
  2. `pullAndDeployFromGitHub()` fetches new code from GitHub, updates the script, creates a new version, updates the deployment
  3. It writes the new version string to `CacheService.getScriptCache()` with key `"pushed_version"`
  4. Client-side JS polls `readPushedVersionFromCache()` every 15 seconds
  5. If the returned version differs from the version displayed in `#gv`, it sends a `gas-reload` postMessage to the parent embedding page
  6. The embedding page receives the message, sets session storage flags, reloads, and shows the blue "Code Ready" splash

---

## Race Conditions — Config vs. Data Fetch
- **Never fire `saveConfig` and a dependent data-fetch (`getFormData`) in parallel** — the data-fetch may read stale config values from the sheet
- When the client switches a config value (e.g. year) and needs fresh data for that value, **pass the value directly as a parameter** to the server function (e.g. `getFormData(_token, year)`) rather than relying on `saveConfig` completing first
- Server functions that read config should accept optional override parameters (e.g. `opt_yearOverride`) so the client can bypass the saved config when needed
- This pattern avoids race conditions without needing to chain callbacks (which adds latency)

---

## API Call Optimization (Scaling Goal)
- **Minimize Google API calls** in every GAS function — the app is designed to scale to many users
- **Cache `getUserInfo` results** in `CacheService` (keyed by token suffix) for 5 minutes to avoid hitting the OAuth userinfo endpoint on every `google.script.run` call
- **Cache `checkSpreadsheetAccess` results** in `CacheService` (keyed by email) for 10 minutes to avoid listing editors/viewers on every call
- **Open `SpreadsheetApp.openById()` once per function** — pass the `ss` object to `checkSpreadsheetAccess(email, opt_ss)` instead of opening the spreadsheet twice
- When adding new server-side functions, always consider: can this result be cached? Can I reuse an already-opened spreadsheet object? Avoid redundant `UrlFetchApp` or `SpreadsheetApp` calls
- Cache TTLs are intentionally short (5–10 min) so permission changes and token revocations take effect quickly

---

## UI Dialogs — No Browser Defaults
- **Never use `alert()`, `confirm()`, or `prompt()`** — all confirmation dialogs, alerts, and input prompts must use custom styled HTML/CSS modals
- This applies to both GAS `.gs` code and parent embedding pages (`.html`)
- Use overlay + modal patterns consistent with the existing sheet/modal styles in the codebase

---

## AudioContext & Browser Autoplay Policy
- **AudioContext starts as `'suspended'`** on every page load — browsers require a user gesture (click/touch) before allowing audio playback
- **`resume()` without a gesture** generally stays pending or silently fails. It does NOT reject — the promise just never resolves, which causes dangling `.then()` callbacks that fire unexpectedly when the user eventually clicks
- **Never schedule `decodeAudioData` + `source.start(0)` while context is suspended** — the audio gets queued and plays the moment the context resumes (on user click), causing surprise delayed sound. Instead, gate playback behind `if (ctx.state !== 'running') return`
- **JS-triggered `window.location.reload()` vs manual F5 refresh** behave differently: JS reload carries forward the gesture allowance (AudioContext can auto-resume), F5 does NOT. So auto-refresh reloads can play sound, but manual refreshes cannot
- **`onstatechange` fires before DOM is ready**: when `resume()` is called early in the script, `onstatechange` may fire before the `#audio-status` element exists — the `updateAudioStatus()` call bails silently and never retries. Fix: save the resume promise and chain `updateAudioStatus` onto it after the element is created
- **Use `sessionStorage` (not `localStorage`) for audio state flags** — `sessionStorage` is per-tab, so a flag set in one tab doesn't leak into new tabs that have no gesture context. `localStorage` would cause false-positive "sound ready" icons in fresh tabs
- **The `audio-unlocked` sessionStorage flag** remembers that audio was successfully unlocked in this tab. On F5 refresh, the AudioContext is suspended but the flag tells the icon to show "ready" instead of "muted" — because a click will instantly restore it. Without this flag, the icon flashes "muted" on every refresh even though audio works fine
- **Chrome "Duplicate Tab" copies `sessionStorage`** — including the `audio-unlocked` flag — into the new tab, but the new tab has no gesture context, so the AudioContext is suspended. The stale flag causes the icon to falsely show "sound ready." Fix: use `performance.getEntriesByType('navigation')` to detect the navigation type; if it's anything other than `'reload'` (e.g. `'navigate'` for duplicate tab, back/forward, or new navigation), clear the `audio-unlocked` flag before creating the AudioContext. This must run **before** `new AudioContext()` so that `updateAudioStatus()` sees the correct flag state from the start

---

## Google Sign-In (GIS) for GAS Embedded Apps
When a GAS app embedded in a GitHub Pages iframe needs Google sign-in (e.g. to restrict access to authorized users), the sign-in **must run from the parent embedding page**, not from inside the GAS iframe.

### Why
- GAS iframes are served from dynamic `*.googleusercontent.com` subdomains with long hash-based hostnames that change when the deployment changes — they can't be reliably registered as OAuth origins
- Google OAuth requires the JavaScript origin to be registered in Cloud Console
- The parent GitHub Pages domain (e.g. `<your-org>.github.io`) is a stable origin that can be registered once

### Architecture
1. **GAS iframe** detects auth is needed → sends a `gas-needs-auth` postMessage to the parent (with `authStatus` and `email` fields)
2. **Parent embedding page** receives the message → shows an auth wall overlay → loads GIS and triggers sign-in popup
3. After successful sign-in → parent hides the auth wall → reloads just the iframe (`iframe.src = iframe.src`)
4. GIS code (Google Identity Services library) lives **only** in the parent HTML, never in the `.gs` file

### OAuth Setup (Google Cloud Console)
- **OAuth Client ID**: Create or use an existing OAuth 2.0 Client ID from your Google Cloud project (format: `<client-id>.apps.googleusercontent.com`)
- **Authorized JavaScript origins** must include your GitHub Pages domain (e.g. `https://<your-org>.github.io`) and any custom domains pointing to it
- To configure: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → edit the client → add the origin
- If you add new embedding domains (e.g. a custom domain), add those origins too

### Key postMessage Types for Auth
| Message Type | Direction | Purpose |
|---|---|---|
| `gas-needs-auth` | GAS iframe → parent | Tells parent to show sign-in wall (includes `authStatus`, `email`) |
| `gas-auth-complete` | GAS iframe → parent | Tells parent auth succeeded (hides wall, reloads iframe) |

---

## GCP Project Setup & Troubleshooting

### Initial Setup
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

### Image uploads (item photos) — "Failed to create image folder" / Drive errors

The Inventory Management app stores item photos in Google Drive via the Drive REST API. If you copy this repo to a new account / new GAS deployment, image upload fails until **both** of these are done — they are separate and both required:

1. **Drive OAuth scope in `appsscript.json`** — `oauthScopes` must include `"https://www.googleapis.com/auth/drive"`. Missing it produces `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT` (reason `insufficientPermissions`). After adding it you must **re-run any function in the editor and re-consent** — changing scopes invalidates the existing OAuth grant, so the old token still lacks Drive access until you re-approve.
2. **Enable the Drive API in the GCP project** — APIs & Services → Library → search "Google Drive API" → **Enable**. Missing it produces `403 SERVICE_DISABLED` ("Google Drive API has not been used in project NNN before or it is disabled"). The error includes an activation URL with the project number baked in (`https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=NNN`) — open it, click Enable, then **wait 2–5 minutes** for propagation before retrying.

Confirm the project number in the error matches the GCP project your script is actually linked to (Apps Script editor → Project Settings → GCP Project). The full appsscript.json (with the Drive scope) is in `.claude/rules/gas-scripts-reference.md` — "Setup Steps" step 2; the Drive-API enablement is step 5 there.

**Client-side image rendering:** images are NOT hot-linked from `drive.google.com/thumbnail` (Google blocks that endpoint from third-party origins → broken images). Instead the page fetches image bytes through the authenticated `getImageThumbnail` GAS RPC and renders them as `data:` URIs. No public/anyone-with-link sharing is relied on for display, so this keeps working on private Drive files.

Developed by: LightAISolutions
