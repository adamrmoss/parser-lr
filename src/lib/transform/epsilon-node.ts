import type { AstNode } from '../ast/ast-node.js';
import type { ParseTable } from '../parse-table/parse-table.js';

/**
 * Returns whether a CST node was reduced by an empty right-hand side.
 *
 * @param node - CST node to test.
 * @param table - Parse table supplying production metadata.
 */
export function isEpsilonNode(node: AstNode, table: ParseTable): boolean
{
    if (node.isTerminal || node.children.length > 0 || node.productionId === null)
    {
        return false;
    }

    const production = table.production(node.productionId);

    return production !== null && production.rhs.length === 0;
}

/**
 * Returns whether a CST node is an authored labeled empty alternative.
 *
 * @remarks
 * Labeled epsilons such as `#absent` are first-class grammar alternatives.
 * They keep identity through default transforms.
 *
 * @param node - CST node to test.
 * @param table - Parse table supplying production metadata.
 */
export function isAuthoredEpsilonNode(node: AstNode, table: ParseTable): boolean
{
    return isEpsilonNode(node, table) && node.variant !== null;
}

/**
 * Returns whether a CST node is synthetic unlabeled epsilon scaffolding.
 *
 * @remarks
 * Unlabeled empty productions come from `{…}` / `[…]` desugaring. They are
 * not authored alternatives and should disappear from AST construction.
 *
 * @param node - CST node to test.
 * @param table - Parse table supplying production metadata.
 */
export function isSyntheticEpsilonNode(node: AstNode, table: ParseTable): boolean
{
    return isEpsilonNode(node, table) && node.variant === null;
}
