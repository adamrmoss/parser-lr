import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parserFromTableJson } from './parser-lr.js';

const calcTablePath = join(
    process.cwd(),
    'grammars/fixtures/table-only-import/calc.table.json',
);

describe('table-only import', () =>
{
    it('parses from a serialized table without a grammar file', () =>
    {
        const tableJson = readFileSync(calcTablePath, 'utf8');
        const { parser } = parserFromTableJson(tableJson);
        const ast = parser.parseSource('1 + 2');

        expect(ast).not.toBeNull();
        expect(ast?.symbol).toBe('expr');
    });
});
