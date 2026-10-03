# WP-12r status — the rehearsal: one trip day played through the bot

Branch `worktree-agent-a14aad02ba5bfcb50`. Brief: `helpers/prompts/TG-PHASE-12.md` (row R). Decisions and defaults:
`helpers/decisions/WP-12r.md`.

## Step 0
- `git merge --ff-only 0fa56a3`: 845 tests (844 pass, 1 skipped), `bundle.mjs --all --check` ok, `boundary-check.mjs` clean.
- Coordinator note: merged `34290ab` (WP-12d): 862 tests (861 pass, 1 skipped), bundle ok, boundary clean.

## In progress
- Nothing. Final checks: `node --test helpers/tests/` 879 tests (876 pass, 1 skipped, 2 todo = REQUESTs 1–2, 0 fail),
  `bundle.mjs --all --check` ok, `boundary-check.mjs` clean.

## Done
- `ba28e22` undated bookings with a place show on the first stored day that plans the place (`gas/14_bookings.js`,
  "planned for <day>"; test in `pack_tour-guide_gas_bookings.test.js`).
- `92fca12` `digestOf` maps C12 (harness); fixes found by the rehearsal: the 💴 Paying line no longer repeats the payment
  words (`gas/18_morning.js`), a train leg joined with a walk stays a train (`gas/19_late.js`; WP-12b's late test line 48
  updated to match); world helpers `keptAnywhere`, `checkPrefsReview`; recorded weather for the rehearsal day.
- `2753533` the rehearsal test (16 tests: 14 pass, 2 todo) and task 2: /lodging offers to re-plan the days it touches
  (`gas/26_lodging.js`, `lg` buttons, `gas/10_commands.js`).
- Decisions: `helpers/decisions/WP-12r.md`.

## REQUESTs
1. **Planner owner (WP-12a / coordinator) — `helpers/packs/tour-guide/planner/planner-day.mjs`**, the `solveDay` call
   (~line 159): give `must: true` to a candidate whose `booking.date === date`, as to `c.anchor === date`. Why: a re-plan
   from 14:31 drops the 15:45 booked print gallery for an unbooked museum. Failing assertion: `todo` test "REQUEST
   planner: a booked stop keeps its slot when the day is re-planned" (`the 15:45 booking is still on the day`).
2. **Planner owner — `planner/planner-dinner.mjs` `prepareDinners`** (`byId.get(raw.id) || raw`): keep the input
   dinner's own status (`chosen`) when the plan's places say `scheduled`. Why: a re-plan swaps the owner's chosen dinner
   for a saved-for-later one. Failing assertion: `todo` test "REQUEST planner: the chosen dinner stays when the day is
   re-planned" (`'tarnwick-cellar-soup' !== 'tarnwick-terrace-grill'`).
3. **WP-12c (private repo digest builder):** map C12 as `helpers/tests/harness/tour-guide-digest.js` does (decisions
   §2: stations from own access notes only, never the route line; dinner local name/address/payment/price line), and
   clip day warnings to 20 × 200 characters with "…". Why: the core rejects a whole digest for one planner warning over
   200 characters (the planner allows 400); seen with an `order_disagreement` warning on the rehearsal fixture.
4. **WP-12c / contract owner:** a `replan` request from a lodging change carries the new lodging only in `reason`
   ("The lodging changed: <words>. Re-plan these days to start and end there."): the private plan-days routine should
   read it there and plan those days from and to the new lodging, or C-contract `trip_update` gains a `lodging` field.
5. **SPEC / docs owner:** `helpers/SPEC.md` §5 callback registry: add `lg` (`lg:<trip key>:<yyyymmdd>|k`, a lodging
   change re-plan offer). `helpers/packs/tour-guide/README.md`: list `gas/26_lodging.js`; note that an undated booking
   with a place shows on the first stored day planning it ("planned for <day>", never written to `for_date`); the
   Paying line dedupe and the joined-leg mode rule.
6. **Coordinator, for WP-12b:** their `pack_tour-guide_gas_late.test.js` line 48 now expects "↳ transit · travel time
   not recalculated" (was walk) — the join-mode fix in `gas/19_late.js`.
7. **Follows from 1 (no separate change if 1 lands):** after a re-plan dropped the booked stop, the day card (/today)
   still lists "🎟 Print Gallery slot · ✅ booked" while the gallery sits under "If you have energy".

Developed by: LightAISolutions
