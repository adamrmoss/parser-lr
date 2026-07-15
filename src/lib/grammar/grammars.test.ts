import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readGrammar } from './read-grammar.js';
import { validateGrammarTable } from './table-validator.js';

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

        it('defines ast and transform sections for the meta-grammar', () =>
        {
            expect(grammar.astSchema).not.toBeNull();
            expect(grammar.transformSchema).not.toBeNull();
            expect(grammar.transformSchema?.rule('grammar_file$repeat_0')).toBeDefined();
            expect(grammar.transformSchema?.rule('token_section')).toBeDefined();
            expect(grammar.transformSchema?.rule('token_section$repeat_1')).toBeNull();
            expect(grammar.astSchema?.type('token_section')?.expression).toEqual({
                kind: 'choice',
                alternatives: [
                    {
                        label: 'definitions',
                        expression: {
                            kind: 'repeat',
                            element: {
                                kind: 'reference',
                                name: 'token_def',
                            },
                        },
                    },
                ],
            });
        });

        it('validates without transform errors', () =>
        {
            const issues = validateGrammarTable(grammar);

            expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
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

        it('defines labeled program AST and validate-clean transforms', () =>
        {
            expect(grammar.astSchema?.type('program')?.expression).toEqual({
                kind: 'choice',
                alternatives: [
                    {
                        label: 'program',
                        expression: {
                            kind: 'repeat',
                            element: {
                                kind: 'reference',
                                name: 'form',
                            },
                        },
                    },
                ],
            });
            expect(validateGrammarTable(grammar).filter((issue) => issue.severity === 'error')).toEqual([]);
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
                'implied_op',
                'branch_op',
                'memory_op',
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
                                {
                                    kind: 'boundReference',
                                    binding: 'label',
                                    name: 'label',
                                },
                                {
                                    kind: 'boundReference',
                                    binding: 'colon',
                                    name: 'colon',
                                },
                                {
                                    kind: 'boundReference',
                                    binding: 'insn',
                                    name: 'instruction',
                                },
                            ],
                        },
                    },
                    {
                        label: 'code',
                        expression: {
                            kind: 'boundReference',
                            binding: 'insn',
                            name: 'instruction',
                        },
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
            expect(grammar.astSchema).not.toBeNull();
            expect(grammar.transformSchema).not.toBeNull();
            expect(validateGrammarTable(grammar).filter((issue) => issue.severity === 'error')).toEqual([]);
        });

        it('defines immediate and relative instruction shapes', () =>
        {
            expect(grammar.production('immediate')?.expression).toEqual({
                kind: 'sequence',
                elements: [
                    {
                        kind: 'boundReference',
                        binding: 'op',
                        name: 'memory_op',
                    },
                    {
                        kind: 'boundReference',
                        binding: 'hash',
                        name: 'hash',
                    },
                    {
                        kind: 'boundReference',
                        binding: 'value',
                        name: 'hex_number',
                    },
                ],
            });
            expect(grammar.production('relative')?.expression).toEqual({
                kind: 'sequence',
                elements: [
                    {
                        kind: 'boundReference',
                        binding: 'op',
                        name: 'branch_op',
                    },
                    {
                        kind: 'boundReference',
                        binding: 'target',
                        name: 'identifier',
                    },
                ],
            });
        });
    });

    describe('ferrite.grammar', () =>
    {
        const grammar = readGrammar(readGrammarFile('ferrite.grammar'));

        it('declares the ferrite grammar name and start symbol', () =>
        {
            expect(grammar.name).toBe('ferrite');
            expect(grammar.startSymbol).toBe('program');
        });

        it('defines core declaration and expression productions', () =>
        {
            expect(grammar.hasProduction('file_namespace')).toBe(true);
            expect(grammar.hasProduction('using_directive')).toBe(true);
            expect(grammar.hasProduction('access_modifier')).toBe(true);
            expect(grammar.hasProduction('top_decl')).toBe(true);
            expect(grammar.hasProduction('struct_decl')).toBe(true);
            expect(grammar.hasProduction('function_decl')).toBe(true);
            expect(grammar.hasProduction('type_spec')).toBe(true);
            expect(grammar.hasProduction('assignment_expr')).toBe(true);
            expect(grammar.hasProduction('postfix_suffix')).toBe(true);
            expect(grammar.hasProduction('namespace_body')).toBe(false);
        });

        it('defines ast and transform sections', () =>
        {
            expect(grammar.astSchema).not.toBeNull();
            expect(grammar.transformSchema).not.toBeNull();
            expect(grammar.transformSchema?.rule('program$repeat_0')).toBeDefined();
            expect(grammar.transformSchema?.rule('program$repeat_1')).toBeDefined();
            expect(grammar.transformSchema?.rule('param_list')).toBeDefined();
            expect(grammar.transformSchema?.rule('param_list$repeat_0')).toBeNull();
            expect(validateGrammarTable(grammar).filter((issue) => issue.severity === 'error')).toEqual([]);
        });

        it('loads visibility and PascalCase built-in tokens', () =>
        {
            expect(grammar.tokenRules.find((rule) => rule.name === 'kw_public')?.pattern).toBe('public');
            expect(grammar.tokenRules.find((rule) => rule.name === 'kw_private')?.pattern).toBe('private');
            expect(grammar.tokenRules.find((rule) => rule.name === 'kw_int32')?.pattern).toBe('Int32');
            expect(grammar.tokenRules.find((rule) => rule.name === 'kw_uint8')?.pattern).toBe('UInt8');
            expect(grammar.tokenRules.find((rule) => rule.name === 'kw_void')?.pattern).toBe('Void');
            expect(grammar.tokenRules.find((rule) => rule.name === 'kw_float64')?.pattern).toBe('Float64');
        });

        it('loads numeric literals with documented regex suffix flags', () =>
        {
            expect(grammar.tokenRules.find((rule) => rule.name === 'int_literal')).toEqual({
                name: 'int_literal',
                pattern: '0x[0-9A-F]+|0b[01]+|[0-9]+',
                flags: 'i',
            });
            expect(grammar.tokenRules.find((rule) => rule.name === 'float_literal')).toEqual({
                name: 'float_literal',
                pattern: '[0-9]+\\.[0-9]+([E][+-]?[0-9]+)?|[0-9]+[E][+-]?[0-9]+',
                flags: 'i',
            });
        });
    });
});
