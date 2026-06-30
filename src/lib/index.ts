/**
 * Public library entry point for parser-lr.
 */

export { AstNode } from './ast/ast-node.js';
export type { SourceLocation } from './ast/ast-node.js';
export type {
    Alternative,
    AstType,
    BoundReferenceExpression,
    BuildTransform,
    ChoiceExpression,
    DropTransform,
    Expression,
    FlattenTransform,
    FoldLeftTransform,
    FoldRightTransform,
    GroupExpression,
    OptionalExpression,
    PassTransform,
    Production,
    ReferenceExpression,
    RepeatExpression,
    SequenceExpression,
    TerminalExpression,
    TokenRule,
    TransformAlternative,
    TransformExpression,
    TransformRule,
} from './grammar/index.js';
export { AstSchema, Grammar, TransformSchema } from './grammar/index.js';
export { ReadGrammarError, readGrammar } from './grammar/index.js';
export { Lexer, LexerCompileError, lexChunkStream, lexChunkStreamAsync, lexChunks, lexChunksAsync } from './lexer/index.js';
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
export { PARSE_TABLE_VERSION, ParseTable, isLrAlgorithm, parseLrAlgorithm, tokenInventory } from './parse-table/index.js';
export type { LrAlgorithm, ParseTableJson } from './parse-table/index.js';
export { ParseContext } from './parse-context.js';
export type { ParseContextSources } from './parse-context.js';
export { formatParseOutput } from './parse-output.js';
export { ParserLr } from './parser-lr.js';
export { parseWithTable, ShiftReduceEngine } from './shift-reduce/index.js';
export { transformCst, CstTransformer } from './transform/index.js';
