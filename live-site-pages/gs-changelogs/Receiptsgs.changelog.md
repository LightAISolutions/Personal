# Changelog — Receipts (Google Apps Script)

All notable user-facing changes to this script are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Older sections are rotated to [Receiptsgs.changelog-archive.md](Receiptsgs.changelog-archive.md) when this file exceeds 50 version sections.

`Sections: 28/50`

## [Unreleased]

*(No changes yet)*

## [v01.28g] — 2026-08-27 04:09:00 PM EST — v03.03r

### Changed
- Minor internal improvements

## [v01.27g] — 2026-08-17 03:36:35 AM EST — v02.62r

### Changed
- Clearer wording when the permission check finds nothing wrong with what the app asked for: it now points you at the list of what was actually granted, printed just above, instead of telling you to run a check you are already inside

## [v01.26g] — 2026-08-17 03:23:38 AM EST — v02.61r

### Changed
- The permission check now shows what the app **asked for** alongside what it was **actually given**, in one run. A capability can be missing for two opposite reasons — it was never requested, or it was requested and never approved — and the fix differs, so seeing only one of the two lists could point at the wrong repair
- The guidance that follows now reads those two lists against each other and names the specific repair, rather than listing general things to check

## [v01.25g] — 2026-08-17 02:52:34 AM EST — v02.58r

### Added
- A new built-in check reports whether the app's permission to use Google services is actually in force, as opposed to merely being requested. The two are separate, and only the first one determines whether anything works
- When permission is incomplete, the check now produces a direct link to re-approve it, so the fix no longer depends on hunting through account settings

## [v01.24g] — 2026-08-17 02:45:40 AM EST — v02.57r

### Changed
- The built-in access check now tells apart two problems that produce the same failure but need opposite fixes: the app not being *allowed* to read the access list, versus the list itself being missing, moved, or no longer shared. It previously assumed the second and pointed at the wrong repair
- When the cause is a permissions problem, the check now reports exactly which permissions the app has and which it is missing, naming the feature each one supports

## [v01.23g] — 2026-08-17 02:34:37 AM EST — v02.56r

### Fixed
- The specific reason the access list could not be read is now sent back to the page. It was already being worked out, but never delivered, so all four possible causes looked identical from the sign-in screen and could not be told apart

## [v01.22g] — 2026-08-17 02:10:00 AM EST — v02.54r

### Fixed
- Sign-in now tells apart "this account is not on the access list" from "the access list could not be reached right now". The second is reported as a temporary service problem, and is retried automatically before sign-in gives up
- A momentary failure to reach the access list is no longer remembered as a denial, so access is restored the moment the service recovers instead of several minutes later
- These interruptions no longer count toward the failed-attempt lockout

### Changed
- The app now refreshes its entry in the shared access directory only when its version changes, instead of on every single page load. Less simultaneous writing to the shared directory means far fewer of the interruptions above

## [v01.21g] — 2026-08-08 09:56:18 PM EST — v02.03r

### Added
- Business receipts can now carry a link to their PDF copy, your profile remembers your company name, and deleting a Business receipt cleans up its PDF too

### Changed
- The expense type is now recorded as "Business" instead of "Reimbursement" everywhere

## [v01.20g] — 2026-08-08 09:31:15 PM EST — v02.01r

### Added
- Every saved receipt now records whether it's a Personal or Reimbursement expense — history, reports, and spreadsheet exports can all filter by it, and older receipts count as Personal automatically

## [v01.19g] — 2026-08-08 08:11:03 PM EST — v01.99r

### Added
- A diagnostic tool the administrator can run to pinpoint exactly why a sign-in is being denied, so access problems can be found and fixed quickly

## [v01.18g] — 2026-08-05 10:26:18 PM EST — v01.82r

### Added
- Export previews — the app can now show you your export's Summary table before the file is built, and what you preview is exactly what gets exported

### Changed
- Smarter document reading — commercial invoices (supplier and wholesaler bills) are now recognized alongside regular receipts: the vendor, invoice date, and grand total are picked up correctly, case quantities and per-case prices are understood, and deposits, freight, and discounts are captured as their own line items
- Invoice purchases are automatically filed under a new "Business" category with fitting subcategories

## [v01.17g] — 2026-08-05 10:12:22 PM EST — v01.81r

### Added
- Spreadsheet exports can now include a customizable Summary table — its rows, columns, and numbers follow your choices in the new Export designer, and only the detail sheets you keep selected are included

### Fixed
- Fixed an issue where exports could fail whenever monthly summary data was present

## [v01.16g] — 2026-08-02 04:46:01 AM EST — v01.43r

### Added
- Combined view support — your receipts and those shared with you can now be listed, reported, and exported together, with each receipt labeled by its owner

### Changed
- When someone has given you full editing access to their receipts, you can now also delete those receipts — households can fully manage each other's scans

## [v01.15g] — 2026-08-02 12:31:41 AM EST — v01.41r

### Changed
- The admin menu button is now a bright blue ADMIN button that stands out clearly next to the status pills — it was easy to mistake for another status indicator after its recent move

## [v01.14g] — 2026-08-01 11:34:35 PM EST — v01.37r

### Fixed
- The admin menu button is now fully clickable — it sits next to the status pills instead of hidden behind the signed-in email, and its menu opens on the first tap

## [v01.13g] — 2026-08-01 09:57:44 PM EST — v01.36r

### Added
- Support for moving your older receipt photos into your own Google Drive, and smarter receipt reading that now picks subcategories matched to each receipt's category

## [v01.12g] — 2026-08-01 08:11:26 PM EST — v01.35r

### Changed
- Receipt reading no longer needs the photo to pass through shared storage — the app reads it directly, and your photo goes straight to your own Google Drive

## [v01.11g] — 2026-08-01 07:51:32 PM EST — v01.34r

### Added
- Receipt sharing between users — grants are checked on every request, so shared access works exactly as the owner set it (view only, or view & edit); deleting always stays with the owner

## [v01.10g] — 2026-08-01 07:38:37 PM EST — v01.33r

### Changed
- Your receipts are now private to your account — each signed-in user sees and manages only their own receipts, history, reports, and exports

## [v01.09g] — 2026-08-01 05:18:59 PM EST — v01.28r

### Added
- New reporting data feed that powers the Reports view and the home-screen month summary

## [v01.08g] — 2026-08-01 06:51:35 AM EST — v01.27r

### Added
- The receipt history and spreadsheet exports can now be filtered by spending category

## [v01.07g] — 2026-08-01 06:25:29 AM EST — v01.25r

### Added
- Access to the receipt photos folder now stays in sync with the app's access list — anyone granted access to the Receipts app can automatically view the photos, and removed users lose photo access too

### Changed
- Store names are now standardized automatically (Trader Joe's instead of TRADER JOE'S) — existing receipts, their IDs, and photo names were updated to match

## [v01.06g] — 2026-08-01 05:28:51 AM EST — v01.23r

### Added
- Receipt IDs are now readable — Store_Name-YYYYMMDD — and existing receipts (and their photos) were renamed automatically to match
- The store address is read from each receipt and saved alongside the other details
- Every purchased item is automatically assigned a department category (Produce, Meat & Seafood, Dairy & Eggs, Bakery, Frozen, Pantry, Snacks & Candy, Beverages, Household, Personal Care, and more)
- New "Monthly Summary" tab in the spreadsheet — per-month totals, receipt counts, and spending by category, kept up to date automatically and included in exports
- Saving a receipt that matches an already-saved one (same store, date, total) is flagged as a possible duplicate before anything is written

### Changed
- In the exported spreadsheet, items are now grouped under a highlighted header row per receipt with alternating colors, making it easy to tell receipts apart
- History can be sorted by the receipt's printed date instead of scan order

## [v01.05g] — 2026-08-01 04:38:48 AM EST — v01.22r

### Added
- Receipts can now be exported as a downloadable spreadsheet file with separate sheets for receipts and their individual items
- Receipt records can now be deleted — the record, its items, and its photo (moved to trash, recoverable) are all cleaned up together, with permission checks applied

### Changed
- The history list now returns only saved receipts unless unsaved uploads are explicitly requested

## [v01.04g] — 2026-08-01 04:12:06 AM EST — v01.21r

### Added
- Receipt history: past receipts can now be listed with search and date filters, and each receipt's full details and items can be retrieved

### Changed
- Automatic receipt reading is significantly faster: results are remembered briefly so retries never redo the work, the quicker reader is now used first, and fewer attempts are made before reporting a problem

## [v01.03g] — 2026-08-01 03:17:05 AM EST — v01.19r

### Changed
- Automatic receipt reading now retries on its own when the reading service is briefly busy, and switches to a backup reader if needed — temporary "high demand" errors should mostly resolve themselves

## [v01.02g] — 2026-08-01 03:07:59 AM EST — v01.18r

### Added
- Receipt photos are now read automatically using AI to pull out the merchant, date, totals, tax, and each purchased item
- Confirmed receipt details are saved into organized spreadsheet columns, with individual items stored separately for easy analysis
- Saving the same receipt again cleanly replaces its earlier details instead of duplicating them

## [v01.01g] — 2026-08-01 02:26:53 AM EST — v01.17r

### Added
- Uploaded receipt photos are now saved securely to a Google Drive folder
- Every upload is recorded in the receipts spreadsheet, ready for future browsing and analysis

Developed by: LightAISolutions
