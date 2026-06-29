import type { TransformRule } from './transform-rule.js';

/**
 * CST-to-AST rules from the `transform` section of a `.grammar` file.
 */
export class TransformSchema
{
    private readonly rulesByProduction: ReadonlyMap<string, TransformRule>;

    /**
     * Creates a transform schema from declared rules.
     *
     * @param rules - Production transform rules from the `transform` section.
     */
    public constructor(public readonly rules: readonly TransformRule[])
    {
        // Index rules by CST production name for lookup.
        const rulesByProduction = new Map<string, TransformRule>();

        for (const rule of rules)
        {
            rulesByProduction.set(rule.production, rule);
        }

        this.rulesByProduction = rulesByProduction;
    }

    /**
     * Returns transform rules for a CST production.
     *
     * @param production - Production name to look up.
     * @returns The matching rule, or null when the production is undefined.
     */
    public rule(production: string): TransformRule | null
    {
        return this.rulesByProduction.get(production) ?? null;
    }

    /**
     * Whether a CST production has transform rules defined.
     *
     * @param production - Production name to test.
     */
    public hasRule(production: string): boolean
    {
        return this.rulesByProduction.has(production);
    }
}
