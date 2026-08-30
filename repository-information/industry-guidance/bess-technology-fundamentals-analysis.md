# BESS Technology Fundamentals for the Sales Team — Analysis & Study Source

**Provenance:** teaching synthesis, not a document ingest and not fresh research — compiled 2026-08-24 entirely from already-verified internal material: `hithium.profile.json` (profileVersion 5 — product/spec claims are the company's own published figures, marked as such), the bankability & certification analysis (safety/certification claims), and `study-prep/hithium/hithium-lesson-plan.md` (the teaching sequence). Feeds the in-app Industry Guidance module `bess-tech-fundamentals-2026-08` in `Profiler.gs` — Phase 5 of the AIDC program (team training). No new external claims are introduced; the claims ledger points to the internal sources that carry the original citations.

## What this is

The core-technical training module for new Hithium US sales teammates, taught from a high-school-STEM baseline: what a storage cell is, how cells become containers, what every line on the spec sheet means and why buyers care, the Hithium product ladder, sodium-ion honestly stated, and the safety/certification vocabulary a seller must not fumble.

## Teaching sequence (mirrors the module sections)

1. **The cell** — LFP electrochemistry in plain terms: why storage uses LFP (safety, cycle life, cost) where EVs lean NMC (energy density); Hithium's founding premise of storage-purpose-built prismatic cells rather than repurposed EV cells; cycle life vs calendar life, DoD, C-rate, round-trip efficiency.
2. **The spec sheet decoded** — the eight numbers buyers quote (cycle life, Wh/kg / Wh/L, RTE, degradation/SoH warranty curve, duration class, operating window, footprint density, augmentation path) with "why the buyer cares" per row.
3. **The cell ladder** — 280Ah (≥7,000 cycles) → 314Ah (≥13,000 — the volume workhorse) → 587Ah (≥11,000, mass production 2025) → 650Ah (SNEC 2026 debut, deliveries 2027, specs unpublished) → 1175Ah (first mass-produced kAh-class, Jun 2025) → 1300Ah (8h LDES-native, ≥10,000 cycles, mass delivery Q4 2026). The large-cell logic: fewer parts, fewer welds, lower integration cost — and the honest tradeoffs (thermal management, propagation test data must keep up).
4. **From cell to container** — cell → module → DC block → PCS → AC block → site; ∞Block 4.180/5.016 MWh; ∞Power 6.25 MWh 2h/4h; the 6.9 MWh 8h LDES unit (55.2 MWh per 8-unit block); Flexsso 10-ft modular (Q2 2026); Desert Eagle hardened variant. Owner-furnished procurement context: we sell DC blocks to owners; EPCs install them.
5. **Sodium-ion, honestly** — N162Ah (NFPP cathode, 2.82 V, ≥95.2 Wh/kg, ≥20,000-cycle class, −40 °C window) and the ∞Power N 1h system; what sodium is for (power/1h duty, cold climates, cycle life — not energy density); the overclaim warning: the AIDC sodium SKU's mass production is unconfirmed — sales language stays inside the shipping utility SKU.
6. **Duration classes** — 1h/2h/4h/8h as product-market fit cards (which cell serves each, what revenue duty each maps to); 8h-native LDES as the differentiated tier with no mass-produced like-for-like above 1,000 Ah.
7. **Safety & certification vocabulary** — thermal runaway and propagation in plain terms; UL 9540A as a *test method with no pass/fail* (say "tested at cell, module, and unit level — reports available"); UL 1973/9540 listings; NFPA 855-2026 and large-scale fire testing; the Moss Landing device-class distinction (legacy indoor NMC ≠ modern outdoor LFP container); EPRI's ~97-99% failure-rate decline per deployed GWh 2018→2025 with the media-derived-database caveat.

## Claims ledger (pointer form)

| Claim family | Original source (carries the citations) |
|---|---|
| All cell/system specs, dates, and product claims | `hithium.profile.json` v5 — `productsAndServices` + `technicalSpecs` (company-published figures; the dossier's 51 sources) |
| Shipment rankings (Top 2 2025, 35.1 GWh 2024), Mesquite, Navarre | `hithium.profile.json` v5 — `ecosystemRole` (InfoLink/SMM/ICC per dossier sources) |
| 9540A/NFPA 855/LSFT mechanics; Moss Landing; EPRI decline; insurer read | `bess-bankability-certification-analysis.md` — claims ledger rows 1-3, 6-10 |
| Sodium AIDC SKU mass production unconfirmed; AIDC line zero named customers | `hithium.profile.json` v5 — `strategyRead` (high-confidence read) |
| Peak Energy sodium wedge context | `hithium.profile.json` v5 + the relationship-web deliverable §3 |

**Teaching-only simplifications (flagged in-module where they appear):** electrochemistry is described functionally (ions shuttle, electrodes host) without cell-physics depth; "fewer parts" large-cell logic is directional, not a costed BOM claim.

## What this module does NOT cover

PCS/inverter internals (the power-infrastructure module owns the electrical chain); policy and tariff content (the China-policy module); bankability mechanics beyond vocabulary (the bankability module); competitor spec tables (the Profiler dossiers own those).

Developed by: LightAISolutions
