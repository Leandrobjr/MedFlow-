import { api } from '@/lib/api';

export interface DayPeriod {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface DaySchedule {
  enabled: boolean;
  periods?: DayPeriod[];
}

export interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface ScheduleConfig {
  id: string;
  staffId: string;
  defaultDuration: number;
  weeklySchedule: WeeklySchedule;
  isActive: boolean;
  staff?: {
    id: string;
    name: string;
    specialty?: string;
  };
}

export interface ScheduleBlock {
  id: string;
  staffId: string;
  blockType: 'date' | 'period';
  startDate: string | Date; // Pode vir como string ISO ou Date
  endDate?: string | Date | null; // Pode vir como string ISO, Date ou null
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  isRecurring: boolean;
  staff?: {
    id: string;
    name: string;
  };
}

export const scheduleService = {
  // Config
  createConfig: async (data: {
    staffId: string;
    defaultDuration: number;
    weeklySchedule: WeeklySchedule;
    isActive?: boolean;
  }) => {
    const response = await api.post<ScheduleConfig>('/schedule/config', data);
    const config = response.data;
    return {
      ...config,
      weeklySchedule: typeof config.weeklySchedule === 'string' 
        ? JSON.parse(config.weeklySchedule) 
        : config.weeklySchedule,
    };
  },

  getConfigByStaff: async (staffId: string) => {
    const response = await api.get<ScheduleConfig>(`/schedule/config/staff/${staffId}`);
    const config = response.data;
    if (!config) return null;
    return {
      ...config,
      weeklySchedule: typeof config.weeklySchedule === 'string' 
        ? JSON.parse(config.weeklySchedule) 
        : config.weeklySchedule,
    };
  },

  updateConfig: async (staffId: string, data: {
    defaultDuration?: number;
    weeklySchedule?: WeeklySchedule;
    isActive?: boolean;
  }) => {
    const response = await api.patch<ScheduleConfig>(`/schedule/config/staff/${staffId}`, data);
    const config = response.data;
    return {
      ...config,
      weeklySchedule: typeof config.weeklySchedule === 'string' 
        ? JSON.parse(config.weeklySchedule) 
        : config.weeklySchedule,
    };
  },

  // Blocks
  createBlock: async (data: {
    staffId: string;
    blockType: 'date' | 'period';
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
    isRecurring?: boolean;
  }) => {
    const response = await api.post<ScheduleBlock>('/schedule/blocks', data);
    return response.data;
  },

  getBlocksByStaff: async (staffId: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await api.get<ScheduleBlock[]>(`/schedule/blocks/staff/${staffId}`, { params });
    return response.data;
  },

  updateBlock: async (blockId: string, data: {
    blockType?: 'date' | 'period';
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
    isRecurring?: boolean;
  }) => {
    const response = await api.patch<ScheduleBlock>(`/schedule/blocks/${blockId}`, data);
    return response.data;
  },

  deleteBlock: async (blockId: string) => {
    await api.delete(`/schedule/blocks/${blockId}`);
  },
};

