# Google OAuth Authentication Pattern — GIS + GAS + Custom Domain HTML Wrapper

Reference implementation originally derived from `testaed.gs` + `testaed.html` (source files removed). Use this pattern when implementing Google account-based authentication for a Google Apps Script web app where authorization is determined by the user's access to the backing Google Sheet. This uses **Google Identity Services (GIS) OAuth2** — the user signs in with their real Google account, and no custom credentials are stored.

## Architecture Overview

Two files work together:

1. **HTML wrapper** (hosted on GitHub Pages / custom domain) — loads the Google Identity Services library, manages the OAuth2 token flow, stores the access token in `localStorage`, shows/hides an auth wall based on messages from the GAS iframe, and passes the token to the iframe as a URL parameter
2. **GAS script** (deployed as web app) — receives the OAuth access token, validates it server-side by calling Google's userinfo API, then checks if the user's email has access to the backing spreadsheet (editors/viewers list)

### Why Two Files?

Same reason as the Custom Auth pattern — GAS iframe sandboxing prevents controlling the parent URL. But this pattern has an additional reason: **Google Identity Services (GIS) cannot be loaded inside a GAS iframe**. The `accounts.google.com/gsi/client` library and its OAuth popup must be initiated from the parent page (the HTML wrapper on the custom domain), not from inside the GAS-served content. The HTML wrapper:
- Loads the GIS library and initiates the OAuth2 token flow
- Manages `localStorage` for persistent token + email storage
- Provides the auth wall UI (sign-in required / access denied states)
- Passes the obtained `access_token` to the GAS iframe as a URL parameter
- Handles `postMessage` from the GAS iframe for auth status communication

---

## Authentication Flow

```
User visits custom domain URL
        │
        ▼
┌──────────────────────────────┐
│  HTML Wrapper checks          │  localStorage.getItem('gis-token')
│  for stored OAuth token       │
└─────────┬────────────────────┘
          │
    ┌─────┴─────┐
    │           │
 No token    Has token
    │           │
    ▼           ▼
┌──────────┐  ┌──────────────────────┐
│ Show     │  │ Load GAS iframe with │
│ Auth Wall│  │ ?token=ACCESS_TOKEN  │
│ "Sign In │  └──────────┬───────────┘
│  with    │             │
│  Google" │             ▼
└────┬─────┘  ┌──────────────────────┐
     │        │ GAS: getUserInfo()    │
     │        │ Calls googleapis.com/ │
     │        │ oauth2/v3/userinfo    │
     │        │ with Bearer token     │
     │        └──────────┬───────────┘
     │              ┌────┴────┐
     │           Valid      Invalid
     │              │           │
     │              ▼           │
     │        ┌──────────────┐  │
     │        │ checkSpread- │  │
     │        │ sheetAccess  │  │
     │        │ (email)      │  │
     │        └────┬─────────┘  │
     │        ┌────┴────┐       │
     │     Editor/    Not in    │
     │     Viewer     access    │
     │        │       list      │
     │        ▼         │       │
     │   Serve app      ▼       ▼
     │   + postMsg   postMessage to parent:
     │   "gas-auth-  "gas-needs-auth"
     │    ok"         │
     │                ▼
     │          Auth wall shows:
     │          - "Access Denied" (has email, no Sheet access)
     │          - "Sign-In Required" (no email / expired token)
     │                │
     ▼                ▼
User clicks "Sign In with Google"
        │
        ▼
┌─────────────────────────┐
│ HTML loads GIS library    │  accounts.google.com/gsi/client
│ (dynamically, on demand) │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ initTokenClient({        │  Google's OAuth2 popup appears
│   client_id: '...',      │
│   scope: 'email profile' │
│ })                       │
│ .requestAccessToken()    │
└─────────┬───────────────┘
          │ resp.access_token
          ▼
┌─────────────────────────┐
│ Fetch user email from    │  GET googleapis.com/oauth2/v3/userinfo
│ Google's userinfo API    │  Authorization: Bearer ACCESS_TOKEN
│                          │
│ Store in localStorage:   │
│   gis-token = token      │
│   gis-email = email      │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ Hide auth wall           │
│ Show Sign Out button     │
│ Reload GAS iframe with   │  gasUrl + '&token=' + token
│ new token                │
└─────────────────────────┘
```

### Sign Out Flow

```
User clicks "Sign Out" → Confirmation dialog
        │ Confirmed
        ▼
┌─────────────────────────┐
│ localStorage.removeItem  │  Remove gis-token and gis-email
│ ('gis-token')            │
│ ('gis-email')            │
│                          │
│ Hide Sign Out button     │
│ Show Auth Wall           │  "Sign-In Required" state
└─────────────────────────┘
```

---

## Implementation Components

### 1. HTML Wrapper (Custom Domain Page)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your App Title</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }

    /* Auth wall — covers entire viewport */
    .auth-wall {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #fff;
      display: none; align-items: center; justify-content: center; z-index: 10000;
      flex-direction: column; gap: 16px; text-align: center; padding: 20px;
      font-family: Arial, Helvetica, sans-serif;
    }
    .auth-wall.show { display: flex; }

    /* Sign out button — top right corner */
    .sign-out-btn {
      position: fixed; top: 8px; right: 8px; z-index: 9999;
      background: rgba(0,0,0,0.55); color: #ccc; padding: 4px 10px;
      border-radius: 12px; font: 11px/1 monospace; cursor: pointer;
      border: none; transition: all 0.2s; user-select: none;
    }
    .sign-out-btn:hover { background: rgba(211,47,47,0.8); color: #fff; }
  </style>
</head>
<body>
  <div id="auth-wall" class="auth-wall"></div>
  <button id="sign-out-btn" class="sign-out-btn" style="display:none" onclick="signOut()">Sign Out</button>
  <iframe id="gas-app" allow="*"></iframe>

  <script>
    var _gisLoaded = false;
    var _requireAuth = false;

    // UPDATE: Your deployed GAS web app URL with ?embedded=1
    var _gasBaseUrl = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?embedded=1';

    // Load Google Identity Services library on demand
    function loadGis(cb) {
      if (_gisLoaded) { cb(); return; }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = function() { _gisLoaded = true; cb(); };
      document.head.appendChild(s);
    }

    // Load or reload the GAS iframe with the current token
    function reloadIframe() {
      var iframe = document.getElementById('gas-app');
      var token = localStorage.getItem('gis-token') || '';
      iframe.src = _gasBaseUrl + (token ? '&token=' + encodeURIComponent(token) : '');
    }

    // Sign out — clear stored token and email
    function signOut() {
      localStorage.removeItem('gis-token');
      localStorage.removeItem('gis-email');
      document.getElementById('sign-out-btn').style.display = 'none';
      _requireAuth = true;
      showAuthWall('not_signed_in', '');
    }

    // Trigger Google OAuth2 sign-in popup
    function triggerGisSignIn() {
      loadGis(function() {
        var client = google.accounts.oauth2.initTokenClient({
          // UPDATE: Your Google Cloud project's OAuth2 client ID
          client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
          scope: 'email profile',
          callback: function(resp) {
            if (resp && resp.access_token) {
              localStorage.setItem('gis-token', resp.access_token);
              // Fetch the user's email
              fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': 'Bearer ' + resp.access_token }
              }).then(function(r) { return r.json(); }).then(function(info) {
                if (info.email) localStorage.setItem('gis-email', info.email);
              }).catch(function() {}).finally(function() {
                document.getElementById('auth-wall').classList.remove('show');
                document.getElementById('sign-out-btn').style.display = '';
                reloadIframe();
              });
            }
          }
        });
        client.requestAccessToken();
      });
    }

    // Show auth wall — two states: "Sign-In Required" or "Access Denied"
    function showAuthWall(authStatus, email) {
      var wall = document.getElementById('auth-wall');
      var knownEmail = email || localStorage.getItem('gis-email') || '';
      if (knownEmail) {
        // User is signed in but doesn't have Sheet access
        wall.innerHTML = '<h2>Access Denied</h2>'
          + '<p>Signed in as: <strong>' + knownEmail + '</strong></p>'
          + '<p>This account does not have access.</p>'
          + '<a href="#" onclick="triggerGisSignIn();return false;" '
          + 'style="padding:10px 28px;background:#f4511e;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">'
          + 'Switch Google Account</a>';
      } else {
        // No user signed in
        wall.innerHTML = '<h2>Sign-In Required</h2>'
          + '<p>You must sign in with an authorized Google account.</p>'
          + '<a href="#" onclick="triggerGisSignIn();return false;" '
          + 'style="padding:10px 28px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">'
          + 'Sign In with Google</a>';
      }
      document.getElementById('sign-out-btn').style.display = 'none';
      wall.classList.add('show');
    }

    // Listen for messages from GAS iframe
    window.addEventListener('message', function(e) {
      if (!e.data) return;
      if (e.data.type === 'gas-needs-auth') {
        // GAS says user is not authorized — show auth wall
        showAuthWall(e.data.authStatus, e.data.email);
        return;
      }
      if (e.data.type === 'gas-auth-ok') {
        // GAS confirmed user is authorized — show sign out button
        if (!_requireAuth) document.getElementById('sign-out-btn').style.display = '';
        return;
      }
      if (e.data.type === 'gas-auth-complete') {
        // Auth flow complete from inside GAS — hide wall and reload
        _requireAuth = false;
        document.getElementById('auth-wall').classList.remove('show');
        reloadIframe();
        return;
      }
    });

    // Initial load
    reloadIframe();
    if (!localStorage.getItem('gis-token')) {
      _requireAuth = true;
      showAuthWall('not_signed_in', '');
    }
  </script>
</body>
</html>
```

### 2. GAS Authentication Functions (Server-Side)

#### Core Auth Functions

```javascript
// Validate user identity via OAuth token or GAS session
function getUserInfo(opt_token) {
  var cache = CacheService.getScriptCache();
  var cacheKey = opt_token
    ? "userinfo_" + opt_token.substr(-20)
    : "userinfo_session_" + (Session.getActiveUser().getEmail() || "none");
  var cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }

  var email = "";

  // If an OAuth token was passed, validate it server-side
  if (opt_token) {
    try {
      var resp = UrlFetchApp.fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { "Authorization": "Bearer " + opt_token },
        muteHttpExceptions: true
      });
      if (resp.getResponseCode() === 200) {
        var info = JSON.parse(resp.getContentText());
        email = info.email || "";
      }
    } catch(e) {}
  }

  // Fallback to GAS session identity
  if (!email) {
    email = Session.getActiveUser().getEmail();
  }

  if (!email) {
    return { status: "not_signed_in" };
  }

  // Build display name from email prefix
  var prefix = email.split("@")[0];
  var displayName = prefix.split(/[._-]/).map(function(part) {
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(" ");

  var result = { status: "authorized", email: email, displayName: displayName };
  cache.put(cacheKey, JSON.stringify(result), 300); // Cache 5 min
  return result;
}

// Check if user has Sheet access (editor or viewer)
function checkSpreadsheetAccess(email, opt_ss) {
  if (!email) return false;
  var lowerEmail = email.toLowerCase();
  var cache = CacheService.getScriptCache();
  var cacheKey = "access_" + lowerEmail;
  var cached = cache.get(cacheKey);
  if (cached !== null) return cached === "1";

  var ss = opt_ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  var editors = ss.getEditors();
  for (var i = 0; i < editors.length; i++) {
    if (editors[i].getEmail().toLowerCase() === lowerEmail) {
      cache.put(cacheKey, "1", 600); // Cache 10 min
      return true;
    }
  }
  var viewers = ss.getViewers();
  for (var i = 0; i < viewers.length; i++) {
    if (viewers[i].getEmail().toLowerCase() === lowerEmail) {
      cache.put(cacheKey, "1", 600);
      return true;
    }
  }
  cache.put(cacheKey, "0", 600);
  return false;
}
```

#### doGet Entry Point Pattern

```javascript
function doGet(e) {
  var token = (e && e.parameter && e.parameter.token) || "";
  var html = buildAppHtml(token);
  return HtmlService.createHtmlOutput(html)
    .setTitle("Your App Title")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

#### Data Function Pattern (Auth Gate)

Every data function validates the token before executing:

```javascript
function getFormData(opt_token) {
  var userInfo = getUserInfo(opt_token);
  if (userInfo.status !== "authorized") {
    return {
      authorized: false,
      authStatus: userInfo.status,
      email: userInfo.email || "",
      version: "v" + VERSION
    };
  }
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!checkSpreadsheetAccess(userInfo.email, ss)) {
    return {
      authorized: false,
      authStatus: "no_access",
      email: userInfo.email || "",
      version: "v" + VERSION
    };
  }
  // ... fetch and return data ...
  return { authorized: true, user: userInfo, data: data, version: "v" + VERSION };
}
```

### 3. Client-Side Auth Logic (Inside GAS-Served HTML)

```javascript
// Token passed from parent via URL parameter
var _token = ''; // Injected by GAS server: JSON.stringify(opt_token || "")

// On data load, check authorization
function loadData() {
  google.script.run
    .withSuccessHandler(function(d) {
      if (!d.authorized) {
        // Tell parent to show auth wall
        showAuthWall(d);
        return;
      }
      // Auth OK — tell parent
      try {
        window.top.postMessage({ type: "gas-auth-ok", version: d.version || "" }, "*");
      } catch(e) {}
      // ... render app ...
    })
    .getFormData(_token);
}

// Notify parent that auth failed
function showAuthWall(d) {
  var msg = {
    type: "gas-needs-auth",
    authStatus: d.authStatus || "not_signed_in",
    email: d.email || "",
    version: d.version || ""
  };
  try { window.top.postMessage(msg, "*"); } catch(e) {}
  try { window.parent.postMessage(msg, "*"); } catch(e) {}
}
```

### 4. postMessage Protocol

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `gas-needs-auth` | GAS → Parent | User is not authorized; parent should show auth wall. Includes `authStatus` ("not_signed_in" or "no_access"), `email`, `version` |
| `gas-auth-ok` | GAS → Parent | User is authorized; parent should show Sign Out button. Includes `version` |
| `gas-auth-complete` | GAS → Parent | Auth flow completed inside GAS context; parent should hide auth wall and reload iframe |

---

## Setup Requirements

### Google Cloud Console Setup
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the "Google Identity" API (or just "OAuth consent screen")
3. Configure OAuth consent screen (External or Internal)
4. Create an **OAuth 2.0 Client ID** (Web application type)
   - Add authorized JavaScript origins: your custom domain (e.g. `https://yourdomain.github.io`)
   - No redirect URIs needed (token flow uses popup, not redirect)
5. Copy the `client_id` into the HTML wrapper's `initTokenClient()` call

### Google Apps Script Setup
1. Deploy as web app: "Execute as: Me", "Who has access: Anyone"
2. The `SPREADSHEET_ID` must point to a Google Sheet
3. Users must be added as editors or viewers of that Sheet to gain access

---

## Security Features Checklist

- [ ] **Server-side token validation** — `getUserInfo()` calls Google's userinfo API with the token (never trusts client claims)
- [ ] **Spreadsheet-based authorization** — `checkSpreadsheetAccess()` checks Sheet editors/viewers list (single source of truth)
- [ ] **User identity caching** — `getUserInfo()` cached 5 min in CacheService (reduces Google API calls)
- [ ] **Access check caching** — `checkSpreadsheetAccess()` cached 10 min in CacheService
- [ ] **Per-function auth gate** — every data/mutation function validates the token before executing
- [ ] **Auth wall states** — "Sign-In Required" (no account) vs "Access Denied" (wrong account) with appropriate actions
- [ ] **Sign out** — clears localStorage tokens, re-shows auth wall
- [ ] **Dynamic GIS loading** — library loaded only when needed (not on every page load)
- [ ] **postMessage protocol** — structured communication between GAS iframe and parent for auth status

## Comparison: Custom Auth vs Google OAuth

| Aspect | Custom Auth (01-CUSTOM-AUTH-PATTERN.md) | Google OAuth (this file) |
|--------|--------------------------------------|--------------------------|
| **When to use** | Need custom usernames, HIPAA compliance, full session control | Users already have Google accounts, Sheet sharing = access control |
| **Identity provider** | Self-managed (Sheets-based credentials) | Google (GIS OAuth2) |
| **Token type** | Self-generated UUID (48 chars) | Google OAuth2 access_token |
| **Token storage** | Server-side CacheService (15 min TTL) | Client-side localStorage (persistent until sign-out) |
| **Token validation** | Check own CacheService lookup | Call Google's userinfo API server-side |
| **Authorization** | Username exists in Users sheet | Email has Sheet editor/viewer access |
| **Passwords** | Stored in Sheets (recommend hashing) | N/A — Google handles credentials |
| **Session expiry** | 15 min (server-controlled, HIPAA) | Google token expiry (~1 hour), persistent in localStorage |
| **Login UI** | Custom animated login page in GAS | Google's standard OAuth popup |
| **Setup complexity** | Lower (no Google Cloud project needed) | Higher (need Google Cloud Console OAuth client ID) |
| **Lockout protection** | Built-in (5 attempts = 15 min) | Google handles it |
| **Audit logging** | Built-in HIPAA audit trail | Not included (add if needed) |

## Source Files

> **Note:** The original source files have been removed from the repo. This document preserves the implementation pattern for reference.
>
> - ~~**HTML wrapper**: `live-site-pages/testaed.html`~~ (removed)
> - ~~**GAS script**: `googleAppsScripts/testaed.gs`~~ (removed)

Developed by: LightAISolutions
