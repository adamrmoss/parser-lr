# Source

| Path | Role |
|------|------|
| `lib/` | Library API (`tsc` → `dist/lib/`): lexer, grammar model, parse tables, `ParserLr` |
| `cli/` | Node CLI (Rollup → `bin/parser-lr.js`); orchestration only, logic lives in `lib/` |

Grammar specs live at the repo root in [`grammars/`](../grammars/). The meta-grammar table is bootstrapped into `lib/grammar/grammar.json` via `npm run bootstrap` (see root [`README.md`](../README.md)).
