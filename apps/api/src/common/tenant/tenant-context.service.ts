import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Service para gerenciar o contexto de tenant por request usando AsyncLocalStorage.
 * Permite que qualquer parte do código acesse o tenantId atual sem depender do objeto Request.
 */
@Injectable()
export class TenantContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<string>();

  /**
   * Executa uma função dentro de um contexto de tenant específico.
   * O tenantId ficará disponível para todas as operações assíncronas dentro do callback.
   *
   * @param tenantId - ID do tenant a ser usado no contexto
   * @param fn - Função a ser executada no contexto do tenant
   * @returns Resultado da função executada
   */
  run<T>(tenantId: string, fn: () => T): T {
    return this.asyncLocalStorage.run(tenantId, fn);
  }

  /**
   * Executa uma função assíncrona dentro de um contexto de tenant específico.
   *
   * @param tenantId - ID do tenant a ser usado no contexto
   * @param fn - Função assíncrona a ser executada no contexto do tenant
   * @returns Promise com o resultado da função executada
   */
  async runAsync<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.asyncLocalStorage.run(tenantId, fn);
  }

  /**
   * Obtém o tenantId do contexto atual.
   * Retorna null se não houver contexto de tenant ativo.
   *
   * @returns ID do tenant atual ou null se não houver contexto
   */
  getTenantId(): string | null {
    return this.asyncLocalStorage.getStore() || null;
  }

  /**
   * Verifica se há um contexto de tenant ativo.
   *
   * @returns true se houver contexto de tenant ativo, false caso contrário
   */
  hasTenant(): boolean {
    return this.getTenantId() !== null;
  }
}
