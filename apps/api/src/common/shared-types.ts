// Tipos compartilhados localmente para o Backend (MVP)

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
  name: string;
  role: UserRole;
  tenantId: string;
}

export const API_VERSION = 'v1';

