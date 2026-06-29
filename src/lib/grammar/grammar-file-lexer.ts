import { ReadGrammarError } from './read-grammar-error.js';

/**
 * Token kinds produced when lexing a `.grammar` source file.
 */
export type GrammarFileTokenKind =
    | 'eof'
    | 'identifier'
    | 'string_literal'
    | 'regex_literal'
    | 'name_kw'
    | 'tokens_kw'
    | 'skip_kw'
    | 'states_kw'
    | 'start_kw'
    | 'grammar_kw'
    | 'ast_kw'
    | 'transform_kw'
    | 'pass_kw'
    | 'drop_kw'
    | 'fold_left_kw'
    | 'fold_right_kw'
    | 'flatten_kw'
    | 'equal'
    | 'semicolon'
    | 'comma'
    | 'bar'
    | 'hash'
    | 'arrow'
    | 'colon'
    | 'dot'
    | 'lpar'
    | 'rpar'
    | 'lbracket'
    | 'rbracket'
    | 'lbrace'
    | 'rbrace';

/**
 * One token from a `.grammar` source file.
 */
export interface GrammarFileToken
{
    readonly kind: GrammarFileTokenKind;
    readonly text: string;
    readonly offset: number;
}

const KEYWORDS: readonly { readonly text: string; readonly kind: GrammarFileTokenKind }[] = [
    { text: 'fold-left', kind: 'fold_left_kw' },
    { text: 'fold-right', kind: 'fold_right_kw' },
    { text: 'flatten', kind: 'flatten_kw' },
    { text: 'transform', kind: 'transform_kw' },
    { text: 'tokens', kind: 'tokens_kw' },
    { text: 'states', kind: 'states_kw' },
    { text: 'grammar', kind: 'grammar_kw' },
    { text: 'start', kind: 'start_kw' },
    { text: 'pass', kind: 'pass_kw' },
    { text: 'drop', kind: 'drop_kw' },
    { text: 'skip', kind: 'skip_kw' },
    { text: 'name', kind: 'name_kw' },
    { text: 'ast', kind: 'ast_kw' },
];

/**
 * Lexes a `.grammar` source file into tokens.
 *
 * @param source - Full grammar file text.
 * @returns Tokens ending with `eof`.
 */
export function lexGrammarFile(source: string): readonly GrammarFileToken[]
{
    const tokens: GrammarFileToken[] = [];
    let offset = 0;

    // Scan until the source is fully consumed.
    while (offset < source.length)
    {
        // Skip whitespace and comments before each token.
        offset = skipTrivia(source, offset);

        if (offset >= source.length)
        {
            break;
        }

        const token = readToken(source, offset);

        tokens.push(token);
        offset += token.text.length;
    }

    tokens.push({
        kind: 'eof',
        text: '',
        offset,
    });

    return tokens;
}

/**
 * Advances past whitespace and line comments.
 *
 * @param source - Full grammar file text.
 * @param offset - Current scan offset.
 * @returns Offset after skipped trivia.
 */
function skipTrivia(source: string, offset: number): number
{
    let index = offset;

    // Loop until no more trivia remains at the current position.
    while (index < source.length)
    {
        const char = source[index];

        // Skip horizontal and vertical whitespace.
        if (char === ' ' || char === '\t' || char === '\r' || char === '\n')
        {
            index += 1;
            continue;
        }

        // Skip line comments.
        if (char === '/' && source[index + 1] === '/')
        {
            index += 2;

            while (index < source.length && source[index] !== '\n' && source[index] !== '\r')
            {
                index += 1;
            }

            continue;
        }

        break;
    }

    return index;
}

/**
 * Reads one token starting at an offset.
 *
 * @param source - Full grammar file text.
 * @param offset - Start offset of the token.
 * @returns The matched token.
 */
function readToken(source: string, offset: number): GrammarFileToken
{
    const char = source[offset];

    // Match two-character punctuators first.
    if (char === '-' && source[offset + 1] === '>')
    {
        return punctuator('arrow', '->', offset);
    }

    // Match single-character punctuators.
    switch (char)
    {
        case '=':
            return punctuator('equal', '=', offset);
        case ';':
            return punctuator('semicolon', ';', offset);
        case ',':
            return punctuator('comma', ',', offset);
        case '|':
            return punctuator('bar', '|', offset);
        case '#':
            return punctuator('hash', '#', offset);
        case ':':
            return punctuator('colon', ':', offset);
        case '.':
            return punctuator('dot', '.', offset);
        case '(':
            return punctuator('lpar', '(', offset);
        case ')':
            return punctuator('rpar', ')', offset);
        case '[':
            return punctuator('lbracket', '[', offset);
        case ']':
            return punctuator('rbracket', ']', offset);
        case '{':
            return punctuator('lbrace', '{', offset);
        case '}':
            return punctuator('rbrace', '}', offset);
        case '"':
            return readStringLiteral(source, offset);
        case '/':
            return readRegexLiteral(source, offset);
        default:
            break;
    }

    // Match keywords and identifiers.
    if (isIdentifierStart(char))
    {
        return readWord(source, offset);
    }

    throw new ReadGrammarError(
        `Unexpected character ${JSON.stringify(char)}`,
        offset,
    );
}

/**
 * Reads a double-quoted string literal.
 *
 * @param source - Full grammar file text.
 * @param offset - Opening quote offset.
 * @returns The string literal token.
 */
function readStringLiteral(source: string, offset: number): GrammarFileToken
{
    let index = offset + 1;

    // Scan until the closing quote, honoring escapes.
    while (index < source.length)
    {
        const char = source[index];

        if (char === '\\')
        {
            index += 2;
            continue;
        }

        if (char === '"')
        {
            index += 1;
            break;
        }

        index += 1;
    }

    if (index > source.length || source[index - 1] !== '"')
    {
        throw new ReadGrammarError('Unterminated string literal', offset);
    }

    return {
        kind: 'string_literal',
        text: source.slice(offset, index),
        offset,
    };
}

/**
 * Reads a slash-delimited regular expression literal and optional flags.
 *
 * @param source - Full grammar file text.
 * @param offset - Opening slash offset.
 * @returns The regex literal token.
 */
function readRegexLiteral(source: string, offset: number): GrammarFileToken
{
    let index = offset + 1;

    // Scan until the closing slash, honoring escapes.
    while (index < source.length)
    {
        const char = source[index];

        if (char === '\\')
        {
            index += 2;
            continue;
        }

        if (char === '/')
        {
            index += 1;
            break;
        }

        index += 1;
    }

    if (index > source.length || source[index - 1] !== '/')
    {
        throw new ReadGrammarError('Unterminated regular expression literal', offset);
    }

    // Consume optional JS regex flag letters.
    while (index < source.length && 'gimsuy'.includes(source[index] ?? ''))
    {
        index += 1;
    }

    return {
        kind: 'regex_literal',
        text: source.slice(offset, index),
        offset,
    };
}

/**
 * Reads a keyword or identifier word.
 *
 * @param source - Full grammar file text.
 * @param offset - Word start offset.
 * @returns The keyword or identifier token.
 */
function readWord(source: string, offset: number): GrammarFileToken
{
    let index = offset + 1;

    while (index < source.length && isIdentifierPart(source[index] ?? ''))
    {
        index += 1;
    }

    const text = source.slice(offset, index);

    // Resolve keywords before treating the word as an identifier.
    for (const keyword of KEYWORDS)
    {
        if (keyword.text === text)
        {
            return {
                kind: keyword.kind,
                text,
                offset,
            };
        }
    }

    return {
        kind: 'identifier',
        text,
        offset,
    };
}

/**
 * Builds a single-character punctuator token.
 *
 * @param kind - Token kind.
 * @param text - Punctuator text.
 * @param offset - Source offset.
 * @returns The punctuator token.
 */
function punctuator(
    kind: GrammarFileTokenKind,
    text: string,
    offset: number,
): GrammarFileToken
{
    return {
        kind,
        text,
        offset,
    };
}

/**
 * Returns whether a character can start an identifier.
 *
 * @param char - Candidate first character.
 */
function isIdentifierStart(char: string): boolean
{
    return /[A-Za-z_]/.test(char);
}

/**
 * Returns whether a character can continue an identifier.
 *
 * @param char - Candidate continuation character.
 */
function isIdentifierPart(char: string): boolean
{
    return /[A-Za-z0-9_]/.test(char);
}

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
