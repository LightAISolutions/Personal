/**
 * Maps kit — HTTPS transport with zero dependencies. When HTTPS_PROXY is set (Claude Code cloud environments) and the
 * host is not in NO_PROXY, the request goes through an HTTP CONNECT tunnel to that proxy, then TLS to the real host with
 * normal certificate verification (Node reads NODE_EXTRA_CA_CERTS at start-up, which those environments point at the
 * proxy CA bundle). TLS verification is never disabled. Built-in fetch is not used because on Node 22 it ignores
 * HTTPS_PROXY unless the process was started with NODE_USE_ENV_PROXY=1.
 * Note: `createConnection` is honoured only when no `agent` is given (agent:false would silently connect DIRECTLY,
 * bypassing the proxy and its credential injection — seen in the first live smoke, decisions WP-2a).
 * The transport never logs; callers must not log `req.headers` (they may carry a caller-supplied key).
 * transport(req) → Promise<{ status, headers, text, bytes, ms }>, req = { method, url, headers, body, timeoutMs }
 * (`bytes` is the raw body — the Static Maps client reads PNGs from it; `text` is its UTF-8 reading).
 */
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { MapsRequestError } from './maps-errors.mjs';

/** proxyFor('places.googleapis.com', env) → URL of the proxy to use, or null for a direct connection. */
export function proxyFor(host, env = process.env) {
  const p = env.HTTPS_PROXY || env.https_proxy;
  if (!p) return null;
  const list = String(env.NO_PROXY || env.no_proxy || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const h = host.toLowerCase();
  for (const raw of list) {
    if (raw === '*') return null;
    const d = raw.replace(/^\*?\./, '');
    if (/^[\d.:/]+$/.test(raw)) { if (h === raw) return null; continue; } // literal IPs / CIDRs: exact host only
    if (h === d || h.endsWith('.' + d)) return null;
  }
  return new URL(p);
}

function openTunnel(proxy, host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: proxy.hostname, port: proxy.port || 80, method: 'CONNECT', path: `${host}:${port}`, headers: { Host: `${host}:${port}` }, timeout: timeoutMs });
    req.once('connect', (res, socket) => {
      if (res.statusCode !== 200) { socket.destroy(); return reject(new MapsRequestError('PROXY_REFUSED', `maps: proxy refused CONNECT to ${host} (HTTP ${res.statusCode})`, { status: res.statusCode, host })); }
      socket.on('error', () => {}); // a late reset from the proxy after the response is not an error of this call
      resolve(socket);
    });
    req.once('timeout', () => req.destroy(new MapsRequestError('TIMEOUT', `maps: proxy CONNECT to ${host} timed out`, { host })));
    req.once('error', (e) => reject(e instanceof MapsRequestError ? e : new MapsRequestError('NETWORK', `maps: proxy connection failed (${e.code || e.message})`, { host })));
    req.end();
  });
}

/** The default transport. `env` is injectable for tests. */
export function createHttpsTransport({ env = process.env } = {}) {
  return async function transport({ method = 'GET', url, headers = {}, body = null, timeoutMs = 20000 }) {
    const u = new URL(url);
    if (u.protocol !== 'https:') throw new MapsRequestError('BAD_URL', 'maps: only https URLs are allowed');
    const port = Number(u.port || 443);
    const proxy = proxyFor(u.hostname, env);
    const started = Date.now();
    const socket = proxy ? await openTunnel(proxy, u.hostname, port, timeoutMs) : null;
    const payload = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const opts = {
      method, host: u.hostname, port, path: u.pathname + u.search, timeout: timeoutMs,
      headers: { ...headers, ...(payload ? { 'Content-Length': payload.length } : {}) }
    };
    if (socket) { opts.createConnection = () => tls.connect({ socket, servername: u.hostname }).on('error', () => {}); }
    return new Promise((resolve, reject) => {
      const req = https.request(opts, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => { if (socket) socket.destroy(); const bytes = Buffer.concat(chunks); resolve({ status: res.statusCode, headers: res.headers, text: bytes.toString('utf8'), bytes, ms: Date.now() - started }); });
        res.on('error', (e) => reject(new MapsRequestError('NETWORK', `maps: response error (${e.code || e.message})`)));
      });
      req.once('timeout', () => req.destroy(new MapsRequestError('TIMEOUT', `maps: request to ${u.hostname} timed out after ${timeoutMs} ms`)));
      req.once('error', (e) => { if (socket) socket.destroy(); reject(e instanceof MapsRequestError ? e : new MapsRequestError('NETWORK', `maps: request to ${u.hostname} failed (${e.code || e.message})`)); });
      if (payload) req.write(payload);
      req.end();
    });
  };
}

// Developed by: LightAISolutions
