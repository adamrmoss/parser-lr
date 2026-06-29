import type { SourceLocation } from '../ast/ast-node.js';

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
