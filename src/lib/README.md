# Library (`src/lib`)

Browser- and Node-safe parser API. Built with `tsc` into `dist/lib/` as unbundled ESM for consumer tree-shaking.

## Layout

| Path | Role |
|------|------|
| `index.ts` | Public exports |
| `parser-lr.ts` | `ParserLr` shift-reduce parser |
| `ast/ast-node.ts` | `AstNode` parse tree nodes |
| `grammar/` | EBNF grammar model (`EbnfGrammar`, expression types) |

## Core types

- **`AstNode`** — tree node from parsing: symbol name, child subtrees, optional terminal lexeme text and source span.
- **`EbnfGrammar`** — named EBNF productions with a start symbol; expression shapes live in the `EbnfExpression` union.

Co-located tests: `*.test.ts` next to the module under test. Run `npm test` from the project root.
