import { AstNode } from '../ast/ast-node.js';
import type { TransformExpression } from '../grammar/transform-expression.js';
import type { TransformAlternative } from '../grammar/transform-rule.js';
import type { TransformSchema } from '../grammar/transform-schema.js';
import { AUGMENTED_START_SYMBOL } from '../parse-table/bnf/bnf-grammar.js';
import type { ParseTableProductionJson } from '../parse-table/parse-table-json.js';
import type { ParseTable } from '../parse-table/parse-table.js';
import { mergeChildLocations } from '../shift-reduce/shift-reduce-engine.js';

import { productionSlots, referenceSlotIndex, type ProductionSlot } from './binding-map.js';

/**
 * Applies CST-to-AST transform rules to a concrete syntax tree.
 */
export class CstTransformer
{
    private readonly schema: TransformSchema;
    private readonly table: ParseTable;

    /**
     * Creates a transformer for a transform schema and parse table.
     *
     * @param schema - CST-to-AST rules from the grammar `transform` section.
     * @param table - Parse table supplying production metadata for reference lookup.
     */
    public constructor(schema: TransformSchema, table: ParseTable)
    {
        this.schema = schema;
        this.table = table;
    }

    /**
     * Transforms a concrete syntax tree into an abstract syntax tree.
     *
     * @param cst - Parse tree rooted at the grammar start symbol.
     * @returns Transformed AST, or null when transformation fails.
     */
    public transform(cst: AstNode | null): AstNode | null
    {
        if (cst === null)
        {
            return null;
        }

        return this.transformNode(cst);
    }

    /**
     * Transforms a CST using a transform schema and parse table.
     *
     * @param cst - Parse tree rooted at the grammar start symbol.
     * @param schema - CST-to-AST rules from the grammar `transform` section.
     * @param table - Parse table supplying production metadata for reference lookup.
     */
    public static transform(
        cst: AstNode | null,
        schema: TransformSchema,
        table: ParseTable,
    ): AstNode | null
    {
        if (cst === null)
        {
            return null;
        }

        return new CstTransformer(schema, table).transform(cst);
    }

    /**
     * Transforms one CST node and its descendants.
     *
     * @param node - CST node to transform.
     */
    private transformNode(node: AstNode): AstNode | null
    {
        if (node.isTerminal)
        {
            return node;
        }

        if (node.symbol === AUGMENTED_START_SYMBOL)
        {
            return node.children.length === 1
                ? this.transformNode(node.children[0])
                : null;
        }

        const rule = this.schema.rule(node.symbol) ?? (
            node.origin === null ? null : this.schema.rule(node.origin)
        );

        if (rule === null)
        {
            return this.defaultTransform(node);
        }

        const alternative = this.findAlternative(rule.alternatives, node);

        if (alternative === null)
        {
            return this.defaultTransform(node);
        }

        return this.applyExpression(node, alternative.expression);
    }

    /**
     * Applies one transform expression to a CST node.
     *
     * @param node - CST node being transformed.
     * @param expression - Transform expression for the matched alternative.
     */
    private applyExpression(node: AstNode, expression: TransformExpression): AstNode | null
    {
        switch (expression.kind)
        {
            case 'drop':
                return null;

            case 'pass':
                return this.transformReference(node, expression.reference);

            case 'build':
                return this.applyBuild(node, expression);

            case 'foldLeft':
                return this.applyFoldLeft(node, expression);

            case 'foldRight':
                return this.applyFoldRight(node, expression);

            case 'flatten':
                return this.applyFlatten(node, expression);
        }
    }

    /**
     * Builds an AST node from a `type.#variant(arg, …)` transform.
     *
     * @param node - CST node supplying bound child references.
     * @param expression - Build transform expression.
     */
    private applyBuild(
        node: AstNode,
        expression: Extract<TransformExpression, { kind: 'build' }>,
    ): AstNode | null
    {
        const children: AstNode[] = [];

        for (const reference of expression.arguments)
        {
            const child = this.transformReference(node, reference);

            if (child === null)
            {
                return null;
            }

            children.push(child);
        }

        return AstNode.rule(
            expression.typeName,
            children,
            mergeChildLocations(children) ?? node.location,
            expression.variant,
        );
    }

    /**
     * Left-folds repeated infix operators into chained AST nodes.
     *
     * @param node - CST node for one operator application or repeat segment.
     * @param expression - Fold-left transform expression.
     */
    private applyFoldLeft(
        node: AstNode,
        expression: Extract<TransformExpression, { kind: 'foldLeft' }>,
    ): AstNode | null
    {
        const slots = this.resolveReferences(node, expression.references);

        if (slots === null)
        {
            return null;
        }

        const [leftRef, operatorRef, rightRef] = expression.references;
        const left = this.transformReference(node, leftRef);
        const operator = this.transformReference(node, operatorRef);
        const right = this.transformReference(node, rightRef);

        if (left === null || operator === null || right === null)
        {
            return null;
        }

        let acc = this.buildAstNode(
            expression.typeName,
            expression.variant,
            [left, operator, right],
            node.location,
        );
        let tail = this.findRepeatTail(node, slots);

        while (tail !== null && !this.isEpsilonNode(tail))
        {
            const tailSlots = this.resolveReferences(tail, expression.references);

            if (tailSlots === null)
            {
                return null;
            }

            const tailOperator = this.transformReference(tail, operatorRef);
            const tailRight = this.transformReference(tail, rightRef);

            if (tailOperator === null || tailRight === null)
            {
                return null;
            }

            acc = this.buildAstNode(
                expression.typeName,
                expression.variant,
                [acc, tailOperator, tailRight],
                mergeChildLocations([acc, tailRight]) ?? node.location,
            );
            tail = this.findRepeatTail(tail, tailSlots);
        }

        return acc;
    }

    /**
     * Right-folds repeated infix operators into chained AST nodes.
     *
     * @param node - CST node for one operator application or repeat segment.
     * @param expression - Fold-right transform expression.
     */
    private applyFoldRight(
        node: AstNode,
        expression: Extract<TransformExpression, { kind: 'foldRight' }>,
    ): AstNode | null
    {
        const parts: {
            readonly left: AstNode;
            readonly operator: AstNode;
            readonly right: AstNode;
        }[] = [];
        let current: AstNode | null = node;

        while (current !== null && !this.isEpsilonNode(current))
        {
            const leftRef = expression.references[0];
            const operatorRef = expression.references[1];
            const rightRef = expression.references[2];

            if (leftRef === undefined || operatorRef === undefined || rightRef === undefined)
            {
                return null;
            }

            const slots = this.resolveReferences(current, expression.references);

            if (slots === null)
            {
                return null;
            }

            const left = this.transformReference(current, leftRef);
            const operator = this.transformReference(current, operatorRef);
            const right = this.transformReference(current, rightRef);

            if (left === null || operator === null || right === null)
            {
                return null;
            }

            parts.push({ left, operator, right });
            current = this.findRepeatTail(current, slots);
        }

        if (parts.length === 0)
        {
            return null;
        }

        let acc = parts[parts.length - 1]?.right ?? null;

        for (let index = parts.length - 1; index >= 0; index -= 1)
        {
            const part = parts[index];

            if (part === undefined || acc === null)
            {
                return null;
            }

            acc = this.buildAstNode(
                expression.typeName,
                expression.variant,
                [part.left, part.operator, acc],
                mergeChildLocations([part.left, acc]) ?? node.location,
            );
        }

        return acc;
    }

    /**
     * Flattens a `{ head tail }` repetition into one list AST node.
     *
     * @param node - CST node for one repeat segment.
     * @param expression - Flatten transform expression.
     */
    private applyFlatten(
        node: AstNode,
        expression: Extract<TransformExpression, { kind: 'flatten' }>,
    ): AstNode | null
    {
        const items: AstNode[] = [];
        let current: AstNode | null = node;

        while (current !== null && !this.isEpsilonNode(current))
        {
            const head = this.transformReference(current, expression.head);

            if (head === null)
            {
                return null;
            }

            items.push(head);
            current = this.transformReference(current, expression.tail);
        }

        return AstNode.rule(
            expression.typeName,
            items,
            mergeChildLocations(items) ?? node.location,
            expression.variant,
        );
    }

    /**
     * Transforms a CST node without explicit transform rules.
     *
     * @param node - CST node to pass through or unwrap.
     */
    private defaultTransform(node: AstNode): AstNode | null
    {
        if (this.isEpsilonNode(node))
        {
            return null;
        }

        const children = this.transformChildren(node.children);

        if (children.length === 1)
        {
            return children[0];
        }

        if (children.length === 0)
        {
            return null;
        }

        return AstNode.rule(
            node.symbol,
            children,
            mergeChildLocations(children) ?? node.location,
            node.variant,
        );
    }

    /**
     * Transforms and compacts a list of child CST nodes.
     *
     * @param children - Child CST nodes.
     */
    private transformChildren(children: readonly AstNode[]): AstNode[]
    {
        const transformed: AstNode[] = [];

        for (const child of children)
        {
            const node = this.transformNode(child);

            if (node !== null)
            {
                transformed.push(node);
            }
        }

        return transformed;
    }

    /**
     * Transforms one referenced child of a CST node.
     *
     * @param node - Parent CST node.
     * @param reference - Binding or symbol name from a transform expression.
     */
    private transformReference(node: AstNode, reference: string): AstNode | null
    {
        const child = this.resolveReferenceNode(node, reference);

        if (child === null)
        {
            return null;
        }

        return this.transformNode(child);
    }

    /**
     * Returns the CST child for a transform reference name.
     *
     * @param node - Parent CST node.
     * @param reference - Binding or symbol name from a transform expression.
     */
    private resolveReferenceNode(node: AstNode, reference: string): AstNode | null
    {
        const production = this.productionFor(node);

        if (production !== null)
        {
            const slotIndex = referenceSlotIndex(production, reference);

            if (slotIndex !== null)
            {
                return node.children[slotIndex] ?? null;
            }
        }

        for (const child of node.children)
        {
            if (child.symbol === reference || child.origin === reference)
            {
                return child;
            }
        }

        return null;
    }

    /**
     * Resolves transform references to CST child nodes.
     *
     * @param node - Parent CST node.
     * @param references - Reference names from a transform expression.
     */
    private resolveReferences(
        node: AstNode,
        references: readonly string[],
    ): AstNode[] | null
    {
        const resolved: AstNode[] = [];

        for (const reference of references)
        {
            const child = this.resolveReferenceNode(node, reference);

            if (child === null)
            {
                return null;
            }

            resolved.push(child);
        }

        return resolved;
    }

    /**
     * Returns the recursive tail child for a repeat production node.
     *
     * @param node - Repeat CST node.
     * @param resolved - Resolved reference child nodes.
     */
    private findRepeatTail(node: AstNode, resolved: readonly AstNode[]): AstNode | null
    {
        const lastChild = node.children[node.children.length - 1];

        if (lastChild !== undefined && (lastChild.symbol === node.symbol || lastChild.origin === node.origin))
        {
            return lastChild;
        }

        for (const child of resolved)
        {
            if (child.symbol === node.symbol || child.origin === node.origin)
            {
                return child;
            }
        }

        return null;
    }

    /**
     * Returns whether a CST node represents an epsilon production.
     *
     * @param node - CST node to test.
     */
    private isEpsilonNode(node: AstNode): boolean
    {
        if (node.isTerminal)
        {
            return false;
        }

        if (node.children.length > 0)
        {
            return false;
        }

        const production = this.productionFor(node);

        return production !== null && production.rhs.length === 0;
    }

    /**
     * Returns parse table production metadata for a CST node.
     *
     * @param node - CST node reduced by a known production.
     */
    private productionFor(node: AstNode): ParseTableProductionJson | null
    {
        if (node.productionId === null)
        {
            return null;
        }

        return this.table.production(node.productionId);
    }

    /**
     * Finds the transform alternative matching a CST node variant.
     *
     * @param alternatives - Transform alternatives for one production.
     * @param node - CST node being transformed.
     */
    private findAlternative(
        alternatives: readonly TransformAlternative[],
        node: AstNode,
    ): TransformAlternative | null
    {
        if (node.variant !== null)
        {
            const matched = alternatives.find((alternative) => alternative.label === node.variant);

            if (matched !== undefined)
            {
                return matched;
            }
        }

        if (alternatives.length === 1)
        {
            return alternatives[0];
        }

        return null;
    }

    /**
     * Builds an AST interior node from transformed children.
     *
     * @param typeName - AST type name.
     * @param variant - AST variant label.
     * @param children - Transformed child nodes.
     * @param location - Optional source span.
     */
    private buildAstNode(
        typeName: string,
        variant: string,
        children: readonly AstNode[],
        location: AstNode['location'],
    ): AstNode
    {
        return AstNode.rule(
            typeName,
            [...children],
            location,
            variant,
        );
    }
}

/**
 * Transforms a CST into an AST using transform rules and production metadata.
 *
 * @param cst - Parse tree rooted at the grammar start symbol.
 * @param schema - CST-to-AST rules from the grammar `transform` section.
 * @param table - Parse table supplying production metadata for reference lookup.
 */
export function transformCst(
    cst: AstNode | null,
    schema: TransformSchema,
    table: ParseTable,
): AstNode | null
{
    return CstTransformer.transform(cst, schema, table);
}

/**
 * Returns indexed slots for one production, for use in tests and diagnostics.
 *
 * @param production - Parse table production metadata.
 */
export function describeProductionSlots(
    production: ParseTableProductionJson,
): readonly ProductionSlot[]
{
    return productionSlots(production);
}
