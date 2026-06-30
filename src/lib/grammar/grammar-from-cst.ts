import type { AstNode } from '../ast/ast-node.js';

import type { AstType } from './ast-type.js';
import { AstSchema } from './ast-schema.js';
import type { Alternative, Expression } from './expression.js';
import { decodeStringLiteral, splitRegexLiteral } from './grammar-literals.js';
import { Grammar } from './grammar.js';
import type { Production } from './production.js';
import { ReadGrammarError } from './read-grammar-error.js';
import type { TokenRule } from './token-rule.js';
import type { TransformAlternative, TransformRule } from './transform-rule.js';
import type { TransformExpression } from './transform-expression.js';
import { TransformSchema } from './transform-schema.js';

/**
 * Builds a {@link Grammar} model from a meta-grammar concrete syntax tree.
 *
 * @param root - `grammar_file` CST root from the meta-grammar parser.
 * @returns Parsed grammar file model.
 */
export function grammarFromCst(root: AstNode): Grammar
{
    if (root.symbol !== 'grammar_file')
    {
        throw grammarError('Expected grammar file', root);
    }

    const name = parseNameDecl(requireChild(root, 'name_decl'));
    const tokenRules: TokenRule[] = [];
    const skipRules: TokenRule[] = [];
    const states: string[] = [];

    // Walk optional top-level sections from the desugared repeat subtree.
    for (const section of collectSections(root))
    {
        if (section.symbol === 'token_section')
        {
            tokenRules.push(...parseTokenSection(section));
            continue;
        }

        if (section.symbol === 'skip_section')
        {
            skipRules.push(...parseSkipSection(section));
            continue;
        }

        if (section.symbol === 'states_section')
        {
            states.push(...parseStatesSection(section));
        }
    }

    const startSymbol = parseStartDecl(requireChild(root, 'start_decl'));
    const productions = parseGrammarSection(requireChild(root, 'grammar_section'));
    const astTypes = parseOptionalAstSection(findChild(root, 'ast_section'));
    const transformRules = parseOptionalTransformSection(findChild(root, 'transform_section'));

    return new Grammar(
        name,
        tokenRules,
        skipRules,
        states,
        startSymbol,
        productions,
        astTypes === null ? null : new AstSchema(astTypes),
        transformRules === null ? null : new TransformSchema(transformRules),
    );
}

/**
 * Returns the first direct child with a matching symbol.
 *
 * @param node - Parent CST node.
 * @param symbol - Child production name.
 */
function findChild(node: AstNode, symbol: string): AstNode | null
{
    return node.children.find((child) => child.symbol === symbol) ?? null;
}

/**
 * Returns the first direct child with a matching symbol.
 *
 * @param node - Parent CST node.
 * @param symbol - Child production name.
 */
function requireChild(node: AstNode, symbol: string): AstNode
{
    const child = findChild(node, symbol);

    if (child === null)
    {
        throw grammarError(`Expected ${symbol}`, node);
    }

    return child;
}

/**
 * Collects top-level `token_section`, `skip_section`, and `states_section` nodes.
 *
 * @param root - `grammar_file` CST root.
 */
function collectSections(root: AstNode): AstNode[]
{
    const sectionSymbols = new Set(['token_section', 'skip_section', 'states_section']);
    const sections: AstNode[] = [];

    // Unwrap a `section` node into its concrete section production.
    const unwrapSection = (node: AstNode): void =>
    {
        if (sectionSymbols.has(node.symbol))
        {
            sections.push(node);
            return;
        }

        if (node.symbol === 'section')
        {
            for (const child of node.children)
            {
                unwrapSection(child);
            }
        }
    };

    // Walk nested `{ section }` repeat tails.
    const walkRepeat = (node: AstNode): void =>
    {
        for (const child of node.children)
        {
            if (child.symbol === 'section')
            {
                unwrapSection(child);
                continue;
            }

            if (isRepeatContainer(child))
            {
                walkRepeat(child);
            }
        }
    };

    for (const child of root.children)
    {
        if (child.symbol === 'section')
        {
            unwrapSection(child);
            continue;
        }

        if (isRepeatContainer(child))
        {
            walkRepeat(child);
        }
    }

    return sections;
}

/**
 * Returns whether a CST node is a desugared `{ … }` repeat container.
 *
 * @param node - Candidate repeat node.
 */
function isRepeatContainer(node: AstNode): boolean
{
    return node.variant !== null || node.symbol.includes('$repeat_');
}

/**
 * Collects repeated item nodes from a desugared `{ item }` CST subtree.
 *
 * @param parent - Parent production node.
 * @param itemSymbol - Repeated child production name.
 */
function collectRepeated(parent: AstNode, itemSymbol: string): AstNode[]
{
    const items: AstNode[] = [];

    for (const child of parent.children)
    {
        if (child.symbol === itemSymbol)
        {
            items.push(child);
            continue;
        }

        if (isRepeatContainer(child))
        {
            items.push(...collectRepeated(child, itemSymbol));
        }
    }

    return items;
}

/**
 * Parses `name … ;`.
 *
 * @param node - `name_decl` CST node.
 */
function parseNameDecl(node: AstNode): string
{
    return parseGrammarName(node);
}

/**
 * Parses a grammar name as an identifier or string literal.
 *
 * @param node - `name_decl` or `grammar_name` CST node.
 */
function parseGrammarName(node: AstNode): string
{
    const grammarName = findChild(node, 'grammar_name');

    if (grammarName !== null)
    {
        return parseGrammarName(grammarName);
    }

    const identifier = findChild(node, 'identifier');

    if (identifier !== null)
    {
        return terminalText(identifier);
    }

    const stringLiteral = findChild(node, 'string_literal');

    if (stringLiteral !== null)
    {
        return decodeStringLiteral(terminalText(stringLiteral));
    }

    throw grammarError('Expected grammar name', node);
}

/**
 * Parses a `tokens` section.
 *
 * @param node - `token_section` CST node.
 */
function parseTokenSection(node: AstNode): TokenRule[]
{
    return collectRepeated(node, 'token_def').map(parseTokenDef);
}

/**
 * Parses a `skip` section.
 *
 * @param node - `skip_section` CST node.
 */
function parseSkipSection(node: AstNode): TokenRule[]
{
    return collectRepeated(node, 'token_def').map(parseTokenDef);
}

/**
 * Parses one token definition (`identifier = /…/ ;`).
 *
 * @param node - `token_def` CST node.
 */
function parseTokenDef(node: AstNode): TokenRule
{
    const name = identifierText(requireChild(node, 'identifier'));
    const regexLiteral = terminalText(requireChild(node, 'regex_literal'));
    const { pattern, flags } = splitRegexLiteral(regexLiteral);

    return { name, pattern, flags };
}

/**
 * Parses a `states` section.
 *
 * @param node - `states_section` CST node.
 */
function parseStatesSection(node: AstNode): string[]
{
    return collectRepeated(node, 'state_name').map(parseStateName);
}

/**
 * Parses one state name.
 *
 * @param node - `state_name` CST node.
 */
function parseStateName(node: AstNode): string
{
    return identifierText(requireChild(node, 'identifier'));
}

/**
 * Parses `start identifier ;`.
 *
 * @param node - `start_decl` CST node.
 */
function parseStartDecl(node: AstNode): string
{
    return identifierText(requireChild(node, 'identifier'));
}

/**
 * Parses a `grammar` section.
 *
 * @param node - `grammar_section` CST node.
 */
function parseGrammarSection(node: AstNode): Production[]
{
    return collectRepeated(node, 'production').map(parseProduction);
}

/**
 * Parses an optional `ast` section.
 *
 * @param node - `ast_section` CST node, or null when omitted.
 */
function parseOptionalAstSection(node: AstNode | null): AstType[] | null
{
    if (node === null)
    {
        return null;
    }

    return collectRepeated(node, 'ast_type').map(parseAstType);
}

/**
 * Parses an optional `transform` section.
 *
 * @param node - `transform_section` CST node, or null when omitted.
 */
function parseOptionalTransformSection(node: AstNode | null): TransformRule[] | null
{
    if (node === null)
    {
        return null;
    }

    return collectRepeated(node, 'transform_rule').map(parseTransformRule);
}

/**
 * Parses one production (`identifier = expression ;`).
 *
 * @param node - `production` CST node.
 */
function parseProduction(node: AstNode): Production
{
    const name = identifierText(requireChild(node, 'identifier'));
    const expression = parseExpressionNode(findExpressionChild(node));

    return { name, expression };
}

/**
 * Parses one AST type (`identifier = expression ;`).
 *
 * @param node - `ast_type` CST node.
 */
function parseAstType(node: AstNode): AstType
{
    const name = identifierText(requireChild(node, 'identifier'));
    const expression = parseExpressionNode(findExpressionChild(node));

    return { name, expression };
}

/**
 * Parses one transform rule.
 *
 * @param node - `transform_rule` CST node.
 */
function parseTransformRule(node: AstNode): TransformRule
{
    const production = identifierText(requireChild(node, 'identifier'));

    return {
        production,
        alternatives: collectRepeated(node, 'labeled_transform').map(parseLabeledTransform),
    };
}

/**
 * Parses `# label transform_expr`.
 *
 * @param node - `labeled_transform` CST node.
 */
function parseLabeledTransform(node: AstNode): TransformAlternative
{
    const label = identifierText(requireChild(node, 'identifier'));
    const expression = parseTransformExpr(requireChild(node, 'transform_expr'));

    return { label, expression };
}

/**
 * Parses a transform expression.
 *
 * @param node - `transform_expr` CST node.
 */
function parseTransformExpr(node: AstNode): TransformExpression
{
    const passExpr = findChild(node, 'pass_expr');

    if (passExpr !== null)
    {
        return parsePassExpr(passExpr);
    }

    const foldLeftExpr = findChild(node, 'fold_left_expr');

    if (foldLeftExpr !== null)
    {
        return parseFoldLeftExpr(foldLeftExpr);
    }

    const foldRightExpr = findChild(node, 'fold_right_expr');

    if (foldRightExpr !== null)
    {
        return parseFoldRightExpr(foldRightExpr);
    }

    const flattenExpr = findChild(node, 'flatten_expr');

    if (flattenExpr !== null)
    {
        return parseFlattenExpr(flattenExpr);
    }

    const buildExpr = findChild(node, 'build_expr');

    if (buildExpr !== null)
    {
        return parseBuildExpr(buildExpr);
    }

    if (findChild(node, 'drop_kw') !== null)
    {
        return { kind: 'drop' };
    }

    throw grammarError('Expected transform expression', node);
}

/**
 * Parses `pass(reference)`.
 *
 * @param node - `pass_expr` CST node.
 */
function parsePassExpr(node: AstNode): TransformExpression
{
    return {
        kind: 'pass',
        reference: parseReference(requireChild(node, 'reference')),
    };
}

/**
 * Parses `fold-left(type.#variant, references…)`.
 *
 * @param node - `fold_left_expr` CST node.
 */
function parseFoldLeftExpr(node: AstNode): TransformExpression
{
    const target = parseBuildTarget(requireChild(node, 'build_target'));

    return {
        kind: 'foldLeft',
        typeName: target.typeName,
        variant: target.variant,
        references: parseReferenceList(requireChild(node, 'reference_list')),
    };
}

/**
 * Parses `fold-right(type.#variant, references…)`.
 *
 * @param node - `fold_right_expr` CST node.
 */
function parseFoldRightExpr(node: AstNode): TransformExpression
{
    const target = parseBuildTarget(requireChild(node, 'build_target'));

    return {
        kind: 'foldRight',
        typeName: target.typeName,
        variant: target.variant,
        references: parseReferenceList(requireChild(node, 'reference_list')),
    };
}

/**
 * Parses `flatten(type.#variant, head, tail)`.
 *
 * @param node - `flatten_expr` CST node.
 */
function parseFlattenExpr(node: AstNode): TransformExpression
{
    const target = parseBuildTarget(requireChild(node, 'build_target'));
    const references = node.children.filter((child) => child.symbol === 'reference');

    if (references.length < 2)
    {
        throw grammarError('Expected flatten head and tail references', node);
    }

    return {
        kind: 'flatten',
        typeName: target.typeName,
        variant: target.variant,
        head: parseReference(references[0]!),
        tail: parseReference(references[1]!),
    };
}

/**
 * Parses `type.#variant` with an optional argument list.
 *
 * @param node - `build_expr` CST node.
 */
function parseBuildExpr(node: AstNode): TransformExpression
{
    const target = parseBuildTarget(requireChild(node, 'build_target'));
    const referenceList = findChild(node, 'reference_list');

    return {
        kind: 'build',
        typeName: target.typeName,
        variant: target.variant,
        arguments: referenceList === null ? [] : parseReferenceList(referenceList),
    };
}

/**
 * Parses `type.#variant`.
 *
 * @param node - `build_target` CST node.
 */
function parseBuildTarget(node: AstNode): { typeName: string; variant: string }
{
    const identifiers = collectRepeated(node, 'identifier');

    if (identifiers.length < 2)
    {
        throw grammarError('Expected build target type and variant', node);
    }

    return {
        typeName: identifierText(identifiers[0]!),
        variant: identifierText(identifiers[1]!),
    };
}

/**
 * Parses a comma-separated reference list.
 *
 * @param node - `reference_list` CST node.
 */
function parseReferenceList(node: AstNode): string[]
{
    return collectRepeated(node, 'reference').map(parseReference);
}

/**
 * Parses one reference name.
 *
 * @param node - `reference` CST node.
 */
function parseReference(node: AstNode): string
{
    return identifierText(requireChild(node, 'identifier'));
}

/**
 * Returns the expression subtree from a production-like CST node.
 *
 * @param node - Production, AST type, or similar CST node.
 */
function findExpressionChild(node: AstNode): AstNode
{
    const expression = findChild(node, 'expression')
        ?? findChild(node, 'choice');

    if (expression === null)
    {
        throw grammarError('Expected expression', node);
    }

    return expression;
}

/**
 * Collects `alternative` nodes and unwraps their `labeled_alternative` children.
 *
 * @param choice - `choice` CST node.
 */
function collectAlternatives(choice: AstNode): AstNode[]
{
    return collectRepeated(choice, 'alternative').map(
        (alternative) => requireChild(alternative, 'labeled_alternative'),
    );
}

/**
 * Parses a production or AST expression.
 *
 * @param node - `expression` or `choice` CST node.
 */
function parseExpressionNode(node: AstNode): Expression
{
    if (node.symbol === 'choice')
    {
        return parseChoice(node);
    }

    if (node.symbol === 'expression')
    {
        return parseExpressionNode(requireChild(node, 'choice'));
    }

    throw grammarError('Expected expression', node);
}

/**
 * Parses an alternation expression.
 *
 * @param node - `choice` CST node.
 */
function parseChoice(node: AstNode): Expression
{
    const alternatives = collectAlternatives(node).map(parseLabeledAlternative);

    if (alternatives.length === 1)
    {
        return alternatives[0]!.expression;
    }

    return {
        kind: 'choice',
        alternatives,
    };
}

/**
 * Parses one labeled or unlabeled alternative.
 *
 * @param node - `labeled_alternative` CST node.
 */
function parseLabeledAlternative(node: AstNode): Alternative
{
    const labelNode = findChild(node, 'identifier');
    const label = labelNode === null || findChild(node, 'hash') === null
        ? null
        : identifierText(labelNode);
    const sequence = requireChild(node, 'sequence');

    return {
        label,
        expression: parseSequence(sequence),
    };
}

/**
 * Parses a concatenated sequence expression.
 *
 * @param node - `sequence` CST node.
 */
function parseSequence(node: AstNode): Expression
{
    const elements = collectFactorNodes(node).map(
        (factor) => parseFactor(unwrapFactorContent(factor)),
    );

    if (elements.length === 1)
    {
        return elements[0]!;
    }

    return {
        kind: 'sequence',
        elements,
    };
}

/**
 * Collects `factor` nodes from a `sequence` subtree, including repeat tails.
 *
 * @param parent - `sequence` or repeat container node.
 */
function collectFactorNodes(parent: AstNode): AstNode[]
{
    const factors: AstNode[] = [];

    for (const child of parent.children)
    {
        if (child.symbol === 'factor')
        {
            factors.push(child);
            continue;
        }

        if (isRepeatContainer(child))
        {
            factors.push(...collectFactorNodes(child));
        }
    }

    return factors;
}

/**
 * Unwraps a `factor` node to its bracketed, repeat, group, or primary content.
 *
 * @param factor - `factor` CST node.
 */
function unwrapFactorContent(factor: AstNode): AstNode
{
    const content = factor.children[0];

    if (content === undefined)
    {
        throw grammarError('Expected factor content', factor);
    }

    if (content.symbol === 'primary')
    {
        const primary = content.children[0];

        if (primary === undefined)
        {
            throw grammarError('Expected primary content', content);
        }

        return primary;
    }

    return content;
}

/**
 * Parses one expression factor.
 *
 * @param node - Factor CST node.
 */
function parseFactor(node: AstNode): Expression
{
    if (node.symbol === 'bracketed')
    {
        return parseBracketed(node);
    }

    if (node.symbol === 'repeat')
    {
        return {
            kind: 'repeat',
            element: parseExpressionNode(findExpressionChild(node)),
        };
    }

    if (node.symbol === 'group')
    {
        return {
            kind: 'group',
            element: parseExpressionNode(findExpressionChild(node)),
        };
    }

    if (node.symbol === 'string_literal')
    {
        return {
            kind: 'terminal',
            value: decodeStringLiteral(terminalText(node)),
        };
    }

    if (node.symbol === 'identifier')
    {
        return {
            kind: 'reference',
            name: terminalText(node),
        };
    }

    throw grammarError('Expected expression factor', node);
}

/**
 * Parses a bracketed optional or bound reference.
 *
 * @param node - `bracketed` CST node.
 */
function parseBracketed(node: AstNode): Expression
{
    const expression = parseExpressionNode(findExpressionChild(node));
    const bindingReference = findChild(node, 'identifier');

    if (findChild(node, 'colon') !== null)
    {
        if (bindingReference === null)
        {
            throw grammarError('Expected bound reference name', node);
        }

        const binding = bindingNameFromExpression(expression, node);

        return {
            kind: 'boundReference',
            binding,
            name: identifierText(bindingReference),
        };
    }

    return {
        kind: 'optional',
        element: expression,
    };
}

/**
 * Returns the binding identifier from a bracketed bound-reference expression.
 *
 * @param expression - Inner expression of a bound reference.
 * @param node - `bracketed` CST node for error reporting.
 */
function bindingNameFromExpression(expression: Expression, node: AstNode): string
{
    if (expression.kind === 'reference')
    {
        return expression.name;
    }

    if (expression.kind === 'sequence' && expression.elements.length === 1)
    {
        return bindingNameFromExpression(expression.elements[0]!, node);
    }

    throw grammarError('Expected binding identifier in bound reference', node);
}

/**
 * Returns lexeme text from a terminal CST node.
 *
 * @param node - Terminal CST node.
 */
function terminalText(node: AstNode): string
{
    if (node.text === null)
    {
        throw grammarError(`Expected terminal text for ${node.symbol}`, node);
    }

    return node.text;
}

/**
 * Returns an identifier terminal's name text.
 *
 * @param node - `identifier` CST node.
 */
function identifierText(node: AstNode): string
{
    return terminalText(node);
}

/**
 * Builds a {@link ReadGrammarError} from a CST node location.
 *
 * @param message - Human-readable failure description.
 * @param node - CST node where reading failed.
 */
function grammarError(message: string, node: AstNode): ReadGrammarError
{
    return new ReadGrammarError(message, node.location?.offset ?? 0);
}
