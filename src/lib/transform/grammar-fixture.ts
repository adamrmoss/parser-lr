import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { AstNode } from '../ast/ast-node.js';
import { parseContextFromGrammar } from '../grammar-entry.js';

/**
 * One grammar fixture case with source input and optional expected AST JSON.
 */
export interface GrammarFixtureCase
{
    readonly name: string;
    readonly grammarPath: string;
    readonly inputPath: string;
    readonly expectedPath: string | null;
}

/**
 * Returns the `.grammar` file for one fixture directory.
 *
 * Fixture grammars are named after their directory (for example
 * `bare-terminal/bare-terminal.grammar`). The meta-grammar keeps the reserved
 * name `grammar.grammar` at the repo root only.
 *
 * @param fixtureDir - Directory containing a fixture grammar and input files.
 */
export function fixtureGrammarPath(fixtureDir: string): string | null
{
    const grammarPath = join(fixtureDir, `${basename(fixtureDir)}.grammar`);

    return existsSync(grammarPath) ? grammarPath : null;
}

/**
 * Returns child AST nodes matching a symbol name.
 *
 * @param node - Parent AST node.
 * @param symbol - Child symbol to find.
 */
export function findChildrenBySymbol(node: AstNode, symbol: string): AstNode[]
{
    return node.children.filter((child) => child.symbol === symbol);
}

/**
 * Returns the first child AST node matching a symbol name.
 *
 * @param node - Parent AST node.
 * @param symbol - Child symbol to find.
 */
export function findChildBySymbol(node: AstNode, symbol: string): AstNode | null
{
    return node.children.find((child) => child.symbol === symbol) ?? null;
}

/**
 * Parses one fixture grammar and input file into an AST.
 *
 * @param fixtureDir - Directory containing a named fixture grammar and an input file.
 * @param inputFileName - Input file name within the fixture directory.
 */
export function parseFixture(
    fixtureDir: string,
    inputFileName = 'input.txt',
): AstNode | null
{
    const grammarPath = fixtureGrammarPath(fixtureDir);

    if (grammarPath === null)
    {
        throw new Error(`fixture grammar not found in ${fixtureDir}`);
    }

    const grammarSource = readFileSync(grammarPath, 'utf8');
    const input = readFileSync(join(fixtureDir, inputFileName), 'utf8').trimEnd();
    const context = parseContextFromGrammar(grammarSource, 'lr1');

    return context.parseSource(input);
}

/**
 * Discovers fixture directories containing a named `.grammar` file under a root path.
 *
 * @param rootDir - Root directory to scan recursively.
 */
export function discoverFixtures(rootDir: string): GrammarFixtureCase[]
{
    const fixtures: GrammarFixtureCase[] = [];

    const visit = (directory: string): void =>
    {
        const grammarPath = fixtureGrammarPath(directory);

        if (grammarPath !== null)
        {
            const inputFiles = readdirSync(directory)
                .filter((name) => name.startsWith('input') && name.endsWith('.txt'))
                .sort();

            for (const inputFile of inputFiles)
            {
                const baseName = inputFile.replace(/^input/, '').replace(/\.txt$/, '');
                const expectedName = baseName === '' ? 'expected.json' : `expected${baseName}.json`;
                const expectedPath = join(directory, expectedName);

                fixtures.push({
                    name: `${directory.split('/').slice(-2).join('/')}/${inputFile}`,
                    grammarPath,
                    inputPath: join(directory, inputFile),
                    expectedPath: existsSync(expectedPath) ? expectedPath : null,
                });
            }
        }

        for (const entry of readdirSync(directory, { withFileTypes: true }))
        {
            if (entry.isDirectory())
            {
                visit(join(directory, entry.name));
            }
        }
    };

    visit(rootDir);

    return fixtures;
}

/**
 * Parses a fixture case and compares to expected JSON when present.
 *
 * @param fixture - Fixture metadata.
 */
export function runFixtureCase(
    fixture: GrammarFixtureCase,
    expectFn: (received: unknown) => { toEqual(expected: unknown): void },
): AstNode | null
{
    const grammarSource = readFileSync(fixture.grammarPath, 'utf8');
    const input = readFileSync(fixture.inputPath, 'utf8').trimEnd();
    const context = parseContextFromGrammar(grammarSource, 'lr1');
    const ast = context.parseSource(input);

    if (fixture.expectedPath !== null)
    {
        const expected = JSON.parse(readFileSync(fixture.expectedPath, 'utf8'));

        expectFn(ast).toEqual(expected);
    }

    return ast;
}
