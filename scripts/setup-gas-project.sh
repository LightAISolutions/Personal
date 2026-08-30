#!/usr/bin/env bash
# ──────────────
# setup-gas-project.sh — Fully automated GAS project setup
#
# Creates all files and updates all documentation for a new GAS project:
#   - HTML embedding page (from HtmlAndGasTemplateAutoUpdate-{noauth|auth}.html.txt template)
#   - .gs script (from gas-{minimal|test}-{noauth|auth}-template-code.js.txt)
#   - .config.json
#   - Version files (html + gs)
#   - Changelogs (html + gs, plus archives) — created directly in live-site-pages/
#   - GAS Projects table registration (.claude/rules/gas-scripts.md)
#   - REPO-ARCHITECTURE.md (Mermaid diagram nodes, edges, styles)
#   - README.md (structure tree — 3 insertion points)
#   - Workflow deploy step (auto-merge-claude.yml — webhook for GAS self-update)
#
# Usage:
#   bash scripts/setup-gas-project.sh <<'CONFIG'
#   { "PROJECT_ENVIRONMENT_NAME": "myapp", "TITLE": "My App", ... }
#   CONFIG
#
#   bash scripts/setup-gas-project.sh config.json
#
# After running: Claude just needs to commit and push.
# ──────────────
set -euo pipefail

# ── Repo root ──
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── Color helpers ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Phase 0: Parse Input ──
info "Phase 0: Parsing input..."

JSON_INPUT=""
if [ $# -ge 1 ] && [ -f "$1" ]; then
    JSON_INPUT="$(cat "$1")"
    info "Reading config from file: $1"
elif ! [ -t 0 ]; then
    JSON_INPUT="$(cat)"
    info "Reading config from stdin"
else
    err "No input provided. Pipe JSON via stdin or pass a config file path."
    echo ""
    echo "Usage:"
    echo "  bash scripts/setup-gas-project.sh <<'CONFIG'"
    echo '  { "PROJECT_ENVIRONMENT_NAME": "myapp", "TITLE": "My App", ... }'
    echo "  CONFIG"
    echo ""
    echo "  bash scripts/setup-gas-project.sh config.json"
    exit 1
fi

# Parse JSON fields using Python (already a dependency for QR codes)
parse_json() {
    python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
key = sys.argv[1]
default = sys.argv[2] if len(sys.argv) > 2 else ''
val = data.get(key, default)
# Normalize Python booleans to lowercase strings for bash comparison
if isinstance(val, bool):
    print(str(val).lower())
else:
    print(val)
" "$@" <<< "$JSON_INPUT"
}

ENV_NAME="$(parse_json PROJECT_ENVIRONMENT_NAME)"
TITLE="$(parse_json TITLE 'CHANGE THIS PROJECT TITLE GAS TEMPLATE')"
DEPLOYMENT_ID="$(parse_json DEPLOYMENT_ID 'YOUR_DEPLOYMENT_ID')"
SPREADSHEET_ID="$(parse_json SPREADSHEET_ID 'YOUR_SPREADSHEET_ID')"
SHEET_NAME="$(parse_json SHEET_NAME 'YOUR_SHEET_NAME')"
DEVELOPER_LOGO_URL="$(parse_json DEVELOPER_LOGO_URL 'https://www.shadowaisolutions.com/SAIS_Logo.png')"
YOUR_ORG_LOGO_URL="$(parse_json YOUR_ORG_LOGO_URL 'https://www.shadowaisolutions.com/SAIS_Logo.png')"
SPLASH_LOGO_URL="$(parse_json SPLASH_LOGO_URL 'https://www.shadowaisolutions.com/SAIS_Logo.png')"
INCLUDE_AUTH="$(parse_json INCLUDE_AUTH 'false')"
CLIENT_ID="$(parse_json CLIENT_ID 'YOUR_CLIENT_ID.apps.googleusercontent.com')"
AUTH_PRESET="$(parse_json AUTH_PRESET 'hipaa')"
ALLOWED_DOMAINS="$(parse_json ALLOWED_DOMAINS '')"
IS_MASTER_ACL="$(parse_json IS_MASTER_ACL 'false')"
MASTER_ACL_SPREADSHEET_ID="$(parse_json MASTER_ACL_SPREADSHEET_ID 'YOUR_MASTER_ACL_SPREADSHEET_ID')"
ACL_SHEET_NAME="$(parse_json ACL_SHEET_NAME 'Access')"
ACL_PAGE_NAME="$(parse_json ACL_PAGE_NAME '')"
PORTAL_ICON="$(parse_json PORTAL_ICON '📱')"
PORTAL_DESCRIPTION="$(parse_json PORTAL_DESCRIPTION '')"

# If IS_MASTER_ACL is true and no explicit Master ACL ID, use the project's own Spreadsheet ID
if [ "$IS_MASTER_ACL" = "true" ] && [ "$MASTER_ACL_SPREADSHEET_ID" = "YOUR_MASTER_ACL_SPREADSHEET_ID" ]; then
    MASTER_ACL_SPREADSHEET_ID="$SPREADSHEET_ID"
fi

# Auto-default the Master ACL ID for auth projects (Global ACL Access-tab registration).
# When the creator result omits MASTER_ACL_SPREADSHEET_ID (the field was left blank in the
# gas-project-creator page), read it from the Global ACL project's own config so the new
# project self-registers its column in the Access tab on first page load — the auth
# template's registerSelfProject() runs on every doGet() and needs a real ID to work.
GLOBALACL_CONFIG="googleAppsScripts/Globalacl/globalacl.config.json"
if [ "$INCLUDE_AUTH" = "true" ] && [ "$IS_MASTER_ACL" != "true" ] \
   && { [ "$MASTER_ACL_SPREADSHEET_ID" = "YOUR_MASTER_ACL_SPREADSHEET_ID" ] || [ -z "$MASTER_ACL_SPREADSHEET_ID" ]; } \
   && [ -f "$GLOBALACL_CONFIG" ]; then
    ACL_DEFAULT="$(python3 -c "
import json, sys
cfg = json.load(open(sys.argv[1]))
val = cfg.get('MASTER_ACL_SPREADSHEET_ID') or cfg.get('SPREADSHEET_ID') or ''
print('' if 'YOUR_' in str(val) else val)
" "$GLOBALACL_CONFIG" 2>/dev/null || echo '')"
    if [ -n "$ACL_DEFAULT" ]; then
        MASTER_ACL_SPREADSHEET_ID="$ACL_DEFAULT"
        info "MASTER_ACL_SPREADSHEET_ID defaulted from Global ACL config — project will auto-register in the Access tab"
    else
        warn "Global ACL config has no usable spreadsheet ID — Access-tab auto-registration will stay inactive until MASTER_ACL_SPREADSHEET_ID is set"
    fi
fi

if [ -z "$ENV_NAME" ]; then
    err "PROJECT_ENVIRONMENT_NAME is required and cannot be empty."
    exit 1
fi

# ── Auto-detect repo info ──
REMOTE_URL="$(git remote get-url origin 2>/dev/null || echo '')"
GITHUB_OWNER="$(echo "$REMOTE_URL" | sed -E 's|.*[:/]([^/]+)/[^/]+(\.git)?$|\1|')"
GITHUB_REPO="$(echo "$REMOTE_URL" | sed -E 's|.*[:/][^/]+/([^/]+?)(\.git)?$|\1|')"
GITHUB_BRANCH="$(parse_json GITHUB_BRANCH 'main')"

# ── Derive project directory name ──
# Capitalize first letter of each segment separated by _ or -
# e.g. test_link → TestLink, my-app → MyApp
derive_project_dir() {
    echo "$1" | sed -E 's/(^|[_-])([a-z])/\U\2/g' | sed 's/[_-]//g'
}

PROJECT_DIR="$(derive_project_dir "$ENV_NAME")"

info "Environment name: $ENV_NAME"
info "Project directory: $PROJECT_DIR"
info "Title: $TITLE"
info "GitHub: $GITHUB_OWNER/$GITHUB_REPO (branch: $GITHUB_BRANCH)"

# ── Path constants ──
HTML_PAGE="live-site-pages/${ENV_NAME}.html"
HTML_VERSION="live-site-pages/html-versions/${ENV_NAME}html.version.txt"
GAS_DIR="googleAppsScripts/${PROJECT_DIR}"
GAS_FILE="${GAS_DIR}/${ENV_NAME}.gs"
GAS_CONFIG="${GAS_DIR}/${ENV_NAME}.config.json"
GAS_VERSION="live-site-pages/gs-versions/${ENV_NAME}gs.version.txt"
HTML_CL="live-site-pages/html-changelogs/${ENV_NAME}html.changelog.md"
HTML_CL_ARCHIVE="live-site-pages/html-changelogs/${ENV_NAME}html.changelog-archive.md"
GAS_CL="live-site-pages/gs-changelogs/${ENV_NAME}gs.changelog.md"
GAS_CL_ARCHIVE="live-site-pages/gs-changelogs/${ENV_NAME}gs.changelog-archive.md"
GAS_SCRIPTS_RULES=".claude/rules/gas-scripts.md"

# ── Template sources (selected by INCLUDE_AUTH) ──
AUTH_SUFFIX="noauth"
if [ "$INCLUDE_AUTH" = "true" ]; then AUTH_SUFFIX="auth"; fi
TPL_HTML="live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-${AUTH_SUFFIX}.html.txt"
TPL_GS="live-site-pages/templates/gas-minimal-${AUTH_SUFFIX}-template-code.js.txt"

# ── Phase 1: Pre-flight Checks ──
info "Phase 1: Pre-flight checks..."

for f in "$TPL_HTML" "$TPL_GS"; do
    if [ ! -f "$f" ]; then
        err "Template file not found: $f"
        exit 1
    fi
done
ok "Template files exist"

# Check if project already exists
UPDATE_MODE=false
if [ -f "$HTML_PAGE" ] || [ -d "$GAS_DIR" ] || [ -f "$GAS_CONFIG" ]; then
    UPDATE_MODE=true
    warn "Project already exists — switching to UPDATE mode"
    warn "Will sync config values into existing files without recreating"
fi

if [ "$UPDATE_MODE" = true ]; then
    # ── Update Mode ──
    info "Updating existing project: $ENV_NAME"

    # Update config.json
    if [ -f "$GAS_CONFIG" ]; then
        if [ "$INCLUDE_AUTH" = "true" ]; then
            ACL_PAGE_NAME="${ACL_PAGE_NAME:-$ENV_NAME}"
            cat > "$GAS_CONFIG" <<CFGEOF
{
  "TITLE": "${TITLE}",
  "DEPLOYMENT_ID": "${DEPLOYMENT_ID}",
  "SPREADSHEET_ID": "${SPREADSHEET_ID}",
  "SHEET_NAME": "${SHEET_NAME}",
  "MASTER_ACL_SPREADSHEET_ID": "${MASTER_ACL_SPREADSHEET_ID}",
  "ACL_SHEET_NAME": "${ACL_SHEET_NAME}",
  "ACL_PAGE_NAME": "${ACL_PAGE_NAME}"
}
CFGEOF
        else
            cat > "$GAS_CONFIG" <<CFGEOF
{
  "TITLE": "${TITLE}",
  "DEPLOYMENT_ID": "${DEPLOYMENT_ID}",
  "SPREADSHEET_ID": "${SPREADSHEET_ID}",
  "SHEET_NAME": "${SHEET_NAME}"
}
CFGEOF
        fi
        ok "Updated $GAS_CONFIG"
    fi

    # Update .gs file config vars
    if [ -f "$GAS_FILE" ]; then
        sed -i "s|var TITLE = .*;|var TITLE = \"${TITLE}\";|" "$GAS_FILE"
        sed -i "s|var DEPLOYMENT_ID = .*;|var DEPLOYMENT_ID = \"${DEPLOYMENT_ID}\";|" "$GAS_FILE"
        if [ -n "$SPREADSHEET_ID" ]; then
            sed -i "s|var SPREADSHEET_ID = .*;|var SPREADSHEET_ID = \"${SPREADSHEET_ID}\";|" "$GAS_FILE"
        fi
        sed -i "s|var SHEET_NAME     = .*;|var SHEET_NAME     = \"${SHEET_NAME}\";|" "$GAS_FILE"
        # Master ACL config (auth projects only)
        if [ "$INCLUDE_AUTH" = "true" ]; then
            if [ "$MASTER_ACL_SPREADSHEET_ID" != "YOUR_MASTER_ACL_SPREADSHEET_ID" ] && [ -n "$MASTER_ACL_SPREADSHEET_ID" ]; then
                sed -i "s|var MASTER_ACL_SPREADSHEET_ID = .*;|var MASTER_ACL_SPREADSHEET_ID = \"${MASTER_ACL_SPREADSHEET_ID}\";|" "$GAS_FILE"
            fi
            if [ -n "$ACL_SHEET_NAME" ]; then
                sed -i "s|var ACL_SHEET_NAME = .*;|var ACL_SHEET_NAME = \"${ACL_SHEET_NAME}\";|" "$GAS_FILE"
            fi
            ACL_PAGE_NAME="${ACL_PAGE_NAME:-$ENV_NAME}"
            sed -i "s|var ACL_PAGE_NAME  = .*;|var ACL_PAGE_NAME  = \"${ACL_PAGE_NAME}\";|" "$GAS_FILE"
        fi
        ok "Updated config vars in $GAS_FILE"
    fi

    # Update HTML page title and var _e
    if [ -f "$HTML_PAGE" ]; then
        # Update <title>
        sed -i "s|<title>.*</title>|<title>${TITLE}</title>|" "$HTML_PAGE"

        # Update var _e (encoded deployment URL)
        if [ "$DEPLOYMENT_ID" != "YOUR_DEPLOYMENT_ID" ] && [ -n "$DEPLOYMENT_ID" ]; then
            ENCODED=$(echo -n "https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec" | rev | base64 -w0)
            sed -i "s|var _e = '[^']*';|var _e = '${ENCODED}';|" "$HTML_PAGE"
        else
            sed -i "s|var _e = '[^']*';|var _e = '';|" "$HTML_PAGE"
        fi
        # Update CLIENT_ID for auth pages
        if [ "$INCLUDE_AUTH" = "true" ] && [ "$CLIENT_ID" != "YOUR_CLIENT_ID.apps.googleusercontent.com" ] && [ -n "$CLIENT_ID" ]; then
            sed -i "s|var CLIENT_ID = '[^']*';|var CLIENT_ID = '${CLIENT_ID}';|" "$HTML_PAGE"
        fi
        ok "Updated $HTML_PAGE"
    fi

    # Update auth config in .gs file
    if [ "$INCLUDE_AUTH" = "true" ] && [ -f "$GAS_FILE" ]; then
        if [ "$AUTH_PRESET" != "hipaa" ] && [ -n "$AUTH_PRESET" ]; then
            sed -i "s|var ACTIVE_PRESET = '[^']*';|var ACTIVE_PRESET = '${AUTH_PRESET}';|" "$GAS_FILE"
        fi
        if [ -n "$ALLOWED_DOMAINS" ]; then
            JS_DOMAINS=$(echo "$ALLOWED_DOMAINS" | sed "s/[[:space:]]*,[[:space:]]*/\\', \\'/g" | sed "s/^/'/" | sed "s/$/'/")
            sed -i "s|ALLOWED_DOMAINS: \[\]|ALLOWED_DOMAINS: [${JS_DOMAINS}]|g" "$GAS_FILE"
            sed -i "s|ENABLE_DOMAIN_RESTRICTION: false|ENABLE_DOMAIN_RESTRICTION: true|g" "$GAS_FILE"
        fi
        ok "Updated auth config in $GAS_FILE"
    fi

    echo ""
    ok "Update complete. Files modified:"
    [ -f "$GAS_CONFIG" ] && echo "  - $GAS_CONFIG"
    [ -f "$GAS_FILE" ] && echo "  - $GAS_FILE"
    [ -f "$HTML_PAGE" ] && echo "  - $HTML_PAGE"
    exit 0
fi

# ── Create Mode ──
info "Creating new project: $ENV_NAME"
echo ""

# ── Phase 2: Create Directory Structure ──
info "Phase 2: Creating directories..."
mkdir -p "$GAS_DIR"
mkdir -p "live-site-pages/sounds"
ok "Directories created"

# ── Phase 3: Copy & Substitute Templates ──
info "Phase 3: Copying and substituting templates..."

# --- HTML page ---
cp "$TPL_HTML" "$HTML_PAGE"
# Replace title — use <title> tag replacement for robustness
sed -i "s|<title>.*</title>|<title>${TITLE}</title>|" "$HTML_PAGE"

# Set meta build-version (should already be v01.00w from template, but ensure)
sed -i 's|<meta name="build-version" content="[^"]*">|<meta name="build-version" content="v01.00w">|' "$HTML_PAGE"

# Update logo URLs if provided and different from defaults
if [ "$DEVELOPER_LOGO_URL" != "YOUR_DEVELOPER_LOGO_URL" ] && [ -n "$DEVELOPER_LOGO_URL" ]; then
    sed -i "s|var DEVELOPER_LOGO_URL = '[^']*';|var DEVELOPER_LOGO_URL = '${DEVELOPER_LOGO_URL}';|" "$HTML_PAGE"
fi
if [ "$YOUR_ORG_LOGO_URL" != "YOUR_ORG_LOGO_URL" ] && [ -n "$YOUR_ORG_LOGO_URL" ]; then
    sed -i "s|var YOUR_ORG_LOGO_URL = '[^']*';|var YOUR_ORG_LOGO_URL = '${YOUR_ORG_LOGO_URL}';|" "$HTML_PAGE"
fi
if [ "$SPLASH_LOGO_URL" != "YOUR_SPLASH_LOGO_URL" ] && [ -n "$SPLASH_LOGO_URL" ]; then
    sed -i "s|var SPLASH_LOGO_URL = '[^']*';|var SPLASH_LOGO_URL = '${SPLASH_LOGO_URL}';|" "$HTML_PAGE"
fi

# Encode and set var _e (deployment URL)
if [ "$DEPLOYMENT_ID" != "YOUR_DEPLOYMENT_ID" ] && [ -n "$DEPLOYMENT_ID" ]; then
    ENCODED=$(echo -n "https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec" | rev | base64 -w0)
    sed -i "s|var _e = '[^']*';|var _e = '${ENCODED}';|" "$HTML_PAGE"
else
    sed -i "s|var _e = '[^']*';|var _e = '';|" "$HTML_PAGE"
fi
ok "Created $HTML_PAGE"

# --- GAS script ---
cp "$TPL_GS" "$GAS_FILE"
# Reset VERSION to initial
sed -i 's|var VERSION = "[^"]*";|var VERSION = "v01.00g";|' "$GAS_FILE"
# Set config-tracked variables
sed -i "s|var TITLE = .*;|var TITLE = \"${TITLE}\";|" "$GAS_FILE"
sed -i "s|var DEPLOYMENT_ID = .*;|var DEPLOYMENT_ID = \"${DEPLOYMENT_ID}\";|" "$GAS_FILE"
if [ -n "$SPREADSHEET_ID" ]; then
    sed -i "s|var SPREADSHEET_ID = .*;|var SPREADSHEET_ID = \"${SPREADSHEET_ID}\";|" "$GAS_FILE"
fi
sed -i "s|var SHEET_NAME     = .*;|var SHEET_NAME     = \"${SHEET_NAME}\";|" "$GAS_FILE"
# Set repo-derived variables
sed -i "s|var GITHUB_OWNER  = .*;|var GITHUB_OWNER  = \"${GITHUB_OWNER}\";|" "$GAS_FILE"
sed -i "s|var GITHUB_REPO   = .*;|var GITHUB_REPO   = \"${GITHUB_REPO}\";|" "$GAS_FILE"
sed -i "s|var GITHUB_BRANCH = .*;|var GITHUB_BRANCH = \"${GITHUB_BRANCH}\";|" "$GAS_FILE"
sed -i "s|var FILE_PATH     = .*;|var FILE_PATH     = \"${GAS_FILE}\";|" "$GAS_FILE"
# Derive the embed URL from the GitHub Pages config. If a custom domain is set
# (live-site-pages/CNAME), the live site is served there — the GAS PARENT_ORIGIN
# must match that origin exactly or the browser silently drops every sign-in
# postMessage (sign-in hangs at "Connecting to server"). Fall back to the
# lowercased github.io URL when no custom domain is configured. (github.io origins
# are always lowercase, so lowercasing the owner avoids a mixed-case origin mismatch.)
if [ -f "live-site-pages/CNAME" ]; then
    CUSTOM_DOMAIN="$(head -1 live-site-pages/CNAME | tr -d '[:space:]')"
fi
if [ -n "${CUSTOM_DOMAIN:-}" ]; then
    EMBED_URL="https://${CUSTOM_DOMAIN}/${ENV_NAME}.html"
else
    OWNER_LC="$(printf '%s' "$GITHUB_OWNER" | tr '[:upper:]' '[:lower:]')"
    EMBED_URL="https://${OWNER_LC}.github.io/${GITHUB_REPO}/${ENV_NAME}.html"
fi
sed -i "s|var EMBED_PAGE_URL = .*;|var EMBED_PAGE_URL = \"${EMBED_URL}\";|" "$GAS_FILE"
# Fix template comment references: <page-name>.gs/.config.json → {env_name}.gs/.config.json
sed -i "s|<page-name>\.gs|${ENV_NAME}.gs|g" "$GAS_FILE"
sed -i "s|<page-name>\.config\.json|${ENV_NAME}.config.json|g" "$GAS_FILE"
# Auth-specific config substitutions (only for auth templates)
if [ "$INCLUDE_AUTH" = "true" ]; then
    if [ "$AUTH_PRESET" != "hipaa" ] && [ -n "$AUTH_PRESET" ]; then
        sed -i "s|var ACTIVE_PRESET = '[^']*';|var ACTIVE_PRESET = '${AUTH_PRESET}';|" "$GAS_FILE"
    fi
    if [ -n "$ALLOWED_DOMAINS" ]; then
        # Convert comma-separated string to JS array format: 'a.com', 'b.com'
        JS_DOMAINS=$(echo "$ALLOWED_DOMAINS" | sed "s/[[:space:]]*,[[:space:]]*/\\', \\'/g" | sed "s/^/'/" | sed "s/$/'/")
        sed -i "s|ALLOWED_DOMAINS: \[\]|ALLOWED_DOMAINS: [${JS_DOMAINS}]|g" "$GAS_FILE"
        # Enable domain restriction if domains are provided
        sed -i "s|ENABLE_DOMAIN_RESTRICTION: false|ENABLE_DOMAIN_RESTRICTION: true|g" "$GAS_FILE"
    fi
    # Set CLIENT_ID in the HTML auth template
    if [ "$CLIENT_ID" != "YOUR_CLIENT_ID.apps.googleusercontent.com" ] && [ -n "$CLIENT_ID" ]; then
        sed -i "s|var CLIENT_ID = '[^']*';|var CLIENT_ID = '${CLIENT_ID}';|" "$HTML_PAGE"
    fi
    # Master ACL spreadsheet config
    if [ "$MASTER_ACL_SPREADSHEET_ID" != "YOUR_MASTER_ACL_SPREADSHEET_ID" ] && [ -n "$MASTER_ACL_SPREADSHEET_ID" ]; then
        sed -i "s|var MASTER_ACL_SPREADSHEET_ID = .*;|var MASTER_ACL_SPREADSHEET_ID = \"${MASTER_ACL_SPREADSHEET_ID}\";|" "$GAS_FILE"
    fi
    if [ -n "$ACL_SHEET_NAME" ]; then
        sed -i "s|var ACL_SHEET_NAME = .*;|var ACL_SHEET_NAME = \"${ACL_SHEET_NAME}\";|" "$GAS_FILE"
    fi
    # Default ACL_PAGE_NAME to ENV_NAME if not specified
    ACL_PAGE_NAME="${ACL_PAGE_NAME:-$ENV_NAME}"
    sed -i "s|var ACL_PAGE_NAME  = .*;|var ACL_PAGE_NAME  = \"${ACL_PAGE_NAME}\";|" "$GAS_FILE"
    # Default PORTAL_DESCRIPTION to TITLE + ' application.' if not specified
    PORTAL_DESCRIPTION="${PORTAL_DESCRIPTION:-${TITLE} application.}"
    sed -i "s|var PORTAL_ICON    = .*;|var PORTAL_ICON    = \"${PORTAL_ICON}\";|" "$GAS_FILE"
    sed -i "s|var PORTAL_DESCRIPTION = .*;|var PORTAL_DESCRIPTION = \"${PORTAL_DESCRIPTION}\";|" "$GAS_FILE"
fi
ok "Created $GAS_FILE"

# --- Config JSON ---
if [ "$INCLUDE_AUTH" = "true" ]; then
    ACL_PAGE_NAME="${ACL_PAGE_NAME:-$ENV_NAME}"
    cat > "$GAS_CONFIG" <<CFGEOF
{
  "TITLE": "${TITLE}",
  "DEPLOYMENT_ID": "${DEPLOYMENT_ID}",
  "SPREADSHEET_ID": "${SPREADSHEET_ID}",
  "SHEET_NAME": "${SHEET_NAME}",
  "MASTER_ACL_SPREADSHEET_ID": "${MASTER_ACL_SPREADSHEET_ID}",
  "ACL_SHEET_NAME": "${ACL_SHEET_NAME}",
  "ACL_PAGE_NAME": "${ACL_PAGE_NAME}",
  "PORTAL_ICON": "${PORTAL_ICON}",
  "PORTAL_DESCRIPTION": "${PORTAL_DESCRIPTION}"
}
CFGEOF
else
    cat > "$GAS_CONFIG" <<CFGEOF
{
  "TITLE": "${TITLE}",
  "DEPLOYMENT_ID": "${DEPLOYMENT_ID}",
  "SPREADSHEET_ID": "${SPREADSHEET_ID}",
  "SHEET_NAME": "${SHEET_NAME}"
}
CFGEOF
fi
ok "Created $GAS_CONFIG"

# ── Phase 4: Create Version Files ──
info "Phase 4: Creating version files..."
echo -n '|v01.00w|' > "$HTML_VERSION"
echo -n '|v01.00g|' > "$GAS_VERSION"
ok "Created $HTML_VERSION"
ok "Created $GAS_VERSION"

# ── Phase 5: Create Changelog Files ──
info "Phase 5: Creating changelog files..."

# HTML changelog
cat > "$HTML_CL" <<CLEOF
# Changelog — ${TITLE}

All notable user-facing changes to this page are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Older sections are rotated to [${ENV_NAME}html.changelog-archive.md](${ENV_NAME}html.changelog-archive.md) when this file exceeds 50 version sections.

\`Sections: 0/50\`

## [Unreleased]

*(No changes yet)*

Developed by: LightAISolutions
CLEOF
ok "Created $HTML_CL"

# HTML changelog archive
cat > "$HTML_CL_ARCHIVE" <<CLEOF
# Changelog Archive — ${TITLE}

Older version sections rotated from [${ENV_NAME}html.changelog.md](${ENV_NAME}html.changelog.md). Full granularity preserved — entries are moved here verbatim when the main changelog exceeds 50 version sections.

## Rotation Logic

Same rotation logic as the repository changelog archive — see [CHANGELOG-archive.md](../../repository-information/CHANGELOG-archive.md) for the full procedure. In brief: count version sections, skip if ≤50, never rotate today's sections, rotate the oldest full date group together.

---

*(No archived sections yet)*

Developed by: LightAISolutions
CLEOF
ok "Created $HTML_CL_ARCHIVE"

# GAS changelog
cat > "$GAS_CL" <<CLEOF
# Changelog — ${TITLE} (Google Apps Script)

All notable user-facing changes to this script are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Older sections are rotated to [${ENV_NAME}gs.changelog-archive.md](${ENV_NAME}gs.changelog-archive.md) when this file exceeds 50 version sections.

\`Sections: 0/50\`

## [Unreleased]

*(No changes yet)*

Developed by: LightAISolutions
CLEOF
ok "Created $GAS_CL"

# GAS changelog archive
cat > "$GAS_CL_ARCHIVE" <<CLEOF
# Changelog Archive — ${TITLE} (Google Apps Script)

Older version sections rotated from [${ENV_NAME}gs.changelog.md](${ENV_NAME}gs.changelog.md). Full granularity preserved — entries are moved here verbatim when the main changelog exceeds 50 version sections.

## Rotation Logic

Same rotation logic as the repository changelog archive — see [CHANGELOG-archive.md](../../repository-information/CHANGELOG-archive.md) for the full procedure. In brief: count version sections, skip if ≤50, never rotate today's sections, rotate the oldest full date group together.

---

*(No archived sections yet)*

Developed by: LightAISolutions
CLEOF
ok "Created $GAS_CL_ARCHIVE"

# ── Phase 5b: Create Per-Environment Diagram ──
info "Phase 5b: Creating per-environment diagram..."
DIAGRAM_FILE="repository-information/diagrams/${ENV_NAME}-diagram.md"
if [ -f "$DIAGRAM_FILE" ]; then
    warn "Diagram already exists: $DIAGRAM_FILE — skipping"
else
    AUTH_NOTE=""
    AUTH_SECTION=""
    if [ "$INCLUDE_AUTH" = "true" ]; then
        AUTH_NOTE=" (Auth)"
        AUTH_SECTION="
    Note over Browser,Google: Google OAuth Authentication
    HTML->>Google: Initialize GIS (Google Identity Services)
    Google-->>HTML: GIS library loaded
    Browser->>HTML: User clicks Sign In
    HTML->>Google: requestAccessToken(CLIENT_ID, scopes)
    Google-->>HTML: Access token received
    HTML->>GAS: postMessage(gas-auth-token, token)
    GAS->>Google: Verify token + get user info
    Google-->>GAS: User email, name
    GAS->>GAS: Check authorization (ACTIVE_PRESET config)
    GAS-->>HTML: postMessage(gas-auth-result, success/fail)
"
    fi

    GOOGLE_PARTICIPANT=""
    if [ "$INCLUDE_AUTH" = "true" ]; then
        GOOGLE_PARTICIPANT="    participant Google as Google OAuth"
    fi

    cat > "$DIAGRAM_FILE" <<DIAGEOF
# ${ENV_NAME}.html — GAS Integration Sequence Diagram${AUTH_NOTE}

Sequence diagram showing the dual polling systems (HTML + GAS) and the iframe injection flow.

\`\`\`mermaid
sequenceDiagram
    participant Browser
    participant HTML as ${ENV_NAME}.html
    participant HV as ${ENV_NAME}html.version.txt
    participant GV as ${ENV_NAME}gs.version.txt
    participant GAS as GAS Web App<br>(Apps Script)
${GOOGLE_PARTICIPANT}
    participant CL as Changelogs

    Note over Browser,HTML: Page Load
    Browser->>HTML: Load ${ENV_NAME}.html
    HTML->>HTML: Decode _e → reverse(atob()) → GAS deployment URL
    HTML->>HTML: Create iframe with srcdoc bootstrap
    HTML->>GAS: iframe navigates to deployment URL
    GAS-->>Browser: GAS web app renders in iframe
${AUTH_SECTION}
    Note over Browser,HV: HTML Auto-Refresh (every 10s)
    loop Every 10 seconds
        HTML->>HV: GET ${ENV_NAME}html.version.txt?_cb=timestamp
        HV-->>HTML: |v01.XXw| or maintenance|v01.XXw|timestamp
        alt Version changed
            HTML->>HTML: Show "Updating..." + set pending-sound
            HTML->>Browser: window.location.reload()
            Browser->>HTML: Reload → "Website Ready" splash + sound
        else Maintenance mode
            HTML->>Browser: Show orange maintenance overlay
        else Same version
            HTML->>HTML: Countdown dot: 5..4..3..2..1
        end
    end

    Note over Browser,GV: GAS Auto-Refresh (15s delay, then every 10s)
    HTML->>GV: Initial check: does ${ENV_NAME}gs.version.txt exist?
    GV-->>HTML: v01.XXg (exists → show GAS pill)
    loop Every 10 seconds (after 15s initial delay)
        HTML->>GV: GET ${ENV_NAME}gs.version.txt?_cb=timestamp
        GV-->>HTML: v01.XXg
        alt GAS version changed
            HTML->>HTML: "GAS updated — reloading..."
            HTML->>Browser: window.location.reload()
            Browser->>HTML: Reload → "Code Ready" splash + sound
        else Same version
            HTML->>HTML: GAS pill countdown dot
        end
    end

    Note over HTML,GV: Anti-Sync Protection
    HTML->>HTML: If GAS poll within 3s of HTML poll,<br>add 5s delay to GAS poll

    Note over Browser,CL: Changelog Popups
    Browser->>HTML: Click HTML version pill
    HTML->>CL: Fetch ${ENV_NAME}html.changelog.md
    CL-->>HTML: Markdown → parsed to HTML popup

    Browser->>HTML: Click GAS version pill
    HTML->>CL: Fetch ${ENV_NAME}gs.changelog.md
    CL-->>HTML: Markdown → parsed to HTML popup
\`\`\`

## Key Design Notes

- **GAS iframe injection** — the deployment URL is stored as a reversed+base64-encoded string in \`_e\`. The iframe uses \`srcdoc\` with a bootstrap script that reads the URL from \`parent._r\`, deletes it, then navigates — preventing the URL from being visible in page source
- **Dual polling** — HTML and GAS versions are polled independently with anti-sync protection (if polls align within 3s, GAS poll gets a 5s delay to re-stagger them)
- **Two splash screens** — green "Website Ready" for HTML version changes, blue "Code Ready" for GAS version changes
- **Audio unlock via UAv2** — since the GAS iframe covers the entire page, click events don't reach the parent document. The UAv2 poll detects \`navigator.userActivation.hasBeenActive\` (propagated from cross-origin iframe clicks) and unlocks AudioContext without needing a direct click on the parent

Developed by: LightAISolutions
DIAGEOF
    ok "Created $DIAGRAM_FILE"

    # Every diagram must carry an "Open in mermaid.live" link (repo-docs rule).
    # Python's zlib output is pako-compatible, so the link is generated in-script.
    if command -v python3 >/dev/null 2>&1; then
        if python3 - "$DIAGRAM_FILE" <<'MERMAID_LINK_EOF'
import sys, re, json, zlib, base64
path = sys.argv[1]
with open(path) as f:
    content = f.read()
m = re.search(r'```mermaid\n(.*?)\n```', content, re.S)
if not m:
    sys.exit(1)
code = m.group(1)
state = {"code": code, "mermaid": json.dumps({"theme": "default"}, separators=(",", ":")), "autoSync": True, "updateDiagram": True}
enc = base64.urlsafe_b64encode(zlib.compress(json.dumps(state, separators=(",", ":")).encode(), 9)).decode().rstrip("=")
# Round-trip verification before writing
padded = enc + "=" * ((4 - len(enc) % 4) % 4)
if json.loads(zlib.decompress(base64.urlsafe_b64decode(padded)))["code"] != code:
    sys.exit(1)
link = "> [Open in mermaid.live](https://mermaid.live/edit#pako:" + enc + ")\n\n"
with open(path, "w") as f:
    f.write(content.replace("```mermaid\n", link + "```mermaid\n", 1))
MERMAID_LINK_EOF
        then
            ok "Added mermaid.live link to $DIAGRAM_FILE"
        else
            warn "mermaid.live link generation failed — add it manually to $DIAGRAM_FILE"
        fi
    else
        warn "python3 not found — add the mermaid.live link manually to $DIAGRAM_FILE"
    fi
fi

# ── Phase 6: Register in GAS Projects Table ──
info "Phase 6: Registering in GAS Projects table..."

TABLE_ROW="| ${PROJECT_DIR} | \`${GAS_FILE}\` | \`${GAS_CONFIG}\` | \`${HTML_PAGE}\` |"

if grep -q "| ${PROJECT_DIR} |" "$GAS_SCRIPTS_RULES" 2>/dev/null; then
    warn "Project ${PROJECT_DIR} already registered in GAS Projects table — skipping"
else
    # Anchor on the GAS Projects table header, then take the last contiguous row
    # of THAT table — a file-wide "last | line" grab lands in whatever table is
    # last in the file (the coding-guidelines pointer table).
    TABLE_HEADER_LINE=$(grep -n '^| Project | Code File |' "$GAS_SCRIPTS_RULES" 2>/dev/null | head -1 | cut -d: -f1)
    LAST_TABLE_LINE=""
    if [ -n "$TABLE_HEADER_LINE" ]; then
        LAST_TABLE_LINE=$(awk -v s="$TABLE_HEADER_LINE" 'NR>=s { if ($0 ~ /^\|/) last=NR; else exit } END { print last }' "$GAS_SCRIPTS_RULES")
    fi
    if [ -n "$LAST_TABLE_LINE" ]; then
        sed -i "${LAST_TABLE_LINE}a\\${TABLE_ROW}" "$GAS_SCRIPTS_RULES"
        ok "Registered ${PROJECT_DIR} in GAS Projects table"
    else
        warn "Could not find GAS Projects table — manual registration needed"
    fi
fi

# ── Phase 7: Update REPO-ARCHITECTURE.md ──
info "Phase 7: Updating REPO-ARCHITECTURE.md..."
ARCH_FILE="repository-information/REPO-ARCHITECTURE.md"
# Derive Mermaid node ID from ENV_NAME: uppercase, no separators
# e.g. testauthgas1 → TESTAUTHGAS1, my-app → MYAPP
NODE_ID=$(echo "$ENV_NAME" | tr '[:lower:]' '[:upper:]' | sed 's/[_-]//g')

if [ -f "$ARCH_FILE" ]; then
    # Check if already added
    if grep -q "GAS_${NODE_ID}" "$ARCH_FILE"; then
        warn "GAS_${NODE_ID} already in REPO-ARCHITECTURE.md — skipping"
    else
        ARCH_WARNINGS=0

        # 1. Add HTML page node in live-site-pages subgraph (before "end" of that subgraph)
        # Find the last page node (INDEX, TEST_PAGE, etc.) and insert after it
        LAST_PAGE_NODE=$(grep -n '^\s*[A-Z_]*\[".*\.html\\n' "$ARCH_FILE" | tail -1 | cut -d: -f1)
        if [ -n "$LAST_PAGE_NODE" ]; then
            sed -i "${LAST_PAGE_NODE}a\\            ${NODE_ID}_PAGE\[\"[template] ${ENV_NAME}.html\\\n(${TITLE})\"\]" "$ARCH_FILE"
            ok "Added page node: ${NODE_ID}_PAGE"
        else
            warn "Could not find page nodes in live-site-pages subgraph — manual edit needed"
            ARCH_WARNINGS=$((ARCH_WARNINGS + 1))
        fi

        # 2. Add GAS node in Google Apps Scripts subgraph (after last GAS_* node)
        LAST_GAS_NODE=$(grep -n '^\s*GAS_[A-Z]*\["' "$ARCH_FILE" | tail -1 | cut -d: -f1)
        if [ -n "$LAST_GAS_NODE" ]; then
            sed -i "${LAST_GAS_NODE}a\\            GAS_${NODE_ID}\[\"[template] ${ENV_NAME}.gs\"\]" "$ARCH_FILE"
            ok "Added GAS node: GAS_${NODE_ID}"
        else
            warn "Could not find GAS nodes in Google Apps Scripts subgraph — manual edit needed"
            ARCH_WARNINGS=$((ARCH_WARNINGS + 1))
        fi

        # 3. Add template source edge (auth or noauth based on INCLUDE_AUTH)
        if [ "$INCLUDE_AUTH" = "true" ]; then
            TPL_SOURCE="GASTPL_MIN_AUTH"
        else
            TPL_SOURCE="GASTPL_MIN_NOAUTH"
        fi
        LAST_TPL_EDGE=$(grep -n 'template source' "$ARCH_FILE" | grep 'setup-gas-project' | tail -1 | cut -d: -f1)
        if [ -n "$LAST_TPL_EDGE" ]; then
            sed -i "${LAST_TPL_EDGE}a\\    ${TPL_SOURCE} -.->|\"template source\\\n(setup-gas-project.sh)\"| GAS_${NODE_ID}" "$ARCH_FILE"
            ok "Added template source edge"
        fi

        # 4. Add iframe embed edge (page → GAS)
        LAST_IFRAME=$(grep -n 'embeds via iframe' "$ARCH_FILE" | tail -1 | cut -d: -f1)
        if [ -n "$LAST_IFRAME" ]; then
            sed -i "${LAST_IFRAME}a\\    ${NODE_ID}_PAGE -.->|\"embeds via iframe\"| GAS_${NODE_ID}" "$ARCH_FILE"
            ok "Added iframe embed edge"
        fi

        # 5. Add LIVE serves edge
        LAST_SERVES=$(grep -n 'LIVE -\.->|"serves"' "$ARCH_FILE" | tail -1 | cut -d: -f1)
        if [ -n "$LAST_SERVES" ]; then
            sed -i "${LAST_SERVES}a\\    LIVE -.->|\"serves\"| ${NODE_ID}_PAGE" "$ARCH_FILE"
            ok "Added LIVE serves edge"
        fi

        # 6. Add GAS_DEPLOY triggers edge
        LAST_DEPLOY=$(grep -n 'GAS_DEPLOY -\.->|"triggers self-update"' "$ARCH_FILE" | tail -1 | cut -d: -f1)
        if [ -n "$LAST_DEPLOY" ]; then
            sed -i "${LAST_DEPLOY}a\\    GAS_DEPLOY -.->|\"triggers self-update\"| GAS_${NODE_ID}" "$ARCH_FILE"
            ok "Added GAS deploy trigger edge"
        fi

        # 7. Add HTML version polling edge
        LAST_POLL=$(grep -n 'HTML_VERS -\.->|"version polling"' "$ARCH_FILE" | tail -1 | cut -d: -f1)
        if [ -n "$LAST_POLL" ]; then
            sed -i "${LAST_POLL}a\\    HTML_VERS -.->|\"version polling\"| ${NODE_ID}_PAGE" "$ARCH_FILE"
            ok "Added version polling edge"
        fi

        # 8. Add auth template HTML source edge (if auth)
        if [ "$INCLUDE_AUTH" = "true" ]; then
            # Find existing TPL_AUTH edge and add after it
            LAST_AUTH_TPL=$(grep -n 'TPL_AUTH -\.->|"copy to create' "$ARCH_FILE" | tail -1 | cut -d: -f1)
            if [ -z "$LAST_AUTH_TPL" ]; then
                LAST_AUTH_TPL=$(grep -n 'TPL_NOAUTH -\.->|"copy to create' "$ARCH_FILE" | tail -1 | cut -d: -f1)
            fi
            if [ -n "$LAST_AUTH_TPL" ]; then
                sed -i "${LAST_AUTH_TPL}a\\    TPL_AUTH -.->|\"copy to create\\\nnew auth pages\"| ${NODE_ID}_PAGE" "$ARCH_FILE"
                ok "Added auth template HTML source edge"
            fi
        else
            LAST_NOAUTH_TPL=$(grep -n 'TPL_NOAUTH -\.->|"copy to create' "$ARCH_FILE" | tail -1 | cut -d: -f1)
            if [ -n "$LAST_NOAUTH_TPL" ]; then
                sed -i "${LAST_NOAUTH_TPL}a\\    TPL_NOAUTH -.->|\"copy to create\\\nnew pages\"| ${NODE_ID}_PAGE" "$ARCH_FILE"
                ok "Added noauth template HTML source edge"
            fi
        fi

        # 9. Add per-environment diagram table row
        LAST_DIAG_ROW=$(grep -n '^| .* | \[`repository-information/diagrams/' "$ARCH_FILE" | tail -1 | cut -d: -f1)
        if [ -n "$LAST_DIAG_ROW" ]; then
            sed -i "${LAST_DIAG_ROW}a\\| ${TITLE} | [\`repository-information/diagrams/${ENV_NAME}-diagram.md\`](diagrams/${ENV_NAME}-diagram.md) |" "$ARCH_FILE"
            ok "Added per-environment diagram table row"
        fi

        if [ "$ARCH_WARNINGS" -gt 0 ]; then
            warn "REPO-ARCHITECTURE.md updated with ${ARCH_WARNINGS} warning(s) — review may be needed"
        else
            ok "REPO-ARCHITECTURE.md fully updated"
        fi
    fi
else
    warn "REPO-ARCHITECTURE.md not found — skipping"
fi

# ── Phase 8: Update README.md Structure Tree ──
info "Phase 8: Updating README.md structure tree..."
GH_BASE="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}"
GH_BLOB="${GH_BASE}/blob/main"
GH_TREE="${GH_BASE}/tree/main"
GH_PAGES="https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}"
# Spreadsheet link (if SPREADSHEET_ID is set and not placeholder)
SHEET_LINK="◽"
if [ "$SPREADSHEET_ID" != "YOUR_SPREADSHEET_ID" ] && [ -n "$SPREADSHEET_ID" ]; then
    SHEET_LINK="<a href=\"https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/\">📊</a>"
fi

if [ -f "README.md" ]; then
    # Check if already added
    if grep -q "${ENV_NAME}.html" "README.md"; then
        warn "${ENV_NAME} already in README.md structure tree — skipping"
    else
        README_WARNINGS=0

        # 1. Add page entry in Internal Sites section (before External Sites placeholder)
        EXT_SITES_LINE=$(grep -n 'External Sites' "README.md" | head -1 | cut -d: -f1)
        if [ -n "$EXT_SITES_LINE" ]; then
            # Insert before the External Sites line, with a blank separator line
            PAGE_ENTRY="│   ├── <a href=\"${GH_BLOB}/live-site-pages/${ENV_NAME}.html\">${ENV_NAME}.html</a>  →  <a href=\"${GH_PAGES}/${ENV_NAME}.html\">🌐</a>🟢 · ${SHEET_LINK} · ◽ · <a href=\"${GH_BLOB}/googleAppsScripts/${PROJECT_DIR}/${ENV_NAME}.gs\">⛽</a> · ◽  — <a href=\"${GH_BLOB}/live-site-pages/html-changelogs/${ENV_NAME}html.changelog.md\">v01.00w</a> · <a href=\"${GH_BLOB}/live-site-pages/gs-changelogs/${ENV_NAME}gs.changelog.md\">v01.00g</a> | [template] ${TITLE} page\n│   │"
            sed -i "${EXT_SITES_LINE}i\\${PAGE_ENTRY}" "README.md"
            ok "Added page entry to README.md tree"
        else
            warn "Could not find External Sites section — page entry not added"
            README_WARNINGS=$((README_WARNINGS + 1))
        fi

        # 2. Add html-versions entry (change last └── to ├── in section, add new └── entry)
        HV_LAST_LINE=$(grep -n "html-versions/.*html\.version\.txt" "README.md" | tail -1 | cut -d: -f1)
        if [ -n "$HV_LAST_LINE" ]; then
            # Change └── to ├── on the current last entry
            sed -i "${HV_LAST_LINE}s/└──/├──/" "README.md"
            HV_NEW="│   │   └── <a href=\"${GH_BLOB}/live-site-pages/html-versions/${ENV_NAME}html.version.txt\">${ENV_NAME}html.version.txt</a>          — [template]"
            sed -i "${HV_LAST_LINE}a\\${HV_NEW}" "README.md"
            ok "Added html-versions entry"
        fi

        # 3. Add gs-versions entry
        GV_LAST_LINE=$(grep -n "gs-versions/.*gs\.version\.txt" "README.md" | tail -1 | cut -d: -f1)
        if [ -n "$GV_LAST_LINE" ]; then
            sed -i "${GV_LAST_LINE}s/└──/├──/" "README.md"
            GV_NEW="│   │   └── <a href=\"${GH_BLOB}/live-site-pages/gs-versions/${ENV_NAME}gs.version.txt\">${ENV_NAME}gs.version.txt</a>            — [template]"
            sed -i "${GV_LAST_LINE}a\\${GV_NEW}" "README.md"
            ok "Added gs-versions entry"
        fi

        # 4. Add html-changelogs entries (changelog + archive)
        HC_LAST_LINE=$(grep -n "html-changelogs/.*html\.changelog" "README.md" | tail -1 | cut -d: -f1)
        if [ -n "$HC_LAST_LINE" ]; then
            sed -i "${HC_LAST_LINE}s/└──/├──/" "README.md"
            HC_NEW="│   │   ├── <a href=\"${GH_BLOB}/live-site-pages/html-changelogs/${ENV_NAME}html.changelog.md\">${ENV_NAME}html.changelog.md</a>             — [template] ${PROJECT_DIR} page changelog\n│   │   └── <a href=\"${GH_BLOB}/live-site-pages/html-changelogs/${ENV_NAME}html.changelog-archive.md\">${ENV_NAME}html.changelog-archive.md</a>     — [template] Older sections (rotated)"
            sed -i "${HC_LAST_LINE}a\\${HC_NEW}" "README.md"
            ok "Added html-changelogs entries"
        fi

        # 5. Add gs-changelogs entries (changelog + archive)
        GC_LAST_LINE=$(grep -n "gs-changelogs/.*gs\.changelog" "README.md" | tail -1 | cut -d: -f1)
        if [ -n "$GC_LAST_LINE" ]; then
            sed -i "${GC_LAST_LINE}s/└──/├──/" "README.md"
            GC_NEW="│   │   ├── <a href=\"${GH_BLOB}/live-site-pages/gs-changelogs/${ENV_NAME}gs.changelog.md\">${ENV_NAME}gs.changelog.md</a>               — [template] ${PROJECT_DIR} GAS changelog\n│   │   └── <a href=\"${GH_BLOB}/live-site-pages/gs-changelogs/${ENV_NAME}gs.changelog-archive.md\">${ENV_NAME}gs.changelog-archive.md</a>       — [template] Older sections (rotated)"
            sed -i "${GC_LAST_LINE}a\\${GC_NEW}" "README.md"
            ok "Added gs-changelogs entries"
        fi

        # 6. Add GAS directory in googleAppsScripts section
        # Change current last └── to ├── (the current last GAS project dir)
        LAST_GAS_DIR_LINE=$(grep -nE '└── <a href="[^"]*tree/main/googleAppsScripts/' "README.md" | tail -1 | cut -d: -f1 || true)
        if [ -n "$LAST_GAS_DIR_LINE" ]; then
            sed -i "${LAST_GAS_DIR_LINE}s/│   └──/│   ├──/" "README.md"
            # Fix sub-items: │       → │   │   for the 2 lines after
            NEXT_L=$((LAST_GAS_DIR_LINE + 1))
            NEXT_L2=$((LAST_GAS_DIR_LINE + 2))
            sed -i "${NEXT_L}s/│       /│   │   /" "README.md"
            sed -i "${NEXT_L2}s/│       /│   │   /" "README.md"
        fi
        # Find the blank line after googleAppsScripts section (│ followed by blank or next section)
        GAS_SECTION_END=$(grep -n '^│$' "README.md" | while read -r lineinfo; do
            LN=$(echo "$lineinfo" | cut -d: -f1)
            # Check if the previous few lines contain googleAppsScripts content
            PREV_CONTENT=$(sed -n "$((LN-5)),$((LN-1))p" "README.md")
            if echo "$PREV_CONTENT" | grep -q "config\.json"; then
                echo "$LN"
            fi
        done | tail -1)
        if [ -n "$GAS_SECTION_END" ]; then
            GAS_DIR_ENTRY="│   └── <a href=\"${GH_TREE}/googleAppsScripts/${PROJECT_DIR}\">${PROJECT_DIR}/</a>             — [template] GAS for live-site-pages/${ENV_NAME}.html\n│       ├── <a href=\"${GH_BLOB}/googleAppsScripts/${PROJECT_DIR}/${ENV_NAME}.gs\">${ENV_NAME}.gs</a>              — [template] Self-updating GAS web app\n│       └── <a href=\"${GH_BLOB}/googleAppsScripts/${PROJECT_DIR}/${ENV_NAME}.config.json\">${ENV_NAME}.config.json</a>     — [template] Project config (source of truth)"
            sed -i "${GAS_SECTION_END}i\\${GAS_DIR_ENTRY}" "README.md"
            ok "Added GAS directory to README.md tree"
        else
            warn "Could not find googleAppsScripts section end — GAS directory not added"
            README_WARNINGS=$((README_WARNINGS + 1))
        fi

        # 7. Add per-environment diagram entry (if diagrams section exists)
        LAST_DIAG_LINE=$(grep -n "diagrams/.*-diagram\.md" "README.md" | tail -1 | cut -d: -f1)
        if [ -n "$LAST_DIAG_LINE" ]; then
            sed -i "${LAST_DIAG_LINE}s/└──/├──/" "README.md"
            DIAG_ENTRY="│   │   └── <a href=\"${GH_BLOB}/repository-information/diagrams/${ENV_NAME}-diagram.md\">${ENV_NAME}-diagram.md</a>         — [template] ${PROJECT_DIR} page GAS integration sequence"
            sed -i "${LAST_DIAG_LINE}a\\${DIAG_ENTRY}" "README.md"
            ok "Added diagram entry to README.md tree"
        fi

        if [ "$README_WARNINGS" -gt 0 ]; then
            warn "README.md updated with ${README_WARNINGS} warning(s) — review may be needed"
        else
            ok "README.md tree fully updated"
        fi
    fi
else
    warn "README.md not found — skipping"
fi

# ── Phase 9: Add Workflow Deploy Step ──
info "Phase 9: Adding workflow deploy step..."
WORKFLOW_FILE=".github/workflows/auto-merge-claude.yml"
if [ -f "$WORKFLOW_FILE" ]; then
    if grep -q "Deploy ${PROJECT_DIR}" "$WORKFLOW_FILE"; then
        warn "${PROJECT_DIR} deploy step already in workflow — skipping"
    else
        # Insert before the "Update AHK version files" step (after the last GAS deploy
        # step). Anchor on the step name — banner comments are not stable across
        # workflow revisions and an unmatched anchor makes this phase silently skip.
        # The deploy step reads DEPLOYMENT_ID from config.json at merge time via jq, so it
        # works even when DEPLOYMENT_ID is still a placeholder at project setup — the case
        # statement skips the curl until the user updates config.json with the real ID.
        AHK_LINE=$(grep -n '^      - name: Update AHK version files' "$WORKFLOW_FILE" | head -1 | cut -d: -f1)
        if [ -n "$AHK_LINE" ]; then
            # Write the deploy block to a temp file, then use sed to insert it
            DEPLOY_TMPFILE=$(mktemp)
            cat > "$DEPLOY_TMPFILE" <<DEPLOY_EOF
      - name: Deploy ${PROJECT_DIR}
        if: steps.guard.outputs.skip != 'true' && success()
        run: |
          PRE=\${{ steps.merge.outputs.pre_merge_sha }}
          git diff --name-only "\$PRE" HEAD | grep -q "googleAppsScripts/${PROJECT_DIR}/${ENV_NAME}.gs" || exit 0
          DEPLOYMENT_ID=\$(jq -r .DEPLOYMENT_ID googleAppsScripts/${PROJECT_DIR}/${ENV_NAME}.config.json 2>/dev/null || echo "")
          case "\$DEPLOYMENT_ID" in ""|null|YOUR_DEPLOYMENT_ID) exit 0 ;; esac
          BASE="https://script.google.com/macros/s/\${DEPLOYMENT_ID}/exec"
          # POST first; the runner's POST can lose its body on Google's redirect, so verify
          # the response and fall back to the GAS doGet deploy route (?action=api&op=deploy)
          RESP=\$(curl -sL -X POST "\$BASE" -d "action=deploy" --max-time 120 2>/dev/null || echo "")
          case "\$RESP" in *"Updated to"*|*"Already up to date"*) echo "Deploy confirmed (POST): \$RESP"; exit 0 ;; esac
          echo "POST deploy unconfirmed — retrying via GET fallback"
          RESP=\$(curl -sL "\$BASE?action=api&op=deploy" --max-time 120 2>/dev/null || echo "")
          case "\$RESP" in *"Updated to"*|*"Already up to date"*) echo "Deploy confirmed (GET): \$RESP"; exit 0 ;; esac
          echo "::warning title=${PROJECT_DIR} GAS self-update unconfirmed::Neither POST nor GET deploy returned a confirmation — run pullAndDeployFromGitHub in the Apps Script editor. Response head: \$(echo "\$RESP" | head -c 200)"

DEPLOY_EOF
            # Use sed with r command to insert file contents before the AHK line
            sed -i "$((AHK_LINE - 1))r ${DEPLOY_TMPFILE}" "$WORKFLOW_FILE"
            rm -f "$DEPLOY_TMPFILE"
            ok "Added Deploy ${PROJECT_DIR} step to workflow"
        else
            warn "Could not find 'Update AHK version files' step in workflow — manual update needed"
        fi
    fi
else
    warn "Workflow file not found — skipping"
fi

# ── Phase 10: Sounds Directory ──
info "Phase 10: Ensuring sounds directory..."
if [ -f "live-site-pages/sounds/Website_Ready_Voice_1.mp3" ]; then
    ok "Sounds directory already populated"
else
    warn "Sound file not found — live-site-pages/sounds/Website_Ready_Voice_1.mp3 missing"
fi

# ── Phase 11: Verification ──
info "Phase 11: Verification..."
echo ""

ERRORS=0

# Check all expected files exist
EXPECTED_FILES=(
    "$HTML_PAGE"
    "$HTML_VERSION"
    "$GAS_FILE"
    "$GAS_CONFIG"
    "$GAS_VERSION"
    "$HTML_CL"
    "$HTML_CL_ARCHIVE"
    "$GAS_CL"
    "$GAS_CL_ARCHIVE"
    "$DIAGRAM_FILE"
)

for f in "${EXPECTED_FILES[@]}"; do
    if [ -f "$f" ]; then
        ok "  $f"
    else
        err "  MISSING: $f"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check for remaining template placeholders in new files
echo ""
info "Checking for remaining template placeholders..."
PLACEHOLDER_CHECK=$(grep -rn "CHANGE THIS PROJECT TITLE TEMPLATE\|<page-name>\.gs\|<page-name>\.config\.json\|YOUR_CLIENT_ID\|YOUR_DEPLOYMENT_ID" \
    "$HTML_PAGE" "$GAS_FILE" "$GAS_CONFIG" 2>/dev/null || true)

if [ -n "$PLACEHOLDER_CHECK" ]; then
    warn "Remaining template references found (may need manual review):"
    echo "$PLACEHOLDER_CHECK"
else
    ok "No template placeholders found in new files"
fi

# ── Summary ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✓ Project '${ENV_NAME}' created successfully (${#EXPECTED_FILES[@]} files)${NC}"
else
    echo -e "${RED}✗ Project creation completed with ${ERRORS} error(s)${NC}"
fi
echo ""
echo "Files created:"
for f in "${EXPECTED_FILES[@]}"; do
    echo "  $f"
done
echo ""
echo "Registered as: ${PROJECT_DIR} in GAS Projects table"
echo ""
echo "Also updated:"
echo "  - repository-information/REPO-ARCHITECTURE.md (Mermaid diagram)"
echo "  - repository-information/diagrams/${ENV_NAME}-diagram.md (sequence diagram)"
echo "  - README.md (structure tree)"
echo "  - .claude/rules/gas-scripts.md (GAS Projects table)"
echo "  - .github/workflows/auto-merge-claude.yml (GAS deploy webhook step)"
echo ""
if [ "$DEPLOYMENT_ID" = "YOUR_DEPLOYMENT_ID" ] || [ -z "$DEPLOYMENT_ID" ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}ℹ️  DEPLOYMENT_ID is still a placeholder${NC}"
    echo -e "${YELLOW}   The workflow deploy step has been added, but it will no-op${NC}"
    echo -e "${YELLOW}   until the real DEPLOYMENT_ID is in config.json.${NC}"
    echo -e "${YELLOW}   After deploying the GAS project, update DEPLOYMENT_ID in:${NC}"
    echo -e "${YELLOW}     ${GAS_DIR}/${ENV_NAME}.config.json${NC}"
    echo -e "${YELLOW}   The workflow reads it at merge time — no re-run needed.${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
fi
echo "Claude just needs to: commit and push (Pre-Commit checklist applies)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit "$ERRORS"
# Developed by: LightAISolutions
