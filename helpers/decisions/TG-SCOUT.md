# Tour Guide — Scout (a ranked "find X in Y" list)

> Owner's ask (2026-10-03): direct the Tour Guide to search a trip location for one food or activity ("matcha in Kyoto",
> "yuzu"), get a **ranked list of options to choose from**, see many options **at a glance** instead of opening Maps
> links one by one, keep it **distinct from the brochure**, and **save the places in the Places tab**.
> Built on Opus 5.5 · high (a focused feature, not a planning phase; owner's Opus-only rule). Coordinator: the thread
> "Tour Guide Scout". This file is the contract every work package builds against, then the decisions log.

## 1. What the owner gets

- **Ask:** `/scout matcha in Kyoto` in the chat (or `/scout matcha` — the current trip's destination), or the app's
  **Scout** screen (what + where, one button).
- **Back in the chat:** one message — `🔎 Matcha in Kyoto — 10 picks, ranked for you`, numbered lines (name · area ·
  reach · why), ➕ buttons to put a pick on the current trip's Later list, and **📱 Open the board** (the app); then the
  **Scout board PDF** as a document.
- **The Scout board** (HTML in the app, PDF in the chat and on Drive) — a comparison sheet, not an itinerary:
  a masthead (what, where, how many, from where reach is measured), **one map with every pick numbered** (and the
  hotel), then **compact cards** (rank, photo, name, area, ★ rating and count, price level, hours on the trip's days
  with closed days flagged, reach from the hotel, what to try, why it ranks there as four small bars — on-topic,
  quality, fit, reach — and labels: 💎 gem, 🌱 vegetarian verified/likely, booking, queue, cash), a **compare table**
  (rank · name · rating · price · reach · open on your days · veg), the **left-out list** with reasons, and the Google
  attribution and photo credits. Mobile-first single column in the app, two columns in the PDF.
- **Places tab:** every shown pick is written to `places/<slug>.md` (tags `scout` and the query word, a `scouted`
  history entry) and reaches the Places tab through the existing `places_digest` envelope.
- **How it differs from the brochure:** the brochure is a day-by-day itinerary for a planned trip, built after the
  plan; a Scout board is one question answered across a whole city, before or without a plan, ranked and comparable.

## 2. Flow

1. Core (`gas/16_scout.js`): `/scout <what> [in <where>]` or app op `scout.new` → `tgOpenKindRequest('scout', payload)`
   with `payload = { query, where?, destination?, trip?, limit? }` (`query` ≤ 80 chars, `where` ≤ 80). Ack:
   `🔎 Scouting <b>matcha</b> in <b>Kyoto</b>…`.
2. Routing: kind `scout` fires routine **`SCOUT`** when `ROUTINE_FIRE_URL_SCOUT` is set, else **`RESEARCH`** (the
   trip-research routine, whose SKILL.md hands a `scout` request to `skills/scout/SKILL.md`). No new routine is needed.
3. Brain (`skills/scout/` in the private repo): search (Text Search, enterprise_atmosphere tier, 2–3 queries), web
   research for on-topic evidence, vegetarian evidence and what to try (judgments file), rank (`packs/tour-guide/scout`),
   reach from the hotel (one WALK route matrix), photos and one static map, board HTML + PDF uploaded through the
   core's upload route, places written, then envelopes: `scout` (in reply to the request), `places_digest`, `reply`
   (one line + `drive_file_ids` with the PDF), one wake.
4. Core: `scout` handler stores the record (Scouts tab) and sends the ranked message; `places_digest` updates the Places
   tab (existing handler); `reply` closes the request and sends the PDF (existing).

## 3. The `scout` payload (envelope type `scout`, schema `schemas/tour-guide-scout.schema.json`, kind `scout`)

Own data only — **no Google field** (rating, count, hours, price, address, website, photos never enter the payload, the
Scouts tab or memory; they live only in the build-scoped board files, like the brochure).

```
{ v?: 1, kind?: "scout",
  scout_id: "sc-YYYYMMDD-<slug>"            // ^sc-\d{8}-[a-z0-9-]{1,40}$ , unique per run (add -2, -3 on a repeat the same day)
  query: string 1–80,                       // what the owner asked for, cleaned ("matcha")
  destination: slug,                        // "kyoto"
  place_label: string 1–80,                 // "Kyoto, Japan"
  trip?: slug,                              // when the scout was run for a trip
  group: "food" | "activities",
  created_on: YYYY-MM-DD,                   // in the owner's tz
  from?: string ≤ 80,                       // what reach is measured from ("your hotel", "the city centre")
  diet?: string ≤ 80,                       // the hard diet applied ("vegetarian") — absent for activities
  items: [ ≤ 20, n = 1..N in rank order, slugs unique {
    n: int ≥ 1, slug, name ≤ 120, area ≤ 80, category (^[a-z][a-z0-9-]{0,31}$),
    score: int 0–100, parts: { topic, quality, fit, reach } each int 0–100,
    why_you: string 1–200, try?: string ≤ 120,  // what to order / do there (a vegetarian dish for food)
    labels: [enum: gem | veg_verified | veg_likely | booking | queue | cash_only | chain | new | seen_before | far] ≤ 8,
    rated?: string ≤ 40,                       // a band word, never the number ("very highly rated")
    reach?: { minutes: int 0–600, mode: WALK | TRANSIT | DRIVE, estimated: bool },
    maps_url: https url, place_id?: string } ],
  left_out: [ ≤ 20 { name ≤ 120, reason: off_topic | diet | diet_unproven | low_rating | unproven | closed |
                     closed_on_trip | too_far | duplicate | other } ],
  more?: int ≥ 0,                            // ranked picks not shown (over the limit)
  drive?: { board_html?: driveId, board_pdf?: driveId } }
```
Payload ≤ 60 000 chars. `validatePayload('scout', p)` in the pack and `tgEnvValidateScout` in the core mirror each other.

## 4. Ranking (pure, `packs/tour-guide/scout/`)

`score = round(100 × (0.35 T + 0.25 Q + 0.15 F + 0.10 L + 0.15 R))`, every part 0–1 (weights in `scout-weights.mjs`):
- **T on-topic** — how much the place is *about* the query: the skill's judgment `relevance` when given, else name /
  type / editorial-summary match (name contains the query → 0.9, a type that matches the query's usual type → 0.6,
  editorial summary mentions it → 0.5, else 0.2).
- **Q quality** — Bayesian rating `(v·r + m·μ)/(v+m)`, m = 30, μ = pool mean (else 4.2), mapped 3.8 → 0 … 4.8 → 1.
- **F fit** — the skill's `fit` (profile and party), default 0.5.
- **L local** — 0.25 per distinct local mention (local-language, editorial, community), capped at 1; chain → 0.
- **R reach** — minutes from the nearest anchor: ≤ 10 → 1, linear to 0.3 at 40, 0.1 past 60; unknown → 0.5;
  −0.3 when closed on some (not all) trip dates.
Screening before scoring (each drop → `left_out` with a reason): not operational → `closed`; closed on every trip date →
`closed_on_trip`; rating < 4.0 with ≥ 20 ratings → `low_rating`; < 5 ratings and no local mention → `unproven`;
T < 0.3 → `off_topic`; for **food** with a diet: veg `no` → `diet`, veg `unknown` and Google `servesVegetarianFood`
not true → `diet_unproven` (the owner's hard rule: every food pick names something the party can eat); beyond 90 min → `too_far`;
same place id twice → `duplicate`. Ties: score, then rating count, then name.

## 5. Places, memory and the Places tab

- `places/<slug>.md`: a new place gets `status: candidate`, `destination`, `category`, `tags: ["scout", <query word>]`
  (existing tags kept, the query word added), `why_fit` = the item's why line, `activity` = the try line or the
  query, `priority: 2`, `source_trip` = the trip when there is one; the Gem fields when known. Every shown pick gets a
  history entry `{ trip: <trip slug, else the scout_id>, on, event: "scouted", note: "<query> #<n>" }` — `scouted` is
  a new history event in `schemas/tour-guide-place.schema.json`.
- One `places_digest` for the destination with the shown slugs (the existing handler upserts the Places tab).
- `quarantine/` for any page passage relied on; `log/` one line.

## 6. Core surfaces

- Sheet tab **Scouts**: `id, created_on, query, destination, place_label, trip, group, count, items_json, left_json,
  drive_html, drive_pdf, received_at` (own data only; a re-delivered scout_id replaces its row).
- `/scout` command; `/scouts` lists the last 10. Callback `sc:<id key>:<n>` = ➕ add pick n to the current trip's Later
  list (same as `/places` ➕).
- App ops (`gas/35_scout_app.js`, added to `TG_APP_OPS`): `scout.list` → last 20 scouts (head fields);
  `scout.get { id }` → the stored record; `scout.board { id }` → the board HTML inline up to 900 000 chars, else the
  Drive link (same in-folder rule as `brochure.get`); `scout.new { query, where? }` (write) → request id;
  `scout.add { id, n }` (write) → adds pick n to the current trip's Later list.
- Shell: a **Scout** screen — search form, past scouts, a scout's board (sandboxed iframe) with a **Pick** list
  (➕ add to trip, Map ↗).

## 7. Engine API (`helpers/packs/tour-guide/scout/index.mjs`, plain Node ESM, no network, no clock)

```js
parseScoutText('matcha in Kyoto')      → { what: 'matcha', where: 'Kyoto' }   // also "matcha, Kyoto", "matcha @ Kyoto", "matcha near Gion, Kyoto"; where '' when absent
scoutId(created_on, what, taken = [])  → 'sc-20261003-matcha' (adds -2, -3… when taken)
guessGroup(what)                       → 'food' | 'activities'                 // a small word list; the skill may override
scoutQueries({ what, where, group, diet, extra_terms = [] }) → ≤ 3 Text Search strings ("matcha in Kyoto", "matcha cafe Kyoto", + "vegetarian" variant for food with a diet)
fromScoutResult(rawPlace, { query })   → pool record = gems fromSearchResult(raw) + serves_vegetarian (true|false|null), editorial (string, in-run only)
rankScout(pool, { what, group, diet, anchors: [{ label, lat, lng }], reach: { <place_id>: { minutes, mode, estimated } },
                  judgments: { <place_id>: { relevance?, fit?, veg?: 'verified'|'likely'|'no'|'unknown', try?, why?, labels? } },
                  trip_dates = [], limit = 10 })
                                       → { items: [{ place_id, name, record, score, parts:{topic,quality,fit,local,reach} (0–1), labels, why, try, reach }],
                                           left_out: [{ place_id, name, reason }], more }
scoutPayload({ scout_id, query, destination, place_label, trip?, group, created_on, from?, diet?, ranked, slugs: { <place_id>: slug },
               areas: { <place_id>: area }, categories: { <place_id>: category }, drive? }) → payload (validated; throws on a Google field)
scoutPlaceFields(item, { query, trip, scout_id, on, existing? }) → the Place fields + the history entry for places/<slug>.md
renderScoutBoard({ payload, google: { <place_id>: { rating?, count?, price_level?, hours?: <Places regularOpeningHours>, website?, address?,
                   photo?: { data_uri, attributions: [{ name, uri? }] } } }, map?: { data_uri, width, height, view }, anchor?: { label, lat, lng },
                   locations: { <place_id>: { lat, lng } }, trip_dates?, options: { built_on, page, embedFonts, owner_tz } }) → { html }
renderScoutBoardPdf(args, outPdf)      → { html, pdf|null, available }        // Chromium through the brochure kit
```
The map: one Static Maps image fitted to every pick and the anchor (`fitView` / `projector` from the brochure kit's
`mapframe.mjs`), our numbered markers overlaid as SVG at exact positions (as the brochure does); without a key or an
image, a drawn sketch of the same points. Images are `data:` URIs only (the app's iframe allows nothing else); links
`https:` only; every string escaped. Board HTML for the app omits embedded fonts and keeps photos ≤ 360 px wide so a
10-pick board stays well under 900 000 chars.

## 8. Decisions log

- **Name.** "Scout" (`/scout`, the Scout screen, the Scouts tab, the Scout board). Hunt, Spotlight, Sampler and Finder were offered; the owner kept Scout (2026-10-03). Ids (`sc-…`), the envelope type and the files use `scout`.
- **Model.** Built on Opus 5.5 · high (owner's rule while the Fable weekly limit is near); no Fable subagent.
- **Routine.** No new routine: a `scout` request routes to `SCOUT` when that routine is configured, else to the trip-research routine, whose skill hands the kind to `skills/scout/SKILL.md`. The owner chose no dedicated routine for now (2026-10-03) and asked to be reminded when one would pay off: when scouts run about three times a week or more, when a scout waits behind a running trip-research run, or at the after-trip tuning (Phase 8 part 2, item 10 of its resume note), whichever comes first.
- **Photos.** Google bills `places.photos` as a Text Search Pro field (developers.google.com/maps/documentation/places/web-service/text-search), so the Maps kit's Pro and higher search masks (Text and Nearby; Nearby's floor is Pro) carry it at no extra SKU (owner allowed the change 2026-10-03, v01.53r). Each pick's photo name comes with the search; the skill keeps its one-Place-Details-call fallback (Essentials, photos are IDs-only there) only for a record that arrives without one, then one Place Photo at 360 px per shown pick.
- **Google fields on the board.** The board shows Google's rating, count, price level, opening hours on the trip's days and the website, fetched for that build only and never stored (as the brochure does). The `scout` payload, the Scouts tab and `places/` carry none of them; `rated` is a band word. The owner said yes (2026-10-03).
- **Diet.** The party's hard diet is a screen, not a weight: a food pick stays only with `veg` `verified` or `likely`. Google's `servesVegetarianFood` alone can make a pick `likely` only for a vegetarian diet; vegan and gluten-free have no Google fallback and need the routine's judgment.
- **Gem.** `gem` = two or more distinct local mentions, quality ≥ 0.6, 400 ratings or fewer, not a chain. The pool's mean rating (all unique rated records) anchors quality.
- **Parts.** The payload's `parts` omit `local` (the schema has four parts: topic, quality, fit, reach); local word of mouth shows as the gem label and in the why line.
- **Reach.** One WALK route matrix from the trip's lodging for the 25 strongest candidates; a walk over 20 minutes becomes a train estimate (station walks + the ride, the planner's rail figures). A TRANSIT matrix is asked only outside Japan, where Google routes transit. Without lodging, no reach part (neutral).
- **Images.** The static map is a JPEG at 640 × 420 (scale 2) with the brochure's map styles; without a key or an image the board draws a sketch of the same points.
- **Core.** `drive.board_html` / `board_pdf` may be null (an upload that failed); the core's validator accepts that, as the schema does.
- **§7 as built.** `fromScoutResult` also keeps the first photo's name and credits (in-run only); `scoutPlaceFields` also takes `destination` and returns `{ place, entry, changed }`; judgments carry `area` and `mentions` (`[{ ref, language, kind, publisher? }]`), which the skill joins to the records as `local_mentions`.

Developed by: LightAISolutions
