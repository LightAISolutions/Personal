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

## 3 Step 17b — search, shortcuts, card buttons, Settings (v01.76r, app v01.18w)
- **"What do you need?" (item 3).** A box on Home (and the Commands tab's search) matches plain words against each command:
  its name, its `keywords` (`TG_CMD_KEYWORDS` in `gas/45_commands_app.js`, one line per guide command; a test makes sure
  every guide command has one) and what it does. Every word typed must hit; the name counts most, then a keyword, then the
  description. Home shows the five best with their Run / Fill in buttons; nothing fitting offers "Ask Tour Guide: “…”",
  which runs `/ask` with the words. "running late" finds `/late`, "rain" `/replan`, "veg" `/vegcard`.
- **Recent and ★ Pinned.** Every command run from the app is kept in Telegram's per-user storage (`CloudStorage`, so it
  follows the owner to another device; `localStorage` outside Telegram) as `cmd_recent` (with a count) and `cmd_pins`
  (☆ Pin on the Sent screen). Home shows pins first, then the most used; the Commands tab starts with both when nothing is
  searched. A command that asks first keeps asking from a shortcut.
- **Buttons on cards (item 4).** The current trip's card: ☀ Today and ⋯ More (Dates, Stay, Bookings, Notes, Later, What's
  on, Day trips, Re-pick). Another trip's card: Make current (`/trip`), since commands act on the current trip. A brochure
  day of the current trip: ⋯ This day (Re-plan with the day filled in, Versions, Morning, Running late +15/+30/+60,
  Check-in, Route); a day of another trip says to make it current first. A stop or a saved place: ⋯ (Route here and
  Compare open their forms with the name filled in; Quieter; Menu for food places; Notes). A form opened from a card goes
  back to that card.
- **Settings (item 5).** App op `settings.get` (`gas/46_settings_app.js`, read only): Smart answers, Outlines and day
  versions, the morning message and its time, What's on weekly, Saved lists, the profile. Each switch sends its command
  through the bot (`/journey on`, `/morning at 07:30`, …), so the chat keeps a record, then reads the settings again. A
  folded **Helper health** shows the `/status` numbers (core `coreStatusCounts()`, shared with `/status`) with Re-send
  pending, Read the mailbox now, Expire stale proposals, Ping, Status and Chat id.

## 4 Defaults chosen in 17b
- **Twelve of each** shortcut, commands of 200 characters or fewer; junk read back from storage is dropped.
- **Smart answers stays a disabled switch** until the API key is set (the key's value is never sent to the app).
- **Morning time 05:00–11:59**, checked in the app before anything is sent.
- **Expire stale proposals asks first**, like `/expire` in the forms.
- **Quieter and Menu without a date** on the Places screen (no day there); on a brochure stop they carry the day.

## 5 Step 17c — five tabs, Today, answers that open in the app (v01.77r, app v01.19w)
- **Five tabs (item 6).** Home, Today, Discover, Places, More, equal width. Discover (Scout, Day trips, What's on, Quiet,
  Menu, Compare) and More (Settings, Interview, Commands) show their screens in a second row; a tab opens its first
  screen as a fresh list. Shortlist, Facts, Brochure and the veg card sit under Home and are reached from its cards. Every
  old `?screen=` link (and the chat's 📱 buttons) still opens its screen, with the right tab marked; `?screen=today` is new.
- **Today.** The current trip's day today (`commands.context` for the trip and today in the trip's zone, `trip.digest`
  for the day) with its ⋯ This day buttons already open; forms opened there come back to Today. Before the trip it
  shows the first planned day ("Next · Day 1"); with no current trip (none planned, or the last one finished) it says so.
  Below: 📄 Whole trip and ☀ Today in the chat.
- **Answers that open in the app (item 8).** A guide form may name the screen its answer shows in (`opens`) and whether
  the answer comes later (`wait`); `commands.list` passes both on. `commands.run` works out the screen from the text
  typed (`tgCmdOpens`, exact forms first, then templates) and returns `opens: { screen, wait?, base?, trip? }`, where
  `base` is what that screen's list held before the run (ids, or the veg card's `received_at`). The app then opens the
  screen instead of the Sent page; for `wait` it shows a bar ("Working on “…” — it opens here when it's ready. The chat
  gets it too."), reads the list every 10 s for up to 10 minutes and opens the first new item: at once if the owner is
  still on that screen, otherwise the bar offers Open. ✕ stops watching. `/today` opens Today; `/outline` and `/versions`
  Compare; `/scout`, `/compare` Scout; `/daytrip`, `/whatson`, `/quiet <place>`, `/menu <place>` their boards;
  `/vegcard` the card (rebuild waits for the new one). Switches (`/whatson auto off`), Settings and Make current keep
  their quiet refresh; everything else keeps the Sent page.

## 6 Defaults chosen in 17c
- **Discover opens Scout, More opens Settings**; the last screen used in a tab is not remembered.
- **Places stays one screen**: its list and status filters already cover saved lists and Later.
- **10 s polls for 10 minutes**, skipped while the app is busy; after that the bar says the answer will arrive in the chat.
- **A watched answer never pulls the owner away**: it opens by itself only when the screen the run left is still showing
  and nothing else was opened there.
- **Bare `/quiet` and `/menu` open nothing** (their answer lists coming stops in the chat); `/brochure` and `/places`
  keep the Sent page because their answer is a file or a chat list.

## 7 Next
- The live check with the owner: the 17a–17c try-this lists on the real bot; results recorded here.

Developed by: LightAISolutions
