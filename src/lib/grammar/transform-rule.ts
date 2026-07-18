import type { SourceLocation } from '../ast/ast-node.js';

import type { TransformExpression } from './transform-expression.js';

/**
 * Maps one CST `#` alternative to a transform expression.
 */
export interface TransformAlternative
{
    readonly label: string;
    readonly expression: TransformExpression;
    readonly location?: SourceLocation | null;
}

/**
 * CST production transform (`production -> #alt expr | … ;`).
 */
export interface TransformRule
{
    readonly production: string;
    readonly alternatives: readonly TransformAlternative[];
    readonly location?: SourceLocation | null;
}
