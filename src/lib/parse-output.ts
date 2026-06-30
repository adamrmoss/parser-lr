import type { AstNode } from './ast/ast-node.js';

/**
 * Formats parse output for a named interchange format.
 *
 * @param tree - Parsed concrete syntax tree, or null on syntax error.
 * @param format - Output format name.
 * @returns Formatted output text.
 */
export function formatParseOutput(tree: AstNode | null, format: string): string
{
    if (format !== 'json')
    {
        throw new Error(`Unsupported output format ${JSON.stringify(format)}`);
    }

    return JSON.stringify({ ast: tree }, null, 4);
}
