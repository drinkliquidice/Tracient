/** Display timezone for the center (handles EST/EDT automatically). */
export const CENTER_TIME_ZONE = 'America/New_York';

const asDate = (value: Date | string | number): Date =>
    value instanceof Date ? value : new Date(value);

export const formatEasternTime = (
    value: Date | string | number | null | undefined,
    options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string => {
    if (value == null) return '';
    return asDate(value).toLocaleTimeString('en-US', {
        ...options,
        timeZone: CENTER_TIME_ZONE,
    });
};

export const formatEasternDate = (
    value: Date | string | number | null | undefined,
    options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string => {
    if (value == null) return '';
    return asDate(value).toLocaleDateString('en-US', {
        ...options,
        timeZone: CENTER_TIME_ZONE,
    });
};

/** Calendar date key in center timezone, e.g. "2026-11-07". */
export const easternDateKey = (
    value: Date | string | number | null | undefined,
): string | null => {
    if (value == null) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: CENTER_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(asDate(value));
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (!year || !month || !day) return null;
    return `${year}-${month}-${day}`;
};

export const isEasternToday = (
    value: Date | string | number | null | undefined,
): boolean => {
    const key = easternDateKey(value);
    if (!key) return false;
    return key === easternDateKey(new Date());
};
