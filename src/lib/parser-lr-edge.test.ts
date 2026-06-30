import { describe, expect, it } from '@jest/globals';

import { readGrammar } from './grammar/read-grammar.js';
import { eofToken } from './lexer/token.js';
import { ParseTable } from './parse-table/parse-table.js';
import { ParserLr } from './parser-lr.js';

describe('ParserLr edge conditions', () =>
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

    it('returns null from parseCst when no parse table is configured', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const parser = new ParserLr(grammar, null);
        const tokens = parser.lex('1');

        expect(() => parser.parseCst(tokens)).not.toThrow();
        expect(parser.parseCst(tokens)).toBeNull();
    });

    it('returns null when the token stream does not end with $eof', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');
        const parser = new ParserLr(grammar, table);

        expect(() => parser.parse([
            { name: 'number', text: '1', location: { offset: 0, length: 1 } },
        ])).not.toThrow();
        expect(parser.parse([
            { name: 'number', text: '1', location: { offset: 0, length: 1 } },
        ])).toBeNull();
    });

    it('returns null for an empty token stream', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');
        const parser = new ParserLr(grammar, table);

        expect(parser.parse([])).toBeNull();
    });

    it('returns null on syntax error without throwing', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');
        const parser = new ParserLr(grammar, table);
        const tokens = [
            { name: 'plus', text: '+', location: { offset: 0, length: 1 } },
            eofToken(1),
        ];

        expect(() => parser.parse(tokens)).not.toThrow();
        expect(parser.parse(tokens)).toBeNull();
    });

    it('returns CST unchanged when no transform schema is declared', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');
        const parser = new ParserLr(grammar, table);
        const cst = parser.parseCst(parser.lex('7'));

        expect(parser.parseAst(parser.lex('7'))).toEqual(cst);
    });

    it('throws LexerError from parseSource when lexing fails', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');
        const parser = new ParserLr(grammar, table);

        expect(() => parser.parseSource('1 @')).toThrow();
    });
});
