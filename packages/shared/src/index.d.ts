export type TenantId = string;
export type UserId = string;
export declare enum UserRole {
    OWNER = "owner",
    ADMIN = "admin",
    DOCTOR = "doctor",
    RECEPTIONIST = "receptionist"
}
export declare enum UserStatus {
    ACTIVE = "active",
    INACTIVE = "inactive"
}
export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
    tenantId: string;
}
export declare const API_VERSION = "v1";
