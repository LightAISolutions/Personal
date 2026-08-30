---
name: maintenance-mode
description: Toggle maintenance mode on/off for HTML pages. Activates an orange maintenance overlay on the live site by editing html.version.txt. Usage — /maintenance-mode <page> <on|off>
user-invocable: true
disable-model-invocation: true
argument-hint: <page-name> <on|off>
---

# Maintenance Mode

Toggle the maintenance overlay on or off for HTML pages deployed to GitHub Pages.

## Arguments

- `$0` — page name (e.g. `index`, `test`, `soccer-ball`) or `all` for every page
- `$1` — `on` to activate, `off` to deactivate

## Page Scope Rules

- If the user says **"all"** (or equivalent), apply to every page in `live-site-pages/`
- If a specific page is named, apply only to that page
- If no page is specified, **ask which pages** using `AskUserQuestion` — list all available pages as options plus an "All pages" option

## Activate (on)

1. Edit the page's version file at `live-site-pages/html-versions/<page-name>html.version.txt`
2. Change the first field from empty to `maintenance` and fill the third field with the exact display string
3. Format: `maintenance|vXX.XXw|As of: HH:MM:SS AM/PM EST MM/DD/YYYY`
4. Get the timestamp value by running: `TZ=America/New_York date '+As of: %I:%M:%S %p EST %m/%d/%Y'`
5. **Do NOT bump the version** — only edit the first and third fields

## Deactivate (off)

1. Edit the page's version file at `live-site-pages/html-versions/<page-name>html.version.txt`
2. Clear the first field back to empty: `maintenance|vXX.XXw|...` → `|vXX.XXw|`
3. **Do NOT bump the version** — only clear the maintenance prefix and timestamp

## Custom Messages

Users can provide a custom message instead of the default timestamp:
- Example: `/maintenance-mode index on "Back online soon!"`
- Result: `maintenance|v01.13w|Back online soon!`

## What the User Sees

- **On**: orange full-screen overlay with developer logo and "This Webpage is Undergoing Maintenance" title
- **Off**: if version unchanged, overlay fades out gracefully; if version also changed, page auto-reloads

## Commit and Push

After editing the version file(s), commit and push. Standard Pre-Commit and Pre-Push checklists apply. No version bump needed for standalone maintenance toggles.

Developed by: LightAISolutions
