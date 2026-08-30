# Profiler Dossier Writing Styles

*Named-styles registry — the single source of truth for **how dossier prose is written**. The active style governs all future dossier authoring (new profiles, revisions, scheduled refreshes, and prep materials that quote dossier prose). Cross-referenced from `.claude/rules/profiler-app.md` ("Dossier Writing Styles" section) and CLAUDE.md ("Profiler Command").*

**Active style:** `intel-briefing` *(set by the developer 2026-08-09; was `default`)*

## How this registry works

- **Scope** — styles govern the **prose fields** of a profile (`summary`, `ecosystemRole`, product `description`/`highlights`/`positioning`, `recentDevelopments[].read`, `strategyRead`, financial `commentary`) and the voice of study guides where prose appears. They never change the JSON schema itself — `PROFILER-SCHEMA.md` remains the structural single source of truth, and every schema rule (public sources only, expectations honesty, notes-are-not-sources, analysis stays labeled) applies identically under every style
- **Switching** — the developer says "set profiler style to \<name\>" (or similar). Claude updates the **Active style** marker above; all *future* authoring follows the new style. Existing dossiers are **not** retro-rewritten unless the developer explicitly asks (a retro-rewrite is a normal revision: archive per the Archival Procedure, `profileVersion` +1)
- **Mock-up basis** — every style below rewrites the **same Megmeet excerpt** (company summary → AI-DC power positioning → the FY2025 results development → strategy read) so the styles can be compared like-for-like. Mock-ups are illustrative excerpts, not full dossiers
- **Adding styles** — new styles get a `## Style:` section here (definition rules + a Megmeet mock-up) before they can be activated
- **Display layer (app + exports)** — `Profiler.html` carries a presentation twin of this registry: per-style section labels, typography/spacing skins, and matching Word/PDF export CSS. `OV_DEFAULT_STYLE` in the page's style-engine block **must be kept in sync with the Active style above** whenever it changes (both edits in the same commit). An admin-only 🖋 button (gated like Versions 🕘) lets the developer switch the app + export presentation between the five styles per-device (localStorage `ov_style`); non-admins always see the default. The display layer re-skins how structured dossier data is *presented* — the prose itself is authored in the Active style at research/refresh time, so switching the active style only fully lands in dossier text as profiles are next refreshed
- **Second display-layer consumer — the AIDC market report** — `repository-information/aidc-market-report-print.html` carries the same five skins, selected by a `data-style` attribute on `<html>`, and `scripts/build-aidc-report-pdf.mjs` renders one downloadable PDF per style (`node scripts/build-aidc-report-pdf.mjs`, or `--style <slug>` for one). The skins there are translated from `Profiler.html`'s print-calibrated export CSS, so a report handed to a customer reads in the same voice as the app. As in the app, the skins re-skin **presentation only** — the report text does not vary by style — and the report's chart palette is deliberately held constant across skins because it was colour-validated once against the white print surface. **When a skin's typography or accent colour changes in `Profiler.html`, mirror it in the report stylesheet in the same commit** so the two display layers cannot drift

## Style: `default` — Analyst Prose (current house style)

The codification of how every existing dossier is written. Staying active until the developer chooses otherwise.

### Rules

1. **Voice** — third-person analyst prose in complete sentences. The dossier reads like a professional research memo: confident, dense, unadorned. No first person, no direct address, no fragments
2. **Density over brevity** — every sentence carries multiple facts; figures ride in parentheses immediately after the claim they support ("FY2025 revenue was ¥9.40B (+15.1%)"); chronology and structure are folded into flowing paragraphs rather than broken into labeled fields
3. **`summary` shape** — one paragraph: what the company is → business segments → scale figures (revenue, growth, footprint) → origin story → listing status
4. **Products** — `description` is a catalogue sentence (dense noun phrases, em-dash asides); `highlights` are 3–6 self-contained declarative bullets that mix fact and significance in the same breath ("Named by NVIDIA (Oct 2024) as a GB200 NVL72 power vendor — the only mainland-China power supplier on the list"); `positioning` names competitors with share figures
5. **`recentDevelopments[].read`** — exactly one sentence of strategy takeaway in analyst voice. Restrained wit is allowed when it sharpens the point ("A rare self-deflation of the AI hype")
6. **`strategyRead`** — thesis-first bullets: each opens by naming the pattern ("Megmeet is running a classic incumbent-funded pivot: …"), then argues it across 2–3 clauses with numbers woven into the argument. Em-dashes carry the pivots. Risks stated plainly, not softened
7. **Hedging discipline** — solid facts are asserted flat; anything unverified carries an explicit inline flag ("market speculation, not company-confirmed"; "company claim"); expectations fields left honest ("no published consensus found") rather than manufactured
8. **No internal labels** — prose fields contain no headers, bold lead-ins, or pseudo-structure; structure comes from the schema, not the text

### Mock-up — Megmeet excerpt (verbatim current prose)

> Megmeet is a power-electronics and electrical-automation company organized into six business groups: smart home appliance electric controls, power products (including AI data-center power), new energy vehicle & rail transit components, industrial automation, intelligent equipment (welding, industrial microwave, oil equipment), and precision connection. FY2025 revenue was ¥9.40B (+15.1%), roughly 40% of it overseas, with 10 R&D centers and 8 manufacturing bases across China, Thailand, India, the US, and Germany. Founded by Huawei Electric and Emerson Network Power alumni, it listed on the Shenzhen Stock Exchange in 2017 and filed for a Hong Kong A+H dual listing in June 2026.
>
> **[Power products — positioning]** Claims to be one of the few mainland-China vendors combining high-power data-center power technology with overseas full-process production. Chasing a market ~74% held by Taiwanese suppliers (Delta ~41%, plus Lite-On, AcBel, Chicony, Advanced Energy); trade press reports Megmeet displacing Lite-On as the #2 NVIDIA power-shelf source behind Delta — market speculation, not company-confirmed.
>
> **[Recent development — 2026-04-28]** FY2025: revenue ¥9.40B (+15%) but net profit ¥146M (−67%), Q4 loss-making, operating cash flow negative; Q1 2026 rebound to ¥115M (+6.9%). *Read:* The core tension: strong top-line and an AI narrative versus collapsing profitability — consensus expects a large FY2026 net-profit rebound that AI power must deliver.
>
> **[Strategy read]** Megmeet is running a classic incumbent-funded pivot: the mature appliance-controls business (38% of revenue, declining) and diversified industrial lines bankroll an all-in push on AI data-center power — R&D has held near 11–12% of revenue for a decade and FY2025 profit was deliberately sacrificed (ex-non-recurring profit −93%) to buy position in NVIDIA's 800VDC architecture transition. Its wedge into the Delta-dominated (~41% share) server-power market is architecture timing, not price: it moved first among mainland vendors on the 800VDC sidecar/SST full-chain and is the only mainland supplier NVIDIA named for GB200 power — betting that the AC→800VDC transition (Kyber/Rubin, 1MW racks from ~2027) reshuffles supplier share before incumbents consolidate it.

## Style: `bloomberg` — BloombergNEF Research Report

Derived from a formatting-and-style analysis of the BloombergNEF "US Data Center Outlook — The Age of AI" report the developer supplied (2026-08-09).

### Source DNA (what the BNEF report actually does)

- **Executive summary leads, findings follow** — the report opens with a 3–5-short-paragraph executive summary, then a "Summary findings" bullet run; every section thereafter is numbered ("Section 2.3") with a clear heading hierarchy
- **Every claim is quantified with an inline comparator** — the signature construction is "X, up from Y" / "X, versus Y" ("8.6% of US power demand by 2035, up from 3.5% today"). Numbers never appear naked; they always carry a baseline
- **Taxonomy bullets** — classification lists use bolded lead terms ("**Retail:** …", "**Wholesale:** …", "**Hyperscale:** …")
- **Run-in italic bullets** — attribute lists use italic lead labels ("*Facility size:* …")
- **Figures are first-class citizens** — bold "Figure N:" captions, italic *Source:* / *Note:* methodology lines beneath, and inline cross-references ("(Figure 12)")
- **Declarative and unhedged** — forecasts are stated as the base case with drivers; uncertainty is handled by scenario framing, never "might/could"
- **Dry wit in small doses** — the occasional restrained aside ("The forecast math for nerds")

### Rules

1. **`summary` becomes an executive summary** — 2–3 short stat-led paragraphs (each opens with its key number), followed by a **Summary findings** run of bolded-lead-term bullets
2. **Inline comparators are mandatory** — wherever a figure has a baseline, prior period, or peer value, state it in the "X, up from Y" form
3. **Taxonomy bullets** for product/segment classification (bold lead term + colon); **run-in italic bullets** for attribute lists (*Capacity:* …)
4. **Data blocks render as figures** — `technicalSpecs`-style data gets a bold "Figure N:" caption line and an italic *Source:*/*Note:* line; prose cross-references figures inline
5. **Short paragraphs** — 2–4 sentences, one idea each; section-lead sentences carry the conclusion first
6. **No hedging verbs** — scenario framing replaces "might/could"; unverified third-party claims still get the honesty flag, phrased as a *Note:* line
7. **One dry aside allowed per major section** — restraint enforced

### Mock-up — Megmeet excerpt

> **Executive summary**
>
> Megmeet generated ¥9.40 billion of revenue in FY2025, up 15.1% year-on-year, with about 40% earned overseas. The company runs six business groups; smart-appliance controls remain the largest at 37.9% of revenue, while power products — the group housing the AI data-center push — contributed 28.5%.
>
> Profitability moved the other way. Net profit fell 66.6% to ¥146 million, ex-non-recurring profit fell 93.0% to ¥26 million, and operating cash flow turned negative for the first time, at −¥139 million. The company is deliberately trading current earnings for position in NVIDIA's 800VDC power-architecture transition.
>
> **Summary findings**
> - **Market structure:** Taiwanese suppliers hold roughly 74% of the server-power market, led by Delta at about 41%. Megmeet is the only mainland-China power vendor NVIDIA has named for GB200 NVL72 power.
> - **Portfolio:** the grid-to-GPU chain spans four conversion stages — **Point-of-load:** CRPS/M-CRPS server PSUs, 800 W to 5.5 kW. **Shelf:** 33 kW air-cooled and 110 kW liquid-cooled power shelves. **Rack:** 800VDC sidecar cabinets above 1 MW per rack. **Facility:** solid-state transformers converting grid input to 800VDC at above 98.5% efficiency.
> - **Timing:** industry adoption of 1 MW racks is projected from 2027; Megmeet's first domestic hyperscaler volume delivery is expected in 2026, up from small-batch orders through 2025.
>
> **Figure 1: Megmeet FY2025 segment revenue (¥, year-on-year growth)**
> Appliance controls 3.56B (−5%) · Power products 2.68B (+14%) · EV/rail 1.14B (+109%) · Industrial automation 877M (+40%) · Intelligent equipment 605M (+31%) · Precision connection 449M (+18%)
> *Source: SZSE FY2025 annual report filing. Note: trade press reports Megmeet displacing Lite-On as the #2 NVIDIA power-shelf source; the company has not confirmed this.*
>
> **FY2025 results (April 28, 2026).** Revenue rose 15.1% to ¥9.40 billion while net profit fell 66.6% to ¥146 million; the fourth quarter was loss-making (Figure 1). Consensus embeds a roughly six-fold profit rebound in FY2026, resting almost entirely on AI data-center power revenue that the company itself described as immaterial through 2025. The August 27 half-year report is the first hard test of that math — the forecast math for optimists.
>
> **Strategy read.** Megmeet's wedge is architecture timing, not price. The AC-to-800VDC transition begins with Kyber/Vera Rubin-class racks from 2027, and Megmeet moved first among mainland vendors on the sidecar/SST full chain — betting that the architecture change reshuffles supplier share before Delta, at about 41% today, consolidates it. The bet is funded internally: appliance controls, 37.9% of revenue and declining, bankroll R&D held near 11–12% of revenue for a decade.

## Style: `equity-research` — Sell-Side Research Note

The voice of a broker initiation/update note: thesis-led, "we" voice, debates framed bull-versus-bear, catalysts dated. A natural fit for earnings-driven refreshes.

### Rules

1. **Banner first** — company + ticker + a one-line stance ("Positioning: constructive, execution-gated"). The stance is analytical framing, **never investment advice** — a note at the top of any styled dossier states this
2. **"We" voice** — "We believe / We expect / In our view"; the analyst persona owns every judgment
3. **Thesis paragraph up top** — 2–3 sentences stating the core view and what it depends on
4. **Key debates** — the 1–2 questions that decide the story, each framed "Bulls point to X; bears counter Y", with our lean stated
5. **Catalysts carry dates** — every forward-looking claim is pinned to an event and date
6. **Risks enumerated plainly** — no burying; guarantee quotas, dilution, and margin mix belong in the open
7. **Estimates honesty** — consensus is quoted with its source; no manufactured numbers (schema rule, restated because this style tempts violation)

### Mock-up — Megmeet excerpt

> **Megmeet (SZSE: 002851) | Power electronics | Positioning: constructive, execution-gated** *(analytical framing, not investment advice)*
>
> **Thesis.** We view Megmeet as an incumbent-funded option on the 800VDC data-center power transition. The mature appliance-controls base (37.9% of FY2025 revenue) funds an R&D program held at 11–12% of revenue, and management has knowingly traded near-term earnings — ex-non-recurring profit fell 93% in FY2025 — for early position in NVIDIA's next power architecture. The option pays if 800VDC racks scale from 2027 and Megmeet converts its GB200 design-in into volume share.
>
> **Key debates.** *Can a mainland vendor take share in a Taiwanese-held market?* Bulls point to Megmeet being the only mainland-China power supplier NVIDIA named for GB200 NVL72, plus trade-press reports of it displacing Lite-On as the #2 power-shelf source; bears counter that Delta holds ~41% of a market that is ~74% Taiwanese, and that the displacement reports are unconfirmed by the company. We lean constructive on the architecture bet but note the company itself called AI-DC revenue immaterial through FY2025 — the gap between narrative and recognized revenue is the widest we cover in the power-supply group.
>
> **Catalysts.** H1 2026 results (~Aug 27, 2026) — the first period in which AI data-center revenue must visibly materialize; consensus embeds a roughly six-fold FY2026 profit rebound. First domestic hyperscaler volume delivery, guided for 2026. Industry 1 MW-rack adoption, projected from 2027.
>
> **Risks.** Guarantee quota above ¥6B (>50% of net assets, largely to leveraged subsidiaries); H-share dilution from the pending A+H listing; EV/rail growth (+109%) at 15.3% gross margin diluting mix; FY2025 operating cash flow already negative (−¥139M).

## Style: `intel-briefing` — Intelligence Community Briefing

The dossier as an IC-style assessment: BLUF, numbered key judgments with explicit confidence levels, strict fact/assessment separation, indicators to watch. The confidence-level machinery maps directly onto the field-note 0–100 confidence bands (75–100 → high, 40–74 → moderate, 0–39 → low), which is a unique advantage of this style for a "dossier" app fed by first-hand intel.

### Rules

1. **BLUF** — the `summary` opens with a single bolded "BOTTOM LINE UP FRONT" sentence carrying the entire takeaway, then compressed background
2. **Key judgments are numbered and confidence-tagged** — `strategyRead` becomes KEY JUDGMENTS, each bullet opening with "(High/Moderate/Low confidence)" and using "We assess that…" constructions
3. **Facts and assessments never mix** — reported facts cite their basis inline ("per company filings", "per trade press"); assessments are always flagged as such. Collection gaps are stated explicitly ("Collection gap: …")
4. **Indicators to watch** — forward-looking content becomes a tripwire list: concrete, observable events with dates, each tied to what it would confirm or refute
5. **Terse and unadorned** — no wit, no color, no rhetorical flourish; short declarative sentences; the style's authority comes from discipline
6. **Field-note integration** — developer field notes surface as "first-hand reporting" with their confidence band translated to the IC scale (still never cited as public sources)

### Mock-up — Megmeet excerpt

> **BOTTOM LINE UP FRONT:** Megmeet is deliberately sacrificing near-term profit to buy early position in NVIDIA's 800VDC data-center power architecture ahead of the 2027 rack transition; whether AI data-center revenue materializes at scale becomes verifiable with the 27 August 2026 half-year report.
>
> **BACKGROUND.** Shenzhen-based power-electronics manufacturer, six business groups, FY2025 revenue ¥9.40B (+15.1%, ~40% overseas) per SZSE filings. Founded 2003 by Huawei Electric and Emerson Network Power alumni. FY2025 net profit fell 66.6% to ¥146M; operating cash flow negative for the first time.
>
> **KEY JUDGMENTS**
> 1. **(High confidence)** We assess Megmeet holds a genuine early-mover position in 800VDC rack power. Basis: NVIDIA publicly named it a GB200 NVL72 power vendor (Oct 2024) — the only mainland-China supplier listed — and it demonstrated the full sidecar/SST chain at OCP (Oct 2025).
> 2. **(Moderate confidence)** We assess the FY2025 profit collapse reflects deliberate investment rather than business deterioration. Basis: R&D held at 11–12% of revenue, concurrent capacity build-outs (Thailand phase II, Dallas test lab), and management's own attribution; the negative operating cash flow partially cuts against this judgment.
> 3. **(Low confidence)** Trade press reports Megmeet has displaced Lite-On as the #2 NVIDIA power-shelf source behind Delta (~41% share). The company has not confirmed; treat as unverified market reporting.
>
> **Collection gap:** no independent consensus existed for FY2024 or Q3 2025 results; "expected" fields in the financial record are left empty rather than reconstructed.
>
> **INDICATORS TO WATCH**
> - *27 Aug 2026 — H1 report:* AI-DC power revenue recognized at scale would confirm Judgment 1's commercial conversion; another immaterial quarter would indicate the ramp has slipped.
> - *2026 — first domestic hyperscaler volume delivery* (company guidance): confirmation would validate the mainland demand leg independent of NVIDIA.
> - *From 2027 — industry 1 MW-rack adoption:* slippage of the architecture transition itself would defer the entire thesis.

## Style: `smart-brevity` — Axios Smart Brevity

The dossier compressed into axiom-led scannable form: one-line lede, bolded standard axioms, single-sentence bullets. Best when the developer wants dossiers to be readable in 90 seconds on a phone before walking into a meeting.

### Rules

1. **One-sentence lede** — the single most important thing about the company, bolded, first
2. **Standard axioms in fixed order** — **Why it matters** → **The big picture** → **By the numbers** → **Between the lines** → **What's next** → **The bottom line**. Skip an axiom only when genuinely empty
3. **Bullets are one sentence each** — no bullet runs to a second sentence; numbers ruthlessly rounded (¥9.4B, not ¥9.403B)
4. **"Between the lines" carries the analysis** — the strategyRead insight compressed to 1–2 bullets; speculation flags survive compression ("unconfirmed")
5. **No paragraph exceeds two sentences** — if it does, it becomes bullets
6. **Depth lives elsewhere** — this style trades completeness for speed; the schema's data fields (specs, financial tables, sources) still hold the full record beneath the prose

### Mock-up — Megmeet excerpt

> **Megmeet is betting its appliance-business profits on becoming NVIDIA's mainland-China power supplier.**
>
> **Why it matters:** It's the only mainland-China power vendor NVIDIA has named for GB200 racks — in a server-power market still ~74% Taiwanese-held, with Delta at ~41%.
>
> **The big picture:** The AC-to-800VDC rack transition starting ~2027 could reshuffle supplier share, and Megmeet moved first among mainland vendors on the full sidecar/SST chain.
>
> **By the numbers:**
> - ¥9.4B FY2025 revenue, +15%.
> - Net profit −67%; ex-one-offs −93%.
> - Operating cash flow negative for the first time.
> - R&D: 11–12% of revenue for a decade.
>
> **Between the lines:** The profit collapse is the strategy — the declining appliance business (38% of revenue) is funding the AI-power push, and trade press says Megmeet is displacing Lite-On as the #2 NVIDIA power-shelf source (unconfirmed).
>
> **What's next:** H1 results ~Aug 27 — the first hard test of a consensus that embeds a roughly six-fold FY2026 profit rebound.
>
> **The bottom line:** Strong architecture bet, unproven revenue.

Developed by: LightAISolutions
