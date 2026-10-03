# WP-12d — Brochure: the re-planned day, the phone clock, dates in words, undated bookings

**State: done.** Not pushed.
- Brief: the coordinator's WP-12d message (Phase 12, `helpers/prompts/TG-PHASE-12.md` Rules).
  Decisions: `helpers/decisions/WP-12d.md`.
- Worktree branch `worktree-agent-a376d7853e5159b8d`, fast-forwarded a7350b7 → b59ba30 (WP-12a squash).
- Step 0 baseline at b59ba30:
  - `node --test helpers/tests/`: 805 tests, 804 pass, 1 skipped, 0 fail;
  - `bundle.mjs --all --check`: ok (hello, tour-guide);
  - `boundary-check.mjs`: clean (566 files).
- At the end:
  - `node --test helpers/tests/`: 822 tests, 821 pass, 1 skipped (a pre-existing skip), 0 fail;
  - `bundle.mjs --all --check`: ok (hello 19 files, tour-guide 36 files);
  - `boundary-check.mjs`: clean.

## Done
1. **A re-planned day in the brochure** (C12 `visited`, the leg start `here`).
   - Kit: the reserved `here` is shown as "where you were" and its link has no origin.
   - A visited stop is shown as done: ✓, muted, kept in order, on both the rail and the glance page.
   - C12 CSS is added only for C12 models, so the old HTML did not move (decisions 3–7).
2. **The phone clock at 390 px.** One rule in the phone media query; A4 is pixel-identical.
   - The golden hashes moved deliberately, with a proof that reverting the rule gives the old hashes back.
   - Screenshots are listed in decisions 12 (decisions 8–12).
3. **Dates in words.**
   - `dayDate()` (planner) gives the day card's "Wed 12 May"; a test proves it equals `tgCmdDate`.
   - It is used in the planner's dated Later reasons and in the brochure's "Taken off the plan for …" note.
   - Which outputs moved, and the proof for each, is in decisions 13–19.
4. **A booking with no date.**
   - An undated record belongs to the first day its place is planned on.
   - It shows on the planner's dinner line, on the brochure stop's booking line and on the Bookings page ("Planned
     for …"), with tests (decisions 20–23).
   - The Telegram day card needs gas: REQUEST 2.
- Also fixed: two golden-test titles that my phone-clock commit broke (an apostrophe inside a single-quoted string),
  commit f1e1aa7.

## REQUESTs
1. **`helpers/packs/tour-guide/journey/journey-assemble.mjs:83`**
   - Change: build the reason as ``no room left on ${dayDate(date)} for …``, adding
     `import { dayDate } from '../planner/planner-time.mjs';`.
   - Why: journey plans still write YYYY-MM-DD in this Later reason, while the planner now writes the day card's
     "Mon 18 Oct" (WP-12d task 3). Journey tests that pin this text would need the same update.
2. **`helpers/packs/tour-guide/gas/14_bookings.js` `tgBkDayLines(trip, day)`** (owner: gas, WP-12b or later)
   - Change: also show an undated record (`!b.rec.for_date && b.rec.place`) when its place is on that day and on no
     earlier day.
     - Collect the slugs of each stored day from `tgDigestDays(t.slug)`: `day.stops[].slug`, plus `day.dinner.slug`
       when present.
     - Find the first date whose slugs include `b.rec.place`.
     - Keep the record when that date is `d`.
   - Why: today the filter is `b.rec.for_date === d` alone, so a booking with a place but no date shows on no day
     card. The planner and the brochure now place it on the day its place is planned on (decisions/WP-12d.md 20–23),
     and the day card should agree. Do not write the date into `for_date`: a dated booking becomes an anchor.
   - Test idea: `pack_tour-guide_gas_bookings.test.js` stores a digest with the place on day 2 and checks that the
     record is on day 2's card only.
   - Optional, same file: `tgBkLine` could say "planned for <tgCmdDate>" for such a record.
3. **`helpers/packs/tour-guide/README.md`, brochure-map section** (the `bookingsSection` line and the Phase 11
   paragraph)
   - Change: add one sentence: "A booking record shows on its stop's row (its own date, or with no date the first day
     its place is planned on); the Bookings page says 'Planned for <day>.' for such a record. Later reasons and the
     'Taken off the plan for …' note write a day as the day card does ('Wed 12 May')."
   - Why: the README documents brochure-map behaviour, and I do not own it.

Developed by: LightAISolutions
