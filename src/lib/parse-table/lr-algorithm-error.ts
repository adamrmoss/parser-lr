import { ParserLrError } from '../errors/parser-lr-error.js';

/**
 * Thrown when an LR table algorithm name is not supported.
 */
export class LrAlgorithmError extends ParserLrError
{
    /**
     * Creates an unsupported LR algorithm error.
     *
     * @param algorithm - Requested algorithm name.
     */
    public constructor(algorithm: string)
    {
        super(`Unsupported LR algorithm ${JSON.stringify(algorithm)}`);
    }
}
