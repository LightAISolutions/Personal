"""
DEFENSIVE SECURITY TEST 01: CSP & Security Headers Validation

Validates that all deployed pages have correct security controls in place:
  1. Content Security Policy (CSP) meta tag with required directives
  2. Referrer-Policy set to 'no-referrer'
  3. Auth wall present and visible on auth pages
  4. Auth wall absent on noauth pages
  5. External scripts sourced only from whitelisted domains
  6. No dangerous inline event handlers in security-sensitive elements

This test acts as a security auditor — it loads each page and inspects the
defensive controls that should be in place to protect users.
"""

import sys
from playwright.sync_api import sync_playwright

BASE_URL = "https://lightaisolutions.github.io/lightaisolutions"

# Pages categorized by auth type
AUTH_PAGES = [
    {"name": "testauthgas1", "url": f"{BASE_URL}/testauthgas1.html"},
    {"name": "globalacl", "url": f"{BASE_URL}/globalacl.html"},
]

NOAUTH_PAGES = [
    {"name": "gas-project-creator", "url": f"{BASE_URL}/gas-project-creator.html"},
    {"name": "qr-scanner5", "url": f"{BASE_URL}/qr-scanner5.html"},
    {"name": "qr-scanner6", "url": f"{BASE_URL}/qr-scanner6.html"},
]

ALL_PAGES = AUTH_PAGES + NOAUTH_PAGES

# CSP directives that MUST be present on all pages
REQUIRED_CSP_DIRECTIVES = ["object-src"]

# CSP directives required only on auth pages
AUTH_CSP_DIRECTIVES = ["frame-ancestors"]

# Whitelisted external script domains (auth pages need Google Sign-In)
WHITELISTED_SCRIPT_DOMAINS = [
    "accounts.google.com",
    "apis.google.com",
]

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"


def check_passed(label):
    print(f"  {GREEN}[PASS]{RESET} {label}")


def check_failed(label, detail=""):
    print(f"  {RED}[FAIL]{RESET} {label}")
    if detail:
        print(f"         {detail}")


def check_warn(label, detail=""):
    print(f"  {YELLOW}[WARN]{RESET} {label}")
    if detail:
        print(f"         {detail}")


def run_test():
    results = {"pass": 0, "fail": 0, "warn": 0}
    print("=" * 70)
    print("DEFENSIVE TEST 01: CSP & Security Headers Validation")
    print("=" * 70)
    print(f"Base URL: {BASE_URL}")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for page_info in ALL_PAGES:
            is_auth = page_info in AUTH_PAGES
            page_type = "AUTH" if is_auth else "NOAUTH"
            print(f"{CYAN}━━━ {page_info['name']} ({page_type}) ━━━{RESET}")
            print(f"    URL: {page_info['url']}")
            print()

            context = browser.new_context()
            csp_violations = []
            page = context.new_page()
            page.on("console", lambda msg: (
                csp_violations.append(msg.text)
                if "Content Security Policy" in msg.text else None
            ))

            try:
                page.goto(page_info["url"], wait_until="networkidle", timeout=30000)
            except Exception as e:
                check_failed(f"Page load failed: {e}")
                results["fail"] += 1
                context.close()
                print()
                continue

            # ─── Check 1: CSP meta tag presence ───
            csp_content = page.evaluate("""() => {
                const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
                return meta ? meta.getAttribute('content') : null;
            }""")

            if csp_content:
                check_passed("CSP meta tag present")
                results["pass"] += 1

                # Check required directives
                for directive in REQUIRED_CSP_DIRECTIVES:
                    if directive in csp_content:
                        # Verify object-src is 'none'
                        if directive == "object-src" and "'none'" in csp_content.split("object-src")[1].split(";")[0]:
                            check_passed(f"CSP directive: {directive} 'none'")
                            results["pass"] += 1
                        elif directive == "object-src":
                            check_warn(f"CSP directive: {directive} present but not set to 'none'",
                                       f"Value: {csp_content.split(directive)[1].split(';')[0].strip()}")
                            results["warn"] += 1
                        else:
                            check_passed(f"CSP directive: {directive} present")
                            results["pass"] += 1
                    else:
                        check_failed(f"CSP directive: {directive} MISSING")
                        results["fail"] += 1

                # Auth-specific CSP directives
                if is_auth:
                    for directive in AUTH_CSP_DIRECTIVES:
                        if directive in csp_content:
                            check_passed(f"CSP directive (auth): {directive} present")
                            results["pass"] += 1
                        else:
                            check_warn(f"CSP directive (auth): {directive} missing",
                                       "Auth pages should restrict framing via frame-ancestors")
                            results["warn"] += 1
            else:
                check_failed("CSP meta tag MISSING — page has no Content Security Policy")
                results["fail"] += 1

            # ─── Check 2: Referrer-Policy ───
            referrer = page.evaluate("""() => {
                const meta = document.querySelector('meta[name="referrer"]');
                return meta ? meta.getAttribute('content') : null;
            }""")

            if referrer == "no-referrer":
                check_passed("Referrer-Policy: no-referrer")
                results["pass"] += 1
            elif referrer:
                check_warn(f"Referrer-Policy set to '{referrer}' (expected 'no-referrer')")
                results["warn"] += 1
            else:
                check_failed("Referrer-Policy meta tag MISSING — tokens may leak via Referer header")
                results["fail"] += 1

            # ─── Check 3: Auth wall (auth pages only) ───
            if is_auth:
                auth_wall = page.evaluate("""() => {
                    const wall = document.getElementById('auth-wall');
                    if (!wall) return { exists: false };
                    const style = window.getComputedStyle(wall);
                    return {
                        exists: true,
                        visible: style.display !== 'none' && style.visibility !== 'hidden',
                        zIndex: style.zIndex,
                        classList: Array.from(wall.classList)
                    };
                }""")

                if not auth_wall["exists"]:
                    check_failed("Auth wall element #auth-wall MISSING on auth page")
                    results["fail"] += 1
                elif auth_wall["visible"]:
                    check_passed(f"Auth wall visible (z-index: {auth_wall['zIndex']})")
                    results["pass"] += 1
                else:
                    check_failed("Auth wall exists but NOT VISIBLE — page content exposed without auth",
                                 f"Classes: {auth_wall['classList']}")
                    results["fail"] += 1

                # Verify Google Sign-In script is loaded
                gis_loaded = page.evaluate("""() => {
                    const scripts = document.querySelectorAll('script[src*="accounts.google.com"]');
                    return scripts.length > 0;
                }""")
                if gis_loaded:
                    check_passed("Google Sign-In (GIS) script loaded")
                    results["pass"] += 1
                else:
                    check_warn("Google Sign-In script not found — auth page may not have login UI")
                    results["warn"] += 1

            else:
                # Noauth pages should NOT have an auth wall
                has_auth_wall = page.evaluate("""() => {
                    return !!document.getElementById('auth-wall');
                }""")
                if not has_auth_wall:
                    check_passed("No auth wall on noauth page (correct)")
                    results["pass"] += 1
                else:
                    check_warn("Auth wall found on noauth page — may confuse users")
                    results["warn"] += 1

            # ─── Check 4: External script sources ───
            ext_scripts = page.evaluate("""() => {
                const scripts = document.querySelectorAll('script[src]');
                return Array.from(scripts).map(s => {
                    try { return new URL(s.src).hostname; }
                    catch { return s.src; }
                });
            }""")

            unknown_sources = []
            for src in ext_scripts:
                if src and not any(allowed in src for allowed in WHITELISTED_SCRIPT_DOMAINS):
                    unknown_sources.append(src)

            if not ext_scripts:
                check_passed("No external scripts loaded")
                results["pass"] += 1
            elif not unknown_sources:
                check_passed(f"All {len(ext_scripts)} external scripts from whitelisted domains")
                results["pass"] += 1
            else:
                check_warn(f"External scripts from non-whitelisted domains: {unknown_sources}",
                           "Review these sources — they may be legitimate but should be explicitly whitelisted")
                results["warn"] += 1

            # ─── Check 5: Dangerous inline event handlers ───
            dangerous_handlers = page.evaluate("""() => {
                const dangerous = [];
                const attrs = ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus',
                               'onblur', 'onsubmit', 'onchange', 'oninput'];
                // Check security-sensitive elements (forms, inputs, links, images)
                const elements = document.querySelectorAll('form, input, a, img, button, iframe');
                elements.forEach(el => {
                    attrs.forEach(attr => {
                        if (el.hasAttribute(attr)) {
                            dangerous.push({
                                tag: el.tagName.toLowerCase(),
                                attr: attr,
                                id: el.id || '(no id)',
                                snippet: el.getAttribute(attr).substring(0, 60)
                            });
                        }
                    });
                });
                return dangerous;
            }""")

            if not dangerous_handlers:
                check_passed("No inline event handlers on security-sensitive elements")
                results["pass"] += 1
            else:
                for h in dangerous_handlers:
                    check_warn(f"Inline handler: <{h['tag']} {h['attr']}=\"{h['snippet']}...\"> (id: {h['id']})",
                               "Inline handlers bypass CSP script-src. Consider addEventListener() instead")
                    results["warn"] += 1

            # ─── Check 6: CSP violations detected during load ───
            if csp_violations:
                for v in csp_violations:
                    check_warn(f"CSP violation during page load: {v[:120]}")
                    results["warn"] += 1
            else:
                check_passed("No CSP violations during page load")
                results["pass"] += 1

            context.close()
            print()

        browser.close()

    # ─── Summary ───
    print("=" * 70)
    total = results["pass"] + results["fail"] + results["warn"]
    print(f"RESULTS: {GREEN}{results['pass']} passed{RESET}, "
          f"{RED}{results['fail']} failed{RESET}, "
          f"{YELLOW}{results['warn']} warnings{RESET} "
          f"({total} total checks)")
    print("=" * 70)

    if results["fail"] > 0:
        print(f"\n{RED}⚠ DEFENSIVE CONTROLS DEGRADED — {results['fail']} check(s) failed{RESET}")
        print("Review failed checks above. These indicate missing or broken security controls.")
        return 1
    elif results["warn"] > 0:
        print(f"\n{YELLOW}△ All critical checks passed, {results['warn']} warning(s) to review{RESET}")
        return 0
    else:
        print(f"\n{GREEN}✓ All defensive controls verified{RESET}")
        return 0


if __name__ == "__main__":
    sys.exit(run_test())
# Developed by: LightAISolutions
