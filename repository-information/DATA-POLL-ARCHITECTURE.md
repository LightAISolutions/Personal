# Data Poll vs Heartbeat — Architecture & Quota Reference

> **Context:** In v06.66r, data polling was decoupled from the heartbeat pipeline. Previously, the heartbeat piggybacked `liveData` on its response — data delivery flipped between heartbeat (when active) and data poll (when idle). Now each pipeline has a single responsibility: heartbeat = session extension, data poll = data freshness. In v06.68r, the data poll was upgraded to require session authentication (HIPAA compliance). In v06.73r, the token delivery was switched from postMessage handshake to URL parameter after discovering that Google's GAS iframe sandbox drops parent→child postMessage calls. In v06.74r, the session lookup was fixed to use `getEpochCache()` (matching all other session operations). In v06.78r, a 2-second minimum display window was added to the timer so the "polling..." indicator is visible on every cycle.

## Architecture Overview

### Two Independent Pipelines

| Aspect | Heartbeat | Data Poll |
|---|---|---|
| **Purpose** | Session extension (keep-alive) | Data freshness (spreadsheet updates) |
| **Fires when** | User is active (mouse/keyboard/touch/scroll) | Always (continuous, independent of activity) |
| **Interval** | `HEARTBEAT_INTERVAL` (60s test / 5min prod) | `DATA_POLL_INTERVAL` (15s) |
| **GAS function** | `processHeartbeat(token)` | `processDataPoll(token)` |
| **Auth method** | Full session validation + HMAC | Session existence check (`getEpochCache()` lookup) |
| **Session extension** | Yes (resets `createdAt`) | No |
| **Token delivery** | Phase 7 postMessage (never in URL) | URL parameter (HTTPS-encrypted) |
| **Execution model** | Async (`google.script.run` callback) | Synchronous (inline in `doGet()` response) |
| **Transport** | Hidden iframe (`gas-heartbeat`) | Hidden iframe (`gas-data-poll`) |
| **Response type** | `gas-heartbeat-ok` | `live-data` |

### Why Two Pipelines (Not One)

1. **Different cadences** — session management needs slow intervals (5min), data freshness needs fast intervals (15s). Merging forces one to be wrong.
2. **Independent tuning** — `HEARTBEAT_INTERVAL` and `DATA_POLL_INTERVAL` are configured separately, each optimized for its purpose.
3. **Fault isolation** — heartbeat failure doesn't stop data updates; data poll failure doesn't expire your session.
4. **Quota optimization** — idle users drop the expensive heartbeat (5 CacheService calls + 3 crypto ops) while keeping the cheap data poll (2 CacheService reads).

### Why Not Piggyback Data on Heartbeat

The original design piggybacked `liveData = getCachedData()` on the heartbeat response. This was removed because:

1. Data delivery flipped between pipelines based on activity state — two code paths for the same thing
2. Data freshness was coupled to heartbeat timing (30s/5min), not its own interval (15s)
3. If heartbeat failed or was rate-limited, data delivery was also lost
4. Two response handlers needed to know about data extraction
5. After HIPAA review, the data poll needed its own session authentication — and the GAS iframe sandbox makes postMessage unreliable for parent→child token delivery, so the data poll uses a URL-parameter approach that processes the token synchronously in `doGet()`

### Why Different Token Delivery Methods

The heartbeat uses Phase 7 postMessage (child signals ready → parent sends token → child processes). The data poll uses a URL parameter instead. This is because:

- Google's GAS iframe wraps `HtmlService` output in nested iframes. **Child→parent** postMessage works (the inner page can reach `window.top`). **Parent→child** postMessage does NOT work — the parent's `contentWindow.postMessage()` reaches the outer wrapper, not the inner page where the listener runs.
- The heartbeat works around this because the child always initiates: it signals `gas-heartbeat-ready`, the parent responds, and the child's `addEventListener` inside the GAS sandbox receives the reply (same-origin within the GAS wrapper).
- The data poll fires every 15s. Reloading the iframe each time (to get a fresh child→parent signal) aborts any pending `google.script.run` calls. A persistent iframe approach was attempted (v06.71r) but failed because subsequent parent→child token deliveries were dropped by the sandbox.
- The URL parameter approach avoids postMessage entirely: the token goes in the URL, `doGet()` reads it synchronously, calls `processDataPoll(token)`, and embeds the result as inline JavaScript that postMessages back to the parent. One round-trip, no handshake.

---

## Per-Call Cost Comparison

| Operation | `processHeartbeat()` | `processDataPoll()` |
|---|---|---|
| **GAS function called** | `processHeartbeat(token)` | `processDataPoll(token)` |
| CacheService read (rate limit) | 1x `cache.get(hb_ratelimit_*)` | — |
| CacheService write (rate limit) | 1x `cache.put(hb_ratelimit_*)` | — |
| CacheService read (session) | 1x `cache.get(session_*)` | 1x `cache.get(session_*)` |
| JSON parse (session) | 1x `JSON.parse(raw)` | — |
| HMAC verification | 1x `verifySessionHmac()` | — |
| Session expiry checks | 2x (absolute + rolling) | — |
| Session timestamp update | 1x `hbData.createdAt = ...` | — |
| HMAC re-sign session | 1x `generateSessionHmac()` | — |
| JSON stringify (session) | 1x `JSON.stringify(hbData)` | — |
| CacheService write (session) | 1x `cache.put(session_*)` | — |
| CacheService read (live data) | — | 1x `cache.get(livedata_*)` |
| JSON parse (live data) | — | 1x `JSON.parse(cached)` |
| HMAC sign response | 1x `signMessage()` | — |
| postMessage handshake | Yes (token via postMessage) | No (token in URL, result inline) |
| **Total CacheService calls** | **5** (3 reads + 2 writes) | **2** (2 reads) |
| **Total crypto operations** | **3** (verify + re-sign + sign response) | **0** |
| **Total JSON parse/stringify** | **3** | **1** |
| **Estimated execution time** | **~50-100ms** | **~10-15ms** |
| **Estimated GAS quota units** | **~1 URL fetch equivalent** | **~0.2 URL fetch equivalent** |
| **Session authenticated?** | Yes (full validation) | Yes (existence check) |
| **HIPAA compliant?** | Yes | Yes |

---

## Quota Usage by Activity State

### When User is Active (both pipelines fire)

| Pipeline | Interval | CacheService calls/tick | Crypto ops/tick | Ticks/min | CacheService calls/min |
|---|---|---|---|---|---|
| Heartbeat | 60s | 5 | 3 | 1 | 5 |
| Data Poll | 15s | 2 | 0 | 4 | 8 |
| **Total** | | | | | **13** |

### When User is Idle (only data poll fires)

| Pipeline | Interval | CacheService calls/tick | Crypto ops/tick | Ticks/min | CacheService calls/min |
|---|---|---|---|---|---|
| Heartbeat | — (skipped) | 0 | 0 | 0 | 0 |
| Data Poll | 15s | 2 | 0 | 4 | 8 |
| **Total** | | | | | **8** |

**Idle users consume ~60% of active users' quota.** The expensive heartbeat (5 CacheService calls + 3 crypto ops) drops to zero.

### Production Values (Heartbeat @ 5min)

| Pipeline | Interval | Ticks/min | CacheService calls/min |
|---|---|---|---|
| Heartbeat (active) | 5min | 0.2 | 1 |
| Data Poll | 15s | 4 | 8 |
| **Total (active)** | | | **9** |
| **Total (idle)** | | | **8** |

At production intervals, the heartbeat overhead is negligible — data polling dominates the quota budget.

---

## GAS Quota Limits (per account, per day)

> Source: [Google Apps Script Quotas](https://developers.google.com/apps-script/guides/services/quotas) — verified 2026-03-26. Quotas are **per account** (not per script) and reset 24 hours after first request. Subject to change without notice.

| Quota | Free (Gmail) | Google Workspace |
|---|---|---|
| **Script runtime** | 6 min/execution | 6 min/execution |
| **Trigger total runtime** | 90 min/day | 6 hr/day |
| **URL Fetch calls** | 20,000/day | 100,000/day |
| **Properties read/write** | 50,000/day | 500,000/day |
| **Simultaneous executions** | 30/user | 30/user |
| **CacheService** | **No documented limit** | **No documented limit** |

**Key insight:** CacheService (used by both `processDataPoll` and `processHeartbeat`) has no published daily quota. The binding constraint is **script executions** — each data poll and heartbeat triggers a `doGet()` execution. Google does not publish a hard daily execution limit for web apps, but the trigger runtime limit (90 min free / 6 hr Workspace) applies to time-driven triggers, NOT web app requests. Web app `doGet()`/`doPost()` calls run under the deploying user's quota but are not subject to the trigger runtime cap.

**Practical ceiling:** With `processDataPoll` taking ~10-15ms per execution, a single viewer at 15s intervals generates 5,760 executions/day consuming ~86s of runtime. The 6-min-per-execution limit is irrelevant (each call takes milliseconds). The simultaneous execution limit (30/user) means at most 30 data polls can process concurrently — with ~15ms per poll, this supports ~2,000 polls/second before queueing.

---

## Scaling Comparison

| Metric | Heartbeat only (60s) | Data Poll (15s) | Data Poll (20s) | Data Poll (30s) |
|---|---|---|---|---|
| **Calls/hour (1 viewer)** | 60 | 240 | 180 | 120 |
| **Calls/day (1 viewer)** | 1,440 | 5,760 | 4,320 | 2,880 |
| **Compute/hour (1 viewer)** | ~4.5s | ~3s | ~2.3s | ~1.5s |
| **Calls/hour (10 viewers)** | 600 | 2,400 | 1,800 | 1,200 |
| **Calls/day (10 viewers)** | 14,400 | 57,600 | 43,200 | 28,800 |
| **Compute/hour (10 viewers)** | ~45s | ~30s | ~23s | ~15s |
| **Calls/hour (50 viewers)** | 3,000 | 12,000 | 9,000 | 6,000 |
| **Calls/day (50 viewers)** | 72,000 | 288,000 | 216,000 | 144,000 |
| **Compute/hour (50 viewers)** | ~225s | ~150s | ~113s | ~75s |
| **Compute/day (50 viewers)** | ~0.9hr | ~0.6hr | ~0.45hr | ~0.3hr |
| **Data freshness** | ≤60s | ≤15s | ≤20s | ≤30s |
| **Cost vs Heartbeat** | 1x (baseline) | 0.67x | 0.50x | 0.33x |

### Combined Cost (Active User — Heartbeat @ 60s + Data Poll)

| Metric | HB 60s + DP 15s | HB 60s + DP 20s | HB 60s + DP 30s |
|---|---|---|---|
| **Calls/hour (1 viewer)** | 60 + 240 = 300 | 60 + 180 = 240 | 60 + 120 = 180 |
| **Calls/day (1 viewer)** | 7,200 | 5,760 | 4,320 |
| **Compute/hour (1 viewer)** | ~4.5s + ~3s = ~7.5s | ~4.5s + ~2.3s = ~6.8s | ~4.5s + ~1.5s = ~6s |
| **Calls/hour (50 viewers)** | 3,000 + 12,000 = 15,000 | 3,000 + 9,000 = 12,000 | 3,000 + 6,000 = 9,000 |
| **Calls/day (50 viewers)** | 360,000 | 288,000 | 216,000 |
| **Compute/hour (50 viewers)** | ~225s + ~150s = ~375s | ~225s + ~113s = ~338s | ~225s + ~75s = ~300s |
| **Compute/day (50 viewers)** | ~1.5hr | ~1.4hr | ~1.2hr |

### Quota Headroom (% of daily trigger runtime limit)

> Note: These percentages use the **trigger runtime limit** as a reference ceiling (90 min free / 6 hr Workspace), even though web app `doGet()` calls may not be subject to this specific cap. Shown for conservative capacity planning.

| Scenario | Compute/day | % of Free (90 min) | % of Workspace (6 hr) |
|---|---|---|---|
| 1 viewer (HB 60s + DP 15s) | ~3 min | **3.3%** | **0.8%** |
| 10 viewers (HB 60s + DP 15s) | ~30 min | **33%** | **8.3%** |
| 50 viewers (HB 60s + DP 15s) | ~1.5 hr | **100%** ⚠️ | **25%** |
| 1 viewer (HB 5min + DP 15s) | ~1.4 min | **1.6%** | **0.4%** |
| 10 viewers (HB 5min + DP 15s) | ~14 min | **16%** | **3.9%** |
| 50 viewers (HB 5min + DP 15s) | ~70 min | **78%** | **19%** |
| 100 viewers (HB 5min + DP 15s) | ~140 min | **156%** ⚠️ | **39%** |

⚠️ = exceeds free-tier ceiling. Switch to Workspace or increase `DATA_POLL_INTERVAL`.

---

## Simultaneous Execution Limit (30 per deploying account)

The 30 simultaneous executions limit is **per deploying user**, not per viewer. Every GAS web app you deploy runs under **your** Google account — the account that clicked "Deploy as Web App." All viewers' `doGet()` calls across **all your GAS apps** execute under your account's single pool of 30 concurrent slots.

### Why it matters for multi-app deployments

If you deploy multiple GAS projects (testauthgas1, globalacl, etc.), all of their data polls, heartbeats, and other GAS calls share the same 30-slot pool. The calls don't get separate pools per project — they all compete for the same 30 concurrent execution slots under the deploying account.

### When you're safe

Each `processDataPoll()` takes ~10-15ms. At 15s intervals with 100 viewers across all apps, you get ~7 calls/second. At 10ms each, that's ~0.07 concurrent executions — nowhere near 30.

| Viewers (all apps combined) | Polls/second (@ 15s interval) | Avg concurrent (@ 10ms/call) | % of 30 limit |
|---|---|---|---|
| 10 | 0.67 | 0.007 | 0.02% |
| 50 | 3.3 | 0.03 | 0.1% |
| 100 | 6.7 | 0.07 | 0.2% |
| 500 | 33 | 0.33 | 1.1% |

### When it becomes dangerous

The 10ms average assumes warm GAS runtime. Three scenarios can spike concurrent executions:

**1. Cold starts (2-5 seconds per call)**
If the GAS runtime hasn't been used recently, the first call triggers JIT compilation. If 30+ viewers all open their pages simultaneously (e.g. start of a clinical shift), each cold-start call holds an execution slot for 2-5 seconds instead of 10ms. 30 simultaneous cold starts = pool exhausted.

**2. `refreshDataCache()` self-repair (1-3 seconds per call)**
If the CacheService cache expires (6-hour TTL) and `getCachedData()` finds a cache miss, it triggers `refreshDataCache()` — a Sheets API read that takes 1-3 seconds. If multiple viewers trigger this simultaneously, each holds an execution slot for seconds.

**3. Large spreadsheets**
If the spreadsheet has thousands of rows, `refreshDataCache()` takes even longer, extending how long each execution slot is occupied.

### What to do

1. **Keep `DATA_POLL_INTERVAL` at 15s or higher** — lower intervals mean more calls/second, less headroom for slow calls
2. **Set up `onEditInstallable` trigger for every spreadsheet** — this keeps the cache warm proactively (refreshes on every edit). Without it, the cache expires after 6 hours and the next data poll triggers a slow Sheets API read
3. **Don't reduce `DATA_POLL_INTERVAL` below 10s** — at 100 viewers × 1 poll/10s = 10 polls/second. If 5 of them hit cold starts (3s each), you have 15 concurrent + new arrivals = approaching 30
4. **Each GAS project already uses its own deployment** — but they all run under the same deploying account. If you ever need more headroom, deploying some projects under a different Google account gives that account its own pool of 30
5. **Monitor execution logs** — if "Service invoked too many times" errors appear, you've hit the ceiling

### Practical ceiling

| Scenario | Risk level | Notes |
|---|---|---|
| <50 viewers, all apps combined | **None** | Normal operations, ~0.03 concurrent |
| 50-200 viewers | **Low** | Safe in steady state; cold starts at shift change could briefly spike |
| 200-500 viewers | **Moderate** | Ensure cache is warm, monitor for bursts, consider 20-30s poll interval |
| 500+ viewers | **High** | Split deployments across multiple Google accounts, increase poll interval |

---

## HIPAA Compliance Summary

| Requirement | §164.312 Section | Heartbeat | Data Poll (old) | Data Poll (new) |
|---|---|---|---|---|
| Access Control | §164.312(a)(1) — Required | Compliant | **Non-compliant** | Compliant |
| Person/Entity Auth | §164.312(d) — Required | Compliant | **Non-compliant** | Compliant |
| Audit Controls | §164.312(b) — Required | Compliant | **Non-compliant** | Compliant |
| Integrity (HMAC) | §164.312(c)(1) — Addressable | Compliant | **Non-compliant** | N/A (read-only) |
| Transmission Security | §164.312(e)(1) — Addressable | Compliant (HTTPS) | Compliant (HTTPS) | Compliant (HTTPS) |

The old data poll (`getCachedData()` called directly with no auth) violated 3 required HIPAA specifications. The new `processDataPoll(token)` validates session existence via `getEpochCache()` lookup before returning data.

---

## Token-in-URL Security Assessment

The data poll passes the session token as a URL parameter (`?action=getData&token=...`). This diverges from Phase 7's postMessage pattern (used by heartbeat/signout) because Google's GAS iframe sandbox drops parent→child postMessage calls, making the handshake unreliable.

| Concern | Assessment |
|---|---|
| URL visible to user | No — iframe is `display:none`, URL never appears in address bar |
| HTTPS encryption | Yes — GAS web apps enforce HTTPS; token encrypted in transit |
| Server-side logs | Token may appear in GAS execution logs — only script owner has access |
| Browser history | Iframe URLs may be cached — but the iframe is not user-navigable |
| Token reuse risk | Token only validates session existence (read-only) — no write operations possible |
| Alternative attempted | postMessage handshake (v06.68r) and persistent iframe (v06.71r) — both failed due to GAS sandbox |

**Risk level: LOW** — acceptable tradeoff vs. the HIPAA violation of unauthenticated data access.

---

## Timer Display Logic

The Data Poll countdown in the auth-timers panel shows three states:

| State | Display | Condition |
|---|---|---|
| Polling | `▷ polling...` (yellow) | `_dataPollInFlight` is true, OR within 2s of last poll fire |
| Countdown | `▷ M:SS` | Between polls — counts down from ~13s to 0:00 |
| Inactive | `--` | Data poll not running (no session) |

The 2-second polling window (checking `sinceDataPoll < 2`) ensures the "polling..." state is visible on every cycle. Without it, the GAS inline-JS response arrives in <1 second — faster than the 1-second timer update interval — so `_dataPollInFlight` would clear before the timer could display the polling state.

The countdown starts at ~13s (not 15s) because ~2 seconds are consumed by the polling display window.

---

## Configuration Reference

```javascript
// In HTML_CONFIG (testauthgas1.html)
ENABLE_HEARTBEAT: true,
// HEARTBEAT_INTERVAL: 300000  // ms — production (5min)
HEARTBEAT_INTERVAL: 60000,    // ⚡ TEST VALUE (60s)
DATA_POLL_INTERVAL: 15000,    // 15s — continuous lightweight data poll
```

| Config | Purpose | Tuning guidance |
|---|---|---|
| `HEARTBEAT_INTERVAL` | How often to check for activity and extend session | Increase for lower session management overhead. Production: 5min (300000ms). Keep ratio ≥3x vs `SESSION_EXPIRATION` |
| `DATA_POLL_INTERVAL` | How often to fetch fresh data | Decrease for more real-time data (more quota). Increase to save quota. 15s is a good balance |
| `SESSION_EXPIRATION` | Rolling session timeout (GAS-side) | Production: 900s (15min). HIPAA/CMS standard for inactivity timeout |
| `ABSOLUTE_SESSION_TIMEOUT` | Hard session ceiling (GAS-side) | Production: 28800s (8hr). Clinical shift boundary |

`HEARTBEAT_INTERVAL` and `DATA_POLL_INTERVAL` are fully independent — changing one has zero effect on the other.

---

## File Reference

| File | What it contains |
|---|---|
| `googleAppsScripts/Testauthgas1/testauthgas1.gs` | `processHeartbeat()` (line ~2422), `processDataPoll()` (line ~2501), `getCachedData()` (line ~575), `doGet()` getData handler (line ~2686) |
| `live-site-pages/testauthgas1.html` | `sendHeartbeat()` (line ~3129), `_sendDataPoll()` (line ~3096), `_startDataPoll()` (line ~3079), `_stopDataPoll()` (line ~3085), `live-data` handler (line ~4006), timer display logic (line ~2984) |

Developed by: LightAISolutions
