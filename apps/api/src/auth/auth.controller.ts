import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import type { Request, Response } from 'express';

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private getCookieOptions(maxAgeMs: number) {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd, // em dev local, precisa ser false
      sameSite: 'lax' as const,
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);

    const staffId =
      user.tenantId != null
        ? await this.prisma.withTenant(user.tenantId, (tx) =>
            tx.staff.findFirst({ where: { userId: user.id }, select: { id: true } }),
          ).then((s) => s?.id)
        : undefined;

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: String(user.role),
      tenantId: user.tenantId ?? null,
      staffId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.authService.signAccessToken(safeUser),
      this.authService.signRefreshToken({
        id: safeUser.id,
        tenantId: safeUser.tenantId,
      }),
    ]);

    // Cookies HttpOnly (frontend usa withCredentials)
    res.cookie('access_token', accessToken, this.getCookieOptions(15 * 60 * 1000));
    res.cookie('refresh_token', refreshToken, this.getCookieOptions(7 * 24 * 60 * 60 * 1000));

    return {
      tenantId: safeUser.tenantId,
      user: {
        id: safeUser.id,
        email: safeUser.email,
        name: safeUser.name,
        role: safeUser.role,
        tenantId: safeUser.tenantId,
        staffId: safeUser.staffId ?? null,
      },
    };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: Partial<RefreshDto>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret) {
      throw new UnauthorizedException('JWT_REFRESH_SECRET não definido');
    }

    const tokenFromCookie = (req.cookies?.refresh_token as string | undefined) ?? undefined;
    const tokenFromBody = dto?.refreshToken;
    const token = tokenFromCookie || tokenFromBody;
    if (!token) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const decoded = await this.jwtService.verifyAsync<{
      sub?: string;
      tenantId?: string | null;
      type?: string;
    }>(token, { secret: refreshSecret });

    if (!decoded?.sub || decoded.type !== 'refresh' || !decoded.tenantId) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const user = await this.prisma.withTenant(decoded.tenantId, (tx) =>
      tx.user.findUnique({
        where: { id: decoded.sub },
        include: { tenant: true },
      }),
    );

    if (!user) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const staffId =
      user.tenantId != null
        ? await this.prisma.withTenant(user.tenantId, (tx) =>
            tx.staff.findFirst({ where: { userId: user.id }, select: { id: true } }),
          ).then((s) => s?.id)
        : undefined;

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: String(user.role),
      tenantId: user.tenantId ?? null,
      staffId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.authService.signAccessToken(safeUser),
      this.authService.signRefreshToken({
        id: safeUser.id,
        tenantId: safeUser.tenantId,
      }),
    ]);

    res.cookie('access_token', accessToken, this.getCookieOptions(15 * 60 * 1000));
    res.cookie('refresh_token', refreshToken, this.getCookieOptions(7 * 24 * 60 * 60 * 1000));

    return {
      tenantId: safeUser.tenantId,
      user: {
        id: safeUser.id,
        email: safeUser.email,
        name: safeUser.name,
        role: safeUser.role,
        tenantId: safeUser.tenantId,
        staffId: safeUser.staffId ?? null,
      },
    };
  }

  @Get('me')
  async me(@Req() req: any) {
    // JwtStrategy retorna o payload como req.user
    return req.user ?? null;
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    // Para browsers, clearCookie precisa "bater" com atributos relevantes do cookie
    const isProd = process.env.NODE_ENV === 'production';
    const clearOpts = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
    };
    res.clearCookie('access_token', clearOpts);
    res.clearCookie('refresh_token', clearOpts);
    return { ok: true };
  }
}
