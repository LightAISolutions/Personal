# TG-COMMANDS — the app's Commands tab

The owner asked for a Commands tab in the Tour Guide app that lists every command the bot answers and what each one does.

## Contract

- **The registry is the list.** The core's `listCommands()` (`core/02_registry.js`) returns `[{ cmd, help }]` for every
  command registered right now, sorted, with the help line it was registered with (`''` when none). The tab shows exactly
  these commands: nothing the bot does not answer, nothing it answers left out.
- **The pack describes them.** `gas/45_commands_app.js` holds `TG_CMD_GROUPS` (purpose groups, in tab order), `TG_CMD_GUIDE`
  (one entry per command: its group, one or two plain sentences, 1–5 example forms with what each means) and `TG_CMD_TIPS`
  (what works without a command). Examples use invented places only (public repo).
- **App op `commands.list`** (no arguments) → `{ groups: [{ id, title, about, commands: [{ cmd, does, help, forms: [{ text,
  means }] }] }], tips, count }`. A registered command with no guide entry is still shown, under a last group "More", with
  its `/help` line; a guide entry whose command is not registered is left out. Empty groups are dropped.
- **The shell** (`live-site-pages/helper-app.html`, screen `commands`, last in the nav): the groups as headed lists, a
  search box (word match over the command, its description and its examples), and each example as a button that copies
  it to the clipboard ("paste it in the chat"); where copying is not available it says to type it. The answer is fetched
  once per app open.

## Defaults chosen

- Grouped by purpose (Get started, Plan a trip, Your trip and its days, On the day, Discover, Places and lists, After the
  trip, Ask and settings, Housekeeping) rather than alphabetically: the owner reads the tab to find what to send.
- A tap copies rather than sends: a Mini App cannot post into the chat as the owner, and most forms need a place or
  date filled in.
- Keeping it current: `tests/pack_tour-guide_commands_app.test.js` fails when a command is registered without a guide
  entry (or the reverse). A branch skeleton written by `tools/new-branch.mjs` (its header still says "Still written by
  hand") is the one exception: it shows under More until its guide line is written, and the template's header says so.

Developed by: LightAISolutions
