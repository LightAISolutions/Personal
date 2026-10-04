# lists — the owner's saved Google Maps lists

The owner keeps places in Google Maps lists and asked Tour Guide to organise and maintain them alongside its own Places
(Phase 14, item 11; contract C14 wave 2; defaults in `helpers/decisions/WP-14d.md`). Google offers no list API in the
owner's region, so this works from the owner's **Google Takeout export of "Saved"**. Tour Guide reads the export, adds
each saved place to Places once (looked up inside the Maps budget), tags every place with the lists it is on, and keeps
those tags in step on each later export. It **never writes to Google's lists**.

| Part | Where |
|---|---|
| The engine: reader, link parser, merge, resolution rule, destination, notes (pure, `node:zlib` only) | `lists/*.mjs`, exported from `lists/index.mjs` |
| The chat: `/lists`, `/lists sync`, `/list <name>`, `tgListNames()`; kind `lists` → `RESEARCH` | `gas/28_lists.js` |
| Where the lists live: the Places tab's `lists` column (absent keeps it, `[]` clears it) | `gas/21_sheets.js` |
| The app: `places.search { list }` and its `lists` facet; the Places screen's list filter | `gas/32_app_api.js`, `live-site-pages/helper-app.html` |
| The place file: `lists`, `list_notes`, `cid`, the `listed` history event | `schemas/tour-guide-place.schema.json`, `checkPlace` |
| Invented fixtures (the town of Quillmere) | `lists/fixtures/` |
| Tests | `helpers/tests/pack_tour-guide_lists_engine.test.js`, `helpers/tests/pack_tour-guide_lists.test.js` |

## The export

`readSavedExport(bytes, { file, limits? })` → `{ lists: [{ name, items: [{ title, url, note, address }], truncated? }],
skipped: [{ file, reason }], partial }`.

- **What the export holds.** A Takeout "Saved" export is an archive with one CSV per saved list under a `Saved/`
  folder (`Takeout/Saved/Dinner spots.csv`). Each row is one saved place: its title, the owner's note or comment, and a
  Google Maps link. The columns differ by account and over time, so the reader finds them by header name, ignoring case:
  **Title** and **URL** are required; **Note** and **Comment** are both the owner's words (joined with " — " when both
  are set); **Address**, when present, helps the lookup; every other column is ignored. A missing optional column is
  never an error.
- **Formats.** A `.tgz` (gunzip, then the tar blocks: ustar names with their prefix, pax `path`, GNU long names), a
  `.zip` (the central directory, ZIP64 included; stored and deflated entries, each checked against its CRC-32; UTF-8
  names) or a bare `.csv` (one list, named after the file).
- **Which files.** Inside an archive, every `.csv` under a `Saved/` folder is a list, and so is any other `.csv` whose
  header has Title and URL; everything else is skipped and named in `skipped` (a `.zip` entry that is skipped is never
  inflated). Each CSV is one list, named after its file without `.csv`. An **empty list is kept**: it untags its places.
- **The CSV parser** follows RFC 4180: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF or LF, a
  leading BOM. Blank rows are skipped. Lists come back sorted by name.
- **`partial`** is true when anything that might have been a list was not read whole: a limit was reached, the archive
  is damaged (whatever could be read is kept), an entry is encrypted or uses another compression, or a `Saved/` CSV lacks
  Title or URL. A list cut by a limit carries `truncated: true`. The merge uses both flags (below).

## Link forms

`parseMapsUrl(url)` → `{ kind, cid, place_id, lat, lng, query, name }`; it never throws and never fetches anything.

| Link | `kind` | Read as |
|---|---|---|
| `…/data=…!1s0x1a2b…:0x9c8d…` or `ftid=0x…:0x…` (a feature id) | `cid` | the second number as an unsigned 64-bit integer (`BigInt`), in decimal: the CID |
| `…?cid=11280811658354310189` | `cid` | the CID |
| `…&query_place_id=ChIJ…` | `place_id` | the place id |
| `…/maps/search/47.1234,8.5678`, `…/maps/place/47.1,8.5`, `…?q=47.1,8.5` (a dropped pin) | `pin` | `lat`, `lng` |
| `…/maps/place/Moss+%26+Pine/@47.13,8.57,17z` | `name` | `name` (`+` and percent-decoded) and the `@lat,lng` |
| `…?query=Lantern+Noodle+House` or `q=` | `query` | `query` |
| `goo.gl/maps/…`, `maps.app.goo.gl/…` | `short` | nothing: a short link is never followed |
| any other host (or not a link) | `none` | nothing |

Only `google.<tld>` under `/maps` and `maps.google.<tld>` count as Maps; a lookalike host is `none`. `kind` is the
strongest form found (cid, place_id, name, query, pin), and every field the link carries is filled whatever the kind (a
feature-id link usually has a name and `@lat,lng` too).

## The merge

`mergeLists(lists | readResult, places, previous, { today, partial })` compares the export with the known places (the
owner's place files: `slug`, `name`, `place_id`, `cid`, `lists`, `list_notes`) and the last run's index.

- **Matching**, in this order: the link's place id equals a place's; the link's CID equals a place's; the index already
  resolved this exact link to a slug that still exists; the folded title equals the folded name of **exactly one** known
  place. Anything else is new.
- **Known places.** For each one it returns the list names to `add` and to `drop`, the resulting `lists` and the
  `list_notes` to keep, and `changed`. A place that left every list loses its tags; it is **never deleted and its
  status never changes**.
- **Never untag on a partial read.** A list the reader marked `truncated` drops nothing, and when the read was
  `partial` a list that is absent from the export drops nothing either: a list the read did not see whole is not
  evidence that a place left it.
- **New items** are returned for lookup (`new: [{ url, title, address, lists, notes, parsed }]`, one entry per link
  even when several lists hold it) — except one the index holds as **unresolved with the same link, tried in the last
  30 days**: that one stays unresolved with its old reason and is not looked up again.
- **The index** (`index: { v: 1, lists: { <name>: [{ title, url, slug } | { title, url, reason, tried }] } }`) is the
  last run's memory: what each item resolved to, or why not. `recordResolution(index, url, { slug } | { reason, tried })`
  writes a lookup's outcome into it. `counts` gives each list's matched, new and unresolved.
- **Notes.** `listNotesFor(item, list)` returns the owner's note trimmed to 300 characters (clipped with "…"). A note
  that `scanText` (`kits/research/lib/injection.mjs`) flags is not kept on the place: it comes back in `quarantine` with
  its list, title and reasons, for the driver to write to `quarantine/`. Notes are data that is shown, never instructions.

## The resolution rule

`lookupFor(item, parsed)` says how to look an item up: by place id when the link has one, else a Text Search on the
title (plus `, <address>` when the export has one) with the link's coordinates, when present, as the location bias.
`acceptResult(item, parsed, result)` → `{ ok, reason }` then decides, and **never guesses**:

| The link has | Accepted when | Otherwise |
|---|---|---|
| a CID | the CID in the result's Google Maps link equals it | "a different place (the saved link names another)" |
| a place id | the result is that place (the driver fetches it directly) | "a different place (the saved link names another)" |
| coordinates | the top result's folded name equals the folded title (or one contains the other and the shorter is at least 0.8 of the longer) **and** it lies within 300 m of the pin | "no exact match" · "too far from the saved pin" · "no location to compare with the saved pin" |
| nothing else | the same name test | "no exact match" |
| a short link | never | "a short link" |
| — (no result) | never | "nothing found" |

Every unresolved item is named to the owner with its reason and held in the index for 30 days.

## The destination and the place file

- `destinationFor(place, destinations)` → a slug: the nearest known destination (`[{ slug, lat, lng, radius_km }]`,
  default radius 20 km) whose circle contains the place, else the place's locality, else its first-level administrative
  area, slugified; `null` when none is known. A ward of a large city therefore files under the city once the city is a
  known destination.
- `listedPlace({ item, list, result, slug, destination, category, trip, on, notes })` gives the fields of a place file
  created from a list item: a `candidate` with priority 3, the category from the Maps kit's mapping, the activity
  "Saved in your <list> list", `lists`, `list_notes`, `cid`, and the history entry `{ trip, on, event: "listed", note:
  <list> }` (`trip` is the request's trip, else `lists`). `applyListTags(place, { lists, list_notes })` updates an
  existing place's tags and notes and nothing else, so a status a trip gave the place is never touched.
- The place file (C14) gains `lists` (≤ 20 names of ≤ 80 characters, each once), `list_notes` (≤ 20 of `{ list, note
  ≤ 300 }`, each naming one of the place's lists, once) and `cid` (decimal digits), and the history event `listed`.
  The private side, not the engine, decides which files to write.

## The chat and the app

- `/lists` — one line per list with how many stored places are on it, then "Last read from an export: <date>" (the day
  the last `lists` request was answered, in the owner's zone, from the core's Requests record) or "Not read from an export
  yet.", then "/list <name> to see one · /lists sync to read a newer export". Never opens a request.
- `/lists sync` — opens a `lists` request `{ trip? }` (the current trip when there is one), routed to `RESEARCH`. The
  routine reads the newest export in Drive and answers with a `places_digest` whose places carry `lists`, and a `reply`.
- `/list <name>` — the list whose folded name equals the text, else the one it starts, else the one it is part of
  ("Which list? …" when more than one fits). Its places grouped by destination, each with status and note line; at most
  40, then "… and N more — open Places in the app", with the app row when the app is set up.
- `tgListNames()` → `[{ name, count }]`, every list name on a stored place with its count, sorted by name.
- The Places tab's `lists` column: a digest place **without** `lists` keeps the stored value, `[]` clears it, and a
  changed set counts as a change. `/places` search results show "📋 <lists>". The app's `places.search` takes `list`
  (a folded exact name, ≤ 80 characters) and returns a `lists` facet; rows carry `lists` only when the place has some.
  The Places screen shows a list filter beside the tag filter when the facet has names.
- There is **no timer** in the core: the private side looks for a newer export when trip research runs, and on
  `/lists sync`.

## Limits

| Limit | Value | Past it |
|---|---|---|
| Lists in one export | 100 | the rest are not read; named in `skipped`; `partial` |
| Items in one list | 2,000 | the list is cut and marked `truncated`; `partial` |
| Items in all | 10,000 | the current list is cut, later ones are not read; `partial` |
| Unpacked size | 50 MB | reading stops; complete earlier entries are kept; `partial` |
| A note kept on a place | 300 characters | clipped with "…" |
| Retry an unresolved link | after 30 days | held with its reason until then |

## The owner's export steps

Done once; Google then repeats the export on its own. Takeout's labels change from time to time, so the words below may
differ slightly.

1. Open Google Takeout (takeout.google.com) while signed in to the account that owns the lists.
2. Choose **Deselect all**, then tick only **Saved** (the collections saved from Google Maps and Search).
3. Next step: for the destination choose **Add to Drive**; for the frequency choose **Export every 2 months**; for the
   file type choose **.zip** or **.tgz** (both are read); keep the default size.
4. **Create export.** Takeout puts the archive in a "Takeout" folder in Drive. Every two months a new one arrives.
5. Whenever the lists have changed and you do not want to wait, run the same export once with **Export once**, wait
   until Takeout says it is ready, then send `/lists sync` in the chat.

Confidence note: the archive's layout (one CSV per list under `Saved/`) and its column names come from exports seen so
far; the reader finds columns by name and skips what it does not recognise, so a changed layout costs at most the items
it cannot read, and `partial` stops it from untagging anything because of them.

Developed by: LightAISolutions
