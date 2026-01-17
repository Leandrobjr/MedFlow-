import { PrismaClient } from '@prisma/client'; 
import * as bcrypt from 'bcrypt'; 
const prisma = new PrismaClient(); 

async function seedExpenseCategories(tenantId: string) {
  const categories = [
    // 1. Despesas Operacionais (OPEX)
    {
      code: 'OPEX-001',
      name: 'Despesas Operacionais (OPEX)',
      description: 'Despesas operacionais gerais',
      isFixed: false,
      children: [
        { code: 'OPEX-001-001', name: 'Serviços Essenciais', description: 'Limpeza, coleta de resíduos, segurança, manutenção predial e de equipamentos' },
        { code: 'OPEX-001-002', name: 'Serviços Profissionais', description: 'Contabilidade, jurídico, consultoria médica, consultoria empresarial, auditoria' },
      ],
    },
    // 2. Insumos e Materiais
    {
      code: 'INSUMOS-001',
      name: 'Insumos e Materiais',
      description: 'Materiais médicos e administrativos',
      isFixed: false,
      children: [
        { code: 'INSUMOS-001-001', name: 'Materiais Médicos', description: 'Medicamentos, materiais descartáveis, EPIs, materiais de esterilização, kits e insumos por procedimento' },
        { code: 'INSUMOS-001-002', name: 'Materiais Administrativos', description: 'Papelaria, material de escritório, impressos, copa e consumo interno' },
      ],
    },
    // 3. Recursos Humanos
    {
      code: 'RH-001',
      name: 'Recursos Humanos',
      description: 'Folha de pagamento e encargos trabalhistas',
      isFixed: false,
      children: [
        { code: 'RH-001-001', name: 'Folha de Pagamento', description: 'Salários CLT, pró-labore, plantões médicos, horas extras, comissões, benefícios (VA, VR, VT, plano de saúde)' },
        { code: 'RH-001-002', name: 'Encargos Trabalhistas', description: 'INSS, FGTS, FGTS rescisório, IRRF, PIS sobre folha' },
      ],
    },
    // 4. Tributos e Obrigações Fiscais
    {
      code: 'TRIBUTOS-001',
      name: 'Tributos e Obrigações Fiscais',
      description: 'Impostos e taxas',
      isFixed: false,
      children: [],
    },
    // 5. Estrutura e Ocupação
    {
      code: 'ESTRUTURA-001',
      name: 'Estrutura e Ocupação',
      description: 'Custos de estrutura física',
      isFixed: true,
      children: [
        { code: 'ESTRUTURA-001-001', name: 'Aluguel e Condomínio', description: 'Aluguel, condomínio, IPTU' },
        { code: 'ESTRUTURA-001-002', name: 'Utilidades', description: 'Energia elétrica, água e esgoto, gás' },
        { code: 'ESTRUTURA-001-003', name: 'Telecomunicações', description: 'Internet, telefonia' },
      ],
    },
    // 6. Tecnologia e Sistemas
    {
      code: 'TI-001',
      name: 'Tecnologia e Sistemas',
      description: 'Custos de tecnologia e sistemas',
      isFixed: false,
      children: [
        { code: 'TI-001-001', name: 'Software Médico', description: 'Software médico (PEP), sistemas financeiros/ERP, licenças de software' },
        { code: 'TI-001-002', name: 'Infraestrutura', description: 'Hospedagem em nuvem, integrações e APIs, suporte técnico' },
      ],
    },
    // 7. Marketing e Comercial
    {
      code: 'MARKETING-001',
      name: 'Marketing e Comercial',
      description: 'Custos de marketing e comercialização',
      isFixed: false,
      children: [
        { code: 'MARKETING-001-001', name: 'Publicidade', description: 'Publicidade online, agências de marketing, produção de conteúdo' },
        { code: 'MARKETING-001-002', name: 'Materiais Promocionais', description: 'Identidade visual, impressos promocionais, eventos e feiras' },
      ],
    },
    // 8. Financeiro e Bancário
    {
      code: 'FINANCEIRO-001',
      name: 'Financeiro e Bancário',
      description: 'Custos financeiros e bancários',
      isFixed: false,
      children: [
        { code: 'FINANCEIRO-001-001', name: 'Tarifas e Taxas', description: 'Tarifas bancárias, taxas de adquirentes (cartão, PIX)' },
        { code: 'FINANCEIRO-001-002', name: 'Juros e Encargos', description: 'Juros e encargos, antecipação de recebíveis' },
      ],
    },
    // 9. Investimentos e CAPEX
    {
      code: 'CAPEX-001',
      name: 'Investimentos e CAPEX',
      description: 'Investimentos em capital',
      isFixed: false,
      children: [
        { code: 'CAPEX-001-001', name: 'Equipamentos', description: 'Compra de equipamentos médicos, mobiliário' },
        { code: 'CAPEX-001-002', name: 'Obras e Reformas', description: 'Obras e reformas, atualização tecnológica' },
      ],
    },
    // 10. Despesas Extraordinárias
    {
      code: 'EXTRA-001',
      name: 'Despesas Extraordinárias',
      description: 'Despesas não recorrentes',
      isFixed: false,
      children: [
        { code: 'EXTRA-001-001', name: 'Multas e Indenizações', description: 'Multas, indenizações, processos judiciais, sinistros' },
      ],
    },
    // 11. Outras Despesas
    {
      code: 'OUTRAS-001',
      name: 'Outras Despesas',
      description: 'Despesas diversas',
      isFixed: false,
      children: [
        { code: 'OUTRAS-001-001', name: 'Reembolsos', description: 'Reembolsos, despesas eventuais, ajustes contábeis' },
      ],
    },
  ];

  for (const category of categories) {
    const parent = await prisma.expenseCategory.upsert({
      where: { tenantId_code: { tenantId, code: category.code } },
      update: {},
      create: {
        tenantId,
        code: category.code,
        name: category.name,
        description: category.description,
        isFixed: category.isFixed,
        isActive: true,
      },
    });

    for (const child of category.children) {
      await prisma.expenseCategory.upsert({
        where: { tenantId_code: { tenantId, code: child.code } },
        update: {},
        create: {
          tenantId,
          parentId: parent.id,
          code: child.code,
          name: child.name,
          description: child.description,
          isFixed: false,
          isActive: true,
        },
      });
    }
  }

  console.log('Categorias de despesas criadas!');
}

async function main() { 
  const password = await bcrypt.hash('admin123', 10); 
  const tenant = await prisma.tenant.upsert({ 
    where: { slug: 'clinica1' }, 
    update: {}, 
    create: { name: 'Clínica de Teste', slug: 'clinica1' }, 
  }); 
  await prisma.user.upsert({ 
    where: { email: 'admin@medflow.local' }, 
    update: {}, 
    create: { email: 'admin@medflow.local', name: 'Administrador', password, role: 'owner', tenantId: tenant.id }, 
  }); 
  
  // Seed categorias de despesas para todos os tenants
  const tenants = await prisma.tenant.findMany();
  for (const t of tenants) {
    await seedExpenseCategories(t.id);
  }
  
  console.log('Seed concluído!'); 
}
main() 
  .catch((e) => { console.error(e); process.exit(1); }) 
  .finally(async () => {
    await prisma.$disconnect();
  });
