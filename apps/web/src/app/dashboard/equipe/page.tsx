'use client';

import React, { useState, useEffect } from 'react';
import { staffService, procedureService, Staff, Procedure } from '@/services/data-service';
import { UserCog, Plus, Stethoscope, Mail, Phone, MoreVertical, Loader2, XCircle, Percent, DollarSign, Award, Edit, Trash2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPhone, validatePhone, validateEmail } from '@/lib/validations';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const PROFESSIONAL_ROLES = [
  { value: 'DOCTOR', label: 'Médico(a)' },
  { value: 'PHYSIOTHERAPIST', label: 'Fisioterapeuta' },
  { value: 'NUTRITIONIST', label: 'Nutricionista' },
  { value: 'PSYCHOLOGIST', label: 'Psicólogo(a)' },
  { value: 'DENTIST', label: 'Odontólogo(a)' },
  { value: 'SPEECH_THERAPIST', label: 'Fonoaudiólogo(a)' },
  { value: 'RECEPTIONIST', label: 'Recepção' },
  { value: 'ADMIN', label: 'Administrador' },
];

export default function EquipePage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'DOCTOR',
    specialty: '',
    crm: '',
    crmState: 'SP',
    rqe: '',
    rqeState: 'SP',
    commissionType: 'PERCENTAGE',
    commissionRate: 0,
    fixedCommission: 0,
    password: '',
    createAccount: false,
    procedureIds: [] as string[],
  });
  
  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const data = await staffService.getAll();
      setStaff(data);
    } catch (error) {
      toast.error('Erro ao carregar equipe');
    } finally {
      setLoading(false);
    }
  };

  const fetchProcedures = async () => {
    try {
      const data = await procedureService.getAll();
      setProcedures(data);
    } catch (error) {
      console.error('Erro ao carregar procedimentos:', error);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchProcedures();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }
    
    if (formData.email && !validateEmail(formData.email)) {
      errors.email = 'E-mail inválido';
    }
    
    if (formData.phone && !validatePhone(formData.phone)) {
      errors.phone = 'Telefone inválido (mínimo 10 dígitos)';
    }
    
    if (isHealthProfessional(formData.role)) {
      if (formData.commissionType === 'PERCENTAGE' && (!formData.commissionRate || formData.commissionRate <= 0 || formData.commissionRate > 100)) {
        errors.commissionRate = 'Porcentagem deve estar entre 1% e 100%';
      }
      if (formData.commissionType === 'FIXED' && (!formData.fixedCommission || formData.fixedCommission <= 0)) {
        errors.fixedCommission = 'Valor fixo deve ser maior que zero';
      }
    }

    if (formData.createAccount || (editingStaff?.userId && formData.password)) {
      if (!formData.password) {
        errors.password = 'Senha é obrigatória para criar uma conta';
      } else if (formData.password.length < 8) {
        errors.password = 'Senha deve ter pelo menos 8 caracteres';
      }
      
      if (formData.createAccount && !formData.email) {
        errors.email = 'E-mail é obrigatório para criar uma conta';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }
    
    try {
      // Ajuste para garantir que valores numéricos sejam enviados corretamente
      const payload = {
        ...formData,
        phone: formData.phone ? formData.phone.replace(/\D/g, '') : undefined,
        commissionRate: formData.commissionType === 'PERCENTAGE' ? Number(formData.commissionRate) : 0,
        fixedCommission: formData.commissionType === 'FIXED' ? Number(formData.fixedCommission) : 0,
        procedureIds: formData.procedureIds.length > 0 ? formData.procedureIds : undefined,
      };

      if (editingStaff) {
        await staffService.update(editingStaff.id, payload);
        toast.success('Profissional atualizado com sucesso!');
      } else {
        await staffService.create(payload);
        toast.success('Profissional cadastrado com sucesso!');
      }
      
      setIsModalOpen(false);
      setEditingStaff(null);
      resetForm();
      fetchStaff();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar profissional');
    }
  };

  const handleEdit = (member: Staff) => {
    setEditingStaff(member);
    // Extrair IDs de procedimentos do relacionamento staffProcedures
    const procedureIds = (member as any).staffProcedures?.map((sp: any) => sp.procedureId) || [];
    setFormData({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'DOCTOR',
      specialty: member.specialty || '',
      crm: member.crm || '',
      crmState: member.crmState || 'SP',
      rqe: member.rqe || '',
      rqeState: member.rqeState || 'SP',
      commissionType: member.commissionType || 'PERCENTAGE',
      commissionRate: member.commissionRate ? Number(member.commissionRate) : 0,
      fixedCommission: member.fixedCommission ? Number(member.fixedCommission) : 0,
      password: '',
      createAccount: false,
      procedureIds,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este profissional? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    setIsDeleting(id);
    try {
      await staffService.delete(id);
      toast.success('Profissional excluído com sucesso!');
      fetchStaff();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir profissional');
    } finally {
      setIsDeleting(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', email: '', phone: '', role: 'DOCTOR', 
      specialty: '', crm: '', crmState: 'SP',
      rqe: '', rqeState: 'SP',
      commissionType: 'PERCENTAGE',
      commissionRate: 0, fixedCommission: 0,
      password: '', createAccount: false,
      procedureIds: []
    });
    setFormErrors({});
    setEditingStaff(null);
  };

  const handleProcedureToggle = (procedureId: string) => {
    setFormData(prev => {
      const isSelected = prev.procedureIds.includes(procedureId);
      return {
        ...prev,
        procedureIds: isSelected
          ? prev.procedureIds.filter(id => id !== procedureId)
          : [...prev.procedureIds, procedureId]
      };
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const isHealthProfessional = (role: string) => {
    return ['DOCTOR', 'PHYSIOTHERAPIST', 'NUTRITIONIST', 'PSYCHOLOGIST', 'DENTIST', 'SPEECH_THERAPIST'].includes(role);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe e Profissionais</h1>
          <p className="text-gray-600">Gerencie médicos, especialistas e equipe de apoio.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-100"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Profissional
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
            <p>Carregando equipe...</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400 text-center">
            <UserCog className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-gray-500">Nenhum profissional cadastrado</p>
            <p className="text-sm">Cadastre o primeiro profissional para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Profissional</th>
                  <th className="px-6 py-4">Especialidade / Registro</th>
                  <th className="px-6 py-4 text-center">Regra de Repasse</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold mr-3 ${isHealthProfessional(member.role) ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                          {member.role === 'DOCTOR' ? <Stethoscope className="h-5 w-5" /> : member.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{member.name}</div>
                          <div className="text-xs text-gray-500">
                            {PROFESSIONAL_ROLES.find(r => r.value === member.role)?.label || member.role}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-gray-900 font-medium">{member.specialty || '-'}</div>
                      <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                        {member.crm && (
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                            REG: {member.crm}-{member.crmState}
                          </span>
                        )}
                        {member.rqe && (
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                            RQE: {member.rqe}-{member.rqeState}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      {isHealthProfessional(member.role) ? (
                        <div className="inline-flex flex-col items-center">
                          {member.commissionType === 'FIXED' ? (
                            <div className="flex items-center text-green-600 font-bold">
                              <DollarSign className="h-3 w-3 mr-0.5" />
                              R$ {Number(member.fixedCommission).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              <span className="text-[10px] text-gray-400 ml-1 font-normal">(Fixo)</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-blue-600 font-bold">
                              <Percent className="h-3 w-3 mr-0.5" />
                              {member.commissionRate}%
                              <span className="text-[10px] text-gray-400 ml-1 font-normal">(Variável)</span>
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="flex items-center text-gray-600">
                          <Phone className="h-3 w-3 mr-1 text-gray-400" />
                          {member.phone ? formatPhone(member.phone) : 'N/A'}
                        </span>
                        <span className="flex items-center text-gray-600">
                          <Mail className="h-3 w-3 mr-1 text-gray-400" />
                          {member.email || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEdit(member)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Editar"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(member.id)}
                          disabled={isDeleting === member.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" 
                          title="Excluir"
                        >
                          {isDeleting === member.id ? (
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

      {/* Modal Novo Profissional */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingStaff ? 'Editar Profissional' : 'Novo Profissional'}
                </h2>
                <p className="text-sm text-gray-500">
                  {editingStaff ? 'Atualize as informações do profissional.' : 'Cadastre um novo membro para sua clínica.'}
                </p>
              </div>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateStaff} className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informações Básicas */}
                <div className="md:col-span-2 space-y-4">
                  <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b border-blue-50 pb-2">Informações Básicas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Completo <span className="text-red-500">*</span>
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
                        placeholder="Ex: Dra. Ana Silva"
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Profissional</label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {PROFESSIONAL_ROLES.map(role => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                        }}
                        className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                          formErrors.email ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="email@exemplo.com"
                      />
                      {formErrors.email && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                      <input
                        type="tel"
                        maxLength={15}
                        value={formData.phone}
                        onChange={(e) => {
                          const formatted = formatPhone(e.target.value);
                          setFormData({ ...formData, phone: formatted });
                          if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                        }}
                        className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                          formErrors.phone ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="(00) 00000-0000"
                      />
                      {formErrors.phone && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Conta de Usuário e Senha */}
                <div className="md:col-span-2 space-y-4">
                  <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b border-blue-50 pb-2 flex items-center">
                    <Lock className="h-4 w-4 mr-2" /> 
                    {editingStaff?.userId ? 'Segurança e Acesso' : 'Conta de Usuário'}
                  </h3>
                  
                  {!editingStaff?.userId && (
                    <div className="flex items-center mb-4">
                      <input
                        id="createAccount"
                        type="checkbox"
                        checked={formData.createAccount}
                        onChange={(e) => setFormData({ ...formData, createAccount: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="createAccount" className="ml-2 block text-sm text-gray-900 font-medium">
                        Criar conta de usuário para acesso ao sistema
                      </label>
                    </div>
                  )}

                  {(formData.createAccount || editingStaff?.userId) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                      <div className="md:col-span-2">
                        <p className="text-xs text-blue-600 mb-2 italic">
                          {editingStaff?.userId 
                            ? "Preencha a senha apenas se desejar alterá-la." 
                            : "Defina uma senha para que este profissional possa fazer login."}
                        </p>
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Senha <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => {
                            setFormData({ ...formData, password: e.target.value });
                            if (formErrors.password) setFormErrors({ ...formErrors, password: '' });
                          }}
                          className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                            formErrors.password ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="Mínimo 8 caracteres"
                        />
                        {formErrors.password && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Registro Profissional (Apenas para profissionais de saúde) */}
                {isHealthProfessional(formData.role) && (
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b border-blue-50 pb-2 flex items-center">
                      <Award className="h-4 w-4 mr-2" /> Registro Profissional
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade</label>
                        <input
                          type="text"
                          value={formData.specialty}
                          onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Ex: Dermatologia, Ortopedia, etc."
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Registro (CRM/CRP/etc)</label>
                          <input
                            type="text"
                            value={formData.crm}
                            onChange={(e) => setFormData({ ...formData, crm: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Nº Registro"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                          <select
                            value={formData.crmState}
                            onChange={(e) => setFormData({ ...formData, crmState: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {BRAZILIAN_STATES.map(uf => (
                              <option key={uf} value={uf}>{uf}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">RQE (Opcional)</label>
                          <input
                            type="text"
                            value={formData.rqe}
                            onChange={(e) => setFormData({ ...formData, rqe: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Nº Especialização"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                          <select
                            value={formData.rqeState}
                            onChange={(e) => setFormData({ ...formData, rqeState: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {BRAZILIAN_STATES.map(uf => (
                              <option key={uf} value={uf}>{uf}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Regras de Repasse Financeiro */}
                {isHealthProfessional(formData.role) && (
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b border-blue-50 pb-2 flex items-center">
                      <DollarSign className="h-4 w-4 mr-2" /> Regras de Repasse
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de Repasse</label>
                        <div className="flex gap-4">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              className="hidden peer"
                              name="commissionType"
                              value="PERCENTAGE"
                              checked={formData.commissionType === 'PERCENTAGE'}
                              onChange={() => setFormData({...formData, commissionType: 'PERCENTAGE'})}
                            />
                            <div className="px-4 py-2 border border-gray-300 rounded-xl peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-all text-sm font-semibold">
                              Percentual (%)
                            </div>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              className="hidden peer"
                              name="commissionType"
                              value="FIXED"
                              checked={formData.commissionType === 'FIXED'}
                              onChange={() => setFormData({...formData, commissionType: 'FIXED'})}
                            />
                            <div className="px-4 py-2 border border-gray-300 rounded-xl peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-all text-sm font-semibold">
                              Valor Fixo (R$)
                            </div>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {formData.commissionType === 'PERCENTAGE' ? 'Porcentagem de Repasse' : 'Valor Fixo por Atendimento'}
                        </label>
                        <div className="relative">
                          {formData.commissionType === 'PERCENTAGE' ? (
                            <>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={formData.commissionRate}
                                onChange={(e) => {
                                  setFormData({ ...formData, commissionRate: Number(e.target.value) });
                                  if (formErrors.commissionRate) setFormErrors({ ...formErrors, commissionRate: '' });
                                }}
                                className={`w-full pl-4 pr-10 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                                  formErrors.commissionRate ? 'border-red-300' : 'border-gray-300'
                                }`}
                                placeholder="70"
                              />
                              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            </>
                          ) : (
                            <>
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.fixedCommission}
                                onChange={(e) => {
                                  setFormData({ ...formData, fixedCommission: Number(e.target.value) });
                                  if (formErrors.fixedCommission) setFormErrors({ ...formErrors, fixedCommission: '' });
                                }}
                                className={`w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                                  formErrors.fixedCommission ? 'border-red-300' : 'border-gray-300'
                                }`}
                                placeholder="0,00"
                              />
                            </>
                          )}
                        </div>
                        {formErrors.commissionRate && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.commissionRate}</p>
                        )}
                        {formErrors.fixedCommission && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.fixedCommission}</p>
                        )}
                        <p className="text-[10px] text-gray-500 mt-2 italic">
                          {formData.commissionType === 'PERCENTAGE' 
                            ? "* O médico receberá este percentual sobre o valor total cobrado do paciente."
                            : "* O médico receberá este valor fixo bruto por cada atendimento realizado."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                >
                  {editingStaff ? 'Atualizar' : 'Salvar'} Profissional
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
