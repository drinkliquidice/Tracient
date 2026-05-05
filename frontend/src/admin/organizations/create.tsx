import { Component, createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';

import '@/index.css';
import { getToken } from '@/functional/utils';
import { useNavigate } from '@solidjs/router';

// ── types ────────────────────────────────────────────────────────────────────

interface OrgFormState {
    name: string;
}

interface OrgFormErrors {
    name?: string;
    csv?: string;
    submit?: string;
}

interface InputProps {
    label: string;
    value: string;
    onInput: (v: string) => void;
    onBlur: () => void;
    error?: string;
    autoComplete?: string;
    disabled?: boolean;
    mono?: boolean;
    placeholder?: string;
}

export const inputBase = `
	w-full bg-surface border rounded-sm px-6 py-7
	text-text outline-none
	transition-all duration-150
	disabled:opacity-45 disabled:cursor-not-allowed
	focus:border-accent
`;

// ── api ──────────────────────────────────────────────────────────────────────

async function createOrganization(token: string, name: string, csvFile: File): Promise<void> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('members_csv', csvFile);

    const res = await fetch('/api/admin/organization/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });

    if (!res.ok) {
        const msg = await res.text().catch(() => 'Request failed');
        throw new Error(msg);
    }
}

// ── validation ───────────────────────────────────────────────────────────────

function validateField(field: keyof OrgFormState, form: OrgFormState): string | undefined {
    switch (field) {
        case 'name':
            if (!form.name.trim()) return 'Organization name is required';
            if (form.name.length < 2) return 'At least 2 characters';
            if (form.name.length > 100) return 'Max 100 characters';
            break;
    }
    return undefined;
}

function validateAll(form: OrgFormState): OrgFormErrors {
    const fields: (keyof OrgFormState)[] = ['name'];
    return Object.fromEntries(
        fields
            .map((f) => [f, validateField(f, form)] as const)
            .filter(([, e]) => e)
    );
}

// ── shared field component (mirrors signup) ───────────────────────────────────

const Field = (props: InputProps) => (
    <div class="flex flex-col">
        <label class="font-mono text-sm text-text-muted">
            {props.label}
        </label>
        <input
            class={`
                ${inputBase}
                ${props.mono ? 'font-mono text-sm' : 'font-sans text-base'}
                ${props.error ? 'border-error' : 'border-border-col'}
            `}
            style={{ padding: '2px 2px' }}
            type="text"
            value={props.value}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            onBlur={props.onBlur}
            autocomplete={props.autoComplete}
            disabled={props.disabled}
            placeholder={props.placeholder}
            spellcheck={false}
        />
        <Show when={props.error}>
            <p class="font-mono text-xs text-error">{props.error}</p>
        </Show>
    </div>
);

// ── header (matches dashboard) ────────────────────────────────────────────────

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
                CREATE ORGANIZATION
            </span>
        </div>

        <div class="z-10 flex items-center gap-4 px-6">
            <span class="font-mono text-lg tracking-[0.15em] text-text/60">
                ADMIN
            </span>
            <div class="w-px h-4 bg-text/15" />
            <a
                class="font-mono text-l tracking-[0.15em] text-text/60 hover:text-text transition-colors cursor-pointer"
                style={{ 'padding-right': '1rem' }}
                href="/login"
            >
                LOG OUT
            </a>
        </div>
    </div>
);

// ── form body ─────────────────────────────────────────────────────────────────

const CreateOrganizationBody: Component = () => {
    const token = getToken();
    const navigate = useNavigate();

    const [form, setForm] = createStore<OrgFormState>({ name: '' });
    const [errors, setErrors] = createStore<OrgFormErrors>({});
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [isSubmitted, setIsSubmitted] = createSignal(false);
    const [csvFile, setCsvFile] = createSignal<File | null>(null);

    let fileInputRef: HTMLInputElement | undefined;

    const updateField = (field: keyof OrgFormState, value: string) => setForm(field, value);
    const blurField = (field: keyof OrgFormState) => setErrors(field, validateField(field, form));

    const onFileChange = (e: Event) => {
        const file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
        if (file && !file.name.endsWith('.csv')) {
            setErrors('csv', 'File must be a .csv');
            setCsvFile(null);
            return;
        }
        setErrors('csv', undefined);
        setCsvFile(file);
    };

    const clearFile = () => {
        setCsvFile(null);
        setErrors('csv', undefined);
        if (fileInputRef) fileInputRef.value = '';
    };

    const onSubmit = async (e: Event) => {
        e.preventDefault();
        console.log('onSubmit fired');
        console.log('csvFile:', csvFile());
        console.log('form:', form);
        const errs = validateAll(form);
        if (!csvFile()) errs.csv = 'Members CSV is required';
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        if (!token) { navigate('/login'); return; }

        setIsSubmitting(true);
        setErrors('submit', undefined);
        try {
            await createOrganization(token, form.name, csvFile()!);
            setIsSubmitted(true);
        } catch (err: unknown) {
            setErrors('submit', err instanceof Error ? err.message : 'Unexpected error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div class="flex-1 flex items-center justify-center px-6 py-12">
            <Show
                when={!isSubmitted()}
                fallback={
                    <div class="text-center max-w-sm">
                        <h1 class="text-[2.4rem] font-bold mb-4">Organization Created</h1>
                        <p class="text-text-muted font-light tracking-wide leading-relaxed mb-4">
                            Your organization has been created successfully.
                        </p>
                        <a href="/admin/dashboard" class="text-accent hover:underline">
                            Go to Dashboard
                        </a>
                    </div>
                }
            >
                <form class="w-full max-w-120 flex flex-col gap-5" onSubmit={onSubmit} novalidate>
                    <div class="mb-2">
                        <p class="font-mono text-[0.65rem] tracking-[0.25em] text-accent mb-1.5">
                            NEW ORGANIZATION
                        </p>
                        <h1 class="text-[2.8rem] font-bold leading-none tracking-tight">
                            Create Organization
                        </h1>
                    </div>

                    {/* Organization name */}
                    <Field
                        label="ORGANIZATION NAME"
                        value={form.name}
                        onInput={(v) => updateField('name', v)}
                        onBlur={() => blurField('name')}
                        error={errors.name}
                        autoComplete="organization"
                        disabled={isSubmitting()}
                        placeholder="Ex: Tracient"
                    />

                    {/* CSV upload */}
                    <div class="flex flex-col gap-1">
                        <label class="font-mono text-sm text-text-muted">MEMBERS CSV</label>

                        {/* Hidden real file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            class="hidden"
                            onChange={onFileChange}
                            disabled={isSubmitting()}
                        />

                        <Show
                            when={csvFile()}
                            fallback={
                                /* Upload trigger button */
                                <button
                                    type="button"
                                    onClick={() => fileInputRef?.click()}
                                    disabled={isSubmitting()}
                                    class={`
                                        flex items-center gap-3 w-full px-3 py-2.5
                                        border border-dashed rounded-sm transition-colors
                                        font-mono text-sm
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        ${errors.csv
                                            ? 'border-error text-error'
                                            : 'border-border-col text-text-muted hover:border-accent hover:text-accent'
                                        }
                                    `}
                                >
                                    <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <path d="M8 10V3M5 6l3-3 3 3" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M2 11v1.5A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5V11" stroke-linecap="round"/>
                                    </svg>
                                    <span>Upload members CSV</span>
                                </button>
                            }
                        >
                            {/* File selected — show filename + clear button */}
                            <div class="flex items-center justify-between gap-3 w-full px-3 py-2.5 border border-border-col rounded-sm">
                                <div class="flex items-center gap-2 min-w-0">
                                    <svg class="w-4 h-4 shrink-0 text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="2" y="1" width="12" height="14" rx="1.5"/>
                                        <path d="M5 6h6M5 9h6M5 12h3" stroke-linecap="round"/>
                                    </svg>
                                    <span class="font-mono text-sm text-text truncate">{csvFile()!.name}</span>
                                    <span class="font-mono text-xs text-text-muted shrink-0">
                                        ({(csvFile()!.size / 1024).toFixed(1)} KB)
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearFile}
                                    disabled={isSubmitting()}
                                    class="text-text-muted hover:text-error transition-colors shrink-0 disabled:opacity-50"
                                    aria-label="Remove file"
                                >
                                    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/>
                                    </svg>
                                </button>
                            </div>
                        </Show>

                        <Show when={errors.csv}>
                            <p class="font-mono text-xs text-error">{errors.csv}</p>
                        </Show>
                    </div>

                    {/* Submit error */}
                    <Show when={errors.submit}>
                        <p class="font-mono text-[0.65rem] tracking-wide text-error text-center px-3 py-2 bg-error/10 border border-error/25 rounded-sm">
                            {errors.submit}
                        </p>
                    </Show>

                    {/* Submit button */}
                    <button
                        class="mt-2 h-13 bg-accent hover:bg-accent-hover hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed font-mono text-[0.75rem] font-bold tracking-[0.2em] text-text rounded-sm transition-all duration-150 flex items-center justify-center cursor-pointer"
                        type="submit"
                        disabled={isSubmitting()}
                    >
                        <Show when={isSubmitting()} fallback={<span>CREATE ORGANIZATION</span>}>
                            <span class="w-4.5 h-4.5 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                        </Show>
                    </button>

                    <p class="font-mono text-xs text-text-muted text-center">
                        <a href="/admin/dashboard" class="text-accent hover:underline">
                            Back to Dashboard
                        </a>
                    </p>
                </form>
            </Show>
        </div>
    );
};

// ── page ──────────────────────────────────────────────────────────────────────

const CreateOrganizationPage: Component = () => (
    <div class="flex flex-col min-h-screen font-sans bg-bg text-text">
        <HeaderCard />
        <CreateOrganizationBody />
    </div>
);

export default CreateOrganizationPage;