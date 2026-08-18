import type { AstType } from '../grammar/ast-type.js';
import type { TransformRule } from '../grammar/transform-rule.js';

/**
 * Serialized production metadata referenced by reduce actions.
 */
export interface ParseTableProductionJson
{
    readonly id: number;
    readonly name: string;
    readonly rhs: readonly string[];
    readonly variant: string | null;
    readonly origin: string;
}

/**
 * Serialized ACTION entry for one state and terminal symbol.
 */
export interface ParseTableActionJson
{
    readonly state: number;
    readonly symbol: string;
    readonly kind: 'shift' | 'reduce' | 'accept';
    readonly target?: number;
    readonly productionId?: number;
}

/**
 * Serialized GOTO entry for one state and non-terminal.
 */
export interface ParseTableGotoJson
{
    readonly state: number;
    readonly symbol: string;
    readonly target: number;
}

/**
 * Serialized parse table JSON including lexer metadata and LR table entries.
 */
export interface ParseTableJson
{
    readonly algorithm: string;
    readonly grammarName: string;
    readonly startSymbol: string;
    readonly tokens: readonly string[];
    readonly tokenRules: readonly { readonly name: string; readonly pattern: string; readonly flags: string }[];
    readonly skipRules: readonly { readonly name: string; readonly pattern: string; readonly flags: string }[];
    readonly parserStateCount: number;
    readonly productions: readonly ParseTableProductionJson[];
    readonly actions: readonly ParseTableActionJson[];
    readonly gotos: readonly ParseTableGotoJson[];
    readonly ast?: readonly AstType[];
    readonly transform?: readonly TransformRule[];
}
