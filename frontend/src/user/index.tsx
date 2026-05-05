import { Component, createResource, Match, Switch } from 'solid-js';
import { useParams } from '@solidjs/router';
import { backendRequest, getToken } from '@/functional/utils';

const HeaderCard: Component = () => (
    <div class="w-full h-20 bg-accent overflow-hidden flex items-center justify-between relative px-2">
        {/* Dot grid */}
        <div class="absolute inset-0 grid grid-cols-[repeat(32,1fr)] p-3 gap-3 opacity-[0.18] pointer-events-none" aria-hidden="true">
            {Array.from({ length: 64 }).map((_, i) => (
                <div
                    class="w-0.75 h-0.75 rounded-full bg-text self-center justify-self-center animate-pulse"
                    style={{ 'animation-delay': `${(i * 0.07) % 3}s` }}
                />
            ))}
        </div>
        <div class="mx-7 z-10 h-full flex flex-row gap-2 items-center">
            <span
                class="font-mono font-bold text-lg tracking-[0.25em] text-text"
                style={{ 'padding-left': '1rem' }}
            >
                DASHBOARD
            </span>
        </div>
        {/* Empty right side — no auth controls for public page */}
        <div class="z-10 px-6" />
    </div>
);

const SuccessView: Component<{ action: string; member: string; timestamp: string }> = (props) => (
    <div class="flex-1 flex flex-col items-center justify-center gap-6">
        <div class="flex flex-col items-center gap-3">
            {/* Animated checkmark circle */}
            <div class="w-24 h-24 rounded-full border-4 border-green-500 flex items-center justify-center animate-[ping_0.4s_ease-out_1]">
                <svg class="w-12 h-12 text-green-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <span class="font-mono font-bold text-5xl tracking-widest text-green-500 uppercase">
                SUCCESS
            </span>
        </div>
        <div class="flex flex-col items-center gap-1 text-center">
            <span class="font-mono text-xl tracking-[0.15em] text-text">
                {props.member}
            </span>
            <span class="font-mono text-sm tracking-[0.2em] text-text/50 uppercase">
                Signed {props.action} · {new Date(props.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    </div>
);

const ErrorView: Component<{ message?: string }> = (props) => (
    <div class="flex-1 flex flex-col items-center justify-center gap-4">
        <div class="w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center">
            <svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </div>
        <span class="font-mono font-bold text-4xl tracking-widest text-red-500 uppercase">
            ERROR
        </span>
        <span class="font-mono text-sm text-text/50 tracking-[0.15em]">
            {props.message ?? 'Member not found'}
        </span>
    </div>
);

interface TapResponse {
    member: string;
    action: string;
    timestamp: string;
}

const MemberTapPage: Component = () => {
    const tok = getToken();
    const params = useParams<{ id: string }>();

    if (!tok) {
        window.location.href = '/login';
    }

    const [result] = createResource(async () => {
        return await backendRequest<TapResponse>('GET', `/member/${params.id}`, tok!);
    });

    return (
        <div class="flex flex-col min-h-screen font-sans bg-bg text-text">
            <HeaderCard />
            <Switch>
                <Match when={result.loading}>
                    <div class="flex-1 flex items-center justify-center">
                        <span class="w-10 h-10 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                    </div>
                </Match>

                <Match when={result.error}>
                    <ErrorView message={(result.error as any)?.message} />
                </Match>

                <Match when={result()}>
                    <SuccessView
                        member={result()!.member}
                        action={result()!.action}
                        timestamp={result()!.timestamp}
                    />
                </Match>
            </Switch>
        </div>
    );
};

export default MemberTapPage;