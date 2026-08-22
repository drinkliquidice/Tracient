import { Component, createEffect, createSignal, For, Show } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import {
    AddMemberFormData,
    emptyContact,
    inputBase,
    MemberContactData,
    OrganizationMemberData,
    OrganizationMemberEditForm
} from "@/admin/organizations/functional/types";
import { cleanedContacts, ContactCarousel, contactsAreComplete } from "./contacts";

const CheckRow: Component<{
    checked: boolean;
    label: string;
    disabled?: boolean;
    danger?: boolean;
    onToggle: () => void;
}> = (props) => (
    <div class="flex items-center gap-3">
        <button
            type="button"
            role="checkbox"
            aria-checked={props.checked}
            class="w-4 h-4 rounded-sm border border-text/20 flex items-center justify-center transition-colors shrink-0"
            classList={{
                'bg-accent border-accent': props.checked,
                'bg-transparent': !props.checked,
            }}
            onClick={props.onToggle}
            disabled={props.disabled}
        >
            {props.checked && (
                <svg class="w-3 h-3 text-text" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            )}
        </button>
        <label
            class="font-mono text-xs tracking-widest uppercase cursor-pointer select-none"
            classList={{
                'text-red-400': props.danger,
                'text-text/40': !props.danger,
            }}
            onClick={props.onToggle}
        >
            {props.label}
        </label>
    </div>
);

export const MemberModal: Component<{
    member: OrganizationMemberData;
    onClose: () => void;
    onSave: (updated: Pick<OrganizationMemberEditForm, 'contacts' | 'useSms' | 'useEmail' | 'delete_user'>) => Promise<void>;
}> = (props) => {
    const qrUrl = () =>
        `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(props.member.endpoint)}`;

    const seedContacts = (member: OrganizationMemberData): MemberContactData[] =>
        member.contacts.length ? member.contacts.map(c => ({ ...c })) : [emptyContact()];

    const [contacts, setContacts] = createStore<MemberContactData[]>(seedContacts(props.member));
    const [useSms, setUseSms] = createSignal(props.member.useSms);
    const [useEmail, setUseEmail] = createSignal(props.member.useEmail);
    const [deleteUser, setDeleteUser] = createSignal(false);
    const [saving, setSaving] = createSignal(false);
    const [saveError, setSaveError] = createSignal('');
    const [saveSuccess, setSaveSuccess] = createSignal(false);

    createEffect((prevId?: string) => {
        const id = props.member.id;
        if (prevId !== id) {
            setContacts(reconcile(seedContacts(props.member)));
            setUseSms(props.member.useSms);
            setUseEmail(props.member.useEmail);
            setDeleteUser(false);
            setSaveError('');
            setSaveSuccess(false);
        }
        return id;
    });

    const dirty = () =>
        JSON.stringify(unwrap(contacts)) !== JSON.stringify(props.member.contacts) ||
        useSms() !== props.member.useSms ||
        useEmail() !== props.member.useEmail ||
        deleteUser() !== false;

    const handleSave = async () => {
        const cleaned = cleanedContacts(unwrap(contacts));

        if (!contactsAreComplete(cleaned)) {
            setSaveError('Each contact needs a name, email, and number.');
            return;
        }
        if (useSms() && cleaned.every(c => !c.contactNumber)) {
            setSaveError('Add a phone number to send SMS notifications.');
            return;
        }
        if (useEmail() && cleaned.every(c => !c.email)) {
            setSaveError('Add an email to send email notifications.');
            return;
        }

        setSaving(true);
        setSaveError('');
        setSaveSuccess(false);
        try {
            await props.onSave({
                contacts: cleaned,
                useSms: useSms(),
                useEmail: useEmail(),
                delete_user: deleteUser(),
            });
            if (!deleteUser()) {
                setContacts(reconcile(cleaned.length ? cleaned : [emptyContact()]));
            }
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
            <div class="flex flex-col gap-0 bg-surface border border-text/10 rounded-sm shadow-2xl w-full max-w-240">

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

                <div class="grid grid-cols-3 gap-0">

                    <div class="flex flex-col items-center gap-4 px-7 py-7 border-r border-text/8">
                        <div class="p-3 bg-white rounded-sm">
                            <img
                                src={qrUrl()}
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
                            href={qrUrl()}
                            download={`${props.member.name}-qr.png`}
                            class="w-full py-2.5 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 text-center"
                        >
                            Download PNG
                        </a>
                    </div>

                    <div class="flex flex-col gap-3 px-7 py-7 border-r border-text/8">
                        <div class="flex items-center justify-between">
                            <span class="font-mono text-xs tracking-widest text-text/40 uppercase">Checked Out</span>
                            <span class="font-mono text-xs text-text/25">
                                {props.member.assets.length}
                            </span>
                        </div>

                        <div class="flex-1 overflow-y-auto min-h-0 max-h-72 flex flex-col gap-1.5 px-1 py-1">
                            <Show
                                when={props.member.assets.length > 0}
                                fallback={
                                    <div class="flex flex-1 items-center justify-center py-10">
                                        <span class="font-mono text-xs text-text/20 tracking-widest uppercase">
                                            No assets
                                        </span>
                                    </div>
                                }
                            >
                                <For each={props.member.assets}>
                                    {(assetName) => (
                                        <div class="flex items-center gap-3 px-3 py-2.5 border border-text/8 rounded-sm bg-bg/40">
                                            <div class="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                            <span class="font-mono text-xs text-text tracking-wide truncate">
                                                {assetName}
                                            </span>
                                        </div>
                                    )}
                                </For>
                            </Show>
                        </div>
                    </div>

                    <div class="flex flex-col gap-4 px-7 py-7 min-w-0">
                        <ContactCarousel
                            contacts={contacts}
                            setContacts={setContacts}
                            disabled={saving()}
                        />

                        <CheckRow
                            checked={useSms()}
                            label="SMS notifications"
                            disabled={saving()}
                            onToggle={() => setUseSms(v => !v)}
                        />
                        <CheckRow
                            checked={useEmail()}
                            label="Email notifications"
                            disabled={saving()}
                            onToggle={() => setUseEmail(v => !v)}
                        />
                        <CheckRow
                            checked={deleteUser()}
                            label="Delete User"
                            danger
                            disabled={saving()}
                            onToggle={() => setDeleteUser(v => !v)}
                        />

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

export const MemberCard: Component<{ member: OrganizationMemberData; onClick: () => void }> = (props) => {
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

    const isOnline = () => {
        const { signInTime, signOutTime } = props.member;
        if (!signInTime) return false;
        if (!signOutTime) return true;
        return new Date(signInTime) > new Date(signOutTime);
    };

    return (
        <div
            class="flex items-center justify-between px-4 py-3 mx-1 bg-surface border border-text/8 rounded-sm hover:border-accent/40 hover:bg-accent/5 transition-all duration-150 group cursor-pointer"
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
                        'bg-accent': isOnline(),
                        'bg-text/20': !isOnline(),
                    }}
                    title={isOnline() ? 'Online' : 'Offline'}
                />
            </div>
        </div>
    );
};

export const AddMemberForm: Component<{ orgId: string; onAdd: (data: AddMemberFormData) => Promise<void> }> = (props) => {
    const [name, setName] = createSignal('');
    const [contacts, setContacts] = createStore<MemberContactData[]>([emptyContact()]);
    const [useSms, setUseSms] = createSignal(false);
    const [useEmail, setUseEmail] = createSignal(false);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [success, setSuccess] = createSignal(false);

    const handleSubmit = async () => {
        const cleaned = cleanedContacts(unwrap(contacts));
        if (!name().trim()) {
            setError('Member name is required.');
            return;
        }
        if (!contactsAreComplete(cleaned)) {
            setError('Each contact needs a name, email, and number.');
            return;
        }
        if (useSms() && cleaned.every(c => !c.contactNumber)) {
            setError('Add a phone number to send SMS notifications.');
            return;
        }
        if (useEmail() && cleaned.every(c => !c.email)) {
            setError('Add an email to send email notifications.');
            return;
        }
        setLoading(true);
        setError('');
        setSuccess(false);
        try {
            await props.onAdd({
                name: name().trim(),
                orgId: props.orgId,
                contacts: cleaned,
                useSms: useSms(),
                useEmail: useEmail(),
            });
            setName('');
            setContacts(reconcile([emptyContact()]));
            setUseSms(false);
            setUseEmail(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2500);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to add member.');
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
                    placeholder="Jane Doe"
                    value={name()}
                    onInput={e => setName(e.currentTarget.value)}
                    disabled={loading()}
                />
            </div>

            <ContactCarousel
                contacts={contacts}
                setContacts={setContacts}
                disabled={loading()}
            />

            <CheckRow
                checked={useSms()}
                label="SMS notifications"
                disabled={loading()}
                onToggle={() => setUseSms(v => !v)}
            />
            <CheckRow
                checked={useEmail()}
                label="Email notifications"
                disabled={loading()}
                onToggle={() => setUseEmail(v => !v)}
            />

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
