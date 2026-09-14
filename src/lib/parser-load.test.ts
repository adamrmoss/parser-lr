import { describe, expect, it } from '@jest/globals';

import { Grammar } from './grammar/grammar.js';
import { parserFromGrammar, parserFromSources } from './grammar-entry.js';
import { ParseTable } from './parse-table/parse-table.js';
import { ParserLoadError } from './parser-load-error.js';
import { parserFromTableJson } from './parser-lr.js';

describe('parserFromTableJson', () =>
{
    it('loads from serialized table JSON', () =>
    {
        const grammar = new Grammar(
            'calc',
            [{ name: 'number', pattern: '[0-9]+', flags: '' }],
            [],
            'expr',
            [],
        );
        const json = ParseTable.fromGrammar(grammar).toJsonString();
        const { parser, table } = parserFromTableJson(json);

        expect(table.grammarName).toBe('calc');
        expect(parser.lex('42')).toEqual([
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
});

describe('grammar-entry parser factories', () =>
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
        const { parser, table } = parserFromGrammar(calcGrammarSource, 'lalr');

        expect(table.grammarName).toBe('calc');
        expect(table.algorithm).toBe('lalr');
        expect(parser.lex('1 + 2')).toHaveLength(4);
        expect(parser.lex('1 + 2').at(-1)?.name).toBe('$eof');
    });

    it('prefers grammar source over table JSON when both are supplied', () =>
    {
        const tableJson = ParseTable.fromGrammar(new Grammar(
            'other',
            [{ name: 'number', pattern: '[0-9]+', flags: '' }],
            [],
            'expr',
            [],
        )).toJsonString();

        const { table } = parserFromSources({
            grammarSource: calcGrammarSource,
            tableJson,
        });

        expect(table.grammarName).toBe('calc');
    });

    it('exposes chunk lexing and parsing on the parser', async () =>
    {
        const { parser } = parserFromGrammar(calcGrammarSource, 'lr1');

        expect(parser.createLexer().lex('1')).toHaveLength(2);
        expect(parser.lexChunkStream(['1', '2'])).toEqual(parser.lex('12'));
        expect([...parser.lexChunks(['3'])]).toEqual(parser.lex('3'));

        async function* chunks(): AsyncGenerator<string>
        {
            yield '4';
        }

        expect(await parser.lexChunkStreamAsync(chunks())).toEqual(parser.lex('4'));
        expect(parser.parse(parser.lex('7'))?.symbol).toBe('expr');
    });

    it('throws ParserLoadError when neither grammar nor table is supplied', () =>
    {
        expect(() => parserFromSources({})).toThrow(ParserLoadError);
    });
});
