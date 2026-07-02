import { Command } from 'commander';

import {
    formatTableValidationIssues,
    parseContextFromSources,
    readGrammar,
    validateGrammarTable,
} from '../../lib/grammar-entry.js';

import { readTextFile, writeTextFile } from '../io.js';
import { logProgress } from '../progress.js';

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
            logProgress(`reading grammar ${options.grammar}`);
            const grammarSource = await readTextFile(options.grammar);

            logProgress(`building ${options.algorithm} parse table`);
            const grammar = readGrammar(grammarSource);
            writeGrammarValidationMessages(grammar, false);

            const context = parseContextFromSources({
                grammarSource,
                algorithm: options.algorithm,
            });

            logProgress('serializing parse table');
            const json = context.table.toJsonString();

            // Write conflict warnings to stderr after table generation.
            for (const warning of context.table.formatConflictWarnings())
            {
                process.stderr.write(`${warning}\n`);
            }

            // Write JSON to disk or stdout.
            if (options.output !== undefined)
            {
                logProgress(`writing ${options.output}`);
                await writeTextFile(options.output, json);
            }
            else
            {
                logProgress('writing stdout');
                process.stdout.write(`${json}\n`);
            }
        });

    table
        .command('validate')
        .description('Check transform and ast consistency in a grammar')
        .requiredOption('-g, --grammar <path>', 'EBNF grammar file')
        .option('--strict', 'Treat warnings as errors')
        .action(async (options: TableValidateOptions) =>
        {
            logProgress(`reading grammar ${options.grammar}`);
            const grammarSource = await readTextFile(options.grammar);
            const grammar = readGrammar(grammarSource);
            const exitCode = writeGrammarValidationMessages(grammar, options.strict === true);

            process.exitCode = exitCode;
        });
}

/**
 * Writes grammar validation messages to stderr and returns a process exit code.
 *
 * @param grammar - Parsed grammar model.
 * @param strict - Whether warnings should fail validation.
 */
function writeGrammarValidationMessages(grammar: ReturnType<typeof readGrammar>, strict: boolean): number
{
    const issues = validateGrammarTable(grammar);
    let hasError = false;
    let hasWarning = false;

    for (const line of formatTableValidationIssues(issues))
    {
        process.stderr.write(`${line}\n`);

        if (line.startsWith('error:'))
        {
            hasError = true;
        }

        if (line.startsWith('warning:'))
        {
            hasWarning = true;
        }
    }

    if (hasError || (strict && hasWarning))
    {
        return 1;
    }

    return 0;
}

interface TableValidateOptions
{
    grammar: string;
    strict?: boolean;
}

interface TableGenerateOptions
{
    grammar: string;
    output?: string;
    algorithm: string;
}
