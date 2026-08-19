import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { readGrammar } from '../grammar/read-grammar.js';
import { Lexer } from './lexer.js';
import { EOF_TOKEN_NAME } from './token.js';

const fixturesDirectory = join(process.cwd(), 'grammars', 'fixtures', 'ebon-hex-matrix');

/** Rows and columns for the full nested-hex-matrix benchmark from edu-basic. */
const BENCHMARK_ROWS = 480;
const BENCHMARK_COLS = 640;

/** Generous post-fix bound; current lexer hits ~30+ s on this fixture (quadratic buffer slicing). */
const LEX_TIME_LIMIT_MS = 2_000;

/** Allow the slow unfixed lexer to finish so the time assertion reports the regression. */
const LEX_BENCHMARK_TIMEOUT_MS = 120_000;

/**
 * Reads the ebon-hex-matrix fixture grammar.
 *
 * @returns Parsed grammar model.
 */
function loadHexMatrixGrammar()
{
    return readGrammar(readFileSync(join(fixturesDirectory, 'ebon-hex-matrix.grammar'), 'utf8'));
}

/**
 * Builds a grammar with many unused token rules that never match hex-matrix input.
 *
 * @param dummyRuleCount - Number of `dummy_kw_*` rules to append.
 * @returns Parsed grammar model.
 */
function loadHexMatrixGrammarWithDummyRules(dummyRuleCount: number)
{
    const baseGrammar = readFileSync(join(fixturesDirectory, 'ebon-hex-matrix.grammar'), 'utf8');
    const tokenSectionEnd = baseGrammar.indexOf('\nskip');
    const dummyRules = Array.from({ length: dummyRuleCount }, (_, index) =>
    {
        const suffix = String(index + 1).padStart(3, '0');

        return `    dummy_kw_${suffix} = /ZZZ_DUMMY_${suffix}/ ;`;
    }).join('\n');
    const extendedSource = `${baseGrammar.slice(0, tokenSectionEnd)}\n${dummyRules}${baseGrammar.slice(tokenSectionEnd)}`;

    return readGrammar(extendedSource);
}

/**
 * Synthesizes a nested hex-integer matrix document for lexer benchmarks.
 *
 * @param rows - Number of inner row arrays.
 * @param cols - Hex literals per row.
 * @returns Source text shaped like edu-basic pixel matrices.
 */
function synthesizeHexMatrixSource(rows: number, cols: number): string
{
    const cell = '&H01020304';
    const rowLines: string[] = [];

    for (let rowIndex = 0; rowIndex < rows; rowIndex++)
    {
        const cells = Array.from({ length: cols }, () => cell).join(', ');
        const rowSuffix = rowIndex < rows - 1 ? ',' : '';

        rowLines.push(`\t\t[${cells}]${rowSuffix}`);
    }

    return `[\n${rowLines.join('\n')}\n]`;
}

/**
 * Counts emitted lexer tokens for a rows×cols hex matrix, including `$eof`.
 *
 * @param rows - Number of inner row arrays.
 * @param cols - Hex literals per row.
 * @returns Expected token count.
 */
function expectedHexMatrixTokenCount(rows: number, cols: number): number
{
    const hexCount = rows * cols;
    const commaCount = rows * (cols - 1) + (rows - 1);
    const bracketCount = 2 * (rows + 1);

    return hexCount + commaCount + bracketCount + 1;
}

describe('Lexer performance — nested hex matrix (edu-basic)', () =>
{
    const grammar = loadHexMatrixGrammar();

    it('tokenizes a small nested hex matrix with expected counts and samples', () =>
    {
        const source = synthesizeHexMatrixSource(2, 2);
        const tokens = new Lexer(grammar).lex(source);
        const nonEofTokens = tokens.filter((value) => value.name !== EOF_TOKEN_NAME);

        expect(tokens.length).toBe(expectedHexMatrixTokenCount(2, 2));
        expect(nonEofTokens[0]).toMatchObject({ name: 'lbracket', text: '[' });
        expect(nonEofTokens[1]).toMatchObject({ name: 'lbracket', text: '[' });
        expect(nonEofTokens[2]).toMatchObject({ name: 'hex_lit', text: '&H01020304' });
        expect(nonEofTokens.at(-1)).toMatchObject({ name: 'rbracket', text: ']' });
        expect(source.length).toBeGreaterThan(0);
    });

    it(
        `lexes a ${BENCHMARK_ROWS}×${BENCHMARK_COLS} hex matrix within ${LEX_TIME_LIMIT_MS} ms`,
        () =>
        {
            const source = synthesizeHexMatrixSource(BENCHMARK_ROWS, BENCHMARK_COLS);
            const lexer = new Lexer(grammar);
            const expectedTokenCount = expectedHexMatrixTokenCount(BENCHMARK_ROWS, BENCHMARK_COLS);

            expect(source.length).toBeGreaterThan(3_000_000);

            const startMs = performance.now();
            const tokens = lexer.lex(source);
            const lexMs = performance.now() - startMs;

            expect(tokens.length).toBe(expectedTokenCount);

            const nonEofTokens = tokens.filter((value) => value.name !== EOF_TOKEN_NAME);

            expect(nonEofTokens[0]).toMatchObject({ name: 'lbracket', text: '[' });
            expect(nonEofTokens[1]).toMatchObject({ name: 'lbracket', text: '[' });
            expect(nonEofTokens[2]).toMatchObject({ name: 'hex_lit', text: '&H01020304' });
            expect(nonEofTokens.at(-1)).toMatchObject({ name: 'rbracket', text: ']' });

            expect(lexMs).toBeLessThan(LEX_TIME_LIMIT_MS);
        },
        LEX_BENCHMARK_TIMEOUT_MS,
    );

    it(
        `lexes a ${BENCHMARK_ROWS}×${BENCHMARK_COLS} hex matrix with ~100 token rules within ${LEX_TIME_LIMIT_MS} ms`,
        () =>
        {
            const largeGrammar = loadHexMatrixGrammarWithDummyRules(96);
            const source = synthesizeHexMatrixSource(BENCHMARK_ROWS, BENCHMARK_COLS);
            const lexer = new Lexer(largeGrammar);

            const startMs = performance.now();
            const tokens = lexer.lex(source);
            const lexMs = performance.now() - startMs;

            expect(tokens.length).toBe(expectedHexMatrixTokenCount(BENCHMARK_ROWS, BENCHMARK_COLS));
            expect(lexMs).toBeLessThan(LEX_TIME_LIMIT_MS);
        },
        LEX_BENCHMARK_TIMEOUT_MS,
    );
});
