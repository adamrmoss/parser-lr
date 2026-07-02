import { describe, expect, it } from '@jest/globals';
import { join } from 'node:path';

import {
    findChildBySymbol,
    parseFixture,
} from './grammar-fixture.js';

const fixturesRoot = join(process.cwd(), 'grammars/fixtures');

describe('pass preserves production symbol fixtures', () =>
{
    it('bare CLS yields cls_stmt with kw_cls child', () =>
    {
        const ast = parseFixture(
            join(fixturesRoot, 'pass-preserves-production/bare-terminal'),
        );

        expect(ast?.symbol).toBe('cls_stmt');
        expect(ast?.children).toHaveLength(1);
        expect(ast?.children[0]?.symbol).toBe('kw_cls');
        expect(ast?.children[0]?.text).toBe('CLS');
    });

    it('bare END yields end_stmt variant program', () =>
    {
        const ast = parseFixture(
            join(fixturesRoot, 'pass-preserves-production/labeled-variant'),
            'input-end.txt',
        );

        expect(ast?.symbol).toBe('end_stmt');
        expect(ast?.variant).toBe('program');
        expect(ast?.children[0]?.symbol).toBe('kw_end');
    });

    it('END IF yields end_stmt variant if', () =>
    {
        const ast = parseFixture(
            join(fixturesRoot, 'pass-preserves-production/labeled-variant'),
            'input-end-if.txt',
        );

        expect(ast?.symbol).toBe('end_stmt');
        expect(ast?.variant).toBe('if');
        expect(ast?.children.map((child) => child.symbol)).toEqual(['kw_end', 'kw_if']);
    });

    it('CLS WITH foo yields cls_stmt with three children', () =>
    {
        const ast = parseFixture(
            join(fixturesRoot, 'pass-preserves-production/optional-present'),
        );

        expect(ast?.symbol).toBe('cls_stmt');
        expect(ast?.children.map((child) => child.symbol)).toEqual(['kw_cls', 'kw_with', 'ident']);
    });

    it('bare CLS optional absent yields cls_stmt with one child', () =>
    {
        const ast = parseFixture(
            join(fixturesRoot, 'pass-preserves-production/optional-absent'),
        );

        expect(ast?.symbol).toBe('cls_stmt');
        expect(ast?.children).toHaveLength(1);
        expect(ast?.children[0]?.symbol).toBe('kw_cls');
    });
});

describe('nested production preservation fixtures', () =>
{
    it('HELP PRINT preserves help_topic wrapper', () =>
    {
        const ast = parseFixture(join(fixturesRoot, 'help-topic'));

        expect(ast?.symbol).toBe('help_stmt');
        expect(ast?.children.map((child) => child.symbol)).toEqual(['kw_help', 'help_topic']);
        expect(findChildBySymbol(ast!, 'help_topic')?.variant).toBe('keyword');
        expect(findChildBySymbol(ast!, 'help_topic')?.children[0]?.symbol).toBe('kw_print');
    });

    it('CASE IS relational preserves comparison_op wrapper', () =>
    {
        const ast = parseFixture(join(fixturesRoot, 'comparison-op'));

        expect(ast?.symbol).toBe('case_selector');
        expect(ast?.variant).toBe('relational');
        expect(findChildBySymbol(ast!, 'comparison_op')?.variant).toBe('less');
        expect(findChildBySymbol(ast!, 'comparison_op')?.children[0]?.symbol).toBe('less');
    });

    it('LET x% = 1 preserves let_target wrapper', () =>
    {
        const ast = parseFixture(join(fixturesRoot, 'let-target'));

        expect(ast?.symbol).toBe('let_stmt');
        expect(findChildBySymbol(ast!, 'let_target')?.symbol).toBe('let_target');
        expect(findChildBySymbol(ast!, 'let_target')?.children[0]?.symbol).toBe('identifier');
    });

    it('nested comparison_op with its own transform stays wrapped under case_selector', () =>
    {
        const ast = parseFixture(join(fixturesRoot, 'nested-production-repro'));
        const caseSelector = findChildBySymbol(ast!, 'case_selector');

        // The doc's acceptance: case_selector child at index 1 is comparison_op, not less.
        expect(caseSelector?.children[1]?.symbol).toBe('comparison_op');
        expect(caseSelector?.children[1]?.variant).toBe('less');
        expect(caseSelector?.children[1]?.children[0]?.symbol).toBe('less');
    });
});

describe('flatten and build optional fixtures', () =>
{
    it('flattens comma-separated list into ordered items', () =>
    {
        const ast = parseFixture(join(fixturesRoot, 'flatten-repeat'));

        expect(ast?.symbol).toBe('list');
        expect(ast?.variant).toBe('list');
        expect(ast?.children.map((child) => child.children[0]?.text ?? child.text)).toEqual(['a', 'b', 'c']);
    });

    it('build omits absent optional slots', () =>
    {
        const ast = parseFixture(join(fixturesRoot, 'build-optional'));

        expect(ast?.symbol).toBe('cls_stmt');
        expect(ast?.variant).toBe('main');
        expect(ast?.children).toHaveLength(1);
        expect(ast?.children[0]?.symbol).toBe('kw_cls');
    });
});
