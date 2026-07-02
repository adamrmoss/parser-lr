import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ParseContext } from './parse-context.js';

const calcTablePath = join(
    process.cwd(),
    'grammars/fixtures/table-only-import/calc.table.json',
);

describe('table-only import', () =>
{
    it('parses from a serialized table without a grammar file', () =>
    {
        const tableJson = readFileSync(calcTablePath, 'utf8');
        const context = ParseContext.fromTableJson(tableJson);
        const ast = context.parseSource('1 + 2');

        expect(ast).not.toBeNull();
        expect(ast?.symbol).toBe('expr');
    });
});
