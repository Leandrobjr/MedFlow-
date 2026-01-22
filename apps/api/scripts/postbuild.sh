#!/bin/bash
# Script executado após o build no Render

echo "🔧 Gerando cliente Prisma..."
cd ../../packages/db
pnpm prisma generate

echo "✅ Cliente Prisma gerado com sucesso!"
