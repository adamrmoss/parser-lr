import type { EbnfExpression } from './ebnf-expression.js';

/**
 * Named production in an EBNF grammar.
 */
export interface EbnfRule
{
    readonly name: string;
    readonly expression: EbnfExpression;
}
