/**
 * Kumon-style asset codes: 7A-01 … 2A-##, then A-## … L-##.
 * Numbered levels (7A→2A) come before letter-only levels (A→L).
 */

export type ParsedAssetCode = {
    raw: string;
    /** 0 = has leading digits (7A), 1 = letter-only (A) */
    band: 0 | 1;
    /** Leading level number (7 in 7A); 0 when letter-only */
    levelNum: number;
    /** Level letter(s), e.g. "A" */
    levelLetters: string;
    /** Trailing item number (1 in 7A-01); 0 when missing */
    itemNum: number;
    /** Digits as written after the dash, for tie-breaks (01 vs 001) */
    itemDigits: string;
};

const CODE_RE = /^(\d*)([A-Za-z]+)[-–_]?(.*)$/;

export const parseAssetCode = (code: string): ParsedAssetCode => {
    const raw = code.trim();
    const match = raw.match(CODE_RE);
    if (!match) {
        return {
            raw,
            band: 1,
            levelNum: 0,
            levelLetters: raw.toUpperCase(),
            itemNum: 0,
            itemDigits: '',
        };
    }

    const [, digits, letters, rest] = match;
    const itemDigits = (rest.match(/\d+/)?.[0] ?? '').trim();
    const levelNum = digits ? parseInt(digits, 10) : 0;
    const itemNum = itemDigits ? parseInt(itemDigits, 10) : 0;

    return {
        raw,
        band: digits ? 0 : 1,
        levelNum: Number.isFinite(levelNum) ? levelNum : 0,
        levelLetters: letters.toUpperCase(),
        itemNum: Number.isFinite(itemNum) ? itemNum : 0,
        itemDigits,
    };
};

/** Sort: 7A → 6A → … → 2A → A → B → … → L, then by item number. */
export const compareByAssetCode = (
    a: { assetCode?: string; code?: string },
    b: { assetCode?: string; code?: string },
): number => {
    const pa = parseAssetCode(a.assetCode ?? a.code ?? '');
    const pb = parseAssetCode(b.assetCode ?? b.code ?? '');

    if (pa.band !== pb.band) return pa.band - pb.band;

    // Numbered levels: higher first (7A before 6A). Letter-only: ignore.
    if (pa.band === 0 && pa.levelNum !== pb.levelNum) {
        return pb.levelNum - pa.levelNum;
    }

    const byLetter = pa.levelLetters.localeCompare(pb.levelLetters, undefined, {
        sensitivity: 'base',
    });
    if (byLetter !== 0) return byLetter;

    // Keep series together: 01–20 before 001–008 (digit width, then number).
    if (pa.itemDigits.length !== pb.itemDigits.length) {
        return pa.itemDigits.length - pb.itemDigits.length;
    }

    if (pa.itemNum !== pb.itemNum) return pa.itemNum - pb.itemNum;

    return pa.raw.localeCompare(pb.raw, undefined, {
        sensitivity: 'base',
        numeric: true,
    });
};

/** Label under an asset QR: code, with #n when there are multiple copies. */
export const formatAssetQrLabel = (
    assetCode: string,
    options?: { copyIndex?: number; copyCount?: number },
): string => {
    const code = assetCode.trim() || 'ASSET';
    const count = options?.copyCount ?? 1;
    const index = options?.copyIndex;
    if (count > 1 && index != null) return `${code} #${index + 1}`;
    return code;
};
