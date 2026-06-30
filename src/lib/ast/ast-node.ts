/**
 * Source offset and length for a span of input text.
 */
export interface SourceLocation
{
    readonly offset: number;
    readonly length: number;
}

/**
 * Tree node used for both parse (CST) and abstract (AST) phases.
 *
 * After parsing, {@link symbol} is a grammar production and {@link variant}
 * is the matched `#` label. After transform, {@link symbol} is an AST type
 * name and {@link variant} is the AST alternative label.
 */
export class AstNode
{
    /**
     * Creates a tree node.
     *
     * @param symbol - Production or AST type name.
     * @param children - Child subtrees.
     * @param text - Lexeme or literal text for leaves; null for interior nodes.
     * @param location - Optional source span.
     * @param variant - `#` alternative label when present.
     * @param productionId - Parse table production id for CST nodes, or null after transform.
     * @param origin - Source production or synthetic construct name for CST nodes.
     */
    public constructor(
        public readonly symbol: string,
        public readonly children: readonly AstNode[] = [],
        public readonly text: string | null = null,
        public readonly location: SourceLocation | null = null,
        public readonly variant: string | null = null,
        public readonly productionId: number | null = null,
        public readonly origin: string | null = null,
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
     * Builds an interior node from a grammar or AST reduction.
     *
     * @param symbol - Production or AST type name.
     * @param children - Reduced child subtrees.
     * @param location - Optional source span covering the full production.
     * @param variant - `#` alternative label when present.
     * @param productionId - Parse table production id for CST nodes.
     * @param origin - Source production or synthetic construct name for CST nodes.
     */
    public static rule(
        symbol: string,
        children: readonly AstNode[],
        location: SourceLocation | null = null,
        variant: string | null = null,
        productionId: number | null = null,
        origin: string | null = null,
    ): AstNode
    {
        return new AstNode(symbol, children, null, location, variant, productionId, origin);
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
        return new AstNode(symbol, [], text, location, null);
    }
}
