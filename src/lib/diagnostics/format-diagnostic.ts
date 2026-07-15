import type { SourceLocation } from '../ast/ast-node.js';

import { offsetToPosition, resolveDiagnosticOffset } from './source-position.js';

/**
 * Severity label written into a diagnostic line.
 */
export type DiagnosticSeverity = 'error' | 'warning';

/**
 * Inputs for formatting one CLI or library diagnostic line.
 */
export interface FormatDiagnosticOptions
{
    readonly severity: DiagnosticSeverity;
    readonly message: string;
    readonly path?: string | null;
    readonly source?: string | null;
    readonly location?: SourceLocation | null;
    readonly offset?: number | null;
}

/**
 * Formats a diagnostic as `path:line:column: severity: message` when possible.
 *
 * @param options - Severity, message, and optional source position inputs.
 * @returns One diagnostic line without a trailing newline.
 */
export function formatDiagnostic(options: FormatDiagnosticOptions): string
{
    const prefix = formatDiagnosticLocationPrefix(options);
    const body = `${options.severity}: ${options.message}`;

    if (prefix === null)
    {
        return body;
    }

    return `${prefix}: ${body}`;
}

/**
 * Builds the `path:line:column` or `path` prefix for a diagnostic.
 *
 * @param options - Path and optional source position inputs.
 * @returns Location prefix, or null when no path is available.
 */
export function formatDiagnosticLocationPrefix(
    options: Pick<FormatDiagnosticOptions, 'path' | 'source' | 'location' | 'offset'>,
): string | null
{
    const path = options.path ?? null;

    if (path === null || path.length === 0)
    {
        return null;
    }

    const offset = resolveDiagnosticOffset(options.location, options.offset);
    const source = options.source ?? null;

    // Prefer path:line:column when both source text and an offset are known.
    if (source !== null && offset !== null)
    {
        const position = offsetToPosition(source, offset);

        return `${path}:${String(position.line)}:${String(position.column)}`;
    }

    return path;
}
