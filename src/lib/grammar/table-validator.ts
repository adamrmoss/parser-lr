import type { SourceLocation } from '../ast/ast-node.js';
import { formatDiagnostic } from '../diagnostics/format-diagnostic.js';
import type { Expression } from './expression.js';
import type { Grammar } from './grammar.js';
import type { TransformExpression } from './transform-expression.js';
import type { TransformAlternative, TransformRule } from './transform-rule.js';
import { EbnfDesugarer } from '../parse-table/bnf/desugar-ebnf.js';
import type { BnfProduction } from '../parse-table/bnf/bnf-production.js';
import type { BnfSymbol } from '../parse-table/bnf/bnf-symbol.js';

/**
 * Severity of one grammar table validation issue.
 */
export type TableValidationSeverity = 'error' | 'warning';

/**
 * One transform or AST consistency issue found during table validation.
 */
export interface TableValidationIssue
{
    readonly severity: TableValidationSeverity;
    readonly message: string;
    readonly location: SourceLocation | null;
}

/**
 * Optional path and source text used when formatting validation diagnostics.
 */
export interface FormatTableValidationOptions
{
    readonly path?: string | null;
    readonly source?: string | null;
}

/**
 * Validates transform and AST consistency for a parsed grammar.
 *
 * @param grammar - Parsed `.grammar` file model.
 * @returns Validation errors and warnings.
 */
export function validateGrammarTable(grammar: Grammar): TableValidationIssue[]
{
    const issues: TableValidationIssue[] = [];
    const bnf = new EbnfDesugarer(grammar).desugar();
    const bnfProductionNames = new Set(bnf.productions.map((production) => production.name));

    collectDuplicateDefinitionWarnings(grammar, issues);

    if (grammar.transformSchema !== null)
    {
        for (const rule of grammar.transformSchema.rules)
        {
            validateTransformProductionExists(rule, bnfProductionNames, issues);

            for (const alternative of rule.alternatives)
            {
                validateTransformExpression(
                    grammar,
                    rule,
                    alternative,
                    issues,
                );
                collectPassCollapseWarnings(
                    grammar,
                    rule,
                    alternative,
                    bnf.productions,
                    issues,
                );
            }
        }
    }

    return issues;
}

/**
 * Warns when a grammar redeclares a production, ast type, or transform rule.
 *
 * @remarks
 * Later definitions silently replace earlier ones during grammar loading, so a
 * duplicate almost always signals a copy-paste mistake (for example EduBASIC's
 * duplicated statement blocks).
 *
 * @param grammar - Parsed grammar model.
 * @param issues - Issue list to append to.
 */
function collectDuplicateDefinitionWarnings(
    grammar: Grammar,
    issues: TableValidationIssue[],
): void
{
    // Flag repeated production names in the grammar section.
    reportDuplicateDefinitions(
        grammar.productions.map((production) => ({
            name: production.name,
            location: production.location ?? null,
        })),
        'grammar',
        'production',
        issues,
    );

    // Flag repeated ast type names.
    if (grammar.astSchema !== null)
    {
        reportDuplicateDefinitions(
            grammar.astSchema.types.map((type) => ({
                name: type.name,
                location: type.location ?? null,
            })),
            'ast',
            'type',
            issues,
        );
    }

    // Flag repeated transform rules for the same production.
    if (grammar.transformSchema !== null)
    {
        reportDuplicateDefinitions(
            grammar.transformSchema.rules.map((rule) => ({
                name: rule.production,
                location: rule.location ?? null,
            })),
            'transform',
            'rule',
            issues,
        );
    }
}

/**
 * Records a warning for each name that appears more than once.
 *
 * @param definitions - Declared names and locations in source order.
 * @param section - Grammar section name for the message.
 * @param kind - Declaration kind for the message.
 * @param issues - Issue list to append to.
 */
function reportDuplicateDefinitions(
    definitions: readonly { name: string; location: SourceLocation | null }[],
    section: string,
    kind: string,
    issues: TableValidationIssue[],
): void
{
    const seen = new Set<string>();
    const reported = new Set<string>();

    for (const definition of definitions)
    {
        if (seen.has(definition.name) && !reported.has(definition.name))
        {
            issues.push({
                severity: 'warning',
                message: `duplicate ${section} ${kind} ${JSON.stringify(definition.name)}; `
                    + `the later definition overrides the earlier one`,
                location: definition.location,
            });
            reported.add(definition.name);
        }

        seen.add(definition.name);
    }
}

/**
 * Records an error when a transform rule names an unknown production.
 *
 * @param rule - Transform rule to validate.
 * @param bnfProductionNames - Desugared production names.
 * @param issues - Issue list to append to.
 */
function validateTransformProductionExists(
    rule: TransformRule,
    bnfProductionNames: ReadonlySet<string>,
    issues: TableValidationIssue[],
): void
{
    // Accept direct production names.
    if (bnfProductionNames.has(rule.production))
    {
        return;
    }

    // Match authored `$repeat_0` aliases to globally numbered repeats.
    const repeatPrefix = syntheticRepeatPrefix(rule.production);
    const matchesRepeat = repeatPrefix !== null
        && [...bnfProductionNames].some(
            (productionName) => syntheticRepeatPrefix(productionName) === repeatPrefix,
        );

    if (!matchesRepeat)
    {
        issues.push({
            severity: 'error',
            message: `transform rule for unknown production ${JSON.stringify(rule.production)}`,
            location: rule.location ?? null,
        });
    }
}

/**
 * Returns the stable prefix of a numbered synthetic repeat production.
 *
 * @param name - Production or transform-rule name.
 * @returns Prefix ending in `$repeat`, or null for a regular production.
 */
function syntheticRepeatPrefix(name: string): string | null
{
    const match = /^(.+\$repeat)_\d+$/.exec(name);

    return match?.[1] ?? null;
}

/**
 * Validates one transform expression against the grammar AST schema.
 *
 * @param grammar - Parsed grammar model.
 * @param alternative - Transform alternative owning the expression.
 * @param issues - Issue list to append to.
 */
function validateTransformExpression(
    grammar: Grammar,
    rule: TransformRule,
    alternative: TransformAlternative,
    issues: TableValidationIssue[],
): void
{
    const expression = alternative.expression;
    const location = alternative.location ?? null;

    switch (expression.kind)
    {
        case 'build':
            validateAstTarget(grammar, expression.typeName, expression.variant, location, issues);
            validateBuildArity(grammar, rule, alternative, expression, location, issues);
            break;

        case 'foldLeft':
        case 'foldRight':
        case 'flatten':
            validateAstTarget(grammar, expression.typeName, expression.variant, location, issues);
            break;

        case 'drop':
        case 'pass':
            break;
    }
}

/**
 * Records an error when a build argument list conflicts with a zero-factor shape.
 *
 * @remarks
 * Build argument counts are not required to match grammar or AST slot counts in
 * general: keywords may be dropped, punctuation may be kept, and child
 * productions may build a shared parent AST variant. The only coherent checks
 * are zero-factor cases and empty builds targeting a non-empty AST variant.
 *
 * @param grammar - Parsed grammar model.
 * @param rule - Transform rule owning the build expression.
 * @param alternative - Transform alternative owning the build expression.
 * @param expression - Build transform expression.
 * @param location - Source span of the transform alternative.
 * @param issues - Issue list to append to.
 */
function validateBuildArity(
    grammar: Grammar,
    rule: TransformRule,
    alternative: TransformAlternative,
    expression: Extract<TransformExpression, { kind: 'build' }>,
    location: SourceLocation | null,
    issues: TableValidationIssue[],
): void
{
    const argumentCount = expression.arguments.length;
    const production = grammar.production(rule.production);

    // Reject build arguments on a labeled zero-factor grammar alternative.
    if (production !== null)
    {
        const alternativeExpression = findGrammarAlternativeExpression(
            production.expression,
            alternative.label,
        );

        if (alternativeExpression !== null
            && isZeroFactorExpression(alternativeExpression)
            && argumentCount > 0)
        {
            issues.push({
                severity: 'error',
                message: `transform ${expression.typeName}.${expression.variant} has `
                    + `${String(argumentCount)} argument(s) but ast variant declares 0`,
                location,
            });
            return;
        }
    }

    if (grammar.astSchema === null)
    {
        return;
    }

    const astType = grammar.astSchema.type(expression.typeName);

    if (astType === null)
    {
        return;
    }

    const variantExpression = findAstVariantExpression(astType.expression, expression.variant);

    if (variantExpression === null)
    {
        return;
    }

    // Reject build arguments on a zero-factor AST variant.
    if (isZeroFactorExpression(variantExpression))
    {
        if (argumentCount > 0)
        {
            issues.push({
                severity: 'error',
                message: `transform ${expression.typeName}.${expression.variant} has `
                    + `${String(argumentCount)} argument(s) but ast variant declares 0`,
                location,
            });
        }

        return;
    }

    // Reject empty builds that target a non-empty AST variant.
    if (argumentCount === 0)
    {
        issues.push({
            severity: 'error',
            message: `transform ${expression.typeName}.${expression.variant} has `
                + `0 argument(s) but ast variant requires 1`,
            location,
        });
    }
}

/**
 * Returns whether an expression is a labeled zero-factor alternative.
 *
 * @param expression - Grammar or AST alternative expression.
 */
function isZeroFactorExpression(expression: Expression): boolean
{
    return expression.kind === 'sequence' && expression.elements.length === 0;
}

/**
 * Returns the expression for one labeled grammar alternative.
 *
 * @param expression - Production right-hand side expression.
 * @param label - Transform alternative label.
 */
function findGrammarAlternativeExpression(expression: Expression, label: string): Expression | null
{
    if (expression.kind === 'choice')
    {
        for (const alternative of expression.alternatives)
        {
            if (alternative.label === label)
            {
                return alternative.expression;
            }
        }

        if (label === 'main' && expression.alternatives.length === 1)
        {
            return expression.alternatives[0]?.expression ?? null;
        }

        return null;
    }

    if (label === 'main')
    {
        return expression;
    }

    return null;
}

/**
 * Returns the expression for one labeled AST alternative.
 *
 * @param expression - AST type right-hand side.
 * @param variant - Variant label to find.
 */
function findAstVariantExpression(expression: Expression, variant: string): Expression | null
{
    if (expression.kind === 'choice')
    {
        for (const alternative of expression.alternatives)
        {
            if (alternative.label === variant)
            {
                return alternative.expression;
            }
        }

        return null;
    }

    if (expression.kind === 'sequence' || expression.kind === 'group')
    {
        const inner = expression.kind === 'sequence'
            ? expression.elements[0]
            : expression.element;

        if (inner === undefined)
        {
            return null;
        }

        return findAstVariantExpression(inner, variant);
    }

    return null;
}

/**
 * Records an error when a transform references an undefined AST type or variant.
 *
 * @param grammar - Parsed grammar model.
 * @param typeName - AST type name from a transform expression.
 * @param variant - AST variant label from a transform expression.
 * @param location - Source span of the transform alternative.
 * @param issues - Issue list to append to.
 */
function validateAstTarget(
    grammar: Grammar,
    typeName: string,
    variant: string,
    location: SourceLocation | null,
    issues: TableValidationIssue[],
): void
{
    if (grammar.astSchema === null)
    {
        issues.push({
            severity: 'error',
            message: `transform references ${typeName}.${variant} but the grammar has no ast section`,
            location,
        });

        return;
    }

    const astType = grammar.astSchema.type(typeName);

    if (astType === null)
    {
        issues.push({
            severity: 'error',
            message: `transform references undefined ast type ${JSON.stringify(typeName)}`,
            location,
        });

        return;
    }

    const variants = collectAstVariants(astType.expression);

    if (!variants.includes(variant))
    {
        issues.push({
            severity: 'error',
            message: `transform references ${typeName}.${variant} which is not declared in ast`,
            location,
        });
    }
}

/**
 * Collects variant labels declared on one AST type expression.
 *
 * @param expression - AST type right-hand side expression.
 */
function collectAstVariants(expression: Expression): string[]
{
    if (expression.kind === 'choice')
    {
        return expression.alternatives
            .map((alternative) => alternative.label)
            .filter((label): label is string => label !== null);
    }

    if (expression.kind === 'sequence' || expression.kind === 'group')
    {
        const inner = expression.kind === 'sequence'
            ? expression.elements[0]
            : expression.element;

        if (inner === undefined)
        {
            return [];
        }

        return collectAstVariants(inner);
    }

    return [];
}

/**
 * Warns when pass(boundSlot) may collapse a single-terminal child production.
 *
 * @param grammar - Parsed grammar model.
 * @param rule - Parent production transform rule.
 * @param alternative - Transform alternative containing the pass expression.
 * @param bnfProductions - Desugared BNF productions.
 * @param issues - Issue list to append to.
 */
function collectPassCollapseWarnings(
    grammar: Grammar,
    rule: TransformRule,
    alternative: TransformAlternative,
    bnfProductions: readonly BnfProduction[],
    issues: TableValidationIssue[],
): void
{
    const expression = alternative.expression;

    if (expression.kind !== 'pass')
    {
        return;
    }

    const parentProduction = grammar.production(rule.production);

    if (parentProduction === null)
    {
        return;
    }

    const boundSymbol = resolveBindingSymbol(parentProduction.expression, expression.reference);

    if (boundSymbol === null || !grammar.hasProduction(boundSymbol))
    {
        return;
    }

    if (grammar.transformSchema?.hasRule(boundSymbol) === true)
    {
        return;
    }

    if (!hasSingleTerminalAlternative(boundSymbol, bnfProductions))
    {
        return;
    }

    issues.push({
        severity: 'warning',
        message: `pass(${expression.reference}) on ${rule.production} binds ${boundSymbol} `
            + `which has no transform rule and can match a single terminal; `
            + `add a transform for ${boundSymbol} or use build`,
        location: alternative.location ?? null,
    });
}

/**
 * Returns the symbol bound to a slot name on one production expression.
 *
 * @param expression - Production right-hand side expression.
 * @param binding - Binding name from a pass transform.
 */
function resolveBindingSymbol(expression: Expression, binding: string): string | null
{
    if (expression.kind === 'boundReference' && expression.binding === binding)
    {
        return expression.name;
    }

    if (expression.kind === 'sequence')
    {
        for (const element of expression.elements)
        {
            const resolved = resolveBindingSymbol(element, binding);

            if (resolved !== null)
            {
                return resolved;
            }
        }
    }

    if (expression.kind === 'choice')
    {
        for (const alternative of expression.alternatives)
        {
            const resolved = resolveBindingSymbol(alternative.expression, binding);

            if (resolved !== null)
            {
                return resolved;
            }
        }
    }

    if (expression.kind === 'optional' || expression.kind === 'group')
    {
        return resolveBindingSymbol(expression.element, binding);
    }

    if (expression.kind === 'repeat')
    {
        return resolveBindingSymbol(expression.element, binding);
    }

    return null;
}

/**
 * Returns whether a production has a desugared alternative of one terminal symbol.
 *
 * @param productionName - Non-terminal production name.
 * @param bnfProductions - Desugared BNF productions.
 */
function hasSingleTerminalAlternative(
    productionName: string,
    bnfProductions: readonly BnfProduction[],
): boolean
{
    return bnfProductions.some((production) =>
        production.name === productionName
        && production.rhs.length === 1
        && isTerminalSymbol(production.rhs[0]));
}

/**
 * Returns whether a BNF symbol is a terminal token or literal.
 *
 * @param symbol - Desugared right-hand side symbol.
 */
function isTerminalSymbol(symbol: BnfSymbol | undefined): boolean
{
    return symbol?.kind === 'terminal' || symbol?.kind === 'token';
}

/**
 * Formats validation issues as stderr diagnostic lines.
 *
 * @param issues - Validation issues to format.
 * @param options - Optional grammar path and source text for line numbers.
 */
export function formatTableValidationIssues(
    issues: readonly TableValidationIssue[],
    options: FormatTableValidationOptions = {},
): string[]
{
    return issues.map((issue) => formatDiagnostic({
        severity: issue.severity,
        message: issue.message,
        path: options.path,
        source: options.source,
        location: issue.location,
    }));
}
