import { describe, expect, it } from '@jest/globals';

import { EbnfGrammar } from './ebnf-grammar.js';

describe('EbnfGrammar', () =>
{
    it('looks up rules by name', () =>
    {
        const grammar = new EbnfGrammar('program', [
            {
                name: 'program',
                expression: { kind: 'reference', name: 'statement' },
            },
            {
                name: 'statement',
                expression: { kind: 'terminal', value: 'end' },
            },
        ]);

        expect(grammar.startSymbol).toBe('program');
        expect(grammar.rules).toHaveLength(2);
        expect(grammar.hasRule('statement')).toBe(true);
        expect(grammar.rule('statement')?.expression).toEqual({
            kind: 'terminal',
            value: 'end',
        });
        expect(grammar.rule('missing')).toBeNull();
    });
});
