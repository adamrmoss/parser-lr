import type { LrAlgorithm } from './lr-algorithm.js';

/**
 * Thrown when LR table construction encounters unresolved conflicts.
 */
export class ParseTableBuildError extends Error
{
    /**
     * Creates a parse table build error from detected conflicts.
     *
     * @param algorithm - LR algorithm that was attempted.
     * @param conflicts - Readable conflict descriptions.
     */
    public constructor(
        public readonly algorithm: LrAlgorithm,
        public readonly conflicts: readonly string[],
    )
    {
        super(`LR table build failed for ${algorithm}: ${conflicts.join('; ')}`);
    }
}
