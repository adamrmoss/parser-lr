import { describe, expect, it } from '@jest/globals';

import { EOF_TOKEN_NAME } from '../lexer/token.js';

import { BnfGrammar } from './bnf/bnf-grammar.js';
import { buildLrTable } from './build-lr-table.js';

describe('buildLrTable', () =>
{
    /**
     * Builds the dragon-book `S → B B`, `B → a B | b` grammar for table tests.
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

    /**
     * Builds the dragon-book `S → L = R | R` grammar for conflict tests.
     */
    function danglingGrammar(): BnfGrammar
    {
        return new BnfGrammar('S', [
            {
                id: 0,
                name: 'S',
                rhs: [
                    { kind: 'nonTerminal', name: 'L', binding: null },
                    { kind: 'terminal', value: '=' },
                    { kind: 'nonTerminal', name: 'R', binding: null },
                ],
                variant: null,
                origin: 'S',
            },
            {
                id: 1,
                name: 'S',
                rhs: [{ kind: 'nonTerminal', name: 'R', binding: null }],
                variant: null,
                origin: 'S',
            },
            {
                id: 2,
                name: 'L',
                rhs: [
                    { kind: 'terminal', value: '*' },
                    { kind: 'nonTerminal', name: 'R', binding: null },
                ],
                variant: null,
                origin: 'L',
            },
            {
                id: 3,
                name: 'L',
                rhs: [{ kind: 'terminal', value: 'id' }],
                variant: null,
                origin: 'L',
            },
            {
                id: 4,
                name: 'R',
                rhs: [{ kind: 'nonTerminal', name: 'L', binding: null }],
                variant: null,
                origin: 'R',
            },
        ], []);
    }

    it('builds conflict-free SLR and LR(1) tables for the dragon-book grammar', () =>
    {
        const grammar = dragonBookGrammar();

        expect(buildLrTable(grammar, 'slr').isConflictFree).toBe(true);
        expect(buildLrTable(grammar, 'lr1').isConflictFree).toBe(true);
        expect(buildLrTable(grammar, 'lalr').isConflictFree).toBe(true);
    });

    it('uses every terminal as an LR(0) reduce lookahead', () =>
    {
        const grammar = new BnfGrammar('S', [
            {
                id: 0,
                name: 'S',
                rhs: [
                    { kind: 'nonTerminal', name: 'A', binding: null },
                    { kind: 'nonTerminal', name: 'B', binding: null },
                ],
                variant: null,
                origin: 'S',
            },
            {
                id: 1,
                name: 'A',
                rhs: [{ kind: 'terminal', value: 'a' }],
                variant: null,
                origin: 'A',
            },
            {
                id: 2,
                name: 'B',
                rhs: [{ kind: 'terminal', value: 'b' }],
                variant: null,
                origin: 'B',
            },
            {
                id: 3,
                name: 'C',
                rhs: [{ kind: 'terminal', value: 'c' }],
                variant: null,
                origin: 'C',
            },
        ], []);
        const lr0 = buildLrTable(grammar, 'lr0');
        const slr = buildLrTable(grammar, 'slr');
        let reduceState: number | null = null;

        for (let state = 0; state < lr0.stateCount; state += 1)
        {
            if (lr0.action(state, '"c"')?.kind === 'reduce')
            {
                reduceState = state;
                break;
            }
        }

        expect(reduceState).not.toBeNull();
        expect(lr0.action(reduceState ?? 0, '"c"')).toEqual({ kind: 'reduce', productionId: 1 });
        expect(slr.action(reduceState ?? 0, '"c"')).toBeNull();
    });

    it('resolves the L=R grammar under LR(1) but not under SLR', () =>
    {
        const grammar = danglingGrammar();

        expect(buildLrTable(grammar, 'slr').isConflictFree).toBe(false);
        expect(buildLrTable(grammar, 'lr1').isConflictFree).toBe(true);
        expect(buildLrTable(grammar, 'lalr').isConflictFree).toBe(true);
    });

    it('accepts on end-of-input in the augmented start state', () =>
    {
        const table = buildLrTable(dragonBookGrammar(), 'slr');

        expect(table.action(4, EOF_TOKEN_NAME)).toEqual({ kind: 'accept' });
    });
});
