import type { Grammar } from '../grammar/grammar.js';
import { EOF_TOKEN_NAME } from '../lexer/token.js';

/**
 * Returns the ordered token rule names declared in a grammar.
 *
 * @param grammar - Parsed `.grammar` file model.
 * @returns Token names in declaration order, including `$eof`.
 */
export function tokenInventory(grammar: Grammar): readonly string[]
{
    const names = grammar.tokenRules.map((rule) => rule.name);

    if (names.includes(EOF_TOKEN_NAME))
    {
        return names;
    }

    return [...names, EOF_TOKEN_NAME];
}
