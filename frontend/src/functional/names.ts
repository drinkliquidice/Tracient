/**
 * Frontend-only name helpers. Storage stays as a single "name" string
 * (typically "First Last"); these reformat/sort for display.
 */

export type ParsedPersonName = {
    first: string;
    last: string;
};

/** Split a stored name into first/last. Supports "First Last" and "Last, First". */
export const parsePersonName = (name: string): ParsedPersonName => {
    const trimmed = name.trim();
    if (!trimmed) return { first: '', last: '' };

    if (trimmed.includes(',')) {
        const [lastPart, ...rest] = trimmed.split(',');
        return {
            last: lastPart.trim(),
            first: rest.join(',').trim(),
        };
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return { first: '', last: parts[0] };
    return {
        last: parts[parts.length - 1],
        first: parts.slice(0, -1).join(' '),
    };
};

/** Display as "Last, First" (or just "Last" / original if unparsable). */
export const formatLastFirst = (name: string): string => {
    const { first, last } = parsePersonName(name);
    if (!last && !first) return name.trim();
    if (!first) return last;
    if (!last) return first;
    return `${last}, ${first}`;
};

/** First letter of last name for A–Z filters. */
export const lastNameLetter = (name: string): string => {
    const { last } = parsePersonName(name);
    const letter = (last.charAt(0) || '#').toUpperCase();
    return /[A-Z]/.test(letter) ? letter : '#';
};

const localeOpts: Intl.CollatorOptions = { sensitivity: 'base', numeric: true };

/** Sort comparator: last name, then first name. */
export const compareByLastName = (a: { name: string }, b: { name: string }): number => {
    const pa = parsePersonName(a.name);
    const pb = parsePersonName(b.name);
    const byLast = pa.last.localeCompare(pb.last, undefined, localeOpts);
    if (byLast !== 0) return byLast;
    return pa.first.localeCompare(pb.first, undefined, localeOpts);
};
