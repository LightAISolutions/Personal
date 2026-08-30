#!/usr/bin/env node
/**
 * build-study-prep-pdf.mjs — typesets a study-prep Markdown brief to PDF.
 *
 * The Markdown file stays the single source of truth: this script parses it and
 * renders it, so the PDF cannot drift from the document you actually edit. That
 * is the difference from scripts/build-aidc-report-pdf.mjs, whose source was
 * authored as HTML in the first place.
 *
 * Presentation is the `bloomberg` export skin from PROFILER-STYLES.md — the same
 * look the canonical AIDC report PDF carries — reproduced here as a single fixed
 * skin rather than the five-way switch that report uses. A prep document is not
 * a customer deliverable, so it does not need to be issuable in every registered
 * writing style, and staying out of the registry keeps this script off the
 * "mirror every skin change" hook.
 *
 * Rendering drives the pre-installed Chromium (PLAYWRIGHT_BROWSERS_PATH) over the
 * DevTools Protocol, because only Page.printToPDF accepts a running header and
 * footer — the --print-to-pdf CLI flag cannot. No npm dependencies: Node 22 ships
 * a global WebSocket.
 *
 * Usage: node scripts/build-study-prep-pdf.mjs [<doc-key>] [--keep-html]
 *        no doc-key    builds every document in DOCS
 *        --keep-html   also writes the intermediate HTML next to the PDF
 *
 * Register a new prep document by adding an entry to DOCS below.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, readdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9334; // distinct from build-aidc-report-pdf.mjs so both can run at once

// ── Document registry ──────────────────────────────────────────────────────
// `src`/`out` are repo-relative. The masthead fields are what the Markdown
// cannot carry: the H1 becomes `title`, everything else is stated here so the
// document body does not have to open with metadata a reader would skim past.
const DOCS = {
  'megmeet-interview-brief': {
    src: 'repository-information/study-prep/megmeet/megmeet-interview-brief.md',
    out: 'repository-information/study-prep/megmeet/MEGMEET-INTERVIEW-BRIEF.pdf',
    kick: 'Profiler Study Prep · Interview Preparation',
    sub: 'What they make, where they stand, the objections you carry, and what to ask',
    meta: [
      '<b>Prepared</b> 14 August 2026 &nbsp;·&nbsp; <b>Source</b> megmeet.profile.json, profileVersion 2 '
        + '(updated 2026-08-09) &nbsp;·&nbsp; <b>Companion</b> megmeet-lesson-plan.md, which teaches the physics',
      '<b>Sourcing</b> Every claim traces to the dossier; analytical reads are labelled as reads '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — interview preparation',
    ],
    banner: '<b>Presentation style</b> — BloombergNEF Research Report, the canonical Profiler export skin. '
      + 'Facts lead, labelled analysis follows, and the two never blur.',
    runHead: 'Built from the Profiler dossier set · Prepared 14 August 2026',
    runFoot: 'Megmeet — Interview Brief (Sales Role) · Internal, interview preparation',
  },
  'hithium-interview-brief': {
    src: 'repository-information/study-prep/hithium/hithium-interview-brief.md',
    out: 'repository-information/study-prep/hithium/HITHIUM-INTERVIEW-BRIEF.pdf',
    kick: 'Profiler Study Prep · Interview Preparation',
    sub: 'Round 3 — the room, the numbers, the regulatory stack, and what to ask',
    meta: [
      '<b>Prepared</b> 15 August 2026 &nbsp;·&nbsp; <b>Source</b> hithium.profile.json, profileVersion 3 '
        + '(updated 2026-08-09), plus regulatory and biographical research verified 2026-08-15 '
        + '&nbsp;·&nbsp; <b>Companion</b> hithium-lesson-plan.md, which teaches the electrochemistry',
      '<b>Sourcing</b> Every claim traces to the dossier or a verified source; analytical reads are labelled as reads '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — interview preparation',
    ],
    banner: '<b>Presentation style</b> — BloombergNEF Research Report, the canonical Profiler export skin. '
      + 'Facts lead, labelled analysis follows, and the two never blur.',
    runHead: 'Built from the Profiler dossier set · Prepared 15 August 2026',
    runFoot: 'Hithium — Interview Brief (Sales Role, Round 3) · Internal, interview preparation',
  },
  'hithium-strategy-addendum': {
    src: 'repository-information/study-prep/hithium/hithium-strategy-addendum.md',
    out: 'repository-information/study-prep/hithium/HITHIUM-STRATEGY-ADDENDUM.pdf',
    kick: 'Profiler Study Prep · Interview Preparation',
    sub: 'What to propose, the honest AIDC read, and what to ask',
    toc: false, // one-page reference sheet — a contents block costs more space than it returns
    meta: [
      '<b>Prepared</b> 15 August 2026 &nbsp;·&nbsp; <b>Companion</b> hithium-interview-brief.md, which is the full reference '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — interview preparation',
      '<b>Sourcing</b> Market facts are sourced; the layer analysis, the weak AIDC grading and the sell-to-the-grid '
        + 'reframe are labelled analysis, not sourced conclusions',
    ],
    runHead: 'Strategy addendum to the Hithium interview brief · Prepared 15 August 2026',
    runFoot: 'Hithium — Strategy Addendum (Sales Role, Round 3) · Internal, interview preparation',
  },
  'hithium-ic-playbook': {
    src: 'repository-information/study-prep/hithium/hithium-ic-playbook.md',
    out: 'repository-information/study-prep/hithium/HITHIUM-IC-PLAYBOOK.pdf',
    kick: 'Profiler Study Prep · Sales Strategy',
    sub: 'The account executive’s working document: where to hunt, the one-call qualification, the objection table, and the Jupiter defense',
    meta: [
      '<b>Prepared</b> 24 August 2026 &nbsp;·&nbsp; <b>Sources</b> hithium.profile.json profileVersion 5 · the relationship-web '
        + 'deliverable · the three Industry Guidance analyses &nbsp;·&nbsp; <b>Companion</b> hithium-team-lead-playbook.md, '
        + 'which sets the territory strategy',
      '<b>Sourcing</b> Market facts trace to the dossier base and the guidance claims ledgers; analytical reads are labelled as reads '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — sales strategy',
    ],
    banner: '<b>Presentation style</b> — BloombergNEF Research Report, the canonical Profiler export skin. '
      + 'Facts lead, labelled analysis follows, and the two never blur.',
    runHead: 'Built from the Profiler dossier set · Prepared 24 August 2026',
    runFoot: 'Hithium — IC Sales Playbook · Internal, sales strategy',
  },
  'hithium-team-lead-playbook': {
    src: 'repository-information/study-prep/hithium/hithium-team-lead-playbook.md',
    out: 'repository-information/study-prep/hithium/HITHIUM-TEAM-LEAD-PLAYBOOK.pdf',
    kick: 'Profiler Study Prep · Sales Strategy',
    sub: 'The sales leader’s working document: demand-pool coverage, the policy calendar, competitive rules of engagement, and forecast discipline',
    meta: [
      '<b>Prepared</b> 24 August 2026 &nbsp;·&nbsp; <b>Sources</b> hithium.profile.json profileVersion 5 · the relationship-web '
        + 'deliverable · the three Industry Guidance analyses &nbsp;·&nbsp; <b>Companion</b> hithium-ic-playbook.md, '
        + 'which carries the account-level motions',
      '<b>Sourcing</b> Market facts trace to the dossier base and the guidance claims ledgers; analytical reads are labelled as reads '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — sales strategy',
    ],
    banner: '<b>Presentation style</b> — BloombergNEF Research Report, the canonical Profiler export skin. '
      + 'Facts lead, labelled analysis follows, and the two never blur.',
    runHead: 'Built from the Profiler dossier set · Prepared 24 August 2026',
    runFoot: 'Hithium — Team-Lead Playbook · Internal, sales strategy',
  },
  'hithium-team-training-curriculum': {
    src: 'repository-information/study-prep/hithium/hithium-team-training-curriculum.md',
    out: 'repository-information/study-prep/hithium/HITHIUM-TEAM-TRAINING-CURRICULUM.pdf',
    kick: 'Profiler Study Prep · Team Training',
    sub: 'The four-week onboarding program: modules, dossier rotations, competency gates, and the trainer’s manual',
    meta: [
      '<b>Prepared</b> 24 August 2026 &nbsp;·&nbsp; <b>Sequences</b> the six in-app Industry Guidance modules · the two Phase 4 '
        + 'playbooks · the 88-dossier base · the relationship web &nbsp;·&nbsp; <b>Companions</b> hithium-ic-playbook.md · '
        + 'hithium-team-lead-playbook.md',
      '<b>Audience</b> The team lead as trainer’s manual; the new teammate as syllabus '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — team training',
    ],
    banner: '<b>Presentation style</b> — BloombergNEF Research Report, the canonical Profiler export skin. '
      + 'Facts lead, labelled analysis follows, and the two never blur.',
    runHead: 'Built from the Profiler asset base · Prepared 24 August 2026',
    runFoot: 'Hithium — Team Training Curriculum · Internal, team training',
  },
  'zhonhen-interview-brief': {
    src: 'repository-information/study-prep/zhonhen/zhonhen-interview-brief.md',
    out: 'repository-information/study-prep/zhonhen/ZHONHEN-INTERVIEW-BRIEF.pdf',
    kick: 'Profiler Study Prep · Interview Preparation',
    sub: 'First round — the interviewer, the architecture story, the US entry problem, and what to ask',
    meta: [
      '<b>Prepared</b> 18 August 2026 &nbsp;·&nbsp; <b>Source</b> zhonhen.profile.json, profileVersion 1 '
        + '(researched 2026-08-18, ~105 evaluated sources) plus the recruiting channel',
      '<b>Sourcing</b> Every claim traces to the dossier or the recruiting email; analytical reads are labelled as reads '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — interview preparation',
    ],
    banner: '<b>Presentation style</b> — BloombergNEF Research Report, the canonical Profiler export skin. '
      + 'Facts lead, labelled analysis follows, and the two never blur.',
    runHead: 'Built from the Profiler dossier set · Prepared 18 August 2026',
    runFoot: 'Zhonhen Electric — Interview Brief (Director of BD, First Round) · Internal, interview preparation',
  },
  'zhonhen-block-composition': {
    src: 'repository-information/study-prep/zhonhen/zhonhen-block-composition.md',
    out: 'repository-information/study-prep/zhonhen/ZHONHEN-BLOCK-COMPOSITION.pdf',
    kick: 'Profiler Study Prep · Technical-Sales Argument',
    sub: 'How the 2.5 MW Panama / 3.6 MW SuperX / 5 MW container lineup answers NVIDIA\u2019s 4.8 MW block standard',
    toc: false, // short working brief — six sections, reads straight through
    meta: [
      '<b>Prepared</b> 22 August 2026 &nbsp;·&nbsp; <b>NVIDIA-side numbers</b> verified against the Aug 2026 white paper '
        + '(repository-information/industry-guidance/) &nbsp;·&nbsp; <b>Companion</b> zhonhen-strategy-report.md',
      '<b>Handling</b> Deck-only figures (container table, fleet size) stay inside Zhonhen conversations '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — interview preparation',
    ],
    runHead: 'Block-composition argument · Prepared 22 August 2026',
    runFoot: 'Zhonhen Electric — 4.8 MW Block Composition Story · Internal, interview preparation',
  },
  'zhonhen-one-pager': {
    src: 'repository-information/study-prep/zhonhen/zhonhen-one-pager.md',
    out: 'repository-information/study-prep/zhonhen/ZHONHEN-ONE-PAGER.pdf',
    kick: 'Profiler Study Prep · Interview Day',
    sub: 'The five-minute scan: TRU vs SST, the density argument by buyer, ERCOT, and the landmines',
    toc: false, // one-page scan sheet — a contents block would cost the page
    dense: true, // retuned masthead + rhythm so the sheet actually lands on one page
    meta: [
      '<b>Prepared</b> 22 August 2026 &nbsp;·&nbsp; <b>Compressed from</b> zhonhen-strategy-report.md · '
        + 'zhonhen-lesson-plan.md · zhonhen-deck-summary.md &nbsp;·&nbsp; <b>Classification</b> Internal — interview preparation',
      '<b>Handling</b> The Schneider Electric relationship is a confidential disclosure — raise it only with Zhonhen, never elsewhere',
    ],
    runHead: 'Interview-day scan sheet · Prepared 22 August 2026',
    runFoot: 'Zhonhen Electric — Interview Day One-Pager · Internal, interview preparation',
  },
  'zhonhen-lesson-plan': {
    src: 'repository-information/study-prep/zhonhen/zhonhen-lesson-plan.md',
    out: 'repository-information/study-prep/zhonhen/ZHONHEN-LESSON-PLAN.pdf',
    kick: 'Profiler Study Prep · Technology Lesson Plan',
    sub: 'Data-center power architectures: the Western AC chain vs China’s HVDC (240V/336V/800Vdc)',
    meta: [
      '<b>Prepared</b> 19 August 2026 &nbsp;·&nbsp; <b>Source</b> zhonhen.profile.json plus the AIDC market report corpus '
        + '&nbsp;·&nbsp; <b>Companion</b> zhonhen-interview-brief.md, which teaches the room',
      '<b>Classification</b> Internal — interview preparation',
    ],
    banner: '<b>Presentation style</b> — BloombergNEF Research Report, the canonical Profiler export skin.',
    runHead: 'Built from the Profiler dossier set · Prepared 19 August 2026',
    runFoot: 'Zhonhen Electric — Technology Lesson Plan · Internal, interview preparation',
  },
  'zhonhen-deck-summary': {
    src: 'repository-information/study-prep/zhonhen/zhonhen-deck-summary.md',
    out: 'repository-information/study-prep/zhonhen/ZHONHEN-DECK-SUMMARY.pdf',
    kick: 'Profiler Study Prep · Interview Preparation',
    sub: 'Absorption summary of the official Zhonhen AIDC introduction deck (v1.35, 24 slides)',
    toc: false, // short reference sheet — the section flow reads better without a contents block
    meta: [
      '<b>Prepared</b> 21 August 2026 &nbsp;·&nbsp; <b>Source</b> company-provided introduction deck, received after round 1 '
        + '&nbsp;·&nbsp; <b>Companions</b> zhonhen-interview-brief.md · zhonhen-lesson-plan.md',
      '<b>Handling</b> The source deck is marked confidential — this summary is for personal preparation only '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — interview preparation',
    ],
    runHead: 'Built from the company-provided deck · Prepared 21 August 2026',
    runFoot: 'Zhonhen Electric — Deck Absorption Summary · Internal, interview preparation',
  },
  'zhonhen-strategy-report': {
    src: 'repository-information/study-prep/zhonhen/zhonhen-strategy-report.md',
    out: 'repository-information/study-prep/zhonhen/ZHONHEN-STRATEGY-REPORT.pdf',
    kick: 'Profiler Study Prep · Strategy Report',
    sub: 'Positioning among SST/MV providers, the ride-through and flicker sale, the two relationships, and the neocloud targets',
    meta: [
      '<b>Prepared</b> 22 August 2026 &nbsp;·&nbsp; <b>Sources</b> zhonhen.profile.json (41 public sources) · the company deck '
        + '· fresh web research, cited inline &nbsp;·&nbsp; <b>Companions</b> zhonhen-interview-brief.md · zhonhen-deck-summary.md',
      '<b>Handling</b> Contains confidential relationship intel relayed by the company — do not circulate '
        + '&nbsp;·&nbsp; <b>Classification</b> Internal — strategy preparation',
    ],
    banner: '<b>Sourcing discipline</b> — crux market facts carry numbered citations; first-hand intel from the company is '
      + 'labelled as such and never blended with sourced fact; strategy synthesis is labelled analysis.',
    runHead: 'Built from the Profiler dossier set + fresh research · Prepared 22 August 2026',
    runFoot: 'Zhonhen Electric — US AIDC Strategy Report · Internal & confidential, strategy preparation',
  },
  'megmeet-lesson-plan': {
    src: 'repository-information/study-prep/megmeet/megmeet-lesson-plan.md',
    out: 'repository-information/study-prep/megmeet/MEGMEET-LESSON-PLAN.pdf',
    kick: 'Profiler Study Prep · Technology Lesson Plan',
    sub: 'The underlying power electronics, taught from a high-school-STEM baseline',
    meta: [
      '<b>Prepared</b> 14 August 2026 &nbsp;·&nbsp; <b>Source</b> megmeet.profile.json '
        + '&nbsp;·&nbsp; <b>Companion</b> megmeet-interview-brief.md, which teaches the room',
      '<b>Classification</b> Internal — interview preparation',
    ],
    banner: '<b>Presentation style</b> — BloombergNEF Research Report, the canonical Profiler export skin.',
    runHead: 'Built from the Profiler dossier set · Prepared 14 August 2026',
    runFoot: 'Megmeet — Technology Lesson Plan · Internal, interview preparation',
  },
};

// ── Chromium discovery ─────────────────────────────────────────────────────
function findChrome() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(base)) throw new Error(`browser root not found: ${base}`);
  const dir = readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().pop();
  if (!dir) throw new Error(`no chromium-* build under ${base}`);
  return resolve(base, dir, 'chrome-linux/chrome');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevTools() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('Chromium DevTools endpoint never came up');
}

/** Minimal CDP client over the page target's WebSocket. */
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method && waiters.has(msg.method)) {
      waiters.get(msg.method)();
      waiters.delete(msg.method);
    }
  });
  const open = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('CDP socket error')));
  });
  return {
    open,
    send(method, params = {}) {
      return new Promise((res, rej) => {
        pending.set(++id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    once(method) { return new Promise((res) => waiters.set(method, res)); },
    close() { ws.close(); },
  };
}
// ── Markdown → HTML ────────────────────────────────────────────────────────
// A deliberately small subset: headings, paragraphs, GFM pipe tables,
// blockquotes, lists, <details>, and inline emphasis/code/links. That is the
// whole vocabulary the study-prep documents use. Anything richer belongs in an
// HTML-authored document like the AIDC report, not here.

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline spans. Escapes first, so code/link content can never inject markup. */
function inline(s) {
  return esc(s)
    // code before emphasis: backtick content must not be re-scanned for * pairs
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Pipe table. Column widths are proportional to the text they carry, clamped so
 * a one-word label column never starves and a prose column never swallows the
 * table. Equal-thirds (the default under table-layout:fixed) reads badly when
 * one column holds a sentence and another holds a date.
 */
function renderTable(rows) {
  const cells = rows.map((r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim()));
  const head = cells[0];
  const align = cells[1].map((s) => (/^:-+:$/.test(s) ? 'center' : /-+:$/.test(s) ? 'right' : 'left'));
  const body = cells.slice(2);
  const n = head.length;
  const weight = Array.from({ length: n }, (_, c) => {
    const lens = body.map((r) => (r[c] || '').length);
    const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 1;
    return Math.max(avg, head[c].length * 0.9, 6);
  });
  const total = weight.reduce((a, b) => a + b, 0);
  const pct = weight.map((w) => Math.min(58, Math.max(11, (w / total) * 100)));
  const norm = pct.reduce((a, b) => a + b, 0);
  const cols = pct.map((p) => `<col style="width:${((p / norm) * 100).toFixed(1)}%">`).join('');
  const th = head.map((h, c) => `<th style="text-align:${align[c]}">${inline(h)}</th>`).join('');
  const tb = body.map((r) => '<tr>' + Array.from({ length: n }, (_, c) =>
    `<td style="text-align:${align[c]}"${c === 0 ? ' class="k"' : ''}>${inline(r[c] || '')}</td>`).join('') + '</tr>').join('\n');
  return `<table><colgroup>${cols}</colgroup>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${tb}\n</tbody></table>`;
}

/**
 * Blockquotes carry two different jobs in these documents, and they should not
 * look alike: a bolded lead-in is a caution the reader must not skim past, while
 * a quoted line is something to say out loud. Split them on that signal.
 */
function renderQuote(buf) {
  const body = buf.map((l) => l.replace(/^>\s?/, '')).join('\n').trim();
  const spoken = /^["“]/.test(body);
  const paras = body.split(/\n{2,}/).map((p) => `<p>${inline(p.replace(/\n/g, ' '))}</p>`).join('');
  return spoken
    ? `<div class="pull"><p class="lbl">Say it like this</p>${paras}</div>`
    : `<div class="note">${paras}</div>`;
}
/** Block-level pass. Returns { title, toc, html }. */
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  const toc = [];
  let title = null;
  let i = 0;

  const isTableStart = (n) => lines[n]?.includes('|') && /^\s*\|?[\s:|-]*-[\s:|-]*\|/.test(lines[n + 1] || '');

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }
    if (/^Developed by:/.test(line)) { i++; continue; } // becomes the document footer

    // Fenced code. These documents use fences for ASCII architecture diagrams,
    // so the content is escaped and never inline-processed — a stray * or _ in
    // a diagram must stay a stray * or _.
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // <details> — Chromium prints a collapsed <details> as just its summary, so
    // the answers to a self-test would silently vanish from the PDF. Force open.
    if (/^<details/i.test(line)) {
      const buf = [];
      const sum = (line.match(/<summary>(.*?)<\/summary>/i) || [, 'Answers'])[1];
      i++;
      while (i < lines.length && !/^<\/details>/i.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<div class="ans"><p class="lbl">${inline(sum)}</p>${mdToHtml(buf.join('\n')).html}</div>`);
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 1 && title === null) { title = text; i++; continue; } // becomes the masthead
      if (level === 2) toc.push(text);
      const id = slug(text);
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && (lines[i].startsWith('>') || (buf.length && lines[i].trim() && !lines[i].startsWith('#')))) {
        if (!lines[i].startsWith('>')) break;
        buf.push(lines[i++]);
      }
      out.push(renderQuote(buf));
      continue;
    }

    if (isTableStart(i)) {
      const buf = [];
      while (i < lines.length && lines[i].includes('|')) buf.push(lines[i++]);
      out.push(renderTable(buf));
      continue;
    }

    const listKind = /^\s*[-*]\s+/.test(line) ? 'ul' : /^\s*\d+\.\s+/.test(line) ? 'ol' : null;
    if (listKind) {
      const items = [];
      const marker = listKind === 'ul' ? /^\s*[-*]\s+/ : /^\s*\d+\.\s+/;
      while (i < lines.length && lines[i].trim()) {
        if (marker.test(lines[i])) items.push(lines[i].replace(marker, ''));
        else if (items.length) items[items.length - 1] += ' ' + lines[i].trim(); // wrapped continuation
        else break;
        i++;
      }
      out.push(`<${listKind}>` + items.map((t) => `<li>${inline(t)}</li>`).join('') + `</${listKind}>`);
      continue;
    }

    // paragraph — consume until a blank line or the start of another block
    const para = [];
    while (i < lines.length && lines[i].trim()
           && !/^(#{1,4}\s|>|<details|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) && !isTableStart(i)) {
      para.push(lines[i++]);
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    else i++; // never stall on an unrecognised line
  }

  return { title, toc, html: out.join('\n') };
}
// ── Stylesheet ─────────────────────────────────────────────────────────────
// The `bloomberg` export skin from PROFILER-STYLES.md, translated from the same
// print-calibrated CSS that scripts/build-aidc-report-pdf.mjs uses, minus the
// chart/figure/timeline machinery a prose brief has no use for.
const CSS = `
:root {
  --ink:#23211c; --paper:#ffffff; --blue:#0b62a4; --gold:#8a6d1f;
  --muted:#6d6758; --faint:#8b8577; --rule:#cfc8b4; --rule-soft:#d8d2c0;
  --link:#305a8a; --accent:var(--blue); --pull-bg:#f4f8fb;
  --sans:Arial,Helvetica,"Liberation Sans",sans-serif;
  --mono:"DejaVu Sans Mono",Consolas,"Liberation Mono",Menlo,monospace;
}
@page { size:Letter; margin:15mm 14mm 15mm; }
* { box-sizing:border-box; }
html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body {
  margin:0; background:var(--paper); color:var(--ink);
  font:10pt/1.5 var(--sans); text-rendering:optimizeLegibility;
}

/* ── Masthead ─────────────────────────────────────────────────────────── */
.mast { border-top:6pt solid var(--accent); padding-top:10pt; }
.mast .kick {
  font:8pt/1.4 var(--mono); letter-spacing:.22em; text-transform:uppercase;
  color:var(--accent); margin:0 0 14pt;
}
h1 { font:bold 30pt/1.08 var(--sans); letter-spacing:-.015em; margin:0 0 6pt; }
.mast .sub { font:15pt/1.3 var(--sans); color:var(--muted); margin:0 0 18pt; }
.mast .meta {
  font:8pt/1.75 var(--mono); color:var(--muted);
  border-top:1pt solid var(--rule); border-bottom:2pt solid var(--ink);
  padding:9pt 0; margin:0;
}
.mast .meta b { color:var(--ink); font-weight:bold; }
.sty-banner {
  font:7.5pt/1.6 var(--mono); letter-spacing:.08em; color:var(--muted);
  border:0.5pt solid var(--rule); border-radius:3pt; padding:5pt 9pt; margin:9pt 0 0;
}
.sty-banner b { color:var(--accent); letter-spacing:.14em; text-transform:uppercase; }

/* ── Contents ─────────────────────────────────────────────────────────── */
.lead { margin:12pt 0 0; }
.lead > p:first-child { margin-top:0; }
.toc-h {
  font:8pt/1.4 var(--mono); letter-spacing:.22em; text-transform:uppercase;
  color:var(--accent); margin:18pt 0 6pt;
  border-top:1pt solid var(--rule); padding-top:12pt;
}
.toc { column-count:2; column-gap:22pt; font-size:9pt; margin:0 0 4pt; }
/* a short list balances badly across two columns — long labels wrap while the
   second column sits half empty; below the threshold, one column reads better */
.toc.one-col { column-count:1; }
.toc div { break-inside:avoid; margin:0 0 3.5pt; }
.toc .n { font:bold 8pt/1 var(--mono); color:var(--accent); margin-right:6pt; }
.toc a { color:var(--ink); }

/* ── Section hierarchy ────────────────────────────────────────────────── */
h2 {
  font:bold 13.5pt/1.25 var(--sans); color:var(--accent);
  border-bottom:2pt solid var(--accent); padding-bottom:4pt;
  margin:24pt 0 10pt; page-break-after:avoid;
}
h3 { font:bold 11pt/1.3 var(--sans); margin:15pt 0 4pt; page-break-after:avoid; }
h4 {
  font:8pt/1.4 var(--mono); letter-spacing:.13em; text-transform:uppercase;
  color:var(--gold); margin:13pt 0 4pt; page-break-after:avoid;
}
p { margin:6pt 0; orphans:2; widows:2; }
ul,ol { margin:5pt 0 9pt; padding-left:15pt; }
li { margin:3.5pt 0; }
b,strong { font-weight:bold; }
em,i { font-style:italic; }
a { color:var(--link); text-decoration:none; }
code {
  font:8.5pt var(--mono); background:#f2efe7; border-radius:2pt;
  padding:0.5pt 2.5pt; word-break:break-word;
}
/* Fenced blocks carry ASCII architecture diagrams, so they must not wrap —
   a wrapped diagram is a destroyed diagram. 7.5pt mono fits ~118 columns in
   the printable width, which covers every block in the current documents. */
pre {
  margin:10pt 0; padding:9pt 11pt; background:#f7f5ef;
  border-left:3pt solid var(--rule); border-radius:0 2pt 2pt 0;
  overflow:hidden; page-break-inside:avoid;
}
pre code {
  display:block; font:7.5pt/1.5 var(--mono); background:none;
  padding:0; border-radius:0; white-space:pre; word-break:normal; color:var(--ink);
}

/* ── Callouts ─────────────────────────────────────────────────────────── */
.pull {
  border-left:3pt solid var(--accent); background:var(--pull-bg);
  padding:8pt 12pt; margin:12pt 0; page-break-inside:avoid;
}
.pull .lbl, .ans .lbl {
  font:7.5pt/1.4 var(--mono); letter-spacing:.16em; text-transform:uppercase;
  color:var(--accent); margin:0 0 4pt;
}
.pull p { margin:0 0 4pt; font-size:9.5pt; font-style:italic; }
.pull p:last-child { margin-bottom:0; }
.note {
  border:0.5pt solid var(--rule); background:#faf8f3;
  padding:8pt 12pt; margin:12pt 0; font-size:9pt; page-break-inside:avoid;
}
.note p { margin:0 0 5pt; }
.note p:last-child { margin-bottom:0; }
.ans {
  border-top:1.5pt solid var(--ink); margin:14pt 0 0; padding:8pt 0 0;
  page-break-inside:avoid;
}
.ans .lbl { color:var(--gold); }
.ans ol { font-size:9pt; }

/* ── Tables ───────────────────────────────────────────────────────────── */
table {
  border-collapse:collapse; width:100%; margin:8pt 0 10pt; font-size:8.5pt;
  /* long tables span pages with a repeated header instead of jumping whole to
     the next page; fixed layout holds the computed column widths so one long
     unbreakable cell cannot push the table past the printable width */
  page-break-inside:auto; table-layout:fixed;
}
thead { display:table-header-group; }
th, td { overflow-wrap:break-word; }
th {
  vertical-align:bottom; font:7.5pt/1.35 var(--mono);
  letter-spacing:.09em; text-transform:uppercase; color:var(--muted);
  border-bottom:1.5pt solid var(--ink); padding:4pt 8pt 4pt 0;
}
tr { page-break-inside:avoid; }
td {
  border-bottom:0.5pt solid var(--rule-soft); padding:5.5pt 8pt 5.5pt 0;
  vertical-align:top; line-height:1.42;
}
td.k { font-weight:bold; }
td:last-child, th:last-child { padding-right:0; }

/* ── Footer block ─────────────────────────────────────────────────────── */
.foot {
  margin-top:22pt; border-top:1pt solid var(--rule); padding-top:7pt;
  font:7.5pt/1.6 var(--mono); color:var(--muted);
}
`;
// A scan sheet is a different document class from a report: it is read standing
// up, five minutes before a call, and its whole value is fitting on one page.
// `dense: true` keeps the same skin but retunes it for that job — the masthead
// stops behaving like a cover and vertical rhythm tightens, without shrinking the
// type to the point where a sheet read standing up stops being readable.
const DENSE_CSS = `
@page { size:Letter; margin:11mm 11mm 11mm; }
body { font-size:8.7pt; line-height:1.4; }
.mast { border-top:3pt solid var(--accent); padding-top:5pt; }
.mast .kick { font-size:6.8pt; margin:0 0 5pt; }
h1 { font:bold 17pt/1.06 var(--sans); margin:0 0 3pt; }
.mast .sub { font:9.5pt/1.25 var(--sans); margin:0 0 6pt; }
.mast .meta { font-size:6.6pt; line-height:1.4; padding:4pt 0; }
.lead { margin:6pt 0 0; }
h2 {
  font:bold 10.5pt/1.2 var(--sans); border-bottom:1.25pt solid var(--accent);
  padding-bottom:2pt; margin:10pt 0 4pt;
}
h3 { font:bold 9pt/1.25 var(--sans); margin:6pt 0 2pt; }
p { margin:3pt 0; }
ul,ol { margin:3pt 0 4pt; padding-left:12pt; }
li { margin:1.8pt 0; }
blockquote { margin:6pt 0; padding:5pt 8pt; }
table { font-size:7.5pt; margin:5pt 0 6pt; }
th { font-size:6.6pt; padding:2pt 6pt 2pt 0; }
td { padding:3pt 6pt 3pt 0; line-height:1.36; }
.foot { margin-top:8pt; padding-top:4pt; font-size:6.6pt; line-height:1.45; }
`;
// ── Page shell ─────────────────────────────────────────────────────────────
function buildHtml(doc, parsed) {
  const toc = parsed.toc.map((t, n) =>
    `<div><span class="n">${String(n + 1).padStart(2, '0')}</span><a href="#${slug(t)}">${inline(t)}</a></div>`).join('\n');
  // Whatever sits between the H1 and the first H2 is the document's own framing
  // — who it is for, what it was built from. It belongs above the contents, not
  // stranded after it, which is where a fixed masthead-then-TOC shell puts it.
  const cut = parsed.html.indexOf('<h2');
  const lead = cut === -1 ? parsed.html : parsed.html.slice(0, cut);
  const rest = cut === -1 ? '' : parsed.html.slice(cut);
  // Short documents set `toc: false` / omit `banner`: on a one-page reference
  // sheet a contents block and a style banner cost more space than they return.
  // Both default to the full treatment when the fields are absent.
  const tocBlock = doc.toc === false ? '' : `<p class="toc-h">Contents</p>
<nav class="toc${parsed.toc.length <= 6 ? ' one-col' : ''}">
${toc}
</nav>`;
  const bannerBlock = doc.banner ? `<p class="sty-banner">${doc.banner}</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(parsed.title || doc.sub)}</title>
<style>${CSS}${doc.dense ? DENSE_CSS : ''}</style>
</head>
<body>
<header class="mast">
  <p class="kick">${doc.kick}</p>
  <h1>${esc(parsed.title || '')}</h1>
  <p class="sub">${doc.sub}</p>
  <p class="meta">${doc.meta.join('<br>')}</p>
  ${bannerBlock}
</header>
<div class="lead">
${lead}
</div>
${tocBlock}
${rest}
<p class="foot">${doc.runFoot} &nbsp;·&nbsp; Rendered from ${basename(doc.src)}, which remains the source of truth &nbsp;·&nbsp; Developed by: LightAISolutions</p>
</body>
</html>`;
}

const runHeader = (doc) => `
<div style="width:100%;font:6.5pt/1.2 Arial,Helvetica,sans-serif;color:#a8a294;
            padding:0 14mm;text-align:right;letter-spacing:.14em;text-transform:uppercase;">
  ${esc(doc.runHead)}
</div>`;
const runFooter = (doc) => `
<div style="width:100%;font:7pt/1.2 Arial,Helvetica,sans-serif;color:#6d6758;
            padding:0 14mm;display:flex;justify-content:space-between;">
  <span>${esc(doc.runFoot)}</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

// ── Main ───────────────────────────────────────────────────────────────────
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const bad = wanted.filter((k) => !(k in DOCS));
if (bad.length) {
  console.error(`unknown doc key(s): ${bad.join(', ')} — expected one of: ${Object.keys(DOCS).join(', ')}`);
  process.exit(2);
}
const buildList = wanted.length ? wanted : Object.keys(DOCS);
const keepHtml = process.argv.includes('--keep-html');
const staging = mkdtempSync(resolve(tmpdir(), 'study-prep-'));

const chrome = spawn(findChrome(), [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none',
  `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

try {
  await waitForDevTools();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const c = cdp(target.webSocketDebuggerUrl);
  await c.open;
  await c.send('Page.enable');

  for (const key of buildList) {
    const doc = DOCS[key];
    const src = resolve(ROOT, doc.src);
    if (!existsSync(src)) { console.log(`${key.padEnd(24)} -- skipped, no source at ${doc.src}`); continue; }

    const parsed = mdToHtml(readFileSync(src, 'utf8'));
    const html = buildHtml(doc, parsed);
    // staged outside the repo: the HTML is derived, and a committed copy would
    // be one more thing to drift from the Markdown
    const stage = resolve(staging, `${key}.html`);
    writeFileSync(stage, html);
    if (keepHtml) writeFileSync(resolve(ROOT, dirname(doc.out), `${key}-print.html`), html);

    const loaded = c.once('Page.loadEventFired');
    await c.send('Page.navigate', { url: `file://${stage}` });
    await loaded;
    await sleep(500); // let layout and font metrics settle before the paginator runs

    const { data } = await c.send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: runHeader(doc),
      footerTemplate: runFooter(doc),
      marginTop: 0.62, marginBottom: 0.62, marginLeft: 0.55, marginRight: 0.55,
    });
    const buf = Buffer.from(data, 'base64');
    writeFileSync(resolve(ROOT, doc.out), buf);
    const counts = [...buf.toString('latin1').matchAll(/\/Count\s+(\d+)/g)].map((m) => +m[1]);
    const pages = counts.length ? Math.max(...counts) : '?';
    console.log(`${key.padEnd(24)} -> ${basename(doc.out).padEnd(30)} ${(buf.length / 1024).toFixed(0)} KB, ${pages} pages, ${parsed.toc.length} sections`);

    if (process.argv.includes('--png')) {
      // Proof mode: a continuous-scroll capture of the same DOM the paginator
      // just consumed. It verifies content and layout, not page breaks.
      const scratch = process.env.SCRATCH || '/tmp';
      await c.send('Emulation.setDeviceMetricsOverride', {
        width: 816, height: 1056, deviceScaleFactor: 1.5, mobile: false,
      });
      const { contentSize } = await c.send('Page.getLayoutMetrics');
      const shots = Math.min(Math.ceil(contentSize.height / 1056), 40);
      for (let p = 0; p < shots; p++) {
        const shot = await c.send('Page.captureScreenshot', {
          format: 'png', captureBeyondViewport: true,
          clip: { x: 0, y: p * 1056, width: 816, height: 1056, scale: 1.5 },
        });
        writeFileSync(`${scratch}/${key}-p${String(p + 1).padStart(2, '0')}.png`,
          Buffer.from(shot.data, 'base64'));
      }
      await c.send('Emulation.clearDeviceMetricsOverride');
      console.log(`  wrote ${shots} preview PNGs to ${scratch}`);
    }
  }
  c.close();
} finally {
  chrome.kill('SIGKILL');
}
// Developed by: LightAISolutions
