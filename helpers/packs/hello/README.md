# hello pack

The smallest helper pack. It exists so the framework has one pack that bundles, loads in the test mocks and exercises every registry: an extra envelope type (`greeting`), a command (`/hello`), a message handler, a snapshot provider, a daily job and a setup step.

- Manifest: `helper.json` (fields in `helpers/SPEC.md` §4)
- Code: `gas/hello.js`
- Bundle: `node helpers/tools/bundle.mjs hello` → `helpers/dist/hello/`
- Tests: `helpers/tests/pack_hello.test.js`

Developed by: LightAISolutions
