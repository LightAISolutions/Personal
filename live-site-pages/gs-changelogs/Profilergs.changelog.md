# Changelog — Profiler (Google Apps Script)

All notable user-facing changes to this script are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Older sections are rotated to [Profilergs.changelog-archive.md](Profilergs.changelog-archive.md) when this file exceeds 50 version sections.

`Sections: 27/50`

## [Unreleased]

*(No changes yet)*

## [v01.27g] — 2026-08-29 10:28:50 PM EST — v03.83r

### Added
- Study modules now carry dated revision notes describing how their content has changed
- Each account's reading progress is now stored centrally, so section ticks follow you across devices

## [v01.26g] — 2026-08-29 09:47:21 PM EST — v03.81r

### Added
- The app can now tell which study modules cover each company, powering the new cross-links between dossiers and the guidance library

## [v01.25g] — 2026-08-29 09:39:08 PM EST — v03.80r

### Added
- Each Industry Guidance study module now carries a scheduled review date, shown in the library so readers can see how current the material is

## [v01.24g] — 2026-08-29 08:41:26 PM EST — v03.76r

### Changed
- Industry Guidance study modules were revised to speak to industry groups — suppliers, developers, integrators, and buyers — rather than any single company, with training content generalized to industry-typical figures

## [v01.23g] — 2026-08-29 07:58:17 PM EST — v03.72r

### Changed
- The Industry Guidance library now organizes its study modules into topic groups — fundamentals first, then the AI data-center wave, then market access — so related documents sit together

## [v01.22g] — 2026-08-27 04:09:00 PM EST — v03.03r

### Changed
- Minor internal improvements

## [v01.21g] — 2026-08-24 06:16:16 PM EST — v03.00r

### Added
- Added a self-check that reports whether the sign-in access list is reachable, so sign-in outages can be diagnosed and resolved faster

## [v01.20g] — 2026-08-24 05:13:40 PM EST — v02.99r

### Added
- Two new training modules added to the study library, teaching the technology and the power-infrastructure fundamentals from the ground up, each with interactive study aids and self-tests

## [v01.19g] — 2026-08-24 01:51:27 PM EST — v02.96r

### Added
- Three new study modules added to the Industry Guidance library, each with interactive timelines, comparison tables, flashcards, and self-tests

## [v01.18g] — 2026-08-22 08:01:32 PM EST — v02.88r

### Changed
- Industry Guidance is now available to a second access level as well as administrators; the entitlement is still checked on the server for every request, so hiding a feature in the app is never the only thing standing in front of it

## [v01.17g] — 2026-08-22 07:05:31 PM EST — v02.86r

### Added
- Serves the new administrator-only Industry Guidance study modules, with access checked on every request

## [v01.16g] — 2026-08-18 05:56:47 AM EST — v02.65r

### Added
- **Transcripts can now be written up without opening the app at all.** Once you share your recordings folder with the account the app runs as, a background check every 15 minutes files and writes up anything new on its own. A few are handled per run so a long backlog is worked through steadily rather than being cut off part way
- A way to look up which account to share the folder with, since that address was not otherwise reportable
- The background check will not start until you have chosen a confidence rating for it to use. That rating is yours to set, so nothing is imported on a value picked for you

### Changed
- The summary heading on a written-up note now reads `Auto-summary (model)` rather than the bracketed form

## [v01.15g] — 2026-08-17 08:36:32 PM EST — v02.64r

### Fixed
- A note whose attachment is a Word or PDF document is no longer reported as carrying a readable transcript. It never did, so the app was offering actions on those notes that could only ever fail

### Added
- A note now remembers the original name of the file attached to it. That is what lets the app tell which of your transcripts have already been written up and which are still waiting, so nothing gets imported twice

## [v01.14g] — 2026-08-17 03:36:35 AM EST — v02.62r

### Changed
- Clearer wording when the permission check finds nothing wrong with what the app asked for: it now points you at the list of what was actually granted, printed just above, instead of telling you to run a check you are already inside

## [v01.13g] — 2026-08-17 03:23:38 AM EST — v02.61r

### Changed
- The permission check now shows what the app **asked for** alongside what it was **actually given**, in one run. A capability can be missing for two opposite reasons — it was never requested, or it was requested and never approved — and the fix differs, so seeing only one of the two lists could point at the wrong repair
- The guidance that follows now reads those two lists against each other and names the specific repair, rather than listing general things to check

## [v01.12g] — 2026-08-17 03:15:36 AM EST — v02.60r

### Added
- The app can now report, on demand, whether its permission to use Google services is actually in force — as opposed to merely having been requested. The two are separate, and only the first one determines whether anything works
- When permission is incomplete, it produces a direct link to re-approve it, and names which capability each missing permission takes down

## [v01.11g] — 2026-08-17 02:34:37 AM EST — v02.56r

### Fixed
- The specific reason the access list could not be read is now sent back to the page. It was already being worked out, but never delivered, so all four possible causes looked identical from the sign-in screen and could not be told apart

## [v01.10g] — 2026-08-17 02:10:00 AM EST — v02.54r

### Fixed
- Sign-in now tells apart "this account is not on the access list" from "the access list could not be reached right now". The second is reported as a temporary service problem, and is retried automatically before sign-in gives up
- A momentary failure to reach the access list is no longer remembered as a denial, so access is restored the moment the service recovers instead of several minutes later
- These interruptions no longer count toward the failed-attempt lockout

### Changed
- The app now refreshes its entry in the shared access directory only when its version changes, instead of on every single page load. Less simultaneous writing to the shared directory means far fewer of the interruptions above

## [v01.09g] — 2026-08-13 04:34:03 AM EST — v02.37r

### Added
- Transcripts saved with a note are turned into written meeting notes automatically, covering the summary, discussion points, customer signals, action items and open questions
- Writing a note up can be repeated at any time. Anything you typed yourself is kept and put back at the top each time, so repeating it never replaces your own words or stacks copies of the write-up
- Very long recordings are shortened before being written up rather than failing, and the note says when that happened

### Changed
- Saving a note and writing it up are now separate steps, so a slow or unavailable write-up can no longer cost you the note itself — the note and its transcript are saved first
- Notes stay marked as pending after being written up; a written-up note is still yours to review before anything reaches a dossier

## [v01.08g] — 2026-08-10 04:42:24 AM EST — v02.30r

### Fixed
- The recordings folder is now created in **your own** Google Drive, next to your other app folders, instead of in the Drive of whichever account the app was published from — where you could not see it

## [v01.07g] — 2026-08-10 04:25:55 AM EST — v02.29r

### Added
- Meeting recordings now have a home. Uploads are sorted into a dedicated recordings area with two folders — one for audio still waiting on a transcript, one for audio already transcribed — so a glance shows what is left to do
- Each recording is renamed to lead with the company and the date, keeping its original name on the end, so files stay recognisable
- A recording that was uploaded but never sorted is picked up and put away automatically the next time the app is opened

## [v01.06g] — 2026-08-10 02:17:53 AM EST — v02.25r

### Security
- Notes and their attachments are held in private storage and released only to an approved signed-in account

### Changed
- Saving a note now takes effect immediately, with no publishing step
- Meeting recordings are uploaded directly from your browser, so length is no longer limited by the app

## [v01.05g] — 2026-08-09 03:03:41 AM EST — v02.14r

### Added
- Role-based access: saving, editing, and deleting notes is now owner-only; other signed-in team members can submit note suggestions (with attachments and a confidence rating) that are emailed to the owner for review

## [v01.04g] — 2026-08-09 02:41:47 AM EST — v02.13r

### Security
- Strengthened sign-in checks on the note service — every note operation now fully verifies the signed-in session

## [v01.03g] — 2026-08-09 02:37:16 AM EST — v02.12r

### Changed
- The note service now talks to the app over a more reliable connection method, fixing load failures some phones experienced

## [v01.02g] — 2026-08-09 01:59:52 AM EST — v02.10r

### Added
- "Manage existing notes" panel in the field-note form — view every submitted note, edit its text and confidence rating in place, or delete it (deleting a file note also removes the attached document). Edited notes show an "edited" date in the log

## [v01.01g] — 2026-08-09 01:30:51 AM EST — v02.09r

### Added
- The field-note service is connected — sign in once with Google, then save notes and upload Word/PDF meeting files straight from any dossier

Developed by: LightAISolutions
