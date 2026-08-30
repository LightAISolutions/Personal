# Zhonhen Electric — Official AIDC Introduction Deck: Absorption Summary

*Prepared 2026-08-21 · Source: "Zhonhen AIDC Introduction EN" v1.35 (24 slides, dated 2026-08-19), received from the company after the first-round interview · Companion to zhonhen-interview-brief.md and zhonhen-lesson-plan.md*

> **Handling note.** The source deck is marked CONFIDENTIAL on every slide. This summary exists for your preparation only — do not circulate it, and never cite deck contents to anyone outside the Zhonhen process. Inside conversations with Zhonhen, the deck is shared ground: quote it freely.

## What the deck is — and why that matters

An English-language, Western-audience sales introduction: the pitch Zhonhen shows prospective US customers and partners. You were not handed background reading — **you were handed the pitch you would be delivering.** Absorbing it means being able to run it: its argument order, its numbers, and its one killer citation.

## The deck's argument, in five moves

1. **Identity (slides 2–5).** A *DC-technology platform*, not a component vendor — "from source, grid and load to storage," four DC-ization domains (green ICT, low-carbon transport, new power systems, DC microgrids), core technology down to GaN/SiC materials and magnetic-circuit design, and a wall of **twelve national standards** they helped write across three families: GB (national), YD/T (telecom), DL (electric power) — including the 10kV-AC-input/DC-output UPS standard that is Panama's regulatory foundation.
2. **Proof (slides 9–10).** **15 years, 10GW+ of data-center power delivered** — ~3,300MW North China, 3,200MW East China, ~3,300MW South China — and a customer wall: Alibaba, ByteDance, Tencent, Baidu, Pinduoduo, Kuaishou, VNET, Chindata, GDS, Bank of China, China Telecom, China Mobile, China Unicom, State Grid, Southern Grid, H3C.
3. **The why-now (slides 11–12).** The GPU rack-power ladder — **Ampere 15kW → Hopper 40kW → Blackwell 120/150kW → Rubin 200kW+ → Rubin Ultra (Kyber) 1,000kW+** — over a 480Vac→800Vdc transition arrow; and the **four-generations slide**: gen 1–2 multi-stage AC (switchgear + transformer + LVSB + UPS at 380Vac), gen 3 LV rectifier (240/800Vdc), gen 4 **MVR/Panama** taking 6.6–35kV directly to DC. Named trends: AC→DC migration, conventional breakers→**SSCB** (solid-state), link simplification, efficiency.
4. **The validation (slide 13) — the deck's strongest card.** It quotes NVIDIA's own whitepapers: the **2025** OCP whitepaper calls the MV rectifier *"a mature, reliable, and rapidly deployable path to 800VDC… a strong candidate for near-term AI Factory applications"*; the **2026** whitepaper (*800 VDC Architecture: Industry Alignment & Execution*) **names the "Panama Architecture" by name**, describing it as *"a simpler and highly familiar design"* built on line-frequency phase-shifting transformers and centralized rectification. NVIDIA's Figure 10 ("Datacenter architecture over time") shows four rows ending at "MV Rectifier or Solid State Transformer" → 800VDC. **Precision matters:** this is NVIDIA endorsing the *architecture class* Zhonhen productized — it is not Zhonhen appearing on NVIDIA's partner roster. Use the first; never claim the second. **Verified 2026-08-22:** the August 2026 white paper is now in the repo (`repository-information/industry-guidance/`) — the Panama naming and the "simpler and highly familiar design philosophy" phrase are confirmed at p22, so this card is usable with customers when cited and paraphrased.
5. **The offer (slides 6–8, 14–23).** A product pyramid from full-link systems to rack silicon — 240/400V HVDC, MV Rectifier, 800V-HVDC, RPP at the systems layer; CRPS 600W–3.2kW, 18kW PSU, 100kW power shelf at the ICT layer — delivered prefabricated, with slide 7 framing **CATL+Zhonhen as one source-to-rack chain** (renewables/BESS/gas turbine → MV switchgear → HVDC/MVR/SST → sidecar/BBU/DC-DC → RPP/IT rack, under one EMS/PMS layer).

## The numbers to have cold

**The flagship comparison (slide 14) — All-in-one MVR vs traditional chain:**

| Metric | Traditional | Zhonhen MVR (Panama) |
|---|---|---|
| Input → output | 10–35kV AC → 380Vac via 4 stages | 10–35kV AC → **240/400/800Vdc in one stage** |
| Full-link efficiency | 94% | **98.5%** |
| Capacity | — | **720kW – 3.6MW** per system |
| Space | baseline | **−50%** |
| CAPEX / OPEX | baseline | **−30% / −10%** |
| Launch time | 4–6 months | **−50%** |
| Server-PSU failure rate | baseline | **−60%** ("HVDC: no power surge") |

**Rack-side chain (slides 15–16):**

| Product | Spec |
|---|---|
| **800V–1MW Sidecar** | 800×2200×1200mm · 98.5% · **150A/μs** load response · **473kW/m³** · 30× 33kW rectifiers + 125kW DC/DC · optional 8× 160kW CBU + 8× 125kW BBU |
| **100kW PowerShelf** (ZHPS50100KT) | 800Vdc → **50Vdc** · 6× 18kW PSU + PMC monitor · 96A/μs · for "Blackwell and Rubin platforms" over a 50V busbar |
| **18kW PSU** (ZHSE5018KST) | 800Vdc → 50Vdc · 16A/μs · 680×83.4×40mm |
| CRPS server supplies | 600W–3.2kW — they play at every layer of the chain |

**The market slide (17) — the US justification, from their own deck (source: JLL Global Data Center Outlook 2026):**

| Region | Est. 2026 new DC capacity | Prefab market |
|---|---|---|
| **United States** | **7,000–9,000 MW** | **$68.57B** |
| Europe | 2,000–3,000 MW | $14.29B |
| China | 2,500–3,500 MW | $7.71B |
| Southeast Asia | 800–1,200 MW | $4.29B |
| **Total** | — | **$94.86B** |

The deck's own math: **the US prefab market is nine times their home market.** That's the reason your role exists, stated in their slide. Also the 100MW-DC value pools: GPU servers $2–3B, power containers $160M (China) vs **$300M (SEA)**, HVAC containers $100M/$200M, diesel gensets ~$26M, MV/LV switchgear ~$20M.

**Strategic customers (slide 9):** Alibaba — Panama co-development, **"70%+ market share"** · China Telecom — integrated HVDC power module, **"70%+ share"** · **Kuaishou (Kwai)** — "exclusive customization" (reserve power) · **VNET** — "joint definition" (encapsulated power modules).

> **Reconciliation — do not conflate.** The deck's "70%+" figures are share *within those named accounts*. The independently sourced **31%** (Kezhi Consulting 2025) is *overall China HVDC market share*, where Zhonhen ranks #1 with CR3 at 72%. Both are true at different scopes; quoting one as the other is the kind of error a careful listener catches.

## The prefabricated container portfolio (slides 18–23)

The delivery model the role sells: parallel civil and MEP work, factory pre-integration, turnkey commissioning — "plug-and-play power infrastructure."

| Container | Capacity | Key contents / output |
|---|---|---|
| **MVR Container** | 2.5 / 3.1 / 4 / 5 MW | 6.6–35kV AC in → 270/400Vdc out · 4× 625kW rectifier cabinets (customizable) · lead-acid or lithium battery, 250–410V |
| **MV Container** | 10–20 MW | MV switchgear + DC screen, 10–35kV class — the front end of a campus |
| **Transformer & UPS Container** | 2–2.5 MW | Dry-type transformer + LVSB + 4× 600kVA UPS → 380/415V — the *AC* option for customers not ready for DC |
| **IT Container / Skid** | rack-level | Spec'd around **GB300 racks** (1068×600×2299mm) · **1,350kW CDU** · 4× 60kW in-row coolers · RPP |

Common platform specs across all containers: **IP55** ingress protection · **C5-M marine anti-corrosion** (salt spray/splash zone) · **8-degree seismic** testing · HFC-227ea gas suppression · N+1 or 1+1 cooling redundancy · integrated monitoring/fire/access systems. **[Read]** These are export-site specs — coastal, harsh-climate, ship-anywhere — written for exactly the international deployment the deck otherwise never names.

## What's new versus the public record — and what's absent

**New in the deck (not in any public source we found):** the 10GW+ cumulative figure and its regional split; the per-account "70%+" share claims; Kuaishou, VNET, Baidu, Pinduoduo, GDS, Chindata as named customers; every part number and container spec above; the NVIDIA 2026 whitepaper's "Panama Architecture" citation; the JLL market table; the CATL source-to-rack chain slide; the "Modular AI Factory" component branding (CryoPod, NeuroBlock, Energy Vault, HyperGrid, Power Core, Greenport).

**Notably absent:** Enervell and the SuperX JV appear nowhere; no financials; no US entity, certification roadmap, or reference site. The deck sells capability and validation — it goes silent exactly where your role begins. That silence *is* the job description.

## Five things to say that prove you absorbed it

1. *"The four-generations slide is the cleanest version of the migration story I've seen — especially framing the breaker transition to solid-state SSCB as part of the same arc as AC-to-DC."*
2. *"The 2026 NVIDIA whitepaper naming the Panama architecture 'simpler and highly familiar' is the strongest card in the deck — it converts fifteen years of installed base into exactly what a risk-averse US buyer wants to hear."* [Verified — the paper is in hand; p22.]
3. *"473 kilowatts per cubic meter on the 1MW sidecar — with the capacitor and battery options inside the same cabinet — is the spec I'd lead with for neocloud buyers."*
4. *"Your own market slide makes the US case: $68.6 billion of the $95 billion prefab opportunity is American — nine times the home market."*
5. *"The IT container is already spec'd around GB300 racks with a 1,350-kilowatt CDU — that's the 'GPU-ready' claim made concrete."*

**One inconsistency to avoid repeating:** slide 6 says "108kW power shelf," slide 15 says 100kW (6× 18kW hardware = 108kW nameplate, 100kW rated). Say "the 100-kilowatt shelf" and you're safe either way.

Developed by: LightAISolutions
