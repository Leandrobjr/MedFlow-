import { Injectable, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto, CreateAddendumDto } from './dto/pep.dto';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class PepService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FinanceService))
    private readonly financeService: FinanceService,
  ) {}

  async create(tenantId: string, dto: CreateMedicalRecordDto) {
    // Verificar se já existe um prontuário para este agendamento
    const existing = await this.prisma.client.medicalRecord.findUnique({
      where: { appointmentId: dto.appointmentId },
    });

    if (existing) {
      throw new BadRequestException('Já existe um prontuário para este atendimento.');
    }

    return this.prisma.client.medicalRecord.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findByPatient(tenantId: string, patientId: string) {
    return this.prisma.client.medicalRecord.findMany({
      where: { patientId, tenantId },
      include: {
        staff: { select: { name: true, specialty: true } },
        addendums: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.client.medicalRecord.findFirst({
      where: { id, tenantId },
      include: {
        patient: true,
        staff: true,
        addendums: true,
        appointment: true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateMedicalRecordDto) {
    console.log('[PepService.update] Iniciando atualização:', { tenantId, id, dto });
    
    const record = await this.findOne(tenantId, id);
    
    if (!record) {
      console.error('[PepService.update] Prontuário não encontrado:', id);
      throw new BadRequestException('Prontuário não encontrado.');
    }

    console.log('[PepService.update] Prontuário encontrado:', { 
      id: record.id, 
      isFinalized: record.isFinalized,
      patientId: record.patientId,
    });

    if (record.isFinalized) {
      console.error('[PepService.update] Prontuário já finalizado:', id);
      throw new ForbiddenException(
        'Este prontuário já foi finalizado e não pode mais ser editado. Use Adendos para correções.',
      );
    }

    console.log('[PepService.update] Atualizando prontuário com dados:', dto);
    
    const updated = await this.prisma.client.medicalRecord.update({
      where: { id, tenantId },
      data: dto,
      include: {
        staff: { select: { name: true, specialty: true } },
        appointment: true,
        addendums: true,
      },
    });
    
    console.log('[PepService.update] Prontuário atualizado com sucesso:', {
      id: updated.id,
      anamnesis: updated.anamnesis?.substring(0, 50) || null,
      diagnosis: updated.diagnosis?.substring(0, 50) || null,
      isFinalized: updated.isFinalized,
      appointmentId: updated.appointmentId,
    });
    
    // Se o prontuário foi finalizado nesta atualização, tentar criar repasse retroativamente
    if (updated.isFinalized && updated.appointmentId && !record.isFinalized) {
      console.log(`[PepService.update] ⚠️ Prontuário foi finalizado via update. Tentando criar repasse retroativamente para appointment: ${updated.appointmentId}`);
      try {
        await this.financeService.createMedicalFeeRetroactively(tenantId, updated.appointmentId);
        console.log(`[PepService.update] ✅ Repasse criado com sucesso após finalização via update.`);
      } catch (error) {
        console.error(`[PepService.update] ❌ ERRO ao criar repasse retroativamente após update:`, error);
        // Não falhar a atualização por causa do repasse
      }
    }
    
    // Retornar com os dados atualizados incluindo addendums
    return updated;
  }

  async finalize(tenantId: string, id: string) {
    const record = await this.findOne(tenantId, id);

    if (!record) {
      throw new BadRequestException('Prontuário não encontrado.');
    }

    // Se já estiver finalizado, ainda assim verificar se precisa criar repasse
    if (record.isFinalized) {
      // Verificar se precisa criar repasse retroativamente (caso tenha sido finalizado antes da implementação)
      if (record.appointmentId) {
        try {
          console.log(`[PepService.finalize] Prontuário já finalizado. Verificando se precisa criar repasse retroativamente para appointment: ${record.appointmentId}`);
          await this.financeService.createMedicalFeeRetroactively(tenantId, record.appointmentId);
        } catch (error) {
          console.error(`[PepService.finalize] Erro ao criar repasse retroativamente:`, error);
        }
      }
      return record;
    }

    // Atualizar prontuário e mudar status do appointment para completed
    const updatedRecord = await this.prisma.client.medicalRecord.update({
      where: { id, tenantId },
      data: {
        isFinalized: true,
        finalizedAt: new Date(),
      },
    });

    // Atualizar status do appointment para completed
    if (record.appointmentId) {
      await this.prisma.client.appointment.update({
        where: { id: record.appointmentId },
        data: { status: 'completed' },
      });

      // Criar repasse retroativamente se a transação foi criada antes do prontuário ser finalizado
      try {
        console.log(`[PepService.finalize] ✅ Prontuário finalizado. Tentando criar repasse retroativamente para appointment: ${record.appointmentId}`);
        console.log(`[PepService.finalize] DEBUG - Dados do prontuário:`, {
          prontuarioId: record.id,
          appointmentId: record.appointmentId,
          isFinalized: updatedRecord.isFinalized,
          finalizedAt: updatedRecord.finalizedAt,
        });
        await this.financeService.createMedicalFeeRetroactively(tenantId, record.appointmentId);
        console.log(`[PepService.finalize] ✅ Método createMedicalFeeRetroactively concluído sem erros.`);
      } catch (error) {
        // Log do erro mas não falha a finalização do prontuário
        console.error(`[PepService.finalize] ❌ ERRO ao criar repasse retroativamente:`, error);
        console.error(`[PepService.finalize] ❌ Stack trace:`, error instanceof Error ? error.stack : 'N/A');
      }
    }

    return updatedRecord;
  }

  async addAddendum(tenantId: string, recordId: string, dto: CreateAddendumDto) {
    const record = await this.findOne(tenantId, recordId);

    if (!record) {
      throw new BadRequestException('Prontuário não encontrado.');
    }

    // Adendos só fazem sentido em prontuários finalizados, 
    // mas o PRD permite a qualquer momento para retificações oficiais.
    return this.prisma.client.medicalAddendum.create({
      data: {
        medicalRecordId: recordId,
        content: dto.content,
      },
    });
  }
}

