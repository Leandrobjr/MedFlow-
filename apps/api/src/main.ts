import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuração de cookies (HttpOnly por padrão no controller)
  app.use(cookieParser());

  // Validação global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configurado para aceitar cookies e subdomínios
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      const allowedOrigins = [
        'http://localhost:3000',
        process.env.FRONTEND_URL,
      ].filter(Boolean);

      const isLocalhostSubdomain = origin.includes('localhost:3000');
      
      if (allowedOrigins.includes(origin) || isLocalhostSubdomain) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API rodando em http://0.0.0.0:${port}`);
}
bootstrap();
