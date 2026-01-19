'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { patientService, Patient } from '@/services/data-service';
import { pepService, MedicalRecord } from '@/services/pep-service';
import { appointmentService } from '@/services/appointment-service';
import { Search, User, FileText, ChevronRight, History, Plus, Lock, Send, Loader2, ArrowLeft, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function PEPPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'editor'>('list');
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  // Form state for new/edit record
  const [formData, setFormData] = useState({
    soapSubjective: '',
    soapObjective: '',
    soapAssessment: '',
    soapPlan: '',
    anamnesis: '',
    physicalExam: '',
    diagnosis: '',
    prescription: '',
    conduct: '',
  });
  const [addendumText, setAddendumText] = useState('');
  const [savingAddendum, setSavingAddendum] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true); // Novo prontuário começa com mudanças não salvas
  
  // Estado para guardar os valores ORIGINAIS do banco (para comparação no onBlur)
  const [originalPatientData, setOriginalPatientData] = useState<{ allergies: string; medications: string }>({
    allergies: '',
    medications: '',
  });

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

  const fetchRecords = async (patientId: string) => {
    setLoadingRecords(true);
    try {
      const data = await pepService.getByPatient(patientId);
      setRecords(data);
    } catch (error) {
      toast.error('Erro ao carregar prontuários');
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Verificar se há patientId ou appointmentId nos query params
  useEffect(() => {
    const patientIdParam = searchParams.get('patientId');
    const appointmentIdParam = searchParams.get('appointmentId');

    if (patientIdParam && patients.length > 0) {
      const patient = patients.find(p => p.id === patientIdParam);
      if (patient) {
        // Carregar dados completos do paciente do backend para garantir que alergias e medicamentos estão atualizados
        patientService.getById(patientIdParam)
          .then((fullPatientData) => {
            setSelectedPatient(fullPatientData);
            setOriginalPatientData({
              allergies: fullPatientData.allergies || '',
              medications: fullPatientData.medications || '',
            });
            setViewMode('timeline');
            
            // Buscar prontuários do paciente
            fetchRecords(patientIdParam).then(async () => {
              // Se tiver appointmentId, buscar prontuário específico desse appointment
              if (appointmentIdParam) {
                // Buscar novamente para garantir que temos os dados atualizados
                const allRecords = await pepService.getByPatient(patientIdParam);
                setRecords(allRecords);
                
                const record = allRecords.find(r => r.appointmentId === appointmentIdParam);
                if (record) {
                  handleOpenRecord(record);
                }
              }
            });
          })
          .catch((error) => {
            console.error('Erro ao carregar dados do paciente:', error);
            // Fallback: usar dados básicos do paciente da lista
            setSelectedPatient(patient);
            setOriginalPatientData({
              allergies: patient.allergies || '',
              medications: patient.medications || '',
            });
            setViewMode('timeline');
            fetchRecords(patientIdParam);
          });
      }
    }
  }, [searchParams, patients]);

  const handleSelectPatient = async (patient: Patient) => {
    // Carregar dados completos do paciente do backend para garantir que alergias e medicamentos estão atualizados
    try {
      const fullPatientData = await patientService.getById(patient.id);
      setSelectedPatient(fullPatientData);
      setOriginalPatientData({
        allergies: fullPatientData.allergies || '',
        medications: fullPatientData.medications || '',
      });
    } catch (error) {
      console.error('Erro ao carregar dados do paciente:', error);
      // Fallback: usar dados básicos do paciente da lista
      setSelectedPatient(patient);
      setOriginalPatientData({
        allergies: patient.allergies || '',
        medications: patient.medications || '',
      });
    }
    fetchRecords(patient.id);
    setViewMode('timeline');
  };

  // REMOVIDO: useEffect que recarregava dados do paciente quando o ID mudava
  // Isso causava problemas pois poderia sobrescrever edições locais com dados antigos do servidor
  // Agora os dados são carregados apenas via handleSelectPatient e handleOpenRecord

  const handleOpenRecord = async (record: MedicalRecord) => {
    setSelectedRecord(record);
    // Sempre carregar os dados do prontuário (campos da consulta)
    setFormData({
      soapSubjective: record.soapSubjective || '',
      soapObjective: record.soapObjective || '',
      soapAssessment: record.soapAssessment || '',
      soapPlan: record.soapPlan || '',
      anamnesis: record.anamnesis || '',
      physicalExam: record.physicalExam || '',
      diagnosis: record.diagnosis || '',
      prescription: record.prescription || '',
      conduct: record.conduct || '',
    });
    
    // Verificar se é um prontuário novo (sem dados) ou existente (com dados)
    const isNewRecord = !record.anamnesis && !record.physicalExam && !record.diagnosis && !record.prescription && !record.conduct &&
                        !record.soapSubjective && !record.soapObjective && !record.soapAssessment && !record.soapPlan;
    setHasUnsavedChanges(isNewRecord); // Prontuário novo precisa ser salvo; existente não
    
    // Garantir que os dados do paciente estão atualizados (alergias e medicamentos)
    if (selectedPatient?.id) {
      try {
        console.log('[PEP] Carregando dados do paciente:', selectedPatient.id);
        const updatedPatient = await patientService.getById(selectedPatient.id);
        console.log('[PEP] Dados do paciente carregados:', {
          id: updatedPatient?.id,
          name: updatedPatient?.name,
          allergies: updatedPatient?.allergies,
          medications: updatedPatient?.medications,
        });
        setSelectedPatient(updatedPatient);
        // Guardar valores originais para comparação no onBlur
        setOriginalPatientData({
          allergies: updatedPatient.allergies || '',
          medications: updatedPatient.medications || '',
        });
      } catch (error) {
        console.error('Erro ao carregar dados atualizados do paciente:', error);
      }
    }
    
    setViewMode('editor');
  };

  const handleSaveRecord = async () => {
    if (!selectedRecord) {
      toast.error('Nenhum prontuário selecionado');
      return;
    }
    
    if (selectedRecord.isFinalized) {
      toast.error('Este prontuário já foi finalizado e não pode ser editado. Use Adendos para correções.');
      return;
    }

    if (savingRecord) {
      return; // Evitar duplo clique
    }
    
    setSavingRecord(true);
    
    try {
      console.log('[PEP] Iniciando salvamento do prontuário:', { 
        recordId: selectedRecord.id, 
        formData,
        patientId: selectedPatient?.id 
      });
      
      // Atualizar e obter o registro atualizado
      const updatedRecord = await pepService.update(selectedRecord.id, formData);
      
      console.log('[PEP] Prontuário atualizado com sucesso:', updatedRecord);
      
      // Atualizar selectedRecord com os dados retornados
      setSelectedRecord(updatedRecord);
      
      // Atualizar formData com os dados salvos (garantir que está sincronizado)
      setFormData({
        soapSubjective: updatedRecord.soapSubjective || '',
        soapObjective: updatedRecord.soapObjective || '',
        soapAssessment: updatedRecord.soapAssessment || '',
        soapPlan: updatedRecord.soapPlan || '',
        anamnesis: updatedRecord.anamnesis || '',
        physicalExam: updatedRecord.physicalExam || '',
        diagnosis: updatedRecord.diagnosis || '',
        prescription: updatedRecord.prescription || '',
        conduct: updatedRecord.conduct || '',
      });
      
      // Atualizar lista de registros para refletir as mudanças
      if (selectedPatient?.id) {
        await fetchRecords(selectedPatient.id);
      }
      
      // Recarregar o registro selecionado para garantir que temos os dados mais recentes
      const refreshedRecord = await pepService.getById(selectedRecord.id);
      setSelectedRecord(refreshedRecord);
      
      // Marcar que não há mais mudanças não salvas
      setHasUnsavedChanges(false);
      
      toast.success('Prontuário salvo com sucesso!');
    } catch (error: any) {
      console.error('[PEP] Erro ao salvar prontuário:', error);
      console.error('[PEP] Detalhes do erro:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao salvar prontuário';
      toast.error(message);
    } finally {
      setSavingRecord(false);
    }
  };

  const handleFinalizeRecord = async () => {
    if (!selectedRecord) return;
    
    if (selectedRecord.isFinalized) {
      toast.error('Este prontuário já está finalizado.');
      return;
    }
    
    // Validar campos obrigatórios antes de finalizar
    if ((!formData.diagnosis || !formData.diagnosis.trim()) && (!formData.soapAssessment || !formData.soapAssessment.trim())) {
      toast.error('É necessário preencher o diagnóstico ou avaliação antes de finalizar o prontuário.');
      return;
    }
    
    if (!confirm('Deseja realmente finalizar este prontuário? Após finalizado, ele não poderá mais ser editado (apenas adendos poderão ser feitos).')) {
      return;
    }
    
    try {
      await pepService.finalize(selectedRecord.id);
      toast.success('✅ Prontuário finalizado com sucesso! Repasse médico gerado automaticamente.', {
        duration: 4000,
      });
      fetchRecords(selectedPatient!.id);
      setViewMode('timeline');
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao finalizar prontuário';
      toast.error(message);
    }
  };

  const handleNewAppointment = async () => {
    if (!selectedPatient) {
      toast.error('Selecione um paciente primeiro');
      return;
    }

    const appointmentIdParam = searchParams.get('appointmentId');
    
    if (!appointmentIdParam) {
      toast.error('Não foi possível identificar o agendamento. Por favor, inicie o atendimento novamente pela página inicial.');
      return;
    }

    if (!user?.staffId) {
      toast.error('Usuário não possui vínculo com profissional. Entre em contato com o administrador.');
      return;
    }

    try {
      // Verificar se já existe prontuário para este appointment
      const existingRecords = await pepService.getByPatient(selectedPatient.id);
      const existingRecord = existingRecords.find(r => r.appointmentId === appointmentIdParam);
      
      if (existingRecord) {
        // Se já existe, apenas abrir
        handleOpenRecord(existingRecord);
        toast.success('Prontuário encontrado!');
        return;
      }

      // Buscar dados do appointment para garantir que temos todas as informações
      const appointment = await appointmentService.getById(appointmentIdParam);
      
      if (!appointment) {
        toast.error('Agendamento não encontrado.');
        return;
      }

      // Criar novo prontuário
      const newRecord = await pepService.create({
        appointmentId: appointmentIdParam,
        patientId: selectedPatient.id,
        staffId: user.staffId,
      });

      toast.success('Novo prontuário criado!');
      
      // Atualizar lista de prontuários
      await fetchRecords(selectedPatient.id);
      
      // Recarregar dados atualizados do paciente para garantir que alergias e medicamentos estão atualizados
      const updatedPatient = await patientService.getById(selectedPatient.id);
      setSelectedPatient(updatedPatient);
      setOriginalPatientData({
        allergies: updatedPatient.allergies || '',
        medications: updatedPatient.medications || '',
      });
      
      // Abrir o prontuário no editor (campos do prontuário ficam em branco, mas dados do paciente aparecem)
      handleOpenRecord(newRecord);
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao criar prontuário';
      toast.error(message);
      console.error('Erro ao criar prontuário:', error);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf.includes(searchTerm)
  );

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prontuário Eletrônico (PEP)</h1>
          <p className="text-gray-600">Selecione um paciente para visualizar o histórico clínico.</p>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar paciente por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
              <p>Carregando pacientes...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-20 text-center text-gray-400">
              <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum paciente encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPatient(p)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">CPF: {p.cpf}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'timeline') {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setViewMode('list')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para lista
        </button>

        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-100">
              {selectedPatient?.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedPatient?.name}</h1>
              <p className="text-sm text-gray-500">CPF: {selectedPatient?.cpf} • {selectedPatient?.phone}</p>
            </div>
          </div>
          <button 
            onClick={handleNewAppointment}
            className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedPatient}
          >
            <Plus className="h-5 w-5 mr-2" /> Novo Atendimento
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h3 className="font-bold text-gray-900 flex items-center">
              <History className="h-5 w-5 mr-2 text-blue-600" />
              Histórico de Atendimentos
            </h3>

            {loadingRecords ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : records.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p>Nenhum registro encontrado para este paciente.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all cursor-pointer group" onClick={() => handleOpenRecord(record)}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm font-bold text-blue-600">{format(new Date(record.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                        <p className="text-xs text-gray-500">Médico: Dr(a). {record.doctor.name}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${record.isFinalized ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {record.isFinalized ? 'Finalizado' : 'Em Aberto'}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      <span className="font-bold">Diagnóstico:</span> {record.diagnosis || 'Não informado'}
                    </p>
                    <div className="mt-4 flex justify-end">
                      <span className="text-xs text-blue-600 font-semibold group-hover:underline">Visualizar detalhes →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h3 className="font-bold text-gray-900">Resumo do Paciente</h3>
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase">Alergias</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedPatient?.allergies?.trim() || 'Nenhuma registrada'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase">Medicamentos Contínuos</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedPatient?.medications?.trim() || 'Nenhum registrado'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase">Última Consulta</p>
                <p className="text-sm text-gray-700">{records.length > 0 ? format(new Date(records[0].createdAt), 'dd/MM/yyyy') : 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'editor' && selectedRecord) {
    const isLocked = selectedRecord.isFinalized;

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setViewMode('timeline')}
            className="flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para o histórico
          </button>
          {isLocked && (
            <div className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
              <Lock className="h-3 w-3 mr-1" /> PRONTUÁRIO ASSINADO DIGITALMENTE
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Atendimento Médico</h2>
            <p className="text-sm text-gray-500">Paciente: {selectedPatient?.name} • Data: {format(new Date(selectedRecord.createdAt), "dd/MM/yyyy HH:mm")}</p>
          </div>

          <div className="p-8 space-y-8">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-6">
              <p className="text-sm text-blue-800 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Utilize a metodologia <strong>SOAP</strong> para preencher o prontuário.
              </p>
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                  S - Subjetivo
                </h3>
                <span className="text-[10px] text-gray-400 font-normal italic">Queixas, sintomas, histórico relatado</span>
              </div>
              <textarea
                disabled={isLocked}
                value={formData.soapSubjective}
                onChange={(e) => {
                  setFormData({...formData, soapSubjective: e.target.value});
                  setHasUnsavedChanges(true);
                }}
                placeholder="Ex: Paciente relata dor de cabeça frontal há 3 dias, melhora com repouso..."
                className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-70 text-sm"
              />
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                  O - Objetivo
                </h3>
                <span className="text-[10px] text-gray-400 font-normal italic">Exame físico, sinais vitais, observações</span>
              </div>
              <textarea
                disabled={isLocked}
                value={formData.soapObjective}
                onChange={(e) => {
                  setFormData({...formData, soapObjective: e.target.value});
                  setHasUnsavedChanges(true);
                }}
                placeholder="Ex: PA 120x80 mmHg, FC 80 bpm, afebril. Ausculta cardíaca normal..."
                className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-70 text-sm"
              />
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                  A - Avaliação
                </h3>
                <span className="text-[10px] text-gray-400 font-normal italic">Hipóteses diagnósticas, CID, raciocínio clínico</span>
              </div>
              <textarea
                disabled={isLocked}
                value={formData.soapAssessment}
                onChange={(e) => {
                  setFormData({...formData, soapAssessment: e.target.value});
                  setHasUnsavedChanges(true);
                }}
                placeholder="Ex: Enxaqueca tensional (G44.2). Raciocínio: Sintomas típicos sem sinais de alerta..."
                className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-70 text-sm"
              />
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                  P - Plano
                </h3>
                <span className="text-[10px] text-gray-400 font-normal italic">Conduta, prescrição, exames, encaminhamentos</span>
              </div>
              <textarea
                disabled={isLocked}
                value={formData.soapPlan}
                onChange={(e) => {
                  setFormData({...formData, soapPlan: e.target.value});
                  setHasUnsavedChanges(true);
                }}
                placeholder="Ex: Prescrito Paracetamol 500mg se dor. Orientado repouso e hidratação..."
                className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-70 text-sm"
              />
            </section>

            {(formData.anamnesis || formData.physicalExam || formData.diagnosis || formData.prescription || formData.conduct) && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Dados de Migração (Sistema Antigo)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.anamnesis && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Anamnese</p>
                      <p className="text-xs text-gray-600">{formData.anamnesis}</p>
                    </div>
                  )}
                  {formData.physicalExam && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Exame Físico</p>
                      <p className="text-xs text-gray-600">{formData.physicalExam}</p>
                    </div>
                  )}
                  {formData.diagnosis && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Diagnóstico</p>
                      <p className="text-xs text-gray-600">{formData.diagnosis}</p>
                    </div>
                  )}
                  {formData.prescription && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Prescrição</p>
                      <p className="text-xs text-gray-600">{formData.prescription}</p>
                    </div>
                  )}
                  {formData.conduct && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Conduta</p>
                      <p className="text-xs text-gray-600">{formData.conduct}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Seção de Informações do Paciente - SEMPRE editável (dados do paciente, não do prontuário) */}
            <section className="space-y-4 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                Informações do Paciente
                <span className="ml-2 text-xs font-normal text-gray-500">(salva automaticamente ao editar)</span>
              </h3>
              
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-blue-600 uppercase mb-1">
                    Alergias
                  </label>
                  <textarea
                    value={selectedPatient?.allergies || ''}
                    onChange={(e) => {
                      if (!selectedPatient) return;
                      setSelectedPatient({ ...selectedPatient, allergies: e.target.value });
                    }}
                    onBlur={async (e) => {
                      if (!selectedPatient) return;
                      const newValue = e.target.value.trim();
                      // Comparar com o valor ORIGINAL do banco, não com o estado local
                      const originalValue = originalPatientData.allergies.trim();
                      console.log('[PEP] onBlur Alergias - comparando com ORIGINAL:', { newValue, originalValue, mudou: newValue !== originalValue });
                      if (newValue !== originalValue) {
                        try {
                          console.log('[PEP] Salvando alergias para paciente:', selectedPatient.id, '- valor:', newValue);
                          const updatedPatient = await patientService.update(selectedPatient.id, { allergies: newValue });
                          console.log('[PEP] Resposta do servidor - alergias salvas:', updatedPatient.allergies);
                          toast.success('Alergias atualizadas!');
                          // Atualizar os dados originais com o valor salvo
                          setOriginalPatientData(prev => ({ ...prev, allergies: updatedPatient.allergies || '' }));
                          setSelectedPatient(updatedPatient);
                        } catch (error: any) {
                          console.error('[PEP] Erro ao salvar alergias:', error);
                          toast.error('Erro ao atualizar alergias');
                          // Reverter para o valor original do banco
                          setSelectedPatient({ ...selectedPatient, allergies: originalValue });
                        }
                      }
                    }}
                    placeholder="Informe as alergias do paciente..."
                    className="w-full h-16 p-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-600 uppercase mb-1">
                    Medicamentos Contínuos
                  </label>
                  <textarea
                    value={selectedPatient?.medications || ''}
                    onChange={(e) => {
                      if (!selectedPatient) return;
                      setSelectedPatient({ ...selectedPatient, medications: e.target.value });
                    }}
                    onBlur={async (e) => {
                      if (!selectedPatient) return;
                      const newValue = e.target.value.trim();
                      // Comparar com o valor ORIGINAL do banco, não com o estado local
                      const originalValue = originalPatientData.medications.trim();
                      console.log('[PEP] onBlur Medicamentos - comparando com ORIGINAL:', { newValue, originalValue, mudou: newValue !== originalValue });
                      if (newValue !== originalValue) {
                        try {
                          console.log('[PEP] Salvando medicamentos para paciente:', selectedPatient.id, '- valor:', newValue);
                          const updatedPatient = await patientService.update(selectedPatient.id, { medications: newValue });
                          console.log('[PEP] Resposta do servidor - medicamentos salvos:', updatedPatient.medications);
                          toast.success('Medicamentos atualizados!');
                          // Atualizar os dados originais com o valor salvo
                          setOriginalPatientData(prev => ({ ...prev, medications: updatedPatient.medications || '' }));
                          setSelectedPatient(updatedPatient);
                        } catch (error: any) {
                          console.error('[PEP] Erro ao salvar medicamentos:', error);
                          toast.error('Erro ao atualizar medicamentos');
                          // Reverter para o valor original do banco
                          setSelectedPatient({ ...selectedPatient, medications: originalValue });
                        }
                      }
                    }}
                    placeholder="Informe os medicamentos contínuos do paciente..."
                    className="w-full h-16 p-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                  />
                </div>
              </div>
            </section>

            {!isLocked && (
              <div className="pt-6 flex gap-4">
                <button
                  onClick={handleSaveRecord}
                  disabled={savingRecord}
                  className="flex-1 px-6 py-3 border border-blue-600 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {savingRecord ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                    </>
                  ) : (
                    'Salvar Rascunho'
                  )}
                </button>
                <button
                  onClick={handleFinalizeRecord}
                  disabled={savingRecord || hasUnsavedChanges}
                  title={hasUnsavedChanges ? 'Salve o rascunho antes de finalizar' : 'Finalizar e assinar digitalmente o prontuário'}
                  className={`flex-1 px-6 py-3 font-bold rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed ${
                    hasUnsavedChanges 
                      ? 'bg-gray-300 text-gray-500 shadow-gray-100' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100 disabled:opacity-50'
                  }`}
                >
                  {hasUnsavedChanges ? '⚠️ Salve primeiro' : 'Finalizar e Assinar'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Seção de Adendos (Sempre visível se houver ou se estiver finalizado) */}
        {((selectedRecord.addendums && selectedRecord.addendums.length > 0) || isLocked) && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mt-8">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center">
                <Plus className="h-5 w-5 mr-2 text-blue-600" /> Adendos e Observações Posteriores
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {selectedRecord.addendums.map(add => (
                <div key={add.id} className="bg-yellow-50 p-4 rounded-xl border-l-4 border-yellow-400">
                  <p className="text-xs font-bold text-yellow-700 mb-1">
                    Adicionado em {format(new Date(add.createdAt), "dd/MM/yyyy HH:mm")}
                  </p>
                  <p className="text-sm text-gray-700">{add.content}</p>
                </div>
              ))}
              
              {isLocked && (
                <div className="pt-4">
                  <textarea
                    value={addendumText}
                    onChange={(e) => setAddendumText(e.target.value)}
                    placeholder="Adicionar nova observação a este prontuário finalizado..."
                    className="w-full h-24 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none resize-none text-sm mb-2"
                  />
                  <button 
                    onClick={async () => {
                      if (!addendumText.trim()) {
                        toast.error('O conteúdo do adendo não pode estar vazio');
                        return;
                      }
                      if (!selectedRecord) return;
                      
                      setSavingAddendum(true);
                      try {
                        await pepService.addAddendum(selectedRecord.id, addendumText);
                        toast.success('Adendo adicionado com sucesso!');
                        setAddendumText('');
                        fetchRecords(selectedPatient!.id);
                        // Recarregar o registro selecionado
                        const updated = await pepService.getById(selectedRecord.id);
                        setSelectedRecord(updated);
                      } catch (error: any) {
                        const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao adicionar adendo';
                        toast.error(message);
                      } finally {
                        setSavingAddendum(false);
                      }
                    }}
                    disabled={savingAddendum || !addendumText.trim()}
                    className="flex items-center px-4 py-2 bg-yellow-600 text-white text-xs font-bold rounded-lg hover:bg-yellow-700 transition-colors shadow-sm shadow-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingAddendum ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" /> Salvando...
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-2" /> Salvar Adendo
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

