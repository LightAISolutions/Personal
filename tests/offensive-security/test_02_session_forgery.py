"""
OFFENSIVE SECURITY TEST 02: Session Token Forgery & Fixation

Attack scenario: An attacker attempts to:
  1. Forge a session token and inject it into storage (session fixation)
  2. Craft a gas-session-created message with a forged token to hijack auth
  3. Manipulate localStorage/sessionStorage to gain unauthorized access
  4. Replay a previously-captured session token

This test plants forged tokens and observes whether the GAS backend accepts them.
"""

import sys
import json
import hashlib
import secrets
from playwright.sync_api import sync_playwright

TARGET_URL = "https://lightaisolutions.github.io/lightaisolutions/testauthgas1.html"

# Forged session tokens an attacker might try
FORGED_TOKENS = [
    "forged-session-token-12345",
    "admin-override-token",
    hashlib.sha256(b"attacker-secret").hexdigest(),
    secrets.token_hex(32),
    "../../../etc/passwd",
    "' OR '1'='1' --",
    '{"role":"admin","email":"attacker@evil.com"}',
    "null",
    "undefined",
    "<script>alert(1)</script>",
]


def run_test():
    results = []
    print("=" * 70)
    print("OFFENSIVE TEST 02: Session Token Forgery & Fixation")
    print("=" * 70)
    print(f"Target: {TARGET_URL}")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        console_logs = []
        page = context.new_page()
        page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))

        print("[*] Loading target page...")
        page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)
        print("[+] Page loaded successfully")
        print()

        # ─── Attack 1: Session fixation via storage injection ───
        print("─── Attack 1: Session Fixation via Storage Injection ───")
        print("Injecting forged tokens directly into sessionStorage/localStorage...")

        for i, token in enumerate(FORGED_TOKENS):
            # Reset state
            page.evaluate("""() => {
                sessionStorage.clear();
                localStorage.clear();
            }""")

            # Inject the forged token as an attacker with XSS access would
            page.evaluate(f"""() => {{
                var token = {json.dumps(token)};
                // Try both storage types (standard uses localStorage, HIPAA uses sessionStorage)
                sessionStorage.setItem('gas_session_token', token);
                sessionStorage.setItem('gas_user_email', 'attacker@evil.com');
                localStorage.setItem('gas_session_token', token);
                localStorage.setItem('gas_user_email', 'attacker@evil.com');
            }}""")

            # Now reload the page — does it accept the forged token?
            page.reload(wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)  # Wait for auth flow to process

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
                    appVisible: (function() {
                        var app = document.getElementById('gas-app');
                        return app ? (app.offsetHeight > 0 && app.offsetWidth > 0) : false;
                    })(),
                    storedSession: sessionStorage.getItem('gas_session_token') || localStorage.getItem('gas_session_token') || null,
                    storedEmail: sessionStorage.getItem('gas_user_email') || localStorage.getItem('gas_user_email') || null,
                    iframeSrc: (function() {
                        var f = document.getElementById('gasApp');
                        return f ? f.src : 'no_iframe';
                    })()
                };
            }""")

            # The token should be rejected — auth wall stays up, app stays hidden
            auth_wall_visible = diag["authWallDisplay"] != 'none' and not diag["authWallHidden"]
            blocked = auth_wall_visible or not diag["appVisible"]
            status = "BLOCKED" if blocked else "BYPASSED"
            color = "\033[92m" if blocked else "\033[91m"
            token_preview = token[:40] + "..." if len(token) > 40 else token
            print(f"  {color}[{status}]\033[0m Token: {token_preview}")
            print(f"    auth wall hidden: {diag['authWallHidden']}, auth wall display: {diag['authWallDisplay']}")
            print(f"    app visible: {diag['appVisible']}, stored session: {str(diag['storedSession'])[:30] if diag['storedSession'] else 'None'}")
            print(f"    stored email: {diag['storedEmail']}")
            if not blocked:
                print(f"    \033[91m!!! Forged token accepted — auth wall bypassed !!!\033[0m")
            results.append({"attack": f"fixation_{i}", "blocked": blocked})

        print()

        # ─── Attack 2: Forged gas-session-created messages ───
        print("─── Attack 2: Forged gas-session-created Messages ───")
        print("Sending crafted session creation messages to bypass auth...")

        # Fresh page load
        page.evaluate("() => { sessionStorage.clear(); localStorage.clear(); }")
        page.reload(wait_until="networkidle", timeout=30000)

        forged_session_msgs = [
            # Standard forged session
            {
                "type": "gas-session-created",
                "success": True,
                "sessionToken": secrets.token_hex(32),
                "email": "attacker@evil.com",
                "displayName": "Attacker",
            },
            # With forged messageKey (attempt to set the signing key)
            {
                "type": "gas-session-created",
                "success": True,
                "sessionToken": secrets.token_hex(32),
                "email": "admin@target.com",
                "messageKey": "attacker-controlled-key",
            },
            # Try to overwrite an existing messageKey (second gas-session-created)
            {
                "type": "gas-session-created",
                "success": True,
                "sessionToken": "token-after-key-overwrite",
                "email": "admin@target.com",
                "messageKey": "overwrite-attempt",
            },
        ]

        for i, msg in enumerate(forged_session_msgs):
            console_logs.clear()
            page.evaluate("() => { sessionStorage.clear(); localStorage.clear(); }")

            # Send the forged message
            page.evaluate(f"window.postMessage({json.dumps(msg)}, '*')")
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
                    storedEmail: sessionStorage.getItem('gas_user_email') || localStorage.getItem('gas_user_email') || null,
                    iframeSrc: (function() {
                        var f = document.getElementById('gasApp');
                        return f ? f.src.substring(0, 80) : 'no_iframe';
                    })()
                };
            }""")

            # Check if auth wall was hidden (bad — attacker message accepted)
            app_authenticated = diag["authWallDisplay"] == 'none' or diag["authWallHidden"]

            # Key insight: the HTML side may accept the message (allowlist passes it),
            # but the GAS backend will reject the forged token on the next iframe load.
            # However, the auth wall hiding IS a client-side bypass even if GAS rejects later.
            status_label = "BYPASSED" if app_authenticated else "BLOCKED"
            color = "\033[91m" if app_authenticated else "\033[92m"
            blocked = not app_authenticated
            print(f"  {color}[{status_label}]\033[0m Forged session msg {i}: type={msg['type']}")
            print(f"    auth wall hidden: {diag['authWallHidden']}, auth wall display: {diag['authWallDisplay']}")
            print(f"    stored session: {str(diag['storedSession'])[:30] if diag['storedSession'] else 'None'}")
            print(f"    stored email: {diag['storedEmail']}")
            print(f"    iframe src: {diag['iframeSrc']}")
            if app_authenticated:
                print(f"    \033[91m!!! Auth wall hidden — client-side bypass !!!\033[0m")
                print(f"    → Note: GAS backend should still reject this forged token server-side")
            if diag["storedSession"]:
                print(f"    \033[93m→ Token was stored client-side (GAS-side validation is the real defense)\033[0m")

            results.append({"attack": f"forged_session_{i}", "blocked": blocked})

        print()

        # ─── Attack 3: messageKey overwrite race ───
        print("─── Attack 3: messageKey Overwrite Race Condition ───")
        print("Testing first-write-wins protection on messageKey...")

        page.evaluate("() => { sessionStorage.clear(); localStorage.clear(); }")
        page.reload(wait_until="networkidle", timeout=30000)

        # Set a legitimate key first
        page.evaluate("""window.postMessage({
            type: 'gas-session-created',
            success: true,
            sessionToken: 'legit-token',
            email: 'user@legit.com',
            messageKey: 'legitimate-key-12345'
        }, '*')""")
        page.wait_for_timeout(500)

        # Now try to overwrite it (attacker's key)
        page.evaluate("""window.postMessage({
            type: 'gas-session-created',
            success: true,
            sessionToken: 'attacker-token',
            email: 'attacker@evil.com',
            messageKey: 'attacker-key-evil'
        }, '*')""")
        page.wait_for_timeout(500)

        # Check which key is active by sending a message signed with the attacker's key
        key_check = page.evaluate("""() => {
            // If the attacker's key was accepted, messages signed with it would pass
            // We can check indirectly by seeing which email was stored
            return {
                email: sessionStorage.getItem('gas_user_email') || localStorage.getItem('gas_user_email'),
                token: sessionStorage.getItem('gas_session_token') || localStorage.getItem('gas_session_token')
            };
        }""")

        # Full diagnostic for key overwrite check
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
                })()
            };
        }""")

        # First-write-wins: the email should be from the first message, not the attacker's
        attacker_won = key_check.get("email") == "attacker@evil.com" and key_check.get("token") == "attacker-token"
        if attacker_won:
            print(f"  \033[91m[BYPASSED]\033[0m Attacker's key/token overwrote the legitimate one!")
        else:
            print(f"  \033[92m[BLOCKED]\033[0m First-write-wins: attacker's key was rejected")
        print(f"    stored email: {key_check.get('email')}, stored token: {str(key_check.get('token'))[:30] if key_check.get('token') else 'None'}...")
        print(f"    auth wall hidden: {diag['authWallHidden']}, auth wall display: {diag['authWallDisplay']}")
        if attacker_won:
            print(f"    \033[91m!!! messageKey overwrite succeeded — attacker controls signing !!!\033[0m")
        results.append({"attack": "key_overwrite", "blocked": not attacker_won})

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
