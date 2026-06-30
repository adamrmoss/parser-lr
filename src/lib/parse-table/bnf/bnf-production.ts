import type { BnfSymbol } from './bnf-symbol.js';

/**
 * One plain BNF production after EBNF desugaring.
 */
export interface BnfProduction
{
    readonly id: number;
    readonly name: string;
    readonly rhs: readonly BnfSymbol[];
    readonly variant: string | null;
    readonly origin: string;
}
