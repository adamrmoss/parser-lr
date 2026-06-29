import { runProgram } from './program.js';

/**
 * Runs the parser-lr command-line tool.
 */
async function main(): Promise<void> {
    await runProgram();
}

main();
