import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, CreateClosureDto, TransactionType } from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createTransaction(tenantId: string, dto: CreateTransactionDto) {
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

    const transaction = await this.prisma.client.transaction.create({
      data: {
        ...dto,
        tenantId,
      },
      include: {
        patient: { select: { name: true } },
        appointment: true,
      },
    });

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

    const totalPending = fees.reduce((acc, fee) => acc + Number(fee.feeAmount), 0);

    return {
      doctorId,
      pendingFeesCount: fees.length,
      totalPendingAmount: totalPending,
    };
  }

  async getDailyTransactions(tenantId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.client.transaction.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        patient: { select: { name: true } },
        appointment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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

    transactions.forEach((t) => {
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
}

