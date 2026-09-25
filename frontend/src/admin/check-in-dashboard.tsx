import {
    Component,
    For,
    Match,
    Show,
    Switch,
    createEffect,
    createMemo,
    createSignal,
    on,
    onCleanup,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { useNavigate } from '@solidjs/router';

import { backendRequest, getToken } from '@/functional/utils';
import {
    OrganizationInterfaceData,
    OrganizationMemberData,
    SignInResponse,
} from '@/admin/organizations/functional/types';
import { AppHeader } from '@/components/AppHeader';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const NoOrganizationView: Component = () => (
    <div class="flex-1 flex flex-col items-center justify-center gap-3">
        <h2 class="text-2xl font-bold">No organization found</h2>
        <p class="font-mono text-sm text-text/60">Please create an organization first.</p>
        <a href="/admin/organization/create" class="px-6 py-4 bg-accent text-text rounded hover:bg-accent/90 transition-colors">
            Create Organization
        </a>
    </div>
);

const lastNameLetter = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return '#';
    if (trimmed.includes(',')) {
        const last = trimmed.split(',')[0].trim();
        return (last.charAt(0) || '#').toUpperCase();
    }
    const parts = trimmed.split(/\s+/);
    const last = parts[parts.length - 1] || '';
    const letter = last.charAt(0).toUpperCase();
    return /[A-Z]/.test(letter) ? letter : '#';
};

const isSignedIn = (member: OrganizationMemberData): boolean => {
    const { signInTime, signOutTime } = member;
    if (!signInTime) return false;
    if (!signOutTime) return true;
    return new Date(signInTime) > new Date(signOutTime);
};

const formatActivity = (member: OrganizationMemberData): string => {
    const { signInTime, signOutTime } = member;
    if (!signInTime && !signOutTime) return 'Never';
    const inDate = signInTime ? new Date(signInTime) : null;
    const outDate = signOutTime ? new Date(signOutTime) : null;
    let latest: Date;
    let label: string;
    if (inDate && (!outDate || inDate >= outDate)) {
        latest = inDate;
        label = 'In';
    } else if (outDate) {
        latest = outDate;
        label = 'Out';
    } else {
        return 'Never';
    }
    return `${label} · ${latest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

type PendingAction = {
    memberId: string;
    memberName: string;
    action: 'in' | 'out';
};

const ConfirmModal: Component<{
    pending: PendingAction;
    busy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}> = (props) => {
    const handleBackdrop = (e: MouseEvent) => {
        if ((e.target as HTMLElement).dataset.backdrop && !props.busy) props.onCancel();
    };

    const alreadyLabel = () =>
        props.pending.action === 'in' ? 'already signed in' : 'already signed out';

    const actionLabel = () =>
        props.pending.action === 'in' ? 'sign in again' : 'sign out again';

    return (
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            data-backdrop="true"
            onClick={handleBackdrop}
        >
            <div class="bg-surface border border-text/10 rounded-sm shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">
                <div class="flex flex-col gap-2">
                    <span class="font-mono font-bold text-sm tracking-widest text-text uppercase">
                        Confirm duplicate
                    </span>
                    <p class="font-mono text-sm text-text/60 leading-relaxed">
                        <span class="text-text">{props.pending.memberName}</span>
                        {' '}is {alreadyLabel()}. Confirm that you want to {actionLabel()}?
                    </p>
                </div>
                <div class="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        class="px-4 py-2.5 font-mono text-xs tracking-widest uppercase text-text/50 hover:text-text transition-colors disabled:opacity-40"
                        onClick={props.onCancel}
                        disabled={props.busy}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="px-4 py-2.5 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-28"
                        onClick={props.onConfirm}
                        disabled={props.busy}
                    >
                        {props.busy
                            ? <span class="w-3.5 h-3.5 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                            : 'Confirm'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

const MemberRow: Component<{
    member: OrganizationMemberData;
    busyId: string | null;
    onSignIn: () => void;
    onSignOut: () => void;
}> = (props) => {
    const online = () => isSignedIn(props.member);
    const busy = () => props.busyId === props.member.id;

    return (
        <div class="flex items-center gap-3 px-4 py-3 mx-1 bg-surface border border-text/8 rounded-sm">
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-sm tracking-wide text-text truncate">
                        {props.member.name}
                    </span>
                    <div
                        class="w-1.5 h-1.5 rounded-full shrink-0"
                        classList={{
                            'bg-accent': online(),
                            'bg-text/20': !online(),
                        }}
                        title={online() ? 'Signed in' : 'Signed out'}
                    />
                </div>
                <span class="font-mono text-xs text-text/35 tracking-wide">
                    {formatActivity(props.member)}
                </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    class="px-3 py-2 border border-text/10 rounded-sm font-mono text-xs tracking-widest uppercase transition-colors disabled:opacity-40"
                    classList={{
                        'text-accent border-accent/40 hover:bg-accent/10': !busy(),
                        'text-text/40': busy(),
                    }}
                    onClick={props.onSignIn}
                    disabled={busy()}
                >
                    Sign In
                </button>
                <button
                    type="button"
                    class="px-3 py-2 border border-text/10 rounded-sm font-mono text-xs tracking-widest uppercase transition-colors disabled:opacity-40"
                    classList={{
                        'text-text/70 hover:text-text hover:border-text/30': !busy(),
                        'text-text/40': busy(),
                    }}
                    onClick={props.onSignOut}
                    disabled={busy()}
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
};

const CheckInBody: Component<{
    data: () => OrganizationInterfaceData;
    refetch: () => void;
}> = (props) => {
    const tok = getToken();
    const [org, setOrg] = createStore<OrganizationInterfaceData>(
        JSON.parse(JSON.stringify(props.data()))
    );
    const [query, setQuery] = createSignal('');
    const [letter, setLetter] = createSignal<string | null>(null);
    const [busyId, setBusyId] = createSignal<string | null>(null);
    const [pending, setPending] = createSignal<PendingAction | null>(null);
    const [error, setError] = createSignal('');

    createEffect(on(
        () => JSON.stringify(props.data()),
        (serialized) => {
            setOrg(reconcile(JSON.parse(serialized), { key: 'id' }));
        },
        { defer: true }
    ));

    const byName = (a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

    const filteredMembers = createMemo(() => {
        const q = query().trim().toLowerCase();
        const letterFilter = letter();
        return [...org.users]
            .sort(byName)
            .filter(m => {
                if (letterFilter && lastNameLetter(m.name) !== letterFilter) return false;
                if (!q) return true;
                if (m.name.toLowerCase().includes(q)) return true;
                return m.contacts.some(c =>
                    c.name.toLowerCase().includes(q) ||
                    c.email.toLowerCase().includes(q) ||
                    c.contactNumber.toLowerCase().includes(q)
                );
            });
    });

    const availableLetters = createMemo(() => {
        const set = new Set(org.users.map(m => lastNameLetter(m.name)));
        return LETTERS.filter(l => set.has(l));
    });

    const applyAction = async (memberId: string, action: 'in' | 'out') => {
        if (!tok || busyId()) return;
        const member = org.users.find(m => m.id === memberId);
        if (!member) return;

        setBusyId(memberId);
        setError('');
        try {
            const result = await backendRequest<SignInResponse>('GET', `/member/${memberId}?action=${action}`, tok);

            const toDate = (value: string | Date | null | undefined): Date | null => {
                if (value == null) return null;
                return value instanceof Date ? value : new Date(value);
            };

            const idx = org.users.findIndex(m => m.id === memberId);
            if (idx >= 0) {
                setOrg('users', idx, {
                    signInTime: toDate(result.signInTime ?? (action === 'in' ? result.timestamp : member.signInTime)),
                    signOutTime: toDate(result.signOutTime ?? (action === 'out' ? result.timestamp : member.signOutTime)),
                    lastSignIn: toDate(result.lastSignIn ?? (action === 'in' ? result.timestamp : member.lastSignIn)),
                });
            }
            setPending(null);
            props.refetch();
        } catch (e: any) {
            setError(e?.message ?? 'Failed to update check-in.');
        } finally {
            setBusyId(null);
        }
    };

    const requestAction = (member: OrganizationMemberData, action: 'in' | 'out') => {
        setError('');
        const online = isSignedIn(member);
        const duplicate = (action === 'in' && online) || (action === 'out' && !online);
        if (duplicate) {
            setPending({ memberId: member.id, memberName: member.name, action });
            return;
        }
        void applyAction(member.id, action);
    };

    return (
        <div class="flex-1 flex flex-col min-h-0 px-4 py-8 max-w-4xl mx-auto w-full">
            <Show when={pending()}>
                <ConfirmModal
                    pending={pending()!}
                    busy={busyId() === pending()!.memberId}
                    onConfirm={() => void applyAction(pending()!.memberId, pending()!.action)}
                    onCancel={() => { if (!busyId()) setPending(null); }}
                />
            </Show>

            <div class="flex items-center justify-between mb-6 px-1">
                <div>
                    <h1 class="font-mono font-bold text-3xl tracking-[0.12em] text-text uppercase">
                        {org.name}
                    </h1>
                    <p class="font-mono text-xs text-text/40 tracking-wide mt-1">
                        Manual check-in dashboard
                    </p>
                </div>
                <span class="font-mono text-xs text-text/30">
                    {filteredMembers().length}
                    {(query().trim() || letter()) ? ` / ${org.users.length}` : ''}
                </span>
            </div>

            <div class="flex flex-col gap-3 mb-4 px-1">
                <input
                    class="w-full bg-surface border border-text/10 rounded-sm px-3 py-2.5 font-mono text-sm text-text outline-none focus:border-accent"
                    type="search"
                    placeholder="Search members…"
                    value={query()}
                    onInput={e => setQuery(e.currentTarget.value)}
                />

                <div class="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        class="px-2.5 py-1.5 font-mono text-xs tracking-widest uppercase border rounded-sm transition-colors"
                        classList={{
                            'bg-accent border-accent text-text': letter() === null,
                            'border-text/10 text-text/40 hover:text-text/70': letter() !== null,
                        }}
                        onClick={() => setLetter(null)}
                    >
                        All
                    </button>
                    <For each={LETTERS}>
                        {(l) => {
                            const enabled = () => availableLetters().includes(l);
                            return (
                                <button
                                    type="button"
                                    class="w-8 h-8 font-mono text-xs tracking-widest uppercase border rounded-sm transition-colors"
                                    classList={{
                                        'bg-accent border-accent text-text': letter() === l,
                                        'border-text/10 text-text/70 hover:border-accent/40': letter() !== l && enabled(),
                                        'border-text/5 text-text/15 cursor-not-allowed': !enabled(),
                                    }}
                                    disabled={!enabled()}
                                    onClick={() => setLetter(prev => prev === l ? null : l)}
                                >
                                    {l}
                                </button>
                            );
                        }}
                    </For>
                </div>
            </div>

            <Show when={error()}>
                <p class="font-mono text-xs text-red-400/80 tracking-wide mb-3 px-1">{error()}</p>
            </Show>

            <div class="flex-1 overflow-y-auto min-h-0 border border-text/8 rounded-sm p-2 flex flex-col gap-1.5 bg-bg/40">
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
                                <MemberRow
                                    member={member}
                                    busyId={busyId()}
                                    onSignIn={() => requestAction(member, 'in')}
                                    onSignOut={() => requestAction(member, 'out')}
                                />
                            )}
                        </For>
                    </Show>
                </Show>
            </div>
        </div>
    );
};

const CheckInDashboardPage: Component = () => {
    const navigate = useNavigate();
    const navigateLogin = () => navigate('/login/');
    const tok = getToken();

    if (!tok) {
        navigateLogin();
    }

    const [pageData, setPageData] = createSignal<OrganizationInterfaceData | undefined>();
    const [error, setError] = createSignal<{ status?: number } | undefined>();
    const [initialLoading, setInitialLoading] = createSignal(true);
    let inflight = false;

    const load = async (silent = false) => {
        if (!tok || inflight) return;
        if (silent && document.hidden) return;
        inflight = true;
        if (!silent) setInitialLoading(true);
        try {
            const next = await backendRequest<OrganizationInterfaceData>('GET', '/api/admin/dashboard', tok);
            setPageData(next);
            setError(undefined);
        } catch (e: any) {
            setError(e);
            if (e?.status === 401) navigateLogin();
        } finally {
            inflight = false;
            setInitialLoading(false);
        }
    };

    void load(false);
    const timer = setInterval(() => { void load(true); }, 1800000);
    onCleanup(() => clearInterval(timer));

    createEffect(() => {
        if (error()?.status === 401) {
            navigateLogin();
        }
    });

    return (
        <div class="flex flex-col h-screen font-sans bg-bg text-text overflow-hidden">
            <AppHeader title="CHECK-IN" />
            <Switch>
                <Match when={initialLoading() && !pageData()}>
                    <div class="flex-1 flex items-center justify-center">
                        <span class="w-6 h-6 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                    </div>
                </Match>

                <Match when={error()?.status === 412}>
                    <NoOrganizationView />
                </Match>

                <Match when={!!pageData()}>
                    <CheckInBody
                        data={() => pageData()!}
                        refetch={() => { void load(true); }}
                    />
                </Match>
            </Switch>
        </div>
    );
};

export default CheckInDashboardPage;
