/**
 * Error thrown when lexer rules cannot be compiled from a grammar.
 */
export class LexerCompileError extends Error
{
    /**
     * Creates a lexer compile error for one token rule.
     *
     * @param ruleName - Token or skip rule name.
     * @param message - Underlying regular expression error message.
     */
    public constructor(
        public readonly ruleName: string,
        message: string,
    )
    {
        super(`Invalid lexer rule ${JSON.stringify(ruleName)}: ${message}`);
        this.name = 'LexerCompileError';
    }
}
