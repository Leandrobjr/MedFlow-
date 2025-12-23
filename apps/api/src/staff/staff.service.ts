import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createStaffDto: CreateStaffDto) {
    return this.prisma.client.staff.create({
      data: {
        ...createStaffDto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.client.staff.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.client.staff.findFirst({
      where: { id, tenantId },
      include: { user: true },
    });
  }

  async update(tenantId: string, id: string, updateStaffDto: any) {
    return this.prisma.client.staff.update({
      where: { id, tenantId },
      data: updateStaffDto,
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.client.staff.delete({
      where: { id, tenantId },
    });
  }
}

