'use client';

import React, { useState, useEffect } from 'react';
import { staffService, Staff } from '@/services/data-service';
import { scheduleService, ScheduleConfig, DayPeriod } from '@/services/schedule-service';
import { Settings, Loader2, Save, ArrowLeft, CheckCircle2, Clock, Plus, Trash2, AlertCircle } from 'lucide-react';
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

type DayKey = typeof DAYS_OF_WEEK[number]['key'];

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

  // Períodos por dia
  const [periods, setPeriods] = useState<Record<DayKey, DayPeriod[]>>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const data = await staffService.getAll();
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

        // Carregar períodos
        const loadedPeriods: Record<DayKey, DayPeriod[]> = {
          monday: config.weeklySchedule?.monday?.periods || [],
          tuesday: config.weeklySchedule?.tuesday?.periods || [],
          wednesday: config.weeklySchedule?.wednesday?.periods || [],
          thursday: config.weeklySchedule?.thursday?.periods || [],
          friday: config.weeklySchedule?.friday?.periods || [],
          saturday: config.weeklySchedule?.saturday?.periods || [],
          sunday: config.weeklySchedule?.sunday?.periods || [],
        };
        setPeriods(loadedPeriods);
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
        setPeriods({
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        });
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error('Erro ao carregar configuração');
      } else {
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
      setPeriods({
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      });
    }
  }, [selectedStaffId]);

  // Validar se dois períodos se sobrepõem
  const periodsOverlap = (period1: DayPeriod, period2: DayPeriod): boolean => {
    const timeToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const start1 = timeToMinutes(period1.start);
    const end1 = timeToMinutes(period1.end);
    const start2 = timeToMinutes(period2.start);
    const end2 = timeToMinutes(period2.end);

    return !(end1 <= start2 || end2 <= start1);
  };

  // Validar um período individual
  const validatePeriod = (period: DayPeriod): string | null => {
    const timeToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const start = timeToMinutes(period.start);
    const end = timeToMinutes(period.end);

    if (start >= end) {
      return 'Horário de início deve ser anterior ao horário de término';
    }

    return null;
  };

  const addPeriod = (day: DayKey) => {
    const newPeriod: DayPeriod = { start: '08:00', end: '12:00' };
    setPeriods({
      ...periods,
      [day]: [...periods[day], newPeriod],
    });
  };

  const removePeriod = (day: DayKey, index: number) => {
    setPeriods({
      ...periods,
      [day]: periods[day].filter((_, i) => i !== index),
    });
  };

  const updatePeriod = (day: DayKey, index: number, field: 'start' | 'end', value: string) => {
    const updated = [...periods[day]];
    updated[index] = { ...updated[index], [field]: value };
    setPeriods({
      ...periods,
      [day]: updated,
    });
  };

  const validateAllPeriods = (): boolean => {
    for (const day of DAYS_OF_WEEK) {
      const dayKey = day.key as DayKey;
      if (formData[dayKey] && periods[dayKey].length > 0) {
        // Validar cada período individual
        for (const period of periods[dayKey]) {
          const error = validatePeriod(period);
          if (error) {
            toast.error(`${day.label}: ${error}`);
            return false;
          }
        }

        // Validar sobreposições
        for (let i = 0; i < periods[dayKey].length; i++) {
          for (let j = i + 1; j < periods[dayKey].length; j++) {
            if (periodsOverlap(periods[dayKey][i], periods[dayKey][j])) {
              toast.error(`${day.label}: Períodos não podem se sobrepor`);
              return false;
            }
          }
        }
      }
    }
    return true;
  };

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

    // Validar que dias habilitados tenham pelo menos um período
    for (const day of DAYS_OF_WEEK) {
      const dayKey = day.key as DayKey;
      if (formData[dayKey] && periods[dayKey].length === 0) {
        toast.error(`${day.label}: Adicione pelo menos um período de disponibilidade`);
        return;
      }
    }

    if (!validateAllPeriods()) {
      return;
    }

    setSaving(true);
    try {
      // Montar weeklySchedule com períodos
      const weeklySchedule = {
        monday: {
          enabled: formData.monday,
          periods: formData.monday ? periods.monday : [],
        },
        tuesday: {
          enabled: formData.tuesday,
          periods: formData.tuesday ? periods.tuesday : [],
        },
        wednesday: {
          enabled: formData.wednesday,
          periods: formData.wednesday ? periods.wednesday : [],
        },
        thursday: {
          enabled: formData.thursday,
          periods: formData.thursday ? periods.thursday : [],
        },
        friday: {
          enabled: formData.friday,
          periods: formData.friday ? periods.friday : [],
        },
        saturday: {
          enabled: formData.saturday,
          periods: formData.saturday ? periods.saturday : [],
        },
        sunday: {
          enabled: formData.sunday,
          periods: formData.sunday ? periods.sunday : [],
        },
      };

      if (currentConfig) {
        await scheduleService.updateConfig(selectedStaffId, {
          defaultDuration: formData.defaultDuration,
          weeklySchedule,
          isActive: true,
        });
        toast.success('Configuração atualizada com sucesso!');
      } else {
        await scheduleService.createConfig({
          staffId: selectedStaffId,
          defaultDuration: formData.defaultDuration,
          weeklySchedule,
          isActive: true,
        });
        toast.success('Configuração criada com sucesso!');
      }

      await fetchConfig(selectedStaffId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
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
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Seleção de Profissional */}
        <div>
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
                <div>
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

                {/* Dias da Semana com Períodos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Dias de Atendimento e Períodos de Disponibilidade <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-4">
                    {DAYS_OF_WEEK.map((day) => {
                      const dayKey = day.key as DayKey;
                      const isEnabled = formData[dayKey];
                      const dayPeriods = periods[dayKey];

                      return (
                        <div
                          key={day.key}
                          className={`border rounded-lg p-4 transition-colors ${
                            isEnabled ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    [dayKey]: e.target.checked,
                                  });
                                  // Se desmarcar, limpar períodos
                                  if (!e.target.checked) {
                                    setPeriods({
                                      ...periods,
                                      [dayKey]: [],
                                    });
                                  }
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-3 text-sm font-medium text-gray-700">{day.label}</span>
                            </label>
                            {isEnabled && (
                              <button
                                type="button"
                                onClick={() => addPeriod(dayKey)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                                Adicionar Período
                              </button>
                            )}
                          </div>

                          {isEnabled && (
                            <div className="space-y-2 mt-3">
                              {dayPeriods.length === 0 ? (
                                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                                  <p className="text-xs text-yellow-800">
                                    Adicione pelo menos um período de disponibilidade para este dia
                                  </p>
                                </div>
                              ) : (
                                dayPeriods.map((period, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <label className="text-xs text-gray-600">De:</label>
                                      <input
                                        type="time"
                                        value={period.start}
                                        onChange={(e) => updatePeriod(dayKey, index, 'start', e.target.value)}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                      <label className="text-xs text-gray-600">Até:</label>
                                      <input
                                        type="time"
                                        value={period.end}
                                        onChange={(e) => updatePeriod(dayKey, index, 'end', e.target.value)}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removePeriod(dayKey, index)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Remover período"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

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
