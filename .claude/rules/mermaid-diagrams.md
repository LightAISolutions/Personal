---
paths:
  - "repository-information/REPO-ARCHITECTURE.md"
  - "repository-information/diagrams/**"
# Path-scoped: this file holds the deep mermaid reference (rendering
# compatibility table, theme overrides, pako URL generation process, failure
# modes). It only auto-injects when REPO-ARCHITECTURE.md or a per-environment
# diagram is being edited. Everyday repo-docs responses don't need it — the
# brief rule lives in repo-docs.md.
---

# Mermaid Diagrams — Deep Reference

*Companion to `repo-docs.md`. Path-scoped so it only injects when actually editing diagrams. The brief rule ("every diagram must include an Open in mermaid.live link") lives in `repo-docs.md`.*

## Diagram Accuracy Requirements

Every diagram must faithfully represent the actual source code it documents. **Do not invent, simplify, or assume behaviors** — read the code first. These criteria apply to all diagrams in `REPO-ARCHITECTURE.md`, `repository-information/diagrams/`, and any future diagram files:

1. **Cross-reference against source code** — before creating or modifying a diagram, read the actual source file(s) it describes. For template-level behaviors, read the HTML templates (`HtmlAndGasTemplateAutoUpdate-noauth.html.txt`/`HtmlAndGasTemplateAutoUpdate-auth.html.txt`) and the GAS script templates. For per-environment diagrams, read the specific page's HTML and `.gs` files. Never diagram from memory or assumption
2. **No invented interactions** — only show messages, events, and state transitions that exist in the code. If a `postMessage` handler doesn't exist, don't diagram it. If a function isn't called, don't show it being called. The most common error is inventing plausible-sounding interactions that seem like they should exist but don't (e.g. a `gas-reload` postMessage that was never implemented)
3. **Distinguish server-side vs. client-side** — GAS scripts run on Google's servers (triggered by HTTP requests), not in the browser. Sequence diagrams must show server-side operations as interactions between the GAS participant and external services (GitHub API, Apps Script API), not as browser-to-GAS messages. Client-side detection of changes (e.g. gs.version.txt polling) is a separate flow from the server-side update itself
4. **State machines must reflect real code paths** — every state, transition, and condition in a `stateDiagram-v2` must map to an actual code construct (variable check, function call, setTimeout, event listener). Include error states, conditional branches, and timing values (delays, intervals) that exist in the code. Don't collapse distinct code paths into a single transition for "simplicity" if it misrepresents the behavior
5. **Show timing and sequencing accurately** — if the code uses a 15s initial delay before starting a polling loop, show it. If there's an anti-sync mechanism that adds padding when two polls overlap, show it. These details matter for understanding actual runtime behavior
6. **Maintenance mode is a conditional, not a separate machine** — in the template source, maintenance mode is checked as a flag within the HTML version polling loop, not as an independent state machine. Diagrams should reflect this structural relationship
7. **Verify mermaid.live URLs decompress correctly** — after every URL update, run the decompression verification (see "Mandatory verification" below). A URL that looks valid but fails to decompress is useless

## Mermaid Diagram Compatibility Reference

REPO-ARCHITECTURE.md contains 9 diagrams across different mermaid types. Each has different rendering support and theme requirements. **Follow these rules when adding or modifying diagrams.**

### Rendering support by diagram type

| # | Type | Mermaid Syntax | GitHub Renders? | Theme Required? |
|---|------|---------------|-----------------|-----------------|
| 1 | Flowchart | `graph TB` | Yes | No — use per-node `style` directives for colors |
| 2 | Sequence | `sequenceDiagram` | Yes | No — works natively |
| 3 | State (Template Behaviors) | `stateDiagram-v2` | Yes | No — works natively |
| 4 | Git Graph | `gitGraph` | Yes | No — works natively |
| 5 | Architecture | `architecture-beta` | **No** | N/A — mermaid.live link only |
| 6 | C4 Context | `C4Context` | **No** | N/A — mermaid.live link only |
| 7 | Mindmap | `mindmap` | Yes | **Yes** — requires `base` theme with custom colors (see below) |
| 8 | ER Diagram | `erDiagram` | Yes | No — works natively |
| 9 | Class Diagram | `classDiagram` | Yes | No — works natively |

### Diagrams that GitHub cannot render

`architecture-beta` and `C4Context` are not supported by GitHub's mermaid renderer. For these:
- Do **not** include a `` ```mermaid `` code block (it would show an error on GitHub)
- Provide only a mermaid.live link with a note: *"This diagram type is not supported by GitHub's mermaid renderer — use the link above to view it."*

### Diagrams that GitHub renders — all must include both

For all 7 GitHub-renderable types, always include:
1. A mermaid.live link above the code block (for interactive editing, pan/zoom, export)
2. A `` ```mermaid `` code block (for inline rendering on GitHub)

### Dark-mode text readability — the Mindmap problem

GitHub and mermaid.live both support dark mode. Most diagram types handle dark-mode text automatically — the renderer inverts text colors to stay readable. **Mindmaps are the exception.** Without theme overrides, mindmap nodes get colored backgrounds (via `cScale`) but the text color may remain light/white on light backgrounds, making labels unreadable.

**The fix** — use the `base` theme with explicit color overrides:

```
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#7ba3d4',
  'primaryTextColor': '#000000',
  'cScale0': '#e8b4b8',
  'cScale1': '#b8d4e8',
  'cScale2': '#b8e8c8',
  'cScale3': '#e8d4b8',
  'cScale4': '#d4b8e8',
  'cScaleLabel0': '#000000',
  'cScaleLabel1': '#000000',
  'cScaleLabel2': '#000000',
  'cScaleLabel3': '#000000',
  'cScaleLabel4': '#000000',
  'cScaleInv0': '#000000',
  'cScaleInv1': '#000000',
  'cScaleInv2': '#000000',
  'cScaleInv3': '#000000',
  'cScaleInv4': '#000000'
}}}%%
```

**What each variable controls:**
- `primaryColor` / `primaryTextColor` — the root node's fill and text color
- `cScale0`–`cScale4` — background colors for branch depth levels 1–5 (pastel palette for readability)
- `cScaleLabel0`–`cScaleLabel4` — text color per depth level (force `#000000` for black text)
- `cScaleInv0`–`cScaleInv4` — inverted/alternate text color per depth level (also force `#000000`)

**Why `base` theme, not `default` or `neutral`:**
- `default` theme: ignores `cScaleLabel` and `cScaleInv` — text stays white on dark mode
- `neutral` theme: makes the entire diagram grayscale — loses the colorful branch distinction
- `base` theme: gives full control over all theme variables — colors and text both respond to overrides

**Why all three text variables are needed:**
- `cScaleLabel` alone is insufficient — mermaid's mindmap renderer uses different CSS classes at different depths
- `cScaleInv` catches the alternate text path used by some depth levels
- `primaryTextColor` catches the root node specifically
- Setting all three to `#000000` guarantees black text at every depth in both light and dark mode

### Flowchart node colors

Flowcharts use per-node `style` directives instead of theme variables:
```
style NODE_ID fill:#4a90d9,color:#fff
```
These work in both light and dark mode because the fill and text color are explicitly set per node. No theme directive is needed.

## Mermaid.live URL Generation — the Pako Encoding Process

Every diagram has an "Open in mermaid.live" link using pako-compressed, base64url-encoded JSON. The format: `https://mermaid.live/edit#pako:<encoded>`. The encoded payload is `pako.deflate(level 9)` of a JSON state object `{code, mermaid: JSON.stringify({theme:'default'}), autoSync:true, updateDiagram:true}`, then base64url-encoded (URL-safe alphabet, no padding).

### Setup (once per session)

```bash
npm install --prefix /tmp pako js-base64
```

### Generation command (per diagram)

The extraction must target a specific diagram by its unique first-line marker (`graph TB`, `sequenceDiagram`, `mindmap`, etc.) — the trivial `indexOf('```mermaid\n')` only finds the first block.

```javascript
node -e "
const pako=require('/tmp/node_modules/pako');
const{fromUint8Array}=require('/tmp/node_modules/js-base64');
const fs=require('fs');
const f=fs.readFileSync('repository-information/REPO-ARCHITECTURE.md','utf8');
const marker='<UNIQUE_FIRST_LINE>';  // e.g. 'graph TB', 'sequenceDiagram', 'mindmap'
const startSearch=f.indexOf(marker);
const codeStart=f.lastIndexOf('\`\`\`mermaid\n', startSearch)+'\`\`\`mermaid\n'.length;
const codeEnd=f.indexOf('\n\`\`\`', startSearch);
const code=f.substring(codeStart, codeEnd);
const state={code:code,mermaid:JSON.stringify({theme:'default'}),autoSync:true,updateDiagram:true};
const compressed=pako.deflate(new TextEncoder().encode(JSON.stringify(state)),{level:9});
const url='https://mermaid.live/edit#pako:'+fromUint8Array(compressed,true);
fs.writeFileSync('/tmp/mermaid_url.txt', url);
console.log('done, code length:', code.length);
"
```

For `architecture-beta` / `C4Context` (no code block in file), pass the mermaid code as a string literal instead.

### ⚠️ NEVER use the Edit tool to insert raw pako URLs

Encoded URLs are ~1000–3000 chars of dense base64. The Edit tool can silently corrupt individual characters, producing a valid-looking URL that fails to decompress. **Use Python regex replacement instead**:

```python
python3 << 'PYEOF'
import re
with open('repository-information/REPO-ARCHITECTURE.md') as f: content = f.read()
with open('/tmp/mermaid_url.txt') as f: new_url = f.read().strip()
old_pattern = r'(\[Open in mermaid\.live — DIAGRAM_NAME\]\()https://mermaid\.live/edit#pako:[^)]+(\))'
content_new = re.sub(old_pattern, r'\g<1>' + new_url + r'\g<2>', content)
with open('repository-information/REPO-ARCHITECTURE.md', 'w') as f: f.write(content_new)
PYEOF
```
Replace `DIAGRAM_NAME` with the specific link label (`Flowchart`, `Sequence`, `Mindmap`, etc.).

### Mandatory verification (after every URL update)

```python
python3 -c "
import base64,zlib,json,re
f=open('repository-information/REPO-ARCHITECTURE.md').read()
m=re.search(r'DIAGRAM_NAME\]\(https://mermaid\.live/edit#pako:([^\)]+)', f)
e=m.group(1); p=e+'='*((4-len(e)%4)%4)
d=zlib.decompress(base64.urlsafe_b64decode(p))
print('OK —',len(json.loads(d)['code']),'chars')
"
```
If decompression fails, the URL is corrupted — regenerate.

### Common failure modes

- **Edit tool corruption** — #1 cause of broken URLs (see the ⚠️ rule above)
- **Wrong code-extraction boundaries** — off-by-one on `` ```mermaid\n `` / `` \n``` `` fences includes fence markers or misses init directives. Always log `code.length` and sanity-check
- **Multiple code blocks** — plain `indexOf` finds only the first; use a unique first-line marker to target specific diagrams
- **mermaid.live-only diagrams** — `architecture-beta` and `C4Context` exist only as URLs (no code block). To modify: decode existing URL → edit code → re-encode → update link
- **Theme collision** — the state object's `mermaid:{theme:'default'}` and any in-code `%%{init: ...}%%` directive are independent; the `%%{init}%%` directive wins at render time. Always set the state object's theme to `'default'` regardless of what the code says
- **Base64url vs standard base64** — mermaid.live uses URL-safe alphabet (`-`/`_` not `+`/`/`, no `=` padding). `js-base64`'s `fromUint8Array(bytes, true)` produces this; Python's `urlsafe_b64decode` handles it but you must re-add `=` padding first
- **Batch regeneration** — process each diagram sequentially (not all at once). Cross-contamination (wrong code in wrong URL) is too likely when batching all 9 in a single command

## Adding New Diagrams

When adding a new diagram to REPO-ARCHITECTURE.md:
1. Check if the diagram type is GitHub-renderable (test on GitHub or check the mermaid docs)
2. If renderable: include both mermaid.live link + code block
3. If not renderable: include only mermaid.live link + explanatory note
4. If the diagram type uses `cScale` for colored regions (mindmap, timeline, etc.): apply the `base` theme fix above
5. For all other renderable types: no theme directive needed — they handle dark mode automatically
6. Generate the mermaid.live pako URL using the process above — never construct it manually
7. Always verify the URL decompresses correctly before committing
8. Always include the collapsible `<details>` raw code section below the diagram (for GitHub-renderable types)

Developed by: LightAISolutions
