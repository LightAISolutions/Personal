# WP-14d — decisions (the owner's lists: a Takeout "Saved" export read into Places)

Brief: `helpers/prompts/TG-PHASE-14.md` "WP-14d", the Wave 2 section and Contract C14 — wave 2. Every default picked
while building, with its reason.

## Why a list item may go straight into Places
The owner asked for exactly this in the review (item 11's note: "organize, maintain, and integrate" the Google Maps
lists with Places) and chose the Takeout export on a card. The list names, the titles and the place each link points to
are therefore the owner's own data, and a list item may become a Places `candidate` without the quarantine step other
untrusted content needs. The owner's notes are different: they are stored as data and shown, never read as
instructions, and a note the injection scanner (`kits/research/lib/injection.mjs` `scanText`) flags is not stored on
the place at all: the engine returns it for the private driver to write to `quarantine/` with its list and title.

## The reader
- **`partial` and `truncated` beyond the brief's shape.** The brief gives `{ lists, skipped }`. The reader also says
  `partial: true` when anything that might have been a list was not read whole (a limit, a damaged archive, an
  encrypted or unsupported entry, a `Saved/` CSV without Title or URL) and marks a list cut by a limit `truncated`.
  Reason: without them the merge cannot tell "the place left the list" from "the read stopped before it", and would
  untag places on a damaged or oversize export.
- **A damaged `.tgz` keeps what it could read.** Gunzip is bounded to 50 MB; when it fails or overflows, a prefix is
  decompressed (`Z_SYNC_FLUSH`) and every complete tar entry in it is kept. Reason: one bad block late in a large export
  should not cost every list before it.
- **A `.zip` entry is checked against its CRC-32** (`zlib.crc32`, where the runtime has it), and a mismatch skips that
  entry as damaged. Reason:
  a silently corrupt CSV would otherwise produce wrong titles and untag places.
- **Outside `Saved/`, a CSV without Title and URL is skipped without making the read partial** (it is some other
  Takeout file, such as settings); inside `Saved/` the same CSV makes the read partial (it was meant to be a list).
- **The 10,000-items limit cuts the list being read and stops reading**; the 2,000-a-list limit cuts only that list
  and goes on. Both mark the list `truncated`.
- **Lists are sorted by name**, so the merge's output and the index are stable from export to export.
- **A bare `.csv` is one list named after the file**, like an entry in an archive.

## The link parser
- **`kind` is the strongest form found** (cid, place_id, name, query, pin) and every field the link carries is
  filled, so the resolution rule can use the CID and the pin of the same link.
- **CID `0` or longer than 20 digits is ignored** (not a real place). A place id must look like one (6–300 of
  `[A-Za-z0-9_-]`).
- **Only `google.<tld>` under `/maps` and `maps.google.<tld>` are Maps hosts**; any lookalike is `none`, the same rule
  the chat uses before making a name a link.

## The merge
- **A fourth match step: the last run's index.** Between CID and name, an item whose exact link the index already
  resolved to a slug that still exists matches that place. Reason: a place found by a search (no place id or CID in the
  link) would otherwise be looked up again on every export, spending the Maps budget for nothing.
- **A name match needs exactly one known place with that folded name**; two places sharing a name never match by name.
- **Never untag from a list the read did not see whole**: a `truncated` list drops nothing, and on a `partial` read a
  list absent from the export drops nothing. A list present and whole drops what left it, and an empty list untags its
  places, as the brief says.
- **A list not seen whole keeps its note** on each place still tagged with it.
- **One lookup per link**: an item saved in several lists is one `new` entry carrying every list and note.
- **Without `today`, every unresolved item is tried again** (the 30-day hold needs a date to count from).
- **Notes are clipped to 300 characters with "…"**, and a place keeps at most 20 list notes (the place schema's cap).

## The resolution rule
- **Reasons beyond the brief's three**: "nothing found", "a different place (the saved link names another)" (a CID or
  place id that does not match the result) and "no location to compare with the saved pin" (a link with coordinates and
  a result without them). Each says plainly why the item was not added; none of them guesses.
- **A place-id link is accepted only when the result has that place id.** The brief says the driver fetches the place
  directly and accepts it; checking the id costs nothing and catches a driver that searched instead.
- **The result may be in the Places API v1 shape or a flat one** (`id`/`displayName.text`/`location.latitude` or
  `place_id`/`name`/`lat`). Its CID is always read from its Google Maps link (`googleMapsUri`, `google_maps_uri` or
  `maps_url`), as the brief says, never from a bare field the driver might fill wrongly.
- **Helpers beyond the brief**: `lookupFor(item, parsed)` (how to look an item up: by place id, else the title plus the
  address with the pin as the bias), `recordResolution(index, url, outcome)` (write a lookup's outcome into the index),
  `listedPlace(…)` (the fields of a place file created from a list item, as the brief's "The memory" describes) and
  `applyListTags(place, …)` (update only an existing place's `lists` and `list_notes`). Reason: the private driver
  then applies the brief's rules by calling them instead of re-implementing them.

## The destination
- **`destinationFor` returns `null`** when no destination contains the place and the place has no locality or
  first-level area; the driver then uses the request's trip destination or asks.
- **A destination without a usable radius uses 20 km**; of several containing destinations the nearest wins.

## The place file (C14)
- **`lists` entries are unique** and **each `list_notes` entry names one of the place's lists, once** — checked in
  `checkPlace` (the schema subset has no `uniqueItems`).
- **`cid` is decimal digits, 1–20**, as the parser writes it.
- **The `listed` history event** joins the schema's event enum; its `note` is the list name.

## The core
- **The lists live on the places**: the Places tab's new last column `lists` (a JSON array). `registerSheet` gains the
  column (ensureSheets can only add a registered column) and `TG_PLACE_OPT` gains `lists` (the digest validator's
  optional keys); `tgPlacesUpsert` calls `_tgEnsureCols(['scouted', 'lists'])` so an old tab gains it on the next digest.
- **The stored set is cleaned**: trimmed, blanks dropped, each name once (the first spelling wins), at most 20 of at most
  80 characters. The digest validator does not require unique names (the upsert dedupes); it refuses a non-array,
  `null`, an empty or over-long name and more than 20.
- **A changed list set counts as "changed"** (`changed_fields: ['lists']`), not "verified": the owner sees a list change
  as a change to the place. Absent keeps the cell and is never a change; `[]` clears it.
- **A damaged `lists` cell reads as no lists**, and a place on no list has no `lists` key at all, so old rows read
  exactly as before.
- **`tgListNames()` counts exact names** and sorts them case- and accent-insensitively (ties by the exact text). Two
  spellings that differ only in case are two lists, as they are in Google Maps.
- **`/list <name>` matching**: the folded exact name, else the names it starts, else the names it is part of; more than
  one at the first tier that matches → "Which list? A · B" (at most 10 names). Folding ignores case, accents and runs of
  spaces.
- **`/list` order**: destinations by slug (a place without one last, as "(no destination)"), places by folded name;
  at most 40 places, then "… and N more — open Places in the app". **The app row rides on the last message whenever the
  app is set up**, not only past 40: the app shows the whole list with its filter.
- **`/lists sync` without a current trip sends no `trip`** (the generated stub refused instead): an export is not tied
  to a trip, and the routine can still file new places by their destination.
- **`/lists` never opens a request**, even with no lists yet; it tells the owner to send `/lists sync`. Anything else
  after `/lists` gets the usage line.
- **The last read is the latest `answered_at` of an answered `lists` request**, shown as a date in the owner's zone.
- **`/places` shows "📋 <lists>"** after the area on a search result (joined with ", ", at most 80 characters), in
  `tgCmdPlaceLine` — the brief's "`/places` search results show a place's lists".
- **`places.search { list }`** matches a folded exact name (≤ 80 characters, so `too_long` past that, like the other
  filters), `filters.lists` is the names the tab holds (≤ 200, sorted), and a row carries `lists` only when the place
  has some — added in `tgAppOpPlacesSearch` itself, so `places.get` and `tgAppPlaceOut` are unchanged.
- **The Places screen's list filter** sits after the tag filter, its option values are whole names (≤ 80), and it stays
  hidden when the core sends no `lists` facet or an empty one (an older core, or no lists yet).

Developed by: LightAISolutions
