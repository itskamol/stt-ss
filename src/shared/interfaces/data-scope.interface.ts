export interface DataScope {
    organizationId: string;
    branchIds?: string[];
}

export interface UserContext {
    sub: string;
    email: string;
    organizationId?: string;
    branchIds?: string[];
    roles: string[];
    permissions: string[];
}
