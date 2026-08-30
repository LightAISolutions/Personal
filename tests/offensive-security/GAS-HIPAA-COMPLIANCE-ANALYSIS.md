# Google Apps Script — HIPAA Compliance Analysis Under Workspace BAA

> **Context:** This analysis evaluates whether Google Apps Script (GAS) is covered under a Google Workspace Business Associate Agreement (BAA) for HIPAA compliance, and what limitations apply — particularly for web app deployments like testauthgas1. Research conducted March 2026 using current Google documentation, HIPAA guidance, and industry sources.

---

## Table of Contents

- [BAA Coverage Status](#baa-coverage-status)
- [What "Covered" Actually Means](#what-covered-actually-means)
- [Concerns for GAS Web App Deployments](#concerns-for-gas-web-app-deployments)
- [Comparison: Platform vs Application Responsibility](#comparison-platform-vs-application-responsibility)
- [Google's Own GAS-Specific Guidance](#googles-own-gas-specific-guidance)
- [Impact on testauthgas1 Architecture](#impact-on-testauthgas1-architecture)
- [Bottom Line Summary](#bottom-line-summary)
- [Sources](#sources)

---

## BAA Coverage Status

As of **September 30, 2025**, Google's official [HIPAA Included Functionality](https://workspace.google.com/terms/2015/1/hipaa_functionality/) page explicitly lists **Apps Script** as a covered service under the Google Workspace BAA. The full list of covered services includes:

- AppSheet
- **Apps Script**
- Cloud Identity Management
- Gemini app (excluding Gemini in Chrome)
- Gemini in Workspace
- Gmail
- Google Calendar
- Google Chat
- Google Cloud Search
- Google Drive (including Docs, Forms, Sheets, Slides, Vids)
- Google Groups
- Google Keep
- Google Meet
- Google Sites
- Google Tasks
- Google Vault (if applicable)
- Google Voice (managed users only)

### Requirements to Activate BAA Coverage

1. **Paid Workspace plan** — Google does not sign BAAs for free `@gmail.com` accounts or the Workspace Starter plan
2. **BAA must be signed** via Admin Console → Account → Account settings → Legal and compliance → "Google Workspace/Cloud Identity HIPAA Business Associate Amendment"
3. **Configuration** — services must be configured to meet HIPAA Security Rule requirements (the BAA alone is insufficient)

---

## What "Covered" Actually Means

**"Covered" means Google acts as your Business Associate for data processed within Apps Script.** It does NOT mean your Apps Script code is automatically HIPAA-compliant.

### What Google is responsible for (platform layer)

- Data encryption at rest and in transit within Google infrastructure
- Physical security of data centers
- Infrastructure-level access controls
- Availability and disaster recovery of the Apps Script runtime
- `CacheService`, `PropertiesService`, and `SpreadsheetApp` operations staying within the BAA boundary

### What you are responsible for (application layer)

- Access control logic in your web apps
- Session management and timeout enforcement
- Audit logging (Apps Script has no native HIPAA-grade audit trail)
- Ensuring PHI is not exposed via URL parameters, browser history, or logs
- MFA implementation
- Data minimization and need-to-know access
- Preventing script-level data exfiltration

### What is explicitly NOT covered

- **Third-party add-ons** — explicitly excluded from the BAA regardless of whether they run within Apps Script
- **Chrome** — not HIPAA compliant; do not upload PHI into Gemini in Chrome
- **Any data transmitted outside covered services** — including via `UrlFetchApp` calls to non-BAA-covered endpoints
- **Consumer Google accounts** — only managed Workspace accounts are covered

From the [BAA terms](https://workspace.google.com/terms/2015/1/hipaa_baa/):
> The BAA does not apply to (a) any other Google product, service, or feature that is not a Covered Service; or (b) any PHI that Customer creates, receives, maintains, or transmits outside of the Covered Services.

---

## Concerns for GAS Web App Deployments

While Apps Script server-side execution is within the BAA boundary, **web app deployments** (`doGet`/`doPost`) introduce additional concerns:

| Concern | Detail | Severity |
|---------|--------|----------|
| **Access control** | Web Apps can be set to "Anyone" or "Anyone, even anonymous" — must restrict to domain users only for PHI | Critical |
| **Execution identity** | "Execute as me" vs "Execute as accessing user" has major permission implications for PHI access | High |
| **No native audit logging** | Apps Script does not provide HIPAA-grade audit trails; must build custom logging | High |
| **`UrlFetchApp` exfiltration** | Scripts can send data to external endpoints, bypassing BAA boundary | High |
| **Data in URL parameters** | `doGet(e)` receives data via query strings, which appear in browser history and logs | High |
| **No native session management** | Web Apps lack session timeout, session binding, or session invalidation features | Medium |
| **No native MFA** | No built-in multi-factor authentication; must implement externally | Medium |
| **Double-iframe architecture** | GAS web apps render through `script.google.com` → `googleusercontent.com` iframe chain, complicating origin validation and secure messaging | Medium |
| **No client IP access** | `doGet(e)` does not expose client IP — only query string parameters are available | Low |

### The double-iframe constraint

When deployed as a web app embedded in an HTML page, GAS operates through a double-iframe architecture:

```
Your HTML page (your-org.github.io)
  └── iframe src=script.google.com/macros/s/.../exec
        └── sandboxed iframe (*.googleusercontent.com)
              └── Your GAS HTML output renders here
```

This architecture means:
- `postMessage` from the parent page targets `script.google.com`, but responses come from `googleusercontent.com`
- `event.source` must be used for replies since the inner origin is unpredictable
- Wildcard `'*'` targetOrigin is architecturally required for parent→GAS direction in some flows
- Origin validation on incoming messages is limited to what you can predict about the outer iframe origin

---

## Comparison: Platform vs Application Responsibility

| HIPAA Requirement | Google's Responsibility (BAA) | Your Responsibility (Code) |
|---|---|---|
| Encryption at rest | Yes — Google encrypts all stored data | N/A |
| Encryption in transit | Yes — TLS for all Google services | Ensure no PHI leaks via URL params, logs |
| Access controls | Infrastructure-level access | Application-level auth, authorization, MFA |
| Audit logging | Google Admin audit logs (admin actions) | Application-level audit trail for PHI access |
| Session management | N/A | Session timeout, binding, invalidation |
| Unique user identification | Google account identity | Map to your access control model |
| Automatic logoff | N/A | Must implement in your web app |
| Integrity controls | Infrastructure checksums | Message signing (HMAC), input validation |
| Emergency access | Google SRE procedures | Application-level emergency access procedure |
| BAA with subcontractors | Google handles its subprocessors | You handle any third-party services you integrate |

---

## Google's Own GAS-Specific Guidance

From the [Google Workspace HIPAA Implementation Guide (September 2025)](https://services.google.com/fh/files/misc/gsuite_cloud_identity_hipaa_implementation_guide.pdf):

1. **Restrict access** — limit Apps Script access to the minimum necessary to prevent unauthorized access to PHI
2. **Disable unapproved add-ons** — third-party add-ons are not covered by the BAA
3. **Prohibit emailing PHI from scripts** — `MailApp`/`GmailApp` sending PHI must be controlled
4. **Vet all integrations** — use of unvetted add-ons, Apps Script, or third-party connectors that access PHI without their own BAAs is flagged as a significant risk
5. **Configure services properly** — the BAA is necessary but not sufficient; HIPAA Security Rule configuration requirements must be met

---

## Impact on testauthgas1 Architecture

Every finding in the [HTML Auth Security Audit](HTML-AUTH-SECURITY-AUDIT.md) remains fully applicable despite the BAA coverage. Specifically:

| Audit Finding | BAA Helps? | Still Your Problem? |
|---|---|---|
| **C-1:** DJB2 non-cryptographic hash | No | Yes — application-layer message integrity |
| **C-2:** postMessage wildcard `'*'` | No | Yes — application-layer message security |
| **C-3:** api.ipify.org IP logging | No | Yes — third-party service outside BAA boundary |
| **C-4:** No MFA | No | Yes — application-layer authentication |
| **C-5:** sessionStorage exposure | No | Yes — client-side storage is outside Google infra |
| **H-1:** BroadcastChannel credential broadcast | No | Yes — client-side browser API |
| **H-2:** No origin validation | No | Yes — application-layer validation |
| **H-3:** messageKey nullification | No | Yes — application-layer session management |
| **H-4:** Client-side timer bypass | No | Yes — application-layer session timeout |
| **H-5/H-6:** Token in URL for heartbeat/signout | No | Yes — tokens in URLs leak to browser history |
| **H-7:** unsafe-inline CSP | No | Yes — application-layer security headers |
| **M-1 through M-8:** Various medium findings | No | Yes — all application-layer concerns |
| **L-1 through L-4:** Various low findings | No | Yes — all application-layer concerns |

**The BAA covers the pipe, not what flows through it.** Every security finding is about how your code handles data, not about how Google stores it.

---

## Bottom Line Summary

| Question | Answer |
|----------|--------|
| Is Apps Script covered by the Workspace BAA? | **Yes** — explicitly listed since September 2025 |
| Does that make testauthgas1 code HIPAA-compliant? | **No** — all 24 audit findings are application-layer issues |
| Can you use Apps Script web apps for PHI workflows? | **Yes, with proper controls** — domain-restricted access, audit logging, no PHI in URLs, encryption, MFA |
| Do the SECURITY-REMEDIATION-GUIDE.md fixes still apply? | **100% yes** — the BAA covers the platform, not your code |
| Are third-party add-ons/integrations covered? | **No** — explicitly excluded from the BAA |
| Is the Workspace Starter plan sufficient? | **No** — Starter does not support BAA signing |

### The analogy

Google Sheets is also BAA-covered, but if you put PHI in a Sheet and shared it publicly, that's a HIPAA violation — the BAA doesn't protect you from your own access control decisions. The same principle applies to Apps Script web apps: the infrastructure is covered, but the security of what you build on it is entirely your responsibility.

---

## Sources

### Google Official Documentation
- [HIPAA Included Functionality (Sept 2025)](https://workspace.google.com/terms/2015/1/hipaa_functionality/) — the authoritative list of BAA-covered services
- [Google Workspace HIPAA BAA Terms](https://workspace.google.com/terms/2015/1/hipaa_baa/) — the actual BAA legal text
- [Google Workspace HIPAA Implementation Guide (Sept 2025)](https://services.google.com/fh/files/misc/gsuite_cloud_identity_hipaa_implementation_guide.pdf) — Google's configuration guidance
- [HIPAA Compliance with Google Workspace — Admin Help](https://support.google.com/a/answer/3407054?hl=en) — Google's admin-facing guidance
- [HIPAA Compliance on Google Cloud](https://cloud.google.com/security/compliance/hipaa) — broader Google Cloud HIPAA reference

### Industry Analysis
- [HIPAA Journal — Is Google Workspace HIPAA Compliant? (2026)](https://www.hipaajournal.com/is-google-workspace-hipaa-compliant/) — independent compliance analysis
- [UpCurve Cloud — HIPAA Compliance for Google Workspace and Gemini](https://upcurvecloud.com/blog/guide-to-hipaa-compliance-for-google-workspace-and-google-gemini/) — Gemini-specific guidance
- [Paubox — Is Google Workspace HIPAA Compliant? (2025)](https://www.paubox.com/blog/is-google-workspace-hipaa-compliant) — email-focused analysis
- [Mimecast — HIPAA Compliance for Google Workspace](https://www.mimecast.com/blog/google-workspace-hipaa-compliance/) — security-focused analysis
- [Total HIPAA — Establishing a BAA with Google](https://www.totalhipaa.com/how-to-get-a-baa-with-google/) — step-by-step BAA setup guide

### Related Documents in This Repository
- [HTML-AUTH-SECURITY-AUDIT.md](HTML-AUTH-SECURITY-AUDIT.md) — the independent security audit (24 findings)
- [10.1-SECURITY-REMEDIATION-GUIDE.md](../../repository-information/archive%20info/10.1-SECURITY-REMEDIATION-GUIDE.md) — implementation-ready fixes for all audit findings

---

*Analysis conducted: 2026-03-17*
*Last verified against Google's HIPAA Included Functionality page: September 30, 2025 revision*

Developed by: LightAISolutions
