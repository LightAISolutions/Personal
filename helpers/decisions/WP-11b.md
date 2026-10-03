# WP-11b — decisions and assumptions (research inputs)

Brief: `helpers/prompts/TG-PHASE-11.md`, Contract C11 and section WP-11b. State and checks: `helpers/status/WP-11b.md`.

## Process
1. **Ownership.** Only WP-11b paths are edited: `gems/*`, the new `facts/*` and `season/*`, the trip and place schema JSON, `checkTrip` / `checkPlace` (and helpers next to them) in `schemas/tour-guide-checks.mjs`, the gems tests and new test files. Everything else is a REQUEST in the status file.
2. **Invented data only.** No network call, no package install; every bloom month and default below comes from general knowledge with a public source named, and estimates are marked as such.
3. **JSON fixtures carry no branding line.** The new `facts/fixtures/*.json` and `season/fixtures/*.json` follow the existing JSON fixtures (`gems/fixtures`, `fixtures/`), which have none; JSON has no comment syntax. Every new `.mjs`, `.js` and `.md` file ends with the branding line.

## Schemas (C11 bounds)
4. **Every new field is optional** on the trip and the place, so every old record validates unchanged (tested over every fixture trip and place).
5. **`bloom[].note` is required.** C11 writes `note` without a `?` while `from`, `to`, `status` and `url` carry one; read literally.
6. **`weather.high_c` / `low_c` are bounded −60 … 60 °C.** C11 gives no bound; these sit beyond any recorded city climate and refuse typos such as 140.
7. **`$defs` added to the place schema** (`date`, `time`, `https_url`, `source`) — it had none; the subset validator resolves `#/$defs/…` only.
8. **No `uniqueItems` in the subset validator**, so uniqueness lives in the checks: override dates, event ids, `closed_weekdays`.
9. **Flags: no duplicate-flag check.** I added one briefly and removed it: `toPlaceFields` can emit a repeated flag on older records and they must keep validating. `maxItems: 5` stays.

## checkTrip / checkPlace
10. **The 2-hour rule uses the day's real hours.** Start = `start.time` if an anchor is given, else the override's `day_start`, else the trip's; end likewise. Under `MIN_OVERRIDE_DAY_MINUTES` (120) fails at `/day_overrides/i/day_end`, or at `/day_overrides/i/end/time` when the end is an anchor. Exactly 120 minutes passes.
11. **Override dates must be real, unique and inside `start_date … end_date`.** Season checks: real dates, `from ≤ to` for blooms and events, unique event ids, an event's `lat` and `lng` together.
12. **Facts checks:** real dates (`checked`, sources' `accessed`, `menu.checked`), `visit_minutes.min ≤ max`, weekdays once each. `checkSeason` and `checkFacts` are exported so the normalisers reuse them.

## facts/
13. **Stale after 90 days (facts) and 30 days (a menu check).** Opening hours and prices change seasonally (about a quarter); menus change more often and a diet depends on them. Day 90 and day 30 still count as fresh. An unknown check date is stale.
14. **Conflict tolerance 15 minutes** between the place's own closing time and Google's: smaller gaps are rounding or "last order" wording, not a disagreement. Unknown Google hours never conflict; an own-site closed weekday that Google shows open conflicts, and so does a Google closed day the own list says is open — only when the place has its own list.
15. **Lines.** Clause order in `facts_line`: last entry (with its note), closes, about X–Y min, closed <Days>s, enter at <gate>, then the source label `official site` (`official site, checked Mon YYYY` once stale). Whole clauses drop from the end to fit 160; the source label is the last clause, so on a very long line it is the first to go (the page keeps its link). The menu fit joins `price_line` only when a diet is given; `menuLine` is a separate helper for the menu check text.
16. **Normaliser clean-up:** trim strings, drop `null`/`undefined`, sort `closed_weekdays` and keep each once, lower-case enum words (`menu.fits`; for the season sheet bloom `kind`/`status` and event `kind`). Unknown keys are still refused — the normaliser never silently drops data the caller wrote.

## season/
17. **Usual bloom months, northern temperate (estimates, whole months, deliberately wide):**
    - plum Jan–Mar; cherry Mar–May; wisteria Apr–May; iris May–Jun; hydrangea Jun–Aug; lotus Jun–Aug — sources: Japan Meteorological Agency phenological observations and the Japan National Tourism Organization's seasonal flower calendars (cherry front from late March in the south to May in the north; plum from late January; hydrangea in the June–July rainy season).
    - roses May–Oct — the spring flush in late May–June and the repeat/autumn flush into October; source: Royal Horticultural Society rose guidance and national rose societies' garden calendars.
    - lavender Jun–Aug — source: Provence tourist boards' lavender season (mid-June to mid-August) and Furano (Hokkaido) tourism, July.
    - Autumn leaves and `other` have no usual months: they are never used to drop (leaves are not a "single-bloom garden" in names, and the forecast covers them).
18. **Southern hemisphere: the same months shifted by six.** **Tropics (|lat| < 23.5°): unknown, never dropped** — seasons there follow rain, not temperature, and a table would mislead.
19. **`bloomKindOf`:** only a garden or park (by category or Google types `garden`, `botanical_garden`, `park`, `national_park`), and the name plus tags must name **exactly one** bloom (whole-word Latin words plus Japanese terms). Two blooms ("Plum and Cherry Garden") means not mainly one, so it stays. Known risk: a park merely named after a flower ("Cherry Hill Park") can drop in the wrong months; parks are included anyway because many flower parks are typed `park`, and an owner seed always stays.
20. **The forecast wins and is symmetric:** when the season sheet speaks for that bloom, its window or status decides — peak keeps the rose garden in November, and `past` drops it even in the usual months. A forecast for another bloom says nothing. One trip date in season is enough to keep a place.
21. **Latitude fallback:** the place's `location.lat`, else `place.lat`, else the `lat` option; in the screen `lat` defaults to the first anchor's latitude. No latitude → nothing known → kept.
22. **Event order:** timed events by start, untimed after them, then by name, then id.

## The gem screen
23. **`out_of_season` sits after `closed_all_dates` and before `too_far`,** applies to activities only, never to owner seeds; detail = the bloom kind. On by default because it only fires on a clear single-bloom garden in clearly wrong months; every unknown keeps the place.
24. **Local favourite = ≥ 2 distinct publishers** among the local mentions (distinct refs when no publisher is given, matching the existing `mentionCount`). The brief's "about" values: floor **3.8** (`min(rating_floor, 3.8)` — a lower owner floor still wins), plus the country offset as for everyone; off-track limit **×1.5**. It reuses the mention's existing optional `publisher` (now also documented in the gems README's record shape).
25. **Crowd magnet = `mass_tourism_rank` ≤ 10, or a count in the top decile of the pool (index `ceil(n × 0.1) − 1` of the sorted counts) and ≥ 2 000.** 2 000 is the same number as `OBSCURITY_ZERO_ABOVE`, the count above which a place has no obscurity at all. The pool is every place that passed the drop rules, food included, so the decile is the trip's own busiest. The label says "Busy at peak hours" — a practical warning, not a judgement.
26. **Flags never drop a place.** Kept records carry `flags` only when one applies, so unflagged records are byte-identical to before (the redteam test's `['gem', 'gem_line']` shortlist keys hold). An input record's `flags` is dropped at normalisation; the screen decides afresh.
27. **`flagEvidence` appends the screen flags after its three, once each** (idempotent). The gem line says "a local favourite named by …" and adds "busy at peak hours"; still no digit (R3). `toShortlistFields` adds `local_favourite: true` only when flagged.

Developed by: LightAISolutions
