import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateScheduleConfigDto,
  UpdateScheduleConfigDto,
} from './dto/schedule-config.dto';
import {
  CreateScheduleBlockDto,
  UpdateScheduleBlockDto,
} from './dto/schedule-block.dto';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  // ========== Schedule Config ==========
  async createConfig(tenantId: string, dto: CreateScheduleConfigDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      // Verificar se o staff existe e pertence ao tenant
      const staff = await tx.staff.findFirst({
        where: { id: dto.staffId, tenantId },
      });

      if (!staff) {
        throw new NotFoundException('Profissional não encontrado');
      }

      // Verificar se já existe configuração
      const existing = await tx.scheduleConfig.findUnique({
        where: { staffId: dto.staffId },
      });

      if (existing) {
        throw new BadRequestException(
          'Já existe uma configuração de agenda para este profissional',
        );
      }

      const created = await tx.scheduleConfig.create({
        data: {
          staffId: dto.staffId,
          tenantId,
          defaultDuration: dto.defaultDuration,
          weeklySchedule: JSON.stringify(dto.weeklySchedule),
          isActive: dto.isActive ?? true,
        },
        include: {
          staff: { select: { id: true, name: true, specialty: true } },
        },
      });

      // Parsear weeklySchedule para retornar como objeto
      return {
        ...created,
        weeklySchedule: dto.weeklySchedule,
      };
    });
  }

  async getConfigByStaff(tenantId: string, staffId: string) {
    const config = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.scheduleConfig.findFirst({
        where: { staffId, tenantId },
        include: {
          staff: { select: { id: true, name: true, specialty: true } },
        },
      });
    });

    if (!config) {
      return null;
    }

    // Parsear weeklySchedule se for string
    let weeklySchedule: any = config.weeklySchedule;
    if (typeof weeklySchedule === 'string') {
      try {
        weeklySchedule = JSON.parse(weeklySchedule);
      } catch (e) {
        // Se falhar, retornar objeto vazio
        weeklySchedule = {};
      }
    }

    return {
      ...config,
      weeklySchedule,
    };
  }

  async updateConfig(
    tenantId: string,
    staffId: string,
    dto: UpdateScheduleConfigDto,
  ) {
    const existing = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.scheduleConfig.findFirst({
        where: { staffId, tenantId },
      });
    });

    if (!existing) {
      throw new NotFoundException('Configuração de agenda não encontrada');
    }

    const updateData: any = {};
    if (dto.defaultDuration !== undefined)
      updateData.defaultDuration = dto.defaultDuration;
    if (dto.weeklySchedule !== undefined)
      updateData.weeklySchedule = JSON.stringify(dto.weeklySchedule);
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.scheduleConfig.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          staff: { select: { id: true, name: true, specialty: true } },
        },
      });
    });

    // Parsear weeklySchedule se for string
    let weeklySchedule: any = updated.weeklySchedule;
    if (typeof weeklySchedule === 'string') {
      try {
        weeklySchedule = JSON.parse(weeklySchedule);
      } catch (e) {
        weeklySchedule = {};
      }
    }

    return {
      ...updated,
      weeklySchedule,
    };
  }

  // ========== Schedule Blocks ==========
  async createBlock(tenantId: string, dto: CreateScheduleBlockDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      // Verificar se o staff existe
      const staff = await tx.staff.findFirst({
        where: { id: dto.staffId, tenantId },
      });

      if (!staff) {
        throw new NotFoundException('Profissional não encontrado');
      }

      // Validar período - parsear como data local para evitar problemas de timezone
      const parseLocalDate = (dateStr: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      };

      const startDate = parseLocalDate(dto.startDate);
      const endDate = dto.endDate ? parseLocalDate(dto.endDate) : startDate;

      if (endDate < startDate) {
        throw new BadRequestException(
          'Data de término deve ser após a data de início',
        );
      }

      // Para blockType = "period", validar horários
      if (dto.blockType === 'period') {
        if (!dto.startTime || !dto.endTime) {
          throw new BadRequestException(
            'Horários são obrigatórios para bloqueios de período',
          );
        }
      }

      return tx.scheduleBlock.create({
        data: {
          staffId: dto.staffId,
          tenantId,
          blockType: dto.blockType,
          startDate: startDate,
          endDate: dto.endDate ? endDate : null,
          startTime: dto.startTime || null,
          endTime: dto.endTime || null,
          reason: dto.reason || null,
          isRecurring: dto.isRecurring ?? false,
        },
        include: {
          staff: { select: { id: true, name: true } },
        },
      });
    });
  }

  async getBlocksByStaff(
    tenantId: string,
    staffId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = { staffId, tenantId };

    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    if (startDate || endDate) {
      where.OR = [];
      if (startDate) {
        const start = parseLocalDate(startDate);
        where.OR.push({
          startDate: { gte: start },
        });
      }
      if (endDate) {
        const end = parseLocalDate(endDate);
        where.OR.push({
          endDate: { lte: end },
        });
        where.OR.push({
          AND: [{ startDate: { lte: end } }, { endDate: null }],
        });
      }
    }

    return this.prisma.withTenant(tenantId, async (tx) => {
      return tx.scheduleBlock.findMany({
        where,
        orderBy: { startDate: 'asc' },
        include: {
          staff: { select: { id: true, name: true } },
        },
      });
    });
  }

  async updateBlock(
    tenantId: string,
    blockId: string,
    dto: UpdateScheduleBlockDto,
  ) {
    const existing = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.scheduleBlock.findFirst({
        where: { id: blockId, tenantId },
      });
    });

    if (!existing) {
      throw new NotFoundException('Bloqueio não encontrado');
    }

    // Função helper para parsear data como local
    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const updateData: any = {};
    if (dto.blockType !== undefined) updateData.blockType = dto.blockType;
    if (dto.startDate !== undefined)
      updateData.startDate = parseLocalDate(dto.startDate);
    if (dto.endDate !== undefined)
      updateData.endDate = dto.endDate ? parseLocalDate(dto.endDate) : null;
    if (dto.startTime !== undefined)
      updateData.startTime = dto.startTime || null;
    if (dto.endTime !== undefined) updateData.endTime = dto.endTime || null;
    if (dto.reason !== undefined) updateData.reason = dto.reason || null;
    if (dto.isRecurring !== undefined) updateData.isRecurring = dto.isRecurring;

    return this.prisma.withTenant(tenantId, async (tx) => {
      return tx.scheduleBlock.update({
        where: { id: blockId },
        data: updateData,
        include: {
          staff: { select: { id: true, name: true } },
        },
      });
    });
  }

  async deleteBlock(tenantId: string, blockId: string) {
    const existing = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.scheduleBlock.findFirst({
        where: { id: blockId, tenantId },
      });
    });

    if (!existing) {
      throw new NotFoundException('Bloqueio não encontrado');
    }

    return this.prisma.withTenant(tenantId, async (tx) => {
      return tx.scheduleBlock.delete({
        where: { id: blockId },
      });
    });
  }
}
