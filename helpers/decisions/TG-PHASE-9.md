# Phase 9 decisions — the Tour Guide app (Telegram Mini App)

*Started 2026-10-02 (Fable 5.1 · high). Prompt: `helpers/prompts/TG-PHASE-9.md`; its FINALIZE block was filled by this phase from the Phase 7 hand-off because the owner pulled the phase forward (decision 19). Generic facts only — no ids, URLs, secrets, trip or place data of the owner's.*

## 1 FINALIZE values (source: the Phase 7 hand-off)
- Screens ranked (1) shortlist checklist — local ticks, one `shortlist.choose_many` on submit, (2) trip-facts form, (3) interview form, (4) brochure, (5) places.
- Callbacks as built: `sl:<run>:<g><n>:w|l|s` (`g` = `a` activities / `f` food), `tf:<trip key>:<n>:y|e|n`, `pl:<action>:…`, `lt`, `ps:<key>:n|a|c`, `rv`, `rs`, `dy`; request kinds `research`, `plan`, `replan`, `places`, `prefs`.
- Brochure size unknown → `brochure.get` returns HTML only under a pack constant, else the Drive link. Photos off. Open items: typed picks in chat stay the fallback; `upload` is a core route name (Phase 7).

## 2 Step 0 — the one inference, verified live
| # | Check | Finding |
|---|---|---|
| V1 | Can a page on the GitHub Pages origin read the core's answer? | **Yes for `ContentService` JSON**: a GET to the health route and a text/plain POST to the wake route from the Pages site both returned readable `cors`-type responses (the 302 to the content echo carries `Access-Control-Allow-Origin`). |
| V2 | What about an `HtmlService` answer? | **Unreadable** (no CORS header): the old router's "not found" for an unknown POST route was blocked by the browser. Hence WP-9a decision 2 — every registered-route and unknown-route answer is ContentService JSON. |
| V3 | Transport | `fetch(core + '?route=app', { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body: JSON.stringify({ initData, op, args }) })` — no preflight, no fallback transport needed. |

## 3 Work-package decisions
- WP-9a: `helpers/decisions/WP-9a.md` (status in the JSON body, JSON 404, `upload` reserved, verification reasons audited once, cap counts verified calls only).
- WP-9b: `helpers/decisions/WP-9b.md` — the `app` route and its 16 operations (Opus 5.5 · high, in a worktree, merged by cherry-pick). Two choices the coordinator records here because they differ from the contract message: a typed "other" interview value takes the question's **first option's polarity** (as the chat does — on a dislike question a typed value stays a dislike), not `+`; and the route answers **409** for state conflicts (`no_flow`, `no_more`, `busy {flow}`) and **503 `busy`** when the script lock is held, besides 400/404 — every refusal is `{ok:false, status, reason}`, so the shell treats any `ok:false` the same way (403 and 429 get their own screens). Keyboard refresh after an app choice: option (a), message ids stored in Settings `tg_app_sl_msgs`. `places.note` was added (a notes request id for one place).
- WP-9c: `helpers/decisions/WP-9c.md` — the shell page (Fable 5.1 · high, this thread). 9b's optional request R3 (show the digest's days when `brochure.get` answers `no_brochure`) was already the shell's behaviour: the days render from `trip.digest` and the brochure box shows "Brochure not available".
- Carried to a later core change (9b's R4, optional): a `lock: true` flag on `registerRoute` so packs stop taking the script lock in every writing operation themselves.

## 4 Coordination
- Phase 7 (owner switch-on) is pushing the core `upload` route at the same time; Phase 9 rebases onto it before its own push and keeps `upload` a core name in `CORE_ROUTES`.

## 5 Security review (Step 3)
`imported--security-review` over `02_registry.js`, `05_telegram.js`, `10_router.js`, `32_app_api.js` and `helper-app.html` (Fable 5.1 · high, read-only; threat model: forged / replayed / foreign initData, a hostile `startapp` or `?core=` link, stored brochure HTML, argument injection into Sheet or Drive lookups, Google fields written by the app, AuditLog growth and cap bypass, leaks into the public shell, the menu-button and `web_app` buttons). Result: 0 critical, 0 high, 1 medium, 5 low, 3 info. Fixed in this push: the medium (prototype-named routes audited per request → registry getters answer own properties only), the unknown-POST audit (once per 6 h per name), `img-src` narrowed to `'self' data:`, `brochure.get` sends only HTML inline (another MIME gets the Drive link). Accepted and recorded: the non-atomic daily cap (`WP-9a.md` §14), `?core=` in the query string (`WP-9c.md` §17), registered route names enumerable through `405` (harmless). Carried: formula escaping in the core store (`WP-9a.md` §15), a `lock: true` flag on `registerRoute` (9b's R4). Verified sound: the initData check (HMAC per Telegram, constant-time, hash before owner, 24 h, every refusal audited once per 6 h), core-name dispatch before any registry lookup, every id regex-bound and every Sheet lookup in memory, no Google field written, the shell's `textContent`-only DOM, the `core`-only-from-URL rule, the brochure sandbox (scripts blocked, parent untouched), no secret in any answer or audit row.

Developed by: LightAISolutions
