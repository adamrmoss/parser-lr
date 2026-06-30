# parser-lr

Shift-reduce parser library for EBNF grammars. Build an LR parse table from a grammar, then parse source into an AST.

## Layout

| Path | Role |
|------|------|
| `grammars/` | EBNF grammar specs (`grammar.grammar` meta-grammar, plus sample grammars) |
| `src/lib/` | Library API (Node and browser) — see [`src/lib/README.md`](src/lib/README.md) |
| `src/cli/` | Node CLI — see [`src/cli/README.md`](src/cli/README.md) |

## Library API

| Type | Purpose |
|------|---------|
| `Grammar` | Parsed `.grammar` file (lexer, parse productions, optional `AstSchema`) |
| `AstSchema` | AST types from the `ast` section |
| `TransformSchema` | CST-to-AST rules from the `transform` section |
| `AstNode` | Parse tree node (interior symbols and terminal leaves) |
| `Token` | Lexeme from tokenization (name, text, source span) |
| `ParseTable` | Serializable LR table metadata with token inventory |
| `ParserLr` | Shift-reduce parser (table build and parse) |

## Build and test

```bash
npm run build    # tsc → dist/lib/, Rollup → bin/parser-lr.js
npm test
```

## Bootstrap

Grammar files are lexed and parsed with a bootstrapped meta-grammar table checked in at `src/lib/grammar/grammar.json`. Regenerate it after changing `grammars/grammar.grammar`:

```bash
npm run bootstrap
```

The meta-grammar LR parser builds the `Grammar` model used to bootstrap table generation.

## CLI

```bash
parser-lr table generate -g grammars/lisp.grammar -o table.json
parser-lr parse -i source.txt -g grammars/lisp.grammar
```

The `parse` command outputs a concrete syntax tree as JSON (`{ "ast": … }`).
