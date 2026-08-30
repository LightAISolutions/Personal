#!/bin/bash
# compute-csp-hash.sh — Compute CSP SHA-256 hash for inline script in testauthgas1.html
#
# Usage: bash scripts/compute-csp-hash.sh [--verify]
#
# Without flags: prints the hash to paste into the CSP meta tag
# With --verify:  compares the hash in the CSP meta tag against the actual script content

FILE="live-site-pages/testauthgas1.html"

if [ ! -f "$FILE" ]; then
  echo "Error: $FILE not found. Run from the repo root." >&2
  exit 1
fi

# Extract inline script content (between first <script> and </script>)
SCRIPT_CONTENT=$(sed -n '/<script>/,/<\/script>/{ /<script>/d; /<\/script>/d; p; }' "$FILE")

if [ -z "$SCRIPT_CONTENT" ]; then
  echo "Error: No inline <script> block found in $FILE" >&2
  exit 1
fi

# Compute SHA-256 hash
COMPUTED_HASH="sha256-$(printf '%s' "$SCRIPT_CONTENT" | openssl dgst -sha256 -binary | openssl base64)"

if [ "$1" = "--verify" ]; then
  # Verification mode: compare against what's in the CSP meta tag
  CURRENT_HASH=$(grep -oP "sha256-[A-Za-z0-9+/=]+" "$FILE" | head -1)

  if [ -z "$CURRENT_HASH" ]; then
    echo "No sha256 hash found in CSP meta tag (still using 'unsafe-inline'?)"
    echo "Computed hash: '$COMPUTED_HASH'"
    exit 1
  fi

  if [ "$CURRENT_HASH" = "$COMPUTED_HASH" ]; then
    echo "✅ CSP hash matches script content"
    echo "   Hash: '$CURRENT_HASH'"
  else
    echo "❌ CSP hash MISMATCH"
    echo "   Current:  '$CURRENT_HASH'"
    echo "   Computed: '$COMPUTED_HASH'"
    echo ""
    echo "Update the CSP meta tag with the computed hash above."
    exit 1
  fi
else
  # Print mode: show the hash to use
  echo "CSP hash: '$COMPUTED_HASH'"
  echo ""
  echo "Update the CSP meta tag in $FILE:"
  echo "  script-src 'self' '$COMPUTED_HASH' 'strict-dynamic' https://accounts.google.com/gsi/client https://apis.google.com;"
fi

# Developed by: LightAISolutions
