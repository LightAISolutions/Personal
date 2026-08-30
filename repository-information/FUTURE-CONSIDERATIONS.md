# Future Considerations

Ideas and architectural considerations for when the project scales. These are not actionable to-dos — they are deferred decisions to revisit when the trigger conditions are met.

## Security & Defense

- **IP blocklist for GAS** — application-level blocking via Script Properties or CacheService. Block persistent attackers spotted in the audit log. At scale, consider shared (one central spreadsheet) vs per-project blocklists. Trigger: when you start seeing repeat offenders in SessionAuditLog
- **Email alerting for security events** — GAS `MailApp.sendEmail()` on first attack event per hour, so you know attacks are happening without checking the spreadsheet. Trigger: when you want passive notification instead of actively checking the audit log

## Quota Management (GAS quotas are per-account, not per-script)

- **Quota usage tracking** — count audit log rows per day as a rough proxy for daily script executions, since Google provides no direct "remaining quota" API. Trigger: when approaching ~10-15 projects on a consumer account
- **Heartbeat interval tuning** — switch from 30s test value to 300s production value; consider 600s for low-risk projects. Heartbeats are the biggest quota consumer at scale (one execution every interval per active user per project). Trigger: before going to production, and again when quota budget gets tight
- **Client-side session expiry estimation** — skip unnecessary heartbeat round-trips when the client can calculate that the session isn't close to expiring, reducing GAS executions. Trigger: when heartbeat quota is still too high after interval tuning

## Reference

- Consumer account: 20,000 script executions/day shared across ALL scripts
- Workspace account: 100,000 script executions/day (5×)
- Source: [Google Apps Script Quotas](https://developers.google.com/apps-script/guides/services/quotas)

Developed by: LightAISolutions
