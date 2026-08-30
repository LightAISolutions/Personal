---
name: initialize
description: Initialize a freshly forked/cloned repo for first deployment. Runs drift checks, resolves placeholders, updates README timestamp, commits, and pushes to trigger GitHub Pages deployment.
user-invocable: true
disable-model-invocation: true
---

# Initialize Deployment

Initialize a freshly forked or cloned repo for its first GitHub Pages deployment.

## Prerequisites

Before running, the user should have:
1. Enabled GitHub Pages (Source: GitHub Actions) in repo settings
2. Configured the `github-pages` environment with "No restriction" deployment branches

## Steps

1. **Session Start Checklist runs first** — the drift checks detect this is an uninitialized fork and run `scripts/init-repo.sh`, which handles:
   - Deleting inherited `claude/*` branches
   - Replacing `LightAISolutions` → new org name across 23+ files
   - Replacing `lightaisolutions` → new repo name
   - Updating CLAUDE.md Template Variables

   - Restructuring README.md
   - Generating QR code

2. **Update `Last updated:` timestamp** in README.md to the real current time

4. **Commit** with message `Initialize deployment`

5. **Push** to the `claude/*` branch (Pre-Push Checklist applies)

## Important Notes

- **No version bumps** — initialization never bumps any version (html.version.txt, repository.version.txt, gs.version.txt, .gs VERSION, HTML meta tags). It deploys whatever versions already exist
- All pages in `live-site-pages/` are treated as **affected** (marked with `✏️`) because deployment makes them live for the first time
- The push triggers the auto-merge workflow, which merges into `main` and deploys to GitHub Pages

Developed by: LightAISolutions
