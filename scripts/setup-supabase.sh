#!/bin/bash
# Script Bash para configurar Supabase
# Execute após criar o projeto no Supabase e obter a DATABASE_URL

if [ -z "$1" ]; then
    echo "❌ Erro: DATABASE_URL não fornecida"
    echo ""
    echo "Uso: ./setup-supabase.sh 'postgresql://postgres:senha@host:port/db'"
    echo ""
    exit 1
fi

DATABASE_URL="$1"

echo "🗄️ Configurando Supabase para MedFlow..."
echo ""

# Navegar para a pasta do banco de dados
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DB_PATH="$SCRIPT_DIR/../packages/db"
cd "$DB_PATH"

echo "📁 Diretório: $DB_PATH"
echo ""

# Configurar DATABASE_URL
export DATABASE_URL

echo "✅ DATABASE_URL configurada"
echo ""

# Gerar cliente Prisma
echo "🔧 Gerando cliente Prisma..."
pnpm prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Erro ao gerar cliente Prisma"
    exit 1
fi

echo "✅ Cliente Prisma gerado"
echo ""

# Perguntar qual método usar
echo "Escolha o método de migração:"
echo "1. Prisma Migrate (recomendado para produção)"
echo "2. Prisma DB Push (mais rápido, sem histórico)"
echo ""
read -p "Digite 1 ou 2: " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "📦 Criando migrações..."
    pnpm prisma migrate dev --name init_production
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao criar migrações"
        exit 1
    fi
    
    echo "✅ Migrações criadas e aplicadas"
elif [ "$choice" = "2" ]; then
    echo ""
    echo "📦 Enviando schema para o banco..."
    pnpm prisma db push
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao enviar schema"
        exit 1
    fi
    
    echo "✅ Schema aplicado ao banco"
else
    echo "❌ Opção inválida"
    exit 1
fi

echo ""
echo "✅ Configuração do banco de dados concluída!"
echo ""
echo "⚠️ PRÓXIMO PASSO:"
echo "1. Acesse o Supabase SQL Editor"
echo "2. Execute o conteúdo do arquivo: packages/db/prisma/rls.sql"
echo "3. Isso configurará o Row Level Security (RLS)"
echo ""
