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

    return this.prisma.client.transaction.create({
      data: {
        ...dto,
        tenantId,
      },
      include: {
        patient: { select: { name: true } },
        appointment: true,
      },
    });
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

