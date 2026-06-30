import type { GrammarAnalysis } from '../analysis/first-follow.js';
import type { BnfGrammar } from '../bnf/bnf-grammar.js';
import { bnfParserSymbolKey, type BnfSymbol } from '../bnf/bnf-symbol.js';
import type { Lr0Item } from '../lr0/lr0-item-set.js';
import { sortLr0Items, symbolsAfterDot } from '../lr0/lr0-item-set.js';
import { TableBuilderBase } from '../table/table-builder-base.js';

/**
 * One LR(1) item: a dotted production with a single lookahead terminal.
 */
export interface Lr1Item
{
    /** Stable production id assigned during BNF desugaring. */
    readonly productionId: number;

    /** Number of right-hand side symbols before the dot. */
    readonly dot: number;

    /** Encoded terminal key governing reduce and shift in this state. */
    readonly lookahead: string;
}

/**
 * Returns whether two LR(1) items are identical.
 *
 * @param left - First item.
 * @param right - Second item.
 * @returns True when production id, dot, and lookahead match.
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
 * @returns A new array sorted by production id, dot, then lookahead.
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
 * @returns A string `productionId:dot` shared by all lookaheads at the same dot position.
 */
export function lr1CoreKey(item: Lr1Item): string
{
    return `${String(item.productionId)}:${String(item.dot)}`;
}

/**
 * Returns a stable identity string for one LR(1) item.
 *
 * @param item - Item to encode.
 * @returns A string `productionId:dot:lookahead` for set membership tests.
 */
export function lr1ItemIdentity(item: Lr1Item): string
{
    return `${lr1CoreKey(item)}:${item.lookahead}`;
}

/**
 * Returns a stable identity string for an LR(1) item set.
 *
 * @param items - Closed item set.
 * @param alreadySorted - When true, skips re-sorting because items are canonical.
 * @returns A pipe-separated, sorted identity string for canonical set comparison.
 */
export function lr1SetIdentity(items: readonly Lr1Item[], alreadySorted = false): string
{
    const sorted = alreadySorted ? items : sortLr1Items(items);

    return sorted
        .map((item) => lr1ItemIdentity(item))
        .join('|');
}

/**
 * Returns the LR(0) core identity for an LR(1) item set.
 *
 * @param items - LR(1) item set.
 * @returns A pipe-separated, sorted string of LR(0) cores with lookaheads removed.
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
 * @returns Terminal keys that may follow the dotted non-terminal in this item.
 */
export function firstAfterSymbols(
    beta: readonly BnfSymbol[],
    lookahead: string,
    analysis: GrammarAnalysis,
): ReadonlySet<string>
{
    const result = new Set<string>();

    // Accumulate FIRST of each prefix symbol until a non-nullable symbol stops propagation.
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

    // Every symbol in β is nullable, so the item's own lookahead is reachable.
    result.add(lookahead);

    return result;
}

/**
 * Computes the LR(1) closure of an item set.
 *
 * @param grammar - Augmented BNF grammar.
 * @param analysis - Nullable and FIRST analysis for the grammar.
 * @param items - Seed items.
 * @returns The seed items plus all items implied by dotted non-terminal prefixes.
 */
export function lr1Closure(
    grammar: BnfGrammar,
    analysis: GrammarAnalysis,
    items: readonly Lr1Item[],
): readonly Lr1Item[]
{
    const result = sortLr1Items(items);
    const itemKeys = new Set(result.map((item) => lr1ItemIdentity(item)));
    const pendingIndices: number[] = result.map((_, index) => index);

    // Expand closure from each newly discovered item only.
    while (pendingIndices.length > 0)
    {
        const item = result[pendingIndices.pop()!]!;
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

        // For each production of the non-terminal after the dot, propagate lookaheads.
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
                    pendingIndices.push(result.length);
                    result.push(closureItem);
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
 * @returns The closed item set reached after advancing the dot past `symbolKey`.
 */
export function lr1Goto(
    grammar: BnfGrammar,
    analysis: GrammarAnalysis,
    items: readonly Lr1Item[],
    symbolKey: string,
): readonly Lr1Item[]
{
    const moved: Lr1Item[] = [];

    // Advance the dot on every item expecting `symbolKey`, preserving lookaheads.
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
    private readonly indexByIdentity: ReadonlyMap<string, number>;

    /**
     * Creates a collection from an ordered list of closed item sets.
     *
     * @param grammar - Grammar the item sets were built from.
     * @param itemSets - Closed LR(1) item sets in discovery order.
     * @param indexByIdentity - Optional precomputed identity-to-state map.
     */
    public constructor(
        /** Grammar analyzed when the item sets were constructed. */
        public readonly grammar: BnfGrammar,
        /** Closed LR(1) item sets indexed by parser state number. */
        public readonly itemSets: readonly (readonly Lr1Item[])[],
        indexByIdentity?: ReadonlyMap<string, number>,
    )
    {
        if (indexByIdentity !== undefined)
        {
            this.indexByIdentity = indexByIdentity;
            return;
        }

        const builtIndex = new Map<string, number>();

        for (let index = 0; index < itemSets.length; index += 1)
        {
            builtIndex.set(lr1SetIdentity(itemSets[index] ?? [], true), index);
        }

        this.indexByIdentity = builtIndex;
    }

    /**
     * Returns the index of an item set matching `items`, or null when absent.
     *
     * @param items - Closed item set to locate.
     * @returns State index, or null when no set has the same canonical identity.
     */
    public indexOf(items: readonly Lr1Item[]): number | null
    {
        return this.indexByIdentity.get(lr1SetIdentity(items, true)) ?? null;
    }

    /**
     * Returns LR(0) items derived from one LR(1) item set.
     *
     * @param items - LR(1) item set.
     * @returns Deduplicated LR(0) cores with lookaheads stripped.
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
     * @returns The canonical LR(1) item set collection for the grammar.
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

        // Seed state 0 from the augmented start production and its initial lookahead.
        const initial = lr1Closure(grammar, analysis, [{
            productionId: startProductions[0].id,
            dot: 0,
            lookahead: startLookahead,
        }]);
        const itemSets: Lr1Item[][] = [[...initial]];
        const indexByIdentity = new Map<string, number>([
            [lr1SetIdentity(initial, true), 0],
        ]);
        const pendingStates: number[] = [0];

        // Discover new states from each state exactly once.
        while (pendingStates.length > 0)
        {
            const stateIndex = pendingStates.pop()!;
            const itemSet = itemSets[stateIndex] ?? [];

            for (const symbolKey of symbolsAfterDot(grammar, itemSet))
            {
                const gotoSet = lr1Goto(grammar, analysis, itemSet, symbolKey);

                if (gotoSet.length === 0)
                {
                    continue;
                }

                const gotoKey = lr1SetIdentity(gotoSet, true);

                if (!indexByIdentity.has(gotoKey))
                {
                    const nextIndex = itemSets.length;
                    indexByIdentity.set(gotoKey, nextIndex);
                    itemSets.push([...gotoSet]);
                    pendingStates.push(nextIndex);
                }
            }
        }

        return new Lr1ItemSetCollection(grammar, itemSets, indexByIdentity);
    }
}

/**
 * Builds the canonical LR(1) item set collection for a grammar.
 *
 * @param grammar - Augmented BNF grammar.
 * @param analysis - Nullable and FIRST analysis for the grammar.
 * @param startLookahead - Lookahead terminal for the initial item.
 * @returns The canonical LR(1) item set collection for the grammar.
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
 * @returns A new collection with LR(1) states merged by LR(0) core.
 */
export function mergeLalrItemSets(collection: Lr1ItemSetCollection): Lr1ItemSetCollection
{
    const coreToLalrIndex = new Map<string, number>();
    const lr1ToLalr = new Map<number, number>();
    const mergedItemSets: Lr1Item[][] = [];

    // Assign each LR(1) state to an LALR state keyed by its LR(0) core identity.
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
 * @returns Map from `state:symbol` keys to LALR GOTO target state indices.
 */
export function buildLalrGotoTargets(
    grammar: BnfGrammar,
    analysis: GrammarAnalysis,
    lr1Collection: Lr1ItemSetCollection,
    lr1ToLalr: ReadonlyMap<number, number>,
): ReadonlyMap<string, number>
{
    const targets = new Map<string, number>();

    // Recompute LR(1) GOTOs and remap each target through the LR(1) → LALR index map.
    for (let lr1State = 0; lr1State < lr1Collection.itemSets.length; lr1State += 1)
    {
        const lalrState = lr1ToLalr.get(lr1State);

        if (lalrState === undefined)
        {
            continue;
        }

        const itemSet = lr1Collection.itemSets[lr1State] ?? [];

        for (const symbolKey of symbolsAfterDot(grammar, itemSet))
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
     * @returns Items with lookaheads unioned for each shared LR(0) core.
     */
    export function mergeItems(left: readonly Lr1Item[], right: readonly Lr1Item[]): Lr1Item[]
    {
        const lookaheadsByCore = new Map<string, Set<string>>();

        // Collect every lookahead grouped by dotted-production core.
        for (const item of [...left, ...right])
        {
            const core = lr1CoreKey(item);
            const lookaheads = lookaheadsByCore.get(core) ?? new Set<string>();
            lookaheads.add(item.lookahead);
            lookaheadsByCore.set(core, lookaheads);
        }

        const merged: Lr1Item[] = [];

        // Expand each core into one item per distinct lookahead.
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
     * @returns Map from LR(1) state index to merged LALR state index.
     */
    export function buildLr1ToLalrMap(
        lr1Collection: Lr1ItemSetCollection,
        lalrCollection: Lr1ItemSetCollection,
    ): Map<number, number>
    {
        const coreToLalrIndex = new Map<string, number>();

        // Index LALR states by their LR(0) core identity.
        for (let lalrIndex = 0; lalrIndex < lalrCollection.itemSets.length; lalrIndex += 1)
        {
            coreToLalrIndex.set(
                lr1CoreSetIdentity(lalrCollection.itemSets[lalrIndex] ?? []),
                lalrIndex,
            );
        }

        const lr1ToLalr = new Map<number, number>();

        // Map each LR(1) state to the LALR state sharing its core.
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
