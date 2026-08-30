# Microsoft Authentication Implementation Plan

## Context

The current auth system uses Google Identity Services (GIS) on the HTML client side and Google token validation via `googleapis.com/oauth2/v3/userinfo` on the GAS server side. The user wants to add Microsoft as a second authorization provider, maintaining the same quality standard as the existing Google auth. This document provides a complete implementation plan with all technical context needed to execute.

## Architecture Decision: Provider Toggle via `AUTH_PROVIDER` Config Variable

**Recommended approach**: Add an `AUTH_PROVIDER` variable (`'google'`, `'microsoft'`, or `'both'`) to both the GAS config and HTML config. Provider-specific code is wrapped in conditionals. Shared code (session management, ACL checks, HMAC, audit logging, heartbeat, etc.) stays unified — it is already provider-agnostic.

**Why this approach over alternatives**:
- Separate template files would duplicate ~80% of the code and double the maintenance burden
- True interface abstraction is overkill for 2 providers
- A config toggle fits the existing preset/override pattern perfectly

## Prerequisites (User Must Complete Before Implementation)

### Azure AD App Registration
1. Go to [Microsoft Entra admin center](https://entra.microsoft.com) → App registrations → New registration
2. Name: whatever the project is called
3. Supported account types — choose based on use case:
   - **Single tenant** (`https://login.microsoftonline.com/{tenant-id}`) — internal org users only
   - **Multi-tenant** (`https://login.microsoftonline.com/common`) — any org + personal accounts
   - **Organizations only** (`https://login.microsoftonline.com/organizations`) — any org, no personal
   - **Consumers only** (`https://login.microsoftonline.com/consumers`) — personal Microsoft accounts only
4. Platform: select **"Single-page application (SPA)"** — NOT "Web". This enables PKCE automatically
5. Redirect URI: the GitHub Pages URL (e.g. `https://yourorg.github.io/yourrepo/`)
6. API permissions → Microsoft Graph → Delegated:
   - `openid` (Sign users in)
   - `profile` (View users' basic profile)
   - `email` (View users' email address)
   - `User.Read` (Sign in and read user profile)
7. Note the **Application (client) ID** and **Directory (tenant) ID**

## MSAL.js Technical Reference

### Critical: No CDN Available
MSAL.js v2+ is **NOT distributed via CDN** — the `@azure/msal-browser` CDN has been fully deprecated. However, for our use case (static HTML pages deployed to GitHub Pages), we have two options:

**Option A (Recommended for this project)**: Use a third-party CDN that mirrors npm packages:
```html
<script src="https://cdn.jsdelivr.net/npm/@azure/msal-browser@3/lib/msal-browser.min.js"></script>
```
This works similarly to how we load Google's GIS via `<script>` tag. The `msal` global will be available.

**Option B**: Bundle MSAL.js into a self-hosted file in `live-site-pages/` and reference it with a relative path. More control, but requires manual updates.

### MSAL.js Initialization
```javascript
var msalConfig = {
    auth: {
        clientId: MICROSOFT_CLIENT_ID,
        authority: AZURE_AUTHORITY_URL,  // e.g. 'https://login.microsoftonline.com/common'
        redirectUri: window.location.origin + window.location.pathname
    },
    cache: {
        cacheLocation: HTML_CONFIG.STORAGE_TYPE,  // reuse existing config: 'localStorage' or 'sessionStorage'
        storeAuthStateInCookie: false
    }
};
var msalInstance = new msal.PublicClientApplication(msalConfig);
```

**Important**: `msalInstance.initialize()` must be awaited before any other MSAL calls. Use the factory method for cleaner code:
```javascript
msal.PublicClientApplication.createPublicClientApplication(msalConfig).then(function(instance) {
    msalInstance = instance;
});
```

### Login & Token Acquisition
```javascript
// Step 1: Sign in (get ID token + account)
msalInstance.loginPopup({
    scopes: ['openid', 'profile', 'email']
}).then(function(loginResponse) {
    msalInstance.setActiveAccount(loginResponse.account);
    // Step 2: Get access token for Microsoft Graph
    return msalInstance.acquireTokenPopup({
        scopes: ['https://graph.microsoft.com/User.Read']
    });
}).then(function(tokenResponse) {
    // tokenResponse.accessToken — send to GAS for validation
    exchangeToken(tokenResponse.accessToken);
});
```

### Token Response Object Structure
```javascript
{
    accessToken: "eyJ0eXAi...",       // JWT for API calls (2-3 KB — larger than Google)
    idToken: "eyJ0eXAi...",           // JWT with identity claims
    expiresOn: Date,                  // Expiration timestamp
    scopes: ["User.Read"],            // Granted scopes
    account: {
        homeAccountId: "...",
        username: "user@contoso.com",
        name: "John Doe",
        tenantId: "..."
    },
    tokenType: "Bearer"
}
```

### Silent Token Renewal
```javascript
// Try silent first, fall back to popup
function getMicrosoftAccessToken() {
    var account = msalInstance.getActiveAccount();
    if (!account) return Promise.reject('No active account');

    return msalInstance.acquireTokenSilent({
        scopes: ['https://graph.microsoft.com/User.Read'],
        account: account
    }).catch(function(error) {
        if (error instanceof msal.InteractionRequiredAuthError) {
            return msalInstance.acquireTokenPopup({
                scopes: ['https://graph.microsoft.com/User.Read']
            });
        }
        throw error;
    });
}
```

### Logout
```javascript
msalInstance.logoutPopup({
    postLogoutRedirectUri: window.location.origin + window.location.pathname
});
// Note: No google.accounts.oauth2.revoke() equivalent — MSAL clears local cache
// and redirects to Microsoft's logout endpoint
```

### Error Types
- `InteractionRequiredAuthError` — thrown by `acquireTokenSilent()` when user interaction needed (refresh token expired, new consent/MFA required)
- `BrowserAuthError` with `errorCode: "interaction_in_progress"` — another popup is already open
- `BrowserAuthError` with `errorCode: "monitor_window_timeout"` — popup was blocked

### Key Differences from Google GIS

| Aspect | Google GIS | Microsoft MSAL.js |
|--------|-----------|-------------------|
| Loading | `<script src="accounts.google.com/gsi/client">` | CDN `<script>` or npm bundle |
| Init | `google.accounts.oauth2.initTokenClient({...})` | `new msal.PublicClientApplication({...})` + `await initialize()` |
| Sign-in | `signInClient.requestAccessToken()` | `msalInstance.loginPopup({scopes})` then `acquireTokenPopup({scopes})` |
| Silent auth | `prompt: ''` on initTokenClient | `acquireTokenSilent({scopes, account})` |
| Interactive auth | `prompt: 'select_account'` | `loginPopup({prompt: 'select_account'})` |
| Token field | `response.access_token` | `response.accessToken` (camelCase) |
| Scopes | `'openid email profile'` (space-separated string) | `['openid', 'profile', 'email', 'User.Read']` (array) |
| Token size | ~1 KB | 2-3 KB (implications for URL exchange) |
| Revocation | `google.accounts.oauth2.revoke()` | `msalInstance.logoutPopup()` (clears cache + MS logout) |
| Token lifetime | ~1 hour fixed | 60-90 min variable |
| PKCE | Automatic | Automatic (v2+, requires SPA platform registration) |

### Microsoft Graph `/me` Endpoint (Server-Side Validation)
```
GET https://graph.microsoft.com/v1.0/me
Authorization: Bearer {accessToken}
```
Response:
```json
{
    "id": "user-oid",
    "displayName": "John Doe",
    "mail": "john@contoso.com",
    "userPrincipalName": "john@contoso.onmicrosoft.com"
}
```
**Email extraction**: Use `mail` if present, fall back to `userPrincipalName` for org accounts where `mail` is null.

**Important**: Microsoft does NOT recommend local JWT validation for Graph tokens. Always validate by calling the Graph API — a 200 response means valid token, 401 means invalid/expired.

---

## Implementation Plan — File by File

### 1. GAS Template: `live-site-pages/templates/gas-minimal-auth-template-code.js.txt`

#### 1a. New Config Variables (after line 22, in AUTH CONFIG section)
```javascript
// Microsoft OAuth — obtain from Azure AD app registration
// Leave as placeholders when using Google-only auth.
var MICROSOFT_CLIENT_ID = 'YOUR_MICROSOFT_CLIENT_ID';
var AZURE_TENANT_ID = 'YOUR_AZURE_TENANT_ID';
var AZURE_AUTHORITY_URL = 'https://login.microsoftonline.com/common';

// Auth provider selection: 'google', 'microsoft', or 'both'
var AUTH_PROVIDER = 'google';
```

#### 1b. New Preset Fields (in both `standard` and `hipaa` presets, lines 38-77)
Add to each preset object:
```javascript
MICROSOFT_TOKEN_LIFETIME: 4500,    // 75 min (midpoint of 60-90 min variable range)
MICROSOFT_REFRESH_BUFFER: 900,     // 15 min before estimated expiry
```

#### 1c. New Function: `validateMicrosoftToken()` (after `checkGoogleTokenExpiry()`, ~line 513)
```javascript
function validateMicrosoftToken(accessToken) {
  try {
    var resp = UrlFetchApp.fetch(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: { "Authorization": "Bearer " + accessToken },
        muteHttpExceptions: true
      }
    );
    if (resp.getResponseCode() !== 200) {
      return { status: "not_signed_in" };
    }
    var info = JSON.parse(resp.getContentText());
    // Microsoft Graph: 'mail' may be null for some accounts, fall back to userPrincipalName
    var email = info.mail || info.userPrincipalName;
    if (!email) {
      return { status: "not_signed_in" };
    }
    var displayName = info.displayName || email.split("@")[0];
    return { status: "authorized", email: email.toLowerCase(), displayName: displayName };
  } catch (e) {
    return { status: "not_signed_in" };
  }
}
```

#### 1d. New Function: `checkMicrosoftTokenExpiry()` (after `validateMicrosoftToken()`)
```javascript
function checkMicrosoftTokenExpiry(sessionData) {
  var tokenAge = (Date.now() - sessionData.tokenObtainedAt) / 1000;
  return tokenAge >= (AUTH_CONFIG.MICROSOFT_TOKEN_LIFETIME - AUTH_CONFIG.MICROSOFT_REFRESH_BUFFER);
}
```

#### 1e. Modify `exchangeTokenForSession()` (line 300) — Provider Router
Change line 305:
```javascript
// FROM:
var userInfo = validateGoogleToken(accessToken);

// TO:
var provider = AUTH_PROVIDER;
// If 'both', detect provider from token characteristics
// Microsoft Graph tokens are JWTs starting with 'eyJ', Google tokens are opaque
// Better approach: pass provider hint from the HTML side
var userInfo;
if (provider === 'microsoft' || (provider === 'both' && e && e.parameter && e.parameter.authProvider === 'microsoft')) {
    userInfo = validateMicrosoftToken(accessToken);
} else {
    userInfo = validateGoogleToken(accessToken);
}
```

**Better approach for provider detection**: Have the HTML side pass an `authProvider` parameter alongside the token. This avoids fragile token-sniffing. Modify the token exchange to include `&authProvider=google` or `&authProvider=microsoft` in the URL (for URL method) or in the postMessage data (for postMessage method).

#### 1f. Modify `validateSession()` (line 429) — Provider-Aware Token Expiry
Change line 429:
```javascript
// FROM:
var needsReauth = checkGoogleTokenExpiry(sessionData);

// TO:
var needsReauth = (sessionData.authProvider === 'microsoft')
    ? checkMicrosoftTokenExpiry(sessionData)
    : checkGoogleTokenExpiry(sessionData);
```

#### 1g. Modify `exchangeTokenForSession()` Session Data (line 348) — Store Provider
Add `authProvider` to sessionData:
```javascript
var sessionData = {
    email: userInfo.email,
    displayName: userInfo.displayName,
    accessToken: accessToken,
    authProvider: (provider === 'microsoft' || (provider === 'both' && authProviderHint === 'microsoft')) ? 'microsoft' : 'google',
    createdAt: Date.now(),
    absoluteCreatedAt: Date.now(),
    lastActivity: Date.now(),
    tokenObtainedAt: Date.now()
};
```

#### 1h. Modify `doGet()` URL Token Exchange (line 737) — Provider Parameter
```javascript
// FROM:
var exchangeToken = (e && e.parameter && e.parameter.exchangeToken) || "";

// TO:
var exchangeToken = (e && e.parameter && e.parameter.exchangeToken) || "";
var authProviderHint = (e && e.parameter && e.parameter.authProvider) || "google";
```

Pass `authProviderHint` through to `exchangeTokenForSession()`. The cleanest way is to make `exchangeTokenForSession()` accept a second parameter:
```javascript
function exchangeTokenForSession(accessToken, authProviderHint) {
    // ... existing code ...
    var userInfo;
    if (authProviderHint === 'microsoft') {
        userInfo = validateMicrosoftToken(accessToken);
    } else {
        userInfo = validateGoogleToken(accessToken);
    }
    // ... rest of function ...
}
```

#### 1i. Modify `doGet()` postMessage Exchange (line 765) — Provider in Message
The postMessage listener HTML (lines 766-793) needs to pass `authProvider` from the exchange-token message to `exchangeTokenForSession()`:
```javascript
// In the listener HTML string, change:
'    .exchangeTokenForSession(token);'
// To:
'    .exchangeTokenForSession(token, e.data.authProvider || "google");'
```

#### 1j. Modify `performSignOut()` message (line 1462) — Provider-Aware Message
The `performSignOut` function shows "Click 'Sign In with Google'" — this text should be provider-aware when Microsoft is enabled. Store the auth provider in the session data and use it for sign-out messages.

### 2. GAS Test Auth Template: `live-site-pages/templates/gas-test-auth-template-code.js.txt`

Same changes as #1 — this template mirrors the minimal auth template's auth infrastructure. All new config variables, functions, and modifications apply identically.

### 3. HTML Auth Template: `live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt`

#### 3a. MSAL.js Library Script Tag (after line 12)
```html
<!-- AUTH START -->
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script src="https://cdn.jsdelivr.net/npm/@azure/msal-browser@3/lib/msal-browser.min.js" async defer></script>
<!-- AUTH END -->
```

#### 3b. New Config Variables (after CLIENT_ID, ~line 295)
```javascript
// Google OAuth Client ID — obtain from Google Cloud Console
var CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';

// Microsoft OAuth — obtain from Azure AD app registration
var MICROSOFT_CLIENT_ID = 'YOUR_MICROSOFT_CLIENT_ID';
var AZURE_AUTHORITY_URL = 'https://login.microsoftonline.com/common';

// Auth provider: 'google', 'microsoft', or 'both'
var AUTH_PROVIDER = 'google';

var HTML_CONFIG = {
    STORAGE_TYPE: 'localStorage',
    TOKEN_EXCHANGE_METHOD: 'url',
    ENABLE_HEARTBEAT: true,
    HEARTBEAT_INTERVAL: 30000
};
```

#### 3c. Auth Wall UI Changes (lines 236-243)
```html
<div id="auth-wall">
    <img id="auth-wall-logo" src="" alt="" style="max-width:120px;max-height:120px;margin-bottom:20px;">
    <div id="auth-wall-title" style="font:bold 18px/1.2 sans-serif;color:#555;margin-bottom:24px;text-align:center;"></div>
    <p id="auth-wall-message">Please sign in to continue.</p>
    <!-- Google button — shown when AUTH_PROVIDER is 'google' or 'both' -->
    <button class="auth-btn" id="auth-sign-in-btn" style="display:none;">Sign In with Google</button>
    <!-- Microsoft button — shown when AUTH_PROVIDER is 'microsoft' or 'both' -->
    <button class="auth-btn auth-btn-microsoft" id="auth-sign-in-microsoft-btn" style="display:none;">Sign In with Microsoft</button>
    <div class="auth-error" id="auth-error"></div>
    <div class="auth-email" id="auth-email"></div>
</div>
```

Add CSS for the Microsoft button:
```css
#auth-wall .auth-btn-microsoft {
    background: #2f2f2f; color: white;
    margin-top: 8px;
}
#auth-wall .auth-btn-microsoft:hover { background: #1a1a1a; }
```

#### 3d. Provider-Conditional Button Visibility (in the init section, after line 319)
```javascript
// Show/hide sign-in buttons based on AUTH_PROVIDER
if (AUTH_PROVIDER === 'google' || AUTH_PROVIDER === 'both') {
    document.getElementById('auth-sign-in-btn').style.display = '';
}
if (AUTH_PROVIDER === 'microsoft' || AUTH_PROVIDER === 'both') {
    document.getElementById('auth-sign-in-microsoft-btn').style.display = '';
}
// Update wall message based on provider
if (AUTH_PROVIDER === 'google') {
    document.getElementById('auth-wall-message').textContent = 'Please sign in with your Google account to continue.';
} else if (AUTH_PROVIDER === 'microsoft') {
    document.getElementById('auth-wall-message').textContent = 'Please sign in with your Microsoft account to continue.';
} else {
    document.getElementById('auth-wall-message').textContent = 'Please sign in to continue.';
}
```

#### 3e. MSAL Instance Initialization (new section after GIS init, ~line 927)
```javascript
// =============================================
// AUTH — Microsoft Sign-In (MSAL.js)
// =============================================

var msalInstance = null;

function initMicrosoftAuth() {
    if (AUTH_PROVIDER !== 'microsoft' && AUTH_PROVIDER !== 'both') return;
    if (typeof msal === 'undefined') {
        console.warn('[AUTH] MSAL.js not loaded — Microsoft auth unavailable');
        return;
    }

    var msalConfig = {
        auth: {
            clientId: MICROSOFT_CLIENT_ID,
            authority: AZURE_AUTHORITY_URL,
            redirectUri: window.location.origin + window.location.pathname
        },
        cache: {
            cacheLocation: HTML_CONFIG.STORAGE_TYPE,
            storeAuthStateInCookie: false
        }
    };

    msalInstance = new msal.PublicClientApplication(msalConfig);
    msalInstance.initialize().then(function() {
        // Check for existing accounts (silent SSO)
        var accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            msalInstance.setActiveAccount(accounts[0]);
        }
    }).catch(function(err) {
        console.error('[AUTH] MSAL init error:', err);
    });
}
```

#### 3f. Microsoft Sign-In Function (after `initMicrosoftAuth()`)
```javascript
function microsoftSignIn(selectAccount) {
    if (!msalInstance) {
        showAuthWall('Microsoft authentication is not available.');
        return;
    }

    var loginRequest = {
        scopes: ['openid', 'profile', 'email', 'https://graph.microsoft.com/User.Read']
    };
    if (selectAccount) {
        loginRequest.prompt = 'select_account';
    }

    msalInstance.loginPopup(loginRequest).then(function(loginResponse) {
        msalInstance.setActiveAccount(loginResponse.account);
        return msalInstance.acquireTokenPopup({
            scopes: ['https://graph.microsoft.com/User.Read']
        });
    }).then(function(tokenResponse) {
        exchangeToken(tokenResponse.accessToken, 'microsoft');
    }).catch(function(error) {
        if (error.errorCode === 'interaction_in_progress') {
            console.warn('[AUTH] Microsoft login already in progress');
        } else {
            showAuthWall('Microsoft sign-in failed. Please try again.');
        }
    });
}
```

#### 3g. Microsoft Re-Auth Function
```javascript
function attemptMicrosoftReauth() {
    if (!msalInstance) return;
    var account = msalInstance.getActiveAccount();
    if (!account) {
        showReauthBanner('Session expired. Click "Sign In" to continue.', true);
        return;
    }

    msalInstance.acquireTokenSilent({
        scopes: ['https://graph.microsoft.com/User.Read'],
        account: account
    }).then(function(tokenResponse) {
        exchangeToken(tokenResponse.accessToken, 'microsoft');
    }).catch(function(error) {
        if (error instanceof msal.InteractionRequiredAuthError) {
            showReauthBanner('Session expired. Click "Sign In" to continue.', true);
        }
    });
}
```

#### 3h. Modify `exchangeToken()` — Pass Provider (line 955)
```javascript
// FROM:
function exchangeToken(googleAccessToken) {
    if (HTML_CONFIG.TOKEN_EXCHANGE_METHOD === 'postMessage') {
        exchangeViaPostMessage(googleAccessToken);
    } else {
        exchangeViaUrl(googleAccessToken);
    }
}

// TO:
function exchangeToken(accessToken, authProvider) {
    authProvider = authProvider || 'google';
    if (HTML_CONFIG.TOKEN_EXCHANGE_METHOD === 'postMessage') {
        exchangeViaPostMessage(accessToken, authProvider);
    } else {
        exchangeViaUrl(accessToken, authProvider);
    }
}
```

#### 3i. Modify `exchangeViaUrl()` — Include Provider Parameter (line 964)
```javascript
// FROM:
function exchangeViaUrl(googleAccessToken) {
    // ...
    gasApp.src = baseUrl + '?exchangeToken=' + encodeURIComponent(googleAccessToken);
}

// TO:
function exchangeViaUrl(accessToken, authProvider) {
    // ...
    gasApp.src = baseUrl + '?exchangeToken=' + encodeURIComponent(accessToken)
        + '&authProvider=' + encodeURIComponent(authProvider || 'google');
}
```

**Note on Microsoft token size**: Microsoft access tokens are 2-3 KB (JWTs). URL parameter exchange may approach browser URL length limits (~8000 chars) but should be within range for most cases. The `postMessage` method is safer for Microsoft tokens. Consider adding a guard:
```javascript
if (authProvider === 'microsoft' && HTML_CONFIG.TOKEN_EXCHANGE_METHOD === 'url') {
    console.warn('[AUTH] URL token exchange with Microsoft tokens may hit URL length limits. Consider using postMessage.');
}
```

#### 3j. Modify `exchangeViaPostMessage()` — Include Provider (line 977)
```javascript
// FROM:
function exchangeViaPostMessage(googleAccessToken) {
    _pendingToken = googleAccessToken;
    // ...
}

// TO:
var _pendingAuthProvider = null;
function exchangeViaPostMessage(accessToken, authProvider) {
    _pendingToken = accessToken;
    _pendingAuthProvider = authProvider || 'google';
    // ... rest stays the same
}
```

And in the postMessage listener (line 998-1006), include the provider:
```javascript
// FROM:
gasApp.contentWindow.postMessage({
    type: 'exchange-token',
    accessToken: _pendingToken
}, '*');

// TO:
gasApp.contentWindow.postMessage({
    type: 'exchange-token',
    accessToken: _pendingToken,
    authProvider: _pendingAuthProvider || 'google'
}, '*');
_pendingAuthProvider = null;
```

#### 3k. Microsoft Sign-In Button Handler (after existing sign-in button handler, line 1511)
```javascript
// Microsoft sign-in button handler
document.getElementById('auth-sign-in-microsoft-btn').addEventListener('click', function() {
    microsoftSignIn(true);  // always show account chooser on explicit click
});
```

#### 3l. Modify `performSignOut()` — Provider-Aware (line 1438)
```javascript
// After existing Google token revocation (lines 1453-1458), add:
// Revoke Microsoft session if applicable
try {
    if (msalInstance) {
        var msAccount = msalInstance.getActiveAccount();
        if (msAccount) {
            msalInstance.logoutPopup({
                account: msAccount,
                postLogoutRedirectUri: window.location.origin + window.location.pathname
            }).catch(function() {});
        }
    }
} catch(e) {}
```

Also update the sign-out messages to be provider-agnostic:
```javascript
// Change "Click 'Sign In with Google' to continue." to just "Please sign in to continue."
// when AUTH_PROVIDER is 'microsoft' or 'both'
```

#### 3m. Modify `attemptReauth()` — Provider-Aware (line 1476)
```javascript
// FROM:
function attemptReauth() {
    signInClient = google.accounts.oauth2.initTokenClient({...});
    signInClient.requestAccessToken();
}

// TO:
function attemptReauth() {
    // Determine which provider's token was used for the current session
    var session = loadSession();
    var provider = (session && session.authProvider) || 'google';

    if (provider === 'microsoft') {
        attemptMicrosoftReauth();
    } else {
        // Existing Google re-auth code
        signInClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'openid email profile',
            prompt: '',
            callback: function(response) {
                if (response.error) {
                    showReauthBanner('Session expired. Click "Sign In" to continue.', true);
                } else {
                    exchangeToken(response.access_token, 'google');
                }
            }
        });
        signInClient.requestAccessToken();
    }
}
```

#### 3n. Store Auth Provider in Session (modify `saveSession()`)
When saving session to localStorage/sessionStorage, include the auth provider so re-auth knows which provider to use:
```javascript
// In the gas-session-created handler (line 1012), save provider info:
// Need to track which provider was used alongside the session token
```

This requires adding `authProvider` to the `gas-session-created` postMessage response from GAS, which already returns `sessionToken`, `email`, `displayName`, `absoluteTimeout`. Add `authProvider` to this response.

#### 3o. Initialize MSAL on Page Load (in the init section, ~line 1499)
```javascript
// Initialize Microsoft auth if configured
initMicrosoftAuth();
```

This should be called early, before the page load IIFE, so MSAL is ready when the user clicks the Microsoft sign-in button.

### 4. Existing Auth Pages (Template Propagation)

Per Pre-Commit #19, changes to the auth template propagate to all existing auth pages:
- `live-site-pages/testauthgas1.html` — auth page, gets all changes

Non-auth pages (`index.html`, `gas-project-creator.html`) are unaffected — they use the noauth template.

### 5. GAS Test Auth Template: `live-site-pages/templates/gas-test-auth-template-code.js.txt`

Same GAS-side changes as section 1 (config variables, new functions, modified `exchangeTokenForSession()`, etc.).

### 6. Config Files

Each GAS project's `.config.json` gains new optional fields:
```json
{
    "MICROSOFT_CLIENT_ID": "YOUR_MICROSOFT_CLIENT_ID",
    "AZURE_TENANT_ID": "YOUR_AZURE_TENANT_ID",
    "AZURE_AUTHORITY_URL": "https://login.microsoftonline.com/common",
    "AUTH_PROVIDER": "google"
}
```

### 7. Documentation Updates

#### 7a. `repository-information/06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md`
Add new section covering:
- The `AUTH_PROVIDER` toggle and its three values
- Microsoft-specific configuration variables
- Provider detection flow in token exchange
- Differences in token validation endpoints
- UI changes (dual sign-in buttons)

#### 7b. `repository-information/REPO-ARCHITECTURE.md`
Update diagrams if they depict the auth flow — add Microsoft as an alternative path.

### 8. Session Data Structure Changes

Current session data stored in `loadSession()`/`saveSession()`:
```javascript
{ token: "...", email: "user@example.com" }
```

Needs to become:
```javascript
{ token: "...", email: "user@example.com", authProvider: "google" | "microsoft" }
```

The `authProvider` field is needed so:
- Re-auth (`attemptReauth()`) knows which provider to use
- Sign-out knows which token to revoke (Google `revoke()` vs MSAL `logoutPopup()`)
- The sign-out message shows the correct provider name

The GAS `gas-session-created` response already returns `sessionToken`, `email`, `displayName` — add `authProvider` to this response. The HTML side saves it to storage alongside the token.

---

## Security Considerations

1. **Token size in URLs**: Microsoft tokens are 2-3 KB JWTs vs Google's ~1 KB opaque tokens. URL parameter exchange works but is closer to limits. The `postMessage` method is inherently safer for Microsoft tokens. Consider logging a warning when `TOKEN_EXCHANGE_METHOD: 'url'` is used with Microsoft auth.

2. **No local JWT validation**: Microsoft Graph tokens should NOT be validated locally (proprietary claims). Always validate server-side by calling the Graph API. This is what `validateMicrosoftToken()` does.

3. **PKCE**: MSAL.js v2+ uses Authorization Code Flow with PKCE automatically. No manual configuration needed, but the Azure AD app MUST be registered as "Single-page application" (not "Web"), otherwise you get `AADSTS9002325: Proof Key for Code Exchange is required`.

4. **Tenant restriction**: The `AZURE_AUTHORITY_URL` controls which accounts can sign in. For enterprise apps, use single-tenant (`/tenant-id`). The `ENABLE_DOMAIN_RESTRICTION` toggle in the preset system provides an additional layer — it checks the email domain regardless of provider.

5. **Cross-provider session hijacking**: The `authProvider` field stored in session data prevents using a Google token to refresh a Microsoft session or vice versa. The `validateSession()` check ensures the right provider's expiry logic is applied.

---

## What Does NOT Change (Provider-Agnostic Code)

These systems work identically for both providers — no modifications needed:

| System | Why it's agnostic |
|--------|-------------------|
| Session management (CacheService) | Stores email + session token — doesn't know/care about provider |
| HMAC integrity | Signs session data fields (email, timestamps) — provider-irrelevant |
| Audit logging | Logs events by email — provider-irrelevant |
| ACL spreadsheet checks | Checks email against ACL — provider-irrelevant |
| Emergency access | Checks email against whitelist — provider-irrelevant |
| Domain restriction | Checks email domain — provider-irrelevant |
| Heartbeat mechanism | Extends session TTL — provider-irrelevant |
| Absolute session timeout | Hard ceiling on session duration — provider-irrelevant |
| Session tracking (single-session enforcement) | Tracks by email — provider-irrelevant |
| Countdown timers UI | Displays remaining time — provider-irrelevant |
| Auth wall structure | Shows/hides wall — provider-irrelevant (buttons are conditional) |
| Re-auth banner | Displays banner — provider-irrelevant (handler routes to correct provider) |

---

## Effort Estimate

| Phase | Estimated Work |
|-------|---------------|
| GAS template (minimal auth) — new config, functions, modifications | ~30 min |
| GAS template (test auth) — mirror minimal auth changes | ~15 min |
| HTML auth template — MSAL init, sign-in functions, UI, provider routing | ~45 min |
| Template propagation to testauthgas1.html | ~10 min (automatic via Pre-Commit #19) |
| Config file updates, documentation | ~15 min |
| Version bumps, changelogs, commit/push cycle | ~15 min |
| **Total** | **~2 hours (~1 session)** |

---

## Verification Plan

1. **Syntax check**: After all edits, verify no JavaScript syntax errors by reviewing the modified sections
2. **Config consistency**: Verify `AUTH_PROVIDER` defaults to `'google'` in all templates — existing behavior is unchanged unless the user explicitly sets it to `'microsoft'` or `'both'`
3. **Backward compatibility**: With `AUTH_PROVIDER = 'google'` (default), the system should behave identically to the current implementation — no Microsoft code paths are executed, no Microsoft button is shown, no MSAL library is loaded (use a guard to skip loading if AUTH_PROVIDER is 'google')
4. **Template propagation**: Verify testauthgas1.html receives all template changes via Pre-Commit #19
5. **Provider isolation**: Verify that Google sign-in button calls Google GIS, Microsoft button calls MSAL, and each path passes the correct `authProvider` parameter through the token exchange chain

---

## Open Questions for the User

1. **MSAL.js loading strategy**: Use jsdelivr CDN (simpler, matches GIS pattern) or self-host the library file (more control)? Recommend: jsdelivr CDN.
2. **Default AUTH_PROVIDER value**: Should default be `'google'` (backward compatible, Microsoft opt-in) or `'both'` (show both buttons immediately)? Recommend: `'google'` default.
3. **Button layout**: When `AUTH_PROVIDER = 'both'`, should buttons stack vertically (Google on top, Microsoft below) or use a different layout? Recommend: vertical stack with a subtle "or" separator.
4. **Microsoft token in URL**: Should we warn or block URL-parameter token exchange for Microsoft (tokens are 2-3 KB)? Recommend: warn in console, allow (most URLs handle up to 8KB).

Developed by: LightAISolutions
