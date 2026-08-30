# Plan: Defer GAS Iframe Creation Until After Authentication

**Status:** Draft — not yet implemented
**Created:** 2026-04-05
**Affects:** `live-site-pages/testauthgas1.html`, `googleAppsScripts/Testauthgas1/testauthgas1.gs`

## Problem

The GAS iframe (`#gas-app`) is created on page load, before the user has authenticated. This means:
- The GAS deployment URL is visible in DevTools before sign-in
- The GAS app's HTML structure, JavaScript logic, and API patterns are exposed to unauthenticated users
- The GAS `doGet()` endpoint is hit before any auth check

**Goal:** The GAS iframe should not exist in the DOM until the user has successfully authenticated with Google.

## What We Tried (and Why It Failed)

### Attempt 1: Move iframe creation to `showApp()` (v03.87w)
**Approach:** Converted the iframe creation IIFE into a callable `_createGasIframe()` function, called from `showApp()` after authentication.

**Result:** Sign-in got stuck at "Requesting sign-in from Google" — the auth flow never completed.

**Root cause:** The iframe is the **transport layer** for authentication itself. The token exchange flow requires the iframe to exist:
1. Google OAuth returns an access token to the HTML layer
2. `exchangeToken()` is called, which calls either `exchangeViaUrl()` or `exchangeViaPostMessage()`
3. Both methods need `#gas-app` to exist:
   - `exchangeViaUrl()` (line ~1373): sets `gasApp.src = baseUrl + '?exchangeToken=' + token` — the iframe navigates to the GAS endpoint with the token as a URL parameter
   - `exchangeViaPostMessage()` (line ~1394): also needs the iframe to exist to receive the postMessage and navigate to the nonce URL
4. The GAS backend (`doGet()`) receives the token, validates it with Google, creates a session, and sends back session data via `parent.postMessage()`
5. The HTML layer's `message` event listener receives the session data and calls `showApp()`

**The chicken-and-egg problem:** You can't authenticate without the iframe, but you want the iframe to not exist until after authentication.

### Attempt 2: Move `_createGasIframe()` to `exchangeToken()` (not pushed)
**Approach:** Create the iframe just-in-time inside `exchangeToken()`, right before the token exchange needs it.

**Result:** Not deployed — user decided to revert to the original approach and plan a proper solution instead.

**Analysis:** This would have worked functionally (the iframe gets created right when needed), but it doesn't fully solve the security goal — the encoded deployment URL (`_gasBaseUrlEncoded`) is still in the page source, and the iframe still loads before the GAS backend has validated the user. It only prevents the iframe from being in the DOM during the initial page render.

### Current State (v03.88w)
Iframe loads on page load (original behavior). The GAS toggle button is hidden on the auth wall and shown after `showApp()` — so the user can't *see* the GAS layer before auth, but it exists in the DOM.

## Proposed Solution: Direct Token Exchange via `fetch()`

### Architecture Change
Instead of sending the Google access token through the iframe (by navigating it to `?exchangeToken=TOKEN`), exchange the token directly via a `fetch()` call from the HTML layer to the GAS endpoint. This removes the iframe from the authentication flow entirely.

### Flow: Current vs Proposed

**Current flow:**
```
1. Page loads → iframe created (doGet shell loads)
2. Google OAuth → access token
3. HTML sets iframe.src = gasUrl + '?exchangeToken=TOKEN'
4. GAS doGet() validates token, creates session
5. GAS sends parent.postMessage('gas-session-created', sessionData)
6. HTML receives message → showApp()
```

**Proposed flow:**
```
1. Page loads → NO iframe created
2. Google OAuth → access token
3. HTML calls fetch(gasUrl + '?action=exchangeToken&token=TOKEN')
4. GAS doGet() validates token, creates session, returns JSON
5. HTML parses JSON response → stores session → creates iframe → showApp()
6. Iframe loads with valid session already in place
```

### Implementation Steps

#### Step 1: Add JSON response mode to GAS `doGet()` (testauthgas1.gs)

Add a new action handler in `doGet()` that accepts `action=exchangeToken&token=TOKEN` and returns a JSON response instead of HTML:

```javascript
// In doGet(e):
if (e.parameter.action === 'exchangeToken') {
  var token = e.parameter.token;
  // ... validate token with Google (existing logic) ...
  // ... create session (existing logic) ...
  // Return JSON instead of HTML
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    sessionToken: sessionToken,
    email: email,
    role: role,
    displayName: displayName
  })).setMimeType(ContentService.MimeType.JSON);
}
```

**Key consideration:** GAS web apps have CORS restrictions. `fetch()` from a GitHub Pages origin to `script.google.com` will hit CORS. The workaround is to use `mode: 'no-cors'` — but then we can't read the response body. 

**CORS workaround options:**
- **Option A: JSONP pattern** — GAS returns `callback(data)` instead of JSON, loaded via a `<script>` tag. This bypasses CORS but is less secure.
- **Option B: Redirect pattern** — GAS validates the token and redirects back to the GitHub Pages URL with session data as URL parameters. The HTML layer reads the URL params on load.
- **Option C: Two-phase load** — Keep the iframe for token exchange but start it hidden (`display:none`) and only make it visible after auth. This is what we essentially have now with the toggle hiding.
- **Option D: GAS `doGet()` with `ContentService` and proper CORS headers** — GAS does NOT support setting custom CORS headers on `ContentService` responses. This option is not viable.

### CORS Reality Check

**This is the fundamental blocker.** Google Apps Script web apps do NOT support CORS for cross-origin `fetch()` requests. The `script.google.com` domain does not send `Access-Control-Allow-Origin` headers for `ContentService` JSON responses. This means:

- `fetch()` with `mode: 'cors'` → blocked by browser
- `fetch()` with `mode: 'no-cors'` → request succeeds but response body is opaque (unreadable)
- `fetch()` with credentials → still blocked by CORS preflight

**The iframe is the only reliable cross-origin communication channel** between GitHub Pages and GAS. This is by design — Google sandboxes GAS web apps and the iframe `postMessage` API is the intended cross-origin communication mechanism.

### Viable Alternative: Hidden Iframe for Auth Only

Since we can't eliminate the iframe from the auth flow due to CORS, the next best approach is:

1. Create a **minimal, hidden iframe** solely for token exchange — not the full GAS app
2. The hidden iframe loads a lightweight GAS endpoint (e.g. `?action=authOnly`) that:
   - Contains only the token exchange logic
   - Returns minimal HTML with just a `parent.postMessage()` call
   - No app UI, no data fetching, no sensitive code
3. After auth succeeds via postMessage, **destroy** the auth iframe
4. Create the full GAS app iframe with the authenticated session

**Benefits:**
- The full GAS app code (UI, data logic, API patterns) is never loaded pre-auth
- Only a minimal auth shim is exposed
- The deployment URL is still visible but the app internals are not

**Complexity:** Medium — requires splitting `doGet()` into two modes (auth-only vs full app) and managing two iframe lifecycles.

### Recommendation

**Option C (current approach with toggle hiding) is pragmatic** for now. The GAS app's server-side code is already protected by session validation — `doGet()` without valid auth shows nothing sensitive. The main exposure is the client-side JavaScript structure and the deployment URL, which are low-risk.

**Option "Hidden auth iframe"** is the right long-term solution if the threat model requires defense-in-depth against pre-auth code exposure. It should be planned as a dedicated feature with proper testing.

## Decision Points for Developer

1. **Is the current approach (iframe exists but hidden behind auth wall) acceptable?** If yes, no further work needed.
2. **Is the deployment URL exposure the main concern?** If so, note that the encoded URL (`_gasBaseUrlEncoded`) is in the HTML source regardless — removing the iframe doesn't hide the URL from someone reading the page source.
3. **Is the GAS app code exposure the concern?** The "hidden auth iframe" approach addresses this but adds complexity.
4. **Priority:** Is this security hardening urgent, or can it be deferred to a future session?

Developed by: LightAISolutions
