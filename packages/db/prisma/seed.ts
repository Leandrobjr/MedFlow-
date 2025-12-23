import { PrismaClient } from '@prisma/client'; 
import * as bcrypt from 'bcrypt'; 
const prisma = new PrismaClient(); 
async function main() { 
  const password = await bcrypt.hash('admin123', 10); 
  const tenant = await prisma.tenant.upsert({ 
    where: { slug: 'clinica1' }, 
    update: {}, 
    create: { name: 'ClÇðnica de Teste', slug: 'clinica1' }, 
  }); 
  await prisma.user.upsert({ 
    where: { email: 'admin@medflow.local' }, 
    update: {}, 
    create: { email: 'admin@medflow.local', name: 'Administrador', password, role: 'owner', tenantId: tenant.id }, 
  }); 
  console.log('Seed concluÇðdo!'); 
} 
main() 
  .catch((e) => { console.error(e); process.exit(1); }) 
  .finally(async ()=> { await prisma.(); });
