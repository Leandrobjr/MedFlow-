'use client';

import React, { useState, useEffect } from 'react';
import { expenseCategoriesService, ExpenseCategory, CreateExpenseCategoryDto, UpdateExpenseCategoryDto } from '@/services/expense-categories-service';
import { useAuth } from '@/hooks/use-auth';
import { FolderTree, Plus, Edit, Trash2, XCircle, Save, X, CheckCircle2, XCircle as XCircleIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CategoriasDespesasPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [formData, setFormData] = useState<CreateExpenseCategoryDto>({
    name: '',
    code: '',
    description: '',
    isFixed: false,
    costCenter: '',
    parentId: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await expenseCategoriesService.getHierarchicalTree(true);
      setCategories(data);
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
      toast.error(error.response?.data?.message || 'Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }
    
    if (!formData.code.trim()) {
      errors.code = 'Código é obrigatório';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    try {
      const payload: CreateExpenseCategoryDto = {
        ...formData,
        parentId: formData.parentId || undefined,
        description: formData.description || undefined,
        costCenter: formData.costCenter || undefined,
      };
      await expenseCategoriesService.create(payload);
      toast.success('Categoria criada com sucesso!');
      setIsModalOpen(false);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao criar categoria');
    }
  };

  const handleUpdate = async () => {
    if (!editingCategory || !validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    try {
      const payload: UpdateExpenseCategoryDto = {
        ...formData,
        parentId: formData.parentId || undefined,
        description: formData.description || undefined,
        costCenter: formData.costCenter || undefined,
      };
      await expenseCategoriesService.update(editingCategory.id, payload);
      toast.success('Categoria atualizada com sucesso!');
      setIsModalOpen(false);
      setEditingCategory(null);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao atualizar categoria');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await expenseCategoriesService.delete(id);
      toast.success('Categoria excluída com sucesso!');
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir categoria');
    }
  };

  const handleToggleActive = async (category: ExpenseCategory) => {
    try {
      if (category.isActive) {
        await expenseCategoriesService.deactivate(category.id);
        toast.success('Categoria desativada com sucesso!');
      } else {
        await expenseCategoriesService.activate(category.id);
        toast.success('Categoria ativada com sucesso!');
      }
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao alterar status da categoria');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      isFixed: false,
      costCenter: '',
      parentId: '',
    });
    setFormErrors({});
  };

  const openEditModal = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      code: category.code,
      description: category.description || '',
      isFixed: category.isFixed,
      costCenter: category.costCenter || '',
      parentId: category.parentId || '',
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    resetForm();
    setIsModalOpen(true);
  };

  const getAllCategoriesFlat = (cats: ExpenseCategory[]): ExpenseCategory[] => {
    return cats.flatMap(cat => [cat, ...(cat.children ? getAllCategoriesFlat(cat.children) : [])]);
  };

  const renderCategoryTree = (cats: ExpenseCategory[], level: number = 0): React.ReactNode => {
    return cats.map(cat => (
      <React.Fragment key={cat.id}>
        <tr className={`hover:bg-gray-50 transition-colors ${!cat.isActive ? 'opacity-60' : ''}`}>
          <td className="px-6 py-4">
            <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
              {level > 0 && <span className="text-gray-400 mr-2">└─</span>}
              <div>
                <div className="font-semibold text-gray-900">{cat.name}</div>
                <div className="text-xs text-gray-500">{cat.code}</div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 text-sm text-gray-600">{cat.description || '-'}</td>
          <td className="px-6 py-4 text-center">
            {cat.isFixed ? (
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">Fixa</span>
            ) : (
              <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold">Variável</span>
            )}
          </td>
          <td className="px-6 py-4 text-sm text-gray-600">{cat.costCenter || '-'}</td>
          <td className="px-6 py-4 text-center">
            {cat.isActive ? (
              <span className="px-2 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-semibold flex items-center justify-center w-fit mx-auto">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ativa
              </span>
            ) : (
              <span className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-semibold flex items-center justify-center w-fit mx-auto">
                <XCircleIcon className="h-3 w-3 mr-1" /> Inativa
              </span>
            )}
          </td>
          <td className="px-6 py-4 text-sm text-gray-600 text-center">{cat._count?.transactions || 0}</td>
          <td className="px-6 py-4">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => openEditModal(cat)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleToggleActive(cat)}
                className={`p-2 rounded-lg transition-colors ${
                  cat.isActive 
                    ? 'text-orange-600 hover:bg-orange-50' 
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={cat.isActive ? 'Desativar' : 'Ativar'}
              >
                {cat.isActive ? <X className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
        {cat.children && cat.children.length > 0 && renderCategoryTree(cat.children, level + 1)}
      </React.Fragment>
    ));
  };

  const flatCategories = getAllCategoriesFlat(categories);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias de Despesas</h1>
          <p className="text-gray-600">Gerencie as categorias hierárquicas de despesas.</p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'OWNER') && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" /> Nova Categoria
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
            <p>Carregando categorias...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400 text-center">
            <FolderTree className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-gray-500">Nenhuma categoria cadastrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4 text-center">Tipo</th>
                  <th className="px-6 py-4">Centro de Custo</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Transações</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {renderCategoryTree(categories)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar/Editar Categoria */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria Pai (Opcional)
                </label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Nenhuma (Categoria Raiz)</option>
                  {flatCategories
                    .filter(c => !editingCategory || c.id !== editingCategory.id)
                    .map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.code} - {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Materiais Médicos"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => {
                    setFormData({ ...formData, code: e.target.value.toUpperCase() });
                    if (formErrors.code) setFormErrors({ ...formErrors, code: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                    formErrors.code ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: INSUMOS-001-001"
                />
                {formErrors.code && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.code}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                  placeholder="Descrição da categoria..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custo</label>
                  <input
                    type="text"
                    value={formData.costCenter}
                    onChange={(e) => setFormData({ ...formData, costCenter: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: Unidade 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Despesa</label>
                  <select
                    value={formData.isFixed ? 'fixed' : 'variable'}
                    onChange={(e) => setFormData({ ...formData, isFixed: e.target.value === 'fixed' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="variable">Variável</option>
                    <option value="fixed">Fixa</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingCategory ? handleUpdate : handleCreate}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                >
                  <Save className="h-4 w-4 inline mr-2" />
                  {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
