import { describe, expect, it } from '@jest/globals';

import { Grammar } from '../grammar/grammar.js';
import { EOF_TOKEN_NAME, eofToken } from './token.js';

import { LexerCompileError } from './lexer-compile-error.js';
import { DEFAULT_LEXER_STATE } from './lexer-compile.js';
import { LexerError } from './lexer-error.js';
import { Lexer, lexChunkStream, lexChunks } from './lexer.js';

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

    it('emits tokens and skips whitespace, ending with $eof', () =>
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
            eofToken(7),
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

        expect(tokens.slice(0, 1)).toEqual([
            {
                name: 'assign',
                text: ':=',
                location: { offset: 0, length: 2 },
            },
        ]);
        expect(tokens.at(-1)).toEqual(eofToken(2));
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

        expect(tokens.slice(0, 1)).toEqual([
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

    it('throws LexerCompileError for invalid regular expressions', () =>
    {
        expect(() => new Lexer(new Grammar(
            'bad',
            [{ name: 'broken', pattern: '(', flags: '' }],
            [],
            [],
            'start',
            [],
        ))).toThrow(LexerCompileError);
    });

    it('uses the default initial state when no states are declared', () =>
    {
        const lexer = new Lexer(calcGrammar);

        expect(lexer.state).toBe(DEFAULT_LEXER_STATE);
    });

    it('starts in the first declared lexer state', () =>
    {
        const grammar = new Grammar(
            'states',
            [
                {
                    name: 'word',
                    pattern: '[a-z]+',
                    flags: '',
                    states: ['initial'],
                },
                {
                    name: 'digit',
                    pattern: '[0-9]+',
                    flags: '',
                    states: ['numbers'],
                },
            ],
            [],
            ['initial', 'numbers'],
            'start',
            [],
        );
        const lexer = new Lexer(grammar);

        expect(lexer.state).toBe('initial');
        expect(lexer.lex('abc')).toEqual([
            {
                name: 'word',
                text: 'abc',
                location: { offset: 0, length: 3 },
            },
            eofToken(3),
        ]);

        lexer.enterState('numbers');
        expect(lexer.lex('42')).toEqual([
            {
                name: 'digit',
                text: '42',
                location: { offset: 0, length: 2 },
            },
            eofToken(2),
        ]);
    });

    it('lexes split tokens from chunked input', () =>
    {
        const tokens = lexChunkStream(calcGrammar, ['1 ', '+ f', 'oo']);

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
            eofToken(7),
        ]);
    });

    it('waits for more input before committing ambiguous prefixes', () =>
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

        expect([...lexChunks(grammar, [':', '='])]).toEqual([
            {
                name: 'assign',
                text: ':=',
                location: { offset: 0, length: 2 },
            },
            eofToken(2),
        ]);
    });

    it('streams tokens incrementally from push and finish', () =>
    {
        const lexer = new Lexer(calcGrammar);

        lexer.push('1 ');
        expect(lexer.next()).toEqual({
            name: 'number',
            text: '1',
            location: { offset: 0, length: 1 },
        });
        expect(lexer.next()).toBeNull();

        lexer.push('+ foo');
        expect(lexer.next()).toEqual({
            name: 'plus',
            text: '+',
            location: { offset: 2, length: 1 },
        });
        expect(lexer.next()).toBeNull();

        lexer.finish();
        expect(lexer.next()).toEqual({
            name: 'identifier',
            text: 'foo',
            location: { offset: 4, length: 3 },
        });
        expect(lexer.next()).toEqual(eofToken(7));
        expect(lexer.next()).toBeNull();
    });
});

describe('Lexer EOF token', () =>
{
    it('uses the $eof token name', () =>
    {
        expect(EOF_TOKEN_NAME).toBe('$eof');
    });
});
