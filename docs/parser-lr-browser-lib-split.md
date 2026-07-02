# parser-lr: browser-safe library / Node CLI split

**Audience:** agent working on [parser-lr](https://github.com/adamrmoss/parser-lr)  
**Consumer:** [edu-basic](https://github.com/adamrmoss/edu-basic) (`parser-lr@0.6.1`)

## Required architecture

| Artifact | Node dependencies | Runs in browser |
|----------|-------------------|-----------------|
| **Library** (`parser-lr` package entry, `dist/lib/`) | **None** | **Yes** |
| **CLI** (`bin/parser-lr.js`) | **All** (`fs`, `path`, `url`, grammar reading, `import.meta`) | No |

The CLI is a bundled binary that includes everything it needs. The library is a parse runtime only: load a pre-generated table JSON, lex, parse, return AST.

Grammar-file reading and table generation belong in the CLI (and optionally a separate Node-only subpath). They must not be on the main library import graph.

## Current failure

`ng build` in edu-basic fails:

```text
Could not resolve "node:fs"
Could not resolve "node:path"
Could not resolve "node:url"
```

Import chain from `import { ParseContext } from 'parser-lr'`:

```text
dist/lib/index.js
  → grammar/index.js
    → read-grammar.js
      → meta-grammar-table.js      (readFileSync)
        → grammar-json-path.esm.js (import.meta.url)
```

Also: `dist/lib/parse-context.js` has a **top-level** `import { readGrammar } from './grammar/read-grammar.js'`, so `ParseContext.fromTableJson` still pulls grammar code even though edu-basic never calls `fromGrammar`.

Edu-basic runtime use: `ParseContext.fromTableJson(prebuiltTableJson)` → `lex` / `parseSource`. No `.grammar` files at runtime.

## Required changes

### 1. Library entry has no Node imports

`dist/lib/index.js` (and CJS twin) must not statically import:

- `read-grammar.js`
- `meta-grammar-table.js`
- `grammar-json-path*.js`
- any `node:*` module

### 2. `ParseContext` must not statically import grammar

`fromTableJson` / table branch of `fromSources` must work without loading grammar modules.

Options (pick one):

- Remove `fromGrammar` from the main library export; grammar construction lives in CLI only.
- Keep `fromGrammar` but implement it with **lazy** `import()` inside the method so it is not in the static graph.

### 3. Grammar APIs off the main entry

If Node consumers still need grammar-file APIs, expose them on a **separate** subpath only, e.g. `parser-lr/grammar`:

- `readGrammar`
- `validateGrammarTable`
- `formatTableValidationIssues`
- `Grammar`, `AstSchema`, `TransformSchema`

Do not re-export these from the main `parser-lr` entry.

### 4. CLI bundles all Node code

`bin/parser-lr.js` must include grammar reading, meta-grammar bootstrap, and filesystem path resolution. Fix the existing bug where CLI looks for `bin/grammar.json` instead of `dist/lib/grammar/grammar.json` (see symptom below).

### 5. Lazy meta-grammar on grammar path

Even on the grammar/CLI path, do not load `grammar.json` or evaluate `import.meta` at module evaluation time. Load on first `readGrammar()` / `metaGrammarTable()` call.

## Library exports (minimum for edu-basic)

Main entry must export at least:

- `ParseContext`
- `AstNode`
- `Token` (type)
- `isEofToken`

Add other runtime symbols only if existing parser-lr tests require them on the main entry.

## Acceptance tests

Run all of these against **`npm pack` output**, not only the dev tree.

### A. Browser bundle

esbuild must succeed:

```javascript
// entry.mjs
import { ParseContext } from 'parser-lr';
```

```bash
esbuild entry.mjs --bundle --platform=browser --outfile=/tmp/out.js
```

Exit 0. No `node:fs`, `node:path`, or `node:url` resolution errors.

### B. Table-only runtime (ESM)

```javascript
import { ParseContext } from 'parser-lr';
import { readFileSync } from 'node:fs';

const table = JSON.parse(readFileSync('grammars/calc.table.json', 'utf8'));
const ctx = ParseContext.fromTableJson(JSON.stringify(table));
const ast = ctx.parseSource('1 + 2');
if (!ast) throw new Error('parse failed');
```

Must not throw `import.meta` errors. Must not require `grammar.json` on disk for this import.

### C. Table-only runtime (CJS)

```javascript
const { ParseContext } = require('parser-lr');
// same table smoke as B
```

### D. CLI from tarball

```bash
npm pack
tmpdir=$(mktemp -d)
tar -xzf parser-lr-*.tgz -C "$tmpdir"
cd "$tmpdir/package"
node bin/parser-lr.js table validate -g grammars/calc.grammar
node bin/parser-lr.js table generate -g grammars/calc.grammar -o /tmp/calc.json -a lalr
```

Both exit 0.

### E. Grammar subpath (if implemented)

```bash
node -e "import('parser-lr/grammar').then(m => console.log(typeof m.readGrammar))"
```

Must not be required for tests A–C.

## Known CLI bug (fix while here)

```bash
npx parser-lr table validate -g grammars/calc.grammar
# ENOENT: .../node_modules/parser-lr/bin/grammar.json
```

`grammar.json` exists under `dist/lib/grammar/` but CLI resolves relative to `bin/`.

## After release

edu-basic will:

1. Bump `parser-lr` to the new version.
2. Re-run `npm run build` (Angular) and `npm test`.
3. No browser polyfills for Node built-ins.

Target version: **0.7.0** (export map changes, ESM-only, grammar subpath).

## Non-goals

- No change to parse semantics, table JSON format, or identity AST shape.
- No requirement for edu-basic to stub `node:*` in the browser bundle.
