import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private _client: PrismaClient | null = null;
  private _isConnected = false;
  
  get client(): PrismaClient {
    if (!this._client) {
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        this.logger.error(`[DEBUG] ❌ DATABASE_URL não está definida nas variáveis de ambiente!`);
        throw new Error('DATABASE_URL não está configurada. Verifique o arquivo .env');
      }
      
      this.logger.log(`[DEBUG] Criando PrismaClient com DATABASE_URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
      
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
    
    if (!databaseUrl) {
      this.logger.error(`[DEBUG] ❌ DATABASE_URL não está definida nas variáveis de ambiente!`);
      throw new Error('DATABASE_URL não está configurada. Verifique o arquivo .env');
    }
    
    this.logger.log(`[DEBUG] ========================================`);
    this.logger.log(`[DEBUG] Iniciando conexão com o banco de dados...`);
    this.logger.log(`[DEBUG] DATABASE_URL configurada: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
    this.logger.log(`[DEBUG] ========================================`);
    
    const maxRetries = 10;
    const baseRetryDelay = 2000; // 2 segundos base
    const maxRetryDelay = 10000; // 10 segundos máximo
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`[DEBUG] Tentativa de conexão ${attempt}/${maxRetries}...`);
        
        // Criar cliente se ainda não existe
        const client = this.client;
        
        // Tentar conectar
        await client.$connect();
        
        // Verificar saúde da conexão com uma query simples
        await client.$queryRaw`SELECT 1 as health_check`;
        
        this._isConnected = true;
        this.logger.log(`[DEBUG] ========================================`);
        this.logger.log(`[DEBUG] ✅ Conexão estabelecida com sucesso na tentativa ${attempt}`);
        this.logger.log(`[DEBUG] ========================================`);
        return;
      } catch (error: any) {
        const errorCode = error.code || 'UNKNOWN';
        const errorName = error.name || 'UnknownError';
        const errorMessage = error.message || 'Erro desconhecido';
        
        this.logger.error(`[DEBUG] ❌ Falha na tentativa ${attempt}/${maxRetries}`);
        this.logger.error(`[DEBUG] Error code: ${errorCode}`);
        this.logger.error(`[DEBUG] Error name: ${errorName}`);
        this.logger.error(`[DEBUG] Error message: ${errorMessage}`);
        
        if (attempt < maxRetries) {
          // Delay progressivo: aumenta com cada tentativa
          const retryDelay = Math.min(baseRetryDelay * attempt, maxRetryDelay);
          this.logger.log(`[DEBUG] Aguardando ${retryDelay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          this.logger.error(`[DEBUG] ========================================`);
          this.logger.error(`[DEBUG] ❌ Todas as ${maxRetries} tentativas falharam!`);
          this.logger.error(`[DEBUG] Erro final: ${errorMessage}`);
          this.logger.error(`[DEBUG] ========================================`);
          
          // Limpar cliente em caso de falha total
          if (this._client) {
            try {
              await this._client.$disconnect();
            } catch (disconnectError) {
              // Ignorar erros ao desconectar
            }
            this._client = null;
          }
          
          throw new Error(
            `Não foi possível conectar ao banco de dados após ${maxRetries} tentativas. ` +
            `Verifique se o Docker container está rodando e se a DATABASE_URL está correta. ` +
            `Erro: ${errorMessage}`
          );
        }
      }
    }
  }

  async onModuleDestroy() {
    if (this._client && this._isConnected) {
      this.logger.log(`[DEBUG] Desconectando do banco de dados...`);
      try {
        await this._client.$disconnect();
        this._isConnected = false;
        this.logger.log(`[DEBUG] ✅ Desconectado com sucesso`);
      } catch (error: any) {
        this.logger.error(`[DEBUG] ❌ Erro ao desconectar: ${error.message}`);
      } finally {
        this._client = null;
      }
    }
  }

  /**
   * Verifica se a conexão com o banco está ativa
   */
  async isConnected(): Promise<boolean> {
    if (!this._client || !this._isConnected) {
      return false;
    }
    
    try {
      await this._client.$queryRaw`SELECT 1 as health_check`;
      return true;
    } catch {
      this._isConnected = false;
      return false;
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


