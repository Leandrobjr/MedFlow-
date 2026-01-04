import { api } from '@/lib/api';

export interface Patient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cpf: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const patientService = {
  getAll: async () => {
    const response = await api.get<Patient[]>('/patients');
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get<Patient>(`/patients/${id}`);
    return response.data;
  },
  
  create: async (data: {
    name: string;
    cpf: string;
    phone: string;
    email?: string;
    birthDate: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }) => {
    const response = await api.post<Patient>('/patients', data);
    return response.data;
  },
  
  update: async (id: string, data: Partial<{
    name: string;
    email?: string;
    phone: string;
    birthDate: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }>) => {
    const response = await api.patch<Patient>(`/patients/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/patients/${id}`);
  }
};

export interface Staff {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  specialty?: string;
  crm?: string;
  crmState?: string;
  rqe?: string;
  rqeState?: string;
  commissionType?: string;
  commissionRate?: number;
  fixedCommission?: number;
  userId?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export const staffService = {
  getAll: async (role?: string) => {
    const response = await api.get<Staff[]>('/staff', { params: { role } });
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get<Staff>(`/staff/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post<Staff>('/staff', data);
    return response.data;
  },
  
  update: async (id: string, data: any) => {
    const response = await api.patch<Staff>(`/staff/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/staff/${id}`);
  }
};

