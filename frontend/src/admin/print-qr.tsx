import { Component, For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { AppHeader } from '@/components/AppHeader';
import { backendRequest, getToken } from '@/functional/utils';
import {
    OrganizationAssetData,
    OrganizationInterfaceData,
    OrganizationMemberData,
} from '@/admin/organizations/functional/types';
import {
    QL800_LABEL_HEIGHT_IN,
    QL800_LABEL_WIDTH_IN,
    QL800_QR_SIDE_IN,
    QL800_SHEET_CAPACITY,
    QR_SHEET_CAPACITY,
    QR_SHEET_COLS,
    QR_SHEET_ROWS,
    qrCodeUrl,
} from '@/admin/organizations/functional/qr';
import { compareByLastName, formatLastFirst } from '@/functional/names';
import { compareByAssetCode, formatAssetQrLabel } from '@/functional/assetCodes';

type Kind = 'members' | 'assets';
type PaperFormat = 'a4' | 'ql800';

type PrintableItem = {
    key: string;
    name: string;
    endpoint: string;
    kind: 'member' | 'asset';
    groupLabel?: string;
};

const memberItems = (members: OrganizationMemberData[]): PrintableItem[] =>
    [...members].sort(compareByLastName).map(m => ({
        key: `member:${m.id}`,
        name: formatLastFirst(m.name),
        endpoint: m.endpoint,
        kind: 'member' as const,
    }));

const assetItems = (assets: OrganizationAssetData[]): PrintableItem[] => {
    const items: PrintableItem[] = [];
    for (const group of [...assets].sort(compareByAssetCode)) {
        const copies = group.copies ?? [];
        if (copies.length === 0 && group.endpoint) {
            items.push({
                key: `asset:${group.id}`,
                name: formatAssetQrLabel(group.assetCode),
                endpoint: group.endpoint,
                kind: 'asset',
                groupLabel: group.name,
            });
            continue;
        }
        copies.forEach((copy, index) => {
            items.push({
                key: `asset:${copy.id}`,
                name: formatAssetQrLabel(group.assetCode, {
                    copyIndex: index,
                    copyCount: copies.length,
                }),
                endpoint: copy.endpoint || copy.id,
                kind: 'asset',
                groupLabel: group.name,
            });
        });
    }
    return items;
};

const sheetCapacity = (paper: PaperFormat) =>
    paper === 'ql800' ? QL800_SHEET_CAPACITY : QR_SHEET_CAPACITY;

const chunkPages = (items: PrintableItem[], paper: PaperFormat) => {
    const capacity = sheetCapacity(paper);
    const pages: PrintableItem[][] = [];
    for (let i = 0; i < items.length; i += capacity) {
        pages.push(items.slice(i, i + capacity));
    }
    return pages;
};

const paperLabel = (paper: PaperFormat) =>
    paper === 'ql800'
        ? `QL-800 · ${QL800_LABEL_WIDTH_IN}" · 1 per label`
        : `A4 · ${QR_SHEET_COLS}×${QR_SHEET_ROWS} per sheet`;

const CheckboxMark: Component<{ checked: boolean }> = (props) => (
    <span
        role="checkbox"
        aria-checked={props.checked}
        class="w-4 h-4 rounded-sm border border-text/20 flex items-center justify-center transition-colors shrink-0"
        classList={{
            'bg-accent border-accent': props.checked,
            'bg-transparent': !props.checked,
        }}
    >
        <Show when={props.checked}>
            <svg class="w-3 h-3 text-text" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        </Show>
    </span>
);

const PrintQrPage: Component = () => {
    const navigate = useNavigate();
    const tok = getToken();

    if (!tok) {
        navigate('/login/', { replace: true });
    }

    const [data, setData] = createSignal<OrganizationInterfaceData | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');
    const [kind, setKind] = createSignal<Kind>('members');
    const [paper, setPaper] = createSignal<PaperFormat>('a4');
    const [query, setQuery] = createSignal('');
    const [selected, setSelected] = createSignal<Record<string, boolean>>({});

    onMount(async () => {
        try {
            const next = await backendRequest<OrganizationInterfaceData>('GET', '/api/admin/dashboard', tok!);
            setData(next);
            // Default: nothing selected — user chooses what to print
            setSelected({});
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load organization data.');
            if (e?.status === 401) navigate('/login/', { replace: true });
        } finally {
            setLoading(false);
        }
    });

    const members = createMemo(() => memberItems(data()?.users ?? []));
    const assets = createMemo(() => assetItems(data()?.assets ?? []));
    const catalog = createMemo(() => (kind() === 'members' ? members() : assets()));

    const filtered = createMemo(() => {
        const q = query().trim().toLowerCase();
        if (!q) return catalog();
        return catalog().filter(item =>
            item.name.toLowerCase().includes(q) ||
            (item.groupLabel?.toLowerCase().includes(q) ?? false) ||
            item.endpoint.toLowerCase().includes(q)
        );
    });

    const selectedItems = createMemo(() => {
        const map = selected();
        return [...members(), ...assets()].filter(item => map[item.key]);
    });

    const selectedInView = createMemo(() =>
        filtered().filter(item => selected()[item.key]).length
    );

    const pages = createMemo(() => chunkPages(selectedItems(), paper()));
    const isQl800 = createMemo(() => paper() === 'ql800');
    const unitLabel = createMemo(() => (isQl800() ? 'label' : 'sheet'));

    const toggle = (key: string) => {
        setSelected(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const selectAllFiltered = () => {
        setSelected(prev => {
            const next = { ...prev };
            for (const item of filtered()) next[item.key] = true;
            return next;
        });
    };

    const clearFiltered = () => {
        setSelected(prev => {
            const next = { ...prev };
            for (const item of filtered()) delete next[item.key];
            return next;
        });
    };

    const clearAll = () => setSelected({});

    const handlePrint = () => {
        if (!selectedItems().length) return;
        window.print();
    };

    const printStyles = createMemo(() => {
        if (isQl800()) {
            return `
                @media print {
                    @page { size: ${QL800_LABEL_WIDTH_IN}in ${QL800_LABEL_HEIGHT_IN}in; margin: 0; }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        color: #111 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    .print-root {
                        display: block !important;
                        background: #fff !important;
                        color: #111 !important;
                        max-height: none !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    .print-sheets-wrap {
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print-page {
                        width: ${QL800_LABEL_WIDTH_IN}in;
                        height: ${QL800_LABEL_HEIGHT_IN}in;
                        padding: 0.12in;
                        margin: 0;
                        box-shadow: none !important;
                        page-break-after: always;
                        break-after: page;
                        display: grid;
                        grid-template-columns: 1fr;
                        grid-template-rows: 1fr;
                        overflow: hidden;
                        background: #fff;
                    }
                    .print-page:last-child {
                        page-break-after: auto;
                        break-after: auto;
                    }
                }
                @media screen {
                    .print-page {
                        width: ${QL800_LABEL_WIDTH_IN}in;
                        height: ${QL800_LABEL_HEIGHT_IN}in;
                        padding: 0.12in;
                        margin: 0 auto 12px;
                        display: grid;
                        grid-template-columns: 1fr;
                        grid-template-rows: 1fr;
                        overflow: hidden;
                        background: #fff;
                        color: #111;
                        box-shadow: 0 1px 6px rgba(0,0,0,0.15);
                    }
                }
                .print-cell {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.08in;
                    padding: 0;
                    min-height: 0;
                    min-width: 0;
                    overflow: hidden;
                }
                .print-cell img {
                    width: ${QL800_QR_SIDE_IN}in;
                    height: ${QL800_QR_SIDE_IN}in;
                    max-width: 100%;
                    max-height: 78%;
                    object-fit: contain;
                    flex-shrink: 0;
                }
                .print-cell .label {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                    font-size: 9pt;
                    line-height: 1.15;
                    text-align: center;
                    max-width: 100%;
                    max-height: 0.4in;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    color: #111;
                }
            `;
        }

        return `
            @media print {
                @page { size: A4 portrait; margin: 0; }
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff !important;
                    color: #111 !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .no-print { display: none !important; }
                .print-root {
                    display: block !important;
                    background: #fff !important;
                    color: #111 !important;
                    max-height: none !important;
                    overflow: visible !important;
                    position: static !important;
                }
                .print-sheets-wrap {
                    padding: 0 !important;
                    margin: 0 !important;
                }
                .print-page {
                    width: 210mm;
                    height: 297mm;
                    padding: 8mm;
                    margin: 0;
                    box-shadow: none !important;
                    page-break-after: always;
                    break-after: page;
                    display: grid;
                    grid-template-columns: repeat(${QR_SHEET_COLS}, 1fr);
                    grid-template-rows: repeat(${QR_SHEET_ROWS}, 1fr);
                    overflow: hidden;
                    background: #fff;
                }
                .print-page:last-child {
                    page-break-after: auto;
                    break-after: auto;
                }
            }
            @media screen {
                .print-page {
                    width: 210mm;
                    height: 297mm;
                    padding: 8mm;
                    margin: 0 auto 16px;
                    display: grid;
                    grid-template-columns: repeat(${QR_SHEET_COLS}, 1fr);
                    grid-template-rows: repeat(${QR_SHEET_ROWS}, 1fr);
                    overflow: hidden;
                    background: #fff;
                    color: #111;
                    box-shadow: 0 1px 6px rgba(0,0,0,0.15);
                }
            }
            .print-cell {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 1.2mm;
                padding: 1mm;
                min-height: 0;
                min-width: 0;
                overflow: hidden;
            }
            .print-cell img {
                width: 32mm;
                height: 32mm;
                max-width: 100%;
                max-height: 70%;
                object-fit: contain;
                flex-shrink: 0;
            }
            .print-cell .label {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                font-size: 7pt;
                line-height: 1.1;
                text-align: center;
                max-width: 100%;
                max-height: 8mm;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                color: #111;
            }
        `;
    });

    return (
        <div class="flex flex-col min-h-screen font-sans bg-bg text-text">
            <style>{printStyles()}</style>

            <div class="no-print shrink-0">
                <AppHeader title="PRINT QRS" />
            </div>

            <Show when={loading()}>
                <div class="no-print flex-1 flex items-center justify-center">
                    <span class="w-6 h-6 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                </div>
            </Show>

            <Show when={!loading() && error()}>
                <div class="no-print flex-1 flex items-center justify-center px-6">
                    <p class="font-mono text-sm text-red-400">{error()}</p>
                </div>
            </Show>

            <Show when={!loading() && !error() && data()}>
                <div class="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(280px,380px)_1fr] min-h-0">
                    {/* Selection panel */}
                    <div class="no-print flex flex-col border-r border-text/8 min-h-0 max-h-[calc(100vh-5rem)]">
                        <div class="px-5 py-5 border-b border-text/8 flex flex-col gap-4">
                            <div class="flex items-center justify-between gap-3">
                                <div class="flex flex-col gap-0.5 min-w-0">
                                    <span class="font-mono font-bold text-sm tracking-widest uppercase truncate">
                                        {data()!.name}
                                    </span>
                                    <span class="font-mono text-xs text-text/35 tracking-wide">
                                        {selectedItems().length} selected · {pages().length || 0}{' '}
                                        {unitLabel()}{pages().length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    class="shrink-0 px-4 py-2.5 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all disabled:opacity-40"
                                    disabled={selectedItems().length === 0}
                                    onClick={handlePrint}
                                >
                                    Print
                                </button>
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <span class="font-mono text-[10px] tracking-widest uppercase text-text/35">
                                    Paper
                                </span>
                                <div class="flex items-center border border-text/10 rounded-sm overflow-hidden">
                                    <button
                                        type="button"
                                        class="flex-1 px-3 py-2 font-mono text-xs tracking-widest uppercase transition-colors"
                                        classList={{
                                            'bg-accent text-text': paper() === 'a4',
                                            'bg-transparent text-text/35 hover:text-text/60': paper() !== 'a4',
                                        }}
                                        onClick={() => setPaper('a4')}
                                    >
                                        A4 sheet
                                    </button>
                                    <div class="w-px h-4 bg-text/10" />
                                    <button
                                        type="button"
                                        class="flex-1 px-3 py-2 font-mono text-xs tracking-widest uppercase transition-colors"
                                        classList={{
                                            'bg-accent text-text': paper() === 'ql800',
                                            'bg-transparent text-text/35 hover:text-text/60': paper() !== 'ql800',
                                        }}
                                        onClick={() => setPaper('ql800')}
                                    >
                                        QL-800 2.4"
                                    </button>
                                </div>
                            </div>

                            <div class="flex items-center border border-text/10 rounded-sm overflow-hidden">
                                <button
                                    type="button"
                                    class="flex-1 px-3 py-2 font-mono text-xs tracking-widest uppercase transition-colors"
                                    classList={{
                                        'bg-accent text-text': kind() === 'members',
                                        'bg-transparent text-text/35 hover:text-text/60': kind() !== 'members',
                                    }}
                                    onClick={() => { setKind('members'); setQuery(''); }}
                                >
                                    Members ({members().length})
                                </button>
                                <div class="w-px h-4 bg-text/10" />
                                <button
                                    type="button"
                                    class="flex-1 px-3 py-2 font-mono text-xs tracking-widest uppercase transition-colors"
                                    classList={{
                                        'bg-accent text-text': kind() === 'assets',
                                        'bg-transparent text-text/35 hover:text-text/60': kind() !== 'assets',
                                    }}
                                    onClick={() => { setKind('assets'); setQuery(''); }}
                                >
                                    Assets ({assets().length})
                                </button>
                            </div>

                            <input
                                class="w-full bg-surface border border-text/10 rounded-sm px-3 py-2 font-mono text-sm text-text outline-none focus:border-accent"
                                type="search"
                                placeholder={kind() === 'members' ? 'Search members…' : 'Search assets…'}
                                value={query()}
                                onInput={e => setQuery(e.currentTarget.value)}
                            />

                            <div class="flex items-center gap-3 font-mono text-[10px] tracking-widest uppercase text-text/40">
                                <button type="button" class="hover:text-text transition-colors" onClick={selectAllFiltered}>
                                    Select shown
                                </button>
                                <span class="text-text/15">|</span>
                                <button type="button" class="hover:text-text transition-colors" onClick={clearFiltered}>
                                    Clear shown
                                </button>
                                <span class="text-text/15">|</span>
                                <button type="button" class="hover:text-text transition-colors" onClick={clearAll}>
                                    Clear all
                                </button>
                                <span class="ml-auto text-text/30 normal-case tracking-wide">
                                    {selectedInView()}/{filtered().length}
                                </span>
                            </div>
                        </div>

                        <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
                            <Show
                                when={filtered().length > 0}
                                fallback={
                                    <div class="flex-1 flex items-center justify-center py-10">
                                        <span class="font-mono text-xs text-text/25 tracking-widest uppercase">
                                            {catalog().length === 0 ? 'Nothing to print' : 'No matches'}
                                        </span>
                                    </div>
                                }
                            >
                                <For each={filtered()}>
                                    {(item) => (
                                        <button
                                            type="button"
                                            class="flex items-center gap-3 px-3 py-2.5 border border-text/8 rounded-sm text-left hover:border-accent/40 hover:bg-accent/5 transition-all"
                                            classList={{
                                                'border-accent/40 bg-accent/10': !!selected()[item.key],
                                            }}
                                            onClick={() => toggle(item.key)}
                                        >
                                            <CheckboxMark checked={!!selected()[item.key]} />
                                            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                                                <span class="font-mono text-sm text-text truncate">{item.name}</span>
                                                <Show when={item.groupLabel}>
                                                    <span class="font-mono text-[10px] text-text/30 truncate">
                                                        {item.groupLabel}
                                                    </span>
                                                </Show>
                                            </div>
                                        </button>
                                    )}
                                </For>
                            </Show>
                        </div>
                    </div>

                    {/* Preview / print sheets */}
                    <div class="print-root flex flex-col min-h-0 bg-[#e8e8e8] lg:max-h-[calc(100vh-5rem)] overflow-y-auto">
                        <div class="no-print px-5 py-4 border-b border-black/5 flex items-center justify-between sticky top-0 bg-[#e8e8e8]/z-10">
                            <span class="font-mono text-xs tracking-widest text-black/40 uppercase">
                                Print preview · {paperLabel(paper())}
                            </span>
                            <span class="font-mono text-xs text-black/35">
                                {selectedItems().length
                                    ? `${pages().length} ${unitLabel()}${pages().length === 1 ? '' : 's'}`
                                    : 'Select QR codes to preview'}
                            </span>
                        </div>

                        <div class="print-sheets-wrap px-3 py-4 sm:px-6">
                            <Show
                                when={selectedItems().length > 0}
                                fallback={
                                    <div class="no-print flex items-center justify-center py-24">
                                        <span class="font-mono text-xs text-black/30 tracking-widest uppercase">
                                            No QR codes selected
                                        </span>
                                    </div>
                                }
                            >
                                <For each={pages()}>
                                    {(page) => (
                                        <section class="print-page">
                                            <For each={page}>
                                                {(item) => (
                                                    <div class="print-cell">
                                                        <img
                                                            src={qrCodeUrl(item.endpoint, 300)}
                                                            alt={`${item.name} QR`}
                                                            width="300"
                                                            height="300"
                                                        />
                                                        <span class="label">{item.name}</span>
                                                    </div>
                                                )}
                                            </For>
                                        </section>
                                    )}
                                </For>
                            </Show>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default PrintQrPage;
