# CLI

Node command-line tool (`parser-lr`). Bundled to `bin/parser-lr.js`.

User-facing install, table generation, and parse workflows are documented in the [project README](../../README.md). Grammar syntax: [`docs/grammar.md`](../../docs/grammar.md).

## `table generate`

| Option | Required | Description |
|--------|----------|-------------|
| `-g, --grammar <path>` | yes | `.grammar` file |
| `-o, --output <path>` | no | Write table JSON (default: stdout) |
| `-a, --algorithm <name>` | no | `lr0`, `slr`, `lalr`, or `lr1` (default: `lr1`) |

## `parse`

| Option | Required | Description |
|--------|----------|-------------|
| `-i, --input <path>` | yes | Source file to parse |
| `-g, --grammar <path>` | one of grammar/table | Build table from grammar |
| `-t, --table <path>` | one of grammar/table | Load serialized table JSON |
| `-o, --output <path>` | no | Write output (default: stdout) |
| `--format <name>` | no | Output format (default: `json`) |

Output: `{ "ast": … }` or `{ "ast": null }` on syntax error.
