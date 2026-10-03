# WP-S gas — Tour Guide Scout, core side: decisions and assumptions

Contract: `helpers/decisions/TG-SCOUT.md` §1, §2 (core side), §3 (payload), §6 (core). Files: `helpers/packs/tour-guide/gas/16_scout.js`,
`gas/35_scout_app.js`, one line in `gas/00_common.js`, the Scout screen in `live-site-pages/helper-app.html` (v01.06w), tests in
`helpers/tests/pack_tour-guide_scout_gas.test.js` (17 tests, invented Port Sorrel data, gas mocks only).

## Assumptions and readings of the contract

1. **helper.json is not edited here.** The pack's payloads test pins `envelope_types` to the seven existing types and requires a
   schema for every listed type (`PAYLOAD_KINDS`); the `scout` schema belongs to the engine work package. Adding the type here
   would break that test, so 16_scout.js registers the `scout` envelope handler only while `ENVELOPE_TYPES` contains `scout`
   (`registerEnvelopeHandler` throws for an unlisted type). Until the engine package lands, the core rejects `scout` envelopes as
   an unknown type (audited); `/scout`, `/scouts`, the `sc` buttons and the app ops work either way. The tests load the pack with
   the manifest plus `scout` and also check the pack still loads without it. Request R1 in `helpers/status/WP-S-gas.md`.
2. **Routing** uses `routineConfigured('SCOUT')` (URL **and** token), not the URL alone: a URL without its token cannot fire, so
   RESEARCH takes the request. Only `tgKindRoutine` changed in 00_common.js.
3. **Where.** `/scout <what> in <where>` splits on the last " in " (so "dim sum in a garden in Gull Bay" works); "near", "@" and a
   comma are accepted too. Without a place the current trip's destination is used and `destination`/`trip` go in the payload.
   With a place, `destination`/`trip` are added only when it names the current trip's destination (either slug contains the
   other); otherwise the request carries `query` and `where` only. No trip and no place → a usage reply, no request.
4. **➕ target trip.** The contract says "the current trip". A scout run for a trip that is still open adds to that trip; a scout
   whose trip is done or gone adds to the current trip; no trip → no ➕ buttons on the message, an alert on a stale button, 409
   `no_trip` in the app. The Later row uses reason `owner_choice`; the answer and its day buttons are the /places ➕ answer
   (`lt:` callbacks, so promoting it to a day reuses the existing replan path).
5. **Callback keys.** `sc:<scout_id>:<n>`. The longest legal id (`sc-` + 8 digits + 40) still fits 64 bytes, so the id itself is
   the key; a `k` + 12-hex hash form is accepted for robustness. `sc:<key>:s` (added) resends a scout's list from `/scouts`.
6. **Stored columns are exactly §6.** `from`, `diet` and `more` are validated but not stored (no column). Each stored pick keeps
   own fields only; its `maps_url` is kept only when the chat may show it (Google Maps host, ≤ 400 chars), else `''`. If
   `items_json` would pass the 50 000-char cell, `place_id` is dropped from the stored picks (never reached by a valid payload in
   practice: links are capped at 400 when stored).
7. **Validator.** Mirrors §3. Google fields are refused anywhere in the payload, matched case- and separator-insensitively against
   the pack's `TG_GOOGLE_FIELDS` plus the Places API's own names (`rating`, `userRatingCount`, `user_ratings_total`,
   `regularOpeningHours`, `priceLevel`, `reviews`, `location`, `photo`, `geometry`, …). `rated` is a band word: any digit in it is
   refused as a rating. An empty `items` list is valid ("nothing worth the trip this time"). `diet` is accepted for either group.
8. **The chat message** shows rank, linked name, 💎 (gem) / 🌱 (vegetarian verified or likely), area, reach ("🚶 7 min", "🚇 ~14
   min" when estimated) and why; then "Left out: 2 closed on your days · 1 off topic"; scores, the rating band and "try" stay on
   the board. One `web_app` button "📱 Open the board" → `?screen=scout&trip=<trip>&scout=<id>` (none without APP_SHELL_URL).
9. **App ops.** `scout.list` (no args; 20 newest + `total`), `scout.get {id}` (record + `add_to {slug,title}|null`),
   `scout.board {id}` (inline ≤ 900 000 chars and only for `text/html`, else the Drive link; outside the helper's folder → audited
   `tg_app_scout_outside_root`, 404 `no_board`; a `pdf_link` only when the PDF is inside the folder too), `scout.new {query, where?}`
   and `scout.add {id, n}` are `write: true` (taken under the script lock by the existing predicate). Registered by assigning into
   `TG_APP_OPS` from 35_scout_app.js; 32_app_api.js is unchanged.
10. **Shell.** Scout screen: form (what, where — blank = current trip), past scouts, a scout's board in `sandbox=""` srcdoc (as the
    brochure), picks with ➕ (only when there is a trip to add to) and "Map ↗", what was left out. Deep link `&scout=<id>` opens one
    scout. Checked by hand in a scratch Playwright run (390 px, no horizontal scroll, every tap target ≥ 44 px, the board's script did
    not run); the committed WP-9c Playwright test still passes unchanged.

Developed by: LightAISolutions
