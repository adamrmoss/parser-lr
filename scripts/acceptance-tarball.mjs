import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

/**
 * Bundles a minimal browser entry that imports only the main library export.
 *
 * @param consumerDir - Scratch project with parser-lr installed.
 * @param outputPath - Path for the bundled output file.
 */
async function runBrowserBundleAcceptance(consumerDir, outputPath)
{
    const entryPath = join(consumerDir, 'browser-entry.mjs');

    writeFileSync(
        entryPath,
        "import { ParseContext } from 'parser-lr';\nvoid ParseContext;\n",
    );

    await build({
        absWorkingDir: consumerDir,
        bundle: true,
        entryPoints: [entryPath],
        format: 'esm',
        outfile: outputPath,
        platform: 'browser',
        logLevel: 'silent',
    });
}

/**
 * Packs the current package, installs the tarball into a scratch project, and
 * runs browser bundle, CLI, table-only import, and grammar subpath checks.
 *
 * @remarks
 * Verifies the published layout against EduBASIC's browser-safe import requirements.
 */
async function main()
{
    const root = process.cwd();
    const scratch = mkdtempSync(join(tmpdir(), 'parser-lr-accept-'));

    run('npm', ['pack', '--pack-destination', scratch]);

    const tarball = readdirSync(scratch).find((name) => name.endsWith('.tgz'));

    if (tarball === undefined)
    {
        throw new Error('acceptance: npm pack produced no tarball');
    }

    const consumer = join(scratch, 'consumer');
    run('mkdir', ['-p', consumer]);
    writeFileSync(
        join(consumer, 'package.json'),
        `${JSON.stringify({ name: 'consumer', private: true, type: 'module', version: '0.0.0' }, null, 4)}\n`,
    );
    run('npm', ['install', join(scratch, tarball)], { cwd: consumer });

    const cliEntry = join(consumer, 'node_modules/parser-lr/bin/parser-lr.js');
    const pkgGrammars = join(consumer, 'node_modules/parser-lr/grammars');
    const smokeDir = join(pkgGrammars, 'fixtures/table-only-import');

    await runBrowserBundleAcceptance(consumer, join(scratch, 'browser-out.js'));

    run('node', [cliEntry, 'table', 'validate', '-g', join(pkgGrammars, 'calc.grammar')]);
    run('node', [
        cliEntry,
        'table',
        'generate',
        '-g',
        join(pkgGrammars, 'calc.grammar'),
        '-o',
        join(scratch, 'calc.json'),
        '-a',
        'lalr',
    ]);

    const mjsOut = run('node', [join(smokeDir, 'table-only-smoke.mjs')], { capture: true });

    if (!mjsOut.startsWith('mjs '))
    {
        throw new Error(`acceptance: mjs smoke output unexpected: ${mjsOut}`);
    }

    const grammarSubpath = run(
        'node',
        ['-e', "import('parser-lr/grammar').then((module) => console.log(typeof module.readGrammar))"],
        { cwd: consumer, capture: true },
    );

    if (grammarSubpath.trim() !== 'function')
    {
        throw new Error(`acceptance: grammar subpath smoke output unexpected: ${grammarSubpath}`);
    }

    process.stdout.write(`acceptance passed (${tarball})\n`);
    process.stdout.write(mjsOut);
}

/**
 * Runs a subprocess and optionally captures stdout.
 *
 * @param command - Executable name.
 * @param args - Command arguments.
 * @param options - Working directory and capture mode.
 * @returns Captured stdout when `capture` is true.
 */
function run(command, args, options = {})
{
    return execFileSync(command, args, {
        cwd: options.cwd ?? process.cwd(),
        encoding: 'utf8',
        stdio: options.capture === true ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
}

await main();
