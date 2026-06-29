import { readFile, writeFile } from 'node:fs/promises';

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
 * Writes UTF-8 text to a file on disk.
 *
 * @param path - File path to write.
 * @param content - Text content to save.
 */
export async function writeTextFile(path: string, content: string): Promise<void>
{
    await writeFile(path, content, 'utf8');
}
