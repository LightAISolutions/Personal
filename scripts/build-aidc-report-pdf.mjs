#!/usr/bin/env node
/**
 * build-aidc-report-pdf.mjs — renders repository-information/aidc-market-report-print.html
 * to repository-information/AIDC-MARKET-REPORT.pdf.
 *
 * Uses the pre-installed Chromium (PLAYWRIGHT_BROWSERS_PATH) over the DevTools
 * Protocol so Page.printToPDF can carry a custom running header/footer — the CLI
 * --print-to-pdf flag cannot. No npm dependencies: Node 22 ships a global WebSocket.
 *
 * Usage: node scripts/build-aidc-report-pdf.mjs [--doc <key>] [--style <slug>] [--png]
 *        no flags     renders BOTH documents in ALL five styles, so neither the
 *                     editions nor the two documents can drift apart
 *        --doc <key>     renders one: report | coverage
 *        --style <slug>  renders one: bloomberg | default | equity-research |
 *                        intel-briefing | smart-brevity
 *        --png        also writes page previews to SCRATCH (of whichever
 *                     document rendered last)
 *
 * The styles are the writing styles registered in PROFILER-STYLES.md. Each has a
 * presentation skin in Profiler.html and a matching skin in the report's own
 * stylesheet, selected by the data-style attribute this script sets on <html>.
 * The skins change typography and chrome only — the report text does not vary.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9333;

/** Document registry. Each document renders from its own print-HTML source into
 *  its own set of style editions. `bloomberg` is canonical everywhere and keeps
 *  the unsuffixed name, so existing links to it never break.
 *
 *  The two documents are deliberately separate artifacts on different refresh
 *  clocks: `report` carries the market argument and moves slowly, while
 *  `coverage` carries the 40 per-company entries and is reissued on earnings. */
const DOCS = {
  report: {
    src: 'repository-information/aidc-market-report-print.html',
    foot: 'AIDC Market Report — the US AI Data-Center Infrastructure Market',
    styles: {
      bloomberg: 'AIDC-MARKET-REPORT.pdf',
      default: 'AIDC-MARKET-REPORT-analyst-prose.pdf',
      'equity-research': 'AIDC-MARKET-REPORT-equity-research.pdf',
      'intel-briefing': 'AIDC-MARKET-REPORT-intel-briefing.pdf',
      'smart-brevity': 'AIDC-MARKET-REPORT-smart-brevity.pdf',
    },
  },
  coverage: {
    src: 'repository-information/aidc-coverage-universe-print.html',
    foot: 'AIDC Coverage Universe — the 40 Companies Under Coverage',
    styles: {
      bloomberg: 'AIDC-COVERAGE-UNIVERSE.pdf',
      default: 'AIDC-COVERAGE-UNIVERSE-analyst-prose.pdf',
      'equity-research': 'AIDC-COVERAGE-UNIVERSE-equity-research.pdf',
      'intel-briefing': 'AIDC-COVERAGE-UNIVERSE-intel-briefing.pdf',
      'smart-brevity': 'AIDC-COVERAGE-UNIVERSE-smart-brevity.pdf',
    },
  },
};

const STYLE_SLUGS = Object.keys(DOCS.report.styles);

const styleFlag = process.argv.indexOf('--style');
const requested = styleFlag !== -1 ? process.argv[styleFlag + 1] : null;
if (requested && !STYLE_SLUGS.includes(requested)) {
  console.error(`unknown style "${requested}" — expected one of: ${STYLE_SLUGS.join(', ')}`);
  process.exit(2);
}
const docFlag = process.argv.indexOf('--doc');
const reqDoc = docFlag !== -1 ? process.argv[docFlag + 1] : null;
if (reqDoc && !(reqDoc in DOCS)) {
  console.error(`unknown doc "${reqDoc}" — expected one of: ${Object.keys(DOCS).join(', ')}`);
  process.exit(2);
}
const docList = reqDoc ? [reqDoc] : Object.keys(DOCS);
const buildList = requested ? [requested] : STYLE_SLUGS;

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

/** The running footer names the document it is printed on, so the companion does
 *  not carry the report's title on all 51 of its pages. */
const foot = (label) => `
<div style="width:100%;font:7pt/1.2 Arial,Helvetica,sans-serif;color:#6d6758;
            padding:0 14mm;display:flex;justify-content:space-between;">
  <span>${label} · Internal · Not investment advice</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;
const HEAD = `
<div style="width:100%;font:6.5pt/1.2 Arial,Helvetica,sans-serif;color:#a8a294;
            padding:0 14mm;text-align:right;letter-spacing:.14em;text-transform:uppercase;">
  Jon Yang Equity Research · 40 companies under coverage · 16 August 2026
</div>`;

const chrome = spawn(findChrome(), [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none',
  `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

try {
  await waitForDevTools();
  // `c` is declared outside the document loop so the --png proof mode below
  // still has a live connection — it captures whichever document rendered last.
  let c;
  for (const docKey of docList) {
    const SRC = resolve(ROOT, DOCS[docKey].src);
    const STYLES = DOCS[docKey].styles;
    const target = await (await fetch(
      `http://127.0.0.1:${PORT}/json/new?file://${SRC}`, { method: 'PUT' },
    )).json();
    c = cdp(target.webSocketDebuggerUrl);
    await c.open;
    await c.send('Page.enable');
    const loaded = c.once('Page.loadEventFired');
    await c.send('Page.navigate', { url: `file://${SRC}` });
    await loaded;
    await c.send('Runtime.enable');
    await sleep(600); // let layout/fonts settle before capture

    for (const style of buildList) {
      // one page load, five renders: swapping the attribute reskins the document
      // in place, so every edition is guaranteed to carry identical content
      await c.send('Runtime.evaluate', {
        expression: `document.documentElement.setAttribute('data-style', ${JSON.stringify(style)})`,
      });
      await sleep(120); // let the restyle settle before the paginator runs
      const { data } = await c.send('Page.printToPDF', {
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: HEAD,
        footerTemplate: foot(DOCS[docKey].foot),
        marginTop: 0.62, marginBottom: 0.62, marginLeft: 0.55, marginRight: 0.55,
      });
      const buf = Buffer.from(data, 'base64');
      const out = resolve(ROOT, 'repository-information', STYLES[style]);
      writeFileSync(out, buf);
      const counts = [...buf.toString('latin1').matchAll(/\/Count\s+(\d+)/g)].map((m) => +m[1]);
      const pages = counts.length ? Math.max(...counts) : '?';
      console.log(`${docKey.padEnd(9)} ${style.padEnd(16)} -> ${STYLES[style].padEnd(44)} ${(buf.length / 1024).toFixed(0)} KB, ${pages} pages`);
    }
  }

  if (process.argv.includes('--png')) {
    const scratch = process.env.SCRATCH || '/tmp';
    // Proof mode: neutralize forced page breaks so the continuous-scroll capture
    // shows real content instead of the whitespace the paginator would absorb.
    await c.send('Runtime.evaluate', {
      expression: `document.head.insertAdjacentHTML('beforeend',
        '<style>.brk{page-break-before:auto!important}body{width:740px;margin:0 auto}</style>')`,
    });
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
      writeFileSync(`${scratch}/report-p${String(p + 1).padStart(2, '0')}.png`,
        Buffer.from(shot.data, 'base64'));
    }
    console.log(`wrote ${shots} preview PNGs to ${scratch}`);
  }
  c.close();
} finally {
  chrome.kill('SIGKILL');
}
// Developed by: LightAISolutions
