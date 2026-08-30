# CATL — Technology Lesson Plan

**Purpose:** teach what CATL's products actually *do* in the grand scheme of the battery industry, starting from high-school STEM. No company trivia — this is about the technology. Generated 2026-08-08 from the Profiler dossier (profileVersion 2). Companion: the in-app guide (Profiler → CATL → Study guide 📖) has the condensed version + concept flashcards.

**Suggested pacing:** Module 1 in one sitting (~25 min — the chemistry foundation everything else stands on), Module 2 the next day (~25 min), Module 3 across two days (~45 min — this is the core), Modules 4–5 in one sitting (~35 min), then flashcard passes in the app.

## Module 1 — The electrochemistry you already know, applied

Three high-school ideas carry almost everything:

1. **A battery is a chemical seesaw.** Two electrodes — the **anode** (negative side) and **cathode** (positive side) — want to exchange ions. The **electrolyte** lets ions cross; a **separator** keeps the electrodes from physically touching (touching = internal short = fire). The electrons can't cross the electrolyte, so they're forced through your circuit — that's the current. Charging pushes the seesaw back up. Everything else in this lesson is engineering around that seesaw.
2. **Energy = capacity × voltage.** A cell's capacity is measured in amp-hours (Ah); multiply by its voltage (~3.2–3.7 V for lithium chemistries) and you get watt-hours (Wh). Divide by mass or volume and you get the two numbers the whole industry fights over: **Wh/kg** (matters when the battery is carried — cars, trucks, aircraft) and **Wh/L** (matters when space is fixed — a car floor, a shipping container on a plot of land).
3. **Speed is measured against capacity.** The **C-rate**: 1C charges a cell in one hour, 4C in ~15 minutes, 12C in ~5 minutes. This is why "12C peak" is the headline number on a fast-charge battery — it's a refueling-time claim written in chemistry units.

**Why fast charging is genuinely hard** (not just a bigger charger): during charging, lithium ions must slot neatly *into* the anode's crystal structure (called intercalation — think books sliding into a bookshelf). Push them too fast, or in the cold, and they instead **plate** onto the anode surface as metallic lithium — permanently lost capacity, and worse, metal needles (**dendrites**) that can eventually pierce the separator. Plus, high current makes heat (your I²R intuition from physics applies inside the cell too). So a real fast-charge battery is a materials + electrolyte + cooling design, and the cold-weather charging spec (e.g. "5–80% in 15 minutes at −10°C") is often the more impressive claim than the room-temperature one.

**Degradation — chemistry's tax.** Every cycle, a parasitic film (the **SEI**, solid-electrolyte interphase) grows a little on the anode, consuming lithium forever. Heat, deep discharge, and fast charging all accelerate aging. **Cycle life** — how many full cycles before the cell fades to ~70–80% of original capacity — is the difference between a battery that lasts a decade and one that lasts three. Hold this thought for Module 3, where a "zero degradation" claim turns out to be a financial instrument.

**The chemistry menu** (each is a different trade among density, cost, safety, cycle life, cold tolerance):

| Chemistry | Density | Cost | Character | Natural home |
|---|---|---|---|---|
| **NMC** (nickel-manganese-cobalt) | highest (~280 Wh/kg pack-level now) | highest | energetic, needs careful thermal management | premium long-range EVs |
| **LFP** (lithium iron phosphate) | ~20–30% lower | low (no nickel/cobalt) | tough, long-cycling, very hard to ignite | mass-market EVs, nearly all grid storage |
| **Sodium-ion** | lower again (~175 Wh/kg) | lowest floor (sodium is everywhere) | shrugs off −40°C, extremely long-lived, ignites only with real effort | grid storage, cold climates, entry vehicles |
| **Condensed-matter / semi-solid** | frontier (350–500 Wh/kg) | high | semi-solid electrolyte, aimed at density's ceiling | aviation, ultra-long-range flagships |

**Analogy to keep:** chemistries are like engine types — nobody asks "which is best?", they ask "for which vehicle, at which price, in which climate?" A company that masters several can serve every answer; that's the strategic meaning of "multi-chemistry" you'll see in Module 5.

**One cell is nothing; a system is everything.** A single cell stores a few hundred Wh at ~3.5 V. A car needs 400–800 V and 60–125 kWh; a grid container needs megawatt-hours. Everything real is thousands of cells in series and parallel, supervised by a **BMS** (battery management system) that tracks every cell's voltage and temperature — because one overheating cell among thousands is the failure mode that matters.

## Module 2 — How cells become EV packs and grid containers

**Manufacturing is the hidden half of the industry.** Cells are made in "gigafactories" rated in GWh/year, and battery cost follows a **learning curve**: every doubling of cumulative production cuts cost by a roughly predictable percentage (the same phenomenon that made solar panels cheap). Scale also buys **yield** — at GWh volumes, the difference between 90% and 99% of cells passing QC is a fortune — and purchasing power over lithium and other inputs. Remember this: it's why the industry's biggest producer tends to *stay* biggest, and it's the gravity behind everything in Module 5.

**From cells to an EV pack — and what CTP means.** The traditional stack: cells → welded into **modules** → modules bolted into a **pack** with cooling plates and wiring. Each layer adds housings and brackets that store zero energy. **CTP — cell-to-pack** — deletes the module layer: large-format cells mount directly into the pack structure. Result: a higher fraction of the pack's weight and volume is actual battery, so the same chemistry delivers more range. Worked example: if module hardware was 15% of pack mass, removing it turns a 250 Wh/kg cell into a noticeably better pack without inventing any new chemistry. The endpoint of this logic is **cell-to-chassis** — the pack becomes the structural floor of the car itself (hold that thought for Module 4's skateboard chassis).

**From cells to grid storage — follow the electrons:**

```
cells → liquid-cooled racks (+BMS) → 20-ft container "DC block"
     (cooling, fire suppression)         │
                                         ▼
                              PCS (power conversion system:
                              the big DC↔AC inverter)
                                         ▼
                              transformer → grid
```

A **BESS** (battery energy storage system) is cells wearing a shipping container. The container — not the cell — is the unit developers shop for: the metric is **MWh per 20-foot footprint**.

**Why containers keep growing** (3.35 → 5 → 6.25 → 9 MWh per footprint within about four years): a 1 GWh project built from 5 MWh containers needs 200 of them — 200 foundations, 200 crane lifts, 200 sets of cabling, plus the land between. Build it from 9 MWh footprints and you need ~111. Fewer units = less balance-of-plant, less installation labor, less land. **Density per footprint is a project-cost lever**, which is why every vendor's flagship announcement is a bigger number in the same steel box.

**What grid buyers actually read on the spec sheet** (different eyes than a car buyer):
- **Wh/L, not Wh/kg** — the container never moves again; land and footprint are the constraint.
- **Cycle life** — a grid battery cycles roughly daily for 20+ years; 6,000-cycle cells and 15,000-cycle cells are different asset classes.
- **Degradation & augmentation** — capacity fades from day one, so developers budget "augmentation": extra containers added in later years to keep meeting contract. A better degradation curve directly shrinks that budget.
- **Round-trip efficiency & auxiliary draw** — energy lost in charge/discharge and energy spent on cooling are both product.
- **Safety certifications** — fire codes, seismic ratings; a thermal-runaway event in one container must not cascade.

**Duration is a configuration, not a product.** The same container family becomes 1-, 2-, 4-, 6- or 8-hour storage by changing the ratio of energy (MWh of containers) to power (MW of PCS). Longer durations mean cell cost dominates the project — which is precisely the terrain where cheap, long-lived chemistries (LFP today, sodium next) win against denser, pricier ones.

## Module 3 — CATL's products mapped into those systems (the core module)

Now map the actual catalog onto Modules 1–2. Each product is a position taken on the trade-offs you now understand.

**1. TENER — and what "five-year zero degradation" really means.** TENER is the 6.25 MWh-per-20-foot grid container (the first of its size to mass-produce). Its headline claim — zero capacity and power degradation for the first five years — sounds like marketing until you run Module 2's augmentation math: a normal project oversizes on day one *because* fade starts immediately. A cell that genuinely holds 100% for five years (achieved by pre-loading extra lithium and electrolyte chemistry that pre-pays the SEI tax from Module 1) means **no augmentation budget for half a decade, more sellable MWh every year, and a warranty a bank can lend against**. Read it as a financial product manufactured out of chemistry — that's why competitors chase the claim rather than dismiss it.

**2. TENER Stack — geometry attacking the container-count math.** Two half-height containers stacked on one 20-foot footprint: 9 MWh total, +45% volume utilization, each half under 36 tonnes so it travels on ordinary roads in ~99% of markets (a full-height 9 MWh box would be untransportable — the stack IS the transport solution). Same land and foundations as a 6.25 MWh unit, 44% more energy. Built on a 587 Ah storage cell — Module 1's "bigger cells, fewer joints" logic taken to grid scale. The competitive frame: Tesla's Megapack 3 (~5 MWh class), Samsung SDI's SBB 1.5 (5.26 MWh, high-nickel NCA), BYD's HaoHan (14.5 MWh in a flat form factor) — everyone is racing MWh-per-footprint by different geometry, exactly as Module 2 predicts.

**3. TENER Sodium — the chemistry hedge productized.** The first field-validated sodium-ion BESS: 30+ MWh per modular configuration, 15,000 cycles at 25°C (a 25–30-year asset carrying a 30-year warranty), >92% capacity at −20°C with **no active heating**, thermal-runaway onset around 200°C, ~1% auxiliary power draw. The trade: lower density than LFP (the same architecture holds 50 MWh with LFP cells). So who buys it? Exactly the Module 2 buyer with cheap land and a 25-year contract in a cold or safety-sensitive market. Sodium turns "storage" from a 10–15-year asset into infrastructure on the lifespan of the substation next to it.

**4. Shenxing — the fast-charge line, or: dissolving the last argument for gasoline.** The mass-market LFP family whose generations track Module 1's C-rate physics: 2nd-gen (12C peak, 1.3 MW — ~2.5 km of range added per *second*, 5–80% in 15 min at −10°C), the Europe-tuned Shenxing Pro (12-year/million-km long-life variant, or 12C superfast variant adding 478 WLTP km in 10 minutes), and the 3rd generation (equivalent 10C with **15C peak**: 10–80% in 3 min 44 s, and 20–98% in ~9 minutes at −30°C). Note what the cold specs are really claiming: charging that fast at −30°C means the plating problem from Module 1 has been engineered away at the temperature where it's hardest. Second-order effect: 5-minute charging needs megawatt chargers and grid feeds — and it quietly competes with battery swap (Module 4), which is one reason to own both bets.

**5. Qilin — CTP density at the premium end.** The NMC flagship pack line built on Module 2's cell-to-pack integration. 3rd generation: 600 Wh/L, 280 Wh/kg at pack level, 10C-equivalent/15C-peak charging; a 125 kWh pack goes over 1,000 km yet weighs 625 kg — 255 kg lighter and 112 L smaller than an equivalent LFP pack (that's the module-deletion dividend made visible). A track variant discharges at 3,000 kW peak — density and power are the same coin. The **Qilin Condensed Battery** variant swaps in a semi-solid ("condensed-matter") electrolyte for 350 Wh/kg / 760 Wh/L — 1,500 km sedans — and its 500 Wh/kg aviation cousin has already flown a 4-tonne aircraft. Aviation is density's frontier because an aircraft pays for every gram twice: once to carry it, once to lift it.

**6. Naxtra — sodium in three costumes.** The same sodium chemistry from product 3, worn three ways: a passenger-EV pack (175 Wh/kg — sodium's record, parity with older LFP; ~500 km; >10,000 cycles; 90% usable power at −40°C — sodium electrolytes simply don't seize in cold the way lithium's do), a 24V heavy-truck start-stop battery (8+ year life, ~61% lower lifecycle cost than the lead-acid battery it replaces — an unglamorous but enormous fleet market), and the TENER Sodium grid blocks. One chemistry investment, three end markets — remember this pattern; it's the portfolio logic of Module 5.

**7. Freevoy and the multi-chemistry pack.** Hybrid (EREV/PHEV) packs: the 2nd generation gives 500 km electric range on LFP (230 Wh/kg, 10C-equivalent charging) or 600 km electric / ~2,000 km combined on NMC with 1,500 kW output. The companion dual-power architecture splits one pack into two independent zones that can mix chemistries — sodium+LFP for cold climates, LFP+LFP for cost, NMC pairings for range. This is the chemistry menu from Module 1 being composed *inside a single pack*.

**8. Tectrans/Tianxing — the same physics, commercial-vehicle sized.** Trucks are a different equation: payload is revenue, downtime is cost. The line spans the world's first mass-production sodium-ion commercial-vehicle battery and an 8C light-commercial battery: 20–80% in 6 min 48 s, full in under 9 minutes — refueling-time parity with diesel, million-km warranty. When charging matches fueling time, the fleet TCO argument for diesel loses its last leg.

## Module 4 — The platform plays: swap, chassis, licensing, recycling

Four businesses that aren't cells at all — they're ways of owning more of the battery's *life*. Each one makes more sense the more Modules 1–3 you remember.

**1. Battery swap — the battery as infrastructure.** The idea: standardize the battery into an exchangeable brick (Choco-SEB blocks for cars — the newest is an 800 V, 75 kWh unit; a separate 75# standard block for heavy trucks), and build machine-swap stations that exchange a depleted brick for a full one in ~100 seconds.

Why this is an *economic* design, not just a convenience:
- The battery is the most expensive part of an EV. Swap **separates battery ownership from car ownership** — the car sells cheaper, the battery is leased as a service.
- The operator pools batteries and charges them **slowly, off-peak**: gentler charging = longer cycle life (Module 1), cheaper electricity, and no megawatt grid connections at every corner.
- For fleets — taxis, delivery vans, freight trucks — a parked vehicle is lost revenue. A 100-second swap beats even a 7-minute fast charge, and it beats a 45-minute charge by an entire shift.

**Network effects are the whole game:** a swap standard with 10 stations is a curiosity; with thousands of stations spanning many car brands it becomes the refueling layer itself. Every new station makes the standard more attractive to the next automaker, and every automaker adoption justifies more stations — the compounding loop of a connector standard (think USB) applied to energy. The strategic contrast: a single-brand network (NIO's model) grows only as fast as one company's car sales; a cross-brand standard can compound on the whole market. Trucks get their own loop: swap corridors along freight trunk routes, where the economics are most brutal and therefore most winnable.

**Tension worth noticing:** Module 3's 5-minute fast charging erodes swap's speed advantage for private cars. The hedge of owning *both* — fast-charge batteries and the swap network, increasingly at combined charge-and-swap stations — means the refueling war is won regardless of which mode wins it.

**2. Skateboard chassis (CIIC / Bedrock) — the EV reduced to its floor.** A **skateboard chassis** packages battery, motors, steering, brakes and crash structure into one flat platform; the automaker bolts a cabin ("top hat") on. Why is a *battery* maker credible here? Module 2's endpoint: with cell-to-chassis integration, the pack IS the structural floor — so the party that engineers the pack is naturally positioned to engineer the floor around it. The customer logic: a new or small automaker gets years of platform R&D and crash engineering as a purchase order, keeping its brand, styling and software. The 'ultra-safe' positioning (surviving extreme frontal impact without fire) is the pack-integration expertise made into a selling point.

**3. Licensing (LRS — License, Royalty, Service) — selling the recipe where you can't sell the cake.** Some markets wall out imported cells (tariffs, subsidies conditioned on domestic production, security politics). LRS answers: the local automaker **builds and owns** the plant; the licensor provides cell designs, production know-how, equipment specs and ramp-up engineers, and is paid a one-time fee plus per-unit royalties. Why the buyer accepts: Module 2 said GWh-scale manufacturing — yield, consistency, speed — is a decade-deep craft; a license converts that decade into a two-year plant ramp. Why the licensor accepts: royalty income at near-zero capital risk from a market it couldn't otherwise touch. The pattern to recognize: ARM in chips — own the IP layer, let others own the factories. The proof case is running now: a major US automaker's wholly-owned Michigan plant producing licensed LFP cells for the mainstream US market.

**4. Recycling — closing the material loop.** End-of-life packs and gigafactory scrap are processed to recover lithium, nickel, cobalt and manganese back into new cathode material. As the first mass-EV generations retire, recovered metal becomes a genuine second mine — a hedge against raw-material price spikes and a compliance requirement in a growing set of markets. Strategically it completes the circle: cells → packs → containers → swap fleets → chassis → licensed plants → **materials again**. Each layer locks in demand for the layer below; the business is the battery's whole life, not just its birth.

## Module 5 — The industry map (who buys, who competes, what decides winners)

**Who buys, by product line:**
- **EV cells/packs** → automakers, on multi-year design-in contracts qualified years before a car ships (switching suppliers mid-platform is rare — design-ins are annuities).
- **Grid storage** → developers, utilities and independent power producers — either bare cells sold to integrators who build their own containers, or complete DC-block containers sold direct with the warranty attached.
- **Swap** → fleets first (taxis, delivery, freight): they monetize refueling minutes daily.
- **Chassis** → smaller and newer automakers buying platform R&D as a product.
- **Licenses** → Western automakers that need domestic, subsidy-compliant cell plants.

**The competitive map, one sentence each:**
- **BYD** — the vertically integrated rival: makes the car *and* the cell (Blade LFP), so it competes as customer-of-nobody; strongest in LFP and in taking its own vehicles downmarket.
- **LG Energy Solution / Samsung SDI / SK On** — the Korean high-nickel specialists; their structural advantage is being *non-Chinese* where politics walls Chinese suppliers out (the US above all).
- **Hithium, EVE Energy, CALB** — the storage-and-value-segment challengers squeezing share from below, mostly on price in LFP grid cells.
- **Tesla** — customer and competitor at once: buys cells, sells Megapack — a preview of how integrators and cell makers collide as containers become the product.
- **Sodium startups (HiNa et al.)** — chasing the same post-lithium grid market, years behind on manufacturing scale.

**Why manufacturing scale decides winners (the deep reason):** Module 2's learning curve compounds — the largest producer has the lowest $/kWh, which funds the largest R&D budget (tens of billions of RMB a year), which produces the next spec-leading product, which wins the next design-in, which adds more volume. In downturns the leader can cut prices and still profit while subscale rivals bleed. And because GWh-scale yield is process craft rather than patentable design, it can't be copied by reading patents — which is precisely why it *can* be sold as a license (Module 4). Scale is simultaneously the moat and, via LRS, the product.

**Why the chemistry roadmap decides winners:** each chemistry unlocks a segment the others can't serve economically — high-nickel and condensed-matter own premium range and aviation; LFP owns the mass market; sodium owns the coldest climates and the longest-lived grid assets. A one-chemistry company is a bet on one segment; a multi-chemistry portfolio is **option value** — whichever segment booms, one product line catches it. And OEMs planning 10-year vehicle platforms and utilities planning 25-year storage assets both prefer the supplier whose roadmap can't strand them.

**Geopolitics is now a market-structure force, not background noise.** Tariffs, domestic-content subsidies and security listings have split the world into three kinds of markets: those you can **ship cells into**, those you must **build local plants in**, and those you can only **license into**. Read any battery company's product portfolio with that lens — every line above is engineered to walk through at least one of those three doors, and the licensing business exists *because* one of the doors is otherwise closed.

**The one-paragraph synthesis:** batteries are a scale-manufacturing industry wearing a chemistry costume. The winners are decided by $/kWh learning curves and multi-chemistry option value; the products — denser containers, 5-minute charging, sodium longevity, swap networks, skateboard chassis, licensed factories — are all downstream expressions of those two forces. If you can explain *why* each product exists using only Modules 1–2, you understand the company's catalog and the industry it sits in.

## Self-test (concepts, not trivia)

Explain to an imaginary colleague — out loud:

1. Why is charging a lithium battery at 12C hard, and why is doing it at −10°C harder? (Module 1: plating, intercalation, heat)
2. A developer is comparing a 6.25 MWh container with a "5-year zero degradation" warranty against a cheaper 5 MWh container without one. What two Module 2/3 cost lines does the warranty attack?
3. Why does sodium-ion win grid-storage deals despite losing to LFP on Wh/L? Name the three spec-sheet lines where it wins.
4. Why does a *battery maker* plausibly build a better skateboard chassis than a tier-1 auto supplier? And why does battery swap need a cross-brand standard to work?
5. Why would a company license its cell technology to a foreign automaker instead of exporting cells or building the plant itself — and what does the buyer get that a patent filing wouldn't give them?

If you can do those five out loud, you understand the catalog. The in-app flashcards drill the same list.

Developed by: LightAISolutions
