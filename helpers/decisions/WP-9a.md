# WP-9a — decisions and assumptions (core route registry + `initData` verification)

Brief: `helpers/prompts/TG-PHASE-9.md` Step 1 row 9a. Outcomes: `helpers/status/WP-9a.md`.

1. **Status lives in the JSON body.** Apps Script web apps always answer HTTP 200 (and 302 to the content echo), so a registered route's error is `{ ok:false, status, reason }` in the body with the HTTP status untouched. The shell reads `body.status`. The brief's "400/403/429" are those body values.
2. **Every answer is `ContentService` JSON** — including the unknown-route 404 on POST, which used to be an HtmlService "not found". Reason: an HtmlService answer carries no CORS header and is unreadable from the GitHub Pages origin; a ContentService answer is (verified live in Step 0). Unknown GET routes still fall through to the health check, as before.
3. **`upload` is a core route name.** Phase 7 is adding a core `?route=upload`; `CORE_ROUTES` lists it now so a pack can never shadow it, and `getRoute()` returns null for every core name even if something is planted in the registry.
4. **`auth: 'webapp'` is POST-only** — `initData` travels in the body (a text/plain POST needs no CORS preflight). Registering a `webapp` route with GET throws at load time.
5. **Verification order and reasons.** `missing`, `too_long` (> `INITDATA_MAX_CHARS`), `malformed`, `missing_hash`, `missing_field`, `bad_hash`, `bad_auth_date`, `expired` (> `INITDATA_MAX_AGE_SEC`, default 86 400 s; `maxAgeSec: 0` disables), `bad_user`, `not_owner`. The hash is checked before the owner so a forged owner id never reaches the comparison path with a valid signature. The reason is audited **once per route and reason** (`seenOnce`), never the `initData` itself.
6. **`start_param`** is passed to the handler as a string capped at 512 characters; the handler decides what it means.
7. **Daily cap counts verified calls only.** `MAX_APP_CALLS_PER_DAY` (default 2000; property override) increments the `app_calls` daily setting after `initData` verifies; refused calls do not count, so a stranger cannot exhaust the owner's day. The 429 is audited once per local day.
8. **Body limit** `ROUTE_BODY_MAX_CHARS` 65 536 — checked before JSON parsing; the body must be a JSON object (`bad_json` otherwise). A thrown handler is audited (`route_error`, `describeError`) and answered `500 internal`.
9. **`web_app` buttons** are `{ text, web_app: { url } }` with an https URL; `tgKeyboard` throws on anything else so a bad property fails loudly in tests, not silently in Telegram.
10. **Menu button**: `tgSetMenuButton(url, text)` sends `setChatMenuButton` for the owner chat only (`{ type:'web_app', text (≤ 32 chars), web_app:{ url } }`); `tgMenuButtonDefault()` restores `{ type:'default' }`. Both are no-ops without an owner chat.
11. **Harness HMAC** — the mock `Utilities.computeHmacSha256Signature(value, key)` now computes a real HMAC (signed bytes like Apps Script) instead of a stub, so the test signature is the one Telegram would produce for the fixture token.

## Security review (after the merge, Fable 5.1 · high, read-only)
12. **Registry getters answer own properties only** (`_regGet`). Before, `?route=constructor` / `__proto__` / `toString` resolved to an inherited `Object.prototype` member, threw inside `routeRegistered` and wrote a `doGet_error` / `doPost_error` audit row **per request** (the one MEDIUM finding). Now such names fall through to health (GET) or the JSON 404 (POST); tested with five prototype names.
13. **An unknown POST route is audited once per 6 h per name** (`seenOnce('route:unknown:…')`), like a failed auth — a scanner cannot grow the AuditLog one row per request (pre-existing LOW, same class).
14. **Accepted as is — daily cap is not atomic**: `settingDailyCount` / `settingIncrDaily` run outside the script lock, so two parallel verified calls can both pass the check and a lost increment undercounts. Only the owner reaches that code; it is a cost guard, not an auth boundary. Revisit with 9b's `lock: true` idea (R4).
15. **Carried to the core store (not this WP's files)**: free text written to the Sheet is not escaped against a leading `=` `+` `-` `@` (formula injection; the chat's ✏️ path has the same gap). Fix belongs in `03_store.js` (`_cellOut`: prefix `'` or write the range as text) — Phase 8 tuning.

Developed by: LightAISolutions
