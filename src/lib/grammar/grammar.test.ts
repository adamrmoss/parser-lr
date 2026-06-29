import { describe, expect, it } from '@jest/globals';

import { Grammar } from './grammar.js';

describe('Grammar', () =>
{
    it('looks up productions by name', () =>
    {
        const grammar = new Grammar(
            'calc',
            [],
            [],
            [],
            'program',
            [
                {
                    name: 'program',
                    expression: { kind: 'reference', name: 'statement' },
                },
                {
                    name: 'statement',
                    expression: { kind: 'terminal', value: 'end' },
                },
            ],
        );

        expect(grammar.name).toBe('calc');
        expect(grammar.startSymbol).toBe('program');
        expect(grammar.productions).toHaveLength(2);
        expect(grammar.hasProduction('statement')).toBe(true);
        expect(grammar.production('statement')?.expression).toEqual({
            kind: 'terminal',
            value: 'end',
        });
        expect(grammar.production('missing')).toBeNull();
    });

    it('stores lexer sections from a grammar file', () =>
    {
        const grammar = new Grammar(
            'grammar',
            [{ name: 'identifier', pattern: '[A-Za-z_][A-Za-z0-9_]*', flags: '' }],
            [{ name: 'whitespace', pattern: '[ \\t\\r\\n]+', flags: '' }],
            ['initial'],
            'grammar_file',
            [],
        );

        expect(grammar.tokenRules).toHaveLength(1);
        expect(grammar.skipRules).toHaveLength(1);
        expect(grammar.states).toEqual(['initial']);
    });

    it('represents labeled choice alternatives', () =>
    {
        const grammar = new Grammar(
            'example',
            [],
            [],
            [],
            'statement',
            [
                {
                    name: 'statement',
                    expression: {
                        kind: 'choice',
                        alternatives: [
                            {
                                label: 'assign',
                                expression: {
                                    kind: 'sequence',
                                    elements: [
                                        { kind: 'reference', name: 'identifier' },
                                        { kind: 'terminal', value: ':=' },
                                        { kind: 'reference', name: 'expression' },
                                    ],
                                },
                            },
                            {
                                label: null,
                                expression: {
                                    kind: 'sequence',
                                    elements: [
                                        { kind: 'terminal', value: 'skip' },
                                    ],
                                },
                            },
                        ],
                    },
                },
            ],
        );

        const statement = grammar.production('statement');
        expect(statement?.expression).toEqual({
            kind: 'choice',
            alternatives: [
                {
                    label: 'assign',
                    expression: {
                        kind: 'sequence',
                        elements: [
                            { kind: 'reference', name: 'identifier' },
                            { kind: 'terminal', value: ':=' },
                            { kind: 'reference', name: 'expression' },
                        ],
                    },
                },
                {
                    label: null,
                    expression: {
                        kind: 'sequence',
                        elements: [
                            { kind: 'terminal', value: 'skip' },
                        ],
                    },
                },
            ],
        });
    });
});
