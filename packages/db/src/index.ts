export * from '@prisma/client';
import { PrismaClient } from '@prisma/client';

// Lazy initialization para evitar conexão prematura
// Use PrismaService do NestJS em vez deste export direto
let _prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!_prismaClient) {
    _prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return _prismaClient;
}

// Mantido para compatibilidade, mas não deve ser usado diretamente
// Prefira usar PrismaService do NestJS
export const prisma = getPrismaClient();

