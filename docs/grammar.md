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

### Choosing `pass`, `build`, and `flatten`

| Transform | Use when |
|-----------|----------|
| `pass(slot)` | Lift one bound child unchanged. `pass(boundSlot)` preserves the bound production symbol and its `#` variant. `pass(terminalName)` at the same rule may collapse to that terminal. |
| `build(type.#variant, …)` | Construct an AST node with a fixed shape. Omit absent optional bindings from the argument list. |
| `flatten(type.#variant, head, tail)` | Turn a `{ repeat }` list into one AST node with ordered children. Use the repeat non-terminal (for example `list$repeat_0`) as `tail` on the head production. |

**Production symbols are preserved.** When a CST node has parse-table metadata, transforms keep its production name even if it has only one terminal child. Bare `CLS` through `pass(stmt)` where `[stmt]:cls_stmt` yields an `cls_stmt` node, not `kw_cls`.

### Transform contract

The transformer applies these rules to every CST node:

| Situation | Behavior |
|-----------|----------|
| `pass(slot)` | Preserve the bound production's symbol and `#` variant; never collapse to its sole terminal child. |
| No transform rule for production `P` | Emit an identity node `{ symbol: P, variant, children }`. A named non-terminal is kept even when it has a single child; the child is not hoisted in its place. |
| `build(type.#variant, …)` | Absent optional bindings are omitted from `children`, not shifted into other slots. |
| `flatten(type.#list, head, tail)` | Repeat tails produce no empty placeholder nodes and drop no items. |

**Nested non-terminals stay wrapped.** A production referenced inside another production keeps its own node, so consumers match the grammar non-terminal (for example `comparison_op`) rather than a lexer token name (`less`). To retain a token *inside* that wrapper, bind it: write `comparison_op = #less [tok]:less` and reference `tok` from the transform. Without the binding, `build(comparison_op.#less, tok)` has no slot to read and the child is dropped.

Before / after for `CASE IS < 0` with `case_selector = #relational kw_is comparison_op integer`:

```json
{
    "symbol": "case_selector",
    "variant": "relational",
    "children": [
        { "symbol": "kw_is" },
        { "symbol": "comparison_op", "variant": "less", "children": [ { "symbol": "less" } ] },
        { "symbol": "integer" }
    ]
}
```

Run `parser-lr table validate -g mylang.grammar` to check `ast` / `transform` consistency. The validator:

- warns when `pass(boundSlot)` targets a production that can match a single terminal and has no transform rule;
- errors when a `build` / `fold` / `flatten` references a `type.#variant` not declared in `ast`;
- warns when a production, `ast` type, or `transform` rule is declared more than once (the later definition silently overrides the earlier one).

Add `--strict` to fail on warnings in CI.

## Statement authoring

Statements follow the same `grammar` / `ast` / `transform` pattern as expressions. Dispatch on stable `*_stmt` production names instead of keyword tokens.

```ebnf
grammar
    statement =
        #cls pass(stmt)
      | #print pass(stmt)
      | #end pass(stmt)
      ;

    cls_stmt =
        #bare kw_cls
      | #with kw_cls kw_with [bg]:expr
      ;

    print_stmt =
        #bare kw_print
      | #items kw_print [list]:print_list
      ;

    end_stmt =
        #program kw_end
      | #if kw_end kw_if
      ;

ast
    cls_stmt =
        #bare kw_cls
      | #with kw_cls kw_with [bg]:expr
      ;

    print_stmt =
        #bare kw_print
      | #items kw_print [list]:print_list
      ;

    end_stmt =
        #program kw_end
      | #if kw_end kw_if
      ;

transform
    statement ->
        #cls pass(stmt)
      | #print pass(stmt)
      | #end pass(stmt)
      ;

    cls_stmt ->
        #bare cls_stmt.#bare(kw_cls)
      | #with cls_stmt.#with(kw_cls, kw_with, bg) ;

    print_stmt ->
        #bare print_stmt.#bare(kw_print)
      | #items print_stmt.#items(kw_print, list) ;

    end_stmt ->
        #program end_stmt.#program(kw_end)
      | #if end_stmt.#if(kw_end, kw_if) ;
```

After `pass(stmt)`, consumers see `cls_stmt`, `print_stmt`, or `end_stmt` at the statement root. Add `ast` + `transform` rules per statement production rather than scanning for keyword terminals in bridge code.

See [`docs/parser-lr-enhancement-proposals.md`](parser-lr-enhancement-proposals.md) for the EduBASIC migration that motivated these conventions.

## Complete example

See [`grammars/calc.grammar`](../grammars/calc.grammar) for a small working grammar with `grammar`, `ast`, and `transform` sections. [`grammars/lisp.grammar`](../grammars/lisp.grammar) and [`grammars/6502.grammar`](../grammars/6502.grammar) show larger languages.

## Building and using a grammar

```bash
parser-lr table generate -g mylang.grammar -o mylang.json
parser-lr table validate -g mylang.grammar
parser-lr parse -i source.txt -g mylang.grammar
parser-lr parse -i source.txt -t mylang.json
```

See the [project README](../README.md) for install and library usage.
