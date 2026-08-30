# SSO Token-Refresh & Cross-Tab Activity Coordination — Implementation Plan

**Created:** 2026-06-15
**Status:** Ready for implementation (not yet built)
**Scope:** Plan 12 **Phase 6** (token-refresh coordination) **+** a new companion feature (cross-tab activity coordination). Both ride the existing `sais-sso-auth` BroadcastChannel.
**Affects:** auth template `live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt` → propagated to `globalacl.html`, `testauthgas1.html` (per [PC-TEMPLATE-PROP] #19). **No `.gs` changes required.**
**Prerequisites:** Plan 12 Phases 1–5 (live: portal HIPAA mode, BroadcastChannel SSO across all three auth pages). Confirm live sign-in works on all three before building (the stack has been dormant ~2 months).
**References:**
- [12-HIPAA-SSO-IMPLEMENTATION-PLAN.md](12-HIPAA-SSO-IMPLEMENTATION-PLAN.md) — SSO foundation + §8 Future Phases (Phase 6 sketch)
- [pending-close-design-doc.md](pending-close-design-doc.md) — related deferred session-lifecycle work
- HIPAA Security Rule — 45 CFR §164.312(a)(2)(iii) Automatic Logoff

---

## Table of Contents

1. [Goal & Problem](#1-goal--problem)
2. [Current State (grounded in live code)](#2-current-state-grounded-in-live-code)
3. [Architecture — Two Mechanisms on One Channel](#3-architecture--two-mechanisms-on-one-channel)
4. [Part A — Cross-Tab Activity Coordination](#4-part-a--cross-tab-activity-coordination)
5. [Part B — Token-Refresh Coordination (Phase 6)](#5-part-b--token-refresh-coordination-phase-6)
6. [Message Protocol Summary](#6-message-protocol-summary)
7. [Implementation Steps](#7-implementation-steps)
8. [Testing Checklist](#8-testing-checklist)
9. [Revert Procedure](#9-revert-procedure)
10. [Open Decisions](#10-open-decisions)

---

## 1. Goal & Problem

### The user-facing problem

A user signs in once (SSO already handles this across portal / globalacl / testauthgas1). They then leave one tab open but idle — say the portal — and actively work in the other auth tabs. Two bad outcomes must be avoided:

1. **Cascade logout** — the idle tab times out and signs *everyone* out, killing the tabs the user is actively using. *(Already prevented today — see §2.)*
2. **Self-logout of the idle tab** — because each tab's session keepalive is driven by *that tab's own* local activity, the idle tab eventually times itself out even though the user is clearly still working (just in another tab). When they return to it, it's signed out. *(This is what Part A fixes.)*

Separately, around the ~1-hour mark every open tab independently asks Google for a fresh access token — redundant network round-trips and tabs drifting out of sync. *(This is what Part B / Phase 6 fixes.)*

### Goals

- **Part A:** while the user is active in *any* auth tab, *all* auth tabs stay alive. Only when the user walks away from the whole set does everything time out. This is the correct HIPAA reading of "inactivity" — §164.312(a)(2)(iii) targets the *user* being idle, and one user spans all their tabs.
- **Part B:** exactly one tab refreshes the Google token per cycle and shares the result, instead of every tab refreshing independently.

Both are **additive** to the existing SSO layer, both ride the existing `sais-sso-auth` channel, and neither requires any `.gs` change.


## 2. Current State (grounded in live code)

All symbols below are from `live-site-pages/testauthgas1.html` (the reference page; portal/globalacl share the template logic).

### Session keepalive = activity-driven heartbeat (per-page)

- Activity is tracked by listeners on `_ACTIVITY_EVENTS = ['mousemove','mousedown','keydown','touchstart','scroll']`, which update `_lastHeartbeatActivity = Date.now()` via `_onHeartbeatActivity()`.
- `startHeartbeat()` runs a `setInterval` every `HTML_CONFIG.HEARTBEAT_INTERVAL` (60s test / 300s prod). On each tick it compares `_lastHeartbeatActivity < (tickTime - HEARTBEAT_INTERVAL)`:
  - **active since last tick** → `sendHeartbeat()` → hidden iframe hits `?action=heartbeat` → GAS resets `createdAt` → server session extended.
  - **idle since last tick** → sets `_heartbeatIdle = true` and **skips** the heartbeat → the server session expires naturally at its server-side duration.
- Each of the three pages has its **own** GAS backend and its **own** server session. Keepalive is therefore fully per-page today.

### Sign-out is page-local for timeouts (the cascade guard already exists)

`performSignOut(reason, opts)` only broadcasts `sso-sign-out` for *user-initiated* sign-out — it explicitly excludes timeouts:

```js
if (broadcastSSO && _ssoChannel && reason !== 'session-expired' && reason !== 'absolute-expired') {
  _ssoChannel.postMessage({ type: 'sso-sign-out', source: _pageName, tabId: _tabId });
}
```

So an idle tab timing out signs out **only itself**. **Outcome #1 (cascade logout) is already handled** — do not change this guard.

### SSO channel + token already in place

- `_ssoChannel = new BroadcastChannel('sais-sso-auth')`, persistent after auth.
- `_ssoAccessToken` / `_ssoUserEmail` hold the Google token + identity in memory.
- Existing message types: `sso-token-request`, `sso-token-response`, `sso-sign-out` (see Plan 12 §5.1).
- `_tabId` uniquely identifies each tab (already used for sign-out de-dup and tab roll-call).

### Single-tab-per-page enforcement

Each page enforces one active tab *of that page* (the `tab-takeover-wall` + `tab-roll-call` on the per-page `_pageName + '-auth-sign-out'` channel). So "cross-tab" in this plan means **cross-page** (portal vs globalacl vs testauthgas1) — exactly the user's scenario — coordinated on the shared `sais-sso-auth` channel.

### What's missing

- No expiry timestamp is recorded when a token is obtained (`expires_in` is discarded) — Part B needs it.
- No activity signal crosses the page boundary — Part A needs it.


## 3. Architecture — Two Mechanisms on One Channel

Both features are listeners/broadcasters added to the existing `_ssoChannel` (`sais-sso-auth`). They are independent and can ship separately (Part A first is recommended — lower risk).

```
                         BroadcastChannel('sais-sso-auth')   [same-origin, in-memory only]
   Portal ───────────────────────┬───────────────────────── Testauthgas1 ─────── Globalacl
                                  │
   Part A (keepalive):   sso-activity ........ "user did something somewhere"
                         → every tab updates _lastHeartbeatActivity → keeps heartbeating

   Part B (token):       sso-token-expiring ... "my token is about to lapse"
                         sso-token-refreshed .. "here is a fresh token + new expiry"
                         (existing: sso-token-request / -response / -sign-out)
```

**Design invariants (do not violate):**
- **Memory-only, same-origin.** Nothing persisted; HIPAA posture unchanged. (BroadcastChannel is exempt from the dead-code resource-abuse check per `.claude/rules/dead-code-detection.md` — it is same-origin and XSS-prerequisite.)
- **Timeout sign-outs stay page-local** — never broadcast `sso-sign-out` on `session-expired`/`absolute-expired` (§2 guard).
- **Best-effort, not load-bearing.** If a message is missed, behavior degrades to today's per-page behavior — never to a broken state. No correctness depends on delivery.
- **Template-first.** Build in the auth template, then propagate to the three pages ([PC-TEMPLATE-PROP] #19). Gate both features behind `HTML_CONFIG` toggles so non-auth pages and the `standard` preset are unaffected.


## 4. Part A — Cross-Tab Activity Coordination

**Idea:** any tab that sees local activity broadcasts a throttled `sso-activity` ping; every receiving tab treats it as local activity, so its heartbeat keeps extending its own server session. The user is "active" as long as they touch *any* auth tab.

### 4.1 New message type

| Type | Direction | Payload | Meaning |
|------|-----------|---------|---------|
| `sso-activity` | any → all | `{ type, tabId, pageName, ts }` | "the user did something in my tab just now" |

### 4.2 Broadcaster (throttled)

Hook into the **existing** activity path so no new DOM listeners are needed — extend `_onHeartbeatActivity()`:

```js
var _ssoActivityThrottle = 0;
var SSO_ACTIVITY_THROTTLE_MS = 30000;  // broadcast at most once per 30s

function _onHeartbeatActivity() {
  _lastHeartbeatActivity = Date.now();
  _heartbeatIdle = false;
  // Part A: tell the other auth pages the user is active (throttled)
  if (HTML_CONFIG.ENABLE_CROSS_TAB_ACTIVITY && _ssoChannel) {
    var now = Date.now();
    if (now - _ssoActivityThrottle >= SSO_ACTIVITY_THROTTLE_MS) {
      _ssoActivityThrottle = now;
      try { _ssoChannel.postMessage({ type: 'sso-activity', tabId: _tabId, pageName: _pageName, ts: now }); } catch(e) {}
    }
  }
}
```

The throttle matters: activity events fire continuously while a user moves the mouse. 30s ≪ `HEARTBEAT_INTERVAL` (5min prod) so a single ping comfortably covers the receiving tab's next tick, while keeping channel traffic negligible.

### 4.3 Receiver

In each page's `_ssoChannel.onmessage` handler, add a branch that feeds remote activity into the *same* variable the heartbeat tick reads:

```js
if (e.data && e.data.type === 'sso-activity' && e.data.tabId !== _tabId) {
  // A sibling auth tab saw activity → count it as activity here too,
  // so this tab keeps heartbeating even if locally idle.
  _lastHeartbeatActivity = Date.now();
  _heartbeatIdle = false;
}
```

That's the entire mechanism: because the heartbeat tick decides idle/active purely from `_lastHeartbeatActivity`, refreshing it on a remote ping is sufficient — no other heartbeat code changes.

### 4.4 New `HTML_CONFIG` toggle

Follow the existing preset pattern (`false` in `standard`, `true` in `hipaa`):

```js
// standard preset:
ENABLE_CROSS_TAB_ACTIVITY: false,
// hipaa preset:
ENABLE_CROSS_TAB_ACTIVITY: true,
```

Guard both the broadcaster and receiver with it so the feature is inert on non-auth/standard pages.

### 4.5 HIPAA considerations + the PHI-screen decision

Keeping the *session* alive while the user is active anywhere is HIPAA-correct. But there is a separate exposure question: should activity in a **non-PHI** tab (portal) keep a **PHI** tab's *screen* unlocked? Two layers, decided independently (see §10 Open Decisions):

- **Session liveness** (this plan): cross-tab activity keeps the *server session/token* valid. ✅ recommended.
- **Screen exposure** (companion, optional): each PHI page may still **lock/obscure its own screen** (DOM clear or PHI blur, re-reveal on local focus) after *its own* local inactivity, even while the session stays valid. This decouples "user is somewhere in the app set" from "this screen is unattended," so PHI isn't left visible on an idle monitor. If adopted, build it as a per-page overlay gated by its own short local-idle timer — it does **not** sign the user out, it just hides content until they refocus that tab.


## 5. Part B — Token-Refresh Coordination (Phase 6)

**Idea:** when a Google access token nears expiry, one tab refreshes and broadcasts the new token; the others adopt it instead of each calling Google. Two new message types plus expiry tracking and a simple election.

### 5.1 New message types

| Type | Direction | Payload | Meaning |
|------|-----------|---------|---------|
| `sso-token-expiring` | expiring tab → all | `{ type, tabId, expiresAt }` | "my token is about to lapse — anyone have a fresher one?" |
| `sso-token-refreshed` | refresher → all | `{ type, accessToken, expiresAt, email, sourceTabId }` | "fresh token + its new expiry" |

(The existing `sso-token-request` / `sso-token-response` from Plan 12 §5.1 remain for the initial cold-start handoff.)

### 5.2 Track expiry (the missing state)

When a token is obtained, Google's response includes `expires_in` (seconds). Record it where `_ssoAccessToken` is set (in the GIS token callback, e.g. `handleTokenResponse`):

```js
var _ssoTokenExpiry = 0;  // epoch ms when _ssoAccessToken expires
// in the token callback:
_ssoAccessToken = response.access_token;
_ssoTokenExpiry = Date.now() + (Number(response.expires_in || 3600) * 1000);
```

### 5.3 Detect the refresh window

A lightweight timer (or a check folded into the existing heartbeat tick) fires when within a refresh window — e.g. 5 minutes before `_ssoTokenExpiry`:

```js
var TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;
function _tokenNeedsRefresh() {
  return HTML_CONFIG.ENABLE_SSO_TOKEN_REFRESH
      && _ssoAccessToken && _ssoTokenExpiry
      && (_ssoTokenExpiry - Date.now() <= TOKEN_REFRESH_WINDOW_MS);
}
```

### 5.4 Ask-then-elect flow

1. **Ask first.** The tab broadcasts `sso-token-expiring`. If another tab holds a token with a **later** `expiresAt`, it replies `sso-token-refreshed` with its current token → the asker adopts it. **Zero Google round-trips.**
2. **Elect if nobody is fresher.** If no fresher token arrives within a short window (e.g. 1.5s), exactly one tab refreshes. Election rule (see §10):
   - **Portal-canonical (recommended):** if the portal tab is open and responsive, it refreshes. Consumer pages wait for its `sso-token-refreshed` and only self-refresh if the portal doesn't answer.
   - **Peer fallback:** if the portal isn't present (it may have self-logged-out while idle — exactly why this fallback exists), the lowest `_tabId` among responders elects itself.
3. **Refresh + broadcast.** The elected tab calls GIS silently: `tokenClient.requestAccessToken({ prompt: '' })`. On success it updates `_ssoAccessToken` + `_ssoTokenExpiry` and broadcasts `sso-token-refreshed`. All tabs update their in-memory token + expiry.
4. **Silent-refresh failure** (Google needs re-consent): the elected tab falls back to an interactive prompt; if that also fails it broadcasts the existing `sso-token-unavailable` so consumers drop to their own sign-in.

### 5.5 Re-sync each server session — critical nuance

There are **two** lifetimes, and Part B coordinates only the first:

- **Google access token** (~1 hr) — coordinated here.
- **GAS server session** (CacheService, per page) — each page must re-exchange the fresh token with *its own* GAS to extend its server session. The existing heartbeat (`?action=heartbeat`) already extends the server session on activity; a token refresh should re-prime the token that the heartbeat/exchange uses. Do **not** centralize this — each page talks to its own backend (matches Plan 12's "GAS scripts don't change" invariant).

### 5.6 Race & edge handling

- **Double election** (two tabs elect simultaneously): de-dup by `_tabId`, or accept it — Google issues a token either way; coordination is an optimization, not correctness.
- **Clock skew** between tabs: compare relative remaining-time, not absolute timestamps from other tabs (treat a peer's `expiresAt` as advisory; trust your own `expires_in` for your own token).
- **All tabs but one closed:** no peers answer → the lone tab just refreshes itself (today's behavior).

### 5.7 New `HTML_CONFIG` toggle

```js
// standard preset:  ENABLE_SSO_TOKEN_REFRESH: false,
// hipaa preset:     ENABLE_SSO_TOKEN_REFRESH: true,
```


## 6. Message Protocol Summary

All on `BroadcastChannel('sais-sso-auth')`. **Bold** = new in this plan.

| Type | Added by | Direction | Payload | Purpose |
|------|----------|-----------|---------|---------|
| `sso-token-request` | Plan 12 | consumer → all | `{ tabId, pageName }` | cold-start: "I need a token" |
| `sso-token-response` | Plan 12 | holder → all | `{ accessToken, email, sourceTabId, sourcePage }` | "here's the token" |
| `sso-sign-out` | Plan 12 | user action → all | `{ source, tabId }` | user signed out everywhere (never on timeout) |
| `sso-token-unavailable` | Plan 12 | holder → all | `{ reason }` | "no token available" (fallback to own sign-in) |
| **`sso-activity`** | **Part A** | any → all | `{ tabId, pageName, ts }` | "user active here" → keep all tabs' heartbeats alive |
| **`sso-token-expiring`** | **Part B** | expiring → all | `{ tabId, expiresAt }` | "anyone have a fresher token?" |
| **`sso-token-refreshed`** | **Part B** | refresher → all | `{ accessToken, expiresAt, email, sourceTabId }` | "fresh token + new expiry" |


## 7. Implementation Steps

Recommended order: **Part A first** (lower risk, immediately fixes the idle-tab problem), then Part B.

### Part A
1. In `HtmlAndGasTemplateAutoUpdate-auth.html.txt`, add `ENABLE_CROSS_TAB_ACTIVITY` to both presets (§4.4).
2. Extend `_onHeartbeatActivity()` with the throttled broadcaster (§4.2).
3. Add the `sso-activity` receiver branch to the `_ssoChannel.onmessage` handler (§4.3).
4. Propagate the diff to `globalacl.html`, `testauthgas1.html` ([PC-TEMPLATE-PROP] #19). Check each for `PROJECT OVERRIDE` markers in the SSO/heartbeat regions before applying; if found, stop and reconcile per the rule.
5. Bump each page's `html.version.txt` + `<meta build-version>` ([PC-HTML-VERSION] #2); add page-changelog entries ([PC-PAGE-CHANGELOG] #16).

### Part B
6. Add `ENABLE_SSO_TOKEN_REFRESH` to both presets (§5.7).
7. Record `_ssoTokenExpiry` in the GIS token callback (§5.2).
8. Add `_tokenNeedsRefresh()` + the refresh-window check (fold into the heartbeat tick or a dedicated timer) (§5.3).
9. Add `sso-token-expiring` / `sso-token-refreshed` handlers + the ask-then-elect flow (§5.4) and per-page server re-sync (§5.5).
10. Propagate to the three pages, version-bump, changelog (as in steps 4–5).

### Repo bookkeeping (push commit)
11. Repo version bump ([PC-REPO-VERSION] #15), README timestamp ([PC-README-TIMESTAMP] #10), CHANGELOG version section ([PC-CHANGELOG] #6).
12. Update the per-environment diagrams (`globalacl-diagram.md`, `testauthgas1-diagram.md`) if they depict the SSO/heartbeat flow ([PC-REPO-ARCH] #5).


## 8. Testing Checklist

Must be run **live** (real OAuth + GAS + multiple real tabs) — none of this is exercisable in the local/Playwright harness. Use the short test interval (`HEARTBEAT_INTERVAL: 60000`) to compress waits.

### Part A
- [ ] Open portal + testauthgas1; leave portal idle; keep moving in testauthgas1. After > one heartbeat interval, **portal is still signed in** (received `sso-activity`, kept heartbeating).
- [ ] Open all three; idle in all of them; after the timeout window **all** expire (no false keepalive).
- [ ] Confirm `sso-activity` is throttled (DevTools → Application → no flood; ≤ 1 per 30s per active tab).
- [ ] Timeout in one tab still shows that tab's auth wall **without** signing out the others (regression check on the §2 guard).
- [ ] `standard`-preset / non-auth page: no `sso-activity` traffic (toggle off).

### Part B
- [ ] Two tabs open; force a near-expiry token; confirm **one** Google refresh occurs (Network tab), not two, and both tabs end with the same new `expiresAt`.
- [ ] Close the portal, then trigger refresh on a consumer page → peer election kicks in, refresh still happens.
- [ ] Simulate silent-refresh failure → interactive prompt fallback → on cancel, `sso-token-unavailable` → consumer falls back to its own sign-in.
- [ ] After refresh, each page's server session is still valid (heartbeat `gas-heartbeat-ok`, no `gas-heartbeat-expired`).


## 9. Revert Procedure

Both features are toggle-gated and best-effort, so reverting is low-risk:

1. **Fast disable (no deploy):** flip `ENABLE_CROSS_TAB_ACTIVITY` and/or `ENABLE_SSO_TOKEN_REFRESH` to `false` in the affected pages' `HTML_CONFIG` and push — behavior returns to today's per-page model. No data migration, no session impact.
2. **Full revert:** `git revert` the implementation commit(s). Because no `.gs` changed and nothing was persisted, there is no server-side or storage cleanup. Live tabs fall back to independent keepalive/refresh on next load.
3. Take a `.bak` of the auth template before the Part B edit (per Backups Before Major Changes) since it's the propagation source.

## 10. Open Decisions

1. **Election rule (Part B):** portal-canonical + peer fallback *(recommended)* vs. pure peer election. Portal-canonical is simpler for the common case; the peer fallback covers the idle-portal-self-logout case. Decide whether the added fallback complexity is worth it now or deferred.
2. **PHI screen lock (Part A §4.5):** keepalive-only *(recommended first step)* vs. keepalive + per-app PHI screen-lock overlay. The screen lock is a separate, additive feature — decide whether it ships with Part A or as a follow-up. Purely a HIPAA-exposure policy call for the developer.
3. **Refresh-window length & throttle interval:** 5-min window / 30s activity throttle are starting values — tune against the production `HEARTBEAT_INTERVAL` (300s) and observed token lifetimes.
4. **Pre-build gate:** confirm live sign-in works on all three auth pages first (the stack has been dormant ~2 months, and `globalacl.gs` carries a comment about a past sign-out fix that "never deployed").


Developed by: LightAISolutions
