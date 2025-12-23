import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { prisma } from '@medflow/db';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = prisma;

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  /**
   * Define o contexto de tenant para o Row Level Security (RLS) no Postgres.
   * Deve ser chamado no início de cada request que precise isolamento.
   */
  async setTenantContext(tenantId: string) {
    await this.client.$executeRawUnsafe(
      `SET LOCAL medflow.current_tenant = '${tenantId}';`,
    );
  }
}

