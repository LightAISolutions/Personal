# The China Policy Stack for a BESS Seller — Analysis & Study Source

**Provenance:** research synthesis, not a document ingest — compiled 2026-08-24 from ~55 primary and secondary sources (statute text via Cornell LII, IRS Notices 2026-15 / 2025-08, USTR determinations, Federal Register, law-firm analyses: Foley Hoag, Bracewell, K&L Gates, Stoel Rives, Pillsbury, White & Case, Morgan Lewis). Feeds the in-app Industry Guidance module `china-policy-stack-2026-08` in `Profiler.gs`. Every quantitative claim carries a source in the Claims Ledger; items the research pass could not verify are flagged [UNVERIFIED].

## What this is

A teaching document for the US sales team of Hithium — an NDAA §154-named Chinese containerized-BESS maker — mapping the four federal machines that constrain Chinese battery storage in the US market: the tax lever (OBBBA FEOC/PFE rules), the trade lever (tariffs), the defense lever (NDAA procurement bans), and the domestic-content lever (the ITC adder). Each operates on a different legal mechanism with different dates, and conflating them is the most common seller error.

## Executive read

1. **The tax lever is decisive.** Since July 4, 2025 the Internal Revenue Code disqualifies PFE-tied projects from the §48E storage ITC. Hithium is a statutory Specified Foreign Entity **by name** (the tax code incorporates the FY2024 NDAA §154(b) list directly) and twice over (Chinese-organized). A 2026-construction-start BESS needs a material-assistance cost ratio (MACR) ≥55% non-PFE; with the battery pack ~65.6% of manufactured-product cost, a Hithium-cell system lands ~34% — the **entire ITC** is lost, not an adder. Escape: projects that began construction (tax rules: physical work test or 5% safe harbor, Notices 2013-29/2018-59 as of Jan 1, 2025) by **Dec 31, 2025** are exempt from the MACR test.
2. **The tariff lever is real but survivable.** After 2026's rollercoaster (48.4% Jan 1 → SCOTUS strikes IEEPA tariffs Feb 20 (*Learning Resources v. Trump*, 6-3) → 38.4% with a 150-day §122 bridge → §122 expiry + new 12.5% §301 forced-labor layer Jul 24), the stack on Chinese lithium-ion storage batteries (HTS 8507.60.00) is **~40.9%** as of Aug 2026. No exclusion process; no AD/CVD on finished batteries (the graphite AAM case died on a negative ITC injury vote Mar 31, 2026).
3. **The defense lever is narrow but brands the company.** DoD cannot buy batteries from the six named makers from **Oct 1, 2027** (§154); the FY2026 NDAA (P.L. 119-60, Dec 18, 2025) phases FEOC-free defense battery sourcing 2028-2031, with an exception requiring non-FEOC final assembly + >95% non-FEOC cost + **no FEOC-licensed technology**. Commercial sales untouched — but §154 listing is what wrote Hithium into the tax code.
4. **The domestic-content adder is already lost.** The +10% ITC adder needs 50% (2026) / 55% (2027+) US manufactured-product content; under Notice 2025-08's cost table a grid-scale BESS maxes ~40% without a US-made cell. Mesquite TX module assembly does not fix it — and because Hithium US is ≥25% SFE-owned it is a Foreign-Influenced Entity, so Mesquite output is **PFE-made for the FEOC test**. US soil does not cleanse the product.

## Deep dives

### The entity tests (who is a PFE)
- **SFE**: FEOCs per FY2021 NDAA §9901(8); DoD §1260H Chinese-military-company list (CATL added Jan 2025); UFLPA list; **the §154(b) six by name (CATL, BYD, Envision, EVE, Gotion, Hithium)**; foreign-controlled entities (organized/PPB in China, Russia, Iran, North Korea, or >50% owned by their governments/nationals).
- **FIE**: an SFE can appoint a covered officer; single SFE ≥25% ownership; SFEs aggregate ≥40%; SFEs hold ≥15% of debt; or prior-year payments to an SFE under a contract conferring "effective control."
- **Effective control / licensing indicia** (agreements on/after Jul 4, 2025): licensor right to specify component sources; direct operations; limit IP use; royalties beyond year 10; service agreements >2 years; incomplete transfer of technical data/know-how. Carve-out: bona fide outright IP purchase. Ford/CATL Marshall proceeds under this standard (Ford owns site + equipment; asserts 45X eligibility at $35/kWh cells, $10/kWh modules).

### Two prohibitions, two dates
| Rule | Effect | Effective |
|---|---|---|
| Taxpayer-level PFE prohibition | No §45Y/48E/45X credit for an SFE/FIE taxpayer | Tax years beginning after Jul 4, 2025 — regardless of construction date |
| Material assistance (MACR) | Project loses credit below threshold | §48E: construction beginning after Dec 31, 2025 |
| 10-year recapture (§48E) | Full ITC recaptured on effective-control payments to an SFE within 10 years of COD | Tax years beginning after Jul 4, 2027 |

Even a safe-harbored 2025 project can lose its credit if the owner becomes an FIE — e.g. an exclusive long-term O&M/LTSA with a Chinese SFE. Keep post-COD service contracts short and non-exclusive.

### The MACR ladder (48E storage)
55% (2026) → 60% (2027) → 65% (2028) → 70% (2029) → 75% (2030+). Non-storage facilities run 40→60%; §45X battery components 60/65/70/80/85 (2029-30 rungs from concordant secondary sources). Notice 2026-15's own EST example fails at 27.2% vs the 55% floor. Safe harbors: Identification + Cost Percentage (use Notice 2025-08 tables) + Certification (supplier certs: EIN, penalties of perjury, 6-year retention, no-reason-to-know standard). Teeth: §6695B supplier penalty (greater of 10% of underpayment or $5,000); §6662(m) 1% substantial-understatement trigger; §6501(o) 6-year statute of limitations. Treasury's PFE tables due Dec 31, 2026; interim reliance runs 60 days past their publication.

### The 2026 tariff rollercoaster (HTS 8507.60.00, cells and containers alike)
| Period | Layers | Stack |
|---|---|---|
| Late 2025 (post-Busan) | 3.4 MFN + 7.5 §301 + 10 IEEPA fentanyl + 10 IEEPA reciprocal | 30.9% |
| Jan 1, 2026 | §301 non-EV → 25% | 48.4% |
| Feb 24, 2026 | SCOTUS strikes IEEPA (Feb 20); §122 10% bridge (150 days) | 38.4% |
| Jul 24, 2026 → current | §122 expires; §301 forced-labor 12.5% (9903.05.31) | **40.9%** |

Notes: no exclusion process for lithium-ion; EV batteries at the same 40.9%; graphite AAM AD/CVD (93.5%/66.68% final) produced **no orders** — ITC negative injury vote Mar 31, 2026, and Commerce's scope excluded AAM inside finished batteries; IEEPA refund claims are live for 2025-early-2026 importers. Tariff applies to customs value at the border: a Chinese-built container pays on the whole box; Chinese cells into Mesquite pay only on cell value — a genuine cost lever (unlike the tax rules).

### NDAA
- **FY2024 §154**: DoD funds ban on batteries "produced by" the six (final assembly or majority of components), effective Oct 1, 2027. Commercial sales unaffected. Gray zones (contractor-embedded batteries, utility-owned assets serving bases) await DFARS [UNVERIFIED as to agency interpretation].
- **FY2026 NDAA** (Dec 18, 2025): FEOC-free advanced batteries — new acquisitions Jan 1, 2028; standard batteries Jan 1, 2029; existing acquisitions Jan 30, 2031. Exception: non-FEOC final assembly + >95% non-FEOC cost + no FEOC-licensed technology. Adds Mo/Ga/Ge to covered materials; "mined, refined, separated" expansion Jan 1, 2027.

### Texas overlay
LSIPA (2021, strengthened Sept 2025) bars Chinese-controlled remote access/control of grid-connected infrastructure; ERCOT NPRR1199 (Apr 2024) equipment attestations; Paxton investigation into CATL equipment at a Mabank BESS (Nov 2025). Expect no-remote-access security architectures as an ERCOT deal condition even where tax doesn't bite.

## What it means for Hithium

**The interaction map (developer evaluating a Hithium DC block, Aug 2026):** safe-harbored-2025 start → ITC survives; watch effective-control indicia and the post-2027 recapture. 2026 start → MACR ~34% vs 55% floor → full ITC lost; tax equity walks. Tariff: 40.9% on imported content (cell-only via Mesquite roughly halves the base). DoD-adjacent: blocked from Oct 2027. Texas: security-architecture friction.

**Viable lanes:** (1) the safe-harbored 2025 pipeline — the primary 2026-27 lane; offer BOC documentation support and effective-control-clean contracting; (2) merchant/tax-indifferent buyers — must beat FEOC-compliant alternatives by roughly the ITC delta (~40-50% on capex) or win on speed/availability/cycle life; (3) tariff engineering via Mesquite (halves the tariff base; fixes nothing on tax — teach the distinction relentlessly); (4) outright IP sale (the bona fide-purchase carve-out) — a royalty license is the dangerous version; (5) non-US markets (LatAm, Middle East, Australia, SE Asia) where none of the stack applies.

**Red lines:** never assert ITC eligibility for a 2026+ start with Hithium content; never sign or facilitate a non-PFE certification for Hithium product; route BOC representations through counsel; disclose the 40.9% stack in TCO models; lead with no-remote-access architecture in Texas.

## Claims ledger

| # | Claim | Source | Date |
|---|---|---|---|
| 1 | 48E storage MACR 55/60/65/70/75 (2026→2030+) | 26 USC 7701(a)(52)(B) (Cornell LII); IRS Notice 2026-15 example | 2025-26 |
| 2 | SFE includes §154(b) six by name; 1260H; UFLPA; foreign-controlled | Notice 2026-15 §2 | 2026-02-12 |
| 3 | FIE: covered officer / 25% single / 40% aggregate / 15% debt / effective control | Notice 2026-15 §2; Bracewell | 2026 |
| 4 | Effective-control licensing indicia (royalties >10 yr, services >2 yr, source-specification, incomplete know-how) | Notice 2026-15 (§7701(a)(51)(D)(ii)(III)) | 2026 |
| 5 | BOC exemption before Jan 1, 2026 per Notices 2013-29/2018-59 (as of Jan 1, 2025); Notice 2025-42 inapplicable | Notice 2026-15 fn. 11/14; K&L Gates | 2025-26 |
| 6 | Binding-contract exclusion (pre-Jun 16, 2025; PIS < 2030; BOC < Aug 1, 2025) | Notice 2026-15 (§7701(a)(52)(D)(iv)) | 2026 |
| 7 | Notice 2026-15 issued Feb 12, 2026; three interim safe harbors; tables due Dec 31, 2026 | IRS IR-2026-23 | 2026-02 |
| 8 | Certification mechanics + §6695B / §6662(m) 1% / §6501(o) 6-yr | Notice 2026-15 §2 | 2026 |
| 9 | 10-yr recapture, TYs beginning after Jul 4, 2027 | Bracewell; Stoel Rives; Reunion | 2025 |
| 10 | §301 non-EV Li-ion 7.5→25% Jan 1, 2026; no exclusions | USTR Sept 2024 determination; Holland & Knight | 2024 |
| 11 | 2026 stack: 48.4 → 38.4 (Feb 24) → 40.9 (Jul 24, current); §122 bridge; §301 forced-labor 12.5% | Pacific Battery; Gateway Lines; TariffsTool | 2026 |
| 12 | SCOTUS strikes IEEPA tariffs 6-3, Feb 20, 2026 (*Learning Resources v. Trump*); refunds live | WilmerHale; K&L Gates; SCOTUSblog | 2026-02 |
| 13 | Graphite AAM: AD 93.5% / CVD 66.68% final, scope excludes finished batteries; ITC negative Mar 31, 2026 — no orders | Federal Register; USITC release | 2026 |
| 14 | §154: six named, DoD ban Oct 1, 2027; "produced" = final assembly or majority components | OpenSanctions US-NDAA-154; Bloomberg | 2023-24 |
| 15 | FY2026 NDAA (P.L. 119-60, Dec 18, 2025): FEOC-free phases 2028/2029/2031; >95% + no-FEOC-license exception; Mo/Ga/Ge | Pillsbury; White & Case | 2025-26 |
| 16 | Domestic content adjusted %: 40/45/50/55; +10-pt adder | Stoel Rives; IRS domestic content page | 2025 |
| 17 | Notice 2025-08 BESS table: pack/module 65.6%, container 29.8%; ~40% max without US cell | Notice 2025-08; Energy-Storage.News | 2025-01 |
| 18 | Mesquite: ~$200M, 484k sq ft, 10 GWh/yr module+system assembly, no cell lines, mass production Aug 2025 | Hithium PR; Dallas Innovates; Energy-Storage.News | 2025 |
| 19 | Storage exempt from wind/solar 2027 PIS cliff; ITC 100% through 2033 starts, then 75/50/0 | Stoel Rives; pv magazine USA | 2025 |
| 20 | Texas LSIPA; NPRR1199 (Apr 11, 2024); Paxton CATL/Mabank investigation (Nov 24-25, 2025) | Norton Rose Fulbright; Texas AG release | 2024-25 |
| 21 | Busan truce Nov 10, 2025 (fentanyl 20→10; reciprocal suspension) — mooted by SCOTUS ruling | White House fact sheet; PwC | 2025-11 |
| 22 | Ford/CATL Marshall proceeding; LFP production 2026; Ford asserts eligibility | CNBC; Bridge Michigan | 2025 |
| 23 | Gotion Michigan plant terminated Oct 2025 (~$24M clawback); Illinois Manteno proceeding | Michigan Public; ENR | 2025-26 |

**[UNVERIFIED]:** 45X critical-minerals year-by-year ladder; §154 reach into contractor-embedded/utility-PPA-served installations (awaiting DFARS); 45X battery 2029 rung (80%, secondary sources only); whether IEEPA refunds have been paid out as of Aug 2026.

## What this analysis does NOT cover

State-level procurement preferences outside Texas; CFIUS review mechanics for Chinese battery investments (Gotion's failed CFIUS motion noted only in passing); the §45X credit mechanics from the manufacturer side; export-control rules on the China side (China's own graphite/technology export licensing); and any non-public enforcement activity.

Developed by: LightAISolutions
