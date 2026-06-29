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
export { ParserLr } from './parser-lr.js';
