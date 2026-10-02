# WP-9c — the shell (`live-site-pages/helper-app.html`)

**State: done (owner approval of the screenshots pending — the owner pre-approved in the thread).** One self-contained standalone page, 556 lines, no build step; the only external script is `https://telegram.org/js/telegram-web-app.js`. Design notes, defaults and the screenshots: `helpers/decisions/WP-9c.md`.

## Files
| file | change |
|---|---|
| `live-site-pages/helper-app.html` | the shell: six screens (home, shortlist checklist, facts form, interview form, brochure, places), the one transport, 403/429/offline/no-Telegram states |
| `live-site-pages/html-versions/helper-apphtml.version.txt` | `\|v01.00w\|` |
| `live-site-pages/html-changelogs/helper-apphtml.changelog.md` (+ `-archive.md`) | empty changelog pair |
| `helpers/tests/shell_helper-app.playwright.mjs` | the browser test (below) |
| `helpers/decisions/screenshots/wp-9c/*.png` | 17 screenshots at 390×844 @2x |

## Test
`node helpers/tests/shell_helper-app.playwright.mjs` — Playwright on the pre-installed Chromium, every request answered by `page.route()` (the page origin, telegram.org's script replaced by a `Telegram.WebApp` stub, a fixture core on an invented deployment id); no network. **41 checks, 0 failed**:
- every screen in dark and light (12 screenshots) with no page error and no request to a foreign host; every call a `text/plain;charset=utf-8` POST carrying `initData`; the core kept in CloudStorage;
- the shortlist sends nothing per tick, the MainButton reads "Save 3 choices", one `shortlist.choose_many` carries the three final choices, then "Done choosing" sends one `shortlist.done`;
- `facts.confirm` carries keeps, drops and an edit; `interview.submit` carries scale/multi picks plus typed values;
- the brochure frame is `sandbox=""`, a fixture brochure containing `<script>` renders without the script running (`data-ran` unset, `parent.__pwned` unset); an over-size brochure shows the Drive link and opens it through `Telegram.openLink`;
- no Telegram / empty `initData` → the one explanatory line and no call; 403 and 429 states; no core and nothing stored → explanatory line; a `?core=` outside `script.google.com` is ignored; `?screen=places` deep link;
- at 390 px: no horizontal scroll and every visible tap target ≥ 44 px on every screen.
- The page is not part of `node --test helpers/tests/` (the file name does not match the runner's patterns) because it needs Chromium; run it by hand after any shell change.

## Requests
- R1 (WP-9b): the operations and response shapes the shell expects are listed in the coordinator's note to 9b and in `helpers/decisions/WP-9c.md` §3 — `facts.get`, `shortlist.more`, `trip.has_brochure`, `places.search.filters`.
- R2 (bookkeeping): README tree entries for the five new paths and the pack README "The app" section.

Developed by: LightAISolutions
