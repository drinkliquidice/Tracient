import { backendRequest, getToken } from "@/functional/utils";
import { Component, createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { on } from "solid-js";
import {
    AddAssetFormData,
    AddMemberFormData,
    MemberContactData,
    OrganizationAssetData,
    OrganizationInterfaceData,
    OrganizationMemberData,
    OrganizationMemberEditForm,
    OrganizationAssetEditForm,
} from "./functional/types";
import { MemberCard, MemberModal, AddMemberForm } from "./components/member";
import { AssetCard, AssetModal, AddAssetForm, AddAssetsCsvForm } from "./components/assets";
import { openMemberQrSheet } from "./functional/qr";
import { useNavigate } from "@solidjs/router";

const ViewToggle: Component<{
    view: 'members' | 'assets';
    onChange: (v: 'members' | 'assets') => void;
}> = (props) => (
    <div class="flex items-center border border-text/10 rounded-sm overflow-hidden shrink-0">
        <button
            class="px-3 py-1.5 font-mono text-xs tracking-widest uppercase transition-colors duration-150"
            classList={{
                'bg-accent text-text': props.view === 'members',
                'bg-transparent text-text/35 hover:text-text/60': props.view !== 'members',
            }}
            onClick={() => props.onChange('members')}
        >
            Members
        </button>
        <div class="w-px h-4 bg-text/10" />
        <button
            class="px-3 py-1.5 font-mono text-xs tracking-widest uppercase transition-colors duration-150"
            classList={{
                'bg-accent text-text': props.view === 'assets',
                'bg-transparent text-text/35 hover:text-text/60': props.view !== 'assets',
            }}
            onClick={() => props.onChange('assets')}
        >
            Assets
        </button>
    </div>
);

const contactsPayload = (contacts: MemberContactData[]) =>
    contacts.map(c => ({
        name: c.name,
        email: c.email,
        contactNumber: c.contactNumber,
        useSms: c.useSms,
        useEmail: c.useEmail,
    }));

export const DashboardBody: Component<{
    data: () => OrganizationInterfaceData;
    refetch: () => void;
}> = (props) => {
    const navigate = useNavigate();
    const navigateLogin = () => navigate('/login/');
    const tok = getToken();

    if (!tok) {
        navigateLogin();
    }

    const [org, setOrg] = createStore<OrganizationInterfaceData>(
        JSON.parse(JSON.stringify(props.data()))
    );
    const [view, setView] = createSignal<'members' | 'assets'>('members');
    const [memberQuery, setMemberQuery] = createSignal('');
    const [assetQuery, setAssetQuery] = createSignal('');
    const [selectedMemberId, setSelectedMemberId] = createSignal<string | null>(null);
    const [selectedAssetId, setSelectedAssetId] = createSignal<string | null>(null);

    createEffect(on(
        () => JSON.stringify(props.data()),
        (serialized) => {
            setOrg(reconcile(JSON.parse(serialized), { key: "id" }));
        },
        { defer: true }
    ));

    createEffect(() => {
        const memberId = selectedMemberId();
        if (memberId && !org.users.some(m => m.id === memberId)) {
            setSelectedMemberId(null);
        }
        const assetId = selectedAssetId();
        if (assetId && !org.assets.some(a => a.id === assetId)) {
            setSelectedAssetId(null);
        }
    });

    const selectedMember = () =>
        org.users.find(m => m.id === selectedMemberId()) ?? null;
    const selectedAsset = () =>
        org.assets.find(a => a.id === selectedAssetId()) ?? null;

    const byName = (a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

    const filteredMembers = createMemo(() => {
        const q = memberQuery().trim().toLowerCase();
        const users = [...org.users].sort(byName);
        if (!q) return users;
        return users.filter(m => {
            if (m.name.toLowerCase().includes(q)) return true;
            return m.contacts.some(c =>
                c.name.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                c.contactNumber.toLowerCase().includes(q)
            );
        });
    });

    const sortedAssets = createMemo(() => {
        const q = assetQuery().trim().toLowerCase();
        const assets = [...org.assets].sort(byName);
        if (!q) return assets;
        return assets.filter(a => a.name.toLowerCase().includes(q));
    });

    const handleAddMember = async (data: AddMemberFormData) => {
        const created = await backendRequest<OrganizationMemberData>('POST', '/api/admin/organization/member/add', tok!, {
            org_id: data.orgId,
            name: data.name,
            contacts: contactsPayload(data.contacts),
            use_sms: data.contacts.some(c => c.useSms),
            use_email: data.contacts.some(c => c.useEmail),
        });
        setOrg("users", users => [...users, created]);
        props.refetch();
    };

    const handleUpdateMember = async (
        updated: Pick<OrganizationMemberEditForm, 'contacts' | 'delete_user'>
    ) => {
        const memberId = selectedMemberId();
        if (!memberId) return;

        const saved = await backendRequest<OrganizationMemberData | null>('PATCH', '/api/admin/organization/member/update', tok!, {
            org_id: org.id,
            member_id: memberId,
            contacts: contactsPayload(updated.contacts),
            use_sms: updated.contacts.some(c => c.useSms),
            use_email: updated.contacts.some(c => c.useEmail),
            delete_user: updated.delete_user,
        });

        if (updated.delete_user) {
            setOrg("users", users => users.filter(m => m.id !== memberId));
            setSelectedMemberId(null);
        } else if (saved) {
            const idx = org.users.findIndex(m => m.id === memberId);
            if (idx >= 0) setOrg("users", idx, reconcile(saved));
        }
        props.refetch();
    };

    const handleAddAsset = async (data: AddAssetFormData) => {
        const created = await backendRequest<OrganizationAssetData>('POST', '/api/admin/organization/asset/add', tok!, {
            org_id: data.orgId,
            name: data.name,
            total_quantity: data.totalQuantity,
        });
        setOrg("assets", assets => [...assets, created]);
        props.refetch();
    };

    const handleAddAssetsCsv = async (file: File): Promise<number> => {
        const formData = new FormData();
        formData.append('org_id', org.id);
        formData.append('assets_csv', file);

        const baseUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5173';
        const res = await fetch(`${baseUrl}/api/admin/organization/asset/add-csv`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tok!}` },
            body: formData,
        });

        const text = await res.text();
        let data: OrganizationAssetData[] | { detail?: string };
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(text || res.statusText);
        }
        if (!res.ok) {
            const detail = (data as { detail?: string })?.detail;
            throw new Error(detail || res.statusText);
        }

        const created = data as OrganizationAssetData[];
        setOrg("assets", assets => [...assets, ...created]);
        props.refetch();
        return created.length;
    };

    const handleUpdateAsset = async (
        updated: Pick<OrganizationAssetEditForm, 'name' | 'totalQuantity' | 'currentQuantity' | 'deleteAsset'>
    ) => {
        const assetId = selectedAssetId();
        if (!assetId) return;

        const saved = await backendRequest<OrganizationAssetData | null>('PATCH', '/api/admin/organization/asset/update', tok!, {
            org_id: org.id,
            asset_id: assetId,
            name: updated.name,
            total_quantity: updated.totalQuantity,
            current_quantity: updated.currentQuantity,
            delete_asset: updated.deleteAsset,
        });

        if (updated.deleteAsset) {
            setOrg("assets", assets => assets.filter(a => a.id !== assetId));
            setSelectedAssetId(null);
        } else if (saved) {
            const idx = org.assets.findIndex(a => a.id === assetId);
            if (idx >= 0) setOrg("assets", idx, reconcile(saved));
        }
        props.refetch();
    };

    const handlePrintMemberQrs = () => {
        openMemberQrSheet(
            filteredMembers().map(m => ({ name: m.name, endpoint: m.endpoint }))
        );
    };

    return (
        <div class="flex-1 grid grid-cols-2 gap-0 min-h-0 mx-4">
            <Show when={selectedMemberId() && selectedMember()}>
                <MemberModal
                    member={selectedMember()!}
                    onClose={() => setSelectedMemberId(null)}
                    onSave={handleUpdateMember}
                />
            </Show>
            <Show when={selectedAssetId() && selectedAsset()}>
                <AssetModal
                    asset={selectedAsset()!}
                    onClose={() => setSelectedAssetId(null)}
                    onSave={handleUpdateAsset}
                />
            </Show>

            <div class="flex flex-col py-10 px-4 border-r border-text/8 min-h-0">

                <div class="flex items-center justify-between mb-8 py-2 mx-2">
                    <h1 class="font-mono font-bold text-3xl tracking-[0.12em] text-text uppercase">
                        {org.name}
                    </h1>
                    <ViewToggle view={view()} onChange={setView} />
                </div>

                <div class="flex items-center gap-3 mb-3">
                    <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                        {view() === 'members' ? 'Members' : 'Assets'}
                    </span>
                    <div class="flex-1 h-px bg-text/8" />
                    <span class="font-mono text-xs text-text/30">
                        {view() === 'members' ? filteredMembers().length : sortedAssets().length}
                        {view() === 'members' && memberQuery().trim()
                            ? ` / ${org.users.length}`
                            : view() === 'assets' && assetQuery().trim()
                                ? ` / ${org.assets.length}`
                                : ''}
                    </span>
                </div>

                <Show when={view() === 'members'}>
                    <div class="flex items-center gap-2 mb-3 mx-1">
                        <input
                            class="flex-1 min-w-0 bg-surface border border-text/10 rounded-sm px-3 py-2 font-mono text-sm text-text outline-none focus:border-accent"
                            type="search"
                            placeholder="Search students…"
                            value={memberQuery()}
                            onInput={e => setMemberQuery(e.currentTarget.value)}
                        />
                        <button
                            type="button"
                            class="shrink-0 px-3 py-2 border border-text/10 rounded-sm font-mono text-xs tracking-widest uppercase text-text/50 hover:text-text hover:border-accent/40 disabled:opacity-40"
                            onClick={handlePrintMemberQrs}
                            disabled={filteredMembers().length === 0}
                        >
                            Print QRs
                        </button>
                    </div>
                </Show>

                <Show when={view() === 'assets'}>
                    <div class="flex items-center gap-2 mb-3 mx-1">
                        <input
                            class="flex-1 min-w-0 bg-surface border border-text/10 rounded-sm px-3 py-2 font-mono text-sm text-text outline-none focus:border-accent"
                            type="search"
                            placeholder="Search assets…"
                            value={assetQuery()}
                            onInput={e => setAssetQuery(e.currentTarget.value)}
                        />
                    </div>
                </Show>

                <div class="flex-1 overflow-y-auto min-h-0 border border-text/8 rounded-sm p-2 flex flex-col gap-1.5 bg-bg/40">
                    {view() === 'members'
                        ? (
                            <Show
                                when={org.users.length > 0}
                                fallback={
                                    <div class="flex-1 flex items-center justify-center">
                                        <span class="font-mono text-xs text-text/25 tracking-widest uppercase">No members yet</span>
                                    </div>
                                }
                            >
                                <Show
                                    when={filteredMembers().length > 0}
                                    fallback={
                                        <div class="flex-1 flex items-center justify-center">
                                            <span class="font-mono text-xs text-text/25 tracking-widest uppercase">No matches</span>
                                        </div>
                                    }
                                >
                                    <For each={filteredMembers()}>
                                        {(member) => (
                                            <MemberCard
                                                member={member}
                                                onClick={() => setSelectedMemberId(member.id)}
                                            />
                                        )}
                                    </For>
                                </Show>
                            </Show>
                        )
                        : (
                            <Show
                                when={org.assets.length > 0}
                                fallback={
                                    <div class="flex-1 flex items-center justify-center">
                                        <span class="font-mono text-xs text-text/25 tracking-widest uppercase">No assets yet</span>
                                    </div>
                                }
                            >
                                <Show
                                    when={sortedAssets().length > 0}
                                    fallback={
                                        <div class="flex-1 flex items-center justify-center">
                                            <span class="font-mono text-xs text-text/25 tracking-widest uppercase">No matches</span>
                                        </div>
                                    }
                                >
                                    <For each={sortedAssets()}>
                                        {(asset) => (
                                            <AssetCard
                                                asset={asset}
                                                onClick={() => setSelectedAssetId(asset.id)}
                                            />
                                        )}
                                    </For>
                                </Show>
                            </Show>
                        )
                    }
                </div>
            </div>

            <div class="flex flex-col py-10 px-4 min-h-0 overflow-y-auto">

                <div class="flex flex-col">
                    <div class="mb-8">
                        <h2 class="font-mono font-bold text-xl tracking-[0.12em] text-text uppercase">Add Member</h2>
                        <p class="font-mono text-xs text-text/40 tracking-wide mt-1">Add another user to the organization</p>
                    </div>
                    <div class="border border-text/8 rounded-sm p-6 bg-surface">
                        <AddMemberForm orgId={org.id} onAdd={handleAddMember} />
                    </div>
                </div>

                <div class="h-px bg-text/8 mx-4 my-20" />

                <div class="flex flex-col">
                    <div class="mb-8">
                        <h2 class="font-mono font-bold text-xl tracking-[0.12em] text-text uppercase">Add Asset</h2>
                        <p class="font-mono text-xs text-text/40 tracking-wide mt-1">Register a new asset for the organization</p>
                    </div>
                    <div class="border border-text/8 rounded-sm p-6 bg-surface">
                        <AddAssetForm orgId={org.id} onAdd={handleAddAsset} />
                    </div>
                </div>

                <div class="h-px bg-text/8 mx-4 my-10" />

                <div class="flex flex-col">
                    <div class="mb-8">
                        <h2 class="font-mono font-bold text-xl tracking-[0.12em] text-text uppercase">Import Assets CSV</h2>
                        <p class="font-mono text-xs text-text/40 tracking-wide mt-1">Bulk-add assets after the organization is created</p>
                    </div>
                    <div class="border border-text/8 rounded-sm p-6 bg-surface">
                        <AddAssetsCsvForm orgId={org.id} onAddCsv={handleAddAssetsCsv} />
                    </div>
                </div>

            </div>
        </div>
    );
};
