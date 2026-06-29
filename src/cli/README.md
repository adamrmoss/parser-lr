# CLI (`src/cli`)

Node-only command-line tool. Rollup bundles to `bin/parser-lr.js` (npm `bin` entry).

## Commands

### `parser-lr table generate`

Build a parse table from an EBNF grammar.

| Option | Required | Description |
|--------|----------|-------------|
| `-g, --grammar <path>` | yes | EBNF grammar file |
| `-o, --output <path>` | no | Write table JSON (default: stdout) |
| `-a, --algorithm <name>` | no | `lr0`, `slr`, `lalr`, or `lr1` (default: `lr1`) |

### `parser-lr parse`

Parse a source file.

| Option | Required | Description |
|--------|----------|-------------|
| `-i, --input <path>` | yes | Source file to parse |
| `-g, --grammar <path>` | one of grammar/table | EBNF grammar file |
| `-t, --table <path>` | one of grammar/table | Serialized parse table JSON |
| `-o, --output <path>` | no | Write AST (default: stdout) |
| `--format <name>` | no | AST format (default: `json`) |
