import { describe, expect, it } from '@jest/globals';

import { AstNode } from '../ast/ast-node.js';
import { TransformSchema } from '../grammar/transform-schema.js';
import { ParseTable } from '../parse-table/parse-table.js';

import { transformCst } from './cst-transformer.js';

describe('transformCst edge conditions', () =>
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
                    label: 'dropMe',
                    expression: { kind: 'drop' },
                },
                {
                    label: 'passMe',
                    expression: { kind: 'pass', reference: 'value' },
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
                rhs: ['[value]:number'],
                variant: 'passMe',
                origin: 'expr',
            },
        ],
    );

    it('returns null for a null CST without throwing', () =>
    {
        expect(() => transformCst(null, schema, table)).not.toThrow();
        expect(transformCst(null, schema, table)).toBeNull();
    });

    it('returns null when a build reference cannot be resolved', () =>
    {
        const cst = AstNode.rule(
            'expr',
            [
                AstNode.terminal('number', '1'),
                AstNode.terminal('plus', '+'),
            ],
            null,
            'binary',
            0,
            'expr',
        );

        expect(() => transformCst(cst, schema, table)).not.toThrow();
        expect(transformCst(cst, schema, table)).toBeNull();
    });

    it('returns null for drop transforms', () =>
    {
        const cst = AstNode.rule('expr', [], null, 'dropMe', 1, 'expr');

        expect(transformCst(cst, schema, table)).toBeNull();
    });

    it('returns null when production metadata is missing for a labeled rule', () =>
    {
        const cst = AstNode.rule(
            'expr',
            [AstNode.terminal('number', '1')],
            null,
            'binary',
            null,
            'expr',
        );

        expect(transformCst(cst, schema, table)).toBeNull();
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

    it('returns null for an epsilon node with no explicit rule', () =>
    {
        const cst = AstNode.rule('empty', [], null, null, 99, 'empty');

        expect(transformCst(cst, schema, table)).toBeNull();
    });
});
