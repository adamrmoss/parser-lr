import type { SourceLocation } from '../ast/ast-node.js';

/**
 * One-based line and column derived from a UTF-16 source offset.
 */
export interface SourcePosition
{
    readonly line: number;
    readonly column: number;
}

/**
 * Converts a source offset into a 1-based line and column.
 *
 * @param source - Full source text.
 * @param offset - Zero-based UTF-16 code unit offset.
 * @returns Line and column for the offset, clamped to the source bounds.
 */
export function offsetToPosition(source: string, offset: number): SourcePosition
{
    // Clamp out-of-range offsets to the nearest valid index.
    const clamped = Math.max(0, Math.min(offset, source.length));
    let line = 1;
    let column = 1;

    // Scan characters before the offset, advancing line on each newline.
    for (let index = 0; index < clamped; index += 1)
    {
        if (source[index] === '\n')
        {
            line += 1;
            column = 1;
            continue;
        }

        column += 1;
    }

    return { line, column };
}

/**
 * Returns the start offset from a location or raw offset value.
 *
 * @param location - Optional source span.
 * @param offset - Optional raw offset when no span is available.
 */
export function resolveDiagnosticOffset(
    location: SourceLocation | null | undefined,
    offset: number | null | undefined,
): number | null
{
    if (location !== null && location !== undefined)
    {
        return location.offset;
    }

    if (offset === null || offset === undefined)
    {
        return null;
    }

    return offset;
}
