import { bootstrapMetaGrammar } from './bootstrap-meta-grammar.js';
import { runProgram } from './program.js';

/**
 * Runs the parser-lr command-line tool.
 */
async function main(): Promise<void> {
    bootstrapMetaGrammar();
    await runProgram();
}

main();
