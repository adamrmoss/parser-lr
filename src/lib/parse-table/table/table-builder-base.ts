import { EOF_TOKEN_NAME } from '../../lexer/token.js';

import { AUGMENTED_START_SYMBOL, type BnfGrammar } from '../bnf/bnf-grammar.js';
import { bnfParserSymbolKey } from '../bnf/bnf-symbol.js';
import { lr0Goto, symbolsAfterDot, type Lr0Item } from '../lr0/lr0-item-set.js';

import {
    classifyParseConflict,
    parseActionsEqual,
    type ParseAction,
    type ParseConflict,
} from './parse-action.js';

/**
 * Shared helpers for constructing LR parse tables from item sets.
 */
export class TableBuilderBase
{
    /**
     * Precomputes GOTO target state indices for every state and grammar symbol.
     *
     * @param grammar - Augmented BNF grammar.
     * @param itemSets - Canonical item set collection.
     * @param gotoItems - Computes the GOTO item set for one state and symbol.
     * @returns Map from `state:symbol` keys to target state indices.
     */
    public static buildGotoTargets(
        grammar: BnfGrammar,
        itemSets: readonly (readonly Lr0Item[])[],
        indexOf: (items: readonly Lr0Item[]) => number | null,
        gotoItems: (
            grammar: BnfGrammar,
            items: readonly Lr0Item[],
            symbolKey: string,
        ) => readonly Lr0Item[],
    ): ReadonlyMap<string, number>
    {
        const targets = new Map<string, number>();

        // Precompute GOTO for every state and symbol reachable from its items.
        for (let state = 0; state < itemSets.length; state += 1)
        {
            const itemSet = itemSets[state] ?? [];

            for (const symbolKey of symbolsAfterDot(grammar, itemSet))
            {
                const gotoSet = gotoItems(grammar, itemSet, symbolKey);

                if (gotoSet.length === 0)
                {
                    continue;
                }

                const targetState = indexOf(gotoSet);

                if (targetState === null)
                {
                    continue;
                }

                targets.set(TableBuilderBase.gotoKey(state, symbolKey), targetState);
            }
        }

        return targets;
    }

    /**
     * Fills shift and GOTO entries from incomplete items in one parser state.
     *
     * @param grammar - Augmented BNF grammar.
     * @param state - Parser state index.
     * @param itemSet - Closed item set for the state.
     * @param gotoTargets - Precomputed GOTO target indices.
     * @param stateActions - ACTION map for the state.
     * @param stateGotos - GOTO map for the state.
     * @param conflicts - Resolved conflict list to append to when actions disagree.
     */
    public static fillShiftsAndGotos(
        grammar: BnfGrammar,
        state: number,
        itemSet: readonly Lr0Item[],
        gotoTargets: ReadonlyMap<string, number>,
        stateActions: Map<string, ParseAction>,
        stateGotos: Map<string, number>,
        conflicts: ParseConflict[],
    ): void
    {
        // Derive shift and GOTO entries from every incomplete item in the state.
        for (const item of itemSet)
        {
            const production = grammar.production(item.productionId);

            if (production === null)
            {
                continue;
            }

            const nextSymbol = production.rhs[item.dot];

            if (nextSymbol === undefined)
            {
                continue;
            }

            const symbolKey = bnfParserSymbolKey(nextSymbol);
            const targetState = gotoTargets.get(TableBuilderBase.gotoKey(state, symbolKey));

            if (targetState === undefined)
            {
                continue;
            }

            // Non-terminal symbols populate GOTO; terminals populate ACTION shift entries.
            if (nextSymbol.kind === 'nonTerminal')
            {
                stateGotos.set(nextSymbol.name, targetState);
                continue;
            }

            TableBuilderBase.setAction(
                stateActions,
                conflicts,
                state,
                symbolKey,
                { kind: 'shift', state: targetState },
            );
        }
    }

    /**
     * Records an accept action for the augmented start production.
     *
     * @param state - Parser state index.
     * @param productionName - Left-hand side of the completed production.
     * @param stateActions - ACTION map for the state.
     * @param conflicts - Resolved conflict list to append to when actions disagree.
     */
    public static setAcceptAction(
        state: number,
        productionName: string,
        stateActions: Map<string, ParseAction>,
        conflicts: ParseConflict[],
    ): void
    {
        if (productionName !== AUGMENTED_START_SYMBOL)
        {
            return;
        }

        TableBuilderBase.setAction(
            stateActions,
            conflicts,
            state,
            EOF_TOKEN_NAME,
            { kind: 'accept' },
        );
    }

    /**
     * Returns a stable map key for a GOTO lookup.
     *
     * @param state - Parser state index.
     * @param symbolKey - Encoded terminal or non-terminal symbol.
     */
    public static gotoKey(state: number, symbolKey: string): string
    {
        return `${String(state)}:${symbolKey}`;
    }

    /**
     * Inserts one ACTION entry, resolving shift/reduce and reduce/reduce conflicts.
     *
     * @param stateActions - ACTION map for the current state.
     * @param conflicts - Resolved conflict list to append to when actions disagree.
     * @param state - Parser state index.
     * @param symbol - Encoded terminal or `$eof` key.
     * @param incoming - Candidate parse action.
     */
    public static setAction(
        stateActions: Map<string, ParseAction>,
        conflicts: ParseConflict[],
        state: number,
        symbol: string,
        incoming: ParseAction,
    ): void
    {
        const existing = stateActions.get(symbol);

        if (existing === undefined)
        {
            stateActions.set(symbol, incoming);
            return;
        }

        // Identical re-insertions are ignored; disagreeing actions are resolved by conflict kind.
        if (parseActionsEqual(existing, incoming))
        {
            return;
        }

        const conflictKind = classifyParseConflict(existing, incoming);

        if (conflictKind === 'shift-reduce')
        {
            const shiftAction = existing.kind === 'shift' ? existing : incoming;
            stateActions.set(symbol, shiftAction);
            conflicts.push({
                kind: 'shift-reduce',
                state,
                symbol,
                existing,
                incoming,
                resolution: 'shift',
            });
            return;
        }

        // Reduce/reduce: keep the first reduce action already in the table.
        conflicts.push({
            kind: 'reduce-reduce',
            state,
            symbol,
            existing,
            incoming,
            resolution: 'reduce',
        });
    }

    /**
     * Default GOTO implementation for LR(0) item sets.
     *
     * @param grammar - Augmented BNF grammar.
     * @param items - Closed item set.
     * @param symbolKey - Encoded terminal or non-terminal symbol.
     */
    public static lr0GotoItems(
        grammar: BnfGrammar,
        items: readonly Lr0Item[],
        symbolKey: string,
    ): readonly Lr0Item[]
    {
        return lr0Goto(grammar, items, symbolKey);
    }
}
