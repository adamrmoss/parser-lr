import { describe, expect, it } from '@jest/globals';
import { join } from 'node:path';

import { discoverFixtures, runFixtureCase } from './grammar-fixture.js';

const fixturesRoot = join(process.cwd(), 'grammars/fixtures');

describe('grammar fixture harness', () =>
{
    const fixtures = discoverFixtures(fixturesRoot);

    it('discovers fixture cases under grammars/fixtures', () =>
    {
        expect(fixtures.length).toBeGreaterThanOrEqual(10);
    });

    it.each(fixtures.map((fixture) => [fixture.name, fixture] as const))(
        'parses %s without throwing',
        (_name, fixture) =>
        {
            expect(() => runFixtureCase(fixture, expect)).not.toThrow();
        },
    );
});
