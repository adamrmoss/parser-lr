import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('npm pack contents', () =>
{
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
        const esmEntry = join(process.cwd(), 'dist/lib/index.js');
        const cjsEntry = join(process.cwd(), 'dist/lib-cjs/index.js');

        if (!existsSync(esmEntry) || !existsSync(cjsEntry))
        {
            return;
        }

        expect(existsSync(join(process.cwd(), 'dist/lib/grammar/grammar.json'))).toBe(true);
        expect(existsSync(join(process.cwd(), 'dist/lib-cjs/grammar/grammar.json'))).toBe(true);
        expect(existsSync(join(process.cwd(), 'dist/lib-cjs/package.json'))).toBe(true);
    });
});
