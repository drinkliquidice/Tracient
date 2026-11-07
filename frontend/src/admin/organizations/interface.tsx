import { backendRequest, getToken } from "@/functional/utils";
import { compareByLastName } from "@/functional/names";
import { compareByAssetCode } from "@/functional/assetCodes";
import { Component, createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
    AddAssetFormData,
    AddMemberFormData,
    MemberContactData,
    OrganizationAssetData,
    OrganizationMemberData,
    OrganizationMemberEditForm,
    OrganizationAssetEditForm,
    OrganizationMetaData,
    PaginatedAssetsData,
    PaginatedMembersData,
} from "./functional/types";
import { MemberCard, MemberModal, AddMemberForm } from "./components/member";
import { AssetCard, AssetModal, AddAssetForm, AddAssetsCsvForm } from "./components/assets";
import { useNavigate } from "@solidjs/router";

const PAGE_SIZE = 50;

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

const isInCenter = (member: OrganizationMemberData): boolean => {
    const { signInTime, signOutTime } = member;
    if (!signInTime) return false;
    if (!signOutTime) return true;
    return new Date(signInTime) > new Date(signOutTime);
};

const includesQuery = (value: string | null | undefined, q: string): boolean =>
    (value ?? '').toLowerCase().includes(q);

const memberMatchesQuery = (member: OrganizationMemberData, q: string): boolean => {
    if (!q) return true;
    if (includesQuery(member.name, q)) return true;
    return (member.contacts ?? []).some(c =>
        includesQuery(c.name, q) ||
        includesQuery(c.email, q) ||
        includesQuery(c.contactNumber, q)
    );
};

const Pagination: Component<{
    page: number;
    total: number;
    limit: number;
    onChange: (page: number) => void;
}> = (props) => {
    const totalPages = () => Math.max(1, Math.ceil(props.total / Math.max(props.limit, 1)));
    return (
        <Show when={props.total > props.limit && props.limit > 0}>
            <div class="flex items-center justify-between mt-3 mx-1">
                <button
                    type="button"
                    class="px-3 py-1.5 border border-text/10 rounded-sm font-mono text-xs tracking-widest uppercase text-text/50 hover:text-text disabled:opacity-30"
                    disabled={props.page <= 1}
                    onClick={() => props.onChange(props.page - 1)}
                >
                    Prev
                </button>
                <span class="font-mono text-xs text-text/30">
                    Page {props.page} / {totalPages()}
                </span>
                <button
                    type="button"
                    class="px-3 py-1.5 border border-text/10 rounded-sm font-mono text-xs tracking-widest uppercase text-text/50 hover:text-text disabled:opacity-30"
                    disabled={props.page >= totalPages()}
                    onClick={() => props.onChange(props.page + 1)}
                >
                    Next
                </button>
            </div>
        </Show>
    );
};

export const DashboardBody: Component<{
    meta: OrganizationMetaData;
}> = (props) => {
    const navigate = useNavigate();
    const navigateLogin = () => navigate('/login/');
    const tok = getToken();

    if (!tok) {
        navigateLogin();
    }

    const [orgId] = createSignal(props.meta.id);
    const [orgName] = createSignal(props.meta.name);
    const [view, setView] = createSignal<'members' | 'assets'>('members');

    const [memberQuery, setMemberQuery] = createSignal('');
    const [inCenterOnly, setInCenterOnly] = createSignal(false);
    const [memberPage, setMemberPage] = createSignal(1);
    const [allMembers, setAllMembers] = createSignal<OrganizationMemberData[]>([]);
    const [membersLoading, setMembersLoading] = createSignal(false);
    const [membersLoaded, setMembersLoaded] = createSignal(false);

    const [assetQuery, setAssetQuery] = createSignal('');
    const [assetPage, setAssetPage] = createSignal(1);
    const [allAssets, setAllAssets] = createSignal<OrganizationAssetData[]>([]);
    const [assetsLoading, setAssetsLoading] = createSignal(false);
    const [assetsLoaded, setAssetsLoaded] = createSignal(false);

    const [selectedMemberId, setSelectedMemberId] = createSignal<string | null>(null);
    const [selectedMember, setSelectedMember] = createSignal<OrganizationMemberData | null>(null);
    const [selectedAssetId, setSelectedAssetId] = createSignal<string | null>(null);
    const [selectedAsset, setSelectedAsset] = createSignal<OrganizationAssetData | null>(null);
    const [detailLoading, setDetailLoading] = createSignal(false);

    const loadMembers = async () => {
        if (!tok) return;
        setMembersLoading(true);
        try {
            const data = await backendRequest<PaginatedMembersData>(
                'GET',
                '/api/admin/members/all',
                tok,
            );
            setAllMembers(data.items);
            setMembersLoaded(true);
        } catch (e: any) {
            if (e?.status === 401) navigateLogin();
        } finally {
            setMembersLoading(false);
        }
    };

    const loadAssets = async () => {
        if (!tok) return;
        setAssetsLoading(true);
        try {
            const data = await backendRequest<PaginatedAssetsData>(
                'GET',
                '/api/admin/assets?limit=0',
                tok,
            );
            setAllAssets(data.items);
            setAssetsLoaded(true);
        } catch (e: any) {
            if (e?.status === 401) navigateLogin();
        } finally {
            setAssetsLoading(false);
        }
    };

    createEffect(() => {
        if (view() === 'members' && !membersLoaded() && !membersLoading()) {
            void loadMembers();
        }
        if (view() === 'assets' && !assetsLoaded() && !assetsLoading()) {
            void loadAssets();
        }
    });

    createEffect(() => {
        memberQuery();
        inCenterOnly();
        setMemberPage(1);
    });

    createEffect(() => {
        assetQuery();
        setAssetPage(1);
    });

    const filteredMembers = createMemo(() => {
        const q = memberQuery().trim().toLowerCase();
        const onlyInCenter = inCenterOnly();
        return [...allMembers()]
            .sort(compareByLastName)
            .filter(m => {
                if (onlyInCenter && !isInCenter(m)) return false;
                return memberMatchesQuery(m, q);
            });
    });

    const inCenterCount = createMemo(() => allMembers().filter(isInCenter).length);

    const pagedMembers = createMemo(() => {
        const start = (memberPage() - 1) * PAGE_SIZE;
        return filteredMembers().slice(start, start + PAGE_SIZE);
    });

    const filteredAssets = createMemo(() => {
        const q = assetQuery().trim().toLowerCase();
        return [...allAssets()]
            .sort(compareByAssetCode)
            .filter(a =>
                !q ||
                a.name.toLowerCase().includes(q) ||
                a.assetCode.toLowerCase().includes(q)
            );
    });

    const pagedAssets = createMemo(() => {
        const start = (assetPage() - 1) * PAGE_SIZE;
        return filteredAssets().slice(start, start + PAGE_SIZE);
    });

    createEffect(() => {
        const memberId = selectedMemberId();
        if (!memberId || !tok) {
            setSelectedMember(null);
            return;
        }
        let cancelled = false;
        setDetailLoading(true);
        void backendRequest<OrganizationMemberData>('GET', `/api/admin/members/${memberId}`, tok)
            .then((detail) => {
                if (!cancelled) setSelectedMember(detail);
            })
            .catch((e: any) => {
                if (e?.status === 401) navigateLogin();
                if (!cancelled) {
                    setSelectedMemberId(null);
                    setSelectedMember(null);
                }
            })
            .finally(() => {
                if (!cancelled) setDetailLoading(false);
            });
        return () => { cancelled = true; };
    });

    createEffect(() => {
        const assetId = selectedAssetId();
        if (!assetId || !tok) {
            setSelectedAsset(null);
            return;
        }
        let cancelled = false;
        setDetailLoading(true);
        void backendRequest<OrganizationAssetData>('GET', `/api/admin/assets/${assetId}`, tok)
            .then((detail) => {
                if (!cancelled) setSelectedAsset(detail);
            })
            .catch((e: any) => {
                if (e?.status === 401) navigateLogin();
                if (!cancelled) {
                    setSelectedAssetId(null);
                    setSelectedAsset(null);
                }
            })
            .finally(() => {
                if (!cancelled) setDetailLoading(false);
            });
        return () => { cancelled = true; };
    });

    const handleAddMember = async (data: AddMemberFormData) => {
        const created = await backendRequest<OrganizationMemberData>('POST', '/api/admin/organization/member/add', tok!, {
            org_id: data.orgId,
            name: data.name,
            contacts: contactsPayload(data.contacts),
            use_sms: data.contacts.some(c => c.useSms),
            use_email: data.contacts.some(c => c.useEmail),
        });
        setAllMembers(prev => [{ ...created, assets: [] }, ...prev]);
    };

    const handleUpdateMember = async (
        updated: Pick<OrganizationMemberEditForm, 'contacts' | 'delete_user'>
    ) => {
        const memberId = selectedMemberId();
        if (!memberId) return;

        const saved = await backendRequest<OrganizationMemberData | null>('PATCH', '/api/admin/organization/member/update', tok!, {
            org_id: orgId(),
            member_id: memberId,
            contacts: contactsPayload(updated.contacts),
            use_sms: updated.contacts.some(c => c.useSms),
            use_email: updated.contacts.some(c => c.useEmail),
            delete_user: updated.delete_user,
        });

        if (updated.delete_user) {
            setAllMembers(prev => prev.filter(m => m.id !== memberId));
            setSelectedMemberId(null);
            setSelectedMember(null);
        } else if (saved) {
            const lean = { ...saved, assets: [] as string[] };
            setAllMembers(prev => prev.map(m => m.id === memberId ? lean : m));
            setSelectedMember(saved);
        }
    };

    const handleAddAsset = async (data: AddAssetFormData) => {
        const created = await backendRequest<OrganizationAssetData>('POST', '/api/admin/organization/asset/add', tok!, {
            org_id: data.orgId,
            name: data.name,
            asset_code: data.assetCode,
            total_quantity: data.totalQuantity,
        });
        setAllAssets(prev => [{ ...created, copies: [] }, ...prev]);
    };

    const handleAddAssetsCsv = async (file: File): Promise<number> => {
        const formData = new FormData();
        formData.append('org_id', orgId());
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

        const created = (data as OrganizationAssetData[]).map(a => ({ ...a, copies: [] }));
        setAllAssets(prev => [...created, ...prev]);
        return created.length;
    };

    const handleUpdateAsset = async (
        updated: Pick<OrganizationAssetEditForm, 'name' | 'assetCode' | 'totalQuantity' | 'deleteAsset'>
    ) => {
        const assetId = selectedAssetId();
        if (!assetId) return;

        const saved = await backendRequest<OrganizationAssetData | null>('PATCH', '/api/admin/organization/asset/update', tok!, {
            org_id: orgId(),
            asset_id: assetId,
            name: updated.name,
            asset_code: updated.assetCode,
            total_quantity: updated.totalQuantity,
            delete_asset: updated.deleteAsset,
        });

        if (updated.deleteAsset) {
            setAllAssets(prev => prev.filter(a => a.id !== assetId));
            setSelectedAssetId(null);
            setSelectedAsset(null);
        } else if (saved) {
            const lean = { ...saved, copies: [] };
            setAllAssets(prev => prev.map(a => a.id === assetId ? lean : a));
            setSelectedAsset(saved);
        }
    };

    const handleCheckInCopy = async (copyId: string) => {
        const assetId = selectedAssetId();
        if (!assetId || !tok) return;

        await backendRequest('POST', '/api/admin/assets/circulate', tok, {
            asset_id: copyId,
            time: new Date().toISOString(),
            check_out: false,
        });

        const detail = await backendRequest<OrganizationAssetData>(
            'GET',
            `/api/admin/assets/${assetId}`,
            tok,
        );
        setSelectedAsset(detail);
        const lean = { ...detail, copies: [] };
        setAllAssets(prev => prev.map(a => a.id === assetId ? lean : a));
    };

    return (
        <div class="flex-1 grid grid-cols-2 gap-0 min-h-0 mx-4">
            <Show when={selectedMemberId() && selectedMember()}>
                <MemberModal
                    member={selectedMember()!}
                    onClose={() => { setSelectedMemberId(null); setSelectedMember(null); }}
                    onSave={handleUpdateMember}
                />
            </Show>
            <Show when={selectedAssetId() && selectedAsset()}>
                <AssetModal
                    asset={selectedAsset()!}
                    onClose={() => { setSelectedAssetId(null); setSelectedAsset(null); }}
                    onSave={handleUpdateAsset}
                    onCheckInCopy={handleCheckInCopy}
                />
            </Show>

            <div class="flex flex-col py-10 px-4 border-r border-text/8 min-h-0">

                <div class="flex items-center justify-between mb-8 py-2 mx-2">
                    <h1 class="font-mono font-bold text-3xl tracking-[0.12em] text-text uppercase">
                        {orgName()}
                    </h1>
                    <ViewToggle view={view()} onChange={setView} />
                </div>

                <div class="flex items-center gap-3 mb-3">
                    <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                        {view() === 'members' ? 'Members' : 'Assets'}
                    </span>
                    <div class="flex-1 h-px bg-text/8" />
                    <span class="font-mono text-xs text-text/30">
                        {view() === 'members'
                            ? `${filteredMembers().length}${allMembers().length ? ` / ${allMembers().length}` : ''}`
                            : `${filteredAssets().length}${allAssets().length ? ` / ${allAssets().length}` : ''}`}
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
                            class="shrink-0 px-3 py-2 border rounded-sm font-mono text-xs tracking-widest uppercase transition-colors"
                            classList={{
                                'bg-accent border-accent text-text': inCenterOnly(),
                                'border-text/10 text-text/50 hover:text-text hover:border-accent/40': !inCenterOnly(),
                            }}
                            onClick={() => setInCenterOnly(v => !v)}
                            title="Show only students currently in the center"
                        >
                            In center{inCenterCount() > 0 ? ` · ${inCenterCount()}` : ''}
                        </button>
                        <button
                            type="button"
                            class="shrink-0 px-3 py-2 border border-text/10 rounded-sm font-mono text-xs tracking-widest uppercase text-text/50 hover:text-text hover:border-accent/40 disabled:opacity-40"
                            onClick={() => navigate('/admin/print-qr')}
                            disabled={allMembers().length === 0}
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
                                when={!membersLoading()}
                                fallback={
                                    <div class="flex-1 flex items-center justify-center">
                                        <span class="w-5 h-5 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                                    </div>
                                }
                            >
                                <Show
                                    when={pagedMembers().length > 0}
                                    fallback={
                                        <div class="flex-1 flex items-center justify-center">
                                            <span class="font-mono text-xs text-text/25 tracking-widest uppercase">
                                                {memberQuery().trim() || inCenterOnly() ? 'No matches' : 'No members yet'}
                                            </span>
                                        </div>
                                    }
                                >
                                    <For each={pagedMembers()}>
                                        {(member) => (
                                            <MemberCard
                                                member={member}
                                                onClick={() => setSelectedMemberId(member.id)}
                                            />
                                        )}
                                    </For>
                                    <Show when={detailLoading() && selectedMemberId() && !selectedMember()}>
                                        <div class="flex items-center justify-center py-4">
                                            <span class="w-4 h-4 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                                        </div>
                                    </Show>
                                </Show>
                            </Show>
                        )
                        : (
                            <Show
                                when={!assetsLoading()}
                                fallback={
                                    <div class="flex-1 flex items-center justify-center">
                                        <span class="w-5 h-5 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                                    </div>
                                }
                            >
                                <Show
                                    when={pagedAssets().length > 0}
                                    fallback={
                                        <div class="flex-1 flex items-center justify-center">
                                            <span class="font-mono text-xs text-text/25 tracking-widest uppercase">
                                                {assetQuery().trim() ? 'No matches' : 'No assets yet'}
                                            </span>
                                        </div>
                                    }
                                >
                                    <For each={pagedAssets()}>
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

                <Show when={view() === 'members'}>
                    <Pagination
                        page={memberPage()}
                        total={filteredMembers().length}
                        limit={PAGE_SIZE}
                        onChange={setMemberPage}
                    />
                </Show>
                <Show when={view() === 'assets'}>
                    <Pagination
                        page={assetPage()}
                        total={filteredAssets().length}
                        limit={PAGE_SIZE}
                        onChange={setAssetPage}
                    />
                </Show>
            </div>

            <div class="flex flex-col py-10 px-4 min-h-0 overflow-y-auto">

                <div class="flex flex-col">
                    <div class="mb-8">
                        <h2 class="font-mono font-bold text-xl tracking-[0.12em] text-text uppercase">Add Member</h2>
                        <p class="font-mono text-xs text-text/40 tracking-wide mt-1">Add another user to the organization</p>
                    </div>
                    <div class="border border-text/8 rounded-sm p-6 bg-surface">
                        <AddMemberForm orgId={orgId()} onAdd={handleAddMember} />
                    </div>
                </div>

                <div class="h-px bg-text/8 mx-4 my-20" />

                <div class="flex flex-col">
                    <div class="mb-8">
                        <h2 class="font-mono font-bold text-xl tracking-[0.12em] text-text uppercase">Add Asset</h2>
                        <p class="font-mono text-xs text-text/40 tracking-wide mt-1">Register a new asset for the organization</p>
                    </div>
                    <div class="border border-text/8 rounded-sm p-6 bg-surface">
                        <AddAssetForm orgId={orgId()} onAdd={handleAddAsset} />
                    </div>
                </div>

                <div class="h-px bg-text/8 mx-4 my-10" />

                <div class="flex flex-col">
                    <div class="mb-8">
                        <h2 class="font-mono font-bold text-xl tracking-[0.12em] text-text uppercase">Import Assets CSV</h2>
                        <p class="font-mono text-xs text-text/40 tracking-wide mt-1">Bulk-add assets after the organization is created</p>
                    </div>
                    <div class="border border-text/8 rounded-sm p-6 bg-surface">
                        <AddAssetsCsvForm orgId={orgId()} onAddCsv={handleAddAssetsCsv} />
                    </div>
                </div>

            </div>
        </div>
    );
};
