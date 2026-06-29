import { describe, expect, it } from '@jest/globals';

import { AstSchema } from './ast-schema.js';

describe('AstSchema', () =>
{
    it('looks up types by name', () =>
    {
        const schema = new AstSchema([
            {
                name: 'expr',
                expression: {
                    kind: 'choice',
                    alternatives: [
                        {
                            label: 'binary',
                            expression: {
                                kind: 'sequence',
                                elements: [
                                    { kind: 'boundReference', binding: 'left', name: 'expr' },
                                    { kind: 'boundReference', binding: 'operator', name: 'operator' },
                                    { kind: 'boundReference', binding: 'right', name: 'expr' },
                                ],
                            },
                        },
                        {
                            label: 'literal',
                            expression: { kind: 'reference', name: 'number' },
                        },
                    ],
                },
            },
        ]);

        expect(schema.types).toHaveLength(1);
        expect(schema.hasType('expr')).toBe(true);
        expect(schema.type('expr')?.name).toBe('expr');
        expect(schema.type('missing')).toBeNull();
    });
});
