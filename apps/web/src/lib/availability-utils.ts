import { format, getDay, isSameDay, parseISO } from 'date-fns';
import { ScheduleConfig, ScheduleBlock, DayPeriod } from '@/services/schedule-service';
import { Appointment } from '@/services/appointment-service';

export interface AvailableSlot {
  start: string; // ISO string
  end: string; // ISO string
  staffId: string;
}

export interface DayAvailability {
  date: Date;
  staffId: string;
  slots: AvailableSlot[];
}

// Converter nome do dia para índice (0=domingo, 6=sábado)
const dayNameToIndex: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

// Converter índice do dia para nome
const dayIndexToName: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

// Converter horário HH:mm para minutos desde meia-noite
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Converter minutos desde meia-noite para HH:mm
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Verificar se uma data/hora está dentro de um bloqueio
function isTimeBlocked(
  dateTime: Date,
  blocks: ScheduleBlock[],
  staffId: string
): boolean {
  return blocks.some(block => {
    if (block.staffId !== staffId) return false;

    const blockStart = typeof block.startDate === 'string' 
      ? new Date(block.startDate) 
      : new Date(block.startDate);
    const blockEnd = block.endDate 
      ? (typeof block.endDate === 'string' ? new Date(block.endDate) : new Date(block.endDate))
      : blockStart;

    // Bloqueio de dia inteiro
    if (block.blockType === 'date') {
      const blockStartDay = new Date(blockStart);
      blockStartDay.setHours(0, 0, 0, 0);
      const blockEndDay = new Date(blockEnd);
      blockEndDay.setHours(23, 59, 59, 999);
      
      return dateTime >= blockStartDay && dateTime <= blockEndDay;
    }

    // Bloqueio de período
    if (block.blockType === 'period' && block.startTime && block.endTime) {
      const blockDateTimeStart = new Date(blockStart);
      const [startHours, startMinutes] = block.startTime.split(':').map(Number);
      blockDateTimeStart.setHours(startHours, startMinutes, 0, 0);

      const blockDateTimeEnd = new Date(blockStart);
      const [endHours, endMinutes] = block.endTime.split(':').map(Number);
      blockDateTimeEnd.setHours(endHours, endMinutes, 0, 0);

      // Se o bloqueio se estende por múltiplos dias
      if (blockEnd && !isSameDay(blockStart, blockEnd)) {
        const finalBlockEnd = new Date(blockEnd);
        finalBlockEnd.setHours(endHours, endMinutes, 0, 0);
        
        return dateTime >= blockDateTimeStart && dateTime <= finalBlockEnd;
      }

      return dateTime >= blockDateTimeStart && dateTime <= blockDateTimeEnd;
    }

    return false;
  });
}

// Verificar se uma data/hora está ocupada por um agendamento
function isTimeOccupied(
  dateTime: Date,
  duration: number,
  appointments: Appointment[],
  staffId: string
): boolean {
  const slotEnd = new Date(dateTime.getTime() + duration * 60000);

  return appointments.some(apt => {
    if (apt.doctorId !== staffId && apt.staffId !== staffId) return false;
    if (apt.status === 'CANCELED' || apt.status === 'canceled') return false;

    const aptStart = new Date(apt.startTime);
    const aptEnd = new Date(apt.endTime);

    // Verificar sobreposição
    return dateTime < aptEnd && slotEnd > aptStart;
  });
}

// Calcular slots disponíveis para um profissional em um dia específico
export function calculateAvailableSlots(
  date: Date,
  config: ScheduleConfig,
  blocks: ScheduleBlock[],
  appointments: Appointment[],
  duration?: number
): AvailableSlot[] {
  if (!config.isActive) return [];

  const dayIndex = getDay(date); // 0=domingo, 6=sábado
  const dayName = dayIndexToName[dayIndex];
  const daySchedule = config.weeklySchedule[dayName as keyof typeof config.weeklySchedule];

  if (!daySchedule || !daySchedule.enabled || !daySchedule.periods || daySchedule.periods.length === 0) {
    return [];
  }

  const appointmentDuration = duration || config.defaultDuration;
  const slots: AvailableSlot[] = [];

  // Processar cada período de trabalho do dia
  for (const period of daySchedule.periods) {
    const periodStartMinutes = timeToMinutes(period.start);
    const periodEndMinutes = timeToMinutes(period.end);

    // Gerar slots dentro deste período
    let currentMinutes = periodStartMinutes;

    while (currentMinutes + appointmentDuration <= periodEndMinutes) {
      const slotDate = new Date(date);
      slotDate.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);

      const slotEndDate = new Date(slotDate.getTime() + appointmentDuration * 60000);

      // Verificar se o slot não está bloqueado
      if (!isTimeBlocked(slotDate, blocks, config.staffId)) {
        // Verificar se o slot não está ocupado
        if (!isTimeOccupied(slotDate, appointmentDuration, appointments, config.staffId)) {
          slots.push({
            start: slotDate.toISOString(),
            end: slotEndDate.toISOString(),
            staffId: config.staffId,
          });
        }
      }

      // Avançar para o próximo slot (usar duração padrão como incremento)
      currentMinutes += appointmentDuration;
    }
  }

  return slots;
}

// Calcular disponibilidade para todos os profissionais em um dia
export function calculateDayAvailability(
  date: Date,
  configs: ScheduleConfig[],
  blocks: ScheduleBlock[],
  appointments: Appointment[]
): DayAvailability[] {
  const availability: DayAvailability[] = [];

  for (const config of configs) {
    const slots = calculateAvailableSlots(date, config, blocks, appointments);
    
    if (slots.length > 0) {
      availability.push({
        date,
        staffId: config.staffId,
        slots,
      });
    }
  }

  return availability;
}

// Calcular disponibilidade para um período (semana/mês)
export function calculatePeriodAvailability(
  startDate: Date,
  endDate: Date,
  configs: ScheduleConfig[],
  blocks: ScheduleBlock[],
  appointments: Appointment[]
): Map<string, DayAvailability[]> {
  const availabilityMap = new Map<string, DayAvailability[]>();
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayAvailability = calculateDayAvailability(currentDate, configs, blocks, appointments);
    
    for (const avail of dayAvailability) {
      const key = format(avail.date, 'yyyy-MM-dd');
      if (!availabilityMap.has(key)) {
        availabilityMap.set(key, []);
      }
      availabilityMap.get(key)!.push(avail);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return availabilityMap;
}
