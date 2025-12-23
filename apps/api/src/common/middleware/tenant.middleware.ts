import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = req.headers.host || '';
    const parts = host.split('.');
    
    // Para localhost:3001 ou clinica1.localhost:3001
    // Se tiver mais de 1 parte, a primeira é o subdomínio
    let slug = parts.length > 1 ? parts[0] : 'default';

    // No MVP temos 1 tenant fixo, mas já deixamos a busca pronta
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      // Se não achar e for dev, podemos usar um fallback ou criar um padrão
      if (process.env.NODE_ENV === 'development') {
        // Fallback para facilitar testes iniciais
        req['tenantId'] = '00000000-0000-0000-0000-000000000000'; // Mock ID
        return next();
      }
      throw new NotFoundException(`Clínica '${slug}' não encontrada.`);
    }

    req['tenantId'] = tenant.id;
    
    // Seta o contexto no banco para o RLS
    await this.prisma.setTenantContext(tenant.id);

    next();
  }
}

