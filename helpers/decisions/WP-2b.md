# WP-2b — Research kit: decisions and assumptions

> Phase 2 of the Tour Guide build. Brief: `helpers/prompts/TG-PHASE-2.md` (WP-2b), plan §5.2 / §5.3.
> No questions were asked; every assumption is recorded here. All data in fixtures and tests is invented.

| # | Choice | Default | Why |
|---|---|---|---|
| 1 | Budgets | searches 20, fetches 40, wall time 1800 s | Covers one place-cluster of research per run (a few searches, one or two fetches per place) with headroom. |
| 2 | Hard caps | 100 / 200 / 10 800 s; api records 200; refused log 50 | Stops a typo or a hostile page-derived value from creating an unbounded run; caps the run file (≤ 2 MB). |
| 3 | Failed calls count | yes | The call was made and cost time; not counting would let a failing site loop forever. |
| 4 | CLI enforcement point | record after the call, refuse with exit 3 | A CLI cannot see a routine's tool call before it happens; the first over-budget record is refused and logged, and the README tells the routine to stop. |
| 5 | Library enforcement point | before the injected call | An over-budget call is never made (tested by counting fake-web calls). |
| 6 | Wall time | from `started_at`, checked on every record | Simple and tamper-evident (the run file is schema-checked; `started_at` cannot move without a valid ISO time). |
| 7 | Ledger stores | sanitized excerpt ≤ 1000 chars, never the full page | Enough to audit "what it supported"; keeps untrusted text small. |
| 8 | Search result citation | `L00n.k` refs; a bare search id is refused | A search is many sources; citing the list would hide which snippet supported the fact. |
| 9 | Independence: publisher | registrable domain minus its public suffix | Brand mirrors on other TLDs (`.example` / `.invalid` / `.co.uk`) collapse. Collisions only make the rule stricter. |
| 10 | Suffix list | built-in short list of multi-label country suffixes + shared-hosting suffixes | No dependency on the Public Suffix List; unknown suffixes fall back to one label (stricter). |
| 11 | Independence: syndication | word 5-shingle Jaccard ≥ 0.6 on texts of ≥ 12 words; plus `--canonical` and `--derived-from` | Catches republished copies on unrelated domains; short texts (hours lines) are not compared to avoid merging honest agreement. |
| 12 | Label order | conflicting > unverified > stale > confirmed > likely > single-source | A contradiction must never be hidden by support; staleness beats agreement. |
| 13 | `confirmed` | ≥ 2 independent fresh groups, ≥ 1 containing a fetched page or api record | Two search snippets alone are summaries, not pages: they rate `likely`. |
| 14 | `likely` | 2+ snippet-only groups, or one group with an official source | An official page alone is the best single source but still one source. |
| 15 | Plan-ready | critical: `confirmed` only; non-critical: confirmed / likely / single-source | The two-source rule from the plan; `other` claims are critical only with `--critical`, and stay critical. |
| 16 | Staleness | hours/closed/tickets/price: page 365 d, fetched 30 d; duration: 1095 / 365; other: 730 / 90 | Hours and prices change seasonally; visit durations change slowly. A page without a date is judged by fetch age only. |
| 17 | Flagged sources | ignored for support and contradiction; kept for audit | "Flagged sources can never reach confirmed"; letting them contradict would let a hostile page block any fact. |
| 18 | Scanner bias | flag on doubt | A false positive costs one source; a false negative could steer a routine. Benign travel phrasing is pinned by tests. |
| 19 | Entities and invisible characters | decoded / removed before scanning and before storing | `&#105;gnore …` and zero-width splits would otherwise evade the rules. |
| 20 | Encoded payload threshold | 200 base64 characters | Longer than any URL token or hash a travel page shows; test payloads are generated at run time (no committed blobs). |
| 21 | Duration aggregation | median of mins / maxes; typical = median midpoint; 5-minute rounding; outliers beyond 3× / ⅓ with ≥ 3 mentions; conflict above 2× spread | Robust to one odd source; Phase 3 adds pace and interest on top. |
| 22 | `official` flag | caller-supplied only | A page claiming to be official is exactly what an injection would do. |
| 23 | CLI form | `node helpers/kits/research/index.mjs <cmd>` | Node does not run a directory's `index.mjs`; matches the coordinator's SPEC §16 fix. |
| 24 | Clock override | `RESEARCH_KIT_NOW` env var | Tests need fixed time; a routine has no reason to set it (README says tests only). |
| 25 | Run file | atomic write, mode 0600, schema-validated on load and save | A hand-edited budget or field is rejected (exit 1); a crash mid-write cannot corrupt the run. |
| 26 | Literal invisible characters | never in source; `\u` escapes only | Avoids Trojan-Source style review hazards in the scanner's own code and fixtures. |

Developed by: LightAISolutions
