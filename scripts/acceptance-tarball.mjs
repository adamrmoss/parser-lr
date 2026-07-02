import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Packs the current package, installs the tarball into a scratch project, and
 * runs the CLI and table-only import acceptance checks from EduBASIC's requests.
 *
 * @remarks
 * Verifies §1 (CLI finds its meta-grammar) and §2 (table-only import loads no
 * meta-grammar / no `import.meta`) against the real published layout.
 */

const root = process.cwd();

function run(command, args, options = {})
{
    return execFileSync(command, args, {
        cwd: options.cwd ?? root,
        encoding: 'utf8',
        stdio: options.capture === true ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
}

// Build and pack the current package into a scratch directory.
const scratch = mkdtempSync(join(tmpdir(), 'parser-lr-accept-'));
run('npm', ['pack', '--pack-destination', scratch]);

const tarball = readdirSync(scratch).find((name) => name.endsWith('.tgz'));

if (tarball === undefined)
{
    throw new Error('acceptance: npm pack produced no tarball');
}

// Install the tarball into an isolated consumer project.
const consumer = join(scratch, 'consumer');
run('mkdir', ['-p', consumer]);
writeFileSync(
    join(consumer, 'package.json'),
    `${JSON.stringify({ name: 'consumer', private: true, version: '0.0.0' }, null, 4)}\n`,
);
run('npm', ['install', join(scratch, tarball)], { cwd: consumer });

const cliEntry = join(consumer, 'node_modules/parser-lr/bin/parser-lr.js');
const pkgGrammars = join(consumer, 'node_modules/parser-lr/grammars');

// §1: CLI validate and generate must run against a shipped example grammar.
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

// §2: table-only import smoke scripts must run under plain node (CJS and ESM).
const smokeDir = join(pkgGrammars, 'fixtures/table-only-import');
const cjsOut = run('node', [join(smokeDir, 'table-only-smoke.cjs')], { capture: true });
const mjsOut = run('node', [join(smokeDir, 'table-only-smoke.mjs')], { capture: true });

if (!cjsOut.startsWith('cjs '))
{
    throw new Error(`acceptance: cjs smoke output unexpected: ${cjsOut}`);
}

if (!mjsOut.startsWith('mjs '))
{
    throw new Error(`acceptance: mjs smoke output unexpected: ${mjsOut}`);
}

process.stdout.write(`acceptance passed (${tarball})\n`);
process.stdout.write(cjsOut);
process.stdout.write(mjsOut);
