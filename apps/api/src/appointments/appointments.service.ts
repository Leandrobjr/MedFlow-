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
        status: { not: 'cancelled' },
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

  async findAll(tenantId: string, doctorId?: string, date?: string) {
    const where: any = { tenantId };
    
    if (doctorId) {
      where.staffId = doctorId;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    return this.prisma.client.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true, specialty: true } },
      },
      orderBy: { startTime: 'asc' },
    });
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
    return this.prisma.client.appointment.update({
      where: { id, tenantId },
      data: { status },
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

