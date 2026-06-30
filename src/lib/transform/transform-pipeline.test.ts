import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ParseContext } from '../parse-context.js';

describe('calc.grammar transform pipeline', () =>
{
    const grammarSource = readFileSync(join(process.cwd(), 'grammars/calc.grammar'), 'utf8');

    it('parses and transforms addition into an AST', () =>
    {
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const ast = context.parseSource('1 + 2');

        expect(ast?.symbol).toBe('expr');
        expect(ast?.variant).toBe('binary');
        expect(ast?.children).toHaveLength(3);
    });
});

describe('lisp.grammar transform pipeline', () =>
{
    const grammarSource = readFileSync(join(process.cwd(), 'grammars/lisp.grammar'), 'utf8');

    it('parses and transforms a list form into an AST', () =>
    {
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const ast = context.parseSource('(+ 1 2)');

        expect(ast?.symbol).toBe('program');
        expect(ast?.variant).toBe('program');
        expect(ast?.children).toHaveLength(1);
        expect(ast?.children[0]?.symbol).toBe('list');
        expect(ast?.children[0]?.variant).toBe('list');
        expect(ast?.children[0]?.children[0]?.symbol).toBe('lpar');
        expect(ast?.children[0]?.children[1]?.symbol).toBe('form');
        expect(ast?.children[0]?.children[1]?.variant).toBe('elements');
        expect(ast?.children[0]?.children[1]?.children.map((child) => child.variant)).toEqual([
            'symbol',
            'number',
            'number',
        ]);
    });
});

describe('6502.grammar transform pipeline', () =>
{
    const grammarSource = readFileSync(join(process.cwd(), 'grammars/6502.grammar'), 'utf8');

    it('parses and transforms an assembler program into an AST', () =>
    {
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const ast = context.parseSource('.org $8000\n    BRK\n');

        expect(ast?.symbol).toBe('program');
        expect(ast?.variant).toBe('program');
        expect(ast?.children).toHaveLength(2);
        expect(ast?.children[0]?.symbol).toBe('line');
        expect(ast?.children[0]?.variant).toBe('directive');
        expect(ast?.children[1]?.symbol).toBe('line');
        expect(ast?.children[1]?.variant).toBe('code');
        expect(ast?.children[1]?.children[0]?.variant).toBe('implied');
    });
});
