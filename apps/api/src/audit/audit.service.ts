import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    tenantId: string;
    userId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      return await this.prisma.withTenant(data.tenantId, async (tx) => {
        return tx.auditLog.create({
          data: {
            tenantId: data.tenantId,
            userId: data.userId,
            action: data.action,
            entity: data.entity,
            entityId: data.entityId,
            metadata: data.metadata,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
          },
        });
      });
    } catch (error) {
      // Falha no log não deve travar a aplicação, mas deve ser logada no console
      console.error('Failed to create audit log:', error);
    }
  }
}
