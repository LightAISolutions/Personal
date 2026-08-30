# Zhonhen — The 4.8 MW Block Composition Story

**The question this answers:** NVIDIA's August 2026 white paper standardizes the AI-factory power block at **~4.8 MW** (drawn 5 MVA/4.8 MW), distributed through **6000 A-class DC switchboards** and **1250 A busways** to **125 A tap cans**, with **4+1 catcher redundancy** via DC STS, replicated as **20 MW Deployment Units**. Zhonhen's lineup is 2.5 MW Panama modules, 720 kW–3.6 MW SuperX systems, and 2.5/3.1/4/**5 MW** MVR containers. *How does that compose — and what must Zhonhen prove?* This is the technical-sales argument, the arithmetic, and the questions that make you valuable in the room.

**Handling:** companion to [`zhonhen-strategy-report.md`](zhonhen-strategy-report.md) · NVIDIA-side numbers verified against the white paper in [`../../industry-guidance/`](../../industry-guidance/nvidia-800vdc-analysis.md) · Zhonhen-side numbers from the public dossier and the confidential deck summary — deck-only figures (container table, 10 GW fleet) stay inside Zhonhen conversations. Not deployed.

## 1. Why "4.8 MW" is really a current ladder

The block number is not arbitrary — every NVIDIA rating on the DC side is the 800 V current ladder, and saying it this way signals fluency instantly:

| NVIDIA rating | The arithmetic | What it is |
|---|---|---|
| **6000 A-class switchboard** | 4.8 MW ÷ 800 V = **6,000 A** | The block's own output current — the switchboard *is* the block rating |
| **1250 A busway** | 1 MW ÷ 800 V = **1,250 A** | A megawatt-class row — the busway is sized for the native-rack future |
| **125 A tap can / whip** | 100 kW ÷ 800 V = **125 A** | One branch = one ~100 kW position (the 90 kW DC/DC shelf plus headroom) |

So the composition question decomposes cleanly: **can Zhonhen present 6,000 A of coordinated 800 VDC behind one switchboard interface** (the block), and can its distribution hand off at 1,250 A and 125 A (the row and the rack)?

## 2. What NVIDIA fixes — and what it deliberately leaves open

The paper standardizes the **interfaces**, not the conversion internals:

- **Fixed:** block capacity class (~4.8 MW), the 6000 A switchboard and 1250 A busway ratings, the tap-can/whip/interlock methodology (identical to Option B, p21), the 4+1 catcher philosophy, and the 20 MW DU replication unit.
- **Explicitly open:** the rectification itself — the Option C block "covers both TRU or SST based architectures" with an LV rectification stage "**adopting variety of AC/DC conversion designs**" (p18). And the TRU family explicitly includes an approach that "**aggregates** higher-density versions of existing rack-level power shelves… **multiple rectifier modules operating in parallel** to achieve multi-megawatt power block ratings" (p22).

**This is the legitimacy argument, and it matters:** a composed block — multiple Zhonhen modules paralleled behind one DC switchboard — is not a workaround Zhonhen must apologize for. It is one of the three TRU implementation families NVIDIA itself canonizes (alongside IGBT UPS-derived designs and the Panama phase-shifting architecture, p22). The question a buyer's engineer will ask is not *"is paralleling allowed?"* but *"show me your current-sharing and protection coordination."*

## 3. The composition arithmetic

| NVIDIA target | Panama modules (2.5 MW) | SuperX systems (≤3.6 MW) | MVR containers (2.5/3.1/4/**5** MW) |
|---|---|---|---|
| **4.8 MW block** (5 MVA drawn) | **2 × 2.5 = 5.0 MW** — a 5 MVA-class block with ~4% margin over the 4.8 MW rating; matches the drawn block exactly | 2 × 3.6 = 7.2 MW (overshoots); one system alone is 25% short — SuperX maps better at cluster level | **1 × 5 MW container = one block** — the top container rating *is* NVIDIA's drawn block |
| **+1 catcher** (4+1) | 2 more modules (10 per cluster) | — | 1 more container (5 per cluster) |
| **20 MW Deployment Unit** | **8 × 2.5 = 20.0 MW — exact** | 6 × 3.6 = 21.6 MW (8% over) | 4 × 5 MW = 20 MW — exact |
| **8 MW cluster, 1+1** (future native racks) | 8 ÷ 2.5 = 3.2 → no clean fit | 8 ÷ 3.6 ≈ 2.2 → no clean fit | 2 × 4 MW = 8 MW — **the 4 MW rating suddenly matters** |

Three hooks worth memorizing:

1. **"Your top container is already their block."** The 5 MW MVR container equals the 5 MVA/4.8 MW block in NVIDIA's own figures — and the paper independently calls TRUs *"highly practical for approximately 5 MW-class power block deployment"* (p22). Zhonhen's flagship rating sits exactly on the industry's sweet spot, by NVIDIA's own words.
2. **"Eight Panama modules are a Deployment Unit."** 8 × 2.5 MW = 20 MW exactly — the DU replication math falls out of Zhonhen's existing module size with zero waste.
3. **The honest gap:** the future 8 MW cluster (1+1, native ~1 MW racks) has no clean fit from 2.5 or 3.6 — but **2 × 4 MW containers do**. If the 4 MW MVR rating can ship at 800 VDC, Zhonhen covers NVIDIA's future cluster too. That is a roadmap question, not a today-blocker.

**One caution before quoting the container table:** the deck's MVR container line lists **270/400 Vdc output** — the 800 VDC products are the Panama-800V MVR series (IDCC2025: 2N, N+1, and the DR four-bus design "optimized for NVIDIA SuperPOD-class") and SuperX (98.5%, up to 3.6 MW). *Which MW ratings ship at 800 VDC today* is question #1 below — do not assert the 5 MW container is an 800 V product until Zhonhen confirms it.

## 4. The interface scorecard

What NVIDIA's block must present, what Zhonhen demonstrably has, and where the proof burden sits:

| Interface / requirement (paper ref) | Zhonhen has today | The gap to close |
|---|---|---|
| **6000 A DC switchboard** behind the block (p18, p21) | Panama modules integrate 10 kV distribution + transformer + rectification + *output distribution*; precision row cabinets ship today | Does Zhonhen supply the 6000 A-class board itself, or interface to a third-party board? Busway handoff spec at 1250 A? |
| **125 A tap can + interlocked whip** methodology (p15, p27) | Precision row-level distribution cabinets; 150 A/µs-class load response on the rack side | Tap-can protection coordination file (MCCB ~20 ms today, SSCB later); interlock/contactor parity with the EV-derived sequence |
| **4+1 catcher via DC STS** — semiconductor OR-ing or DC/DC-controlled catcher paths (p19) | **Delivered STS/ATS systems in the Alibaba Panama 2.0 program (FY2025)** — the catcher philosophy is rehearsed fleet practice, not a slide | STS ratings at 800 V / block scale; which of NVIDIA's two catcher mechanisms the design implements |
| **Redundancy philosophy alignment** | The IDCC2025 Panama-800V series ships **2N, N+1, and a DR four-bus design** aimed at SuperPOD-class loads | Map DR four-bus onto NVIDIA's block-redundant + catcher model explicitly — same philosophy or a competing one a buyer must choose? |
| **Source fault-current control** — shunt-trip + internal disconnect, current-limited conversion (p28, p32) | "HVDC: no power surge" claim (−60% server-PSU failure rate) implies converter-limited behavior; batteries hang on the bus by design | A published fault-current envelope per module and per composed block — the number a protection study needs |
| **Grounding scheme support** — HRMG favored, RCM/IMD monitoring (p24–27) | Not addressed in any public Zhonhen material | Can the rectifier output run high-resistance midpoint grounding? IMD/RCM integration hooks? This is the most likely "didn't expect that question" win |
| **Current sharing across paralleled modules** (p22 blesses the approach) | 4 × 625 kW rectifier cabinets per 2.5 MW container — internal paralleling is already the product's architecture | Extend the same current-sharing proof from 4 cabinets to 2 modules / 8 modules; droop vs master–slave, and behavior on module loss |
| **Certification** — system-level requirements first, UL Solutions collaboration (p30–33) | **TÜV Rheinland Bauart/CE for AIDC power (Jan 2026)** — first in Greater China per the company | The UL pathway for a composed block in a US hall; NVIDIA's cert workstreams are open — early participation *is* the entry ticket |

## 5. The ten questions for Zhonhen engineering

Asking these — rather than pitching — is what demonstrates command. Each is answerable only by Zhonhen, and each closes a scorecard row:

1. **Which MW ratings ship at 800 VDC output today** — Panama-800V MVR series and SuperX by SKU? (The container table's 270/400 V line is the trap to pre-empt.)
2. Is there a **native 4.8/5 MW 800 VDC block SKU** on the roadmap, or is the offer 2 × 2.5 MW paralleled behind one switchboard?
3. **Current-sharing architecture** across paralleled modules — droop or master–slave, and what happens to the survivors when one module trips at full cluster load?
4. **Fault-current envelope** per module and per composed block — the number a US protection-coordination study will ask for on day one.
5. Do the delivered **Alibaba STS** designs operate at 800 V and block scale — and are they semiconductor OR-ing or DC/DC-controlled catcher paths?
6. How does the **DR four-bus** design map onto NVIDIA's 4+1 block-catcher model — same philosophy, or an alternative the customer must choose between?
7. Can the rectifier output support **high-resistance midpoint grounding**, and what IMD/RCM integration points exist?
8. Does the module implement **shunt-trip fast shutdown + internal disconnect** per the paper's source-control requirement?
9. What is the **6000 A switchboard / 1250 A busway** story — Zhonhen-supplied, partner-supplied, or interface-only?
10. What would it take to put a composed block into **NVIDIA's system-level simulation/validation framework** (source output impedance, module sharing, stability criteria) — and who at Zhonhen owns that conversation?

## 6. Saying it in the room

> *"Your top container rating is already NVIDIA's block — five megawatts is the 5 MVA block in their own figures, and their paper calls TRUs 'highly practical' at exactly 5 MW-class. Eight of your Panama modules are a 20-megawatt Deployment Unit to the decimal. So the work isn't inventing a block — it's certifying the interfaces: the 6000-amp board, the 1250-amp busway handoff, tap-can protection coordination, and a catcher story your Alibaba STS fleet has already rehearsed."*

Two supporting lines, if probed:

- On paralleling: *"NVIDIA's own TRU section canonizes aggregated parallel rectifier modules — composition isn't a compromise, it's one of their three named implementation families. The proof burden is current sharing and protection coordination, and that's an engineering package, not a product gap."*
- On the honest gap: *"The one thing I'd put on the roadmap slide is the future 8-megawatt cluster — two 4-megawatt containers cover it if the 4 MW rating ships at 800 volts. That's the question I'd want answered before a hyperscaler asks it."*

Developed by: LightAISolutions
