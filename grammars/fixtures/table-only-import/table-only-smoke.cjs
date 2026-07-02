const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const fs = require('node:fs');
const originalReadFileSync = fs.readFileSync;
let readMetaGrammar = false;

fs.readFileSync = function patchedReadFileSync(path, ...rest)
{
    if (String(path).endsWith('grammar.json'))
    {
        readMetaGrammar = true;
    }

    return originalReadFileSync.call(this, path, ...rest);
};

const { ParseContext } = require('parser-lr');

const tableJson = readFileSync(
    join(__dirname, 'calc.table.json'),
    'utf8',
);

const context = ParseContext.fromTableJson(tableJson);
const ast = context.parseSource('1 + 2');

if (ast === null)
{
    throw new Error('table-only smoke (cjs): expected a non-null AST');
}

if (readMetaGrammar)
{
    throw new Error('table-only smoke (cjs): unexpected grammar.json read');
}

process.stdout.write(`cjs ${ast.symbol}\n`);
