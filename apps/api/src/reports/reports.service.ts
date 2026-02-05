import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserRole } from '../common/shared-types';

/**
 * Formata uma data para o fuso horário brasileiro (UTC-3)
 * O banco armazena em UTC, então subtraímos 3 horas para exibir em horário de Brasília
 */
function formatDateBR(date: Date | string, formatStr: string): string {
  const d = new Date(date);
  // Ajustar para o fuso horário brasileiro (UTC-3)
  // Subtrai 3 horas para converter de UTC para horário de Brasília
  const brDate = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return format(brDate, formatStr, { locale: ptBR });
}

/**
 * Formata apenas a data (sem horário) para o fuso brasileiro
 */
function formatDateOnlyBR(date: Date | string): string {
  return formatDateBR(date, 'dd/MM/yyyy');
}

/**
 * Formata data e hora para o fuso brasileiro
 */
function formatDateTimeBR(date: Date | string): string {
  return formatDateBR(date, "dd/MM/yyyy 'às' HH:mm");
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateDailyClosureReport(
    tenantId: string,
    closureId: string,
  ): Promise<Buffer> {
    const closure = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findFirst({
        where: {
          id: closureId,
          tenantId,
        },
        include: {
          closedBy: { select: { name: true, email: true } },
          tenant: { select: { name: true } },
        },
      });
    });

    if (!closure) {
      throw new NotFoundException('Fechamento de caixa não encontrado.');
    }

    // Buscar transações do dia
    const startOfDay = new Date(closure.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(closure.date);
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          ...(closure.closureType === 'RECEPTIONIST'
            ? { createdById: closure.createdById }
            : {}),
          status: 'completed',
        },
        include: {
          patient: { select: { name: true } },
          appointment: {
            include: {
              patient: { select: { name: true } },
              procedure: { select: { name: true } },
            },
          },
          createdBy: { select: { name: true } },
          expenseCategory: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    // Agrupar transações por método de pagamento
    const byMethod: Record<string, { income: number; expense: number }> = {};
    transactions.forEach((t) => {
      const method = t.method || 'Não informado';
      if (!byMethod[method]) {
        byMethod[method] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        byMethod[method].income += Number(t.amount);
      } else {
        byMethod[method].expense += Number(t.amount);
      }
    });

    // Gerar PDF
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    // Cabeçalho
    doc.fontSize(20).text('FECHAMENTO DE CAIXA DIÁRIO', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(closure.tenant?.name || '', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(`Data: ${formatDateBR(closure.date, "dd 'de' MMMM 'de' yyyy")}`, {
        align: 'center',
      });
    doc.moveDown();

    // Informações do fechamento
    doc.fontSize(12).text('INFORMAÇÕES DO FECHAMENTO', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(
      `Tipo: ${closure.closureType === 'RECEPTIONIST' ? 'Caixa de Recepcionista' : 'Caixa Administrativo'}`,
    );
    doc.text(`Responsável: ${closure.closedBy.name}`);
    doc.text(
      `Saldo Inicial: R$ ${Number(closure.initialBalance).toFixed(2).replace('.', ',')}`,
    );
    doc.text(
      `Saldo Final: R$ ${Number(closure.finalBalance).toFixed(2).replace('.', ',')}`,
    );
    doc.moveDown();

    // Resumo por método de pagamento - ordem específica
    doc
      .fontSize(12)
      .text('SALDO EXTRATIFICADO POR MÉTODO DE PAGAMENTO', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);

    // Definir ordem específica dos métodos
    const methodOrder = [
      'Dinheiro',
      'PIX',
      'Cartão de Débito',
      'Cartão de Crédito',
    ];

    // Listar cada método na ordem específica com entradas, saídas e saldo
    methodOrder.forEach((method) => {
      const methodData = byMethod[method] || { income: 0, expense: 0 };
      const methodBalance = methodData.income - methodData.expense;
      doc.text(`${method}:`, { continued: false });
      doc.text(
        `  Entradas: R$ ${methodData.income.toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.text(
        `  Saídas: R$ ${methodData.expense.toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.fillColor(methodBalance >= 0 ? 'green' : 'red');
      doc.text(`  Saldo: R$ ${methodBalance.toFixed(2).replace('.', ',')}`, {
        indent: 20,
      });
      doc.fillColor('black'); // Resetar para preto
      doc.moveDown(0.3);
    });

    // Listar outros métodos que não estão na ordem padrão
    Object.keys(byMethod).forEach((method) => {
      if (!methodOrder.includes(method)) {
        const methodData = byMethod[method];
        const methodBalance = methodData.income - methodData.expense;
        doc.text(`${method}:`, { continued: false });
        doc.text(
          `  Entradas: R$ ${methodData.income.toFixed(2).replace('.', ',')}`,
          { indent: 20 },
        );
        doc.text(
          `  Saídas: R$ ${methodData.expense.toFixed(2).replace('.', ',')}`,
          { indent: 20 },
        );
        doc.fillColor(methodBalance >= 0 ? 'green' : 'red');
        doc.text(`  Saldo: R$ ${methodBalance.toFixed(2).replace('.', ',')}`, {
          indent: 20,
        });
        doc.fillColor('black'); // Resetar para preto
        doc.moveDown(0.3);
      }
    });

    doc.moveDown();
    doc.moveDown(0.5);
    doc.fontSize(10);
    Object.entries(byMethod).forEach(([method, values]) => {
      doc.text(`${method}:`);
      doc.text(`  Entradas: R$ ${values.income.toFixed(2).replace('.', ',')}`, {
        indent: 20,
      });
      doc.text(`  Saídas: R$ ${values.expense.toFixed(2).replace('.', ',')}`, {
        indent: 20,
      });
      doc.text(
        `  Saldo: R$ ${(values.income - values.expense).toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.moveDown(0.3);
    });
    doc.moveDown();

    // Totais
    doc.fontSize(12).text('TOTAIS DO DIA', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(
      `Total de Entradas: R$ ${Number(closure.totalIncome).toFixed(2).replace('.', ',')}`,
    );
    doc.text(
      `Total de Saídas: R$ ${Number(closure.totalExpense).toFixed(2).replace('.', ',')}`,
    );
    doc.text(
      `Saldo Líquido: R$ ${Number(closure.netBalance).toFixed(2).replace('.', ',')}`,
    );
    if (closure.difference) {
      if (Number(closure.difference) !== 0) {
        doc.fillColor('red');
      } else {
        doc.fillColor('black');
      }
      doc.text(
        `Diferença: R$ ${Number(closure.difference).toFixed(2).replace('.', ',')}`,
      );
      doc.fillColor('black'); // Resetar para preto
    }
    doc.moveDown();

    // Conferência física
    if (closure.cashCount || closure.cardCount || closure.pixCount) {
      doc.fontSize(12).text('CONFERÊNCIA FÍSICA', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      if (closure.cashCount) {
        doc.text(
          `Dinheiro: R$ ${Number(closure.cashCount).toFixed(2).replace('.', ',')}`,
        );
      }
      if (closure.cardCount) {
        doc.text(
          `Cartão: R$ ${Number(closure.cardCount).toFixed(2).replace('.', ',')}`,
        );
      }
      if (closure.pixCount) {
        doc.text(
          `PIX: R$ ${Number(closure.pixCount).toFixed(2).replace('.', ',')}`,
        );
      }
      doc.moveDown();
    }

    // Lista de transações
    doc.fontSize(12).text('LANÇAMENTOS DO DIA', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);

    transactions.forEach((t, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      const description =
        t.description ||
        (t.appointment?.patient?.name
          ? `${t.appointment.procedure?.name || t.category} - ${t.appointment.patient.name}`
          : null) ||
        (t.patient?.name ? `${t.category} - ${t.patient.name}` : null) ||
        t.category ||
        'Sem descrição';

      doc.text(
        `${index + 1}. ${formatDateBR(t.createdAt, 'HH:mm')} - ${description}`,
      );
      doc.text(
        `   ${t.type === 'income' ? 'ENTRADA' : 'SAÍDA'}: R$ ${Number(t.amount).toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.text(`   Método: ${t.method || 'Não informado'}`, { indent: 20 });
      if (t.createdBy) {
        doc.text(`   Por: ${t.createdBy.name}`, { indent: 20 });
      }
      doc.moveDown(0.3);
    });

    // Espaço para assinatura
    doc.moveDown(2);
    doc.fontSize(10);
    doc.text('_________________________________________', { align: 'center' });
    doc.text(closure.closedBy.name, { align: 'center' });
    doc.text('Assinatura do Responsável', { align: 'center' });

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
      doc.end();
    });
  }

  async generateBillingReport(
    tenantId: string,
    startDate: string,
    endDate: string,
    procedureId?: string,
    staffId?: string,
    patientId?: string,
  ): Promise<Buffer> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const where: any = {
      tenantId,
      type: 'income',
      status: 'completed',
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (procedureId) {
      where.appointment = { procedureId };
    }

    if (staffId) {
      where.staffId = staffId;
    }

    if (patientId) {
      where.patientId = patientId;
    }

    const transactions = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findMany({
        where,
        include: {
          patient: { select: { name: true, cpf: true } },
          appointment: {
            include: {
              patient: { select: { name: true, cpf: true } },
              procedure: { select: { name: true, grossAmount: true } },
              staff: { select: { name: true } },
            },
          },
          staff: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    const tenant = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
    });

    // Agrupar por procedimento
    const byProcedure: Record<
      string,
      { count: number; total: number; items: any[] }
    > = {};
    transactions.forEach((t) => {
      const procedureName =
        t.appointment?.procedure?.name || t.category || 'Outros';
      if (!byProcedure[procedureName]) {
        byProcedure[procedureName] = { count: 0, total: 0, items: [] };
      }
      byProcedure[procedureName].count++;
      byProcedure[procedureName].total += Number(t.amount);
      byProcedure[procedureName].items.push(t);
    });

    const totalAmount = transactions.reduce(
      (acc, t) => acc + Number(t.amount),
      0,
    );

    // Gerar PDF
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    // Cabeçalho
    doc.fontSize(20).text('RELATÓRIO DE FATURAMENTO', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(tenant?.name || '', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(
        `Período: ${format(start, 'dd/MM/yyyy', { locale: ptBR })} a ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`,
        { align: 'center' },
      );
    doc.moveDown();

    // Filtros aplicados
    if (procedureId || staffId || patientId) {
      doc.fontSize(10).text('Filtros Aplicados:', { underline: true });
      if (procedureId) {
        const procedure = await this.prisma.withTenant(tenantId, async (tx) => {
          return tx.procedure.findUnique({
            where: { id: procedureId },
            select: { name: true },
          });
        });
        doc.text(`Procedimento: ${procedure?.name || procedureId}`);
      }
      if (staffId) {
        const staff = await this.prisma.withTenant(tenantId, async (tx) => {
          return tx.staff.findUnique({
            where: { id: staffId },
            select: { name: true },
          });
        });
        doc.text(`Médico: ${staff?.name || staffId}`);
      }
      if (patientId) {
        const patient = await this.prisma.withTenant(tenantId, async (tx) => {
          return tx.patient.findUnique({
            where: { id: patientId },
            select: { name: true },
          });
        });
        doc.text(`Paciente: ${patient?.name || patientId}`);
      }
      doc.moveDown();
    }

    // Resumo por procedimento
    doc.fontSize(12).text('RESUMO POR PROCEDIMENTO', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    Object.entries(byProcedure).forEach(([procedure, data]) => {
      doc.text(`${procedure}:`);
      doc.text(`  Quantidade: ${data.count}`, { indent: 20 });
      doc.text(`  Total: R$ ${data.total.toFixed(2).replace('.', ',')}`, {
        indent: 20,
      });
      doc.moveDown(0.3);
    });
    doc.moveDown();

    // Total geral
    doc.fontSize(12).text('TOTAL GERAL', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Quantidade de Atendimentos: ${transactions.length}`);
    doc.text(`Total Faturado: R$ ${totalAmount.toFixed(2).replace('.', ',')}`);
    doc.moveDown();

    // Lista detalhada
    doc.fontSize(12).text('DETALHAMENTO', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);

    transactions.forEach((t, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      const patientName =
        t.appointment?.patient?.name || t.patient?.name || 'Não informado';
      const procedureName =
        t.appointment?.procedure?.name || t.category || 'Não informado';
      const doctorName =
        t.appointment?.staff?.name || t.staff?.name || 'Não informado';

      doc.text(`${index + 1}. ${formatDateTimeBR(t.createdAt)}`);
      doc.text(`   Paciente: ${patientName}`, { indent: 20 });
      doc.text(`   Procedimento: ${procedureName}`, { indent: 20 });
      doc.text(`   Médico: ${doctorName}`, { indent: 20 });
      doc.text(
        `   Valor: R$ ${Number(t.amount).toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.text(`   Método: ${t.method || 'Não informado'}`, { indent: 20 });
      doc.moveDown(0.3);
    });

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
      doc.end();
    });
  }

  async generateMedicalFeeReport(
    tenantId: string,
    paymentId: string,
    userRole?: string,
    userStaffId?: string,
  ): Promise<Buffer> {
    const where: any = {
      id: paymentId,
      tenantId,
    };

    // Se for médico, só pode ver seus próprios repasses
    if (userRole === UserRole.DOCTOR && userStaffId) {
      where.staffId = userStaffId;
    }

    const payment = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.medicalFeePayment.findFirst({
        where,
        include: {
          staff: { select: { name: true, specialty: true, crm: true } },
          paidByUser: { select: { name: true } },
          fees: {
            include: {
              transaction: {
                include: {
                  appointment: {
                    include: {
                      patient: { select: { name: true, cpf: true } },
                      procedure: { select: { name: true, grossAmount: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          tenant: { select: { name: true } },
        },
      });
    });

    if (!payment) {
      if (userRole === UserRole.DOCTOR) {
        throw new ForbiddenException(
          'Você não tem permissão para acessar este relatório.',
        );
      }
      throw new NotFoundException('Fechamento de repasse não encontrado.');
    }

    // Gerar PDF
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    // Cabeçalho
    doc.fontSize(20).text('REPASSE MÉDICO DETALHADO', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(payment.tenant?.name || '', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(
        `Período: ${formatDateOnlyBR(payment.periodStart)} a ${formatDateOnlyBR(payment.periodEnd)}`,
        { align: 'center' },
      );
    doc.moveDown();

    // Informações do médico
    doc.fontSize(12).text('INFORMAÇÕES DO PROFISSIONAL', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Nome: ${payment.staff.name}`);
    if (payment.staff.specialty) {
      doc.text(`Especialidade: ${payment.staff.specialty}`);
    }
    if (payment.staff.crm) {
      doc.text(`CRM: ${payment.staff.crm}`);
    }
    doc.moveDown();

    // Resumo
    doc.fontSize(12).text('RESUMO DO REPASSE', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Quantidade de Atendimentos: ${payment.feesCount}`);
    doc.text(
      `Valor Total a Receber: R$ ${Number(payment.totalAmount).toFixed(2).replace('.', ',')}`,
    );
    doc.text(`Data de Pagamento: ${formatDateTimeBR(payment.paidAt)}`);
    if (payment.paymentMethod) {
      doc.text(`Método de Pagamento: ${payment.paymentMethod}`);
    }
    doc.moveDown();

    // Lista detalhada
    doc.fontSize(12).text('DETALHAMENTO POR ATENDIMENTO', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);

    payment.fees.forEach((fee, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      const patientName =
        fee.transaction.appointment?.patient?.name || 'Não informado';
      const procedureName =
        fee.transaction.appointment?.procedure?.name || 'Não informado';
      const grossAmount = Number(fee.grossAmount);
      const feeAmount = Number(fee.feeAmount);
      const commissionRate = Number(fee.commissionRate);

      doc.text(`${index + 1}. ${formatDateOnlyBR(fee.createdAt)}`);
      doc.text(`   Paciente: ${patientName}`, { indent: 20 });
      doc.text(`   Procedimento: ${procedureName}`, { indent: 20 });
      doc.text(
        `   Valor Bruto: R$ ${grossAmount.toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.text(`   Tipo de Repasse: ${commissionRate}%`, { indent: 20 });
      doc.text(
        `   Valor Líquido: R$ ${feeAmount.toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.moveDown(0.3);
    });

    // Observações
    if (payment.observations) {
      doc.moveDown();
      doc.fontSize(10).text('OBSERVAÇÕES', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).text(payment.observations);
    }

    // Espaço para assinatura
    doc.moveDown(3);
    doc.fontSize(10);
    doc.text('_________________________________________', { align: 'center' });
    doc.text(payment.staff.name, { align: 'center' });
    doc.text('Assinatura do Profissional', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8);
    doc.text('Atesto o recebimento do valor acima descrito', {
      align: 'center',
    });
    doc.fontSize(10); // Resetar para tamanho padrão

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
      doc.end();
    });
  }

  async generatePendingMedicalFeeReport(
    tenantId: string,
    staffId: string,
    startDate: string,
    endDate: string,
  ): Promise<Buffer> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Buscar repasses pendentes
    const fees = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.medicalFee.findMany({
        where: {
          tenantId,
          staffId,
          status: 'pending',
          transaction: {
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        },
        include: {
          staff: { select: { name: true, specialty: true, crm: true } },
          transaction: {
            include: {
              appointment: {
                include: {
                  patient: { select: { name: true, cpf: true } },
                  procedure: { select: { name: true, grossAmount: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    if (fees.length === 0) {
      throw new NotFoundException(
        'Nenhum repasse pendente encontrado para o período selecionado.',
      );
    }

    const tenant = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
    });

    const totalAmount = fees.reduce(
      (acc, fee) => acc + Number(fee.feeAmount),
      0,
    );

    // Gerar PDF
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    // Cabeçalho
    doc.fontSize(20).text('REPASSES MÉDICOS PENDENTES', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(tenant?.name || '', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(
        `Período: ${format(start, 'dd/MM/yyyy', { locale: ptBR })} a ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`,
        { align: 'center' },
      );
    doc.moveDown();

    // Informações do médico
    doc.fontSize(12).text('INFORMAÇÕES DO PROFISSIONAL', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Nome: ${fees[0].staff.name}`);
    if (fees[0].staff.specialty) {
      doc.text(`Especialidade: ${fees[0].staff.specialty}`);
    }
    if (fees[0].staff.crm) {
      doc.text(`CRM: ${fees[0].staff.crm}`);
    }
    doc.moveDown();

    // Resumo
    doc.fontSize(12).text('RESUMO DOS REPASSES PENDENTES', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Quantidade de Atendimentos: ${fees.length}`);
    doc.text(
      `Valor Total Pendente: R$ ${totalAmount.toFixed(2).replace('.', ',')}`,
    );
    doc.moveDown();

    // Lista detalhada
    doc.fontSize(12).text('DETALHAMENTO POR ATENDIMENTO', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);

    fees.forEach((fee, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      const patientName =
        fee.transaction.appointment?.patient?.name || 'Não informado';
      const procedureName =
        fee.transaction.appointment?.procedure?.name || 'Não informado';
      const grossAmount = Number(fee.grossAmount);
      const feeAmount = Number(fee.feeAmount);
      const commissionRate = Number(fee.commissionRate);

      doc.text(`${index + 1}. ${formatDateOnlyBR(fee.createdAt)}`);
      doc.text(`   Paciente: ${patientName}`, { indent: 20 });
      doc.text(`   Procedimento: ${procedureName}`, { indent: 20 });
      doc.text(
        `   Valor Bruto: R$ ${grossAmount.toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.text(`   Tipo de Repasse: ${commissionRate}%`, { indent: 20 });
      doc.text(
        `   Valor do Repasse: R$ ${feeAmount.toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.moveDown(0.3);
    });

    // Nota
    doc.moveDown(2);
    doc.fontSize(9);
    doc.fillColor('gray');
    doc.text(
      '* Este relatório mostra os repasses pendentes que ainda não foram fechados.',
      { align: 'center' },
    );
    doc.fillColor('black');

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
      doc.end();
    });
  }

  /**
   * Gera relatório de caixas fechados por usuário
   */
  async generateClosuresReport(
    tenantId: string,
    startDate: string,
    endDate: string,
    userId?: string,
  ): Promise<Buffer> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const where: any = {
      tenantId,
      date: { gte: start, lte: end },
    };

    if (userId) {
      where.createdById = userId;
    }

    const closures = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.dailyClosure.findMany({
        where,
        include: {
          closedBy: { select: { name: true, email: true } },
          tenant: { select: { name: true } },
        },
        orderBy: [{ date: 'desc' }, { closureType: 'asc' }],
      });
    });

    if (closures.length === 0) {
      throw new NotFoundException(
        'Nenhum fechamento de caixa encontrado para o período selecionado.',
      );
    }

    const tenant = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
    });

    // Gerar PDF
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    // Cabeçalho
    doc
      .fontSize(20)
      .text('RELATÓRIO DE FECHAMENTOS DE CAIXA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(tenant?.name || '', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(
        `Período: ${format(start, 'dd/MM/yyyy', { locale: ptBR })} a ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`,
        { align: 'center' },
      );
    if (userId) {
      const user = closures[0]?.closedBy;
      if (user) {
        doc.text(`Usuário: ${user.name}`, { align: 'center' });
      }
    }
    doc.moveDown();

    // Resumo geral
    const totalIncome = closures.reduce(
      (acc, c) => acc + Number(c.totalIncome),
      0,
    );
    const totalExpense = closures.reduce(
      (acc, c) => acc + Number(c.totalExpense),
      0,
    );
    const totalNet = closures.reduce((acc, c) => acc + Number(c.netBalance), 0);
    const totalCash = closures.reduce(
      (acc, c) => acc + Number(c.cashCount || 0),
      0,
    );
    const totalCard = closures.reduce(
      (acc, c) => acc + Number(c.cardCount || 0),
      0,
    );
    const totalPix = closures.reduce(
      (acc, c) => acc + Number(c.pixCount || 0),
      0,
    );

    doc.fontSize(12).text('RESUMO DO PERÍODO', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Total de Fechamentos: ${closures.length}`);
    doc.text(
      `Total de Entradas: R$ ${totalIncome.toFixed(2).replace('.', ',')}`,
    );
    doc.text(
      `Total de Saídas: R$ ${totalExpense.toFixed(2).replace('.', ',')}`,
    );
    doc.text(
      `Saldo Líquido Total: R$ ${totalNet.toFixed(2).replace('.', ',')}`,
    );
    doc.moveDown(0.5);
    doc.text('Totais por Conferência Física:');
    doc.text(`  Dinheiro: R$ ${totalCash.toFixed(2).replace('.', ',')}`, {
      indent: 20,
    });
    doc.text(`  Cartão: R$ ${totalCard.toFixed(2).replace('.', ',')}`, {
      indent: 20,
    });
    doc.text(`  PIX: R$ ${totalPix.toFixed(2).replace('.', ',')}`, {
      indent: 20,
    });
    doc.moveDown();

    // Lista de fechamentos
    doc.fontSize(12).text('DETALHAMENTO POR DIA', { underline: true });
    doc.moveDown(0.5);

    closures.forEach((closure, index) => {
      if (doc.y > 650) {
        doc.addPage();
      }

      doc.fontSize(10).fillColor('blue');
      doc.text(
        `${index + 1}. ${formatDateOnlyBR(closure.date)} - ${closure.closureType === 'RECEPTIONIST' ? 'Caixa de Recepcionista' : 'Caixa Administrativo'}`,
      );
      doc.fillColor('black');
      doc.fontSize(9);
      doc.text(`   Responsável: ${closure.closedBy.name}`, { indent: 20 });
      doc.text(
        `   Saldo Inicial: R$ ${Number(closure.initialBalance).toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.text(
        `   Entradas: R$ ${Number(closure.totalIncome).toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.text(
        `   Saídas: R$ ${Number(closure.totalExpense).toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.text(
        `   Saldo Final: R$ ${Number(closure.finalBalance).toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );

      if (closure.cashCount || closure.cardCount || closure.pixCount) {
        doc.text(
          `   Conferência: Dinheiro R$ ${Number(closure.cashCount || 0)
            .toFixed(2)
            .replace('.', ',')} | Cartão R$ ${Number(closure.cardCount || 0)
            .toFixed(2)
            .replace('.', ',')} | PIX R$ ${Number(closure.pixCount || 0)
            .toFixed(2)
            .replace('.', ',')}`,
          { indent: 20 },
        );
      }

      if (closure.difference && Number(closure.difference) !== 0) {
        doc.fillColor('red');
        doc.text(
          `   Diferença: R$ ${Number(closure.difference).toFixed(2).replace('.', ',')}`,
          { indent: 20 },
        );
        doc.fillColor('black');
      }

      if (closure.observations) {
        doc.text(`   Obs: ${closure.observations}`, { indent: 20 });
      }

      doc.moveDown(0.5);
    });

    // Rodapé
    doc.moveDown(2);
    doc.fontSize(8).fillColor('gray');
    doc.text(
      `Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      { align: 'center' },
    );
    doc.fillColor('black');

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
      doc.end();
    });
  }

  async generateExpenseReport(
    tenantId: string,
    startDate: string,
    endDate: string,
    categoryId?: string,
  ): Promise<Buffer> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const where: any = {
      tenantId,
      type: 'expense',
      status: 'completed',
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const transactions = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.transaction.findMany({
        where,
        include: {
          expenseCategory: {
            include: {
              parent: { select: { name: true } },
            },
          },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    const tenant = await this.prisma.withTenant(tenantId, async (tx) => {
      return tx.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
    });

    // Agrupar por categoria
    const byCategory: Record<
      string,
      { count: number; total: number; items: any[] }
    > = {};
    transactions.forEach((t) => {
      const categoryName =
        t.expenseCategory?.name || t.category || 'Sem categoria';
      if (!byCategory[categoryName]) {
        byCategory[categoryName] = { count: 0, total: 0, items: [] };
      }
      byCategory[categoryName].count++;
      byCategory[categoryName].total += Number(t.amount);
      byCategory[categoryName].items.push(t);
    });

    const totalAmount = transactions.reduce(
      (acc, t) => acc + Number(t.amount),
      0,
    );

    // Gerar PDF
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    // Cabeçalho
    doc.fontSize(20).text('RELATÓRIO DE SAÍDAS', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(tenant?.name || '', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(
        `Período: ${format(start, 'dd/MM/yyyy', { locale: ptBR })} a ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`,
        { align: 'center' },
      );
    doc.moveDown();

    // Filtros
    if (categoryId) {
      const category = await this.prisma.withTenant(tenantId, async (tx) => {
        return tx.expenseCategory.findUnique({
          where: { id: categoryId },
          select: { name: true },
        });
      });
      doc.fontSize(10).text(`Categoria: ${category?.name || categoryId}`);
      doc.moveDown();
    }

    // Resumo por categoria
    doc.fontSize(12).text('RESUMO POR CATEGORIA', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    Object.entries(byCategory).forEach(([category, data]) => {
      doc.text(`${category}:`);
      doc.text(`  Quantidade: ${data.count}`, { indent: 20 });
      doc.text(`  Total: R$ ${data.total.toFixed(2).replace('.', ',')}`, {
        indent: 20,
      });
      doc.moveDown(0.3);
    });
    doc.moveDown();

    // Total geral
    doc.fontSize(12).text('TOTAL GERAL', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Quantidade de Despesas: ${transactions.length}`);
    doc.text(`Total de Saídas: R$ ${totalAmount.toFixed(2).replace('.', ',')}`);
    doc.moveDown();

    // Lista detalhada
    doc.fontSize(12).text('DETALHAMENTO', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);

    transactions.forEach((t, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      const categoryName =
        t.expenseCategory?.name || t.category || 'Sem categoria';
      const description = t.description || 'Sem descrição';

      doc.text(`${index + 1}. ${formatDateTimeBR(t.createdAt)}`);
      doc.text(`   Categoria: ${categoryName}`, { indent: 20 });
      doc.text(`   Descrição: ${description}`, { indent: 20 });
      doc.text(
        `   Valor: R$ ${Number(t.amount).toFixed(2).replace('.', ',')}`,
        { indent: 20 },
      );
      doc.text(`   Método: ${t.method || 'Não informado'}`, { indent: 20 });
      if (t.createdBy) {
        doc.text(`   Por: ${t.createdBy.name}`, { indent: 20 });
      }
      doc.moveDown(0.3);
    });

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
      doc.end();
    });
  }
}
