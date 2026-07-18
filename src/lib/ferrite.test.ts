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
 * Wraps Ferrite statements in a private Void function body for top-level program parsing.
 *
 * @param body - Statement list inside the function block.
 * @returns A complete Ferrite program.
 */
function inVoidFunction(body: string): string
{
    return `private Void test() { ${body} }`;
}

/**
 * Wraps Ferrite statements in a private Int32 function body for top-level program parsing.
 *
 * @param body - Statement list inside the function block.
 * @returns A complete Ferrite program.
 */
function inInt32Function(body: string): string
{
    return `private Int32 test() { ${body} }`;
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

    describe('literal regex suffix flags', () =>
    {
        it.each([
            ['0XFF', 'int_literal'],
            ['0xDeadBeef', 'int_literal'],
            ['0B1010', 'int_literal'],
            ['1.5E10', 'float_literal'],
            ['3.14e-2', 'float_literal'],
        ])('lexes %s as %s', (text, tokenName) =>
        {
            const tokens = parser.lex(text);

            expect(tokens[0]).toMatchObject({
                name: tokenName,
                text,
            });
        });

        it.each([
            ['uppercase hex prefix', inInt32Function('return 0XFF;')],
            ['mixed-case hex digits', inInt32Function('return 0xDeadBeef;')],
            ['uppercase binary prefix', inInt32Function('return 0B1010;')],
            ['uppercase float exponent', 'private Float64 scale() { return 1.5E10; }'],
        ])('parses %s', (_label, source) =>
        {
            expectFerriteParses(source);
        });
    });

    describe('types and declarations', () =>
    {
        it.each([
            ['void function', 'private Void noop() { return; }'],
            ['bool parameter', 'private Bool isSet(Bool flag) { return flag; }'],
            ['int8 parameter', 'private Int8 clamp(Int8 byte) { return byte; }'],
            ['int16 parameter', 'private Int16 widen(Int16 word) { return word; }'],
            ['int32 function', 'private Int32 id(Int32 count) { return count; }'],
            ['int64 literal', 'private Int64 big() { return 0x7FFFFFFFFFFFFFFF; }'],
            ['uint8 parameter', 'private UInt8 max(UInt8 ubyte) { return ubyte; }'],
            ['uint16 parameter', 'private UInt16 wrap(UInt16 uword) { return uword; }'],
            ['uint32 hex', 'private UInt32 hash() { return 0xDEADBEEF; }'],
            ['uint64 zero', 'private UInt64 zero() { return 0; }'],
            ['float32 literal', 'private Float32 pi() { return 3.14; }'],
            ['float64 literal', 'private Float64 e() { return 2.71828; }'],
            ['char literal', "private Char letter() { return 'x'; }"],
            ['named type field', 'private struct Vec2 { Float32 x; Float32 y; };'],
            ['array parameter', 'private Int32 len(Int32[10] buffer) { return 0; }'],
            ['single pointer param', 'private Int32 load(Int32* p) { return *p; }'],
            ['double pointer param', 'private Void store(Int32** pp, Int32 v) { **pp = v; }'],
            ['pointer on named type', 'private Vec2* origin(Vec2* cursor) { return cursor; }'],
            ['function prototype', 'public Int32 abs(Int32 x);'],
            ['function definition', 'public Int32 twice(Int32 x) { return x + x; }'],
            ['multi-parameter function', 'public Int32 add(Int32 a, Int32 b) { return a + b; }'],
            ['public struct', 'public struct Point { Int32 x; Int32 y; };'],
            ['private prototype', 'private Void helper();'],
        ])('parses %s', (_label, source) =>
        {
            expectFerriteParses(source);
        });
    });

    describe('file layout', () =>
    {
        it.each([
            ['empty file', ''],
            ['namespace only', 'namespace Internal;'],
            ['qualified namespace', 'namespace Ferrite.Math;'],
            ['using only', 'using Ferrite.Math;'],
            ['nested using', 'using Ferrite.Math.Vec;'],
            [
                'namespace then usings then decls',
                [
                    'namespace Ferrite.Math;',
                    'using Ferrite.Core;',
                    'using Ferrite.IO;',
                    'public struct Vec2 { Float32 x; Float32 y; };',
                    'public Int32 main() { return 0; }',
                ].join('\n'),
            ],
            [
                'usings without namespace',
                [
                    'using Ferrite.Math;',
                    'public Int32 main() { return 0; }',
                ].join('\n'),
            ],
            [
                'namespace with struct method',
                [
                    'namespace Ferrite.Math;',
                    'public struct Vec2 {',
                    '    Float32 x;',
                    '    Float32 y;',
                    '    Float32 dot(Vec2* other) {',
                    '        return x * other->x + y * other->y;',
                    '    }',
                    '};',
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
            ['for classic', inInt32Function('Int32 sum = 0; for (Int32 i = 0; i < 10; i = i + 1) { sum = sum + i; } return sum;')],
            ['for empty init', inVoidFunction('for (; i < 10; i = i + 1) { }')],
            ['return value', 'private Int32 zero() { return 0; }'],
            ['return void', 'private Void finish() { return; }'],
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
            ['logical or', 'private Bool either(Bool a, Bool b) { return a || b; }'],
            ['logical and', 'private Bool both(Bool a, Bool b) { return a && b; }'],
            ['bitwise or', inInt32Function('return a | b;')],
            ['bitwise xor', inInt32Function('return a ^ b;')],
            ['bitwise and', inInt32Function('return a & b;')],
            ['equality', 'private Bool eq(Int32 a, Int32 b) { return a == b; }'],
            ['inequality', 'private Bool ne(Int32 a, Int32 b) { return a != b; }'],
            ['less than', 'private Bool lt(Int32 a, Int32 b) { return a < b; }'],
            ['greater than', 'private Bool gt(Int32 a, Int32 b) { return a > b; }'],
            ['less or equal', 'private Bool le(Int32 a, Int32 b) { return a <= b; }'],
            ['greater or equal', 'private Bool ge(Int32 a, Int32 b) { return a >= b; }'],
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
            ['address-of', inInt32Function('Int32* p = &x; return *p;')],
            ['indirection', inInt32Function('return *p;')],
            ['logical not', 'private Bool flip(Bool flag) { return !flag; }'],
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
            ['cast paren', inInt32Function('return (Int32)val;')],
            ['hex literal', inInt32Function('return 0xFF;')],
            ['binary literal', inInt32Function('return 0b1010;')],
            ['float literal', 'private Float64 scale() { return 1.5e10; }'],
            ['string literal', 'private Text greet() { return "hello"; }'],
            ['null literal', 'private Int32* nil() { return null; }'],
            ['new expression', 'private Node* alloc() { return new Node(); }'],
            ['new with args', 'private Node* make() { return new Node(1, 2); }'],
            ['complex precedence', 'private Bool ok(Int32 a, Int32 b, Int32 c, Int32 d, Bool e, Bool f) { return a + b * c < d && e || f; }'],
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
                'namespace Ferrite.Math;',
                '',
                'using Ferrite.Core;',
                '',
                'public struct Vec2',
                '{',
                '    Float32 x;',
                '    Float32 y;',
                '    Float32 dot(Vec2* other)',
                '    {',
                '        return x * other->x + y * other->y;',
                '    }',
                '};',
                '',
                'public Int32 main()',
                '{',
                '    Vec2 a = { 1.0, 2.0 };',
                '    Vec2* p = &a;',
                '    return (Int32)p->dot(&a);',
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
                (_, index) => `private Int32 id${String(index)}(Int32 x) { return x; }`,
            );
            const source = decls.join('\n');

            expectFerriteParses(source);
        });
    });

    describe('transform pipeline', () =>
    {
        it('transforms a parsed program into an AST using the same table', () =>
        {
            const source = 'public Int32 main() { return 1 + 2; }';
            const cst = parseFerriteCst(source);
            const schema = grammar.transformSchema;

            expect(cst).not.toBeNull();
            expect(schema).not.toBeNull();

            const ast = transformCst(cst, schema!, table);

            expect(ast?.symbol).toBe('program');
            expect(ast?.variant).toBe('program');
        });

        it('preserves file namespace, usings, and access modifiers in the AST', () =>
        {
            const source = [
                'namespace Ferrite.Math;',
                'using Ferrite.Core;',
                'public Int32 main() { return 0; }',
            ].join('\n');
            const cst = parseFerriteCst(source);
            const schema = grammar.transformSchema;

            expect(cst).not.toBeNull();
            expect(schema).not.toBeNull();

            const ast = transformCst(cst, schema!, table);

            expect(ast?.symbol).toBe('program');
            expect(ast?.children.some((child) => child.symbol === 'file_namespace')).toBe(true);
            expect(ast?.children.some((child) => child.symbol === 'using_list')).toBe(true);
            expect(ast?.children.some((child) => child.symbol === 'decl_list')).toBe(true);
        });
    });

    describe('syntax errors', () =>
    {
        it.each([
            ['missing semicolon on prototype', 'public Int32 f()'],
            ['unclosed brace', 'public Int32 f() { return 0; '],
            ['stray token in body', inInt32Function('x = ;')],
            ['bad struct', 'public struct { Int32 x;'],
            ['block namespace', 'namespace Internal { public Int32 x() { return 0; } }'],
            ['namespace after using', 'using Ferrite.Math;\nnamespace Internal;'],
            ['namespace after declaration', 'public Int32 main() { return 0; }\nnamespace Internal;'],
            ['duplicate namespace', 'namespace A;\nnamespace B;'],
            ['using after declaration', 'public Int32 main() { return 0; }\nusing Ferrite.Math;'],
            ['missing access on function', 'Int32 main() { return 0; }'],
            ['missing access on struct', 'struct Point { Int32 x; };'],
            ['missing access on prototype', 'Void helper();'],
        ])('rejects %s', (_label, source) =>
        {
            expectFerriteRejects(source);
        });
    });
});
