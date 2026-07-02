import { describe, expect, it } from '@jest/globals';

import { lexGrammarSource, metaGrammarTable } from './meta-grammar-table.js';
import { readGrammar } from './read-grammar.js';
import { isEofToken } from '../lexer/token.js';

describe('metaGrammarTable', () =>
{
    it('loads the bootstrapped meta-grammar table', () =>
    {
        const table = metaGrammarTable();

        expect(table.grammarName).toBe('grammar');
        expect(table.startSymbol).toBe('grammar_file');
        expect(table.tokens).toContain('$eof');
        expect(table.tokenRules.map((rule) => rule.name)).toContain('regex_literal');
    });

    it('lexes grammar source through the bootstrapped table', () =>
    {
        const tokens = lexGrammarSource('name "calc" ;');

        expect(tokens.map((token) => token.name)).toEqual([
            'name_kw',
            'string_literal',
            'semicolon',
        ]);
        expect(tokens.some((token) => isEofToken(token))).toBe(false);
    });

    it('lexes regex literals with trailing flag letters as one token', () =>
    {
        const tokens = lexGrammarSource('kw = /abc/gi ;');

        expect(tokens.map((token) => ({ name: token.name, text: token.text }))).toEqual([
            { name: 'identifier', text: 'kw' },
            { name: 'equal', text: '=' },
            { name: 'regex_literal', text: '/abc/gi' },
            { name: 'semicolon', text: ';' },
        ]);
    });

    it('matches readGrammar tokenization for a minimal grammar', () =>
    {
        const source = `
name "calc" ;

tokens
    number = /[0-9]+/ ;

start expr ;

grammar
    expr = number ;
`;

        expect(() => readGrammar(source)).not.toThrow();
        expect(readGrammar(source).name).toBe('calc');
    });
});
