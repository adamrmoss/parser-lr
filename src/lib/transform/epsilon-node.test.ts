import { describe, expect, it } from '@jest/globals';

import { AstNode } from '../ast/ast-node.js';
import { ParseTable } from '../parse-table/parse-table.js';

import {
    isAuthoredEpsilonNode,
    isEpsilonNode,
    isSyntheticEpsilonNode,
} from './epsilon-node.js';

describe('epsilon-node classification', () =>
{
    const table = new ParseTable(
        'sample',
        'start',
        ['$eof'],
        [],
        [],
        [],
        'lr1',
        1,
        [
            {
                id: 0,
                name: 'optional_color',
                rhs: [],
                variant: 'absent',
                origin: 'optional_color',
            },
            {
                id: 1,
                name: 'list$repeat_0',
                rhs: [],
                variant: null,
                origin: 'list$repeat_0',
            },
            {
                id: 2,
                name: 'item',
                rhs: ['ident'],
                variant: null,
                origin: 'item',
            },
        ],
    );

    it('classifies authored labeled epsilons', () =>
    {
        const node = AstNode.rule('optional_color', [], null, 'absent', 0, 'optional_color');

        expect(isEpsilonNode(node, table)).toBe(true);
        expect(isAuthoredEpsilonNode(node, table)).toBe(true);
        expect(isSyntheticEpsilonNode(node, table)).toBe(false);
    });

    it('classifies synthetic unlabeled epsilons', () =>
    {
        const node = AstNode.rule('list$repeat_0', [], null, null, 1, 'list$repeat_0');

        expect(isEpsilonNode(node, table)).toBe(true);
        expect(isAuthoredEpsilonNode(node, table)).toBe(false);
        expect(isSyntheticEpsilonNode(node, table)).toBe(true);
    });

    it('rejects non-epsilon nodes', () =>
    {
        const node = AstNode.rule(
            'item',
            [AstNode.terminal('ident', 'a')],
            null,
            null,
            2,
            'item',
        );

        expect(isEpsilonNode(node, table)).toBe(false);
        expect(isAuthoredEpsilonNode(node, table)).toBe(false);
        expect(isSyntheticEpsilonNode(node, table)).toBe(false);
    });
});
