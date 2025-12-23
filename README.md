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
│   ├── db/           # Pacote de banco de dados (Prisma)
│   └── shared/       # Tipos e utilitários compartilhados
├── package.json      # Configuração do monorepo
├── pnpm-workspace.yaml
└── turbo.json       # Configuração do Turborepo
```

## Pré-requisitos

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker (para o banco de dados)

## Como Rodar Localmente

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Subir o Banco de Dados

```bash
docker-compose up -d
```

### 3. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e ajuste se necessário.

### 4. Preparar o banco de dados

```bash
pnpm db:migrate
pnpm db:generate
```

### 5. Rodar em modo desenvolvimento

```bash
pnpm dev
```

Isso inicia:
- API em `http://localhost:3001`
- Web em `http://localhost:3000`

## Multi-tenancy e RLS

Este projeto utiliza **Row Level Security (RLS)** no PostgreSQL para garantir o isolamento total entre clínicas (tenants).
- Todas as tabelas sensíveis possuem uma coluna `tenant_id`.
- O isolamento é aplicado no banco de dados, impedindo acessos cruzados mesmo em caso de erro na aplicação.
- Consulte `packages/db/prisma/rls.sql` para ver as políticas de segurança.

## Scripts Disponíveis

- `pnpm dev` - Inicia todos os apps em modo desenvolvimento
- `pnpm build` - Builda todos os apps
- `pnpm db:migrate` - Roda migrações do banco de dados
- `pnpm db:generate` - Gera o cliente Prisma
- `pnpm lint` - Roda lint em todos os apps
- `pnpm clean` - Limpa caches e builds
