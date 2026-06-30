import type { BnfGrammar } from '../bnf/bnf-grammar.js';
import { bnfParserSymbolKey, bnfSymbolKey } from '../bnf/bnf-symbol.js';

/**
 * One LR(0) item: a production with the dot before `dot` right-hand side symbols.
 */
export interface Lr0Item
{
    /** Stable production id assigned during BNF desugaring. */
    readonly productionId: number;

    /** Number of right-hand side symbols before the dot. */
    readonly dot: number;
}

/**
 * Returns a stable string key for an LR(0) item.
 *
 * @param grammar - Grammar containing the referenced production.
 * @param item - LR(0) item to encode.
 * @returns A human-readable dotted production string for diagnostics.
 */
export function lr0ItemKey(grammar: BnfGrammar, item: Lr0Item): string
{
    const production = grammar.production(item.productionId);

    if (production === null)
    {
        return `${String(item.productionId)}@${String(item.dot)}`;
    }

    const rhs = production.rhs.map((symbol) => bnfSymbolKey(symbol));
    const before = rhs.slice(0, item.dot).join(' ');
    const after = rhs.slice(item.dot).join(' ');

    if (before.length === 0)
    {
        return `${production.name} → · ${after}`.trimEnd();
    }

    if (after.length === 0)
    {
        return `${production.name} → ${before} ·`;
    }

    return `${production.name} → ${before} · ${after}`;
}

/**
 * Returns whether two LR(0) items are identical.
 *
 * @param left - First item.
 * @param right - Second item.
 */
export function lr0ItemsEqual(left: Lr0Item, right: Lr0Item): boolean
{
    return left.productionId === right.productionId && left.dot === right.dot;
}

/**
 * Sorts LR(0) items for canonical set comparison.
 *
 * @param items - Items to sort.
 */
export function sortLr0Items(items: readonly Lr0Item[]): Lr0Item[]
{
    return [...items].sort((left, right) =>
    {
        if (left.productionId !== right.productionId)
        {
            return left.productionId - right.productionId;
        }

        return left.dot - right.dot;
    });
}

/**
 * Returns encoded symbol keys that appear immediately after the dot in an item set.
 *
 * @param grammar - BNF grammar containing referenced productions.
 * @param items - Closed item set.
 * @returns Sorted terminal and non-terminal keys eligible for GOTO from this state.
 */
export function symbolsAfterDot(
    grammar: BnfGrammar,
    items: readonly Lr0Item[],
): readonly string[]
{
    const keys = new Set<string>();

    for (const item of items)
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

        keys.add(bnfParserSymbolKey(nextSymbol));
    }

    return [...keys].sort();
}

/**
 * Computes the LR(0) closure of an item set.
 *
 * @param grammar - Plain or augmented BNF grammar.
 * @param items - Seed items.
 * @returns The seed items plus all items implied by dotted non-terminal prefixes.
 */
export function lr0Closure(grammar: BnfGrammar, items: readonly Lr0Item[]): readonly Lr0Item[]
{
    const result = sortLr0Items(items);
    const itemKeys = new Set(result.map((item) => Lr0ItemSetBuilder.itemIdentity(item)));
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

        for (const candidate of grammar.productionsFor(nextSymbol.name))
        {
            const closureItem: Lr0Item = {
                productionId: candidate.id,
                dot: 0,
            };
            const identity = Lr0ItemSetBuilder.itemIdentity(closureItem);

            if (!itemKeys.has(identity))
            {
                itemKeys.add(identity);
                pendingIndices.push(result.length);
                result.push(closureItem);
            }
        }
    }

    return sortLr0Items(result);
}

/**
 * Computes the LR(0) GOTO set for symbol `symbolKey`.
 *
 * @param grammar - Plain or augmented BNF grammar.
 * @param items - Closed item set.
 * @param symbolKey - Encoded terminal or non-terminal symbol.
 * @returns The closed item set reached after advancing the dot past `symbolKey`.
 */
export function lr0Goto(
    grammar: BnfGrammar,
    items: readonly Lr0Item[],
    symbolKey: string,
): readonly Lr0Item[]
{
    const moved: Lr0Item[] = [];

    // Advance the dot on every item expecting `symbolKey`.
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
        });
    }

    if (moved.length === 0)
    {
        return [];
    }

    return lr0Closure(grammar, moved);
}

/**
 * Canonical collection of LR(0) item sets for a BNF grammar.
 */
export class Lr0ItemSetCollection
{
    private readonly indexByIdentity: ReadonlyMap<string, number>;

    /**
     * Creates a collection from an ordered list of closed item sets.
     *
     * @param grammar - Grammar the item sets were built from.
     * @param itemSets - Closed LR(0) item sets in discovery order.
     * @param indexByIdentity - Optional precomputed identity-to-state map.
     */
    public constructor(
        /** Grammar analyzed when the item sets were constructed. */
        public readonly grammar: BnfGrammar,
        /** Closed LR(0) item sets indexed by parser state number. */
        public readonly itemSets: readonly (readonly Lr0Item[])[],
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
            builtIndex.set(
                Lr0ItemSetBuilder.setIdentity(itemSets[index] ?? [], true),
                index,
            );
        }

        this.indexByIdentity = builtIndex;
    }

    /**
     * Returns the index of an item set matching `items`, or null when absent.
     *
     * @param items - Closed item set to locate.
     */
    public indexOf(items: readonly Lr0Item[]): number | null
    {
        const target = Lr0ItemSetBuilder.setIdentity(items, true);

        return this.indexByIdentity.get(target) ?? null;
    }
}

/**
 * Builds LR(0) item sets for a BNF grammar.
 */
export class Lr0ItemSetBuilder
{
    /**
     * Builds the canonical LR(0) collection for a grammar.
     *
     * @param grammar - Augmented or plain BNF grammar.
     * @returns The canonical LR(0) item set collection for the grammar.
     */
    public static build(grammar: BnfGrammar): Lr0ItemSetCollection
    {
        const startProductions = grammar.productionsFor(grammar.startSymbol);

        if (startProductions.length === 0)
        {
            return new Lr0ItemSetCollection(grammar, []);
        }

        // Seed state 0 from the start production at dot zero.
        const initial = lr0Closure(grammar, [{
            productionId: startProductions[0].id,
            dot: 0,
        }]);
        const itemSets: Lr0Item[][] = [[...initial]];
        const indexByIdentity = new Map<string, number>([
            [Lr0ItemSetBuilder.setIdentity(initial, true), 0],
        ]);
        const pendingStates: number[] = [0];

        // Discover new states from each state exactly once.
        while (pendingStates.length > 0)
        {
            const stateIndex = pendingStates.pop()!;
            const itemSet = itemSets[stateIndex] ?? [];

            for (const symbolKey of symbolsAfterDot(grammar, itemSet))
            {
                const gotoSet = lr0Goto(grammar, itemSet, symbolKey);

                if (gotoSet.length === 0)
                {
                    continue;
                }

                const gotoKey = Lr0ItemSetBuilder.setIdentity(gotoSet, true);

                if (!indexByIdentity.has(gotoKey))
                {
                    const nextIndex = itemSets.length;
                    indexByIdentity.set(gotoKey, nextIndex);
                    itemSets.push([...gotoSet]);
                    pendingStates.push(nextIndex);
                }
            }
        }

        return new Lr0ItemSetCollection(grammar, itemSets, indexByIdentity);
    }

    /**
     * Returns every terminal and non-terminal key that can appear in GOTO.
     *
     * @param grammar - BNF grammar to inspect.
     */
    public static grammarSymbolKeys(grammar: BnfGrammar): readonly string[]
    {
        const keys = new Set<string>(grammar.terminalKeys());

        for (const name of grammar.nonTerminalNames())
        {
            keys.add(name);
        }

        return [...keys].sort();
    }

    /**
     * Returns a stable identity string for one LR(0) item.
     *
     * @param item - Item to encode.
     */
    public static itemIdentity(item: Lr0Item): string
    {
        return `${String(item.productionId)}:${String(item.dot)}`;
    }

    /**
     * Returns a stable identity string for an item set.
     *
     * @param items - Closed item set.
     * @param alreadySorted - When true, skips re-sorting because items are canonical.
     */
    public static setIdentity(items: readonly Lr0Item[], alreadySorted = false): string
    {
        const sorted = alreadySorted ? items : sortLr0Items(items);

        return sorted
            .map((item) => Lr0ItemSetBuilder.itemIdentity(item))
            .join('|');
    }
}

/**
 * Builds the canonical LR(0) item set collection for a grammar.
 *
 * @param grammar - Augmented or plain BNF grammar.
 * @returns The canonical LR(0) item set collection for the grammar.
 */
export function buildLr0ItemSets(grammar: BnfGrammar): Lr0ItemSetCollection
{
    return Lr0ItemSetBuilder.build(grammar);
}

/**
 * Returns readable item set labels for tests and diagnostics.
 *
 * @param grammar - Grammar containing referenced productions.
 * @param items - Closed item set.
 */
export function formatLr0ItemSet(grammar: BnfGrammar, items: readonly Lr0Item[]): readonly string[]
{
    return sortLr0Items(items).map((item) => lr0ItemKey(grammar, item));
}
