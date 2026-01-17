'use client';

import React, { useState, useEffect } from 'react';
import { reportsService } from '@/services/reports-service';
import { financeService, MedicalFeePayment } from '@/services/finance-service';
import { staffService, Staff } from '@/services/data-service';
import { patientService, Patient } from '@/services/data-service';
import { procedureService, Procedure } from '@/services/data-service';
import { expenseCategoriesService, ExpenseCategory } from '@/services/expense-categories-service';
import { useAuth } from '@/hooks/use-auth';
import { FileText, Download, Calendar, User, Filter, Loader2, Receipt, DollarSign, Calculator, ArrowDownCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

/**
 * Formata uma data para exibição
 * - Para strings no formato 'yyyy-MM-dd' (datas simples): NÃO ajusta timezone
 * - Para timestamps completos (Date ou ISO string com hora): ajusta para UTC-3 (Brasília)
 */
function formatDateBR(date: Date | string, formatStr: string = 'dd/MM/yyyy'): string {
  // Se for string no formato 'yyyy-MM-dd' (data simples selecionada pelo usuário)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Criar data parseando diretamente os componentes para evitar problemas de timezone
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day, 12, 0, 0); // Meio-dia para evitar problemas
    return format(localDate, formatStr, { locale: ptBR });
  }
  
  // Para timestamps do banco (ISO strings completas ou Date objects)
  const d = new Date(date);
  // Ajustar para o fuso horário brasileiro (UTC-3)
  // Subtrai 3 horas para converter de UTC para horário de Brasília
  const brDate = new Date(d.getTime() - (3 * 60 * 60 * 1000));
  return format(brDate, formatStr, { locale: ptBR });
}

type ReportType = 'daily-closure' | 'billing' | 'medical-fee' | 'expenses' | 'closures';

interface DailyClosure {
  id: string;
  date: string;
  closureType: string;
  initialBalance: number;
  finalBalance: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  closedBy: { id: string; name: string };
}

export default function RelatoriosPage() {
  const { user } = useAuth();
  const [activeReport, setActiveReport] = useState<ReportType>('billing');
  const [loading, setLoading] = useState(false);
  
  // Filtros comuns
  const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Filtros específicos
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Dados para filtros
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [medicalFeePayments, setMedicalFeePayments] = useState<MedicalFeePayment[]>([]);
  const [dailyClosures, setDailyClosures] = useState<DailyClosure[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchFilterData();
  }, [activeReport, startDate, endDate]);

  const fetchFilterData = async () => {
    try {
      if (activeReport === 'billing') {
        const [proceduresData, doctorsData, patientsData] = await Promise.all([
          procedureService.getAll(),
          staffService.getAll('DOCTOR'),
          patientService.getAll(),
        ]);
        setProcedures(proceduresData);
        setDoctors(doctorsData);
        setPatients(patientsData);
      } else if (activeReport === 'expenses') {
        try {
          const categoriesData = await expenseCategoriesService.getAll(true);
          setCategories(categoriesData || []);
        } catch (error: any) {
          // Se não houver dados, apenas definir array vazio
          if (error.response?.status === 403 || error.response?.status === 404) {
            setCategories([]);
          } else {
            console.error('Erro ao carregar categorias:', error);
            setCategories([]);
          }
        }
      } else if (activeReport === 'medical-fee') {
        try {
          console.log('Buscando repasses médicos fechados:', { startDate, endDate });
          const paymentsData = await financeService.getMedicalFeePayments({
            startDate,
            endDate,
          });
          console.log('Repasses médicos encontrados:', paymentsData?.length || 0, paymentsData);
          setMedicalFeePayments(paymentsData || []);
          if (!paymentsData || paymentsData.length === 0) {
            console.warn('Nenhum repasse médico encontrado para o período:', { startDate, endDate });
          }
        } catch (error: any) {
          console.error('Erro ao carregar repasses médicos:', error);
          // Se não houver dados ou erro de permissão, apenas definir array vazio
          if (error.response?.status === 403 || error.response?.status === 404) {
            console.warn('Erro 403/404 ao buscar repasses médicos:', error.response?.status);
            setMedicalFeePayments([]);
          } else {
            toast.error('Erro ao carregar fechamentos de repasse. Tente novamente.');
            setMedicalFeePayments([]);
          }
        }
      } else if (activeReport === 'daily-closure' || activeReport === 'closures') {
        // Buscar fechamentos de caixa
        try {
          const closuresData = await financeService.getDailyClosures({
            startDate,
            endDate,
          });
          setDailyClosures(closuresData || []);
          
          // Extrair usuários únicos dos fechamentos
          const uniqueUsers = new Map<string, { id: string; name: string }>();
          closuresData?.forEach((c: DailyClosure) => {
            if (c.closedBy && !uniqueUsers.has(c.closedBy.id)) {
              uniqueUsers.set(c.closedBy.id, { id: c.closedBy.id, name: c.closedBy.name });
            }
          });
          setUsers(Array.from(uniqueUsers.values()));
        } catch (error: any) {
          console.error('Erro ao carregar fechamentos:', error);
          setDailyClosures([]);
        }
      }
    } catch (error: any) {
      // Não mostrar erro para o usuário se for apenas falta de dados
      if (error.response?.status !== 403 && error.response?.status !== 404) {
        console.error('Erro ao carregar dados para filtros:', error);
      }
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      switch (activeReport) {
        case 'billing':
          await reportsService.downloadBillingReport({
            startDate,
            endDate,
            procedureId: selectedProcedureId || undefined,
            staffId: selectedStaffId || undefined,
            patientId: selectedPatientId || undefined,
          });
          toast.success('Relatório de faturamento gerado com sucesso!');
          break;

        case 'expenses':
          try {
            console.log('Gerando relatório de saídas:', { startDate, endDate, categoryId: selectedCategoryId });
            await reportsService.downloadExpenseReport({
              startDate,
              endDate,
              categoryId: selectedCategoryId || undefined,
            });
            toast.success('Relatório de saídas gerado com sucesso!');
          } catch (error: any) {
            console.error('Erro ao gerar relatório de saídas:', error);
            throw error; // Re-throw para ser tratado no catch geral
          }
          break;

        case 'medical-fee':
          if (!selectedPaymentId) {
            toast.error('Selecione um fechamento de repasse');
            setLoading(false);
            return;
          }
          await reportsService.downloadMedicalFeeReport(selectedPaymentId);
          toast.success('Relatório de repasse médico gerado com sucesso!');
          break;

        case 'daily-closure':
          if (!selectedPaymentId) {
            toast.error('Selecione um fechamento de caixa');
            setLoading(false);
            return;
          }
          await reportsService.downloadDailyClosureReport(selectedPaymentId);
          toast.success('Relatório de fechamento de caixa gerado com sucesso!');
          break;

        case 'closures':
          await reportsService.downloadClosuresReport({
            startDate,
            endDate,
            userId: selectedUserId || undefined,
          });
          toast.success('Relatório de fechamentos de caixa gerado com sucesso!');
          break;
      }
    } catch (error: any) {
      console.error('Erro ao gerar relatório:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao gerar relatório';
      
      // Mensagens mais específicas para diferentes tipos de erro
      if (error.response?.status === 404) {
        toast.error('Nenhum dado encontrado para o período selecionado.');
      } else if (error.response?.status === 403) {
        toast.error('Você não tem permissão para gerar este relatório.');
      } else if (error.response?.status === 400) {
        toast.error(errorMessage);
      } else {
        toast.error('Erro ao gerar relatório. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getAllCategoriesFlat = (cats: ExpenseCategory[]): ExpenseCategory[] => {
    const seen = new Set<string>();
    const result: ExpenseCategory[] = [];
    
    const flatten = (categories: ExpenseCategory[]) => {
      categories.forEach(cat => {
        // Evitar duplicatas usando Set
        if (!seen.has(cat.id)) {
          seen.add(cat.id);
          result.push(cat);
        }
        // Processar filhos recursivamente
        if (cat.children && cat.children.length > 0) {
          flatten(cat.children);
        }
      });
    };
    
    flatten(cats);
    return result;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios Financeiros</h1>
          <p className="text-gray-600">Gere e baixe relatórios em PDF.</p>
        </div>
      </div>

      {/* Tabs de tipos de relatório */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveReport('billing')}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              activeReport === 'billing'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Receipt className="h-4 w-4 inline mr-2" />
            Faturamento
          </button>
          <button
            onClick={() => setActiveReport('expenses')}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              activeReport === 'expenses'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ArrowDownCircle className="h-4 w-4 inline mr-2" />
            Saídas
          </button>
          <button
            onClick={() => setActiveReport('medical-fee')}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              activeReport === 'medical-fee'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Calculator className="h-4 w-4 inline mr-2" />
            Repasse Médico
          </button>
          {(user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'RECEPTIONIST') && (
            <>
              <button
                onClick={() => setActiveReport('closures')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  activeReport === 'closures'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <DollarSign className="h-4 w-4 inline mr-2" />
                Fechamentos de Caixa
              </button>
              <button
                onClick={() => setActiveReport('daily-closure')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  activeReport === 'daily-closure'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Caixa Individual
              </button>
            </>
          )}
        </div>

        {/* Filtros comuns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Data Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Filtros específicos por tipo de relatório */}
        {activeReport === 'billing' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Procedimento</label>
              <select
                value={selectedProcedureId}
                onChange={(e) => setSelectedProcedureId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Todos os procedimentos</option>
                {procedures.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Médico
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Todos os médicos</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Paciente</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Todos os pacientes</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeReport === 'expenses' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoria de Despesa</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Todas as categorias</option>
              {getAllCategoriesFlat(categories).map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.code} - {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeReport === 'medical-fee' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Fechamento de Repasse</label>
            <select
              value={selectedPaymentId}
              onChange={(e) => setSelectedPaymentId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Selecione um fechamento</option>
              {medicalFeePayments.length === 0 ? (
                <option value="" disabled>Nenhum fechamento encontrado para o período selecionado</option>
              ) : (
                medicalFeePayments.map(payment => (
                  <option key={payment.id} value={payment.id}>
                    Dr(a). {payment.staff?.name || 'Desconhecido'} - {formatDateBR(payment.periodStart)} a {formatDateBR(payment.periodEnd)} - R$ {Number(payment.totalAmount).toFixed(2).replace('.', ',')}
                  </option>
                ))
              )}
            </select>
            {medicalFeePayments.length === 0 && (
              <p className="mt-2 text-sm text-yellow-600">
                Nenhum fechamento de repasse encontrado para o período {format(new Date(startDate), "dd/MM/yyyy", { locale: ptBR })} a {format(new Date(endDate), "dd/MM/yyyy", { locale: ptBR })}. 
                Verifique se há repasses fechados neste período.
              </p>
            )}
          </div>
        )}

        {activeReport === 'closures' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 inline mr-1" />
              Filtrar por Usuário
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Todos os usuários</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {dailyClosures.length > 0 && (
              <p className="mt-2 text-sm text-green-600">
                {dailyClosures.length} fechamento(s) encontrado(s) no período.
              </p>
            )}
            {dailyClosures.length === 0 && (
              <p className="mt-2 text-sm text-yellow-600">
                Nenhum fechamento encontrado no período selecionado.
              </p>
            )}
          </div>
        )}

        {activeReport === 'daily-closure' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Selecione um Fechamento Específico</label>
            <select
              value={selectedPaymentId}
              onChange={(e) => setSelectedPaymentId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Selecione um fechamento</option>
              {dailyClosures.map(closure => (
                <option key={closure.id} value={closure.id}>
                  {formatDateBR(closure.date)} - {closure.closedBy?.name} ({closure.closureType === 'RECEPTIONIST' ? 'Recepção' : 'Admin'}) - R$ {closure.finalBalance.toFixed(2).replace('.', ',')}
                </option>
              ))}
            </select>
            {dailyClosures.length === 0 && (
              <p className="mt-2 text-sm text-yellow-600">
                Nenhum fechamento encontrado no período selecionado.
              </p>
            )}
          </div>
        )}

        {/* Botão de gerar relatório */}
        <div className="flex justify-end">
          <button
            onClick={handleGenerateReport}
            disabled={loading || (activeReport === 'medical-fee' && !selectedPaymentId) || (activeReport === 'daily-closure' && !selectedPaymentId) || (activeReport === 'closures' && dailyClosures.length === 0)}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Gerar e Baixar Relatório PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Informações sobre os relatórios */}
      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
        <h3 className="font-bold text-blue-900 mb-3 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Informações sobre os Relatórios
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          {activeReport === 'billing' && (
            <>
              <p><strong>Relatório de Faturamento:</strong> Mostra todos os atendimentos faturados no período selecionado, com opção de filtrar por procedimento, médico ou paciente.</p>
              <p>Inclui resumo por procedimento e lista detalhada de cada atendimento.</p>
            </>
          )}
          {activeReport === 'expenses' && (
            <>
              <p><strong>Relatório de Saídas:</strong> Lista todas as despesas do período, com opção de filtrar por categoria.</p>
              <p>Inclui resumo por categoria e lista detalhada de cada despesa.</p>
            </>
          )}
          {activeReport === 'medical-fee' && (
            <>
              <p><strong>Relatório de Repasse Médico:</strong> Documento detalhado de um fechamento de repasse específico.</p>
              <p>Inclui informações do profissional, período, lista de atendimentos, valores e espaço para assinatura.</p>
            </>
          )}
          {activeReport === 'closures' && (
            <>
              <p><strong>Relatório de Fechamentos de Caixa:</strong> Consolidado de todos os fechamentos de caixa do período.</p>
              <p>Inclui resumo geral, detalhamento por dia e totais por método de pagamento. Pode filtrar por usuário.</p>
            </>
          )}
          {activeReport === 'daily-closure' && (
            <>
              <p><strong>Relatório de Caixa Individual:</strong> Documento detalhado de um fechamento específico.</p>
              <p>Inclui saldo inicial/final, resumo por método de pagamento, conferência física e lista de transações.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
