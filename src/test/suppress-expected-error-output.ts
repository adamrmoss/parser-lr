/**
 * Runs code that may write expected errors to stderr or console.error.
 *
 * @param run - Callback under test; may throw or reject.
 * @returns The callback result when it completes normally.
 */
export function withSuppressedErrorOutput<T>(run: () => T): T;

/**
 * Runs async code that may write expected errors to stderr or console.error.
 *
 * @param run - Async callback under test; may throw or reject.
 * @returns The callback result when it completes normally.
 */
export function withSuppressedErrorOutput<T>(run: () => Promise<T>): Promise<T>;

export function withSuppressedErrorOutput<T>(run: () => T | Promise<T>): T | Promise<T>
{
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    const originalConsoleError = console.error;

    process.stderr.write = (() => true) as typeof process.stderr.write;
    console.error = () => {};

    const restore = (): void =>
    {
        process.stderr.write = originalStderrWrite;
        console.error = originalConsoleError;
    };

    try
    {
        const result = run();

        if (result instanceof Promise)
        {
            return result.finally(restore);
        }

        restore();
        return result;
    }
    catch (error)
    {
        restore();
        throw error;
    }
}

/**
 * Captures writes to stderr and console.error for assertions.
 *
 * @param run - Callback whose error-stream output should be captured.
 * @returns Captured text and the callback result.
 */
export async function withCapturedErrorOutput<T>(run: () => T | Promise<T>): Promise<{
    readonly output: string;
    readonly result: T;
}>
{
    const chunks: string[] = [];
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    const originalConsoleError = console.error;

    process.stderr.write = ((chunk: string | Uint8Array) =>
    {
        chunks.push(String(chunk));
        return true;
    }) as typeof process.stderr.write;
    console.error = ((...args: readonly unknown[]) =>
    {
        chunks.push(`${args.map(String).join(' ')}\n`);
    }) as typeof console.error;

    const restore = (): void =>
    {
        process.stderr.write = originalStderrWrite;
        console.error = originalConsoleError;
    };

    try
    {
        const result = await run();
        restore();

        return {
            output: chunks.join(''),
            result,
        };
    }
    catch (error)
    {
        restore();
        throw error;
    }
}
