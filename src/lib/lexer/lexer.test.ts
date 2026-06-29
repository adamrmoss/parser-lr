import { describe, expect, it } from '@jest/globals';

import { Grammar } from '../grammar/grammar.js';

import { LexerError } from './lexer-error.js';
import { Lexer } from './lexer.js';

describe('Lexer', () =>
{
    const calcGrammar = new Grammar(
        'calc',
        [
            { name: 'number', pattern: '[0-9]+', flags: '' },
            { name: 'plus', pattern: '\\+', flags: '' },
            { name: 'identifier', pattern: '[A-Za-z_][A-Za-z0-9_]*', flags: '' },
        ],
        [
            { name: 'whitespace', pattern: '[ \\t\\r\\n]+', flags: '' },
        ],
        [],
        'expr',
        [],
    );

    it('emits tokens and skips whitespace', () =>
    {
        const lexer = new Lexer(calcGrammar);
        const tokens = lexer.lex('1 + foo');

        expect(tokens).toEqual([
            {
                name: 'number',
                text: '1',
                location: { offset: 0, length: 1 },
            },
            {
                name: 'plus',
                text: '+',
                location: { offset: 2, length: 1 },
            },
            {
                name: 'identifier',
                text: 'foo',
                location: { offset: 4, length: 3 },
            },
        ]);
    });

    it('prefers the longest matching token rule', () =>
    {
        const grammar = new Grammar(
            'example',
            [
                { name: 'assign', pattern: ':=', flags: '' },
                { name: 'colon', pattern: ':', flags: '' },
            ],
            [],
            [],
            'start',
            [],
        );

        const tokens = new Lexer(grammar).lex(':=');

        expect(tokens).toEqual([
            {
                name: 'assign',
                text: ':=',
                location: { offset: 0, length: 2 },
            },
        ]);
    });

    it('breaks equal-length ties by token declaration order', () =>
    {
        const grammar = new Grammar(
            'example',
            [
                { name: 'keyword_if', pattern: 'if', flags: '' },
                { name: 'identifier', pattern: '[A-Za-z_][A-Za-z0-9_]*', flags: '' },
            ],
            [],
            [],
            'start',
            [],
        );

        const tokens = new Lexer(grammar).lex('if');

        expect(tokens[0]?.name).toBe('keyword_if');
    });

    it('extends regex_literal tokens with optional flag letters', () =>
    {
        const grammar = new Grammar(
            'grammar',
            [
                { name: 'regex_literal', pattern: '\\/(\\\\.|[^\\\\\\/])+\\/', flags: '' },
            ],
            [],
            [],
            'start',
            [],
        );

        const tokens = new Lexer(grammar).lex('/abc/gi');

        expect(tokens).toEqual([
            {
                name: 'regex_literal',
                text: '/abc/gi',
                location: { offset: 0, length: 7 },
            },
        ]);
    });

    it('throws when input cannot be matched', () =>
    {
        expect(() => new Lexer(calcGrammar).lex('1 @')).toThrow(LexerError);
    });
});
