import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = req.headers.host || '';
    const referer = req.headers.referer || '';
    const parts = host.split('.');
    
    // Tenta pegar do Host primeiro, depois do Referer (frontend), depois um header
    let slug = parts.length > 1 ? parts[0] : 'default';

    if (slug === 'localhost:3001' || slug === 'localhost' || slug === 'default') {
      // Se vier do localhost (sem subdominio no host), tenta extrair do referer
      if (referer) {
        try {
          const url = new URL(referer);
          const refererParts = url.hostname.split('.');
          if (refererParts.length > 1) {
            slug = refererParts[0];
          }
        } catch (e) {
          // Referer inválido, ignora
        }
      }
    }

    // Fallback para MVP: se ainda for default ou localhost, usa 'clinica1'
    if (slug === 'localhost' || slug === 'default' || slug === 'localhost:3001') {
      slug = 'clinica1';
    }

    console.log(`[TENANT] Buscando tenant para o slug: ${slug}`);

    // No MVP temos 1 tenant fixo, mas já deixamos a busca pronta
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      console.error(`[TENANT] Erro: Tenant '${slug}' não encontrado no banco de dados.`);
      // Se não achar e for dev, podemos usar um fallback ou criar um padrão
      if (process.env.NODE_ENV === 'development') {
        // Tenta buscar o primeiro tenant disponível como fallback definitivo
        const firstTenant = await this.prisma.client.tenant.findFirst();
        if (firstTenant) {
          console.warn(`[TENANT] Usando fallback para o primeiro tenant encontrado: ${firstTenant.slug}`);
          (req as any)['tenantId'] = firstTenant.id;
          await this.prisma.setTenantContext(firstTenant.id);
          return next();
        }
        
        console.error('[TENANT] Nenhum tenant encontrado no banco. O seed foi executado?');
        (req as any)['tenantId'] = '00000000-0000-0000-0000-000000000000'; // Mock ID
        return next();
      }
      throw new NotFoundException(`Clínica '${slug}' não encontrada.`);
    }

    console.log(`[TENANT] Contexto definido para: ${tenant.name} (${tenant.id})`);
    (req as any)['tenantId'] = tenant.id;
    
    // Seta o contexto no banco para o RLS
    await this.prisma.setTenantContext(tenant.id);

    next();
  }
}


