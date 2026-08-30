# Zhonhen Electric — Technology Lesson Plan: Data-Center Power Architectures, AC vs HVDC

*Prepared 2026-08-19 · Companion to zhonhen-interview-brief.md, which teaches the room · This teaches the technology*

> **What this is.** A working curriculum on the two data-center power architectures — the Western AC chain and China's HVDC family (240Vdc / 336Vdc / 800Vdc) — built so you can explain both, and the difference, fluently and precisely. It starts from your stated baseline (working knowledge of the US power chain) and **corrects two details in the chain as you described it**, because precision on exactly those details is what separates sounding knowledgeable from being caught approximating.

> **Pacing for today.** Module 1 is ten minutes. Module 2 fixes your existing mental model — read it carefully once. Module 3 is the new material and the heart of the interview. Module 4 connects it to NVIDIA. Module 5 is the scripts — rehearse those out loud. Total: about 75 minutes of reading, then drill.

## Module 1 — The physics toolkit (four ideas, everything else follows)

**1. Power = voltage × current.** A megawatt can be delivered as 2,500 amps at 400 volts or 1,250 amps at 800 volts. Same power, very different engineering problem — because of idea 2.

**2. Loss scales with the *square* of current** (loss = I²R). Double the voltage, halve the current, and conductor losses fall to one quarter — or you carry the same power on far thinner, cheaper copper. This single equation is why every architecture decision in this field is ultimately a voltage decision, and why rack power going from 10kW to 1MW *forces* voltage upward. There is no clever routing around I²R.

**3. Every conversion stage costs three things.** Each transformer, rectifier, or inverter in the chain (a) burns 1–3% of the power as heat, which you then pay again to remove via cooling; (b) is a box that costs money and occupies floor space that could hold revenue-generating IT; and (c) is a failure point — reliability multiplies *down* through series stages. Architecture design is largely the art of deleting stages.

**4. AC won the grid; DC is native to the endpoints.** Transformers only work on alternating current — that's why the grid is AC: cheap voltage changes over a century of infrastructure. But everything at the ends of the modern chain is DC: chips run on DC, batteries store DC, solar generates DC. Every AC segment between a battery and a chip exists for historical reasons, not physical ones. And DC has quiet side benefits: no reactive power, no power-factor correction, no three-phase balancing, no frequency synchronization — entire categories of engineering simply vanish.

**The sentence that compresses Module 1:** *"Data-center power design is a fight between the AC legacy of the grid and the DC nature of the load — and every generation of the fight is settled by I²R."*

## Module 2 — The Western AC chain, precisely (and two corrections to your version)

Here is the conventional US chain, stage by stage. This is close to what you described, with two corrections worth internalizing before tonight.

| # | Stage | In → Out | What it is |
|---|---|---|---|
| 1 | Transmission | 115–345 kVac | Bulk power to the region. (Common US transmission classes: 115, 138, 230, 345 kV) |
| 2 | Substation transformer | → **12.47–34.5 kVac** | Steps to medium voltage. US MV classes: 12.47, 13.8, 24.9, 34.5 kV. **China's MV standard is 10 kV** — which is why Zhonhen's Panama specs say "10kV input" |
| 3 | Unit-substation (MV) transformer | → **480 Vac** (US) / 400 Vac (international) | Low-voltage **AC** — no rectifier lives here in the legacy chain |
| 4 | LV switchgear + distribution | 480 Vac | Breakers, panels |
| 5 | **UPS (double-conversion)** | AC → **DC** → AC | The hidden DC: rectifies 480Vac to an internal DC link where the battery sits, then **inverts back to AC**. Two conversion stages inside one box |
| 6 | PDU (transformer) | 480 → 415/240 or 208/120 Vac | Distribution to rows and racks |
| 7 | Server PSU | AC → **54 Vdc** (48V-class) or 12 Vdc | The rack's own rectifier |
| 8 | On-board VRMs | 54 → 12 → **~0.8–1 Vdc** | Point-of-load converters inches from the die |

**Correction one — there is no "480/380Vdc" stage in the legacy chain.** The MV transformer produces 480V *AC* (or 400V AC internationally — the "380/400/415" family you've seen is AC line voltage, not DC). Facility-level DC at ±400V or 800V exists only in the *new* architectures (Module 4). In the legacy chain, DC appears in exactly two places: hidden *inside* the UPS, and after the server PSU. If you say "the MV transformer and rectifier make 480Vdc" in the room, a power engineer will hear a conflation of the old chain and the new one.

**Correction two — the low-voltage ladder is 54 → 12 → ~1, not 56 → 12 → 6 → 1.** The rack bus is the 48V *class*, which floats around 54Vdc in practice (12Vdc in older designs); board-level VRMs take it to intermediate rails and then to core voltage around 0.8–1V. There's no standard 6V stage. Small thing — but "fifty-four volt bus" is insider vocabulary and "fifty-six" is not.

**Now count what the chain costs.** Three transformers (substation, unit-sub, PDU) plus four conversions (UPS rectifier, UPS inverter, PSU rectifier, VRM) — roughly **seven or eight series stages**, each taking its 1–3%. End-to-end grid-to-chip efficiency lands around **88–94%**, and in a 100MW facility the difference between those two numbers is megawatts of heat you paid for twice. The architecture's deepest absurdity, and your best interview line about it: **the legacy chain converts to DC twice and throws it away once** — the UPS makes DC for its battery, destroys it back into AC, and then the PSU makes DC all over again.

Why does it persist? Because it grew out of enterprise IT: UL listings, NEC familiarity, electricians trained on AC, and a UPS/PDU vendor ecosystem with fifty years of incumbency. It is not wrong; it is *inherited*.

## Module 3 — China's HVDC: 240Vdc and 336Vdc (the heart of tonight)

**First, the naming trap, one more time: in this world "HVDC" means DC power distribution *inside* the data center** — "high-voltage" relative to the telecom −48Vdc it descended from, not relative to the grid. It has nothing to do with ±800kV transmission HVDC. Zhonhen's world calls 240Vdc "high-voltage DC" because its ancestor was 48V.

**The heritage that explains everything.** Telecom networks have run on **−48Vdc battery plants for a century** — rectifiers charge a battery string, the battery floats directly on the bus, the load hangs off the same bus, and the phone system simply never blinks: no transfer switch, no inverter, nothing to fail over *to*, because the backup and the supply are the same wire. Around 2008–2010, Chinese operators and internet companies asked the obvious question: why not scale that architecture up to server voltage? Zhonhen — a telecom-power company from Hangzhou — built the first-generation **240Vdc** system in 2010 and went on to lead-draft the national standard for 240V/336V DC supply. (The first drafter of record is Xu Feifei — now Zhonhen's general manager and your interviewer's partner in the overseas business. The people who wrote the architecture run the company.)

**The engineering trick that made 240Vdc adoptable — this is the single cleverest fact in the whole story.** A modern server PSU has a universal input (90–264 Vac) whose first stage immediately rectifies AC to DC anyway. Feed that same PSU **240 volts DC** and the input stage simply passes it through — most stock PSUs run on 240Vdc without modification. So China's HVDC transition did not require changing the servers *at all*: rip out the UPS and the PDU transformer, install a rectifier plant and a battery-on-bus, and the existing IT fleet keeps running. Alibaba validated it, then standardized it, then bought it at fleet scale. That is why adoption happened in China in the early 2010s while the West debated whitepapers: **240Vdc was chosen precisely because it rides through unmodified hardware.**

**The chain, side by side with Module 2:**

| # | Western AC chain | China HVDC chain |
|---|---|---|
| 1 | Transmission 115–345 kVac | Transmission |
| 2 | Substation → 12.47–34.5 kVac | Substation → **10 kVac** |
| 3 | MV transformer → 480 Vac | MV transformer → 380 Vac |
| 4 | LV switchgear | **HVDC rectifier cabinet → 240 Vdc (or 336 Vdc)** |
| 5 | UPS: AC→DC→AC (battery inside) | **battery strings float directly on the 240Vdc bus** — no UPS exists |
| 6 | PDU transformer → 415/240 Vac | DC distribution (precision row cabinets) |
| 7 | PSU: AC → 54 Vdc | PSU: 240 Vdc in → 12/54 Vdc (stock hardware) |
| 8 | VRMs → ~1 Vdc | VRMs → ~1 Vdc |

Count: roughly **five stages against seven-plus**. The UPS's two conversions are gone; the PDU transformer is gone; the battery needs no transfer switch because it is *already on the bus* — a grid failure changes nothing downstream, the bus just starts draining the battery, with literally zero transfer time. Rectifier-layer efficiency runs **≥97.5%**, and the deleted stages return floor space and remove the two least reliable boxes in the legacy chain.

**336Vdc** is the same idea with more headroom — lower current, thinner copper, slightly better efficiency — but above the passthrough tolerance of stock PSUs, so it needs DC-rated supplies; it appears where the operator controls the hardware fleet. Both voltages live in the same national standard.

**Then Panama (2019) — the second act.** Having deleted the UPS and PDU, Zhonhen and Alibaba went after the remaining boxes: the **Panama power module** folds the MV transformer, the rectification, and the distribution into **one factory-built, pre-tested module: 10kVac in → 240/400/800Vdc out**, >97.5% system efficiency, delivered as a 2.5MW block. The name is the argument — one cut through the isthmus instead of four locks. In NVIDIA-ecosystem vocabulary Panama occupies the **MV-to-DC power block** slot — the one Schneider's own 800VDC paper says is filled "by SST or TRU". **Say "transformer-rectifier unit", not "solid-state transformer".** Panama is a TRU: a line-frequency (50/60Hz) transformer for step-down and isolation, feeding a rectifier. A true SST switches MV-rated SiC at kilohertz and takes its isolation through a small high-frequency core. Calling Panama an SST in front of a power electronics engineer is the one sentence that would cost you the room — and you gain nothing by it, because the TRU framing is the stronger card: it is the mature, shipping-today path to the same architectural slot the West reaches in 2029. **Verified 2026-08-22:** NVIDIA's August 2026 white paper (in the repo under `industry-guidance/`) names the "Panama Architecture" as one of three canonical TRU implementations (p22) and calls TRUs "highly practical for approximately 5 MW-class" blocks — while dating next-gen SST "toward 2029." The device-class distinction taught here is now the reference document's own framing.

**Safety literacy — know this before someone tests you with it.** DC's one genuine disadvantage: an AC arc extinguishes itself 120 times a second at the zero crossings; **a DC arc has no zero crossing and doesn't self-extinguish**. DC plants therefore need DC-rated breakers, arc-fault management, and careful grounding design. The mature answer: this was solved at 240/336V at fleet scale in China over a decade of operations, and it is the same engineering the NVIDIA ecosystem is now doing at 800V. (It is also, quietly, a reason factory-built prefab modules beat field-assembled DC in the US — the arc-management engineering ships from the factory instead of depending on field crews unfamiliar with DC.)

## Module 4 — 800Vdc: the West arrives (and why the number is 800)

**What broke.** AI racks moved the load from 5–10kW per rack to 120–150kW today, on NVIDIA's published trajectory to ~600kW (Kyber, 2H 2027) and 1MW-class beyond. At those densities the AC-to-the-rack architecture fails physically: a legacy 1MW rack needs roughly **200kg of copper busbar**, and the in-rack AC power shelves eat a third of the cabinet. I²R has no mercy at 415Vac.

**NVIDIA's answer (announced May 2025, whitepaper October 2025)** is architecturally China's HVDC at higher voltage: **13.8kVac → solid-state transformer / MV rectifier "sidecar" → 800Vdc facility bus → in-rack DC/DC → 12V → ~0.8V**, with supercapacitors and battery shelves hanging on the DC bus for millisecond and minutes-class ride-through. NVIDIA's own numbers: **157% more power through the same copper vs 415Vac, up to 45% less copper, ~5% better end-to-end efficiency, ~30% lower TCO.** Every serious power vendor — Delta, Megmeet, Eaton, Vertiv, Schneider, ABB — is now building to that spec for the 2027 Kyber generation.

**Why 800 and not 240?** Two reasons. I²R: an AI hall moves ten to a hundred times the power of a 2010 cloud hall, so the voltage must rise with it — 800V carries the megawatt rack at a quarter of 400V's conductor loss. And the supply chain: the EV industry already migrated from 400V to **800V-class** semiconductors, cables, and connectors — automotive volume made 800V components cheap, and the data-center industry is drafting behind it.

**The convergence, stated for the interview:** *China standardized DC-to-the-rack in 2010 because 240Vdc rides through a stock server PSU. NVIDIA is standardizing 800Vdc for 2027 because AI racks broke AC. Same thesis, fifteen years apart, voltage scaled to the load — and Zhonhen is on its third generation of it: 240V in 2010, medium-voltage-to-DC Panama in 2019, 800V lines shipping since 2025.*

**The honest asterisks — hold them, don't lead with them.** Zhonhen is not on NVIDIA's published 800VDC partner roster (Delta, Megmeet, and Hopewind are among the Chinese-linked names); its SuperPOD/Kyber compatibility statements are its own; and the US legacy chain is *not* standing still — 415/240Vac-to-rack designs, eco-mode UPS, and ±400Vdc intermediate steps all narrow the efficiency gap. The claim that survives scrutiny is architecture incumbency and field history, not a monopoly on the idea.

## Module 5 — Saying it in the room

**The 30-second version (rehearse until it's yours):**

> "The conventional chain takes grid AC down through three transformers, runs it through a double-conversion UPS — which secretly makes DC for its battery and then throws it away — and finally rectifies to DC again inside every server. Seven or eight stages, each one costing a point or two of efficiency, floor space, and a failure mode. China's HVDC architecture asked a telecom question: why not put the battery on a DC bus and deliver DC to the rack directly? Rectify once at 240 or 336 volts, float the batteries on the bus — zero transfer time, no inverter, and the clever part is that a stock server PSU accepts 240Vdc without modification. That's five stages instead of eight. NVIDIA's 800-volt architecture for the 2027 racks is the same thesis at higher voltage, because a megawatt rack breaks AC on pure I-squared-R. Zhonhen has been shipping generations of this since 2010 — 240V, then Panama taking 10kV straight to DC in one factory-built module, now 800V."

**The whiteboard version (two minutes).** Draw two vertical chains side by side and *count boxes out loud* — 7–8 on the left, 5 on the right, 3 for Panama (grid → module → rack). Then the three punchlines, one per pause:

1. *"The legacy chain converts to DC twice and throws it away once."*
2. *"240 volts DC was chosen because it rides through an unmodified server power supply — that's why China adopted in 2012 while the West wrote whitepapers."*
3. *"Zhonhen isn't pivoting to NVIDIA's architecture. It's on its third generation of it."*

**Questions you might get, and the knowledgeable answer:**

| If asked… | Say… |
|---|---|
| "Why did DC win in China but not the US?" | Adoption economics, not physics. China's buyers were a handful of hyperscalers and three telecom operators who own their fleets and could standardize by fiat — and 240Vdc needed zero server changes. The US market is thousands of enterprise buyers, UL/NEC codes written for AC, and electricians trained on AC. The architecture was never the obstacle; the institutions were. AI density is what's forcing the US hand now |
| "Isn't DC dangerous?" | DC arcs don't self-extinguish — no zero crossing — so you engineer for it: DC-rated breakers, arc-fault management, grounding design. A decade of fleet-scale Chinese operations at 240/336V solved it at that voltage; the 800V ecosystem is doing that engineering now. And prefabricated modules move that engineering into the factory, away from field crews |
| "What about efficiency claims — real?" | Rectifier-layer ≥97.5% is a spec-sheet number; the honest comparison is end-to-end and the honest answer is 'a few points, plus the second-order wins' — less heat to cool, fewer boxes to buy, floor space back, and reliability from stage deletion. The TCO case is stronger than the pure-efficiency case |
| "If DC is better, why does the whole West still run AC?" | Because the legacy chain isn't wrong, it's *inherited* — and it's improving (415V to the rack, eco-mode UPS). DC wins decisively only when density forces it. That's exactly what 120kW-to-1MW racks are doing — which is why NVIDIA drew the line at 800Vdc for 2027 |
| "What's a Panama module, really?" | A transformer-rectifier unit — line-frequency transformer plus rectifier — filling the MV-to-DC block slot that the West will also fill with solid-state transformers later. Medium voltage in, DC out, one conversion stage, productized in 2019, factory-built and pre-tested, 2.5MW per block, co-developed with Alibaba. Be precise that it is a TRU and not an SST: the honesty is the credibility, and "shipping now" beats "solid-state" |

**Numbers to have cold:** 240 / 336 / 800 Vdc · 10kV (China MV; US: 12.47–34.5kV) · 480Vac (US LV; 400Vac international) · 54Vdc rack bus → ~1V at the die · ≥97.5% rectifier efficiency · 7–8 stages vs 5 vs 3 · NVIDIA: +157% power same copper, −45% copper, ~+5% efficiency, −30% TCO · 120–150kW racks today → ~600kW Kyber 2H 2027 → 1MW-class · Zhonhen generations: 2010 → 2019 → 2025.

**What you are not claiming.** You're not claiming DC is free (arc management is real engineering), not claiming the US chain is incompetent (it's inherited and improving), and not claiming Zhonhen owns the 800V idea (NVIDIA's roster lists others). The expertise you're displaying is knowing *exactly where each claim ends* — that's what sounds knowledgeable.

Developed by: LightAISolutions
