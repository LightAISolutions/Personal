# Place facts — `helpers/packs/tour-guide/facts/`

What a place's **own** site says about a visit (Contract C11 `place.facts`, WP-11b): visit length, last entry, closing
time, closed weekdays, booking, price, payment, the gate to use and a dated menu check. Research fills it, the planner
reads it, and the digest, the app and the brochure show it. **Library only**: pure functions, no call, no file write and
no clock (`now` is an argument). Defaults and their reasons: `helpers/decisions/WP-11b.md`.

| File | Exports |
|---|---|
| `facts-normalize.mjs` | `normalizeFacts(raw) → { ok, facts, errors }`: trims strings, drops nulls, sorts weekdays and keeps each once, lower-cases `menu.fits`, then the place schema's `facts` subset plus `checkFacts`; unknown keys are refused. `factsSchema()`, `clean(v)` |
| `facts-lines.mjs` | `factsLines(facts, { now?, diet? }) → { facts_line?, booking_line?, price_line?, menu_checked? }`, each line ≤ `LINE_MAX` (160), whole clauses dropped from the end to fit; only keys with something to say. `menuLine(facts, { now?, diet? })` → `'Menu checked 5 Apr 2031 (may have changed): partly fits vegetarian — …'` or `''` |
| `facts-check.mjs` | `factsStale(facts, now) → { facts, menu, any, facts_age_days, menu_age_days }` (facts after 90 days, a menu check after 30; an unknown date is stale). `factsConflict(facts, googleHours, date) → { conflict, items: [{ kind, own, google, text }] }`, kinds `closed_day`, `google_closed`, `close_time` (more than 15 min apart), `last_entry_after_close`; unknown hours never conflict |
| `fixtures/facts-fixture-full.json` | Two invented records (`garden`, `restaurant`) carrying every field |

Tests: `helpers/tests/pack_tour-guide_facts.test.js`.

Developed by: LightAISolutions
