'use client';

import React, { useState, useEffect } from 'react';
import { patientService, Patient } from '@/services/data-service';
import { Search, Plus, User, Phone, Mail, FileText, MoreVertical, Loader2, XCircle, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, validateCPF, validatePhone, validateEmail, validateBirthDate } from '@/lib/validations';

export default function PacientesPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    birthDate: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });
  
  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await patientService.getAll();
      setPatients(data);
    } catch (error) {
      toast.error('Erro ao carregar pacientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }
    
    if (!formData.cpf.trim()) {
      errors.cpf = 'CPF é obrigatório';
    } else if (!validateCPF(formData.cpf)) {
      errors.cpf = 'CPF inválido';
    }
    
    if (!formData.phone.trim()) {
      errors.phone = 'Telefone é obrigatório';
    } else if (!validatePhone(formData.phone)) {
      errors.phone = 'Telefone inválido (mínimo 10 dígitos)';
    }
    
    if (formData.email && !validateEmail(formData.email)) {
      errors.email = 'E-mail inválido';
    }
    
    if (!formData.birthDate) {
      errors.birthDate = 'Data de nascimento é obrigatória';
    } else if (!validateBirthDate(formData.birthDate)) {
      errors.birthDate = 'Data de nascimento deve ser no passado';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }
    
    try {
      // Limpar CPF e telefone antes de enviar
      const cleanData = {
        ...formData,
        cpf: formData.cpf.replace(/\D/g, ''),
        phone: formData.phone.replace(/\D/g, ''),
        zipCode: formData.zipCode?.replace(/\D/g, ''),
      };
      
      if (editingPatient) {
        await patientService.update(editingPatient.id, cleanData);
        toast.success('Paciente atualizado com sucesso!');
      } else {
        await patientService.create(cleanData);
        toast.success('Paciente cadastrado com sucesso!');
      }
      
      setIsModalOpen(false);
      setEditingPatient(null);
      resetForm();
      fetchPatients();
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao salvar paciente';
      if (message.includes('CPF') || message.includes('cpf')) {
        setFormErrors({ cpf: 'Este CPF já está cadastrado' });
        toast.error('CPF já cadastrado no sistema');
      } else {
        toast.error(message);
      }
    }
  };

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name || '',
      email: patient.email || '',
      phone: patient.phone || '',
      cpf: formatCPF(patient.cpf),
      birthDate: patient.birthDate ? patient.birthDate.split('T')[0] : '',
      gender: patient.gender || '',
      address: patient.address || '',
      city: patient.city || '',
      state: patient.state || '',
      zipCode: patient.zipCode || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    setIsDeleting(id);
    try {
      await patientService.delete(id);
      toast.success('Paciente excluído com sucesso!');
      fetchPatients();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir paciente');
    } finally {
      setIsDeleting(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      cpf: '',
      birthDate: '',
      gender: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
    });
    setFormErrors({});
    setEditingPatient(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-gray-600">Base de dados unificada de todos os pacientes da clínica.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-100"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Paciente
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
            placeholder="Buscar por nome ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all sm:text-sm"
          />
        </div>
      </div>

      {/* Patients List/Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
            <p>Carregando pacientes...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400 text-center">
            <User className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-gray-500">Nenhum paciente encontrado</p>
            <p className="text-sm">Tente mudar o termo de busca ou cadastre um novo paciente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Paciente</th>
                  <th className="px-6 py-4">CPF</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                          {patient.name.charAt(0)}
                        </div>
                        <div className="font-semibold text-gray-900">{patient.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {formatCPF(patient.cpf)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs flex items-center text-gray-600">
                          <Phone className="h-3 w-3 mr-1 text-gray-400" />
                          {patient.phone ? formatPhone(patient.phone) : 'Não informado'}
                        </span>
                        <span className="text-xs flex items-center text-gray-600">
                          <Mail className="h-3 w-3 mr-1 text-gray-400" />
                          {patient.email || 'Não informado'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEdit(patient)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Editar"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(patient.id)}
                          disabled={isDeleting === patient.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" 
                          title="Excluir"
                        >
                          {isDeleting === patient.id ? (
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

      {/* Modal Novo Paciente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreatePatient} className="p-6 space-y-4">
              <div>
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
                  placeholder="Ex: João da Silva"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CPF <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    value={formData.cpf}
                    onChange={(e) => {
                      const formatted = formatCPF(e.target.value);
                      setFormData({ ...formData, cpf: formatted });
                      if (formErrors.cpf) setFormErrors({ ...formErrors, cpf: '' });
                    }}
                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      formErrors.cpf ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="000.000.000-00"
                  />
                  {formErrors.cpf && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.cpf}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Nascimento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.birthDate}
                    onChange={(e) => {
                      setFormData({ ...formData, birthDate: e.target.value });
                      if (formErrors.birthDate) setFormErrors({ ...formErrors, birthDate: '' });
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      formErrors.birthDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.birthDate && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.birthDate}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone/WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={15}
                    value={formData.phone}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setFormData({ ...formData, phone: formatted });
                      if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                    }}
                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      formErrors.phone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="(00) 00000-0000"
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                    }}
                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      formErrors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="exemplo@email.com"
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
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
                  {editingPatient ? 'Atualizar' : 'Salvar'} Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

