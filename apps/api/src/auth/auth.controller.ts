import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  Req,
  UnauthorizedException,
  Get,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    console.log(`[AUTH] Tentativa de login para: ${loginDto.email}`);
    const { accessToken, refreshToken, user } =
      await this.authService.login(loginDto);

    console.log(`[AUTH] Login bem-sucedido para: ${loginDto.email}. Gerando cookies.`);

    const isProd = process.env.NODE_ENV === 'production';
    
    // Se "Lembrar Senha" estiver ativado, os cookies duram 30 dias.
    // Caso contrário, são cookies de sessão (expiram ao fechar o navegador).
    const cookieOptions: any = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };

    if (loginDto.rememberMe) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias
    }

    response.cookie('access_token', accessToken, cookieOptions);
    response.cookie('refresh_token', refreshToken, cookieOptions);

    return { user };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token não encontrado');
    }

    const { accessToken } = await this.authService.refreshToken(refreshToken);

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  }

  @Get('me')
  async me(@Req() request: Request) {
    const user = request['user'];
    
    // Buscar staffId se o usuário tiver um Staff vinculado
    const staff = await this.prisma.client.staff.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    return {
      ...user,
      staffId: staff?.id || null,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token');
    response.clearCookie('refresh_token');
    return { success: true };
  }
}

