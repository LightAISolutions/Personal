# WP-4b — prefs-build, place-notes, brochure-build: decisions

Every default these three skills picked, and why. Coordinator-fixed design points (`SHARED.md`, `WP-4b.md`) are followed as written and not repeated here.

## Shared
1. **Extra `## Steps` section.** Each SKILL.md has the six required sections in `skills/README.md` order and a numbered `## Steps` section between Inputs and Output, as `AssistantBrain/skills/ledger-extract/SKILL.md` does; the routine needs the order of tool calls spelt out.
2. **Drivers write the payloads.** Each driver writes the payload the skill stamps (`notice.json`, `reply.json`) so the wording is deterministic and tested in the dry run; brochure-build's reply needs the Drive links the routine gets only after `create_file`, so the routine writes that one (format fixed in the SKILL.md).
3. **Request answered by `in_reply_to`.** prefs-build answers a `prefs` request with a `notice` that carries `in_reply_to` (SPEC §2: any envelope naming an open request marks it answered), because the brief fixes the type as `notice` until `prefs_review` exists.
4. **JSON examples carry no `Developed by` line** (JSON has no comments); every `.md` and `.mjs` file does. `routines/*.prompt.md` carry only the prompt text, per the brief.
5. **Scratch paths** in committed example outputs are replaced with `<scratch>`.

## prefs-build
6. **Library, not CLI.** The driver calls the prefs kit's library (`check`, `ingest`, `review`, `buildCandidates`) instead of three CLI runs, so one process yields the review and the support counts the notice needs. Paths: `--held <repo>/quarantine/prefs`, ledger = the kit's default beside `profile/travel-profile.md` (`profile/travel-profile.decisions.json`), vocabulary `travel`.
7. **Salt.** `--salt-env` (default `PREFS_REF_SALT`) is read the way the kit's CLI reads it; unset is not fatal (the kit allows it) but the output says `salted: false` and the SKILL.md tells a live run to log it.
8. **Review size.** `--max 20` (the kit's ceiling) so one notice can list every proposable candidate; the notice then lists held-back candidates with the kit's reason; total ≤ 40 candidate lines and ≤ 3900 characters (Telegram split point), the rest summarised as "+N more".
9. **Notice wording.** Each line is verb-first ("Confirm, edit or reject …") with the kit's own statement, support count, opposing count, rivals and the `cid`; the owner answers `confirm <cid>` / `edit <cid> <value>` / `reject <cid>` in chat until the Phase 5 buttons exist. Suspect-only candidates are named (value only, never an excerpt) so the owner sees that something tried to plant a preference.
10. **Dedupe key** `prefs-review-<batch_id>`: the kit's batch id is a hash of the candidates and their evidence counts, so a rerun over unchanged evidence is dropped by the core within 6 h.
11. **Source kinds.** The driver accepts every kind the kit accepts (the kit fixture uses `seed` and `owner-chat`); the SKILL.md restricts the routine to `gmail`, `calendar`, `drive`, `takeout`.
12. **Windows and caps.** `window_days` default 365 (README contract), capped at 730 by the skill; ≤ 80 Gmail threads, ≤ 200 events, ≤ 20 Drive files, ≤ 200 evidence records per run — enough for a year of trips, small enough for one run.
13. **Not built here:** `apply` of the owner's decisions (`prefs_decisions` request, Phase 5) — the only writer of `profile/travel-profile.md` and `profile/travel-profile.decisions.json`. Note: the seeded dry-run profile is hand-written, so the kit's `apply` would refuse to overwrite it; a real profile is created by the first `apply`.

## place-notes
14. **Explicit `places`** are listed whatever their note age (the owner asked, so a current note is refreshed) and whatever their status except `rejected`; unknown slugs are reported (exit 1) and the reply names them.
15. **Current note** = a `places/<slug>.md` note for the same `place_id` whose `last_researched` is ≤ `--max-age-days` (180) before `--today`; the routine passes today in the owner's time zone.
16. **Note gate in the writer:** schema (`place-note`), `place_id` among the trip's places, at least one source, and no instruction-shaped text (research kit `scanText` over every text field, pairings and source titles/supports). A refused note is reported, never half-saved.
17. **Place record** saved with the note is the trip's current Place entry; the trip file is not touched (it belongs to `trip-research` / `plan-days`), so `note_path` is not set.
18. **"Could not source"** = the trip's scheduled and saved places that still lack a current note after the write — computed by the writer so the reply cannot drift from memory.
19. **Research budgets** 20 searches / 40 fetches / 30 min per run, one research run file shared by all places, priority 1 places first.

## brochure-build
20. **Snapshots fetched** for every non-rejected place of the plan (cards cover stops, meals, legs, warnings and Later items); a failed place is a warning, not a failure (the card renders without Google details). The store is purged in a `finally`, so content never outlives the run even on an error.
21. **`verified_on`** = the fetch date in the trip's time zone (the brochure's dates are trip-local); `built_on` from the trip's `builds[]` entry, else the plan.
22. **`show_google_content`** precedence: request (`--show-google`) > trip `profile_overrides.show_google_content` > `true`.
23. **Exit 3 = HTML only**, the brochure kit's `build` convention; the driver's other codes follow the shared 0/1/2 contract. The HTML is always written by the driver (`renderPlanPdf` writes only the PDF).
24. **Drive writes** use `create_file` with `disableConversionToGoogleType: true` (HTML as `textContent`, PDF as `base64Content`); a second brochure of the same build is a second file (no overwrite, no delete — reader lane).
25. **Plan check:** the downloaded plan must pass the pack's `plan` schema and name the requested trip; a build missing from `builds[]` is a warning only.
26. **Dry-run plan helper** lives in `skills/brochure-build/examples/make-dry-run-plan.mjs` (development only) until the coordinator's `plan-days` driver is merged; it also sets the statuses place-notes needs.
27. **Answers file trust:** same as an owner decisions document — only the core's `req_<id>.json` (or its `payload.interview`), copied unchanged; the driver refuses an envelope that is not a `request` from `tour-guide-core` with `payload.kind` `prefs`, a version other than 1, an empty list or more than 200 answers. A bad single answer (unknown key, bad qid, kind or polarity, or a value the vocabulary refuses) is left out and listed; the rest proceed.
28. **Evidence mapping:** one record per answer — `source_kind` `owner-chat`, `source_ref` `interview:<qid>` (hashed and salted by the kit), `date` = the day of `decided_at` (UTC), `excerpt` = `Interview <kind> (<qid>): <dimension> <polarity> <value>` so the kit's injection scan sees the owner's words. Picks and text answers go through the same ingest as connector evidence, in one call.
29. **decided_at:** `--decided-at`, else the request envelope's `created_at`, else now; each pick adds its answer index in milliseconds, so the later answer wins on a single-value dimension and a re-run of the same request is "already applied" (byte-identical profile).
30. **Order:** ingest → apply (picks) → review, so confirmed picks are never re-proposed. Decisions documents are chunked at the kit's 50 and written to `--out` as `decisions-<n>.json`.
31. **A pick is not confirmed** when its own record is `injection_suspect`, or when the candidate's stance (the kit's majority of clean evidence) differs from the pick's polarity — other evidence outvotes or ties a "no" — because confirming would save the opposite stance; it stays held for the owner's review. "No" picks on single-value dimensions are refused by the kit ("not confirmable") and reported.
32. **Profile refusal** (hand-edited, not a kit profile, over the token cap): the kit writes nothing; the driver reports `interview.profile_refused`, the notice leads with it, exit 1; the routine logs `profile refused` and never forces, edits, moves or deletes the profile.
33. **Notice size:** one Telegram message — ≤ 40 lines in all and title + text ≤ 4000 chars after HTML escaping (under `TG_MAX_CHARS` 4096). Drop order: held-back lines, per-pick lines, then review items from the end, each behind a "+N more" line. The evidence-only notice is unchanged by this rule on the fixtures.
34. **Connector sweep with answers:** a `prefs` request with `payload.interview` still runs the connector reads; both inputs go to one driver call (either alone is accepted).

Developed by: LightAISolutions
