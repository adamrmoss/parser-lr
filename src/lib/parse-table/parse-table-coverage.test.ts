import { describe, expect, it } from '@jest/globals';

import { readGrammar } from '../grammar/read-grammar.js';
import { Grammar } from '../grammar/grammar.js';
import { eofToken } from '../lexer/token.js';
import { ParseTableBuildError } from '../parse-table/parse-table-build-error.js';
import { ParseTable } from '../parse-table/parse-table.js';
import { tokenInventory } from '../parse-table/token-inventory.js';
import { formatParseAction, type ParseAction } from '../parse-table/table/parse-action.js';
import { parseWithTableResult } from '../shift-reduce/shift-reduce-engine.js';

describe('ParseTable coverage gaps', () =>
{
    it('serializes lexer-only tables without parser entries', () =>
    {
        const table = new ParseTable(
            'lexer-only',
            'expr',
            ['number', '$eof'],
            [{ name: 'number', pattern: '[0-9]+', flags: '' }],
            [],
            [],
            'lr1',
        );

        expect(table.hasParserTable).toBe(false);
        expect(table.toJson()).toEqual({
            version: 1,
            algorithm: 'lr1',
            grammarName: 'lexer-only',
            startSymbol: 'expr',
            tokens: ['number', '$eof'],
            tokenRules: [{ name: 'number', pattern: '[0-9]+', flags: '' }],
            skipRules: [],
            states: [],
        });
    });

    it('preserves an explicit $eof entry in the token inventory', () =>
    {
        const grammar = new Grammar(
            'eof',
            [{ name: '$eof', pattern: '', flags: '' }],
            [],
            [],
            'S',
            [],
        );

        expect(tokenInventory(grammar)).toEqual(['$eof']);
    });

    it('records conflicts on tables built from grammars', () =>
    {
        const grammar = readGrammar(`
name "ambiguous" ;

tokens
    a = /a/ ;

start S ;

grammar
    S = A | B ;
    A = "a" ;
    B = "a" ;
`);

        const table = ParseTable.fromGrammar(grammar, 'lr0');

        expect(table.isConflictFree).toBe(false);
        expect(table.formatConflictWarnings().length).toBeGreaterThan(0);
    });
});

describe('shift-reduce parse diagnostics', () =>
{
    it('reports invalid reduce actions and empty accept results', () =>
    {
        const table = new ParseTable(
            'broken',
            'S',
            ['a', '$eof'],
            [],
            [],
            [],
            'lr1',
            2,
            [{
                id: 0,
                name: 'S',
                rhs: ['a'],
                variant: null,
                origin: 'S',
            }],
            new Map<number, Map<string, ParseAction>>([
                [0, new Map([['a', { kind: 'shift', state: 1 }]])],
                [1, new Map([['$eof', { kind: 'reduce', productionId: 999 }]])],
            ]),
            new Map([
                [0, new Map([['S', 1]])],
            ]),
        );

        const missingProduction = parseWithTableResult(table, [
            { name: 'a', text: 'a', location: { offset: 0, length: 1 } },
            eofToken(1),
        ]);

        expect(missingProduction.errorMessage).toBe('Invalid reduce action');
    });

    it('formats accept actions for diagnostics', () =>
    {
        expect(formatParseAction({ kind: 'accept' })).toBe('acc');
    });
});

describe('ParseTableBuildError', () =>
{
    it('formats conflict summaries in the error message', () =>
    {
        const error = new ParseTableBuildError('lr1', [
            'state 1: shift/reduce conflict on token "else" resolved as shift',
        ]);

        expect(error.algorithm).toBe('lr1');
        expect(error.conflicts).toHaveLength(1);
        expect(error.message).toContain('lr1');
    });
});

describe('parseWithTableResult accept edge case', () =>
{
    it('reports an empty parse result on accept with no values', () =>
    {
        const table = new ParseTable(
            'empty',
            'S',
            ['$eof'],
            [],
            [],
            [],
            'lr1',
            1,
            [],
            new Map([
                [0, new Map([['$eof', { kind: 'accept' }]])],
            ]),
            new Map(),
        );

        const result = parseWithTableResult(table, [eofToken(0)]);

        expect(result.cst).toBeNull();
        expect(result.errorMessage).toBe('Empty parse result');
    });
});
