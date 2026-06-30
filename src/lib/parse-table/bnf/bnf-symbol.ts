/**
 * Terminal literal from a quoted string in a production.
 */
export interface BnfTerminalSymbol
{
    readonly kind: 'terminal';
    readonly value: string;
}

/**
 * Reference to a parser non-terminal production.
 */
export interface BnfNonTerminalSymbol
{
    readonly kind: 'nonTerminal';
    readonly name: string;
    readonly binding: string | null;
}

/**
 * Reference to a lexer token rule by name.
 */
export interface BnfTokenSymbol
{
    readonly kind: 'token';
    readonly name: string;
    readonly binding: string | null;
}

/**
 * One symbol on the right-hand side of a BNF production.
 */
export type BnfSymbol = BnfTerminalSymbol | BnfNonTerminalSymbol | BnfTokenSymbol;

/**
 * Returns a stable string key for a BNF symbol, including binding metadata.
 *
 * @param symbol - Symbol to encode.
 */
export function bnfSymbolKey(symbol: BnfSymbol): string
{
    switch (symbol.kind)
    {
        case 'terminal':
            return `"${symbol.value}"`;

        case 'nonTerminal':
            return symbol.binding === null
                ? symbol.name
                : `[${symbol.binding}]:${symbol.name}`;

        case 'token':
            return symbol.binding === null
                ? symbol.name
                : `[${symbol.binding}]:${symbol.name}`;
    }
}

/**
 * Returns the parser symbol key used in ACTION and GOTO tables.
 *
 * @param symbol - Symbol to encode.
 */
export function bnfParserSymbolKey(symbol: BnfSymbol): string
{
    switch (symbol.kind)
    {
        case 'terminal':
            return `"${symbol.value}"`;

        case 'nonTerminal':
            return symbol.name;

        case 'token':
            return symbol.name;
    }
}
