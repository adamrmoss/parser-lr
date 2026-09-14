import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parserFromTableJson } from 'parser-lr';

const here = dirname(fileURLToPath(import.meta.url));
const tableJson = readFileSync(join(here, 'calc.table.json'), 'utf8');

const { parser } = parserFromTableJson(tableJson);
const ast = parser.parseSource('1 + 2');

if (ast === null)
{
    throw new Error('table-only smoke (mjs): expected a non-null AST');
}

process.stdout.write(`mjs ${ast.symbol}\n`);
