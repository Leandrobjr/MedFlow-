import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/shared-types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async login(loginDto: LoginDto) {
    // Obter tenantId do contexto (setado pelo TenantMiddleware)
    const tenantId = this.tenantContext.getTenantId();
    
    if (!tenantId) {
      console.error(`[AUTH] ❌ Tenant não resolvido para login de ${loginDto.email}`);
      throw new UnauthorizedException('Tenant não identificado. Verifique o header x-tenant-slug.');
    }

    console.log(`[AUTH] Tentando login para ${loginDto.email} | Tenant: ${tenantId}`);
    
    // Usar withTenant para garantir que o RLS funcione corretamente
    const user = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.user.findUnique({
        where: { email: loginDto.email },
      });
    });

    console.log(`[AUTH] Usuário encontrado: ${user ? `SIM (tenantId: ${user.tenantId})` : 'NÃO'}`);

    if (!user) {
      console.log(`[AUTH] ❌ Usuário não encontrado para ${loginDto.email} no tenant ${tenantId}`);
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    // Verificar se o usuário pertence ao tenant correto (segurança adicional)
    if (user.tenantId !== tenantId) {
      console.error(`[AUTH] ❌ Tentativa de login com tenant incorreto. Usuário pertence a ${user.tenantId}, mas requisição veio de ${tenantId}`);
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    // Verificar senha
    if (!(await bcrypt.compare(loginDto.password, user.password))) {
      console.log(`[AUTH] ❌ Senha incorreta para ${loginDto.email}`);
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    console.log(`[AUTH] ✅ Autenticação bem-sucedida para ${loginDto.email} (tenantId: ${user.tenantId})`);

    // Buscar staffId se o usuário tiver um Staff vinculado (dentro do contexto de tenant)
    const staff = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.staff.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
    });

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      tenantId: user.tenantId,
      staffId: staff?.id || undefined,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET || 'medflow_segredo_super_seguro_123',
      expiresIn: (process.env.JWT_EXPIRES_IN as any) || '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'medflow_refresh_segredo_extra_456',
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as any) || '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_REFRESH_SECRET || 'medflow_refresh_segredo_extra_456',
      });

      const newAccessToken = await this.jwtService.signAsync(
        {
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
          tenantId: payload.tenantId,
          staffId: payload.staffId,
        },
        {
          secret: process.env.JWT_SECRET || 'medflow_segredo_super_seguro_123',
          expiresIn: (process.env.JWT_EXPIRES_IN as any) || '15m',
        },
      );

      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException('Token de atualização inválido');
    }
  }
}


