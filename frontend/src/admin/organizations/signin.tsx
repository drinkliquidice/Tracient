import { backendRequest, getToken, logout } from "@/functional/utils";
import {
    Component,
    createResource, 
    createSignal,
    onMount,
    onCleanup,
    Show,
} from "solid-js";
import QrScanner from "qr-scanner";

import { SignInResponse } from "./functional/types";
import { getMemberIdFromEndpoint } from "./functional/functional";
import { useNavigate } from "@solidjs/router";

const HeaderCard: Component<{
    navigateLogin: () => void;
}> = (props) => (
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
                style={{ "padding-left": "1rem" }}
            >
                DASHBOARD
            </span>
        </div>

        {/* Right — username + logout */}
        <div class="z-10 flex items-center gap-4 px-6">
            <span class="font-mono text-lg tracking-[0.15em] text-text/60">
                ADMIN
            </span>
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
    let QRScanner: QrScanner;
    const [error, setError] = createSignal<string>("");

    onMount(() => {
        QRScanner = new QrScanner(
            videoRef!,
            (result: QrScanner.ScanResult) => props.onScan(getMemberIdFromEndpoint(result.data)),
            { highlightScanRegion: true, highlightCodeOutline: true }
        );

        QRScanner.start().catch((err) => setError("Unable to set up QR scanner: " + err));
    })

    onCleanup(() => {
        if (QRScanner) QRScanner.stop();
    });

    return (
        <div class="w-72 h-72 justify-center">
            <Show when={error()}>
                <p>{error()}</p>
            </Show>
            <video ref={videoRef} class="w-full h-full rounded" />
        </div>
    );

}

export const SignInPage: Component = () => {
    const tok = getToken();
    const [endpointUrl, setEndpointUrl] = createSignal("");
    const [lastScanned, setLastScanned] = createSignal("");
    const navigate = useNavigate();
    const navigateLogin = () => navigate('/login/');

    if (!tok) {
        window.location.href = '/login';
    }

    const onScan = (data: string) => {
        if (data === lastScanned()) return; 
        setEndpointUrl(data);
        setLastScanned(data);
    }

    const [result] = createResource(
        endpointUrl,
        async (url) => {
            console.log("fetcher called with:", url);
            if (!url) return null;
            return await backendRequest<SignInResponse>('GET', `/member/${url}`, tok!);
        }
    );

    return (
        <div class="flex flex-col min-h-screen font-sans bg-bg text-text">
            <HeaderCard navigateLogin={navigateLogin} />
            <div class="flex flex-1 items-center justify-center">
                <QRCodeReader onScan={onScan} />
            </div>
            <Show when={result()}>
                <div class="mt-6 p-4 bg-green-100 text-green-800 rounded">
                    <p class="font-bold">{result()!.member}</p>
                    <p>{result()!.action} at {new Date(result()!.timestamp).toLocaleTimeString()}</p>
                </div>
            </Show>
        </div>   
    );
};

export default SignInPage;
