'use strict';
// Maps kit — proxy selection, the CONNECT tunnel actually being used (regression: agent:false bypassed it), proxy
// refusals, and the CLI's refusal to touch the network without --live and a ledger. Local sockets only; no internet.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const kit = () => import('../kits/maps/index.mjs');
const CLI = path.join(__dirname, '..', 'kits', 'maps', 'index.mjs');

test('proxyFor honours HTTPS_PROXY and NO_PROXY (exact hosts, suffixes, *.wildcards)', async () => {
  const k = await kit();
  const env = { HTTPS_PROXY: 'http://127.0.0.1:9', NO_PROXY: 'localhost,127.0.0.1,10.0.0.0/8,.svc.cluster.local,*.internal.example.com' };
  assert.equal(k.proxyFor('places.googleapis.com', env).port, '9');
  assert.equal(k.proxyFor('localhost', env), null);
  assert.equal(k.proxyFor('a.svc.cluster.local', env), null);
  assert.equal(k.proxyFor('x.internal.example.com', env), null);
  assert.equal(k.proxyFor('places.googleapis.com', {}), null);
  assert.equal(k.proxyFor('routes.googleapis.com', { https_proxy: 'http://127.0.0.1:8', NO_PROXY: '*' }), null);
});

function fakeProxy(onConnect) {
  return new Promise((resolve) => {
    const seen = { connect: null, tlsHello: false };
    const srv = net.createServer((sock) => {
      let buf = Buffer.alloc(0), tunnel = false;
      sock.on('data', (d) => {
        if (tunnel) { if (d[0] === 0x16) seen.tlsHello = true; sock.destroy(); return; }
        buf = Buffer.concat([buf, d]);
        const s = buf.toString('latin1');
        if (!s.includes('\r\n\r\n')) return;
        seen.connect = s.split('\r\n')[0];
        const status = onConnect(seen.connect);
        sock.write(`HTTP/1.1 ${status} X\r\n\r\n`);
        if (status === 200) tunnel = true; else sock.end();
      });
      sock.on('error', () => {});
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, seen, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}

test('with HTTPS_PROXY the request goes through a CONNECT tunnel and starts TLS inside it', async () => {
  const k = await kit();
  const p = await fakeProxy(() => 200);
  const t = k.createHttpsTransport({ env: { HTTPS_PROXY: p.url } });
  const err = await t({ method: 'POST', url: 'https://places.googleapis.com/v1/places:searchText', headers: { 'X-Goog-FieldMask': 'places.id' }, body: { textQuery: 'x' }, timeoutMs: 3000 }).catch((e) => e);
  p.srv.close();
  assert.equal(p.seen.connect, 'CONNECT places.googleapis.com:443 HTTP/1.1');
  assert.ok(p.seen.tlsHello, 'the TLS ClientHello travelled through the tunnel, not around it');
  assert.equal(err.code, 'NETWORK', 'the fake proxy hangs up after the hello');
});

test('a proxy refusal surfaces as PROXY_REFUSED with the status', async () => {
  const k = await kit();
  const p = await fakeProxy(() => 403);
  const err = await k.createHttpsTransport({ env: { HTTPS_PROXY: p.url } })({ url: 'https://routes.googleapis.com/x', timeoutMs: 3000 }).catch((e) => e);
  p.srv.close();
  assert.equal(err.code, 'PROXY_REFUSED');
  assert.equal(err.status, 403);
  await assert.rejects(k.createHttpsTransport({ env: {} })({ url: 'http://places.googleapis.com/' }), (e) => e.code === 'BAD_URL');
});

function cli(args, env = {}) {
  const e = { ...process.env, ...env };
  delete e.MAPS_USAGE_LEDGER;
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...e, ...env }, timeout: 20000 });
}

test('CLI: masks and url work offline; network commands refuse without --live and a ledger', () => {
  const m = cli(['masks']);
  assert.equal(m.status, 0);
  assert.ok(JSON.parse(m.stdout).place_details.enterprise.sku === 'places.details.enterprise');
  const u = cli(['url', 'place', '--json', '{"name":"Old Signal Tower","placeId":"FixtureVelmoraTower02"}']);
  assert.equal(u.stdout.trim(), 'https://www.google.com/maps/search/?api=1&query=Old%20Signal%20Tower&query_place_id=FixtureVelmoraTower02');
  const d = cli(['details', 'FixtureVelmoraMuseum01']);
  assert.equal(d.status, 2);
  assert.match(d.stderr, /--live/);
  const s = cli(['smoke', '--live']);
  assert.equal(s.status, 2);
  assert.match(s.stderr, /ledger/);
  assert.equal(cli(['nonsense']).status, 2);
});

test('CLI: offline smoke runs the three calls on fixtures and prints the counter', () => {
  const r = cli(['smoke']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /places\.text_search\.pro\s+1\s+1\s+0/);
  assert.match(r.stdout, /places\.details\.enterprise\s+1\s+1\s+0/);
  assert.match(r.stdout, /routes\.compute_routes\.essentials\s+1\s+1\s+0/);
});

test('live smoke runs only by hand: node helpers/kits/maps/index.mjs smoke --live --ledger <path>', (t) => {
  t.skip('needs the Claude HQ Maps credential and the network; see helpers/decisions/WP-2a.md for the recorded run');
});

// Developed by: LightAISolutions
