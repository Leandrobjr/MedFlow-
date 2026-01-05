import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';

@Injectable()
export class ProceduresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createProcedureDto: CreateProcedureDto) {
    return this.prisma.client.procedure.create({
      data: {
        ...createProcedureDto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.client.procedure.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const procedure = await this.prisma.client.procedure.findFirst({
      where: { id, tenantId },
    });

    if (!procedure) {
      throw new NotFoundException('Procedimento não encontrado');
    }

    return procedure;
  }

  async update(tenantId: string, id: string, updateProcedureDto: UpdateProcedureDto) {
    // Verificar se o procedimento existe
    await this.findOne(tenantId, id);

    return this.prisma.client.procedure.update({
      where: { id },
      data: updateProcedureDto,
    });
  }

  async remove(tenantId: string, id: string) {
    // Verificar se o procedimento existe
    await this.findOne(tenantId, id);

    return this.prisma.client.procedure.delete({
      where: { id },
    });
  }
}
