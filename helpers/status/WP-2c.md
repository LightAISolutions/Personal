# WP-2c — Brochure kit · status

> Branch `wp-2c` (worktree `/home/user/wt-2c`), never pushed. Agent `hb-builder-fable` (Fable 5.1 · high), 2026-10-01.
> Report format per `helpers/prompts/TG-PHASE-2.md`; defaults in `helpers/decisions/WP-2c.md`.

## State: done — ready for the coordinator to merge and for the owner to rate the sample

Sample outputs for the owner (outside the repo, never committed): `/home/user/wt-2c-out/sample-brochure.pdf` (12 pages,
US Letter), `sample-brochure.html`, `cover.png`, `day-spread.png`, `place-cards.png`, and `shots/page-01..12.png`.
Rebuild any time with `node helpers/kits/brochure/index.mjs sample /home/user/wt-2c-out` (`--page a4` for A4: also 12 pages).

## Contract items (brief §2 row 2c)

| Item | State |
|---|---|
| Design tokens + type scale (`lib/tokens.mjs`), print CSS (`lib/css.mjs`) | done — Letter/A4 page specs, shared margins, modular scale, per-day hue rotation |
| HTML renderer, one self-contained document, seven sections | done — cover, at a glance, day spreads (rail + route sketch + aside), place cards, saved for later, practical, attribution |
| PDF step with the pre-installed Chromium through global Playwright | done — `lib/pdf.mjs`; in-browser paginator (`lib/paginate.mjs`) gives folios, page numbers, day tabs, "p. N" cross-references |
| Google Maps attribution block per the Places policies | done — logo + data statement + per-review author credit and review link + sources ledger |
| JSON Schema + validation with clear errors | done — `schema/brochure.schema.json`, own validator (no dependency), semantic checks, pointer paths |
| Escaping, no script, no network | done — tests assert no `<script`, every `src`/`href` is data:/#/http(s)/mailto, hostile strings escaped, unsafe URLs dropped |
| Fonts from local source with licence | done — Bitstream Charter (X11 Type 1 → WOFF2), `assets/fonts/NOTICE-charter.txt` |
| Tests pass without Playwright/Chromium and on CI | done — 4 files, 9 tests (63 in the suite); the PDF half of the CLI test skips itself when `pdfAvailable()` is false |
| Screenshot-reviewed design iteration | done — every page of the Letter build reviewed; A4 cover, a day spread and the cards page reviewed |

## Checks (last run before the final commit)

`node --test helpers/tests/` 63/63 · `node helpers/tools/bundle.mjs --all --check` ok · `node helpers/tools/boundary-check.mjs` clean.

## Findings for the coordinator / owner

1. `node helpers/kits/<kit>/ <cmd>` does not run (coordinator note from WP-2a) — the kit documents and tests `node helpers/kits/brochure/index.mjs <cmd>`.
2. The kit keeps its fonts and logo under `helpers/kits/brochure/assets/` (fonts 4 × WOFF2 ≈ 100 KB binary). If SPEC §16 wants kits free of binaries, the alternative is a system-serif stack only (`--no-fonts` already does this); the decisions file explains why Charter is embedded.
3. The repo-wide basename rule: `helpers/status/WP-2c.md` and `helpers/decisions/WP-2c.md` share a basename by the spec's own naming, like `TG-PHASE-1.md`; nothing else collides.
4. Requests: none. No edits were needed outside the WP-2c paths.

Developed by: LightAISolutions
