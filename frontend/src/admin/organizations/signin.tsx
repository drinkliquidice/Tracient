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

const SCAN_COOLDOWN_MS = 15 * 60 * 1000;
const SCAN_COOLDOWN_KEY = "tracient.qrScanCooldown";

type CooldownMap = Record<string, number>;

const readCooldownMap = (): CooldownMap => {
    try {
        const raw = localStorage.getItem(SCAN_COOLDOWN_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as CooldownMap;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

const writeCooldownMap = (map: CooldownMap) => {
    const cutoff = Date.now() - SCAN_COOLDOWN_MS;
    const pruned: CooldownMap = {};
    for (const [id, at] of Object.entries(map)) {
        if (typeof at === "number" && at > cutoff) pruned[id] = at;
    }
    localStorage.setItem(SCAN_COOLDOWN_KEY, JSON.stringify(pruned));
};

const cooldownRemainingMs = (memberId: string): number => {
    const last = readCooldownMap()[memberId];
    if (!last) return 0;
    return Math.max(0, last + SCAN_COOLDOWN_MS - Date.now());
};

const markScan = (memberId: string) => {
    const map = readCooldownMap();
    map[memberId] = Date.now();
    writeCooldownMap(map);
};

const formatCooldownRemaining = (ms: number): string => {
    const minutes = Math.max(1, Math.ceil(ms / 60000));
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

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
    });

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
};

type ScanRequest = { memberId: string; nonce: number };

export const SignInPage: Component = () => {
    const tok = getToken();
    const [scanRequest, setScanRequest] = createSignal<ScanRequest | null>(null);
    const [lastScanned, setLastScanned] = createSignal("");
    const [cooldownMsg, setCooldownMsg] = createSignal("");
    const navigate = useNavigate();

    if (!tok) {
        navigate("/login/", { replace: true });
    }

    const onScan = (data: string) => {
        if (!data || data === lastScanned()) return;

        // Short debounce so a held QR doesn't fire every video frame.
        setLastScanned(data);
        window.setTimeout(() => {
            if (lastScanned() === data) setLastScanned("");
        }, 2000);

        const remaining = cooldownRemainingMs(data);
        if (remaining > 0) {
            setCooldownMsg(
                `Please wait ${formatCooldownRemaining(remaining)} before scanning this code again`,
            );
            return;
        }

        setCooldownMsg("");
        setScanRequest({ memberId: data, nonce: Date.now() });
    };

    const [result] = createResource(
        scanRequest,
        async (req) => {
            if (!req?.memberId) return null;
            try {
                const res = await backendRequest<SignInResponse>(
                    "GET",
                    `/member/${req.memberId}`,
                    tok!,
                );
                markScan(req.memberId);
                return res;
            } catch (e) {
                // Allow the same QR to be scanned again after a non-cooldown error.
                setLastScanned("");
                throw e;
            }
        },
    );

    return (
        <div class="flex flex-col min-h-screen font-sans bg-bg text-text">
            <AppHeader title="QR SIGN-IN" />
            <div class="flex flex-1 items-center justify-center w-full px-4">
                <div class="flex flex-col items-center gap-4 w-full max-w-3xl">
                    <QRCodeReader onScan={onScan} />
                    <Show when={cooldownMsg()}>
                        <div class="p-6 mx-4 bg-amber-100 text-amber-900 rounded inline-block">
                            <p class="font-bold">Scan cooldown</p>
                            <p>{cooldownMsg()}</p>
                        </div>
                    </Show>
                    <Show when={result.error}>
                        <div class="p-6 mx-4 bg-red-100 text-red-800 rounded inline-block">
                            <p class="font-bold">Unable to sign</p>
                            <p>{(result.error as Error)?.message ?? "Please try again."}</p>
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
