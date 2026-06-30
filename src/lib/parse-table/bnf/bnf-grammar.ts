import type { BnfProduction } from './bnf-production.js';
import { bnfSymbolKey, type BnfSymbol } from './bnf-symbol.js';

/** Sentinel non-terminal introducing the augmented start production. */
export const AUGMENTED_START_SYMBOL = '$accept';

/**
 * Plain BNF grammar used for LR table construction.
 */
export class BnfGrammar
{
    private readonly productionsByName: ReadonlyMap<string, readonly BnfProduction[]>;
    private readonly productionById: ReadonlyMap<number, BnfProduction>;

    /**
     * Creates a BNF grammar from its productions and token inventory.
     *
     * @param startSymbol - Entry non-terminal from the source grammar.
     * @param productions - Flat BNF productions with stable ids.
     * @param tokenNames - Token rule names treated as terminals.
     */
    public constructor(
        public readonly startSymbol: string,
        public readonly productions: readonly BnfProduction[],
        public readonly tokenNames: readonly string[],
    )
    {
        // Index productions by left-hand side name.
        const productionsByName = new Map<string, BnfProduction[]>();
        const productionById = new Map<number, BnfProduction>();

        for (const production of productions)
        {
            const existing = productionsByName.get(production.name) ?? [];
            existing.push(production);
            productionsByName.set(production.name, existing);
            productionById.set(production.id, production);
        }

        this.productionsByName = productionsByName;
        this.productionById = productionById;
    }

    /**
     * Returns productions with a given left-hand side non-terminal.
     *
     * @param name - Non-terminal name to look up.
     */
    public productionsFor(name: string): readonly BnfProduction[]
    {
        return this.productionsByName.get(name) ?? [];
    }

    /**
     * Returns a production by its stable id.
     *
     * @param id - Production id assigned during desugaring.
     */
    public production(id: number): BnfProduction | null
    {
        return this.productionById.get(id) ?? null;
    }

    /**
     * Whether a name is a declared token rule.
     *
     * @param name - Candidate token name.
     */
    public isToken(name: string): boolean
    {
        return this.tokenNames.includes(name);
    }

    /**
     * Returns every non-terminal name appearing in the grammar.
     */
    public nonTerminalNames(): readonly string[]
    {
        const names = new Set<string>();

        for (const production of this.productions)
        {
            names.add(production.name);

            for (const symbol of production.rhs)
            {
                if (symbol.kind === 'nonTerminal')
                {
                    names.add(symbol.name);
                }
            }
        }

        return [...names].sort();
    }

    /**
     * Returns every terminal key appearing on a production right-hand side.
     */
    public terminalKeys(): readonly string[]
    {
        const keys = new Set<string>();

        for (const production of this.productions)
        {
            for (const symbol of production.rhs)
            {
                if (symbol.kind === 'terminal' || symbol.kind === 'token')
                {
                    keys.add(bnfSymbolKey(symbol));
                }
            }
        }

        return [...keys].sort();
    }

    /**
     * Builds an augmented grammar with `$accept → startSymbol`.
     */
    public augment(): BnfGrammar
    {
        const acceptProduction: BnfProduction = {
            id: this.productions.length,
            name: AUGMENTED_START_SYMBOL,
            rhs: [
                {
                    kind: 'nonTerminal',
                    name: this.startSymbol,
                    binding: null,
                },
            ],
            variant: null,
            origin: AUGMENTED_START_SYMBOL,
        };

        return new BnfGrammar(
            AUGMENTED_START_SYMBOL,
            [...this.productions, acceptProduction],
            this.tokenNames,
        );
    }

    /**
     * Returns whether a symbol key is a shift symbol (terminal or token).
     *
     * @param key - Encoded symbol from {@link bnfSymbolKey}.
     */
    public isTerminalKey(key: string): boolean
    {
        if (key.startsWith('"') && key.endsWith('"'))
        {
            return true;
        }

        const bareName = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;

        return this.tokenNames.includes(bareName);
    }

    /**
     * Finds the BNF symbol matching an encoded terminal key on some production rhs.
     *
     * @param key - Encoded terminal key.
     */
    public terminalSymbolForKey(key: string): BnfSymbol | null
    {
        for (const production of this.productions)
        {
            for (const symbol of production.rhs)
            {
                if (symbol.kind !== 'nonTerminal' && bnfSymbolKey(symbol) === key)
                {
                    return symbol;
                }
            }
        }

        return null;
    }
}
