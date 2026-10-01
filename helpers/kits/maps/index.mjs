#!/usr/bin/env node
/**
 * Maps kit — library entry and CLI (`node helpers/kits/maps/index.mjs <command> …`; `node vendor/helpers/kits/maps/index.mjs …`
 * from a private repo — Node does not resolve a bare directory to index.mjs). Contract: README.md in this directory. Exit 0 = ok, 1 = failure (incl. a refused call), 2 = usage.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export * from './lib/maps-errors.mjs';
export * from './lib/maps-skus.mjs';
export * from './lib/maps-masks.mjs';
export * from './lib/maps-ledger.mjs';
export { createHttpsTransport, proxyFor } from './lib/maps-transport.mjs';
export { placeDetails, textSearch } from './lib/maps-places.mjs';
export * from './lib/maps-routes.mjs';
export * from './lib/maps-urls.mjs';
export * from './lib/maps-snapshots.mjs';
export { createMapsClient } from './lib/maps-client.mjs';
export { createMockTransport, fixtureResponder, fixture } from './lib/maps-mock-transport.mjs';

import { runCli } from './lib/maps-cli.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(e.message); process.exitCode = 1; });
}

// Developed by: LightAISolutions
