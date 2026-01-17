import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createPatientDto: CreatePatientDto) {
    // Verificar se CPF já existe no tenant
    const existingPatient = await this.prisma.client.patient.findFirst({
      where: {
        cpf: createPatientDto.cpf,
        tenantId,
      },
    });

    if (existingPatient) {
      throw new ConflictException('CPF já cadastrado no sistema');
    }

    return this.prisma.client.patient.create({
      data: {
        ...createPatientDto,
        birthDate: new Date(createPatientDto.birthDate),
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.client.patient.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const patient = await this.prisma.client.patient.findFirst({
      where: { id, tenantId },
    });
    
    console.log('[PatientsService.findOne] Paciente encontrado:', { 
      id: patient?.id, 
      name: patient?.name,
      allergies: patient?.allergies,
      medications: patient?.medications,
    });
    
    return patient;
  }

  async update(tenantId: string, id: string, updatePatientDto: any) {
    console.log('[PatientsService.update] Iniciando atualização:', { tenantId, id, updatePatientDto });
    
    // Se estiver atualizando o CPF, verificar se não existe outro paciente com o mesmo CPF
    if (updatePatientDto.cpf) {
      const existingPatient = await this.prisma.client.patient.findFirst({
        where: {
          cpf: updatePatientDto.cpf,
          tenantId,
          NOT: { id },
        },
      });

      if (existingPatient) {
        throw new ConflictException('CPF já cadastrado no sistema');
      }
    }

    if (updatePatientDto.birthDate) {
      updatePatientDto.birthDate = new Date(updatePatientDto.birthDate);
    }
    
    const updated = await this.prisma.client.patient.update({
      where: { id, tenantId },
      data: updatePatientDto,
    });
    
    console.log('[PatientsService.update] Paciente atualizado:', { 
      id: updated.id, 
      name: updated.name,
      allergies: updated.allergies,
      medications: updated.medications,
    });
    
    return updated;
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.client.patient.delete({
      where: { id, tenantId },
    });
  }
}


