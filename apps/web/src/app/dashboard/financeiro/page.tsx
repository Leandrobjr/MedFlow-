'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { financeService, Transaction, MedicalFee } from '@/services/finance-service';
import { staffService, Staff } from '@/services/data-service';
import { patientService, Patient } from '@/services/data-service';
import { expenseCategoriesService, ExpenseCategory } from '@/services/expense-categories-service';
import { useAuth } from '@/hooks/use-auth';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Calculator, Calendar, Loader2, Plus, Filter, XCircle, Lock, CheckCircle2, User, Download, FileText, BarChart3, ChevronDown, Printer, Wrench } from 'lucide-react';
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

const TRANSACTION_CATEGORIES = {
  INCOME: ['Consulta', 'Exame', 'Procedimento', 'Outros'],
  EXPENSE: ['Material', 'Medicamento', 'Despesa Operacional', 'Outros'],
};

const PAYMENT_METHODS = ['Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'PIX', 'Transferência'];

export default function FinanceiroPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Helper para normalizar role para uppercase
  const getUserRole = () => user?.role?.toUpperCase();
  
  // Estado para armazenar parâmetros de abertura de fechamento (via sessionStorage)
  const [closureParams, setClosureParams] = useState<{ date: string | null; userId: string | null; closureType: string | null }>({
    date: null,
    userId: null,
    closureType: null,
  });
  const [paramsProcessed, setParamsProcessed] = useState(false);
  
  // Capturar parâmetros do sessionStorage (salvos pela página de relatórios)
  useEffect(() => {
    if (typeof window !== 'undefined' && !paramsProcessed) {
      const stored = sessionStorage.getItem('openClosureParams');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          console.log('[CLOSURE-PARAMS] Lido do sessionStorage:', parsed);
          setClosureParams({
            date: parsed.date || null,
            userId: parsed.userId || null,
            closureType: parsed.closureType || null,
          });
          // Limpar após ler para não interferir em navegações futuras
          sessionStorage.removeItem('openClosureParams');
        } catch (e) {
          console.error('[CLOSURE-PARAMS] Erro ao parsear:', e);
        }
      }
      setParamsProcessed(true);
    }
  }, [paramsProcessed]);
  
  const urlDateParam = closureParams.date;
  const urlUserIdParam = closureParams.userId;
  const urlClosureTypeParam = closureParams.closureType as 'ADMIN' | 'RECEPTIONIST' | null;
  
  // DOCTOR só pode ver repasses, não fluxo de caixa
  const [activeTab, setActiveTab] = useState<'caixa' | 'repasses'>(
    getUserRole() === 'DOCTOR' ? 'repasses' : 'caixa'
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [medicalFees, setMedicalFees] = useState<MedicalFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  // Período padrão: últimos 3 meses para garantir que repasses pendentes apareçam
  const defaultStartDate = new Date();
  defaultStartDate.setMonth(defaultStartDate.getMonth() - 3);
  defaultStartDate.setDate(1); // Primeiro dia do mês há 3 meses
  const [repasseStartDate, setRepasseStartDate] = useState(format(defaultStartDate, 'yyyy-MM-dd'));
  const [repasseEndDate, setRepasseEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [isRepasseModalOpen, setIsRepasseModalOpen] = useState(false);
  const [selectedStaffForRepasse, setSelectedStaffForRepasse] = useState<Staff | null>(null);
  const [repasseFormData, setRepasseFormData] = useState({
    paymentMethod: '',
    observations: '',
  });
  const [isViewRepasseModalOpen, setIsViewRepasseModalOpen] = useState(false);
  const [selectedRepasseForView, setSelectedRepasseForView] = useState<{
    doctor: Staff | null;
    fees: MedicalFee[];
    total: number;
  } | null>(null);
  const [closedPaymentId, setClosedPaymentId] = useState<string | null>(null);
  const [isClosingRepasse, setIsClosingRepasse] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceptionistClosureModalOpen, setIsReceptionistClosureModalOpen] = useState(false);
  const [isAdminClosureModalOpen, setIsAdminClosureModalOpen] = useState(false);
  const [boxStatus, setBoxStatus] = useState<any>(null);
  const [closureStatus, setClosureStatus] = useState<any>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [receptionists, setReceptionists] = useState<Staff[]>([]);
  const [selectedReceptionistId, setSelectedReceptionistId] = useState<string>('');
  const [selectedBoxUserId, setSelectedBoxUserId] = useState<string>(''); // Usuário selecionado no dropdown de caixas
  const [selectedClosureType, setSelectedClosureType] = useState<'ADMIN' | 'RECEPTIONIST' | null>(null); // Tipo de caixa selecionado
  const [isBoxDropdownOpen, setIsBoxDropdownOpen] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  
  // Estado para preview de fechamento
  const [closurePreview, setClosurePreview] = useState<{
    date: string;
    previousDayFinalBalance: number;
    transactions: {
      id: string;
      type: string;
      category: string;
      description: string;
      amount: number;
      method: string;
      createdAt: string;
      createdBy?: string;
    }[];
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    suggestedFinalBalance: number;
    balancesByMethod: Record<string, { income: number; expense: number }>;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [lastSavedClosureId, setLastSavedClosureId] = useState<string | null>(null);
  const [isClosingAdminBox, setIsClosingAdminBox] = useState(false);
  const [isClosingReceptionistBox, setIsClosingReceptionistBox] = useState(false);
  
  // Edit transaction state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    description: '',
    amount: '',
    method: '',
    category: '',
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  
  // Form state
  const [formData, setFormData] = useState({
    type: 'INCOME' as 'INCOME' | 'EXPENSE',
    category: '',
    categoryId: '',
    amount: '',
    method: 'Dinheiro',
    description: '',
    patientId: '',
    staffId: '',
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'caixa') {
        // DOCTOR não tem acesso ao fluxo de caixa, apenas aos repasses
        if (getUserRole() === 'DOCTOR') {
          setLoading(false);
          return;
        }
        
        // Determinar qual usuário consultar
        // Para RECEPTIONIST: sempre filtra pelo próprio usuário ou o selecionado
        // Para ADMIN/OWNER: só filtra se um recepcionista específico foi selecionado no dropdown
        const isAdminOrOwner = getUserRole() === 'ADMIN' || getUserRole() === 'OWNER';
        
        // Se for Admin/Owner e nenhum recepcionista foi selecionado, não filtrar (ver todas as transações)
        const userIdToQuery = isAdminOrOwner 
          ? (selectedBoxUserId || undefined) // Admin sem seleção = undefined = ver tudo
          : (selectedBoxUserId || user?.id || ''); // Recepcionista sempre filtra
        
        // Definir tipo de fechamento:
        // - RECEPTIONIST logado: sempre 'RECEPTIONIST'
        // - ADMIN/OWNER: usar selectedClosureType se definido, senão inferir:
        //   - Com usuário selecionado: 'RECEPTIONIST' (caixa de recepção)
        //   - Sem usuário selecionado: 'ADMIN' (caixa administrativo)
        const closureType =
          getUserRole() === 'RECEPTIONIST'
            ? 'RECEPTIONIST'
            : (selectedClosureType || (selectedBoxUserId ? 'RECEPTIONIST' : 'ADMIN'));
        
        // Usar Promise.allSettled para não falhar se uma requisição der erro
        const results = await Promise.allSettled([
          financeService.getTransactions(selectedDate, userIdToQuery),
          financeService.getClosureStatus(selectedDate, userIdToQuery || user?.id || '', closureType),
          financeService.getBoxStatus(selectedDate, userIdToQuery),
        ]);
        
        // Processar resultados
        const [transactionsResult, closureStatusResult, boxStatusResult] = results;
        
        // Transações
        if (transactionsResult.status === 'fulfilled') {
          setTransactions(transactionsResult.value || []);
          console.log('Transações carregadas:', transactionsResult.value?.length || 0, 'para data:', selectedDate, 'usuário:', userIdToQuery);
        } else {
          console.error('Erro ao carregar transações:', transactionsResult.reason);
          setTransactions([]);
          // Só mostrar erro se não for 404 (sem dados é normal)
          if (transactionsResult.reason?.response?.status !== 404) {
            toast.error('Erro ao carregar transações. Tente novamente.');
          }
        }
        
        // Status de fechamento
        if (closureStatusResult.status === 'fulfilled') {
          setClosureStatus(closureStatusResult.value);
        } else {
          console.error('Erro ao carregar status de fechamento:', closureStatusResult.reason);
          setClosureStatus(null);
          // Não mostrar erro para o usuário se for 404 (sem fechamento é normal)
          if (closureStatusResult.reason?.response?.status !== 404 && closureStatusResult.reason?.response?.status !== 500) {
            // Erros 500 são tratados globalmente, não mostrar aqui
          }
        }
        
        // Status do caixa
        if (boxStatusResult.status === 'fulfilled') {
          setBoxStatus(boxStatusResult.value);
        } else {
          console.error('Erro ao carregar status do caixa:', boxStatusResult.reason);
          setBoxStatus(null);
          // Não mostrar erro para o usuário se for 404 (sem dados é normal)
          if (boxStatusResult.reason?.response?.status !== 404 && boxStatusResult.reason?.response?.status !== 500) {
            // Erros 500 são tratados globalmente, não mostrar aqui
          }
        }
      } else {
        // Todos os usuários (incluindo RECEPTIONIST) podem ver repasses
        // Apenas a ação de fechar repasses é restrita a ADMIN/OWNER
        try {
          console.log('Buscando repasses pendentes:', {
            role: user?.role,
            staffId: user?.staffId,
            selectedDoctorId,
            repasseStartDate,
            repasseEndDate,
            status: 'pending',
          });
          
          // Buscar apenas repasses pendentes (histórico está disponível em Relatórios)
          const feesData = await financeService.getMedicalFees({
            doctorId: user?.role === 'DOCTOR' ? (user.staffId || undefined) : (selectedDoctorId || undefined),
            startDate: repasseStartDate,
            endDate: repasseEndDate,
            status: 'pending',
          });
          
          console.log('Repasses pendentes encontrados:', feesData?.length || 0, feesData);
          
          setMedicalFees(feesData || []);
        } catch (error: any) {
          console.error('Erro ao buscar repasses pendentes:', error);
          // Se for erro 403 ou 404, apenas definir array vazio
          if (error.response?.status === 403 || error.response?.status === 404) {
            console.warn('Erro 403/404 ao buscar repasses - definindo array vazio');
            setMedicalFees([]);
            // Não relançar o erro para não mostrar toast duplicado
            return;
          }
          throw error; // Relançar outros erros
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados financeiros:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Erro ao carregar dados financeiros';
      
        // Tratamento específico para erros 403 (sem permissão)
      if (error.response?.status === 403) {
        // RECEPTIONIST agora tem permissão para ver repasses, então este erro não deve ocorrer
        // Mas mantemos o tratamento caso alguma operação específica não seja permitida
        toast.error('Você não tem permissão para realizar esta operação.');
      } else if (error.response?.status === 404) {
        // 404 = Não encontrado - Isso NÃO é um erro, apenas significa que não há dados ainda
        // Não mostrar erro para o usuário, apenas logar para debug se necessário
        // Exemplo: tentar buscar repasses que ainda não existem é normal
      } else if (error.response?.status === 401) {
        // 401 = Não autenticado - Problema de login, mas não vamos mostrar aqui
        // (o sistema de autenticação deve redirecionar)
      } else if (error.response?.status >= 500) {
        // 500+ = Erro do servidor - ISSO É UM ERRO REAL que precisa ser corrigido
        // Mas não mostrar múltiplos toasts se várias requisições falharem
        const errorCount = error.response?.data?.errorCount || 1;
        if (errorCount === 1) {
          toast.error('Erro no servidor. Verificando conexão...', { duration: 3000 });
        }
        console.error('Erro do servidor:', errorMessage);
      } else if (error.response?.status !== 401) {
        // Outros erros - pode ser erro real ou apenas falta de dados
        // Só mostrar se for realmente importante
        console.warn('Aviso ao carregar dados (pode ser normal):', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [patientsData, doctorsData, receptionistsData, categoriesData] = await Promise.all([
        patientService.getAll(),
        staffService.getAll('DOCTOR'),
        staffService.getAll('RECEPTIONIST'),
        expenseCategoriesService.getAll(true), // Incluir inativas para ter todas as opções
      ]);
      setPatients(patientsData);
      setDoctors(doctorsData);
      setReceptionists(receptionistsData);
      setExpenseCategories(categoriesData);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais', error);
    }
  };

  // Estado para controlar se a inicialização foi concluída
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Processar parâmetros da URL capturados no mount
  useEffect(() => {
    // Aguardar user e processamento de params
    if (!user || !paramsProcessed) return;
    
    // Verificar se há parâmetros na URL
    const hasUrlParams = urlDateParam || urlUserIdParam || urlClosureTypeParam;
    
    console.log('[URL] ======= INÍCIO DO PROCESSAMENTO =======');
    console.log('[URL] urlDateParam RECEBIDO:', urlDateParam, 'tipo:', typeof urlDateParam);
    console.log('[URL] urlUserIdParam:', urlUserIdParam);
    console.log('[URL] urlClosureTypeParam:', urlClosureTypeParam);
    console.log('[URL] role:', getUserRole());
    
    if (hasUrlParams && !isInitialized) {
      // Determinar os valores finais
      let finalDate = urlDateParam || selectedDate;
      let finalUserId = selectedBoxUserId;
      let finalClosureType: 'ADMIN' | 'RECEPTIONIST' | null = selectedClosureType;
      
      const isAdminOrOwner = getUserRole() === 'ADMIN' || getUserRole() === 'OWNER';
      
      if (urlUserIdParam && isAdminOrOwner) {
        finalUserId = urlUserIdParam;
        finalClosureType = urlClosureTypeParam || 'RECEPTIONIST';
      } else if (urlClosureTypeParam) {
        finalClosureType = urlClosureTypeParam;
        if (urlClosureTypeParam === 'ADMIN') {
          finalUserId = '';
        }
      }
      
      console.log('[URL] ======= VALORES FINAIS =======');
      console.log('[URL] finalDate CALCULADO:', finalDate);
      console.log('[URL] finalUserId:', finalUserId);
      console.log('[URL] finalClosureType:', finalClosureType);
      console.log('[URL] selectedDate ANTERIOR:', selectedDate);
      
      // Atualizar estados
      console.log('[URL] Setando selectedDate para:', finalDate);
      setSelectedDate(finalDate);
      setSelectedBoxUserId(finalUserId);
      setSelectedClosureType(finalClosureType);
      setIsInitialized(true);
      
      // Fazer fetch imediato com os valores corretos
      (async () => {
        setLoading(true);
        try {
          if (activeTab === 'caixa' && getUserRole() !== 'DOCTOR') {
            const isAdmin = getUserRole() === 'ADMIN' || getUserRole() === 'OWNER';
            const userIdToQuery = isAdmin ? (finalUserId || undefined) : (finalUserId || user?.id || '');
            const closureType = getUserRole() === 'RECEPTIONIST'
              ? 'RECEPTIONIST'
              : (finalClosureType || (finalUserId ? 'RECEPTIONIST' : 'ADMIN'));
            
            console.log('[URL] Buscando dados:', { date: finalDate, userId: userIdToQuery, closureType });
            
            const results = await Promise.allSettled([
              financeService.getTransactions(finalDate, userIdToQuery),
              financeService.getClosureStatus(finalDate, userIdToQuery || user?.id || '', closureType),
              financeService.getBoxStatus(finalDate, userIdToQuery),
            ]);
            
            const [transactionsResult, closureStatusResult, boxStatusResult] = results;
            
            if (transactionsResult.status === 'fulfilled') {
              setTransactions(transactionsResult.value || []);
              console.log('[URL] Transações carregadas:', transactionsResult.value?.length || 0);
            }
            if (closureStatusResult.status === 'fulfilled') {
              setClosureStatus(closureStatusResult.value);
            }
            if (boxStatusResult.status === 'fulfilled') {
              setBoxStatus(boxStatusResult.value);
            }
          }
        } catch (error) {
          console.error('[URL] Erro ao carregar dados:', error);
        } finally {
          setLoading(false);
        }
      })();
    } else if (!isInitialized) {
      // Sem parâmetros na URL - inicializar normalmente
      setIsInitialized(true);
      fetchFinanceData();
    }
  }, [user, paramsProcessed, urlDateParam, urlUserIdParam, urlClosureTypeParam]); // Executar quando user e params estiverem prontos

  // Buscar dados financeiros quando estados mudarem (após inicialização)
  useEffect(() => {
    // Só executar após a inicialização e quando não há parâmetros de URL
    if (!user || !isInitialized) return;
    const hasUrlParams = urlDateParam || urlUserIdParam || urlClosureTypeParam;
    if (hasUrlParams) return; // Evitar fetch duplicado se veio de URL
    
    console.log('[FETCH] Buscando dados:', { selectedDate, selectedBoxUserId, selectedClosureType });
    fetchFinanceData();
  }, [activeTab, selectedDate, selectedBoxUserId, selectedClosureType, repasseStartDate, repasseEndDate, selectedDoctorId]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setIsBoxDropdownOpen(false);
      }
    };
    
    if (isBoxDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isBoxDropdownOpen]);

  // Verificar se há um fechamento salvo para mostrar os valores do snapshot
  // closureStatus pode ser um objeto (fechamento específico) ou array (todos os fechamentos do dia)
  const getRelevantClosure = () => {
    if (!closureStatus) return null;
    
    // Se for array, encontrar o fechamento relevante baseado no tipo e usuário selecionado
    if (Array.isArray(closureStatus)) {
      const isAdminClosure = selectedClosureType === 'ADMIN' || (!selectedBoxUserId && (getUserRole() === 'ADMIN' || getUserRole() === 'OWNER'));
      if (isAdminClosure) {
        return closureStatus.find((c: any) => c.closureType === 'ADMIN');
      } else {
        return closureStatus.find((c: any) => c.closureType === 'RECEPTIONIST' && (!selectedBoxUserId || c.createdById === selectedBoxUserId));
      }
    }
    
    // Se for objeto único, retornar diretamente
    return closureStatus;
  };
  
  const relevantClosure = getRelevantClosure();
  const hasClosedBox = !!relevantClosure;
  
  // Se o caixa está fechado, usar valores salvos do fechamento (snapshot)
  // Caso contrário, calcular em tempo real das transações
  const totalIncome = hasClosedBox 
    ? Number(relevantClosure.totalIncome || 0)
    : transactions
        .filter(t => t.type === 'INCOME' || t.type === 'income')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalExpense = hasClosedBox
    ? Number(relevantClosure.totalExpense || 0)
    : transactions
        .filter(t => t.type === 'EXPENSE' || t.type === 'expense')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  // Calcular saldos por método de pagamento
  const balancesByMethod = boxStatus?.balancesByMethod || {};
  
  // Saldo inicial: se fechado, usar do fechamento; senão do boxStatus
  const initialBalance = hasClosedBox
    ? Number(relevantClosure.initialBalance || 0)
    : Number(boxStatus?.previousDayFinalBalance || 0);
  
  // Entradas e saídas por método (tempo real - não há snapshot por método)
  const incomeCash = Number(balancesByMethod?.Dinheiro?.income || 0);
  const expenseCash = Number(balancesByMethod?.Dinheiro?.expense || 0);
  const incomePix = Number(balancesByMethod?.PIX?.income || 0);
  const expensePix = Number(balancesByMethod?.PIX?.expense || 0);
  const incomeDebit = Number(balancesByMethod?.['Cartão de Débito']?.income || 0);
  const expenseDebit = Number(balancesByMethod?.['Cartão de Débito']?.expense || 0);
  const incomeCredit = Number(balancesByMethod?.['Cartão de Crédito']?.income || 0);
  const expenseCredit = Number(balancesByMethod?.['Cartão de Crédito']?.expense || 0);
  
  // Saldo Final: se fechado, usar do fechamento; senão calcular
  const dayBalance = hasClosedBox
    ? Number(relevantClosure.finalBalance || 0)
    : initialBalance + totalIncome - totalExpense;
  
  // Saldo em Dinheiro: se fechado, usar cashCount do fechamento; senão calcular
  const transfers = 0;
  const finalBalance = hasClosedBox
    ? Number(relevantClosure.cashCount || 0)
    : initialBalance + incomeCash - expenseCash - transfers;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (formData.type === 'EXPENSE') {
      if (!formData.categoryId) {
        errors.category = 'Categoria é obrigatória';
      }
    } else {
      if (!formData.category) {
        errors.category = 'Categoria é obrigatória';
      }
    }
    
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = 'Valor deve ser maior que zero';
    }
    
    if (!formData.method) {
      errors.method = 'Método de pagamento é obrigatório';
    }

    // Descrição obrigatória para lançamentos manuais
    if (!formData.description || formData.description.trim() === '') {
      errors.description = 'Descrição é obrigatória';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }
    
    // Verificar se o caixa está fechado
    const isAdminOrOwnerCheck = getUserRole() === 'ADMIN' || getUserRole() === 'OWNER';
    const userIdToCheck = isAdminOrOwnerCheck 
      ? (selectedBoxUserId || user?.id || '') 
      : (selectedBoxUserId || user?.id || '');
    // Mesmo critério de closureType usado em fetchFinanceData
    const closureType =
      getUserRole() === 'RECEPTIONIST'
        ? 'RECEPTIONIST'
        : (selectedClosureType || (selectedBoxUserId ? 'RECEPTIONIST' : 'ADMIN'));
    if (boxStatus?.userClosure && boxStatus.userClosure.closureType === closureType) {
      toast.error('Este caixa já foi fechado. Não é possível adicionar novos lançamentos.');
      return;
    }
    
    try {
      await financeService.createTransaction({
        type: formData.type,
        category: formData.category,
        categoryId: formData.categoryId || undefined,
        amount: Number(formData.amount),
        method: formData.method,
        description: formData.description || undefined,
        patientId: formData.patientId || undefined,
        staffId: formData.staffId || undefined,
      });
      toast.success('Transação registrada com sucesso!');
      setIsModalOpen(false);
      resetForm();
      fetchFinanceData();
    } catch (error: any) {
      console.error('Erro ao criar transação:', error);
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao registrar transação';
      if (message.includes('fechado') || message.includes('fechado')) {
        toast.error('O caixa deste dia já foi fechado. Não é possível realizar novas transações.');
      } else if (message.includes('categoria') || message.includes('category')) {
        toast.error('Categoria inválida ou inativa. Por favor, selecione outra categoria.');
      } else {
        toast.error(message);
      }
    }
  };

  // Funções de edição de transação
  const openEditModal = (transaction: any) => {
    setEditingTransaction(transaction);
    setEditFormData({
      description: transaction.description || '',
      amount: String(transaction.amount || 0),
      method: transaction.paymentMethod || transaction.method || 'Dinheiro',
      category: transaction.category || '',
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const validateEditForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!editFormData.description || editFormData.description.trim() === '') {
      errors.description = 'Descrição é obrigatória';
    }
    
    if (!editFormData.amount || Number(editFormData.amount) <= 0) {
      errors.amount = 'Valor deve ser maior que zero';
    }
    
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEditForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    if (!editingTransaction) return;

    try {
      await financeService.updateTransaction(editingTransaction.id, {
        description: editFormData.description,
        amount: Number(editFormData.amount),
        method: editFormData.method,
        category: editFormData.category || undefined,
      });
      toast.success('Transação atualizada com sucesso!');
      setIsEditModalOpen(false);
      setEditingTransaction(null);
      fetchFinanceData();
    } catch (error: any) {
      console.error('Erro ao atualizar transação:', error);
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao atualizar transação';
      toast.error(message);
    }
  };

  const [closureFormData, setClosureFormData] = useState({
    initialBalance: '',
    finalBalance: '',
    cashCount: '',
    cardCount: '',
    pixCount: '',
    observations: '',
    paymentMethod: '',
  });

  const [closureFormErrors, setClosureFormErrors] = useState<Record<string, string>>({});

  const validateClosureForm = (): boolean => {
    // Validação removida - os valores são automáticos do preview
    return true;
  };

  const handleCloseReceptionistBox = async () => {
    if (!user?.id) {
      toast.error('Usuário não identificado');
      return;
    }
    
    if (!confirm('Tem certeza que deseja fechar seu caixa deste dia? Após fechado, não será possível realizar novas transações.')) {
      return;
    }

    if (!closurePreview) {
      toast.error('Dados do preview não disponíveis. Por favor, tente novamente.');
      return;
    }

    setIsClosingReceptionistBox(true);
    console.log('[handleCloseReceptionistBox] Iniciando fechamento...');
    
    try {
      const initialBalance = closurePreview.previousDayFinalBalance || 0;
      const finalBalance = closurePreview.previousDayFinalBalance + closurePreview.totalIncome - closurePreview.totalExpense;
      
      // Calcular saldo em dinheiro para o próximo dia usar como saldo inicial
      const dinheiroIncome = closurePreview.balancesByMethod?.['Dinheiro']?.income || 0;
      const dinheiroExpense = closurePreview.balancesByMethod?.['Dinheiro']?.expense || 0;
      const cashCount = initialBalance + dinheiroIncome - dinheiroExpense;
      
      // Saldos por método para registro
      const pixBalance = (closurePreview.balancesByMethod?.['PIX']?.income || 0) - (closurePreview.balancesByMethod?.['PIX']?.expense || 0);
      const cardDebitoBalance = (closurePreview.balancesByMethod?.['Cartão de Débito']?.income || 0) - (closurePreview.balancesByMethod?.['Cartão de Débito']?.expense || 0);
      const cardCreditoBalance = (closurePreview.balancesByMethod?.['Cartão de Crédito']?.income || 0) - (closurePreview.balancesByMethod?.['Cartão de Crédito']?.expense || 0);
      const cardCount = cardDebitoBalance + cardCreditoBalance;
      
      console.log('[handleCloseReceptionistBox] Calculando cashCount:', {
        initialBalance,
        dinheiroIncome,
        dinheiroExpense,
        cashCount,
        pixBalance,
        cardCount
      });
      
      const result = await financeService.closeReceptionistBox({
        date: selectedDate,
        initialBalance,
        finalBalance,
        cashCount: cashCount,
        cardCount: cardCount,
        pixCount: pixBalance,
        observations: closureFormData.observations || undefined,
      });
      
      console.log('[handleCloseReceptionistBox] Sucesso! ID:', result.id);
      toast.success('Caixa fechado com sucesso!', { duration: 5000 });
      setLastSavedClosureId(result.id);
      setClosureFormData({
        initialBalance: '',
        finalBalance: '',
        cashCount: '',
        cardCount: '',
        pixCount: '',
        observations: '',
        paymentMethod: '',
      });
      fetchFinanceData();
    } catch (error: any) {
      console.error('[handleCloseReceptionistBox] Erro:', error);
      let message = 'Erro ao fechar caixa. Tente novamente.';
      
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        message = 'Erro de conexão com o servidor. Verifique se o backend está rodando.';
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      }
      
      toast.error(message, { duration: 5000 });
    } finally {
      setIsClosingReceptionistBox(false);
    }
  };

  const handleCloseAdminBox = async () => {
    if (!user?.id) {
      toast.error('Usuário não identificado');
      return;
    }
    
    if (!confirm('Tem certeza que deseja fechar o caixa administrativo deste dia? Após fechado, não será possível realizar novas transações.')) {
      return;
    }

    if (!closurePreview) {
      toast.error('Dados do preview não disponíveis. Por favor, tente novamente.');
      return;
    }

    setIsClosingAdminBox(true);
    console.log('[handleCloseAdminBox] Iniciando fechamento...');
    
    try {
      const initialBalance = closurePreview.previousDayFinalBalance || 0;
      const finalBalance = initialBalance + (closurePreview.totalIncome || 0) - (closurePreview.totalExpense || 0);
      
      // Calcular saldo em dinheiro automaticamente
      const cashIncome = closurePreview.balancesByMethod?.['Dinheiro']?.income || 0;
      const cashExpense = closurePreview.balancesByMethod?.['Dinheiro']?.expense || 0;
      const cashCount = initialBalance + cashIncome - cashExpense;
      
      // Calcular saldos por método
      const pixIncome = closurePreview.balancesByMethod?.['PIX']?.income || 0;
      const pixExpense = closurePreview.balancesByMethod?.['PIX']?.expense || 0;
      const pixBalance = pixIncome - pixExpense;
      
      const cardDebitIncome = closurePreview.balancesByMethod?.['Cartão de Débito']?.income || 0;
      const cardDebitExpense = closurePreview.balancesByMethod?.['Cartão de Débito']?.expense || 0;
      const cardCreditIncome = closurePreview.balancesByMethod?.['Cartão de Crédito']?.income || 0;
      const cardCreditExpense = closurePreview.balancesByMethod?.['Cartão de Crédito']?.expense || 0;
      const cardBalance = (cardDebitIncome - cardDebitExpense) + (cardCreditIncome - cardCreditExpense);
      
      console.log('[handleCloseAdminBox] Enviando dados:', { selectedDate, initialBalance, finalBalance, cashCount });
      
      const result = await financeService.closeAdminBox({
        date: selectedDate,
        initialBalance,
        finalBalance,
        cashCount: cashCount,
        cardCount: cardBalance,
        pixCount: pixBalance,
        observations: closureFormData.observations || undefined,
      });
      
      console.log('[handleCloseAdminBox] Sucesso! ID:', result.id);
      toast.success('Caixa administrativo fechado com sucesso!', { duration: 5000 });
      setLastSavedClosureId(result.id);
      setClosureFormData({
        initialBalance: '',
        finalBalance: '',
        cashCount: '',
        cardCount: '',
        pixCount: '',
        observations: '',
        paymentMethod: '',
      });
      fetchFinanceData();
    } catch (error: any) {
      console.error('[handleCloseAdminBox] Erro:', error);
      let message = 'Erro ao fechar caixa. Tente novamente.';
      
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        message = 'Erro de conexão com o servidor. Verifique se o backend está rodando.';
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      }
      
      toast.error(message, { duration: 5000 });
    } finally {
      setIsClosingAdminBox(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'INCOME',
      category: '',
      categoryId: '',
      amount: '',
      method: 'Dinheiro',
      description: '',
      patientId: '',
      staffId: '',
    });
    setFormErrors({});
  };

  // Função para construir opções de categorias hierárquicas
  const buildCategoryOptions = (categories: ExpenseCategory[], parentId: string | null = null, level: number = 0): JSX.Element[] => {
    const filtered = categories.filter(cat => {
      const matchesParent = cat.parentId === parentId;
      const isActive = cat.isActive;
      return matchesParent && isActive;
    });
    return filtered.flatMap(cat => [
      <option key={cat.id} value={cat.id}>
        {'  '.repeat(level)} {cat.name} ({cat.code})
      </option>,
      ...buildCategoryOptions(categories, cat.id, level + 1),
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-600">Gestão de fluxo de caixa e repasses médicos.</p>
        </div>
        <div className="flex gap-2">
          {getUserRole() !== 'DOCTOR' && (
            <div className="relative">
              <button
                onClick={() => setIsBoxDropdownOpen(!isBoxDropdownOpen)}
                className={`px-4 py-2 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'caixa' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                Caixas
                <ChevronDown className="h-4 w-4" />
              </button>
              {isBoxDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <div
                      onClick={() => {
                        setSelectedBoxUserId(user?.id || '');
                        // Se for ADMIN/OWNER selecionando próprio caixa, mostrar caixa ADMIN
                        if (getUserRole() === 'ADMIN' || getUserRole() === 'OWNER') {
                          setSelectedClosureType('ADMIN');
                        } else {
                          setSelectedClosureType('RECEPTIONIST');
                        }
                        setActiveTab('caixa');
                        setIsBoxDropdownOpen(false);
                      }}
                      className={`px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedBoxUserId === user?.id ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {user?.name || 'Meu Caixa'}
                    </div>
                    {(getUserRole() === 'ADMIN' || getUserRole() === 'OWNER') && (
                      <>
                        <div className="border-t border-gray-200 my-2"></div>
                        <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase">Recepcionistas</div>
                        {receptionists.map(r => (
                          r.userId && (
                            <div
                              key={r.userId}
                              onClick={() => {
                                setSelectedBoxUserId(r.userId || '');
                                // Selecionar recepcionista = caixa de recepção
                                setSelectedClosureType('RECEPTIONIST');
                                setActiveTab('caixa');
                                setIsBoxDropdownOpen(false);
                              }}
                              className={`px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                                selectedBoxUserId === r.userId ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
                              }`}
                            >
                              {r.name}
                            </div>
                          )
                        ))}
                        <div className="border-t border-gray-200 my-2"></div>
                        <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase">Administradores</div>
                        <div
                          onClick={() => {
                            setSelectedBoxUserId(user?.id || '');
                            // Selecionar próprio caixa como admin = caixa ADMIN
                            setSelectedClosureType('ADMIN');
                            setActiveTab('caixa');
                            setIsBoxDropdownOpen(false);
                          }}
                          className={`px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedBoxUserId === user?.id ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          {user?.name || 'Caixa Admin'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setActiveTab('repasses')}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'repasses' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Repasses Médicos
          </button>
          <Link
            href="/dashboard/financeiro/relatorios"
            className="inline-flex items-center px-4 py-2 rounded-xl font-semibold transition-all bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4 mr-2" />
            Relatórios
          </Link>
        </div>
      </div>

      {activeTab === 'caixa' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gray-50">
                  <Calculator className="h-6 w-6 text-gray-600" />
                </div>
                <span className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-full">Saldo Inicial</span>
              </div>
              <p className="text-sm font-medium text-gray-500">Do dia anterior</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(initialBalance)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-green-50">
                  <ArrowUpCircle className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Entradas</span>
              </div>
              <p className="text-sm font-medium text-gray-500">Total Recebido</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIncome)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-red-50">
                  <ArrowDownCircle className="h-6 w-6 text-red-600" />
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">Saídas</span>
              </div>
              <p className="text-sm font-medium text-gray-500">Total Pago</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalExpense)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-blue-50">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Saldo Final</span>
              </div>
              <p className="text-sm font-medium text-gray-500">Inicial + Entradas - Saídas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dayBalance)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-purple-50">
                  <Lock className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Saldo em Dinheiro</span>
              </div>
              <p className="text-sm font-medium text-gray-500">Dinheiro disponível</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalBalance)}
              </p>
            </div>
          </div>

          {/* Breakdown por método de pagamento */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Saldo Detalhado por Método de Pagamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm font-medium text-gray-500 mb-2">Dinheiro</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Entradas:</span>
                    <span className="font-semibold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(incomeCash)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Saídas:</span>
                    <span className="font-semibold text-red-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expenseCash)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-medium">Saldo:</span>
                    <span className="font-bold text-gray-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(incomeCash - expenseCash)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm font-medium text-gray-500 mb-2">PIX</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Entradas:</span>
                    <span className="font-semibold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(incomePix)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Saídas:</span>
                    <span className="font-semibold text-red-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expensePix)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-medium">Saldo:</span>
                    <span className="font-bold text-gray-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(incomePix - expensePix)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm font-medium text-gray-500 mb-2">Cartão de Débito</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Entradas:</span>
                    <span className="font-semibold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(incomeDebit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Saídas:</span>
                    <span className="font-semibold text-red-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expenseDebit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-medium">Saldo:</span>
                    <span className="font-bold text-gray-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(incomeDebit - expenseDebit)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm font-medium text-gray-500 mb-2">Cartão de Crédito</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Entradas:</span>
                    <span className="font-semibold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(incomeCredit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Saídas:</span>
                    <span className="font-semibold text-red-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expenseCredit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-medium">Saldo:</span>
                    <span className="font-bold text-gray-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(incomeCredit - expenseCredit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-bold text-gray-900">Lançamentos do Dia</h3>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {/* Status de fechamento - Mostrar apenas uma mensagem baseada no caixa selecionado */}
                  {boxStatus && (() => {
                    // Para ADMIN/OWNER: mostrar status apenas do caixa selecionado no dropdown
                    // Para RECEPTIONIST: mostrar status do próprio caixa
                    if (getUserRole() === 'ADMIN' || getUserRole() === 'OWNER') {
                      // Se há um usuário selecionado no dropdown, mostrar status desse caixa específico
                      if (selectedBoxUserId) {
                        // Verificar se o caixa selecionado está fechado
                        const selectedClosure = boxStatus.userClosure;
                        if (selectedClosure) {
                          return (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${
                              selectedClosure.closureType === 'ADMIN' 
                                ? 'bg-purple-50 text-purple-700' 
                                : 'bg-orange-50 text-orange-700'
                            }`}>
                              <CheckCircle2 className="h-4 w-4" />
                              {selectedClosure.closureType === 'ADMIN' ? 'Caixa Admin Fechado' : 'Caixa Recepção Fechado'}
                            </div>
                          );
                        }
                      } else {
                        // Sem seleção: mostrar apenas se o caixa ADMIN está fechado
                        if (boxStatus.adminClosures && boxStatus.adminClosures.length > 0) {
                          return (
                            <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-sm font-semibold">
                              <CheckCircle2 className="h-4 w-4" />
                              Caixa Admin Fechado
                            </div>
                          );
                        }
                      }
                    } else if (getUserRole() === 'RECEPTIONIST') {
                      // Para recepcionista: mostrar apenas se o próprio caixa está fechado
                      if (boxStatus.userClosure && boxStatus.userClosure.closureType === 'RECEPTIONIST') {
                        return (
                          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 rounded-xl text-sm font-semibold">
                            <CheckCircle2 className="h-4 w-4" />
                            Seu Caixa Fechado
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                  {/* Botões de ação */}
                  {(!boxStatus?.userClosure || (getUserRole() === 'ADMIN' || getUserRole() === 'OWNER')) && (
                    <>
                      {getUserRole() === 'RECEPTIONIST' && (
                        !boxStatus?.userClosure || boxStatus.userClosure.closureType !== 'RECEPTIONIST' ? (
                          <button
                            onClick={async () => {
                              setLoadingPreview(true);
                              
                              // Verificar se já existe fechamento RECEPTIONIST para este usuário neste dia
                              const existingReceptionistClosure = boxStatus?.userClosure;
                              if (existingReceptionistClosure && existingReceptionistClosure.closureType === 'RECEPTIONIST') {
                                setLastSavedClosureId(existingReceptionistClosure.id);
                              } else {
                                setLastSavedClosureId(null);
                              }
                              
                              try {
                                const preview = await financeService.getClosurePreview(selectedDate, 'RECEPTIONIST');
                                setClosurePreview(preview);
                                setClosureFormData({
                                  initialBalance: String(preview.previousDayFinalBalance || '0'),
                                  finalBalance: String(preview.suggestedFinalBalance || '0'),
                                  cashCount: String((preview.balancesByMethod?.['Dinheiro']?.income || 0) - (preview.balancesByMethod?.['Dinheiro']?.expense || 0)),
                                  cardCount: String(((preview.balancesByMethod?.['Cartão de Débito']?.income || 0) - (preview.balancesByMethod?.['Cartão de Débito']?.expense || 0)) + ((preview.balancesByMethod?.['Cartão de Crédito']?.income || 0) - (preview.balancesByMethod?.['Cartão de Crédito']?.expense || 0))),
                                  pixCount: String((preview.balancesByMethod?.['PIX']?.income || 0) - (preview.balancesByMethod?.['PIX']?.expense || 0)),
                                  observations: '',
                                  paymentMethod: '',
                                });
                              } catch (error) {
                                console.error('Erro ao carregar preview:', error);
                                setClosurePreview(null);
                                setClosureFormData({
                                  initialBalance: '',
                                  finalBalance: '',
                                  cashCount: '',
                                  cardCount: '',
                                  pixCount: '',
                                  observations: '',
                                  paymentMethod: '',
                                });
                              }
                              setLoadingPreview(false);
                              setIsReceptionistClosureModalOpen(true);
                            }}
                            disabled={boxStatus?.hasReceptionistClosure || (boxStatus?.userClosure?.closureType === 'RECEPTIONIST')}
                            className={`inline-flex items-center px-4 py-2 text-white text-sm font-semibold rounded-xl transition-colors ${
                              boxStatus?.hasReceptionistClosure || (boxStatus?.userClosure?.closureType === 'RECEPTIONIST')
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-orange-600 hover:bg-orange-700'
                            }`}
                          >
                            <Lock className="h-4 w-4 mr-2" /> Fechar Meu Caixa
                          </button>
                        ) : (
                          <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-500 text-sm font-semibold rounded-xl cursor-not-allowed">
                            <Lock className="h-4 w-4 mr-2" /> Caixa Fechado
                          </div>
                        )
                      )}
                      {(getUserRole() === 'ADMIN' || getUserRole() === 'OWNER') && (() => {
                        // Verificar se o caixa ADMIN está fechado (apenas quando não há usuário selecionado)
                        // Se há usuário selecionado, não mostrar botão de fechar caixa admin
                        if (selectedBoxUserId) {
                          // Se há usuário selecionado, não mostrar botão de fechar caixa admin
                          return null;
                        }
                        
                        const isAdminBoxClosed = boxStatus?.adminClosures && boxStatus.adminClosures.length > 0;
                        
                        if (isAdminBoxClosed) {
                          return (
                            <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-500 text-sm font-semibold rounded-xl cursor-not-allowed">
                              <Lock className="h-4 w-4 mr-2" /> Caixa Fechado
                            </div>
                          );
                        }
                        
                        return (
                          <button
                            onClick={async () => {
                              setLoadingPreview(true);
                              
                              // Verificar se já existe fechamento ADMIN para este dia
                              const existingAdminClosure = boxStatus?.closures?.find(
                                (c: any) => c.closureType === 'ADMIN'
                              );
                              if (existingAdminClosure) {
                                // Se já existe, setar o ID para mostrar tela de sucesso
                                setLastSavedClosureId(existingAdminClosure.id);
                              } else {
                                setLastSavedClosureId(null);
                              }
                              
                              try {
                                const preview = await financeService.getClosurePreview(selectedDate, 'ADMIN');
                                setClosurePreview(preview);
                                setClosureFormData({
                                  initialBalance: String(preview.previousDayFinalBalance || '0'),
                                  finalBalance: String(preview.suggestedFinalBalance || '0'),
                                  cashCount: String((preview.balancesByMethod?.['Dinheiro']?.income || 0) - (preview.balancesByMethod?.['Dinheiro']?.expense || 0)),
                                  cardCount: String(((preview.balancesByMethod?.['Cartão de Débito']?.income || 0) - (preview.balancesByMethod?.['Cartão de Débito']?.expense || 0)) + ((preview.balancesByMethod?.['Cartão de Crédito']?.income || 0) - (preview.balancesByMethod?.['Cartão de Crédito']?.expense || 0))),
                                  pixCount: String((preview.balancesByMethod?.['PIX']?.income || 0) - (preview.balancesByMethod?.['PIX']?.expense || 0)),
                                  observations: '',
                                  paymentMethod: '',
                                });
                              } catch (error) {
                                console.error('Erro ao carregar preview:', error);
                                setClosurePreview(null);
                                setClosureFormData({
                                  initialBalance: '',
                                  finalBalance: '',
                                  cashCount: '',
                                  cardCount: '',
                                  pixCount: '',
                                  observations: '',
                                  paymentMethod: '',
                                });
                              }
                              setLoadingPreview(false);
                              setIsAdminClosureModalOpen(true);
                            }}
                            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors"
                          >
                            <Lock className="h-4 w-4 mr-2" /> Fechar Caixa Admin
                          </button>
                        );
                      })()}
                      {(() => {
                        // Verificar se o caixa está fechado para o usuário selecionado
                        let isBoxClosed = false;
                        
                        if (getUserRole() === 'RECEPTIONIST') {
                          // Recepcionista: verificar se o próprio caixa está fechado
                          isBoxClosed = boxStatus?.userClosure?.closureType === 'RECEPTIONIST' || boxStatus?.hasReceptionistClosure;
                        } else if (getUserRole() === 'ADMIN' || getUserRole() === 'OWNER') {
                          // Admin: verificar se o caixa selecionado está fechado
                          if (selectedBoxUserId) {
                            // Se há um usuário selecionado, verificar se esse caixa específico está fechado
                            isBoxClosed = boxStatus?.userClosure?.closureType === 'RECEPTIONIST' || boxStatus?.userClosure?.closureType === 'ADMIN';
                          } else {
                            // Sem seleção: verificar se o caixa ADMIN está fechado
                            isBoxClosed = boxStatus?.adminClosures && boxStatus.adminClosures.length > 0;
                          }
                        }
                        
                        if (isBoxClosed) {
                          return (
                            <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-500 text-sm font-semibold rounded-xl cursor-not-allowed" title="O caixa deste dia já foi fechado. Não é possível criar novos lançamentos.">
                              <Lock className="h-4 w-4 mr-2" /> Caixa Fechado
                            </div>
                          );
                        }
                        
                        return (
                          <button
                            onClick={() => {
                              resetForm();
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
                          </button>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
                <p>Carregando transações...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-20 flex flex-col items-center justify-center text-gray-400 text-center">
                <DollarSign className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium text-gray-500">Sem lançamentos para este dia</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Descrição</th>
                      <th className="px-6 py-4">Profissional</th>
                      <th className="px-6 py-4">Categoria</th>
                      <th className="px-6 py-4">Método</th>
                      <th className="px-6 py-4 text-right">Valor</th>
                      <th className="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center mr-3 ${t.type === 'INCOME' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {t.type === 'INCOME' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {t.description || 
                                 (t.appointment?.patient?.name ? `${t.category || 'Consulta'} - ${t.appointment.patient.name}` : null) ||
                                 (t.patient?.name ? `${t.category || 'Consulta'} - ${t.patient.name}` : null) ||
                                 'Sem descrição'}
                              </div>
                              <div className="text-xs text-gray-500">{formatDateBR(t.date || t.createdAt || new Date(), 'HH:mm')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {t.appointment?.staff?.name ? `Dr(a). ${t.appointment.staff.name}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{t.category}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{t.method || t.paymentMethod || 'N/A'}</td>
                        <td className={`px-6 py-4 text-sm font-bold text-right ${(t.type === 'INCOME' || t.type === 'income') ? 'text-green-600' : 'text-red-600'}`}>
                          {(t.type === 'INCOME' || t.type === 'income') ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.amount || 0))}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {!boxStatus?.userClosure && (
                            <button
                              onClick={() => openEditModal(t)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="Editar transação"
                            >
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Filtros */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={repasseStartDate}
                    onChange={(e) => setRepasseStartDate(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="self-center text-gray-500">até</span>
                  <input
                    type="date"
                    value={repasseEndDate}
                    onChange={(e) => setRepasseEndDate(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              {(user?.role === 'ADMIN' || user?.role === 'OWNER') && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Médico</label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Todos os Médicos</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Repasses Pendentes */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center">
                <Calculator className="h-5 w-5 mr-2 text-orange-600" />
                Repasses Pendentes
                {user?.role === 'DOCTOR' && <span className="ml-2 text-sm font-normal text-gray-500">(Seus repasses)</span>}
              </h3>
              {(user?.role === 'ADMIN' || user?.role === 'OWNER') && (
                <button
                  onClick={async () => {
                    try {
                      toast.loading('Corrigindo repasses...', { id: 'fix-repasses' });
                      // 1. Corrigir staffIds das transações
                      const fixResult = await financeService.fixTransactionStaffIds();
                      console.log('Resultado fix staffIds:', fixResult);
                      // 2. Corrigir repasses da Dra Lais
                      const laisResult = await financeService.fixDraLaisFees();
                      console.log('Resultado fix Dra Lais:', laisResult);
                      toast.success(`Correção concluída! ${fixResult.fixed || 0} transações corrigidas, ${laisResult.feesCreated || 0} repasses criados. Recarregando...`, { id: 'fix-repasses' });
                      // Recarregar página para buscar dados atualizados
                      setTimeout(() => window.location.reload(), 1500);
                    } catch (error) {
                      console.error('Erro ao corrigir:', error);
                      toast.error('Erro ao corrigir repasses', { id: 'fix-repasses' });
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1"
                  title="Corrige transações sem staffId e cria repasses faltantes"
                >
                  <Wrench className="h-3 w-3" />
                  Corrigir Repasses
                </button>
              )}
            </div>

              {loading ? (
                <div className="p-20 flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
                  <p>Carregando repasses...</p>
                </div>
              ) : medicalFees.length === 0 ? (
                <div className="p-20 flex flex-col items-center justify-center text-gray-400 text-center">
                  <Calculator className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium text-gray-500">Nenhum repasse pendente no período</p>
                  <p className="text-sm text-gray-400 mt-2">Período: {format(new Date(repasseStartDate), 'dd/MM/yyyy')} a {format(new Date(repasseEndDate), 'dd/MM/yyyy')}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {(() => {
                    // Agrupar por médico
                    const groupedByDoctor: Record<string, { doctor: { name: string }; fees: MedicalFee[]; total: number }> = {};
                    medicalFees.forEach(fee => {
                      const doctorId = fee.staffId || fee.doctorId || 'unknown';
                      const doctorName = fee.staff?.name || fee.doctor?.name || 'Desconhecido';
                      if (!groupedByDoctor[doctorId]) {
                        groupedByDoctor[doctorId] = {
                          doctor: { name: doctorName },
                          fees: [],
                          total: 0,
                        };
                      }
                      groupedByDoctor[doctorId].fees.push(fee);
                      // Usar feeAmount (valor do repasse), não amount (que pode ser valor bruto da transação)
                      // Converter corretamente de Decimal (vem como string do JSON)
                      const feeValue = fee.feeAmount ? parseFloat(String(fee.feeAmount)) : 0;
                      if (!isNaN(feeValue)) {
                        groupedByDoctor[doctorId].total += feeValue;
                      }
                    });

                    return Object.entries(groupedByDoctor).map(([docId, group]) => {
                      // Buscar o médico na lista de doctors ou usar o nome do group
                      const doctor = doctors.find(d => d.id === docId);
                      const doctorIdToUse = doctor?.id || docId;
                      // Usar o nome do médico encontrado ou do grupo
                      const doctorName = doctor?.name || group.doctor.name || 'Desconhecido';
                      // Criar objeto doctor mínimo se não for encontrado, usando dados dos fees
                      const doctorObject: Staff | null = doctor || (group.fees.length > 0 ? {
                        id: docId,
                        name: group.doctor.name || group.fees[0]?.staff?.name || group.fees[0]?.doctor?.name || 'Desconhecido',
                        specialty: group.fees[0]?.staff?.specialty || null,
                        crm: group.fees[0]?.staff?.crm || null,
                        tenantId: '',
                        role: 'DOCTOR',
                        email: '',
                        phone: null,
                        active: true,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      } as Staff : null);
                      
                      return (
                        <div key={docId} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                          <div className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900 text-lg">Dr(a). {doctorName}</h4>
                                <div className="mt-2 space-y-1">
                                  <p className="text-sm text-gray-600">
                                    <span className="font-semibold">{group.fees.length}</span> atendimento(s) no período
                                  </p>
                                  <p className="text-base font-bold text-green-600">
                                    Total Pendente: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(group.total)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                {/* Botão de Visualizar Detalhes */}
                                <button
                                  onClick={() => {
                                    console.log('Abrindo modal de visualização:', {
                                      doctor: doctorObject,
                                      doctorName: doctorName,
                                      feesCount: group.fees.length,
                                      total: group.total,
                                      userRole: user?.role,
                                    });
                                    // Resetar closedPaymentId ao abrir um novo modal
                                    setClosedPaymentId(null);
                                    setRepasseFormData({ paymentMethod: '', observations: '' });
                                    setSelectedRepasseForView({
                                      doctor: doctorObject,
                                      fees: group.fees,
                                      total: group.total,
                                    });
                                    setIsViewRepasseModalOpen(true);
                                  }}
                                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                                  title="Visualizar detalhes dos atendimentos"
                                >
                                  <BarChart3 className="h-4 w-4 mr-2" /> Visualizar
                                </button>
                                
                                {/* Botão de Imprimir */}
                                <button
                                  onClick={async () => {
                                    try {
                                      if (!doctorIdToUse) {
                                        toast.error('Médico não identificado');
                                        return;
                                      }
                                      const { reportsService } = await import('@/services/reports-service');
                                      await reportsService.downloadPendingMedicalFeeReport(
                                        doctorIdToUse,
                                        repasseStartDate,
                                        repasseEndDate
                                      );
                                      toast.success('Relatório de repasses pendentes gerado com sucesso!');
                                    } catch (error: any) {
                                      console.error('Erro ao gerar relatório:', error);
                                      const message = error.response?.data?.message || 'Erro ao gerar relatório de repasses pendentes';
                                      toast.error(message);
                                    }
                                  }}
                                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                                  title="Imprimir relatório dos repasses pendentes"
                                >
                                  <FileText className="h-4 w-4 mr-2" /> Imprimir
                                </button>
                                
                                {/* Botão de Fechar Repasse - apenas para ADMIN/OWNER/RECEPTIONIST */}
                                {(getUserRole() === 'ADMIN' || getUserRole() === 'OWNER' || getUserRole() === 'RECEPTIONIST') && (
                                  <button
                                    onClick={() => {
                                      if (!doctor) {
                                        toast.error('Médico não encontrado');
                                        return;
                                      }
                                      setSelectedStaffForRepasse(doctor);
                                      setIsRepasseModalOpen(true);
                                    }}
                                    className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700 transition-colors shadow-sm"
                                    title="Fechar repasse deste médico"
                                  >
                                    <Lock className="h-4 w-4 mr-2" /> Fechar Repasse
                                  </button>
                                )}
                                
                                {/* Mensagem para DOCTOR */}
                                {getUserRole() === 'DOCTOR' && (
                                  <div className="text-xs text-gray-500 italic">
                                    Aguardando fechamento
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

          {/* Link para Relatórios - Histórico de Repasses */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-bold text-gray-900">Histórico de Repasses Fechados</h3>
                  <p className="text-sm text-gray-600">Acesse os relatórios para visualizar e imprimir repasses fechados</p>
                </div>
              </div>
              <Link
                href="/dashboard/financeiro/relatorios"
                className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                <BarChart3 className="h-5 w-5 mr-2" />
                Ver Relatórios
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Transação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Nova Transação</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTransaction} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, type: 'INCOME', category: '' });
                      setFormErrors({ ...formErrors, category: '' });
                    }}
                    className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-all ${
                      formData.type === 'INCOME' 
                        ? 'bg-green-600 text-white shadow-lg' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, type: 'EXPENSE', category: '' });
                      setFormErrors({ ...formErrors, category: '' });
                    }}
                    className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-all ${
                      formData.type === 'EXPENSE' 
                        ? 'bg-red-600 text-white shadow-lg' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Saída
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria <span className="text-red-500">*</span>
                </label>
                {formData.type === 'EXPENSE' ? (
                  <select
                    value={formData.categoryId}
                    onChange={(e) => {
                      const selectedCategory = expenseCategories.find(c => c.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        categoryId: e.target.value,
                        category: selectedCategory?.name || '',
                      });
                      if (formErrors.category) setFormErrors({ ...formErrors, category: '' });
                    }}
                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                      formErrors.category ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Selecione uma categoria</option>
                    {buildCategoryOptions(expenseCategories)}
                  </select>
                ) : (
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      setFormData({ ...formData, category: e.target.value });
                      if (formErrors.category) setFormErrors({ ...formErrors, category: '' });
                    }}
                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                      formErrors.category ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Selecione uma categoria</option>
                    {TRANSACTION_CATEGORIES[formData.type].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
                {formErrors.category && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.category}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor (R$) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData({ ...formData, amount: e.target.value });
                    if (formErrors.amount) setFormErrors({ ...formErrors, amount: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                    formErrors.amount ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0,00"
                />
                {formErrors.amount && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pagamento <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.method}
                  onChange={(e) => {
                    setFormData({ ...formData, method: e.target.value });
                    if (formErrors.method) setFormErrors({ ...formErrors, method: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                    formErrors.method ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  {PAYMENT_METHODS.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
                {formErrors.method && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.method}</p>
                )}
              </div>

              {formData.type === 'INCOME' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paciente (Opcional)</label>
                    <select
                      value={formData.patientId}
                      onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Selecione um paciente</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.cpf})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Médico (Opcional - para repasse)</label>
                    <select
                      value={formData.staffId}
                      onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Selecione um médico</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) setFormErrors({ ...formErrors, description: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none ${
                    formErrors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Descreva o lançamento..."
                />
                {formErrors.description && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                >
                  Registrar Transação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fechar Caixa Recepcionista - Refatorado com resumo completo */}
      {isReceptionistClosureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                Fechamento de Caixa - {formatDateBR(selectedDate, "dd/MM/yyyy")}
              </h2>
              <button onClick={() => {
                setIsReceptionistClosureModalOpen(false);
                setLastSavedClosureId(null);
              }} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2">Carregando dados...</span>
                </div>
              ) : (
                <>
                  {/* Saldo Inicial */}
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Saldo Inicial (dia anterior):</span>
                      <span className="text-lg font-bold text-blue-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(closurePreview?.previousDayFinalBalance || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Transações do Dia */}
                  {closurePreview?.transactions && closurePreview.transactions.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-blue-600" />
                        Lançamentos do Dia ({closurePreview.transactions.length})
                      </h3>
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">Hora</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">Descrição</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">Método</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {closurePreview.transactions.map((t) => (
                              <tr key={t.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-500">
                                  {format(new Date(t.createdAt), 'HH:mm')}
                                </td>
                                <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]" title={t.description}>
                                  {t.description}
                                </td>
                                <td className="px-3 py-2 text-gray-600">{t.method}</td>
                                <td className={`px-3 py-2 text-right font-medium ${t.type.toUpperCase() === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                  {t.type.toUpperCase() === 'INCOME' ? '+' : '-'}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Resumo por Tipo */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <p className="text-sm text-gray-600">Total Entradas</p>
                      <p className="text-xl font-bold text-green-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(closurePreview?.totalIncome || totalIncome)}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="text-sm text-gray-600">Total Saídas</p>
                      <p className="text-xl font-bold text-red-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(closurePreview?.totalExpense || totalExpense)}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-sm text-gray-600">Saldo em Dinheiro</p>
                      <p className="text-xl font-bold text-blue-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          (closurePreview?.previousDayFinalBalance || 0) + 
                          (closurePreview?.balancesByMethod?.['Dinheiro']?.income || 0) - 
                          (closurePreview?.balancesByMethod?.['Dinheiro']?.expense || 0)
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Entradas e Saídas por Método de Pagamento */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Entradas por Método de Pagamento</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito'].map((method) => {
                        const values = closurePreview?.balancesByMethod?.[method] || { income: 0, expense: 0 };
                        return (
                          <div key={method} className="bg-green-50 p-3 rounded-xl border border-green-200">
                            <p className="text-xs text-gray-600 mb-1">{method}</p>
                            <p className="text-lg font-bold text-green-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(values.income || 0)}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <h3 className="font-semibold text-gray-900">Saídas por Método de Pagamento</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito'].map((method) => {
                        const values = closurePreview?.balancesByMethod?.[method] || { income: 0, expense: 0 };
                        return (
                          <div key={method} className="bg-red-50 p-3 rounded-xl border border-red-200">
                            <p className="text-xs text-gray-600 mb-1">{method}</p>
                            <p className="text-lg font-bold text-red-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(values.expense || 0)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Saldo Final Calculado */}
                  <div className="bg-gradient-to-r from-blue-100 to-blue-50 p-4 rounded-xl border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Saldo Final Calculado:</span>
                      <span className="text-2xl font-bold text-blue-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          (closurePreview?.previousDayFinalBalance || 0) + 
                          (closurePreview?.totalIncome || 0) - 
                          (closurePreview?.totalExpense || 0)
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="space-y-4 border-t border-gray-200 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                      <textarea
                        value={closureFormData.observations}
                        onChange={(e) => setClosureFormData({ ...closureFormData, observations: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                        placeholder="Observações sobre o fechamento..."
                      />
                    </div>
                  </div>

                  {/* Mensagem de Sucesso ou Aviso */}
                  {lastSavedClosureId ? (
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                      <div className="flex items-center">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                        <p className="text-sm text-green-800 font-semibold">
                          Caixa fechado com sucesso!
                        </p>
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        Você pode imprimir ou salvar o relatório abaixo.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        <strong>Atenção:</strong> Após fechar seu caixa, não será possível realizar novas transações para este dia.
                      </p>
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsReceptionistClosureModalOpen(false);
                        setLastSavedClosureId(null);
                      }}
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {lastSavedClosureId ? 'Fechar' : 'Cancelar'}
                    </button>
                    
                    {lastSavedClosureId && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { reportsService } = await import('@/services/reports-service');
                              const blob = await reportsService.getDailyClosureReportBlob(lastSavedClosureId);
                              reportsService.printReport(blob);
                              toast.success('Abrindo impressão...');
                            } catch (error) {
                              console.error('Erro ao imprimir:', error);
                              toast.error('Erro ao gerar relatório para impressão');
                            }
                          }}
                          className="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          <Printer className="h-4 w-4 inline mr-2" />
                          Imprimir
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { reportsService } = await import('@/services/reports-service');
                              await reportsService.downloadDailyClosureReport(lastSavedClosureId);
                              toast.success('Relatório salvo!');
                            } catch (error) {
                              console.error('Erro ao salvar:', error);
                              toast.error('Erro ao salvar relatório');
                            }
                          }}
                          className="px-4 py-2.5 bg-gray-600 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors"
                        >
                          <Download className="h-4 w-4 inline mr-2" />
                          Salvar PDF
                        </button>
                      </>
                    )}
                    
                    {!lastSavedClosureId && (
                      <button
                        onClick={handleCloseReceptionistBox}
                        disabled={isClosingReceptionistBox}
                        className={`flex-1 px-4 py-2.5 text-white font-semibold rounded-xl transition-colors shadow-lg ${
                          isClosingReceptionistBox 
                            ? 'bg-orange-400 cursor-not-allowed' 
                            : 'bg-orange-600 hover:bg-orange-700'
                        }`}
                      >
                        {isClosingReceptionistBox ? (
                          <>
                            <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
                            Fechando...
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4 inline mr-2" />
                            Confirmar Fechamento
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Fechar Caixa Administrativo - Igual ao da Recepção */}
      {isAdminClosureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">
            <div className="p-6 border-b border-purple-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                Fechamento de Caixa Administrativo - {formatDateBR(selectedDate, "dd/MM/yyyy")}
              </h2>
              <button onClick={() => {
                setIsAdminClosureModalOpen(false);
                setLastSavedClosureId(null);
              }} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                  <span className="ml-2">Carregando dados...</span>
                </div>
              ) : (
                <>
                  {/* Saldo Inicial */}
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Saldo Inicial (dia anterior):</span>
                      <span className="text-lg font-bold text-purple-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(closurePreview?.previousDayFinalBalance || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Transações do Dia */}
                  {closurePreview?.transactions && closurePreview.transactions.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-purple-600" />
                        Lançamentos do Dia ({closurePreview.transactions.length})
                      </h3>
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">Hora</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">Descrição</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">Método</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {closurePreview.transactions.map((t) => (
                              <tr key={t.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-500">
                                  {format(new Date(t.createdAt), 'HH:mm')}
                                </td>
                                <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]" title={t.description}>
                                  {t.description}
                                </td>
                                <td className="px-3 py-2 text-gray-600">{t.method}</td>
                                <td className={`px-3 py-2 text-right font-medium ${t.type.toUpperCase() === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                  {t.type.toUpperCase() === 'INCOME' ? '+' : '-'}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Resumo por Tipo */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <p className="text-sm text-gray-600">Total Entradas</p>
                      <p className="text-xl font-bold text-green-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(closurePreview?.totalIncome || 0)}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="text-sm text-gray-600">Total Saídas</p>
                      <p className="text-xl font-bold text-red-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(closurePreview?.totalExpense || 0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                      <p className="text-sm text-gray-600">Saldo em Dinheiro</p>
                      <p className="text-xl font-bold text-purple-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          (closurePreview?.previousDayFinalBalance || 0) + 
                          (closurePreview?.balancesByMethod?.['Dinheiro']?.income || 0) - 
                          (closurePreview?.balancesByMethod?.['Dinheiro']?.expense || 0)
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Entradas e Saídas por Método de Pagamento */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Entradas por Método de Pagamento</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito'].map((method) => {
                        const values = closurePreview?.balancesByMethod?.[method] || { income: 0, expense: 0 };
                        return (
                          <div key={method} className="bg-green-50 p-3 rounded-xl border border-green-200">
                            <p className="text-xs text-gray-600 mb-1">{method}</p>
                            <p className="text-lg font-bold text-green-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(values.income || 0)}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <h3 className="font-semibold text-gray-900">Saídas por Método de Pagamento</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito'].map((method) => {
                        const values = closurePreview?.balancesByMethod?.[method] || { income: 0, expense: 0 };
                        return (
                          <div key={method} className="bg-red-50 p-3 rounded-xl border border-red-200">
                            <p className="text-xs text-gray-600 mb-1">{method}</p>
                            <p className="text-lg font-bold text-red-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(values.expense || 0)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Saldo Final Calculado */}
                  <div className="bg-gradient-to-r from-purple-100 to-purple-50 p-4 rounded-xl border border-purple-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Saldo Final Calculado:</span>
                      <span className="text-2xl font-bold text-purple-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          (closurePreview?.previousDayFinalBalance || 0) + 
                          (closurePreview?.totalIncome || 0) - 
                          (closurePreview?.totalExpense || 0)
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="space-y-4 border-t border-gray-200 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                      <textarea
                        value={closureFormData.observations}
                        onChange={(e) => setClosureFormData({ ...closureFormData, observations: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none h-20 resize-none"
                        placeholder="Observações sobre o fechamento..."
                      />
                    </div>
                  </div>

                  {/* Mensagem de Sucesso ou Aviso */}
                  {lastSavedClosureId ? (
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                      <div className="flex items-center">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                        <p className="text-sm text-green-800 font-semibold">
                          Caixa administrativo fechado com sucesso!
                        </p>
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        Você pode imprimir ou salvar o relatório abaixo.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        <strong>Atenção:</strong> Após fechar o caixa administrativo, não será possível realizar novas transações para este dia.
                      </p>
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminClosureModalOpen(false);
                        setLastSavedClosureId(null);
                      }}
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {lastSavedClosureId ? 'Fechar' : 'Cancelar'}
                    </button>
                    
                    {lastSavedClosureId && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { reportsService } = await import('@/services/reports-service');
                              const blob = await reportsService.getDailyClosureReportBlob(lastSavedClosureId);
                              reportsService.printReport(blob);
                              toast.success('Abrindo impressão...');
                            } catch (error) {
                              console.error('Erro ao imprimir:', error);
                              toast.error('Erro ao gerar relatório para impressão');
                            }
                          }}
                          className="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          <Printer className="h-4 w-4 inline mr-2" />
                          Imprimir
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { reportsService } = await import('@/services/reports-service');
                              await reportsService.downloadDailyClosureReport(lastSavedClosureId);
                              toast.success('Relatório salvo!');
                            } catch (error) {
                              console.error('Erro ao salvar:', error);
                              toast.error('Erro ao salvar relatório');
                            }
                          }}
                          className="px-4 py-2.5 bg-gray-600 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors"
                        >
                          <Download className="h-4 w-4 inline mr-2" />
                          Salvar PDF
                        </button>
                      </>
                    )}
                    
                    {!lastSavedClosureId && (
                      <button
                        onClick={handleCloseAdminBox}
                        disabled={isClosingAdminBox}
                        className={`flex-1 px-4 py-2.5 text-white font-semibold rounded-xl transition-colors shadow-lg ${
                          isClosingAdminBox 
                            ? 'bg-purple-400 cursor-not-allowed' 
                            : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                      >
                        {isClosingAdminBox ? (
                          <>
                            <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
                            Fechando...
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4 inline mr-2" />
                            Confirmar Fechamento
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Transação */}
      {isEditModalOpen && editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Editar Lançamento</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, description: e.target.value });
                    if (editFormErrors.description) setEditFormErrors({ ...editFormErrors, description: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none ${
                    editFormErrors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Descreva o lançamento..."
                />
                {editFormErrors.description && (
                  <p className="mt-1 text-sm text-red-600">{editFormErrors.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor (R$) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editFormData.amount}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, amount: e.target.value });
                    if (editFormErrors.amount) setEditFormErrors({ ...editFormErrors, amount: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                    editFormErrors.amount ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0,00"
                />
                {editFormErrors.amount && (
                  <p className="mt-1 text-sm text-red-600">{editFormErrors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento</label>
                <select
                  value={editFormData.method}
                  onChange={(e) => setEditFormData({ ...editFormData, method: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fechar Repasse Médico */}
      {isRepasseModalOpen && selectedStaffForRepasse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">Fechar Repasse Médico</h2>
              <button onClick={() => setIsRepasseModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-sm font-semibold text-blue-900 mb-2">Profissional</p>
                <p className="text-lg font-bold text-gray-900">Dr(a). {selectedStaffForRepasse.name}</p>
                {selectedStaffForRepasse.specialty && (
                  <p className="text-sm text-gray-600">{selectedStaffForRepasse.specialty}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Inicial <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={repasseStartDate}
                      onChange={(e) => setRepasseStartDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Final <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={repasseEndDate}
                      onChange={(e) => setRepasseEndDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento</label>
                  <select
                    value={repasseFormData.paymentMethod}
                    onChange={(e) => setRepasseFormData({ ...repasseFormData, paymentMethod: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Selecione...</option>
                    {PAYMENT_METHODS.map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={repasseFormData.observations}
                    onChange={(e) => setRepasseFormData({ ...repasseFormData, observations: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                    placeholder="Observações sobre o pagamento..."
                  />
                </div>
              </div>

              {/* Resumo dos repasses pendentes */}
              {(() => {
                const pendingFees = medicalFees.filter(f => 
                  (f.staffId || f.doctorId) === selectedStaffForRepasse.id && 
                  f.status === 'pending'
                );
                const totalAmount = pendingFees.reduce((acc, f) => {
                  const feeValue = f.feeAmount ? parseFloat(String(f.feeAmount)) : 0;
                  return acc + (isNaN(feeValue) ? 0 : feeValue);
                }, 0);
                
                return pendingFees.length > 0 ? (
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <p className="text-sm font-semibold text-green-900 mb-2">Resumo do Repasse</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Atendimentos Pendentes:</span>
                        <span className="font-bold text-gray-900">{pendingFees.length}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-green-200">
                        <span className="font-bold text-gray-900">Valor Total a Pagar:</span>
                        <span className="font-bold text-green-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>Atenção:</strong> Este processo irá agrupar todos os repasses pendentes do período selecionado e marcá-los como pagos.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsRepasseModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!selectedStaffForRepasse.id) {
                      toast.error('Médico não selecionado');
                      return;
                    }
                    if (!repasseStartDate || !repasseEndDate) {
                      toast.error('Período deve ser informado');
                      return;
                    }
                    if (!confirm('Tem certeza que deseja fechar o repasse deste período?')) {
                      return;
                    }
                    try {
                      await financeService.closeMedicalFeePayment({
                        staffId: selectedStaffForRepasse.id,
                        periodStart: repasseStartDate,
                        periodEnd: repasseEndDate,
                        paymentMethod: repasseFormData.paymentMethod || undefined,
                        observations: repasseFormData.observations || undefined,
                      });
                      toast.success('Repasse fechado com sucesso!');
                      setIsRepasseModalOpen(false);
                      setRepasseFormData({
                        paymentMethod: '',
                        observations: '',
                      });
                      fetchFinanceData();
                    } catch (error: any) {
                      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao fechar repasse';
                      toast.error(message);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 transition-colors shadow-lg"
                >
                  <Lock className="h-4 w-4 inline mr-2" />
                  Confirmar Fechamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualizar Repasses Pendentes */}
      {isViewRepasseModalOpen && selectedRepasseForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:static print:inset-auto print:bg-transparent">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col print:max-h-none print:shadow-none print:rounded-none">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10 print:static print:p-4 print:border-b print:border-gray-300">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 print:text-xl">Detalhes dos Repasses Pendentes</h2>
                <p className="text-sm text-gray-500 mt-1 print:text-xs print:mt-0">
                  Período: {format(new Date(repasseStartDate), "dd/MM/yyyy", { locale: ptBR })} a {format(new Date(repasseEndDate), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsViewRepasseModalOpen(false);
                  setSelectedRepasseForView(null);
                }} 
                className="text-gray-400 hover:text-gray-600 transition-colors print:hidden"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 print:p-4 print:overflow-visible">
              {/* Informações do Médico */}
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mb-6 print:bg-gray-100 print:p-3 print:mb-3 print:rounded-md print:border-gray-300">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Dr(a). {selectedRepasseForView.doctor?.name || 
                              (selectedRepasseForView.fees.length > 0 ? 
                                (selectedRepasseForView.fees[0]?.staff?.name || selectedRepasseForView.fees[0]?.doctor?.name) : 
                                null) || 
                              'Desconhecido'}
                    </h3>
                    {selectedRepasseForView.doctor?.specialty && (
                      <p className="text-sm text-gray-600 mb-1">Especialidade: {selectedRepasseForView.doctor.specialty}</p>
                    )}
                    {selectedRepasseForView.doctor?.crm && (
                      <p className="text-sm text-gray-600">CRM: {selectedRepasseForView.doctor.crm}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Total Pendente</p>
                    <p className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedRepasseForView.total)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedRepasseForView.fees.length} atendimento(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de Atendimentos */}
              <div className="mb-6 print:mb-3">
                <h4 className="text-lg font-bold text-gray-900 mb-3 print:text-sm print:mb-2">Detalhamento dos Atendimentos</h4>
                <div className="space-y-2 print:space-y-0.5 print:gap-0">
                  {selectedRepasseForView.fees.map((fee, idx) => {
                    const patientName = fee.transaction?.appointment?.patient?.name || fee.appointment?.patient?.name || 'Não informado';
                    const patientCpf = fee.transaction?.appointment?.patient?.cpf || fee.appointment?.patient?.cpf;
                    const procedureName = fee.transaction?.appointment?.procedure?.name || 'Não informado';
                    const grossAmount = fee.grossAmount ? parseFloat(String(fee.grossAmount)) : 0;
                    const feeValue = fee.feeAmount ? parseFloat(String(fee.feeAmount)) : 0;
                    const commissionRate = fee.commissionRate ? parseFloat(String(fee.commissionRate)) : 0;
                    // Usar o horário da consulta (startTime) se disponível, senão usar createdAt
                    const date = fee.transaction?.appointment?.startTime || fee.transaction?.createdAt || fee.createdAt || new Date();
                    
                    return (
                      <div 
                        key={fee.id} 
                        className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow print:p-2 print:border print:border-gray-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-7 h-7 bg-blue-100 rounded-md flex items-center justify-center print:w-6 print:h-6">
                              <span className="text-blue-600 font-bold text-xs">{idx + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                                  {formatDateBR(date)}
                                </p>
                                <span className="text-gray-300 text-xs">•</span>
                                <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                                  {formatDateBR(date, 'HH:mm')}
                                </p>
                              </div>
                              <h5 className="text-sm font-bold text-gray-900 mb-1 print:text-xs">{procedureName}</h5>
                              <p className="text-xs text-gray-700 print:text-[10px]">
                                <span className="font-medium">Paciente:</span> {patientName}
                              </p>
                              {patientCpf && (
                                <p className="text-[10px] text-gray-500 print:text-[9px]">CPF: {patientCpf}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-2 flex-shrink-0">
                            <div className="mb-1">
                              <p className="text-[10px] text-gray-500 print:text-[9px]">Valor Bruto</p>
                              <p className="text-xs font-semibold text-gray-700 print:text-[10px]">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grossAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500 print:text-[9px]">Comissão ({commissionRate}%)</p>
                              <p className="text-sm font-bold text-green-600 print:text-xs">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(feeValue)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Campos para Fechamento do Repasse - apenas para ADMIN/OWNER/RECEPTIONIST */}
              {(() => {
                const userRoleUpper = getUserRole();
                const canCloseRepasse = !closedPaymentId && (
                  userRoleUpper === 'ADMIN' || 
                  userRoleUpper === 'OWNER' || 
                  userRoleUpper === 'RECEPTIONIST'
                );
                console.log('Renderizando campos de fechamento:', {
                  closedPaymentId,
                  userRole: user?.role,
                  userRoleUpper,
                  canCloseRepasse,
                  userObject: user,
                });
                return canCloseRepasse ? (
                <div className="mt-6 pt-6 border-t border-gray-200 print:hidden">
                  <h4 className="text-base font-bold text-gray-900 mb-4">Informações para Fechamento</h4>
                  <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Atenção:</strong> Preencha o método de pagamento antes de finalizar o repasse.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Método de Pagamento <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={repasseFormData.paymentMethod}
                        onChange={(e) => setRepasseFormData({ ...repasseFormData, paymentMethod: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                        required
                      >
                        <option value="">Selecione o método de pagamento</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="PIX">PIX</option>
                        <option value="Transferência Bancária">Transferência Bancária</option>
                        <option value="Depósito">Depósito</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Outro">Outro</option>
                      </select>
                      {!repasseFormData.paymentMethod && (
                        <p className="text-xs text-red-500 mt-1">O método de pagamento é obrigatório para finalizar o repasse.</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Observações (opcional)
                      </label>
                      <textarea
                        value={repasseFormData.observations}
                        onChange={(e) => setRepasseFormData({ ...repasseFormData, observations: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-20 resize-none"
                        placeholder="Observações sobre o pagamento..."
                      />
                    </div>
                  </div>
                </div>
                ) : null;
              })()}
            </div>

            {/* Rodapé com Ações */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4 sticky bottom-0 print:hidden">
              {closedPaymentId ? (
                // Após fechar o repasse, mostrar botão para imprimir recibo fechado (apenas para não-profissionais)
                <>
                  <div className="flex-1">
                    <p className="text-sm text-green-600 font-semibold">✓ Repasse fechado com sucesso!</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {getUserRole() === 'DOCTOR' 
                        ? 'Repasse registrado. Solicite o recibo à recepção.'
                        : 'Agora você pode imprimir o recibo do repasse fechado.'}
                    </p>
                  </div>
                  {getUserRole() !== 'DOCTOR' && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            // Baixar e abrir PDF para impressão
                            const { reportsService } = await import('@/services/reports-service');
                            const blob = await reportsService.getMedicalFeeReportBlob(closedPaymentId);
                            const url = URL.createObjectURL(blob);
                            const printWindow = window.open(url, '_blank');
                            if (printWindow) {
                              printWindow.onload = () => {
                                printWindow.print();
                              };
                            }
                          } catch (error: any) {
                            console.error('Erro ao imprimir recibo:', error);
                            toast.error('Erro ao imprimir recibo');
                          }
                        }}
                        className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                        title="Imprimir diretamente"
                      >
                        <Printer className="h-4 w-4 mr-2" /> Imprimir
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await financeService.downloadMedicalFeeReport(closedPaymentId);
                            toast.success('Recibo do repasse salvo com sucesso!');
                          } catch (error: any) {
                            console.error('Erro ao salvar recibo:', error);
                            const message = error.response?.data?.message || 'Erro ao salvar recibo';
                            toast.error(message);
                          }
                        }}
                        className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                        title="Salvar PDF"
                      >
                        <Download className="h-4 w-4 mr-2" /> Salvar PDF
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setIsViewRepasseModalOpen(false);
                      setSelectedRepasseForView(null);
                      setClosedPaymentId(null);
                      setRepasseFormData({ paymentMethod: '', observations: '' });
                      fetchFinanceData();
                    }}
                    className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Fechar
                  </button>
                </>
              ) : (
                <>
                  {/* Botões de Imprimir e Salvar Relatório - Apenas para ADMIN/OWNER/RECEPTIONIST */}
                  {getUserRole() !== 'DOCTOR' && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            const doctorIdToUse = selectedRepasseForView.doctor?.id;
                            if (!doctorIdToUse) {
                              toast.error('Médico não identificado');
                              return;
                            }
                            // Baixar e abrir PDF para impressão
                            const { reportsService } = await import('@/services/reports-service');
                            const blob = await reportsService.getPendingMedicalFeeReportBlob(
                              doctorIdToUse,
                              repasseStartDate,
                              repasseEndDate
                            );
                            const url = URL.createObjectURL(blob);
                            const printWindow = window.open(url, '_blank');
                            if (printWindow) {
                              printWindow.onload = () => {
                                printWindow.print();
                              };
                            }
                          } catch (error: any) {
                            console.error('Erro ao imprimir relatório:', error);
                            toast.error('Erro ao imprimir relatório');
                          }
                        }}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                        title="Imprimir diretamente"
                      >
                        <Printer className="h-4 w-4 mr-2" /> Imprimir
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const doctorIdToUse = selectedRepasseForView.doctor?.id;
                            if (!doctorIdToUse) {
                              toast.error('Médico não identificado');
                              return;
                            }
                            const { reportsService } = await import('@/services/reports-service');
                            await reportsService.downloadPendingMedicalFeeReport(
                              doctorIdToUse,
                              repasseStartDate,
                              repasseEndDate
                            );
                            toast.success('Relatório salvo com sucesso!');
                          } catch (error: any) {
                            console.error('Erro ao salvar relatório:', error);
                            const message = error.response?.data?.message || 'Erro ao salvar relatório';
                            toast.error(message);
                          }
                        }}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                        title="Salvar PDF"
                      >
                        <Download className="h-4 w-4 mr-2" /> Salvar PDF
                      </button>
                    </>
                  )}

                  <div className="flex items-center gap-3">
                    {(() => {
                    const userRoleUpper = getUserRole();
                    const canClose = userRoleUpper === 'ADMIN' || userRoleUpper === 'OWNER' || userRoleUpper === 'RECEPTIONIST';
                    console.log('Botão Finalizar Repasse:', { userRole: user?.role, userRoleUpper, canClose });
                    return canClose;
                  })() && (
                    <button
                      onClick={async () => {
                        if (!selectedRepasseForView.doctor?.id) {
                          toast.error('Médico não encontrado');
                          return;
                        }
                        if (!repasseStartDate || !repasseEndDate) {
                          toast.error('Período deve ser informado');
                          return;
                        }
                        if (!repasseFormData.paymentMethod) {
                          toast.error('Por favor, selecione o método de pagamento antes de finalizar.');
                          return;
                        }
                        if (!confirm('Tem certeza que deseja finalizar este repasse? Esta ação não pode ser desfeita.')) {
                          return;
                        }
                        
                        setIsClosingRepasse(true);
                        try {
                          const result = await financeService.closeMedicalFeePayment({
                            staffId: selectedRepasseForView.doctor.id,
                            periodStart: repasseStartDate,
                            periodEnd: repasseEndDate,
                            paymentMethod: repasseFormData.paymentMethod,
                            observations: repasseFormData.observations || undefined,
                          });
                          
                          // O resultado deve conter o paymentId do repasse fechado
                          const paymentId = result?.id || result?.paymentId || null;
                          if (paymentId) {
                            setClosedPaymentId(paymentId);
                            toast.success('Repasse finalizado com sucesso! Agora você pode imprimir o recibo.');
                            // Atualizar dados após fechamento
                            await fetchFinanceData();
                          } else {
                            toast.error('Repasse fechado, mas não foi possível obter o ID do recibo.');
                          }
                        } catch (error: any) {
                          console.error('Erro ao fechar repasse:', error);
                          const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao finalizar repasse';
                          toast.error(message);
                        } finally {
                          setIsClosingRepasse(false);
                        }
                      }}
                      disabled={isClosingRepasse || !repasseFormData.paymentMethod}
                      className="inline-flex items-center px-5 py-2.5 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Finalizar repasse deste médico"
                    >
                      {isClosingRepasse ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finalizando...
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 mr-2" /> Finalizar Repasse
                        </>
                      )}
                    </button>
                    )}
                    <button
                      onClick={() => {
                        setIsViewRepasseModalOpen(false);
                        setSelectedRepasseForView(null);
                        setClosedPaymentId(null);
                        setRepasseFormData({ paymentMethod: '', observations: '' });
                      }}
                      className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

