import { describe, expect, it } from '@jest/globals';

import { Grammar } from './grammar/grammar.js';
import { ParseContext } from './parse-context.js';
import { ParseTable } from './parse-table/parse-table.js';

describe('ParseContext', () =>
{
    const calcGrammarSource = `
name "calc" ;

tokens
    number = /[0-9]+/ ;
    plus = /\\+/ ;

skip
    whitespace = /[ \\t\\r\\n]+/ ;

start expr ;

grammar
    expr = number ;
`;

    it('loads from grammar source', () =>
    {
        const context = ParseContext.fromGrammar(calcGrammarSource, 'lalr');

        expect(context.table.grammarName).toBe('calc');
        expect(context.table.algorithm).toBe('lalr');
        expect(context.lex('1 + 2')).toHaveLength(3);
    });

    it('loads from serialized table JSON', () =>
    {
        const grammar = new Grammar(
            'calc',
            [{ name: 'number', pattern: '[0-9]+', flags: '' }],
            [],
            [],
            'expr',
            [],
        );
        const json = ParseTable.fromGrammar(grammar).toJsonString();
        const context = ParseContext.fromTableJson(json);

        expect(context.table.grammarName).toBe('calc');
        expect(context.lex('42')).toEqual([
            {
                name: 'number',
                text: '42',
                location: { offset: 0, length: 2 },
            },
        ]);
    });

    it('prefers grammar source over table JSON when both are supplied', () =>
    {
        const tableJson = ParseTable.fromGrammar(new Grammar(
            'other',
            [{ name: 'number', pattern: '[0-9]+', flags: '' }],
            [],
            [],
            'expr',
            [],
        )).toJsonString();

        const context = ParseContext.fromSources({
            grammarSource: calcGrammarSource,
            tableJson,
        });

        expect(context.table.grammarName).toBe('calc');
    });
});
