import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createSupplierDto: CreateSupplierDto) {
    return this.prisma.client.supplier.create({
      data: {
        ...createSupplierDto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.client.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const supplier = await this.prisma.client.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    return supplier;
  }

  async update(tenantId: string, id: string, updateSupplierDto: UpdateSupplierDto) {
    // Verificar se o fornecedor existe
    await this.findOne(tenantId, id);

    return this.prisma.client.supplier.update({
      where: { id },
      data: updateSupplierDto,
    });
  }

  async remove(tenantId: string, id: string) {
    // Verificar se o fornecedor existe
    await this.findOne(tenantId, id);

    return this.prisma.client.supplier.delete({
      where: { id },
    });
  }
}
