import type { Expression } from './expression.js';
import {
    decodeStringLiteral,
    lexGrammarFile,
    splitRegexLiteral,
} from './grammar-file-lexer.js';
import type { GrammarFileToken, GrammarFileTokenKind } from './grammar-file-lexer.js';
import { AstSchema } from './ast-schema.js';
import type { AstType } from './ast-type.js';
import { Grammar } from './grammar.js';
import type { Production } from './production.js';
import { ReadGrammarError } from './read-grammar-error.js';
import type { TokenRule } from './token-rule.js';
import type { TransformAlternative } from './transform-rule.js';
import type { TransformRule } from './transform-rule.js';
import type { TransformExpression } from './transform-expression.js';
import { TransformSchema } from './transform-schema.js';

/**
 * Parses a `.grammar` source string into a {@link Grammar} model.
 *
 * @param source - Full grammar file text.
 * @returns Parsed grammar file model.
 */
export function readGrammar(source: string): Grammar
{
    const tokens = lexGrammarFile(source);
    const cursor = new TokenCursor(tokens);

    return parseGrammarFile(cursor);
}

/**
 * Walks grammar file tokens during parsing.
 */
class TokenCursor
{
    private index = 0;

    /**
     * Creates a cursor over a token stream.
     *
     * @param tokens - Lexed grammar file tokens.
     */
    public constructor(private readonly tokens: readonly GrammarFileToken[])
    {
    }

    /**
     * Returns the next token without consuming it.
     */
    public peek(): GrammarFileToken
    {
        return this.tokens[this.index] ?? {
            kind: 'eof',
            text: '',
            offset: this.tokens.at(-1)?.offset ?? 0,
        };
    }

    /**
     * Consumes and returns the next token.
     */
    public next(): GrammarFileToken
    {
        const token = this.peek();
        this.index += 1;
        return token;
    }

    /**
     * Consumes the next token when it matches an expected kind.
     *
     * @param kind - Expected token kind.
     * @returns The consumed token.
     */
    public expect(kind: GrammarFileTokenKind): GrammarFileToken
    {
        const token = this.next();

        if (token.kind !== kind)
        {
            throw new ReadGrammarError(
                `Expected ${kind}, found ${token.kind}`,
                token.offset,
            );
        }

        return token;
    }

    /**
     * Returns whether the next token matches a kind.
     *
     * @param kind - Candidate token kind.
     */
    public check(kind: GrammarFileTokenKind): boolean
    {
        return this.peek().kind === kind;
    }

    /**
     * Returns a token ahead of the current position without consuming it.
     *
     * @param distance - Zero-based offset from the current token.
     */
    public peekAhead(distance: number): GrammarFileToken
    {
        return this.tokens[this.index + distance] ?? {
            kind: 'eof',
            text: '',
            offset: this.peek().offset,
        };
    }
}

/**
 * Parses a full grammar file.
 *
 * @param cursor - Token cursor positioned at the file start.
 * @returns Parsed grammar model.
 */
function parseGrammarFile(cursor: TokenCursor): Grammar
{
    const name = parseNameDecl(cursor);
    const tokenRules: TokenRule[] = [];
    const skipRules: TokenRule[] = [];
    const states: string[] = [];

    // Parse optional top-level sections until `start`.
    while (
        cursor.check('tokens_kw')
        || cursor.check('skip_kw')
        || cursor.check('states_kw')
    )
    {
        if (cursor.check('tokens_kw'))
        {
            tokenRules.push(...parseTokenSection(cursor));
            continue;
        }

        if (cursor.check('skip_kw'))
        {
            skipRules.push(...parseSkipSection(cursor));
            continue;
        }

        states.push(...parseStatesSection(cursor));
    }

    const startSymbol = parseStartDecl(cursor);
    const productions = parseGrammarSection(cursor);
    const astTypes = parseOptionalAstSection(cursor);
    const transformRules = parseOptionalTransformSection(cursor);
    cursor.expect('eof');

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
 * Parses `name … ;`.
 *
 * @param cursor - Token cursor positioned at `name`.
 * @returns Grammar name text.
 */
function parseNameDecl(cursor: TokenCursor): string
{
    cursor.expect('name_kw');
    const name = parseGrammarName(cursor);
    cursor.expect('semicolon');

    return name;
}

/**
 * Parses a grammar name as an identifier or string literal.
 *
 * @param cursor - Token cursor positioned at the name token.
 * @returns Grammar name text.
 */
function parseGrammarName(cursor: TokenCursor): string
{
    const token = cursor.next();

    if (token.kind === 'identifier')
    {
        return token.text;
    }

    if (token.kind === 'string_literal')
    {
        return decodeStringLiteral(token.text);
    }

    throw new ReadGrammarError('Expected grammar name', token.offset);
}

/**
 * Parses a `tokens` section.
 *
 * @param cursor - Token cursor positioned at `tokens`.
 * @returns Token rules declared in the section.
 */
function parseTokenSection(cursor: TokenCursor): TokenRule[]
{
    cursor.expect('tokens_kw');

    const rules = [parseTokenDef(cursor)];

    while (cursor.check('identifier'))
    {
        rules.push(parseTokenDef(cursor));
    }

    return rules;
}

/**
 * Parses a `skip` section.
 *
 * @param cursor - Token cursor positioned at `skip`.
 * @returns Skip rules declared in the section.
 */
function parseSkipSection(cursor: TokenCursor): TokenRule[]
{
    cursor.expect('skip_kw');

    const rules = [parseTokenDef(cursor)];

    while (cursor.check('identifier'))
    {
        rules.push(parseTokenDef(cursor));
    }

    return rules;
}

/**
 * Parses one token definition (`identifier = /…/ ;`).
 *
 * @param cursor - Token cursor positioned at the rule name.
 * @returns Parsed token rule.
 */
function parseTokenDef(cursor: TokenCursor): TokenRule
{
    const name = cursor.expect('identifier').text;
    cursor.expect('equal');

    const regexToken = cursor.expect('regex_literal');
    const { pattern, flags } = splitRegexLiteral(regexToken.text);

    cursor.expect('semicolon');

    return { name, pattern, flags };
}

/**
 * Parses a `states` section.
 *
 * @param cursor - Token cursor positioned at `states`.
 * @returns State names declared in the section.
 */
function parseStatesSection(cursor: TokenCursor): string[]
{
    cursor.expect('states_kw');

    const states = [cursor.expect('identifier').text];

    while (cursor.check('comma'))
    {
        cursor.expect('comma');
        states.push(cursor.expect('identifier').text);
    }

    cursor.expect('semicolon');

    return states;
}

/**
 * Parses `start identifier ;`.
 *
 * @param cursor - Token cursor positioned at `start`.
 * @returns Start symbol name.
 */
function parseStartDecl(cursor: TokenCursor): string
{
    cursor.expect('start_kw');
    const startSymbol = cursor.expect('identifier').text;
    cursor.expect('semicolon');

    return startSymbol;
}

/**
 * Parses a `grammar` section.
 *
 * @param cursor - Token cursor positioned at `grammar`.
 * @returns Productions declared in the section.
 */
function parseGrammarSection(cursor: TokenCursor): Production[]
{
    cursor.expect('grammar_kw');

    const productions = [parseProduction(cursor)];

    while (cursor.check('identifier'))
    {
        productions.push(parseProduction(cursor));
    }

    return productions;
}

/**
 * Parses an optional `ast` section.
 *
 * @param cursor - Token cursor positioned at `ast` or the next section.
 * @returns AST types, or null when the section is omitted.
 */
function parseOptionalAstSection(cursor: TokenCursor): AstType[] | null
{
    if (!cursor.check('ast_kw'))
    {
        return null;
    }

    cursor.expect('ast_kw');

    const types: AstType[] = [parseAstType(cursor)];

    while (cursor.check('identifier'))
    {
        types.push(parseAstType(cursor));
    }

    return types;
}

/**
 * Parses an optional `transform` section.
 *
 * @param cursor - Token cursor positioned at `transform` or EOF.
 * @returns Transform rules, or null when the section is omitted.
 */
function parseOptionalTransformSection(cursor: TokenCursor): TransformRule[] | null
{
    if (!cursor.check('transform_kw'))
    {
        return null;
    }

    cursor.expect('transform_kw');

    const rules: TransformRule[] = [parseTransformRule(cursor)];

    while (cursor.check('identifier'))
    {
        rules.push(parseTransformRule(cursor));
    }

    return rules;
}

/**
 * Parses one production (`identifier = expression ;`).
 *
 * @param cursor - Token cursor positioned at the production name.
 * @returns Parsed production.
 */
function parseProduction(cursor: TokenCursor): Production
{
    const name = cursor.expect('identifier').text;
    cursor.expect('equal');
    const expression = parseExpression(cursor);
    cursor.expect('semicolon');

    return { name, expression };
}

/**
 * Parses one AST type (`identifier = expression ;`).
 *
 * @param cursor - Token cursor positioned at the type name.
 * @returns Parsed AST type.
 */
function parseAstType(cursor: TokenCursor): AstType
{
    const name = cursor.expect('identifier').text;
    cursor.expect('equal');
    const expression = parseExpression(cursor);
    cursor.expect('semicolon');

    return { name, expression };
}

/**
 * Parses one transform rule.
 *
 * @param cursor - Token cursor positioned at the production name.
 * @returns Parsed transform rule.
 */
function parseTransformRule(cursor: TokenCursor): TransformRule
{
    const production = cursor.expect('identifier').text;
    cursor.expect('arrow');

    const alternatives: TransformAlternative[] = [parseLabeledTransform(cursor)];

    while (cursor.check('bar'))
    {
        cursor.expect('bar');
        alternatives.push(parseLabeledTransform(cursor));
    }

    cursor.expect('semicolon');

    return { production, alternatives };
}

/**
 * Parses `# label transform_expr`.
 *
 * @param cursor - Token cursor positioned at `#`.
 * @returns Parsed labeled transform alternative.
 */
function parseLabeledTransform(cursor: TokenCursor): TransformAlternative
{
    cursor.expect('hash');
    const label = cursor.expect('identifier').text;
    const expression = parseTransformExpr(cursor);

    return { label, expression };
}

/**
 * Parses a transform expression.
 *
 * @param cursor - Token cursor positioned at the transform expression.
 * @returns Parsed transform expression.
 */
function parseTransformExpr(cursor: TokenCursor): TransformExpression
{
    if (cursor.check('drop_kw'))
    {
        cursor.expect('drop_kw');
        return { kind: 'drop' };
    }

    if (cursor.check('pass_kw'))
    {
        cursor.expect('pass_kw');
        cursor.expect('lpar');
        const reference = cursor.expect('identifier').text;
        cursor.expect('rpar');

        return { kind: 'pass', reference };
    }

    if (cursor.check('fold_left_kw'))
    {
        cursor.expect('fold_left_kw');
        cursor.expect('lpar');
        const target = parseBuildTarget(cursor);
        cursor.expect('comma');
        const references = parseReferenceList(cursor);
        cursor.expect('rpar');

        return {
            kind: 'foldLeft',
            typeName: target.typeName,
            variant: target.variant,
            references,
        };
    }

    if (cursor.check('fold_right_kw'))
    {
        cursor.expect('fold_right_kw');
        cursor.expect('lpar');
        const target = parseBuildTarget(cursor);
        cursor.expect('comma');
        const references = parseReferenceList(cursor);
        cursor.expect('rpar');

        return {
            kind: 'foldRight',
            typeName: target.typeName,
            variant: target.variant,
            references,
        };
    }

    if (cursor.check('flatten_kw'))
    {
        cursor.expect('flatten_kw');
        cursor.expect('lpar');
        const target = parseBuildTarget(cursor);
        cursor.expect('comma');
        const head = cursor.expect('identifier').text;
        cursor.expect('comma');
        const tail = cursor.expect('identifier').text;
        cursor.expect('rpar');

        return {
            kind: 'flatten',
            typeName: target.typeName,
            variant: target.variant,
            head,
            tail,
        };
    }

    const target = parseBuildTarget(cursor);
    const args = cursor.check('lpar') ? parseOptionalReferenceList(cursor) : [];

    return {
        kind: 'build',
        typeName: target.typeName,
        variant: target.variant,
        arguments: args,
    };
}

/**
 * Parses `type.#variant`.
 *
 * @param cursor - Token cursor positioned at the type name.
 * @returns Build target type and variant names.
 */
function parseBuildTarget(cursor: TokenCursor): { typeName: string; variant: string }
{
    const typeName = cursor.expect('identifier').text;
    cursor.expect('dot');
    cursor.expect('hash');
    const variant = cursor.expect('identifier').text;

    return { typeName, variant };
}

/**
 * Parses a comma-separated reference list in parentheses.
 *
 * @param cursor - Token cursor positioned at `(`.
 * @returns Reference names.
 */
function parseOptionalReferenceList(cursor: TokenCursor): string[]
{
    cursor.expect('lpar');
    const references = parseReferenceList(cursor);
    cursor.expect('rpar');

    return references;
}

/**
 * Parses one or more comma-separated references.
 *
 * @param cursor - Token cursor positioned at the first reference.
 * @returns Reference names.
 */
function parseReferenceList(cursor: TokenCursor): string[]
{
    const references = [cursor.expect('identifier').text];

    while (cursor.check('comma'))
    {
        cursor.expect('comma');
        references.push(cursor.expect('identifier').text);
    }

    return references;
}

/**
 * Parses a production or AST expression.
 *
 * @param cursor - Token cursor positioned at the expression start.
 * @returns Parsed expression tree.
 */
function parseExpression(cursor: TokenCursor): Expression
{
    return parseChoice(cursor);
}

/**
 * Parses an alternation expression.
 *
 * @param cursor - Token cursor positioned at the first alternative.
 * @returns Parsed choice expression.
 */
function parseChoice(cursor: TokenCursor): Expression
{
    const alternatives = [parseAlternative(cursor)];

    while (cursor.check('bar'))
    {
        cursor.expect('bar');
        alternatives.push(parseAlternative(cursor));
    }

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
 * @param cursor - Token cursor positioned at the alternative start.
 * @returns Parsed alternative.
 */
function parseAlternative(cursor: TokenCursor): { label: string | null; expression: Expression }
{
    let label: string | null = null;

    if (cursor.check('hash'))
    {
        cursor.expect('hash');
        label = cursor.expect('identifier').text;
    }

    return {
        label,
        expression: parseSequence(cursor),
    };
}

/**
 * Parses a concatenated sequence expression.
 *
 * @param cursor - Token cursor positioned at the first factor.
 * @returns Parsed sequence or single-factor expression.
 */
function parseSequence(cursor: TokenCursor): Expression
{
    const elements = [parseFactor(cursor)];

    while (isFactorStart(cursor.peek().kind))
    {
        elements.push(parseFactor(cursor));
    }

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
 * Parses one expression factor.
 *
 * @param cursor - Token cursor positioned at the factor start.
 * @returns Parsed factor expression.
 */
function parseFactor(cursor: TokenCursor): Expression
{
    if (cursor.check('lbracket'))
    {
        // Distinguish `[ slot ] : symbol` from `[ expression ]`.
        if (isBoundReferenceStart(cursor))
        {
            return parseBoundReference(cursor);
        }

        cursor.expect('lbracket');
        const element = parseExpression(cursor);
        cursor.expect('rbracket');

        return { kind: 'optional', element };
    }

    if (cursor.check('lbrace'))
    {
        cursor.expect('lbrace');
        const element = parseExpression(cursor);
        cursor.expect('rbrace');

        return { kind: 'repeat', element };
    }

    if (cursor.check('lpar'))
    {
        cursor.expect('lpar');
        const element = parseExpression(cursor);
        cursor.expect('rpar');

        return { kind: 'group', element };
    }

    return parsePrimary(cursor);
}

/**
 * Parses a primary expression.
 *
 * @param cursor - Token cursor positioned at the primary start.
 * @returns Parsed primary expression.
 */
function parsePrimary(cursor: TokenCursor): Expression
{
    if (cursor.check('string_literal'))
    {
        const literal = cursor.expect('string_literal');

        return {
            kind: 'terminal',
            value: decodeStringLiteral(literal.text),
        };
    }

    const name = cursor.expect('identifier').text;

    return { kind: 'reference', name };
}

/**
 * Parses a bound reference primary (`[slot]:symbol`).
 *
 * @param cursor - Token cursor positioned at `[`.
 * @returns Parsed bound reference expression.
 */
function parseBoundReference(cursor: TokenCursor): Expression
{
    cursor.expect('lbracket');
    const binding = cursor.expect('identifier').text;
    cursor.expect('rbracket');
    cursor.expect('colon');
    const name = cursor.expect('identifier').text;

    return { kind: 'boundReference', binding, name };
}

/**
 * Returns whether the next tokens begin a bound reference primary.
 *
 * @param cursor - Token cursor positioned at `[`.
 */
function isBoundReferenceStart(cursor: TokenCursor): boolean
{
    return cursor.check('lbracket')
        && cursor.peekAhead(1).kind === 'identifier'
        && cursor.peekAhead(2).kind === 'rbracket'
        && cursor.peekAhead(3).kind === 'colon';
}

/**
 * Returns whether a token kind can start another sequence factor.
 *
 * @param kind - Candidate token kind.
 */
function isFactorStart(kind: GrammarFileTokenKind): boolean
{
    return kind === 'lbracket'
        || kind === 'lbrace'
        || kind === 'lpar'
        || kind === 'string_literal'
        || kind === 'identifier';
}
