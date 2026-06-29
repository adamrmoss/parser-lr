import type { AstType } from './ast-type.js';

/**
 * AST shape declared in the `ast` section of a `.grammar` file.
 */
export class AstSchema
{
    private readonly typesByName: ReadonlyMap<string, AstType>;

    /**
     * Creates an AST schema from declared types.
     *
     * @param types - Named AST types from the `ast` section.
     */
    public constructor(public readonly types: readonly AstType[])
    {
        // Index types by name for lookup.
        const typesByName = new Map<string, AstType>();

        for (const type of types)
        {
            typesByName.set(type.name, type);
        }

        this.typesByName = typesByName;
    }

    /**
     * Returns an AST type by name.
     *
     * @param name - Type name to look up.
     * @returns The matching type, or null when the name is undefined.
     */
    public type(name: string): AstType | null
    {
        return this.typesByName.get(name) ?? null;
    }

    /**
     * Whether a named AST type is defined in this schema.
     *
     * @param name - Type name to test.
     */
    public hasType(name: string): boolean
    {
        return this.typesByName.has(name);
    }
}
