# WP-11e decisions — Journey: outlines, day versions, the chosen mix

Every default this work package picked, with its reason. Code: `helpers/packs/tour-guide/journey/` and the planner's
`outline` input (`planner/planner-outline.mjs`, hooks in `planner-assign.mjs`, `planner-day.mjs`, `planner-dinner.mjs`,
`planner-solve.mjs`, `planner/index.mjs`). Tests: `helpers/tests/pack_tour-guide_journey.test.js`; the whole journey
through the core and the brochure on invented data: `helpers/tests/pack_tour-guide_phase11_wave2_e2e.test.js`. Rows
marked "(coordinator, wave-2 merge)" were changed after the work package, when the merge's probe and end-to-end test
found the fault they name.

## 1. The planner's `outline` input

| Default | Value | Why |
|---|---|---|
| Area radius when `radius_km` is absent | `AREA_KM` WALK 2 · TRANSIT 6 · DRIVE 30 km (straight line from the centre) | About one walking district, one short train ride, one drive; below the planner's own `FAR_KM` (12 · 30 · 120) so an area always tightens the day. |
| `radius_km` bounds | 0.2–100 km | Smaller cannot hold two places; larger than any day by car. |
| Stops on a `light` or `rain_spare` day | at most `OUTLINE.LIGHT_STOPS` = 3 | "Light" must be visibly lighter than a full day (TRANSIT full days hold up to 7–9). |
| `free` day | no stops; the free line reads "a free day: nothing planned"; breakfast, lunch slot and dinner stay | The owner still eats; the dinner pool still serves the evening. |
| `travel` day | plans as today (the override's start, end and bag step stand); an area, when given, only narrows the stops | The moving day's fixed facts must never move. |
| `rain_spare` day | only covered places (`isIndoor` true or `isCoveredSight`); it first takes covered places that have no booking, anchor or hint, best rank first, up to its cap (twice the cap in the journey's pools); without an area only places within `AREA_KM[mode]` of its lodging | Otherwise a full day nearby takes the indoor places first and the spare day is empty, or a far museum becomes the rain fallback. |
| Anchors | pinned to their date like a booking (priority 1, rank 0), exempt from the area and the far screen; the day solver keeps them whenever they fit at all (`MUST_WEIGHT` 10 000 > 12 × 100) | "Anchors are scheduled on their date": without the weight two far priority-1 places outvalued a booked anchor. |
| An anchor that is a dinner place (in `input.dinners`) | that evening's preferred dinner, never offered on another evening | A booked dinner is a dinner, not a stop. |
| Dinner reach on an outlined day | a place inside the day's own area, or the outline's dinner place for that evening, may be up to `DINNER.HOME_KM` 5 km from the lodging (a short ride back out, its two legs fetched as usual); every other place keeps `DINNER.RADIUS_KM` 1.5 km from the last stop or the lodging; a day without an outline is unchanged | The outline gives each dinner place one evening, but a thin day of picks that ended back at the lodging early lost its picked restaurant to "no evening had room" although the evening was free (coordinator, wave-2 merge). |
| An anchor that is no candidate and no dinner | an info warning on that day ("… was meant for this day but is not on your list of places to plan"), never an error | The owner may have removed it since the outline. |
| Later codes for outline reasons | `outside_area` → `too_far`, `outline_kind` → `day_full`, with their own reason text ("lies outside the areas your outline gives the days near it", "does not suit the kind of day your outline gives the days near it") | The Later code enum is WP-11f/C11's; the reason carries the real cause instead of a misleading distance. |
| No outline / `outline: null` / `{ by_date: {} }` | nothing runs | Byte-identical plans: checked against c6d935e for transit-city, driving-loop, hill-town, moving-day and two-stays (SHA-256 of the plan JSON equal), and in the tests. |

## 2. `outlineDraft` — the outlines

| Default | Value | Why |
|---|---|---|
| Inputs | `{ trip, places, snapshots, season?, profile?, choices?, dinners?, build_id? }` | The prompt names `trip, places, season, profile`; the snapshots carry the locations and hours (already fetched by the routine, no call), dinners name a booked dinner anchor. `season` defaults to `trip.season`. |
| Candidates | places with status candidate, scheduled or chosen and a snapshot location; open on a date per `hoursOn` minus the season sheet's `closure` events; a meal place offered in `dinners` is no candidate (the planner's own `isWithheldDinner`): it is an evening, and a dinner booked on it still anchors its date | The planner's own pool and hours rules, so the outline never plans a day the planner would refuse. Picked restaurants as candidates took anchor slots, moved area centres, counted as rain-day places and showed as sights (coordinator, wave-2 merge). |
| Clusters | greedy: the strongest unclustered place (pick, then priority) seeds a cluster of every unclustered place within `CLUSTER_KM` WALK 1 · TRANSIT 3 · DRIVE 15 km; radius = min(AREA_KM, max(1, spread + 0.5)) km | Half of `AREA_KM`: a cluster sits comfortably inside one day's area. |
| Area name | a `neighbourhood` member's name, else "around <seed place>"; "near <lodging>" for a calm or light day by the lodging; "indoors near <lodging>" for the rain-spare day | Plain words the owner recognises; ≤ 60 characters. |
| Day trip | a cluster whose centre is more than `DAY_TRIP_FACTOR` 1.5 × AREA_KM[mode] from the stay's lodging; area named "day trip around …" | Beyond a normal day's reach, worth naming as its own choice. |
| A moving day's area | a moving day spends part of a day in its area (the stay's nearest, or a booked place's), so that area counts half its weight when the stay's full days are handed out (on a tie the area no day visits goes first); when another day of the stay already visits that area, the moving day goes to the best area of picks that no day visits and that has a pick open that day (never a day trip, a calm last day or a booked date) | Otherwise a full day went back to the arrival day's area and an area of picks went unvisited (coordinator, wave-2 merge). |
| Area score | open members' planner weight (100 · 10 · 1 by priority) + `SCORE` PICK 50 per open pick, EVENT 30 for an evening event nearby that date, BLOOM 20 for a peak bloom with outdoor members | Picks and the season steer the days without overriding priorities. |
| Fixed facts in every option | moving day (lodging change or an override start/end) → `travel`; a dated booking (trip.bookings place + for_date, or a place's own booking) → anchor on its date and the date takes that place's area; a pick → anchor on a date whose area holds it and where it is open (never a free or rain-spare day; at most `LIMITS.ANCHORS` 3 a day): a full day first, then a light day, a moving day only when no other day of that area has room, the day with the fewest anchors first | The prompt's fixed facts; a pick never lands on a day it is shut, and an arrival day no longer takes all of a stay's sights while the day after it stays empty (coordinator, wave-2 merge). |
| Last day | when the last date is a travel day: "near <lodging>", note "a calm last day; …" (calm options) | The departure day is short; a calm last day is one of the prompt's examples. |
| Options (styles) | A **Balanced** (best areas on their best dates, a rain-spare day when ≥ `DRAFT.RAIN_MIN` 3 free dates and ≥ `COVERED_MIN` 2 covered places, a calm last day, no day trip); B **Full** (every free date full, a day trip when one exists); C **Slow and easy** (about half the free dates in an area, the rest light near the lodging, a free day when ≥ `FREE_MIN` 4 free dates, rain-spare, calm last day); a re-ordered Balanced tried last | Three recognisably different trips; each gains and gives up something real. |
| Difference measure | two options differ on at least ⌈n/3⌉ of the n dates (kind or area name); an option too close to a kept one is dropped; when only Balanced is left (a short trip, or one held by moving days, bookings and picks) the payload carries it alone (1–3 options) and `reason` says why ("only one way to shape the trip: …"); the core takes a one-option outline as it is and asks for the day versions at once | The prompt's example measure; dropping beats showing two near-identical columns. A `null` payload stalled the journey at the outline stage (coordinator, wave-2 merge). |
| Gains / gives-up wording | built from what the option really has: day trip, full-day count, rain-spare day, calm last day, the bloom "at their best around/in <area>", an event "on your day around/in <area>"; gives up: first the ✅ picks the option leaves out ("Leaves out your picks A and B." — anchored on no day and inside no open day's area, the same ones the planner then drops; names ≤ `PICK_NAME` 40 characters, more than three as "A, B, C and N more"; their areas are not named again), then no rain day, long days, the unused day trip, less time in unused areas, fewer places | Plain words within 200 characters, no internal terms; a pick the owner chose must not vanish without the option saying so. |
| `outlineInput(draft, { base, mix? })` | the base option's days with each mixed date taken from its option; an anchor already used on an earlier date is dropped from a later one | The planner refuses one place anchored on two dates; the earlier date keeps it. |

## 3. `planVersions` — versions of one day

| Default | Value | Why |
|---|---|---|
| The day's pool | `outlinePools`: every candidate goes to its best date under the outline with no stop cap (a free day takes none) | Versions compare different ways to fill the same day, not different trips. |
| Dinner places | each dinner place has one home date (its booking, else its outline anchor date, else a near evening open for dinner with the fewest, else the nearest); a version only sees its date's share | Two days never want the same dinner place, so a mix rarely clashes. |
| Anchors | the day's bookings and the picks the outline pinned to it are in every place version; two place versions are compared on their other stops | A version without the day's booking is no choice the owner can take; comparing anchors only made versions look alike (coordinator, wave-2 merge). |
| Place versions | A plans the whole pool; B (and C) plan the pool minus every non-anchor stop of the versions before them, seed + k, so any two share only anchors | Different ways to fill the same day. |
| Keep rule | a place version is kept when it brings a stop that is no anchor and no stop of a kept version, shares at most half of its other stops with every kept one (2 × shared ≤ the smaller count) and holds at least half as many of them as A (rounded up); the first one not kept ends the place versions | The prompt's "share at most half their stops"; a version of A's leftovers was a scrap, not a choice. The split mode (A's pool dealt into halves, recorded as `mode`) is gone: halves of a day that fits are only lighter copies of A, and the slower day below is that choice with A's best places in it. |
| Slower day | when fewer than `count` versions came and A has less than `PACE.BUSY` 120 spare minutes: A without its lowest-value stops that are not booked (non-picks first, then the owner's lowest priority, then the most time with the legs to and from it), at most `PACE.DROPS` 2, until their visits add up to `PACE.GAIN` 60 minutes, at least one stop kept; kept when it brings no stop A lacks and gives at least 60 more spare minutes; marked `pace: true` with the title "A slower day: …"; like every card, its `leaves_out` lists the pool places it does not visit | A busy day's real alternative is the same day with room to breathe; it never drops a booking. |
| One possible version | the payload carries that one version (1–3 versions) and `reason` says why ("a free day: nothing to compare", "only one way to plan this day"); the core shows it with no choice to make ("one way to go, nothing to choose") | Every date answered gets a payload: the core offers 🧱 Build my plan only once every trip date has its versions, and a `null` payload left that offer waiting for ever (coordinator, wave-2 merge). |
| Summary fields | stops (≤ 12) with arrival time; walk = WALK legs; `transit_minutes` = TRANSIT and DRIVE legs ("on trains or by car"); spare; bookings (stop and dinner booking lines, ≤ 5); leaves_out = pool places not in the version, picks first, then priority (≤ 10); warnings by severity, unique, ≤ 5 × 160 | The payload has no drive field; a drive is still time not on foot. |
| Version plan | a one-day Plan trimmed to the places it schedules, lists or offers (rain swaps outside it dropped) so `checkPlan` holds; the DayPlan passes `checkDayPlan` | The coordinator's note: every version passes both checks. |

## 4. Route answers: one request per point pair (`cachedMaps`)

| Default | Value | Why |
|---|---|---|
| Where the cache sits | under the planner's rail-first / rail-estimate wrappers (they wrap whatever client is in `input.maps`) | Every request the planner makes, including bus re-asks, goes through it. |
| Matrix | cached per origin → destination pair and mode key (the body minus points and times); only missing pairs are asked, origins with the same missing destinations in one request; a self pair is answered locally (0 min, 0 m) | One Maps unit per pair across the whole set (and across dates when the routine passes one `cache`). |
| Compute Routes | cached by the whole request minus departure and arrival time | A leg between the same two points is the same leg at another hour of the same day; transit timetables differ a little, accepted for a comparison. |
| Errors | never cached | A transient failure must not stick. |
| Counting | each version's `solver.matrix_elements` / `route_calls` and `plan.usage` count only the requests it really sent (cache deltas); the set's `usage` counts every request, a try that was not kept included | Usage stays honest: a cache hit costs nothing. |
| Snapshots | never fetched: the routine's snapshots are input and shared | The prompt: fetched once by the routine. Tests assert no Places call. |

## 5. The budget guard for a set

`versionSetBudget({ day, pool, capacity, count, ledger, dinner })` counts `count` full days of the pool's first
`capacity` places with the planner's own `budgetFor` (dinner legs included, no cache credit); `planVersions` asks for
`count + 1` days (a place version that is not kept, or the slower day's try, may be one day more than the set keeps)
and throws `PlanBudgetError` before the first request when any SKU would pass the ceiling. Inner builds run with `allowOverBudget` because the set was already counted. Why: refusing the
set whole, before anything is sent, is the prompt's rule; an upper bound without cache credit can only over-count.

## 6. `assembleChosen` — one Plan for the chosen mix

| Default | Value | Why |
|---|---|---|
| Input | `{ input (the plan input), outline (the planner outline the versions were planned under), choices: { <date>: { key, version } } }`; `version` is the whole `planVersions` result (preferred) or one version | The whole result lets Later say "in another version you did not choose" and count the set's usage. |
| Every trip date needs a choice | else an error | One Plan covers the trip. |
| A place that is a stop on two days | an error naming both dates | Never silently drop an owner's choice. |
| Dinner clash | the earlier date keeps the place; the later day goes back to its plan before dinner (the `undo` captured at build time: dinner near the lodging), the back-early line is removed when the day has evening extras, and an info warning "Dinner at X is on <date>; tonight's dinner is near your lodging" is added; listed in `notes` | Deterministic and visible; the later evening still eats. |
| Rain swaps and saved extras | never a scheduled place; each offered once (the first day keeps it) | `checkPlan`'s rules. |
| Later ("Didn't fit") | the outline's own drops; each chosen version's own drops; a pool place another version scheduled → "… is in another version of <date> that you did not choose"; any other pool place → "no room left on <date> for …"; dinner places no evening took; saved places stay in "Next time" (`mergeLater`) | The prompt: what the chosen versions left out goes to "didn't fit". |
| Budget and usage | budget = the sum of the version sets' counted budgets; usage = every request the sets sent | The routine sees what the comparison really cost. |
| `alternatives` | `{ <date>: [{ key, summary, day }] }` — the versions not chosen | For the routine to keep (`/versions <date>`). |

## 7. Fixture `two-stays`

Invented: towns Fernmoor and Quillbay in the "Fictional Isles", 2027-11-08 (Mon)..11-14, zone `Etc/GMT-9`, TRANSIT;
27 places in clusters (Old Town with a neighbourhood, harbour, hills, a Hollin day trip ~19 km out, the Quillbay
waterfront and uplands), 4 dinner places, a moving day by train (bags to the hotel) and a last day ending at the
station, a booked dinner, a timed entry, two picks, a saved place, a season sheet (peak leaves, an evening light-up, a
fair, a closure). Place ids `FixtureJy…`, links on `*.example.com` / `*.example.org`. Loaded by `loadFixture` and
listed in `JOURNEY_FIXTURE_NAMES` only, so `listFixtures()` and `C11_FIXTURE_NAMES` (asserted by other tests) do not
change. Generated by a script kept outside the repo; the JSON is the source of truth.

Developed by: LightAISolutions
