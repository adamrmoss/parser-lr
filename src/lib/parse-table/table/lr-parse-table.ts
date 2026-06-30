import type { LrAlgorithm } from '../lr-algorithm.js';
import type { BnfGrammar } from '../bnf/bnf-grammar.js';
import type { BnfProduction } from '../bnf/bnf-production.js';
import { bnfSymbolKey } from '../bnf/bnf-symbol.js';

import type { ParseAction, ParseConflict } from './parse-action.js';
import { formatParseAction } from './parse-action.js';

/**
 * LR parse table with ACTION and GOTO entries plus any detected conflicts.
 */
export class LrParseTable
{
    /**
     * Creates an LR parse table from precomputed table entries.
     *
     * @param algorithm - LR algorithm used to build the table.
     * @param grammar - Augmented BNF grammar the table was built from.
     * @param productions - Flat BNF productions referenced by reduce actions.
     * @param stateCount - Number of parser states in the item set collection.
     * @param actions - ACTION entries keyed by state and terminal symbol.
     * @param gotos - GOTO entries keyed by state and non-terminal name.
     * @param conflicts - Shift/reduce and reduce/reduce conflicts resolved during construction.
     */
    public constructor(
        public readonly algorithm: LrAlgorithm,
        public readonly grammar: BnfGrammar,
        public readonly productions: readonly BnfProduction[],
        public readonly stateCount: number,
        public readonly actions: ReadonlyMap<number, ReadonlyMap<string, ParseAction>>,
        public readonly gotos: ReadonlyMap<number, ReadonlyMap<string, number>>,
        public readonly conflicts: readonly ParseConflict[],
    )
    {
    }

    /**
     * Whether the table was built without conflicts.
     */
    public get isConflictFree(): boolean
    {
        return this.conflicts.length === 0;
    }

    /**
     * Returns the ACTION entry for a state and terminal symbol key.
     *
     * @param state - Parser state index.
     * @param symbol - Encoded terminal or `$eof` key.
     */
    public action(state: number, symbol: string): ParseAction | null
    {
        return this.actions.get(state)?.get(symbol) ?? null;
    }

    /**
     * Returns the GOTO state for a parser state and non-terminal name.
     *
     * @param state - Parser state index.
     * @param nonTerminal - Non-terminal symbol name.
     */
    public goto(state: number, nonTerminal: string): number | null
    {
        return this.gotos.get(state)?.get(nonTerminal) ?? null;
    }
}

/**
 * Returns readable ACTION rows for a parser state.
 *
 * @param table - LR parse table to format.
 * @param state - Parser state index.
 */
export function formatLrActions(table: LrParseTable, state: number): readonly string[]
{
    const stateActions = table.actions.get(state);

    if (stateActions === undefined)
    {
        return [];
    }

    return [...stateActions.entries()]
        .sort(([leftSymbol], [rightSymbol]) => leftSymbol.localeCompare(rightSymbol))
        .map(([symbol, action]) => `${symbol}=${formatParseAction(action)}`);
}

/**
 * Returns readable GOTO rows for a parser state.
 *
 * @param table - LR parse table to format.
 * @param state - Parser state index.
 */
export function formatLrGotos(table: LrParseTable, state: number): readonly string[]
{
    const stateGotos = table.gotos.get(state);

    if (stateGotos === undefined)
    {
        return [];
    }

    return [...stateGotos.entries()]
        .sort(([leftSymbol], [rightSymbol]) => leftSymbol.localeCompare(rightSymbol))
        .map(([symbol, targetState]) => `${symbol}=${String(targetState)}`);
}

/**
 * Returns readable conflict labels for tests and diagnostics.
 *
 * @param table - LR parse table to format.
 */
export function formatLrConflicts(table: LrParseTable): readonly string[]
{
    return table.conflicts.map((conflict) =>
        `${String(conflict.state)}/${conflict.symbol} `
        + `${formatParseAction(conflict.existing)} vs ${formatParseAction(conflict.incoming)} `
        + `(${conflict.kind}, resolved as ${conflict.resolution})`);
}

/**
 * Returns conflict warning lines for a built parse table.
 *
 * @param table - LR parse table to format.
 */
export function formatLrConflictWarnings(table: LrParseTable): readonly string[]
{
    return table.conflicts.map((conflict) => formatParseConflictWarning(conflict));
}

/**
 * Formats one resolved conflict as a warning line.
 *
 * @param conflict - Resolved shift/reduce or reduce/reduce conflict.
 */
export function formatParseConflictWarning(conflict: ParseConflict): string
{
    const tokenLabel = formatConflictTokenLabel(conflict.symbol);

    if (conflict.kind === 'shift-reduce')
    {
        return `state ${String(conflict.state)}: shift/reduce conflict on ${tokenLabel} resolved as shift`;
    }

    const keptProduction = conflict.existing.kind === 'reduce'
        ? conflict.existing.productionId
        : (conflict.incoming as Extract<typeof conflict.incoming, { kind: 'reduce' }>).productionId;

    return `state ${String(conflict.state)}: reduce/reduce conflict on ${tokenLabel} `
        + `resolved using rule ${String(keptProduction)}`;
}

/**
 * Returns a readable terminal label for conflict warning text.
 *
 * @param symbol - Encoded terminal or `$eof` key from the ACTION table.
 */
function formatConflictTokenLabel(symbol: string): string
{
    if (symbol === '$eof')
    {
        return 'token $eof';
    }

    return `token ${symbol}`;
}

/**
 * Returns encoded terminal keys used in ACTION rows, including `$eof`.
 *
 * @param table - LR parse table to inspect.
 */
export function lrActionTerminalKeys(table: LrParseTable): readonly string[]
{
    const keys = new Set<string>();

    for (const stateActions of table.actions.values())
    {
        for (const symbol of stateActions.keys())
        {
            keys.add(symbol);
        }
    }

    return [...keys].sort();
}

/**
 * Returns non-terminal names used in GOTO rows.
 *
 * @param table - LR parse table to inspect.
 */
export function lrGotoNonTerminalNames(table: LrParseTable): readonly string[]
{
    const names = new Set<string>();

    for (const stateGotos of table.gotos.values())
    {
        for (const name of stateGotos.keys())
        {
            names.add(name);
        }
    }

    return [...names].sort();
}

/**
 * Returns a production by its stable id.
 *
 * @param table - LR parse table to inspect.
 * @param productionId - Production id referenced by reduce actions.
 */
export function lrProduction(table: LrParseTable, productionId: number): BnfProduction | null
{
    return table.productions.find((production) => production.id === productionId) ?? null;
}

/**
 * Returns encoded right-hand side symbols for one production.
 *
 * @param production - BNF production to encode.
 */
export function encodeProductionRhs(production: BnfProduction): readonly string[]
{
    return production.rhs.map((symbol) => bnfSymbolKey(symbol));
}
