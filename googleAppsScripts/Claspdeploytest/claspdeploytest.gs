var VERSION = "v01.01g";
var TITLE = "Clasp Deploy Test";

// ─────────────────────────────────────────────────────────────────────────────
// PILOT — "push" deployment model.
// Unlike the other GAS projects in this repo (which PULL their code from GitHub
// via pullAndDeployFromGitHub() + a GITHUB_TOKEN in Script Properties), this
// project is deployed by GitHub Actions PUSHING code in via clasp. That means
// there is intentionally NO GITHUB_TOKEN, NO pullAndDeployFromGitHub(), and NO
// doPost(action=deploy) handler here — the CI pipeline owns deployment.
// Setup: repository-information/CLASP-PUSH-PILOT-SETUP.md
// ─────────────────────────────────────────────────────────────────────────────

function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8">' +
    '<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px;color:#1a1a2e">' +
    '<h1>' + TITLE + '</h1>' +
    '<p>Deployed by GitHub Actions via <code>clasp push</code> — no Apps Script token.</p>' +
    '<p style="color:#888;font:14px monospace">Version: ' + VERSION + '</p>' +
    '</body>'
  );
}

// Developed by: LightAISolutions
