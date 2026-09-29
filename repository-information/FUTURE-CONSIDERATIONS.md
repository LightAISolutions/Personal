# Future Considerations

Ideas, architectural considerations and potential future projects. These are not actionable to-dos — they are deferred decisions to revisit when the trigger conditions are met.

## Potential Future Projects (in order of interest)

1. **Personal knowledge wiki** — Claude compiles and maintains a private markdown wiki from your notes, saved sources and email (Karpathy's "LLM wiki" pattern; Noah Brier's open-source *claudesidian*), with periodic "wiki lint" passes for contradictions and stale entries. Natural home: the memory folders of the private `AssistantBrain` repo. Strong fit for spare weekly usage (compiling and linting are batch jobs). Trigger: once the Chief of Staff is switched on and its memory folders are in use
2. **Career system — job scanning + tailored résumés** — scan job boards on a schedule, score postings against your profile, and draft tailored résumés and cover letters for the best matches (reference: santifer's open-source *career-ops*). Drafts only; you apply. Trigger: when a job search or career move is on the horizon
3. **Survey Simon Willison's small single-page tools for inspiration** — ask Claude to review his ~234 single-page tools at `tools.simonwillison.net` and shortlist the ones worth recreating (or adapting) on this repo's GitHub Pages site. Trigger: the next time you want quick, small wins between larger projects
4. **Windows power-user kit** — AutoHotkey-based command palette (Alfred-style launcher), screen-share privacy for client calls (hide chosen windows, clean desktop), and push-to-talk dictation through your local Whisper setup. Few AutoHotkey + Claude Code write-ups exist, so this is an open niche. Trigger: after the Chief of Staff's desktop capture pieces are in daily use
5. **Health coach from wearable data** — a short daily push brief built from wearable exports (sleep, HRV, training load) rather than a dashboard. Trigger: once you own and regularly use a wearable

## Security & Defense

- **IP blocklist for GAS** — application-level blocking via Script Properties or CacheService. Block persistent attackers spotted in the audit log. At scale, consider shared (one central spreadsheet) vs per-project blocklists. Trigger: when you start seeing repeat offenders in SessionAuditLog
- **Email alerting for security events** — GAS `MailApp.sendEmail()` on first attack event per hour, so you know attacks are happening without checking the spreadsheet. Trigger: when you want passive notification instead of actively checking the audit log

## Quota Management (GAS quotas are per-account, not per-script)

- **Quota usage tracking** — count audit log rows per day as a rough proxy for daily script executions, since Google provides no direct "remaining quota" API. Trigger: when approaching ~10-15 projects on a consumer account
- **Heartbeat interval tuning** — switch from 30s test value to 300s production value; consider 600s for low-risk projects. Heartbeats are the biggest quota consumer at scale (one execution every interval per active user per project). Trigger: before going to production, and again when quota budget gets tight
- **Client-side session expiry estimation** — skip unnecessary heartbeat round-trips when the client can calculate that the session isn't close to expiring, reducing GAS executions. Trigger: when heartbeat quota is still too high after interval tuning

## Reference

- Consumer account: **90 min/day total trigger runtime** shared across ALL scripts, **6 min** max per execution, 20,000 UrlFetch calls/day
- Workspace account: **6 hr/day total trigger runtime**, 6 min max per execution, 100,000 UrlFetch calls/day
- Simultaneous executions: 30 per user (both account types)
- Google publishes **no daily cap on the total number of script or web-app executions** — the 20,000 / 100,000 figures are the UrlFetch quota, not an execution count. See [DATA-POLL-ARCHITECTURE.md](DATA-POLL-ARCHITECTURE.md) for how web-app `doGet()`/`doPost()` requests relate to the trigger-runtime cap
- Source: [Google Apps Script Quotas](https://developers.google.com/apps-script/guides/services/quotas) (page updated 2026-09-03; values verified 2026-09-25)

Developed by: LightAISolutions
