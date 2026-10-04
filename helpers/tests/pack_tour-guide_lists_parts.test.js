'use strict';
// Tour Guide — Lists: readSavedExports (TG-PHASE-14 WP-14f), one Takeout export split into parts (Takeout names them
// takeout-<stamp>-001.zip, -002.zip, …). The lists are merged by name across parts, in part order, and the limits hold
// for the export as a whole. Archives are built here by the test's own code; invented lists in the town of Quillmere.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

const L = () => import('../packs/tour-guide/lists/index.mjs');
const J = (v) => JSON.parse(JSON.stringify(v));

/* ---------------- archive builders ---------------- */
function tarEntry(name, data) {
  const body = Buffer.from(data), h = Buffer.alloc(512);
  h.write(name, 0, 100, 'utf8');
  h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
  h.write(body.length.toString(8).padStart(11, '0') + '\0', 124);
  h.write('00000000000\0', 136); h.fill(' ', 148, 156); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
  let sum = 0; for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return Buffer.concat([h, body, Buffer.alloc((512 - (body.length % 512)) % 512)]);
}
const tgz = (files) => zlib.gzipSync(Buffer.concat([...Object.entries(files).map(([n, d]) => tarEntry(n, d)), Buffer.alloc(1024)]));
function zip(files) {
  const locals = [], central = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const raw = Buffer.from(data), nm = Buffer.from(name, 'utf8'), comp = zlib.deflateRawSync(raw), crc = zlib.crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    locals.push(lh, nm, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, nm);
    offset += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22), n = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(n, 8); end.writeUInt16LE(n, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
/** A Saved CSV with the given place titles (a Quillmere search link each). */
const csv = (...titles) => 'Title,Note,URL,Comment\n,,,\n' + titles.map((t) => `${t},,https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)},`).join('\n') + '\n';
const titles = (list) => list.items.map((i) => i.title);
const P1 = () => ({ file: 'takeout-20270420T101500Z-001.zip', bytes: zip({ 'Takeout/Saved/Dinner spots.csv': csv('Lantern Noodle House', 'Moss and Pine'), 'Takeout/Saved/Rainy day.csv': csv('Clock Museum') }) });
const P2 = () => ({ file: 'takeout-20270420T101500Z-002.tgz', bytes: tgz({ 'Takeout/Saved/Dinner spots.csv': csv('Willow Green'), 'Takeout/Saved/Picnic.csv': csv('Reed Mill Meadow') }) });

test('readSavedExports: lists merged by name across parts (a zip and a tgz), items in part order, sorted by name; exported from index.mjs', async () => {
  const { readSavedExports } = await L();
  const r = readSavedExports([P1(), P2()]);
  assert.deepEqual(r.lists.map((l) => l.name), ['Dinner spots', 'Picnic', 'Rainy day']);
  assert.deepEqual(titles(r.lists[0]), ['Lantern Noodle House', 'Moss and Pine', 'Willow Green']);
  assert.deepEqual(titles(r.lists[1]), ['Reed Mill Meadow']);
  assert.equal(r.lists[0].items[2].url, 'https://www.google.com/maps/search/?api=1&query=Willow%20Green');
  assert.deepEqual(r.skipped, []);
  assert.equal(r.partial, false);
  assert.ok(r.lists.every((l) => !('truncated' in l)));
  // The other order of parts: the same lists, the items in that order.
  assert.deepEqual(titles(readSavedExports([P2(), P1()]).lists[0]), ['Willow Green', 'Lantern Noodle House', 'Moss and Pine']);
});

test('readSavedExports: one part gives exactly readSavedExport\'s result; no parts give an empty read', async () => {
  const { readSavedExports, readSavedExport } = await L();
  for (const p of [P1(), P2(), { file: 'takeout-20270420T101500Z-001.zip', bytes: Buffer.from('not an archive') }]) {
    assert.deepEqual(J(readSavedExports([p])), J(readSavedExport(p.bytes, { file: p.file })), p.file);
  }
  const lim = { items_per_list: 1 };
  assert.deepEqual(J(readSavedExports([P1()], { limits: lim })), J(readSavedExport(P1().bytes, { file: P1().file, limits: lim })));
  assert.deepEqual(J(readSavedExports([])), { lists: [], skipped: [], partial: false });
});

test('readSavedExports: a damaged part makes the read partial; the other part\'s lists are kept and the damage is named', async () => {
  const { readSavedExports } = await L();
  const bad = { file: 'takeout-20270420T101500Z-002.zip', bytes: P2().bytes.subarray(0, 40) };
  bad.bytes = Buffer.from(bad.bytes.toString('latin1').replace(/^\x1f\x8b/, 'PK'), 'latin1');   // a zip in name only
  const r = readSavedExports([P1(), bad]);
  assert.equal(r.partial, true);
  assert.deepEqual(r.lists.map((l) => l.name), ['Dinner spots', 'Rainy day']);
  assert.deepEqual(r.skipped, [{ file: 'takeout-20270420T101500Z-002.zip', reason: 'not a readable .zip archive' }]);
  // A list truncated in one part stays truncated in the merge.
  const cut = readSavedExports([P1(), P2()].map((p, i) => (i === 0 ? { ...p, bytes: zip({ 'Takeout/Saved/Dinner spots.csv': csv('A', 'B', 'C') }) } : p)), { limits: { items_per_list: 2 } });
  assert.equal(cut.partial, true);
  assert.equal(cut.lists.find((l) => l.name === 'Dinner spots').truncated, true);
});

test('readSavedExports: the limits hold for the whole export — items in all, lists, items in one merged list', async () => {
  const { readSavedExports } = await L();
  // Items in all: 4. Part one reads 3; part two only 1 more; a third part is not read at all.
  const p3 = { file: 'takeout-20270420T101500Z-003.zip', bytes: zip({ 'Takeout/Saved/Late.csv': csv('Quill Bakery') }) };
  const p2 = { file: 'takeout-20270420T101500Z-002.zip', bytes: zip({ 'Takeout/Saved/Picnic.csv': csv('Meadow One', 'Meadow Two', 'Meadow Three') }) };
  let r = readSavedExports([P1(), p2, p3], { limits: { items: 4 } });
  assert.equal(r.lists.reduce((s, l) => s + l.items.length, 0), 4);
  assert.deepEqual(titles(r.lists.find((l) => l.name === 'Picnic')), ['Meadow One']);
  assert.equal(r.lists.find((l) => l.name === 'Picnic').truncated, true);
  assert.equal(r.partial, true);
  assert.ok(r.skipped.some((s) => s.file === 'Takeout/Saved/Picnic.csv' && /limit of 4 items in all/.test(s.reason)), JSON.stringify(r.skipped));
  assert.ok(r.skipped.some((s) => s.file === 'takeout-20270420T101500Z-003.zip' && /limit of 4 items in all/.test(s.reason) && /not read/.test(s.reason)));
  assert.equal(r.lists.some((l) => l.name === 'Late'), false);

  // Lists: 2. A name already seen merges; a third name is not read.
  r = readSavedExports([P1(), P2()], { limits: { lists: 2 } });
  assert.deepEqual(r.lists.map((l) => l.name), ['Dinner spots', 'Rainy day']);
  assert.deepEqual(titles(r.lists[0]), ['Lantern Noodle House', 'Moss and Pine', 'Willow Green']);
  assert.equal(r.partial, true);
  assert.ok(r.skipped.some((s) => s.file === 'Takeout/Saved/Picnic.csv' && /limit of 2 lists/.test(s.reason)));

  // Items in one list: 2, counted across parts.
  r = readSavedExports([P1(), P2()], { limits: { items_per_list: 2 } });
  assert.deepEqual(titles(r.lists.find((l) => l.name === 'Dinner spots')), ['Lantern Noodle House', 'Moss and Pine']);
  assert.equal(r.lists.find((l) => l.name === 'Dinner spots').truncated, true);
  assert.equal(r.partial, true);
  assert.ok(r.skipped.some((s) => s.file === 'Takeout/Saved/Dinner spots.csv' && /limit of 2 items in a list/.test(s.reason)));
});

// Developed by: LightAISolutions
