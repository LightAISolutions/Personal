# Wärtsilä — Technology Lesson Plan

**Purpose:** teach what Wärtsilä's energy products actually *do* in the grand scheme of the power industry, starting from high-school STEM. No company trivia — this is about the technology. Generated 2026-08-08 from the Profiler dossier (profileVersion 2). Companion: the in-app guide (Profiler → Wärtsilä → Study guide 📖) has the condensed version + concept flashcards.

**Suggested pacing:** Module 1+2 in one sitting (~35 min — the grid physics is the foundation everything else stands on), Module 3 across two days (~45 min — this is the core product module), Modules 4–5 in one sitting (~30 min), then flashcard passes in the app.

## Module 1 — Grid physics you already half-know

Three ideas carry the whole lesson:

1. **The grid stores (almost) nothing.** Generation and consumption must match *every second*. Think of a bicycle chain: every pedal stroke (generation) is consumed by the wheel (demand) instantly — there's no bucket in the middle.
2. **Frequency is the balance gauge.** All the spinning generators on a grid rotate in lockstep at 50 or 60 Hz. If demand exceeds supply, they all slow down together — frequency sags. Excess supply speeds them up. Grid operators watch frequency like a pilot watches altitude: small deviations are corrected continuously; big ones trip protective relays and can cascade into blackouts.
3. **Inertia is the grid's shock absorber.** A coal or nuclear turbine-generator is a hundred-tonne flywheel. When something big fails, the kinetic energy in all that spinning steel resists the frequency drop for a few seconds — *free* stabilization, bought with mass. Solar panels and batteries connect through **inverters** (power electronics, no moving parts), contributing zero natural inertia. As renewables displace spinning machines, the grid gets "lighter": frequency moves faster after every disturbance, and stability becomes a *product someone must sell* rather than a by-product of heavy machines.

**Baseload vs peaking (the old world):** demand follows a daily curve — a morning rise, an evening peak, a nighttime trough. The classic answer: **baseload** plants (nuclear, coal — cheap to run, slow to change) run flat-out 24/7; **peakers** (gas turbines — expensive per MWh, fast to start) cover the evening spike; **mid-merit** plants follow the ramps in between.

**Why renewables broke it:** wind and solar have near-zero marginal cost (fuel is free) so they always run first — but they produce on the weather's schedule. The rest of the fleet no longer serves the *demand* curve; it serves **net load** = demand minus renewables, a far spikier, less predictable curve. A cloud front can drop hundreds of MW in minutes; a calm evening removes a whole wind fleet exactly when demand peaks. The market stops paying for "steady energy" and starts paying for **flexibility** — the ability to change output fast, often, and on short notice.

**The two dimensions that price every flexibility asset — memorize this:**

| Dimension | Unit | Intuition | What it costs |
|---|---|---|---|
| **Capacity** (power) | MW | width of the pipe / how hard it can push | engines: more engines; batteries: more inverters |
| **Energy** | MWh | size of the tank / how long it can sustain | batteries: **more cells — linear cost**; engines: just more fuel — **nearly free** |

**Worked example:** a "150 MW / 300 MWh" battery can push up to 150 MW for ~2 hours (300 ÷ 150). To make it a 4-hour system at the same power you must roughly *double the cells* — the most expensive part. An engine plant rated 150 MW runs at 150 MW for as long as the gas pipeline flows — 2 hours or 2 weeks, same machine. **Batteries buy duration by the MWh; engines get it free from fuel.** This single asymmetry explains the whole product portfolio in Module 3.

## Module 2 — How grid balancing works today (storage short, engines long)

**What a grid battery (BESS — battery energy storage system) earns money doing:**

- **Frequency response** — inject or absorb power within *milliseconds* when frequency deviates. Nothing else on the grid is faster; this is the battery's home turf.
- **Energy shifting / arbitrage** — charge on cheap midday solar, discharge into the expensive evening peak. (This is the "duck curve" trade: solar floods midday, the ramp into evening is brutal, and a 2–4 h battery bridges exactly that gap.)
- **Capacity** — get paid to *be available* for the seasonal peak.
- **Renewable firming** — sit beside a wind/solar plant and smooth its output so it can honor its commitments.
- Most projects **stack** several of these revenues; software decides the mix hour by hour (Module 3).

**Why batteries stop at hours:** (a) round-trip efficiency ~85–90% — every cycle loses a slice; (b) cells degrade with every cycle (Module 4); (c) decisively, duration costs linear money in cells. Past ~4–8 hours, covering rare long events with cells you seldom use loses to anything that burns fuel.

**Why engines own the long end:** a **reciprocating engine** is car-engine physics scaled up — pistons the size of barrels in cylinders the size of phone booths, spinning a generator at ~500 rpm. Modern medium-speed gas engines convert fuel to electricity at **~50% efficiency** (near the practical ceiling for a standalone machine), start in **~2 minutes**, and run for as long as fuel flows. The energy "tank" is the gas network or a fuel tank, so a windless winter week costs fuel, not capital.

**Engines vs gas turbines — the incumbent fight.** A large gas turbine is one big machine that loves steady full-load running: efficiency collapses at part load, starts take time and consume machine life, and output degrades in hot or thin air. A modular engine plant is **dozens of independent 10–23 MW units**:

- Need 60 MW of a 429 MW plant? Run 3 engines of 24 *at their sweet spot*, not one giant machine at 15% load.
- Add or shed engines in minutes → the plant's efficiency curve is nearly **flat** across its whole output range.
- One engine in maintenance = ~4% of the plant offline, not 100% — redundancy by construction.
- Full output from **−45°C to +50°C** and at altitude; **<5 litres of water per hour** (turbine plants can be thirsty — a real siting constraint in dry regions).
- Claimed **20–35% less fuel** than turbines across realistic balancing duty cycles.

**The hybrid logic (the punchline of this module):** batteries catch the millisecond-to-hours swings at ~90% efficiency; engines carry the sustained, rare gaps at ~50% *fuel* efficiency; an **EMS (energy management system)** decides second by second which asset moves. The battery spares the engines start-stop churn; the engines spare the battery from being oversized for events it would cover twice a year. Each asset does *only what it is cheapest at* — and the software gluing them together becomes a product in its own right.

**Two grid-forming terms buyers now specify:** **black start** (the battery can re-energize a dead grid section with no outside power) and **virtual synchronous generator** (the inverter is programmed to mimic a flywheel's stabilizing response — synthetic inertia for the "lighter" grid of Module 1).


## Module 3 — The product stack, box by box (the core module)

**The big picture:** Wärtsilä sells the *entire flexibility curve* — battery hardware (Quantum family) for the short end, engine plants for the long end, and software (GEMS) as the brain over both — plus lifecycle services that keep it all performing. Learn the boxes and you've learned the catalog.

**1. Quantum — the containerized battery hardware (GridSolve family).** Grid batteries ship as factory-integrated 20-ft ISO containers: cells → modules → racks → container, with cooling, fire protection and controls built in at the factory, so site work is placement and cabling rather than construction. Three variants teach the three design axes:

- **Quantum3 (flagship AC block, 5 MWh/container):** batteries *plus the PCS* fully integrated. **PCS (power conversion system)** = the bidirectional inverter converting battery DC ↔ grid AC — the battery's "voice." An **AC block** delivers grid-ready AC out of the box. Quantum3's PCS is **string-based**: many small inverters on battery strings instead of one central unit, so a failed string *derates* the block a few percent instead of tripping 5 MWh offline — the same N+1 thinking as the engine plants. US-engineered proprietary BMS (battery management system — the cell-level guardian electronics), aluminum housing, single-side access so containers sit **back-to-back** (land savings), low-GWP refrigerant cooling.
- **Quantum2 (DC block, 4 MWh):** batteries with DC output — for projects that pair their own PCS choice — aimed at 2–8-hour durations. IP67 liquid-cooled modules, integrated DC connections, scalable building blocks. Certified UL 9540A / NFPA 855 / IEC 62443-4 (see below).
- **Quantum High Energy (density workhorse):** big **306 Ah cells** push energy density +9% and cut land ~15% — for the multi-hundred-MWh energy-shifting projects where land, BOS (balance of system) and unit count dominate cost. Reference scale: 1,038 units in one 1,400 MWh Australian project; a 150 MW / 300 MWh system delivered as stage one of a larger site.

**Why the whole industry converged on ~5 MWh per 20-ft container:** logistics ceilings, not chemistry. The 20-ft ISO box fits standard ships, cranes and trucks; ~5 MWh is where today's cell density meets **road weight limits**. Denser is possible — and un-truckable. Product size is set by the highway, a genuinely useful cocktail-party fact.

**Battery fire safety in one concept — thermal runaway:** an overheating lithium cell can enter a self-accelerating reaction, ignite its neighbors, and *generate its own oxygen* — water and foam don't simply put it out. So design is layered, in order: **prevent** (liquid cooling keeps cells in their happy temperature zone; active dehumidification stops condensation shorts), **contain** (prefabricated fire walls between units so one burning container cannot cascade down the row), **suppress & assist** (dual sprinkler systems cool surroundings; gas-detection ports let firefighters sample from outside; external door latches give responders access without opening a hot box). The certifications to recognize: **UL 9540A** — a deliberately-ignite-it test measuring whether fire propagates cell→module→rack→unit; **NFPA 855** — the code governing siting, spacing and protection. A marketed "100% fire-safety record" across a deployed fleet is a *sales asset* in a market that remembers BESS fires.

**2. GEMS Digital Energy Platform — the brain.** An EMS spanning **cell to fleet**: it reads every cell's voltage and temperature, autonomously controls each site at **sub-second** speed (7th-generation release), and optimizes charge/discharge against prices, contracts and grid signals across **multi-GWh portfolios**. Layers to know:

- **GEMS Pulse (analytics):** estimates **SoH (state of health** — capacity permanently lost to aging**)**, SoC, cell imbalances and real-time usable energy; flags anomalies before they become failures. It mines **>1 million data points per second across 9+ GWh** of operating fleet — the data flywheel: more fleet → better models → better optimization → easier next sale.
- **GEMS Cloud Connect (cloud suite):** fleet-level value optimization, SOC 2 Type 1 attested (Type 2 underway).
- **Cybersecurity as a feature:** first-in-industry **IEC 62443** certification (the industrial-control-systems security standard). Why it matters: a remotely controllable multi-GW battery fleet is, in hostile hands, a grid weapon — utilities and data-centre buyers now audit for exactly these certifications.
- Grid-forming functions delivered through GEMS: black start, island operation, virtual synchronous generator (Module 2 vocabulary).

**3. Balancing engines — the long end.** Medium-speed 4-stroke generating sets assembled into plants past 450 MW:

| Engine | Power per set | Efficiency | Start |
|---|---|---|---|
| 31SG (gas) | 10.8–12.4 MW | up to **52.1%** | fast-start; "Balancer" variant tuned for renewables duty |
| 46TS-SG / -DF | 20.4–22.9 MW | 51.3% / 50.7% | **2-minute** start-up |
| 50SG / 50DF | 18.4 / 17.6 MW | 49.9% / 49.4% | **30-second** grid connection |

"SG" = spark-ignited gas; "DF" = **dual-fuel** (gas *or* liquid fuel — energy security when a pipeline hiccups). Large plants operational in ~12 months — which matters enormously for the data-centre story below.

**4. Fuel flexibility — the engines' decarbonization answer.** The criticism: "you're selling fossil-gas machines in an energy transition." The engineering answer: the same engine architecture runs a widening fuel menu. **Hydrogen-ready** engines run natural gas with up to **25 vol-% hydrogen** blended today and are designed for later conversion to **100% hydrogen**; a pure-hydrogen variant exists (a large-scale engine has run on 100% hydrogen feeding a national grid — a world first demonstrated to customers in June 2026); ammonia and methanol engines are already real on the marine side, with conversion paths planned for power plants. The pitch to a utility: *build the flexible capacity now; swap the molecules later; the steel never strands.* For high-school chemistry grounding: hydrogen and ammonia (NH₃) contain no carbon → no CO₂ when burned; methanol is carbon-neutral **if** synthesized from captured CO₂ and green hydrogen. The engineering challenges (why this is hard and therefore a moat): hydrogen ignites far more easily (backfire risk), burns faster and hotter (NOx control), and needs ~3× the volume flow; ammonia is slow-burning and toxic — each fuel needs its own injection, timing and safety redesign.

**5. Data centres — the demand shock that stitches the whole portfolio together.** AI campuses need hundreds of MW, and grid interconnection queues run years — power, not chips, is the binding constraint. The portfolio maps on cleanly: **engine plants** as fast-built primary/bridging power (built in ~12 months vs a multi-year grid queue; e.g. a 429 MW, 24-engine plant ordered by a US utility specifically for data-centre demand), **BESS** to buffer the violently swinging AI training load and provide backup, **GEMS** coordinating engines + batteries + grid + renewables as one machine, targeting **99.999% ("five nines") uptime** — about 5 minutes of downtime per year — via layered redundancy and seamless grid-connected ↔ islanded transitions.

## Module 4 — Lifecycle services and the JV, through the same technology lens

**Batteries wear out measurably — that physics creates a business.** Every charge-discharge cycle costs a battery a sliver of permanent capacity (SoH decline; the same reason an old phone dies by 4 pm). A project sold as 300 MWh quietly becomes 270 MWh unless someone manages it. Hence:

- **Augmentation:** plan from day one to add fresh racks every few years, topping capacity back to contract level. (Design consequence: leave pad space and electrical headroom for future racks — augmentation is an *architecture decision*, not an afterthought.)
- **Service tiers** escalate with how much risk the vendor absorbs: remote support and software maintenance → maintenance at planned cost → **guaranteed asset performance** (the vendor contractually underwrites output/availability for the asset's life — it eats the gap if the battery underdelivers). Guarantees only price sanely when the guarantor has fleet-scale data on how batteries actually age — which is what the analytics layer (GEMS Pulse) provides. Software and services reinforce each other.
- **Why owners pay:** a BESS is a revenue machine whose earnings scale with availability × dispatch quality. One percentage point of availability, or degradation-aware scheduling that earns the same revenue with less cell wear, converts directly to money. 24/7 remote operations centres and analytics are sold as *revenue uplift*, not insurance.

**The integrator business model, honestly stated.** An **integrator** buys cells (the majority of system cost) from cell manufacturers, adds enclosure engineering, thermal/fire design, BMS/EMS software, delivery execution, and guarantees — and sells the integrated system. It is capital-light (no cell gigafactory to fund) but margin-thin, and it gets squeezed from both ends when cell prices crash (buyers expect the savings passed through) and cell makers move up-stack selling their own integrated containers. Add trade policy — tariffs and sourcing rules (e.g. US FEOC-type restrictions) steering buyers away from Chinese supply chains — and the pure-play integrator's strategic position gets genuinely hard. This is the *technology-economics* backdrop to storage-business restructurings across the industry.

**A joint venture (JV), as a concept:** two companies pool a business into a jointly owned company — here 50/50 — sharing investment, risk, and complementary strengths. One side contributes the deployed fleet, technology stack (hardware + EMS + analytics), order book and delivery organization; the other contributes manufacturing scale-up and supply-chain expertise, including plans for localized US manufacturing (which the tariff environment rewards). For customers, products and support continue while ownership and capital appetite change behind the curtain. Meanwhile the **engine business stays put** — the two product lines share a *sales story* (flexibility) and a *software layer* (EMS) but almost no manufacturing, supply chain, or capital profile, which is exactly why they can live under different owners.

**Contrast the cash-flow shapes (useful mental model):** engines monetize **MW + decades of service** — machines run 30+ years under guaranteed-performance O&M agreements, a fuel-era annuity. Storage monetizes **MWh + software subscriptions + augmentation cycles** — shorter hardware half-life, faster technology churn, more software leverage. Same buyer, different businesses.


## Module 5 — The industry map (who buys, who competes, why an engine company integrates batteries)

**Who buys flexibility:**
- **Utilities and IPPs** (independent power producers) — grid-scale BESS for frequency/shifting/capacity; engine plants for balancing and peaking.
- **Renewables developers** — storage to firm wind/solar output.
- **Island and off-grid systems** — engines (increasingly hybridized with storage) replacing diesel.
- **Data-centre builders** — the new whale: primary/bridging engine power plus buffering/backup storage, bought on *speed to power*.
- The purchase is rarely hardware alone: it's equipment + integration + software + long-term service, decided on **delivery record, safety record, financing terms and controls software** as much as on $/kWh.

**Who competes in storage integration — two camps (Wood Mackenzie's first global integrator ranking frames it):**
- **Vertically integrated** — make their own cells and/or inverters: Sungrow (#1), Tesla (#2), CATL (#3), BYD (#4). Advantages: cost, supply security, margin capture down the stack.
- **Pure-play integrators** — buy cells, add engineering/controls/delivery/guarantees: Fluence, Powin, Wärtsilä (all global top-ten). Their argument: as projects reach GWh scale and grids get twitchy, **system design, commissioning execution, cybersecurity, and guaranteed long-term performance** differentiate more than cell provenance — and a decade-plus of operating-fleet data feeds optimization software that new entrants can't replicate quickly (the data flywheel from Module 3).
- Market context: annual global BESS installations have passed **100 GW** — volume exploding while integration margin compresses; the value migrates to software, services, and trusted execution.

**Who competes on the engine side:** gas turbines (the incumbent peaker machine) and other reciprocating-engine makers. The engine sales pitch versus turbines re-uses Module 2: flat part-load efficiency, minutes-not-hours starts, modular N-1 redundancy, full performance in heat/cold/altitude, near-zero water — a machine shaped for *frequent starts and fast ramps*, which is what a renewables-heavy grid actually asks for. (Versus batteries there is no fight: the engine sells exactly the durations the battery can't afford.)

**Why an engine company is also a storage integrator — the exam question of this curriculum:**
1. **Same sale:** both products are *flexibility for renewable-heavy grids*, sold to the same utility/IPP buyer, often into the same tender.
2. **Same competence:** integration is project delivery + controls software + guarantees + a global service network — transferable whether the container holds cylinders or cells.
3. **Defensive necessity:** batteries ate the short-duration services engines once provided; entering storage kept the flexibility franchise whole and put the EMS in the middle as the coordinating (and stickiest) layer.
4. **…and the honest limit:** engines and batteries share sales and software, but *not* factories, supply chains, or capital intensity — so the synergy argument weakens at the manufacturing level, which is why such businesses can end up under different ownership while still being pitched together at the project level.

**The synthesis to carry into any conversation:** grids are becoming weather-driven machines stabilized by electronics instead of heavy iron; the flexibility curve is served by **batteries (short), engines (long), and software (deciding)**; fuel flexibility keeps the long end compatible with net zero; and the commercial war is over who **integrates, guarantees, and optimizes** the whole stack — not over any single box.

---

**Self-test (concepts, not trivia):** explain to an imaginary colleague — (1) why a battery's cost scales with MWh but an engine plant's duration is nearly free, and what that means for who wins at 2 hours vs 2 weeks; (2) what thermal runaway is and how a containerized BESS layers prevention, containment and responder assistance against it; (3) what an EMS does from cell to fleet, and why state-of-health analytics make performance *guarantees* commercially possible; (4) why a modular reciprocating-engine plant beats a single large gas turbine for renewables-balancing duty; (5) what "hydrogen-ready" means technically and why fuel flexibility protects a flexible power plant from stranding. If you can do those five out loud, you understand this portfolio. The in-app flashcards drill the same list.

Developed by: LightAISolutions
