# WP-2f — decisions and defaults

The brief (TG-PHASE-4B.md row 2f, the coordinator's hidden-gems scope addition, TG-PHASE-4.md §8 items 4 and 7) left
these open; each was chosen without asking, per the WP rules. Numbered so 3d, 4d, Phase 5 and the coordinator can cite them.

## Vocabulary (`presets/travel.vocab.json`)

1. **Fourteen dimensions added, the original eight unchanged and first.** The eleven of the row (`climate`, `activities`,
   `dietary`, `spice`, `meal_style`, `lodging`, `companions`, `planning_style`, `free_time`, `transport`, `languages`) and
   the three of the Gem Funnel stage 0 (`gem_appetite`, `off_track_minutes`, `rough_edges`). `max_tokens` 2000 → 3000.
   - Why: the row and the coordinator's addition name them; keeping the old eight first keeps every existing candidate
     id, ledger and profile valid (ids hash dimension + value only).
2. **Closed lists exactly where the row or the proposal gives one**: `climate`, `spice`, `meal_style`, `companions`,
   `planning_style`, `free_time`, `gem_appetite` ("1".."5"), `off_track_minutes` ("10", "25", "45", "60"), `rough_edges`
   (`cash-only`, `no-english-menu`, `queues`, `no-reservations`, `standing-room`). A `many` dimension with a `values`
   list is closed too (that is how `checkValue` already worked).
3. **Open dimensions stay open and gain `examples`.** `activities`, `dietary`, `lodging`, `transport`, `languages` (and the
   old open four) carry an optional `examples` list: starter values an interview may offer as buttons. It does not close
   the dimension. `validateVocab` accepts it only on open dimensions (≤ 30 strings, ≤ 60 chars each, normalised).
   - Why: the brief asks for a starter list "where that helps the interview's closed options" without closing open
     dimensions; a `values` list would have closed them. The bank test checks that every open-dimension option value
     is one of its dimension's examples, so the two files cannot drift.
4. **Polarity words**: `climate` fine with / avoid; `dietary` eats / cannot eat (`-` = cannot eat); `transport` happy to
   use / avoid; `languages` speaks / does not speak; `rough_edges` tolerates / avoid. Others keep likes / avoids.
5. **"cafés" is stored as `cafes`.** Values are normalised (diacritics stripped) on load; writing the normalised form in
   the vocabulary avoids a profile that says something the file does not. The bank's button label still reads "Cafés".
6. **A `default` per dimension, machine-readable, never written to the profile.** `gem_appetite` "3",
   `off_track_minutes` "25", `rough_edges` `[{cash-only, +}, {no-english-menu, +}]` (proposal §4 stage 0).
   `validateVocab` checks a `one` default is on the list and a `many` default is `[{value, polarity}]` of legal values.
   - Why: the coordinator asked for the defaults to be recorded so Phase 5 can apply them when a question is skipped.
     A default is an assumption, not the owner's word, so it must not enter the profile (decisions only). Phase 5 (and
     the Gem Funnel, WP-2g) read `vocab.dims.get(id).default` when the profile has no entry for the dimension.

## Question bank (`presets/travel.interview.json`, `schemas/travel.interview.schema.json`)

7. **39 questions in 13 sections**: the twelve of the row plus `hidden-gems` (3 closed questions) before past favourites.
   Section ids are short slugs (`pace`, `food`, `activities`, `climate`, `mobility`, `crowds`, `budget`, `lodging`,
   `companions`, `avoid`, `planning`, `hidden-gems`, `favourites`) because decision 14 uses `/interview <section>`.
   - The hidden-gem trio made the count 39; the cap is 40. Adding a question later means dropping one.
8. **qid = `<section id>-NN`** (`pace-01`, `hidden-gems-03`), checked by `validateBank`. Stable: never renumber a
   published qid, because answers and held notes carry it (`source_ref` `interview:<qid>`).
9. **Text questions carry `options: []`** (always present, empty) — one shape for every question; the schema requires
   `options`, `validateBank` requires it empty for `text` and ≥ 2 entries otherwise.
10. **`skip_ok: true` on every question.** Decision 14 makes the interview resumable and the owner may skip anything;
    nothing in the planner needs a mandatory answer, and the gem dimensions have defaults (decision 6).
11. **A single-value dimension is only offered with polarity `+`.** A `-` pick on a `one` dimension can never be confirmed
    (`negative_single_value`), so the bank must not offer one; `validateBank` refuses it.
12. **No self-contradicting options across questions**: "hostels" and "shopping" were not offered both liked and avoided.
    Where two questions share a dimension they ask different things (likes vs avoids).
13. **The schema is generic**, named as the brief asks (`travel.interview.schema.json`), and checked with the brochure
    kit's validator (imported, not copied, like WP-3a decision 1). The semantic checks the subset cannot express live in
    `validateBank`. The 25–40 count is a test on the travel bank, not a validation rule: another vocabulary's bank may be
    shorter.

## The `interview` command

14. **Three input shapes, detected by shape**: `type` present → envelope (must be `request`; `payload.interview` holds the
    answers); `interview` present → payload; `version`/`answers` present → the bare object; anything else → "no interview
    object found". Unknown keys on the envelope and on the payload are ignored (they belong to the core's request kind);
    unknown keys on the answers object or on an answer are refused.
    - The producer is not checked (as in `decisions.mjs`): the kit is generic and `request` is a core-only type (SPEC §2).
      The private repo's wrapper may still check its own core's producer before calling.
15. **Decision time**: an envelope's `created_at` always wins; `--now` is used only when the input carries none; one of
    the two is required (the kit keeps no clock). `decided_at` = decision time + the answer's index in ms (confirms WP-4b
    decision 29); evidence `date` = the UTC day of the decision time.
    - Why `created_at` over `--now`: WP-4d can always pass `--now` and a re-run on the same request stays byte-identical.
16. **Answer kinds** `pick`, `multi`, `scale` are all taps (picks); `text` is held only. The Phase 4 delta writes `pick`
    for every tap; accepting the bank's own kind names too costs nothing and saves the core a mapping.
17. **Rejected vs warned.** Vocabulary illegality rejects the answer (unknown dimension — e.g. the old private example's
    `heat_tolerance`, now `climate` / `heat` — a value off a closed list, a bad key, a text answer without a legal
    triple). A mismatch with the bank (unknown qid, kind, or a triple that is not one of the question's options) is
    applied and reported in `warnings`: the answers file has decision-document trust and the triple is what the owner
    tapped; a bank changing between interview start and run must not drop answers.
18. **Superseded within one file**: on a single-value dimension the last `+` pick wins; on a many-value dimension the last
    pick of the same value wins whatever its polarity. Earlier ones are not ingested and are reported in `superseded`.
    Text answers never supersede and are never superseded.
19. **When a pick is saved** (confirms WP-4b decision 31): its own record is clean, its candidate exists, the candidate's
    stance equals the pick's polarity and the candidate is not `negative_single_value`. Otherwise it stays held with a
    reason and goes to review. A tie gives stance `+`, so a `-` pick tied by other evidence is held ("ties").
    - Known limit: an owner who answered `+` in one interview and `-` for the same value in a later one gets a tie,
      held for review, and the review's confirm keeps the candidate's `+` stance. The owner can reject it there. Fixing
      it means superseding held evidence across runs; out of scope here.
20. **Picks go through the ordinary path**: `ingest()` holds every kept answer as `owner-chat` evidence; one auto-built
    decisions document per 50 picks (`source:"owner"`, `via:"telegram"`, one `confirm` each) goes through `apply()` →
    `readDecisions` → `applyDecisions`. Nothing else writes the ledger or the profile.
21. **Decision ref**: `interview:<request id>` from an envelope, else `interview`. `apply()` gained an optional `ref`
    used only when the decisions document carries none (the document shape is unchanged, so WP-3d's schemas still hold).
22. **The review covers only this interview's held candidates** (text answers and unsaved picks), `--max` default 8 as in
    `review`. The payload is `buildReview`'s, unchanged. A caller wanting every open candidate calls `review`.
23. **`profile_summary`**: rendered from the ledger after apply (the profile is rendered from the same ledger), a count line
    then one line per dimension in vocabulary order (`Pace: relaxed`, `Climate: avoid altitude, heat`), each ≤ 300 chars,
    cut at a line boundary with `+N more` so the whole stays ≤ 1 200 characters. No quotes, no HTML, no Markdown.
24. **A refused profile** (hand-edited, other vocabulary, over the cap) returns `ok:false` and writes no ledger or profile;
    the held notes the run already wrote stay (ingest never touches the profile, rule 1).
25. **Exit codes**: 0 ok; 1 when the run is refused or any answer was rejected (a finding, like `ingest`); 2 usage. The
    JSON result is printed in every non-usage case.
26. **Out of scope here, kept by the caller**: WP-4b decision 34 (a `prefs` request with `interview` still runs the
    connector reads) is the skill's job; `interview` reads no connector. WP-4d calls `ingest` for connector evidence and
    `interview` for the answers in the same run.
27. **One existing test changed**: `kit_prefs_evidence.test.js` asserted the preset's exact dimension list and
    `max_tokens` 2000; it now checks the first eight and 3000. The new dimensions are checked in `kit_prefs_interview.test.js`.

Developed by: LightAISolutions
