import { Command } from 'commander';

import { ParseContext, formatParseOutput } from '../../lib/index.js';

import { readTextChunks, readTextFile, writeTextFile } from '../io.js';
import { logProgress } from '../progress.js';

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
        .option('-g, --grammar <path>', 'EBNF grammar file (builds a table in memory)')
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

            const context = await loadContextFromPaths(options);

            logProgress(`lexing ${options.input}`);
            const tokens = await context.lexChunkStreamAsync(readTextChunks(options.input));

            logProgress('parsing');
            const tree = context.parse(tokens);

            logProgress(`formatting output (${options.format})`);
            const output = formatParseOutput(tree, options.format);

            // Write output to disk or stdout.
            if (options.output !== undefined)
            {
                logProgress(`writing ${options.output}`);
                await writeTextFile(options.output, output);
            }
            else
            {
                logProgress('writing stdout');
                process.stdout.write(`${output}\n`);
            }
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

/**
 * Reads grammar or table files and builds a parse context.
 *
 * @param options - CLI paths for grammar or table input.
 * @returns Loaded parse context.
 */
async function loadContextFromPaths(options: ParseOptions): Promise<ParseContext>
{
    if (options.grammar !== undefined)
    {
        logProgress(`reading grammar ${options.grammar}`);
        const grammarSource = await readTextFile(options.grammar);

        logProgress('building parse table');
        return ParseContext.fromGrammar(grammarSource);
    }

    logProgress(`reading table ${options.table}`);
    const tableJson = await readTextFile(options.table!);

    logProgress('loading parse table');
    return ParseContext.fromTableJson(tableJson);
}
