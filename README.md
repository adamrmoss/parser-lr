# parser-lr

Shift-reduce parser library for EBNF grammars. Build an LR parse table from a grammar, then parse source into an AST.

## Library API

| Type | Purpose |
|------|---------|
| `EbnfGrammar` | Parsed EBNF grammar (start symbol and named productions) |
| `AstNode` | Parse tree node (interior symbols and terminal leaves) |
| `ParserLr` | Shift-reduce parser (table build and parse) |

Source lives under `src/lib/`. See [`src/lib/README.md`](src/lib/README.md) for layout.

```bash
npm test
```
