# Phase 8 — resume note

**Part 1 (before the trip) — done 2026-10-02.** Personal v01.45r; the private repo's re-pin and skill changes are on its `claude/project-thread-rarais` branch for the owner to merge by PR. What was built and why: `helpers/decisions/TG-PHASE-8.md`.

**Part 2 (after the owner's trip)** — start a new session on Opus 5.5 · high with `Read helpers/prompts/TG-PHASE-8.md and execute it exactly.` and skip what part 1 finished. Open items:

1. Ask how the trip went (Step 0.3): days that worked, wrong visit lengths and transit legs, picks skipped on the day, what the brochure lacked.
2. Japan train estimates: read the owner's answer to the decision card (Keep · Tune · Pay). If Tune, compare the trip's real rides with `planner-rail.mjs` estimates and adjust its constants with that evidence. Already in hand (decisions §5): three of the owner's Google times came out −7, +2 and −3 min against the estimates; the station radius went to 1.3 km.
3. Google hours and ratings in the brochure (default yes) — ask with item 2.
4. ~~Companion weighting~~ — answered 2026-10-03: "Their limits, your lead", as built. Nothing to do.
5. F24: confirm once that `/day` (or a quick answer with `/smart on`) names the right day.
6. F17 Japan `rating_offset` −0.2: check against the kept-versus-skipped taps (`Choices` tab) and the Aggregate counts; adjust in the private source table.
7. Visit-length accuracy: planned versus the owner's account, per category; the activity session lengths (ceremony 60, class 150, workshop 120, tasting 60, performance 90) are typical values to check.
8. Step 3 tuning: objective weights, the 75-minute wait cap, the 90-minute spill, shortlist caps and the `fit` formula, gem weights from the taps, brochure polish, costs and repository use.
9. Third-party review sources only if the local-source stream was thin.

Developed by: LightAISolutions
