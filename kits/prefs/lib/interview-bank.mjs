/**
 * Prefs kit — the interview question bank: a caller-chosen list of closed and open questions for one vocabulary
 * (presets/<name>.interview.json is the worked example). The core asks the questions and writes the owner's taps as an
 * answers file; the kit only validates the bank and uses it to cross-check answers. Every option of a closed question
 * maps to exactly one {dimension, value, polarity}: the dimension is the question's, value and polarity the option's.
 *
 * validateBank() runs the JSON Schema (schemas/travel.interview.schema.json, through the brochure kit's validator) and
 * then the checks a schema cannot express: the bank names this vocabulary, ids are unique, a qid starts with its
 * section id, every dimension exists, every option value is legal for its dimension (closed lists enforced), a
 * single-value dimension is only ever offered with polarity "+", and text questions have no options.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSubset } from '../../brochure/lib/validate.mjs';
import { checkValue, PRESETS_DIR } from './vocab.mjs';

export const BANK_SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'travel.interview.schema.json');
let schemaCache = null;
export function loadBankSchema() { return schemaCache || (schemaCache = JSON.parse(readFileSync(BANK_SCHEMA_PATH, 'utf8'))); }

/** loadBank('travel' | '/path/to/bank.json') -> raw bank object (not yet validated); throws when the file is missing. */
export function loadBank(nameOrPath) {
  const preset = join(PRESETS_DIR, String(nameOrPath) + '.interview.json');
  const file = /^[a-z][a-z0-9_-]*$/.test(String(nameOrPath)) && existsSync(preset) ? preset : String(nameOrPath);
  if (!existsSync(file)) throw new Error('question bank not found: ' + nameOrPath + ' (a preset name or a JSON file)');
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * validateBank(raw, vocab) -> {bank, errors}. bank = {vocab, title, sections, questions: Map qid -> question} where
 * each question has its section id and options with normalised values. errors are plain strings with a JSON path.
 */
export function validateBank(raw, vocab) {
  const schemaErrors = validateSubset(raw, loadBankSchema());
  if (schemaErrors.length) return { bank: null, errors: schemaErrors.map((e) => `${e.path}: ${e.message}`) };
  const errors = [];
  if (raw.vocab !== vocab.name) errors.push(`/vocab: the bank is for vocabulary "${raw.vocab}", not "${vocab.name}"`);
  const sectionIds = new Set(), questions = new Map();
  raw.sections.forEach((s, si) => {
    const sp = `/sections/${si}`;
    if (sectionIds.has(s.id)) errors.push(`${sp}/id: duplicate section id "${s.id}"`);
    sectionIds.add(s.id);
    s.questions.forEach((q, qi) => {
      const qp = `${sp}/questions/${qi}`;
      if (questions.has(q.qid)) errors.push(`${qp}/qid: duplicate qid "${q.qid}"`);
      if (!q.qid.startsWith(s.id + '-') || !/^[0-9]{2}$/.test(q.qid.slice(s.id.length + 1))) errors.push(`${qp}/qid: "${q.qid}" must be "${s.id}-NN"`);
      const dim = vocab.dims.get(q.dimension);
      if (!dim) { errors.push(`${qp}/dimension: unknown dimension "${q.dimension}"`); return; }
      if (q.kind === 'text') { if (q.options.length) errors.push(`${qp}/options: a text question has an empty options array`); }
      else if (q.options.length < 2) errors.push(`${qp}/options: a ${q.kind} question needs at least two options`);
      const seen = new Set(), options = [];
      q.options.forEach((o, oi) => {
        const op = `${qp}/options/${oi}`;
        const cv = checkValue(vocab, q.dimension, o.value);
        if (cv.error) { errors.push(`${op}/value: ${cv.error}`); return; }
        if (dim.cardinality === 'one' && o.polarity !== '+') errors.push(`${op}/polarity: "${q.dimension}" holds one value, so its options must be "+"`);
        const key = cv.value + '\u0001' + o.polarity;
        if (seen.has(key)) errors.push(`${op}: two options map to the same {dimension, value, polarity}`);
        seen.add(key);
        options.push({ label: o.label, value: cv.value, polarity: o.polarity });
      });
      questions.set(q.qid, { qid: q.qid, section: s.id, text: q.text, kind: q.kind, dimension: q.dimension, options, skip_ok: q.skip_ok });
    });
  });
  if (errors.length) return { bank: null, errors };
  return { bank: { vocab: raw.vocab, title: raw.title || raw.vocab, sections: raw.sections.map((s) => ({ id: s.id, title: s.title, qids: s.questions.map((q) => q.qid) })), questions }, errors };
}

/** bankQuestionCount(bank) -> number of questions in a validated bank. */
export function bankQuestionCount(bank) { return bank.questions.size; }

// Developed by: LightAISolutions
