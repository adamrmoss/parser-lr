import type { Grammar } from './grammar/grammar.js';
import { Lexer } from './lexer/lexer.js';
import type { Token } from './lexer/token.js';
import type { LrAlgorithm } from './parse-table/lr-algorithm.js';
import { ParseTable } from './parse-table/parse-table.js';

/**
 * Shift-reduce parser for EBNF grammars.
 */
export class ParserLr
{
    private readonly grammar: Grammar;
    private readonly lexer: Lexer;

    /**
     * Creates a parser bound to a grammar.
     *
     * @param grammar - Parsed `.grammar` file supplying lexer and parser rules.
     */
    public constructor(grammar: Grammar)
    {
        this.grammar = grammar;
        this.lexer = new Lexer(grammar);
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
     * Lexes source text into tokens using the grammar's token and skip rules.
     *
     * @param source - Input text to tokenize.
     * @returns Matched tokens in source order.
     */
    public lex(source: string): readonly Token[]
    {
        return this.lexer.lex(source);
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
