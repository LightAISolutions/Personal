# WP-16a decisions — Quiet (item 13)

Each default picked where the brief left a choice, with its reason.

## The words
- Date words are `/daytrip`'s (`resolveDate` in the engine, `tgDaytripDate` in the core), so the two commands read the
  same dates the same way. `on <date>` is read once, at the end; "on" inside a name ("Stoke on Wyvern") stays in the
  place, and a weekday ("on Sunday") is not a date word, so it stays in the place too.
- The parse answers `{ ok, place, date }` or `{ ok: false, why }`, why one of `bad_date` (not a calendar date),
  `past_date` (before today) and `too_long` (place over 80). An empty place with no date lists (`/quiet` alone); an
  empty place with a date answers the how-to.

## The ranking
- A candidate named like the magnet (normName) is a `duplicate`: the magnet's name is seeded into the seen names.
- No fit in the judgment → Scout's `FIT_DEFAULT` (0.3), so a place with no word on fit is neither favoured nor dropped.
- A reach that is not WALK (DRIVE, BICYCLE, TRANSIT) reads `TRANSIT`: the schema has two modes, and the owner standing
  at the magnet is on foot or on a train.
- The item's kind is the judgment's `kind` when it has one, else the magnet's kind (they are the same kind by screen).
- No why → "<Much|Clearly|Somewhat> quieter than <magnet>", our own line, so `why` is never empty.
- Parts are rounded for the payload; the score is computed from the unrounded parts (as Scout's).
- Exactly half the magnet's count passes (`not_quieter` is strictly above MAX_RATIO); exactly 30 minutes passes.
- The diet screen is Scout's screenFlags unchanged, including its kind words: a food magnet whose kind reads as a drink
  place ("noodle bar" contains "bar") lets a vegetarian party's veg-unknown places through as Scout would. Not changed:
  Scout's rule, not mine.
- `buildQuietPayload` and `NOTE_MAX` (the skeleton's placeholder payload) were removed; only the skeleton's test used
  them, and that test is rewritten on the real fields.
- "Every place shown is saved as a candidate" is the private skill's job (WP-16p); the engine returns the board only.

## The core: command, card and buttons
- `/quiet` alone lists the coming planned days' stops a 🕊 button would be offered for (≤ 8, "🕊 <name> · day n"), then the
  last 5 boards ("<b>i.</b> Quieter than X · N places · <date> · asked <created_on>", resend buttons "🔁 i", 5 to a row),
  then the how-to. With neither, only the how-to. A date with no place answers the how-to, not the list.
- The card and the app say "…and N more that were also quieter." when `more` > 0: the payload carries only the count
  (the top 3 are the items), so neither surface can show them, but the owner learns the board was not a near miss.
- What was left out stays in the app (the card would be long and it is not something to act on).
- ➕ marks an added item ✅ n on the keyboard (edited in place); a second tap is idempotent: the Later list keeps one row
  and the added entry keeps its first `at`. ➕ goes to the board's trip while it is on file and not done, else the current
  trip (Scout's rule); no trip at all is an alert.
- A re-delivered board keeps each added entry whose place is still on it and drops the rest; the Later list keeps the
  place either way (the owner added it; a board's change does not remove it).
- Board keys in callback data are "k" + 12 hex of the id's hash (Scout's board keys): ids are up to 52 characters.
- The how-to and the reasons are plain sentences; `too_long` says "under 80 characters".

## The 🕊 rows under a day
- A stop is offered when it has a `crowd_slot` (opening or late) or when a day warning names it as having no quieter slot
  (TG_QUIET.WARN_RE, a prefix match on the planner's noQuietSlotText; exact name first, then ignoring case). Crowd-slot
  stops come first, each group in stop order, each stop once; at most 2 rows (a hint, not a second plan).
- Stop names are cut to 30 in the button ("🕊 Quieter than <name>"). A day before the trip's today gets no rows.
- A stop with a board for its slug received in the last 30 days, of the same trip or of none, gets the resend
  (`qt:<key>:s`); otherwise the ask (`qt:<trip key>:<YYYYMMDD>:<tag>`, the day card's own keys). A tap finds the stop again
  in that day's digest by tag and opens the request `{ trip, place, slug, date }` for the button's trip.
- The tap answers "Asked"; a stop no longer in the day "That day has changed — send /day again."; a past day "That day has
  passed.".

## The app
- `quiet.new` takes a place up to 200 at the app's argument check and answers `too_long` past 80 (the command's limit),
  so the screen can show one reason for both.
- `quiet.get` gives the left-out reasons in words (`left_out[].words`) so the screen does not hold its own table.
- `quiet.day` answers `{ stops: [] }` for a past, missing or free day rather than an error: the day view asks in the
  background and shows nothing.

## The app page
- The Quiet tab is last in the nav (after What's on). `S.quiet` is set by readParams on every launch rather than added
  to the shared `S` literal, to keep the shared lines untouched.
- The day view's 🕊 buttons ask `quiet.day` through `api` (not `call`): a background ask must not replace the screen
  with a "No connection" or refusal view; a failed or empty answer leaves the card as it was. The trip is the screen's,
  else the first trip on Home (the brochure screen's own rule). No core link, no ask.
- dayCard calls `quietDayRow` behind `typeof … === 'function'`: other branches' tests run dayCard in a VM without the
  Quiet section, and in the page the function is always there.
- The board screen shows what was left out (with `quiet.get`'s words), unlike the chat card.

## The schema
- The schema subset cannot say uniqueness, rank order, real dates or size; the validators check those, tested apart
  (not in the fixture's `invalid`, which lists only what all three refuse).

Developed by: LightAISolutions
