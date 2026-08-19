import type { Grammar } from '../grammar/grammar.js';
import type { TokenRule } from '../grammar/token-rule.js';

import { LexerCompileError } from './lexer-compile-error.js';

const REGEX_LITERAL_TOKEN = 'regex_literal';

/**
 * Builds anchored sticky RegExp flags for lexer rules.
 *
 * @param ruleFlags - Flag letters from the grammar token rule.
 * @returns Combined flags including `y` and excluding `g`.
 */
function lexerRegexFlags(ruleFlags: string): string
{
    const flags = new Set(ruleFlags.split(''));

    flags.delete('g');
    flags.add('y');

    return [...flags].join('');
}

/**
 * Compiled token or skip rule ready for anchored matching.
 */
export interface CompiledRule
{
    readonly name: string;
    readonly skip: boolean;
    readonly regex: RegExp;
}

/**
 * Compiled lexer rules for one grammar.
 */
export interface CompiledLexerRules
{
    readonly rules: readonly CompiledRule[];
}

/**
 * Compiles token and skip rules from a grammar for streaming lexing.
 *
 * @param grammar - Grammar supplying lexer rule definitions.
 * @returns Compiled rules for longest-match scanning.
 */
export function compileLexerRules(grammar: Grammar): CompiledLexerRules
{
    return {
        rules: [
            ...grammar.tokenRules.map((rule) => compileRule(rule, false)),
            ...grammar.skipRules.map((rule) => compileRule(rule, true)),
        ],
    };
}

/**
 * Compiles one grammar token or skip rule into an anchored regular expression.
 *
 * @param rule - Token rule from the grammar file.
 * @param skip - Whether matches should be discarded instead of emitted.
 * @returns A compiled rule for lexing.
 */
function compileRule(rule: TokenRule, skip: boolean): CompiledRule
{
    try
    {
        return {
            name: rule.name,
            skip,
            regex: new RegExp(`(?:${rule.pattern})`, lexerRegexFlags(rule.flags)),
        };
    }
    catch (error)
    {
        const message = error instanceof Error ? error.message : String(error);
        throw new LexerCompileError(rule.name, message);
    }
}

/**
 * Matches a compiled rule at the start of a source slice.
 *
 * @param rule - Compiled token or skip rule.
 * @param source - Full buffered source text.
 * @param start - Offset into `source` where matching should begin.
 * @returns Matched lexeme text, or null when the rule does not match.
 */
export function matchRule(rule: CompiledRule, source: string, start = 0): string | null
{
    rule.regex.lastIndex = start;
    const match = rule.regex.exec(source);

    if (match === null || match.index !== start)
    {
        return null;
    }

    let text = match[0];

    // Extend regex literals with optional JS flag letters after the closing slash.
    if (rule.name === REGEX_LITERAL_TOKEN)
    {
        const suffix = /^[gimsuy]*/.exec(source.slice(start + text.length));

        if (suffix !== null)
        {
            text += suffix[0];
        }
    }

    return text;
}

/**
 * Returns whether more input could extend the match via a different token rule.
 *
 * @param buffer - Buffered source not yet consumed.
 * @param matchedText - Current best match at the buffer start.
 * @param rules - Candidate token and skip rules.
 */
export function hasLongerPossibleMatchCrossRule(
    buffer: string,
    matchedText: string,
    rules: readonly CompiledRule[],
): boolean
{
    const current = findLongestMatch(buffer, rules);

    if (current === null || current.text !== matchedText)
    {
        return false;
    }

    for (const suffix of ['=', '+', '-', '/', '"', '(', '0', 'a', 'X'])
    {
        const extendedMatch = findLongestMatch(buffer + suffix, rules);

        if (
            extendedMatch !== null
            && extendedMatch.text.length > current.text.length
            && extendedMatch.name !== current.name
        )
        {
            return true;
        }
    }

    return false;
}

/**
 * Returns whether a longer match may appear if more input arrives.
 *
 * @param buffer - Buffered source not yet consumed.
 * @param matchedText - Current best match at the buffer start.
 * @param rules - Candidate token and skip rules.
 * @param finished - Whether the input stream has ended.
 */
export function hasLongerPossibleMatch(
    buffer: string,
    matchedText: string,
    rules: readonly CompiledRule[],
    finished: boolean,
): boolean
{
    if (finished)
    {
        return false;
    }

    const current = findLongestMatch(buffer, rules);

    if (current === null || current.text !== matchedText)
    {
        return false;
    }

    for (const suffix of ['=', '+', '-', '/', '"', '(', '0', 'a', 'X'])
    {
        const extendedMatch = findLongestMatch(buffer + suffix, rules);

        if (extendedMatch !== null && extendedMatch.text.length > current.text.length)
        {
            return true;
        }
    }

    return false;
}

/**
 * Returns whether buffered input may become a token once more data arrives.
 *
 * @param buffer - Buffered source not yet consumed.
 * @param rules - Candidate token and skip rules.
 */
export function isPrefixOfPotentialMatch(
    buffer: string,
    rules: readonly CompiledRule[],
): boolean
{
    if (buffer.length === 0)
    {
        return true;
    }

    for (const suffix of ['=', '+', '-', '/', '"', '(', '0', 'a', 'X'])
    {
        const extended = buffer + suffix;
        const match = findLongestMatch(extended, rules);

        if (match !== null && match.text.startsWith(buffer) && match.text.length > buffer.length)
        {
            return true;
        }
    }

    return false;
}

/**
 * Finds the longest winning rule match at the start of a buffer.
 *
 * @param source - Buffered source text.
 * @param rules - Candidate token and skip rules.
 * @param start - Offset into `source` where matching should begin.
 * @returns The longest winning match, or null when nothing matches.
 */
export function findLongestMatch(
    source: string,
    rules: readonly CompiledRule[],
    start = 0,
): { name: string; text: string; skip: boolean } | null
{
    let bestMatch: { name: string; text: string; skip: boolean } | null = null;

    // Try every rule and keep the longest match, breaking ties by rule order.
    for (const rule of rules)
    {
        const matchedText = matchRule(rule, source, start);

        if (matchedText === null || matchedText.length === 0)
        {
            continue;
        }

        if (bestMatch === null || matchedText.length > bestMatch.text.length)
        {
            bestMatch = {
                name: rule.name,
                text: matchedText,
                skip: rule.skip,
            };
        }
    }

    return bestMatch;
}
