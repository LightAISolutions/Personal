# Changelog Archive — News Scraper

Older version sections rotated from [Scraperhtml.changelog.md](Scraperhtml.changelog.md). Full granularity preserved — entries are moved here verbatim when the main changelog exceeds 50 version sections.

## Rotation Logic

Same rotation logic as the repository changelog archive — see [CHANGELOG-archive.md](../../repository-information/CHANGELOG-archive.md) for the full procedure. In brief: count version sections, skip if ≤50, never rotate today's sections, rotate the oldest full date group together.

---

## [v01.27w] — 2026-08-04 08:27:47 PM EST — v01.75r — [acb6788](https://github.com/LightAISolutions/Sales/commit/acb6788f244fead6393e7d9d8e21fed1c94134e4)

### Added
- Every completed action now tells you the recommended next step (e.g. after gathering news: "Next: run Analyze to score them"), and result messages stay on screen longer so they're harder to miss
- The search plan panel now always shows how many query groups are saved and when the plan was last saved — so you can verify a rebuild went through even if you looked away
- The Stats panel footer now recommends the single most valuable next action based on your numbers

### Fixed
- Requests that hang no longer leave a button stuck forever — after 90 seconds the call fails visibly with a clear message and the button becomes usable again

## [v01.26w] — 2026-08-04 08:11:10 PM EST — v01.74r — [bcac8c4](https://github.com/LightAISolutions/Sales/commit/bcac8c4e07d8617a65b824ba41b4a7675794de51)

### Changed
- Faster button responses: when the connection has to use its backup route, the page now remembers that and uses the working route directly — cutting each press's wait roughly in half in that situation

## [v01.25w] — 2026-08-04 06:41:08 PM EST — v01.73r — [d28a97f](https://github.com/LightAISolutions/Sales/commit/d28a97f7db36612c1ab2e56c09a6f035095789e9)

### Added
- The search plan panel now has an add-a-term box: type a company or keyword (and press Enter or tap Add) and a fully-shaped query group appears at the top of the list in real time, highlighted so you can see exactly what was added — no need to leave the panel
- If a term is already covered by an existing query group, the panel tells you which one instead of adding a duplicate

### Changed
- The Plan button now opens your saved plan instantly (no waiting, no rebuild) — a separate Rebuild button inside the panel regenerates the plan from scratch, with a confirmation tap since it replaces the current list including your manual additions

## [v01.24w] — 2026-08-04 06:01:06 PM EST — v01.72r — [9eee790](https://github.com/LightAISolutions/Sales/commit/9eee79081c9a111fe340a0d5abf5e68edafb2548)

### Added
- New Plan button on each project card: builds an AI search plan from your full topic, keywords, and learned preferences, and shows the resulting query groups in a panel — the plan then powers Compile, Backfill, and Deep backfill
- New Deep backfill button: a premium history search that asks for confirmation before running (it uses paid AI web searches), shows live progress with articles found and searches used, and resumes where it left off if interrupted
- Compile and Backfill progress now shows how many junk headlines were filtered out before entering your collection

## [v01.23w] — 2026-08-04 04:53:53 PM EST — v01.71r — [308513a](https://github.com/LightAISolutions/Sales/commit/308513a236483dba7a41f0e940081aa35f61e0af)

### Added
- The Stats panel now shows, under each score band, how many articles had a preview versus title-only — so you can see whether missing previews explain low scores
- The Stats footer now shows how many articles qualify for archiving and how many are already archived
- New "Archive junk" button on each project card: shows the exact count first ("Archive 1781? Tap again"), then moves unrated articles scoring under 10 out of your collection with a progress panel and a result message

## [v01.22w] — 2026-08-04 04:01:42 PM EST — v01.70r — [2f604a6](https://github.com/LightAISolutions/Sales/commit/2f604a6fa4633518a76a675e2f5e8c3174bb3764)

### Added
- New Stats button on each project card shows your score distribution at a glance: a big headline with the share of articles scoring 20+, color-coded bars for each score band, and corpus health (preview coverage, your rating counts, and how many articles are worth calibrating)

## [v01.21w] — 2026-08-04 03:33:53 AM EST — v01.68r — [9543a7b](https://github.com/LightAISolutions/Sales/commit/9543a7bf68107dee49465df0ae8df1b6332d6d9d)

### Added
- New Enrich button on each project card fills in missing article previews by fetching them from the publishers — with live progress showing how many previews were found and how many were unavailable

## [v01.20w] — 2026-08-04 02:39:32 AM EST — v01.66r — [8bc535f](https://github.com/LightAISolutions/Sales/commit/8bc535f930a0a7c675da6696d90a335938a266e3)

### Added
- Added suggestions can now be undone — tap the × on an added keyword or source chip to remove it from your project (undo saves instantly and in the background, just like adding)
- New progress bars for Compile, Backfill, Analyze, and Re-score: a panel in the bottom-left shows the action name, a live fill bar, detailed counts (processed, found, failed, scored, remaining), and a running clock — it stays visible even while the articles or calibration view is open, and turns green when finished

## [v01.19w] — 2026-08-04 01:46:24 AM EST — v01.65r — [b048b61](https://github.com/LightAISolutions/Sales/commit/b048b61dfbe56da493f50e8c9185684287c6c8b0)

### Changed
- Adding suggested keywords/sources to your project now responds instantly — taps register immediately and save together in the background, with a clear message if a save fails so you can retry

### Fixed
- Rapidly adding several suggestions could previously lose some of them — all additions now save reliably

## [v01.18w] — 2026-08-04 01:33:25 AM EST — v01.64r — [a596f46](https://github.com/LightAISolutions/Sales/commit/a596f461dd971172e1054f23596dcc20a8dd58b4)

### Changed
- Calibration now explains clearly when there's nothing worthwhile left to rate, and points to Compile + Analyze to bring in fresh articles

## [v01.17w] — 2026-08-04 01:17:17 AM EST — v01.63r — [5d9b8b5](https://github.com/LightAISolutions/Sales/commit/5d9b8b53b374c877c709611744c3ca5f0b7e88a9)

### Added
- Project cards now show a green ⏰ chip with the next scheduled run time (hover to see the last run), or "first run pending" for a newly scheduled project

## [v01.16w] — 2026-08-04 01:08:07 AM EST — v01.62r — [ff07339](https://github.com/LightAISolutions/Sales/commit/ff07339adbc47e357ea209933ea888256b0ac378)

### Added
- New Calibrate button on each project: a focused rating mode that feeds you a varied mix of articles — mostly borderline ones where your opinion teaches the most — and replaces each card as you rate it, with a running session counter
- While calibrating, your preferences automatically re-learn after every 10 ratings, with a confirmation message each time
- New "What I've learned" panel shows the current preference profile plus suggested search keywords and your most-liked news sources, each with a one-tap + to add it to your project permanently
- New "Re-score collection" button re-scores all your gathered articles with the latest learned preferences (asks for confirmation first)
- The Articles view now has filters: time window, minimum score, and keyword search

## [v01.15w] — 2026-08-03 11:57:41 PM EST — v01.61r — [1f497f8](https://github.com/LightAISolutions/Sales/commit/1f497f8b8a954079dbb757bb192e0037d1e3695f)

### Added
- New "Rating status" window appears beside the article list while you rate — it shows each step of saving a rating live (tap registered, send attempts, retries, waits, saved) with elapsed times, so you can see exactly where a slow save is spending its time. Close it anytime with ×; it reappears on your next rating

## [v01.14w] — 2026-08-03 11:33:05 PM EST — v01.60r — [3ef1ffb](https://github.com/LightAISolutions/Sales/commit/3ef1ffbe02df26d21cef67586e5de9331465a5c4)

### Added
- After analysis, a message now confirms when your ratings have been distilled into updated preferences (e.g. "🧠 Preferences updated from your 12 ratings")

## [v01.13w] — 2026-08-03 11:21:17 PM EST — v01.59r — [b3941f4](https://github.com/LightAISolutions/Sales/commit/b3941f4755f44da0f0664ba6f47cd2445a3b7ef6)

### Fixed
- Rating an article right after a server update could silently fail (the button reset to default) — ratings now retry automatically and show a clear "server is finishing an update" message if the server still isn't ready

## [v01.12w] — 2026-08-03 10:06:55 PM EST — v01.58r — [2ec7564](https://github.com/LightAISolutions/Sales/commit/2ec7564081c7665ecb67cdc6287f952f6f7ed4bf)

### Added
- 👍/👎 buttons on every article let you rate relevance — your ratings teach the scoring to match your preferences on future analysis runs (tap again to clear a rating)

### Fixed
- The articles panel now shows your highest-scoring articles from the whole collection — previously it only showed the 100 most recently gathered, which a large backfill could fill with low-relevance items

## [v01.11w] — 2026-08-03 08:17:43 PM EST — v01.57r — [be1fdaa](https://github.com/LightAISolutions/Sales/commit/be1fdaa1c8ef9dc02f91a8a2f6ed899a0af33064)

### Changed
- Backfill progress now also shows how many history batches failed (e.g. "10/96 (0 found, 8 failed)"), so a struggling run is visible right away instead of only in the final message

## [v01.10w] — 2026-08-03 06:43:09 AM EST — v01.56r — [4e80170](https://github.com/LightAISolutions/Sales/commit/4e801704c3ed1c8000c38dc52c2f4fc06989d18b)

### Added
- New Backfill button on each project card gathers up to 2 years of historical news for your project, with live progress shown while it runs

## [v01.09w] — 2026-08-03 02:51:07 AM EST — v01.54r — [9682a32](https://github.com/LightAISolutions/Sales/commit/9682a326285bf894a37fa69d105c38b71610fa34)

### Fixed
- Compile and Analyze now automatically retry briefly if a step fails, instead of stopping with an error right away

## [v01.08w] — 2026-08-03 02:38:35 AM EST — v01.53r — [5609e93](https://github.com/LightAISolutions/Sales/commit/5609e936061e29c1d8af48a92d97d3b9092d6b6b)

### Fixed
- Clicking Analyze before gathering any articles now clearly says to run Compile first
- Clearer messages when the AI service reports a problem

## [v01.07w] — 2026-08-03 02:15:55 AM EST — v01.52r — [3f99df9](https://github.com/LightAISolutions/Sales/commit/3f99df95559316fed98a81d8c231543141be7dd4)

### Added
- New Analyze button scores each gathered article for relevance to your project, with live progress while it runs
- Articles now show a color-coded relevance score and a short summary, with the most relevant stories sorted to the top
- New Brief button writes an executive brief summarizing the most important developments across your relevant articles

## [v01.06w] — 2026-08-03 01:23:34 AM EST — v01.51r — [1c38ef1](https://github.com/LightAISolutions/Sales/commit/1c38ef13ebbce16787c36d57b096debdf02bf907)

### Added
- New Compile button on each project card gathers news for that project, with live progress shown while it runs
- New Articles view lists everything gathered so far — headlines link to the original story, with source, date, and a short preview

## [v01.05w] — 2026-08-02 09:42:54 PM EST — v01.50r — [b71d24e](https://github.com/LightAISolutions/Sales/commit/b71d24e87e61efca66ed241d5be799f73c567271)

### Added
- New project dashboard: see all your research projects at a glance with status, report schedule, and delivery labels
- "New Project" guided setup: a 5-step wizard asks about your topic, industries, keywords, sources, and report schedule, with a review screen before creating
- Edit, pause/resume, and archive controls on each project card
- Status messages confirm when a project is created, updated, paused, or archived

## [v01.04w] — 2026-07-18 02:39:24 AM EST — v01.14r — [cc86b54](https://github.com/LightAISolutions/Sales/commit/cc86b54bfa3e65e51730eddecb14fe439587fbfd)

### Removed
- The text box and Submit button have been removed from the page

## [v01.03w] — 2026-07-18 12:05:25 AM EST — v01.13r — [50449c4](https://github.com/LightAISolutions/Sales/commit/50449c4ba2dbaf36d2029a1aa8464bcfdbdf1670)

### Added
- New text box with a Submit button that saves your entry to the spreadsheet

## [v01.02w] — 2026-07-17 11:45:41 PM EST — v01.12r — [1d60d9f](https://github.com/LightAISolutions/Sales/commit/1d60d9f750f4b21a5e00240992bc65c5aafe15a6)

### Fixed
- The application screen now loads reliably in any browser, including when multiple Google accounts are signed in

## [v01.01w] — 2026-07-17 10:05:56 PM EST — v01.11r — [c4d1bd3](https://github.com/LightAISolutions/Sales/commit/c4d1bd39eb9b7fa2846592e901e2bb46034234fa)

### Fixed
- Sign-in now works reliably in any browser, including when multiple Google accounts are signed in

Developed by: LightAISolutions
