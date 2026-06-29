import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

/** @type {import('rollup').RollupOptions} */
export default {
    input: 'src/cli/index.ts',
    output: {
        file: 'dist/cli/index.js',
        format: 'esm',
        sourcemap: true,
        banner: '#!/usr/bin/env node',
    },
    plugins: [
        nodeResolve({
            exportConditions: ['node'],
            preferBuiltins: true,
        }),
        commonjs(),
        typescript({
            tsconfig: './tsconfig.cli.json',
        }),
    ],
};
