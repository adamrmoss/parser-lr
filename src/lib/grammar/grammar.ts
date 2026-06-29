import type { Production } from './production.js';
import type { TokenRule } from './token-rule.js';

/**
 * Parsed `.grammar` file: lexer rules, skip rules, and parser productions.
 */
export class Grammar
{
    private readonly productionsByName: ReadonlyMap<string, Production>;

    /**
     * Creates a grammar from its file-level sections.
     *
     * @param name - Grammar name from the `name` declaration.
     * @param tokenRules - Token definitions from the `tokens` section.
     * @param skipRules - Skip definitions from the `skip` section.
     * @param states - State names from the `states` section.
     * @param startSymbol - Entry production from the `start` declaration.
     * @param productions - Productions from the `grammar` section.
     */
    public constructor(
        public readonly name: string,
        public readonly tokenRules: readonly TokenRule[],
        public readonly skipRules: readonly TokenRule[],
        public readonly states: readonly string[],
        public readonly startSymbol: string,
        public readonly productions: readonly Production[],
    )
    {
        // Index productions by name for lookup.
        const productionsByName = new Map<string, Production>();

        for (const production of productions)
        {
            productionsByName.set(production.name, production);
        }

        this.productionsByName = productionsByName;
    }

    /**
     * Returns a production by non-terminal name.
     *
     * @param name - Production name to look up.
     * @returns The matching production, or null when the name is undefined.
     */
    public production(name: string): Production | null
    {
        return this.productionsByName.get(name) ?? null;
    }

    /**
     * Whether a named non-terminal is defined in this grammar.
     *
     * @param name - Production name to test.
     */
    public hasProduction(name: string): boolean
    {
        return this.productionsByName.has(name);
    }
}
