#!/usr/bin/env python3
"""Verify the Profiler app's access matrix, per-account isolation and specs rendering.

Three checks run in one pass:
  1. Role + Access matrix — which surfaces each ACL tier sees (screenshot per tier)
  2. Guidance progress isolation — reading progress must not carry between accounts
     sharing a browser
  3. Technical Annex render audit — every dossier shows a populated specs section
     or none at all; no blank rows, no lone headings


Serves live-site-pages/ over localhost, stubs the Profiler GAS backend (whoami +
guidance ops), signs the page in as each ACL tier in turn, and asserts which of
the four gated surfaces actually render. The tier is never written to
localStorage directly — it arrives from the stubbed whoami and passes through
ovNormalizeRole, so the test exercises the real sign-in path.

The matrix under test (developer directives, 2026-08-22; Reports added 2026-08-29):

    tier          Field Note   Versions   Industry Guidance   Export dossier   Reports
    admin              yes        yes            yes               yes           yes
    contributor         no         no            yes               yes            no
    analyst             no         no             no               yes            no
    viewer              no         no             no                no            no

Chromium is PRE-INSTALLED in the Claude Code web environment at /opt/pw-browsers;
the bundled Playwright build number does not match, so launch with an explicit
executable_path. Do NOT run `playwright install`.

Usage:
  python3 scripts/verify-profiler-roles.py

Screenshots land in .playwright-screenshots/profiler-role-<tier>.png (gitignored).
Exit code is non-zero if any tier's rendered surfaces disagree with the matrix,
so it can gate CI.
"""
import glob, json, threading, functools, http.server, socketserver, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parent.parent
LIVE = REPO / 'live-site-pages'
SHOTS = REPO / '.playwright-screenshots'
SHOTS.mkdir(exist_ok=True)

# Expected matrix — the developer's directive, encoded as the test oracle.
EXPECT = {
    'admin':       {'fieldNote': True,  'versions': True,  'guidance': True,  'export': True,  'reports': True},
    'contributor': {'fieldNote': False, 'versions': False, 'guidance': True,  'export': True,  'reports': False},
    'analyst':     {'fieldNote': False, 'versions': False, 'guidance': False, 'export': True,  'reports': False},
    'viewer':      {'fieldNote': False, 'versions': False, 'guidance': False, 'export': False, 'reports': False},
}
GUIDANCE_ALLOWED = {'admin', 'contributor'}   # mirrors guidanceAllowed_ in Profiler.gs


def find_chrome():
    for pat in ('/opt/pw-browsers/chromium-*/chrome-linux/chrome',
                '/opt/pw-browsers/chromium-*/chrome-linux/headless_shell'):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None


def serve(directory):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def gas_stub(state):
    """Stand in for the deployed GAS: whoami reports the tier, guidance enforces it.

    `state` may be a tier name or a mutable {'role', 'email'} dict, so a single
    browser context can switch accounts between page loads.
    """
    def handle(route, request):
        st = state if isinstance(state, dict) else {'role': state}
        role = st['role']
        email = st.get('email') or (role + '@example.com')
        url = request.url
        body = {'success': False, 'error': 'unsupported_in_test'}
        if 'nop=whoami' in url:
            body = {'success': True, 'email': email,
                    'role': role, 'isAdmin': role == 'admin'}
        elif 'action=guidance' in url or 'op=guidance' in url:
            if role in GUIDANCE_ALLOWED:
                body = {'success': True, 'docs': [{'id': 'nvidia-800vdc', 'title': 'Test module',
                                                   'short': 'stub', 'sections': 1}]}
            else:
                body = {'success': False, 'error': 'ROLE_DENIED', 'role': role}
        route.fulfill(status=200, content_type='application/json',
                      headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(body))
    return handle


def probe(page):
    """Read the four gated surfaces out of the live DOM."""
    return page.evaluate("""() => {
      const vis = id => {
        const el = document.getElementById(id);
        if (!el) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      };
      return {
        fieldNote: vis('ov-note-btn') || vis('ov-qn'),
        noteBtn:   vis('ov-note-btn'),
        noteBox:   vis('ov-qn'),
        versions:  vis('ov-vers-btn'),
        guidance:  vis('ov-guide-btn'),
        export:    vis('ov-export-btn'),
        reports:   vis('ov-reports-btn'),
        wall:      vis('ov-authwall'),
        role:      localStorage.getItem('ov_note_role')
      };
    }""")


def check_progress_isolation(browser, base):
    """Industry Guidance reading progress must not carry between accounts.

    One browser, one localStorage: sign in as an admin, tick a section understood,
    then sign a second account into the same browser and assert it starts clean —
    and that returning to the first account still finds its own ticks.
    """
    fails = []
    state = {'role': 'admin', 'email': 'admin@example.com'}
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    ctx.route('**://script.google.com/**', gas_stub(state))
    ctx.route('**://accounts.google.com/**', lambda r, q: r.abort())
    ctx.add_init_script("localStorage.setItem('ov_note_session','%s');" % ('t' * 48))
    page = ctx.new_page()

    def load(email, first=False):
        # Re-navigating to an identical URL is a same-document fragment move, so
        # the page would never re-run whoami. Reload explicitly, then wait for the
        # account the stub is now reporting rather than for any account at all.
        if first:
            page.goto(base + '#', wait_until='networkidle')
        else:
            page.reload(wait_until='networkidle')
        page.wait_for_function("e => localStorage.getItem('ov_note_email') === e",
                               arg=email, timeout=15000)
        page.wait_for_timeout(300)

    load('admin@example.com', first=True)
    page.evaluate("() => gdSetProgress('nvidia-800vdc', 'sec-exec-read', true)")
    admin_acct = page.evaluate("() => ovAcctKey()")
    if page.evaluate("() => gdProgress('nvidia-800vdc')['sec-exec-read']") is not True:
        fails.append('progress: admin tick did not persist')

    state.update(role='contributor', email='contributor@example.com')
    load('contributor@example.com')
    contrib_acct = page.evaluate("() => ovAcctKey()")
    if contrib_acct == admin_acct:
        fails.append('progress: both accounts resolve to the same namespace %r' % contrib_acct)
    if page.evaluate("() => Object.keys(gdProgress('nvidia-800vdc')).length") != 0:
        fails.append('progress: contributor inherited the admin account\'s progress')
    page.evaluate("() => gdSetProgress('nvidia-800vdc', 'sec-protection', true)")

    state.update(role='admin', email='admin@example.com')
    load('admin@example.com')
    back = page.evaluate("() => gdProgress('nvidia-800vdc')")
    if back.get('sec-exec-read') is not True:
        fails.append('progress: admin lost its own progress after the other account signed in')
    if 'sec-protection' in back:
        fails.append('progress: admin picked up the contributor account\'s progress')

    print('\nGuidance progress isolation')
    print('  admin namespace       %s' % admin_acct)
    print('  contributor namespace %s' % contrib_acct)
    print('  contributor start     %s' % ('clean' if not fails else 'CONTAMINATED'))
    ctx.close()
    return fails


def check_spec_sections(browser, base, slugs):
    """Every dossier must show a populated specs section or none at all.

    Spec entries come in two shapes ({label, value} and plain string); the second
    used to render as blank rows. Walk every dossier and assert no rendered row is
    empty and no specs heading stands alone.
    """
    fails = []
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    ctx.route('**://script.google.com/**', gas_stub({'role': 'admin', 'email': 'admin@example.com'}))
    ctx.route('**://accounts.google.com/**', lambda r, q: r.abort())
    ctx.add_init_script("localStorage.setItem('ov_note_session','%s');" % ('t' * 48))
    page = ctx.new_page()
    page.goto(base + '#', wait_until='networkidle')
    page.wait_for_function("() => !!localStorage.getItem('ov_note_role')", timeout=15000)

    with_specs = without = 0
    for slug in slugs:
        page.evaluate("s => { location.hash = '#' + s; }", slug)
        page.wait_for_function("s => document.querySelector('.ov-co-head h2') && location.hash.indexOf(s) === 1",
                               arg=slug, timeout=10000)
        page.wait_for_timeout(120)
        got = page.evaluate("""() => {
          const heads = [...document.querySelectorAll('.ov-sec-hd, .sec-hd, h2, h3')]
            .filter(e => /technical annex|technical specifications|product detail|zoom in/i.test(e.textContent||''));
          const rows = [...document.querySelectorAll('table.ov-table tr')];
          const blank = rows.filter(tr => !(tr.textContent||'').trim()).length;
          return { heads: heads.length, rows: rows.length, blank: blank };
        }""")
        if got['blank']:
            fails.append('%s: %d blank spec row(s) rendered' % (slug, got['blank']))
        if got['heads'] and not got['rows']:
            fails.append('%s: specs heading rendered with no rows' % slug)
        if got['heads']:
            with_specs += 1
        else:
            without += 1

    print('\nTechnical Annex render audit')
    print('  dossiers checked      %d' % len(slugs))
    print('  with a specs section  %d' % with_specs)
    print('  without one          %d' % without)
    print('  blank rows found      %d' % sum(1 for f in fails if 'blank' in f))
    ctx.close()
    return fails


def all_slugs():
    import json as _json
    out = []
    reg = LIVE / 'profiler-data' / 'profiler-companies.json'
    for c in _json.load(open(reg, encoding='utf-8')).get('companies', []):
        if c.get('slug'):
            out.append(c['slug'])
    return sorted(out)


def run():
    chrome = find_chrome()
    if not chrome:
        print('FAIL: no Chromium found under /opt/pw-browsers'); return 1
    httpd, port = serve(LIVE)
    base = 'http://127.0.0.1:%d/Profiler.html' % port
    failures, rows = [], []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
        for role in ('admin', 'contributor', 'analyst', 'viewer'):
            ctx = browser.new_context(viewport={'width': 1440, 'height': 1000})
            ctx.route('**://script.google.com/**', gas_stub(role))
            ctx.route('**://accounts.google.com/**', lambda r, q: r.abort())
            # Seed only the session token — the tier must come from the stubbed
            # whoami through ovNormalizeRole, exactly as it does in production.
            ctx.add_init_script(
                "localStorage.setItem('ov_note_session','%s');"
                "localStorage.removeItem('ov_note_role');" % ('t' * 48))
            page = ctx.new_page()

            page.goto(base + '#zhonhen', wait_until='networkidle')
            page.wait_for_function("() => !!localStorage.getItem('ov_note_role')", timeout=15000)
            page.wait_for_timeout(1200)          # let the post-auth repaint settle
            got = probe(page)

            page.screenshot(path=str(SHOTS / ('profiler-role-%s.png' % role)), full_page=False)

            # Settings cog (v01.45w: fronts Commands + Field notes; renders on
            # roster and dossier views). Both caps are admin-only, so the
            # fieldNote expectation still gates its visibility per tier.
            page.goto(base + '#', wait_until='networkidle')
            page.wait_for_timeout(800)
            got['cog'] = page.evaluate(
                "() => { const e = document.getElementById('ov-notes-cog');"
                " return !!e && getComputedStyle(e).display !== 'none'; }")

            exp = EXPECT[role]
            for cap in ('fieldNote', 'versions', 'guidance', 'export', 'reports'):
                if got[cap] != exp[cap]:
                    failures.append('%s: %s expected %s, got %s' % (role, cap, exp[cap], got[cap]))
            if got['cog'] != exp['fieldNote']:
                failures.append('%s: notes cog expected %s, got %s' % (role, exp['fieldNote'], got['cog']))
            if got['role'] != role:
                failures.append('%s: stored tier is %r' % (role, got['role']))
            if got['wall']:
                failures.append('%s: sign-in wall still covering the app' % role)

            rows.append((role, got))
            ctx.close()

        failures += check_progress_isolation(browser, base)
        failures += check_spec_sections(browser, base, all_slugs())
        browser.close()
    httpd.shutdown()

    mark = lambda b: 'shown ' if b else 'hidden'
    print('\nRole + Access matrix')
    print('\n%-12s %-8s %-8s %-8s %-8s %-8s %-8s %-8s' %
          ('ROLE', 'NoteBtn', 'NoteBox', 'Cog', 'Versions', 'Guidance', 'Export', 'Reports'))
    print('-' * 75)
    for role, g in rows:
        print('%-12s %-8s %-8s %-8s %-8s %-8s %-8s %-8s' % (
            role, mark(g['noteBtn']), mark(g['noteBox']), mark(g['cog']),
            mark(g['versions']), mark(g['guidance']), mark(g['export']), mark(g['reports'])))
    print()
    if failures:
        print('FAILURES (%d):' % len(failures))
        for f in failures:
            print('  ✗', f)
        return 1
    print('ALL CHECKS PASSED — access matrix, per-account isolation, specs rendering.')
    return 0


if __name__ == '__main__':
    sys.exit(run())

# Developed by: LightAISolutions
