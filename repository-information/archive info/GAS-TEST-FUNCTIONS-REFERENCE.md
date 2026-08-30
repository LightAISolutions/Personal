# GAS Test Functions Reference

These functions were previously part of the `gas-test-auth` and `gas-test-noauth` template TEMPLATE regions. They serve the interactive admin/debug panel in the GAS iframe (test UI) and are **not** needed by production auth scripts.

They are archived here for future reuse if a project needs test/debug functionality within the GAS iframe. Each function includes a description of what it does and what consumes it.

---

## 1. Extended `getAppData()` — Version Count Display

**What:** Queries the Apps Script API to count version slots used (out of 200 hard limit). Caches the result for 6 hours.

**Consumer:** The test admin panel's `#versionCountValue` element.

**Why not in production:** Auth scripts don't have the test admin UI panel, so this API call would waste quota with no visible output.

**To use:** Replace the minimal `getAppData()` in the TEMPLATE region.

```javascript
function getAppData() {
  var data = { version: VERSION, title: TITLE };

  var cache = CacheService.getScriptCache();
  var vStatus = cache.get("version_count_status");
  if (!vStatus) {
    try {
      var scriptId = ScriptApp.getScriptId();
      var totalVersions = 0;
      var vPageToken = null;
      do {
        var vListUrl = "https://script.googleapis.com/v1/projects/" + scriptId + "/versions"
          + (vPageToken ? "?pageToken=" + vPageToken : "");
        var vListResp = UrlFetchApp.fetch(vListUrl, {
          headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() }
        });
        var vListData = JSON.parse(vListResp.getContentText());
        if (vListData.versions) totalVersions += vListData.versions.length;
        vPageToken = vListData.nextPageToken || null;
      } while (vPageToken);
      vStatus = totalVersions + "/200";
      if (totalVersions >= 180) vStatus += " — APPROACHING LIMIT!";
      cache.put("version_count_status", vStatus, 21600);
    } catch(e) {
      vStatus = "...";
    }
  }
  data.versionCount = vStatus;
  return data;
}
```

---

## 2. `getSoundBase64()`

**What:** Fetches an audio file from Google Drive (via `SOUND_FILE_ID`), converts to a base64 data URL for playback within the GAS iframe.

**Consumer:** Test admin panel calls `google.script.run.getSoundBase64()`.

**Why not in production:** Auth pages handle sounds in the HTML layer (`Website_Ready_Voice_1.mp3` served from GitHub Pages).

```javascript
function getSoundBase64() {
  if (!SOUND_FILE_ID || SOUND_FILE_ID === "") return null;
  var url = "https://drive.google.com/uc?export=download&id=" + SOUND_FILE_ID;
  var response = UrlFetchApp.fetch(url, { followRedirects: true });
  var blob = response.getBlob();
  var base64 = Utilities.base64Encode(blob.getBytes());
  var contentType = blob.getContentType() || "audio/mpeg";
  return "data:" + contentType + ";base64," + base64;
}
```

---

## 3. `writeVersionToSheet()`

**What:** Writes `VERSION` + timestamp to cell A1 as a visual deploy indicator.

**Consumer:** Called manually or from test UI to confirm deploys happened.

**Why not in production:** Auth scripts track versions via `gs.version.txt`.

```javascript
function writeVersionToSheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "YOUR_SPREADSHEET_ID") return;
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange("A1").setValue(VERSION + " — " + new Date().toLocaleString());
  } catch(e) {}
}
```

---

## 4. `readB1FromCacheOrSheet()`

**What:** Reads cell B1 from the project's Google Sheet with 6-hour cache.

**Consumer:** Test admin panel's "Live Data" feature.

**Why not in production:** Auth scripts use `processDataPoll()` in AUTH section.

```javascript
function readB1FromCacheOrSheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "YOUR_SPREADSHEET_ID") return "";
  var cache = CacheService.getScriptCache();
  var cached = cache.get("live_b1");
  if (cached !== null) return cached;

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return "";
  var val = sheet.getRange("B1").getValue();
  var result = val !== null && val !== undefined ? String(val) : "";
  cache.put("live_b1", result, 21600);
  return result;
}
```

---

## 5. `onEditWriteB1ToCache(e)`

**What:** Installable trigger handler — caches B1 on sheet edit so the next `readB1FromCacheOrSheet()` call returns the fresh value immediately.

**Consumer:** Companion to `readB1FromCacheOrSheet()`. Requires trigger setup: Apps Script editor → Triggers → + Add Trigger → Function: `onEditWriteB1ToCache`, Event: From spreadsheet, On edit.

**Why not in production:** `readB1FromCacheOrSheet()` isn't in production.

```javascript
function onEditWriteB1ToCache(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  if (e.range.getRow() !== 1 || e.range.getColumn() !== 2) return;
  var val = e.range.getValue();
  var result = val !== null && val !== undefined ? String(val) : "";
  CacheService.getScriptCache().put("live_b1", result, 21600);
}
```

---

## 6. `fetchGitHubQuotaAndLimits()`

**What:** Queries GitHub API rate limits and returns a summary of resource quotas (GitHub API remaining calls, GAS quota reference values, MailApp daily quota).

**Consumer:** Test admin panel's quota/diagnostics display.

**Why not in production:** No UI to display these in auth pages.

```javascript
function fetchGitHubQuotaAndLimits() {
  var result = {};

  var GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  var headers = {};
  if (GITHUB_TOKEN) {
    headers["Authorization"] = "token " + GITHUB_TOKEN;
  }
  try {
    var resp = UrlFetchApp.fetch("https://api.github.com/rate_limit", { headers: headers });
    var data = JSON.parse(resp.getContentText());
    var core = data.resources.core;
    result.github = core.remaining + "/" + core.limit + "/hr";
  } catch(e) {
    result.github = "error";
  }

  result.urlFetch = "20,000/day";
  result.spreadsheet = "~20,000/day";
  result.execTime = "90 min/day";

  try {
    var mailRemaining = MailApp.getRemainingDailyQuota();
    result.mail = mailRemaining + " remaining/day";
  } catch(e) {
    result.mail = "scope error: " + e.message;
  }

  return result;
}
```

---

Developed by: LightAISolutions
