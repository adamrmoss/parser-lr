import { describe, expect, it } from '@jest/globals';

import { EOF_TOKEN_NAME } from '../../lexer/token.js';
import { BnfGrammar } from '../bnf/bnf-grammar.js';
import type { BnfProduction } from '../bnf/bnf-production.js';
import type { BnfNonTerminalSymbol, BnfSymbol } from '../bnf/bnf-symbol.js';
import { buildLrTable } from '../build-lr-table.js';

import {
    encodeProductionRhs,
    formatLrActions,
    formatLrConflictWarnings,
    formatLrConflicts,
    formatLrGotos,
    formatParseConflictWarning,
    lrActionTerminalKeys,
    lrGotoNonTerminalNames,
    lrProduction,
} from './lr-parse-table.js';

function nt(name: string): BnfNonTerminalSymbol
{
    return { kind: 'nonTerminal', name, binding: null };
}

function term(value: string): BnfSymbol
{
    return { kind: 'terminal', value };
}

function production(
    id: number,
    name: string,
    rhs: readonly BnfSymbol[],
): BnfProduction
{
    return {
        id,
        name,
        rhs,
        variant: null,
        origin: name,
    };
}

describe('lr-parse-table formatting helpers', () =>
{
    const grammar = new BnfGrammar('S', [
        production(0, 'S', [term('a')]),
    ], []);

    const table = buildLrTable(grammar.augment(), 'lr1');

    it('formats ACTION and GOTO rows for a state', () =>
    {
        expect(formatLrActions(table, 0).length).toBeGreaterThan(0);
        expect(formatLrGotos(table, 999)).toEqual([]);
        expect(formatLrActions(table, 999)).toEqual([]);
    });

    it('collects terminal keys and non-terminal GOTO names', () =>
    {
        expect(lrActionTerminalKeys(table)).toContain('"a"');
        expect(lrGotoNonTerminalNames(table).length).toBeGreaterThan(0);
    });

    it('looks up productions and encodes right-hand sides', () =>
    {
        const found = lrProduction(table, 0);

        expect(found).not.toBeNull();
        expect(encodeProductionRhs(found!)).toContain('"a"');
        expect(lrProduction(table, 999)).toBeNull();
    });
});

describe('parse conflict warning formatters', () =>
{
    const grammar = new BnfGrammar('S', [
        production(0, 'S', [term('if'), nt('E'), term('then'), nt('S')]),
        production(1, 'S', [
            term('if'),
            nt('E'),
            term('then'),
            nt('S'),
            term('else'),
            nt('S'),
        ]),
        production(2, 'S', [term('other')]),
        production(3, 'E', [term('id')]),
    ], []);

    const conflicted = buildLrTable(grammar, 'lr1');

    it('formats shift/reduce and reduce/reduce warnings', () =>
    {
        expect(conflicted.conflicts.length).toBeGreaterThan(0);

        const shiftReduce = conflicted.conflicts.find((conflict) => conflict.kind === 'shift-reduce');

        expect(shiftReduce).toBeDefined();
        expect(formatParseConflictWarning(shiftReduce!)).toContain('resolved as shift');
        expect(formatLrConflictWarnings(conflicted).length).toBe(conflicted.conflicts.length);
        expect(formatLrConflicts(conflicted)[0]).toContain('resolved as');
    });

    it('labels end-of-input conflicts distinctly', () =>
    {
        const warning = formatParseConflictWarning({
            kind: 'shift-reduce',
            state: 0,
            symbol: EOF_TOKEN_NAME,
            existing: { kind: 'shift', state: 1 },
            incoming: { kind: 'reduce', productionId: 0 },
            resolution: 'shift',
        });

        expect(warning).toContain('token $eof');
    });

    it('formats reduce/reduce warnings with the kept production id', () =>
    {
        const warning = formatParseConflictWarning({
            kind: 'reduce-reduce',
            state: 2,
            symbol: '"a"',
            existing: { kind: 'reduce', productionId: 0 },
            incoming: { kind: 'reduce', productionId: 1 },
            resolution: 'reduce',
        });

        expect(warning).toContain('resolved using rule 0');
    });
});
