import type { Token } from './lexer/token.js';

/**
 * Formats parse output for a named interchange format.
 *
 * @param tokens - Lexed token stream until shift-reduce parsing is wired.
 * @param format - Output format name.
 * @returns Formatted output text.
 */
export function formatParseOutput(tokens: readonly Token[], format: string): string
{
    if (format !== 'json')
    {
        throw new Error(`Unsupported output format ${JSON.stringify(format)}`);
    }

    return JSON.stringify({ tokens }, null, 4);
}
