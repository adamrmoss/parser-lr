import type { Grammar } from '../grammar/grammar.js';
import type { TokenRule } from '../grammar/token-rule.js';

import { LexerError } from './lexer-error.js';
import { token } from './token.js';
import type { Token } from './token.js';

/**
 * Compiled token or skip rule ready for anchored matching.
 */
interface CompiledRule
{
    readonly name: string;
    readonly skip: boolean;
    readonly regex: RegExp;
}

const REGEX_LITERAL_SUFFIX = /^[gimsuy]*/;
const REGEX_LITERAL_TOKEN = 'regex_literal';

/**
 * Tokenizes source text using a grammar's `tokens` and `skip` sections.
 *
 * Longest match wins; on equal length, earlier rules win. Token rules are
 * tried before skip rules.
 */
export class Lexer
{
    private readonly rules: readonly CompiledRule[];

    /**
     * Creates a lexer from a parsed grammar.
     *
     * @param grammar - Grammar supplying token and skip rule definitions.
     */
    public constructor(grammar: Grammar)
    {
        // Compile token rules first so they win ties against skip rules.
        this.rules = [
            ...grammar.tokenRules.map((rule) => compileRule(rule, false)),
            ...grammar.skipRules.map((rule) => compileRule(rule, true)),
        ];
    }

    /**
     * Lexes an entire source string into a token stream.
     *
     * @param source - Input text to tokenize.
     * @returns Matched tokens in source order; skip rules produce no tokens.
     */
    public lex(source: string): readonly Token[]
    {
        const tokens: Token[] = [];
        let offset = 0;

        // Scan until the source is fully consumed.
        while (offset < source.length)
        {
            const match = this.matchAt(source, offset);

            if (match === null)
            {
                throw new LexerError(
                    `Unexpected character ${JSON.stringify(source[offset])} at offset ${offset}`,
                    offset,
                );
            }

            // Advance past skipped or emitted lexemes.
            offset += match.length;

            if (!match.skip)
            {
                tokens.push(token(match.name, match.text, match.offset));
            }
        }

        return tokens;
    }

    /**
     * Finds the winning rule match at a source offset.
     *
     * @param source - Full input text.
     * @param offset - Offset to match from.
     * @returns The longest winning match, or null when nothing matches.
     */
    private matchAt(
        source: string,
        offset: number,
    ): { name: string; text: string; offset: number; length: number; skip: boolean } | null
    {
        const slice = source.slice(offset);
        let bestMatch: {
            name: string;
            text: string;
            offset: number;
            length: number;
            skip: boolean;
        } | null = null;

        // Try every rule and keep the longest match, breaking ties by rule order.
        for (const rule of this.rules)
        {
            const matchedText = matchRule(rule, slice);

            if (matchedText === null || matchedText.length === 0)
            {
                continue;
            }

            if (
                bestMatch === null
                || matchedText.length > bestMatch.length
            )
            {
                bestMatch = {
                    name: rule.name,
                    text: matchedText,
                    offset,
                    length: matchedText.length,
                    skip: rule.skip,
                };
            }
        }

        return bestMatch;
    }
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
    return {
        name: rule.name,
        skip,
        regex: new RegExp(`^(?:${rule.pattern})`, rule.flags),
    };
}

/**
 * Matches a compiled rule at the start of a source slice.
 *
 * @param rule - Compiled token or skip rule.
 * @param slice - Remaining source text from the current offset.
 * @returns Matched lexeme text, or null when the rule does not match.
 */
function matchRule(rule: CompiledRule, slice: string): string | null
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
        const suffix = REGEX_LITERAL_SUFFIX.exec(slice.slice(text.length));

        if (suffix !== null)
        {
            text += suffix[0];
        }
    }

    return text;
}
