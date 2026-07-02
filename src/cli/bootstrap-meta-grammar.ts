import grammarTableJson from '../lib/grammar/grammar.json' with { type: 'json' };
import { setBootstrapTableJson } from '../lib/grammar/index.js';
import type { ParseTableJson } from '../lib/index.js';

/**
 * Injects the meta-grammar table inlined into the CLI bundle.
 *
 * @remarks
 * The Rollup bundle embeds `grammar.json` through this JSON import, so the CLI
 * never reads a `grammar.json` file relative to `bin/`. This keeps the published
 * command self-contained when unpacked from the npm tarball.
 */
export function bootstrapMetaGrammar(): void
{
    setBootstrapTableJson(grammarTableJson as ParseTableJson);
}
