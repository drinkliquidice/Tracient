export interface MemberContactData {
    name: string
    email: string
    contactNumber: string
}

export interface OrganizationMemberData {
    id: string
    name: string
    contacts: MemberContactData[]
    useSms: boolean
    useEmail: boolean
    signInTime: Date | null
    signOutTime: Date | null
    lastSignIn: Date | null
    endpoint: string
    assets: string[]
}

export interface OrganizationAssetData {
    id: string
    name: string
    totalQuantity: number
    currentQuantity: number
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
    contacts: MemberContactData[];
    useSms: boolean;
    useEmail: boolean;
}

export interface AddAssetFormData {
    name: string;
    orgId: string;
    totalQuantity: number;
}

export interface OrganizationMemberEditForm {
    orgId: string
    id: string
    name: string
    contacts: MemberContactData[]
    useSms: boolean
    useEmail: boolean
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
    totalQuantity: number
    currentQuantity: number
    deleteAsset: boolean
}

export interface SignInResponse {
    member: string;
    action: string;
    timestamp: string;
}

export const emptyContact = (): MemberContactData => ({
    name: '',
    email: '',
    contactNumber: '',
});

export const inputBase = `
	w-full bg-surface border rounded-sm px-6 py-7
	text-text outline-none
	transition-all duration-150
	disabled:opacity-45 disabled:cursor-not-allowed
	focus:border-accent
`;
