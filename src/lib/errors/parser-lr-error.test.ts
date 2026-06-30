import { describe, expect, it } from '@jest/globals';

import {
    formatUserError,
    isParserLrError,
    messageContainsStackTrace,
    ParserLrError,
} from './parser-lr-error.js';

describe('ParserLrError', () =>
{
    it('sets the error name to the concrete class', () =>
    {
        class SampleError extends ParserLrError
        {
            public constructor()
            {
                super('sample failure');
            }
        }

        const error = new SampleError();

        expect(error.name).toBe('SampleError');
        expect(error.message).toBe('sample failure');
    });
});

describe('formatUserError', () =>
{
    it('returns the message for parser-lr errors', () =>
    {
        const error = new ParserLrError('bad grammar');

        expect(formatUserError(error)).toBe('bad grammar');
    });

    it('returns the message for generic errors', () =>
    {
        expect(formatUserError(new Error('generic failure'))).toBe('generic failure');
    });

    it('stringifies non-error values', () =>
    {
        expect(formatUserError('plain text')).toBe('plain text');
    });
});

describe('isParserLrError', () =>
{
    it('recognizes parser-lr domain errors', () =>
    {
        expect(isParserLrError(new ParserLrError('x'))).toBe(true);
        expect(isParserLrError(new Error('x'))).toBe(false);
    });
});

describe('messageContainsStackTrace', () =>
{
    it('detects embedded stack frames in a message', () =>
    {
        expect(messageContainsStackTrace('failed\n    at Object.<anonymous>')).toBe(true);
        expect(messageContainsStackTrace('failed cleanly')).toBe(false);
    });
});
