import type { AstNode } from './ast/ast-node.js';
import type { Grammar } from './grammar/grammar.js';
import {
    Lexer,
    lexChunkStream,
    lexChunkStreamAsync,
    lexChunks,
    lexChunksAsync,
} from './lexer/lexer.js';
import type { Token } from './lexer/token.js';
import type { LrAlgorithm } from './parse-table/lr-algorithm.js';
import { ParseTable } from './parse-table/parse-table.js';
import { parseWithTable } from './shift-reduce/shift-reduce-engine.js';

/**
 * Shift-reduce parser for EBNF grammars.
 */
export class ParserLr
{
    private readonly grammar: Grammar;
    private readonly table: ParseTable | null;

    /**
     * Creates a parser bound to a grammar and optional parse table.
     *
     * @param grammar - Parsed `.grammar` file supplying lexer and parser rules.
     * @param table - Optional parse table used for shift-reduce parsing.
     */
    public constructor(grammar: Grammar, table: ParseTable | null = null)
    {
        this.grammar = grammar;
        this.table = table;
    }

    /**
     * Creates a parser from a serialized parse table.
     *
     * @param table - Parse table containing lexer metadata and parser entries.
     * @returns A parser that can lex and parse using the table.
     */
    public static fromParseTable(table: ParseTable): ParserLr
    {
        return new ParserLr(table.toGrammar(), table);
    }

    /**
     * Creates a stream lexer for this parser's grammar.
     *
     * @returns A fresh stream lexer instance.
     */
    public createLexer(): Lexer
    {
        return new Lexer(this.grammar);
    }

    /**
     * Lexes source text into tokens using the grammar's token and skip rules.
     *
     * @param source - Input text to tokenize.
     * @returns Matched tokens in source order, ending with `$eof`.
     */
    public lex(source: string): readonly Token[]
    {
        return this.createLexer().lex(source);
    }

    /**
     * Lexes synchronous source chunks into a token stream ending with `$eof`.
     *
     * @param chunks - Source text fragments in order.
     * @returns Token iterator including `$eof`.
     */
    public lexChunks(chunks: Iterable<string>): IterableIterator<Token>
    {
        return lexChunks(this.grammar, chunks);
    }

    /**
     * Lexes asynchronous source chunks into a token stream ending with `$eof`.
     *
     * @param chunks - Source text fragments in order.
     * @returns Async token iterator including `$eof`.
     */
    public lexChunksAsync(chunks: AsyncIterable<string>): AsyncIterableIterator<Token>
    {
        return lexChunksAsync(this.grammar, chunks);
    }

    /**
     * Collects all tokens from a synchronous chunk stream.
     *
     * @param chunks - Source text fragments in order.
     * @returns Matched tokens including `$eof`.
     */
    public lexChunkStream(chunks: Iterable<string>): readonly Token[]
    {
        return lexChunkStream(this.grammar, chunks);
    }

    /**
     * Collects all tokens from an asynchronous chunk stream.
     *
     * @param chunks - Source text fragments in order.
     * @returns Matched tokens including `$eof`.
     */
    public async lexChunkStreamAsync(chunks: AsyncIterable<string>): Promise<readonly Token[]>
    {
        return lexChunkStreamAsync(this.grammar, chunks);
    }

    /**
     * Parses a token stream into a concrete syntax tree.
     *
     * @param tokens - Token stream ending with `$eof`.
     * @returns Parse tree rooted at the grammar start symbol, or null on syntax error.
     */
    public parse(tokens: readonly Token[]): AstNode | null
    {
        if (this.table === null)
        {
            return null;
        }

        return parseWithTable(this.table, tokens);
    }

    /**
     * Lexes and parses source text into a concrete syntax tree.
     *
     * @param source - Input text to parse.
     * @returns Parse tree rooted at the grammar start symbol, or null on syntax error.
     */
    public parseSource(source: string): AstNode | null
    {
        return this.parse(this.lex(source));
    }

    /**
     * Builds a parse table from the bound grammar, including the token inventory.
     *
     * @param algorithm - LR algorithm used to build the table.
     * @returns Parse table metadata ready for serialization.
     */
    public buildParseTable(algorithm: LrAlgorithm = 'lr1'): ParseTable
    {
        return ParseTable.fromGrammar(this.grammar, algorithm);
    }
}
