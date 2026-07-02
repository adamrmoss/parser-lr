import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const grammarDir = join(root, 'src/lib/grammar');
const barrelPath = join(grammarDir, 'grammar-json-path.ts');
const barrelBackup = join(grammarDir, 'grammar-json-path.ts.esm-barrel');
const cjsShimPath = join(grammarDir, 'grammar-json-path.cjs.ts');
const grammarJsonSource = join(grammarDir, 'grammar.json');

function run(command, args)
{
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });

    if (result.status !== 0)
    {
        process.exit(result.status ?? 1);
    }
}

function copyGrammarJson()
{
    for (const target of ['dist/lib/grammar', 'dist/lib-cjs/grammar'])
    {
        copyFileSync(grammarJsonSource, join(root, target, 'grammar.json'));
    }
}

function writeCjsPackageManifest()
{
    writeFileSync(
        join(root, 'dist/lib-cjs/package.json'),
        `${JSON.stringify({ type: 'commonjs' }, null, 4)}\n`,
    );
}

// Build the ESM tree with the ESM barrel re-export.
run('tsc', ['-p', 'tsconfig.lib.json']);

// Swap the barrel to the CommonJS shim for the second compile.
writeFileSync(barrelBackup, readFileSync(barrelPath, 'utf8'));
copyFileSync(cjsShimPath, barrelPath);

try
{
    run('tsc', ['-p', 'tsconfig.lib.cjs.json']);
    copyGrammarJson();
    writeCjsPackageManifest();
}
finally
{
    writeFileSync(barrelPath, readFileSync(barrelBackup, 'utf8'));
}
