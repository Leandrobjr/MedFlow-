import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import fs from 'fs';
import path from 'path';

const loadEnvFile = (filePath: string, opts?: { override?: boolean }) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const override = opts?.override === true;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }
};

// Carregar env manualmente (sem dotenv) para garantir variáveis no dev.
// Observação: usar caminho baseado no __dirname para funcionar independente do CWD.
// Estrutura: repo/apps/api/src/main.ts  => repo = ../../../
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const rootEnv = path.resolve(repoRoot, '.env');
const supabaseEnv = path.resolve(repoRoot, '.env.supabase');
const apiEnv = path.resolve(repoRoot, 'apps/api/.env');

// Ordem: .env (geral) -> .env.supabase (DB) -> apps/api/.env (override por app)
// `.env.supabase` deve ter precedência mesmo se existir DATABASE_URL no ambiente do sistema.
loadEnvFile(rootEnv);
loadEnvFile(supabaseEnv, { override: true });
loadEnvFile(apiEnv, { override: true });

// Log de debug para verificar NODE_ENV (NestJS CLI carrega .env automaticamente)
console.log(
  `[MAIN] NODE_ENV=${process.env.NODE_ENV || 'undefined'} (modo desenvolvimento se não definido)`,
);

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
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
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
