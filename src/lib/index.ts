/**
 * Public library entry point for parser-lr.
 */

export { AstNode } from './ast/ast-node.js';
export type { SourceLocation } from './ast/ast-node.js';
export type { AstType } from './grammar/ast-type.js';
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
export type { Grammar } from './grammar/grammar.js';
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
export { Lexer, LexerCompileError, LexerInputError, LexerStateError, lexChunkStream, lexChunkStreamAsync, lexChunks, lexChunksAsync } from './lexer/index.js';
export {
    DEFAULT_LEXER_STATE,
    EOF_TOKEN_NAME,
    LexerError,
    compileLexerRules,
    eofToken,
    isEofToken,
    token,
} from './lexer/index.js';
export type { CompiledLexerRules, CompiledRule, Token } from './lexer/index.js';
export { LrAlgorithmError, PARSE_TABLE_VERSION, ParseTable, ParseTableError, isLrAlgorithm, parseLrAlgorithm, tokenInventory } from './parse-table/index.js';
export type { LrAlgorithm, ParseTableJson } from './parse-table/index.js';
export { formatUserError, isParserLrError, messageContainsStackTrace, ParserLrError } from './errors/index.js';
export { ParseContextError } from './parse-context-error.js';
export { ParseOutputError } from './parse-output-error.js';
export { ParseContext } from './parse-context.js';
export type { ParseContextSources } from './parse-context.js';
export { formatParseOutput } from './parse-output.js';
export { ParserLr } from './parser-lr.js';
export { parseWithTable, parseWithTableResult, ShiftReduceEngine } from './shift-reduce/index.js';
export type { ShiftReduceParseResult } from './shift-reduce/index.js';
export { transformCst, CstTransformer } from './transform/index.js';
