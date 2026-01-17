import { api } from '@/lib/api';

export const reportsService = {
  downloadDailyClosureReport: async (closureId: string) => {
    const response = await api.get(`/reports/daily-closure/${closureId}`, {
      responseType: 'blob',
    });
    // Criar link de download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fechamento-caixa-${closureId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadBillingReport: async (params: {
    startDate: string;
    endDate: string;
    procedureId?: string;
    staffId?: string;
    patientId?: string;
  }) => {
    const response = await api.get('/reports/billing', {
      params,
      responseType: 'blob',
    });
    // Criar link de download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `faturamento-${params.startDate}-${params.endDate}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadMedicalFeeReport: async (paymentId: string) => {
    const response = await api.get(`/reports/medical-fee/${paymentId}`, {
      responseType: 'blob',
    });
    // Criar link de download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `repasse-medico-${paymentId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadPendingMedicalFeeReport: async (staffId: string, startDate: string, endDate: string) => {
    const response = await api.get('/reports/medical-fee-pending', {
      params: { staffId, startDate, endDate },
      responseType: 'blob',
    });
    // Criar link de download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `repasse-pendente-${staffId}-${startDate}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Retorna apenas o Blob para uso com impressão direta
  getPendingMedicalFeeReportBlob: async (staffId: string, startDate: string, endDate: string): Promise<Blob> => {
    const response = await api.get('/reports/medical-fee-pending', {
      params: { staffId, startDate, endDate },
      responseType: 'blob',
    });
    return new Blob([response.data], { type: 'application/pdf' });
  },

  getMedicalFeeReportBlob: async (paymentId: string): Promise<Blob> => {
    const response = await api.get(`/reports/medical-fee/${paymentId}`, {
      responseType: 'blob',
    });
    return new Blob([response.data], { type: 'application/pdf' });
  },

  downloadExpenseReport: async (params: {
    startDate: string;
    endDate: string;
    categoryId?: string;
  }) => {
    const response = await api.get('/reports/expenses', {
      params,
      responseType: 'blob',
    });
    // Criar link de download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `saidas-${params.startDate}-${params.endDate}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadClosuresReport: async (params: {
    startDate: string;
    endDate: string;
    userId?: string;
  }) => {
    const response = await api.get('/reports/closures', {
      params,
      responseType: 'blob',
    });
    // Criar link de download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fechamentos-caixa-${params.startDate}-${params.endDate}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Helper para imprimir PDF
  printReport: async (blob: Blob) => {
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    // Limpar após 1 minuto
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  },

  // Helper para salvar PDF
  saveReport: async (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Obter blob do relatório de fechamento de caixa
  getDailyClosureReportBlob: async (closureId: string): Promise<Blob> => {
    const response = await api.get(`/reports/daily-closure/${closureId}`, {
      responseType: 'blob',
    });
    return new Blob([response.data], { type: 'application/pdf' });
  },
};
