import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ParseContext } from 'parser-lr';

const here = dirname(fileURLToPath(import.meta.url));
const tableJson = readFileSync(join(here, 'calc.table.json'), 'utf8');

const context = ParseContext.fromTableJson(tableJson);
const ast = context.parseSource('1 + 2');

if (ast === null)
{
    throw new Error('table-only smoke (mjs): expected a non-null AST');
}

process.stdout.write(`mjs ${ast.symbol}\n`);
