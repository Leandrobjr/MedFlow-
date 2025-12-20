# MedFlow - Sistema Integrado de Gestão para Clínicas Médicas (SaaS)

## Stack Tecnológica

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: NestJS + TypeScript + Prisma
- **Banco de Dados**: PostgreSQL 15+ (com RLS para multi-tenant)
- **Package Manager**: pnpm 9.15.4+

## Estrutura do Projeto

```
medflow/
├── apps/
│   ├── api/          # Backend NestJS
│   └── web/          # Frontend Next.js
├── packages/
│   └── shared/       # Tipos e utilitários compartilhados
├── package.json      # Configuração do monorepo
├── pnpm-workspace.yaml
└── turbo.json       # Configuração do Turborepo
```

## Pré-requisitos

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- PostgreSQL 15+ (ou Docker)

## Como Rodar Localmente

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Configurar variáveis de ambiente

Copie os arquivos `.env.example` (quando existirem) e configure conforme necessário.

### 3. Rodar em modo desenvolvimento

```bash
pnpm dev
```

Isso inicia:
- API em `http://localhost:3001`
- Web em `http://localhost:3000`

## Scripts Disponíveis

- `pnpm dev` - Inicia todos os apps em modo desenvolvimento
- `pnpm build` - Builda todos os apps
- `pnpm lint` - Roda lint em todos os apps
- `pnpm clean` - Limpa caches e builds

## Desenvolvimento

Este é um monorepo multi-tenant para gestão de clínicas médicas. Consulte o PRD para mais detalhes sobre funcionalidades e arquitetura.
