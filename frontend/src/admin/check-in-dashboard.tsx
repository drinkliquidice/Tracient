import {
    Component,
    For,
    Match,
    Show,
    Switch,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { useNavigate } from '@solidjs/router';

import { backendRequest, getToken } from '@/functional/utils';
import { formatLastFirst, lastNameLetter } from '@/functional/names';
import { isMemberSignedIn } from '@/functional/attendance';
import { formatEasternTime, isEasternToday } from '@/functional/time';
import {
    OrganizationMemberData,
    OrganizationMetaData,
    PaginatedMembersData,
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

const isSignedIn = isMemberSignedIn;

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
    return `${label} · ${formatEasternTime(latest)}`;
};

const MemberRow: Component<{
    member: OrganizationMemberData;
    busyId: string | null;
    onSignIn: () => void;
    onSignOut: () => void;
}> = (props) => {
    const online = () => isSignedIn(props.member);
    const busy = () => props.busyId === props.member.id;
    const signedInToday = () => isEasternToday(props.member.signInTime);
    const signedOutToday = () => isEasternToday(props.member.signOutTime);
    const canSignIn = () => !busy() && !signedInToday();
    const canSignOut = () => !busy() && !signedOutToday();

    return (
        <div class="flex items-center gap-3 px-4 py-3 mx-1 bg-surface border border-text/8 rounded-sm">
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-sm tracking-wide text-text truncate">
                        {formatLastFirst(props.member.name)}
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
                        'text-accent border-accent/40 hover:bg-accent/10': canSignIn(),
                        'text-text/40': !canSignIn(),
                    }}
                    onClick={props.onSignIn}
                    disabled={!canSignIn()}
                    title={signedInToday() ? 'Already signed in today' : undefined}
                >
                    Sign In
                </button>
                <button
                    type="button"
                    class="px-3 py-2 border border-text/10 rounded-sm font-mono text-xs tracking-widest uppercase transition-colors disabled:opacity-40"
                    classList={{
                        'text-text/70 hover:text-text hover:border-text/30': canSignOut(),
                        'text-text/40': !canSignOut(),
                    }}
                    onClick={props.onSignOut}
                    disabled={!canSignOut()}
                    title={signedOutToday() ? 'Already signed out today' : undefined}
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
};

const CheckInBody: Component<{
    meta: OrganizationMetaData;
    initialMembers: OrganizationMemberData[];
}> = (props) => {
    const tok = getToken();
    const [members, setMembers] = createStore<OrganizationMemberData[]>([...props.initialMembers]);
    const [query, setQuery] = createSignal('');
    const [letter, setLetter] = createSignal<string | null>(null);
    const [busyId, setBusyId] = createSignal<string | null>(null);
    const [error, setError] = createSignal('');

    createEffect(() => {
        setMembers(reconcile(props.initialMembers, { key: 'id' }));
    });

    const filteredMembers = createMemo(() => {
        const q = query().trim().toLowerCase();
        const letterFilter = letter();
        return members.filter(m => {
            if (letterFilter && lastNameLetter(m.name) !== letterFilter) return false;
            if (!q) return true;
            const name = m.name ?? '';
            return (
                name.toLowerCase().includes(q) ||
                formatLastFirst(name).toLowerCase().includes(q)
            );
        });
    });

    const availableLetters = createMemo(() => {
        const set = new Set(members.map(m => lastNameLetter(m.name)));
        return LETTERS.filter(l => set.has(l));
    });

    const applyAction = async (memberId: string, action: 'in' | 'out') => {
        if (!tok || busyId()) return;
        const member = members.find(m => m.id === memberId);
        if (!member) return;

        setBusyId(memberId);
        setError('');
        try {
            const result = await backendRequest<SignInResponse>('GET', `/member/${memberId}?action=${action}`, tok);

            const toDate = (value: string | Date | null | undefined): Date | null => {
                if (value == null) return null;
                return value instanceof Date ? value : new Date(value);
            };

            const idx = members.findIndex(m => m.id === memberId);
            if (idx >= 0) {
                setMembers(idx, {
                    signInTime: toDate(result.signInTime ?? (action === 'in' ? result.timestamp : member.signInTime)),
                    signOutTime: toDate(result.signOutTime ?? (action === 'out' ? result.timestamp : member.signOutTime)),
                    lastSignIn: toDate(result.lastSignIn ?? (action === 'in' ? result.timestamp : member.lastSignIn)),
                });
            }
        } catch (e: any) {
            setError(e?.message ?? 'Failed to update check-in.');
        } finally {
            setBusyId(null);
        }
    };

    const requestAction = (member: OrganizationMemberData, action: 'in' | 'out') => {
        setError('');
        if (action === 'in' && isEasternToday(member.signInTime)) {
            setError(`${formatLastFirst(member.name)} already signed in today.`);
            return;
        }
        if (action === 'out' && isEasternToday(member.signOutTime)) {
            setError(`${formatLastFirst(member.name)} already signed out today.`);
            return;
        }
        void applyAction(member.id, action);
    };

    return (
        <div class="flex-1 flex flex-col min-h-0 px-4 py-8 max-w-4xl mx-auto w-full">
            <div class="flex items-center justify-between mb-6 px-1">
                <div>
                    <h1 class="font-mono font-bold text-3xl tracking-[0.12em] text-text uppercase">
                        {props.meta.name}
                    </h1>
                    <p class="font-mono text-xs text-text/40 tracking-wide mt-1">
                        Manual check-in dashboard · once per day
                    </p>
                </div>
                <span class="font-mono text-xs text-text/30">
                    {filteredMembers().length}
                    {(query().trim() || letter()) ? ` / ${members.length}` : ''}
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
                    when={members.length > 0}
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

    const [meta, setMeta] = createSignal<OrganizationMetaData | undefined>();
    const [members, setMembers] = createSignal<OrganizationMemberData[]>([]);
    const [error, setError] = createSignal<{ status?: number } | undefined>();
    const [initialLoading, setInitialLoading] = createSignal(true);
    let inflight = false;

    const load = async (silent = false) => {
        if (!tok || inflight) return;
        if (silent && document.hidden) return;
        inflight = true;
        if (!silent) setInitialLoading(true);
        try {
            const [nextMeta, membersPage] = await Promise.all([
                backendRequest<OrganizationMetaData>('GET', '/api/admin/dashboard', tok),
                backendRequest<PaginatedMembersData>('GET', '/api/admin/members/all', tok),
            ]);
            setMeta(nextMeta);
            setMembers(membersPage.items);
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
                <Match when={initialLoading() && !meta()}>
                    <div class="flex-1 flex items-center justify-center">
                        <span class="w-6 h-6 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                    </div>
                </Match>

                <Match when={error()?.status === 412}>
                    <NoOrganizationView />
                </Match>

                <Match when={!!meta()}>
                    <CheckInBody
                        meta={meta()!}
                        initialMembers={members()}
                    />
                </Match>
            </Switch>
        </div>
    );
};

export default CheckInDashboardPage;
