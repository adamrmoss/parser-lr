import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    parserFromGrammar,
    readGrammar,
    validateGrammarTable,
} from '../grammar-entry.js';
import type { LrAlgorithm } from '../parse-table/lr-algorithm.js';
import { parserFromTableJson } from '../parser-lr.js';
import { desugarEbnf } from '../parse-table/bnf/desugar-ebnf.js';
import { analyzeGrammar } from '../parse-table/analysis/first-follow.js';
import { EOF_TOKEN_NAME } from '../lexer/token.js';
import { TransformSchema } from '../grammar/transform-schema.js';
import { transformCst } from './cst-transformer.js';

const optionalColorGrammarSource = `
name "optional-color" ;

tokens
    kw_with = /with/ ;
    color = /[a-z]+/ ;

skip
    whitespace = /[ \t\r\n]+/ ;

start optional_color ;

grammar
    optional_color =
        #absent
      | #present kw_with [value]:color
      ;

ast
    optional_color =
        #absent
      | #present [value]:color
      ;

transform
    optional_color ->
        #absent optional_color.#absent
      | #present optional_color.#present(value)
      ;
`;

describe('labeled zero-factor transform pipeline', () =>
{
    const algorithms: readonly LrAlgorithm[] = ['lr0', 'slr', 'lalr', 'lr1'];

    it.each(algorithms)('preserves the epsilon variant under %s', (algorithm) =>
    {
        const grammar = readGrammar(optionalColorGrammarSource);
        const { parser } = parserFromGrammar(optionalColorGrammarSource, algorithm);
        const cst = parser.parseCst(parser.lex(''));
        const ast = parser.parseSource('');

        expect(validateGrammarTable(grammar).filter((issue) => issue.severity === 'error')).toEqual([]);
        expect(cst?.symbol).toBe('optional_color');
        expect(cst?.variant).toBe('absent');
        expect(cst?.children).toEqual([]);
        expect(ast?.symbol).toBe('optional_color');
        expect(ast?.variant).toBe('absent');
        expect(ast?.children).toEqual([]);
    });

    it.each(algorithms)('preserves epsilon through table JSON under %s', (algorithm) =>
    {
        const fromGrammar = parserFromGrammar(optionalColorGrammarSource, algorithm);
        const { parser } = parserFromTableJson(fromGrammar.table.toJsonString());
        const absent = parser.parseSource('');
        const present = parser.parseSource('with blue');

        expect(absent?.symbol).toBe('optional_color');
        expect(absent?.variant).toBe('absent');
        expect(absent?.children).toEqual([]);
        expect(present?.symbol).toBe('optional_color');
        expect(present?.variant).toBe('present');
        expect(present?.children[0]?.text).toBe('blue');
    });

    it('keeps labeled epsilon identity when no explicit transform rule exists', () =>
    {
        const { parser, table } = parserFromGrammar(optionalColorGrammarSource, 'lr1');
        const cst = parser.parseCst(parser.lex(''));
        const ast = transformCst(cst, new TransformSchema([]), table);

        expect(cst?.variant).toBe('absent');
        expect(ast?.symbol).toBe('optional_color');
        expect(ast?.variant).toBe('absent');
        expect(ast?.children).toEqual([]);
    });

    it('drops synthetic unlabeled epsilons from flatten while keeping authored labels', () =>
    {
        const grammarSource = readFileSync(
            join(process.cwd(), 'grammars/fixtures/flatten-repeat/flatten-repeat.grammar'),
            'utf8',
        );
        const { parser } = parserFromGrammar(grammarSource, 'lr1');
        const ast = parser.parseSource('a');

        expect(ast?.symbol).toBe('list');
        expect(ast?.variant).toBe('list');
        expect(ast?.children).toHaveLength(1);
        expect(ast?.children[0]?.symbol).toBe('item');
    });

    it('treats labeled epsilon as nullable in FIRST/FOLLOW analysis', () =>
    {
        const grammar = readGrammar(optionalColorGrammarSource);
        const bnf = desugarEbnf(grammar).augment();
        const analysis = analyzeGrammar(bnf);

        expect(analysis.isNullable('optional_color')).toBe(true);
        expect([...analysis.firstOfNonTerminal('optional_color')].sort()).toEqual(['$eof', 'kw_with']);
        expect([...analysis.followOfNonTerminal('optional_color')].sort()).toEqual([EOF_TOKEN_NAME]);
    });
});

describe('calc.grammar transform pipeline', () =>
{
    const grammarSource = readFileSync(join(process.cwd(), 'grammars/calc.grammar'), 'utf8');

    it('parses and transforms addition into an AST', () =>
    {
        const { parser } = parserFromGrammar(grammarSource, 'lr1');
        const ast = parser.parseSource('1 + 2');

        expect(ast?.symbol).toBe('expr');
        expect(ast?.variant).toBe('binary');
        expect(ast?.children).toHaveLength(3);
    });

    it('parses and transforms from self-contained table JSON', () =>
    {
        const fromGrammar = parserFromGrammar(grammarSource, 'lr1');
        const tableJson = fromGrammar.table.toJsonString();
        const { parser } = parserFromTableJson(tableJson);
        const ast = parser.parseSource('1 + 2');

        expect(ast?.symbol).toBe('expr');
        expect(ast?.variant).toBe('binary');
        expect(ast?.children).toHaveLength(3);
    });
});

describe('lisp.grammar transform pipeline', () =>
{
    const grammarSource = readFileSync(join(process.cwd(), 'grammars/lisp.grammar'), 'utf8');

    it('parses and transforms a list form into an AST', () =>
    {
        const { parser } = parserFromGrammar(grammarSource, 'lr1');
        const ast = parser.parseSource('(+ 1 2)');

        expect(ast?.symbol).toBe('program');
        expect(ast?.variant).toBe('program');
        expect(ast?.children).toHaveLength(1);
        expect(ast?.children[0]?.symbol).toBe('list');
        expect(ast?.children[0]?.variant).toBe('list');
        expect(ast?.children[0]?.children[0]?.symbol).toBe('lpar');
        expect(ast?.children[0]?.children[1]?.symbol).toBe('form');
        expect(ast?.children[0]?.children[1]?.variant).toBe('elements');
        expect(ast?.children[0]?.children[1]?.children.map((child) => child.variant)).toEqual([
            'symbol',
            'number',
            'number',
        ]);
    });
});

describe('6502.grammar transform pipeline', () =>
{
    const grammarSource = readFileSync(join(process.cwd(), 'grammars/6502.grammar'), 'utf8');

    it('parses and transforms an assembler program into an AST', () =>
    {
        const { parser } = parserFromGrammar(grammarSource, 'lr1');
        const ast = parser.parseSource('.org $8000\n    BRK\n');

        expect(ast?.symbol).toBe('program');
        expect(ast?.variant).toBe('program');
        expect(ast?.children).toHaveLength(2);
        expect(ast?.children[0]?.symbol).toBe('line');
        expect(ast?.children[0]?.variant).toBe('directive');
        expect(ast?.children[1]?.symbol).toBe('line');
        expect(ast?.children[1]?.variant).toBe('code');
        expect(ast?.children[1]?.children[0]?.variant).toBe('implied');
    });
});
