import { backendRequest, getToken, logout } from "@/functional/utils";
import {
    Component,
    createSignal,
    onMount,
    onCleanup,
    Show,
    Match,
    Switch,
} from "solid-js";
import QrScanner from "qr-scanner";
import { getMemberIdFromEndpoint } from "@/admin/organizations/functional/functional";
import { useNavigate } from "@solidjs/router";

type Mode = 'check_out' | 'check_in';
type Step = 'select_mode' | 'scan_member' | 'confirm_member' | 'scan_asset' | 'success' | 'error';

interface CirculateResponse {
    memberName: string;
    assetName: string;
    remainingQuantity: number;
}

const HeaderCard: Component<{ navigateLogin: () => void }> = (props) => (
    <div class="w-full h-20 bg-accent overflow-hidden flex items-center justify-between relative px-2">
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
        <div class="mx-7 z-10 h-full flex items-center">
            <span class="font-mono font-bold text-lg tracking-[0.25em] text-text" style={{ "padding-left": "1rem" }}>
                CIRCULATION
            </span>
        </div>
        <div class="z-10 flex items-center gap-4 px-6">
            <span class="font-mono text-lg tracking-[0.15em] text-text/60">ADMIN</span>
            <div class="w-px h-4 bg-text/15" />
            <span
                class="font-mono text-l tracking-[0.15em] text-text/60 hover:text-text transition-colors cursor-pointer"
                onClick={() => { logout(); props.navigateLogin(); }}
            >
                LOG OUT
            </span>
        </div>
    </div>
);

const QRCodeReader: Component<{
    onScan: (data: string) => void;
}> = (props) => {
    let videoRef: HTMLVideoElement | undefined;
    let scanner: QrScanner;
    const [error, setError] = createSignal('');

    onMount(() => {
        scanner = new QrScanner(
            videoRef!,
            (result: QrScanner.ScanResult) => {
                props.onScan(getMemberIdFromEndpoint(result.data));
            },
            { highlightScanRegion: true, highlightCodeOutline: true }
        );
        scanner.start().catch(err => setError('Unable to start scanner: ' + err));
    });

    onCleanup(() => {
        if (scanner) scanner.stop();
    });

    return (
        <div class="flex flex-col items-center gap-3 w-96">
            <Show when={error()}>
                <p class="font-mono text-xs text-red-400">{error()}</p>
            </Show>
            <video ref={videoRef} class="w-full h-auto rounded-sm border border-text/10" />
        </div>
    );
};

export const CirculationPage: Component = () => {
    const tok = getToken();
    const navigate = useNavigate();
    const navigateLogin = () => navigate('/login/');

    if (!tok) {
        window.location.href = '/login';
    }

    const [step, setStep] = createSignal<Step>('select_mode');
    const [mode, setMode] = createSignal<Mode>('check_out');
    const [memberId, setMemberId] = createSignal('');
    const [lastScanned, setLastScanned] = createSignal('');
    const [submitting, setSubmitting] = createSignal(false);
    const [errorMsg, setErrorMsg] = createSignal('');
    const [circResult, setCircResult] = createSignal<CirculateResponse | null>(null);

    const reset = () => {
        setStep('select_mode');
        setMemberId('');
        setLastScanned('');
        setErrorMsg('');
        setCircResult(null);
        setSubmitting(false);
    };

    const selectMode = (m: Mode) => {
        setMode(m);
        setStep('scan_member');
    };

    const onScanMember = (id: string) => {
        if (id === lastScanned()) return;
        setLastScanned(id);
        setMemberId(id);
        setStep('confirm_member');
    };

    const confirmMember = () => {
        setLastScanned('');
        setStep('scan_asset');
    };

    const onScanAsset = async (id: string) => {
        if (id === lastScanned() || submitting()) return;
        setLastScanned(id);
        setSubmitting(true);

        try {
            const res = await backendRequest<CirculateResponse>(
                'POST',
                '/api/admin/assets/circulate',
                tok!,
                {
                    member_id: memberId(),
                    asset_id: id,
                    time: new Date().toISOString(),
                    check_out: mode() === 'check_out',
                }
            );
            setCircResult(res);
            setStep('success');
        } catch (e: any) {
            setErrorMsg(e?.message ?? 'Circulation failed. Please try again.');
            setStep('error');
        } finally {
            setSubmitting(false);
        }
    };

    const modeLabel = () => mode() === 'check_out' ? 'Check Out' : 'Check In';
    const modeColor = () => mode() === 'check_out' ? 'text-accent' : 'text-blue-400';
    const modeBorder = () => mode() === 'check_out' ? 'border-accent/20 bg-accent/10' : 'border-blue-400/20 bg-blue-400/10';

    return (
        <div class="flex flex-col min-h-screen font-sans bg-bg text-text">
            <HeaderCard navigateLogin={navigateLogin} />

            <div class="flex flex-1 items-center justify-center">
                <div class="flex flex-col items-center gap-8 w-full max-w-md px-4">

                    <Switch>

                        {/* ── Step 1: select mode ── */}
                        <Match when={step() === 'select_mode'}>
                            <div class="flex flex-col items-center gap-6 w-full">
                                <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                                    Select Action
                                </span>
                                <div class="grid grid-cols-2 gap-4 w-full">
                                    <button
                                        class="flex flex-col items-center gap-3 py-10 border border-text/10 rounded-sm hover:border-accent/40 hover:bg-accent/5 transition-all duration-150 group"
                                        onClick={() => selectMode('check_out')}
                                    >
                                        <svg class="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M17 8l4 4-4 4M3 12h18M12 3v3M12 18v3" />
                                        </svg>
                                        <span class="font-mono text-sm tracking-widest text-text uppercase">Check Out</span>
                                    </button>
                                    <button
                                        class="flex flex-col items-center gap-3 py-10 border border-text/10 rounded-sm hover:border-blue-400/40 hover:bg-blue-400/5 transition-all duration-150 group"
                                        onClick={() => selectMode('check_in')}
                                    >
                                        <svg class="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M7 16l-4-4 4-4M21 12H3M12 21v-3M12 6V3" />
                                        </svg>
                                        <span class="font-mono text-sm tracking-widest text-text uppercase">Check In</span>
                                    </button>
                                </div>
                            </div>
                        </Match>

                        {/* ── Step 2: scan member ── */}
                        <Match when={step() === 'scan_member'}>
                            <div class="flex flex-col items-center gap-4 w-full">
                                <div class={`px-3 py-1 border rounded-sm ${modeBorder()}`}>
                                    <span class={`font-mono text-xs tracking-widest uppercase ${modeColor()}`}>
                                        {modeLabel()}
                                    </span>
                                </div>
                                <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                                    Scan Member QR Code
                                </span>
                                <QRCodeReader onScan={onScanMember} />
                                <button
                                    class="font-mono text-xs tracking-widest text-text/30 hover:text-text/60 uppercase transition-colors"
                                    onClick={reset}
                                >
                                    ← Back
                                </button>
                            </div>
                        </Match>

                        {/* ── Step 3: confirm member ── */}
                        <Match when={step() === 'confirm_member'}>
                            <div class="flex flex-col items-center gap-6 w-full">
                                <div class={`px-3 py-1 border rounded-sm ${modeBorder()}`}>
                                    <span class={`font-mono text-xs tracking-widest uppercase ${modeColor()}`}>
                                        {modeLabel()}
                                    </span>
                                </div>
                                <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                                    Confirm Member
                                </span>
                                <div class="w-full border border-text/10 rounded-sm px-6 py-5 flex flex-col gap-2">
                                    <span class="font-mono text-xs text-text/30 tracking-widest uppercase">Member ID</span>
                                    <span class="font-mono text-sm text-text tracking-wide break-all">{memberId()}</span>
                                </div>
                                <div class="flex gap-3 w-full">
                                    <button
                                        class="flex-1 py-3 border border-text/10 text-text/50 font-mono text-xs tracking-widest uppercase rounded-sm hover:border-text/30 hover:text-text/80 transition-all duration-150"
                                        onClick={() => { setMemberId(''); setLastScanned(''); setStep('scan_member'); }}
                                    >
                                        Re-scan
                                    </button>
                                    <button
                                        class="flex-1 py-3 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150"
                                        onClick={confirmMember}
                                    >
                                        Continue →
                                    </button>
                                </div>
                            </div>
                        </Match>

                        {/* ── Step 4: scan asset ── */}
                        <Match when={step() === 'scan_asset'}>
                            <div class="flex flex-col items-center gap-4 w-full">
                                <div class={`px-3 py-1 border rounded-sm ${modeBorder()}`}>
                                    <span class={`font-mono text-xs tracking-widest uppercase ${modeColor()}`}>
                                        {modeLabel()}
                                    </span>
                                </div>
                                <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                                    Scan Asset QR Code
                                </span>
                                <div class="flex items-center gap-2 px-3 py-1.5 bg-surface border border-text/8 rounded-sm w-full">
                                    <span class="font-mono text-xs text-text/30 tracking-widest uppercase shrink-0">Member</span>
                                    <span class="font-mono text-xs text-text tracking-wide truncate">{memberId()}</span>
                                </div>
                                <QRCodeReader onScan={onScanAsset} />
                                <Show when={submitting()}>
                                    <span class="font-mono text-xs text-text/40 tracking-widest uppercase flex items-center gap-2">
                                        <span class="w-3 h-3 border-2 border-text/20 border-t-text rounded-full animate-spin inline-block" />
                                        Processing...
                                    </span>
                                </Show>
                                <button
                                    class="font-mono text-xs tracking-widest text-text/30 hover:text-text/60 uppercase transition-colors"
                                    onClick={() => setStep('confirm_member')}
                                >
                                    ← Back
                                </button>
                            </div>
                        </Match>

                        {/* ── Step 5: success ── */}
                        <Match when={step() === 'success'}>
                            <div class={`flex flex-col items-center gap-5 p-8 border rounded-sm w-full ${modeBorder()}`}>
                                <span class={`font-mono text-xs tracking-widest uppercase ${modeColor()}`}>
                                    {modeLabel()} Complete
                                </span>
                                <div class="w-full flex flex-col gap-3 font-mono text-xs">
                                    <div class="flex justify-between items-center border-b border-text/8 pb-3">
                                        <span class="text-text/40 uppercase tracking-widest">Member</span>
                                        <span class="text-text">{circResult()?.memberName}</span>
                                    </div>
                                    <div class="flex justify-between items-center border-b border-text/8 pb-3">
                                        <span class="text-text/40 uppercase tracking-widest">Asset</span>
                                        <span class="text-text">{circResult()?.assetName}</span>
                                    </div>
                                    <div class="flex justify-between items-center border-b border-text/8 pb-3">
                                        <span class="text-text/40 uppercase tracking-widest">Remaining</span>
                                        <span class="text-text">{circResult()?.remainingQuantity}</span>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <span class="text-text/40 uppercase tracking-widest">Time</span>
                                        <span class="text-text">{new Date().toLocaleTimeString()}</span>
                                    </div>
                                </div>
                                <button
                                    class="mt-2 w-full py-2.5 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150"
                                    onClick={reset}
                                >
                                    New Circulation
                                </button>
                            </div>
                        </Match>

                        {/* ── Step 6: error ── */}
                        <Match when={step() === 'error'}>
                            <div class="flex flex-col items-center gap-4 p-8 bg-red-400/10 border border-red-400/20 rounded-sm w-full">
                                <span class="font-mono text-xs tracking-widest text-red-400 uppercase">Failed</span>
                                <p class="font-mono text-xs text-text/60 text-center">{errorMsg()}</p>
                                <button
                                    class="w-full py-2.5 bg-accent text-text font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-accent/85 active:scale-[0.98] transition-all duration-150"
                                    onClick={reset}
                                >
                                    Try Again
                                </button>
                            </div>
                        </Match>

                    </Switch>

                </div>
            </div>
        </div>
    );
};

export default CirculationPage;