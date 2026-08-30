#!/usr/bin/env bash
# init-repo.sh — One-shot repository initialization for template forks
#
# Replaces the manual file-by-file Template Drift Checks with a single script
# execution. Auto-detects org/repo from git remote, performs all find-and-replace
# operations across 23+ files, restructures README.md, and updates CLAUDE.md's
# Template Variables table.
#
# Usage:
#   bash scripts/init-repo.sh [ORG_NAME] [REPO_NAME] [DEVELOPER_NAME]
#
# Arguments (all optional — auto-detected from git remote if omitted):
#   ORG_NAME       — GitHub org/username (e.g. "MyOrg")
#   REPO_NAME      — Repository name (e.g. "my-project")
#   DEVELOPER_NAME — Attribution name (defaults to ORG_NAME if omitted)
#
# The script is idempotent — running it twice with the same args produces
# the same result. It refuses to run on the template repo itself.

set -euo pipefail

# ── CONSTANTS ──
OLD_ORG="LightAISolutions"
OLD_REPO="lightaisolutions"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── AUTO-DETECT ORG/REPO FROM GIT REMOTE ──
cd "$REPO_ROOT"

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
  echo "ERROR: No git remote 'origin' found. Pass ORG and REPO as arguments."
  exit 1
fi

# Extract org and repo from remote URL (handles both HTTPS and SSH formats)
# HTTPS: https://github.com/OrgName/RepoName.git
# SSH:   git@github.com:OrgName/RepoName.git
AUTO_ORG=$(echo "$REMOTE_URL" | sed -E 's#.*[:/]([^/]+)/[^/]+(\.git)?$#\1#')
AUTO_REPO=$(echo "$REMOTE_URL" | sed -E 's#.*[:/][^/]+/([^/]+?)(\.git)?$#\1#')

ORG_NAME="${1:-$AUTO_ORG}"
REPO_NAME="${2:-$AUTO_REPO}"
DEVELOPER_NAME="${3:-$ORG_NAME}"

# ── TEMPLATE REPO GUARD ──
if [ "$REPO_NAME" = "$OLD_REPO" ] && [ "$ORG_NAME" = "$OLD_ORG" ]; then
  echo "ERROR: This appears to be the template repo itself ($OLD_ORG/$OLD_REPO)."
  echo "This script is intended for forks/clones only."
  exit 1
fi

echo "══════════════"
echo "  Initializing: $ORG_NAME/$REPO_NAME"
echo "  Developer:    $DEVELOPER_NAME"
echo "  Old values:   $OLD_ORG/$OLD_REPO"
echo "══════════════"
echo ""

# ── PHASE 0: CLEAN UP INHERITED BRANCHES ──
# Forks/template copies inherit claude/* branches from the template repo.
# These trigger the auto-merge workflow unnecessarily. Delete them now.
echo "[Phase 0] Cleaning up inherited claude/* branches..."

INHERITED_COUNT=0
for branch in $(git branch --list 'claude/*' 2>/dev/null); do
  branch=$(echo "$branch" | sed 's/^[* ]*//')
  echo "  Deleting local branch: $branch"
  git branch -D "$branch" 2>/dev/null || true
  INHERITED_COUNT=$((INHERITED_COUNT + 1))
done

# Also delete remote claude/* branches if they exist
for branch in $(git branch -r --list 'origin/claude/*' 2>/dev/null); do
  branch_name=$(echo "$branch" | sed 's|^  origin/||')
  echo "  Deleting remote branch: $branch_name"
  git push origin --delete "$branch_name" 2>/dev/null || true
  INHERITED_COUNT=$((INHERITED_COUNT + 1))
done

if [ "$INHERITED_COUNT" -gt 0 ]; then
  echo "  Cleaned up $INHERITED_COUNT inherited branch(es)."
else
  echo "  No inherited branches found."
fi
echo ""

# ── PHASE 1: GLOBAL SED REPLACEMENTS ──
# Explicit file list — avoids touching CLAUDE.md examples or provenance markers.
# Each file is checked for existence before processing.

REPLACE_FILES=(
  "README.md"
  "LICENSE.md"
  "CITATION.cff"
  "CODE_OF_CONDUCT.md"
  "CONTRIBUTING.md"
  "SECURITY.md"
  ".github/FUNDING.yml"
  ".github/PULL_REQUEST_TEMPLATE.md"
  ".github/ISSUE_TEMPLATE/config.yml"
  ".github/ISSUE_TEMPLATE/bug_report.yml"
  ".github/ISSUE_TEMPLATE/feature_request.yml"
  ".github/workflows/auto-merge-claude.yml"
  "repository-information/REPO-ARCHITECTURE.md"
  "repository-information/CHANGELOG.md"
  "repository-information/CODING-GUIDELINES.md"
  "repository-information/GOVERNANCE.md"
  "repository-information/IMPROVEMENTS.md"
  "repository-information/SUPPORT.md"
  "repository-information/TODO.md"
  "repository-information/TOKEN-BUDGETS.md"
  "live-site-pages/index.html"
)

echo "[Phase 1] Global find-and-replace across ${#REPLACE_FILES[@]} files..."

REPLACED_COUNT=0
for f in "${REPLACE_FILES[@]}"; do
  filepath="$REPO_ROOT/$f"
  if [ -f "$filepath" ]; then
    # Replace org name (handles URLs, branding, content references)
    sed -i "s|${OLD_ORG}|${ORG_NAME}|g" "$filepath"
    # Replace repo name (handles URLs, titles, structure references)
    sed -i "s|${OLD_REPO}|${REPO_NAME}|g" "$filepath"
    REPLACED_COUNT=$((REPLACED_COUNT + 1))
  else
    echo "  WARN: File not found, skipping: $f"
  fi
done

# If DEVELOPER_NAME differs from ORG_NAME, fix "Developed by:" lines
# (Phase 1 replaced "LightAISolutions" -> ORG_NAME in footers;
#  now correct them to DEVELOPER_NAME)
if [ "$DEVELOPER_NAME" != "$ORG_NAME" ]; then
  echo "[Phase 1b] Correcting 'Developed by:' lines to use DEVELOPER_NAME..."
  for f in "${REPLACE_FILES[@]}"; do
    filepath="$REPO_ROOT/$f"
    if [ -f "$filepath" ]; then
      sed -i "s|Developed by: ${ORG_NAME}|Developed by: ${DEVELOPER_NAME}|g" "$filepath"
    fi
  done
  # Also fix content references to developer name in specific files
  # CONTRIBUTING.md, PULL_REQUEST_TEMPLATE.md reference "Developed by: X" in checklists
  for f in "CONTRIBUTING.md" ".github/PULL_REQUEST_TEMPLATE.md"; do
    filepath="$REPO_ROOT/$f"
    if [ -f "$filepath" ]; then
      sed -i "s|Developed by: ${ORG_NAME}|Developed by: ${DEVELOPER_NAME}|g" "$filepath"
    fi
  done
  # LICENSE uses the developer name in copyright, not "Developed by:"
  sed -i "s|${ORG_NAME}|${DEVELOPER_NAME}|g" "$REPO_ROOT/LICENSE.md" 2>/dev/null || true
  # GOVERNANCE.md uses "owned and maintained by **X**"
  sed -i "s|owned and maintained by \*\*${ORG_NAME}\*\*|owned and maintained by **${DEVELOPER_NAME}**|g" \
    "$REPO_ROOT/repository-information/GOVERNANCE.md" 2>/dev/null || true
  # CITATION.cff author name
  sed -i "s|name: \"${ORG_NAME}\"|name: \"${DEVELOPER_NAME}\"|g" \
    "$REPO_ROOT/CITATION.cff" 2>/dev/null || true
  # FUNDING.yml sponsor link
  sed -i "s|github: \[${ORG_NAME}\]|github: [${DEVELOPER_NAME}]|g" \
    "$REPO_ROOT/.github/FUNDING.yml" 2>/dev/null || true
fi

echo "  Processed $REPLACED_COUNT files."
echo ""

# ── PHASE 2: CLAUDE.MD TEMPLATE VARIABLES TABLE UPDATE ──
echo "[Phase 2] Updating CLAUDE.md Template Variables table..."

CLAUDE_FILE="$REPO_ROOT/CLAUDE.md"
if [ -f "$CLAUDE_FILE" ]; then
  # IS_TEMPLATE_REPO: saistemplateprojectrepo -> No
  sed -i "s/| \`IS_TEMPLATE_REPO\` | ${OLD_REPO}/| \`IS_TEMPLATE_REPO\` | No/" "$CLAUDE_FILE"
  # YOUR_ORG_NAME: YourOrgName -> new org
  sed -i "s/| \`YOUR_ORG_NAME\` | YourOrgName/| \`YOUR_ORG_NAME\` | ${ORG_NAME}/" "$CLAUDE_FILE"
  # YOUR_REPO_NAME: YourRepoName -> new repo
  sed -i "s/| \`YOUR_REPO_NAME\` | YourRepoName/| \`YOUR_REPO_NAME\` | ${REPO_NAME}/" "$CLAUDE_FILE"
  # DEVELOPER_NAME: LightAISolutions -> developer name
  sed -i "s/| \`DEVELOPER_NAME\` | ${OLD_ORG}/| \`DEVELOPER_NAME\` | ${DEVELOPER_NAME}/" "$CLAUDE_FILE"
  # TEMPLATE_DEPLOY: On -> Off (template-only toggle, forks should start with Off)
  sed -i "s/| \`TEMPLATE_DEPLOY\` | On/| \`TEMPLATE_DEPLOY\` | Off/" "$CLAUDE_FILE"
  echo "  Updated 5 table values."
else
  echo "  WARN: CLAUDE.md not found, skipping table update."
fi
echo ""

# ── PHASE 2b: ENABLE MAIN PUSH TRIGGER IN WORKFLOW ──
# The template ships without 'main' in the push trigger to prevent template
# copies from firing the workflow on their initial commit. Now that the repo
# is initialized (IS_TEMPLATE_REPO = No), add 'main' back so direct-to-main
# pushes auto-deploy.
echo "[Phase 2b] Enabling main branch push trigger in workflow..."

WORKFLOW_FILE="$REPO_ROOT/.github/workflows/auto-merge-claude.yml"
if [ -f "$WORKFLOW_FILE" ]; then
  # Insert "      - 'main'" after the "      - 'claude/**'" line
  sed -i "/^      - 'claude\/\*\*'/a\\      - 'main'" "$WORKFLOW_FILE"
  echo "  Added 'main' to push trigger branches."
else
  echo "  WARN: Workflow file not found, skipping."
fi
echo ""

# ── PHASE 4: README STRUCTURAL CHANGES ──
echo "[Phase 4] Restructuring README.md..."

README_FILE="$REPO_ROOT/README.md"
if [ -f "$README_FILE" ]; then
  # 4a. Replace title (preserving any invisible characters before #)
  # The template has zero-width Unicode chars before "# Auto Update HTML & GAS Template"
  sed -i "1s/Auto Update HTML \& GAS Template/ReadMe - ${REPO_NAME}/" "$README_FILE"
  echo "  4a. Replaced title."

  # 4b. Replace placeholder block with live site link + QR code
  # The block spans from "You are currently using" (line 7) through the QR "</p>" tag (line 14).
  # Strategy: use awk to delete the block, then insert the replacement.
  if grep -q "^You are currently using" "$README_FILE"; then
    awk -v org="$ORG_NAME" -v repo="$REPO_NAME" '
      /^You are currently using/ {
        in_block=1
        # Print the replacement block
        print "**Live site:** [" org ".github.io/" repo "](https://" org ".github.io/" repo ")"
        print ""
        print "<p align=\"center\">"
        print "  <img src=\"repository-information/readme-qr-code.png\" alt=\"QR code to live site\" width=\"200\">"
        print "</p>"
        next
      }
      in_block && /<\/p>/ { in_block=0; next }
      in_block { next }
      { print }
    ' "$README_FILE" > "$README_FILE.tmp" && mv "$README_FILE.tmp" "$README_FILE"
    echo "  4b. Replaced placeholder block with live site link."
  else
    echo "  4b. Placeholder block not found (already replaced?), skipping."
  fi

  # 4c + 4d. Delete "Copy This Repository" and "Initialize This Template" sections
  # Each section runs from its ## heading to the line before the next ## heading
  awk '
    /^## Copy This Repository$/ { skip=1; next }
    /^## Initialize This Template$/ { skip=1; next }
    /^## / && skip { skip=0 }
    !skip { print }
  ' "$README_FILE" > "$README_FILE.tmp" && mv "$README_FILE.tmp" "$README_FILE"
  echo "  4c/4d. Removed 'Copy This Repository' and 'Initialize This Template' sections."
else
  echo "  WARN: README.md not found, skipping restructuring."
fi
echo ""

# ── PHASE 5: README TIMESTAMP ──
echo "[Phase 5] Updating README.md 'Last updated:' timestamp..."

if [ -f "$README_FILE" ]; then
  CURRENT_TIME=$(TZ=America/New_York date '+%Y-%m-%d %I:%M:%S %p EST')
  sed -i "s|Last updated: \`[^\`]*\`|Last updated: \`${CURRENT_TIME}\`|" "$README_FILE"
  echo "  Set to: $CURRENT_TIME"
else
  echo "  WARN: README.md not found, skipping."
fi
echo ""

# ── PHASE 5b: TEMPLATE ORIGIN LABELS ──
echo "[Phase 5b] Upgrading [template] labels to [template · initialized] for init-modified files..."

# Only files actually modified by init get [template · initialized].
# Files init doesn't touch stay [template] so post-init edits produce
# [template · modified] (not [template · initialized · modified]).
# Build the list from REPLACE_FILES + CLAUDE.md + readme-qr-code.png.
INIT_MODIFIED_BASENAMES=()
for f in "${REPLACE_FILES[@]}"; do
  INIT_MODIFIED_BASENAMES+=("$(basename "$f")")
done
# Add files modified by other phases (not in REPLACE_FILES)
INIT_MODIFIED_BASENAMES+=("CLAUDE.md" "readme-qr-code.png")
# Deduplicate
INIT_MODIFIED_BASENAMES=($(printf '%s\n' "${INIT_MODIFIED_BASENAMES[@]}" | sort -u))

# README.md tree: only update [template] labels on lines containing init-modified filenames
if [ -f "$README_FILE" ]; then
  UPDATED_README=0
  for bname in "${INIT_MODIFIED_BASENAMES[@]}"; do
    # Escape dots for sed regex
    escaped=$(echo "$bname" | sed 's/\./\\./g')
    if grep -q "${escaped}.*\[template\]" "$README_FILE" 2>/dev/null; then
      sed -i "/${escaped}/s/\[template\]/[template · initialized]/" "$README_FILE"
      UPDATED_README=$((UPDATED_README + 1))
    fi
  done
  echo "  Updated $UPDATED_README README.md tree labels."
fi

# REPO-ARCHITECTURE.md: same targeted approach
ARCH_FILE="$REPO_ROOT/repository-information/REPO-ARCHITECTURE.md"
if [ -f "$ARCH_FILE" ]; then
  UPDATED_ARCH=0
  for bname in "${INIT_MODIFIED_BASENAMES[@]}"; do
    escaped=$(echo "$bname" | sed 's/\./\\./g')
    if grep -q "${escaped}.*\[template\]" "$ARCH_FILE" 2>/dev/null; then
      sed -i "/${escaped}/s/\[template\]/[template · initialized]/" "$ARCH_FILE"
      UPDATED_ARCH=$((UPDATED_ARCH + 1))
    fi
  done
  # Also update subgraph titles that reference init-modified directories
  # (e.g. "live-site-pages/ — Hosted Content [template]" when index.html was modified)
  for dir_label in "live-site-pages" "repository-information" ".github"; do
    if grep -q "${dir_label}.*\[template\]" "$ARCH_FILE" 2>/dev/null; then
      sed -i "/${dir_label}/s/\[template\]/[template · initialized]/" "$ARCH_FILE"
      UPDATED_ARCH=$((UPDATED_ARCH + 1))
    fi
  done
  echo "  Updated $UPDATED_ARCH REPO-ARCHITECTURE.md diagram labels."
fi

echo ""

# ── PHASE 6: QR CODE GENERATION ──
echo "[Phase 6] Generating QR code for live site URL..."

REPO_URL="https://github.com/${ORG_NAME}/${REPO_NAME}"
QR_PATH="$REPO_ROOT/repository-information/readme-qr-code.png"

if command -v python3 &>/dev/null; then
  # Try importing qrcode; install if missing
  if ! python3 -c "import qrcode" &>/dev/null; then
    echo "  qrcode package not found, installing..."
    pip install qrcode[pil] --quiet 2>/dev/null || pip3 install qrcode[pil] --quiet 2>/dev/null || {
      echo "  WARN: Could not install qrcode package. Skipping QR code generation."
      echo "  Manual step: pip install qrcode[pil] && python3 -c \"import qrcode; qrcode.make('${REPO_URL}').save('${QR_PATH}')\""
      QR_SKIP=1
    }
  fi
  if [ "${QR_SKIP:-0}" = "0" ]; then
    python3 -c "import qrcode; qrcode.make('${REPO_URL}').save('${QR_PATH}')" && \
      echo "  Generated: $QR_PATH" || \
      echo "  WARN: QR code generation failed. Skipping."
  fi
else
  echo "  WARN: python3 not found. Skipping QR code generation."
  echo "  Manual step: python3 -c \"import qrcode; qrcode.make('${REPO_URL}').save('${QR_PATH}')\""
fi
echo ""

# ── PHASE 7: VERIFICATION ──
echo "[Phase 7] Verifying no stale references remain..."

# Build the grep pattern based on whether org changed
# Same-org fork: only check for old repo name (org refs are correct)
# Different-org fork: check for both old org and old repo name
if [ "$ORG_NAME" = "$OLD_ORG" ]; then
  echo "  Same-org fork detected — verifying repo name replacements only."
  GREP_PATTERN="${OLD_REPO}"
else
  GREP_PATTERN="${OLD_ORG}\|${OLD_REPO}"
fi

# Search for stale references, excluding known-safe patterns
REMAINING=$(grep -rn "$GREP_PATTERN" \
  --include='*.md' --include='*.yml' --include='*.cff' --include='*.html' \
  "$REPO_ROOT" \
  | grep -v 'CLAUDE.md' \
  | grep -v 'template-id' \
  | grep -v 'Developed by:' \
  || true)

if [ -n "$REMAINING" ]; then
  echo ""
  echo "  WARNING: The following files still contain old values:"
  echo "  (These may be provenance markers — verify manually)"
  echo "$REMAINING" | sed 's|^|    |'
  echo ""
  RESULT="COMPLETED WITH WARNINGS"
else
  echo "  VERIFIED: No stale references found."
  echo ""
  RESULT="COMPLETED SUCCESSFULLY"
fi

echo "══════════════"
echo "  Init $RESULT"
echo "  Repository: $ORG_NAME/$REPO_NAME"
echo "  Developer:  $DEVELOPER_NAME"
echo ""
echo "  Next step: commit and push to deploy."
echo "══════════════"

# Developed by: LightAISolutions

