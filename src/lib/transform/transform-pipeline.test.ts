import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readGrammar } from '../grammar/read-grammar.js';
import { ParseContext } from '../parse-context.js';

describe('calc.grammar transform pipeline', () =>
{
    const grammarSource = readFileSync(join(process.cwd(), 'grammars/calc.grammar'), 'utf8');

    it('parses and transforms addition into an AST', () =>
    {
        const context = ParseContext.fromGrammar(grammarSource, 'lr1');
        const ast = context.parseSource('1 + 2');

        expect(ast).toEqual({
            symbol: 'expr',
            children: [
                {
                    symbol: 'expr',
                    children: [
                        {
                            symbol: 'number',
                            children: [],
                            text: '1',
                            location: { offset: 0, length: 1 },
                            variant: null,
                            productionId: null,
                            origin: null,
                        },
                    ],
                    text: null,
                    location: { offset: 0, length: 1 },
                    variant: 'literal',
                    productionId: null,
                    origin: null,
                },
                {
                    symbol: 'plus',
                    children: [],
                    text: '+',
                    location: { offset: 2, length: 1 },
                    variant: null,
                    productionId: null,
                    origin: null,
                },
                {
                    symbol: 'number',
                    children: [],
                    text: '2',
                    location: { offset: 4, length: 1 },
                    variant: null,
                    productionId: null,
                    origin: null,
                },
            ],
            text: null,
            location: { offset: 0, length: 5 },
            variant: 'binary',
            productionId: null,
            origin: null,
        });
    });
});
