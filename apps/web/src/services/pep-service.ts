import { api } from '@/lib/api';

export interface MedicalAddendum {
  id: string;
  content: string;
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  appointmentId?: string;
  patientId: string;
  staffId: string;
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  anamnesis?: string;
  physicalExam?: string;
  diagnosis?: string;
  prescription?: string;
  conduct?: string;
  isFinalized: boolean;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
  staff?: { name: string; specialty?: string };
  doctor?: { name: string }; // Alias para staff
  addendums?: MedicalAddendum[];
}

export const pepService = {
  getByPatient: async (patientId: string) => {
    const response = await api.get<MedicalRecord[]>(`/pep/patient/${patientId}`);
    // Mapear dados do backend para formato esperado pelo frontend
    return response.data.map(record => ({
      ...record,
      doctor: record.staff ? { name: record.staff.name } : record.doctor,
    }));
  },

  getById: async (id: string) => {
    const response = await api.get<MedicalRecord>(`/pep/${id}`);
    const record = response.data;
    return {
      ...record,
      doctor: record.staff ? { name: record.staff.name } : record.doctor,
    };
  },

  create: async (data: {
    appointmentId: string;
    patientId: string;
    staffId: string;
    soapSubjective?: string;
    soapObjective?: string;
    soapAssessment?: string;
    soapPlan?: string;
    anamnesis?: string;
    physicalExam?: string;
    diagnosis?: string;
    prescription?: string;
    conduct?: string;
  }) => {
    const response = await api.post<MedicalRecord>('/pep', data);
    const record = response.data;
    return {
      ...record,
      doctor: record.staff ? { name: record.staff.name } : record.doctor,
    };
  },

  update: async (id: string, data: {
    soapSubjective?: string;
    soapObjective?: string;
    soapAssessment?: string;
    soapPlan?: string;
    anamnesis?: string;
    physicalExam?: string;
    diagnosis?: string;
    prescription?: string;
    conduct?: string;
  }) => {
    const response = await api.patch<MedicalRecord>(`/pep/${id}`, data);
    const record = response.data;
    return {
      ...record,
      doctor: record.staff ? { name: record.staff.name } : record.doctor,
    };
  },

  finalize: async (id: string) => {
    const response = await api.post<MedicalRecord>(`/pep/${id}/finalize`);
    const record = response.data;
    return {
      ...record,
      doctor: record.staff ? { name: record.staff.name } : record.doctor,
    };
  },

  addAddendum: async (id: string, content: string) => {
    const response = await api.post<MedicalAddendum>(`/pep/${id}/addendum`, { content });
    return response.data;
  }
};

