import { Grammar } from '../grammar/grammar.js';
import type { TokenRule } from '../grammar/token-rule.js';

import type { LrAlgorithm } from './lr-algorithm.js';

/** Current on-disk JSON schema version for parse tables. */
export const PARSE_TABLE_VERSION = 1;

/**
 * Serialized parse table payload written to JSON.
 */
export interface ParseTableJson
{
    readonly version: typeof PARSE_TABLE_VERSION;
    readonly algorithm: LrAlgorithm;
    readonly grammarName: string;
    readonly startSymbol: string;
    readonly tokens: readonly string[];
    readonly tokenRules: readonly TokenRule[];
    readonly skipRules: readonly TokenRule[];
    readonly states: readonly string[];
}

/**
 * LR parse table metadata, including the full token inventory for lexing.
 */
export class ParseTable
{
    /**
     * Creates a parse table from its serialized fields.
     *
     * @param grammarName - Grammar name from the `name` declaration.
     * @param startSymbol - Entry production from the `start` declaration.
     * @param tokens - Ordered token rule names from the grammar `tokens` section.
     * @param tokenRules - Lexer token definitions.
     * @param skipRules - Lexer skip definitions.
     * @param states - Lexer state names from the `states` section.
     * @param algorithm - LR algorithm used to build the table.
     */
    public constructor(
        public readonly grammarName: string,
        public readonly startSymbol: string,
        public readonly tokens: readonly string[],
        public readonly tokenRules: readonly TokenRule[],
        public readonly skipRules: readonly TokenRule[],
        public readonly states: readonly string[],
        public readonly algorithm: LrAlgorithm,
    )
    {
    }

    /**
     * Builds a parse table from a parsed grammar, capturing its token inventory.
     *
     * @param grammar - Parsed `.grammar` file model.
     * @param algorithm - LR algorithm used to build the table.
     * @returns A parse table ready for serialization or parsing.
     */
    public static fromGrammar(
        grammar: Grammar,
        algorithm: LrAlgorithm = 'lr1',
    ): ParseTable
    {
        return new ParseTable(
            grammar.name,
            grammar.startSymbol,
            tokenInventory(grammar),
            [...grammar.tokenRules],
            [...grammar.skipRules],
            [...grammar.states],
            algorithm,
        );
    }

    /**
     * Restores a parse table from serialized JSON.
     *
     * @param json - Parsed table JSON object.
     * @returns A parse table instance.
     */
    public static fromJson(json: ParseTableJson): ParseTable
    {
        // Reject unknown schema versions.
        if (json.version !== PARSE_TABLE_VERSION)
        {
            throw new Error(
                `Unsupported parse table version ${String(json.version)}; expected ${PARSE_TABLE_VERSION}`,
            );
        }

        return new ParseTable(
            json.grammarName,
            json.startSymbol,
            [...json.tokens],
            [...json.tokenRules],
            [...json.skipRules],
            [...json.states],
            json.algorithm,
        );
    }

    /**
     * Parses a parse table from a JSON string.
     *
     * @param json - Serialized table JSON.
     * @returns A parse table instance.
     */
    public static fromJsonString(json: string): ParseTable
    {
        return ParseTable.fromJson(JSON.parse(json) as ParseTableJson);
    }

    /**
     * Serializes the parse table to a JSON string.
     *
     * @returns Pretty-printed JSON including the token inventory.
     */
    public toJsonString(): string
    {
        return JSON.stringify(this.toJson(), null, 4);
    }

    /**
     * Converts the parse table to a plain JSON-serializable object.
     *
     * @returns Table metadata and token inventory.
     */
    public toJson(): ParseTableJson
    {
        return {
            version: PARSE_TABLE_VERSION,
            algorithm: this.algorithm,
            grammarName: this.grammarName,
            startSymbol: this.startSymbol,
            tokens: [...this.tokens],
            tokenRules: [...this.tokenRules],
            skipRules: [...this.skipRules],
            states: [...this.states],
        };
    }

    /**
     * Builds a grammar containing lexer metadata from this table.
     *
     * @returns A grammar suitable for lexing; productions are empty.
     */
    public toGrammar(): Grammar
    {
        return new Grammar(
            this.grammarName,
            this.tokenRules,
            this.skipRules,
            this.states,
            this.startSymbol,
            [],
        );
    }
}

/**
 * Returns the ordered token rule names declared in a grammar.
 *
 * @param grammar - Parsed `.grammar` file model.
 * @returns Token names in declaration order.
 */
export function tokenInventory(grammar: Grammar): readonly string[]
{
    return grammar.tokenRules.map((rule) => rule.name);
}
