/**
 * Public library entry point for parser-lr.
 */

export { AstNode } from './ast/ast-node.js';
export type { SourceLocation } from './ast/ast-node.js';
export type {
    Alternative,
    ChoiceExpression,
    Expression,
    GroupExpression,
    OptionalExpression,
    Production,
    ReferenceExpression,
    RepeatExpression,
    SequenceExpression,
    TerminalExpression,
    TokenRule,
} from './grammar/index.js';
export { Grammar } from './grammar/index.js';
export { ParserLr } from './parser-lr.js';
