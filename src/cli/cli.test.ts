import { describe, expect, it } from '@jest/globals';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
    withCapturedErrorOutput,
    withSuppressedErrorOutput,
} from '../test/suppress-expected-error-output.js';
import { readTextChunks, readTextFile, writeTextFile } from './io.js';
import { createProgram, runProgram } from './program.js';

describe('CLI io helpers', () =>
{
    let tempDir: string;

    beforeEach(async () =>
    {
        tempDir = await mkdtemp(join(tmpdir(), 'parser-lr-io-'));
    });

    afterEach(async () =>
    {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('reads and writes UTF-8 text files', async () =>
    {
        const path = join(tempDir, 'sample.txt');

        await writeTextFile(path, 'hello\nworld');
        expect(await readTextFile(path)).toBe('hello\nworld');
    });

    it('streams file contents as async chunks', async () =>
    {
        const path = join(tempDir, 'chunks.txt');

        await writeTextFile(path, 'abc\ndef');

        const chunks: string[] = [];

        for await (const chunk of readTextChunks(path))
        {
            chunks.push(chunk);
        }

        expect(chunks.join('')).toBe('abc\ndef');
    });
});

describe('CLI commands', () =>
{
    let tempDir: string;
    const calcGrammarPath = join(process.cwd(), 'grammars/calc.grammar');

    beforeEach(async () =>
    {
        tempDir = await mkdtemp(join(tmpdir(), 'parser-lr-cli-'));
    });

    afterEach(async () =>
    {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('generates a parse table to stdout', async () =>
    {
        const stdout: string[] = [];
        const originalWrite = process.stdout.write.bind(process.stdout);

        process.stdout.write = ((chunk: string | Uint8Array) =>
        {
            stdout.push(String(chunk));
            return true;
        }) as typeof process.stdout.write;

        try
        {
            await createProgram().parseAsync([
                'node',
                'parser-lr',
                'table',
                'generate',
                '-g',
                calcGrammarPath,
            ]);
        }
        finally
        {
            process.stdout.write = originalWrite;
        }

        expect(stdout.join('')).toContain('"grammarName": "calc"');
    });

    it('writes conflict warnings to stderr for conflicted grammars', async () =>
    {
        const grammarPath = join(tempDir, 'dangling.grammar');

        await writeFile(grammarPath, `
name "dangling" ;

tokens
    if = /if/ ;
    then = /then/ ;
    else = /else/ ;
    other = /other/ ;
    id = /[a-z]+/ ;

start stmt ;

grammar
    stmt =
        "if" E "then" stmt
      | "if" E "then" stmt "else" stmt
      | "other"
    ;
    E = id ;
`);

        const { output } = await withCapturedErrorOutput(async () =>
        {
            await createProgram().parseAsync([
                'node',
                'parser-lr',
                'table',
                'generate',
                '-g',
                grammarPath,
                '-o',
                join(tempDir, 'table.json'),
            ]);
        });

        expect(output).toContain('shift/reduce conflict');
        expect(await readFile(join(tempDir, 'table.json'), 'utf8')).toContain('"grammarName"');
    });

    it('parses source through the parse command', async () =>
    {
        const inputPath = join(tempDir, 'input.txt');
        const outputPath = join(tempDir, 'output.json');

        await writeFile(inputPath, '1 + 2\n');

        await createProgram().parseAsync([
            'node',
            'parser-lr',
            'parse',
            '-g',
            calcGrammarPath,
            '-i',
            inputPath,
            '-o',
            outputPath,
        ]);

        const output = await readFile(outputPath, 'utf8');

        expect(output).toContain('"symbol": "expr"');
    });

    it('writes progress messages to stderr during table generate', async () =>
    {
        const { output } = await withCapturedErrorOutput(async () =>
        {
            await createProgram().parseAsync([
                'node',
                'parser-lr',
                'table',
                'generate',
                '-g',
                calcGrammarPath,
                '-o',
                join(tempDir, 'table.json'),
            ]);
        });

        expect(output).toContain('parser-lr: reading grammar');
        expect(output).toContain('parser-lr: building lr1 parse table');
        expect(output).toContain('parser-lr: serializing parse table');
        expect(output).toContain('parser-lr: writing');
    });

    it('writes progress messages to stderr during parse', async () =>
    {
        const inputPath = join(tempDir, 'input.txt');

        await writeFile(inputPath, '1 + 2\n');

        const { output } = await withCapturedErrorOutput(async () =>
        {
            await createProgram().parseAsync([
                'node',
                'parser-lr',
                'parse',
                '-g',
                calcGrammarPath,
                '-i',
                inputPath,
            ]);
        });

        expect(output).toContain('parser-lr: reading grammar');
        expect(output).toContain('parser-lr: building parse table');
        expect(output).toContain('parser-lr: lexing');
        expect(output).toContain('parser-lr: parsing');
    });

    it('registers table and parse subcommands', () =>
    {
        const names = createProgram().commands.map((command) => command.name());

        expect(names).toContain('table');
        expect(names).toContain('parse');
    });

    it('sets exit code when command execution fails', async () =>
    {
        const previousExitCode = process.exitCode;

        process.exitCode = 0;

        await withSuppressedErrorOutput(async () =>
        {
            await runProgram([
                'node',
                'parser-lr',
                'table',
                'generate',
                '-g',
                join(tempDir, 'missing.grammar'),
            ]);
        });

        expect(process.exitCode).toBe(1);
        process.exitCode = previousExitCode;
    });
});
