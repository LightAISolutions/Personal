# Gem Funnel — `helpers/packs/tour-guide/gems/`

The engine half of the Gem Funnel (`helpers/decisions/hidden-gems-proposal.md` §4, stages 2–5; plan WP-2g). It turns the
candidate pool the `trip-research` skill assembles from its streams into screened, scored, flagged and selected places,
with a one-sentence "why it's a gem" line and the "Gems not chosen" Later list. **Library only**: every export is a pure
function over data already in hand — no Google call, no web fetch, no file, no clock (`today` is an argument), no state.
Stage 0 (the interview questions) belongs to the prefs kit; stage 1 (the streams) to the Maps and research kits and the
skill. Defaults and their reasons: `helpers/decisions/WP-2g-engine.md`; every tunable number: `gems-weights.mjs`.

| File | Concern |
|---|---|
| `index.mjs` | Re-exports everything below |
| `gems-weights.mjs` | Every constant: appetite defaults, screening floors, speeds, m and μ, obscurity bands, the point table, weights, the 💎 rule, flag windows, shortlist floors; `weightsFor`, `gemFloorFor`, `ratingFloorFor` |
| `gems-record.mjs` | The pool record shape, `normalizeRecord` / `normalizePool`, `fromSearchResult` (raw Places (New) result → record), `categoryOf`, `groupOf`, `slugFor` |
| `gems-chains.mjs` | Chain detection: a repeated display name or the short generic `CHAIN_LIST` |
| `gems-geo.mjs` | Straight-line distance to our own anchors at conservative speeds |
| `gems-hours.mjs` | Opening hours against trip dates (Google periods, snapshot hours or a per-date map) |
| `gems-screen.mjs` | Stage 2 `screen` |
| `gems-score.mjs` | Stage 3 `scoreGems` and its components Q · O · L · F · P |
| `gems-flags.mjs` | Stage 4 `flagEvidence` |
| `gems-line.mjs` | Stage 5 `gemLine` |
| `gems-select.mjs` | Stage 5 `selectShortlist`, `gemsNotChosenList` |
| `gems-project.mjs` | The persisted projections `toPlaceFields`, `toShortlistFields`, and the `assertNoGoogleFields` guard |
| `fixtures/` | `loadGemFixture('port-sorrel')`: an invented pool of 53 places with gem evidence, used by the tests |

## The funnel, in call order

```js
import * as gems from './gems/index.mjs';

const { kept, dropped } = gems.screen(pool, { trip_dates, anchors, off_track_minutes: 25, modes: ['TRANSIT', 'WALK'], avoid_types, rating_floor: 4.3 });
const scored = gems.scoreGems(kept, { appetite: 3, city_size, aggregate_counts, fit_estimates, profile, trip_dates, day_start, day_end, anchors, rough_edges });
const ctx = gems.scoringContext(kept, { appetite: 3, city_size });              // weights, μ and median counts by category
const flagged = scored.map((r) => gems.flagEvidence(r, { trip_dates, today, signals: signalsFor(r) }).record);   // after stage 4's evidence pass
const line = gems.gemLine(flagged[0], { category_median_count: ctx.median_count_by_category[flagged[0].category] });
const { groups, not_shown } = gems.selectShortlist(flagged, { appetite: 3, per_group: { activities: 8, food: 6 }, decided });
const later = gems.gemsNotChosenList({ trip_id, not_shown, today });
const placeFields = gems.toPlaceFields(flagged[0]);                             // → Place.gem_score, gem, obscurity, local_mentions, flags
const itemFields = gems.toShortlistFields(flagged[0], { category_median_count }); // → Shortlist item gem, gem_line
```

### The pool record (stage 1's output, this module's input)
One record per place id, assembled by the skill from the stream results (Text Search / Nearby Search enterprise fields,
the research ledger's resolved mentions, owner seeds). `normalizeRecord` validates it and `fromSearchResult` builds one
from a raw search result. Unknown keys are dropped; nonsense throws a `gems: …` error.

```
{ place_id,                       Google place id (the only Google value that persists)
  name, types[], primary_type?,   display name and Google types (in-run only)
  category?,                      a pack category slug; derived from the types when absent (CATEGORY_TYPES)
  rating?, rating_count?,         search-tier numbers (in-run only)
  price_level?,                   PRICE_LEVEL_* (in-run only)
  business_status,                OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY | BUSINESS_STATUS_UNSPECIFIED (default)
  location: { lat, lng } | null,  for the straight-line test against OUR anchors only
  hours?,                         Google regularOpeningHours { periods }, the snapshot's { periods, weekday_descriptions },
                                  or a normalized { by_date: { 'YYYY-MM-DD': [{ open: 'HH:MM', close: 'HH:MM' }] } }; null = unknown
  website?,                       http(s) URL (in-run only)
  streams: ['taste' | 'local' | 'quiet' | 'owner_seed'],
  local_mentions: [{ ref, language, kind }],   ref = research-ledger ref (L003, L007.2; ≤ 120 chars), language a BCP-47-like
                                  tag (^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$), kind editorial | community | local-language
  mass_tourism_rank?,             the place's rank on a mass-tourism list the research found (≤ 10 earns the penalty)
  reviews?: [{ publish_time, rating, author? }],   in-run only, never persisted; review TEXT is dropped at normalization
  slug?,                          our place key when the place is already known
  friction?: subset of ROUGH_EDGES (cash-only, no-english-menu, queues, no-reservations, standing-room),
  signals?: { english_only_menu?, tourist_pricing?, visitor_wording?, mass_tourism_listing? }   booleans the skill sets }
```

### Stage 2 — `screen(pool, opts) → { kept, dropped: [{ place_id, reason_code, detail? }] }`
One reason per dropped place, the first that fires: `not_operational` (CLOSED_TEMPORARILY / CLOSED_PERMANENTLY; UNSPECIFIED
passes) · `avoided_type` (a type, primary type or category in `avoid_types`) · `not_a_visit` (activities only: the
primary type, else a type, is in `NOT_A_VISIT_TYPES` — lodging, spa, tour or travel agency, transit station, parking …;
detail = that type) · `facility` (activities only: the name matches `FACILITY_NAME_RE` — smoking area, restroom, ticket
office, coin lockers …) · `chain` (detail `repeated`: the same normalized display name ≥ 3 times in the pool; `listed`: a
`CHAIN_LIST` prefix) · `low_rating` (below `rating_floor`, default 4.3, or `ratingFloorFor(appetite)` = 4.5 at appetite
≥ 4; plus the country's `rating_offset`, within ±0.5; ≥ 2 local mentions cap the floor at the default 4.3 before the
offset) · `too_few_ratings` (< 15 unless ≥ 2 local mentions or an owner seed) · `closed_all_dates` (hours known and closed
on every trip date) · `too_far` (straight-line minutes to the nearest anchor at the fastest of `modes` — WALK 4.5,
TRANSIT 15, DRIVE 30 km/h — above `off_track_minutes`, default 25) · then over what is left, `part_of` (activities only;
detail = the parent's name): a kept place within `PART_OF_RADIUS_M` (400 m) with ≥ `PART_OF_COUNT_RATIO` (5×) the
ratings is its parent when this name is the parent's core name plus only `FEATURE_WORDS` (gate, torii, garden, pavilion,
hall, directions, ordinals …), or this name is nothing but feature words. A sub-temple with a name of its own
("Pine-ji Ohbai-in") stays. Owner seeds skip `not_a_visit`, `facility` and `part_of`. `nameWords`, `nameCore`,
`isFeatureName` and `partOfParent(record, pool)` are exported for the skill. `kept` holds normalized records with
`category` set.

### Stage 3 — `scoreGems(kept, opts) → [{ …record, q, o, l, f, p, gem_score, gem }]`
- **Q** `qualityScore`: `(n·r + m·μ) / (n + m)`, m = 30, μ = the kept pool's mean rating for the category when it has ≥ 20
  rated members, else 4.2; mapped 4.0 → 0 … 4.9 → 1. No rating → 0.
- **O** `obscurityScore`: `factor × (0.6 + 0.4 × (1 − percentile))`, the percentile of `rating_count` among the other kept
  places of the category (ties half, 0.5 when alone). `factor` is 1 inside the city band (large 40–400, small 15–150),
  0.85 below it, a straight line from 1 at the band's top to 0 at 2 000, and 0 above 2 000. Every in-band place clears the
  💎 threshold of 0.6. Owner seeds: O = 0.5. City size: `city_size` if given, else Σ `aggregate_counts` ≥ 300 → large, else
  kept pool ≥ 150 → large, else `large` by default.
- **L** `localnessScore`: +0.5 per distinct local-language ref (cap 1.0), +0.3 per editorial ref, +0.2 per community ref,
  −0.5 when `mass_tourism_rank` ≤ 10; clamped 0–1. Distinct = distinct ledger refs.
- **F**: `fit_estimates[place_id]` (the skill's model, 0–1) when present, else `estimateFit(record, profile)`: 0.5, ±0.2 for a
  high / low interest in the category, +0.1 per liked type (cap 0.2), −0.3 for an avoided type, +0.1 when the price level is
  within `price_max` else −0.15 per level over, +0.1 for an owner seed; clamped.
- **P** `practicalityScore`: 1 when some window on a trip date overlaps the day window by ≥ 30 minutes (0.5 when hours are
  unknown, 0 when never) and within `off_track_minutes` of an anchor; −0.25 per `friction` edge not in `rough_edges`
  (default tolerates cash-only and no-english-menu); clamped.
- `gem_score = 100 × (F·wF + Q·wQ + O·wO + L·wL + P·wP)`, weights 0.35 / 0.25 / 0.20 / 0.15 / 0.05 at appetite 3;
  `weightsFor(appetite)` moves up to 0.10 from Q and F to O and L at appetite 5 and the reverse at 1 (0.05 per component,
  linear in between). `gem = O ≥ 0.6 ∧ L ≥ 0.3 ∧ Q ≥ 0.6`. One decimal. Deterministic; input order kept; inputs not mutated.

### Stage 4 — `flagEvidence(record, { trip_dates, today, visit_date?, signals? }) → { flags, record }`
- `unproven`: the record carries ≥ 1 review and every review was published within the last 60 days of `today`, fewer than 50
  ratings, and no local mention → the returned record also has `gem: false`.
- `tourist_oriented`: `english_only_menu ∧ tourist_pricing`, or `visitor_wording`, or `mass_tourism_listing`, or a
  `mass_tourism_rank` (signals from `record.signals` merged with `opts.signals`).
- `closed_day_conflict`: closed on `visit_date` when given, else on at least one trip date (unknown hours never conflict).
`FLAG_LABELS` gives display words. Reviews are read for their publish times only.

### Stage 5 — `gemLine`, `selectShortlist`, `gemsNotChosenList`
- `gemLine(record, { category_median_count?, max = 200 })` → one sentence from clauses in this order: a words-only rating
  clause built from our own bands (`exceptionally well rated by far fewer reviewers than its peers` — `ratingBand` ×
  `peerComparison`, never a Google digit: no rating value, no rating count, no peer-median number; Maps Platform ToS
  §3.2.3(b), Service Specific Terms §3 and §14.3 — R3, Phase 6 terms review) · `named by two local-language guides, one
  local editorial list and a community thread` · `one of your own seeds` · `on a mass-tourism top-ten list` · the friction
  words (`cash only`, `no English menu`, …) · the flag words. Clauses are dropped from the end until the line fits; only
  when the first clause alone is too long is it cut with `…`. Built from our own words and source kinds and counts only —
  this module never sees review or page text.
- `selectShortlist(scored, { appetite, per_group = { activities: 8, food: 6 }, decided = [], group_of = groupOf })` →
  `{ groups: [{ id, items: [{ …record, rank }], gems_wanted, gems_shown, floor_met }], not_shown: [{ place_id, slug, group,
  gem_score, gem, reason }], excluded }`. Per group the 💎 floor (`gemFloorFor`: 1 → 0+0, 2 → 1+1, 3 → 2+2, 4 → 3+2, 5 → 4+3)
  is filled first from the gems by score, the rest by score; items are then ordered by score (`byScore`: score desc, gems
  first on a tie, place id). `floor_met: false` when the pool had fewer gems than wanted — nothing is invented. `decided`
  matches a record's `place_id`, `slug` or derived slug exactly (case-sensitive); matches go to `excluded`, never to
  `not_shown`. `group_of` defaults to food for restaurant / cafe / bar / market, activities otherwise.
- `gemsNotChosenList({ trip_id, not_shown, today })` → a LaterList `{ v: 1, trip_id, name: 'Gems not chosen', description,
  items: [{ place, place_id, reason, code: 'not_shown', added_on }] }`, highest score first, ≤ 200 items, unique slugs.
  `not_shown` is the LaterList code WP-3d adds to the schema's enum.

### Projections — `toPlaceFields(record)`, `toShortlistFields(record, opts)`
`toPlaceFields` → `{ gem_score (0–100), gem (boolean), obscurity (0–1), local_mentions (≤ 20 of { ref ≤ 120, language, kind }),
flags (≤ 5) }` — the optional Place fields WP-3d adds. `toShortlistFields` → `{ gem, gem_line (≤ 200) }` for a shortlist item.
Both pass `assertNoGoogleFields`: no rating, count, hours, address, website, business status, coordinates, name, types or
reviews ever leave this module in a persisted shape.

## Compliance invariants (Maps terms §3.2.3, proposal §4 "Compliance, built in")
- **Persist only ours.** Outputs meant for storage (`toPlaceFields`, `toShortlistFields`, `gemsNotChosenList`) carry place
  ids, our scores, our notes and ledger refs. Search-tier fields on the records are build-scoped and purged by the Maps kit.
- **Reviews and summaries are in-run only.** Records accept review publish times and ratings for the unproven test; review
  text is dropped at normalization and no output string is built from it.
- **No polygon tests on Google coordinates.** The only geometry is a straight-line distance from a place to OUR OWN
  geocoded anchors; area questions belong to the Places Aggregate API in the skill.
- **Nothing trains a model.** The scoring is arithmetic over fields; the one judgment input (`fit_estimates`) is the
  skill's model reading content at inference time, and this module stores none of what it read.
- **Our ranking of our pool.** `gem_score` orders Tour Guide's own candidate set; it is never presented as a Google result.

## Tests
`helpers/tests/pack_tour-guide_gems.test.js` (11 tests) on `fixtures/gems-fixture-port-sorrel.json`: every screening rule
drops its carrier with the right reason and the waivers pass; scoring is deterministic and in range and each component
follows the formula above; the weight shift at appetite 1 / 3 / 5 moves rankings but not the 💎 set; the large- and
small-city bands; `unproven` clears a gem; gem lines contain no review text and fit 200 characters; floors, `decided` and
unmet floors in selection; the Later list's shape (schema validation once WP-3d lands `not_shown`); projection field names
with no Google field. No test touches the network.

Developed by: LightAISolutions
