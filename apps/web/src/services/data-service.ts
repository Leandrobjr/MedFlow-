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
  allergies?: string;
  medications?: string;
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
    allergies?: string;
    medications?: string;
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
  staffProcedures?: Array<{
    procedureId: string;
    procedure?: Procedure;
  }>;
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
  
  getProcedures: async (id: string) => {
    const response = await api.get<Procedure[]>(`/staff/${id}/procedures`);
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

export interface Procedure {
  id: string;
  name: string;
  grossAmount: number;
  observations?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const procedureService = {
  getAll: async () => {
    const response = await api.get<Procedure[]>('/procedures');
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get<Procedure>(`/procedures/${id}`);
    return response.data;
  },
  
  create: async (data: {
    name: string;
    grossAmount: number;
    observations?: string;
  }) => {
    const response = await api.post<Procedure>('/procedures', data);
    return response.data;
  },
  
  update: async (id: string, data: Partial<{
    name: string;
    grossAmount: number;
    observations?: string;
  }>) => {
    const response = await api.patch<Procedure>(`/procedures/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/procedures/${id}`);
  }
};

export interface Supplier {
  id: string;
  name: string;
  contactInfo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const supplierService = {
  getAll: async () => {
    const response = await api.get<Supplier[]>('/suppliers');
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get<Supplier>(`/suppliers/${id}`);
    return response.data;
  },
  
  create: async (data: {
    name: string;
    contactInfo?: string;
  }) => {
    const response = await api.post<Supplier>('/suppliers', data);
    return response.data;
  },
  
  update: async (id: string, data: Partial<{
    name: string;
    contactInfo?: string;
  }>) => {
    const response = await api.patch<Supplier>(`/suppliers/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/suppliers/${id}`);
  }
};

