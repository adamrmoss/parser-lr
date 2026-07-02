import { describe, expect, it } from '@jest/globals';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const distCjsReady = existsSync(join(process.cwd(), 'dist/lib-cjs/index.js'));
const describeCjs = distCjsReady ? describe : describe.skip;
const requirePackage = createRequire(join(process.cwd(), 'package.json'));

describeCjs('CommonJS package entry', () =>
{
    it('loads the library through require("parser-lr")', () =>
    {
        const parserLr = requirePackage('parser-lr') as {
            ParseContext: { fromGrammar: (source: string) => { parseSource: (input: string) => unknown } };
        };

        const context = parserLr.ParseContext.fromGrammar(`
name "cjs-smoke" ;

tokens
    number = /[0-9]+/ ;

start expr ;

grammar
    expr = number ;
`);
        const ast = context.parseSource('42');

        expect(ast).not.toBeNull();
    });
});
