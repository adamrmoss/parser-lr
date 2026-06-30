import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readGrammar } from '../grammar/read-grammar.js';
import { Lexer } from './lexer.js';
import { EOF_TOKEN_NAME, eofToken, isEofToken } from './token.js';

const grammarsDirectory = join(process.cwd(), 'grammars');

/**
 * Reads a `.grammar` file from the project `grammars/` directory.
 *
 * @param filename - Grammar file basename.
 * @returns Parsed grammar model.
 */
function loadGrammarFile(filename: string)
{
    return readGrammar(readFileSync(join(grammarsDirectory, filename), 'utf8'));
}

describe('Lexer with grammars/', () =>
{
    it('lexes lisp source into s-expressions', () =>
    {
        const grammar = loadGrammarFile('lisp.grammar');
        const tokens = new Lexer(grammar).lex('(+ 1 "hi")');

        expect(tokens.map((value) => value.name)).toEqual([
            'lpar',
            'symbol',
            'number',
            'string',
            'rpar',
            EOF_TOKEN_NAME,
        ]);
        expect(tokens[0]?.text).toBe('(');
        expect(tokens[2]?.text).toBe('1');
        expect(tokens[3]?.text).toBe('"hi"');
        expect(isEofToken(tokens.at(-1)!)).toBe(true);
    });

    it('lexes 6502 source into assembler tokens', () =>
    {
        const grammar = loadGrammarFile('6502.grammar');
        const tokens = new Lexer(grammar).lex('start:\n    LDA #$01\n    BRK\n');

        expect(tokens.map((value) => value.name)).toEqual([
            'identifier',
            'colon',
            'memory_op',
            'hash',
            'hex_number',
            'implied_op',
            EOF_TOKEN_NAME,
        ]);
        expect(tokens[0]?.text).toBe('start');
        expect(tokens[4]?.text).toBe('$01');
        expect(tokens.at(-1)).toEqual(eofToken(tokens.at(-1)!.location.offset));
    });

    it('lexes meta-grammar source with regex literals and keywords', () =>
    {
        const grammar = loadGrammarFile('grammar.grammar');
        const snippet = 'name "grammar" ;\n\ntokens\n    name_kw = /name/ ;\n';
        const tokens = new Lexer(grammar).lex(snippet);

        expect(tokens.map((value) => value.name)).toContain('name_kw');
        expect(tokens.map((value) => value.name)).toContain('regex_literal');
        expect(tokens.map((value) => value.name)).toContain('string_literal');
        expect(tokens.at(-1)?.name).toBe(EOF_TOKEN_NAME);
    });

    it('lexes lisp source from chunked input', () =>
    {
        const grammar = loadGrammarFile('lisp.grammar');
        const lexer = new Lexer(grammar);
        const collected = [];

        for (const chunk of ['(+ ', '1 ', '2)'])
        {
            lexer.push(chunk);

            let nextToken = lexer.next();

            while (nextToken !== null)
            {
                collected.push(nextToken);
                nextToken = lexer.next();
            }
        }

        lexer.finish();

        let nextToken = lexer.next();

        while (nextToken !== null)
        {
            collected.push(nextToken);
            nextToken = lexer.next();
        }

        expect(collected.map((value) => value.name)).toEqual([
            'lpar',
            'symbol',
            'number',
            'number',
            'rpar',
            EOF_TOKEN_NAME,
        ]);
    });
});
