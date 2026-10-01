# Development sessions — rules

> `CLAUDE.md` is dual-mode. Routine runs follow its ROUTINE MODE section; **every other session — building, fixing, reviewing, bumping the framework pin — follows this file.** Ignore the routine persona here. This repo has no version bookkeeping, changelog or response formatting; the public framework repo's rules apply there, not here.

## Start of every session

1. Read `repository-information/SESSION-CONTEXT.md` (`## Latest Session`) and the prompt you were given. The single build tracker is in the public repo: `{{FRAMEWORK_REPO}}` → `helpers/BUILD-STATE.md` and `helpers/decisions/` — read them there when that repo is attached, or on GitHub.
2. Run `git status` and `git branch --show-current`. Work on the session's own `claude/*` branch only. Uncommitted changes you did not make are a previous session's leftovers: ask the owner, do not commit them.
3. Check that the framework pin is present (`vendor/helpers/SPEC.md` exists). If not, pin it first (`vendor/helpers/README.md`).

## Branches and commits

- Never push to `main`. Push the session's `claude/*` branch; the owner merges development branches (or the session merges after an explicit OK in chat). `merge-routine-memory.yml` ignores any branch that touches a non-memory path, so a development branch is never auto-merged.
- Commit messages carry no personal data: name files and behaviour, never a person, trip, place, account or anything from the owner's mail, calendar or documents.
- Nothing from the owner's data goes into `repository-information/`, `skills/`, `routines/` or commit messages. Fixtures and examples are invented; example e-mail addresses use reserved domains (`example.com`, `.invalid`).
- Secrets never enter this repo, private or not: bot token, admin secret, API keys, routine fire URLs and tokens live only in the core's Script Properties and the Claude environment's API credentials. If one is pasted into chat, do not write it anywhere.

## Memory paths belong to routines

`log/`, `quarantine/` and `{{MEMORY_DIRS}}` are written by routine runs. A development session edits them only when the owner asks in chat — for example promoting a `quarantine/` note into memory, or seeding a note the owner dictated. Never hand-edit `log/`.

## Dry runs

- Run a skill end to end in the session with invented fixtures. Write envelope payloads to a scratch directory outside the repo (the environment's scratchpad) and validate them with `node vendor/helpers/tools/envelope.mjs <type> <skill-name> <payload.json> --pack {{HELPER_NAME}}`. Do not write to the real Drive mailbox or call the wake route unless the owner asks for a live test.
- Never commit scratch files, fetched pages, `dist/` or anything under the ignored paths.

## `/update-helpers` — bump the framework pin

Routines never do this; only a development session does, at most once per session.

1. `before=$(git rev-parse HEAD)`
2. `git subtree pull --prefix vendor/helpers https://github.com/{{FRAMEWORK_REPO}}.git helpers-dist --squash` — fetches the current `helpers-dist` branch and commits the merge itself (a squash commit naming the upstream commit, plus the merge commit).
3. Review before accepting: `git diff --stat "$before" HEAD -- vendor/helpers`, then the full diff of what this helper's skills depend on (`tools/`, `kits/`, `packs/{{HELPER_NAME}}/`, `SPEC.md`). If the bump must not land, `git reset --hard "$before"`.
4. Smoke-test: `node vendor/helpers/tests/` if that directory exists. Fix nothing inside `vendor/helpers/` — a failure is reported upstream.
5. Push the session branch and tell the owner in one paragraph what changed (from which upstream commit to which).

## Never edit `vendor/helpers/` by hand

Every change to the framework — core, tools, kits, this helper's pack — is made in `{{FRAMEWORK_REPO}}` under `helpers/` and arrives here through `/update-helpers`. A local edit is lost on the next subtree pull and hides the fix from every other helper. The brain-side files (skills, routine prompts, this repo's `CLAUDE.md`) live here and are edited here.

## End of every session

- Run the `remember-session` skill (`skills/remember-session/SKILL.md`): it writes `repository-information/SESSION-CONTEXT.md`, commits `Remember session context` and pushes the session branch.
- Leave nothing uncommitted and nothing unpushed on the session branch.

Developed by: LightAISolutions
