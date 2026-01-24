import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Gera um requestId único para rastreamento de logs
   */
  private generateRequestId(): string {
    return randomUUID().substring(0, 8);
  }

  /**
   * Valida e sanitiza o slug do tenant.
   * Regras:
   * - Apenas caracteres [a-z0-9-] (lowercase)
   * - Tamanho mínimo: 3 caracteres
   * - Tamanho máximo: 63 caracteres (limite DNS para subdomínios)
   * - Não pode começar ou terminar com hífen
   * - Não pode ter hífens consecutivos
   * 
   * @param slug - Slug a ser validado
   * @returns Slug sanitizado e validado, ou null se inválido
   */
  private validateAndSanitizeSlug(slug: string): string | null {
    if (!slug || typeof slug !== 'string') {
      return null;
    }

    // Trim e converter para lowercase
    const trimmed = slug.trim().toLowerCase();

    // Validar tamanho
    const MIN_LENGTH = 3;
    const MAX_LENGTH = 63;
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      return null;
    }

    // Validar formato: apenas [a-z0-9-]
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(trimmed)) {
      return null;
    }

    // Não pode começar ou terminar com hífen
    if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
      return null;
    }

    // Não pode ter hífens consecutivos
    if (trimmed.includes('--')) {
      return null;
    }

    return trimmed;
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const requestId = this.generateRequestId();
    const endpoint = `${req.method} ${req.path}`;

    // Bypass apenas para rotas explicitamente públicas (healthcheck)
    // NOTA: Rotas de auth NÃO têm bypass porque precisam do tenant para funcionar
    const publicPaths = ['/health', '/api/health'];
    if (publicPaths.includes(req.path)) {
      return next();
    }

    let slug: string | null = null;
    let resolutionSource: string | null = null;

    // FASE 1: Regras de resolução de tenant baseadas no ambiente

    // 1) Header x-tenant-slug: APENAS em DEV/TEST (ignorado em PRODUÇÃO por segurança)
    if (this.isDevelopment) {
      const headerSlug = (req.headers['x-tenant-slug'] || req.headers['X-Tenant-Slug'] || req.headers['X-TENANT-SLUG']) as string;
      if (headerSlug && headerSlug.trim()) {
        slug = headerSlug.trim();
        resolutionSource = 'header-x-tenant-slug';
        console.log(`[TENANT] [${requestId}] ✅ Slug obtido do header x-tenant-slug: ${slug} | Endpoint: ${endpoint}`);
      }
    } else {
      // Em produção, ignorar header x-tenant-slug (pode ser falsificado pelo client)
      const headerSlug = req.headers['x-tenant-slug'] || req.headers['X-Tenant-Slug'] || req.headers['X-TENANT-SLUG'];
      if (headerSlug) {
        console.warn(`[TENANT] [${requestId}] ⚠️ Header x-tenant-slug ignorado em produção (segurança) | Endpoint: ${endpoint}`);
      }
    }

    // 2) Host com subdomínio: <slug>.dominio (prioridade em produção)
    if (!slug) {
      const host = req.headers.host || '';
      const parts = host.split('.');
      if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== '127.0.0.1' && parts[0] !== 'www') {
        slug = parts[0];
        resolutionSource = 'host-subdomain';
        console.log(`[TENANT] [${requestId}] ✅ Slug obtido do subdomínio do Host: ${slug} | Endpoint: ${endpoint}`);
      }
    }

    // 3) Referer: APENAS em DEV/TEST e apenas se host for localhost (não usado em produção por segurança)
    if (!slug && this.isDevelopment) {
      const host = req.headers.host || '';
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        const referer = req.headers.referer || '';
        if (referer) {
          try {
            const url = new URL(referer);
            const refererParts = url.hostname.split('.');
            if (refererParts.length > 1 && refererParts[0] !== 'localhost' && refererParts[0] !== '127.0.0.1' && refererParts[0] !== 'www') {
              slug = refererParts[0];
              resolutionSource = 'referer';
              console.log(`[TENANT] [${requestId}] ✅ Slug obtido do Referer: ${slug} | Endpoint: ${endpoint}`);
            }
          } catch (e) {
            // Referer inválido, ignora
          }
        }
      }
    }

    // 4) Fallback DEV: primeiro tenant do banco (apenas em desenvolvimento/teste)
    if (!slug && this.isDevelopment) {
      console.warn(`[TENANT] [${requestId}] ⚠️ Nenhum slug encontrado. Tentando fallback para primeiro tenant do banco... | Endpoint: ${endpoint}`);
      const firstTenant = await this.prisma.client.tenant.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      if (firstTenant) {
        slug = firstTenant.slug;
        resolutionSource = 'fallback-first-tenant';
        console.warn(`[TENANT] [${requestId}] ⚠️ Usando fallback (primeiro tenant): ${slug} | Endpoint: ${endpoint}`);
      }
    }

    // Se ainda não tiver slug, retornar erro 400 (Bad Request) com mensagem clara
    if (!slug) {
      const errorMsg = this.isProduction
        ? 'Tenant não identificado. Em produção, configure o subdomínio corretamente (ex: medflow.dominio.com).'
        : 'Tenant não identificado. Use header x-tenant-slug, configure subdomínio ou certifique-se de que há tenants no banco.';
      
      console.error(`[TENANT] [${requestId}] ❌ ${errorMsg} | Endpoint: ${endpoint}`);
      throw new BadRequestException(errorMsg);
    }

    // FASE 1.2: Validação forte do slug (sanitização e validação)
    const sanitizedSlug = this.validateAndSanitizeSlug(slug);
    if (!sanitizedSlug) {
      const errorMsg = `Slug de tenant inválido: '${slug}'. O slug deve conter apenas letras minúsculas, números e hífens, ter entre 3 e 63 caracteres, e não pode começar/terminar com hífen.`;
      console.error(`[TENANT] [${requestId}] ❌ ${errorMsg} | Endpoint: ${endpoint}`);
      throw new BadRequestException(errorMsg);
    }

    // Usar o slug sanitizado
    slug = sanitizedSlug;

    // Buscar tenant no banco pelo slug (resolver slug -> tenantId)
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
      },
    });

    if (!tenant) {
      const errorMsg = `Tenant '${slug}' não encontrado no banco de dados.`;
      console.error(`[TENANT] [${requestId}] ❌ ${errorMsg} | Slug: ${slug} | Endpoint: ${endpoint}`);
      throw new BadRequestException(errorMsg);
    }

    // Validar que o tenant está ativo
    if (tenant.status !== 'active') {
      const errorMsg = `Tenant '${slug}' está inativo.`;
      console.error(`[TENANT] [${requestId}] ❌ ${errorMsg} | Slug: ${slug} | TenantId: ${tenant.id} | Endpoint: ${endpoint}`);
      throw new BadRequestException(errorMsg);
    }

    // Log de sucesso (sem vazar dados sensíveis)
    console.log(`[TENANT] [${requestId}] ✅ Tenant resolvido | Slug: ${tenant.slug} | TenantId: ${tenant.id} | Source: ${resolutionSource} | Endpoint: ${endpoint}`);

    (req as any)['tenantId'] = tenant.id;
    
    // Seta o contexto no banco para o RLS (mantido por compatibilidade)
    await this.prisma.setTenantContext(tenant.id);

    // Envolver next() com tenantContext para disponibilizar tenantId em todo o request
    return this.tenantContext.runAsync(tenant.id, async () => {
      return next();
    });
  }
}


