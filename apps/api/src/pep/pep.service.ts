import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto, CreateAddendumDto } from './dto/pep.dto';

@Injectable()
export class PepService {
  constructor(private readonly prisma: PrismaService) {}

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
    const record = await this.findOne(tenantId, id);
    
    if (!record) {
      throw new BadRequestException('Prontuário não encontrado.');
    }

    if (record.isFinalized) {
      throw new ForbiddenException(
        'Este prontuário já foi finalizado e não pode mais ser editado. Use Adendos para correções.',
      );
    }

    return this.prisma.client.medicalRecord.update({
      where: { id, tenantId },
      data: dto,
    });
  }

  async finalize(tenantId: string, id: string) {
    const record = await this.findOne(tenantId, id);

    if (!record) {
      throw new BadRequestException('Prontuário não encontrado.');
    }

    if (record.isFinalized) {
      return record;
    }

    return this.prisma.client.medicalRecord.update({
      where: { id, tenantId },
      data: {
        isFinalized: true,
        finalizedAt: new Date(),
      },
    });
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

