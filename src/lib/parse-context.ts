import type { AstNode } from './ast/ast-node.js';
import { ParseContextError } from './parse-context-error.js';
import type { Lexer } from './lexer/lexer.js';
import type { Token } from './lexer/token.js';
import { ParseTable } from './parse-table/parse-table.js';
import { ParserLr } from './parser-lr.js';

/**
 * Parser and parse table loaded from a serialized table.
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
     * Builds a parse context from serialized parse table JSON.
     *
     * @param json - Serialized parse table JSON including `ast` and `transform` when present.
     * @returns Parser and parse table ready for lexing and full AST parsing.
     */
    public static fromTableJson(json: string): ParseContext
    {
        const table = ParseTable.fromJsonString(json);

        return new ParseContext(ParserLr.fromParseTable(table), table);
    }

    /**
     * Builds a parse context from serialized table JSON options.
     *
     * @param options - Table JSON source.
     * @returns Parser and parse table ready for lexing or parsing.
     */
    public static fromSources(options: ParseContextSources): ParseContext
    {
        if (options.tableJson !== undefined)
        {
            return ParseContext.fromTableJson(options.tableJson);
        }

        throw new ParseContextError('required: table JSON');
    }

    /**
     * Creates a stream lexer for this context's grammar.
     *
     * @returns A fresh stream lexer instance.
     */
    public createLexer(): Lexer
    {
        return this.parser.createLexer();
    }

    /**
     * Lexes source text using this context's parser.
     *
     * @param source - Input text to tokenize.
     * @returns Matched tokens in source order, ending with `$eof`.
     */
    public lex(source: string): readonly Token[]
    {
        return this.parser.lex(source);
    }

    /**
     * Lexes synchronous source chunks into a token stream ending with `$eof`.
     *
     * @param chunks - Source text fragments in order.
     * @returns Token iterator including `$eof`.
     */
    public lexChunks(chunks: Iterable<string>): IterableIterator<Token>
    {
        return this.parser.lexChunks(chunks);
    }

    /**
     * Lexes asynchronous source chunks into a token stream ending with `$eof`.
     *
     * @param chunks - Source text fragments in order.
     * @returns Async token iterator including `$eof`.
     */
    public lexChunksAsync(chunks: AsyncIterable<string>): AsyncIterableIterator<Token>
    {
        return this.parser.lexChunksAsync(chunks);
    }

    /**
     * Collects all tokens from a synchronous chunk stream.
     *
     * @param chunks - Source text fragments in order.
     * @returns Matched tokens including `$eof`.
     */
    public lexChunkStream(chunks: Iterable<string>): readonly Token[]
    {
        return this.parser.lexChunkStream(chunks);
    }

    /**
     * Collects all tokens from an asynchronous chunk stream.
     *
     * @param chunks - Source text fragments in order.
     * @returns Matched tokens including `$eof`.
     */
    public async lexChunkStreamAsync(chunks: AsyncIterable<string>): Promise<readonly Token[]>
    {
        return this.parser.lexChunkStreamAsync(chunks);
    }

    /**
     * Parses a token stream into an AST, applying transforms from the grammar or table when present.
     *
     * @param tokens - Token stream ending with `$eof`.
     * @returns Transformed AST, CST when no transform rules exist, or null on syntax error.
     */
    public parse(tokens: readonly Token[]): AstNode | null
    {
        return this.parser.parse(tokens);
    }

    /**
     * Lexes and parses source text into an AST, applying transforms when present.
     *
     * @param source - Input text to parse.
     * @returns Transformed AST, CST when no transform rules exist, or null on syntax error.
     */
    public parseSource(source: string): AstNode | null
    {
        return this.parser.parseSource(source);
    }
}

/**
 * In-memory sources for constructing a {@link ParseContext} from table JSON.
 */
export interface ParseContextSources
{
    readonly tableJson?: string;
}
