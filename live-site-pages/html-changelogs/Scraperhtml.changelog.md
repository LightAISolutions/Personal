# Changelog — News Scraper

All notable user-facing changes to this page are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Older sections are rotated to [Scraperhtml.changelog-archive.md](Scraperhtml.changelog-archive.md) when this file exceeds 50 version sections.

`Sections: 39/50`

## [Unreleased]

*(No changes yet)*

## [v01.66w] — 2026-08-29 01:30:10 AM EST — v03.51r

### Changed
- The Schedule panel now states the whole schedule rather than only the send time: a fresh intake builds at 6:00 AM ET, one hour before the send, and replaces any edition already built that day; Monday covers 72 hours and Tuesday–Friday cover 24

## [v01.65w] — 2026-08-29 01:19:10 AM EST — v03.50r

### Changed
- **The Calendar now shows which editions were actually emailed.** A filled bar means the edition went out; a hollow one means it was built but never sent — including a rebuild that superseded an earlier copy. Previously every edition looked identical, so a day you had merely built on read the same as a day that mailed
- **Weekend days are marked as non-send days**, so a Saturday you happened to build on can no longer be mistaken for a Saturday send
- Each day's tooltip now says how many editions were built and how many of those were emailed, and a key under the grid explains the two bar styles

## [v01.64w] — 2026-08-28 11:43:43 PM EST — v03.47r

### Fixed
- **"Why thin?" now tells you if it is taking too long** instead of sitting on "Reading this edition's intake…" indefinitely. After 25 seconds it says so and suggests trying again in a moment

## [v01.63w] — 2026-08-28 11:28:04 PM EST — v03.46r

### Added
- **A "Why thin?" button on the digest panel**, next to "Run intake now". It explains the edition you are looking at: a plain-English verdict at the top, then how many stories were scanned, how many were relevant, how many came from company searches, and how many were down-weighted for being outside the US market
- The report shows **where the scores landed** across six bands with the relevance bar drawn in, so you can see at a glance whether stories are piling up just underneath it
- It also lists the **stories that nearly made it** — how far short each fell, and whether it was held back for being outside the US market or for coming from a company search
- The verdict distinguishes the two situations that look identical from the outside: a crowd of stories sitting just under the bar (where adjusting your settings would help) from too little coming in at all (where it would not)

## [v01.62w] — 2026-08-28 11:06:15 PM EST — v03.44r

### Fixed
- **The held-back window now tells you when it could not load an edition**, instead of reporting that nothing was held back. If the edition was rebuilt — which replaces that day's issue — it says so and points you to the current one; if the list was too large to store, it says that and still gives you the count

## [v01.61w] — 2026-08-28 09:48:51 PM EST — v03.43r

### Changed
- Editions in the News Stand are listed by date and relevant-article count again. The build time added in the previous version is back in the tooltip, where it was — with one edition per day there is nothing to tell apart

## [v01.60w] — 2026-08-28 09:39:29 PM EST — v03.42r

### Changed
- **When a day has more than one edition, each one now shows the time it was built**, so two entries for the same date can be told apart at a glance. A day with a single edition looks exactly as it did before

## [v01.59w] — 2026-08-28 09:04:47 PM EST — v03.41r

### Changed
- **View More now shows each held-back story's summary and analysis**, not just its headline and source. The analysis appears in amber, matching the convention used in the edition itself
- The View More heading now says the analysis is the amber text, so the colour reads the same way everywhere

## [v01.58w] — 2026-08-28 08:02:19 PM EST — v03.38r

### Changed
- The rubric tester now scores a headline against the edition selected in the Digest panel rather than a general profile, names that edition in its result, and says plainly whether the article cleared the bar and what the bar was

## [v01.57w] — 2026-08-28 07:42:36 PM EST — v03.37r

### Changed
- The rubric tester now explains when a headline was held back for thin evidence, showing how much it scored for actually matching your companies, topics and segments versus how much its supporting signals were allowed to add

## [v01.56w] — 2026-08-28 05:58:49 PM EST — v03.34r

### Changed
- The rubric tester now explains when a headline was scored down for being outside the US market, naming the countries it found and whether a US connection softened the penalty

## [v01.55w] — 2026-08-28 05:16:12 PM EST — v03.30r

### Changed
- The Digest window is wider and no longer needs to be scrolled sideways — the whole edition fits on screen at once
- The landing-page edition reader is unchanged in size and layout

### Added
- A **View More** link in each edition's footer opens the stories that cleared your relevance bar but did not fit a section's cap, with the source for each. It works from the app and from a link in the emailed edition, and closing it returns you to where you were
- Editions published before this release show a short note explaining that their held-back list was not kept, rather than an empty list

## [v01.54w] — 2026-08-28 06:28:13 AM EST — v03.29r

### Fixed
- **Article links open the article again.** If you are signed into more than one Google account, every article link — on the page and in emailed editions — was being answered with a Google account chooser or an "unable to open the file" page instead of the story. Links now go through this page, which looks the destination up and forwards you straight there
- Editions built before this fix are corrected as you open them, so the whole archive works, not only editions built from here on

## [v01.53w] — 2026-08-28 05:44:48 AM EST — v03.27r

### Added
- **Every edition now has its own web address.** Opening one puts a link in the address bar that you can bookmark or paste anywhere, and your browser's back and forward buttons move between the editions you have opened
- **Share an edition with someone who has no account.** *Share…* creates a read-only link that shows just that edition. The link is shown so you can read it before sending, can be copied in one tap, and can be revoked at any time — revoking stops it working immediately
- **Export an edition.** *PDF* opens your print dialog with the edition laid out on a white page — choose "Save as PDF" as the destination. *Word* downloads a .doc file that opens directly in Word. *Email it to me* sends the latest edition to your inbox
- **A command palette on ⌘K (Ctrl+K on Windows).** Start typing to jump to an edition, filter to a masthead, switch views, or open Digest and Tune. Searching looks through your whole archive, not just what is on screen. Arrow keys move, Enter opens, Escape closes

### Changed
- *Copy link* on the reader bar copies the in-app link to the edition you are reading

## [v01.52w] — 2026-08-28 04:35:51 AM EST — v03.26r

### Added
- **The News Stand replaces the strip of recent editions.** Past issues now appear as cards showing which edition produced them, the date, the lead story, and how many stories were relevant — with a row of mastheads above that filters to one edition in a tap
- **Three ways to look at the same set** — the News Stand cards, a Calendar showing which editions ran on each day of the month, and a Table for scanning many issues at once. Clicking anywhere in any of them opens that issue
- **Search and a date range** that apply across the whole archive, not just what is on screen. Selecting a parent edition includes its variants, so "The Morning Edition" covers its BESS and AIDC editions too
- **Each masthead shows how many issues it holds** under the filters you have set, so the shape of the archive is visible before you click
- **Load more** for going further back, instead of being limited to a fixed handful
- **"Variant of…"** when creating an edition, which groups it under a parent edition everywhere it appears

### Changed
- Relevance figures are now spelled out as "32 of 148 relevant" instead of a bare ratio, so the number says what it counts
- The Editions list groups variants under their parent
- The subscriber count tile now reflects the whole archive rather than the issues currently on screen

## [v01.51w] — 2026-08-28 02:27:57 AM EST — v03.25r

### Added
- Subscribers can now be signed up to any combination of editions, not just one edition or all of them
- Every subscriber row is editable in place — tap an edition to add or drop it and the change saves immediately
- Subscribers can be paused and resumed, which stops their delivery without discarding which editions they had chosen
- The recipient list in the Digest panel now shows who receives the edition you have selected, and lets you add or remove someone for just that edition
- Past editions now show which edition produced them, so issues built on the same day are no longer indistinguishable

### Fixed
- The subscriber count on the home screen now reflects the people on your subscriber list instead of an older, separate delivery list
- Someone added as a subscriber now appears everywhere they should, rather than only on the Subscribers tab

## [v01.50w] — 2026-08-28 01:38:29 AM EST — v03.24r

### Added
- **Choose which edition to build.** The Digest window now has an edition menu next to "Run intake now", so you decide which edition — and therefore which segment and topic settings — the run uses. The finished message names the edition it built
- The chosen edition is locked in when the build starts, so a build that runs in several steps can never end up split across two editions

## [v01.49w] — 2026-08-28 12:36:36 AM EST — v03.22r

### Changed
- **The dot next to a setting now means "you changed this from the recommendation"** rather than "this differs from the shared settings". On an edition that has its own full set of settings the old meaning marked every single row, which told you nothing
- The line under the Tuning selector now says how many settings are on out of the total, and how many you have changed from the recommendation — or that it still matches

### Added
- **A starting-point menu and a "Reset to recommended" button** appear when you pick an edition, so you can see what it was built from and put it back at any time
- The new-edition form asks which starting point to use

### Fixed
- After saving a change, the switches are redrawn from what was actually stored, so the summary line and the switches can no longer disagree

## [v01.48w] — 2026-08-28 12:02:02 AM EST — v03.21r

### Added
- **A "Tuning" selector at the top of the left column.** Leave it on *Global* to edit the shared settings every edition inherits, or pick an edition to edit only that one. The switches redraw to show the chosen edition's own answers, and a dot marks each setting that edition deliberately does differently
- A line under the selector always says what you are editing and how many settings that edition changes, so it is never ambiguous which one a switch belongs to

### Changed
- Turning a setting back to match the shared value clears the difference rather than storing a duplicate, so an edition's list of differences stays honest and short
- Companies and sources are still shared by every edition — an edition narrows what it cares about, it does not keep its own separate company list

## [v01.47w] — 2026-08-27 11:51:21 PM EST — v03.20r

### Changed
- **"Read all dossiers" is now hidden once every company has been read.** It reappears on its own if any are outstanding or a run reports a problem, and a small ⚙ next to the sync card brings it back whenever you want it
- **Unavailable outlets no longer sit in the middle of the source list.** Ones that are still publishing but unreachable are grouped at the bottom, and their switch now correctly shows as off rather than on — previously it looked active while contributing nothing. The "on" count no longer counts them
- **Subscribers now pick editions from a menu** instead of typing edition names by hand, and the list shows each subscriber's edition by its proper name. Choosing "All editions" now clearly overrides any individual picks

## [v01.46w] — 2026-08-27 11:21:39 PM EST — v03.19r

### Changed
- **Tune now says why a news outlet was dropped** instead of implying it stopped publishing. The tag on the row states the real reason at a glance, and hovering it gives the full explanation and the date it was last checked
- The explanation on a dropped outlet no longer says its coverage came from the company profiles — sources and companies are tracked separately and now read that way

## [v01.45w] — 2026-08-27 10:55:12 PM EST — v03.17r

### Added
- **"Read all dossiers" button** next to Sync now. It keeps going by itself until every covered company has been read, showing a running count as it works, and finishes with a plain summary — no repeated pressing and no guessing how many rounds are left

### Changed
- If a run stops early, the message now names what blocked it and how many are left, and whatever progress was made is kept
- Pressing Sync now while a sync is already running gives a clear explanation instead of a silent no-op

## [v01.44w] — 2026-08-27 10:30:53 PM EST — v03.16r

### Fixed
- **The "Dossiers read" figure now updates as soon as a sync finishes.** Pressing "Sync now" refreshed the interests list but never the status tiles, so a sync could complete successfully and the count would still show its page-load value — making a working sync look like nothing had happened

## [v01.43w] — 2026-08-27 09:53:19 PM EST — v03.13r

### Added
- A "Dossiers read" tile on the main screen showing how many of your covered companies have had their research read into your interests, and how many are still queued — so the automatic background pass is visible instead of silent

## [v01.42w] — 2026-08-27 09:42:55 PM EST — v03.12r

### Added
- **A new landing page**: the app now opens on your latest edition, rendered in full, with a status strip above it (next edition time, subscriber count, AI provider, scheduler health) and a strip of recent editions you can click through
- A **"what is driving relevance"** panel showing how many companies, topics and filtered-out segments are shaping your digests
- A **Tune drawer** gathering everything you adjust in one place: Interests, Editions, Subscribers, Archive search and Source stats

### Changed
- The Projects area is gone. The main screen is the edition itself; all settings moved behind the Tune button

## [v01.41w] — 2026-08-27 08:56:08 PM EST — v03.10r

### Added
- A provider switch in the Go-live panel: pick "Gemini · free" or "Claude · Sonnet" with one tap, and the active choice is highlighted
- A recipient manager in the Go-live panel: your delivery addresses show as chips you can remove, with a field to add new ones — the delivery-status line updates to show how many recipients are set

## [v01.40w] — 2026-08-27 08:12:11 PM EST — v03.09r

### Added
- A "Go-live" panel in the Digest view: see at a glance which AI service is configured, whether scheduled runs and email delivery are on, and whether the hourly schedule is checking in — with each line coloured green when it's ready and amber when it still needs something from you
- Two test buttons in that panel — one makes a single tiny AI call to prove summaries will work (and shows the exact reason if they won't), the other emails you the latest edition so you can see how your own mail app renders it

### Changed
- The status pill in the header now reads "DIGEST LIVE" in green — scheduled weekday editions are running

## [v01.39w] — 2026-08-27 06:49:49 PM EST — v03.08r

### Added
- An edition manager in the Digest view: past editions are listed newest-first, switching between them is one click, and each edition now has its own delete control — with a quick "Delete?" confirmation step so a stray click can't remove anything
- When the newest edition was built without AI summaries, the Digest view now says so and shows the reason, instead of leaving you to guess why the summaries look short

## [v01.38w] — 2026-08-27 06:20:46 PM EST — v03.07r

### Added
- A Segments panel on the main screen: the business areas your followed companies work in, each with its own on/off switch — turn one off and news touching only that area stays out of your digests
- The relevance tester now explains when a headline was excluded by a switched-off segment, so you can see exactly why something didn't make the cut

## [v01.37w] — 2026-08-27 05:48:26 PM EST — v03.06r

### Added
- A Sources panel joins your interests: all 30 news publications are listed with on/off switches, so you control exactly where your digest reads from
- A new Digest view: browse recent editions, read them in the newspaper-style dark layout, and build today's edition on demand with a live progress readout

## [v01.36w] — 2026-08-27 05:08:03 PM EST — v03.05r

### Added
- A brand-new dark "news desk" look for the whole app — charcoal panels, amber highlights, and a newsroom typeface for faster scanning
- Your interests now live on the main screen: every covered company and industry topic appears with its own on/off switch, so you control exactly what counts toward your digests
- Newly covered companies are highlighted as new, and companies no longer covered are kept visible but marked — nothing disappears without you seeing it
- A "Sync now" control to refresh the company list on demand, with the last sync time always shown
- A relevance tester: paste any headline to see how it would score against your current interests, with a breakdown of why

### Changed
- Thumbs-up/down article rating is retired — relevance now follows the companies and topics you research, with no manual training needed. Past ratings are preserved

## [v01.35w] — 2026-08-27 04:09:00 PM EST — v03.03r

### Changed
- Minor internal improvements

## [v01.34w] — 2026-08-17 02:34:37 AM EST — v02.56r

### Changed
- When sign-in cannot reach the access list, the message now says **which** part is at fault instead of giving the same wording for every cause, and it includes a short code you can quote when reporting it
- A retry is only suggested when the problem is genuinely temporary. A structural problem with the list now says plainly that it will not clear on its own and needs an administrator, rather than inviting you to keep trying

## [v01.33w] — 2026-08-17 02:10:00 AM EST — v02.54r

### Fixed
- A brief interruption while the app was checking your access no longer appears as "Access denied". Sign-in now says it is a temporary service problem and asks you to try again, instead of turning you away with a message that suggests your access had been removed
- After one of these interruptions, sign-in works again as soon as the service recovers rather than staying blocked for the next several minutes
- Retrying during an interruption no longer counts toward the failed-attempt limit, so a service hiccup can no longer escalate into a temporary lockout

## [v01.32w] — 2026-08-05 05:26:52 AM EST — v01.80r

### Fixed
- Article ratings can no longer be lost: tapping 👍/👎 now registers instantly and the rating is kept safely on your device until the server confirms it — the "Could not save feedback" failures are gone
- Queued ratings save automatically in the background (retrying as long as needed) and even finish saving after a page reload; if the server is temporarily unreachable you get one heads-up, then a confirmation once everything lands
- Rating many articles in a row is now much faster — the buttons never lock while a save is in flight, and pending ratings are sent together in one request

## [v01.31w] — 2026-08-05 03:35:45 AM EST — v01.79r

### Added
- New notification history: a 🔔 button in the header opens a floating panel that saves every result message with its timestamp — start an operation, walk away, and come back to see definitively whether it finished, failed, or was interrupted
- Every long-running operation also logs a "started" entry, so a start with no matching finish tells you the run was cut short (retrying resumes where it left off)
- The history survives page reloads and shows an unread-count badge on the bell; opening the panel marks everything read, and a Clear button wipes the history

## [v01.30w] — 2026-08-05 03:13:25 AM EST — v01.78r

### Fixed
- The scheduler warning now has a gentler "can't verify yet" state: if you just added the hourly timer yourself, an amber notice explains it will clear automatically after the first hourly run — instead of wrongly alarming that briefs are not running

## [v01.29w] — 2026-08-05 02:57:13 AM EST — v01.77r

### Added
- If scheduled briefs can't run because the hourly timer isn't installed, a red warning banner now appears above your projects with the exact reason and step-by-step fix — this failure used to be completely invisible
- Keywords you added to the search plan are now labeled "added by you" in the plan panel, and the Rebuild confirmation tells you how many of your additions were kept

### Changed
- Rebuild's description now reflects that your manual additions are kept — only the automatically generated groups are replaced

## [v01.28w] — 2026-08-05 02:34:08 AM EST — v01.76r

### Changed
- Adding a keyword to the search plan now shows instantly: a pending row appears at the top of the list the moment you press Add, then is replaced by the saved entry (highlighted) as soon as the service confirms
- After every addition the panel re-displays the exact saved plan from the server, so the list on screen always matches what is actually stored
- If the confirmation is lost to a slow connection, the panel now re-checks the saved plan and tells you definitively whether your keyword was added — no more guessing

Developed by: LightAISolutions
