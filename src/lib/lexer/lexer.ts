import type { Grammar } from '../grammar/grammar.js';

import {
    assertLexerState,
    compileLexerRules,
    findLongestMatch,
    hasLongerPossibleMatch,
    isPrefixOfPotentialMatch,
    rulesForState,
} from './lexer-compile.js';
import type { CompiledLexerRules } from './lexer-compile.js';
import { LexerError } from './lexer-error.js';
import { LexerInputError } from './lexer-input-error.js';
import { eofToken, token } from './token.js';
import type { Token } from './token.js';

/**
 * Stream-based lexer driven by a grammar's `tokens`, `skip`, and `states` sections.
 *
 * Push source chunks with {@link push}, signal end-of-input with {@link finish},
 * then read tokens via {@link next} or iteration. The final token is always `$eof`.
 */
export class Lexer
{
    private readonly compiled: CompiledLexerRules;
    private readonly queue: Token[] = [];
    private buffer = '';
    private offset = 0;
    private finished = false;
    private eofEmitted = false;
    private currentState: string;

    /**
     * Creates a lexer from a parsed grammar.
     *
     * @param grammar - Grammar supplying token and skip rule definitions.
     */
    public constructor(grammar: Grammar)
    {
        this.compiled = compileLexerRules(grammar);
        this.currentState = this.compiled.initialState;
    }

    /**
     * Returns the active lexer state name.
     */
    public get state(): string
    {
        return this.currentState;
    }

    /**
     * Enters a declared lexer state.
     *
     * @param stateName - Lexer state to activate.
     */
    public enterState(stateName: string): void
    {
        assertLexerState(this.compiled, stateName);
        this.currentState = stateName;
    }

    /**
     * Appends the next chunk of source text to the scan buffer.
     *
     * @param chunk - Source text fragment.
     */
    public push(chunk: string): void
    {
        if (this.finished)
        {
            throw new LexerInputError();
        }

        this.buffer += chunk;
        this.drain(false);
    }

    /**
     * Signals that no further source chunks will arrive.
     */
    public finish(): void
    {
        this.finished = true;
        this.drain(true);
    }

    /**
     * Returns the next token, or null when waiting for more input.
     *
     * @returns The next token, null while blocked, or `$eof` after input ends.
     */
    public next(): Token | null
    {
        if (this.eofEmitted)
        {
            return null;
        }

        if (this.queue.length > 0)
        {
            return this.queue.shift() ?? null;
        }

        if (!this.finished)
        {
            return null;
        }

        if (this.buffer.length > 0)
        {
            throw new LexerError(
                `Unexpected character ${JSON.stringify(this.buffer[0])} at offset ${this.offset}`,
                this.offset,
            );
        }

        this.eofEmitted = true;
        return eofToken(this.offset);
    }

    /**
     * Lexes an entire source string, including a trailing `$eof` token.
     *
     * @param source - Input text to tokenize.
     * @returns Matched tokens in source order.
     */
    public lex(source: string): readonly Token[]
    {
        this.reset();
        this.push(source);
        this.finish();

        const tokens: Token[] = [];
        let nextToken = this.next();

        while (nextToken !== null)
        {
            tokens.push(nextToken);
            nextToken = this.next();
        }

        return tokens;
    }

    /**
     * Iterates all tokens until `$eof` after {@link finish} has been called.
     */
    public [Symbol.iterator](): Iterator<Token>
    {
        return {
            next: (): IteratorResult<Token> =>
            {
                const value = this.next();

                if (value === null)
                {
                    return {
                        done: true,
                        value: undefined,
                    };
                }

                return {
                    done: false,
                    value,
                };
            },
        };
    }

    /**
     * Scans the buffer and enqueues any tokens ready to emit.
     *
     * @param inputFinished - Whether the full input stream has ended.
     * @param allowChunkBoundary - Whether to commit tokens at a chunk boundary.
     */
    private drain(inputFinished: boolean): void
    {
        // Scan until the buffer needs more input or input ends with an error.
        while (true)
        {
            const match = this.matchAtBufferStart(inputFinished);

            if (match === 'need-more')
            {
                return;
            }

            if (match === null)
            {
                if (inputFinished && this.buffer.length > 0)
                {
                    throw new LexerError(
                        `Unexpected character ${JSON.stringify(this.buffer[0])} at offset ${this.offset}`,
                        this.offset,
                    );
                }

                return;
            }

            this.buffer = this.buffer.slice(match.text.length);
            this.offset += match.text.length;

            if (!match.skip)
            {
                this.queue.push(token(match.name, match.text, match.offset));
            }
        }
    }

    /**
     * Finds the winning rule match at the start of the scan buffer.
     *
     * @param inputFinished - Whether the full input stream has ended.
     * @param allowChunkBoundary - Whether to commit tokens at a chunk boundary.
     */
    private matchAtBufferStart(inputFinished: boolean):
        | { name: string; text: string; offset: number; skip: boolean }
        | 'need-more'
        | null
    {
        if (this.buffer.length === 0)
        {
            return null;
        }

        const activeRules = rulesForState(this.compiled, this.currentState);
        const bestMatch = findLongestMatch(this.buffer, activeRules);

        if (bestMatch === null)
        {
            if (!inputFinished && isPrefixOfPotentialMatch(this.buffer, activeRules))
            {
                return 'need-more';
            }

            return null;
        }

        if (bestMatch.text.length === this.buffer.length && !inputFinished)
        {
            if (hasLongerPossibleMatch(this.buffer, bestMatch.text, activeRules, false))
            {
                return 'need-more';
            }
        }

        return {
            name: bestMatch.name,
            text: bestMatch.text,
            offset: this.offset,
            skip: bestMatch.skip,
        };
    }

    /**
     * Resets stream state for a fresh lex run.
     */
    private reset(): void
    {
        this.queue.length = 0;
        this.buffer = '';
        this.offset = 0;
        this.finished = false;
        this.eofEmitted = false;
    }
}

/**
 * Lexes synchronous source chunks into a token stream ending with `$eof`.
 *
 * @param grammar - Grammar supplying lexer rules.
 * @param chunks - Source text fragments in order.
 * @returns Token iterator including `$eof`.
 */
export function lexChunks(
    grammar: Grammar,
    chunks: Iterable<string>,
): IterableIterator<Token>
{
    const lexer = new Lexer(grammar);

    return lexChunksFromLexer(lexer, chunks);
}

/**
 * Lexes asynchronous source chunks into a token stream ending with `$eof`.
 *
 * @param grammar - Grammar supplying lexer rules.
 * @param chunks - Source text fragments in order.
 * @returns Async token iterator including `$eof`.
 */
export async function* lexChunksAsync(
    grammar: Grammar,
    chunks: AsyncIterable<string>,
): AsyncIterableIterator<Token>
{
    const lexer = new Lexer(grammar);

    for await (const chunk of chunks)
    {
        lexer.push(chunk);

        let nextToken = lexer.next();

        while (nextToken !== null)
        {
            yield nextToken;
            nextToken = lexer.next();
        }
    }

    lexer.finish();

    let nextToken = lexer.next();

    while (nextToken !== null)
    {
        yield nextToken;
        nextToken = lexer.next();
    }
}

/**
 * Drains tokens from a lexer fed by synchronous chunks.
 *
 * @param lexer - Configured lexer instance.
 * @param chunks - Source text fragments in order.
 * @returns Token iterator including `$eof`.
 */
function* lexChunksFromLexer(
    lexer: Lexer,
    chunks: Iterable<string>,
): IterableIterator<Token>
{
    for (const chunk of chunks)
    {
        lexer.push(chunk);

        let nextToken = lexer.next();

        while (nextToken !== null)
        {
            yield nextToken;
            nextToken = lexer.next();
        }
    }

    lexer.finish();

    let nextToken = lexer.next();

    while (nextToken !== null)
    {
        yield nextToken;
        nextToken = lexer.next();
    }
}

/**
 * Collects all tokens from a synchronous chunk stream.
 *
 * @param grammar - Grammar supplying lexer rules.
 * @param chunks - Source text fragments in order.
 * @returns Matched tokens including `$eof`.
 */
export function lexChunkStream(
    grammar: Grammar,
    chunks: Iterable<string>,
): readonly Token[]
{
    return [...lexChunks(grammar, chunks)];
}

/**
 * Collects all tokens from an asynchronous chunk stream.
 *
 * @param grammar - Grammar supplying lexer rules.
 * @param chunks - Source text fragments in order.
 * @returns Matched tokens including `$eof`.
 */
export async function lexChunkStreamAsync(
    grammar: Grammar,
    chunks: AsyncIterable<string>,
): Promise<readonly Token[]>
{
    const tokens: Token[] = [];

    for await (const value of lexChunksAsync(grammar, chunks))
    {
        tokens.push(value);
    }

    return tokens;
}
