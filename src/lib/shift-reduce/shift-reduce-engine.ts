import type { SourceLocation } from '../ast/ast-node.js';
import { AstNode } from '../ast/ast-node.js';
import { EOF_TOKEN_NAME, isEofToken, type Token } from '../lexer/token.js';
import type { ParseTableProductionJson } from '../parse-table/parse-table-json.js';
import type { ParseTable } from '../parse-table/parse-table.js';

/**
 * Returns the ACTION table key for a lexer token.
 *
 * @param token - Current input token.
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
 */
export function astNodeFromToken(token: Token): AstNode
{
    return AstNode.terminal(token.name, token.text, token.location);
}

/**
 * Merges child spans into one source location.
 *
 * @param children - Reduced child subtrees.
 */
export function mergeChildLocations(children: readonly AstNode[]): SourceLocation | null
{
    let offset: number | null = null;
    let end: number | null = null;

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
        if (!table.hasParserTable)
        {
            return null;
        }

        if (tokens.length === 0 || !isEofToken(tokens[tokens.length - 1]))
        {
            return null;
        }

        const stateStack: number[] = [0];
        const valueStack: AstNode[] = [];
        let tokenIndex = 0;

        while (true)
        {
            const state = stateStack[stateStack.length - 1];
            const currentToken = tokens[tokenIndex];
            const action = table.action(state, tokenActionKey(currentToken));

            if (action === null)
            {
                return null;
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
                        return null;
                    }

                    break;
                }

                case 'accept':
                {
                    if (valueStack.length === 0)
                    {
                        return null;
                    }

                    return valueStack[valueStack.length - 1];
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
        );
    }
}

/**
 * Parses a token stream using a serialized LR parse table.
 *
 * @param table - Parse table with ACTION, GOTO, and production metadata.
 * @param tokens - Token stream ending with `$eof`.
 */
export function parseWithTable(table: ParseTable, tokens: readonly Token[]): AstNode | null
{
    return ShiftReduceEngine.parse(table, tokens);
}
