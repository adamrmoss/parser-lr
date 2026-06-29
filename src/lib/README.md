# Library (`src/lib`)

Browser- and Node-safe parser API. Built with `tsc` into `dist/lib/` as unbundled ESM for consumer tree-shaking.

## Layout

| Path | Role |
|------|------|
| `index.ts` | Public exports |
| `parser-lr.ts` | `ParserLr` shift-reduce parser |
| `parse-context.ts` | `ParseContext` — load parser + table from grammar or JSON |
| `parse-output.ts` | Format parse results for interchange |
| `ast/ast-node.ts` | `AstNode` parse tree nodes |
| `grammar/` | `.grammar` file model (`Grammar`, `Production`, `Expression`, `TokenRule`) |
| `lexer/` | Stream tokenizer (`Lexer`, `Token`, `$eof`) driven by grammar `tokens` / `skip` / `states` |
| `parse-table/` | Serializable LR table metadata (`ParseTable`, token inventory) |

## Core types

- **`AstNode`** — tree node from parsing: symbol name, child subtrees, optional terminal lexeme text and source span.
- **`Grammar`** — parsed `.grammar` file: name, `tokens` / `skip` / `states`, start symbol, parse productions, optional **`AstSchema`**.
- **`AstSchema`** — AST types from the `ast` section; same expression syntax as productions, with `#` variants and `[slot]:` bindings.
- **`TransformSchema`** — CST-to-AST rules from the `transform` section (`pass`, `drop`, `fold-left`, `fold-right`, `flatten`, `type.#variant(…)`).
- **`AstNode`** — single tree node class for CST (parse output) and AST (post-transform); `symbol` + optional `variant` (`#` label).
- **`ParseContext`** — parser and table loaded from grammar text or serialized table JSON.
- **`Token`** — lexeme from the lexer: rule name, matched text, and source span; streams end with `$eof`.
- **`Lexer`** — push source chunks, call `finish()`, read tokens via `next()` or `lexChunks` / `lexChunksAsync`.
- **`ParseTable`** — serialized table metadata; JSON includes `tokens`, `tokenRules`, and `skipRules`.

Co-located tests: `*.test.ts` next to the module under test. Run `npm test` from the project root.
