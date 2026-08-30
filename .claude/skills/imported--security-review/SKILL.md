---
name: security-review
description: Security-focused code review covering OWASP Top 10, insecure defaults, XSS prevention, and web application security. Use when reviewing HTML pages, JavaScript code, GAS scripts, or any code that handles user input, external data, or runs in the browser. Inspired by Trail of Bits security methodology.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Grep, Glob
argument-hint: [file-or-directory]
---

# Security Review

*Inspired by [Trail of Bits security skills](https://github.com/trailofbits/skills) — adapted for web/HTML/GAS projects.*

Perform a security-focused code review of the specified files or the entire codebase.

## Review Checklist

### 1. OWASP Top 10 Web Application Risks

- **Injection** — check for XSS vectors in HTML/JS: unsanitized `innerHTML`, `document.write()`, template literals injected into DOM, URL parameter reflection
- **Broken Access Control** — verify GAS scripts properly validate callers, check `doGet`/`doPost` authorization
- **Security Misconfiguration** — insecure defaults, overly permissive CORS, missing security headers
- **Vulnerable Components** — outdated libraries loaded via CDN, known CVEs in dependencies
- **Server-Side Request Forgery** — GAS scripts making external requests based on user input

### 2. Client-Side Security (HTML Pages)

- **Content Security Policy** — check for inline scripts that could be tightened with CSP
- **Cross-Origin Resource Loading** — verify all external resources (fonts, scripts, stylesheets) use HTTPS and are from trusted sources
- **localStorage/sessionStorage** — check for sensitive data stored client-side
- **postMessage** — verify origin validation on any `message` event listeners (critical for GAS iframe communication)
- **Private Repo Compatibility** — verify no client-side code references `raw.githubusercontent.com` or `api.github.com` (Pre-Commit #19)

### 3. Google Apps Script Security

- **Script Properties** — verify secrets (API keys, tokens) are in Script Properties, not hardcoded
- **DEPLOYMENT_ID exposure** — verify deployment IDs are obfuscated (base64-encoded reversed URL per Pre-Commit #15)
- **Input Validation** — check `doGet`/`doPost` handlers validate and sanitize all parameters
- **Spreadsheet Access** — verify scripts only access intended sheets/ranges

### 4. Insecure Defaults & Hardcoded Credentials

- **Hardcoded secrets** — scan for API keys, tokens, passwords in source code
- **Default configurations** — check for debug modes left enabled, verbose error messages exposed to users
- **Fail-open patterns** — verify error handlers don't silently grant access on failure

### 5. Supply Chain

- **CDN integrity** — check that external scripts use Subresource Integrity (`integrity` attribute with SHA hash)
- **Version pinning** — verify CDN URLs reference specific versions, not `latest` or unpinned

## Output Format

For each finding, report:
```
**[SEVERITY]** Title
- **File**: path/to/file.html:line
- **Issue**: Description of the vulnerability
- **Risk**: What an attacker could do
- **Fix**: Recommended remediation
```

Severity levels: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`

## Running the Review

1. Read all specified files (or scan `live-site-pages/` and `googleAppsScripts/` if no target specified)
2. Apply each checklist category
3. Report findings grouped by severity
4. Provide a summary with total findings count per severity

Developed by: LightAISolutions
