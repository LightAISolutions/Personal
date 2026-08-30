# Zhonhen — Interview Day One-Pager

**The five-minute scan.** Reasoning and citations: [`zhonhen-strategy-report.md`](zhonhen-strategy-report.md) · [`zhonhen-lesson-plan.md`](zhonhen-lesson-plan.md) · [`zhonhen-deck-summary.md`](zhonhen-deck-summary.md).

## Open with this

> *"The West's own roadmap reaches your core product last — NVIDIA's MV-to-DC power block is the **2029** rung of its ladder, and you've been shipping that rung since the Alibaba co-development. The strategy isn't to win the SST future; it's to monetise **2026 through 2029**."*

Their ladder: power racks **2H 2026** → row power centres **2027** → MV-to-DC blocks incl. SST **2029**.

## Say TRU, never SST

Panama is a **transformer-rectifier unit**. Schneider's 800VDC paper says MV conversion happens *"by SST or TRU"* — same slot, different device class, and an engineer will catch the conflation.

| | **TRU — what Zhonhen ships** | **True SST — the 2029 device** |
|---|---|---|
| Isolation | Line-frequency 50/60 Hz, iron core | ~kHz through a small high-frequency core |
| Switches | Commodity, on the LV side | MV-rated SiC, switching at medium voltage |
| Power flow | Essentially one-way | Bidirectional by design |
| Grid role | A load | Active interface — reactive power, voltage regulation, fault-current limiting |
| Status | Shipping since 2019, fleet history | Roadmap item |

**Why the precision helps you:** "mature magnetics, shipping today" is the stronger card. If they want an SST you are selling the wrong thing; if they want megawatts on the floor in 2027, the line-frequency transformer is the **feature** — the part nobody has to qualify.

## ERCOT wrote your sales narrative

**NOGRR282 + NPRR1308, binding 1 Aug 2026.** Large Computational Load = **≥75 MW**, ≥50% computational. Ride through **0.50–0.80 p.u. ≥0.5 s** and **0.20–0.50 p.u. ≥0.25 s**, back to **≥90% draw within 2 s**, current ≤125% — **disturbance-counting trips banned**. Not retroactive (pre-14 Nov 2025 exempt → sell *new* builds); stricter tier after 1 Jan 2028. National next: FERC ordered standards 16 Jul 2026, Phase I due 31 Dec 2026. Behind it: Fairfax **~1.5 GW** self-disconnected, Ashburn/PJM **>3 GW**, ERCOT **26 events >100 MW**.

> *"Batteries on the DC busbar means we comply by construction — I'd make the NOGRR282 envelope the acceptance test of every pilot."*

## 473 kW/m³ — and who to say it to

1 MW sidecar, 800 × 2200 × 1200 mm = 2.112 m³ → **473 kW/m³**, 98.5%, **150 A/µs** load response, 30 × 33 kW rectifiers + 125 kW DC/DC, with 8 × 160 kW CBU + 8 × 125 kW BBU **inside the same cabinet**.

Neoclouds convert capital into GPU-hours, and that ranks everything: **① time-to-revenue** (GPUs depreciate against signed delivery dates) → **② density** (every m³ of power plant is a m³ not earning) → **③ ride-through** (a sag costs work back to the last checkpoint, and is now law) → ④ TCO per GPU-hour → ⑤ vendor pedigree, which they care about *least* — the reason your door exists at all.

**473 answers ② and ③ in one number:** more of the hall earns, *and* the compliance buffer costs no extra floor. The AC alternative bolts on separate capacitor shelves and Megapacks that eat white space they are already paying for.

| Buyer | Reality | **Lead with** |
|---|---|---|
| **Tenant neoclouds** — CoreWeave, Lambda, Nebius | Lease; the landlord owns the MV gear. All three named by NVIDIA as 800 V design pioneers | **473 kW/m³.** Charged by footprint, and they buy the rack-side chain — sidecar, shelf, PSU |
| **IREN** — target 1 | Owns its ERCOT substations and lists **no electrical vendor publicly**; Sweetwater 2.75 GW energising from Apr 2026, Childress 750 MW | **Schedule + ERCOT compliance.** Weeks vs a 30–40-month transformer queue. Pitch a pilot MVR container on one Sweetwater building |
| **Crusoe** — target 2 | Off-grid / behind-the-meter; Abilene 1.2 GW on its own generation. Bought 29 aeroderivatives purely because combined-cycle ran ~7 years | **Generator protection.** No system inertia off-grid, so GPU swings hit the gensets directly; storage at four depths on one DC bus smooths what they see |
| **Core Scientific, TeraWulf** — wave 2 | Brownfield conversions with MV already in place and brutal retrofit schedules against anchor leases | The **no-shutdown retrofit** into halls whose power chain is being rebuilt anyway |
| **xAI** — deprioritise | Best technical fit on paper, worst political fit: inside SpaceX, a defence contractor mid-IPO | **Walk away, and say so yourself.** Naming the hard stop reads as judgment and saves a year |

## Landmines — volunteer none, survive all

| If raised | What holds |
|---|---|
| NVIDIA partner roster | Zhonhen is on **neither** the May nor Oct 2025 list, and denied signed hyperscaler agreements in Aug 2025. Never imply membership — the architecture claim survives on its own |
| The gated whitepaper quote | *"simpler and highly familiar design"* is **publicly unverifiable**. It stays inside Zhonhen conversations and never goes in front of a customer |
| CATL | 49% of the **holding company**, not the listco; Bao Xiaoru chairs. In the US it stays behind the architecture — battery-agnostic products, FEOC/1260H-clean options, CATL as balance sheet and never the badge on the door |
| No US entity, UL listing or reference site | True, and conceding it is the move. The wedge is regulatory physics plus schedule, not ecosystem membership — saying exactly where each claim ends is what reads as command |
| Tariffs | The calendar beats the tariff: a tariffed, factory-built skid available in weeks beats a 30–40-month domestic transformer queue. Model landed cost per deal |
| Security review / Chinese vendor | Real, and it is why segmentation is ruthless: commercial neoclouds and landlords first, xAI and federal-adjacent never |
| Founder's Dec 2025 conviction | **You never raise it.** Not with Jacky, not with anyone |

## Numbers cold

240 / 336 / 800 Vdc · 10 kV China MV, 12.47–34.5 kV US · Panama **10 kV → 240/400/800 Vdc in one stage**, >97.5%, 2.5 MW per block · SuperX 3.6 MW at 98.5% · sidecar **473 kW/m³** at 150 A/µs · 100 kW shelf at 96 A/µs (say "100", not 108) · 18 kW PSU at 16 A/µs · NVIDIA 800 V: **+157% power through the same copper, −45% copper, ~+5% efficiency, −30% TCO** · racks 120–150 kW today → ~600 kW Kyber 2H 2027 → 1 MW-class · conversion stages **7–8 legacy / 5 HVDC / 3 Panama** · US 2026: 7,000–9,000 MW new DC capacity, **$68.6 B of the ~$95 B prefab market** · Zhonhen generations **2010 → 2019 → 2025**.

## Close with the question that shapes everything

**Jacky only — the Schneider Electric relationship is his confidential disclosure and does not exist outside that room.** Their own 800VDC paper says MV conversion happens by SST or TRU, and they ship **neither**; Red Oak integrates prefab power centres by the hundred against a $700 M US factory spend; Vertiv is already reported to ship 800 V HVDC built on a Chinese subcontractor. A Zhonhen TRU inside a Schneider-branded power centre solves brand, certification and service in one structure. So ask:

> *"Is the Schneider conversation at the component layer, the integrated-block layer, or certification?"*

The answer determines the entire shape of the US go-to-market — and asking it separates someone who read the deck from someone who understands the business.

Developed by: LightAISolutions
