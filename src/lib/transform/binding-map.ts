import type { ParseTableProductionJson } from '../parse-table/parse-table-json.js';

/**
 * One bound or unbound slot on a production right-hand side.
 */
export interface ProductionSlot
{
    readonly index: number;
    readonly binding: string | null;
    readonly symbol: string;
}

/**
 * Parses a serialized production right-hand side symbol key.
 *
 * @param key - Encoded symbol from a parse table production.
 */
export function parseRhsSymbolKey(key: string): { binding: string | null; symbol: string }
{
    const bindingMatch = /^\[([A-Za-z_][A-Za-z0-9_]*)\]:(.+)$/.exec(key);

    if (bindingMatch !== null)
    {
        return {
            binding: bindingMatch[1],
            symbol: bindingMatch[2],
        };
    }

    if (key.startsWith('"') && key.endsWith('"'))
    {
        return {
            binding: null,
            symbol: key.slice(1, -1),
        };
    }

    return {
        binding: null,
        symbol: key,
    };
}

/**
 * Returns indexed slots for one production right-hand side.
 *
 * @param production - Parse table production metadata.
 */
export function productionSlots(production: ParseTableProductionJson): readonly ProductionSlot[]
{
    return production.rhs.map((key, index) =>
    {
        const parsed = parseRhsSymbolKey(key);

        return {
            index,
            binding: parsed.binding,
            symbol: parsed.symbol,
        };
    });
}

/**
 * Returns the shared `$repeat` prefix for a numbered synthetic repeat symbol or reference.
 *
 * @param name - Repeat non-terminal or transform reference name.
 */
export function repeatSymbolPrefix(name: string): string | null
{
    const match = /^(.+\$repeat)_\d+$/.exec(name);

    return match?.[1] ?? null;
}

/**
 * Finds the child index for a transform reference name.
 *
 * @param production - Parse table production metadata.
 * @param reference - Binding or symbol name from a transform expression.
 */
export function referenceSlotIndex(
    production: ParseTableProductionJson,
    reference: string,
): number | null
{
    for (const slot of productionSlots(production))
    {
        if (slot.binding === reference)
        {
            return slot.index;
        }
    }

    for (const slot of productionSlots(production))
    {
        if (slot.binding === null && slot.symbol === reference)
        {
            return slot.index;
        }
    }

    const repeatPrefix = repeatSymbolPrefix(reference);

    if (repeatPrefix !== null)
    {
        for (const slot of productionSlots(production))
        {
            if (slot.binding === null && repeatSymbolPrefix(slot.symbol) === repeatPrefix)
            {
                return slot.index;
            }
        }
    }

    return null;
}
