import type { Expression } from './expression.js';

/**
 * Named AST type from the `ast` section (`identifier = expression ;`).
 *
 * Uses the same expression syntax as parse productions; `#` labels name
 * variants and `[name]:` bindings name child slots for transforms.
 */
export interface AstType
{
    readonly name: string;
    readonly expression: Expression;
}
