/**
 * Writes a progress line to stderr.
 *
 * @param message - Human-readable status message.
 */
export function logProgress(message: string): void
{
    process.stderr.write(`parser-lr: ${message}\n`);
}
