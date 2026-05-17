import { Component, createSignal } from "solid-js";
import {
    inputBase,
    AddAssetFormData,
    OrganizationAssetData,
    OrganizationAssetEditForm
} from "@/admin/organizations/functional/types";

export const AssetModal: Component<{
    asset: OrganizationAssetData;
    onClose: () => void;
    onSave: (updated: Pick<OrganizationAssetEditForm, 'name' | 'quantity' | 'deleteAsset'>) => Promise<void>;
}> = (props) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(props.asset.endpoint)}`;

    const [name, setName] = createSignal(props.asset.name);
    const [quantity, setQuantity] = createSignal(props.asset.quantity);
    const [deleteAsset, setDeleteAsset] = createSignal(false);
    const [saving, setSaving] = createSignal(false);
    const [saveError, setSaveError] = createSignal('');
    const [saveSuccess, setSaveSuccess] = createSignal(false);

    const dirty = () =>
        name() !== props.asset.name ||
        quantity() !== props.asset.quantity ||
        deleteAsset() !== false;

    const handleSave = async () => {
        if (!name().trim() || quantity() <= 0) {
            setSaveError('All fields are required.');
            return;
        }
        setSaving(true);
        setSaveError('');
        setSaveSuccess(false);
        try {
            await props.onSave({
                name: name().trim(),
                quantity: quantity(),
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
                                src={qrUrl}
                                alt={`QR code for ${props.asset.name}`}
                                width={220}
                                height={220}
                                class="block"
                            />
                        </div>
                        <span class="font-mono text-xs text-text/30 tracking-wide break-all text-center">
                            {props.asset.endpoint}
                        </span>
                        <a
                            href={qrUrl}
                            download={`${props.asset.name}-qr.png`}
                            class="w-full py-2.5 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 text-center"
                        >
                            Download PNG
                        </a>
                    </div>

                    {/* RIGHT — Edit form */}
                    <div class="flex flex-col gap-4 px-7 py-7">
                        <span class="font-mono text-xs tracking-widest text-text/40 uppercase">Edit Details</span>

                        <div class="flex flex-col gap-1">
                            <label class="font-mono text-xs tracking-widest text-text/30 uppercase">Quantity</label>
                            <input
                                class={inputBase}
                                value={quantity()}
                                type="number"
                                onInput={e => setQuantity(Number(e.currentTarget.value))}
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
            class="flex items-center justify-between px-4 py-3 bg-surface border border-text/8 rounded-sm hover:border-accent/40 hover:bg-accent/5 transition-all duration-150 group cursor-pointer"
            onClick={props.onClick}
        >
            <span class="font-mono text-sm tracking-wide text-text group-hover:text-text transition-colors">
                {props.asset.name}
            </span>
            <div class="flex items-center gap-2">
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
                        'bg-accent': props.asset.checkInTime !== null && props.asset.checkOutTime === null,
                        'bg-text/20': !(props.asset.checkInTime !== null && props.asset.checkOutTime === null),
                    }}
                    title={props.asset.checkInTime !== null && props.asset.checkOutTime === null ? 'Online' : 'Offline'}
                />
            </div>
        </div>
    );
};

export const AddAssetForm: Component<{ orgId: string; onAdd: (data: AddAssetFormData) => Promise<void> }> = (props) => {
    const [name, setName] = createSignal('');
    const [quantity, setQuantity] = createSignal(1);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [success, setSuccess] = createSignal(false);

    const handleSubmit = async () => {
        if (!name().trim() || !quantity()) {
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
                quantity: quantity(),
            });
            setName('');
            setQuantity(1);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2500);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to add asset.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div class="flex flex-col gap-3 mx-3">
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
                <label class="font-mono text-xs tracking-widest text-text/40 uppercase">Quantity</label>
                <input
                    class={inputBase}
                    type="number"
                    placeholder="1"
                    value={quantity()}
                    onInput={e => setQuantity(parseInt(e.currentTarget.value) || 1)}
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