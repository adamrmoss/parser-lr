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

## LR table algorithms

All four algorithms desugar EBNF to plain BNF, build LR item sets, then fill ACTION and GOTO tables for the same shift-reduce parser. They differ in how item sets are formed, how reduce lookaheads are chosen, and how competing actions are handled.

| Algorithm | Item sets | Reduce lookaheads | Typical table size |
|-----------|-----------|-------------------|--------------------|
| `lr0` | LR(0) | Every terminal (plus `$eof` on accept) | Smallest |
| `slr` | LR(0) | FOLLOW of the production's left-hand side | Small |
| `lr1` | LR(1), one lookahead per item | The item's own lookahead terminal | Largest |
| `lalr` | LR(1) cores merged, lookaheads unioned | Same as LR(1) after merge | Between SLR and LR(1) |

The default is **`lr1`**. Use it unless you have a reason to prefer a smaller table or need to inspect a simpler construction.

### LR(0)

LR(0) item sets contain dotted productions only; no lookahead symbols. When a production is complete in a state, reduce actions are emitted for **every terminal** in the grammar (not just plausible followers). That makes LR(0) the coarsest analysis and the most prone to spurious shift-reduce and reduce-reduce conflicts. It is mainly useful for teaching and debugging the item-set machinery.

### SLR (Simple LR)

SLR reuses the same LR(0) item sets but tightens reduce lookaheads using precomputed **FOLLOW** sets. A reduce by `A → α` is offered only on terminals in FOLLOW(`A`). This eliminates many LR(0) false conflicts but still merges contexts that LR(1) would keep separate, so grammars like dangling `if`-`then`-`else` remain conflicted under SLR.

### LR(1)

LR(1) item sets attach a **single lookahead terminal** to each item. Reduce actions fire only when the incoming token matches that lookahead, so distinct parse contexts become distinct states. This resolves grammars that SLR cannot, including expression precedence and the L=R (dangling reference) grammar from the Dragon book.

### LALR (Look-Ahead LR)

LALR starts from the full LR(1) collection, then **merges states that share the same LR(0) core**, unioning the lookaheads of merged items. GOTO targets are recomputed from the LR(1) collection so merged states behave correctly. The result is often much smaller than LR(1) while accepting the same grammars in practice; when LALR introduces a conflict that LR(1) avoided, the merge was too aggressive for that grammar.

### Conflicts and table building

When shift/reduce or reduce/reduce conflicts remain after table construction, the table is still built using default resolution:

- **Shift-reduce**: keep the **shift** action.
- **Reduce-reduce**: keep the **first reduce** action recorded for that slot.

Each resolved conflict is recorded on `ParseTable.conflicts`. Use `ParseTable.formatConflictWarnings()` for lines such as `state 12: shift/reduce conflict on token "else" resolved as shift`. The CLI `table generate` command writes those warnings to **stderr** after building the table JSON.

Conflict types:

- **Shift-reduce**: a state both shifts on a terminal and reduces by a production on that same terminal.
- **Reduce-reduce**: a state reduces by two different productions on the same terminal.

Precedence directives (`%left`, `%right`, `%prec`) are not supported in `.grammar` files today.

### Examples from classic grammars

| Grammar | `lr0` / `slr` | `lr1` / `lalr` |
|---------|---------------|----------------|
| Expression precedence (`E → E + T \| T`, …) | Conflict-free | Conflict-free |
| Dangling else (`if E then S` vs `if E then S else S`) | Shift-reduce conflict on `else` (shift wins) | Shift-reduce conflict on `else` (shift wins) |
| L=R (`S → L = R \| R`, …) | SLR conflicted | Conflict-free |
| Ambiguous infix (`E → E + E \| E * E \| id`) | Conflicted (shift wins on operators) | Conflicted (shift wins on operators) |

## Algorithm complexity

Let **n** be the input length in characters (lexing) or tokens (parsing). Let **G** denote grammar size: **P** productions, **N** non-terminals, **T** terminal/token names, and **R** lexer rules. Let **S** be the number of LR states after table construction, **I** the maximum item count in any item set, and **Σ** the grammar alphabet size (**T** + **N**).

| Phase | Operation | Time | Space |
|-------|-----------|------|-------|
| Grammar load | Meta-grammar lex + parse (`readGrammar`) | O(n) | O(n) |
| Desugar | EBNF → plain BNF (`desugarEbnf`) | O(P · d) | O(P) |
| Analysis | Nullable, FIRST, FOLLOW (`GrammarAnalysis`) | O(P · (N + T)) | O(N · T) |
| LR(0) sets | Closure + GOTO (`buildLr0ItemSets`) | O(S · Σ · I · P) | O(S · I) |
| LR(1) sets | Closure + GOTO (`buildLr1ItemSets`) | O(S · Σ · I · P) | O(S · I) |
| LALR merge | Core merge + GOTO targets (`mergeLalrItemSets`) | O(S_LR1 · I) | O(S · I) |
| Table fill | ACTION / GOTO (`TableBuilderBase`) | O(S · (T + N)) | O(S · T) |
| Lexer compile | Rule compilation (`compileLexerRules`) | O(R) | O(R) |
| Lexing | Longest-match scan (`Lexer`) | O(n · R) | O(n) tokens |
| Parsing | Shift-reduce (`ShiftReduceEngine`) | O(n) | O(n) |
| Transform | CST → AST (`CstTransformer`) | O(n) | O(n) |

**Notes:**

- **LR state count** can grow exponentially in |G| in the worst case (pathological grammars). Practical programming-language grammars typically yield polynomial-sized tables.
- **Closure** dominates table construction: each item set closure scans items and may add productions for every non-terminal after the dot.
- **Parsing** is linear in token count because each shift or reduce advances the input or shrinks the stack; table lookups are O(1) via hash maps.
- **Lexing** tries every active rule at each position (longest match, declaration-order tie-break). **R** is usually small and fixed for a given grammar.
- **FIRST / FOLLOW** use fixed-point iteration; each pass is O(P · w) where **w** is maximum production length, and the number of passes is bounded by **N**.

**End-to-end** for a grammar already loaded: lexing plus parsing is **O(n · R + n) = O(n · R)**; building a table from scratch adds the construction terms above (typically run once at compile or bootstrap time).
