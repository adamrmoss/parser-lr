import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const grammarJsonSource = join(root, 'src/lib/grammar/grammar.json');

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
    copyFileSync(
        grammarJsonSource,
        join(root, 'dist/lib/grammar/grammar.json'),
    );
}

run('tsc', ['-p', 'tsconfig.lib.json']);
copyGrammarJson();
