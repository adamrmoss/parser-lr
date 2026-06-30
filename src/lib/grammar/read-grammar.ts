import { Lexer } from '../lexer/lexer.js';
import { parseWithTableResult } from '../shift-reduce/shift-reduce-engine.js';

import { grammarFromCst } from './grammar-from-cst.js';
import type { Grammar } from './grammar.js';
import { metaGrammar, metaGrammarTable } from './meta-grammar-table.js';
import { ReadGrammarError } from './read-grammar-error.js';

/**
 * Parses a `.grammar` source string into a {@link Grammar} model.
 *
 * @param source - Full grammar file text.
 * @returns Parsed grammar file model.
 */
export function readGrammar(source: string): Grammar
{
    const table = metaGrammarTable();
    const tokens = new Lexer(metaGrammar()).lex(source);
    const result = parseWithTableResult(table, tokens);

    if (result.cst === null)
    {
        throw new ReadGrammarError(
            result.errorMessage ?? 'Grammar parse failed',
            result.errorOffset ?? 0,
        );
    }

    return grammarFromCst(result.cst);
}
