import { Component, For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { A, useLocation, useNavigate } from '@solidjs/router';
import { logout } from '@/functional/utils';

export type NavLink = {
    label: string;
    href: string;
};

const ADMIN_LINKS: NavLink[] = [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Check-In', href: '/admin/check-in-dashboard' },
    { label: 'QR Sign-In', href: '/admin/signin' },
    { label: 'Circulation', href: '/admin/circulation' },
    { label: 'Create Organization', href: '/admin/organization/create' },
];

export const NavMenu: Component<{
    links?: NavLink[];
    /** Accent-bar styling (white/light icons) vs dark page surface */
    tone?: 'accent' | 'surface';
}> = (props) => {
    const location = useLocation();
    const [open, setOpen] = createSignal(false);
    let rootRef: HTMLDivElement | undefined;

    const links = () => props.links ?? ADMIN_LINKS;

    const tone = () => props.tone ?? 'accent';

    const close = () => setOpen(false);

    const onDocClick = (e: MouseEvent) => {
        if (!open()) return;
        if (rootRef && !rootRef.contains(e.target as Node)) close();
    };

    const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') close();
    };

    onMount(() => {
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
    });
    onCleanup(() => {
        document.removeEventListener('mousedown', onDocClick);
        document.removeEventListener('keydown', onKey);
    });

    return (
        <div class="relative z-20" ref={rootRef}>
            <button
                type="button"
                class="flex items-center gap-2 font-mono text-sm tracking-[0.2em] uppercase transition-colors"
                classList={{
                    'text-text/80 hover:text-text': tone() === 'accent',
                    'text-text/70 hover:text-text': tone() === 'surface',
                }}
                aria-haspopup="menu"
                aria-expanded={open()}
                onClick={() => setOpen(v => !v)}
            >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                </svg>
                <span class="hidden sm:inline">Menu</span>
            </button>

            <Show when={open()}>
                <div
                    role="menu"
                    class="absolute left-0 top-full mt-3 min-w-56 bg-surface border border-text/10 rounded-sm shadow-2xl py-1.5 overflow-hidden"
                >
                    <For each={links()}>
                        {(link) => {
                            const active = () =>
                                location.pathname === link.href ||
                                location.pathname.startsWith(link.href + '/');
                            return (
                                <A
                                    href={link.href}
                                    role="menuitem"
                                    class="block px-4 py-2.5 font-mono text-xs tracking-widest uppercase transition-colors"
                                    classList={{
                                        'bg-accent/20 text-text': active(),
                                        'text-text/55 hover:bg-accent/10 hover:text-text': !active(),
                                    }}
                                    onClick={close}
                                >
                                    {link.label}
                                </A>
                            );
                        }}
                    </For>
                </div>
            </Show>
        </div>
    );
};

export const AppHeader: Component<{
    title: string;
    showAuth?: boolean;
}> = (props) => {
    const navigate = useNavigate();
    const showAuth = () => props.showAuth !== false;

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <div class="w-full h-20 bg-accent overflow-hidden flex items-center justify-between relative px-2 shrink-0">
            <div
                class="absolute inset-0 grid grid-cols-[repeat(32,1fr)] p-3 gap-3 opacity-[0.18] pointer-events-none"
                aria-hidden="true"
            >
                {Array.from({ length: 64 }).map((_, i) => (
                    <div
                        class="w-0.75 h-0.75 rounded-full bg-text self-center justify-self-center animate-pulse"
                        style={{ 'animation-delay': `${(i * 0.07) % 3}s` }}
                    />
                ))}
            </div>

            <div class="mx-4 sm:mx-7 z-10 h-full flex flex-row gap-4 sm:gap-6 items-center">
                <NavMenu tone="accent" />
                <div class="w-px h-4 bg-text/15" />
                <span class="font-mono font-bold text-lg tracking-[0.25em] text-text">
                    {props.title}
                </span>
            </div>

            <Show when={showAuth()}>
                <div class="z-10 flex items-center gap-4 px-6">
                    <span class="font-mono text-lg tracking-[0.15em] text-text/60">
                        ADMIN
                    </span>
                    <div class="w-px h-4 bg-text/15" />
                    <span
                        class="font-mono text-l tracking-[0.15em] text-text/60 hover:text-text transition-colors cursor-pointer"
                        onClick={handleLogout}
                    >
                        LOG OUT
                    </span>
                </div>
            </Show>
            <Show when={!showAuth()}>
                <div class="z-10 px-6" />
            </Show>
        </div>
    );
};
