import type { EbnfRule } from './ebnf-rule.js';

/**
 * Parsed EBNF grammar used to build LR parse tables.
 */
export class EbnfGrammar
{
    private readonly rulesByName: ReadonlyMap<string, EbnfRule>;

    /**
     * Creates a grammar from a start symbol and rule list.
     *
     * @param startSymbol - Entry non-terminal for parsing.
     * @param rules - Named productions defining the grammar.
     */
    public constructor(
        public readonly startSymbol: string,
        public readonly rules: readonly EbnfRule[],
    )
    {
        // Index rules by name for lookup.
        const rulesByName = new Map<string, EbnfRule>();

        for (const rule of rules)
        {
            rulesByName.set(rule.name, rule);
        }

        this.rulesByName = rulesByName;
    }

    /**
     * Returns a production by non-terminal name.
     *
     * @param name - Rule name to look up.
     * @returns The matching rule, or null when the name is undefined.
     */
    public rule(name: string): EbnfRule | null
    {
        return this.rulesByName.get(name) ?? null;
    }

    /**
     * Whether a named non-terminal is defined in this grammar.
     *
     * @param name - Non-terminal name to test.
     */
    public hasRule(name: string): boolean
    {
        return this.rulesByName.has(name);
    }
}
