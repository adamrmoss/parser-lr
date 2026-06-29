import { Lexer } from '../lexer/lexer.js';
import { isEofToken } from '../lexer/token.js';
import type { Token } from '../lexer/token.js';
import { ParseTable } from '../parse-table/parse-table.js';
import type { ParseTableJson } from '../parse-table/parse-table.js';

import type { Grammar } from './grammar.js';
import bootstrapTableJson from './grammar.json' with { type: 'json' };

const bootstrapTable = bootstrapTableJson as ParseTableJson;

let bootstrapMetaGrammar: Grammar | null = null;

/**
 * Returns the bootstrapped meta-grammar table for `.grammar` files.
 */
export function metaGrammarTable(): ParseTable
{
    return ParseTable.fromJson(bootstrapTable);
}

/**
 * Returns the bootstrapped meta-grammar model used to lex `.grammar` files.
 */
export function metaGrammar(): Grammar
{
    if (bootstrapMetaGrammar === null)
    {
        bootstrapMetaGrammar = metaGrammarTable().toGrammar();
    }

    return bootstrapMetaGrammar;
}

/**
 * Lexes a `.grammar` source file using the bootstrapped meta-grammar table.
 *
 * @param source - Full grammar file text.
 * @returns Matched tokens excluding `$eof`.
 */
export function lexGrammarSource(source: string): readonly Token[]
{
    const tokens = new Lexer(metaGrammar()).lex(source);

    return tokens.filter((token) => !isEofToken(token));
}
