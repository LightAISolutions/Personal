#!/usr/bin/env node
// Research kit — the research-run contract routines follow (plan §5.2): per-run budgets, a source ledger, the
// two-source rule, confidence labels, visit-duration ranges and injection handling. README.md is the contract.
// CLI:     node helpers/kits/research/index.mjs <command> [flags]   (vendor/helpers/kits/research/index.mjs in a private repo)
// Library: import { ResearchSession, startRun, record, check, … } from './index.mjs'
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from './lib/cli.mjs';

export { ResearchSession, BudgetExhaustedError } from './lib/session.mjs';
export { startRun, record, claim, check, duration, summary, finish, loadRun, saveRun, assertValid } from './lib/run.mjs';
export { DEFAULT_BUDGETS, MAX_BUDGETS, MAX_API_RECORDS, MAX_REFUSED_RECORDS, normalizeBudgets, checkSpend, remaining } from './lib/budget.mjs';
export { CLAIM_KINDS, CRITICAL_KINDS, LABELS, STALE_DAYS, SIMILARITY_THRESHOLD, labelClaim, independenceGroups, textSimilarity, isStale } from './lib/claims.mjs';
export { scanText, scanView, RULES as INJECTION_RULES } from './lib/injection.mjs';
export { sanitizeText, sanitizeLine, stripMarkup, EXCERPT_MAX } from './lib/sanitize.mjs';
export { registrableDomain, publisherKey, hostOf } from './lib/domain.mjs';
export { durationRange, parseMinutes } from './lib/duration.mjs';
export { validate as validateRun, RUN_SCHEMA } from './lib/schema.mjs';
export { main, parseArgs, HELP } from './lib/cli.mjs';

function invokedDirectly() {
  try { return realpathSync(process.argv[1] || '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (invokedDirectly()) {
  const { code, out, help } = main(process.argv.slice(2));
  if (help) process.stdout.write(help + '\n');
  if (out) {
    process.stdout.write(JSON.stringify(out, null, 1) + '\n');
    if (out.ok === false && out.error) process.stderr.write(`research kit: ${out.error}\n`);
  }
  process.exitCode = code;
}

// Developed by: LightAISolutions
