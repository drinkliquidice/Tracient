import { Component, createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';

import '@/index.css';
import { 
	FormState,
	FormErrors,
	InputProps,
	inputBase,
} from './functional/types';
import { backendRequest } from '@/functional/utils';
import showPasswordIcon from '@/admin/components/eye.svg'
import hidePasswordIcon from '@/admin/components/noEye.svg'

async function createNewAdmin(form: FormState): Promise<void> {
		await backendRequest('POST', '/api/admin/signup', null, {
				first_name: form.firstName,
				last_name: form.lastName,
				username: form.username,
				password: form.password,
		});
}

function validateField(field: keyof FormState, form: FormState): string | undefined {
	switch (field) {
		case 'firstName':
			if (!form.firstName.trim()) return 'First name is required';
			if (form.firstName.length > 50) return 'Max 50 characters';
			break;
		case 'lastName':
			if (!form.lastName.trim()) return 'Last name is required';
			if (form.lastName.length > 50) return 'Max 50 characters';
			break;
		case 'username':
			if (!form.username.trim()) return 'Username is required';
			if (form.username.length < 3) return 'At least 3 characters';
			if (!/^[a-z0-9_.-]+$/.test(form.username)) return 'Lowercase letters, numbers, _ . - only';
			break;
		case 'password':
			if (!form.password) return 'Password is required';
			if (form.password.length < 8) return 'At least 8 characters';
			break;
		case 'passwordCheck':
			if (form.password !== form.passwordCheck) return 'Passwords do not match';
			break;
	}
	return undefined;
}

function validateAll(form: FormState): FormErrors {
	const fields: (keyof FormState)[] = ['firstName', 'lastName', 'username', 'password', 'passwordCheck'];
	return Object.fromEntries(
		fields
			.map((f) => [f, validateField(f, form)] as const)
			.filter(([, e]) => e)
	);
}

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

const FormCard: Component = () => {
	const [form, setForm] = createStore<FormState>({
		firstName: '',
		lastName: '',
		username: '',
		password: '',
		passwordCheck: '',
	});
	const [errors, setErrors] = createStore<FormErrors>({});
	const [isSubmitting, setIsSubmitting] = createSignal(false);
	const [isSubmitted, setIsSubmitted] = createSignal(false);
	const [showPass, setShowPass] = createSignal(false);
	const [showPassCheck, setShowPassCheck] = createSignal(false);

	const updateField = (field: keyof FormState, value: string) => setForm(field, value);
	const blurField = (field: keyof FormState) => setErrors(field, validateField(field, form));

	const onSubmit = async (e: Event) => {
		e.preventDefault();
		const errs = validateAll(form);
		setErrors(errs as FormErrors);
		if (Object.keys(errs).length > 0) return;
		setIsSubmitting(true);
		setErrors('submit', undefined);
		try {
			await createNewAdmin(form);
			setIsSubmitted(true);
		} catch (err: unknown) {
			setErrors('submit', err instanceof Error ? err.message : 'Unexpected error');
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
			<Show
				when={!isSubmitted()}
				fallback={
					<div class="text-center max-w-sm"> 
						<h1 class="text-[2.4rem] font-bold mb-4">Account Created</h1>
						<p class="text-text-muted font-light tracking-wide leading-relaxed">
							Your admin account has been created successfully. 	
						</p>
						<a href="/login" class="text-accent hover:underline">Sign In</a>
					</div>
				}
			>
				<form class="w-full max-w-120 flex flex-col gap-5" onSubmit={onSubmit} novalidate>
					<div class="mb-2">
						<p class="font-mono text-[0.65rem] tracking-[0.25em] text-accent mb-1.5">
							NEW ADMINISTRATOR
						</p>
						<h1 class="text-[2.8rem] font-bold leading-none tracking-tight">
							Create Account
						</h1>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<Field
							label="FIRST NAME"
							value={form.firstName}
							onInput={(v) => updateField('firstName', v)}
							onBlur={() => blurField('firstName')}
							error={errors.firstName}
							autoComplete="given-name"
							disabled={isSubmitting()}
						/>
						<Field
							label="LAST NAME"
							value={form.lastName}
							onInput={(v) => updateField('lastName', v)}
							onBlur={() => blurField('lastName')}
							error={errors.lastName}
							autoComplete="family-name"
							disabled={isSubmitting()}
						/>
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
								autocomplete="new-password"
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

					{/* Confirm password */}
					<div class="flex flex-col gap-1.5">
						<label class="font-mono text-sm text-text-muted">CONFIRM PASSWORD</label>
						<div class="relative flex">
							<input
								class={passwordInputClass(!!errors.passwordCheck)}
								style={{ padding: "2px 2px" }}
								type={showPassCheck() ? 'text' : 'password'}
								value={form.passwordCheck}
								onInput={(e) => updateField('passwordCheck', e.currentTarget.value)}
								onBlur={() => blurField('passwordCheck')}
								autocomplete="new-password"
								disabled={isSubmitting()}
							/>
							<button
								type="button"
								class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent text-md transition-colors"
								onClick={() => setShowPassCheck((v) => !v)}
								tabIndex={-1}
								aria-label="Toggle confirm password visibility"
							>
								<img src={showPassCheck() ? showPasswordIcon : hidePasswordIcon} alt="" class="w-4 h-4" />
							</button>
						</div>
						<Show when={errors.passwordCheck}>
							<p class="font-mono text-xs text-error">{errors.passwordCheck}</p>
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
						<Show when={isSubmitting()} fallback={<span>CREATE ACCOUNT</span>}>
							<span class="w-4.5 h-4.5 border-2 border-text/20 border-t-text rounded-full animate-spin" />
						</Show>
					</button>

					{/* Link to signup */}
					<p class="font-mono text-xs text-text-muted text-center">
						Already have an account?{' '}
						<a href="/login" class="text-accent hover:underline">Sign In</a>
					</p>


				</form>
			</Show>
		</div>
	)

};

const SignupPage = () => {

	return (
		<div class="flex min-h-screen font-sans bg-bg text-text">
			<SideBrandCard/>
			<FormCard/>
		</div>
	);
};

export default SignupPage;