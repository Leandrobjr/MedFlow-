'use client';

import React, { useState, useEffect } from 'react';
import { staffService, Staff } from '@/services/data-service';
import { scheduleService, ScheduleConfig, DayPeriod, ScheduleBlock } from '@/services/schedule-service';
import { Settings, Loader2, Save, ArrowLeft, CheckCircle2, Clock, Plus, Trash2, AlertCircle, Calendar, X, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

type TabType = 'config' | 'blocks';

export default function ConfiguracaoAgendaPage() {
  const [activeTab, setActiveTab] = useState<TabType>('config');
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

  // Bloqueios
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [blockFormData, setBlockFormData] = useState({
    blockType: 'date' as 'date' | 'period',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    reason: '',
    isRecurring: false,
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

  const fetchBlocks = async (staffId: string) => {
    if (!staffId) return;
    
    setLoadingBlocks(true);
    try {
      // Buscar bloqueios dos próximos 90 dias
      const startDate = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const data = await scheduleService.getBlocksByStaff(staffId, startDate, endDate);
      setBlocks(data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error('Erro ao carregar bloqueios');
      }
    } finally {
      setLoadingBlocks(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (selectedStaffId) {
      fetchConfig(selectedStaffId);
      fetchBlocks(selectedStaffId);
    } else {
      setCurrentConfig(null);
      setBlocks([]);
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
        for (const period of periods[dayKey]) {
          const error = validatePeriod(period);
          if (error) {
            toast.error(`${day.label}: ${error}`);
            return false;
          }
        }

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
      // Montar weeklySchedule - apenas incluir dias habilitados com períodos
      const weeklySchedule: any = {};
      
      if (formData.monday) {
        weeklySchedule.monday = {
          enabled: true,
          periods: periods.monday.length > 0 ? periods.monday : [],
        };
      }
      if (formData.tuesday) {
        weeklySchedule.tuesday = {
          enabled: true,
          periods: periods.tuesday.length > 0 ? periods.tuesday : [],
        };
      }
      if (formData.wednesday) {
        weeklySchedule.wednesday = {
          enabled: true,
          periods: periods.wednesday.length > 0 ? periods.wednesday : [],
        };
      }
      if (formData.thursday) {
        weeklySchedule.thursday = {
          enabled: true,
          periods: periods.thursday.length > 0 ? periods.thursday : [],
        };
      }
      if (formData.friday) {
        weeklySchedule.friday = {
          enabled: true,
          periods: periods.friday.length > 0 ? periods.friday : [],
        };
      }
      if (formData.saturday) {
        weeklySchedule.saturday = {
          enabled: true,
          periods: periods.saturday.length > 0 ? periods.saturday : [],
        };
      }
      if (formData.sunday) {
        weeklySchedule.sunday = {
          enabled: true,
          periods: periods.sunday.length > 0 ? periods.sunday : [],
        };
      }

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

  // ========== Bloqueios ==========
  const openBlockModal = (block?: ScheduleBlock) => {
    if (block) {
      setEditingBlock(block);
      // Converter datas para formato de input (YYYY-MM-DD)
      const startDateStr = typeof block.startDate === 'string' 
        ? block.startDate.split('T')[0] 
        : format(new Date(block.startDate), 'yyyy-MM-dd');
      const endDateStr = block.endDate 
        ? (typeof block.endDate === 'string' 
            ? block.endDate.split('T')[0] 
            : format(new Date(block.endDate), 'yyyy-MM-dd'))
        : '';
      
      setBlockFormData({
        blockType: block.blockType,
        startDate: startDateStr,
        endDate: endDateStr,
        startTime: block.startTime || '',
        endTime: block.endTime || '',
        reason: block.reason || '',
        isRecurring: block.isRecurring || false,
      });
    } else {
      setEditingBlock(null);
      setBlockFormData({
        blockType: 'date',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        startTime: '',
        endTime: '',
        reason: '',
        isRecurring: false,
      });
    }
    setIsBlockModalOpen(true);
  };

  const closeBlockModal = () => {
    setIsBlockModalOpen(false);
    setEditingBlock(null);
    setBlockFormData({
      blockType: 'date',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      reason: '',
      isRecurring: false,
    });
  };

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStaffId) {
      toast.error('Selecione um profissional');
      return;
    }

    if (!blockFormData.startDate) {
      toast.error('Data de início é obrigatória');
      return;
    }

    if (blockFormData.blockType === 'period') {
      if (!blockFormData.startTime || !blockFormData.endTime) {
        toast.error('Horários são obrigatórios para bloqueios de período');
        return;
      }

      const startMinutes = blockFormData.startTime.split(':').map(Number).reduce((h, m) => h * 60 + m);
      const endMinutes = blockFormData.endTime.split(':').map(Number).reduce((h, m) => h * 60 + m);
      
      if (startMinutes >= endMinutes) {
        toast.error('Horário de início deve ser anterior ao horário de término');
        return;
      }
    }

    try {
      if (editingBlock) {
        await scheduleService.updateBlock(editingBlock.id, {
          blockType: blockFormData.blockType,
          startDate: blockFormData.startDate,
          endDate: blockFormData.endDate || undefined,
          startTime: blockFormData.blockType === 'period' ? blockFormData.startTime : undefined,
          endTime: blockFormData.blockType === 'period' ? blockFormData.endTime : undefined,
          reason: blockFormData.reason || undefined,
          isRecurring: blockFormData.isRecurring,
        });
        toast.success('Bloqueio atualizado com sucesso!');
      } else {
        await scheduleService.createBlock({
          staffId: selectedStaffId,
          blockType: blockFormData.blockType,
          startDate: blockFormData.startDate,
          endDate: blockFormData.endDate || undefined,
          startTime: blockFormData.blockType === 'period' ? blockFormData.startTime : undefined,
          endTime: blockFormData.blockType === 'period' ? blockFormData.endTime : undefined,
          reason: blockFormData.reason || undefined,
          isRecurring: blockFormData.isRecurring,
        });
        toast.success('Bloqueio criado com sucesso!');
      }

      closeBlockModal();
      await fetchBlocks(selectedStaffId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar bloqueio');
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Tem certeza que deseja excluir este bloqueio?')) {
      return;
    }

    try {
      await scheduleService.deleteBlock(blockId);
      toast.success('Bloqueio excluído com sucesso!');
      await fetchBlocks(selectedStaffId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir bloqueio');
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

      {/* Seleção de Profissional */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
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
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'config'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Settings className="h-4 w-4 inline mr-2" />
                Configuração
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('blocks')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'blocks'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Calendar className="h-4 w-4 inline mr-2" />
                Bloqueios
              </button>
            </div>

            {/* Tab Content: Configuração */}
            {activeTab === 'config' && (
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
              </form>
            )}

            {/* Tab Content: Bloqueios */}
            {activeTab === 'blocks' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Bloqueios de Agenda</h3>
                  <button
                    type="button"
                    onClick={() => openBlockModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Novo Bloqueio
                  </button>
                </div>

                {loadingBlocks ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : blocks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Nenhum bloqueio cadastrado</p>
                    <p className="text-xs mt-1">Clique em "Novo Bloqueio" para adicionar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blocks.map((block) => (
                      <div
                        key={block.id}
                        className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {format(
                                typeof block.startDate === 'string' ? new Date(block.startDate) : new Date(block.startDate),
                                "dd 'de' MMMM 'de' yyyy",
                                { locale: ptBR }
                              )}
                            </span>
                            {block.endDate && (
                              (typeof block.endDate === 'string' ? block.endDate : format(new Date(block.endDate), 'yyyy-MM-dd')) !==
                              (typeof block.startDate === 'string' ? block.startDate.split('T')[0] : format(new Date(block.startDate), 'yyyy-MM-dd'))
                            ) && (
                              <>
                                <span className="text-gray-400">até</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {format(
                                    typeof block.endDate === 'string' ? new Date(block.endDate) : new Date(block.endDate),
                                    "dd 'de' MMMM 'de' yyyy",
                                    { locale: ptBR }
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                          {block.blockType === 'period' && block.startTime && block.endTime && (
                            <p className="text-xs text-gray-600 mt-1">
                              Período: {block.startTime} às {block.endTime}
                            </p>
                          )}
                          {block.reason && (
                            <p className="text-xs text-gray-600 mt-1">Motivo: {block.reason}</p>
                          )}
                          {block.isRecurring && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded">
                              Recorrente
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openBlockModal(block)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar bloqueio"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(block.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Excluir bloqueio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!selectedStaffId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          <p>Selecione um profissional para começar a configurar a agenda</p>
        </div>
      )}

      {/* Modal de Bloqueio */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingBlock ? 'Editar Bloqueio' : 'Novo Bloqueio'}
              </h3>
              <button
                type="button"
                onClick={closeBlockModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBlockSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Bloqueio <span className="text-red-500">*</span>
                </label>
                <select
                  value={blockFormData.blockType}
                  onChange={(e) => setBlockFormData({ ...blockFormData, blockType: e.target.value as 'date' | 'period' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="date">Dia Inteiro</option>
                  <option value="period">Período Específico</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Início <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={blockFormData.startDate}
                  onChange={(e) => setBlockFormData({ ...blockFormData, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Término (opcional)
                </label>
                <input
                  type="date"
                  value={blockFormData.endDate}
                  onChange={(e) => setBlockFormData({ ...blockFormData, endDate: e.target.value })}
                  min={blockFormData.startDate}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Deixe em branco para bloquear apenas um dia</p>
              </div>

              {blockFormData.blockType === 'period' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Horário de Início <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={blockFormData.startTime}
                      onChange={(e) => setBlockFormData({ ...blockFormData, startTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={blockFormData.blockType === 'period'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Horário de Término <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={blockFormData.endTime}
                      onChange={(e) => setBlockFormData({ ...blockFormData, endTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={blockFormData.blockType === 'period'}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo (opcional)
                </label>
                <input
                  type="text"
                  value={blockFormData.reason}
                  onChange={(e) => setBlockFormData({ ...blockFormData, reason: e.target.value })}
                  placeholder="Ex: Feriado, Congresso, Férias..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={blockFormData.isRecurring}
                  onChange={(e) => setBlockFormData({ ...blockFormData, isRecurring: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isRecurring" className="ml-2 text-sm text-gray-700">
                  Bloqueio recorrente
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeBlockModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingBlock ? 'Atualizar' : 'Criar'} Bloqueio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
