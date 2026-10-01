# WP-5a — Commands and flows: decisions

Defaults chosen where the plan, SPEC, the pack README, the Phase 5 brief (`helpers/prompts/TG-PHASE-5.md`, row 5a) and the Phase 5 contract (`helpers/decisions/TG-PHASE-5.md` §1) are silent, and the places where the build deliberately departs from the brief's wording. Numbers in brackets point at the file that carries the rule.

## Deviations from the brief (approved or contract-safe)

1. **Owner seeds are matched by name** (approved by the coordinator). The shortlist schema has no `owner_seed` field, so the plan flow remembers the seed names it sent (at most 30 per `/plan`, deduplicated case-insensitively) and marks a shortlist item *your pick* when its name matches one of them after folding case, accents and punctuation (`tgPlanIsSeed`, a whole-word match, not a substring), or when its `labels` carry `owner_seed` (defensive fallback). [12]
2. **`sl` data is `sl:<run>:<g><n>:w|l|s`**, not `sl:<run>:<n>:…`: item numbers restart per group, so the key is the group letter (`a` activities, `f` food) plus `n`. The run is WP-5b's short run key (`tgShortlistRunKey`, ≤ 12 chars). [12]
3. **`tf` data is `tf:<trip key>:<n>:y|e|n`**, not `tf:<n>:…`: a tap counts only inside the plan flow of that trip and only before the missing-fact questions start; otherwise the toast says "Send /plan <destination> to confirm these." [12]
4. **Review taps use the core's `fl` buttons**, not `rv:<slug>:u|d|s`: a place slug can be up to 64 characters (callback data would overflow) and `fl` gives stale-step protection for free. `rv` is used only for the daily offer's `rv:go:<trip key>`. [13]
5. **The digest does not resend the PDF.** The plan-days skill's `reply` carries `drive_file_ids` (`plan`, `brochure_html`, `brochure_pdf`, `notes`) and the core already sends each as a captioned document (brief's own "Document delivery" row), so the `plan_digest` hand-off shows the day list, the Later reasons and the 📄 · 🔁 · 🔖 buttons and ends the flow. 📄 (`pl:br`) resends the stored PDF with `tgSendDocument` (caption: title · checked on) and falls back to a `brochure` request when no PDF id is stored or Drive refuses it. [10, 12]
6. **Interview answers use the prefs kit's shape** `{ qid, dimension, value, polarity, kind }` (one entry per value; a `multi` answer gives one entry per ticked option, a `text` answer one per comma/newline/semicolon-separated value, at most 5, each ≤ 60 chars), inside `payload.interview = { version: 1, answers }`. The kit's `interview` command accepts this shape directly; skipped questions write nothing. [11]
7. **No `tg_capture_*` message handler.** Every free-text capture of WP-5a (interview text answers, intake additions, ✏️ fact edits, the missing-fact questions, owner seeds during choosing) goes through the active core flow (`expect: 'any' | 'text'`), which the core router reads before any message handler. [11, 12]
8. **Contract stage set kept.** The plan flow's `state.stage` is always one of `intake · confirm · research · choose · planning`; the missing-fact questions are the second half of `confirm` (`state.ask` names the open question). [12]

## Commands (10_commands.js)

9. **Trip keys in callback data**: the slug itself when ≤ 36 chars of `[a-z0-9-]`, else `t` + 11 hex of its SHA-1 (`tgCmdTripKey`); `tgCmdTripByKey` resolves both. Index buttons (`lt`) carry `<i>.<4 hex of the slug>` so a list that changed in between answers "That list has changed — send /later again."
10. **Place keys (`ps`)**: the slug when `ps:<slug>:n` fits 64 bytes, else `.<i>` into the list remembered in Settings `tg_places_last` (the last `/places` search or `/place` answer) — not in Choices, whose kinds are fixed to `fact · shortlist · review`.
11. **The current trip**: `/trip <name>` (slug, slug prefix, or words of the title/destination) pins it in Settings `tg_current_trip`; every other command uses `tgTripCurrent()`. No trip → "No trip yet — start one with /plan <destination>."
12. **`/today`** in the owner's time zone: the day's plan; before the trip "starts <date> (in N days) — /day 1"; after it "ended <date>. How was it? /review".
13. **Day views**: one message when it fits, split on line boundaries otherwise; ◀ ▶ buttons (`dy:<tk>:<n>:e`) edit the view in place when it is one message, else send it. Legs show minutes + mode with the Maps link; a leg back to `lodging` closes the day. Links over 400 chars or not `https://` are dropped (the name stays).
14. **`/later` promotion**: ⬆️ asks which day, then opens `replan` with `dates: [that day]`, `promote: [place slug]`, `reason: "promoted from the Later list"`, and clears the tapped keyboard.
15. **`/places`**: at most 8 hits (WP-5b's search order); ➕ adds a Later row with reason `owner_choice` and offers the day buttons; 🔁 opens `places` with `scope: check`, the place's destination (else the current trip's destination slug) and `slugs: [slug]`.
16. **`/replan`** accepts `day N`, `N`, `YYYY-MM-DD`, `today`, `tomorrow`; the rest of the line (≤ 300 chars) is `reason`. **`/notes [names]`** maps names to the plan's stop slugs and reports names not in the plan. **`/lodging <text>`** stores `trips.lodging = { text, nights? }` (R1; nights read from "N nights"); the next research request carries it.
17. **`core_start`** offers the interview (with the bank's question count and one `pl:iv` button) only while no profile summary is cached. **`/profile`** shows the cached summary with one `pl:ivs:<section>` button per section plus "Whole interview".

## Interview (11_flow_interview.js)

18. One question per message with a progress line `i of N · <section title>`; *Skip* on every question; `pick` and `scale` are one tap (scale rows of up to 4), `multi` toggles then *Done*; questions the bank no longer has are skipped on resume. TTL 7 days. `/interview` resumes, `/interview all|restart` starts over, `/interview <section>` (id or title prefix) redoes one section. A different active flow is never replaced. Nothing answered → "Nothing recorded", no request.

## The /plan journey (12_flow_plan.js)

19. **Slug** = `tgSlug(destination)`; `-2`, `-3`… when that trip is already `done`; `trip-<8 hex>` for a destination with no latin letters. `/plan` with the same destination re-shows where the flow is; `/plan <other>` during a flow is refused; `/plan` alone shows usage or the flow's state. TTL 14 days.
20. **Facts**: untapped facts count as ✅; ✏️ captures the next text as the corrected line (dates re-parsed); text typed during confirm is added as an "Also:" fact. **Missing facts** are asked by text in the order dates · lodging · flight · booking · companions · other; dates are required (one or two ISO dates, real calendar dates, span ≤ 60 days), the rest skippable.
21. **research `new`** carries `start_date`/`end_date`, `lodging` (a string: confirmed lodging facts and the answer joined with "; ", else `/lodging`), `booked` (`"<Label>: <text>"` lines for flight, booking, companions, other) and pending `seeds`; the trip row gets the dates and lodging.
22. **Rounds**: *More options* and *More gems* share the three-round cap (`TG_PLAN_MORE_MAX`); `decided` = every slug shown in this flow's runs (newest 200). Seeds sent when no More button is left use a *Look up my picks* round that does not count. *Done choosing* needs at least one ✅.
23. **No flow active**: `trip_facts` renders the facts plus "Send /plan <dest> to confirm these and carry on."; a `shortlist` renders the items plus *Continue choosing* (`pl:sc:<tk>:<run>:<1|0 more>`), which adopts the round into a new plan flow at stage `choose`; a `plan_digest` renders the day list with its buttons.
24. A `plan_digest` that arrives while the flow is still researching ends the flow too (the plan exists; a stale choose step would only confuse).

## Review (13_flow_review.js)

25. Items = the digest's stops in visit order, one per place, at most 40. 👍 or 👎 is followed by the calibration step (⏩ needed longer · ⏪ less was fine · 👌 about right · ⏭ not sure); ⏭ *Skipped it* goes straight to the next place; ✅ *Finish* ends early. Each tap is stored with `tgChoiceSet(trip, 'review', 'review', slug, rating, calibration)`. Nothing rated → "Nothing recorded", no request.
26. One `prefs` request with `payload.review = { trip, items: [{ slug, rating: up|down|skipped, calibration?: longer|shorter|right }] }`; a trip in `planned` or `delivered` becomes `done`.
27. **Daily offer `tg_review_offer`**: once per trip (Settings `tg_review_offered` and `trips.review_offered_at`), when `end < today ≤ end + 7`, the trip is `planned` or `delivered` and its digest has stops. Starting a review by hand also marks the trip offered.
28. **`/review` with no name**: the latest ended trip that is not `done`, else the current trip.

## Requests to other owners

None. (WP-5b decision 15 already covers its `tg_capture_pf_edit` against an active flow.)

Developed by: LightAISolutions
