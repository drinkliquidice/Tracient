import { backendRequest, getToken } from "@/functional/utils";
import { Component, createSignal } from "solid-js";
import { inputBase, AddMemberFormData, OrganizationInterfaceData, OrganizationMemberData } from "./functional/types";

const QRModal: Component<{ member: OrganizationMemberData; onClose: () => void }> = (props) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(props.member.endpoint)}`;

    // Close on backdrop click
    const handleBackdrop = (e: MouseEvent) => {
        if ((e.target as HTMLElement).dataset.backdrop) props.onClose();
    };

    return (
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            data-backdrop="true"
            onClick={handleBackdrop}
        >
            <div class="flex flex-col items-center gap-5 bg-surface border border-text/10 rounded-sm p-8 shadow-2xl min-w-[320px]">
                {/* Header */}
                <div class="flex w-full items-center justify-between">
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

                <div class="h-px w-full bg-text/8" />

                <div class="p-3 bg-white rounded-sm">
                    <img
                        src={qrUrl}
                        alt={`QR code for ${props.member.name}`}
                        width={280}
                        height={280}
                        class="block"
                    />
                </div>

                {/* Endpoint label */}
                <span class="font-mono text-xs text-text/30 tracking-wide break-all text-center max-w-70">
                    {props.member.endpoint}
                </span>

                {/* Download button */}
                <a
                    href={qrUrl}
                    download={`${props.member.name}-qr.png`}
                    class="w-full py-3 bg-accent text-text font-mono text-sm tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 text-center"
                >
                    Download PNG
                </a>
            </div>
        </div>
    );
};

const MemberCard: Component<{ member: OrganizationMemberData; onClick: () => void }> = (props) => {
    const formatDate = (date: Date | null) => {
        if (!date) return 'Never';
        const d = new Date(date);
        return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div
            class="flex items-center justify-between px-4 py-3 bg-surface border border-text/8 rounded-sm hover:border-accent/40 hover:bg-accent/5 transition-all duration-150 group cursor-pointer"
            onClick={props.onClick}
        >
            <span class="font-mono text-sm tracking-wide text-text group-hover:text-text transition-colors">
                {props.member.name}
            </span>
            <div class="flex items-center gap-2">
                <span class="font-mono text-xs text-text/40 tracking-wide">
                    {formatDate(props.member.lastSignIn)}
                </span>
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
        });
    };

    return (
        <div class="flex-1 grid grid-cols-2 gap-0 min-h-0 mx-4">
            {/* QR Modal — rendered at this level so it overlays everything */}
            {selectedMember() && (
                <QRModal
                    member={selectedMember()!}
                    onClose={() => setSelectedMember(null)}
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