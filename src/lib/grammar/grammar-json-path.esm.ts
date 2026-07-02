import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Returns the directory containing bootstrapped `grammar.json` for the ESM build.
 */
export function grammarJsonDirectory(): string
{
    return dirname(fileURLToPath(import.meta.url));
}
