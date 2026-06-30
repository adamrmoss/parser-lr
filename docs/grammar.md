# `.grammar` file syntax

A `.grammar` file describes a language: lexer rules, parser productions, and optional AST shape and transform rules. Files are plain text with `//` line comments.

## Overview

A grammar file contains these sections in order:

1. `name` — grammar name
2. Zero or more of: `tokens`, `skip`, `states`
3. `start` — entry non-terminal
4. `grammar` — parse productions
5. Optional `ast` — AST type definitions
6. Optional `transform` — CST-to-AST mapping rules

Whitespace between sections is ignored. Skip rules discard matched text before tokenization.

## `name`

```ebnf
name "mylang" ;
name mylang ;
```

The name is an identifier or double-quoted string.

## `tokens`

Declares lexer tokens as regular expressions:

```ebnf
tokens
    identifier = /[A-Za-z_][A-Za-z0-9_]*/ ;
    number = /[0-9]+/ ;
    plus = /\+/ ;
```

Each rule is `name = /pattern/ flags ;`. The pattern is a JavaScript regular expression body between slashes. Optional flag letters (`g`, `i`, `m`, `s`, `u`, `y`) may follow the closing slash.

## `skip`

Declares patterns to discard (whitespace, comments):

```ebnf
skip
    whitespace = /[ \t\r\n]+/ ;
    comment = /\/\/[^\n\r]*/ ;
```

Syntax matches `tokens`.

## `states`

Optional lexer start states (for multi-mode lexing):

```ebnf
states default, string ;
```

## `start`

Names the parser entry non-terminal:

```ebnf
start program ;
```

## `grammar`

Parse productions use EBNF expression syntax:

```ebnf
grammar
    program = statement { statement } ;
    statement = identifier equal expression semicolon ;
```

### Expressions

| Form | Syntax | Meaning |
|------|--------|---------|
| Sequence | `a b c` | Match in order |
| Choice | `a \| b \| c` | Match one alternative |
| Optional | `[ a ]` | Zero or one |
| Repeat | `{ a }` | Zero or more |
| Group | `( a )` | Precedence grouping |
| Terminal | `"while"` | Literal string in the input |
| Reference | `identifier` | Non-terminal or token name |
| Label | `#name` | Names an alternative for transforms |
| Binding | `[slot]:symbol` | Names a child slot for AST transforms |

Example with labels and bindings:

```ebnf
expr =
    #add expr plus term
  | #term term
  ;
```

### Production syntax

Each production ends with a semicolon:

```ebnf
identifier = expression ;
```

## `ast`

Optional section declaring AST node shapes. Uses the same expression syntax as `grammar`, with `#` variants and `[slot]:` bindings naming child fields:

```ebnf
ast
    expr =
        #binary [left]:expr [operator]:operator [right]:expr
      | #literal number
      ;
```

When present, transform rules map parse trees to these types.

## `transform`

Maps labeled parse alternatives to AST construction. One rule per parse production:

```ebnf
transform
    expr ->
        #add fold-left(expr.#binary, left, operator, right)
      | #term pass(term)
      ;
```

### Transform expressions

| Form | Syntax |
|------|--------|
| Drop | `drop` |
| Pass | `pass(reference)` |
| Build | `type.#variant` or `type.#variant(arg, …)` |
| Fold left | `fold-left(type.#variant, ref, …)` |
| Fold right | `fold-right(type.#variant, ref, …)` |
| Flatten | `flatten(type.#variant, head, tail)` |

`type.#variant` refers to an AST type and variant from the `ast` section. Arguments are binding names from the parse production.

Example (calculator):

```ebnf
transform
    expr ->
        #binary expr.#binary(left, operator, right)
      | #literal expr.#literal(number)
      ;
```

## Complete example

See [`grammars/calc.grammar`](../grammars/calc.grammar) for a small working grammar with `grammar`, `ast`, and `transform` sections. [`grammars/lisp.grammar`](../grammars/lisp.grammar) and [`grammars/6502.grammar`](../grammars/6502.grammar) show larger languages.

## Building and using a grammar

```bash
parser-lr table generate -g mylang.grammar -o mylang.table.json
parser-lr parse -i source.txt -g mylang.grammar
parser-lr parse -i source.txt -t mylang.table.json
```

See the [project README](../README.md) for install and library usage.
