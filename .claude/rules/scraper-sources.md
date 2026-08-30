---
paths:
  - "googleAppsScripts/Scraper/Scraper.gs"
  - "live-site-pages/Scraper.html"
---

# Scraper Data Invariants — Source Roster & Seed Vocabulary

*Path-scoped reference for `googleAppsScripts/Scraper/Scraper.gs` and `live-site-pages/Scraper.html`. Two invariants live here: consult the roster section **before** proposing any new outlet for `SCRAPER_SOURCE_ROSTER`, and the seed-vocabulary section **before** editing the terms of any seed.*

## Editing seed terms: bump `tv`, or the change never ships

> **THIS BLOCKS EVERY EDIT TO A `terms:` ARRAY IN `SCRAPER_SEGMENT_SEEDS`.**
> The failure mode: the terms are edited in the source file, the change is committed, deployed and reported as fixed — and the running app behaves exactly as before, because scoring reads terms from the **Interests sheet**, not from the source file. Seeds only populate a sheet row once. The developer then rebuilds, sees the same wrong article, and the session has to be spent rediscovering this.

**The rule.** `scSyncInterests_` rewrites a segment row's terms only when the seed's `tv` is **greater than** the `seed-terms-vN` marker stored in that row's Notes:

```js
if (sgNotes === '' || (sgM && Number(sgM[1]) < sgTv)) { sgRow[7] = sgs.terms.join(', '); … }
```

So `tv: 1` against a row already marked `seed-terms-v1` is a no-op. **Changing terms without bumping `tv` is indistinguishable from changing nothing.**

**Before committing any seed-terms edit:**

1. **Bump `tv`** on that seed — a seed with no `tv` counts as 1, so the first bump is `tv: 2`.
2. **Tell the developer to press "Sync now"** (or wait for the hourly tick) *before* rebuilding. The build path does not sync; a rebuild alone will not pick up the new vocabulary.
3. A row whose Notes hold anything other than `seed-terms-vN` (e.g. `custom`) is **never** rewritten — that is deliberate, and it means a developer who has customised a row will not receive the new terms at all. Say so rather than assuming the change reached them.

**Confirmed instance:** v03.48r broadened `seg-bess-residential` and `seg-consumer` to catch consumer power stations, left both at `tv: 1`, and the next build printed the same article. Fixed in v03.49r by bumping both to `tv: 2`.

**The same shape applies to `SCRAPER_INTEREST_TOPIC_SEEDS` and the source roster** — anything seeded into the Interests sheet is a one-time copy unless a version marker says otherwise.

---

## Source roster: mandatory check before suggesting a source

> **THIS BLOCKS ADDING ANY OUTLET TO `SCRAPER_SOURCE_ROSTER`.**
> The failure mode: an outlet is dropped after being proven unfetchable, the reason is recorded only in a changelog, and a later session — reasoning from the outlet's obvious topical fit — proposes it again as a "gap in coverage". The developer then re-approves work that was already proven impossible. A changelog entry does not survive that; a checklist does.

**Before adding any outlet, in this order:**

1. **Check the unavailable list below, and `SCRAPER_RETIRED_SOURCES` in `Scraper.gs`.** If the outlet appears in either, do NOT propose it. Say it was already evaluated, give the reason and the date, and move on.
2. **Probe the feed before proposing it** — never adopt a feed URL from memory or from the outlet's reputation. Check the HTTP status, that the body is XML, and that it contains items with recent dates:
   ```bash
   curl -sL -o /tmp/f -w '%{http_code}\n' --max-time 20 "$FEED"
   grep -c '<item\|<entry' /tmp/f
   grep -oE '<pubDate>[^<]*' /tmp/f | head -1
   ```
3. **Distinguish "blocked" from "offline"** — they look identical in a browser and are opposite facts:
   - `403` with `server: cloudflare` and `cf-mitigated: challenge`, or a `Just a moment…` / `Attention Required!` title → **blocked**. The outlet is alive; no server-side reader can ever fetch it. Do not "fix" this with a different URL or a browser User-Agent — both were tried.
   - `200` with a tiny body that redirects to `/lander`, or a `_trfd`/`ap:"parking"` marker → **offline**. The domain is parked and the publication is gone.
4. **Record the outcome.** A newly dropped outlet gets an entry in `SCRAPER_RETIRED_SOURCES` with `status`, `label`, a `detail` ending in `Re-checked YYYY-MM-DD`, **and** a row in the table below.

## Unavailable outlets — do not re-propose

| Outlet | Domain | Status | Why | Verified |
|---|---|---|---|---|
| Data Centre Magazine | `datacentremagazine.com` | `blocked` | Live and publishing. Cloudflare Managed Challenge on every content path; the site advertises no feed at any address. Five candidate paths probed, all 403. | 2026-08-27 |
| Battery Technology | `batterytechonline.com` | `blocked` | Live and publishing through 2026. Whole domain returns 403 to automated clients, including with browser User-Agents, confirmed from two independent fetchers. | 2026-08-27 |
| Solar Industry | `solarindustrymag.com` | `offline` | Publication gone. `/feed` returns 200 but is a 114-byte JS redirect to `/lander`, a GoDaddy parking page. The only one of the three that genuinely ended. | 2026-08-27 |

## Rejected workarounds

- **Google News site-scoped feeds** (`news.google.com/rss/search?q=site:<domain>`) do **not** substitute for a blocked outlet's own feed. Measured 2026-08-27: `datacentremagazine.com` → 1 item; `batterytechonline.com` → 1 item dated April 2025; `solarindustrymag.com` → 0. Do not propose this as a fix.

## Beat coverage after these removals

None of the three left a gap: battery and storage run through Energy-Storage.news and ESS News, solar through pv magazine USA and Solar Power World, data centres through Data Center Frontier, DCD and The Register. State this when the developer asks whether a removal cost them coverage.

## How the two statuses behave in the app

- `blocked` — kept visible in Tune, struck through, toggle frozen **off**, sorted to the bottom of the source list. The developer can see the beat is intentionally uncovered.
- `offline` — filtered out of `listInterests` entirely and never rendered. The sheet row is kept for history and is not deleted; re-adding the key to `SCRAPER_SOURCE_ROSTER` still reactivates it.

Developed by: LightAISolutions
