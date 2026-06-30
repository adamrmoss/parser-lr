# parser-lr

Shift-reduce parser for EBNF grammars. Describe your language with a `.grammar` file, build an LR parse table, then lex and parse source into a concrete syntax tree or AST, for execution or code generation.

Grammar file syntax is documented in the [`.grammar` file syntax](https://github.com/adamrmoss/parser-lr/blob/main/docs/grammar.md) guide.

## Install

From npm:

```bash
npm install parser-lr
```

From a clone of this repository:

```bash
npm install
npm run build
```

## CLI

The `parser-lr` command is published as the package `bin` entry. After a local build, link it globally:

```bash
npm link
```

You can then run `parser-lr` from any directory. Without linking, use `npx parser-lr` (published install) or `node node_modules/parser-lr/bin/parser-lr.js`.

### Build a parse table

Generate a serialized LR table from a grammar file:

```bash
parser-lr table generate -g mylang.grammar -o mylang.table.json
```

Options:

| Option | Description |
|--------|-------------|
| `-g, --grammar <path>` | `.grammar` file (required) |
| `-o, --output <path>` | Output path (default: stdout) |
| `-a, --algorithm <name>` | `lr0`, `slr`, `lalr`, or `lr1` (default: `lr1`) |

The JSON table includes lexer token rules, skip rules, and the full ACTION/GOTO table. You can ship this file without the original grammar.

### Parse a source file

Parse input using either the grammar (table built in memory) or a saved table:

```bash
parser-lr parse -i program.txt -g mylang.grammar
parser-lr parse -i program.txt -t mylang.table.json
```

Options:

| Option | Description |
|--------|-------------|
| `-i, --input <path>` | Source file to parse (required) |
| `-g, --grammar <path>` | `.grammar` file (one of grammar or table) |
| `-t, --table <path>` | Serialized table JSON from `table generate` |
| `-o, --output <path>` | Output path (default: stdout) |
| `--format <name>` | Output format (default: `json`) |

Output is a JSON object `{ "ast": … }`. On a syntax error, `ast` is `null`.

When the grammar defines `ast` and `transform` sections, the CLI applies CST-to-AST transforms and returns the abstract tree.

## Library

Import from `parser-lr` in Node or bundler projects (ESM). The API is browser-safe; the CLI is Node-only.

```typescript
import { readFile } from 'node:fs/promises';
import { ParseContext } from 'parser-lr';

const grammarSource = await readFile('mylang.grammar', 'utf8');
const context = ParseContext.fromGrammar(grammarSource, 'lr1');

const source = await readFile('program.txt', 'utf8');
const ast = context.parseSource(source);
```

Load a pre-built table instead of a grammar file:

```typescript
import { readFile } from 'node:fs/promises';
import { ParseContext } from 'parser-lr';

const tableJson = await readFile('mylang.table.json', 'utf8');
const context = ParseContext.fromTableJson(tableJson);

const source = await readFile('program.txt', 'utf8');
const ast = context.parse(context.lex(source));
```

`ParseContext` exposes `lex`, `parse`, and `createLexer` for finer control. See the [library API overview](https://github.com/adamrmoss/parser-lr/blob/main/src/lib/README.md).

## Example grammars

Sample `.grammar` files are in the [grammars](https://github.com/adamrmoss/parser-lr/tree/main/grammars) directory (`calc.grammar`, `lisp.grammar`, `6502.grammar`, and the meta-grammar `grammar.grammar`). Use them as templates when writing your own language.
