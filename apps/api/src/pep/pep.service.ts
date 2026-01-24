import { Injectable, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto, CreateAddendumDto } from './dto/pep.dto';
import { FinanceService } from '../finance/finance.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(forwardRef(() => FinanceService))
    private readonly financeService: FinanceService,
    private readonly auditService: AuditService,
  ) {}

  async create(tenantId: string, dto: CreateMedicalRecordDto, auditContext?: { userId: string; ip?: string; ua?: string }) {
    // Verificar se já existe um prontuário para este agendamento
    const existing = await this.prisma.client.medicalRecord.findUnique({
      where: { appointmentId: dto.appointmentId },
    });

    if (existing) {
      throw new BadRequestException('Já existe um prontuário para este atendimento.');
    }

    const record = await this.prisma.client.medicalRecord.create({
      data: {
        ...dto,
        tenantId,
      },
    });

    if (auditContext) {
      /*
      await this.auditService.log({
        tenantId,
        userId: auditContext.userId,
        action: 'CREATE_MEDICAL_RECORD',
        entity: 'MedicalRecord',
        entityId: record.id,
        ipAddress: auditContext.ip,
        userAgent: auditContext.ua,
        metadata: { appointmentId: dto.appointmentId, patientId: dto.patientId },
      });
      */
    }

    return record;
  }

  async findByPatient(tenantId: string, patientId: string) {
    return this.prisma.client.medicalRecord.findMany({
      where: { patientId, tenantId },
      include: {
        staff: {
          select: {
            name: true,
            specialty: true,
            crm: true,
            crmState: true,
          },
        },
        addendums: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string, auditContext?: { userId: string; ip?: string; ua?: string }) {
    const record = await this.prisma.client.medicalRecord.findFirst({
      where: { id, tenantId },
      include: {
        patient: true,
        staff: true,
        addendums: true,
        appointment: true,
      },
    });

    if (record && auditContext) {
      /*
      await this.auditService.log({
        tenantId,
        userId: auditContext.userId,
        action: 'READ_MEDICAL_RECORD',
        entity: 'MedicalRecord',
        entityId: id,
        ipAddress: auditContext.ip,
        userAgent: auditContext.ua,
        metadata: { patientId: record.patientId },
      });
      */
    }

    return record;
  }

  async update(tenantId: string, id: string, dto: UpdateMedicalRecordDto, auditContext?: { userId: string; ip?: string; ua?: string }) {
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
        staff: {
          select: {
            name: true,
            specialty: true,
            crm: true,
            crmState: true,
          },
        },
        appointment: true,
        addendums: true,
      },
    });

    if (auditContext) {
      /*
      await this.auditService.log({
        tenantId,
        userId: auditContext.userId,
        action: 'UPDATE_MEDICAL_RECORD',
        entity: 'MedicalRecord',
        entityId: id,
        ipAddress: auditContext.ip,
        userAgent: auditContext.ua,
        metadata: { changes: dto },
      });
      */
    }
    
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

  async finalize(tenantId: string, id: string, auditContext?: { userId: string; ip?: string; ua?: string }) {
    const record = await this.findOne(tenantId, id);

    if (!record) {
      throw new BadRequestException('Prontuário não encontrado.');
    }

    // Se já estiver finalizado, ainda assim verificar se precisa criar repasse
    if (record.isFinalized) {
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

    // Usar tenantPrisma.run para garantir isolamento determinístico em múltiplas operações
    const updatedRecord = await this.tenantPrisma.run(async (tx) => {
      // Atualizar prontuário e mudar status do appointment para completed dentro da mesma transação
      const updated = await tx.medicalRecord.update({
        where: { id, tenantId },
        data: {
          isFinalized: true,
          finalizedAt: new Date(),
        },
      });

      // Atualizar status do appointment para completed dentro da mesma transação
      if (record.appointmentId) {
        await tx.appointment.update({
          where: { id: record.appointmentId },
          data: { status: 'completed' },
        });
      }

      return updated;
    });

    if (auditContext) {
      /*
      await this.auditService.log({
        tenantId,
        userId: auditContext.userId,
        action: 'FINALIZE_MEDICAL_RECORD',
        entity: 'MedicalRecord',
        entityId: id,
        ipAddress: auditContext.ip,
        userAgent: auditContext.ua,
        metadata: { appointmentId: record.appointmentId },
      });
      */
    }

    // Criar repasse retroativamente após a transação (operação separada que pode falhar sem afetar a finalização)
    if (record.appointmentId) {
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

  async addAddendum(tenantId: string, recordId: string, dto: CreateAddendumDto, auditContext?: { userId: string; ip?: string; ua?: string }) {
    const record = await this.findOne(tenantId, recordId);

    if (!record) {
      throw new BadRequestException('Prontuário não encontrado.');
    }

    const addendum = await this.prisma.client.medicalAddendum.create({
      data: {
        medicalRecordId: recordId,
        content: dto.content,
      },
    });

    if (auditContext) {
      /*
      await this.auditService.log({
        tenantId,
        userId: auditContext.userId,
        action: 'ADD_ADDENDUM_TO_MEDICAL_RECORD',
        entity: 'MedicalRecord',
        entityId: recordId,
        ipAddress: auditContext.ip,
        userAgent: auditContext.ua,
        metadata: { addendumId: addendum.id },
      });
      */
    }

    return addendum;
  }
}

