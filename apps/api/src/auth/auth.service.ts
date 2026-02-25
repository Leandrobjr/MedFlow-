import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';

type SafeUserForToken = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  staffId?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `[AUTH] Tentando validar usuário ${email} | tenantId=${tenantId ?? 'null'}`,
    );
    const user = await this.tenantPrisma.run((tx) =>
      tx.user.findUnique({
        where: { email },
        include: { tenant: true },
      }),
    );

    if (!user) {
      this.logger.warn(
        `[AUTH] Usuário não encontrado para ${email} | tenantId=${tenantId ?? 'null'}`,
      );
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // bcryptjs já existe no repo
    const bcrypt = await import('bcryptjs');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      this.logger.warn(
        `[AUTH] Senha inválida para ${email} | tenantId=${tenantId ?? 'null'}`,
      );
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return user;
  }

  private getAccessTokenExpiresIn(): JwtSignOptions['expiresIn'] {
    return (process.env.JWT_EXPIRES_IN ?? '15m') as JwtSignOptions['expiresIn'];
  }

  private getAccessTokenSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não definido');
    }
    return secret;
  }

  private getRefreshTokenExpiresIn(): JwtSignOptions['expiresIn'] {
    return (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as JwtSignOptions['expiresIn'];
  }

  private getRefreshTokenSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET não definido');
    }
    return secret;
  }

  async signAccessToken(user: SafeUserForToken): Promise<string> {
    const payload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      ...(user.staffId && { staffId: user.staffId }),
    };

    const options: JwtSignOptions = {
      expiresIn: this.getAccessTokenExpiresIn(),
      secret: this.getAccessTokenSecret(),
    };
    return this.jwtService.signAsync(payload, options);
  }

  async signRefreshToken(user: Pick<SafeUserForToken, 'id' | 'tenantId'>): Promise<string> {
    const payload: Record<string, unknown> = {
      sub: user.id,
      tenantId: user.tenantId,
      type: 'refresh',
    };

    const options: JwtSignOptions = {
      expiresIn: this.getRefreshTokenExpiresIn(),
      secret: this.getRefreshTokenSecret(),
    };
    return this.jwtService.signAsync(payload, options);
  }
}
