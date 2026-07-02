import grammarTableJson from './grammar.json' with { type: 'json' };

import { Lexer } from '../lexer/lexer.js';
import { isEofToken } from '../lexer/token.js';
import type { Token } from '../lexer/token.js';
import { ParseTable } from '../parse-table/parse-table.js';
import type { ParseTableJson } from '../parse-table/parse-table.js';

import type { Grammar } from './grammar.js';

let bootstrapTable: ParseTableJson | null = null;
let bootstrapMetaGrammar: Grammar | null = null;

/**
 * Returns the bootstrapped meta-grammar table JSON on first use.
 *
 * @remarks
 * Parsing is deferred so grammar-file consumers pay table construction only when
 * needed. The JSON is imported at compile time; no filesystem path resolution.
 */
function bootstrapTableJson(): ParseTableJson
{
    if (bootstrapTable === null)
    {
        bootstrapTable = grammarTableJson as ParseTableJson;
    }

    return bootstrapTable;
}

/**
 * Returns the bootstrapped meta-grammar table for `.grammar` files.
 */
export function metaGrammarTable(): ParseTable
{
    return ParseTable.fromJson(bootstrapTableJson());
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
