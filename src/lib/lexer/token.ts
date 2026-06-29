import type { SourceLocation } from '../ast/ast-node.js';

/** Token name emitted once at end of input. */
export const EOF_TOKEN_NAME = '$eof';

/**
 * Lexeme emitted by the lexer for one token rule match.
 */
export interface Token
{
    readonly name: string;
    readonly text: string;
    readonly location: SourceLocation;
}

/**
 * Builds a token value from a rule name, matched text, and source offset.
 *
 * @param name - Token rule name from the grammar `tokens` section.
 * @param text - Matched lexeme text.
 * @param offset - Start offset of the lexeme in the source.
 * @returns A token record with a source span.
 */
export function token(
    name: string,
    text: string,
    offset: number,
): Token
{
    return {
        name,
        text,
        location: {
            offset,
            length: text.length,
        },
    };
}

/**
 * Builds the end-of-input token at a source offset.
 *
 * @param offset - Source offset where input ended.
 * @returns An empty `$eof` token.
 */
export function eofToken(offset: number): Token
{
    return token(EOF_TOKEN_NAME, '', offset);
}

/**
 * Returns whether a token is the end-of-input marker.
 *
 * @param value - Token to test.
 */
export function isEofToken(value: Token): boolean
{
    return value.name === EOF_TOKEN_NAME;
}
