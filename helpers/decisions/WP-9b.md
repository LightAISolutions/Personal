# WP-9b — decisions and assumptions (the app route and its operations)

Brief: `helpers/prompts/TG-PHASE-9.md` row 9b, plus the coordinator's two messages (the exact answer shapes, then `shortlist.more`). State and checks: `helpers/status/WP-9b.md`.

## Process
1. **Ownership.** Code is in `helpers/packs/tour-guide/gas/32_app_api.js`, plus small additive edits in `10_commands.js`, `12_flow_plan.js` and `20_envelopes.js`. Tests are in `helpers/tests/pack_tour-guide_gas_app.test.js`, and there is a short "## The app" section in the pack README. Nothing in `helpers/core/`, the harness, SPEC, CHANGELOG, version files or the root README was touched.
2. **No `place.fresh`.** Photos are off, so the route has no Google operation at all. `32_app_api.js` never reads `MAPS_API_KEY`, never calls `UrlFetchApp` or Maps, and never names a photo or place-id field. A grep test enforces this, and another checks that no write in the file carries `maps_`.
3. **Fixtures are invented**: "Port Sorrel" and "Gull Point", `https://app.example.invalid/helper-app.html` as the shell, and the harness's `TEST_DEPLOYMENT` URL as the core. There was no network call and no live Telegram, Drive or Google call.
4. **`initData` is not re-verified.** The core (`routeRegistered`) verifies the owner and applies the daily cap before `tgAppHandle` runs. A stranger (`userId: 1`) gets 403 without reaching the handler, and the test covers this.

## The route
5. **Dispatch.** `body = { initData, op, args }`. `TG_APP_OPS` maps each op to `{ args: allowed names, write, fn }`; the lookup uses `hasOwnProperty`, so `toString` is an unknown op. The checks run in this order:
   - a missing op → 400 `missing_arg {field:'op'}`
   - an unknown op → 400 `unknown_op`
   - non-object `args` → 400 `bad_args {field:'args'}`
   - **an unknown argument name → 400 `bad_args {field}`**, which is stricter than "ignore"
6. **Refusals are thrown and become answers.** A refusal is thrown as `TgAppRefusal` and caught in `tgAppHandle`, which turns it into `{ ok:false, reason, …extra }`; the core adds `status`. Any other exception is the core's 500 `internal`, with an audit row.
7. **Status codes.** The coordinator named 400 and 404. Two more codes are used, and the shell must treat any `ok:false` the same way:
   - **409** for a state conflict: `no_flow` (with `stage` when a plan flow exists in another stage), `no_more`, and `busy {flow}` when another flow (for example `/interview`) is open.
   - **503 `busy`** when the script lock is held.
8. **Reasons.** `missing_arg`, `bad_args`, `too_long {field|qid, max}`, `too_many {field, max}`, `unknown_op`, `no_round`, `no_item {n}`, `no_flow`, `no_more`, `no_picks`, `busy`, `no_trip`, `no_place {slug}`, `no_brochure`, `mixed_destinations`, `no_destination`, `unknown_qid`, `duplicate_qid`, `bad_value`, `empty`.
9. **Locking.** The core router does not take the script lock for registered routes. Every op that writes (to Choices, a flow, a request or Settings) therefore runs under `LockService.getScriptLock().tryLock(10 s)`, as a Telegram update does; if the lock is busy the answer is 503. Reads take no lock.
10. **Limits.**
    - query ≤ 200 characters (a 2 000-character query is 400 `too_long`)
    - destination, status and tag filters ≤ 64
    - `choose_many` ≤ 200 entries
    - interview answers ≤ 200 questions
    - facts and edits ≤ 40 each, edit text ≤ 2 000 on the wire, then the plan's own 300-character rule
    - `places.check` ≤ 24 slugs
    - the core caps the body at `ROUTE_BODY_MAX_CHARS`
11. **Fields added (none renamed).**
    - `shortlist.get`: `title` and `flow` (the plan flow is choosing this trip); per item `gem_line`, `new`, `seen_before`, `changes` and `round`.
    - `shortlist.choose`: `slug` and `refreshed`. `choose_many`: `refreshed`.
    - `shortlist.more`: `gems`. `shortlist.done`: `adopted`.
    - `brochure.get`: `verified_on` and `build_id`.
    - `places.*` rows: `last_researched` and `history_summary`.
    - `interview.bank`: `in_progress`.
    - `facts.get` per fact: `edited` and `original`.
    - `places.get { slug, note? }`: `note: true` also opens the full-note request and answers `request_id`, as TG-PHASE-9 asks ("a notes-style request id when the full note is wanted"), taking the lock for that part. **Added op `places.note { slug }`** does the same with only the request.
12. **`maps_url` everywhere** (shortlist items, digest stops, legs and rain options, places) follows the chat's rule: only Google Maps hosts, ≤ 400 characters (`TG_CMD_MAPS_URL`), else `''`. The shell therefore never shows a link that the chat would not have linked.

## Keyboard refresh after an app choice (caveat 1) — option (a), store the message ids
13. **Where the ids come from.** A shortlist round can reach the chat in two ways:
    - Flow path: `tgPlanOnShortlist` now sends with `tgAppSendRound`, which is `tgCmdSendAll` plus remembering the ids.
    - Renderer path: `tgEnvRender` and `tgEnvDeliver` take an optional `onSent(pairs)` hook, and the shortlist handler passes one.
14. **What is stored.** For each message with `sl:` buttons, `{ trip, run, round, chat, mid, kb }` goes into Settings `tg_app_sl_msgs`, a JSON list.
    - A re-delivered round replaces its own entries.
    - The oldest entries are dropped when the list passes 30 000 characters.
    - **Nothing is stored without `APP_SHELL_URL`**: no app means no app choices to re-mark, so the chat path writes no extra Settings row.
    - The hook runs in its own try, so a failure only adds an audit row (`tg_app_msgs_error` / `tg_render_onsent_error`), and the chat delivery itself (including the plain-text fallback decision) is unchanged.
15. **How the refresh works.** `tgAppRefresh(trip, run, keys)` makes one `editMessageReplyMarkup` per remembered message that holds a changed key.
    - It re-marks the whole keyboard from the Choices tab with the same "• " marks the `sl:` callback puts on a tapped message (`tgCmdRemark`), so the chat and the app agree even when taps came from both.
    - It uses `editMessageReplyMarkup` rather than `tgEdit`, because the text does not change and re-sending it could hit a "message is not modified" error.
    - `choose_many` edits each message at most once.
    - Failures are counted in `refreshed`, never thrown.
16. **The `web_app` button is stored inside `kb` too** (its url contains `WEBAPP_URL`, in the owner's private Settings tab, never in git). If `APP_SHELL_URL` changes later, a refreshed old message keeps the old app url until the round is re-delivered. This is acceptable: the menu button and all new messages use the new url.

## Flow operations
17. **`shortlist.choose` / `choose_many`.**
    - Both use the `sl:` callback's lookup: `tgPlanRunTrip`, then the item by key, with a later round winning a key. They store `tgChoiceSet(trip, run, 'shortlist', slug, w|l|s, name)`.
    - The flow reads the taps from Choices (`tgPlanTaps`), so the plan flow sees app choices with no extra event.
    - `choose_many` checks every entry first: one malformed entry refuses the whole call with 400. If a key appears twice, the last one counts. Unknown keys are listed under `refused` with `no_item`.
18. **`shortlist.more { run, gems? }`** is the choose stage's ➕ More options button, or 💎 More gems when `gems: true`.
    - It needs the trip's plan flow at stage `choose` with rounds left; otherwise it answers 409 `no_flow` / `no_more`. In the chat, More exists only inside a flow, so there is no adopt-from-nothing path here.
    - A run the flow does not hold is adopted first, with the chat's `adopt` event.
    - `started: true` once the stage is `research`.
19. **`shortlist.done` without a flow.** The app adopts and then finishes, exactly as ▶️ Continue choosing (`pl:sc`) followed by ✅ Done choosing would, but only when all of these hold:
    - there is no other flow (otherwise 409 `busy {flow}`)
    - the trip's status is `choosing`
    - the run is the trip's latest stored round (an older run → `no_flow`)
    - there is at least one ✅ pick (otherwise 400 `no_picks`, and nothing is started)
    - **With the trip's own plan flow at `choose`:** the same pick check, then the run is adopted if needed, then `done`.
    - **Answer:** `{ ok, started:true, adopted }` once the flow reached `planning`; the plan request is the chat's own (`tgPlanBuild`).
20. **`facts.get` / `facts.confirm`** need the trip's plan flow at stage `confirm` before the questions (`!ask`), the same window in which `tf:` taps count; outside it the answer is 409 `no_flow`. `home.pending_facts` is set exactly in that window.
    - **Choice values.** Taps are stored as `tgChoiceSet(trip, 'intake', 'fact', n, y|n, '')`. Edits are stored after the taps as `'e'` with the text, so an edit wins over a tap on its fact, as in the chat. The edit text passes the plan's checks (≤ 300 characters; an ISO date in a dates fact must pass `tgPlanDatesProblem`). In `facts.get`, an edited fact shows `choice:'y'`, `edited:true`, its new text (and its parsed dates) and the `original`.
    - **The batch advances the flow by default:** after storing, it presses ▶️ Continue (`go`), as the chat's "all confirmed" step would. The questions (or the research) then continue in the chat.
    - **It does not advance when any entry was refused**, so the owner can fix the entry in the app, **or when the call sends `advance: false`**.
    - `done` = the facts stage is over.

## The interview
21. **`interview.bank`** answers `TG_INTERVIEW_BANK` exactly as generated. `answers` are those of an interview in progress in the chat (its `state.ans`, in its question order), else `[]`, plus `in_progress`.
22. **`interview.submit` maps values exactly as the chat flow does (`_tgIvAnswer`).**
    - For `scale` and `pick`, exactly one option value.
    - For `multi`, option values in the options' order, then typed values, which are allowed only when the question has `other`.
    - For `text`, the typed values.
    - **A typed "other" value takes the polarity of the question's first option and `kind: 'text'`**, as the chat does (`11_flow_interview.js`). The coordinator's note said `'+'`. Following the chat keeps both paths identical: on `food-02`, `food-03`, `activities-03`, `mobility-04` and `lodging-03` the first option is `-`, so a typed allergy or dislike stays a dislike.
    - Duplicates are dropped.
    - The whole set goes out in bank order as one `prefs` request with the same payload `{ interview: { version: 1, answers } }`. The request text is `interview answers (N) · app`, and the ack line says "from the app".
23. **Values are checked, not trimmed.** The chat trims silently; the app has a form and refuses instead. Whitespace is folded, then:
    - an empty value is `bad_value`
    - more than 60 characters is `too_long {qid, max:60}`
    - more than 5 typed values is `too_many`
    - an unknown qid is `unknown_qid`
    - a question given twice is `duplicate_qid`
    - nothing answered is 400 `empty`
24. **An interview open in the chat is cancelled** when the app submits, because the app's form replaces it. Otherwise the chat flow would later send a second, partial `prefs` request.

## Brochure, trip, places
25. **`TG_APP_BROCHURE_MAX_CHARS = 200 000`** (the TG-PHASE-9 default; the pilot never measured a brochure).
    - The file must be inside the helper's Drive folder (`tgCmdDriveWhere`, the `/brochure` rule).
    - A file outside the folder is **refused** (`no_brochure`) with an audit row `tg_app_brochure_outside_root`, and no link is given, since a forged id must not hand out a link to another of the owner's files. A missing file is also `no_brochure`.
    - A file whose byte size is over 4 × the limit is answered as `{ link }` without being read. Otherwise the HTML is read, and above the limit the answer is `{ link: file.getUrl() }`.
26. **`trip.digest`** reads Trips, DayPlans and Later. `reason_text` comes from `TG_CMD_LATER_REASONS` (via `hasOwnProperty`), else the raw reason. `lodging` is `{ text, nights }` or `null`. A trip with no plan answers `days: []`, not an error.
27. **`places.search` has its own filter**, because the pack's `tgPlacesSearch` needs a query and caps at 25.
    - Matching and ordering are the same as `/places`: every query word must match the name, area, tags or slug, case- and accent-insensitively; the current trip's destination comes first, then names starting with the query, then names containing it, then by name.
    - Filters: `destination` and `status` match exactly; `tag` matches any tag case- and accent-insensitively.
    - With no query, the newest come first: by the later of `last_verified` / `last_researched`, then by the most recent row.
    - `total` counts the matches before the cut to 24. `filters` lists the distinct destinations, statuses and tags (≤ 200 each).
28. **`places.check`** works on stored places only (an unknown slug → 404 `no_place`), with duplicates dropped.
    - All the places must share one destination, else 400 `mixed_destinations`.
    - A place with no destination takes the current trip's destination; if there is none, the answer is 400 `no_destination`.
    - It opens one `places` request `{ scope:'check', destination, slugs }` with the `ps:` button's ack wording.

## Buttons into the app (caveats 2 and 3)
29. **The url** is `APP_SHELL_URL` + `?` (or `&` when the shell url already has a query) + `core=` + `encodeURIComponent(webAppUrl())` + `&screen=` + `&trip=`. It is read with `getProp(PROP.APP_SHELL_URL)`.
    - An unset property gives no button.
    - **A value that is not `https://…` gives no button and one audit row** (`tg_app_shell_url_invalid`, deduplicated), because `tgKeyboard` would throw on it (caveat 3) and break the chat message.
    - The setup step says which of the two cases applies.
30. **Where the buttons go.**
    - Shortlist: "📱 Choose in the app" (`screen=shortlist`) on the last message of a round. In adopt mode it sits before ▶️ Continue choosing, and the adopt branch's keyboard re-map (`tgPlanRowsOf`) now carries `web_app` and `url` buttons through (caveat 2, tested).
    - plan_digest: "📱 Open in the app" (`screen=brochure`) under the action row.
    - `/places`: "📱 Browse in the app" (`screen=places`, `trip=` the current trip, else empty) on both the overview and the search list.
    - **Without the property every message is byte-for-byte what it was.** The test strips the app row and compares the result with the property-less output.
31. **Setup step `app_menu_button`.** It calls `tgSetMenuButton(<url without screen/trip>, HELPER.display_name)`, which is "Tour Guide", and returns one line: "menu button set", "skipped: … not set", "skipped: … must be https" or "failed: <Telegram's description>".

Developed by: LightAISolutions
