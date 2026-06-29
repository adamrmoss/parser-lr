/**
 * Reference to a production, token, or AST type by name.
 */
export interface ReferenceExpression
{
    readonly kind: 'reference';
    readonly name: string;
}

/**
 * Named child slot referencing another symbol (`[slot]:symbol`).
 */
export interface BoundReferenceExpression
{
    readonly kind: 'boundReference';
    readonly binding: string;
    readonly name: string;
}

/**
 * Terminal literal (`"…"` in a production).
 */
export interface TerminalExpression
{
    readonly kind: 'terminal';
    readonly value: string;
}

/**
 * Concatenated sequence of sub-expressions.
 */
export interface SequenceExpression
{
    readonly kind: 'sequence';
    readonly elements: readonly Expression[];
}

/**
 * One branch of a choice, with an optional `#` label.
 */
export interface Alternative
{
    readonly label: string | null;
    readonly expression: Expression;
}

/**
 * Alternation between labeled alternatives (`|`).
 */
export interface ChoiceExpression
{
    readonly kind: 'choice';
    readonly alternatives: readonly Alternative[];
}

/**
 * Optional sub-expression (`[ … ]`).
 */
export interface OptionalExpression
{
    readonly kind: 'optional';
    readonly element: Expression;
}

/**
 * Repeated sub-expression (`{ … }`).
 */
export interface RepeatExpression
{
    readonly kind: 'repeat';
    readonly element: Expression;
}

/**
 * Grouped sub-expression (`( … )`).
 */
export interface GroupExpression
{
    readonly kind: 'group';
    readonly element: Expression;
}

/**
 * Root discriminated union for the right-hand side of a production.
 */
export type Expression =
    | ReferenceExpression
    | BoundReferenceExpression
    | TerminalExpression
    | SequenceExpression
    | ChoiceExpression
    | OptionalExpression
    | RepeatExpression
    | GroupExpression;
