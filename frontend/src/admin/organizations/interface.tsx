import { backendRequest, getToken } from "@/functional/utils";
import { Component, createSignal } from "solid-js";
import { inputBase, AddMemberFormData, OrganizationInterfaceData, OrganizationMemberData } from "./functional/types";

const MemberModal: Component<{
    member: OrganizationMemberData;
    onClose: () => void;
    onSave: (updated: Pick<OrganizationMemberData, 'contactName' | 'contactNumber' | 'useContact'>) => Promise<void>;
}> = (props) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(props.member.endpoint)}`;

    const [contactName, setContactName] = createSignal(props.member.contactName);
    const [contactNumber, setContactNumber] = createSignal(props.member.contactNumber);
    const [useContact, setUseContact] = createSignal(props.member.useContact);
    const [saving, setSaving] = createSignal(false);
    const [saveError, setSaveError] = createSignal('');
    const [saveSuccess, setSaveSuccess] = createSignal(false);

    const dirty = () =>
        contactName() !== props.member.contactName ||
        contactNumber() !== props.member.contactNumber ||
        useContact() !== props.member.useContact;

    const handleSave = async () => {
        if (!contactName().trim() || !contactNumber().trim()) {
            setSaveError('All fields are required.');
            return;
        }
        setSaving(true);
        setSaveError('');
        setSaveSuccess(false);
        try {
            await props.onSave({
                contactName: contactName().trim(),
                contactNumber: contactNumber().trim(),
                useContact: useContact(),
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
                        {props.member.name}
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
                                alt={`QR code for ${props.member.name}`}
                                width={220}
                                height={220}
                                class="block"
                            />
                        </div>
                        <span class="font-mono text-xs text-text/30 tracking-wide break-all text-center">
                            {props.member.endpoint}
                        </span>
                        <a
                            href={qrUrl}
                            download={`${props.member.name}-qr.png`}
                            class="w-full py-2.5 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 text-center"
                        >
                            Download PNG
                        </a>
                    </div>

                    {/* RIGHT — Edit form */}
                    <div class="flex flex-col gap-4 px-7 py-7">
                        <span class="font-mono text-xs tracking-widest text-text/40 uppercase">Edit Details</span>

                        <div class="flex flex-col gap-1">
                            <label class="font-mono text-xs tracking-widest text-text/30 uppercase">Contact Name</label>
                            <input
                                class={inputBase}
                                value={contactName()}
                                onInput={e => setContactName(e.currentTarget.value)}
                                disabled={saving()}
                            />
                        </div>

                        <div class="flex flex-col gap-1">
                            <label class="font-mono text-xs tracking-widest text-text/30 uppercase">Contact Number</label>
                            <input
                                class={inputBase}
                                value={contactNumber()}
                                onInput={e => setContactNumber(e.currentTarget.value)}
                                disabled={saving()}
                            />
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={useContact()}
                                class="w-4 h-4 rounded-sm border border-text/20 flex items-center justify-center transition-colors shrink-0"
                                classList={{
                                    'bg-accent border-accent': useContact(),
                                    'bg-transparent': !useContact(),
                                }}
                                onClick={() => setUseContact(v => !v)}
                                disabled={saving()}
                            >
                                {useContact() && (
                                    <svg class="w-3 h-3 text-text" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                )}
                            </button>
                            <label
                                class="font-mono text-xs tracking-widest text-text/40 uppercase cursor-pointer select-none"
                                onClick={() => setUseContact(v => !v)}
                            >
                                SMS notifications
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

const MemberCard: Component<{ member: OrganizationMemberData; onClick: () => void }> = (props) => {
    const latestActivity = (): { date: Date; label: 'In' | 'Out' } | null => {
        const { signInTime, signOutTime } = props.member;
        if (!signInTime && !signOutTime) return null;
        if (signInTime && !signOutTime) return { date: new Date(signInTime), label: 'In' };
        if (!signInTime && signOutTime) return { date: new Date(signOutTime), label: 'Out' };
        const i = new Date(signInTime!);
        const o = new Date(signOutTime!);
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
                {props.member.name}
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
                        'bg-accent': props.member.signInTime !== null && props.member.signOutTime === null,
                        'bg-text/20': !(props.member.signInTime !== null && props.member.signOutTime === null),
                    }}
                    title={props.member.signInTime !== null && props.member.signOutTime === null ? 'Online' : 'Offline'}
                />
            </div>
        </div>
    );
};

const AddMemberForm: Component<{ orgId: string; onAdd: (data: AddMemberFormData) => Promise<void> }> = (props) => {
    const [name, setName] = createSignal('');
    const [contactName, setContactName] = createSignal('');
    const [contactNumber, setContactNumber] = createSignal('');
    const [useContact, setUseContact] = createSignal(false);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [success, setSuccess] = createSignal(false);

    const handleSubmit = async () => {
        if (!name().trim() || !contactName().trim() || !contactNumber().trim()) {
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
                contactName: contactName().trim(),
                contactNumber: contactNumber().trim(),
                useContact: useContact(),
            });
            setName('');
            setContactName('');
            setContactNumber('');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2500);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to add member.');
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
                    placeholder="Jane Doe"
                    value={name()}
                    onInput={e => setName(e.currentTarget.value)}
                    disabled={loading()}
                />
            </div>
            <div class="flex flex-col gap-1">
                <label class="font-mono text-xs tracking-widest text-text/40 uppercase">Contact Name</label>
                <input
                    class={inputBase}
                    placeholder="Parent Doe"
                    value={contactName()}
                    onInput={e => setContactName(e.currentTarget.value)}
                    disabled={loading()}
                />
            </div>
            <div class="flex flex-col gap-1">
                <label class="font-mono text-xs tracking-widest text-text/40 uppercase">Contact Number</label>
                <input
                    class={inputBase}
                    placeholder="+1 123 456 7890"
                    value={contactNumber()}
                    onInput={e => setContactNumber(e.currentTarget.value)}
                    disabled={loading()}
                />
            </div>

            <div class="flex items-center gap-3">
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={useContact()}
                    class="w-4 h-4 rounded-sm border border-text/20 flex items-center justify-center transition-colors"
                    classList={{
                        'bg-accent border-accent': useContact(),
                        'bg-transparent': !useContact(),
                    }}
                    onClick={() => setUseContact(v => !v)}
                    disabled={loading()}
                >
                    {useContact() && (
                        <svg class="w-3 h-3 text-text" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    )}
                </button>
                <label
                    class="font-mono text-xs tracking-widest text-text/40 uppercase cursor-pointer select-none"
                    onClick={() => setUseContact(v => !v)}
                >
                    Send SMS notifications
                </label>
            </div>

            {error() && (
                <p class="font-mono text-xs text-red-400/80 tracking-wide">{error()}</p>
            )}
            {success() && (
                <p class="font-mono text-xs text-accent/80 tracking-wide">Member added successfully.</p>
            )}

            <button
                class="mt-1 w-full py-3 bg-accent text-text font-mono text-sm tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                onClick={handleSubmit}
                disabled={loading()}
            >
                {loading()
                    ? <span class="w-4 h-4 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                    : 'Add Member'
                }
            </button>
        </div>
    );
};

export const DashboardBody: Component<{ data: OrganizationInterfaceData }> = (props) => {
    const tok = getToken();
    const [selectedMember, setSelectedMember] = createSignal<OrganizationMemberData | null>(null);

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
        updated: Pick<OrganizationMemberData, 'contactName' | 'contactNumber' | 'useContact'>
    ) => {
        await backendRequest('PATCH', '/api/admin/organization/member/update', tok!, {
            member_id: selectedMember()!.id,
            contact_name: updated.contactName,
            contact_number: updated.contactNumber,
            use_contact: updated.useContact,
        });
        // Optimistically patch the signal so the form reflects the new values on next open
        setSelectedMember(prev => prev ? { ...prev, ...updated } : null);
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

            {/* LEFT — Member list */}
            <div class="flex flex-col py-10 px-4 border-r border-text/8 min-h-0">
                <h1 class="font-mono font-bold text-3xl tracking-[0.12em] text-text mb-8 uppercase">
                    {props.data.name}
                </h1>

                <div class="flex items-center gap-3 mb-4">
                    <span class="font-mono text-xs tracking-widest text-text/40 uppercase">Members</span>
                    <div class="flex-1 h-px bg-text/8" />
                    <span class="font-mono text-xs text-text/30">{props.data.users.length}</span>
                </div>

                <div class="flex-1 overflow-y-auto min-h-0 border border-text/8 rounded-sm p-2 flex flex-col gap-1.5 bg-bg/40">
                    {props.data.users.length === 0
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
                    }
                </div>
            </div>

            {/* RIGHT — Add member */}
            <div class="flex flex-col py-10 px-4 min-h-0">
                <div class="mb-8">
                    <h2 class="font-mono font-bold text-xl tracking-[0.12em] text-text uppercase">Add Member</h2>
                    <p class="font-mono text-xs text-text/40 tracking-wide mt-1">Add another user to the organization</p>
                </div>
                <div class="border border-text/8 rounded-sm p-6 bg-surface">
                    <AddMemberForm orgId={props.data.id} onAdd={handleAddMember} />
                </div>
            </div>
        </div>
    );
};