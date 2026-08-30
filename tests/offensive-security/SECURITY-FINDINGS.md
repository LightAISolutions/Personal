# Security Findings — testauthgas1 Offensive Security Tests

Comprehensive findings from offensive security testing of the testauthgas1 authentication system. Each section documents what was tested, what was found, the defense posture, and any known limitations.

Last updated: 2026-03-16 (v04.29r)

## Table of Contents

- [Test Results Summary](#test-results-summary)
- [Test 01: XSS via postMessage Injection](#test-01-xss-via-postmessage-injection)
- [Test 02: Session Token Forgery & Fixation](#test-02-session-token-forgery--fixation)
- [Test 03: Message Type Spoofing & Injection](#test-03-message-type-spoofing--injection)
- [Test 04: OAuth Token Replay & CSRF](#test-04-oauth-token-replay--csrf)
- [Test 05: Clickjacking & Iframe Embedding](#test-05-clickjacking--iframe-embedding)
- [Test 06: Deploy Endpoint Abuse](#test-06-deploy-endpoint-abuse)
- [Test 07: Session Race Conditions & Timing](#test-07-session-race-conditions--timing)
- [Test 08: CSP Bypass & Resource Injection](#test-08-csp-bypass--resource-injection)
- [Test 09: Auth State Manipulation](#test-09-auth-state-manipulation)
- [Known Platform Limitations](#known-platform-limitations)
- [Incident Response: DDoS / Resource Exhaustion](#incident-response-ddos--resource-exhaustion)

---

## Test Results Summary

| Test | Result | Risk Level | Notes |
|------|--------|------------|-------|
| 01 — XSS via postMessage | **BLOCKED** | Low | Message allowlist + signature verification stop all tested vectors |
| 02 — Session Forgery | **BLOCKED** | Low | Server-side HMAC validation rejects all forged tokens |
| 03 — Message Type Spoofing | **BLOCKED** | Low | Signature verification rejects unsigned/mistyped messages |
| 04 — OAuth Token Replay | **BLOCKED** | Low | Server-side Google token validation + nonce prevent replay/CSRF |
| 05 — Clickjacking | **PARTIALLY MITIGATED** | Medium | Page is frameable (GitHub Pages limitation) but auth-wall prevents data exfiltration |
| 06 — Deploy Endpoint Abuse | **MOSTLY BLOCKED** | Medium | No secret leaks; global rate limit caps audit log flooding; /dev shell loads but GAS backend requires editor auth |
| 07 — Session Race Conditions | **BLOCKED** | Low | First-write-wins, server-side timeouts, BroadcastChannel isolation |
| 08 — CSP Bypass | **HARDENED** | Low | Comprehensive CSP with `default-src 'none'`, restricted `img-src`, `worker-src 'none'`, `form-action 'self'`; `unsafe-inline` required for GAS but no injection point exists |
| 09 — Auth State Manipulation | **MOSTLY BLOCKED** | Low | 8/11 attacks blocked; 3 partial (monkey-patch, OAuth intercept, IP spoof) — all require XSS or are platform limitations |

---

## Test 01: XSS via postMessage Injection

**Attack vectors tested:**
- Unknown message types sent via postMessage
- XSS payloads in known message type fields (e.g. `<script>alert(1)</script>` in session tokens)
- Raw XSS strings posted to the window
- Signature bypass attempts (wrong signatures, missing signatures)

**Defense layers:**
1. `_KNOWN_GAS_MESSAGES` allowlist — only recognized message types are processed
2. `_verifyMessageSignature()` — per-session `messageKey` signs all messages using Java-style hashCode
3. First-write-wins — `messageKey` cannot be overwritten once set

**Result:** All attacks blocked. Unknown types are silently dropped. Known types with invalid signatures are rejected. XSS payloads in field values don't execute because values are used programmatically, not injected into DOM.

---

## Test 02: Session Token Forgery & Fixation

**Attack vectors tested:**
- Forged `gas-session-created` messages with fake session tokens
- Session fixation via sessionStorage/localStorage injection
- `messageKey` overwrite race condition

**Defense layers:**
1. Server-side HMAC-SHA256 session validation — tokens include an HMAC that only the server can generate
2. sessionStorage isolation — HIPAA preset uses sessionStorage (tab-scoped), not localStorage
3. First-write-wins protection on `messageKey`

**Result:** All forged tokens rejected by server. Storage injection has no effect because the server validates every token independently. messageKey cannot be overwritten after first legitimate delivery.

---

## Test 03: Message Type Spoofing & Injection

**Attack vectors tested:**
- Prototype pollution via postMessage (`__proto__`, `constructor`)
- DoS via forced sign-out messages
- Auth state machine confusion (out-of-order message sequences)
- Type coercion edge cases (numeric types, null, undefined)

**Defense layers:**
1. Message type checked against string allowlist before processing
2. Signature verification applies to all message types
3. Auth state machine validates current state before transitions

**Result:** All attacks blocked. Prototype pollution payloads don't match the allowlist. Force-signout attempts fail signature verification. Type coercion doesn't bypass string comparison.

---

## Test 04: OAuth Token Replay & CSRF

**Attack vectors tested:**
- Fabricated Google OAuth tokens submitted to the GAS backend
- CSRF nonce bypass attempts
- Direct GAS endpoint probing with stolen/crafted tokens
- Token leakage via URL parameters and Referer headers

**Defense layers:**
1. Server-side Google token validation — GAS verifies tokens with Google's auth servers
2. Nonce-based CSRF prevention in the OAuth flow
3. Token exchange via postMessage (never in URLs)

**Result:** All fabricated tokens rejected by Google's validation. Nonce prevents replay. Token never appears in URLs or Referer headers (postMessage exchange).

---

## Test 05: Clickjacking & Iframe Embedding

**Attack vectors tested:**
- Embedding the target page in an attacker-controlled iframe
- CSP `frame-ancestors` directive analysis
- JavaScript framebusting detection
- GAS iframe `X-Frame-Options` check
- Double-framing attack (nested iframes to bypass framebusting)
- Sandbox attribute abuse

**Findings:**
- **Page IS frameable** — GitHub Pages does not set `X-Frame-Options` or `frame-ancestors` HTTP headers. CSP `frame-ancestors` in `<meta>` tags is ignored by browsers per spec (only works as HTTP header)
- **No JavaScript framebusting** — the page does not check `window.top === window.self`
- **GAS iframe is also frameable** — Google does not set restrictive `X-Frame-Options` on `/exec` endpoints
- **Double-framing and sandbox attacks fail** — cross-origin policy blocks content access

**Risk assessment: MEDIUM** — The page can be embedded in an attacker's iframe, enabling blind clickjacking (tricking users into clicking invisible buttons). However:
- Cross-origin policy prevents the attacker from reading any content from the framed page
- The auth-wall means the attacker can't see or extract data through the frame
- The user would need to authenticate inside the invisible frame for any damage to occur

**Known limitation:** This cannot be fixed without control over the HTTP response headers (requires server-side configuration that GitHub Pages doesn't provide). Adding JavaScript framebusting (`if (window.top !== window.self) window.top.location = window.self.location`) would add a layer of defense but can be bypassed with sandbox attributes.

---

## Test 06: Deploy Endpoint Abuse

**Attack vectors tested:**
- Action parameter probing (20+ malicious values including SQL injection, command injection, XSS)
- POST body injection (code injection, XXE, SSTI)
- Error message information disclosure (buffer overflow, null bytes, path traversal)
- Security event endpoint flood with IP rotation
- Deployment version pinning (/dev endpoint, versioned URLs)

**Findings:**

### Action Parameter Probing — SAFE
No sensitive data leaked in any response. The GAS endpoint returns generic HTML regardless of the action parameter value. No hidden actions discovered.

### POST Body Injection — BLOCKED
CORS prevents cross-origin POST requests from browser contexts. The GAS backend only processes recognized parameters.

### Error Information Disclosure — MINOR
- Most probes: safe (no verbose errors)
- Null byte parameters (`%00`) trigger HTTP 500 responses — the status code itself is the only information disclosed (no stack traces, function names, or internal paths)

### Security Event Flood — RATE LIMITED
- **Global rate limit (50/5min)** caps total audit log entries regardless of source IP
- The `clientIp` parameter is client-reported (attacker-controlled) — per-IP rate limiting was removed because attackers can trivially rotate it
- GAS always returns HTTP 200 even when rate-limited (by design — doesn't leak rate limit status to attackers)
- When the limit fires, a `security_event_flood` meta-event is logged so the developer knows it happened
- **See [Known Platform Limitations](#known-platform-limitations) for the broader DDoS discussion**

### /dev Endpoint — SHELL ONLY
The `/dev` URL returns the HTML page shell (HTTP 200) to anyone, but the GAS iframe inside requires editor-level Google authentication to execute. An attacker sees the page structure but cannot interact with the backend. This is standard GAS behavior — the HTML shell is not the security boundary; the GAS execution engine is.

---

## Test 07: Session Race Conditions & Timing

**Attack vectors tested:**
- Concurrent postMessage flood (100 rapid messages)
- BroadcastChannel session hijacking (multiple channel name patterns)
- BroadcastChannel DoS (forced sign-out via broadcast)
- HMAC signature timing oracle (100 iterations measuring verification time)
- Storage event injection
- Session resurrection after expiry

**Defense layers:**
1. First-write-wins on `messageKey` — flood can't overwrite the legitimate key
2. BroadcastChannel names are session-specific (not guessable)
3. Server-side session timeout is authoritative (client-side timer is display-only)
4. HMAC verification uses constant-time comparison (no timing oracle)

**Actual run results (6/6 BLOCKED):**

| Attack | Result | Detail |
|--------|--------|--------|
| 1 — postMessage flood (100 msgs) | BLOCKED | First-write-wins held; 100 rapid messages could not overwrite the legitimate messageKey |
| 2 — BroadcastChannel hijack | BLOCKED | All channel name patterns (testauthgas1-sync, session-sync, auth-sync, etc.) failed — channel names are session-specific and not guessable |
| 3 — BroadcastChannel DoS | BLOCKED | Forced sign-out via broadcast rejected — cross-tab messages don't bypass signature verification |
| 4 — HMAC timing oracle | BLOCKED | 100 iterations showed no measurable timing variance between valid and invalid signatures — constant-time comparison confirmed |
| 5 — Storage event injection | BLOCKED | sessionStorage events from other contexts don't affect the auth state machine |
| 6 — Session resurrection | BLOCKED | Server-side timeout is authoritative — client-side timer manipulation cannot resurrect an expired session |

**Result:** All 6 attacks blocked. The timing oracle test is particularly notable — zero measurable correlation between signature validity and verification time, confirming the HMAC comparison does not leak information via timing side channels.

---

## Test 08: CSP Bypass & Resource Injection

**Attack vectors tested:**
- Full CSP directive audit (script-src, connect-src, frame-src, style-src, img-src, object-src, base-uri)
- Inline script injection (testing `unsafe-inline`)
- External script injection from whitelisted origins
- Data exfiltration via `img-src`
- Base URI hijack
- Meta refresh injection
- Form action hijack
- eval() availability
- CSS-based data exfiltration

**Findings:**

### CSP Policy (hardened)
```
default-src 'none'
script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client https://apis.google.com
connect-src 'self' https://accounts.google.com/gsi/ https://www.googleapis.com https://api.ipify.org
frame-src https://accounts.google.com/gsi/ https://script.google.com https://*.googleusercontent.com
style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style
img-src 'self' data: https://*.googleusercontent.com https://www.shadowaisolutions.com https://logoipsum.com
object-src 'none'
base-uri 'self'
form-action 'self'
media-src 'self'
worker-src 'none'
manifest-src 'none'
upgrade-insecure-requests
```

### Actual run results — deep analysis of every finding:

#### CSP Audit Findings

| Finding | Status | Verdict | Detail |
|---------|--------|---------|--------|
| `[WARN]` unsafe-inline in script-src | ACCEPTED | Trade-off | Required for GAS iframe communication and Google Sign-In. No injection point exists to exploit it |
| `[NOTE]` img-src allows https: | **FIXED** | Hardened | Replaced blanket `https:` with `https://*.googleusercontent.com` — closes image-based exfiltration vector |
| `[NOTE]` unsafe-inline in style-src | ACCEPTED | Trade-off | Required for GAS and Google Sign-In dynamic styling. CSS injection requires XSS first |
| `[MISSING]` default-src | **FIXED** | Added `'none'` | Deny-all fallback for unspecified resource types (font-src, media-src, etc.). Also blocks eval() |
| `[MISSING]` frame-ancestors | UNFIXABLE | Platform limit | Ignored in `<meta>` tags per W3C spec — requires HTTP header. GitHub Pages doesn't allow custom headers. See Known Platform Limitations |
| `[MISSING]` upgrade-insecure-requests | **FIXED** | Added | Defense-in-depth — auto-upgrades any `http:` subresource URLs to `https:` |
| `[MISSING]` worker-src | **FIXED** | Added `'none'` | GAS web app doesn't use workers — prevents attacker from spawning workers to bypass CSP |
| `[MISSING]` manifest-src | **FIXED** | Added `'none'` | No web app manifest exists — blocks attacker-injected manifests |
| `[MISSING]` navigate-to | N/A | Removed | Dropped from CSP Level 3 spec — zero browser implementation. Removed from test's recommended list |

#### Attack Results

| Attack | Result | Verdict | Detail |
|--------|--------|---------|--------|
| 1 — Inline Script Injection | [EXECUTED] | ACCEPTED | `unsafe-inline` allows inline scripts — required for GAS. Mitigated by message signing + no injection point |
| 2 — Whitelisted Origin Script | [LOADED] | ACCEPTED | Google Sign-In client (`accounts.google.com/gsi/client`) is legitimately whitelisted. Attacker cannot serve scripts from these Google origins |
| 3 — Image Data Exfiltration | [POSSIBLE] → **FIXED** | Hardened | `img-src` restricted from blanket `https:` to `https://*.googleusercontent.com` only. Even before the fix, exploiting this required XSS first (no injection point) and the auth wall prevents reading sensitive data |
| 4 — Base URI Hijack | [MITIGATED] | BLOCKED | `base-uri 'self'` prevents `<base href="https://attacker.com">` — relative URLs cannot be redirected |
| 5 — Meta Refresh Injection | [BLOCKED] | BLOCKED | Injected `<meta http-equiv="refresh">` tag did not redirect the page |
| 6 — Form Action Hijack | [BLOCKED] | BLOCKED | `form-action 'self'` directive prevents form submissions to external URLs. Test now verifies actual submission blocking via CSP violation events |
| 7 — eval() Availability | [AVAILABLE] → **FIXED** | Hardened | eval() was available because no `default-src` fallback existed. Adding `default-src 'none'` blocks eval() without needing explicit `unsafe-eval` restriction. **Note:** the original test incorrectly claimed `unsafe-inline` implicitly allows eval — this is false; they are independent CSP keywords (per MDN, W3C spec) |
| 8 — CSS Data Exfiltration | [POSSIBLE] | ACCEPTED | `style-src 'unsafe-inline'` allows CSS injection, but exploiting this requires XSS first (no injection point) and the auth wall blocks sensitive content from rendering |

### Key findings:
- **`default-src 'none'`** — deny-all fallback for any resource type not explicitly listed. Blocks font-src, media-src, and also blocks eval() (since script-src inherits the explicit directive, but eval requires either `unsafe-eval` or no default-src restriction)
- **`unsafe-inline` is present in script-src and style-src** — required for GAS iframe communication. No bypass possible without an injection point (user input never reaches the DOM unsanitized)
- **`img-src` restricted to `*.googleusercontent.com`** — previously allowed any HTTPS origin (blanket exfiltration vector). Now only Google avatar domains are permitted
- **`worker-src 'none'`** — prevents Web Workers, SharedWorkers, and ServiceWorkers. Closes an attack vector where injected script could spin up workers with their own execution context
- **`eval()` now blocked** — `default-src 'none'` acts as the fallback, blocking eval() without needing `unsafe-eval` in script-src
- **`object-src 'none'`** — blocks Flash, Java applets, and plugin-based attacks
- **`base-uri 'self'`** — prevents base URI hijacking
- **`form-action 'self'`** — prevents form-based data exfiltration
- **`manifest-src 'none'`** — blocks web app manifest injection
- **`upgrade-insecure-requests`** — auto-upgrades mixed content (defense-in-depth on HTTPS-only site)

### Accepted trade-offs (cannot be fixed):
1. **`unsafe-inline` in script-src** — required for GAS. Mitigated by no injection points
2. **`unsafe-inline` in style-src** — required for GAS/Google Sign-In styling. CSS exfiltration requires XSS prerequisite
3. **No `frame-ancestors`** — meta-tag CSP limitation (W3C spec). See Known Platform Limitations §3

**Risk assessment: LOW** — The CSP is comprehensively hardened. Every actionable gap identified during testing has been closed. The remaining accepted trade-offs (`unsafe-inline`) are architectural necessities of the GAS platform with no available alternative, and are mitigated by the absence of injection points + server-side validation.

---

## Test 09: Auth State Manipulation

**Attack vectors tested:**
- Direct DOM manipulation to bypass auth wall (hiding overlays, showing content)
- Forged `gas-auth-ok` messages to skip authentication
- Session timer manipulation (clearing intervals, overriding Date.now)
- Monkey-patching security functions (`_verifyMessageSignature`, `clearSession`, `performSignOut`, `_KNOWN_GAS_MESSAGES`)
- Fake heartbeat iframe injection with forged tokens
- OAuth callback interception via `handleTokenResponse` override
- Version message spoofing (`gas-version` with fake version string)
- Emergency access probing (client-side exposure check)
- Client IP spoofing via `_clientIp` variable override

**Defense layers:**
1. Server-side session validation — every data request requires a valid HMAC-signed session token
2. DOM manipulation can't bypass server validation — hiding the auth wall doesn't make the server return data
3. Function monkey-patching requires XSS first — if an attacker has XSS, they already have control
4. Heartbeat iframe tokens validated against CacheService server-side
5. Message signature verification blocks forged `gas-version` messages
6. Emergency access is server-side only (Script Properties) — no client-side exposure

**Actual run results (8/11 BLOCKED, 3 partial):**

| # | Attack | Result | Detail |
|---|--------|--------|--------|
| 1 | Auth Wall DOM Bypass (x3 methods) | **BLOCKED** | DOM modified but no authenticated content exposed — GAS iframe requires server-side session |
| 2 | Forge gas-auth-ok | **BLOCKED** | Auth wall hidden and app visible, but GAS iframe shows `gas-needs-auth` — server rejects forged token |
| 3 | Session Timer Manipulation | **MITIGATED** | Timers and intervals overridable/clearable, but server-side CacheService timeout is authoritative — client timers are advisory only |
| 4 | Monkey-Patch Security Functions | **PATCHABLE** | `_verifyMessageSignature`, `clearSession`, `performSignOut` all patchable; `_KNOWN_GAS_MESSAGES` modifiable. Requires XSS first. Server-side session management is the authoritative defense |
| 5 | Fake Heartbeat Iframe Injection | **BLOCKED** | Iframe injected successfully but GAS backend rejects forged token — no matching session in CacheService |
| 6 | OAuth Callback Interception | **INTERCEPTABLE** | `handleTokenResponse` is in global scope and overridable. Requires XSS first. CSP limits XSS vectors; nonce prevents CSRF on OAuth flow |
| 7 | Version Spoofing (Cache Poisoning) | **BLOCKED** | Fake `gas-version` message with `v99.99g` had no effect — signature verification rejects unsigned messages |
| 8 | Emergency Access Probing | **SAFE** | No emergency access properties or functions exposed in client scope — entirely server-side (Script Properties) |
| 9 | Client IP Spoofing | **SPOOFABLE** | `_clientIp` is a global variable modifiable from client-side — audit logs record attacker-controlled IP value |

### Detailed analysis of the 3 partial-success attacks:

#### Attack 4 — Monkey-Patching Security Functions (PATCHABLE)

All client-side security functions are overridable because JavaScript has no native code integrity mechanism. Specifically:
- `_verifyMessageSignature` — patchable (could disable signature checks)
- `clearSession` — patchable (could prevent session cleanup)
- `performSignOut` — patchable (could block sign-out)
- `_messageKey` — accessible (could read the per-session signing key)
- `_KNOWN_GAS_MESSAGES` — modifiable (could add custom message types)

**Why this is acceptable:** These are all defense-in-depth / UX convenience functions. The server validates every request independently via HMAC-signed session tokens. An attacker who has XSS (prerequisite for monkey-patching) already has full control of the client context — patching these functions gains nothing beyond what XSS already provides. The message allowlist modification is mitigated by signature verification (added custom types would still fail signature checks).

**Possible hardening:** `Object.freeze(_KNOWN_GAS_MESSAGES)` after initialization to prevent allowlist modification. This is a minor improvement — it stops casual modification but can be bypassed by an attacker with XSS (they can override `Object.freeze` itself). **Recommendation: optional hardening, not a priority.**

#### Attack 6 — OAuth Callback Interception (INTERCEPTABLE)

`handleTokenResponse` is declared in global scope because Google Identity Services (GIS) requires a globally-accessible callback function name. An attacker with XSS could:
1. Override the function to capture the Google OAuth credential (JWT)
2. Optionally call the original to avoid detection
3. Exfiltrate the captured token

**Why this is acceptable:** Requires XSS as a prerequisite (CSP limits vectors significantly). The captured token is a Google ID token with a nonce — it cannot be replayed from a different origin because the GAS backend validates the token's audience and nonce. Moving `handleTokenResponse` out of global scope would break the GIS callback pattern.

**Possible hardening:** None practical. The function must be globally accessible for GIS. `Object.defineProperty` with `configurable: false` could prevent casual overrides but is bypassable with XSS. **Recommendation: accepted risk — CSP is the primary defense against the XSS prerequisite.**

#### Attack 9 — Client IP Spoofing (SPOOFABLE)

`_clientIp` is fetched from `api.ipify.org` via client-side JavaScript and stored in a global variable. An attacker can:
1. Override `_clientIp` to any string value
2. All subsequent audit log entries record the spoofed IP
3. GAS runs on Google's servers and has no way to see the real client IP

**Why this is a platform limitation:** GAS web apps execute on Google's infrastructure. The request IP that GAS sees is Google's own infrastructure IP, not the end user's. The only way to obtain client IP is via client-side detection (inherently spoofable).

**Possible hardening:**
1. **IP format validation** — validate `_clientIp` against IPv4/IPv6 regex before use. Prevents injection of arbitrary strings (XSS payloads, oversized data) into audit logs via the IP field
2. **Length truncation** — cap at 45 characters (max IPv6 length) to prevent log injection
3. **"client-reported" marker** — prefix IP values in audit logs with `[client]` to make it explicit that the value is untrusted
4. **Dual logging** — log both the client-reported IP and a note that it's unverified, so audit log consumers know not to trust it for attribution

**Recommendation: implement IP format validation and length truncation as a low-effort hardening measure. The IP field is used for audit logging only (not security decisions), so spoofing has limited impact — it can only pollute logs, not bypass access controls.**

---

## Known Platform Limitations

These are architectural constraints of the Google Apps Script platform that cannot be fixed at the application level:

### 1. No DDoS Protection
GAS web app `/exec` endpoints have no network-level defenses:
- No IP blocking capability
- No WAF (Web Application Firewall)
- No connection-level rate limiting
- Every HTTP request triggers a full GAS script execution before any application code runs
- Google provides no configurable protection for GAS endpoints

**Impact:** An attacker who knows the `/exec` URL can exhaust the daily GAS execution quota (~20,000 for free accounts, ~100,000 for Workspace) by sending rapid requests in a loop. This prevents legitimate users from using the app until the quota resets (daily).

### 2. Deployment ID Exposure
The GAS deployment ID is embedded in the client-side HTML page (obfuscated but trivially decodable). Anyone who can view the page source can extract the `/exec` URL. Rotating the deployment ID and updating the page only works temporarily — the attacker can refresh the page to obtain the new URL.

### 3. Frameable Pages (GitHub Pages)
GitHub Pages does not allow configuration of HTTP response headers (`X-Frame-Options`, `Content-Security-Policy` with `frame-ancestors`). CSP `frame-ancestors` in `<meta>` tags is ignored by browsers per spec. This means pages hosted on GitHub Pages are always frameable.

### 4. `unsafe-inline` Required
GAS iframe communication requires inline script execution. The CSP must include `unsafe-inline` in both `script-src` and `style-src`, which means injected inline scripts and styles would execute if an injection point existed. The mitigation is ensuring no injection points exist (no user input reaches the DOM unsanitized). The addition of `default-src 'none'` provides a deny-all fallback that blocks eval() and other unspecified resource types, reducing the attack surface even with `unsafe-inline` present.

### 5. Client-Reported IP Address
GAS has no way to obtain the client's real IP address server-side. The `clientIp` parameter is reported by client-side JavaScript (via `api.ipify.org`), meaning an attacker can spoof it. IP-based rate limiting and logging records the attacker's claimed IP, not their real one. This is why the security event rate limit uses a global key (IP-independent).

### 6. GAS /dev Endpoint
The `/dev` URL serves the page HTML shell to anyone (HTTP 200). The security boundary is the GAS execution engine (requires editor-level Google auth), not the HTML shell. This is standard GAS behavior and cannot be changed.

---

## Incident Response: DDoS / Resource Exhaustion

If you detect a DDoS attack or resource exhaustion against your GAS web app, follow this procedure:

### Detection Signs
- Rapid increase in `security_event_flood` entries in the SessionAuditLog
- GAS execution quota consumption spiking (check at `script.google.com` > Project Settings > Quotas)
- Legitimate users reporting slow responses or errors
- Unusual traffic patterns in the audit log (rapid-fire events from suspicious IPs)

### Immediate Response

#### Step 1: Assess Severity
- **Low** — audit log flooding only, quota not threatened → monitor, the global rate limit (50/5min) caps log damage
- **Medium** — quota consumption elevated but not critical → proceed to Step 2
- **High** — quota approaching daily limit, legitimate users affected → proceed to Step 2 immediately

#### Step 2: Rotate Deployment ID (Kill Switch)
This is the **only lever that immediately stops an ongoing attack** against the GAS endpoint:

1. Open the Apps Script editor (`script.google.com`)
2. Go to **Deploy** > **Manage deployments**
3. Create a **new deployment** (do not delete the old one yet — you need the new ID first)
4. Copy the new deployment ID
5. Update the deployment ID in:
   - `googleAppsScripts/Testauthgas1/testauthgas1.config.json` → `DEPLOYMENT_ID` field
   - Run the GAS config sync (Pre-Commit #15) to propagate to `.gs` and HTML files
6. Commit, push, and deploy the updated page
7. **After** the new deployment is live, delete the old deployment in the Apps Script editor

**Important:** The attacker can obtain the new deployment ID by refreshing the page. Rotation buys time but is not a permanent solution if the attacker is actively monitoring.

#### Step 3: Temporary Takedown (If Rotation Is Insufficient)
If the attacker immediately discovers the new deployment ID:

1. **Remove the web app deployment entirely** in the Apps Script editor (Deploy > Manage deployments > Archive/Delete all deployments)
2. The `/exec` URL stops working immediately — both for the attacker and legitimate users
3. Wait for the attack to subside (monitor via audit logs)
4. Redeploy with a new deployment ID when safe

#### Step 4: Long-Term Mitigation
If DDoS attacks are recurring, consider:

- **Cloudflare in front of GitHub Pages** — protects the page (attacker can't easily scrape the new deployment ID) and adds rate limiting, bot detection, and DDoS protection. Does NOT protect the GAS endpoint directly if the URL is already known
- **Move sensitive operations off GAS** — migrate to Cloud Run, Firebase Functions, or another backend that supports WAF, IP blocking, and network-level rate limiting
- **Reduce the global rate limit** — drop from 50 to 10 or 5 during an active attack to minimize audit log noise
- **Monitor GAS quotas proactively** — set up a time-driven trigger that checks quota consumption and alerts via email when thresholds are reached

### What This Procedure Does NOT Solve
- An attacker with the current `/exec` URL can still send requests until the deployment is rotated or removed
- GAS execution quota is consumed by every request regardless of rate limiting (the script executes before your code runs)
- There is no way to block specific IPs at the GAS platform level
- The `clientIp` parameter is attacker-controlled and cannot be trusted for blocking decisions

### Recovery
After the attack subsides:
1. Deploy a fresh GAS deployment with a new ID
2. Update all configuration files with the new ID
3. Verify the audit log is clean (no ongoing flood events)
4. Check that GAS quota has reset (daily reset)
5. Resume normal operations

---

## Defense-in-Depth Summary

The testauthgas1 system uses multiple overlapping defense layers:

| Layer | What It Protects | Bypass Requires |
|-------|-----------------|-----------------|
| CSP (Content Security Policy) | Blocks external scripts, plugins, eval, workers, base URI hijack, form exfiltration, image exfiltration; `default-src 'none'` deny-all fallback | Finding an injection point + `unsafe-inline` |
| Message allowlist (`_KNOWN_GAS_MESSAGES`) | Blocks unknown postMessage types | XSS to modify the allowlist |
| Signature verification (`_verifyMessageSignature`) | Blocks unsigned/forged messages | Knowing the per-session `messageKey` |
| First-write-wins (`messageKey`) | Prevents key overwrite after first delivery | Winning a race condition on first message |
| Server-side HMAC session validation | Rejects forged/expired/tampered session tokens | Compromising the server-side HMAC secret |
| Google OAuth token verification | Rejects fabricated OAuth tokens | Compromising Google's auth infrastructure |
| Server-side session timeout | Expires sessions regardless of client manipulation | N/A (authoritative) |
| Global rate limit (security events) | Caps audit log flooding at 50/5min | N/A (server-side, IP-independent) |
| sessionStorage (HIPAA preset) | Tab-isolated sessions, not shared across tabs | XSS within the same tab |
| Cross-origin policy | Prevents framed page content access | Same-origin access (not possible from attacker domain) |

**The weakest links:**
1. GitHub Pages framing (platform limitation — no HTTP header control, `frame-ancestors` cannot be set via meta tag)
2. GAS DDoS exposure (platform limitation — no network-level defenses)
3. `unsafe-inline` in CSP script-src and style-src (required for GAS — mitigated by no injection points and `default-src 'none'` fallback)
4. Client-reported IP address (platform limitation — GAS cannot see real client IP; audit log IP values are untrusted)

**The strongest links:**
1. Server-side HMAC validation (cryptographic — no client-side bypass possible)
2. Google OAuth verification (delegated to Google's infrastructure)
3. First-write-wins + signature verification (double gate on all message processing)

Developed by: LightAISolutions
