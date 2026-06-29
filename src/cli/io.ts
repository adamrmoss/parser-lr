import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';

/**
 * Reads a UTF-8 text file from disk.
 *
 * @param path - File path to read.
 * @returns File contents.
 */
export async function readTextFile(path: string): Promise<string>
{
    return readFile(path, 'utf8');
}

/**
 * Reads a UTF-8 text file as an async stream of chunks.
 *
 * @param path - File path to read.
 * @returns Async iterable source chunks.
 */
export async function* readTextChunks(path: string): AsyncIterable<string>
{
    const stream = createReadStream(path, {
        encoding: 'utf8',
        highWaterMark: 16 * 1024,
    });

    for await (const chunk of stream)
    {
        yield chunk;
    }
}

/**
 * Writes UTF-8 text to a file on disk.
 *
 * @param path - File path to write.
 * @param content - Text content to save.
 */
export async function writeTextFile(path: string, content: string): Promise<void>
{
    await writeFile(path, content, 'utf8');
}
