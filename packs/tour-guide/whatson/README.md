# whatson — What's on

What is on in a place on given dates — exhibitions, special openings, festivals, markets, performances, light-ups, and
the holidays and closures that change a day — grouped by date with its sources; the owner chooses things for specific
days and the plan then carries them (Phase 15, WP-15b, item 20, Contract C15). Before and during a trip the trip's
cities are checked once a week, and the owner hears only about new things.

A branch of the Tour Guide pack, first written by `node helpers/tools/new-branch.mjs whatson --discover` (see
`helpers/tools/README.md`, "Branches"), then filled in. Check it is complete at any time:
`node helpers/tools/new-branch.mjs --check whatson`. Every default and its reason: `helpers/decisions/WP-15b.md`.

## The parts

| Part | Where |
|---|---|
| Command `/whatson [in] [<place>] [<when>]`, `/whatson last`, `/whatson auto on\|off` → request kind `whatson`, routed to `RESEARCH` (a discovery kind: `DISCOVER` when configured) | `gas/42_whatson.js` |
| Tab `WhatsOn`: one row per board id — `id`, `trip`, `place_label`, `from`, `to`, `created_on`, `auto`, `count`, `payload_json`, `chosen_json`, `received_at` | `gas/42_whatson.js` |
| Envelope `whatson`: the core validator `tgEnvValidateWhatson`, the handler, the card, the `wo` buttons, the weekly check (alarm `tg_whatson`), the `whatson_chosen` snapshot | `gas/42_whatson.js` |
| Schema (C15) | `schemas/tour-guide-whatson.schema.json` |
| The pack validator `validateWhatsonPayload` and the cross-field rules `checkWhatson` (no imports, so `schemas/index.mjs` may use it) | `whatson/whatson-check.mjs` |
| The owner's words: `parseWhatsonText` | `whatson/whatson-text.mjs` |
| The engine: `eventId`, `normalizeWhatson`, `newItems`, `toSeasonEvent`, `mergeChosen` | `whatson/whatson-events.mjs` |
| The payload: `whatsonPayload` (checks the schema itself with the brochure kit's subset validator) | `whatson/whatson-payload.mjs` |
| Invented fixtures: valid, invalid and `semantic` payloads and a trip; the shared parse cases | `whatson/fixtures/` |
| App ops `whatson.list`, `whatson.get`, `whatson.choose` (write), `whatson.new` (write) | `gas/34_whatson_app.js` |
| The app's What's on screen | `live-site-pages/helper-app.html` |

## The owner's words

`parseWhatsonText(text, { today }) → { ok: true, place, from, to, dates_given } | { ok: false, why }`, mirrored word for
word by the core's `tgWhatsonParse`; `fixtures/whatson-parse-cases.json` is the case list both must agree on.

- `<when>` is the longest run of words at the end that reads as one: `today`, `tomorrow`, `this week` (today to Sunday),
  `next week` (Monday to Sunday), `this weekend`; a date (`YYYY-MM-DD`, `M/D`, `8 Jun`, `Jun 8`); a range
  (`<date> to <date>`, `<date>-<date>`, `<date>..<date>`, `8-10 Jun`, `Jun 8-10`). The rest, minus a leading `in`, is the
  place (≤ 80 characters).
- A year-less date is its next occurrence from today. A window that is reversed or past is refused; one that starts
  before today starts today; one longer than 31 days is refused (`reversed`, `past`, `too_long`, `long_place`).
- The core fills the defaults: no `<when>` and a current trip → the trip's today (or first day) to its last day, ≤ 31
  days; no trip → today and the next 6 days. No place and a trip → the trip's cities (`trip` in the request); no place
  and no trip → a one-line how-to (`no_place`).

## The engine

- `eventId(name, from)`: the slug of the name (folded: NFKD, marks removed) plus the date's `mmdd`, so an event keeps its
  id from run to run.
- `normalizeWhatson(items, { from, to }) → { items, more, left_out }`: duplicates (same folded name, overlapping dates)
  keep the confirmed one, else the one with more fields; items with no day in the window are left out as
  `outside_dates`; sorted by the first day in the window, then start time, then name; ≤ 20, the rest counted in `more`.
- `newItems(previous, next)`: the items of `next` whose id `previous` did not have (every item when there is none).
- `toSeasonEvent(item, { chosen_on })`: a `season_event` that passes the trip schema and `checkSeason` — id `wo-` plus the
  item id, note = `why` cut to 160, kind, run (narrowed to the chosen day for an item with `days`), times, url, and the
  venue's `place_id` and `area`.
- `mergeChosen(season, choices, { tripStart, tripEnd }) → { season, added, marked, dropped, unmarked }`: a choice that
  matches an event in the sheet marks it with `chosen_on`; others are added; over the 40-event cap unchosen events go,
  those wholly outside the trip first, then the latest; a chosen event is never dropped. The result passes
  `normalizeSeason`.
- `whatsonPayload({ created_on, place, trip?, from, to, items, sources?, left_out?, auto? })`: normalises the finds, builds
  the id (`wo-` + `created_on`'s digits + `-` + the place slug), keeps https sources only, trims items until the board fits
  40 000 characters, and throws listing every problem when the result is still invalid.

## The core and the app

- **The card**: "🗓 <b>What's on in <place></b> · <window>"; items on every day of the window first ("All these days"),
  the rest under their first day; one line each (kind emoji, times, the linked name, "until <date>", "· N days",
  "(dates not yet confirmed)", ✅), then the why in italics and 🌱 food, 💴 price, 🎟 booking; Sources; ➕ n buttons for
  the choosable kinds and 📱 Open in the app; one message, under 4 000 characters ("… and N more in the app").
- **Choosing**: a ➕ button carries the item's position and a short tag of its id. One fitting day (in the window and the
  trip's dates) chooses it; several ask "Which day?" (the first 8); once chosen, "🔁 Re-plan <day>" opens a `replan`
  with `whatson { board, item }` when the board's trip has that day planned. Un-choosing answers "Removed — any day
  already planned keeps it until that day is re-planned". A re-delivered board keeps the choices whose items are still
  on it and still run on the chosen day.
- **The weekly check** (`tg_whatson`, on unless `/whatson auto off`): 09:00 in the trip's zone, from 21 days before the
  trip's first day, then 7 days after the last check, up to the last day; one `auto` request per due trip, none while
  one is open. An `auto` board is stored silently unless it has new items; then "🗓 <b>New on in <place></b>" lists only
  those.
- **The snapshot** `whatson_chosen`: the chosen items of boards whose trip is not done, for the private side to merge into
  the season sheet (`mergeChosen`) and the plan.
- **The app** lists the boards and asks for a new one; a board is grouped by date and shows each item's kind, times,
  venue, why, food, price, booking, source and confidence, with a Choose toggle (a day picker when several days fit) and
  Re-plan on a planned day.

Tests: `helpers/tests/pack_tour-guide_whatson.test.js` (the core), `pack_tour-guide_whatson_engine.test.js` (the engine
and the parse cases), `pack_tour-guide_whatson_app.test.js` (the screen against the real core),
`pack_tour-guide_whatson_evening.test.js` (the planner's evening).

Developed by: LightAISolutions
