/**
 * Base class for library errors surfaced to callers and the CLI.
 */
export class ParserLrError extends Error
{
    /**
     * Creates a parser-lr error with a caller-safe message.
     *
     * @param message - Human-readable failure description without stack frames.
     */
    public constructor(message: string)
    {
        super(message);
        this.name = new.target.name;
    }
}

/**
 * Returns whether a value is a parser-lr domain error.
 *
 * @param error - Value to test.
 */
export function isParserLrError(error: unknown): error is ParserLrError
{
    return error instanceof ParserLrError;
}

/**
 * Returns a user-facing message for an error value.
 *
 * @param error - Thrown value or Error instance.
 */
export function formatUserError(error: unknown): string
{
    if (error instanceof ParserLrError)
    {
        return error.message;
    }

    if (error instanceof Error)
    {
        return error.message;
    }

    return String(error);
}

/**
 * Returns whether a message contains embedded stack trace frames.
 *
 * @param message - Error message text to inspect.
 */
export function messageContainsStackTrace(message: string): boolean
{
    return /\n\s+at .+/.test(message);
}
