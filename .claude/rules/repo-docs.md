---
paths:
  - "repository-information/**"
  - "README.md"
  - "CONTRIBUTING.md"
  - "SECURITY.md"
  - "CODE_OF_CONDUCT.md"
---

# Repository Documentation Rules

*Actionable rules: see Pre-Commit Checklist items [PC-REPO-ARCH] #5, [PC-CHANGELOG] #6, [PC-README-TREE] #7, [PC-COMMIT-MSG] #8, [PC-LINKS] #11, [PC-README-TIPS] #12, [PC-QR-CODE] #13 in CLAUDE.md.*

## REPO-ARCHITECTURE.md Structural Updates

The Mermaid diagrams in `repository-information/REPO-ARCHITECTURE.md` show the repo-wide architecture: how environments (pages) connect to each other and to shared infrastructure (CI/CD, GitHub Pages, templates, versioning, developer tools). Diagrams are updated when any change affects what they depict — structural changes (files added, moved, deleted), behavioral changes (code logic that a diagram documents), or workflow changes (CI/CD steps shown in a diagram). Version bumps alone do NOT trigger diagram updates. Version numbers are not displayed in diagram nodes.

### Environment scope rule
REPO-ARCHITECTURE.md must NOT include the internal processes of **individual** environments (page lifecycle states, maintenance mode internals, splash screen flows, environment-specific workflows). Environments appear as **nodes** that show their connections to other environments and shared repo components — but their internal behavior is documented in per-environment diagrams under `repository-information/diagrams/`. When adding or modifying REPO-ARCHITECTURE.md diagrams, keep environment nodes as opaque boxes — show what they connect to, not what happens inside them. If internal process detail is needed, add it to the corresponding per-environment diagram instead.

**Exception — template-level behaviors**: the auto-refresh loop, GAS iframe interaction, and maintenance mode state machine ARE included in REPO-ARCHITECTURE.md (section 3) as a combined state diagram because they are inherited by **all pages** via the HTML/GAS templates. This diagram is generic (not referencing specific environments) and should only change when the templates (`HtmlAndGasTemplateAutoUpdate-noauth.html.txt`/`HtmlAndGasTemplateAutoUpdate-auth.html.txt` or the GAS script templates) change — not when individual environments change.

### Diagram accuracy and generation reference
*Full reference: see `.claude/rules/mermaid-diagrams.md` — auto-injects when `REPO-ARCHITECTURE.md` or `repository-information/diagrams/**` are being edited.*

Covers: the 7 accuracy requirements (no invented interactions, server-side vs client-side distinction, state-machine faithfulness, timing accuracy), the GitHub rendering-support table per diagram type, the mindmap dark-mode theme fix, the full pako + js-base64 URL generation procedure, the Python regex replacement pattern for safely inserting URLs, the mandatory decompression verification, and the six common failure modes.

### Adding new pages
When a new embedding page is created (see New Embedding Page Setup Checklist in `.claude/rules/html-pages.md`), add:
- A page node in the "Environments (Pages)" subgraph: `NEWPAGE["[template] page-name.html\n(Display Name)"]`
- Connection edges showing how the page relates to shared resources (version polling, iframe embedding, etc.)
- **A per-environment diagram in `repository-information/diagrams/` for GAS-backed pages only** — required when the page has a Google Apps Script backend (entry in the GAS Projects table in `.claude/rules/gas-scripts.md`). The diagram documents the HTML ↔ GAS interaction flow (auth, polling, data fetch, iframe embedding, deployment webhook, etc.). Include an "Open in mermaid.live" link above the code block (see "Mermaid Diagrams — mermaid.live Links" section below). **Optional for standalone client-side utilities** — pages with no GAS backend (e.g. splash/animation pages, self-contained client-side tools) may omit the per-environment diagram, since a diagram for such a page would reduce to "page loads → user interacts → client-side JS runs" with no meaningful structure to document. If you later add GAS functionality to a standalone utility, the diagram becomes required at that point. *Currently exempt pages: `text-compare` — a client-side-only standalone utility.*

## Keeping Documentation Files in Sync

*Mandatory rules: see Pre-Commit Checklist items [PC-REPO-ARCH] #5, [PC-CHANGELOG] #6, [PC-README-TREE] #7, [PC-COMMIT-MSG] #8 in CLAUDE.md. Reference table below for additional files to consider.*

| File | Update when... |
|------|---------------|
| `.gitignore` | New file types or tooling is introduced that generates artifacts (e.g. adding Node tooling, Python venvs, build outputs) |
| `.editorconfig` | New file types are introduced that need specific formatting rules |
| `CONTRIBUTING.md` | Development workflow changes, new conventions are added to CLAUDE.md that contributors need to know |
| `SECURITY.md` | New attack surfaces are added (e.g. new API endpoints, new OAuth flows, new deployment targets) |
| `CITATION.cff` | Project name, description, authors, or URLs change |
| `.github/ISSUE_TEMPLATE/*.yml` | New project areas are added (update the "Affected Area" / "Area" dropdown options) |
| `.github/PULL_REQUEST_TEMPLATE.md` | New checklist items become relevant (e.g. new conventions, new mandatory checks) |

Update these only when the change is genuinely relevant — don't force unnecessary edits.

## Internal Link Reference

*Rule: see Pre-Commit Checklist item [PC-LINKS] #11 in CLAUDE.md.*

Files live in three locations: repo root, `.github/`, and `repository-information/`. Cross-directory links must use `../` to traverse up before descending into the target directory.

### Why community health files live at root (not `.github/`)
Community health files (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`) live at root so relative links resolve correctly in both GitHub blob-view and sidebar-tab contexts — files inside `.github/` break in the sidebar tab because `../` traverses GitHub's URL structure differently there.

### File locations
| File | Actual path |
|------|-------------|
| README.md | `./README.md` (root) |
| CLAUDE.md | `./CLAUDE.md` (root) |
| LICENSE.md | `./LICENSE.md` (root) |
| CODE_OF_CONDUCT.md | `./CODE_OF_CONDUCT.md` (root) |
| CONTRIBUTING.md | `./CONTRIBUTING.md` (root) |
| SECURITY.md | `./SECURITY.md` (root) |
| PULL_REQUEST_TEMPLATE.md | `.github/PULL_REQUEST_TEMPLATE.md` |
| REPO-ARCHITECTURE.md | `repository-information/REPO-ARCHITECTURE.md` |
| CHANGELOG.md | `repository-information/CHANGELOG.md` |
| CHANGELOG-archive.md | `repository-information/CHANGELOG-archive.md` |
| GOVERNANCE.md | `repository-information/GOVERNANCE.md` |
| IMPROVEMENTS.md | `repository-information/IMPROVEMENTS.md` |

| SUPPORT.md | `repository-information/SUPPORT.md` |
| TODO.md | `repository-information/TODO.md` |
| Per-page HTML changelogs | `live-site-pages/html-changelogs/<name>html.changelog.md` |
| Per-page HTML changelog archives | `live-site-pages/html-changelogs/<name>html.changelog-archive.md` |
| Per-page GAS changelogs | `live-site-pages/gs-changelogs/<name>gs.changelog.md` |
| Per-page GAS changelog archives | `live-site-pages/gs-changelogs/<name>gs.changelog-archive.md` |

### Common cross-directory link patterns
| From directory | To file in `repository-information/` | Correct relative path |
|----------------|--------------------------------------|----------------------|
| `.github/` | `repository-information/SUPPORT.md` | `../repository-information/SUPPORT.md` |
| `.github/` | `repository-information/CHANGELOG.md` | `../repository-information/CHANGELOG.md` |

| From directory | To root files | Correct relative path |
|----------------|--------------|----------------------|
| `repository-information/` | `README.md` | `../README.md` |
| `repository-information/` | `CLAUDE.md` | `../CLAUDE.md` |
| `repository-information/` | `CONTRIBUTING.md` | `../CONTRIBUTING.md` |
| `repository-information/` | `SECURITY.md` | `../SECURITY.md` |
| `repository-information/` | `CODE_OF_CONDUCT.md` | `../CODE_OF_CONDUCT.md` |
| `.github/` | `README.md` | `../README.md` |
| `.github/` | `CLAUDE.md` | `../CLAUDE.md` |

## Relative Path Resolution on GitHub

Relative links in markdown files resolve from the blob-view URL directory (`/org/repo/blob/main/...`). Each `../` climbs one URL segment. Root files need 2 `../` to reach `/org/repo/`, subdirectory files need 3. This works on any fork because the org/repo name is part of the URL itself.

### When relative paths work vs. don't

| Context | Works? | Reason |
|---------|--------|--------|
| Markdown files (`.md`) rendered on GitHub | Yes | GitHub renders links as `<a href="...">`, browser resolves relative paths from blob-view URL |
| YAML config files (`config.yml`, `CITATION.cff`) | No | GitHub processes these as structured data, not rendered markdown — relative URLs may not be resolved |
| Mermaid diagram text labels | No | Text content inside code blocks, not rendered as clickable links |
| GitHub Pages URLs (`org.github.io/repo`) | No | Different domain entirely — can't be reached via relative path from `github.com`. Use a placeholder (e.g. `*(deploy to activate)*`) and replace via drift check step #4 |

### Adding new relative links

When creating a new markdown file with links to GitHub web app routes (issues, security advisories, settings, etc.):

1. Determine the file's directory depth relative to the repo root
2. Add 2 for `blob/main/` (or `blob/{branch}/`) to get the total `../` count needed to reach `/org/repo/`
3. Append the GitHub route (e.g. `security/advisories/new`, `issues/new`)
4. **Never** hardcode the org or repo name in markdown links that can use this pattern
5. **For GitHub Pages links** — `github.io` URLs can't be made dynamic via relative paths. Use placeholder text (e.g. `*(deploy to activate)*`) and document the replacement in drift check step #4

## Markdown Formatting

When editing `.md` files and you need multiple lines to render as **separate rows** (not collapsed into a single paragraph), use HTML inline elements:
- **Line breaks:** end each line (except the last) with `<br>` to force a newline
- **Indentation:** start each line with `&emsp;` (em space) to add a visual indent

Example source:
```markdown
The framework handles:

&emsp;First item<br>
&emsp;Second item<br>
&emsp;Third item
```

Plain markdown collapses consecutive indented lines into one paragraph — `<br>` and `&emsp;` are the reliable way to get separate indented rows on GitHub.

## Mermaid Diagrams — mermaid.live Links

Every Mermaid diagram must have an "Open in mermaid.live" link above its code block for one-click interactive editing. *Full procedure (pako + js-base64 URL generation, Python regex replacement pattern, mandatory decompression verification, six common failure modes, format example): see `.claude/rules/mermaid-diagrams.md` — auto-injects when `REPO-ARCHITECTURE.md` or `repository-information/diagrams/**` are being edited.*

## README Tree Page Entry Icon Cluster

Each live-site page entry in the README tree groups its action icons together after a `→` arrow, using `·` as dividers between icons, closed with `—` before versions. Layout: `filename  →  🌐 · 📊 · 📋 · 📁  — versions | description`. The icons are:
- **🌐** — live site URL link. Format: `<a href="https://ORG.github.io/REPO/page.html">🌐</a>`
- **📊** — diagram link. Format: `<a href="...diagram.md">📊</a>`
- **📋** — spreadsheet link. Format: `<a href="https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/">📋</a>`. The `SPREADSHEET_ID` is read from the page's `<page-name>.config.json` in `googleAppsScripts/`
- **📁** — Google Drive folder link. Format: `<a href="https://drive.google.com/drive/folders/FOLDER_ID">📁</a>`. Links to the Drive folder containing all files for that page's environment
- **✕** — placeholder for a missing spreadsheet (no GAS project or placeholder `SPREADSHEET_ID`). Subtle thin x
- **◇** — placeholder for a missing Google Drive folder (folder ID not yet provided). White diamond

When `setup-gas-project.sh` creates a new project, it should add the icon cluster with 📋 if the spreadsheet ID is not a placeholder, or `✕` if it is. Use `◇` for the folder position until a folder ID is provided.

Developed by: LightAISolutions
