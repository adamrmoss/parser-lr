/**
 * Omit the CST subtree from the AST.
 */
export interface DropTransform
{
    readonly kind: 'drop';
}

/**
 * Lift a single child binding or subtree unchanged.
 */
export interface PassTransform
{
    readonly kind: 'pass';
    readonly reference: string;
}

/**
 * Left-associate repeated infix operators into chained AST nodes.
 */
export interface FoldLeftTransform
{
    readonly kind: 'foldLeft';
    readonly typeName: string;
    readonly variant: string;
    readonly references: readonly string[];
}

/**
 * Right-associate repeated infix operators into chained AST nodes.
 */
export interface FoldRightTransform
{
    readonly kind: 'foldRight';
    readonly typeName: string;
    readonly variant: string;
    readonly references: readonly string[];
}

/**
 * Flatten a `{ head tail }` repetition into a list AST node.
 */
export interface FlattenTransform
{
    readonly kind: 'flatten';
    readonly typeName: string;
    readonly variant: string;
    readonly head: string;
    readonly tail: string;
}

/**
 * Build an AST node (`type.#variant(arg, …)`).
 */
export interface BuildTransform
{
    readonly kind: 'build';
    readonly typeName: string;
    readonly variant: string;
    readonly arguments: readonly string[];
}

/**
 * Root discriminated union for transform expressions.
 */
export type TransformExpression =
    | DropTransform
    | PassTransform
    | FoldLeftTransform
    | FoldRightTransform
    | FlattenTransform
    | BuildTransform;
