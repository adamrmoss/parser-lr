import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Grammar } from './grammar/grammar.js';
import { readGrammar } from './grammar/read-grammar.js';
import { ParseTable } from './parse-table/parse-table.js';
import { ParserLr } from './parser-lr.js';
import { parseWithTable, parseWithTableResult } from './shift-reduce/shift-reduce-engine.js';
import { transformCst } from './transform/cst-transformer.js';

const ferriteGrammarPath = join(process.cwd(), 'grammars/ferrite.grammar');

/**
 * Reads the Ferrite `.grammar` file from the project `grammars/` directory.
 *
 * @returns Full Ferrite grammar file text.
 */
function readFerriteGrammarSource(): string
{
    return readFileSync(ferriteGrammarPath, 'utf8');
}

/**
 * Wraps Ferrite statements in a void function body for top-level program parsing.
 *
 * @param body - Statement list inside the function block.
 * @returns A complete Ferrite program.
 */
function inVoidFunction(body: string): string
{
    return `void _test() { ${body} }`;
}

/**
 * Wraps Ferrite statements in an int32 function body for top-level program parsing.
 *
 * @param body - Statement list inside the function block.
 * @returns A complete Ferrite program.
 */
function inInt32Function(body: string): string
{
    return `int32 _test() { ${body} }`;
}

describe('ferrite.grammar integration', () =>
{
    let grammarSource: string;
    let grammar: Grammar;
    let table: ParseTable;
    let parser: ParserLr;

    beforeAll(() =>
    {
        grammarSource = readFerriteGrammarSource();
        grammar = readGrammar(grammarSource);
        table = ParseTable.fromGrammar(grammar, 'lr1');
        parser = new ParserLr(grammar, table);
    }, 120_000);

    /**
     * Lexes and parses Ferrite source with the pre-built LR(1) table.
     *
     * @param source - Ferrite program text.
     * @returns Concrete syntax tree rooted at `program`, or null on failure.
     */
    function parseFerriteCst(source: string)
    {
        return parseWithTable(table, parser.lex(source));
    }

    /**
     * Parses Ferrite source and asserts a `program` root.
     *
     * @param source - Ferrite program text.
     */
    function expectFerriteParses(source: string): void
    {
        const cst = parseFerriteCst(source);

        expect(cst?.symbol).toBe('program');
    }

    /**
     * Parses invalid Ferrite source and asserts failure.
     *
     * @param source - Ferrite program text expected to fail.
     */
    function expectFerriteRejects(source: string): void
    {
        const result = parseWithTableResult(table, parser.lex(source));

        expect(result.cst).toBeNull();
        expect(result.errorOffset).not.toBeNull();
    }

    it('loads the ferrite grammar and builds an lr1 parse table', () =>
    {
        expect(grammar.name).toBe('ferrite');
        expect(grammar.startSymbol).toBe('program');
        expect(grammar.transformSchema).not.toBeNull();
        expect(table.toJson().algorithm).toBe('lr1');
        expect(table.toJson().startSymbol).toBe('program');
        expect(table.parserStateCount).toBeGreaterThan(0);
    });

    describe('types and declarations', () =>
    {
        it.each([
            ['void function', 'void noop() { return; }'],
            ['bool parameter', 'bool is_set(bool flag) { return flag; }'],
            ['int8 parameter', 'int8 clamp(int8 byte) { return byte; }'],
            ['int16 parameter', 'int16 widen(int16 word) { return word; }'],
            ['int32 function', 'int32 id(int32 count) { return count; }'],
            ['int64 literal', 'int64 big() { return 0x7FFFFFFFFFFFFFFF; }'],
            ['uint8 parameter', 'uint8 max(uint8 ubyte) { return ubyte; }'],
            ['uint16 parameter', 'uint16 wrap(uint16 uword) { return uword; }'],
            ['uint32 hex', 'uint32 hash() { return 0xDEADBEEF; }'],
            ['uint64 zero', 'uint64 zero() { return 0; }'],
            ['float32 literal', 'float32 pi() { return 3.14; }'],
            ['float64 literal', 'float64 e() { return 2.71828; }'],
            ['char literal', "char letter() { return 'x'; }"],
            ['named type field', 'struct Vec2 { float32 x; float32 y; };'],
            ['array parameter', 'int32 len(int32[10] buffer) { return 0; }'],
            ['single pointer param', 'int32 load(int32* p) { return *p; }'],
            ['double pointer param', 'void store(int32** pp, int32 v) { **pp = v; }'],
            ['pointer on named type', 'Vec2* origin(Vec2* cursor) { return cursor; }'],
            ['function prototype', 'int32 abs(int32 x);'],
            ['function definition', 'int32 twice(int32 x) { return x + x; }'],
            ['multi-parameter function', 'int32 add(int32 a, int32 b) { return a + b; }'],
        ])('parses %s', (_label, source) =>
        {
            expectFerriteParses(source);
        });
    });

    describe('structs and namespaces', () =>
    {
        it.each([
            ['empty struct', 'struct Empty { };'],
            ['struct fields', 'struct Point { int32 x; int32 y; };'],
            ['struct method', 'struct Counter { int32 n; int32 next() { return n + 1; } };'],
            ['namespace block', 'namespace Core { int32 version; }'],
            ['qualified using', 'using Ferrite.Math;'],
            ['nested qualified name', 'using Ferrite.Math.Vec;'],
            [
                'namespace with struct',
                [
                    'namespace Ferrite.Math {',
                    '    struct Vec2 {',
                    '        float32 x;',
                    '        float32 y;',
                    '        float32 dot(Vec2* other) {',
                    '            return x * other->x + y * other->y;',
                    '        }',
                    '    };',
                    '}',
                ].join('\n'),
            ],
        ])('parses %s', (_label, source) =>
        {
            expectFerriteParses(source);
        });
    });

    describe('control flow', () =>
    {
        it.each([
            ['if', inVoidFunction('if (flag) { x = 1; }')],
            ['if else', inVoidFunction('if (flag) { x = 1; } else { x = 2; }')],
            ['while', inVoidFunction('while (running) { step = step + 1; }')],
            ['for classic', inInt32Function('int32 sum = 0; for (int32 i = 0; i < 10; i = i + 1) { sum = sum + i; } return sum;')],
            ['for empty init', inVoidFunction('for (; i < 10; i = i + 1) { }')],
            ['return value', 'int32 zero() { return 0; }'],
            ['return void', 'void finish() { return; }'],
            ['break', inVoidFunction('while (true) { break; }')],
            ['continue', inVoidFunction('while (true) { continue; }')],
            ['brace init', inInt32Function('Vec2 v = { 1, 2 }; return 0;')],
        ])('parses %s', (_label, source) =>
        {
            expectFerriteParses(source);
        });
    });

    describe('operators and expressions', () =>
    {
        it.each([
            ['addition', inInt32Function('return a + b;')],
            ['subtraction', inInt32Function('return a - b;')],
            ['multiplication', inInt32Function('return a * b;')],
            ['division', inInt32Function('return a / b;')],
            ['modulo', inInt32Function('return a % b;')],
            ['logical or', 'bool either(bool a, bool b) { return a || b; }'],
            ['logical and', 'bool both(bool a, bool b) { return a && b; }'],
            ['bitwise or', inInt32Function('return a | b;')],
            ['bitwise xor', inInt32Function('return a ^ b;')],
            ['bitwise and', inInt32Function('return a & b;')],
            ['equality', 'bool eq(int32 a, int32 b) { return a == b; }'],
            ['inequality', 'bool ne(int32 a, int32 b) { return a != b; }'],
            ['less than', 'bool lt(int32 a, int32 b) { return a < b; }'],
            ['greater than', 'bool gt(int32 a, int32 b) { return a > b; }'],
            ['less or equal', 'bool le(int32 a, int32 b) { return a <= b; }'],
            ['greater or equal', 'bool ge(int32 a, int32 b) { return a >= b; }'],
            ['left shift', inInt32Function('return a << 2;')],
            ['right shift', inInt32Function('return a >> 2;')],
            ['assignment', inVoidFunction('x = 1;')],
            ['plus assign', inVoidFunction('x += 1;')],
            ['minus assign', inVoidFunction('x -= 1;')],
            ['star assign', inVoidFunction('x *= 2;')],
            ['slash assign', inVoidFunction('x /= 2;')],
            ['amp assign', inVoidFunction('x &= mask;')],
            ['pipe assign', inVoidFunction('x |= flag;')],
            ['caret assign', inVoidFunction('x ^= mask;')],
            ['address-of', inInt32Function('int32* p = &x; return *p;')],
            ['indirection', inInt32Function('return *p;')],
            ['logical not', 'bool flip(bool flag) { return !flag; }'],
            ['bitwise not', inInt32Function('return ~mask;')],
            ['unary minus', inInt32Function('return -n;')],
            ['unary plus', inInt32Function('return +n;')],
            ['pre increment', inVoidFunction('++i;')],
            ['post increment', inVoidFunction('i++;')],
            ['pre decrement', inVoidFunction('--i;')],
            ['post decrement', inVoidFunction('i--;')],
            ['index', inInt32Function('return arr[i];')],
            ['call', inInt32Function('return f(a, b);')],
            ['empty call', inVoidFunction('main();')],
            ['member', inInt32Function('return obj.field;')],
            ['arrow', inInt32Function('return ptr->field;')],
            ['cast paren', inInt32Function('return (int32)val;')],
            ['hex literal', inInt32Function('return 0xFF;')],
            ['binary literal', inInt32Function('return 0b1010;')],
            ['float literal', 'float64 scale() { return 1.5e10; }'],
            ['string literal', 'Text greet() { return "hello"; }'],
            ['null literal', 'int32* nil() { return null; }'],
            ['new expression', 'Node* alloc() { return new Node(); }'],
            ['new with args', 'Node* make() { return new Node(1, 2); }'],
            ['complex precedence', 'bool ok(int32 a, int32 b, int32 c, int32 d, bool e, bool f) { return a + b * c < d && e || f; }'],
        ])('parses %s', (_label, source) =>
        {
            expectFerriteParses(source);
        });
    });

    describe('complete programs', () =>
    {
        it('parses the ferrite header example program', () =>
        {
            const source = [
                'namespace Ferrite.Math {',
                '    struct Vec2 {',
                '        float32 x;',
                '        float32 y;',
                '        float32 dot(Vec2* other) {',
                '            return x * other->x + y * other->y;',
                '        }',
                '    };',
                '}',
                '',
                'using Ferrite.Math;',
                '',
                'int32 main() {',
                '    Vec2 a = { 1.0, 2.0 };',
                '    Vec2* p = &a;',
                '    return (int32)p->dot(&a);',
                '}',
            ].join('\n');

            expectFerriteParses(source);
        });

        it('parses a long expression chain', () =>
        {
            const terms = Array.from({ length: 40 }, (_, index) => String(index + 1));
            const source = inInt32Function(`return ${terms.join(' + ')};`);

            expectFerriteParses(source);
        });

        it('parses many top-level declarations', () =>
        {
            const decls = Array.from(
                { length: 30 },
                (_, index) => `int32 id${String(index)}(int32 x) { return x; }`,
            );
            const source = decls.join('\n');

            expectFerriteParses(source);
        });
    });

    describe('transform pipeline', () =>
    {
        it('transforms a parsed program into an AST using the same table', () =>
        {
            const source = 'int32 main() { return 1 + 2; }';
            const cst = parseFerriteCst(source);
            const schema = grammar.transformSchema;

            expect(cst).not.toBeNull();
            expect(schema).not.toBeNull();

            const ast = transformCst(cst, schema!, table);

            expect(ast?.symbol).toBe('program');
            expect(ast?.variant).toBe('program');
        });
    });

    describe('syntax errors', () =>
    {
        it.each([
            ['missing semicolon on prototype', 'int32 f()'],
            ['unclosed brace', 'int32 f() { return 0; '],
            ['stray token in body', inInt32Function('x = ;')],
            ['bad struct', 'struct { int32 x;'],
        ])('rejects %s', (_label, source) =>
        {
            expectFerriteRejects(source);
        });
    });
});
