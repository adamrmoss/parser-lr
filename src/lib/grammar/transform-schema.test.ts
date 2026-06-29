import { describe, expect, it } from '@jest/globals';

import { TransformSchema } from './transform-schema.js';

describe('TransformSchema', () =>
{
    it('looks up rules by production name', () =>
    {
        const schema = new TransformSchema([
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
                        label: 'term',
                        expression: {
                            kind: 'pass',
                            reference: 'term',
                        },
                    },
                ],
            },
            {
                production: 'factor',
                alternatives: [
                    {
                        label: 'number',
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

        expect(schema.rules).toHaveLength(2);
        expect(schema.hasRule('expr')).toBe(true);
        expect(schema.rule('expr')?.alternatives).toHaveLength(2);
        expect(schema.rule('factor')?.alternatives[0]?.expression).toEqual({
            kind: 'build',
            typeName: 'expr',
            variant: 'literal',
            arguments: ['number'],
        });
        expect(schema.rule('missing')).toBeNull();
    });
});
