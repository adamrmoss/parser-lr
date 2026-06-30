import { describe, expect, it } from '@jest/globals';

import { EOF_TOKEN_NAME } from '../../lexer/token.js';

import { BnfGrammar } from '../bnf/bnf-grammar.js';
import {
    buildSlrTable,
    formatSlrActions,
    formatSlrConflicts,
    formatSlrGotos,
} from './slr-table.js';

describe('buildSlrTable', () =>
{
    /**
     * Builds the dragon-book `S → B B`, `B → a B | b` grammar for SLR tests.
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

    it('builds a conflict-free SLR table for the dragon-book grammar', () =>
    {
        const table = buildSlrTable(dragonBookGrammar());

        expect(table.isConflictFree).toBe(true);
        expect(table.stateCount).toBe(7);
        expect(table.action(0, '"a"')).toEqual({ kind: 'shift', state: 1 });
        expect(table.action(0, '"b"')).toEqual({ kind: 'shift', state: 2 });
        expect(table.action(4, EOF_TOKEN_NAME)).toEqual({ kind: 'accept' });
        expect(table.action(2, '"b"')).toEqual({ kind: 'reduce', productionId: 2 });
        expect(table.goto(0, 'B')).toBe(3);
        expect(table.goto(0, 'S')).toBe(4);
        expect(formatSlrActions(table, 0)).toEqual([
            '"a"=s1',
            '"b"=s2',
        ]);
        expect(formatSlrGotos(table, 0)).toEqual([
            'B=3',
            'S=4',
        ]);
    });

    it('reports shift/reduce conflicts for the dragon-book L=R grammar', () =>
    {
        const grammar = new BnfGrammar('S', [
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

        const table = buildSlrTable(grammar);

        expect(table.isConflictFree).toBe(false);
        expect(table.conflicts.some((conflict) => conflict.kind === 'shift-reduce')).toBe(true);
        expect(formatSlrConflicts(table).some((label) => label.includes('shift-reduce'))).toBe(true);
    });

    it('reports reduce/reduce conflicts when two productions share a reduce lookaead', () =>
    {
        const grammar = new BnfGrammar('S', [
            {
                id: 0,
                name: 'S',
                rhs: [{ kind: 'terminal', value: 'x' }],
                variant: null,
                origin: 'S',
            },
            {
                id: 1,
                name: 'S',
                rhs: [{ kind: 'terminal', value: 'x' }],
                variant: null,
                origin: 'S',
            },
        ], []);

        const table = buildSlrTable(grammar);

        expect(table.isConflictFree).toBe(false);
        expect(table.conflicts.every((conflict) => conflict.kind === 'reduce-reduce')).toBe(true);
    });
});
