import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createAppointmentDto: CreateAppointmentDto) {
    const { patientId, staffId, startTime, endTime, procedureId } = createAppointmentDto;
    const start = new Date(startTime);
    const end = new Date(endTime);

    // 1. Validar se o horário de término é após o de início
    if (end <= start) {
      throw new BadRequestException('O horário de término deve ser após o início.');
    }

    // 2. Validar procedureId
    const procedure = await this.prisma.client.procedure.findUnique({
      where: { id: procedureId },
    });

    if (!procedure || procedure.tenantId !== tenantId) {
      throw new BadRequestException('Procedimento não encontrado ou não pertence a este tenant.');
    }

    // 3. Validar se procedimento está vinculado ao profissional
    const staffProcedure = await this.prisma.client.staffProcedure.findUnique({
      where: {
        staffId_procedureId: {
          staffId,
          procedureId,
        },
      },
    });

    if (!staffProcedure) {
      throw new BadRequestException('Este procedimento não está vinculado ao profissional selecionado.');
    }

    // 4. Usar nome do procedimento como type
    createAppointmentDto.type = procedure.name;

    // 5. Verificar conflitos de agenda para o mesmo médico
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

    // 6. Criar agendamento
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
        procedure: { select: { id: true, name: true, grossAmount: true } },
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
        procedure: { select: { id: true, name: true, grossAmount: true } },
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
        procedure: { select: { id: true, name: true, grossAmount: true } },
      },
    });
  }

  async updateStatus(
    tenantId: string, 
    id: string, 
    status: string,
    userRole?: string,
    userStaffId?: string,
  ) {
    // Validar status permitidos
    const allowedStatuses = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'canceled'];
    const normalizedStatus = status.toLowerCase();
    
    if (!allowedStatuses.includes(normalizedStatus)) {
      throw new BadRequestException(`Status inválido. Valores permitidos: ${allowedStatuses.join(', ')}`);
    }

    // Buscar agendamento para validações
    const appointment = await this.prisma.client.appointment.findFirst({
      where: { id, tenantId },
      select: { staffId: true, status: true },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    // Validações específicas para RECEPTIONIST
    if (userRole === 'receptionist' || userRole === 'RECEPTIONIST') {
      // RECEPTIONIST NÃO pode iniciar atendimento (in_progress)
      if (normalizedStatus === 'in_progress') {
        throw new ForbiddenException('Apenas médicos podem iniciar atendimentos.');
      }
      // RECEPTIONIST também não pode finalizar (completed)
      if (normalizedStatus === 'completed') {
        throw new ForbiddenException('Apenas médicos podem finalizar atendimentos.');
      }
    }

    // Validações específicas para DOCTOR
    if (userRole === 'doctor' || userRole === 'DOCTOR') {
      // DOCTOR precisa ter staffId vinculado
      if (!userStaffId) {
        throw new ForbiddenException('Usuário médico não possui vínculo com profissional. Entre em contato com o administrador.');
      }

      // DOCTOR só pode atualizar seus próprios agendamentos
      if (appointment.staffId !== userStaffId) {
        throw new ForbiddenException('Você só pode atualizar status dos seus próprios agendamentos.');
      }

      // DOCTOR só pode atualizar para in_progress ou completed
      if (normalizedStatus !== 'in_progress' && normalizedStatus !== 'completed') {
        throw new ForbiddenException('Médicos só podem iniciar (in_progress) ou finalizar (completed) atendimentos.');
      }
    }

    return this.prisma.client.appointment.update({
      where: { id, tenantId },
      data: { status: normalizedStatus },
      include: {
        patient: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
        procedure: { select: { id: true, name: true, grossAmount: true } },
      },
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


