'use client';

import React, { useState, useEffect } from 'react';
import { procedureService, Procedure } from '@/services/data-service';
import { Search, Plus, ClipboardList, DollarSign, FileText, MoreVertical, Loader2, XCircle, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ProcedimentosPage() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    grossAmount: '',
    observations: '',
  });
  
  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchProcedures = async () => {
    setLoading(true);
    try {
      const data = await procedureService.getAll();
      setProcedures(data);
    } catch (error) {
      toast.error('Erro ao carregar procedimentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcedures();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Nome do procedimento é obrigatório';
    }
    
    if (!formData.grossAmount.trim()) {
      errors.grossAmount = 'Valor bruto é obrigatório';
    } else {
      const amount = parseFloat(formData.grossAmount.replace(',', '.'));
      if (isNaN(amount) || amount < 0) {
        errors.grossAmount = 'Valor deve ser um número maior ou igual a zero';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }
    
    try {
      const data = {
        name: formData.name.trim(),
        grossAmount: parseFloat(formData.grossAmount.replace(',', '.')),
        observations: formData.observations.trim() || undefined,
      };
      
      if (editingProcedure) {
        await procedureService.update(editingProcedure.id, data);
        toast.success('Procedimento atualizado com sucesso!');
      } else {
        await procedureService.create(data);
        toast.success('Procedimento cadastrado com sucesso!');
      }
      
      handleCloseModal();
      fetchProcedures();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao salvar procedimento';
      toast.error(message);
    }
  };

  const handleEdit = (procedure: Procedure) => {
    setEditingProcedure(procedure);
    setFormData({
      name: procedure.name,
      grossAmount: procedure.grossAmount.toString().replace('.', ','),
      observations: procedure.observations || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este procedimento?')) {
      return;
    }
    
    setIsDeleting(id);
    try {
      await procedureService.delete(id);
      toast.success('Procedimento excluído com sucesso!');
      fetchProcedures();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao excluir procedimento';
      toast.error(message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProcedure(null);
    setFormData({
      name: '',
      grossAmount: '',
      observations: '',
    });
    setFormErrors({});
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredProcedures = procedures.filter((procedure) =>
    procedure.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Procedimentos</h1>
          <p className="text-gray-600 mt-1">Gerencie os procedimentos oferecidos pela clínica</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="h-5 w-5" />
          Novo Procedimento
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all sm:text-sm"
          />
        </div>
      </div>

      {/* Procedures List/Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
            <p>Carregando procedimentos...</p>
          </div>
        ) : filteredProcedures.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400 text-center">
            <ClipboardList className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-gray-500">Nenhum procedimento encontrado</p>
            <p className="text-sm">Tente mudar o termo de busca ou cadastre um novo procedimento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Valor Bruto</th>
                  <th className="px-6 py-4">Observações</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProcedures.map((procedure) => (
                  <tr key={procedure.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                          {procedure.name.charAt(0)}
                        </div>
                        <div className="font-semibold text-gray-900">{procedure.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-green-600 font-semibold">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {formatCurrency(procedure.grossAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-md truncate">
                        {procedure.observations || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEdit(procedure)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Editar"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(procedure.id)}
                          disabled={isDeleting === procedure.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" 
                          title="Excluir"
                        >
                          {isDeleting === procedure.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Trash2 className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo Procedimento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProcedure ? 'Editar Procedimento' : 'Novo Procedimento'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateProcedure} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Procedimento <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Consulta médica"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Bruto (R$) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.grossAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d,]/g, '');
                    setFormData({ ...formData, grossAmount: value });
                    if (formErrors.grossAmount) setFormErrors({ ...formErrors, grossAmount: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                    formErrors.grossAmount ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0,00"
                />
                {formErrors.grossAmount && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.grossAmount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  placeholder="Informações adicionais sobre o procedimento..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                  {editingProcedure ? 'Atualizar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
