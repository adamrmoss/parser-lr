/**
 * Lexer rule from a `tokens` or `skip` section (`identifier = /…/ ;`).
 */
export interface TokenRule
{
    readonly name: string;
    readonly pattern: string;
    readonly flags: string;
}
