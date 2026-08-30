# AIDC Market Report — the US AI Data-Center Infrastructure Market

*An equity-research guide to what drives the AI data-center build, what constrains it, and where the 40 companies under coverage stand.*

*Prepared 2026-08-16 · **Coverage** the 40-company Profiler dossier set (`live-site-pages/profiler-data/`, researched 2026-08-07 → 2026-08-10) · **Company facts** no new research — every company citation is a source already catalogued in a dossier's `sources[]` · **Policy** the FEOC, tariff and FCC sections were re-verified against current sources on 2026-08-15/16 and supersede the prior edition*

> **This document is analysis, not investment advice.** It explains commercial position and strategy for companies under coverage. It does not recommend the purchase or sale of any security, and the "what this means for your capital" passages are framing for understanding, not direction to trade.

**📄 Formatted editions —** the report is typeset for download in all five writing styles registered in [`PROFILER-STYLES.md`](PROFILER-STYLES.md), each matching that style's export skin in the Profiler app. **The skins change typography and section chrome only — the report text is identical across all five.**

&emsp;[`AIDC-MARKET-REPORT.pdf`](AIDC-MARKET-REPORT.pdf) — BloombergNEF Research Report *(canonical edition)*<br>
&emsp;[`AIDC-MARKET-REPORT-analyst-prose.pdf`](AIDC-MARKET-REPORT-analyst-prose.pdf) — Analyst Prose, the Profiler house style<br>
&emsp;[`AIDC-MARKET-REPORT-equity-research.pdf`](AIDC-MARKET-REPORT-equity-research.pdf) — Sell-Side Research Note<br>
&emsp;[`AIDC-MARKET-REPORT-intel-briefing.pdf`](AIDC-MARKET-REPORT-intel-briefing.pdf) — Intelligence Community Briefing<br>
&emsp;[`AIDC-MARKET-REPORT-smart-brevity.pdf`](AIDC-MARKET-REPORT-smart-brevity.pdf) — Axios Smart Brevity

**📘 The 40 companies are in a separate companion —** this report carries the argument; [`AIDC-COVERAGE-UNIVERSE.md`](AIDC-COVERAGE-UNIVERSE.md) carries the coverage set, one entry per company with its position, evidence, falsifier and recommended strategy. The two are reissued on different clocks.

Every edition carries the report's figures and comparison tables. Typeset source: [`aidc-market-report-print.html`](aidc-market-report-print.html) — rebuild every edition with `node scripts/build-aidc-report-pdf.mjs`, or one with `--style <slug>`. This Markdown file remains the canonical text; the PDFs restate it with charts and tables, a single-column contents index on page 2, and every chapter opening a fresh page.

> **How to read this report.** This edition is written to **teach the market**, not to recite it. Each chapter opens by explaining what its subject is and why it matters, defines its terms in place, and closes with a passage titled *What this means for your capital*. **Chapter 2 is a primer** — if a term in a later chapter is unfamiliar, it is defined there. You do not need a power-systems background to read this.
>
> Facts cite their dossier source as *(Source label, date — Company dossier)*. Items marked **[Analysis]** are labeled inference, carrying (High)/(Moderate)/(Low) confidence tags where the dossier holds them, and are never blended with sourced fact. Explanations of physics, economics and mechanism carry no citation because they are teaching, not claims about a company. Field notes are not sources and none are cited here.

## 1. Key Judgments

This chapter is the whole report in miniature. Twelve judgments, each one a claim about how the US AI-data-center power market actually works, and each one carrying a confidence tag. Read this chapter and you will understand the mechanics of the sector; read the rest and you will see the evidence in full.

One note on reading it. This chapter moves at summary speed and uses the sector's shorthand as the sector uses it. **Every term left unexplained here is defined in section 2.6**, the vocabulary table in the next chapter — so if a line lands as jargon rather than argument, the definition is a page away rather than missing. Chapter 2 is the primer; this one is the verdict.

> **How to weight a confidence tag**
>
> Every judgment below carries **(High)** or **(Moderate)**. The tag is not a measure of how important the judgment is. It is a measure of how much of it rests on things that have already happened versus things that still have to happen.
>
> A **(High)** judgment is one where the mechanism is structural and several independent parties have already acted on it — money has moved, contracts are signed, order books have printed. These are the judgments you can build a position around, because breaking them requires a change in the physical or contractual world, not merely a change in sentiment. A **(Moderate)** judgment is one that depends on a decision not yet taken, a single source, or a transition still in progress. These are the judgments you monitor rather than underwrite: they tell you where to look, and roughly when to look.
>
> A third distinction runs through the whole report. Sourced facts carry a citation to a company dossier. Inferences carry the **[Analysis]** marker and their own confidence tag, and are never blended into fact. When an **[Analysis]** item and a sourced number sit in the same sentence, the number is the evidence and the analysis is the reading of it. You are entitled to accept one and reject the other.

| | |
|---|---|
| **12** | Key judgments, each confidence-tagged |
| **10** | Rated High confidence |
| **2** | Rated Moderate confidence |
| **≈$735–760B** | Big-four 2026 capex behind the pipeline |

### 1.1 Power, not capital or chips, is what this buildout is short of *(High — report synthesis; the underlying Equinix dossier read is tagged Moderate)*

The thing standing between an AI company's money and a working data center is an energized electrical connection. The evidence is a market that has stopped clearing on price. Northern Virginia, the world's largest data-center market, ran **0.3% vacancy**; Amsterdam imposed a moratorium above 70 MW; Singapore rations capacity releases; and a record **≈$130B** of US projects sat blocked or delayed in Q1 2026. **[Analysis — Moderate]** *(Equinix dossier)* When a market cannot clear on price, buyers stop bidding for the product and start bidding for the *schedule*. That is exactly what the supply side's order books show: **GE Vernova**'s data-center electrification orders ran ≈$0.7B (2024) → >$2B (2025) → >$5B in 1H 2026 alone *(Q2 2026 press release, 2026-07-22 — GE Vernova dossier)*; **ABB** posted its first-ever $7B+ Electrification quarter, up 60% *(Q2 2026 release, 2026-07-16 — ABB dossier)*; **Vertiv**'s backlog hit $15.0B, up 109%, on ≈2.9x book-to-bill *(FY2025 8-K, 2026-02-11 — Vertiv dossier)*.

What follows for capital: value accrues to whoever shortens the interval between a signed lease and a live megawatt. Not to the cheapest component — to the earliest one. Every figure below is a price on time.

**Figure 1: How long each route to power takes (months; quoted market lead times and supplier build claims — scopes differ)**

| Route to power | Elapsed time | Note |
|---|---|---|
| Grid interconnection queue | 4–8 years | The baseline everything is measured against |
| Power transformer, no reservation | 30–48 months | 30–40 months quoted; up to 4 years unreserved |
| HV/EHV circuit breakers | ≈125 weeks | The third choke point |
| Wärtsilä engine plant | ≈12 months | Large plants operational in 12 months |
| Bloom fuel cells at Oracle | 55 days | Beat its own 90-day commitment |
| Tesla Megablock, 1 GWh | ≈20 business days | Factory-integrated storage block |

*Source: FlexGen solutions page — FlexGen dossier (queue); Nikkei Asia, 2024-05 — Hitachi Energy dossier (transformers); Quanta Q2 2026 release, 2026-07-30 — Quanta dossier (breakers); Wärtsilä product pages — Wärtsilä dossier; Bloom dossier, 2026-01-15; ESS News, 2025-09-09 — Tesla dossier. Scopes deliberately differ: the top three rows are waits for a connection or a component, the bottom three are supplier-claimed durations to build a plant or install a block. The contrast between the two groups is the arbitrage this entire market runs on.*

**What would break it:** Northern Virginia vacancy loosening materially, the blocked-and-delayed project figure falling for two consecutive quarters, and book-to-bill at the electrical OEMs slipping below 1.0. Order books move before earnings do, so this would be visible within one or two reporting cycles.

### 1.2 Demand is enormous, substantially pre-sold, and circularly financed *(High)*

Two things are true at once, and holding both is the whole discipline here. First, the demand is real and contracted. **Microsoft**'s commercial remaining performance obligation — the revenue it has signed but not yet delivered — stands at **$678B, up 84%**, growing faster than its ≈$190B calendar-2026 capex plan *(CNBC Q3 FY2026, 2026-04-29; FY2026 Q4 results, 2026-07-29 — Microsoft dossier)*. A backlog growing faster than the spend to serve it means the buildout is substantially pre-sold, not speculative. **[Analysis — High]** *(Microsoft dossier)*

Second, the financing loops back on itself. **NVIDIA** invests up to $100B as **OpenAI** deploys NVIDIA systems; **Amazon** invests $50B while selling $138B of cloud; **Oracle** borrows against OpenAI receivables; Microsoft's $4.1B quarterly equity-method losses imply ≈$11.5B quarterly OpenAI losses. **[Analysis — High]** *(OpenAI dossier)* Credit markets are pricing the risk down anyway: **CoreWeave**'s GPU-backed borrowing went from a ≈15% coupon in 2023 to investment-grade pricing — the Secured Overnight Financing Rate (SOFR, the floating benchmark US lending rate) plus 225 basis points — on an $8.5B facility in 2026 *(globaldatacenterhub, 2026-03-15 — CoreWeave dossier)*.

For capital: the near-term cash flows are underwritten by contract, so exposure to the buildout is not a bet on AI adoption in 2026. It is a bet on the counterparty chain holding.

**What would break it:** a single quarter in which any of the big four cuts capex guidance rather than raising it, or order intake at the electrical OEMs decelerating while backlog holds — the classic sign that the queue is being worked down rather than refilled.

### 1.3 Scarcity in turbines and transformers is now sold as a product *(High)*

A gas turbine or a large power transformer is not something you buy off a shelf. There are a handful of factories in the world, and the wait is now long enough that the *place in line* has become the thing being sold. **GE Vernova** holds 116 GW of committed gas capacity — 53 GW of equipment backlog plus **63 GW of deposit-backed slot reservations** now selling against 2031 delivery *(Turbomachinery Magazine, 2026-07 — GE Vernova dossier)*. Those reservations price **10–20 points above** the existing backlog, taken with ≈20% cash down *(December 2025 Investor Update transcript, 2025-12-09 — GE Vernova dossier)*. At **Siemens Energy**, slot-reservation fees are back for the first time since the early-2000s gas boom *(POWER Magazine, 2025-02 — Siemens Energy dossier)*. Transformers are tighter and last longer: **Hitachi Energy** quotes 30–40 months, up to four years without a reservation *(Nikkei Asia, 2024-05 — Hitachi Energy dossier)*, against a modelled ≈30% US supply deficit and prices up 77% since 2019 *(Wood Mackenzie, 2025-02 — Hitachi Energy dossier)*.

For capital, the distinction that matters: this is scarcity rent, not a moat. **[Analysis — High]** Competing turbine supply lands in the same 2028–2030 windows GE Vernova is selling *(GE Vernova dossier)*. Transformers are the more defensible franchise because the deficit persists toward 2030.

**What would break it:** reservation premiums compressing back toward backlog pricing, or a major OEM (original equipment manufacturer — the firm whose brand is on the finished machine) announcing capacity ahead of schedule. Watch the 2027–28 commissioning wave.

### 1.4 Behind-the-meter generation plus storage is the proven gigawatt architecture *(High)*

Behind-the-meter means the data center builds its own power plant on site and treats the utility grid as a supplement rather than the source. It exists to skip the interconnection queue, and it is no longer theoretical. **xAI**'s Colossus reached **≈1.0 GW of nameplate compute draw** by 31 March 2026, powered almost entirely by self-deployed behind-the-meter generation, with the filing confirming the campus can operate entirely off its own plant — buffered by more than 240 Megapacks, claimed as the world's largest such deployment *(SpaceX Form S-1, 2026-05-20 — xAI dossier)*. **Crusoe** turned the same architecture into a product: ≈1 GW of GE Vernova aeroderivative turbines, ≈750 MW of reciprocating engines, a **5 GW** commitment for medium-voltage battery "AI UPS" systems, and 12 GWh of 100-hour iron-air storage from 2027 *(Crusoe releases, 2026-07-21 / 2026-03-24 / 2026-06-03)*. **[Analysis — High]** Time-to-power execution is the genuine edge — 200+ MW energized within a year *(Crusoe dossier)*.

For capital: storage is not an optional line item in this architecture. Generation without a buffer cannot follow a GPU load. The campus bill of materials — generation, stabilization, medium-voltage storage — is the addressable market.

**What would break it:** a court or air regulator halting an operating behind-the-meter fleet, not merely fining it. The xAI Clean Air Act litigation is the test case.

### 1.5 The FERC precedent pushed nuclear front-of-meter, and out of this decade *(High)*

In November 2024 FERC rejected the Talen–Amazon arrangement that would have connected a data center directly to a nuclear plant behind the meter, and the rejection was upheld in April 2025. The principle established: you cannot take dedicated output from a grid-connected plant without paying your share of the grid's costs. Amazon's restructured front-of-meter power purchase agreement, ramping to 1,920 MW of Susquehanna through 2042, is the template everyone now copies *(Utility Dive, 2024-11; Talen release, 2025-06-11 — Amazon dossier)*. That decision has a price. Analyst estimates put the Microsoft–Crane restart at **≈$112/MWh** against ≈$70/MWh for existing output at Clinton *(Jefferies via Energy Connects, 2024-09; Utility Dive, 2025-06 — Constellation dossier)* — a premium band **Constellation** now collects. **[Analysis — High]** *(Constellation dossier)* And nearly all contracted nuclear, including **Meta**'s ≈7.7 GW, delivers 2027 through the 2030s *(Meta, 2026-01-09 / 2025-06-03)*.

For capital: nothing nuclear firms AI load at scale this decade. The gas-plus-storage bridge owns 2026–2030 by default, and firming demand is pushed to grid-side assets, storage included. **[Analysis — Moderate]** *(Amazon dossier)*

**What would break it:** PJM's FERC-ordered co-location rules landing permissive enough to revive behind-the-meter nuclear economics, or a small modular reactor reaching commercial operation materially before 2029.

### 1.6 800 VDC is a vendor-list reset running on a published clock *(High)*

Data centers have always distributed power as alternating current and converted it to direct current at the rack. **NVIDIA** is moving the conversion upstream: distribute 800-volt direct current instead. The reason is copper. NVIDIA's published case is **≈157% more power through the same conductor** versus 415 VAC, up to 45% less copper — a legacy 1 MW rack can carry 200 kg of busbar — up to 5 points of end-to-end efficiency, and 30% lower total cost *(NVIDIA whitepaper, 2025-10-13)*. The clock is fixed: first shipments 3Q26, Kyber racks at ≈600 kW each in 2H 2027 *(TrendForce, 2026-06-15 — NVIDIA/Delta dossiers)*.

Architecture changes are when market share moves, because every component must be requalified. **Delta** is furthest ahead — first-qualified across GB200/GB300 shelf sets, with AI data-center power and cooling crossing 50% of revenue *(Q2 results, 2026-07-29 — Delta dossier)*. **ABB** owns the medium-voltage layer. **[Analysis — Moderate]** No AC incumbent has named a shipping 800 VDC switchboard, and independent analysis expects 800 VDC to *contract* the centralized UPS market while creating ≈$11B power-rack and ≈$13B solid-state-transformer markets *(Vertiv/Eaton dossiers)*.

For capital: the architecture makes rack-level storage mandatory content, not an upsell — an AI-server backup-battery market estimated at ≈$2.8B in 2026 rising to ≈$7.1B by 2033. **[Analysis — Moderate]** *(TrendForce — NVIDIA dossier)*

**What would break it:** Kyber slipping past 2027, or an AC incumbent shipping a certified 800 VDC switchboard and reclaiming the socket.

### 1.7 The battery-storage league table reset in 2025–26 *(High)*

An integrator is the company that turns cells into a deliverable grid asset — enclosure, cooling, power conversion, controls, warranty. The ranking of those firms just changed hands. Wood Mackenzie's inaugural comprehensive integrator ranking put **Sungrow** first — the first vendor ever to hold both the storage-integrator and PV-inverter (photovoltaic — solar) crowns, and the first to take the integrator title from **Tesla** — with Tesla second, **CATL** third, **BYD** fourth, and Chinese integrators holding **≈76%** of the market *(ESS News, 2026-07-14 — Sungrow/Tesla/Fluence/Wärtsilä dossiers)*. The market they are fighting over flipped from oversupply to tightness: annual installs crossed 100 GW and the storage cell market grew **94.6% to 612 GWh** *(InfoLink via ESS News, 2026-02-09 — Hithium/EVE dossiers)*.

Tightness restored pricing power, and storage became the profit engine rather than the growth story. Sungrow's storage segment overtook inverters at 41.8% of revenue on 36.5% gross margin **[Analysis — High]** *(Sungrow dossier)*; CATL's storage line reached RMB 53.26B in H1 2026, up 87.5% *(Energy-Storage.News, 2026-07 — CATL dossier)*.

For capital: margin in storage is now available to scale leaders, which was not true during the glut. Rankings are scope-dependent, so treat any single crown with care.

**What would break it:** cell prices falling again on new capacity, or gross margins at the leaders compressing two quarters running.

### 1.8 The compliance wall is the compliant lane's pricing umbrella *(High)*

A stack of US rules now determines who is even allowed to bid. Tariffs on Chinese battery imports step from 7% to **26%** in 2026 *(ESS News, 2025-06-06 — Hithium dossier)*; CATL sits on the Department of Defense 1260H list with procurement bars phasing in from June 2026 and a full bar in October 2027 *(CnEVPost, 2026-07-24; electrive, 2026-06-18 — CATL dossier)*. Foreign-entity-of-concern rules attach to the tax credits that make projects pencil, so non-compliance is not a tariff — it is disqualification.

The compliant lane is converting that into share fast. **LGES** carries a 140 GWh storage backlog, won a $4.3B Tesla cell award, and grew H1 2026 storage shipments 357% with ≈86% into North America. **[Analysis — High]** Its durable advantage is regulatory rather than technical *(LGES dossier)*. **Samsung SDI** starts US LFP cell production — lithium iron phosphate, the cheaper and more thermally tolerant of the two dominant lithium chemistries — in October 2026 **[Analysis — Moderate]** *(Samsung SDI dossier)*; **Panasonic** targets ¥800B of data-center storage revenue by FY2029 *(Panasonic, 2026-03-25 / 2026-06-08)*. Chinese leaders route around the wall through licensing, offshore cells and minority stakes — the CATL–Ford BlueOval structure is the template.

> **Correction — what the FCC inverter action actually does**
>
> Earlier editions of this report described the FCC inverter action as a pending, draft, China-specific rule. That is stale and wrong, and is corrected here. On **28 July 2026** the FCC added foreign-produced connected power inverters to its Covered List, effective immediately. A Covered-List product cannot receive FCC equipment authorization, and without authorization it cannot be imported, marketed or sold in the US. Three mechanics matter.
>
> **It is an origin test, not a nationality test.** "Foreign-produced" means failing the Buy American domestic-end-product test: US manufacture with domestic component cost above 65% through 2028, rising to 75% in 2029. An American brand manufacturing offshore is caught. Delta and LITEON are foreign-produced too.
>
> **It is a two-prong test, and both prongs must be met.** First, the device must be bi-directional, converting DC to AC or AC to DC — microinverters, string inverters, central inverters and hybrid or battery-based inverters are enumerated. Second, it must have connectivity enabling remote communication, control or monitoring by Wi-Fi, cellular, Bluetooth or a similar connection. The stated rationale is remote firmware push by a foreign adversary, and equipment lacking remote control, or using air-gapped external control, is reported to fall outside.
>
> **It is prospective only.** Models authorized before 28 July keep authorization and may still be imported and sold. This is a new-authorization freeze, not a market withdrawal. A conditional-approval path runs through the Department of War or DHS, with applications open to 1 January 2028, requiring ownership disclosure, a full bill of materials and supply-chain map, and a time-bound US onshoring plan. No review timeline has been published.
>
> **Read across to this sector.** Storage power-conversion systems, hybrid and battery-based inverters, and EV-charging equipment are inside the scope. A unidirectional AC-DC server power supply or power shelf managed over wires — PMBus, IPMI, Redfish or SNMP over Ethernet — falls outside on a plain reading, and a direct-current battery block shipped without a conversion system also falls outside because no inverter is in the scope of supply. **[Analysis — Moderate]** Any read of a named company's exposure is inference, not a published ruling on that company.

For capital: regulation is functioning as a price floor for the compliant. Domestic content, UL large-scale fire certification and cybersecurity attestation are qualifying criteria now, not differentiators — which means they protect margin rather than winning deals.

**What would break it:** a tariff rollback or FEOC relaxation, a conditional FCC approval granted to a foreign-produced inverter maker, or the compliant lane's margins failing to expand despite the protection — the tell that the umbrella is being competed away from inside.

### 1.9 Storage demand arrives through four separate doors *(High)*

There is no single "data-center storage" buyer. There are four, with different decision-makers, sales cycles and specifications. **Utility-scale** storage is bought by developers and independent power producers, not by the hyperscaler — **Amazon**'s equipment decisions sit with counterparties like AES and Primergy. **[Analysis]** *(Amazon dossier)* **Campus medium-voltage storage** is bought by energy-first developers and colocation operators — Crusoe's 5 GW commitment is the archetype. **UPS replacement** is sold alongside electrical contractors, as in the Rosendin–FlexGen medium-voltage battery UPS. **Rack-level backup** — roughly five battery modules and over 300 supercapacitors per GB300 cabinet — is sold through NVIDIA's ODM chain.

The hyperscalers split accordingly. **Google** is the most storage-forward: it bought Intersect Power for ≈$4.75B to own solar-plus-storage outright and anchored 300 MW / **30 GWh** of iron-air storage *(PV Tech, 2026-03; Google, 2026-02-24 — Google dossier)*. **Microsoft** runs Fairwater Atlanta with no on-site generators or UPS at all — it structurally buys grid instead of batteries. **[Analysis — High]** *(Microsoft dossier, 2025-11-12)* **Fluence** proves the channel is contracted, carrying ≈$850M of data-center orders plus master supply agreements with two hyperscalers. **[Analysis — High]** *(Fluence dossier; Q3 FY2026, 2026-08-05)*

For capital: a vendor's addressable market depends entirely on which doors it can reach. Rack-level and campus exposure are separate businesses from utility-scale.

**What would break it:** a hyperscaler beginning to procure batteries directly at scale, collapsing the four doors into one.

### 1.10 Craft labor is the scarcest input, and prefabrication is the answer *(High)*

The binding physical constraint on installing all this equipment is not steel or silicon. It is licensed electricians, and you cannot import them or print them. **Quanta Services**, the largest US electrical contractor at $13.5B of electrical revenue — roughly 3.7x the number two — employs 50,000+ craft workers, self-performs over 80% of its work, runs a 2,300-acre lineman college and spends ≈$250M a year on training. Its chief executive's rule: **it takes about four years to make a craftsman** *(EC&M 2025 Top 50, 2025-06; 2026 Investor Day, 2026-03-31 — Quanta dossier)*. Management prices craft-led data-center spend at ≈**$13.5M per MW**, and guides its technology and load-centre end market to grow 220–240% in 2026 *(Investor Day + Q2 2026 call, 2026-07-30)*.

A four-year training cycle cannot flex to a two-year demand shock, so the industry moves labor into factories. **Eaton** bought Fibrebond for $1.45B to sell power enclosures built and tested off-site *(release, 2025-04-01)*; **Vertiv**'s SmartRun installs at ≈1 MW per day; **Tesla**'s Megablock claims 1 GWh deployable in ≈20 business days *(ESS News, 2025-09-09)*.

For capital: the competitive unit has shifted from component price to installed-megawatt lead time. Labor content per megawatt-hour is a specification.

**What would break it:** contractor headcount growth outpacing revenue growth, or field labor rates flattening — either would mean the constraint is loosening.

### 1.11 Displacement windows are open through 2026 *(Moderate)*

Market share moves most easily when an incumbent is distracted, absent or between owners. Three such windows are open now. **Wärtsilä** is folding its storage business, with a EUR 719M order book, into a 50/50 joint venture after a 60% order collapse — **[Analysis — High]** a managed retreat, and **[Analysis — Moderate]** the counterparty transition around the ≈Q3 2026 closing is a live opening for rivals *(Wärtsilä dossier)*. **Powin**'s Chapter 11 orphaned more than 25 GWh of installed fleet, and **FlexGen** bought its software and hardware intellectual property for $36M to capture the service base **[Analysis — High]** *(ESS News, 2025-06-11; FlexGen dossier)*. And the AC incumbents' 800 VDC gap is demonstrable: **Schneider**'s 800 VDC sidecar still has no commercial date *(2025-10-13)*. Meanwhile relief for the grid bottleneck is itself late — Hitachi's flagship US transformer plant is not operational until **2028** *(Hitachi Energy release, 2025-09-04)*.

For capital: this judgment is tagged Moderate because it depends on execution by challengers, not on a structural fact. The gap years are the window; they close as the 2027–28 capacity wave lands.

**What would break it:** the Wärtsilä joint venture retaining its order book cleanly through close, or an incumbent announcing a shipping 800 VDC switchboard before Kyber.

### 1.12 The risk stack should be monitored on a calendar, not a hunch *(Moderate)*

Five risks could shrink this market, and each has an observable date rather than a vibe. **Circular financing** is the demand-side fragility **[Analysis — High]** *(OpenAI dossier)*. **Backlog duration**: only ≈20% of the 307 GW US data-center pipeline converts near-term, the bulk landing 2028 or later, so a capex pause concentrates in exactly the constrained resources this report covers **[Analysis — Moderate]** *(Eaton dossier)*. **Political and ratepayer backlash**: three PJM capacity auctions cleared at the cap and a 13-governor affordability coalition has formed, with legislated clawback a live scenario **[Analysis — Moderate]** *(Constellation dossier)*; Meta's Louisiana docket is the bellwether. **Permitting litigation**: the xAI Clean Air Act suit carries a $399M self-recorded accrual *(CNBC, 2026-04-14)*. **Scarcity-rent normalization**: ≈$1.8B of announced US transformer investment all lands 2027–28 **[Analysis — Moderate]** *(Hitachi Energy dossier)*. One earlier framing is superseded: the FCC inverter action is not a possible future extension to storage electronics — storage conversion systems and battery-based inverters are already inside its scope as of 28 July 2026 *(section 1.8)*.

For capital: each of these is datable, and order books turn before earnings do.

**What would break it:** the risks proving uncorrelated — a PJM clawback or a permitting loss occurring without any order-book deceleration would mean the transmission channel is weaker than assumed.

### What this means for your capital

Three structural conclusions carry across all twelve judgments. **First, time is the priced commodity, not power.** Figure 1 is the investment case in one image: the gap between a four-to-eight-year interconnection wait and a 55-day fuel-cell or 20-day storage-block install is the margin pool this sector is competing for. Ask of any company in it: does this compress a schedule, or does it merely supply a part?

**Second, two clocks are running in opposite directions.** Scarcity rents in turbines and transformers are a 2026–2028 phenomenon that the announced 2027–28 capacity wave will erode — durable in transformers, less so in turbines. The 800 VDC requalification, by contrast, is a one-time reset whose winners are being chosen now, inside NVIDIA reference designs, and whose positions will be hard to dislodge once Kyber ships. Rent decays; a socket persists.

**Third, regulation is a margin instrument in this cycle.** Tariffs, 1260H, FEOC and now the FCC Covered List determine who may bid before price is discussed. The compliant lane's advantage is real but is a floor, not a differentiator — it protects margin rather than winning share, and it is exactly as durable as the policy behind it.

What to monitor, on this timetable: **order intake and book-to-bill** at the electrical OEMs each quarter, because that is where a demand pause appears first; **reservation premiums** on turbine and transformer slots, as the tell on scarcity-rent decay; **the 3Q26 first 800 VDC shipments and 2027 Kyber racks**, as the qualification scoreboard; and the near-dated regulatory dates — **StarPlus US LFP production in October 2026**, the **full 1260H procurement bar in October 2027**, and the **1 January 2028** close of the FCC conditional-approval window.

*This chapter is analysis for understanding a sector. It is framing, not advice, and nothing in it is a recommendation to buy or sell any security.*

## 2. A Primer on AI Data-Center Power

Every company in this report sells one of two things: a piece of the electrical path between a power plant and a silicon die, or a way to make that path arrive sooner. This chapter explains the path. It is deliberately unglamorous — the physics has not changed since Edison — but the AI buildout has pushed each stage of it into a regime it was never designed for, and that dislocation is where the money is. Read this chapter once and the rest of the report becomes a set of specific bets on specific links in a chain you already understand.

Nothing below assumes prior knowledge of electrical engineering, and nothing below is simplified to the point of being wrong. The order is deliberate: what the load actually looks like (2.1), the chain of equipment it travels through (2.2), the single piece of physics that governs that chain (2.3), the three separate storage businesses hanging off it (2.4), where the power comes from in the first place (2.5), and the vocabulary you will meet everywhere else (2.6). If you read one chapter of this report before the rest, read this one — every later chapter assumes it.

### 2.1 What an AI data center actually consumes

A conventional data center is a building full of servers doing unrelated work for unrelated customers. One machine serves a web page, another runs a database query, a third sits idle. Because thousands of independent tasks average out, the building's electrical draw is smooth and predictable. Facility engineers size the equipment for a peak they will rarely see, and the grid barely notices the building exists.

An AI training cluster is the opposite of that. It is not thousands of independent computers; it is one computer that happens to be spread across thousands of chips. Every GPU works on the same model, in lockstep, in a repeating cycle: compute for a moment, then stop computing and exchange results with every other GPU, then compute again. During the compute phase, the chips draw close to their maximum. During the communication phase, they wait on the network — and their draw collapses. Then it comes back. This happens continuously, all day, in step, across the entire building.

Two consequences follow, and together they explain most of this report.

**First, density.** Because the chips must talk to each other constantly, they have to sit physically close together — network latency is the reason a modern AI rack is a single dense block rather than a spread-out room. NVIDIA's own published rack trajectory is the industry's forcing function: roughly 120–150 kW per rack for today's GB300 class, and more than 200 kW at the top of NVIDIA's own current framing, roughly 600 kW per rack when Kyber-class systems arrive in 2H 2027, and a stated architectural target of "1 MW IT racks and beyond" in the Feynman generation *(NVIDIA dossier; Tom's Hardware GTC record, 2025-03-18 — NVIDIA dossier)*. A megawatt inside one cabinet is a step change, not an increment. It changes how the power gets there, how it is cooled, and who is qualified to supply it.

**Figure 2: The forcing function — NVIDIA rack power trajectory (kW per rack, company-stated)**

| Generation | Note | Power per rack |
|---|---|---|
| Today | GB300-class, air/liquid | >200 kW |
| Kyber | Rubin Ultra NVL576, 2H 2027 | ≈600 kW |
| Feynman | Kyber NVL1152, announced | 1 MW-class |

*Source: NVIDIA dossier (rack roadmap); Tom's Hardware GTC record, 2025-03-18 — NVIDIA dossier. The point is not the absolute numbers but the slope: a roughly fivefold rise in the power delivered to a single cabinet inside about three product generations.*

**Second, volatility.** The compute-then-communicate cycle means an AI campus presents the grid with a load that swings hard and fast, in unison. Hitachi Energy's chief executive has been the loudest voice on this since January 2025, warning that AI training loads spike "up to 10 times" normal draw; August 2026 Bloomberg reporting says volatile AI demand is physically damaging data-center equipment *(Hitachi Energy dossier, 2025-01 / 2026-08-06)*. This is not a theoretical concern that vendors invented to sell conditioning gear. Eaton shipped market-first detection of subsynchronous oscillations *caused by AI GPU load bursting* and pushed it to its installed base by firmware update *(release, 2025-09-09 — Eaton dossier)*. NVIDIA now builds the countermeasure into the product: GB300 NVL72 racks carry roughly 65 joules of stored energy per GPU in their power shelves, plus ramp control and a "GPU burn" idle-floor technique, together cutting peak grid demand by up to 30% *(NVIDIA blog, 2025-10 — NVIDIA dossier)*.

It is worth making that swing concrete, because the abstraction hides its size. Take a 336 MW-IT building — the scale Crusoe describes for its Microsoft Campus 2 *(Crusoe release, 2026-03-27 — Crusoe dossier)*. Suppose its draw moves by only a third as the GPUs cycle between computing and communicating. That is a swing of roughly 110 MW, appearing and disappearing in under a second, repeatedly, all day. A hundred megawatts is the output of a mid-sized power plant. The equipment upstream does not experience that as a data center; it experiences it as a power station switching on and off continuously — which is precisely the duty cycle none of it was designed for.

> **Why volatility costs money.** A steady load is cheap to serve. A swinging load is expensive three times over. It forces the upstream equipment — transformers, breakers, generators — to be sized for the peak while earning revenue on the average. It mechanically and thermally fatigues that equipment, shortening its life. And on a grid, it makes the local utility's job of holding frequency and voltage harder, which is why utilities increasingly want AI load to arrive pre-smoothed. Everything sold as "stabilization" — flywheels, grid-forming batteries, supercapacitors, power-shelf energy storage — exists to convert a violent load into a polite one before it reaches equipment that would otherwise have to be over-built.

### 2.2 The chain from grid to chip

Electricity arrives at a data center as very high-voltage alternating current and must reach a chip as very low-voltage direct current. Between those two points sit six or seven distinct pieces of equipment, each made by different companies with different economics. Nearly every name in this report occupies one link. Here is the chain in order.

1. **Transmission.** The high-voltage lines that move bulk power from generation to the region. Owned by utilities and transmission operators, not by the data center. If it is missing, nothing else matters — no amount of on-site equipment substitutes for bulk power that cannot physically get to the county.
2. **Substation and transformer.** The transformer steps voltage down — typically from transmission level to a medium-voltage distribution level, then again to the low voltage equipment can use. Transformers are the least glamorous and most binding item in the whole chain. Without one, high-voltage power exists at the fence and is unusable inside it.
3. **Switchgear and circuit breakers.** The switching and protection layer. Breakers interrupt fault current before it destroys equipment or starts a fire; switchgear lets operators isolate and reroute sections. Without protection, the site is uninsurable and, in most jurisdictions, unpermittable — this equipment is not optional trim.
4. **UPS — uninterruptible power supply.** A store of energy plus fast electronics that carries the load through the seconds between a grid disturbance and a generator starting, and that cleans up voltage sags and surges continuously. Without it, a momentary grid dip becomes a crashed training run.
5. **Distribution.** Busway, panels and remote power panels that carry power across the white space and into rows and racks. Unremarkable until density rises, at which point it becomes a copper-tonnage problem *(see 2.3)*.
6. **Power shelf and PSU.** Inside the rack. The power supply unit converts the facility's alternating current into the direct current the servers actually use; a power shelf is a rack-mounted assembly of those units serving the whole cabinet. Delta ships 18.5 kW PSUs at 98% efficiency; Megmeet and LITEON have both moved to 110 kW liquid-cooled shelves for GB300 and Vera Rubin-class racks *(800 VDC deep-dive, 2026-05-28 — Delta dossier; Megmeet MGX support, 2026-05-29 — Megmeet dossier; LITEON Computex 2026, 2026-06-02 — LITEON dossier)*. This is the layer where a 2% efficiency difference is worth an argument, because the loss becomes heat that must then be removed.
7. **Point of load.** The last converters on the board, dropping to the roughly one volt a processor runs on, inches from the die. Not a market this report covers, but it sets the boundary condition everything upstream must meet.

**The same chain, walked once with numbers on it.** Exact voltages vary by site, but the shape does not. Power leaves a transmission line at something like 138,000 volts. A substation transformer steps it down to a medium-voltage distribution level — commonly 13,800 volts. Switchgear protects and routes it. A second transformer drops it again to the 415 or 480 volts conventional building equipment uses. A UPS sits in that path, conditioning it continuously. Busway carries it across the floor to the rack. Inside the rack, a power shelf converts alternating current to direct current — at 54 volts in the legacy design, or 800 in the new one. A final converter on the board drops it to roughly one volt, inches from the die. That is seven stages, from 138,000 volts to one, each losing a few percent as heat, and each one a box that some company in this report sells.

Two features of this chain matter more than any individual box. It is **serial** — the slowest link sets the energization date, so a developer with turbines on order and no transformer has no data center. And it is **bought from different industries** — heavy electrical equipment on multi-year lead times at one end, consumer-electronics-cadence power supplies at the other. That mismatch in industrial tempo is the origin of the schedule problem the whole sector now monetizes *(the scarcity chapter)*.

### 2.3 Why voltage is the whole game

This is the one piece of physics worth genuinely internalizing, because the 800 VDC transition later in this report is unintelligible without it.

Electrical power is voltage multiplied by current: **watts = volts × amps**. So there are many ways to deliver a megawatt. You can push a small current at high voltage, or a large current at low voltage. Arithmetically they are the same megawatt. Physically they are not remotely the same engineering problem, because the energy wasted as heat in a conductor scales with the **square** of the current, not with the power. Double the voltage at constant power and the current halves; halve the current and the loss falls to a quarter of what it was.

> **The square law, in one line.** Loss in a wire = current² × resistance. Deliver the same power at twice the voltage and you need half the current, so you waste one quarter of the heat — or, equivalently, you can use much thinner and cheaper copper for the same loss. Conversely, holding voltage flat while power per rack rises fivefold means current rises fivefold and losses rise twenty-five fold. That is not an engineering inconvenience; it is a wall. High-density racks force the voltage up. There is no third option.

**The same idea, with numbers in it.** Deliver one megawatt at 400 volts and you need 2,500 amps. Deliver that same megawatt at 800 volts and you need 1,250. Halving the current quarters the heat lost in the conductor — or, put the other way, lets you carry the same power through substantially less copper for the same loss. Now run the arithmetic in the direction the industry is actually moving: hold voltage flat and take a rack from 200 kW to 1 MW, the trajectory in figure 2. Current rises fivefold. Losses rise twenty-fivefold. That is why nobody in this industry is debating *whether* to raise the voltage. The arithmetic removed the choice; the only open questions are when, and whose equipment is on the other side of it.

NVIDIA's published numbers put the wall in commercial terms. Moving facility distribution to 800 volts direct current pushes roughly 157% more power through the same copper than the legacy 415 VAC design, cuts copper use by up to 45% — a legacy 1 MW rack carries up to 200 kg of busbar — and delivers up to 5% better end-to-end efficiency and about 30% lower total cost of ownership *(NVIDIA whitepaper, 2025-10-13 — NVIDIA dossier)*. The architecture goes from grid at 13.8 kV AC, to 800 VDC distribution, to a single-stage conversion to 12 VDC at the compute node — replacing 415/480 VAC three-phase distribution plus a separate in-rack 54 V conversion stage *(NVIDIA dossier)*.

Note the second mechanism hiding in that sentence: **stage elimination**. Every conversion between AC and DC, or between voltage levels, loses a few percent and requires a box that costs money, occupies floor space and can fail. Going direct-current end to end removes conversions. That is why a solid-state transformer — a power-electronic device that takes medium-voltage AC straight to 800 VDC in one step, which Delta publishes at 98.5% efficiency and Megmeet at above 98.5% *(800 VDC deep-dive, 2026-05-28 — Delta dossier; Megmeet dossier)* — is strategically interesting out of proportion to its unit price. It does not merely improve a stage. It deletes stages, and with them the vendors who supplied them.

### 2.4 What storage does here — and why it is three different businesses

"Energy storage" in this sector is not one product. It is at least three, addressing three different problems on three different timescales, sold by different companies through different channels at different price points. An investor who treats them as one theme will misread the entire storage sector, so it is worth being precise.

The distinction that matters is **power versus energy**. Some jobs need a large amount of power for a very short time — a hard shove. Others need a modest amount of power for a long time — endurance. A device optimized for one is bad and expensive at the other. NVIDIA prescribes the split explicitly in its own architecture: supercapacitors at the rack for millisecond GPU transients, and facility-level batteries at the utility interconnection for second-to-minute smoothing *(NVIDIA whitepaper, 2025-10-13 — NVIDIA dossier)*. The market has added a third tier above both.

A useful way to hold the distinction before reading the table: **power is how hard you can push; energy is how long you can push for.** A sprinter and a marathon runner both run, and no amount of training turns one into the other. A supercapacitor rated in joules and a grid battery rated in megawatt-hours are both called storage, and they differ in exactly that way — which is why the companies selling them rarely compete.

| Timescale | The problem it solves | The product | Evidence from the coverage set |
|---|---|---|---|
| **Milliseconds** | The instantaneous current spike when thousands of GPUs resume computing together; voltage transients that upstream gear cannot follow | Supercapacitors and in-shelf energy storage. High power, almost no energy. Rated in joules, not kilowatt-hours | GB300 NVL72 stores ≈65 J/GPU in its power shelves, with ramp control cutting peak grid demand up to 30% *(NVIDIA blog, 2025-10 — NVIDIA dossier)*; each GB300 cabinet uses >300 supercapacitors, and supercap supply is a genuine bottleneck *(TrendForce — NVIDIA dossier)* |
| **Seconds to minutes** | Ride-through: carrying the load from the instant grid power fails until on-site generation is running, and keeping coolant pumps alive so hot chips do not cook | Battery backup units (BBUs) in the rack, and centralized UPS batteries. Moderate power, minutes of energy | LITEON ships a 12 kW / 2U BBU shelf good for 45 seconds at full power and a 22 kW / 3U 800 V supercapacitor shelf good for 60 seconds, with designs targeting two-minute ride-through explicitly to keep coolant flowing *(LITEON dossier)*; Delta embeds 480 kW of BBU inside a 660 kW in-row power rack *(800 VDC deep-dive, 2026-05-28 — Delta dossier)* |
| **Hours** | Energy shifting: buying power when it is cheap or plentiful and using it when it is not; firming solar and wind; deferring a grid upgrade; substituting for a peaking plant | Grid-scale BESS (battery energy storage system; this report also uses ESS, the same thing with the chemistry left unstated) — containerized lithium blocks plus a power conversion system. Modest power for its size, lots of energy. Rated in MWh and hours of duration | Tesla's Megapack 3 is a ≈5 MWh single-piece unit *(ESS News, 2025-09-09 — Tesla dossier)*; FlexGen positions four-hour utility-scale batteries as replacements for conventional UPS *(FlexGen solutions page — FlexGen dossier)* |
| **Days** | Multi-day resilience and seasonal shifting — the tier that lets a campus claim firm supply from intermittent generation | Long-duration storage on non-lithium chemistry, sold on cost per kilowatt-hour rather than power density | Google anchored 300 MW / 30 GWh of Form Energy iron-air storage via Xcel *(Google, 2026-02-24 — Google dossier)*; Crusoe contracted 12 GWh of Form Energy 100-hour iron-air from 2027 *(Crusoe release, 2026-03-24 — Crusoe dossier)* |

Read that table as four separate industries. The millisecond tier is a components business selling into NVIDIA's rack supply chain, where volumes are enormous, design cycles are short, and the customer is an ODM, not a utility. The seconds-to-minutes tier is where storage collides with the incumbent UPS franchise — the same electrical job, relocated from a room down the hall into the rack itself. The hours tier is a project business sold to developers and utilities, priced per kilowatt-hour, won on manufacturing cost and compliance. The days tier is barely a market yet and is being bought by hyperscalers as an option on future firmness. A company strong in one tells you nothing about its position in another. A grid-scale integrator and a rack-power ODM can both appear in the same "storage" screen and never once bid against each other.

### 2.5 Grid or build your own — the interconnection queue

Now the question that decides most AI campus economics: where does the power come from?

The default answer is the grid. To connect a large new load or a new generator to the grid, you file with the regional transmission operator and enter the **interconnection queue**. The queue exists for a legitimate engineering reason. Adding a gigawatt of load at a specific substation changes power flows across the whole network, so the operator must model whether existing lines and transformers can carry the result, identify the upgrades required, and decide who pays for them. Those studies are done in sequence and in clusters, and here is the mechanism that makes the wait so long: if a project ahead of you in the cluster withdraws, the flow assumptions change and the studies for everyone behind must be redone. Queues are therefore not simple lines that advance steadily; they are lines that periodically restart. Add the physical construction of whatever upgrades the study identifies — using transformers and breakers already on multi-year lead times — and years disappear.

The corpus quantifies the wait from several directions. FlexGen markets campus batteries against "4–8-year grid interconnection queues" *(FlexGen solutions page — FlexGen dossier)*. Bloom's entire commercial case rests on deployments of 55–90 days against interconnect waits of up to roughly seven years **[Analysis — High]** *(Bloom Energy dossier)*. Meanwhile the equipment itself is rationed: Hitachi Energy, the world's largest transformer maker, quotes 30–40 month waits and up to four years without a reservation agreement *(Nikkei Asia, 2024-05 — Hitachi Energy dossier)*; high-voltage breaker lead times of roughly 125 weeks are throttling load-center schedules *(Quanta Q2 2026 release, 2026-07-30 — Quanta dossier)*; and GE Vernova is now selling deposit-backed gas turbine slots against **2031** delivery *(Turbomachinery Magazine, 2026-07 — GE Vernova dossier)*.

| The wait | What it is |
|---|---|
| **4–8 yrs** | Grid interconnection queue, as marketed against by campus-storage vendors |
| **30–40 mo** | Transformer lead time at the largest maker; up to 4 years without a reservation |
| **≈125 wks** | High-voltage breaker lead times throttling load-center schedules |
| **2031** | Delivery year GE Vernova is now selling gas turbine slots against |

*Source: FlexGen solutions page — FlexGen dossier; Nikkei Asia, 2024-05 — Hitachi Energy dossier; Quanta Q2 2026 release, 2026-07-30 — Quanta dossier; Turbomachinery Magazine, 2026-07 — GE Vernova dossier.*

Against that, the alternative: build your own generation on your own land and connect the load directly to it, **behind the meter**. "Behind the meter" (BTM) simply means the electricity never crosses the utility's revenue meter — it is generated and consumed inside the fence. "Front of meter" (FOM) means it goes onto the grid first and is bought back under contract. The BTM route is not a clever financing trick; it is a decision to become a small power company. You now own fuel supply, emissions permits, mechanical maintenance, and the political and legal exposure that comes with running combustion plant near people. xAI's campus is the extreme demonstration of both halves: it reached roughly 1.0 GW of nameplate compute draw powered almost entirely by self-deployed behind-the-meter generation *(SpaceX Form S-1, 2026-05-20 — xAI dossier)*, and it also carries a federal Clean Air Act suit and a $399M self-recorded litigation accrual *(CNBC, 2026-04-14 — xAI dossier)*.

**Figure 3: Time-to-power by route**

| Route | Basis | Time |
|---|---|---|
| Mobile turbine installed | GE Vernova TM2500 | 11 days |
| Fuel-cell deployment | Bloom, for Oracle | 55 days |
| Fuel cells as bridge prime power | AEP framing | 6–9 months |
| Large engine plant operational | Wärtsilä | 12 months |
| Gas turbine prime power | AEP comparison basis | ≈3 years |
| Transformer, no reservation | Hitachi Energy | up to 4 years |
| Grid interconnection queue | as marketed against | 4–8 years |

*Source: GE Vernova gas-power pages — GE Vernova dossier; Bloom Energy dossier (55-day Oracle deployment; the 6–9 months versus ≈3 years AEP comparison is **[Analysis — High]**); Wärtsilä product pages — Wärtsilä dossier; Nikkei Asia, 2024-05 — Hitachi Energy dossier; FlexGen solutions page — FlexGen dossier. Note: the rows are not substitutes for one another — a mobile turbine buys weeks of bridge power, a transformer is a permanent requirement, and the queue is the thing all of the others exist to avoid.*

One legal fact bounds the BTM route and is worth carrying into the rest of the report. In November 2024 FERC rejected the Talen/Amazon interconnection agreement that would have co-located a data center behind the meter at an existing nuclear plant, and upheld the rejection in April 2025 *(Utility Dive, 2024-11 — Amazon dossier)*. The principle established is narrow but consequential: you cannot park a gigawatt of load behind an existing grid-connected generator and avoid paying for the transmission system you are still relying on. Amazon's restructured front-of-meter power purchase agreement became the template. Build genuinely new generation on your own site and BTM works; try to hide existing generation behind a meter and it does not.

### 2.6 The vocabulary you will meet

These terms appear in the rest of this report, on every earnings call in the sector, and in every vendor deck. Most are simple once stated plainly; several are routinely used to make a number sound firmer than it is.

| Term | What it means | Why it matters when you read a number |
|---|---|---|
| **GW vs GWh** | A gigawatt is a rate of power — how fast energy flows. A gigawatt-hour is a quantity of energy — a rate times a duration | The single most abused pair in the sector. Generation and data-center load are GW. Batteries have both: a GW rating (how hard it can push) and a GWh rating (how long it can push). "A 100 MW battery" tells you nothing about its endurance |
| **MW-IT vs facility MW** | MW-IT is the power delivered to computing equipment. Facility MW adds cooling, lighting, losses and everything else the building consumes | Facility MW is always the larger number. When a campus is described in gigawatts, check which. Crusoe's Microsoft Campus 2 is described as two 336 MW-IT buildings inside a 900 MW site *(Crusoe release, 2026-03-27 — Crusoe dossier)* |
| **PUE** | Power usage effectiveness — facility MW divided by MW-IT. A perfect building would be 1.0 | The efficiency scoreboard, and a direct claim on overhead. Huawei quotes a modular design down to 1.111 *(Huawei Digital Power dossier)*; Megmeet claims its solid-state transformer supports PUE below 1.1 *(Megmeet dossier)*. Lower PUE means more of the purchased megawatt does paid work |
| **RPO** | Remaining performance obligation — contracted revenue a company has not yet delivered. An accounting disclosure, not a forecast | Large RPO signals visibility, but says nothing about counterparty quality or timing. Oracle's $638B RPO is roughly half attributable in press reports to one customer contract starting 2027 **[Analysis — Moderate]** *(Oracle dossier)*. Always ask: from whom, and starting when |
| **Backlog** | Orders received and not yet converted to revenue. Definitions vary by company and are not comparable across them | Backlog can exclude enormous amounts of real work. Quanta's record $53.4B backlog excludes most of a ≈3 GW program and runs data-center work book-and-burn — booked and completed inside the same period, so it never sits in backlog long enough to be counted **[Analysis — High]** *(Quanta dossier)* |
| **Book-to-bill** | Orders booked in a period divided by revenue billed. Above 1.0 means the backlog is growing | The cleanest early indicator of a turn, in either direction. Vertiv's backlog reached $15.0B on ≈2.9x book-to-bill *(FY2025 8-K, 2026-02-11 — Vertiv dossier)*. A capex pause shows up here before it shows up in revenue |
| **ITC** | Investment tax credit — a US federal credit that offsets a percentage of a qualifying project's capital cost | It changes bids, not just returns. A credit that requires domestic content converts a compliance capability into a price advantage, which is the entire mechanism behind the onshoring race in storage |
| **FEOC** | Foreign entity of concern — eligibility rules that disqualify equipment with specified foreign ownership or supply-chain links from credits and some procurement | The pricing umbrella over the compliant lane. It is why LGES's own read is that its "durable advantage is regulatory, not technical" **[Analysis — High]** *(LGES dossier)* |
| **PPA** | Power purchase agreement — a long-term contract to buy electricity at an agreed price, usually from a specific plant | How hyperscalers buy firm power without owning generation. Price reveals scarcity: an estimated ≈$112/MWh for a nuclear restart versus ≈$70/MWh for existing output *(Jefferies via Energy Connects, 2024-09; Utility Dive, 2025-06 — Constellation dossier)* |
| **Take-or-pay** | A contract obliging the buyer to pay whether or not it takes delivery | Converts a buyer's intention into the seller's bankable cash flow — and moves demand risk onto the buyer. Equinix funds 100% of grid upgrades under a 20-year take-or-pay with its cooperative *(Equinix dossier, 2025-08-14 / 2026-08-06)* |
| **Colo** | Colocation — a landlord that leases powered, cooled space to tenants who bring their own servers | A distinct buyer with distinct economics: it sells space and power by the kilowatt, so power scarcity is its revenue ceiling. 0.3% Northern Virginia vacancy is a colo statistic *(Equinix dossier)* |
| **Hyperscaler** | The largest cloud and platform operators that build and run their own global fleets — in this report, Amazon, Microsoft, Google and Meta | They set volume, terms and specifications, and often buy through counterparties rather than directly. Knowing who actually signs is the difference between a real channel and a name on a slide |
| **Neocloud** | A newer, GPU-specialist cloud provider — CoreWeave, Crusoe, xAI's compute operation — renting AI capacity rather than general-purpose computing | The marginal buyer, and the fastest-moving one. Also the most leveraged and most concentrated: CoreWeave's $99.4B backlog grew 284% *(Q1 2026 results, 2026-05-07 — CoreWeave dossier)* while single-developer delays have moved its guidance **[Analysis — Moderate]** *(CoreWeave dossier)* |
| **ODM** | Original design manufacturer — a firm that designs and builds hardware that ships under someone else's brand or inside someone else's system | The rack-power tier is an ODM business: Delta, LITEON and Megmeet supply into NVIDIA's platform rather than selling to data centers. Qualification, not sales coverage, determines share |
| **BTM / FOM** | Behind the meter: generated and consumed inside the fence, never crossing the utility meter. Front of meter: sold onto the grid and bought back | Decides who bears grid cost, who needs permits, and who waits in the queue. FERC's Talen decision drew the line between them *(2.5)* |
| **MV / LV** | Medium voltage and low voltage — the distribution tier upstream of equipment versus the tier equipment actually uses | The competitive boundary in the electrical chain. Vendors strong at low voltage are not automatically credible at medium voltage, where the equipment is heavier, the certifications are harder and the installed bases are older |
| **UPS** | Uninterruptible power supply — stored energy plus fast electronics bridging a grid disturbance and conditioning power continuously | A large incumbent franchise now under architectural attack. Note that it is genuinely optional: Microsoft deliberately runs Fairwater Atlanta with no on-site generators or UPS, taking four-nines availability (99.99% uptime) at three-nines (99.9%) cost **[Analysis — High]** *(Microsoft dossier, 2025-11-12)* |
| **BBU** | Battery backup unit — a rack-mounted battery module providing seconds to a couple of minutes of ride-through, distributed instead of centralized | Moved from optional to standard between GPU generations, which turns it from an accessory into non-discretionary content **[Analysis — High]** *(LITEON dossier)*. Content that ships with every rack scales with GPU volume, not with construction cycles |
| **PCS** | Power conversion system — the inverter stage of a battery installation, converting between the battery's DC and the grid's AC and controlling how it behaves electrically | The brains of a battery, not a commodity box. "Grid-forming" PCS can set voltage and frequency itself rather than following the grid, which is what allows island operation and black start — and what makes a battery useful against millisecond AI swings *(FlexGen solutions page — FlexGen dossier)* |
| **SST** | Solid-state transformer — power electronics replacing a conventional iron-and-copper transformer, converting medium-voltage AC directly to 800 VDC in one stage | A stage-eliminating technology, therefore a vendor-list-changing one. GE Vernova holds a cost-share with a hyperscaler committed to buy 1,000 SSTs from 2027 if specification is met *(Dec 2025 investor update — GE Vernova dossier)* |
| **Ride-through** | The ability to keep operating through a brief power disturbance rather than shutting down | The specification that sizes rack-level storage. LITEON's designs target two minutes explicitly to keep coolant pumps running *(LITEON dossier)* — a reminder that in liquid-cooled racks, losing pumps is as dangerous as losing power |

> **A definitional trap worth knowing now: what counts as an "inverter."** An inverter converts direct current to alternating current; a rectifier does the reverse; a bi-directional device does both, which is what a battery needs. A server power supply, by contrast, is unidirectional — it only converts AC to DC. That distinction, normally a footnote, became a market-access rule. On 28 July 2026 the FCC added foreign-produced connected power inverters to its Covered List, effective immediately; Covered-List products cannot receive FCC equipment authorization, which bars importing, marketing or selling them in the US.
>
> Three mechanics matter. First, it is an **origin** test, not a China test: "foreign-produced" means failing the Buy American domestic-end-product standard — US manufacture with domestic component cost above 65% through 2028, rising to 75% in 2029 — so an American brand manufacturing offshore is caught, and Delta and LITEON are foreign-produced too. Second, it is a **two-prong** test and both prongs must be met: the device must be bi-directional, converting DC-AC or AC-DC, enumerated as microinverters, string inverters, central inverters and hybrid/battery-based inverters; *and* it must have connectivity enabling remote communication, control or monitoring by Wi-Fi, cellular, Bluetooth or similar. The stated rationale is remote firmware push by a foreign adversary; equipment lacking remote control, or using air-gapped external control architecture, is reported to fall outside. Third, it is **prospective only** — models authorized before 28 July keep their authorization and may still be imported and sold. This is a new-authorization freeze, not a market withdrawal. A conditional-approval path exists through the Department of War or DHS for applications to 1 January 2028, requiring ownership disclosure, a full bill of materials and supply-chain map, and a time-bound US onshoring plan; no review timeline has been published.
>
> **[Analysis — Moderate]** On a plain reading of that scope, a unidirectional AC-DC server power supply or power shelf managed over wired protocols such as PMBus or IPMI/Redfish/SNMP over Ethernet falls outside, and a battery block shipped without a PCS also falls outside because no inverter is in the scope of supply — while hybrid and battery-based inverters, storage PCS and EV-charging equipment sit inside. Treat any specific company's exposure as an analytical read of published scope, not as a ruling on that company.

### 2.7 What this means for your capital

Three structural facts from this primer should shape how you read every company in the coverage universe.

**One: the chain is serial, so the scarcest link prices the whole project.** A data center energizes when its last component arrives, which means the binding constraint — today a transformer, a breaker, a turbine slot, an interconnection study — captures economics far out of proportion to its share of the capital budget. That is why 30–40 month transformer lead times and 2031 turbine slots are not trivia: they are the reason developers pay premiums for anything that compresses schedule, and the reason reservation agreements have themselves become valuable. When you evaluate a supplier, ask which link it occupies and whether that link is currently the constraint. Suppliers at the binding link earn scarcity rent. Suppliers one link away earn normal margins on the same growth. Watch for the constraint moving — as announced capacity lands, the rent moves with it.

**Two: density forces voltage up, and rising voltage reshuffles vendor lists.** The square law is not negotiable. As power per rack climbs toward a megawatt, the architecture must go to higher voltage and to direct current, and each conversion stage that gets eliminated eliminates a supplier position with it. This is the mechanism to hold onto: the 800 VDC transition is not an efficiency upgrade that incumbents can adopt at leisure, it is a redrawing of which boxes exist. Companies whose revenue sits in stages the new architecture deletes face a content problem no volume growth fixes; companies supplying the replacement stages — solid-state transformers, high-power shelves, DC protection — face the opposite. The observable is qualification, which happens inside reference designs years before it shows up in revenue.

**Three: "storage" is four businesses, and conflating them is the most common analytical error in this sector.** Milliseconds is a component business scaling with GPU shipments through ODMs. Seconds-to-minutes is a direct attack on the incumbent UPS franchise, sold with the rack. Hours is a project business sold to developers and utilities, won on manufacturing cost and regulatory compliance. Days is an option on future firmness being bought by hyperscalers. They have different customers, different cycle lengths, different margin structures and different exposure to trade policy. When a company says storage is growing, establish which tier before deciding what that growth is worth — and be sceptical of any thesis that treats a win in one tier as evidence of strength in another.

#### WHAT WOULD CHANGE MY MIND

- **The serial-chain argument breaks** if lead times compress materially before the demand they gate. The observable is order books and quoted lead times at the constrained links — a transformer maker's backlog-to-revenue ratio falling, or reservation fees disappearing, would say scarcity rent is normalizing and that schedule-compression pricing is over.
- **The voltage argument breaks** if the rack-power trajectory stalls. If Kyber-class deployment slips materially or the industry finds that racks plateau well below a megawatt — through better cooling economics, accelerator efficiency gains, or a shift in workload mix from training toward inference with a gentler load shape — the urgency behind 800 VDC weakens and the incumbents' existing architecture keeps its content. Watch shipment timing against the published 3Q26 and 2027 milestones rather than the announcements.
- **The volatility argument breaks** if the smoothing problem is solved cheaply inside the chip or the scheduler rather than bought as equipment. NVIDIA already cuts peak grid demand up to 30% with power-shelf storage, ramp control and idle-floor techniques; if successive generations absorb more of the swing in software and silicon, the addressable market for external stabilization shrinks even as the load grows.
- **The four-tier storage framing breaks** if one architecture proves genuinely dominant across timescales — a chemistry or a form factor that is competitive at both milliseconds and hours. That would consolidate four buyer sets into one and would favour whoever has the largest manufacturing base, not whoever is best positioned in a niche.

## 3. Where the Demand Comes From — and How Solid It Is

Every other chapter in this report describes a supply constraint. This one asks the prior question: is the demand that all those constraints are straining against actually there? The honest answer is that most of it is contracted, some of it is merely planned, and a meaningful slice is financed by the same companies that will book the revenue. Those three categories behave very differently in a downturn, and the difference between them is the most important thing an investor in this sector can learn to see.

The chapter proceeds in the order a sceptic would ask the questions. What exactly is a capital-expenditure number, and how binding is it? What is a backlog, what is an RPO, and which one is evidence? Why do the buyers keep quoting demand in gigawatts instead of dollars — and what does that unit of account give away? Who is funding whom, and how much of the revenue is circular? And finally: how far is announced capacity from operating capacity, and what would show you first if the whole thing paused?

### 3.1 What a capex number is — and what it is not

Capital expenditure is cash a company expects to spend on long-lived physical assets: land, buildings, transformers, switchgear, servers. When Amazon says it will spend roughly $220B in 2026, that is a *plan* disclosed to shareholders. It is not a purchase order, not a contract, and not a promise. Management can revise it at the next earnings call with no penalty beyond embarrassment, and several of these companies have raised the number two or three times inside a single year — which tells you the plan is being rewritten continuously, in both directions.

**Figure 4: 2026 AI capital expenditure, the big four ($ billion, company guidance)**

| Buyer | 2026 capex | Note |
|---|---|---|
| Amazon | ≈$220B | raised from ≈$200B |
| Google | $195–205B | third raise of the year |
| Microsoft | ≈$190B | vs $154.6B consensus |
| Meta | $130–145B | floor lifted twice |

*Source: Amazon Q2 2026 earnings, 2026-07-30; Alphabet Q2 2026 8-K, 2026-07-22; CNBC Q3 FY2026, 2026-04-29; CNBC Q2 2026 coverage, 2026-07-29 — Amazon, Google, Microsoft and Meta dossiers. Combined big-four 2026 capex ≈$735–760B.*

| Buyer | 2026 capex | The signal underneath the number | Citation |
|---|---|---|---|
| **Amazon** | ≈$220B | Largest single-company AI program; AWS backlog $244B, up 40% | *(Amazon Q2 2026 earnings, 2026-07-30; FY2025 8-K, 2026-02-05 — Amazon dossier)* |
| **Microsoft** | ≈$190B | Commercial RPO $678B, up 84%; Azure crossed $100B/yr | *(CNBC Q3 FY2026, 2026-04-29; FY2026 Q4 results, 2026-07-29 — Microsoft dossier)* |
| **Google** | $195–205B | First $400B revenue year; quarterly free cash flow −$5.9B; 2027 guided to "significantly increase" | *(Alphabet Q2 2026 8-K, 2026-07-22; Q4/FY2025 8-K, 2026-02-04 — Google dossier)* |
| **Meta** | $130–145B | Hyperion at 5 GW design / $50B+; Q2 capex ate ≈98% of operating cash flow | *(CNBC Q2 2026 coverage, 2026-07-29; Richland Parish expansion, 2026-07-13 — Meta dossier)* |

Three properties of that table matter more than its total.

**It is revocable, and it has been revoked before.** In February and March 2025, reports of **Microsoft** cancelling data-center leases — up to roughly 2 GW — knocked confidence across the sector. Spending re-accelerated through FY2026 and the episode resolved as strategic pacing rather than retreat *(Microsoft dossier)*. Keep the episode in mind for two reasons: it is proof the plan can bend, and it is proof that the bend appeared in *lease behaviour* months before it would have appeared in guidance. That sequencing is the basis of the indicator ladder at the end of this chapter.

**It is partly an accounting choice.** Microsoft's ≈$190B calendar-2026 plan was restated to roughly $175B by extending useful lives to 25 years and changing lease treatment *(CFO Dive, 2026-07 — Microsoft dossier)*. **[Analysis — Moderate]** The physical build plan held; the restatement is optics management, not retrenchment *(Microsoft dossier)*. The investor lesson is durable: two companies can build identical campuses and report different capex, so never compare capex lines across companies without checking the definitions — finance leases in or out, useful lives, and what counts as a data-center asset.

**Increasingly, it is not even on the balance sheet.** **Meta** has moved roughly $41B of announced development cost off balance sheet through special-purpose vehicles and joint ventures with Blue Owl and BlackRock. **[Analysis — Moderate]** This is now core strategy rather than opportunism: it preserves reported capex optics and credit capacity while transferring residual-value risk to private capital, and it should be expected on every subsequent gigawatt campus *(Meta dossier)*. For an investor, off-balance-sheet structures mean the sector's true build rate is *larger* than the sum of reported capex lines — and that some of the downside has been sold to third parties who will react on their own schedule.

> **How to read a capex raise**
>
> A raise is informative only when you know what funds it. Amazon's trailing-twelve-month free cash flow fell from $38.2B in 2024 to $11.2B in 2025 to $1.2B by Q1 2026, and the June quarter itself ran −$7.6B *(Amazon Q2 2026 earnings, 2026-07-30; FY2025 8-K, 2026-02-05 — Amazon dossier)*. Google is running negative free cash flow and has raised roughly $95B of debt and equity across late 2025 and 2026 **[Analysis — Moderate]** *(Google dossier)*. Meta's quarterly capex consumed about 98% of operating cash flow *(CNBC Q2 2026 coverage, 2026-07-29 — Meta dossier)*, and **[Analysis — High]** Meta is the highest-beta buyer in the covered set precisely because no cloud revenue absorbs the spend — its free cash flow has collapsed to sub-$1B quarters *(Meta dossier)*. A capex program funded from operating cash flow bends slowly. A capex program funded from capital markets bends when the capital markets do.

### 3.2 Backlog and RPO: the difference that matters

Two words do most of the work in this sector's demand debate, and they are not synonyms.

**RPO — remaining performance obligations** — is an accounting disclosure. It is the dollar value of contracted revenue a company has signed but not yet recognised. It comes out of the audited filings, it has a definition, and the auditors have looked at it. What it does *not* tell you, unless the company volunteers it, is three things you need: over how many years it will be recognised (duration), who owes it (counterparty concentration), and under what circumstances the customer can walk away (cancellability).

**Backlog** is usually a management-defined operating metric. It can include work under master service agreements, letters of intent, and awarded-but-unsigned scope, and different companies draw the line differently. Backlog is therefore softer than RPO — but sometimes it is also *narrower*, because some categories of work never enter it at all. **Quanta Services** is the clean illustration: a record $53.4B backlog against RPO of only $33.6B, with the NiSource roughly 3 GW program largely excluded and data-center master-service-agreement work running book-and-burn outside backlog entirely. **[Analysis — High]** The backlog is therefore neither a floor nor firm *(Quanta dossier)* — it understates some demand and overstates the firmness of the rest.

> **Why a backlog growing faster than capex is the strongest evidence in this market**
>
> Capex is what a company intends to spend. Contracted backlog is what customers have already promised to pay. If backlog grows faster than capex, the buildout is being *pre-sold*: capacity is contracted before the concrete is poured, and the company is chasing demand rather than manufacturing it. If capex grows faster than backlog, the company is building on conviction and hoping the customers arrive. Same industry, same headline growth, opposite risk. This single ratio separates the two halves of the demand base.

**Figure 5: The contracted-revenue stack, colour-coded by concentration ($ billion)**

| Company | Contracted revenue | Concentration read |
|---|---|---|
| Microsoft | $678B | commercial RPO, +84% — diversified |
| Oracle | $638B | RPO, +363% — ≈half one counterparty |
| Amazon | $244B | AWS backlog, +40% — diversified |
| CoreWeave | $99.4B | backlog, +284% — anchor tenant ≈67% of revenue |
| Quanta | $53.4B | backlog; RPO only $33.6B — definitional gap |

*Source: Microsoft FY2026 Q4 results, 2026-07-29; Oracle Q4 FY2026 earnings, 2026-06-10; Amazon FY2025 8-K, 2026-02-05; CoreWeave Q1 2026 results, 2026-05-07; Quanta Q2 2026 release, 2026-07-30 — respective dossiers. Rows are not like-for-like: Microsoft and Oracle report RPO under accounting definitions, Amazon, CoreWeave and Quanta report management-defined backlog.*

Read the table by the concentration column rather than by size. The two largest numbers are nearly the same magnitude and are not remotely the same asset.

**Microsoft**'s $678B is the best-documented demand case among the big four. **[Analysis — High]** A commercial backlog growing +84% — considerably faster than capex — means the buildout is substantially pre-sold, and the OpenAI $250B Azure commitment alone underwrites years of Fairwater capacity *(Microsoft dossier)*. Azure crossing $100B of annual revenue at +41% growth is the corroborating operating fact *(FY2026 Q4 results, 2026-07-29 — Microsoft dossier)*. The concentration is real — one customer inside that number is very large — but the remainder is a Fortune-500-wide enterprise book with decades of renewal history.

**Oracle**'s $638B is the same order of magnitude and a materially weaker instrument. It grew +363% in a single fiscal year, from $138B, through a sequence of $455B, $523B, $553B, $638B *(Q4 FY2026 earnings, 2026-06-10; Q1 FY2026 earnings release, 2025-09-09 — Oracle dossier)*. **[Analysis — Moderate]** The number overstates firm demand: roughly half is press-attributed to a single ≈$300B OpenAI contract beginning in 2027, $75B is GPU-prepayment and customer-supplied structures rather than conventional service revenue, and approximately 0.3 GW is operational against more than 9 GW projected by 2029 *(Oracle dossier)*. **[Analysis — High]** Analysts openly handicap collectability — DA Davidson's "very high uncertainty this customer will be able to pay" — and Oracle has never disclosed the customer split *(Oracle dossier)*. Meanwhile the economics of serving it are thinner than the legacy business: leaked internals put GPU-rental gross margins at roughly 14–16% against roughly 70% on legacy software, a direction the CFO's own FY2027 gross-margin step-down guidance corroborates *(CNBC, 2025-10-07 — Oracle dossier)*. Oracle funded FY2026 with $43B of debt plus $5B of equity against −$23.7B of free cash flow, with roughly $40B more financing planned *(Q4 FY2026 earnings, 2026-06-10 — Oracle dossier)*.

The mechanism to internalise: a $638B receivable from one counterparty that is itself loss-making is not half as good as a $678B receivable from thousands. It is a different asset class. Diversified backlog fails gradually and by segment; concentrated backlog fails at once, on one counterparty's decision. Same units, different distribution of outcomes.

**CoreWeave** shows the third variant — real contracted demand with a duration problem underneath it. The company crossed 1 GW active across 49 data centers with 3.5+ GW contracted and a $99.4B backlog, up 284% *(Q1 2026 results, 2026-05-07 — CoreWeave dossier)*, on FY2025 revenue of $5.13B, up 168% *(CoreWeave Q4/FY2025 results, 2026-02 — CoreWeave dossier)*. **[Analysis — High]** The backlog is real, but its equity value hinges on renewal economics and depreciation truth rather than the headline: roughly five-year weighted contract duration against a six-year GPU useful-life assumption that short-sellers argue should be three to under five years — a change that would roughly double depreciation and amortisation and erase margins — with observed 50–70% rental-rate declines on prior-generation GPUs as the empirical anchor *(CoreWeave dossier)*. **[Analysis — High]** Concentration is improving but still defining: Microsoft at roughly 67% of FY2025 revenue, with Meta ($21B), OpenAI (≈$22.4B), Anthropic and Jane Street diversifying the book — while Microsoft declining a roughly $12B expansion and routing capacity to Nebius shows the anchor tenant actively cultivating alternatives *(CoreWeave dossier)*.

#### Why depreciation life is the hinge

A GPU cluster is bought once and expensed over its assumed useful life. Assume six years and the annual charge is one-sixth of the cost; assume three and it is one-third. Nothing about the physical hardware changes — but the reported profit does, and so does the rent you must charge to break even. If the useful life the industry assumes is longer than the life the market actually pays for, then today's reported margins are borrowing from tomorrow's write-downs. This is why the depreciation argument, which sounds like an accounting quibble, is the single most consequential open question in AI infrastructure economics. It is also why the observed decline in prior-generation rental rates matters more than any forecast: it is the market pricing the second half of the asset's assumed life.

**Demand quality by buyer — pre-sold versus speculative**

| Buyer | Contracted evidence | Concentration | Operating today | Quality read |
|---|---|---|---|---|
| **Microsoft** | RPO $678B, +84% — faster than capex | Large but one of many; enterprise book beneath it | Azure >$100B/yr, +41% | Strongest pre-sold case in the set **[Analysis — High]** *(Microsoft dossier)* |
| **Amazon** | AWS backlog $244B, +40%; gigawatts named in an 8-K | Diversified; Anthropic and OpenAI additive | AWS $42.2B in the quarter, +36.7% | Pre-sold, but capex now outruns cash generation *(Amazon Q2 2026 earnings, 2026-07-30 — Amazon dossier)* |
| **Google** | No comparable public RPO disclosure; capex is the visible commitment | Own-workload demand, not third-party contracts | First $400B revenue year | Conviction-funded rather than pre-sold; owns its demand, so cannot be cancelled on — but nobody else has pre-paid for it |
| **Meta** | No cloud revenue to pre-sell; capex plus SPV (special-purpose vehicle — a separately financed entity that keeps the asset off the parent balance sheet) structures | Entirely internal demand | Prometheus ≈1 GW online 2026 | Highest-beta buyer in the set **[Analysis — High]** *(Meta dossier)* |
| **Oracle** | RPO $638B, +363%; $75B is prepayment structures | ≈Half press-attributed to one counterparty | ≈0.3 GW vs >9 GW projected 2029 | Overstates firm demand **[Analysis — Moderate]** *(Oracle dossier)* |
| **CoreWeave** | Backlog $99.4B, +284%; 3.5+ GW contracted | Microsoft ≈67% of FY2025 revenue | 1 GW active across 49 sites | Real, but duration and depreciation are the variables **[Analysis — High]** *(CoreWeave dossier)* |
| **OpenAI** | ≈$1.4T / ≈30 GW acknowledged commitments | It is the concentration in everyone else's book | Revenue annualising >$25B; $3.7B quarterly burn | Commitments, not contracts on its own balance sheet **[Analysis — Moderate]** *(OpenAI dossier)* |

### 3.3 Why the demand is quoted in gigawatts

Something unusual has happened to the language of this market. Buyers used to size cloud commitments in dollars or in server counts. They now size them in gigawatts — a unit of electrical power, one billion watts, roughly the output of a large nuclear reactor. **Amazon** put gigawatts in an earnings filing: up to 5 GW of Trainium capacity for Anthropic, approximately 2 GW for OpenAI, and 2.1M+ AI chips deployed in twelve months *(Q1 2026 8-K exhibit, 2026-04-29 — Amazon dossier)*.

The choice of unit is itself the most valuable piece of information in this chapter. A buyer denominates a commitment in whatever is scarce. When commitments are quoted in dollars, capital is the constraint. When they are quoted in chips, silicon allocation is the constraint. When they are quoted in gigawatts, the buyer is telling you it has already solved capital and silicon, and that the thing it cannot get is *energised interconnected capacity*. That is why a report about AI ends up being a report about transformers, turbines and batteries.

The gigawatt commitments themselves:

- **OpenAI**: ≈$1.4T / ≈30 GW of acknowledged commitments. The 10 GW-by-2029 target was surpassed *in commitments* by April 2026, with more than 3 GW added in one trailing 90-day window; planned compute spend through 2030 was raised to $750B *(Reuters factbox, 2025-10; Stargate scaling update, 2026-04; WSJ via Yahoo, 2026-07-22 — OpenAI dossier)*. Vendor by vendor: NVIDIA ≥10 GW, Broadcom 10 GW, AMD 6 GW, AWS ≈2 GW Trainium, Cerebras 750 MW *(Tunguz commitment tally, 2025-10 — OpenAI dossier; the AWS ≈2 GW line also per Amazon's Q1 2026 8-K, 2026-04-29)*
- **NVIDIA** — the demand engine — booked FY2026 revenue of $215.9B, up 65%, with data center at $193.7B, and nearly doubled its own supply commitments quarter on quarter from $50.3B to $95.2B *(Q4/FY2026 results, 2026-02-25 — NVIDIA dossier)*; Q1 FY2027 revenue was $81.6B, up 85%, against $78.8B consensus, with the following quarter guided to $91B *(Q1 FY2027 results, 2026-05-20 — NVIDIA dossier)*. **[Analysis — High]** Third-party projections of ≈233 GW of cumulative new AI data-center power demand across 2025–2030 rest heavily on NVIDIA's shipment cadence *(NVIDIA dossier)*. Anthropic's commitment arrived in the same units — initially up to 1 GW of Grace Blackwell / Vera Rubin capacity, with NVIDIA investing up to $10B *(Anthropic–Microsoft–NVIDIA partnership, 2025-11-18 — NVIDIA dossier)*
- **The neocloud tier is the marginal buyer**: CoreWeave crossed 1 GW active with 3.5+ GW contracted *(Q1 2026 results, 2026-05-07 — CoreWeave dossier)*; **xAI** went from zero to 1.0 GW of nameplate compute draw in three years *(SpaceX Form S-1, 2026-05-20 — xAI dossier)*

Read a company's own supply commitments as the sharpest demand tell available. NVIDIA's near-doubling to $95.2B is money it has contractually promised its own suppliers before it has customer cash in hand. Firms do not double their purchase obligations on hope; they do it when they have visibility they are not yet allowed to disclose. It is also, by construction, the number that would fall first if visibility deteriorated — which is why it sits on the indicator ladder below.

#### The constraint the unit is pointing at

| Metric | Value |
|---|---|
| US projects blocked or delayed on power, Q1 2026 — a record | ≈$130B |
| Northern Virginia data-center vacancy | 0.3% |
| Amsterdam connection moratorium threshold; Singapore rations releases | >70 MW |
| Of the 307 GW US pipeline converting near-term — the bulk is 2028+ | ≈20% |

*Blocked-project total, vacancy and moratoria per the Equinix dossier **[Analysis — Moderate]**; near-term pipeline conversion per the Eaton dossier **[Analysis — Moderate]**.*

Those four numbers explain the unit of account. Vacancy at 0.3% means there is effectively no spare capacity to rent in the largest US market — every incremental workload requires new construction. A moratorium threshold means a jurisdiction has stopped granting connections above a size. And a record $130B of blocked or delayed projects means capital is queued behind physical delivery, not the other way round.

**The supplier order books are the independent audit of the buyers' claims.** This matters because buyers' announcements are cheap and suppliers' order intake is not: an order is a contract, often deposit-backed, reported quarterly under audit, by a company with no incentive to flatter its customer's narrative. If AI demand were substantially rhetorical, the electrical supply chain would not look like this.

| Supplier | Order-book signal | Growth | Citation |
|---|---|---|---|
| **GE Vernova** | Data-center Electrification orders ≈$0.7B (2024) → >$2B (2025) → >$5B in 1H 2026 alone | ≈7x in 18 months | *(Q2 2026 press release, 2026-07-22 — GE Vernova dossier)* |
| **ABB** | First-ever $7B+ Electrification quarter; triple-digit DC growth | +60% | *(Q2 2026 release, 2026-07-16 — ABB dossier)* |
| **Vertiv** | Backlog $15.0B on ≈2.9x book-to-bill | +109% | *(FY2025 8-K, 2026-02-11 — Vertiv dossier)* |
| **Siemens Energy** | Q3 FY26 Gas Services orders €10.0B (73 turbines / 15 GW); record €162B group backlog | 2.65x book-to-bill | *(Q3 FY26 earnings release, 2026-08-05 — Siemens Energy dossier)* |
| **Hitachi Energy** | Q1 FY2026 orders; backlog above ¥10T (≈$68B) | +87% YoY | *(Investing.com, 2026-07-29 — Hitachi Energy dossier)* |
| **Schneider** | Data-center demand grew triple-digit | triple-digit | *(H1 2026 release, 2026-07-30 — Schneider dossier)* |
| **Eaton** | Electrical backlog $19.6B at FY2025 close; data-center orders +200% in Q4 | +29% backlog | *(Eaton FY2025 results 8-K, 2026-02 — Eaton dossier)* |

One caution belongs immediately beside that table, because it is the most common misreading of these numbers. **[Analysis — High]** Eaton's data-center order growth of 200–240% reflects content-per-megawatt expansion and lumpy multi-year hyperscaler frame agreements more than unit-share capture — the underlying market grows roughly 7.5% annually, third-party share structures are unchanged, and rolling-twelve-month organic order growth of roughly 38–42% is the cleaner metric *(Eaton dossier)*. Two mechanisms are being conflated in most commentary: *more megawatts* and *more dollars of equipment per megawatt*. Both are real, both are good for suppliers, but only the first is a demand signal. A 200% order number that is mostly frame-agreement timing tells you far less about end demand than a 40% organic figure sustained over four quarters.

### 3.4 The circular loop, walked step by step

Start with the fair statement, because it is genuinely fair. Vendor financing is ordinary commercial practice and always has been. Aircraft manufacturers finance airlines. Telecom-equipment makers financed carriers through the 1990s build-out. Equipment vendors take equity in customers who are creating the market their equipment serves. None of this is fraud, and treating circularity as automatically fraudulent is analytically lazy. What matters is whether the circle is *additive* — vendor capital accelerating a customer who will eventually fund itself from end-user revenue — or *self-referential*, where the same dollar is counted as investment, revenue and backlog by different parties and no external cash ever enters.

Here is the loop, one step at a time. Every step below is sourced; the assessment that follows is labelled.

1. **NVIDIA invests in OpenAI.** A letter of intent covers 10 GW of NVIDIA systems, with NVIDIA investing up to $100B as capacity deploys; the first gigawatt lands on Vera Rubin in 2H 2026 *(OpenAI 10 GW partnership announcement, 2025-09-22 — NVIDIA dossier)*. In the March 2026 round, NVIDIA put in a reported $30B alongside SoftBank's $30B and Amazon's $50B, closing $122B at an $852B post-money valuation *(OpenAI, accelerating the next phase, 2026-03-31 — OpenAI dossier)*.
2. **OpenAI spends that capital on compute — much of it NVIDIA-based.** Planned compute spend through 2030 stands at $750B *(WSJ via Yahoo, 2026-07-22 — OpenAI dossier)*, against reported revenue of $5.7B in Q1 2026 annualising above $25B, and a reported $3.7B of cash burn in that quarter with more than $115B of cumulative burn projected through 2029 *(OpenAI dossier, Q1 2026 reported financials — press-reported; OpenAI publishes no audited statements)*.
3. **Amazon invests while selling.** Amazon's $50B tranche of that round sits alongside an AWS agreement expanded by a reported $100B over eight years including ≈2 GW of Trainium, on top of a prior $38B agreement *(OpenAI–Amazon partnership, 2026-02-27 — OpenAI dossier; CNBC, 2025-11-03 — Amazon dossier)*. Roughly $50B of investment against roughly $138B of cloud sales to the same counterparty.
4. **Oracle borrows against the receivable.** Roughly half of Oracle's $638B RPO is press-attributed to a single ≈$300B OpenAI contract starting 2027; Oracle has borrowed extensively — approximately $96B reported — against that book while running −$23.7B of free cash flow *(OpenAI dossier; Q4 FY2026 earnings, 2026-06-10 — Oracle dossier)*. The lenders' collateral is, in substance, one customer's future payments.
5. **Microsoft's accounts reveal the other side of the ledger.** Microsoft's $4.1B of quarterly equity-method losses imply roughly $11.5B of quarterly OpenAI losses — the only hard public window into OpenAI's profit and loss *(OpenAI dossier)*. The customer at the centre of the loop is losing money at scale, and one of its largest suppliers reports a share of those losses in its own earnings.
6. **The concentration lands back on the supplier.** Four direct customers accounted for 61% of NVIDIA's revenue *(Q3 FY2026 10-Q, 2025-11-19 — NVIDIA dossier)*. **[Analysis — Moderate]** The circular-financing critique is the most serious structural risk in NVIDIA's story — up to $100B invested in OpenAI as it buys NVIDIA systems, reported discussions of guaranteeing up to $250B of OpenAI lease payments, and that customer concentration; Bernstein and Bloomberg Intelligence flag it, and Burry's depreciation-understatement thesis (≈$176B across 2026–2028) is the bear case NVIDIA felt compelled to rebut directly *(NVIDIA dossier; CNBC, 2025-11-25 — NVIDIA dossier)*.
7. **Equity marks feed back into reported earnings.** Amazon's Q2 2026 net income of $62.6B included a $53.4B non-recurring Anthropic mark-up, following $16.8B in the prior quarter *(Amazon Q2 2026 earnings, 2026-07-30 — Amazon dossier)*. **[Analysis — High]** Converting compute supply into balance-sheet gains through equity stakes is a structural advantage no other hyperscaler currently replicates at this scale *(Amazon dossier)* — and it also means a portion of reported hyperscaler profit is a valuation of a private customer rather than cash from an end user.

**[Analysis — High]** The dossier read is that the financing model is circular by construction and that this is its central fragility: the same dollars appear as vendor revenue, as OpenAI funding, and as counterparty backlog — a structure that amplifies in both directions *(OpenAI dossier)*. **[Analysis — Moderate]** The revenue trajectory is strong but structurally short of the commitments on any current curve, and the bridge is serial mega-raises plus an eventual IPO — which the Amazon tranche's contingency makes near-mandatory by 2028 *(OpenAI dossier)*. A confidential S-1 was filed in June 2026 at a reported valuation of up to $1T *(OpenAI dossier, 2026-06-08)*.

> **What would make circularity dangerous — three tests**
>
> **1. Does external cash enter the circle?** Vendor financing is additive when the customer's end-user revenue is growing toward self-funding, and self-referential when each round of vendor capital is what funds the next round of vendor revenue. OpenAI's revenue is growing fast in absolute terms and is still a small fraction of its commitments — so this test is currently unresolved rather than failed, and it resolves observably: watch whether each successive raise is smaller relative to spend, or larger.
>
> **2. Can the borrower service the debt without a new raise?** Oracle at −$23.7B free cash flow with roughly $40B of further financing planned, and CoreWeave with FY2025 interest expense of $1.23B on $5.13B of revenue — roughly 24% — and total debt near $24.9B against roughly $4.8B of equity, are both financing-dependent by construction **[Analysis — Moderate]** *(CoreWeave dossier; Oracle dossier)*. Financing dependence is not failure. It is a condition that converts credit-market sentiment into an operating variable.
>
> **3. Is the asset's economic life longer than the contract that pays for it?** This is the depreciation question, and it is where circularity would actually bite: if GPUs earn for four years and are financed over six, the loop needs continuous new contracts to stay solvent.
>
> And the strongest counter-evidence, which deserves equal weight: sophisticated lenders have repriced this risk *downward* for three consecutive years. CoreWeave's GPU-backed coupon went from roughly 15% in 2023 to investment-grade SOFR+225bps on an $8.5B facility in 2026 *(globaldatacenterhub, 2026-03-15 — CoreWeave dossier)*. **[Analysis — High]** That trajectory is a three-year repricing of GPU-collateral risk by lenders with money at stake — even as the equity market punished the same company *(CoreWeave dossier)*. When credit and equity disagree this sharply, credit is usually the better-informed party on solvency, and equity the better-informed party on returns.

### 3.5 Announced versus operational

A data center is announced years before it delivers a watt. The intervening steps are all physical: site control, permits, a grid interconnection study, an interconnection agreement, transformers and switchgear with multi-year lead times, generation or a power purchase agreement, construction labor, commissioning, energisation. Each step can slip independently and none can be skipped. The consequence is that "announced gigawatts" and "operating gigawatts" are separated by roughly the length of a full business cycle, and they should never be compared as if they measured the same thing.

The gap inside the covered set is stark. Oracle runs approximately 0.3 GW operational against more than 9 GW projected by 2029 **[Analysis — Moderate]** *(Oracle dossier)*. **[Analysis — Moderate]** Delivery risk is concentrated in exactly that announced-to-operational gap: roughly 0.3 GW live at Abilene against more than 9 GW projected across Stargate by 2029, with the Abilene expansion to 2.1 GW reversed per independent tracking, and every site depending on the same constrained turbine, transformer and grid-queue resources documented elsewhere in this report *(OpenAI dossier)*. Sector-wide, **[Analysis — Moderate]** only approximately 20% of the 307 GW US data-center pipeline converts near-term, with the bulk in 2028 and beyond — which gives suppliers multi-year visibility while concentrating sensitivity to any hyperscaler capex pause; the order book would show it first *(Eaton dossier)*.

This is why an investor should track order books rather than announcements, and the reasoning is worth making explicit. An announcement is free, reversible, and produced by a communications department. An order is a contract with a delivery date, frequently accompanied by a cash deposit, recognised under accounting rules, audited, and disclosed on a fixed quarterly calendar by a company whose own guidance depends on it being accurate. When the two disagree, the order book is right. **GE Vernova**'s 63 GW of deposit-backed slot reservations, taken with roughly 20% cash down that converts to firm orders, is the cleanest example of demand that has posted collateral *(December 2025 Investor Update transcript, 2025-12-09 — GE Vernova dossier)*. Deposits are the difference between a stated intention and a revealed preference.

There is also an operational counter-example that proves the gap can be closed fast when the constraint is bypassed rather than queued. **xAI** went from zero to 1.0 GW of nameplate compute draw in three years, powered almost entirely by self-deployed behind-the-meter generation *(SpaceX Form S-1, 2026-05-20 — xAI dossier)*. That is the mechanism chapter 5 examines: when the grid is the bottleneck, buyers pay a premium to leave the grid out of the critical path. For demand analysis the point is narrower — announced-to-operational conversion is not a fixed industry constant, it is a function of which constraint a given developer chose to accept.

### 3.6 What this means for your capital

The demand base has three tiers, and they should not be underwritten at the same multiple. **Tier one is pre-sold and diversified**: Microsoft's $678B RPO growing faster than its capex, Amazon's $244B AWS backlog. This tier survives a sentiment shock because the customers are contractually committed and numerous. **Tier two is real but concentrated or duration-exposed**: Oracle's $638B with roughly half attributable to one loss-making counterparty, CoreWeave's $99.4B against a five-year duration and a contested six-year depreciation life. This tier is a leveraged bet on a small number of decisions. **Tier three is conviction-funded**: Google and Meta building against their own product roadmaps, with no external customer having pre-paid, funded increasingly from capital markets and off-balance-sheet vehicles. This tier is the most exposed to a change in the cost of capital and the least exposed to a customer defaulting.

The investment consequence follows from where in the chain the money is committed rather than from a view on AI itself. Companies that sell into the buildout against contracted, deposit-backed order books — the electrical and power tier whose intake is quantified in the table in section 3.3 — convert this demand into revenue whether or not any individual buyer's thesis proves out, because their customer is the campus, not the model. Companies whose revenue is a single counterparty's future ability to pay are underwriting that counterparty's business model, whatever the RPO headline says. And companies whose asset base depends on a depreciation assumption that the rental market has not yet validated carry a risk that is invisible in current earnings and would appear all at once.

What to monitor is therefore not the capex headline. Capex is the last number to move, because it is a statement of intent revised on a quarterly public stage where revision is embarrassing. The physical and contractual layers move first.

#### The indicator ladder — in the order a pause would show

1. **Lease signings and site options.** The earliest reversible commitment, and the one that moved first in the February–March 2025 episode when reported cancellations of up to roughly 2 GW preceded any guidance change and ultimately resolved as pacing *(Microsoft dossier)*. Microsoft's quarterly data-center lease disclosures — roughly $11.1B in one quarter — are the running series to watch *(DCD, 2026-05 — Microsoft dossier)*. A pause appears here as slowing new leases, not as cancellations.
2. **Order intake and book-to-bill at the electrical tier.** Intake turns before backlog, and backlog turns before revenue. Watch Vertiv's book-to-bill against its ≈2.9x base *(FY2025 8-K, 2026-02-11 — Vertiv dossier)*, ABB Electrification quarterly orders *(Q2 2026 release, 2026-07-16 — ABB dossier)*, and specifically Eaton's rolling-twelve-month organic order growth rather than its headline data-center percentage **[Analysis — High]** *(Eaton dossier)*. Two consecutive quarters of decelerating organic intake with flat backlog is the signature.
3. **Slot reservations and deposit conversion.** Reservations that fail to convert to firm orders, or forfeited deposits, are the highest-quality early warning available because real cash is at risk: GE Vernova's 63 GW of deposit-backed slots at roughly 20% down *(December 2025 Investor Update transcript, 2025-12-09 — GE Vernova dossier)*, Siemens Energy's returned slot-reservation fees *(POWER Magazine, 2025-02 — Siemens Energy dossier)*, and Hitachi Energy's capacity-reservation agreements *(Nikkei Asia, 2024-05 — Hitachi Energy dossier)*.
4. **Financing terms for the leveraged tier.** The CoreWeave coupon trajectory reversing — after three years of compression from roughly 15% to SOFR+225bps — would signal that credit has repriced the collateral *(globaldatacenterhub, 2026-03-15 — CoreWeave dossier)*. The 2026 refinancing tower of roughly $4.2B is the test point **[Analysis — Moderate]** *(CoreWeave dossier)*. Also watch Oracle's roughly $40B of planned financing against its BBB− rating and modelled FY2027 free-cash-flow deficit of roughly $42B *(Oracle dossier)*.
5. **Vendor supply commitments.** NVIDIA's own purchase obligations, which nearly doubled quarter on quarter to $95.2B *(Q4/FY2026 results, 2026-02-25 — NVIDIA dossier)*, are forward-looking cash the company has already promised. A flattening here is a demand statement from the best-informed participant in the chain.
6. **Announcement cadence from the anchor counterparty.** **[Analysis — High]** OpenAI's announcement cadence is the sector's primary timing trigger — Oracle, CoreWeave, AMD and Broadcom order books and share prices all repriced on its announcements *(OpenAI dossier)*. Absence of announcements is information.
7. **Capex guidance.** The confirmation, not the warning. By the time a guide is cut, indicators one through six have already moved.
8. **Reported revenue.** Last of all, and by then irrelevant to positioning.

#### What would change this assessment

The argument that demand is substantially real rests on four observables, each of which is falsifiable:

- **Backlog outgrowing capex at the diversified buyers.** If Microsoft's RPO growth decelerates below its capex growth for two consecutive quarters, the pre-sold case weakens at its strongest point, and the tier-one/tier-three distinction above collapses toward conviction funding.
- **Supplier order intake corroborating buyer announcements.** If the electrical tier's organic intake decelerates while buyers keep announcing gigawatts, the announcements are no longer being converted into procurement — and the order books, not the announcements, are the truth.
- **Deposits staying at risk.** Reservation forfeiture or non-conversion at GE Vernova, Siemens Energy or Hitachi Energy would show demand withdrawing where it costs real money to withdraw. That is the single most informative event on this list.
- **The depreciation assumption holding.** If prior-generation rental rates continue to decline at the observed 50–70% and any major operator shortens GPU useful life, reported margins across the neocloud tier reprice at once, and financing costs follow **[Analysis — High]** *(CoreWeave dossier)*.

Conversely, the case that this is a bubble would be weakened by the opposite pattern: reservation deposits converting on schedule, credit spreads continuing to compress, and the announced-to-operational gap narrowing as 2027–28 equipment capacity lands. Both sets of evidence arrive through the same instruments — quarterly order books and financing terms — which is why those are the two series worth following continuously, and why capex headlines are worth reading last.

## 4. The Scarcity Economy — Turbines, Transformers and Breakers

This is the chapter that explains why the AI buildout costs what it costs. Not because chips are dear or capital is short, but because four or five pieces of heavy electrical equipment cannot be made fast enough, and the companies that make them have discovered they can charge for the calendar. Everything else in this report — behind-the-meter gas, batteries as bridge power, prefabricated substations, fuel cells sold on a 55-day install — is a response to the economics set out here.

### 4.1 What a lead time is, and the moment it becomes a price

A lead time is the gap between placing an order and taking delivery. In a functioning market it is a logistics detail — you plan around it and it costs you nothing. It becomes a price the moment it grows longer than the buyer's decision horizon.

Consider what a gigawatt-class data-center developer is actually doing. They have signed a lease or a compute contract with a revenue start date. They have committed capital to land, buildings, cooling and — increasingly — to the GPUs themselves. Every month the campus sits unenergized is a month of financing cost against billions of deployed capital with no offsetting revenue. So the developer does not ask "what does a gas turbine cost?" They ask "what is the earliest date anyone will hand me one?" Money is fungible. A delivery date is not.

Now look at it from the supply side. In a normal market, a price above cost is self-correcting: high margins attract entrants, supply expands, price falls back toward cost. That correction mechanism has a speed limit, and the speed limit is how fast new productive capacity can be built. A heavy-duty gas-turbine line, or a large-power-transformer factory, is a multi-year construction project requiring specialised tooling, test facilities and welders and winders who take years to train. When demand steps up abruptly — as it did when AI compute began being procured in gigawatts *(section 2)* — price rises and, for several years, nothing arrives to push it back down.

In that gap the incumbent stops pricing off its own cost and starts pricing off the buyer's alternative. Economists call the resulting premium **scarcity rent**. It is worth being precise about what it is not: it is not payment for a better machine. The turbine delivered in 2031 at a premium is the same turbine that would have been delivered in 2026 without one. The buyer is paying for a position in a queue.

> **Why the rent gets paid without much of a fight**
>
> The ceiling on scarcity rent is not the cost of the equipment. It is the value of the schedule. For a developer, the alternative to paying the premium is not "buy the same thing cheaper somewhere else" — every credible supplier is equally full — it is "do not build, or build two years later." A 1 GW campus that slips two years forgoes two years of revenue on billions of committed capital. Against that, a premium of ten or twenty percent on a turbine is close to free.
>
> This is why the rent can be enormous relative to the equipment's cost while remaining trivial relative to the project's value. It also tells you where the rent stops: it is capped by the value of the time saved, not by any notion of a fair margin. And it explains a pattern that otherwise looks irrational — buyers cheerfully paying above-market prices for delivery five years out, and doing it in cash.

### 4.2 Rent or franchise? The one test to carry out of this report

If you take a single idea from this chapter, take this one. Scarcity rent and a competitive moat look identical in a set of financial statements. Both show up as expanding margins, a lengthening backlog and pricing power. They are completely different assets.

**Scarcity rent has an expiry date.** It exists because supply cannot yet respond. When capacity arrives, the premium goes — not gradually, but at the point where a buyer who wants an earlier date has somewhere else to get one. Earnings built on rent look like a moat right up until the clock runs out.

**A franchise survives the arrival of new capacity**, because something other than shortage keeps the customer: a deficit that persists even after the announced expansions, engineering and qualification costs the buyer will not repeat, geography that cannot be relocated, or a cost position rivals cannot reach.

Three questions separate them, and you can run them on any bottleneck in this sector:

1. **Who is adding capacity, how much, and when does it land?** If competing supply arrives inside the delivery years the incumbent has already sold, the premium is rent.
2. **When that capacity lands, does the shortage close or merely narrow?** Closure kills the rent. A shortage that narrows but persists keeps the pricing.
3. **After capacity arrives, what would stop a customer switching?** If the honest answer is "nothing much," you were holding rent.

#### The test applied — turbines fail it, transformers pass

**Turbines look like rent.** Siemens Energy nearly doubled unit sales in a single year — 194 turbines in FY25 against 100 in FY24 *(Siemens Energy release, 2025-11-14)* — and Mitsubishi calls its own +30% capacity addition "not enough." Competing supply lands in the same 2028–2030 windows GE Vernova is selling into today. **[Analysis — High]** GE Vernova's pricing power is real but it is scarcity rent, not durable moat: reservations imply ≈$3,000/kW combined-cycle pricing, roughly triple where it sat three years ago *(GE Vernova dossier)*. Question 1 is answered adversely; question 3 has no good answer, because a 430 MW combined-cycle unit from one of three qualified OEMs is not a product a buyer is locked into.

**Transformers look like a franchise.** Wood Mackenzie models a ≈30% US power-transformer supply deficit in 2025, prices up 77% since 2019, and constraints persisting "well into the 2030s" — with the deficit easing only to roughly 5% by 2030 *(Wood Mackenzie, 2025-02 — Hitachi Energy dossier)*. Industry-wide lead times run ≈2.5 years, with a 2.5–4 year band, and prices are predicted to rise through 2030 *(Wood Mackenzie, 2024-07 — GE Vernova dossier)*. Question 2 is answered favourably: the shortage narrows, it does not close. And question 3 has a structural answer — ≈80% of US large power transformers are imported *(Siemens Energy $1B US investment release, 2026-02-03)*, so domestic capacity is not a preference, it is a scarce physical asset. **[Analysis — High]** The transformer bottleneck is the more defensible franchise versus turbines: 2.5–4-year lead times modelled to persist toward 2030, and GE Vernova's data-center electrification orders quintupled in 18 months *(GE Vernova dossier)*.

**Figure 6: The queue, item by item (months from order to delivery)**

| Item | Note | Months |
|---|---|---|
| Gas-turbine slot, GE Vernova | Sold in 2026, delivers 2031 | ≈60 |
| Large transformer, no reservation | Hitachi Energy — up to 4 years | ≈48 |
| Large transformer, with reservation | Hitachi Energy | 30–40 |
| Power transformer, US Southeast | — | 36+ |
| Generator step-up transformer | Industry average, ≈144 weeks | ≈33 |
| Power transformer, industry average | ≈128 weeks | ≈29 |
| HV/EHV circuit breaker | ≈125 weeks | ≈29 |

*Source: Turbomachinery Magazine, 2026-07 — GE Vernova dossier (turbine slot); Nikkei Asia, 2024-05 and Hitachi Energy dossier lead-time specs (Hitachi waits; industry averages of ≈128 weeks for power transformers and ≈144 weeks for generator step-up units); Siemens Energy $1B US investment release, 2026-02-03 (US Southeast); Quanta Q2 2026 release, 2026-07-30 — Quanta dossier (breakers). Note: week figures converted to months at 4.35 weeks per month. Every line here sits inside a grid interconnection queue that runs 4–8 years, which is the reason these queues exist at all.*

### 4.3 Turbines: the slot became the product

A "slot" is not a machine. It is a production position — a place in the factory's build sequence, identified by the quarter in which a unit would come off the line. Historically an OEM would not sell you one; you placed an order and the order implied a date. What has changed is that the date has been unbundled from the machine and sold separately, at its own price.

GE Vernova holds 116 GW of committed gas capacity — 53 GW of equipment backlog plus 63 GW of *deposit-backed slot reservations*, now selling against 2031 delivery *(Turbomachinery Magazine, 2026-07 — GE Vernova dossier)*. Read that split carefully, because it is the single most revealing number in the chapter: 54% of what GE Vernova has "sold" is not an order for equipment at all. It is a set of options on manufacturing dates. Output ramps from ≈20 GW/yr to 24 GW in 2028 and toward 30 GW by 2030, and the company expects to be "largely sold out of 2030 deliveries by end of 2026" *(Utility Dive, 2025-12 — GE Vernova dossier)*. Q2 2026 alone converted 10 GW of reservations into orders *(GE Vernova dossier)*, inside quarterly orders of $24.2B, up 88% organically, against a record $176B backlog *(Q2 2026 press release, 2026-07-22 — GE Vernova dossier)*.

Siemens Energy is in the same position with less spare capacity to sell: large-frame slots are nearly full through 2028, and slot-reservation *fees* are back for the first time since the early-2000s gas boom *(POWER Magazine, 2025-02 — Siemens Energy dossier)*. Q3 FY26 Gas Services alone booked €10.0B of orders — a book-to-bill of 2.65, 73 turbines totalling 15 GW — with US data centers the named driver, inside a record €162B group backlog *(Q3 FY26 earnings release, 2026-08-05 — Siemens Energy dossier)*. A book-to-bill of 2.65 means the company took in two and two-thirds euros of new work for every euro it delivered; the queue is lengthening faster than it is being worked off, which is the arithmetic signature of an unresolved shortage.

The demand side is documented too, and it is not only hyperscalers. xAI signed ≈$3.7B of turbine commitments in four months of 2026 — $805M plus $925M of purchase agreements through 2029 plus a ≈$2.0B mobile-fleet acquisition *(SpaceX Form S-1, 2026-05-20 — xAI dossier)*. **[Analysis]** That makes it one of the largest mobile-turbine buyers anywhere, in a market where every AIDC developer is chasing the same units *(xAI dossier)*. Utilities are queued alongside them: Xcel ordered 10 × SGT6-5000F, 2,088 MW, for Texas, on the view that "dispatchable power is no longer optional" *(Siemens Energy release, 2025-10-01)*. That last point matters for anyone modelling relief — data centers are not competing only with each other for these units. They are competing with the utilities that would otherwise have served them.

### 4.4 How to read a deposit-backed slot reservation

The reservation is best understood as a financial instrument, and it repays a minute's attention because instruments like this appear at very specific points in a cycle.

GE Vernova's reservations price 10–20 points *above* the existing backlog and are taken with ≈20% cash down that converts to orders — the clearest scarcity-rent evidence in the sector *(December 2025 Investor Update transcript, 2025-12-09 — GE Vernova dossier)*. The deposit does three distinct jobs.

**It screens.** Expressions of interest are free, so in a shortage an OEM's inquiry book fills with projects that will never be built. You cannot expand a factory against a queue of maybes. A 20% cash commitment converts a costless signal into a costly one and separates funded projects from optionality. The deposit is, in effect, the OEM buying itself a reliable demand forecast.

**It transfers the financing.** Twenty percent down, years before delivery, means the buyer prefunds the manufacturer's working capital and part of its capacity expansion. It is customer-funded capex at no interest, collateralised by the customer's own need for the date. This is why order intake and backlog at these companies now grow alongside improving cash generation rather than at its expense.

**It creates a dated, priority claim with value independent of the machine.** Because slots are scarce, dated and convert to orders, the position itself is worth something. That is what makes the 10–20 point premium rational rather than a gouge. The buyer is not comparing GE Vernova's 2031 unit against Siemens Energy's 2031 unit — both are full. They are comparing "energize in 2031" against "energize in 2033, or not at all." The premium is priced against the option value of an earlier date, and a fifth of that premium is recovered in the first month of operation.

> **What the return of reservation fees actually tells you**
>
> A manufacturer charges a fee for a queue position only when the queue itself is valuable — that is, when it believes demand will exceed capacity for years rather than quarters. A company expecting competitive relief soon would simply take the order and keep the goodwill. So the reappearance of reservation fees at Siemens Energy, for the first time since the early 2000s, is a statement *from the supply side* that this is being underwritten as a multi-year cycle. It is the most credible forward indicator in the chapter, because it is a decision the seller had to put its own pricing behind.
>
> The historical rhyme is also the warning. The last time these fees appeared was the early-2000s gas boom, and the cycle that followed it ended badly for turbine OEMs — the capacity they added arrived into collapsing demand. When you see fees, you are seeing both the peak evidence of scarcity and the mechanism by which the next overbuild gets financed.

### 4.5 Transformers: the tighter, longer, more defensible bottleneck

Almost nobody outside the industry can say what a transformer does, so it is worth two sentences. Electricity is cheap to move at high voltage and useful only at low voltage; a transformer steps between the two. Every campus in this report touches the grid through one, and a large power transformer sits at the interconnection point converting transmission voltage down to something a substation can distribute.

Why are they so slow to build? Because a large power transformer is not a catalogue item. It is wound to the specific voltage, impedance and fault duty of one interconnection point, using grain-oriented electrical steel that is itself in short supply, plus bushings, tap changers and insulation from a narrow supplier base. Each unit must then be tested in a high-voltage test bay, and test-bay hours — not welding hours — are frequently the real gate on a factory's output. Finished units weigh hundreds of tonnes, which means rail clearances and bridge weight limits constrain both where they can be built and where they can be delivered. So they are not substitutable across projects, not stockable in inventory, and cannot be air-freighted out of a crisis. This is the sense in which the transformer shortage is more physical than the turbine shortage: money moves faster than a 400-tonne object on a heavy-haul route.

Hitachi Energy — the world's largest transformer maker — quotes 30–40 month waits, up to four years without a reservation, and rations access through reservation agreements *(Nikkei Asia, 2024-05 — Hitachi Energy dossier)*. The E.ON framework — up to $700M covering 20,000+ transformers under a capacity-reservation model — is first-party proof that transformer capacity is now allocated years ahead by reservation *(Hitachi Energy release, 2025-07-28)*. Note the direction of power in that sentence. When a utility of E.ON's size signs a framework simply to be *allocated*, the seller is choosing its customers. That is what a franchise looks like from the outside.

| Metric | What it says |
|---|---|
| **≈30% → ≈5%** | Modelled US power-transformer deficit, 2025 to 2030 — narrowing, not closing |
| **6.1% → 13.4%** | Hitachi Energy adjusted EBITA margin — earnings before interest, tax and amortisation — FY21 to FY25, on broadly the same product set |
| **≈80%** | Of US large power transformers are imported — domestic capacity is a scarce physical asset |
| **+77%** | US transformer prices since 2019; constraints modelled "well into the 2030s" |

The margin line is the one to sit with. Hitachi Energy's FY2025 orders were $32.8B, a 28% CAGR (compound annual growth rate) from $12.4B in FY21, with backlog at $57.9B — roughly 2.9x annual revenue — and adjusted EBITA margin of 13.4% against 6.1% in FY21 *(Hitachi Ltd FY2025 annual results presentation, 2026-04-27 — Hitachi Energy dossier)*. Q1 FY2026 orders rose 87% year on year with segment backlog above ¥10T, about $68B *(Investing.com, 2026-07-29)*. Nothing about these transformers became twice as good in four years. The queue became twice as long. Margin more than doubling on an essentially unchanged product is what scarcity looks like when it reaches a profit-and-loss account — and it is why the rent-versus-franchise test matters so much here. Sustained, that margin is a franchise. Temporary, it is the top of a cycle wearing a franchise's clothes.

Two suppliers have moved decisively to own the American end of this. GE Vernova paid $5.275B to consolidate Prolec GE — five US transformer plants among seven in the Americas, ≈10,000 employees — making it the most North America-weighted top-tier transformer maker *(Prolec completion, 2026-02-02 — GE Vernova dossier)*, with ≈$1B of Prolec capex planned across 2026–28 *(GE Vernova dossier)*. Siemens Energy's Grid Technologies segment now carries a €51B backlog on Q3 FY26 orders of €5.4B, up 28%, at a 19.9% margin, with transformers the largest single growth contributor *(Q3 FY26 earnings release, 2026-08-05 — Siemens Energy dossier)*. Both are buying into the ≈80% import gap, which is the most durable feature of the shortage: a US developer that needs a transformer delivered to a US substation cannot use spare European capacity without absorbing freight, tariff and schedule risk on a 400-tonne object.

### 4.6 Breakers: the cheap item that decides the date

A circuit breaker interrupts fault current. Without one you cannot legally or safely connect anything to a grid, so no substation energizes without its full complement. It is also, relative to a turbine or a transformer, almost incidental in cost — which is exactly why it is dangerous.

Project schedules are set by the longest item on the critical path, not the most expensive one. A campus with turbines on site and transformers energized still does not produce a megawatt if the high-voltage breakers are eleven months out. And because breakers are a small line item, they are the item most reliably underweighted in planning, least likely to have been ordered early, and most often the true cause of a slip that gets publicly attributed to something more glamorous. Lead times of ≈125 weeks — about two and a half years — are throttling load-center schedules, which is what Quanta Services' Hyosung HICO joint venture is aimed at: HV/EHV gas circuit breakers up to 800 kV, manufactured in Canonsburg, Pennsylvania *(Quanta Q2 2026 release, 2026-07-30 + dossier read — Quanta dossier)*. GE Vernova is expanding the same category at Charleroi, Pennsylvania, inside a $138M program adding ≈275 jobs through 2028 *(GE Vernova release, 2026-07-30 — GE Vernova dossier)*.

The Quanta move deserves a second look because of who is making it. Quanta is the largest US buyer of critical-path grid equipment, and it is becoming a maker of it — breakers now, and HV transformers via a $500–700M program that nearly doubles its capacity by 2028 *(2026 Investor Day, 2026-03-31 — Quanta dossier)*. **[Analysis — Moderate]** If the #1 buyer of grid equipment self-supplies from 2028, the scarcity rents currently flowing to Hitachi Energy, Siemens Energy and GE Vernova erode at the margin, and Quanta's bids gain a schedule weapon competitors cannot match; execution risk is real, since contractor-run manufacturing is a different discipline with no production track record yet *(Quanta dossier)*. Vertical integration by the biggest customer is one of the classic ways a rent ends, and it is under way in public.

### 4.7 Why relief is back-loaded — and what that does to today's prices

The supply response is real. It is also, without exception, late — and understanding *why* it is late tells you when the rent deflates.

An announced factory is not capacity. The sequence is: announce, permit and site, build, commission, qualify the product, ship first units, then reach full rate. Each stage takes quarters, and for high-voltage equipment the qualification stage is not a formality — utilities and hyperscalers type-test what they buy. That is why the fastest program in the table below still does not reach full production for a year after its first units, and why the largest does not open at all until 2028.

**Table 4 — The capacity response, and when it lands**

| Supplier | Committed spend | Lands | Scope | Citation |
|---|---|---|---|---|
| **Hitachi Energy** | $9B+ global / $1B+ US | 2028 | The $457M South Boston, Virginia plant, billed as the largest US transformer factory | *(Hitachi Energy release, 2025-09-04)* |
| **Siemens Energy** | +30–50% capacity | FY26–28 | Transformer and large gas-turbine capacity each +30–50%; medium turbines from ≈50 to ≈80 units/yr; ≈1/3 of a €6B FY26–28 capex program to transformers and switchgear | *(CMD 2025, 2025-11-20)* |
| **Siemens Energy** | $1B US | 2026–27 | $150M Charlotte, NC large-power-transformer plant — first units early 2026, full production 2027 — plus resumed Charlotte turbine manufacturing and a new Mississippi HV switchgear plant | *(Siemens Energy $1B US investment release, 2026-02-03)* |
| **GE Vernova** | ≈$1B Prolec capex; $138M PA program | 2026–28 | Prolec GE transformer capacity across five US plants; Charleroi, PA switchgear and breaker expansion adding ≈275 jobs | *(GE Vernova dossier; GE Vernova release, 2026-07-30)* |
| **Quanta Services** | $500–700M | 2028 | Nearly doubles HV transformer capacity; Hyosung HICO JV adds 800 kV breakers | *(2026 Investor Day, 2026-03-31)* |
| **Schneider Electric** | >$700M | through 2027 | Eight US sites, aimed at switchgear and medium-voltage capacity | *(Schneider release, 2025-03-25)* |
| **Eaton** | >$1B since 2023 | 2027+ | North American electrical manufacturing including Nebraska switchgear and a third US transformer site at Jonesville, SC, hiring from 2027 | *(Eaton dossier)* |
| **ABB** | $200M | 2026+ | European medium-voltage capacity — distribution-side scope, not transmission | *(ABB release, 2026-05-11)* |

**[Analysis — Moderate]** Cyclical risk is real but back-loaded: ≈$1.8B of announced US transformer investment across the industry all lands 2027–28, and pricing power — transformer inflation of +60–80% since 2020 — normalizes if utilities' ordering behaviour does *(Hitachi Energy dossier)*. **[Analysis]** Siemens Energy's choice of measured expansion plus shareholder returns, rather than a maximal capacity race, supports pricing power but *prolongs the bottleneck* *(Siemens Energy dossier)*. That second point is the one most often missed: the pace of relief is a management decision, not a physical constant, and the incumbents have every incentive to under-build.

Now the consequence that matters for valuation. Pricing power in this sector is a *stock of already-sold years*. GE Vernova expects to be largely sold out of 2030 deliveries by the end of 2026. So when new capacity arrives in 2028, it does not reprice the 2029 and 2030 book — that book is contracted. It reprices the *next* order. Revenue and reported margin therefore keep rising for years after the rent has begun to deflate at the margin, because they are being harvested from a backlog struck at peak scarcity. The deflation shows up first in the price of new business and in book-to-bill, and only much later in the income statement. Anyone watching revenue for the turn will be roughly two years late.

The same arithmetic runs through every product sold as schedule compression. Bloom Energy's entire AEP positioning is that fuel cells deploy in 6–9 months against ≈3 years for turbines **[Analysis — High]** *(Bloom Energy dossier)* — a premium justified entirely by the length of the queue it bypasses. Shorten the queue and you compress that premium too. Bridge power, prefabricated substations, battery-buffered microgrids and mobile turbines are all, economically, derivatives on the same scarcity.

### 4.8 What this means for your capital

**Treat the three incumbents as three different clocks, not one trade.**

GE Vernova holds the most visibly cyclical number in the sector: the 10–20 point premium on new slot reservations. Because it is a premium on *new* business, it is the first thing to compress when Siemens Energy's and Mitsubishi's capacity lands in 2028–2030 — the same windows GE Vernova is selling now. But the company has deliberately bought the other side of the test: Prolec makes it the most North America-weighted top-tier transformer maker precisely where the ≈80% import gap and the persistent deficit sit. The turbine business is rent with a date on it; the transformer business is closer to a franchise. The pairing risk is conversion — **[Analysis — Moderate]** a $176B backlog and 116 GW of commitments sit upstream of interconnection queues, gas-supply infrastructure and possible data-center demand revisions, and ≈20% deposits mitigate but do not eliminate slippage or cancellation *(GE Vernova dossier)*.

Siemens Energy made the decision that most directly sets when rent decays for everyone: +30–50% expansion plus up to €10B of shareholder returns instead of a maximal capacity race *(CMD 2025, 2025-11-20 — Siemens Energy dossier)*. That extends the pricing environment for itself and its competitors. The exposure is not operational, it is expectational — **[Analysis — Moderate]** roughly 70x earnings, a sell-side target range spanning €84 to €175, and a share price that fell on a 21% earnings beat; if the buildout's pace slows, today's book-to-bill and capacity expansion become cyclical exposure, the same dynamic that burned turbine OEMs after the early-2000s gas boom *(Siemens Energy dossier)*. Rent-supported margins carried at a growth multiple is the combination that requires the most care.

Hitachi Energy is the purest expression of the franchise case and the least diversified away from it. The deficit path — ≈30% in 2025 to roughly 5% by 2030 — is a narrowing, not a closing, and a reservation-allocation system across 60+ factories is what pricing discipline looks like when a seller can choose customers. Again the risk is what is already in the price: **[Analysis — Low]** the listed India subsidiary at 116x FY27 earnings, up 107.7% in a year, with two-thirds of its backlog dependent on HVDC — high-voltage direct current, the long-distance bulk transmission technology, and no relation to the 800 VDC rack architecture of chapter 6, is the clearest available warning that grid-scarcity pure-plays are priced for flawless execution *(Hitachi Energy dossier)*.

**What to watch, in rough order of how early it tells you something.** First, the price of new business rather than revenue — whether reservation premiums hold at 10–20 points, and whether Siemens Energy's reservation fees stay in place. Their withdrawal would be the earliest clean signal that supply has caught demand. Second, GE Vernova's own dated claim: largely sold out of 2030 deliveries by end-2026. It is checkable, and a miss would say appetite for the earlier date is softening. Third, book-to-bill — Siemens Energy's Gas Services ran 2.65 and GE Vernova's orders +88% organic; both fall well before revenue does. Fourth, the commissioning calendar in Table 4, watched for slippage rather than progress, since every quarter of delay extends the rent: Siemens Energy Charlotte to full production in 2027, Hitachi Energy South Boston operational 2028, Quanta's transformer doubling and breaker JV in 2028. Fifth, Quanta's manufacturing ramp specifically — the largest customer becoming a supplier is the structural, rather than cyclical, threat to all three. Sixth, on a slower cadence, revisions to Wood Mackenzie's deficit path; a steeper decline than ≈30% to ≈5% would move transformers from the franchise column toward the rent column.

**What would change my mind.** The strongest counter-argument to this chapter is already in the corpus and should be taken seriously: POWER Magazine's contrarian read that there is not a genuine transformer shortage at all, but a self-inflicted procurement problem *(POWER Magazine, 2026-01 — Hitachi Energy dossier)*. If that is right, the 2.5–4 year lead times are an artefact of how utilities order — late, in small lots, with changing specifications — rather than of physical capacity, and a change in buyer behaviour deflates much of the "franchise" without a single new factory being built. The dossier's own read supplies the mechanism: pricing power normalizes if utilities' ordering behaviour does. Watch for utilities and hyperscalers moving to standardised transformer specifications and multi-year framework ordering; that, not new capacity, is the fastest route to relief.

Three further falsifiers. On the demand side, only ≈20% of the 307 GW US data-center pipeline converts near-term, with the bulk 2028 and beyond *(Eaton dossier)* — scarcity rent depends on the demand curve as much as the supply curve, and a capex pause would deflate it faster than any factory, showing up in order books first. On the turbine call specifically: if Siemens Energy's and Mitsubishi's additions slip out of 2028–2030, or if reservation premiums *widen* rather than narrow through 2027, then turbine scarcity is behaving more like a franchise than modelled here and the rent has longer to run. On the transformer call: a burst of US greenfield large-transformer capacity materially beyond the ≈$1.8B already announced, or a deficit closing faster than the 2030 path, would collapse the distinction this chapter is built on — at which point both bottlenecks are rent, and the only question left is timing.

## 5. Building Your Own Power Plant — the Behind-the-Meter Playbook

A data center is a building full of machines that does nothing at all until electricity is flowing into it. For most of the industry's history that was a procurement detail: you asked the local utility for a connection, waited a while, and got one. That era is over. The wait for a grid connection large enough to run an AI campus is now measured in years, and the companies building those campuses have responded by doing something that would have sounded eccentric in 2020 — building their own power plants, on their own land, and running the data center off them. This chapter explains why that is a rational decision rather than a vanity one, what it costs, who has proved it works, what it has not solved, and where the money moves as a result.

### 5.1 What behind-the-meter means, and the arithmetic behind it

**Start with the meter.** The utility meter is a legal and financial boundary, not just a device. Generation that sits on the utility's side of it is **front-of-meter**: it feeds the grid, it is dispatched by the grid operator, and whoever buys the output buys it through the market or through a contract for delivered energy. Generation that sits on the customer's side of the meter is **behind-the-meter** (BTM): it feeds one load directly, and the electricity never enters the grid at all. Rooftop solar on a house is behind-the-meter. So is a 900 MW gas plant built inside the fence of an AI campus. The difference between the two cases is only scale — and scale is what makes the second one a market.

**Then the queue.** To connect a large new load to the grid, a developer joins an **interconnection queue**: an ordered process in which the grid operator studies what that load does to voltages, thermal limits and reliability across the network, assigns responsibility for the upgrades required, and eventually signs an **interconnection service agreement** (ISA) — the contract that permits the connection and sets who pays for what. Queues are slow because the studies are sequential, interdependent and re-run whenever someone ahead of you drops out. In the US today, campus-scale requests are quoted at **four to eight years** *(FlexGen solutions page — FlexGen dossier)*, with waits of up to roughly seven years cited at the extreme *(Bloom dossier)*.

Four to eight years is not a delay. For a company whose compute is already contracted, it is a different business plan. That is the entire origin of behind-the-meter power: if you build your own generation, you do not need the ISA to start, because you are not asking the grid for anything. You are buying time — and you are buying it at a knowable premium.

**Figure 7: Time to power by route (months from decision to energized; vendor claims and delivered projects)**

| Route | Time to power | Basis |
|---|---|---|
| Utility interconnection queue — *the thing being bypassed* | 48–96 months | FlexGen solutions page — FlexGen dossier (company claim) |
| New gas turbine, ground-up — *the conventional self-build* | ≈36 months | AEP framing carried in the Bloom dossier as **[Analysis — High]** |
| Reciprocating-engine plant (Wärtsilä), large plants | ≈12 months | Wärtsilä FY2025 bulletin and product pages — Wärtsilä dossier |
| Crusoe at Abilene, phase 1 — *delivered, not claimed* | ≈12 months | Crusoe release, 2025-09-30 — Crusoe dossier |
| Fuel cells as bridge prime power | 6–9 months | AEP framing carried in the Bloom dossier as **[Analysis — High]** |
| Fuel cells, Bloom at Oracle — *beat its own 90-day commitment* | 55 days | Bloom dossier, 2026-01-15 / 2026-04-13 |
| Factory-integrated storage block, 1 GWh (Tesla Megablock) | ≈20 business days | ESS News, 2025-09-09 — Tesla dossier |
| Mobile turbine set (GE Vernova TM2500), installed | 11 days | GEV gas-power pages — GE Vernova dossier |

*Note: these are not like-for-like. The queue row is a permitting-and-study process; the others are equipment delivery and commissioning, and none of them include fuel supply, land or air permits. The gap between the top row and the bottom rows is the whole subject of this chapter.*

> **Do the trade-off yourself: four numbers.** **(1) Queue time at this site,** in years. **(2) Self-build time** for the generation you can actually permit there, in months. **(3) The premium** you pay per watt for self-built capacity instead of a utility connection. **(4) The value of one year of earlier operation** for the load you have already sold. The decision rule is simply whether (1) minus (2) years of earlier revenue exceeds (3). What makes this trade resolve toward building so consistently is that the premium in (3) is a one-time capital number, while (4) is recurring — and for a campus whose compute is contracted before it is built, the recurring side compounds against a fixed cost. That asymmetry, not enthusiasm for gas turbines, is why behind-the-meter power became the default architecture for gigawatt AI campuses.

**Now put real numbers into (3).** The corpus gives two clean price anchors for self-built prime power. Bloom Energy's firmed 1 GW arrangement with AEP is priced at ≈$2.65B, which works out to ≈$2.65 per watt of capacity *(Bloom dossier, 2026-01-15 / 2026-04-13)*. Reserved combined-cycle gas turbine slots imply ≈$3,000/kW — the same thing as ≈$3.00 per watt *(GE Vernova dossier)*. Set those against what the rest of a campus costs to build: Quanta Services prices craft-led electrical spend inside the fence at ≈$13.5M per MW, explicitly excluding outside-the-fence power *(Quanta 2026 Investor Day, 2026-03-31 — Quanta dossier)*. Per megawatt, that is ≈$2.65M–3.00M of generation against ≈$13.5M of electrical work alone. Generation is a minority line in the campus budget. Paying a premium on a minority line to pull three to seven years of revenue forward is not a close call, and the industry has stopped treating it as one.

#### What behind-the-meter does not solve

Bypassing the queue does not bypass physics, chemistry or the law. Four residual problems survive, and each of them shows up later in this chapter as somebody's risk. **Fuel** — a gas plant needs a pipeline, and pipelines have their own schedules. **Air permits** — combustion is regulated by mass emissions, and a large enough plant becomes a **major source** requiring a full permit rather than the lighter **permit-by-rule** instruments used for smaller or temporary equipment. **Reliability** — one on-site plant with no grid behind it is a single point of failure, which is why almost every real campus keeps a grid connection as a supplement and buys storage as a buffer. And **the business you just entered** — you are now operating an unregulated generating station next to a community, with the litigation exposure that carries.

### 5.2 Template one: xAI — self-build at any cost

Two companies proved out behind-the-meter power at gigawatt scale, and they proved different things. Recognising which archetype a project belongs to tells you most of what you need to know about how it will behave.

xAI is the first archetype: vertical self-build, with speed as the only objective function. Colossus went from zero to **≈1.0 GW of nameplate compute draw** between 2023 and 31 March 2026, powered "almost entirely" by self-deployed behind-the-meter generation; the filing states the campus "is capable of operating entirely" off self-built generation. The grid is the supplement, not the source *(SpaceX Form S-1, 2026-05-20 — xAI dossier)*. For scale: TVA and MLGW grid allocations of ≈300 MW cover only a fraction of that load *(xAI dossier)*.

| The xAI bill | Figure |
|---|---|
| Colossus nameplate compute draw at 31 Mar 2026, from zero in 2023 | 1.0 GW |
| Documented on-site gas across the two campuses | ≈460 MW |
| Megapacks at Colossus 1 alone — claimed the largest deployment anywhere | >240 |
| Self-recorded litigation accrual against the turbine permitting suits | $399M |

*Source: SpaceX Form S-1, 2026-05-20 (draw, Megapacks); SemiAnalysis, 2025-12 (on-site gas: 12 SMT-130s at Memphis, 7 Titan 350s at Southaven); CNBC, 2026-04-14 (accrual) — xAI dossier.*

**The equipment tells the strategy.** A permitted permanent 1.2 GW / 41-turbine plant is under construction, while **69 temporary mobile turbines** exit between August 2026 and July 2027 under a Mississippi DEQ order *(CNBC, 2026-03-10 — xAI dossier)*. That two-layer structure — rent mobile capacity now, build permanent capacity behind it — is the purest expression of buying time. Mobile turbines are more expensive per megawatt-hour and less efficient than a permanent plant, and xAI took them anyway, because the alternative was idle GPUs. Procurement velocity matched: ≈$3.7B of turbine commitments in four months of 2026, plus Tesla Megapack purchases of $191M (2024), $506M (2025) and $34M (Q1 2026) — ≈$731M through Q1 2026, and ≈$731M–1B cumulative once SpaceX's Q2 2026 purchases of ≈$269–295M are included, with figures varying by source *(SpaceX Form S-1, 2026-05-20; xAI dossier)*.

**What this template proves.** That the physical schedule can be compressed far below what the grid offers, and that the compression is worth paying for. Cluster bring-ups are the evidence: **[Analysis — High]** speed-to-power, not model quality, is the differentiator — BTM gas plus Megapack buffering bypasses the queue entirely, and 64–91-day cluster bring-ups are the fastest independently corroborated *(xAI dossier)*. Colossus 1 reached ≈100,000 H100s in 122 days *(SpaceX Form S-1, 2026-05-20 — xAI dossier)*.

**What it risks.** Everything the queue would have absorbed on your behalf. The NAACP/SELC federal Clean Air Act suit is live; the turbine count itself is contested, with four different figures carrying four different evidentiary statuses (35 documented, 15 permitted backup-only, 27 alleged, 41 permitted); and the company has self-recorded a **$399M litigation accrual** *(CNBC, 2026-04-14 — xAI dossier)*. The economics are equally unsentimental: the AI segment lost $6.4B from operations on ≈$3.2B of revenue in 2025 *(TechCrunch — S-1 analysis, 2026-05-20 — xAI dossier)*. This archetype does not claim to be cheap. It claims to be first. And **[Analysis — Moderate]** related-party procurement is structural here: vendors negotiating with SpaceXAI should assume **Tesla gets first look at any storage scope** *(xAI dossier)*.

### 5.3 Template two: Crusoe — energy-first development, productized

Crusoe is the second archetype, and the more investable one as a business model: it does not build power plants for its own compute, it develops energy-first campuses and sells them to hyperscalers as a finished product. The customer buys megawatts on a date, not a construction project.

**The stack is the product.** Crusoe's procurement list reads like a supplier index for this entire report: 29 × GE Vernova LM2500XPRESS **aeroderivative** turbines (≈1 GW, five-minute starts — aeroderivatives are jet-engine derivatives, smaller and far faster to start than heavy-frame turbines) *(Crusoe release, 2025-01)*; ≈750 MW of Bergen **reciprocating engines** — piston engines rather than turbines, modular and quick to install (438 MW firm plus 310 MW LOI) with Piller dynamic stabilization for GPU transients *(Crusoe release, 2026-06-03)*; **5 GW of ON.energy medium-voltage "AI UPS" BESS** *(Crusoe release, 2026-07-21)*; 12 GWh of Form Energy iron-air 100-hour storage from 2027 *(Crusoe release, 2026-03-24)*; and two nuclear options for the next decade — Aalo's 10 MWe INL pilot in 2027 scaling to 50 MWe plants by end-2029 *(Crusoe release, 2026-07-30)*, and Blue Energy's gas-bridge-2028-to-nuclear-2031 path *(Crusoe dossier)*.

**What this template proves: repeatability.** Stargate Abilene phase 1 went live on Oracle Cloud Infrastructure within one year of construction start *(Crusoe release, 2025-09-30)*, and the 900 MW Microsoft Campus 2 pairs two 336 MW-IT buildings with a 900 MW on-site plant **plus medium-voltage battery storage** *(Crusoe release, 2026-03-27)*. **[Analysis — High]** Time-to-power execution at scale is the genuine edge: 200+ MW energized within a year, and a substation energized in under six months *(Crusoe dossier)*. Six months for a substation is the number to hold onto — substations are exactly the equipment the scarcity chapter shows to be rationed by multi-year lead time *(chapter 4)*, so doing one in under six months is a supply-chain and prefabrication achievement, not a construction one. Crusoe has industrialized it: its own factories in Arvada CO and Tulsa OK build modular data centers, power distribution centers and switchgear *(Crusoe dossier)*.

**What it risks: the customer.** A merchant developer's asset is its contract book, and Crusoe carries ≈4.9 GW contracted against a claimed 40+ GW pipeline *(Crusoe release, 2026-07)* — roughly an eight-to-one ratio between hope and signature. Single-customer decisions reshaped the company twice in 2026: the Oracle/OpenAI expansion halt *(Bloomberg, 2026-03-24 — Crusoe dossier)*, and Google pushing Crusoe off the 1.8 GW Tallgrass project in Wyoming over construction-cost and timeline concerns, after Crusoe had already demobilized ≈2 months before disclosure *(Bloomberg via Yahoo, 2026-06-10 — Crusoe dossier)*. And the permitting exposure is the same one xAI has, in a different form: **[Analysis — Moderate]** the gas fleet runs on minor "permit by rule" instruments with a pending major permit that would rank among Texas's largest fossil plants *(Crusoe dossier)*. The valuation has moved on execution promises rather than delivered earnings — $2.8B to >$10B at the October 2025 Series E to ≈$30B in talks by July 2026, on ≈$500M of estimated 2025 revenue *(Crusoe release, 2025-10-24; Bloomberg, 2026-07-02; Sacra estimates — Crusoe dossier)*.

**The two archetypes in one line.** xAI proves the schedule can be beaten and shows you what beating it costs in money and legal exposure. Crusoe proves that beating it is a repeatable service someone else will pay for, and shows you that the risk migrates from permits to customer concentration. Every other behind-the-meter project in the market is a blend of the two.

### 5.4 Why storage is in every single variant

Look across every behind-the-meter architecture in this chapter and one component never drops out: batteries. That is not fashion. It is because a generator and a GPU cluster disagree about time.

The primer separated storage products by discharge duration *(chapter 2)*; behind the meter, each duration is doing a specific, nameable job.

- **Milliseconds to seconds — hold the voltage steady.** AI training loads swing violently as thousands of GPUs synchronize. No mechanical generator can follow that; a rotating shaft has inertia and takes time to respond. Power electronics can respond in milliseconds, so a battery with a **grid-forming** inverter (one that sets voltage and frequency itself rather than following an existing grid) absorbs the swing and hands the generator a smooth load. This is why FlexGen positions campus BESS with grid-forming PCS for millisecond AI swings, deployable in under a year against 4–8-year queues *(FlexGen solutions page — FlexGen dossier)*, and why ABB has sold VoltaGrid 62 flywheel **synchronous condensers** — spinning machines whose only product is inertia and reactive power — into behind-the-meter AI campuses *(Engineering.com, 2026-03-25 — ABB dossier)*. **[Analysis — High]** That sale is the strongest independent validation that AI load volatility is purchasable as a product *(ABB dossier)*.
- **Seconds to minutes — cover the gap while iron starts.** Even a fast turbine needs time to come up. GE Vernova's aeroderivatives advertise five-minute starts *(GEV gas-power pages — GE Vernova dossier)*; five minutes with no power is a failed training run. Storage bridges it, and this is the job that makes storage a reliability component rather than an energy component. It is why xAI's Megapack fleet is described as enabling full off-grid operation during grid stress *(SpaceX Form S-1, 2026-05-20 — xAI dossier)*.
- **Hours — shave the peak and shrink the plant.** If storage covers the top of the load curve, the on-site plant can be sized to average demand instead of peak. Fewer turbines, less fuel, a smaller air permit. This is where the medium-voltage campus battery earns its capital directly, and why Crusoe committed to 5 GW of it.
- **Days — replace fuel with inventory.** Iron-air chemistry trades round-trip efficiency for cost per stored hour, making 100-hour duration economic in a way lithium is not. Crusoe's 12 GWh from 2027 and Google's anchoring of 30 GWh of the same technology are bets that long-duration storage becomes, in effect, interconnection currency — a way to promise firm output without a firm grid connection.

The practical consequence for an investor is simple: **storage is not an optional line item in a behind-the-meter campus, it is a functional requirement**, and it attaches at four different durations with four different products. Every buyer in the table below bought some of it.

**Table 5: Behind-the-meter posture by buyer — the same problem, six different answers**

| Buyer | Architecture | Storage content | Citation |
|---|---|---|---|
| **Oracle** | A per-site power menu: Project Jupiter (Doña Ana NM) up to 2.45 GW of Bloom fuel cells, *displacing planned gas turbines and diesel gensets*; Shackelford County fully off-grid on reciprocating gensets (115 MW live pre-delivery, 2.0 GW site); Abilene on ERCOT plus ≈360 MW of on-site GE Vernova turbines | Site by site; the "we pay our own way on energy" policy commits to on-site generation or Oracle-funded upgrades, with no ratepayer pass-through | *Project Jupiter announcement, 2026-04-27; Oracle post, 2026-01-26 — Oracle and Bloom dossiers* |
| **OpenAI** | Stargate sites span the whole menu: Shackelford 2.0 GW gas microgrid; Doña Ana 2.2 GW gas plus Bloom; Port Washington WI 1.3 GW at ≈70% solar/wind/battery; Saline Township MI 1.4 GW on DTE grid plus batteries | Battery-heavy at two of four named sites; LGES Vertech supplies the DTE program | *Epoch AI Stargate tracking — OpenAI dossier* |
| **Meta** | Prometheus (≈1 GW, online 2026) on 200→400 MW of behind-the-meter gas plus AEP transmission; the Hyperion/Entergy package adds seven gas plants (≈2.3 GW approved, ≈5.2 GW proposed) | Three grid-scale batteries in the Entergy package — storage bought utility-side, not by Meta | *Data Center Frontier; Meta, 2026-07-13 — Meta dossier* |
| **Google** | Bought the model outright — the ≈$4.75B Intersect Power acquisition brings ≈2.2 GW solar and 2.4 GWh BESS in-house for "energy parks": data centers co-located with behind-the-meter solar-plus-storage to bypass queues. First park at Haskell County TX | 640 MW solar + 1.3 GWh BESS at Haskell County; plus 1 GW of data-center demand response across five utilities | *PV Tech, 2026-03; Google, 2026-03-19 — Google dossier* |
| **Equinix** | Proves the colocation tier buys firm power too: the industry's largest colo fuel-cell fleet (Bloom, past 100 MW across 19+ sites), plus ≈1.25 GW of advanced-nuclear commitments and LOIs including Oklo 500 MW — the first colo-operator SMR deal | A 20-year take-or-pay with Central Georgia EMC in which Equinix funds 100% of grid upgrades | *Equinix dossier, 2025-08-14 / 2026-08-06* |
| **Huawei** (Red Sea) | The off-grid ceiling: 400 MW PV plus 1.3 GWh BESS, 100% renewable, 21+ months at 99.9% critical-load reliability | 1.3 GWh — the entire firming layer is storage | *ESS News, 2024-09-18 — Huawei Digital Power dossier* |

*__[Analysis — Moderate]__ The queue is the strategic enemy Google is engineering around — the playbook rivals will copy (Google dossier). __[Analysis — High]__ Equinix's choices function as procurement standards for the whole colocation tier (Equinix dossier). Note the split this table exposes: Oracle, OpenAI's developers, Google and Equinix buy power decisions directly; Meta buys them through its utility, which means the storage order is placed by Entergy, not Meta.*

### 5.5 The FERC line — what killed behind-the-meter nuclear, and what it cost

There is one exception to everything above, and it is instructive because it shows where behind-the-meter runs into a wall that money cannot move.

**Co-location** is the specific case of putting a large load directly next to an existing power plant and feeding it from that plant behind the meter. On paper it is the best deal in the industry: an existing nuclear station already produces firm, carbon-free, round-the-clock output, and a data center next door needs exactly that. No queue, no new plant, no construction risk. Talen Energy and Amazon tried it at Susquehanna. In November 2024, FERC refused to accept the amended interconnection service agreement, and the rejection was upheld in April 2025 *(Utility Dive, 2024-11 — Amazon dossier)*.

**Why it was refused, in economic terms.** A gigawatt-scale load sitting beside a reactor does not actually stop using the grid. It leans on the transmission system for backup when the reactor trips, for reliability services, and for the option to import. Those are fixed costs someone pays. If the co-located load is treated as fully behind the meter, it pays nothing toward them — and the reactor's output, which had been serving the regional market, is withdrawn from that market too. The costs do not vanish; they redistribute onto other users of the network, which is what **cost allocation** means and why **ratepayer** advocates fight these dockets. The precedent the dossiers draw from the ruling is blunt: **[Analysis — Moderate]** behind-the-meter co-location without cost allocation is dead, front-of-meter PPAs are the template — which pushes incremental firming demand toward grid-side assets, *including storage* *(Amazon dossier)*. Amazon's restructured front-of-meter PPA, ramping to **1,920 MW** of Susquehanna through 2042, is that workaround *(Talen release, 2025-06-11 — Amazon dossier)*.

**What the workaround costs.** Going front-of-meter means buying delivered energy at a contract price, and nuclear contract prices are now visible as a ladder.

- **≈$112/MWh** — analyst-estimated pricing for the Microsoft/Crane (Three Mile Island Unit 1) *restart*, roughly twice regional renewable rates *(Jefferies via Energy Connects, 2024-09 — Constellation dossier)*.
- **≈$70/MWh** — analyst-estimated pricing for Meta/Clinton, *existing* output from a reactor already running *(Utility Dive, 2025-06 — Constellation dossier)*.

The ≈$42/MWh gap between those two is the price of new firm capacity versus re-contracted firm capacity, and it explains Constellation's position: **[Analysis — High]** its pricing power — a $20–50/MWh premium band, with 920 MW of PPAs signed in a single quarter — is the market-defining asset *(Constellation dossier)*. Constellation carries ≈22 GW of nuclear at 94.7% uptime in 2025, and ≈30% of its clean baseload is now under long-term contract *(Constellation dossier)*.

**Even nuclear buys its way past the queue.** The Crane restart — 835 MW for ≈$1.6B, pulled forward from 2028 to 2027 — cleared its interconnection problem through a FERC waiver that transferred 760 MW of capacity interconnection rights from the retiring Eddystone units, skipping a multi-year queue, alongside a $1B DOE loan *(Constellation dossier)*. That is the cleanest single illustration of this chapter's thesis: queue position is itself an asset, and every serious participant is acquiring it, inheriting it, or building around it. **[Analysis — Low]** Crane hits its 2027 target — the staffing, inspections, fuel-license amendment and financing all point positive, but the environmental review only reached draft stage in mid-2026 and the process is regulatorily novel *(Constellation dossier)*.

**The door is being re-opened, on a schedule.** In December 2025 FERC granted Constellation's own complaint and ordered PJM to write transparent co-location and large-load tariff rules *(Utility Dive, 2025-12-18 — Constellation dossier)*. Management expects data-center deal flow to "kick off with a bit of a bang" once those rules land *(Constellation dossier, 2025-12-18)*. Watch that rulemaking: it is the single regulatory event that could change the arithmetic in section 5.1.

**And the timing verdict.** Corporate nuclear commitments are now enormous — Meta at ≈7.7 GW contracted across TerraPower, Oklo, Vistra and Clinton, the largest corporate nuclear commitment on record *(Meta, 2026-01-09 / 2025-06-03)*; Amazon targeting 5+ GW by 2039; Microsoft holding TMI for 2027 plus the world's first fusion PPA (Helion, ≥50 MW targeting 2028) *(Microsoft dossier)*. But nearly all of it delivers **2027 through the 2030s**. Nothing nuclear firms AI load this decade at scale. The gas-plus-storage bridge owns the rest of the 2020s by default, not by preference — and **[Analysis]** every nuclear PPA a hyperscaler signs reduces near-term appetite for firming storage at that particular load *(Constellation dossier)*.

### 5.6 What is actually for sale

The supply side has responded by converting all of this into products with time-to-power claims on the label. Read the right-hand column as marketing that has been forced to become specific — which is the most useful kind. One number is absent from every one of those labels and worth carrying yourself: **capacity factor**, the share of a year a plant actually produces at full output. It is what separates a nameplate megawatt from a delivered one — a gas turbine and a solar farm of identical nameplate are not comparable assets, and a fast-start aeroderivative bought for schedule will run at a low capacity factor *by design*. When a vendor quotes gigawatts, ask what fraction of the year those gigawatts show up.

**Table 6: Onsite-power products, compared on the claim that sells them**

| Offering | What it is | The headline claim | Citation |
|---|---|---|---|
| **Siemens Energy × Eaton** 500 MW block | Standardized SGT-800-based grid-independent campus power — redundant turbines plus battery storage, no diesel | 99.99%+ availability; up to **two years** off time-to-power. **[Analysis — High]** the most productized onsite-power offering from any major OEM | *Siemens Energy release, 2025-06-03 — Siemens Energy dossier* |
| **GE Vernova** aeroderivatives | LM6000, LM2500XPRESS and TM2500 mobile units | "Two weeks to power generation": five-minute starts, >99.8% availability, TM2500 installed in 11 days; Chevron "power foundries" target up to 4 GW for data centers by 2027 | *GEV gas-power pages; Chevron partnership, 2025-06-15 — GE Vernova dossier* |
| **Wärtsilä** engines | Reciprocating-engine power plants | 789 MW of first US data-center projects booked in 2025; a 429 MW / 24-engine utility order (Jan 2026); large plants operational in 12 months; 20–35% lower fuel consumption than turbines (company claim); Pure DC Ireland as Europe's first off-grid DC microgrid | *Wärtsilä FY2025 bulletin and product pages — Wärtsilä dossier* |
| **Bloom Energy** fuel cells | Solid-oxide Energy Servers — electrochemical, non-combustion generation, now shipped "800V DC ready" | A 55-day Oracle deployment that beat its own 90-day commitment; AEP firmed 1 GW at ≈$2.65B — **[Analysis]** the best public pricing benchmark for fuel-cell prime power at ≈$2.65/W. First $1B+ revenue quarter in Q2 2026; the Brookfield partnership expanded fivefold to $25B | *Bloom dossier, 2026-01-15 / 2026-04-13; 8-K, 2026-07-28; release, 2026-06-30* |
| **ABB × VoltaGrid** | 62 flywheel synchronous condensers for behind-the-meter AI campuses, delivered as prefabricated eHouse packages | **[Analysis — High]** the strongest independent validation that AI load volatility is purchasable — stabilization is now its own product category | *Engineering.com, 2026-03-25 — ABB dossier* |
| **FlexGen** | Campus BESS with grid-forming PCS | Millisecond response to AI swings, deployable in under a year against 4–8-year queues | *FlexGen solutions page — FlexGen dossier* |
| **Crusoe** Redwood microgrid | 20 MW microgrid on second-life EV batteries plus solar, built from 24 modular Spark units | 99.2% availability over its first seven months — a proof point that modular, non-combustion campus power runs | *Crusoe release, 2026-03-24 — Crusoe dossier* |

*__[Analysis — High]__ Bloom's core sale is time: 55–90 days against interconnect waits of up to ≈7 years — but the headline pipeline overstates firm demand, since the Oracle 2.8 GW figure is a ceiling with ≈1.2 GW contracted and management disclaims more than ≈6 months of visibility (Bloom dossier).*

> **A procurement constraint that lands inside this bill of materials: the FCC inverter determination**
>
> Every battery block in the tables above needs a **power conversion system** (PCS) — the inverter that converts the battery's DC to the campus's AC and back. On **28 July 2026** the FCC added foreign-produced connected power inverters to its Covered List, effective immediately. Covered-List products cannot receive FCC equipment authorization, which bars importing, marketing or selling them in the US. Three features of the rule matter for behind-the-meter procurement, and all three are widely misread.
>
> **It is an origin test, not a China rule.** "Foreign-produced" means failing the Buy American domestic-end-product test — US manufacture with domestic component cost above 65% through 2028, rising to 75% in 2029. An American brand manufacturing offshore is caught by it. **It is a two-prong test and both prongs must be met:** (a) the device is *bi-directional*, converting DC-AC or AC-DC, enumerated as microinverters, string inverters, central inverters and hybrid/battery-based inverters; and (b) it has connectivity enabling remote communication, control or monitoring by Wi-Fi, cellular, Bluetooth or similar. The stated rationale is remote firmware push by a foreign adversary. **And it is prospective only:** models authorized before 28 July keep their authorization and may still be imported and sold. This is a new-authorization freeze, not a market withdrawal. A conditional-approval path exists through the Department of War or DHS for applications filed to 1 January 2028, requiring ownership disclosure, a full bill of materials and supply-chain map, and a time-bound US onshoring plan; no review timeline has been published.
>
> **What this does to a campus bill of materials.** Storage PCS, hybrid and battery-based inverters and EV-charging equipment are inside scope. On a plain reading, a unidirectional AC-DC server power supply or power shelf with wired management (PMBus, IPMI/Redfish/SNMP over Ethernet) falls outside, and a DC battery block shipped without a PCS also falls outside — because there is no inverter in the scope of supply. Equipment lacking remote control, or using an air-gapped external control architecture, is reported to fall outside the determination as well. Any read of a specific company's exposure is analysis, not a sourced ruling. This corrects and supersedes the earlier description of this action as a pending, draft, China-specific rule.

### 5.7 What this means for your capital

**The mechanism to hold in mind.** A four-to-eight-year queue against a twelve-month self-build creates a spread, and that spread is being harvested by whoever can shorten a schedule. Generation is a minority line in a campus budget (≈$2.65–3.00 per watt against ≈$13.5M per MW of inside-the-fence electrical work), so buyers will overpay on it without hesitation to pull revenue forward. Everything that follows is a consequence of that one asymmetry.

**Where the economics favour the seller.** Anything that converts queue time into revenue time earns a premium as long as the queue holds: fast prime movers (aeroderivative and mobile turbines, reciprocating engines), non-combustion prime power that sidesteps major-source air permitting, medium-voltage campus storage with grid-forming controls, stabilization hardware, and the prefabrication that makes a substation possible in under six months *(chapter 8)*. Note where the pricing power actually sits — not in the cheapest kilowatt, but in the *earliest* one. Storage sits inside every variant at four durations, which makes it the most reliably attached content in the whole bill of materials *(chapter 7)*.

**Where the exposure sits.** Four places. *Permitting* — the xAI Clean Air Act suit and Crusoe's pending Texas major permit are the same risk in two jurisdictions, and both archetypes have already priced some of it (a $399M accrual on one side, permit-by-rule reliance on the other). *Customer concentration* — a merchant developer with an eight-to-one pipeline-to-contract ratio is one hyperscaler decision away from a demobilization, as Wyoming demonstrated. *Timing* — nuclear-levered positions are buying 2027-to-2030s delivery, which means they do not participate in this decade's firming demand. *Scarcity-rent normalization* — quotes built on 2026 pricing for 2028-and-later delivery are exposed when the announced capacity wave lands *(chapter 4)*.

**What to monitor, and on what clock.** Near-term, the PJM co-location and large-load rulemaking ordered by FERC in December 2025 — this is the one event that can compress the queue side of the trade, and Constellation's management has said out loud that deal flow waits on it. Through 2026–27, order books rather than announcements: GE Vernova, Wärtsilä and Bloom bookings are the honest read on whether behind-the-meter demand is converting, and Bloom's own disclaimer of visibility beyond ≈6 months tells you how to weight its pipeline. Through 2027, delivery proof: Crusoe's contracted gigawatts against its pipeline, the Microsoft Campus 2 first building due mid-2027, the exit of xAI's 69 mobile turbines between August 2026 and July 2027, and the Crane restart against its 2027 target. This is framing for understanding the sector's mechanics; it is not a recommendation to buy or sell any security.

#### What would change this view

- **The queue gets materially shorter.** If the PJM rulemaking plus interconnection reform pulls quoted campus waits from 4–8 years toward 2–3, the spread that funds this entire architecture narrows, and behind-the-meter reverts to a niche for sites with genuinely no grid option. Observable: quoted queue times in new project announcements, and hyperscalers routing new campuses back to utility service.
- **A court stops a behind-the-meter gas fleet.** An injunction or a denied major permit in either the xAI or the Crusoe matter would reprice the archetype's risk immediately and push demand toward non-combustion prime power. Observable: docket outcomes, not press coverage.
- **Firm clean power arrives early and cheap.** If restarts and SMRs start delivering inside this decade near the ≈$70/MWh existing-output level rather than the ≈$112/MWh restart level, the gas-plus-storage bridge shortens and the storage attach at hour-scale duration weakens. Observable: Crane's 2027 date holding, and SMR pilots meeting dates rather than slipping.
- **Order books flatten while announced gigawatts keep rising.** That divergence would mean the behind-the-meter story is announcement-led rather than delivery-led, and it would show up in the equipment makers' bookings well before it shows up in campus news.
- **The productized model fails to repeat.** If Crusoe's contracted capacity stops advancing toward its pipeline, the second archetype is unproven as a business, and behind-the-meter reverts to something only companies with xAI's tolerance for loss and litigation will do for themselves.

## 6. The 800-Volt Reset — Why a Wiring Change Reshuffles a Supply Chain

This chapter is about a change in how electricity is carried the last few hundred feet into a computer. That sounds like an engineering footnote. It is not. Changing the distribution voltage inside an AI data center invalidates the product catalogue of every company that sells power gear into it, re-opens every supplier slot at once, and creates two new equipment markets while shrinking an existing one. The change has a published schedule, a published vendor list, and a referee — **NVIDIA** — that sells none of the equipment involved. For an investor, this is the cleanest example in the sector of the moment when market share actually moves.

### 6.1 The physics that forced the change

Start with the only equation that matters here. Power equals volts times amps. A data center is handed a fixed amount of power to deliver, so it can carry that power as a lot of amps at a low voltage, or fewer amps at a high voltage. The choice is not cosmetic, because copper sizing tracks amps, not watts. Double the current and you need roughly double the metal. Worse, resistive heating rises with the *square* of current: halve the amps and you lose a quarter as much energy to heat.

For thirty years this was a non-problem. A conventional enterprise server rack drew something like 5 to 15 kilowatts — a few space heaters' worth. Distributing that at 415 volts alternating current, the global commercial standard, was trivial. Then AI racks arrived. NVIDIA's own product ladder runs from GB300 NVL72 racks in the 120–150 kW class today, to roughly 600 kW per rack with the Kyber generation in the second half of 2027, to a stated architecture target of "1 MW IT racks and beyond" in the Feynman era *(NVIDIA dossier)*.

**Figure 8: The forcing function — power per rack (kW, per generation)**

| Generation | Note | Power per rack |
|---|---|---|
| Conventional enterprise rack | the 30-year baseline | 5–15 kW |
| GB300 NVL72 | shipping now | 120–150 kW |
| Kyber / Rubin Ultra NVL576 | 2H 2027, native 800 VDC | ≈600 kW |
| Feynman era | company-stated target | ≈1,000 kW |

*Source: NVIDIA dossier — rack-power figures for Kyber and the Feynman target are keynote statements captured by trade press, not specification pages.*

Now do the arithmetic that made 415 volts untenable. A megawatt at 415 VAC three-phase is roughly 1,400 amps *per phase*, across three phase conductors. The same megawatt at 800 volts direct current is about 1,250 amps across two conductors. Multiply amps by the number of conductors that must carry them and the direct-current version needs roughly 40% less metal — which is why NVIDIA's published claim is up to 45% copper reduction, and why it notes that a legacy 1 MW rack carries up to 200 kg of busbar *(NVIDIA 800 VDC whitepaper, 2025-10-13 — NVIDIA dossier)*. Two hundred kilograms of solid copper bar, per rack, to move electricity the last two metres.

> **The vivid version: an 8,000-amp busbar**
>
> The current problem is worst at the very end of the chain, because legacy racks step down to roughly 54 volts inside the rack before feeding the chips. Low voltage means enormous current. **Delta**'s catalogue makes this concrete: its in-rack busbar is rated 8,000 amps at 50 VDC — and it is *liquid-cooled*, because air cannot remove the heat the copper generates *(800 VDC architecture deep-dive, 2026-05-28 — Delta dossier)*. Eight thousand amps carries only 400 kW. You cannot get to a megawatt this way; you run out of physics, not budget. NVIDIA's answer is to convert once, at the perimeter, and distribute high: 13.8 kV grid AC to 800 VDC, then a single conversion stage from 800 V straight to 12 V at the compute node, replacing 415/480 VAC distribution plus in-rack 54 V conversion — a chain NVIDIA says occupies 26% less area than the multi-stage version it replaces *(NVIDIA dossier)*.

**NVIDIA's published claims for the architecture**

| +157% | −45% | +5 pts | −30% |
|---|---|---|---|
| More power through the same copper versus 415 VAC | Copper reduction, up to | End-to-end efficiency, up to | Total cost of ownership |

*(NVIDIA 800 VDC whitepaper, 2025-10-13 — NVIDIA dossier)* These are vendor-published figures; each measures a different quantity and they are not additive. The efficiency gain has an honest mechanism behind it — cutting current cuts resistive loss with the square of the reduction, and deleting conversion stages deletes their losses outright.

The conclusion an investor should draw is that this was *forced*, not chosen. No committee decided that direct current is fashionable. A rack roadmap that ends at a megawatt leaves no alternative: convert once at high voltage and distribute DC, or stop building. That distinction matters commercially, because forced transitions do not stall on customer indifference. They stall only on supply.

### 6.2 What an architecture reset does to a supply chain

Here is the lesson that generalises far beyond power equipment, and it is the most valuable thing in this chapter.

An incumbent supplier's advantage is rarely its product. It is three things underneath the product: **qualification** (the customer has already tested and approved this part, and re-testing is expensive), **tooling and process** (the factory, the certifications, the field-service training already exist and are paid for), and **installed base** (thousands of deployed units that create pull for spares, upgrades and the next compatible generation). Those three assets are why market share in industrial equipment is so sticky, and why challengers with a better mousetrap so often go nowhere.

An architecture change partially destroys all three at the same moment. Qualifications were granted against the old interface and do not transfer. Tooling was built for the old voltage class, the old insulation ratings, the old switching devices. Installed base becomes a legacy obligation rather than a bridgehead — the next-generation site will not be built to match it. Every socket in the bill of materials is re-competed simultaneously, and the incumbent arrives at that competition holding roughly what a credible challenger holds: a design and a promise.

> **How to recognise one of these moments early**
>
> Three tells, all visible before revenue moves. **First**, an entity that does not sell the equipment publishes a new interface and names who may build to it — control of the interface has moved upstream of the vendors. **Second**, the incumbents' announcements describe reference architectures and portfolios rather than products with dates and named customers; "no commercial date disclosed" is the tell. **Third**, unfamiliar names appear in the same official list as century-old incumbents. When all three are present, share is being reallocated in engineering rooms, and it will show up in order books one to three years later. That lag is the opportunity and the risk: you can see the reallocation before it is priced, and you can also be early by years.

One important qualifier: a reset is an opening, not a lottery. Because qualification is slow and sequential, resets tend to be won by whoever qualifies *first*, and then re-consolidate. **LITEON** discloses the actual cadence — sampling from August 2026, a roughly 13-week qualification cycle, mass production in Q1 2027 *(LITEON dossier)*. Thirteen weeks per qualification, with a rack generation arriving every eighteen months, is why the vendors already inside the process are hard to dislodge and why the ones outside it are running out of calendar.

### 6.3 The spec-setter that sells no power equipment

NVIDIA sells accelerators and rack-scale systems. It does not sell transformers, switchboards, uninterruptible power supplies or batteries. Yet its published vendor slate functions as the qualification list for the entire next generation of data-center power equipment. The mechanism is worth understanding precisely, because it is the reason ordinary procurement signals are useless here.

An AI rack is bought as a system, not as components. The power path, the cooling path and the compute are co-engineered — a power shelf must match the rack's connector, its transient behaviour, its firmware and its thermal envelope. Whoever owns the rack design therefore owns the power interface by default. NVIDIA published the 800 VDC architecture at Computex on 2025-05-20 with an initial partner list of **Delta**, **LITEON**, **Megmeet**, **Eaton**, **Schneider**, **Vertiv**, Infineon and TI; at the Open Compute Project (OCP, the hyperscaler-led open hardware standards body) summit on 2025-10-13 it expanded the slate to the grid-equipment tier — **ABB**, **GE Vernova**, **Hitachi Energy**, Siemens and Heron Power *(NVIDIA 800VDC blogs, 2025-05-20 / 2025-10-13 — NVIDIA dossier)*. **[Analysis]** The grid tier joining the list moved 800 VDC from a server-vendor concern to a utility-interconnection concern — which is where large batteries live *(NVIDIA dossier)*.

The second mechanism is the digital twin, and it is the one investors most often miss. A hyperscale campus is now simulated before it is built. ABB's power systems are loaded as SimReady 3D assets into NVIDIA's Omniverse DSX blueprint; Eaton's Beam Rubin DSX platform aligns its power-and-cooling scope to the same blueprint; Schneider's ETAP electrical models and AVEVA software are embedded in it; GE Vernova's reference designs carry Omniverse twins *(ABB, 2026-06; Eaton, 2026-03-16; Schneider, 2026-03-16; GE Vernova whitepaper, 2025-10-24)*. A vendor whose equipment exists as a validated object inside the model the customer designs in has been selected before a request for proposal is written. **[Analysis — High]** Schneider's own edge is described exactly this way — co-developed designs pull its hardware into projects before competitive bidding starts *(Schneider dossier)*.

Two consequences follow. The *observable* that matters is slate membership and reference-design inclusion, not announced orders; orders are the lagging confirmation of a design-in that happened years earlier. And the risk of exclusion is severe and quiet — a vendor that is not in a reference design does not lose a bid, it simply never sees one.

### 6.4 The published clock

Unusually for a technology transition, the calendar is public. That makes the window measurable rather than a matter of faith.

| Date | Event | Why it matters | Source |
|---|---|---|---|
| 2025-05 | Computex: 800 VDC architecture unveiled; component partner slate named | The qualification window opens. Incumbent catalogues become legacy on this date | *(NVIDIA 800VDC blog, 2025-05-20 — NVIDIA dossier)* |
| 2025-10 | OCP: slate expanded to the grid-equipment tier; two-tier storage hierarchy published | Brings transformer and MV-equipment makers into a rack-power fight, and writes storage into the architecture | *(NVIDIA 800VDC blog, 2025-10-13 — NVIDIA dossier)* |
| 3Q 2026 | First 800 V HVDC shipments — NVIDIA (Vera Rubin) and Google adopt first | Revenue starts. First proof of who actually ships versus who presented | *(TrendForce, 2026-06-15 — NVIDIA/Delta dossiers)* |
| Q3 2026 | **Delta** ±400 VDC enters mass production | The intermediate step: DC distribution at half the voltage, using the same skills | *(TrendForce, 2026-06-15 — Delta dossier)* |
| 2H 2026 | **Vertiv**'s full 800 VDC portfolio releases — rectifiers, DC busway, rack DC-DC, DC-compatible backup | The incumbent hedge arrives ahead of Kyber, but a portfolio is not a switchboard | *(Vertiv release, 2025-10-13 — Vertiv dossier)* |
| Q4 2026 | Delta 800 VDC small-volume production | The leader's own gating step before the volume ramp | *(TrendForce, 2026-06-15 — Delta dossier)* |
| Q1 2027 | LITEON 800 V mass production — ASIC customers first (application-specific integrated circuits: the custom AI accelerators hyperscalers design in-house as alternatives to merchant GPUs), GPU clients "potentially Q2 2027" | The number-two vendor concedes roughly two quarters and routes around them <span class="an">Analysis</span> (High) | *(LITEON dossier)* |
| 2H 2027 | **Kyber racks** — 576 Rubin Ultra GPUs, ≈600 kW per rack; full-scale 800 VDC production coincides | The window closes. Whoever is qualified is the supplier for the generation | *(Tom's Hardware GTC record, 2025-03-18; NVIDIA whitepaper — NVIDIA dossier)* |
| 2027 | GE Vernova's hyperscaler decision on 1,000 solid-state transformers, if spec is met | The single largest binary event in the grid-side layer | *(December 2025 investor update — GE Vernova dossier)* |
| Feynman era | "1 MW IT racks and beyond" | The architecture's stated destination, and the reason there is no path back to AC | *(NVIDIA dossier)* |

Read the clock as a two-year auction with a hard close. The stakes are large in absolute terms: third-party rankings put the top five data-center power vendors — Schneider, ABB, Eaton, Vertiv and Delta — at roughly 41–43% of a $35B data-center power market *(ABB dossier)*. Reallocating even a modest share of that, plus the new markets the architecture creates, is the prize.

### 6.5 The rack-power tier — who is ahead, and on what evidence

Three companies build the equipment that sits inside or beside the rack and turns incoming power into the DC the chips consume: power shelves, the individual power supply units inside them, the DC-to-DC converters, and the battery and capacitor shelves that ride through disturbances. This tier is where the reset is most advanced and most measurable.

| Vendor | Position today | The 800 VDC stack | Volume timing | The catch |
|---|---|---|---|---|
| **Delta** | #1 in NVIDIA's AI-server power ecosystem; first-qualified across GB200/GB300 shelf sets; ≈70% of Blackwell-platform PSUs; reported above 50–60% of AI-server AC/DC, with a reported exclusive on NVIDIA DC-DC modules *(WAWT, 2026-04-20; KGI, 2025-07-01; CommonWealth — Delta dossier)* | The deepest published catalogue: a 660 kW in-row power rack built from six 110 kW shelves each embedding an 80 kW battery unit — **480 kW of backup per rack**; 18.5 kW PSUs at up to 98%; a solid-state transformer taking medium-voltage AC to 800 VDC at 98.5%; supercapacitor shelves to 10 seconds; a silicon-carbide electronic fuse clearing faults in under 3 microseconds; a claimed grid-to-chip gain above 4 points to ≈92% *(800 VDC deep-dive, 2026-05-28 — Delta dossier)* | ±400 VDC mass production Q3 2026; 800 VDC small volume Q4 2026; true volume 2027 | AI data-center power and cooling crossed **50% of company revenue** in Q2 2026 — concentration cuts both ways *(Q2 results, 2026-07-29 — Delta dossier)*. **[Analysis — High]** Structurally advantaged into the 800 V generation *(Delta dossier)* |
| **LITEON** | #2 at ≈30% of AI-server power against Delta's 60%-plus, per brokerage estimates *(fiisual — LITEON dossier)* | The battery-backup franchise is the structural asset: investing since 2010, first large cloud adoption 2017, 2025 shipments roughly 30× the prior year, and the unit moved from optional on GB200 to standard on GB300 and Rubin. Its 800 V rack embeds both battery and supercapacitor shelves — a 12 kW/2U battery shelf holding 45 seconds at full power, a 22 kW/3U 800 V supercapacitor shelf holding 60 seconds *(LITEON dossier)* | Sampling August 2026 → ≈13-week qualification → mass production Q1 2027; ASIC customers first, GPU clients "potentially Q2 2027" | <span class="an">Analysis</span> (High) One generation behind Delta on the GPU-side ramp, and routing around it through custom-silicon customers. The $919M McKinney, Texas plant moves non-China capacity to 60% by end-2026 *(release, 2026-07-13 — LITEON dossier)*. **[Analysis — High]** Its strongest products become non-discretionary content *(LITEON dossier)* |
| **Megmeet** | The only mainland-China power supplier NVIDIA has named for GB200 NVL72 power, chasing a market roughly 74% held by Taiwanese suppliers (Delta ≈41%) *(SmBom, 2025-05-22; Megmeet dossier)* | First mover on the Kyber 800 V sidecar — an external cabinet converting 480/380 VAC to 800 VDC — with the full grid-to-GPU chain shown, including a solid-state transformer above 98.5%, 33 kW and 110 kW shelves, and configurable battery and supercapacitor shelves *(releases, 2025-05-21 / 2026-04-13 — Megmeet dossier)* | Claimed first mover; no disclosed volume date. Dallas lab expanding to 1.5 MW | By its own statements AI-server power orders were still small-batch and small-value with uncertain timing; FY2025 profit fell 66.6% funding the pivot, and the stock took three limit-downs in four July sessions *(Megmeet dossier)*. **[Analysis — High]** The 2026-08-27 half-year report is the first hard test of whether AI data-center revenue materialised *(Megmeet dossier)* |

The pattern to notice: the leader's advantage is not a better converter, it is *calendar position*. Delta is one to two quarters ahead of the number two and an unknown distance ahead of the challenger, in a market where a 13-week qualification and an 18-month product cadence mean two quarters is most of a generation. That is the whole ballgame in a reset.

Below the three of them sits the smaller-entrant tier, which is instructive about how outsiders get in at all. **Sinexcel** stood up a dedicated AI-data-center division in June 2025 to develop high-voltage DC systems and solid-state transformers on its power-quality heritage; its actual shipping exposure is a 36 kW HVDC rectifier module which third-party reporting says goes *to Vertiv* — indirect NVIDIA exposure through an incumbent's box — at a claimed ≈100 W per cubic inch against an ≈70 industry average *(海之理财, 2025-10-09 — Sinexcel dossier)*. **[Analysis — Moderate]** Pre-revenue optionality; the H1 2026 report, due 2026-08-11, is the checkpoint for the first AI-data-center revenue disclosure *(Sinexcel dossier)* — this report's corpus closes before that filing, so the disclosure itself is not in evidence here. Elsewhere on the long tail, **Bloom Energy** now ships every Energy Server "800V DC ready" for direct DC integration *(datasheet, 2026-02 — Bloom dossier)*, and **Jinko**'s Sunny 365 AI-data-center edition claims 800 V HVDC compatibility for solar-plus-storage supply *(release, 2026-08-04 — Jinko dossier)*. The route in is to become a component inside somebody who is already qualified.

> **Correction and clarification: what the FCC inverter action actually does**
>
> Because two of the challengers here are Chinese power-electronics makers, the July 2026 FCC action is routinely mis-read as a wall across their path. It is narrower and differently shaped than that, and the earlier edition of this report described it incorrectly. The corrected position: on **28 July 2026** the FCC added foreign-produced connected power inverters to its Covered List, effective immediately. Covered-List products cannot receive FCC equipment authorization, which bars importing, marketing or selling them in the US.
>
> Four features decide who is caught. **It is not a China rule — it is an origin test.** "Foreign-produced" means failing the Buy American domestic-end-product test: US manufacture with domestic component cost above 65% through 2028, rising to 75% in 2029. An American brand manufacturing offshore is caught; Delta and LITEON are foreign-produced too. **It is a two-prong test and both prongs must be met** — (a) a *bi-directional* device converting DC to AC or AC to DC, enumerated as microinverters, string inverters, central inverters and hybrid or battery-based inverters, and (b) connectivity enabling remote communication, control or monitoring by Wi-Fi, cellular, Bluetooth or a similar connection. The stated rationale is remote firmware push by a foreign adversary. **It is prospective only**: models authorized before 28 July keep authorization and may still be imported and sold — a new-authorization freeze, not a market withdrawal. **There is a conditional-approval path** through the Department of War or DHS, applications open to 1 January 2028, requiring ownership disclosure, a full bill of materials and supply-chain map, and a time-bound US onshoring plan; no review timeline has been published. Equipment lacking remote control, or using air-gapped external control architecture, is reported to fall outside the determination.
>
> What that means mechanically for this chapter's subject matter. **[Analysis — Moderate]** A unidirectional AC-to-DC server power supply or power shelf, managed over wired interfaces such as PMBus or IPMI/Redfish/SNMP over Ethernet, falls outside the determination on a plain reading — it is not bi-directional, and its management is not wireless. A DC block shipped without a power conversion system also falls outside, because there is no inverter in the scope of supply. Hybrid and battery-based inverters, storage conversion systems and EV-charging equipment are inside. The investor consequence is that the FCC action bites the storage and charging lines of a company like Sinexcel far more directly than it bites rack-power ambitions, and that the rack-power reset is being decided by qualification calendars, not by this rule. Any read of a named company's exposure here is our analysis, not a published ruling on that company.

### 6.6 The incumbents' net-content problem — and the grid tier bidding for the perimeter

The three large Western electrical incumbents in this file — **Vertiv**, **Eaton** and **Schneider** — face a problem that is easy to state and hard to solve, and it is not a product problem. It is an accounting problem about content per megawatt.

Define the term, because it is the single most useful lens on this transition. **Content per megawatt** is the dollar value of one vendor's equipment inside each megawatt of data center built. A vendor can win every design review and still shrink if the architecture removes more of its dollars than it adds. The centralized uninterruptible power supply — a large, expensive, room-scale machine that sits between the utility and the data hall and holds the load up through disturbances — is exactly the content at risk. When ride-through moves into batteries and capacitors inside the rack, and when conversion moves to a solid-state transformer at the perimeter, the big central machine's job is partially distributed away from it.

**[Analysis — Moderate]** Independent analysis projects that 800 VDC **contracts the centralized UPS market** — a core Vertiv, Eaton and Schneider franchise — while creating roughly $11B of power-rack and roughly $13B of solid-state-transformer markets, and **no incumbent has yet named a shipping 800 VDC switchboard product** *(SemiAnalysis via Vertiv and Eaton dossiers)*. Note the shape of that trade: the shrinking business is one the incumbents own, and the growing businesses are ones they must win. Winning them is not automatic — the power rack is the rack-power vendors' home turf, and the solid-state transformer is being contested by grid-equipment makers and start-ups. Meanwhile the total pie per megawatt is getting larger, not smaller: Goldman-attributed modeling cited in the Delta dossier has 800 VDC raising bill-of-materials cost per watt by roughly 43%, with Delta capturing the largest share *(Delta dossier)*. Morgan Stanley is reported sizing the power-rack segment above RMB 30B for 2026 alone *(Delta dossier)*.

**Figure 9: The content swap — new markets the architecture creates (US$ billion, third-party estimates)**

| Market | Note | Estimate |
|---|---|---|
| Solid-state transformers | perimeter conversion, market forming | ≈$13B |
| Power racks | the in-row conversion cabinet | ≈$11B |
| AI-server battery backup, 2033 | rack-level storage | ≈$7.1B |
| AI-server battery backup, 2026 | starting point | ≈$2.8B |

*Source: SemiAnalysis via Vertiv and Eaton dossiers (power-rack and solid-state-transformer estimates); TrendForce via NVIDIA dossier (battery-backup market). These are the markets the architecture creates; the corpus holds no comparable public estimate for the size of the centralized-UPS contraction on the other side of the ledger, which is why this is framed as a net-content question rather than a computed net number.*

**Where each incumbent actually stands**

| Vendor | Shipping or announced | Date | Read |
|---|---|---|---|
| **ABB** | HiPerGuard, the industry's first static medium-voltage UPS (2.5 to 25 MW, 98% efficiency, now a 34.5 kV class that removes a conversion stage entirely), plus SACE Infinitus, the world's first solid-state circuit breaker certified to IEC standards — the International Electrotechnical Commission, the international counterpart to UL; roughly 40% of its electrification research is aimed at next-generation data-center technology *(ABB dossier, 2026-07-16 / 2025-10-13)* | Shipping | **[Analysis — High]** Winning the medium-voltage layer and the architecture incumbent for the next rack generation; Eaton, Schneider and Vertiv compete at low voltage *(ABB dossier)*. The structural gap: ABB sold its grid and transmission business to Hitachi before this cycle, so it cannot supply the transformers and HVDC its own campuses' grid connections need **[Analysis — High]** *(ABB dossier)* |
| **Vertiv** | Full 800 VDC portfolio — centralized rectifiers, DC busway, rack DC-DC converters, DC-compatible backup; PowerDirect Rack already in shelf territory, AC and HVDC input compatible *(releases, 2025-10-13 / 2025-03-18 — Vertiv dossier)* | 2H 2026 | Ahead of Kyber, and the most centralized-UPS content at risk of any vendor here. A portfolio release is not a switchboard, and the binding risk is execution **[Analysis — Moderate]** *(Vertiv dossier)* |
| **Eaton** | OCP reference architecture staking supercapacitor fast-cycle backup plus ORv3 busbar, packaged as Beam Rubin DSX; busway rated to 600 VDC; market-first detection of subsynchronous oscillations caused by AI GPU load bursting, delivered to the installed base by remote firmware update *(releases, 2025-10-13 / 2026-03-16 / 2025-09-09 — Eaton dossier)* | Reference stage | Strong on the transient problem and buying the replacement content rather than defending the old content — the Resilient Power solid-state-transformer purchase is the tell. The switchboard gap stands |
| **Schneider** | An 800 VDC sidecar for racks to 1.2 MW with integrated energy storage *(release, 2025-10-13 — Schneider dossier)* | No commercial date | The design layer is the real asset: **[Analysis — High]** NVIDIA co-developed designs pull its hardware into projects before competitive bidding starts *(Schneider dossier)*. On hardware it is the furthest from a date |
| **GE Vernova** | Three jointly developed AI-factory 800 VDC reference designs (grid-connected, islanded, bridging) converting 13.8 kV AC to 800 VDC at the perimeter via solid-state transformers and industrial rectifiers; an R&D cost-share with a hyperscaler carrying a commitment to buy **1,000 solid-state transformers from 2027** if spec is met *(whitepaper, 2025-10-24; December 2025 investor update — GE Vernova dossier)* | SST 12–24 months from commercialization, 24–36 from industrialization | **[Analysis — Moderate]** If the spec lands, GE Vernova leapfrogs the AC-switchboard incumbents into the perimeter; if it slips, the ≈$13B market forms around Heron Power-class challengers instead *(GE Vernova dossier)* |
| **Hitachi Energy** | Co-designed grid-to-rack conversion for 800 VDC racks from 3 MW to gigawatt class, with a claimed 15× power-supply increase; prefabricated Grid-eXpand connection substations alongside it *(NVIDIA collaboration, 2025-10 — Hitachi Energy dossier)* | Co-design stage | **[Analysis — Moderate]** Its edge is owning the grid side of the interface — it is the transformer and HVDC gatekeeper (chapter 4); its gap is no UPS or rack installed base *(Hitachi Energy dossier)*. The 15× claim is company-published and not independently verified |

The structural read across that table: the AC low-voltage incumbents are defending, the medium-voltage and grid tier is attacking, and the attack is aimed at the *perimeter* — the point where the campus takes power in. That is the highest-value real estate in the new architecture, because whoever converts at the perimeter defines the interface everything downstream must accept.

### 6.7 Storage becomes non-discretionary content

The most commercially consequential feature of the new architecture is not the voltage. It is that NVIDIA wrote energy storage into the specification, in two places, for two different physical reasons.

GPUs do not draw power smoothly. A training cluster synchronises tens of thousands of chips, so load steps up and down together, in milliseconds, by large fractions of total draw. Two different problems follow. Inside the rack, the voltage would sag on each step unless something local supplies current instantly — that is a capacitor's job, because capacitors deliver enormous power for very short times. At the boundary with the utility, the campus looks like a violently swinging load that the grid must absorb — that is a battery's job, because batteries supply meaningful energy over seconds to minutes. Hence NVIDIA prescribes a two-tier hierarchy: supercapacitors at the rack for millisecond transients, facility-level batteries at the interconnection for second-to-minute smoothing *(NVIDIA whitepaper, 2025-10-13 — NVIDIA dossier)*. GB300 NVL72 already productizes the rack tier: roughly 65 joules per GPU held in the power shelves, with ramp control, cutting peak grid demand by up to 30% *(NVIDIA blog, 2025-10 — NVIDIA dossier)*.

The word to hold onto is **non-discretionary**. A discretionary component is one a cost-focused buyer can delete. A component written into the reference design, sized against a physical requirement, and integrated with the firmware cannot be deleted without failing qualification. Battery backup units moved from optional on GB200 to standard on GB300 and Rubin, and LITEON's 2025 shipments ran roughly 30× the prior year *(LITEON dossier)*. That is what a component looks like when it stops being an option.

Three second-order effects follow, and each one is an investable mechanism.

1. **The duty cycle changed, so the product changed.** Rack storage sits at float charge for years and then discharges hard for seconds — the opposite of a grid battery's duty. LITEON's shelves are specified at 45 seconds at full power for the battery version and 60 seconds for the 800 V supercapacitor version, with microsecond switchover achieved because it writes the firmware on both the power supply and the battery side, and designs targeting two-minute ride-through explicitly to keep coolant pumps turning *(LITEON dossier)*. That last detail matters: in a liquid-cooled megawatt rack, losing the pump is worse than losing the compute. **EVE Energy** is attacking the same duty cycle from the cell up, with laminated pouch cells tuned for float-charge life across a three-layer portfolio — rack units, high-rate distribution cabinets, and grid storage *(OCP China 2026 — EVE dossier)*. **[Analysis — Moderate]** Real differentiation potential but no named wins; treat as 2027-plus optionality, since the incumbent suppliers own the server-OEM relationships *(EVE dossier)*.
2. **Volume is arriving faster than cell supply.** Each GB300 cabinet uses roughly five battery modules plus more than 300 supercapacitors, and supercapacitor supply is a genuine bottleneck; the AI-server battery-backup market is estimated at ≈$2.8B in 2026 rising to ≈$7.1B by 2033 *(TrendForce — NVIDIA dossier)*. Both **Samsung SDI** and **Panasonic** are reported supply-short in these cells *(The Elec, 2026-07 — Samsung SDI dossier)*. Shortage in a non-discretionary component is the most favourable condition a supplier can have, and it is showing up in results: Samsung SDI ended a seven-quarter loss streak with a KRW 203.8B operating profit in Q2 2026, company-attributed to AI-data-center UPS and battery-backup demand plus grid storage, and guides that line to grow more than 70% in 2026 *(Samsung SDI dossier)*; Panasonic booked ¥113B of data-center storage sales in its June-quarter, 1.9× year on year, against a ¥550B full-year forecast and a ¥800B FY2029 target its CEO calls "a minimum commitment", with Kansas EV lines physically repurposed to data-center cells *(Panasonic, 2026-03-25 / 2026-06-08 — Panasonic dossier)*.
3. **It expands the storage market rather than cannibalising it.** This is counter-intuitive and worth stating plainly. Putting energy storage in the rack could have replaced facility-level storage. **[Analysis — Moderate]** Instead, NVIDIA's rack storage legitimizes and expands the battery and supercapacitor market faster than it cannibalizes it — the GB300 feature set partially internalizes what would have been supplier revenue, while making storage-at-the-rack standard practice *(NVIDIA dossier)*. The two tiers solve different physics and do not substitute for one another.

### 6.8 What this means for your capital

**The core proposition.** This is a forced architecture change on a published two-year clock, in which the qualification advantage of every incumbent is partially reset and every socket in the power bill of materials is re-competed at once. Content per megawatt is going up — roughly 43% more bill-of-materials cost per watt on the Goldman-attributed modeling in the Delta dossier — so the sector-level question is not whether power vendors get more revenue per megawatt, but which ones.

**Where the mechanism points.** Calendar position is the asset. In a market with a 13-week qualification cycle and an 18-month rack cadence, being two quarters early is close to being a generation early; being two quarters late means selling into the following generation. That favours **Delta**, whose lead is documented in qualified position, catalogue depth and disclosed ramp dates rather than in claims — with the offsetting fact that AI data-center power and cooling is now more than half its revenue, which means its reported results now move with AI data-center demand far more directly than a diversified supplier’s would. It favours **LITEON** specifically where its content became mandatory, and its ASIC-first routing is a rational response to arriving second on GPUs <span class="an">Analysis</span> (High). In the incumbent tier, the read is that **ABB** is attacking from medium voltage with shipping product and no direct static-MV-UPS competitor at scale, while **Vertiv**, **Eaton** and **Schneider** have the most existing content at risk and, on the corpus's own evidence, no named shipping switchboard — with Eaton buying replacement content and Schneider defending through the design layer instead of the hardware layer. In storage, the rack tier is the rare case of a non-discretionary component in acknowledged short supply, which is why **Panasonic** and **Samsung SDI** results have begun to turn on it.

**Who is exposed.** Anyone whose earnings depend on centralized UPS content per megawatt holding constant. Anyone selling AC-era switchboard, busway or distribution product without a dated DC replacement and a named design-in. And the challenger tier generally — **Megmeet** and **Sinexcel** are both spending real money against an architecture thesis that has not yet produced disclosed revenue, which is a different risk from operational underperformance: it is timing risk on someone else's product cadence.

**What to monitor, and when.** Near-dated, the two challenger disclosures are the cleanest reads on whether the reset is converting into revenue: Sinexcel's H1 report was due 2026-08-11 and Megmeet's is due 2026-08-27, the latter being the first hard test of whether its AI-data-center revenue materialised *(Sinexcel and Megmeet dossiers)*. Through 2026, watch for first 800 V HVDC shipments in 3Q26 and Delta's Q4 2026 small-volume step. In 2027, three binaries land: Kyber's arrival in the second half, LITEON's Q1 mass production and GPU-client timing, and GE Vernova's hyperscaler decision on 1,000 solid-state transformers. Structurally, the highest-signal observable all the way through is not order announcements — it is slate membership and reference-design inclusion, because a vendor's presence inside the Omniverse blueprint precedes its orders by years.

**The generalisable habit.** Learn to spot the three tells from section 6.2 — control of an interface moving to a party that does not sell the hardware, incumbents announcing architectures instead of dated products, and unfamiliar names appearing in official slates beside century-old ones. That pattern recurs across industrial sectors, and it is reliably where share moves. This section is framing for understanding the market's mechanics, not a recommendation to buy or sell any security.

#### What would change my mind

- **An AC incumbent names a shipping 800 VDC switchboard with a date and a customer.** The whole "provable gap" argument against Vertiv, Eaton and Schneider rests on the absence of that announcement. One credible product disclosure retires it.
- **Kyber slips, or the megawatt rack does not arrive.** The forcing function is the rack roadmap. If ≈600 kW racks move materially past 2H 2027, the qualification window stretches, incumbents get time, and the challengers' spending runs longer against no revenue. NVIDIA's own product cadence is the observable.
- **The industry settles on ±400 VDC for a generation instead of 800.** Delta is mass-producing the ±400 V line from Q3 2026. If buyers stop there, the reset becomes an increment, far more of the AC-era skill base and tooling survives, and the content swap is much smaller than Figure 9 implies.
- **Megmeet's H1 shows material AI-data-center revenue.** Two readings are live, and the same datapoint separates them: material revenue means the reset genuinely reallocated share to a challenger and Delta's dominance is contested; another immaterial print means the reset is being consolidated by the vendors who were already inside it.
- **Rack storage attach rates fall.** The non-discretionary-content argument breaks if facility-level batteries or in-silicon power management substitute for rack batteries and supercapacitors. Watch modules per cabinet and any reference-design revision that removes the rack tier — and watch whether the reported cell shortage clears without price concession, which would suggest demand was softer than the attach story implies.
- **GE Vernova's solid-state transformer misses spec.** The 1,000-unit commitment from 2027 is the single largest binary in the perimeter layer. A miss redirects the ≈$13B market toward start-ups and weakens the grid tier's claim on the interface.

## 7. Grid Storage — the Market That Flipped

A battery is the only major piece of power equipment in this report that can be ordered, shipped and switched on inside a year. Turbine slots are selling against 2031 delivery; transformers run 30–40 months with a reservation and four years without one *(the scarcity chapter)*. A battery block is built on a factory line, moves on a truck, and energises in months. That one asymmetry explains almost everything that happened to this market in 2025–26 — including why storage went from the sector's discount bin to its profit engine in roughly eighteen months, and why nearly every company under coverage now has a storage story to tell you.

This chapter is organised around a single distinction, because an investor who blurs it will misread every ranking, every share number and every regulatory exposure in the sector: the difference between a company that makes **cells**, a company that packages cells into a **DC block**, and a company that delivers a finished **AC system** at the point where the project meets the grid. Those are three different businesses, with three different margin structures, three different competitive sets and — as of 2026 — three different regulatory risk profiles.

### 7.1 What a BESS project actually consists of

A **BESS** — battery energy storage system — is a stack of five things, and it is worth walking up the stack once, because each rung is a separate industry.

At the bottom is the **cell**: the electrochemical unit, a sealed prismatic can of lithium iron phosphate (LFP) chemistry, rated in ampere-hours (Ah). Ah is a measure of charge, not energy; multiply by cell voltage — 3.2 V for LFP — to get watt-hours. A 314 Ah cell holds roughly a kilowatt-hour. Cell manufacturing is a capital-intensive, yield-driven process business: the plant costs billions, the line runs continuously, and profitability is a function of utilisation and scrap rate. It behaves like semiconductors or float glass, not like machinery.

Above the cell is the **module** and then the **DC block**: cells wired in series and parallel inside a steel enclosure, with a battery-management system (BMS) watching every cell's voltage and temperature, liquid cooling, fire detection and suppression. A DC block is direct current only. It cannot be connected to a grid. It is an inert box of stored charge with a communications port.

The thing that makes it useful is the **PCS** — power conversion system, in plain English a large bi-directional inverter. It converts the block's DC into grid-frequency AC when discharging and AC back into DC when charging. Bi-directionality is the whole point of a storage inverter, and it will matter again in a moment. Above the PCS sits the **medium-voltage step-up** — transformer and switchgear that lift a few hundred volts AC to the 13.8 kV or 34.5 kV class the site actually interconnects at. And governing all of it is the **EMS** — energy management system — the controller that decides, second by second, whether the plant charges, discharges, holds frequency, rides through a fault or bids into a market.

A company that delivers the whole stack as one commissioned, warranted, AC-connected plant is an **integrator**. That is the job with the customer relationship, the performance guarantee and the long-tail liability. It is also the job most exposed to execution: an integrator promises a megawatt at a meter on a date, and eats the cost of everything between the cell and that promise.

**Table 1: The three layers, and who occupies them**

| Layer | What it actually delivers | Who sits here | What determines whether it makes money |
|---|---|---|---|
| **Cell maker** | The electrochemical unit, sold by the gigawatt-hour to whoever assembles systems — including to competitors | **CATL**, **EVE**, **Hithium**, **LG Energy Solution**, **Samsung SDI**, **Panasonic** | Plant utilisation and cell price. A commodity with a technology ladder — the ladder is the only escape from the commodity |
| **DC block** | An enclosure of cells, modules, BMS, cooling and suppression. No inverter. Ships as direct current | Every cell maker with a systems arm, plus integrators who buy cells and build their own enclosures | Cost per kWh of enclosure, cooling and connections — an assembly and logistics margin |
| **Integrator (AC system)** | The finished plant: DC blocks plus PCS, MV transformer and switchgear, EMS, commissioning, warranty and multi-decade service | **Sungrow**, **Tesla**, **Fluence**, **BYD**, **CATL**, **LGES Vertech**, **Wärtsilä** (moving to the RCT JV), **FlexGen** (software and services only) | Execution and balance sheet. Margin is earned on schedule, availability and the credibility of a 20-year promise |

The vertically integrated players — CATL, BYD, Sungrow, Tesla, LGES, Samsung SDI — occupy two or three of these rungs at once. That is why their reported gigawatt-hours are not comparable with each other or with a pure-play integrator's. CATL's ESS cell sales include cells that end up inside a rival's containers. Tesla's deployments count finished AC systems. Add them together and you double-count the same electrons.

> **Power, energy, and why the two headline numbers never match**
>
> Storage is quoted in two units and they measure different things. Megawatts (MW) is *power* — how fast the plant can push. Megawatt-hours (MWh) is *energy* — how much it holds. The ratio is *duration*: a 100 MW / 400 MWh plant is a four-hour battery. So when you read that the market passed 100 GW of annual installations in 2025 *(ESS News, 2026-07-14 — Fluence, Tesla and Wärtsilä dossiers)* while the ESS cell market reached 612 GWh *(InfoLink via ESS News, 2026-02-09 — Hithium and EVE dossiers)*, those are not inconsistent — they are power and energy respectively, and the gap between them is the market drifting toward longer duration. Duration is the single most useful thing to know about a storage order, and it is the thing press releases most often omit.

> **Why the layer distinction is now a regulatory fact, not just a taxonomy**
>
> On 28 July 2026 the FCC added foreign-produced connected power inverters to its Covered List, which bars new equipment authorisations and therefore import, marketing or sale in the US. The test has two prongs and needs both: the device must be a *bi-directional* DC-AC or AC-DC converter, and it must have connectivity permitting remote communication, control or monitoring. A storage PCS is exactly that. A DC block is not — there is no inverter in its scope of supply. **[Analysis — Moderate]** On a plain reading of the two prongs, the same physical project can therefore be inside or outside the rule depending on which layer of Table 1 the vendor is selling from. The full mechanics of the determination — that it is an origin test rather than a China rule, that it is prospective only, and the conditional-approval path — are in chapter 8. What matters here is that the cell/block/integrator distinction now has a compliance consequence attached to it.

### 7.2 The flip — how a glut became a shortage

For most of 2023 and 2024 grid storage was the worst business in clean energy. Chinese cell capacity had been built for an electric-vehicle demand curve that came in below plan, and the surplus was dumped into storage, where a cell is a cell. Prices collapsed. The margin evidence is unambiguous: **EVE Energy**'s energy-storage gross margin sat at roughly 12% at the first-half 2025 trough, and its full-year 2025 profit grew just 1.44% on 26% higher revenue — the signature of a company selling more and more product for no incremental profit *(EVE dossier)*.

Then the cycle turned, and it turned for a mechanical reason worth understanding. Cell capacity is lumpy and slow: a line takes years to build and cannot be flexed month to month. Demand for storage, by contrast, is fast and elastic, because storage is the one grid asset that clears in months rather than years. When AI data centres, Gulf round-the-clock solar programmes and utility firming demand all arrived at once, they hit a capacity base that had stopped expanding during the glut. The ESS cell market grew 94.6% to 612 GWh in a single year *(InfoLink via ESS News, 2026-02-09 — Hithium and EVE dossiers)*. Annual installations passed 100 GW *(ESS News, 2026-07-14 — Fluence, Tesla and Wärtsilä dossiers)*.

What tightness does to a manufacturer is not subtle. In a glut, the marginal producer sets price and everyone earns the marginal producer's margin. In tightness, the buyer bids for a queue position and price is set by the value of delivery, not the cost of production. Fixed costs are already sunk; every incremental gigawatt-hour drops most of its revenue into operating profit. That is why the same companies that were barely breaking even in 2024 posted the numbers below in 2026.

| The flip, in four numbers | |
|---|---|
| **612 GWh** | ESS cell market 2025, up 94.6% in one year |
| **>100 GW** | Annual BESS installations passed in 2025 |
| **+95–110%** | EVE's guided H1 2026 profit growth as pricing power returned |
| **36.5%** | Sungrow's ESS gross margin — now its largest segment |

- **EVE Energy** guided first-half 2026 profit up 95–110%; half-year profit alone approaches its entire 2024 result *(EnergyTrend, 2026-06-16 — EVE dossier)*. Nothing about EVE's products changed that fast. The cycle changed.
- **CATL**'s storage line reached RMB 53.26B in the first half of 2026, up 87.5%, and roughly 20% of group revenue *(Energy-Storage.News, 2026-07 — CATL dossier)*. Underlying volume: 93 GWh of ESS cells in 2024, 121 GWh in 2025, then 125 GWh in the first half of 2026 alone *(CnEVPost, 2026-08-04 — CATL dossier)*. Storage is now the growth engine of the world's largest battery company.
- **Sungrow**'s storage business overtook its solar inverter business to become its largest segment — 41.8% of revenue at a 36.5% gross margin. **[Analysis — High]** Storage is now the profit centre *(Sungrow dossier)*. A 36.5% gross margin on grid hardware is a software-like number, and it exists because the queue for delivery was longer than the queue for orders.
- **Tesla**'s energy segment became the company's profit engine: 46.7 GWh deployed in 2025, up 49%, at a 28.7% fourth-quarter margin *(Teslarati, 2026-01 — Tesla dossier)*.

The investor question is not whether these margins are real — they are — but whether they are structural or cyclical. The evidence points to cyclical. EVE's own dossier read is explicit that the doubling is cycle-driven, and that the same reversal lifts CATL and Hithium alike *(EVE dossier)*. Cell manufacturing has no natural barrier to reinvestment; a 36.5% gross margin is an advertisement for new capacity. What is durable is not the margin but the position — the vendor that used the tight window to win qualifications, references and multi-year frameworks keeps those when price normalises.

### 7.3 How to read a league table

You will be shown storage rankings constantly, and they will contradict each other. They are not wrong. They are measuring different things. Four ranking bodies dominate the sector, and each cuts the market at a different layer of Table 1.

1. **Wood Mackenzie's Global BESS Integrator Comprehensive Ranking** (inaugural edition, July 2026) scores the *integrator* layer on a composite basis — system design, delivery, safety architecture, controls, service — not on volume alone. Result: **Sungrow** #1, **Tesla** #2, **CATL** #3, **BYD** #4, with Chinese integrators holding roughly 76% of the market, **Fluence** at #7 and **Wärtsilä** in the top ten as the Western pure-play tier. Sungrow is the first vendor ever to hold both the integrator crown and the PV inverter crown, and the first to take the integrator top spot from Tesla *(ESS News, 2026-07-14 — Sungrow, Tesla, Fluence and Wärtsilä dossiers)*.
2. **Benchmark Mineral Intelligence** counts *system shipments* — a volume measure. On that basis **BYD** was #1 for 2025 at more than 60 GWh and roughly 13% share, ahead of Tesla's 46.7 GWh; Benchmark also puts Fluence at roughly 4% share *(BYD and Fluence dossiers)*. Same year, same market, different leader.
3. **InfoLink** counts *cells*. For 2025 it placed **Hithium** in the top two and **EVE** at #3 — EVE having been displaced from #2 by Hithium, though EVE's own messaging still claims second *(InfoLink, 2026-02-09 — EVE dossier)*. CATL remains #1 in cells but the lead is narrowing: company-reported ESS share fell from 36.5% to 30.4% during 2025, with Hithium and EVE at roughly 12% each **[Analysis — High]** *(CATL dossier)*; in the first half of 2026 CATL shipped 125 GWh for 27.1% share, with Hithium at 10.0% *(CnEVPost, 2026-08-04 — CATL dossier)*.
4. **SNE Research** tracks shipments with an end-market cut, which is where the AI-specific numbers surface: 1.6 GWh of **Samsung SDI**'s first-half 2026 ESS shipments went to AI data centres, against a global share of just 1.4% and a #12 overall placing *(CnEVPost, 2026-08-04 — Samsung SDI dossier)*. A company can be twelfth in the world and highly relevant to the specific demand you care about.

So the discipline is a single question, asked before you accept any storage ranking: *ranked on what?* Cells, DC blocks, AC system shipments, deployed capacity, order intake, or a composite quality score. Each answer reorders the table. The figure below plots five 2026-vintage volume claims side by side precisely so you can see the incomparability — the bars are all real, all sourced, and all measuring something slightly different.

**Figure 10: The same market, five different measuring sticks (GWh, latest full-year or as noted)**

| Company | Basis | GWh | Share of largest bar |
|---|---|---|---|
| CATL | ESS cell sales 2025 — cell layer | 121 | 100% |
| BYD | System shipments 2025, Benchmark #1 | >60 | 49.6% |
| Tesla | Deployed 2025, +49% | 46.7 | 38.6% |
| Sungrow | Shipped 2025, +53.5% — Wood Mackenzie #1 | 43 | 35.5% |
| Wärtsilä | 2025 storage order intake, −52% in MWh | 2.68 | 2.2% |

Source: CATL dossier (ESS battery sales 93 GWh 2024 → 121 GWh 2025); BYD dossier via Benchmark (>60 GWh, ≈13% share, 2025); Tesla dossier (46.7 GWh deployed 2025); Sungrow dossier (43 GWh shipped 2025, +53.5%); Wärtsilä dossier (segment order intake EUR 455M / 2,677 MWh, −52%). Note: these figures are deliberately not like-for-like — cell sales, system shipments, deployed capacity and order intake are four different measurements. The incomparability is the point. Wood Mackenzie's #1 integrator ships the third-smallest volume shown here.

### 7.4 The hardware arms race is a manufacturing argument in disguise

Storage vendors compete publicly on specifications — ampere-hours per cell, megawatt-hours per container, megawatt-hours per acre. Read as engineering, this is a spec-sheet arms race and mostly noise. Read as economics, it is the most important cost story in the sector.

Here is the mechanism. A megawatt-hour of storage requires a fixed quantity of lithium, iron, phosphate and electrolyte regardless of how you package it. What is *not* fixed is the number of physical objects you must manufacture, handle, weld, bolt, wire, instrument and test to assemble that megawatt-hour. Go from a 314 Ah cell to a 628 Ah cell and you halve the cell count per MWh — and with it the busbars, the weld joints, the bolted connections, the BMS voltage-sense channels, the coolant fittings and the assembly-line minutes. Every one of those is a unit of factory cost and, critically, a potential failure point. **EVE** quantifies exactly this for its 628 Ah class against 314 Ah systems: roughly 50% fewer system components, 50% less installation workload, and 30% lower lifecycle maintenance cost *(EVE dossier)*. **Tesla**'s Megapack 3 makes the same argument at the block level with 78% fewer connection points than its predecessor *(Tesla dossier)*, and **Fluence**'s unified battery pack claims roughly 70% fewer connections *(Fluence dossier)*.

The second half of the argument is field labor, and this is where storage collides with the binding constraint elsewhere in this report — trained craft labor *(the craft-labor chapter)*. Every connection made in a factory by a fixture is a connection not made in a Texas field by a scarce electrician in August. That is the actual content of the block-size race. **Tesla**'s Megablock packages four Megapack 3 units with an integrated medium-voltage transformer and switchgear and claims 23% faster installation, up to 40% lower construction cost, 248 MWh AC per acre, and one gigawatt-hour deployable in about twenty business days *(ESS News, 2025-09-09 — Tesla dossier)*. **Fluence**'s 10 MWh Smartstack claims roughly 680 MWh per acre and up to 40% lower balance-of-plant cost *(Fluence, 2026-06-23 — Fluence dossier)*. "Balance of plant" is everything on site that is not the battery — foundations, cabling, transformers, trenching, labor. When a vendor says it cuts balance-of-plant by 40%, it is telling you it has moved work indoors.

Density is not free, and one vendor's dissent is instructive. **Wärtsilä** deliberately capped the energy density of its 5 MWh block, arguing that the very densest 20-foot containers risk exceeding road weight limits and adding shipping cost *(Andy Tang via Energy-Storage.News — Wärtsilä dossier)*. That is a real physical ceiling: a battery that cannot travel on a public highway without a permit convoy has traded factory cost for logistics cost. **CATL**'s answer to the same constraint was architectural — its 9 MWh TENER Stack splits into two half-height containers each under 36 tonnes, road-legal in roughly 99% of markets, while improving volume utilisation 45% versus a standard 20-foot container *(pv magazine, 2025-05-08 — CATL dossier)*.

**Table 2: The cell and block leapfrog, and what the size is actually buying**

| Vendor | Cell / block | Cycle life | What the size is actually buying | Citation |
|---|---|---|---|---|
| **BYD** | HaoHan — 2,710 Ah long Blade cell, 14.5 MWh block | >10,000 | Largest single block in the market; 233 kWh/m³ and a claimed lifecycle energy cost below CNY 0.1/kWh — a land-and-labor argument at gigawatt sites | *pv magazine, 2025-09-19 — BYD dossier* |
| **Hithium** | ∞Cell 1175 Ah — first mass-produced kAh-class cell; 1300 Ah / 6.9 MWh eight-hour-native system targeted Q4 2026 | ≥11,000 | Purpose-built for long duration: thick electrodes trade power density for energy per object, which is the right trade when the plant discharges over eight hours | *PR Newswire, 2025-06; pv magazine, 2026-06-09 — Hithium dossier* |
| **Sungrow** | PowerTitan 3.0 — first mass-producible 684 Ah cell; 12.5 MWh per 30-ft, silicon-carbide PCS | n/d | "First mass-producible" is the claim that matters — a cell that yields on a production line, not a trade-show sample | *pv magazine, 2025-06-10 — Sungrow dossier* |
| **EVE** | Mr.Big 628 Ah — first mass-produced 600 Ah+ prismatic; world's first 628 Ah grid station Feb 2026 | ≈12,000 | The explicit component-count argument: ≈50% fewer components, ≈50% less installation workload, ≈30% lower lifecycle maintenance vs 314 Ah | *EVE releases, 2024-12 / 2026-02-10 — EVE dossier* |
| **CATL** | TENER (2024) 6.25 MWh, 430 Wh/L → TENER Stack (2025) 9 MWh on a 587 Ah cell | >15,000 / ≥12,000 | Half-height containers under 36 t, road-legal in ≈99% of markets, 45% better volume utilisation — density without a permit convoy; "five-year zero degradation" is a bankability claim, not a physics claim | *pv magazine, 2025-05-08 — CATL dossier; the ≥12,000-cycle 587 Ah comparator per the Hithium dossier* |
| **Tesla** | Megapack 3 ≈5 MWh on a Tesla-designed 2.8 L LFP cell; Megablock 20 MWh MV site block | >10,000 | Deliberately not the density leader. 78% fewer connection points, one ≈39 t piece with no on-site assembly, 25-year design life — mass-manufacturability over headline MWh | *ESS News, 2025-09-09; Tesla dossier* |
| **Fluence** | Smartstack 10 MWh on 314 Ah cells, with swappable battery pods | n/d | Competes on site density (≈680 MWh/acre) and on pod swappability — augmentation, repowering and a change of cell vendor without redesigning the site | *Fluence, 2026-06-23 — Fluence dossier* |
| **Wärtsilä** | GridSolve Quantum3 — 5 MWh AC block, density deliberately capped | n/d | The dissent: densest blocks risk road weight limits and shipping cost. String-based PCS so a failed string derates rather than tripping the container | *Energy-Storage.News — Wärtsilä dossier* |

#### Cycle life is augmentation capex you do not spend

The cycle-life column above looks like a durability boast. It is a capital budget. A battery loses capacity as it cycles, and a storage plant sold with a firm contractual capacity must be topped up as it fades — the industry calls this **augmentation**: physically adding battery modules in later years to restore the plant to its nameplate. Augmentation is a scheduled future capital outlay, and in a discounted cash-flow model it is a large one, sitting at years five, ten and fifteen.

So a cell rated at 13,000 cycles instead of 7,000 is not selling you longevity for its own sake — it is deleting or deferring an augmentation event, and the value of that deletion is the present value of the avoided capex. **Hithium**'s 314 Ah workhorse is rated at 13,000 cycles or more against 7,000 for its 280 Ah predecessor *(Hithium dossier)*. **CATL**'s original TENER claimed more than 15,000 cycles with zero capacity or power degradation in the first five years *(CATL dossier)* — a claim aimed squarely at the finance model, not the engineer. Its sodium-ion TENER product goes further, at 15,000 cycles with a 30-year warranty *(CATL releases, 2026-06/07 — CATL dossier)*. **Fluence** attacks the same line item mechanically, offering optional DC-DC converters to reduce augmentation cost and pods that swap without a site redesign *(Fluence dossier)*. Different routes to the same investor-relevant outcome: fewer dollars leaving the project after year one.

#### A warranty is only as good as the balance sheet behind it

Which leads to the least technical and most important point in this section. Every claim above — zero degradation for five years, 15,000 cycles, a 25-year design life, a 30-year warranty — is a contractual promise by a corporate entity to spend money in the future if the hardware underperforms. It is, in substance, an unsecured long-dated credit claim on the vendor. The battery does not honour the warranty. The issuer does.

Two facts in the corpus make this concrete rather than theoretical. First, warranty liabilities are real cash: **Tesla** took a $240M warranty charge on legacy vendor cell issues, and its gross margin fell to 20.4% in the affected quarter *(Tesla dossier)*. That is a company with one of the strongest balance sheets in the sector absorbing a nine-figure hit on cells it did not make. Second, when the issuer fails, the promise is worth nothing — which is the subject of section 7.6. The practical consequence for an investor is that a 30-year warranty from a thinly capitalised vendor and the same warranty from a vertically integrated giant are not the same product, and should not be priced as though they were. This is also why **Sungrow** being named the most bankable ESS and PCS brand by BloombergNEF is a commercial asset, not a vanity award *(Sungrow dossier)* — bankability is lenders saying they will finance projects built on that hardware.

### 7.5 Safety certification is a gate, not a badge

Fire testing in this industry is frequently presented as marketing. It is not. It is a permitting and insurance gate, and failing it does not cost you a differentiator — it costs you the project.

The two reference points to know are **UL 9540A**, a large-scale fire test that measures whether a thermal runaway in one cell propagates to neighbouring cells, modules and enclosures, and **NFPA 855** (National Fire Protection Association), the US installation standard that local fire authorities and insurers actually enforce, and which sets separation distances and suppression requirements based on how the product performed in that test. A block that contains a fire within one enclosure can be sited close to its neighbours; a block that does not needs more land, more suppression, or a refusal from the authority having jurisdiction. Test performance converts directly into permitted site density — which is the same currency as the MWh-per-acre claims in the previous section.

#### Reading a certification claim — the stack in order

Those two sit inside a stack, and knowing the order is what lets you read a vendor's certification claim properly rather than accepting it as a badge. **UL 1973** certifies the battery subsystem — cells, modules and racks — for stationary use, and is the component-level entry ticket. **UL 9540** certifies the complete energy storage system for grid connection or standalone operation, and it is built on top of the component certificates: a UL 9540 listing generally presumes UL 1973 batteries and UL 1741 power conversion underneath it. **UL 9540A** is the odd one out, and the one most often misquoted — it is a *test method*, not a certification, and it issues no certificate at all. What it produces is a report of measured fire behaviour, which the authority having jurisdiction and the insurer then read against **NFPA 855** to decide siting, spacing and suppression. Outside the US the ladder is IEC rather than UL: **IEC 62619** sets the baseline safety requirements for industrial lithium cells and batteries, **IEC 63056** layers on the additional requirements specific to grid-scale electrical energy storage, and **IEC 62477** covers the other side of the enclosure — the power-electronic converter systems, up to 1,000 V AC or 1,500 V DC, that sit between the battery and the grid.

The consequence for reading a vendor is that "we are certified" is not one claim but several, and they are not interchangeable. A vendor advertising itself as *UL 9540A certified* has made a category error, because no such certificate exists — which tells you something about either its engineering rigour or its marketing discipline. A vendor holding UL 1973 on a new large-format cell but no UL 9540 listing on the system built from that cell has cleared the component gate and not the system gate, and cannot yet sell the finished product. And a vendor carrying the full UL *and* IEC stack can sell into US and international procurement without a re-test cycle — a timing advantage that is worth real money when demand arrives faster than the testing laboratories can schedule it. **Hithium** is the clearest example of the complete stack in the corpus, holding UL 1973, UL 9540, UL 9540A, NFPA 855 and IEC 62619/62477/63056 across its systems *(Hithium dossier)*.

- **Sungrow** ran the largest burn tests in the industry: a 10 MWh test in June 2024 and a DNV-witnessed 20 MWh test in November 2024 costing roughly $4.2M, with suppression deliberately disabled — no propagation, more than 1,385°C contained, 25-plus hours of combustion *(PR Newswire, 2024-11 — Sungrow dossier)*. Disabling suppression is the point: it tests the enclosure, not the sprinkler.
- **Fluence**'s UL 9540A testing at Safe Laboratories, CSA-witnessed, deployed all six deflagration panels as designed with no enclosure-to-enclosure propagation, aligned to NFPA 855 *(Fluence dossier)*.
- **Samsung SDI** passed UL's Indoor Large-Scale Fire Test for UPS batteries first in the world, in July 2026 — no propagation, no sprinklers — and frames it explicitly as a hyperscaler procurement requirement *(Samsung SDI, 2026-07-14 — Samsung SDI dossier)*. The word doing the work is *indoor*. A grid battery in a field is one risk category; a battery inside an occupied building full of GPUs is another entirely, and it is the category that matters for the UPS-replacement door in section 7.7.
- **Wärtsilä** certifies to UL 9540A, NFPA 855 and IEC 62443-4, holds the first-in-industry IEC 62443 cybersecurity certification for its GEMS platform, achieved SOC 2 Type 1 in February 2026, and claims a 100% fire-safety record across its deployed fleet *(Wärtsilä dossier)*. **CATL** adds IEEE 693 magnitude-9 seismic and category-5 hurricane compliance on TENER Stack *(CATL dossier)*.

Note the second gate forming alongside fire: cybersecurity. A grid battery is a remotely dispatchable industrial control system connected to a utility. IEC 62443 and SOC 2 attestations are becoming checkbox requirements in utility and data-centre procurement, and **FlexGen** has built a product line on the specific anxiety of foreign-origin BMS firmware — a domestic software layer between foreign-made hardware and the site's communications, updated independently of the hardware OEM *(FlexGen dossier)*. That is a compliance product sold into a hardware market.

### 7.6 The integrator shakeout — and what distress does to a customer

The Western pure-play integrator tier — companies that buy cells and sell finished AC systems without owning a cell plant — has had a brutal two years, and understanding why explains where the openings are.

The structural problem is a margin sandwich. A pure-play integrator buys its most expensive input from vendors who are also, increasingly, its competitors: CATL, BYD and Sungrow all sell cells *and* sell finished systems. In a glut the integrator's cell cost falls and it survives on volume. In tightness its cell cost rises while its vertically integrated competitors are selling from their own inventory at internal transfer prices. Add US tariffs, foreign-entity-of-concern rules and domestic-content requirements *(chapter 8)*, which force expensive supply-chain reconstruction, and the pure-play's cost base moves the wrong way at exactly the moment demand arrives.

- **Powin** filed for Chapter 11 in June 2025, and the collateral damage is the clearest illustration in the corpus of what integrator failure does upstream and downstream at once: EVE's 25-plus GWh of cumulative contracted US demand — including a 15 GWh master supply agreement signed in 2024 — evaporated *(ESS News, 2025-06-11 — EVE dossier)*.
- **FlexGen** bought Powin's hardware and software IP for $36M in a stalking-horse bid and drew the obvious conclusion, exiting the hardware lane for software and services. **[Analysis — High]** Its absence from Wood Mackenzie's integrator top ten reflects that chosen position, not competitive failure *(FlexGen dossier)*. HybridOS now runs across 25-plus GWh and 200-plus systems, supports 65-plus hardware configurations from 22 vendors, and FlexGen bought commissioning firm Clean Energy Services — 125-plus field technicians, 15-plus GWh commissioned — to own the field labor that makes availability guarantees deliverable *(Business Wire, 2026-04-02 — FlexGen dossier)*.
- **Wärtsilä** is executing a managed retreat. Storage order intake fell 60% to EUR 455M in 2025 and 52% in MWh terms, on US tariffs, FEOC rules and price competition; the business — with a EUR 719M order book — is being folded into a 50/50 joint venture with Germany's RCT Solutions, closing expected in the third quarter of 2026 and reclassified as discontinued operations. **[Analysis — High]** A managed retreat; **[Analysis — Moderate]** the counterparty transition around closing is a live displacement opening for rivals *(Wärtsilä dossier)*. Note the split: Wärtsilä's retained engine business independently booked 789 MW of US data-centre projects in 2025 *(Wärtsilä dossier)*. Exiting storage is not exiting the AI build.
- **Fluence** is the counter-case: its constraint is execution, not demand. It holds a record $6.4B backlog including roughly $850M of data-centre orders and master supply agreements with two hyperscalers — **[Analysis — High]** a contracted channel, not pipeline talk *(Fluence dossier; Q3 FY2026, 2026-08-05)* — while roughly $400M of third-quarter revenue slipped on the ramp of new US manufacturing **[Analysis — Moderate]** *(Fluence, 2026-08-05)*. It is #7 on Wood Mackenzie's list at roughly 4% share per Benchmark *(Fluence dossier)*. A company with more orders than it can build is a different investment proposition from one with more capacity than orders, and the two are easy to confuse from the outside.

> **What integrator distress actually does to the customer**
>
> When an integrator fails, the batteries keep working — for a while. What stops is everything wrapped around them. The performance warranty becomes an unsecured claim in a bankruptcy estate. Spare-parts supply ends. Firmware and BMS updates stop, which over years is a safety and insurance problem, not an inconvenience. The EMS may be a proprietary platform with no vendor behind it. Scheduled augmentation has no counterparty. Long-term service agreements — often priced into the project's original financing — are void. The asset owner is left operating industrial hardware with no manufacturer, and lenders take notice.
>
> That is why Powin's orphaned fleet became a land-grab rather than a graveyard: an installed base with no vendor is an annuity waiting for whoever can credibly adopt it. FlexGen waived HybridOS fees to capture those sites *(FlexGen dossier)*. The generalisable lesson for an investor is that in storage, service and software attach rates on *other people's* installed hardware are a real and under-appreciated franchise — and the vendor-agnostic control layer is where that franchise lives.

### 7.7 The four doors AI-data-centre storage demand comes through

Storage demand from AI data centres is often discussed as one market. It is four, and they have almost nothing in common — different buyers, different sales cycles, different products, different competitors. Identifying which door an opportunity comes through is the first analytical question, because it determines who actually signs.

1. **Utility-scale, front of meter.** Grid batteries built near or on the grid serving the campus, contracted through a developer, independent power producer or utility — not the hyperscaler. The hyperscaler signs a power contract; the developer picks the battery. **Amazon**'s utility-scale OEM decisions sit with developer counterparties such as AES and Primergy — the developer, not the hyperscaler, is the practical channel **[Analysis]** *(Amazon dossier)*. **Meta** buys the same way, through tolled utility projects — Enbridge's Cowboy project at 200 MW / 1,600 MWh on Tesla batteries — and has reserved up to 1 GW / 100 GWh of Noon long-duration storage *(Utility Dive, 2026-05-21; Meta, 2026-04-27 — Meta dossier)*. **LGES Vertech**'s 6 GWh / 1.5 GW DTE programme exists to serve the Oracle-managed OpenAI campus at Saline Township *(LGES, 2026-05-27 — LGES dossier)*.
2. **Campus medium-voltage BESS.** Batteries inside the fence, at medium voltage, sized to buffer the campus against grid stress and against GPU load swings. This is sold to energy-first developers and colocation operators. **Crusoe** committed to 5 GW of ON.energy medium-voltage "AI UPS" storage, ERCOT ride-through validated *(Crusoe, 2026-07-21 — Crusoe dossier)*. **Fluence**'s Smartstack was selected for Siemens' NVIDIA AI data-centre reference architecture, specified for load smoothing, black start and grid-instability ride-through *(Energy-Storage.News, 2026-06-02 — Fluence dossier)*. Getting into a reference architecture is how this door is won — the specification closes before competitive bidding opens *(the 800 VDC chapter)*.
3. **UPS replacement.** Replacing the traditional uninterruptible power supply and diesel generators inside the data hall with a medium-voltage battery sited outside the building. This is sold with electrical contractors, because they own the design. **Rosendin** — the #2 US electrical contractor — combined its patented BESSUPS design with **FlexGen**'s grid-interconnection and transient-stabilisation patents to productise exactly this *(Business Wire, 2025-06-03 — Rosendin dossier)*. **Vertiv** is crossing the other way, from data-centre power incumbency into the integrator lane with EnergyCore Grid at 1 MW to 200-plus MW **[Analysis — Moderate]** *(Vertiv dossier, 2025-12-03)*. This is the door where Samsung SDI's indoor fire-test pass becomes decisive rather than decorative.
4. **Inside the rack.** Battery backup units and supercapacitors on the compute rack itself, sold through NVIDIA's ODM chain rather than to any energy buyer. Each GB300 cabinet uses roughly five BBU modules plus more than 300 supercapacitors, supercapacitor supply is a genuine bottleneck, and the AI-server BBU market is estimated at roughly $2.8B in 2026 rising to roughly $7.1B by 2033. **[Analysis — Moderate]** NVIDIA's rack storage legitimises and expands the market faster than it cannibalises it *(TrendForce — NVIDIA dossier)*.

Two counter-cases discipline any enthusiasm here, and they are as informative as the wins. **Microsoft** deliberately runs Fairwater Atlanta with no on-site generators and no UPS — four-nines availability at three-nines cost. **[Analysis — High]** It has structurally chosen grid procurement over on-site storage, and no major standalone BESS procurement surfaced in 2025–26 *(Microsoft dossier, 2025-11-12)*. At the opposite pole, **Google** anchored the largest battery project by energy capacity announced anywhere — 300 MW / 30 GWh of Form Energy iron-air via Xcel — plus the largest US solar-plus-storage PPA. **[Analysis — High]** Google has chosen ownership over procurement, making it the hyperscaler most likely to shape rather than merely consume the storage market *(Google, 2026-02-24; pv magazine, 2026-07-15 — Google dossier)*. The two largest software companies on earth have reached opposite conclusions about whether to own batteries. Treat "hyperscalers buy storage" as a category error.

### 7.8 What this means for your capital

**The margin you are seeing is cyclical; the position it buys is not.** Sungrow's 36.5% storage gross margin and EVE's 95–110% profit swing are the arithmetic of tightness meeting a fixed capacity base, and tightness in a business with no barrier to reinvestment invites the capacity that ends it. What survives normalisation is what got bought during the window: qualifications, reference plants, multi-year frameworks, bankability ratings, service-attached installed base. Watch for evidence of position, not margin — that is the variable with a longer half-life.

**Layer determines the economics, so read every disclosure against Table 1.** Cell makers are utilisation businesses with commodity price exposure and a technology ladder as the only escape. Integrators are execution businesses whose real product is a schedule and a 20-year promise. A cell maker's gigawatt-hour and an integrator's gigawatt-hour are different objects, and companies that occupy both layers report numbers that cannot be added to anyone else's. When a storage company's share number moves, the first question is whether the measurement changed.

**The spec race is a cost race — score it on installed cost, not on ampere-hours.** Bigger cells and bigger blocks buy fewer objects to build, fewer connections to fail, and less scarce field labor per megawatt-hour. Cycle life buys deleted augmentation capex. Fire-test performance buys permitted site density. These are all the same currency — dollars per installed, permitted, warranted megawatt-hour — and a vendor winning on that basis while losing the headline density comparison (Tesla's explicit strategy) may be the better business.

**The warranty is a credit exposure.** A 25-year design life or a 30-year warranty is an unsecured long-dated claim on the issuer's balance sheet, and Powin proved what such a claim is worth when the issuer fails. Discount long-dated performance promises by the issuer's capacity to honour them, and treat lender bankability designations as the market's own credit assessment of exactly this.

**Integrator distress is a transfer of value, not a destruction of it.** When an integrator fails or retreats, the hardware keeps running while the warranty, spares, firmware, EMS and service all go dark — leaving an orphaned installed base that is an annuity for whoever can credibly adopt it. The vendor-agnostic software and services layer is where that value lands. Two such transfers are live on a near calendar: Wärtsilä's storage counterparty changes hands around the third quarter of 2026, and Powin's 25-plus GWh fleet is already being absorbed.

**Identify the door before sizing the opportunity.** Utility-scale demand is bought by developers and utilities, not hyperscalers. Campus storage is bought by energy-first developers and colocation operators, and is specified inside reference architectures before any bid. UPS replacement is bought with electrical contractors and gated on indoor fire certification. Rack-level storage is bought through the NVIDIA ODM chain and is becoming non-discretionary content rather than an option. A company's exposure to "AI storage demand" is only meaningful once you know which of those four it actually sells into.

**Regulation is now part of the product definition.** The compliant lane carries a pricing umbrella, and the beneficiaries are converting — LGES's ESS shipments rose 357% in the first half of 2026 with roughly 86% into North America *(LGES dossier)*. But note from section 7.1 that the layer a vendor sells from now determines its FCC exposure, because the two-prong Covered-List test turns on whether a bi-directional connected inverter is in the scope of supply. The full mechanics are in chapter 8, and they are worth reading carefully before assuming any vendor is either safe or caught.

#### What would change this view

- **On the cycle.** Announced cell-capacity additions coming online faster than demand, or ESS cell prices and integrator gross margins compressing for two consecutive quarters, would confirm the flip was a window rather than a regime — and would date the 36.5%-class margins precisely. Conversely, margins holding through a full year of new capacity would force a re-read toward something structural.
- **On tightness itself.** The 94.6% cell-market growth rate decelerating sharply, or lead times on large-format cells shortening, would remove the mechanism behind the pricing power. Cell lead times are the cleanest single observable in this chapter.
- **On the layer thesis.** A pure-play Western integrator sustaining margin expansion while buying cells from its own competitors would falsify the margin-sandwich argument in section 7.6. Fluence converting its $6.4B backlog at stable or improving margin once US manufacturing ramps is the specific test.
- **On the hardware argument.** A serious field-reliability or fire event traced to the large-format cell transition would reverse the direction of the entire size race, because it would move fire-test performance and cell count from a cost variable to a safety variable. Watch UL 9540A results on the kAh-class systems as they reach volume.
- **On the demand doors.** Microsoft reversing its no-UPS, no-generator stance would signal that the grid-procurement route has hit a ceiling and would open the largest single addressable pool in the UPS-replacement door. Equally, hyperscalers beginning to buy utility-scale batteries directly rather than through developer counterparties would invalidate the channel map in section 7.7.
- **On the AI-specific channel.** Fluence's roughly $850M of data-centre orders and its two hyperscaler master agreements are the corpus's hardest evidence that AI data-centre storage is contracted rather than aspirational. If those agreements do not convert into disclosed deployments on schedule, the AI storage channel should be treated as smaller and later than currently presented.

*This chapter is analysis for understanding, not investment advice. It does not recommend the purchase or sale of any security.*

## 8. Policy and Regulation — the Rules That Decide Who Can Sell

In most industries, regulation is a cost of doing business. In American AI-data-center power it is closer to a product specification. Between July 2025 and July 2026 the United States rewrote, in four separate legal instruments, the answer to a single question: which pieces of electrical equipment may be sold into a US project at all, and at what price. A battery cell that is technically excellent, cheap and available can now be commercially unusable — not because a customer rejected it, but because buying it would cost that customer a third of the project's capital back from the Treasury. That is a different kind of risk from cyclicality, and it deserves its own chapter.

Policy in this sector was previously scattered through this report — the tariff and FEOC material sat inside the battery chapter, the FCC action inside a risk list. That was a mistake of organisation. These instruments interact. A supplier can be tariffed and still sell; blacklisted and still sell; but denied an equipment authorisation, it cannot sell at all. An investor needs them assembled in one place, with their mechanisms visible, because the same company can be exposed to three of them and immune to the fourth.

> **The four levers — read every rule for which one it pulls**
>
> **Eligibility.** Whether a buyer keeps a subsidy. The harshest lever, because subsidies are cliffs, not slopes — you qualify or you don't. This is the FEOC regime.
>
> **Price.** What the product costs at the border. Tariffs. Painful, but payable, and passable through to a customer who wants the product badly enough.
>
> **Access.** Whether the product may legally be imported, marketed or sold. FCC equipment authorisation. Cannot be paid around at any price.
>
> **Buyer restriction.** Whether one particular customer may buy. The Department of Defense 1260H list. Narrow in law, wide in practice, because private buyers copy federal screens.
>
> Two further instruments decide not who sells but *where power may go* (FERC and the grid operators) and *whether a campus gets built at all* (rate cases and permitting litigation). Both are covered below.

### 8.1 The FEOC regime — a tax test that functions as a supply-chain ban

#### What the credit is, and why losing it is fatal

Start with the money at stake. A US grid-scale battery project can claim an investment tax credit worth 30–40% of its capital cost — the base credit plus adders for domestic content and location. Think of it as the federal government paying roughly a third of the project. In a business where storage developers bid into competitive procurements at margins measured in single-digit percentages, a third of capital cost is not a nice-to-have. It is the difference between a bid that clears and a bid nobody reads.

There is a second, separate credit that matters for understanding who is building factories: the advanced manufacturing production credit, paid per kilowatt-hour to the *cell manufacturer* rather than to the project owner. One credit subsidises the buyer of the plant; the other subsidises the maker of the cell. Keep them distinct — they explain different behaviour. The manufacturing credit is why Korean cell makers built American plants at all; **LGES**'s dependence on it is the vulnerability its own file flags, with operating losses excluding those credits in most recent quarters **[Analysis — Moderate]** *(LGES dossier)*.

#### The statute and the clock

The prohibited-foreign-entity regime — universally called FEOC, for "foreign entity of concern" — was enacted on 4 July 2025 in the One Big Beautiful Bill Act. It applies to facilities that *begin construction after 31 December 2025*. Treasury and the IRS put mechanical detail behind it in Notice 2026-15 in February 2026. So the regime is roughly eighteen months old as law and six months old as workable guidance, which is why supply chains are still visibly rearranging around it.

| | |
|---|---|
| **30–40%** | Investment tax credit at stake; a failed test forfeits all of it |
| **55%** | Minimum non-prohibited share for storage beginning construction in 2026 |
| **75%** | The same floor for construction starts in 2030 |
| **31 Dec 2025** | Safe-harbour cutoff — that pool of projects is closed and finite |

#### The material assistance cost ratio — the actual test

The test is arithmetic, and it is worth understanding precisely, because almost every commercial consequence in this chapter falls out of its shape. For each project you compute:

**(A − B) ÷ A**

where **A** is the direct cost of all equipment in the project, and **B** is the direct cost of the equipment supplied by prohibited foreign entities. The result is the share of the project's equipment value that is *not* tainted. That share must clear a floor. For storage projects beginning construction in 2026, the floor is at least 55% non-prohibited. The floor ratchets upward each year, reaching at least 75% for 2030 construction starts.

An illustration, using round numbers rather than any real project: a storage installation with $150M of total equipment direct cost, of which $80M is cells from a prohibited entity, computes (150 − 80) ÷ 150 = 46.7%. That project fails the 2026 floor by roughly eight points. Cut the prohibited content to $60M and the ratio is 60.0% — a pass, with headroom that will be gone by 2030 unless the chain changes again. Nothing about the project's engineering changed between those two cases. Only the invoices did.

**It is a cliff, not a slope.** This is the single most important structural feature of the regime and the one most often missed. A project that lands at 54% does not receive a reduced credit proportional to its shortfall. It forfeits the *entire* 30–40%. There is no partial credit, no glide path, no cure by paying a penalty. Which means the compliance question is not "how much Chinese content can I afford?" but "am I over the line or under it?" — and that binary is why procurement teams now treat cell sourcing as a legal question routed through counsel rather than a purchasing question routed through a category manager.

#### Who actually enforces this — the two parties who can veto your supplier

The rule is federal, but nobody from the Treasury arrives at a construction site to audit a bill of materials. Enforcement is *commercial*, and it runs through two private parties whose names rarely appear in coverage of this policy — which is why a vendor can be technically compliant and still lose the sale.

The first is the **tax-equity investor**: the institution, usually a bank, that invests in a project specifically to monetise its tax credits, because the developer typically has too little tax liability to use them itself. That investor's counsel underwrites the credit *before* the money moves. If counsel is not satisfied that the project clears the material-assistance floor, the financing does not close — and a signed supply agreement with a failing bill of materials is worth nothing.

The second is the **independent engineer**, or IE: the technical reviewer that lenders retain to sign off on a project's equipment, performance assumptions and vendor quality before debt is committed. The IE is where **bankability** — described in section 7.4 as lenders saying they will finance projects built on your hardware — acquires a named enforcer.

**[Analysis]** The practical translation of this entire chapter is therefore narrower than the statute suggests: *a compliance claim is only as good as the tax counsel and the independent engineer who have to accept it.* It also explains why the incumbents' regulatory advantage compounds rather than decays — every closed financing is a precedent the next IE can point to, and a new entrant has none to offer.

#### Why storage is the hardest case in the whole energy complex

Every clean-energy technology faces this test. Storage faces the worst version of it, for a reason that is pure cost structure. In a battery system, the cells are the largest single line in the bill of materials — a solar project's modules are one input among many, but a battery project is, economically, a box of cells with electronics and steel around it. And cells are overwhelmingly Chinese. The market data in this report says so from three directions: Chinese integrators captured roughly 76% of a market that crossed 100 GW of annual installations *(ESS News, 2026-07-14 — Fluence/Tesla/Wärtsilä dossiers)*, **CATL** remains the #1 cell supplier globally at 125 GWh and 27.1% share in H1 2026 *(CnEVPost, 2026-08-04 — CATL dossier)*, and — most telling for this chapter — Chinese cells still hold the largest share of the *North American* market despite everything described here.

**Figure 11: Who actually supplies North American storage — H1 2026 ESS battery share (%, SNE)**

| Supplier | Note | Share |
|---|---|---:|
| CATL | 1260H-listed; largest NA supplier | 38.8% |
| Hithium | Mesquite TX assembly since Aug 2025 | 17.2% |
| LGES | the compliant-lane challenger | 13.6% |

*Source: CnEVPost — SNE H1 2026 global ESS battery share, 2026-08-04 — LGES dossier. Note: the compliance wall described in this chapter has not yet displaced Chinese cells from the installed base — it governs which new projects can claim a credit, and the effect arrives with the 2026-and-later construction cohort, not retroactively.*

#### US assembly does not automatically cure it

This is the trap that has caught the most capital. The instinct is that a Chinese supplier can solve FEOC by opening an American factory — assemble the box in Texas, and the box becomes American. The test does not work that way. It turns on *who supplied the value*, not *where the box was assembled*. If prohibited-entity cells travel into a US plant and get bolted into an enclosure, the cells' cost still counts in **B**. Assembly adds a modest amount to **A** and removes nothing from **B**. The ratio barely moves.

That is why the domestic-assembly announcements in this report should be read as *tariff* mitigation and logistics strategy, not as FEOC cures. **Hithium**'s Mesquite, Texas plant (roughly 484,000 sq ft, ~$200M, 10 GWh/yr, first shipments August 2025) is described in its own file as serving North America "as Chinese-import tariffs on battery products rise (7% → 26% in 2026)" and as *partially* insulating US sales from tariff escalation *(Hithium dossier; ESS News, 2025-06)* — partial being the operative word. The same logic applies at the other end of the spectrum: **Tesla**'s first Megapacks with US-made LFP cells were produced at Sparks on equipment built by CATL, and the honest read is that onshoring "reduces but does not eliminate the structural dependence on CATL for storage cells" **[Analysis — Moderate]** *(TeslaNorth, 2026-07-31 — Tesla dossier)*. Curing the ratio means changing the origin of the value — cathode, cells, electronics — which takes years and factories, which is exactly what the regime was designed to force.

#### The consequence: a market that split in two

Because the credit is binary and the test is expensive to pass, the US storage market separated into two tiers with different prices for physically similar hardware. Compliant supply commands a premium, because a buyer claiming a 30–40% credit will rationally pay a large fraction of that credit's value to secure eligibility. The compliant lane is where the Western and Korean suppliers now live, and their own files describe the advantage in exactly those terms: **LGES** holds a 140 GWh ESS order backlog, H1 2026 ESS shipments up 357% with roughly 86% going to North America, and the $4.3B Tesla Megapack 3 LFP cell award from 2027 at Lansing — with management's own framing that "the durable advantage is regulatory, not technical" **[Analysis — High]** *(LGES dossier)*. **Samsung SDI** sells premium safety and non-FEOC provenance rather than price, and secured LFP cathode through a roughly KRW 1.6T agreement with L&F specifically to make "non-Chinese prismatic" a durable claim; its US LFP conversion at StarPlus Indiana in October 2026 is the pivotal execution item behind two billion-dollar-class US deals **[Analysis — Moderate]** *(Samsung SDI dossier)*. **Fluence** onshored component by component — cells in Tennessee, module assembly in Utah, enclosures and BMS hardware in Arizona with US steel, thermal management in Texas, inverters via a South Carolina partner — and states it expects to meet FEOC compliance by the statutory deadlines, with a second US cell supplier in negotiation *(Fluence dossier; Energy-Storage.News, 2025-11)*.

**Now the corollary that most commentary misses.** If compliant supply carries a premium, then non-compliant supply is, by the same arithmetic, relatively *cheaper* — and it is only disqualifying for a buyer who is claiming the credit. Not every buyer is. A hyperscaler funding behind-the-meter campus storage from its own balance sheet, a merchant project structured without credit monetisation, an international project outside US tax law entirely: for all of these, the FEOC premium is a cost with no offsetting benefit, and the rational choice is the cheaper non-compliant box. The regime therefore does not remove Chinese supply from the world. It sorts it — pushing it toward buyers who cannot use the credit, and toward geographies where the credit does not exist. Read this as mechanism, not as any named company's stated policy.

#### Safe harbour — a finite, closed pool

Projects that *began construction on or before 31 December 2025* sit outside the material assistance test entirely. In tax practice, "beginning construction" is a term of art with two traditional routes: a **physical work test** (start work of a significant nature) and a **5% safe harbour** (incur 5% of total project cost, typically by paying for equipment). The second route was the industry's workhorse, because writing a cheque is easier to arrange before a deadline than mobilising a construction crew.

Treasury's guidance of August 2025 removed the 5% safe harbour for projects above 1.5 MW AC, leaving only the physical work test. The consequence is the part investors should hold onto: the grandfathered pool is **finite and cannot be added to**. Every large project that got inside did so by demonstrating real physical work by 31 December 2025. Nobody can retroactively buy their way in now. So the population of projects that can freely use Chinese cells and still claim the credit is a fixed inventory that depletes as those projects energise, with nothing replenishing it. Any pricing or share observation drawn from that cohort has an expiry date built into it.

#### Who is on the wrong side of it

The damage is documented, not hypothetical. **Wärtsilä**'s storage order intake fell 60% to EUR 455M with megawatt-hours down 52%, attributed in company disclosures to US tariffs, FEOC rules and price competition — the backdrop to folding the business into a 50/50 joint venture with RCT Solutions, which its own file calls "a managed retreat from merchant storage integration" **[Analysis — High]** *(Wärtsilä FY2025 bulletin — Wärtsilä dossier)*. Note carefully what that tells you: the regime does not only hurt Chinese suppliers. It hurts anyone whose cost position depended on Chinese cells, including Western integrators. Compliance is a capability, and it is expensive to acquire.

### 8.2 Tariffs — the border price, and why you should distrust any total

A tariff stack is a set of duty layers applied to the same imported customs value, each resting on a different legal authority, and each switched on or off by a different actor — Congress, the executive, a trade agency, a court. The total a shipment pays is the sum of whichever layers apply to its particular tariff classification. That last clause is where most confident-sounding numbers go wrong: classification is granular, and two products a layperson would call "a battery" can sit in different lines with different exposure.

The live US stack for non-EV lithium-ion storage, as of this edition:

| Layer | What it is | Rate | Live since |
|---|---|---:|---|
| **Section 301** | China-specific unfair-trade tariff on non-EV lithium-ion cells and batteries; stepped up | 7.5% → 25% | 1 January 2026 |
| **Section 301** | Same authority, applied to natural graphite — the anode input, not the finished battery | 0% → 25% | 1 January 2026 |
| **Section 122** | Flat balance-of-payments surcharge; replaced the IEEPA (International Emergency Economic Powers Act) tariffs in the live stack after the Supreme Court struck them on 20 February 2026 | 10% | 2026 |
| **MFN base** | The ordinary most-favoured-nation duty that applies absent anything else | ≈3.4% | standing |

Two features of that table matter more than the individual numbers.

**The graphite line is a tax on the input, not the output.** Natural graphite is the anode material in essentially every lithium-ion cell, and there is no non-Chinese supply at comparable scale. Taxing it at 25% therefore raises the cost of cells made *in the United States* as well as cells imported from China. That is an unusual policy signature — it squeezes the onshoring project it is nominally meant to protect, and it means "build the factory in America" is not a complete escape from the border price either.

**The stack moved twice in a single year.** A Section 301 step-up on 1 January 2026; a Supreme Court decision voiding the IEEPA layer on 20 February 2026, promptly backfilled with a Section 122 surcharge. Summed, the layers land in the high thirties as a percentage — but the honest instruction to an investor is this: *distrust any precise total quoted from memory, including a total you remember from a report.* Ask for the classification, ask for the date, and ask which authority each layer rests on, because one of them has already been struck down once in court and the replacement rests on a narrower statute.

The commercial fingerprints of the tariff layer are visible across the coverage set, and they are the cleanest evidence that price levers change behaviour differently from eligibility levers. **Fluence** cut guidance twice in 2025 on tariff-driven US project pauses (roughly $700M pushed out) before its domestic chain came online *(Fluence dossier)*. **Jinko** excludes the US from the Tiger Neo 3.0 global rollout — conceding that market to tariff arithmetic rather than competing into it *(Jinko dossier)*. **Delta**'s management position is that it has "sufficient production sites around the world," with a separate executive comment that rates "beyond 15% will be difficult to take" *(Delta dossier)* — a useful public marker of where a manufacturer's absorb-versus-reprice line sits. **LITEON** is moving non-China capacity to 60% of total by end-2026 and 70% by 2027 *(LITEON dossier)*. **Tesla** multi-sources cells from the US, Southeast Asia and China explicitly to manage tariff and supply-chain exposure *(Tesla dossier)*.

> **Why a credit is a stronger weapon than a tariff**
>
> A 25% tariff raises a price by 25%; a determined buyer pays it and passes it on. Losing a 30–40% investment credit removes roughly a third of a project's capital from the equity case — and it removes all of it at once, on a pass/fail test. That asymmetry explains why FEOC, not tariffs, is the instrument reshaping who supplies American storage, and why the compliant lane's pricing umbrella is wider than tariff differentials alone would justify.

### 8.3 The FCC Covered List action — market access, revoked prospectively

> **This edition corrects the previous one**
>
> Earlier editions of this report described the FCC's action on power inverters as a *pending, draft, China-specific rule*. That framing is stale and wrong. The action was **enacted**, it is **not a China rule**, and its scope is **narrower and stranger** than a ban. The corrected description follows and supersedes the prior text.

#### What an equipment authorisation is

Before a device that emits or is susceptible to radio-frequency energy may be imported, marketed or sold in the United States, it needs FCC equipment authorisation. This is routine plumbing for almost every electronic product. It is also a licence — and the FCC maintains a "Covered List" of equipment deemed an unacceptable national-security risk. Products on that list cannot receive authorisation, and without authorisation they cannot be imported, marketed or sold. There is no fee, tariff or workaround. This is the access lever, and it is the only one in this chapter that cannot be paid around.

On **28 July 2026** the FCC added foreign-produced connected power inverters to the Covered List, effective immediately *(FCC Fact Sheet — Covered List updated to include foreign-produced power inverters and robots, 2026-07-28 — Huawei Digital Power dossier)*.

#### It is an origin test, not a nationality test

The determination names no company and no country. "Foreign-produced" means failing the Buy American *domestic end product* test — broadly, manufacture in the United States with domestic component cost above 65% through 2028, rising to 75% in 2029. Read that carefully, because it inverts the intuitive reading: an American brand that manufactures offshore is caught, and allied-country producers are caught on identical terms. **Delta** and **LITEON** are foreign-produced under this test. So is Korean, Japanese and Taiwanese production. The Huawei file makes the same point from the other side — the action's direct incremental effect on Huawei is near zero, because the Entity List and NDAA 889 — the National Defense Authorization Act provision barring named Chinese telecom and surveillance equipment from US federal supply chains — had already closed the US to it; the material effect fell on suppliers that still had US access **[Analysis — Moderate]** *(Huawei Digital Power dossier)*. **Sungrow**, which retained US market access, "absorbed the shock instead, shedding roughly CNY 100B (~$14.8B) of market value over the following month" **[Analysis — Moderate]** *(Huawei Digital Power dossier)*.

> **Two different percentage pairs — do not confuse them**
>
> FEOC uses **55% rising to 75%**: the share of project equipment value that must *not* come from prohibited entities, tested per project, for a tax credit. The FCC's Buy American origin test uses **65% rising to 75%**: the share of a device's component cost that must be *domestic*, tested per product, for market access. Similar-looking numbers, different subjects, different consequences. A product can pass one and fail the other.

#### The two-prong test — both prongs must be met

A device falls inside the determination only if it satisfies both of the following:

1. **Bi-directional conversion.** The device converts DC to AC or AC to DC bi-directionally. The determination enumerates microinverters, string inverters, central inverters, and hybrid or battery-based inverters.
2. **Connectivity.** The device has connectivity enabling remote communication, control or monitoring — via Wi-Fi, cellular, Bluetooth "or another similar connection."

The stated rationale is remote firmware push by a foreign adversary: the concern is not that the box converts electricity badly, but that someone abroad could reach it and change what it does. That rationale is what makes the second prong load-bearing rather than decorative, and equipment lacking remote control — or using an air-gapped external control architecture — is reported to fall outside the determination.

#### It is prospective only

Models authorised before 28 July 2026 keep their authorisation and may still be imported and sold. This is a **new-authorisation freeze, not a market withdrawal** — a distinction that changes the whole shape of the exposure. Nothing is recalled. Existing product lines continue. What stops is the pipeline: the next-generation model, the higher-power variant, the refreshed platform. So the effect does not arrive as a cliff in this year's revenue; it arrives as a slow strangulation of the product roadmap, biting hardest two to four years out when the currently-authorised catalogue goes stale against competitors' newer hardware. Investors watching for an immediate revenue hole in an affected supplier will see nothing and wrongly conclude the rule was toothless.

#### The conditional-approval path

There is an escape route, and it is best understood as an onshoring-race instrument rather than an exemption. Applications go to the Department of War or the Department of Homeland Security, accepted until 1 January 2028, and require ownership disclosure, a full bill of materials with a supply-chain map, and a *time-bound US onshoring plan*. No review timeline has been published. Read the design: the price of continued market access is handing two security agencies a complete map of your supply chain plus a dated commitment to move it to America. Companies that can credibly commit will file; companies that cannot will discover the freeze is permanent for them. The absence of a published review clock is itself material — it means an applicant cannot plan around a decision date.

#### What falls inside versus outside

The following is a read of scope, not a sourced ruling on any company's exposure — label it accordingly **[Analysis — Moderate]**.

- **Inside:** hybrid and battery-based inverters; storage power conversion systems (PCS); EV-charging equipment. These are bi-directional by design and conventionally network-connected.
- **Outside, on a plain reading:** a *unidirectional* AC-DC server power supply or power shelf with wired management — PMBus, or IPMI/Redfish/SNMP over Ethernet — fails the first prong on directionality and arguably the second on connection type. This is the category that matters most for AI-data-center rack power.
- **Outside, by scope of supply:** a DC battery block shipped *without* a PCS contains no inverter at all, so there is nothing in the delivered scope for the determination to reach. Whoever later adds the PCS owns that exposure.

The unresolved question is how far "another similar connection" reaches. **Sungrow** has publicly argued its products fall outside on the second prong because it restricts connection activity to wired links; whether wired management satisfies the phrase is unresolved, and the answer determines how far the rule reaches into wired-managed power electronics generally **[Analysis — Moderate]** *(Huawei Digital Power dossier)*. The Huawei file also records the honest gap: no source located addresses IT or data-center power supplies directly. That is precisely why the rack-power read above is labelled analysis.

### 8.4 The DoD 1260H list — a blacklist with one customer

Section 1260H of the National Defense Authorization Act directs the Pentagon to publish a list of "Chinese military companies" operating in the United States. Understanding what this instrument does *not* do is more useful than knowing what it does.

**It does not:** impose a tariff, block an equipment authorisation, prohibit imports, or stop a private company from buying the listed firm's products. A hyperscaler may legally buy from a 1260H-listed supplier tomorrow.

**It does:** bar the Department of Defense from procuring from the listed entity, on a phased schedule, and — far more consequentially — supply a ready-made screen that private and federally-adjacent buyers adopt voluntarily. Utilities and government-adjacent purchasers increasingly screen against 1260H because it is a cheap, defensible, publicly documented reason to say no. That imitation effect is the real commercial weight of the listing, and it is not written in any statute.

**CATL** was added in January 2025 (a listing it disputes). Pentagon direct-contracting bans phase in from June 2026, and DoD procurement of CATL batteries is barred from October 2027 *(CATL dossier; CnEVPost, 2026-07-24)*. The strategic response is the piece worth studying, because it is the general template for how blocked hardware crosses a border: licensing. CATL's LRS model — licence, royalty, service — has the American partner build and own the plant while CATL supplies the cell design, production know-how and ramp support for fees plus per-unit royalties. Ford's $3.5B BlueOval plant is the template *(electrive, 2026-06-18 — CATL dossier)*. The insight generalises: *intellectual property crosses borders that products cannot*. Where Korean rivals commit their own capital to US plants, CATL earns from IP at near-zero capital cost *(CATL dossier)*.

**EVE** was reportedly added in June 2026 — the file flags that this rests on Reuters as relayed by secondary sources and should be verified against the original before customer-facing use. Combined with an LG Energy Solution patent action at the International Trade Commission targeting its cylindrical cells, the assessment is that "the US market is closing on EVE from three directions at once," with minority stakes, licensing and offshore cells as the workaround template **[Analysis — High]** *(EVE dossier)*.

### 8.5 FERC and the Talen precedent — the rules on where power may go

Three terms first, because this subsection is unreadable without them. **Behind-the-meter** (BTM) means a generator connected directly to a load, on the customer's side of the utility meter — the grid is not involved in the transaction. **Front-of-meter** (FOM) means the generator sells into the grid and the load buys from the grid, with a contract for difference between them. **Cost allocation** is the regulatory question of who pays for the shared transmission system that everyone relies on for backup, even when they claim not to be using it.

The Federal Energy Regulatory Commission's interest is that last point. If a large nuclear plant is carved out to serve one data center directly, the remaining ratepayers lose a generator they were counting on and still pay for the wires. In November 2024 FERC rejected the Talen/Amazon interconnection service agreement for behind-the-meter nuclear co-location at Susquehanna, and upheld the rejection in April 2025. The precedent: **behind-the-meter co-location without cost allocation is dead**. Amazon's restructured front-of-meter power purchase agreement, ramping to 1,920 MW of Susquehanna output through 2042, is the workaround template *(Utility Dive, 2024-11; Talen release, 2025-06-11 — Amazon dossier)*.

The consequence for capital allocation is specific: pushing co-location front-of-meter moves incremental firming demand toward grid-side assets, including storage **[Analysis — Moderate]** *(Amazon dossier)*. It also set the price of firm carbon-free power in public. The ladder analysts derived: roughly $112/MWh for the Microsoft/Crane (Three Mile Island) restart versus roughly $70/MWh for Meta/Clinton existing output *(Jefferies via Energy Connects, 2024-09; Utility Dive, 2025-06 — Constellation dossier)*, with **Constellation**'s pricing power running a $20–50/MWh premium band **[Analysis — High]** *(Constellation dossier)*.

What changed next matters for timing. Acting on Constellation's own complaint, FERC in December 2025 ordered PJM to write transparent co-location and large-load tariff rules *(Utility Dive, 2025-12-18 — Constellation dossier)*. Until those rules exist, every co-location deal in the largest US power market is negotiated against legal uncertainty; once they land, the uncertainty converts into a template. Constellation's management expects data-center deal flow to "kick off with a bit of a bang" when it does *(Constellation dossier, 2025-12-18)*. Note the asymmetry the precedent created and the rulemaking has not yet undone: gas-plus-storage built genuinely behind the meter, never touching the grid, sits largely outside this fight — which is a substantial part of why the behind-the-meter gas and battery architecture owns this decade while contracted nuclear delivers into the 2030s *(section 4)*.

### 8.6 The EU dimension — a narrower perimeter that sets wider language

The European Commission is phasing Chinese inverters — naming Huawei and Sungrow — out of EU-funded energy projects, with full restrictions on new contracts by April 2027, on cybersecurity grounds *(Euronews, 2026-05-04 — Huawei Digital Power dossier)*. Lithuania separately bars remote asset access *(Huawei Digital Power dossier)*.

Read the perimeter precisely: "EU-funded" is narrower than a market ban. It reaches projects touching European public money, not every European project. But procurement language propagates. Once a public tender contains an exclusion clause, private buyers copy it into their own templates because it is free to adopt and awkward to omit. The cumulative effect, per the Huawei file, is that its addressable AI-data-center market is structurally the Middle East, APAC, Africa and Latin America **[Analysis — High]** *(Huawei Digital Power dossier)*. The mirror-image effect is that exclusion is "a durable share subsidy" for Western vendors in NATO geographies **[Analysis — High]** *(Huawei Digital Power dossier)* — with the caveat that those vendors are then measured against a competitor's specifications they cannot see in the field, such as Huawei's 18-week prefabricated PowerPOD delivery.

### 8.7 Ratepayer politics and permitting — the rules not yet written

The instruments above are law. The risks in this subsection are pre-legal, which makes them harder to price and easier to underestimate. They share a mechanism: ordinary voters' electricity bills.

#### The capacity market and the bill

A capacity market pays generators to be *available* in future years, separately from paying them for energy actually produced. PJM — the largest US grid operator — runs such an auction, and it has an administrative price cap. Three consecutive PJM auctions have cleared *at* the cap, alongside the first RTO-wide reliability shortfall in PJM history. Clearing at the cap is not a market signal; it is a market telling you it has run out of headroom. Those payments flow into consumer bills, and the political response has followed: a 13-governor affordability coalition, utility-bill anger contributing to 2025 election outcomes, and legislated clawback of capacity upside as a live scenario for exactly the revenue stream behind Constellation's raised guidance **[Analysis — Moderate]** *(Constellation dossier)*.

The industry's pre-emptive answer is to promise it will not touch the bill. **Oracle**'s stated policy is to "pay our own way on energy" — on-site generation or Oracle-funded upgrades, no ratepayer pass-through *(Oracle post, 2026-01-26 — Oracle dossier)*. **Microsoft** is a signatory of the White House/EPA Ratepayer Protection Pledge *(Microsoft dossier)*. **Equinix** funds 100% of grid upgrades under a 20-year take-or-pay with Central Georgia EMC *(Equinix dossier)*. These are, functionally, voluntary compliance with a rule that has not been written yet — which is what companies do when they expect the rule to be written.

#### The bellwether docket

**Meta**'s Louisiana proceeding is where the argument gets tested with evidence. The Hyperion package places seven new gas plants (roughly 2.3 GW approved plus roughly 5.2 GW proposed) plus three grid-scale batteries with Entergy Louisiana. It has drawn Louisiana Public Service Commission challenges, a judge ordering Meta to reveal withheld demand evidence, and a dissenting commissioner flagging 15-year Meta contracts against 30-year plant lives — the stranded-asset question in one sentence. The assessment is that these "are the template arguments that will follow every multi-GW campus," and that outcomes here shape how much firm generation versus storage gets built for AI load **[Analysis — Moderate]** *(Meta dossier)*. That last clause is the investable content: a commission that distrusts 30-year gas plants backed by 15-year contracts is a commission more receptive to shorter-lived, more flexible assets.

#### The litigation template

Permitting risk in this sector arrives through private enforcement, not agency action. The Clean Air Act allows citizen suits, so a permit dispute becomes federal litigation brought by community plaintiffs. **xAI** is the template: a NAACP/Southern Environmental Law Center federal Clean Air Act suit over 27 allegedly unpermitted Southaven turbines, against which xAI recorded a **$399M litigation accrual** *(CNBC, 2026-04-14 — xAI dossier)*; a Mississippi DEQ order removing 69 temporary mobile turbines between August 2026 and July 2027; and a Clean Air Act permit granted in March 2026 for the permanent 1.2 GW, 41-turbine plant *(xAI dossier)*. **Crusoe**'s Texas gas fleet runs on minor "permit by rule" instruments with a pending major permit that would rank among the state's largest fossil plants **[Analysis — Moderate]** *(Crusoe dossier)*.

The lesson to generalise: the binding cost of permitting litigation is rarely the penalty. It is *schedule* — and in a market where the entire premium is paid for time-to-power *(section 3)*, a twelve-month injunction is more expensive than a nine-figure accrual.

### 8.8 The rule map

| Instrument | Mechanism | Who it helps | Who it hurts | Key date |
|---|---|---|---|---|
| **FEOC / prohibited foreign entity** | Pass/fail material assistance cost ratio (A−B)÷A gates the entire 30–40% investment credit | LGES, Samsung SDI, Panasonic, Fluence, Tesla's onshored chain — compliant supply prices at a premium | Any developer or integrator whose cost position rested on Chinese cells, Western ones included (Wärtsilä) | Enacted 4 Jul 2025; applies to construction starts after 31 Dec 2025; Notice 2026-15 Feb 2026; floor rises to 75% for 2030 starts |
| **Section 301 tariffs** | Border price on cells and on graphite, the anode input | US and allied cell makers; anyone with non-China capacity (LITEON's 60% by end-2026) | Importers of Chinese cells; also US cell plants buying Chinese graphite; Jinko concedes the US market | Both step-ups effective 1 Jan 2026 |
| **Section 122 surcharge** | Flat 10% layer that replaced the struck-down IEEPA tariffs | Nobody in particular — it is a general levy | All importers; and anyone who quoted a fixed landed cost before 20 Feb 2026 | Supreme Court struck IEEPA 20 Feb 2026 |
| **FCC Covered List** | Origin-based, two-prong bar on *new* equipment authorisations for connected bi-directional inverters; prospective only | Domestic-content manufacturers; holders of pre-28-July authorisations; suppliers of unidirectional wired-managed rack power **[Analysis — Moderate]** | Sungrow — roughly CNY 100B of market value shed in the following month; offshore production of any nationality, US brands included | Effective 28 Jul 2026; conditional-approval applications to 1 Jan 2028 |
| **DoD 1260H** | Bars Pentagon procurement; functions as a voluntary screen for private and federally-adjacent buyers | Korean and Japanese cell makers; licensees who build the plants (Ford BlueOval) | CATL, EVE | CATL listed Jan 2025; direct-contracting bans phase from Jun 2026; full bar Oct 2027; EVE reportedly added Jun 2026 |
| **FERC / Talen precedent** | Kills uncompensated behind-the-meter co-location; forces front-of-meter contracting with cost allocation | Merchant nuclear owners with pricing power (Constellation); grid-side storage **[Analysis — Moderate]** | Anyone whose economics needed uncompensated co-location | Rejected Nov 2024, upheld Apr 2025; FERC ordered PJM co-location rules Dec 2025 |
| **EU funded-project phase-out** | Excludes named Chinese inverters from EU-funded energy projects on cybersecurity grounds | Western inverter and UPS vendors in NATO geographies **[Analysis — High]** | Huawei, Sungrow | Full restrictions on new contracts by Apr 2027 |
| **Ratepayer politics & permitting** | Unwritten: capacity-cost backlash, commission scrutiny of demand evidence, Clean Air Act citizen suits | Developers who fund their own grid upgrades and pre-commit against pass-through (Oracle, Equinix, Microsoft's pledge) | Multi-GW gas packages with contract terms shorter than plant lives (the Meta/Entergy dissent); fast self-builders (xAI's $399M accrual) | Meta's Louisiana docket is the live bellwether; PJM auctions have cleared at the cap three times |

#### What this means for your capital

**Compliance is now an asset with a measurable price, and the price is the credit.** The clearest structural change in this sector is that a supplier able to certify FEOC-compliant provenance sells the same physical hardware at a premium, because it is selling the buyer's tax credit back to them. That premium is not a moat in the classic sense — it is a regulatory rent, and rents attract capacity. Expect it to compress as Korean, Japanese and US chains scale, and expect the 2030 ratchet to 75% to keep it alive longer than a pure competitive-entry model would predict. Monitor it directly: watch the gross margin on North American storage revenue at the compliant suppliers, and watch how much of their order intake carries explicit domestic-content or FEOC representations.

**Distinguish price levers from access levers when you size an exposure.** A tariff is survivable and passable through. A denied equipment authorisation is not. A company with heavy tariff exposure and a large pre-28-July-2026 authorised catalogue is in a very different position from one whose growth depends on authorising new bi-directional connected hardware. This distinction is where the market has most consistently mispriced the FCC action in both directions — reading it as a China ban when it is an origin test, then reading it as toothless because it produced no immediate revenue hole when its real bite is a roadmap freeze arriving two to four years out.

**Watch the finite pool, not the current mix.** The grandfathered cohort — projects that began construction on or before 31 December 2025 and are outside the material assistance test — is closed and depleting. Any observation about Chinese cells' current North American share (38.8% in H1 2026) is partly an observation about that cohort. The informative series is the composition of *new* construction starts, cohort by cohort, from 2026 forward. If that series does not shift toward compliant supply over the next four to six quarters, the regime is being routed around rather than complied with, and the compliant-lane premium thesis weakens.

**Licensing is the shape that blocked supply takes.** The CATL LRS model and EVE's minority-stake and offshore-cell structures are not evasions at the margin; they are the general equilibrium. Capital that assumes prohibited suppliers simply exit the US market will misread who is still earning from it — and misjudge the technology dependence that persists even inside nominally compliant plants, as the CATL-equipped Sparks line illustrates **[Analysis — Moderate]**.

**Timetable.** Near term (next four quarters): Samsung SDI's StarPlus Indiana LFP start in October 2026; conditional-approval filings under the FCC path; PJM's co-location rulemaking landing and the deal wave Constellation expects behind it. 2027: the EU funded-project restrictions taking full effect in April; the DoD full bar on CATL procurement in October; the first cohort of FEOC-tested projects reaching commercial operation, where compliance either survives audit or does not. 2028: conditional-approval applications close on 1 January; the Buy American domestic-content threshold steps from 65% to 75% in 2029. 2030: the storage material-assistance floor reaches 75%, which is the year the current compliant chains were designed against.

#### What would change my mind

- **A court or Treasury softening the cliff.** If the material assistance test acquires a proportional remedy, a cure period, or a broad de minimis allowance, the compliant-lane premium collapses quickly — the premium exists because the penalty is total.
- **A reopened or widened safe harbour.** Any guidance restoring a cost-based beginning-of-construction test for projects above 1.5 MW AC would refill a pool this chapter describes as closed, and would extend Chinese cells' credit-eligible runway by years.
- **An FCC clarification that "another similar connection" includes wired management.** That single interpretive question determines whether the Covered List reaches into wired-managed data-center rack power. A ruling that it does would invalidate the "outside on a plain reading" read above and materially widen exposure across the rack-power supply chain. A ruling that it does not would confine the action to solar and storage inverters.
- **Fast conditional approvals.** If the Department of War or DHS begins granting approvals promptly and at scale, the FCC action converts from an access bar into a paperwork-and-onshoring cost, and the durable share subsidy to domestic producers shrinks.
- **Compliant-supply margins that do not show the premium.** If LGES, Samsung SDI and Fluence scale North American storage revenue without margin expansion, then buyers are extracting the credit's value rather than sharing it, and the regulatory-advantage thesis is wrong on economics even if right on volumes.
- **A ratepayer-driven legislative clawback in PJM.** Capacity-revenue clawback would hit the merchant generators whose pricing power section 8.5 describes, and would push firming demand toward assets that do not depend on capacity payments.
- **Tariff reversal.** The stack has already moved twice in a year, once by court order. Another judicial or legislative reversal would re-open cost positions that suppliers have spent two years and several billion dollars of factory capital assuming away.

## 9. The Binding Constraint Nobody Prices — Craft Labor

Every other constraint in this report can eventually be bought. A transformer factory can be built. A turbine line can be expanded. A cell plant can be financed and stood up in under two years. A journeyman electrician cannot. That asymmetry is the subject of this chapter, and it is the one input in the AI data-centre buildout that no amount of capital relieves inside this decade.

Start with the vocabulary, because it is unglamorous and therefore under-examined. **Craft labor** means the licensed, certified trades that physically build electrical infrastructure: electricians who pull and terminate conductors, linemen who string and connect transmission, pipefitters, millwrights, and the commissioning technicians who energise and test a system before it carries load. **Self-perform** means a contractor uses its own employees rather than subcontracting — it is the difference between owning craft capacity and renting it. A **journeyman** is a fully qualified tradesperson; an apprentice is not, and cannot lawfully or safely be substituted for one on critical-path work.

Why should an investor care about any of this? Because a data centre is, in construction terms, an electrical building. The compute is the tenant. Everything the campus is made of — the substation, the switchgear, the busway, the uninterruptible power supply, the generators, the battery blocks, the thousands of terminations between them — has to be installed and commissioned by people who are individually scarce, whose supply grows slowly, and whose availability is not for sale at any price on a useful timescale. When the industry says a project is "power constrained", the equipment is usually only half the story. The other half is whether anyone can be found to install it.

| Metric | Value | What it means |
|---|---|---|
| Time to make a craftsman | 4 years | The slope of the supply curve, per Quanta's CEO |
| Craft-led spend | ≈$13.5M/MW | Per MW of data centre, excluding outside-the-fence power |
| Technology & Load Centers growth | 220–240% | Guided 2026 growth in Quanta's data-centre end market |
| Quanta craft hires, trailing year | +15,500 | Only ≈7,000 of them organic |

*Source: EC&M 2025 Top 50, 2025-06; 2026 Investor Day, 2026-03-31; Investor Day + Q2 2026 call, 2026-07-30 — Quanta dossier.*

### 9.1 Why capital cannot buy a craftsman

The governing fact of this chapter is a single sentence from the chief executive of the largest electrical contractor in the United States: **"it takes about four years to make a craftsman"** *(2026 Investor Day, 2026-03-31 — Quanta dossier)*. Quanta Services is not speaking loosely. It runs a 2,300-acre lineman college and spends roughly $250M a year on training, employs 69,500 people of whom more than 50,000 are craft, and self-performs more than 80% of its work *(2026 Investor Day, 2026-03-31 — Quanta dossier)*. This is a company that has industrialised the production of skilled trades as far as anyone has, and it still takes four years.

Four years is not an arbitrary number and it is not compressible with money. Qualification requires supervised hours on live systems, accumulated sequentially. You cannot parallelise it by hiring more instructors, because the binding input is supervised field time under an existing journeyman — which means the training programme itself consumes the scarce resource it is trying to create. Doubling intake does not double output; it raises the ratio of apprentices to journeymen on every crew, which lowers productivity now in exchange for capacity later.

Now put that supply curve against the demand curve. Quanta's Technology & Load Centers end market — its data-centre electrical and mechanical business — is guided to grow **220–240% in 2026** *(Investor Day + Q2 2026 call, 2026-07-30 — Quanta dossier)*. Company-wide revenue reached $9.56B in the second quarter of 2026, up 41%, on a record $53.4B backlog *(Quanta Q2 2026 release, 2026-07-30 — Quanta dossier)*. Rosendin, the number two, went from $2.80B of revenue in 2023 to $3.69B in 2024 to a company-reported $5.6B in 2025 — roughly doubling in two years *(EC&M 2025 Top 50, 2025-06; Construction Dive, 2026-01-28 — Rosendin dossier)*.

Demand compounding at triple digits against a supply curve with a four-year lag has exactly four possible responses, and it is worth being precise about them because only one of them adds net capacity to the industry:

1. **Work the existing workforce harder.** Overtime buys hours at rising cost and falling productivity, and it degrades safety on energised work. It has a ceiling and the ceiling arrives quickly.
2. **Poach.** Bidding a journeyman away from a competitor raises the wage and moves the same person between two projects. It reallocates output; it does not create any.
3. **Buy crews.** Acquiring a contractor acquires its craft. This is why Quanta added 15,500 people in a trailing year but only about 7,000 organically *(2026 Investor Day, 2026-03-31 — Quanta dossier)*, and why the sector has consolidated so fast. Like poaching, it changes ownership of capacity, not the amount of it.
4. **Take the work out of the field.** Redesign the product so fewer field hours are needed per installed megawatt. This is the only lever that genuinely expands what the industry can build in a given year — and it is the whole substance of the prefabrication story in section 9.3.

**[Analysis — High]** Quanta owns the scarcest input in the US buildout, and every AIDC power trend — transmission, substations, gas generation, BESS, inside-the-fence electrical and mechanical — converges on the same labor pool *(Quanta dossier)*. **[Analysis — High]** Rosendin is close to pure-play exposure to that same buildout: the revenue doubling matches the hyperscaler capex cycle exactly *(Rosendin dossier)*. And one structural detail is easy to miss: Rosendin has been 100% employee-owned since 2000. **[Analysis — Moderate]** The ESOP functions as a talent-retention moat in a labor-short market and permits patient investment; the cost is disclosure, since the financials are company-reported and unaudited *(Rosendin dossier)*. In a market where the asset is the crew, the ownership structure that keeps the crew is a competitive instrument, not a governance footnote.

> **Why the constraint shows up as schedule, not price**
>
> When a scarce input has an inelastic short-run supply, the market does not clear on price alone — it clears on rationing. Contractors ration by choosing customers. Quanta describes its own approach as selective and margin-first, and prices Electric-segment margins at 10–12% under optimal conditions *(Quanta dossier)*. For a developer, that means the answer to "can you build my campus" is increasingly "not this year", and the practical consequence is that *schedule* becomes the scarce good. Everything in this report that sells schedule compression is ultimately selling relief from this constraint.

### 9.2 The $13.5M-per-megawatt yardstick — and how to use it

Investors reading this sector are handed gigawatts and forced to guess at dollars. Quanta's management has published the cleanest public bridge between the two. It puts **craft-led spend at ≈$13.5M per MW of data centre, excluding outside-the-fence power**, and claims balance-of-plant coverage of 80–90% of a data-centre build *(2026 Investor Day, 2026-03-31 — Quanta dossier)*. Alongside it, management sizes its addressable slices as a share of a load-centre budget: HV transformers and substations 10–15%, low-voltage electrical 10–15%, mechanical plumbing 5–8%, MEP procurement 5–10% *(2026 Investor Day, 2026-03-31 — Quanta dossier)*. Separately, craft execution is described as more than 40% of typical project capex, with equipment manufacturing around 20% and procurement around 10% *(2026 Investor Day, 2026-03-31 — Quanta dossier)*.

Here is how to use a figure like that, and where the trap is.

**The use.** The $13.5M/MW number converts a megawatt headline into a dollar pool. A 1 GW campus implies on the order of $13.5B of craft-led spend inside the fence. That is arithmetic, not a forecast, and it is the single most useful sanity check available on this sector: when a vendor claims a total addressable market, you can test whether the claim is consistent with how much money actually lands inside the fence per megawatt. Quanta's own framing — a $2.4T total addressable market through 2030, with data centres at $565B and roughly 30% of the whole AI-driven *(2026 Investor Day, 2026-03-31 — Quanta dossier)* — is internally consistent with its per-megawatt figure, which is more than can be said for most published sector TAMs.

**The trap.** The two instruments have different denominators and must not be multiplied together carelessly. The $13.5M is dollars per megawatt of *craft-led spend*; the percentage slices are shares of a *load-centre budget*. Those are not the same base. Use the per-megawatt figure to size the pool, and the slices to rank which scopes are worth chasing relative to one another. If you need a scope's absolute dollar value, confirm the denominator first. It is also a single-source management figure, disclosed by a party with an interest in the number being large, and it explicitly excludes outside-the-fence power — the transmission, generation and interconnection covered in sections 3 and 4, which for a behind-the-meter campus can rival the inside-the-fence spend.

**Sizing a scope — the two instruments**

| Instrument | Value | What it is measured against | Citation |
|---|---|---|---|
| Craft-led spend | ≈$13.5M/MW | Per MW of data centre, excluding outside-the-fence power | *2026 Investor Day, 2026-03-31 — Quanta dossier* |
| Craft execution | >40% | Of typical project capex | *2026 Investor Day, 2026-03-31 — Quanta dossier* |
| HV transformers & substations | 10–15% | Of a load-centre budget | *2026 Investor Day, 2026-03-31 — Quanta dossier* |
| Low-voltage electrical | 10–15% | Of a load-centre budget | *2026 Investor Day, 2026-03-31 — Quanta dossier* |
| Mechanical plumbing | 5–8% | Of a load-centre budget | *2026 Investor Day, 2026-03-31 — Quanta dossier* |
| MEP procurement | 5–10% | Of a load-centre budget | *2026 Investor Day, 2026-03-31 — Quanta dossier* |
| Equipment manufacturing | ≈20% | Of typical project capex | *2026 Investor Day, 2026-03-31 — Quanta dossier* |

### 9.3 Prefabrication is a factor substitution — this is the chapter's central idea

Prefabrication sounds like a logistics improvement. It is not. It is the deliberate substitution of one factor of production for another, and understanding it that way explains almost every product launch in this sector over the past eighteen months.

Mechanically, prefabrication means building the electrical system in a factory rather than on the site. Conduit is bent in a jig. Panels are assembled on a bench. A whole electrical room is built inside a steel enclosure — an **eHouse**, in the trade's language — wired, tested and energised for proof under factory conditions, then trucked to site and set on a pad. What is left for the site crew is to make a small number of terminations and connections rather than to build the room.

Now the economics. Field electrician hours are a scarce, non-storable, non-scalable input, priced at whatever clears in a market that is rationing. Factory hours are the opposite: the workforce is trainable in months rather than years, the labor is capital-substitutable through jigs and automation, the location can be chosen for labor availability, and output is not weather-dependent or congestion-dependent. Prefabrication moves work from the constrained factor to the unconstrained one. That is the whole trick, and Rosendin's own framing says so directly: prefab is positioned as the structural answer to the electrician shortage, converting site labor constraints into factory throughput *(Rosendin sector page — Rosendin dossier)*. **[Analysis — Moderate]** Its Modular Power Solutions arm — 7,000+ MW of annual fabrication capacity across 2M+ sq ft — does exactly that, and the robotic solar-installer trial (350–400 modules per 8-hour shift with a two-person crew, roughly triple manual rates) extends the same logic to field labor that cannot be moved indoors *(Rosendin dossier, 2025-04-07)*.

There is a second, less obvious benefit that matters more to a financier than to an engineer. Field construction has high variance: weather, trade stacking, congestion, inspection delays, rework. Factory production has a takt time. Prefabrication therefore compresses not just the average schedule but the *distribution* of schedules. Since project financing and revenue-start dates are set against a pessimistic case rather than an expected one, cutting the tail is worth as much as cutting the mean. This is why prefab claims are quoted as delivery certainty as often as speed.

**Figure 12: Prefabrication's claimed compression versus conventional stick-build (% reduction; vendor claims, differing bases)**

| Claim | Axis | Reduction | Note |
|---|---|---|---|
| Vertiv SmartRun | Schedule | 85% | Installs ≈1 MW+/day |
| Huawei PowerPOD | Onsite labor | 70% | Delivery cut 28→18 weeks; 90%+ prefabricated |
| FlexGen | Installation time | 70% | One-touch commissioning |
| Delta prefab AI modular DC | Deployment time | 60% | Integrates 800 VDC in-row power |
| EVE 628 Ah vs 314 Ah | Installation workload | 50% | Also −50% components, −30% lifecycle maintenance |
| Tesla Megablock | Construction cost | 40% | Up to 40% lower vs current build practice |
| Fluence Smartstack 10 MWh | Balance-of-plant cost | 40% | ≈680 MWh/acre |
| Eaton Fibrebond + Flexnode | Schedule | ≈35% | Prefab data halls 3.5–35 MW |
| Tesla Megablock | Installation time | 23% | 1 GWh deployable in ≈20 business days |

*Source: Vertiv, 2025-03-18 / 2026-03-24 — Vertiv dossier; Huawei summit, 2025-05-13 — Huawei Digital Power dossier; FlexGen solutions page — FlexGen dossier; Delta Computex, 2026-06-02 — Delta dossier; EVE about page — EVE dossier; ESS News, 2025-09-09 — Tesla dossier; Fluence, 2026-06-23 — Fluence dossier; Eaton, 2026-01-28 — Eaton dossier.* **Read with care:** these are vendor claims on three different axes — schedule, labor content and cost — measured against vendor-defined baselines that are not comparable to one another. The table shows the *shape* of the industry's claim, not a like-for-like ranking.

The competitive consequence is the part investors most often miss. A buyer of data-centre power equipment is not minimising dollars per kilowatt. It is minimising the date of first revenue on a campus whose compute is already contracted — see the pre-sold order books in section 2. If being three months early is worth a quarter of a large campus's revenue, the buyer will pay a premium for schedule that is bounded by the value of that revenue, not by the cost-plus economics of a switchboard. So the competitive unit of account shifts from component price to **installed-megawatt lead time**. Eaton says this out loud: the Fibrebond acquisition ($1.45B) is described as moving its competition from component price to installed-megawatt lead time, and Flexnode extends it from power enclosures to turnkey prefab data halls of 3.5–35 MW at roughly 35% schedule compression *(Eaton release, 2025-04-01; Eaton, 2026-01-28 — Eaton dossier)*.

That shift reprices whole product categories, through three mechanisms worth naming:

- **The unit of sale becomes an assembly.** Nobody buys a switchboard; they buy an energised electrical room. Whoever owns the assembly captures margin on everything inside it *and* decides which components go inside. Component makers become suppliers to assembly makers — a structurally worse position, one step removed from the buyer's actual problem.
- **Factory capacity becomes the moat.** Prefab is capital-intensive and cannot be improvised in a tight market, which is why the capacity race is visible in the disclosures: Vertiv has four new or expanded Americas plants taking infrastructure-solutions capacity roughly seven-fold, plus SmartRun installing at ≈1 MW+ per day and up to 85% faster than stick-build *(Vertiv, 2025-03-18 / 2026-03-24 — Vertiv dossier)*; Rosendin's MPS runs 7,000+ MW/yr across 2M+ sq ft *(Rosendin sector page — Rosendin dossier)*. Where scarcity rent normally accrues to whoever owns the constrained asset, here it accrues to whoever owns the factory that removes the constraint.
- **Vertical integration into critical-path gear becomes rational.** Quanta runs prefab through Cupertino and Dynamic Systems and is nearly doubling HV transformer capacity by 2028 while making 800 kV-class breakers through the Hyosung HICO JV, claiming schedule acceleration "in some cases by >12 months" *(2026 Investor Day, 2026-03-31 — Quanta dossier)*. Breaker lead times of ≈125 weeks are throttling load-centre schedules *(Quanta Q2 2026 release, 2026-07-30 + dossier read — Quanta dossier)*. **[Analysis — Moderate]** If the largest buyer of grid equipment self-supplies from 2028, the scarcity rents now flowing to Hitachi Energy, Siemens Energy and GE Vernova erode at the margin, and Quanta's bids gain a schedule weapon rivals cannot match; contractor-run manufacturing is a different discipline and there is no production track record yet *(Quanta dossier)*.

Two more datapoints round out the picture. Huawei's PowerPOD ships 90%+ prefabricated, cutting delivery from 28 to 18 weeks with 70% less onsite labor *(Huawei summit, 2025-05-13 — Huawei Digital Power dossier)*; **[Analysis — High]** Huawei matters here as the excluded benchmark — its prefab and delivery claims set the spec and speed bar that Vertiv, Eaton, Schneider and Delta get measured against in international bids, and its US exclusion is a durable share subsidy for those vendors in NATO geographies *(Huawei dossier)*. Delta's prefabricated AI modular data centre claims up to 60% faster deployment *(Delta Computex, 2026-06-02 — Delta dossier)*, and ABB now delivers its VoltaGrid synchronous condensers as prefab eHouse packages *(Engineering.com, 2026-03-25 — ABB dossier)* — even a stabilisation product ships as an assembly now.

### 9.4 Labor-per-megawatt-hour as a specification

Once you accept that field labor is the constraint, the battery-hardware arms race in section 6 stops looking like a physics contest and starts looking like what it is: an argument about how many times a human being has to touch a site.

The mechanism is simple. A battery site's installed cost is driven less by the cells than by the count of discrete things somebody must bolt, torque, terminate, seal, label, communicate to, and test. Double the capacity of a cell and you halve the number of cells, modules, racks, busbar joints, communication drops, and torque checks per megawatt-hour. EVE states the arithmetic explicitly: its 628 Ah class claims −50% system components, −50% installation workload and −30% lifecycle maintenance versus 314 Ah systems *(EVE about page — EVE dossier)*. That is not a density claim dressed as a labor claim. It is a labor claim, and the density is how it is achieved.

Every entrant in the big-cell race is making the same argument at a different point on the ladder.

**The big-cell race, read as a labor argument**

| Vendor | Platform | The labor claim underneath it | Citation |
|---|---|---|---|
| BYD | HaoHan 14.5 MWh, 2,710 Ah Blade cell | The largest single DC block; roughly 3× conventional storage-cell capacity, so far fewer parts per MWh | *pv magazine, 2025-09-19 — BYD dossier* |
| Hithium | ∞Cell 1175 Ah; 1300 Ah / 6.9 MWh 8-hour-native, targeted Q4 2026 | First mass-produced kAh-class cell — the ladder's current top rung | *PR Newswire, 2025-06; pv magazine, 2026-06-09 — Hithium dossier* |
| Sungrow | PowerTitan 3.0, 684 Ah cell, 12.5 MWh per 30-ft | First mass-producible 684 Ah cell with SiC PCS integrated in the block | *pv magazine, 2025-06-10 — Sungrow dossier* |
| CATL | TENER Stack 9 MWh, 587 Ah | Road-legal half-height containers — fewer permits, lifts and site moves | *pv magazine, 2025-05-08 — CATL dossier* |
| EVE | Mr.Big 628 Ah | −50% components, −50% installation workload, −30% lifecycle maintenance vs 314 Ah | *EVE about page — EVE dossier* |
| Fluence | Smartstack 10 MWh | ≈680 MWh/acre; up to −40% balance-of-plant cost | *Fluence, 2026-06-23 — Fluence dossier* |
| Tesla | Megablock — 20 MWh MV block, 4× Megapack 3 with factory-integrated transformer and switchgear | 23% faster installation, up to 40% lower construction cost, 248 MWh AC/acre, 1 GWh in ≈20 business days | *ESS News, 2025-09-09 — Tesla dossier* |

Megablock deserves a second look because it makes the most aggressive version of the move. Its real innovation is not the 20 MWh number; it is that the medium-voltage transformer and switchgear are pulled inside the factory boundary. Medium-voltage termination is among the highest-skill, most heavily supervised, most schedule-critical work on a battery site. Moving it indoors removes the single scarcest crew from the critical path. **[Analysis — Moderate]** Tesla's answer to Chinese density leadership is standardisation plus software — integrated Megablock units winning on site-level cost and schedule, and the Autobidder layer deepening a software moat — rather than competing on container density alone *(Tesla dossier)*.

> **Demand the basis before you believe a density claim**
>
> Site-density figures such as 248 MWh AC per acre and ≈680 MWh per acre use vendor-specific measurement bases and are not directly comparable *(Tesla dossier)*. The same is true of every percentage in Figure 12: "faster" may mean schedule, labor hours, or cost, measured against a baseline the vendor chose. When a claim is doing work in an investment case, the useful question is not how large the number is but what it is divided by.

There is a final, easily overlooked labor layer: commissioning. A battery system is not delivered when it arrives; it is delivered when a technician has energised, tested and signed it off. That is why FlexGen — which had already exited the hardware lane for software and services *(FlexGen dossier)* — bought commissioning firm Clean Energy Services with 125+ field technicians and 15+ GWh of BESS commissioned *(Business Wire, 2026-04-02 — FlexGen dossier)*. It is also why FlexGen's 70%-faster-installation and under-one-year-versus-4-to-8-year-queue claims are credible as a package rather than as software alone *(FlexGen solutions page — FlexGen dossier)*. An availability guarantee is a promise about technicians. Buying the technicians is how you make the promise deliverable.

### 9.5 Channel, customer, competitor — the contractor problem

For anyone selling power or storage equipment into this market, the electrical contractors occupy three roles simultaneously, and confusing them is expensive.

- **Channel.** They specify and procure. Quanta supplied and installed roughly 7,000 inverters across its 2021–25 solar work *(2026 Investor Day, 2026-03-31 — Quanta dossier)*. Rosendin has installed 9.5–10+ GWh of BESS and 151 substations, and its named projects run on other vendors' hardware — Townsite pairs 232 MWdc of solar with 90 MWac of Tesla Megapack *(Rosendin dossier; Arevon, 2022-04 — Rosendin dossier)*.
- **Customer.** They buy the equipment they install, on their own paper, inside their own EPC scope (engineering, procurement and construction — the contractor that actually builds the project).
- **Competitor.** They are moving up the stack into the products they used to install.

The clearest example of the third role is **BESSUPS**. Announced in June 2025, it pairs Rosendin's patented BESSUPS design with FlexGen's grid-interconnection and transient-frequency-stabilisation patents to build a utility-scale battery system, sited outside the building at medium voltage, engineered to replace conventional data-centre UPS systems *and* diesel generators while meeting CBEMA power-quality limits *(Business Wire, 2025-06-03 — Rosendin/FlexGen dossiers)*. Rosendin separately partnered with Phinergy in August 2025 to bring aluminium-air backup generators to the US data-centre market as a diesel alternative, selected from 70+ proposals through the Net Zero Innovation Hub *(Rosendin × Phinergy PR, 2025-08-12 — Rosendin dossier)*. **[Analysis — Moderate]** Rosendin's Energy Group is being deliberately converged with the data-centre franchise — BESSUPS, Phinergy, and stated exploration of SMRs and gas turbines read as a play to sell data-centre customers power capacity, not just electrical installation, because in its own SVP's words, without power "development stops" *(Rosendin dossier)*.

The structural reason this happens is worth generalising, because it predicts where else it will happen. Whoever owns the constrained factor owns the schedule; whoever owns the schedule can dictate the architecture. A contractor that can eliminate field labor has both the strongest incentive to redesign the product and the most credibility with the buyer when it does — it is the party that actually knows how many hours the current design costs. That same logic runs upstream in Quanta's transformer and breaker programmes. Expect the pattern wherever the installer's hours dominate the installed cost.

### 9.6 How to read a contractor's backlog

Contractor backlog is the most-cited and least-understood number in this chapter, and Quanta's is a textbook case of why.

Two different measures are in play. **RPO** — remaining performance obligations — is the accounting-defined measure of revenue under enforceable contracts not yet delivered. **Backlog** is company-defined and, at Quanta, includes management's estimates of work expected under master service agreements. At Q2 2026 the record headline backlog was $53.4B while RPO was $33.6B *(Quanta Q2 2026 release, 2026-07-30 — Quanta dossier)*. Roughly $20B of the headline is therefore estimate rather than contract — and MSAs typically carry no volume guarantee.

But the number also *understates* the pipeline in two specific ways. The "significant majority" of the ≈3 GW NiSource combined-cycle programme — awarded October 2025 with Zachry Group, phased through 2032 — is excluded from reported backlog *(Quanta, 2025-10-30 — Quanta dossier)*, and data-centre MSA work runs book-and-burn, appearing as revenue without ever passing through backlog at all *(Quanta dossier)*. **[Analysis — High]** The headline backlog is therefore **neither a floor nor firm**; read it in both directions before citing it *(Quanta dossier)*.

Rosendin's equivalent disclosure is different in kind and instructive. Its customers provide work forecasts **10–20 years out** *(Construction Dive, 2026-01-28 — Rosendin dossier)*. A forecast is not an order, and no investor should read it as one. What it *is* — and this is the economically important part — is the visibility that permits a labor-constrained business to commit capital to four-year training pipelines, 2M+ sq ft of fabrication space, and regional hubs in Chandler and Richmond. In a market where capacity takes four years to create, a credible twenty-year demand signal is the input that makes the investment rational. It is also why the private, employee-owned structure works: the aggregate GWh and backlog claims are company-reported and unaudited, with individual projects corroborated by owner press *(Rosendin dossier)*.

One caution on growth quality. **[Analysis — Moderate]** Quanta's 41% headline growth is heavily M&A-assisted — twelve acquisitions in eighteen months — with a 43% GAAP-to-adjusted EPS uplift driven by deal amortisation ($2.96 GAAP versus $4.24 adjusted in Q2 2026), goodwill and intangibles at roughly 39% of assets, and an ≈89x trailing P/E after the Q2 pop; the intra-year $789→$363 drawdown shows how violently the multiple compresses when doubt arrives *(Quanta dossier)*. Read that carefully rather than dismissively: in a labor-constrained industry, acquisitions are the mechanism by which craft capacity is acquired, so M&A-assisted growth is not automatically low quality. The risk sits in the accounting gap and the multiple, not in the logic of buying crews.

**What to monitor in a contractor disclosure**

- **Organic versus total headcount adds.** The single best read on whether the labor constraint is loosening. Organic adds are new capacity; acquired adds are transferred capacity.
- **The RPO-to-backlog gap, and its direction.** Widening means more of the headline is management estimate.
- **Book-and-burn commentary.** If data-centre MSA revenue is landing without touching backlog, backlog is not the growth indicator.
- **Margin, not just revenue.** Quanta prices Electric-segment margins at 10–12% under optimal conditions *(Quanta dossier)*. Scarcity of labor should show up as margin, not only as volume.
- **Prefabricated share of delivered scope.** The direct measure of whether the industry's only genuine capacity-adding lever is being pulled.

### 9.7 What this means for your capital

**The mechanism to hold onto.** Craft labor is the one input in this buildout with a four-year lead time and no capital shortcut. Between now and roughly 2030, the industry's total installable megawatts per year is set by how much field work it can remove from the field — not by how much equipment it can buy. That single sentence reorders the sector's competitive map.

**Where the economics point.** Value accrues to whoever shortens installed-megawatt lead time, because the buyer's objective function is the date of first revenue on pre-sold compute, not the unit price of a switchboard. That favours three positions: owners of factory capacity that converts field hours into factory hours (Fibrebond inside Eaton, MPS inside Rosendin, Vertiv's ≈7x infrastructure-solutions expansion); vendors whose product ships as an energised assembly rather than a component (Megablock pulling MV switchgear indoors is the purest example); and owners of the craft and commissioning labor itself, which is scarce, contractually sticky, and cannot be replicated by a competitor's balance sheet inside four years. It disfavours the position of component supplier to an assembly maker — one step removed from the buyer's real problem, and increasingly a price-taker to the party that owns the enclosure.

**What is a rent and what is a moat.** Distinguish these carefully, because they decay differently. Labor scarcity itself is a rent on the capex cycle — it disappears when demand pauses. Factory capacity, a trained workforce, and an installed base under long-term service agreements are closer to moats: they were expensive to build, they took years, and they keep earning after the cycle cools. The prefabrication capacity race that looks like a cost war in 2026 is, in fact, the construction of the durable asset in this chapter.

**What to monitor, and on what timetable.** Quarterly: organic versus acquired headcount adds at the top contractors; the RPO-to-backlog gap and its direction; Electric-segment margins against the 10–12% optimal band. Through 2026–27: whether prefab and big-cell schedule claims survive contact with field data — Megablock customer deliveries in the second half of 2026 and the Brookshire ramp are the first real test, Hithium's 1300 Ah / 6.9 MWh system is targeted for Q4 2026, and Smartstack's 10 MWh variant follows its first deliveries. Into 2028: Quanta's transformer capacity doubling and the Hyosung HICO breaker JV, which decide whether the largest buyer of grid equipment becomes a credible maker of it.

*This passage is framing for understanding the sector's mechanics. It is not a recommendation to buy or sell any security.*

**What would change my mind**

- **Organic craft headcount growing faster than revenue at the top contractors.** That would mean hiring has outrun available work and labor has stopped binding. It is the cleanest single falsifier in this chapter.
- **Contractor margins compressing while revenue grows.** If the owner of the scarcest input cannot hold price, either the input is not as scarce as described or competition is dissipating the rent. Watch Quanta's Electric-segment margin against its own 10–12% optimal band.
- **Prefab claims failing in the field.** If the 35–85% compression claims in Figure 12 do not appear in delivered project schedules, prefabrication is a marketing category rather than a factor substitution, and installed-megawatt lead time stops being the competitive unit.
- **A field failure or safety event in the kAh-class cell platforms.** The labor-per-MWh logic reverses if very large blocks prove harder to service or contain; the industry would move back toward more, smaller, individually serviceable units, and the density race would lose its economic rationale.
- **A capex pause.** Labor scarcity is a derivative of the demand cycle, not a permanent feature. Only ≈20% of the 307 GW US pipeline converts near-term *(Eaton dossier)* — **[Analysis — Moderate]** — and a pause would un-bind the constraint faster than any supply-side response could, leaving the factory capacity built for it as overhead rather than moat.
- **Automation outrunning the four-year clock.** If robotic installation of the Rosendin/ULC kind moves from trials to standard practice on electrical scope rather than solar racking, the supply curve steepens and the whole scarcity premium re-rates downward.

## 10. What Could Go Wrong — the Risk Stack on a Calendar

Most risk discussion in this sector is atmospheric. People say the buildout "feels like a bubble," or that "the politics are turning," and then nothing follows — because a feeling cannot be tested, sized, or timed. This chapter converts unease into instruments. A risk you can hold properly has four parts: a **mechanism** (the chain of cause and effect by which it would actually damage the businesses in this report), an **observable** (a specific published number or filing that changes when the mechanism engages), a **location** (which document, whose disclosure, which docket), and a **date** (roughly when you would see it). Anything missing all four is a mood.

> **How to hold a risk — the four fields**
>
> **Mechanism.** What breaks, in what order? A risk that cannot be traced from cause to a company's cash flow is not investable in either direction. **Observable.** What number moves, and in which direction? Order intake, backlog conversion, an energization milestone, a permit status, a regulator's docket entry. **Location.** Where does it appear first? Almost always in a supplier's order book or a regulator's filing, not in a press release from the buyer. **Date.** Even an approximate one. The value of a date is that it forces you to distinguish a risk that would show up this quarter from one that cannot express itself until 2028 — and those two deserve completely different weights in a portfolio.
>
> One structural feature of this sector makes the discipline unusually powerful: **the buyers announce, and the suppliers disclose.** Hyperscaler and neocloud announcements are marketing artifacts with no audit trail. Supplier order intake is an accounting event. So the leading indicator for almost every demand-side risk below is somebody else's income statement.

| The number | What it is |
|---|---|
| ≈20% | Of the 307 GW US data-center pipeline converting near-term — the bulk is 2028+ |
| ≈$11.5B | Implied quarterly OpenAI losses, inferred from Microsoft's $4.1B equity-method line |
| 3 | Consecutive PJM capacity auctions clearing at the administrative cap |
| $399M | xAI's self-recorded litigation accrual on the turbine permitting suit |

*Source: Eaton dossier (pipeline conversion — **[Analysis]** (Moderate)); OpenAI dossier (**[Analysis]** (High)); Constellation dossier (**[Analysis]** (Moderate)); CNBC, 2026-04-14 — xAI dossier.*

### 10.1 Demand quality — what "circular financing" actually means

Start with the term, because it is used loosely. Financing is **circular** when the same capital appears on both sides of a transaction: a supplier funds its customer, the customer uses the money to buy the supplier's product, and the supplier books the proceeds as revenue. Nothing about that is illegal or even unusual in an early-stage capital cycle — vendor financing built the telecom networks of the 1990s. The problem is informational. Circular flows make revenue growth look like independent third-party demand when part of it is the seller's own balance sheet coming back around. And they make the system fragile in one specific way: if the funding node pauses, several nodes stop at once, because they were never independent to begin with.

The structure here is documented rather than alleged. NVIDIA invests up to $100B as OpenAI deploys NVIDIA systems; Amazon invests $50B while selling $138B of cloud; Oracle borrows (≈$96B reported) against OpenAI receivables; Microsoft's $4.1B quarterly equity-method losses imply ≈$11.5B of quarterly OpenAI losses **[Analysis]** (High) *(OpenAI dossier)*. Oracle's own cash statement shows what carrying that structure costs: FY2026 free cash flow of −$23.7B, funded with $43B of debt plus $5B of equity and ≈$40B more planned *(Q4 FY2026 earnings, 2026-06-10 — Oracle dossier)*.

The second, related quality problem is the gap between what has been **announced**, what has been **contracted**, and what is actually **energized** — three very different things that press coverage collapses into one. Oracle's $638B RPO — remaining performance obligation, the accounting term for contracted revenue not yet delivered — is instructive: roughly half is press-attributed to a single ≈$300B OpenAI contract starting 2027, $75B is GPU-prepayment structures, and ≈0.3 GW is operational against more than 9 GW projected by 2029 **[Analysis]** (Moderate) *(Oracle dossier)*. An RPO is a promise with a counterparty attached; its quality is the counterparty's ability to pay, not the size of the number.

**Figure 17: Announced, contracted, energized — three numbers that are not the same number (GW)**

| Party | Basis | GW |
|---|---|---|
| Crusoe | Claimed pipeline (announced) | 40+ |
| Crusoe | Contracted | ≈4.9 |
| Stargate | Projected by 2029 (announced) | >9 |
| Stargate | Operational now (energized) | ≈0.3 |
| CoreWeave | Contracted | 3.5+ |
| CoreWeave | Active (energized) | 1.0 |

*Source: Crusoe release, 2026-07 — Crusoe dossier; Oracle dossier (**[Analysis]** (Moderate)); CoreWeave Q1 2026 results, 2026-05-07 — CoreWeave dossier. Note: equipment orders are placed against the announced rows; cash is collected against the energized ones.*

The counterweight is real and belongs in the same paragraph. Microsoft's commercial RPO of $678B is growing faster (+84%) than its capex *(FY2026 Q4 results, 2026-07-29 — Microsoft dossier)*, which is the signature of demand that is genuinely pre-sold rather than speculatively built. And the credit market has been repricing this risk downward, not upward: CoreWeave's GPU-backed coupon went from ≈15% in 2023 to investment-grade SOFR+225bps on an $8.5B facility in 2026 *(globaldatacenterhub, 2026-03-15 — CoreWeave dossier)*. So this is not a thesis that the demand is fake. It is a thesis that the demand has a concentrated funding dependency, and that the dependency is knowable.

**The observables**

- **Supplier order intake, quarterly.** A capex pause appears in GE Vernova's, ABB's, Vertiv's, Schneider's and Hitachi Energy's order lines one to two quarters before it appears in any buyer's guidance, because orders are cancelled or deferred before programs are publicly cut. Watch the sequential order number, not the backlog — backlog is a stock and lags.
- **Single-counterparty concentration events.** CoreWeave's Q3 2025 guidance cut was caused by one third-party developer running late **[Analysis]** (Moderate) *(CoreWeave dossier)*. That is the leased model's fragility made visible, and it is the shape a first crack takes: one name, one quarter, one delay.
- **OpenAI's announcement cadence.** It is the sector's primary timing trigger — Oracle, CoreWeave, AMD and Broadcom order books repriced on its announcements **[Analysis]** (High) *(OpenAI dossier)*. A cadence that goes quiet is itself the signal.

### 10.2 Duration — the roughly 20% problem

The single most important number for anyone underwriting this sector is not the size of the pipeline; it is its **duration**. Only about 20% of the 307 GW US data-center pipeline converts near-term, with the bulk in 2028 and beyond **[Analysis]** (Moderate) *(Eaton dossier)*. Read that in both directions, because it cuts both ways and most commentary only takes one side.

The favourable reading: four fifths of the pipeline sits beyond the next two years, which means the visible revenue is booked against a very long tail. Suppliers are not selling into a spot market; they are selling into multi-year frame agreements. That is why the order books look the way they do — Hitachi Energy's $57.9B backlog is roughly 2.9x annual revenue *(Hitachi Ltd FY2025 annual results presentation, 2026-04-27 — Hitachi Energy dossier)*, Vertiv's $15.0B backlog came in on a ≈2.9x book-to-bill *(FY2025 8-K, 2026-02-11 — Vertiv dossier)*, and Siemens Energy booked €10.0B of Gas Services orders in one quarter at a 2.65 book-to-bill *(Q3 FY26 earnings release, 2026-08-05 — Siemens Energy dossier)*. Long duration is why a single bad quarter of demand news does not empty a factory.

The unfavourable reading is the same fact seen from the other end: **a long-dated pipeline is a pipeline that has not been paid for yet.** Deferral is cheap when delivery is years out. Cancelling a 2029 delivery slot costs a developer far less than cancelling a 2026 one, so the far end of the book is the soft end. This is why backlog *quality* — not backlog size — is the thing to interrogate. Quanta's record $53.4B backlog is explicitly neither a floor nor firm: the NiSource ≈3 GW program is mostly excluded from it, data-center master-service-agreement work runs book-and-burn outside backlog entirely, and RPO is only $33.6B **[Analysis]** (High) *(Quanta dossier)*. Two companies can report the same backlog number and mean entirely different things by it.

**The observables**

- **Sequential order intake versus backlog.** Backlog can keep rising for two quarters after orders turn. The order line turns first.
- **Energization milestones, site by site.** Not gigawatts announced — megawatts actually carrying load. This is the number that converts a backlog into cash.
- **Book-to-bill dropping below 1.0** at any of the electrification suppliers. Above 1.0 the book is growing; below 1.0 it is being consumed. That crossing is unambiguous and public.

### 10.3 The political economy — who pays for the wires

Here is the mechanism, and it is worth being precise because it is the risk most likely to be mispriced. In a regulated US electricity market, the cost of new transmission and generation built to serve a large new load is recovered through rates — that is, spread across all customers on that system, including households. When a single 1 GW customer arrives, the utility invests billions and the regulator decides who pays. If the data center pays, the project's economics carry the cost. If ratepayers pay, the data center's economics improve and someone's electricity bill goes up. That allocation decision is political, and politics has a shorter cycle than a transformer lead time.

The evidence that the politics has already turned: three consecutive PJM capacity auctions clearing at the administrative cap, the first RTO-wide reliability shortfall in PJM's history, a 13-governor affordability coalition, and utility-bill anger contributing to 2025 election outcomes — with legislated clawback of capacity upside a live scenario for exactly the revenue stream behind raised guidance **[Analysis]** (Moderate) *(Constellation dossier)*. A "capacity auction clearing at the cap" means the market for firm capability could not clear at any price the rules permitted; it is the price signal for scarcity hitting a regulatory ceiling, and a ceiling that keeps being hit invites legislators to change the rules.

The named bellwether is Meta's Louisiana docket. The Entergy package adds seven new gas plants (≈2.3 GW approved plus ≈5.2 GW proposed) plus three grid-scale batteries *(Meta, 2026-07-13 — Meta dossier)*, and the proceeding has produced the template arguments that will follow every multi-gigawatt campus: LPSC challenges, a judge compelling Meta to disclose withheld demand evidence, and a dissenting commissioner flagging 15-year customer contracts against 30-year plant lives *(UCS — judge orders Meta to explain gas demand — Meta dossier)*. **[Analysis]** (Moderate) The outcome shapes how much firm generation versus storage gets built for AI load *(Meta dossier)*. Note the direction of that last point carefully: a regulator that refuses to approve 30-year gas plants for 15-year contracts does not eliminate the load — it pushes the firming requirement toward assets with shorter lives and faster permits, which is storage.

The industry has already produced its own answer, and adoption of it is the thing to watch. Oracle publicly commits to on-site generation or Oracle-funded upgrades with no ratepayer pass-through *(Oracle post, 2026-01-26 — Oracle dossier)*; Equinix signed a 20-year take-or-pay in which it funds 100% of grid upgrades *(Equinix dossier, 2026-08-06)*; Google put 1 GW of data-center demand response in place across five utilities *(Google, 2026-03-19 — Google dossier)*. Each is a pre-emptive concession designed to keep the permit. Each also raises the campus bill of materials.

**The observables**

- **State-commission dockets** for large-load tariffs and special contract classes. The Louisiana LPSC proceeding is the live one; the pattern of the ruling matters more than the ruling.
- **The next PJM capacity auction result** — a fourth consecutive clear at the cap raises the probability of legislated intervention materially.
- **FERC's PJM co-location and large-load rulemaking.** Constellation management expects data-center deal flow to "kick off with a bit of a bang" once it lands *(Constellation dossier, 2025-12-18)*. Undated, and therefore a risk in both directions.

### 10.4 Permitting litigation — the xAI template

Behind-the-meter generation solves the interconnection queue by not using the grid. It does not solve air permitting. A gas turbine is a regulated emissions source under the Clean Air Act whether or not its electricity ever touches a utility wire, and the permitting path for a permanent plant is slower than the schedule that made behind-the-meter attractive in the first place. That tension is the entire risk: the fastest way to power a campus is to install mobile turbines under temporary or minor instruments, and the temporary instrument is exactly what a litigant attacks.

xAI is the documented case. A federal NAACP Clean Air Act suit covers up to 35 unpermitted mobile turbines documented at Memphis and 27 alleged at Southaven, against a self-recorded litigation accrual of $399M *(CNBC, 2026-04-14 — xAI dossier)*. Separately, 69 temporary mobile turbines at Southaven carry an agreed removal window of August 2026 to July 2027 under a Mississippi DEQ order, while a permitted 1.2 GW, 41-turbine permanent plant is under construction *(CNBC, 2026-03-10 — xAI dossier)*. Read those two facts together and the mechanism is plain: the temporary fleet is a bridge with a legally fixed expiry, and the permanent plant has to be finished before the bridge is removed. Any slip in the permanent plant is a capacity problem with a date on it.

The same structure exists in Texas at a different stage. Crusoe's gas fleet runs on minor "permit by rule" instruments with a pending major permit that would rank among the state's largest fossil plants **[Analysis]** (Moderate) *(Crusoe dossier)*. The wider constraint is already priced into siting decisions: a record ≈$130B of US projects blocked or delayed on power in Q1 2026, Amsterdam's >70 MW connection moratorium, and Singapore's rationed releases **[Analysis]** (Moderate) *(Equinix dossier)*.

**The observables**

- **Permit status of comparable behind-the-meter gas fleets** — specifically whether major-source permits are granted, contested, or converted to consent decrees.
- **The August 2026 – July 2027 xAI mobile-turbine removal window.** Whether the permanent plant energizes before the temporary fleet leaves is a dated, binary, publicly observable test of the entire template.
- **Litigation accruals** in developer disclosures. An accrual is a company's own estimate of probable loss; a rising accrual is management telling you the case got worse.

### 10.5 Scarcity-rent normalisation — the 2027–28 wave

A distinction that matters more than any other in this sector: the difference between a **moat** and a **rent**. A moat is a durable structural advantage — a cost position, a patent, an installed base with switching costs. A rent is a price premium you can charge only because supply is temporarily short. Both look identical on an income statement while they last. They diverge completely when capacity arrives.

Most of the pricing power visible in this market today is rent. GE Vernova's deposit-backed slot reservations price 10 to 20 points above its existing backlog, taken with ≈20% cash down, selling against 2031 delivery *(Turbomachinery Magazine, 2026-07; December 2025 Investor Update transcript, 2025-12-09 — GE Vernova dossier)*. That premium exists because the queue exists. And competing supply is scheduled: GEV's own output ramps from ≈20 GW/yr toward 24 GW in 2028 and actions toward 30 GW by 2030 *(Utility Dive, 2025-12 — GE Vernova dossier)*, Siemens Energy nearly doubled unit sales in a year (194 turbines in FY25 against 100 in FY24) *(Siemens Energy release, 2025-11-14 — Siemens Energy dossier)*, and Mitsubishi calls its own +30% capacity addition "not enough" — **[Analysis]** (High) competitor supply lands in the same 2028–2030 windows GEV is currently selling *(GE Vernova dossier)*.

The same arithmetic applies to the transformer and prefabrication capacity now under construction: Hitachi's $457M South Boston, Virginia plant is operational in 2028 *(Hitachi Energy release, 2025-09-04 — Hitachi Energy dossier)*, Siemens Energy is adding 30–50% transformer and turbine capacity across FY26–28 *(CMD 2025, 2025-11-20 — Siemens Energy dossier)*, Quanta is spending $500–700M to nearly double HV transformer capacity by 2028 *(2026 Investor Day, 2026-03-31 — Quanta dossier)*, and Schneider is putting more than $700M across eight US sites through 2027 *(release, 2025-03-25 — Schneider dossier)*. **[Analysis]** (Moderate) Roughly $1.8B of announced US transformer investment lands in 2027–28, and pricing power (+60–80% transformer inflation since 2020) normalizes if utilities' ordering behaviour does *(Hitachi Energy dossier)*.

Two qualifications keep this from being a simple short-the-rent argument. First, transformers are the exception that stays tight: Wood Mackenzie models a ≈30% US supply deficit in 2025, prices up 77% since 2019, and constraints persisting "well into the 2030s" *(Wood Mackenzie, 2025-02 — Hitachi Energy dossier)*. Second, the incumbents can choose not to relieve the shortage — **[Analysis]** Siemens Energy's "measured expansion plus shareholder returns" posture supports pricing power precisely by prolonging the bottleneck *(Siemens Energy dossier)*. Capacity discipline is a strategy, and it is observable in capex guidance.

**The observables**

- **Announced plant commissioning dates versus actual startups** in 2027 and 2028. A slipped factory extends the rent; an on-time factory ends it.
- **Reservation-fee behaviour.** Slot reservation fees returning at Siemens Energy for the first time since the early 2000s was the signal that rent had arrived; fees being waived or discounted is the signal it is leaving.
- **Any quotation priced for 2028-or-later delivery** that still embeds 2026 scarcity pricing. That is where margin compression will actually be recognised.

### 10.6 Policy drift, in both directions

Three separate regimes are shaping who may sell what into the US market, and each can move either way. Investors habitually model policy risk as one-directional — the rules get stricter, the protected incumbent wins. That is only half the exposure. A rule that is relaxed, delayed, or given a broad exemption path destroys the pricing umbrella that the compliant lane's margins depend on.

#### FEOC and the tax credit

FEOC stands for "foreign entity of concern." Its mechanical effect is not a ban; it is a **subsidy eligibility test**. US storage projects claim an investment tax credit, with an additional 10% bonus for domestic content. If a project's supply chain fails the FEOC rules under the OBBBA, the credit is at risk — which means the project's returns are at risk, which means the developer will not buy the non-compliant product at any plausible discount. That is why compliance functions as a price umbrella rather than a quality claim: it does not make the product better, it makes the buyer's tax position work. Fluence built its US network specifically for it, states it expects to meet FEOC compliance by the regulatory deadlines *(Energy-Storage.News, 2025-11 — Fluence dossier)*, and shipped its first US domestic-content systems in September 2025 *(ESS News, 2025-09-05 — Fluence dossier)*.

Stack the tariff schedule on top — US tariffs on Chinese battery imports step from 7% to 26% in 2026 *(ESS News, 2025-06-06 — Hithium dossier)* — then add procurement exclusion: CATL sits on the DoD 1260H list with Pentagon procurement bars phasing in from June 2026 and a full bar in October 2027, pushing its US strategy to a license-royalty-service route with Ford's $3.5B BlueOval plant as the template *(CnEVPost, 2026-07-24; electrive, 2026-06-18 — CATL dossier)*; and EVE was reportedly added to 1260H in June 2026 while an LG/Tulip ITC action threatens cylindrical imports — **[Analysis]** (High) the US market is closing on EVE from three directions *(EVE dossier)*. Three instruments, three mechanisms: a tax credit that decides project returns, a tariff that decides landed cost, a procurement list that decides eligibility outright.

The drift risk is symmetrical and under-modelled. Deadlines extended, safe harbours widened, or licensing structures blessed would each let low-cost Chinese cells back into the compliant lane's price comparison, and the compliant lane's margin is the first thing that gives.

#### The FCC Covered List — what it actually does

This action is routinely described as a pending draft ban on Chinese inverters. It is none of those three things, and getting it right changes which companies are exposed. On **28 July 2026 the FCC added foreign-produced connected power inverters to its Covered List, effective immediately** *(FCC Fact Sheet — Covered List updated to include foreign-produced power inverters and robots, 2026-07-28 — Huawei Digital Power dossier)*. Covered-List products cannot receive FCC equipment authorization, and without authorization a device cannot be imported, marketed or sold in the US. Authorization is the gate; the Covered List closes it.

> **The FCC action, mechanically — four things people get wrong**
>
> **1. It is an origin test, not a China rule.** "Foreign-produced" means failing the Buy American domestic-end-product test — US manufacture with domestic component cost above 65% through 2028, rising to 75% in 2029. The FCC names no company and no country *(National Law Review — "foreign-produced" as a Buy American domestic-end-product test, 2026-07 — Huawei Digital Power dossier)*. An American brand manufacturing offshore is caught. **[Analysis]** On a plain reading of the origin test, Taiwanese production by Delta or LITEON is foreign-produced on the same terms as mainland production *(Huawei Digital Power dossier)*.
>
> **2. Both prongs must be met.** The device must be *bi-directional*, converting DC to AC or AC to DC — enumerated as microinverters, string inverters, central inverters, and hybrid or battery-based inverters — *and* it must have connectivity enabling remote communication, control or monitoring over Wi-Fi, cellular, Bluetooth or another similar connection. The stated rationale is remote firmware push by a foreign adversary. Equipment lacking remote control, or using an air-gapped external control architecture, is reported to fall outside *(Energy-Storage.News — concerns over scope clarity and the wired-connection ambiguity, 2026-07 — Huawei Digital Power dossier)*.
>
> **3. It is prospective only.** Models authorized before 28 July keep their authorization and may still be imported and sold. This is a new-authorization freeze, not a market withdrawal — so the effect arrives on the product-refresh cycle rather than immediately.
>
> **4. There is a conditional-approval path.** Applications run to 1 January 2028 through the Department of War or DHS, requiring ownership disclosure, a full bill of materials and supply-chain map, and a time-bound US onshoring plan. No published review timeline *(Morgan Lewis — Covered List addition and the Conditional Approval process, 2026-08 — Huawei Digital Power dossier)*.

The consequences worth teaching, because they draw the perimeter of the exposure. A unidirectional AC-DC server power supply or power shelf with wired management — PMBus, or IPMI/Redfish/SNMP over Ethernet — fails the first prong and, on a plain reading, the second as well. A DC block shipped without a power conversion system falls outside because there is no inverter in the scope of supply at all. Inside the perimeter sit hybrid and battery-based inverters, storage PCS, and EV-charging equipment. **[Analysis]** (Moderate) Any read of a specific company's exposure is inference, not a sourced ruling: whether wired management satisfies "another similar connection" is unresolved, and that single question determines how far the rule reaches into wired-managed power electronics, including data-center rack power *(Huawei Digital Power dossier)*.

The market impact has already been asymmetric in a way that illustrates the point. **[Analysis]** (Moderate) Huawei's incremental loss was minimal — the Entity List and NDAA 889 had already closed the US to it — while Sungrow, which retains US market access, absorbed the shock, shedding roughly CNY 100B (≈$14.8B) of market value over the following month *(Huawei Digital Power dossier)*. Europe is a separate clock: Huawei and Sungrow inverters are being phased out of EU-funded projects by April 2027 on cybersecurity grounds *(Euronews, 2026-05-04 — Huawei Digital Power dossier)*.

**The observables**

- **Scope clarifications and enforcement guidance on the two-prong test** — specifically any ruling on wired management. That one interpretive question sets whether rack-level DC power is inside or outside.
- **Conditional-approval grants** between now and 1 January 2028. The first grant establishes what an acceptable onshoring plan looks like, and therefore how quickly the barrier can be bought out.
- **FEOC deadline and safe-harbour changes** in either direction. Extension or widening compresses the compliant lane's premium; tightening extends it.

### 10.7 Single points of failure in the supply chain

A single point of failure is a component with one dominant source, no qualified substitute, and no way to be designed out on the timescale of the schedule that depends on it. Constraints of this kind do not reduce demand; they convert demand into deferred revenue — which is worse than a slowdown for anyone holding a supplier's shares, because the cost is incurred and the revenue is not.

Three sit inside the rack, and they arrived with the architecture. Each GB300 cabinet uses roughly five BBU modules — battery backup units, the rack-level batteries that ride the system through a power interruption — plus more than 300 supercapacitors, the millisecond-response devices that absorb GPU load spikes; supercapacitor supply is a genuine bottleneck, and the AI-server BBU market is estimated at ≈$2.8B in 2026 rising to ≈$7.1B by 2033 *(TrendForce — NVIDIA dossier)*. On the cell side, Samsung SDI's ≈KRW 2T BBU chain runs via Simplo, with both Samsung SDI and Panasonic reported supply-short in BBU cells *(The Elec, 2026-07 — Samsung SDI dossier)*. **[Analysis]** (High) LITEON's 2025 BBU shipments ran roughly 30x the prior year against acknowledged capacity constraints, and BBUs turned from optional on GB200 to standard on GB300 and Rubin *(LITEON dossier)*. That last transition is what makes the shortage matter: a component that used to be optional cannot be value-engineered out of a rack that now requires it.

Concentration compounds it. Delta holds an estimated ≈70% of Blackwell-platform AI-server power supplies *(KGI, 2025-07-01 — Delta dossier)*, underpinned by a reported $2B Infineon silicon-carbide supply lock *(trade press, 2025-09-01 — Delta dossier)*; Panasonic claims roughly 80% of the data-center distributed-power market, self-reported and unverified *(Panasonic, 2026-03-25 — Panasonic dossier)*. High share is a strength in a growing market and a systemic risk in a constrained one — a stumble at a 70%-share supplier is a schedule event for the whole industry.

Outside the rack, the same logic runs on longer clocks: 30 to 40 month transformer waits at the world's largest maker *(Nikkei Asia, 2024-05 — Hitachi Energy dossier)* and ≈125-week HV/EHV breaker lead times throttling load-center schedules *(Quanta Q2 2026 release, 2026-07-30 — Quanta dossier)*. And counterparty failure is its own single point of failure: Powin's Chapter 11 vaporized 25+ GWh of EVE's contracted US demand *(ESS News, 2025-06-11 — EVE dossier)* — a reminder that in this market a contract is only as good as the integrator holding it.

**The observables**

- **Lead-time and allocation language** in ODM and cell-maker commentary. "Allocation" is the word that means shortage.
- **Second-source qualifications announced** for supercapacitors and BBU cells. A qualified second source is the event that ends a bottleneck; until then the constraint is real.
- **Working-capital strain at the ramping suppliers** — inventory build, cash-conversion-cycle extension, short-term borrowing. Suppliers finance a shortage before they report it.

### 10.8 Execution risk at named companies

The four cases below share one shape, and it is the most common way money is lost in a capacity boom: **demand is not the problem**. The order book is real, the addressable market is real, and the company still misses — because converting a contract into a shipped, commissioned, revenue-recognised system requires a factory, a certification, a workforce and a supply chain that all arrive on schedule. Execution risk is the gap between a signature and a shipment, and it is the risk least visible in a backlog number.

**Table 18: Execution risk where the dossiers document it — mechanism, observable, date**

| Company | The mechanism | The observable | When |
|---|---|---|---|
| **Fluence** | Q3 FY2026 revenue of $649.8M missed with ≈$400M delayed by production issues at new contract-manufacturing sites; FY2026 guidance cut to $2.9–3.1B — against record $1.44B order intake, a $6.4B backlog and a 45.6 GW / 163.7 GWh pipeline. **[Analysis]** (Moderate) Execution of the new manufacturing footprint, not demand, is the binding constraint *(Q3 FY2026, 2026-08-05 — Fluence dossier)* | Quarterly revenue against the rebased $2.9–3.1B; whether the new contract-manufacturing facilities reach production levels as targeted; the second domestic cell source | FY2027 quarters; second cell source ≈2027 |
| **Samsung SDI** | Two billion-dollar-class US ESS deals (KRW 1.5T prismatic; more than KRW 2T of LFP as SBB 2.0 from 2027) depend on US LFP cell production starting at StarPlus. **[Analysis]** (Moderate) The StarPlus conversion is the pivotal execution item, and profit quality is the near-term watch item — the Q2 2026 return to operating profit (KRW 203.8B, the first in seven quarters) included US tariff refunds *(Samsung SDI dossier)* | Whether StarPlus LFP output starts on time and at rate; margin composition ex-tariff-refunds and ex-credits; AI-data-center ESS shipments, which ran 1.6 GWh in H1 2026 *(CnEVPost, 2026-08-04 — Samsung SDI dossier)* | October 2026 |
| **Megmeet** | FY2025 revenue of ¥9.40B (+15%) with net profit of ¥146M (−67%), a loss-making Q4 and negative operating cash flow — the cost of the 800 VDC pivot landed before the revenue. By its own statements AI orders were immaterial through 2025. **[Analysis]** (High) Expectations are front-loaded relative to disclosure; the H1 report is the first hard test of whether AI-DC power revenue materialised at scale *(Megmeet dossier)* | H1 AI-data-center revenue disclosure and segment detail; operating cash flow; the HK A+H listing terms and dilution. The stock took three 10% limit-downs in four July sessions *(Megmeet dossier, 2026-07-20)* | 2026-08-27 |
| **Sinexcel** | The AIDC division (established June 2025) is developing HVDC systems and SSTs on the company's APF/SVG power-electronics heritage; shipping exposure is a 36 kW HVDC rectifier module, third-party-reported as supplied to Vertiv. **[Analysis]** (Moderate) Pre-revenue optionality as of early 2026 — treat AI-exposure claims as forward-looking until revenue is disclosed *(Sinexcel dossier)* | First AIDC revenue disclosure in the H1 report; whether the overseas storage export line (61.3% FY2025 gross margin) is still carrying group margin | 2026-08-11 |

Note what these four have in common with the wider risk stack. Fluence's miss and Samsung SDI's StarPlus dependency are both consequences of the compliance umbrella above (section 10.6) — onshoring to satisfy FEOC is precisely what created the new, unproven manufacturing footprint. The policy that generates the pricing power also generates the execution risk. You cannot own one without the other.

### 10.9 Timing triggers — the pipeline calendar

Everything above resolves into dates. The table below is the monitoring instrument: what happens, when, and — the column that matters — what the outcome would actually tell you. Near-dated earnings dates come from the repository's armed post-earnings refresh-Routine schedule, which is operational scheduling data rather than dossier content; the fired sessions verify actual publication.

**Table 19: Dated checkpoints, and what each one would confirm or refute**

| Date | Event | What it would tell you |
|---|---|---|
| 2026-08-11 | **Sinexcel H1** | First AIDC revenue disclosure — whether the pre-revenue challenger tier is converting the 800 VDC reset into revenue, or whether the optionality stays optional |
| 2026-08-11 | **CoreWeave Q2 2026** | The leveraged-neocloud test: contracted backlog against active megawatts, and whether third-party developer delay recurs |
| ≈2026-08-20 | **EVE results** | Whether cell pricing power held as the market tightened, against a US market closing from three directions |
| 2026-08-26 | **NVIDIA** *(company-confirmed)* | The demand engine's shipment cadence — the input under every third-party power-demand projection, and therefore under every supplier's order-book assumption |
| 2026-08-27 | **Megmeet H1** | The rebound test — whether AI-DC power revenue materialised after being called immaterial through 2025. A miss reads on the whole challenger tier, not one company |
| ≈2026-08-27 | **Jinko** *(estimate)* | Solar-plus-storage supply into AIDC, including the 800V HVDC-compatible line |
| 2026-08-29 | **Sungrow + BYD** | Whether the league-table reset holds — and, for Sungrow, the first full quarter carrying the FCC Covered-List shock |
| Aug 2026 – Jul 2027 | **xAI mobile-turbine removal** | Whether the permanent 1.2 GW plant energizes before the temporary fleet must leave under the Mississippi DEQ order — a dated, binary test of the behind-the-meter template |
| 2026 | **China battery tariff step** | Tariffs on Chinese battery imports stepping 7% → 26% — the compliant lane's price umbrella widening on schedule |
| Late 2026 | **Siemens Energy → "Omterra"** | Housekeeping that prevents embarrassment: vendor names, branding and possibly tickers change within months *(release, 2026-07-14 — Siemens Energy dossier)*. Nothing about the business changes; everything about the paperwork does |
| 2026-10 | **Samsung SDI StarPlus** | US LFP cell production start — **[Analysis]** (Moderate) the pivotal execution item in the compliant lane |
| 2H 2026 | **Tesla Megapack 3 deliveries** | Whether Brookshire's 50 GWh/yr line converts to customer volume |
| 3Q 2026 | **First 800 VDC shipments** | The vendor-list reset becomes measurable in revenue rather than slideware |
| April 2027 | **EU inverter phase-out** | Huawei and Sungrow out of EU-funded projects — the second jurisdiction to convert cybersecurity concern into procurement law |
| 2027 | **Kyber racks** | The qualification window closes; rack storage becomes mandatory content and the BBU/supercapacitor bottleneck is tested at volume |
| 2027 | **GE Vernova 1,000-SST decision** | Whether the grid tier leapfrogs the AC-switchboard incumbents or the SST market forms around challengers |
| Oct 2027 | **CATL full Pentagon bar** | The 1260H procurement exclusion completing — and how far licensing structures have absorbed it by then |
| 2027–28 | **Transformer and prefab capacity wave** | The scarcity-rent test: on-time factories end the premium, slipped factories extend it |
| To 2028-01-01 | **FCC conditional-approval window** | Whether the first grants establish a purchasable path back into the US market, and on what onshoring terms |
| Undated | **PJM co-location rulemaking** | Constellation management expects data-center deal flow to "kick off with a bit of a bang" once it lands — the starting gun for the next PPA wave and its firming and storage attach |
| Undated | **Louisiana LPSC ruling** | The ratepayer-allocation template for every multi-gigawatt campus — and whether firming demand is pushed from long-lived gas toward shorter-lived storage |

### What this means for your capital

This chapter is the report's counterweight, so hold it against the earlier chapters rather than instead of them. The buildout is real, funded, and power-constrained. The question is not whether it happens; it is which claims on it are durable and which are merely dated.

**Two things would most change the investment case, and they run in opposite directions.**

**First, upward: the FCC and FEOC perimeter holding while the compliant lane's factories come good.** If the origin test survives interpretation intact and the conditional-approval path proves slow, the non-Chinese storage and power-electronics chain owns the US market at administered prices for several years. That case does not rest on demand at all. It rests on Fluence's new plants reaching rate, StarPlus starting on time in October 2026, and second-source BBU and supercapacitor capacity arriving before Kyber volumes in 2027. The umbrella is worth nothing to a supplier that cannot ship under it — which is why the execution table and the policy section above are the same trade seen twice.

**Second, downward: scarcity-rent normalisation arriving on schedule while a demand pause tests the far end of the backlog.** The 2027–28 capacity wave is announced, dated and largely funded. If those factories start on time and utility ordering behaviour normalises, the 10-to-20-point slot premiums and the +60–80% transformer inflation compress — and they compress at exactly the moment the four fifths of the 307 GW pipeline sitting beyond 2028 has to be reconfirmed. The two events are independent, but they rhyme, and a position priced off 2026 scarcity economics would feel both at once. What stays defensible inside that is narrow and specific: transformers, where the deficit is modelled to persist into the 2030s, and craft labor, which no factory expansion relieves.

A third possibility deserves naming because it is the one most likely to be mispriced as pure downside. **Political and ratepayer backlash does not reduce the load; it reallocates who pays and changes what gets built.** A regulator refusing 30-year gas plants against 15-year customer contracts pushes the firming requirement toward faster-permitting, shorter-lived assets — which is storage, and on-site generation the customer funds itself. Oracle's no-pass-through commitment, Equinix's 100%-funded grid upgrades and Google's 1 GW of demand response are all pre-emptive concessions that raise the campus bill of materials. Backlash is a mix shift before it is a demand cut.

#### What would change this view

- **Sequential order intake turning negative** at two or more of GE Vernova, ABB, Vertiv, Schneider or Hitachi Energy in the same quarter. One supplier is company-specific; two in one quarter is the sector. This falsifies the "demand is durable, only duration is soft" reading.
- **A scope ruling that wired management satisfies the FCC's connectivity prong.** That single interpretation would extend the perimeter deep into rack power and invert the exposure map for the ODM tier.
- **An early, generous conditional approval** under the FCC process. It would show the barrier is purchasable, and the compliant lane's premium would begin discounting immediately — well before any product actually returned.
- **On-time startups of the 2027–28 transformer plants.** Commissioning as announced ends the scarcity-rent thesis for the grid-equipment tier on a knowable date.
- **A second single-counterparty delay of the CoreWeave type** at a different developer. One is idiosyncratic; two is a pattern in how leased, third-party-developed capacity actually delivers.

#### The one indicator to watch first

**Sequential order intake at the electrification suppliers** — GE Vernova's data-center Electrification line above all, which ran ≈$0.7B in 2024, more than $2B in 2025 and more than $5B in the first half of 2026 alone *(Q2 2026 press release, 2026-07-22 — GE Vernova dossier)*. It is the one number that sits downstream of demand quality, upstream of scarcity pricing, and inside an audited disclosure on a fixed quarterly calendar. Every risk in this chapter eventually passes through it: a funding pause, a permitting freeze, a ratepayer revolt and a capacity-driven price reset all show up as orders that do not arrive. It will not tell you why. It will tell you, earlier than anything else, that something has.

## 11. Method, Sourcing, and What Changed

A research product is only as good as its provenance. This chapter states exactly where every fact came from, what in this edition is new, how it was produced, and what changed from the previous edition — including one thing the previous edition got wrong.

### 11.1 The corpus

The company evidence base is the **40 Profiler dossiers** in `live-site-pages/profiler-data/` — one structured dossier per company under coverage, with the roster in `profiler-companies.json` and field semantics defined in `PROFILER-SCHEMA.md`. Each dossier was researched between 7 and 10 August 2026 under a two-stage source protocol: first-party investor-relations and press material exhausted first, then third-party filings, trade press and consultancy rankings used to fill gaps and to supply what a company cannot credibly say about itself — analyst expectations, independent rankings, and critical context such as litigation and misses.

### 11.2 What is new research in this edition, and what is not

> **An honest distinction the previous edition did not need to draw.** The previous edition carried a blanket claim of *no new research*. That is no longer accurate and this edition does not repeat it. **Company facts** — every number, date, order, product, share and ranking — remain drawn entirely from the dossier corpus, with no new company research performed. **Policy and regulation** is different: the FEOC material-assistance rules, the tariff stack, and the FCC Covered List action were **re-verified against current sources on 15–16 August 2026**, because the corpus was demonstrably stale on all three. Those passages are new research and are marked as such here rather than presented as dossier-sourced.

The third category is **explanation**, which is most of what is new in this edition by volume. Physics, economics, the mechanics of how a lead time becomes a price, what a tax-credit ratio does to a bid, what an interconnection queue is — none of that is a claim about a company, so none of it carries a citation. It is teaching, and it is the thing the previous edition was missing.

### 11.3 How this edition was produced

- **Thirteen parallel drafting passes**, one per chapter, each working from the previous edition plus direct reads of the dossiers relevant to that chapter, and each held to the same writing contract: teach first, quantify second, interpret always, and close with the capital implication and the falsifier.
- **One adversarial critique pass** over the assembled drafts, mandated to hunt for six specific failure modes: invented facts not present in the corpus, any surviving stale framing of the FCC action, inference presented as sourced fact or a dropped confidence tag, coverage gaps against the 40-company roster, language that reads as a recommendation to buy or sell rather than analysis, and violations of the document's own markup vocabulary.
- Findings from that pass were resolved before publication.

### 11.4 Citations, labels and their rules

- **Citation format** — *(Source label, date — Company dossier)*. The label matches the dossier's own source entry, whose URL field holds the link. Dates are source publication dates; year-month where only the month is known, and absent for undated evergreen pages.
- **[Analysis] items** are labeled inference, carrying the dossier's own (High)/(Moderate)/(Low) confidence tag where it holds one. They are never blended with sourced fact. Where this edition's desk view goes beyond the dossier's, it says so in place.
- **Confidence tags mean what they say.** (High) means the mechanism is documented and the evidence is first-party or corroborated. (Moderate) means the direction is well supported but the magnitude, timing or attribution is not. Treat a (Moderate) judgment as a hypothesis with evidence, not a conclusion.
- **Field notes are not sources.** The notes log lives in Drive behind an access-control list; none were supplied to this edition and none are cited.

### 11.5 The two caveats that matter most

- **Rankings are scope-dependent.** Wood Mackenzie's comprehensive integrator ranking, Benchmark's system shipments, InfoLink's cell shipments and SNE's cuts measure different things and produce different orders. This report names the ranking body on every ranking claim. Any reader restating a ranking should do the same, because "number one" without the scope attached is not a fact.
- **Precision decays fastest in policy.** The tariff stack moved twice in eight months and the FCC action landed between the two editions of this report. Treat any specific total percentage, including the ones here, as correct at the stated date and verifiable rather than durable.

### 11.6 What changed from the previous edition

| Change | Why |
|---|---|
| **Reframed for an investor, not a seller** | The previous edition was a sales-strategy document that assumed sector fluency. Every chapter now opens by teaching its subject and closes with the capital implication |
| **New chapter 2, a primer** | Nothing in the previous edition taught the electrical chain, the timescales storage serves, or the vocabulary. Without that, later chapters were unreadable to a non-specialist |
| **Key judgments expanded** | Twelve one-sentence assertions became twelve reasoned subsections, each with its mechanism, its consequence and its falsifier |
| **Policy consolidated into chapter 8** | Regulation was previously scattered across three chapters. An investor needs the rules that decide who can sell in one place, taught rather than listed |
| **Coverage moved to its own companion** | The per-company treatment of all 40 names — the environment each is in, a recommended commercial strategy with its reasoning, and the observable that would change the view — now lives in the **AIDC Coverage Universe**, a separate document. It was a third of this report by length while being reference rather than argument, and it moves on a faster clock: company facts change on earnings, the argument here does not |
| **The FCC action corrected** | The previous edition described it as a pending, draft, China-specific rule. It took effect 28 July 2026 and is an origin test, not a nationality test. See chapter 8 |
| **Layout** | Contents moved to its own page as a single-column index; every chapter now opens a fresh page |

### 11.7 Freshness

Company figures are as published through approximately 10 August 2026; policy is current to 16 August 2026. The dossiers underneath are refreshed by armed post-earnings routines across 27 listed tickers plus a quarterly sweep of the private names — so the right way to use this report is to regenerate the affected chapters after a material dossier refresh rather than to trust it indefinitely. Near-dated checkpoints are tabulated in chapter 10.

> **Standing disclaimer.** This document is analysis prepared for internal education. It explains commercial position and strategy for companies under coverage. **It is not investment advice, and nothing in it — including the "what this means for your capital" passages — is a recommendation to buy or sell any security.**

Developed by: LightAISolutions
