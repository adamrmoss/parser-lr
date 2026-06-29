/**
 * Error thrown when the lexer cannot match input at the current offset.
 */
export class LexerError extends Error
{
    /**
     * Creates a lexer error at a source offset.
     *
     * @param message - Human-readable failure description.
     * @param offset - Source offset where lexing stopped.
     */
    public constructor(
        message: string,
        public readonly offset: number,
    )
    {
        super(message);
        this.name = 'LexerError';
    }
}
