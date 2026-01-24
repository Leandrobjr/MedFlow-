import { Injectable, OnModuleInit, OnModuleDestroy, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

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
   * 
   * @deprecated Use `withTenant()` para operações que precisam de garantia de isolamento.
   * Este método ainda é usado pelo TenantMiddleware para compatibilidade.
   */
  async setTenantContext(tenantId: string) {
    await this.client.$executeRawUnsafe(
      `SET LOCAL medflow.current_tenant = '${tenantId}';`,
    );
  }

  /**
   * Valida se uma string é um UUID válido.
   * 
   * @param uuid - String a ser validada
   * @returns true se for UUID válido, false caso contrário
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Executa uma função dentro de uma transação com o contexto de tenant configurado.
   * Garante que todas as queries dentro da função usem o RLS correto.
   * 
   * O método abre uma transação, configura `medflow.current_tenant` usando `set_config`,
   * valida que o contexto foi setado corretamente, e executa a função passada.
   * O contexto de tenant persiste durante toda a transação.
   * 
   * **FASE 2.4:** Garantias de robustez:
   * - Valida que tenantId é UUID válido
   * - Executa set_config('medflow.current_tenant', tenantId, true)
   * - Valida current_setting para confirmar que foi setado corretamente
   * - Tipagem correta com Prisma.TransactionClient
   * 
   * @param tenantId - ID do tenant a ser usado no contexto (deve ser UUID válido)
   * @param fn - Função a ser executada dentro da transação com contexto de tenant
   * @returns Promise com o resultado da função executada
   * 
   * @throws {BadRequestException} Se tenantId não for UUID válido
   * 
   * @example
   * ```typescript
   * const result = await prisma.withTenant(tenantId, async (tx) => {
   *   const patient = await tx.patient.findFirst({ where: { id } });
   *   const appointment = await tx.appointment.create({ data: {...} });
   *   return { patient, appointment };
   * });
   * ```
   */
  async withTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    // FASE 2.4: Garantir que o tenantId passado seja UUID válido
    if (!tenantId || typeof tenantId !== 'string' || !this.isValidUUID(tenantId)) {
      const errorMessage = `TenantId inválido: '${tenantId}'. Deve ser um UUID válido.`;
      this.logger.error(`[PrismaService.withTenant] ❌ ${errorMessage}`);
      throw new BadRequestException(errorMessage);
    }

    return this.client.$transaction(async (tx) => {
      // FASE 2.4: Executar set_config dentro da transação
      await tx.$executeRaw`
        SELECT set_config('medflow.current_tenant', ${tenantId}::text, true)
      `;

      this.logger.debug(
        `[PrismaService.withTenant] ✅ set_config aplicado para tenant: ${tenantId}`,
      );

      // FASE 2.4: Validar que o contexto foi setado corretamente
      const validationResult = await tx.$queryRaw<Array<{ current_setting: string | null }>>`
        SELECT current_setting('medflow.current_tenant', true) as current_setting
      `;

      const currentTenantId = validationResult[0]?.current_setting;

      if (!currentTenantId || currentTenantId !== tenantId) {
        const errorMessage = `Falha ao configurar contexto de tenant. Esperado: ${tenantId}, Obtido: ${currentTenantId || 'null'}.`;
        this.logger.error(`[PrismaService.withTenant] ❌ ${errorMessage}`);
        throw new BadRequestException(errorMessage);
      }

      this.logger.debug(
        `[PrismaService.withTenant] ✅ Validação: contexto de tenant confirmado: ${currentTenantId}`,
      );

      // Executar a função passada com o cliente de transação (tipagem correta: Prisma.TransactionClient)
      return await fn(tx);
    });
  }
}


