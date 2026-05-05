export interface FormState {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  passwordCheck: string;
}

export interface FormErrors {
  firstName?: string;
  lastName?: string;
  username?: string;
  password?: string;
  passwordCheck?: string;
  submit?: string;
}

export interface LoginForm {
    username: string;
    password: string;
}

export interface LoginErrors {
    username?: string;
    password?: string;
    submit?: string;
}

export interface InputProps {
	label: string;
	value: string;
	onInput: (v: string) => void;
	onBlur: () => void;
	error?: string;
	type?: string;
	autoComplete?: string;
	disabled?: boolean;
	mono?: boolean;
}

export const inputBase = `
	w-full bg-surface border rounded-sm px-6 py-7
	text-text outline-none
	transition-all duration-150
	disabled:opacity-45 disabled:cursor-not-allowed
	focus:border-accent
`;