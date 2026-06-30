import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Grammar } from '../../grammar/grammar.js';
import { readGrammar } from '../../grammar/read-grammar.js';

import { bnfSymbolKey } from './bnf-symbol.js';
import { desugarEbnf } from './desugar-ebnf.js';

describe('desugarEbnf', () =>
{
    it('expands choice into separate productions', () =>
    {
        const grammar = new Grammar(
            'example',
            [{ name: 'id', pattern: 'x', flags: '' }],
            [],
            [],
            'stmt',
            [
                {
                    name: 'stmt',
                    expression: {
                        kind: 'choice',
                        alternatives: [
                            {
                                label: 'assign',
                                expression: {
                                    kind: 'sequence',
                                    elements: [
                                        { kind: 'reference', name: 'id' },
                                        { kind: 'terminal', value: ':=' },
                                        { kind: 'reference', name: 'expr' },
                                    ],
                                },
                            },
                            {
                                label: 'skip',
                                expression: { kind: 'terminal', value: 'skip' },
                            },
                        ],
                    },
                },
            ],
        );

        const bnf = desugarEbnf(grammar);
        const stmtProductions = bnf.productionsFor('stmt');

        expect(stmtProductions).toHaveLength(2);
        expect(stmtProductions.map((production) => production.variant)).toEqual(['assign', 'skip']);
        expect(stmtProductions[0].rhs.map((symbol) => bnfSymbolKey(symbol))).toEqual([
            'id',
            '":="',
            'expr',
        ]);
        expect(stmtProductions[1].rhs).toEqual([{ kind: 'terminal', value: 'skip' }]);
    });

    it('expands repeat into a synthetic list non-terminal', () =>
    {
        const grammar = new Grammar(
            'example',
            [],
            [],
            [],
            'program',
            [
                {
                    name: 'program',
                    expression: {
                        kind: 'repeat',
                        element: { kind: 'reference', name: 'form' },
                    },
                },
                {
                    name: 'form',
                    expression: { kind: 'terminal', value: 'x' },
                },
            ],
        );

        const bnf = desugarEbnf(grammar);
        const programProductions = bnf.productionsFor('program');
        const repeatName = programProductions[0]?.rhs[0]?.kind === 'nonTerminal'
            ? programProductions[0].rhs[0].name
            : null;

        expect(programProductions).toHaveLength(1);
        expect(repeatName).not.toBeNull();
        expect(bnf.productionsFor(repeatName ?? '')).toEqual([
            {
                id: 0,
                name: repeatName,
                rhs: [
                    { kind: 'nonTerminal', name: 'form', binding: null },
                    { kind: 'nonTerminal', name: repeatName, binding: null },
                ],
                variant: null,
                origin: repeatName,
            },
            {
                id: 1,
                name: repeatName,
                rhs: [],
                variant: null,
                origin: repeatName,
            },
        ]);
    });

    it('expands optional into epsilon and populated alternatives', () =>
    {
        const grammar = new Grammar(
            'example',
            [{ name: 'id', pattern: 'x', flags: '' }],
            [],
            [],
            'line',
            [
                {
                    name: 'line',
                    expression: {
                        kind: 'sequence',
                        elements: [
                            { kind: 'reference', name: 'id' },
                            {
                                kind: 'optional',
                                element: { kind: 'reference', name: 'id' },
                            },
                        ],
                    },
                },
            ],
        );

        const bnf = desugarEbnf(grammar);

        expect(bnf.productionsFor('line')).toEqual([
            {
                id: 0,
                name: 'line',
                rhs: [{ kind: 'token', name: 'id', binding: null }],
                variant: null,
                origin: 'line',
            },
            {
                id: 1,
                name: 'line',
                rhs: [
                    { kind: 'token', name: 'id', binding: null },
                    { kind: 'token', name: 'id', binding: null },
                ],
                variant: null,
                origin: 'line',
            },
        ]);
    });

    it('desugars the lisp sample grammar into plain BNF', () =>
    {
        const source = readFileSync(join(process.cwd(), 'grammars/lisp.grammar'), 'utf8');
        const grammar = readGrammar(source);
        const bnf = desugarEbnf(grammar);

        expect(bnf.startSymbol).toBe('program');
        expect(bnf.productionsFor('form')).toHaveLength(2);
        expect(bnf.productionsFor('atom')).toHaveLength(3);

        const listProduction = bnf.productionsFor('list')[0];
        expect(listProduction?.rhs.map((symbol) => bnfSymbolKey(symbol))).toEqual([
            'lpar',
            expect.stringMatching(/^list\$repeat_/),
            'rpar',
        ]);
    });
});
