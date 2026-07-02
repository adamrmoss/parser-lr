import { describe, expect, it } from '@jest/globals';

import { readGrammar } from '../grammar/read-grammar.js';
import { parseContextFromGrammar } from '../grammar-entry.js';
import { ParseTable } from './parse-table.js';
import { parseWithTable } from '../shift-reduce/shift-reduce-engine.js';

import { BnfGrammar } from './bnf/bnf-grammar.js';
import type { BnfProduction } from './bnf/bnf-production.js';
import type { BnfNonTerminalSymbol, BnfSymbol } from './bnf/bnf-symbol.js';
import { buildLrTable } from './build-lr-table.js';

/**
 * Builds a non-terminal symbol for classic grammar fixtures.
 *
 * @param name - Non-terminal name.
 */
function nt(name: string): BnfNonTerminalSymbol
{
    return { kind: 'nonTerminal', name, binding: null };
}

/**
 * Builds a quoted terminal symbol for classic grammar fixtures.
 *
 * @param value - Terminal lexeme without surrounding quotes.
 */
function term(value: string): BnfSymbol
{
    return { kind: 'terminal', value };
}

/**
 * Builds a BNF production for classic grammar fixtures.
 *
 * @param id - Stable production id.
 * @param name - Left-hand side non-terminal.
 * @param rhs - Right-hand side symbol sequence.
 */
function production(
    id: number,
    name: string,
    rhs: readonly BnfSymbol[],
): BnfProduction
{
    return {
        id,
        name,
        rhs,
        variant: null,
        origin: name,
    };
}

describe('classic grammars — LR table construction', () =>
{
    /**
     * Builds the dragon-book expression grammar with precedence.
     *
     * E → E + T | T
     * T → T * F | F
     * F → ( E ) | id
     */
    function expressionPrecedenceGrammar(): BnfGrammar
    {
        return new BnfGrammar('E', [
            production(0, 'E', [nt('E'), term('+'), nt('T')]),
            production(1, 'E', [nt('T')]),
            production(2, 'T', [nt('T'), term('*'), nt('F')]),
            production(3, 'T', [nt('F')]),
            production(4, 'F', [term('('), nt('E'), term(')')]),
            production(5, 'F', [term('id')]),
        ], []);
    }

    /**
     * Builds the dangling-else grammar.
     *
     * S → if E then S | if E then S else S | other
     */
    function danglingElseGrammar(): BnfGrammar
    {
        return new BnfGrammar('S', [
            production(0, 'S', [term('if'), nt('E'), term('then'), nt('S')]),
            production(1, 'S', [
                term('if'),
                nt('E'),
                term('then'),
                nt('S'),
                term('else'),
                nt('S'),
            ]),
            production(2, 'S', [term('id')]),
            production(3, 'E', [term('id')]),
        ], []);
    }

    /**
     * Builds the unambiguous parenthesis grammar.
     *
     * S → ( S ) S | ε
     */
    function parenthesisGrammar(): BnfGrammar
    {
        return new BnfGrammar('S', [
            production(0, 'S', [term('('), nt('S'), term(')'), nt('S')]),
            production(1, 'S', []),
        ], []);
    }

    /**
     * Builds an intentionally ambiguous expression grammar.
     *
     * E → E + E | E * E | id
     */
    function ambiguousExpressionGrammar(): BnfGrammar
    {
        return new BnfGrammar('E', [
            production(0, 'E', [nt('E'), term('+'), nt('E')]),
            production(1, 'E', [nt('E'), term('*'), nt('E')]),
            production(2, 'E', [term('id')]),
        ], []);
    }

    /**
     * Builds a JSON-like value grammar (simplified).
     */
    function jsonLikeGrammar(): BnfGrammar
    {
        return new BnfGrammar('Value', [
            production(0, 'Value', [nt('Object')]),
            production(1, 'Value', [nt('Array')]),
            production(2, 'Value', [term('string')]),
            production(3, 'Value', [term('number')]),
            production(4, 'Object', [term('{'), nt('Members'), term('}')]),
            production(5, 'Object', [term('{'), term('}')]),
            production(6, 'Members', [nt('Pair'), term(','), nt('Members')]),
            production(7, 'Members', [nt('Pair')]),
            production(8, 'Pair', [term('string'), term(':'), nt('Value')]),
            production(9, 'Array', [term('['), nt('Elements'), term(']')]),
            production(10, 'Array', [term('['), term(']')]),
            production(11, 'Elements', [nt('Value'), term(','), nt('Elements')]),
            production(12, 'Elements', [nt('Value')]),
        ], []);
    }

    it('builds conflict-free LR(1) and LALR tables for expression precedence', () =>
    {
        const grammar = expressionPrecedenceGrammar();

        expect(buildLrTable(grammar, 'lr1').isConflictFree).toBe(true);
        expect(buildLrTable(grammar, 'lalr').isConflictFree).toBe(true);
        expect(buildLrTable(grammar, 'slr').isConflictFree).toBe(true);
    });

    it('warns on dangling else under SLR, LR(1), and LALR with shift resolution', () =>
    {
        const grammar = danglingElseGrammar();

        const slr = buildLrTable(grammar, 'slr');
        const lr1 = buildLrTable(grammar, 'lr1');
        const lalr = buildLrTable(grammar, 'lalr');

        expect(slr.isConflictFree).toBe(false);
        expect(lr1.isConflictFree).toBe(false);
        expect(lalr.isConflictFree).toBe(false);

        for (const table of [slr, lr1, lalr])
        {
            const elseConflicts = table.conflicts.filter(
                (conflict) => conflict.kind === 'shift-reduce' && conflict.symbol === '"else"',
            );
            expect(elseConflicts.length).toBeGreaterThan(0);
            expect(elseConflicts.every((conflict) => conflict.resolution === 'shift')).toBe(true);
        }
    });

    it('builds conflict-free tables for nested parentheses', () =>
    {
        const grammar = parenthesisGrammar();

        expect(buildLrTable(grammar, 'lr1').isConflictFree).toBe(true);
        expect(buildLrTable(grammar, 'lalr').isConflictFree).toBe(true);
    });

    it('reports conflicts for the ambiguous expression grammar', () =>
    {
        const grammar = ambiguousExpressionGrammar();
        const lr1 = buildLrTable(grammar, 'lr1');

        expect(lr1.isConflictFree).toBe(false);
    });

    it('builds conflict-free LR(1) tables for JSON-like nested structures', () =>
    {
        const grammar = jsonLikeGrammar();

        expect(buildLrTable(grammar, 'lr1').isConflictFree).toBe(true);
        expect(buildLrTable(grammar, 'lalr').isConflictFree).toBe(true);
    });
});

describe('classic grammars — end-to-end parse', () =>
{
    const PRECEDENCE_GRAMMAR = `
name "precedence" ;

tokens
    id = /[a-z]+/ ;
    plus = /\\+/ ;
    star = /\\*/ ;
    lpar = /\\(/ ;
    rpar = /\\)/ ;

skip
    whitespace = /[ \\t\\n]+/ ;

start expr ;

grammar
    expr =
        expr plus term
      | term
    ;

    term =
        term star factor
      | factor
    ;

    factor =
        lpar expr rpar
      | id
    ;
`;

    const JSON_GRAMMAR = `
name "json" ;

tokens
    lbrace = /\\{/ ;
    rbrace = /\\}/ ;
    lbrack = /\\[/ ;
    rbrack = /\\]/ ;
    colon = /:/ ;
    comma = /,/ ;
    string = /"[^"]*"/ ;
    number = /[0-9]+/ ;

skip
    whitespace = /[ \\t\\n]+/ ;

start value ;

grammar
    value =
        object
      | array
      | string
      | number
    ;

    object =
        lbrace members rbrace
      | lbrace rbrace
    ;

    members =
        pair comma members
      | pair
    ;

    pair =
        string colon value
    ;

    array =
        lbrack elements rbrack
      | lbrack rbrack
    ;

    elements =
        value comma elements
      | value
    ;
`;

    it('parses expression precedence with correct nesting', () =>
    {
        const context = parseContextFromGrammar(PRECEDENCE_GRAMMAR, 'lr1');
        const tree = context.parse(context.lex('a + b * c'));

        expect(tree?.symbol).toBe('expr');
        expect(tree?.children).toHaveLength(3);
        expect(tree?.children[0]?.symbol).toBe('expr');
        expect(tree?.children[1]?.symbol).toBe('plus');
        expect(tree?.children[2]?.symbol).toBe('term');
        expect(tree?.children[2]?.children[0]?.symbol).toBe('term');
        expect(tree?.children[2]?.children[1]?.symbol).toBe('star');
        expect(tree?.children[2]?.children[2]?.symbol).toBe('factor');
    });

    it('parses nested JSON-like structures', () =>
    {
        const source = '{"a": {"b": [1, 2], "c": "x"}, "d": []}';
        const context = parseContextFromGrammar(JSON_GRAMMAR, 'lr1');
        const tree = context.parse(context.lex(source));

        expect(tree?.symbol).toBe('value');
        expect(tree?.children[0]?.symbol).toBe('object');
    });

    it('round-trips precedence grammar tables through JSON', () =>
    {
        const grammar = readGrammar(PRECEDENCE_GRAMMAR);
        const json = ParseTable.fromGrammar(grammar, 'lr1').toJsonString();
        const table = ParseTable.fromJsonString(json);
        const tokens = parseContextFromGrammar(PRECEDENCE_GRAMMAR, 'lr1').lex('x + y');

        expect(parseWithTable(table, tokens)?.symbol).toBe('expr');
    });

    const DANGLING_ELSE_GRAMMAR = `
name "ifelse" ;

tokens
    if = /if/ ;
    then = /then/ ;
    else = /else/ ;
    id = /[a-zA-Z]+/ ;

skip
    whitespace = /[ \\t\\n]+/ ;

start s ;

grammar
    s =
        if id then s
      | if id then s else s
      | id
    ;
`;

    it('parses nested if-then-else with else bound to the inner if', () =>
    {
        const context = parseContextFromGrammar(DANGLING_ELSE_GRAMMAR, 'lr1');
        const tree = context.parser.parseCst(context.lex('if x then if y then a else b'));

        expect(tree).not.toBeNull();
        expect(tree?.productionId).toBe(0);
        expect(tree?.children).toHaveLength(4);
        expect(tree?.children[3]?.symbol).toBe('s');
        expect(tree?.children[3]?.productionId).toBe(1);
        expect(tree?.children[3]?.children[3]?.children[0]?.text).toBe('a');
        expect(tree?.children[3]?.children[5]?.children[0]?.text).toBe('b');
    });
});
