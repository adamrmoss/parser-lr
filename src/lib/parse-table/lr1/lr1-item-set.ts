import type { GrammarAnalysis } from '../analysis/first-follow.js';
import type { BnfGrammar } from '../bnf/bnf-grammar.js';
import { bnfParserSymbolKey, type BnfSymbol } from '../bnf/bnf-symbol.js';
import type { Lr0Item } from '../lr0/lr0-item-set.js';
import { sortLr0Items } from '../lr0/lr0-item-set.js';
import { TableBuilderBase } from '../table/table-builder-base.js';

/**
 * One LR(1) item: a dotted production with a single lookahead terminal.
 */
export interface Lr1Item
{
    readonly productionId: number;
    readonly dot: number;
    readonly lookahead: string;
}

/**
 * Returns whether two LR(1) items are identical.
 *
 * @param left - First item.
 * @param right - Second item.
 */
export function lr1ItemsEqual(left: Lr1Item, right: Lr1Item): boolean
{
    return left.productionId === right.productionId
        && left.dot === right.dot
        && left.lookahead === right.lookahead;
}

/**
 * Sorts LR(1) items for canonical set comparison.
 *
 * @param items - Items to sort.
 */
export function sortLr1Items(items: readonly Lr1Item[]): Lr1Item[]
{
    return [...items].sort((left, right) =>
    {
        if (left.productionId !== right.productionId)
        {
            return left.productionId - right.productionId;
        }

        if (left.dot !== right.dot)
        {
            return left.dot - right.dot;
        }

        return left.lookahead.localeCompare(right.lookahead);
    });
}

/**
 * Returns the LR(0) core key for one LR(1) item.
 *
 * @param item - LR(1) item to encode.
 */
export function lr1CoreKey(item: Lr1Item): string
{
    return `${String(item.productionId)}:${String(item.dot)}`;
}

/**
 * Returns a stable identity string for one LR(1) item.
 *
 * @param item - Item to encode.
 */
export function lr1ItemIdentity(item: Lr1Item): string
{
    return `${lr1CoreKey(item)}:${item.lookahead}`;
}

/**
 * Returns a stable identity string for an LR(1) item set.
 *
 * @param items - Closed item set.
 */
export function lr1SetIdentity(items: readonly Lr1Item[]): string
{
    return sortLr1Items(items)
        .map((item) => lr1ItemIdentity(item))
        .join('|');
}

/**
 * Returns the LR(0) core identity for an LR(1) item set.
 *
 * @param items - LR(1) item set.
 */
export function lr1CoreSetIdentity(items: readonly Lr1Item[]): string
{
    const cores = new Set(items.map((item) => lr1CoreKey(item)));

    return [...cores].sort().join('|');
}

/**
 * Computes FIRST(β) ∪ { lookahead } when every symbol in β is nullable.
 *
 * @param beta - Remaining right-hand side symbols after a non-terminal.
 * @param lookahead - Lookahead terminal following β.
 * @param analysis - Nullable and FIRST analysis for the grammar.
 */
export function firstAfterSymbols(
    beta: readonly BnfSymbol[],
    lookahead: string,
    analysis: GrammarAnalysis,
): ReadonlySet<string>
{
    const result = new Set<string>();

    for (const symbol of beta)
    {
        for (const terminal of analysis.firstOfSymbol(symbol))
        {
            result.add(terminal);
        }

        if (!analysis.isSymbolNullable(symbol))
        {
            return result;
        }
    }

    result.add(lookahead);

    return result;
}

/**
 * Computes the LR(1) closure of an item set.
 *
 * @param grammar - Augmented BNF grammar.
 * @param analysis - Nullable and FIRST analysis for the grammar.
 * @param items - Seed items.
 */
export function lr1Closure(
    grammar: BnfGrammar,
    analysis: GrammarAnalysis,
    items: readonly Lr1Item[],
): readonly Lr1Item[]
{
    const result = sortLr1Items(items);
    const itemKeys = new Set(result.map((item) => lr1ItemIdentity(item)));
    let changed = true;

    while (changed)
    {
        changed = false;

        for (const item of [...result])
        {
            const production = grammar.production(item.productionId);

            if (production === null)
            {
                continue;
            }

            const nextSymbol = production.rhs[item.dot];

            if (nextSymbol === undefined || nextSymbol.kind !== 'nonTerminal')
            {
                continue;
            }

            const beta = production.rhs.slice(item.dot + 1);

            for (const candidate of grammar.productionsFor(nextSymbol.name))
            {
                for (const lookahead of firstAfterSymbols(beta, item.lookahead, analysis))
                {
                    const closureItem: Lr1Item = {
                        productionId: candidate.id,
                        dot: 0,
                        lookahead,
                    };
                    const identity = lr1ItemIdentity(closureItem);

                    if (!itemKeys.has(identity))
                    {
                        itemKeys.add(identity);
                        result.push(closureItem);
                        changed = true;
                    }
                }
            }
        }
    }

    return sortLr1Items(result);
}

/**
 * Computes the LR(1) GOTO set for symbol `symbolKey`.
 *
 * @param grammar - Augmented BNF grammar.
 * @param analysis - Nullable and FIRST analysis for the grammar.
 * @param items - Closed item set.
 * @param symbolKey - Encoded terminal or non-terminal symbol.
 */
export function lr1Goto(
    grammar: BnfGrammar,
    analysis: GrammarAnalysis,
    items: readonly Lr1Item[],
    symbolKey: string,
): readonly Lr1Item[]
{
    const moved: Lr1Item[] = [];

    for (const item of items)
    {
        const production = grammar.production(item.productionId);

        if (production === null)
        {
            continue;
        }

        const nextSymbol = production.rhs[item.dot];

        if (nextSymbol === undefined || bnfParserSymbolKey(nextSymbol) !== symbolKey)
        {
            continue;
        }

        moved.push({
            productionId: item.productionId,
            dot: item.dot + 1,
            lookahead: item.lookahead,
        });
    }

    if (moved.length === 0)
    {
        return [];
    }

    return lr1Closure(grammar, analysis, moved);
}

/**
 * Canonical collection of LR(1) item sets for a BNF grammar.
 */
export class Lr1ItemSetCollection
{
    /**
     * Creates a collection from an ordered list of closed item sets.
     *
     * @param grammar - Grammar the item sets were built from.
     * @param itemSets - Closed LR(1) item sets in discovery order.
     */
    public constructor(
        public readonly grammar: BnfGrammar,
        public readonly itemSets: readonly (readonly Lr1Item[])[],
    )
    {
    }

    /**
     * Returns the index of an item set matching `items`, or null when absent.
     *
     * @param items - Closed item set to locate.
     */
    public indexOf(items: readonly Lr1Item[]): number | null
    {
        const target = lr1SetIdentity(items);

        for (let index = 0; index < this.itemSets.length; index += 1)
        {
            if (lr1SetIdentity(this.itemSets[index]) === target)
            {
                return index;
            }
        }

        return null;
    }

    /**
     * Returns LR(0) items derived from one LR(1) item set.
     *
     * @param items - LR(1) item set.
     */
    public static lr0Core(items: readonly Lr1Item[]): readonly Lr0Item[]
    {
        const cores = new Map<string, Lr0Item>();

        for (const item of items)
        {
            cores.set(lr1CoreKey(item), {
                productionId: item.productionId,
                dot: item.dot,
            });
        }

        return sortLr0Items([...cores.values()]);
    }
}

/**
 * Builds LR(1) item sets for a BNF grammar.
 */
export class Lr1ItemSetBuilder
{
    /**
     * Builds the canonical LR(1) collection for a grammar.
     *
     * @param grammar - Augmented BNF grammar.
     * @param analysis - Nullable and FIRST analysis for the grammar.
     * @param startLookahead - Lookahead terminal for the initial item.
     */
    public static build(
        grammar: BnfGrammar,
        analysis: GrammarAnalysis,
        startLookahead: string,
    ): Lr1ItemSetCollection
    {
        const startProductions = grammar.productionsFor(grammar.startSymbol);

        if (startProductions.length === 0)
        {
            return new Lr1ItemSetCollection(grammar, []);
        }

        const initial = lr1Closure(grammar, analysis, [{
            productionId: startProductions[0].id,
            dot: 0,
            lookahead: startLookahead,
        }]);
        const itemSets: Lr1Item[][] = [[...initial]];
        const itemSetKeys = new Map<string, number>([
            [lr1SetIdentity(initial), 0],
        ]);
        const symbols = grammar.terminalKeys().concat(grammar.nonTerminalNames()).sort();
        let changed = true;

        while (changed)
        {
            changed = false;

            for (const itemSet of [...itemSets])
            {
                for (const symbolKey of symbols)
                {
                    const gotoSet = lr1Goto(grammar, analysis, itemSet, symbolKey);

                    if (gotoSet.length === 0)
                    {
                        continue;
                    }

                    const gotoKey = lr1SetIdentity(gotoSet);
                    const existingIndex = itemSetKeys.get(gotoKey);

                    if (existingIndex === undefined)
                    {
                        const nextIndex = itemSets.length;
                        itemSetKeys.set(gotoKey, nextIndex);
                        itemSets.push([...gotoSet]);
                        changed = true;
                    }
                }
            }
        }

        return new Lr1ItemSetCollection(grammar, itemSets);
    }
}

/**
 * Builds the canonical LR(1) item set collection for a grammar.
 *
 * @param grammar - Augmented BNF grammar.
 * @param analysis - Nullable and FIRST analysis for the grammar.
 * @param startLookahead - Lookahead terminal for the initial item.
 */
export function buildLr1ItemSets(
    grammar: BnfGrammar,
    analysis: GrammarAnalysis,
    startLookahead: string,
): Lr1ItemSetCollection
{
    return Lr1ItemSetBuilder.build(grammar, analysis, startLookahead);
}

/**
 * Merges LR(1) item sets that share the same LR(0) core into LALR item sets.
 *
 * @param collection - Canonical LR(1) item set collection.
 */
export function mergeLalrItemSets(collection: Lr1ItemSetCollection): Lr1ItemSetCollection
{
    const coreToLalrIndex = new Map<string, number>();
    const lr1ToLalr = new Map<number, number>();
    const mergedItemSets: Lr1Item[][] = [];

    for (let lr1Index = 0; lr1Index < collection.itemSets.length; lr1Index += 1)
    {
        const itemSet = collection.itemSets[lr1Index] ?? [];
        const core = lr1CoreSetIdentity(itemSet);
        let lalrIndex = coreToLalrIndex.get(core);

        if (lalrIndex === undefined)
        {
            lalrIndex = mergedItemSets.length;
            coreToLalrIndex.set(core, lalrIndex);
            mergedItemSets.push([]);
        }

        lr1ToLalr.set(lr1Index, lalrIndex);
        mergedItemSets[lalrIndex] = Lr1ItemSetBuilder.mergeItems(
            mergedItemSets[lalrIndex] ?? [],
            itemSet,
        );
    }

    const remappedItemSets = mergedItemSets.map((itemSet) => sortLr1Items(itemSet));

    return new Lr1ItemSetCollection(collection.grammar, remappedItemSets);
}

/**
 * Builds LALR GOTO target indices from an LR(1) collection and merged LALR states.
 *
 * @param grammar - Augmented BNF grammar.
 * @param analysis - Nullable and FIRST analysis for the grammar.
 * @param lr1Collection - Canonical LR(1) item set collection.
 * @param lalrCollection - Merged LALR item set collection.
 * @param lr1ToLalr - LR(1) state index to LALR state index map.
 */
export function buildLalrGotoTargets(
    grammar: BnfGrammar,
    analysis: GrammarAnalysis,
    lr1Collection: Lr1ItemSetCollection,
    lr1ToLalr: ReadonlyMap<number, number>,
): ReadonlyMap<string, number>
{
    const targets = new Map<string, number>();
    const symbols = grammar.terminalKeys().concat(grammar.nonTerminalNames()).sort();

    for (let lr1State = 0; lr1State < lr1Collection.itemSets.length; lr1State += 1)
    {
        const lalrState = lr1ToLalr.get(lr1State);

        if (lalrState === undefined)
        {
            continue;
        }

        const itemSet = lr1Collection.itemSets[lr1State] ?? [];

        for (const symbolKey of symbols)
        {
            const gotoSet = lr1Goto(grammar, analysis, itemSet, symbolKey);

            if (gotoSet.length === 0)
            {
                continue;
            }

            const lr1Target = lr1Collection.indexOf(gotoSet);

            if (lr1Target === null)
            {
                continue;
            }

            const lalrTarget = lr1ToLalr.get(lr1Target);

            if (lalrTarget === undefined)
            {
                continue;
            }

            targets.set(TableBuilderBase.gotoKey(lalrState, symbolKey), lalrTarget);
        }
    }

    return targets;
}

/**
 * Merges lookaheads for LR(1) items sharing the same LR(0) core.
 */
export namespace Lr1ItemSetBuilder
{
    /**
     * Unions lookaheads for items with the same dotted production.
     *
     * @param left - Existing merged item set.
     * @param right - Additional LR(1) item set to merge in.
     */
    export function mergeItems(left: readonly Lr1Item[], right: readonly Lr1Item[]): Lr1Item[]
    {
        const lookaheadsByCore = new Map<string, Set<string>>();

        for (const item of [...left, ...right])
        {
            const core = lr1CoreKey(item);
            const lookaheads = lookaheadsByCore.get(core) ?? new Set<string>();
            lookaheads.add(item.lookahead);
            lookaheadsByCore.set(core, lookaheads);
        }

        const merged: Lr1Item[] = [];

        for (const [core, lookaheads] of lookaheadsByCore.entries())
        {
            const [productionIdText, dotText] = core.split(':');
            const productionId = Number(productionIdText);
            const dot = Number(dotText);

            for (const lookahead of [...lookaheads].sort())
            {
                merged.push({
                    productionId,
                    dot,
                    lookahead,
                });
            }
        }

        return sortLr1Items(merged);
    }

    /**
     * Builds the LR(1) to LALR state index map for merged item sets.
     *
     * @param lr1Collection - Canonical LR(1) item set collection.
     * @param lalrCollection - Merged LALR item set collection.
     */
    export function buildLr1ToLalrMap(
        lr1Collection: Lr1ItemSetCollection,
        lalrCollection: Lr1ItemSetCollection,
    ): Map<number, number>
    {
        const coreToLalrIndex = new Map<string, number>();

        for (let lalrIndex = 0; lalrIndex < lalrCollection.itemSets.length; lalrIndex += 1)
        {
            coreToLalrIndex.set(
                lr1CoreSetIdentity(lalrCollection.itemSets[lalrIndex] ?? []),
                lalrIndex,
            );
        }

        const lr1ToLalr = new Map<number, number>();

        for (let lr1Index = 0; lr1Index < lr1Collection.itemSets.length; lr1Index += 1)
        {
            const core = lr1CoreSetIdentity(lr1Collection.itemSets[lr1Index] ?? []);
            const lalrIndex = coreToLalrIndex.get(core);

            if (lalrIndex !== undefined)
            {
                lr1ToLalr.set(lr1Index, lalrIndex);
            }
        }

        return lr1ToLalr;
    }
}
