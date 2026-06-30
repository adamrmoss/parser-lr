import { Command } from 'commander';

import { ParseContext } from '../../lib/index.js';

import { readTextFile, writeTextFile } from '../io.js';

/**
 * Registers `table` subcommands on the root CLI program.
 *
 * @param program - Root commander program.
 */
export function registerTableCommands(program: Command): void
{
    const table = program
        .command('table')
        .description('Generate and inspect LR parse tables');

    table
        .command('generate')
        .description('Build a parse table from an EBNF grammar')
        .requiredOption('-g, --grammar <path>', 'EBNF grammar file')
        .option('-o, --output <path>', 'Write the table JSON to this file (default: stdout)')
        .option(
            '-a, --algorithm <name>',
            'LR algorithm: lr0, slr, lalr, or lr1',
            'lr1',
        )
        .action(async (options: TableGenerateOptions) =>
        {
            const grammarSource = await readTextFile(options.grammar);
            const context = ParseContext.fromSources({
                grammarSource,
                algorithm: options.algorithm,
            });
            const json = context.table.toJsonString();

            // Write conflict warnings to stderr after table generation.
            for (const warning of context.table.formatConflictWarnings())
            {
                process.stderr.write(`${warning}\n`);
            }

            // Write JSON to disk or stdout.
            if (options.output !== undefined)
            {
                await writeTextFile(options.output, json);
            }
            else
            {
                process.stdout.write(`${json}\n`);
            }
        });
}

interface TableGenerateOptions
{
    grammar: string;
    output?: string;
    algorithm: string;
}
