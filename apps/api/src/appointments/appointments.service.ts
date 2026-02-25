import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

type Role = 'admin' | 'owner' | 'receptionist' | 'doctor' | string;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeRole(role?: Role): string {
    return String(role ?? '').trim().toLowerCase();
  }

  private async resolveStaffIdByUserId(tx: any, tenantId: string, currentUserId?: string) {
    if (!currentUserId) return undefined;

    // IMPORTANTE:
    // Isso pressupõe que exista staff.userId no seu schema.
    // Se não existir, remova este fallback e garanta req.user.staffId no auth.
    const staff = await tx.staff.findFirst({
      where: { tenantId, userId: currentUserId },
      select: { id: true },
    });

    return staff?.id;
  }

  private async ensureDoctorStaffId(tx: any, tenantId: string, userStaffId?: string, currentUserId?: string) {
    if (userStaffId) return userStaffId;

    const resolved = await this.resolveStaffIdByUserId(tx, tenantId, currentUserId);
    if (!resolved) {
      throw new ForbiddenException(
        'Usuário médico não possui vínculo com profissional. Entre em contato com o administrador.',
      );
    }
    return resolved;
  }

  async create(tenantId: string, dto: CreateAppointmentDto) {
    const { startTime, endTime, staffId, patientId, procedureId } = dto;

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Datas inválidas.');
    }
    if (end <= start) {
      throw new BadRequestException('Horário final deve ser após o inicial.');
    }

    return this.prisma.withTenant(tenantId, async (tx) => {
      return tx.appointment.create({
        data: {
          tenantId,
          startTime: start,
          endTime: end,
          staffId,
          patientId,
          procedureId,
          status: 'scheduled',
        },
        include: {
          patient: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
          procedure: { select: { id: true, name: true, grossAmount: true } },
        },
      });
    });
  }

  async findAll(
    tenantId: string,
    doctorId?: string,
    date?: string,
    startDate?: string,
    endDate?: string,
    userRole?: Role,
    userStaffId?: string,
    currentUserId?: string,
  ) {
    const role = this.normalizeRole(userRole);

    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: any = { tenantId };

      // RBAC definitivo:
      // - doctor: força staffId do próprio médico (ignora doctorId)
      // - demais: pode filtrar por doctorId
      if (role === 'doctor') {
        const staffId = await this.ensureDoctorStaffId(tx, tenantId, userStaffId, currentUserId);
        where.staffId = staffId;
      } else if (doctorId) {
        where.staffId = doctorId;
      }

      if (date) {
        const start = new Date(`${date}T00:00:00.000`);
        const end = new Date(`${date}T23:59:59.999`);
        where.startTime = { gte: start, lte: end };
      } else if (startDate && endDate) {
        const start = new Date(`${startDate}T00:00:00.000`);
        const end = new Date(`${endDate}T23:59:59.999`);
        where.startTime = { gte: start, lte: end };
      }

      return tx.appointment.findMany({
        where,
        orderBy: { startTime: 'asc' },
        include: {
          patient: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
          procedure: { select: { id: true, name: true, grossAmount: true } },
        },
      });
    });
  }

  async findOne(
    tenantId: string,
    id: string,
    userRole?: Role,
    userStaffId?: string,
    currentUserId?: string,
  ) {
    const role = this.normalizeRole(userRole);

    return this.prisma.withTenant(tenantId, async (tx) => {
      const appt = await tx.appointment.findFirst({
        where: { id, tenantId },
        include: {
          patient: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
          procedure: { select: { id: true, name: true, grossAmount: true } },
        },
      });

      if (!appt) throw new NotFoundException('Agendamento não encontrado.');

      if (role === 'doctor') {
        const staffId = await this.ensureDoctorStaffId(tx, tenantId, userStaffId, currentUserId);
        if (appt.staffId !== staffId) {
          throw new ForbiddenException('Acesso negado ao agendamento.');
        }
      }

      return appt;
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateAppointmentStatusDto,
    userRole: Role,
    userStaffId?: string,
    currentUserId?: string,
  ) {
    const role = this.normalizeRole(userRole);
    const status = String(dto?.status ?? '').trim().toLowerCase();

    if (!status) throw new BadRequestException('Status é obrigatório.');

    // Mantém compatibilidade com seu DTO e com o sistema
    const allowed = ['scheduled', 'confirmed', 'in_progress', 'completed', 'canceled'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Status inválido. Permitidos: ${allowed.join(', ')}`);
    }

    return this.prisma.withTenant(tenantId, async (tx) => {
      const appt = await tx.appointment.findFirst({
        where: { id, tenantId },
        select: { id: true, staffId: true, status: true },
      });

      if (!appt) throw new NotFoundException('Agendamento não encontrado.');

      if (role === 'doctor') {
        const staffId = await this.ensureDoctorStaffId(tx, tenantId, userStaffId, currentUserId);

        if (appt.staffId !== staffId) {
          throw new ForbiddenException('Você só pode alterar status dos seus próprios agendamentos.');
        }

        // Médico só pode operar pipeline clínico
        if (!['in_progress', 'completed'].includes(status)) {
          throw new ForbiddenException(
            'Médico só pode iniciar (in_progress) ou finalizar (completed) atendimentos.',
          );
        }
      }

      return tx.appointment.update({
        where: { id, tenantId },
        data: { status },
        include: {
          patient: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
          procedure: { select: { id: true, name: true, grossAmount: true } },
        },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      return tx.appointment.delete({ where: { id, tenantId } });
    });
  }
}

