import { ParserLrError } from './errors/parser-lr-error.js';

/**
 * Thrown when a parser cannot be constructed from the supplied sources.
 */
export class ParserLoadError extends ParserLrError
{
    /**
     * Creates a parser-load configuration error.
     *
     * @param message - Human-readable failure description.
     */
    public constructor(message: string)
    {
        super(message);
    }
}
