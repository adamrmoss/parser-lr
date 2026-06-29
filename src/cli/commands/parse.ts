import { Command } from 'commander';

/**
 * Registers the `parse` command on the root CLI program.
 *
 * @param program - Root commander program.
 */
export function registerParseCommand(program: Command): void
{
    program
        .command('parse')
        .description('Parse a source file using an LR table')
        .requiredOption('-i, --input <path>', 'Source file to parse')
        .option('-g, --grammar <path>', 'EBNF grammar file (builds or loads a table)')
        .option('-t, --table <path>', 'Serialized parse table JSON file')
        .option('-o, --output <path>', 'Write the AST to this file (default: stdout)')
        .option(
            '--format <name>',
            'AST output format',
            'json',
        )
        .action(async (options: ParseOptions, command: Command) =>
        {
            if (options.grammar === undefined && options.table === undefined)
            {
                command.error('required: --grammar or --table');
            }

            // Stub: wire to ParserLr shift-reduce parser.
            process.stdout.write(
                `parse (stub)\n`
                + `  input: ${options.input}\n`
                + `  grammar: ${options.grammar ?? '(none)'}\n`
                + `  table: ${options.table ?? '(none)'}\n`
                + `  format: ${options.format}\n`
                + `  output: ${options.output ?? '(stdout)'}\n`,
            );
        });
}

interface ParseOptions
{
    input: string;
    grammar?: string;
    table?: string;
    output?: string;
    format: string;
}
