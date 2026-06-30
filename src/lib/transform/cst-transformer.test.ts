import { describe, expect, it } from '@jest/globals';

import { AstNode } from '../ast/ast-node.js';
import { TransformSchema } from '../grammar/transform-schema.js';
import { ParseTable } from '../parse-table/parse-table.js';

import { referenceSlotIndex } from './binding-map.js';
import { transformCst } from './cst-transformer.js';

describe('referenceSlotIndex', () =>
{
    it('maps binding names and bare symbols to rhs child indices', () =>
    {
        const production = {
            id: 0,
            name: 'expr',
            rhs: ['[left]:expr', 'plus', '[right]:number'],
            variant: 'binary',
            origin: 'expr',
        };

        expect(referenceSlotIndex(production, 'left')).toBe(0);
        expect(referenceSlotIndex(production, 'plus')).toBe(1);
        expect(referenceSlotIndex(production, 'right')).toBe(2);
        expect(referenceSlotIndex(production, 'missing')).toBeNull();
    });
});

describe('transformCst', () =>
{
    const schema = new TransformSchema([
        {
            production: 'expr',
            alternatives: [
                {
                    label: 'binary',
                    expression: {
                        kind: 'build',
                        typeName: 'expr',
                        variant: 'binary',
                        arguments: ['left', 'operator', 'right'],
                    },
                },
                {
                    label: 'literal',
                    expression: {
                        kind: 'build',
                        typeName: 'expr',
                        variant: 'literal',
                        arguments: ['number'],
                    },
                },
            ],
        },
    ]);

    const table = new ParseTable(
        'calc',
        'expr',
        ['number', 'plus', '$eof'],
        [],
        [],
        [],
        'lr1',
        1,
        [
            {
                id: 0,
                name: 'expr',
                rhs: ['[left]:expr', '[operator]:plus', '[right]:number'],
                variant: 'binary',
                origin: 'expr',
            },
            {
                id: 1,
                name: 'expr',
                rhs: ['number'],
                variant: 'literal',
                origin: 'expr',
            },
        ],
    );

    it('builds an AST node from a labeled binary CST node', () =>
    {
        const cst = AstNode.rule(
            'expr',
            [
                AstNode.rule(
                    'expr',
                    [AstNode.terminal('number', '1', { offset: 0, length: 1 })],
                    { offset: 0, length: 1 },
                    'literal',
                    1,
                    'expr',
                ),
                AstNode.terminal('plus', '+', { offset: 2, length: 1 }),
                AstNode.terminal('number', '2', { offset: 4, length: 1 }),
            ],
            { offset: 0, length: 5 },
            'binary',
            0,
            'expr',
        );

        expect(transformCst(cst, schema, table)).toEqual({
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

    it('passes through a single child when no transform rule exists', () =>
    {
        const cst = AstNode.rule(
            'wrapper',
            [AstNode.terminal('number', '7', { offset: 0, length: 1 })],
            { offset: 0, length: 1 },
            null,
            null,
            'wrapper',
        );

        expect(transformCst(cst, schema, table)).toEqual({
            symbol: 'number',
            children: [],
            text: '7',
            location: { offset: 0, length: 1 },
            variant: null,
            productionId: null,
            origin: null,
        });
    });

    it('returns null for drop transforms', () =>
    {
        const dropSchema = new TransformSchema([
            {
                production: 'skip',
                alternatives: [{
                    label: 'ignored',
                    expression: { kind: 'drop' },
                }],
            },
        ]);
        const cst = AstNode.rule('skip', [], null, 'ignored');

        expect(transformCst(cst, dropSchema, table)).toBeNull();
    });
});
