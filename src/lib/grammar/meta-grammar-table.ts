import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Lexer } from '../lexer/lexer.js';
import { isEofToken } from '../lexer/token.js';
import type { Token } from '../lexer/token.js';
import { ParseTable } from '../parse-table/parse-table.js';
import type { ParseTableJson } from '../parse-table/parse-table.js';

import type { Grammar } from './grammar.js';
import { grammarJsonDirectory } from './grammar-json-path.js';

let bootstrapTable: ParseTableJson | null = null;
let bootstrapMetaGrammar: Grammar | null = null;

/**
 * Overrides the bootstrapped meta-grammar table before any grammar file is read.
 *
 * @remarks
 * The bundled CLI injects its inlined `grammar.json` here so it never depends on
 * a `grammar.json` file on disk. Library consumers do not call this; they fall
 * back to the lazy filesystem read in {@link bootstrapTableJson}.
 *
 * @param table - Serialized meta-grammar parse table.
 */
export function setBootstrapTableJson(table: ParseTableJson): void
{
    bootstrapTable = table;
    bootstrapMetaGrammar = null;
}

/**
 * Reads and caches the bootstrapped `grammar.json` on first use.
 *
 * @remarks
 * Loading is deferred so that importing the parse runtime (for example
 * {@link ParseContext.fromTableJson}) never touches the filesystem or evaluates
 * `import.meta`. Only grammar-file consumers pay this cost.
 */
function bootstrapTableJson(): ParseTableJson
{
    if (bootstrapTable === null)
    {
        bootstrapTable = JSON.parse(
            readFileSync(join(grammarJsonDirectory(), 'grammar.json'), 'utf8'),
        ) as ParseTableJson;
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
