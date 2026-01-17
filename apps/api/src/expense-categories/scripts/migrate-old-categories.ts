/**
 * Script de migração de categorias antigas (strings) para novas categorias (UUIDs)
 * 
 * Este script mapeia as categorias antigas usadas em transações para as novas categorias
 * criadas no sistema de ExpenseCategory.
 * 
 * Mapeamento:
 * - "Material" -> INSUMOS-001-001 (Materiais Médicos)
 * - "Medicamento" -> INSUMOS-001-001 (Materiais Médicos)
 * - "Despesa Operacional" -> OPEX-001-001 (Serviços Essenciais)
 * - "Outros" -> OUTRAS-001-001 (Reembolsos)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_MAPPING: Record<string, string> = {
  'Material': 'INSUMOS-001-001',
  'Medicamento': 'INSUMOS-001-001',
  'Despesa Operacional': 'OPEX-001-001',
  'Outros': 'OUTRAS-001-001',
};

async function migrateCategories() {
  console.log('Iniciando migração de categorias antigas...');

  // Buscar todos os tenants
  const tenants = await prisma.tenant.findMany();

  for (const tenant of tenants) {
    console.log(`\nProcessando tenant: ${tenant.name} (${tenant.id})`);

    // Buscar todas as categorias do tenant
    const categories = await prisma.expenseCategory.findMany({
      where: { tenantId: tenant.id },
    });

    // Criar mapa de código para ID
    const codeToIdMap = new Map<string, string>();
    categories.forEach(cat => {
      codeToIdMap.set(cat.code, cat.id);
    });

    // Buscar transações de despesa sem categoryId
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: tenant.id,
        type: 'expense',
        categoryId: null,
      },
    });

    console.log(`Encontradas ${transactions.length} transações de despesa sem categoria`);

    let migrated = 0;
    let skipped = 0;

    for (const transaction of transactions) {
      const oldCategory = transaction.category;
      
      if (!oldCategory) {
        skipped++;
        continue;
      }

      // Buscar código mapeado
      const mappedCode = CATEGORY_MAPPING[oldCategory];
      
      if (!mappedCode) {
        console.log(`  ⚠️  Categoria não mapeada: "${oldCategory}" (transação ${transaction.id})`);
        skipped++;
        continue;
      }

      // Buscar ID da categoria
      const categoryId = codeToIdMap.get(mappedCode);
      
      if (!categoryId) {
        console.log(`  ⚠️  Categoria não encontrada no tenant: ${mappedCode}`);
        skipped++;
        continue;
      }

      // Atualizar transação
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { categoryId },
      });

      migrated++;
    }

    console.log(`  ✅ Migradas: ${migrated}`);
    console.log(`  ⏭️  Ignoradas: ${skipped}`);
  }

  console.log('\n✅ Migração concluída!');
}

migrateCategories()
  .catch((e) => {
    console.error('Erro na migração:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
