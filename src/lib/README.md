# Library API

Browser- and Node-safe ESM (`import from 'parser-lr'`). Built to `dist/lib/` on `npm run build`.

## Quick start

```typescript
import { ParseContext } from 'parser-lr';

const context = ParseContext.fromGrammar(grammarSource, 'lr1');
const ast = context.parseSource(sourceText);
```

Load a serialized table instead (returns a full AST when the JSON includes `transform` rules):

```typescript
const context = ParseContext.fromTableJson(tableJson);
const ast = context.parseSource(sourceText);
```

## Main types

| Type | Role |
|------|------|
| `ParseContext` | Parser + table from grammar text or table JSON; `lex`, `parse`, `parseSource` |
| `ParserLr` | Lower-level parser bound to a `Grammar` and optional `ParseTable` |
| `Grammar` | Parsed `.grammar` file: lexer rules, productions, optional AST and transform schemas |
| `ParseTable` | Self-contained serializable LR table; lexer, parser, `ast`, and `transform` |
| `AstNode` | Parse tree node (CST or AST after transform) |
| `Lexer` | Tokenize source using grammar `tokens`, `skip`, and `states` |

Grammar file syntax: [`docs/grammar.md`](../../docs/grammar.md).

## Parse pipeline

1. **Lex** — `Lexer` or `ParseContext.lex` tokenizes input using `tokens` and `skip` from the grammar or table.
2. **Parse** — shift-reduce over the LR table produces a CST.
3. **Transform** — when `transform` rules are present in the grammar or table JSON, `ParserLr.parse` / `ParseContext.parse` apply them and return an AST.

`readGrammar(source)` parses a `.grammar` file into a `Grammar` model without building a user-language table.

## Errors

Domain errors extend `ParserLrError`. Use `formatUserError(error)` for CLI-safe messages without stack traces.
