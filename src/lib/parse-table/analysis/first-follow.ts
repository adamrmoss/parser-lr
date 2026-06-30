import { EOF_TOKEN_NAME } from '../../lexer/token.js';

import { AUGMENTED_START_SYMBOL, type BnfGrammar } from '../bnf/bnf-grammar.js';
import type { BnfProduction } from '../bnf/bnf-production.js';
import { bnfSymbolKey, type BnfSymbol } from '../bnf/bnf-symbol.js';

/**
 * Nullable non-terminals and FIRST/FOLLOW sets for a BNF grammar.
 */
export class GrammarAnalysis
{
    private readonly nullable: ReadonlySet<string>;
    private readonly firstByNonTerminal: ReadonlyMap<string, ReadonlySet<string>>;
    private readonly followByNonTerminal: ReadonlyMap<string, ReadonlySet<string>>;

    /**
     * Computes nullable, FIRST, and FOLLOW sets for a BNF grammar.
     *
     * @param grammar - Plain BNF grammar to analyze.
     */
    public constructor(grammar: BnfGrammar)
    {
        this.nullable = GrammarAnalysis.computeNullable(grammar);
        this.firstByNonTerminal = GrammarAnalysis.computeFirst(grammar, this.nullable);
        this.followByNonTerminal = GrammarAnalysis.computeFollow(
            grammar,
            this.firstByNonTerminal,
            this.nullable,
        );
    }

    /**
     * Returns whether a non-terminal can derive the empty string.
     *
     * @param name - Non-terminal name to test.
     */
    public isNullable(name: string): boolean
    {
        return this.nullable.has(name);
    }

    /**
     * Returns FIRST symbols for a non-terminal as encoded terminal keys.
     *
     * @param name - Non-terminal name to look up.
     */
    public firstOfNonTerminal(name: string): ReadonlySet<string>
    {
        return this.firstByNonTerminal.get(name) ?? new Set<string>();
    }

    /**
     * Returns FOLLOW symbols for a non-terminal as encoded terminal keys.
     *
     * @param name - Non-terminal name to look up.
     */
    public followOfNonTerminal(name: string): ReadonlySet<string>
    {
        return this.followByNonTerminal.get(name) ?? new Set<string>();
    }

    /**
     * Returns FIRST symbols for a symbol sequence.
     *
     * @param symbols - Right-hand side prefix or full sequence.
     */
    public firstOfSequence(symbols: readonly BnfSymbol[]): ReadonlySet<string>
    {
        const result = new Set<string>();
        let allNullable = true;

        for (const symbol of symbols)
        {
            const symbolFirst = this.firstOfSymbol(symbol);
            GrammarAnalysis.addAll(result, symbolFirst);

            if (!this.isSymbolNullable(symbol))
            {
                allNullable = false;
                break;
            }
        }

        if (allNullable)
        {
            result.add(EOF_TOKEN_NAME);
        }

        return result;
    }

    /**
     * Returns FIRST symbols for one grammar symbol.
     *
     * @param symbol - Terminal, token, or non-terminal symbol.
     */
    public firstOfSymbol(symbol: BnfSymbol): ReadonlySet<string>
    {
        if (symbol.kind === 'nonTerminal')
        {
            return this.firstOfNonTerminal(symbol.name);
        }

        return new Set<string>([bnfSymbolKey(symbol)]);
    }

    /**
     * Returns whether a symbol can begin with the empty string.
     *
     * @param symbol - Terminal, token, or non-terminal symbol.
     */
    public isSymbolNullable(symbol: BnfSymbol): boolean
    {
        if (symbol.kind === 'nonTerminal')
        {
            return this.isNullable(symbol.name);
        }

        return false;
    }

    /**
     * Computes nullable non-terminals by fixed-point iteration.
     *
     * @param grammar - Plain BNF grammar to analyze.
     */
    private static computeNullable(grammar: BnfGrammar): ReadonlySet<string>
    {
        const nullable = new Set<string>();
        let changed = true;

        while (changed)
        {
            changed = false;

            for (const production of grammar.productions)
            {
                if (production.rhs.length === 0 && !nullable.has(production.name))
                {
                    nullable.add(production.name);
                    changed = true;
                    continue;
                }

                if (production.rhs.every((symbol) =>
                    symbol.kind === 'nonTerminal' && nullable.has(symbol.name)))
                {
                    if (!nullable.has(production.name))
                    {
                        nullable.add(production.name);
                        changed = true;
                    }
                }
            }
        }

        return nullable;
    }

    /**
     * Computes FIRST sets for every non-terminal.
     *
     * @param grammar - Plain BNF grammar to analyze.
     * @param nullable - Nullable non-terminal names.
     */
    private static computeFirst(
        grammar: BnfGrammar,
        nullable: ReadonlySet<string>,
    ): ReadonlyMap<string, ReadonlySet<string>>
    {
        const firstByNonTerminal = new Map<string, Set<string>>();

        for (const name of grammar.nonTerminalNames())
        {
            firstByNonTerminal.set(name, new Set<string>());
        }

        let changed = true;

        while (changed)
        {
            changed = false;

            for (const production of grammar.productions)
            {
                const first = firstByNonTerminal.get(production.name) ?? new Set<string>();
                const before = first.size;
                GrammarAnalysis.addFirstOfSequence(first, production.rhs, firstByNonTerminal, nullable);

                if (first.size !== before)
                {
                    changed = true;
                }

                firstByNonTerminal.set(production.name, first);
            }
        }

        return firstByNonTerminal;
    }

    /**
     * Computes FOLLOW sets for every non-terminal.
     *
     * @param grammar - Plain BNF grammar to analyze.
     * @param firstByNonTerminal - Precomputed FIRST sets.
     * @param nullable - Nullable non-terminal names.
     */
    private static computeFollow(
        grammar: BnfGrammar,
        firstByNonTerminal: ReadonlyMap<string, ReadonlySet<string>>,
        nullable: ReadonlySet<string>,
    ): ReadonlyMap<string, ReadonlySet<string>>
    {
        const followByNonTerminal = new Map<string, Set<string>>();

        for (const name of grammar.nonTerminalNames())
        {
            followByNonTerminal.set(name, new Set<string>());
        }

        const startFollow = followByNonTerminal.get(grammar.startSymbol) ?? new Set<string>();
        startFollow.add(EOF_TOKEN_NAME);
        followByNonTerminal.set(grammar.startSymbol, startFollow);

        let changed = true;

        while (changed)
        {
            changed = false;

            for (const production of grammar.productions)
            {
                for (let index = 0; index < production.rhs.length; index += 1)
                {
                    const symbol = production.rhs[index];

                    if (symbol.kind !== 'nonTerminal')
                    {
                        continue;
                    }

                    const follow = followByNonTerminal.get(symbol.name) ?? new Set<string>();
                    const before = follow.size;
                    const beta = production.rhs.slice(index + 1);
                    const betaFirst = GrammarAnalysis.firstOfSequenceStatic(
                        beta,
                        firstByNonTerminal,
                        nullable,
                    );

                    GrammarAnalysis.addAll(follow, betaFirst);

                    if (beta.length === 0 || GrammarAnalysis.isSequenceNullableStatic(beta, nullable))
                    {
                        const lhsFollow = followByNonTerminal.get(production.name) ?? new Set<string>();
                        GrammarAnalysis.addAll(follow, lhsFollow);
                    }

                    if (follow.size !== before)
                    {
                        changed = true;
                    }

                    followByNonTerminal.set(symbol.name, follow);
                }
            }
        }

        return followByNonTerminal;
    }

    /**
     * Adds FIRST symbols for a symbol sequence into a working set.
     *
     * @param target - FIRST set being accumulated.
     * @param symbols - Right-hand side sequence.
     * @param firstByNonTerminal - Precomputed FIRST sets.
     * @param nullable - Nullable non-terminal names.
     */
    private static addFirstOfSequence(
        target: Set<string>,
        symbols: readonly BnfSymbol[],
        firstByNonTerminal: ReadonlyMap<string, Set<string>>,
        nullable: ReadonlySet<string>,
    ): void
    {
        GrammarAnalysis.addAll(
            target,
            GrammarAnalysis.firstOfSequenceStatic(symbols, firstByNonTerminal, nullable),
        );
    }

    /**
     * Returns FIRST symbols for a symbol sequence using precomputed maps.
     *
     * @param symbols - Right-hand side sequence.
     * @param firstByNonTerminal - Precomputed FIRST sets.
     * @param nullable - Nullable non-terminal names.
     */
    private static firstOfSequenceStatic(
        symbols: readonly BnfSymbol[],
        firstByNonTerminal: ReadonlyMap<string, ReadonlySet<string>>,
        nullable: ReadonlySet<string>,
    ): ReadonlySet<string>
    {
        const result = new Set<string>();
        let allNullable = true;

        for (const symbol of symbols)
        {
            if (symbol.kind === 'nonTerminal')
            {
                GrammarAnalysis.addAll(result, firstByNonTerminal.get(symbol.name) ?? new Set<string>());

                if (!nullable.has(symbol.name))
                {
                    allNullable = false;
                    break;
                }
            }
            else
            {
                result.add(bnfSymbolKey(symbol));
                allNullable = false;
                break;
            }
        }

        if (allNullable)
        {
            result.add(EOF_TOKEN_NAME);
        }

        return result;
    }

    /**
     * Returns whether every symbol in a sequence is nullable.
     *
     * @param symbols - Right-hand side sequence.
     * @param nullable - Nullable non-terminal names.
     */
    private static isSequenceNullableStatic(
        symbols: readonly BnfSymbol[],
        nullable: ReadonlySet<string>,
    ): boolean
    {
        if (symbols.length === 0)
        {
            return true;
        }

        return symbols.every((symbol) =>
            symbol.kind === 'nonTerminal' && nullable.has(symbol.name));
    }

    /**
     * Adds all members of `source` into `target`.
     *
     * @param target - Destination set.
     * @param source - Source set.
     */
    private static addAll(target: Set<string>, source: ReadonlySet<string>): void
    {
        for (const value of source)
        {
            target.add(value);
        }
    }
}

/**
 * Computes nullable, FIRST, and FOLLOW sets for a BNF grammar.
 *
 * @param grammar - Plain BNF grammar to analyze.
 */
export function analyzeGrammar(grammar: BnfGrammar): GrammarAnalysis
{
    return new GrammarAnalysis(grammar);
}

/**
 * Returns a readable production label for diagnostics and tests.
 *
 * @param production - Production to format.
 */
export function formatBnfProduction(production: BnfProduction): string
{
    if (production.rhs.length === 0)
    {
        return `${production.name} → ε`;
    }

    const rhs = production.rhs.map((symbol) => bnfSymbolKey(symbol)).join(' ');

    return `${production.name} → ${rhs}`;
}

/**
 * Returns whether a grammar uses the augmented `$accept` start production.
 *
 * @param grammar - Grammar to inspect.
 */
export function isAugmentedGrammar(grammar: BnfGrammar): boolean
{
    return grammar.startSymbol === AUGMENTED_START_SYMBOL;
}
