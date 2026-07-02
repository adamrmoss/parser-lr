/**
 * CommonJS implementation of `grammar-json-path.ts`.
 *
 * During `npm run build:lib`, this file temporarily replaces `grammar-json-path.ts`
 * while `tsc` emits the `dist/lib-cjs/` tree.
 */
export function grammarJsonDirectory(): string
{
    return __dirname;
}
