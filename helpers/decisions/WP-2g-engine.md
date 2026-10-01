# WP-2g-engine — decisions and defaults

The proposal (`helpers/decisions/hidden-gems-proposal.md` §4, §7) fixes the shape of the funnel; these are the choices it left open, each made without asking per the WP rules and numbered so WP-3d, WP-4d, the kit builders and Phase 8 can cite them. Every number below is a named constant in `gems/gems-weights.mjs`.

1. **One module, one concern per file, no I/O.** `gems/` exports pure functions; `today`, trip dates, anchors and the profile arrive as arguments. Nothing reads the clock, a file or the network.
   - Why: the skill owns every call and every budget (proposal §4 stage 1); a scorer that fetched would blur the ledger. Determinism also makes the tests exact.

2. **The pool record carries `category` and derives it from the Google types when the skill does not set it** (`CATEGORY_TYPES`, first match on `primary_type` then `types`, else `other`).
   - Why: Q's μ, O's percentile and the gem line's "peers" are per category, and the Place schema already speaks in pack categories (museum, market, restaurant…). The table is a starting map; the skill may set `category` itself.

3. **Unknowns never count as the bad case.** `BUSINESS_STATUS_UNSPECIFIED` passes screening (only CLOSED_TEMPORARILY / CLOSED_PERMANENTLY drop); null hours are not "closed" and give P = 0.5; a record without a location passes the distance test.
   - Why: stream 2 places are resolved with an IDs-only search and may lack some fields until stage 4; dropping them for missing data would silence the local voices the funnel exists to hear.

4. **Screening order and one reason per drop:** not_operational · avoided_type · chain · low_rating · too_few_ratings · closed_all_dates · too_far. `dropped[]` entries carry a `detail` for chain (`repeated` / `listed`), not_operational (the status), avoided_type (the type) and too_far (the minutes).
   - Why: cheap, definitive tests first; one code keeps the dropped list readable and the tests exact. The detail lets a *More gems* round or a debug log say why without re-running.

5. **Chain list: twelve generic global brands, prefix-matched on a normalized name** (lower-case, diacritics and punctuation stripped), in `gems-chains.mjs`. Repeat threshold 3 (`CHAIN_REPEAT_MIN`).
   - Why: the brief allowed real brands but asked for a short, obviously generic list in its own file. Prefix matching catches "Brand Harbour" without matching "Brandywine".

6. **Owner seeds are exempt from the rating-count rule, not from the rating floor or the hours/distance rules.**
   - Why: proposal §4 stream 4 says seeds "skip the obscurity test but not the quality or practicality tests"; a seed with 12 ratings is exactly the kind of place the owner vouches for, while a seed rated 3.8 still fails quality.

7. **Straight-line minutes use the fastest of the trip's modes at WALK 4.5 / TRANSIT 15 / DRIVE 30 km/h, no detour factor.**
   - Why: the proposal names conservative speeds precisely so a straight line is a fair estimate; adding a 1.3 factor on top would double-count. The planner measures real legs later.

8. **Q: μ is the kept pool's mean rating for the category when ≥ 20 rated members, else 4.2; m = 30; mapping 4.0 → 0 … 4.9 → 1, clamped.** No rating → Q = 0.
   - Why: verbatim from §4 stage 3. The pool for μ is the kept set passed to `scoreGems` (post-screening), so a low-rated tail does not drag the prior down.

9. **O = factor × (0.6 + 0.4 × (1 − percentile))** with factor 1 inside the band, 0.85 under it, a straight line from 1 at the band top to 0 at 2 000, 0 above. Percentile = share of the *other* same-category members with a smaller count (ties half; 0.5 when alone).
   - Why: §4 asks for both "1 − percentile rank" and "bucketed so 40–400 score highest … > 2 000 → 0"; multiplying the percentile term into a 0.6–1.0 range by a band factor satisfies both and guarantees every in-band place can clear the 💎 threshold of 0.6 — the band *is* the gem zone, the percentile orders within it. Under the band the evidence is thin, so 0.85.

10. **City size: `city_size` if given; else Σ `aggregate_counts` ≥ 300 → large; else kept pool ≥ 150 → large; else `large`.**
    - Why: §4 says the Aggregate counts calibrate city size, and they exist only once decision 19 enables the API. Pool size is the next-best proxy (a bigger city yields more survivors). The default is `large` because its band is the stricter one — when we do not know, we do not hand out obscurity points cheaply.

11. **L counts distinct ledger refs per kind:** +0.5 per local-language ref (cap 1.0), +0.3 per editorial ref, +0.2 per community ref, −0.5 when `mass_tourism_rank` ≤ 10, clamped 0–1.
    - Why: §4's "independent source" is operationalized as a distinct research-ledger ref (`L003`, `L007.2`): two results of one search are two pages, the same ref twice is one. Editorial and community points are per ref too (the clamp bounds them), so three local lists outrank one.

12. **F: the skill's `fit_estimates[place_id]` wins; otherwise `estimateFit`** — 0.5 ± 0.2 for interest high/low in the category, +0.1 per liked type (cap 0.2), −0.3 for an avoided type, price within `price_max` +0.1 else −0.15 per level over, owner seed +0.1.
    - Why: §4 says F before stage 4 is "a cheap estimate from types, price and source text"; the module has no source text (only refs), so types and price carry it, and the model's judgment replaces it per place when the skill has read the evidence. `price_max` is 1–4 (inexpensive … very expensive) so `PRICE_LEVEL_FREE` always fits.

13. **P: 1 when some opening window overlaps the day window (`day_start`–`day_end`) by ≥ 30 minutes on ≥ 1 trip date; 0.5 when hours are unknown; 0 when never; 0 when beyond `off_track_minutes`; −0.25 per `friction` edge not in `rough_edges`** (default tolerates `cash_only`, `no_english_menu`).
    - Why: §4 stage 3 and stage 0's default. A place that opens at 18:00 on a 09:00–18:00 day scores 0 here on purpose — the planner's dinner logic, not the funnel, handles evenings; P weighs only 0.05 so it tunes rather than decides.

14. **Weights by appetite are linear:** shift = (appetite − 3) / 2 × 0.10, half taken from each of Q and F and given to each of O and L.
    - Why: §4 gives the end points (appetite 5: +0.10 to O + L; appetite 1: the reverse); linear interpolation makes appetite 2 and 4 meaningful and keeps the sum at 1.

15. **The 💎 rule does not move with appetite** — appetite changes weights, the rating floor and the shortlist floor, never the O/L/Q thresholds.
    - Why: a gem should mean the same thing at every appetite; appetite expresses how many gems to show and how much to favour them, which the floors and weights already do.

16. **`unproven` requires ≥ 1 review** (all within 60 days of `today`, < 50 ratings, no local mention) and clears `gem`. Note the rule is belt-and-braces: with no local mention L = 0 so the 💎 rule already fails; it stays because Phase 8 may lower the L threshold.
    - Why: with zero reviews the "all reviews are fresh" test is vacuous; §4 stage 4 is about a burst of fresh reviews.

17. **`tourist_oriented` fires on `english_only_menu ∧ tourist_pricing`, or `visitor_wording`, or `mass_tourism_listing`, or any `mass_tourism_rank`.** An English-only menu alone does not fire.
    - Why: §4's three signals, with the menu and pricing read as one conjunctive signal as written ("English-only menu with tourist pricing"). The booleans are the skill's reading of the evidence; the module never sees the text.

18. **`closed_day_conflict`: closed on `visit_date` when the caller knows the day, else closed on at least one trip date.**
    - Why: before the planner assigns days, "closed Thursday" on a Wed–Fri trip is exactly the heads-up the shortlist should carry; once a day is known only that day matters. Places closed on every date were already screened out.

19. **Gem line clause order and trimming:** rating/count vs peers → named-by (local-language, editorial, community) → owner seed → mass-tourism → friction words → flag words; whole clauses are dropped from the end until ≤ 200, a hard cut only when the first clause alone is too long. "Peers" is whatever count the caller passes (the category median from `categoryMedianCounts` is recommended), worded "where peers typically have N".
    - Why: the most informative clause (the numbers) survives any trim; the wording avoids claiming a mean when a median is passed. Nothing in the line can come from review or page text because the module never receives any.

20. **Shortlist fill: the gem floor first (top gems by score), then the top of the rest; items re-ordered by score; `floor_met` reports an unmet floor.** Tie order: score desc, gems first, then `place_id`.
    - Why: §4 stage 5 and decision 15. Re-ordering by score keeps the list honest (a floor gem may sit 6th); the tie-break makes selection a total order so the tests are exact.

21. **`decided` matches a record's `place_id`, its `slug`, or `slugFor(record)` (a deterministic slug from the name), exactly and case-sensitively.** Matches go to `excluded`, never to `not_shown`.
    - Why: *More options* rounds are told what was shown as slugs (shortlist items) while owner seeds and fresh stream results have only place ids; accepting both keeps the skill simple. Case-sensitive because slugs and place ids are case-exact identifiers.

22. **"Gems not chosen" is a LaterList with `code: 'not_shown'`**, highest score first, at most 200 items (the schema cap), unique slugs (`-2`, `-3` on a collision), reason "Ranked Nth of M in <group> (score S); the round showed K." The module builds the list itself rather than through `later/addItem` so it does not depend on `LATER_CODES` growing.
    - Why: WP-3d owns the enum; this WP owns the string. `/later promote` then works on these items like any other.

23. **Projections are exact and guarded.** `toPlaceFields` emits only `gem_score, gem, obscurity, local_mentions, flags` with the WP-3d caps; `toShortlistFields` only `gem, gem_line`; both pass `assertNoGoogleFields`, whose `GOOGLE_FIELDS` list names every Google key in both our snake_case and the API's camelCase.
    - Why: the Maps terms (§2 fact 7) and the plan's "no Google field in `places/`" check; a shallow key guard is cheap and makes the rule testable.

24. **Fixture in the transit-city world.** The gem pool reuses the invented Port Sorrel (same lodging anchor) with 39 new invented places plus the carriers, in `gems/fixtures/` — the pack's `fixtures/` directory is not touched. Ledger refs are `L003`-style, languages `pt` / `en`, no author names on reviews, URLs on `example.com`.
    - Why: coherence with the planner fixtures without editing a file another WP owns; the boundary check forbids `places/` directories and personal names, so the fixture dir is `gems/fixtures/` and reviews carry dates and stars only.

Developed by: LightAISolutions
