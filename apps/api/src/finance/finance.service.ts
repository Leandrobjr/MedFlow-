import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  CreateClosureDto,
  CloseReceptionistBoxDto,
  CloseAdminBoxDto,
  CloseMedicalFeePaymentDto,
  TransactionType,
} from './dto/finance.dto';
import { UserRole } from '../common/shared-types';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async createTransaction(
    tenantId: string,
    dto: CreateTransactionDto,
    userId?: string,
    userRole?: string,
  ) {
    // Usar tenantPrisma.run para garantir isolamento determinístico em todas as operações críticas
    return this.tenantPrisma.run(async (tx) => {
      // 1. Verificar se o caixa do recepcionista/admin já foi fechado
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Se for recepcionista, verificar se o caixa dele foi fechado
      if (userRole === UserRole.RECEPTIONIST && userId) {
        const closure = await tx.dailyClosure.findFirst({
          where: {
            tenantId,
            date: today,
            createdById: userId,
            closureType: 'RECEPTIONIST',
          },
        });

        if (closure) {
          throw new BadRequestException(
            'Seu caixa deste dia já foi fechado. Não é possível realizar novas transações.',
          );
        }
      }

      // Se for admin, verificar se o caixa administrativo foi fechado
      if (
        (userRole === UserRole.ADMIN || userRole === UserRole.OWNER) &&
        userId
      ) {
        const closure = await tx.dailyClosure.findFirst({
          where: {
            tenantId,
            date: today,
            createdById: userId,
            closureType: 'ADMIN',
          },
        });

        if (closure) {
          throw new BadRequestException(
            'O caixa administrativo deste dia já foi fechado. Não é possível realizar novas transações.',
          );
        }
      }

      // 2. Validações se tiver appointmentId
      if (dto.appointmentId) {
        // Verificar se já existe transação para este appointment
        const existing = await tx.transaction.findUnique({
          where: { appointmentId: dto.appointmentId },
        });

        if (existing) {
          throw new BadRequestException('Este agendamento já foi faturado.');
        }

        // Verificar se o appointment existe e pertence ao tenant
        const appointment = await tx.appointment.findUnique({
          where: { id: dto.appointmentId },
        });

        if (!appointment || appointment.tenantId !== tenantId) {
          throw new NotFoundException(
            'Agendamento não encontrado ou não pertence a este tenant.',
          );
        }

        // Verificar se o agendamento não está cancelado
        if (
          appointment.status === 'CANCELED' ||
          appointment.status === 'canceled'
        ) {
          throw new BadRequestException(
            'Não é possível faturar um agendamento cancelado.',
          );
        }

        console.log(
          `[FinanceService.createTransaction] DEBUG - Appointment encontrado:`,
          {
            appointmentId: appointment.id,
            appointmentStaffId: appointment.staffId,
            dtoStaffId: dto.staffId,
            staffIdsMatch: appointment.staffId === dto.staffId,
          },
        );

        // Se não foi passado staffId, usar o do appointment
        // IMPORTANTE: Sempre usar o staffId do appointment para garantir consistência
        if (appointment.staffId) {
          if (dto.staffId && dto.staffId !== appointment.staffId) {
            console.warn(
              `[FinanceService.createTransaction] DEBUG - staffId do DTO (${dto.staffId}) difere do appointment (${appointment.staffId}). Usando o do appointment.`,
            );
          }
          dto.staffId = appointment.staffId;
          console.log(
            `[FinanceService.createTransaction] DEBUG - staffId definido como: ${dto.staffId} (do appointment)`,
          );
        } else if (!dto.staffId) {
          console.warn(
            `[FinanceService.createTransaction] DEBUG - Appointment ${appointment.id} não possui staffId e DTO também não tem. Repasse não será criado.`,
          );
        }

        // Se não foi passado patientId, usar o do appointment
        if (!dto.patientId && appointment.patientId) {
          dto.patientId = appointment.patientId;
        }
      }

      // 3. Validação de categoryId (se for despesa)
      if (dto.type === TransactionType.EXPENSE && dto.categoryId) {
        const category = await tx.expenseCategory.findFirst({
          where: {
            id: dto.categoryId,
            tenantId,
            isActive: true,
          },
        });

        if (!category) {
          throw new NotFoundException(
            'Categoria de despesa não encontrada ou inativa.',
          );
        }
      }

      console.log(`[FinanceService] Criando transação:`, {
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        appointmentId: dto.appointmentId,
        categoryId: dto.categoryId,
      });

      // Criar transação dentro da transação com contexto de tenant
      const transaction = await tx.transaction.create({
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

      // Atualizar status do appointment para "AGUARDANDO" (confirmed) quando pagamento é efetuado
      if (dto.appointmentId && dto.type === TransactionType.INCOME) {
        try {
          await tx.appointment.update({
            where: { id: dto.appointmentId },
            data: { status: 'confirmed' },
          });
        } catch (error) {
          // Log do erro mas não falha a criação da transação
          console.error(
            `Erro ao atualizar status do appointment ${dto.appointmentId}:`,
            error,
          );
        }
      }

      console.log(`[FinanceService] Transação criada:`, {
        id: transaction.id,
        description: transaction.description,
        appointment: transaction.appointment
          ? {
              id: transaction.appointment.id,
              patient: transaction.appointment.patient?.name,
            }
          : null,
      });

      // Lógica de Repasse Médico (M1-07) - dentro da mesma transação
      // Se for uma entrada de consulta e tiver um médico vinculado
      console.log(
        `[FinanceService.createTransaction] DEBUG - Iniciando verificação de repasse:`,
        {
          type: dto.type,
          staffId: dto.staffId,
          appointmentId: dto.appointmentId,
          amount: dto.amount,
          description: dto.description,
        },
      );

      if (dto.type === TransactionType.INCOME && dto.staffId) {
        console.log(
          `[FinanceService.createTransaction] DEBUG - Condição atendida: INCOME com staffId`,
        );

        // Declarar appointmentWithRecord para uso posterior
        let appointmentWithRecord: any = null;

        // Se tiver appointmentId, verificar se o prontuário está finalizado
        if (dto.appointmentId) {
          console.log(
            `[FinanceService.createTransaction] DEBUG - Buscando appointment com medicalRecord: ${dto.appointmentId}`,
          );
          appointmentWithRecord = await tx.appointment.findUnique({
            where: { id: dto.appointmentId },
            include: {
              medicalRecord: {
                select: {
                  id: true,
                  isFinalized: true,
                },
              },
              staff: {
                select: {
                  id: true,
                  name: true,
                  commissionRate: true,
                  fixedCommission: true,
                  commissionType: true,
                  role: true,
                },
              },
            },
          });

          console.log(
            `[FinanceService.createTransaction] DEBUG - Appointment encontrado:`,
            {
              appointmentId: appointmentWithRecord?.id,
              appointmentStaffId: appointmentWithRecord?.staffId,
              appointmentStaffName: appointmentWithRecord?.staff?.name,
              appointmentStaffCommissionRate:
                appointmentWithRecord?.staff?.commissionRate,
              hasMedicalRecord: !!appointmentWithRecord?.medicalRecord,
              medicalRecordId: appointmentWithRecord?.medicalRecord?.id,
              isFinalized: appointmentWithRecord?.medicalRecord?.isFinalized,
              dtoStaffId: dto.staffId,
              staffIdsMatch: appointmentWithRecord?.staffId === dto.staffId,
            },
          );

          if (
            appointmentWithRecord?.medicalRecord &&
            !appointmentWithRecord.medicalRecord.isFinalized
          ) {
            console.warn(
              `[FinanceService.createTransaction] DEBUG - Prontuário não finalizado. Bloqueando criação de repasse.`,
            );
            throw new BadRequestException(
              'Não é possível gerar repasse para atendimento com prontuário não finalizado.',
            );
          }

          if (!appointmentWithRecord?.medicalRecord) {
            console.warn(
              `[FinanceService.createTransaction] DEBUG - Appointment ${dto.appointmentId} não possui prontuário. Repasse não será criado agora (será criado retroativamente quando o prontuário for finalizado).`,
            );
          }

          // Se o appointment tem staffId diferente do dto.staffId, usar o do appointment
          if (
            appointmentWithRecord?.staffId &&
            appointmentWithRecord.staffId !== dto.staffId
          ) {
            console.log(
              `[FinanceService.createTransaction] DEBUG - Corrigindo staffId: dto.staffId=${dto.staffId}, appointment.staffId=${appointmentWithRecord.staffId}`,
            );
            dto.staffId = appointmentWithRecord.staffId;
          }
        }

        console.log(
          `[FinanceService.createTransaction] DEBUG - Buscando médico com staffId: ${dto.staffId}`,
        );
        const doctor = await tx.staff.findUnique({
          where: { id: dto.staffId },
          select: {
            id: true,
            name: true,
            commissionRate: true,
            fixedCommission: true,
            commissionType: true,
            role: true,
          },
        });

        console.log(
          `[FinanceService.createTransaction] DEBUG - Médico encontrado:`,
          {
            id: doctor?.id,
            name: doctor?.name,
            commissionType: doctor?.commissionType,
            commissionRate: doctor?.commissionRate,
            fixedCommission: doctor?.fixedCommission,
            role: doctor?.role,
          },
        );

        if (!doctor) {
          console.error(
            `[FinanceService.createTransaction] DEBUG - ERRO: Médico não encontrado com staffId: ${dto.staffId}`,
          );
        } else {
          // Verificar se tem configuração de repasse válida
          const isPercentage = doctor.commissionType === 'PERCENTAGE';
          const isFixed = doctor.commissionType === 'FIXED';

          let feeAmount: number | null = null;
          let commissionRate: number | null = null;
          let fixedCommission: number | null = null;

          if (isPercentage) {
            if (!doctor.commissionRate || Number(doctor.commissionRate) <= 0) {
              console.warn(
                `[FinanceService.createTransaction] DEBUG - Repasse NÃO criado - médico "${doctor.name}" com tipo PERCENTAGE mas sem commissionRate ou commissionRate = 0 (valor: ${doctor.commissionRate})`,
              );
            } else {
              commissionRate = Number(doctor.commissionRate);
              const grossAmount = Number(dto.amount);
              feeAmount = (grossAmount * commissionRate) / 100;
            }
          } else if (isFixed) {
            if (
              !doctor.fixedCommission ||
              Number(doctor.fixedCommission) <= 0
            ) {
              console.warn(
                `[FinanceService.createTransaction] DEBUG - Repasse NÃO criado - médico "${doctor.name}" com tipo FIXED mas sem fixedCommission ou fixedCommission = 0 (valor: ${doctor.fixedCommission})`,
              );
            } else {
              fixedCommission = Number(doctor.fixedCommission);
              feeAmount = fixedCommission; // Valor fixo é o próprio feeAmount
              commissionRate = null; // Não usa percentual
            }
          } else {
            console.warn(
              `[FinanceService.createTransaction] DEBUG - Repasse NÃO criado - médico "${doctor.name}" com tipo de repasse inválido: ${doctor.commissionType}`,
            );
          }

          // Só criar repasse se tiver feeAmount válido E (não tiver appointmentId OU tiver appointmentId com prontuário finalizado)
          const shouldCreateFee =
            feeAmount !== null &&
            feeAmount > 0 &&
            (!dto.appointmentId ||
              appointmentWithRecord?.medicalRecord?.isFinalized === true);

          if (shouldCreateFee) {
            const grossAmount = Number(dto.amount);

            console.log(
              `[FinanceService.createTransaction] DEBUG - Criando repasse médico:`,
              {
                tenantId,
                staffId: dto.staffId,
                staffName: doctor.name,
                commissionType: doctor.commissionType,
                grossAmount,
                commissionRate,
                fixedCommission,
                feeAmount,
                appointmentId: dto.appointmentId,
                hasAppointment: !!dto.appointmentId,
                hasFinalizedRecord:
                  appointmentWithRecord?.medicalRecord?.isFinalized === true,
              },
            );

            try {
              // Criar repasse médico dentro da mesma transação
              const medicalFee = await tx.medicalFee.create({
                data: {
                  tenantId,
                  staffId: dto.staffId as string,
                  transactionId: transaction.id,
                  grossAmount,
                  feeAmount: feeAmount as number,
                  status: 'pending',
                  commissionRate: commissionRate ?? 0, // 0 para FIXED, valor real para PERCENTAGE
                },
              });

              console.log(
                `[FinanceService.createTransaction] DEBUG - ✅ Repasse médico criado com SUCESSO:`,
                {
                  id: medicalFee.id,
                  status: medicalFee.status,
                  staffId: medicalFee.staffId,
                  staffName: doctor.name,
                  commissionType: doctor.commissionType,
                  feeAmount: medicalFee.feeAmount,
                  grossAmount: medicalFee.grossAmount,
                  commissionRate: medicalFee.commissionRate,
                },
              );
            } catch (error) {
              console.error(
                `[FinanceService.createTransaction] DEBUG - ❌ ERRO ao criar repasse:`,
                error,
              );
              throw error;
            }
          } else {
            console.log(
              `[FinanceService.createTransaction] DEBUG - ⚠️ Repasse NÃO criado. Motivo:`,
              {
                hasFeeAmount: feeAmount !== null && feeAmount > 0,
                hasAppointmentId: !!dto.appointmentId,
                hasFinalizedRecord:
                  appointmentWithRecord?.medicalRecord?.isFinalized === true,
                shouldCreate: shouldCreateFee,
              },
            );
          }
        }
      } else {
        console.log(
          `[FinanceService.createTransaction] DEBUG - Repasse NÃO verificado:`,
          {
            reason: !dto.staffId
              ? 'sem staffId'
              : dto.type !== TransactionType.INCOME
                ? 'não é INCOME'
                : 'desconhecido',
            type: dto.type,
            staffId: dto.staffId,
          },
        );
      }

      console.log(
        `[FinanceService.createTransaction] DEBUG - Finalizando createTransaction. Retornando transação.`,
      );
      return transaction;
    });
  }

  async getMedicalFees(
    tenantId: string,
    doctorId?: string,
    startDate?: string,
    endDate?: string,
    status?: string,
  ) {
    const where: any = { tenantId };

    if (doctorId) {
      where.staffId = doctorId;
    }

    // Filtrar por status se fornecido (pending ou paid)
    if (status) {
      where.status = status;
    }

    // IMPORTANTE: Para repasses PENDENTES, NÃO aplicamos filtro de data
    // pois queremos ver TODOS os repasses pendentes independente da data
    // O filtro de data só faz sentido para histórico de repasses já fechados (paid)
    if ((startDate || endDate) && status !== 'pending') {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt = { ...where.createdAt, gte: start };
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt = { ...where.createdAt, lte: end };
      }
    }

    console.log('[FinanceService.getMedicalFees] Buscando repasses:', {
      tenantId,
      doctorId,
      startDate,
      endDate,
      status,
      ignorandoFiltroDataParaPending: status === 'pending',
      where: JSON.stringify(where, null, 2),
    });

    const fees = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.medicalFee.findMany({
        where,
        include: {
          staff: { select: { name: true, specialty: true, crm: true } },
          transaction: {
            select: {
              description: true,
              amount: true,
              createdAt: true,
              appointment: {
                include: {
                  patient: { select: { name: true } },
                  procedure: { select: { name: true } },
                  medicalRecord: { select: { id: true, isFinalized: true } },
                },
              },
            },
          },
          payment: { select: { id: true, paidAt: true, totalAmount: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    // Filtrar repasses pendentes: apenas mostrar se o appointment tiver prontuário finalizado
    // (ou se não tiver appointment, mostrar normalmente)
    let filteredFees = fees;
    if (status === 'pending') {
      // Log detalhado antes do filtro
      console.log(
        '[FinanceService.getMedicalFees] Repasses ANTES do filtro:',
        fees.length,
      );
      fees.forEach((fee, index) => {
        console.log(`[FinanceService.getMedicalFees] Repasse ${index + 1}:`, {
          id: fee.id,
          staffId: fee.staffId,
          staffName: fee.staff?.name,
          hasAppointment: !!fee.transaction?.appointment,
          appointmentId: fee.transaction?.appointment?.id,
          hasMedicalRecord: !!fee.transaction?.appointment?.medicalRecord,
          medicalRecordId: fee.transaction?.appointment?.medicalRecord?.id,
          isFinalized: fee.transaction?.appointment?.medicalRecord?.isFinalized,
        });
      });

      filteredFees = fees.filter((fee) => {
        // Se não tem appointment, mostrar (transações sem appointment)
        if (!fee.transaction?.appointment) {
          console.log(
            `[FinanceService.getMedicalFees] Repasse ${fee.id} SEM appointment - INCLUINDO`,
          );
          return true;
        }
        // Se tem appointment, só mostrar se tiver prontuário finalizado
        const hasMedicalRecord = !!fee.transaction.appointment.medicalRecord;
        const isFinalized =
          fee.transaction.appointment.medicalRecord?.isFinalized === true;

        console.log(
          `[FinanceService.getMedicalFees] Repasse ${fee.id} COM appointment:`,
          {
            appointmentId: fee.transaction.appointment.id,
            hasMedicalRecord,
            isFinalized,
            willInclude: isFinalized,
          },
        );

        return isFinalized;
      });

      console.log(
        '[FinanceService.getMedicalFees] Repasses filtrados por prontuário finalizado:',
        {
          total: fees.length,
          comProntuarioFinalizado: filteredFees.length,
          semProntuarioOuNaoFinalizado: fees.length - filteredFees.length,
        },
      );
    }

    console.log(
      '[FinanceService.getMedicalFees] Repasses encontrados:',
      filteredFees.length,
      'repasses',
    );
    if (filteredFees.length > 0) {
      console.log('[FinanceService.getMedicalFees] Primeiro repasse:', {
        id: filteredFees[0].id,
        staffId: filteredFees[0].staffId,
        status: filteredFees[0].status,
        feeAmount: filteredFees[0].feeAmount,
        staffName: filteredFees[0].staff?.name,
        transactionCreatedAt: filteredFees[0].transaction?.createdAt,
        feeCreatedAt: filteredFees[0].createdAt,
        hasAppointment: !!filteredFees[0].transaction?.appointment,
        isFinalized:
          filteredFees[0].transaction?.appointment?.medicalRecord?.isFinalized,
      });
    } else {
      console.warn(
        '[FinanceService.getMedicalFees] NENHUM repasse encontrado com os filtros aplicados!',
      );
      if (fees.length > 0) {
        console.warn(
          '[FinanceService.getMedicalFees] Mas havia',
          fees.length,
          'repasses ANTES do filtro!',
        );
        console.warn(
          '[FinanceService.getMedicalFees] Isso significa que todos foram filtrados por falta de prontuário finalizado.',
        );
      }
    }

    return filteredFees;
  }

  async closeMedicalFeePayment(
    tenantId: string,
    userId: string,
    dto: CloseMedicalFeePaymentDto,
  ) {
    const periodStart = new Date(dto.periodStart);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(dto.periodEnd);
    periodEnd.setHours(23, 59, 59, 999);

    console.log(
      '[FinanceService.closeMedicalFeePayment] Iniciando fechamento:',
      {
        tenantId,
        userId,
        staffId: dto.staffId,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    );

    // 1. Verificar se o médico existe e pertence ao tenant
    const staff = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.staff.findFirst({
        where: {
          id: dto.staffId,
          tenantId,
        },
      });
    });

    if (!staff) {
      throw new NotFoundException(
        'Médico não encontrado ou não pertence a este tenant.',
      );
    }

    // 2. Buscar TODOS os repasses pending do médico (sem filtro de data!)
    // O filtro de data é apenas informativo para o registro de fechamento
    const pendingFees = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.medicalFee.findMany({
        where: {
          tenantId,
          staffId: dto.staffId,
          status: 'pending',
          // REMOVIDO: filtro de data que causava o erro
          // Os repasses pendentes devem ser fechados independente da data de criação
        },
        include: {
          transaction: {
            include: {
              appointment: {
                include: {
                  patient: { select: { name: true } },
                  procedure: { select: { name: true } },
                  medicalRecord: { select: { id: true, isFinalized: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    console.log(
      '[FinanceService.closeMedicalFeePayment] Repasses pendentes encontrados:',
      pendingFees.length,
    );

    if (pendingFees.length === 0) {
      throw new BadRequestException(
        'Não há repasses pendentes para este médico.',
      );
    }

    // 3. Validar se todos os appointments relacionados têm prontuários finalizados
    const appointmentsWithIssues: Array<{
      id: string;
      patient: string;
      procedure: string;
      reason: string;
    }> = [];

    for (const fee of pendingFees) {
      const appointment = fee.transaction?.appointment;

      // Se não tem appointment, pode fechar normalmente (transação sem appointment)
      if (!appointment) {
        continue;
      }

      // Verificar se tem prontuário
      const medicalRecord = appointment.medicalRecord;

      if (!medicalRecord) {
        appointmentsWithIssues.push({
          id: appointment.id,
          patient: appointment.patient?.name || 'Desconhecido',
          procedure: appointment.procedure?.name || 'Desconhecido',
          reason: 'Prontuário não criado',
        });
      } else if (!medicalRecord.isFinalized) {
        appointmentsWithIssues.push({
          id: appointment.id,
          patient: appointment.patient?.name || 'Desconhecido',
          procedure: appointment.procedure?.name || 'Desconhecido',
          reason: 'Prontuário não finalizado',
        });
      }
    }

    if (appointmentsWithIssues.length > 0) {
      const appointmentsList = appointmentsWithIssues
        .map((a) => `${a.procedure} - ${a.patient} (${a.reason})`)
        .join('; ');

      throw new BadRequestException(
        `Não é possível fechar o repasse. Os seguintes atendimentos precisam ter o prontuário criado e finalizado: ${appointmentsList}. ` +
          `Por favor, crie e finalize os prontuários antes de fechar o repasse.`,
      );
    }

    // 4. Calcular total e período real dos repasses
    const totalAmount = pendingFees.reduce(
      (acc, fee) => acc + Number(fee.feeAmount),
      0,
    );

    // Usar o período real dos repasses (primeiro e último)
    const realPeriodStart = pendingFees[0].createdAt;
    const realPeriodEnd = pendingFees[pendingFees.length - 1].createdAt;

    console.log('[FinanceService.closeMedicalFeePayment] Criando fechamento:', {
      totalAmount,
      feesCount: pendingFees.length,
      realPeriodStart,
      realPeriodEnd,
    });

    // 5. Usar transação atômica para criar fechamento e atualizar repasses
    const payment = await this.prisma.withTenant(tenantId, async (tx) => {
      // Verificar novamente dentro da transação se os repasses ainda estão pendentes
      const feesInTx = await tx.medicalFee.findMany({
        where: {
          id: { in: pendingFees.map((f) => f.id) },
          status: 'pending',
        },
      });

      if (feesInTx.length !== pendingFees.length) {
        throw new BadRequestException(
          'Alguns repasses já foram fechados. Por favor, recarregue a página e tente novamente.',
        );
      }

      // Criar registro de fechamento dentro da transação
      const paymentRecord = await tx.medicalFeePayment.create({
        data: {
          tenantId,
          staffId: dto.staffId,
          periodStart: realPeriodStart,
          periodEnd: realPeriodEnd,
          totalAmount,
          feesCount: pendingFees.length,
          paidAt: new Date(),
          paidBy: userId,
          paymentMethod: dto.paymentMethod,
          observations: dto.observations,
        },
      });

      // Atualizar todos os repasses para 'paid' e vincular ao pagamento dentro da transação
      await tx.medicalFee.updateMany({
        where: {
          id: { in: pendingFees.map((f) => f.id) },
        },
        data: {
          status: 'paid',
          paidAt: new Date(),
          paymentId: paymentRecord.id,
        },
      });

      return paymentRecord;
    });

    // 6. Retornar o fechamento com detalhes
    return this.prisma.withTenant(tenantId, async (tx) => {
      return tx.medicalFeePayment.findUnique({
        where: { id: payment.id },
        include: {
          staff: { select: { name: true, specialty: true, crm: true } },
          paidByUser: { select: { id: true, name: true, email: true } },
          fees: {
            include: {
              transaction: {
                include: {
                  appointment: {
                    include: {
                      patient: { select: { name: true } },
                      procedure: { select: { name: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });
  }

  async getMedicalFeePayments(
    tenantId: string,
    staffId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = { tenantId };

    if (staffId) {
      where.staffId = staffId;
    }

    // Filtro por data do fechamento (paidAt)
    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) {
        // Criar data no início do dia no fuso horário local
        const start = new Date(startDate + 'T00:00:00');
        where.paidAt.gte = start;
      }
      if (endDate) {
        // Criar data no final do dia no fuso horário local
        const end = new Date(endDate + 'T23:59:59.999');
        where.paidAt.lte = end;
      }
    }

    console.log(
      '[FinanceService.getMedicalFeePayments] Buscando com filtros:',
      {
        tenantId,
        staffId,
        startDate,
        endDate,
        whereClause: JSON.stringify(where),
      },
    );

    const payments = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.medicalFeePayment.findMany({
        where,
        include: {
          staff: { select: { name: true, specialty: true, crm: true } },
          paidByUser: { select: { id: true, name: true, email: true } },
          fees: {
            include: {
              transaction: {
                include: {
                  appointment: {
                    include: {
                      patient: { select: { name: true } },
                      procedure: { select: { name: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { paidAt: 'desc' },
      });
    });

    console.log(
      '[FinanceService.getMedicalFeePayments] Encontrados:',
      payments.length,
      'pagamentos. Datas:',
      payments.map((p) => ({ id: p.id, paidAt: p.paidAt })),
    );

    return payments;
  }

  async getMedicalFeeSummary(tenantId: string, doctorId: string) {
    const fees = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.medicalFee.findMany({
        where: {
          tenantId,
          staffId: doctorId,
          status: 'pending',
        },
      });
    });

    const totalPending = fees.reduce(
      (acc: number, fee: any) => acc + Number(fee.feeAmount),
      0,
    );

    return {
      doctorId,
      pendingFeesCount: fees.length,
      totalPendingAmount: totalPending,
    };
  }

  async updateTransaction(
    tenantId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
    userId?: string,
    userRole?: string,
  ) {
    // 1. Verificar se a transação existe e pertence ao tenant
    const transaction = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findFirst({
        where: {
          id: transactionId,
          tenantId,
        },
        include: {
          medicalFee: true,
        },
      });
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    // 2. Verificar imutabilidade: se o caixa do dia foi fechado, não permitir edição
    const transactionDate = new Date(transaction.createdAt);
    transactionDate.setHours(0, 0, 0, 0);

    // Converter para UTC para comparação com o campo date (DATE type)
    const [year, month, day] = [
      transactionDate.getFullYear(),
      transactionDate.getMonth() + 1,
      transactionDate.getDate(),
    ];
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Verificar fechamento administrativo (bloqueia TODAS as transações do dia)
    const adminClosure = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findFirst({
        where: {
          tenantId,
          date: targetDate,
          closureType: 'ADMIN',
        },
      });
    });

    if (adminClosure) {
      throw new BadRequestException(
        'O caixa administrativo deste dia já foi fechado. Não é possível editar transações. Para alterar, é necessário reabrir o caixa ou criar um estorno oficial.',
      );
    }

    // Se for recepcionista, verificar fechamento do próprio caixa
    if (userRole === UserRole.RECEPTIONIST && userId) {
      const receptionistClosure = await this.prisma.withTenant(
        tenantId,
        async (tx) => {
          return tx.dailyClosure.findFirst({
            where: {
              tenantId,
              date: targetDate,
              createdById: userId,
              closureType: 'RECEPTIONIST',
            },
          });
        },
      );

      if (receptionistClosure) {
        throw new BadRequestException(
          'Seu caixa deste dia já foi fechado. Não é possível editar transações. Para alterar, é necessário reabrir o caixa ou criar um estorno oficial.',
        );
      }

      // Recepcionista só pode editar transações que ele criou
      if (transaction.createdById !== userId) {
        throw new ForbiddenException(
          'Você só pode editar transações criadas por você.',
        );
      }
    }

    // 3. Não permitir editar transações com repasse pago (imutabilidade financeira)
    if (transaction.medicalFee && transaction.medicalFee.status === 'paid') {
      throw new BadRequestException(
        'Não é possível editar uma transação com repasse médico já pago. Para alterar, é necessário criar um estorno oficial.',
      );
    }

    // 4. Usar transação atômica para atualizar transação e repasse (se necessário)
    const updatedTransaction = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        // Verificar novamente dentro da transação (double-check para evitar race conditions)
        const transactionInTx = await tx.transaction.findUnique({
          where: { id: transactionId },
          include: { medicalFee: true },
        });

        if (!transactionInTx) {
          throw new NotFoundException('Transação não encontrada');
        }

        // Verificar novamente se o caixa foi fechado (dentro da transação)
        const adminClosureInTx = await tx.dailyClosure.findFirst({
          where: {
            tenantId,
            date: targetDate,
            closureType: 'ADMIN',
          },
        });

        if (adminClosureInTx) {
          throw new BadRequestException(
            'O caixa administrativo deste dia já foi fechado. Não é possível editar transações.',
          );
        }

        if (userRole === UserRole.RECEPTIONIST && userId) {
          const receptionistClosureInTx = await tx.dailyClosure.findFirst({
            where: {
              tenantId,
              date: targetDate,
              createdById: userId,
              closureType: 'RECEPTIONIST',
            },
          });

          if (receptionistClosureInTx) {
            throw new BadRequestException(
              'Seu caixa deste dia já foi fechado. Não é possível editar transações.',
            );
          }
        }

        // Atualizar a transação dentro da transação
        const updated = await tx.transaction.update({
          where: { id: transactionId },
          data: {
            category: dto.category !== undefined ? dto.category : undefined,
            amount: dto.amount !== undefined ? dto.amount : undefined,
            method: dto.method !== undefined ? dto.method : undefined,
            description:
              dto.description !== undefined ? dto.description : undefined,
            categoryId:
              dto.categoryId !== undefined ? dto.categoryId : undefined,
          },
          include: {
            patient: { select: { name: true } },
            appointment: {
              include: {
                patient: { select: { name: true } },
                procedure: { select: { name: true } },
              },
            },
            createdBy: { select: { id: true, name: true, email: true } },
          },
        });

        // 5. Se o valor mudou, atualizar o repasse médico dentro da mesma transação
        if (
          dto.amount !== undefined &&
          transactionInTx.medicalFee &&
          transactionInTx.medicalFee.status === 'pending'
        ) {
          // Buscar configuração do médico para recalcular o repasse
          const staff = await tx.staff.findUnique({
            where: { id: transactionInTx.medicalFee.staffId },
          });

          if (staff) {
            const commissionType = staff.commissionType || 'PERCENTAGE';
            let newFeeAmount = 0;

            if (commissionType === 'FIXED') {
              newFeeAmount = Number(staff.fixedCommission || 0);
            } else {
              const rate = Number(staff.commissionRate || 0);
              newFeeAmount = (Number(dto.amount) * rate) / 100;
            }

            await tx.medicalFee.update({
              where: { id: transactionInTx.medicalFee.id },
              data: {
                grossAmount: dto.amount,
                feeAmount: newFeeAmount,
              },
            });
          }
        }

        return updated;
      },
    );

    console.log(
      `[FinanceService] Transação ${transactionId} atualizada com sucesso`,
    );

    return updatedTransaction;
  }

  async getDailyTransactions(
    tenantId: string,
    date?: string,
    createdById?: string,
  ) {
    // Parse da data e criar range no horário de Brasília (UTC-3)
    // Isso garante consistência com o fechamento de caixa
    let year: number, month: number, day: number;

    if (date) {
      [year, month, day] = date.split('-').map(Number);
    } else {
      const now = new Date();
      // Ajustar para horário de Brasília
      const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      year = brDate.getUTCFullYear();
      month = brDate.getUTCMonth() + 1;
      day = brDate.getUTCDate();
    }

    // Criar range no horário de Brasília convertido para UTC
    // Brasília = UTC-3, então meia-noite em Brasília = 03:00 UTC
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
    const endOfDay = new Date(
      Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999),
    );

    console.log(
      `[FinanceService] Buscando transações para tenant ${tenantId}, data: ${date || 'hoje'}`,
    );
    console.log(
      `[FinanceService] Range (Brasília): ${startOfDay.toISOString()} até ${endOfDay.toISOString()}`,
    );

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
      console.log(
        `[FinanceService] Filtrando por recepcionista: ${createdById}`,
      );
    }

    const transactions = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findMany({
        where,
        include: {
          patient: { select: { name: true } },
          appointment: {
            include: {
              patient: { select: { name: true } },
              staff: { select: { id: true, name: true, specialty: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    console.log(
      `[FinanceService] Encontradas ${transactions.length} transações`,
    );
    // Log para debug: verificar se description está vindo
    if (transactions.length > 0) {
      console.log(`[FinanceService] Primeira transação:`, {
        id: transactions[0].id,
        description: transactions[0].description,
        appointment: transactions[0].appointment
          ? {
              id: transactions[0].appointment.id,
              patient: transactions[0].appointment.patient?.name,
            }
          : null,
      });
    }
    return transactions;
  }

  async closeReceptionistBox(
    tenantId: string,
    userId: string,
    dto: CloseReceptionistBoxDto,
  ) {
    console.log(
      `[FinanceService.closeReceptionistBox] Iniciando fechamento para data: ${dto.date}, userId: ${userId}`,
    );

    // Criar datas em UTC para evitar problemas de timezone
    const [year, month, day] = dto.date.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Para busca de transações, usar horário de Brasília convertido para UTC
    // Brasília = UTC-3, então meia-noite em Brasília = 03:00 UTC
    const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
    const endOfDayUTC = new Date(
      Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999),
    );

    console.log(`[FinanceService.closeReceptionistBox] Datas calculadas:`, {
      inputDate: dto.date,
      targetDate: targetDate.toISOString(),
      startOfDayUTC: startOfDayUTC.toISOString(),
      endOfDayUTC: endOfDayUTC.toISOString(),
    });

    // 1. Verificar se já existe fechamento para este recepcionista neste dia
    const existing = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findFirst({
        where: {
          tenantId,
          date: targetDate, // Comparação exata - yyyy-MM-dd meia-noite UTC
          createdById: userId,
          closureType: 'RECEPTIONIST',
        },
      });
    });

    if (existing) {
      console.log(
        `[FinanceService.closeReceptionistBox] Fechamento já existe:`,
        existing.id,
        'para data:',
        existing.date,
      );
      throw new BadRequestException('Seu caixa deste dia já está fechado.');
    }

    // 2. Calcular totais do dia para este recepcionista
    const transactions = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findMany({
        where: {
          tenantId,
          createdById: userId,
          createdAt: {
            gte: startOfDayUTC,
            lte: endOfDayUTC,
          },
          status: 'completed',
        },
      });
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

    const netBalance = totalIncome - totalExpense;
    const calculatedFinalBalance = Number(dto.initialBalance) + netBalance;
    const difference = Number(dto.finalBalance) - calculatedFinalBalance;

    console.log(`[FinanceService.closeReceptionistBox] Criando fechamento:`, {
      totalIncome,
      totalExpense,
      netBalance,
      initialBalance: dto.initialBalance,
      finalBalance: dto.finalBalance,
      difference,
    });

    // Usar transação atômica para garantir integridade
    try {
      const closure = await this.prisma.withTenant(tenantId, async (tx) => {
        // Verificar novamente dentro da transação (double-check)
        const existingInTx = await tx.dailyClosure.findFirst({
          where: {
            tenantId,
            date: targetDate,
            createdById: userId,
            closureType: 'RECEPTIONIST',
          },
        });

        if (existingInTx) {
          throw new BadRequestException('Seu caixa deste dia já está fechado.');
        }

        // Criar fechamento dentro da transação
        return await tx.dailyClosure.create({
          data: {
            tenantId,
            date: targetDate,
            createdById: userId,
            closureType: 'RECEPTIONIST',
            initialBalance: dto.initialBalance,
            finalBalance: dto.finalBalance,
            totalIncome,
            totalExpense,
            netBalance,
            cashCount: dto.cashCount,
            cardCount: dto.cardCount,
            pixCount: dto.pixCount,
            difference,
            observations: dto.observations,
          },
          include: {
            closedBy: { select: { id: true, name: true, email: true } },
          },
        });
      });

      console.log(
        `[FinanceService.closeReceptionistBox] Fechamento criado com sucesso:`,
        closure.id,
      );
      return closure;
    } catch (error: any) {
      console.error(
        `[FinanceService.closeReceptionistBox] Erro ao criar fechamento:`,
        error,
      );
      if (error.code === 'P2002' || error instanceof BadRequestException) {
        throw new BadRequestException('Seu caixa deste dia já está fechado.');
      }
      throw error;
    }
  }

  async closeAdminBox(tenantId: string, userId: string, dto: CloseAdminBoxDto) {
    console.log(
      `[FinanceService.closeAdminBox] Iniciando fechamento para data: ${dto.date}`,
    );

    // Criar datas em UTC para evitar problemas de timezone
    // O dto.date vem como 'yyyy-MM-dd', criamos em UTC meia-noite
    const [year, month, day] = dto.date.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Para busca de transações, usar horário de Brasília convertido para UTC
    // Brasília = UTC-3, então meia-noite em Brasília = 03:00 UTC
    const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
    const endOfDayUTC = new Date(
      Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999),
    );

    console.log(`[FinanceService.closeAdminBox] Datas calculadas:`, {
      inputDate: dto.date,
      targetDate: targetDate.toISOString(),
      startOfDayUTC: startOfDayUTC.toISOString(),
      endOfDayUTC: endOfDayUTC.toISOString(),
    });

    // 1. Verificar se já existe fechamento administrativo para este dia/tenant
    // Usando comparação exata de data (o campo date é DATE, não TIMESTAMP)
    const existing = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findFirst({
        where: {
          tenantId,
          date: targetDate, // Comparação exata - yyyy-MM-dd meia-noite UTC
          closureType: 'ADMIN',
        },
      });
    });

    if (existing) {
      console.log(
        `[FinanceService.closeAdminBox] Fechamento já existe:`,
        existing.id,
        'para data:',
        existing.date,
      );
      throw new BadRequestException(
        'O caixa administrativo deste dia já está fechado.',
      );
    }

    // 2. Calcular totais do dia (todas as transações do tenant, não apenas do admin)
    // Transações são filtradas pelo horário de Brasília (createdAt)
    const transactions = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startOfDayUTC,
            lte: endOfDayUTC,
          },
          status: 'completed',
        },
      });
    });

    console.log(
      `[FinanceService.closeAdminBox] Encontradas ${transactions.length} transações`,
    );

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((t: any) => {
      if (t.type === TransactionType.INCOME) {
        totalIncome += Number(t.amount);
      } else {
        totalExpense += Number(t.amount);
      }
    });

    const netBalance = totalIncome - totalExpense;
    const calculatedFinalBalance = Number(dto.initialBalance) + netBalance;
    const difference = Number(dto.finalBalance) - calculatedFinalBalance;

    console.log(`[FinanceService.closeAdminBox] Criando fechamento:`, {
      totalIncome,
      totalExpense,
      netBalance,
      initialBalance: dto.initialBalance,
      finalBalance: dto.finalBalance,
      difference,
    });

    // Usar transação atômica para garantir integridade
    try {
      const closure = await this.prisma.withTenant(tenantId, async (tx) => {
        // Verificar novamente dentro da transação (double-check)
        const existingInTx = await tx.dailyClosure.findFirst({
          where: {
            tenantId,
            date: targetDate,
            closureType: 'ADMIN',
          },
        });

        if (existingInTx) {
          throw new BadRequestException(
            'O caixa administrativo deste dia já está fechado.',
          );
        }

        // Criar fechamento dentro da transação
        return await tx.dailyClosure.create({
          data: {
            tenantId,
            date: targetDate,
            createdById: userId,
            closureType: 'ADMIN',
            initialBalance: dto.initialBalance,
            finalBalance: dto.finalBalance,
            totalIncome,
            totalExpense,
            netBalance,
            cashCount: dto.cashCount,
            cardCount: dto.cardCount,
            pixCount: dto.pixCount,
            difference,
            observations: dto.observations,
          },
          include: {
            closedBy: { select: { id: true, name: true, email: true } },
          },
        });
      });

      console.log(
        `[FinanceService.closeAdminBox] Fechamento criado com sucesso:`,
        closure.id,
      );
      return closure;
    } catch (error: any) {
      console.error(
        `[FinanceService.closeAdminBox] Erro ao criar fechamento:`,
        error,
      );
      if (error.code === 'P2002' || error instanceof BadRequestException) {
        throw new BadRequestException(
          'O caixa administrativo deste dia já está fechado.',
        );
      }
      throw error;
    }
  }

  async closeDailyBox(tenantId: string, dto: CreateClosureDto) {
    // Método legado - manter para compatibilidade, mas usar os novos métodos específicos
    const targetDate = new Date(dto.date);
    targetDate.setHours(0, 0, 0, 0);

    // 1. Verificar se já existe fechamento
    const existing = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findFirst({
        where: {
          tenantId,
          date: targetDate,
          createdById: dto.closedById,
        },
      });
    });

    if (existing) {
      throw new BadRequestException('O caixa deste dia já está fechado.');
    }

    // 2. Calcular totais do dia
    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: 'completed',
        },
      });
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

    return this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.create({
        data: {
          tenantId,
          date: targetDate,
          createdById: dto.closedById,
          closureType: 'ADMIN', // Default para compatibilidade
          initialBalance: 0,
          finalBalance: totalIncome - totalExpense,
          totalIncome,
          totalExpense,
          netBalance: totalIncome - totalExpense,
          observations: dto.observations,
        },
      });
    });
  }

  async getClosureStatus(
    tenantId: string,
    date: string,
    userId?: string,
    closureType?: string,
  ) {
    // Criar data em UTC para comparação com o campo date (DATE type)
    // O campo date armazena apenas yyyy-MM-dd, que o Prisma retorna como meia-noite UTC
    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    if (userId && closureType) {
      // Buscar fechamento específico
      return this.prisma.withTenant(tenantId, async (tx) => {
        return tx.dailyClosure.findUnique({
          where: {
            tenantId_date_createdById_closureType: {
              tenantId,
              date: targetDate,
              createdById: userId,
              closureType: closureType as 'RECEPTIONIST' | 'ADMIN',
            },
          },
          include: {
            closedBy: { select: { id: true, name: true, email: true } },
          },
        });
      });
    }

    // Buscar todos os fechamentos do dia
    return this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findMany({
        where: {
          tenantId,
          date: targetDate,
        },
        include: {
          closedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async getBoxStatus(tenantId: string, date: string, userId?: string) {
    // Parse da data e criar em UTC para comparação com campo date (DATE type)
    const [year, month, day] = date.split('-').map(Number);
    // Para comparação com DailyClosure.date (DATE type), usar meia-noite UTC
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    console.log('[FinanceService.getBoxStatus] Iniciando para:', {
      tenantId,
      date,
      userId,
      targetDate: targetDate.toISOString(),
    });

    const where: any = {
      tenantId,
      date: targetDate,
    };

    // Para closures, usar createdById
    if (userId) {
      where.createdById = userId;
    }

    const closures = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findMany({
        where,
        include: {
          closedBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    // Buscar último fechamento anterior à data atual (não apenas do dia anterior)
    // Isso garante que mesmo se não houver fechamento no dia anterior, busca o último disponível
    let previousDayFinalBalance = 0;
    const lastClosureWhere: any = {
      tenantId,
      date: { lt: targetDate }, // Qualquer data anterior à data atual
    };

    // Para closures, usar createdById e closureType
    if (userId) {
      lastClosureWhere.createdById = userId;
      // Determinar closureType baseado no usuário (será filtrado depois se necessário)
    }

    const lastClosure = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findFirst({
        where: lastClosureWhere,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], // Último por data, depois por criação
        select: { cashCount: true, closureType: true, createdById: true },
      });
    });

    // Saldo inicial é apenas o dinheiro do último fechamento (cashCount)
    if (lastClosure && lastClosure.cashCount) {
      previousDayFinalBalance = Number(lastClosure.cashCount);
    }

    // Separar por tipo
    const receptionistClosures = closures.filter(
      (c) => c.closureType === 'RECEPTIONIST',
    );
    const adminClosures = closures.filter((c) => c.closureType === 'ADMIN');

    // Buscar transações do dia para calcular saldos por método
    // Usar mesmo range de horário de Brasília (UTC-3) que getDailyTransactions e fechamento
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
    const endOfDay = new Date(
      Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999),
    );

    const transactionWhere: any = {
      tenantId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    // Usar createdById para filtrar por usuário (mesmo campo usado em getTransactions)
    if (userId) {
      transactionWhere.createdById = userId;
    }

    console.log(
      '[FinanceService.getBoxStatus] Query para transações:',
      JSON.stringify(transactionWhere, null, 2),
    );
    console.log(
      '[FinanceService.getBoxStatus] Range:',
      startOfDay.toISOString(),
      'até',
      endOfDay.toISOString(),
    );

    const dayTransactions = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.transaction.findMany({
          where: transactionWhere,
          select: {
            type: true,
            amount: true,
            method: true,
          },
        });
      },
    );

    // Calcular saldos por método de pagamento
    const balancesByMethod: any = {
      Dinheiro: { income: 0, expense: 0 },
      PIX: { income: 0, expense: 0 },
      'Cartão de Débito': { income: 0, expense: 0 },
      'Cartão de Crédito': { income: 0, expense: 0 },
    };

    console.log(
      '[FinanceService.getBoxStatus] Transações do dia para cálculo de saldos:',
      dayTransactions.length,
    );

    dayTransactions.forEach((t: any, index: number) => {
      const method = t.method || 'Dinheiro';
      const amount = Number(t.amount || 0);
      const typeUpper = t.type?.toUpperCase();

      console.log(`[FinanceService.getBoxStatus] Transação ${index + 1}:`, {
        type: t.type,
        typeUpper,
        method,
        amount,
      });

      if (balancesByMethod[method]) {
        if (typeUpper === 'INCOME') {
          balancesByMethod[method].income += amount;
          console.log(
            `[FinanceService.getBoxStatus] +${amount} entrada em ${method}`,
          );
        } else if (typeUpper === 'EXPENSE') {
          balancesByMethod[method].expense += amount;
          console.log(
            `[FinanceService.getBoxStatus] +${amount} saída em ${method}`,
          );
        }
      } else {
        // Se o método não está no mapa, adicionar a 'Dinheiro' como fallback
        console.log(
          '[FinanceService.getBoxStatus] Método não mapeado:',
          method,
          '- adicionando a Dinheiro',
        );
        if (typeUpper === 'INCOME') {
          balancesByMethod['Dinheiro'].income += amount;
        } else if (typeUpper === 'EXPENSE') {
          balancesByMethod['Dinheiro'].expense += amount;
        }
      }
    });

    console.log(
      '[FinanceService.getBoxStatus] Saldos calculados FINAL:',
      JSON.stringify(balancesByMethod),
    );

    return {
      date: targetDate,
      receptionistClosures,
      adminClosures,
      hasReceptionistClosure: receptionistClosures.length > 0,
      hasAdminClosure: adminClosures.length > 0,
      userClosure: userId
        ? closures.find((c) => c.createdById === userId)
        : null,
      previousDayFinalBalance,
      balancesByMethod,
    };
  }

  async checkAppointmentBilling(tenantId: string, appointmentId: string) {
    // Verificar se já existe transação para este appointment
    const existingTransaction = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.transaction.findUnique({
          where: { appointmentId },
          select: { id: true, amount: true, createdAt: true, method: true },
        });
      },
    );

    // Buscar dados do appointment com procedure
    const appointment = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
          procedure: { select: { id: true, name: true, grossAmount: true } },
        },
      });
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    if (appointment.tenantId !== tenantId) {
      throw new NotFoundException('Agendamento não pertence a este tenant.');
    }

    if (!appointment.procedure) {
      throw new BadRequestException(
        'Agendamento não possui procedimento vinculado.',
      );
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

  /**
   * Lista os fechamentos de caixa por período e usuário
   */
  async getDailyClosures(
    tenantId: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
    closureType?: string,
  ) {
    const where: any = { tenantId };

    if (startDate && endDate) {
      // Converter datas para UTC para comparação com o campo date (DATE type)
      const [startYear, startMonth, startDay] = startDate
        .split('-')
        .map(Number);
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      const start = new Date(
        Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0),
      );
      const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 0, 0, 0, 0));
      where.date = { gte: start, lte: end };
    }

    if (userId) {
      where.createdById = userId;
    }

    if (closureType) {
      where.closureType = closureType;
    }

    const closures = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findMany({
        where,
        include: {
          closedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { date: 'desc' },
      });
    });

    return closures.map((c) => ({
      id: c.id,
      date: c.date,
      closureType: c.closureType,
      initialBalance: Number(c.initialBalance),
      finalBalance: Number(c.finalBalance),
      totalIncome: Number(c.totalIncome),
      totalExpense: Number(c.totalExpense),
      netBalance: Number(c.netBalance),
      cashCount: c.cashCount ? Number(c.cashCount) : null,
      cardCount: c.cardCount ? Number(c.cardCount) : null,
      pixCount: c.pixCount ? Number(c.pixCount) : null,
      difference: c.difference ? Number(c.difference) : null,
      observations: c.observations,
      status: c.status,
      createdAt: c.createdAt,
      closedBy: c.closedBy,
    }));
  }

  /**
   * Busca o resumo do caixa para preview antes do fechamento
   * Inclui todas as transações do dia e os saldos calculados
   */
  async getClosurePreview(
    tenantId: string,
    date: string,
    userId: string,
    closureType: string,
  ) {
    // Usar range de horário de Brasília (UTC-3) consistente com getDailyTransactions e fechamento
    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
    const endOfDay = new Date(
      Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999),
    );
    // Data alvo para comparação com campo DATE (meia-noite UTC)
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Buscar transações do dia
    const where: any = {
      tenantId,
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: 'completed',
    };

    // Se for caixa de recepcionista, filtrar pelo usuário
    if (closureType === 'RECEPTIONIST') {
      where.createdById = userId;
    }

    const transactions = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findMany({
        where,
        include: {
          patient: { select: { name: true } },
          appointment: {
            include: {
              patient: { select: { name: true } },
              procedure: { select: { name: true } },
            },
          },
          createdBy: { select: { name: true } },
          expenseCategory: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    // Calcular saldos por método
    const balancesByMethod: Record<
      string,
      { income: number; expense: number }
    > = {
      Dinheiro: { income: 0, expense: 0 },
      PIX: { income: 0, expense: 0 },
      'Cartão de Débito': { income: 0, expense: 0 },
      'Cartão de Crédito': { income: 0, expense: 0 },
    };

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((t) => {
      const method = t.method || 'Dinheiro';
      const amount = Number(t.amount);
      const typeUpper = t.type?.toUpperCase();

      if (!balancesByMethod[method]) {
        balancesByMethod[method] = { income: 0, expense: 0 };
      }

      if (typeUpper === 'INCOME') {
        balancesByMethod[method].income += amount;
        totalIncome += amount;
      } else if (typeUpper === 'EXPENSE') {
        balancesByMethod[method].expense += amount;
        totalExpense += amount;
      }
    });

    // Buscar último fechamento anterior à data atual (não apenas do dia anterior)
    // Isso garante que mesmo se não houver fechamento no dia anterior, busca o último disponível
    const lastClosureWhere: any = {
      tenantId,
      date: { lt: targetDate }, // Qualquer data anterior à data atual
    };

    if (closureType === 'RECEPTIONIST') {
      lastClosureWhere.createdById = userId;
      lastClosureWhere.closureType = 'RECEPTIONIST';
    } else {
      lastClosureWhere.closureType = 'ADMIN';
    }

    const lastClosure = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findFirst({
        where: lastClosureWhere,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], // Último por data, depois por criação
        select: { cashCount: true },
      });
    });

    // Saldo inicial é apenas o dinheiro do último fechamento (cashCount)
    const previousDayFinalBalance =
      lastClosure && lastClosure.cashCount ? Number(lastClosure.cashCount) : 0;

    // Formatar transações para exibição
    const formattedTransactions = transactions.map((t) => {
      const description =
        t.description ||
        (t.appointment?.patient?.name
          ? `${t.appointment.procedure?.name || t.category} - ${t.appointment.patient.name}`
          : null) ||
        (t.patient?.name ? `${t.category} - ${t.patient.name}` : null) ||
        t.category ||
        'Sem descrição';

      return {
        id: t.id,
        type: t.type,
        category: t.category,
        description,
        amount: Number(t.amount),
        method: t.method || 'Dinheiro',
        createdAt: t.createdAt,
        createdBy: t.createdBy?.name,
      };
    });

    return {
      date: targetDate,
      previousDayFinalBalance,
      transactions: formattedTransactions,
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      suggestedFinalBalance:
        previousDayFinalBalance + totalIncome - totalExpense,
      balancesByMethod,
    };
  }

  /**
   * Cria repasse médico retroativamente quando o prontuário é finalizado
   * Este método é chamado pelo PepService quando um prontuário é finalizado
   */
  async createMedicalFeeRetroactively(
    tenantId: string,
    appointmentId: string,
  ): Promise<void> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(
      `[FinanceService.createMedicalFeeRetroactively] 🔄🔄🔄 INICIANDO CRIAÇÃO RETROATIVA 🔄🔄🔄`,
    );
    console.log(
      `[FinanceService.createMedicalFeeRetroactively] appointmentId: ${appointmentId}`,
    );
    console.log(
      `[FinanceService.createMedicalFeeRetroactively] tenantId: ${tenantId}`,
    );
    console.log(`${'='.repeat(80)}\n`);

    // 1. Buscar o appointment com medicalRecord e staff
    const appointment = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          medicalRecord: {
            select: {
              id: true,
              isFinalized: true,
            },
          },
          staff: {
            select: {
              id: true,
              name: true,
              commissionRate: true,
              fixedCommission: true,
              commissionType: true,
              role: true,
            },
          },
        },
      });
    });

    if (!appointment) {
      console.error(
        `[FinanceService.createMedicalFeeRetroactively] ❌ ERRO: Appointment ${appointmentId} não encontrado no tenant ${tenantId}`,
      );
      return;
    }

    console.log(
      `[FinanceService.createMedicalFeeRetroactively] DEBUG - Appointment encontrado:`,
      {
        appointmentId: appointment.id,
        staffId: appointment.staffId,
        staffName: appointment.staff?.name,
        staffCommissionType: appointment.staff?.commissionType,
        staffCommissionRate: appointment.staff?.commissionRate,
        staffFixedCommission: appointment.staff?.fixedCommission,
        hasMedicalRecord: !!appointment.medicalRecord,
        medicalRecordId: appointment.medicalRecord?.id,
        isFinalized: appointment.medicalRecord?.isFinalized,
      },
    );

    // 2. Verificar se o prontuário está finalizado
    if (!appointment.medicalRecord) {
      console.warn(
        `[FinanceService.createMedicalFeeRetroactively] ⚠️ Appointment ${appointmentId} não possui prontuário. Não criando repasse.`,
      );
      return;
    }

    if (!appointment.medicalRecord.isFinalized) {
      console.warn(
        `[FinanceService.createMedicalFeeRetroactively] ⚠️ Prontuário do appointment ${appointmentId} não está finalizado (isFinalized: ${appointment.medicalRecord.isFinalized}). Não criando repasse.`,
      );
      return;
    }

    console.log(
      `[FinanceService.createMedicalFeeRetroactively] ✅ Prontuário confirmado como finalizado. Continuando...`,
    );

    // 3. Buscar a transação pelo appointmentId (a relação é Transaction -> Appointment)
    // Primeiro tentar findUnique (mais eficiente)
    let transaction = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findUnique({
        where: { appointmentId },
        include: {
          medicalFee: true, // Verificar se já existe repasse
        },
      });
    });

    // Se não encontrar com findUnique, tentar findFirst (caso haja algum problema de índice)
    if (!transaction) {
      console.warn(
        `[FinanceService.createMedicalFeeRetroactively] ⚠️ Transação não encontrada com findUnique. Tentando findFirst...`,
      );
      transaction = await this.prisma.withTenant(tenantId, async (tx) => {
        return tx.transaction.findFirst({
          where: {
            appointmentId,
            tenantId, // Garantir que é do mesmo tenant
          },
          include: {
            medicalFee: true,
          },
          orderBy: {
            createdAt: 'desc', // Pegar a mais recente se houver múltiplas
          },
        });
      });
    }

    if (!transaction) {
      console.error(
        `[FinanceService.createMedicalFeeRetroactively] ❌ ERRO: Appointment ${appointmentId} não possui transação. Não é possível criar repasse sem transação.`,
      );
      console.error(
        `[FinanceService.createMedicalFeeRetroactively] ❌ DEBUG - Verificando se existe alguma transação para este appointment...`,
      );

      // Buscar todas as transações do tenant para debug
      const allTransactionsForAppointment = await this.prisma.withTenant(
        tenantId,
        async (tx) => {
          return tx.transaction.findMany({
            where: {
              tenantId,
              appointmentId: appointmentId, // Verificar se há alguma com este appointmentId
            },
            select: {
              id: true,
              appointmentId: true,
              type: true,
              amount: true,
              description: true,
              createdAt: true,
            },
            take: 5,
          });
        },
      );

      console.error(
        `[FinanceService.createMedicalFeeRetroactively] ❌ DEBUG - Transações encontradas para este appointmentId:`,
        allTransactionsForAppointment,
      );

      // Verificar se há transações sem appointmentId mas que poderiam ser relacionadas
      const appointmentDetails = await this.prisma.withTenant(
        tenantId,
        async (tx) => {
          return tx.appointment.findUnique({
            where: { id: appointmentId },
            select: {
              id: true,
              patientId: true,
              staffId: true,
              procedureId: true,
              startTime: true,
            },
          });
        },
      );

      if (appointmentDetails) {
        // Buscar transações do mesmo paciente e médico no mesmo dia
        const startOfDay = new Date(appointmentDetails.startTime);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(appointmentDetails.startTime);
        endOfDay.setHours(23, 59, 59, 999);

        const relatedTransactions = await this.prisma.withTenant(
          tenantId,
          async (tx) => {
            return tx.transaction.findMany({
              where: {
                tenantId,
                patientId: appointmentDetails.patientId,
                staffId: appointmentDetails.staffId,
                type: 'income',
                createdAt: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
                appointmentId: null, // Transações sem appointmentId
              },
              select: {
                id: true,
                appointmentId: true,
                description: true,
                amount: true,
                createdAt: true,
              },
              take: 5,
            });
          },
        );

        console.error(
          `[FinanceService.createMedicalFeeRetroactively] ❌ DEBUG - Transações relacionadas (mesmo paciente/médico/dia) sem appointmentId:`,
          relatedTransactions,
        );
      }

      return;
    }

    console.log(
      `[FinanceService.createMedicalFeeRetroactively] DEBUG - Transação encontrada:`,
      {
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        staffId: transaction.staffId,
        hasMedicalFee: !!transaction.medicalFee,
        medicalFeeId: transaction.medicalFee?.id,
      },
    );

    // 4. Verificar se já existe repasse
    if (transaction.medicalFee) {
      console.log(
        `[FinanceService.createMedicalFeeRetroactively] DEBUG - Já existe repasse para esta transação: ${transaction.medicalFee.id}`,
      );
      return;
    }

    // 5. Verificar se a transação é do tipo INCOME
    if (transaction.type !== TransactionType.INCOME) {
      console.log(
        `[FinanceService.createMedicalFeeRetroactively] DEBUG - Transação não é do tipo INCOME (tipo: ${transaction.type}). Não criando repasse.`,
      );
      return;
    }

    // 6. Verificar se tem staffId (médico) - priorizar o do appointment
    const staffId = appointment.staffId || transaction.staffId;
    console.log(
      `[FinanceService.createMedicalFeeRetroactively] DEBUG - staffId determinado:`,
      {
        appointmentStaffId: appointment.staffId,
        transactionStaffId: transaction.staffId,
        finalStaffId: staffId,
      },
    );

    if (!staffId) {
      console.warn(
        `[FinanceService.createMedicalFeeRetroactively] DEBUG - Appointment não possui staffId. Não criando repasse.`,
      );
      return;
    }

    // 7. Verificar se o médico tem commissionRate
    const doctor =
      appointment.staff ||
      (await this.prisma.withTenant(tenantId, async (tx) => {
        return tx.staff.findUnique({
          where: { id: staffId },
          select: {
            id: true,
            name: true,
            commissionRate: true,
            fixedCommission: true,
            commissionType: true,
            role: true,
          },
        });
      }));

    console.log(
      `[FinanceService.createMedicalFeeRetroactively] DEBUG - Médico verificado:`,
      {
        id: doctor?.id,
        name: doctor?.name,
        commissionType: doctor?.commissionType,
        commissionRate: doctor?.commissionRate,
        fixedCommission: doctor?.fixedCommission,
        role: doctor?.role,
      },
    );

    if (!doctor) {
      console.error(
        `[FinanceService.createMedicalFeeRetroactively] DEBUG - ERRO: Médico não encontrado com staffId: ${staffId}`,
      );
      return;
    }

    // Verificar se tem configuração de repasse válida
    const isPercentage = doctor.commissionType === 'PERCENTAGE';
    const isFixed = doctor.commissionType === 'FIXED';

    let feeAmount: number | null = null;
    let commissionRate: number | null = null;

    if (isPercentage) {
      if (!doctor.commissionRate || Number(doctor.commissionRate) <= 0) {
        console.warn(
          `[FinanceService.createMedicalFeeRetroactively] DEBUG - Médico "${doctor.name}" com tipo PERCENTAGE mas sem commissionRate ou commissionRate = 0 (valor: ${doctor.commissionRate}). Não criando repasse.`,
        );
        return;
      }
      commissionRate = Number(doctor.commissionRate);
      const grossAmount = Number(transaction.amount);
      feeAmount = (grossAmount * commissionRate) / 100;
    } else if (isFixed) {
      console.log(
        `[FinanceService.createMedicalFeeRetroactively] 💰 Processando tipo FIXED para ${doctor.name}`,
      );
      console.log(
        `[FinanceService.createMedicalFeeRetroactively] 💰 doctor.fixedCommission RAW:`,
        doctor.fixedCommission,
      );
      console.log(
        `[FinanceService.createMedicalFeeRetroactively] 💰 typeof doctor.fixedCommission:`,
        typeof doctor.fixedCommission,
      );
      console.log(
        `[FinanceService.createMedicalFeeRetroactively] 💰 Number(doctor.fixedCommission):`,
        Number(doctor.fixedCommission),
      );

      if (!doctor.fixedCommission || Number(doctor.fixedCommission) <= 0) {
        console.warn(
          `[FinanceService.createMedicalFeeRetroactively] ⚠️ FIXED - Médico "${doctor.name}" sem fixedCommission válido (valor RAW: ${doctor.fixedCommission}, Number: ${Number(doctor.fixedCommission)}). Não criando repasse.`,
        );
        return;
      }
      feeAmount = Number(doctor.fixedCommission); // Valor fixo é o próprio feeAmount
      commissionRate = null; // Não usa percentual
      console.log(
        `[FinanceService.createMedicalFeeRetroactively] 💰 feeAmount calculado: ${feeAmount}`,
      );
    } else {
      console.warn(
        `[FinanceService.createMedicalFeeRetroactively] DEBUG - Médico "${doctor.name}" com tipo de repasse inválido: ${doctor.commissionType}. Não criando repasse.`,
      );
      return;
    }

    if (feeAmount === null || feeAmount <= 0) {
      console.warn(
        `[FinanceService.createMedicalFeeRetroactively] DEBUG - feeAmount inválido: ${feeAmount}. Não criando repasse.`,
      );
      return;
    }

    // 8. Criar o repasse
    const grossAmount = Number(transaction.amount);

    console.log(
      `[FinanceService.createMedicalFeeRetroactively] DEBUG - Criando repasse retroativamente:`,
      {
        tenantId,
        appointmentId,
        transactionId: transaction.id,
        staffId,
        staffName: doctor.name,
        commissionType: doctor.commissionType,
        grossAmount,
        commissionRate,
        fixedCommission: isFixed ? feeAmount : null,
        feeAmount,
      },
    );

    try {
      // commissionRate é obrigatório no Prisma, usar 0 para tipo FIXED
      const medicalFeeData = {
        tenantId,
        staffId,
        transactionId: transaction.id,
        grossAmount,
        feeAmount: feeAmount,
        status: 'pending',
        commissionRate: commissionRate ?? 0, // 0 para FIXED, valor real para PERCENTAGE
      };

      console.log(
        `[FinanceService.createMedicalFeeRetroactively] 📝 Dados para criar medicalFee:`,
        medicalFeeData,
      );

      const medicalFee = await this.prisma.withTenant(tenantId, async (tx) => {
        return tx.medicalFee.create({
          data: medicalFeeData,
        });
      });

      console.log(
        `[FinanceService.createMedicalFeeRetroactively] ✅✅✅ REPASSE CRIADO COM SUCESSO! ✅✅✅`,
        {
          id: medicalFee.id,
          status: medicalFee.status,
          staffId: medicalFee.staffId,
          staffName: doctor.name,
          commissionType: doctor.commissionType,
          feeAmount: medicalFee.feeAmount,
          grossAmount: medicalFee.grossAmount,
          commissionRate: medicalFee.commissionRate,
          appointmentId,
          transactionId: transaction.id,
        },
      );
    } catch (error) {
      console.error(
        `[FinanceService.createMedicalFeeRetroactively] ❌❌❌ ERRO CRÍTICO ao criar repasse:`,
        error,
      );
      console.error(
        `[FinanceService.createMedicalFeeRetroactively] ❌ Stack trace:`,
        error instanceof Error ? error.stack : 'N/A',
      );
      console.error(
        `[FinanceService.createMedicalFeeRetroactively] ❌ Dados do contexto:`,
        {
          tenantId,
          appointmentId,
          staffId,
          staffName: doctor.name,
          transactionId: transaction.id,
          feeAmount,
          commissionRate,
        },
      );
      throw error;
    }
  }

  async recreateMissingMedicalFees(
    tenantId: string,
    startDate?: string,
    endDate?: string,
  ) {
    console.log(
      `[FinanceService.recreateMissingMedicalFees] 🔄 Iniciando recriação de repasses faltantes...`,
    );

    // Construir filtro de data se fornecido
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.lte = end;
      }
    }

    // Buscar todos os appointments finalizados com transação mas sem repasse
    const appointmentsWithTransaction = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.appointment.findMany({
          where: {
            tenantId,
            status: 'completed',
            medicalRecord: {
              isFinalized: true,
            },
            transaction: {
              isNot: null, // Tem transação
              type: 'income', // Transação de entrada
              medicalFee: null, // Mas não tem repasse
            },
            ...dateFilter,
          },
          include: {
            medicalRecord: {
              select: {
                id: true,
                isFinalized: true,
              },
            },
            transaction: {
              select: {
                id: true,
                type: true,
                amount: true,
                medicalFee: {
                  select: {
                    id: true,
                  },
                },
              },
            },
            staff: {
              select: {
                id: true,
                name: true,
                commissionType: true,
                commissionRate: true,
                fixedCommission: true,
              },
            },
          },
        });
      },
    );

    console.log(
      `[FinanceService.recreateMissingMedicalFees] 📊 Encontrados ${appointmentsWithTransaction.length} appointments com transação mas sem repasse.`,
    );

    const results = {
      total: appointmentsWithTransaction.length,
      success: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const appointment of appointmentsWithTransaction) {
      try {
        console.log(
          `[FinanceService.recreateMissingMedicalFees] 🔄 Processando appointment: ${appointment.id}, médico: ${appointment.staff?.name}`,
        );

        await this.createMedicalFeeRetroactively(tenantId, appointment.id);

        results.success++;
        results.details.push({
          appointmentId: appointment.id,
          staffName: appointment.staff?.name,
          status: 'success',
        });
      } catch (error) {
        results.errors++;
        results.details.push({
          appointmentId: appointment.id,
          staffName: appointment.staff?.name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(
          `[FinanceService.recreateMissingMedicalFees] ❌ Erro ao processar appointment ${appointment.id}:`,
          error,
        );
      }
    }

    console.log(
      `[FinanceService.recreateMissingMedicalFees] ✅ Processamento concluído: ${results.success} sucessos, ${results.errors} erros.`,
    );

    return results;
  }

  async diagnoseMedicalFees(tenantId: string) {
    console.log(
      '[FinanceService.diagnoseMedicalFees] 🔍 Iniciando diagnóstico...',
    );

    // 1. Buscar configurações dos dois profissionais
    const draLais = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.staff.findFirst({
        where: {
          tenantId,
          name: { contains: 'Lais', mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          commissionType: true,
          commissionRate: true,
          fixedCommission: true,
        },
      });
    });

    const drCaio = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.staff.findFirst({
        where: {
          tenantId,
          name: { contains: 'Caio', mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          commissionType: true,
          commissionRate: true,
          fixedCommission: true,
        },
      });
    });

    if (!draLais || !drCaio) {
      return {
        error: 'Profissionais não encontrados',
        draLais: !!draLais,
        drCaio: !!drCaio,
      };
    }

    // 2. Buscar repasses pendentes para cada um
    const draLaisFees = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.medicalFee.findMany({
        where: {
          tenantId,
          staffId: draLais.id,
          status: 'pending',
        },
        include: {
          transaction: {
            include: {
              appointment: {
                include: {
                  medicalRecord: {
                    select: {
                      id: true,
                      isFinalized: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    const drCaioFees = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.medicalFee.findMany({
        where: {
          tenantId,
          staffId: drCaio.id,
          status: 'pending',
        },
        include: {
          transaction: {
            include: {
              appointment: {
                include: {
                  medicalRecord: {
                    select: {
                      id: true,
                      isFinalized: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    // 3. Buscar transações com appointmentId mas sem repasse
    const draLaisTransactions = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.transaction.findMany({
          where: {
            tenantId,
            staffId: draLais.id,
            type: 'income',
            appointmentId: { not: null },
            medicalFee: null,
          },
          include: {
            appointment: {
              include: {
                medicalRecord: {
                  select: {
                    id: true,
                    isFinalized: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
    );

    const drCaioTransactions = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.transaction.findMany({
          where: {
            tenantId,
            staffId: drCaio.id,
            type: 'income',
            appointmentId: { not: null },
            medicalFee: null,
          },
          include: {
            appointment: {
              include: {
                medicalRecord: {
                  select: {
                    id: true,
                    isFinalized: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
    );

    // 4. Analisar diferenças
    const draLaisFeesWithFinalized = draLaisFees.filter(
      (fee) =>
        !fee.transaction?.appointment ||
        fee.transaction.appointment.medicalRecord?.isFinalized === true,
    );

    const drCaioFeesWithFinalized = drCaioFees.filter(
      (fee) =>
        !fee.transaction?.appointment ||
        fee.transaction.appointment.medicalRecord?.isFinalized === true,
    );

    const draLaisTransactionsReady = draLaisTransactions.filter(
      (tx) => tx.appointment?.medicalRecord?.isFinalized === true,
    );

    const drCaioTransactionsReady = drCaioTransactions.filter(
      (tx) => tx.appointment?.medicalRecord?.isFinalized === true,
    );

    const result = {
      configurations: {
        draLais: {
          id: draLais.id,
          name: draLais.name,
          commissionType: draLais.commissionType,
          commissionRate: draLais.commissionRate?.toString(),
          fixedCommission: draLais.fixedCommission?.toString(),
        },
        drCaio: {
          id: drCaio.id,
          name: drCaio.name,
          commissionType: drCaio.commissionType,
          commissionRate: drCaio.commissionRate?.toString(),
          fixedCommission: drCaio.fixedCommission?.toString(),
        },
      },
      medicalFees: {
        draLais: {
          total: draLaisFees.length,
          withFinalizedRecord: draLaisFeesWithFinalized.length,
          filteredOut: draLaisFees.length - draLaisFeesWithFinalized.length,
          details: draLaisFees.map((fee) => ({
            id: fee.id,
            feeAmount: fee.feeAmount.toString(),
            createdAt: fee.createdAt,
            appointmentId: fee.transaction?.appointment?.id,
            hasMedicalRecord: !!fee.transaction?.appointment?.medicalRecord,
            isFinalized:
              fee.transaction?.appointment?.medicalRecord?.isFinalized,
            willShow:
              !fee.transaction?.appointment ||
              fee.transaction.appointment.medicalRecord?.isFinalized === true,
          })),
        },
        drCaio: {
          total: drCaioFees.length,
          withFinalizedRecord: drCaioFeesWithFinalized.length,
          filteredOut: drCaioFees.length - drCaioFeesWithFinalized.length,
          details: drCaioFees.map((fee) => ({
            id: fee.id,
            feeAmount: fee.feeAmount.toString(),
            createdAt: fee.createdAt,
            appointmentId: fee.transaction?.appointment?.id,
            hasMedicalRecord: !!fee.transaction?.appointment?.medicalRecord,
            isFinalized:
              fee.transaction?.appointment?.medicalRecord?.isFinalized,
            willShow:
              !fee.transaction?.appointment ||
              fee.transaction.appointment.medicalRecord?.isFinalized === true,
          })),
        },
      },
      transactionsWithoutFee: {
        draLais: {
          total: draLaisTransactions.length,
          withFinalizedRecord: draLaisTransactionsReady.length,
          readyForFee: draLaisTransactionsReady.length,
          details: draLaisTransactions.map((tx) => ({
            id: tx.id,
            amount: tx.amount.toString(),
            appointmentId: tx.appointmentId,
            createdAt: tx.createdAt,
            hasMedicalRecord: !!tx.appointment?.medicalRecord,
            isFinalized: tx.appointment?.medicalRecord?.isFinalized,
            canCreateFee: tx.appointment?.medicalRecord?.isFinalized === true,
          })),
        },
        drCaio: {
          total: drCaioTransactions.length,
          withFinalizedRecord: drCaioTransactionsReady.length,
          readyForFee: drCaioTransactionsReady.length,
          details: drCaioTransactions.map((tx) => ({
            id: tx.id,
            amount: tx.amount.toString(),
            appointmentId: tx.appointmentId,
            createdAt: tx.createdAt,
            hasMedicalRecord: !!tx.appointment?.medicalRecord,
            isFinalized: tx.appointment?.medicalRecord?.isFinalized,
            canCreateFee: tx.appointment?.medicalRecord?.isFinalized === true,
          })),
        },
      },
    };

    console.log(
      '[FinanceService.diagnoseMedicalFees] ✅ Diagnóstico concluído:',
      JSON.stringify(result, null, 2),
    );

    return result;
  }

  /**
   * Método para corrigir os repasses da Dra Lais
   * Cria repasses para todas as transações dela que ainda não têm repasse
   */
  async fixDraLaisFees(tenantId: string) {
    console.log(
      '[FinanceService.fixDraLaisFees] 🔧 Iniciando correção dos repasses da Dra Lais...',
    );

    // 1. Buscar a Dra Lais
    const draLais = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.staff.findFirst({
        where: {
          tenantId,
          name: { contains: 'Lais', mode: 'insensitive' },
        },
      });
    });

    if (!draLais) {
      return { error: 'Dra Lais não encontrada' };
    }

    console.log('[FinanceService.fixDraLaisFees] 📋 Dra Lais encontrada:', {
      id: draLais.id,
      name: draLais.name,
      commissionType: draLais.commissionType,
      commissionRate: draLais.commissionRate?.toString(),
      fixedCommission: draLais.fixedCommission?.toString(),
    });

    // 2. Verificar se precisa corrigir a configuração de comissão
    let configUpdated = false;
    if (
      draLais.commissionType === 'FIXED' &&
      (!draLais.fixedCommission || Number(draLais.fixedCommission) <= 0)
    ) {
      console.log(
        '[FinanceService.fixDraLaisFees] ⚠️ Dra Lais com tipo FIXED mas sem valor fixo configurado!',
      );
      // Assumir valor fixo de R$ 60,00 (mesmo do Dr Caio se for PERCENTAGE de 60%)
      await this.prisma.withTenant(tenantId, async (tx) => {
        return tx.staff.update({
          where: { id: draLais.id },
          data: { fixedCommission: 60 },
        });
      });
      console.log(
        '[FinanceService.fixDraLaisFees] ✅ Configurado fixedCommission = R$ 60,00',
      );
      configUpdated = true;
    }

    // Recarregar dados após possível atualização
    const draLaisUpdated = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.staff.findUnique({
          where: { id: draLais.id },
        });
      },
    );

    // 3. Buscar todas as transações da Dra Lais sem repasse
    const transactionsSemRepasse = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.transaction.findMany({
          where: {
            tenantId,
            staffId: draLais.id,
            type: 'income',
            medicalFee: null, // Sem repasse
          },
          include: {
            appointment: {
              include: {
                medicalRecord: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      },
    );

    console.log(
      `[FinanceService.fixDraLaisFees] 📊 Encontradas ${transactionsSemRepasse.length} transações sem repasse`,
    );

    // 4. Criar repasses para transações com prontuário finalizado
    const results = {
      configUpdated,
      draLaisConfig: {
        id: draLaisUpdated?.id,
        name: draLaisUpdated?.name,
        commissionType: draLaisUpdated?.commissionType,
        commissionRate: draLaisUpdated?.commissionRate?.toString(),
        fixedCommission: draLaisUpdated?.fixedCommission?.toString(),
      },
      transactionsFound: transactionsSemRepasse.length,
      feesCreated: 0,
      feesSkipped: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    for (const tx of transactionsSemRepasse) {
      const isFinalized = tx.appointment?.medicalRecord?.isFinalized === true;

      if (!isFinalized) {
        results.feesSkipped++;
        results.details.push({
          transactionId: tx.id,
          amount: tx.amount.toString(),
          status: 'skipped',
          reason: 'prontuário não finalizado',
        });
        continue;
      }

      try {
        // Calcular valor do repasse
        let feeAmount: number;
        const grossAmount = Number(tx.amount);

        if (draLaisUpdated?.commissionType === 'FIXED') {
          feeAmount = Number(draLaisUpdated.fixedCommission || 60);
        } else {
          const rate = Number(draLaisUpdated?.commissionRate || 60);
          feeAmount = (grossAmount * rate) / 100;
        }

        // Criar o repasse
        const medicalFeeData: any = {
          tenantId,
          staffId: draLais.id,
          transactionId: tx.id,
          grossAmount,
          feeAmount,
          status: 'pending',
        };

        // Incluir commissionRate se for percentual
        if (draLaisUpdated?.commissionType === 'PERCENTAGE') {
          medicalFeeData.commissionRate = Number(draLaisUpdated.commissionRate);
        }

        const medicalFee = await this.prisma.withTenant(tenantId, async (t) => {
          return t.medicalFee.create({
            data: medicalFeeData,
          });
        });

        results.feesCreated++;
        results.details.push({
          transactionId: tx.id,
          amount: tx.amount.toString(),
          feeId: medicalFee.id,
          feeAmount: feeAmount.toString(),
          status: 'created',
        });

        console.log(
          `[FinanceService.fixDraLaisFees] ✅ Repasse criado: ${medicalFee.id} - R$ ${feeAmount}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.errors.push(`Transação ${tx.id}: ${errorMessage}`);
        results.details.push({
          transactionId: tx.id,
          amount: tx.amount.toString(),
          status: 'error',
          error: errorMessage,
        });
        console.error(
          `[FinanceService.fixDraLaisFees] ❌ Erro ao criar repasse para transação ${tx.id}:`,
          error,
        );
      }
    }

    console.log(
      `[FinanceService.fixDraLaisFees] ✅ Correção concluída: ${results.feesCreated} repasses criados, ${results.feesSkipped} ignorados`,
    );

    return results;
  }

  /**
   * Diagnóstico PROFUNDO para entender o fluxo completo da Dra Lais
   * Verifica: appointments → transações → repasses
   */
  async diagnoseDeepDraLais(tenantId: string) {
    console.log(
      '[FinanceService.diagnoseDeepDraLais] 🔍 Iniciando diagnóstico profundo...',
    );

    // 1. Buscar a Dra Lais
    const draLais = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.staff.findFirst({
        where: {
          tenantId,
          name: { contains: 'Lais', mode: 'insensitive' },
        },
      });
    });

    if (!draLais) {
      return { error: 'Dra Lais não encontrada' };
    }

    // 2. Buscar TODOS os appointments da Dra Lais nos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const appointments: any[] = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.appointment.findMany({
          where: {
            tenantId,
            staffId: draLais.id,
            startTime: { gte: thirtyDaysAgo },
          },
          include: {
            patient: { select: { id: true, name: true } },
            medicalRecord: { select: { id: true, isFinalized: true } },
            transaction: {
              include: {
                medicalFee: true,
              },
            },
          },
          orderBy: { startTime: 'desc' },
        });
      },
    );

    // 3. Buscar TODAS as transações da Dra Lais (por staffId)
    const transactionsByStaffId: any[] = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.transaction.findMany({
          where: {
            tenantId,
            staffId: draLais.id,
          },
          include: {
            appointment: { select: { id: true, status: true } },
            medicalFee: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
    );

    // 4. Buscar transações que têm appointmentId de appointments da Dra Lais (mas podem não ter staffId)
    const appointmentIds = appointments.map((a) => a.id);
    const transactionsByAppointment: any[] = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.transaction.findMany({
          where: {
            tenantId,
            appointmentId: { in: appointmentIds },
          },
          include: {
            appointment: { select: { id: true, staffId: true, status: true } },
            medicalFee: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      },
    );

    // 5. Analisar
    const analysis = {
      draLais: {
        id: draLais.id,
        name: draLais.name,
        commissionType: draLais.commissionType,
        commissionRate: draLais.commissionRate?.toString(),
        fixedCommission: draLais.fixedCommission?.toString(),
      },
      appointments: {
        total: appointments.length,
        withMedicalRecord: appointments.filter((a) => a.medicalRecord).length,
        withFinalizedRecord: appointments.filter(
          (a) => a.medicalRecord?.isFinalized,
        ).length,
        withTransaction: appointments.filter((a) => a.transaction).length,
        withTransactionAndFee: appointments.filter(
          (a) => a.transaction?.medicalFee,
        ).length,
        details: appointments.map((a) => ({
          id: a.id,
          date: a.startTime,
          status: a.status,
          patient: a.patient?.name,
          hasMedicalRecord: !!a.medicalRecord,
          isFinalized: a.medicalRecord?.isFinalized || false,
          hasTransaction: !!a.transaction,
          transactionId: a.transaction?.id,
          transactionStaffId: a.transaction?.staffId,
          staffIdMatches: a.transaction?.staffId === draLais.id,
          hasFee: !!a.transaction?.medicalFee,
          feeId: a.transaction?.medicalFee?.id,
        })),
      },
      transactionsByStaffId: {
        total: transactionsByStaffId.length,
        withAppointment: transactionsByStaffId.filter((t) => t.appointmentId)
          .length,
        withFee: transactionsByStaffId.filter((t) => t.medicalFee).length,
        details: transactionsByStaffId.map((t) => ({
          id: t.id,
          amount: t.amount.toString(),
          createdAt: t.createdAt,
          staffId: t.staffId,
          appointmentId: t.appointmentId,
          hasFee: !!t.medicalFee,
        })),
      },
      transactionsByAppointment: {
        total: transactionsByAppointment.length,
        withCorrectStaffId: transactionsByAppointment.filter(
          (t) => t.staffId === draLais.id,
        ).length,
        withWrongStaffId: transactionsByAppointment.filter(
          (t) => t.staffId && t.staffId !== draLais.id,
        ).length,
        withoutStaffId: transactionsByAppointment.filter((t) => !t.staffId)
          .length,
        details: transactionsByAppointment.map((t) => ({
          id: t.id,
          amount: t.amount.toString(),
          createdAt: t.createdAt,
          staffId: t.staffId,
          appointmentId: t.appointmentId,
          appointmentStaffId: t.appointment?.staffId,
          staffIdMatches: t.staffId === draLais.id,
          hasFee: !!t.medicalFee,
          problem: !t.staffId
            ? 'SEM_STAFF_ID'
            : t.staffId !== draLais.id
              ? 'STAFF_ID_ERRADO'
              : null,
        })),
      },
      problemSummary: {
        appointmentsWithFinalizedRecordButNoTransaction: appointments.filter(
          (a) => a.medicalRecord?.isFinalized && !a.transaction,
        ).length,
        appointmentsWithTransactionButNoFee: appointments.filter(
          (a) =>
            a.transaction &&
            !a.transaction.medicalFee &&
            a.medicalRecord?.isFinalized,
        ).length,
        transactionsWithWrongStaffId: transactionsByAppointment.filter(
          (t) => t.staffId && t.staffId !== draLais.id,
        ).length,
        transactionsWithoutStaffId: transactionsByAppointment.filter(
          (t) => !t.staffId,
        ).length,
      },
    };

    console.log(
      '[FinanceService.diagnoseDeepDraLais] ✅ Diagnóstico completo:',
      JSON.stringify(analysis, null, 2),
    );

    return analysis;
  }

  /**
   * Corrige o staffId das transações que têm appointmentId mas staffId errado ou ausente
   */
  async fixTransactionStaffIds(tenantId: string) {
    console.log(
      '[FinanceService.fixTransactionStaffIds] 🔧 Iniciando correção de staffIds...',
    );

    // Buscar todas as transações que têm appointmentId
    const transactions: any[] = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        return tx.transaction.findMany({
          where: {
            tenantId,
            appointmentId: { not: null },
            type: 'income',
          },
          include: {
            appointment: {
              include: {
                staff: true,
                medicalRecord: true,
              },
            },
            medicalFee: true,
          },
        });
      },
    );

    const results = {
      total: transactions.length,
      fixed: 0,
      feesCreated: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    for (const tx of transactions) {
      const correctStaffId = tx.appointment?.staffId;
      const hasFee = !!tx.medicalFee;
      const isFinalized = tx.appointment?.medicalRecord?.isFinalized;

      // Se o staffId está errado ou ausente
      if (correctStaffId && tx.staffId !== correctStaffId) {
        try {
          await this.prisma.withTenant(tenantId, async (t) => {
            return t.transaction.update({
              where: { id: tx.id },
              data: { staffId: correctStaffId },
            });
          });
          results.fixed++;
          console.log(
            `[fixTransactionStaffIds] ✅ Transação ${tx.id} atualizada: staffId ${tx.staffId} → ${correctStaffId}`,
          );

          // Se não tem repasse e o prontuário está finalizado, criar
          if (!hasFee && isFinalized) {
            try {
              await this.createMedicalFeeRetroactively(
                tenantId,
                tx.appointmentId,
              );
              results.feesCreated++;
            } catch (feeError) {
              results.errors.push(
                `Repasse para ${tx.id}: ${feeError instanceof Error ? feeError.message : String(feeError)}`,
              );
            }
          }

          results.details.push({
            transactionId: tx.id,
            oldStaffId: tx.staffId,
            newStaffId: correctStaffId,
            status: 'fixed',
            feeCreated: !hasFee && isFinalized,
          });
        } catch (error) {
          results.errors.push(
            `Transação ${tx.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
          results.details.push({
            transactionId: tx.id,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        results.skipped++;
        results.details.push({
          transactionId: tx.id,
          staffId: tx.staffId,
          correctStaffId,
          status: 'ok',
          hasFee,
        });
      }
    }

    console.log(
      `[FinanceService.fixTransactionStaffIds] ✅ Correção concluída: ${results.fixed} corrigidos, ${results.feesCreated} repasses criados`,
    );

    return results;
  }
}
