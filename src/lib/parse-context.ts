import { readGrammar } from './grammar/read-grammar.js';
import type { Token } from './lexer/token.js';
import type { LrAlgorithm } from './parse-table/lr-algorithm.js';
import { parseLrAlgorithm } from './parse-table/lr-algorithm.js';
import { ParseTable } from './parse-table/parse-table.js';
import { ParserLr } from './parser-lr.js';

/**
 * Parser and parse table loaded from a grammar or serialized table.
 */
export class ParseContext
{
    /**
     * Creates a parse context from a parser and its table.
     *
     * @param parser - Shift-reduce parser instance.
     * @param table - Parse table backing the parser.
     */
    public constructor(
        public readonly parser: ParserLr,
        public readonly table: ParseTable,
    )
    {
    }

    /**
     * Builds a parse context from grammar file text.
     *
     * @param source - Full `.grammar` file contents.
     * @param algorithm - LR algorithm used to build the table.
     * @returns Parser and parse table ready for lexing or parsing.
     */
    public static fromGrammar(
        source: string,
        algorithm: LrAlgorithm = 'lr1',
    ): ParseContext
    {
        const grammar = readGrammar(source);
        const parser = new ParserLr(grammar);

        return new ParseContext(parser, parser.buildParseTable(algorithm));
    }

    /**
     * Builds a parse context from serialized parse table JSON.
     *
     * @param json - Serialized parse table JSON.
     * @returns Parser and parse table ready for lexing or parsing.
     */
    public static fromTableJson(json: string): ParseContext
    {
        const table = ParseTable.fromJsonString(json);

        return new ParseContext(ParserLr.fromParseTable(table), table);
    }

    /**
     * Builds a parse context from a grammar or table source string.
     *
     * @param options - Grammar source, table JSON, and optional algorithm.
     * @returns Parser and parse table ready for lexing or parsing.
     */
    public static fromSources(options: ParseContextSources): ParseContext
    {
        // Prefer grammar source over a saved table when both are supplied.
        if (options.grammarSource !== undefined)
        {
            return ParseContext.fromGrammar(
                options.grammarSource,
                parseLrAlgorithm(options.algorithm),
            );
        }

        if (options.tableJson !== undefined)
        {
            return ParseContext.fromTableJson(options.tableJson);
        }

        throw new Error('required: grammar source or table JSON');
    }

    /**
     * Lexes source text using this context's parser.
     *
     * @param source - Input text to tokenize.
     * @returns Matched tokens in source order.
     */
    public lex(source: string): readonly Token[]
    {
        return this.parser.lex(source);
    }
}

/**
 * In-memory sources for constructing a {@link ParseContext}.
 */
export interface ParseContextSources
{
    readonly grammarSource?: string;
    readonly tableJson?: string;
    readonly algorithm?: string;
}
