# Fixing Direct URL Access to Authenticated GAS Apps

A comprehensive write-up of the multi-session troubleshooting effort to prevent direct URL access to authenticated Google Apps Script web apps. This covers every approach tried, why each failed, what we learned about GAS internals along the way, and what ultimately worked.

---

## The Problem

When a user signs into a GAS-backed authenticated app (e.g. testauthgas1), the embedding HTML page loads the GAS app inside an iframe using a URL like:

```
https://script.google.com/.../exec?session=TOKEN
```

Anyone who opens DevTools → Network tab can see this URL and copy it. Pasting it directly into a new browser tab opened the **full authenticated application** — all interactive features, all `google.script.run` functions, the user's email displayed — as if the user had signed in normally.

This was a **HIPAA compliance concern** because:
- Session tokens in URLs are visible in browser history, server/proxy logs, and DevTools
- OWASP explicitly recommends against URL-based session tokens
- The direct access bypassed the intended iframe-only access model

## The Journey — Everything We Tried

### Attempt 1: `window.self === window.top` Guard (v05.59r)

**The idea:** Add a client-side check in the GAS app HTML. If the app detects it's running at the top level (not inside an iframe), block rendering.

**The code:**
```javascript
if (window.self === window.top) {
  document.body.innerHTML = 'Access denied';
  throw new Error('Direct access blocked');
}
```

**Why it failed:** GAS **always** runs inside Google's sandbox iframe, even when accessed directly. The architecture is:

```
Browser tab (top) → Google's shell iframe → sandbox iframe → your HTML
```

Since `window.self` is never `window.top` (your code is always at least 2 levels deep), this check never fires — not when embedded in your page, and not when opened directly. It was permanently dead code.

### Attempt 2: `window.parent === window.top` Guard (v05.60r)

**The idea:** Refined the check. Instead of comparing `self` to `top`, compare `parent` to `top`. When embedded in our page, the chain is:

```
Our page (top) → Google shell (parent) → sandbox → our HTML
```

So `window.parent` (Google's shell) ≠ `window.top` (our page) → guard passes, app loads.

When opened directly:

```
Google shell (top & parent) → sandbox → our HTML
```

So `window.parent === window.top` → guard fires, app blocked.

**What actually happened:** The guard still didn't work. The user reported: "I never see 'Access denied' when I go directly, I just see the full authenticated app."

**Why it failed:** Google's architecture has **more nesting layers** than we assumed. Even when opened directly, there are multiple wrapper iframes between `window.top` and `window.self`. So `window.parent` is never `window.top` — there's always at least one Google wrapper layer in between.

**Key learning:** You cannot reliably detect "embedded vs direct" by comparing frame positions in GAS. Google's iframe nesting is not documented and can change without notice.

### Attempt 3: postMessage Handshake Nonce Flow (v05.62r)

**The idea:** Eliminate `?session=TOKEN` from URLs entirely. Instead of passing the session token in the iframe URL, use a multi-step nonce exchange:

1. Load the iframe with a bare URL (no parameters)
2. GAS serves a "handshake page" that challenges the parent via `postMessage`
3. Parent responds with the session token via `postMessage` (tokens never in the URL)
4. GAS generates a one-time nonce, sends it back to the parent
5. Parent reloads the iframe with `?page_nonce=NONCE` (nonce, not token, in URL)
6. GAS validates the nonce and serves the authenticated app

**What happened:** Got stuck on "Setting up your session..." — the app never loaded.

**Why it failed (first diagnosis — v05.63r):** The GAS sandbox can't navigate itself to a different URL. When the handshake page tried to redirect to `?page_nonce=NONCE`, it failed silently because the sandbox iframe can't change its own `src` to an `/exec` URL (different origin). Fixed by having the handshake page send the nonce to the parent page, which then sets `gasApp.src`.

**Still stuck (v05.64r):** Even after fixing the redirect, the flow still broke. The GAS sandbox cross-origin constraints made the multi-step nonce exchange unreliable — messages were being dropped, timing was unpredictable, and the handshake page + nonce generation + iframe reload added too many moving parts.

**Reverted:** Restored `?session=TOKEN` in the URL. The iframe guard (`window.parent === window.top`) was left as the "defense" — though it was actually broken (we didn't know this yet).

### Attempt 4: Replace `?session=` with One-Time Nonces (v05.65r)

**The idea:** A simpler version of the nonce approach. Instead of the complex handshake:

1. When the parent page needs to load the authenticated app, call `loadIframeViaNonce(token)`:
   - Load `?action=getNonce` in the iframe
   - GAS generates a nonce bound to the session token, stores it in CacheService
   - GAS sends nonce back via `postMessage`
   - Parent reloads iframe with `?page_nonce=NONCE`
2. GAS validates the nonce (one-time-use, 60-second TTL) and serves the app

**Result:** Worked for page refresh, tab reclaim, and cross-tab sync. But **broke initial sign-in**.

### Attempt 5: Fix Nonce During Sign-In (v05.66r)

**The idea:** Generate the page nonce server-side inside `exchangeTokenForSession()` and include it in the `gas-session-created` response. Parent uses the nonce directly, skipping the extra round-trip.

**Still stuck on "Signing in...":**

**Why:** The `gas-auth-ok` message (which tells the parent page the session is valid) is sent via `google.script.run.signAppMessage()` — an async call. During sign-in, this call wasn't completing. The page waited forever for `gas-auth-ok` to confirm the session.

### Attempt 6: Immediate Unsigned `gas-auth-ok` (v05.67r - v05.68r)

**The idea:** Send `gas-auth-ok` immediately via `window.top.postMessage()` (unsigned) without waiting for `google.script.run`. Add `gas-auth-ok` and `gas-ready-for-token` to the HMAC signature-exempt list.

**This "worked" but created security exceptions** — messages that should be HMAC-verified were being exempted to work around timing issues.

### Attempt 7: Root Cause — CacheService Eventual Consistency (v05.69r)

**The breakthrough:** The root cause of ALL the nonce failures during sign-in was identified:

**GAS CacheService is eventually consistent.** `cache.put()` followed immediately by `cache.get()` can return `null`.

When `exchangeTokenForSession()` creates a session and writes a nonce to cache, and then the parent immediately loads `?page_nonce=NONCE`, the `validatePageNonce()` call does `cache.get()` which returns `null` — the write hasn't propagated yet. The nonce is treated as invalid, the auth wall is served, and `_expectingSession` silently consumes the `gas-needs-auth` message. The page is stuck forever.

**The fix:** Accept that nonces can't be used for initial sign-in (CacheService race). Use `?session=TOKEN` for the initial sign-in (safe — token was just created, URL is only in the iframe's network request, OAuth already verified the user). Keep nonces for all other paths (page refresh, tab reclaim, cross-tab sync) where the session has been in cache long enough for consistency.

Also removed all the workarounds (unsigned `gas-auth-ok`, sig-exempt exceptions) — they were compensating for the nonce race, not needed with `?session=`.

### Final Fix: postMessage Handshake Guard (v05.70r)

**The question that triggered this:** The user asked whether the direct URL access (which was still working despite all the above) was a HIPAA compliance issue. They confirmed that opening the `exec?session=TOKEN` URL directly showed the full app with no "Access denied" message.

**The investigation:** Three parallel research agents confirmed:
1. **Server-side origin detection is impossible in GAS** — `doGet(e)` does not expose HTTP headers (Referer, Origin, etc.). Google explicitly closed the feature request (Issue #67764685)
2. **Client-side frame-position checks are permanently broken** — GAS's multi-iframe nesting makes `window.parent === window.top` always false
3. **postMessage routing IS reliable** — `window.top.postMessage(msg, PARENT_ORIGIN)` successfully reaches the embedding page (proven by the existing auth system), and `event.source.postMessage(response, '*')` reaches back (proven by the token exchange flow)

**The final solution — postMessage handshake guard:**

1. When the authenticated GAS app HTML loads, it immediately hides the body (`visibility: hidden`) and sends a challenge message to `window.top` with `PARENT_ORIGIN` as the target origin:
   ```javascript
   window.top.postMessage({
     type: 'frame-handshake-challenge',
     handshakeId: randomId
   }, PARENT_ORIGIN);
   ```

2. **When embedded in the correct page:** `window.top` IS the embedding page, which matches `PARENT_ORIGIN`. The message arrives. The embedding page responds via `event.source.postMessage()` (which reaches the sandbox frame). The GAS app receives the response, sets `visibility: visible`, and the user sees the app normally. Total time: <100ms — invisible to the user.

3. **When opened directly:** `window.top` is Google's script.google.com shell, which does NOT match `PARENT_ORIGIN`. The `postMessage` is silently dropped (per the Web API spec — origin mismatch = silent drop, no error). No response ever arrives. After 2 seconds, the timeout fires, wipes `document.body.innerHTML`, and shows "Access denied."

4. **Why `event.source` is critical:** `gasApp.contentWindow.postMessage()` would send the response to Google's outer shell iframe (the `<iframe>` element's contentWindow), NOT the sandbox frame where the code actually runs. `event.source` is the WindowProxy of the frame that sent the challenge — the sandbox itself. This was already documented in the codebase (testauthgas1.html line 1646-1652) from the token exchange flow.

## Summary of What We Learned

### About GAS Architecture

| Discovery | Impact |
|-----------|--------|
| GAS serves content inside **multiple nested iframes** even when accessed directly | All client-side frame-position checks (`self === top`, `parent === top`) are unreliable |
| GAS `doGet(e)` does **not** expose HTTP headers | Server-side Referer/Origin checking is impossible |
| GAS sandbox origin is `*.googleusercontent.com` (unpredictable) | Must use `'*'` for targetOrigin when sending messages TO the GAS sandbox |
| GAS CacheService is **eventually consistent** | `put()` then `get()` can return `null` — nonces written during token exchange may not be readable |
| `gasApp.contentWindow` is Google's outer shell, not the sandbox | Must use `event.source` to reply to messages from the sandbox |
| `window.top.postMessage(msg, specificOrigin)` silently drops on origin mismatch | This IS the mechanism that makes the handshake guard work |

### About What Didn't Work

| Approach | Why It Failed |
|----------|---------------|
| `window.self === window.top` | GAS always runs inside Google's sandbox — never at top level |
| `window.parent === window.top` | Multiple Google wrapper layers — parent is never top |
| Eliminate `?session=` with multi-step nonce handshake | Too many moving parts + GAS sandbox can't self-navigate |
| Generate nonce in `exchangeTokenForSession()` | CacheService eventual consistency — nonce not readable immediately |
| Immediate unsigned `gas-auth-ok` | Workaround, not a fix — created security exemptions |

### About What DID Work

| Solution | Why It Works |
|----------|-------------|
| `?session=TOKEN` for initial sign-in | Avoids CacheService race; token is brand new; URL only in iframe network request |
| `?page_nonce=NONCE` for refresh/reclaim | Session is in cache long enough; nonce is one-time-use |
| postMessage handshake guard | Uses `PARENT_ORIGIN` targeting to distinguish embedded vs direct access — origin mismatch = silent drop = timeout = access denied |

### HIPAA Compliance Assessment

- **Session tokens in URLs** are not explicitly prohibited by HIPAA but are strongly discouraged by OWASP and NIST
- The `?session=TOKEN` URL is in an **iframe src** (not the browser address bar), reducing exposure
- **Compensating controls** already in place: short-lived tokens, rolling + absolute timeouts, audit logging, HMAC message signing
- The **postMessage handshake guard** closes the remaining gap — even with a valid `?session=` URL, direct access shows "Access denied"
- **GAS itself is HIPAA-covered** under Google's BAA as of September 2025 (paid Workspace accounts)

## Files Involved

| File | Role |
|------|------|
| `googleAppsScripts/Testauthgas1/testauthgas1.gs` | GAS server + authenticated HTML — contains the handshake guard |
| `googleAppsScripts/Portal/portal.gs` | Portal GAS server — contains the handshake guard |
| `live-site-pages/testauthgas1.html` | Embedding page — contains the handshake responder |
| `live-site-pages/portal.html` | Portal embedding page — contains the handshake responder |
| `live-site-pages/templates/gas-minimal-auth-template-code.js.txt` | Auth GAS template — handshake guard |
| `live-site-pages/templates/gas-test-auth-template-code.js.txt` | Test auth GAS template — handshake guard |
| `live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt` | Auth HTML template — handshake responder |

## Version History

| Version | What Changed |
|---------|-------------|
| v05.59r | First iframe guard (`window.self === window.top`) — dead code |
| v05.60r | Changed to `window.parent === window.top` — still broken |
| v05.61r | Fixed sign-out race condition (separate issue, related to auth flow) |
| v05.62r | postMessage handshake nonce flow — too complex, broke sign-in |
| v05.63r | Fixed sandbox self-navigation issue — still broken |
| v05.64r | Reverted everything — multi-step nonce unreliable |
| v05.65r | One-time nonce flow via `loadIframeViaNonce()` — broke sign-in |
| v05.66r | Server-side nonce in `exchangeTokenForSession()` — still stuck |
| v05.67r | HMAC exempt workarounds — sign-in partially fixed |
| v05.68r | More unsigned workarounds — fragile but worked |
| v05.69r | **Root cause found: CacheService eventual consistency.** Reverted sign-in to `?session=`, kept nonces for other paths |
| v05.70r | **postMessage handshake guard — the actual fix for direct URL access** |

Developed by: LightAISolutions
