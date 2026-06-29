# CLI (`src/cli`)

Node-only command-line tool. Rollup bundles to `bin/parser-lr.js` (npm `bin` entry).

This layer is **orchestration only**: read files, call `src/lib`, write results. Parsing, lexing, table building, and output formatting live in the library.

## Commands

### `parser-lr table generate`

Build a parse table from an EBNF grammar and write JSON to disk.

| Option | Required | Description |
|--------|----------|-------------|
| `-g, --grammar <path>` | yes | EBNF grammar file |
| `-o, --output <path>` | no | Write table JSON (default: stdout) |
| `-a, --algorithm <name>` | no | `lr0`, `slr`, `lalr`, or `lr1` (default: `lr1`) |

Saved tables include the full token inventory plus lexer `tokenRules` and `skipRules`, so `parse -t` can run without the grammar file.

### `parser-lr parse`

Parse a source file using a grammar or a saved parse table.

| Option | Required | Description |
|--------|----------|-------------|
| `-i, --input <path>` | yes | Source file to parse |
| `-g, --grammar <path>` | one of grammar/table | Build a table in memory from a grammar file |
| `-t, --table <path>` | one of grammar/table | Load a serialized parse table JSON file |
| `-o, --output <path>` | no | Write output (default: stdout) |
| `--format <name>` | no | Output format (default: `json`) |

Until shift-reduce parsing is wired, `parse` outputs the lexed token stream as JSON.
