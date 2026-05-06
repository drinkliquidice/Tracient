export interface OrganizationMemberData {
    id: string
    name: string
    contactName: string
    contactNumber: string
    useContact: boolean
    signInTime: Date | null
    signOutTime: Date | null
    lastSignIn: Date | null
    endpoint: string
}

export interface OrganizationInterfaceData {
    name: string
    id: string
    users: OrganizationMemberData[]
}

export interface AddMemberFormData {
    name: string;
    orgId: string;
    contactName: string;
    contactNumber: string;
    useContact: boolean;
}

export const inputBase = `
	w-full bg-surface border rounded-sm px-6 py-7
	text-text outline-none
	transition-all duration-150
	disabled:opacity-45 disabled:cursor-not-allowed
	focus:border-accent
`;