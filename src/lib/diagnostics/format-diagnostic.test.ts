import { describe, expect, it } from '@jest/globals';

import { formatDiagnostic } from './format-diagnostic.js';
import { offsetToPosition } from './source-position.js';

describe('offsetToPosition', () =>
{
    it('maps the first character to line 1 column 1', () =>
    {
        expect(offsetToPosition('abc', 0)).toEqual({ line: 1, column: 1 });
    });

    it('advances columns within a line', () =>
    {
        expect(offsetToPosition('abc', 2)).toEqual({ line: 1, column: 3 });
    });

    it('advances lines after newlines', () =>
    {
        expect(offsetToPosition('a\nbc\nd', 4)).toEqual({ line: 2, column: 3 });
    });

    it('clamps offsets past the end of the source', () =>
    {
        expect(offsetToPosition('ab', 99)).toEqual({ line: 1, column: 3 });
    });
});

describe('formatDiagnostic', () =>
{
    it('formats severity and message without a path', () =>
    {
        expect(formatDiagnostic({
            severity: 'error',
            message: 'broken',
        })).toBe('error: broken');
    });

    it('includes path line and column when source and offset are available', () =>
    {
        expect(formatDiagnostic({
            severity: 'warning',
            message: 'duplicate rule',
            path: 'lang.grammar',
            source: 'one\ntwo\nthree',
            offset: 4,
        })).toBe('lang.grammar:2:1: warning: duplicate rule');
    });

    it('includes path alone when no offset is available', () =>
    {
        expect(formatDiagnostic({
            severity: 'error',
            message: 'missing file section',
            path: 'lang.grammar',
        })).toBe('lang.grammar: error: missing file section');
    });
});
