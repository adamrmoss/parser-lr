import { describe, expect, it } from '@jest/globals';

import { EOF_TOKEN_NAME } from '../../lexer/token.js';

import { BnfGrammar } from '../bnf/bnf-grammar.js';
import { analyzeGrammar } from './first-follow.js';

describe('GrammarAnalysis', () =>
{
    /**
     * Builds the dragon-book `S → B B`, `B → a B | b` grammar for analysis tests.
     */
    function dragonBookGrammar(): BnfGrammar
    {
        return new BnfGrammar('S', [
            {
                id: 0,
                name: 'S',
                rhs: [
                    { kind: 'nonTerminal', name: 'B', binding: null },
                    { kind: 'nonTerminal', name: 'B', binding: null },
                ],
                variant: null,
                origin: 'S',
            },
            {
                id: 1,
                name: 'B',
                rhs: [
                    { kind: 'terminal', value: 'a' },
                    { kind: 'nonTerminal', name: 'B', binding: null },
                ],
                variant: null,
                origin: 'B',
            },
            {
                id: 2,
                name: 'B',
                rhs: [{ kind: 'terminal', value: 'b' }],
                variant: null,
                origin: 'B',
            },
        ], []);
    }

    it('computes nullable non-terminals', () =>
    {
        const grammar = new BnfGrammar('A', [
            {
                id: 0,
                name: 'A',
                rhs: [],
                variant: null,
                origin: 'A',
            },
            {
                id: 1,
                name: 'B',
                rhs: [{ kind: 'nonTerminal', name: 'A', binding: null }],
                variant: null,
                origin: 'B',
            },
        ], []);

        const analysis = analyzeGrammar(grammar);

        expect(analysis.isNullable('A')).toBe(true);
        expect(analysis.isNullable('B')).toBe(true);
    });

    it('computes FIRST sets for terminals and non-terminals', () =>
    {
        const analysis = analyzeGrammar(dragonBookGrammar());

        expect([...analysis.firstOfNonTerminal('S')].sort()).toEqual(['"a"', '"b"']);
        expect([...analysis.firstOfNonTerminal('B')].sort()).toEqual(['"a"', '"b"']);
        expect([...analysis.firstOfSequence([
            { kind: 'nonTerminal', name: 'B', binding: null },
            { kind: 'terminal', value: 'c' },
        ])].sort()).toEqual(['"a"', '"b"']);
    });

    it('computes FOLLOW sets with end-of-input on the start symbol', () =>
    {
        const analysis = analyzeGrammar(dragonBookGrammar().augment());

        expect([...analysis.followOfNonTerminal('$accept')].sort()).toEqual([EOF_TOKEN_NAME]);
        expect([...analysis.followOfNonTerminal('S')].sort()).toEqual([EOF_TOKEN_NAME]);
        expect([...analysis.followOfNonTerminal('B')].sort()).toEqual(['"a"', '"b"', EOF_TOKEN_NAME]);
    });
});
