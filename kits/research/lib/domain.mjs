// Registrable domain and the "independence key" used by the two-source rule (README §Independence).
// No dependency on the Public Suffix List: a short built-in list of multi-label suffixes and
// shared-hosting suffixes covers the common cases; anything else is treated as a one-label suffix.

// Multi-label public suffixes (country second levels) — a registrable domain is one label more.
const MULTI_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk',
  'com.au', 'net.au', 'org.au', 'gov.au', 'edu.au',
  'co.nz', 'org.nz', 'govt.nz', 'co.jp', 'ne.jp', 'or.jp', 'go.jp', 'ac.jp',
  'co.kr', 'or.kr', 'com.cn', 'org.cn', 'gov.cn', 'com.tw', 'org.tw', 'com.hk', 'org.hk',
  'com.sg', 'org.sg', 'co.in', 'org.in', 'gov.in', 'co.za', 'org.za', 'co.il', 'org.il',
  'com.br', 'org.br', 'gov.br', 'com.mx', 'org.mx', 'gob.mx', 'com.ar', 'com.tr', 'org.tr',
  'co.th', 'or.th', 'com.my', 'com.ph', 'com.vn', 'co.id', 'or.id', 'com.pe', 'com.co', 'com.ec',
  'com.es', 'com.pt', 'com.gr', 'com.pl', 'co.at', 'or.at', 'ac.at', 'com.ua', 'com.eg', 'co.ke'
]);
// Shared-hosting suffixes: each subdomain is a separate publisher (as in the Public Suffix List).
const HOSTING_SUFFIXES = new Set([
  'github.io', 'gitlab.io', 'blogspot.com', 'wordpress.com', 'substack.com', 'tumblr.com',
  'wixsite.com', 'netlify.app', 'pages.dev', 'web.app', 'firebaseapp.com', 'herokuapp.com',
  'vercel.app', 'medium.com', 'weebly.com', 'squarespace.com', 'notion.site'
]);

/** Lower-cased host of an http(s) URL, or null when the URL is not a valid http(s) URL. */
export function hostOf(url) {
  if (typeof url !== 'string' || url.length > 2048) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  return h || null;
}

function suffixOf(labels) {
  const last2 = labels.slice(-2).join('.');
  if (labels.length >= 3 && (MULTI_SUFFIXES.has(last2) || HOSTING_SUFFIXES.has(last2))) return 2;
  return 1;
}

/** Registrable domain ("eTLD+1"): guide.lanternhall.example → lanternhall.example. */
export function registrableDomain(urlOrHost) {
  const raw = String(urlOrHost || '').toLowerCase();
  // A bare host is letters/digits/dots/hyphens only; anything else must parse as an http(s) URL.
  const host = /^[a-z0-9.-]{1,253}$/.test(raw) ? raw.replace(/\.$/, '') : hostOf(String(urlOrHost));
  if (!host) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) return host; // IP literal
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 1) return host;
  const n = suffixOf(labels) + 1;
  return labels.slice(-n).join('.');
}

/**
 * Publisher key for independence: the registrable domain without its public suffix, so country mirrors of one
 * brand (tripplanner.example, tripplanner.invalid, tripplanner.co.uk) collapse into one publisher. Collisions only
 * make the rule stricter, never looser.
 */
export function publisherKey(urlOrHost) {
  const reg = registrableDomain(urlOrHost);
  if (!reg) return null;
  if (/^\d/.test(reg) || reg.includes(':')) return reg;
  const labels = reg.split('.');
  return labels.length > 1 ? labels.slice(0, labels.length - suffixOf(labels)).join('.') : reg;
}

// Developed by: LightAISolutions
