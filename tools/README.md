# helpers/tools

Command-line tools of the helper framework. Each tool's own header comment has its usage; this file holds the longer guides.

## Branches

A **branch** is one feature of a pack, wired end to end:

```
/command ──▶ request kind { trip } ──▶ routine ──▶ (envelope type ──▶ handler ──▶ tab) ──▶ the owner
                                                                   └──▶ app ops ──▶ the app's screen
```

`helpers/tools/new-branch.mjs` writes the skeleton of a new branch and checks that any branch, generated or hand-built,
still has all its parts. It extends Tour-Guide-style packs, which provide `tgOpenKindRequest`, `TG_KIND_ROUTINE`,
`TG_APP_OPS` and the shared envelope helpers.

### The shape

| Part | Where | Left out with |
|---|---|---|
| Command, request kind, routing, help line | `packs/<pack>/gas/<NN>_<name>.js` (the core module) | — |
| Tab (one row per trip: `id`, `trip`, `received_at`, `payload_json`) | the core module (`registerSheet`) | `--no-tab` |
| Envelope type: core validator `tgEnvValidate<Type>` and a handler registered only while `helper.json` lists the type | the core module | `--no-envelope` |
| Schema (`additionalProperties: false`) | `packs/<pack>/schemas/<pack>-<type>.schema.json`, plus its entry in `schemas/index.mjs` | `--no-envelope` |
| Pack validator `validate<Type>Payload` and `build<Type>Payload` | `packs/<pack>/<name>/<name>-payload.mjs` | `--no-envelope` |
| The type in `helper.json` `envelope_types` | `packs/<pack>/helper.json` (appended, layout kept) | `--no-envelope` |
| App ops `<name>.get { id }` and `<name>.list {}` | `packs/<pack>/gas/<NN>_<name>_app.js` | `--no-app` |
| Pack folder: `index.mjs` (`BRANCH`), `README.md`, an invented fixture | `packs/<pack>/<name>/` | — |
| Tests: registration, the command, and (when there is an envelope) parity of the three validators and the handler, plus the app ops | `tests/pack_<pack>_<name>.test.js` | — |
| Private skill: `SKILL.md`, `<name>-start.mjs`, `<name>-finish.mjs` (they import from `vendor/helpers/…`) | `<private-out>/<name>/` | written only with `--private-out` |

**Numbers.** The core module takes the next free number in the pack's 10–29 band, then 41–99 when that band is full. It
needs only `00_common.js` loaded before it, because everything else it uses is called at run time. `--prefix NN` picks
any unused number from 01 to 99. The app file adds to `TG_APP_OPS`, so it must load after `32_app_api.js`: it takes
33–39, then 41–99.

**Routing.** The core module sets `TG_KIND_ROUTINE['<kind>'] = '<ROUTINE>'` when it loads. `tgKindRoutine` reads the
table when it is called, so `00_common.js` is never edited.

**With `--no-tab`.** There is no `registerSheet` and no store functions. The handler only tells the owner. The app ops
read nothing yet, and a `TODO (--no-tab)` says where to read from. The header asks you to say where the branch keeps its
data.

**With `--no-envelope`.** There is no schema, no validators, no handler, no parity test, and no entry in `helper.json`
or `schemas/index.mjs`. The private skill answers with a `reply` envelope.

### The command

```
node helpers/tools/new-branch.mjs <name> [--pack tour-guide] [--title "<Title>"] [--command /<cmd>] [--kind <kind>]
  [--envelope <type>] [--routine RESEARCH] [--tab <Tab>] [--no-app] [--no-envelope] [--no-tab] [--prefix NN]
  [--private-out <dir>] [--dry-run] [--force]
```

- `<name>` matches `[a-z][a-z0-9]{1,23}`. The defaults are: command `/<name>`, kind `<name>`, envelope type `<name>`,
  tab `<Name>s` (no second `s` when the name ends in one), routine `RESEARCH`, and the title `<Name>`.
- **Refusals.** The tool exits 2 and lists every clash when any of these already exists:
  - the command;
  - the kind (a `TG_KIND_ROUTINE` key, a kind named inside `tgKindRoutine`, or any literal `tgOpenKindRequest('…')`);
  - the envelope type (a core type, one with a handler, one in `helper.json`, or one in `PAYLOAD_KINDS`);
  - the tab (compared without case, because Sheet tab names ignore case);
  - a global the branch would define (for example `tgTripGet` for the name `trip`);
  - the branch's own files.
- **`--force`** rewrites only a branch this tool wrote, which it recognises by the `@branch` line. The same options
  give the same bytes, and a branch's own earlier files are ignored when looking for clashes.
- **`--dry-run`** prints every file the tool would write or change, and writes nothing.
- **`--private-out <dir>`** also writes `<dir>/<name>/`, the private skill: purpose, inputs, an example envelope, memory
  and the silence rule. Its two drivers do the plumbing around the one judgment step:
  - `-start.mjs`: request → input;
  - `-finish.mjs`: judgment → payload → the exact `tools/envelope.mjs` command, with `--dedupe-key <name>:<request id>`.

  Scratch files must be outside the repo.
- After writing, run `--check <name>`, then the branch's own test, `bundle.mjs --all --check`, and the whole suite.

### The check

```
node helpers/tools/new-branch.mjs --check <name> [--pack tour-guide]
```

It reads code, never a registry file. It loads the pack in the GAS harness, reads the sources, and prints one row per
part: `pack loads`, `core module`, `command`, `kind request`, `kind routing`, `envelope type`, `envelope handler`,
`core validator`, `schema`, `pack validator`, `envelope tool` (whether `PAYLOAD_KINDS` has the type, so that
`envelope.mjs --pack` accepts it), `parity test`, `tab` and `app ops`. Each row is `ok`, `missing` or `not needed`. The
exit code is 0 when the branch is complete and 1 when anything is missing.

**How the check knows a part is not needed.** A generated core module carries one line:

```
// @branch <name> command=/<cmd> kind=<kind> envelope=<type|-> tab=<Tab|-> routine=<ROUTINE> app=<yes|->
```

- `-` means "not needed", from `--no-envelope`, `--no-tab` or `--no-app`. The check reports those parts as
  `not needed`, and checks the others against the names on the line.
- A hand-built branch without the line, Scout for example, is expected to have every part. Its names are read from its
  code: the first `registerCommand`, `tgOpenKindRequest` and `registerEnvelopeHandler` in `gas/<NN>_<name>.js`, the
  tab from that file's `registerSheet`, and the ops `TG_APP_OPS['<name>.…']`.
- A hand-built branch that legitimately lacks a part, or whose names differ from its branch name (the veg card's
  envelope type is `veg_card`), should add the `@branch` line. On a hand-built branch the line only informs `--check`:
  `--force` still refuses it, because it rewrites only a core module that carries the template's own header.
- If you delete the line, every part is expected again.

### What you still write by hand

- **The behaviour.** What the command asks for (arguments, the request's fields), and what the owner sees.
- **The real fields.** Replace the placeholder `note` in the schema, in both validators and in the fixture, together.
  The parity test keeps them in step.
- **The judgment step.** The private skill's middle step, and anything its input needs (memory excerpts and so on).
- **Where a `--no-tab` branch keeps its data**, and its app ops' reads (the `TODO (--no-tab)` comments).
- **The app's screen** (outside `helpers/`), and the routine's configuration in the core's Script Properties.
- **The pinned type lists**, when the branch has an envelope type. Three tests pin the pack's exact lists on purpose, so
  a new type is a deliberate change: add it to `TYPES` and `EXAMPLES` in `tests/pack_tour-guide_payloads.test.js`, to the
  `listKinds()` list in `tests/pack_tour-guide_schemas.test.js`, and to the `typesFor('tour-guide')` list in
  `tests/tools_envelope.test.js`. Until then, those three are the suite's only failures.

Developed by: LightAISolutions
