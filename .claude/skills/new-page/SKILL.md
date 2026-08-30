---
name: new-page
description: Create a new HTML embedding page with all required boilerplate — version files, changelogs, sounds, and optional GAS project setup. Usage — /new-page <project-name>
user-invocable: true
disable-model-invocation: true
argument-hint: <project-name>
---

# New Embedding Page Setup

Create a new HTML embedding page with all the required files and boilerplate.

## Arguments

- `$0` — project name (e.g. `my-project`, `dashboard`). Used for the directory name and file naming

## Steps

1. **Copy the template** — start from the appropriate HTML template in `live-site-pages/templates/` (`HtmlAndGasTemplateAutoUpdate-noauth.html.txt` for standard pages, or `HtmlAndGasTemplateAutoUpdate-auth.html.txt` for pages with Google Authentication), which includes:
   - Version file polling logic (fetches html.version.txt on load, polls every 10s)
   - Version indicator pill (bottom-right corner)
   - Green "Website Ready" + Blue "Code Ready" splash overlays + sound playback
   - Orange "Under Maintenance" splash overlay
   - AudioContext handling and screen wake lock
   - GAS version pill + polling (auto-activates when `gs.version.txt` exists — stays hidden otherwise)
   - GAS changelog popup (auto-activates with GAS pill)

2. **Create the directory** — `live-site-pages/$0/`

3. **Create the version file** — `live-site-pages/html-versions/$0html.version.txt` (note: lives in the shared `html-versions/` folder, not the page subdirectory) with initial content `|v01.00w|`

4. **Create the sounds directory** — copy `live-site-pages/sounds/` into `live-site-pages/$0/sounds/`

5. **Update the page title** — replace `YOUR_PROJECT_TITLE` in `<title>` with a human-readable project name (ask the user if not obvious from the project name)

6. **Add developer branding** — ensure `<!-- Developed by: DEVELOPER_NAME -->` is the last line (resolve from Template Variables)

7. **Create page changelog** — create `$0html.changelog.md` in `live-site-pages/html-changelogs/`. Update the title and archive link filename. Also create `$0html.changelog-archive.md` in the same directory

9. **Ask about GAS** — ask the user if this page needs a Google Apps Script project embedded. If yes:
   - Create `googleAppsScripts/<ProjectName>/` directory
   - Copy the appropriate GAS template from `live-site-pages/templates/` (select based on test features and auth needs) → `$0.gs`
   - Create `$0.config.json` with placeholder values
   - Create `live-site-pages/gs-versions/$0gs.version.txt` with content `v01.00g` (GAS version file — lives in `live-site-pages/gs-versions/` only)
   - Create GAS changelogs: `$0gs.changelog.md` and `$0gs.changelog-archive.md`
   - Register in the GAS Projects table in `.claude/rules/gas-scripts.md`

10. **Update repo docs** — update REPO-ARCHITECTURE.md diagram, README.md project structure tree, and any other docs that reference the list of pages

11. **Commit and push** — standard Pre-Commit and Pre-Push checklists apply

## File Naming Convention

- HTML version files: `live-site-pages/html-versions/<page-name>html.version.txt`
- HTML changelogs: `live-site-pages/html-changelogs/<page-name>html.changelog.md`
- HTML changelog archives: `live-site-pages/html-changelogs/<page-name>html.changelog-archive.md`
- GAS version files: `live-site-pages/gs-versions/<page-name>gs.version.txt`
- GAS changelogs: `live-site-pages/gs-changelogs/<page-name>gs.changelog.md`
- GAS changelog archives: `live-site-pages/gs-changelogs/<page-name>gs.changelog-archive.md`
- No two files in the repo may share the same basename (Pre-Commit #18)

Developed by: LightAISolutions
