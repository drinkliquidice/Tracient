import { backendRequest, getToken } from "@/functional/utils";
import {
    Component,
    For,
    Match,
    Show,
    Switch,
    createMemo,
    createSignal,
    onMount,
} from "solid-js";
import { AppHeader } from "@/components/AppHeader";
import { formatEasternTime } from "@/functional/time";
import { useNavigate } from "@solidjs/router";
import {
    OrganizationAssetCopyData,
    OrganizationAssetData,
    OrganizationMemberData,
    PaginatedMembersData,
} from "@/admin/organizations/functional/types";
import {
    assetLevelLabel,
    compareAssetLevels,
    compareByAssetCode,
    formatAssetQrLabel,
} from "@/functional/assetCodes";
import { compareByLastName, formatLastFirst, lastNameLetter } from "@/functional/names";

type Mode = "check_out" | "check_in";
type Step =
    | "select_mode"
    | "select_book"
    | "select_student"
    | "list_checked_out"
    | "success"
    | "error";

interface CirculateResponse {
    memberName: string;
    assetName: string;
    remainingQuantity: number;
    totalQuantity: number;
}

type CheckedOutItem = {
    copy: OrganizationAssetCopyData;
    group: OrganizationAssetData;
    copyIndex: number;
    copyCount: number;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const availableCopy = (group: OrganizationAssetData): OrganizationAssetCopyData | null =>
    (group.copies ?? []).find(c => !c.checkedOut) ?? null;

const FilterTabs: Component<{
    options: string[];
    available: string[];
    value: string | null;
    onChange: (value: string | null) => void;
    allLabel?: string;
}> = (props) => (
    <div class="flex flex-wrap items-center gap-1.5">
        <button
            type="button"
            class="px-2.5 py-1.5 font-mono text-xs tracking-widest uppercase border rounded-sm transition-colors"
            classList={{
                "bg-accent border-accent text-text": props.value === null,
                "border-text/10 text-text/40 hover:text-text/70": props.value !== null,
            }}
            onClick={() => props.onChange(null)}
        >
            {props.allLabel ?? "All"}
        </button>
        <For each={props.options}>
            {(option) => {
                const enabled = () => props.available.includes(option);
                return (
                    <button
                        type="button"
                        class="min-w-8 h-8 px-1.5 font-mono text-xs tracking-widest uppercase border rounded-sm transition-colors"
                        classList={{
                            "bg-accent border-accent text-text": props.value === option,
                            "border-text/10 text-text/70 hover:border-accent/40":
                                props.value !== option && enabled(),
                            "border-text/5 text-text/15 cursor-not-allowed": !enabled(),
                        }}
                        disabled={!enabled()}
                        onClick={() =>
                            props.onChange(props.value === option ? null : option)
                        }
                    >
                        {option}
                    </button>
                );
            }}
        </For>
    </div>
);

export const CirculationPage: Component = () => {
    const tok = getToken();
    const navigate = useNavigate();

    if (!tok) {
        navigate("/login/", { replace: true });
    }

    const [step, setStep] = createSignal<Step>("select_mode");
    const [mode, setMode] = createSignal<Mode>("check_out");
    const [assets, setAssets] = createSignal<OrganizationAssetData[]>([]);
    const [members, setMembers] = createSignal<OrganizationMemberData[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [query, setQuery] = createSignal("");
    const [levelFilter, setLevelFilter] = createSignal<string | null>(null);
    const [letterFilter, setLetterFilter] = createSignal<string | null>(null);
    const [selectedGroup, setSelectedGroup] = createSignal<OrganizationAssetData | null>(null);
    const [selectedCopyId, setSelectedCopyId] = createSignal("");
    const [submitting, setSubmitting] = createSignal(false);
    const [errorMsg, setErrorMsg] = createSignal("");
    const [circResult, setCircResult] = createSignal<CirculateResponse | null>(null);
    const [busyCopyId, setBusyCopyId] = createSignal<string | null>(null);

    const loadData = async () => {
        if (!tok) return;
        setLoading(true);
        try {
            const [assetList, memberPage] = await Promise.all([
                backendRequest<OrganizationAssetData[]>("GET", "/api/admin/assets/all", tok),
                backendRequest<PaginatedMembersData>("GET", "/api/admin/members/all", tok),
            ]);
            setAssets(assetList);
            setMembers(memberPage.items);
        } catch (e: any) {
            if (e?.status === 401) {
                navigate("/login/", { replace: true });
                return;
            }
            setErrorMsg(e?.message ?? "Failed to load circulation data.");
            setStep("error");
        } finally {
            setLoading(false);
        }
    };

    onMount(() => {
        void loadData();
    });

    const clearFilters = () => {
        setQuery("");
        setLevelFilter(null);
        setLetterFilter(null);
    };

    const reset = () => {
        setStep("select_mode");
        setSelectedGroup(null);
        setSelectedCopyId("");
        clearFilters();
        setErrorMsg("");
        setCircResult(null);
        setSubmitting(false);
        setBusyCopyId(null);
    };

    const selectMode = (m: Mode) => {
        setMode(m);
        clearFilters();
        setSelectedGroup(null);
        setSelectedCopyId("");
        setStep(m === "check_out" ? "select_book" : "list_checked_out");
    };

    const availableBookPool = createMemo(() =>
        [...assets()]
            .filter(a => a.currentQuantity > 0 && availableCopy(a))
            .sort(compareByAssetCode),
    );

    const availableLevels = createMemo(() => {
        const levels = new Set(availableBookPool().map(a => assetLevelLabel(a.assetCode)));
        return [...levels].sort(compareAssetLevels);
    });

    const availableBooks = createMemo(() =>
        availableBookPool().filter(a => {
            const level = levelFilter();
            if (level && assetLevelLabel(a.assetCode) !== level) return false;
            const q = query().trim().toLowerCase();
            if (!q) return true;
            return (
                a.name.toLowerCase().includes(q) ||
                a.assetCode.toLowerCase().includes(q)
            );
        }),
    );

    const availableLetters = createMemo(() => {
        const set = new Set(members().map(m => lastNameLetter(m.name)));
        return LETTERS.filter(l => set.has(l));
    });

    const sortedMembers = createMemo(() =>
        [...members()]
            .sort(compareByLastName)
            .filter(m => {
                const letter = letterFilter();
                if (letter && lastNameLetter(m.name) !== letter) return false;
                const q = query().trim().toLowerCase();
                if (!q) return true;
                return (
                    m.name.toLowerCase().includes(q) ||
                    formatLastFirst(m.name).toLowerCase().includes(q)
                );
            }),
    );

    const checkedOutPool = createMemo((): CheckedOutItem[] => {
        const items: CheckedOutItem[] = [];
        for (const group of assets()) {
            const copies = group.copies ?? [];
            copies.forEach((copy, index) => {
                if (copy.checkedOut) {
                    items.push({
                        copy,
                        group,
                        copyIndex: index,
                        copyCount: copies.length,
                    });
                }
            });
        }
        items.sort((a, b) => compareByAssetCode(a.group, b.group));
        return items;
    });

    const checkedOutLevels = createMemo(() => {
        const levels = new Set(
            checkedOutPool().map(item => assetLevelLabel(item.group.assetCode)),
        );
        return [...levels].sort(compareAssetLevels);
    });

    const checkedOutItems = createMemo((): CheckedOutItem[] =>
        checkedOutPool().filter(item => {
            const level = levelFilter();
            if (level && assetLevelLabel(item.group.assetCode) !== level) return false;
            const q = query().trim().toLowerCase();
            if (!q) return true;
            const borrower = item.copy.borrowedByMemberName ?? "";
            return (
                item.group.name.toLowerCase().includes(q) ||
                item.group.assetCode.toLowerCase().includes(q) ||
                borrower.toLowerCase().includes(q) ||
                formatLastFirst(borrower).toLowerCase().includes(q)
            );
        }),
    );

    const circulate = async (opts: {
        assetId: string;
        memberId?: string;
        checkOut: boolean;
    }) => {
        return backendRequest<CirculateResponse>(
            "POST",
            "/api/admin/assets/circulate",
            tok!,
            {
                asset_id: opts.assetId,
                member_id: opts.memberId || undefined,
                time: new Date().toISOString(),
                check_out: opts.checkOut,
            },
        );
    };

    const selectBook = (group: OrganizationAssetData) => {
        const copy = availableCopy(group);
        if (!copy) return;
        setSelectedGroup(group);
        setSelectedCopyId(copy.id);
        clearFilters();
        setStep("select_student");
    };

    const selectStudent = async (member: OrganizationMemberData) => {
        if (submitting()) return;
        const copyId = selectedCopyId();
        if (!copyId) return;

        setSubmitting(true);
        setErrorMsg("");
        try {
            const res = await circulate({
                assetId: copyId,
                memberId: member.id,
                checkOut: true,
            });
            setCircResult(res);
            setStep("success");
            void loadData();
        } catch (e: any) {
            setErrorMsg(e?.message ?? "Check out failed. Please try again.");
            setStep("error");
        } finally {
            setSubmitting(false);
        }
    };

    const checkInCopy = async (item: CheckedOutItem) => {
        if (busyCopyId()) return;
        setBusyCopyId(item.copy.id);
        setErrorMsg("");
        try {
            const res = await circulate({
                assetId: item.copy.id,
                memberId: item.copy.borrowedByMemberId || undefined,
                checkOut: false,
            });
            setCircResult(res);
            setStep("success");
            void loadData();
        } catch (e: any) {
            setErrorMsg(e?.message ?? "Check in failed. Please try again.");
            setStep("error");
        } finally {
            setBusyCopyId(null);
        }
    };

    const modeLabel = () => (mode() === "check_out" ? "Check Out" : "Check In");
    const modeColor = () => (mode() === "check_out" ? "text-accent" : "text-blue-400");
    const modeBorder = () =>
        mode() === "check_out"
            ? "border-accent/20 bg-accent/10"
            : "border-blue-400/20 bg-blue-400/10";

    return (
        <div class="flex flex-col min-h-screen font-sans bg-bg text-text">
            <AppHeader title="CIRCULATION" />

            <div class="flex flex-1 justify-center">
                <div class="flex flex-col items-center gap-6 w-full max-w-4xl px-4 py-10">
                    <Show when={loading() && step() === "select_mode"}>
                        <span class="font-mono text-xs text-text/40 tracking-widest uppercase flex items-center gap-2">
                            <span class="w-3 h-3 border-2 border-text/20 border-t-text rounded-full animate-spin inline-block" />
                            Loading...
                        </span>
                    </Show>

                    <Switch>
                        <Match when={step() === "select_mode"}>
                            <div class="flex flex-col items-center gap-6 w-full max-w-lg">
                                <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                                    Select Action
                                </span>
                                <div class="grid grid-cols-2 gap-4 w-full">
                                    <button
                                        class="flex flex-col items-center gap-3 py-10 border border-text/10 rounded-sm hover:border-accent/40 hover:bg-accent/5 transition-all duration-150"
                                        onClick={() => selectMode("check_out")}
                                        disabled={loading()}
                                    >
                                        <svg class="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M17 8l4 4-4 4M3 12h18" />
                                        </svg>
                                        <span class="font-mono text-sm tracking-widest text-text uppercase">Check Out</span>
                                    </button>
                                    <button
                                        class="flex flex-col items-center gap-3 py-10 border border-text/10 rounded-sm hover:border-blue-400/40 hover:bg-blue-400/5 transition-all duration-150"
                                        onClick={() => selectMode("check_in")}
                                        disabled={loading()}
                                    >
                                        <svg class="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M7 16l-4-4 4-4M21 12H3" />
                                        </svg>
                                        <span class="font-mono text-sm tracking-widest text-text uppercase">Check In</span>
                                    </button>
                                </div>
                            </div>
                        </Match>

                        <Match when={step() === "select_book"}>
                            <div class="flex flex-col gap-4 w-full min-h-0 flex-1">
                                <div class={`self-start px-3 py-1 border rounded-sm ${modeBorder()}`}>
                                    <span class={`font-mono text-xs tracking-widest uppercase ${modeColor()}`}>
                                        {modeLabel()}
                                    </span>
                                </div>
                                <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                                    Select Book
                                </span>
                                <input
                                    class="w-full bg-surface border border-text/10 rounded-sm px-4 py-3 font-mono text-sm text-text outline-none focus:border-accent"
                                    placeholder="Search by name or code"
                                    value={query()}
                                    onInput={e => setQuery(e.currentTarget.value)}
                                />
                                <FilterTabs
                                    options={availableLevels()}
                                    available={availableLevels()}
                                    value={levelFilter()}
                                    onChange={setLevelFilter}
                                />
                                <div class="flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
                                    <Show
                                        when={availableBooks().length > 0}
                                        fallback={
                                            <span class="font-mono text-xs text-text/30 tracking-widest uppercase py-8 text-center">
                                                No books available
                                            </span>
                                        }
                                    >
                                        <For each={availableBooks()}>
                                            {(book) => (
                                                <button
                                                    type="button"
                                                    class="flex items-center justify-between gap-3 px-4 py-3 border border-text/8 rounded-sm bg-surface hover:border-accent/40 hover:bg-accent/5 transition-all text-left"
                                                    onClick={() => selectBook(book)}
                                                >
                                                    <div class="flex flex-col gap-0.5 min-w-0">
                                                        <span class="font-mono text-sm text-text tracking-wide truncate">
                                                            {book.name}
                                                        </span>
                                                        <span class="font-mono text-xs text-text/35 tracking-wide">
                                                            {book.assetCode}
                                                        </span>
                                                    </div>
                                                    <span class="font-mono text-xs text-text/40 tracking-wide shrink-0">
                                                        {book.currentQuantity}/{book.totalQuantity}
                                                    </span>
                                                </button>
                                            )}
                                        </For>
                                    </Show>
                                </div>
                                <button
                                    class="font-mono text-xs tracking-widest text-text/30 hover:text-text/60 uppercase transition-colors self-start"
                                    onClick={reset}
                                >
                                    ← Back
                                </button>
                            </div>
                        </Match>

                        <Match when={step() === "select_student"}>
                            <div class="flex flex-col gap-4 w-full min-h-0 flex-1">
                                <div class={`self-start px-3 py-1 border rounded-sm ${modeBorder()}`}>
                                    <span class={`font-mono text-xs tracking-widest uppercase ${modeColor()}`}>
                                        {modeLabel()}
                                    </span>
                                </div>
                                <Show when={selectedGroup()}>
                                    {(group) => (
                                        <div class="flex items-center justify-between gap-3 px-3 py-2.5 border border-text/8 rounded-sm bg-surface">
                                            <div class="flex flex-col gap-0.5 min-w-0">
                                                <span class="font-mono text-[10px] text-text/30 tracking-widest uppercase">
                                                    Book
                                                </span>
                                                <span class="font-mono text-sm text-text tracking-wide truncate">
                                                    {group().name}
                                                </span>
                                            </div>
                                            <span class="font-mono text-xs text-text/40 tracking-wide shrink-0">
                                                {group().assetCode}
                                            </span>
                                        </div>
                                    )}
                                </Show>
                                <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                                    Select Student
                                </span>
                                <input
                                    class="w-full bg-surface border border-text/10 rounded-sm px-4 py-3 font-mono text-sm text-text outline-none focus:border-accent"
                                    placeholder="Search by name"
                                    value={query()}
                                    onInput={e => setQuery(e.currentTarget.value)}
                                />
                                <FilterTabs
                                    options={LETTERS}
                                    available={availableLetters()}
                                    value={letterFilter()}
                                    onChange={setLetterFilter}
                                />
                                <Show when={submitting()}>
                                    <span class="font-mono text-xs text-text/40 tracking-widest uppercase flex items-center gap-2">
                                        <span class="w-3 h-3 border-2 border-text/20 border-t-text rounded-full animate-spin inline-block" />
                                        Checking out...
                                    </span>
                                </Show>
                                <div class="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
                                    <Show
                                        when={sortedMembers().length > 0}
                                        fallback={
                                            <span class="font-mono text-xs text-text/30 tracking-widest uppercase py-8 text-center">
                                                No students found
                                            </span>
                                        }
                                    >
                                        <For each={sortedMembers()}>
                                            {(member) => (
                                                <button
                                                    type="button"
                                                    class="flex items-center px-4 py-3 border border-text/8 rounded-sm bg-surface hover:border-accent/40 hover:bg-accent/5 transition-all text-left disabled:opacity-45"
                                                    onClick={() => void selectStudent(member)}
                                                    disabled={submitting()}
                                                >
                                                    <span class="font-mono text-sm text-text tracking-wide truncate">
                                                        {formatLastFirst(member.name)}
                                                    </span>
                                                </button>
                                            )}
                                        </For>
                                    </Show>
                                </div>
                                <button
                                    class="font-mono text-xs tracking-widest text-text/30 hover:text-text/60 uppercase transition-colors self-start"
                                    onClick={() => {
                                        clearFilters();
                                        setStep("select_book");
                                    }}
                                    disabled={submitting()}
                                >
                                    ← Back
                                </button>
                            </div>
                        </Match>

                        <Match when={step() === "list_checked_out"}>
                            <div class="flex flex-col gap-4 w-full min-h-0 flex-1">
                                <div class={`self-start px-3 py-1 border rounded-sm ${modeBorder()}`}>
                                    <span class={`font-mono text-xs tracking-widest uppercase ${modeColor()}`}>
                                        {modeLabel()}
                                    </span>
                                </div>
                                <span class="font-mono text-xs tracking-widest text-text/40 uppercase">
                                    Checked Out Books
                                </span>
                                <input
                                    class="w-full bg-surface border border-text/10 rounded-sm px-4 py-3 font-mono text-sm text-text outline-none focus:border-accent"
                                    placeholder="Search by book or student"
                                    value={query()}
                                    onInput={e => setQuery(e.currentTarget.value)}
                                />
                                <FilterTabs
                                    options={checkedOutLevels()}
                                    available={checkedOutLevels()}
                                    value={levelFilter()}
                                    onChange={setLevelFilter}
                                />
                                <div class="flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
                                    <Show
                                        when={checkedOutItems().length > 0}
                                        fallback={
                                            <span class="font-mono text-xs text-text/30 tracking-widest uppercase py-8 text-center">
                                                No books checked out
                                            </span>
                                        }
                                    >
                                        <For each={checkedOutItems()}>
                                            {(item) => {
                                                const busy = () => busyCopyId() === item.copy.id;
                                                const label = () =>
                                                    formatAssetQrLabel(item.group.assetCode, {
                                                        copyIndex: item.copyIndex,
                                                        copyCount: item.copyCount,
                                                    });
                                                return (
                                                    <div class="flex items-center gap-3 px-4 py-3 border border-text/8 rounded-sm bg-surface">
                                                        <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                                                            <span class="font-mono text-sm text-text tracking-wide truncate">
                                                                {item.group.name}
                                                            </span>
                                                            <span class="font-mono text-xs text-text/35 tracking-wide">
                                                                {label()}
                                                                <Show when={item.copy.borrowedByMemberName}>
                                                                    {" · "}
                                                                    {formatLastFirst(item.copy.borrowedByMemberName!)}
                                                                </Show>
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            class="shrink-0 px-3 py-2 border border-blue-400/30 text-blue-400 rounded-sm font-mono text-xs tracking-widest uppercase hover:bg-blue-400/10 transition-colors disabled:opacity-40"
                                                            onClick={() => void checkInCopy(item)}
                                                            disabled={!!busyCopyId()}
                                                        >
                                                            {busy()
                                                                ? <span class="w-3 h-3 border-2 border-blue-400/20 border-t-blue-400 rounded-full animate-spin inline-block" />
                                                                : "Check In"
                                                            }
                                                        </button>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </Show>
                                </div>
                                <button
                                    class="font-mono text-xs tracking-widest text-text/30 hover:text-text/60 uppercase transition-colors self-start"
                                    onClick={reset}
                                >
                                    ← Back
                                </button>
                            </div>
                        </Match>

                        <Match when={step() === "success"}>
                            <div class={`flex flex-col items-center gap-5 p-8 border rounded-sm w-full max-w-lg ${modeBorder()}`}>
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
                                        <span class="text-text/40 uppercase tracking-widest">Current</span>
                                        <span class="text-text">
                                            {circResult()?.remainingQuantity} / {circResult()?.totalQuantity}
                                        </span>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <span class="text-text/40 uppercase tracking-widest">Time</span>
                                        <span class="text-text">{formatEasternTime(new Date())}</span>
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

                        <Match when={step() === "error"}>
                            <div class="flex flex-col items-center gap-4 p-8 bg-red-400/10 border border-red-400/20 rounded-sm w-full max-w-lg">
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
