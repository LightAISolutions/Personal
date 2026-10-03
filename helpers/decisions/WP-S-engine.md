# WP-S engine — decisions and assumptions

Brief: the Scout engine per `helpers/decisions/TG-SCOUT.md` (§3 payload, §4 ranking, §5 Place fields, §7 board). Library only, no network.

1. **Screen order** — `duplicate` is checked first (a second copy of a place never reaches the other screens), then closed, closed_on_trip, low_rating, unproven, off_topic, diet, diet_unproven, too_far.
2. **μ for the Bayesian quality** — the mean rating over every unique rated record in the pool, screened or not; 4.2 when no record is rated. The contract says "pool mean" without saying which pool.
3. **"Name contains the query"** — every query token of 2+ characters appears in the name (case- and accent-insensitive).
4. **Usual types** — drink/sweet words map to the cafe family; other food words to restaurant/bar/market; activities use a word-to-types map; a type containing a query token also counts.
5. **Google vegetarian fallback** — `servesVegetarianFood` counts as evidence only when the diet matches /vegetarian/. Other diets (vegan, gluten-free) have no Google fallback and rely on the skill's judgment (contract gap).
6. **Veg labels** (`veg_verified`, `veg_likely`) apply to the food group only.
7. A missing rating count is 0; an unspecified business status is not "closed".
8. **Estimated reach** — with no measured route: walk when the straight-line walk is 30 min or less, else transit; marked `estimated: true`.
9. **Automatic labels** — `gem`, `far` and `chain` are computed; the rest come only from the skill's judgments and are filtered to the schema enum. `gem` is undefined in the contract; chosen rule: 2+ local mentions, quality ≥ 0.6, at most 400 ratings.
10. **parts** — `rankScout` returns all five parts (0–1, including local); the payload keeps topic/quality/fit/reach (0–100) because §3's `parts` has no L (contract gap).
11. `limit` is clamped to 1–20 (default 10); `left_out` keeps pool order and the payload caps it at 20.
12. `owner_tz` is accepted by the board but unused (dates arrive as calendar strings).
13. **App board caps** — photos are dropped above 360 px wide or 40 000 characters; a map above 240 000 characters falls back to the route sketch; images limited to png/jpeg/webp/gif data URIs (SVG refused); links https only.
14. **scoutPlaceFields** — an existing Place keeps every field it has; only absent fields are filled; `gem: true` only when the item carries the `gem` label; the history entry is added once.
15. **Payload refusals** are tested in the scout test file, not the shared payloads test.
16. **Photos** — `fromScoutResult` keeps `photo: { name, attributions: [{ name, uri? }] }` from the first photo, in-run only (credit URIs forced to https); the payload guard refuses `photo`. Text Search does not return photos until the maps mask gains `places.photos` (request in `status/WP-S-engine.md`).

Developed by: LightAISolutions
