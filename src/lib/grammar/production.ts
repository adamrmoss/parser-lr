import type { Expression } from './expression.js';

/**
 * Named production (`identifier = expression ;`).
 */
export interface Production
{
    readonly name: string;
    readonly expression: Expression;
}
