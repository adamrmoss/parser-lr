/**
 * LR table construction algorithm.
 */
export type LrAlgorithm = 'lr0' | 'slr' | 'lalr' | 'lr1';

/**
 * Returns whether a string names a supported LR algorithm.
 *
 * @param value - Candidate algorithm name.
 */
export function isLrAlgorithm(value: string): value is LrAlgorithm
{
    return value === 'lr0'
        || value === 'slr'
        || value === 'lalr'
        || value === 'lr1';
}

/**
 * Parses and validates an LR algorithm name.
 *
 * @param value - Raw algorithm name, or undefined for the default.
 * @param defaultAlgorithm - Algorithm used when `value` is undefined.
 * @returns Supported algorithm name.
 */
export function parseLrAlgorithm(
    value: string | undefined,
    defaultAlgorithm: LrAlgorithm = 'lr1',
): LrAlgorithm
{
    const algorithm = value ?? defaultAlgorithm;

    if (!isLrAlgorithm(algorithm))
    {
        throw new Error(`Unsupported LR algorithm ${JSON.stringify(algorithm)}`);
    }

    return algorithm;
}
