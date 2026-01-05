import { api } from '@/lib/api';

export interface Appointment {
  id: string;
  patientId: string;
  staffId: string;
  doctorId?: string; // Alias para staffId para compatibilidade
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'canceled' | 'completed' | 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'CANCELED' | 'COMPLETED' | 'NOSHOW';
  type?: string; // Tipo de consulta/procedimento
  observations?: string;
  notes?: string; // Alias para observations
  patient: {
    id?: string;
    name: string;
    phone?: string;
  };
  staff?: {
    id: string;
    name: string;
    specialty?: string;
  };
  doctor?: {
    name: string;
  }; // Alias para staff para compatibilidade
}

export const appointmentService = {
  getAll: async (params?: { doctorId?: string; date?: string }) => {
    const response = await api.get<Appointment[]>('/appointments', { params });
    // Mapear dados do backend para formato esperado pelo frontend
    return response.data.map(apt => ({
      ...apt,
      doctorId: apt.staffId || apt.doctorId,
      doctor: apt.staff ? { name: apt.staff.name } : apt.doctor,
      notes: apt.observations || apt.notes,
      status: apt.status.toUpperCase() as any,
    }));
  },

  create: async (data: {
    patientId: string;
    staffId: string;
    startTime: string;
    endTime: string;
    observations?: string;
  }) => {
    const response = await api.post<Appointment>('/appointments', data);
    // Mapear resposta
    const apt = response.data;
    return {
      ...apt,
      doctorId: apt.staffId || apt.doctorId,
      doctor: apt.staff ? { name: apt.staff.name } : apt.doctor,
      notes: apt.observations || apt.notes,
      status: apt.status.toUpperCase() as any,
    };
  },

  updateStatus: async (id: string, status: string) => {
    const response = await api.patch<Appointment>(`/appointments/${id}/status`, { status });
    const apt = response.data;
    return {
      ...apt,
      doctorId: apt.staffId || apt.doctorId,
      doctor: apt.staff ? { name: apt.staff.name } : apt.doctor,
      notes: apt.observations || apt.notes,
      status: apt.status.toUpperCase() as any,
    };
  },

  delete: async (id: string) => {
    await api.delete(`/appointments/${id}`);
  },
};

