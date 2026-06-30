import { ParserLrError } from '../errors/parser-lr-error.js';

/**
 * Thrown when serialized parse table JSON cannot be loaded.
 */
export class ParseTableError extends ParserLrError
{
    /**
     * Creates a parse table load error.
     *
     * @param message - Human-readable failure description.
     */
    public constructor(message: string)
    {
        super(message);
    }
}
