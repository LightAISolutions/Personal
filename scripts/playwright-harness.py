#!/usr/bin/env python3
"""Playwright smoke-test harness for all live-site projects.

Loads each deployed page in headless Chromium, captures console/page errors,
takes a screenshot, and reports pass/fail per page. This is a smoke test
(does the page load and render without uncaught JS errors), NOT a full
auth/GAS end-to-end test — auth-gated pages render their sign-in wall.

Chromium is PRE-INSTALLED in the Claude Code web environment at
/opt/pw-browsers; the bundled Playwright build number does not match, so we
launch with an explicit executable_path. Do NOT run `playwright install`
(it tries to re-download and fails behind the network policy).

Usage:
  python3 scripts/playwright-harness.py                 # test all tracked pages
  python3 scripts/playwright-harness.py index globalacl # test only these pages
  python3 scripts/playwright-harness.py --all-html      # test every .html (incl. redirects/stubs)

Exit code is non-zero if any page fails (uncaught error or empty render),
so it can gate CI if desired.
"""
import sys, glob, os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LIVE = REPO / 'live-site-pages'
VERS = LIVE / 'html-versions'
SHOTS = REPO / '.playwright-screenshots'

# Console/page errors expected under file:// (no HTTP, no real auth/GAS) — ignored.
IGNORE = (
    'Fetch API cannot load', 'ERR_FILE_NOT_FOUND', 'Failed to load resource',
    'net::ERR_FILE', 'accounts.google.com', 'gsi/', 'GSI_LOGGER', 'client_id',
    'Failed to fetch', 'version.txt', 'changelog', '.mp3', 'FedCM',
    'Access to fetch', 'blocked by CORS', 'templates/', 'has been blocked',
)


def find_chrome():
    for pat in ('/opt/pw-browsers/chromium-*/chrome-linux/chrome',
                '/opt/pw-browsers/chromium-*/chrome-linux/headless_shell'):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None


def tracked_pages():
    return [f.name[:-len('html.version.txt')] for f in sorted(VERS.glob('*html.version.txt'))]


def all_html():
    return sorted(p.stem for p in LIVE.glob('*.html'))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    pages = args if args else (all_html() if '--all-html' in flags else tracked_pages())

    chrome = find_chrome()
    if not chrome or not os.path.exists(chrome):
        print('ERROR: could not find pre-installed Chromium under /opt/pw-browsers'); sys.exit(2)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('ERROR: playwright not installed. Run: pip install playwright  (do NOT run "playwright install")')
        sys.exit(2)

    SHOTS.mkdir(exist_ok=True)
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
        for name in pages:
            html = LIVE / (name + '.html')
            if not html.exists():
                results.append((name, 'MISSING', 'no such file')); continue
            errs = []
            page = browser.new_page(viewport={'width': 1280, 'height': 900})
            page.on('console', lambda m, _e=errs: _e.append(m.text) if m.type == 'error' else None)
            page.on('pageerror', lambda e, _e=errs: _e.append('PAGEERROR: ' + str(e)))
            try:
                # domcontentloaded (not 'load') — under file:// some sub-resources/fetches never
                # settle, so waiting for the full load event flakily times out. The DOM is what we check.
                page.goto(html.as_uri(), wait_until='domcontentloaded', timeout=20000)
                page.wait_for_timeout(1500)
                body_len = page.evaluate("document.body ? document.body.innerText.length : 0")
                page.screenshot(path=str(SHOTS / (name + '.png')))
            except Exception as e:
                results.append((name, 'FAIL', 'load error: ' + str(e)[:80])); page.close(); continue
            real = [e for e in errs if not any(s in e for s in IGNORE)]
            if body_len < 1:
                results.append((name, 'FAIL', 'empty render'))
            elif real:
                results.append((name, 'FAIL', str(len(real)) + ' JS error(s): ' + real[0][:80]))
            else:
                results.append((name, 'PASS', 'rendered ' + str(body_len) + ' chars' +
                                (' (' + str(len(errs)) + ' ignored)' if errs else '')))
            page.close()
        browser.close()

    print('\n  Playwright harness — %d page(s)\n  Chromium: %s\n  Screenshots: %s' % (len(results), chrome, SHOTS))
    print('  ' + '-' * 68)
    npass = sum(1 for _, s, _n in results if s == 'PASS')
    for name, status, note in results:
        print('  %s %-26s %-8s %s' % (('OK ' if status == 'PASS' else 'XX '), name, status, note))
    print('  ' + '-' * 68)
    print('  %d/%d passed' % (npass, len(results)))
    sys.exit(0 if npass == len(results) else 1)


if __name__ == '__main__':
    main()

# Developed by: LightAISolutions
