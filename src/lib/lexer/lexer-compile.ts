import type { Grammar } from '../grammar/grammar.js';
import type { TokenRule } from '../grammar/token-rule.js';

import { LexerCompileError } from './lexer-compile-error.js';

/** Default lexer state when a grammar omits a `states` section. */
export const DEFAULT_LEXER_STATE = 'initial';

const REGEX_LITERAL_TOKEN = 'regex_literal';

/**
 * Compiled token or skip rule ready for anchored matching.
 */
export interface CompiledRule
{
    readonly name: string;
    readonly skip: boolean;
    readonly regex: RegExp;
    readonly states: readonly string[] | null;
}

/**
 * Compiled lexer rules and declared state names for one grammar.
 */
export interface CompiledLexerRules
{
    readonly states: readonly string[];
    readonly initialState: string;
    readonly rules: readonly CompiledRule[];
}

/**
 * Compiles token and skip rules from a grammar for streaming lexing.
 *
 * @param grammar - Grammar supplying lexer rule definitions.
 * @returns Compiled rules and lexer state metadata.
 */
export function compileLexerRules(grammar: Grammar): CompiledLexerRules
{
    const states = resolveLexerStates(grammar.states);

    return {
        states,
        initialState: states[0] ?? DEFAULT_LEXER_STATE,
        rules: [
            ...grammar.tokenRules.map((rule) => compileRule(rule, false)),
            ...grammar.skipRules.map((rule) => compileRule(rule, true)),
        ],
    };
}

/**
 * Returns compiled rules active in a lexer state.
 *
 * @param compiled - Compiled lexer rules for a grammar.
 * @param state - Current lexer state name.
 * @returns Rules that apply in the state, preserving declaration order.
 */
export function rulesForState(
    compiled: CompiledLexerRules,
    state: string,
): readonly CompiledRule[]
{
    return compiled.rules.filter((rule) => rule.states === null || rule.states.includes(state));
}

/**
 * Resolves declared lexer states, supplying a default when omitted.
 *
 * @param states - State names from the grammar `states` section.
 * @returns Non-empty state name list.
 */
export function resolveLexerStates(states: readonly string[]): readonly string[]
{
    if (states.length === 0)
    {
        return [DEFAULT_LEXER_STATE];
    }

    return states;
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
            regex: new RegExp(`^(?:${rule.pattern})`, rule.flags),
            states: rule.states === undefined ? null : [...rule.states],
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
 * @param slice - Remaining source text from the current offset.
 * @returns Matched lexeme text, or null when the rule does not match.
 */
export function matchRule(rule: CompiledRule, slice: string): string | null
{
    const match = rule.regex.exec(slice);

    if (match === null || match.index !== 0)
    {
        return null;
    }

    let text = match[0];

    // Extend regex literals with optional JS flag letters after the closing slash.
    if (rule.name === REGEX_LITERAL_TOKEN)
    {
        const suffix = /^[gimsuy]*/.exec(slice.slice(text.length));

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
 * @param rules - Candidate rules for the active lexer state.
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
 * @param rules - Candidate rules for the active lexer state.
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
 * @param rules - Candidate rules for the active lexer state.
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
 * @param buffer - Buffered source to match from the start.
 * @param rules - Candidate rules for the active lexer state.
 * @returns The longest winning match, or null when nothing matches.
 */
export function findLongestMatch(
    buffer: string,
    rules: readonly CompiledRule[],
): { name: string; text: string; skip: boolean } | null
{
    let bestMatch: { name: string; text: string; skip: boolean } | null = null;

    // Try every rule and keep the longest match, breaking ties by rule order.
    for (const rule of rules)
    {
        const matchedText = matchRule(rule, buffer);

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

/**
 * Validates that a lexer state name is declared in the grammar.
 *
 * @param compiled - Compiled lexer rules for a grammar.
 * @param state - Candidate lexer state name.
 */
export function assertLexerState(compiled: CompiledLexerRules, state: string): void
{
    if (!compiled.states.includes(state))
    {
        throw new Error(`Unknown lexer state ${JSON.stringify(state)}`);
    }
}
