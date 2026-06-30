import { ParserLrError } from './errors/parser-lr-error.js';

/**
 * Thrown when a parse context cannot be constructed from supplied sources.
 */
export class ParseContextError extends ParserLrError
{
    /**
     * Creates a parse context configuration error.
     *
     * @param message - Human-readable failure description.
     */
    public constructor(message: string)
    {
        super(message);
    }
}
