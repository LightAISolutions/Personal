# Security Update Plan II — testauthgas1 Environment

**Created:** 2026-03-14
**Status:** Ready for implementation
**Scope:** `testauthgas1.gs` + `testauthgas1.html` (if successful, propagate to auth templates)
**Base version:** v03.10r state (v01.18g GAS / v01.44w HTML)
**Reference:** `07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md` (implemented v02.90r–v02.91r), `06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md`
**Methodology:** Adversarial audit — all vulnerabilities identified by reasoning as an attacker with full source access and Claude Opus 4.6

---

## Why This Document Exists

The first security update plan (`07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md`, implemented v02.90r–v02.91r) successfully hardened testauthgas1 with 6 defense layers: message-type allowlist, cryptographic message authentication, XSS prevention, session hardening, debug cleanup, and error sanitization.

However, an adversarial audit on 2026-03-14 — conducted by reasoning as an attacker who has Claude Opus 4.6, full repo source access, and web research capability — identified **19 additional vulnerabilities** that the first plan either missed, explicitly deferred, or partially addressed. Several of these chain together into high-impact attack sequences.

This plan addresses all 19 vulnerabilities across 7 implementation phases, ordered by risk-to-effort ratio (highest ROI first). It inherits and respects the hard constraints from the first plan.

---

## Hard Constraints (Inherited + New)

### Constraint A: Never Touch the Deploy Handler (INHERITED)

The `doPost(action=deploy)` handler in `testauthgas1.gs` (lines 142–157) **must remain completely unauthenticated**. No secret checks, no origin validation, no IP allowlisting, no conditional logic before `pullAndDeployFromGitHub()`.

**Rationale:** Adding a `DEPLOY_SECRET` check in v02.79r silently broke the entire GAS auto-deploy pipeline, freezing the live GAS at v01.15g for the remainder of the v02.75r–v02.84r saga. The deploy action only calls `pullAndDeployFromGitHub()` which overwrites the script with whatever is on GitHub (the source of truth). The protective `⚠️ CRITICAL` comment block in the code must remain untouched.

**What this means for VULN-3 (unauthenticated deploy):** The endpoint stays open. The defense is securing the GitHub repo itself (branch protection, 2FA, token rotation), not guarding the GAS endpoint. This plan adds a deploy audit log (Phase 5) for visibility, but no authentication gate.

### Constraint B: Never Break Google Sign-In Flow (INHERITED)

The complete sign-in chain must work end-to-end without getting stuck on the "Sign In Required" page. The full flow is:

```
User clicks "Sign In with Google"
  → google.accounts.oauth2.initTokenClient() with prompt: 'select_account'
  → User selects Google account in popup
  → handleTokenResponse() receives access_token
  → exchangeToken(access_token) called
  → [URL mode] iframe.src = baseUrl + '?exchangeToken=' + token
  → GAS doGet() receives token, calls exchangeTokenForSession()
  → GAS returns HTML with postMessage({type:"gas-session-created", sessionToken:...})
  → Parent window receives message, saveSession() stores token
  → iframe.src = baseUrl + '?session=' + sessionToken
  → GAS validates session, returns app HTML with postMessage({type:"gas-auth-ok"})
  → Auth wall hidden, app visible
```

**Every change must preserve this entire chain.** If any link breaks, the user gets stuck on "Sign In Required" with no indication of what went wrong. The v02.75r–v02.84r saga proved this constraint is load-bearing — origin validation, CSP, and case mismatches all caused silent failures here.

### Constraint C: CSP Must Not Block Google Identity Services (NEW)

Adding a Content-Security-Policy meta tag requires whitelisting the correct Google domains. Google Identity Services (GIS) requires at minimum:

```
script-src: https://accounts.google.com/gsi/client https://apis.google.com
connect-src: https://accounts.google.com/gsi/
frame-src:   https://accounts.google.com/gsi/
```

Source: [Google CSP documentation](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [Google CSP guide](https://developers.google.com/tag-platform/security/guides/csp)

The v02.83r attempt at CSP broke Google Sign-In because it didn't include all required domains. This plan specifies the exact directives needed and mandates testing the full sign-in flow after CSP is added.

**Important:** The `<meta>` tag approach does not support `frame-ancestors` or reporting endpoints, but `script-src`, `connect-src`, and `frame-src` work correctly via meta tag.

### Constraint D: No IP-Based Rate Limiting in GAS (NEW)

Google Apps Script `doGet(e)` does **not expose the client's IP address** — the event parameter contains only query parameters, not request headers. True per-IP rate limiting is architecturally impossible in vanilla GAS web apps.

Source: [GAS Web Apps documentation](https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script)

Rate limiting in this plan uses **per-email** tracking (post-authentication) and **per-session-token** tracking (pre-authentication), not per-IP.

---

## Vulnerability Reference

All 19 vulnerabilities from the adversarial audit, with their severity and the phase that addresses them:

| ID | Severity | Summary | Phase |
|----|----------|---------|-------|
| VULN-1 | CRITICAL | OAuth access token leaked via URL parameter + referrer header | 1, 2 |
| VULN-2 | CRITICAL | Wildcard `'*'` postMessage target origin broadcasts access token | 1 |
| VULN-3 | CRITICAL | Unauthenticated deploy endpoint (by design — Constraint A) | 5 |
| VULN-4 | HIGH | Session token stored in localStorage — persistent XSS theft | 2 |
| VULN-5 | HIGH | No Content Security Policy (CSP) | 3 |
| VULN-6 | HIGH | No Referrer-Policy — token leakage to third parties | 1 |
| VULN-7 | HIGH | Email enumeration via error responses | 4 |
| VULN-8 | HIGH | No rate limiting — brute force and DoS | 4 |
| VULN-9 | MEDIUM | HMAC message signing disabled by default (standard preset) | 6 |
| VULN-10 | MEDIUM | `gas-session-created` bootstrap message is untrusted | 6 |
| VULN-11 | MEDIUM | innerHTML from externally-fetched content (changelog XSS) | 3 |
| VULN-12 | MEDIUM | Deployment ID and spreadsheet ID in source code | 5 |
| VULN-13 | MEDIUM | Heartbeat message key passed via URL parameter | 2 |
| VULN-14 | MEDIUM | No `state` parameter in OAuth flow — CSRF login | 7 |
| VULN-15 | MEDIUM | Origin-wide localStorage sharing on GitHub Pages | 2 |
| VULN-16 | LOW | No MFA enforcement | 7 |
| VULN-17 | LOW | Absolute session timeout of 16 hours | 4 |
| VULN-18 | LOW | No session revocation notification across tabs | 6 |
| VULN-19 | LOW | Master ACL spreadsheet not configured | 5 |

---

## Attack Chains (Why Order Matters)

Individual vulnerabilities chain together into high-impact attack sequences. The phase ordering targets the most dangerous chains first:

```
Chain A: Passive Token Theft (HIGHEST PRIORITY — Phase 1 blocks it)
  VULN-1 (token in URL) + VULN-6 (no referrer policy)
  → Any external resource passively collects OAuth + session tokens
  → No user interaction beyond normal page use
  → Phase 1 adds Referrer-Policy and fixes postMessage origin

Chain B: Cross-Page Session Theft (Phase 2 + 3 block it)
  VULN-4 (localStorage) + VULN-15 (origin sharing) + VULN-5 (no CSP)
  → XSS on ANY page on the GitHub Pages domain steals testauthgas1 sessions
  → Phase 2 switches to sessionStorage; Phase 3 adds CSP

Chain C: Session Fixation via postMessage (Phase 6 blocks it)
  VULN-9 (HMAC disabled) + VULN-10 (untrusted bootstrap)
  → Attacker injects fake gas-session-created → controls session + signing key
  → Phase 6 enables HMAC and adds bootstrap timestamp validation

Chain D: Full Account Takeover (Constraint A — partially mitigated Phase 5)
  VULN-3 (unauthenticated deploy) + GitHub account compromise
  → Attacker pushes malicious GAS code → auto-deploys
  → Phase 5 adds deploy audit logging for detection (not prevention)
```

---

## Implementation Phases

### Phase 1: Referrer Policy + postMessage Origin Fix

**Risk level:** LOW (no functional changes to auth flow)
**Fixes:** VULN-1 (partially), VULN-2, VULN-6
**Constraint check:** ✅ A (deploy untouched), ✅ B (sign-in untouched), ✅ C (CSP not added yet)

#### 1A. Add Referrer-Policy meta tag (HTML — testauthgas1.html)

**Location:** Inside `<head>`, before any `<script>` or `<link>` tags.

**Add:**
```html
<meta name="referrer" content="no-referrer">
```

**What this does:** Instructs the browser to never send a `Referer` header when navigating from this page or loading external resources. This prevents OAuth tokens and session tokens that appear in URL parameters from leaking to third-party servers via HTTP referrer headers.

**Why `no-referrer` instead of `origin`:** The `origin` policy would strip query parameters but still send the page's origin (e.g. `https://shadowaisolutions.github.io`). Since the page has no functional dependency on outgoing referrer headers, `no-referrer` is strictly more secure with zero cost.

**Research confirms this is the recommended mitigation:**
- [PortSwigger: OAuth Vulnerabilities — Referrer Leakage](https://portswigger.net/web-security/oauth)
- [Voorivex: Stealing OAuth Tokens via Referrer Policy Override](https://blog.voorivex.team/leaking-oauth-token-via-referrer-leakage)

**Testing:** After adding, verify:
1. Google Sign-In still works (the `no-referrer` policy only affects outgoing requests from the page — it does not affect Google's OAuth popup, which runs in a separate window/popup context)
2. Version polling still works (same-origin fetch — unaffected by referrer policy)
3. Changelog loading still works (same-origin fetch — unaffected)

#### 1B. Replace wildcard postMessage target origin (HTML — testauthgas1.html)

**Location:** `testauthgas1.html` line 1050 (inside the `gas-ready-for-token` handler).

**Current code:**
```javascript
gasApp.contentWindow.postMessage({
  type: 'exchange-token',
  accessToken: _pendingToken
}, '*');
```

**Change to:**
```javascript
gasApp.contentWindow.postMessage({
  type: 'exchange-token',
  accessToken: _pendingToken
}, GAS_ORIGIN);
```

Where `GAS_ORIGIN` is already defined at line 925 as `'https://script.google.com'`.

**What this does:** Restricts the token-carrying postMessage to only be received by the Google Apps Script origin. Currently, `'*'` means any origin in that iframe can receive the access token.

**Why `GAS_ORIGIN` works here (but `event.origin` didn't):** This is the *outgoing* direction (HTML → GAS). The `targetOrigin` parameter of `postMessage()` is checked by the browser against the *recipient's* origin. GAS iframes load from `script.google.com` (even though the sandbox subdomain is `n-{hash}.script.googleusercontent.com`, the parent iframe that receives messages is from `script.google.com`). The v02.75r problem was with *incoming* `event.origin` checking (GAS → HTML), which is a different direction and involves the unpredictable sandbox subdomain.

**Critical verification needed:** Test the postMessage exchange path with `GAS_ORIGIN` as targetOrigin. If the browser rejects the message (sign-in gets stuck), the GAS iframe's actual origin may differ. In that case, fall back to the current `'*'` but add a comment documenting why — and note that VULN-2 remains open. **Do NOT leave the page stuck on "Sign In Required"** — Constraint B takes priority.

**Fallback plan:** If `GAS_ORIGIN` doesn't work (the double-iframe wrapping may make the contentWindow origin different from `script.google.com`):
1. Try `'https://script.googleusercontent.com'` (the sandbox domain's parent)
2. If neither works, keep `'*'` but add the following defense: only send the postMessage when `_pendingToken` is set (already the case — line 1044 checks `&& _pendingToken`), and null out `_pendingToken` immediately after sending (already done — line 1051). This limits the window of exposure to a single transmission
3. Document the finding: "GAS double-iframe architecture prevents targetOrigin restriction on the HTML→GAS direction"

**Testing:**
1. Complete a full sign-in flow using the postMessage exchange path (`TOKEN_EXCHANGE_METHOD: 'postMessage'`) — verify the token reaches GAS and session is created
2. Complete a full sign-in flow using the URL exchange path (`TOKEN_EXCHANGE_METHOD: 'url'`) — the `gas-ready-for-token` handler is only used in the postMessage path, but verify the URL path still works end-to-end
3. Open browser DevTools → Console, watch for postMessage errors like "Failed to execute 'postMessage' on 'DOMWindow': The target origin provided does not match the recipient window's origin"

---

### Phase 2: Token Exposure Reduction

**Risk level:** LOW-MEDIUM (config toggle changes + minor code changes)
**Fixes:** VULN-1 (fully), VULN-4, VULN-13, VULN-15
**Constraint check:** ✅ A, ✅ B (must verify), ✅ C

#### 2A. Switch TOKEN_EXCHANGE_METHOD to 'postMessage' (HTML + GAS)

**Location:** `testauthgas1.html` line 303 (`HTML_CONFIG`) and `testauthgas1.gs` line 87 (`AUTH_CONFIG`).

**Current code (HTML):**
```javascript
TOKEN_EXCHANGE_METHOD: 'url',
```

**Change to:**
```javascript
TOKEN_EXCHANGE_METHOD: 'postMessage',
```

**Current code (GAS) — already correct:**
```javascript
TOKEN_EXCHANGE_METHOD: 'postMessage'   // line 87 in hipaa preset
```

The GAS side already has `TOKEN_EXCHANGE_METHOD: 'postMessage'` in the HIPAA preset definition, but the standard preset active config at line 74 has `TOKEN_EXCHANGE_METHOD: 'url'`. Update the standard preset:

**Location:** `testauthgas1.gs` line 74.

**Current code:**
```javascript
TOKEN_EXCHANGE_METHOD: 'url'
```

**Change to:**
```javascript
TOKEN_EXCHANGE_METHOD: 'postMessage'
```

**What this does:** Instead of passing the Google OAuth access token as a URL parameter (`?exchangeToken=TOKEN`), the token is passed via a postMessage handshake:
1. HTML loads the GAS iframe at the base URL (no token in URL)
2. GAS sends `gas-ready-for-token` postMessage to parent
3. HTML responds with `exchange-token` postMessage containing the access token
4. GAS processes the token and responds with `gas-session-created`

This eliminates the access token from URLs entirely — no browser history exposure, no referrer leakage, no server log exposure.

**Why this is now safe to enable:** The PARENT_ORIGIN `.toLowerCase()` fix (implemented in v02.90r) resolved the case-sensitivity bug that prevented postMessage exchange from working in v02.79r. The postMessage path was never "broken" — it was untested because the PARENT_ORIGIN bug silently dropped all messages.

**Testing (CRITICAL — Constraint B):**
1. Clear all testauthgas1 session data from the browser (localStorage/sessionStorage)
2. Navigate to testauthgas1.html
3. Click "Sign In with Google"
4. Verify the sign-in flow completes successfully — user should NOT get stuck on "Sign In Required"
5. Verify the auth wall is hidden and the app is visible
6. Open DevTools Network tab and confirm NO request URL contains `exchangeToken=`
7. Check DevTools Console for any postMessage errors
8. Test with an incognito/private window (no cached session)
9. Test sign-out and re-sign-in

**Rollback plan:** If sign-in gets stuck, immediately revert both config values back to `'url'`. Document the exact error observed. This is the same rollback that would have been needed for v02.79r if the auto-deploy hadn't been broken.

#### 2B. Switch STORAGE_TYPE to 'sessionStorage' (HTML)

**Location:** `testauthgas1.html` line 301 (`HTML_CONFIG`).

**Current code:**
```javascript
STORAGE_TYPE: 'localStorage',
```

**Change to:**
```javascript
STORAGE_TYPE: 'sessionStorage',
```

**What this does:** Session tokens are stored in `sessionStorage` instead of `localStorage`. Key differences:
- `sessionStorage` is **tab-scoped** — each tab gets its own storage, and it's cleared when the tab is closed
- `sessionStorage` is **not shared across tabs** — an XSS in another tab on the same origin cannot read testauthgas1's session token
- `sessionStorage` is **not persistent** — closing the browser clears all tokens (users must re-authenticate each browser session)

**What this fixes:**
- VULN-4: Session tokens no longer persist across browser sessions (reduced theft window)
- VULN-15: Tokens are no longer shared across tabs on the same origin (eliminates cross-page theft)

**UX impact:** Users will need to re-authenticate when they:
- Close and reopen the browser
- Open testauthgas1 in a new tab (each tab gets its own session — but the Google silent auth flow `prompt: ''` will make this seamless for users already signed into Google)

**The silent auth flow mitigates the UX cost:** When the page loads with no session in sessionStorage, it automatically attempts silent Google Sign-In (`prompt: ''` at line 933). If the user is already signed into Google in the browser, this succeeds without any user interaction — the user sees the app load directly without clicking "Sign In." Only if silent auth fails (user not signed into Google) will they see the "Sign In Required" prompt.

**Testing:**
1. Sign in → verify session works normally
2. Close the tab → open a new tab → verify session is gone (must re-authenticate)
3. Open testauthgas1 in two tabs → verify each tab has its own independent session
4. Sign out in one tab → verify the other tab still has its session (independent)

#### 2C. Namespace localStorage keys (HTML — defense-in-depth)

Even with the switch to sessionStorage, other features still use localStorage (audio data cache, audio-unlocked flag). Add a page-specific prefix to prevent cross-page key collisions.

**Location:** `testauthgas1.html` — session key definitions (around line 889).

**Current code:**
```javascript
var SESSION_KEY = 'gas_session_token';
var EMAIL_KEY = 'gas_user_email';
```

**Change to:**
```javascript
var SESSION_KEY = 'testauthgas1_gas_session_token';
var EMAIL_KEY = 'testauthgas1_gas_user_email';
```

Also update the session start time keys:
```javascript
var SESSION_START_KEY = 'testauthgas1_gas_session_start';
var ABSOLUTE_START_KEY = 'testauthgas1_gas_absolute_start';
```

**What this does:** Even though the primary storage moves to sessionStorage (2B), the namespaced keys prevent any future regression or configuration change from exposing testauthgas1's tokens to other pages on the same origin.

#### 2D. Remove message key from heartbeat URL (HTML + GAS)

**Location:** `testauthgas1.html` line ~1469 (heartbeat frame src) and `testauthgas1.gs` heartbeat handler.

**Current code (HTML):**
```javascript
hbFrame.src = baseUrl + '?heartbeat=' + encodeURIComponent(session.token)
  + '&msgKey=' + encodeURIComponent(_messageKey || '');
```

**Change to — Option A (preferred if Phase 2A succeeds):** Since Phase 2A enables postMessage exchange, the heartbeat can also use postMessage instead of URL parameters:

```javascript
hbFrame.src = baseUrl + '?heartbeat=pending';
// After iframe loads, send credentials via postMessage
hbFrame.onload = function() {
  hbFrame.contentWindow.postMessage({
    type: 'heartbeat-credentials',
    token: session.token,
    msgKey: _messageKey || ''
  }, GAS_ORIGIN);
};
```

The GAS side would need a corresponding postMessage listener in the heartbeat HTML response to receive the token and msgKey, then proceed with session validation.

**Change to — Option B (simpler, if Option A is too complex):** Keep the session token in the URL (heartbeat needs server-side validation — can't avoid this with GAS's doGet architecture), but remove the message key:

```javascript
hbFrame.src = baseUrl + '?heartbeat=' + encodeURIComponent(session.token);
```

For the heartbeat response's postMessage signing, the GAS side already has the msgKey stored in the session cache — it can retrieve it directly instead of receiving it via URL parameter.

**GAS changes for Option B:**

**Location:** `testauthgas1.gs` heartbeat handler (around line 708).

In the heartbeat response HTML generation, instead of reading `msgKey` from the URL parameter, retrieve it from the session cache:

```javascript
// Current: var msgKey = e.parameter.msgKey || '';
// Change to:
var sessionData = JSON.parse(cache.get('session_' + sessionToken));
var msgKey = sessionData ? sessionData.messageKey || '' : '';
```

**Testing:**
1. Sign in → let the app run for 5+ minutes → verify heartbeat succeeds (session timer resets)
2. Check DevTools Network tab → verify no `msgKey=` in any URL
3. Verify the heartbeat response postMessages are still signed correctly
4. Let session expire → verify expiration is detected and user is prompted to re-authenticate

---

### Phase 3: Content Security Policy + innerHTML Sanitization

**Risk level:** MEDIUM (CSP can break Google Sign-In if misconfigured — Constraint C)
**Fixes:** VULN-5, VULN-11
**Constraint check:** ✅ A, ⚠️ B (must test thoroughly), ⚠️ C (this is the CSP phase)

#### 3A. Add Content-Security-Policy meta tag (HTML)

**Location:** `testauthgas1.html` inside `<head>`, after the Referrer-Policy tag from Phase 1.

**Add:**
```html
<meta http-equiv="Content-Security-Policy" content="
  script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client https://apis.google.com;
  connect-src 'self' https://accounts.google.com/gsi/ https://www.googleapis.com;
  frame-src https://accounts.google.com/gsi/ https://script.google.com https://*.googleusercontent.com;
  style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style;
  img-src 'self' data: https: ;
  object-src 'none';
  base-uri 'self';
">
```

**Directive-by-directive rationale:**

| Directive | Value | Why |
|-----------|-------|-----|
| `script-src` | `'self' 'unsafe-inline' https://accounts.google.com/gsi/client https://apis.google.com` | `'self'` = same-origin scripts. `'unsafe-inline'` = required because all JS is inline (moving to external files would be a larger refactor). Google GIS loads from `accounts.google.com/gsi/client`. `apis.google.com` is needed for some GIS initialization flows |
| `connect-src` | `'self' https://accounts.google.com/gsi/ https://www.googleapis.com` | `'self'` = same-origin fetches (version polling, changelogs). GIS makes XHR/fetch calls to `accounts.google.com/gsi/`. Token validation uses `www.googleapis.com` |
| `frame-src` | `https://accounts.google.com/gsi/ https://script.google.com https://*.googleusercontent.com` | GIS uses iframes from `accounts.google.com/gsi/`. The GAS iframe loads from `script.google.com` and the sandbox subdomain is under `*.googleusercontent.com` |
| `style-src` | `'self' 'unsafe-inline' https://accounts.google.com/gsi/style` | All CSS is inline. GIS may inject styles from its own origin |
| `img-src` | `'self' data: https:` | Developer logos loaded from external HTTPS URLs. `data:` for inline images. Broad but necessary for flexibility |
| `object-src` | `'none'` | Blocks all plugin-based content (Flash, Java applets). No legitimate use case |
| `base-uri` | `'self'` | Prevents `<base>` tag injection (a common CSP bypass technique) |

**What this blocks that isn't blocked today:**
- `<script src="https://evil.com/steal.js">` — blocked by `script-src` (evil.com not whitelisted)
- `<object>` and `<embed>` plugin injection — blocked by `object-src 'none'`
- `<base href="https://evil.com">` redirect attacks — blocked by `base-uri 'self'`

**What this does NOT block (known limitations):**
- Inline `<script>` tags — `'unsafe-inline'` allows these (required for current architecture)
- Inline event handlers (e.g. `<img onerror="...">`) — also allowed by `'unsafe-inline'`
- To block inline scripts, the code would need to move to external `.js` files with nonces — this is a larger refactor deferred for a future plan

**Source:** [Google CSP for GIS](https://developers.google.com/tag-platform/security/guides/csp), [MDN CSP Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)

**Testing (CRITICAL — Constraint B and C):**
1. Open DevTools Console BEFORE loading the page
2. Load testauthgas1.html — check for ANY CSP violation messages (they appear as `[Report Only]` or `Refused to...` errors)
3. Click "Sign In with Google" — verify the popup opens and sign-in completes
4. Verify the GAS iframe loads and the app becomes visible
5. Verify version polling works (check Network tab for 200 responses on `html.version.txt` and `gs.version.txt`)
6. Verify changelog loading works
7. Verify audio playback works
8. If ANY CSP violation occurs for a legitimate resource, add the required origin to the appropriate directive

**Rollback plan:** If Google Sign-In breaks, remove the entire `<meta>` tag. Do NOT try to debug in production — the v02.83r experience showed that CSP debugging with GIS is painful. Remove first, debug in a test environment, then re-add with corrections.

#### 3B. Sanitize changelog innerHTML (HTML)

**Location:** `testauthgas1.html` lines 745–755 (GAS changelog) and 826–840 (HTML changelog).

**Current pattern:**
```javascript
gclBody.innerHTML = gclCache;     // line 750
body.innerHTML = changelogCache;  // line 831
```

Where `gclCache` and `changelogCache` are built by parsing markdown fetched via `fetch()` from same-origin changelog files.

**Change:** Add a sanitization function that strips all HTML tags except safe formatting:

```javascript
function sanitizeChangelogHtml(html) {
  // Create a temporary div to parse the HTML
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  // Walk all elements and remove anything that's not safe
  var allowed = {
    'H2': true, 'H3': true, 'H4': true, 'H5': true,
    'P': true, 'UL': true, 'OL': true, 'LI': true,
    'STRONG': true, 'EM': true, 'B': true, 'I': true,
    'BR': true, 'HR': true, 'CODE': true, 'PRE': true,
    'SPAN': true, 'DIV': true
  };
  var scripts = tmp.querySelectorAll('script, iframe, object, embed, form, input, textarea, link, style, svg, math');
  for (var i = scripts.length - 1; i >= 0; i--) {
    scripts[i].parentNode.removeChild(scripts[i]);
  }
  // Remove event handler attributes from all elements
  var all = tmp.querySelectorAll('*');
  for (var j = 0; j < all.length; j++) {
    var attrs = all[j].attributes;
    for (var k = attrs.length - 1; k >= 0; k--) {
      if (attrs[k].name.toLowerCase().indexOf('on') === 0) {
        all[j].removeAttribute(attrs[k].name);
      }
    }
  }
  return tmp.innerHTML;
}
```

**Usage:**
```javascript
gclBody.innerHTML = sanitizeChangelogHtml(gclCache);
body.innerHTML = sanitizeChangelogHtml(changelogCache);
```

**What this does:** Even if an attacker manages to inject malicious HTML into a changelog file (via repo compromise), the sanitizer strips `<script>`, `<iframe>`, event handlers, and other dangerous elements before the content is rendered.

**Testing:**
1. Open the changelog popup — verify formatting is preserved (headers, lists, bold, italic)
2. Verify no console errors
3. (Optional) Test with a deliberately malicious changelog entry in a dev environment: add `<script>alert('xss')</script>` to a changelog file and verify it does NOT execute

---

### Phase 4: Error Sanitization + Rate Limiting + Session Timeout

**Risk level:** LOW-MEDIUM
**Fixes:** VULN-7, VULN-8, VULN-17
**Constraint check:** ✅ A, ✅ B, ✅ C

#### 4A. Remove email from error responses (GAS)

**Location:** `testauthgas1.gs` — `exchangeTokenForSession()` function.

**Current code (around line 374):**
```javascript
return { success: false, error: "domain_not_allowed", email: userInfo.email };
```

**Current code (around line 385):**
```javascript
return { success: false, error: "not_authorized", email: userInfo.email };
```

**Change both to:**
```javascript
return { success: false, error: "domain_not_allowed" };
```
```javascript
return { success: false, error: "not_authorized" };
```

**What this does:** Prevents email enumeration attacks. An attacker can no longer distinguish between "this email's domain isn't allowed" and "this email doesn't have access" — they both return the same structure without revealing the email.

**Server-side logging:** The email is already logged in the audit log (if enabled). The server-side log retains full diagnostic information; only the client-facing response is sanitized.

**HTML-side impact:** Check how the HTML page handles these error codes. If the error display currently shows the email to the user (e.g. "user@example.com is not authorized"), update it to show a generic message: "Access denied. Contact your administrator."

#### 4B. Add rate limiting via CacheService (GAS)

Since per-IP rate limiting is impossible in GAS (Constraint D), implement **per-token rate limiting** — track the number of failed authentication attempts per access token fingerprint.

**Location:** `testauthgas1.gs` — at the top of `exchangeTokenForSession()`.

**Add rate limit check:**
```javascript
function exchangeTokenForSession(googleAccessToken) {
  // Rate limiting: max 5 failed attempts per token fingerprint per 5-minute window
  var cache = CacheService.getScriptCache();
  var tokenFingerprint = 'ratelimit_' + googleAccessToken.substring(0, 16);
  var attempts = cache.get(tokenFingerprint);
  var attemptCount = attempts ? parseInt(attempts, 10) : 0;

  if (attemptCount >= 5) {
    return { success: false, error: "rate_limited" };
  }

  // ... existing validation logic ...

  // On failure, increment the counter
  if (!validationResult.success) {
    cache.put(tokenFingerprint, String(attemptCount + 1), 300); // 5-minute window
    return validationResult;
  }

  // On success, clear the counter
  cache.remove(tokenFingerprint);
  return validationResult;
}
```

**Also add rate limiting to heartbeat validation:**

**Location:** `testauthgas1.gs` — heartbeat handler in `doGet()`.

```javascript
// Rate limit heartbeat: max 20 per session per 5-minute window
var hbKey = 'hb_ratelimit_' + sessionToken.substring(0, 16);
var hbAttempts = cache.get(hbKey);
var hbCount = hbAttempts ? parseInt(hbAttempts, 10) : 0;
if (hbCount >= 20) {
  // Return a minimal "too many requests" response
  return HtmlService.createHtmlOutput('<script>window.top.postMessage({type:"gas-heartbeat-error"}, ' + JSON.stringify(PARENT_ORIGIN) + ');</script>');
}
cache.put(hbKey, String(hbCount + 1), 300);
```

**Design notes:**
- **Token fingerprint (first 16 chars):** Using a prefix instead of the full token avoids filling the CacheService key space while providing enough entropy to distinguish different tokens. An attacker cycling random tokens will hit the limit after 5 unique prefixes worth of attempts
- **5-minute window:** CacheService TTL handles cleanup automatically. No background cleanup needed
- **Race condition:** CacheService reads/writes are not atomic. Two concurrent requests could both read `4` and both write `5`, allowing up to `2N-1` attempts in the worst case. This is acceptable for a rate limiter — it's a soft limit, not a hard security boundary
- **CacheService eviction risk:** With a 1000-item limit and FIFO eviction, rate limit entries could be evicted if the cache is full. This would reset the rate limit for that token, effectively allowing another burst. Acceptable for the target threat model (amateur brute force, not sophisticated distributed attacks)

**Source:** [Apps Script CacheService Limits](https://justin.poehnelt.com/posts/exploring-apps-script-cacheservice-limits/), [CacheService Eviction](https://dev.to/googleworkspace/apps-script-cacheservice-eviction-and-other-limits-1p6d)

#### 4C. Reduce absolute session timeout (GAS)

**Location:** `testauthgas1.gs` — `AUTH_CONFIG` standard preset.

**Current code:**
```javascript
ABSOLUTE_SESSION_TIMEOUT: 57600  // 16 hours
```

**Change to:**
```javascript
ABSOLUTE_SESSION_TIMEOUT: 28800  // 8 hours — one work day
```

**Rationale:** 16 hours means a stolen session token is valid overnight. 8 hours covers a full work day while reducing the window of exposure by half. Users who work longer sessions will need to re-authenticate once — acceptable given the silent auth flow handles this seamlessly.

**Why not shorter:** The HIPAA preset already uses 3600 (1 hour). The standard preset serves a different use case where frequent re-authentication is disruptive. 8 hours is a reasonable middle ground.

---

### Phase 5: Deploy Audit + Information Exposure Reduction

**Risk level:** LOW
**Fixes:** VULN-3 (detection, not prevention), VULN-12, VULN-19
**Constraint check:** ✅ A (deploy handler untouched — audit is separate), ✅ B, ✅ C

#### 5A. Add deploy audit logging (GAS)

**Location:** `testauthgas1.gs` — inside `pullAndDeployFromGitHub()` function, at the very beginning.

**Add:**
```javascript
function pullAndDeployFromGitHub() {
  // Audit: Log every deploy trigger for security monitoring
  var auditCache = CacheService.getScriptCache();
  var deployLog = auditCache.get('deploy_audit_log') || '[]';
  var log = JSON.parse(deployLog);
  log.push({
    timestamp: new Date().toISOString(),
    trigger: 'doPost(action=deploy)',
    currentVersion: VERSION
  });
  // Keep last 20 entries, TTL 6 hours (max CacheService allows)
  if (log.length > 20) log = log.slice(-20);
  auditCache.put('deploy_audit_log', JSON.stringify(log), 21600);

  // ... existing deploy logic unchanged ...
}
```

**What this does:** Creates a rolling audit trail of deploy triggers. If someone hammers the deploy endpoint, the log shows it. The log is accessible via Script Properties or a custom admin endpoint (future enhancement).

**Important:** This code is INSIDE `pullAndDeployFromGitHub()`, NOT in the `doPost` handler itself. Constraint A prohibits any changes to the `doPost` routing logic — the audit happens after the function is called, not before.

#### 5B. Document known information exposure (no code change)

VULN-12 (deployment ID and spreadsheet ID in source code) is an informational finding with no direct fix. These IDs must be in the code for the app to function:
- `DEPLOYMENT_ID` — needed to construct the GAS iframe URL
- `SPREADSHEET_ID` — needed for spreadsheet access checks

**Accepted risk:** An attacker knowing these IDs can target the endpoints, but cannot bypass authentication (the IDs are not secrets — they're identifiers). The deployment ID is already "protected" by being base64-encoded-and-reversed in the HTML, but this is obfuscation, not security.

**Mitigation already in place:** Access to the spreadsheet requires Google account authorization with appropriate sharing permissions. The GAS web app requires a valid session token for any data access.

#### 5C. Validate Master ACL placeholder (GAS)

**Location:** `testauthgas1.gs` — wherever `MASTER_ACL_SPREADSHEET_ID` is referenced.

**Add a validation check:**
```javascript
function checkMasterAcl(email) {
  if (!MASTER_ACL_SPREADSHEET_ID ||
      MASTER_ACL_SPREADSHEET_ID === 'YOUR_MASTER_ACL_SPREADSHEET_ID' ||
      MASTER_ACL_SPREADSHEET_ID.indexOf('YOUR_') === 0) {
    // Master ACL not configured — skip this check (not an error)
    return { configured: false };
  }
  // ... existing ACL check logic ...
}
```

**What this does:** Explicitly handles the placeholder value instead of potentially passing it to the Spreadsheet API (which would fail with a cryptic error). The check is already likely present in the code but should be verified and made explicit.

---

### Phase 6: HMAC Enablement + Bootstrap Hardening + Cross-Tab Logout

**Risk level:** MEDIUM (requires Script Properties setup)
**Fixes:** VULN-9, VULN-10, VULN-18
**Constraint check:** ✅ A, ⚠️ B (must test — HMAC affects message flow), ✅ C

#### 6A. Enable HMAC for standard preset (GAS)

**Location:** `testauthgas1.gs` — standard preset `AUTH_CONFIG`.

**Current code:**
```javascript
ENABLE_HMAC_INTEGRITY: false
```

**Change to:**
```javascript
ENABLE_HMAC_INTEGRITY: true
```

**Prerequisites (one-time setup):**
1. Open the Apps Script project in the Script Editor
2. Go to Project Settings → Script Properties
3. Add a property: Key = `HMAC_SECRET`, Value = a random 64-character hex string
4. Generate the secret with: `openssl rand -hex 32` (produces 64 hex chars)

**What this does:** Enables HMAC-SHA256 integrity verification on session data. The GAS side computes an HMAC signature over all security-relevant session fields (`email|createdAt|lastActivity|absoluteCreatedAt|displayName|tokenObtainedAt`). On every session validation, the HMAC is re-computed and compared — if any field was tampered with, validation fails.

**Impact on message signing:** With HMAC enabled, the per-session message key used for postMessage signing is generated with stronger entropy. The existing message signing mechanism (the simple hash function) remains the same — it's not replaced by HMAC (HMAC signs session data, the hash function signs messages). Both layers operate independently.

**Testing (Constraint B):**
1. Set up the Script Property with a test HMAC secret
2. Sign in → verify session is created successfully
3. Verify heartbeat extends session correctly
4. Sign out → verify session is invalidated
5. If sign-in fails, check the GAS execution logs for HMAC-related errors

#### 6B. Add bootstrap timestamp validation (HTML)

**Location:** `testauthgas1.html` — in the `gas-session-created` message handler (around line 1035).

**Current code:**
```javascript
if (data.type === 'gas-session-created' && data.success && data.messageKey) {
  _messageKey = data.messageKey;
}
```

**Change to:**
```javascript
if (data.type === 'gas-session-created' && data.success && data.messageKey) {
  // Bootstrap validation: message must arrive within 30 seconds of iframe load
  if (_iframeLoadTime && (Date.now() - _iframeLoadTime) > 30000) {
    console.warn('gas-session-created received too late — possible replay');
    return; // Reject stale/replayed bootstrap messages
  }
  // Only accept the first gas-session-created (prevent overwrite by attacker)
  if (!_messageKey) {
    _messageKey = data.messageKey;
  }
}
```

**Also add iframe load timestamp tracking:**
```javascript
// Add near the exchangeToken function
var _iframeLoadTime = null;

function exchangeToken(token) {
  _iframeLoadTime = Date.now();
  // ... existing exchange logic ...
}
```

**What this does:**
1. **Timestamp validation:** Rejects `gas-session-created` messages that arrive more than 30 seconds after the iframe was loaded. This prevents an attacker from sending a delayed/replayed bootstrap message
2. **First-write-wins:** Once `_messageKey` is set, subsequent `gas-session-created` messages cannot overwrite it. This prevents an attacker from racing the real GAS response to inject their own signing key

**Why 30 seconds:** Normal sign-in completes in 2-5 seconds. 30 seconds provides generous headroom for slow networks while still blocking replayed messages from a previous session.

#### 6C. Add BroadcastChannel cross-tab session revocation (HTML)

**Location:** `testauthgas1.html` — in the session management section.

**Add channel initialization:**
```javascript
// Cross-tab session revocation
var _sessionChannel = null;
try {
  _sessionChannel = new BroadcastChannel('testauthgas1_session');
  _sessionChannel.onmessage = function(event) {
    if (event.data && event.data.type === 'session-revoked') {
      // Another tab signed out — clear our session too
      clearSession();
      showAuthWall('Session ended in another tab');
    }
  };
} catch(e) {
  // BroadcastChannel not supported — graceful degradation
}
```

**Add broadcast on sign-out:**
```javascript
function performSignOut() {
  // ... existing sign-out logic ...

  // Notify other tabs
  if (_sessionChannel) {
    try {
      _sessionChannel.postMessage({ type: 'session-revoked' });
    } catch(e) { /* ignore */ }
  }
}
```

**What this does:** When a user signs out in one tab, all other tabs on the same origin receive a notification and clear their sessions immediately. This prevents the scenario where a user signs out thinking they're secure, but a stolen token in another tab continues working.

**Browser support:** BroadcastChannel is supported in all modern browsers since March 2022 (Chrome 54+, Firefox 38+, Safari 15.4+, Edge 79+). The `try/catch` provides graceful degradation for any browser that doesn't support it.

**Source:** [BroadcastChannel API — Chrome Developers](https://developer.chrome.com/blog/broadcastchannel), [Session Expiry using BroadcastChannel — Bugcrowd Engineering](https://bugcrowd.engineering/blogs/session-expiry-on-broadcast-channel)

---

### Phase 7: OAuth Flow Hardening (Lower Priority)

**Risk level:** LOW (these are defense-in-depth additions for less likely attack vectors)
**Fixes:** VULN-14, VULN-16
**Constraint check:** ✅ A, ⚠️ B (must test carefully), ✅ C

#### 7A. Add client-side CSRF protection for OAuth flow (HTML)

**Note on `state` parameter:** Google Identity Services' `initTokenClient()` uses a **popup + callback pattern**, not a redirect. The `state` parameter is [not supported by `initTokenClient`](https://developers.google.com/identity/oauth2/web/reference/js-reference) — it is only available with `initCodeClient()` in redirect mode.

Since `initTokenClient` doesn't support `state`, implement a client-side CSRF check instead:

**Location:** `testauthgas1.html` — in the sign-in initialization.

**Add a per-session nonce:**
```javascript
var _authNonce = null;

function initiateSignIn() {
  // Generate a nonce for this sign-in attempt
  _authNonce = Math.random().toString(36).substring(2) + Date.now().toString(36);

  signInClient.requestAccessToken();
}

function handleTokenResponse(response) {
  // Verify this callback corresponds to our sign-in attempt
  if (!_authNonce) {
    console.warn('Unexpected token response — no pending sign-in');
    return;
  }
  _authNonce = null; // Consume the nonce

  if (response.error) {
    // ... existing error handling ...
    return;
  }

  exchangeToken(response.access_token);
}
```

**What this does:** Ensures that `handleTokenResponse` only processes tokens from sign-in flows initiated by the current page. If an attacker forces a cross-site OAuth flow, the callback fires without a valid `_authNonce`, and the response is rejected.

**Limitation:** This is a soft defense. The `initTokenClient` popup model is already resistant to CSRF because the popup is controlled by Google's domain and the callback is a JavaScript function reference (not a redirect URL). The nonce adds an extra verification layer, but the primary defense is the popup architecture itself.

#### 7B. Document MFA limitation (no code change)

**Location:** Documentation only — add a note to this plan and the auth pattern doc.

Google's OAuth/OIDC ID tokens [do not natively include the `amr` (Authentication Methods References) claim](https://discuss.google.dev/t/enabling-amr-claim-in-oidc-id-token-for-salesforce-integration/329042) with MFA information. Unlike Auth0, Okta, and Keycloak — which all support `amr` claim inspection for MFA verification — Google does not expose whether the user authenticated with a second factor.

**What this means:** The testauthgas1 environment cannot enforce MFA at the application level using Google as the sole identity provider. MFA enforcement must happen at the **Google Workspace admin level** (org-wide 2-Step Verification policy) or by introducing a secondary IdP that supports `amr` claims.

**Accepted risk:** Users with weak Google passwords and no MFA are vulnerable, but this is a Google account security issue, not a testauthgas1 application issue. The recommended mitigation is to enable 2-Step Verification in Google Workspace admin.

---

## Implementation Order Summary

| Order | Phase | Risk | Fixes VULNs | Key Constraint Concerns |
|-------|-------|------|-------------|------------------------|
| 1st | Phase 1: Referrer + postMessage Origin | LOW | 1, 2, 6 | Test postMessage targetOrigin (Constraint B) |
| 2nd | Phase 2: Token Exposure Reduction | LOW-MED | 1, 4, 13, 15 | Test postMessage exchange + sessionStorage (Constraint B) |
| 3rd | Phase 3: CSP + innerHTML Sanitization | MEDIUM | 5, 11 | CSP must not break Google Sign-In (Constraint B + C) |
| 4th | Phase 4: Error Sanitization + Rate Limiting | LOW-MED | 7, 8, 17 | None |
| 5th | Phase 5: Deploy Audit + Info Exposure | LOW | 3, 12, 19 | Deploy handler untouched (Constraint A) |
| 6th | Phase 6: HMAC + Bootstrap + Cross-Tab | MEDIUM | 9, 10, 18 | HMAC requires Script Properties setup (Constraint B) |
| 7th | Phase 7: OAuth Hardening | LOW | 14, 16 | initTokenClient doesn't support state param |

---

## Testing Protocol

After each phase, run this full regression test:

### Sign-In Flow (Constraint B — MANDATORY after every phase)
1. Clear all session data (localStorage AND sessionStorage)
2. Load testauthgas1.html in an incognito window
3. Verify "Sign In Required" page appears
4. Click "Sign In with Google"
5. Select a Google account
6. **PASS:** Auth wall disappears, app is visible within 10 seconds
7. **FAIL:** If stuck on "Sign In Required" for >15 seconds → revert the phase immediately

### Session Management
1. Close tab → reopen → verify session behavior matches Phase 2 expectations (sessionStorage = must re-auth; localStorage = session persists)
2. Wait 5 minutes → verify heartbeat fires and session extends
3. Sign out → verify session is cleared

### Deploy Pipeline (Constraint A — MANDATORY after any GAS change)
1. Push a GAS code change to the GitHub repo
2. Verify the auto-merge workflow triggers
3. Verify the GAS webhook fires and the code updates
4. **PASS:** GAS VERSION increments on the live deployment
5. **FAIL:** If GAS remains at old version → the deploy pipeline is broken → revert immediately

### CSP Verification (only after Phase 3)
1. Open DevTools Console before loading the page
2. Load testauthgas1.html
3. Complete a full sign-in flow
4. **PASS:** Zero CSP violation errors in console
5. **FAIL:** Any `Refused to...` error → note the blocked resource → add it to the CSP directive → re-test

---

## What This Plan Does NOT Address (Future Work)

| Item | Why Deferred | Recommendation |
|------|-------------|----------------|
| Custom domain for GitHub Pages | Eliminates origin-sharing but requires DNS setup | Implement when the project moves to production |
| External `.js` files with CSP nonces | Would allow removing `'unsafe-inline'` from script-src | Large refactor — all inline JS must move to external files |
| Server-side rate limiting (Cloudflare/API Gateway) | GAS doesn't expose client IP | Implement if brute force becomes a real problem |
| WebAuthn/FIDO2 second factor | Requires significant UI and flow changes | Consider for a v3 auth pattern |
| Subresource Integrity (SRI) for GIS script | Google's GIS script URL doesn't support SRI hashes (content changes on updates) | Monitor Google's recommendations |
| `Permissions-Policy` header | Cannot set HTTP headers from GitHub Pages (no server config) | Would require custom domain + reverse proxy |

---

## References

### Security Research
- [PostMessage Vulnerabilities — InstaTunnel](https://instatunnel.my/blog/postmessage-vulnerabilities-when-cross-window-communication-goes-wrong)
- [postMessaged and Compromised — Microsoft SRC (2025)](https://msrc.microsoft.com/blog/2025/08/postmessaged-and-compromised/)
- [Iframe Security Risks 2026 — Qrvey](https://qrvey.com/blog/iframe-security/)
- [OAuth Token Theft via Referrer — Voorivex](https://blog.voorivex.team/leaking-oauth-token-via-referrer-leakage)
- [OAuth 2.0 Vulnerabilities — PortSwigger](https://portswigger.net/web-security/oauth)
- [Dirty Dancing in OAuth Flows — Detectify](https://labs.detectify.com/writeups/account-hijacking-using-dirty-dancing-in-sign-in-oauth-flows/)
- [OAuth CSRF Prevention — Auth0](https://auth0.com/blog/prevent-csrf-attacks-in-oauth-2-implementations/)
- [UUID Security Limitations — Little Man In My Head](https://littlemaninmyhead.wordpress.com/2015/11/22/cautionary-note-uuids-should-generally-not-be-used-for-authentication-tokens/)
- [Session Hijacking 2025 — Seraphic Security](https://seraphicsecurity.com/learn/website-security/session-hijacking-in-2025-techniques-attack-examples-and-defenses/)
- [Weaponizing XSS — Microsoft SRC (2025)](https://www.microsoft.com/en-us/msrc/blog/2025/11/weaponizing-cross-site-scripting-when-one-bug-isnt-enough)
- [GitHub Actions Supply Chain Attack — Unit 42](https://unit42.paloaltonetworks.com/github-actions-supply-chain-attack/)
- [Session Prediction — OWASP](https://owasp.org/www-community/attacks/Session_Prediction)

### Google Documentation
- [Google Identity Services CSP Setup](https://developers.google.com/tag-platform/security/guides/csp)
- [GIS Client Library Loading](https://developers.google.com/identity/gsi/web/guides/client-library)
- [initTokenClient JS Reference](https://developers.google.com/identity/oauth2/web/reference/js-reference)
- [Apps Script HTML Service Restrictions](https://developers.google.com/apps-script/guides/html/restrictions)
- [Apps Script CacheService Reference](https://developers.google.com/apps-script/reference/cache)
- [Apps Script Quotas](https://developers.google.com/apps-script/guides/services/quotas)

### Implementation Patterns
- [BroadcastChannel API — Chrome Developers](https://developer.chrome.com/blog/broadcastchannel)
- [Session Expiry with BroadcastChannel — Bugcrowd Engineering](https://bugcrowd.engineering/blogs/session-expiry-on-broadcast-channel)
- [CacheService Limits — Justin Poehnelt](https://justin.poehnelt.com/posts/exploring-apps-script-cacheservice-limits/)
- [CacheService Eviction — DEV Community](https://dev.to/googleworkspace/apps-script-cacheservice-eviction-and-other-limits-1p6d)
- [Rate Limiting Algorithms — Felt](https://felt.com/blog/rate-limiting)
- [CSP Guide — Content Security Policy](https://content-security-policy.com/)
- [AMR Claim in Google OIDC — Google Developer Forums](https://discuss.google.dev/t/enabling-amr-claim-in-oidc-id-token-for-salesforce-integration/329042)
- [RFC 8176 — Authentication Method Reference Values](https://datatracker.ietf.org/doc/html/rfc8176)
- [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)

Developed by: LightAISolutions
