# Changelog Archive — Profiler

Archived changelog sections rotated from [Profilerhtml.changelog.md](Profilerhtml.changelog.md).

## [v01.18w] — 2026-08-09 11:18:02 PM EST — v02.24r — [a288645](https://github.com/LightAISolutions/Sales/commit/a288645799c20d80924396004fd6c47b6b357506)

### Changed
- Source citations now show each article's publication date instead of the date it was looked up, in the dossier view and in exported documents
- Sources are now listed chronologically with the most recent news first; undated reference pages appear at the end

## [v01.17w] — 2026-08-09 05:09:33 AM EST — v02.19r — [3b7949d](https://github.com/LightAISolutions/Sales/commit/3b7949db9a12b54e84f565e65afb75f6543c3782)

### Fixed
- PDF exports no longer show the page name in the top corner or the web address in the bottom corner — exported documents are now clean, with proper page margins built into the document itself

## [v01.16w] — 2026-08-09 04:30:58 AM EST — v02.17r — [0312e54](https://github.com/LightAISolutions/Sales/commit/0312e545ac0f61be92bcf499fdfa7e9af46e23ec)

### Added
- Dossier styles — five presentation styles (Default, Bloomberg, Equity Research, Intel Briefing, Smart Brevity) that change section titles, typography, and spacing throughout the app **and** in the exported Word/PDF documents, so the export always matches the on-screen style
- Style switcher for the app owner — a 🖋 button opens a picker to change the style; the choice applies on that device

### Changed
- Dossiers now display in the **Intel Briefing** style by default — briefing-style section titles (Background, Key Judgments, Technical Annex), numbered analytical judgments, and a typewriter-style export document

## [v01.15w] — 2026-08-09 03:29:35 AM EST — v02.15r — [62c6809](https://github.com/LightAISolutions/Sales/commit/62c6809b0e96a40687dd56ed3af435f593786715)

### Added
- Sign-in required — the app now asks for a one-time Google sign-in before anything is shown; access is limited to approved users

### Changed
- Previous dossier versions (the "Versions 🕘" browser) are now visible to the app owner only — everyone else sees the current version of each dossier

## [v01.14w] — 2026-08-09 03:03:41 AM EST — v02.14r — [7e089a7](https://github.com/LightAISolutions/Sales/commit/7e089a7ade424c8dbbfaac897e164901d7426307)

### Added
- Team-ready field notes: signed-in team members can now suggest notes — type what you learned, attach Word/PDF files, and rate your confidence; suggestions go to the app owner for review instead of publishing directly. Full note management remains reserved for the owner

## [v01.13w] — 2026-08-09 02:37:16 AM EST — v02.12r — [f9ef3e0](https://github.com/LightAISolutions/Sales/commit/f9ef3e0f578a759bca123d4889c574ee74803a54)

### Fixed
- The field-note form now works on phones where it previously showed an "unable to open the file" error — the form is built into the page itself instead of loading an embedded frame

### Changed
- Sign in with Google directly in the note box (one time); then type notes, attach Word/PDF files, and manage existing notes — all in place

## [v01.12w] — 2026-08-09 02:20:26 AM EST — v02.11r — [cdb8c74](https://github.com/LightAISolutions/Sales/commit/cdb8c74052b1acfed8e94f06a0ebb78965e9a29e)

### Fixed
- The field-note form failed to load inside the note box on some phones ("unable to open the file" error) — the box now loads the form in a way that avoids that failure

### Added
- "Open the note form in its own tab" link under the note box — a full-screen fallback that always works

## [v01.11w] — 2026-08-09 01:30:51 AM EST — v02.09r — [829f7e0](https://github.com/LightAISolutions/Sales/commit/829f7e0cb8fe2a7f17daa660f2a7e9894cf35a4d)

### Changed
- The in-app field-note box is now live — the "Add a Field Note" section saves typed notes and Word/PDF uploads directly inside the app (one-time Google sign-in)

## [v01.10w] — 2026-08-09 01:11:29 AM EST — v02.08r — [3c30acd](https://github.com/LightAISolutions/Sales/commit/3c30acd618ed609af1274204e2bce0290e5581c1)

### Added
- The "Add a Field Note" box can now save notes and upload Word/PDF files directly inside the app — type, attach, and save in one place with a one-time Google sign-in (activates once the backend is connected; until then the box keeps its current behavior)

## [v01.09w] — 2026-08-08 10:36:20 PM EST — v02.07r — [58d0d4e](https://github.com/LightAISolutions/Sales/commit/58d0d4eebd8a5c1c375bca27fc11636924928b87)

### Added
- "Field note 📝" button at the top of every dossier — one tap jumps straight to the note box (previously it was easy to miss at the bottom of long dossiers)
- "Upload Word/PDF 📎" button in the note box — opens a form where you attach your meeting-notes document; the file is stored and a log entry is created automatically
- "📎 File" shortcut in the Field Notes changelog header for uploading a document without opening a dossier

### Changed
- Two test entries were removed from the Field Notes log

## [v01.08w] — 2026-08-08 10:11:17 PM EST — v02.04r — [baf1388](https://github.com/LightAISolutions/Sales/commit/baf1388004f57a040e536afbd684b813dbef5b81)

### Added
- "Add a Field Note" box at the bottom of every dossier — type what you learned, pick how you learned it and your 0–100 confidence, and save in one tap

### Changed
- The "＋ Add note" button in the Field Notes changelog now opens the same streamlined note form

## [v01.07w] — 2026-08-08 07:36:43 PM EST — v01.99r — [ebb8720](https://github.com/LightAISolutions/Sales/commit/ebb8720a26d61049557381f6e9c4d2f67dc7f32d)

### Added
- Dossier version history — companies with archived dossier versions show a "Versions 🕘" button; browse any previous version as a clearly-labeled historical snapshot with one tap back to the current dossier
- "＋ Add note" button in the Field Notes changelog — opens the new sign-in-protected note form where you can record what you learned and rate your confidence

## [v01.06w] — 2026-08-07 11:02:33 PM EST — v01.94r — [320f105](https://github.com/LightAISolutions/Sales/commit/320f105f4b65e551d2c48521fe3dd201d7f64f8a)

### Added
- Field Notes changelog — a ⚙ button in the bottom-right of the dashboard opens a chronological log of first-hand notes, filterable by company, each showing its date, source type, and a 0–100 confidence rating
- Study guides — companies with a published study guide now show a "Study guide 📖" button on their dossier, opening a need-to-know brief with tap-to-flip flashcards

## [v01.05w] — 2026-08-07 09:49:43 PM EST — v01.92r — [a4ed463](https://github.com/LightAISolutions/Sales/commit/a4ed4637ffd893b3da92fcbb9238cf70d4372f08)

### Added
- Profiler can now be installed to your phone's home screen as a real app — added via "Add to Home Screen", it opens full-screen with its own icon, without the browser address bar

## [v01.04w] — 2026-08-07 03:26:14 AM EST — v01.91r — [4df98e4](https://github.com/LightAISolutions/Sales/commit/4df98e4a21d3f92ddad4e8f3d7de912bde1576b3)

### Changed
- Profiler now has its own logo — a corporate dossier emblem shown on the loading and maintenance screens, replacing the generic placeholder

## [v01.03w] — 2026-08-07 12:34:58 AM EST — v01.89r — [f1d7d29](https://github.com/LightAISolutions/Sales/commit/f1d7d298b24d0fac17e0006d6ea10faec52ffe4f)

### Changed
- The app has a new name: **Profiler** — the page title, header, and document exports now use the new name

## [v01.02w] — 2026-08-07 12:02:06 AM EST — v01.88r — [7cd6566](https://github.com/LightAISolutions/Sales/commit/7cd656696bc2df9a57ac14017f4fa3897202d90b)

### Added
- Recent Developments timeline on company dossiers — dated news highlights with a category tag and a one-line strategy takeaway per event
- Strategy Read section — a clearly-labeled analytical view of each company's sales and product direction
- Richer product entries: competitive positioning, how each product is sold, target segments, and roadmap items
- Word and PDF exports include all the new sections

## [v01.01w] — 2026-08-06 09:50:12 PM EST — v01.84r — [bb32dad](https://github.com/LightAISolutions/Sales/commit/bb32dad591c6101e0d701b4e1ab3f32fd5f099fb)

### Added
- Export button on every company dossier
- Document-style preview screen so you can check for mistakes before exporting
- Export to Word (downloads a .doc file) or PDF (opens the print dialog — choose "Save as PDF")

Developed by: LightAISolutions
