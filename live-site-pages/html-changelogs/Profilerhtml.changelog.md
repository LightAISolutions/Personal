# Changelog — Profiler

All notable user-facing changes to this page are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Older sections are rotated to [Profilerhtml.changelog-archive.md](Profilerhtml.changelog-archive.md) when this file exceeds 50 version sections.

`Sections: 50/50`

## [Unreleased]

*(No changes yet)*

## [v01.68w] — 2026-08-29 10:28:50 PM EST — v03.83r

### Added
- Study modules now show revision notes under the module header, and library cards carry a "revised" badge with the latest revision date
- Reading progress ("Mark as understood" ticks) now follows your account across devices — ticks made on one device appear on your others, and ticks made offline sync up automatically

## [v01.67w] — 2026-08-29 09:52:01 PM EST — v03.82r

### Added
- The Industry Guidance library now has a search box — type a keyword to find it across every module's sections, tables, drills, and glossary terms, with highlighted snippets that jump straight to the matched section
- A new Unified Glossary view brings every term from all study modules into one alphabetical list, showing each module's definition when a term appears in several

## [v01.66w] — 2026-08-29 09:47:21 PM EST — v03.81r

### Added
- Company names in Industry Guidance modules are now clickable — tap one to jump straight to that company's dossier
- Dossiers now show a "Covered in guidance modules" line for guidance-tier viewers, with buttons that open each study module directly

## [v01.65w] — 2026-08-29 09:39:08 PM EST — v03.80r

### Added
- Industry Guidance modules now show a review-by date, with a highlighted badge when a review is coming due or overdue
- Report library entries and report pages now show a freshness badge (fresh / aging / stale) based on the report's age

## [v01.64w] — 2026-08-29 09:12:08 PM EST — v03.77r

### Added
- Admins now see 🔒 "Admin lens" panels inside Industry Guidance study modules — company-specific analysis from the report library, anchored to the relevant section, with a link to the source report. Other access tiers see the modules unchanged

## [v01.63w] — 2026-08-29 08:41:26 PM EST — v03.76r

### Changed
- The highlighted note boxes in Industry Guidance study modules now carry a neutral "Sales angle" label

## [v01.62w] — 2026-08-29 08:14:28 PM EST — v03.74r

### Added
- Formation timeline on the Relationships tab — when a dossier's relationships carry start dates, a compact year strip shows when each one began, with color-coded dots you can tap to open the counterparty's dossier. It reveals at a glance whether a company's ecosystem is long-standing or newly assembled, and follows the category filter chips

## [v01.61w] — 2026-08-29 08:08:54 PM EST — v03.73r

### Added
- Category filter chips on the Relationships tab of link-heavy dossiers — one chip per counterparty category with a count; tap one to cut the map and every group to that slice, tap again for the full view. The filter clears when you open a different dossier

### Fixed
- The IPP category label now displays fully capitalized in the Relationships chips and the Network explorer's category filter

## [v01.60w] — 2026-08-29 07:58:17 PM EST — v03.72r

### Added
- Export one-pager button on every dossier's Relationships tab — downloads a compact Word document of the full relationship view (grouped links with status, start date, deal size, latest activity, notes, and stated sources) for meeting preparation

### Changed
- The Network and Reports buttons on the masthead swapped places, so users without Reports access see a continuous button stack instead of a gap
- The Industry Guidance library now shows its study modules under topic group headers, so related documents sit together and are easier to find

## [v01.59w] — 2026-08-29 07:48:18 PM EST — v03.71r

### Added
- Industry reports now include a Relationship map — every curated link between the report's in-scope companies, each spelled out from both sides with its freshest supporting quote. Clearly labeled as current data alongside the report's point-in-time content

### Changed
- The "New in" window in the Ecosystem Network explorer is now 30 days instead of 90 — a tighter definition of recent momentum

## [v01.58w] — 2026-08-29 07:31:17 PM EST — v03.70r

### Added
- ✦ New in 90d toggle in the Ecosystem Network explorer — narrows the view to relationships with evidence from the last 90 days, so what changed since your last visit stands out; works together with the other filters and inside compare mode. Links with fresh evidence also show their latest date highlighted in gold at all times

## [v01.57w] — 2026-08-29 07:19:37 PM EST — v03.69r

### Added
- Compare mode in the Ecosystem Network explorer — pick a company, then "Compare with…" a second one to see their common ground: the direct link between them (if any) and every counterparty they both work with, with each side's relationship spelled out

## [v01.56w] — 2026-08-29 07:03:56 PM EST — v03.68r

### Changed
- The "Detected in other dossiers" group now starts collapsed — these are weaker signals, so the curated relationships lead and the long tail opens with one click on the group header
- Removed two detected links whose only supporting text was a sentence explicitly stating no relationship exists

## [v01.55w] — 2026-08-29 06:20:58 PM EST — v03.67r

### Added
- Relationships are now grouped by what they mean — who the company works with, who it competes with, and other links — and every covered company's dossier now carries a curated relationship list
- Each relationship carries quick-read chips for its current status, start date, deal size, and latest activity
- Relationships now also show what other companies' dossiers say back — mentions of this company found across the rest of the coverage, labeled by which dossier said it — plus a "Detected in other dossiers" group for companies that reference this one even when this dossier doesn't mention them
- New Network view reachable from the masthead: an ecosystem-wide relationship explorer showing every link between covered companies in one filterable list (by company, link kind, or category), each connection spelled out from both sides with its freshest supporting quote

## [v01.54w] — 2026-08-29 05:15:56 PM EST — v03.66r

### Added
- Every dossier's Relationships section is now its own tab, with the relationship map and the full list of linked companies
- Each relationship now reads as a fuller explanation: where a curated link states its source, that source is shown and linked with its publication date, followed by the relationship's context and every mention of that company across the dossier — quoted as complete sentences with the section each one came from, and event mentions carrying their date and source link

### Changed
- Relationship explanations are no longer shortened — nothing is cut off mid-sentence and no entries are hidden behind a "+ more" note; the page simply scrolls. The map still draws the ten strongest links for legibility, with the complete list below

## [v01.53w] — 2026-08-29 04:56:45 PM EST — v03.64r

### Changed
- The Reports library is now available to administrators only — the masthead button and report pages no longer appear for other users

## [v01.52w] — 2026-08-29 04:45:35 PM EST — v03.63r

### Added
- A new Reports library on the masthead — point-in-time industry reports built from the covered dossiers. The first report covers the grid-scale battery storage competitive field
- Each report opens with the bottom line and numbered, confidence-tagged key judgments, and shows exactly which companies it draws on, how current each one was, and how well-sourced — including a plain statement of what is missing
- Every figure and claim links to numbered citations taken from the dossiers' own source lists, each labelled by where it came from — the company itself, its filings and releases, or independent reporting
- Reports can be exported as Word documents

## [v01.51w] — 2026-08-29 03:37:45 PM EST — v03.61r

### Added
- The company roster now shows how current and how complete each dossier is at a glance. Every card carries a freshness dot with the age of its last update — green for recently refreshed, amber when a refresh cycle has been missed, red when two have — plus its source count, its first-party share, and whether its revenue is comparable in the Compare view
- A summary line above the roster totals it up: how many dossiers, how many cited sources, how many companies carry a comparable revenue figure, the median first-party share, and the age of the least recently updated dossier

### Changed
- Roster cards show the update age in days instead of a raw date — quicker to scan across many companies

## [v01.50w] — 2026-08-29 05:41:32 AM EST — v03.60r

### Added
- Every dossier now shows where its information actually came from. A sourcing line under the company name gives the share drawn from the company itself, and the Source List breaks it into three groups — the company's own channels, its filings and press releases, and independent reporting — with each individual source labelled
- The comparison view gained a sourcing row, so when two companies are shown side by side you can see how well-evidenced each dossier is before weighing the figures against each other
- A short plain-language note characterises the balance. A dossier built almost entirely from the company's own material is flagged as lightly corroborated rather than presented as well-sourced — heavy company sourcing is a caution, not a mark of quality

## [v01.49w] — 2026-08-29 05:21:35 AM EST — v03.59r

### Fixed
- The revenue figure shown in a comparison now always reflects each company's most recent reported year. Some dossiers list their financial years newest-first and others oldest-first, and the comparison had been reading whichever year happened to be listed last — which meant a handful of companies were being compared on the prior year's revenue

### Changed
- Many more companies now show a directly comparable revenue figure. Where a company reports in a currency other than the US dollar, the figure is converted at the average rate for that reporting year and labelled with the currency it came from, so the basis of every comparison is visible
- Companies whose only available revenue figures are outside estimates, forward guidance, or partial-year splits continue to show no comparable figure rather than an approximation

## [v01.48w] — 2026-08-29 04:52:54 AM EST — v03.58r

### Changed
- Companies that build the same kind of hardware can now be compared in full even when the roster files them under different labels — a battery maker and a systems integrator are treated as one competitive family, so the product and technical rows are available for the comparison people most often want
- The comparison heading names the exact company type when every company shares one, and otherwise names the wider family and says plainly which types were grouped
- Companies from genuinely different parts of the ecosystem are still held apart, and the financials-only option is unchanged

## [v01.47w] — 2026-08-29 04:43:21 AM EST — v03.57r

### Added
- Comparisons now lead with a like-for-like revenue row: each company's latest full year in US dollars, with a bar showing relative size
- Where a figure was converted from another currency, the conversion basis is shown on hover, and the period each figure covers is stated so companies with different financial year-ends can be read correctly
- Companies whose dossier does not yet carry a comparable figure say so plainly instead of showing an estimate

## [v01.46w] — 2026-08-29 04:13:49 AM EST — v03.55r

### Added
- Compare mode on the company list: pick up to four companies and see them side by side. The first pick sets the peer group, and companies from a different part of the ecosystem are dimmed so a comparison stays like-for-like
- The comparison always shows dossier freshness and the financial record as reported; product and technical rows appear when every company picked works in the same space, listing the attributes their dossiers have in common
- A "Financials only" option compares companies across different spaces, limited to the rows that stay meaningful
- Comparisons have their own shareable link, and each company name opens its dossier

## [v01.45w] — 2026-08-29 03:49:01 AM EST — v03.54r

### Added
- The Summary tab now maps how covered companies relate to each other: a clickable relationship diagram plus the reporting behind each link, with one-tap access to the linked company's dossier
- A settings menu in the bottom corner gathers administrator tools in one place

### Removed
- The Summary tab's shortcut cards — replaced by the relationships view

## [v01.44w] — 2026-08-29 02:50:58 AM EST — v03.52r

### Changed
- The dossier's opening tab is now called "Summary"

### Added
- The Summary tab opens with an at-a-glance board: the lead analytic judgment, the beat/miss record across reported financial periods, the newest reported development, product-line and leadership counts, and how fresh the sourcing is — each card jumps straight to its full tab

## [v01.43w] — 2026-08-27 04:09:00 PM EST — v03.03r

### Changed
- Minor internal improvements

## [v01.42w] — 2026-08-24 12:15:30 AM EST — v02.93r

### Added
- New "IPP" company category — power producers that buy and operate battery systems now have their own colored tag and roster filter, alongside eight new company profiles in that category

## [v01.41w] — 2026-08-22 10:57:17 PM EST — v02.90r

### Changed
- Technical Annex rebuilt in a clearer format across every company dossier. Long run-on spec lines are now separated into individual attributes, each with its own name, and grouped under category headings such as Power, Electrical and Design — so a specific figure can be found by heading instead of by reading the whole block
- Every product table in a dossier now shares the same column alignment, and the same format carries through to exported documents
- Spec wording is unchanged — the figures read exactly as they did before; only the grouping and labelling are new

## [v01.40w] — 2026-08-22 10:24:05 PM EST — v02.89r

### Fixed
- Technical Annex sections that appeared as headings with empty rows now show their content. Around two thirds of dossiers were affected; the same content was also missing from exported documents, which are fixed with them
- A dossier with no technical detail to show now omits the Technical Annex entirely instead of printing an empty heading
- Reading progress in Industry Guidance is now kept separately for each signed-in account, so signing a second account into the same browser starts it with a clean module instead of inheriting the first account's ticked sections. Progress recorded before this change is cleared once, since there is no record of which account earned it

## [v01.39w] — 2026-08-22 08:01:32 PM EST — v02.88r

### Changed
- The app now tailors what it shows to each signed-in account's access level. Administrators continue to see every feature; other access levels see a reduced set, with anything they are not entitled to hidden rather than shown and refused
- Access levels can be previewed from the address bar (add `?as=viewer` to the page URL) to check how the app looks to another level. Previewing can only ever show less than the account already has, never more

## [v01.38w] — 2026-08-22 07:05:31 PM EST — v02.86r

### Added
- New Industry Guidance area for administrators — a reading-room button in the page header opens a library of interactive study modules with section navigation, reading-progress tracking, timelines, comparison tables, flashcards, self-tests and a hoverable glossary

## [v01.37w] — 2026-08-22 04:39:06 AM EST — v02.81r

### Added
- Executive headshots now appear on 40 more leadership entries across 17 company dossiers, with photo credits shown where a photo requires attribution

## [v01.36w] — 2026-08-22 03:25:08 AM EST — v02.80r

### Fixed
- Key Judgments now display correctly on every dossier — seven company profiles (and their archived versions) previously showed their analytical judgments as unreadable placeholders or appeared to have none

## [v01.35w] — 2026-08-22 03:15:24 AM EST — v02.79r

### Added
- Dossiers are now organized into labeled tabs (Overview, Products, Developments, Key Judgments, Leadership, Financials, Sources) with a pinned tab bar — no more scrolling one long page to find a section
- Tab views are shareable: the page address updates as you switch tabs, so a saved link opens directly on that tab
- Exported documents now open with a cover page and a hyperlinked table of contents, and every section starts on its own page; Word exports can fill in real page numbers via "Update Field"

### Fixed
- Company overviews now display as properly spaced paragraphs on every dossier (one dossier previously ran its opening sections together)

## [v01.34w] — 2026-08-21 11:01:38 PM EST — v02.75r

### Added
- Two new roster categories: EPC and General Contractor, each with its own tag color and filter

### Changed
- Construction and engineering companies are now grouped under the new categories, so filtering the roster by company type is more precise
- Category names now display with proper formatting throughout the app

## [v01.33w] — 2026-08-21 10:49:24 PM EST — v02.74r

### Added
- New "Neocloud" company category with its own color tag — GPU-cloud providers now appear under their own label instead of "Hyperscaler"
- Every company now has an in-app study guide — 30 new technology study guides were added, completing coverage across the full roster

### Changed
- Dossier summaries now display "Bottom Line Up Front" and "Background" as separate paragraphs for easier reading
- Snapshot facts (ownership, ecosystem role, and other background fields) now display with capitalized words

### Fixed
- Newer dossiers now show their Headquarters, Ownership, stock ticker, and legal-name details correctly — these fields could previously appear blank on some companies

## [v01.32w] — 2026-08-18 06:16:45 AM EST — v02.67r

### Fixed
- **A note log that would not load left you with nowhere to go.** Every possible cause showed the same sentence, with nothing to press. It now says which kind of problem it is, shows a short reason code you can quote, and offers a **Sign in and retry** button that signs you back in and reloads the log in place
- An expired sign-in is now named as such, rather than described the same way as a network problem
- The transcript import panel stays available when the log itself fails to load. It never depended on the log, and hiding it removed the only remaining option

## [v01.31w] — 2026-08-18 06:09:59 AM EST — v02.66r

### Fixed
- **Updates could be announced without arriving.** The page checks for a new version and reloads itself, but that reload was allowed to reuse the copy already stored on your device — so the version shown at the bottom could move forward while the page around it stayed on the previous build, and new features appeared to be missing. Reloads now always fetch a fresh copy
- This does not repair a copy already stored on your device. If a feature seems missing right after an update, fully close the tab and reopen it once; from this version on it corrects itself

## [v01.30w] — 2026-08-18 05:56:47 AM EST — v02.65r

### Fixed
- **The import panel never appeared.** Checking the transcribed folder needs Google's permission prompt, and that prompt only opens while you are actually pressing something. The check was running on its own a moment after the log opened, so the prompt could never appear and nothing was shown. The panel now appears straight away and the check happens when you press the button

### Changed
- Recordings and transcripts are named more readably: `Catl 2026-08-10 Voice 260810_015240.m4a` rather than the previous run-together form. Files saved under the old naming are still recognised, so nothing already in your folders needs renaming
- The summary heading on a written-up note now reads `Auto-summary (model)` instead of the bracketed form

## [v01.29w] — 2026-08-17 08:36:32 PM EST — v02.64r

### Added
- **Transcripts you have already transcribed are now picked up for you.** Opening the notes log checks your "2-transcribed" folder and lists any meeting transcript that has not been written up yet. Choose a confidence rating once, press one button, and every waiting transcript is filed against the right company and written up in turn
- Each pending transcript is shown with the company it will be filed under **before** you commit to importing, so a mis-named file is visible rather than quietly filed in the wrong place. A file whose name does not match a company you cover is filed under General instead of being skipped
- Progress is reported per file while the batch runs, so a long transcript no longer looks like a stall

### Fixed
- The write-up and copy-with-transcript buttons no longer appear on notes whose attachment is a Word or PDF document. Those buttons could never work on such a note, and pressing one always failed
- A folder that cannot be checked now says so, instead of looking identical to having nothing new to import

## [v01.28w] — 2026-08-17 02:34:37 AM EST — v02.56r

### Changed
- When sign-in cannot reach the access list, the message now says **which** part is at fault instead of giving the same wording for every cause, and it includes a short code you can quote when reporting it
- A retry is only suggested when the problem is genuinely temporary. A structural problem with the list now says plainly that it will not clear on its own and needs an administrator, rather than inviting you to keep trying

## [v01.27w] — 2026-08-17 02:10:00 AM EST — v02.54r

### Fixed
- A brief interruption while the app was checking your access no longer appears as "Access denied". Sign-in now says it is a temporary service problem and asks you to try again, instead of turning you away with a message that suggests your access had been removed
- After one of these interruptions, sign-in works again as soon as the service recovers rather than staying blocked for the next several minutes
- Retrying during an interruption no longer counts toward the failed-attempt limit, so a service hiccup can no longer escalate into a temporary lockout

## [v01.26w] — 2026-08-13 04:34:03 AM EST — v02.37r

### Added
- Filing a transcript with a note now writes the meeting up for you. Instead of a placeholder that waited for a later pass, the note comes back as a short summary, what was discussed, what the customer signalled, action items and open questions — readable and copyable within about a minute of saving
- A **✨ Summarize** button on any note that has a transcript attached. Use it to write up notes filed before this existed, or to retry if the first attempt did not finish
- The note log shows the date a note was written up from its transcript

### Changed
- Notes that run to several lines now keep their line breaks in the log and in the manage panel, instead of collapsing into a single block of text
- If the write-up step does not complete, the note and its transcript are still saved — the status message says so and points at the retry button

## [v01.25w] — 2026-08-13 03:01:32 AM EST — v02.35r

### Added
- A **File transcript** button in the note box. Once you have transcribed a recording on your own computer, pick the transcript here and it is saved into the "transcribed" folder, the recording it belongs to moves out of the waiting folder to join it, and the transcript is attached to the note you are writing — all from the one selection

## [v01.24w] — 2026-08-10 04:42:24 AM EST — v02.30r

### Fixed
- Meeting recordings now go into a **Profiler App** folder in your own Google Drive, matching how the receipts app names its folder. The previous version put them somewhere you had no way to reach

### Changed
- Recordings are placed in the right folder as they upload, rather than landing loose and being tidied up afterwards
- Any recordings still sitting loose in your Drive are moved into the folder the next time you attach one, and the status line tells you how many were moved

## [v01.23w] — 2026-08-10 04:25:55 AM EST — v02.29r

### Changed
- After a recording uploads, the status line now tells you exactly where it was put away rather than just saying "attached"
- Any recordings left loose from an earlier session are tidied away when you open the note box, and you are told how many were moved

## [v01.22w] — 2026-08-10 04:13:24 AM EST — v02.28r

### Fixed
- Attaching a recording could sit on "Uploading…" forever with no Drive permission prompt ever appearing. Permission is now requested the moment you tap the button, which is when your browser will actually allow the prompt to open
- If the permission window is blocked, dismissed, or never comes back, the status line now says so and invites you to tap again — previously nothing was reported and the upload appeared to stall indefinitely
- An upload that stops responding is now cancelled and reported instead of hanging

## [v01.21w] — 2026-08-10 04:01:03 AM EST — v02.27r

### Changed
- Long meeting recordings now upload reliably. A file of any length is sent in pieces, so a dropped signal costs only the piece in flight instead of restarting the whole upload, and the button now shows a percentage while it works
- The recording button reads "Attach saved recording" and explains the flow: record in your phone's own voice recorder app, which has no length limit, then browse to the saved file. The record shortcut offered inside the file picker stops at about ten minutes and is not the way to capture a full meeting

## [v01.20w] — 2026-08-10 03:38:54 AM EST — v02.26r

### Fixed
- Attaching a meeting recording failed for anyone already signed in — the upload now works without needing to sign in again
- Note confirmations no longer say the log updates after a short delay; notes appear in the log immediately

## [v01.19w] — 2026-08-10 02:17:53 AM EST — v02.25r

### Changed
- Field notes are now private — they are kept in your own Google Drive and shown only after you sign in with an approved account

### Added
- Copy buttons on every note, plus a copy-all for untriaged notes, put a note and its transcript on your clipboard in one tap
- Attach a meeting recording to a note straight from your phone or computer
- Transcript files can be attached alongside Word and PDF notes

Developed by: LightAISolutions
