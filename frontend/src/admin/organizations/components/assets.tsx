import { Component, createEffect, createSignal } from "solid-js";
import {
    inputBase,
    AddAssetFormData,
    OrganizationAssetData,
    OrganizationAssetEditForm
} from "@/admin/organizations/functional/types";
import { openQrImageTab, qrCodeUrl, QR_SIDE_CM } from "@/admin/organizations/functional/qr";

export const AssetModal: Component<{
    asset: OrganizationAssetData;
    onClose: () => void;
    onSave: (updated: Pick<OrganizationAssetEditForm, 'name' | 'assetCode' | 'totalQuantity' | 'currentQuantity' | 'deleteAsset'>) => Promise<void>;
}> = (props) => {
    const qrPayload = () => props.asset.assetCode || props.asset.endpoint;
    const qrUrl = () => qrCodeUrl(qrPayload());

    const [name, setName] = createSignal(props.asset.name);
    const [assetCode, setAssetCode] = createSignal(props.asset.assetCode);
    const [totalQuantity, setTotalQuantity] = createSignal(props.asset.totalQuantity);
    const [currentQuantity, setCurrentQuantity] = createSignal(props.asset.currentQuantity);
    const [deleteAsset, setDeleteAsset] = createSignal(false);
    const [saving, setSaving] = createSignal(false);
    const [saveError, setSaveError] = createSignal('');
    const [saveSuccess, setSaveSuccess] = createSignal(false);

    createEffect((prevId?: string) => {
        const id = props.asset.id;
        if (prevId !== id) {
            setName(props.asset.name);
            setAssetCode(props.asset.assetCode);
            setTotalQuantity(props.asset.totalQuantity);
            setCurrentQuantity(props.asset.currentQuantity);
            setDeleteAsset(false);
            setSaveError('');
            setSaveSuccess(false);
        }
        return id;
    });

    const dirty = () =>
        name() !== props.asset.name ||
        assetCode() !== props.asset.assetCode ||
        totalQuantity() !== props.asset.totalQuantity ||
        currentQuantity() !== props.asset.currentQuantity ||
        deleteAsset() !== false;

    const handleSave = async () => {
        if (!name().trim() || !assetCode().trim() || totalQuantity() <= 0) {
            setSaveError('All fields are required.');
            return;
        }
        if (currentQuantity() < 0 || currentQuantity() > totalQuantity()) {
            setSaveError('Current quantity must be between 0 and total.');
            return;
        }
        setSaving(true);
        setSaveError('');
        setSaveSuccess(false);
        try {
            await props.onSave({
                name: name().trim(),
                assetCode: assetCode().trim(),
                totalQuantity: totalQuantity(),
                currentQuantity: currentQuantity(),
                deleteAsset: deleteAsset(),
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
        } catch (e: any) {
            setSaveError(e?.message ?? 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const handleBackdrop = (e: MouseEvent) => {
        if ((e.target as HTMLElement).dataset.backdrop) props.onClose();
    };

    return (
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            data-backdrop="true"
            onClick={handleBackdrop}
        >
            <div class="flex flex-col gap-0 bg-surface border border-text/10 rounded-sm shadow-2xl w-full max-w-170">

                {/* Header */}
                <div class="flex items-center justify-between px-7 py-5 border-b border-text/8">
                    <span class="font-mono font-bold text-sm tracking-widest text-text uppercase">
                        {props.asset.name}
                    </span>
                    <button
                        class="font-mono text-xs tracking-widest text-text/40 hover:text-text transition-colors uppercase"
                        onClick={props.onClose}
                    >
                        Close
                    </button>
                </div>

                {/* Body — QR left, edit right */}
                <div class="grid grid-cols-2 gap-0">

                    {/* LEFT — QR */}
                    <div class="flex flex-col items-center gap-4 px-7 py-7 border-r border-text/8">
                        <div class="p-3 bg-white rounded-sm">
                            <img
                                src={qrUrl()}
                                alt={`QR code for ${props.asset.name}`}
                                class="block"
                                style={{ width: `${QR_SIDE_CM}cm`, height: `${QR_SIDE_CM}cm` }}
                            />
                        </div>
                        <span class="font-mono text-xs text-text/30 tracking-wide break-all text-center">
                            {qrPayload()}
                        </span>
                        <button
                            type="button"
                            class="w-full py-2.5 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 text-center"
                            onClick={() => openQrImageTab(qrPayload(), props.asset.name)}
                        >
                            Download PNG
                        </button>
                    </div>

                    {/* RIGHT — Edit form */}
                    <div class="flex flex-col gap-4 px-7 py-7">
                        <span class="font-mono text-xs tracking-widest text-text/40 uppercase">Edit Details</span>

                        <div class="flex flex-col gap-1">
                            <label class="font-mono text-xs tracking-widest text-text/30 uppercase">Asset Code</label>
                            <input
                                class={inputBase}
                                value={assetCode()}
                                onInput={e => setAssetCode(e.currentTarget.value)}
                                disabled={saving()}
                            />
                        </div>

                        <div class="flex flex-col gap-1">
                            <label class="font-mono text-xs tracking-widest text-text/30 uppercase">Current Quantity</label>
                            <input
                                class={inputBase}
                                value={currentQuantity()}
                                type="number"
                                min="0"
                                onInput={e => setCurrentQuantity(Number(e.currentTarget.value))}
                                disabled={saving()}
                            />
                        </div>

                        <div class="flex flex-col gap-1">
                            <label class="font-mono text-xs tracking-widest text-text/30 uppercase">Total Quantity</label>
                            <input
                                class={inputBase}
                                value={totalQuantity()}
                                type="number"
                                min="1"
                                onInput={e => setTotalQuantity(Number(e.currentTarget.value))}
                                disabled={saving()}
                            />
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={deleteAsset()}
                                class="w-4 h-4 rounded-sm border border-text/20 flex items-center justify-center transition-colors shrink-0"
                                classList={{
                                    'bg-accent border-accent': deleteAsset(),
                                    'bg-transparent': !deleteAsset(),
                                }}
                                onClick={() => setDeleteAsset(v => !v)}
                                disabled={saving()}
                            >
                                {deleteAsset() && (
                                    <svg class="w-3 h-3 text-text" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                )}
                            </button>
                            <label
                                class="font-mono text-xs tracking-widest text-red-400 uppercase cursor-pointer select-none"
                                onClick={() => setDeleteAsset(v => !v)}
                            >
                                Delete Asset
                            </label>
                        </div>

                        {saveError() && (
                            <p class="font-mono text-xs text-red-400/80 tracking-wide">{saveError()}</p>
                        )}
                        {saveSuccess() && (
                            <p class="font-mono text-xs text-accent/80 tracking-wide">Saved successfully.</p>
                        )}

                        <button
                            class="mt-auto w-full py-2.5 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            onClick={handleSave}
                            disabled={saving() || !dirty()}
                        >
                            {saving()
                                ? <span class="w-3.5 h-3.5 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                                : 'Save Changes'
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AssetCard: Component<{ asset: OrganizationAssetData; onClick: () => void }> = (props) => {
    const latestActivity = (): { date: Date; label: 'In' | 'Out' } | null => {
        const { checkInTime, checkOutTime } = props.asset;
        if (!checkInTime && !checkOutTime) return null;
        if (checkInTime && !checkOutTime) return { date: new Date(checkInTime), label: 'In' };
        if (!checkInTime && checkOutTime) return { date: new Date(checkOutTime), label: 'Out' };
        const i = new Date(checkInTime!);
        const o = new Date(checkOutTime!);
        return i >= o ? { date: i, label: 'In' } : { date: o, label: 'Out' };
    };

    const formatDate = (date: Date) =>
        date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div
            class="flex items-center justify-between px-4 py-3 mx-1 bg-surface border border-text/8 rounded-sm hover:border-accent/40 hover:bg-accent/5 transition-all duration-150 group cursor-pointer"
            onClick={props.onClick}
        >
            <div class="flex flex-col gap-0.5 min-w-0">
                <span class="font-mono text-sm tracking-wide text-text group-hover:text-text transition-colors truncate">
                    {props.asset.name}
                </span>
                <span class="font-mono text-xs text-text/30 tracking-wide truncate">
                    {props.asset.assetCode}
                </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="font-mono text-xs text-text/40 tracking-wide">
                    {props.asset.currentQuantity}/{props.asset.totalQuantity}
                </span>
                {latestActivity()
                    ? (
                        <>
                            <span class="font-mono text-xs text-text/25 tracking-widest uppercase">
                                {latestActivity()!.label}
                            </span>
                            <span class="font-mono text-xs text-text/40 tracking-wide">
                                {formatDate(latestActivity()!.date)}
                            </span>
                        </>
                    )
                    : (
                        <span class="font-mono text-xs text-text/40 tracking-wide">Never</span>
                    )
                }
                <div
                    class="w-1.5 h-1.5 rounded-full"
                    classList={{
                        'bg-accent': props.asset.currentQuantity < props.asset.totalQuantity,
                        'bg-text/20': props.asset.currentQuantity >= props.asset.totalQuantity,
                    }}
                    title={props.asset.currentQuantity < props.asset.totalQuantity ? 'Checked out' : 'All in'}
                />
            </div>
        </div>
    );
};

export const AddAssetForm: Component<{ orgId: string; onAdd: (data: AddAssetFormData) => Promise<void> }> = (props) => {
    const [name, setName] = createSignal('');
    const [assetCode, setAssetCode] = createSignal('');
    const [totalQuantity, setTotalQuantity] = createSignal(1);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [success, setSuccess] = createSignal(false);

    const handleSubmit = async () => {
        if (!name().trim() || !assetCode().trim() || !totalQuantity()) {
            setError('All fields are required.');
            return;
        }
        setLoading(true);
        setError('');
        setSuccess(false);
        try {
            await props.onAdd({
                name: name().trim(),
                orgId: props.orgId,
                assetCode: assetCode().trim(),
                totalQuantity: totalQuantity(),
            });
            setName('');
            setAssetCode('');
            setTotalQuantity(1);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2500);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to add asset.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div class="flex flex-col gap-3 mx-3 py-2">
            <div class="flex flex-col gap-1">
                <label class="font-mono text-xs tracking-widest text-text/40 uppercase">Name</label>
                <input
                    class={inputBase}
                    placeholder="Book"
                    value={name()}
                    onInput={e => setName(e.currentTarget.value)}
                    disabled={loading()}
                />
            </div>
            <div class="flex flex-col gap-1">
                <label class="font-mono text-xs tracking-widest text-text/40 uppercase">Asset Code</label>
                <input
                    class={inputBase}
                    placeholder="BK-001"
                    value={assetCode()}
                    onInput={e => setAssetCode(e.currentTarget.value)}
                    disabled={loading()}
                />
            </div>
            <div class="flex flex-col gap-1">
                <label class="font-mono text-xs tracking-widest text-text/40 uppercase">Total Quantity</label>
                <input
                    class={inputBase}
                    type="number"
                    placeholder="1"
                    value={totalQuantity()}
                    onInput={e => setTotalQuantity(parseInt(e.currentTarget.value) || 1)}
                    disabled={loading()}
                />
            </div>

            {error() && (
                <p class="font-mono text-xs text-red-400/80 tracking-wide">{error()}</p>
            )}
            {success() && (
                <p class="font-mono text-xs text-accent/80 tracking-wide">Asset added successfully.</p>
            )}

            <button
                class="mt-1 w-full py-3 bg-accent text-text font-mono text-sm tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                onClick={handleSubmit}
                disabled={loading()}
            >
                {loading()
                    ? <span class="w-4 h-4 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                    : 'Add Asset'
                }
            </button>
        </div>
    );
};

export const AddAssetsCsvForm: Component<{
    orgId: string;
    onAddCsv: (file: File) => Promise<number>;
}> = (props) => {
    const [csvFile, setCsvFile] = createSignal<File | null>(null);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [success, setSuccess] = createSignal('');
    let fileInputRef: HTMLInputElement | undefined;

    const onFileChange = (e: Event) => {
        const file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
        const lower = file?.name.toLowerCase() ?? '';
        if (file && !(lower.endsWith('.csv') || lower.endsWith('.tsv'))) {
            setError('File must be a .csv or .tsv');
            setCsvFile(null);
            return;
        }
        setError('');
        setSuccess('');
        setCsvFile(file);
    };

    const clearFile = () => {
        setCsvFile(null);
        setError('');
        setSuccess('');
        if (fileInputRef) fileInputRef.value = '';
    };

    const handleSubmit = async () => {
        const file = csvFile();
        if (!file) {
            setError('Assets CSV is required.');
            return;
        }
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const count = await props.onAddCsv(file);
            clearFile();
            setSuccess(`${count} asset${count === 1 ? '' : 's'} added successfully.`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to upload assets CSV.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div class="flex flex-col gap-3 mx-3 py-2">
            <p class="font-mono text-xs text-text/40 tracking-wide leading-relaxed">
                Columns (in order): asset_code, asset_name, total_quantity.
            </p>

            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                class="hidden"
                onChange={onFileChange}
                disabled={loading()}
            />

            {csvFile()
                ? (
                    <div class="flex items-center justify-between gap-3 w-full px-3 py-2.5 border border-text/10 rounded-sm">
                        <span class="font-mono text-sm text-text truncate">{csvFile()!.name}</span>
                        <button
                            type="button"
                            onClick={clearFile}
                            disabled={loading()}
                            class="font-mono text-xs tracking-widest text-text/40 hover:text-text uppercase disabled:opacity-50"
                        >
                            Clear
                        </button>
                    </div>
                )
                : (
                    <button
                        type="button"
                        onClick={() => fileInputRef?.click()}
                        disabled={loading()}
                        class="flex items-center gap-3 w-full px-3 py-2.5 border border-dashed border-text/15 rounded-sm font-mono text-sm text-text/40 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                    >
                        Upload assets CSV
                    </button>
                )
            }

            {error() && (
                <p class="font-mono text-xs text-red-400/80 tracking-wide">{error()}</p>
            )}
            {success() && (
                <p class="font-mono text-xs text-accent/80 tracking-wide">{success()}</p>
            )}

            <button
                class="mt-1 w-full py-3 bg-accent text-text font-mono text-sm tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                onClick={handleSubmit}
                disabled={loading() || !csvFile()}
            >
                {loading()
                    ? <span class="w-4 h-4 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                    : 'Import Assets CSV'
                }
            </button>
        </div>
    );
};
