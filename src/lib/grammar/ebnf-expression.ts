/**
 * Reference to a non-terminal rule by name.
 */
export interface EbnfReferenceExpression
{
    readonly kind: 'reference';
    readonly name: string;
}

/**
 * Terminal literal in an EBNF rule.
 */
export interface EbnfTerminalExpression
{
    readonly kind: 'terminal';
    readonly value: string;
}

/**
 * Concatenated sequence of EBNF sub-expressions.
 */
export interface EbnfSequenceExpression
{
    readonly kind: 'sequence';
    readonly elements: readonly EbnfExpression[];
}

/**
 * Alternation between EBNF sub-expressions.
 */
export interface EbnfChoiceExpression
{
    readonly kind: 'choice';
    readonly alternatives: readonly EbnfExpression[];
}

/**
 * Optional EBNF sub-expression (`[ … ]`).
 */
export interface EbnfOptionalExpression
{
    readonly kind: 'optional';
    readonly element: EbnfExpression;
}

/**
 * Repeated EBNF sub-expression (`{ … }`).
 */
export interface EbnfRepeatExpression
{
    readonly kind: 'repeat';
    readonly element: EbnfExpression;
}

/**
 * Grouped EBNF sub-expression (`( … )`).
 */
export interface EbnfGroupExpression
{
    readonly kind: 'group';
    readonly element: EbnfExpression;
}

/**
 * Root discriminated union for the right-hand side of an EBNF rule.
 */
export type EbnfExpression =
    | EbnfReferenceExpression
    | EbnfTerminalExpression
    | EbnfSequenceExpression
    | EbnfChoiceExpression
    | EbnfOptionalExpression
    | EbnfRepeatExpression
    | EbnfGroupExpression;
