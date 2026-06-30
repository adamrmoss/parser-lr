import { describe, expect, it } from '@jest/globals';

import { BnfGrammar } from './bnf-grammar.js';
import type { BnfProduction } from './bnf-production.js';
import type { BnfNonTerminalSymbol, BnfSymbol } from './bnf-symbol.js';

function nt(name: string): BnfNonTerminalSymbol
{
    return { kind: 'nonTerminal', name, binding: null };
}

function term(value: string): BnfSymbol
{
    return { kind: 'terminal', value };
}

function token(name: string): BnfSymbol
{
    return { kind: 'token', name, binding: null };
}

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

describe('BnfGrammar', () =>
{
    const grammar = new BnfGrammar('expr', [
        production(0, 'expr', [token('number'), term('+'), nt('expr')]),
        production(1, 'expr', [term('('), nt('expr'), term(')')]),
    ], ['number', 'plus']);

    it('reports token membership and symbol inventories', () =>
    {
        expect(grammar.isToken('number')).toBe(true);
        expect(grammar.isToken('expr')).toBe(false);
        expect(grammar.nonTerminalNames()).toEqual(['expr']);
        expect(grammar.terminalKeys()).toEqual(['"("', '")"', '"+"', 'number']);
    });

    it('classifies terminal keys and resolves rhs symbols', () =>
    {
        expect(grammar.isTerminalKey('"("')).toBe(true);
        expect(grammar.isTerminalKey('number')).toBe(true);
        expect(grammar.isTerminalKey('expr')).toBe(false);

        const symbol = grammar.terminalSymbolForKey('number');

        expect(symbol?.kind).toBe('token');
        expect(grammar.terminalSymbolForKey('missing')).toBeNull();
    });

    it('augments the start production', () =>
    {
        const augmented = grammar.augment();

        expect(augmented.startSymbol).toBe('$accept');
        expect(augmented.production(augmented.productions.length - 1)?.name).toBe('$accept');
    });
});
