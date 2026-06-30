import type { BnfGrammar } from '../bnf/bnf-grammar.js';
import { bnfParserSymbolKey, bnfSymbolKey } from '../bnf/bnf-symbol.js';

/**
 * One LR(0) item: a production with the dot before `dot` right-hand side symbols.
 */
export interface Lr0Item
{
    readonly productionId: number;
    readonly dot: number;
}

/**
 * Returns a stable string key for an LR(0) item.
 *
 * @param grammar - Grammar containing the referenced production.
 * @param item - LR(0) item to encode.
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
 * Computes the LR(0) closure of an item set.
 *
 * @param grammar - Plain or augmented BNF grammar.
 * @param items - Seed items.
 */
export function lr0Closure(grammar: BnfGrammar, items: readonly Lr0Item[]): readonly Lr0Item[]
{
    const result = sortLr0Items(items);
    const itemKeys = new Set(result.map((item) => Lr0ItemSetBuilder.itemIdentity(item)));
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
                    result.push(closureItem);
                    changed = true;
                }
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
 */
export function lr0Goto(
    grammar: BnfGrammar,
    items: readonly Lr0Item[],
    symbolKey: string,
): readonly Lr0Item[]
{
    const moved: Lr0Item[] = [];

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
    /**
     * Creates a collection from an ordered list of closed item sets.
     *
     * @param grammar - Grammar the item sets were built from.
     * @param itemSets - Closed LR(0) item sets in discovery order.
     */
    public constructor(
        public readonly grammar: BnfGrammar,
        public readonly itemSets: readonly (readonly Lr0Item[])[],
    )
    {
    }

    /**
     * Returns the index of an item set matching `items`, or null when absent.
     *
     * @param items - Closed item set to locate.
     */
    public indexOf(items: readonly Lr0Item[]): number | null
    {
        const target = Lr0ItemSetBuilder.setIdentity(items);

        for (let index = 0; index < this.itemSets.length; index += 1)
        {
            if (Lr0ItemSetBuilder.setIdentity(this.itemSets[index]) === target)
            {
                return index;
            }
        }

        return null;
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
     */
    public static build(grammar: BnfGrammar): Lr0ItemSetCollection
    {
        const startProductions = grammar.productionsFor(grammar.startSymbol);

        if (startProductions.length === 0)
        {
            return new Lr0ItemSetCollection(grammar, []);
        }

        const initial = lr0Closure(grammar, [{
            productionId: startProductions[0].id,
            dot: 0,
        }]);
        const itemSets: Lr0Item[][] = [[...initial]];
        const itemSetKeys = new Map<string, number>([
            [Lr0ItemSetBuilder.setIdentity(initial), 0],
        ]);
        const symbols = Lr0ItemSetBuilder.grammarSymbolKeys(grammar);
        let changed = true;

        while (changed)
        {
            changed = false;

            for (const itemSet of [...itemSets])
            {
                for (const symbolKey of symbols)
                {
                    const gotoSet = lr0Goto(grammar, itemSet, symbolKey);

                    if (gotoSet.length === 0)
                    {
                        continue;
                    }

                    const gotoKey = Lr0ItemSetBuilder.setIdentity(gotoSet);
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

        return new Lr0ItemSetCollection(grammar, itemSets);
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
     */
    public static setIdentity(items: readonly Lr0Item[]): string
    {
        return sortLr0Items(items)
            .map((item) => Lr0ItemSetBuilder.itemIdentity(item))
            .join('|');
    }
}

/**
 * Builds the canonical LR(0) item set collection for a grammar.
 *
 * @param grammar - Augmented or plain BNF grammar.
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
