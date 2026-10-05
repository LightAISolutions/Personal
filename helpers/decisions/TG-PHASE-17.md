# Phase 17 decisions — commands as app buttons and forms

The owner found 40+ commands too many to memorize and asked for them inside the app as buttons and forms. The plan
(eight items) was approved whole ("1-8", 2026-10-05). Built in three steps, framework only (public `helpers/` and the app
shell; the live bot gets it from the normal deploy, no private-repo side): **17a** items 1, 2, 7 · **17b** items 3, 4, 5 ·
**17c** items 6, 8 and a live check. Coordinator and builders Opus 5.5 · high (no Fable, the owner's limit).

## 1 Step 17a — run from the app, forms from the registry, the "/" menu (v01.74r, app v01.17w)
- **Run (item 1).** Core `runOwnerCommand(text, { via })` (`core/10_router.js`): only a registered command, at most 500
  characters, no control characters; `/start` stays chat-only (pairing). It posts a silent echo "▶️ <code>text</code> · from
  the app" to the owner's chat, then runs the handler through the same path as a typed message, with `ctx.chat.message_id`
  set to the echo, so every answer threads under it. Audited `owner_command_run`. Refusals: `bad_text`, `not_command`,
  `unknown_command`, `chat_only`, `no_chat`, `send_failed`.
- **App op `commands.run { text, nonce }`** (`gas/45_commands_app.js`), a write op under the script lock. A nonce seen in the
  last few minutes is answered `{ duplicate: true }` and not run again; refusals map through `TG_CMD_RUN_STATUS`
  (400/404/409/503).
- **Forms (item 2).** Core `core/18_command_forms.js`: one template grammar for every helper (literal text, `{name}` a required
  field, `[ … ]` an optional segment dropped whole when a field in it is empty), `cmdTemplateParse`, `cmdTemplateFill`,
  `cmdTemplateMatches`, and `HB_FIELD_KINDS` (trip, day, date, place, list, number, choice, time, text). Each guide form may
  carry `tpl`, `fixed` or `confirm`; `commands.list` now gives every form `run: 'now' | 'form' | 'type'` with its parsed parts,
  and every command its `fields` and `runnable`. App op `commands.context` feeds the pickers (trips, the current trip's days,
  places, saved lists, brochure sections). The tests prove every template parses and every example fills its own template.
- **The "/" menu (item 7).** `syncBotCommands()` registers the commands with Telegram (`setMyCommands`, scoped to the owner's
  chat) in the order of the pack's `command_menu` renderer, at setup and on the first chat message after a deploy that changes the list
  (fingerprint in `BOT_COMMANDS`). A branch command without a guide line is appended after the guide's.
- **The app.** Every example has **Run** (or **Fill in** once per template, or **Edit** to type the rest) beside Copy; a form
  draws a picker per field (trip-day chips such as "Day 2 · Wed 18 Nov · today", chips plus a box with the range for numbers,
  options for choices), shows a live preview of the exact command and runs from Telegram's main button. "✎ Type your own…"
  runs any command typed in full. After a run: "Sent. The answer is in the chat, under “▶️ …”" with Go to chat.

## 2 Defaults chosen in 17a
- **Dates as YYYY-MM-DD.** The app always sends ISO dates, which every command reads; a test proves the ISO form answers
  exactly as the day number, M/D or "tomorrow" typed in the chat for /day, /versions, /late, /checkin, /morning, /replan,
  /quiet, /menu and /daytrip.
- **One Fill in per template**, so a command with two examples of one form shows one form button, not two.
- **One nonce per command text**, kept until the call is answered and reused after a network error, so a retry never runs twice.
- **The in-page Run button only without Telegram's main button** (outside Telegram), so there is never a second Run.
- **Confirm first** for the commands that change or drop things (`/lodging remove`, `/lodging clear`, `/repick`, `/replan`,
  `/expire`, `/cancel`, `/interview all`), with Telegram's own popup.
- **"Re-plan from here" with a shared location stays a chat button**: it reads the location message itself.
- Left as is: `/lodging remove 6/10` typed with M/D saves "remove 6/10" as a stay name (a pre-existing quirk; the app sends
  ISO and is not affected). A candidate for the tuning after the trip.

## 3 Next
- **17b**: an intent search ("running late", "rain", "veg") with Recent and ⭐ Pinned actions in Telegram's per-user storage;
  action buttons on trip, day and place cards; a Settings screen (`settings.get`) with a folded Helper health panel.
- **17c**: five tabs (Home, Today, Discover, Places, More) with old deep links kept; answers that have an app screen open
  there; a live check with the owner.

Developed by: LightAISolutions
