/**
 * Public library entry point for parser-lr.
 */

export { AstNode } from './ast/ast-node.js';
export type { SourceLocation } from './ast/ast-node.js';
export type {
    EbnfChoiceExpression,
    EbnfExpression,
    EbnfGroupExpression,
    EbnfOptionalExpression,
    EbnfReferenceExpression,
    EbnfRepeatExpression,
    EbnfSequenceExpression,
    EbnfTerminalExpression,
    EbnfRule,
} from './grammar/index.js';
export { EbnfGrammar } from './grammar/index.js';
export { ParserLr } from './parser-lr.js';
