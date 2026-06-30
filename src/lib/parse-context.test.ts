import { describe, expect, it } from '@jest/globals';

import { Grammar } from './grammar/grammar.js';
import { ParseContextError } from './parse-context-error.js';
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
        expect(context.lex('1 + 2')).toHaveLength(4);
        expect(context.lex('1 + 2').at(-1)?.name).toBe('$eof');
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
            {
                name: '$eof',
                text: '',
                location: { offset: 2, length: 0 },
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

    it('delegates chunk lexing and parsing to the parser', async () =>
    {
        const context = ParseContext.fromGrammar(calcGrammarSource, 'lr1');

        expect(context.createLexer().lex('1')).toHaveLength(2);
        expect(context.lexChunkStream(['1', '2'])).toEqual(context.lex('12'));
        expect([...context.lexChunks(['3'])]).toEqual(context.lex('3'));

        async function* chunks(): AsyncGenerator<string>
        {
            yield '4';
        }

        expect(await context.lexChunkStreamAsync(chunks())).toEqual(context.lex('4'));
        expect(context.parse(context.lex('7'))?.symbol).toBe('expr');
    });

    it('throws ParseContextError when neither grammar nor table is supplied', () =>
    {
        expect(() => ParseContext.fromSources({})).toThrow(ParseContextError);
    });
});
