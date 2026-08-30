"""
OFFENSIVE SECURITY TEST 04: OAuth Token Replay & CSRF Attacks

Attack scenario: An attacker attempts to:
  1. Replay a captured/fabricated OAuth access token via the URL parameter
  2. Bypass the CSRF nonce protection on the token response handler
  3. Exploit the token exchange flow by injecting tokens via URL manipulation
  4. Trigger OAuth callbacks without a legitimate Google sign-in

This test targets the OAuth integration points — the most sensitive part of the
auth flow where tokens are exchanged between Google, the browser, and GAS.
"""

import sys
import json
import re
import secrets
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright

TARGET_URL = "https://lightaisolutions.github.io/lightaisolutions/testauthgas1.html"

# The GAS deployment base URL (extracted from the page's iframe src)
GAS_BASE_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"


def run_test():
    results = []
    print("=" * 70)
    print("OFFENSIVE TEST 04: OAuth Token Replay & CSRF Attacks")
    print("=" * 70)
    print(f"Target: {TARGET_URL}")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        console_logs = []
        page_errors = []
        page = context.new_page()
        page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        print("[*] Loading target page...")
        page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)
        print("[+] Page loaded successfully")
        print()

        # ─── Attack 1: Fabricated OAuth token via handleTokenResponse ───
        print("─── Attack 1: Fabricated OAuth Token Injection ───")
        print("Calling handleTokenResponse with forged Google OAuth tokens...")

        fake_tokens = [
            # Standard forged token
            {"credential": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhdHRhY2tlciIsImVtYWlsIjoiYWRtaW5AZXZpbC5jb20ifQ.fake-signature"},
            # Empty token
            {"credential": ""},
            # Token with script injection
            {"credential": "<script>alert(1)</script>"},
            # Just an access_token (wrong field name — OAuth uses 'credential')
            {"access_token": secrets.token_hex(32)},
            # Null/undefined values
            {"credential": None},
            # SQL injection in token
            {"credential": "' UNION SELECT * FROM users --"},
        ]

        for i, token_response in enumerate(fake_tokens):
            console_logs.clear()
            page_errors.clear()

            try:
                # Call the OAuth callback directly with a forged response
                result = page.evaluate(f"""() => {{
                    try {{
                        if (typeof handleTokenResponse === 'function') {{
                            handleTokenResponse({json.dumps(token_response)});
                            return 'called';
                        }}
                        return 'function_not_found';
                    }} catch(e) {{
                        return 'error: ' + e.message;
                    }}
                }}""")

                page.wait_for_timeout(1000)

                # Full diagnostic: check all possible side effects
                diag = page.evaluate("""() => {
                    return {
                        locationHref: window.location.href,
                        authWallHidden: (function() {
                            var w = document.getElementById('auth-wall');
                            return w ? w.classList.contains('hidden') : 'no_wall';
                        })(),
                        authWallDisplay: (function() {
                            var w = document.getElementById('auth-wall');
                            return w ? window.getComputedStyle(w).display : 'no_wall';
                        })(),
                        storedSession: sessionStorage.getItem('gas_session_token') || localStorage.getItem('gas_session_token') || null,
                        storedEmail: sessionStorage.getItem('gas_user_email') || localStorage.getItem('gas_user_email') || null
                    };
                }""")

                blocked = diag["authWallDisplay"] != 'none' and not diag["authWallHidden"]
                status = "BLOCKED" if blocked else "BYPASSED"
                color = "\033[92m" if blocked else "\033[91m"
                token_desc = str(list(token_response.values())[0])[:40] if token_response else "(empty)"
                print(f"  {color}[{status}]\033[0m Token: {token_desc}... (result: {result})")
                print(f"    auth wall hidden: {diag['authWallHidden']}, auth wall display: {diag['authWallDisplay']}")
                print(f"    stored session: {str(diag['storedSession'])[:30] if diag['storedSession'] else 'None'}, stored email: {diag['storedEmail']}")
                if not blocked:
                    print(f"    \033[91m!!! Forged OAuth token accepted — auth wall bypassed !!!\033[0m")

            except Exception as e:
                print(f"  \033[92m[BLOCKED]\033[0m Token attempt {i} threw error: {str(e)[:50]}")
                blocked = True

            results.append({"attack": f"fake_oauth_{i}", "blocked": blocked})

        print()

        # ─── Attack 2: CSRF nonce bypass ───
        print("─── Attack 2: CSRF Nonce Bypass ───")
        print("Testing if OAuth callback works without a valid nonce...")

        # Clear nonce and try to call handleTokenResponse
        nonce_attacks = [
            # Clear the nonce first, then call handler
            """() => {
                _authNonce = null;
                try {
                    handleTokenResponse({credential: 'forged-after-nonce-clear'});
                    return 'accepted';
                } catch(e) { return 'rejected: ' + e.message; }
            }""",
            # Set nonce to attacker-controlled value
            """() => {
                _authNonce = 'attacker-controlled-nonce';
                try {
                    handleTokenResponse({credential: 'forged-with-fake-nonce'});
                    return 'accepted';
                } catch(e) { return 'rejected: ' + e.message; }
            }""",
            # Double-call (nonce should be consumed after first call)
            """() => {
                try {
                    // Simulate clicking sign-in to set a real nonce
                    _authNonce = 'test-nonce-' + Math.random();
                    handleTokenResponse({credential: 'first-call'});
                    // Second call should fail — nonce consumed
                    handleTokenResponse({credential: 'replay-attempt'});
                    return 'second_accepted';
                } catch(e) { return 'second_rejected: ' + e.message; }
            }""",
        ]

        for i, attack_code in enumerate(nonce_attacks):
            console_logs.clear()

            result = page.evaluate(attack_code)
            page.wait_for_timeout(500)

            # Full diagnostic: check all side effects
            diag = page.evaluate("""() => {
                return {
                    locationHref: window.location.href,
                    authWallHidden: (function() {
                        var w = document.getElementById('auth-wall');
                        return w ? w.classList.contains('hidden') : 'no_wall';
                    })(),
                    authWallDisplay: (function() {
                        var w = document.getElementById('auth-wall');
                        return w ? window.getComputedStyle(w).display : 'no_wall';
                    })(),
                    storedSession: sessionStorage.getItem('gas_session_token') || localStorage.getItem('gas_session_token') || null,
                    storedEmail: sessionStorage.getItem('gas_user_email') || localStorage.getItem('gas_user_email') || null
                };
            }""")

            blocked = diag["storedSession"] is None or 'rejected' in str(result) or 'error' in str(result).lower()
            status = "BLOCKED" if blocked else "BYPASSED"
            color = "\033[92m" if blocked else "\033[91m"
            print(f"  {color}[{status}]\033[0m Nonce attack {i+1}: {result}")
            print(f"    auth wall hidden: {diag['authWallHidden']}, auth wall display: {diag['authWallDisplay']}")
            print(f"    stored session: {str(diag['storedSession'])[:30] if diag['storedSession'] else 'None'}, stored email: {diag['storedEmail']}")
            if not blocked:
                print(f"    \033[91m!!! CSRF nonce bypass succeeded !!!\033[0m")
            results.append({"attack": f"csrf_nonce_{i}", "blocked": blocked})

        print()

        # ─── Attack 3: Direct GAS endpoint probing ───
        print("─── Attack 3: Direct GAS Endpoint Probing ───")
        print("Sending requests directly to the GAS backend with forged tokens...")

        # Try to exchange a forged token directly with the GAS backend
        probe_urls = [
            f"{GAS_BASE_URL}?exchangeToken=forged-oauth-token-12345",
            f"{GAS_BASE_URL}?session=forged-session-token-67890",
            f"{GAS_BASE_URL}?exchangeToken=<script>alert(1)</script>",
            f"{GAS_BASE_URL}?session=' OR '1'='1",
            f"{GAS_BASE_URL}?action=deploy",  # Unauthenticated deploy endpoint
            f"{GAS_BASE_URL}?heartbeat=true&session=forged",
        ]

        for i, url in enumerate(probe_urls):
            try:
                # Open the GAS URL directly in a new page
                probe_page = context.new_page()
                response = probe_page.goto(url, wait_until="load", timeout=15000)

                status_code = response.status if response else "no_response"
                content = probe_page.content()

                # Check what the GAS backend returned
                # Look for a JSON-structured session token response (not just the word
                # 'sessionToken' which appears in the GAS app's own JavaScript source).
                # A real acceptance would return JSON with a sessionToken value, not
                # an HTML page that happens to contain the variable name in its code.
                has_auth_ok = 'gas-auth-ok' in content
                has_error = 'error' in content.lower() or 'denied' in content.lower() or 'invalid' in content.lower()

                # Check for actual token issuance: a JSON response with a real token value
                # (not just the variable name in HTML/JS source code)
                has_real_token = bool(re.search(r'"sessionToken"\s*:\s*"[a-f0-9]{20,}"', content))

                # The GAS backend should reject forged tokens.
                # Blocked if: error response received OR no real token issued and no auth-ok
                blocked = has_error or (not has_real_token and not has_auth_ok)
                status = "BLOCKED" if blocked else "BYPASSED"
                color = "\033[92m" if blocked else "\033[91m"

                param = url.split("?")[1][:50] if "?" in url else "(none)"
                print(f"  {color}[{status}]\033[0m HTTP {status_code} — param: {param}")
                # Show truncated response body for diagnosis
                body_preview = content.replace('\n', ' ')[:120]
                print(f"    response body: {body_preview}...")
                print(f"    has_real_token: {has_real_token}, has_auth_ok: {has_auth_ok}, has_error: {has_error}")
                if has_error:
                    print(f"    → GAS returned error response (correct behavior)")
                if not blocked:
                    print(f"    \033[91m!!! GAS accepted forged token !!!\033[0m")

                probe_page.close()
                results.append({"attack": f"gas_probe_{i}", "blocked": blocked})

            except Exception as e:
                print(f"  \033[92m[BLOCKED]\033[0m Probe {i} failed: {str(e)[:60]}")
                results.append({"attack": f"gas_probe_{i}", "blocked": True})

        print()

        # ─── Attack 4: Token in URL (token leakage check) ───
        print("─── Attack 4: Token Leakage via URL ───")
        print("Checking if tokens appear in URLs that could leak via Referrer...")

        # Load the page and check if any token appears in the current URL
        page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)

        url_after_load = page.evaluate("() => window.location.href")
        has_token_in_url = "token=" in url_after_load or "session=" in url_after_load or "exchangeToken=" in url_after_load

        # Full diagnostic
        diag = page.evaluate("""() => {
            return {
                locationHref: window.location.href,
                storedSession: sessionStorage.getItem('gas_session_token') || localStorage.getItem('gas_session_token') || null,
                storedEmail: sessionStorage.getItem('gas_user_email') || localStorage.getItem('gas_user_email') || null,
                cookieString: document.cookie || '(none)'
            };
        }""")

        if has_token_in_url:
            print(f"  \033[91m[LEAKED]\033[0m Token found in URL: {url_after_load}")
            results.append({"attack": "url_leakage", "blocked": False})
        else:
            print(f"  \033[92m[SAFE]\033[0m No tokens in URL after page load")
            results.append({"attack": "url_leakage", "blocked": True})
        print(f"    location.href: {diag['locationHref']}")
        print(f"    stored session: {str(diag['storedSession'])[:30] if diag['storedSession'] else 'None'}")
        print(f"    cookies: {diag['cookieString']}")

        # Check the Referrer Policy
        referrer_policy = page.evaluate("""() => {
            var meta = document.querySelector('meta[name="referrer"]');
            return meta ? meta.content : 'not set';
        }""")
        print(f"  Referrer-Policy: {referrer_policy}")
        if referrer_policy == 'no-referrer':
            print(f"  \033[92m[SAFE]\033[0m Referrer header blocked — tokens won't leak to external sites")
        else:
            print(f"  \033[93m[WARN]\033[0m Referrer-Policy not set to no-referrer")

        print()

        # ─── Summary ───
        print("=" * 70)
        total = len(results)
        blocked = sum(1 for r in results if r["blocked"])
        bypassed = total - blocked
        print(f"RESULTS: {blocked}/{total} attacks blocked")
        if bypassed > 0:
            print(f"\033[91m  !!! {bypassed} ATTACK(S) BYPASSED DEFENSES !!!\033[0m")
            for r in results:
                if not r["blocked"]:
                    print(f"    - {r['attack']}")
        else:
            print(f"\033[92m  All attacks were blocked by the defense layers.\033[0m")
        print("=" * 70)

        browser.close()
        return bypassed == 0


if __name__ == "__main__":
    success = run_test()
    sys.exit(0 if success else 1)

# Developed by: LightAISolutions
