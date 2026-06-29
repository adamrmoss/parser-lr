import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readGrammar } from './read-grammar.js';

const grammarsDirectory = join(process.cwd(), 'grammars');

/**
 * Reads a `.grammar` file from the project `grammars/` directory.
 *
 * @param filename - Grammar file basename.
 * @returns Full grammar file text.
 */
function readGrammarFile(filename: string): string
{
    return readFileSync(join(grammarsDirectory, filename), 'utf8');
}

describe('grammars/', () =>
{
    it('parses every .grammar file in the directory', () =>
    {
        const grammarFiles = readdirSync(grammarsDirectory)
            .filter((filename) => filename.endsWith('.grammar'));

        expect(grammarFiles.length).toBeGreaterThan(0);

        for (const filename of grammarFiles)
        {
            expect(() => readGrammar(readGrammarFile(filename))).not.toThrow();
        }
    });

    describe('grammar.grammar', () =>
    {
        const grammar = readGrammar(readGrammarFile('grammar.grammar'));

        it('declares the meta-grammar name and start symbol', () =>
        {
            expect(grammar.name).toBe('grammar');
            expect(grammar.startSymbol).toBe('grammar_file');
        });

        it('defines lexer sections for grammar file tokens', () =>
        {
            expect(grammar.tokenRules.map((rule) => rule.name)).toEqual(
                expect.arrayContaining([
                    'name_kw',
                    'tokens_kw',
                    'regex_literal',
                    'string_literal',
                    'identifier',
                ]),
            );
            expect(grammar.skipRules.map((rule) => rule.name)).toEqual(
                expect.arrayContaining(['whitespace', 'comment']),
            );
        });

        it('defines parser productions for grammar file structure', () =>
        {
            expect(grammar.hasProduction('grammar_file')).toBe(true);
            expect(grammar.hasProduction('token_def')).toBe(true);
            expect(grammar.hasProduction('production')).toBe(true);
            expect(grammar.hasProduction('expression')).toBe(true);
            expect(grammar.hasProduction('transform_rule')).toBe(true);
        });

        it('omits optional ast and transform sections in the meta-grammar itself', () =>
        {
            expect(grammar.astSchema).toBeNull();
            expect(grammar.transformSchema).toBeNull();
        });
    });

    describe('lisp.grammar', () =>
    {
        const grammar = readGrammar(readGrammarFile('lisp.grammar'));

        it('declares the lisp grammar name and start symbol', () =>
        {
            expect(grammar.name).toBe('lisp');
            expect(grammar.startSymbol).toBe('program');
        });

        it('defines s-expression lexer tokens', () =>
        {
            expect(grammar.tokenRules).toEqual([
                { name: 'lpar', pattern: '\\(', flags: '' },
                { name: 'rpar', pattern: '\\)', flags: '' },
                { name: 'number', pattern: '[+-]?[0-9]+', flags: '' },
                {
                    name: 'symbol',
                    pattern: '[a-zA-Z+*\\-\\/=<>?!_][a-zA-Z0-9+*\\-\\/=<>?!_]*',
                    flags: '',
                },
                { name: 'string', pattern: '"(?:\\\\.|[^"\\\\])*"', flags: '' },
            ]);
        });

        it('skips whitespace and semicolon comments', () =>
        {
            expect(grammar.skipRules).toEqual([
                { name: 'whitespace', pattern: '[ \\t\\r\\n]+', flags: '' },
                { name: 'comment', pattern: ';[^\\n\\r]*', flags: '' },
            ]);
        });

        it('defines list and atom productions', () =>
        {
            expect(grammar.production('program')?.expression).toEqual({
                kind: 'repeat',
                element: { kind: 'reference', name: 'form' },
            });
            expect(grammar.production('form')?.expression).toEqual({
                kind: 'choice',
                alternatives: [
                    {
                        label: null,
                        expression: { kind: 'reference', name: 'list' },
                    },
                    {
                        label: null,
                        expression: { kind: 'reference', name: 'atom' },
                    },
                ],
            });
            expect(grammar.production('list')?.expression).toEqual({
                kind: 'sequence',
                elements: [
                    { kind: 'reference', name: 'lpar' },
                    {
                        kind: 'repeat',
                        element: { kind: 'reference', name: 'form' },
                    },
                    { kind: 'reference', name: 'rpar' },
                ],
            });
            expect(grammar.production('atom')?.expression).toEqual({
                kind: 'choice',
                alternatives: [
                    {
                        label: null,
                        expression: { kind: 'reference', name: 'number' },
                    },
                    {
                        label: null,
                        expression: { kind: 'reference', name: 'symbol' },
                    },
                    {
                        label: null,
                        expression: { kind: 'reference', name: 'string' },
                    },
                ],
            });
        });
    });

    describe('6502.grammar', () =>
    {
        const grammar = readGrammar(readGrammarFile('6502.grammar'));

        it('declares the 6502 grammar name and start symbol', () =>
        {
            expect(grammar.name).toBe('6502');
            expect(grammar.startSymbol).toBe('program');
        });

        it('defines assembler lexer tokens', () =>
        {
            expect(grammar.tokenRules.map((rule) => rule.name)).toEqual([
                'dot',
                'colon',
                'comma',
                'hash',
                'lpar',
                'rpar',
                'mnemonic',
                'identifier',
                'hex_number',
                'x_reg',
                'y_reg',
            ]);
        });

        it('defines labeled line and instruction productions', () =>
        {
            const line = grammar.production('line')?.expression;
            expect(line).toEqual({
                kind: 'choice',
                alternatives: [
                    {
                        label: 'directive',
                        expression: { kind: 'reference', name: 'directive' },
                    },
                    {
                        label: 'labeled',
                        expression: {
                            kind: 'sequence',
                            elements: [
                                { kind: 'reference', name: 'label' },
                                { kind: 'reference', name: 'colon' },
                                {
                                    kind: 'optional',
                                    element: { kind: 'reference', name: 'instruction' },
                                },
                            ],
                        },
                    },
                    {
                        label: 'code',
                        expression: { kind: 'reference', name: 'instruction' },
                    },
                ],
            });

            const instruction = grammar.production('instruction')?.expression;
            expect(instruction?.kind).toBe('choice');
            expect(instruction?.kind === 'choice' && instruction.alternatives.map((alt) => alt.label)).toEqual([
                'implied',
                'immediate',
                'absolute',
                'indexed_x',
                'indexed_y',
                'indirect_x',
                'relative',
            ]);
        });

        it('defines immediate and relative instruction shapes', () =>
        {
            expect(grammar.production('immediate')?.expression).toEqual({
                kind: 'sequence',
                elements: [
                    { kind: 'reference', name: 'mnemonic' },
                    { kind: 'reference', name: 'hash' },
                    { kind: 'reference', name: 'hex_number' },
                ],
            });
            expect(grammar.production('relative')?.expression).toEqual({
                kind: 'sequence',
                elements: [
                    { kind: 'reference', name: 'mnemonic' },
                    { kind: 'reference', name: 'identifier' },
                ],
            });
        });
    });
});
