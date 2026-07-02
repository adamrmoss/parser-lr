/** @type {import('jest').Config} */
const config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^(\\.{1,2}/.*)grammar-json-path\\.esm\\.js$': '<rootDir>/src/lib/grammar/grammar-json-path.cjs.ts',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    collectCoverageFrom: [
        'src/lib/**/*.ts',
        'src/cli/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/index.ts',
        '!src/lib/grammar/expression.ts',
        '!src/lib/grammar/production.ts',
        '!src/lib/grammar/token-rule.ts',
        '!src/lib/grammar/ast-type.ts',
        '!src/lib/grammar/transform-expression.ts',
        '!src/lib/grammar/transform-rule.ts',
        '!src/lib/parse-table/bnf/bnf-production.ts',
    ],
    coverageProvider: 'v8',
    coverageDirectory: 'coverage',
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.test.json',
            },
        ],
    },
};

export default config;
