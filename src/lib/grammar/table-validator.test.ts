import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readGrammar } from './read-grammar.js';
import { formatTableValidationIssues, validateGrammarTable } from './table-validator.js';

describe('validateGrammarTable', () =>
{
    const calcGrammar = readGrammar(
        readFileSync(join(process.cwd(), 'grammars/calc.grammar'), 'utf8'),
    );

    it('accepts a consistent calc grammar', () =>
    {
        const issues = validateGrammarTable(calcGrammar);

        expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    });

    it('errors when a transform references an undefined ast variant', () =>
    {
        const grammar = readGrammar(`
name "bad" ;

tokens
    number = /[0-9]+/ ;

start expr ;

grammar
    expr = #literal number ;

ast
    expr = #literal number ;

transform
    expr ->
        #literal expr.#missing(number) ;
`);

        const issues = validateGrammarTable(grammar);

        expect(issues.some((issue) =>
            issue.severity === 'error'
            && issue.message.includes('expr.missing'))).toBe(true);
    });

    it('warns when pass binds a single-terminal production without a transform', () =>
    {
        const grammarSource = readFileSync(
            join(process.cwd(), 'grammars/fixtures/pass-preserves-production/bare-terminal/bare-terminal.grammar'),
            'utf8',
        );
        const grammar = readGrammar(grammarSource);
        const issues = validateGrammarTable(grammar);

        expect(issues.some((issue) =>
            issue.severity === 'warning'
            && issue.message.includes('pass(stmt)')
            && issue.message.includes('cls_stmt'))).toBe(true);
    });

    it('warns when a production is declared more than once', () =>
    {
        const grammar = readGrammar(`
name "dupe" ;

tokens
    number = /[0-9]+/ ;
    ident = /[a-z]+/ ;

start expr ;

grammar
    expr = number ;
    expr = ident ;
`);

        const issues = validateGrammarTable(grammar);

        expect(issues.some((issue) =>
            issue.severity === 'warning'
            && issue.message.includes('duplicate grammar production')
            && issue.message.includes('expr'))).toBe(true);
    });

    it('warns when a transform rule is declared more than once', () =>
    {
        const grammar = readGrammar(`
name "dupe-transform" ;

tokens
    number = /[0-9]+/ ;

start expr ;

grammar
    expr = #literal number ;

ast
    expr = #literal number ;

transform
    expr ->
        #literal expr.#literal(number) ;
    expr ->
        #literal expr.#literal(number) ;
`);

        const issues = validateGrammarTable(grammar);

        expect(issues.some((issue) =>
            issue.severity === 'warning'
            && issue.message.includes('duplicate transform rule')
            && issue.message.includes('expr'))).toBe(true);
    });

    it('formats validation issues for stderr output', () =>
    {
        const lines = formatTableValidationIssues([
            { severity: 'warning', message: 'example warning' },
            { severity: 'error', message: 'example error' },
        ]);

        expect(lines).toEqual([
            'warning: example warning',
            'error: example error',
        ]);
    });
});
