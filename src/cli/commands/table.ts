import { Command } from 'commander';

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
            // Stub: wire to ParserLr table builder.
            process.stdout.write(
                `table generate (stub)\n`
                + `  grammar: ${options.grammar}\n`
                + `  algorithm: ${options.algorithm}\n`
                + `  output: ${options.output ?? '(stdout)'}\n`,
            );
        });
}

interface TableGenerateOptions
{
    grammar: string;
    output?: string;
    algorithm: string;
}
