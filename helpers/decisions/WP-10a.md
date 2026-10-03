# WP-10a — decisions and assumptions

## Platform facts (checked against official docs, 2026-10-03)
- Apps Script quotas: triggers 20 per user per script; triggers total runtime 90 min/day (consumer) / 6 h/day (Workspace); 6 min per execution. Source: https://developers.google.com/apps-script/guides/services/quotas
- Time-driven triggers: "the time might be slightly randomized" (a recurring 9 AM trigger runs between 9 and 10 AM). Source: https://developers.google.com/apps-script/guides/triggers/installable
- `ClockTriggerBuilder.at(date)`: "Specifies when the trigger runs" — no accuracy is promised; `after(ms)`: "the actual duration might vary, but won't be less than your specified minimum"; `atDate` ±15 min. Source: https://developers.google.com/apps-script/reference/script/clock-trigger-builder
- Telegram `InlineKeyboardButton.callback_data`: 1–64 bytes. Source: https://core.telegram.org/bots/api#inlinekeyboardbutton

## Core alarm registry
- One pending `alarmTrigger` for all alarms; `alarmArm()` deletes every `alarmTrigger` then creates one `timeBased().at()` at the earliest `next()`. Uses one trigger of the 20-per-script quota at most.
- Never sooner than `ALARM_MIN_LEAD_SEC` (60 s) from now, so a past `next()` cannot spin.
- An alarm runs when `next() ≤ now + ALARM_EARLY_SEC` (60 s): a trigger that fires a little early still runs it; a late one runs it late. Pack code must not depend on exact timing.
- An alarm still due right after its run (or one that threw) is held back `ALARM_RETRY_MIN` (15 min) instead of re-firing every minute.
- Busy script lock → step aside and leave one retry trigger 15 min out (never leave no trigger).
- Daily cap `ALARM_MAX_RUNS_PER_DAY` (48, home-zone day via `settingIncrDaily`): past it, audit `alarm_cap_reached` once and arm 6 h out. Runtime per run is small (a few Sheet reads + at most a few Telegram sends) — far below the 90 min/day trigger runtime quota.
- Backstop: `wakeSweep` calls `alarmArm()` when the day's daily jobs ran (first sweep of a local day). Done there instead of as a registered daily job so the core daily-job list (asserted by older tests) stays unchanged.
- Settings `alarm_next` = `"<ISO>|<name>"` of the pending trigger, written only when it changes; `alarmPending()` reads it plus the live trigger count.
- Accepted race: two concurrent `alarmArm()` calls outside the lock could leave two triggers for a moment; the next fire deletes both and re-arms one.

## Zone helpers (core/01_util.js)
- `isValidTz(tz)`: same pattern as the trip schema's `timezone`, then `Intl.DateTimeFormat` must accept it.
- `msAtLocal(tz, isoDate, hh, mm)`: two-pass offset correction through `Utilities.formatDate`; in a DST gap it lands on the shifted wall time. An impossible date (e.g. 30 Feb) gives NaN.

## Each trip's own day (suggestion 1)
- `Trips.tz` is optional; empty means home (`getTz()`). Set by a `plan_digest` or `bookings` envelope's `tz`, never by a guess.
- Which "today" each `isoDateLocal` call site uses: `13_flow_review` (the review's "ended yesterday") → trip zone; `30_chat_api` trip-day context → trip zone, its daily counters and log dates → home; `12_flow_plan` intake date check → the earlier of home and owner-zone today (never refuses a start date that is already today somewhere the owner is); `22_people` and `tgShDate` → home.
- `/today` adds "📍 Today in <destination>: <date>" only when the trip's offset differs from home's right now (a same-offset zone adds nothing).
- `tgOwnerTz()`: the zone of a non-done trip in progress (today in its zone within start…end); the pinned current trip wins a tie; else home.

## Contract C10 storage
- Day-level extras (`spare_minutes`) go in `DayPlans.meta_json` on part 0 only (continuation parts stay small); stop and leg extras ride inside `stops_json` / `legs_json` as sent.
- `tgDigestDays` returns `spare_minutes` as a number or `null` (never undefined), so WP-10b can test `=== null`.
- An old row without `meta_json` reads as `spare_minutes: null`; the column is added on the next digest write (`_tgEnsureCols`).

## Bookings (suggestion 6)
- **Datetimes:** `opens_at` / `book_by` must carry an explicit offset (`Z` or `±HH:MM`), seconds optional, no fractional seconds — the same pattern in the schema, the checks and the GAS validator. A naive time would be read in whichever zone the reader is in.
- **Replace semantics:** the brain's list is the trip's whole list. An owner's booked / not_needed survives a brain `todo` or `not_needed`; the brain's `booked` always applies (it saw a confirmation). Equal status keeps `status_by = owner`. Snooze and reminder marks survive an update; a changed `opens_at` re-arms its opening alert. Missing records are deleted.
- **Tab on first use:** reads never create the tab (`tgBkAll` → `[]`); the first write runs `ensureSheets()` (old deployments do not re-run setup).
- **Opening alert:** about `ALERT_LEAD_MIN` = 30 min before `opens_at`. A record that opened more than 30 min before it arrives gets no alert (it is marked alerted on arrival) — it shows in the daily reminder instead.
- **Daily reminder:** 09:00 in `tgOwnerTz()` (the trip zone while a trip is in progress, else home). If not sent by 12:00 local (`DAILY_LATE_HOURS` = 3), it waits for tomorrow — no evening nag after a late deploy. Lists todo records whose window is open (no `opens_at`, or `opens_at` passed), not snoozed, for non-done trips whose `for_date` has not passed; nearest deadline first (`book_by`, else `opens_at`, else the day); overdue ones say "⚠️ overdue — was due …".
- **`/bookings now`:** sends the reminder whatever was sent today and marks today as sent; when nothing is open it names the next record to open.
- **Marks only on success:** `alerted_at`, `last_reminded` and the day mark are set only after Telegram answered ok; a failed send is retried by the alarm (held back `ALARM_RETRY_MIN`).
- **Snooze (Tomorrow):** until the next local midnight in the owner's zone; a snoozed record has no buttons and is skipped by alerts and reminders until then.
- **Both times:** 24 h in the trip zone + " in <destination>", then 12 h lowercase "your time" in the owner's current zone; one time when both read the same.
- **Messages:** at most 10 records per reminder message (30 buttons); with several records the button labels carry the line number; a single record gets unnumbered buttons.
- **Callback data:** `bk:<first 10 hex of sha1(trip|id)>:<b|n|t>` (≤ 17 bytes). The redraw re-reads every record the tapped keyboard named and keeps a ⏰/🔔 first line as the header.
- **Notice:** one silent message only when new `todo` records arrived; an unchanged list is silent.
- **Day card lines:** `tgBkDayLines` leaves out `not_needed` records and sorts by deadline.
- `/trip`: open records in full, done records folded into "✅ N booked · M not needed".
- The action allowlist stays empty: buttons change only the core's own rows.

## Brochure section
- `bookingsSection` prints plain text (the brochure kit escapes); "local time (… your time)" wording because the brochure has no destination name in its signature; booked records after open ones, no link on booked records; `not_needed` left out; at most 30 items (the practical-section item limit); a bad zone falls back to UTC (trip) / no second time (owner); `now` optional — without it the wording is neutral ("Opens", "Book by").

Developed by: LightAISolutions
