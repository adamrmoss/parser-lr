import { describe, expect, it } from '@jest/globals';

import { Grammar } from '../grammar/grammar.js';

import {
    compileLexerRules,
    findLongestMatch,
    hasLongerPossibleMatch,
    hasLongerPossibleMatchCrossRule,
    rulesForState,
} from './lexer-compile.js';

describe('lexer-compile longest-match helpers', () =>
{
    const grammar = new Grammar(
        'ops',
        [
            { name: 'lte', pattern: '<=', flags: '' },
            { name: 'lt', pattern: '<', flags: '' },
        ],
        [],
        [],
        'expr',
        [],
    );
    const rules = rulesForState(compileLexerRules(grammar), 'initial');

    it('detects longer cross-rule matches in buffered input', () =>
    {
        expect(hasLongerPossibleMatchCrossRule('<', '<', rules)).toBe(true);
        expect(hasLongerPossibleMatchCrossRule('<=', '<=', rules)).toBe(false);
    });

    it('returns false once the input stream has finished', () =>
    {
        const numberGrammar = new Grammar(
            'calc',
            [{ name: 'number', pattern: '[0-9]+', flags: '' }],
            [],
            [],
            'expr',
            [],
        );
        const numberRules = rulesForState(compileLexerRules(numberGrammar), 'initial');

        expect(hasLongerPossibleMatch('1', '1', numberRules, true)).toBe(false);
        expect(hasLongerPossibleMatch('1', '1', numberRules, false)).toBe(true);
    });

    it('finds the longest rule match at the buffer start', () =>
    {
        const calcGrammar = new Grammar(
            'calc',
            [
                { name: 'number', pattern: '[0-9]+', flags: '' },
                { name: 'plus', pattern: '\\+', flags: '' },
            ],
            [],
            [],
            'expr',
            [],
        );
        const calcRules = rulesForState(compileLexerRules(calcGrammar), 'initial');

        expect(findLongestMatch('123+4', calcRules)?.text).toBe('123');
    });
});
