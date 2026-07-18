import { formatDiagnostic } from '../lib/diagnostics/format-diagnostic.js';
import { LexerError } from '../lib/lexer/lexer-error.js';
import { ReadGrammarError } from '../lib/grammar/read-grammar-error.js';
import { ParserLrError } from '../lib/errors/parser-lr-error.js';

/**
 * Rewrites a thrown source error into a positioned CLI diagnostic error.
 *
 * @param error - Thrown value from grammar or input reading.
 * @param path - Source file path.
 * @param source - Full source text used for line/column mapping.
 * @returns Positioned ParserLrError when the failure has an offset; otherwise the original value.
 */
export function locateSourceError(error: unknown, path: string, source: string): unknown
{
    const offset = sourceErrorOffset(error);

    if (offset === null)
    {
        return error;
    }

    return new ParserLrError(formatDiagnostic({
        severity: 'error',
        message: stripEmbeddedOffset(errorMessage(error)),
        path,
        source,
        offset,
    }));
}

/**
 * Returns a source offset from a known offset-bearing error.
 *
 * @param error - Thrown value to inspect.
 */
function sourceErrorOffset(error: unknown): number | null
{
    if (error instanceof ReadGrammarError || error instanceof LexerError)
    {
        return error.offset;
    }

    return null;
}

/**
 * Returns a human-readable message from a thrown value.
 *
 * @param error - Thrown value.
 */
function errorMessage(error: unknown): string
{
    if (error instanceof Error)
    {
        return error.message;
    }

    return String(error);
}

/**
 * Removes an embedded `at offset N` suffix so the diagnostic formatter owns the position.
 *
 * @param message - Original error message.
 */
function stripEmbeddedOffset(message: string): string
{
    return message.replace(/\s+at offset \d+\s*$/, '');
}
