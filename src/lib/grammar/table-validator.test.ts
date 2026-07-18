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

    it('accepts a transform target with a single labeled AST alternative', () =>
    {
        const grammar = readGrammar(`
name "list" ;

tokens
    ident = /[a-z]+/ ;

start items ;

grammar
    items =
        #list [first]:ident { [rest]:ident }
      ;

ast
    items =
        #list { ident }
      ;

transform
    items ->
        #list flatten(items.#list, first, items$repeat_0) ;
`);

        const issues = validateGrammarTable(grammar);

        expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    });

    it('accepts a stable repeat alias for a globally numbered repeat', () =>
    {
        const grammar = readGrammar(`
name "repeat-alias" ;

tokens
    ident = /[a-z]+/ ;

start items ;

grammar
    padding = { ident } ;
    items = { [item]:ident } ;

ast
    items = #items { ident } ;

transform
    items$repeat_0 ->
        #main flatten(items.#items, item, items$repeat_0) ;
`);

        const issues = validateGrammarTable(grammar);

        expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
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
            { severity: 'warning', message: 'example warning', location: null },
            { severity: 'error', message: 'example error', location: null },
        ]);

        expect(lines).toEqual([
            'warning: example warning',
            'error: example error',
        ]);
    });

    it('formats validation issues with path line and column', () =>
    {
        const source = 'name "x" ;\n\ntransform\n    expr ->\n        #literal expr.#missing(number) ;\n';
        const lines = formatTableValidationIssues(
            [{
                severity: 'error',
                message: 'transform references expr.missing which is not declared in ast',
                location: { offset: source.indexOf('#literal'), length: 10 },
            }],
            {
                path: 'sample.grammar',
                source,
            },
        );

        expect(lines).toEqual([
            'sample.grammar:5:9: error: transform references expr.missing which is not declared in ast',
        ]);
    });

    it('attaches source locations to transform validation errors', () =>
    {
        const source = `
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
`;
        const grammar = readGrammar(source);
        const issues = validateGrammarTable(grammar);
        const missing = issues.find((issue) => issue.message.includes('expr.missing'));

        expect(missing?.location).not.toBeNull();
        expect(missing?.location?.offset).toBeGreaterThan(0);
        expect(formatTableValidationIssues([missing!], {
            path: 'bad.grammar',
            source,
        })[0]).toMatch(/^bad\.grammar:\d+:\d+: error: /);
    });

    it('errors when a zero-factor AST variant gets build arguments', () =>
    {
        const grammar = readGrammar(`
name "bad-arity" ;

tokens
    color = /[a-z]+/ ;

start optional_color ;

grammar
    optional_color =
        #absent
      | #present color
      ;

ast
    optional_color =
        #absent
      | #present color
      ;

transform
    optional_color ->
        #absent optional_color.#absent(color)
      | #present optional_color.#present(color)
      ;
`);

        const issues = validateGrammarTable(grammar);

        expect(issues.some((issue) =>
            issue.severity === 'error'
            && issue.message.includes('optional_color.absent')
            && issue.message.includes('1 argument')
            && issue.message.includes('declares 0'))).toBe(true);
    });

    it('errors when an empty build targets a non-empty AST variant', () =>
    {
        const grammar = readGrammar(`
name "bad-arity" ;

tokens
    color = /[a-z]+/ ;

start optional_color ;

grammar
    optional_color =
        #absent
      | #present color
      ;

ast
    optional_color =
        #absent
      | #present color
      ;

transform
    optional_color ->
        #absent optional_color.#absent
      | #present optional_color.#present
      ;
`);

        const issues = validateGrammarTable(grammar);

        expect(issues.some((issue) =>
            issue.severity === 'error'
            && issue.message.includes('optional_color.present')
            && issue.message.includes('0 argument')
            && issue.message.includes('requires 1'))).toBe(true);
    });
});
