import { ParserLr } from '../lib/parser-lr.js';

/**
 * Runs the parser-lr command-line tool.
 */
function main(): void {
    const parser = new ParserLr();

    process.stdout.write(`${parser.constructor.name}\n`);
}

main();
