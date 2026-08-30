# Hithium — Technology Lesson Plan

**Purpose:** teach what Hithium's products actually *do* in the grand scheme of the grid-storage industry, starting from high-school STEM. No company trivia — this is about the technology. Generated 2026-08-08 from the Profiler dossier (profileVersion 2). Companion: the in-app guide (Profiler → Hithium → Study guide 📖) has the condensed version + concept flashcards.

**Suggested pacing:** Module 1+2 in one sitting (~30 min), Module 3 across two days (~45 min — this is the core), Modules 4–5 in one sitting (~35 min), then flashcard passes in the app.

## Module 1 — The cell: physics you already know, applied

**Two units, one multiplication.** A battery cell's headline number is its capacity in **amp-hours (Ah)** — how much electric *charge* it holds. But bills, projects, and tenders are priced in **energy**: watt-hours. The bridge is the voltage you learned in physics: **energy (Wh) = charge (Ah) × voltage (V)**. LFP cells sit near 3.2 V, so:

| Cell | Ah × 3.2 V | Energy |
|---|---|---|
| 280 Ah | 280 × 3.2 | ~0.90 kWh |
| 314 Ah | 314 × 3.2 | ~1.0 kWh |
| 587 Ah | 587 × 3.2 | ~1.88 kWh |
| 1,175 Ah | 1,175 × 3.2 | ~3.76 kWh |
| 1,300 Ah | 1,300 × 3.2 | ~4.16 kWh |

Whenever a spec sheet throws an Ah number at you, multiply by ~3.2 and you're back in familiar units.

**Chemistry choice = priorities choice.** **LFP** (lithium iron phosphate — cathode made of iron and phosphate, both cheap and abundant) versus the nickel-cobalt chemistries (**NMC**) that EVs long used: LFP is cheaper per kWh, dramatically harder to ignite, and survives several times more charge-discharge cycles — at the cost of storing less energy per kilogram. **Analogy:** NMC is a racehorse (fast, dense, temperamental, expensive to keep); LFP is an ox (heavier, cheaper, works for decades). You put the racehorse in a car, where every kilogram costs range. You put the ox in a shipping container on a concrete pad, where nobody ever weighs it again.

**The equation that prices grid storage.** What a storage buyer really pays for is *lifetime delivered energy*:

> **cost per delivered kWh ≈ price ÷ (usable kWh × cycle life × round-trip efficiency)**

Notice what's *missing*: energy density. And notice that **cycle life is a straight multiplier** — a 13,000-cycle cell delivers ~2× the lifetime energy of a 6,500-cycle cell at the same price, i.e. half the cost per delivered kWh. This is why stationary-storage spec sheets lead with cycles (7,000 → 13,000 → 20,000) the way EV spec sheets lead with Wh/kg. **One number worth internalizing: at one full cycle per day, 10,000 cycles = 27 years** — long enough for the battery to live as long as the solar farm feeding it.

**Degradation — what "cycle life" is fighting.** Two clocks run against every battery: **cycle aging** (each charge-discharge slightly wears the electrodes — like folding a piece of paper, each fold weakens the crease) and **calendar aging** (the chemistry slowly decays even if the battery just sits). Health is tracked as **SOH (state of health)** — today's capacity as a % of new. A cell is usually declared "done" at 70–80% SOH; a project plans around that decay curve from day one (some plants later **augment** — add fresh containers to top the capacity back up).

**Efficiency is money, twice.** **Round-trip efficiency (RTE)** is what fraction of the energy you charge in comes back out — typically 92–96% at the system level. The missing percent becomes heat, mostly from **I²R** losses (resistance losses grow with the *square* of current — remember this; it explains two separate design choices later). Lost energy hurts twice: you bought that electricity, and you must then spend more electricity on cooling to remove it as heat.

## Module 2 — From cell to grid: the DC block and the value chain

**The assembly ladder** (follow the energy up the stack):

```
CELL       prismatic can, ~1–4 kWh                     (chemistry)
  → MODULE cells welded into a serviceable brick        (mechanics + sensing)
  → RACK   modules in series → ~1,300–1,500 V DC        (voltage)
  → DC BLOCK 20-ft container: racks + liquid cooling
             + fire suppression + BMS                   (the product Hithium sells)
  → + PCS (power conversion system: the big inverter, DC→AC)
  → + transformer → GRID                                (the integrator's/EPC's job)
```

**Decode the config strings.** Spec sheets say things like **1P416S**: 416 cells in **S**eries, 1 **P**arallel string. Series adds voltage (416 × 3.2 V ≈ 1,330 V DC); parallel adds capacity. Why stack to 1,300+ volts? Same reason the grid transmits at high voltage: **P = V × I**, so higher voltage means lower current for the same power, and wiring losses are **I²R** — halve the current, quarter the loss, and use far thinner copper.

**The DC block is the industry's LEGO brick.** It stores and manages energy but outputs DC — it is *not yet a power plant*. Someone must add the **PCS** (the inverter that converts battery DC to grid AC and back), a transformer, and the **EMS** (energy management system — the software that decides *when* to charge and discharge, which is where the revenue logic lives). The block-maker's pitch to a developer: "we deliver sealed, certified, factory-tested energy boxes; you (or your integrator) do the electronics and software."

**Who adds what value — and where a cell maker sits.** Four rungs: **cell maker** (chemistry → cans) → **system integrator** (blocks + PCS + software → plant) → **EPC** (engineering/procurement/construction — builds it) → **developer/IPP** (owns it, earns arbitrage, capacity payments, grid services). A company that sells *both* bare cells to integrators *and* finished DC blocks to developers occupies two rungs at once — capturing more value per MWh, but competing with its own cell customers. Remember this structural tension for Module 5.

**Two engineering facts behind every modern container:**
- **Liquid cooling won** because a pack ages at the rate of its *hottest* cell — uneven temperature means uneven aging means the weakest cell throttles the whole rack. Liquid plates hold thousands of cells within a few degrees of each other; air simply can't at today's 5–7 MWh-per-container densities.
- **Fire certification is the market passport.** **UL 9540A** (a deliberately-triggered thermal-runaway test — prove what happens when a cell *does* catch fire and that it doesn't cascade) and **NFPA 855** (siting/spacing rules) gate entry to US and many Western projects. No test file, no bid.


## Module 3 — The big-cell bet: what 280 → 587 → 1,175 Ah actually changes (the core module)

**The format ladder.** Stationary LFP cells have grown in distinct generations: **280 Ah** (the first storage standard) → **314 Ah** (today's volume workhorse — the format most of the world's containers use) → **587 Ah-class** (the emerging "500+ club," where several majors now compete, with one rival fielding a 628 Ah unit) → **1,175 / 1,300 Ah** (the kilo-amp-hour class — so far a tier with a single mass producer; a 650 Ah step slots between them from 2027). Same chemistry, same 20-ft container outside — radically different construction inside.

**Worked example — why fewer, bigger cells win.** Build a ~5 MWh container two ways:

| | 314 Ah cells (~1 kWh each) | 1,175 Ah cells (~3.76 kWh each) |
|---|---|---|
| Cells needed | ~5,000 | ~1,330 (**−73%**) |
| Welds/busbars/sensor channels | ~5,000 sets | ~1,330 sets |
| BMS monitoring points | thousands | a third as many |

Every eliminated connection is an eliminated *failure point*, an eliminated *assembly step*, and an eliminated *sensor to maintain* for 25 years. The counterintuitive part: cell-level energy density improves only modestly (~20%), but because the module and rack are redesigned around far fewer, larger bricks, **module/rack-level density jumps 60–80%**. The win is architectural, not chemical.

**Why storage can use giant cells and EVs never could: C-rate.** Discharge rate is measured relative to capacity ("**P-rate**" / C-rate: 1P = empty in one hour; 0.25P = four hours; 0.125P = eight hours). Grid storage drains gently — 2 to 8 hours — so a giant cell with **ultra-thick electrodes** (more active material per can, the stated technical basis of the kAh-class designs) has plenty of time to move ions and shed heat. An EV cell must dump energy in bursts and fast-charge in minutes; a thick-electrode giant would overheat. **The gentler the duty, the bigger the cell can be — which is why the kAh class exists only in stationary storage.**

**The economics land as MWh-per-container.** The 20-ft box is fixed by shipping rules; energy per box has climbed 3.7 → 5.0 → 6.25 → 6.9 MWh with each cell generation. For a 1 GWh project that's ~270 containers → ~145: roughly half the land, foundations, cabling runs, crane lifts, and site labor. This is the whole pitch to a developer in one number.

**The tradeoffs (know these — they're the skeptic's questions):** a bigger cell concentrates more energy in one failure unit (fire testing and containment get harder — hence the emphasis on kAh-class UL 9540A data); losing one cell costs 3.76 kWh, not 1; and defect-free ultra-thick electrodes are a manufacturing feat — which is why the 587 Ah is *derived from the 1,175 Ah platform* (one production process, two products) and why "mass production achieved" is itself the competitive claim.

**Map the container family onto the ladder** (the catalog is just the cell ladder in boxes):
- **20-ft utility blocks** — 314 Ah → ∞Block 4.18 / 5.016 MWh; 587 Ah → ∞Power 6.25 MWh 2h; 1,175 Ah → 6.25 MWh 4h; 1,300 Ah → 6.9 MWh 8h; a 10+ MWh class announced next.
- **10-ft modular (Flexsso)** — 3.125/6.25 MWh at <26 t per unit: same cells, halved form factor, for sites where roads, cranes, or permits can't take a full 40-tonne delivery.
- **C&I cabinets** (261 kWh → 1 MWh) — the identical big-cell logic shrunk to a factory's parking pad; using 1,175 Ah cells cuts cabinet cell count ~70%, same arithmetic as above.
- **Consumer units** (1–16 kWh portables and wall batteries) — the same long-life LFP cells in retail packaging; strategically a demonstration of cell versatility, not a core business.

## Module 4 — Long duration and sodium, through the same lens

**Power vs energy — the distinction everything hangs on.** **MW** = how *fast* a plant discharges (power). **MWh** = how *much* it holds (energy). **Duration = MWh ÷ MW.** A 100 MW / 400 MWh plant is a "4-hour battery." Different durations do different jobs:

- **1–2 h:** chase price spikes, frequency regulation — many shallow cycles a day.
- **4 h:** shift midday solar into the evening peak — the current utility workhorse.
- **8 h (LDES — long-duration energy storage):** carry renewables *overnight* and firm them into near-baseload — the segment regulators have started *mandating* (e.g. New South Wales requires 8-hour discharge in its 28 GWh-by-2033 storage program; similar duration-linked tenders are spreading).

**Why renewables push duration up:** at low solar penetration you only need to shave the sunset peak; as penetration grows, the gap to fill stretches from "6–9 pm" toward "sunset to sunrise." Storage duration follows the sun's absence.

**"8-hour-native" vs "stretched" — a real design distinction, not marketing.** Any battery lasts 8 hours if you discharge it at one-eighth rate — but then you paid for power electronics you never use at full tilt. A *native* LDES design inverts the priorities from the cell up: a maximum-energy brick (1,300 Ah, ~4.16 kWh in one can) run at **0.125P**, PCS deliberately sized small relative to storage, degradation minimized by the gentle duty, 6.9 MWh in the same 20-ft box. **Analogy:** a sprinter can walk a marathon, but you'd rather send a marathoner — same muscles, different build.

**LDES economics — why long duration is a cell-cost game.** The PCS, switchgear, and interconnection are sized to **MW**, which stays constant as duration grows; the cells scale with **MWh**. At 8 hours the power hardware amortizes over 4× the energy of a 2-hour plant, so the project price collapses toward **$/kWh of cells** — exactly the variable that big, cheap, long-lived LFP attacks. *This is why the LDES race and the big-cell race are the same race.*

**Sodium-ion: the same playbook, different element.** Swap lithium for **sodium** (element right below it in the periodic table — same chemistry family, ions slightly bigger and heavier, obtainable from common salt):

| | LFP | Sodium-ion (NFPP/hard-carbon class) |
|---|---|---|
| Energy density | ~173+ Wh/kg | ~95 Wh/kg (≈½) |
| Cycle life | 7,000–13,000 | **≥20,000** |
| Cold operation | limited below ~-20 °C | **-40 °C** |
| Supply exposure | lithium price swings | none (salt) |
| Nominal voltage | 3.2 V | ~2.8 V |

On a concrete pad the density penalty barely matters (Module 1's ox logic, doubled) — so sodium's contest with LFP is purely **$/kWh-cycle**. Today it fits high-cycling short-duration work (frequency regulation — 1-hour container class), brutal cold climates, and strategic hedging; it becomes a volume product the moment lithium prices spike. A specialized sodium *storage* cell (rather than a repurposed EV sodium cell) is the same "purpose-built for stationary" thesis extended to a second chemistry.


## Module 5 — The industry map: who buys, who competes, why a specialist exists

**Three buyer layers** (match the product to the buyer and most announcements decode themselves):

1. **Integrators & OEMs buy bare cells** — they build their own systems and want the best $/kWh-cycle can on the market.
2. **Developers, EPCs, and utilities buy DC blocks** — via giga-tenders (a 4 GWh national-utility LDES award), framework agreements (2–3 GWh multi-year deals with regional partners), and reconstruction programs (grid rebuilding creates real LDES demand few Western suppliers serve).
3. **Distributors & installers buy C&I cabinets and home units** — channel businesses, often through regional partnerships.

A cell-plus-block vendor serves all three at once — which means **its cell customers (integrators) compete with its block business**. That dual model captures more value but demands careful account management; watch for it whenever a supplier's "customer" list includes its competitors.

**The competitive field, in two arenas:**
- **Cells:** the diversified giants — CATL (global #1 across EV + storage), EVE, BYD, REPT — all split R&D, capacity, and attention between car batteries and storage. The current frontier is the **large-format race**: the 587 Ah class is where several majors now collide (one fields a 628 Ah entry; specs differ on cycle life vs density vs efficiency — there is no single winner spec), while the **kAh class (1,175/1,300 Ah) remains a one-mass-producer tier** for now. Independent analysis expects 587 Ah-class formats to drive system costs down through 2027 as they become the new standard.
- **Systems:** integrators — Tesla, Sungrow, Fluence and peers — buy or make cells and add PCS + EMS + software. A block vendor is simultaneously their supplier, their competitor, and occasionally their benchmark.

**Why a stationary-only specialist can exist against giants** (the strategic heart of this lesson):
1. **No design compromise:** its cells optimize purely for cycle life and $/kWh — no EV range anxiety pulling the chemistry toward density.
2. **No allocation conflict:** when EV demand spikes, diversified makers feed their automotive customers first; a storage-only supplier's capacity is never hostage to car season.
3. **A grid-native roadmap:** bigger cells, longer durations, sodium — each step tracks *grid economics* (LDES mandates, tender structures) rather than automotive fashion.
The bet underneath: **storage is becoming its own industry, not the EV industry's side market.** If that's right, purpose-built beats adapted.

**Geography is now product strategy.** Tariffs on Chinese battery imports to the US (7% → 26% in 2026) and EU battery regulation turn *where it's assembled* into a spec-sheet line: US module/system assembly (Texas) for domestic-content procurement, planned European cell production (Spain) for EU compliance, "EU Battery Regulation-aligned" as a product feature on the 10-ft modular unit. Even **technology licensing is geopolitics**: China's export controls on battery technology can veto a licensing deal outright (as happened with a major Indian conglomerate's cell-manufacturing plan in early 2026) — protecting the technology moat while capping localization options.

**The four-question decoder** — apply to any storage announcement: *(1)* which layer — cell, DC block, or full system? *(2)* what duration — 2h merchant, 4h solar-shift, or 8h mandate-driven? *(3)* what cell format — 314 Ah commodity or large-format? *(4)* what localization angle — whose tariffs or content rules does it satisfy? Four answers place any product, deal, or competitor move in seconds.

## Self-test (concepts, not trivia)

Explain to an imaginary colleague — out loud:

1. A spec sheet says "1,175 Ah cell." How many kWh is that, and why do storage buyers care more about its 11,000-cycle rating than its Wh/kg?
2. What is a DC block, what must an integrator add before it earns money on the grid, and why does '1P416S' produce ~1,330 V?
3. Walk through what changes — structurally and economically — when a 5 MWh container is built from 1,175 Ah cells instead of 314 Ah cells, and why an EV could never use the big cell.
4. Why is an "8-hour-native" system a different design (not just a derated 4-hour one), and why does long duration make cell $/kWh the dominant cost lever?
5. Give the three reasons a stationary-only cell specialist can hold its ground against diversified giants, and one way geography (tariffs/content rules) shows up as product strategy.

If you can do those five out loud, you understand this company's catalog. The in-app flashcards drill the same list.


Developed by: LightAISolutions
