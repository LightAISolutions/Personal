# When Utility Procurement Meets AI Data-Center Load — Analysis & Study Source

**Provenance:** research synthesis, not a document ingest — compiled 2026-08-24 from ~60 primary and secondary sources (utility releases and RFP documents, PUC/PSC/SCC orders, ERCOT dockets, PJM planning reports, trade press: Utility Dive, DCD, RTO Insider, Modo Energy). Feeds the in-app Industry Guidance module `utility-aidc-procurement-2026-08` in `Profiler.gs`. Quantitative claims carry sources in the Claims Ledger; unverified items flagged.

## What this is

A teaching document for Hithium's US sales team on how regulated utilities and grid operators are responding to hyperscale AI load — and where battery storage actually enters utility procurement. Five case studies (Oncor, AEP, Entergy, Dominion, Georgia Power) plus the cross-cutting playbook and the buyer map.

## Executive read

Interconnection queues have detached from reality — ERCOT ~474 GW of large-load requests (~5x its all-time peak), AEP ~190 GW of inquiries vs a 37 GW system, Dominion ~70 GW of requests vs a 24.7 GW peak. The utility playbook that emerged 2024-2026 has four consistent moves:

1. **Large-load tariff classes** converting speculative demand into bankable demand — minimum take (85% is the national norm, set by AEP Ohio and echoed by Dominion), 12-15+ year terms, ramp schedules, exit fees, collateral. AEP Ohio's tariff collapsed a 30 GW pipeline to ~5.6 GW of signed, financially committed load — the single best proof that tariffs, not engineering, separate real AIDC demand from vapor.
2. **Massive gas procurement** — Entergy's ten plants (~7.5 GW) for Meta, Georgia Power's 3,692 MW of CCs, Dominion's 5.9 GW gas plan.
3. **Storage procurement growth** as the fast, certifiable companion — Georgia Power ~3.8 GW owned BESS operating/under construction/certified + a 500 MW third-party RFP; Dominion under a statutory 2.7-GW-by-2035 mandate with ~4.5 GW planned; Entergy Louisiana's first standalone BESS RFP (Mar 2026); PSO/SWEPCO all-source RFPs (4.5 GW combined) explicitly include BESS.
4. **Flexibility/curtailment as interconnection currency** — Texas SB 6 (curtailment + the ERCOT "kill switch" for co-located load), ERCOT NOGRR 282 ride-through for ≥75 MW electronic loads, Google's 1 GW of contracted demand response across five utilities.

## Case studies (condensed — full detail in the module)

- **Oncor (TX wires-only):** Q1 2026 queue ~271 GW data-center + 18 GW industrial across 697 requests; $47.5B 2026-2030 capital plan; Permian Basin Reliability Plan brings Texas's first 765 kV network. SB 6 (signed Jun 20, 2025, ≥75 MW loads): $100k+ study fees, proof of site control, mandatory curtailment protocols, backup-generation disclosure, co-location review with an ERCOT kill switch, competitive emergency DR, 4CP re-examination. Batch Zero (approved Jun 2026) batch-studies the queue. **Aug 3, 2026: Gov. Abbott ordered a queue audit and ERCOT paused Batch Zero** (Dec 10 target; BNEF: ~49.8 GW / up to $15B at risk). NOGRR 282 requires new ≥75 MW electronic loads (grandfathered if energized/studied by Nov 14, 2025) to ride through disturbances — effectively mandating buffering (UPS, BESS, or on-site generation) between grid and GPUs.
- **AEP:** 69 GW contracted through 2030 (Q2 2026) vs ~190 GW of inquiries; ~$70B five-year capex. The AEP Ohio tariff (PUCO order Jul 9, 2025; >25 MW): 12-yr contracts, 4-yr ramp 50→90%, then 85% minimum monthly billing, ~3-yr exit fee, collateral unless ~A-rated. Pipeline: 30 GW → 5,642 MW signed. On appeal (Ohio Supreme Court No. 2025-1458). AEP Ohio/Texas are wires-only (no storage procurement); PSO (1,500 MW) and SWEPCO (3,000 MW) all-source RFPs include standalone BESS.
- **Entergy:** the most aggressive gas-for-AI builder ($57B 4-yr plan; 7-12 GW DC pipeline). Meta Hyperion (Richland Parish LA): LPSC approved 3 CCGTs (~2.26 GW, ~$3.2B + $550M transmission) 4-1 in Aug 2025 on a 15-yr ESA; Mar 2026: Meta funds seven more plants (~5.2 GW, ten total); Jul 2026: Hyperion scales to 5 GW / >$50B. Stranded-cost fight: 30-40-yr assets vs 15-yr contract. Mississippi: AWS ~$25B total commitment; EMI $2-3B gas+solar. First standalone BESS RFP (2025 ELL BESS RFP, final docs Mar 3, 2026, MISO Zone 9 only; size unconfirmed) — the least storage-mature of the five, i.e. the greenest vendor field.
- **Dominion (VA):** ~70 GW of DC delivery-point requests (Feb 2026), 2-3 GW/month arriving; contracted capacity ~40 GW. SCC order Nov 25, 2025 creates rate class **GS-5** (≥25 MW, effective Jan 1, 2027): 14-yr contracts, minimums of 85% (T&D) / 60% (generation), exit fees. VCEA mandate: 2.7 GW storage by 2035; 2024 IRP plans ~4.5 GW BESS by 2039 alongside 5.9 GW gas; annual RFP cycle (Nov 2025 filing: 845 MW solar + 155 MW owned storage + 439 MW PPAs, ~$2.9B). EVLO (Hydro-Québec) delivering >300 MWh across three Dominion projects. PJM RTEP $11.8B; Dominion won ~$4.8B incl. a 185-mi 525 kV HVDC line into Loudoun. PJM capacity price: $329.17/MW-day cap in 2026/27.
- **Georgia Power:** capacity need 400 MW (2022) → 6,600 MW (2023, the "17x") → 8,500 MW (2025), driven by data centers. Large-load rules (≥100 MW customized contracts, Jan 2025); base-rate freeze through 2028. **Dec 19, 2025: PSC approved 9,885 MW / ~$16.3B unanimously — gas CCs 3,692 MW + company-owned BESS 3,022.5 MW (10 facilities incl. Bowen/Thomson/Wansley 500 MW each, Yates 570 MW) + 350 MW BESS+solar + 2,821 MW PPAs — with shareholders backstopping if DC demand fails.** Already built/building: Mossy Branch 65 MW (Tesla Megapack 2 XL, B&M EPC, COD 2024); 765 MW under construction (McGrau Ford I+II, Robins, Moody, Hammond; Tesla ~2 GWh master supply Sept 2024). Open: 2025 ESS RFP — 500 MW ≥2-hr third-party storage (Ascend Analytics evaluating); ~1,000 MW more signaled.

## The buyer map (who signs the BESS purchase order)

Regulated chain: IRP (need certified) → RFP (independent evaluator) → either **utility self-build** (utility signs EPC + direct OEM master supply — Georgia Power/Tesla ~2 GWh, Dominion/EVLO >300 MWh; entry point is the EPC and the approved-vendor process) or **PPA/acquisition** (the developer/IPP who bid the RFP picks the OEM — the utility never sees the cell brand except in technical review). ERCOT merchant: the buyer is always the developer/IPP/fund (Hithium's existing channel — the 1 GWh Perfect Power MOU). **Two-lane motion: design-win with the developers bidding the RFPs, and get on utility/EPC approved-vendor lists before the next self-build cycle.**

## ERCOT vs regulated states

ERCOT merchant (~16.3 GW fleet Jul 2026; queue entries −50% H2 2025; growth decelerating) sells on cost, availability, augmentation. Regulated Southeast/PJM (Georgia ~3.5 GW certified + RFPs; Virginia 2.7 GW mandated; Louisiana/Mississippi first cycles; SPP 4.5 GW all-source) sells on bankability — UL 9540A, NFPA 855, domestic content, PUC-defensible supply chains. The 85%-minimum-take world is a bankability world.

## What it means for Hithium

1. Sell where the money is certified, not where the queue is loud — track IRP dockets and certification orders as the true pipeline (certified BESS MW = POs on a 12-36-month fuse).
2. Two-lane motion (above); Lane A's bid-stage pricing locks the BOM — engage developers early.
3. Confront China-content headwinds proactively (tariff ~40.9% current stack; FEOC per the China-policy module); Mesquite is the counter-story for tariff base and logistics, not for tax.
4. NOGRR 282 opens a buffering product category at the data center itself — sold to developers/power partners in quarters, not regulatory years (ON.energy's AI UPS is first-mover; SB 6 curtailment strengthens the same pitch: storage converts curtailable interconnection into firm compute).
5. Watch the political gates: the Texas audit (Dec 2026), the Ohio appeal, Louisiana stranded-cost fight, Dominion GS-5 effectiveness (Jan 2027), Georgia's 2028 rate case.

## Claims ledger (abbreviated — module carries the full table)

| Claim | Source | Date |
|---|---|---|
| Oncor queue ~271 GW DC + 18 GW industrial, 697 requests | Oncor Q1 2026 results | 2026-05 |
| Oncor $47.5B 2026-30 plan | Oncor release | 2026-02 |
| SB 6 provisions (≥75 MW; curtailment; kill switch; $100k fees) | Pillsbury; McGuireWoods; Mayer Brown | 2025 |
| ERCOT queue 474 GW; Abbott audit Aug 3, 2026; 49.8 GW/$15B (BNEF) | Utility Dive; Texas Tribune; POWER | 2026-08 |
| NOGRR 282 LEL ride-through; grandfather cutoff Nov 14, 2025 | ERCOT docket; ON.energy guide | 2025-26 |
| AEP Ohio tariff: 85% min / 12 yr / 3-yr exit fee; PUCO Jul 9, 2025; 30 GW → 5,642 MW | PUCO; KJK; mgrid; DCD | 2025 |
| AEP 69 GW contracted; ~190 GW inquiries; ~$70B capex | AEP Q1/Q2 2026 releases | 2026 |
| Entergy/Meta: 3 CCGTs ~2.26 GW/$3.2B approved 4-1 Aug 20, 2025; +7 plants Mar 2026; Hyperion 5 GW/>$50B Jul 2026 | Entergy; UCS; Data Center Knowledge | 2025-26 |
| ELL BESS RFP final docs Mar 3, 2026 (MISO Zone 9) | Entergy RFP site | 2026-03 |
| Dominion GS-5: ≥25 MW, 14-yr, 85%/60% minimums; SCC Nov 25, 2025 | Virginia Mercury; SCC; Inside Climate News | 2025-11 |
| Dominion ~70 GW requests; 2.7 GW VCEA mandate; 4.5 GW planned; EVLO >300 MWh | Virginia Business; Utility Dive; Electric Energy Online | 2024-26 |
| PJM RTEP $11.8B; $4.8B Dominion HVDC; capacity $329.17/MW-day | Utility Dive; IEEFA | 2025-26 |
| Georgia: 400→6,600→8,500 MW need; 9,885 MW/$16.3B certified Dec 19, 2025 (3,022.5 MW owned BESS) | GA PSC fact sheet; Georgia Power; AJC | 2025 |
| Georgia 765 MW BESS under construction; Tesla ~2 GWh supply; 500 MW ESS RFP | Georgia Power; Energy-Storage.News; PR Newswire | 2024-25 |
| ERCOT BESS ~16.3 GW Jul 2026; queue entries −50% H2 2025 | Modo Energy; ess-news | 2026 |
| Google 1 GW DR across five utilities | Renewable Energy World; DCD | 2026-03 |

**[UNVERIFIED]:** ELL BESS RFP target MW; NOGRR 282 final PUCT order date; individual CCGT unit ratings (total ~2.26 GW well-sourced).

## What this analysis does NOT cover

MISO/SPP market design changes beyond the named RFPs; co-op and muni procurement outside CPS/STEC; the hyperscalers' own PPA storage procurement (covered by their dossiers); non-US utility responses.

Developed by: LightAISolutions
