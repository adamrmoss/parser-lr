# Library API

Browser-safe parse runtime plus a Node-only grammar subpath. Built to `dist/lib/` (ESM + `.d.ts`) on `npm run build`.

## Entry points

| Import | Entry | Use |
|--------|-------|-----|
| `import { … } from 'parser-lr'` | `dist/lib/index.js` | Browser, bundlers, table-only Node apps |
| `import { … } from 'parser-lr/grammar'` | `dist/lib/grammar-entry.js` | Node-only grammar-file APIs |

TypeScript types: `dist/lib/index.d.ts` and `dist/lib/grammar-entry.d.ts`.

## Quick start (table-only, browser-safe)

```typescript
import { ParseContext } from 'parser-lr';

const context = ParseContext.fromTableJson(tableJson);
const ast = context.parseSource(sourceText);
```

## Grammar-file path (Node only)

```typescript
import { parseContextFromGrammar, readGrammar } from 'parser-lr/grammar';

const context = parseContextFromGrammar(grammarSource, 'lr1');
const ast = context.parseSource(sourceText);
```

## Main types (`parser-lr`)

| Type | Role |
|------|------|
| `ParseContext` | Parser + table from table JSON; `lex`, `parse`, `parseSource` |
| `ParserLr` | Lower-level parser bound to a `Grammar` and optional `ParseTable` |
| `ParseTable` | Self-contained serializable LR table; lexer, parser, `ast`, and `transform` |
| `AstNode` | Parse tree node (CST or AST after transform) |
| `Lexer` | Tokenize source using grammar `tokens`, `skip`, and `states` |

## Grammar subpath (`parser-lr/grammar`)

| Type | Role |
|------|------|
| `Grammar` | Parsed `.grammar` file: lexer rules, productions, optional AST and transform schemas |
| `readGrammar` | Parse `.grammar` text into a `Grammar` model |
| `parseContextFromGrammar` | Build a `ParseContext` from grammar text |
| `validateGrammarTable` | Check `ast` / `transform` consistency on a `Grammar` model |

Grammar file syntax: [`docs/grammar.md`](../../docs/grammar.md).

## Parse pipeline

1. **Lex** — `Lexer` or `ParseContext.lex` tokenizes input using `tokens` and `skip` from the grammar or table.
2. **Parse** — shift-reduce over the LR table produces a CST.
3. **Transform** — when `transform` rules are present in the grammar or table JSON, `ParserLr.parse` / `ParseContext.parse` apply them and return an AST.

## Errors

Domain errors extend `ParserLrError`. Use `formatUserError(error)` for CLI-safe messages without stack traces.
