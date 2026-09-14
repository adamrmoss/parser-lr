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
import { parserFromTableJson } from 'parser-lr';

const { parser } = parserFromTableJson(tableJson);
const ast = parser.parseSource(sourceText);
```

## Grammar-file path (Node only)

```typescript
import { parserFromGrammar, readGrammar } from 'parser-lr/grammar';

const { parser } = parserFromGrammar(grammarSource, 'lr1');
const ast = parser.parseSource(sourceText);
```

## Main types (`parser-lr`)

| Type | Role |
|------|------|
| `parserFromTableJson` | Builds `{ parser, table }` from table JSON |
| `ParserLoadError` | Thrown when grammar source and table JSON are both missing |
| `ParserLr` | Parser bound to a `Grammar` and optional `ParseTable`; `lex`, `parse`, `parseSource` |
| `ParseTable` | Self-contained serializable LR table; lexer, parser, `ast`, and `transform` |
| `AstNode` | Parse tree node (CST or AST after transform) |
| `Lexer` | Tokenize source using grammar `tokens` and `skip` |

## Grammar subpath (`parser-lr/grammar`)

| Type | Role |
|------|------|
| `Grammar` | Parsed `.grammar` file: lexer rules, productions, optional AST and transform schemas |
| `readGrammar` | Parse `.grammar` text into a `Grammar` model |
| `parserFromGrammar` | Build `{ parser, table }` from grammar text |
| `parserFromSources` | Build `{ parser, table }` from grammar text or table JSON |
| `validateGrammarTable` | Check `ast` / `transform` consistency on a `Grammar` model |

Grammar file syntax: [`docs/grammar.md`](../../docs/grammar.md).

## Parse pipeline

1. **Lex** — `Lexer` or `ParserLr.lex` tokenizes input using `tokens` and `skip` from the grammar or table.
2. **Parse** — shift-reduce over the LR table produces a CST.
3. **Transform** — when `transform` rules are present in the grammar or table JSON, `ParserLr.parse` applies them and returns an AST.

## Errors

Domain errors extend `ParserLrError`. Use `formatUserError(error)` for CLI-safe messages without stack traces.
