import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private _client: PrismaClient | null = null;
  
  get client(): PrismaClient {
    if (!this._client) {
      const databaseUrl = process.env.DATABASE_URL;
      this.logger.log(`[DEBUG] Criando PrismaClient com DATABASE_URL: ${databaseUrl ? databaseUrl.replace(/:[^:@]+@/, ':****@') : 'NÃO DEFINIDA'}`);
      
      this._client = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      });
    }
    return this._client;
  }

  async onModuleInit() {
    const databaseUrl = process.env.DATABASE_URL;
    this.logger.log(`[DEBUG] Tentando conectar ao banco de dados...`);
    this.logger.log(`[DEBUG] DATABASE_URL configurada: ${databaseUrl ? databaseUrl.replace(/:[^:@]+@/, ':****@') : 'NÃO DEFINIDA'}`);
    
    const maxRetries = 5;
    const retryDelay = 2000; // 2 segundos
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`[DEBUG] Tentativa de conexão ${attempt}/${maxRetries}...`);
        await this.client.$connect();
        this.logger.log(`[DEBUG] ✅ Conexão estabelecida com sucesso na tentativa ${attempt}`);
        return;
      } catch (error: any) {
        this.logger.error(`[DEBUG] ❌ Falha na tentativa ${attempt}/${maxRetries}: ${error.message}`);
        this.logger.error(`[DEBUG] Error code: ${error.code}, Error name: ${error.name}`);
        
        if (attempt < maxRetries) {
          this.logger.log(`[DEBUG] Aguardando ${retryDelay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          this.logger.error(`[DEBUG] ❌ Todas as ${maxRetries} tentativas falharam. Erro final:`, error);
          throw error;
        }
      }
    }
  }

  async onModuleDestroy() {
    if (this._client) {
      this.logger.log(`[DEBUG] Desconectando do banco de dados...`);
      await this._client.$disconnect();
      this._client = null;
    }
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


