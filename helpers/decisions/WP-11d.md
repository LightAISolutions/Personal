# WP-11d — Brochure design pass for the C11 facts: decisions and defaults

Every default this work package picked, with its reason. Brief: `helpers/prompts/TG-PHASE-11.md` (Contract C11, WP-11d).

## Backward compatibility (the old plan's HTML)

- Hashes taken on 683c9e6 before any change (sha256 of the HTML, no fonts unless noted). They are checked by tests:
  - pack sample, letter: `2a069b42594cc33a6a8ba170c0f7064da6f2b4055c090189e548be0cc8539bd2`
  - pack sample, A4: `b5982dfff56039266f3141b62adb2dc638b841aed1c776e6eb1eb80d3e740c85`
  - kit fixture, no fonts: `c26b61ad4f1a6eb78b1028d8d11be6d3fb9193ca8b7edd2db96ab63cbe26b481`
  - kit fixture, with fonts: `81da1192cee9fe29cf4c2b3c56ac826866ebab3e5169b945baedc92c5d640c40`
- The C11 CSS is spliced in only when `usesC11(model)` is true (any C11 field anywhere), and each piece of new markup
  only when its field is present. Reason: the brief requires the old plan's HTML to stay identical byte for byte; a
  stylesheet that always grew would change every old document.

## The kit model (schema `brochure.schema.json`)

- The kit takes display lines, not raw C11 facts: `places{}.facts` holds strings already written (visit, last entry,
  closed, booking, price, payment, gate, menu) plus `checked`, `stale`, `menu_fits`, `menu_checked`, `menu_stale` and up
  to 6 sources. Reason: the kit stays domain-free (it renders any trip), and every wording decision sits in one pack
  adapter that WP-11b's formatter replaces.
- Every new object has `additionalProperties: false`; enums follow C11 (bags kind, extras kind, minutes_source,
  crowd_slot, flags, menu_fits, bloom status, event kinds). Caps: extras ≤ 3 (C11), bloom ≤ 6, events ≤ 40, facts
  sources ≤ 6, season sources ≤ 10. Reason: bounded pages; the numbers are generous for a
  trip of up to 31 days.
- `season.events[].from`/`to` are both required in the kit (the adapter fills `to` = `from` for one-day events), so
  the season page never guesses an end date.
- New semantic checks: a `day-start`/`day-end` leg needs the day's start/end; extras and event places must resolve;
  bags, events and blooms must end after they start.

## The day page

- Real start and end are rail rows (`Start · <name>`, `End · <name>`) sorted with everything else by time; the map
  link and the override note sit under the name. Reason: the rail is already the day in clock order; a separate
  header box would duplicate the time column.
- Bags: timed bags are their own rail row ("Bags · Leave your bags at Quayside Rooms"); untimed bags become a line
  under the start, or their own untimed row at the top when the day has no start. Default words per kind when the
  model gives none: hotel "Leave your bags at <where>", locker "Bags in a locker at <where>", forward "Bags sent
  ahead", carry "Carry your bags today".
- Stops: last entry joins the meta line ("last entry 4:30 pm"); the visit length shows its source in small muted type
  ("(official site)", "(researched)", "(estimate)"); the booking line shows only when the stop is not booked (a
  booked stop already says "Timed entry …, booked"); crowd notes: opening "Go at opening; it gets busy later", late
  "Late is quieter".
- `crowd_magnet` has no tag of its own: the crowd note on the stop is the useful part, and a "busy" badge on a card
  would read as a warning against a place the plan chose. `local_favourite` gets a tag on the rail and the card.
- Dinner card: a meal with a `booking`, or a dinner at a place that has `facts`, becomes a bordered card (name, time,
  map link, see-card link, booking line, price with what it includes, the menu line with "menu checked <date>" and
  "check again" when stale). Lunch at a place with facts stays a plain row. Reason: the brief asks for a dinner card;
  turning every meal at a researched place into a card made the rail heavy (seen in the first screenshots).
- "This evening" box: sunset in the time column, then up to three extras in clock order (untimed last) with time,
  icon (star = event, heart = saved place), distance ("600 m away" under 1 km, rounded to 10 m; "1.1 km away"
  above), map or event link, a see-card link only when that place has a card, and the note. Without extras it is a
  single "Sunset — the light goes at …" row.
- The box goes into the rail at its time: sunset, or the first extra's time when there is no sunset; before the first
  row that starts later; at the end when it is untimed. Reason: a box at the end showed 4:40 pm after a 7:00 pm dinner
  in winter; clock order is the rail's rule.
- Sunset is hidden on a day that ends at a departure before sunset (the travellers have left).
- Phone: the facts block switches to a two-column grid (label | text) inside the C11 media block, because the
  stacked rows were ambiguous at 390 px.
- A day with no stops (coordinator, Phase 11 wave 2): it stays a "Free days" line on the practical page (the kit's day
  needs a stop), but the line now reads the day in order — the real start, the override's note, the bag step, its free
  time and the real end ("Carry your bags today · Check out by 10:00. … Ends 15:30 at <station>.") — and links the end
  (else the start) on Maps. Reason: the wave-2 end-to-end test planned a last day with nothing but a check-out and a
  train, and the brochure dropped both. A free day with one free-time note and none of these fields reads as before.

## Place cards and the season page

- Facts block under the card's meta: "Facts checked <date>" (+ "check again" in the stale colour), rows Visit, Last
  entry, Closed, Booking, Price, Pay, Gate, Menu, then the sources line. Reason: same row style as the card's notes,
  so no new components.
- Season page after the overview, before day 1: lead (italic, the lede style), Weather (text + highs, lows, "on about
  N days a month" of rain), Leaves and blossom (status chip + dates + note + link), Events by date (in chunks of 10 so
  the paginator can split), Sources with the date checked and "Seasons move: check the forecasts again in the week
  before you go."
- No new fonts or colours: everything reuses the kit's tokens (cream box, accent rule, stale = the warn colour).

## The pack adapter (`brochure-map-facts.mjs`)

- One file maps every C11 fact and season line; it calls five swap points through `IMPL` (`factsLines`, `menuLine`,
  `factsStale`, `eventsOn`, `bloomOn`) with WP-11b's final signatures, `now` passed as YYYY-MM-DD. The local
  versions are this WP's own formatter; the coordinator rebinds `IMPL` at merge (REQUEST).
- `now` = `options.now`, else the plan's build date; with neither, nothing is ever marked stale. Reason: a brochure
  must not call facts old against a clock the build did not state.
- Freshness: facts older than 90 days and menus older than 30 days are stale (C11's windows, matching WP-11b's
  `FACTS_MAX_AGE_DAYS` / `MENU_MAX_AGE_DAYS`).
- Diet: `options.diet`, a string or a list of strings; without it the menu line says "fits the diet".
- Card rows: booking from `factsLines().booking_line` (else the formatter); price from the formatter (price + what it
  includes) because WP-11b's `price_line` also carries the payment, which has its own row; the menu row is
  `menuLine()` without its "Menu checked <date>:" prefix, because the kit prints the date and "check again" itself;
  a menu line in another shape is kept whole and the separate date is dropped so it is never said twice.
- Links are https only (no spaces or quotes, ≤ 2000 characters); anything else is dropped, including as text.
- Season: events are the ones `eventsOn()` returns for any trip date (de-duplicated by id, at most 40); an event keeps
  its place only when that place has a card; the lead is `bloomOn()` for the trip dates (at most two different lines,
  capitalised, ending in a full stop); a sheet without a valid `checked` date is skipped entirely.
- Bloom labels: autumn_leaves "Autumn leaves", cherry "Cherry blossom", plum "Plum blossom", wisteria, hydrangea
  "Hydrangeas", iris "Irises", lotus, roses, lavender, other "Blossom". Local bloom words: before "not out yet" /
  "expected from <d Mon>", starting, peak "at their peak", past "past their best".
- Day overrides: the start/end point takes the override's coordinates and place id (a Google Maps search link from
  the id); the override note goes on the start, else on the end. Bags `where` = the lodging's name (`at: lodging`) or
  the start's name.
- Extras: an event extra links to its season event by `ref`; a saved extra keeps its place key and links to a card
  only when one exists, else a Maps link; `km` is rounded to 0.1 and capped at 100 (negative dropped).
- Facts and season sources join the trip's attribution ledger ("place facts", "season").

## Page budget

- The budget is `lib/paginate.mjs`'s: no block taller than a sheet, so no paginator warnings. A C11 trip may add the
  season page and one "continued" sheet per day whose rail gained C11 rows. Measured: pack sample A4 8 → 9 sheets
  (the season page); kit fixture letter 12 → 14 (season page + day 1 continued).

## Left alone

- On phone the clock next to a numbered badge is clipped ("10:00a"); it predates WP-11d and is in the old plan too.
  Fixing it changes the old HTML, which the brief forbids in this WP; noted in the status file.

Developed by: LightAISolutions
