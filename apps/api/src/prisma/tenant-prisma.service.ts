import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';

/**
 * Service que facilita o uso do Prisma com contexto de tenant.
 *
 * Este service abstrai a necessidade de passar tenantId manualmente,
 * obtendo-o automaticamente do TenantContextService e executando
 * operações dentro de uma transação com RLS configurado.
 *
 * **REGRAS DE USO:**
 *
 * 1. **Operações múltiplas (2+ queries) ou mutations:** SEMPRE use `run()`
 *    - Garante isolamento determinístico dentro de uma transação
 *    - Exemplo: criar agendamento + atualizar paciente
 *
 * 2. **Leituras simples (GET com 1 query):** Prefira `run()`
 *    - O tenant context é aplicado **dentro da transação** (pooler-safe)
 *    - Evite depender de `this.prisma.client` para RLS, pois pode usar outra conexão
 *
 * 3. **Endpoints críticos (financeiro, prontuário):** OBRIGATÓRIO usar `run()`
 */
@Injectable()
export class TenantPrismaService {
  private readonly logger = new Logger(TenantPrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Executa uma função dentro de uma transação com contexto de tenant configurado.
   * O tenantId é obtido automaticamente do contexto do request atual.
   *
   * **IMPORTANTE:** Este método sempre executa dentro de uma transação ($transaction).
   * Mesmo para leituras simples (GET), prefira `run()` para garantir isolamento determinístico.
   *
   * @param fn - Função a ser executada dentro da transação com contexto de tenant
   * @returns Promise com o resultado da função executada
   *
   * @throws {BadRequestException} Se não houver contexto de tenant ativo (HTTP 400)
   *
   * @example
   * ```typescript
   * // Operações múltiplas (OBRIGATÓRIO usar run)
   * const result = await this.tenantPrisma.run(async (tx) => {
   *   const patient = await tx.patient.findFirst({ where: { id } });
   *   const appointment = await tx.appointment.create({ data: {...} });
   *   return { patient, appointment };
   * });
   * ```
   */
  async run<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    // FASE 2.3: Validar se há tenant no AsyncLocalStorage
    const tenantId = this.tenantContext.getTenantId();

    if (!tenantId) {
      const errorMessage =
        'Tenant obrigatório. Certifique-se de que o TenantMiddleware está configurado corretamente.';
      this.logger.error(`[TenantPrismaService.run] ❌ ${errorMessage}`);
      throw new BadRequestException(errorMessage);
    }

    this.logger.debug(
      `[TenantPrismaService.run] 🔄 Executando operação com tenant: ${tenantId}`,
    );

    // FASE 2.3: Garantir que callback sempre roda dentro de withTenant (transação)
    return this.prisma.withTenant(tenantId, async (tx) => {
      // Guarda de segurança: verificar se o contexto de tenant está realmente setado
      const currentTenant = await tx.$queryRaw<
        Array<{ current_setting: string | null }>
      >`
        SELECT current_setting('medflow.current_tenant', true) as current_setting
      `;

      const setTenantId = currentTenant[0]?.current_setting;

      if (!setTenantId || setTenantId !== tenantId) {
        const errorMessage = `Tenant context não setado corretamente. Esperado: ${tenantId}, Obtido: ${setTenantId || 'null'}. Verifique TenantMiddleware.`;
        this.logger.error(`[TenantPrismaService.run] ❌ ${errorMessage}`);
        throw new BadRequestException(errorMessage);
      }

      this.logger.debug(
        `[TenantPrismaService.run] ✅ Guarda de segurança: contexto de tenant verificado: ${setTenantId}`,
      );

      // Executar a função passada dentro da transação
      return await fn(tx);
    });
  }

  /**
   * Verifica se há um contexto de tenant ativo.
   *
   * @returns true se houver contexto de tenant ativo, false caso contrário
   */
  hasTenant(): boolean {
    return this.tenantContext.hasTenant();
  }

  /**
   * Obtém o tenantId do contexto atual.
   *
   * @returns ID do tenant atual ou null se não houver contexto
   */
  getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }
}
