// Prompt-injection scanner for untrusted text (web pages, search snippets). Page text is data: the scanner only
// labels it. A flagged source stays in the ledger for audit, but it never supports a confirmed fact, its text is
// never promoted to memory, and nothing in it is executed or followed (README §Injection handling).
import { INVISIBLE_RE, sanitizeLine, SAMPLE_MAX, decodeEntities } from './sanitize.mjs';

const SCAN_MAX = 200000; // characters scanned per text; the rest is not read (and flagged as oversize)

// Rules run on the "view": NFKC, invisible characters removed, tags removed (comment and script text kept), spaces collapsed.
export const RULES = [
  ['ignore-instructions', /\b(?:ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(?:previous|prior|above|earlier|preceding|all|any|your|the|these|those|system)\b[^.\n]{0,30}\b(?:instructions?|prompts?|rules|guidelines|directives|guardrails)\b/i],
  ['role-reassignment', /\byou are now\b|\bfrom now on,? (?:you|the assistant)\b|\bact as (?:an?|the|my)\b[^.\n]{0,30}\b(?:assistant|agent|ai|admin|administrator|developer|system)\b|\bpretend (?:to be|you are)\b|\bnew (?:instructions|directives|persona)\b|\byour new (?:role|task|goal|instructions)\b|\b(?:enter|enable|activate)\b[^.\n]{0,15}\b(?:developer|debug|god|jailbreak|dan) mode\b/i],
  ['system-prompt-markup', /<\/?\s*(?:system|assistant|im_start|im_end|instructions?)\s*>|\[\/?(?:INST|SYS|SYSTEM)\]|<<\/?SYS>>|<\|[a-z_]{2,20}\|>|^\s*#{0,4}\s*(?:system|assistant)\s*(?:prompt|message)?\s*:|\b(?:system|developer)\s+(?:prompt|message|instructions?)\s*[:=]/im],
  ['addresses-ai', /\b(?:attention|note|message|instructions?|important)\s*(?:to|for|[,:])?\s*(?:any|all|the)?\s*(?:ai|a\.i\.|llms?|large language models?|language models?|ai assistants?|ai agents?|chatbots?|claude|gpt|chatgpt)\b|\bif you are (?:an?|the) (?:ai|llm|language model|ai assistant|ai agent|chatbot)\b|\b(?:ai|llm|ai assistant|ai agent)s? (?:reading|processing|summari[sz]ing|browsing|crawling) this\b/i],
  ['exfiltration-request', /\b(?:send|forward|e-?mail|post|upload|share|leak|reveal|disclose|print|output|repeat|tell (?:me|us)|include)\b[^.\n]{0,60}\b(?:your|the|all|any)\b[^.\n]{0,20}\b(?:system prompt|hidden instructions|instructions|prompt|memory|api keys?|access tokens?|tokens|secrets?|credentials|passwords?|conversation history|chat history)\b|\b(?:send|forward|e-?mail|post|upload|share|leak|reveal|disclose|print|output|tell (?:me|us)|include)\b[^.\n]{0,60}\b(?:the user'?s?|the human'?s?|your (?:user|owner|principal)'?s?)\b[^.\n]{0,30}\b(?:itinerar(?:y|ies)|calendar|inbox|e-?mails?|contacts|location|address|bookings?|profile|personal data|data|trips?|plans?|preferences)\b/i],
  ['contact-request', /\b(?:e-?mail|send|forward|text|message|contact|notify|call)\b[^.\n]{0,40}\b(?:the user|the human|your (?:user|owner|principal))\b|\b(?:send|forward|e-?mail)\b[^.\n]{0,20}\b(?:it|this|everything|all of (?:it|this)|the (?:above|following|results?|summary|data|conversation|list|itinerary))\b[^.\n]{0,20}\bto\b[^.\n]{0,10}[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i],
  ['command-request', /\b(?:run|execute|eval(?:uate)?|invoke)\b[^.\n]{0,30}\b(?:command|shell|terminal|bash|powershell|script)\b|\b(?:curl|wget)\s+(?:-\S+\s+)*https?:\/\/|\brm\s+-rf\b|\bnode\s+-e\b|\bpowershell\s+-|`[^`\n]{0,40}(?:sudo|chmod|bash|sh -c)[^`\n]{0,80}`/i],
  ['tool-call-markup', /"(?:tool|tool_name|function|name|recipient_name)"\s*:\s*"[^"]{1,80}"\s*,\s*"(?:arguments|parameters|input|args)"\s*:|"tool_calls"\s*:|<\s*(?:function_calls|tool_call|tool_use|invoke)\b|\bfunctions\.[a-z_]+\s*\(/i],
  ['concealment-request', /\b(?:do not|don't|never)\s+(?:tell|mention|reveal|inform|let|alert|notify)\b[^.\n]{0,30}\b(?:the user|the human|your (?:user|owner|principal))\b/i],
  // Second-language steering (French, German, Spanish, Italian, Portuguese, Dutch): "ignore the previous instructions",
  // "note to AI assistants". Deliberately narrow — a false positive only costs a source; a miss costs nothing structural
  // either, since page text never flows past the ledger (see run.mentions) — but a flagged page also stops counting.
  ['ignore-instructions-multilingual', /\b(?:ignorez|ignorer|ignorent|oubliez?|oublie|contournez|ignorier(?:e|en|t|st)|vergiss|vergessen sie|umgeh(?:e|en)|missachte(?:n)?|ignor[aá](?:r|d|lo|las)?|olvid[ae]|ignorate|dimentica(?:te)?|esque[cç]a|esquecer|negeer|vergeet)\b[^.\n]{0,40}\b(?:instructions?|consignes|directives|r[èe]gles|anweisung(?:en)?|instruktionen|regeln|vorgaben|instrucciones|reglas|istruzioni|regole|instru[cç][oõ]es|regras|instructies|regels)\b/i],
  ['addresses-ai-multilingual', /\b(?:note|message|attention|instructions?|consignes?|hinweis|achtung|nachricht|nota|atenci[oó]n|aviso|avviso|attenzione|atenção)\s+(?:aux?|pour|an|f[üu]r|a|para|per|ai|agli|alle)\s+(?:les\s+|tous les\s+|die\s+|alle\s+|los\s+|las\s+|todos los\s+|gli\s+|os\s+|todos os\s+)?(?:assistants?\s+(?:ia|d'ia|virtuels)|ia|llms?|ki[- ]?assistenten|ki|asistentes?\s+(?:de\s+)?ia|assistenti\s+(?:di\s+)?ia|assistentes?\s+(?:de\s+)?ia|ai[- ]assistenten)\b/i],
  // A page carrying a mailbox envelope (SPEC §2 shape) is forging core output; the shape is specific enough to flag.
  ['envelope-markup', /"type"\s*:\s*"(?:notice|reply|proposal|draft_proposal|request|brief|digest|shortlist)"|"producer"\s*:\s*"|"in_reply_to"\s*:|"dedupe_key"\s*:|"payload"\s*:\s*\{/i],
  ['memory-write-request', /\b(?:add|save|store|write|record|remember)\b[^.\n]{0,40}\b(?:to|in|into)\s+(?:your|the)\s+(?:memory|long-term memory|knowledge base|instructions|system prompt)\b|\b(?:update|change|modify|overwrite|rewrite|raise|increase|reset)\s+(?:your|the)\s+(?:instructions|system prompt|memory|guidelines|budgets?|search budget|fetch budget)\b|\bmark (?:this|these|it)\b[^.\n]{0,30}\b(?:as )?(?:confirmed|verified|trusted|safe)\b/i]
];

// Rules on the raw text (hidden-text tricks). Counted once each.
const RAW_RULES = [
  ['zero-width-chars', /[\u00AD\u180E\u200B-\u200F\u2060-\u2064\uFEFF]/u],
  ['bidi-controls', /[\u202A-\u202E\u2066-\u2069]/u],
  ['unicode-tag-chars', /[\u{E0000}-\u{E007F}]/u],
  ['hidden-css', /style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?:px|em|rem|%)?\s*[;"']|opacity\s*:\s*0(?:\.0+)?\s*[;"']|color\s*:\s*(?:#fff(?:fff)?|white|transparent)\b|left\s*:\s*-\d{3,}|text-indent\s*:\s*-\d{3,})/i],
  ['hidden-attribute', /<[a-z][^<>]{0,200}\s(?:hidden|aria-hidden\s*=\s*["']true["'])[\s>]/i],
  ['encoded-payload', /[A-Za-z0-9+/]{200,}={0,2}/]
];

/** The text the view rules read: invisible characters gone, tags gone (their inner text and comments kept). */
export function scanView(text) {
  const head = String(text).slice(0, SCAN_MAX);
  // Attribute text (alt, title, meta content, aria-label, placeholder, value, data-*) is invisible on the page but
  // readable by anything that parses it: it is appended to the view so the rules see it, then dropped with the tags.
  const attrs = [];
  for (const m of head.matchAll(ATTR_TEXT_RE)) attrs.push(m[1] ?? m[2] ?? '');
  const untagged = head.replace(/<!--|-->/g, ' ').replace(/<\/?[A-Za-z][^<>]{0,2000}>/g, ' ') + (attrs.length ? '\n' + attrs.join('\n') : '');
  return decodeEntities(untagged).normalize('NFKC').replace(INVISIBLE_RE, '')
    .replace(/[ \t\u00A0]+/g, ' ');
}
const ATTR_TEXT_RE = /\b(?:alt|title|content|aria-label|aria-description|placeholder|value|data-[a-z0-9-]+)\s*=\s*(?:"([^"]{0,4000})"|'([^']{0,4000})')/gi;

/**
 * Scan untrusted text. Returns { injection_suspect, reasons: [{rule, sample}] }; `sample` is a sanitized
 * ≤80-character window around the first match (stored for audit, never interpreted).
 */
export function scanText(text) {
  const raw = String(text ?? '');
  const reasons = [];
  if (raw.length > SCAN_MAX) reasons.push({ rule: 'oversize-text', sample: `${raw.length} characters` });
  const head = raw.slice(0, SCAN_MAX);
  for (const [rule, re] of RAW_RULES) {
    const m = re.exec(head);
    if (m) reasons.push({ rule, sample: rule.endsWith('-chars') || rule === 'bidi-controls' ? `U+${m[0].codePointAt(0).toString(16).toUpperCase()} at ${m.index}` : sampleAround(head, m.index, m[0].length) });
  }
  const view = scanView(head);
  for (const [rule, re] of RULES) {
    const m = re.exec(view);
    if (m) reasons.push({ rule, sample: sampleAround(view, m.index, m[0].length) });
  }
  return { injection_suspect: reasons.length > 0, reasons };
}

function sampleAround(s, index, len) {
  const start = Math.max(0, index - 10);
  return sanitizeLine(s.slice(start, start + Math.max(len + 20, 40)), SAMPLE_MAX);
}

// Developed by: LightAISolutions
