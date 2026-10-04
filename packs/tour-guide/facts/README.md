# Place facts — `helpers/packs/tour-guide/facts/`

What a place's **own** site says about a visit (Contract C11 `place.facts`, WP-11b): visit length, last entry, closing
time, closed weekdays, booking, price, payment, the gate to use and a dated menu check. Contract C12 (WP-12a) adds the place's name in the local script (`local_name`), its published `address` and its own train `access` notes (station, line, exit, walk minutes), for the morning message; `factsLines` does not show them (an old place's lines are unchanged). Contract C13 (WP-13b) adds `irregular: true` (its own site says it opens on irregular or posted days) and `irregular_note` (1–160, its own words, the stop's check line); `factsLines` adds "Opening days vary[: <note>]" only when `irregular` is set, and `factsConflict` raises no `closed_day` for such a place. Research fills it, the planner
reads it, and the digest, the app and the brochure show it. **Library only**: pure functions, no call, no file write and
no clock (`now` is an argument). Defaults and their reasons: `helpers/decisions/WP-11b.md`.

| File | Exports |
|---|---|
| `facts-normalize.mjs` | `normalizeFacts(raw) → { ok, facts, errors }`: trims strings, drops nulls, sorts weekdays and keeps each once, lower-cases `menu.fits`, then the place schema's `facts` subset plus `checkFacts` and (C12) `checkAccess` (no station and line twice); unknown keys are refused. `factsSchema()`, `clean(v)` |
| `facts-lines.mjs` | `factsLines(facts, { now?, diet?, timeZone? }) → { facts_line?, booking_line?, price_line?, menu_checked? }`, each line ≤ `LINE_MAX` (160), whole clauses dropped from the end to fit; only keys with something to say. `menuLine(facts, { now?, diet? })` → `'Menu checked 5 Apr 2031 (may have changed): partly fits vegetarian — …'` or `''` |
| `facts-check.mjs` | `dateOf(now, timeZone?)` (Phase 13, A15: the local day in `timeZone`; without one, the UTC day). `factsStale(facts, now, timeZone?) → { facts, menu, any, facts_age_days, menu_age_days }` (facts after 90 days, a menu check after 30; an unknown date is stale). `factsConflict(facts, googleHours, date) → { conflict, items: [{ kind, own, google, text }] }`, kinds `closed_day`, `google_closed`, `close_time` (more than 15 min apart), `last_entry_after_close`; unknown hours never conflict |
| `fixtures/facts-fixture-full.json` | Two invented records (`garden`, `restaurant`) carrying every field |

Tests: `helpers/tests/pack_tour-guide_facts.test.js`.

Developed by: LightAISolutions
