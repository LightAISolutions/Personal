# vendor/helpers — pinned copy of the helper framework

This directory holds a pinned copy of the `helpers/` directory of the public framework repo `{{FRAMEWORK_REPO}}`, published there as the `helpers-dist` branch after every merge to `main`. Routines and development sessions in this private repo use the framework from here — `node vendor/helpers/tools/envelope.mjs`, the kits, this helper's pack and its tests — so a routine never needs the public repo attached, works offline, and keeps behaving the same until the pin is bumped on purpose.

## What is in it

Once pinned: the framework's `core/` (the Apps Script core, for reference — the deployed web app is built and deployed from the public repo), `tools/`, `kits/`, `packs/{{HELPER_NAME}}/` (this helper's pack: manifest, schemas, engine, fixtures), `tests/`, `SPEC.md` and the framework `README.md`. The `helpers-dist` branch carries no build-process files and no personal data.

## Pin it (first time, development session)

`git subtree add` refuses a prefix that already exists, and this placeholder README is in the way. Remove it in its own commit, then add the subtree:

```
git rm -r vendor/helpers && git commit -m "Remove vendor/helpers placeholder before the first subtree pin"
git subtree add --prefix vendor/helpers https://github.com/{{FRAMEWORK_REPO}}.git helpers-dist --squash
```

The squash commit's message records the upstream commit the pin points at. After this step the directory's contents, including its README, come from `helpers-dist`.

## Update it (`/update-helpers`, development session only)

```
git subtree pull --prefix vendor/helpers https://github.com/{{FRAMEWORK_REPO}}.git helpers-dist --squash
```

The pull commits the merge itself. Review `git diff --stat <previous HEAD> HEAD -- vendor/helpers` before accepting it, run `node vendor/helpers/tests/` if that directory exists, then push the session branch for the owner to merge. The full procedure, including how to back out, is in `repository-information/DEV-SESSION.md`. Routines never update the pin.

## Do not edit here

Nothing under `vendor/helpers/` is edited by hand. A change to the framework is made in `{{FRAMEWORK_REPO}}` under `helpers/` and arrives here through the next pull; a local edit is overwritten by that pull and hides the fix from every other helper.

Developed by: LightAISolutions
