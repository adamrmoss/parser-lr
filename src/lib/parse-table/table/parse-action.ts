/**
 * One shift, reduce, or accept entry in an LR parse table.
 */
export type ParseAction =
    | {
        readonly kind: 'shift';
        readonly state: number;
    }
    | {
        readonly kind: 'reduce';
        readonly productionId: number;
    }
    | {
        readonly kind: 'accept';
    };

/**
 * Kind of LR parse table conflict.
 */
export type ParseConflictKind = 'shift-reduce' | 'reduce-reduce';

/**
 * Records an unresolved shift/reduce or reduce/reduce conflict.
 */
export interface ParseConflict
{
    readonly kind: ParseConflictKind;
    readonly state: number;
    readonly symbol: string;
    readonly existing: ParseAction;
    readonly incoming: ParseAction;
}

/**
 * Returns whether two parse actions are identical.
 *
 * @param left - First action.
 * @param right - Second action.
 */
export function parseActionsEqual(left: ParseAction, right: ParseAction): boolean
{
    if (left.kind !== right.kind)
    {
        return false;
    }

    switch (left.kind)
    {
        case 'shift':
            return right.kind === 'shift' && left.state === right.state;

        case 'reduce':
            return right.kind === 'reduce' && left.productionId === right.productionId;

        case 'accept':
            return true;
    }
}

/**
 * Returns a readable parse action label for tests and diagnostics.
 *
 * @param action - Parse action to format.
 */
export function formatParseAction(action: ParseAction): string
{
    switch (action.kind)
    {
        case 'shift':
            return `s${String(action.state)}`;

        case 'reduce':
            return `r${String(action.productionId)}`;

        case 'accept':
            return 'acc';
    }
}

/**
 * Classifies a conflict between two distinct parse actions.
 *
 * @param existing - Action already recorded for the table slot.
 * @param incoming - New action competing for the same slot.
 */
export function classifyParseConflict(
    existing: ParseAction,
    incoming: ParseAction,
): ParseConflictKind
{
    const existingIsShift = existing.kind === 'shift';
    const incomingIsShift = incoming.kind === 'shift';

    if (existingIsShift !== incomingIsShift)
    {
        return 'shift-reduce';
    }

    return 'reduce-reduce';
}
