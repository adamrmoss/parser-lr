import { Command } from 'commander';

import { ParseContext, formatParseOutput } from '../../lib/index.js';

import { readTextChunks, readTextFile, writeTextFile } from '../io.js';

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
            const tokens = await context.lexChunkStreamAsync(readTextChunks(options.input));
            const tree = context.parse(tokens);
            const output = formatParseOutput(tree, options.format);

            // Write output to disk or stdout.
            if (options.output !== undefined)
            {
                await writeTextFile(options.output, output);
            }
            else
            {
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
    return ParseContext.fromSources({
        grammarSource: options.grammar === undefined
            ? undefined
            : await readTextFile(options.grammar),
        tableJson: options.table === undefined
            ? undefined
            : await readTextFile(options.table),
    });
}
