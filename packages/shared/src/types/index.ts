// Shared TypeScript types for MedFlow
export type TenantId = string;
export type UserId = string;

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  RECEPTIONIST = 'receptionist',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
}
