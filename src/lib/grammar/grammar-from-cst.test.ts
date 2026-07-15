import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { Lexer } from '../lexer/lexer.js';
import { parseWithTableResult } from '../shift-reduce/shift-reduce-engine.js';

import { grammarFromCst } from './grammar-from-cst.js';
import { metaGrammar, metaGrammarTable } from './meta-grammar-table.js';
import { readGrammar } from './read-grammar.js';

const grammarsDirectory = join(process.cwd(), 'grammars');

/**
 * Parses grammar source through the meta-grammar LR parser and CST builder.
 *
 * @param source - Full `.grammar` file text.
 */
function parseGrammarSource(source: string)
{
    const table = metaGrammarTable();
    const tokens = new Lexer(metaGrammar()).lex(source);
    const result = parseWithTableResult(table, tokens);

    expect(result.cst).not.toBeNull();

    return grammarFromCst(result.cst!);
}

describe('grammarFromCst', () =>
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
        expect(grammar.productions[0]?.expression).toEqual({
            kind: 'reference',
            name: 'number',
        });
    });

    it('parses bound references and optional sections', () =>
    {
        const grammar = parseGrammarSource(`
name "sample" ;

tokens
    id = /[a-z]+/ ;

start expr ;

grammar
    expr = [slot]:id | id ;
`);

        const expression = grammar.productions[0]?.expression;

        expect(expression).toEqual({
            kind: 'choice',
            alternatives: [
                {
                    label: null,
                    expression: {
                        kind: 'boundReference',
                        binding: 'slot',
                        name: 'id',
                    },
                },
                {
                    label: null,
                    expression: {
                        kind: 'reference',
                        name: 'id',
                    },
                },
            ],
        });
    });

    it('parses transform build and pass rules', () =>
    {
        const grammar = parseGrammarSource(readFileSync(join(grammarsDirectory, 'calc.grammar'), 'utf8'));

        expect(grammar.transformSchema?.rule('expr')?.alternatives).toEqual([
            {
                label: 'binary',
                expression: {
                    kind: 'build',
                    typeName: 'expr',
                    variant: 'binary',
                    arguments: ['left', 'operator', 'right'],
                },
                location: expect.objectContaining({
                    offset: expect.any(Number),
                    length: expect.any(Number),
                }),
            },
            {
                label: 'literal',
                expression: {
                    kind: 'build',
                    typeName: 'expr',
                    variant: 'literal',
                    arguments: ['number'],
                },
                location: expect.objectContaining({
                    offset: expect.any(Number),
                    length: expect.any(Number),
                }),
            },
        ]);
    });

    it('preserves a single labeled alternative on an AST type', () =>
    {
        const grammar = parseGrammarSource(`
name "labels" ;

tokens
    ident = /[a-z]+/ ;

start list ;

grammar
    list = ident ;

ast
    list =
        #items { ident }
      ;
`);

        expect(grammar.astSchema?.type('list')?.expression).toEqual({
            kind: 'choice',
            alternatives: [
                {
                    label: 'items',
                    expression: {
                        kind: 'repeat',
                        element: {
                            kind: 'reference',
                            name: 'ident',
                        },
                    },
                },
            ],
        });
    });

    it('parses labeled zero-factor alternatives and zero-argument builds', () =>
    {
        const grammar = parseGrammarSource(`
name "optional-color" ;

tokens
    kw_with = /with/ ;
    color = /[a-z]+/ ;

start optional_color ;

grammar
    optional_color =
        #absent
      | #present kw_with color
      ;

ast
    optional_color =
        #absent
      | #present color
      ;

transform
    optional_color ->
        #absent optional_color.#absent
      | #present optional_color.#present(color)
      ;
`);

        const production = grammar.production('optional_color');
        const astType = grammar.astSchema?.type('optional_color');
        const transform = grammar.transformSchema?.rule('optional_color');

        expect(production?.expression).toEqual({
            kind: 'choice',
            alternatives: [
                {
                    label: 'absent',
                    expression: {
                        kind: 'sequence',
                        elements: [],
                    },
                },
                {
                    label: 'present',
                    expression: {
                        kind: 'sequence',
                        elements: [
                            { kind: 'reference', name: 'kw_with' },
                            { kind: 'reference', name: 'color' },
                        ],
                    },
                },
            ],
        });
        expect(astType?.expression).toEqual({
            kind: 'choice',
            alternatives: [
                {
                    label: 'absent',
                    expression: {
                        kind: 'sequence',
                        elements: [],
                    },
                },
                {
                    label: 'present',
                    expression: {
                        kind: 'reference',
                        name: 'color',
                    },
                },
            ],
        });
        expect(transform?.alternatives[0]?.expression).toEqual({
            kind: 'build',
            typeName: 'optional_color',
            variant: 'absent',
            arguments: [],
        });
    });

    it('rejects unlabeled empty alternatives', () =>
    {
        const table = metaGrammarTable();
        const tokens = new Lexer(metaGrammar()).lex(`
name "bad" ;

tokens
    color = /[a-z]+/ ;

start optional_color ;

grammar
    optional_color =
        |
        color
      ;
`);
        const result = parseWithTableResult(table, tokens);

        expect(result.cst).toBeNull();
        expect(result.errorOffset).not.toBeNull();
    });

    it('parses every checked-in sample grammar', () =>
    {
        const grammarFiles = readdirSync(grammarsDirectory)
            .filter((filename) => filename.endsWith('.grammar'));

        expect(grammarFiles.length).toBeGreaterThan(0);

        for (const filename of grammarFiles)
        {
            const source = readFileSync(join(grammarsDirectory, filename), 'utf8');

            expect(() => readGrammar(source)).not.toThrow();
        }
    });
});
