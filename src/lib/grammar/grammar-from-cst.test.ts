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
            },
            {
                label: 'literal',
                expression: {
                    kind: 'build',
                    typeName: 'expr',
                    variant: 'literal',
                    arguments: ['number'],
                },
            },
        ]);
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
