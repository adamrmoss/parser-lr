import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

/** @type {import('rollup').RollupOptions} */
export default {
    input: 'src/cli/index.ts',
    output: {
        file: 'bin/parser-lr.js',
        format: 'esm',
        sourcemap: true,
        banner: '#!/usr/bin/env node',
    },
    plugins: [
        json(),
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
