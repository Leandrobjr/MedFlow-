export * from '@prisma/client';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Helper para aplicar o RLS na sessão atual do banco.
 * No PostgreSQL, isso é feito definindo uma variável de configuração local.
 */
export const setTenantContext = async (tenantId: string) => {
  await prisma.$executeRawUnsafe(`SET LOCAL medflow.current_tenant = '${tenantId}';`);
};

