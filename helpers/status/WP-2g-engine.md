# WP-2g-engine — Gem Funnel: the `gems/` scoring module: status

**State: done** (2026-10-01). Branch `wp-2g-engine`, worktree `../wt-4b-2g-engine` (from `origin/main` c17cd68, v01.19r), never pushed. Defaults and reasons: `helpers/decisions/WP-2g-engine.md`. Spec: `helpers/decisions/hidden-gems-proposal.md` §4 stages 2–5, §6 data-model row, §7 decisions 18–22.

## Contract (proposal §4, stage by stage)
| Stage | Item | State |
|---|---|---|
| 1 → 2 | Pool record shape, defensive validation (`gems:` errors), `fromSearchResult` for raw Places (New) results, category derivation, slug derivation | done — `gems/gems-record.mjs`; documented in `gems/README.md` |
| 2 | `screen(pool, { trip_dates, anchors, off_track_minutes, modes, avoid_types, chain_list?, rating_floor \| appetite })` → `{ kept, dropped: [{ place_id, reason_code, detail? }] }`: not_operational · avoided_type · chain (repeated ≥ 3 / listed) · low_rating · too_few_ratings (waived by ≥ 2 local mentions or an owner seed) · closed_all_dates · too_far (straight line to our anchors, WALK 4.5 / TRANSIT 15 / DRIVE 30 km/h) | done — `gems-screen.mjs`, `gems-chains.mjs` (12 generic global brands), `gems-geo.mjs`, `gems-hours.mjs` |
| 3 | `scoreGems(kept, { appetite, aggregate_counts?, city_size?, fit_estimates?, profile?, trip_dates?, day_start?, day_end?, anchors?, off_track_minutes?, modes?, rough_edges? })` → `{ q, o, l, f, p, gem_score, gem }`: Bayesian Q (m = 30, μ per category or 4.2 under 20 members, 4.0 → 0 … 4.9 → 1); bucketed obscurity (large 40–400, small 15–150, > 2 000 → 0, seeds 0.5); local-ness point table; F from `fit_estimates` else `estimateFit`; practicality; weights 0.35/0.25/0.20/0.15/0.05 with the ±0.10 appetite shift; 💎 = O ≥ 0.6 ∧ L ≥ 0.3 ∧ Q ≥ 0.6 | done — `gems-score.mjs`; every number in `gems-weights.mjs` (`weightsFor`, `ratingFloorFor`, `gemFloorFor`) |
| 4 | `flagEvidence(record, { trip_dates, today, visit_date?, signals? })` → `{ flags ⊆ unproven \| tourist_oriented \| closed_day_conflict, record }`; unproven clears `gem`; reviews read for publish times only | done — `gems-flags.mjs` (`FLAG_LABELS`, `TOURIST_SIGNALS`) |
| 5 | `gemLine(record, { category_median_count })` ≤ 200 chars from numbers and source kinds/counts, deterministic, whole-clause trimming | done — `gems-line.mjs` |
| 5 | `selectShortlist(scored, { appetite, per_group, decided, group_of })` → `{ groups: [{ id, items, gems_wanted, gems_shown, floor_met }], not_shown, excluded }`; floors 1 → 0+0, 2 → 1+1, 3 → 2+2, 4 → 3+2, 5 → 4+3 | done — `gems-select.mjs` |
| 5 | `gemsNotChosenList({ trip_id, not_shown, today })` → LaterList "Gems not chosen", `code: 'not_shown'` | done — `gems-select.mjs`; schema validation pending WP-3d (see request 1) |
| 6 | `toPlaceFields(record)` → `gem_score, gem, obscurity, local_mentions (≤ 20 of { ref ≤ 120, language, kind }), flags (≤ 5)`; `toShortlistFields` → `gem, gem_line`; `assertNoGoogleFields` guard | done — `gems-project.mjs` |
| — | Compliance invariants in code and README (ids + our numbers persist; reviews in-run only; straight-line to our anchors only; nothing trains) | done — `gems/README.md` "Compliance invariants"; enforced by `normalizeRecord` (drops review text) and `assertNoGoogleFields` |
| — | Fixture: invented pool of 53 places for Port Sorrel with every carrier the brief lists (chain ×3 + a listed chain, non-operational, low rating, too few, waived-by-mentions, closed on all dates, too far, avoided type, 5 gem candidates with local-language mentions, top-ten mass tourism, unproven (5 fresh reviews / 30 ratings), tourist-oriented, 2 owner seeds, by_date hours, unknown hours, 3 places > 2 000) | done — `gems/fixtures/gems-fixture-port-sorrel.json`, `gems/fixtures/index.mjs` (`carriers` names each one) |
| — | Tests | done — `helpers/tests/pack_tour-guide_gems.test.js`, 11 tests |

## Checks (run from /home/user/wt-4b-2g-engine at the last code commit)
- `node --test helpers/tests/` → `# tests 238 · # pass 237 · # fail 0 · # skipped 1` (the skip is the Maps kit's by-hand live smoke, pre-existing). All 11 WP-2g-engine tests pass.
- `node helpers/tools/bundle.mjs --all --check` → `ok: hello — 16 files, 99311 chars, 4 scopes` · `ok: tour-guide — 15 files, 97738 chars, 4 scopes` (gems/ is library code, not a GAS bundle input).
- `node helpers/tools/boundary-check.mjs` → `boundary-check: clean — 281 file(s) under …/helpers`.

## Requests to the coordinator (files WP-2g-engine does not own)
1. **WP-3d schema wording this module relies on** (`helpers/packs/tour-guide/schemas/`):
   - `tour-guide-later-list.schema.json` → `items.items.properties.code.enum` gains the string **`"not_shown"`** (exactly). Then in `helpers/tests/pack_tour-guide_gems.test.js`, test "gemsNotChosenList…", replace the three lines after the `// TODO(WP-3d)` comment with `assert.deepEqual(s.validate(list, 'later-list').errors, []);` and delete the comment.
   - `tour-guide-place.schema.json` optional properties, exactly these names and shapes: `"gem_score": { "type": "number", "minimum": 0, "maximum": 100 }` · `"gem": { "type": "boolean" }` · `"obscurity": { "type": "number", "minimum": 0, "maximum": 1 }` · `"local_mentions": { "type": "array", "maxItems": 20, "items": { "type": "object", "additionalProperties": false, "required": ["ref", "language", "kind"], "properties": { "ref": { "type": "string", "minLength": 1, "maxLength": 120 }, "language": { "type": "string", "pattern": "^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$" }, "kind": { "enum": ["editorial", "community", "local-language"] } } } }` · `"flags": { "type": "array", "maxItems": 5, "items": { "enum": ["unproven", "tourist_oriented", "closed_day_conflict"] } }`. `toPlaceFields()` emits exactly this object.
   - `tour-guide-shortlist.schema.json` item properties: `"gem": { "type": "boolean" }` · `"gem_line": { "type": "string", "maxLength": 200 }`. `toShortlistFields()` emits exactly these two.
   - Optional, if WP-3d wants the funnel's `later/` code visible there: `later/later-lists.mjs` `LATER_CODES` gains `'not_shown'` so `addItem` accepts it too (the funnel builds the list itself, so this is not required).
2. **Pack README**: paste the block under "README section" below into `helpers/packs/tour-guide/README.md` — a row in the directory table and a section before "## Tests"; and add `_gems` to the Tests paragraph's suite list.
3. **Prefs kit (WP-2f)**: the module reads `rough_edges` values as `cash_only · no_english_menu · queues · no_reservations · standing_room` (`ROUGH_EDGES` in `gems-weights.mjs`) and `gem_appetite` 1–5, `off_track_minutes` as a number of minutes. If WP-2f's `travel.vocab.json` uses other tokens for the five rough edges, the skill maps them, or change `ROUGH_EDGES` in one place.
4. **Maps kit / research kit (parallel Opus builder)**: `fromSearchResult` reads the raw Places (New) fields `id, displayName.text, types, primaryType, rating, userRatingCount, priceLevel, businessStatus, location.latitude/longitude, regularOpeningHours.periods, websiteUri, reviews[].publishTime/rating/authorAttribution.displayName` — the same names Text Search and Nearby Search return at the enterprise tiers, so no adapter is needed. `local_mentions.kind` uses exactly the research kit's planned `--source-kind` values `editorial | community | local-language`, and `language` its `--language` field.
5. **README tree / CHANGELOG** (push-time bookkeeping). New files:
   - `helpers/packs/tour-guide/gems/{index,gems-weights,gems-record,gems-chains,gems-geo,gems-hours,gems-screen,gems-score,gems-flags,gems-line,gems-select,gems-project}.mjs`
   - `helpers/packs/tour-guide/gems/README.md`
   - `helpers/packs/tour-guide/gems/fixtures/{index.mjs,gems-fixture-port-sorrel.json}`
   - `helpers/tests/pack_tour-guide_gems.test.js`
   - `helpers/status/WP-2g-engine.md`, `helpers/decisions/WP-2g-engine.md`
6. **For WP-4d (`trip-research`)**: the call order and signatures are in `gems/README.md` "The funnel, in call order". The skill supplies `today`, `trip_dates`, `day_start`/`day_end`, its own geocoded `anchors`, the profile's `gem_appetite` / `off_track_minutes` / `rough_edges`, `fit_estimates` from its own reading of the stage-4 evidence, `signals` per place, and `decided` for *More options* / *More gems* rounds. Everything the module returns besides `toPlaceFields`, `toShortlistFields` and `gemsNotChosenList` is build-scoped and must not be written to `places/`.

## README section
Paste into the pack README. Table row (after the `brochure-map/` row):

```markdown
| `gems/` | The Gem Funnel's engine (proposal §4 stages 2–5): screening, the gem score and 💎 rule, evidence flags, the "why it's a gem" line, shortlist floors and the "Gems not chosen" Later list — pure functions, no calls | below |
```

Section (before `## Tests`):

```markdown
## Gem Funnel — `gems/`
Library only: pure functions over the candidate pool the `trip-research` skill assembles; no Google call, no fetch, no clock. Every tunable number lives in `gems/gems-weights.mjs`.
```js
import * as gems from './gems/index.mjs';
const { kept, dropped } = gems.screen(pool, { trip_dates, anchors, off_track_minutes, modes, avoid_types, rating_floor });   // stage 2: one reason_code per drop
const scored = gems.scoreGems(kept, { appetite, city_size, fit_estimates, profile, trip_dates, day_start, day_end, anchors, rough_edges }); // stage 3: q o l f p → gem_score, gem
const { flags, record } = gems.flagEvidence(scored[0], { trip_dates, today, signals });   // stage 4: unproven | tourist_oriented | closed_day_conflict
const line = gems.gemLine(record, { category_median_count });                              // ≤ 200 chars, numbers and source kinds only
const { groups, not_shown } = gems.selectShortlist(flagged, { appetite, per_group: { activities: 8, food: 6 }, decided });
const later = gems.gemsNotChosenList({ trip_id, not_shown, today });                      // LaterList "Gems not chosen", code not_shown
const placeFields = gems.toPlaceFields(record);                                           // gem_score, gem, obscurity, local_mentions, flags — no Google field
```
- Pool record: `{ place_id, name, types, primary_type?, category?, rating?, rating_count?, price_level?, business_status, location, hours?, website?, streams, local_mentions: [{ ref, language, kind }], mass_tourism_rank?, reviews? (in-run only), slug?, friction?, signals? }`; `fromSearchResult(rawPlace, { streams })` builds one from a Places (New) search result.
- Screening drops: not operational, avoided type, chain (a name repeated ≥ 3 times or a short generic brand list), rating under the floor (4.3; 4.5 at appetite ≥ 4), fewer than 15 ratings unless two local mentions or an owner seed, closed on every trip date, beyond `off_track_minutes` from every anchor in a straight line at WALK 4.5 / TRANSIT 15 / DRIVE 30 km/h.
- Score: Bayesian quality (m = 30, μ = the category's pool mean or 4.2), bucketed obscurity (40–400 ratings in a large city, 15–150 in a small one; > 2 000 → 0; owner seeds 0.5), local-ness (+0.5 per local-language source, +0.3 editorial, +0.2 community, −0.5 top-ten mass tourism), fit (the skill's estimate, else a cheap one from types and price), practicality (open at a usable time on a trip day, within reach, minus untolerated rough edges). `100 × (0.35 F + 0.25 Q + 0.20 O + 0.15 L + 0.05 P)`; appetite moves up to 0.10 between Q + F and O + L. 💎 when O ≥ 0.6, L ≥ 0.3, Q ≥ 0.6.
- Shortlist: 💎 floor by appetite (1 → none, 2 → 1 + 1, 3 → 2 + 2, 4 → 3 + 2, 5 → 4 + 3), `decided` excluded, `floor_met: false` when the pool had too few gems. Unproven places are never shown as 💎.
- Persisted projections carry only our own numbers and notes; reviews are read in-run for their dates only; distances run to our own anchors, never a polygon test on Google coordinates. Defaults and reasons: `helpers/decisions/WP-2g-engine.md`; full contract: `gems/README.md`.
```

## Fixture — `gems/fixtures/gems-fixture-port-sorrel.json`
Port Sorrel, Fictional Isles (the transit-city fixture's invented harbour; the same lodging anchor at 36.41, −33.80 plus an invented Central Station and Old Quay). Trip Wed 2027-05-12 – Fri 2027-05-14, day 09:00–18:00, TRANSIT + WALK, `today` 2027-04-30. 53 places; `carriers` names each rule's place:

| Carrier | Place | What it exercises |
|---|---|---|
| chain_repeated | Anchor Coffee Co ×3 | the same name three times → `chain / repeated` |
| chain_listed | Burger King Harbour | a `CHAIN_LIST` prefix → `chain / listed` |
| not_operational | Mill Quarter Print Works | CLOSED_TEMPORARILY |
| low_rating | Quayside Grill | 3.9 with 640 ratings |
| too_few_ratings | Tidewater Bakehouse | 9 ratings, no mentions |
| too_few_waived_by_mentions | Three Lanterns Tasca | 12 ratings, two local-language mentions → kept |
| closed_all_dates | Weekend Fish Auction | Sat–Sun only |
| too_far | Cape Lantern Lighthouse Cafe | ~38 km north → 147 min at TRANSIT speed |
| avoided_type | Neon Reef Club | `night_club` |
| mass_tourism | Grand Harbour Aquarium | rank 2, 4 800 ratings → O = 0, L = 0, tourist_oriented |
| unproven | Pebble Street Ramen | 5 reviews within 60 days, 30 ratings, no mention |
| tourist_oriented | Sunset Terrace Seafood | `english_only_menu` + `tourist_pricing` signals |
| owner_seeds | Oak Hollow Pastry (12 ratings), Brannoc Bank Cider House | O = 0.5, count rule waived |
| gem_candidates | Fig Tree Courtyard, Lanternmakers Workshop, Signal Hill Allotment Cafe, Tidewater Boathouse Gallery, Mill Quarter Gin Room | local-language mentions; four are 💎 at every appetite (the Allotment Cafe's Q is under 0.6) |
| by_date_hours | Moonlit Pier Walk | the normalized per-date hours shape, closed on the 14th |
| unknown_hours | (noodle bar) | hours null → kept, P = 0.5 |
| over_two_thousand | Harbour Clock Cafe, Signal Hill Summit Deck, Grand Harbour Aquarium | O = 0 |

Developed by: LightAISolutions
