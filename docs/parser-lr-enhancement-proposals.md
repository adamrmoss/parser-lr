# parser-lr open requests (EduBASIC)

Audience: agents working on [parser-lr](https://github.com/adamrmoss/parser-lr).

Consumer: **edu-basic** (`parser-lr` **0.5.0** in [`package.json`](../package.json)). Reference grammar: [`src/lang/parsing/grammars/edu-basic.grammar`](../src/lang/parsing/grammars/edu-basic.grammar).

This document lists **only what parser-lr still needs to change**. Items resolved in 0.5.0 are noted so they are not re-opened.

---

## Resolved in 0.5.0 (no further work)

| Item | Notes |
|------|--------|
| **`pass()` preserves production symbol** | Bare `CLS` → `cls_stmt`, not `kw_cls`. Same for `PRINT`, `END`, `ELSE`, `WEND`, `DO`, `LOOP`, etc. |
| **`table validate` command** | Documented in README; implementation exists but is blocked by packaging bug below. |
| **CJS `require` export** | `package.json` `exports.require` → `dist/lib-cjs/index.js`. |

After upgrading to a build that includes the pass fix, EduBASIC can delete [`keyword-fallbacks.ts`](../src/lang/parsing/ast-bridge/statements/keyword-fallbacks.ts) (kept temporarily for older tables / edge cases).

---

## 1. CLI cannot find `grammar.json` (blocker)

### Symptom

```bash
npm run parser:table
# ENOENT: .../node_modules/parser-lr/bin/grammar.json
```

Same failure for:

```bash
npx parser-lr table validate -g src/lang/parsing/grammars/edu-basic.grammar
```

### Actual layout in published 0.5.0

| Path | Present? |
|------|----------|
| `dist/lib/grammar/grammar.json` | Yes |
| `dist/lib-cjs/grammar/grammar.json` | Yes |
| `bin/grammar.json` | **No** |

CLI bundle resolves meta-grammar relative to `bin/`, not `dist/lib/grammar/`.

### Required fix

Bundle CLI against the same `grammarJsonDirectory()` helper the library uses, or copy `grammar.json` beside `bin/parser-lr.js` in `prepack`.

### Acceptance test (parser-lr repo)

```bash
npm pack
tmpdir=$(mktemp -d)
tar -xzf parser-lr-*.tgz -C "$tmpdir"
cd "$tmpdir/package"
node bin/parser-lr.js table validate -g grammars/calc.grammar
node bin/parser-lr.js table generate -g grammars/calc.grammar -o /tmp/calc.json -a lalr
```

Both commands must exit 0 on a clean install from the tarball.

---

## 2. Table-only import must not load meta-grammar (blocker for Jest)

### Symptom

EduBASIC tests import `ParseContext` / `AstNode` from `parser-lr` only to parse a pre-built table. Jest fails:

```
SyntaxError: Cannot use 'import.meta' outside a module
  at grammar-json-path.esm.js
```

Import chain today:

```
dist/lib/index.js
  → grammar/index.js
    → read-grammar.js
      → meta-grammar-table.js  (readFileSync grammar.json at module load)
        → grammar-json-path.esm.js  (uses import.meta.url)
```

`readGrammar()` is not called; meta-grammar still loads because it sits on the public barrel.

### Required fix (pick one)

**Option A (preferred):** Lazy-load meta-grammar inside `readGrammar()` / `metaGrammarTable()` only. Do not import `meta-grammar-table.js` from `grammar/index.js` at top level. Split exports:

- `parser-lr` — parse runtime (`ParseContext`, `AstNode`, lexer, shift-reduce, transform)
- `parser-lr/grammar` or `parser-lr/read-grammar` — grammar file parsing (`readGrammar`, `validateGrammarTable`)

**Option B:** Ensure `dist/lib-cjs/` is safe under Jest without `import.meta`, and document that table-only consumers must `require('parser-lr')` (CJS). EduBASIC can point Jest at CJS, but the ESM entry should still not pull meta-grammar for consumers that only call `ParseContext.fromTableJson`.

### Acceptance test (parser-lr repo)

```javascript
// table-only-smoke.cjs — must not throw under plain node
const { ParseContext } = require('parser-lr');
const table = require('./grammars/calc.table.json'); // or generate inline
const ctx = ParseContext.fromTableJson(JSON.stringify(table));
console.log(ctx.parseSource('1 + 2')?.symbol);
```

```javascript
// table-only-smoke.mjs — same for ESM default entry
import { ParseContext } from 'parser-lr';
```

Neither import may read `grammar.json` or evaluate `import.meta`.

---

## 3. Preserve intermediate production nodes (high)

### Problem

`pass()` fix covers **bound slots** on statement dispatch (`[stmt]:cls_stmt`). Nested productions used inside statements still **flatten** when they have no `transform` rule, even when the grammar names them explicitly.

EduBASIC bridge code must scan for raw tokens or alternate shapes.

### 3a. `comparison_op` inside `case_selector`

**Grammar (already in edu-basic):**

```ebnf
case_selector =
    #relational kw_is comparison_op expr
  ;

comparison_op =
    #less less
  | #greater_equal greater_equal
  | … ;
```

`comparison_op` **has** expression-level transforms:

```ebnf
comparison_op ->
    #less pass(tok)
  | #greaterEqual pass(tok)
  | … ;
```

**Input:** `CASE IS < 0`

**Actual `case_selector` children (variant `relational`):** `kw_is`, `less`, `expr`

**Required:** `kw_is`, `comparison_op` (variant `less`, child `less`), `expr`

Without this, consumers match lexer token names (`less`, `greater_equal`) instead of the grammar non-terminal `comparison_op`.

### 3b. `let_target` inside `let_stmt`

**Grammar:**

```ebnf
let_stmt = kw_let let_target compound_op expr ;
let_target = identifier assn_path_suffix ;
```

**Input:** `LET x% = 1`

**Actual:** flat `identifier`, `equal`, `expr` under `let_stmt` (no `let_target` wrapper).

**Required:** `let_stmt` children include `let_target` wrapping `identifier` (and optional `assn_path_suffix`).

EduBASIC workaround: [`assignment-helpers.ts`](../src/lang/parsing/ast-bridge/assignment-helpers.ts) `buildLetAssignmentTarget` accepts bare `identifier` at statement root.

### 3c. `print_list` / `print_segment`

**Grammar:**

```ebnf
print_stmt = kw_print [ print_list ] ;
print_list = print_segment { print_segment } ;
print_segment = #bare expr | #trailingComma expr comma | … ;
```

Bridge must accept: `print_list` wrapper, `print_list$repeat_*` tails, bare `print_segment`, or trailing `postfix_expr` siblings interchangeably ([`io.ts`](../src/lang/parsing/ast-bridge/statements/io.ts) `buildPrintSegmentsFromStatement`).

**Required:** stable list shape matching expression `flatten` output (same as `expr_list`).

### Proposed semantics

When a CST node is a **non-terminal production** `P` and `P` has **no** `transform` rule:

1. Emit AST node `{ symbol: P, variant: <alt label>, children: [ transformed children ] }`.
2. Do **not** hoist single-child terminals to replace `P`.
3. Apply existing `transform` rules when present (as with `comparison_op` in expression context).

This generalizes the 0.5.0 `pass()` bound-slot fix to **all referenced non-terminals**.

### Minimal reproducer grammar (add to parser-lr fixtures)

```ebnf
name "nested-production-repro" ;

tokens
    kw_is = /IS/i ;
    kw_case = /CASE/i ;
    less = /</ ;
    ident = /[a-z]+/ ;
    integer = /[0-9]+/ ;

start line ;

grammar
    line = kw_case case_selector ;
    case_selector = #relational kw_is comparison_op integer ;
    comparison_op = #less less ;

ast
    comparison_op =
        #less [tok]:less
      ;

transform
    comparison_op ->
        #less comparison_op.#less(tok) ;
```

**Input:** `CASE IS < 0`

**Assert:** `case_selector` child at index 1 has `symbol === "comparison_op"`, not `less`.

---

## 4. `table validate` must work on edu-basic grammar (medium)

Depends on **§1** (CLI packaging).

Once the CLI runs, validate this consumer grammar:

```bash
npx parser-lr table validate -g src/lang/parsing/grammars/edu-basic.grammar
```

Useful warnings (already described in README) should include:

- `pass(boundSlot)` where bound production has no `transform` and can match a single terminal (legacy warning; should disappear after §3).
- `transform` references `type.#variant` not declared in `ast`.
- Duplicate `grammar` / `ast` / `transform` sections (edu-basic currently duplicates statement blocks; validator should flag).

`--strict` should be usable in CI.

---

## 5. Document transform contract (medium)

Update [`docs/grammar.md`](https://github.com/adamrmoss/parser-lr/blob/main/docs/grammar.md) with explicit rules:

| Transform | Behavior |
|-----------|----------|
| `pass(slot)` | Preserve bound production symbol; never collapse to sole terminal child. |
| No rule for production `P` | Identity node `{ symbol: P, children }` (proposed §3). |
| `build(type.#variant, …)` | Absent optional slots omitted from children, not shifted. |
| `flatten(type.#list, head, tail)` | Repeat tails: no empty placeholder nodes; no dropped items. |

Include before/after JSON for `CLS`, `CASE IS < 0`, and `LET x = 1`.

---

## 6. Regression fixtures to add in parser-lr (medium)

| Fixture | Covers |
|---------|--------|
| `pass-preserves-production/` | Bare optional production (`cls_stmt = kw_cls [ … ]`) |
| `nested-production-repro/` | §3 `comparison_op` inside parent without parent transform |
| `let-target-repro/` | §3b `let_target` wrapper |
| `flatten-repeat/` | `a,b,c` list with no spurious empty tails |
| `build-optional-slots/` | Optional grammar slots absent in `build()` output |
| `table-only-import/` | §2 smoke scripts |

Each fixture: `.grammar`, input line(s), expected AST JSON golden file.

---

## EduBASIC verification (run after parser-lr release)

Run these locally after bumping `parser-lr` and regenerating the table:

```bash
npm install parser-lr@<version>
npm run parser:table
npm run parser:check
npm test
```

Spot checks:

```bash
node -e "
import { ParseContext } from 'parser-lr';
import table from './src/lang/parsing/edu-basic.table.json' with { type: 'json' };
const ctx = ParseContext.fromTableJson(JSON.stringify(table));
for (const line of ['CLS', 'PRINT', 'CASE IS < 0', 'LET x% = 1', 'HELP PRINT']) {
  const ast = ctx.parseSource(line);
  console.log(line, '=>', ast?.symbol, JSON.stringify(ast?.children?.map(c => c.symbol)));
}
"
```

Expected after all items above:

| Line | Root symbol | Notable children |
|------|-------------|------------------|
| `CLS` | `cls_stmt` | `kw_cls` |
| `PRINT` | `print_stmt` | `kw_print` |
| `CASE IS < 0` | `case_stmt` | selector child includes `comparison_op` |
| `LET x% = 1` | `let_stmt` | includes `let_target` |
| `HELP PRINT` | `help_stmt` | `kw_help`, `help_topic` |

Then remove from edu-basic:

- [`keyword-fallbacks.ts`](../src/lang/parsing/ast-bridge/statements/keyword-fallbacks.ts)
- Flat-tree fallback branches in [`io.ts`](../src/lang/parsing/ast-bridge/statements/io.ts) (`buildHelpStatement`, `buildPrintSegmentsFromStatement`)
- `isComparisonOpSymbol` token-name matching in [`control-flow.ts`](../src/lang/parsing/ast-bridge/statements/control-flow.ts)
- Bare `identifier` path in [`assignment-helpers.ts`](../src/lang/parsing/ast-bridge/assignment-helpers.ts)

---

## Priority summary

| Priority | Item | Blocks edu-basic |
|----------|------|------------------|
| P0 | §1 CLI `grammar.json` path | `npm run parser:table`, `table validate` |
| P0 | §2 Lazy meta-grammar / split entry | Jest and any `import { ParseContext } from 'parser-lr'` |
| P1 | §3 Intermediate production nodes | Bridge simplification; `CASE IS`, `LET`, `PRINT` |
| P2 | §4–§6 Validate, docs, fixtures | CI confidence, upstream maintenance |

Target: **parser-lr 0.5.1** (or 0.6.0) with tarball acceptance tests for §1 and §2.
