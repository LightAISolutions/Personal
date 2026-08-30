# EMR Security Hardening Plan — HIPAA Technical Safeguards

**Created:** 2026-03-15
**Status:** Ready for implementation
**Scope:** `testauthgas1.html`, `testauthgas1.gs`
**Preset-aware:** All phases work under both `standard` and `hipaa` presets — behavior is controlled by the existing `ACTIVE_PRESET` toggle system (see [06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md](06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md)). Each phase documents its preset values explicitly.
**Prerequisites:** Plans 7, 8, 9.2 fully implemented (security hardening I & II, cross-device enforcement)
**References:**
- [07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md](07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md) — Security hardening Plan I (implemented)
- [08-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md](08-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md) — Security hardening Plan II (implemented)
- [09.2-CROSS-DEVICE-SESSION-ENFORCEMENT-HEARTBEAT-PLAN.md](09.2-CROSS-DEVICE-SESSION-ENFORCEMENT-HEARTBEAT-PLAN.md) — Cross-device enforcement (implemented)
- [06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md](06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md) — Auth preset system
- HIPAA Security Rule — 45 CFR § 164.312 (Technical Safeguards)
- NIST SP 800-63B — Digital Identity Guidelines, Authentication & Lifecycle Management
- Google Workspace BAA — Business Associate Agreement coverage

---

## Why This Plan Exists

The current authentication system (plans 6–9.2) provides a solid foundation: Google OAuth sign-in, server-side session management via CacheService, heartbeat-based session extension, cross-device single-session enforcement, HMAC session integrity, and audit logging. However, **using this system for an EMR (Electronic Medical Records) application that stores patient information (PHI) requires additional hardening** to meet HIPAA Technical Safeguards (45 CFR § 164.312).

This plan addresses every security gap identified during the EMR readiness assessment, organized by implementation priority. Each phase includes exact code locations, current/modified code blocks, and design decisions — matching the quality standard established by plan 9.2.

**Preset-aware design:** The codebase uses a `standard` / `hipaa` preset toggle system (`ACTIVE_PRESET` in `testauthgas1.gs`). Every hardening phase in this plan respects the existing toggle architecture — each feature checks its `AUTH_CONFIG` toggle before executing. The `hipaa` preset enables all hardening features by default; the `standard` preset leaves them off (preserving current behavior). No code breaks regardless of which preset is active. Switching presets is a code-level change (not a runtime toggle) — this is intentional, as HIPAA compliance is an organizational commitment that shouldn't be accidentally toggled off.

### Key Architecture Principle

**Patient data lives exclusively on the GAS/Google Sheets side.** The HTML host page never stores, caches, or displays PHI directly. The GAS iframe renders patient data within Google's sandboxed execution environment, and all data operations go through `google.script.run` calls that are validated server-side. The HTML layer handles only: session tokens, user email, and UI state. This separation is critical — Google Sheets is covered under the Google Workspace BAA for HIPAA, while browser storage (sessionStorage/localStorage) and CacheService are not.

### HIPAA Technical Safeguards Coverage Map

| HIPAA Requirement (45 CFR § 164.312) | Current State | This Plan |
|---------------------------------------|--------------|-----------|
| **(a)(1) Access Control** — unique user ID, emergency access, auto-logoff, encryption | Partial — unique sessions via UUID, auto-logoff via rolling timeout, no emergency access, no encryption at rest | **Phase 1** (HMAC enforcement), **Phase 5** (emergency access), existing auto-logoff sufficient |
| **(a)(2)(i) Unique User Identification** | ✅ Done — Google OAuth provides unique email identity | No change needed |
| **(a)(2)(ii) Emergency Access Procedure** | ❌ Config flags exist but code not implemented | **Phase 5** — full implementation |
| **(a)(2)(iii) Automatic Logoff** | ✅ Done — rolling timeout (15min HIPAA), absolute timeout (8hr), activity-gated heartbeat | No change needed (⚡ TEST VALUES remain during development) |
| **(a)(2)(iv) Encryption and Decryption** | ✅ Done — HTTPS enforced by GitHub Pages + Google Apps Script | No change needed |
| **(b) Audit Controls** | Partial — login/logout/session events logged, no data-level access logging | **Phase 6** — data-level audit logging |
| **(c)(1) Integrity** — PHI not altered/destroyed improperly | Partial — HMAC protects session metadata, no data integrity checks | **Phase 1** (HMAC enforcement), **Phase 3** (server-side validation) |
| **(d) Authentication** — verify person seeking access | ✅ Done — Google OAuth + ACL spreadsheet | **Phase 4** (account lockout) strengthens this |
| **(e)(1) Transmission Security** | ✅ Done — TLS everywhere (HTTPS, Google internal transport) | No change needed |
| **(e)(2)(i) Integrity Controls** | Partial — HMAC enabled but silently no-op without secret | **Phase 1** — enforce HMAC secret |
| **(e)(2)(ii) Encryption** | ✅ Done — TLS in transit | No change needed |

### Priority Levels

| Priority | Meaning | Phases |
|----------|---------|--------|
| **P0 — Critical** | Security controls that are configured but silently non-functional | Phase 1 (HMAC), Phase 2 (domain restriction) |
| **P1 — High** | Data exposure risks that violate HIPAA safeguards | Phase 3 (server-side validation), Phase 4 (DOM clearing) |
| **P2 — Medium** | Defense-in-depth measures recommended by NIST | Phase 5 (emergency access), Phase 6 (account lockout), Phase 7 (IP binding) |
| **P3 — Recommended** | Enhanced auditing for compliance posture | Phase 8 (data-level audit logging) |

### Preset Behavior Matrix

Every phase's behavior is governed by `AUTH_CONFIG` toggles that differ between presets. The code always checks the toggle — no HIPAA-specific code paths exist outside of toggle guards. Switching `ACTIVE_PRESET` from `'hipaa'` to `'standard'` (or vice versa) cleanly enables/disables each feature with no code changes needed beyond the preset selection.

| Phase | Toggle(s) | `standard` Preset | `hipaa` Preset | Standard Mode Behavior |
|-------|-----------|-------------------|----------------|----------------------|
| **1 — HMAC Enforcement** | `ENABLE_HMAC_INTEGRITY` | `true` (existing) | `true` (existing) | **Both presets already have this `true`** — fail-closed applies equally. If a standard deployment doesn't want HMAC, set `ENABLE_HMAC_INTEGRITY: false` via `PROJECT_OVERRIDES` (HMAC functions return early, no secret needed) |
| **2 — Domain Restriction** | `ENABLE_DOMAIN_RESTRICTION` | `false` (existing) | `true` (existing) | Validation skipped entirely — the `if (AUTH_CONFIG.ENABLE_DOMAIN_RESTRICTION)` guard exits before the empty-allowlist check |
| **3 — Data Op Validation** | `ENABLE_DATA_OP_VALIDATION` | `false` (new) | `true` (new) | `validateSessionForData()` returns immediately without checking session — data operations execute as they do today (no session gate) |
| **4 — DOM Clearing** | `ENABLE_DOM_CLEARING_ON_EXPIRY` | `false` (new) | `true` (new) | `showAuthWall()` shows the overlay without destroying the iframe — current behavior preserved |
| **5 — Emergency Access** | `ENABLE_EMERGENCY_ACCESS` | `false` (existing) | `true` (existing) | Emergency access check skipped — ACL denial is final, no break-glass fallback |
| **6 — Account Lockout** | `ENABLE_ESCALATING_LOCKOUT` | `false` (new) | `true` (new) | Uses existing flat rate limit (5 failures / 5 min) — no escalation tiers |
| **7 — IP Logging** | `ENABLE_IP_LOGGING` | `false` (new) | `true` (new) | Client IP not fetched, not included in heartbeats or audit entries |
| **8 — Data Audit Log** | `ENABLE_DATA_AUDIT_LOG` | `false` (new) | `true` (new) | `dataAuditLog()` returns immediately — no per-operation audit records written |

**Key design principle:** The `standard` preset preserves the pre-hardening behavior exactly. No existing functionality changes when `ACTIVE_PRESET = 'standard'`. The hardening features are additive — they only activate under the `hipaa` preset (or when explicitly enabled via `PROJECT_OVERRIDES`).

**Preset transition rules:**
- **`standard` → `hipaa`**: Set `ACTIVE_PRESET = 'hipaa'`, configure required Script Properties (`HMAC_SECRET`, `EMERGENCY_ACCESS_EMAILS`, `ALLOWED_DOMAINS`), redeploy. All existing sessions will be invalidated on next heartbeat (HMAC verification will fail against sessions created without HMAC enforcement). Users re-authenticate and get HIPAA-hardened sessions. No data migration needed.
- **`hipaa` → `standard`**: Set `ACTIVE_PRESET = 'standard'`, redeploy. Hardening features deactivate immediately. Existing HIPAA sessions continue to work (HMAC verification is skipped when `ENABLE_HMAC_INTEGRITY: false`) but new sessions won't have HMAC signatures. Audit logs are retained in Google Sheets regardless of preset — they are permanent records.
- **`PROJECT_OVERRIDES` interaction**: Overrides take precedence over preset values (existing behavior). An admin running `standard` can selectively enable individual hardening features (e.g., `PROJECT_OVERRIDES: { ENABLE_DATA_AUDIT_LOG: true }`) without switching to the full `hipaa` preset. This allows incremental adoption.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                 EMR Security Architecture                             │
│        (Post-Hardening — HIPAA Preset, All Phases Active)            │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  Browser (HTML Host Page — testauthgas1.html)                   │     │
│  │                                                              │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │     │
│  │  │ Auth Wall     │  │ Session      │  │ Heartbeat       │   │     │
│  │  │ (overlay +    │  │ Storage      │  │ Timer           │   │     │
│  │  │  DOM clear    │  │ (token +     │  │ (activity-      │   │     │
│  │  │  on expiry)   │  │  email ONLY  │  │  gated, 30s/5m) │   │     │
│  │  │  [Phase 4]    │  │  — NO PHI)   │  │                 │   │     │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘   │     │
│  │                                                              │     │
│  │  ┌────────────────────────────────────────────────────────┐ │     │
│  │  │ GAS iframe (sandboxed — renders PHI)                    │ │     │
│  │  │                                                         │ │     │
│  │  │  google.script.run ──► validateSessionForData() ──►     │ │     │
│  │  │    [Phase 3]           Session check BEFORE              │ │     │
│  │  │                        any data operation                │ │     │
│  │  │                                                         │ │     │
│  │  │  Activity detection ──► gas-user-activity postMessage   │ │     │
│  │  │  (keydown/click/input with 5s debounce)                 │ │     │
│  │  └────────────────────────────────────────────────────────┘ │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  Google Apps Script (testauthgas1.gs — server-side)             │     │
│  │                                                              │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │     │
│  │  │ Session Mgmt  │  │ HMAC         │  │ Rate Limiting   │   │     │
│  │  │ (CacheService │  │ (MANDATORY   │  │ + Account       │   │     │
│  │  │  — metadata   │  │  — fails     │  │   Lockout       │   │     │
│  │  │  only, NOT    │  │  closed if   │  │  [Phase 6]      │   │     │
│  │  │  PHI)         │  │  no secret)  │  │                 │   │     │
│  │  │               │  │  [Phase 1]   │  │                 │   │     │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘   │     │
│  │                                                              │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │     │
│  │  │ Data Ops      │  │ Emergency    │  │ Audit Log       │   │     │
│  │  │ Gate          │  │ Access       │  │ (login/logout   │   │     │
│  │  │ (every g.s.r  │  │ (break-glass │  │  + data-level   │   │     │
│  │  │  validates    │  │  bypass with  │  │  access events) │   │     │
│  │  │  session)     │  │  full audit)  │  │  [Phase 8]      │   │     │
│  │  │  [Phase 3]    │  │  [Phase 5]   │  │                 │   │     │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  Google Sheets (SPREADSHEET_ID — BAA-covered)                │     │
│  │                                                              │     │
│  │  Patient Data    │  Audit Log      │  Master ACL             │     │
│  │  (PHI lives      │  (immutable     │  (access control        │     │
│  │   HERE only)     │   append-only)  │   per user per page)    │     │
│  └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: HMAC Secret Enforcement (P0 — Critical)

**Risk:** Low (configuration change + fail-closed logic)
**Files:** `testauthgas1.gs`
**HIPAA:** 45 CFR § 164.312(c)(1) Integrity, § 164.312(e)(2)(i) Integrity Controls
**What:** The HMAC integrity system is enabled in the HIPAA preset (`ENABLE_HMAC_INTEGRITY: true`) but **silently degrades to a no-op** when `HMAC_SECRET` is not set in GAS Script Properties. This means session tokens can be tampered with undetected. Change to fail-closed: if HMAC is enabled but no secret is configured, refuse to create sessions.

**Preset behavior:**
- **Both presets** currently have `ENABLE_HMAC_INTEGRITY: true` — the fail-closed change applies to both. This is correct: if you've opted into HMAC, it should actually work, regardless of preset.
- **To disable HMAC entirely** (e.g., for a non-sensitive standard deployment), set `ENABLE_HMAC_INTEGRITY: false` via `PROJECT_OVERRIDES`. The `if (!AUTH_CONFIG.ENABLE_HMAC_INTEGRITY)` guard exits both functions early — no secret needed, no error thrown.
- **No new toggle needed** — this phase fixes the behavior of an existing toggle, not adding a new one.

**Current code** (`testauthgas1.gs` lines 347–371):
```javascript
function generateSessionHmac(sessionData) {
  if (!AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) return '';
  var secret = PropertiesService.getScriptProperties().getProperty(AUTH_CONFIG.HMAC_SECRET_PROPERTY);
  if (!secret) return '';  // No secret configured — HMAC is a no-op
  // ... signature generation ...
}

function verifySessionHmac(sessionData) {
  if (!AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) return true;
  var secret = PropertiesService.getScriptProperties().getProperty(AUTH_CONFIG.HMAC_SECRET_PROPERTY);
  if (!secret) return true;  // No secret → cannot verify → pass through
  if (!sessionData.hmac) return false;
  var expected = generateSessionHmac(sessionData);
  return expected === sessionData.hmac;
}
```

**Modified code:**
```javascript
function generateSessionHmac(sessionData) {
  if (!AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) return '';
  var secret = PropertiesService.getScriptProperties().getProperty(AUTH_CONFIG.HMAC_SECRET_PROPERTY);
  if (!secret) {
    // FAIL CLOSED: HMAC is enabled but secret is missing — this is a misconfiguration.
    // Log a security alert and throw to prevent session creation without integrity protection.
    auditLog('security_alert', sessionData.email || 'system', 'hmac_secret_missing',
      { property: AUTH_CONFIG.HMAC_SECRET_PROPERTY });
    throw new Error('HMAC integrity is enabled but HMAC_SECRET is not configured in Script Properties. '
      + 'Set the secret via: GAS Editor → Project Settings → Script Properties → Add: '
      + AUTH_CONFIG.HMAC_SECRET_PROPERTY + ' = <random-64-char-hex-string>');
  }
  var payload = sessionData.email
    + '|' + sessionData.createdAt
    + '|' + sessionData.lastActivity
    + '|' + (sessionData.absoluteCreatedAt || '')
    + '|' + (sessionData.displayName || '')
    + '|' + (sessionData.tokenObtainedAt || '');
  var signature = Utilities.computeHmacSha256Signature(payload, secret);
  return Utilities.base64Encode(signature);
}

function verifySessionHmac(sessionData) {
  if (!AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) return true;
  var secret = PropertiesService.getScriptProperties().getProperty(AUTH_CONFIG.HMAC_SECRET_PROPERTY);
  if (!secret) {
    // FAIL CLOSED: cannot verify without a secret — reject the session
    auditLog('security_alert', sessionData.email || 'unknown', 'hmac_secret_missing_verify',
      { property: AUTH_CONFIG.HMAC_SECRET_PROPERTY });
    return false;
  }
  if (!sessionData.hmac) return false;  // Secret exists but session has no HMAC → reject
  var expected = generateSessionHmac(sessionData);
  return expected === sessionData.hmac;
}
```

**Design decisions:**

1. **Fail-closed vs. fail-open** — the current code fails open (no secret → skip HMAC entirely). For EMR use, this is unacceptable — a misconfiguration silently disables session integrity protection. The modified code throws an error in `generateSessionHmac()` (preventing session creation) and returns `false` in `verifySessionHmac()` (rejecting existing sessions). This forces the administrator to configure the secret before the system functions.

2. **Error message includes setup instructions** — the thrown error explicitly tells the administrator how to fix it (GAS Editor → Project Settings → Script Properties). This prevents confusion when the system stops working after enabling the HIPAA preset.

3. **Audit logging on misconfiguration** — every failed HMAC attempt due to missing secret is logged as a `security_alert`. This creates a paper trail showing the system was misconfigured — important for HIPAA compliance audits.

4. **Secret generation recommendation** — the administrator should generate a cryptographically random secret: `openssl rand -hex 32` produces a 64-character hex string suitable for HMAC-SHA256. This should be documented in the project's setup instructions.

5. **No code change needed in `exchangeTokenForSession()`** — the throw from `generateSessionHmac()` propagates up through `exchangeTokenForSession()` line 457, which is inside a try/catch at the caller level (the postMessage handler catches errors and returns `server_error`). The user sees "Sign-in failed" and the audit log records the real reason.

---

### Phase 2: Domain Restriction Validation (P0 — Critical)

**Risk:** Low (configuration validation)
**Files:** `testauthgas1.gs`
**HIPAA:** 45 CFR § 164.312(d) Person or Entity Authentication
**What:** The HIPAA preset enables domain restriction (`ENABLE_DOMAIN_RESTRICTION: true`) but `ALLOWED_DOMAINS` is empty (`[]`). Add explicit validation: if domain restriction is enabled with an empty allowlist, reject all logins with a clear error.

**Preset behavior:**
- **`standard`**: `ENABLE_DOMAIN_RESTRICTION: false` — the entire domain check block is skipped. No change from current behavior.
- **`hipaa`**: `ENABLE_DOMAIN_RESTRICTION: true` — the new empty-allowlist validation fires. Admins must configure `ALLOWED_DOMAINS` or override to `false`.
- **No new toggle needed** — this phase adds validation inside the existing `ENABLE_DOMAIN_RESTRICTION` guard.

**Current domain check** (`testauthgas1.gs` lines 400–416):
```javascript
if (AUTH_CONFIG.ENABLE_DOMAIN_RESTRICTION) {
  var emailDomain = userInfo.email.split('@')[1].toLowerCase();
  var domainAllowed = false;
  for (var i = 0; i < AUTH_CONFIG.ALLOWED_DOMAINS.length; i++) {
    if (emailDomain === AUTH_CONFIG.ALLOWED_DOMAINS[i].toLowerCase()) {
      domainAllowed = true;
      break;
    }
  }
  if (!domainAllowed) {
    auditLog('login_failed', userInfo.email, 'domain_rejected',
      { domain: emailDomain, allowed: AUTH_CONFIG.ALLOWED_DOMAINS.join(',') });
    rlCache.put(tokenFingerprint, String(attemptCount + 1), 300);
    return { success: false, error: "domain_not_allowed" };
  }
}
```

**Modified domain check:**
```javascript
if (AUTH_CONFIG.ENABLE_DOMAIN_RESTRICTION) {
  // Fail closed: empty allowlist with domain restriction enabled is a misconfiguration
  if (!AUTH_CONFIG.ALLOWED_DOMAINS || AUTH_CONFIG.ALLOWED_DOMAINS.length === 0) {
    auditLog('security_alert', userInfo.email, 'domain_restriction_misconfigured',
      { reason: 'ENABLE_DOMAIN_RESTRICTION is true but ALLOWED_DOMAINS is empty' });
    return { success: false, error: "domain_not_configured" };
  }
  var emailDomain = userInfo.email.split('@')[1].toLowerCase();
  var domainAllowed = false;
  for (var i = 0; i < AUTH_CONFIG.ALLOWED_DOMAINS.length; i++) {
    if (emailDomain === AUTH_CONFIG.ALLOWED_DOMAINS[i].toLowerCase()) {
      domainAllowed = true;
      break;
    }
  }
  if (!domainAllowed) {
    auditLog('login_failed', userInfo.email, 'domain_rejected',
      { domain: emailDomain, allowed: AUTH_CONFIG.ALLOWED_DOMAINS.join(',') });
    rlCache.put(tokenFingerprint, String(attemptCount + 1), 300);
    return { success: false, error: "domain_not_allowed" };
  }
}
```

**Design decisions:**

1. **Explicit empty-check before iteration** — the existing code already rejects non-matching domains (the loop finds no match → `domainAllowed` stays `false` → login rejected). The added check makes this explicit with a distinct error code (`domain_not_configured` vs `domain_not_allowed`) and a `security_alert` audit log entry. This distinguishes "your domain isn't allowed" from "the admin forgot to configure domains".

2. **Deployment configuration** — for EMR deployment, the administrator must either:
   - Set `ALLOWED_DOMAINS: ['yourhospital.com']` and keep `ENABLE_DOMAIN_RESTRICTION: true`
   - Or set `ENABLE_DOMAIN_RESTRICTION: false` via `PROJECT_OVERRIDES` and rely on the ACL spreadsheet

3. **`PROJECT_OVERRIDES` pattern is valid** — overriding `ENABLE_DOMAIN_RESTRICTION: false` is a legitimate choice when access control is handled at the ACL spreadsheet level. The override is auditable in the source code.

---

### Phase 3: Server-Side Data Operation Validation (P1 — High)

**Risk:** Medium (adds validation to all data operation functions)
**Files:** `testauthgas1.gs`
**HIPAA:** 45 CFR § 164.312(a)(1) Access Control, § 164.312(d) Authentication
**What:** Currently, `google.script.run` calls from the GAS iframe execute **without validating the session**. The authenticated app HTML is rendered once at load time with a valid session, but subsequent `google.script.run` calls (which would read/write patient data) have no session check. If a session expires or is evicted between page load and a data operation, the operation still succeeds. This is the most critical security gap for EMR use.

**New config toggle** (add to both presets):
```javascript
// standard preset:
ENABLE_DATA_OP_VALIDATION: false,  // Data ops execute without session re-validation (current behavior)

// hipaa preset:
ENABLE_DATA_OP_VALIDATION: true,   // Every google.script.run data op validates session first
```

**Preset behavior:**
- **`standard`**: `validateSessionForData()` checks the toggle first — `if (!AUTH_CONFIG.ENABLE_DATA_OP_VALIDATION) return { email: 'unvalidated', displayName: '' };` — and returns a stub identity, allowing data operations to proceed without session re-validation (current behavior preserved).
- **`hipaa`**: Full session validation on every data operation. Expired/evicted sessions are rejected before any data access.
- **Why toggle this?** Standard deployments may not handle sensitive data and the per-operation session check adds latency (~10ms per CacheService read). HIPAA deployments need the gate; standard deployments can opt in via `PROJECT_OVERRIDES` if desired.

**The problem:**
```
1. User loads GAS app (session valid at load time)
2. User views patient data (rendered in the iframe)
3. Session expires (rolling timeout, absolute timeout, or cross-device eviction)
4. Auth wall shows on the host page (heartbeat detected expiry)
5. BUT: the GAS iframe is still loaded with live data
6. User interacts with the iframe (e.g., "Save Note" button)
7. google.script.run executes SERVER-SIDE with no session check
8. Data operation succeeds despite the expired session ← VIOLATION
```

**Solution: `validateSessionForData()` gate function**

Every `google.script.run` function that reads or writes patient data must first validate the session. Rather than duplicating validation logic in every function, create a single gate function that all data operations call first.

**New function** (add after `validateSession()` at line 545):
```javascript
// =============================================
// AUTH — Data Operation Session Gate
// Every google.script.run that touches patient data must call this first.
// Returns the validated session data (email, etc.) or throws if invalid.
// HIPAA: 45 CFR § 164.312(a)(1) — verify identity before every data access
// =============================================

function validateSessionForData(sessionToken, operationName) {
  // Toggle check — standard preset skips validation entirely
  if (!AUTH_CONFIG.ENABLE_DATA_OP_VALIDATION) {
    return { email: 'unvalidated', displayName: '' };
  }

  if (!sessionToken || sessionToken.length < 32) {
    auditLog('security_alert', 'unknown', 'data_access_no_token',
      { operation: operationName });
    throw new Error('SESSION_EXPIRED');
  }

  var cache = CacheService.getScriptCache();
  var raw = cache.get("session_" + sessionToken);
  if (!raw) {
    // Check for eviction tombstone
    var evicted = cache.get("evicted_" + sessionToken);
    auditLog('security_alert', 'unknown', 'data_access_expired_session',
      { operation: operationName, reason: evicted || 'timeout' });
    throw new Error(evicted ? 'SESSION_EVICTED' : 'SESSION_EXPIRED');
  }

  var sessionData;
  try {
    sessionData = JSON.parse(raw);
  } catch (e) {
    auditLog('security_alert', 'unknown', 'data_access_corrupt_session',
      { operation: operationName });
    throw new Error('SESSION_CORRUPT');
  }

  // HMAC verification
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY && !verifySessionHmac(sessionData)) {
    auditLog('security_alert', sessionData.email || 'unknown', 'data_access_hmac_failed',
      { operation: operationName });
    cache.remove("session_" + sessionToken);
    throw new Error('SESSION_INTEGRITY_VIOLATION');
  }

  // Absolute timeout check
  if (sessionData.absoluteCreatedAt && AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
    var absElapsed = (Date.now() - sessionData.absoluteCreatedAt) / 1000;
    if (absElapsed > AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
      auditLog('security_alert', sessionData.email, 'data_access_absolute_timeout',
        { operation: operationName, elapsed: Math.round(absElapsed) + 's' });
      cache.remove("session_" + sessionToken);
      throw new Error('SESSION_EXPIRED');
    }
  }

  // Rolling timeout check
  var elapsed = (Date.now() - sessionData.createdAt) / 1000;
  if (elapsed > AUTH_CONFIG.SESSION_EXPIRATION) {
    auditLog('security_alert', sessionData.email, 'data_access_rolling_timeout',
      { operation: operationName, elapsed: Math.round(elapsed) + 's' });
    cache.remove("session_" + sessionToken);
    throw new Error('SESSION_EXPIRED');
  }

  // Session is valid — return user identity for audit logging
  return {
    email: sessionData.email,
    displayName: sessionData.displayName
  };
}
```

**How data operations use it** (example pattern for any future `google.script.run` function):
```javascript
function savePatientNote(sessionToken, patientId, noteText) {
  // Gate: validate session before touching any data
  var user = validateSessionForData(sessionToken, 'savePatientNote');

  // Data operation (only runs if session is valid)
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PatientNotes');
  sheet.appendRow([new Date().toISOString(), user.email, patientId, noteText]);

  // Audit log (Phase 8)
  auditLog('data_access', user.email, 'write',
    { operation: 'savePatientNote', patientId: patientId });

  return { success: true };
}

function getPatientData(sessionToken, patientId) {
  var user = validateSessionForData(sessionToken, 'getPatientData');

  // ... read from Google Sheets ...

  auditLog('data_access', user.email, 'read',
    { operation: 'getPatientData', patientId: patientId });

  return { success: true, data: patientData };
}
```

**Client-side: passing the session token to `google.script.run`**

The GAS iframe needs access to the session token to pass it to `validateSessionForData()`. The token is already available on the host page (in sessionStorage). Two approaches:

**Option A — Pass token at app load time (simpler):**

Modify the authenticated app HTML (`testauthgas1.gs` line 972+) to embed the session token as a JavaScript variable:
```javascript
// In doGet(), when building the authenticated app HTML:
var html = `
  <script>
    var _sessionToken = '${escapeJs(sessionToken)}';
  </script>
  // ... rest of app HTML ...
`;
```

Then every `google.script.run` call includes it:
```javascript
google.script.run
  .withSuccessHandler(function(result) { /* ... */ })
  .withFailureHandler(function(err) {
    if (err.message === 'SESSION_EXPIRED' || err.message === 'SESSION_EVICTED') {
      // Notify host page that session is gone
      window.top.postMessage(_s({type: 'gas-session-invalid', reason: err.message}), '${PARENT_ORIGIN}');
    }
  })
  .savePatientNote(_sessionToken, patientId, noteText);
```

**Option B — Request token from host page per-operation (more secure):**

Each data operation asks the host page for the current token via postMessage:
```javascript
// In GAS iframe:
function withSessionToken(callback) {
  var requestId = Math.random().toString(36).substring(2);
  window.addEventListener('message', function handler(e) {
    if (e.data && e.data.type === 'session-token-response' && e.data.requestId === requestId) {
      window.removeEventListener('message', handler);
      if (e.data.token) {
        callback(e.data.token);
      } else {
        // Host page says no valid session
        window.top.postMessage(_s({type: 'gas-session-invalid', reason: 'no_token'}), parentOrigin);
      }
    }
  });
  window.top.postMessage(_s({type: 'request-session-token', requestId: requestId}), parentOrigin);
}

// Usage:
withSessionToken(function(token) {
  google.script.run.savePatientNote(token, patientId, noteText);
});
```

**Recommended: Option A.** The token is already embedded server-side at load time (the `doGet()` function already has `sessionToken` in scope at line 751). Option B adds latency and complexity (new message types, request/response matching) for marginal security benefit — the token in the iframe's JS context is no less secure than the token in sessionStorage (both are accessible to same-origin scripts, and the iframe is already sandboxed on Google's domain).

**Design decisions:**

1. **Throws instead of returning error objects** — `validateSessionForData()` throws on failure rather than returning `{ success: false }`. This ensures callers cannot accidentally ignore the validation result. The `withFailureHandler` in `google.script.run` catches the thrown error and can notify the host page.

2. **Operation name in audit log** — every data access attempt (successful or failed) logs which operation was attempted. This creates a detailed trail: "user X tried to call `savePatientNote` but their session was expired".

3. **No session extension** — unlike `validateSession()` (used by heartbeats), `validateSessionForData()` does NOT reset `createdAt` or extend the session. Data operations should not extend session lifetime — only explicit heartbeats (which are activity-gated) should do that. This prevents a background script from keeping a session alive indefinitely by making repeated data calls.

4. **Error codes as thrown messages** — `SESSION_EXPIRED`, `SESSION_EVICTED`, `SESSION_CORRUPT`, `SESSION_INTEGRITY_VIOLATION` are thrown as error messages. The GAS iframe's `withFailureHandler` receives these as `err.message` and can notify the host page to show the appropriate UI.

5. **New postMessage type: `gas-session-invalid`** — when a data operation fails due to session issues, the GAS iframe posts `gas-session-invalid` to the host page. The host page should handle this the same as `gas-heartbeat-expired` — show the auth wall with the appropriate reason message. Add to the message whitelist in `testauthgas1.html` line 1105.

---

### Phase 4: DOM Clearing on Session Expiry (P1 — High)

**Risk:** Medium (changes to UI state management)
**Files:** `testauthgas1.html`
**HIPAA:** 45 CFR § 164.312(a)(2)(iii) Automatic Logoff, § 164.312(c)(1) Integrity
**What:** When a session expires, the auth wall overlays the page content but does **not destroy the GAS iframe**. The iframe's DOM still contains any patient data that was rendered. A determined user could use browser DevTools to inspect the DOM and read PHI after session expiry. For EMR compliance, the iframe must be destroyed (not just hidden) when the session ends.

**New config toggle** (add to both presets):
```javascript
// standard preset:
ENABLE_DOM_CLEARING_ON_EXPIRY: false,  // Auth wall overlay only (current behavior)

// hipaa preset:
ENABLE_DOM_CLEARING_ON_EXPIRY: true,   // Destroy GAS iframe content on session expiry
```

**Preset behavior:**
- **`standard`**: `showAuthWall()` shows the overlay without touching the iframe — current behavior preserved. The iframe content persists behind the overlay (acceptable for non-PHI applications).
- **`hipaa`**: `showAuthWall()` sets `gasFrame.src = 'about:blank'` to destroy PHI in the DOM before showing the overlay.
- **Why toggle this?** DOM clearing requires iframe reload on re-auth (adds ~2-3s latency to the re-authentication flow). Standard deployments that don't display sensitive data in the GAS iframe don't need this tradeoff.

**Current behavior** (`testauthgas1.html` lines 1412–1449):
```javascript
function showAuthWall(message, email) {
  var wall = document.getElementById('auth-wall');
  var errorEl = document.getElementById('auth-error');
  var emailEl = document.getElementById('auth-email');
  var userPill = document.getElementById('user-pill');

  wall.classList.remove('hidden');  // Shows the overlay
  hideAllWarningBanners();
  userPill.style.display = 'none';
  // ... set error message and email display ...
  // NOTE: GAS iframe (#gas-app) is NOT touched — still contains rendered patient data
}
```

**Modified `showAuthWall()`:**
```javascript
function showAuthWall(message, email) {
  var wall = document.getElementById('auth-wall');
  var errorEl = document.getElementById('auth-error');
  var emailEl = document.getElementById('auth-email');
  var userPill = document.getElementById('user-pill');

  // HIPAA: Destroy the GAS iframe to clear any PHI from the DOM.
  // The auth wall overlay alone is insufficient — DevTools can still inspect
  // the iframe's content. Replacing the iframe's src with 'about:blank'
  // destroys its document tree, including any patient data rendered by GAS.
  // Toggle-gated: only active when ENABLE_DOM_CLEARING_ON_EXPIRY is true.
  if (AUTH_CONFIG.ENABLE_DOM_CLEARING_ON_EXPIRY) {
    var gasFrame = document.getElementById('gas-app');
    if (gasFrame) {
      gasFrame.src = 'about:blank';
    }
  }

  wall.classList.remove('hidden');
  hideAllWarningBanners();
  userPill.style.display = 'none';

  if (message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  } else {
    errorEl.style.display = 'none';
  }

  if (email) {
    emailEl.textContent = email;
    emailEl.style.display = 'block';
  } else {
    emailEl.style.display = 'none';
  }
}
```

**Corresponding change to `showApp()`** — when re-authenticating, the iframe must be reloaded with the new session:
```javascript
function showApp(email, displayName) {
  var wall = document.getElementById('auth-wall');
  var userPill = document.getElementById('user-pill');
  var emailDisplay = document.getElementById('user-email-display');

  wall.classList.add('hidden');
  hideAllWarningBanners();

  // Reload the GAS iframe with the new session token
  // (the iframe was destroyed by showAuthWall → about:blank)
  var gasFrame = document.getElementById('gas-app');
  var session = loadSession();
  if (gasFrame && session.token) {
    var gasUrl = gasFrame.getAttribute('data-base-url')
      + '?session=' + encodeURIComponent(session.token);
    if (gasFrame.src !== gasUrl) {
      gasFrame.src = gasUrl;
    }
  }

  if (email) {
    emailDisplay.textContent = email;
    userPill.style.display = 'flex';
  }
}
```

**Design decisions:**

1. **`about:blank` vs. removing the iframe element** — setting `src = 'about:blank'` replaces the iframe's document with an empty page, destroying all DOM content. This is preferred over `iframe.remove()` because it preserves the iframe element in the DOM (no need to recreate it on re-auth) while still clearing all content. The browser immediately discards the old document's DOM tree, JavaScript execution context, and any data stored in the iframe's `window` object.

2. **DevTools resistance** — this change specifically addresses the "inspect element to see PHI" attack vector. With `about:blank`, even DevTools shows only an empty document. Without this change, the auth wall is purely visual — the DOM tree underneath is fully intact and readable via the Elements panel or `document.querySelector('#gas-app').contentDocument`.

3. **No `sessionStorage` clearing needed** — the host page's sessionStorage only holds `gas_session_token` and `gas_user_email` (no PHI). These are session identifiers, not patient data. `clearSession()` already removes them on sign-out. No additional clearing is needed.

4. **GAS iframe reload on re-auth** — after `showAuthWall()` destroys the iframe, `showApp()` must reload it with the new session token. The `data-base-url` attribute stores the GAS deployment URL without session parameters, allowing clean reconstruction of the full URL. This attribute needs to be set when the iframe is initially created.

5. **Covers all expiry paths** — `showAuthWall()` is the single entry point for all session-end UI states: rolling timeout, absolute timeout, cross-device eviction, sign-out, tab surrender. By adding DOM clearing here, all paths are covered without needing changes in individual handlers.

---

### Phase 5: Emergency / Break-Glass Access (P2 — Medium)

**Risk:** Medium (new access path with elevated audit requirements)
**Files:** `testauthgas1.gs`
**HIPAA:** 45 CFR § 164.312(a)(2)(ii) Emergency Access Procedure
**What:** HIPAA requires an "emergency access procedure" — a mechanism to access PHI in emergencies even when normal access controls might block it. The config flags exist (`ENABLE_EMERGENCY_ACCESS: true`, `EMERGENCY_ACCESS_PROPERTY: 'EMERGENCY_ACCESS_EMAILS'`) in the HIPAA preset but **no code implements them**. Implement a break-glass mechanism that bypasses normal ACL checks with enhanced audit logging.

**Preset behavior:**
- **`standard`**: `ENABLE_EMERGENCY_ACCESS: false` (existing) — the `if (AUTH_CONFIG.ENABLE_EMERGENCY_ACCESS)` guard skips the break-glass check entirely. ACL denial is final.
- **`hipaa`**: `ENABLE_EMERGENCY_ACCESS: true` (existing) — break-glass path activates when normal ACL fails. Requires `EMERGENCY_ACCESS_EMAILS` in Script Properties.
- **No new toggle needed** — the existing toggle and property key are already in both presets. This phase implements the code behind them.

**How it works:**

1. Administrator stores a comma-separated list of email addresses in GAS Script Properties under the key `EMERGENCY_ACCESS_EMAILS`
2. During login, if the user's email is in the emergency list AND they fail the normal ACL check, they are granted access via the break-glass path
3. Every break-glass access is logged with a distinct `emergency_access` audit event
4. Break-glass sessions get a shortened absolute timeout (1 hour vs. 8 hours) to minimize exposure
5. Break-glass access is only used when normal access fails — if the user passes the normal ACL check, the emergency path is never triggered

**Implementation location** (`testauthgas1.gs` — inside `exchangeTokenForSession()`, after the ACL check at lines 418–428):

**Current code:**
```javascript
// Check access via master ACL spreadsheet (or fall back to SPREADSHEET_ID editor/viewer list)
var hasAcl = MASTER_ACL_SPREADSHEET_ID && MASTER_ACL_SPREADSHEET_ID !== "YOUR_MASTER_ACL_SPREADSHEET_ID";
var hasSheet = SPREADSHEET_ID && SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID";
if (hasAcl || hasSheet) {
  if (!checkSpreadsheetAccess(userInfo.email)) {
    auditLog('login_failed', userInfo.email, 'access_denied',
      { reason: 'No spreadsheet access' });
    rlCache.put(tokenFingerprint, String(attemptCount + 1), 300);
    return { success: false, error: "not_authorized" };
  }
}
```

**Modified code:**
```javascript
var hasAcl = MASTER_ACL_SPREADSHEET_ID && MASTER_ACL_SPREADSHEET_ID !== "YOUR_MASTER_ACL_SPREADSHEET_ID";
var hasSheet = SPREADSHEET_ID && SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID";
var isEmergencyAccess = false;
if (hasAcl || hasSheet) {
  if (!checkSpreadsheetAccess(userInfo.email)) {
    // Normal access denied — check for emergency/break-glass access
    if (AUTH_CONFIG.ENABLE_EMERGENCY_ACCESS) {
      var emergencyEmails = PropertiesService.getScriptProperties()
        .getProperty(AUTH_CONFIG.EMERGENCY_ACCESS_PROPERTY);
      if (emergencyEmails) {
        var allowedEmergency = emergencyEmails.split(',').map(function(e) {
          return e.trim().toLowerCase();
        });
        if (allowedEmergency.indexOf(userInfo.email.toLowerCase()) !== -1) {
          isEmergencyAccess = true;
          auditLog('emergency_access', userInfo.email, 'break_glass_activated',
            { reason: 'Normal ACL denied, emergency access granted',
              normalAcl: 'denied' });
        }
      }
    }
    if (!isEmergencyAccess) {
      auditLog('login_failed', userInfo.email, 'access_denied',
        { reason: 'No spreadsheet access' });
      rlCache.put(tokenFingerprint, String(attemptCount + 1), 300);
      return { success: false, error: "not_authorized" };
    }
  }
}

// ... session creation code (existing) ...

// After session creation, if emergency access, override the absolute timeout
if (isEmergencyAccess) {
  // Shortened absolute timeout for break-glass sessions (1 hour max)
  var EMERGENCY_ABSOLUTE_TIMEOUT = 3600;
  var emergencySessionData = JSON.parse(cache.get("session_" + sessionToken));
  emergencySessionData.isEmergencyAccess = true;
  emergencySessionData.emergencyAbsoluteTimeout = EMERGENCY_ABSOLUTE_TIMEOUT;
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) {
    emergencySessionData.hmac = generateSessionHmac(emergencySessionData);
  }
  cache.put("session_" + sessionToken, JSON.stringify(emergencySessionData),
    AUTH_CONFIG.SESSION_EXPIRATION);
}
```

**Heartbeat handler modification** — check `emergencyAbsoluteTimeout` if present:

In the heartbeat absolute timeout check (`testauthgas1.gs` lines 817–831), add:
```javascript
// Emergency access sessions have a shortened absolute timeout
var effectiveAbsoluteTimeout = hbData.emergencyAbsoluteTimeout || AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT;
if (hbData.absoluteCreatedAt && effectiveAbsoluteTimeout) {
  var hbAbsElapsed = (Date.now() - hbData.absoluteCreatedAt) / 1000;
  if (hbAbsElapsed > effectiveAbsoluteTimeout) {
    // ... existing timeout handling, but log emergency context if applicable ...
    auditLog('session_expired', hbData.email,
      hbData.isEmergencyAccess ? 'emergency_absolute_timeout' : 'absolute_timeout_heartbeat',
      { elapsed: Math.round(hbAbsElapsed) + 's', limit: effectiveAbsoluteTimeout + 's',
        isEmergencyAccess: !!hbData.isEmergencyAccess });
    // ... rest of existing timeout code ...
  }
}
```

**Design decisions:**

1. **ACL-first, emergency-second** — the break-glass path is only evaluated after the normal ACL check fails. Users who have normal access never trigger the emergency path, even if they're in the emergency list. This minimizes the number of elevated-access sessions.

2. **Script Properties, not CLAUDE.md / code** — emergency email addresses are stored in GAS Script Properties (server-side, not in source code). This allows administrators to add/remove emergency users without code changes or deployments. The property key is configurable via `EMERGENCY_ACCESS_PROPERTY` in the preset.

3. **Shortened absolute timeout** — emergency sessions have a 1-hour hard ceiling instead of the normal 8 hours. This limits the exposure window of break-glass access. The rolling timeout still applies normally (15 minutes HIPAA / 3 min test).

4. **`isEmergencyAccess` flag in session data** — this flag is stored in the session object so that subsequent operations (heartbeat, data access) can log the elevated context. It is included in the HMAC payload (via the stringification of session data) so it cannot be tampered with.

5. **Distinct audit event type: `emergency_access`** — break-glass activations use a unique event type that is easy to query in audit reports. HIPAA auditors specifically look for emergency access events — they should be rare and each one should be reviewable.

6. **No UI distinction** — the user sees the same app interface regardless of whether they accessed via normal or emergency path. The elevated context is only visible in audit logs and the shortened timeout. Adding a visible "EMERGENCY ACCESS" banner is optional (could be a Phase 5.1 enhancement).

---

### Phase 6: Account Lockout After Failed Attempts (P2 — Medium)

**Risk:** Low (extends existing rate limiting)
**Files:** `testauthgas1.gs`
**HIPAA:** 45 CFR § 164.312(d) Authentication
**NIST:** SP 800-63B § 5.2.2 — Rate limiting / lockout mechanisms
**What:** The current system has rate limiting (5 failed attempts per 5-minute window per token fingerprint) but no permanent or semi-permanent lockout. After the 5-minute window expires, an attacker can retry indefinitely. Add escalating lockout: temporary → extended → requires admin unlock.

**New config toggle** (add to both presets):
```javascript
// standard preset:
ENABLE_ESCALATING_LOCKOUT: false,  // Use existing flat rate limit (5/5min)

// hipaa preset:
ENABLE_ESCALATING_LOCKOUT: true,   // Escalating lockout tiers (5min → 30min → 6hr)
```

**Preset behavior:**
- **`standard`**: `ENABLE_ESCALATING_LOCKOUT: false` — the existing flat rate limit code runs as-is (5 failures / 5 min window). No escalation tiers.
- **`hipaa`**: `ENABLE_ESCALATING_LOCKOUT: true` — the escalating lockout code replaces the flat rate limit with three tiers.

**Current rate limiting** (`testauthgas1.gs` lines 383–391):
```javascript
var rlCache = CacheService.getScriptCache();
var tokenFingerprint = 'ratelimit_' + accessToken.substring(0, 16);
var attempts = rlCache.get(tokenFingerprint);
var attemptCount = attempts ? parseInt(attempts, 10) : 0;
if (attemptCount >= 5) {
  auditLog('login_failed', '', 'rate_limited', { fingerprint: tokenFingerprint.substring(0, 20) });
  return { success: false, error: "rate_limited" };
}
```

**Modified rate limiting with escalating lockout:**
```javascript
var rlCache = CacheService.getScriptCache();
var tokenFingerprint = 'ratelimit_' + accessToken.substring(0, 16);
var attempts = rlCache.get(tokenFingerprint);
var attemptCount = attempts ? parseInt(attempts, 10) : 0;

// When escalating lockout is disabled (standard preset), use existing flat rate limit
if (!AUTH_CONFIG.ENABLE_ESCALATING_LOCKOUT) {
  if (attemptCount >= 5) {
    auditLog('login_failed', '', 'rate_limited', { fingerprint: tokenFingerprint.substring(0, 20) });
    return { success: false, error: "rate_limited" };
  }
  // ... rest of login flow (existing behavior) ...
}

// Escalating lockout thresholds (hipaa preset)
// Tier 1: 5 failures in 5 min → 5 min lockout (existing behavior, just made explicit)
// Tier 2: 10 cumulative failures → 30 min lockout
// Tier 3: 20 cumulative failures → account flagged for admin review
var LOCKOUT_TIER1 = 5;
var LOCKOUT_TIER1_DURATION = 300;    // 5 minutes
var LOCKOUT_TIER2 = 10;
var LOCKOUT_TIER2_DURATION = 1800;   // 30 minutes
var LOCKOUT_TIER3 = 20;
var LOCKOUT_TIER3_DURATION = 21600;  // 6 hours

if (attemptCount >= LOCKOUT_TIER3) {
  auditLog('security_alert', '', 'account_locked_tier3',
    { fingerprint: tokenFingerprint.substring(0, 20), attempts: attemptCount });
  return { success: false, error: "account_locked" };
}
if (attemptCount >= LOCKOUT_TIER2) {
  auditLog('login_failed', '', 'rate_limited_tier2',
    { fingerprint: tokenFingerprint.substring(0, 20), attempts: attemptCount });
  // Extend lockout window to 30 minutes
  rlCache.put(tokenFingerprint, String(attemptCount + 1), LOCKOUT_TIER2_DURATION);
  return { success: false, error: "rate_limited" };
}
if (attemptCount >= LOCKOUT_TIER1) {
  auditLog('login_failed', '', 'rate_limited',
    { fingerprint: tokenFingerprint.substring(0, 20), attempts: attemptCount });
  return { success: false, error: "rate_limited" };
}
```

**On failed login, increment with appropriate TTL:**
```javascript
// After a failed login attempt (replace existing increment logic):
var lockoutDuration = LOCKOUT_TIER1_DURATION;
if (attemptCount + 1 >= LOCKOUT_TIER3) {
  lockoutDuration = LOCKOUT_TIER3_DURATION;
} else if (attemptCount + 1 >= LOCKOUT_TIER2) {
  lockoutDuration = LOCKOUT_TIER2_DURATION;
}
rlCache.put(tokenFingerprint, String(attemptCount + 1), lockoutDuration);
```

**Design decisions:**

1. **Escalating tiers instead of fixed lockout** — NIST SP 800-63B recommends rate limiting that increases in severity. A single fixed lockout (e.g., 15 min after 5 failures) doesn't adequately deter persistent attacks but can annoy legitimate users who mistype their credentials. The three-tier approach balances usability (Tier 1: brief lockout for typos) with security (Tier 3: extended lockout for attacks).

2. **CacheService-based lockout** — lockout state is stored in CacheService with the rate limit counters. This means lockouts are automatically cleared by CacheService TTL — no manual admin intervention needed for Tiers 1 and 2. Tier 3's 6-hour lockout is long enough to deter automated attacks while eventually self-healing.

3. **Token fingerprint, not email** — the rate limit key is based on the OAuth access token prefix, not the user's email. This is important because the email is not known until after token validation (the rate limit check runs before `validateGoogleToken()`). This means an attacker using different tokens but the same IP would need a separate bypass strategy — each token gets its own counter.

4. **`account_locked` vs `rate_limited` error** — Tier 3 returns a distinct error code so the client can show a different message: "Account temporarily locked. Contact your administrator." vs. "Too many attempts. Please wait and try again."

5. **Successful login clears the counter** — the existing `rlCache.remove(tokenFingerprint)` at line 466 already clears the counter on successful login. This is correct — a successful login proves the user knows their credentials, so the lockout should reset.

---

### Phase 7: IP-Based Session Binding (P2 — Medium)

**Risk:** Medium (may cause issues with mobile/VPN users)
**Files:** `testauthgas1.gs`
**HIPAA:** 45 CFR § 164.312(d) Authentication (defense-in-depth)
**What:** Bind sessions to the originating IP address. If a session token is used from a different IP than the one that created it, the session is invalidated. This mitigates session token theft — a stolen token is useless from a different network.

**New config toggle** (add to both presets):
```javascript
// standard preset:
ENABLE_IP_LOGGING: false,        // Do not fetch or log client IP

// hipaa preset:
ENABLE_IP_LOGGING: true,         // Fetch client IP and include in audit log entries
```

**Preset behavior:**
- **`standard`**: `ENABLE_IP_LOGGING: false` — the client-side IP fetch (`api.ipify.org`) is skipped, no `clientIp` parameter in heartbeat URLs, audit entries have no IP data. Zero external API calls.
- **`hipaa`**: `ENABLE_IP_LOGGING: true` — client IP is fetched and included in heartbeats and audit entries for post-incident investigation.

**Original toggle revised** — the initial plan proposed `ENABLE_IP_BINDING` with strict/subnet modes, but the GAS platform limitation (see below) prevents actual binding. The toggle is renamed to `ENABLE_IP_LOGGING` to accurately reflect its logging-only capability.

**Capturing the IP** — in `exchangeTokenForSession()`, store the client IP in session data:

GAS provides the client IP via the request event object. However, `exchangeTokenForSession()` is called via `google.script.run` (not `doGet`), so `e.parameter` is not available. The IP must be captured differently:

```javascript
// At the top of exchangeTokenForSession(), capture the request IP
// google.script.run does not expose client IP directly — but GAS provides it via:
function getClientIp_() {
  // In doGet context: available via e (not applicable for google.script.run)
  // In google.script.run context: use Session.getActiveUser() for identity,
  // but IP is NOT available in google.script.run calls.
  // LIMITATION: GAS does not expose the client IP for google.script.run calls.
  // IP binding can only work for doGet-based flows (heartbeat, initial load).
  return null;
}
```

**GAS limitation — IP binding scope:**

Google Apps Script does **not** expose the client IP address for `google.script.run` calls. The IP is only available in `doGet(e)` via deployment logs (not programmatically accessible at runtime). This fundamentally limits IP binding to:

1. **Heartbeat validation** — the heartbeat uses `doGet(?heartbeat=TOKEN)`. We cannot access `e.userIp` or similar in GAS's `doGet` either — GAS does not include client IP in the event parameter. **This is a GAS platform limitation.**

2. **Alternative: Client-reported IP with integrity check** — the client can fetch its own IP from a CORS-friendly service (e.g., `https://api.ipify.org?format=json`) and include it in heartbeat/data requests. However, this is client-reported and can be spoofed — it provides logging value but not security value.

**Revised approach — IP logging only (not binding):**

Given the GAS platform limitation, convert this phase to **IP logging** rather than binding:

```javascript
// In the authenticated app HTML, fetch the client IP (only when IP logging is enabled)
if (AUTH_CONFIG.ENABLE_IP_LOGGING) {
  fetch('https://api.ipify.org?format=json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _clientIp = data.ip;
    })
    .catch(function() { _clientIp = 'unknown'; });
}

// Include _clientIp in the gas-user-activity postMessage
window.top.postMessage(_s({
  type: 'gas-user-activity',
  clientIp: _clientIp  // For audit logging via heartbeat
}), parentOrigin);
```

The host page includes the IP in the heartbeat URL:
```javascript
// In sendHeartbeat():
var hbUrl = gasBaseUrl + '?heartbeat=' + encodeURIComponent(token)
  + '&msgKey=' + encodeURIComponent(_messageKey)
  + '&clientIp=' + encodeURIComponent(_clientIp || '');
```

The server logs the IP in audit entries:
```javascript
// In doGet heartbeat handler:
var clientIp = (e && e.parameter && e.parameter.clientIp) || 'unknown';
// ... include clientIp in audit log details for session-related events
```

**Design decisions:**

1. **Logging, not enforcement** — due to the GAS platform limitation (no server-side access to client IP), IP binding cannot be enforced securely. Client-reported IPs can be spoofed. However, logging client-reported IPs is still valuable for:
   - Post-incident investigation (correlating access patterns with IP addresses)
   - Detecting anomalies (same session used from drastically different IPs in audit reports)
   - Compliance documentation (demonstrating that IP monitoring was implemented)

2. **`api.ipify.org` for client IP** — this is a free, CORS-enabled service that returns the client's public IP. It's used by the browser-side code, not by GAS. The IP is self-reported and unverified.

3. **No session invalidation based on IP** — since the IP is client-reported, using it for session invalidation would allow an attacker to trigger false positives by sending heartbeats with a different IP. The IP is informational only.

4. **Future enhancement** — if Google adds server-side IP access to GAS (or if the architecture migrates to a different backend), this phase can be upgraded from logging to enforcement with minimal changes.

---

### Phase 8: Data-Level Audit Logging (P3 — Recommended)

**Risk:** Low (adds logging to data operations)
**Files:** `testauthgas1.gs`
**HIPAA:** 45 CFR § 164.312(b) Audit Controls — "implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI"
**What:** The current audit log captures login/logout/session events but NOT individual data access events. For EMR compliance, every read, write, update, and delete of patient data must be logged with: who, what, when, and which patient record.

**New config toggle** (add to both presets):
```javascript
// standard preset:
ENABLE_DATA_AUDIT_LOG: false,     // No per-operation audit logging (current behavior)
DATA_AUDIT_LOG_SHEET_NAME: 'DataAuditLog',

// hipaa preset:
ENABLE_DATA_AUDIT_LOG: true,      // Log individual data access events (reads, writes)
DATA_AUDIT_LOG_SHEET_NAME: 'DataAuditLog',
```

**Preset behavior:**
- **`standard`**: `ENABLE_DATA_AUDIT_LOG: false` — `dataAuditLog()` returns immediately on the first line (`if (!AUTH_CONFIG.ENABLE_DATA_AUDIT_LOG) return;`). No Sheets writes, no quota impact. Session-level audit logging (`ENABLE_AUDIT_LOG`) is a separate toggle and is independently controlled.
- **`hipaa`**: `ENABLE_DATA_AUDIT_LOG: true` — every data operation writes an audit record to the `DataAuditLog` sheet. See Quota Impact Analysis for volume estimates.

**New audit function:**
```javascript
function dataAuditLog(user, action, resourceType, resourceId, details) {
  if (!AUTH_CONFIG.ENABLE_DATA_AUDIT_LOG) return;
  try {
    if (!SPREADSHEET_ID || SPREADSHEET_ID === "YOUR_SPREADSHEET_ID") return;
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetName = AUTH_CONFIG.DATA_AUDIT_LOG_SHEET_NAME || 'DataAuditLog';
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        'Timestamp',      // ISO 8601
        'User',           // email address
        'Action',         // read, write, update, delete, export, print
        'ResourceType',   // patient_note, patient_record, medication, lab_result, etc.
        'ResourceId',     // patient ID or record ID
        'Details',        // JSON — additional context (fields accessed, search query, etc.)
        'SessionId',      // first 8 chars of session token (for correlation with session audit)
        'IsEmergencyAccess'  // boolean — was this a break-glass session?
      ]);
      // Protect the audit sheet — prevent non-admin edits
      var protection = sheet.protect();
      protection.setDescription('HIPAA Data Audit Log — protected');
      protection.setWarningOnly(true);  // Warn but don't block (owner always has access)
    }
    sheet.appendRow([
      new Date().toISOString(),
      user.email || user,
      action,
      resourceType,
      resourceId || '',
      JSON.stringify(details || {}),
      details && details.sessionId ? details.sessionId.substring(0, 8) + '...' : '',
      details && details.isEmergencyAccess ? 'YES' : 'NO'
    ]);
  } catch(e) {
    Logger.log('Data audit log error: ' + e.message);
  }
}
```

**Integration with data operations** (used alongside `validateSessionForData()` from Phase 3):
```javascript
function getPatientRecord(sessionToken, patientId) {
  var user = validateSessionForData(sessionToken, 'getPatientRecord');

  // ... read patient data from Google Sheets ...

  dataAuditLog(user, 'read', 'patient_record', patientId, {
    sessionId: sessionToken,
    isEmergencyAccess: /* from session data */,
    fieldsAccessed: ['name', 'dob', 'diagnosis', 'medications']
  });

  return { success: true, data: record };
}

function updatePatientNote(sessionToken, patientId, noteId, noteText) {
  var user = validateSessionForData(sessionToken, 'updatePatientNote');

  // ... update note in Google Sheets ...

  dataAuditLog(user, 'write', 'patient_note', patientId, {
    sessionId: sessionToken,
    isEmergencyAccess: /* from session data */,
    noteId: noteId,
    action: 'update'
  });

  return { success: true };
}
```

**HIPAA-required audit events:**

| Action | When | What to log |
|--------|------|-------------|
| `read` | Patient record viewed | User, patient ID, fields accessed |
| `write` | New data created | User, patient ID, record type |
| `update` | Existing data modified | User, patient ID, field changed, old→new value (redacted) |
| `delete` | Data deleted | User, patient ID, record type, reason |
| `export` | Data exported/downloaded | User, patient ID(s), export format |
| `search` | Patient search performed | User, search query, result count |
| `print` | Data printed | User, patient ID, what was printed |

**Design decisions:**

1. **Separate sheet from session audit log** — data access events are high-volume (every read/write) while session events are low-volume (login/logout). Separating them prevents the session audit log from being overwhelmed and makes HIPAA audit reviews easier — reviewers can focus on one sheet at a time.

2. **Sheet protection** — the audit sheet is protected on creation to prevent tampering. `setWarningOnly(true)` is used instead of `removeEditors()` because GAS script execution always runs as the script owner — strict protection would block the script itself. The warning is sufficient to deter manual edits while allowing programmatic writes.

3. **`IsEmergencyAccess` column** — every data access logged during a break-glass session is explicitly flagged. HIPAA auditors can filter the audit log for `IsEmergencyAccess = YES` to review all emergency access events.

4. **Session ID correlation** — the first 8 characters of the session token are logged (truncated for security). This allows audit reviewers to correlate data access events with the session log (which also logs truncated session IDs) to see: when the user logged in → what data they accessed → when they logged out.

5. **`fieldsAccessed` array** — for read operations, logging which specific fields were accessed (e.g., `['name', 'diagnosis']` vs. the entire record) supports the HIPAA "minimum necessary" principle — you can audit whether users are accessing more data than they need.

6. **Google Sheets is BAA-covered** — audit logs stored in Google Sheets are covered under the Google Workspace BAA, making them suitable for storing audit records that reference PHI (patient IDs, user emails). CacheService is NOT BAA-covered and must never store audit records or PHI.

---

## CacheService Usage — What Can and Cannot Be Stored

| Data Type | CacheService? | Google Sheets? | Why |
|-----------|--------------|---------------|-----|
| Session tokens (UUIDs) | ✅ Yes | No | Tokens are random identifiers, not PHI. CacheService provides fast read/write with automatic TTL expiry |
| Session metadata (email, timestamps, HMAC) | ✅ Yes | No | Email is PII but not PHI in the session context. Metadata is needed for low-latency session validation |
| Eviction tombstones | ✅ Yes | No | Short-lived markers (5 min TTL). No PHI content |
| Rate limit counters | ✅ Yes | No | Numeric counters with token fingerprints. No PHI |
| Patient data (names, DOB, diagnoses, notes) | ❌ **Never** | ✅ Yes | PHI must be stored in BAA-covered services. Google Sheets is covered; CacheService is NOT |
| Audit logs | ❌ **Never** | ✅ Yes | Audit records reference PHI (patient IDs). Must be in BAA-covered, persistent storage |
| Emergency access state | ✅ Yes (flag only) | Audit log | The `isEmergencyAccess` boolean in session data is a flag, not PHI. The audit trail of emergency access goes to Google Sheets |

**Google Workspace BAA Coverage (relevant services):**
- ✅ **Covered:** Google Sheets, Google Drive, Gmail, Google Docs, Google Slides, Google Forms, Google Sites, Google Chat, Google Meet, Google Calendar, Google Keep, Google Tasks, Google Vault, Google Groups, Cloud Identity
- ❌ **Not covered:** CacheService, PropertiesService, UrlFetchService, LockService, Apps Script runtime/execution logs, Google Analytics, YouTube
- The BAA covers the data stored within these services — the transport (HTTPS/TLS) is secure regardless of BAA status

---

## Quota Impact Analysis

| Phase | Additional CacheService ops | Additional Sheets ops | Notes |
|-------|---------------------------|----------------------|-------|
| Phase 1 (HMAC enforcement) | 0 (changes behavior, not volume) | +1 write on misconfiguration (audit log) | One-time alert, not ongoing |
| Phase 2 (Domain validation) | 0 | +1 write on misconfiguration | One-time alert |
| Phase 3 (Data validation) | +1 read per data operation (session lookup) | +1 write per data operation (audit log, Phase 8) | Most significant quota impact — see analysis below |
| Phase 4 (DOM clearing) | 0 | 0 | Client-side only |
| Phase 5 (Emergency access) | +1 read/write per emergency login | +1 write per emergency login | Rare events |
| Phase 6 (Account lockout) | +1 write per failed login (longer TTL) | +1 write per lockout event | Existing pattern, extended |
| Phase 7 (IP logging) | 0 | +1 write per heartbeat (IP in details) | Adds to existing audit entries |
| Phase 8 (Data audit) | 0 | +1 write per data operation | High-volume — see analysis |

**Phase 3 + 8 quota analysis (data operations):**

Assuming 10 users, each performing ~50 data operations per hour (reads + writes):
- CacheService reads: 500/hour additional (session validation per operation)
- Sheets writes: 500/hour additional (data audit log)
- CacheService quota: 100,000 calls per 6-hour rolling window → 500/hour = 3,000/6hr → **3% of quota**
- Sheets quota: 100 writes/min → 500/hour = ~8.3/min → **8.3% of quota**

For 50 concurrent users (enterprise scale):
- CacheService: 2,500/hour = 15,000/6hr → **15% of quota** (comfortable)
- Sheets: 2,500/hour = ~41.7/min → **41.7% of quota** (watch carefully)

**Mitigation for high-volume Sheets writes:** batch audit log entries using a write buffer — accumulate entries in CacheService for 30 seconds, then flush to Sheets in a single `setValues()` call. This reduces Sheets write operations by ~30x while keeping CacheService well within quota.

---

## What Changed Since Plan 9.2

| Aspect | Plan 9.2 State | After This Plan (HIPAA) | Standard Preset |
|--------|---------------|------------------------|-----------------|
| HMAC integrity | Enabled but silently no-op without secret | **Fail-closed** — refuses sessions if secret missing | Same (both presets have `ENABLE_HMAC_INTEGRITY: true`; disable via override if unwanted) |
| Domain restriction | Enabled but empty allowlist + override to disabled | **Explicit validation** — empty allowlist = fail-closed with audit alert | Skipped (`ENABLE_DOMAIN_RESTRICTION: false`) |
| Data operation auth | No session check on `google.script.run` calls | **Every data op validates session** via `validateSessionForData()` | Skipped (`ENABLE_DATA_OP_VALIDATION: false`) — current behavior |
| DOM on session expiry | Auth wall overlay (GAS iframe content persists) | **GAS iframe destroyed** (`about:blank`) — PHI cleared from DOM | Overlay only (`ENABLE_DOM_CLEARING_ON_EXPIRY: false`) — current behavior |
| Emergency access | Config flags exist, no implementation | **Full break-glass** with shortened timeout + enhanced audit | Disabled (`ENABLE_EMERGENCY_ACCESS: false`) |
| Account lockout | 5 failures / 5 min window only | **Escalating lockout** — 5min → 30min → 6hr tiers | Flat rate limit (`ENABLE_ESCALATING_LOCKOUT: false`) — current behavior |
| IP tracking | None | **Client-reported IP in audit logs** (logging only — GAS limitation) | Disabled (`ENABLE_IP_LOGGING: false`) |
| Data audit logging | Login/logout events only | **Per-operation audit** — who accessed what patient data, when | Disabled (`ENABLE_DATA_AUDIT_LOG: false`) |
| PHI storage | Not explicitly restricted | **Architecture rule** — PHI only in Google Sheets (BAA-covered), never in CacheService or browser storage | Same rule (applies regardless of preset) |

---

## Edge Cases

### 1. HMAC secret rotation
**Problem:** Changing the `HMAC_SECRET` in Script Properties invalidates all existing sessions (their HMACs won't verify against the new secret).
**Mitigation:** Schedule secret rotation during a maintenance window. All active sessions will fail on their next heartbeat and users will need to re-authenticate. This is acceptable for security — the rotation window is brief and the user experience is a normal re-authentication flow. Log a `security_alert` event: `hmac_secret_rotated`.

### 2. Emergency access abuse
**Problem:** A user in the emergency access list could use break-glass access routinely instead of getting proper ACL access.
**Mitigation:** The data audit log flags every emergency access session. Regular audit reviews should check for patterns: if a user is using emergency access frequently, they should be added to the normal ACL. The shortened absolute timeout (1 hour) also naturally discourages routine use.

### 3. CacheService eviction during data operation
**Problem:** CacheService has a 25 MB per-script limit. Under extreme load, least-recently-used entries may be evicted before their TTL, causing a valid session to disappear mid-operation.
**Mitigation:** `validateSessionForData()` treats a missing session as expired (same behavior as natural timeout). The user sees "Session expired" and re-authenticates. This is safe — no data is lost (the Sheets operation hasn't started yet because validation happens first). The risk is low in practice: at 50 concurrent users with ~500-byte sessions, total session storage is ~25 KB — well under the 25 MB limit.

### 4. Race condition: DOM clearing vs. data save
**Problem:** User clicks "Save Note" in the GAS iframe → activity detection triggers heartbeat → heartbeat finds expired session → `showAuthWall()` destroys the iframe → the `google.script.run.saveNote()` call that was in-flight gets killed.
**Mitigation:** This is the correct behavior. The data operation should NOT succeed if the session is expired. `validateSessionForData()` (Phase 3) would reject the server-side call anyway. The client-side race condition and the server-side validation are complementary — either one alone is sufficient, but both together provide defense-in-depth.

### 5. Break-glass + cross-device enforcement
**Problem:** Emergency access user on Device B signs in → Device A's emergency session is evicted. Is this correct?
**Mitigation:** Yes — cross-device enforcement applies equally to emergency sessions. Only one session per user, regardless of access type. If the same emergency user needs access on two devices simultaneously, `MAX_SESSIONS_PER_USER` must be increased (which requires a code change and audit trail).

### 6. Audit log sheet exceeding Google Sheets limits
**Problem:** Google Sheets has a 10 million cell limit. At high volumes, the data audit log could approach this limit.
**Mitigation:** Implement periodic log rotation — archive audit records older than the HIPAA retention period (6 years per `AUDIT_LOG_RETENTION_YEARS`) to a separate archival spreadsheet or Google Drive file. For the data audit log specifically, consider rotation at 500,000 rows (approximately 4 million cells with 8 columns) — create a new sheet named `DataAuditLog_YYYYMM` and start fresh. The retention period config already exists in the preset.

### 7. Client-reported IP spoofing
**Problem:** Phase 7's client-reported IP can be faked by modifying the JavaScript or intercepting the `api.ipify.org` response.
**Mitigation:** Acknowledged — this is why Phase 7 is logging-only, not enforcement. The IP is informational for audit purposes. A sophisticated attacker could spoof it, but the combination of (a) valid session token, (b) valid HMAC, (c) valid Google OAuth session, and (d) passing ACL check makes IP spoofing a low-priority concern — the attacker would need to compromise all of those first.

### 8. `about:blank` and iframe reload timing
**Problem:** Setting `gasFrame.src = 'about:blank'` in `showAuthWall()` may trigger a brief visual flash as the iframe transitions from content to blank.
**Mitigation:** The auth wall overlay (`z-index: 10002`) is positioned above the iframe, so the flash is invisible to the user. The iframe content changes behind the overlay. When `showApp()` reloads the iframe, the GAS app takes a moment to load — during this time, the auth wall should remain visible (a loading indicator can be added in the future).

---

## Implementation Risk Areas (Toggle Architecture)

Overall implementation confidence is **high** — the toggle-gated pattern is already battle-tested in the codebase (HMAC, domain restriction, emergency access all use it), and the `standard` preset code paths are mostly no-ops (early returns). However, three specific integration seams require careful attention during implementation:

### Risk 1: Phase 3 — `validateSessionForData()` stub return value (Medium)

**Problem:** When `ENABLE_DATA_OP_VALIDATION` is `false`, the function returns `{ email: 'unvalidated', displayName: '' }` immediately. Any downstream code that uses the returned `email` for display, logging, or spreadsheet filtering will encounter the literal string `'unvalidated'` instead of a real email address. If a spreadsheet column filters by email and encounters `'unvalidated'`, it could produce unexpected results or silently drop records.

**Mitigation:** During implementation, grep every call site of `validateSessionForData()` and trace how the return value is consumed. Verify that:
- Audit log entries handle `'unvalidated'` gracefully (or skip logging when validation is disabled)
- Any UI that displays the email doesn't show `'unvalidated'` to the user
- Spreadsheet filtering/querying logic doesn't break on a non-email string

### Risk 2: Phase 4 — `AUTH_CONFIG` server/client boundary (Medium)

**Problem:** The toggle `ENABLE_DOM_CLEARING_ON_EXPIRY` needs to be accessible in the HTML layer (client-side), but `AUTH_CONFIG` lives in the GAS server-side code. The existing pattern passes auth config to the client during `checkLoginStatus()`. If `ENABLE_DOM_CLEARING_ON_EXPIRY` is omitted from that config transfer, the client-side `if` guard will see `undefined` (falsy) and silently skip DOM clearing even under the `hipaa` preset — a silent security failure with no error.

**Mitigation:** During implementation, verify the config transfer function (in the `checkLoginStatus` response path) explicitly includes `ENABLE_DOM_CLEARING_ON_EXPIRY` in the client-facing config object. Test by:
1. Setting `hipaa` preset → confirming `ENABLE_DOM_CLEARING_ON_EXPIRY` arrives client-side as `true`
2. Setting `standard` preset → confirming it arrives as `false`
3. Deliberately omitting it from the transfer → confirming the guard fails safe (should it default to clearing or not-clearing? Document the decision)

### Risk 3: Phase 6 — Branching flow control in login function (Low-Medium)

**Problem:** The escalating lockout replaces the existing flat rate limit with a multi-tier system. The `if (!AUTH_CONFIG.ENABLE_ESCALATING_LOCKOUT)` branch must contain the **complete** existing rate-limit logic as a fallback, not just a subset. If the existing logic gets partially duplicated or a code path is missed, `standard` preset users could experience either no rate limiting (security regression) or double rate limiting (usability bug).

**Mitigation:** During implementation:
1. Extract the existing rate-limit logic verbatim before any refactoring
2. Paste it intact inside the `!ENABLE_ESCALATING_LOCKOUT` branch
3. Add the escalating logic in the `else` branch (hipaa path)
4. Verify the `standard` path produces identical behavior to the pre-change code by tracing: 5 failures → rate limited, 4 failures → allowed, counter reset → allowed

### Why these are manageable

All three risks are at **integration seams** (config transfer, return value contracts, flow control branching) — not fundamental design problems. The toggle architecture actually *reduces* overall risk compared to a HIPAA-only approach because every feature has an explicit off switch, and `standard` preset behavior is verified independently from `hipaa` behavior. Each risk has a concrete, testable mitigation.

---

## Implementation Order

The phases should be implemented in priority order, but some phases have dependencies:

```
Phase 1 (HMAC) ──────────────────────► Can be implemented independently
Phase 2 (Domain) ────────────────────► Can be implemented independently
Phase 3 (Data validation) ───────────► Prerequisite for Phase 8
Phase 4 (DOM clearing) ──────────────► Can be implemented independently
Phase 5 (Emergency access) ──────────► Should follow Phase 3 (uses validateSessionForData pattern)
Phase 6 (Account lockout) ───────────► Can be implemented independently
Phase 7 (IP logging) ────────────────► Should follow Phase 8 (adds IP to audit entries)
Phase 8 (Data audit) ────────────────► Requires Phase 3 (data ops must exist to log them)
```

**Suggested implementation batches:**

1. **Batch 1 (P0 — Critical):** Phases 1 + 2 together — configuration enforcement, low risk, no dependencies
2. **Batch 2 (P1 — High):** Phases 3 + 4 together — data protection, the most impactful security improvement
3. **Batch 3 (P2 — Medium):** Phases 5 + 6 together — access control enhancements
4. **Batch 4 (P3 — Recommended):** Phases 7 + 8 together — audit logging enhancements

---

## Configuration Checklist for EMR Deployment

Before deploying this system for EMR use, the administrator must set `ACTIVE_PRESET = 'hipaa'` and complete the following. (For `standard` preset deployments, these items are not required — all hardening features default to `false`/off.)

- [ ] **Verify preset selection** — confirm `ACTIVE_PRESET = 'hipaa'` in `testauthgas1.gs` (line 38). If using `standard` with selective hardening, document which features are enabled via `PROJECT_OVERRIDES` and why
- [ ] **Set HMAC secret** — GAS Editor → Project Settings → Script Properties → Add `HMAC_SECRET` with value from `openssl rand -hex 32`
- [ ] **Configure domain restriction** — either set `ALLOWED_DOMAINS: ['yourhospital.com']` in the HIPAA preset, or explicitly set `ENABLE_DOMAIN_RESTRICTION: false` in `PROJECT_OVERRIDES` with documented justification
- [ ] **Configure emergency access list** — GAS Editor → Project Settings → Script Properties → Add `EMERGENCY_ACCESS_EMAILS` with comma-separated admin emails
- [ ] **Set production timer values** — uncomment the production values and remove the ⚡ TEST VALUE lines in both `testauthgas1.gs` (presets) and `testauthgas1.html` (client timers)
- [ ] **Configure ACL spreadsheet** — set `MASTER_ACL_SPREADSHEET_ID` to the actual ACL spreadsheet, or ensure `SPREADSHEET_ID` has proper sharing permissions
- [ ] **Verify Google Workspace BAA** — confirm your organization has signed the Google Workspace BAA (Admin Console → Account → Legal and compliance)
- [ ] **Test break-glass access** — verify emergency access works by temporarily removing a test user from ACL and confirming they can still access via the emergency list
- [ ] **Review audit log** — confirm session events and data access events are being written to the correct sheets
- [ ] **Remove test UI elements** — remove the "Save Note" test button, "Force Heartbeat" button, "Security Tests" button, and debug marker ("1") from the production deployment

Developed by: LightAISolutions
