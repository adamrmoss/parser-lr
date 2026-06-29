# parser-lr

Shift-reduce parser library for EBNF grammars. Build an LR parse table from a grammar, then parse source into an AST.

## Library API

| Type | Purpose |
|------|---------|
| `Grammar` | Parsed `.grammar` file (lexer, parse productions, optional `AstSchema`) |
| `AstSchema` | AST types from the `ast` section |
| `TransformSchema` | CST-to-AST rules from the `transform` section |
| `AstNode` | Parse tree node (interior symbols and terminal leaves) |
| `Token` | Lexeme from tokenization (name, text, source span) |
| `ParseTable` | Serializable LR table metadata with token inventory |
| `ParserLr` | Shift-reduce parser (table build and parse) |

Source lives under `src/lib/`. See [`src/lib/README.md`](src/lib/README.md) for layout.

```bash
npm test
```
