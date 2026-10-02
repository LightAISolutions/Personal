# WP-9a — core: `registerRoute` and Telegram Mini App `initData` verification

**State: done.** The fifteenth registry (`route`), the router's registered-route dispatch, `tgVerifyInitData`, the `web_app` button shape and the menu-button helpers are in `helpers/core/`; SPEC §5/§6/§7/§16/§18 describe them; the harness signs `initData` for tests. Assumptions and defaults: `helpers/decisions/WP-9a.md`.

## Files
| file | change |
|---|---|
| `helpers/core/00_config.js` | `PROP_KEYS` + `APP_SHELL_URL`, `MAX_APP_CALLS_PER_DAY`; `LIMITS` + `MAX_APP_CALLS_PER_DAY` (2000), `INITDATA_MAX_AGE_SEC` (86400), `INITDATA_MAX_CHARS` (4096), `ROUTE_BODY_MAX_CHARS` (65536) |
| `helpers/core/02_registry.js` | bucket `route`, `CORE_ROUTES = ['tg','wake','setup','health','upload']`, `registerRoute(name, { methods, auth, handler })`, `getRoute(name)` (never a core name) |
| `helpers/core/10_router.js` | `doGet`/`doPost` dispatch registered routes through `routeRegistered(e, name, def, method)`; unknown POST route → JSON `{ ok:false, status:404, reason:'not_found' }`; `routeError(status, reason)` |
| `helpers/core/05_telegram.js` | `tgKeyboard` accepts `{ text, web_app: { url } }` (https only); `tgVerifyInitData(initData, { maxAgeSec })`; `tgSetMenuButton(url, text)`; `tgMenuButtonDefault()` |
| `helpers/tests/harness/gas-mocks.js` | real HMAC-SHA256 in the `Utilities` mock; exported `initData(ctx, state, opts)` and `appPost(ctx, state, route, body, opts)` |
| `helpers/SPEC.md` | §5 row + helpers, §6 "Registered routes" subsection, §7 two properties, §16 three Phase 9 rows, §18 four limits |

## Tests
| file | tests |
|---|---|
| `helpers/tests/core_routes.test.js` | 6 — registration refusals (core names incl. `upload`, bad name, methods, auth, webapp+GET, missing handler, duplicate); unknown route; auth `none` (GET/POST, bad JSON, oversize body, 405, status fill, thrown handler → 500 audited); auth `admin`; auth `webapp` (403 reasons audited once each, success carries `user` + `start_param`); the daily cap (429, audited once, refused calls not counted, new day resets) |
| `helpers/tests/core_initdata.test.js` | 5 — a valid signature; the documented key/message order (swapped → `bad_hash`); every refusal reason without leaking the input; `tgSetMenuButton` / `tgMenuButtonDefault` exact JSON; the `web_app` keyboard shape |

- Full suite: 494 tests — 493 pass, 1 skipped, 0 fail (two existing expectations updated: `core_router.test.js` and `pack_tour-guide_redteam_chat.test.js` H5 now expect the JSON 404 for an unknown POST route instead of the HtmlService text).
- `node helpers/tools/bundle.mjs --all --check`: ok (hello 17 files, tour-guide 26 files). `node helpers/tools/boundary-check.mjs`: clean (378 files).

## For WP-9b and WP-9c
- Test helpers: `H.initData(ctx, state, { userId, authDate, startParam, extra })` signs with the bootstrap bot token for the bootstrap owner (777); `H.appPost(ctx, state, 'app', { op, args }, { initData?, userId? })` returns the parsed JSON answer. A stranger's `initData` (`userId: 1`) is refused 403 before any handler runs.
- Handler contract: `handler(req)` with `req = { method, params, body, user, auth_date, start_param }`; return `{ status, body }` (`body` serialised as JSON; non-200 bodies get `ok:false`, `status` and a default `reason` filled in). A thrown handler answers 500 `internal` and audits `route_error`; the stack never leaves the script.
- Status is carried **in the JSON body** (`{ ok:false, status, reason }`) — Apps Script cannot set HTTP status codes, so the shell branches on `body.status`, not on `response.status`.
- `tgCmdRemark(ctx, …)` needs the tapped message's id and keyboard; an app operation has neither — the pack must keep the shortlist message ids (or refresh differently) to mirror app choices into the chat keyboard. The adopt branch of `tgPlanShortlistMessages` re-maps keyboard rows as `{ text, data }`, which would drop a `web_app` button's `url` — carry `web_app` through when adding the button.

Developed by: LightAISolutions
