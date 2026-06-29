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

/**
 * Shift-reduce parser for EBNF grammars.
 */
export class ParserLr
{
    private readonly grammar: Grammar;

    /**
     * Creates a parser bound to a grammar.
     *
     * @param grammar - Parsed `.grammar` file supplying lexer and parser rules.
     */
    public constructor(grammar: Grammar)
    {
        this.grammar = grammar;
    }

    /**
     * Creates a parser from a serialized parse table.
     *
     * @param table - Parse table containing lexer metadata.
     * @returns A parser that can lex using the table's token inventory.
     */
    public static fromParseTable(table: ParseTable): ParserLr
    {
        return new ParserLr(table.toGrammar());
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
