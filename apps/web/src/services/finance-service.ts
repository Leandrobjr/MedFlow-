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
    console.log('Resposta do backend:', response.data?.length || 0, 'transações para data:', date);
    // Mapear dados do backend para formato esperado pelo frontend
    return (response.data || []).map(t => {
      // Debug: verificar o que está vindo
      console.log('Transação recebida:', {
        id: t.id,
        description: t.description,
        appointment: t.appointment,
        patient: t.patient,
      });

      // Criar descrição com fallback
      let description = t.description;
      if (!description && t.appointment?.patient?.name) {
        const procedureName = t.appointment.type || t.category || 'Consulta';
        description = `${procedureName} - ${t.appointment.patient.name}`;
      } else if (!description && t.patient?.name) {
        description = `${t.category || 'Consulta'} - ${t.patient.name}`;
      }

      return {
        ...t,
        type: (t.type === 'income' ? 'INCOME' : t.type === 'expense' ? 'EXPENSE' : t.type) as 'INCOME' | 'EXPENSE',
        paymentMethod: t.paymentMethod || t.method || 'N/A',
        date: t.date || t.createdAt || new Date().toISOString(),
        amount: Number(t.amount || 0), // Garantir que amount seja número
        description: description || undefined,
      };
    });
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
      description: data.description, // Garantir que description seja enviada
    };
    console.log('Payload enviado para backend:', payload);
    const response = await api.post<Transaction>('/finance/transactions', payload);
    const t = response.data;
    console.log('Resposta do backend:', t);
    return {
      ...t,
      type: (t.type === 'income' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
      paymentMethod: t.paymentMethod || t.method || 'N/A',
      date: t.date || t.createdAt || new Date().toISOString(),
      description: t.description, // Preservar description
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
  },

  checkAppointmentBilling: async (appointmentId: string) => {
    const response = await api.get(`/finance/transactions/check-appointment/${appointmentId}`);
    return response.data;
  }
};

