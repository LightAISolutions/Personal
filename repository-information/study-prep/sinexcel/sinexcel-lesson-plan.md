# Sinexcel — Technology Lesson Plan

**Purpose:** teach what Sinexcel's products actually *do* in the grand scheme of their industries, starting from high-school STEM. No company trivia — this is about the technology. Generated 2026-08-08 from the Profiler dossier (profileVersion 2). Companion: the in-app guide (Profiler → Sinexcel → Study guide 📖) has the condensed version + concept flashcards.

**Suggested pacing (before the H1 report lands Tue 8/11):** Module 1+2 in one sitting (~30 min), Module 3 across two sittings (~45 min — this is the core), Modules 4–5 in one sitting (~35 min), then flashcard passes in the app.

## Module 1 — The physics you already know, applied

Three high-school ideas carry almost everything:

1. **P = V × I** (power = voltage × current). To move 1 MW you can use high voltage & low current, or low voltage & huge current.
2. **Wires waste power as heat: P_loss = I²R.** Losses grow with the *square* of current. Double the voltage → half the current → **one quarter** the wiring loss, and much thinner (cheaper) copper. This single fact explains 1,500 V battery racks, 800 V EV packs, liquid-cooled charging cables, and DC data centers.
3. **Energy is conserved — inefficiency is heat.** A 98.5%-efficient megawatt converter makes 15 kW of heat, continuously, which you also pay to remove. And a storage plant pays conversion losses **twice** — once charging, once discharging ("round-trip efficiency") — so tenths of a percent are real money.

**AC vs DC in one paragraph:** the grid uses alternating current because transformers (iron + wire) change AC voltage cheaply — a 130-year-old decision that still shapes everything. But batteries, chips, LEDs, and EVs all live on direct current. The modern energy transition is, electrically, a negotiation between an AC grid and ever-more DC devices — and **power electronics is the industry that mediates it**.

**The four machines** (every product in this lesson is a combination of them):

| Machine | Converts | Example |
|---|---|---|
| Rectifier | AC → DC | EV fast-charging module |
| Inverter | DC → AC | storage PCS discharging to the grid |
| DC-DC converter | DC voltage → other DC voltage | battery rack to DC bus |
| Transformer | AC voltage → other AC voltage | the MV transformer in a 40-ft storage container |

**The star of this company's story is the bidirectional pair:** put a rectifier and an inverter in one box, let it run either direction on command, and you have a **PCS — power conversion system**. That one machine, at different sizes and orientations, is most of the catalog.

**Why converters shrank 10×:** instead of bulky 50/60 Hz iron, modern converters *chop* current with semiconductor switches at tens of kilohertz — magnetics shrink roughly with frequency. **Wide-bandgap semiconductors** — silicon carbide (**SiC**) — switch faster and waste less than plain silicon; they're why a 40 kW charging brick fits in your hands at 97% efficiency and why harmonic filters can switch at 50–90 kHz.

**One more idea — wave *shape* matters:** the grid promises a smooth sine wave. Real loads chew it up. "Power quality" is the discipline of keeping the wave clean, and it's a third of this company. Hold that thought for Module 2.

## Module 2 — The two worlds being served: storage plants and factories

### 2a. Anatomy of a battery storage plant (BESS)

```
cells → modules → racks → DC bus (1,000–1,500 V)
   → PCS (the gatekeeper) → LV/MV transformer → grid
                 ▲ EMS/controller commands, ms-scale
```

- Batteries are tanks; **the PCS is the valve, pump, and brain-stem in one** — it sets charge/discharge power, follows grid-operator dispatch in milliseconds, and must *stay connected and behave* during grid faults (LVRT/HVRT — riding through low/high voltage without tripping).
- **Why grids pay storage:** grid frequency (50/60 Hz) is a live balance meter — demand exceeds supply and it droops; the reverse and it rises. Storage earns by **frequency regulation** (respond in <1 s), **peak shaving**, **arbitrage** (store cheap solar, sell at 7 pm), and **black start** (re-energize a dead grid). Every one of those services is physically executed *by the PCS*.
- **The scaling problem:** utility projects are 100 MWh+, so plants need dozens of megawatt-class converters that parallel cleanly and don't all fail together. Remember this for the modularity discussion in Module 3.

### 2b. The factory's dirty secret (power quality)

Three distinct diseases, three products (Module 3 has the cures):

1. **Harmonics.** Rectifiers, variable-speed drives, LED drivers, and server PSUs draw current in sharp *gulps*, not sine waves. Fourier's insight (high-school adjacent): any distorted wave = the fundamental + multiples of it (**harmonics**: 150 Hz, 250 Hz…). Harmonic current does no useful work but overheats transformers and neutral wires, trips breakers, and distorts the *voltage* every neighbor sees. Score: **THD** (total harmonic distortion), target usually **<5%**.
2. **Reactive power / power factor.** Motors and transformers need *magnetizing* current that sloshes back and forth doing no net work — but it occupies wires, breakers, and transformer capacity. **Power factor (PF)** = real power ÷ apparent power; utilities charge penalties below ~0.9. Old fix: capacitor banks (coarse steps, slow, can resonate with harmonics — the diseases interact!).
3. **Voltage sags.** Lightning miles away or a big motor starting = a dip to, say, 70% voltage for 100 ms. Humans never notice; a semiconductor fab scraps an entire wafer batch, a data hall reboots. The defense must react in *milliseconds* and needs stored energy — but only a few seconds' worth.

## Module 3 — The storage catalog, mapped (the core module)

### 3a. Grid-following vs grid-forming — the concept that sells PCS in 2026

- **Grid-following** inverter = **a surfer**: it senses the grid's existing wave (via a phase-locked loop) and injects current in step. If the grid dies, the surfer has no wave — it shuts down.
- **Grid-forming** inverter = **a metronome**: it *creates* the voltage wave, sets frequency, and other sources sync to it. It can run an island with no grid at all.
- **Why it's suddenly mandatory:** traditional grids were stabilized *for free* by the sheer spinning mass of coal/gas/hydro generators (inertia — frequency can't change instantly when tons of steel resist it). Retire those plants and the grid gets twitchy. **VSG (virtual synchronous generator)** control makes a grid-forming PCS *impersonate* that spinning mass — synthetic inertia, plus **black start** (energize a dead grid) and large-scale off-grid parallel operation (100+ units sharing one island via fast comms). Tenders across Europe/Asia increasingly *require* grid-forming; it moved from premium feature to entry ticket.

### 3b. Reading a modern utility PCS datasheet (using the flagship as the worked example)

The utility flagship (StellaON class, 1,250–1,575 kVA per unit) is a masterclass in what matters:

- **690 Vac out / 1,040–1,500 Vdc in** — high on both sides (Module 1: I²R). The DC window matches modern high-voltage battery racks; 690 V AC pairs with a step-up transformer to medium voltage.
- **Efficiency 99% peak / ~98.5% rated** — paid twice per round trip; at utility scale a 0.6% round-trip gain measurably lowers the levelized cost of storage.
- **Overload 1.5× (vs ~1.2× typical)** — why it matters: during a short-circuit, breakers need a *surge* of fault current to trip cleanly; off-grid, motor loads draw several times rated current at start. A converter without headroom trips exactly when the island needs muscle. (Physics note: semiconductors have no thermal mass to abuse the way copper-and-iron generators do — headroom must be *designed in*.)
- **THDi ≤3%** — yes, the storage inverter is also graded on wave cleanliness (Module 2b comes full circle).
- **-40 to 60 °C, IP65, C5 anti-corrosion, air-cooled** — utility hardware lives outdoors, in deserts and on coasts, for 20 years.
- **Grid-code certifications per country** (EN 50549 family, national annexes like Poland's, UL 1741/IEEE 1547 in North America…) — each is a months-long lab queue. **Certification breadth is a moat**, and bankability rankings (BloombergNEF Tier 1) decide whose hardware project financiers accept at all.

### 3c. The modular ladder — one building block, five products

```
30 kW module → 135 kW C&I unit → 215 kVA module ×8 = 1,725 kVA cabinet
→ 1,250/1,575 kVA utility PCS → 40-ft container: PCS + MV transformer = 10 MW station
```

- **Same converter competence at every rung.** A cabinet of eight 215 kVA modules gives near-**N+1 availability** (lose a module, keep running derated; swap it in minutes — no crane), incremental capacity, and one supply chain feeding many products.
- **The 40-ft MV station** is "storage plant as appliance": PCS, oil-immersed 22–33 kV transformer, and switchgear pre-integrated in one shipping container — the site just lands it and connects batteries and cable. Integration compresses on-site engineering, the scarcest resource in a boom.
- **The C&I unit (135 kW class)** stresses different specs: transformerless connection at 400/480 V, **100% unbalanced load** tolerance (a building's phases are never equal), IP66 outdoor mounting, and 100+ unit off-grid parallelism — a business-park microgrid in module form.

### 3d. The power-quality cures (same inverter, three diseases)

- **Active harmonic filter (AHF/APF) = noise-cancelling headphones for electricity.** It measures the load's distorted current in real time and injects the exact *mirror image*; grid sees a clean sine (THD <5%, auto-tuned). SiC variants switch at 50–90 kHz — faster switching = cancels higher harmonic orders (up to the 61st) more precisely. Sizes: palm-sized 5–15 A wall units → 300 A rack modules, parallelable without limit.
- **SVG (static var generator) = the same fast inverter aimed at reactive power.** Steplessly generates or absorbs magnetizing current locally — PF to 0.99 in ~15 ms — where capacitor banks step coarsely and resonate. Bonus modes: phase balancing, voltage regulation.
- **AVC (active voltage conditioner) = sag bodyguard.** Supercapacitors + a standby inverter (off-line topology → ~99% efficient in normal times) that injects the missing voltage within **~2 ms**, holding the load at 100% voltage even through a dip *to zero*, for ~3 seconds. **Why supercaps, not batteries:** sags need enormous *power* for tiny *energy* — supercapacitors are power-dense and survive millions of cycles; batteries are energy-dense and would age out. Match storage physics to event timescale. Customers: fabs, precision lines, AI data centers.

## Module 4 — EV charging and microgrids through the same lens

- **AC vs DC charging:** AC chargers feed the car's small onboard rectifier (hours). **DC fast charging moves the rectifier outside the car** — a one-way PCS feeding the pack directly. Speed = how much rectifier you stack.
- **The charging module is the atom:** a 20/40 kW SiC brick (~97% peak efficiency), output **50–1,000 V** to span 400 V and 800 V packs (constant-power band ~300–1,000 V), hot-pluggable. Both used in-house and sold *merchant* to rival charger makers — the classic component-supplier hedge.
- **Distributed architecture:** one power cabinet (e.g. 24 × 20 kW = 480 kW) feeds up to 6+ dispenser posts, with software **dynamically allocating modules** to whichever car can absorb power. Why: batteries charge on a taper (fast when empty, trickle when full), so fixed per-post power idles; pooled modules claim ~97% utilization. Megawatt class (960–1,280 kW, up to 16 connectors) extends the same idea for trucks and fleets.
- **Liquid-cooled cables:** 500–700 A through a hand-held cable is only possible if coolant carries off the I²R heat — copper thick enough to do it passively wouldn't bend. This is the enabling detail behind "20→80% in 10 minutes" and truck charging inside the EU's mandatory **45-minute driver rest breaks**.
- **V2G (vehicle-to-grid):** make the charger bidirectional and a parked EV becomes a small BESS — electrically identical to Module 2a; the hard parts are protocols (ISO 15118), billing, and battery-warranty politics, not physics.
- **Microgrid converters:** the grid-forming ideas of Module 3a shrunk to campus scale — seamless on/off-grid transfer (≤15 ms class dispatch response), VSG island operation, unbalanced-load tolerance, and **battery-agnostic DC inputs** (lithium, sodium-ion, even flywheels) so the converter outlives any one chemistry. Certified participation in grid-services markets (fast frequency response and reserve products) turns a backup asset into a revenue asset.
- **The data-center echo (AIDC):** AI halls are moving toward **HVDC** (high-voltage DC distribution — convert once, distribute DC; Module 1 again) and **SSTs** (solid-state transformers — power electronics replacing iron, same concept family as everything above). Today the practical exposure is rectifier modules supplied into data-center power OEMs plus the power-quality trio protecting existing AC halls; own-brand HVDC/SST is the announced next rung. One more industry adopting the same building block.

## Module 5 — The industry map (who buys, who competes, why modular wins)

- **Each line has a different buyer, one platform underneath:** storage PCS → battery-system **integrators and developers** (they buy conversion, not build it); power quality → **factories, fabs, data centers, ships**; chargers → **charge-point operators, fleets, OEM station programs**; modules → **rival charger makers** (merchant); battery formation/test systems → **cell factories** (that equipment is power electronics too — cycling cells and *recycling the discharge energy* back to the bus instead of burning it).
- **The third-party PCS position:** vertically integrated giants (Sungrow-class) sell whole storage systems — competing with the integrators who might buy their PCS. A specialist that *doesn't* sell complete systems is a safe supplier to those integrators. The analogous split exists in charging (charger OEM vs module merchant) — being both is a balancing act.
- **Competitive fields, per line:** utility PCS vs Sungrow, Power Electronics, SMA-class; power quality vs Schneider (AccuSine), ABB, Danfoss-class active filtering; DC fast charging vs ABB E-mobility, Alpitronic, Kempower-class plus Chinese module houses; data-center power vs the Delta-led incumbency and NVIDIA-ecosystem entrants (a market where our subject is an OEM-module wedge, not a named-ecosystem player — contrast the Megmeet lesson plan).
- **Why "modular PCS architecture" is the strategic sentence:** one SiC converter module amortizes R&D across five markets; in the field it means LEGO-scale capacity steps, minutes-not-cranes repairs, graceful N-1 degradation, and a single manufacturing line feeding storage, charging, and power quality. Architecture compounds; individual specs get copied.
- **The two waves to watch conceptually:** (1) **grid-forming becomes law** — as inverter-dominated grids spread, VSG capability shifts from differentiator to tender requirement, rewarding whoever industrialized it earliest; (2) **everything converges on DC** — storage buses, EV packs, data-center distribution — so the recurring question for this whole sector is: *who else is about to need a fast, efficient, certified AC↔DC box?*

**Self-test (concepts, not trivia):** explain to an imaginary colleague — (1) what a PCS does in a BESS and why grid operators care about its millisecond behavior, (2) the surfer-vs-metronome difference between grid-following and grid-forming, and what VSG fakes, (3) how an active harmonic filter cancels distortion and why an SVG beats a capacitor bank, (4) why voltage-sag protection uses supercapacitors and ~2 ms response, (5) why distributed charging architecture + liquid-cooled cables enable 10-minute charging, and why modular converter architecture is the thread tying all of it together. If you can do those five out loud, you understand this company's catalog. The in-app flashcards drill the same list.

Developed by: LightAISolutions
