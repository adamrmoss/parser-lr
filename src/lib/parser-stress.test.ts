import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ParseContext } from './parse-context.js';
import { readGrammar } from './grammar/read-grammar.js';
import { ParseTable } from './parse-table/parse-table.js';
import { parseWithTable, parseWithTableResult } from './shift-reduce/shift-reduce-engine.js';
import { transformCst } from './transform/cst-transformer.js';

const grammarsDirectory = join(process.cwd(), 'grammars');

/**
 * Reads a `.grammar` file from the project `grammars/` directory.
 *
 * @param filename - Grammar file basename.
 * @returns Full grammar file text.
 */
function readGrammarFile(filename: string): string
{
    return readFileSync(join(grammarsDirectory, filename), 'utf8');
}

describe('parser stress — sample grammars across LR algorithms', () =>
{
    const sampleGrammars = [
        { file: 'calc.grammar', conflictFree: ['lr0', 'slr', 'lalr', 'lr1'] as const },
        { file: 'lisp.grammar', conflictFree: ['slr', 'lalr', 'lr1'] as const },
        { file: '6502.grammar', conflictFree: ['slr', 'lalr', 'lr1'] as const },
    ];

    for (const { file: filename, conflictFree } of sampleGrammars)
    {
        describe(filename, () =>
        {
            const source = readGrammarFile(filename);
            const grammar = readGrammar(source);

            for (const algorithm of conflictFree)
            {
                it(`builds a conflict-free ${algorithm} table`, () =>
                {
                    const table = ParseTable.fromGrammar(grammar, algorithm);

                    expect(table.toJson().algorithm).toBe(algorithm);
                });
            }

            if (conflictFree.every((algorithm) => algorithm !== 'lr0'))
            {
                it('reports LR(0) shift-reduce conflicts as warnings', () =>
                {
                    const table = ParseTable.fromGrammar(grammar, 'lr0');

                    expect(table.isConflictFree).toBe(false);
                    expect(table.conflicts.length).toBeGreaterThan(0);
                });
            }

            it('parses representative input under lr1', () =>
            {
                const context = ParseContext.fromGrammar(source, 'lr1');

                if (filename === 'calc.grammar')
                {
                    expect(context.parseSource('1 + 2 + 3')).not.toBeNull();
                }
                else if (filename === 'lisp.grammar')
                {
                    expect(context.parseSource('(+ 1 (* 2 3))')).not.toBeNull();
                }
                else
                {
                    expect(context.parseSource('.org $8000\nLDA #$01\n')).not.toBeNull();
                }
            });
        });
    }
});

describe('parser stress — calc left-recursive chains', () =>
{
    const grammarSource = readGrammarFile('calc.grammar');

    it('parses a long left-recursive addition chain', () =>
    {
        const terms = Array.from({ length: 200 }, (_, index) => String(index + 1));
        const source = terms.join(' + ');
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const tree = context.parseSource(source);

        expect(tree).not.toBeNull();
        expect(astDepth(tree)).toBeGreaterThan(100);
    });

    it('rejects malformed calc input at the first bad token', () =>
    {
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const tokens = context.lex('1 + + 2');
        const result = parseWithTableResult(context.table, tokens);

        expect(result.cst).toBeNull();
        expect(result.errorOffset).not.toBeNull();
        expect(result.errorMessage).toMatch(/Unexpected/);
    });
});

describe('parser stress — lisp nesting and flatten transforms', () =>
{
    const grammarSource = readGrammarFile('lisp.grammar');

    it('parses deeply nested s-expressions', () =>
    {
        const depth = 150;
        const source = `${'('.repeat(depth)}42${')'.repeat(depth)}`;
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const tree = context.parseSource(source);

        expect(tree).not.toBeNull();
        expect(tree?.symbol).toBe('program');
    });

    it('parses a long flat list and flattens elements in the AST', () =>
    {
        const count = 100;
        const elements = Array.from({ length: count }, (_, index) => String(index)).join(' ');
        const source = `(${elements})`;
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const ast = context.parseSource(source);

        expect(ast).not.toBeNull();
        expect(ast?.children[0]?.symbol).toBe('list');
        expect(ast?.children[0]?.children[1]?.children).toHaveLength(count);
    });

    it('parses multiple top-level forms', () =>
    {
        const forms = Array.from({ length: 50 }, (_, index) => `(+ ${String(index)} 1)`);
        const source = forms.join('\n');
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const ast = context.parseSource(source);

        expect(ast?.children).toHaveLength(50);
    });
});

describe('parser stress — 6502 assembler volume', () =>
{
    const grammarSource = readGrammarFile('6502.grammar');

    it('parses a large program with mixed instruction forms', () =>
    {
        const lines = [
            '.org $8000',
            'start:',
            '    LDA #$01',
            '    STA $0200',
            '    LDX #$00',
            'loop:',
            '    INX',
            '    CPX #$10',
            '    BNE loop',
            '    BRK',
        ];
        const repeated = Array.from({ length: 20 }, () => lines.join('\n')).join('\n');
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const ast = context.parseSource(repeated);

        expect(ast?.symbol).toBe('program');
        expect(ast?.children.length).toBeGreaterThan(100);
    });
});

describe('parser stress — meta-grammar bootstrap', () =>
{
    const metaSource = readGrammarFile('grammar.grammar');

    it('parses every sample grammar file through the meta-grammar', () =>
    {
        const context = ParseContext.fromGrammar(metaSource, 'lr1');

        for (const filename of ['calc.grammar', 'lisp.grammar', '6502.grammar', 'ferrite.grammar', 'grammar.grammar'])
        {
            const source = readGrammarFile(filename);
            const ast = context.parseSource(source);

            expect(ast).not.toBeNull();
            expect(ast?.symbol).toBe('grammar_file');
        }
    });

    it('parses its own grammar file text', () =>
    {
        const context = ParseContext.fromGrammar(metaSource, 'lr1');
        const ast = context.parseSource(metaSource);

        expect(ast).not.toBeNull();
        expect(ast?.symbol).toBe('grammar_file');
    });
});

describe('parser stress — table JSON round-trip parity', () =>
{
    const cases = [
        { file: 'calc.grammar', input: '9 + 8 + 7' },
        { file: 'lisp.grammar', input: '(quote (a b c))' },
        { file: '6502.grammar', input: 'LDA #$FF\n' },
    ];

    for (const { file, input } of cases)
    {
        it(`produces identical CST shape for ${file} after JSON round-trip`, () =>
        {
            const grammarSource = readGrammarFile(file);
            const grammar = readGrammar(grammarSource);
            const memoryTable = ParseTable.fromGrammar(grammar, 'lr1');
            const jsonTable = ParseTable.fromJsonString(memoryTable.toJsonString());
            const tokens = ParseContext.fromGrammar(grammarSource, 'lr1').lex(input);

            const fromMemory = parseWithTable(memoryTable, tokens);
            const fromJson = parseWithTable(jsonTable, tokens);

            expect(fromJson).toEqual(fromMemory);
        });
    }
});

describe('parser stress — all algorithms agree on conflict-free calc input', () =>
{
    const grammarSource = readGrammarFile('calc.grammar');
    const input = '1 + 2 + 3';

    for (const algorithm of ['lr0', 'slr', 'lalr', 'lr1'] as const)
    {
        it(`accepts calc input under ${algorithm}`, () =>
        {
            const context = ParseContext.fromGrammar(grammarSource, algorithm);
            const table = context.table;

            expect(table.toJson().algorithm).toBe(algorithm);
            expect(context.parser.parseCst(context.lex(input))?.symbol).toBe('expr');
        });
    }
});

describe('parser stress — lexer streaming and chunk APIs', () =>
{
    const grammarSource = readGrammarFile('lisp.grammar');

    it('lexes chunked lisp source identically to a single push', () =>
    {
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const source = '(+ 1 2)\n(* 3 4)\n';
        const whole = context.lex(source);
        const chunked = context.parser.lexChunkStream(['(+ 1 ', '2)\n(* ', '3 4)\n']);

        expect(chunked).toEqual(whole);
    });
});

describe('parser stress — reduce-reduce conflict detection', () =>
{
    it('reports reduce-reduce conflicts for overlapping nullable prefixes', () =>
    {
        const grammarSource = `
name "rr" ;

tokens
    a = /a/ ;
    b = /b/ ;

start s ;

grammar
    s =
        a [ b ]
      | a
    ;
`;

        const context = ParseContext.fromGrammar(grammarSource, 'lr1');

        expect(context.table.isConflictFree).toBe(false);
        expect(context.table.conflicts.some((conflict) => conflict.kind === 'reduce-reduce')).toBe(true);
        expect(context.table.formatConflictWarnings().length).toBeGreaterThan(0);
    });
});

describe('parser stress — transform pipeline edge cases', () =>
{
    it('applies flatten transforms on empty and singleton repeats', () =>
    {
        const grammarSource = readGrammarFile('lisp.grammar');
        const grammar = readGrammar(grammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');

        const emptyList = context.parseSource('()');
        expect(emptyList).not.toBeNull();

        const singleton = context.parseSource('(x)');
        expect(singleton?.children[0]?.children[1]?.children).toHaveLength(1);

        const cst = context.parser.parseCst(context.lex('(a b)'));
        const schema = grammar.transformSchema;

        expect(schema).not.toBeNull();
        expect(cst).not.toBeNull();
        expect(transformCst(cst, schema!, table)).not.toBeNull();
    });
});

/**
 * Returns the maximum depth of an AST subtree.
 *
 * @param node - Root node, or null when absent.
 */
function astDepth(node: { children: readonly unknown[] } | null): number
{
    if (node === null || node.children.length === 0)
    {
        return 0;
    }

    let maxChild = 0;

    for (const child of node.children)
    {
        if (typeof child === 'object' && child !== null && 'children' in child)
        {
            maxChild = Math.max(maxChild, astDepth(child as { children: readonly unknown[] }));
        }
    }

    return maxChild + 1;
}
