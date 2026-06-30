import { ParserLrError } from '../errors/parser-lr-error.js';

/**
 * Error thrown when a `.grammar` file cannot be lexed or parsed.
 */
export class ReadGrammarError extends ParserLrError
{
    /**
     * Creates a grammar read error at a source offset.
     *
     * @param message - Human-readable failure description.
     * @param offset - Source offset where reading failed.
     */
    public constructor(
        message: string,
        public readonly offset: number,
    )
    {
        super(message);
    }
}
