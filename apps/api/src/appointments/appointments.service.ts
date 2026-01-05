import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createAppointmentDto: CreateAppointmentDto) {
    const { patientId, staffId, startTime, endTime } = createAppointmentDto;
    const start = new Date(startTime);
    const end = new Date(endTime);

    // 1. Validar se o horário de término é após o de início
    if (end <= start) {
      throw new BadRequestException('O horário de término deve ser após o início.');
    }

    // 2. Verificar conflitos de agenda para o mesmo médico
    const conflict = await this.prisma.client.appointment.findFirst({
      where: {
        tenantId,
        staffId,
        status: { notIn: ['cancelled', 'canceled'] },
        OR: [
          {
            startTime: { lt: end },
            endTime: { gt: start },
          },
        ],
      },
    });

    if (conflict) {
      throw new BadRequestException('O médico já possui um agendamento neste horário.');
    }

    // 3. Criar agendamento
    return this.prisma.client.appointment.create({
      data: {
        ...createAppointmentDto,
        startTime: start,
        endTime: end,
        tenantId,
      },
      include: {
        patient: { select: { name: true } },
        staff: { select: { name: true, specialty: true } },
      },
    });
  }

  async findAll(tenantId: string, doctorId?: string, date?: string, startDate?: string, endDate?: string) {
    const where: any = { tenantId };
    
    if (doctorId) {
      where.staffId = doctorId;
    }

    // Prioridade: date > (startDate + endDate)
    if (date) {
      // Garantir que a data seja interpretada como local (não UTC)
      // Se date vem como "yyyy-MM-dd", criar data local corretamente
      const [year, month, day] = date.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      
      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (startDate || endDate) {
      where.startTime = {};
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.startTime.gte = start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startTime.lte = end;
      }
    }

    return this.prisma.client.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true, specialty: true } },
      },
      orderBy: { startTime: 'asc' },
    }).then(appointments => appointments.map(apt => ({
      ...apt,
      type: apt.type || 'consultation', // Garantir que type sempre existe
    })));
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.client.appointment.findFirst({
      where: { id, tenantId },
      include: {
        patient: true,
        staff: true,
      },
    });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    // Validar status permitidos
    const allowedStatuses = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'canceled'];
    const normalizedStatus = status.toLowerCase();
    
    if (!allowedStatuses.includes(normalizedStatus)) {
      throw new BadRequestException(`Status inválido. Valores permitidos: ${allowedStatuses.join(', ')}`);
    }

    return this.prisma.client.appointment.update({
      where: { id, tenantId },
      data: { status: normalizedStatus },
    });
  }

  async remove(tenantId: string, id: string) {
    // Em agendas médicas, geralmente não deletamos, apenas cancelamos.
    // Mas para o MVP vamos permitir o delete físico se necessário.
    return this.prisma.client.appointment.delete({
      where: { id, tenantId },
    });
  }
}


