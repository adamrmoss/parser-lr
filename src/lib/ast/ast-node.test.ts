import { describe, expect, it } from '@jest/globals';

import { AstNode } from './ast-node.js';

describe('AstNode', () =>
{
    it('builds a terminal leaf', () =>
    {
        const node = AstNode.terminal('IDENT', 'foo');

        expect(node.symbol).toBe('IDENT');
        expect(node.text).toBe('foo');
        expect(node.children).toEqual([]);
        expect(node.isTerminal).toBe(true);
    });

    it('builds an interior rule node', () =>
    {
        const child = AstNode.terminal('NUMBER', '42');
        const node = AstNode.rule('expr', [child]);

        expect(node.symbol).toBe('expr');
        expect(node.text).toBeNull();
        expect(node.children).toEqual([child]);
        expect(node.isTerminal).toBe(false);
    });
});
