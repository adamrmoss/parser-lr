import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Grammar } from '../grammar/grammar.js';
import { readGrammar } from '../grammar/read-grammar.js';
import { ParseContext } from '../parse-context.js';

import { ParseTableError } from './parse-table-error.js';
import { ParseTable } from './parse-table.js';
import { tokenInventory } from './token-inventory.js';

describe('ParseTable', () =>
{
    const grammar = new Grammar(
        'calc',
        [
            { name: 'number', pattern: '[0-9]+', flags: '' },
            { name: 'plus', pattern: '\\+', flags: '' },
        ],
        [
            { name: 'whitespace', pattern: '[ \\t\\r\\n]+', flags: '' },
        ],
        [],
        'expr',
        [],
    );

    it('captures the full token inventory from a grammar', () =>
    {
        expect(tokenInventory(grammar)).toEqual(['number', 'plus', '$eof']);
        expect(ParseTable.fromGrammar(grammar).tokens).toEqual(['number', 'plus', '$eof']);
    });

    it('serializes lexer metadata and round-trips through JSON', () =>
    {
        const table = ParseTable.fromGrammar(grammar, 'lalr');
        const json = table.toJsonString();
        const restored = ParseTable.fromJsonString(json);

        expect(restored.grammarName).toBe('calc');
        expect(restored.startSymbol).toBe('expr');
        expect(restored.algorithm).toBe('lalr');
        expect(restored.tokens).toEqual(['number', 'plus', '$eof']);
        expect(restored.tokenRules).toEqual(grammar.tokenRules);
        expect(restored.skipRules).toEqual(grammar.skipRules);
    });

    it('serializes ast and transform schemas and round-trips through JSON', () =>
    {
        const grammarSource = readFileSync(join(process.cwd(), 'grammars/calc.grammar'), 'utf8');
        const grammar = readGrammar(grammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');
        const restored = ParseTable.fromJsonString(table.toJsonString());

        expect(restored.astSchema).not.toBeNull();
        expect(restored.transformSchema).not.toBeNull();
        expect(restored.astSchema?.types).toEqual(grammar.astSchema?.types);
        expect(restored.transformSchema?.rules).toEqual(grammar.transformSchema?.rules);

        const fromTable = ParseContext.fromTableJson(table.toJsonString());
        const ast = fromTable.parseSource('3 + 4');

        expect(ast?.symbol).toBe('expr');
        expect(ast?.variant).toBe('binary');
    });

    it('rejects unsupported schema versions', () =>
    {
        expect(() => ParseTable.fromJson({
            version: 99 as unknown as 1,
            algorithm: 'lr1',
            grammarName: 'calc',
            startSymbol: 'expr',
            tokens: [],
            tokenRules: [],
            skipRules: [],
            states: [],
        })).toThrow(ParseTableError);
    });
});
