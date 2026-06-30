import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readGrammar } from '../grammar/read-grammar.js';
import { ParseTable } from '../parse-table/parse-table.js';

import { parseWithTable, tokenActionKey } from './shift-reduce-engine.js';

describe('ShiftReduceEngine', () =>
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
    expr =
        expr plus number
      | number
    ;
`;

    it('parses addition using a table built from grammar source', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');
        const tokens = [
            { name: 'number', text: '1', location: { offset: 0, length: 1 } },
            { name: 'plus', text: '+', location: { offset: 2, length: 1 } },
            { name: 'number', text: '2', location: { offset: 4, length: 1 } },
            { name: '$eof', text: '', location: { offset: 5, length: 0 } },
        ];
        const tree = parseWithTable(table, tokens);

        expect(tree).toEqual({
            symbol: 'expr',
            children: [
                {
                    symbol: 'expr',
                    children: [
                        {
                            symbol: 'number',
                            children: [],
                            text: '1',
                            location: { offset: 0, length: 1 },
                            variant: null,
                            productionId: null,
                            origin: null,
                        },
                    ],
                    text: null,
                    location: { offset: 0, length: 1 },
                    variant: null,
                    productionId: 1,
                    origin: 'expr',
                },
                {
                    symbol: 'plus',
                    children: [],
                    text: '+',
                    location: { offset: 2, length: 1 },
                    variant: null,
                    productionId: null,
                    origin: null,
                },
                {
                    symbol: 'number',
                    children: [],
                    text: '2',
                    location: { offset: 4, length: 1 },
                    variant: null,
                    productionId: null,
                    origin: null,
                },
            ],
            text: null,
            location: { offset: 0, length: 5 },
            variant: null,
            productionId: 0,
            origin: 'expr',
        });
    });

    it('returns null when the token stream is not accepted', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');
        const tokens = [
            { name: 'plus', text: '+', location: { offset: 0, length: 1 } },
            { name: '$eof', text: '', location: { offset: 1, length: 0 } },
        ];

        expect(parseWithTable(table, tokens)).toBeNull();
    });

    it('round-trips parse tables through JSON before parsing', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const json = ParseTable.fromGrammar(grammar, 'lalr').toJsonString();
        const table = ParseTable.fromJsonString(json);
        const tokens = [
            { name: 'number', text: '7', location: { offset: 0, length: 1 } },
            { name: '$eof', text: '', location: { offset: 1, length: 0 } },
        ];

        expect(parseWithTable(table, tokens)).toEqual({
            symbol: 'expr',
            children: [
                {
                    symbol: 'number',
                    children: [],
                    text: '7',
                    location: { offset: 0, length: 1 },
                    variant: null,
                    productionId: null,
                    origin: null,
                },
            ],
            text: null,
            location: { offset: 0, length: 1 },
            variant: null,
            productionId: 1,
            origin: 'expr',
        });
    });

    it('parses the lisp sample grammar from a serialized table', () =>
    {
        const source = readFileSync(join(process.cwd(), 'grammars/lisp.grammar'), 'utf8');
        const table = ParseTable.fromGrammar(readGrammar(source), 'lr1');
        const tokens = [
            { name: 'lpar', text: '(', location: { offset: 0, length: 1 } },
            { name: 'number', text: '1', location: { offset: 1, length: 1 } },
            { name: 'rpar', text: ')', location: { offset: 2, length: 1 } },
            { name: '$eof', text: '', location: { offset: 3, length: 0 } },
        ];
        const tree = parseWithTable(table, tokens);

        expect(tree?.symbol).toBe('program');
        expect(tree?.children[0]?.symbol).toBe('program$repeat_0');
        expect(tree?.children[0]?.children[0]?.symbol).toBe('form');
        expect(tree?.children[0]?.children[0]?.children[0]?.symbol).toBe('list');
        expect(tree?.children[0]?.children[0]?.children[0]?.children.map((child) => child.symbol)).toEqual([
            'lpar',
            'list$repeat_1',
            'rpar',
        ]);
        expect(
            tree?.children[0]?.children[0]?.children[0]?.children[1]?.children[0]?.symbol,
        ).toBe('form');
        expect(
            tree?.children[0]?.children[0]?.children[0]?.children[1]?.children[0]?.children[0]?.symbol,
        ).toBe('atom');
    });

    it('requires a token stream ending with $eof', () =>
    {
        const grammar = readGrammar(calcGrammarSource);
        const table = ParseTable.fromGrammar(grammar, 'lr1');

        expect(parseWithTable(table, [
            { name: 'number', text: '1', location: { offset: 0, length: 1 } },
        ])).toBeNull();
    });

    it('returns null for lexer-only tables without parser entries', () =>
    {
        const grammar = readGrammar(`
name "calc" ;
tokens number = /[0-9]+/ ;
skip whitespace = /\\s+/ ;
start expr ;
grammar expr = number ;
`);
        const fullTable = ParseTable.fromGrammar(grammar, 'lr1');
        const lexerOnly = ParseTable.fromJson({
            ...fullTable.toJson(),
            version: 1,
            parserStateCount: undefined,
            productions: undefined,
            actions: undefined,
            gotos: undefined,
        });

        expect(lexerOnly.hasParserTable).toBe(false);
        expect(parseWithTable(lexerOnly, [
            { name: 'number', text: '1', location: { offset: 0, length: 1 } },
            { name: '$eof', text: '', location: { offset: 1, length: 0 } },
        ])).toBeNull();
    });
});

describe('tokenActionKey', () =>
{
    it('maps end-of-input tokens to $eof', () =>
    {
        expect(tokenActionKey({
            name: '$eof',
            text: '',
            location: { offset: 0, length: 0 },
        })).toBe('$eof');
    });
});
