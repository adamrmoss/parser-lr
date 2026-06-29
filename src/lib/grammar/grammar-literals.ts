import { ReadGrammarError } from './read-grammar-error.js';

/**
 * Decodes a grammar-file string literal into its value.
 *
 * @param text - Quoted string literal text including surrounding quotes.
 * @returns Decoded string contents.
 */
export function decodeStringLiteral(text: string): string
{
    let value = '';
    let index = 1;

    // Walk the literal body, expanding escape sequences.
    while (index < text.length - 1)
    {
        const char = text[index];

        if (char === '\\')
        {
            const next = text[index + 1];

            switch (next)
            {
                case '"':
                case '\\':
                    value += next;
                    index += 2;
                    continue;
                case 'n':
                    value += '\n';
                    index += 2;
                    continue;
                case 'r':
                    value += '\r';
                    index += 2;
                    continue;
                case 't':
                    value += '\t';
                    index += 2;
                    continue;
                default:
                    throw new ReadGrammarError(
                        `Unsupported escape sequence \\${next ?? ''}`,
                        index,
                    );
            }
        }

        value += char;
        index += 1;
    }

    return value;
}

/**
 * Splits a regex literal token into pattern and flag components.
 *
 * @param text - Regex literal text including slashes and optional flags.
 * @returns Pattern body and flag letters.
 */
export function splitRegexLiteral(text: string): { pattern: string; flags: string }
{
    let index = 1;

    // Find the closing slash, honoring escapes.
    while (index < text.length)
    {
        const char = text[index];

        if (char === '\\')
        {
            index += 2;
            continue;
        }

        if (char === '/')
        {
            break;
        }

        index += 1;
    }

    const pattern = text.slice(1, index);
    const flags = text.slice(index + 1);

    return { pattern, flags };
}
