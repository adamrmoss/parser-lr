import type { SourceLocation } from '../ast/ast-node.js';
import { AstNode } from '../ast/ast-node.js';
import { EOF_TOKEN_NAME, isEofToken, type Token } from '../lexer/token.js';
import type { ParseTableProductionJson } from '../parse-table/parse-table-json.js';
import type { ParseTable } from '../parse-table/parse-table.js';

/**
 * Returns the ACTION table key for a lexer token.
 *
 * @param token - Current input token.
 * @returns The ACTION table key for the token, or `$eof` for end-of-input.
 */
export function tokenActionKey(token: Token): string
{
    if (isEofToken(token))
    {
        return EOF_TOKEN_NAME;
    }

    return token.name;
}

/**
 * Builds a terminal CST node from a shifted token.
 *
 * @param token - Lexer token that was shifted.
 * @returns A terminal CST node carrying the token name, text, and location.
 */
export function astNodeFromToken(token: Token): AstNode
{
    return AstNode.terminal(token.name, token.text, token.location);
}

/**
 * Merges child spans into one source location.
 *
 * @param children - Reduced child subtrees.
 * @returns The smallest span covering all child locations, or null when none exist.
 */
export function mergeChildLocations(children: readonly AstNode[]): SourceLocation | null
{
    let offset: number | null = null;
    let end: number | null = null;

    // Walk children to find the earliest offset and latest end position.
    for (const child of children)
    {
        if (child.location === null)
        {
            continue;
        }

        if (offset === null)
        {
            offset = child.location.offset;
            end = child.location.offset + child.location.length;
            continue;
        }

        offset = Math.min(offset, child.location.offset);
        end = Math.max(end ?? child.location.offset, child.location.offset + child.location.length);
    }

    if (offset === null || end === null)
    {
        return null;
    }

    return {
        offset,
        length: end - offset,
    };
}

/**
 * Outcome of a shift-reduce parse attempt.
 */
export interface ShiftReduceParseResult
{
    /** Concrete syntax tree on success, or null on syntax error. */
    readonly cst: AstNode | null;

    /** Source offset of the first error token, or null on success. */
    readonly errorOffset: number | null;

    /** Human-readable syntax error message, or null on success. */
    readonly errorMessage: string | null;
}

/**
 * Table-driven shift-reduce parser shared by all LR table algorithms.
 */
export class ShiftReduceEngine
{
    /**
     * Parses a token stream using a serialized LR parse table.
     *
     * @param table - Parse table with ACTION, GOTO, and production metadata.
     * @param tokens - Token stream ending with `$eof`.
     * @returns The start symbol parse tree, or null on syntax error.
     */
    public static parse(table: ParseTable, tokens: readonly Token[]): AstNode | null
    {
        return ShiftReduceEngine.parseWithResult(table, tokens).cst;
    }

    /**
     * Parses a token stream and reports the first syntax error location.
     *
     * @param table - Parse table with ACTION, GOTO, and production metadata.
     * @param tokens - Token stream ending with `$eof`.
     * @returns Parse tree on success, or error offset and message on failure.
     */
    public static parseWithResult(
        table: ParseTable,
        tokens: readonly Token[],
    ): ShiftReduceParseResult
    {
        if (!table.hasParserTable)
        {
            return {
                cst: null,
                errorOffset: 0,
                errorMessage: 'Parse table has no parser entries',
            };
        }

        if (tokens.length === 0 || !isEofToken(tokens[tokens.length - 1]))
        {
            return {
                cst: null,
                errorOffset: tokens[0]?.location.offset ?? 0,
                errorMessage: 'Token stream must end with $eof',
            };
        }

        const stateStack: number[] = [0];
        const valueStack: AstNode[] = [];
        let tokenIndex = 0;

        // Drive the parser until accept, error, or an unrecoverable reduce failure.
        while (true)
        {
            const state = stateStack[stateStack.length - 1];
            const currentToken = tokens[tokenIndex];
            const action = table.action(state, tokenActionKey(currentToken));

            if (action === null)
            {
                return {
                    cst: null,
                    errorOffset: currentToken.location.offset,
                    errorMessage: `Unexpected ${currentToken.name}`,
                };
            }

            switch (action.kind)
            {
                case 'shift':
                {
                    valueStack.push(astNodeFromToken(currentToken));
                    stateStack.push(action.state);
                    tokenIndex += 1;
                    break;
                }

                case 'reduce':
                {
                    const node = ShiftReduceEngine.reduce(
                        table,
                        action.productionId,
                        stateStack,
                        valueStack,
                    );

                    if (node === null)
                    {
                        return {
                            cst: null,
                            errorOffset: currentToken.location.offset,
                            errorMessage: 'Invalid reduce action',
                        };
                    }

                    break;
                }

                case 'accept':
                {
                    if (valueStack.length === 0)
                    {
                        return {
                            cst: null,
                            errorOffset: currentToken.location.offset,
                            errorMessage: 'Empty parse result',
                        };
                    }

                    return {
                        cst: valueStack[valueStack.length - 1],
                        errorOffset: null,
                        errorMessage: null,
                    };
                }
            }
        }
    }

    /**
     * Applies one reduce action and pushes the resulting subtree.
     *
     * @param table - Parse table with GOTO and production metadata.
     * @param productionId - Production to reduce by.
     * @param stateStack - Parser state stack.
     * @param valueStack - Semantic value stack.
     * @returns The reduced subtree pushed onto the value stack, or null on stack underflow.
     */
    private static reduce(
        table: ParseTable,
        productionId: number,
        stateStack: number[],
        valueStack: AstNode[],
    ): AstNode | null
    {
        const production = table.production(productionId);

        if (production === null)
        {
            return null;
        }

        const rhsLength = production.rhs.length;
        const children: AstNode[] = [];

        // Pop one state and value per right-hand side symbol.
        for (let index = 0; index < rhsLength; index += 1)
        {
            if (stateStack.length === 0 || valueStack.length === 0)
            {
                return null;
            }

            stateStack.pop();
            const child = valueStack.pop();

            if (child === undefined)
            {
                return null;
            }

            children.unshift(child);
        }

        if (stateStack.length === 0)
        {
            return null;
        }

        // Follow GOTO for the production left-hand side and push the new subtree.
        const gotoState = table.goto(stateStack[stateStack.length - 1], production.name);

        if (gotoState === null)
        {
            return null;
        }

        const node = ShiftReduceEngine.nodeFromProduction(production, children);
        valueStack.push(node);
        stateStack.push(gotoState);

        return node;
    }

    /**
     * Builds a CST node for one reduced production.
     *
     * @param production - Reduced production metadata.
     * @param children - Child subtrees matching the production right-hand side.
     * @returns A rule CST node spanning the reduced children.
     */
    private static nodeFromProduction(
        production: ParseTableProductionJson,
        children: readonly AstNode[],
    ): AstNode
    {
        return AstNode.rule(
            production.name,
            children,
            mergeChildLocations(children),
            production.variant,
            production.id,
            production.origin,
        );
    }
}

/**
 * Parses a token stream using a serialized LR parse table.
 *
 * @param table - Parse table with ACTION, GOTO, and production metadata.
 * @param tokens - Token stream ending with `$eof`.
 * @returns The start symbol parse tree, or null on syntax error.
 */
export function parseWithTable(table: ParseTable, tokens: readonly Token[]): AstNode | null
{
    return ShiftReduceEngine.parse(table, tokens);
}

/**
 * Parses a token stream and reports the first syntax error location.
 *
 * @param table - Parse table with ACTION, GOTO, and production metadata.
 * @param tokens - Token stream ending with `$eof`.
 * @returns Parse tree on success, or error offset and message on failure.
 */
export function parseWithTableResult(
    table: ParseTable,
    tokens: readonly Token[],
): ShiftReduceParseResult
{
    return ShiftReduceEngine.parseWithResult(table, tokens);
}
