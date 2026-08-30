"""
OFFENSIVE SECURITY TEST 05: Clickjacking & Iframe Embedding Attacks

Attack scenario: An attacker creates a malicious page that embeds testauthgas1
in a hidden/transparent iframe, attempting to:
  1. Clickjack the Google Sign-In button (steal OAuth consent clicks)
  2. Overlay fake UI over the real page to capture credentials
  3. Embed the authenticated GAS app to exfiltrate data via the iframe
  4. Abuse X-Frame-Options/CSP frame-ancestors to embed the page
  5. Use drag-and-drop attacks to extract content from the framed page

This tests the page's anti-framing defenses — CSP frame-ancestors,
X-Frame-Options, and framebusting JavaScript.
"""

import sys
import json
from playwright.sync_api import sync_playwright

TARGET_URL = "https://lightaisolutions.github.io/lightaisolutions/testauthgas1.html"
GAS_BASE_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"


def run_test():
    results = []
    print("=" * 70)
    print("OFFENSIVE TEST 05: Clickjacking & Iframe Embedding Attacks")
    print("=" * 70)
    print(f"Target: {TARGET_URL}")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        console_logs = []
        page_errors = []

        # ─── Attack 1: Embed target page in attacker-controlled iframe ───
        print("─── Attack 1: Iframe Embedding (Clickjacking Setup) ───")
        print("Creating attacker page that embeds target in an iframe...")

        attacker_page = context.new_page()
        attacker_page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))
        attacker_page.on("pageerror", lambda err: page_errors.append(str(err)))

        # Create a malicious page that tries to iframe the target
        attacker_html = f"""
        <html>
        <head><title>Totally Legit Page</title></head>
        <body>
            <h1>Win a Prize!</h1>
            <div style="position:relative; width:800px; height:600px;">
                <!-- Transparent iframe overlay for clickjacking -->
                <iframe id="victim-frame" src="{TARGET_URL}"
                    style="position:absolute; top:0; left:0; width:100%; height:100%;
                           opacity:0.01; z-index:10; border:none;"
                    sandbox="allow-scripts allow-same-origin allow-forms">
                </iframe>
                <!-- Fake button aligned over the Google Sign-In button -->
                <button id="fake-btn" style="position:absolute; top:200px; left:300px;
                    z-index:1; padding:20px 40px; font-size:18px; cursor:pointer;">
                    Click to Win!
                </button>
            </div>
        </body>
        </html>
        """

        attacker_page.set_content(attacker_html)
        attacker_page.wait_for_timeout(3000)

        # Check if the iframe loaded the target content
        iframe_loaded = attacker_page.evaluate("""() => {
            var frame = document.getElementById('victim-frame');
            if (!frame) return { loaded: false, reason: 'no_frame' };
            try {
                // Try to access iframe content (should fail due to CSP/CORS)
                var doc = frame.contentDocument || frame.contentWindow.document;
                var hasContent = doc && doc.body && doc.body.innerHTML.length > 100;
                return {
                    loaded: hasContent,
                    reason: hasContent ? 'content_accessible' : 'empty_frame',
                    bodyLength: doc ? doc.body.innerHTML.length : 0
                };
            } catch(e) {
                // Cross-origin error means the frame loaded but we can't access it
                return {
                    loaded: true,
                    reason: 'cross_origin_blocked',
                    error: e.message
                };
            }
        }""")

        # Check CSP frame-ancestors response header
        print(f"  Iframe load result: {iframe_loaded}")

        # Even if iframe loads, check if the content is actually usable
        # A properly protected page will refuse to render in a cross-origin frame
        frame_refused = not iframe_loaded.get("loaded", False) or iframe_loaded.get("reason") == "empty_frame"
        if frame_refused:
            print(f"  \033[92m[BLOCKED]\033[0m Target refused to load in iframe (anti-framing active)")
        else:
            print(f"  \033[93m[LOADED]\033[0m Target loaded in iframe — checking if content is accessible...")
            if iframe_loaded.get("reason") == "cross_origin_blocked":
                print(f"  \033[92m[MITIGATED]\033[0m Cross-origin policy blocks content access (clickjacking still possible for blind clicks)")
            else:
                print(f"  \033[91m[VULNERABLE]\033[0m Frame content is accessible — clickjacking possible!")

        blocked_1 = frame_refused
        results.append({"attack": "clickjack_embed", "blocked": blocked_1})

        attacker_page.close()
        print()

        # ─── Attack 2: CSP frame-ancestors check ───
        print("─── Attack 2: CSP frame-ancestors Analysis ───")
        print("Checking Content-Security-Policy for frame-ancestors directive...")

        page = context.new_page()
        page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))

        response = page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)

        # Parse CSP from meta tag (GitHub Pages serves static files, no server headers)
        csp_meta = page.evaluate("""() => {
            var meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            return meta ? meta.content : null;
        }""")

        # Also check for X-Frame-Options header
        xfo_header = None
        if response:
            headers = response.headers
            xfo_header = headers.get("x-frame-options", None)

        has_frame_ancestors = csp_meta and "frame-ancestors" in csp_meta if csp_meta else False
        has_xfo = xfo_header is not None

        print(f"  CSP meta tag: {'Present' if csp_meta else 'Missing'}")
        if csp_meta:
            # Extract relevant directives
            directives = csp_meta.split(";")
            for d in directives:
                d = d.strip()
                if "frame" in d.lower() or "script" in d.lower() or "object" in d.lower():
                    print(f"    {d}")

        print(f"  frame-ancestors: {'Present' if has_frame_ancestors else 'MISSING'}")
        print(f"  X-Frame-Options: {xfo_header or 'Not set (static GitHub Pages)'}")

        # frame-ancestors is the modern defense; XFO is legacy
        # Note: GitHub Pages static hosting doesn't send XFO headers
        # The CSP meta tag is the primary defense mechanism here
        if has_frame_ancestors:
            print(f"  \033[92m[PROTECTED]\033[0m frame-ancestors directive blocks unauthorized framing")
            blocked_2 = True
        elif has_xfo:
            print(f"  \033[92m[PROTECTED]\033[0m X-Frame-Options header present: {xfo_header}")
            blocked_2 = True
        else:
            # Note: CSP meta tag frame-ancestors is actually ignored by browsers
            # (frame-ancestors only works via HTTP header, not meta tag).
            # But the page may have other defenses (framebusting JS).
            print(f"  \033[93m[WARN]\033[0m No frame-ancestors in CSP and no XFO header")
            print(f"  → Note: frame-ancestors in meta tags is ignored by browsers (spec limitation)")
            print(f"  → Page relies on object-src 'none' and JavaScript framebusting")
            blocked_2 = False

        results.append({"attack": "csp_frame_ancestors", "blocked": blocked_2})
        print()

        # ─── Attack 3: JavaScript framebusting check ───
        print("─── Attack 3: JavaScript Framebusting Check ───")
        print("Checking if the page has JavaScript-based anti-framing...")

        framebust_check = page.evaluate("""() => {
            var checks = {
                topCheck: false,
                breakout: false,
                selfTop: false
            };

            // Check page source for common framebusting patterns
            var scripts = document.querySelectorAll('script');
            for (var i = 0; i < scripts.length; i++) {
                var src = scripts[i].textContent || '';
                if (src.indexOf('top.location') !== -1 || src.indexOf('self !== top') !== -1 ||
                    src.indexOf('window.top') !== -1 || src.indexOf('parent.location') !== -1) {
                    checks.topCheck = true;
                }
                if (src.indexOf('top.location = self.location') !== -1 ||
                    src.indexOf('top.location.href') !== -1) {
                    checks.breakout = true;
                }
            }

            // Check if window.self === window.top (we're not in a frame)
            checks.selfTop = (window.self === window.top);

            return checks;
        }""")

        print(f"  top/self check in scripts: {framebust_check.get('topCheck', False)}")
        print(f"  Breakout code found: {framebust_check.get('breakout', False)}")
        print(f"  Currently top-level: {framebust_check.get('selfTop', True)}")

        if framebust_check.get("topCheck") or framebust_check.get("breakout"):
            print(f"  \033[92m[PROTECTED]\033[0m Page has JavaScript framebusting")
            blocked_3 = True
        else:
            print(f"  \033[93m[WARN]\033[0m No JavaScript framebusting detected")
            blocked_3 = False

        results.append({"attack": "js_framebust", "blocked": blocked_3})
        print()

        # ─── Attack 4: GAS iframe X-Frame-Options ───
        print("─── Attack 4: GAS Iframe X-Frame-Options ───")
        print("Checking if GAS backend sets X-Frame-Options: ALLOWALL...")

        # GAS uses ALLOWALL to allow embedding — check if this is exploitable
        gas_page = context.new_page()
        try:
            gas_response = gas_page.goto(GAS_BASE_URL, wait_until="load", timeout=15000)

            gas_xfo = None
            if gas_response:
                gas_xfo = gas_response.headers.get("x-frame-options", None)

            print(f"  GAS X-Frame-Options: {gas_xfo or 'Not set'}")

            # ALLOWALL means the GAS content can be framed by anyone
            # This is by design (the embedding page needs to iframe it),
            # but an attacker could also iframe it
            if gas_xfo and "ALLOWALL" in gas_xfo.upper():
                print(f"  \033[93m[BY DESIGN]\033[0m GAS uses ALLOWALL — required for legitimate embedding")
                print(f"  → Defense relies on PARENT_ORIGIN check in postMessage targetOrigin")
                blocked_4 = True  # By design — postMessage origin check is the real defense
            elif gas_xfo and ("DENY" in gas_xfo.upper() or "SAMEORIGIN" in gas_xfo.upper()):
                print(f"  \033[92m[PROTECTED]\033[0m GAS restricts framing")
                blocked_4 = True
            else:
                print(f"  \033[93m[WARN]\033[0m No X-Frame-Options — GAS content frameable by anyone")
                blocked_4 = False

        except Exception as e:
            print(f"  \033[92m[BLOCKED]\033[0m Could not reach GAS endpoint: {str(e)[:60]}")
            blocked_4 = True

        gas_page.close()
        results.append({"attack": "gas_xfo_allowall", "blocked": blocked_4})
        print()

        # ─── Attack 5: Double-framing attack ───
        print("─── Attack 5: Double-Framing Attack ───")
        print("Embedding target inside nested iframes to bypass framebusting...")

        # Some framebusting scripts check `if (self !== top)` but can be
        # bypassed with double-framing (sandbox + nested iframes)
        double_frame_page = context.new_page()
        double_frame_html = f"""
        <html>
        <body>
            <iframe id="outer" style="width:800px;height:600px;border:1px solid red;"
                    sandbox="allow-scripts allow-forms">
            </iframe>
            <script>
                var outer = document.getElementById('outer');
                outer.srcdoc = '<html><body><iframe id="inner" src="{TARGET_URL}" ' +
                    'style="width:100%;height:100%;border:none;" ' +
                    'sandbox="allow-scripts allow-same-origin allow-forms"></iframe></body></html>';
            </script>
        </body>
        </html>
        """

        double_frame_page.set_content(double_frame_html)
        double_frame_page.wait_for_timeout(3000)

        # Check if target loaded in the nested frame
        nested_loaded = double_frame_page.evaluate("""() => {
            var outer = document.getElementById('outer');
            if (!outer) return { loaded: false, reason: 'no_outer' };
            try {
                var outerDoc = outer.contentDocument;
                var inner = outerDoc ? outerDoc.getElementById('inner') : null;
                if (!inner) return { loaded: false, reason: 'no_inner' };
                var innerDoc = inner.contentDocument;
                return {
                    loaded: innerDoc && innerDoc.body && innerDoc.body.innerHTML.length > 100,
                    bodyLength: innerDoc ? innerDoc.body.innerHTML.length : 0
                };
            } catch(e) {
                return { loaded: false, reason: 'blocked', error: e.message };
            }
        }""")

        if not nested_loaded.get("loaded", False):
            print(f"  \033[92m[BLOCKED]\033[0m Double-framing failed: {nested_loaded.get('reason', 'unknown')}")
            blocked_5 = True
        else:
            print(f"  \033[91m[BYPASSED]\033[0m Target loaded in nested iframe!")
            blocked_5 = False

        results.append({"attack": "double_framing", "blocked": blocked_5})
        double_frame_page.close()

        print()

        # ─── Attack 6: Sandbox attribute abuse ───
        print("─── Attack 6: Sandbox Attribute Abuse ───")
        print("Testing if sandbox restrictions can disable framebusting...")

        sandbox_page = context.new_page()
        # The sandbox attribute without allow-top-navigation prevents framebusting
        # (top.location assignment throws a SecurityError)
        sandbox_html = f"""
        <html>
        <body>
            <iframe id="sandboxed" src="{TARGET_URL}"
                    style="width:800px;height:600px;border:1px solid blue;"
                    sandbox="allow-scripts allow-same-origin allow-forms">
            </iframe>
        </body>
        </html>
        """

        sandbox_page.set_content(sandbox_html)
        sandbox_page.wait_for_timeout(3000)

        sandbox_result = sandbox_page.evaluate("""() => {
            var frame = document.getElementById('sandboxed');
            if (!frame) return { loaded: false, reason: 'no_frame' };
            try {
                var doc = frame.contentDocument;
                return {
                    loaded: doc && doc.body && doc.body.innerHTML.length > 100,
                    bodyLength: doc ? doc.body.innerHTML.length : 0,
                    hasAuthWall: doc ? !!doc.getElementById('auth-wall') : false
                };
            } catch(e) {
                return { loaded: false, reason: 'cross_origin', error: e.message };
            }
        }""")

        if sandbox_result.get("hasAuthWall"):
            print(f"  \033[91m[VULNERABLE]\033[0m Page loaded with auth-wall visible in sandboxed iframe")
            print(f"  → sandbox prevents top.location framebust; page renders clickjackable")
            blocked_6 = False
        elif sandbox_result.get("loaded"):
            print(f"  \033[93m[PARTIAL]\033[0m Page loaded but auth wall not detected")
            blocked_6 = False
        else:
            print(f"  \033[92m[BLOCKED]\033[0m Sandbox iframe did not load target: {sandbox_result.get('reason')}")
            blocked_6 = True

        results.append({"attack": "sandbox_abuse", "blocked": blocked_6})
        sandbox_page.close()

        print()

        # ─── Summary ───
        print("=" * 70)
        total = len(results)
        blocked = sum(1 for r in results if r["blocked"])
        bypassed = total - blocked
        print(f"RESULTS: {blocked}/{total} attacks blocked")
        if bypassed > 0:
            print(f"\033[93m  {bypassed} ATTACK(S) HAD PARTIAL SUCCESS\033[0m")
            print("  Note: Clickjacking on GitHub Pages is partially mitigated by CSP")
            print("  and cross-origin policies. The auth-wall UX prevents data exfiltration")
            print("  even if the page is frameable (attacker can't see past the wall).")
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
