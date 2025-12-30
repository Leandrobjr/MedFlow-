'use client';

import React, { useState, useEffect } from 'react';
import { financeService, Transaction, MedicalFee } from '@/services/finance-service';
import { staffService, Staff } from '@/services/data-service';
import { patientService, Patient } from '@/services/data-service';
import { useAuth } from '@/hooks/use-auth';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Calculator, Calendar, Loader2, Plus, Filter, XCircle, Lock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

const TRANSACTION_CATEGORIES = {
  INCOME: ['Consulta', 'Exame', 'Procedimento', 'Outros'],
  EXPENSE: ['Material', 'Medicamento', 'Despesa Operacional', 'Outros'],
};

const PAYMENT_METHODS = ['Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'PIX', 'Transferência'];

export default function FinanceiroPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'caixa' | 'repasses'>('caixa');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [medicalFees, setMedicalFees] = useState<MedicalFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [closureStatus, setClosureStatus] = useState<any>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    type: 'INCOME' as 'INCOME' | 'EXPENSE',
    category: '',
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
        const [data, status] = await Promise.all([
          financeService.getTransactions(selectedDate),
          financeService.getClosureStatus(selectedDate),
        ]);
        setTransactions(data);
        setClosureStatus(status);
      } else {
        const data = await financeService.getMedicalFees();
        setMedicalFees(data);
      }
    } catch (error) {
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [patientsData, doctorsData] = await Promise.all([
        patientService.getAll(),
        staffService.getAll('DOCTOR'),
      ]);
      setPatients(patientsData);
      setDoctors(doctorsData);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais', error);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [activeTab, selectedDate]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const totalIncome = transactions
    .filter(t => t.type === 'INCOME' || t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'EXPENSE' || t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.category) {
      errors.category = 'Categoria é obrigatória';
    }
    
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = 'Valor deve ser maior que zero';
    }
    
    if (!formData.method) {
      errors.method = 'Método de pagamento é obrigatório';
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
    
    try {
      await financeService.createTransaction({
        type: formData.type,
        category: formData.category,
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
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao registrar transação';
      if (message.includes('fechado')) {
        toast.error('O caixa deste dia já foi fechado. Não é possível realizar novas transações.');
      } else {
        toast.error(message);
      }
    }
  };

  const handleCloseBox = async () => {
    if (!user?.id) {
      toast.error('Usuário não identificado');
      return;
    }
    
    if (!confirm('Tem certeza que deseja fechar o caixa deste dia? Após fechado, não será possível realizar novas transações.')) {
      return;
    }
    
    try {
      await financeService.closeDailyBox({
        date: selectedDate,
        closedById: user.id,
        observations: '',
      });
      toast.success('Caixa fechado com sucesso!');
      setIsClosureModalOpen(false);
      fetchFinanceData();
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao fechar caixa';
      toast.error(message);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'INCOME',
      category: '',
      amount: '',
      method: 'Dinheiro',
      description: '',
      patientId: '',
      staffId: '',
    });
    setFormErrors({});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-600">Gestão de fluxo de caixa e repasses médicos.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('caixa')}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'caixa' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Fluxo de Caixa
          </button>
          <button
            onClick={() => setActiveTab('repasses')}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'repasses' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Repasses Médicos
          </button>
        </div>
      </div>

      {activeTab === 'caixa' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Saldo</span>
              </div>
              <p className="text-sm font-medium text-gray-500">Saldo do Dia</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIncome - totalExpense)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-bold text-gray-900">Lançamentos do Dia</h3>
              <div className="flex items-center gap-4">
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
                  {closureStatus ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-semibold">
                      <Lock className="h-4 w-4" />
                      Caixa Fechado
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsClosureModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700 transition-colors"
                      >
                        <Lock className="h-4 w-4 mr-2" /> Fechar Caixa
                      </button>
                      <button
                        onClick={() => {
                          resetForm();
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
                      </button>
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
                      <th className="px-6 py-4">Categoria</th>
                      <th className="px-6 py-4">Método</th>
                      <th className="px-6 py-4 text-right">Valor</th>
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
                              <div className="font-semibold text-gray-900">{t.description || 'Sem descrição'}</div>
                              <div className="text-xs text-gray-500">{format(new Date(t.date), 'HH:mm')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{t.category}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{t.paymentMethod}</td>
                        <td className={`px-6 py-4 text-sm font-bold text-right ${(t.type === 'INCOME' || t.type === 'income') ? 'text-green-600' : 'text-red-600'}`}>
                          {(t.type === 'INCOME' || t.type === 'income') ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center">
              <Calculator className="h-5 w-5 mr-2 text-blue-600" />
              Resumo de Repasses Médicos
            </h3>
            <button className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
              <Filter className="h-4 w-4 mr-2" /> Filtrar Período
            </button>
          </div>

          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
              <p>Carregando repasses...</p>
            </div>
          ) : medicalFees.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-gray-400 text-center">
              <Calculator className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg font-medium text-gray-500">Nenhum repasse registrado no período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Médico</th>
                    <th className="px-6 py-4 text-right">Valor Bruto</th>
                    <th className="px-6 py-4 text-center">% Repasse</th>
                    <th className="px-6 py-4 text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medicalFees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">Dr(a). {fee.doctor.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fee.grossAmount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-bold">
                          {fee.percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-green-600 text-right">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fee.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Nova Transação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Nova Transação</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTransaction} className="p-6 space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                  placeholder="Observações sobre a transação..."
                />
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

      {/* Modal Fechar Caixa */}
      {isClosureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Fechar Caixa</h2>
              <button onClick={() => setIsClosureModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-sm font-semibold text-blue-900 mb-2">Resumo do Dia ({format(new Date(selectedDate), "dd/MM/yyyy", { locale: ptBR })})</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total de Entradas:</span>
                    <span className="font-bold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total de Saídas:</span>
                    <span className="font-bold text-red-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalExpense)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-200">
                    <span className="font-bold text-gray-900">Saldo do Dia:</span>
                    <span className="font-bold text-blue-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIncome - totalExpense)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>Atenção:</strong> Após fechar o caixa, não será possível realizar novas transações para este dia.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsClosureModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCloseBox}
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
    </div>
  );
}

