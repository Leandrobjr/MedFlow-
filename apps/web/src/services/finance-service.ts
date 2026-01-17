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
  appointment?: {
    patient?: { name: string; cpf?: string };
    procedure?: { name: string; grossAmount: number };
  };
  payment?: {
    id: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
    paidAt: string;
  };
}

export interface MedicalFeePayment {
  id: string;
  staffId: string;
  staff: { name: string; specialty?: string; crm?: string };
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  feesCount: number;
  paidAt: string;
  paidBy: string;
  paidByUser?: { name: string };
  paymentMethod?: string;
  observations?: string;
  fees?: MedicalFee[];
}

export const financeService = {
  getTransactions: async (date?: string, createdById?: string) => {
    const response = await api.get<Transaction[]>('/finance/transactions', { params: { date, createdById } });
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
    categoryId?: string;
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

  updateTransaction: async (id: string, data: {
    category?: string;
    categoryId?: string;
    amount?: number;
    method?: string;
    description?: string;
  }) => {
    const response = await api.put<Transaction>(`/finance/transactions/${id}`, data);
    const t = response.data;
    return {
      ...t,
      type: (t.type === 'income' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
      paymentMethod: t.paymentMethod || t.method || 'N/A',
      date: t.date || t.createdAt || new Date().toISOString(),
      description: t.description,
    };
  },

  getMedicalFees: async (params?: { doctorId?: string; startDate?: string; endDate?: string; status?: string }) => {
    const response = await api.get<MedicalFee[]>('/finance/medical-fees', { params });
    // Mapear dados do backend
    return response.data.map(fee => {
      // Converter Decimals do Prisma (vêm como string no JSON) para números
      const feeAmount = fee.feeAmount ? parseFloat(String(fee.feeAmount)) : 0;
      const grossAmount = fee.grossAmount ? parseFloat(String(fee.grossAmount)) : 0;
      
      return {
        ...fee,
        doctorId: fee.staffId || fee.doctorId,
        doctor: fee.staff ? { name: fee.staff.name } : fee.doctor,
        // Garantir que feeAmount seja sempre numérico e seja o valor do repasse
        feeAmount: !isNaN(feeAmount) ? feeAmount : 0,
        amount: !isNaN(feeAmount) ? feeAmount : 0, // amount também deve ser feeAmount (valor do repasse)
        grossAmount: !isNaN(grossAmount) ? grossAmount : 0,
        percentage: fee.commissionRate || fee.percentage,
      };
    });
  },

  getMedicalFeePayments: async (params?: { staffId?: string; startDate?: string; endDate?: string }) => {
    const response = await api.get<MedicalFeePayment[]>('/finance/medical-fees/payments', { params });
    return response.data;
  },

  closeMedicalFeePayment: async (data: {
    staffId: string;
    periodStart: string;
    periodEnd: string;
    paymentMethod?: string;
    observations?: string;
  }) => {
    const response = await api.post<MedicalFeePayment>('/finance/medical-fees/close', data);
    return response.data;
  },

  downloadMedicalFeeReport: async (paymentId: string) => {
    // Usar reportsService para manter consistência
    const { reportsService } = await import('./reports-service');
    return reportsService.downloadMedicalFeeReport(paymentId);
  },

  closeDailyBox: async (data: { date: string; closedById: string; observations?: string }) => {
    const response = await api.post('/finance/closures', data);
    return response.data;
  },

  closeReceptionistBox: async (data: {
    date: string;
    initialBalance: number;
    finalBalance: number;
    cashCount?: number;
    cardCount?: number;
    pixCount?: number;
    observations?: string;
  }) => {
    const response = await api.post('/finance/boxes/receptionist/close', data);
    return response.data;
  },

  closeAdminBox: async (data: {
    date: string;
    initialBalance: number;
    finalBalance: number;
    cashCount?: number;
    cardCount?: number;
    pixCount?: number;
    observations?: string;
  }) => {
    const response = await api.post('/finance/boxes/admin/close', data);
    return response.data;
  },

  getBoxStatus: async (date: string, userId?: string) => {
    const response = await api.get('/finance/boxes/status', { params: { date, userId } });
    return response.data;
  },

  getClosureStatus: async (date: string, userId?: string, closureType?: string) => {
    const response = await api.get('/finance/closures/status', { params: { date, userId, closureType } });
    return response.data;
  },

  checkAppointmentBilling: async (appointmentId: string) => {
    const response = await api.get(`/finance/transactions/check-appointment/${appointmentId}`);
    return response.data;
  },

  getDailyClosures: async (params?: { startDate?: string; endDate?: string; userId?: string; closureType?: string }) => {
    const response = await api.get('/finance/closures', { params });
    return response.data;
  },

  getClosurePreview: async (date: string, closureType?: string) => {
    const response = await api.get('/finance/closures/preview', { params: { date, closureType } });
    return response.data;
  },

  diagnoseMedicalFees: async () => {
    const response = await api.get('/finance/medical-fees/diagnose');
    return response.data;
  },

  recreateMissingMedicalFees: async (startDate?: string, endDate?: string) => {
    const response = await api.post('/finance/medical-fees/recreate-missing', null, { 
      params: { startDate, endDate } 
    });
    return response.data;
  },

  // Diagnóstico profundo da Dra Lais
  diagnoseDeepDraLais: async () => {
    const response = await api.get('/finance/medical-fees/diagnose-deep');
    return response.data;
  },

  // Corrigir staffIds das transações
  fixTransactionStaffIds: async () => {
    const response = await api.post('/finance/medical-fees/fix-staff-ids');
    return response.data;
  },

  // Corrigir repasses da Dra Lais
  fixDraLaisFees: async () => {
    const response = await api.post('/finance/medical-fees/fix-lais');
    return response.data;
  },
};

