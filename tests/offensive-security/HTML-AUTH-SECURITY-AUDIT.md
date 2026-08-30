# HTML Authentication Layer — Independent Security Audit

**Audit Date:** 2026-03-16
**Auditor Perspective:** Red Team + Blue Team + HIPAA Compliance
**Target:** `testauthgas1.html` — Client-side authentication layer
**Context:** Pre-GAS-layer review; potential EMR use case (HIPAA-regulated)

> This review was conducted with fresh eyes using online research, current OWASP guidance,
> HIPAA 2025/2026 NPRM requirements, and Google Cloud threat intelligence — not from
> internal documentation. The goal is to be brutally honest about what we're missing.

---

## Architectural Clarification — HTML Auth Layer vs. GAS PHI Layer

> **Developer note (added post-audit):** The HTML layer is **authentication only** — it handles sign-in, session establishment, and token exchange. **No PHI is stored, displayed, or processed at the HTML layer.** All Protected Health Information (PHI) lives exclusively on the GAS (Google Apps Script) layer, which enforces its own independent access controls, encryption, and audit logging.

This distinction has material impact on the findings below:

### Findings whose effective severity is reduced by this architecture

| # | Finding | Why it's reduced |
|---|---------|-----------------|
| C-5 | sessionStorage token exposure | Token theft grants access to the auth layer only — not directly to PHI. The attacker still needs to pass GAS-layer validation to reach any health data |
| H-4 | Client-side timers authoritative | If the GAS layer independently enforces session timeouts, bypassing client-side timers cannot extend PHI access |
| M-8 | No auth lifecycle audit trail | HIPAA audit trail requirements are most critical at the PHI-access layer (GAS). Client-side auth event logging is still recommended but is not the compliance-critical surface |

### Findings that remain critical regardless of this architecture

| # | Finding | Why it's still critical |
|---|---------|----------------------|
| C-1 | DJB2 hash for message signing | Message integrity matters for the auth handoff — a forged message could manipulate the authentication flow that grants access to the GAS layer |
| C-2 | postMessage wildcard with access token | The access token sent via `'*'` targetOrigin is what authenticates the user to GAS. Leaking it could grant an attacker a legitimate-looking session at the PHI layer |
| C-3 | api.ipify.org without BAA | IP address is captured at the HTML layer and is PHI under HIPAA OCR guidance — this violation exists independently of where other PHI lives |
| C-4 | No MFA | Authentication happens here. If the front door is weak, the GAS layer's protections are irrelevant — the attacker gets a legitimate session |

### Key takeaway

**The HTML auth layer is the front door.** Even though PHI lives behind the GAS layer, a compromised authentication flow gives attackers a legitimate-looking session to access GAS endpoints. The auth layer doesn't need to defend against every theoretical client-side attack, but the **authentication handoff** (OAuth token → GAS session) must be airtight. When the GAS layer is built, that's where the HIPAA-heavy controls land: encryption at rest, audit logging, minimum necessary access, session binding, and BAA-covered services only.

---

## Findings Chart

### CRITICAL — Must fix before any PHI touches this system

| # | Finding | Severity | HIPAA Impact | Attack Vector | Status |
|---|---------|----------|-------------|---------------|--------|
| C-1 | **Non-cryptographic hash (DJB2) used for message signing** | CRITICAL | Fails Technical Safeguard §164.312(e)(1) — integrity controls | Attacker with XSS brute-forces 32-bit DJB2 hash in ~65K attempts (~milliseconds on modern hardware). Can forge any signed message. Birthday attack finds collisions in ~256 attempts. | NOT ADDRESSED |
| C-2 | **`postMessage` sends Google access token with `'*'` targetOrigin** | CRITICAL | Token exposure to unauthorized party | If GAS iframe navigates to unexpected origin (redirect, compromise), token goes to attacker. OWASP explicitly warns: "always specify an exact target origin." Code comment says "required" — needs re-evaluation. | KNOWN CONSTRAINT — not mitigated |
| C-3 | **Third-party IP lookup (api.ipify.org) without BAA** | CRITICAL | HIPAA violation — PHI disclosure to non-BA third party | User's IP (PHI per OCR guidance) is sent to ipify.org. No BAA exists. Domain appears in malware IOC lists. Enterprise firewalls may block it. | NOT ADDRESSED |
| C-4 | **No Multi-Factor Authentication (MFA)** | CRITICAL | Fails 2026 HIPAA NPRM mandatory MFA requirement | Google SSO is single-factor (something you know — Google password). HIPAA 2026 eliminates "addressable" loopholes — MFA becomes mandatory for all ePHI access. | NOT ADDRESSED |
| C-5 | **Session token stored in sessionStorage — accessible to any same-origin JS** | CRITICAL | No HttpOnly equivalent — token readable by XSS | sessionStorage has no HttpOnly flag. Any JS on the page can read `gas_session_token`. NIST 800-63B §7.1: "Secrets used for session binding SHOULD NOT be placed in insecure locations such as HTML5 Local Storage." sessionStorage has the same vulnerability class. | ARCHITECTURAL LIMITATION |

### HIGH — Significant security gaps

| # | Finding | Severity | HIPAA Impact | Attack Vector | Status |
|---|---------|----------|-------------|---------------|--------|
| H-1 | **BroadcastChannel transmits session token + messageKey in plaintext** | HIGH | Sensitive credentials broadcast to all same-origin tabs | `broadcastTabClaim()` sends `{token, email, messageKey}` over BroadcastChannel. Any same-origin tab (including one with XSS) intercepts all three values — full session hijacking material. | NOT ADDRESSED |
| H-2 | **No origin validation on incoming postMessages** | HIGH | Accepts messages from any origin on allowlisted types | `window.addEventListener('message', ...)` checks `data.type` against allowlist but never checks `event.origin`. Any window (cross-origin attacker page) can send `gas-ready-for-token` or `gas-needs-auth`. | NOT ADDRESSED |
| H-3 | **`_messageKey` nullified in multiple places, re-enabling first-write-wins bypass** | HIGH | Session integrity compromise | `_messageKey` is set to `null` in: reauth button handler, "Use Here" handler, tab-claim receiver, clearSession(). Each nullification reopens the first-write-wins window for an attacker to inject a new key via a forged `gas-session-created`. | PARTIAL — first-write-wins exists but multiple reset points weaken it |
| H-4 | **Client-side session expiry timers are authoritative** | HIGH | Session timeout bypass | `SERVER_SESSION_DURATION` and `ABSOLUTE_SESSION_DURATION` are JS variables. An attacker (via XSS or DevTools on a shared computer) sets them to `999999`, preventing client-side expiry. Server-side expiry still works, but the UI never forces re-auth. | PARTIAL — server validates, but client UI is bypassable |
| H-5 | **Heartbeat sends session token in URL parameter** | HIGH | Token in server logs, browser history, proxy logs | `hbFrame.src = baseUrl + '?heartbeat=' + token` — the session token appears in the URL. GAS Apps Script `doGet(e)` logs show it. Browser history records it. Any HTTP proxy or CDN edge log captures it. | NOT ADDRESSED |
| H-6 | **Sign-out sends token in URL parameter** | HIGH | Same as H-5 | `gasApp.src = baseUrl + '?signOut=' + token` — token in URL bar, server logs, proxy logs. | NOT ADDRESSED |
| H-7 | **`unsafe-inline` in CSP script-src** | HIGH | Allows inline script injection | CSP includes `'unsafe-inline'` for `script-src`. If an attacker finds any HTML injection point (even one we think doesn't exist), inline scripts execute. This significantly weakens CSP's XSS protection. | KNOWN — required for inline `<script>` block |

### MEDIUM — Should address before production

| # | Finding | Severity | HIPAA Impact | Attack Vector | Status |
|---|---------|----------|-------------|---------------|--------|
| M-1 | **Tab duplication clones sessionStorage including session token** | MEDIUM | Session leaks to unintended tab | Right-click "Duplicate Tab" creates a second tab with identical `sessionStorage`, including `gas_session_token`. Single-tab enforcement catches this eventually, but there's a race window where both tabs have valid tokens. | PARTIAL — BroadcastChannel catches it, but race window exists |
| M-2 | **Client IP sent to GAS iframe via `postMessage('*')` after auth** | MEDIUM | IP (potential PHI) sent with wildcard origin | `gasFrame.contentWindow.postMessage({type: 'host-client-ip', ip: _clientIp}, '*')` — IP address sent without target origin restriction. | NOT ADDRESSED |
| M-3 | **`window._r` exposes GAS deployment URL globally** | MEDIUM | Information disclosure | `window._r` contains the full GAS deployment URL. Any script (including third-party scripts allowed by CSP) can read this. The deployment URL + deployment ID is sensitive — it's the endpoint for all authenticated operations. | PARTIAL — deleted after use, but race window exists |
| M-4 | **Security event reporter sends details via URL params** | MEDIUM | Sensitive data in URLs | `_reportSecurityEvent` constructs a URL with event details in query parameters, sent via hidden iframe. Attack details end up in server logs in cleartext URL format. | NOT ADDRESSED |
| M-5 | **No session binding to device/browser fingerprint** | MEDIUM | Session token portable across devices | A stolen session token can be used from any browser/device. No binding to user-agent, IP, or any device characteristic. For EMR, this means a stolen token = full access from anywhere. | NOT ADDRESSED |
| M-6 | **Test values hardcoded in production code** | MEDIUM | Drastically weakened timeouts | `SERVER_SESSION_DURATION = 180` (3min instead of 15min), `ABSOLUTE_SESSION_DURATION = 300` (5min instead of 16hr), `HEARTBEAT_INTERVAL = 30000` (30s instead of 5min). Marked with `⚡ TEST VALUE` but still in the deployed code. | ACKNOWLEDGED — test values present |
| M-7 | **`CLIENT_ID` exposed in client-side code** | MEDIUM | OAuth Client ID is public | Google OAuth Client ID is in the HTML source. While Google considers this acceptable for web apps (client IDs are not secrets), it allows an attacker to create a lookalike phishing page using the same client ID to harvest OAuth tokens. Redirect URI validation is the defense, but phishing awareness is reduced. | ACCEPTED RISK (Google's design) |
| M-8 | **No audit trail on client-side authentication events** | MEDIUM | HIPAA §164.312(b) — audit controls | Client-side auth events (sign-in, sign-out, session expiry, tab takeover) are not logged to a persistent audit trail. The `_reportSecurityEvent` function exists but only covers blocked attacks, not routine auth lifecycle events. HIPAA requires logging who accessed what and when. | NOT ADDRESSED |

### LOW — Good to fix, not blocking

| # | Finding | Severity | HIPAA Impact | Attack Vector | Status |
|---|---------|----------|-------------|---------------|--------|
| L-1 | **Maintenance bypass (triple-click wrench)** | LOW | Bypasses maintenance lockout | `sessionStorage.setItem('maint-bypassed', '1')` — anyone who knows the triple-click can bypass maintenance mode. The bypass persists for the tab session. | ACCEPTED — developer convenience feature |
| L-2 | **Sound files cached in localStorage** | LOW | Data persistence beyond session | `cacheSound()` stores audio files in localStorage. Not sensitive data, but localStorage persists after logout. On a shared computer, the next user knows this app was used. | MINOR |
| L-3 | **No Content-Security-Policy `report-uri`/`report-to`** | LOW | No visibility into CSP violations | CSP violations happen silently. No reporting endpoint means you don't know if someone is testing your CSP boundaries. | NOT ADDRESSED |
| L-4 | **Wake Lock requested without user consent indicator** | LOW | Privacy — screen stays on without user awareness | `navigator.wakeLock.request('screen')` is called automatically. For an EMR on a shared device, this could expose PHI on an unattended screen. Auto-lock is a HIPAA physical safeguard. | NOT ADDRESSED |

---

## Red Team Summary — How I Would Attack This

If I were attacking this system, my priority targets would be:

### Attack 1: Forge messages via DJB2 collision (C-1)
The "HMAC" verification uses a 32-bit non-cryptographic hash. I would:
1. Capture a legitimate signed message (just watch network traffic or page behavior)
2. Brute-force a collision in ~65,536 attempts (takes <1 second)
3. Send forged `gas-heartbeat-ok` messages to keep a session alive indefinitely
4. Or forge `gas-auth-ok` to bypass the server-side session confirmation gate

**Prerequisite:** XSS to inject the brute-force script, OR a compromised GAS deployment (if one of the Google accounts with edit access is phished).

### Attack 2: Intercept the access token (C-2)
The Google access token is sent via `event.source.postMessage({accessToken}, '*')`. I would:
1. Find a way to make the GAS iframe navigate to my origin (redirect chain, DNS rebinding, GAS vulnerability)
2. The parent page still sends the token to `event.source` with `'*'` — my page receives it
3. Use the access token to read the user's Google profile and email

**Difficulty:** High — requires GAS infrastructure compromise or very specific redirect chain.

### Attack 3: Steal session from BroadcastChannel (H-1)
If I achieve XSS on any page of the same origin:
1. Open a `BroadcastChannel('auth-sign-out')`
2. Listen for `tab-claim` messages — receive `{token, email, messageKey}`
3. I now have the session token AND the HMAC key
4. Send forged signed messages to any tab

**Prerequisite:** XSS on any page of the same GitHub Pages origin (not just testauthgas1.html).

### Attack 4: Phish via shared GitHub Pages origin
GitHub Pages shares `*.github.io` as a common origin domain. If I create `attacker.github.io`, I can potentially:
1. Use the exposed `CLIENT_ID` to create a convincing Google Sign-In page
2. Embed the legitimate page in my page
3. Since `frame-src` allows `script.google.com`, I can't directly iframe their page, but I can create a lookalike

**Note:** This is mitigated by GitHub Pages' subdomain isolation — each repo gets its own origin (`org.github.io/repo`). Cross-repo XSS isn't possible via GitHub Pages subdomain isolation.

---

## Blue Team Summary — What's Working Well

Credit where it's due. The current implementation gets a lot right:

| Defense | Implementation | Effectiveness |
|---------|---------------|---------------|
| **Auth wall defers to server-side confirmation** | `_pendingSessionShow` waits for `gas-auth-ok` before hiding auth wall | Excellent — prevents forged `gas-session-created` from exposing the app |
| **First-write-wins on messageKey** | Only accepts first `gas-session-created` with a key | Good — prevents key overwrite attacks (weakened by multiple nullification points) |
| **30-second replay window** | `gas-session-created` rejected if >30s after iframe load | Good — limits replay attack window |
| **Message type allowlist** | Only known message types are processed | Good — reduces attack surface |
| **Security event reporting** | Blocked attacks are reported to GAS backend with rate limiting | Good — provides audit trail for attacks |
| **DOM clearing on session expiry** | `gasFrame.src = 'about:blank'` destroys PHI from DOM | Excellent for HIPAA — goes beyond overlay-only protection |
| **sessionStorage over localStorage** | Session data cleared on tab close | Good for HIPAA — no persistence |
| **Referrer policy `no-referrer`** | Prevents token leakage via Referer header | Good |
| **Cross-device session enforcement** | Server detects new sign-in, evicts old session | Excellent — single-session-per-user model |
| **Single-tab enforcement** | BroadcastChannel coordinates active tab | Good — limits exposure surface |
| **IP format validation** | `_validateIp()` prevents log injection | Good — defense in depth |
| **CSP with restrictive directives** | `default-src 'none'`, restricted sources | Good foundation (weakened by `unsafe-inline`) |

---

## HIPAA 2026 Readiness Assessment

The 2025 HIPAA Security Rule NPRM (expected final May 2026) eliminates "addressable" safeguards — everything becomes mandatory.

| HIPAA Requirement | Status | Gap |
|-------------------|--------|-----|
| **MFA for all ePHI access** (§164.312(d)) | NOT MET | Google SSO is single-factor. Need device-based second factor or TOTP. |
| **Encryption at rest** (§164.312(a)(2)(iv)) | NOT MET | sessionStorage is not encrypted at rest. Browser may write to disk. |
| **Audit controls** (§164.312(b)) | PARTIAL | Security events logged, but auth lifecycle events (login/logout/timeout) not in persistent audit trail. |
| **Integrity controls** (§164.312(e)(1)) | NOT MET | DJB2 hash is not a recognized integrity mechanism. Need HMAC-SHA256 minimum. |
| **Automatic logoff** (§164.312(a)(2)(iii)) | MET | Session timeout + absolute timeout + server-side enforcement. |
| **Authentication** (§164.312(d)) | PARTIAL | Google OAuth provides strong identity verification, but no MFA and no session binding. |
| **Transmission security** (§164.312(e)(1)) | MOSTLY MET | HTTPS enforced via CSP `upgrade-insecure-requests`. Token-in-URL (H-5, H-6) weakens this. |
| **PHI third-party disclosure** | NOT MET | api.ipify.org receives IP (PHI) without BAA. |
| **Penetration testing** (new annual requirement) | IN PROGRESS | Offensive security tests exist. Need formal annual cadence. |
| **Network segmentation** (new requirement) | N/A | Client-side web app — server-side segmentation is GAS infrastructure. |

---

## Priority Remediation Roadmap

### Phase 1: Critical (Before any PHI)
1. **Replace DJB2 with HMAC-SHA256** — Use Web Crypto API (`crypto.subtle.importKey` + `crypto.subtle.sign`) for proper cryptographic message signing. The GAS side computes HMAC-SHA256 and sends the signature; the HTML side verifies it. This is the single highest-impact fix.
2. **Remove api.ipify.org dependency** — Move IP lookup server-side (GAS can get client IP from the request). If client-side is required, self-host an IP echo endpoint behind your own domain with a BAA.
3. **Implement MFA** — Add TOTP or WebAuthn as a second factor after Google SSO. Google's Advanced Protection Program is an option for Google Workspace accounts.
4. **Move session token out of URLs** — Use `postMessage` for heartbeat and sign-out instead of iframe URL parameters. The token-in-URL pattern (H-5, H-6) is a known anti-pattern per OWASP.

### Phase 2: High (Before production deployment)
5. **Add origin validation to postMessage listener** — Check `event.origin` against expected GAS origins before processing messages.
6. **Stop broadcasting credentials on BroadcastChannel** — Broadcast events ("session-changed"), not tokens. Each tab reads its own sessionStorage independently.
7. **Add CSP `report-to` directive** — Set up a reporting endpoint to detect CSP probing.
8. **Replace `'*'` targetOrigin** — Use specific origin where possible. Document and mitigate where `'*'` is architecturally required.

### Phase 3: Medium (Before EMR production)
9. **Session binding** — Bind session to user-agent + IP hash. Reject heartbeats from mismatched fingerprints.
10. **Auth lifecycle audit logging** — Log every auth event (sign-in, sign-out, timeout, re-auth, tab takeover) to the GAS backend.
11. **Remove test values** — Establish a build process or environment variable system to prevent test timeouts from reaching production.
12. **Wake Lock consent** — Add a visible indicator when screen lock is being prevented, or make it configurable.

---

## Research Sources

- [HIPAA Security Rule NPRM 2025 — Federal Register](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information)
- [HIPAA MFA Requirements — Datawiza](https://www.datawiza.com/blog/industry/hipaa-mfa/)
- [2026 HIPAA Changes — HIPAAVault](https://www.hipaavault.com/resources/2026-hipaa-changes/)
- [HIPAA Website Compliance Checklist — Feroot Security](https://www.feroot.com/blog/hipaa-website-compliance-checklist/)
- [Google Cloud Threat Horizons H1 2026](https://cloud.google.com/security/report/resources/cloud-threat-horizons-report-h1-2026)
- [Google OAuth Vulnerability — Truffle Security](https://trufflesecurity.com/blog/millions-at-risk-due-to-google-s-oauth-flaw)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [postMessage Vulnerabilities — InstaTunnel](https://medium.com/@instatunnel/postmessage-vulnerabilities-when-cross-window-communication-goes-wrong-4c82a5e8da63)
- [DJB2 Non-Cryptographic Hash — GitHub](https://gist.github.com/lmas/664afa94f922c1e58d5c3d73aed98f3f)
- [NIST SP 800-107r1 — Approved Hash Algorithms](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-107r1.pdf)
- [IP Addresses & HIPAA — Freshpaint](https://www.freshpaint.io/blog/ip-addresses-and-hipaa-compliance)
- [HHS OCR Online Tracking Guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/hipaa-online-tracking/index.html)
- [IP Addresses as PHI — Gozio Health](https://www.goziohealth.com/blog/understanding-ip-addresses-as-phi-a-primer)
- [BroadcastChannel API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)
- [Iframe Security Risks 2026 — Qrvey](https://qrvey.com/blog/iframe-security/)
- [Google OAuth Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [OWASP OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [Web Storage: the Lesser Evil — PortSwigger](https://portswigger.net/research/web-storage-the-lesser-evil-for-session-tokens)
- [Secure Browser Storage — Auth0](https://auth0.com/blog/secure-browser-storage-the-facts/)
- [Harden-Runner Detects Anomalous api.ipify.org Traffic — StepSecurity](https://www.stepsecurity.io/blog/harden-runner-detects-anomalous-traffic-to-api-ipify-org-across-multiple-customers)

Developed by: LightAISolutions
