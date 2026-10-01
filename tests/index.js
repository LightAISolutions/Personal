'use strict';
/**
 * Entry point for `node --test helpers/tests/` — Node resolves the directory to this file, which loads every
 * helpers/tests/*.test.js (packs add tests/pack_<name>_*.test.js; they are picked up automatically).
 */
const fs = require('node:fs');
const path = require('node:path');
for (const f of fs.readdirSync(__dirname).sort()) {
  if (/\.test\.js$/.test(f)) require(path.join(__dirname, f));
}

// Developed by: LightAISolutions
