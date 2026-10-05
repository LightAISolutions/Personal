# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with project-specific versioning (`w` = website, `g` = Google Apps Script, `r` = repository). Older sections are rotated to [CHANGELOG-archive.md](CHANGELOG-archive.md) when this file exceeds 100 version sections.

`Sections: 80/100`

## [Unreleased]

*(No changes yet)*

## [v01.79r] — 2026-10-05 12:06:57 AM EST

> **Prompt:** "This is a day plan that Claude Chat made for our Universal Studio Japan on 11/19/26 that I think is well-made and useful. Evaluate this as a reference and try to make Tour Guide's brochures as useful as this." — then, on the thirteen-item plan: "I approve of your plan"

### Added
- **Contract C18, wave 1** (`helpers/decisions/TG-PHASE-18.md`): brochures that read as instructions for the day — thirteen approved changes in three waves; wave 1 is items 2, 3, 4, 5, 6, 9 and 13
- **The kit renders C18** (`helpers/kits/brochure/`): the day's brief (Today's checklist: Must · Carry · Limits; Night before · This morning), bold fixed times with a "fixed" tag and a legend, field-note tips on stops and meals, named free windows with their length and nearby options, a "Getting out" box worked back from the departure with two scenarios and fallbacks, the clock setting on every time (`withHourCycle`, `clock(…, hc)`) and the temperature setting on the season page (`temperature`); `usesC18`, its schema and semantic checks; the C18 stylesheet only on C18 models, so every older model renders byte for byte (pinned by hash, Letter and A4); `retimeText` puts Google's 12-hour hours on the 24-hour clock when that is set; an invented fixture `fixtures/sample-trip-c18.json`
- **The planner's free options** (`helpers/packs/tour-guide/planner/planner-free.mjs`): a title and up to four nearby saved, Later or shortlisted places for each free window of 30 min or more (open, within 1.2 km, a round trip that fits), behind `input.c18`
- **brochure-map's C18 values** (`helpers/packs/tour-guide/brochure-map/brochure-map-c18.mjs`): fixed items, tips, the checklist, the morning countdown, the departure and the free windows from data the plan already has, behind `options.c18`; `clock` and `temp` options; an invented sample `brochure-map-sample-c18.mjs`
- **`/units`** (`helpers/packs/tour-guide/gas/47_units.js`): the brochure clock (24 h or 12 h) and temperatures (°C, °F or both), default 24 h and both; in `settings.get`, the snapshot (`tour_guide.display`), the commands guide with a form, and the app's Settings (Display)
- Schemas: DayPlan `free[].title`, `free[].options`; trip `day_overrides[].fallbacks` (needs the override's `end`)
- Tests: `kit_brochure_c18`, `pack_tour-guide_c18_planner_free`, `pack_tour-guide_c18_planner_plan`, `pack_tour-guide_c18_brochure_map`, `pack_tour-guide_units`, a Display test in `pack_tour-guide_commands17b_shell`

### Changed
- App v01.20w (`live-site-pages/helper-app.html`); the snapshot test expects `tour_guide.display`
- Docs: the kit README (C18), the pack README (`46_settings_app.js`, `47_units.js`), `helpers/BUILD-STATE.md` (row 18, the Phase 18 log, the status line)

## [v01.78r] — 2026-10-04 11:31:26 PM EST

> **Prompt:** "This is what the vegcard looks like" *(with a screenshot of the card that reached the chat; this push records that the owner merged the private side of the per-person card)*

### Changed
- `helpers/BUILD-STATE.md` row 14, the Live fixes log and Next, `helpers/decisions/TG-PHASE-14.md` §11 and `helpers/decisions/WP-14c.md` ("Per-person attribution"): the private repo's side of the per-person veg card (the re-pin to v01.75r; `loadProfile`'s `members` passed to `vegCard`) merged by the owner as the private repo's PR #28
- README timestamp

## [v01.77r] — 2026-10-04 11:04:42 PM EST

> **Prompt:** "There are a lot of commands (40+) to use with Tour Guide. That's too many for me to comfortably memorize and use effectively. Think of a way to imbed them into the app in the forms of buttons, forms, and other methods. Recommend me an action plan to approve." — then, on the eight-item plan: "1-8" *(step 17c of the approved plan: items 6 and 8)*

### Added
- **Answers that open in the app** (`helpers/packs/tour-guide/gas/45_commands_app.js`, `live-site-pages/helper-app.html`): guide forms name the screen their answer shows in (`opens`) and whether it comes later (`wait`), and `commands.list` passes both on; `commands.run` returns `opens: { screen, wait?, base?, trip? }` from `tgCmdOpens` (exact forms first, then templates; `base` is what the screen's list held before the run). The app opens that screen instead of the Sent page and, for a slow answer, shows a bar, reads the list every 10 s for up to 10 minutes and opens the first new item (at once if the owner is still there, otherwise through Open)
- **Five tabs and Today** (`live-site-pages/helper-app.html`): Home, Today, Discover (Scout, Day trips, What's on, Quiet, Menu, Compare), Places, More (Settings, Interview, Commands), with a second row for Discover and More; every old `?screen=` link kept and `?screen=today` added; the Today tab shows the current trip's day today with its buttons open (the first day before the trip)
- Tests: `pack_tour-guide_commands17c_shell` (the tabs and their second row, the deep links, Today on, before and after the trip, an answer watched until it lands, the bar's Open and ✕), `opens`/`wait` and the run op's `opens` in `pack_tour-guide_commands_app`; `shell_helper-app_17c.playwright.mjs` (the tabs, Today and a watched /quiet board in the browser, light and dark)

### Changed
- App v01.19w (`live-site-pages/helper-app.html`); the 17b shell test holds a watcher's 10 s timer instead of running it; the browser tests reach a screen through its second-row button (`shell_helper-app.playwright.mjs`, `shell_helper-app_compare.playwright.mjs`)
- Docs: `helpers/decisions/TG-PHASE-17.md` (§5 step 17c, §6 its defaults, §7 next), the pack README (`45_commands_app.js`), `helpers/BUILD-STATE.md` (row 17, the Phase 17 log, the status line)

## [v01.76r] — 2026-10-04 10:33:32 PM EST

> **Prompt:** "There are a lot of commands (40+) to use with Tour Guide. That's too many for me to comfortably memorize and use effectively. Think of a way to imbed them into the app in the forms of buttons, forms, and other methods. Recommend me an action plan to approve." — then, on the eight-item plan: "1-8" *(step 17b of the approved plan: items 3, 4 and 5)*

### Added
- **"What do you need?"** (`helpers/packs/tour-guide/gas/45_commands_app.js`, `live-site-pages/helper-app.html`): `TG_CMD_KEYWORDS`, plain search words for every guide command, sent by `commands.list` as each command's `keywords`; the app's box on Home (and the Commands tab's search) ranks commands by name, keyword and description, every word must hit, five at most on Home, and offers "Ask Tour Guide" (`/ask`) when nothing fits
- **Recent and ★ Pinned shortcuts** (`live-site-pages/helper-app.html`): every command run from the app is kept with its count in Telegram's per-user `CloudStorage` (`cmd_recent`, `cmd_pins`; `localStorage` outside Telegram), twelve of each; ☆ Pin on the Sent screen; pins then the most used on Home and at the top of the Commands tab
- **Buttons on cards** (`live-site-pages/helper-app.html`): the current trip (☀ Today, ⋯ More), another trip (Make current), a brochure day of the current trip (⋯ This day: Re-plan with the day filled in, Versions, Morning, Running late +15/+30/+60, Check-in, Route), a stop or a saved place (⋯: Route here and Compare forms with the name filled in, Quieter, Menu for food places, Notes); a form opened from a card goes back to it
- **Settings** (`helpers/packs/tour-guide/gas/46_settings_app.js`, new): app op `settings.get` (read only; never the API key's value); the app's Settings screen whose switches run their commands through the bot and read back, a morning time box (05:00–11:59), the profile, and a folded Helper health panel with the `/status` numbers and its buttons (Expire asks first)
- **`coreStatusCounts()`** (`helpers/core/11_commands_builtin.js`): the `/status` numbers as data, shared by `/status` and the health panel; the `home` op also returns `current_trip` (`32_app_api.js`)
- Tests: `pack_tour-guide_settings_app` (defaults, read-back after each command, smart without and with a key, the profile), `pack_tour-guide_commands17b_shell` (the page's own functions against the real bundle: search ranking and the ask fallback, Recent, Pinned and its caps, the Commands tab, trip, day and place buttons, Settings switches and the health panel), keywords for every guide command in `pack_tour-guide_commands_app`, the Settings screen in the nav test; `shell_helper-app_shortcuts.playwright.mjs` (Home, a brochure day and Settings in the browser, light and dark)

### Changed
- App v01.18w (`live-site-pages/helper-app.html`); the Places screen and the day cards call the new buttons only when present, so older test slices still run
- Docs: `helpers/decisions/TG-PHASE-17.md` (§3 step 17b, §4 its defaults), `helpers/SPEC.md` (`coreStatusCounts`), the pack README (`45_commands_app.js`, `46_settings_app.js`), `helpers/BUILD-STATE.md` (row 17, the Phase 17 log)

## [v01.75r] — 2026-10-04 10:09:28 PM EST

> **Prompt:** "This is what the vegcard looks like" *(with a screenshot of the card that reached the chat after v01.73r: it spoke for both travellers in one voice although their limits differed)*

### Fixed
- **The veg card spoke for every traveller in one voice** (`helpers/packs/tour-guide/vegcard/vegcard.mjs`, `vegcard-phrases.json`): the routine passed the party's merged diet, so a card for two travellers whose limits differed said "we are …" and "we also cannot …", and a server reading it could serve the wrong person the wrong thing. With `party.members` (one `dietOf()` result per traveller, owner first) each limit is now said for the person who has it: "I" for the owner; companions who say the same thing speak as one group ("my companion", "all my companions", "one of my companions", "2 of my companions"); a traveller with nothing to say is left out. The card stays one voice only when that is true: everyone says the same (the card and its fingerprint exactly as before) or only the owner has limits ("I", with the solo card's fingerprint). `ok` and the questions hold for everyone: the strictest diet's lines minus every extra limit, plus one "Does this dish contain …?" for the extra limits the diet's questions do not ask. A card past C14's bounds (a section over 12 lines, more than 12 English-only words, more than 12 travellers, the 8 000-character payload) is the merged card instead, stricter for each, never looser. Without `members` nothing changes
- **One verb for every limit** (`vegcard-phrases.json`): `intro.limits` and `avoid.also` now say 口にできません / "cannot have", since a limit can be drunk (alcohol), not only eaten; the new per-person lines use the same verb, the diet intros keep 食べられません (they list foods)

### Added
- **Per-person lines** (`vegcard-phrases.json`): the `who` names (私は / 連れは / 連れは全員 / 連れの一人は / 連れのうちN人は, "I", "My companion", "All my companions", "One of my companions", "N of my companions") and the `member.*` lines (a companion's diet, "also cannot have", "cannot have", "cannot have the following"). English-only words carry whose they are ("Me: …", "My companion: …"). On a per-person card the fingerprint appends `|m:` and its groups' signatures, sorted: moving a limit to another person changes it, the companions' order does not
- Tests: `pack_tour-guide_vegcard` (a vegetarian owner with a companion's limit; a companion who keeps the diet opens and the owner's own limit is "I"; a diet everyone keeps is "we"; identical members give the old card byte for byte, the reworded "also cannot have" included; only the owner with limits is "I"; words with no phrase say whose they are; too long per person falls back to the merged card; the per-person fingerprint), with a new invented party in `vegcard-fixture-party.json`. 1315 tests, 1314 pass, 1 skipped (the Maps live smoke); bundle and boundary checks clean

### Changed
- Docs: `helpers/decisions/WP-14c.md` ("Per-person attribution"), `helpers/prompts/TG-PHASE-14.md` (two amendment notes), `helpers/decisions/TG-PHASE-14.md` §11 (the retry reached the chat), the vegcard README and `index.mjs` example (the routine passes `members`), `helpers/BUILD-STATE.md` (row 14, the live fixes log, Next); README timestamp

## [v01.74r] — 2026-10-04 10:02:37 PM EST

> **Prompt:** "There are a lot of commands (40+) to use with Tour Guide. That's too many for me to comfortably memorize and use effectively. Think of a way to imbed them into the app in the forms of buttons, forms, and other methods. Recommend me an action plan to approve." — then, on the eight-item plan: "1-8"

### Added
- **Run any command from the app** (`helpers/core/10_router.js`, `helpers/packs/tour-guide/gas/45_commands_app.js`): core `runOwnerCommand(text, { via })` runs a registered command as if typed: it posts a silent "▶️ <code>text</code> · from the app" echo to the owner's chat and runs the handler with the echo as the message, so the answer threads under it (audited `owner_command_run`; `/start` stays chat-only; refusals `bad_text`, `not_command`, `unknown_command`, `chat_only`, `no_chat`, `send_failed`). App op `commands.run { text, nonce }`, a write op; a repeated nonce is answered `{ duplicate: true }` without running again
- **Forms from the registry** (`helpers/core/18_command_forms.js`, new): one template grammar for every helper (`{field}` required, `[ … ]` optional), `cmdTemplateParse`, `cmdTemplateFill`, `cmdTemplateMatches` and the field kinds (`HB_FIELD_KINDS`: trip, day, date, place, list, number, choice, time, text). Every Tour Guide command's guide forms carry a template, fields and `confirm` where the command changes or drops something; `commands.list` gives each form `run: now | form | type` and each command its fields; new op `commands.context` feeds the pickers (trips, the current trip's days, places, saved lists, brochure sections)
- **Telegram's "/" menu** (`helpers/core/11_commands_builtin.js`, `00_config.js`): `syncBotCommands()` registers the commands with `setMyCommands`, scoped to the owner's chat, in the pack's `command_menu` order, at setup (new step `bot_commands`) and on the first chat message after a deploy that changes the list (property `BOT_COMMANDS`)
- **The app's Commands screen runs commands** (`live-site-pages/helper-app.html`, app v01.17w): Run, Fill in or Edit beside each example's Copy; a form with a picker per field, a live preview of the exact command and Telegram's main button to run it; Telegram's confirm popup first for commands that change or drop things; "✎ Type your own…"; a Sent screen with Go to chat
- Tests: `core_command_forms` (the grammar, its refusals, fill, match), `pack_tour-guide_commands_app` (every template parses and every example fills its own template; run, refusals and the nonce; the context; the menu order with branch commands appended; the ISO dates the app sends answer exactly like a day number, M/D or "tomorrow" typed in the chat), `pack_tour-guide_commands_shell` (Run, confirm, refusal, nonce reuse after a network error, the Fill in form and its range check, Type your own), and the browser test `shell_helper-app_commands.playwright.mjs`. 1310 tests, 1309 pass, 1 skipped (the Maps live smoke); bundle and boundary checks clean

### Changed
- Docs: `helpers/decisions/TG-PHASE-17.md` (new: the 17a contract, the defaults chosen, 17b and 17c), `helpers/decisions/TG-COMMANDS.md` (Run beside Copy), `helpers/SPEC.md` (`runOwnerCommand`, `syncBotCommands`, the template functions), the pack README (`45_commands_app.js`), `helpers/BUILD-STATE.md` (row 17, its log, Next); README tree and timestamp

## [v01.73r] — 2026-10-04 06:13:44 PM EST

> **Prompt:** "I have created a new tour-guide discover routine and confirmed it shows up in my setup page. I tested it with /vegcard rebuild. This is the result. Telegram never posted any result, but the Routine seems to have completed. What's wrong? Fix it." *(with two screenshots: the bot's "Making the veg card…" with nothing after it, and the routine's finished run, its card written to the mailbox)*

### Fixed
- **An answer that needed a tab added after setup was lost in silence** (`helpers/core/03_store.js`, `00_config.js`): setup runs `ensureSheets()` once and a deploy never runs setup, so every tab and column a later phase registered (the veg card's `VegCards` among them) was missing from a Sheet set up earlier. Storing the card threw "Sheet tab missing", the envelope went to `archive/failed/` and the owner heard nothing after "🥗 Making the veg card…". Now the first run after a deploy that registers a new tab or column ensures them (`syncSheetSchemas`; the new property `SHEET_SCHEMA` keeps the fingerprint last ensured); `getSheet()` creates a registered tab that is still missing (audited `sheets_healed`, at most once a run; a tab nobody registered still throws); a write naming a registered column the tab lacks adds the column first instead of dropping the field; a tab another run created a moment earlier is taken as it is
- **`ensureSheets()` could overwrite a header** that came after a blank header cell (`helpers/core/03_store.js`): missing headers now go after the last header, never over one
- **The daily jobs ran on every sweep** (`helpers/core/03_store.js`): Sheets turned the stored `last_daily_date` text into a date cell, which read back as a timestamp that never matched today, so each sweep ran the daily jobs again and a routine's wake call could wait past its 30-second limit. Settings values are now written as literal text (numbers stay numbers), so a date, a time, `TRUE` or digits read back exactly as written
- **A failed answer now tells the owner** (`helpers/core/09_mailbox.js`, `12_wake.js`): when the answer to an open request throws in its handler and no other envelope of the same sweep answered that request, the request becomes `failed` and the owner hears once: "⚠️ Something went wrong on my side with “…”, so the answer did not come through. It is logged; please try again." A failed request gets no follow-up sweeps and no expiry notice, and a later valid answer still marks it `answered`. A failed envelope gives its dedupe key back, so a corrected copy under the same key is not dropped as a duplicate. A refused envelope stays silent, as before

### Added
- Tests: `core_store` (a missing registered tab is created on first use; a missing registered column on append and on update; no header overwritten after a gap, and the insert race; the deploy sync, once; Settings text read back exactly where Sheets types what it is given), `core_wake` (the daily jobs run once a day where Sheets types the stored date), `core_mailbox` (a throwing answer marks its request failed and tells the owner once, and a corrected copy under the same key is then answered; an answer later in the same sweep, or a refused envelope, stays silent), `pack_tour-guide_vegcard_gas` (a Sheet made before the VegCards tab: the first run after the deploy creates it and `/vegcard rebuild` gets its card; the backstop when the tab goes missing mid-run). The test harness can type cells the way Sheets does (`ss.autoType`). 1294 tests, 1293 pass, 1 skipped (the Maps live smoke)

### Changed
- Docs: `helpers/SPEC.md` §2 (a failed envelope releases its dedupe key), §3 (a failed request), §7 (`SHEET_SCHEMA`), §8 (how the core keeps the Sheet in step after a deploy; Settings as text; the `failed` request state); `helpers/decisions/TG-PHASE-14.md` §11 (the Discover routine is live and its first answer); `helpers/BUILD-STATE.md` row 14, a live fixes log and Next; README timestamp

## [v01.72r] — 2026-10-04 05:39:39 PM EST

> **Prompt:** "I would like my Tour Guide app to include a tab called "Commands" that goes over all the commands I can give Tour Guide and what each of them do."

### Added
- **The app's Commands tab** (`live-site-pages/helper-app.html` v01.16w, `helpers/packs/tour-guide/gas/45_commands_app.js`): every command the bot answers, grouped by purpose (Get started, Plan a trip, Your trip and its days, On the day, Discover, Places and lists, After the trip, Ask and settings, Housekeeping), each with what it does and examples with what each means; a search box (a command's name by its start, its description and examples by whole words); a tap on an example copies it to paste in the chat; and what works without a command. App op `commands.list`
- **`listCommands()`** in the core (`helpers/core/02_registry.js`): every registered command, sorted, with the help line it was registered with. The tab is built from it at request time, so it lists exactly what the bot answers; a command with no description yet shows under "More" with its `/help` line
- `helpers/decisions/TG-COMMANDS.md`: the contract and the defaults chosen
- Tests: `pack_tour-guide_commands_app` (every registered command described once, the op follows the registry), `pack_tour-guide_commands_shell` (the screen: nav, render from the real op, search, copy on tap, refusals)

### Changed
- `helpers/tools/branch-templates/core.js.tmpl`: a new branch's header lists its line in the Commands tab among what is still written by hand (until then it shows under More)
- Docs: `helpers/SPEC.md` (the `listCommands` row), the pack README (`45_commands_app.js`), `helpers/BUILD-STATE.md` (Commands tab log, Next); the README tree, the app's version in it and the timestamp

## [v01.71r] — 2026-10-04 05:18:49 PM EST

> **Prompt:** "… 13. Quiet: Approve 14. Menu check: Approve … 19. Day trip: Approve · note: I have not finalized my entire trip yet, so I may use this function for a different city. 20. What's on: Approve · note: I have not finalized my entire trip yet, so I may use this function for a different city. …" *(excerpts of the owner's answers on the project's morning review; this push records that the owner merged the private side of Phases 15 and 16, one pull request for the four commands)*

### Changed
- `helpers/decisions/TG-PHASE-16.md` §6 and §7: the private repo's side (WP-16p) built and stacked onto the private repo's PR #27, then merged by the owner: the `quiet` and `menu` skills, the routing, plans that apply `state.json` → `menu_checks` in memory only; the menu skill's refusal rules (no facts on the place yet is the expected skip; any other refusal, and an `unknown` check, each send the owner one reply); the coordinator's review fix (the menu skill stamps its envelopes before its memory commit, so its log line names their ids); no framework requests
- `helpers/decisions/TG-PHASE-15.md` §6: the private repo's side (WP-15p) merged by the owner on the same pull request
- `helpers/BUILD-STATE.md` rows 15 and 16, the Phase 15 and Phase 16 logs and Next; README timestamp

## [v01.70r] — 2026-10-04 09:23:02 AM EST

> **Prompt:** "… 13. Quiet: Approve 14. Menu check: Approve …" *(excerpts of the owner's answers on the project's morning review; Quiet and Menu check follow Phase 15 and come before the rehearsal; this push is Phase 16's framework side)*

### Added
- **Quiet** (item 13, Contract C16, WP-16a; `helpers/packs/tour-guide/quiet/`, `gas/43_quiet.js`, `gas/38_quiet_app.js`, `schemas/tour-guide-quiet.schema.json`): `/quiet <place> [on <date>]` opens a `quiet` request (the date words are `/daytrip`'s; `/quiet` alone lists the coming days' stops a 🕊 would be offered for, then the last boards). The engine screens the places found near a crowd magnet in order (the magnet itself, a duplicate, not the same kind, closed, closed on the day, a low rating, unproven, the party's diet, also busy, not quieter, too far), scores the rest on how much quieter they are (the ratio of the Aggregate counts, on a log scale), quality, fit, local word and reach, and keeps 3 with `more` and what was left out; `isBusy` is Phase 11's crowd-magnet rule, `pickRadius` the smallest radius with enough places, `quietLine` the magnet's quiet hours and a locals' tip. The core stores the board in a Quiet tab and sends one card (each place's reach and why it is quieter, the magnet's quiet line, ➕ to the trip's Later list with reason `owner_choice`, which a rebuild keeps, and 📱); the app's Quiet screen (`quiet.list`, `get`, `add`, `new`, `day`)
- **Menu check** (item 14, Contract C16, WP-16b; `helpers/packs/tour-guide/menu/`, `gas/44_menu.js`, `gas/39_menu_app.js`, `schemas/tour-guide-menu.schema.json`): `/menu <restaurant> [on <date>]` opens a `menu` request; the check, read from the restaurant's own site only, lists the dishes that fit or to ask about with their prices, how many others do not fit, its sources and a fits word (`yes`, `partly`, `no`, `unknown`). The core stores it in a Menus tab and sends one card; for each planned dinner at that place it offers 🔁 Re-plan when the dinner does not fit or when the check counts for that day (made at most 30 days before the dinner, as the planner ages a menu), and otherwise names the day from which a new check would count. `state.json` → `menu_checks` (the last 30 days), so a plan can apply a check before it reaches memory; `menuFact` gives the place's `facts.menu`; the app's Menu screen (`menu.list`, `get`, `new`, `replan`, `day`)
- **🕊 and 🍽 under a day** (C16's hooks, the coordinator's skeleton; `tgCmdDayRows` in `gas/10_commands.js`, `gas/18_morning.js`): the day card and the morning message show up to two 🕊 rows for stops the planner timed around the crowds or warned about, then a 🍽 row for a dinner whose note carries the planner's menu caveat; a tap asks, or resends the board or check that already counts; a failing row function is audited and left out, and a day without such stops keeps the keyboard it had. `noQuietSlotText` (`planner/planner-crowd.mjs`) holds the planner's no-quieter-slot warning, word for word, so the core can read the stop's name back
- App v01.15w (`live-site-pages/helper-app.html`): the Quiet and Menu screens, and the day view's 🕊 and 🍽 buttons
- Tests: `pack_tour-guide_c16_hooks`, `pack_tour-guide_quiet{,_app,_engine,_gas}`, `pack_tour-guide_menu{,_app,_engine}`. 1273 tests, 1272 pass, 1 skipped (the Maps live smoke); in a copy laid out like helpers-dist, 1235 pass, 38 skipped

### Changed
- **C16 in the validators and the schemas**: `quiet` and `menu` join the pack's envelope types and request kinds (the three pinned type lists, marked C16), both discovery kinds (the Discover routine when one is configured, else trip research); `KINDS.quiet` runs `checkQuiet` and `KINDS.menu` runs `checkMenu`, so the envelope tool refuses what the core refuses
- **An old menu check** (the coordinator, found by the probe): a check resent after the day from which a new check would count now says that it is too old to count and to check again, on the card, in `menu.get` and on the app's Menu screen
- Docs: `helpers/SPEC.md` §16 (the C16 skeleton, WP-16a and WP-16b paths), the pack README (Quiet, Menu check, the new tests); decisions and status for WP-16a and WP-16b, `helpers/decisions/TG-PHASE-16.md`; `helpers/prompts/TG-PHASE-16.md`; `helpers/BUILD-STATE.md` rows 15 and 16, the Phase 15 and Phase 16 logs and Next; the README tree, the app's version in it and the timestamp
- `helpers/decisions/TG-PHASE-15.md` §6 and §7 and `helpers/BUILD-STATE.md`: the private repo's side of Phase 15 (WP-15p) is open for the owner as PR #27, with its three framework requests

## [v01.69r] — 2026-10-04 06:53:49 AM EST

> **Prompt:** "… 19. Day trip: Approve · note: I have not finalized my entire trip yet, so I may use this function for a different city. 20. What's on: Approve · note: I have not finalized my entire trip yet, so I may use this function for a different city. …" *(excerpts of the owner's answers on the project's morning review; the owner then chose on a decision card to build both before the trip; this push is Phase 15's framework side)*

### Added
- **Day trip** (item 19, Contract C15, WP-15a; `helpers/packs/tour-guide/daytrip/`, `gas/41_daytrip.js`, `gas/33_daytrip_app.js`, `schemas/tour-guide-daytrip.schema.json`): `/daytrip [from] <place> [under <N> min|h] [on <date>]` opens a `daytrip` request (no place: from where the current trip stays; the one-way limit 90 minutes by default, 30–180). The engine screens candidates in order (a duplicate, no train or bus, too far, closed on the day, out of season), scores the rest and keeps 8 with `more` and what was left out; the ride comes from the one rail estimator. The core stores the board in a DayTrips tab and sends one card (each trip's ride and length, its reason and season line, ➕ to keep, 📱); on a trip with planned days a kept trip can be put on a day, which opens one re-plan with `daytrip: { board, n }`. `/daytrips` lists the last boards, kept trips first; `state.json` → `daytrips_kept`; `dayTripOutlineEntry` turns a kept trip into the planner's full-day outline entry; the app's Day trips screen (`daytrip.list`, `get`, `keep`, `new`)
- **What's on** (item 20, Contract C15, WP-15b; `helpers/packs/tour-guide/whatson/`, `gas/42_whatson.js`, `gas/34_whatson_app.js`, `schemas/tour-guide-whatson.schema.json`): `/whatson [in] [<place>] [<when>]` opens a `whatson` request for a window of at most 31 days (the trip's place and window by default). The board (light-ups, special openings, festivals, markets, exhibitions, performances, holidays and closures, each with its own page) is stored in a WhatsOn tab and sent as one card grouped by first day: ➕ chooses an item for a day (asking which day when it runs over several), and 🔁 opens one re-plan of a planned day with `whatson: { board, item }`. `/whatson last`; `state.json` → `whatson_chosen`; `toSeasonEvent` and `mergeChosen` carry a chosen event into the season sheet; the app's What's on screen (`whatson.list`, `get`, `choose`, `new`)
- **The weekly What's on check** (alarm `tg_whatson`, on by default): from 21 days before a trip starts, at 09:00 in the trip's zone and then weekly, a quiet `whatson` request with `auto: true` for the trip's window; a board with nothing new stays silent, one with new items sends "New on in <place>" with only those; it waits an hour while a request is open; `/whatson auto on|off`
- **One choice per trip and place** (the coordinator; `gas/42_whatson.js`, `gas/34_whatson_app.js`): an item is chosen on one board at most, and every board of the same trip and place shows that choice (the card's ✅, the app's `chosen_on` and `choices`, the counts in `/whatson last` and `whatson.list`). Choosing it on another board moves the choice there, ✅ on any of them removes it everywhere, the re-plan names the board that holds it, and `whatson_chosen` lists an item of a trip and place once
- **The evening** (change E; `planner/planner-evening.mjs`): events chosen for an evening are offered first on their day with `chosen: true`; an event under way when the day's stops finish is offered from then, not from its start; a 10 km radius with its warning; `isEveningChoice`; the day card and the app show ⭐ under "This evening" for a chosen event
- App v01.14w (`live-site-pages/helper-app.html`): the Day trips and What's on screens, and ⭐ "This evening" in the day view
- Tests: `pack_tour-guide_daytrip{,_app,_engine,_gas}`, `pack_tour-guide_whatson{,_app,_engine,_evening}`; the rail band's assertions in the existing tests. 1202 tests, 1201 pass, 1 skipped (the Maps live smoke); in a copy laid out like helpers-dist, 1177 pass, 25 skipped

### Changed
- **The rail estimate for 15–40 km rides** (`planner/planner-rail.mjs` `rideMinutes`): a ride in that band no longer costs more than a 41 km one (8 km → 31 min, 15 → 49, 25 → 50, 35 → 62, 40 → 68, 41 → 70); Scout's `estimateReach` and Day trip use the same estimate
- **C15 in the validators, the schemas and the season sheet**: `daytrip` and `whatson` join the pack's envelope types and request kinds (the three pinned type lists, marked C15); `KINDS.daytrip` runs `checkDaytrip` and `KINDS.whatson` runs `checkWhatson`, so the envelope tool refuses what the core refuses; a season event may carry `chosen_on` (from ≤ chosen_on ≤ to) and the season sheet takes `exhibition` and `performance` (also on the brochure's season page and in its schema, and in the journey's evening kinds); the day plan's and the plan digest's evening extras may carry `chosen: true`; the app's day view keeps it
- Docs: `helpers/SPEC.md` §16 (the WP-15a and WP-15b paths), the pack README (Day trip, What's on, the new tests), `season/README.md`; decisions and status for WP-15a and WP-15b, `helpers/decisions/TG-PHASE-15.md`; `helpers/prompts/TG-PHASE-15.md`; `helpers/BUILD-STATE.md` rows 14 and 15, the Phase 14 and Phase 15 logs and Next; the README tree, the app's version in it and the timestamp
- `helpers/decisions/TG-PHASE-14.md` §11 and `helpers/BUILD-STATE.md`: the owner merged the private repo's wave 2 (PR #26)

## [v01.68r] — 2026-10-04 04:30:06 AM EST

> **Prompt:** "… 11. Save this place: Approve · note: Instead of forwarding a Google Maps share link to the bot, I'd like to give Tour Guides access to my existing Google lists to organize, maintain, and integrate with Tour Guide's Places. … 19. Day trip: Approve · note: I have not finalized my entire trip yet, so I may use this function for a different city. 20. What's on: Approve · note: I have not finalized my entire trip yet, so I may use this function for a different city. …" *(excerpts of the owner's answers on the project's morning review; this push lets a routine fetch the owner's Takeout export from Drive (item 11, Phase 14's WP-14f) and adds the brief for Day trip and What's on (items 19 and 20, which the owner chose to build before the trip))*

### Added
- **The Takeout fetch** (Contract C14, WP-14f; `gas/28_lists.js`, `helpers/packs/tour-guide/lists/lists-fetch.mjs`): the core's `?route=takeout` (POST, authenticated like `?route=upload` by the `upload_key` of an open or just-answered `lists` or `research` request) lists the owner's newest Google Takeout exports (at most three, newest first) in the `Takeout` folder at the top of Drive and its direct subfolders, and hands one part's exact bytes to the routine; it never changes Drive. A part over 10 MB or an export over 30 MB is marked too large, one request may download at most 10 parts, and every refusal is audited. `lists-fetch.mjs` (no dependencies; curl, so the environment's proxy applies) writes the newest export's parts into a scratch folder, checks every size, removes what it wrote when a part fails and never prints the key; `--newer-than <stamp>` skips an export already read (exit 0 fetched, 2 nothing newer, 1 a failure). The Drive connector would have handed an archive over as base64 text to copy by hand, where one wrong character corrupts a zip
- **An export in parts**: `readSavedExports(parts)` reads one export that Takeout split into several files (a `.zip` and a `.tgz` alike), merging lists by name in part order, with the limits holding for the export as a whole
- **Automatic pickup**: once a `lists` request has been answered, a daily check opens one `lists` request when a newer export lands in Drive (never while one is open); `/lists auto on|off`; `/lists` shows the newest export's day and size and whether new exports are read automatically
- **Compare's cut before the lookups**: `compareCut` is exported from the Scout engine, so a routine can cut a long list to ten places (those in the asked place first, then the most recently saved) before it spends Maps lookups; `rankScout`'s `already_cut` adds the places cut that way to `more`
- **The brief for Phase 15** (`helpers/prompts/TG-PHASE-15.md`): Day trip (`/daytrip`, a ranked board of day trips from any base) and What's on (`/whatson`, what is on in any city on given dates, official pages first), Contract C15 (the `daytrip` and `whatson` envelopes and request kinds, chosen events and kept day trips in the plan), and a rail fix so that a 15–40 km ride no longer costs more than a 41 km one
- Tests: `pack_tour-guide_lists_{takeout,fetch,parts}`, `pack_tour-guide_compare_cut`; the harness's `putTakeout` puts a binary file into the mock Drive. 1108 tests, 1107 pass, 1 skipped (the Maps live smoke); in a copy laid out like helpers-dist, 1095 pass, 13 skipped

### Changed
- `/lists sync` looks for an export in Drive first: without one it sends the steps to make one instead of opening a request that would find nothing; with one, the request carries the export's stamp
- Docs: `helpers/SPEC.md` §3 and §6 (the `takeout` route) and §16 (the WP-14f paths); the pack README (`28_lists.js`, Lists) and `lists/README.md` ("Fetching the export", parts, the daily check); `helpers/decisions/TG-SCOUT.md` §11 (`compareCut`, `already_cut`); decisions and status for WP-14f, `helpers/decisions/TG-PHASE-14.md` §12; `helpers/BUILD-STATE.md` rows 14 and 15, the Phase 14 and Phase 15 logs and Next; the README tree and timestamp

## [v01.67r] — 2026-10-04 03:32:45 AM EST

> **Prompt:** "… 11. Save this place: Approve · note: Instead of forwarding a Google Maps share link to the bot, I'd like to give Tour Guides access to my existing Google lists to organize, maintain, and integrate with Tour Guide's Places. 12. Compare saved places: Approve · note: Having Tour Guide integrated with my existing Google Maps lists would also allow decision #12's compare saved places function to do more. … 16. One Discover routine: Approve …" *(excerpts of the owner's answers on the project's morning review; the owner then chose the Takeout route for the lists on a decision card; this push is Phase 14's wave 2, its items 11, 12 and 16)*

### Added
- **The owner's saved Google Maps lists** (Contract C14, wave 2; `helpers/packs/tour-guide/lists/`, `gas/28_lists.js`): a reader for a Google Takeout "Saved" export (a `.tgz`, a `.zip` or one `.csv`, one list per CSV file; a damaged archive reads as partial and never throws; at most 100 lists, 2,000 places a list and 10,000 in all), a link parser that tells a place's Google id, a place id, a name, a dropped pin and a short link apart and refuses lookalike hosts, and a merge that matches the owner's places by Google id, place id or name, adds and drops list names, deletes nothing, holds a link it could not resolve for 30 days and quarantines a note that reads like instructions. A looked-up place is accepted only on the same Google id or place id, or the same name within 300 m of the saved pin, never from a short link; a new place files under the known destination whose 20 km circle holds it, else under its locality. `/lists` shows the owner's lists, `/list <name>` the places on one grouped by destination, and `/lists sync` asks for a fresh read; the Places tab gains a `lists` column (absent keeps it, an empty list clears it) and a place file its `lists`, `list_notes` and `cid`; the app's Places screen has a list filter beside the tag filter (`places.search` `list` and its `lists` facet; `live-site-pages/helper-app.html`, app v01.13w)
- **Compare** (`gas/29_compare.js`, `helpers/packs/tour-guide/compare/`, `helpers/decisions/TG-SCOUT.md` §11): `/compare <a>, <b>[, <c>, <d>] [in <place>]` or `/compare <list> [in <place>]` opens a `compare` request, answered by a `scout` envelope in compare mode (no new envelope type): up to ten places side by side with Scout's scores and parts (`more` counts the rest), each place's warnings as flags (closed, closed on the trip's days, too far, the diet not confirmed and the rest of Scout's screens), a place with a hard flag sorted last, and the names not found first among those left out. The core sends a ⚖️ card with a ⚠️ line per warning and the ➕ buttons, keeps the mode and source in the Scouts tab (`mode`, `source_json`), and `/scouts` marks a compare board ⚖️; the board and the app's Scout screen are titled "Compare — <source>" with no topic bar
- **One Discover routine** (`TG_DISCOVER_KINDS` in `gas/00_common.js`): when a `DISCOVER` routine is configured, the discovery kinds (`scout`, `compare`, `lists`, `vegcard`) go to it, so they never wait behind trip research; without it, routing is unchanged. `new-branch.mjs --discover` makes a new branch's kind a discovery kind, and `--check` reports it
- Tests: `pack_tour-guide_lists{,_engine}`, `pack_tour-guide_compare`, `pack_tour-guide_p14e_{compare,routing}`; `tools_new_branch` covers `--discover`. 1082 tests, 1081 pass, 1 skipped (the Maps live smoke); in a copy laid out like helpers-dist, 1069 pass, 13 skipped

### Changed
- Docs: `helpers/SPEC.md` §16 (the wave 2 paths), the pack README (the lists and compare modules, the discovery kinds, the Places tab's `lists` column), `helpers/tools/README.md` (`--discover`), `helpers/decisions/TG-SCOUT.md` §11; decisions and status for WP-14d and WP-14e, `helpers/decisions/TG-PHASE-14.md` §§8–11; `helpers/BUILD-STATE.md` row 14, the Phase 14 log and Next; the README tree, the app's version in it (it had stayed at v01.11w since v01.66r) and the timestamp
- `helpers/decisions/TG-PHASE-14.md` §5 and `helpers/BUILD-STATE.md`: the private repo's side of wave 1 is open for the owner (PR #25)

## [v01.66r] — 2026-10-04 02:22:08 AM EST

> **Prompt:** "… 7. Scout ranking tune-up: Approve … 10. Veg card: Approve … 15. Branch scaffold: Approve … 22. Companion view: Not now · note: For now, just outputting a nice downloadable PDF of the brochure should suffice. …" *(excerpts of the owner's answers on the project's morning review; items 1–6 and 8 were Phase 13; this push is Phase 14's wave 1, its items 15, 7, 10 and 22's note)*

### Added
- **The branch scaffold** (`helpers/tools/new-branch.mjs`, `helpers/tools/branch-templates/`, `helpers/tools/README.md`): `node helpers/tools/new-branch.mjs <name>` writes a new pack branch from templates (the core module with its command, request kind and routing, the app ops, the payload schema and validator, an invented fixture, a test, and the private skill with its drivers), and `--check <name>` checks an existing branch part by part (exit 0 complete, 1 missing, 2 usage error or clash). `--no-envelope`, `--no-tab` and `--no-app` leave parts out, and the `@branch` line in the core module tells `--check` what was left out on purpose; `--dry-run` writes nothing; `--force` rewrites only a branch the generator wrote. A clash with an existing command, kind, type, tab, op or file number is refused with nothing written
- **The veg card** (Contract C14; `helpers/packs/tour-guide/vegcard/`, `gas/27_vegcard.js`, `gas/37_vegcard_app.js`, `schemas/tour-guide-veg-card.schema.json`): the party's diet as short lines in the local language and English to show staff, built from the travellers' diets (the strictest member's), with the questions asked most and a fingerprint over its content; Japanese for now, an English-only card elsewhere. `/vegcard` shows the stored card or asks for one and `/vegcard rebuild` asks again; the core keeps one card per trip in a VegCards tab and sends it only when it answers a request or changed; the morning message links it on full and free days ("🥗 Veg card — /vegcard"); the app has a full-screen Veg card screen (🥗 on the trip row, "hide English") through `vegcard.get`; `vegCardHtml` is a printable page for the brochure's end. `veg_card` is the pack's eleventh envelope type
- **A PDF button on the app's brochure screen** (`brochure.pdf`): sends the trip's stored PDF to the chat as a document, or starts a brochure build when there is none; a PDF outside the helper's folder is refused and audited; once a minute (`live-site-pages/helper-app.html`, app v01.12w)
- Tests: `tools_new_branch`, `pack_tour-guide_p14b_scout`, `pack_tour-guide_vegcard{,_gas,_app}`. 1024 tests, 1023 pass, 1 skipped (the Maps live smoke); in a copy laid out like helpers-dist, 1014 pass, 10 skipped

### Changed
- **Scout's ranking** (`helpers/packs/tour-guide/scout/`; the contract change in `helpers/decisions/TG-SCOUT.md` §10): a fixed quality anchor per group (food 4.2, activities 4.3) instead of one taken from the pool; a chain (a name seen three times, or a known chain) loses 8 points and earns no local part, a crowd magnet loses 4; a new place with few ratings is rescued when its judgment vouches for it (relevance 0.7 or more, or a verified diet) and labelled new; drinks, cafés and markets are likely for a vegetarian party while meals stay strict; a place with no judgment gets a low fit and the label "not judged"; the local part travels in the payload and shows as a fifth bar on the board and on the app's Scout screen; reach uses the planner's own estimator (`estimateReach`: a walk up to 20 minutes, else a rail estimate), exported for the private driver. Old payloads still validate and display
- The three tests that pin the pack's envelope types and payload kinds now include `veg_card`; they stay pinned on purpose, so a new type is a reviewed contract change (`helpers/tools/README.md`)
- Docs: `helpers/SPEC.md` §16 (the Phase 14 paths), the pack README (the veg card, Scout's ranking, the new tests), `helpers/decisions/TG-SCOUT.md` §10; decisions and status for WP-14a–c, `helpers/decisions/TG-PHASE-14.md`, `helpers/prompts/TG-PHASE-14.md` (wave 2's briefs corrected against what wave 1 built); `helpers/BUILD-STATE.md` row 14, the Phase 14 log and Next; README tree, the app's version line and timestamp
- `helpers/decisions/TG-PHASE-13.md` §5 and §6, `helpers/BUILD-STATE.md` row 13 and the Phase 13 log: the owner merged the private repo's side of Phase 13 (PR #24); the trip's rebuild with its real stays and the rehearsal are next

## [v01.65r] — 2026-10-03 11:20:26 PM EST

> **Prompt:** "Why is this thread idle? What about the [trip] fixes?" *(the destination is redacted; this push follows v01.64r: the private repo's run of the vendored tests crashed on one file)*

### Fixed
- **The vendored copy of the tests runs clean** (`helpers/tests/pack_tour-guide_p13c_scouted.test.js`): the scouted-group test read the app page from `live-site-pages/`, which is outside `helpers/` and so not in helpers-dist, and the whole file failed to load in the private repo. The page test now skips when the page is absent. This repo: 978 tests, 977 pass, 1 skipped; a copy laid out like helpers-dist: 978 tests, 976 pass, 2 skipped

### Changed
- `helpers/decisions/TG-PHASE-13.md` §4 (the vendored run) and §8; `helpers/BUILD-STATE.md` Phase 13 log

## [v01.64r] — 2026-10-03 11:09:33 PM EST

> **Prompt:** "Why is this thread idle? What about the [trip] fixes?" *(the destination is redacted; this push is the framework side of the fix package the owner approved on the project's morning review — its items 1–6 and 8, Phase 13)*

### Added
- **Dated stays and Contract C13** (`helpers/packs/tour-guide/gas/26_lodging.js`, `helpers/SPEC.md`): `/lodging <name> <from> to <to>` adds, replaces and removes dated stays (1–12, sorted, no overlaps; the check-out date ends a stay) and `/lodging` lists them; every request that carries a trip update sends them as `trip_update.lodging` with the core's fingerprint `lodging_fp` (`lfp1:` + FNV-1a over the normalised stays). A plan built for other lodging shows "⚠️ This plan was built for different lodging. `/lodging` offers to re-plan the days that changed or to keep the plan." in `/trip`, the day card and the morning message while a stored day is still to come. The offer re-plans every stored day from the earliest night any change touched since the plan arrived; Keep the plan stops the line until the stays change again; a one-day `/replan` keeps the line; no lodging at all shows none
- **Scouted candidates as their own group** in `/places` and the app's Places screen, "🔎 Scouted, not chosen yet" (`scouted: true` on the places digest, a new last column in the Places tab; `live-site-pages/helper-app.html`, app v01.11w)
- **A companion's profile names them**: the prefs kit takes an optional subject on `apply` and `interview` and a new `refresh` command (`helpers/kits/prefs/`), used in the profile's heading, its opening line and the `/profile` count line; a kit-made profile is renamed on its next apply or refresh, a hand-edited one is still refused
- **Probe P** (`pack_tour-guide_p13_probe`): a four-day trip with two stays and a departure too early to fit, a booking at a day's edge, a place whose opening days vary and a menu never checked, through the planner, a two-part digest and the core, then a stay change and its re-plans, and Scout's request text
- Tests: `pack_tour-guide_p13_{coord,parity,probe}`, `pack_tour-guide_p13a_{facts_age,old_fixtures,timing,trip_breakers}`, `pack_tour-guide_p13b_{dinner,hours,rail_season}`, `pack_tour-guide_p13c_{dates,html,lodging,parity,reminders,scout,scouted,stale}` with `pack_tour-guide_p13c_world.js`, `pack_tour-guide_p13d_scout`, `kit_prefs_subject`; the invented Scout cases in `fixtures/p13d-scout/`. 978 tests, 977 pass, 1 skipped (the Maps live smoke)

### Fixed
- **The planner's trip-breakers** (`helpers/packs/tour-guide/planner/`): a departure day the plan cannot reach comes back without stops, with the `over_long_day` alert and its `/dates` fix, instead of failing the whole plan; an override whose end is not after its start is clamped with a warning; a booking at the edge of its day keeps its time and widens the day with an info line instead of going to Later; a booking dated outside the trip says so in Later instead of "closed on every day"; on a day with a hard end the last leg leaves as late as allowed, after free time near the last place; evening extras never start before the day's start
- **Hours and facts**: Google's "hours might differ" counts only for its own weekday; a place whose own site says its opening days vary is planned, with its own words as the stop's check line, and the journey no longer reads it as closed (`journey/journey-areas.mjs`); own facts checked more than 90 days before the plan's day add "facts are old" and a check line; fact dates use the local day
- **The vegetarian gaps**: dinners rank by their menu within each of the owner's ranks, and a menu never checked, unknown or older than 30 days says "menu not checked for <the diet>" on the day card and in the morning message (the planner now passes the day and the party's diet at all three dinner calls); under a hidden-stock diet rule Google's vegetarian flag alone no longer passes a Scout meal topic
- **Messages** (`helpers/packs/tour-guide/gas/`): a long line is cut only in its visible text, so a day card with many map links stays valid HTML; on a trip in a zone ahead of home the travel day gets one booking reminder, not two; a moving day's morning message shows the day's own start line instead of "Leave by"; a departure day's morning keeps its trains, end and alert before "Free day."; every `/dates` refusal about a day's length ends with one valid command; the pack's validator and the core's mirror agree on every free-text length bound
- **Scout** (`helpers/packs/tour-guide/scout/`, the core's Scout files): chat requests carry the owner's words as typed and the app writes "/scout <what> in <where>"; the ranked line marks a place seen before with 🔁; the board's hours cover every date the owner spends in that city; "<topic> near <area>, <city>" belongs to the city; a new place keeps its own name
- The shared test digest (`helpers/tests/harness/tour-guide-digest.js`) passes a stop's `check_on_day`, so the tests see the line the private digest builder already sends

### Changed
- **Season and rail**: roses run to November and autumn-flowering cherries from October to December (`season/season-bloom.mjs`); rail estimates between 40 and 150 km assume a conventional line (`planner/planner-rail.mjs`), so several between-town legs are longer
- Docs: `helpers/SPEC.md` (stays), the pack README (the day's shape, the stays row and paragraph, Scout's inputs, the new tests), `helpers/decisions/TG-SCOUT.md` §9, the prefs kit README; decisions and status for WP-13a–d, `helpers/decisions/TG-PHASE-13.md`, `helpers/prompts/TG-PHASE-13.md`; `helpers/BUILD-STATE.md` row 13, the Phase 13 log and Next; README tree, the app's version line and timestamp

## [v01.63r] — 2026-10-03 08:24:00 PM EST

> **Prompt:** "i merged PR#23 and typed /journey on, but I think it might have been before the push. What should I do now?" *(this push records that the owner merged WP-12e and switched on outlines and day versions)*

### Changed
- `helpers/decisions/TG-PHASE-12.md` §4 and §7: WP-12e merged by the owner as the private repo's PR #23, so the re-plan that rebuilds the owner's trip (the morning review's fix package) also fills the morning message's inputs
- `helpers/decisions/TG-PHASE-11.md` §5: the owner sent `/journey on`; the live check on the real trip still closes the phase (outlines need a dated trip of 3 days or more, a shorter one goes straight to day versions)
- `helpers/BUILD-STATE.md` rows 11 and 12, the Phase 12 log and Next; README timestamp

## [v01.62r] — 2026-10-03 08:12:40 PM EST

> **Prompt:** "decisions made." *(the owner's choices on the usefulness review; this push records that step 3's private side is merged and that a follow-up, WP-12e, is up as a pull request so one re-plan also fills the morning message's inputs)*

### Changed
- `helpers/decisions/TG-PHASE-12.md` §4 and §7: the private side merged (PR #22); WP-12e, a facts stage in the private plan run that fills the built days' place facts, the lodging's area and access and the trip's country code (a re-plan from where you are skips it), is up as PR #23 and should merge before the re-plan that rebuilds the owner's trip
- `helpers/BUILD-STATE.md` row 12, the Phase 12 log and Next; README timestamp

### Fixed
- This push's first attempt was also labelled v01.61r and crossed the Mini App push of the same number; the auto-merge kept the first attempt's side of the overlapping lines, so v01.61r's CHANGELOG section and its BUILD-STATE Next line were replaced. Both are restored verbatim here, and this push's entry is v01.62r

## [v01.61r] — 2026-10-03 08:05:52 PM EST

> **Prompt:** "The arrow button in the top right only makes the app go from a literal bar to the small window it started in. It does not go to full screen at all."

### Fixed
- **The Mini App shell's full-screen button never showed on Web K** (`live-site-pages/helper-app.html`, app v01.10w): the owner's screenshots at v01.09w show the masthead without ⤢ (the arrows he pressed are the client's own collapse/restore control in the window's title bar). Web K requests its Mini App URL with `platform: 'web'` (`src/lib/appManagers/appAttachMenuBotsManager.ts`), so `tgWebAppPlatform` is not `webk`/`weba` and `webFull()`'s exact match failed. The test is now `/^web/` on the platform string; the Bot API 8.0 and `requestFullscreen` checks stay
- README timestamp and the app's version line

## [v01.60r] — 2026-10-03 07:48:06 PM EST

> **Prompt:** "I retried it and it still opens small"

### Added
- **A full-screen button in the Mini App shell on the web clients** (`live-site-pages/helper-app.html`, app v01.09w): read from Telegram Web K's source (`src/components/browser.tsx`, `src/components/webApp.tsx`), a Mini App there is a floating, resizable window opened at a fixed 480×688, `web_app_expand` has no handler, and `web_app_request_fullscreen` maps to the browser's Fullscreen API on the window's body, which the browser allows only from a user gesture — so the v01.59r request on open failed (`fullscreenFailed`). The masthead now shows ⤢ on `webk`/`weba` (Bot API 8.0+): one tap calls `requestFullscreen()`, ⤡ calls `exitFullscreen()`; `fullscreenChanged` and `contentSafeAreaChanged` set `--safe-top` so the header pads by the client's overlay (`contentSafeAreaInset.top`, 56 px on Web K); `fullscreenFailed` shows a one-line status. `openWide` keeps `ready()` + `expand()` only
- README timestamp and the app's version line

## [v01.59r] — 2026-10-03 07:25:24 PM EST

> **Prompt:** "Aside from the decisions made in the Morning Decisions file, I want you to change the size that the app pops up in to match the screenshot. I am tired to manually expanding the app to cover the chatbox." *(followed by the owner's 24 decisions on the project's morning review, recorded in the project — not here)*

### Changed
- **The Mini App shell opens at full size on the web clients** (`live-site-pages/helper-app.html`, app v01.08w): `boot` now calls `openWide`, which keeps `expand()` for every client and, on `webk`/`weba` with Bot API 8.0 or later, asks for `requestFullscreen()` — the client's own full-size layout, the one the maximise button reaches — so the owner no longer enlarges the window by hand. Phones and the desktop apps are unchanged; a client that refuses fires `fullscreenFailed` and the app stays at the size it opened at. Not run live here: the Playwright shell test stubs Telegram, so the owner's next open on web.telegram.org is the check
- README timestamp and the app's version line

## [v01.58r] — 2026-10-03 07:10:25 PM EST

> **Prompt:** "decisions made." *(the owner's choices on the usefulness review; this push makes the five small framework follow-ups that step 3's private side asked for — none blocks the trip)*

### Added
- **`dropEvidence` in the prefs kit** (`helpers/kits/prefs/index.mjs`, the kit README's rule 10): takes held evidence back by ref and, optionally, a predicate; rewrites the notes it touched, deletes a note left with no evidence, and never writes the ledger or the profile, so a confirmed preference stays confirmed. Refs are required, so no predicate alone can empty the held notes. A second post-trip review can now replace the first without rewriting notes by hand
- **`undoTap` in the estimator** (`helpers/packs/tour-guide/estimator/`): `applyTap`'s exact inverse; a category left with no taps is removed and the key order is kept; nothing to take back returns the same state

### Fixed
- **A re-plan error read "from at 11:40"** (`planner/index.mjs`): when Maps could not serve a re-plan from where you are, the message said "could not re-plan <date> from at 11:40 from where you were"; it now reads "could not re-plan <date> at 11:40 from where you were: <why>" (reproduced first)
- **The fixture Maps responder echoed a shared point's coordinates** in its not-found error (`fixtures/fixture-responder.mjs`); it now says "that point"

### Changed
- The shared test digest's header (`helpers/tests/harness/tour-guide-digest.js`) now says that a place's own-facts lines (local name, address, payment, closing time, the dinner's price line) show whenever its facts have them, not only with C12 fields
- `helpers/decisions/TG-PHASE-12.md` §3, §4 and §7, `helpers/BUILD-STATE.md` row 12 and the Phase 12 log, the pack README's calibration lines; README timestamp. 882 tests (881 pass, 1 skipped); bundle and boundary clean. The private side adopts these at its next re-pin; its open pull request stays pinned to v01.56r

## [v01.57r] — 2026-10-03 06:57:30 PM EST

> **Prompt:** "decisions made." *(the owner's choices on the usefulness review; this push records step 3's private side: its pull request is up for the owner, to merge before the trip)*

### Changed
- **Phase 12's private side is up as a pull request** (`helpers/decisions/TG-PHASE-12.md` §4): what WP-12c built (the digest's C12 fields, re-plans from where you are, a lodging change, the research that fills the morning fields, a second review that replaces the first), the coordinator's fix to how a lodging change picks its nights (from the owner's own words; only the days they touch are re-planned; unclear words get one question), its checks, and five small framework REQUESTs for a later push; §7 updated to match
- `helpers/BUILD-STATE.md` row 12, the Phase 12 log and the summary; README timestamp. No code changed; 879 tests (878 pass, 1 skipped)

## [v01.56r] — 2026-10-03 05:10:35 PM EST

> **Prompt:** "decisions made." *(the owner's choices on the usefulness review; this push is step 3 — the morning message, running late, re-plans from where you are, the evening check-in, and a rehearsal of one trip day before the trip)*

### Added
- **The morning fields and re-plans from where you are** (WP-12a, Contract C12; `planner/planner-morning.mjs`, `planner/planner-restart.mjs`): every built day with a leg carries `leave_by` (its first leg's departure) and `areas` (the lodgings' towns); `replanDays` takes `from` (a stop of that day, or a shared point that becomes the reserved `here`, "where you were", whose coordinates reach only the Routes requests), `visited` and `rain`, and plans the rest of one day — visited stops keep their times, the history costs no Maps request, a place the day ran out of time for is a candidate again, and a re-plan without `from` is byte for byte the old one; rain puts covered places first (`planner/planner-rain.mjs`). Place facts gain `local_name`, `address` and `access` (station notes), lodgings `access` and `area`, the trip `country_code`; the digest carries them (day `leave_by` and `areas`; stop `visited`, `local_name`, `address`, `payment`, `close`; a transit leg's `stations`). Invented fixture `fixtures/rehearsal-day/`
- **The morning message** (WP-12b, `gas/18_morning.js`, `gas/15_weather.js`): the whole day, unasked, at 07:00 or the owner's `/morning at HH:MM`, or 30 min before leave-by when that is earlier; pinned silently; leave by, the weather (Open-Meteo, no key, credited; data CC BY 4.0, place names from GeoNames), paying, bookings, each stop with its local name, address, map and last entry, trains from the places' own access notes only, dinner with its local name, address and paying, the day's end and sunset; it reads in airplane mode. `/morning day N` rehearses any day; `/morning off|on`; `/dates <date> weather <town>|clear`
- **Running late** (`gas/19_late.js`): `/late <5–240>` and the ⏰ buttons move the rest of today later as an overlay, never an edit of the plan; booked and exact-time stops and the day's end stay put; a stop that no longer fits drops with its reason; ↩️ Undo; a new plan that changes the day clears it
- **Re-plan from here** (`gas/24_here.js`): 📍 on the trip's own day re-plans from the current stop, a location shared once (rounded, kept only in the request), or rain first; one `replan` request with `from`, `visited` and `rain`
- **The evening check-in** (`gas/25_checkin.js`): at 21:00, or 15 min after the day's planned end when that is later (22:30 at the latest), the day's stops with 👍 👎 ⏭ ⏩ 👌 ⏪ and ✅ Done; `/checkin day N` rehearses; `/review` skips stops already rated and, when all are, sends in one tap
- **The brochure's re-planned day** (WP-12d): visited stops shown as done; a leg "from where you were" with no origin and no coordinates anywhere
- **The rehearsal** (WP-12r): `helpers/tests/pack_tour-guide_phase12_rehearsal.test.js` plays one invented trip day through the planner, the digest and the core (the 06:59 morning message, running late, re-plans from the current stop and from a shared location, the 21:00 check-in, `/review` after the trip, home and trip zones); a lodging change now offers to re-plan the planned days it touches, or to keep the plan (`gas/26_lodging.js`). Also new: the C12 contract, planner C12, dates, gas C12, morning, late, here, check-in, brochure-map C12, undated-booking and brochure-kit C12 tests

### Fixed
- **A booked stop is a must on any plan** (`planner/planner-day.mjs`): a re-plan from mid-afternoon kept an unbooked museum and dropped the gallery booked for later, which then sat under "If you have energy" while the day card said booked; no fixture's first plan moved
- **A re-plan keeps the chosen dinner** (`planner/planner-dinner.mjs`): the dinner the plan had scheduled ranked below a saved-for-later one, so a re-plan swapped it
- **Paying said the same thing twice** in the morning message, and **a train leg joined with a walk read "walk"** after running late dropped the stop between them (both found by the rehearsal)
- **A digest with one long warning** was rejected whole: the shared test digest (`tests/harness/tour-guide-digest.js`) clips day warnings to 20 × 200 characters with "…"; the private builder follows (WP-12c)

### Changed
- **Dates in words**: Later reasons ("no room left on Thu 10 Jun for …", "closed on Mon 18 Oct"), journey plans and the brochure's "Taken off the plan for …" note name the day as the day card does, instead of `YYYY-MM-DD`; a stored reason keeps its text until the next build; the Bookings page reads "Sep", not "Sept"
- **The brochure's phone clock** sits whole beside a numbered stop badge (one rule in the phone layout; A4 pixel-identical; golden hashes moved deliberately)
- **A booking with a place and no date** shows on the first day its place is planned (the stop, the Bookings page, the day card and reminders: "planned for <day>"), never written into its date
- **The core ignores a location nobody asked for** on every pack (the hello pack used to answer "I only read text") and keeps a location out of deferred updates (`core/10_router.js`)
- `helpers/decisions/TG-PHASE-12.md` (merge choices, the coordinator's fixes, the checks, the old output that moves, what is carried on), `WP-12a.md`, `WP-12b.md`, `WP-12d.md`, `WP-12r.md`; `helpers/status/WP-12a.md`, `WP-12b.md`, `WP-12d.md`, `WP-12r.md`; `helpers/SPEC.md` §5; the pack, brochure-kit and facts READMEs; `TG-PHASE-11.md` §4–§7 (the private side merged); `helpers/BUILD-STATE.md` rows 11, 12 and S and the Phase 11 and 12 logs; README tree (including two older gaps, `planner-rain.mjs` and its test) and timestamp. 879 tests (878 pass, 1 skipped); bundle and boundary clean. The private repo's side (WP-12c) must merge before the trip

## [v01.55r] — 2026-10-03 09:36:18 AM EST

> **Prompt:** "decisions made." *(the owner's choices on the usefulness review, with "Outlines + days" picked for comparing options; this push is wave 2 of step 2 — whole-trip outlines and day versions to compare, one plan and one brochure for the chosen mix)*

### Added
- **Outlines and day versions** (WP-11e, `helpers/packs/tour-guide/journey/`; the planner's `outline` input, `planner/planner-outline.mjs`): up to three outlines of the whole trip, each date given a kind (full, light, travel, rain spare, free) and an area; a dated booking and the owner's picks are anchors, moving days travel, options differ on at least a third of the days, and each one names what it gives up, the picks it leaves out first; a trip with one shape comes as one outline. Up to three versions of each day, every one holding the day's anchors and at least half as many stops as the first; a busy day also gets "A slower day"; a day with one way to go comes as one version. The chosen mix becomes one plan (`assembleChosen`): Later says which picks are in a version not chosen, and the other versions are kept for `/versions`. A version set asks Maps once per pair of points (`cachedMaps`). Invented fixture `fixtures/two-stays/`
- **Comparing in the chat and the app** (WP-11f): the `outline` and `day_versions` payloads (two schemas, their checks and the core's mirror; both new envelope types route to the planning routine); `gas/17_journey.js` — outline and version cards after the shortlist, 🧱 Build my plan, `/outline`, `/versions`, another version of a planned day as a replan, `/journey on|off`; `gas/36_journey_app.js` and the app's Compare screen (`live-site-pages/helper-app.html` v01.07w). Off until the private routine update; then the owner sends `/journey on`
- **End-to-end test** `helpers/tests/pack_tour-guide_phase11_wave2_e2e.test.js` (invented data): the two-stays week from the shortlist through outlines, a mix and day versions to the core, the day cards and one brochure; the plan_digest stand-in it shares with the wave 1 test moved to `helpers/tests/harness/tour-guide-digest.js`. Also new: `pack_tour-guide_journey.test.js`, `pack_tour-guide_journey_payloads.test.js`, `pack_tour-guide_gas_journey.test.js`, `shell_helper-app_compare.playwright.mjs`

### Fixed
- **Dinners on a trip with shortlist choices** (`planner/planner-dinner.mjs`): the dinner step read the choices from a field the choice step does not return and threw; it now reads them as the choice step gives them (found by the private repo's plan update)
- **A free last day in the brochure** (`brochure-map/brochure-map-days.mjs`, `brochure-map-practical.mjs`): a day with no stops listed only its free time under "Free days", so a last day's check-out and end point were missing; the line now reads the day in order (start, bags, free time, end) and links the end on Maps

### Changed
- **The app's planned days read like the chat's day card** (`gas/32_app_api.js`, `live-site-pages/helper-app.html`): `trip.digest` now carries Phase 10's stop and leg fields (estimated times, walk flags, taxi and buffer minutes, check-on-the-day lines) and the app shows the day's start, bags, last entry, booking, crowd, dinner, spare time, extras and sunset; a stop's note drops timing advice its own time contradicts, as the card does
- `helpers/decisions/TG-PHASE-11.md` (wave 2 merge choices; six faults a probe of the whole journey found before release, each fixed with tests; the checks; items carried to Phase 12), `helpers/decisions/WP-11e.md`, `WP-11f.md`, `WP-11a.md`, `WP-11d.md`, `helpers/status/WP-11e.md`, `WP-11f.md`, `helpers/SPEC.md` §5 and §16, the pack README; the Phase 12 brief `helpers/prompts/TG-PHASE-12.md`; `helpers/BUILD-STATE.md` rows 11 and 12 and the Phase 11 log; the helper app's changelog; README tree and timestamp. 781 tests (780 pass, 1 skipped)

## [v01.54r] — 2026-10-03 06:28:19 AM EST

> **Prompt:** "1. Keep Scout. 2. I am ok with no for now, but I want you to explain your reasoning. Then, whenever conditions are right, remind me to get Scout its own routine. 3. I allow the change. 4. Yes."

### Changed
- **Search results carry photo names** (`helpers/kits/maps/lib/maps-masks.mjs`): `places.photos` joins the Text Search Pro mask (Google bills it as a Text Search Pro field, so no SKU changes) and, through it, the Nearby Search masks (Pro is Nearby's floor); `fieldTier('places.photos')` is Pro while Details' bare `photos` stays IDs-only. A Scout board no longer needs one Place Details call per pick for its photo. Test in `kit_maps_ledger.test.js`, a line in the kit README
- `helpers/decisions/TG-SCOUT.md` §8 records the owner's answers: the name stays Scout, no dedicated routine for now (with the conditions for a reminder), the photos change allowed, Google facts on the board yes; `helpers/status/WP-S-engine.md` (request done), `helpers/status/PHASE-8-RESUME.md` item 10 (the Scout routine reminder), `helpers/BUILD-STATE.md` row S and the Scout log; README timestamp. 735 tests (734 pass, 1 skipped)

## [v01.53r] — 2026-10-03 06:13:06 AM EST

> **Prompt:** "decisions made." *(the owner's choices on the usefulness review; this push is wave 1 of step 2 — a day's real start and end, dinners and evenings, researched place facts, season, local favourites and crowd timing, and the brochure pass)*

### Added
- **Contract C11** (Tour Guide schemas; every field optional, so old records and payloads still load): trip `day_overrides` (a day's own start, end, hours and bag step) and `season` (typical weather, the leaf or blossom forecast, the season's events); place `facts` (visit length, last entry, closing time, closed weekdays, booking rule, price, menu check, each with sources and the date checked) and the flags `local_favourite` and `crowd_magnet`; a day plan's real start and end, bag step, dinner place, evening extras and sunset; the plan digest's matching day and stop fields; plans sent in parts
- **Place facts and the season sheet** (WP-11b, `helpers/packs/tour-guide/facts/`, `season/`): normalizers, one display line per kind (≤ 160 characters), staleness (90 days, a menu check 30), disagreements with Google's hours, the events and blooms on a date; the gem screen drops a single-bloom garden that is out of season on every trip date and flags local favourites (two or more publishers) and crowd magnets (never a drop)
- **Real days in the planner** (WP-11a, `planner/planner-anchors`, `-dinner`, `-evening`, `-facts`, `-crowd`, `-sun`, `-chain`): a day starts where and when it really starts (no breakfast at the lodging on an arrival) and reaches a departure 10 minutes early; the bag step is a timeline row; dinner at a saved place that fits the diet, open that evening, within 1.5 km of the last stop or the lodging, with its booking line (the planner never adds a booking); up to three evening extras within 2 km, events first; sunset from the NOAA algorithm; a place's own facts win over Google's hours; a crowd magnet gets the opening or the late slot when the travellers avoid crowds, and is never dropped. Invented fixture `fixtures/moving-day/`
- **The core** (WP-11c): both validators take every C11 field; plans in parts (`gas/23_plan_parts.js`: staged in a `DigestParts` tab, joined and checked as one plan, stored and delivered once; an incomplete plan is dropped after 24 hours with one notice); the day card's 🚩 start, bags, last entry, 🎟 booking, 👥 crowd, 🍽 dinner, 🏁 end, "If you have energy" and 🌅 sunset lines; "local favourite" on a shortlist; per-day `/dates <date> start|end|hours|bags|clear`, sent to the brain as `trip_update.day_overrides`
- **The brochure pass** (WP-11d, `kits/brochure/`, `brochure-map/`): the real start, end and bag step as timeline rows; a stop's last entry, where its length comes from, its booking line (only when not booked) and its crowd note; a dinner card; "This evening" with sunset and the extras; a facts block on place cards with sources, the date checked and a stale mark; a season page after the overview. A plan without C11 fields renders the same HTML byte for byte
- **End-to-end test** `helpers/tests/pack_tour-guide_phase11_e2e.test.js` (invented data): the moving-day trip through the planner and the checks, the brochure, a two-part digest through the core, the day card and the app's `trip.digest`

### Fixed
- **The day card's walks** (`helpers/packs/tour-guide/gas/10_commands.js`): each walk now shows once, before what it leads to. On a day whose bags go to the hotel first, the walk to the hotel no longer reads "back to your lodging" after the sights, and the walks to and from dinner show. Days without these fields read as before
- **Rainy-day swaps** (`planner/planner-rain.mjs`) follow a place's own facts, as the schedule does: a museum its own site closes on Mondays is no longer offered on a Monday
- **Why a place was left out** (`planner/planner-assign.mjs`): a place near a day it is closed and far from every day it is open now reads "closed on <date>, the day you are near it" instead of its distance from the nearest lodging

### Changed
- `helpers/decisions/TG-PHASE-11.md` (merge choices, checks, notes for wave 2), the WP-11a–WP-11d decisions and status files, SPEC §16, the pack README; `helpers/BUILD-STATE.md` row 11 and the Phase 11 log; README tree and timestamp. 735 tests (734 pass, 1 skipped)

## [v01.52r] — 2026-10-03 05:24:52 AM EST

> **Prompt:** "I want Tour Guide to have a separate feature (recommend some names) where I can direct it to search a trip location (example: Kyoto, Japan) for a specific food or activity (example: matcha or yuzu) and have it output a ranked list of related options for me to choose from. I want to be able to easily see multiple options at a glance instead of having to open up their google map links one at a time. This feature/output should differentiate itself from the Brochure feature. Tour Guide should also save these places down in the Places tab. If you think this task should use Fable 5.1, then wait for my Fable weekly reset in approximately 2hrs 22 minutes and start this thread then. I will be going to sleep soon, so I want you to do as much as possible without me."

### Added
- **Scout contract** `helpers/decisions/TG-SCOUT.md`: `/scout <food or activity> [in <place>]` (or the app's Scout screen) asks the routine to rank the places in one destination that are about that one thing; the answer is a numbered list with ➕ Later buttons, a Scout board (one map with every pick numbered, compact cards, a compare table, the left-out list with reasons) as HTML in the app and PDF in the chat, and every pick saved to Places. Not a brochure: one question across a city, before or without a plan. Decisions log §8
- **Scout engine** `helpers/packs/tour-guide/scout/` (WP-S engine): text parsing and scout ids, search queries, ranking (on topic, quality against the pool, fit, local word of mouth, reach from the lodging) with screens and reasons (closed, closed on every trip day, off topic, the party's diet, too far), labels (hidden gem, vegetarian verified or likely, chain, far, book ahead, queue, cash only, new), the `scout` payload with no Google field, the Place fields a pick writes (a `scouted` history entry), and the board renderer (HTML for the app, PDF through Chromium); `schemas/tour-guide-scout.schema.json`, the Place history event `scouted`, the `scout` envelope type in `helper.json`
- **Scout in the core** (WP-S gas): `gas/16_scout.js` — `/scout`, `/scouts`, the Scouts tab, the numbered list with ➕ buttons that put a pick on the trip's Later list, the `scout` envelope handler and validator (refuses Google field names anywhere); `gas/35_scout_app.js` — the app's `scout.list`, `scout.get`, `scout.board`, `scout.new`, `scout.add`; a `scout` request routes to a `SCOUT` routine when configured, else to trip-research
- **Scout screen** in the Tour Guide app (`live-site-pages/helper-app.html` v01.06w): ask, past scouts, the board, ➕ Later and the map link per pick
- Tests: `pack_tour-guide_scout.test.js`, `pack_tour-guide_scout_redteam.test.js`, `pack_tour-guide_scout_gas.test.js`; schema, payload and envelope tests extended (651 tests)

### Changed
- `helpers/BUILD-STATE.md`: row S and the Scout log; README tree and timestamp

## [v01.51r] — 2026-10-03 04:50:16 AM EST

> **Prompt:** "decisions made." · "how does `/date hours <start> <end>` know which date I am setting hours for?" · "Fix it" *(the owner's choices on the usefulness review — this push writes the brief for step 2 of three; a question about `/dates` hours, answered by per-day hours in that brief; "Fix it" on a card asking whether a companion's interview answers should reach memory without a manual merge each time)*

### Added
- **Phase 11 brief** `helpers/prompts/TG-PHASE-11.md` (usefulness pass, step 2): Contract C11, every field optional — a day's own start, end, hours and bag step (`trip.day_overrides`, set with `/dates <date> start|end|hours|bags|clear`), dinner at a saved place that fits the travellers' diet, evening extras and sunset, researched place facts (`place.facts`: visit length, last entry, booking rule, price, menu check, each with sources), a season sheet (`trip.season`), local favourites, crowd timing, and plans sent in parts. Wave 1: WP-11a planner, WP-11b facts · season · gems, WP-11c core and commands, WP-11d the brochure pass. Wave 2, the owner's "Outlines + days": WP-11e two or three whole-trip outlines to pick or mix and two or three versions of each day, WP-11f the core and the Mini App's Compare screen. Each wave ends with the private repo's side as a PR for the owner
- Decisions record `helpers/decisions/TG-PHASE-11.md`, filled as the phase runs

### Fixed
- **Private-repo template: a companion's notes merge on their own** (`helpers/templates/private-repo/scripts/merge-routine-memory.sh`): the memory-only merge accepted files at most one folder below a memory root, so a companion's held interview notes (`quarantine/prefs/people/<slug>/`, three folders down) left the routine's branch unmerged. Memory files may now sit up to three folders below the roots, still `.md` or `.json` only. Helpers scaffolded from the template get the rule the Tour Guide's private repo already runs

### Changed
- `helpers/BUILD-STATE.md`: row 10 (the private repo's side merged; a live check closes it), row 11 in progress, the Phase 10 and Phase 11 logs, Next; README tree and timestamp

## [v01.50r] — 2026-10-03 03:50:11 AM EST

> **Prompt:** "For question: "Should famous sights be kept away from their busiest hours?", choosing either option lights up both options. Fix it, save [companion]'s current answers, and let me know when to relaunch the app to continue." *(a companion's name redacted)*

### Fixed
- **Yes/no questions light only the answer tapped** (`live-site-pages/helper-app.html` v01.05w): six questions of the travel interview offer two options with the same value and opposite polarity (`crowds-02` busiest hours, `climate-01`–`04` heat, cold, humidity and rain, `budget-02` fine dining). The app keyed its buttons by value, so one tap lit both. Each option now has a key, its value or `value|polarity` when another option of the question shares the value, used by the buttons, the saved draft and the send. A draft saved by an earlier version holds only the shared value for such a question: that one answer is dropped (both buttons unlit, asked again) and every other saved answer comes back
- **The core records the half that was tapped** (`helpers/packs/tour-guide/gas/32_app_api.js`): `interview.submit` mapped a shared value to the last option, so "Yes, avoid peak hours", "Heat is fine", "Cold is fine", "Humidity is fine", "Rain is fine" and "Yes, worth it" sent from the app would have been recorded as their opposites. `tgIvOptionKey` builds the same keys as the app; a pair's bare value (sent by an app before v01.05w) is refused as `ambiguous_value` instead of guessed. The chat interview sends the option's position and was never affected

### Changed
- `helpers/tests/pack_tour-guide_gas_app.test.js`: keys for pairs and for unique values, the bare value refused for three pairs, both halves of a pick refused, each half recorded with its own polarity
- `helpers/tests/shell_helper-app.playwright.mjs`: a fixture section with two pairs; one tap lights only that half, the other half moves the choice, the draft keeps the half, an answer from the chat lights its own half, the send names the half, an old draft's bare value is dropped while the other answers return
- `helpers/decisions/WP-9c.md` §12 amended; README tree and timestamp

## [v01.49r] — 2026-10-03 03:21:54 AM EST

> **Prompt:** "I tapped +Someone else" in the Interview tab and it showed "Me" still chosen. That's confusing - fix it." · "In question #1, [companion] wants to pick more than 5 options, but you only allow max 5 choices. Is that intended? If not, then open up the choices." · "Let me know when you have pushed the fixes live. I will reopen the app and have [companion] keep going." *(three messages; a companion's name redacted)*

### Fixed
- **Who is answering** (`live-site-pages/helper-app.html` v01.04w): while a new person is being named, only **＋ Someone else** is lit (Me and everyone else unlit), no questions or Send button show until the name is added, the name box takes the cursor and Enter adds it. The Home screen's **Add someone** opens the same state; at the people limit it says so instead
- **"Pick any" questions take every option** (same page): the app no longer caps a multiple-choice answer at five picks (the old cap would also have cut off a sixth food someone cannot eat). Picks are bounded only by the options a question offers (the bank allows 12); typed "Something else?" words stay at five per question, as the core allows, and now join the picks instead of replacing the last ones; a send of more than 200 answers (the prefs kit's limit) is stopped with a line asking to untick a few. Supersedes `helpers/decisions/WP-9c.md` §12's "multi up to 5"; the chat interview never had the cap and the core already accepted every option

### Changed
- `helpers/tests/shell_helper-app.playwright.mjs`: the fixture's "pick any" question has eight options; new checks for all eight picks plus typed words (chosen, kept in the draft, sent), the Someone else state from the Interview tab and from Home, Me going back to the owner's questions, and Enter adding a name
- `helpers/decisions/WP-9c.md` §12 amended to match; README tree and timestamp

## [v01.48r] — 2026-10-03 02:35:05 AM EST

> **Prompt:** "decisions made." *(the owner's choices on a usefulness review of the Tour Guide; this push is step 1 of three — the right day abroad, honest travel legs, a planner tidy-up and booking deadlines)*

### Added
- **Each trip's own day** (core and pack): `Trips.tz`, `tgTripToday`, `tgOwnerTz`; while a trip is in progress, `/today`, `/replan today|tomorrow` and the current trip use the trip's date, not the home date. A trip with no zone behaves as before. Tests `pack_tour-guide_gas_trip_tz.test.js`
- **Booking deadlines and reminders** (pack `gas/14_bookings.js`, schemas `tour-guide-booking` and `tour-guide-bookings`): the `bookings` envelope (the pack's seventh type) replaces a trip's list but keeps the owner's taps; a Bookings tab; `/bookings` and `/bookings now`; `/trip` and the day card show each booking in the trip's time and the owner's; an alert about 30 minutes before booking opens and a 09:00 reminder while a window is open, with ✅ Booked · Not needed · Tomorrow. Tests `pack_tour-guide_gas_bookings.test.js`
- **Core alarms** (`core/17_alarms.js`, `registerAlarm`): pack code that runs at a time, with at most one pending `alarmTrigger`, re-armed after every run. Tests `core_alarm.test.js`
- **Honest travel legs** (pack planner): a leg the rail estimator walks takes Google's WALK route (minutes, distance, path warnings, a walking link); a failed request keeps a marked estimate; flags footpath · trail · uphill · downhill; taxi minutes from one DRIVE request on hill and trail legs; a buffer per leg and the day's spare time; a per-day budget for the extra requests (`extraCallsFor`). Invented fixture `fixtures/hill-town/`; tests `pack_tour-guide_planner_legs.test.js`
- **Contract C10**, all optional so old payloads still load: trip `tz`; day `spare_minutes`; stop `time_style`, `check_on_day`; leg `estimated`, `distance_m`, `flags`, `taxi_minutes`, `buffer_minutes` — through the plan digest, the day plan and the brochure kit
- **The note guard** (pack `planner/planner-notes.mjs`, ported to the day card): a note sentence whose timing advice the schedule contradicts is left out of brochure cards and day-card note lines. Tests `pack_tour-guide_planner_notes.test.js` on the shared table `pack_tour-guide_note_table.js`
- **Place categories** temple, shrine, garden and experience, with default and shortest visit lengths (`planner/planner-category.mjs`; `refineCategory` for stored records)
- **Brochure Bookings page** (pack `brochure-map/brochure-map-bookings.mjs`): first on the practical page, still to book before booked, each time in the trip's zone and the owner's. Tests `pack_tour-guide_brochure-map_bookings.test.js`
- **End-to-end test** `pack_tour-guide_phase10_e2e.test.js`: a C10 digest to the day card abroad; a `bookings` envelope to `/trip`, the day card, a reminder and silence after Booked; the brochure's Bookings page
- Phase 10 brief `helpers/prompts/TG-PHASE-10.md`; decisions `helpers/decisions/TG-PHASE-10.md`, `WP-10a.md`, `WP-10b.md`; status `helpers/status/WP-10a.md`, `WP-10b.md`

### Changed
- **Day card**: legs read "walk 22 min · +3 min spare" or "about 20 min walk (estimate)", with flags and taxi time inline; "Spare time" after the last leg; "about 11:45" for loose times, exact times for bookings and set sessions; a 🕑 line for opening days to check; the day's booking lines. An older day reads exactly as before
- **Google's walking notice** ("Walking routes from Google are in beta…") on every day card and brochure day that shows a Google walking route, as Google requires
- **Rain swaps** go to covered sights only (museums, galleries, workshops and the like), never a meal stop, a shop or an outdoor place
- A pick dropped for lack of time says how many minutes it was short and offers a shorter visit when one fits; places with irregular or unknown opening days are kept with "check before you go"
- The brochure counts walks as walks, marks estimates, and shows leg extras, "about" times and spare time
- `checkDayPlan` accepts an estimated WALK leg and refuses a repeated leg flag; `tgBkDayLines` takes the stored day or its date
- Docs: `helpers/SPEC.md` (registerAlarm, the alarm trigger, limits, ownership map), the pack README, `helpers/BUILD-STATE.md` (rows 10–12, Phase 10 log), README tree

## [v01.47r] — 2026-10-03 12:51:29 AM EST

> **Prompt:** "My companion is [redacted]. I will have her complete the interview soon. Make sure it is easy to fill in on the Tour Guide app. Allow me to name the profile "[name]", and save the preferences for future trips." *(personal details redacted; the same message also covered a hotel booking and a train-seat question, which change no code here)*

### Added
- **Interview answers save as you go** (shell `live-site-pages/helper-app.html`): each person's unsent answers are kept on the phone (browser storage, plus Telegram CloudStorage when they fit its 4 KB value limit; the newer copy wins), written after each change and whenever the screen changes, "Who is answering?" switches or the app closes. Reopening restores them with "Picked up where you left off" and a **Start over** button; a successful send clears them and a refused send keeps them
- **Live progress** on the interview: "N of M answered" at the top and bottom, a count per section, and the send buttons say how many answers go out

### Changed
- A companion's interview is titled with their name and asks the questions that shape a shared plan first (Food, Must avoid, Mobility, Pace & rhythm, Activities, Crowds & timing); the other sections are folded under "Show N optional questions"
- Tests: `helpers/tests/shell_helper-app.playwright.mjs` covers saving, restoring after a reload and from CloudStorage alone, switching people, Start over, clearing on send and keeping on a refused send
- Docs: `helpers/docs/TG-SWITCH-ON.md` (Travelling with)

## [v01.46r] — 2026-10-02 08:45:01 PM EST

> **Prompt:** "See attached screenshots for what Google Maps says. I would prefer Tour Guide predominantly give me Transit options since I will likely not have a car and will want to travel across distances that are unrealistic for walking. Within the Transit options, I would prefer train/metro > bus, especially in Japan." *(with three Google Maps screenshots of transit times)*

### Added
- **Rail first on TRANSIT days** (pack `planner/planner-transit.mjs`): `transitPrefs(trip)` asks Google for train, metro and tram routes only unless the trip lists its own `allowedTravelModes`; `withBusFallback` re-asks with buses allowed for just the pairs rail could not serve, and stops after one probe element where Google has no transit at all (Japan). Tests `pack_tour-guide_rail-first.test.js`

### Changed
- The Japan train estimates look for stations up to 1.3 km away (was 1 km), so a lodging whose nearest station is a 15–20 minute walk still gets a train leg instead of the plain distance estimate. The other constants stay: three real Google times from the owner came out 7 min under, 2 min over and 3 min under
- Docs: the pack README (rail first, 1.3 km), the trip schema's `transit_preferences` description, `helpers/decisions/TG-PHASE-8.md` §5, `helpers/status/PHASE-8-RESUME.md`, `helpers/BUILD-STATE.md` Phase 8 log

## [v01.45r] — 2026-10-02 08:03:06 PM EST

> **Prompt:** "i want to do as much as I can do now" *(Phase 8, everything that does not need the trip's evidence)*

### Added
- **Other travellers** (pack `gas/22_people.js`, `gas/32_app_api.js` `people.list · add · trip`, `interview.bank · submit` with `person`): the owner adds people in the app, ticks who comes on a trip and hands the phone over for the interview; a companion's answers build their own profile. Home carries the trip's people and the display name (masthead)
- **`/dates`** (pack `gas/10_commands.js`) and `trip_update` (`gas/00_common.js`): dates, day hours and travellers ride every research, plan and replan request, so a date change never needs a pull request
- **`packs/tour-guide/travellers/`** — `profileExcerpt` / `dietOf` (moved from the private repo, F12) and `partyExcerpt` ("their limits, your lead"); the excerpt schema requires `dietary` and documents `avoid`, `diet`, `diet_rule`, `day_rhythm`, `also_like`, `party`; tests `pack_tour-guide_travellers.test.js`
- **Session lengths for set activities** (estimator `activityDefault`) and `booking.minutes` on a place, which the planner always takes (F21)
- **`tools/upload.mjs --key-from <saved request>`** — the upload key never goes on a command line (F22)
- **Core `registerRoute` `lock`** (`true` or a predicate; `503 busy`; `LIMITS.ROUTE_LOCK_WAIT_MS`); the app route uses it for writes and note requests
- `helpers/decisions/TG-PHASE-8.md`, `helpers/status/PHASE-8-RESUME.md`

### Changed
- Typed picks take a round prefix (`r1 5 later 7`) and `/repick 2 6 r1 5` marks numbers in the same message (pack `gas/12_flow_plan.js`, F20)
- The app Shortlist shows every round of the open plan, newest first (`shortlist.get { all }`, shell v01.02w)
- The `/smart on` reply says to type questions as plain text (F25)
- Docs: `helpers/docs/TG-SWITCH-ON.md` (`/dates`, round prefixes, travelling with others), the pack README, `kits/prefs/README.md` (reading a profile back), `SPEC.md` (route lock, `--key-from`); `helpers/prompts/TG-PHASE-9.md` marked done; `helpers/BUILD-STATE.md` Phase 8 part 1 done

### Security
- **Formula escaping** in `core/03_store.js`: text starting with `=` `+` `-` `@`, tab, CR or an apostrophe is written as literal text; updates rewrite the whole row escaped. The Sheet mock models it; test in `core_store.test.js`

## [v01.44r] — 2026-10-02 07:29:11 PM EST

> **Prompt:** "I have finished choosing and reviewed the rebuilt [trip] day. It looks good enough for now." *(Phase 7 step 5 close; earlier in the step 6 trial the owner wrote: "I have tried /smart out and understand the difference now. I want /smart off by default unless i turn it on.")*

### Changed
- **Phase 7 done**: `helpers/BUILD-STATE.md` Phase 7 row done (v01.29r–v01.44r), log and Next ("Phases 0–7 and 9 are done"; Phase 8 after the owner's trip on Opus 5.5 · high)
- `helpers/decisions/TG-PHASE-7.md` §2: Lane B `/smart` stays off by default (owner choice, no code change); the pilot day accepted; F24 notes the date fix was not re-checked on record
- `helpers/prompts/TG-PHASE-8.md` item 8: one check that a date-based answer names the right day
- `helpers/status/PHASE-7-RESUME.md`: every step done
- `repository-information/SESSION-CONTEXT.md`: remember session

## [v01.43r] — 2026-10-02 03:13:35 AM EST

> **Prompt:** "even when I ask normally, it takes a long time." *(Phase 7 step 6, the `/smart` trial; a screenshot showed the first quick answer naming the day before the trip day and an opening-hours question handed to the routine)*

### Fixed
- **State Sheet time zone** (`core/03_store.js` `syncSheetTimeZone`, property `SHEET_TZ` in `core/00_config.js` and `SPEC.md` §7): Sheets stores a written `YYYY-MM-DD` as midnight in the Sheet's own zone; a Sheet created in the manifest's zone east of the owner's `TIMEZONE` read every stored day date back as the day before (quick answers, day lookups by date). `getSpreadsheet()` now sets the Sheet's zone to `getTz()` once per zone; stored serial dates are unchanged, so rows already written read correctly after the switch
- Test in `core_store.test.js`; the mock spreadsheet has a zone

### Changed
- `helpers/docs/TG-SWITCH-ON.md` §7: type quick questions as plain text (`/ask` always goes to the routine) and what the quick lane can answer
- `helpers/decisions/TG-PHASE-7.md` findings F24–F25; `helpers/prompts/TG-PHASE-8.md` carries the `/smart` follow-ups

## [v01.42r] — 2026-10-01 11:57:26 PM EST

> **Prompt:** the owner's answers on two decision cards: "chosen option: Set Opus 5.5" (the routine model) · "chosen option: Try /smart" (Lane B) *(Phase 7 steps 6–9 while the pilot day is rebuilt)*

### Added
- `helpers/prompts/TG-PHASE-8.md` — Phase 8 kickoff (live review and tuning, after the owner's pilot trip; Opus 5.5 · high): owner questions with defaults, the carried Phase 7 findings, tuning from the pilot evidence, the Phase 9 follow-ups

### Changed
- `helpers/docs/TG-SWITCH-ON.md`: §4 always pick a routine's model (an empty model runs on the service default) and the Aggregate smoke is a done, never-repeat step; §6 typed picks and the app reach the newest round only, the shortlist PDF, and how a trip's dates change after the facts are confirmed
- `helpers/decisions/TG-PHASE-7.md` §2: routine models (Opus 5.5, set by the owner) and the `/smart` trial
- `helpers/BUILD-STATE.md`: Phase 7 row (wrapping up), repos and environments, Phase 7 log, Phase 8 row and Next; `helpers/status/PHASE-7-RESUME.md`; README tree entry for the Phase 8 prompt

## [v01.41r] — 2026-10-01 11:18:18 PM EST

> **Prompt:** "I completed steps 1-3. See screenshot." *(Phase 7 step 5: the pilot's one-day re-plan arrived with a breakfast at the late arrival time, a generic lunch slot and the chosen lunch restaurant booked again mid-afternoon, which pushed a pick off the day)*

### Fixed
- **Planner meals** (`packs/tour-guide/planner/planner-day.mjs`, `planner-input.mjs`, `planner-assign.mjs`): a day that starts at 10:30 or later has no breakfast at the lodging (`LATE_START`, `breakfastLen`); a chosen restaurant or cafe whose activity is lunch is the day's lunch — the solver adds no separate lunch slot and starts that stop between 11:30 and the end of lunchtime, while the stop still reports the place's own hours. If the lunch spot cannot make the day, the plain lunch slot comes back
- Test in `pack_tour-guide_planner.test.js`

### Changed
- `helpers/decisions/TG-PHASE-7.md` findings F21–F23; `helpers/status/PHASE-7-RESUME.md` log

## [v01.40r] — 2026-10-01 10:52:44 PM EST

> **Prompt:** "Everything in round 2 went to later or skip because I was assuming I was going to [a hotel spa] and [a river]. If these picks are now weaker because they are inaccessible or due to the wrong season, I would like you to make a plan from my Later list as long as the logistics make sense. If my Later list is not enough to make a good plan, then let me know and let's evaluate more places. I plan to get into [the city] from [another town] in the morning of [day 1], then leave [the city] to go to [the next city] around noon of [day 2]. Therefore, I want this plan just to cover [day 1]." *(Phase 7 step 5, the pilot `/plan`; places and dates are redacted)*

### Added
- **`/repick`** (pack `12_flow_plan.js`): while the days are being built, go back to choosing with every ✅ 🔖 ❌ kept — in the chat or the app — and ✅ Done choosing builds again. A digest that answers the dropped request is still shown but no longer ends the flow. With no plan flow, `/repick` reopens choosing on every shortlist round of the current trip (`tgShortlistRuns` in `21_sheets.js`). The "building the days" line mentions it
- Test in `pack_tour-guide_gas_plan.test.js`

### Changed
- `helpers/docs/TG-SWITCH-ON.md` §6 step 5 mentions `/repick`; `helpers/decisions/TG-PHASE-7.md` finding F20; `helpers/status/PHASE-7-RESUME.md` log

## [v01.39r] — 2026-10-01 10:41:22 PM EST

> **Prompt:** the owner's Phase 9 live check (thread "Tour Guide Phase 9 — Mini App"): "I completed steps 1-2 and got "menu button set: it opens the app". However, for step 3, I clicked the paperclip icon …" · "It popped up an app that I expanded." · "When I clicked Choose on the "Open choice round 2" card, it brought me to the "more" options I asked for with my answers from Telegram pre-populated. I clicked "Done Choosing" at the bottom and it resulted in this error. Facts does not work either. The Interview tab shows me the interview I did on Telegram. If this exists, I would prefer all future interviews (for other people's profile since I might not always travel alone) be done via this app instead of via Telegram. The Brochure tab shows my [trip] dates but nothing else. The Places tab shows filters and 9 places." *(the destination is redacted; screenshots were attached)*

### Fixed
- **Helper app shell (`live-site-pages/helper-app.html` v01.01w)** — a shortlist round the chat had already closed (the plan flow past `choose`: building the days or looking for more options) was shown on Home as still open with a **Choose** button, and **Done choosing** or the **Facts** tab then ended on a bare `no_flow` error screen. Home now labels such a round `CLOSED` with the tally and what the chat is doing (**View** opens it read-only), the shortlist screen shows the round as closed instead of a form, a `no_flow` on Done choosing says the round is closed, the Facts tab treats "no facts open" as a quiet *Nothing to confirm* state, and the brochure's empty state says the days are being built while the plan is in progress. Every other refusal is now worded in plain language (`WHY` map + the flow stage)
- **Pack app route (`32_app_api.js`)** — `home.choice_round` and `shortlist.get` carry the trip's plan-flow `stage` (`''` when no flow: the adopt path still accepts the round), so the shell can tell an open round from a closed one

### Added
- Shell test (`tests/shell_helper-app.playwright.mjs`): a `planning` mode (closed round, no open facts) with three checks and the screenshot `decisions/screenshots/wp-9c/state-round-closed.png`
- `helpers/decisions/TG-PHASE-9.md` §6 live findings (L1–L6) and §7 items for the next phase (interviews for other travellers' profiles in the app; the shell's generic masthead)

### Changed
- `helpers/BUILD-STATE.md`: Phase 9 **done** (v01.39r), Phase 9 log, Next; `helpers/docs/TG-SWITCH-ON.md` §3 gains "Open from the app"; `helpers/decisions/TG-PHASE-7.md` §1 row F18 points at Phase 9; `repository-information/SESSION-CONTEXT.md` remembers this session

## [v01.38r] — 2026-10-01 10:38:23 PM EST

> **Prompt:** "I finished choosing and it says it's "Building the days from 5 picks (14 for Later)...". Is it still actively working?" *(Phase 7 step 5, the pilot `/plan`: the plan routine built the days and brochure but could not put the plan JSON or the brochure on Drive, so it sent nothing)*

### Changed
- **Core upload route** (`helpers/core/16_upload.js`) and **`tools/upload.mjs`** also take `.json` (`application/json`), so a routine puts its plan file on Drive through the route instead of pasting it into the Drive connector, where a hand-copied data file can be silently corrupted
- Tests in `core_upload.test.js` and `tools_upload.test.js`; `SPEC.md` route and tool rows
- `helpers/decisions/TG-PHASE-7.md` finding F18; `helpers/status/PHASE-7-RESUME.md` log

## [v01.37r] — 2026-10-01 10:06:38 PM EST

> **Prompt:** "Read helpers/prompts/TG-PHASE-9.md in LightAISolutions/Personal and execute it exactly." *(The Phase 9 brief, thread "Tour Guide Phase 9 — Mini App"; the owner pulled the phase forward after Phase 7 because inline-button taps are slow. The owner's answers to the three Step 0 questions: the web-app URL — session-only, never recorded —, "I approve." for the screenshots, and "Give me step by step instructions when it's time." for the live check.)*

### Added
- **Core — registered routes** (`helpers/core/02_registry.js`, `10_router.js`, `00_config.js`): `registerRoute(name, {methods, auth: none|admin|webapp, handler})` is the new extension point for `?route=<name>`; the core names (`CORE_ROUTES`: `tg wake setup health upload`) cannot be registered. `routeRegistered()` checks the method, parses the POST body (`ROUTE_BODY_MAX_CHARS` 65 536), runs the auth and answers ContentService JSON with the status in the body (`{ok:false, status, reason}` — Apps Script cannot set an HTTP status); an unknown POST route is now a JSON 404. `LIMITS.MAX_APP_CALLS_PER_DAY` (2000, overridable by the property of the same name), `INITDATA_MAX_AGE_SEC` (24 h), `INITDATA_MAX_CHARS`; properties `APP_SHELL_URL`, `MAX_APP_CALLS_PER_DAY`
- **Core — Mini App launch data** (`helpers/core/05_telegram.js`): `tgVerifyInitData(initData)` (HMAC per Telegram's rule, constant-time compare, freshness, owner only; refusals audited once per 6 h per reason), `tgSetMenuButton(url, text)` / `tgMenuButtonDefault()`, and `web_app` buttons (`{text, web_app:{url}}`, https only) in `tgKeyboard`
- **Pack — the app route** (`helpers/packs/tour-guide/gas/32_app_api.js`): `?route=app` (POST, `webapp`) with 16 operations — `home`, `shortlist.get · choose · choose_many · more · done`, `trip.digest`, `brochure.get` (inline up to `TG_APP_BROCHURE_MAX_CHARS` 200 000, else the Drive link), `places.search · get · note · check`, `interview.bank · submit`, `facts.get · confirm`; the setup step `app_menu_button`; 📱 `web_app` buttons on shortlist, plan-digest and `/places` messages when `APP_SHELL_URL` is set; a choice made in the app re-marks the chat's shortlist keyboard (message ids in Settings `tg_app_sl_msgs`). No Google call, no Google field stored. Small additive edits in `10_commands.js`, `12_flow_plan.js` (`tgPlanRowsOf` keeps `url`/`web_app` buttons through the adopt re-map) and `20_envelopes.js` (`onSent` hook on `tgEnvRender`/`tgEnvDeliver`)
- **The app shell** (`live-site-pages/helper-app.html`, v01.00w, + `html-versions/helper-apphtml.version.txt`, `html-changelogs/helper-apphtml.changelog.md`, `helper-apphtml.changelog-archive.md`): one generic Telegram Mini App page for every helper — no data, no helper-specific text; screens home, shortlist (local ticks, one batch submit), trip facts, interview, brochure (sandboxed iframe or Drive link), places; the core address comes only from `?core=` (or CloudStorage) and must be an Apps Script `/exec` URL — never from `start_param`; strict CSP, DOM built with `textContent` only, theme and viewport from Telegram
- **Tests**: `core_initdata.test.js` (real HMAC, every refusal reason, menu button, web_app buttons), `core_routes.test.js` (registry, core names refused, auth none/admin/webapp, status in body, daily cap), `pack_tour-guide_gas_app.test.js` (every operation, refusals, no Google field written), harness helpers `H.initData` / `H.appPost` with a real `Utilities.computeHmacSha256Signature`; `shell_helper-app.playwright.mjs` (six screens light/dark, batch submit, brochure sandbox, error states, layout) and its 17 screenshots in `helpers/decisions/screenshots/wp-9c/`. Suite: 516 tests, 515 pass, 1 skipped
- **Docs**: `SPEC.md` route table rows and the "Registered routes" section; `decisions/TG-PHASE-9.md` (finalized values, the Step 0 cross-origin verification, WP pointers), `decisions/WP-9a.md`, `WP-9b.md`, `WP-9c.md`, `status/WP-9a.md`, `WP-9b.md`, `WP-9c.md`; `prompts/TG-PHASE-9.md` FINALIZE block filled; pack README "The app" section and rows; REPO-ARCHITECTURE shell node; README tree entries

### Security
- Security review of the Phase 9 surface (`decisions/TG-PHASE-9.md` §5): registry getters (`getRoute`, `getCommand`, …) answer own properties only, so `?route=constructor` / `__proto__` no longer throws and audits per request; an unknown POST route is audited once per 6 h per name; the shell's `img-src` is `'self' data:` (brochure images are inlined by the kit, so the sandboxed frame cannot beacon out); `brochure.get` echoes only HTML inline

### Changed
- `core_router.test.js` and `pack_tour-guide_redteam_chat.test.js` expect the JSON 404 for an unknown POST route; `core_routes.test.js` plants `health` (the `upload` name became a real core route in v01.35r)

## [v01.36r] — 2026-10-01 09:23:51 PM EST

> **Prompt:** "It gave me a short list. I want it to output a link to a pdf file for easier viewing." *(Phase 7 step 5, the pilot `/plan`: round 1 came out thin, so the screening was fixed before a second round)*

### Changed
- **Gem Funnel screening** (`helpers/packs/tour-guide/gems/gems-screen.mjs`, `gems-weights.mjs`): three new drop reasons for the activities group. `not_a_visit` drops lodging, spas, tour and travel agencies, stations and parking; `facility` drops smoking areas, restrooms, ticket offices and the like; `part_of` drops a gate, torii, garden section or pavilion listed next to the big kept place it belongs to (a sub-temple with its own name stays). Owner seeds are exempt
- **Rating floor**: an optional per-country `rating_offset` (±0.5) for places where ratings run low, and two local mentions cap the floor at the default 4.3 so local picks are not cut at appetite ≥ 4
- `nameWords`, `nameCore`, `isFeatureName`, `partOfParent` exported from `gems/index.mjs`; gems and pack READMEs describe the rules
- Test for the new rules in `pack_tour-guide_gems.test.js`
- `helpers/decisions/TG-PHASE-7.md` finding F17; `helpers/status/PHASE-7-RESUME.md` log

## [v01.35r] — 2026-10-01 09:13:26 PM EST

> **Prompt:** "It gave me a short list. I want it to output a link to a pdf file for easier viewing." · "Also, I don't really like Telegram's button click method because it takes a long time to register my clicks. Think of some alternative options we could use for me to input decisions." *(Phase 7 step 5, the pilot `/plan`)*

### Added
- **Shortlist sheet** (`helpers/packs/tour-guide/shortlist-sheet/`): one research round as a printable PDF in the brochure kit's typeface, numbered like the chat, with Maps links and the round's notes; library and CLI
- **Upload route** (`helpers/core/16_upload.js`, `?route=upload`): a routine POSTs a PDF or HTML file it made and gets a Drive file id under the helper's folder, for a reply's `drive_file_ids`. Auth is a per-request HMAC key written into each request file as `upload_key`; open or just-answered requests only, ≤ 6 files, ≤ 30 MB, never into the mailbox
- **`helpers/tools/upload.mjs`**: the routine side of the route (curl through the proxy, checks before sending, never prints the key)
- **Typed picks** (`helpers/packs/tour-guide/gas/12_flow_plan.js`): in the shortlist choose stage the owner can type `1 3 9 later 2 skip 4-8` (or ✅/🔖/❌) instead of tapping each line; unknown or ambiguous numbers are named back
- Tests: `core_upload.test.js`, `tools_upload.test.js`, `pack_tour-guide_shortlist-sheet.test.js`, typed-pick cases in `pack_tour-guide_gas_plan.test.js`; HMAC in the GAS mock

### Changed
- `helpers/SPEC.md` (§3 request `upload_key`, §6 route, §13 tool, §18 limits), `helpers/README.md`, `helpers/packs/tour-guide/README.md`
- `helpers/decisions/TG-PHASE-7.md` findings F15–F16; `helpers/status/PHASE-7-RESUME.md` steps 4–5 and log

## [v01.34r] — 2026-10-01 07:48:38 PM EST

> **Prompt:** "Question#16, rain should not change the plans, but I want Tour Guide to prepare alternative rain-friendly activities just in case." *(Phase 7 step 4, follow-up: swapping an option in)*

### Added
- **☔ Swap in buttons on `/day`** (`helpers/packs/tour-guide/gas/10_commands.js`): each rainy-day option whose stop is on that day gets a button; after a confirm it opens a `replan` of that date that promotes the option and demotes the stop it replaces (the stop moves to the Later list). New callback `rs`, with stale and malformed taps refused
- Test for the swap flow in `pack_tour-guide_gas_commands.test.js`

### Changed
- `helpers/packs/tour-guide/README.md` and `helpers/decisions/TG-PHASE-7.md` F14 describe the button

## [v01.33r] — 2026-10-01 07:46:02 PM EST

> **Prompt:** "Question#16, rain should not change the plans, but I want Tour Guide to prepare alternative rain-friendly activities just in case." *(Phase 7 step 4, the interview)*

### Added
- **Rainy-day swaps** (`helpers/packs/tour-guide/planner/planner-rain.mjs`): every planned day with an outdoor stop gets up to 2 `rain_swaps` — indoor places not on the plan (the Place's `indoor` flag, else its category), open or of unknown hours that date, within reach of one of the day's outdoor stops by its travel mode, nearest first, each offered on one day only; skipped and rejected places never appear; no API call. `replanDays` keeps a kept day's swaps and gives a rebuilt day fresh ones
- DayPlan schema `rain_swaps` and plan checks (known place, not scheduled, offered once, next to a stop of its day)
- **Brochure "If it rains" aside** (`helpers/kits/brochure/`): day `alternatives` (title, 1–3 items with an optional note), rendered with an umbrella icon and a map link; the brochure-map fills it from the day's swaps ("Instead of X · 1.2 km away · check the hours")
- **Plan digest and `/day`** (`helpers/packs/tour-guide/gas/`): the plan_digest day carries optional `rain` (validated), DayPlans stores it in a new `rain_json` column (added on first use, no setup re-run), and `/day` lists it under "If it rains"
- Tests: `pack_tour-guide_planner_rain.test.js` plus brochure-map, sheets, commands and envelope cases

### Changed
- `helpers/packs/tour-guide/README.md` documents the swaps and the digest field; `helpers/decisions/TG-PHASE-7.md` F14 fixed; `helpers/status/PHASE-7-RESUME.md` log line

## [v01.32r] — 2026-10-01 07:33:01 PM EST

> **Prompt:** "I feel like a lot of these interview questions are extremely narrow. For instance, in the activities questions, the bot only gives me 5-9 options that I don't think even cover the entire spectrum." *(Phase 7 step 4, the interview)*

### Added
- **✏️ Other on the interview's open questions** (`helpers/packs/tour-guide/gas/11_flow_interview.js`): every pick-any question on an open dimension (14 of 17) gets an Other button; typed values join that question's picks as text answers, so they wait for the owner's review instead of entering the profile directly. The bank marks those questions with `"other": true` (schema + `validateBank` refuse it on a closed or non-multi question); the prefs kit no longer warns about a text answer on such a question
- **Broader option lists** (`helpers/kits/prefs/presets/travel.interview.json`, appended so a question already on screen keeps its buttons): food likes (vegetarian food, curries, dumplings, pizza and pasta, cheese, coffee and tea), cannot-eat (Vegetarian, Vegan), places (markets, castles and palaces, nature and wildlife, beaches), activities (food tours, hot springs and spas, festivals and events); the vocabulary's examples carry the new values; the bundled bank regenerated

### Changed
- `helpers/decisions/TG-PHASE-7.md`: findings F12 (dietary answers never reached research), F13 (narrow interview lists) and F14 (no rain backups); `helpers/status/PHASE-7-RESUME.md` log line

## [v01.31r] — 2026-10-01 07:17:09 PM EST

> **Prompt:** "for each of the 6 new routines, give me step by step instructions on how to create them. Make it as easy as possible for me to just copy/paste whenever possible." *(Phase 7 switch-on, step 3 with the owner: routines, `/ask`, Aggregate smoke)*

### Changed
- `helpers/docs/TG-SWITCH-ON.md` rewritten from the live switch-on: §1 deploys without a checkout (clasp 2 login in a terminal, browser project, Deploy helper pushes first, then the web-app deployment from Manage deployments); §3 sets `WEBAPP_URL` before `printSetupUrl()` and never shares the setup line or address bar; §4 creates `chat` first, says where the fire URL and the once-shown token live, that every connector is included by default, and that the prompt must name the `routine-fire-payload` block
- `helpers/templates/private-repo/routines/README.md`: the prompt shape names the `routine-fire-payload` block and limits it to a request id
- `helpers/decisions/TG-PHASE-7.md`: findings F8–F11; `helpers/status/PHASE-7-RESUME.md`: step 3 done, step 4 (interview) in progress

## [v01.30r] — 2026-10-01 06:50:29 PM EST

> **Prompt:** "I am working on the Tour Guide - setup now. Give me step by step instructions" *(Phase 7 switch-on, steps 0–2 with the owner: deploy, setup page, pairing)*

### Changed
- `helpers/decisions/TG-PHASE-7.md`: live findings F4–F7 (where to type the `clasp@2` login, the `/exec` URL lives under Manage deployments, set `WEBAPP_URL` before `printSetupUrl()` and never screenshot the setup line, setup page worked first time) and the owner's switch-on choices (free trial with a budget alert, Personal `production` environment for the deploy secrets, own time zone, 24 fires a day, the routines' environment)
- `helpers/status/PHASE-7-RESUME.md`: steps 0–2 done, step 3 (routines) in progress

## [v01.29r] — 2026-10-01 04:45:03 PM EST

> **Prompt:** "start phase 7"

### Fixed
- **Core `tgSafeHtml`** (`helpers/core/05_telegram.js`): a `reply` with `html: true` no longer shows the entities the brain wrote (`&amp;`, `&lt;`, numeric) escaped twice in the chat — they are restored after the safe tags, so an escaped tag still stays visible text; two new assertions in `helpers/tests/core_telegram.test.js`. Found by the private repo's integration dry run on the Phase 7 re-pin

### Added
- `helpers/decisions/TG-PHASE-7.md` (live switch-on findings and choices, started) and `helpers/status/PHASE-7-RESUME.md` (which switch-on step the owner reached)

## [v01.28r] — 2026-10-01 10:03:09 AM EST

> **Prompt:** "Read helpers/prompts/TG-PHASE-6.md in LightAISolutions/Personal and execute it exactly."

### Added
- **Switch-on guide** `helpers/docs/TG-SWITCH-ON.md` — the owner's step-by-step for Phase 7: Cloud project and keys, Apps Script deploy, Script Properties (`MAX_ROUTINE_FIRES_PER_DAY` 24), the seven routines, pairing, the first trip, costs and caps, failure cases
- **Red-team suites** (Phase 6, invented fixtures only, 96 new tests — 374 → 470, 471 with the WP-6c request tests): pack gas `helpers/tests/pack_tour-guide_redteam_{envelopes,callbacks,chat,pdf}.test.js` (hostile from-brain envelopes, forged callbacks, chat/interview/Lane B/`/route`/`/plan` inputs, PDF delivery); kits `kit_{research,brochure,maps,prefs}_redteam.test.js`; engines `pack_tour-guide_engines_redteam.test.js`; core `core_telegram.test.js` (tag-safe `tgSplit`/`tgClip`, plain-text retries, `tgSafeHtml`, `stripHidden`)
- **Core hardening**: `stripHidden` (`01_util.js`) removes zero-width, bidi and control characters from brain text; `tgSafeHtml` (`05_telegram.js`) lets a `reply` with `html: true` keep only Telegram's plain tags and `https://` links without userinfo; `driveFileWhere` (`09_mailbox.js`) refuses to attach a Drive file outside the helper's root (`document_outside_root` audit); `tgSplit`/`tgClip` never cut inside a tag or an entity; `registerProposalGuard` lets a pack veto core proposal actions
- `helpers/decisions/TG-PHASE-6.md` (WP briefs, findings and fixes, cost and quota audit with sources, carried items, accepted risk), `helpers/decisions/WP-6{a,b,c}.md`, `helpers/status/WP-6{a,b,c}.md`, `helpers/status/PHASE-6-RESUME.md`
- `helpers/prompts/TG-PHASE-7.md` — Phase 7 kickoff (owner switch-on: deploy, pair, routines, interview, the first real `/plan`) on Opus 5.5 · high

### Changed
- **Tour Guide pack gas**: shortlist links only Google Maps hosts; every pack envelope is cleaned of hidden characters before validation; the pack refuses every core proposal action (`action_allowlist` empty); strict callback arity, `ps:` taps only for stored or listed places; Lane B strips nested block tags; `/route` refuses unsupported modes; `/plan` inputs refused with a reason instead of truncated; `/brochure` attaches only files inside the helper root
- **Kits**: research scan reads attribute text, flags French/German/Spanish/Italian/Portuguese/Dutch instruction injection and forged envelopes, `mentions(distinct:'publisher')`; brochure escapes every attribute emit site, strips bidi/zero-width characters, accepts only well-formed base64 image data URIs; maps caps and types every snapshot field and sanitizes the snapshot store on load and put; prefs flags multilingual injection and refuses markup in profile values
- **Gems engine (R3)**: `gem_line` carries no Google digits — a words-only rating band and peer comparison (Maps Platform ToS §3.2.3(b), Service Specific Terms §3 and §14.3); `local_mentions[].publisher` counted distinct per publisher
- **WP-6c requests (framework side)**: `tools/envelope.mjs` mirrors the core's `reply` checks (text ≤ 4000, `html` boolean, `drive_file_ids` shape, labels, ids, ≤ 10) and takes `--now <ISO>`; `/replan` and the Later-list promote send `deliverables` (`['plan']`, or `['plan','brochure']` when the trip has a brochure); the `tg_brochure_reply` envelope observer stores a `brochure` reply's `drive_file_ids` on the Trips tab so `/brochure` resends instead of rebuilding; new core helper `mailboxReadRequest(id)` (SPEC §5) reads a request's payload back for observers
- **Private repo (TourGuide PR #4, for the owner to merge after PR #3)**: `tools/integration-dryrun.mjs` drives every pack request kind through the skill drivers, the envelope tool and the core validator/renderer (392 checks, 0 failed, 26 wakes, 12 request kinds); skill fixes C1–C5, C8–C11 and red-team fixes R2, R3b, R4a, R6b (tags, controls and instructions stripped from destination, lodging, seeds, replan reasons and pool names; `trip-check-run.mjs --digest always`; the review closes the trip; routines README connectors match each SKILL.md); new `trip-research-lodging.mjs` locates the owner's lodging in the `new` round with one Maps call (injection-checked text, name/address overlap required, fixture-fed in dry runs) and asks for it in the round's reply when it cannot — the plan-days `lodging_missing` finding stays as the fallback; `docs/TG-SWITCH-ON.md` §0 and §4 and `prompts/TG-PHASE-7.md` Step 0 carry the vendor re-pin to the v01.28r `helpers-dist` and the plan-days web connectors
- Test harness: `createMocks()` resets the envelope clock and root between test files
- `helpers/BUILD-STATE.md`: row 6 **done**, row 7 prompt written, Phase 6 log, Next = Phase 7; `helpers/status/WP-4d.md` and `helpers/decisions/hidden-gems-proposal.md` note the superseded digit `gem_line`
- No live Telegram, Drive mailbox, Claude API, wake-route or routine call in this phase; the private repo changes (integration dry run, skill hardening, vendor re-pin) are TourGuide PR #4, to be merged after PR #3

## [v01.27r] — 2026-10-01 08:10:13 AM EST

> **Prompt:** "Read helpers/prompts/TG-PHASE-5.md (LightAISolutions/Personal) and execute it exactly." *(and, answering the Lane B question mid-phase: "Give me both options in some sort of toggle, with the free option being the default. I want the ability to toggle on my Claude API usage for faster, smarter answers.")*

### Added
- **Tour Guide chatbot pack** `helpers/packs/tour-guide/gas/` (Phase 5): `00_common.js` (request routing to the seven routines, shared helpers); `10_commands.js` (`/profile /trip /today /day /later /place /places /replan /notes /brochure /lodging`, the `/start` interview offer); `11_flow_interview.js` (`/interview`); `12_flow_plan.js` (`/plan` intake → confirm → research → shortlist rounds → plan, `/seed`); `13_flow_review.js` (`/review` and the daily post-trip offer); `20_envelopes.js` (handlers for the six pack envelope types, prefs review `pf:` buttons with ✏️ capture → a `prefs` request carrying `decisions`); `21_sheets.js` (tabs `Trips DayPlans Later Places Choices Shortlist` and their storage API); `30_chat_api.js` (Lane B: direct Claude API answers behind the owner's `/smart on|off` toggle, free routines by default, daily cap and usage counter); `31_route.js` (`/route`); `40_interview_bank.js` (generated from the prefs kit's travel interview bank)
- **Core**: renderer hooks `core_start` (a pack's message after `/start` and pairing) and `core_status` (a pack's lines in `/status`), SPEC §5; `redactSecrets()` also redacts every `*_API_KEY` property value, SPEC §4
- **Bundler**: generated-file step — `bundle.mjs` writes `gas/40_interview_bank.js` from `kits/prefs/presets/travel.interview.json`; `--check` fails when it is stale
- Tests: `pack_tour-guide_gas_{chat,commands,e2e,envelopes,interview,plan,review,route,sheets}.test.js` (the mock end-to-end runs the interview, the `/plan` journey with a lost wake and the +10 fallback, places, the post-trip review and refusals); core router/config tests for the new hooks and redaction; 373 pass, 1 skipped
- `helpers/decisions/TG-PHASE-5.md` (contract, Lane B toggle, defaults, measured trigger minutes, carried items), `helpers/decisions/WP-5{a,b,c}.md`, `helpers/status/WP-5{a,b,c}.md`, `helpers/status/PHASE-5-RESUME.md`
- `helpers/prompts/TG-PHASE-6.md` — Phase 6 kickoff (integration across both repos, red-team, PDF delivery, cost and quota audit, `helpers/docs/TG-SWITCH-ON.md`) on Fable 5.1 · xhigh

### Changed
- `helpers/packs/tour-guide/README.md`: Chatbot section (files, answer lanes, Script Properties, trigger minutes); tests list
- `helpers/BUILD-STATE.md`: row 5 **done**, row 6 prompt written, Phase 5 log, Next = Phase 6
- Test harness: mock Drive dates follow the test clock
- Audit fixes: place buttons carry a tagged key so a stale list cannot act on another place; Lane B sends extended thinking only to the model that accepts it; untrusted context sent to the Claude API cannot close its data block
- No live Telegram, Drive, Maps, Claude API, wake-route or routine call in this phase; the private repo's review-decision path (`prefs-build-ingest.mjs --decisions`) is its PR #3

## [v01.26r] — 2026-10-01 05:45:21 AM EST

> **Prompt:** "Read helpers/prompts/TG-PHASE-4B.md in LightAISolutions/Personal and execute it exactly." *(the same interaction, continued: WP-4d in the private repo and the Phase 4b close-out)*

### Added
- `helpers/status/WP-4d.md` and `helpers/decisions/WP-4d.md` — generic copies of the private repo's WP-4d status (contract table, checks, the `/plan` journey dry-run of 83 checks and 23 validated envelopes, requests R1–R9) and decisions (S1–S5 shared, A1–A9 trip-research, B1–B4 plan-days and trip-check, C1–C6 prefs-build and routines, P1–P3); README tree entries

### Changed
- `helpers/BUILD-STATE.md`: row 4 (the TourGuide Phase 4 branch merged, PR #1), row 4b **done**, the WP-4d entry in the Phase 4b log, Next = Phase 5 on Opus 5.5 · high; row 2g (Places Aggregate live-verified by the design thread, Phase 7 smoke); row 8 owner-input item (ask the owner how the Google-based Japan train estimates felt — Ekispert's paid timetable service is the named upgrade)
- `helpers/decisions/TG-PHASE-4B.md`: §1 decisions 18–21 at their defaults with 19 confirmed by the owner; §5 `drive_file_ids` labels `plan · brochure_html · brochure_pdf · notes`; §6 Aggregate; §8 renumbered — Phase 6's open point, Japan transit decided (layered transit leg, Phase 8 asks the owner), WP-4d as built with requests R2 (`floor_reason`) and R3 (`gem_line` digits → Phase 6) carried here
- `helpers/prompts/TG-PHASE-5.md`: `drive_file_ids` labels; open items (3) Aggregate, (4) decision 19 and Japan transit with the re-pin condition, (5) the Phase 4 branch merged and the Phase 4b branch to read the skills from, (7) WP-4d's requests for Phase 5
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md`: status line (Phases 0–4b built, Phase 5 next), Phase 8 row owner-input item, §10 tail
- No live Google, Telegram or Drive call in this phase; `vendor/helpers/` in the private repo changed only through the pin bump

## [v01.25r] — 2026-10-01 04:44:25 AM EST

> **Prompt:** "Read helpers/prompts/TG-PHASE-4B.md in LightAISolutions/Personal and execute it exactly."

### Added
- **Core (WP-1b)**: `helpers/core/15_flows.js` — multi-step conversations (`registerFlow`, `flowStart` / `flowActive` / `flowResume` / `flowCancel`, the `Flows` tab, `fl` callback prefix, `/cancel`, pause/resume, expiry in the sweep); `tgSendDocument` / `tgSendOwnerDocument` (Telegram documents ≤ 50 MB, link fallback) and `reply.payload.drive_file_ids` sent as silent captioned documents; SPEC §2 / §5 / §8 / §18; `tests/core_flows.test.js`
- **Prefs kit (WP-2f)**: travel vocabulary at 22 dimensions (climate, hidden-gem appetite, off-track minutes, rough edges, …), the interview question bank `presets/travel.interview.json` (39 questions, 13 sections) with `schemas/travel.interview.schema.json`, the `interview` command (three input shapes, supersede rule, bank warnings, plain-text profile summary); `tests/kit_prefs_interview.test.js`
- **Engine (WP-3d)**: `planner/planner-choices.mjs` — `planTrip` honours the owner's `choices` (`picks`, `later` → "Saved by you", `skip`); trip status enum `intake · researched · choosing · planned · delivered · done`; Place `destination`, `history[]`, `last_researched`, `last_verified`; shortlist `seen_before`, `changes`, `dims`; the six payload schemas `tour-guide-{shortlist,trip-facts,plan-digest,profile-summary,prefs-review,places-digest}.schema.json`, `PAYLOAD_KINDS`, `validatePayload`; the manifest's `envelope_types`; `tests/pack_tour-guide_{choices,payloads}.test.js`
- **Engine (WP-3e)**: transit fallback — `trip.transit_fallback { kmh, overhead_min, source, note }`, distance estimates (`estimateTransit`, `transitFallback`, route factor 1.3) for TRANSIT legs Google cannot route, `estimated` legs and one `transit_estimated` warning per day, chained after the v01.24r rail estimates; `tests/pack_tour-guide_planner_transit-fallback.test.js`
- **Gem Funnel (WP-2g, plan amendment v01.25r)**: Maps kit `searchNearby` (Pro / Enterprise / Atmosphere), Text Search `minRating` and `enterprise_atmosphere`, Places Aggregate `computeInsights` (`lib/maps-aggregate.mjs`), five SKUs and five fixtures; research kit `mentions` with `source_kind` and `language`; the engine `packs/tour-guide/gems/` (screening, gem score and 💎 rule, evidence flags, gem line, shortlist floors by appetite, "Gems not chosen" Later list, `toPlaceFields` / `toShortlistFields`) with an invented fixture town; `tests/kit_maps_gems.test.js`, `kit_research_sources.test.js`, `pack_tour-guide_gems.test.js`
- Plan §5.2, §5.9 step 3, §11d and decisions 22–26 (the Gem Funnel) in `repository-information/TOUR-GUIDE-BUILD-PLAN.md`; `helpers/decisions/TG-PHASE-4B.md`, `helpers/decisions/WP-{1b,2f,2g-kits,2g-engine,3d,3e}.md`, `helpers/status/WP-{1b,2f,2g-kits,2g-engine,3d,3e}.md`

### Changed
- `helpers/prompts/TG-PHASE-4B.md` (WP-2g, WP-3e, `gems_only` / `seeds`, the funnel in WP-4d) and `helpers/prompts/TG-PHASE-5.md` (the `FINALIZE (Phase 4b)` block filled with the real names and paths; `pf` registered by the pack; the interview-bank bundle step as a Phase 5 task); `helpers/BUILD-STATE.md` (rows 1b, 2f, 3d done, rows 2g and 3e added, Phase 4b log, Next); `helpers/packs/tour-guide/README.md` (choices, transit fallback, gems, payload table); `helpers/kits/{maps,prefs,research}/README.md`; `helpers/decisions/WP-2a.md` default 1 pointer; later-list codes `owner_choice`, `not_shown`; fixtures and tests moved from trip status `draft` to `intake`
- 302 tests passing (1 skipped), bundle `--check` and boundary check clean; no live Google, Telegram or Drive call in this phase

## [v01.24r] — 2026-10-01 04:13:42 AM EST

> **Prompt:** *(continuation of the v01.23r interaction)* decision card "Choose how Tour Guide plans Japan train legs": "Google estimate"

### Added
- Tour Guide planner: station-based train estimates where Google returns no transit route (Japan) — `planner/planner-rail.mjs` (`withRailEstimates`, `railEstimate`, `rideMinutes`, `walkMinutes`, `RAIL`). `planTrip` wraps the Maps client with it (opt out with `railEstimates: false`): nearest train, subway or light-rail stations from Google Text Search (one Pro call per point, cached for the build), walk + estimated ride + walk, the leg line `A Station → B Station (estimate)`, and the existing Google Maps transit link for the exact train. Verified live on Tokyo pairs
- Tests: `pack_tour-guide_rail.test.js` (233 passing in all)

### Changed
- `helpers/decisions/WP-2e.md` choice 15 revised: NAVITIME through RapidAPI dropped (Japanese-only output and average times on that tier; its terms forbid storing, caching or translating results), station-based estimates chosen by the owner; `helpers/decisions/TG-PHASE-2.md` §4 Japan-transit row marked done; `helpers/packs/tour-guide/README.md`, `helpers/BUILD-STATE.md`, `README.md` tree

## [v01.23r] — 2026-10-01 04:05:15 AM EST

> **Prompt:** "I really like the new live sample with real Google maps. I rate it 10/10. However, it is unacceptable that you are unable to route me using Google Maps and Japan's train stations; That is 100% how I plan Japan trips myself. Recommend some resolutions." · decision card: "Both"

### Added
- Brochure kit: a Google Maps directions link on every leg (`lib/directions.mjs`, Maps URLs, no key): built from both ends' coordinates and place ids, the lodging for `lodging` ends; taxi legs link the train options ("by train ↗"); a leg's own `maps_url` still wins. `directionsUrl` exported for other surfaces
- Tests: `kit_brochure_directions.test.js` (229 in all)

### Changed
- `helpers/kits/brochure/README.md`, `helpers/decisions/WP-2e.md` (choice 15: train routing in Japan, NAVITIME chosen for real train legs), `README.md` tree

## [v01.22r] — 2026-10-01 03:53:32 AM EST

> **Prompt:** "Ok, I added the 3rd credential. Now give me step by step instructions on how to rotate the MAPS_STATIC_KEY."

### Changed
- `helpers/decisions/hidden-gems-proposal.md` — decision 23 recorded as done: the owner enabled the Places Aggregate API, added it to the Maps key's API restrictions and added a Claude HQ credential entry for `areainsights.googleapis.com`; verified from the session with one live `computeInsights` call (HTTP 200, a count returned), so the Gem Funnel's quiet-neighbourhood stream can be built live in Phase 4b instead of waiting for Phase 7
- `repository-information/SESSION-CONTEXT.md` — session context updated

### Fixed
- `helpers/decisions/hidden-gems-proposal.md` — stray backslashes before the quotation marks in the header's decisions line

## [v01.21r] — 2026-10-01 03:44:29 AM EST

> **Prompt:** *(continuation of the v01.16r interaction — no new owner prompt; this push repairs the auto-merge collision and writes the Phase 4b delta the coordinator asked for)*

### Added
- `helpers/prompts/TG-PHASE-4B-DELTA.md` — delta for the running Phase 4b session: what the v01.16r amendment added to its prompt (Place `destination` · `history[]` · `last_researched` · `last_verified`, shortlist `seen_before` · `changes` · `dims`, the sixth payload schema `places_digest`, re-check before re-research, the `places` request kind, choice evidence, `review` prefs, the second-trip dry run, the no-Google-field check), with the diff command that shows the exact wording

### Changed
- `helpers/BUILD-STATE.md` — row 4b now **in progress** with the delta file named; Next rewritten for a running Phase 4b
- `README.md` — tree entry for the delta file
- `repository-information/SESSION-CONTEXT.md` — this session's entry updated and made latest; the hidden-gems session kept as the previous entry

### Fixed
- `repository-information/CHANGELOG.md` — restored the three sections the auto-merge's "theirs" conflict strategy dropped when three branches landed within minutes (v01.16r "Phase 4 done", v01.16r "interaction surfaces", v01.17r "real Google maps and place photos"); sections now sit in push order and the counter matches
- `helpers/BUILD-STATE.md` — restored the Phase 4 **done** row, the Phase 4 log and the Phase 4 hand-off text that the same collision overwrote

## [v01.20r] — 2026-10-01 03:38:59 AM EST

> **Prompt:** "Should I enable Nearby Search and the Places Aggregate API now? I approve all other defaults."

### Changed
- `helpers/decisions/hidden-gems-proposal.md` — decisions renumbered 22–26 (the plan's §10 already holds 18–21 from the interaction-design amendment of v01.16r); the owner's answers recorded: 22, 24, 25 and 26 confirmed at their defaults, 23 (Places Aggregate API) chosen as "enable now" instead of Phase 7, with the note that Nearby Search needs no enabling because it is a Places API (New) method the existing key covers
- `README.md` — tree entry for the proposal (decision numbers)
- `repository-information/SESSION-CONTEXT.md` — this session's entry restored as the latest session (an earlier auto-merge had left its body under the "Amend plan for Telegram vision" header) and updated with the owner's answers; the "Ways to interact with Tour Guide" session kept as the previous one

## [v01.19r] — 2026-10-01 03:33:09 AM EST

> **Prompt:** "When the work is merged, build a live sample brochure with real maps and photos … save it under /mnt/project-files/tour-guide/phase-2/ … and post it in this thread for the owner's rating." (coordinator brief, continuing the owner's "10/10 once the map is fixed")

### Fixed
- Brochure and Maps kits: real Google Place Photo names were rejected (their photo ids run 400–460 characters; the pattern allowed 400). The photo-id part now allows up to 2,000 characters, with tests using a realistic-length name
- `kit_brochure_google_images.test.js`: the schema check after `addGoogleImages` compared an error array with `.ok` and could never fail; it now expects no errors

### Changed
- Google maps in the brochure also hide POI pin icons and road-shield icons (Google's green numbered highway shields read as the brochure's green numbered stops in the live Tokyo sample); place, station and park names stay
- `helpers/decisions/WP-2e.md` (choices 5, 12, 13: map styles, photo names, no transit routes in Japan), `helpers/decisions/TG-PHASE-2.md` §4 (planner request: transit fallback in Japan), `helpers/BUILD-STATE.md` (live sample sent)

## [v01.16r] — 2026-10-01 03:32:47 AM EST

> *This push and "Phase 4 done" (further down) both took the v01.16r number within sixteen minutes; both sections are kept under their commit labels, and this file lists sections in push order.*

> **Prompt:** "Also, I gave one example of how I could interact with the Tour Guide helper and all its functions (via the /plan Tokyo, Japan command to the chatbot), but I want you to create a new thread on Fable 5.1 high or xhigh (your choice) to think about other ways to allow me to interact with all the tools you are building now. I'm also considering having you create a web app that allows Tour Guide to gather information from me about my upcoming trip at a location I provide (ie: Tokyo, Japan) and display the finished travel brochures. I want to have a personal repository of places that Tour Guide has researched, so that all that effort is not wasted. Who knows? Even the best plans go wrong or maybe I will decide on the fly that I want to change my itinerary. Either way, I will be able to browse through this repository to find an alternative. Also, if I ask Tour Guide to plan two different itineraries for the same location at two different points in time, Tour Guide will be able to go through the existing repository places to check if they are still in business, and if so, what has changed about them since we last looked at them.
>
> Given the context above, i want you to evaluate different options and recommend me a way to interact with Tour Guide to allow it to best generate a travel plan that I will enjoy. Also, you may need to update the Tour Guide plan accordingly."

### Added
- `helpers/prompts/TG-PHASE-9.md` — Phase 9 kickoff (a draft Phase 8 finalizes, or Phase 6 if the owner pulls the app forward): the Tour Guide app as a Telegram Mini App — core `registerRoute` (fifteenth registry; the four built-in routes stay fixed), `tgVerifyInitData` (HMAC-SHA256 keyed by the bot token, 24-hour window, owner id, constant-time compare), `tgSetMenuButton`, `APP_SHELL_URL` and `MAX_APP_CALLS_PER_DAY` (WP-9a, coordinator Fable 5.1 · high); the pack's `?route=app` operations that reuse the chat's request and callback paths plus a menu-button setup step and `web_app` buttons (WP-9b, Opus 5.5 · high); the generic data-free shell `live-site-pages/helper-app.html` under this repo's page conventions with only Telegram's script, no key, sandboxed brochure frame, Playwright screenshots (WP-9c, Fable 5.1 · high); Step 0 verifies the GitHub Pages → Apps Script cross-origin inference before any WP starts; a security review of route and shell before the merge

### Changed
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — amended for the interaction surfaces: new §5.10 (the places repository — one note per place with a per-trip history, re-check before re-research with `RECHECK_DAYS` 90, own dated claims only and no Google field stored; the learning loop — shortlist ✅ 🔖 ❌ and post-trip `/review` taps become preference evidence, positives confirm, negatives held until support 2), new §5.11 (seven interaction options compared, the Tour Guide app chosen as Phase 9 with its screens, launch, hosting and trust model, and the one inference to verify), §4 diagram and §4.1 layout (app surface, `?route=app`, `trip-check` re-checks, places digests), §4.2 repository naming, §4.4 Place history fields plus PlaceCheck · PlacesDigest · ChoiceEvidence, §5.1 and §5.5 learning-loop sentences, §5.9 `/places` and `/review` with the journey re-checking known places first, §6 rows 3 / 4b / 5 / 6 / 8 extended and a new Phase 9 row with model and effort, §8 two cost bullets, §9 four risk rows, §10 decisions 18–21, new §11c, §12 next steps
- `helpers/BUILD-STATE.md` — rows 3d / 4b / 5 / 8 extended, new row 9 (the Tour Guide app, not started), finish priority, v01.16r amendment log, Next
- `helpers/prompts/TG-PHASE-4B.md` — WP-3d: Place gains `destination`, `history[]`, `last_researched`, `last_verified`; shortlist items gain `seen_before`, `changes[]`, `dims[]`; sixth payload schema `places_digest` (rejects Google fields); WP-4d: re-check before re-research, the `places` request kind answered by `trip-check`, choice evidence and `places_digest` from `plan-days`, `review` prefs, a second `/plan` for the same fixture destination in the dry run
- `helpers/prompts/TG-PHASE-5.md` — `/places [query]` and `/review [trip]` commands, `places_digest` handler and `Places` tab, repository counts in the snapshot, `ps` / `rv` callback prefixes, e2e additions, red-team of `/places` output, pointer to the Phase 9 draft for Phase 6
- `README.md` — tree entry for the new prompt file
- `repository-information/SESSION-CONTEXT.md` — session context saved

### Fixed
- `helpers/prompts/TG-PHASE-4B.md`, `helpers/prompts/TG-PHASE-5.md` — pipes inside code spans on table rows are escaped so the work-package tables render as tables

## [v01.18r] — 2026-10-01 03:27:41 AM EST

> **Prompt:** "Also, I gave one example of how I could interact with the Tour Guide helper and all its functions (via the /plan Tokyo, Japan command to the chatbot), but I want you to create a new thread on Fable 5.1 high or xhigh (your choice) to think about other ways to allow me to interact with all the tools you are building now. I'm also considering having you create a web app that allows Tour Guide to gather information from me about my upcoming trip at a location I provide (ie: Tokyo, Japan) and display the finished travel brochures. I want to have a personal repository of places that Tour Guide has researched, so that all that effort is not wasted. Who knows? Even the best plans go wrong or maybe I will decide on the fly that I want to change my itinerary. Either way, I will be able to browse through this repository to find an alternative. Also, if I ask Tour Guide to plan two different itineraries for the same location at two different points in time, Tour Guide will be able to go through the existing repository places to check if they are still in business, and if so, what has changed about them since we last looked at them.
>
> Given the context above, i want you to evaluate different options and recommend me a way to interact with Tour Guide to allow it to best generate a travel plan that I will enjoy. Also, you may need to update the Tour Guide plan accordingly."

### Added
- `helpers/prompts/TG-PHASE-9.md` — Phase 9 kickoff (a draft Phase 8 finalizes, or Phase 6 if the owner pulls the app forward): the Tour Guide app as a Telegram Mini App — core `registerRoute` (fifteenth registry; the four built-in routes stay fixed), `tgVerifyInitData` (HMAC-SHA256 keyed by the bot token, 24-hour window, owner id, constant-time compare), `tgSetMenuButton`, `APP_SHELL_URL` and `MAX_APP_CALLS_PER_DAY` (WP-9a, coordinator Fable 5.1 · high); the pack's `?route=app` operations that reuse the chat's request and callback paths plus a menu-button setup step and `web_app` buttons (WP-9b, Opus 5.5 · high); the generic data-free shell `live-site-pages/helper-app.html` under this repo's page conventions with only Telegram's script, no key, sandboxed brochure frame, Playwright screenshots (WP-9c, Fable 5.1 · high); Step 0 verifies the GitHub Pages → Apps Script cross-origin inference before any WP starts; a security review of route and shell before the merge

### Changed
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — amended for the interaction surfaces: new §5.10 (the places repository — one note per place with a per-trip history, re-check before re-research with `RECHECK_DAYS` 90, own dated claims only and no Google field stored; the learning loop — shortlist ✅ 🔖 ❌ and post-trip `/review` taps become preference evidence, positives confirm, negatives held until support 2), new §5.11 (seven interaction options compared, the Tour Guide app chosen as Phase 9 with its screens, launch, hosting and trust model, and the one inference to verify), §4 diagram and §4.1 layout (app surface, `?route=app`, `trip-check` re-checks, places digests), §4.2 repository naming, §4.4 Place history fields plus PlaceCheck · PlacesDigest · ChoiceEvidence, §5.1 and §5.5 learning-loop sentences, §5.9 `/places` and `/review` with the journey re-checking known places first, §6 rows 3 / 4b / 5 / 6 / 8 extended and a new Phase 9 row with model and effort, §8 two cost bullets, §9 four risk rows, §10 decisions 18–21, new §11c, §12 next steps
- `helpers/BUILD-STATE.md` — rows 3d / 4b / 5 / 8 extended, new row 9 (the Tour Guide app, not started), finish priority, v01.16r amendment log, Next
- `helpers/prompts/TG-PHASE-4B.md` — WP-3d: Place gains `destination`, `history[]`, `last_researched`, `last_verified`; shortlist items gain `seen_before`, `changes[]`, `dims[]`; sixth payload schema `places_digest` (rejects Google fields); WP-4d: re-check before re-research, the `places` request kind answered by `trip-check`, choice evidence and `places_digest` from `plan-days`, `review` prefs, a second `/plan` for the same fixture destination in the dry run
- `helpers/prompts/TG-PHASE-5.md` — `/places [query]` and `/review [trip]` commands, `places_digest` handler and `Places` tab, repository counts in the snapshot, `ps` / `rv` callback prefixes, e2e additions, red-team of `/places` output, pointer to the Phase 9 draft for Phase 6
- `README.md` — tree entry for the new prompt file
- `repository-information/SESSION-CONTEXT.md` — session context saved

### Fixed
- `helpers/prompts/TG-PHASE-4B.md`, `helpers/prompts/TG-PHASE-5.md` — pipes inside code spans on table rows are escaped so the work-package tables render as tables

## [v01.17r] — 2026-10-01 03:24:20 AM EST

> **Prompt:** "The sample itself looks great! However, I want the attached map to actually be a screenshot of Google map in the final product." · "Or 9/10, 10/10 once the map is fixed." · "I completed steps 1-8 above"

### Added
- Brochure kit: real Google maps. `lib/google-images.mjs` (`addGoogleImages`) fetches a Maps Static API image per day and one for the trip at a centre and zoom the kit computes, Compute Routes lines for legs without one, and Google place photos; everything is inlined as data URIs and the input model is never changed. `lib/mapframe.mjs` fits and projects (Web Mercator) so the brochure's own numbered badges, meal rings and lodging house sit exactly on the Google map, with Google's logo and copyright kept clear
- Brochure kit: `--google [--ledger PATH]` on `render` / `build` / `sample`; model fields `trip.map_image` / `days[].map_image` (with `view`), `places.*.google_photo`, `days[].legs[].polyline`
- Place cards show the Google photo credited "Photo by <author> · Google Maps"; the sources page and colophon state that the maps are Google Maps with markers added
- Maps kit (from the Phase 2 thread's saved work): Maps Static API builder and client (`MAPS_STATIC_KEY` appended at send time, never logged; `NO_KEY` refusal; URL length reducer; optional signing), Place Photos, encoded polylines, offline stand-in PNGs, `static-url` / `static-map` / `photo` CLI commands, Static Maps and Place Details Photos SKUs with 80 % ceilings
- Tests: `kit_maps_static_photos.test.js`, `kit_brochure_google_images.test.js`, a `--google` guard in `kit_brochure_cli.test.js` (225 in all)
- `helpers/decisions/WP-2e.md` — choices, Google attribution and print terms, costs

### Changed
- Brochure kit: without `MAPS_STATIC_KEY`, or when any Google call fails, the drawn route sketch, no photo and straight lines remain (with a warning). Google photos use a 5:2 strip so long cards fit one page; the owner's own images keep 3:2
- `helpers/kits/brochure/README.md`, `helpers/kits/maps/README.md`, `helpers/decisions/TG-PHASE-2.md` (rating 9/10 recorded, requests for Phase 4b/5), `helpers/BUILD-STATE.md` (MAPS_STATIC_KEY, Phase 2 log), `README.md` tree

### Fixed
- Maps kit stand-in PNG read only part of an encoded polyline that contained `|`

## [v01.16r] — 2026-10-01 03:16:38 AM EST

> **Prompt:** "Restart both threads from where they started on whichever AI model and effort level they were at before the pause"

### Added
- `helpers/decisions/TG-PHASE-4.md` — Phase 4 (Tour Guide brain side in the private repo): coordinator defaults, the request-kind contract as implemented (`research` with `intake` / `more` / `decided`, `plan` with `picks` / `later` / `skip` / `deliverables`, `replan`, `notes`, `brochure`, `prefs` with interview answers, free text), the `shortlist` / `trip_facts` / `prefs_review` payloads the drivers already write, the Drive and memory layout, every driver's name and flags, the routine table, what each skill needs from the core, a "For Phase 4b" section, requests carried, checks at push
- `helpers/status/WP-4a.md`, `WP-4b.md`, `WP-4c.md` and `helpers/decisions/WP-4a.md`, `WP-4b.md`, `WP-4c.md` — generic copies of the private repo's per-package status (contract tables, dry runs on the two invented fixture trips, requests) and defaults
- `helpers/templates/private-repo/scripts/merge-maps-ledger.mjs` — git merge driver for `log/maps-usage-ledger.json`: per month × SKU × field `ours + theirs − base`, `updated_at` the later side; anything that is not a v1 ledger still conflicts

### Changed
- `helpers/templates/private-repo/.gitattributes`, `.github/workflows/merge-routine-memory.yml`, `scripts/merge-routine-memory.sh`, `README.md` — the Maps ledger merges through the new driver (`merge=maps-ledger`, two `git config` lines before the sweep) and the memory allow-list accepts `.json` files; the template README names the new script
- `helpers/tests/tools_new_helper.test.js` — a rendered private repo must carry the merge driver and the `.gitattributes` line
- `helpers/BUILD-STATE.md` — Phase 4 done, the TourGuide repo row, Phase 4b marked next, Phase 4 log, Next (Phase 4b kickoff)
- `README.md` — tree entries for every new file
- `repository-information/SESSION-CONTEXT.md` — session context saved

## [v01.15r] — 2026-10-01 02:50:57 AM EST

> **Prompt:** "In my project goal, I forgot to mention that my vision for the final product is a chatbot via Telegram that starts me off with an extensive interview about my food & activity preferences, hot/cold tolerance, and other useful questions that helps it understand my likes and dislikes. Then, I want to have multiple commands that I can give it to automate tasks, such as "/plan Tokyo, Japan" and it would review the information available to it via my connectors related to "Tokyo, Japan", conduct additional web research to see current options and evaluate them for me, recommend me several activities/food options, then takes my choices and generates a professional, beautiful travel brochure like the sample you gave me. Given the context above, amend the plan (both built and unbuilt) to implement my vision."

### Added
- `helpers/prompts/TG-PHASE-4-DELTA.md` — additions for the running Phase 4 session: `plan` requests gain `later`, `skip` and `deliverables` beside `picks`; the research skill writes a structured shortlist and handles an `intake` scope; `prefs-build` accepts interview answers; the hand-off now points at Phase 4b
- `helpers/prompts/TG-PHASE-4B.md` — new gap-closure phase (Fable 5.1 · high): core flows primitive and Telegram document delivery (WP-1b), prefs interview bank, eleven new vocabulary dimensions and an `interview` command (WP-2f), engine choices, statuses and the five pack envelope types (WP-3d), TourGuide skill deltas and pin bump (WP-4d)
- `helpers/prompts/TG-PHASE-5.md` — Telegram commands and flows phase (Opus 5.5 · high): `/start`, `/interview`, `/profile`, the five-step `/plan` flow, envelope handlers and sheets, Lane B and `/route`; carries a FINALIZE block Phase 4b fills in

### Changed
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — amended for the owner's Telegram vision: scope and §4 architecture, data model (trip and place statuses, Shortlist, FlowState, PlanDigest), §5.1 interview-first preferences, §5.2/§5.7/§5.8 additions, new §5.9 owner's journey (`/plan <destination>` as a five-step chat flow ending in a brochure PDF), §6 gap work packages 1b/2f/3d and a new Phase 4b, Phases 5–8 rewritten, §8 per-plan costs, §9 four new risks, §10 decisions 14–17, new §11b amendment summary, §12 kickoff
- `helpers/BUILD-STATE.md` — gap rows 1b/2f/3d, Phase 4 marked in progress with its delta file, new Phase 4b row, Phases 5–8 rewritten, plan amendment log, Next updated
- `README.md` — tree entries for the three new prompt files
- `repository-information/SESSION-CONTEXT.md` — session context saved

## [v01.14r] — 2026-10-01 01:56:30 AM EST

> **Prompt:** "Read helpers/prompts/TG-PHASE-3.md and execute it exactly."

### Added
- `helpers/packs/tour-guide/` — the Tour Guide engine pack (Phase 3): `helper.json` manifest (name `tour-guide`, Drive root `TourGuide`, memory dirs `trips places profile`, `timezone` default `America/New_York`, empty `gas/` until Phase 5) and a pack README that walks the data flow
- `helpers/packs/tour-guide/schemas/` — JSON Schemas for `trip`, `place`, `google-snapshot`, `visit-estimate`, `place-note`, `calibration`, `day-plan`, `later-list`, `plan`, `profile-excerpt`, plus cross-field and date checks; `validate(entity, kind)` → `{ ok, errors }`
- `helpers/packs/tour-guide/estimator/` — visit-duration estimator: `buildEstimate` from notes, snapshot and category defaults, `chooseMinutes` by pace, calibration state with `createCalibration` / `applyTap` / `calibrationFactor`
- `helpers/packs/tour-guide/later/` — saved-for-later lists: `createLists`, `addItem`, `promote` (returns `affected_days`), `demote`
- `helpers/packs/tour-guide/fixtures/` — two invented trips on reserved domains (`transit-city`, three TRANSIT days; `driving-loop`, four DRIVE days), eight JSON parts each, a Maps mock responder that replays the Route Matrix and Compute Routes answers, `fixtureTravel` for the expected pair answer
- `helpers/packs/tour-guide/planner/` — `planTrip`, `replanDays`, `estimateBudget`, `PlanBudgetError`, `hoursOn`, `dateRange`: candidates by date, one Route Matrix per day, Held-Karp with time windows / bookings / lunch slot, real legs pair by pair with a re-solve on the real times, Google cross-check, warnings (`hours_unknown`, `tight_connection`, `over_long_day`, `order_disagreement`), Later codes (`too_far`, `closed_business`, `outside_day`, `day_full`), SKU budget checked against the ledger ceiling before any call, deterministic by seed
- `helpers/packs/tour-guide/brochure-map/` — `toBrochureModel`, `renderPlan`, `renderPlanPdf`: Plan → brochure-kit model (days, cards with hours today and one credited review, Later lists, practical blocks, Google attribution) → HTML / PDF
- `helpers/tests/pack_tour-guide_*.test.js` + `pack_tour-guide_planner_world.js` — 58 new tests (206 in the suite, 1 skipped live smoke), including the cross-WP integration test that checks the Phase 3 property set on both fixtures end to end
- `helpers/status/WP-3a.md` … `WP-3c.md`, `helpers/decisions/WP-3a.md` … `WP-3c.md` — per-package status and defaults
- `helpers/decisions/TG-PHASE-3.md` — coordinator defaults, ownership-map extension, solver design and limits, requests carried to later phases
- `helpers/prompts/TG-PHASE-4.md` — Phase 4 kickoff for the brain side in the private repo

### Changed
- `helpers/templates/private-repo/CLAUDE.md` — the memory-directories line no longer double-wraps the rendered list in backticks
- `helpers/tests/tools_bundle.test.js` — asserts the `hello` pack is listed rather than that it is the only pack
- `helpers/BUILD-STATE.md` — Phase 3 done, Phase 3 log, next step (Phase 4)
- `README.md` — tree entries for every new file

## [v01.13r] — 2026-10-01 01:12:03 AM EST

> **Prompt:** "Start phase 2"

### Added
- `helpers/kits/maps/` — Places API (New) + Routes API client: one fixed field mask per SKU tier, a monthly SKU ledger with a hard stop before any call over its ceiling, build-scoped Google snapshots with a terms-driven purge, Google Maps URLs, a zero-dependency transport through the HTTPS proxy tunnel, CLI with `--live` for network calls, fixtures in the real API shapes
- `helpers/kits/research/` — research-run contract: search/fetch/time budgets, a source ledger, the two-independent-sources rule, confidence labels (conflicting, unverified, stale, confirmed, likely, single-source), a prompt-injection scanner for untrusted text, visit-duration ranges, CLI and library
- `helpers/kits/brochure/` — brochure renderer: JSON Schema model → one self-contained HTML document (no script, no network) → paginated PDF through the pre-installed Chromium; cover, trip at a glance, day spreads with a timeline rail and route sketch, place cards, saved-for-later lists, practical notes, Google Maps attribution; Bitstream Charter fonts with their notice; invented sample trip
- `helpers/kits/prefs/` — connector-reader pattern for preferences: evidence → held notes → owner review (✅ / ✏️ / ❌, sized for Telegram) → confirmed profile; travel vocabulary preset
- `helpers/tests/kit_*` — 94 new tests across the four kits (148 in the suite; the live Maps smoke is skipped unless asked)
- `helpers/status/WP-2a.md` … `WP-2d.md`, `helpers/decisions/WP-2a.md` … `WP-2d.md` — per-package status and defaults
- `helpers/decisions/TG-PHASE-2.md` — coordinator defaults, smoke-call findings, brochure rating, requests carried to later phases
- `helpers/prompts/TG-PHASE-3.md` — Phase 3 kickoff for the Tour Guide engine
- `.claude/agents/hb-builder-opus-medium.md` — Opus 5.5 · medium builder for tightly specified work packages

### Changed
- `helpers/SPEC.md` — §16 kit CLI form is `node helpers/kits/<kit>/index.mjs <command>`
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — Phase 2a corrections to facts 2, 7, 10 and 12; Google snapshot content is build-scoped (§4.4, §9)
- `helpers/BUILD-STATE.md` — Phase 2 done, Phase 2 log, next step

## [v01.12r] — 2026-09-30 11:33:51 PM EST

> **Prompt:** "Start Phase 1"

### Added
- `helpers/core/` — generic Apps Script core (15 files) generalized from the first helper after the owner-approved scrub report: config from a pack manifest (`HELPER.*`, prefixed Script Properties, `LIMITS`), extension registries as the only extension point, Sheet store + audit log, Telegram client, queue with one-off worker triggers, executor (proposal → owner ✅ → allowlisted action), Drive mailbox relay, web-app router (`?route=tg|wake|setup`), wake route with no permanent tick, routine fire client, owner setup page
- `helpers/tools/` — `bundle.mjs` (manifest validation, one Apps Script project from core + pack `gas/`, `--check`, `--all`), `envelope.mjs` (same CLI as the first helper, `--pack` adds manifest types), `new-helper.mjs` (scaffolds a pack and a private repo from the template), `boundary-check.mjs` + `boundary-allowlist.txt` (fails on secrets, PII and personal-data paths; CI gate)
- `helpers/templates/private-repo/` — dual-mode `CLAUDE.md`, skills and routines READMEs, trimmed `remember-session` skill, memory dirs, `.gitattributes` union merge, `merge-routine-memory.yml` + script, `DEV-SESSION.md` with the `/update-helpers` pin bump, `vendor/helpers/` first-pin instructions
- `helpers/packs/hello/` — the smallest pack (extra envelope type, command, message handler, snapshot provider, daily job, setup step) that bundles and runs in the mocks
- `helpers/tests/` — 14 `node --test` suites (54 tests) + in-memory Apps Script mocks; the boundary test plants a fake secret and a personal-data path and asserts the check fails
- `helpers/SPEC.md` — framework contract v1 in 18 sections (three homes, envelope v1, mailbox and requests, manifest, registries, routes and wake contract, properties, sheet, triggers, routines, executor, setup page, tools, CI/dist/deploy, vendoring procedure with the measured subtree decision, file-ownership map for Phase 2, how a new helper is added, limits)
- `helpers/README.md` — framework overview, quick start, how to add a helper, the public/private rules
- `.claude/agents/hb-architect.md`, `hb-builder-fable.md`, `hb-builder-opus.md`, `hb-reader.md` — build agents with model, effort and (reader) `disallowedTools`
- `.github/workflows/helpers-ci.yml` (tests + bundle check + boundary check on pushes and PRs touching `helpers/`), `helpers-dist.yml` (publishes `helpers/` as the `helpers-dist` branch after each merge to `main`, via `workflow_run` of the auto-merge workflow), `deploy-helper.yml` (matrix over `helpers/packs/*/helper.json`, test gate, `production` environment on `main` only, `umask 077`, credential cleanup; secrets `CLASPRC_JSON`, `<HELPER>_SCRIPT_ID`, `<HELPER>_DEPLOYMENT_ID` named, not created)
- `helpers/decisions/TG-PHASE-1.md` — scrub report (15 rows, owner-approved), subtree-vs-clone measurement, every default chosen
- `helpers/prompts/TG-PHASE-2.md` — Phase 2 kickoff for the four shared kits and their coordinator

### Changed
- `CLAUDE.md` — three-line routine-mode guard at the very top: a session started by a Claude Code Routine ignores this file and follows the attached helper repo's `CLAUDE.md`
- `.gitignore` — `helpers/dist/` (local bundles)
- `helpers/BUILD-STATE.md` — Phase 1 marked **done**; Phase 1 log; Next points at Phase 2 (new session, Opus 5.5 · high, `helpers/prompts/TG-PHASE-2.md`)
- `repository-information/REPO-ARCHITECTURE.md` — flowchart gains the Helper Framework subgraph (`helpers/`, `hb-*` agents, the three workflows, the `helpers-dist` branch) with edges from the auto-merge flow; mermaid.live URL regenerated and verified
- `README.md` — tree expanded for every file under `helpers/`, the four agent files and the three workflows
- `repository-information/SESSION-CONTEXT.md` — Phase 1 complete; recommendation is to start Phase 2

## [v01.11r] — 2026-09-30 10:05:26 PM EST

> **Prompt:** "1. bot token created for JonTourGuideBot.
> 2. defaults"

### Changed
- `helpers/BUILD-STATE.md` — Phase 0 marked **done** (2026-09-30): bot token created and held by the owner, all thirteen decisions confirmed as defaults; Next now points at Phase 1 (new session, Fable 5.1 · xhigh, `helpers/prompts/TG-PHASE-1.md`)
- `helpers/decisions/TG-PHASE-0.md` — decisions 2–13 moved from "default" to "confirmed"; BotFather action marked done (token and bot name stay out of this repo); header records the Phase 0 close
- `repository-information/SESSION-CONTEXT.md` — Phase 0 complete; recommendation is to start Phase 1

## [v01.10r] — 2026-09-30 09:10:27 PM EST

> **Prompt:** "maps key added"

### Changed
- `helpers/BUILD-STATE.md`, `helpers/decisions/TG-PHASE-0.md` — Maps key recorded as added to Claude HQ as an API credential for the Places and Routes hosts with the `X-Goog-Api-Key` header (plan fact 10 inference resolved from the cloud-environments doc: custom header name with an empty prefix is supported); Google Cloud per-API daily caps deferred to Phase 7 because the free trial blocks quota edits; remaining owner actions are the bot token and any objection to the defaults
- `repository-information/SESSION-CONTEXT.md` — updated for the same state

## [v01.09r] — 2026-09-30 08:38:20 PM EST

> **Prompt:** "repo created and added to Tour Guide's project settings"

### Changed
- `helpers/BUILD-STATE.md`, `helpers/decisions/TG-PHASE-0.md` — the private `TourGuide` repo is created, attached, verified private and seeded with the §4.2 skeleton on its `main` (owner's choice); decision 1 marked confirmed; remaining owner actions are the Maps key credential, the bot token and any objection to the defaults
- `repository-information/SESSION-CONTEXT.md` — updated for the same state

## [v01.08r] — 2026-09-30 08:20:41 PM EST

> **Prompt:** "Start Phase 0 in a new session on Fable 5.1 High, using the kickoff in section 12 of the plan."

### Added
- `helpers/` — new top-level tree for the reusable helper framework; Phase 0 of the Tour Guide build (Fable 5.1 · High) adds its build-process files only, no code
  - `helpers/BUILD-STATE.md` — phase tracker (repos and environments, the eight phases with model and effort, conventions, Phase 0 log, next step)
  - `helpers/decisions/TG-PHASE-0.md` — all thirteen §10 decisions recorded with their defaults (owner to object), the four owner actions and their status, session-level decisions (decisions presented in one message; `REPO-ARCHITECTURE.md` deferred to Phase 1; private-repo skeleton contents) and what Phase 0 verified
  - `helpers/prompts/TG-PHASE-1.md` — the Phase 1 kickoff prompt (Fable 5.1 · Xhigh): orient, scrub-report owner gate before any Assistant Brain code is copied into this public repo, the foundation deliverables with their contracts, subtree-vs-clone measurement, done-when, repo bookkeeping, Phase 2 hand-off

### Changed
- `README.md` — new "Helper Framework" group in the tree for `helpers/`
- `repository-information/SESSION-CONTEXT.md` — Phase 0 session saved; the private `TourGuide` repo, the Maps key credential and the bot token are the open owner actions
- Findings recorded for the plan: the GitHub integration cannot create repositories (`create_repository` returned 403), so the private repo is owner-created (plan fact 14 resolved)

## [v01.07r] — 2026-09-30 07:55:53 PM EST

> **Prompt:** "why is the plan phase being done on Opus 5.5 Medium? Isn't this one of the most important phases? Shouldn't it be Fable 5.1 xhigh?"
>
> Project topic: "Create a helper that can understand my preferences (by reading everything from approved connectors), conduct deep web research (without requiring me to always give approval to continue), check how long an average tourist spends at a certain location, use google maps to optimize routes between points of interests, create lists to save unused but researched points of interest for later, write detailed personalized notes for each location, then use all that information to craft and recommend detailed action plans for each day that include general info (address, hours of operation, days closed, google reviews/stars, website), expected amount of time to spend doing [insert activities here], expected amount of time going from location to location via [insert optimal google map plan here], with some free time sprinkled here and there. The final output should be look like a beautiful travel brochure that took a travel agency's entire marketing & design team to create over months of work. I also want a chatbot that I can interact with in a similar manner to my Chief of Staff helper (Assistant Brain). However, I want this infrastructure to be implemented in my Personal repository, so I can build other helpers later."

### Changed
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — replaced the v01.06r draft (written on Opus 5.5 · Medium) with a plan authored on Fable 5.1 · Xhigh. One plan remains at the same path; nothing is built yet
  - Every web fact re-checked on official pages: Enterprise Place Details corrected to $20 per 1,000 ($25 is Enterprise + Atmosphere); Route Matrix supports `TRANSIT` with a 100-element cap; `optimizeWaypointOrder` caps at 25 stops and transit takes no intermediate waypoints; no Google API exposes visit duration; the 30-day coordinate-caching clause is marked as an inference to verify; routine limits, `/fire` header and Artifact republish rules cited; Google's Grounding Lite Maps MCP noted as an optional spike
  - Chatbot redesigned as three lanes: instant Apps Script commands, an optional fast Claude API lane (off by default), and deep routine runs fed by request envelopes with a wake route instead of a polling tick, so it adds no trigger minutes next to Assistant Brain's
  - Routines attach only the private helper repo (tools vendored from a `helpers-dist` branch) so this repo's development `CLAUDE.md` never loads in a routine; a routine-mode guard is added here as a backstop
  - Reuse made explicit: the deploy workflow grows from this repo's clasp pilot plus Assistant Brain's deploy workflow; the auto-merge workflow is untouched; the Pages sign-in machinery is not used because the Tour Guide has no public page
  - Assistant Brain's build process imported: per-role agent files with model and effort, per-phase prompt files, decisions and status per work package, worktrees, a build tracker, and session-context files in both repos
  - Model and effort per phase: Phase 0 Fable 5.1 · High (was Opus 5.5 · Medium); foundation and integration Fable 5.1 · Xhigh; solver, brochure design and the two core research/planning skills Fable 5.1 · High; other building Opus 5.5 · High or Medium
  - Chromium for brochure PDFs is pre-installed in this environment's image (checked on the machine), with a Phase 2c check inside a routine run
  - Thirteen owner decisions with defaults, and a Phase 0 kickoff on Fable 5.1 · High
- `README.md` — tree description for the plan updated

## [v01.06r] — 2026-09-30 07:30:47 PM EST

> **Prompt:** "Help me set up this new project from my recent work. Look through my recent sessions and repositories, identify the main thread of work, and propose a project setup: a short name, the repositories it should include, an environment, concise project instructions drawn from what kept coming up, and one or two optional routines. Show me the proposal before changing anything."
>
> "Ok, then I have set the environment to Claude HQ. Go ahead."

### Added
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — phased build plan for the Tour Guide helper (the "Tour Guide" project) and the reusable helper framework it sits on. Plan only; nothing built.
  - Public/private split: framework, kits and generic Tour Guide code go under a new `helpers/` tree in this public repo; persona, skills, memory and all trip data go in a new private `LightAISolutions/TourGuide` repo and the owner's Drive; a CI boundary check enforces it
  - Reuses Assistant Brain patterns (two lanes, Drive mailbox + envelope tool, Telegram core, registries, routines, quarantine, memory-merge workflow) without modifying Assistant Brain
  - Platform facts verified on the web 2026-09-30: no official API for "typical time spent" (estimated by research instead); hours/rating/website are Place Details Enterprise fields; free monthly caps 10k/5k/1k per tier; waypoint optimization not available for transit; Places content caching limits; Apps Script Maps service 1,000 queries/day and the shared 90 min/day trigger runtime; routines have hourly (not daily) run limits and keys belong in environment API credentials
  - Phases 0–8 with model and effort per phase (Fable 5.1 · Xhigh for framework foundation and integration; Fable 5.1 · High for the route solver and brochure design; Opus 5.5 · High/Medium for kits, skills and the chatbot), owner actions, done criteria and a finish-priority order
  - Environment notes: Claude HQ runs the build and the routines; the Maps key goes in as an API credential in Phase 0; live Google calls only in Phases 2a, 7 and 8
  - Eight owner decisions with recommended defaults
- `README.md` — tree entry for the new plan

## [v01.05r] — 2026-09-29 07:17:22 AM EST

> **Prompt:** "Save down in potential future projects, in order of interest:
>
> * Personal knowledge wiki
> * Career system: job scanning, tailorer resumes
> * Ask about Simon Willison's 234 small single-page tools to draw inspiration
> * Windows power-user kit
> * Health coach from wearable data once I actually own and use one"

### Added
- `repository-information/FUTURE-CONSIDERATIONS.md` — new "Potential Future Projects (in order of interest)" section listing the owner's five candidate projects, each with a one-line description (drawn from the 2026-09-25 research on what people build with Claude Code) and a trigger condition:
  1. personal knowledge wiki
  2. career system (job scanning + tailored résumés)
  3. a Claude survey of Simon Willison's single-page tools for inspiration
  4. Windows power-user kit
  5. health coach from wearable data, once a wearable is owned and used
  
  The file's intro line was broadened to cover potential future projects.

## [v01.04r] — 2026-09-25 07:35:40 PM EST

> **Prompt:** "Two stale references were found in the `LightAISolutions/Personal` repo while researching a personal-assistant project. Verify each one, then fix it.
>
> ## 1. `autoHotkey/AutoUpdate.ahk` points at the template repo
>
> Lines ~12–19 currently read:
>
> ```
> GITHUB_OWNER  := "LightAISolutions"
> GITHUB_REPO   := "lightaisolutions"
> ...
> PAGES_BASE    := "https://" GITHUB_OWNER ".github.io/" GITHUB_REPO "/"
> API_BASE      := "https://api.github.com/repos/" GITHUB_OWNER "/" GITHUB_REPO
> ```
>
> `lightaisolutions` is the template repo's name, so the updater polls `LightAISolutions.github.io/lightaisolutions/` and the template's GitHub API instead of this repo (`LightAISolutions/Personal`, Pages at `lightaisolutions.github.io/Personal/`). A previous session (v01.00r) converted this repo from a "Sales" copy and re-scoped identity references to `LightAISolutions/Personal`, and this constant appears to have been missed.
>
> - **First confirm it isn't intentional.** Check `git log -p -- autoHotkey/AutoUpdate.ahk`, `autoHotkey/auto-update-targets.ini`, `live-site-pages/ahk-versions/`, `live-site-pages/auto-update-html-versions/`, and the CHANGELOG. If the updater is meant to pull from the template, document that instead of changing it.
> - **If it is a bug**, set `GITHUB_REPO := "Personal"`. Also grep the rest of `autoHotkey/` and `scripts/init-repo.sh` for any other stale `lightaisolutions` repo-name references that should now be `Personal`.
> - Follow the repo's CLAUDE.md Pre-Commit Checklist:
>   - **[PC-GS-VERSION] #1 (AHK part):** bump the `VERSION` constant in the `.ahk`. Do **not** hand-edit `ahk-versions/*.txt`; CI regenerates it.
>   - Add an AHK changelog entry per `.claude/rules/changelogs.md`. It is public-facing, so no file or function names.
>   - Add a repo CHANGELOG entry.
>   - Update the README tree label if the file's label changes.
>
> ## 2. `repository-information/FUTURE-CONSIDERATIONS.md` quota line is wrong
>
> Line ~18 says `Consumer account: 20,000 script executions/day shared across ALL scripts`. Per Google's quota page (https://developers.google.com/apps-script/guides/services/quotas), 20,000/day is the **UrlFetch calls** quota for consumer accounts. The daily limit that actually applies to triggers is **90 minutes/day of total trigger runtime** (6 h on Workspace), with a 6-minute cap per execution. Correct the line (and the Workspace line after it), citing the source. Check `repository-information/DATA-POLL-ARCHITECTURE.md` for the same mistake.
>
> ## Done when
> - The updater targets the right repo, or its intent is documented.
> - The quota lines are accurate.
> - Standard pre-commit items (versions, changelogs, README timestamp) are handled in a single commit, pushed to the session's `claude/*` branch."

### Fixed
- `autoHotkey/AutoUpdate.ahk` (v01.01a) — `GITHUB_REPO` changed from `"lightaisolutions"` (the template repo) to `"Personal"`. `PAGES_BASE` and `API_BASE` are built from it, so the updater had been polling the template's GitHub Pages version files and downloading from the template's contents API instead of this repo's.
  - Confirmed as a bug, not intent: the repo-tracked manifest `auto-update-targets.ini` and `live-site-pages/ahk-versions/` list this repo's own scripts.
  - The value dates to the initial (Sales-copy) commit; the v01.00r re-scope touched only `VERSION` in this file.
  - Root cause: `scripts/init-repo.sh`'s `REPLACE_FILES` list omits `autoHotkey/AutoUpdate.ahk`, so initialization never rewrites it. `OLD_REPO="lightaisolutions"` in that script is the intended search pattern, not a stale reference.
  - No other stale repo-name references exist in `autoHotkey/` or `scripts/init-repo.sh`.
  - `live-site-pages/ahk-versions/autoupdateahk.version.txt` is left for CI to regenerate.
- `repository-information/FUTURE-CONSIDERATIONS.md` — the Reference section called 20,000 / 100,000 per day a "script executions" quota; those are the **UrlFetch calls** quotas. It now lists the real limits, verified against Google's quota page (updated 2026-09-03):
  - 90 min/day (consumer) / 6 hr/day (Workspace) total trigger runtime
  - 6 min per execution
  - 30 simultaneous executions per user
  - no published daily cap on total executions
  
  `repository-information/DATA-POLL-ARCHITECTURE.md` was checked and already states these limits correctly.

### Changed
- `README.md` — `FUTURE-CONSIDERATIONS.md` tree label `[template]` → `[template · modified]`

## [v01.03r] — 2026-09-25 07:29:06 PM EST

> **Prompt:** "I like the idea of having a personal assistant AI and I'm sure many others have already built their own versions. Conduct deep research into what this landscape looks like, what my big-picture options are, what functions are most useful and feasible to build, and recommend me some directions to move towards. I will likely use this project to dump extra tokens/usage into near my weekly reset, so feel free to think big. You will have a large budget to work with."

### Added
- `repository-information/PERSONAL-ASSISTANT-RESEARCH.md` — landscape research (as of 2026-09-25) for building a personal assistant AI, synthesized from six parallel research passes:
  - commercial assistants and what changed in 2026 (Pulse/Atlas/Mariner shutdowns, free Gemini Daily Brief, cloud background agents)
  - the open-source "claw" family (OpenClaw architecture, security record, alternatives)
  - the "Claude Code as personal OS" pattern
  - Claude subscription mechanics and automation rules (which surfaces spare weekly usage can legitimately power; the 2026 third-party-harness policy timeline; Routines details verified against the docs)
  - memory, channel, voice, hosting and local-model building blocks
  - agent security incidents and a two-lane defensive architecture
  - a scored use-case catalog
  - feasibility limits of this repo's Apps Script + GitHub stack — including the finding that this repo is **public**, so personal data and memory must live elsewhere
- `repository-information/PERSONAL-ASSISTANT-ROADMAP.md` — recommendations built on that research:
  - a five-option comparison, recommending a hybrid: a Claude-Code-native brain (private repo + Routines on the subscription) plus a separate Apps Script + Telegram always-on layer
  - design principles
  - a reference architecture with a Mermaid diagram and data flows
  - a tiered function catalog led by an obligations ledger + morning brief
  - an 8-phase roadmap with checkbox tasks and exit criteria
  - a token-dump playbook for spending spare weekly usage on durable outputs (backfills, eval sets, dossiers)
  - a risk register and the open decisions only the developer can make

### Changed
- `README.md` — structure tree lists the two new documents

## [v01.02r] — 2026-08-30 03:02:03 AM EST

> **Prompt:** "deployment branches updated — verify the auto-deploy"

### Changed
- `live-site-pages/.deploy-trigger` — touched to force a Pages redeploy and exercise the full automatic chain (push to `claude/*` → auto-merge → deploy) end-to-end, verifying that the `github-pages` environment's deployment-branch policy now admits `claude/*` refs. The prior run's `deploy` job was rejected at job level (zero steps, no logs) because enabling Pages created the environment with its default default-branch-only policy, which made the merge succeed while publishing silently failed

## [v01.01r] — 2026-08-30 02:55:41 AM EST

> **Prompt:** "Skip Step 2 and let me trigger the deploy instead"

### Fixed
- `live-site-pages/index.html` — the landing page's `<title>` still carried the template placeholder `CHANGE THIS PROJECT TITLE TEMPLATE`, which was visible in the browser tab on the newly-published live site; resolved to the `YOUR_PROJECT_TITLE` value (`Personal`). Found while verifying the first successful GitHub Pages deployment. The copies in `live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-noauth.html.txt` and the placeholder check in `scripts/setup-gas-project.sh` are intentionally left as-is — the template must keep the placeholder for new pages to substitute, and the script greps for it as an unresolved-placeholder guard
