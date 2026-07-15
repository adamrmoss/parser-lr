import type { SourceLocation } from '../ast/ast-node.js';

import type { Expression } from './expression.js';

/**
 * Named production (`identifier = expression ;`).
 */
export interface Production
{
    readonly name: string;
    readonly expression: Expression;
    readonly location?: SourceLocation | null;
}
