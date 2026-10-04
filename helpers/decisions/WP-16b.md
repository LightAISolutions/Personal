# WP-16b decisions — Menu check (item 14)

Brief: `helpers/prompts/TG-PHASE-16.md` "WP-16b" and Contract C16. Each default below names its reason.

## The owner's words
- `/menu <restaurant> [on <date>]` reuses /daytrip's date words (`resolveDate` from `daytrip/daytrip-text.mjs` on the pack
  side, `tgDaytripDate` on the core side): one date grammar for the owner, and the parity case list proves both agree.
- Empty text parses to `no_place`; the command checks for empty arguments first, so `/menu` alone shows the list and the
  how-to instead of an error.
- The restaurant is cleaned (control characters out, spaces folded, trailing `?.!` dropped) and limited to 80 characters
  (C16 `place 1–80`); 81 is `too_long`, not cut, so the owner sees what went wrong.

## The engine
- `menuFits` counts only small plates (starter/side) whose fits is `yes` towards `PARTLY_MIN_SMALL`: a plate to ask about
  is not yet a dinner. Desserts and drinks never make a dinner fit.
- No dishes and no `others` is `unknown` (nothing was read); no dishes but `others > 0` is `no` (a menu was read and nothing fits).
- `menuPayload` counts every dish whose fits is not `yes`/`ask` into `others` (the schema has no `no` dish), sorts by course,
  then yes before ask, then the menu's own order, keeps 12 and adds the rest to `others` (capped at 200, the schema maximum).
  `others` is left out when 0 or when fits is `unknown`; `dishes` is `[]` when fits is `unknown`.
- `menuNote` uses the English dish names only ("Fits: …; ask: …"), cut at a word with "…" at 160; for `no` it names the
  diet ("Nothing on the menu fits <diet>", "your diet" without one); for `unknown` "No menu found to check".
- `CAVEAT_RE` matches the planner's two caveat phrases ("menu not checked for", "menu last checked") at the start of the
  line or after " · ", case-insensitively, so it works on both the planner's "name · caveat" and the digest's capitalised form;
  "the menu partly fits" is not a caveat (a check that counts already exists).
- `menuCountsFrom(date)` = `date − MAX_AGE_DAYS`, the first `checked` that still counts (dinnerMenu's `> 30` rule);
  `MAX_AGE_DAYS` is imported from the facts pack, not copied.

## Schema and validators
- `menu-payload.mjs` reads its schema file itself and imports nothing that imports it back, so `schemas/index.mjs` can import
  `checkMenu` without a cycle (REQUEST for KINDS.menu).
- The validator checks Google fields first and by name anywhere (the daytrip pack's list), then shape, then the two rules the
  schema cannot say (`ask` exactly on fits=ask dishes; ≥1 source unless fits is unknown), then the 12 000-character limit.
  `price` is allowed: it is the menu's own words, not a Google price level.
- The core handler refuses a check whose `trip` the core does not know (the veg card and day trip rule); `trip: null` is stored
  and has no re-plan offer.
- The 12 000 limit is barely reachable with every field at its bound (the test fills every field to reach it); it is a
  last guard, not a working limit.

## The core (`gas/44_menu.js`)
- The core's parse uses `tgDaytripDate` (41_daytrip.js) at run time, so /menu and /daytrip read dates the same way.
- "The newest check of that slug" is the check with the latest `checked` among all checks of that place slug, whatever
  the trip (a menu belongs to the place); a tie keeps the latest arrival.
- `/menu` alone: dinner buttons read "🍽 <day n> · <dinner name>" and use the 🍽 row's own data (so a dinner whose check
  counts resends it); check buttons read "🍽 <place name>" (mn:<key>:s). Two buttons per row. Each part has a heading
  line ("Planned dinners", "Your last checks") so the list reads without the buttons.
- The card's "counts from" line reads "For day 2 (Thu 11 Jun) a menu check counts from Wed 12 May; send 🍽 again then."
  The brief's "this check counts from" would be untrue for an old check (it never counts again); the date is when a new
  check would.
- `<day>` is written "day 2 (Thu 11 Jun)" in lines and the acknowledgement, "day 2" on the button (buttons stay short).
- `mn:<key>:r<date>` also refuses a day the card would not offer (past, or a check that does not count and does not say
  `no`), answering "That day is no longer offered — send /menu.", so a forged or stale button cannot re-plan; the dinner
  check ("That day's dinner has changed — send /day again.") comes first.
- `mn:<trip key>:<date>:<tag>` on a passed day answers "That day has passed." and asks nothing; an unknown trip or a day
  without that dinner answers the brief's "That day has changed — send /day again."
- The request a 🍽 button opens carries the day's trip (not the current trip, which may differ) and the text
  "/menu <name> on <date>"; the dinner name is cut to 80 characters (C16 `place` 1–80).
- `menu_checks` keeps checks whose `checked` is within the last 30 days in the owner's zone (the checks older than that no
  longer count for any dinner from today on), sorted by `checked`, then arrival.
- The card's dish lines and the app show only the payload's own words; source links are https pages (What's on's rule,
  `tgMenuHref`), not only Maps links, because a menu lives on the restaurant's own site.

## The app ops (`gas/39_menu_app.js`)
- `menu.day` answers `{ button: null }` or `{ button: { check: <id> | null } }`; the app opens `menu.new { place, slug,
  date }` for `check: null` and `menu.get` for an id.
- `menu.new` takes the command's date words; `menu.replan` answers 409 with `changed`, `not_offered` or `no_trip`.
- `menu.day` also returns the check's `fits` (null with no check), so the app's button can read "🍽 Menu: <fits word>" like
  the chat's without a second call.

## The app (`live-site-pages/helper-app.html`)
- A Menu tab after What's on; `?screen=menu&menu=<id>` (the card's 📱 button) opens a check directly; the nav's Menu button
  opens the list (the Day trips rule). The go() map entry is `menu: function () { showMenu(); }` so the existing go() tests,
  which list the show functions they know, keep working without showMenu.
- The Menu screen: a restaurant field, an optional day field (the command's date words) and "🍽 Check the menu" (also the
  MainButton), then "Your checks" from `menu.list`. A check shows the card's lines in the card's words: the fits line,
  "For: <diet>", the dish lines ("✅/❓ name (local) · price — ask: …"), "+ N other dishes that do not fit", "Source:" links,
  then per offered day the 🔁 button (with "This dinner does not fit; re-plan …" when fits is no) or the "counts from" line;
  🥗 Veg card when the trip has one. The note is not shown: it is the planner's summary, and the card does not show it either.
- Sources: only https pages are shown (the validators and `menu.get` allow https only), not shown as plain text.
- The day view: `dayCard` takes the trip as an optional 4th argument (the brochure passes it); a dinner with a slug whose note
  carries the planner's menu caveat asks `menu.day` through `api()` (the raw transport), not `call()`, so a refusal, a network
  error or the daily limit never replaces the day with an error screen; no answer, no button. The day renders first; the
  button fills its slot (under the dinner and its note) when the answer comes. The caveat test is the pack's `CAVEAT_RE`
  (a test checks the two are the same), so the app asks only when the core can offer a button: one call per such dinner,
  not per day.
- "🍽 Check the menu" asks `menu.new { place: the dinner's name (80), slug, date }` and turns into "🍽 Reading the menu…";
  "🍽 Menu: <fits>" opens the check on the Menu screen.

Developed by: LightAISolutions
