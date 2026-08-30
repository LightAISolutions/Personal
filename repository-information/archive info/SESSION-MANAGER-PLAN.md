# Session Manager — Cross-Project Session Management Plan

**Status:** Reverted (v05.39r) — broke existing Sessions dropdown functionality
**Date:** 2026-03-20
**Page:** `live-site-pages/globalacl.html`

## What Was Built

A Session Manager panel in the Global ACL page's PROJECT CONTENT area that displays and manages active sessions across all auth-enabled GAS projects from a single UI.

### Architecture

- **Multi-iframe approach**: each auth project gets its own hidden iframe loaded with `?action=adminSessions`
- **Sequential iframe loading**: iframes are loaded one at a time to avoid race conditions — GAS `gas-admin-sessions-ready` messages don't carry a project identifier, so parallel loading would misattribute ready messages to the wrong project
- **Separate iframes from dropdown panel**: the Session Manager creates its own iframes rather than sharing the existing `admin-sessions-iframe` used by the Sessions dropdown button, to avoid message routing conflicts
- **Admin-only visibility**: panel is shown via `_smShowForAdmin()` hooked into `showApp()`, hidden on sign-out

### Projects Configured

| Project | Deployment ID | Has `listActiveSessions`? |
|---------|--------------|--------------------------|
| Global ACL | `AKfyc...` | Yes |
| Testauthgas1 | `AKfyc...` | Yes |
| Portal | `AKfyc...` | No — needs `listActiveSessions`, `adminSignOutUser`, and `?action=adminSessions` added to `portal.gs` |

### Features Implemented

1. **Per-project collapsible sections** with session count badges (loading/count/error/offline states)
2. **Session cards** showing: email, role, (you) indicator, sign-in time, last activity, remaining time (absolute + rolling)
3. **Sign Out button** per user per project (admin can't sign out self)
4. **Refresh All** button and per-project Refresh buttons
5. **Auto-refresh toggle** (30-second interval)
6. **Connection timeout** (15s) with error display
7. **Total active sessions counter** across all projects

### What Broke

The implementation modified the existing admin session message handler (`gas-admin-sessions-ready`, `gas-admin-sessions-list`, etc.) to add Session Manager routing logic. This introduced cross-contamination between the dropdown panel's iframe and the Session Manager's iframes.

**Specific issue**: the existing `gas-admin-sessions-ready` handler at the template level (`window.addEventListener('message', ...)`) processes ALL messages from `*.googleusercontent.com` origins. When Session Manager iframes were added, their ready messages also hit this handler, potentially setting `_adminIframeSource` to the wrong iframe's source. The guard logic added to prevent this was insufficient — it relied on `_smState[id].iframeSource` which isn't set until AFTER the ready message is processed (chicken-and-egg).

**Root cause**: the GAS postMessage architecture doesn't include a project/source identifier in messages. All admin session messages have the same `type` strings regardless of which project's GAS sent them. Disambiguating requires matching `event.source` against known iframe sources, but for `gas-admin-sessions-ready` (the first message), no source is registered yet.

### How to Fix (for next attempt)

**Option A — Add project identifier to GAS messages**: modify the `?action=adminSessions` handler in each GAS project to include the `ACL_PAGE_NAME` in the ready message: `{type: 'gas-admin-sessions-ready', project: 'globalacl'}`. This allows the HTML-side router to unambiguously assign each message to the correct project. Requires deploying GAS changes to all auth projects first.

**Option B — Don't modify the existing handler at all**: register the Session Manager's message listener with higher priority, use `stopImmediatePropagation()` for messages from SM iframes so the existing handler never sees them. This keeps the dropdown panel completely untouched.

**Option C — Centralized server-to-server approach**: instead of multiple iframes, have the Global ACL GAS call other projects' GAS via `UrlFetchApp` with a shared admin API key. This eliminates the iframe/postMessage disambiguation problem entirely. More quota-efficient (N+1 vs 2N GAS executions per listing) but requires adding a JSON API endpoint to each project's GAS.

### Code That Was Removed

The following was added to `globalacl.html` and has been reverted:
- **CSS**: `#session-manager` and `.sm-*` styles (~90 lines) in the `/* PROJECT START */` section
- **HTML**: `<div id="session-manager">` panel in the `<!-- PROJECT START -->` content area
- **JavaScript**: `SM_PROJECTS` config, `_smState`, `_smInit`, `_smLoadProjectIframe`, `_smLoadNextProject`, `_smHandleReady`, `_smListSessions`, `_smHandleSessionsList`, `_smHandleError`, `_smSignOutUser`, `_smHandleSignOutResult`, `_smRefreshProject`, `_smRefreshAll`, `_smRenderProject`, `_smUpdateTotalCount`, `_smMessageRouter`, `_smShowForAdmin` (~270 lines) in the `// PROJECT START` section
- **Hooks**: `_smShowForAdmin()` call added to `showApp()`, cleanup added to `performSignOut()`
- **Existing handler modifications**: `_isSmIframeSource` guard and return-early logic added to `gas-admin-sessions-ready/list/error/signout` handlers

Developed by: LightAISolutions
