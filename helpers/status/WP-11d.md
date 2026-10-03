# WP-11d — Brochure: the design pass for the new facts (13)

**State: done** (waiting for the merge; REQUESTs below).
- Brief: `helpers/prompts/TG-PHASE-11.md` (Contract C11, WP-11d, Rules). Decisions and defaults: `helpers/decisions/WP-11d.md`.
- Branch `worktree-agent-a0f7119c11f4d638f`, worktree `/home/user/Personal/.claude/worktrees/agent-a0f7119c11f4d638f`, from `origin/main` 683c9e6 (v01.50r).

## Done
- Step 0: the three checks clean at the start (611 tests); old-plan HTML hashes taken before any change.
- Kit (`helpers/kits/brochure/`): schema and model for every C11 field; day page (real start/end rows, bag step,
  last entry, visit-length source, booking line, crowd note, dinner card, "This evening" box in clock order); place
  cards (facts block with sources, date checked and "check again"; local-favourite tag); season page after the
  overview (`lib/sections/season.mjs`); C11 CSS only when the model uses C11; README section for the C11 fields.
- Pack (`helpers/packs/tour-guide/brochure-map/`): one adapter `brochure-map-facts.mjs` with five swap points shaped to
  WP-11b's final signatures (`factsLines`, `menuLine`, `factsStale`, `eventsOn`, `bloomOn`); days, cards, index and
  attribution map C11 (day overrides, bags, extras, stop facts, dinner booking, facts, flags, season); invented sample
  `brochure-map-sample-c11.mjs`.
- Tests: `helpers/tests/kit_brochure_c11.test.js` (8) and `helpers/tests/pack_tour-guide_brochure-map_c11.test.js` (11):
  field mapping, schema accepts the new fields and rejects unknown keys and bad values, semantic checks, old HTML
  unchanged (4 hashes), red team (escaping, non-https links dropped, long names clipped), the swap, the PDF page budget
  when `pdfAvailable()`.
- Final checks: `node --test helpers/tests/` 630 tests, 629 pass, 0 fail, 1 skipped (pre-existing);
  `node helpers/tools/bundle.mjs --all --check` ok; `node helpers/tools/boundary-check.mjs` clean.

## Screenshots checked (each one opened and looked at)
- `/tmp/wp-11d-shots/final/c11-a4/page-03.png` (season), `page-04.png` (day 1: start, bags, dinner card, evening box),
  `page-05.png` (day 2: carried bags, end at the station); `/tmp/wp-11d-shots/r4/c11-a4/page-06.png` (cards: facts block,
  stale mark, menu line, local favourite) and `page-07.png`.
- `/tmp/wp-11d-shots/final/c11-phone/phone-03.png`, `phone-04.png`, `phone-06.png` (390 px: season, day 1, cards);
  scrollWidth 390, no horizontal scroll.
- `/tmp/wp-11d-shots/final/old-phone/phone-03.png` and `/tmp/wp-11d-shots/r1/old-a4/page-03.png` (old plan, unchanged).
- Kit fixture with every C11 field, letter: `/tmp/wp-11d-shots/kit/c11-letter/page-03.png` (season), `kit2/c11-letter/page-04.png`
  and `page-05.png` (day 1 and its continuation, the evening box at sunset).
- Earlier rounds that drove fixes: `/tmp/wp-11d-shots/r1` (c11-a4 pages 02–09, c11-phone 02–04), `r2` (a4 04–05),
  `r3` (phone 01, 05, 06). Page counts: pack sample A4 8 → 9 (the season page); no paginator warnings anywhere.

## REQUESTs
1. `helpers/packs/tour-guide/brochure-map/brochure-map-facts.mjs` (coordinator, at merge with WP-11b): rebind `IMPL` to
   WP-11b's modules — `factsLines`, `menuLine`, `factsStale` from `helpers/packs/tour-guide/facts/index.mjs` and
   `eventsOn`, `bloomOn` from `helpers/packs/tour-guide/season/index.mjs` (one import line plus the `IMPL` object).
   Why: the adapter must use the framework's single formatter; signatures already match, `now` is passed as
   YYYY-MM-DD. Then re-run `pack_tour-guide_brochure-map_c11.test.js`: the tests pinned to the local wording
   (`localFactsLines`, `localMenuLine`, `localBloomOn` exact strings, the sample's menu and lead lines) may need the
   strings WP-11b writes.
2. Private brochure build (WP-11g, `skills/` in the private repo): pass `options.now` (the build date) and
   `options.diet` (the travellers' diet, string or list) to `renderPlan` / `toBrochureModel`, and the trip's `season`
   and each place's `facts`. Why: without `now` nothing is marked stale; without `diet` the menu line says "fits the
   diet".
3. `helpers/packs/tour-guide/README.md` (its owner): add `brochure-map-facts.mjs` and `brochure-map-sample-c11.mjs`
   to the brochure-map section and `_brochure-map_c11` to the test list. Why: the pack README lists the module files
   and suites; this WP does not own it.
4. `helpers/SPEC.md` §16 (coordinator): the ownership row for WP-11d, if the map lists Phase 11 rows (paths above).

## Notes
- Pre-existing, not changed: at 390 px the clock next to a numbered badge is clipped ("10:00a"), in the old plan too.
  Fixing it would change the old HTML, which this WP must not do; a later WP can widen the time column.

Developed by: LightAISolutions
