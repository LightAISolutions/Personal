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

## 6 Live check (Step 4, 2026-10-02 02:10–02:45 UTC)
The owner set `APP_SHELL_URL`, ran the setup step ("menu button set: it opens the app") and opened the app from the bot's menu button in Telegram Web, then tapped every tab.

| # | Step | Finding | Fix |
|---|---|---|---|
| L1 | menu button | The owner looked for the app behind the paperclip (Telegram's attachment menu). The bot's menu button is a separate button left of the message box, and Telegram Web shows it only after the chat is reloaded (bot details are cached) | Guide §3 "Open from the app" says where the button is and to reload the web client |
| L2 | home | Home, the trip card, the places counts and the profile line rendered from the live core; the app expanded to full height | none |
| L3 | shortlist | The chat had already left the shortlist (the owner typed his picks and the plan was being built), yet Home showed the round as open with **Choose**; **Done choosing** then ended on a bare `no_flow` screen. The core was right (409 `no_flow`, stage `planning`); the shell did not know the round was closed | **v01.39r**: `home.choice_round.stage` and `shortlist.get.stage`; the shell shows a closed round as `CLOSED` with the tally and the stage (read-only **View**), and a `no_flow` on Done choosing as "This round is closed" |
| L4 | facts | The Facts tab ended on the same `no_flow` screen because no facts were open at that stage | **v01.39r**: a quiet *Nothing to confirm* state naming the stage |
| L5 | interview | The interview form rendered with the owner's chat answers pre-filled. The owner asked that future interviews, including other travellers' profiles, be done in the app rather than in the chat | §7 item 1 (next phase) |
| L6 | brochure, places | Brochure showed the trip and its dates with "No days planned yet" (correct: the plan digest had not arrived); Places listed the 9 places on file with filters | **v01.39r**: the empty brochure state says the days are being built while the plan is in progress |

The fix was verified with the shell test's new `planning` mode (closed round, no open facts; screenshot `screenshots/wp-9c/state-round-closed.png`); the owner re-tests after the v01.39r deploy.

## 7 For the next phase
1. **Interviews in the app for more than one traveller** (owner request, L5): the interview screen works for the owner's own profile only (`interview.submit` → the `prefs` request). Companions' profiles need a profile slot in the pack (who the answers are for, how research and planning weigh them) before the app can offer "interview for someone else"; the chat has no such notion either. Scope it in Phase 8 with the owner.
2. **Masthead**: the shell shows the generic "Helper" title by design (no helper-specific text in the public page). If the owner wants the helper's name there, `home` can carry the pack's `display_name` and the shell set the title from it — data, not text.
3. Carried from §5: `lock: true` on `registerRoute`; formula escaping in the core store.

Developed by: LightAISolutions
