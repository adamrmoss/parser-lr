import { describe, expect, it } from '@jest/globals';

import { Grammar } from './grammar/grammar.js';
import { readGrammar } from './grammar/read-grammar.js';
import { LexerError } from './lexer/lexer-error.js';
import { Lexer } from './lexer/lexer.js';
import { eofToken } from './lexer/token.js';
import { ParseTable } from './parse-table/parse-table.js';
import { ParserLr } from './parser-lr.js';

describe('ParserLr chunk lexing and table building', () =>
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

    it('lexes synchronous and asynchronous chunk streams', async () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const parser = new ParserLr(grammar, ParseTable.fromGrammar(grammar, 'lr1'));

        expect([...parser.lexChunks(['1', '2'])]).toEqual(parser.lex('12'));
        expect(parser.lexChunkStream(['1', '2'])).toEqual(parser.lex('12'));

        async function* chunks(): AsyncGenerator<string>
        {
            yield '3';
            yield '4';
        }

        const asyncTokens: string[] = [];

        for await (const token of parser.lexChunksAsync(chunks()))
        {
            asyncTokens.push(token.name);
        }

        expect(asyncTokens).toEqual(['number', '$eof']);
        expect(await parser.lexChunkStreamAsync(chunks())).toEqual(parser.lex('34'));
    });

    it('builds a parse table from the bound grammar', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const parser = new ParserLr(grammar, null);

        expect(parser.buildParseTable('slr').algorithm).toBe('slr');
    });
});

describe('Lexer edge conditions', () =>
{
    const grammar = new Grammar(
        'calc',
        [{ name: 'number', pattern: '[0-9]+', flags: '' }],
        [],
        [],
        'expr',
        [],
    );

    it('throws when input contains unmatched characters', () =>
    {
        expect(() => new Lexer(grammar).lex('1@')).toThrow(LexerError);
    });

    it('supports iterator consumption after finish', () =>
    {
        const lexer = new Lexer(grammar);

        lexer.push('42');
        lexer.finish();

        expect([...lexer]).toEqual([
            {
                name: 'number',
                text: '42',
                location: { offset: 0, length: 2 },
            },
            eofToken(2),
        ]);
    });
});
