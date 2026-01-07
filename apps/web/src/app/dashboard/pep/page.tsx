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
    anamnesis: '',
    physicalExam: '',
    diagnosis: '',
    prescription: '',
    conduct: '',
  });
  const [addendumText, setAddendumText] = useState('');
  const [savingAddendum, setSavingAddendum] = useState(false);

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
        setSelectedPatient(patient);
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
            } else {
              // Se não existir prontuário, apenas mostrar mensagem
              // O profissional pode criar manualmente se necessário
              toast('Prontuário ainda não foi criado. Você pode criar um novo prontuário para este atendimento.', {
                icon: 'ℹ️',
              });
            }
          }
        });
      }
    }
  }, [searchParams, patients]);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    fetchRecords(patient.id);
    setViewMode('timeline');
  };

  const handleOpenRecord = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setFormData({
      anamnesis: record.anamnesis || '',
      physicalExam: record.physicalExam || '',
      diagnosis: record.diagnosis || '',
      prescription: record.prescription || '',
      conduct: record.conduct || '',
    });
    setViewMode('editor');
  };

  const handleSaveRecord = async () => {
    if (!selectedRecord) return;
    
    if (selectedRecord.isFinalized) {
      toast.error('Este prontuário já foi finalizado e não pode ser editado. Use Adendos para correções.');
      return;
    }
    
    try {
      // Atualizar e obter o registro atualizado
      const updatedRecord = await pepService.update(selectedRecord.id, formData);
      
      // Atualizar selectedRecord com os dados retornados
      setSelectedRecord(updatedRecord);
      
      // Atualizar formData com os dados salvos
      setFormData({
        anamnesis: updatedRecord.anamnesis || '',
        physicalExam: updatedRecord.physicalExam || '',
        diagnosis: updatedRecord.diagnosis || '',
        prescription: updatedRecord.prescription || '',
        conduct: updatedRecord.conduct || '',
      });
      
      // Atualizar lista de registros
      await fetchRecords(selectedPatient!.id);
      
      toast.success('Prontuário salvo com sucesso!');
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao salvar prontuário';
      toast.error(message);
    }
  };

  const handleFinalizeRecord = async () => {
    if (!selectedRecord) return;
    
    if (selectedRecord.isFinalized) {
      toast.error('Este prontuário já está finalizado.');
      return;
    }
    
    // Validar campos obrigatórios antes de finalizar
    if (!formData.diagnosis || !formData.diagnosis.trim()) {
      toast.error('É necessário preencher o diagnóstico antes de finalizar o prontuário.');
      return;
    }
    
    if (!confirm('Deseja realmente finalizar este prontuário? Após finalizado, ele não poderá mais ser editado (apenas adendos poderão ser feitos).')) {
      return;
    }
    
    try {
      await pepService.finalize(selectedRecord.id);
      toast.success('Prontuário finalizado e assinado!');
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
      
      // Abrir o prontuário no editor
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
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-2">Anamnese</h3>
              <textarea
                disabled={isLocked}
                value={formData.anamnesis}
                onChange={(e) => setFormData({...formData, anamnesis: e.target.value})}
                placeholder="História da doença atual, sintomas, histórico familiar..."
                className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-70 text-sm"
              />
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-2">Exame Físico</h3>
              <textarea
                disabled={isLocked}
                value={formData.physicalExam}
                onChange={(e) => setFormData({...formData, physicalExam: e.target.value})}
                placeholder="Sinais vitais, observações do exame físico..."
                className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-70 text-sm"
              />
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-2">Hipótese Diagnóstica / CID</h3>
                <textarea
                  disabled={isLocked}
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({...formData, diagnosis: e.target.value})}
                  className="w-full h-24 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-70 text-sm"
                />
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-2">Prescrição</h3>
                <textarea
                  disabled={isLocked}
                  value={formData.prescription}
                  onChange={(e) => setFormData({...formData, prescription: e.target.value})}
                  placeholder="Medicamentos, dosagens, orientações..."
                  className="w-full h-24 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-70 text-sm"
                />
              </section>
            </div>

            <section className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-2">Conduta</h3>
              <textarea
                disabled={isLocked}
                value={formData.conduct}
                onChange={(e) => setFormData({...formData, conduct: e.target.value})}
                placeholder="Encaminhamentos, exames solicitados, retorno..."
                className="w-full h-24 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-70 text-sm"
              />
            </section>

            {/* Seção de Informações do Paciente */}
            <section className="space-y-4 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Informações do Paciente</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Alergias
                </label>
                <textarea
                  value={selectedPatient?.allergies || ''}
                  onChange={(e) => {
                    if (!selectedPatient) return;
                    // Atualizar apenas o estado local para permitir digitação fluida
                    setSelectedPatient({ ...selectedPatient, allergies: e.target.value });
                  }}
                  onBlur={async (e) => {
                    if (!selectedPatient) return;
                    const newValue = e.target.value;
                    // Só salvar se o valor mudou
                    if (newValue !== (selectedPatient.allergies || '')) {
                      try {
                        await patientService.update(selectedPatient.id, { allergies: newValue });
                        toast.success('Alergias atualizadas!');
                      } catch (error: any) {
                        toast.error('Erro ao atualizar alergias');
                        // Reverter para o valor anterior em caso de erro
                        setSelectedPatient({ ...selectedPatient, allergies: selectedPatient.allergies || '' });
                      }
                    }
                  }}
                  placeholder="Informe as alergias do paciente..."
                  className="w-full h-20 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medicamentos Contínuos
                </label>
                <textarea
                  value={selectedPatient?.medications || ''}
                  onChange={(e) => {
                    if (!selectedPatient) return;
                    // Atualizar apenas o estado local para permitir digitação fluida
                    setSelectedPatient({ ...selectedPatient, medications: e.target.value });
                  }}
                  onBlur={async (e) => {
                    if (!selectedPatient) return;
                    const newValue = e.target.value;
                    // Só salvar se o valor mudou
                    if (newValue !== (selectedPatient.medications || '')) {
                      try {
                        await patientService.update(selectedPatient.id, { medications: newValue });
                        toast.success('Medicamentos atualizados!');
                      } catch (error: any) {
                        toast.error('Erro ao atualizar medicamentos');
                        // Reverter para o valor anterior em caso de erro
                        setSelectedPatient({ ...selectedPatient, medications: selectedPatient.medications || '' });
                      }
                    }
                  }}
                  placeholder="Informe os medicamentos contínuos do paciente..."
                  className="w-full h-20 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                />
              </div>
            </section>

            {!isLocked && (
              <div className="pt-6 flex gap-4">
                <button
                  onClick={handleSaveRecord}
                  className="flex-1 px-6 py-3 border border-blue-600 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors"
                >
                  Salvar Rascunho
                </button>
                <button
                  onClick={handleFinalizeRecord}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                >
                  Finalizar e Assinar
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

