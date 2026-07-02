import type { Expression } from './expression.js';
import type { Grammar } from './grammar.js';
import type { TransformExpression } from './transform-expression.js';
import type { TransformRule } from './transform-rule.js';
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
                    alternative.expression,
                    issues,
                );
                collectPassCollapseWarnings(
                    grammar,
                    rule,
                    alternative.expression,
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
    reportDuplicateNames(
        grammar.productions.map((production) => production.name),
        'grammar',
        'production',
        issues,
    );

    // Flag repeated ast type names.
    if (grammar.astSchema !== null)
    {
        reportDuplicateNames(
            grammar.astSchema.types.map((type) => type.name),
            'ast',
            'type',
            issues,
        );
    }

    // Flag repeated transform rules for the same production.
    if (grammar.transformSchema !== null)
    {
        reportDuplicateNames(
            grammar.transformSchema.rules.map((rule) => rule.production),
            'transform',
            'rule',
            issues,
        );
    }
}

/**
 * Records a warning for each name that appears more than once.
 *
 * @param names - Declared names in source order.
 * @param section - Grammar section name for the message.
 * @param kind - Declaration kind for the message.
 * @param issues - Issue list to append to.
 */
function reportDuplicateNames(
    names: readonly string[],
    section: string,
    kind: string,
    issues: TableValidationIssue[],
): void
{
    const seen = new Set<string>();
    const reported = new Set<string>();

    for (const name of names)
    {
        if (seen.has(name) && !reported.has(name))
        {
            issues.push({
                severity: 'warning',
                message: `duplicate ${section} ${kind} ${JSON.stringify(name)}; `
                    + `the later definition overrides the earlier one`,
            });
            reported.add(name);
        }

        seen.add(name);
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
    if (!bnfProductionNames.has(rule.production))
    {
        issues.push({
            severity: 'error',
            message: `transform rule for unknown production ${JSON.stringify(rule.production)}`,
        });
    }
}

/**
 * Validates one transform expression against the grammar AST schema.
 *
 * @param grammar - Parsed grammar model.
 * @param expression - Transform expression to validate.
 * @param issues - Issue list to append to.
 */
function validateTransformExpression(
    grammar: Grammar,
    expression: TransformExpression,
    issues: TableValidationIssue[],
): void
{
    switch (expression.kind)
    {
        case 'build':
            validateAstTarget(grammar, expression.typeName, expression.variant, issues);
            break;

        case 'foldLeft':
        case 'foldRight':
        case 'flatten':
            validateAstTarget(grammar, expression.typeName, expression.variant, issues);
            break;

        case 'drop':
        case 'pass':
            break;
    }
}

/**
 * Records an error when a transform references an undefined AST type or variant.
 *
 * @param grammar - Parsed grammar model.
 * @param typeName - AST type name from a transform expression.
 * @param variant - AST variant label from a transform expression.
 * @param issues - Issue list to append to.
 */
function validateAstTarget(
    grammar: Grammar,
    typeName: string,
    variant: string,
    issues: TableValidationIssue[],
): void
{
    if (grammar.astSchema === null)
    {
        issues.push({
            severity: 'error',
            message: `transform references ${typeName}.${variant} but the grammar has no ast section`,
        });

        return;
    }

    const astType = grammar.astSchema.type(typeName);

    if (astType === null)
    {
        issues.push({
            severity: 'error',
            message: `transform references undefined ast type ${JSON.stringify(typeName)}`,
        });

        return;
    }

    const variants = collectAstVariants(astType.expression);

    if (!variants.includes(variant))
    {
        issues.push({
            severity: 'error',
            message: `transform references ${typeName}.${variant} which is not declared in ast`,
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
 * @param expression - Transform expression for one alternative.
 * @param bnfProductions - Desugared BNF productions.
 * @param issues - Issue list to append to.
 */
function collectPassCollapseWarnings(
    grammar: Grammar,
    rule: TransformRule,
    expression: TransformExpression,
    bnfProductions: readonly BnfProduction[],
    issues: TableValidationIssue[],
): void
{
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
 * Formats validation issues as stderr warning or error lines.
 *
 * @param issues - Validation issues to format.
 */
export function formatTableValidationIssues(issues: readonly TableValidationIssue[]): string[]
{
    return issues.map((issue) =>
        issue.severity === 'error'
            ? `error: ${issue.message}`
            : `warning: ${issue.message}`);
}
