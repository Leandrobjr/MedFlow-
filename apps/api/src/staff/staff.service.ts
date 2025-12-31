import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createStaffDto: CreateStaffDto) {
    // Preparar dados, convertendo valores numéricos para Decimal quando necessário
    const data: any = {
      name: createStaffDto.name,
      email: createStaffDto.email && createStaffDto.email.trim() ? createStaffDto.email.trim() : null,
      phone: createStaffDto.phone && createStaffDto.phone.trim() ? createStaffDto.phone.trim() : null,
      role: createStaffDto.role,
      specialty: createStaffDto.specialty && createStaffDto.specialty.trim() ? createStaffDto.specialty.trim() : null,
      crm: createStaffDto.crm && createStaffDto.crm.trim() ? createStaffDto.crm.trim() : null,
      crmState: createStaffDto.crmState && createStaffDto.crmState.trim() ? createStaffDto.crmState.trim() : null,
      rqe: createStaffDto.rqe && createStaffDto.rqe.trim() ? createStaffDto.rqe.trim() : null,
      rqeState: createStaffDto.rqeState && createStaffDto.rqeState.trim() ? createStaffDto.rqeState.trim() : null,
      commissionType: createStaffDto.commissionType || 'PERCENTAGE',
      tenantId,
    };

    // Tratar valores de comissão baseado no tipo
    // Apenas profissionais de saúde têm regras de repasse
    const isHealthProfessional = ['DOCTOR', 'PHYSIOTHERAPIST', 'NUTRITIONIST', 'PSYCHOLOGIST', 'DENTIST', 'SPEECH_THERAPIST'].includes(createStaffDto.role);
    
    if (isHealthProfessional) {
      if (createStaffDto.commissionType === 'FIXED') {
        data.fixedCommission = createStaffDto.fixedCommission && Number(createStaffDto.fixedCommission) > 0 
          ? Number(createStaffDto.fixedCommission) 
          : 0;
        data.commissionRate = 0;
      } else {
        data.commissionRate = createStaffDto.commissionRate && Number(createStaffDto.commissionRate) > 0 
          ? Number(createStaffDto.commissionRate) 
          : 0;
        data.fixedCommission = 0;
      }
    } else {
      // Para não-profissionais de saúde, não há comissão
      data.commissionRate = 0;
      data.fixedCommission = 0;
    }

    // Remover userId se não for fornecido
    if (createStaffDto.userId) {
      data.userId = createStaffDto.userId;
    }

    return this.prisma.client.staff.create({
      data,
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.client.staff.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.client.staff.findFirst({
      where: { id, tenantId },
      include: { user: true },
    });
  }

  async update(tenantId: string, id: string, updateStaffDto: any) {
    return this.prisma.client.staff.update({
      where: { id, tenantId },
      data: updateStaffDto,
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.client.staff.delete({
      where: { id, tenantId },
    });
  }
}


