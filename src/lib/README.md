# Library (`src/lib`)

Browser- and Node-safe parser API. Built with `tsc` into `dist/lib/` as unbundled ESM for consumer tree-shaking.

## Layout

| Path | Role |
|------|------|
| `index.ts` | Public exports |
| `parser-lr.ts` | `ParserLr` shift-reduce parser |
| `shift-reduce/` | Table-driven shift-reduce interpreter |
| `transform/` | CST-to-AST transform engine |
| `parse-context.ts` | `ParseContext` — load parser + table from grammar or JSON |
| `parse-output.ts` | Format parse results for interchange |
| `ast/ast-node.ts` | `AstNode` parse tree nodes |
| `grammar/` | `.grammar` file model, `readGrammar`, bootstrap table — see below |
| `lexer/` | Stream tokenizer (`Lexer`, `Token`, `$eof`) driven by grammar `tokens` / `skip` / `states` |
| `parse-table/` | Serializable LR table metadata (`ParseTable`, token inventory) and table construction (`bnf/`, `analysis/`, `lr0/`, `lr1/`, `slr/`, `table/`, `build-lr-table.ts`) |

### `grammar/`

| File | Role |
|------|------|
| `grammar.json` | Bootstrapped meta-grammar parse table (lexer rules; copied to `dist/lib/grammar/` on build) |
| `meta-grammar-table.ts` | Loads `grammar.json`, lexes `.grammar` source via `Lexer` |
| `grammar-literals.ts` | String and regex literal decoding for grammar files |
| `read-grammar.ts` | Hand-written recursive-descent parser → `Grammar` model |
| `grammar.ts`, `expression.ts`, … | Grammar AST types and schemas |

Source specs: [`grammars/`](../../grammars/). Regenerate `grammar.json` with `npm run bootstrap` after editing `grammars/grammar.grammar`.

## Core types

- **`AstNode`** — tree node from parsing: symbol name, optional `#` variant, child subtrees, optional terminal lexeme text and source span.
- **`Grammar`** — parsed `.grammar` file: name, `tokens` / `skip` / `states`, start symbol, parse productions, optional **`AstSchema`**.
- **`AstSchema`** — AST types from the `ast` section; same expression syntax as productions, with `#` variants and `[slot]:` bindings.
- **`TransformSchema`** — CST-to-AST rules from the `transform` section (`pass`, `drop`, `fold-left`, `fold-right`, `flatten`, `type.#variant(…)`).
- **`ParseContext`** — parser and table loaded from grammar text or serialized table JSON.
- **`Token`** — lexeme from the lexer: rule name, matched text, and source span; streams end with `$eof`.
- **`Lexer`** — push source chunks, call `finish()`, read tokens via `next()` or `lexChunks` / `lexChunksAsync`.
- **`ParseTable`** — serialized table metadata; JSON includes `tokens`, `tokenRules`, and `skipRules`.

Co-located tests: `*.test.ts` next to the module under test. Run `npm test` from the project root.
