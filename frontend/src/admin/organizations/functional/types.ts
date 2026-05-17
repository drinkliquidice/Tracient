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
    assets: string[]
}

export interface OrganizationAssetData {
    id: string
    name: string
    quantity: number
    endpoint: string
    checkOutTime: Date | null
    checkInTime: Date | null
    checkedOut: boolean
}

export interface OrganizationInterfaceData {
    name: string
    id: string
    users: OrganizationMemberData[]
    assets: OrganizationAssetData[]
}

export interface AddMemberFormData {
    name: string;
    orgId: string;
    contactName: string;
    contactNumber: string;
    useContact: boolean;
}

export interface AddAssetFormData {
    name: string;
    orgId: string;
    quantity: number;
}

export interface OrganizationMemberEditForm {
    orgId: string
    id: string
    name: string
    contactName: string
    contactNumber: string
    useContact: boolean
    signInTime: Date | null
    signOutTime: Date | null
    lastSignIn: Date | null
    endpoint: string
    delete_user: boolean
}

export interface OrganizationAssetEditForm {
    orgId: string
    id: string
    name: string
    quantity: number
    deleteAsset: boolean
}

export interface SignInResponse {
    member: string;
    action: string;
    timestamp: string;
}

export const inputBase = `
	w-full bg-surface border rounded-sm px-6 py-7
	text-text outline-none
	transition-all duration-150
	disabled:opacity-45 disabled:cursor-not-allowed
	focus:border-accent
`;