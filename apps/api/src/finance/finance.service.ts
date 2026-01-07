import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, CreateClosureDto, TransactionType } from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createTransaction(tenantId: string, dto: CreateTransactionDto, userId?: string) {
    // 1. Verificar se o caixa do dia já foi fechado
    const today = new Date();
    const closure = await this.prisma.client.dailyClosure.findFirst({
      where: {
        tenantId,
        date: today,
      },
    });

    if (closure) {
      throw new BadRequestException('O caixa deste dia já foi fechado. Não é possível realizar novas transações.');
    }

    // 2. Validações se tiver appointmentId
    if (dto.appointmentId) {
      // Verificar se já existe transação para este appointment
      const existing = await this.prisma.client.transaction.findUnique({
        where: { appointmentId: dto.appointmentId },
      });

      if (existing) {
        throw new BadRequestException('Este agendamento já foi faturado.');
      }

      // Verificar se o appointment existe e pertence ao tenant
      const appointment = await this.prisma.client.appointment.findUnique({
        where: { id: dto.appointmentId },
      });

      if (!appointment || appointment.tenantId !== tenantId) {
        throw new NotFoundException('Agendamento não encontrado ou não pertence a este tenant.');
      }

      // Se não foi passado staffId, usar o do appointment
      if (!dto.staffId && appointment.staffId) {
        dto.staffId = appointment.staffId;
      }

      // Se não foi passado patientId, usar o do appointment
      if (!dto.patientId && appointment.patientId) {
        dto.patientId = appointment.patientId;
      }
    }

    console.log(`[FinanceService] Criando transação:`, {
      type: dto.type,
      amount: dto.amount,
      description: dto.description,
      appointmentId: dto.appointmentId,
    });

    const transaction = await this.prisma.client.transaction.create({
      data: {
        ...dto,
        tenantId,
        createdById: userId || null,
      },
      include: {
        patient: { select: { name: true } },
        appointment: {
          include: {
            patient: { select: { name: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    console.log(`[FinanceService] Transação criada:`, {
      id: transaction.id,
      description: transaction.description,
      appointment: transaction.appointment ? {
        id: transaction.appointment.id,
        patient: transaction.appointment.patient?.name,
      } : null,
    });

    // Atualizar status do appointment para "AGUARDANDO" (confirmed) quando pagamento é efetuado
    if (dto.appointmentId && dto.type === TransactionType.INCOME) {
      try {
        await this.prisma.client.appointment.update({
          where: { id: dto.appointmentId },
          data: { status: 'confirmed' },
        });
      } catch (error) {
        // Log do erro mas não falha a criação da transação
        console.error(`Erro ao atualizar status do appointment ${dto.appointmentId}:`, error);
      }
    }

    // Lógica de Repasse Médico (M1-07)
    // Se for uma entrada de consulta e tiver um médico vinculado
    if (dto.type === TransactionType.INCOME && dto.staffId) {
      const doctor = await this.prisma.client.staff.findUnique({
        where: { id: dto.staffId },
      });

      if (doctor && doctor.commissionRate && Number(doctor.commissionRate) > 0) {
        const commissionRate = Number(doctor.commissionRate);
        const grossAmount = Number(dto.amount);
        const feeAmount = (grossAmount * commissionRate) / 100;

        await this.prisma.client.medicalFee.create({
          data: {
            tenantId,
            staffId: dto.staffId,
            transactionId: transaction.id,
            grossAmount,
            commissionRate,
            feeAmount,
            status: 'pending',
          },
        });
      }
    }

    return transaction;
  }

  async getMedicalFees(tenantId: string, doctorId?: string, startDate?: string, endDate?: string) {
    const where: any = { tenantId };
    
    if (doctorId) {
      where.staffId = doctorId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    return this.prisma.client.medicalFee.findMany({
      where,
      include: {
        staff: { select: { name: true, specialty: true } },
        transaction: { select: { description: true, amount: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMedicalFeeSummary(tenantId: string, doctorId: string) {
    const fees = await this.prisma.client.medicalFee.findMany({
      where: {
        tenantId,
        staffId: doctorId,
        status: 'pending',
      },
    });

    const totalPending = fees.reduce((acc: number, fee: any) => acc + Number(fee.feeAmount), 0);

    return {
      doctorId,
      pendingFeesCount: fees.length,
      totalPendingAmount: totalPending,
    };
  }

  async getDailyTransactions(tenantId: string, date?: string, createdById?: string) {
    // Parse da data considerando timezone local
    let targetDate: Date;
    if (date) {
      // Se a data vem como 'yyyy-MM-dd', criar Date no timezone local
      const [year, month, day] = date.split('-').map(Number);
      targetDate = new Date(year, month - 1, day);
    } else {
      targetDate = new Date();
    }
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`[FinanceService] Buscando transações para tenant ${tenantId}, data: ${date || 'hoje'}`);
    console.log(`[FinanceService] Range: ${startOfDay.toISOString()} até ${endOfDay.toISOString()}`);

    const where: any = {
      tenantId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    // Filtrar por recepcionista se fornecido
    if (createdById) {
      where.createdById = createdById;
      console.log(`[FinanceService] Filtrando por recepcionista: ${createdById}`);
    }

    const transactions = await this.prisma.client.transaction.findMany({
      where,
      include: {
        patient: { select: { name: true } },
        appointment: {
          include: {
            patient: { select: { name: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[FinanceService] Encontradas ${transactions.length} transações`);
    // Log para debug: verificar se description está vindo
    if (transactions.length > 0) {
      console.log(`[FinanceService] Primeira transação:`, {
        id: transactions[0].id,
        description: transactions[0].description,
        appointment: transactions[0].appointment ? {
          id: transactions[0].appointment.id,
          patient: transactions[0].appointment.patient?.name,
        } : null,
      });
    }
    return transactions;
  }

  async closeDailyBox(tenantId: string, dto: CreateClosureDto) {
    const targetDate = new Date(dto.date);
    targetDate.setHours(0, 0, 0, 0);

    // 1. Verificar se já existe fechamento
    const existing = await this.prisma.client.dailyClosure.findUnique({
      where: {
        tenantId_date: {
          tenantId,
          date: targetDate,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('O caixa deste dia já está fechado.');
    }

    // 2. Calcular totais do dia
    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.client.transaction.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: 'completed',
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((t: any) => {
      if (t.type === TransactionType.INCOME) {
        totalIncome += Number(t.amount);
      } else {
        totalExpense += Number(t.amount);
      }
    });

    return this.prisma.client.dailyClosure.create({
      data: {
        tenantId,
        date: targetDate,
        closedById: dto.closedById,
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        observations: dto.observations,
      },
    });
  }

  async getClosureStatus(tenantId: string, date: string) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return this.prisma.client.dailyClosure.findUnique({
      where: {
        tenantId_date: {
          tenantId,
          date: targetDate,
        },
      },
    });
  }

  async checkAppointmentBilling(tenantId: string, appointmentId: string) {
    // Verificar se já existe transação para este appointment
    const existingTransaction = await this.prisma.client.transaction.findUnique({
      where: { appointmentId },
      select: { id: true, amount: true, createdAt: true, method: true },
    });

    // Buscar dados do appointment com procedure
    const appointment = await this.prisma.client.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
        procedure: { select: { id: true, name: true, grossAmount: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    if (appointment.tenantId !== tenantId) {
      throw new NotFoundException('Agendamento não pertence a este tenant.');
    }

    if (!appointment.procedure) {
      throw new BadRequestException('Agendamento não possui procedimento vinculado.');
    }

    const procedure = appointment.procedure;

    return {
      appointment: {
        id: appointment.id,
        patient: appointment.patient,
        staff: appointment.staff,
        type: appointment.type,
        procedureName: procedure.name,
        startTime: appointment.startTime,
        status: appointment.status,
      },
      alreadyBilled: !!existingTransaction,
      existingTransaction: existingTransaction || null,
      suggestedAmount: Number(procedure.grossAmount),
      procedure: {
        id: procedure.id,
        name: procedure.name,
        grossAmount: Number(procedure.grossAmount),
      },
    };
  }
}

