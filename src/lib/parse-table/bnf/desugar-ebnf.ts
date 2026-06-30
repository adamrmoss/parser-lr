import type { Expression } from '../../grammar/expression.js';
import { Grammar } from '../../grammar/grammar.js';
import type { Production } from '../../grammar/production.js';

import { BnfGrammar } from './bnf-grammar.js';
import type { BnfProduction } from './bnf-production.js';
import type { BnfNonTerminalSymbol, BnfSymbol, BnfTokenSymbol } from './bnf-symbol.js';
import { tokenInventory } from '../token-inventory.js';

/**
 * One right-hand side alternative produced while expanding EBNF.
 */
interface DesugarAlternative
{
    /** Flattened BNF symbol sequence for one alternative. */
    readonly symbols: readonly BnfSymbol[];

    /** Choice label preserved from the source grammar, if any. */
    readonly variant: string | null;
}

/**
 * Expands EBNF productions into plain BNF suitable for LR analysis.
 */
export class EbnfDesugarer
{
    private readonly grammar: Grammar;
    private readonly tokenNames: readonly string[];
    private readonly productions: BnfProduction[] = [];
    private nextProductionId = 0;
    private nextSyntheticId = 0;

    /**
     * Creates a desugarer for a parsed grammar model.
     *
     * @param grammar - Parsed `.grammar` file model.
     */
    public constructor(grammar: Grammar)
    {
        this.grammar = grammar;
        this.tokenNames = tokenInventory(grammar);
    }

    /**
     * Desugars all parser productions into a flat BNF grammar.
     *
     * @returns Plain BNF grammar with synthetic non-terminals for EBNF constructs.
     */
    public desugar(): BnfGrammar
    {
        // Expand each declared production into one or more BNF productions.
        for (const production of this.grammar.productions)
        {
            this.desugarProduction(production);
        }

        return new BnfGrammar(
            this.grammar.startSymbol,
            this.productions,
            this.tokenNames,
        );
    }

    /**
     * Expands one named production into plain BNF alternatives.
     *
     * @param production - Source production from the grammar model.
     */
    private desugarProduction(production: Production): void
    {
        const alternatives = this.expandExpression(production.name, production.expression, null);

        // Record one BNF production per desugared alternative.
        for (const alternative of alternatives)
        {
            this.addProduction(
                production.name,
                alternative.symbols,
                alternative.variant,
                production.name,
            );
        }
    }

    /**
     * Records one BNF production with the next stable id.
     *
     * @param name - Left-hand side non-terminal.
     * @param rhs - Right-hand side symbol sequence; empty for epsilon.
     * @param variant - Choice label preserved from the source grammar, if any.
     * @param origin - Source production or synthetic construct name.
     */
    private addProduction(
        name: string,
        rhs: readonly BnfSymbol[],
        variant: string | null,
        origin: string,
    ): void
    {
        this.productions.push({
            id: this.nextProductionId,
            name,
            rhs,
            variant,
            origin,
        });
        this.nextProductionId += 1;
    }

    /**
     * Allocates a fresh synthetic non-terminal name scoped to a source production.
     *
     * @param ownerName - Production currently being expanded.
     * @param suffix - Synthetic construct kind.
     */
    private freshName(ownerName: string, suffix: string): string
    {
        const syntheticName = `${ownerName}$${suffix}_${this.nextSyntheticId}`;
        this.nextSyntheticId += 1;

        return syntheticName;
    }

    /**
     * Expands an EBNF expression into zero or more BNF right-hand sides.
     *
     * @param ownerName - Production providing scope for synthetic non-terminals.
     * @param expression - EBNF expression subtree.
     * @param variant - Choice label inherited from an outer alternative.
     */
    private expandExpression(
        ownerName: string,
        expression: Expression,
        variant: string | null,
    ): readonly DesugarAlternative[]
    {
        switch (expression.kind)
        {
            case 'reference':
                return [{
                    symbols: [this.resolveReference(null, expression.name)],
                    variant,
                }];

            case 'boundReference':
                return [{
                    symbols: [this.resolveReference(expression.binding, expression.name)],
                    variant,
                }];

            case 'terminal':
                return [{
                    symbols: [{ kind: 'terminal', value: expression.value }],
                    variant,
                }];

            case 'sequence':
                return this.expandSequence(ownerName, expression.elements, variant);

            case 'choice':
                return expression.alternatives.flatMap((alternative) =>
                    this.expandExpression(
                        ownerName,
                        alternative.expression,
                        alternative.label ?? variant,
                    ));

            case 'optional':
                return this.expandOptional(ownerName, expression.element, variant);

            case 'repeat':
                return this.expandRepeat(ownerName, expression.element, variant);

            case 'group':
                return this.expandExpression(ownerName, expression.element, variant);
        }
    }

    /**
     * Expands a concatenated sequence by combining element alternatives.
     *
     * @param elements - Sequence members in source order.
     * @param variant - Choice label inherited from an outer alternative.
     */
    private expandSequence(
        ownerName: string,
        elements: readonly Expression[],
        variant: string | null,
    ): readonly DesugarAlternative[]
    {
        let results: DesugarAlternative[] = [{ symbols: [], variant }];

        // Cartesian product: combine each prefix alternative with each next-element alternative.
        for (const element of elements)
        {
            const elementAlternatives = this.expandExpression(ownerName, element, variant);
            const combined: DesugarAlternative[] = [];

            for (const left of results)
            {
                for (const right of elementAlternatives)
                {
                    combined.push({
                        symbols: [...left.symbols, ...right.symbols],
                        variant: right.variant ?? left.variant,
                    });
                }
            }

            results = combined;
        }

        return results;
    }

    /**
     * Expands `[ element ]` into epsilon and the element expansion.
     *
     * @param element - Optional sub-expression.
     * @param variant - Choice label inherited from an outer alternative.
     */
    private expandOptional(
        ownerName: string,
        element: Expression,
        variant: string | null,
    ): readonly DesugarAlternative[]
    {
        const inner = this.expandExpression(ownerName, element, variant);

        return [
            { symbols: [], variant },
            ...inner,
        ];
    }

    /**
     * Expands `{ element }` using a fresh left-recursive list non-terminal.
     *
     * @param element - Repeated sub-expression.
     * @param variant - Choice label inherited from an outer alternative.
     */
    private expandRepeat(
        ownerName: string,
        element: Expression,
        variant: string | null,
    ): readonly DesugarAlternative[]
    {
        const repeatName = this.freshName(ownerName, 'repeat');
        const elementAlternatives = this.expandExpression(repeatName, element, null);
        const repeatReference = this.nonTerminalSymbol(repeatName, null);

        // Build `R → α R` for each expansion of the repeated element.
        for (const alternative of elementAlternatives)
        {
            this.addProduction(
                repeatName,
                [...alternative.symbols, repeatReference],
                alternative.variant,
                repeatName,
            );
        }

        // Add the epsilon base case `R → ε`.
        this.addProduction(repeatName, [], null, repeatName);

        return [{
            symbols: [repeatReference],
            variant,
        }];
    }

    /**
     * Builds a non-terminal symbol reference.
     *
     * @param name - Referenced production name.
     * @param binding - Optional slot binding from the source grammar.
     */
    private nonTerminalSymbol(name: string, binding: string | null): BnfNonTerminalSymbol
    {
        return {
            kind: 'nonTerminal',
            name,
            binding,
        };
    }

    /**
     * Builds a token symbol reference.
     *
     * @param name - Referenced token rule name.
     * @param binding - Optional slot binding from the source grammar.
     */
    private tokenSymbol(name: string, binding: string | null): BnfTokenSymbol
    {
        return {
            kind: 'token',
            name,
            binding,
        };
    }

    /**
     * Resolves a bound or unbound reference to a token or non-terminal symbol.
     *
     * @param binding - Slot binding, or null for an unbound reference.
     * @param name - Referenced symbol name.
     */
    private resolveReference(binding: string | null, name: string): BnfSymbol
    {
        if (this.grammar.hasProduction(name))
        {
            return this.nonTerminalSymbol(name, binding);
        }

        if (this.tokenNames.includes(name))
        {
            return this.tokenSymbol(name, binding);
        }

        return this.nonTerminalSymbol(name, binding);
    }
}

/**
 * Desugars a parsed grammar into plain BNF for LR table construction.
 *
 * @param grammar - Parsed `.grammar` file model.
 * @returns Flat BNF grammar with synthetic non-terminals for EBNF constructs.
 */
export function desugarEbnf(grammar: Grammar): BnfGrammar
{
    return new EbnfDesugarer(grammar).desugar();
}
