// ===========================================================================
// Sample GAS — self-updating web app
// ---------------------------------------------------------------------------
// Replace YOUR_* placeholders with your actual values once the GAS deployment
// exists. Initial deploy bootstrap is two-step (see README.md):
//   1. Deploy once with DEPLOYMENT_ID still as the placeholder to mint a real
//      deployment ID
//   2. Paste that ID back in, push to main → workflow webhook re-deploys
// ===========================================================================

var VERSION       = "v01.00g";
var TITLE         = "YOUR_PROJECT_TITLE";
var GITHUB_OWNER  = "YOUR_ORG_NAME";
var GITHUB_REPO   = "YOUR_REPO_NAME";
var GITHUB_BRANCH = "main";
var FILE_PATH     = "googleAppsScripts/YOUR_PROJECT_FOLDER/sample.gs";
var DEPLOYMENT_ID = "YOUR_DEPLOYMENT_ID";

// ══════════════
// PROJECT START
// ══════════════
// Project-specific code goes here. Empty by default — template propagation
// preserves anything you add inside this block.

// ══════════════
// PROJECT END
// ══════════════

// ══════════════
// TEMPLATE START
// ══════════════

function doGet() {
  var html = ''
    + '<!DOCTYPE html><html><head>'
    + '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">'
    + '<style>body{font:14px/1.5 system-ui,sans-serif;margin:2em;color:#222;}'
    + '#v{position:fixed;bottom:8px;left:8px;font:11px monospace;color:#1565c0;opacity:0.7;}</style>'
    + '</head><body>'
    + '<h2>' + TITLE + '</h2>'
    + '<p id="v">' + VERSION + '</p>'
    + '<script>'
    + 'window.addEventListener("message",function(e){'
    + '  if(e.data&&e.data.type==="gas-version-check"){'
    + '    google.script.run.withSuccessHandler(function(d){'
    + '      top.postMessage({type:"gas-version",version:d.version},"*");'
    + '    }).withFailureHandler(function(){'
    + '      top.postMessage({type:"gas-version",version:null},"*");'
    + '    }).getAppData();'
    + '  }'
    + '});'
    + '</script>'
    + '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) || "";

  // ⚠️ CRITICAL: Do NOT add authentication, secret checks, or any guards to this deploy handler.
  // The GitHub Actions workflow calls doPost(action=deploy) via webhook to trigger GAS self-update.
  // Adding auth here (e.g. DEPLOY_SECRET check) will silently break auto-updates — the workflow
  // gets "Unauthorized" and the GAS script never pulls new code from GitHub.
  // The deploy action only calls pullAndDeployFromGitHub() which is safe — it overwrites the
  // script with whatever is on GitHub (the source of truth), so there is no abuse vector.
  if (action === "deploy") {
    var result = pullAndDeployFromGitHub();
    return ContentService.createTextOutput(result);
  }

  return ContentService.createTextOutput("Unknown action");
}

function getAppData() {
  return { version: VERSION, title: TITLE };
}

function pullAndDeployFromGitHub() {
  var GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");

  // 1. Fetch the latest source from GitHub (raw content).
  var apiUrl = "https://api.github.com/repos/"
    + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + FILE_PATH
    + "?ref=" + GITHUB_BRANCH + "&t=" + new Date().getTime();
  var fetchHeaders = { "Accept": "application/vnd.github.v3.raw" };
  if (GITHUB_TOKEN) fetchHeaders["Authorization"] = "token " + GITHUB_TOKEN;
  var response = UrlFetchApp.fetch(apiUrl, { headers: fetchHeaders });
  var newCode  = response.getContentText();

  // 2. No-op if remote VERSION matches local.
  var versionMatch  = newCode.match(/var VERSION\s*=\s*"([^"]+)"/);
  var pulledVersion = versionMatch ? versionMatch[1] : null;
  if (pulledVersion && pulledVersion === VERSION) {
    return "Already up to date (" + VERSION + ")";
  }

  // 3. Overwrite the script content (preserving the appsscript manifest).
  var scriptId   = ScriptApp.getScriptId();
  var contentUrl = "https://script.googleapis.com/v1/projects/" + scriptId + "/content";
  var current    = UrlFetchApp.fetch(contentUrl, {
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() }
  });
  var currentFiles = JSON.parse(current.getContentText()).files;
  var manifest = currentFiles.find(function(f) { return f.name === "appsscript"; });

  UrlFetchApp.fetch(contentUrl, {
    method: "put",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({
      files: [ { name: "Code", type: "SERVER_JS", source: newCode }, manifest ]
    })
  });

  // 4. Create a new version, then redeploy under the existing DEPLOYMENT_ID.
  var versionUrl      = "https://script.googleapis.com/v1/projects/" + scriptId + "/versions";
  var versionResponse = UrlFetchApp.fetch(versionUrl, {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({
      description: pulledVersion + " — from GitHub " + new Date().toLocaleString()
    })
  });
  var newVersion = JSON.parse(versionResponse.getContentText()).versionNumber;

  var deployUrl = "https://script.googleapis.com/v1/projects/" + scriptId
                + "/deployments/" + DEPLOYMENT_ID;
  UrlFetchApp.fetch(deployUrl, {
    method: "put",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({
      deploymentConfig: {
        scriptId: scriptId,
        versionNumber: newVersion,
        description: pulledVersion + " (deployment " + newVersion + ")"
      }
    })
  });

  return "Updated to " + pulledVersion + " (deployment " + newVersion + ")";
}

// ══════════════
// TEMPLATE END
// ══════════════
// Developed by: LightAISolutions
