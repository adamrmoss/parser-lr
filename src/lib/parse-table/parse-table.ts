import { Grammar } from '../grammar/grammar.js';
import type { TokenRule } from '../grammar/token-rule.js';

import { desugarEbnf } from './bnf/desugar-ebnf.js';
import { buildLrTable } from './build-lr-table.js';
import { EOF_TOKEN_NAME } from '../lexer/token.js';
import type { LrAlgorithm } from './lr-algorithm.js';
import { ParseTableBuildError } from './parse-table-build-error.js';
import {
    isParseTableJsonV2,
    type ParseTableActionJson,
    type ParseTableGotoJson,
    type ParseTableJsonV2,
    type ParseTableProductionJson,
} from './parse-table-json.js';
import {
    encodeProductionRhs,
    formatLrConflicts,
    type LrParseTable,
} from './table/lr-parse-table.js';
import type { ParseAction } from './table/parse-action.js';

/** Current on-disk JSON schema version for lexer-only parse tables. */
export const PARSE_TABLE_VERSION = 1;

/** JSON schema version for full LR parse tables. */
export const PARSE_TABLE_VERSION_FULL = 2;

/**
 * Serialized parse table payload written to JSON.
 */
export interface ParseTableJson
{
    readonly version: typeof PARSE_TABLE_VERSION | typeof PARSE_TABLE_VERSION_FULL;
    readonly algorithm: LrAlgorithm;
    readonly grammarName: string;
    readonly startSymbol: string;
    readonly tokens: readonly string[];
    readonly tokenRules: readonly TokenRule[];
    readonly skipRules: readonly TokenRule[];
    readonly states: readonly string[];
    readonly parserStateCount?: number;
    readonly productions?: readonly ParseTableProductionJson[];
    readonly actions?: readonly ParseTableActionJson[];
    readonly gotos?: readonly ParseTableGotoJson[];
}

/**
 * LR parse table metadata, including lexer inventory and parser table entries.
 */
export class ParseTable
{
    private readonly actionByState: ReadonlyMap<number, ReadonlyMap<string, ParseAction>>;
    private readonly gotoByState: ReadonlyMap<number, ReadonlyMap<string, number>>;
    private readonly productionById: ReadonlyMap<number, ParseTableProductionJson>;

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
     * @param parserStateCount - Number of parser states, or zero when absent.
     * @param productions - Flat BNF production metadata for reduce actions.
     * @param actions - ACTION entries keyed by state and terminal symbol.
     * @param gotos - GOTO entries keyed by state and non-terminal name.
     */
    public constructor(
        public readonly grammarName: string,
        public readonly startSymbol: string,
        public readonly tokens: readonly string[],
        public readonly tokenRules: readonly TokenRule[],
        public readonly skipRules: readonly TokenRule[],
        public readonly states: readonly string[],
        public readonly algorithm: LrAlgorithm,
        public readonly parserStateCount: number = 0,
        productions: readonly ParseTableProductionJson[] = [],
        actions: ReadonlyMap<number, ReadonlyMap<string, ParseAction>> = new Map(),
        gotos: ReadonlyMap<number, ReadonlyMap<string, number>> = new Map(),
    )
    {
        this.actionByState = actions;
        this.gotoByState = gotos;

        const productionById = new Map<number, ParseTableProductionJson>();

        for (const production of productions)
        {
            productionById.set(production.id, production);
        }

        this.productionById = productionById;
    }

    /**
     * Whether the table includes parser ACTION/GOTO entries.
     */
    public get hasParserTable(): boolean
    {
        return this.parserStateCount > 0 || this.actionByState.size > 0;
    }

    /**
     * Builds a parse table from a parsed grammar.
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
        const bnf = desugarEbnf(grammar);
        const lrTable = buildLrTable(bnf, algorithm);

        if (!lrTable.isConflictFree)
        {
            throw new ParseTableBuildError(algorithm, formatLrConflicts(lrTable));
        }

        return ParseTable.fromLrParseTable(grammar, lrTable);
    }

    /**
     * Restores a parse table from serialized JSON.
     *
     * @param json - Parsed table JSON object.
     * @returns A parse table instance.
     */
    public static fromJson(json: ParseTableJson): ParseTable
    {
        if (json.version !== PARSE_TABLE_VERSION && json.version !== PARSE_TABLE_VERSION_FULL)
        {
            throw new Error(
                `Unsupported parse table version ${String(json.version)}; `
                + `expected ${PARSE_TABLE_VERSION} or ${PARSE_TABLE_VERSION_FULL}`,
            );
        }

        if (!isParseTableJsonV2(json))
        {
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

        return new ParseTable(
            json.grammarName,
            json.startSymbol,
            [...json.tokens],
            [...json.tokenRules],
            [...json.skipRules],
            [...json.states],
            json.algorithm,
            json.parserStateCount,
            [...json.productions],
            ParseTable.actionsFromJson(json.actions),
            ParseTable.gotosFromJson(json.gotos),
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
     * @returns Pretty-printed JSON including lexer and parser table data.
     */
    public toJsonString(): string
    {
        return JSON.stringify(this.toJson(), null, 4);
    }

    /**
     * Converts the parse table to a plain JSON-serializable object.
     *
     * @returns Table metadata, token inventory, and parser table entries when present.
     */
    public toJson(): ParseTableJson
    {
        if (!this.hasParserTable)
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

        const json: ParseTableJsonV2 = {
            version: PARSE_TABLE_VERSION_FULL,
            algorithm: this.algorithm,
            grammarName: this.grammarName,
            startSymbol: this.startSymbol,
            tokens: [...this.tokens],
            tokenRules: [...this.tokenRules],
            skipRules: [...this.skipRules],
            states: [...this.states],
            parserStateCount: this.parserStateCount,
            productions: [...this.productionById.values()].sort((left, right) => left.id - right.id),
            actions: ParseTable.actionsToJson(this.actionByState),
            gotos: ParseTable.gotosToJson(this.gotoByState),
        };

        return json;
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

    /**
     * Returns the ACTION entry for a parser state and terminal symbol key.
     *
     * @param state - Parser state index.
     * @param symbol - Encoded terminal or `$eof` key.
     */
    public action(state: number, symbol: string): ParseAction | null
    {
        return this.actionByState.get(state)?.get(symbol) ?? null;
    }

    /**
     * Returns the GOTO state for a parser state and non-terminal name.
     *
     * @param state - Parser state index.
     * @param nonTerminal - Non-terminal symbol name.
     */
    public goto(state: number, nonTerminal: string): number | null
    {
        return this.gotoByState.get(state)?.get(nonTerminal) ?? null;
    }

    /**
     * Returns production metadata referenced by a reduce action.
     *
     * @param productionId - Production id from a reduce action.
     */
    public production(productionId: number): ParseTableProductionJson | null
    {
        return this.productionById.get(productionId) ?? null;
    }

    /**
     * Creates a {@link ParseTable} from a built LR table and source grammar.
     *
     * @param grammar - Parsed `.grammar` file model.
     * @param lrTable - Conflict-free LR parse table.
     */
    private static fromLrParseTable(grammar: Grammar, lrTable: LrParseTable): ParseTable
    {
        const productions = lrTable.productions.map((production) => ({
            id: production.id,
            name: production.name,
            rhs: encodeProductionRhs(production),
            variant: production.variant,
            origin: production.origin,
        }));

        return new ParseTable(
            grammar.name,
            grammar.startSymbol,
            tokenInventory(grammar),
            [...grammar.tokenRules],
            [...grammar.skipRules],
            [...grammar.states],
            lrTable.algorithm,
            lrTable.stateCount,
            productions,
            lrTable.actions,
            lrTable.gotos,
        );
    }

    /**
     * Converts ACTION maps into JSON rows.
     *
     * @param actions - ACTION entries keyed by state and terminal symbol.
     */
    private static actionsToJson(
        actions: ReadonlyMap<number, ReadonlyMap<string, ParseAction>>,
    ): ParseTableActionJson[]
    {
        const rows: ParseTableActionJson[] = [];

        for (const [state, stateActions] of actions.entries())
        {
            for (const [symbol, action] of stateActions.entries())
            {
                switch (action.kind)
                {
                    case 'shift':
                        rows.push({
                            state,
                            symbol,
                            kind: 'shift',
                            target: action.state,
                        });
                        break;

                    case 'reduce':
                        rows.push({
                            state,
                            symbol,
                            kind: 'reduce',
                            productionId: action.productionId,
                        });
                        break;

                    case 'accept':
                        rows.push({
                            state,
                            symbol,
                            kind: 'accept',
                        });
                        break;
                }
            }
        }

        return rows.sort((left, right) =>
        {
            if (left.state !== right.state)
            {
                return left.state - right.state;
            }

            return left.symbol.localeCompare(right.symbol);
        });
    }

    /**
     * Converts GOTO maps into JSON rows.
     *
     * @param gotos - GOTO entries keyed by state and non-terminal name.
     */
    private static gotosToJson(
        gotos: ReadonlyMap<number, ReadonlyMap<string, number>>,
    ): ParseTableGotoJson[]
    {
        const rows: ParseTableGotoJson[] = [];

        for (const [state, stateGotos] of gotos.entries())
        {
            for (const [symbol, target] of stateGotos.entries())
            {
                rows.push({ state, symbol, target });
            }
        }

        return rows.sort((left, right) =>
        {
            if (left.state !== right.state)
            {
                return left.state - right.state;
            }

            return left.symbol.localeCompare(right.symbol);
        });
    }

    /**
     * Restores ACTION maps from JSON rows.
     *
     * @param rows - Serialized ACTION rows.
     */
    private static actionsFromJson(
        rows: readonly ParseTableActionJson[],
    ): Map<number, Map<string, ParseAction>>
    {
        const actions = new Map<number, Map<string, ParseAction>>();

        for (const row of rows)
        {
            const stateActions = actions.get(row.state) ?? new Map<string, ParseAction>();

            switch (row.kind)
            {
                case 'shift':
                    if (row.target !== undefined)
                    {
                        stateActions.set(row.symbol, { kind: 'shift', state: row.target });
                    }
                    break;

                case 'reduce':
                    if (row.productionId !== undefined)
                    {
                        stateActions.set(row.symbol, {
                            kind: 'reduce',
                            productionId: row.productionId,
                        });
                    }
                    break;

                case 'accept':
                    stateActions.set(row.symbol, { kind: 'accept' });
                    break;
            }

            actions.set(row.state, stateActions);
        }

        return actions;
    }

    /**
     * Restores GOTO maps from JSON rows.
     *
     * @param rows - Serialized GOTO rows.
     */
    private static gotosFromJson(
        rows: readonly ParseTableGotoJson[],
    ): Map<number, Map<string, number>>
    {
        const gotos = new Map<number, Map<string, number>>();

        for (const row of rows)
        {
            const stateGotos = gotos.get(row.state) ?? new Map<string, number>();
            stateGotos.set(row.symbol, row.target);
            gotos.set(row.state, stateGotos);
        }

        return gotos;
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
    const names = grammar.tokenRules.map((rule) => rule.name);

    if (names.includes(EOF_TOKEN_NAME))
    {
        return names;
    }

    return [...names, EOF_TOKEN_NAME];
}
