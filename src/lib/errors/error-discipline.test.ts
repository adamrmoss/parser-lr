import { describe, expect, it } from '@jest/globals';

import { Grammar } from '../grammar/grammar.js';
import { ReadGrammarError, readGrammar } from '../grammar/index.js';
import { Lexer } from '../lexer/lexer.js';
import { LexerCompileError } from '../lexer/lexer-compile-error.js';
import { LexerError } from '../lexer/lexer-error.js';
import { LexerInputError } from '../lexer/lexer-input-error.js';
import { LexerStateError } from '../lexer/lexer-state-error.js';
import { ParseContextError } from '../parse-context-error.js';
import { parseContextFromSources } from '../grammar-entry.js';
import { ParseOutputError } from '../parse-output-error.js';
import { formatParseOutput } from '../parse-output.js';
import { ParseTableError } from '../parse-table/parse-table-error.js';
import { ParseTable } from '../parse-table/parse-table.js';
import { LrAlgorithmError, parseLrAlgorithm } from '../parse-table/index.js';

import {
    formatUserError,
    isParserLrError,
    messageContainsStackTrace,
} from './parser-lr-error.js';

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

function expectCleanUserError(error: unknown): void
{
    expect(isParserLrError(error)).toBe(true);
    expect(messageContainsStackTrace(formatUserError(error))).toBe(false);
}

describe('error discipline', () =>
{
    it('wraps invalid lexer regex failures without embedding stack frames', () =>
    {
        let thrown: unknown;

        try
        {
            new Lexer(new Grammar(
                'bad',
                [{ name: 'broken', pattern: '(', flags: '' }],
                [],
                [],
                'start',
                [],
            ));
        }
        catch (error)
        {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(LexerCompileError);
        expectCleanUserError(thrown);

        const compileError = thrown as LexerCompileError;

        expect(compileError.ruleName).toBe('broken');
        expect(compileError.message).toMatch(/^Invalid lexer rule "broken":/);
    });

    it('reports lexer input failures with LexerError', () =>
    {
        const grammar = readGrammar(calcGrammarSource);

        expect(() => new Lexer(grammar).lex('1 @')).toThrow(LexerError);

        try
        {
            new Lexer(grammar).lex('1 @');
        }
        catch (error)
        {
            expectCleanUserError(error);
            expect((error as LexerError).offset).toBe(2);
        }
    });

    it('reports grammar read failures with ReadGrammarError', () =>
    {
        expect(() => readGrammar(`
name "calc" ;
start expr ;
grammar
    expr = number ;
oops
`)).toThrow(ReadGrammarError);

        try
        {
            readGrammar(`
name "calc" ;
start expr ;
grammar
    expr = number ;
oops
`);
        }
        catch (error)
        {
            expectCleanUserError(error);
            expect((error as ReadGrammarError).offset).toBeGreaterThanOrEqual(0);
        }
    });

    it('reports unsupported LR algorithms with LrAlgorithmError', () =>
    {
        expect(() => parseLrAlgorithm('bogus')).toThrow(LrAlgorithmError);
        expectCleanUserError(new LrAlgorithmError('bogus'));
    });

    it('reports parse table JSON failures with ParseTableError', () =>
    {
        expect(() => ParseTable.fromJsonString('{')).toThrow(ParseTableError);

        try
        {
            ParseTable.fromJsonString('{');
        }
        catch (error)
        {
            expectCleanUserError(error);
            expect((error as ParseTableError).message).toMatch(/^Invalid parse table JSON:/);
        }
    });

    it('reports unsupported parse table versions with ParseTableError', () =>
    {
        expect(() => ParseTable.fromJson({
            version: 99 as unknown as 1,
            algorithm: 'lr1',
            grammarName: 'x',
            startSymbol: 'S',
            tokens: [],
            tokenRules: [],
            skipRules: [],
            states: [],
        })).toThrow(ParseTableError);
    });

    it('reports LR conflicts as warnings without throwing', () =>
    {
        const grammar = readGrammar(`
name "ambiguous" ;

tokens
    a = /a/ ;
    b = /b/ ;
    c = /c/ ;

start S ;

grammar
    S = A | B ;
    A = "a" ;
    B = "a" ;
`);

        const table = ParseTable.fromGrammar(grammar, 'lr0');

        expect(table.isConflictFree).toBe(false);
        expect(table.conflicts.length).toBeGreaterThan(0);
        expect(table.conflicts.every((conflict) => conflict.kind === 'reduce-reduce')).toBe(true);
        expect(table.formatConflictWarnings().length).toBe(table.conflicts.length);
    });

    it('reports missing parse context sources with ParseContextError', () =>
    {
        expect(() => parseContextFromSources({})).toThrow(ParseContextError);
        expectCleanUserError(new ParseContextError('required: grammar source or table JSON'));
    });

    it('reports unsupported parse output formats with ParseOutputError', () =>
    {
        expect(() => formatParseOutput(null, 'xml')).toThrow(ParseOutputError);
        expectCleanUserError(new ParseOutputError('xml'));
    });

    it('reports unknown lexer states with LexerStateError', () =>
    {
        const grammar = new Grammar(
            'states',
            [{ name: 'word', pattern: '[a-z]+', flags: '', states: ['initial'] }],
            [],
            ['initial'],
            'start',
            [],
        );
        const lexer = new Lexer(grammar);

        expect(() => lexer.enterState('missing')).toThrow(LexerStateError);
    });

    it('reports push-after-finish with LexerInputError', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const lexer = new Lexer(grammar);

        lexer.finish();

        expect(() => lexer.push('1')).toThrow(LexerInputError);
        expectCleanUserError(new LexerInputError());
    });
});
