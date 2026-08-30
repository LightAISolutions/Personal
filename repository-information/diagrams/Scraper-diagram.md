# Scraper.html — GAS Integration Sequence Diagram (Auth)

Sequence diagram showing the dual polling systems (HTML + GAS) and the iframe injection flow.

> [Open in mermaid.live](https://mermaid.live/edit#pako:eNq9WttuI7uV_ZUNBTinBOviS3cy4zndB2pJ7aOB2zYktztBHBis4lYVIxZZh2RJre70IE8BzsMMkMG85yX5hrznU_oL8gmDTVbpZvkCBMmLLVVxk5trr30j9bmRaI6N04bFH0tUCQ4ESw3LbxUAQMGME4komHLwxuiFRXP_xQ_X786BWZgkhhVoOpnL5Z5RNxtjaEhnjsYKrTruo7s__GxzeGqfGNyb0Gj69wFj6BXFd7F5HfWKwk8hCtfcI6R1KtHLhU-XvdJl98f1_eb6GVMpSp3a-yPGwzMaUhg9FRJNO9F5wZRA2_mt1cqrcibcD2UMVyxFu0eXD8M3NMO1YRzbhUFrYTyZwAHJVtpd4MLeqiB6oR2CnqOpjdIiG5z66eFcMx6GVS_br1-H1_Rmj5Xo5WrMAIkPcIfw9Q__CwYJd4yY03HUbPpnhDLHQupljsrB-_H5nmn6BplDEFPDcoSFcBlYk3CdQKy1s86wYkvqrDc5rUcrNhcpc2jB6b0rnfUm7fbr19X2Tr1GC4yBFQUYVByNBaGq6R7GLAB7umV-oD-onEiYE1pt61iNHynhBJPiE8LZaAJRJT_iJOeWMEEzF8nKzuF1ewUNyUgRG2aWIDXj-IC13ls0kEiRzCxMRKpgtF8dQ45rXS9J0NprPUMV9c9Hw4vru9GgBTbRxYOqBBlwJAQGExTzWptNuxTaundoLUsxSplts9JlbS_UCrLNtV3Wet2gEdNlNfkBpOigpC0JNdW76vhl_IYxZ0K2QHnLbUxKA_oZJjOg1bURn7yBIOr1r0c3w7ur8XAyvIZEq6lIm1s8CXvduwmDtpSuBbb0SHSnTMjmI152cxqiXa90uj3GqUGbQUROsoSjwxpmqXUBw-ohWEy04lXY2HSUm1M4G14_FBK_v0viV07kaB3Liw3pm_Wefjc_POr88peL34E2kDOhHCqmElw93yPPpCPT0DKQ-KDG1y_v-fEk0wu4bbwvOHNCpZ1O57YBB2DRQYGKC5W2rS7V_ilWDroQiutFR-rgVR2DRPyouS216wBjP8rHnNvGB4ytcAhjZHx52wBbSGYzUmV7eZQW4d0aCsg1x8e183vUhqDYBNGbXrLlztwTClGVnR4Brq9L5bheKODancLLTudFp3PS6Rx3OkcbM9aq-w8PBqqbEOO2WXf00gJHyZYtoJAFuyysPfhmFbEgIQc6Ba7xgdQK-FFY933lPhtMC4RKIfIDrDeKJdxIr0JI-Rj1IWJThwZIY1Gp4jVv3nOKs22n2NbuIZfYo-g230nJ-bM5f9ug8SVRHjl8_f3_QeBrzf9_Otf7lIGfRfRnkrE2EiSbrHwuDWkOz8GecqI9WaoErox2mNzLkGG10TQsqKX0mV8oOLGgpyF00uMW1TWMc6gpTJm-lnnEDygJUB1U04P0-C0mzkJ0lTGLcNTcow_xtFcUURMCDa1IVVsoD_adDTORh0TN-6lvii7J4Opycg3M7_eVFNbVy37jk1so8IarEawQ3-jiVafTgSmTMmbJrHkvl82ZFESwCVoy3lttBswxr5NeKDRtn7g50Nb9AqutHsAkyZCXkgokFtt9ye5zldBaVJR6sV__5oufnDObxZoZDgkzdVbaZeMFLmpovdDLtnVYgFCOzaia-8QMfwirCoTEF4D1JN3KnVbfaUsWayAnjrnSQlSwpXeD_5xcXtyH7KaCDOphpNrCUFZYg0MTr_GhfbWAlVw4kDp9BKmAjtPMOjgAMjKYEGmfw8e-zgshq4okUPG4uR_bPlV0lQCCVsBqG3mLbITR98oJCdYxhx2uFUKUZKWaIW8B1S05iyXuiaD3TRHWutCLb6qVRhtxZAPgN6WQvOuh_bHEElelrd_jeDIhcH8s0QgkGvpqborIbROmRudVq0XGKNA4gXbvKm-9bl9_-vPPgzBELw4txCVP0YUOo2DGIq01nky6PafzwFzkZRHaElZQ8QE9aqBqM2-vtbYvIefdgKyMvOu0Y7IFjHPkweiF0alvuSSLUW4EwkdRJYrUCuziuq0Bq0aRCzpdkGcb5DAVxjqIvv7056PDwyZt12-t3lPBFMp1DfIoB38Q1mkjEibhDUtmUwr1FQ1POi8fJeJq_NNMZFKCldTZwD9Cx7ha8Wk-XuBHF4hyNhieX8Pgsg_HnUPItXJZO6jiY-Pxi7Z_ViXf5g5faEzMXJK1_0XEedRYvRFle5z7GvMA3hiB01UCO3nUWD3F5PLTc6KGoT5KCZW-OoSoVBXlaFJ4FcyFIbI8x2IsLPsQ23esdqkQPNqU8j27YaVAzW6yyAH8_U9__O_u3__0x_8B_Ih5IZkBJxzZxXuCoCAp0eFd5N2jL1nJESZaKXTwknqeM8yFEhD1RndX48ub0WA4BrsQLslWPe-Odh98vvDqQHTYJtej2qrMc-rHI__i609_eRk80ultrrQoi5AFEyblE8ypUPPuURnjGfHmAdKsoTK-EYP3IzDoBIEaL4FjInx1OzhZ5x8qXWkTczRcJA6MLp0P3Nk6XMw1PaITJzRz5OD_mbYVddP0QNQg0tIZy3a4eiJkFgbnAhdeeF_IrGSudQEnh-upN41Su_MWOYg-SenEHCGmufcFYf8i4O8_Qqw_0gYqvXfBP-tNWuPh2SklM3-oByPl0KB14AvgaIwxZUuo6k7fJgTwgMDbbId-0KWRS3BGpCkaiCxN4DKjnZPIqfT9L60S7PKthmgDEJvUFY25JvQzZMbFyEJxZhPSqFbPVs4SmVJZeDN8ezkeUn8IhShQCkXVU2kR0m3fD6v5HVMluzrK5Myx7gMHm2vp8fBsdYrzeTWI8l1RxlIkaxQNpsI6s9y7z_eFReNWSPvy9hQULiDMufT7vbwIVd5t48K_maNhKd424G9_BYlTt1ojoOOYRIgUdcfUa6BD3gzhx-lCJF2LKZ0udq0uTYJgQ0kiFKnS1krWNnnKQz8IgzBAO9vQf8yE3KXKcfMZhcVqitBhQKRV3bbsLfdFPf7Xv2mBZNYRJQLbJ35fttuvzeJr70nYte1eEwh0BJimEm0LppKltgUJc5hqs4QkE4VtgefsOtPsRoVrLw5MQa0JdIOjKL2gjz7eMmIuJxI-AYHFFQJDRXUFrzqGTaJf-JlNGRuRXIXIci-UbL2tvGXsn3mN7qLm6YpbLw7hb38NQb8QCRy_JEKtiIt5kTErLBz557aMrfMZ_PgQosFJtVLFrIpT3skg0tNpu35SL6aoov6ERiPfa1AM2_4CXfgcDin9Rx8JW54KTFY9iyGShfbqkQuCD8M3p3CdIbzThlIRDLkI7co2PU82I1c_FHhA3Z_1Ie62MS5V3QgqvbhtgFBUVnmBFuVkCjZZFfJEMiNEtIIF4oyzJeRheQtff_rLL2B4DZGkuG0FYUmiQY0XkOo2vXlOfWJKNRApWnehF7uBxe87tBwVpjA4AqOtq5sXiE4OQZdOorP-YIIqzi5tOdSRxy_quhKiXxxn8E6rzQJz74KDY6Ay1zpdrO4XfBNV2b9N59ub3VR0dNw1paIcrXjb6FioFtBBTXuBIs3ciiY7BA9kDvWMre1CyvVGMMNlu9BCuaq8EXXdJZFxiDg6NFQ-WUczKFEU6NYnFnWmteGcJ9RkF6QLjNQsnOXQo4C8j9UP1UPkOdiCGRau6w1HRREVSbv10Coy7Am2frsDJE6YJZWwWs7pBCQzukwzsElF6DEmohAU2-6ApUwo64hXPuiVsU2MiOl-yLHYExpZknlvDi8g05JbIBdNdB4LFXp6PQUM09M8glvP9G-ZlN924BxTlixhMDobTq7vxsP-6IquX8CWZi5IR8oidL1XqaEVtukUE3KRmjB_SD7PSAw12p8rdVq-827Bjy3Q06lF1wIpckHRgpZKsZKAbpX8Vl9TfS7mWJ28dMHRFZIIUv4O5pziyVraouuJK6PngqOh72yOazwhMivYm3stt6m8QcYtXF6c_woSLctcWThq_xwO4N_bR8feKiFd12arGNj1nKslfMGlgQFHLICZJKM4kmjPxQzB0tEos8A8iTMmJZ3yK-zAWyEdGqHSFhQspVjIFA81Epp2BWw4KrXADAYv2KmLd7a3Dc8BrODwvLE-E1Cl7udK-ky9Y4qllTXuIJr0x72r4fiuIlFv8G50cecR8q0Qz4XaLEZ2-o2AK13G-RY1qN6Jl5VLfIGDPZ5LqoTDVEf7T43g0KXGBhVnZGJH4RIOIGfWUeIOmYZOdEnUaCnbZVHjFDE6tkHlvrUw9QCDUIksOYUlZ2HOjGBrdjxxbjjJmMFzoWaU4XGuZxtPotxDZ9oe032AHB3_WzsWrrp6JAB_1hXWltj9TvDXZOWcSaFmLbA0K10s-8B_NXgLc0GdtQ-abinRZkg-9UEb7l-xopDV3XA3twttnur2vd68jh6B3BpY4mHbLaa8BNXf39eFEEl_415957fymlp5tr6grns_Kgf2ex0l_IDCaOIZbnCKhn7mUWsSuAOCg7CkFhY0LQUVXwplAR3yNDryCXMlTCntIKamghpI38MwpV1GhVLYacef33nTcYqVpZopunfwM1h_G8yo2PTHrKVl8j-8fj5U-jNdH2gtMPClm4cLDZ18eOcmXL61dFROffn-nwXQQQQ1usg32B9rvmyB0kJx_NjytigKsBk-dvHQp8a3_gEIXOmiLOxj7bF3sfrCiS5etkhPs4WKZPPqN6nn7-RV7uufryn9jpmZv7dZnY960KsblaIsauX3K7R5Afa0Pqn9R7VptBo5eZngjdPG59uGyzDH28bpbYPjlJXS3Ta-NFoNVjpNXULj1JkSW41QxVa_QAoPv_w_dNZR9g)

```mermaid
sequenceDiagram
    participant Browser
    participant HTML as Scraper.html
    participant HV as Scraperhtml.version.txt
    participant GV as Scrapergs.version.txt
    participant GAS as GAS Web App<br>(Apps Script)
    participant Google as Google OAuth
    participant CL as Changelogs
    participant REG as profiler-companies.json<br>(GitHub Pages)
    participant WEB as Trade-press RSS +<br>Google News

    Note over Browser,HTML: Page Load
    Browser->>HTML: Load Scraper.html
    HTML->>HTML: Decode _e → reverse(atob()) → GAS deployment URL
    HTML->>HTML: Create iframe with srcdoc bootstrap
    HTML->>GAS: iframe navigates to deployment URL
    GAS-->>Browser: GAS web app renders in iframe

    Note over Browser,Google: Google OAuth Authentication
    HTML->>Google: Initialize GIS (Google Identity Services)
    Google-->>HTML: GIS library loaded
    Browser->>HTML: User clicks Sign In
    HTML->>Google: requestAccessToken(CLIENT_ID, scopes)
    Google-->>HTML: Access token received
    HTML->>GAS: postMessage(gas-auth-token, token)
    GAS->>Google: Verify token + get user info
    Google-->>GAS: User email, name
    GAS->>GAS: Check authorization (ACTIVE_PRESET config)
    GAS-->>HTML: postMessage(gas-auth-result, success/fail)

    Note over Browser,HV: HTML Auto-Refresh (every 10s)
    loop Every 10 seconds
        HTML->>HV: GET Scraperhtml.version.txt?_cb=timestamp
        HV-->>HTML: |v01.XXw| or maintenance|v01.XXw|timestamp
        alt Version changed
            HTML->>HTML: Show "Updating..." + set pending-sound
            HTML->>Browser: window.location.reload()
            Browser->>HTML: Reload → "Website Ready" splash + sound
        else Maintenance mode
            HTML->>Browser: Show orange maintenance overlay
        else Same version
            HTML->>HTML: Countdown dot: 5..4..3..2..1
        end
    end

    Note over Browser,GV: GAS Auto-Refresh (15s delay, then every 10s)
    HTML->>GV: Initial check: does Scrapergs.version.txt exist?
    GV-->>HTML: v01.XXg (exists → show GAS pill)
    loop Every 10 seconds (after 15s initial delay)
        HTML->>GV: GET Scrapergs.version.txt?_cb=timestamp
        GV-->>HTML: v01.XXg
        alt GAS version changed
            HTML->>HTML: "GAS updated — reloading..."
            HTML->>Browser: window.location.reload()
            Browser->>HTML: Reload → "Code Ready" splash + sound
        else Same version
            HTML->>HTML: GAS pill countdown dot
        end
    end

    Note over HTML,GV: Anti-Sync Protection
    HTML->>HTML: If GAS poll within 3s of HTML poll,<br>add 5s delay to GAS poll

    Note over Browser,GAS: News Scraper Projects (Phase 1)
    HTML->>HTML: showApp() after sign-in → _scraperInit()
    HTML->>GAS: fetch POST action=listProjects&token<br>(GET action=api&op=... fallback)
    GAS->>GAS: validateSessionForData → owner-scoped rows<br>(Projects + Schedules tabs)
    GAS-->>HTML: {success, projects[]} → dashboard cards
    Browser->>HTML: New Project → 5-step intake wizard
    HTML->>GAS: fetch action=createProject / updateProject /<br>setProjectStatus (payload JSON)
    GAS->>GAS: Validate payload → write Projects +<br>Schedules rows, audit log
    GAS-->>HTML: {success} → toast + list refresh

    Note over Browser,GAS: News Compilation (Phase 2)
    Browser->>HTML: Click Compile on a project card
    loop Until state.done (chunked, resumable)
        HTML->>GAS: fetch action=compileNow&projectId
        GAS->>GAS: Build/load queue (Google News RSS<br>queries + user feeds) from Script Properties
        GAS->>GAS: Fetch ≤6 feeds (40s budget) → parse<br>RSS/Atom → dedupe → append Articles rows
        GAS-->>HTML: {done, processed/total, added} → progress label
    end
    HTML->>GAS: fetch action=listArticles&projectId
    GAS-->>HTML: {articles[]} top-scored first (≤100)<br>→ articles panel overlay

    Note over Browser,GAS: Historical Backfill (Phase 3.5)
    Browser->>HTML: Click Backfill on a project card
    loop Until all slices done (chunked, resumable)
        HTML->>GAS: fetch action=backfillNow&projectId
        GAS->>GAS: Next ≤6 GDELT DOC 2.0 month-slices<br>(24-month window) → dedupe →<br>batch-append Articles rows
        GAS-->>HTML: {done, processed/total, added} → progress label
    end

    Note over Browser,GAS: AI Relevance + Briefs (Phase 3)
    Browser->>HTML: Click Analyze on a project card
    loop Until remaining=0 (unscored rows = resume state)
        HTML->>GAS: fetch action=analyzeArticles&projectId
        GAS->>GAS: One batch of ≤10 unscored articles<br>+ 👍/👎 exemplar titles → aiComplete_()<br>Claude Sonnet 5 or Gemini (AI_PROVIDER switches)
        GAS->>GAS: Write score (0-100) + summary (score≥50)<br>to Articles rows, log AI calls
        GAS-->>HTML: {done, analyzed, remaining} → progress label
    end
    Note over Browser,GAS: 👍/👎 rating UI retired by decision D3 (Phase 2) —<br>verdict routes + historical votes preserved server-side
    Browser->>HTML: Click Brief in articles panel
    HTML->>GAS: fetch action=previewBrief&projectId
    GAS->>GAS: Top 30 articles (score≥50) →<br>aiComplete_() executive brief
    GAS-->>HTML: {brief} → brief box in panel

    Note over GAS,REG: Profiler Interest Sync (Rebuild Phase 1 — server side)
    loop Hourly trigger (sync throttled to ~once/day)
        GAS->>GAS: scSchedulerTick heartbeat → scSyncInterests_()<br>(runs BEFORE the pipeline pause gate)
        GAS->>REG: GET profiler-data/profiler-companies.json
        REG-->>GAS: {companies[]} public Profiler registry
        GAS->>GAS: Upsert Interests tab: new company → ON +<br>"New coverage" · left registry → stale (never deleted)<br>+ topic/segment/source seeds (insert-only)
    end
    Note over Browser,GAS: Wire Desk Interests Rail (Rebuild Phase 2)
    HTML->>GAS: fetch action=listInterests&token (on sign-in)
    GAS-->>HTML: {interests[], lastSync} → Sources/Companies/<br>Segments/Topics toggles, flags, category chips, sync card
    Browser->>HTML: Toggle an interest / Sync now / Score a headline
    HTML->>GAS: fetch action=setInterestEnabled /<br>syncInterestsNow / rubricPreview
    GAS->>GAS: rubricPreview → scRubricScore_(): company 40 ·<br>topic 25 · Profiler emphasis 15 · substance 20 (D3 rubric)<br>+ segment gate (off-segment company news zeroed)
    GAS-->>HTML: {enabled} / {result} / {score, signals} → rail updates

    Note over Browser,WEB: The Morning Edition (Rebuild Phase 3)
    loop Chunked steps — "Run intake now" in-app loop, or the hourly tick<br>on weekday mornings ≥7 ET (live since the Phase 4 go-live)
        HTML->>GAS: fetch action=runDigestNow
        GAS->>WEB: Fetch enabled D1 roster feeds (30 outlets,<br>≤6/step) → 24h window (72h Mon) → dedupe
        GAS->>WEB: D2 backstop: Google News company-name<br>queries (12/run round-robin, down-weighted)
        GAS->>GAS: Rubric scores intake → AI key-point summaries<br>+ lead (deterministic snippet fallback) →<br>sections → Night Ink HTML → Digests tab
        GAS-->>HTML: {phase, kept/fetched, done} → progress line
    end
    Note over GAS: Delivery resolves through scEditionRecipients_ against the<br>Subscribers tab — each subscriber holds any combination of edition<br>ids, or 'all'. Legacy DIGEST_RECIPIENT survives only as the<br>one-time migration source
    HTML->>GAS: fetch action=listDigests {edition, from, q, offset, limit} /<br>getDigest / deleteDigest / goLiveStatus / testAi /<br>emailLatestDigest / setAiProvider / saveSubscriber (recipients)
    Note over GAS: listDigests reads ONLY columns 1-6 + 9-12 — never the<br>Sections/HTML columns — so a deep archive costs the same as a<br>shallow one. Filtering, paging and the per-edition counts are<br>server-side
    Note over GAS: setAiProvider + recipient edits gated by<br>scCanManageDigest_ (SCRAPER_DIGEST_ADMIN_ONLY → admin-only)
    GAS-->>HTML: {digests, total, counts.byEdition} + Night Ink HTML →<br>News Stand grid / calendar / table + masthead rail with<br>roll-up counts (a parent's filter includes its variants)
    HTML->>GAS: fetch action=createShareLink / revokeShareLink (manager-gated)
    GAS-->>HTML: 128-bit token → #/issue/<id> permalink, share URL,<br>PDF via print stylesheet, Word via application/msword

    Note over Browser,GAS: Shared edition — no account
    Browser->>GAS: GET ?action=share&t=<token> (unauthenticated by design)
    Note over GAS: The token IS the reference — no digest id is accepted from<br>the URL, so one token cannot be pivoted to another edition.<br>Revoked or unknown tokens get a flat refusal; the only write<br>is a view counter on the share's own row
    GAS-->>Browser: One stored Night Ink body, noindex, no app shell

    Note over Browser,CL: Changelog Popups
    Browser->>HTML: Click HTML version pill
    HTML->>CL: Fetch Scraperhtml.changelog.md
    CL-->>HTML: Markdown → parsed to HTML popup

    Browser->>HTML: Click GAS version pill
    HTML->>CL: Fetch Scrapergs.changelog.md
    CL-->>HTML: Markdown → parsed to HTML popup
```

## Key Design Notes

- **GAS iframe injection** — the deployment URL is stored as a reversed+base64-encoded string in `_e`. The iframe uses `srcdoc` with a bootstrap script that reads the URL from `parent._r`, deletes it, then navigates — preventing the URL from being visible in page source
- **Dual polling** — HTML and GAS versions are polled independently with anti-sync protection (if polls align within 3s, GAS poll gets a 5s delay to re-stagger them)
- **Two splash screens** — green "Website Ready" for HTML version changes, blue "Code Ready" for GAS version changes
- **Audio unlock via UAv2** — since the GAS iframe covers the entire page, click events don't reach the parent document. The UAv2 poll detects `navigator.userActivation.hasBeenActive` (propagated from cross-origin iframe clicks) and unlocks AudioContext without needing a direct click on the parent

Developed by: LightAISolutions
