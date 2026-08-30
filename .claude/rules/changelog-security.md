---
paths:
  - "live-site-pages/html-changelogs/**"
  - "live-site-pages/gs-changelogs/**"
  - "live-site-pages/ahk-changelogs/**"
# Path-scoped: this file holds the deep security reference (prohibited-content
# lists + unsafe/safe examples table) for publicly-deployed changelogs only.
# The repo CHANGELOG (repository-information/CHANGELOG.md) is exempt from these
# rules and its path is deliberately excluded from the scope — on repo-only
# CHANGELOG edits, this file does NOT inject.
---

# Changelog Security — Deep Reference (Public Changelogs Only)

*Companion to `changelogs.md`. Path-scoped so it only injects when editing a publicly-deployed changelog (page, GAS, or AHK). The repo CHANGELOG (`repository-information/CHANGELOG.md`) is exempt — its edits do not inject this file.*

## Why this applies

Page, GAS, and AHK changelogs in `live-site-pages/` are **publicly accessible** — they're deployed to GitHub Pages and fetched by the browser via the live site's changelog popup. **Even on private repos, GitHub Pages content is public.** Every changelog entry here must be safe for public consumption.

The repo CHANGELOG (`repository-information/CHANGELOG.md`) is **exempt** — it lives in `repository-information/` which is never deployed. Only collaborators with repo access can see it, and they already have full source access. The repo CHANGELOG should use technically precise descriptions (file names, function names, implementation details) because that level of detail is valuable for developer context. The security rules below apply exclusively to the publicly deployed changelogs.

## HIPAA / PHI — never include any of the following

- Patient names, dates of birth, ages, or any demographic identifiers
- Social Security numbers, Medical Record Numbers (MRNs), or account numbers
- Phone numbers, fax numbers, email addresses, or physical addresses
- Insurance plan names, policy numbers, or payer identifiers
- Medical conditions, diagnoses, medications, or treatment details
- Lab results, vitals, or clinical observations
- Provider names tied to specific patient interactions
- Any combination of data points that could identify a specific individual (even if each alone is non-identifying)

## Attack surface — never reveal internal implementation details

- Database table names, column names, or query patterns (e.g. ~~"Fixed SQL injection in patient_records.ssn column"~~)
- API endpoint paths, parameter names, or authentication mechanisms (e.g. ~~"Added /api/v2/patients?mrn= lookup"~~)
- Specific vulnerability types that were fixed (e.g. ~~"Patched XSS in discharge notes textarea"~~)
- Third-party service names, SDK versions, or integration details (e.g. ~~"Upgraded Stripe SDK to fix payment bypass"~~)
- Internal file names, function names, class names, or variable names
- Error message text that appears in logs or responses
- Authentication/authorization flow details (e.g. ~~"Added JWT refresh token rotation"~~)
- Infrastructure details — server names, IP ranges, cloud regions, deployment pipelines

## How to write secure changelog entries — examples

| Unsafe (never write this) | Safe (write this instead) |
|---------------------------|--------------------------|
| Fixed SQL injection in patient lookup query | Improved data validation on search forms |
| Added SSN field to intake form | Added new identifier field to intake workflow |
| Patched XSS vulnerability in notes textarea | Fixed text input sanitization issue |
| Fixed bug where patient DOB showed in error messages | Fixed an issue where sensitive data could appear in error messages |
| Upgraded auth to use OAuth 2.0 PKCE flow | Improved login security |
| Added /api/discharge endpoint for PDF export | Added discharge document export feature |
| Fixed race condition in prescription refill cron job | Fixed timing issue with prescription refill processing |
| Migrated from MySQL 5.7 to PostgreSQL 15 | Upgraded backend database for better performance |
| Added insurance eligibility check via Availity API | Added real-time insurance verification |
| Fixed CORS issue allowing cross-origin data access | Fixed a security issue with cross-origin requests |

**The general rule:** describe **what the user experiences**, not **how the system works**. A changelog reader should learn "what changed for me" without learning anything about the technical implementation, data model, or security posture of the application.

Developed by: LightAISolutions
