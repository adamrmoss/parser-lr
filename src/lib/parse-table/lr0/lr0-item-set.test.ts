import { describe, expect, it } from '@jest/globals';

import { BnfGrammar } from '../bnf/bnf-grammar.js';
import { buildLr0ItemSets, formatLr0ItemSet } from './lr0-item-set.js';

describe('buildLr0ItemSets', () =>
{
    /**
     * Builds the dragon-book `S → B B`, `B → a B | b` grammar for LR(0) tests.
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
        ], []).augment();
    }

    it('builds the canonical LR(0) collection for the dragon-book grammar', () =>
    {
        const grammar = dragonBookGrammar();
        const collection = buildLr0ItemSets(grammar);

        expect(collection.itemSets).toHaveLength(7);
        expect(formatLr0ItemSet(grammar, collection.itemSets[0])).toEqual([
            'S → · B B',
            'B → · "a" B',
            'B → · "b"',
            '$accept → · S',
        ]);
        expect(formatLr0ItemSet(grammar, collection.itemSets[3])).toEqual([
            'S → B · B',
            'B → · "a" B',
            'B → · "b"',
        ]);
        expect(formatLr0ItemSet(grammar, collection.itemSets[4])).toEqual([
            '$accept → S ·',
        ]);
        expect(formatLr0ItemSet(grammar, collection.itemSets[6])).toEqual([
            'S → B B ·',
        ]);
    });

    it('locates item sets by canonical identity', () =>
    {
        const grammar = dragonBookGrammar();
        const collection = buildLr0ItemSets(grammar);
        const stateOne = collection.itemSets[1] ?? [];

        expect(collection.indexOf(stateOne)).toBe(1);
        expect(collection.indexOf(collection.itemSets[0] ?? [])).toBe(0);
    });
});
