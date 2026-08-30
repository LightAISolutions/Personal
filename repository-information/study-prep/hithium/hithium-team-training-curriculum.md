# Hithium — Team Training Curriculum

**Provenance:** Phase 5 deliverable of the AIDC program — the final phase of the plan approved under v02.91r. Sequences the assets built in Phases 1-4 into a four-week onboarding program for new US sales teammates: the six in-app Industry Guidance modules (including the two Phase 5 training modules), the two Phase 4 playbooks, the Profiler dossier base (88 companies), and the relationship-web deliverable. Internal, never deployed. Prepared 2026-08-24.

**Who this is for:** the team lead running onboarding (this document is the trainer's manual), and secondarily the new teammate (weeks 1-4 are readable as a self-paced syllabus). Every content asset already exists — this document adds sequence, competency gates, and the trainer's checks.

## 0. Before day one

- **Access:** grant the new teammate the **contributor** tier in the Profiler app — the Industry Guidance hub (the "✦ Industry Guidance" masthead button) is role-gated, and every study module below lives there. Without the grant, week 1 cannot start.
- **Documents:** hand over the two playbooks as PDFs (`HITHIUM-IC-PLAYBOOK.pdf` now; `HITHIUM-TEAM-LEAD-PLAYBOOK.pdf` only if the hire carries leadership scope) — but do **not** assign them until week 4. The playbooks assume the vocabulary the modules build; read too early they produce confident misuse, which is worse than ignorance.
- **Expectations:** state the two standards that are enforced from day one regardless of training progress: the red-lines list (IC playbook §8 — a new hire can violate a red line in week 1 by improvising in an email) and quiet-buyer discretion (no account names anywhere, ever, without written consent).

## 1. Program shape

Four weeks, each with one theme, one primary in-app module set, a dossier reading list, and a competency gate the trainer verifies before the next week opens. The in-app modules carry their own flashcards, self-tests, and progress tracking — the trainer's job is the gates, not the lecturing.

| Week | Theme | Primary assets | Gate (summary) |
|---|---|---|---|
| 1 | The machine | *BESS Technology Fundamentals* module + the Hithium dossier | Spec-sheet fluency + claim discipline |
| 2 | The grid and the buildout | *Power Infrastructure & the AIDC Power Chain* + *Utility Procurement Meets AIDC Load* modules | Buyer-map fluency + vocabulary discipline |
| 3 | The policy stack and the money | *China Policy Stack* + *Bankability & Certification* modules | MACR arithmetic + red-lines recital |
| 4 | The motion | The IC playbook + the relationship web + live shadowing | Mock first call + objection round |

Sequencing rationale: product before market (you cannot place a product in a market you can't describe), market before policy (the fence only makes sense once you know what it fences), policy before motion (the playbook's qualification script is policy applied). The *NVIDIA 800 VDC* module is deliberately **not** in the core four weeks — it is advanced material, assigned after week 4 to anyone covering data-center-adjacent accounts.

## 2. Week 1 — The machine

- **Study:** the *BESS Technology Fundamentals* module end to end, including flashcards and the self-test. The module is taught from a high-school-STEM baseline — no prior battery knowledge is assumed.
- **Dossier reading:** `hithium` (the v5 dossier — read the summary, products, and strategy reads; skim the spec annex), then `catl` and `tesla` for competitive contrast.
- **Exercise:** given a blank ∞Power 6.25 MWh 4h spec sheet, annotate every line with "why the buyer cares" from memory; explain the cell ladder (which cell, which container, which duty) without notes.
- **Gate:** the trainer runs a 15-minute products conversation playing a mildly technical developer. Pass requires: correct cell-to-container mapping; the year-12 question answered with the warranty-curve-plus-augmentation frame; the sodium question answered with the approved line (utility SKU shipping, AIDC SKU unconfirmed, commit in writing only); zero vocabulary fumbles on cycle life / RTE / DoD.

## 3. Week 2 — The grid and the buildout

- **Study:** the *Power Infrastructure & the AIDC Power Chain* module (the teaching layer), then *Utility Procurement Meets AIDC Load* (the case-study layer — Oncor, AEP, Entergy, Dominion, Georgia Power). Take both self-tests.
- **Dossier reading:** `jupiter-power` (the anchor-account pattern), `on-energy` (the category rival), one gas-cohort dossier (`voltagrid` or `enchanted-rock`), and one utility-adjacent EPC (`solv-energy` or `blattner`) to see the owner-furnished norm from the installer's side.
- **Companion:** the relationship web (`hithium-relationship-web.md`) §2 (the eight layers) and §4 (the decision map) — the map the week's dossiers plug into.
- **Exercise:** given three hypothetical prospects (a queue-position braggart, a regulated-utility self-build program, an ERCOT merchant IPP), sort them into pursue / relationship-only / walk, with the reason in one sentence each.
- **Gate:** the trainer runs the buyer-map drill. Pass requires: who signs the cell PO in each of the six channels; MW/MWh and 245/282 used correctly under mild pressure; the three BESS sockets with our honest position in each; "sell to the grid, not to the data centre" explained rather than recited.

## 4. Week 3 — The policy stack and the money gauntlet

- **Study:** the *China Policy Stack for a BESS Seller* module (the four machines, the entity tests, the MACR ladder, the compliant lanes), then *Bankability & Certification* (the three gauntlets, the IE's view of Hithium, the RFP checklist). These are the two densest modules — budget the week accordingly.
- **Dossier reading:** re-read the `hithium` strategy reads with week-3 eyes; skim `fluence` or `lg-energy-solution` to see what a FEOC-compliant rival's file looks like.
- **Exercise:** the MACR worked example — given a hypothetical project BOM, compute whether it clears the 55% floor with Hithium cells and state what could be resized to make it clear. Then the reverse: name three signals that a deal is a walk (2026+ ITC start, FEOC-clean spec, non-PFE certification request).
- **Gate:** two parts, both required. (a) The red-lines recital: all items from IC playbook §8, from memory, with the *why* for each — reciting the rule without the reason fails. (b) The arithmetic check: the MACR example done correctly, plus the two vocabulary traps (9540A is a test method, not a certification; Mesquite is a tariff lever, never a FEOC fix) stated unprompted.

## 5. Week 4 — The motion

- **Study:** the IC playbook, now with the three weeks of vocabulary underneath it: the channel map, the seven-question qualification script, the disqualifier table, the objection table, the Jupiter defense, the proof pack. Re-read the relationship web §3 (Hithium's verified position) and §6 (the demand pools).
- **Shadowing:** at least two live calls with a senior IC — one qualification-stage, one technical-stage if the calendar allows. The new hire's job on the call is silence plus a written after-action: which script questions were asked, which objections surfaced, which red lines were near.
- **Exercise:** prepare and deliver the mock first call — the trainer plays a safe-harbored ERCOT developer; the script must surface lane, decider, BOM shape, augmentation plans, and security posture inside 20 minutes.
- **Gate:** the final round, two parts. (a) The mock first call, passed on question coverage and disqualifier alertness, not on charm. (b) The objection round: the trainer fires four objections from the playbook table (always including the FEOC listing and the lapsed IPO); pass requires the concede-then-structure pattern — conceding the true part immediately and answering with structure, never reassurance. Sign-off: the red-lines acknowledgment, in writing, filed with the team lead.

## 6. The competency gates, consolidated

| Gate | Verifies | Failure handling |
|---|---|---|
| G1 (wk 1) | Products conversation: cell ladder, year-12 frame, sodium discipline, vocabulary | Re-drill the module's flashcards; retest inside 3 days — do not open week 2 |
| G2 (wk 2) | Buyer map: six channels, three sockets, MW/MWh + 245/282, the orienting rule | Re-run the sorting exercise with three fresh prospects |
| G3 (wk 3) | Red-lines recital with reasons; MACR arithmetic; the two vocabulary traps | Mandatory — no customer contact of any kind until G3 passes |
| G4 (wk 4) | Mock first call + objection round; written red-lines sign-off | Repeat with a different trainer persona; extend shadowing |

The gates are pass/fail, not scored. G3 is the hard floor: a teammate who cannot recite the red lines with reasons is a compliance exposure, not a training case.

## 7. After week 4 — the ongoing cadence

- **Dossier rotation:** two dossiers per week from the 88-company base, prioritized by the teammate's account set; the strategy reads are the required part, the spec annexes are reference.
- **Advanced modules:** the *NVIDIA 800 VDC* module for anyone covering data-center-adjacent accounts; re-take each module's self-test when its `updated` field changes.
- **Field-note discipline:** intel from calls goes into the Profiler notes pipeline with a rated confidence score, from the first shadowed call onward. Field notes are never cited as profile sources — the pipeline handles verification.
- **Refresh alignment:** the quarterly proof-pack refresh (tariff stack, CATL-suit status, IPO status, fleet data — team-lead playbook §6) triggers a 30-minute team session; the policy calendar's dated gates (team-lead playbook §3) each trigger a briefing the week they land.
- **Leadership track:** a teammate moving toward territory ownership adds the team-lead playbook plus the forecast-discipline rules (stage gates, MOU-at-zero counting, the safe-harbor depletion asset).

## 8. Trainer's notes

- **The modules do the teaching; you do the gating.** Resist re-lecturing module content — the in-app flashcards and self-tests are the drill mechanism, and progress is tracked per account in the app. Your time goes into the gates, which test *transfer* (can they use it under mild pressure), not recall.
- **Watch for the week-3 shortcut.** The strongest new hires try to skip to the playbook. The observed failure mode is a seller who can recite the objection table but computes MACR wrong in front of tax counsel — sequence is the protection; hold G3 firm.
- **Concede-then-structure is the house answer pattern.** It appears in the objection table, the safety framing, and the sodium discipline. If a gate answer opens with reassurance instead of the true part, fail the answer even when the facts are right.
- **Keep the curriculum pointed at living assets.** This document names modules and playbooks, not page numbers — the assets version independently (`updated` fields in-app; the playbooks via the repo). When an asset materially changes, the change lands here as an adjusted gate or reading item, not as duplicated content.
- **Time-sensitive content decays on a schedule.** The tariff stack, the MACR floor, and the policy calendar all move on dated gates — any gate exercise using a number must use the number *as of the exercise date*, and catching a stale number in the trainer's own materials is a legitimate way for a trainee to pass part of G3.

Developed by: LightAISolutions

Developed by: LightAISolutions
