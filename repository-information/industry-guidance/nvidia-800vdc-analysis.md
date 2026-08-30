# NVIDIA 800 VDC White Paper (Aug 2026) — Analysis & Study Guide

**Source:** *800 VDC Architecture: Industry Alignment & Execution* — NVIDIA white paper, Jared Huntington & Mike Tu, 36 pp., dated 2026-08 (PDF created 2026-08-21). Committed at [`sources/nvidia-800vdc-white-paper-2026-08.pdf`](sources/nvidia-800vdc-white-paper-2026-08.pdf).
**Handling:** NVIDIA's notice (p36) permits reproduction only with prior written approval — everything below is original analysis in our own words; quantitative claims carry page references. This analysis feeds the admin-gated Industry Guidance module in the Profiler app and is not deployed to Pages.
**Prepared:** 2026-08-22 · This file is the source of truth; the in-app module (`Profiler.gs` guidance content) is derived from it.

## 1. What this document is

The second paper in NVIDIA's 800 VDC series. The first (October 2025, published around OCP) argued *feasibility* — why 800 VDC beats 415/480 VAC as racks head past 200 kW. This one declares that argument settled and pivots to **execution**: converged deployment architectures, engineering design rules (grounding, protection, fault control), a certification strategy with UL Solutions, and a 12-month industry work plan. The authors frame the next phase plainly: "The work ahead is no longer about proving the feasibility of 800 VDC. It is about executing together" (p35).

Three structural signals make it the industry's steering document for the next year:

- **CSP alignment is explicit** — a joint Google / Microsoft / NVIDIA position from GTC Taipei 2026 (p6, Fig 2) covering converging on 800 VDC, phased AC/DC coexistence, common power-block sizing and redundancy philosophy, open OEM development, power-smoothing requirements, and OCP-hosted standards work.
- **The equipment scope is bounded** — a deliberate "limited set of deployable configurations" so OEMs stop spreading engineering across incompatible designs (p4, p30).
- **Coexistence is doctrine, not apology** — 800 VDC "is not intended to replace existing 415/480 VAC systems, but rather to complement and coexist" (p4). Every architecture option is framed as an overlay on existing AC facilities. The DSX reference design gains 800 VDC options rather than being replaced (p4, p8).

## 2. The executive read (my synthesis)

1. **The rack roadmap forces the issue.** NVLink wants more GPUs within copper reach, so rack power climbs: Gen 1 (GB200/GB300) 145 kW → Gen 2 (Vera Rubin NVL72) 330 kW → Gen 3 570 kW with 800 VDC into the PSUs → Gen 4 native 800 VDC toward megawatt-class (p7, Fig 3, timeline axis 2024–2032). 54 VDC distribution physically runs out of road; 800 VDC is "the highest voltage level that can be broadly adopted at the rack" (p7).
2. **Four architectures, not a ladder.** Existing AC baseline; Option A rack-level Power Rack (~660 kW, production Q3 2026); Option B cluster-level Power Center (~1.6 MW units, 4-to-make-3 → 4.8 MW clusters, deployment as soon as Q3 2027); Option C data-hall DC Power Block (~4.8 MW TRU/SST blocks now, ~10 MW MV-direct later). The paper stresses these are "not sequential requirements, but flexible deployment options" (p8) — pick by facility, timeline, density.
3. **The MV-to-DC slot is officially TRU-or-SST** — and the paper leans TRU for now: mature, strong fault isolation, 34.5 kV-compatible, "highly practical for approximately 5 MW-class" blocks (p21–22). SST is the future path, gated on voltage class (~15 kV today vs 34.5 kV hyperscale MV) with next-gen SST "expected to be launched toward 2029" (p22–23).
4. **Protection engineering is the new frontier.** The genuinely new technical content is Table 1 (AC vs DC fault behavior), four grounding schemes under evaluation (HRMG favored on balance), a two-zone protection philosophy, EV-derived interlocked 125 A DC whips, source fault-current limiting, and SSCBs at two target ratings (125 A air-cooled, 1250 A liquid-cooled) with MCCBs as the pragmatic Day-1 device (p22–29).
5. **What's *absent* matters.** No efficiency percentages, no copper-savings claims, no TCO numbers — the sales math of the first paper is gone, and a "Business Value and Reliability Assessment" is explicitly future work (p34). This is an engineering-execution document; treat any efficiency claim you hear as coming from the *first* paper or from vendors, not this one.

## 3. What you already know vs. what's new here

| You already have (Zhonhen curriculum) | This paper adds |
|---|---|
| Why DC beats AC at density (I²R, stage deletion, 7–8 vs 5 vs 3 stages) | The productized *deployment* forms those arguments take (A/B/C) with real ratings and dates |
| TRU vs SST device classes (line-frequency iron vs kHz SiC) | NVIDIA's own official framing: both fill the MV-to-DC slot; TRU practical at ~5 MW-class; SST next-gen ~2029; **"Panama Architecture" named as a TRU approach** (p22) |
| NVIDIA ladder: racks 2H'26 → row 2027 → MV blocks 2029 | Sharper: Power Rack production Q3 2026; Option B deployment as soon as Q3 2027; TRU-based Option C blocks in *initial implementation now*, containerized; only next-gen SST carries the 2029 date |
| ERCOT ride-through / flicker story | NVIDIA's rack-side answer: power smoothing with "minimal energy storage" (electrolytic caps) in/near racks to present a "stable and predictable rack workload power characteristic" to the grid (p4) — plus optional facility/BTM storage |
| DC arc danger (no zero crossing) | The full protection stack: grounding schemes, zones, RCM/IMD, interlock sequence, SSCB ratings, arc-flash I-and-t strategy |

## 4. The rack power roadmap (Gen 1 → Gen 4)

The paper's Figure 3 ("800 VDC Imperative", p7, timeline ≈2024–2032, with 72-GPU and 144-GPU trendlines) is the generational map you asked to see. Verified data:

| Gen | Platform | Rack power | Distribution | Distinguishing detail |
|---|---|---|---|---|
| **Gen 1** | GB200 / GB300 | **145 kW** | 54 VDC in-rack | 60 A power whips, 8-to-make-6 feed redundancy (p7) |
| **Gen 2** | Vera Rubin NVL72 | **330 kW** | 54 VDC in-rack | Both **AC input and DC input** options — the hinge generation (p7) |
| **Gen 3** | (next platform) | **570 kW** | 54 VDC in-rack, **800 VDC into the PSUs** | 100% liquid-cooled power shelves (p7) |
| **Gen 4** | (planned) | **~1 MW-class** | **native 800 VDC in-rack** | Facility power taken directly, down-converted at point of load (p7); Fig 3 band at ~1,000 kVA |

Why the voltage must rise (the physics you already own, restated in the paper's terms): NVLink's copper reach forces GPUs into a small area; density rises faster than 54 VDC current-carrying practicality; 800 VDC "significantly reduces current and shrinks the power distribution footprint" and aligns rack- with hall-level architecture, "minimizing power conversion stages" (p7).

**Study anchor:** memorize 145 → 330 → 570 → ~1,000. The in-app timeline widget plots these with the deployment milestones below.

## 5. The four deployment architectures

The paper's core claim (p8): these are "not sequential requirements, but flexible deployment options." All four coexist in the DSX reference design; the 800 VDC scope is deliberately confined to the GPU-compute slice of the electrical plan (Fig 5's red circle) so upstream facility design survives.

### Existing — AC baseline (p9–10)
480 VAC to the rack · 100 A AC whips · 4-to-make-3 rack feed redundancy · conversion to LVDC inside the rack. Default and fully supported; the coexistence anchor.

### Option A — Power Rack, rack-level (p10–14) · **production Q3 2026**
A 19-inch **Power Rack** beside compute racks: 12× 100 A AC whips in (IEC 60309, true 3-phase 415–480 VAC, no neutral) → air-cooled shelves of **6× 18.3 kW PSUs** (1,200 J each for input-current shaping) → **~660 kW** of 800 VDC out over **125 A interlocked DC whips** (point-to-point, no busbar). Optional BBU shelves: **4× 20 kW = 80 kW for 60 s**, N+1. Compute racks take 800 VDC into an **800→54 V shelf (6× 15 kW PSUs)** — any MGX-form-factor rack becomes 800 VDC-capable. 2:1 compute-to-power-rack ratio possible. Certified under **UL 62368-1** now, UL + IEC regions. Next-gen: 100% liquid-cooled, **55 kW/RU** shelves.
*Advantages:* fastest path; zero upstream facility change; BBU/N+N support; certifiable today. *Disadvantages:* row footprint; 12–24 AC whips per Power Rack to manage; AC capacity validation; density ceiling — explicitly a bridge.

### Option B — Power Center, cluster-level (p14–17) · **deployment as soon as Q3 2027**
End-of-row **DC Power Centers** (adjustable up to **2 MW**; deployed ≈**1.6 MW in 4-to-make-3** → **4.8 MW effective cluster**) rectify AC→800 VDC centrally; distribution via overhead **800 VDC busway**, **1250 A** aggregated feeders, **125 A tap cans** (MCCB or SSCB; MCCB clearing up to ~**20 ms** at the 125 A branch). Rectifier families: aggregated SiC power-shelf modules (Power Rack lineage) or monolithic IGBT rectifiers derived from UPS platforms. Interlocked whip/connector system carried over. Retrofit "without modification to upstream AC electrical rooms"; mixed AC and DC compute in one hall.
*Advantages:* eliminates side Power Racks (white space back); selective row-by-row adoption; mature rectifier tech; controlled 800 VDC exposure zones. *Disadvantages:* new busway/tap-can/breaker certification chain; grounding + protection coordination now facility-grade; needs the OEM ecosystem to deliver (multiple OEMs actively developing, p17).

### Option C — DC Power Block, data-hall level (p17–23)
**~4.8 MW power blocks** (drawn as 5 MVA/4.8 MW) at the hall edge: MV AC in → step-down transformer → LV rectification → central **DC switchboard (6000 A-class)** → parallel **1250 A busways** → same tap-can interface as B. Block-redundant with a **4+1 catcher** via **DC Static Transfer Switch** — DC needs no phase synchronization, so source transfer is simpler than AC. Scales as **20 MW Deployment Units (4 Scalable Units)** replicated toward gigawatt campuses; supports future **~1 MW native racks** and **8 MW clusters at 1+1** without upstream change. Targeted as **modularized outdoor containerized packages**: prefabrication, factory testing, reduced commissioning, smaller indoor electrical rooms. Future flexibility: DC UPS with battery integration, BESS, renewables, DC microgrid.
*Advantages:* fewest conversion stages; modular/prefab delivery; catcher redundancy economics; the long-term architecture. *Disadvantages:* biggest certification and AHJ lift; TRU/SST supply chain still forming; whole-hall commitment rather than incremental.

### Option C next-gen — MV direct conversion (p23)
The end state: eliminate intermediate LV stages, convert **34.5 kV AC directly to 800 VDC**, blocks scaling toward **~10 MW**. Named enabler: mature SSTs; **next-generation SST expected toward 2029**. Explicitly "a future roadmap direction... beyond the deployment horizons of current 800 VDC architectures."

## 6. TRU vs SST — and the Panama name-check

The paper's own device-class framing (p21–23) matches the correction we landed in your lesson plan exactly:

- **TRU** — line-frequency transformer + centralized rectification. Benefits: mature transformer technology, **strong fault isolation**, deployment familiarity, **34.5 kV compatibility**. "Highly practical for approximately 5 MW-class power block deployment." Three implementation families are named: (1) IGBT UPS-derived conversion re-staged for 800 VDC output; (2) aggregated rack-level SiC power shelves behind front-end transformers; (3) **the "Panama Architecture" — a line-frequency phase-shifting transformer at the MV entry with multiple phase-shifted AC outputs feeding centralized rectification**, relying "more heavily on passive magnetic components, offering a simpler and highly familiar design philosophy" (p22).
- **SST** — high-frequency switching + high-frequency isolation. Potential: higher power density, better dynamic response, controllability, smaller footprint, functional integration. Today's platforms are "**approximately 15 kV-class**" while hyperscale MV is **34.5 kV** — insulation coordination, protection, thermal and interconnection work remain; next-gen **toward 2029**.

**What this means (analysis, not the paper's words):** NVIDIA has formally blessed the TRU path — and named Panama as one of its three canonical implementations — for the exact power-block slot the industry will deploy first. The SST future is real but dated 2029 and voltage-gated. "Mature magnetics, shipping today" is now not just your line; it is the reference document's.

## 7. Engineering design updates — the genuinely new material

This is the section to study hardest: it is the vocabulary of every engineering conversation about 800 VDC for the next two years, and most of it was not in your curriculum.

### 7.1 AC vs DC fault behavior (Table 1, p24 — row labels verified)

| Topic | AC behavior | DC behavior | Key consideration |
|---|---|---|---|
| Fault current | Natural zero-crossings every cycle | **Continuous current, no zero-crossing** | DC needs faster interruption, current limiting, arc-fault detection |
| Fault energy | Higher contribution from utility and rotating machines | **Often lower in converter-limited systems** | Depends on source type and control architecture |
| Shock hazard | Can cause muscle lock-on | Often a single muscle contraction | Strict personnel protection either way |
| Protection devices | Mechanical breakers | **SSCBs and hybrid breakers → ultra-fast clearing** | Faster clearing = less fault energy |
| Ground fault detection | Overcurrent + ground-fault relays | **IMD and/or RCM commonly required** | Depends on grounding architecture |
| Series arcing | Periodically weakened; easier to self-extinguish | **Can sustain; harder to extinguish** | Connector design + arc detection critical |
| Parallel arcing / arc flash | High fault current → significant arc-flash energy | Converter-limited systems may reduce incident energy | Current limiting + rapid isolation |

The counter-intuitive teaching point: DC's weakness (no zero crossing) is paired with a structural strength — **converter-fed systems can limit fault current at the source**, something a stiff AC utility feed cannot do. The paper builds its whole arc-flash strategy on that: reduce available current (I) via current-limited rectifiers/DC-DCs/batteries, reduce clearing time (t) via SSCBs (p32).

### 7.2 Grounding — four schemes under evaluation (p24–26)
800 VDC distribution is **two-wire (positive + return)**. The candidates:

| Scheme | Mechanism | Strengths | Weaknesses |
|---|---|---|---|
| **HRMG** (high-resistance midpoint) | Midpoint resistor network grounds both conductors symmetrically | Balanced conductor-to-ground voltages, better EMC, **uniform fault detection on both conductors**, earlier identification, keeps operating after first fault | More components; resistor sizing discipline |
| **HRRG** (high-resistance return) | Return conductor grounded through resistance | Same current-limiting benefit; simpler | **Delayed detection of return-conductor faults** |
| **Floating** | No intentional ground | Near-zero first-fault current; ride through one fault | Leakage/capacitance still bite; **detection and location are hard** — needs IMD + locator systems |
| **Solid** | Return bonded to ground | Simplest; **fast, sensitive detection**; may suit future native racks | **Highest fault current** — needs fast devices + minimal ground-bond impedance |

The paper's lean (read between lines of p25): HRMG "provides a more uniform fault monitoring, earlier fault identification, and improved system reliability while maintaining low ground-fault current levels." Final choice deferred to system-level studies.

### 7.3 Protection zones (p26–27)
- **Facility Distribution Zone** (TRU/SST output → tap-can input): qualified-personnel territory. Continuous **IMD/IRM** insulation monitoring; degradation → alarm without shutdown (service continuity); high overcurrent → protective relays coordinate **fast source shutdown through the rectifiers**.
- **Rack Interface Zone** (tap can → compute rack): highest human interaction. **RCM** preferred for fast leakage/ground-fault detection. The **125 A DC whip stays de-energized during install/removal**: hardwired to the tap can behind a normally-open contactor; the rack-side connector's mechanical lock must engage before an enable signal closes the contactor; release opens the contactor **before** unlocking. EV-charging lineage, explicitly (p16).

### 7.4 SSCBs and the near-term reality (p27–29)
SSCBs interrupt electronically **before fault current peaks** — sub-millisecond isolation vs several milliseconds for conventional devices — slashing let-through energy (I²t), equipment damage and arc-flash risk. Two NVIDIA target ratings: **125 A air-cooled** (for 800→54 V shelves in compute racks) and **1250 A, likely liquid-cooled** (future native-800 VDC rack interfaces); the practical ceiling of air-cooled SSCB current is under evaluation. The sober counterweight: **MCCBs remain the primary Day-1 branch device** (availability, supply chain, certification familiarity; ~20 ms clearing at 125 A branches). Figure 15 (Siemens data, 200 A/µs rise): fuse peaks ≈9.4 kA near 3 ms; thermal-mag ≈5.7 kA clearing ~6–7 ms; hybrid ≈5.7 kA clearing ~2.5 ms; SSCB holds current near zero within ~1 ms. (Chart values read from an image — treat as approximate shape, not datasheet numbers.)

### 7.5 Power smoothing moves rack-side (p4)
AI training's synchronized swings are to be tamed **at the compute rack**: "localized peak shaving, power smoothing, and slew rate control using minimal energy storage (e.g., electrolytic capacitors) deployed within or near the compute racks," presenting the grid a stable rack interface; facility/BTM storage is a *may*, for interconnection needs. The 1,200 J per PSU (p12) is this philosophy in hardware.

## 8. Certification & regulatory execution (p30–33)
- **System-level requirements first** — "equipment certification alone is insufficient" (p31). Eight workstreams: power quality, voltage regulation/transient limits, power smoothing expectations, grounding methodologies, protection coordination, fault-current management, rack interface requirements, end-to-end stability criteria.
- **Simulation before hardware**: frequency-domain stability analysis, source output impedance / module sharing, distribution inductance restrictions, ripple/fluctuation limits — to set multi-OEM interoperability limits.
- **Working with UL Solutions + OEMs + operators**; leverage existing frameworks (UL 62368-1 already covers the Power Rack) instead of writing new standards from scratch; UL/NFPA/IEEE/IEC engagement on DC grounding, arc-flash methodology, certification pathways, busway/connector/breaker qualification, installation safety.
- **AHJ enablement** — installation best practices, inspection guidelines, commissioning procedures, training so local inspectors can approve these builds. (Your ERCOT/FERC knowledge slots beside this: NVIDIA is working the *equipment* codes while the grid codes you know govern the *load behavior*.)
- Future work, explicitly: FAT/SAT operational procedures and a **business value / TCO study** (p34) — the economics are promised, not delivered, in this paper.

## 9. What this means for the Zhonhen conversation (analysis)

1. **The quote is verified, in hand.** Page 22 names the "Panama Architecture" as a TRU implementation with the exact phrase — *"a simpler and highly familiar design philosophy."* Your strategy report's flag ("publicly unverifiable, keep it inside Zhonhen conversations until the document is in hand") is now resolved: the document is in the repo. Still cite it as "NVIDIA's August 2026 white paper" and paraphrase in customer settings — NVIDIA's notice bars verbatim reproduction, and the paper names an *architecture*, not the company Zhonhen.
2. **The window thesis holds but tightens.** The 2029 date attaches specifically to **next-gen SST** and MV-direct conversion. TRU-based ~4.8 MW power blocks (Option C initial implementation) are being specified *now*, containerized, with OEMs converging on them — and Option B hits deployment as soon as **Q3 2027**. The claim "no Western vendor ships the MV-to-DC block until 2029" is not what this paper supports; the defensible claim is: *the industry's own reference document says the near-term block is a TRU — the device class Zhonhen has productized since 2019 — while the SST future arrives ~2029.* Zhonhen's edge is a shipping fleet and prefab maturity, not an empty Western calendar. Expect Vertiv/Eaton/Delta-class TRU blocks to compete sooner than the old framing implied.
3. **4.8 MW is the standardized block.** NVIDIA's building block (4.8 MW, 4+1 catcher, 20 MW DUs) vs Zhonhen's Panama 2.5 MW modules and SuperX 3.6 MW systems — the pitch needs an answer for "how do you compose to 4.8 MW blocks and 1250 A busways with our tap cans?" Paralleling story, busway interface compatibility, and catcher-STS participation are now concrete technical questions to prepare.
4. **Prefab containers are no longer a differentiator by themselves.** Option C is *defined* as modularized outdoor containerized packages with factory testing. Zhonhen's edge shifts to *delivered fleet history* at these voltages and *speed* — the "shipping the 2027 slot today" argument — not the container concept.
5. **Power smoothing lands rack-side in NVIDIA's philosophy.** The paper puts smoothing at the rack with minimal storage, grid/BTM storage optional. Zhonhen's four-depth storage story remains differentiated for *grid-code compliance* (ERCOT ride-through/flicker) and off-grid generator protection — sell it against the grid codes you know, not against NVIDIA's rack-interface spec.
6. **Vocabulary upgrade for engineer conversations:** HRMG/HRRG grounding, IMD/RCM monitoring, protection zones, interlocked 125 A whips, SSCB ratings, 4+1 catcher STS, 6000 A switchboards, 1250 A busways, tap cans. Fluency here is what "knows the space" sounds like in Q3 2026.

## 10. Claims ledger (verified, page-referenced)

| # | Claim | Page |
|---|---|---|
| 1 | Gen 1 (GB200/GB300): 145 kW, 54 VDC, 60 A whips, 8-to-make-6 | p7 |
| 2 | Gen 2 (Vera Rubin NVL72): 330 kW, AC and DC input options | p7 |
| 3 | Gen 3: 570 kW, 100% liquid-cooled shelves, 800 VDC into PSUs | p7 |
| 4 | Gen 4: native 800 VDC in-rack, ~1 MW-class (Fig 3 band ~1,000 kVA), roadmap axis 2024–2032 | p7 |
| 5 | Existing baseline: 480 VAC, 100 A whips, 4-to-make-3 | p9 |
| 6 | Option A Power Rack: ~660 kW, production Q3 2026 | p10–11 |
| 7 | Power Rack input: 12× 100 A whips, IEC 60309, 415–480 VAC 3-phase no neutral | p12 |
| 8 | Power Rack shelves: 6× 18.3 kW PSUs, air-cooled, 1,200 J each | p12 |
| 9 | BBU option: 4× 20 kW = 80 kW for 60 s, N+1; 125 A 800 VDC cross cables | p12–13 |
| 10 | Compute-rack DC shelf: 800→54 V, 6× 15 kW PSUs (MGX form factor); ~90 kW 1RU shelf | p13–14 |
| 11 | Power Rack certified under UL 62368-1, UL + IEC regions | p14 |
| 12 | Next-gen Power Rack: 100% liquid-cooled, 55 kW/RU shelves | p14 |
| 13 | Option B Power Center: adjustable to 2 MW; ≈1.6 MW × 4-to-make-3 = 4.8 MW cluster | p15, p19 |
| 14 | Option B distribution: 1250 A feeders, overhead busway, 125 A tap cans (MCCB/SSCB) | p15 |
| 15 | MCCB clearing at 125 A branch: up to ~20 ms | p16 |
| 16 | Option B deployment as soon as Q3 2027; multiple OEMs developing | p17 |
| 17 | Option C: ~4.8 MW blocks (5 MVA/4.8 MW), 6000 A-class switchboard, parallel 1250 A busways | p18–21 |
| 18 | Option C redundancy: 4+1 catcher via DC STS (no phase-sync needed on DC) | p19 |
| 19 | 20 MW Deployment Unit = 4 Scalable Units; supports ~1 MW native racks, 8 MW clusters 1+1 | p20 |
| 20 | Option C delivery: modularized outdoor containerized packages, factory-tested | p18 |
| 21 | TRU: mature, strong fault isolation, 34.5 kV-compatible, practical at ~5 MW-class | p21–22 |
| 22 | TRU approaches: IGBT UPS-derived; aggregated SiC shelves; "Panama Architecture" (phase-shifting line-frequency transformer, passive magnetics, "simpler and highly familiar") | p22 |
| 23 | SST: ~15 kV-class today; 34.5 kV needs development; next-gen SST toward 2029 | p22–23 |
| 24 | MV direct conversion: 34.5 kV AC → 800 VDC, ~10 MW blocks, future roadmap | p23 |
| 25 | 800 VDC is two-wire (positive + return); grounding candidates HRMG/HRRG/floating/solid | p24–25 |
| 26 | Two protection zones: facility (IMD/IRM) and rack interface (RCM); whip de-energized until locked | p26–27 |
| 27 | SSCB targets: 125 A air-cooled (in-rack shelves) and 1250 A liquid-cooled (native racks); MCCB primary Day-1 | p28–29 |
| 28 | Fig 15 (Siemens): at 200 A/µs — fuse ≈9.4 kA peak; thermal-mag ≈5.7 kA, ~6–7 ms; hybrid ~2.5 ms; SSCB sub-ms near-zero *(read from image; approximate)* | p29–30 |
| 29 | Google/Microsoft/NVIDIA joint alignment, GTC Taipei 2026; OCP is the standards forum | p5–6 |
| 30 | Power smoothing at rack with minimal storage (electrolytic caps); facility/BTM storage optional | p4 |
| 31 | Certification: system-level requirements first; UL Solutions collaboration; AHJ enablement | p30–33 |
| 32 | Future work: FAT/SAT practices; business-value/TCO study still to come | p34 |
| 33 | Coexistence doctrine: 800 VDC complements, does not replace, 415/480 VAC | p4, p35 |
| 34 | Next 12 months: equipment development, system validation, pilot deployments, standards/regulatory | p4 |

## 11. What the paper does NOT say (guardrails)
- **No efficiency percentages, no copper-savings figures, no TCO numbers** — those live in the October 2025 paper and vendor decks. Do not attribute them to this document.
- **No vendor names for power equipment** (beyond the Siemens chart credit and UL Solutions) — Panama is named as an *architecture*, not as any company. It does not put anyone on a "roster."
- **No efficiency comparison between TRU and SST** — only qualitative attributes.
- **No retirement of AC** — coexistence "for the foreseeable future" (p35).

Developed by: LightAISolutions
