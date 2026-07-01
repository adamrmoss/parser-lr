import type { AstType } from '../grammar/ast-type.js';
import type { TransformRule } from '../grammar/transform-rule.js';

import type { ParseTableJson } from './parse-table.js';

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
 * Full parse table JSON including parser states and table entries.
 */
export interface ParseTableJsonV2 extends ParseTableJson
{
    readonly version: 2;
    readonly parserStateCount: number;
    readonly productions: readonly ParseTableProductionJson[];
    readonly actions: readonly ParseTableActionJson[];
    readonly gotos: readonly ParseTableGotoJson[];
    readonly ast?: readonly AstType[];
    readonly transform?: readonly TransformRule[];
}

/**
 * Returns whether a JSON object is a version 2 parse table payload.
 *
 * @param json - Parsed table JSON object.
 */
export function isParseTableJsonV2(json: ParseTableJson): json is ParseTableJsonV2
{
    return json.version === 2;
}

/**
 * Lexer-only parse table JSON without parser states or table entries.
 */
export type ParseTableJsonV1 = ParseTableJson;
