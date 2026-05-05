import { Component, createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import '@/index.css';

import {
    LoginForm,
    LoginErrors,
    InputProps,
    inputBase,
} from '@/admin/functional/types';
import { backendRequest, saveToken} from '@/functional/utils';

import showPasswordIcon from '@/admin/components/eye.svg';
import hidePasswordIcon from '@/admin/components/noEye.svg';
import { useNavigate } from '@solidjs/router';

const SideBrandCard: Component = () => (
    <div class="w-80 h-screen bg-accent overflow-hidden hidden md:flex flex-col">
        <div class="relative flex-1 flex flex-col justify-between py-10 overflow-hidden">

            {/* Logo — top */}
            <div class="flex items-center gap-3 text-text z-10" style={{ "padding-left": "0.5rem" }}>
                <span class="font-mono font-bold text-[1.1rem] tracking-[0.2em]">TRACIENT</span>
            </div>

            {/* Tagline — middle */}
            <p class="z-10 text-center text-[3.2rem] font-bold leading-none text-text">
                ADMIN<br/>PORTAL
            </p>

            {/* Copyright — bottom */}
            <div class="z-10">
                <div class="h-px bg-text/15 mb-4" />
                <p class="font-mono text-[0.6rem] tracking-[0.15em] text-text/30" style={{ "padding-left": "0.5rem" }}>
                    TRACIENT © 2026
                </p>
            </div>

            {/* Dot grid */}
            <div class="absolute inset-0 grid grid-cols-8 p-5 gap-5 opacity-[0.18] pointer-events-none" aria-hidden="true">
                {Array.from({ length: 64 }).map((_, i) => (
                    <div
                        class="w-0.75 h-0.75 rounded-full bg-text self-center justify-self-center animate-pulse"
                        style={{ 'animation-delay': `${(i * 0.07) % 3}s` }}
                    />
                ))}
            </div>
        </div>
    </div>
);

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
            style={{ padding: "2px 2px" }}
            type={props.type ?? 'text'}
            value={props.value}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            onBlur={props.onBlur}
            autocomplete={props.autoComplete}
            disabled={props.disabled}
            spellcheck={false}
        />
        <Show when={props.error}>
            <p class="font-mono text-xs text-error">{props.error}</p>
        </Show>
    </div>
);


const FormCard: Component = () => {
    const navigate = useNavigate();
    const [form, setForm] = createStore<LoginForm>({ username: '', password: '' });
    const [errors, setErrors] = createStore<LoginErrors>({});
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [showPass, setShowPass] = createSignal(false);

    const updateField = (field: keyof LoginForm, value: string) => setForm(field, value);
    const blurField = (field: keyof LoginForm) => {
        if (field === 'username' && !form.username) setErrors('username', 'Username is required');
        if (field === 'password' && !form.password) setErrors('password', 'Password is required');
    };

    const onSubmit = async (e: Event) => {
        e.preventDefault();
        
        if (!form.username) return setErrors('username', 'Username is required');
        if (!form.password) return setErrors('password', 'Password is required');

        setIsSubmitting(true);
        setErrors({ username: undefined, password: undefined, submit: undefined });
        try {
            const res = await backendRequest<{ token: string }>(
                'POST', '/api/admin/login', null,
                { username: form.username, password: form.password }
            );
            console.log('Login response:', res);
            console.log('Token:', res.token);
            saveToken(res.token);
            console.log('localStorage after save:', localStorage.getItem('token'));
            navigate('/admin/dashboard');
        } catch (err: unknown) {
            console.log('Login error:', err);  // add this
            setErrors('submit', err instanceof Error ? err.message : 'Invalid username or password');
            setErrors('submit', err instanceof Error ? err.message : 'Invalid username or password');
        } finally {
            setIsSubmitting(false);
        }
    };

    const passwordInputClass = (hasError: boolean) => `
        ${inputBase} pr-10 font-mono text-sm
        ${hasError ? 'border-error' : 'border-border-col'}
    `;

    return (
        <div class="flex-1 flex items-center justify-center px-6 py-12">
            <form class="w-full max-w-120 flex flex-col gap-5" onSubmit={onSubmit} novalidate>

                <div class="mb-2">
                    <p class="font-mono text-[0.65rem] tracking-[0.25em] text-accent mb-1.5">
                        ADMINISTRATOR LOGIN
                    </p>
                    <h1 class="text-[2.8rem] font-bold leading-none tracking-tight">
                        Sign In
                    </h1>
                </div>

                {/* Username */}
                <Field
                    label="USERNAME"
                    value={form.username}
                    onInput={(v) => updateField('username', v.toLowerCase())}
                    onBlur={() => blurField('username')}
                    error={errors.username}
                    autoComplete="username"
                    disabled={isSubmitting()}
                    mono
                />

                {/* Password */}
                <div class="flex flex-col gap-1.5">
                    <label class="font-mono text-sm text-text-muted">PASSWORD</label>
                    <div class="relative flex">
                        <input
                            class={passwordInputClass(!!errors.password)}
                            style={{ padding: "2px 2px" }}
                            type={showPass() ? 'text' : 'password'}
                            value={form.password}
                            onInput={(e) => updateField('password', e.currentTarget.value)}
                            onBlur={() => blurField('password')}
                            autocomplete="current-password"
                            disabled={isSubmitting()}
                        />
                        <button
                            type="button"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent text-md transition-colors"
                            onClick={() => setShowPass((v) => !v)}
                            tabIndex={-1}
                            aria-label="Toggle password visibility"
                        >
                            <img src={showPass() ? showPasswordIcon : hidePasswordIcon} alt="" class="w-4 h-4" />
                        </button>
                    </div>
                    <Show when={errors.password}>
                        <p class="font-mono text-xs text-error">{errors.password}</p>
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
                    <Show when={isSubmitting()} fallback={<span>SIGN IN</span>}>
                        <span class="w-4.5 h-4.5 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                    </Show>
                </button>

                {/* Link to signup */}
                <p class="font-mono text-xs text-text-muted text-center">
                    Don't have an account?{' '}
                    <a href="/signup" class="text-accent hover:underline">Create one</a>
                </p>

            </form>
        </div>
    );
};

const LoginPage: Component = () => (
    <div class="flex min-h-screen font-sans bg-bg text-text">
        <SideBrandCard />
        <FormCard />
    </div>
);

export default LoginPage;