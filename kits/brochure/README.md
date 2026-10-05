# Brochure kit

Turns a JSON brochure model (a planned trip plus its places) into one self-contained HTML document and, through the
image's pre-installed Chromium, a print-ready PDF. Print first (US Letter by default, A4 supported), good on screen
too. Nothing is fetched at render or view time: fonts, the Google Maps logo and any images are inlined; route
sketches and cover art are SVG generated from the data.

## CLI

Node never runs a directory's `index.mjs`, so always name the file:

```
node helpers/kits/brochure/index.mjs validate model.json
node helpers/kits/brochure/index.mjs render   model.json out.html        [--page letter|a4] [--no-fonts]
node helpers/kits/brochure/index.mjs pdf      in.html    out.pdf         [--page letter|a4] [--shots DIR]
node helpers/kits/brochure/index.mjs build    model.json outdir/         [--page …] [--shots [DIR]] [--name NAME]
node helpers/kits/brochure/index.mjs sample   outdir/    [--page a4]     (builds the invented fixture, with shots)
… render|build|sample … --google [--ledger PATH]   (real Google maps, place photos and route lines first)
```

Options go after the positionals. Exit codes: **0** ok · **1** usage or runtime error · **2** the model failed
validation (every problem listed, one per line, as a JSON-pointer path and message) · **3** the PDF step is
unavailable (Playwright or Chromium missing) — the HTML has still been written. `--shots` writes one PNG per page
(`page-01.png`, …) for review. Everything goes to stderr; outputs are only the files named.

Library use: `import { renderHtml, renderPdf, pdfAvailable, validate, prepare, pageSpec } from '…/index.mjs'`.
`renderHtml(model, { page, baseDir, embedFonts }) → { html, warnings, model }` (throws `ModelError`);
`renderPdf(html, outPath, { page, shotsDir, shots, scale }) → { pages, warnings, shots }`.
`addGoogleImages(model, { client, maps, photos, routes, photoWidth, maxPhotos }) → { model, stats, warnings }` (async).

## Google Maps links on every leg

Every leg links to Google Maps directions for that hop (`lib/directions.mjs`, Maps URLs: no key, no billing), built
from both ends' coordinates and place ids (`lodging` ends use the night's lodging). Walk, bike and drive legs open
that mode; transit, train and ferry legs open transit; **taxi legs open the train options** ("by train ↗"), because
the Routes API returns no transit routes in some countries (Japan among them) while the Google Maps app does. A leg's
own `maps_url` wins; a leg without coordinates at both ends gets no link. `directionsUrl(from, to, mode)` is exported
for other surfaces (Telegram).

## Real Google maps and place photos

`addGoogleImages` is the one build step that talks to Google, through a maps-kit client (`--google` builds one from
`MAPS_STATIC_KEY` and a usage ledger). It returns a **new** model; the input is untouched. In order:

1. **Route lines.** Each walk/drive/bike/transit leg without a `polyline` gets one from Compute Routes, so route lines follow streets. A leg Google cannot route keeps a straight line.
2. **Maps.** One Maps Static API image per day (260×320 at scale 2) and one for the whole trip (420×300). Each is requested at a **centre and zoom the kit computes** (`lib/mapframe.mjs`: Web Mercator `fitView` over every marker and route point, extra bottom padding so Google's logo and copyright stay clear). Google draws the routes in the day's colour and business pins are hidden. The renderer projects the brochure's own numbered badges, meal rings and lodging house onto the image exactly, so a Google map and a drawn sketch carry the same markers.
3. **Photos.** Each place with a `google_photo.name` and no own `image` gets that Place Photo, credited on the card as "Photo by <author> · Google Maps" with the author's link. The place's own image always wins.

Images are inlined as data URIs (nothing is fetched at render or view time and nothing outlives the build). Any
failure (no key, quota, HTTP error) becomes a warning and the drawn sketch / no photo / straight line remains. The
sources page states that the maps are Google Maps with markers added, and the colophon credits "Maps © Google".
Street View is never used: Google forbids it in print. Model fields: `trip.map_image` / `days[].map_image`
`{src*, alt, credit, view {center, zoom, width, height}}` (without `view` no markers are overlaid),
`places.*.google_photo` `{name, src, author, author_url, width_px, height_px, alt}`, `days[].legs[].polyline`.

## The model

`schema/brochure.schema.json` is the contract (JSON Schema 2020-12 subset, validated by the kit's own `lib/validate.mjs`
— no dependency). `fixtures/sample-trip.json` is a complete, invented example. Shape, `*` = required:

| Field | What it is |
|---|---|
| `version*` | `1` |
| `trip*` | `title*`, `destination*`, `start_date*`, `end_date*` (ISO dates, ≤ 31 days), `subtitle`, `country`, `timezone`, `locale` (BCP 47, default `en-US`), `travelers[]`, `prepared_for`, `pace`, `day_start`/`day_end`, `intro` (paragraphs split on blank lines), `cover_image` `{src, alt, credit}`, `lodging[]` (`name*`, `address`, `from`/`to`, `lat`/`lng`, `maps_url`, `note`, `check_in`/`check_out`), `build_id`, `built_on`, `verified_on` |
| `days[]*` | one per day: `date*`, `theme`, `summary`, `lodging` (name, matched against `trip.lodging`), `stops[]*` (`place*` key, `arrive*`, `depart*`, `activity`, `minutes`, `note`, `booked`, `time_style` exact/about — about shows the arrival to the nearest 15 minutes, `check_on_day`), `legs[]` (`from`/`to`: place key or `lodging`, `mode*` walk/transit/train/drive/taxi/bike/ferry/other, `minutes*`, `distance_m`, `depart_at`, `line`, `maps_url`, `note`, `estimated` — shown as an estimate, `flags` footpath/trail/uphill/downhill, `taxi_minutes`, `buffer_minutes`), `spare_minutes`, `meals[]` (`kind*` breakfast/coffee/lunch/snack/dinner/drinks, `start*`, `end`, `place` or `name`, `note`), `free[]`, `warnings[]` (`severity` info/warn/alert, `text*`, `place`), `alternatives` (`title`, default "If it rains"; `items[]*` of `place*` key and `note`, at most 3, shown in the aside without a card), `verified_on` |
| `places*` | object keyed by the ids the stops use: `name*`, `category`, `tagline`, `address`, `lat`/`lng`, `hours[]` (Google's seven weekday lines), `hours_today`, `closed_days[]`, `rating`, `review_count`, `price_level`, `website`, `phone`, `maps_url`, `place_id`, `business_status`, `editorial`, `image`, `note` (`why_you`, `what_to_do`, `what_to_skip`, `best_time`, `tickets`, `accessibility`, `pairings[]`, `food`), `reviews[]` (`author*`, `author_url`, `rating`, `text*`, `when`, `url`), `sources[]` (`title`, `url*`, `accessed`, `supports`), `fetched_on` |
| `later[]` | named lists of what was not scheduled: `name*`, `description`, `items[]*` (`place` or `name`, `reason`, `note`) |
| `practical[]` | sections for the practical page: `title*`, `text` and/or `items[]` (`label*`, `text*`, `url`) |
| `attribution` | `google` (force the Google block on/off; default: on when any place carries Google-sourced fields), `sources[]` (trip-level ledger), `generator`, `note` |

**Contract C11 fields (Phase 11, all optional).** A model with none of them renders byte for byte as before: the C11
styles are added only when `usesC11(model)` is true, and each piece of markup only when its field is there.

| Field | What it is | Where it shows |
|---|---|---|
| `days[].start` / `end` | `{name*, time*, maps_url, lat, lng, note}`: the day's real start (an arrival) or end (a departure); legs may use `day-start` / `day-end` | first / last row of the rail |
| `days[].bags` | `{kind*: carry/locker/hotel/forward, text, start, end, where}` | a timed rail row, or a line under the start when untimed |
| `days[].sunset`, `extras[]` | `HH:MM`; at most 3 `{kind*: event/saved, name*, place, time, km, note, url}` | the "This evening" box, in clock order at sunset (hidden when the day ends at a departure before sunset) |
| `stops[]` | `last_entry`, `minutes_source` (official/research/estimate), `crowd_slot` (opening/late), `booking_line` (shown only when not booked) | the stop's meta lines |
| `meals[].booking` | the booking rule | a meal with a booking, or a dinner at a place with `facts`, becomes the dinner card |
| `places{}.facts` | `{checked*, stale, visit, last_entry, closed, booking, price, payment, gate, menu, menu_fits, menu_checked, menu_stale, sources[] ≤ 6}`: display lines, already written | a facts block on the card with the date checked and "check again" when stale |
| `places{}.flags` | `local_favourite`, `crowd_magnet` | a "local favourite" tag on the rail and the card |
| `season` | `{checked*, lead, weather {text*, high_c, low_c, rain_days}, bloom[] ≤ 6, events[] ≤ 40, sources[]}` | a season page after the overview, before day 1 |

**Contract C12 fields (Phase 12, a day re-planned from where you are, optional).** Their styles are added only when
`usesC12(model)` is true.

| Field | What it is | Where it shows |
|---|---|---|
| `stops[].visited` | `true` only: the stop was done before the re-plan (visited stops come first) | the rail row muted with a hollow badge and a "✓ visited" tag, still numbered in order; a tick on the glance list |
| `legs[].from: "here"` | where the traveller was when the day was re-planned from a shared location; it has no coordinates | "from where you were"; the kit's own link for that leg has no origin (Google starts from the viewer's location) |

**Contract C18 fields (Phase 18 wave 1, all optional).** Their styles are added only when `usesC18(model)` is true;
a model without them renders byte for byte as before (pinned in `tests/kit_brochure_c18.test.js`). Sample:
`fixtures/sample-trip-c18.json`. One-line texts are at most 160 characters.

| Field | What it is | Where it shows |
|---|---|---|
| `trip.clock` | `24h` or `12h`; absent: the locale's own clock (12 h for en-US/CA/AU/NZ/PH) | every time in the brochure (carried as the locale's `-u-hc-` extension) |
| `trip.temp` | `c` (default), `f` or `both` | the season page's temperature figures (the planner's own prose is left as written) |
| `days[].checklist` | `must` ≤ 6, `carry` ≤ 8, `constraints` ≤ 6 lines | "Today's checklist" after the day header, groups Must / Carry / Limits (empty groups omitted) |
| `days[].prep` | `night_before` ≤ 6 lines, `steps` ≤ 6 `{time, text}` in time order | "Night before · This morning" beside the checklist |
| `days[].departure` | `to`, `at` (required), `by` (leave-by, ≤ `at`), `scenarios` ≤ 2 `{label, steps ≤ 5, spare_min}`, `fallbacks` ≤ 4, `note` | a "Getting out" box on the rail, before the first row at or after the leave-by time (at the latest before the day's end) |
| `fixed` on stops, meals, `start`, `end` | `true` only: the time cannot slide | the time bold with a "fixed" tag (never an "about" time); one legend line on each day that has one |
| `tip` on stops and meals | one line | "Tip" line under the row |
| `free[].title`, `free[].options` ≤ 4 `{name, place, km, walk_min, open, note, url}` | the window's name and what is nearby | "Title · length — note" and one line per option (walk or distance, open status, link, card reference) |

Semantic checks beyond the schema (`lib/model.mjs`): every place key resolves, days fall inside the trip and are not
duplicated, stops are in clock order and do not depart before they arrive, meal/free blocks end after they start; for
C11, a `day-start` / `day-end` leg needs the day's start / end, extras and season events name known places, and the
bag step, season events and blooms end after they start; for C12, `here` may only start a leg (it is reserved while
no place is keyed `here`); for C18, prep steps are in time order, a departure's leave-by is not after it, and a day's
free options name known places, walk 0–120 min and are not offered twice.
`prepare()` then derives what the sections render: numbered days with a merged timeline (stops, legs, meals, free
time in clock order), per-day statistics, hours for the day from the weekday lines, the cards in order of first
appearance, and page cross-references. Images: `src` is a path relative to the model file or a `data:image/…` URI;
remote URLs are dropped with a warning (2 MB per image, 12 MB per document; SVG with script is refused).

## Design and pagination

Editorial, not dashboard: Bitstream Charter throughout, white paper with a cream cover and asides, terracotta and
slate-blue accents, one hue per day (rotating through seven) that colours the day's numeral, rail badges, route
sketch and page tab. Tokens and the modular type scale live in `lib/tokens.mjs`; the stylesheet in `lib/css.mjs`
has a screen layer (flowing, responsive to phone width) and a `html.paged` layer used for print.

The HTML flows; the PDF step paginates it **inside Chromium** (`lib/paginate.mjs`, evaluated by Playwright). The
sections declare a small markup contract that the paginator reads:

| Attribute | Meaning |
|---|---|
| `data-pg="sheet"` (+ `data-bleed`) | the block is a whole page (the cover) |
| `data-pg="section"` + `data-folio` / `data-tab` / `style` | starts a new page; folio text, day tab, hue |
| `data-pg="block"` (+ `data-keep`) | unsplittable; `data-keep` travels with the next block (headings) |
| `data-pg="split"` + `data-cont` | a container of blocks that continues on later pages under a "…, continued" note |
| `data-pg="cols"` | two columns of unsplittable items, filled left then right and balanced (cards, lists) |
| `data-pg="aside"` | floated right, never split (route sketch, lodging, alternatives, warnings) |

Widow control never leaves a lone last item on a continuation page. **Near-fit compaction**: a section that spills
only a little (its second page is a continuation using under 30 % of the height) is re-set with the `tight` class
(smaller gaps) and then `tight tight2` (+ a 0.9 zoom on the dense parts); the first setting that fits one page wins,
otherwise the normal setting stands. The sample's day one and the sources page fit through this. After placement
every `[data-pageref]` link becomes "p. N". Page size: `letter` (default) or `a4`; margins are identical on both so a
layout that works on one works on the other (`--page` at render or PDF time).

## Playwright, Chromium, fonts, safety

**Playwright** is resolved at run time, never installed by the kit: `require('playwright')` from the kit's own
resolution chain first, then the image's global copies (`/opt/node-tools/node_modules/playwright`,
`/usr/lib/node_modules/playwright`, `/usr/local/lib/node_modules/playwright`). **Chromium** is
`/opt/pw-browsers/chromium` (override with `BROCHURE_CHROMIUM`); `BROCHURE_ALLOW_DEFAULT_CHROMIUM=1` lets
Playwright's own browser be used where one is installed. Nothing ever runs `playwright install`. When either is
missing, `pdfAvailable()` is false, `build` exits 3 with the HTML written, and `pdf` exits 3 with a message naming
what is missing — a routine treats that as "HTML only".

**Fonts.** Bitstream Charter — the four X11 Type 1 faces converted to WOFF2 by `assets/fonts/convert-charter.py`
(fontTools, run once at build time; the WOFF2 files are committed, ~100 KB in all). Licence:
`assets/fonts/NOTICE-charter.txt` (free to use, modify and redistribute with the notice intact). The faces are
inlined as `@font-face` data URIs so the HTML and the PDF carry them; `--no-fonts` (or `embedFonts:false`) falls back
to the system serif stack. Chromium embeds the glyphs used in the PDF.

**Attribution.** Google-sourced fields (`hours`, `rating`, `review_count`, `editorial`, `reviews`, `maps_url`, …)
are marked on the cards, the Google Maps logo and data statement open the sources page, each quoted review
credits its author with a link to the review, and every research source is listed with the date it was read —
per the Places API policies (`developers.google.com/maps/documentation/places/web-service/policies`, read 2026-10-01).

**Safety.** Every model string is web-sourced or owner-typed text: all pass `esc()`; URLs pass `safeUrl()` (http(s)
and mailto only — anything else becomes plain text, and its display form is dropped too); long excerpts are
clipped. The renderer refuses to emit a document containing `<script`, and the tests check that every `src` and
`href` is a `data:` URI, an in-document anchor, or an http(s)/mailto link. The sample fixture uses reserved
domains only.

Developed by: LightAISolutions
