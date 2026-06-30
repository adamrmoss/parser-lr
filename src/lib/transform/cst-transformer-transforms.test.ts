import { describe, expect, it } from '@jest/globals';

import { AstNode } from '../ast/ast-node.js';
import { TransformSchema } from '../grammar/transform-schema.js';
import { ParseTable } from '../parse-table/parse-table.js';

import { describeProductionSlots, transformCst } from './cst-transformer.js';

describe('transformCst fold and flatten expressions', () =>
{
    const foldLeftSchema = new TransformSchema([
        {
            production: 'expr',
            alternatives: [
                {
                    label: 'add',
                    expression: {
                        kind: 'foldLeft',
                        typeName: 'expr',
                        variant: 'binary',
                        references: ['left', 'operator', 'right'],
                    },
                },
                {
                    label: 'literal',
                    expression: {
                        kind: 'pass',
                        reference: 'number',
                    },
                },
            ],
        },
    ]);

    const foldRightSchema = new TransformSchema([
        {
            production: 'expr',
            alternatives: [
                {
                    label: 'mul',
                    expression: {
                        kind: 'foldRight',
                        typeName: 'expr',
                        variant: 'binary',
                        references: ['left', 'operator', 'right'],
                    },
                },
            ],
        },
    ]);

    const table = new ParseTable(
        'calc',
        'expr',
        ['number', 'plus', 'star', '$eof'],
        [],
        [],
        [],
        'lr1',
        1,
        [
            {
                id: 0,
                name: 'expr',
                rhs: ['[left]:expr', '[operator]:plus', '[right]:expr'],
                variant: 'add',
                origin: 'expr',
            },
            {
                id: 1,
                name: 'expr',
                rhs: ['number'],
                variant: 'literal',
                origin: 'expr',
            },
            {
                id: 2,
                name: 'expr',
                rhs: ['[left]:expr', '[operator]:star', '[right]:expr'],
                variant: 'mul',
                origin: 'expr',
            },
            {
                id: 3,
                name: 'list',
                rhs: ['[item]:number', 'list$repeat_0'],
                variant: 'items',
                origin: 'list',
            },
            {
                id: 4,
                name: 'list$repeat_0',
                rhs: [],
                variant: null,
                origin: 'list',
            },
        ],
    );

    it('left-folds a chain of additions', () =>
    {
        const tail = AstNode.rule(
            'expr',
            [
                AstNode.terminal('number', '2', { offset: 4, length: 1 }),
                AstNode.terminal('plus', '+', { offset: 6, length: 1 }),
                AstNode.terminal('number', '3', { offset: 8, length: 1 }),
            ],
            { offset: 4, length: 5 },
            'add',
            0,
            'expr',
        );
        const cst = AstNode.rule(
            'expr',
            [
                AstNode.terminal('number', '1', { offset: 0, length: 1 }),
                AstNode.terminal('plus', '+', { offset: 2, length: 1 }),
                tail,
            ],
            { offset: 0, length: 9 },
            'add',
            0,
            'expr',
        );

        const ast = transformCst(cst, foldLeftSchema, table);

        expect(ast?.variant).toBe('binary');
        expect(ast?.children).toHaveLength(3);
        expect(ast?.children[0]?.variant).toBe('binary');
    });

    it('right-folds a chain of multiplications', () =>
    {
        const tail = AstNode.rule(
            'expr',
            [
                AstNode.terminal('number', '2', { offset: 4, length: 1 }),
                AstNode.terminal('star', '*', { offset: 6, length: 1 }),
                AstNode.terminal('number', '3', { offset: 8, length: 1 }),
            ],
            { offset: 4, length: 5 },
            'mul',
            2,
            'expr',
        );
        const cst = AstNode.rule(
            'expr',
            [
                AstNode.terminal('number', '1', { offset: 0, length: 1 }),
                AstNode.terminal('star', '*', { offset: 2, length: 1 }),
                tail,
            ],
            { offset: 0, length: 9 },
            'mul',
            2,
            'expr',
        );

        const ast = transformCst(cst, foldRightSchema, table);

        expect(ast?.variant).toBe('binary');
        expect(ast?.children).toHaveLength(3);
    });

    it('flattens repeat tails into one list node', () =>
    {
        const schema = new TransformSchema([
            {
                production: 'items',
                alternatives: [
                    {
                        label: 'pair',
                        expression: {
                            kind: 'flatten',
                            typeName: 'items',
                            variant: 'list',
                            head: 'first',
                            tail: 'rest',
                        },
                    },
                ],
            },
        ]);
        const flattenTable = new ParseTable(
            'list',
            'items',
            ['number', '$eof'],
            [],
            [],
            [],
            'lr1',
            1,
            [{
                id: 0,
                name: 'items',
                rhs: ['[first]:number', '[rest]:items'],
                variant: 'pair',
                origin: 'items',
            }],
        );
        const cst = AstNode.rule(
            'items',
            [
                AstNode.terminal('number', '1', { offset: 0, length: 1 }),
                AstNode.rule(
                    'items',
                    [AstNode.terminal('number', '2', { offset: 2, length: 1 })],
                    { offset: 2, length: 1 },
                    'pair',
                    0,
                    'items',
                ),
            ],
            { offset: 0, length: 3 },
            'pair',
            0,
            'items',
        );

        const ast = transformCst(cst, schema, flattenTable);

        expect(ast?.symbol).toBe('items');
        expect(ast?.children.map((child) => child.text)).toEqual(['1', '2']);
    });

    it('resolves references by child symbol when bindings are absent', () =>
    {
        const schema = new TransformSchema([
            {
                production: 'wrap',
                alternatives: [
                    {
                        label: 'main',
                        expression: {
                            kind: 'pass',
                            reference: 'number',
                        },
                    },
                ],
            },
        ]);
        const wrapTable = new ParseTable(
            'wrap',
            'wrap',
            ['number', '$eof'],
            [],
            [],
            [],
            'lr1',
            1,
            [{
                id: 0,
                name: 'wrap',
                rhs: ['number'],
                variant: 'main',
                origin: 'wrap',
            }],
        );
        const cst = AstNode.rule(
            'wrap',
            [AstNode.terminal('number', '9', { offset: 0, length: 1 })],
            { offset: 0, length: 1 },
            'main',
            0,
            'wrap',
        );

        expect(transformCst(cst, schema, wrapTable)?.text).toBe('9');
    });

    it('returns null for epsilon productions during default transform', () =>
    {
        const schema = new TransformSchema([]);
        const epsilonTable = new ParseTable(
            'empty',
            'empty',
            ['$eof'],
            [],
            [],
            [],
            'lr1',
            1,
            [{
                id: 0,
                name: 'empty',
                rhs: [],
                variant: null,
                origin: 'empty',
            }],
        );
        const cst = AstNode.rule('empty', [], { offset: 0, length: 0 }, null, 0, 'empty');

        expect(transformCst(cst, schema, epsilonTable)).toBeNull();
    });

    it('describes production slots for diagnostics', () =>
    {
        const slots = describeProductionSlots({
            id: 0,
            name: 'expr',
            rhs: ['[left]:expr', 'plus', '[right]:number'],
            variant: 'binary',
            origin: 'expr',
        });

        expect(slots).toEqual([
            { index: 0, binding: 'left', symbol: 'expr' },
            { index: 1, binding: null, symbol: 'plus' },
            { index: 2, binding: 'right', symbol: 'number' },
        ]);
    });
});
