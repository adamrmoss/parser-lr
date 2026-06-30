import { ParserLrError } from './errors/parser-lr-error.js';

/**
 * Thrown when parse output cannot be formatted for a requested interchange format.
 */
export class ParseOutputError extends ParserLrError
{
    /**
     * Creates a parse output formatting error.
     *
     * @param format - Requested output format name.
     */
    public constructor(format: string)
    {
        super(`Unsupported output format ${JSON.stringify(format)}`);
    }
}
