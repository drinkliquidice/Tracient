import { backendRequest, getToken } from "@/functional/utils";
import { Component, createSignal } from "solid-js";
import {
    AddAssetFormData,
    AddMemberFormData,
    OrganizationAssetData,
    OrganizationInterfaceData,
    OrganizationMemberData,
    OrganizationMemberEditForm,
    OrganizationAssetEditForm,
} from "./functional/types";
import { MemberCard, MemberModal, AddMemberForm } from "./components/member";
import { AssetCard, AssetModal, AddAssetForm } from "./components/assets";
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

export const DashboardBody: Component<{ data: OrganizationInterfaceData }> = (props) => {
    const navigate = useNavigate();
    const navigateLogin = () => navigate('/login/');
    const tok = getToken(); 

    if (!tok) {
        navigateLogin();
    }

    const [view, setView] = createSignal<'members' | 'assets'>('members');
    const [members, setMembers] = createSignal<OrganizationMemberData[]>(props.data.users);
    const [assets, setAssets] = createSignal<OrganizationAssetData[]>(props.data.assets);

    const [selectedMember, setSelectedMember] = createSignal<OrganizationMemberData | null>(null);
    const [selectedAsset, setSelectedAsset] = createSignal<OrganizationAssetData | null>(null);

    const handleAddMember = async (data: AddMemberFormData) => {
        await backendRequest('POST', '/api/admin/organization/member/add', tok!, {
            org_id: data.orgId,
            name: data.name,
            contact_name: data.contactName,
            contact_number: data.contactNumber,
            use_contact: data.useContact,
        });
    };

    const handleUpdateMember = async (
        updated: Pick<OrganizationMemberEditForm, 'contactName' | 'contactNumber' | 'useContact' | 'delete_user'>
    ) => {
        await backendRequest('PATCH', '/api/admin/organization/member/update', tok!, {
            org_id: props.data.id,
            member_id: selectedMember()!.id,
            contact_name: updated.contactName,
            contact_number: updated.contactNumber,
            use_contact: updated.useContact,
            delete_user: updated.delete_user,
        });

        if (updated.delete_user) {
            setMembers(prev => prev.filter(m => m.id !== selectedMember()!.id));
            setSelectedMember(null);
        } else {
            setMembers(prev => prev.map(m =>
                m.id === selectedMember()!.id
                    ? { ...m, contactName: updated.contactName, contactNumber: updated.contactNumber, useContact: updated.useContact }
                    : m
            ));
            setSelectedMember(prev => prev ? { ...prev, contactName: updated.contactName, contactNumber: updated.contactNumber, useContact: updated.useContact } : null);
        }
    };

    const handleAddAsset = async (data: AddAssetFormData) => {
        await backendRequest('POST', '/api/admin/organization/asset/add', tok!, {
            org_id: data.orgId,
            name: data.name,
            quantity: data.quantity,
        });
    };

    const handleUpdateAsset = async (
        updated: Pick<OrganizationAssetEditForm, 'name' | 'quantity' | 'deleteAsset'>
    ) => {
        await backendRequest('PATCH', '/api/admin/organization/asset/update', tok!, {
            org_id: props.data.id,
            asset_id: selectedAsset()!.id,
            name: updated.name,
            quantity: updated.quantity,
            delete_asset: updated.deleteAsset,
        });

        if (updated.deleteAsset) {
            setAssets(prev => prev.filter(a => a.id !== selectedAsset()!.id));
            setSelectedAsset(null);
        } else {
            setAssets(prev => prev.map(a =>
                a.id === selectedAsset()!.id
                    ? { ...a, name: updated.name, quantity: updated.quantity }
                    : a
            ));
            setSelectedAsset(prev => prev ? { ...prev, name: updated.name, quantity: updated.quantity } : null);
        }
    };

    return (
        <div class="flex-1 grid grid-cols-2 gap-0 min-h-0 mx-4">
            {selectedMember() && (
                <MemberModal
                    member={selectedMember()!}
                    onClose={() => setSelectedMember(null)}
                    onSave={handleUpdateMember}
                />
            )}
            {selectedAsset() && (
                <AssetModal
                    asset={selectedAsset()!}
                    onClose={() => setSelectedAsset(null)}
                    onSave={handleUpdateAsset}
                />
            )}

            {/* LEFT — toggled list */}
            <div class="flex flex-col py-10 px-4 border-r border-text/8 min-h-0">

                {/* Org name + toggle */}
                <div class="flex items-center justify-between mb-8 py-2 mx-2">
                    <h1 class="font-mono font-bold text-3xl tracking-[0.12em] text-text uppercase">
                        {props.data.name}
                    </h1>
                    <ViewToggle view={view()} onChange={setView} />
                </div>

                {/* Count row */}
                <div class="flex items-center gap-3 mb-4">
                    <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                        {view() === 'members' ? 'Members' : 'Assets'}
                    </span>
                    <div class="flex-1 h-px bg-text/8" />
                    <span class="font-mono text-xs text-text/30">
                        {view() === 'members' ? props.data.users.length : props.data.assets.length}
                    </span>
                </div>

                {/* List */}
                <div class="flex-1 overflow-y-auto min-h-0 border border-text/8 rounded-sm p-2 flex flex-col gap-1.5 bg-bg/40">
                    {view() === 'members'
                        ? props.data.users.length === 0
                            ? (
                                <div class="flex-1 flex items-center justify-center">
                                    <span class="font-mono text-xs text-text/25 tracking-widest uppercase">No members yet</span>
                                </div>
                            )
                            : props.data.users.map(member => (
                                <MemberCard
                                    member={member}
                                    onClick={() => setSelectedMember(member)}
                                />
                            ))
                        : props.data.assets.length === 0
                            ? (
                                <div class="flex-1 flex items-center justify-center">
                                    <span class="font-mono text-xs text-text/25 tracking-widest uppercase">No assets yet</span>
                                </div>
                            )
                            : props.data.assets.map(asset => (
                                <AssetCard
                                    asset={asset}
                                    onClick={() => setSelectedAsset(asset)}
                                />
                            ))
                    }
                </div>
            </div>

            {/* RIGHT — Add forms */}
            <div class="flex flex-col py-10 px-4 min-h-0 overflow-y-auto">

                {/* Add Member */}
                <div class="flex flex-col">
                    <div class="mb-8">
                        <h2 class="font-mono font-bold text-xl tracking-[0.12em] text-text uppercase">Add Member</h2>
                        <p class="font-mono text-xs text-text/40 tracking-wide mt-1">Add another user to the organization</p>
                    </div>
                    <div class="border border-text/8 rounded-sm p-6 bg-surface">
                        <AddMemberForm orgId={props.data.id} onAdd={handleAddMember} />
                    </div>
                </div>

                {/* Divider */}
                <div class="h-px bg-text/8 mx-4 my-20" />

                {/* Add Asset */}
                <div class="flex flex-col">
                    <div class="mb-8">
                        <h2 class="font-mono font-bold text-xl tracking-[0.12em] text-text uppercase">Add Asset</h2>
                        <p class="font-mono text-xs text-text/40 tracking-wide mt-1">Register a new asset for the organization</p>
                    </div>
                    <div class="border border-text/8 rounded-sm p-6 bg-surface">
                        <AddAssetForm orgId={props.data.id} onAdd={handleAddAsset} />
                    </div>
                </div>

            </div>
        </div>
    );
};