import { describe, expect, it } from '@jest/globals';

import { ReadGrammarError } from './read-grammar-error.js';
import { decodeStringLiteral, splitRegexLiteral } from './grammar-literals.js';

describe('decodeStringLiteral', () =>
{
    it('decodes common escape sequences', () =>
    {
        expect(decodeStringLiteral('"a\\nb\\tc\\\\\\"d"')).toBe('a\nb\tc\\"d');
        expect(decodeStringLiteral('"line\\r\\n"')).toBe('line\r\n');
    });

    it('throws on unsupported escape sequences', () =>
    {
        expect(() => decodeStringLiteral('"bad\\x"')).toThrow(ReadGrammarError);
    });
});

describe('splitRegexLiteral', () =>
{
    it('splits pattern and flags at an unescaped closing slash', () =>
    {
        expect(splitRegexLiteral('/[a-z]+/gi')).toEqual({
            pattern: '[a-z]+',
            flags: 'gi',
        });
    });

    it('honors escaped slashes inside the pattern', () =>
    {
        expect(splitRegexLiteral('/a\\/b/m')).toEqual({
            pattern: 'a\\/b',
            flags: 'm',
        });
    });
});
