import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('browser-safe main entry', () =>
{
    const distLib = join(process.cwd(), 'dist/lib');
    const mainEntry = join(distLib, 'index.js');

    it('declares documentation and example grammars in package files', () =>
    {
        const packageJson = JSON.parse(
            readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
        ) as { files: string[] };

        expect(packageJson.files).toEqual(
            expect.arrayContaining(['README.md', 'LICENSE', 'docs', 'grammars', 'dist']),
        );
    });

    it('keeps required publish paths on disk', () =>
    {
        const requiredPaths = [
            'README.md',
            'LICENSE',
            'docs/grammar.md',
            'grammars/calc.grammar',
        ];

        for (const relativePath of requiredPaths)
        {
            expect(existsSync(join(process.cwd(), relativePath))).toBe(true);
        }
    });

    it('includes built library outputs when dist is present', () =>
    {
        if (!existsSync(mainEntry))
        {
            return;
        }

        expect(existsSync(join(distLib, 'grammar-entry.js'))).toBe(true);
        expect(existsSync(join(distLib, 'grammar/grammar.json'))).toBe(true);
    });

    it('keeps grammar and node built-ins off the main entry static graph', () =>
    {
        if (!existsSync(mainEntry))
        {
            return;
        }

        const source = readFileSync(mainEntry, 'utf8');

        expect(source).not.toMatch(/read-grammar/);
        expect(source).not.toMatch(/meta-grammar-table/);
        expect(source).not.toMatch(/node:/);
    });

    it('avoids import.meta in dist/lib JavaScript', () =>
    {
        if (!existsSync(distLib))
        {
            return;
        }

        for (const fileName of collectJsFiles(distLib))
        {
            const source = readFileSync(join(distLib, fileName), 'utf8');
            expect(source).not.toMatch(/import\.meta/);
        }
    });
});

/**
 * Collects relative `.js` file paths under a directory recursively.
 *
 * @param root - Directory to scan.
 * @param prefix - Relative prefix for recursion.
 * @returns Relative paths from `root`.
 */
function collectJsFiles(root: string, prefix = ''): string[]
{
    const entries = readdirSync(join(root, prefix), { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries)
    {
        const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;

        if (entry.isDirectory())
        {
            files.push(...collectJsFiles(root, relativePath));
            continue;
        }

        if (entry.name.endsWith('.js'))
        {
            files.push(relativePath);
        }
    }

    return files;
}
