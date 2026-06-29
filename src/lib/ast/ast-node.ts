/**
 * Source offset and length for a span of input text.
 */
export interface SourceLocation
{
    readonly offset: number;
    readonly length: number;
}

/**
 * Node in a parse tree produced by shift-reduce parsing.
 *
 * Interior nodes represent grammar symbols with child subtrees.
 * Leaf nodes carry terminal lexeme text.
 */
export class AstNode
{
    /**
     * Creates a parse tree node.
     *
     * @param symbol - Grammar symbol name (non-terminal or terminal).
     * @param children - Child nodes for interior symbols.
     * @param text - Lexeme text for terminal leaves; null for interior nodes.
     * @param location - Optional source span for this node.
     */
    public constructor(
        public readonly symbol: string,
        public readonly children: readonly AstNode[] = [],
        public readonly text: string | null = null,
        public readonly location: SourceLocation | null = null,
    )
    {
    }

    /**
     * Whether this node is a terminal leaf with lexeme text.
     */
    public get isTerminal(): boolean
    {
        return this.text !== null;
    }

    /**
     * Builds an interior node for a reduced non-terminal symbol.
     *
     * @param symbol - Non-terminal symbol name.
     * @param children - Reduced child subtrees.
     * @param location - Optional source span covering the full production.
     */
    public static rule(
        symbol: string,
        children: readonly AstNode[],
        location: SourceLocation | null = null,
    ): AstNode
    {
        return new AstNode(symbol, children, null, location);
    }

    /**
     * Builds a terminal leaf node.
     *
     * @param symbol - Terminal symbol name.
     * @param text - Matched lexeme text.
     * @param location - Optional source span for the lexeme.
     */
    public static terminal(
        symbol: string,
        text: string,
        location: SourceLocation | null = null,
    ): AstNode
    {
        return new AstNode(symbol, [], text, location);
    }
}
