import { api } from '@/lib/api';

export interface Transaction {
  id: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'income' | 'expense';
  category: string;
  description?: string;
  paymentMethod?: string;
  method?: string;
  date: string;
  createdAt?: string;
  patient?: { name: string };
  appointment?: any;
}

export interface MedicalFee {
  id: string;
  transactionId?: string;
  staffId?: string;
  doctorId?: string;
  amount: number;
  feeAmount?: number;
  grossAmount: number;
  percentage?: number;
  commissionRate?: number;
  status?: string;
  staff?: { name: string; specialty?: string };
  doctor?: { name: string };
  transaction?: { description?: string; amount: number; createdAt: string };
}

export const financeService = {
  getTransactions: async (date?: string) => {
    const response = await api.get<Transaction[]>('/finance/transactions', { params: { date } });
    // Mapear dados do backend para formato esperado pelo frontend
    return response.data.map(t => ({
      ...t,
      type: (t.type === 'income' ? 'INCOME' : t.type === 'expense' ? 'EXPENSE' : t.type) as 'INCOME' | 'EXPENSE',
      paymentMethod: t.paymentMethod || t.method || 'N/A',
      date: t.date || t.createdAt || new Date().toISOString(),
    }));
  },

  createTransaction: async (data: {
    type: 'INCOME' | 'EXPENSE';
    category: string;
    amount: number;
    method?: string;
    description?: string;
    patientId?: string;
    appointmentId?: string;
    staffId?: string;
  }) => {
    // Converter tipo para formato do backend
    const payload = {
      ...data,
      type: data.type.toLowerCase() as 'income' | 'expense',
      method: data.method,
    };
    const response = await api.post<Transaction>('/finance/transactions', payload);
    const t = response.data;
    return {
      ...t,
      type: (t.type === 'income' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
      paymentMethod: t.paymentMethod || t.method || 'N/A',
      date: t.date || t.createdAt || new Date().toISOString(),
    };
  },

  getMedicalFees: async (params?: { doctorId?: string; startDate?: string; endDate?: string }) => {
    const response = await api.get<MedicalFee[]>('/finance/medical-fees', { params });
    // Mapear dados do backend
    return response.data.map(fee => ({
      ...fee,
      doctorId: fee.staffId || fee.doctorId,
      doctor: fee.staff ? { name: fee.staff.name } : fee.doctor,
      amount: fee.feeAmount || fee.amount,
      percentage: fee.commissionRate || fee.percentage,
    }));
  },

  getClosureStatus: async (date: string) => {
    const response = await api.get('/finance/closures/status', { params: { date } });
    return response.data;
  },

  closeDailyBox: async (data: { date: string; closedById: string; observations?: string }) => {
    const response = await api.post('/finance/closures', data);
    return response.data;
  }
};

