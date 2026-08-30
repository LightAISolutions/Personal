# Sungrow — Technology Lesson Plan

**Purpose:** teach what Sungrow's products actually *do* in the grand scheme of their industries, starting from high-school STEM. No company trivia — this is about the technology. Generated 2026-08-08 from the Profiler dossier (profileVersion 2). Companion: the in-app guide (Profiler → Sungrow → Study guide 📖) has the condensed version + concept flashcards.

**Suggested pacing:** Module 1 in one sitting (~25 min), Module 2 the next (~30 min), Module 3 across two days (~45 min — this is the core), Modules 4–5 in one sitting (~35 min), then flashcard passes in the app.

## Module 1 — The physics you already know, applied

Three high-school ideas carry almost everything:

1. **P = V × I** (power = voltage × current). To move 1 MW you can use high voltage & low current, or low voltage & huge current.
2. **Wires waste power as heat: P_loss = I²R.** Losses grow with the *square* of current. Double the voltage → half the current → **one quarter** the wiring loss, plus thinner, cheaper copper. This is why solar plants standardized on 1,500 V DC strings, and why the newest inverters push the AC side from 800 V to 1,000 V.
3. **Energy is conserved — inefficiency is heat.** A 99%-efficient inverter turns 1% of everything passing through it into heat you must remove. At a 500 MW plant, 1% is 5 MW of heat — a small power station's worth of pure waste.

**AC vs DC in one paragraph:** the grid runs on alternating current because transformers change AC voltage cheaply — a 130-year-old decision that still shapes everything. Solar panels and batteries live in direct current. So the defining machine of the energy transition is the **inverter**: the box that converts DC into grid-synchronized AC. Master that box and you can sell into solar, storage, wind, EV charging, and hydrogen — which is precisely the story of this company's catalog.

**How a solar cell works (30 seconds):** a silicon **p-n junction** — two chemically doped layers forming a built-in electric field. Photons knock electrons loose; the field sweeps them one way; current flows. One cell ≈ 0.7 V, so panels put ~60–140 cells in series, and plants wire 20–30 panels into **strings** to reach ~1,500 V DC.

**MPPT — the money algorithm:** a panel's output depends on sun, temperature, and the load you present. At every moment there is one operating point yielding maximum power; **MPPT (maximum power point tracking)** hunts it continuously. Analogy: a bicycle's gears — the terrain (sunlight) keeps changing, and MPPT is the rider constantly shifting to keep pedaling at the most powerful cadence. More *independent* MPPT channels = more energy harvested when parts of a plant are shaded, dirty, or mismatched — a headline spec on every inverter datasheet (up to 16 channels on the current utility flagship).

**Batteries in five lines:**
- Grid storage runs on **LFP** (lithium iron phosphate): less energy-dense than phone cells, but far safer and good for **10,000+ cycles** — right for a 20-year stationary asset.
- **Ah (amp-hours)** = cell capacity. The industry moved from 280 → 314 → now **684 Ah** giant cells: fewer cells, welds, and connections per MWh (cost and reliability), as long as thermal design can cool the bigger cell's interior.
- **C-rate** = speed relative to capacity: 0.5C = full discharge in 2 hours.
- **Cycle life** = cycles until capacity fades to ~80%.
- **Thermal runaway** = a hot cell tipping into self-sustaining reaction — the failure mode all storage fire engineering exists to contain (Module 3).

**The semiconductor kicker:** modern converters chop current at tens of kHz through small magnetics instead of using giant iron transformers. Wide-bandgap **silicon carbide (SiC)** switches faster with lower losses than plain silicon — the ingredient behind 99%+ conversion efficiency in the newest storage inverters.

## Module 2 — How a solar + storage plant works today (the system to hold in your head)

**Follow the electrons, generation side:**

```
Panels → strings (~1,500 V DC)
  → inverters: DC → 3-phase AC (600–1,000 V)
  → MV transformer: → 10–35 kV ("medium voltage")
  → substation: → 110 kV+ ("high voltage")
  → grid
```

Everything besides the panels — cabling, combiner boxes, inverters, transformers, racking — is **BOS (balance of system)**. Plant design is a war on BOS cost, which is why voltage keeps climbing (Module 1, I²R) and why inverter granularity matters.

**The two inverter philosophies (and the hybrid):**
- **String inverters** — many ~250–500 kW units distributed through the plant, each with its own MPPTs. Fine-grained energy harvest; one failure loses a sliver of capacity; a technician can swap one without a crane.
- **Central inverters** — a few multi-MW machines. Cheapest per watt at scale, but coarse MPPT and a big single point of failure.
- **Modular** — central-class blocks assembled from swappable sub-modules (e.g. 800 kW modules paralleling to 9.6 MW): central economics, string-like serviceability. This "best of both" design is where utility-scale is heading.

**Storage joins the plant:** a grid-scale battery unit is a 20-ft shipping container packing LFP racks, liquid cooling, fire protection, and (in "AC block" designs) the **PCS — power conversion system**, a bidirectional inverter that charges and discharges the battery. Containers chain into blocks, blocks into GWh plants. **Duration** = energy ÷ power: a 4-hour system delivers full power for 4 hours; as solar floods midday markets, longer durations win because value shifts to the evening.

**Why liquid cooling took over:** hot cells age fast, and *unevenly* heated cells drift apart — the weakest cell limits the pack. Liquid plates hold cell-to-cell spread to ~2 °C, extending life and cutting the cooling energy the plant burns on itself (auxiliary consumption — a real line item in project economics).

**What storage is paid for:** arbitrage (buy midday, sell evening), ramp smoothing, frequency response, and capacity payments. The battery's business case is the *spread* between cheap and expensive hours — falling battery costs widen the set of markets where that spread pays.

**The stability problem that sets up Module 3:** the grid holds 50/60 Hz thanks historically to the **inertia** of massive spinning turbine rotors — a physical flywheel resisting sudden frequency change. Retire the turbines and the grid becomes a hall of electronics with no flywheel. Something must *create* the stable waveform rather than follow it. Hold that thought.

## Module 3 — Sungrow's core products, one by one (the core module)

**1. SG-HX utility string inverters (SG350HX → SG510HX/SG465HX).** The DC→AC workhorses of utility solar. SG350HX: 352 kVA, up to **16 MPPTs** (2 strings each), **99% max efficiency**, IP66 sealed, integrated DC switch, 24-hour insulation monitoring (catches cable faults before they arc). The new generation (SG510HX; SG465HX is the Middle East variant) raises unit power to ~465–510 kW and — the real innovation — moves the AC side to **1,000 V**: less current per watt, less copper, subarrays growing to ~9.8 MW. It also adds **PV-side grid-forming (PV-GFM)** — the solar array itself helping stabilize the grid (see product 4). What this line displaces: lower-voltage string fleets (more units, more BOS per MW) and inflexible central-only architectures.

**2. '1+X' modular inverter (2.0: 800 kW × up to 12 = 9.6 MW).** Module 2's philosophies reconciled as a product: a central-class block built from swappable 800 kW modules. A failed module is a forklift job, not a crane job; critical parts (IGBTs, capacitors) sit in an isolated upper module for fast field replacement. "Power granularity" 30% finer than the previous generation means plant designers right-size blocks instead of rounding up. Detects arc faults and isolates the faulty circuit in 40 ms; runs without derating to 52 °C (Middle East desert spec); provides inertia-like grid support within 5 ms.

**3. PowerTitan utility BESS — the storage flagship.**
- **PowerTitan 2.0** (the volume workhorse): **5 MWh + 2.5 MW PCS in one 20-ft container** — the "**AC block**": battery and inverter pre-integrated and factory-tested, so a site receives plug-together AC units instead of a field-engineered DC yard. Claimed effects vs DC-block: ~2% better round-trip efficiency, 92% lower fault losses.
- **PowerTitan 3.0** (2025): built on the first mass-producible **684 Ah cell** (Module 1: fewer parts per MWh) with **thermal-electrical separation** inside the cell (heat paths isolated from electrical paths — a safety architecture, not just a bigger jar), a fully liquid-cooled **SiC PCS** (99.3% conversion; ~92% round-trip), in 3.45 / 6.9 / 12.5 MWh versions, −40 °C to +55 °C, 5,000 m altitude.
- **The European variant** (2026): same platform re-proportioned to **7.14 MWh / 1.78 MW = 4-hour duration** per container — because European markets buy duration (Module 2), a vendor who re-balances MWh-vs-MW per container wins tenders without new invention.
- Reference fleet: a **7.8 GWh** Saudi plant (1,500+ containers) and **7.5 GWh** for a 5.2 GW round-the-clock solar+storage project in Abu Dhabi — giga-scale proof that the AC-block approach ships.

**4. Grid-forming — the concept to actually master.** A **grid-following** inverter measures the grid's voltage waveform and injects current in sync: a surfer riding an existing wave. A **grid-forming** inverter *generates* its own voltage waveform and defends it: the wave machine. Consequences: synthetic inertia (Module 2's missing flywheel, recreated in control software), ride-through of disturbances, and **black start** — re-energizing a dead grid from batteries, historically a diesel/hydro job. Sungrow's "Stem Cell" grid-forming control runs across storage, PV (PV-GFM), and wind converters; the Saudi 7.8 GWh fleet is described as the world's largest grid-forming storage plant. Why it sells: grids with retiring turbines (Australia, UK, Iberia, the Gulf) now *require or pay extra* for grid-forming — an engineering feature converted directly into tender wins.

**5. Safety as a competitive spec.** Thermal runaway is storage's existential risk, so proof beats promises: Sungrow ran the industry's largest **burn tests** — 10 MWh (2024), then **20 MWh**: four fully charged 5 MWh containers, fire suppression *disabled*, ignited and left to burn 25+ hours under third-party (DNV) witness. Result: >1,385 °C contained, no container-to-container propagation. Buyers, insurers, and permitting authorities treat this as a purchasing criterion — safety evidence is now part of the product.

**6. The PCS, and why efficiency counts twice.** Every conversion loss is paid **on charge and again on discharge** — PCS losses compound into round-trip efficiency, the fraction of bought energy that returns as sellable energy. Over ~10,000 cycles, one PCS efficiency point is real revenue; that's the economic argument for in-house SiC PCS design rather than buying third-party inverters like cell-maker rivals must.

**Worked example — why duration versions exist:** suppose evening power sells for 8 ¢/kWh more than midday power. A 7.14 MWh container at 92% round-trip moves ~6.57 MWh per cycle → ~$525/day → ~$190k/year *per container*, times hundreds of containers. Now note the same container at 2-hour proportions would need more PCS (cost) for the same MWh — matching container proportions to the market's duration IS the product decision.

## Module 4 — The rest of the portfolio, same physics

- **PowerStack (C&I storage).** The PowerTitan concept at factory/supermarket scale: 257 kWh (2 h) or 514 kWh (4 h) cabinets, 125 kW PCS, liquid cooling with AI thermal balancing (auxiliary consumption −33%, cell spread ≤2.5 °C), integrated EMS/BMS, UL9540/NFPA certifications. What businesses buy it for: shaving peak-demand charges, self-consuming rooftop solar, backup.
- **Residential hybrids + batteries.** A **hybrid inverter** is one box managing rooftop PV, a home battery, and backup through a *shared* DC→AC stage — one conversion system instead of two. SH ranges: single-phase 3–10 kW, three-phase up to 25 kW with 3 MPPTs and **<10 ms** backup switchover (faster than most electronics notice). Batteries are stackable LFP modules — 3.2 kWh (SBR) or 5 kWh (SBH) bricks, up to 160 kWh paralleled — a closed ecosystem pairing only with Sungrow hybrids. Sold via distributors into installer networks, storage-attach being the growth story (a single Australian distributor contracted 1 GWh for 2026, 600 MWh of it residential).
- **EV charging.** A DC fast charger is a rectifier bank pointed at a car: Sungrow parallels its own **40 kW modules (>97% efficient)** up to **480 kW** — the same modular N+ philosophy as its inverters, in sealed air-cooled cabinets (IP65/C5). The clever bundle is **PV + storage + charging**: the battery buffers the grid connection so a site offers megawatt-class charging without paying for a megawatt-class utility feed.
- **Hydrogen electrolyzers.** Electrolysis is a fuel cell in reverse: DC current splits water. **ALK** (alkaline): cheap, giant (2,000 Nm³/h units), prefers steady input. **PEM**: compact, fast-responding, follows fluctuating solar/wind (300 Nm³/h units). The overlooked fact: an electrolyzer plant is mostly a *giant DC power supply* — rectifier engineering is core inverter-company competence, which is why the portfolio extends here credibly, including hybrid ALK+PEM plants tuned to variable renewables.
- **Floating PV.** Solar on reservoirs and mining pits: saves land, reduces evaporation, and water-cooled panels yield more. The hard part is marine engineering — floats surviving decades of UV and waves, anchoring/mooring for wind loads, level swings, and awkward bottoms (reference: a 192 MWp plant anchored in **100 m** deep water; methodology DNV-verified). The float-and-anchor system, not the panel, is the product.
- **Wind converters.** A turbine's rotor speed varies with the wind, so its raw AC is grid-unusable; the converter (AC→DC→AC, 1.5–26 MW-class, up to 3,300 V) decouples generator from grid — the same electronics core pointed at a different prime mover, sold to turbine OEMs.
- **iSolarCloud + EMS (the digital layer).** Fleet monitoring, remote configuration, AI fault diagnosis for 1M+ users in 150+ countries — and the EMS deciding when storage charges/discharges. Strategically: hardware is bought once; the platform is the daily relationship and the O&M revenue hook.

**The thread to remember:** one competence — *high-efficiency DC↔AC conversion plus the control software around it* — sold as solar inverters, storage systems, EV chargers, electrolyzer power supplies, wind converters, and a cloud. That's the whole catalog in one sentence.

## Module 5 — The industry map (who buys, who competes, why now)

- **Who buys:** project **developers/IPPs** (build and own plants), **EPCs** (build them), **utilities** — direct, giga-scale deals (single storage orders now run 7–8 GWh); and at small scale, **installers via distributors**. Two entirely different sales motions under one brand: named-account mega-projects vs channel volume.
- **Who competes — inverters:** a global duopoly — Sungrow and Huawei together hold **>55%** of the PV inverter market, with SMA, Fronius, GoodWe and others behind. The battleground specs: efficiency, MPPT granularity, grid-code features (grid-forming now), harsh-climate reliability, and **bankability** — will lenders trust the vendor to exist for the plant's 25-year life?
- **Who competes — storage:** **Tesla** (Megapack; US manufacturing and brand), **CATL** (world's biggest cell maker moving up into systems — its TENER Stack reaches 9 MWh stackable), **BYD**, and integrators like **Fluence** and **Wärtsilä**. Sungrow's differentiation: in-house PCS/inverter mastery (cell makers must buy or build this), factory-integrated AC blocks, grid-forming proven at giga-scale, and full-scale burn-test evidence. The 2026 scoreboard: first vendor ranked **#1 in both** the global BESS integrator and PV inverter rankings — the storage crown taken from Tesla.
- **Why now — the economics:** solar is the cheapest electricity in history in good locations, but it all arrives at noon. Storage converts cheap midday energy into valuable evening energy; as battery costs fall, that trade pencils in ever more markets — which is why storage overtook inverters as the industry's growth engine, and why every vendor's storage line now outweighs its solar line strategically.
- **Why now — the stability market:** as spinning turbines retire, the scarce commodity stops being energy and becomes **stability** (inertia, frequency response, black-start). Grid codes in Australia, the UK, Iberia, and the Gulf increasingly require or reward grid-forming — turning a control-software capability into a priced product. Whoever proves it at scale first sells it everywhere.
- **The moat logic:** conversion hardware alone commoditizes; the compounding advantages are the deployed grid-forming track record, safety test evidence, bankability standing, manufacturing scale, and the monitoring platform sitting on a million systems.

**Self-test (concepts, not trivia):** explain to an imaginary colleague —
1. why 1,500 V DC strings and an AC-1,000 V inverter generation follow directly from P = V·I and I²R;
2. what an "AC block" is and why factory-integrating the PCS with the batteries beats a field-engineered DC yard;
3. the difference between grid-following and grid-forming, and why grids have started paying for the latter;
4. why PCS efficiency counts twice in storage economics and what round-trip efficiency means for revenue;
5. why the same company credibly sells solar inverters, storage, EV chargers, electrolyzers, and wind converters — what single competence links them.

If you can do those five out loud, you understand this company's catalog. The in-app flashcards drill the same list.

Developed by: LightAISolutions
