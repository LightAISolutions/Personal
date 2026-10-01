# Phase 4b — Delta for the running session (the v01.16r amendment: places repository, learning loop, sixth envelope type)

> For the Phase 4b coordinator session that started from `helpers/prompts/TG-PHASE-4B.md` **before** the v01.16r plan amendment merged (commit `eac8f73`, 2026-10-01). The amended prompt is now on `main`; this file lists what changed so nothing is missed. Exact wording: `git diff c38ee2e eac8f73 -- helpers/prompts/TG-PHASE-4B.md`. Plan: `repository-information/TOUR-GUIDE-BUILD-PLAN.md` §5.10, §5.11, §10 decisions 20–21, §11c. Relayed by the coordinator; apply it on top of the prompt you are running, change nothing else.

## 1. Why
The owner asked for a personal repository of researched places that survives across trips, a re-check of known places when a destination is planned again, and a way to browse alternatives mid-trip; and for Tour Guide to learn from what he picks. The amendment puts the data side of both into **this phase** (WP-3d and WP-4d), because `tools/tg-memory.mjs` is the sole reader and writer of `places/` and the payload schemas are yours. Phase 5 adds the chat commands (`/places`, `/review`) on top.

## 2. WP-3d additions (engine, `Personal`)
- `place` schema gains `destination` (slug), `history[]` of `{ trip, on (date), event: shortlisted | chosen | later | skipped | scheduled | visited | rated_up | rated_down | checked, note? ≤ 120 }`, `last_researched` and `last_verified` (dates). `history` is appended, never rewritten.
- Shortlist items gain `seen_before?: { trip, on, outcome: chosen | later | skipped | visited }`, `changes?: [ ≤ 120 ]` (what differs since we last looked) and `dims?: [ { dimension, value } ]` (the vocabulary dimensions the item speaks to — the learning loop's evidence key).
- A **sixth payload schema** `tour-guide-places-digest` for the envelope type `places_digest`: `destination, places[ { slug, name ≤ 120, area, category, tags[], status, last_trip, last_researched, last_verified, note_line ≤ 160, maps_url, history_summary ≤ 120 } ]`, ≤ 60 000 characters, `additionalProperties: false` — so a payload carrying hours, rating, review count, address, website or business status is **rejected**. `helper.json` `envelope_types` gains `"places_digest"`; `envelope.mjs --pack tour-guide` validates it.

## 3. WP-4d additions (skills, `TourGuide`)
- `tools/tg-memory.mjs` lists `places/` by `destination` and appends `history` entries (one command each).
- `trip-research` `scope: new`: **re-check before re-research** — for every known place of the destination, a fresh build-scoped snapshot plus the official site when our own claims are older than `RECHECK_DAYS` (default 90); known places go to the top of the shortlist with `seen_before` and `changes`; a place found closed goes to the Later list with the reason; only then research new candidates.
- `trip-check` answers a new request kind **`places`** (`scope: check | list`, `destination`, `slugs?`) with one `places_digest`, and runs the same check weekly on upcoming trips (digest only when something changed).
- `plan-days` writes `chosen | later | skipped | scheduled` history entries, appends choice evidence to the prefs kit with `source_ref` `choice:<trip>:<slug>` through its `ingest` command (`--min-support 2` — positives confirm, negatives are held until a second trip agrees), and emits a `places_digest` for the destination after the plan.
- `prefs-build` accepts `payload.review = { trip, items: [ { slug, rating: up | down | skipped, calibration?: longer | shorter | right } ] }` (Phase 5's `/review`) as evidence of the same kind.
- `skills/README.md` request-kind table: the `places` kind, the `review` payload, the six envelope types; `routines/*.prompt.md` and `routines/README.md` accordingly.
- Dry run (`tools/journey-dryrun.mjs`): add a **second `/plan` for the same fixture destination** — the known places must come back first with `seen_before`, one fixture place flipped to closed must land in Later, and every `places_digest` must validate.

## 4. Steps
- **Step 3 (owner input):** decisions 20 (repository shape and storage rule) and 21 (learning loop, held negatives) default — plan §5.10 and §10.
- **Step 4 (done when):** add — the second-trip dry run passes; **no Google field** (hours, rating, address, website, business status) is written into `places/`, `trips/` or a `places_digest` — grep the fixtures' outputs.
- **Step 6 (hand-off):** `helpers/decisions/TG-PHASE-4B.md` records the six schemas' paths, the Place and shortlist fields as built and the `places` request kind; the `FINALIZE (Phase 4b)` block of `helpers/prompts/TG-PHASE-5.md` already has rows for the sixth type, the `places` kind and the `ps` / `rv` callback prefixes — fill them in.

## 5. Terms
Store only our own dated research claims and the owner's choices. Google's hours, rating, review count, website, address and business status stay build-scoped in the snapshot (WP-2a rules). Place **names** are stored as today; whether they must come from a non-Google source is an open point for Phase 6's terms review — do not resolve it here.

Developed by: LightAISolutions
