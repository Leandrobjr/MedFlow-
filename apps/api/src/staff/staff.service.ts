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
    const { password, createAccount, ...staffData } = updateStaffDto;
    
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

    return this.prisma.client.staff.update({
      where: { id, tenantId },
      data: {
        ...staffData,
        userId,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.client.staff.delete({
      where: { id, tenantId },
    });
  }
}


