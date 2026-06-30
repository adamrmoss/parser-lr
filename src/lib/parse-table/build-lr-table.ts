import { EOF_TOKEN_NAME } from '../lexer/token.js';

import { analyzeGrammar, type GrammarAnalysis } from './analysis/first-follow.js';
import { AUGMENTED_START_SYMBOL, type BnfGrammar } from './bnf/bnf-grammar.js';
import type { LrAlgorithm } from './lr-algorithm.js';
import {
    buildLr0ItemSets,
    type Lr0Item,
    type Lr0ItemSetCollection,
} from './lr0/lr0-item-set.js';
import {
    buildLalrGotoTargets,
    buildLr1ItemSets,
    lr1Goto,
    type Lr1Item,
    type Lr1ItemSetCollection,
    Lr1ItemSetBuilder,
    mergeLalrItemSets,
} from './lr1/lr1-item-set.js';
import type { ParseAction, ParseConflict } from './table/parse-action.js';
import { LrParseTable } from './table/lr-parse-table.js';
import { TableBuilderBase } from './table/table-builder-base.js';

/**
 * Builds an LR parse table for a plain BNF grammar.
 *
 * @param grammar - Plain BNF grammar to analyze.
 * @param algorithm - LR table construction algorithm.
 */
export function buildLrTable(grammar: BnfGrammar, algorithm: LrAlgorithm): LrParseTable
{
    const augmented = grammar.augment();
    const analysis = analyzeGrammar(augmented);

    switch (algorithm)
    {
        case 'lr0':
            return LrTableBuilder.buildLr0(augmented);

        case 'slr':
            return LrTableBuilder.buildSlr(augmented, analysis);

        case 'lr1':
            return LrTableBuilder.buildLr1(augmented, analysis);

        case 'lalr':
            return LrTableBuilder.buildLalr(augmented, analysis);
    }
}

/**
 * Builds LR parse tables for each supported algorithm.
 */
class LrTableBuilder
{
    /**
     * Builds an LR(0) parse table.
     *
     * @param grammar - Augmented BNF grammar.
     * @param analysis - Nullable, FIRST, and FOLLOW analysis for the grammar.
     */
    public static buildLr0(grammar: BnfGrammar): LrParseTable
    {
        const itemSets = buildLr0ItemSets(grammar);
        const terminalKeys = grammar.terminalKeys().concat([EOF_TOKEN_NAME]);

        return LrTableBuilder.buildFromLr0ItemSets(
            'lr0',
            grammar,
            itemSets,
            (production) =>
            {
                if (production.name === AUGMENTED_START_SYMBOL)
                {
                    return [EOF_TOKEN_NAME];
                }

                return terminalKeys;
            },
        );
    }

    /**
     * Builds an SLR parse table.
     *
     * @param grammar - Augmented BNF grammar.
     * @param analysis - Nullable, FIRST, and FOLLOW analysis for the grammar.
     */
    public static buildSlr(grammar: BnfGrammar, analysis: GrammarAnalysis): LrParseTable
    {
        const itemSets = buildLr0ItemSets(grammar);

        return LrTableBuilder.buildFromLr0ItemSets(
            'slr',
            grammar,
            itemSets,
            (production) =>
            {
                if (production.name === AUGMENTED_START_SYMBOL)
                {
                    return [EOF_TOKEN_NAME];
                }

                return [...analysis.followOfNonTerminal(production.name)];
            },
        );
    }

    /**
     * Builds an LR(1) parse table.
     *
     * @param grammar - Augmented BNF grammar.
     * @param analysis - Nullable, FIRST, and FOLLOW analysis for the grammar.
     */
    public static buildLr1(grammar: BnfGrammar, analysis: GrammarAnalysis): LrParseTable
    {
        const itemSets = buildLr1ItemSets(grammar, analysis, EOF_TOKEN_NAME);

        return LrTableBuilder.buildFromLr1ItemSets(
            'lr1',
            grammar,
            analysis,
            itemSets,
        );
    }

    /**
     * Builds an LALR parse table.
     *
     * @param grammar - Augmented BNF grammar.
     * @param analysis - Nullable, FIRST, and FOLLOW analysis for the grammar.
     */
    public static buildLalr(grammar: BnfGrammar, analysis: GrammarAnalysis): LrParseTable
    {
        const lr1ItemSets = buildLr1ItemSets(grammar, analysis, EOF_TOKEN_NAME);
        const lalrItemSets = mergeLalrItemSets(lr1ItemSets);
        const lr1ToLalr = Lr1ItemSetBuilder.buildLr1ToLalrMap(lr1ItemSets, lalrItemSets);
        const gotoTargets = buildLalrGotoTargets(
            grammar,
            analysis,
            lr1ItemSets,
            lr1ToLalr,
        );

        return LrTableBuilder.buildFromLr1ItemSets(
            'lalr',
            grammar,
            analysis,
            lalrItemSets,
            gotoTargets,
        );
    }

    /**
     * Builds a parse table from LR(0) item sets and a reduce-lookahead rule.
     *
     * @param algorithm - LR algorithm being constructed.
     * @param grammar - Augmented BNF grammar.
     * @param itemSets - Canonical LR(0) item set collection.
     * @param reduceLookaheads - Returns terminal keys for one completed production.
     */
    private static buildFromLr0ItemSets(
        algorithm: LrAlgorithm,
        grammar: BnfGrammar,
        itemSets: Lr0ItemSetCollection,
        reduceLookaheads: (production: NonNullable<ReturnType<BnfGrammar['production']>>) => readonly string[],
    ): LrParseTable
    {
        const gotoTargets = TableBuilderBase.buildGotoTargets(
            grammar,
            itemSets.itemSets,
            (items) => itemSets.indexOf(items),
            TableBuilderBase.lr0GotoItems,
        );
        const actions = new Map<number, Map<string, ParseAction>>();
        const gotos = new Map<number, Map<string, number>>();
        const conflicts: ParseConflict[] = [];

        for (let state = 0; state < itemSets.itemSets.length; state += 1)
        {
            const itemSet = itemSets.itemSets[state] ?? [];
            const stateActions = new Map<string, ParseAction>();
            const stateGotos = new Map<string, number>();
            actions.set(state, stateActions);
            gotos.set(state, stateGotos);

            TableBuilderBase.fillShiftsAndGotos(
                grammar,
                state,
                itemSet,
                gotoTargets,
                stateActions,
                stateGotos,
                conflicts,
            );

            for (const item of itemSet)
            {
                const production = grammar.production(item.productionId);

                if (production === null || item.dot !== production.rhs.length)
                {
                    continue;
                }

                TableBuilderBase.setAcceptAction(
                    state,
                    production.name,
                    stateActions,
                    conflicts,
                );

                if (production.name === AUGMENTED_START_SYMBOL)
                {
                    continue;
                }

                for (const lookahead of reduceLookaheads(production))
                {
                    TableBuilderBase.setAction(
                        stateActions,
                        conflicts,
                        state,
                        lookahead,
                        { kind: 'reduce', productionId: production.id },
                    );
                }
            }
        }

        return new LrParseTable(
            algorithm,
            grammar,
            [...grammar.productions],
            itemSets.itemSets.length,
            actions,
            gotos,
            conflicts,
        );
    }

    /**
     * Builds a parse table from LR(1) or merged LALR item sets.
     *
     * @param algorithm - LR algorithm being constructed.
     * @param grammar - Augmented BNF grammar.
     * @param itemSets - LR(1) or merged LALR item set collection used for ACTION/GOTO rows.
     * @param lr1Collection - Canonical LR(1) collection used for LALR GOTO remapping.
     * @param gotoTargetsOverride - Optional precomputed GOTO indices for LALR.
     */
    private static buildFromLr1ItemSets(
        algorithm: LrAlgorithm,
        grammar: BnfGrammar,
        analysis: GrammarAnalysis,
        itemSets: Lr1ItemSetCollection,
        gotoTargetsOverride?: ReadonlyMap<string, number>,
    ): LrParseTable
    {
        const gotoTargets = gotoTargetsOverride ?? TableBuilderBase.buildGotoTargets(
            grammar,
            itemSets.itemSets as readonly (readonly Lr0Item[])[],
            (items) => itemSets.indexOf(items as readonly Lr1Item[]),
            (grammarArg, items, symbolKey) =>
                lr1Goto(grammarArg, analysis, items as readonly Lr1Item[], symbolKey),
        );
        const actions = new Map<number, Map<string, ParseAction>>();
        const gotos = new Map<number, Map<string, number>>();
        const conflicts: ParseConflict[] = [];

        for (let state = 0; state < itemSets.itemSets.length; state += 1)
        {
            const itemSet = itemSets.itemSets[state] ?? [];
            const stateActions = new Map<string, ParseAction>();
            const stateGotos = new Map<string, number>();
            actions.set(state, stateActions);
            gotos.set(state, stateGotos);

            TableBuilderBase.fillShiftsAndGotos(
                grammar,
                state,
                itemSet as readonly Lr0Item[],
                gotoTargets,
                stateActions,
                stateGotos,
                conflicts,
            );

            for (const item of itemSet)
            {
                const production = grammar.production(item.productionId);

                if (production === null || item.dot !== production.rhs.length)
                {
                    continue;
                }

                if (production.name === AUGMENTED_START_SYMBOL)
                {
                    TableBuilderBase.setAction(
                        stateActions,
                        conflicts,
                        state,
                        item.lookahead,
                        { kind: 'accept' },
                    );
                    continue;
                }

                TableBuilderBase.setAction(
                    stateActions,
                    conflicts,
                    state,
                    item.lookahead,
                    { kind: 'reduce', productionId: production.id },
                );
            }
        }

        return new LrParseTable(
            algorithm,
            grammar,
            [...grammar.productions],
            itemSets.itemSets.length,
            actions,
            gotos,
            conflicts,
        );
    }
}
