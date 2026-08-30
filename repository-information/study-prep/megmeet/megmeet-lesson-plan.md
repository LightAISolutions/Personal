# Megmeet — Technology Lesson Plan

**Purpose:** teach what Megmeet's products actually *do* in the grand scheme of their industries, starting from high-school STEM. No company trivia — this is about the technology. Generated 2026-08-07 from the Profiler dossier (profileVersion 1). Companion: the in-app guide (Profiler → Megmeet → Study guide 📖) has the condensed version + concept flashcards.

**Suggested pacing (before the Fri 8/14 meeting; Thu 8/13 is blocked out):** Module 1+2 on day one (~30 min), Module 3 across two days (~45 min — this is the core), Modules 4–5 in one sitting (~30 min), then flashcard passes in the app.

## Module 1 — The physics you already know, applied

Three high-school ideas carry almost everything:

1. **P = V × I** (power = voltage × current). To move 1 MW you can use high voltage & low current, or low voltage & huge current.
2. **Wires waste power as heat: P_loss = I²R.** Losses grow with the *square* of current. Double the voltage → half the current → **one quarter** the wiring loss, and much thinner (cheaper) copper. This single fact is why the grid transmits at hundreds of kV, why EVs moved from 400 V to 800 V packs, and why AI racks are moving to 800 V DC.
3. **Energy is conserved — inefficiency is heat.** A converter that's 97% efficient turns 3% of everything passing through it into heat, which you must then *pay again* to remove with cooling.

**AC vs DC in one paragraph:** the grid uses alternating current because transformers (simple iron + wire) can change AC voltage cheaply — that's a 130-year-old decision that still shapes everything. But every chip, battery, and LED consumes direct current. So the whole modern world is a negotiation between an AC grid and DC loads, and **power electronics is the industry that mediates it**.

**The four machines** (every product in this lesson is a combination of them):
| Machine | Converts | Example |
|---|---|---|
| Rectifier | AC → DC | server PSU front end |
| Inverter | DC → AC | EV motor drive, solar inverter |
| DC-DC converter | DC voltage → other DC voltage | 800 V → 12 V in a car |
| Transformer | AC voltage → other AC voltage | neighborhood pole transformer |

**Why converters shrank 10×:** instead of bulky 50/60 Hz iron transformers, modern converters *chop* current with semiconductor switches at 20,000–200,000 Hz — and transformer size shrinks roughly with frequency. New **wide-bandgap semiconductors** — silicon carbide (SiC) and gallium nitride (GaN) — switch faster and waste less than plain silicon. They are the enabling ingredient behind everything in Module 3.

**Efficiency compounds:** five stages at 97% each = 0.97⁵ ≈ **86%** delivered. That's why architectures win by *removing stages*, not just polishing each one.

## Module 2 — How a data center is powered today (the system being disrupted)

The legacy chain, stage by stage (follow the electrons):

```
Grid 10–35 kV AC  (medium voltage, "MV")
  → step-down transformer            → 400/480 V AC ("low voltage")
  → UPS (uninterruptible power supply): AC→DC → battery → DC→AC
  → PDU (power distribution unit)    → busway to the rack
  → server PSU in each box: AC → 12/48 V DC
  → board-level regulators: → ~1 V DC at hundreds of amps, at the chip
```

- Every stage exists for a reason — safety isolation, blackout ride-through, distribution, standardization — but the power is converted **five-plus times**, each conversion wasting 1–4% and occupying floor space.
- **Critical power** means this load can *never* drop — a mid-training power blip can destroy days of GPU work. That's what the UPS layer (and later, in-rack backup) is for.
- **Why AI breaks this:** a classic rack drew 5–15 kW. NVIDIA-class GPU racks draw **100 kW+ now, heading to ~1 MW**. At 415 V AC, 1 MW ≈ 1,400 A — busbars like railroad track, giant breakers, brutal I²R losses. The 60-year-old chain physically stops scaling.
- **PUE (power usage effectiveness)** = total facility power ÷ power reaching the IT load. PUE 1.5 → for every 100 MW of compute you buy ~150 MW. PUE 1.1 → 110 MW. On a 100 MW campus at ~8.8¢/kWh (~$77M/yr per 100 MW), the difference is tens of millions of dollars a year. This metric is the scoreboard of the whole industry.

## Module 3 — The 800 VDC architecture, product by product (the core module)

**The big idea:** convert to DC **once, early, at high voltage (800 V)**, then distribute DC. Fewer stages (Module 1: stages are where efficiency dies), ~45% less copper (Module 1: I²R), and batteries/supercaps connect to a DC bus *natively* (no extra AC↔DC round-trips). NVIDIA is driving this transition for its 2027-era 1 MW racks; the claimed prize is ~+5% end-to-end efficiency and PUE < 1.1.

Megmeet builds a product for every box in the new chain. Learn the chain and you've learned their AIDC catalog:

```
MV grid ──► SST ──────────────► 800 V DC bus ──► power shelves ──► rack DC busbar
              (or, today:)                     ▲ BBU shelf · supercap shelf
   LV 480/380 V AC ──► SIDECAR ─► 800 V DC ────┘
                                        ... ──► M-CRPS PSUs / Power Brick ──► ~1 V at the GPU
```

**1. Solid-State Transformer (SST) — the endgame box.** A "smart transformer" made of power electronics instead of just iron: takes **medium-voltage AC straight from the grid** and outputs 800 V DC in one conversion system, at **>98.5% efficiency**, megawatt scale. What it displaces: the step-down transformer, the rectification layer, and part of the central UPS. Why it's called *solid-state*: the voltage change happens via high-frequency switching (Module 1), not a passive 50/60 Hz core — so it's smaller, controllable, and can regulate/condition power actively. In the "medium-voltage critical power" picture: it IS the interface between the MV grid and the DC data hall.

**2. 800 V HVDC Sidecar — the bridge shipping today.** Most existing buildings still distribute 480/380 V AC. The sidecar is an external cabinet standing *beside* the rack ("sidecar") that converts that AC to 800 V DC and feeds **>1 MW into a single rack** — new-architecture density without rebuilding the facility. Designed around NVIDIA's Kyber-class dense racks; claims vs legacy in-rack AC power: +5% end-to-end efficiency, −45% copper, up to −30% TCO. Expect sidecars to dominate 2025–2027 deployments, SSTs to take over in purpose-built DC campuses after.

**3. Power shelves — the rack's power organ.** Slide-in 19-inch conversion trays feeding the rack's DC busbar. Two classes: **33 kW air-cooled** (1U; N+1 or N+N redundant, hot-swappable, managed via standard protocols) and **110 kW liquid-cooled** for GB300/Vera Rubin-class racks. **N+1** = one more module than the load needs, so a failed module is swapped live with zero downtime — the critical-power principle pushed down to the tray level. **Why liquid:** at 110 kW in a shelf, air can't move the heat; cold plates with ~45°C "warm" liquid can, and warm liquid is cheap to re-cool (this also feeds facility PUE).

**4. BBU + supercapacitor shelves — the UPS, dissolved into the rack.** Two backup layers on the rack's DC bus: **BBU** (battery backup unit, 16.5 kW) rides through seconds-to-minutes events; **supercapacitor shelf** (15 kW) absorbs *millisecond* transients. Why both: GPU training loads swing enormously and abruptly between compute and communication phases — supercaps catch the fast swings batteries can't, batteries carry the long ones supercaps can't. Because the bus is DC, backup connects without the double AC↔DC conversion a central UPS needs.

**5. CRPS / M-CRPS server PSUs — the standardized workhorses.** Server power supplies built to an industry form factor (any compliant vendor's module fits any compliant chassis — sockets are re-competed on spec, which is how challengers get in). Range 800 W → **5.5 kW**; efficiency tiers are branded like medals (**80 PLUS Titanium ≈ 96%**, **Ruby** = the new top grade); power density **>100 W/in³**, ~2× traditional. Features that matter: hot-swap N+1, PMBus digital management (the PSU reports its own health), black-box event recording.

**6. Power Brick — the last meter.** Point-of-load converter near the GPU taking 54 V (or 800 V) down to the **~1 V, hundreds-of-amps** the silicon drinks. The closer conversion happens to the chip, the shorter the huge-current path (I²R again).

**7. The grid side — where BESS meets AIDC.** A training campus's load swings stress the utility; battery storage (BESS) buffers between grid and data hall ("compute-power coordination"), with EMS/monitoring tying rack, room, and grid together. Same conversion platform, pointed at the grid: this is where Megmeet's storage PCS work, EDPP grid compensator, and the ecosystem's BESS players (the rest of your Profiler roster) connect to the AI story.

## Module 4 — The same four machines, everywhere else they sell

Megmeet's other five segments are the *same physics* pointed at different industries. Recognizing this pattern is the real insight:

- **Industrial automation — the VFD (variable-frequency drive).** MV800/MV520 series. What it does: rectifies grid AC to DC, then an inverter re-synthesizes AC at *any chosen frequency* — and an AC motor's speed follows frequency. Why it matters: motors consume ~45% of global electricity, and most run flat-out behind mechanical throttles/dampers; matching speed to load saves 20–50%. Add-ons: **servo drives** (M5 — VFDs with closed-loop position feedback for robots/CNC) and **PLCs** (MU200/MU300 — the ruggedized computer orchestrating a production line).
- **EV & rail components.** An EV is a rolling power-electronics chain: **OBC** (onboard charger) = rectifier from wall AC into the pack; **DC-DC** = 800/400 V pack down to 12 V for accessories; **motor controller** = inverter making 3-phase AC to spin the traction motor, with regenerative braking running it in reverse. Megmeet shipped **1M+ two-in-one OBC+DC-DC units in 2025** — integration (two machines, one box) is the cost/weight game. Rail HVAC electronics are the industrial-grade cousin.
- **Appliance inverter controls (their largest segment).** An "inverter" air conditioner, heat pump, or washer replaces on/off compressor cycling with a small VFD — quieter, longer-lived, dramatically more efficient. This is high-volume, cost-optimized power electronics: the same rectifier+inverter pair shrunk onto a consumer PCB. (The smart-toilet line is adjacent mechatronics: sensors + heaters + motor control.)
- **Welding inverters.** Artsen/Dex series: rectify, then chop DC at **64–180 kHz** through a small transformer — replacing 10× heavier iron welders — with digital arc control for low spatter and robot repeatability (hence 1,000+-unit robotic welding orders from steel fabricators), plus IoT weld-quality logging (SMARC cloud). At 38.5% gross margin, this is the quiet profit engine.
- **Precision connection.** The physical media the above depends on: shaped magnet wire (winds the high-frequency magnetics), FFC/FPC and ultra-fine flat cable (EV packs, storage, consumer devices). Low margin today — strategic because it feeds their own converters.

**The thread to remember:** one competence — *fast semiconductor switching + digital control* — amortized across appliances, factories, vehicles, welders, and now AI data centers. That's the whole company in one sentence.

## Module 5 — The industry map (who buys, who competes, why now)

- **Who sets the architecture:** NVIDIA. It publishes the rack platforms (GB300, Vera Rubin, Kyber; the MGX modular standard) and organizes an **800 V HVDC ecosystem alliance** of power vendors (Delta, Flex, Lite-On, Megmeet…), silicon makers (Infineon, TI, Navitas…), and system players (Vertiv, Eaton, Schneider). Getting named into that ecosystem is the ticket to the sockets. Megmeet is the **only mainland-China power supplier NVIDIA named for GB200 NVL72** — its wedge.
- **Who owns the market today:** server power is ~**74% Taiwanese** — Delta (~41% alone), Lite-On, AcBel, Chicony, Advanced Energy. In stable architectures incumbents compound; in **architecture transitions** every socket is re-qualified, and the earliest co-designer of the new chain (sidecar/SST/110 kW shelves) starts even or ahead. That's the strategic logic of everything in Module 3.
- **Why the timing is now:** GPU rack power went 10 kW → 100 kW+ this decade; 1 MW racks and full 800 VDC facilities are projected from **~2027**. Bridge products (sidecars, shelves) monetize the transition while SSTs wait for purpose-built campuses.
- **Why efficiency is the whole sales pitch:** at campus scale, +5% end-to-end efficiency and PUE 1.1 vs 1.3 are worth millions per year per site (Module 2 math) — plus less copper, fewer breakers, reclaimed floor space, smaller cooling plant. Power is also the *binding constraint* on AI build-outs (grid interconnects are the queue), so wasting less of it is capacity you don't have to wait for.
- **Pull-through markets:** the same high-voltage platform sells as storage PCS (BESS — where the rest of your Profiler roster lives), EV fast-charging modules (40 kW units launched Jul 2026), and telecom/network power (Ericsson/Cisco-class customers) — one R&D bet, several end markets.

**Self-test (concepts, not trivia):** explain to an imaginary colleague — (1) why 800 V DC beats 415 V AC for a 1 MW rack, (2) what an SST replaces and why that lifts PUE, (3) why supercaps AND batteries both live in the rack, (4) what a VFD does in a factory and an air conditioner, (5) why an architecture transition lets a challenger attack a 41%-share incumbent. If you can do those five out loud, you understand this company's catalog. The in-app flashcards drill the same list.

Developed by: LightAISolutions
