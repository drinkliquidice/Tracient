import { backendRequest, getToken } from "@/functional/utils";
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
import { AppHeader } from "@/components/AppHeader";
import { formatEasternTime } from "@/functional/time";
import { useNavigate } from "@solidjs/router";

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
        <div class="w-full">
            <Show when={error()}>
                <p>{error()}</p>
            </Show>
            <video ref={videoRef} class="w-full h-auto max-h-[75vh] object-cover rounded" />
        </div>
    );

}

export const SignInPage: Component = () => {
    const tok = getToken();
    const [endpointUrl, setEndpointUrl] = createSignal("");
    const [lastScanned, setLastScanned] = createSignal("");
    const navigate = useNavigate();

    if (!tok) {
        navigate('/login/', { replace: true });
    }

    const onScan = (data: string) => {
        if (data === lastScanned()) return;
        setEndpointUrl(data);
        setLastScanned(data);
    };

    const [result] = createResource(
        endpointUrl,
        async (url) => {
            if (!url) return null;
            try {
                return await backendRequest<SignInResponse>('GET', `/member/${url}`, tok!);
            } catch (e) {
                // Allow the same QR to be scanned again after an error (e.g. already signed in today).
                setLastScanned('');
                throw e;
            }
        }
    );

    return (
        <div class="flex flex-col min-h-screen font-sans bg-bg text-text">
            <AppHeader title="QR SIGN-IN" />
            <div class="flex flex-1 items-center justify-center w-full px-4">
                <div class="flex flex-col items-center gap-4 w-full max-w-3xl">
                    <QRCodeReader onScan={onScan} />
                    <Show when={result.error}>
                        <div class="p-6 mx-4 bg-red-100 text-red-800 rounded inline-block">
                            <p class="font-bold">Unable to sign</p>
                            <p>{(result.error as Error)?.message ?? 'Please try again.'}</p>
                        </div>
                    </Show>
                    <Show when={!result.error && result()}>
                        <div class="p-6 mx-4 bg-green-100 text-green-800 rounded inline-block">
                            <p class="font-bold">{result()!.member}</p>
                            <p>{result()!.action} at {formatEasternTime(result()!.timestamp)}</p>
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
};

export default SignInPage;
