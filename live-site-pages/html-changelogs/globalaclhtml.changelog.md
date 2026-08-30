# Changelog — Global ACL

All notable user-facing changes to this page are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Older sections are rotated to [globalaclhtml.changelog-archive.md](globalaclhtml.changelog-archive.md) when this file exceeds 50 version sections.

`Sections: 5/50`

## [Unreleased]

*(No changes yet)*

## [v01.05w] — 2026-08-27 04:09:00 PM EST — v03.03r

### Changed
- Minor internal improvements

## [v01.04w] — 2026-08-17 02:34:37 AM EST — v02.56r

### Changed
- When sign-in cannot reach the access list, the message now says **which** part is at fault instead of giving the same wording for every cause, and it includes a short code you can quote when reporting it
- A retry is only suggested when the problem is genuinely temporary. A structural problem with the list now says plainly that it will not clear on its own and needs an administrator, rather than inviting you to keep trying

## [v01.03w] — 2026-08-17 02:10:00 AM EST — v02.54r

### Fixed
- A brief interruption while the app was checking your access no longer appears as "Access denied". Sign-in now says it is a temporary service problem and asks you to try again, instead of turning you away with a message that suggests your access had been removed
- After one of these interruptions, sign-in works again as soon as the service recovers rather than staying blocked for the next several minutes
- Retrying during an interruption no longer counts toward the failed-attempt limit, so a service hiccup can no longer escalate into a temporary lockout

## [v01.02w] — 2026-07-17 11:45:41 PM EST — v01.12r

### Fixed
- The application screen now loads reliably in any browser, including when multiple Google accounts are signed in

## [v01.01w] — 2026-07-17 10:05:56 PM EST — v01.11r

### Fixed
- Sign-in now works reliably in any browser, including when multiple Google accounts are signed in

Developed by: LightAISolutions
