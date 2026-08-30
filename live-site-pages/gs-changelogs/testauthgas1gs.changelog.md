# Changelog — Testauthgas1 Title (Google Apps Script)

All notable user-facing changes to this script are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Older sections are rotated to [testauthgas1gs.changelog-archive.md](testauthgas1gs.changelog-archive.md) when this file exceeds 50 version sections.

`Sections: 6/50`

## [Unreleased]

*(No changes yet)*

## [v01.06g] — 2026-08-27 04:09:00 PM EST — v03.03r

### Changed
- Minor internal improvements

## [v01.05g] — 2026-08-17 03:36:35 AM EST — v02.62r

### Changed
- Clearer wording when the permission check finds nothing wrong with what the app asked for: it now points you at the list of what was actually granted, printed just above, instead of telling you to run a check you are already inside

## [v01.04g] — 2026-08-17 03:23:38 AM EST — v02.61r

### Changed
- The permission check now shows what the app **asked for** alongside what it was **actually given**, in one run. A capability can be missing for two opposite reasons — it was never requested, or it was requested and never approved — and the fix differs, so seeing only one of the two lists could point at the wrong repair
- The guidance that follows now reads those two lists against each other and names the specific repair, rather than listing general things to check

## [v01.03g] — 2026-08-17 03:15:36 AM EST — v02.60r

### Added
- The app can now report, on demand, whether its permission to use Google services is actually in force — as opposed to merely having been requested. The two are separate, and only the first one determines whether anything works
- When permission is incomplete, it produces a direct link to re-approve it, and names which capability each missing permission takes down

## [v01.02g] — 2026-08-17 02:34:37 AM EST — v02.56r

### Fixed
- The specific reason the access list could not be read is now sent back to the page. It was already being worked out, but never delivered, so all four possible causes looked identical from the sign-in screen and could not be told apart

## [v01.01g] — 2026-08-17 02:10:00 AM EST — v02.54r

### Fixed
- Sign-in now tells apart "this account is not on the access list" from "the access list could not be reached right now". The second is reported as a temporary service problem, and is retried automatically before sign-in gives up
- A momentary failure to reach the access list is no longer remembered as a denial, so access is restored the moment the service recovers instead of several minutes later
- These interruptions no longer count toward the failed-attempt lockout

### Changed
- The app now refreshes its entry in the shared access directory only when its version changes, instead of on every single page load. Less simultaneous writing to the shared directory means far fewer of the interruptions above
Developed by: LightAISolutions
