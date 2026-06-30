import { ParserLrError } from '../errors/parser-lr-error.js';

/**
 * Thrown when source input is pushed after the lexer has finished.
 */
export class LexerInputError extends ParserLrError
{
    /**
     * Creates a lexer input sequencing error.
     */
    public constructor()
    {
        super('Cannot push input after finish()');
    }
}
