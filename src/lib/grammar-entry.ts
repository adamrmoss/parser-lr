/**
 * Node-only grammar-file entry point for parser-lr.
 */

export type { AstType } from './grammar/ast-type.js';
export { AstSchema } from './grammar/ast-schema.js';
export type {
    Alternative,
    BoundReferenceExpression,
    ChoiceExpression,
    Expression,
    GroupExpression,
    OptionalExpression,
    ReferenceExpression,
    RepeatExpression,
    SequenceExpression,
    TerminalExpression,
} from './grammar/expression.js';
export { Grammar } from './grammar/grammar.js';
export { readGrammar } from './grammar/read-grammar.js';
export { ReadGrammarError } from './grammar/read-grammar-error.js';
export type { Production } from './grammar/production.js';
export type { TokenRule } from './grammar/token-rule.js';
export type {
    BuildTransform,
    DropTransform,
    FlattenTransform,
    FoldLeftTransform,
    FoldRightTransform,
    PassTransform,
    TransformExpression,
} from './grammar/transform-expression.js';
export type { TransformAlternative, TransformRule } from './grammar/transform-rule.js';
export { TransformSchema } from './grammar/transform-schema.js';
export {
    formatTableValidationIssues,
    validateGrammarTable,
} from './grammar/table-validator.js';
export type {
    FormatTableValidationOptions,
    TableValidationIssue,
    TableValidationSeverity,
} from './grammar/table-validator.js';
export { ParserLoadError } from './parser-load-error.js';

import { readGrammar } from './grammar/read-grammar.js';
import type { LrAlgorithm } from './parse-table/lr-algorithm.js';
import { parseLrAlgorithm } from './parse-table/lr-algorithm.js';
import { ParseTable } from './parse-table/parse-table.js';
import { ParserLoadError } from './parser-load-error.js';
import { ParserLr, parserFromTableJson } from './parser-lr.js';

/**
 * Builds a parser and table from grammar file text.
 *
 * @param source - Full `.grammar` file contents.
 * @param algorithm - LR algorithm used to build the table.
 * @returns Parser and parse table ready for lexing or parsing.
 */
export function parserFromGrammar(
    source: string,
    algorithm: LrAlgorithm = 'lr1',
): { parser: ParserLr; table: ParseTable }
{
    // Parse the grammar file.
    const grammar = readGrammar(source);

    // Build the LR table once.
    const table = ParseTable.fromGrammar(grammar, algorithm);

    return {
        parser: new ParserLr(grammar, table),
        table,
    };
}

/**
 * In-memory sources for constructing a parser and table from grammar or table input.
 */
export interface ParserSources
{
    readonly grammarSource?: string;
    readonly tableJson?: string;
    readonly algorithm?: string;
}

/**
 * Builds a parser and table from a grammar or table source string.
 *
 * @param options - Grammar source, table JSON, and optional algorithm.
 * @returns Parser and parse table ready for lexing or parsing.
 */
export function parserFromSources(
    options: ParserSources,
): { parser: ParserLr; table: ParseTable }
{
    // Prefer grammar source over a saved table when both are supplied.
    if (options.grammarSource !== undefined)
    {
        return parserFromGrammar(
            options.grammarSource,
            parseLrAlgorithm(options.algorithm),
        );
    }

    if (options.tableJson !== undefined)
    {
        return parserFromTableJson(options.tableJson);
    }

    throw new ParserLoadError('required: grammar source or table JSON');
}
