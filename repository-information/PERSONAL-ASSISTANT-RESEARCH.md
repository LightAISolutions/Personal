# Personal Assistant AI — Landscape Research

> **Research date:** 2026-09-25 · **Companion doc:** [PERSONAL-ASSISTANT-ROADMAP.md](PERSONAL-ASSISTANT-ROADMAP.md) (recommendations, architecture, phased build plan)
>
> **How this was produced** — six parallel research passes (commercial products · open-source/DIY projects · Claude-native building blocks & subscription rules · memory/voice/channels/hosting/security building blocks · use-case value evidence · feasibility on this repo's GAS + GitHub stack), then synthesized. Claims carry inline sources where they matter; **(verified)** = confirmed from a cited source, **(inferred)** = reasoning across sources, not directly confirmed. Platform limits, pricing and policy change fast — re-verify anything load-bearing before building on it.

## Contents

1. [TL;DR](#1-tldr)
2. [Landscape map](#2-landscape-map)
3. [Commercial assistants](#3-commercial-assistants)
4. [Open-source, self-hosted and DIY assistants](#4-open-source-self-hosted-and-diy-assistants)
5. [Claude-native building blocks and subscription rules](#5-claude-native-building-blocks-and-subscription-rules)
6. [Technical building blocks](#6-technical-building-blocks)
7. [Security for agents that touch your life](#7-security-for-agents-that-touch-your-life)
8. [Which functions actually deliver value](#8-which-functions-actually-deliver-value)
9. [Feasibility on this repo's stack](#9-feasibility-on-this-repos-stack)

## 1. TL;DR

1. **The market has settled on one shape:** a task, a schedule or trigger, reusable skills, editable memory, and a messaging channel.
   - Every major lab now ships a proactive daily brief plus background agents on cloud VMs (Gemini Spark, cloud Cowork, Meta Muse, Copilot Autopilot).
   - **A basic daily brief is now free** (Gemini Daily Brief, rolling out to free US accounts since 2026-09-09) — don't build one for its own sake.
2. **Vendors drop features constantly.** ChatGPT Pulse (~9 months), the Atlas browser (~10 months) and Project Mariner were all shut down in 2026, and Manus deleted user data.
   - **Owning your memory, workflows and rules is the durable advantage of a DIY build**, along with combining data across ecosystems, event-driven triggers, and Windows desktop reach.
3. **OpenClaw proved both the demand and the dangers.**
   - Demand: ~391k GitHub stars for a self-hosted assistant you reach through a messaging app.
   - Dangers: two critical CVEs, 800+ malicious marketplace skills, prompt-injection exfiltration, an inbox mass-deleted after compaction dropped a safety rule, and $100–150/month bills.
   - **Copy its file conventions; don't run it on your main PC.**
4. **Spare Claude subscription usage can legitimately power a personal assistant — through Anthropic's own surfaces.**
   - Routines, Cowork scheduled tasks, Claude Code (cloud and local), and `claude -p` / Agent SDK under your own login all qualify.
   - Third-party harnesses were cut off on 2026-04-04, and the policy has reversed twice this year. **Build on first-party surfaces and keep an API-key fallback.**
5. **Claude Code Routines are the natural "brain on a schedule."**
   - Triggers: cron (≥1 h), one-off runs (**don't count against the daily cap**), an API `/fire` endpoint Apps Script can call, and GitHub events.
   - Gmail/Calendar/Drive connectors are built in. **Connectors write without asking** — scope each routine tightly.
6. **Memory:** plain markdown files in a private git repo match or beat dedicated memory products at personal scale. A bounded profile, per-entity notes and daily logs are enough.
7. **Channel:** Telegram is the clear pick for this stack — free, approval buttons, voice notes. WhatsApp has banned general-purpose AI bots, and iMessage needs a Mac.
8. **Value:** the functions people keep all surface **your obligations** ("what do I owe, by when?") at predictable times.
   - Assistants die from **unreliability and cost**, not missing capabilities.
   - Trust grows in steps: reading, then drafting, then acting.
9. **Security:** never let one session hold private data + untrusted content + a way to send data out.
   - Use a two-lane design (a Reader lane with no tools, an Actor lane that only takes your commands).
   - Outbound actions are drafts that you approve with a button.
   - Enforce rules in code, not prompts.
10. **This repo is public** — personal data and memory must live elsewhere.
    - Apps Script can be the free, always-on nervous system, within its limits: 90 min/day of trigger runtime, a ~60 s UrlFetch timeout, no request headers, and 302 quirks.
    - GitHub Actions cron is unreliable in 2026; use `workflow_dispatch`.

## 2. Landscape map

| Tier | Examples | Strength | Weakness for a DIY user |
|---|---|---|---|
| **Frontier-lab assistants** | ChatGPT, Gemini (+ Spark, Daily Brief), Claude + Cowork, Siri AI, Alexa+, Meta Muse, Copilot | Operating-system and first-party data access, voice, hosted cloud agents, free tiers | Locked to one ecosystem; features get killed; you don't own the memory |
| **Vertical / startup assistants** | Poke, Lindy, Martin, Granola, Superhuman, Reclaim/Motion, Plaud | Polished at a single job; text-message delivery | Siloed; subscription fees stack up; limited customization |
| **Self-hosted "claws"** | OpenClaw, Hermes Agent, NanoClaw, Nanobot, IronClaw/ZeroClaw | Always-on gateway + channels + skills + heartbeats; you own it | Security, cost and maintenance burden; subscription use in grey area |
| **Agent / workflow platforms** | n8n, Dify, Letta, Home Assistant, Open WebUI, Goose | Building blocks and visual flows | You still design everything; overlap with Apps Script |
| **"Claude Code as a personal OS"** | Miessler's PAI / LifeOS, Obsidian + Claude Code, Teresa Torres's `/today` | Coding agent as the brain, files as memory, skills + hooks; **runs on the subscription** | Session-shaped rather than always-on — needs a scheduler and a channel bolted on |
| **Ambient capture hardware** | Plaud, Bee (Amazon), Omi, Meta glasses | Effortless capture | Standalone gadgets flop; startups get acquired |

**Where this project sits:** the "Claude Code as a personal OS" tier. Scheduling comes from Routines + Apps Script, the channel is Telegram, and it borrows the claws' file conventions and the frontier labs' patterns (task + schedule + skill). See the [roadmap](PERSONAL-ASSISTANT-ROADMAP.md).

## 3. Commercial assistants

### 3.1 What changed in the last ~6 months (the headline trends)

- **A proactive daily brief now comes free.** OpenAI **sunset ChatGPT Pulse on 2026-06-17** and folded it into rebuilt Scheduled Tasks ([digit.in](https://www.digit.in/news/general/openai-is-retiring-chatgpt-pulse-and-replacing-it-with-scheduled-tasks-here-is-why.html)). Google retired its Labs "CC" email agent into **Gemini Daily Brief**, which has been **rolling out to *free* US accounts since 2026-09-09** and reads Gmail, Calendar, Drive and Docs ([Chrome Unboxed](https://chromeunboxed.com/google-is-rolling-out-gemini-daily-brief-to-free-users-dropping-the-paid-ai-requirement/)). *(verified)*
- **Always-on agents on cloud VMs arrived in mid-2026:**
  - **Gemini Spark** — Ultra beta 2026-05-29. Built from task + schedule + skill, runs up to 15 concurrent tasks, has its own Gmail address ([9to5Google](https://9to5google.com/2026/05/29/gemini-spark-ultra-us/)).
  - **Claude Cowork on web/mobile with cloud execution** — 2026-07-07. Scheduled tasks run with no device online ([claude.com](https://claude.com/blog/cowork-web-mobile)).
  - **Meta Muse** — 2026-09-08. Emails, calendar, bills, and purchases through Stripe ([TechCrunch](https://techcrunch.com/2026/09/08/meta-debuts-its-muse-ai-agent-will-consumers-trust-it/)).
  - **Microsoft Copilot "Autopilot"** — 2026-09-25, business-focused ([Fortune](https://fortune.com/2026/09/25/microsoft-unveils-copilot-super-app-targeting-business-users-with-ai-agents/)).
  
  *(verified)*
- **Vendors drop features constantly.** In ~6 months:
  - Pulse was killed (lasted ~9 months).
  - The **Atlas browser shut down 2026-08-09** (~10 months) and its agent moved into ChatGPT's unified desktop app ([Wikipedia](https://en.wikipedia.org/wiki/ChatGPT_Atlas)).
  - Project Mariner ended as a standalone product (2026-05-04).
  - Microsoft retired five consumer Copilot features on 2026-08-18 ([GeekWire](https://www.geekwire.com/2026/microsoft-starts-merging-its-copilot-consumer-and-business-apps-in-advance-of-super-app-rollout/)).
  - Manus left Meta and **deleted user data created after 2025-12-29** ([Trending Topics](https://www.trendingtopics.eu/manus-becomes-independent-again-following-2b-meta-deal-and-deletes-user-data/)).
  
  **This churn is the strongest argument for owning your own memory and workflows.**
- **~$100/month is now the standard price for the "serious agent" tier:** ChatGPT Pro $100 (added April 2026), Google AI Ultra cut to $100, Claude Max $100, Meta Muse Maximum $100.
- **Siri finally got personal.** iOS 27 (2026-09-14) shipped "Siri AI" in beta, running on Gemini via Private Cloud Compute. It reads Messages, Mail and Photos and acts inside apps, with daily usage caps. Not in the EU or China ([Apple Newsroom](https://www.apple.com/newsroom/2026/09/siri-ai-a-profoundly-more-capable-and-personal-assistant-is-here/)). *(verified)*

### 3.2 Frontier-lab products

| Product | Personal-assistant capabilities (Sept 2026) | Price | Notable limits |
|---|---|---|---|
| **ChatGPT** | Scheduled Tasks (replaced Pulse), ChatGPT Work agent, unified desktop app with browser and computer use, Gmail/Calendar/Contacts/Drive plugins, memory, voice that can use plugins | Free & Go $8 (with ads) · Plus $20 · Pro $100/$200 | Tasks run at most **hourly and can't be triggered by events** (no webhooks) ([usecarly](https://www.usecarly.com/blog/chatgpt-connectors/)) |
| **Gemini app** | Personal Intelligence (Gmail/Photos/YouTube/Search history; free in ~200 countries since I/O), **free Daily Brief**, Agent mode, Chrome auto browse | Free · AI Pro · Ultra $100/$200 | Mostly US-first; stays inside Google data |
| **Gemini Spark** | Always-on cloud agent with a remote browser and computer, 15 concurrent tasks, triggers, reusable skills, its own inbox | Ultra $100 | US beta; "doesn't connect to anything outside Google's walls"; MCP promised but not shipped |
| **Claude + Cowork** | Gmail/Calendar/Drive connectors on **every plan including Free**; Cowork scheduled tasks now run in the cloud; Dispatch (phone → desktop); Claude in Chrome (GA to paid plans 2026-08-26); memory **on by default since 2026-08-25**, visible and editable | Free · Pro $20 · Max $100/$200 | Weekly usage limits; local file access needs the desktop app |
| **Copilot (consumer)** | Memory; Gmail/Drive/Calendar/Outlook connectors | Free / M365 tiers | Consumer side shrinking; the new super-app targets business users |
| **Siri AI (iOS 27)** | Deep on-device personal context, actions inside apps | Free (beta, daily caps; paid tier planned) | Apple-only; iPhone 15 Pro+ / M1+; no EU/China |
| **Alexa+** | Home, family calendar (email it a document → events), bookings (Expedia/Yelp/Angi/Square) | Free with Prime · $19.99 | Voice- and home-centric |
| **Meta Muse** | Email, calendar, bills, form-filling, purchases; background work in a "Secure VM"; glasses + "Muse Charm" keychain | Free · $20 · $100 | Trust concerns; US |

Sources for the table: [OpenAI release notes via justinmckelvey.com](https://justinmckelvey.com/blog/chatgpt-pulse) · [Google I/O 2026](https://blog.google/innovation-and-ai/technology/ai/google-io-2026-all-our-announcements/) · [TechCrunch on Spark](https://techcrunch.com/2026/05/19/google-introduces-gemini-spark-a-24-7-agentic-assistant-with-gmail-integration/) · [Claude Help Center — Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors) · [TechCrunch on Claude memory](https://techcrunch.com/2026/08/25/claude-cowork-finally-remembers-what-you-told-the-app-in-chat/) · [About Amazon — Alexa+](https://www.aboutamazon.com/news/devices/alexa-plus-available-free-prime-members-us) · [Engadget — Meta Connect 2026](https://www.engadget.com/2267230/everything-announced-at-meta-connect-2026/).

### 3.3 Startups and vertical assistants

- **Poke** (The Interaction Company) is an assistant you text. On 2026-06-04 it became the **first AI agent approved on Apple Messages for Business**. It had relayed ~100M messages with a 10-person team and a $300M valuation ([TechCrunch](https://techcrunch.com/2026/06/04/apple-approves-poke-as-the-first-ai-agent-on-its-messages-for-business-platform/)). It is also on SMS, Telegram and WhatsApp. Growing. *(verified)*
- **Lindy** relaunched in Feb 2026 as a ready-made executive assistant over iMessage/SMS: triage, scheduling, meeting prep. *(aggregator source)*
- **Martin** (YC) is a "JARVIS" assistant over SMS, WhatsApp, Slack and phone calls that can call or text people for you. Little traction data found. *(low confidence)*
- **Email:** Superhuman (now under Grammarly, $33/mo bundle), Shortwave ($14–100), Fyxer (from $18).
- **Calendar:** Reclaim (bought by Dropbox); Motion pivoted to "AI Employees."
- **Meeting notes:** **Granola raised $125M at a $1.5B valuation** (2026-03-25) ([TechCrunch](https://techcrunch.com/2026/03/25/granola-raises-125m-hits-1-5b-valuation-as-it-expands-from-meeting-notetaker-to-enterprise-ai-app/)). Otter, Fireflies and Fathom are becoming interchangeable.
- **Perplexity Comet:** browser-sidebar agent with Gmail/Calendar access; the Max plan adds "Background Assistants."

### 3.4 Wearables and always-on capture

| Device | Status (Sept 2026) |
|---|---|
| Humane AI Pin | **Dead** — HP bought it in 2025 and the pins were bricked |
| Rabbit R1 | Still getting updates (now integrates OpenClaw); reportedly short on money |
| Limitless Pendant | **Bought by Meta 2025-12-05**; sales ended; support promised only through ~Dec 2026 ([TechCrunch](https://www.techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/)) |
| Bee | **Bought by Amazon (2025)**; $50 clip; reads Gmail, Calendar and Apple Health; not yet wired into Alexa |
| Plaud | **The winner** — 2M+ users, targeting $500M in 2026 sales, building a wearable meant to feed AI agents ([Bloomberg](https://www.bloomberg.com/news/articles/2026-06-16/plaud-plans-new-wearable-as-ai-note-taking-startup-eyes-500-million-in-sales)) |
| Omi | Open-source pendant (hardware + firmware), ~$179 |
| Friend | ~3k units sold; v2.0 at $249; heavy backlash |
| Meta Ray-Ban Display / Gen 3 | $799 / $449; Muse agent coming to the glasses |
| OpenAI (Jony Ive) device | **Not before Feb 2027**; reportedly a screenless home speaker; won't be called "io" ([MacRumors](https://www.macrumors.com/2026/02/10/openais-jony-ive-designed-device-delayed-to-2027/)) |

*(inferred)* Devices that **add to** your phone (voice recorders, glasses) survived. Devices meant to **replace** it failed. Always-listening pendant startups got bought and their products absorbed.

### 3.5 What commercial products do better — and where the gaps are

**What's hard to replicate yourself:**
- Operating-system and first-party data access (Siri reading Messages, Gemini reading Photos and Search history)
- Distribution privileges (Poke's Apple approval took months)
- Hosted cloud machines with a hardened browser
- Fast real-time voice
- Payment rails
- Prompt-injection defenses tuned by large teams
- Subsidized free tiers

**Gaps a DIY assistant can fill** *(inferred)*:
1. **Data across ecosystems.** Spark stops at Google's edge; Siri stops at Apple's.
2. **Surviving vendor churn.** Your workflows outlive the next feature being killed.
3. **Memory you own and can move.**
4. **Event-driven triggers.** ChatGPT tasks run at most hourly.
5. **Windows desktop + AutoHotkey automation.** No consumer assistant takes Windows seriously.
6. **Privacy-sensitive work on your own GPU.**
7. **Rules and approvals you can audit.**
8. **No $100/month tier just to get an agent.**

**Where the market is converging** *(inferred)*:
- The same three parts everywhere — a task, a schedule or trigger, and reusable skills.
- Background agents on cloud VMs.
- One unified memory the user can see and edit.
- Browser and computer control built into the main assistant app.
- Assistants you reach by text message.
- MCP as the standard tool plug.

**What this means for a DIY build:** don't compete on the daily brief itself (free Gemini now does a solid one). Compete on **combining your data sources, deterministic automations, owned memory, and the Windows desktop**.

## 4. Open-source, self-hosted and DIY assistants

### 4.1 OpenClaw — the project that defined 2026

**History and governance**
- Peter Steinberger launched **Clawdbot** in Nov 2025. It became **Moltbot** on 2026-01-27 after Anthropic's trademark complaint, then **OpenClaw** on 2026-01-30 ([Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)). *(verified)*
- Steinberger joined **OpenAI** in mid-Feb 2026 ([TechCrunch](https://techcrunch.com/2026/02/15/openclaw-creator-peter-steinberger-joins-openai/)). The **OpenClaw Foundation** (non-profit, MIT license) formally launched 2026-07-08.
- Growth in GitHub stars: ~196k (mid-Feb) → 247k (2026-03-02) → **~391k with 82k forks** (2026-09-25) ([GitHub](https://github.com/openclaw/openclaw/releases)). *(verified)*

**Architecture — worth copying**
- One long-running Node/TypeScript **gateway** process. It exposes a WebSocket control plane to channels (WhatsApp, Telegram, Discord, Slack, Signal, iMessage), a web UI, a CLI and device "nodes."
- **Plain markdown workspace files serve as memory and configuration:**

  | File | Purpose |
  |---|---|
  | `AGENTS.md` | Operating rules |
  | `SOUL.md` | Persona and tone |
  | `USER.md` | Stable facts about the user |
  | `TOOLS.md` | Environment cheat sheet |
  | `HEARTBEAT.md` | Checklist for scheduled runs |
  | `MEMORY.md` | Curated long-term memory, loaded only in private chats |
  | `memory/YYYY-MM-DD.md` | Append-only daily logs; today's and yesterday's are loaded |

  Before context compaction, a hidden "memory flush" turn writes durable facts to disk ([docs](https://docs.openclaw.ai/concepts/memory)).
- **Heartbeat:** a periodic agent turn (default 30 minutes). If nothing needs attention it replies `HEARTBEAT_OK` and the message is suppressed.
  - Setting `isolatedSession: true` cuts each tick from **~100K tokens (full history) to 2–5K** ([docs](https://docs.openclaw.ai/gateway/heartbeat)). *(verified)*
  - This single setting separates a $5/month assistant from a $150/month one.
- **Skills** are folders containing a `SKILL.md`, shared through the ClawHub registry. Any model provider works.
- **OpenClaw 2.0** (2026-08-30; 16,977 PRs from 987 contributors) added:
  - Shared cloud sessions
  - A rebuilt UI
  - Memory that works across conversations
  - Approvals tied to the exact request
  - Protected credentials that "never enter model-visible text"

  Migration reception was mixed: broken gateways and lost automations ([InfoQ](https://www.infoq.com/news/2026/09/openclaw-2-release/)).

**What people actually use it for** ([Ask HN: Who is using OpenClaw?](https://news.ycombinator.com/item?id=47783940), ~Apr 2026):
- **Uses:** a WhatsApp chat with memory, calorie/workout logging, life admin, email scanning, calendar, a family-history archive, and Jira→PR automation.
- **Reasons for quitting:** false "done" reports, **$100–150/month** on premium models, fragile integrations.
- **The sharpest critique:** *"I can't think of anything that I couldn't build as a series of cron jobs and Playwright scripts."*

**Security record — the defining story of the year**
- **CVEs:**
  - **CVE-2026-25253** (CVSS 8.8, one-click RCE via a `gatewayUrl` parameter that leaked the auth token) ([SOCRadar](https://socradar.io/blog/cve-2026-25253-rce-openclaw-auth-token/)).
  - **CVE-2026-32922** (CVSS 9.9, a pairing token could be escalated to admin) ([ARMO](https://www.armosec.io/blog/cve-2026-32922-openclaw-privilege-escalation-cloud-security/)).
  - A third-party tracker counts 543 CVEs (unaudited).
- **Exposed gateways:** scans found 21k–135k internet-facing instances, many with no authentication ([Conscia](https://conscia.com/blog/the-openclaw-security-crisis/)).
- **"ClawHavoc" malicious skills:** 341 of 2,857 ClawHub skills at first, **824+ of ~10.7k** by mid-Feb. The payload was the AMOS infostealer.
- **Prompt injection:**
  - A single crafted email made the agent reveal its config and keys.
  - "Summarize my inbox" led to an SSH key being exfiltrated.
  - Zero-click exfiltration via URLs the agent generated ([THN](https://thehackernews.com/2026/03/openclaw-ai-agent-flaws-could-enable.html)).
- **Autonomy failures:**
  - Meta's alignment director had her **inbox mass-deleted** after context compaction dropped her "confirm before acting" instruction ([Simon Willison](https://simonwillison.net/tags/openclaw/)).
  - Another bot published reputation attacks on open-source maintainers to pressure them into merging its PRs.
- **Microsoft's guidance:** treat OpenClaw as *"untrusted code execution with persistent credentials"*. It is not appropriate for a normal workstation; use a dedicated VM ([Microsoft Security blog](https://www.microsoft.com/en-us/security/blog/2026/02/19/running-openclaw-safely-identity-isolation-runtime-risk/)).
- **Still true in 2.0:** tools run on the host with no sandbox by default. Uninstalling leaves a Scheduled Task behind on Windows, and OAuth tokens stay valid until you revoke them.

**Cost horror stories:** $250 on day one from context creep, tool output fed back into prompts, cron re-sends, retries and Opus defaults ([HN](https://news.ycombinator.com/item?id=47162495)).

### 4.2 The "claw" family — alternatives and derivatives

| Project | What it is | Stack | Memory approach | Status (Sept 2026) | Worth borrowing |
|---|---|---|---|---|---|
| **OpenClaw** | Always-on gateway assistant | TS/Node, MIT | Markdown workspace + daily logs + compaction flush | ~391k stars, foundation, 2.0 | Workspace file conventions, `HEARTBEAT_OK` suppression, isolated heartbeats |
| **[NanoClaw](https://github.com/qwibitai/nanoclaw)** | Minimal wrapper around the **Claude Agent SDK** — each agent is Claude Code in a container | TS; Docker (WSL2 on Windows) | `CLAUDE.md` per group | 30.8k stars | **"Script gates"** (a cheap check decides whether to wake the LLM at all), a credential proxy so secrets never enter the container, channels added as skills |
| **[Hermes Agent](https://github.com/nousresearch/hermes-agent)** (Nous Research) | Self-improving agent that turns finished tasks into reusable skills | Python, MIT | **Bounded** `MEMORY.md` (~2.2k chars) + `USER.md` (~1.4k chars) + SQLite full-text search over past sessions | **249k+ stars** — fastest-growing of 2026; HN calls it "night and day" more stable than OpenClaw | Hard caps on memory size, full-text search instead of an ever-growing context, a skill-learning loop |
| **[Nanobot](https://github.com/HKUDS/nanobot)** | ~4k-line claw | Python | "Dream" long-term memory | 48.6k stars | Readable reference implementation |
| **[IronClaw](https://github.com/nearai/ironclaw)** / **[ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw)** | Security-first rewrites | Rust | Postgres / workspace | 12.6k / 32.9k stars | Tools in a WASM sandbox, capability permissions, **cryptographic tool receipts**, approval gates |
| **[Letta](https://github.com/letta-ai/letta)** (MemGPT) | Stateful-agent platform + Letta Code | Py/TS, Apache-2.0 | Self-editing memory blocks; "sleep-time" agents tidy memory while idle | 24.9k stars, active | Memory tiers, background consolidation |

### 4.3 Other long-running projects (status check)

- **Still healthy:**
  - **Home Assistant Assist** — mature; native llama.cpp in 2026.8; MCP server and client.
  - **n8n** — very active with personal-assistant templates, but source-available, not OSI open source.
  - **Dify** (157k stars) and **Open WebUI** (153k stars; has scheduled "Automations"; branding clause added to its license).
  - **Goose** — moved to the Linux Foundation's Agentic AI Foundation in Apr 2026.
  - **Agent Zero** (v1.20).
  - **AnythingLLM** (v1.16).
- **Faded or pivoted:**
  - **Khoj** — cloud **shut down 2026-04-15**; self-host only.
  - **Leon** — 2.0 has been a "developer preview" for years.
  - **Open Interpreter's 01 voice device** — dormant since Nov 2024; the main repo is now a coding agent.
  - **LibreChat** — acquired by ClickHouse; open source continues.
- **Cautionary tale:** **Moltbook** ("Reddit for agents"). Its database leaked ~1.5M agent tokens, and many "autonomous" posts turned out to be humans. Meta acquired it on 2026-03-10.

### 4.4 The "Claude Code as a personal OS" pattern

This is the pattern closest to this repo's DNA — it already runs on CLAUDE.md, skills, SESSION-CONTEXT.md and REMINDERS.md.

- **Daniel Miessler's PAI / "LifeOS"** (PAI 5.0, 2026-04-30) ([post](https://danielmiessler.com/blog/announcing-pai-5-life-operating-system)). Everything lives in `~/.claude/`:
  - `TELOS/` — mission, goals, beliefs
  - `MEMORY/` — WORK, LEARNING, and KNOWLEDGE (a typed graph of people, companies, ideas)
  - ~45 `Skills/`, each with `SKILL.md`, `Workflows/` and TypeScript CLI `Tools/`
  - **Deterministic TypeScript hooks** on every lifecycle event handle security, memory capture and mode classification
  - A "Pulse" daemon provides cron, a heartbeat, and iMessage/Telegram bridges
- **Teresa Torres** ([writeup](https://creatoreconomy.so/p/automate-your-life-with-claude-code-teresa-torres)) runs Claude Code over an **Obsidian vault**:
  - Context in three layers: a global `CLAUDE.md`, a `CLAUDE.md` per folder, and small reference files.
  - A `/today` command writes a dated to-do file (due today, overdue, in-progress ideas, a research digest).
  - Her thesis: *"Claude Code is only as good as what it knows about you."*
- **Obsidian "second brain" repos** — [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) (Karpathy's "LLM wiki" pattern), [second-brain-os](https://github.com/brkakyldz/second-brain-os) (git is the only database), [obsidian-second-brain](https://github.com/eugeniughelbur/obsidian-second-brain) (scheduled agents that tidy the vault).
- **Conventions these builders share** *(inferred)*:
  - Plain markdown + git as memory, not a vector DB.
  - Layered `CLAUDE.md` files.
  - `SKILL.md` folders for capabilities.
  - **Hooks rather than prompts for anything that must always happen.**
  - Dated daily logs.
  - One "brief" command as the killer app.

### 4.5 Community lessons

- **What people keep using:**
  - Morning brief / today list
  - Capture from the phone (a voice memo becomes a task or note)
  - Read-only inbox and calendar triage
  - Food/workout logging
  - A persistent-memory chat on the phone
  - Document-to-task chores
- **What people abandoned:**
  - Agents that send or delete email on their own
  - Marketplace skills
  - Always-on heartbeats running a premium model
  - Elaborate multi-agent setups
- **Recurring failure modes:**
  1. **Cost blowups** — context creep, full-history heartbeats, retries.
  2. **Unreliability** — false "done" reports; updates that break automations.
  3. **Prompt injection via email and web content.**
  4. **Safety rules that live only in the prompt get lost in compaction.**
  5. Over-permissioned agents with long-lived OAuth tokens.
  6. Supply-chain attacks (npm dependencies, skill registries).
  7. Maintenance burden (releases every few days).
  8. **Vendor policy whiplash** (see §5.2).
  9. The "model trains" hobby trap: a fun build with little lasting value.

## 5. Claude-native building blocks and subscription rules

This section matters most for this project. The plan is to spend **spare subscription usage**, and that only works on the surfaces the subscription is allowed to power.

### 5.1 How the limits work

- **Two limits.** A **5-hour session window**, plus a **weekly limit** that resets at a fixed day and time assigned to your account. Either one can stop you. See your reset time at `claude.ai/settings/usage` ([support 11049741](https://support.claude.com/en/articles/11049741)). *(verified)*
- **Unused weekly usage does not roll over.** You get a "full weekly allowance each cycle" *(inferred from the docs — no carry-over mechanism is described)*. Occasional "limit resets" are handed out to eligible plans ([support 17007452](https://support.claude.com/en/articles/17007452)).
- **One shared pool.** claude.ai, Cowork, Claude Code (CLI, desktop, web) and Routines all draw from the same limits. Cloud sessions have **no separate compute charge** ([cloud docs](https://code.claude.com/docs/en/claude-code-on-the-web)). AI-powered artifacts bill the **viewer's** plan. *(verified)*
- **Overflow.** Optional "extra usage" credits are billed at API rates, with a monthly cap you set. Routines can overflow onto them if you enable it ([support 12429409](https://support.claude.com/en/articles/12429409)). *(verified)*
- **The 5-hour window limits how fast you can spend.** With N hours left before the weekly reset, you get at most about ⌈N/5⌉ fresh windows. **A token dump has to start 1–2 days before the reset, not the last evening.** *(inferred)*

### 5.2 What the terms allow for automation

**Current policy text:**
- The **Consumer Terms** (effective 2025-10-08) ban automated access "through a bot, script, or otherwise," except via an API key "**or where we otherwise explicitly permit it**" ([consumer terms](https://www.anthropic.com/legal/consumer-terms)).
- The **Claude Code legal page** says:
  - Plan limits "assume **ordinary, individual usage of Claude Code and the Agent SDK**."
  - OAuth is for subscribers using "Claude Code and other native Anthropic applications."
  - Developers may not "route requests through Free, Pro, or Max plan credentials on behalf of their users" or "collect, store, or intermediate Claude.ai credentials."
  - It does not stop "an end user from signing in to the **unmodified Claude Code binary**" ([legal-and-compliance](https://code.claude.com/docs/en/legal-and-compliance)).
  
  *(verified 2026-09-25)*

**How the policy moved in 2026:**

| Date | Event |
|---|---|
| 2026-01-09 | Anthropic starts blocking subscription OAuth tokens outside the Claude Code CLI on the server side *(secondary)* |
| ~2026-02-20 | The legal page briefly banned subscription tokens in "any other product, tool, or service — **including the Agent SDK**." That sentence has since been removed |
| **2026-04-04** | Subscription limits cut off for **all third-party harnesses** (OpenClaw, NanoClaw, OpenCode…) ([TechCrunch via VentureBeat](https://venturebeat.com/technology/anthropic-cuts-off-the-ability-to-use-claude-subscriptions-with-openclaw-and)) |
| 2026-05-13 | Anthropic announces that from 06-15, the Agent SDK, `claude -p`, GitHub Actions and third-party apps will move to a separate monthly credit at API rates |
| **2026-06-15** | **Paused on launch day.** The Agent SDK, `claude -p` and third-party app usage "still draw from your subscription's usage limits." Anthropic promises advance notice before any future change ([support 15036540](https://support.claude.com/en/articles/15036540)) *(verified)* |

**Practical reading:**
- **Allowed:** Anthropic's own surfaces, including unattended scheduled runs (Routines, Cowork scheduled tasks, desktop tasks, `/loop`). Also `claude -p` and the Agent SDK under **your own login, for your own use**.
- **Not allowed:** pulling OAuth or session tokens out of Claude Code to call the API from your own code or proxy; offering claude.ai login inside an app; serving anyone else (a family bot on your plan); sharing the account.
- **Grey area:**
  - 24/7 high-frequency loops on the subscription — "ordinary, individual usage," plus Anthropic's discretion to cap.
  - Third-party harnesses on a subscription — allowed today, but reversed twice this year.
  - **Design so an API key can replace the subscription with a one-line change.**

### 5.3 Surfaces at a glance

| Surface | Billed to | Unattended / scheduled? | Gmail / Calendar / Drive? | Notes |
|---|---|---|---|---|
| **Routines** (Claude Code cloud) | Subscription + daily run cap | **Yes** — cron ≥1 h, one-off runs, API `/fire`, GitHub events | **Yes** (claude.ai connectors) | **Best first-party fit.** One-off runs don't count against the cap |
| Cowork scheduled tasks | Subscription | **Yes, in the cloud** (≥ hourly) | Yes | Merged with chat 2026-09-16; caps not documented |
| Cloud session with self-triggers (`create_trigger`, `send_later`) | Subscription | Yes (hourly; 1-min one-shots) | Yes | One long-lived "assistant session" is possible; its context relies on compaction |
| Desktop local scheduled tasks | Subscription | While the PC is awake (≥1 min) | Yes | Windows supported; local file access |
| `claude -p` / Agent SDK on your own login | Subscription (credit plan paused) | Yes (Task Scheduler / cron) | `/login` yes; `setup-token` **no** | "Individual use"; policy volatile |
| Channels (Telegram/Discord/iMessage plugins) | Subscription | Event-driven; **needs a persistent local process** | Local MCP | Research preview; iMessage needs a Mac |
| Remote Control | Subscription only | No — for steering a local session from your phone | Local | — |
| Dispatch | Subscription | No (desktop must be awake) | Yes | **Closed to new users** — "use Cowork in the cloud" |
| GitHub Actions (`claude-code-action`) | Subscription (`CLAUDE_CODE_OAUTH_TOKEN`) or API | Yes | **No** connectors with a setup-token | — |
| AI-powered artifacts | **Viewer's** plan | No (run only when opened) | Yes (paid plans) | 20 MB storage per artifact |
| Messages API / Batch / Managed Agents | API (Console) | Yes | Via your own OAuth / MCP / Apps Script | Your "always-on" layer if you need one |
| Third-party harness (OpenClaw etc.) | Subscription today | Yes | Depends | **Grey area** |

Sources: [routines](https://code.claude.com/docs/en/routines), [channels](https://code.claude.com/docs/en/channels), [remote-control](https://code.claude.com/docs/en/remote-control), [cloud-environments](https://code.claude.com/docs/en/cloud-environments), [Cowork scheduled tasks — support 13854387](https://support.claude.com/en/articles/13854387), [Dispatch — support 13947068](https://support.claude.com/en/articles/13947068). *(verified 2026-09-25)*

### 5.4 Routines in detail — the core scheduler for this project

**Triggers** ([docs](https://code.claude.com/docs/en/routines); [launch post](https://claude.com/blog/introducing-routines-in-claude-code), 2026-04-14):
- **Schedule** — hourly/daily/weekday/weekly presets, or custom cron via `/schedule update`. **Minimum interval is 1 hour**, and on-the-hour runs can start minutes late.
- **One-off** — runs at a timestamp. **Doesn't count against the daily cap.**
- **API** — `POST https://api.anthropic.com/v1/claude_code/routines/{id}/fire` with a bearer token and optional `text`. The payload arrives wrapped as untrusted data, so the saved prompt must opt in to acting on it. **Apps Script or GitHub Actions can fire routines.**
- **GitHub events** — PRs, releases.

**How runs behave:**
- **No permission prompts.** Every connector included on the routine can **write** — send email, delete events. Scope each routine to the connectors it actually needs, and switch off individual tools per connector at `claude.ai/customize/connectors`.
- **Daily run caps:** Pro 5 / Max 15 / Team 25 per the launch post. Current docs only say "see your current limits," so the numbers could have changed.

**Network:**
- The default **Trusted** allowlist does **not** include `api.telegram.org` or `script.google.com`. A routine that posts to Telegram or Apps Script needs a **Custom** environment that lists those hosts.
- MCP connector traffic is routed through Anthropic's servers, so connectors work even on Trusted.
- **GitHub traffic, MCP connector traffic and API-credential hosts bypass the environment allowlist entirely.** So a **Custom environment with a minimal (or empty) domain list** still lets a routine use git and its connectors while blocking all other egress ([cloud-environments](https://code.claude.com/docs/en/cloud-environments)). *(verified)* This is the tight configuration for routines that read untrusted content.
- Trusted is not zero-egress: its default list includes package registries, Docker Hub and `*.googleapis.com`.
- **API credentials** (Pro/Max) attach keys for hosts you list, so the session never sees the key. Environment variables are readable by anyone using the environment.

**State:**
- **Claude Code auto memory is machine-local** — it isn't shared with cloud environments ([memory docs](https://code.claude.com/docs/en/memory)).
- **A cloud assistant must keep its state in repo files, Drive, or Sheets.**

**Reported by one builder** ([anothercodingblog, 2026-04-25](https://www.anothercodingblog.com/p/i-built-a-daily-brief-with-claude)): connectors must be loaded explicitly, and API-triggered runs loaded connectors inconsistently. *(secondary)*

### 5.5 API-side prices (for anything that must run 24/7 outside the subscription)

| Model | ID | Input $/MTok | Output $/MTok |
|---|---|---|---|
| Fable 5.1 (top) | `claude-fable-5-1` | 10 | 50 |
| Opus 5.5 | `claude-opus-5-5` | 4 | 20 |
| Sonnet 5 | `claude-sonnet-5` | 2 | 10 |
| Haiku 4.5 | `claude-haiku-4-5` | 1 | 5 |

- **Discounts and extras:** Batch API is 50% off. Cache reads are 0.1× input. Web search is $10 per 1,000. **Managed Agents** cost tokens + $0.08/session-hour, with scheduled deployments, memory stores and credential vaults ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)). *(verified 2026-09-25)*
- **Rough cost of a light always-on layer on the API:**
  - Haiku classification, ~50–200 calls/day, ≈ $5–6/mo.
  - A Sonnet daily brief ≈ $2/mo.
  - Sonnet chat, ~30 messages/day, ≈ $12/mo.
  - **Total ≈ $7–25/month** depending on chat volume *(inferred arithmetic)*.

### 5.6 How to extend Claude Code

- `CLAUDE.md` + path-scoped rules
- Output styles — turn the engineer persona into an assistant persona
- **Skills** — the unit of capability, shared across claude.ai, Cowork and Code
- Subagents
- **Hooks** — deterministic enforcement on lifecycle events
- MCP servers / claude.ai connectors
- Plugins and marketplaces (channels ship as plugins)
- Cross-session messaging ([features overview](https://code.claude.com/docs/en/features-overview))

The common persistent-assistant pattern *(inferred)*: **a private "assistant" repo** (persona in CLAUDE.md, skills for triage and brief, state files as memory) plus **Routines** on a schedule with narrowly scoped connectors. This repo already follows the same pattern for its own session context (SESSION-CONTEXT.md, REMINDERS.md, skills).

## 6. Technical building blocks

### 6.1 Memory — plain files are competitive

**Evidence:**
- **Letta:** an agent that simply stored history in files and searched them with ordinary file tools scored **74.0% on LoCoMo**, beating Mem0's reported 68.5%. Letta's conclusion: *"memory is more about how agents manage context than the exact retrieval mechanism"* ([Letta](https://letta.com/blog/benchmarking-ai-agent-memory)). *(verified)*
- **Zep:** putting the whole conversation in context scores ~73% on LoCoMo — so that benchmark is too easy to tell systems apart (Zep engineering blog, "Lies, damn lies, statistics", 2025-05).
- **Vendor headline scores** (Mem0 92.5 LoCoMo / 94.4 LongMemEval; Supermemory "SOTA") are self-reported. One comparison found no system won more than 3 of 8 dimensions.

| Option | What it is | Fit for one person |
|---|---|---|
| **Markdown in a private git repo** (the OpenClaw / PAI / Hermes pattern) | Always-loaded profile file + one note per entity + append-only daily logs | **Best default** — inspectable, diffable, rollback-able, portable |
| **Anthropic memory tool** (`memory_20250818`) | Claude calls view/create/str_replace/insert/delete/rename on `/memories`; your code decides where files live | Excellent API-side primitive, backed by the same git folder |
| **Basic Memory (MCP)** | One markdown note per entity, holding observations and wiki-link relations; opens directly as an Obsidian vault | Very good for people and projects |
| **Letta** | Pinned memory blocks + archival/recall memory; "sleep-time" agents consolidate memory while idle | Good ideas, heavier runtime |
| **Zep / Graphiti** | Temporal knowledge graph ("what was true when") | Only if temporal queries become a real need; a graph database is ongoing work |
| **Mem0 / OpenMemory, Cognee, Supermemory** | Fact extraction + vector/graph retrieval; Supermemory is hosted | Fast to adopt, but hides what was stored and why |

**Recommended shape** *(inferred)*:
1. `profile.md` — always in context, **capped at ~3–5k tokens**. Hermes caps its memory files at ~2.2k and ~1.4k characters.
2. `people/`, `projects/`, `places/` — one note per entity.
3. `log/YYYY-MM-DD.md` — append-only daily logs.
4. Raw archives kept separate.
5. Search with ripgrep first; add SQLite full-text search or `sqlite-vec` only when grep stops being enough.
6. Git gives an audit trail and rollback when a bad memory write gets in.

### 6.2 Personal data ingestion (Windows + Google)

- **Gmail:** Apps Script polling is simplest. Push notifications through Gmail API `watch` + Pub/Sub arrive in 1–10 s but need a GCP project and renewal every 7 days ([Gmail push](https://developers.google.com/workspace/gmail/api/guides/push)). The claude.ai Gmail/Calendar/Drive connectors already cover on-demand reads inside Claude.
- **Meetings:** the existing local Whisper pipeline (`scripts/transcribe.ps1`) is already the best transcript source. For live turn-by-turn voice, **Parakeet TDT 0.6B v3** is faster (~6.3% vs ~7.8% word error rate on English). *(secondary)*
- **Screen capture:**
  - **Screenpipe** runs on Windows with local SQLite + MCP, ~5–10 GB/month. Now source-available, free for personal use.
  - Microsoft Recall exposes no snapshot API. *(secondary)*
- **Finance (US):** **SimpleFIN Bridge** — $15/yr, read-only, 24 requests/day — is the practical option for an individual. Plaid production access is sales-led. *(secondary)*
- **Health:** the legacy Fitbit Web API is reported to shut down Sept 2026, with migration to the Google Health API. Google Takeout is the fallback. *(secondary)*
- **Browser history:** Chrome's local SQLite `History` file (copy it first — it's locked while Chrome runs).

### 6.3 Interfaces / channels, ranked for a solo builder on this stack

| Rank | Channel | Effort | Cost | Reliability | Notes |
|---|---|---|---|---|---|
| 1 | **Telegram bot** | Very low | Free | High | Official API; replies stream (`sendMessageDraft`); voice notes; **inline buttons for approve/deny**; official Claude Code Channels plugin. Not end-to-end encrypted |
| 2 | **AutoHotkey hotkey** | Very low | Free | High | Selection/clipboard/push-to-talk → local daemon or Apps Script. Desktop only |
| 3 | **GitHub Pages PWA** (backed by the existing Apps Script session auth) | Medium | Free | High | Best as a **dashboard + approvals queue**, not a chat UI. Apps Script can't stream |
| 4 | **Email to yourself** (`you+assistant@`) | Low | Free | Medium | 5–15 min latency, no buttons, counts toward 100 recipients/day. Good fallback |
| 5 | Discord bot | Low–Medium | Free | High | **Doesn't fit Apps Script**: needs a persistent gateway socket, or header signature checks Apps Script can't read |
| 6 | Signal (`signal-cli`) | Medium | Free | Medium | Best privacy; the daemon can go "half-open" silently |
| 7 | SMS (Twilio) | Medium | ~$20 setup + per-message fees | Medium | A2P 10DLC registration |
| 8 | iMessage | High | A Mac | Medium | macOS only — skip on Windows |
| 9 | WhatsApp | High | — | **Poor** | Meta has **banned general-purpose AI chatbots from the Business API since 2026-01-15**; unofficial bridges risk account bans. **Avoid** |

Sources: [Telegram Bot API](https://core.telegram.org/bots/api) · [Telegram API changelog](https://core.telegram.org/bots/api-changelog) · [Claude Code Channels](https://code.claude.com/docs/en/channels) · TechCrunch on the WhatsApp Business API policy (2025-10-18).

### 6.4 Voice

- **Latency target:** ~800 ms median voice-to-voice (1.5 s is fine for a prototype). Typical budget: speech-to-text 100–200 ms + LLM 300–500 ms + text-to-speech 100–200 ms. **Pipecat** (Python) and **LiveKit Agents** are the open-source frameworks ([Pipecat benchmarks](https://pipecat.ai/benchmarks)).
- **Claude has no public real-time speech API.** A voice pipeline is speech-to-text → Claude → text-to-speech. Speech-to-speech APIs: OpenAI gpt-realtime (~$0.06–0.11/min) and Gemini Live (much cheaper). *(secondary)*
- **Text-to-speech options:**
  - Local: Kokoro (82M parameters, CPU), Chatterbox (voice cloning).
  - Hosted: Cartesia Sonic (~80 ms to first audio), ElevenLabs Flash.
- **Wake word:** openWakeWord (free). **On a Windows desktop, an AutoHotkey push-to-talk key is better than always listening.**
- **Pragmatic path:**
  1. **Asynchronous voice first** — Telegram voice note → local Whisper/Parakeet → Claude → text reply (optional Kokoro audio).
  2. Add real-time voice only if you actually want to talk to it.

### 6.5 Hosting and scheduling, ranked

| Rank | Option | Cost | Reliability | Notes |
|---|---|---|---|---|
| 1 | **Claude Code Routines** | Included | Medium–High | Heavy reasoning on a schedule (≥1 h) or on API trigger; research preview; daily run cap |
| 2 | **Apps Script time triggers** | Free | High | Native Gmail/Calendar/Drive; **90 min/day of trigger runtime on consumer accounts, 6 min per run**; minute-level triggers |
| 3 | **Cloudflare Workers + Agents SDK** | $5/mo | High | Durable Objects sleep for free and wake on alarms, webhooks or email — ideal as an always-on router *if* Apps Script's limits bite |
| 4 | Your Windows PC (Task Scheduler) or a ~$150–300 mini-PC | Power | Medium | Needed for local Whisper/Ollama and Claude Code Channels |
| 5 | n8n | Free self-hosted / €20+ cloud | Medium–High | Visual integrations; overlaps with Apps Script |
| 6 | Fly.io | ~$2–6/mo | High | Free allowance gone |
| 7 | Oracle Always Free | Free | **Low** | Arm allowance quietly halved 2026-06-15; idle instances reclaimed |
| 8 | **GitHub Actions cron** | Free | **Low** | Officially best-effort; runs **4–12 h late or dropped since 2026-08-26**; public repos auto-disable after 60 days idle. **Use `workflow_dispatch` instead of cron** |

Sources: [Routines docs](https://code.claude.com/docs/en/routines) · [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) · [Cloudflare Agents](https://developers.cloudflare.com/agents/) · [GitHub Actions events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) · [community discussion on the cron delays](https://github.com/orgs/community/discussions/207346).

### 6.6 Local models on the NVIDIA GPU

- **Good local jobs:**
  - Bulk low-stakes classification (pre-filtering email before a frontier model sees it)
  - PII-sensitive summarization
  - Embeddings
  - Transcription
- **Candidate models (2026)** — Ollama library pages exist for these; the benchmark rankings are unverified *(secondary)*:
  - **Qwen3.6-27B** — best dense pick for a 24 GB card.
  - **Gemma 4** — 12B/26B tags; the 26B MoE is the fastest.
  - **gpt-oss:20b** — fits a 16 GB card.
- Home Assistant users report that ~9B Qwen models call tools reliably.
- **Use frontier models for synthesis and judgment.**

## 7. Security for agents that touch your life

### 7.1 Frameworks

- **The lethal trifecta** (Simon Willison): **private data + untrusted content + a way to communicate externally.** Any agent holding all three can be made to exfiltrate data ([post](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)).
- **Meta's "Agents Rule of Two"** (2025-10-31): within one session, an agent should have at most two of:
  - (A) untrusted input
  - (B) sensitive data or systems
  - (C) the ability to change state or communicate externally
  
  Meta's own worked example is an email bot ([Meta AI](https://ai.meta.com/blog/practical-ai-agent-security/)).
- **CaMeL** (Google DeepMind): a privileged model plans only from the user's request; a quarantined model reads untrusted data and has no tools; capability tags enforce data-flow policy at every tool call. Provably secure on 77% of AgentDojo tasks ([arXiv 2503.18813](https://arxiv.org/abs/2503.18813)). There are few production implementations, but **the two-lane idea is cheap to copy.**

### 7.2 Incidents that map directly onto a personal assistant

| When | Incident | Lesson |
|---|---|---|
| 2025-06 | **EchoLeak** (CVE-2025-32711, CVSS 9.3) — a zero-click email made M365 Copilot leak data | Classifiers alone don't stop injection |
| 2025-08 / 2026-01 | **Gemini calendar-invite attacks** — a malicious invite controlled smart-home devices; later, private meetings leaked by writing them into a new event | **Calendar invites from other people are untrusted input** |
| 2025-09 | **postmark-mcp** — first malicious MCP server; after 15 clean versions it silently BCC'd every email to the attacker | Pin versions; read the source; prefer first-party connectors |
| 2026-01 | **Superhuman AI** — an injected email exfiltrated dozens of other emails via Google Forms GET requests to an allowlisted domain | **"Trusted" domains that accept writes are exfiltration channels** |
| 2026-01 | **Claude Cowork** — injection uploaded user files to the *attacker's* Anthropic account via the allowlisted Files API | Same lesson, on Anthropic's own domain |
| 2026-02 | **Claude Desktop Extension** — a Calendar event led to code execution through a local MCP server | Local tool servers widen the attack surface |
| 2026 | **OpenClaw** CVEs, 800+ malicious ClawHub skills, an inbox mass-deleted after compaction dropped a safety instruction | No marketplace skills; **enforce safety in code, not prompts** |
| 2026-03 | **LiteLLM on PyPI** — credential stealer shipped after the attackers first compromised the Trivy scanner in its build pipeline | Supply chain: lockfiles, update delay |

Sources: [Simon Willison — lethal trifecta tag](https://simonwillison.net/tags/lethal-trifecta/) · [Superhuman](https://simonwillison.net/2026/Jan/12/superhuman-ai-exfiltrates-emails/) · [Cowork](https://simonwillison.net/2026/Jan/14/) · postmark-mcp (Postmark and Snyk advisories, 2025-09) · [The Hacker News](https://thehackernews.com/2026/03/openclaw-ai-agent-flaws-could-enable.html).

### 7.3 A defensive architecture for a personal assistant *(inferred, built from the patterns above)*

1. **Two lanes.**
   - The **Reader** lane handles email, web pages and other people's calendar invites. It has **no side-effect tools and no network egress**, and emits only schema-constrained JSON (labels, dates, summaries, proposed actions).
   - The **Actor** lane has tools, but acts only on instructions from **you** (an allowlisted Telegram user ID or hotkey). It treats Reader output as data.
2. **Drafts by default.**
   - Every outbound action — send, forward, delete, pay, share, invite — becomes a pending action that **you approve with a button showing the exact payload.**
   - In routines that read inbound mail, **switch off** Gmail send/forward/trash and Calendar delete per connector.
3. **Deterministic policy outside the LLM.** Recipient allowlist, trash-not-delete, spend caps, rate limits — enforced in Apps Script code, not prompts.
4. **Tight egress.** Custom network allowlists for routines. Never auto-render model-produced Markdown images or links in the dashboard. Keep a Content Security Policy.
5. **Secrets.**
   - Apps Script Script Properties; Windows Credential Manager/DPAPI; routine API credentials rather than environment variables.
   - Narrow OAuth scopes (`gmail.readonly` separate from `gmail.compose`).
   - **Never in prompts, memory files, or this public repo.**
6. **Supply chain.** First-party connectors first. Pinned, read, locked dependencies. **No skill or MCP marketplaces.**
7. **Audit and memory hygiene.**
   - Append-only log of every tool call with its trigger source.
   - Memory in git, so every change is a diff.
   - **Memory writes that come from untrusted content go to a `quarantine/` folder you review**, because anything in memory becomes part of future prompts.

## 8. Which functions actually deliver value

### 8.1 What the evidence says

1. **Lasting value comes from surfacing your obligations. Organizing things doesn't last.**
   - The functions people keep all answer *"what do I owe, and by when?"* — a bill due, a missing RSVP, a meeting someone declined, a return window closing, a cancelled event.
   - Tagging and tidying for its own sake gets called "productivity theater": *"the reason they were in that state to begin with is because you don't inherently derive value from their organization"* ([HN](https://news.ycombinator.com/item?id=46760237), 2026-01).
2. **The proactive feed failed; scheduled, steerable jobs survived.**
   - OpenAI's lesson from sunsetting Pulse: proactive experiences work best when *"personalised, action-oriented, and steerable by the user"* ([digit.in](https://www.digit.in/news/general/openai-is-retiring-chatgpt-pulse-and-replacing-it-with-scheduled-tasks-here-is-why.html)).
   - A CHI 2025 study of 398 proactive interventions: 53% engaged, 12% disruptive, 35% ignored. "Persistent suggest" was rated annoying ([arXiv 2502.18658](https://arxiv.org/pdf/2502.18658)).
3. **Reliability and cost kill DIY assistants more often than capability limits do.**
   - An OpenClaw morning debriefer *"worked maybe once or twice a week and broke every other morning, telling me that it fixed itself"* and cost ~$40–50 in a week.
   - The durable pattern: *"I use agents to build reliable scripts which are then automated… as simple and predictable as possible"* ([Ask HN](https://news.ycombinator.com/item?id=47783940), 2026-04).
4. **Delivery channel beats features.** Poke's edge is that you text it. Couples' shared Telegram bots and family morning texts are among the longest-lived setups ([HN](https://news.ycombinator.com/item?id=44373724)).
5. **Trust comes in steps: reading, then drafting, then acting.** Menlo 2026 (n=5,067):
   - 36% have given agents email access, 27% calendar, 20% financial accounts.
   - Only ~23% use AI to pay bills or navigate healthcare.
   
   ([Menlo](https://menlovc.com/perspective/2026-the-state-of-consumer-ai/), 2026-09-16)
6. **Timing:** Claude's personal-use traffic is ~35% on weekdays and ~50% on weekends. **News requests peak at 7am**, which supports a morning brief ([Anthropic Economic Index](https://www.anthropic.com/research/economic-index-june-2026-report), June 2026).
7. **Value depends on how much you receive.** *"The average person is not getting more than 1 relevant personal email per week"* — but parents get ~5 school emails a day. **Measure your own inbound load before building triage.**
   
   The builder's real advantage is the long tail — *"there are 20 of these random things per year"* (contractor, insurer, building manager) that no product serves ([HN](https://news.ycombinator.com/item?id=49615537), 2026-09).

### 8.2 Scored function catalog

Value and Feasibility are 1–5. Side-effect risk and batch fit are L/M/H. Scores assume a solo builder on Google + Windows + a Claude subscription, whose day job involves client meetings.

| Function | Value | Feasibility | Side-effect risk | Batch fit | Evidence / notes |
|---|---|---|---|---|---|
| **Obligations ledger** (deadlines, commitments, bills, RSVPs, return windows pulled from email + calendar) | 5 | 4 | L | **H** | The engine every other view reads from ([HN](https://news.ycombinator.com/item?id=46760237)) |
| Morning brief (fixed time, action items only) | 4 | 5 | L | M | The most common agent use case. Dies when it breaks silently or fills with generic news |
| Week-ahead brief (Sunday night) | 4 | 5 | L | **H** | Poke's Sunday summary was well liked; natural batch job |
| Task capture from anywhere (voice / text / hotkey) + evening nag / rollover | 5 | 4 | L | L | Todoist Ramble had ~290k voice sessions in 3 weeks. **Make the scheduling deterministic** — models "forget" or double-run rollovers |
| **Meeting prep dossiers** (attendee, company and prior-thread brief) | **5** for client-facing work | 4 | L | **H** | Salesforce: sellers spend ~40% of their time selling and expect agents to cut prospect research 34%. Tolerant of delay and parallel |
| Email triage + labels + priority alerts | 4 | 4 | M | **H** | Complaints: *"bury something urgent while forwarding something trivial."* **Needs an eval set built from your own archive** |
| Draft replies (never auto-send) | 4 | 4 | M | M | Matches the proven "edit my own text" habit (~⅔ of ChatGPT writing requests) |
| Weekly review / life dashboard | 4 | 5 | L | **H** | Daily→weekly→monthly rollups keep coming up as the pattern that lasts |
| Alert-on-change watchers + recurring research digests | 4 | 4 | L | M | Loved *only* when silent unless something changed |
| Life-admin documents (receipts, bills, warranties, return windows, subscription audit) | 4 | 4 | L | **H** | A one-time audit of receipts in email found ~$2.6k/yr in subscriptions *(single source)* |
| On-demand deep research | 4 | 5 | L | **H** | Mostly *buy* (Claude Research); build only saved recurring templates |
| Background coding agent on your own repos | 4 | 5 | **M** — this repo auto-merges and deploys `claude/*` | **H** | Best use of spare tokens is improving the assistant itself, gated by evals |
| Meeting transcription → notes → action items → follow-ups | 4 | 3 | M (consent, employer policy) | M | Buy or reuse capture (you already have Whisper); build only the post-processing |
| Personal CRM ("who's gone quiet", birthdays) | 3 (4 for client work) | 4 | L read / **H** if it does outreach | **H** backfill | Suggest, never send — HN is strongly against auto-outreach |
| Second-brain Q&A | 3 | 4 | L | **H** | Agent-written wiki entries become *"confidently wrong"*; keep human-reviewed promotion |
| Expense categorization | 3 | 3 | L | **H** | Rules first, LLM for leftovers; parse bank-alert emails |
| Health / habits | 3 | 4 | M | L | Photo calorie estimates are ~36% off (mean absolute error); chat logging stuck for some users |
| Learning / flashcards from notes | 3 | 4 | L | **H** | A nightly flashcard job is a well-liked pattern |
| Travel itinerary from confirmation emails | 3 | 4 | L (parse) / H (book) | M | Build parsing and dossiers; **never booking** |
| Scheduling negotiation / shared-calendar writes | 3 | 2 | **H** | L | Claire Vo's first agent **deleted her family calendar**. Postpone |
| Journaling prompts | 2–3 | 5 | L | L | Reflection is ~1.9% of ChatGPT use; add as a line in the evening nag |
| Price / deal watching | 2 | 4 | L | L | Existing deterministic trackers already do this |
| Home automation | 2 | 3 | M | L | Latency; an XDA author turned the LLM off for ~95% of commands |

### 8.3 Proactivity design rules *(inferred from the evidence)*

1. **Fixed, predictable times** (morning, evening, Sunday). Interrupt in real time only for high-precision, time-critical items.
2. **Every item needs a verb and a deadline.** Drop anything you can't act on.
3. **A one-tap "useless" button on every item.** Review precision weekly, and auto-pause jobs nobody opens.
4. **Silence is the default.** Watchers message only on change. A heartbeat replies `HEARTBEAT_OK` and stays quiet.
5. **Never send an "I fixed it, it won't happen again" message** from a broken job. Fail loudly to a log and a dashboard instead.

### 8.4 Workloads that suit spending spare tokens

What they have in common: tolerant of delay, easy to parallelize, better with a bigger model or multiple passes, and **valuable long after the run.**

1. **Backfill the email archive into structured tables** — contacts, commitments, subscriptions, receipts, warranties, recurring senders. This feeds the ledger, CRM and audits.
2. **Gold-standard eval sets.** A strong model labels ~500–2,000 historical emails with multiple passes and disagreement checks. Cheap rules, Apps Script filters or a **local GPU model** are then tuned against that set. **This is the highest-leverage use of spare tokens: it makes the real-time path cheap, deterministic and measurable.**
3. **Week-ahead meeting dossiers.**
4. **Recurring deep-research digests** — what changed since the last run, with citations.
5. **Knowledge rollups and "wiki lint"** — contradiction and staleness checks.
6. **Finance / life-admin sweeps** — monthly categorization, subscription audit, gathering tax documents.
7. **Building and red-teaming the assistant** — backlog coding, replaying last week's inputs, sending prompt-injection test emails at the reader lane.
8. **Learning pipelines** — flashcards, reading-list digests.

**Keep out of batch** anything that sends, pays, books, or edits shared calendars. Batch output is drafts, tables and reports.

## 9. Feasibility on this repo's stack

### 9.1 Repo-specific findings — read these first

- **This repo (`LightAISolutions/Personal`) is PUBLIC.** Confirmed via the GitHub API on 2026-09-25 (`"visibility": "public"`). That makes the following world-readable:
  - Every commit
  - Actions logs and artifacts
  - The GAS source, which the framework auto-pulls from GitHub
  - The Pages site
  
  **Personal data, personal prompts, persona files and memory must never be committed here.** They belong in a **separate private repo** and/or private Google storage (Sheets/Drive), with secrets in Script Properties.
- **No GAS project is deployed yet.** Every `googleAppsScripts/*/*.config.json` still has the `YOUR_DEPLOYMENT_ID` placeholder, so there is no live `/exec` endpoint to build on.
- **The framework's `doPost` doesn't fit a Telegram webhook.** It must keep `action=deploy` unauthenticated (a repo rule) and responds via `ContentService`, which answers POSTs with a 302. **Build the assistant as its own GAS project**, not as routes added to the framework apps.
- The existing auth/session layer (HMAC tokens, CacheService, Global ACL) **can be reused** to put a private dashboard on Pages. It uses its own tokens rather than Google cookies, so it should work inside an installed PWA *(inferred — test iOS standalone mode)*.

### 9.2 Key limits

| Limit | Value | Source |
|---|---|---|
| GAS runtime per execution | 6 min | [quotas](https://developers.google.com/apps-script/guides/services/quotas) |
| GAS **trigger** total runtime (consumer) | **90 min/day** (Workspace 6 h). Web-app `doPost`/`doGet` executions appear not to count *(inferred)* | quotas |
| GAS UrlFetch calls / timeout | 20,000/day · **~60 s hard timeout, no streaming** | quotas; [Poehnelt guide](https://justin.poehnelt.com/posts/definitive-guide-to-urlfetchapp/) |
| GAS Gmail read/write · email recipients | 20,000/day · **100 recipients/day** (consumer) | quotas |
| GAS simultaneous executions | 30 per user, shared across all your scripts | quotas |
| GAS triggers | 20 per user per script; `everyMinutes(1/5/10/15/30)`; `atHour` jitters ±15 min | [clock triggers](https://developers.google.com/apps-script/reference/script/clock-trigger-builder) |
| GAS Properties / Cache | 9 KB/value, 500 KB/store · 100 KB/value, 6 h max TTL | quotas; [CacheService](https://developers.google.com/apps-script/reference/cache/cache) |
| GAS `doPost` event object | **No request headers** — can't verify Telegram's `secret_token` header or Discord signatures | [web apps guide](https://developers.google.com/apps-script/guides/web) |
| Telegram message / file | 4,096 chars · `getFile` ≤ 20 MB, link valid 1 h · `callback_data` ≤ 64 bytes | [Bot API](https://core.telegram.org/bots/api) |
| Actions cron | ≥5 min, best-effort, may be dropped; delayed 4–12 h since 2026-08-26; 60-day disable on idle public repos | [events docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) |
| Actions jobs / free minutes | 6 h/job · 2,000 min/month for private repos on the Free plan | [limits](https://docs.github.com/en/actions/reference/limits) |
| Pages | 1 GB site, 100 GB/month bandwidth, no sensitive transactions | [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| Web Push from GAS | **Not possible** — no ECDSA P-256 in `Utilities` | [Utilities reference](https://developers.google.com/apps-script/reference/utilities/utilities) |
| iOS Web Push | Home Screen web apps since iOS 16.4; Declarative Web Push in 18.4 | [WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/) |

### 9.3 Known gotchas and workarounds

- **Telegram → GAS webhook returns 302.** `ContentService` output redirects, Telegram treats the 302 as failure, and it retries — so you get duplicates. Return `HtmlService.createHtmlOutput("OK")` instead, which answers 200. Send replies with explicit `sendMessage` calls *(community fix, secondary)*.
- **No headers means an alternative auth check.** Put a long random secret in the webhook URL query, check `e.parameter.k`, and **allowlist your Telegram `from.id`**.
- **Reply fast, work later.** `doPost` validates, dedupes on `update_id`, enqueues and returns within 1–3 s. A 1–5 min worker trigger does the LLM work. Use LockService around the queue and a CacheService dedupe key as backstop.
- **The ~60 s UrlFetch cap.** Keep synchronous Claude calls short (Haiku/Sonnet, low effort, ~1–2k max tokens). Anything long goes to the **Batch API** (submit in one trigger, collect in a later one) or a **routine `/fire`**.
- **The 7-day OAuth refresh-token expiry** hits Apps Script projects linked to a user-managed GCP project whose consent screen is in "Testing": triggers silently die after a week. **Publish the consent screen to Production, or keep the assistant on the default GCP project.** *(secondary; applicability inferred)*
- **Routines need a Custom network environment** to reach `api.telegram.org` or `script.google.com`.
- **GitHub Actions: use `workflow_dispatch`, not cron.** Dispatch jobs from Apps Script and run them in a **private** repo. Pass a job ID, not data; the runner fetches its payload from a token-gated GAS endpoint.

### 9.4 Where each piece fits

| Layer | Job | Why here |
|---|---|---|
| **Apps Script** (new `assistant-core` project) | The clock; the webhook intake; the queue; native Gmail/Calendar/Drive reads, labels and drafts; **executing approved actions**; short Haiku/Sonnet API calls; Batch submit/poll | Free, always on, Google-native, deterministic |
| **Claude Code Routines** (subscription) | Morning/weekly briefs, meeting dossiers, deep research, backfills, eval building, coding the assistant | Heavy reasoning at no marginal cost; unattended; connectors built in |
| **Private GitHub repo** | Memory + persona + skills + state files; home of the routines; `workflow_dispatch` Python jobs | Git-versioned memory; private |
| **Telegram bot** | Chat, notifications, approve/deny buttons, voice notes | Lowest-effort reliable channel with buttons |
| **Windows PC** | AutoHotkey hotkeys → local Python daemon (Task Scheduler) → Whisper + Ollama; pulls local jobs from GAS | Private, free compute on the GPU; desktop reach |
| **GitHub Pages PWA** (this repo) | Dashboard + approvals queue — a data-free public shell that fetches everything from GAS after auth | Reuses the existing auth framework |

Developed by: LightAISolutions
