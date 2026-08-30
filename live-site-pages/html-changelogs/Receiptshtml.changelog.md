# Changelog — Receipts

All notable user-facing changes to this page are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Older sections are rotated to [Receiptshtml.changelog-archive.md](Receiptshtml.changelog-archive.md) when this file exceeds 50 version sections.

`Sections: 36/50`

## [Unreleased]

*(No changes yet)*

## [v01.36w] — 2026-08-27 04:09:00 PM EST — v03.03r

### Changed
- Minor internal improvements

## [v01.35w] — 2026-08-17 02:34:37 AM EST — v02.56r

### Changed
- When sign-in cannot reach the access list, the message now says **which** part is at fault instead of giving the same wording for every cause, and it includes a short code you can quote when reporting it
- A retry is only suggested when the problem is genuinely temporary. A structural problem with the list now says plainly that it will not clear on its own and needs an administrator, rather than inviting you to keep trying

## [v01.34w] — 2026-08-17 02:10:00 AM EST — v02.54r

### Fixed
- A brief interruption while the app was checking your access no longer appears as "Access denied". Sign-in now says it is a temporary service problem and asks you to try again, instead of turning you away with a message that suggests your access had been removed
- After one of these interruptions, sign-in works again as soon as the service recovers rather than staying blocked for the next several minutes
- Retrying during an interruption no longer counts toward the failed-attempt limit, so a service hiccup can no longer escalate into a temporary lockout

## [v01.33w] — 2026-08-08 10:19:41 PM EST — v02.06r

### Added
- Each month's Business folder now carries a "Line Items" spreadsheet file (CSV — opens in Excel or Google Sheets) that the app maintains automatically: every Business save adds that receipt's items with date, store, quantities, prices, categories, receipt total, and receipt ID
- The file stays accurate on its own: editing a Business receipt rewrites its lines (moving them to the right month if the date changed), deleting removes them, and switching a receipt back to Personal removes both its lines and its PDF

## [v01.32w] — 2026-08-08 09:56:18 PM EST — v02.03r

### Added
- Business receipts are now filed automatically: saving one creates a PDF copy of the receipt photo in your own Google Drive, organized into Company → Year → Month folders by the receipt's date
- The first Business save asks once for your company name (it names the top-level folder); you can change it any time from ⚙️ Settings
- Receipt details show a "View PDF copy" link for filed receipts, and deleting a Business receipt also removes its PDF

### Changed
- The expense toggle is renamed to 🏠 Personal | 💼 Business and redesigned as a bold two-sided switch under an "Expense type" caption — the selected side is now filled solid, so the active mode is obvious at a glance

## [v01.31w] — 2026-08-08 09:31:15 PM EST — v02.01r

### Added
- New 🏠 Personal | 💼 Reimbursement toggle above the Scan button — pick which ledger your next scan belongs to; your choice is remembered on each device
- The review screen shows the expense type and lets you flip an individual receipt before saving
- Reimbursement receipts show a 💼 badge in History, and both History and Reports gain an expense-type filter
- Spreadsheet exports include a new Expense Type column and follow the expense-type filter
- Everything above is fully translated in 简体中文 mode

## [v01.30w] — 2026-08-05 10:26:18 PM EST — v01.82r

### Added
- Preview step in the Export designer — after choosing rows, columns, and values, you now see the exact Summary table your export will contain, right in the app; go Back to adjust your choices or tap Export when it looks right
- New "Business" category with subcategories made for commercial invoices (Inventory & Resale, Supplies & Packaging, Equipment, Freight & Shipping, Deposits & CRV, Professional Services) — available in the review screen, History and Reports filters, and fully translated in 简体中文 mode

### Changed
- Sharper photo uploads — dense, small-print documents like supplier invoices now stay legible for automatic reading

## [v01.29w] — 2026-08-05 10:12:22 PM EST — v01.81r

### Added
- Tapping "⬇️ Export .xlsx" now opens a short Export designer — pick what each row of the summary represents (category, subcategory, store, month, week, or individual items), how the columns split (months, categories, stores, or a single totals column), and what the numbers show (receipt totals, item costs, or purchase counts)
- Exports now open with a Summary table built from those choices, and you decide which detail sheets come along with it
- The designer remembers your last setup on each device, and it's fully translated in 简体中文 mode

## [v01.28w] — 2026-08-02 08:31:18 PM EST — v01.48r

### Changed
- 简体中文 mode now also translates the review screen — the receipt category dropdown and every line item's subcategory dropdown show Chinese names while you check a scanned receipt

## [v01.27w] — 2026-08-02 08:10:52 PM EST — v01.47r

### Changed
- 简体中文 mode now translates much more: every category and subcategory name (in History and Reports filters, report breakdowns, and the month summary), the month summary itself ("N 张收据 · 2026年8月" and the empty-month message), and report period labels — weekdays as 周一–周日 (dates unchanged), months as 2026年X月, and half-years as 上半年/下半年

## [v01.26w] — 2026-08-02 05:44:59 AM EST — v01.46r

### Added
- 简体中文 support — tap the ⚙️ Settings cog and choose "Language · 中文" to switch the whole app interface to Simplified Chinese (buttons, filters, reports, sharing, encouraging messages, and more); tap "语言 · English" to switch back
- Your language choice is remembered on each device
- Receipt contents (store names, item descriptions, categories) stay exactly as scanned

## [v01.25w] — 2026-08-02 05:10:46 AM EST — v01.45r

### Changed
- In Reports' Line Items with "Group by item" on, each item row now shows your total spend on that item across all purchases — tap the row to see the individual prices, as before

## [v01.24w] — 2026-08-02 05:05:19 AM EST — v01.44r

### Added
- Sharing your receipts now also shares your receipt photos — the person you grant access to can open the original photo of any receipt you scanned, automatically
- Existing grants are covered too: the next time you open the app, photo access is set up for everyone you've already shared with — nothing to redo
- Revoking someone's access also removes their access to your photos

## [v01.23w] — 2026-08-02 04:46:01 AM EST — v01.43r

### Added
- "Combined (mine + shared)" in the History and Reports "Viewing" pickers — see both of your households' receipts merged together in one list, one report, and one Line Items view
- In the combined History, each receipt shows a small name chip so you can tell whose scan it was, and tapping into any receipt opens and edits it seamlessly no matter who scanned it
- Spreadsheet exports now include an Owner column, so combined exports stay easy to split

## [v01.22w] — 2026-08-02 04:34:42 AM EST — v01.42r

### Added
- New "🧾 Line items" section in Reports — pick a category (and optionally a subcategory like Pantry) to see every matching purchased item with its date, store, and price
- Search box inside the section to find a specific item (like "olive oil") and read its price history at a glance
- "Group by item" switch — identical items collapse into one row showing how many times you bought it, its lowest–highest price range, and the latest price; tap the row to see every dated purchase across stores
- The section obeys all your Reports filters, so date ranges and store filters narrow the item list too

## [v01.21w] — 2026-08-02 12:11:48 AM EST — v01.40r

### Added
- A "Clear" button in the History and Reports filters — one tap resets every filter back to default
- A Settings ⚙️ button in the bottom-right corner — tap it to see your signed-in account and the "Sign out" / "Sign out everywhere" options (they've moved there from the home screen)
- A hand-drawn receipt icon on the sign-in screen, matching the app's paper-and-ink look

### Changed
- "Sort by receipt date" in History now sits right under the Filters row, so you can flip the order without opening the filters
- The encouraging messages on the home screen now change at a more relaxed pace

### Removed
- The little saved checkmark next to each receipt in History — everything in History is already saved, so it wasn't telling you anything

## [v01.20w] — 2026-08-01 11:52:43 PM EST — v01.39r

### Changed
- Receipt history got the same roomy treatment as Reports — search, dates, category, and sort now tuck into a collapsible "Filters" row that starts closed, with the same "n active" note when hidden filters are narrowing the list
- The Export button stays right on the Filters row, so downloading your spreadsheet never requires opening the filters
- In Reports, the Circle graphs switch now sits on the always-visible Filters row — flip between bar and circle graphs with one tap, no need to open the filters

## [v01.19w] — 2026-08-01 11:44:33 PM EST — v01.38r

### Changed
- Reports is much roomier — the filters now tuck into a collapsible "Filters" row (tap + to open, − to close) and start closed, so your totals and breakdowns get most of the screen
- When filters are hidden but active, the Filters row shows a small "n active" note so you always know a filter is narrowing the numbers
- The Reports panel itself is a little taller, showing more of your report without scrolling

## [v01.18w] — 2026-08-01 09:57:44 PM EST — v01.36r

### Added
- A charming new scan progress display — a stamp card whose stages (Snap → Save → Read → Done) get inked in as your receipt is processed, with a progress bar above it
- Sign out buttons on the home screen — sign out of this app, or everywhere, right from the front page
- Every category now has its own subcategories (Dining, Transport, Health, Shopping, Entertainment, Utilities, Travel and more), appearing when you pick that category — in both the review screen and Reports

### Changed
- Encouraging messages now politely wait until scanning is finished instead of covering the progress display
- If you have older receipt photos stored in shared space, they're quietly moved into your own Google Drive the next time you open the app

### Fixed
- Removed a broken image icon that could appear next to the scan status

## [v01.17w] — 2026-08-01 08:11:26 PM EST — v01.35r

### Changed
- Your receipt photos now save to your own Google Drive, in a "Receipts App" folder created for you automatically — you own your photos, and they're renamed to match each saved receipt
- On your next sign-in, Google will ask once for permission to let the app manage the files it creates in your Drive — that's the new photo storage
- Deleting a receipt now moves its photo to your own Drive trash, where it's recoverable for about 30 days

## [v01.16w] — 2026-08-01 07:51:32 PM EST — v01.34r

### Added
- Sharing — a new button on the home screen lets you give another user access to your receipts (view only, or view & edit) and take it back anytime; you can also see who shared with you
- "Viewing" picker in History and Reports — switch between your own receipts and those shared with you
- Sensible guardrails on shared views: only the owner can delete, and editing is possible only when the owner allowed it

## [v01.15w] — 2026-08-01 07:04:39 PM EST — v01.32r

### Changed
- Even cleaner home screen — the account bar and the small version and timer indicators are now tucked away with the other technical controls

## [v01.14w] — 2026-08-01 06:53:29 PM EST — v01.31r

### Changed
- Cleaner home screen — the small technical toggle buttons in the bottom corner are now tucked away out of sight

## [v01.13w] — 2026-08-01 06:08:39 PM EST — v01.30r

### Changed
- The departments dropdown in Reports now appears only when Groceries is the chosen category, keeping the filters uncluttered the rest of the time
- Bigger circle graphs — the circle now sits centered above its breakdown list, and each graph can show up to 20 groups before smaller ones fold into "Other"
- The circle-graphs checkbox label is simply "Circle graphs" now

## [v01.12w] — 2026-08-01 05:53:12 PM EST — v01.29r

### Added
- "By department" breakdown in Reports — appears when the category filter is set to Groceries, showing where the grocery money went (Produce, Dairy, Meat, …)
- Circle graphs option in Reports — a checkbox switches every group to a donut chart with percentage comparisons
- Report groups are now collapsible — everything starts minimized; tap the "+" on the right of a group to expand it

### Changed
- Friendlier report period labels — days show as "Wed, 7/29/26", weeks as "7/26/26 - 8/1/26" (Sunday through Saturday), months as "July 2026", and half-years as "First Half of 2026" / "Second Half of 2026"

## [v01.11w] — 2026-08-01 05:18:59 PM EST — v01.28r

### Added
- Upload receipts — pick up to 15 photos from your gallery at once; they're read one after another and then reviewed one at a time, with a "n of N" counter
- Reports — daily, weekly, monthly, bi-annual, and annual spending totals with instant filtering by store, category, department, date range, and cost range, plus category and top-merchant breakdowns
- Edit saved receipts from History — fix any detail or remove line items without deleting and re-uploading
- Month-at-a-glance summary on the home screen showing this month's spend, receipt count, and top categories

### Changed
- Fresh new look — warm paper-and-ink design with a printed-receipt style summary card
- The idle status line now cycles through encouraging messages

## [v01.10w] — 2026-08-01 06:51:35 AM EST — v01.27r

### Added
- Category dropdown in History — narrow the list (and spreadsheet exports) to Groceries, Dining, Transport, Health, Shopping, Entertainment, Utilities, Travel, or Other

### Changed
- History filters reorganized: the merchant search sits on its own row, with labeled "Start Date" and "End Date" boxes side-by-side beneath it

## [v01.09w] — 2026-08-01 06:36:33 AM EST — v01.26r

### Removed
- The "Show unsaved uploads" checkbox in History — the history list and exports now always show saved receipts only

## [v01.08w] — 2026-08-01 06:06:54 AM EST — v01.24r

### Added
- Each item in the review screen now has its own department dropdown (Produce, Dairy & Eggs, Snacks & Candy, and 13 more) — pre-filled automatically from the photo and adjustable before saving

### Fixed
- Department assignments read from the photo are now correctly kept when saving — previously they could be lost during review

## [v01.07w] — 2026-08-01 05:28:51 AM EST — v01.23r

### Added
- Progress bar under the buttons showing each step of the scan (compressing → uploading → reading → done, and saving)
- "Sort by receipt date" checkbox in History — orders receipts by the date printed on them instead of when they were scanned
- Store address field in the review screen (read automatically from the photo, editable before saving) and shown in receipt details
- Duplicate protection: saving a receipt that matches an already-saved one (same store, date, and total) asks for confirmation before saving again
- Each item now shows its department category (Produce, Dairy & Eggs, Snacks, and more) in receipt details

### Changed
- Status messages moved below the Scan and History buttons for a cleaner layout

## [v01.06w] — 2026-08-01 04:38:48 AM EST — v01.22r

### Added
- New "⬇️ Export .xlsx" button in History — downloads a spreadsheet file with two organized sheets (receipts + individual items), respecting your current search and date filters
- Receipts can now be deleted from History — tap 🗑, then tap "Delete?" to confirm (the photo moves to the Drive trash, recoverable for about 30 days)
- New "Show unsaved uploads" checkbox in History

### Changed
- History now shows only saved receipts by default — unsaved uploads appear only when the checkbox is ticked

## [v01.05w] — 2026-08-01 04:12:06 AM EST — v01.21r

### Added
- New "🧾 History" button — browse all past receipts with search by store name and date-range filters
- Tap any receipt in the list to see its full details: amounts, category, every line item, and a link to the original photo

## [v01.04w] — 2026-08-01 03:51:49 AM EST — v01.20r

### Fixed
- "Save receipt" and "Discard" are now always visible at the bottom of the review screen — on phones with long receipts they could previously be cut off below the screen and unreachable

### Changed
- The review screen now sizes itself to the phone's actual visible screen area, and the item list scrolls behind the always-visible button bar

## [v01.03w] — 2026-08-01 03:17:05 AM EST — v01.19r

### Added
- New "Retry extraction" button appears when automatic reading fails — retries on the photo already uploaded, no need to re-take it

### Changed
- Clearer guidance when automatic reading fails, including when the service is briefly busy

## [v01.02w] — 2026-08-01 03:07:59 AM EST — v01.18r

### Added
- After scanning, receipt details are now read automatically from the photo — merchant, date, amounts, and individual items appear in a review screen
- New review screen lets you check and correct every detail (including adding or removing line items) before anything is saved
- A category can be picked for each receipt (Groceries, Dining, Transport, and more) to make spending analysis easier
- If automatic reading fails, the review screen opens blank so details can be entered by hand

## [v01.01w] — 2026-08-01 02:26:53 AM EST — v01.17r

### Added
- New "📷 Scan receipt" button — photograph a receipt with your phone camera (or pick an image file on a computer) and it uploads automatically after you sign in
- Photos are compressed on your device before uploading, so saving is fast even on mobile data
- The app can now be installed to your phone's home screen and launched full-screen like a regular app (use your browser's "Add to Home Screen")

Developed by: LightAISolutions
