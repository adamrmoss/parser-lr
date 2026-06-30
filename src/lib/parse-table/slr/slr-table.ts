import type { BnfGrammar } from '../bnf/bnf-grammar.js';
import { buildLrTable } from '../build-lr-table.js';
import {
    formatLrActions,
    formatLrConflicts,
    formatLrGotos,
    LrParseTable,
} from '../table/lr-parse-table.js';

/** SLR parse tables use the shared {@link LrParseTable} representation. */
export type SlrTable = LrParseTable;

/**
 * Builds an SLR table from a plain BNF grammar, augmenting it automatically.
 *
 * @param grammar - Plain BNF grammar to analyze.
 */
export function buildSlrTable(grammar: BnfGrammar): SlrTable
{
    return buildLrTable(grammar, 'slr');
}

export { formatLrActions as formatSlrActions };
export { formatLrConflicts as formatSlrConflicts };
export { formatLrGotos as formatSlrGotos };
