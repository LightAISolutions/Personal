# WP-11f — decisions and defaults (core and Mini App: compare outlines and days)

Brief: `helpers/prompts/TG-PHASE-11.md` (WP-11f, wave 2 rules). State, checks and REQUESTs: `helpers/status/WP-11f.md`.

## Process
1. **Ownership.** Only WP-11f paths are edited: `packs/tour-guide/gas/*`, `helper.json`, the pack `README.md`, `helpers/SPEC.md`, the two new schemas, the `outline` / `day_versions` entries of `schemas/index.mjs` and `tour-guide-checks.mjs`, `live-site-pages/helper-app.html` with its version file and changelog, core/GAS/app/payload tests and new test files. journey/, planner/, estimator/ and fixtures/ (WP-11e) are untouched; what they must produce is a REQUEST.
2. **`gas/00_common.js` is edited** although its header says work packages leave it alone: `gas/*` is this WP's path in §16, and the routing table (request kind → routine) lives only there. The edit adds `outline` and `day_versions` to the PLAN routine and nothing else.
3. **Fixtures are invented** (a made-up town, Port Sorrel; dates in 2031; `example.com` links). No network: the Playwright test stubs every request and fails on any foreign one.
4. **Old tests restored.** The first version of this WP made three earlier tests (plan, e2e) tap ⏩ because Done choosing asked for outlines; with the journey off by default those tests are back to their original text (✅ Done choosing), and the journey tests turn the switch on in their setup.
5. **Backward compatibility is tested, not assumed.** Every old payload test passes unchanged; an old digest day (no Phase 10/11 field) renders exactly as before in the app; old flows with no `outline`/`versions` stage finish as before; `shortlist.done` keeps its old answer and only adds `stage` for the journey stages.

## When the journey runs
| Default | Value | Reason |
|---|---|---|
| Outlines | a dated trip of 3–31 days (`TG_JY.OUTLINE_MIN_DAYS` 3, `MAX_DAYS` 31) | Fewer than 3 days leave nothing to arrange; past 31 the grid is unreadable on a phone and the payload nears its size limit. |
| Day versions only | a dated trip of 1–2 days | The outline step adds nothing; going straight to versions still offers a choice. |
| Straight to the plan | undated trip, longer than 31 days, the switch off, or ⏩ Plan straight away | The old path, unchanged, so the owner is never stuck while the routine cannot answer the new kinds. |
| `tg_journey` | **off by default** — on only when the setting is exactly `on` (case and spaces ignored); unset or any other value is off | Coordinator follow-up: the live core redeploys from main on the next push, but the private routine answers `outline` / `day_versions` only after WP-11h's update; with the journey on by default the owner's next ✅ Done choosing would stall at the outline stage. The owner switches it on after the private update. (First version of this WP: on unless `off`.) |
| `/journey on\|off` | built like `/smart on\|off`: the owner-only command registry (the core routes commands from the owner's chat only), `settingSet(…, 'owner /journey')`, `audit('tg_journey', on\|off)`, help text; no argument shows the state in one line and how to switch; `on` says it needs the private routine's Phase 11 update and that ⏩ still plans as before | One pattern for the owner's switches. |
| While off | `/outline`, `/versions`, the `ol:` / `dv:` buttons (pick, replace, build) and the app's `outline.choose`, `versions.get`, `versions.choose`, `versions.done` answer the one line "Outlines and day versions are off — /journey on turns them on." and send no request; ⏩ (`ol:<tk>:d`) still works | The check sits in the shared actions (`tgJyDoChoose`, `tgJyDoPick`, `tgJyDoReplace`, `tgJyDoBuild`), so the chat, the flow and the app cannot drift; ⏩ is the old plan request and must stay available. Envelopes that still arrive (answers to requests sent while on) are stored and shown as before, their buttons refusing while off. |
| `journey.get` while off | answers `ok` with `on: false`, `text`, `mode: ''`, no outline and no days (`on: true` when on); the app shows only "Outlines and day versions are off" and "Send /journey on in the chat to turn them on." | A read is not refused: the app needs to tell "off" from "nothing yet" (`mode: ''` alone also means an undated trip). An answer without `on` (the old core) behaves as before, so the page needs no new version: v01.07w is unreleased and keeps its number. |
| ⏩ | flow button value `direct`, callback `ol:<tk>:d`, the adopt seed `direct` | One word for the same thing in each place. |

## Chat and callbacks
| Default | Value | Reason |
|---|---|---|
| Callback formats | `ol:<tk>:<tag4>:<A|B|C>`, `ol:<tk>:d`, `dv:<tk>:<tag4>:<mmdd>:<K|rK>`, `dv:<tk>:b` | The trip key and a 4-character build tag keep the worst case near 52 bytes, under Telegram's 64. |
| Build allowed | once any date has versions; the Build message is sent when every date is ready | The owner may build early (missing days are planned freely); the prompt waits so it is not sent half way. |
| Choosing with no flow | uses the picks of every shortlist round | `/outline` after a restart still has the owner's choices. |
| Stale builds | the newest outline drives the state; a tap or envelope for an older build is refused ("stale") and the dropped request id logged | Two outlines in flight must not mix. |
| Re-delivery | an envelope for the same build keeps a choice that still fits | A routine retry must not undo the owner's tap. |
| Builds kept | 6 per trip (`KEEP_BUILDS`) | Enough for a few rounds and `/versions` on planned days; the sheet stays small. |
| Replace mode | a day that is planned while no flow is at `outline`/`versions` | Then choosing another version can only mean replanning that day. |

## Requests to the brain
| Kind | Shape | Reason |
|---|---|---|
| `outline` | `{trip, dates, picks, later, skip}` | What the shortlist produced, so the outline uses only the owner's places. |
| `day_versions` | the above plus `outline {build_id, base, mix?}` | The routine builds the days of the chosen outline (with days taken from others). |
| `plan` | adds `outline?` and `versions?: [{date, build_id, key}]` | The plan follows the choices; both are optional so the old shape is still a plan. |
| `replan` | adds `alternative {date, build_id, key}` | Replace one planned day with a stored version. |
| Routing | all on the PLAN routine, each carrying `trip_update` | One routine already knows the trip; no new fire URL to configure. |

## App
| Default | Value | Reason |
|---|---|---|
| Operations | `journey.get`, `outline.choose`, `versions.get`, `versions.choose` (`replace`), `versions.done` | Each calls the same function as the chat, so the two stay in step. |
| Refusals | status by reason (400 / 404 / 409) with the chat's sentence as `text` | The app shows the same words as the chat; the shell's `why()` falls back to `text`. |
| `shortlist.done` | adds `stage` only for `outline` / `versions` | Old answers unchanged; the app opens Compare only when it applies. |
| Note guard | applied on the server in `trip.digest` (`tgAppNote` → `tgCmdDayNoteGuard`) | One rule for chat and app; the key is unchanged and a value changes only when a sentence conflicts. |
| Compare in the nav | third item, after the shortlist | It is the next step after choosing places. |
| Suggested vs chosen | "Suggested" for the brain's `chosen` (or the first version); "✓ Chosen" for the owner's | The owner must see which choice is theirs. |
| Replacing a day | asks `showConfirm` first | It discards a planned day. |
| Rebuild | "Rebuild my plan" when every day is planned and no flow is open | The same button, worded for what it does then. |
| Old day cards | a day with no Phase 10/11 field keeps the old layout exactly | Old digests must display as before. |
| Leg links | the link sits on the leg's text (`<a>` with an https href), not a pill | Like the chat; a pill per leg crowds a phone screen. Non-https links show as text. |
| Wording | stop minutes as the chat's `tgCmdMinutes` ("1 h 18"), legs and spare time as `tgCmdDaySpan`; about-times rounded to 15 min | The app reads like the chat card. |
| Page version | v01.07w | One bump for this WP's page change. |

## Coordinator changes at the wave-2 merge
The merge's probe ran the whole journey on invented data and found two ways it could stall; both were fixed in this WP's files with tests (`pack_tour-guide_{gas_journey,journey_payloads}.test.js`, the Compare screen test and `pack_tour-guide_phase11_wave2_e2e.test.js`).

| Default | Value | Why |
|---|---|---|
| A day with one way to go | `day_versions` carries 1–3 versions (schema, `checkDayVersions`, the core mirror); one version is shown without buttons ("one way to go, nothing to choose"); `/versions` and the delivery line read in the singular; the app shows "One way to go this day — the plan uses it as it is." with no choice button | The build offer waits until every date has versions; a free day or a tiny pool came with none, so a trip with such a day never reached 🧱 Build my plan. |
| A trip with one way to shape it | `outline` carries 1–3 options; while the flow waits for outlines, a one-option outline is taken as it is ("✅ Taken as it is: only one way to shape these days came out.") and the day versions are asked at once; outside that wait ✅ A or `/outline A` takes it; the app titles it "Outline · one way to shape the trip" with Take this outline | A `null` outline stalled the flow at the outline stage; a choice between one thing is no choice. |
| Page version | still v01.07w | The page is unreleased; these changes ride in the same first release. |

## Heads-up
The private repo's current pin cannot answer `outline` / `day_versions` until WP-11h re-pins it, so the journey ships switched off. After the re-pin the owner sends `/journey on`. If it is switched on too early, a trip that reaches the outline stage waits; the waiting card offers "⏩ Plan straight away instead", and `/journey off` puts later trips back on the old path.

Developed by: LightAISolutions
