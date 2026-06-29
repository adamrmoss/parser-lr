# Library (`src/lib`)

Browser- and Node-safe parser API. Built with `tsc` into `dist/lib/` as unbundled ESM for consumer tree-shaking.

## Layout

| Path | Role |
|------|------|
| `index.ts` | Public exports |
| `parser-lr.ts` | `ParserLr` shift-reduce parser |
| `ast/ast-node.ts` | `AstNode` parse tree nodes |
| `grammar/` | `.grammar` file model (`Grammar`, `Production`, `Expression`, `TokenRule`) |

## Core types

- **`AstNode`** — tree node from parsing: symbol name, child subtrees, optional terminal lexeme text and source span.
- **`Grammar`** — parsed `.grammar` file: name, `tokens` / `skip` / `states`, start symbol, and productions. Expression shapes live in the `Expression` union; choice branches use `Alternative` (`#` labels).

Co-located tests: `*.test.ts` next to the module under test. Run `npm test` from the project root.
