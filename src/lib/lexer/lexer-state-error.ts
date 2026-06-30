import { ParserLrError } from '../errors/parser-lr-error.js';

/**
 * Thrown when a lexer state name is not declared in the grammar.
 */
export class LexerStateError extends ParserLrError
{
    /**
     * Creates an unknown lexer state error.
     *
     * @param state - Requested lexer state name.
     */
    public constructor(state: string)
    {
        super(`Unknown lexer state ${JSON.stringify(state)}`);
    }
}
