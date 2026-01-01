'use client';

import React, { useState, useEffect } from 'react';
import { staffService, Staff } from '@/services/data-service';
import { scheduleService, ScheduleConfig } from '@/services/schedule-service';
import { Settings, Loader2, Save, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

export default function ConfiguracaoAgendaPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [currentConfig, setCurrentConfig] = useState<ScheduleConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    defaultDuration: 30,
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      // Buscar apenas profissionais de saúde (médicos, fisioterapeutas, etc)
      const data = await staffService.getAll();
      // Filtrar apenas profissionais que podem ter agenda
      const healthProfessionals = data.filter(s => 
        ['DOCTOR', 'PHYSIOTHERAPIST', 'NUTRITIONIST', 'PSYCHOLOGIST', 'DENTIST', 'SPEECH_THERAPIST'].includes(s.role)
      );
      setStaff(healthProfessionals);
    } catch (error) {
      toast.error('Erro ao carregar profissionais');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async (staffId: string) => {
    setLoadingConfig(true);
    try {
      const config = await scheduleService.getConfigByStaff(staffId);
      if (config) {
        setCurrentConfig(config);
        setFormData({
          defaultDuration: config.defaultDuration || 30,
          monday: config.weeklySchedule?.monday?.enabled || false,
          tuesday: config.weeklySchedule?.tuesday?.enabled || false,
          wednesday: config.weeklySchedule?.wednesday?.enabled || false,
          thursday: config.weeklySchedule?.thursday?.enabled || false,
          friday: config.weeklySchedule?.friday?.enabled || false,
          saturday: config.weeklySchedule?.saturday?.enabled || false,
          sunday: config.weeklySchedule?.sunday?.enabled || false,
        });
      } else {
        // Se não existe configuração, resetar para valores padrão
        setCurrentConfig(null);
        setFormData({
          defaultDuration: 30,
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false,
        });
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error('Erro ao carregar configuração');
      } else {
        // Configuração não existe ainda, usar valores padrão
        setCurrentConfig(null);
      }
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (selectedStaffId) {
      fetchConfig(selectedStaffId);
    } else {
      setCurrentConfig(null);
      setFormData({
        defaultDuration: 30,
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
      });
    }
  }, [selectedStaffId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStaffId) {
      toast.error('Selecione um profissional');
      return;
    }

    if (formData.defaultDuration < 5 || formData.defaultDuration > 240) {
      toast.error('Duração deve estar entre 5 e 240 minutos');
      return;
    }

    const hasAnyDaySelected = DAYS_OF_WEEK.some(day => formData[day.key as keyof typeof formData]);
    if (!hasAnyDaySelected) {
      toast.error('Selecione pelo menos um dia da semana');
      return;
    }

    setSaving(true);
    try {
      // Montar weeklySchedule no formato esperado pelo backend
      const weeklySchedule = {
        monday: { enabled: formData.monday, periods: [] },
        tuesday: { enabled: formData.tuesday, periods: [] },
        wednesday: { enabled: formData.wednesday, periods: [] },
        thursday: { enabled: formData.thursday, periods: [] },
        friday: { enabled: formData.friday, periods: [] },
        saturday: { enabled: formData.saturday, periods: [] },
        sunday: { enabled: formData.sunday, periods: [] },
      };

      if (currentConfig) {
        // Atualizar configuração existente
        await scheduleService.updateConfig(selectedStaffId, {
          defaultDuration: formData.defaultDuration,
          weeklySchedule,
          isActive: true,
        });
        toast.success('Configuração atualizada com sucesso!');
      } else {
        // Criar nova configuração
        await scheduleService.createConfig({
          staffId: selectedStaffId,
          defaultDuration: formData.defaultDuration,
          weeklySchedule,
          isActive: true,
        });
        toast.success('Configuração criada com sucesso!');
      }

      // Recarregar configuração
      await fetchConfig(selectedStaffId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const selectedStaff = staff.find(s => s.id === selectedStaffId);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/agenda"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Agenda
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Settings className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuração de Agenda</h1>
            <p className="text-sm text-gray-600">Configure os horários e disponibilidade por profissional</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Seleção de Profissional */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Profissional <span className="text-red-500">*</span>
          </label>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando profissionais...</span>
            </div>
          ) : (
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Selecione um profissional</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} {member.specialty ? `- ${member.specialty}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedStaffId && (
          <>
            {loadingConfig ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                {/* Duração Padrão */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Duração Padrão das Consultas (minutos) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="240"
                    step="5"
                    value={formData.defaultDuration}
                    onChange={(e) => setFormData({ ...formData, defaultDuration: parseInt(e.target.value) || 30 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Mínimo: 5 minutos | Máximo: 240 minutos</p>
                </div>

                {/* Dias da Semana */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Dias de Atendimento <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {DAYS_OF_WEEK.map((day) => (
                      <label
                        key={day.key}
                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData[day.key as keyof typeof formData] as boolean}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [day.key]: e.target.checked,
                            })
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-700">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Info sobre períodos */}
                {currentConfig && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Configuração existente</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Esta configuração já existe. Você pode atualizá-la ou adicionar períodos de disponibilidade na próxima etapa.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botão Salvar */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <Link
                    href="/dashboard/agenda"
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </Link>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {currentConfig ? 'Atualizar' : 'Salvar'} Configuração
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {!selectedStaffId && (
          <div className="text-center py-8 text-gray-500">
            <p>Selecione um profissional para começar a configurar a agenda</p>
          </div>
        )}
      </form>
    </div>
  );
}
