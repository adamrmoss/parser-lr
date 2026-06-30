import { EOF_TOKEN_NAME } from '../../lexer/token.js';

import { AUGMENTED_START_SYMBOL, type BnfGrammar } from '../bnf/bnf-grammar.js';
import { bnfParserSymbolKey } from '../bnf/bnf-symbol.js';
import { lr0Goto, Lr0ItemSetBuilder, type Lr0Item } from '../lr0/lr0-item-set.js';

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
        const symbols = Lr0ItemSetBuilder.grammarSymbolKeys(grammar);

        for (let state = 0; state < itemSets.length; state += 1)
        {
            const itemSet = itemSets[state] ?? [];

            for (const symbolKey of symbols)
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
     * @param conflicts - Conflict list to append to when actions disagree.
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
     * @param conflicts - Conflict list to append to when actions disagree.
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
     * Inserts one ACTION entry, recording a conflict when the slot is already occupied.
     *
     * @param stateActions - ACTION map for the current state.
     * @param conflicts - Conflict list to append to when actions disagree.
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

        if (parseActionsEqual(existing, incoming))
        {
            return;
        }

        conflicts.push({
            kind: classifyParseConflict(existing, incoming),
            state,
            symbol,
            existing,
            incoming,
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
