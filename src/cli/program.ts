import { Command } from 'commander';

import packageDefinition from '../../package.json' with { type: 'json' };

import { formatUserError } from '../lib/index.js';

import { registerParseCommand, registerTableCommands } from './commands/index.js';

/**
 * Builds the parser-lr commander program with all subcommands registered.
 */
export function createProgram(): Command
{
    const program = new Command();

    program
        .name('parser-lr')
        .description('Shift-reduce parser for EBNF grammars')
        .version(packageDefinition.version);

    registerTableCommands(program);
    registerParseCommand(program);

    return program;
}

/**
 * Parses argv and runs the matched command.
 *
 * @param argv - Command-line arguments (defaults to process.argv).
 */
export async function runProgram(argv: string[] = process.argv): Promise<void>
{
    const program = createProgram();

    try
    {
        await program.parseAsync(argv);
    }
    catch (error)
    {
        console.error(formatUserError(error));
        process.exitCode = 1;
    }
}
