# The Ferrite Programming Language

Ferrite is a statically typed, C-like language with C#-style structs, file-scoped namespaces, explicit pointer semantics, and no preprocessor. A source file is a single compilation unit: an optional namespace header, `using` directives, and top-level declarations compose the program.

This guide describes the language as defined by [`grammars/ferrite.grammar`](../grammars/ferrite.grammar). Ferrite is included with parser-lr as a reference grammar; parsing and AST generation are supported today. Code generation and runtime semantics are outside the scope of this document unless noted.

## Quick start

A minimal Ferrite program declares a `main` function and returns an integer:

```ferrite
public Int32 main()
{
    return 0;
}
```

A more typical program places types in a file-scoped namespace and imports other namespaces with `using`:

```ferrite
namespace Ferrite.Math;

using Ferrite.Core;

public struct Vec2
{
    Float32 x;
    Float32 y;
    Float32 dot(Vec2* other)
    {
        return x * other->x + y * other->y;
    }
};

public Int32 main()
{
    Vec2 a = { 1.0, 2.0 };
    Vec2* p = &a;
    return (Int32)p->dot(&a);
}
```

Comments use C-style syntax:

```ferrite
// line comment

/* block
   comment */
```

## Naming conventions

These casing rules are **conventions**, not enforced by the parser. Prefer them in Ferrite source so programs stay consistent:

| Kind | Convention | Examples |
|------|------------|----------|
| Built-in types | PascalCase keywords | `Int32`, `Float64`, `Bool`, `Void` |
| Struct and other type names | PascalCase | `Vec2`, `Node`, `HttpServer` |
| Functions and methods | camelCase | `main`, `dot`, `isSet` |
| Variables, fields, and parameters | camelCase | `count`, `other`, `sum` |
| Constants | camelCase (same as variables) | `maxRetries` — no `UPPER_CASE` style |

Identifiers may contain letters, digits, and underscores; the grammar does not reject names that break these conventions.

## Program structure

A Ferrite file has a fixed order. Nothing may appear before the optional namespace, and every `using` directive must appear before any declaration:

1. Optional file-scoped namespace: `namespace Qualified.Name;`
2. Zero or more using directives: `using Qualified.Name;`
3. Zero or more top-level declarations (structs and functions)

| Form | Example |
|------|---------|
| File-scoped namespace | `namespace Ferrite.Math;` |
| Using directive | `using Ferrite.Core;` |
| Struct | `public struct Point { … };` |
| Function | `public Int32 add(Int32 a, Int32 b) { … }` or `private Int32 add(Int32 a, Int32 b);` |

There is no `#include` or macro layer. Share code across files by using namespaces and `using` directives. Block namespaces (`namespace Name { … }`) and nested namespace bodies are not part of the language.

### File-scoped namespace

At most one namespace declaration may appear, and only as the first construct in the file:

```ferrite
namespace Ferrite.Math;
```

Qualified names use dot notation: `Ferrite.Math.Vec2`.

Omitting the namespace leaves declarations in the global namespace for that file.

### Using directives

All `using` directives must follow the namespace (if present) and precede every struct or function declaration:

```ferrite
namespace Ferrite.App;

using Ferrite.Math;
using Ferrite.Math.Vec;

public Int32 main()
{
    return 0;
}
```

A file may begin with usings and no namespace:

```ferrite
using Ferrite.Math;

public Int32 main()
{
    return 0;
}
```

### Access modifiers

Every **top-level** struct, function definition, and function prototype requires `public` or `private`:

```ferrite
public struct Point
{
    Int32 x;
    Int32 y;
};

public Int32 twice(Int32 x)
{
    return x + x;
}

private Void helper();
```

Access modifiers are **not** required on:

- local variables inside functions
- parameters
- struct fields
- struct methods

```ferrite
public Int32 sum(Int32 a, Int32 b)
{
    Int32 total = a + b;
    return total;
}
```

## Types

### Primitive types

| Type | Description |
|------|-------------|
| `Void` | No value; used for functions with no return value |
| `Bool` | Boolean |
| `Int8`, `Int16`, `Int32`, `Int64` | Signed integers |
| `UInt8`, `UInt16`, `UInt32`, `UInt64` | Unsigned integers |
| `Float32`, `Float64` | Floating point |
| `Char` | Character |

### Named types

Struct names are ordinary type names. After a struct is declared, its identifier can appear wherever a type is expected:

```ferrite
public struct Point
{
    Int32 x;
    Int32 y;
};

public Point* origin(Point* cursor)
{
    return cursor;
}
```

### Pointers

Append one or more `*` after a type to form a pointer type:

```ferrite
Int32 value;
Int32* p;
Int32** pp;
Vec2* origin;
```

The address-of operator `&` takes a pointer to an lvalue; unary `*` dereferences a pointer:

```ferrite
Int32 x = 10;
Int32* p = &x;
Int32 y = *p;
```

Member access on pointers uses the arrow operator `->`:

```ferrite
Vec2* p = &a;
Float32 x = p->x;
```

### Arrays

Fixed-size and unsized array types are written with brackets after the element type:

```ferrite
Int32 buffer[10];
Int32[] unsized;
```

Pointer suffixes apply after the array form:

```ferrite
Int32*[4] row;
```

## Declarations

### Functions

Functions have an access modifier, return type, name, parameter list, and either a body or a terminating semicolon for a prototype:

```ferrite
public Int32 abs(Int32 x);                   // prototype

public Int32 twice(Int32 x)                  // definition
{
    return x + x;
}

private Void noop()                          // no parameters
{
    return;
}
```

Parameters are declared as `type name`, comma-separated, without access modifiers:

```ferrite
public Bool both(Bool a, Bool b)
{
    return a && b;
}
```

### Structs

A struct declares fields and methods inside braces, then ends with a semicolon. The struct itself needs an access modifier; members do not:

```ferrite
public struct Counter
{
    Int32 n;

    Int32 next()
    {
        return n + 1;
    }

    Int32 add(Int32 delta)
    {
        return n + delta;
    }
};
```

Fields are type-name pairs terminated by semicolons. Methods use the same body syntax as free functions but are defined inside the struct body without `public` or `private`.

An empty struct is valid:

```ferrite
public struct Empty
{
};
```

### Local variables

Inside a block, declare variables with a type, name, and optional initializer. Locals do not take access modifiers:

```ferrite
Int32 sum = 0;
Vec2 v = { 1, 2 };
Int32* p;
```

Brace initialization supplies a comma-separated list of expressions:

```ferrite
Vec2 a = { 1.0, 2.0 };
```

## Statements

Statements appear in function bodies, struct methods, and blocks.

| Statement | Form |
|-----------|------|
| Block | `{ … }` |
| Variable declaration | `type name [= init];` |
| Expression | `expr;` |
| `if` | `if (cond) stmt [else stmt]` |
| `while` | `while (cond) stmt` |
| `for` | `for ([init;] [test;] [step]) stmt` |
| `return` | `return [expr];` |
| `break` | `break;` |
| `continue` | `continue;` |

### `if` and `else`

```ferrite
if (flag)
{
    x = 1;
}
else
{
    x = 2;
}
```

The `else` branch is optional. Each branch is a single statement, often a block.

### `while`

```ferrite
while (running)
{
    step = step + 1;
}
```

### `for`

Ferrite uses C-style `for` loops. The init, test, and step clauses are each optional:

```ferrite
for (Int32 i = 0; i < 10; i = i + 1)
{
    sum = sum + i;
}

for (; i < 10; i = i + 1)
{
}

for (Int32 i = 0;; i = i + 1)
{
    if (i >= 10)
    {
        break;
    }
}
```

The init clause may be a variable declaration or an expression.

### `return`, `break`, and `continue`

```ferrite
public Int32 zero()
{
    return 0;
}

public Void finish()
{
    return;
}

while (true)
{
    break;
}

while (true)
{
    continue;
}
```

## Expressions

### Literals

| Kind | Examples |
|------|----------|
| Integer | `42`, `0xFF`, `0xDeadBeef`, `0b1010` |
| Floating | `3.14`, `1.5e10`, `3.14e-2` |
| Character | `'x'`, `'\n'` |
| String | `"hello"`, `"line\n"` |
| Boolean | `true`, `false` |
| Null pointer | `null` |

Integer literals accept hexadecimal (`0x` / `0X`) and binary (`0b` / `0B`) prefixes. Float literals may use a decimal exponent (`e` / `E`).

### Primary expressions

Identifiers, literals, parenthesized expressions, and `new`:

```ferrite
x
0xFF
(obj.field)
new Node()
new Node(1, 2)
```

### Postfix operations

Postfix operators bind to the expression on their left:

| Operator | Meaning |
|----------|---------|
| `[expr]` | Index |
| `( )`, `(args…)` | Call |
| `.name` | Member access |
| `->name` | Pointer member access |
| `++`, `--` | Postfix increment / decrement |

```ferrite
arr[i]
f(a, b)
main()
obj.field
ptr->field
i++
```

### Unary operators

| Operator | Meaning |
|----------|---------|
| `(type) expr` | Cast |
| `++`, `--` | Prefix increment / decrement |
| `&` | Address of |
| `*` | Dereference |
| `!` | Logical not |
| `~` | Bitwise not |
| `-`, `+` | Unary minus / plus |

```ferrite
(Int32)value
++i
&x
*p
!flag
~mask
-n
```

### Binary operators and precedence

From highest to lowest binding strength:

1. Postfix: `[]`, `()`, `.`, `->`, `++`, `--`
2. Unary: cast, prefix `++`/`--`, `&`, `*`, `!`, `~`, unary `-`/`+`
3. Multiplicative: `*`, `/`, `%`
4. Additive: `+`, `-`
5. Shift: `<<`, `>>`
6. Relational: `<`, `>`, `<=`, `>=`
7. Equality: `==`, `!=`
8. Bitwise AND: `&`
9. Bitwise XOR: `^`
10. Bitwise OR: `|`
11. Logical AND: `&&`
12. Logical OR: `||`
13. Assignment: `=`, `+=`, `-=`, `*=`, `/=`, `&=`, `|=`, `^=`

Assignment is right-associative. All other binary operators listed here are left-associative.

```ferrite
a + b * c
a + b * c < d && e || f
x = y = 0
x += 1
```

## Memory and construction

`new` allocates or constructs a value of the given type:

```ferrite
Node* n = new Node();
Node* m = new Node(1, 2);
```

The result type is typically stored in a pointer. `null` represents a null pointer constant:

```ferrite
Int32* p = null;
```

Exact allocation semantics (stack vs heap, constructor dispatch) depend on a future implementation. The syntax above is what the Ferrite grammar accepts.

## Worked example

The following program combines a file-scoped namespace, ordered usings, visibility, structs with methods, pointers, and brace initialization:

```ferrite
namespace Ferrite.Math;

using Ferrite.Core;

public struct Vec2
{
    Float32 x;
    Float32 y;

    Float32 dot(Vec2* other)
    {
        return x * other->x + y * other->y;
    }
};

public Int32 main()
{
    Vec2 a = { 1.0, 2.0 };
    Vec2* p = &a;
    return (Int32)p->dot(&a);
}
```

Reading it top to bottom:

1. The file declares namespace `Ferrite.Math`.
2. `using Ferrite.Core;` imports another namespace before any declarations.
3. `Vec2` is a public struct with two fields and a method that reads another vector through a pointer.
4. `main` creates a vector, takes its address, and calls `dot` through a pointer, casting the result to `Int32`.

## Parsing Ferrite with parser-lr

Ferrite ships as a `.grammar` file in this repository. Generate a parse table, validate transforms, or parse source with the CLI:

```bash
parser-lr table generate -g grammars/ferrite.grammar -o ferrite.json
parser-lr table validate -g grammars/ferrite.grammar
parser-lr parse -i program.fe -g grammars/ferrite.grammar
```

Output is JSON containing an AST when parsing succeeds. See the [project README](../README.md) for install instructions and library usage.

Integration tests in [`src/lib/ferrite.test.ts`](../src/lib/ferrite.test.ts) exercise the grammar across types, control flow, operators, and full programs.

## Summary

| Topic | Ferrite approach |
|-------|------------------|
| Modules | Optional file-scoped `namespace Name;`, then `using` directives; no preprocessor |
| Visibility | Required `public` / `private` on top-level structs and functions |
| User-defined types | `struct` with fields and methods |
| Naming | PascalCase types, camelCase functions and variables (convention) |
| Pointers | Explicit `*`, `&`, `->`, and `null` |
| Control flow | `if`, `while`, C-style `for`, `break`, `continue` |
| Expressions | C-family operators and precedence |
| Initialization | Assignment and brace lists |

For grammar-file mechanics (tokens, AST shapes, transforms), see [`.grammar` file syntax](grammar.md).
