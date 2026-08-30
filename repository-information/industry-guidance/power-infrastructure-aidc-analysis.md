# Power Infrastructure & the AIDC Power Chain — Analysis & Study Source

**Provenance:** teaching synthesis, not a document ingest and not fresh research — compiled 2026-08-24 entirely from already-verified internal material: `utility-aidc-procurement-analysis.md` (market structure, case studies, buyer map), `china-policy-stack-analysis.md` (the Texas security overlay), the relationship-web deliverable (the eight-layer chain and the three BESS sockets), the NVIDIA 800 VDC analysis (the inside-the-fence power chain), and the ON.energy dossier (the AI UPS category). Feeds the in-app Industry Guidance module `power-infra-aidc-2026-08` in `Profiler.gs` — Phase 5 of the AIDC program (team training). No new external claims; the ledger points to the internal sources that carry the original citations.

## What this is

The power-infrastructure training module for new Hithium US sales teammates, taught from a high-school-STEM baseline: how the grid is organized and paid, the two US market designs, what a grid battery earns money doing, the data-center power chain from substation to GPU, where the three BESS sockets sit in the AI buildout, and the 2026-28 rule-and-procurement calendar a seller navigates.

## Teaching sequence (mirrors the module sections)

1. **Grid basics for a seller** — generation/transmission/distribution; MW vs MWh (power vs energy — the most common new-seller confusion); front-of-meter vs behind-the-meter; interconnection queues and why they detached from reality (ERCOT ~474 GW of large-load requests; AEP ~190 GW of inquiries on a 37 GW system); the large-load tariff as the reality filter (AEP Ohio: 30 GW pipeline → ~5.6 GW signed).
2. **The two market designs** — ERCOT merchant (developer/IPP buys on economics, speed, augmentation; ~16.3 GW fleet Jul 2026) vs regulated states (IRP → RFP → self-build or PPA; bankability decides; the 85% minimum-take norm) — condensed from the utility-procurement module's buyer map into a seller's orientation table.
3. **What a grid battery earns** — arbitrage, ancillary services/frequency response, capacity payments, T&D deferral, renewable firming; how duration class maps to revenue duty; why augmentation economics extend the earning life.
4. **The AIDC power chain, grid to GPU** — utility interconnection → substation → MV distribution → transformers/switchgear → UPS → PDU → rack; where the buffering problem lives (GPU load swings of 30→100% in milliseconds); NOGRR 282 ride-through for ≥75 MW electronic loads; SB 6 curtailment mechanics — storage converts curtailable interconnection into firm compute.
5. **The three BESS sockets** — (a) front-of-meter grid-side storage (our lane: judged on duration, cycle life, price); (b) campus/BtM buffering (contested: ON.energy's FEOC-clean MV AI UPS defines the US category, 5 GW Crusoe anchor); (c) inside the data hall — rack BBU/UPS (not our layer: no rack form factor, no UPS product). The orienting rule: sell to the grid, not to the data centre.
6. **The 2026-28 calendar** — rules lane (NOGRR 245 maximization passed Dec 31, 2025; PRC-029-1 enforceable ~Oct 1, 2026; NFPA 855-2026 rolling adoption), procurement lane (Georgia's 9,885 MW / 3,022.5 MW owned-BESS certification Dec 19, 2025; Entergy Louisiana's first BESS RFP final docs Mar 3, 2026; Dominion GS-5 effective Jan 1, 2027), Texas lane (SB 6 signed Jun 20, 2025; the Abbott queue audit + Batch Zero pause Aug 3, 2026, Dec 10 target).
7. **Seller vocabulary discipline** — MW vs MWh; NOGRR 245 (storage ride-through) vs NOGRR 282 (large electronic loads); certified MW vs queue GW; minimum take; ride-through; curtailment; the LSIPA/NPRR1199 no-remote-access posture in Texas.

## Claims ledger (pointer form)

| Claim family | Original source (carries the citations) |
|---|---|
| Queue figures, tariff norms, case-study numbers, RFP dates, ERCOT fleet size | `utility-aidc-procurement-analysis.md` — claims ledger (Oncor/AEP/Entergy/Dominion/Georgia rows) |
| SB 6, NOGRR 282 mechanics, Batch Zero audit | `utility-aidc-procurement-analysis.md` — Oncor case study + ledger |
| PRC-029-1, NOGRR 245 dates | `bess-bankability-certification-analysis.md` — grid-gauntlet rows |
| The eight-layer chain, owner-furnished norm, the three sockets | `hithium-relationship-web.md` §2, §4, §6 |
| AI UPS category facts (MV, ride-through, FEOC-clean, 5 GW Crusoe) | `on-energy.profile.json` — summary + strategy reads |
| GPU transient behavior, inside-the-fence chain framing | `nvidia-800vdc-analysis.md` (paraphrased, page-cited there) |
| Texas LSIPA / NPRR1199 overlay | `china-policy-stack-analysis.md` — Texas overlay section |

**Teaching-only simplifications (flagged in-module where they appear):** the revenue-stack section is a functional taxonomy, not market-by-market compensation rules; the power-chain diagram compresses redundancy topologies (N+1, catcher/reserve) into "the UPS layer."

## What this module does NOT cover

800 VDC architecture depth (the NVIDIA module owns it); policy/tariff mechanics (China-policy module); certification detail (bankability module); battery device physics (the BESS-technology module).

Developed by: LightAISolutions
