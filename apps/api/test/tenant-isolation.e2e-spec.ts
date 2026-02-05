import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantPrismaService } from '../src/prisma/tenant-prisma.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AppModule } from '../src/app.module';

/**
 * FASE 4: Testes e2e de isolamento multi-tenant (RLS) - OBRIGATÓRIO
 *
 * Valida que:
 * - Tenant A só vê dados do tenant A
 * - Tenant B só vê dados do tenant B
 * - Tentativa de acessar dados de outro tenant retorna vazio/null (lista vazia)
 * - RLS funciona corretamente em ambos os caminhos:
 *   a) prisma.withTenant(tenantId, ...)
 *   b) tenantPrisma.run(...) com AsyncLocalStorage
 *
 * Para rodar: pnpm test:e2e tenant-isolation
 */
describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantPrisma: TenantPrismaService;
  let tenantContext: TenantContextService;

  // IDs dos tenants criados para teste
  let tenantAId: string;
  let tenantBId: string;
  let patientAId: string;
  let patientBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    tenantPrisma = moduleFixture.get<TenantPrismaService>(TenantPrismaService);
    tenantContext =
      moduleFixture.get<TenantContextService>(TenantContextService);
  });

  beforeEach(async () => {
    // Criar ou garantir que existem 2 tenants para teste
    const tenantA = await prisma.client.tenant.upsert({
      where: { slug: 'test-tenant-a' },
      update: {},
      create: {
        slug: 'test-tenant-a',
        name: 'Clínica Teste A',
        status: 'active',
      },
    });

    const tenantB = await prisma.client.tenant.upsert({
      where: { slug: 'test-tenant-b' },
      update: {},
      create: {
        slug: 'test-tenant-b',
        name: 'Clínica Teste B',
        status: 'active',
      },
    });

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    // Limpar dados de teste anteriores (se existirem)
    await prisma.client.patient.deleteMany({
      where: {
        OR: [
          { tenantId: tenantAId, cpf: '11111111111' },
          { tenantId: tenantBId, cpf: '22222222222' },
        ],
      },
    });

    // Criar pacientes de teste para cada tenant
    const patientA = await prisma.client.patient.create({
      data: {
        tenantId: tenantAId,
        name: 'Paciente Teste A',
        cpf: '11111111111',
        phone: '11999999999',
        birthDate: new Date('1990-01-01'),
      },
    });

    const patientB = await prisma.client.patient.create({
      data: {
        tenantId: tenantBId,
        name: 'Paciente Teste B',
        cpf: '22222222222',
        phone: '11888888888',
        birthDate: new Date('1990-01-01'),
      },
    });

    patientAId = patientA.id;
    patientBId = patientB.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (tenantAId && tenantBId) {
      await prisma.client.patient.deleteMany({
        where: {
          OR: [{ tenantId: tenantAId }, { tenantId: tenantBId }],
        },
      });
    }
    await app.close();
  });

  describe('FASE 4.6a: Isolamento via PrismaService.withTenant', () => {
    it('Tenant A deve ver apenas seus próprios pacientes', async () => {
      const patients = await prisma.withTenant(tenantAId, async (tx) => {
        // Verificar que o contexto está setado corretamente
        const currentTenant = await tx.$queryRaw<
          Array<{ current_setting: string }>
        >`
          SELECT current_setting('medflow.current_tenant', true) as current_setting
        `;

        expect(currentTenant[0]?.current_setting).toBe(tenantAId);

        // Buscar pacientes SEM filtro explícito de tenantId (RLS deve filtrar automaticamente)
        return tx.patient.findMany();
      });

      expect(patients).toHaveLength(1);
      expect(patients[0].id).toBe(patientAId);
      expect(patients[0].name).toBe('Paciente Teste A');
      expect(patients[0].tenantId).toBe(tenantAId);
    });

    it('Tenant B deve ver apenas seus próprios pacientes', async () => {
      const patients = await prisma.withTenant(tenantBId, async (tx) => {
        const currentTenant = await tx.$queryRaw<
          Array<{ current_setting: string }>
        >`
          SELECT current_setting('medflow.current_tenant', true) as current_setting
        `;

        expect(currentTenant[0]?.current_setting).toBe(tenantBId);

        // Buscar pacientes SEM filtro explícito de tenantId (RLS deve filtrar automaticamente)
        return tx.patient.findMany();
      });

      expect(patients).toHaveLength(1);
      expect(patients[0].id).toBe(patientBId);
      expect(patients[0].name).toBe('Paciente Teste B');
      expect(patients[0].tenantId).toBe(tenantBId);
    });

    it('Tenant A NÃO deve conseguir acessar paciente do Tenant B (retorna null)', async () => {
      const patient = await prisma.withTenant(tenantAId, async (tx) => {
        // Tentar buscar paciente do tenant B usando ID do tenant B
        return tx.patient.findFirst({
          where: { id: patientBId },
        });
      });

      // RLS deve bloquear e retornar null (não 404, mas null)
      expect(patient).toBeNull();
    });

    it('Tenant B NÃO deve conseguir acessar paciente do Tenant A (retorna null)', async () => {
      const patient = await prisma.withTenant(tenantBId, async (tx) => {
        // Tentar buscar paciente do tenant A usando ID do tenant A
        return tx.patient.findFirst({
          where: { id: patientAId },
        });
      });

      // RLS deve bloquear e retornar null (não 404, mas null)
      expect(patient).toBeNull();
    });

    it('Tenant A não enxerga registros do Tenant B (lista vazia)', async () => {
      // Validar que com tenant A não enxerga registros do tenant B (lista vazia)
      const patients = await prisma.withTenant(tenantAId, async (tx) => {
        // Buscar todos os pacientes (RLS deve filtrar automaticamente)
        return tx.patient.findMany();
      });

      // Deve retornar apenas pacientes do tenant A (lista com 1 item)
      expect(patients).toHaveLength(1);
      expect(patients[0].id).toBe(patientAId);
      expect(patients[0].tenantId).toBe(tenantAId);

      // Validar que NÃO contém pacientes do tenant B
      const hasTenantBPatient = patients.some((p) => p.id === patientBId);
      expect(hasTenantBPatient).toBe(false);
    });

    it('Tenant B não enxerga registros do Tenant A (lista vazia)', async () => {
      // Validar que com tenant B não enxerga registros do tenant A (lista vazia)
      const patients = await prisma.withTenant(tenantBId, async (tx) => {
        // Buscar todos os pacientes (RLS deve filtrar automaticamente)
        return tx.patient.findMany();
      });

      // Deve retornar apenas pacientes do tenant B (lista com 1 item)
      expect(patients).toHaveLength(1);
      expect(patients[0].id).toBe(patientBId);
      expect(patients[0].tenantId).toBe(tenantBId);

      // Validar que NÃO contém pacientes do tenant A
      const hasTenantAPatient = patients.some((p) => p.id === patientAId);
      expect(hasTenantAPatient).toBe(false);
    });
  });

  describe('FASE 4.6b: Isolamento via TenantPrismaService.run (com AsyncLocalStorage)', () => {
    it('TenantPrismaService deve funcionar dentro do contexto do Tenant A', async () => {
      const result = await tenantContext.runAsync(tenantAId, async () => {
        return tenantPrisma.run(async (tx) => {
          const currentTenant = await tx.$queryRaw<
            Array<{ current_setting: string }>
          >`
            SELECT current_setting('medflow.current_tenant', true) as current_setting
          `;

          expect(currentTenant[0]?.current_setting).toBe(tenantAId);

          return tx.patient.findMany();
        });
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(patientAId);
      expect(result[0].tenantId).toBe(tenantAId);
    });

    it('TenantPrismaService deve funcionar dentro do contexto do Tenant B', async () => {
      const result = await tenantContext.runAsync(tenantBId, async () => {
        return tenantPrisma.run(async (tx) => {
          const currentTenant = await tx.$queryRaw<
            Array<{ current_setting: string }>
          >`
            SELECT current_setting('medflow.current_tenant', true) as current_setting
          `;

          expect(currentTenant[0]?.current_setting).toBe(tenantBId);

          return tx.patient.findMany();
        });
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(patientBId);
      expect(result[0].tenantId).toBe(tenantBId);
    });

    it('TenantPrismaService deve lançar erro se não houver contexto de tenant', async () => {
      // Não envolver em tenantContext.runAsync (simular ausência de contexto)
      await expect(
        tenantPrisma.run(async (tx) => {
          return tx.patient.findMany();
        }),
      ).rejects.toThrow('Tenant obrigatório');
    });

    it('Tenant A não enxerga registros do Tenant B via tenantPrisma.run (lista vazia)', async () => {
      // Validar isolamento usando tenantPrisma.run com AsyncLocalStorage
      const patients = await tenantContext.runAsync(tenantAId, async () => {
        return tenantPrisma.run(async (tx) => {
          return tx.patient.findMany();
        });
      });

      // Deve retornar apenas pacientes do tenant A
      expect(patients).toHaveLength(1);
      expect(patients[0].id).toBe(patientAId);
      expect(patients[0].tenantId).toBe(tenantAId);

      // Validar que NÃO contém pacientes do tenant B
      const hasTenantBPatient = patients.some((p) => p.id === patientBId);
      expect(hasTenantBPatient).toBe(false);
    });

    it('Tenant B não enxerga registros do Tenant A via tenantPrisma.run (lista vazia)', async () => {
      // Validar isolamento usando tenantPrisma.run com AsyncLocalStorage
      const patients = await tenantContext.runAsync(tenantBId, async () => {
        return tenantPrisma.run(async (tx) => {
          return tx.patient.findMany();
        });
      });

      // Deve retornar apenas pacientes do tenant B
      expect(patients).toHaveLength(1);
      expect(patients[0].id).toBe(patientBId);
      expect(patients[0].tenantId).toBe(tenantBId);

      // Validar que NÃO contém pacientes do tenant A
      const hasTenantAPatient = patients.some((p) => p.id === patientAId);
      expect(hasTenantAPatient).toBe(false);
    });
  });

  describe('Validação de RLS em múltiplas queries', () => {
    it('Múltiplas queries no mesmo contexto devem manter isolamento', async () => {
      const result = await prisma.withTenant(tenantAId, async (tx) => {
        const patients = await tx.patient.findMany();
        const count = await tx.patient.count();
        const firstPatient = await tx.patient.findFirst();

        return { patients, count, firstPatient };
      });

      expect(result.patients).toHaveLength(1);
      expect(result.count).toBe(1);
      expect(result.firstPatient?.id).toBe(patientAId);
      expect(result.firstPatient?.tenantId).toBe(tenantAId);
    });
  });
});
