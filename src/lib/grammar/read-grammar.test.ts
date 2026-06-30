import { describe, expect, it } from '@jest/globals';

import { ReadGrammarError } from './read-grammar-error.js';
import { readGrammar } from './read-grammar.js';

describe('readGrammar', () =>
{
    it('parses a minimal calc grammar', () =>
    {
        const grammar = readGrammar(`
name "calc" ;

tokens
    number = /[0-9]+/ ;
    plus = /\\+/ ;

skip
    whitespace = /[ \\t\\r\\n]+/ ;

start expr ;

grammar
    expr = number ;
`);

        expect(grammar.name).toBe('calc');
        expect(grammar.startSymbol).toBe('expr');
        expect(grammar.tokenRules).toEqual([
            { name: 'number', pattern: '[0-9]+', flags: '' },
            { name: 'plus', pattern: '\\+', flags: '' },
        ]);
        expect(grammar.productions).toHaveLength(1);
    });

    it('throws ReadGrammarError for invalid grammar syntax', () =>
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
            expect(error).toBeInstanceOf(ReadGrammarError);
            expect((error as ReadGrammarError).offset).toBeGreaterThanOrEqual(0);
        }
    });
});
