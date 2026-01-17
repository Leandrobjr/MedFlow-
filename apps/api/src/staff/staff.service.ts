import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createStaffDto: CreateStaffDto) {
    // Se solicitado criar conta de usuário, validar e-mail e senha
    let userId: string | undefined = createStaffDto.userId;

    if (createStaffDto.createAccount) {
      if (!createStaffDto.email) {
        throw new BadRequestException('E-mail é obrigatório para criar uma conta de usuário');
      }
      if (!createStaffDto.password) {
        throw new BadRequestException('Senha é obrigatória para criar uma conta de usuário');
      }

      // Verificar se o e-mail já existe
      const existingUser = await this.prisma.client.user.findUnique({
        where: { email: createStaffDto.email },
      });

      if (existingUser) {
        throw new BadRequestException('Este e-mail já está sendo usado por outro usuário');
      }

      const hashedPassword = await bcrypt.hash(createStaffDto.password, 10);
      
      const user = await this.prisma.client.user.create({
        data: {
          email: createStaffDto.email,
          name: createStaffDto.name,
          password: hashedPassword,
          role: createStaffDto.role.toLowerCase(), // Simplificação do mapeamento de roles
          tenantId,
        },
      });

      userId = user.id;
    }

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
      userId,
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
    if (createStaffDto.userId && !createStaffDto.createAccount) {
      data.userId = createStaffDto.userId;
    }

    // Extrair procedureIds para gerenciar relacionamento
    const { procedureIds, ...staffCreateData } = data;

    // Criar staff com ou sem relacionamento de procedimentos
    const staff = await this.prisma.client.staff.create({
      data: {
        ...staffCreateData,
        staffProcedures: procedureIds && procedureIds.length > 0
          ? {
              create: procedureIds.map((procedureId: string) => ({
                procedureId,
              })),
            }
          : undefined,
      },
      include: {
        staffProcedures: {
          include: {
            procedure: true,
          },
        },
      },
    });

    return staff;
  }

  async findAll(tenantId: string, role?: string) {
    const where: any = { tenantId };
    
    // Filtrar por role se fornecido
    if (role) {
      // Se o role for 'DOCTOR', buscar staffs com role DOCTOR ou outros profissionais de saúde
      if (role.toUpperCase() === 'DOCTOR') {
        where.role = {
          in: ['DOCTOR', 'PHYSIOTHERAPIST', 'NUTRITIONIST', 'PSYCHOLOGIST', 'DENTIST', 'SPEECH_THERAPIST'],
        };
      } else {
        // Para outros roles, buscar exatamente o role informado (case-insensitive)
        where.role = {
          equals: role.toUpperCase(),
          mode: 'insensitive',
        };
      }
    }
    
    return this.prisma.client.staff.findMany({
      where,
      include: { 
        user: true,
        staffProcedures: {
          include: {
            procedure: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.client.staff.findFirst({
      where: { id, tenantId },
      include: { 
        user: true,
        staffProcedures: {
          include: {
            procedure: true,
          },
        },
      },
    });
  }

  async update(tenantId: string, id: string, updateStaffDto: any) {
    const { password, createAccount, procedureIds, ...staffData } = updateStaffDto;
    
    // Buscar staff atual
    const staff = await this.prisma.client.staff.findFirst({
      where: { id, tenantId },
      include: { user: true },
    });

    if (!staff) {
      throw new BadRequestException('Membro da equipe não encontrado');
    }

    let userId = staff.userId;

    // Se solicitado criar conta ou atualizar senha
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);

      if (staff.userId) {
        // Atualizar senha do usuário existente
        await this.prisma.client.user.update({
          where: { id: staff.userId },
          data: { password: hashedPassword },
        });
      } else if (createAccount) {
        // Criar novo usuário se não existir e createAccount for true
        if (!staff.email && !staffData.email) {
          throw new BadRequestException('E-mail é obrigatório para criar uma conta de usuário');
        }

        const email = staffData.email || staff.email;

        // Verificar se o e-mail já existe
        const existingUser = await this.prisma.client.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          throw new BadRequestException('Este e-mail já está sendo usado por outro usuário');
        }

        const user = await this.prisma.client.user.create({
          data: {
            email,
            name: staffData.name || staff.name,
            password: hashedPassword,
            role: (staffData.role || staff.role).toLowerCase(),
            tenantId,
          },
        });
        userId = user.id;
      }
    }

    // Gerenciar relacionamento de procedimentos se procedureIds foi fornecido
    if (procedureIds !== undefined) {
      // Remover todos os relacionamentos existentes
      await this.prisma.client.staffProcedure.deleteMany({
        where: { staffId: id },
      });

      // Criar novos relacionamentos se houver procedimentos
      if (procedureIds && procedureIds.length > 0) {
        await this.prisma.client.staffProcedure.createMany({
          data: procedureIds.map((procedureId: string) => ({
            staffId: id,
            procedureId,
          })),
        });
      }
    }

    return this.prisma.client.staff.update({
      where: { id, tenantId },
      data: {
        ...staffData,
        userId,
      },
      include: {
        user: true,
        staffProcedures: {
          include: {
            procedure: true,
          },
        },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.client.staff.delete({
      where: { id, tenantId },
    });
  }

  async getProcedures(tenantId: string, staffId: string) {
    // Verificar se o staff pertence ao tenant
    const staff = await this.prisma.client.staff.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!staff) {
      throw new BadRequestException('Profissional não encontrado ou não pertence a este tenant.');
    }

    // Buscar procedimentos vinculados ao profissional
    const staffProcedures = await this.prisma.client.staffProcedure.findMany({
      where: { 
        staffId,
        procedure: {
          tenantId,
        },
      },
      include: {
        procedure: {
          select: {
            id: true,
            name: true,
            grossAmount: true,
            observations: true,
          },
        },
      },
    });

    // Filtrar e mapear apenas procedimentos válidos
    return staffProcedures
      .filter(sp => sp.procedure !== null)
      .map(sp => ({
        id: sp.procedure!.id,
        name: sp.procedure!.name,
        grossAmount: Number(sp.procedure!.grossAmount),
        observations: sp.procedure!.observations || undefined,
      }));
  }
}


