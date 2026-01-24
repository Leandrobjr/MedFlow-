'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { appointmentService, Appointment } from '@/services/appointment-service';
import { patientService, staffService, Patient, Staff, Procedure } from '@/services/data-service';
import { scheduleService, ScheduleConfig, ScheduleBlock } from '@/services/schedule-service';
import { financeService } from '@/services/finance-service';
import { calculateDayAvailability, calculatePeriodAvailability, DayAvailability } from '@/lib/availability-utils';
import { useAuth } from '@/hooks/use-auth';
import { Calendar as CalendarIcon, Plus, Clock, User, ChevronLeft, ChevronRight, Loader2, CheckCircle2, XCircle, MoreVertical, Trash2, Edit, Settings, Grid3x3, CalendarDays, List, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { format, addDays, subDays, startOfDay, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, addWeeks, subWeeks, addMonths, subMonths, getWeek, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

type ViewType = 'day' | 'week' | 'month';

export default function AgendaPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isReceptionist = user?.role === 'receptionist';
  // Recepcionista e Admin podem ver todas as agendas disponíveis
  const canViewAllSchedules = isAdmin || isReceptionist;
  const userStaffId = user?.staffId || null;
  
  const [view, setView] = useState<ViewType>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  
  // Billing modal state
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [selectedAppointmentForBilling, setSelectedAppointmentForBilling] = useState<Appointment | null>(null);
  const [billingData, setBillingData] = useState({
    amount: '',
    method: 'Dinheiro',
    description: '',
  });
  const [billingInfo, setBillingInfo] = useState<{
    procedureName?: string;
    suggestedAmount?: number;
  } | null>(null);
  const [loadingBillingData, setLoadingBillingData] = useState(false);
  const [processingBilling, setProcessingBilling] = useState(false);
  
  // Availability data
  const [scheduleConfigs, setScheduleConfigs] = useState<ScheduleConfig[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [dayAvailability, setDayAvailability] = useState<DayAvailability[]>([]);
  const [periodAvailability, setPeriodAvailability] = useState<Map<string, DayAvailability[]>>(new Map());
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  
  // Form state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [availableProcedures, setAvailableProcedures] = useState<Procedure[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    procedureId: '',
    startTime: '',
    endTime: '',
    notes: '',
  });

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      
      if (view === 'day') {
        // Para visualização diária, usar date (backend já filtra por dia)
        params.date = format(selectedDate, 'yyyy-MM-dd');
      } else if (view === 'week') {
        const weekStart = startOfWeek(selectedDate, { locale: ptBR });
        const weekEnd = endOfWeek(selectedDate, { locale: ptBR });
        params.startDate = format(weekStart, 'yyyy-MM-dd');
        params.endDate = format(weekEnd, 'yyyy-MM-dd');
      } else if (view === 'month') {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        params.startDate = format(monthStart, 'yyyy-MM-dd');
        params.endDate = format(monthEnd, 'yyyy-MM-dd');
      }
      
      // RECEPTIONIST vê todos os agendamentos (não passa doctorId)
      // DOCTOR vê apenas seus próprios agendamentos
      // ADMIN pode filtrar por profissional específico ou ver todos
      const isReceptionist = user?.role === 'receptionist';
      
      if (isReceptionist) {
        // Recepcionista vê todos os agendamentos, não filtra por doctorId
        // Não passa doctorId nos params
      } else if (!isAdmin && userStaffId) {
        // Profissional (DOCTOR) vê apenas suas próprias agendas
        params.doctorId = userStaffId;
      } else if (isAdmin && selectedStaffId && selectedStaffId.trim() !== '') {
        // Admin pode filtrar por profissional específico
        params.doctorId = selectedStaffId;
      }
      // Se for admin e não tiver selecionado nenhum profissional, não passa doctorId (vê todos)
      
      const data = await appointmentService.getAll(params);
      setAppointments(data || []);
    } catch (error) {
      console.error('Erro ao carregar agenda:', error);
      toast.error('Erro ao carregar agenda');
      setAppointments([]);
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

  const fetchScheduleConfigs = async () => {
    try {
      // Buscar configurações: todos os profissionais se admin/recepcionista, apenas do usuário se não
      const configs: ScheduleConfig[] = [];
      const doctorsToFetch = canViewAllSchedules ? doctors : (userStaffId ? doctors.filter(d => d.id === userStaffId) : []);
      
      for (const doctor of doctorsToFetch) {
        try {
          const config = await scheduleService.getConfigByStaff(doctor.id);
          if (config) {
            configs.push(config);
          }
        } catch (error: any) {
          // Ignorar erro 404 (profissional sem configuração)
          if (error.response?.status !== 404) {
            console.error(`Erro ao buscar config para ${doctor.id}:`, error);
          }
        }
      }
      
      setScheduleConfigs(configs);
    } catch (error) {
      console.error('Erro ao carregar configurações de agenda:', error);
    }
  };

  const fetchScheduleBlocks = async () => {
    try {
      // Buscar bloqueios para o período atual
      let startDate: string;
      let endDate: string;

      if (view === 'day') {
        startDate = format(selectedDate, 'yyyy-MM-dd');
        endDate = format(selectedDate, 'yyyy-MM-dd');
      } else if (view === 'week') {
        const weekStart = startOfWeek(selectedDate, { locale: ptBR });
        const weekEnd = endOfWeek(selectedDate, { locale: ptBR });
        startDate = format(weekStart, 'yyyy-MM-dd');
        endDate = format(weekEnd, 'yyyy-MM-dd');
      } else {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        startDate = format(monthStart, 'yyyy-MM-dd');
        endDate = format(monthEnd, 'yyyy-MM-dd');
      }

      const allBlocks: ScheduleBlock[] = [];
      
      // Buscar bloqueios: todos os profissionais se admin/recepcionista, apenas do usuário se não
      const doctorsToFetch = canViewAllSchedules ? doctors : (userStaffId ? doctors.filter(d => d.id === userStaffId) : []);
      
      for (const doctor of doctorsToFetch) {
        try {
          const blocks = await scheduleService.getBlocksByStaff(doctor.id, startDate, endDate);
          allBlocks.push(...blocks);
        } catch (error: any) {
          if (error.response?.status !== 404) {
            console.error(`Erro ao buscar bloqueios para ${doctor.id}:`, error);
          }
        }
      }
      
      setScheduleBlocks(allBlocks);
    } catch (error) {
      console.error('Erro ao carregar bloqueios:', error);
    }
  };

  // Calcular disponibilidade usando useMemo para evitar recalcular desnecessariamente
  const calculatedDayAvailability = useMemo(() => {
    if (view !== 'day' || scheduleConfigs.length === 0) {
      return [];
    }

    return calculateDayAvailability(
      selectedDate,
      scheduleConfigs,
      scheduleBlocks,
      appointments
    );
  }, [view, selectedDate, scheduleConfigs, scheduleBlocks, appointments]);

  const calculatedPeriodAvailability = useMemo(() => {
    if (view === 'day' || scheduleConfigs.length === 0) {
      return new Map<string, DayAvailability[]>();
    }

    let startDate: Date;
    let endDate: Date;

    if (view === 'week') {
      startDate = startOfWeek(selectedDate, { locale: ptBR });
      endDate = endOfWeek(selectedDate, { locale: ptBR });
    } else {
      startDate = startOfMonth(selectedDate);
      endDate = endOfMonth(selectedDate);
    }

    return calculatePeriodAvailability(
      startDate,
      endDate,
      scheduleConfigs,
      scheduleBlocks,
      appointments
    );
  }, [view, selectedDate, scheduleConfigs, scheduleBlocks, appointments]);

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, view, selectedStaffId, isAdmin, userStaffId]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (doctors.length > 0) {
      fetchScheduleConfigs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctors, canViewAllSchedules, userStaffId]);

  useEffect(() => {
    if (doctors.length > 0) {
      fetchScheduleBlocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctors, selectedDate, view, canViewAllSchedules, userStaffId]);

  useEffect(() => {
    setDayAvailability(calculatedDayAvailability);
  }, [calculatedDayAvailability]);

  useEffect(() => {
    setPeriodAvailability(calculatedPeriodAvailability);
  }, [calculatedPeriodAvailability]);

  const validateAppointment = (): boolean => {
    if (!formData.patientId) {
      toast.error('Selecione um paciente');
      return false;
    }
    if (!formData.doctorId) {
      toast.error('Selecione um médico');
      return false;
    }

    if (!formData.procedureId) {
      toast.error('Selecione um procedimento');
      return false;
    }
    if (!formData.startTime || !formData.endTime) {
      toast.error('Preencha os horários de início e fim');
      return false;
    }
    
    const start = new Date(`2000-01-01T${formData.startTime}`);
    const end = new Date(`2000-01-01T${formData.endTime}`);
    if (end <= start) {
      toast.error('Horário de término deve ser depois do horário de início');
      return false;
    }
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const newStart = new Date(`${dateStr}T${formData.startTime}:00`);
    const newEnd = new Date(`${dateStr}T${formData.endTime}:00`);
    
    // Validar se o horário não é vencido (anterior ao horário atual)
    const now = new Date();
    if (newStart < now) {
      toast.error('Não é possível agendar horários no passado');
      return false;
    }
    
    // Validar se o horário está dentro dos slots disponíveis configurados
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const dayAvail = periodAvailability.get(dateKey) || [];
    const doctorSlots = dayAvail
      .filter(avail => avail.staffId === formData.doctorId)
      .flatMap(avail => avail.slots);
    
    const isWithinAvailableSlot = doctorSlots.some(slot => {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);
      // Verificar se o horário escolhido está dentro de algum slot disponível
      return newStart >= slotStart && newEnd <= slotEnd;
    });
    
    if (!isWithinAvailableSlot && doctorSlots.length > 0) {
      toast.error('O horário escolhido não está dentro dos horários configurados para este profissional. Selecione um horário disponível.');
      return false;
    }
    
    const hasConflict = appointments.some(apt => {
      if (apt.doctorId !== formData.doctorId) return false;
      if (apt.status === 'CANCELED' || apt.status === 'canceled') return false;
      
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      
      return (newStart < aptEnd && newEnd > aptStart);
    });
    
    if (hasConflict) {
      toast.error('Já existe uma consulta agendada neste horário para este médico');
      return false;
    }
    
    return true;
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAppointment()) {
      return;
    }
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const payload = {
        patientId: formData.patientId,
        staffId: formData.doctorId,
        procedureId: formData.procedureId,
        startTime: new Date(`${dateStr}T${formData.startTime}:00`).toISOString(),
        endTime: new Date(`${dateStr}T${formData.endTime}:00`).toISOString(),
        observations: formData.notes || undefined,
      };
      
      await appointmentService.create(payload);
      toast.success('Consulta agendada com sucesso!');
      setIsModalOpen(false);
      resetForm();
      fetchAppointments();
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Erro ao agendar consulta';
      if (message.toLowerCase().includes('conflito') || message.toLowerCase().includes('ocupado')) {
        toast.error('Horário já está ocupado. Escolha outro horário.');
      } else {
        toast.error(message);
      }
    }
  };

  const resetForm = () => {
    setFormData({ patientId: '', doctorId: '', procedureId: '', startTime: '', endTime: '', notes: '' });
    setAvailableProcedures([]);
  };

  // Buscar procedimentos quando médico for selecionado
  useEffect(() => {
    const fetchProcedures = async () => {
      if (!formData.doctorId) {
        setAvailableProcedures([]);
        setFormData(prev => ({ ...prev, procedureId: '' }));
        return;
      }

      setLoadingProcedures(true);
      try {
        const procedures = await staffService.getProcedures(formData.doctorId);
        setAvailableProcedures(procedures);
        
        // Se houver apenas um procedimento, selecionar automaticamente
        if (procedures.length === 1) {
          setFormData(prev => ({ ...prev, procedureId: procedures[0].id }));
        } else {
          setFormData(prev => ({ ...prev, procedureId: '' }));
        }
      } catch (error: any) {
        console.error('Erro ao buscar procedimentos:', error);
        toast.error('Erro ao carregar procedimentos do profissional');
        setAvailableProcedures([]);
      } finally {
        setLoadingProcedures(false);
      }
    };

    fetchProcedures();
  }, [formData.doctorId]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      if (status === 'CANCELED' && !confirm('Tem certeza que deseja cancelar esta consulta?')) {
        return;
      }
      
      await appointmentService.updateStatus(id, status);
      toast.success('Status atualizado!');
      fetchAppointments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao atualizar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      await appointmentService.delete(id);
      toast.success('Agendamento excluído com sucesso!');
      fetchAppointments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir agendamento');
    }
  };

  const handleOpenBillingModal = async (appointment: Appointment) => {
    setSelectedAppointmentForBilling(appointment);
    setBillingModalOpen(true);
    setLoadingBillingData(true);
    
    try {
      const data = await financeService.checkAppointmentBilling(appointment.id);
      
      if (data.alreadyBilled) {
        toast.error('Este agendamento já foi faturado.');
        setBillingModalOpen(false);
        return;
      }

      // Salvar informações do procedimento
      const procedureName = data.appointment?.procedureName || data.appointment?.type || 'Consulta';
      setBillingInfo({
        procedureName: procedureName,
        suggestedAmount: data.suggestedAmount || null,
      });

      // Pré-preencher valor se disponível (formato brasileiro com vírgula)
      if (data.suggestedAmount) {
        // Formatar com 2 decimais e vírgula
        const formattedAmount = Number(data.suggestedAmount).toFixed(2).replace('.', ',');
        setBillingData(prev => ({
          ...prev,
          amount: formattedAmount,
        }));
      } else {
        // Limpar valor se não houver sugestão
        setBillingData(prev => ({
          ...prev,
          amount: '',
        }));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao carregar dados do agendamento');
      console.error(error);
    } finally {
      setLoadingBillingData(false);
    }
  };

  const handleProcessBilling = async () => {
    if (!selectedAppointmentForBilling) return;

    // Verificar se o agendamento está cancelado
    if (selectedAppointmentForBilling.status === 'CANCELED' || selectedAppointmentForBilling.status === 'canceled') {
      toast.error('Não é possível faturar um agendamento cancelado.');
      return;
    }

    // Converter vírgula para ponto para cálculo
    const numericAmount = Number(billingData.amount.replace(',', '.'));
    if (!billingData.amount || isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Valor inválido');
      return;
    }

    setProcessingBilling(true);
    try {
      // Criar descrição automática se não fornecida
      const patientName = selectedAppointmentForBilling.patient?.name || 'Paciente';
      const procedureName = billingInfo?.procedureName || selectedAppointmentForBilling.type || 'Consulta';
      const autoDescription = billingData.description || `${procedureName} - ${patientName}`;

      console.log('Criando transação com descrição:', autoDescription);
      const result = await financeService.createTransaction({
        type: 'INCOME',
        category: procedureName,
        amount: numericAmount,
        method: billingData.method,
        description: autoDescription,
        appointmentId: selectedAppointmentForBilling.id,
        patientId: selectedAppointmentForBilling.patientId,
        staffId: selectedAppointmentForBilling.staffId,
      });
      console.log('Transação criada:', result);

      toast.success('Faturamento realizado com sucesso!');
      setBillingModalOpen(false);
      setBillingData({ amount: '', method: 'Dinheiro', description: '' });
      setBillingInfo(null);
      setSelectedAppointmentForBilling(null);
      fetchAppointments(); // Recarregar lista
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao processar faturamento';
      toast.error(message);
    } finally {
      setProcessingBilling(false);
    }
  };

  const getAppointmentsForDate = (date: Date): Appointment[] => {
    // Filtrar agendamentos do array já carregado (que pode estar filtrado por profissional)
    const filtered = appointments.filter(apt => {
      const aptDate = new Date(apt.startTime);
      // Normalizar ambas as datas para comparar apenas dia/mês/ano (ignorar hora)
      const dateStr = format(date, 'yyyy-MM-dd');
      const aptDateStr = format(aptDate, 'yyyy-MM-dd');
      return dateStr === aptDateStr;
    });
    
    return filtered;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (view === 'day') {
      setSelectedDate(direction === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1));
    } else if (view === 'week') {
      setSelectedDate(direction === 'prev' ? subWeeks(selectedDate, 1) : addWeeks(selectedDate, 1));
    } else if (view === 'month') {
      setSelectedDate(direction === 'prev' ? subMonths(selectedDate, 1) : addMonths(selectedDate, 1));
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Renderização da visualização diária
  const renderDayView = () => {
    const dayAppointments = getAppointmentsForDate(selectedDate);
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
            <p>Carregando consultas...</p>
          </div>
        ) : dayAppointments.length === 0 && dayAvailability.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400 text-center">
            <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-gray-500">Nenhuma consulta para este dia</p>
            <p className="text-sm">Clique em "Novo Agendamento" para começar.</p>
            {appointments.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Total carregado: {appointments.length} | Data: {format(selectedDate, 'dd/MM/yyyy')}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Agendamentos existentes */}
            {dayAppointments.length > 0 && (
            <div className="divide-y divide-gray-100">
              {dayAppointments
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map((apt) => (
                <div key={apt.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                  <div className="min-w-[80px] text-center">
                    <p className="text-sm font-bold text-gray-900">
                      {format(new Date(apt.startTime), 'HH:mm')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(apt.endTime), 'HH:mm')}
                    </p>
                  </div>
                  
                  <div className="h-10 w-1 px-0.5 bg-blue-500 rounded-full"></div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{apt.patient.name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs flex items-center text-gray-500">
                        <User className="h-3 w-3 mr-1" />
                        Dr(a). {apt.doctor?.name || apt.staff?.name || 'N/A'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        apt.status === 'CONFIRMED' || apt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        apt.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                        apt.status === 'CANCELED' || apt.status === 'canceled' || apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        apt.status === 'COMPLETED' || apt.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        apt.status === 'IN_PROGRESS' || apt.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                        apt.status === 'NOSHOW' ? 'bg-gray-100 text-gray-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {apt.status === 'scheduled' ? 'AGENDADO' :
                         apt.status === 'confirmed' || apt.status === 'CONFIRMED' ? 'CONFIRMADO' :
                         apt.status === 'canceled' || apt.status === 'CANCELED' || apt.status === 'cancelled' ? 'CANCELADO' :
                         apt.status === 'completed' || apt.status === 'COMPLETED' ? 'REALIZADO' :
                         apt.status === 'in_progress' || apt.status === 'IN_PROGRESS' ? 'EM ATENDIMENTO' :
                         apt.status === 'NOSHOW' ? 'NÃO COMPARECEU' :
                         apt.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(user?.role === 'admin' || user?.role === 'owner' || user?.role === 'receptionist') && 
                     apt.status !== 'cancelled' && apt.status !== 'canceled' && apt.status !== 'completed' && (
                      <button
                        onClick={() => handleOpenBillingModal(apt)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Faturar"
                      >
                        <DollarSign className="h-5 w-5" />
                      </button>
                    )}
                    {apt.status === 'scheduled' && (
                      <button
                        onClick={() => updateStatus(apt.id, 'confirmed')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Confirmar"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                    )}
                    {apt.status !== 'CANCELED' && apt.status !== 'canceled' && apt.status !== 'COMPLETED' && apt.status !== 'completed' && (
                      <button
                        onClick={() => updateStatus(apt.id, 'canceled')}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Cancelar"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    )}
                    {(apt.status === 'CONFIRMED' || apt.status === 'confirmed') && (
                      <button
                        onClick={() => updateStatus(apt.id, 'completed')}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Marcar como Realizado"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(apt.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Horários Disponíveis */}
            {dayAvailability.length > 0 && (
              <div className={dayAppointments.length > 0 ? "border-t border-gray-200 bg-gray-50" : "bg-gray-50"}>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Horários Disponíveis
                  </h3>
                  <div className="space-y-4">
                    {dayAvailability.map((avail) => {
                      const doctor = doctors.find(d => d.id === avail.staffId);
                      if (!doctor) return null;

                      return (
                        <div key={avail.staffId} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-900">
                              Dr(a). {doctor.name}
                              {doctor.specialty && <span className="text-gray-500 ml-1">- {doctor.specialty}</span>}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {avail.slots.map((slot, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    doctorId: avail.staffId,
                                    startTime: format(new Date(slot.start), 'HH:mm'),
                                    endTime: format(new Date(slot.end), 'HH:mm'),
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                                title={`Clique para agendar às ${format(new Date(slot.start), 'HH:mm')}`}
                              >
                                {format(new Date(slot.start), 'HH:mm')}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Renderização da visualização semanal
  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { locale: ptBR });
    const weekEnd = endOfWeek(selectedDate, { locale: ptBR });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8h às 19h

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
            <p>Carregando consultas...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Header com dias da semana */}
              <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
                <div className="p-3 text-sm font-medium text-gray-700 border-r border-gray-200">
                  Hora
                </div>
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`p-3 text-center border-r border-gray-200 last:border-r-0 ${
                      isToday(day) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="text-xs font-medium text-gray-500 uppercase">
                      {format(day, 'EEE', { locale: ptBR })}
                    </div>
                    <div className={`text-lg font-bold mt-1 ${
                      isToday(day) ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid de horários */}
              <div className="divide-y divide-gray-100">
                {hours.map((hour) => (
                  <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
                    <div className="p-2 text-xs text-gray-500 border-r border-gray-200 text-center">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    {weekDays.map((day) => {
                      const dayAppointments = getAppointmentsForDate(day).filter(apt => {
                        const aptHour = new Date(apt.startTime).getHours();
                        return aptHour === hour;
                      });

                      const dateKey = format(day, 'yyyy-MM-dd');
                      const dayAvail = periodAvailability.get(dateKey) || [];
                      const availableSlotsAtHour = dayAvail.flatMap(avail => 
                        avail.slots.filter(slot => new Date(slot.start).getHours() === hour)
                      );

                      // Buscar bloqueios para este dia e hora
                      const dayBlocks = scheduleBlocks.filter(block => {
                        // Se não for admin/recepcionista, mostrar apenas blocos do próprio profissional
                        if (!canViewAllSchedules && userStaffId && block.staffId !== userStaffId) return false;
                        // Se for admin/recepcionista e tiver filtro selecionado, aplicar filtro
                        if (canViewAllSchedules && selectedStaffId && selectedStaffId !== '' && block.staffId !== selectedStaffId) return false;
                        
                        // Parsear data do bloqueio sem timezone (YYYY-MM-DD)
                        const blockStartStr = typeof block.startDate === 'string' ? block.startDate.split('T')[0] : format(new Date(block.startDate), 'yyyy-MM-dd');
                        const blockEndStr = block.endDate 
                          ? (typeof block.endDate === 'string' ? block.endDate.split('T')[0] : format(new Date(block.endDate), 'yyyy-MM-dd'))
                          : blockStartStr;
                        
                        const currentDayStr = format(day, 'yyyy-MM-dd');
                        
                        const isInsideRange = currentDayStr >= blockStartStr && currentDayStr <= blockEndStr;
                        if (!isInsideRange) return false;

                        if (block.blockType === 'date') return true;

                        if (block.blockType === 'period' && block.startTime && block.endTime) {
                          const [blockH] = block.startTime.split(':').map(Number);
                          return blockH === hour;
                        }
                        return false;
                      });

                      return (
                        <div
                          key={day.toISOString()}
                          className="p-1 border-r border-gray-100 last:border-r-0 min-h-[60px]"
                        >
                          {dayBlocks.map((block) => (
                            <div
                              key={block.id}
                              className="mb-1 p-2 bg-red-100 border border-red-200 rounded text-[10px] font-bold text-red-700 uppercase"
                              title={`BLOQUEIO: ${block.reason || 'Indisponível'}`}
                            >
                              Bloqueado
                            </div>
                          ))}

                          {dayAppointments.map((apt) => (
                            <div
                              key={apt.id}
                              className="mb-1 p-2 bg-blue-50 border border-blue-200 rounded text-xs cursor-pointer hover:bg-blue-100 transition-colors"
                              title={`${apt.patient.name} - ${format(new Date(apt.startTime), 'HH:mm')} | Dr(a). ${apt.doctor?.name || apt.staff?.name || 'N/A'}`}
                            >
                              <div className="font-semibold text-blue-900 truncate">
                                {apt.patient.name}
                              </div>
                              <div className="text-blue-700 text-[10px]">
                                {format(new Date(apt.startTime), 'HH:mm')}
                              </div>
                            </div>
                          ))}
                          
                          {dayAppointments.length === 0 && availableSlotsAtHour.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {availableSlotsAtHour.slice(0, 2).map((slot, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setSelectedDate(day);
                                    setFormData({
                                      ...formData,
                                      doctorId: slot.staffId,
                                      startTime: format(new Date(slot.start), 'HH:mm'),
                                      endTime: format(new Date(slot.end), 'HH:mm'),
                                    });
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1 bg-green-50 border border-green-100 text-[9px] text-green-700 rounded hover:bg-green-100 transition-colors w-full text-left truncate"
                                  title={`Livre: ${format(new Date(slot.start), 'HH:mm')} - Dr(a). ${doctors.find(d => d.id === slot.staffId)?.name}`}
                                >
                                  {format(new Date(slot.start), 'HH:mm')} Livre
                                </button>
                              ))}
                              {availableSlotsAtHour.length > 2 && (
                                <div className="text-[8px] text-green-600 font-medium pl-1">
                                  +{availableSlotsAtHour.length - 2} horários
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderização da visualização mensal
  const renderMonthView = () => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const startDate = startOfWeek(monthStart, { locale: ptBR });
    const endDate = endOfWeek(monthEnd, { locale: ptBR });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
            <p>Carregando consultas...</p>
          </div>
        ) : (
          <div className="p-4">
            {/* Header dos dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div key={day} className="p-2 text-center text-xs font-semibold text-gray-600 uppercase">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid do calendário */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayAppointments = getAppointmentsForDate(day);
                const isCurrentMonth = isSameMonth(day, selectedDate);
                const isCurrentDay = isToday(day);
                
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayAvail = periodAvailability.get(dateKey) || [];
                const totalAvailableSlots = dayAvail.reduce((acc, curr) => acc + curr.slots.length, 0);

                // Verificar se há bloqueio de dia inteiro
                const hasFullDayBlock = scheduleBlocks.some(block => {
                  // Se não for admin/recepcionista, mostrar apenas blocos do próprio profissional
                  if (!canViewAllSchedules && userStaffId && block.staffId !== userStaffId) return false;
                  // Se for admin/recepcionista e tiver filtro selecionado, aplicar filtro
                  if (canViewAllSchedules && selectedStaffId && selectedStaffId !== '' && block.staffId !== selectedStaffId) return false;
                  if (block.blockType !== 'date') return false;
                  
                  const blockStartStr = typeof block.startDate === 'string' ? block.startDate.split('T')[0] : format(new Date(block.startDate), 'yyyy-MM-dd');
                  const blockEndStr = block.endDate 
                    ? (typeof block.endDate === 'string' ? block.endDate.split('T')[0] : format(new Date(block.endDate), 'yyyy-MM-dd'))
                    : blockStartStr;
                  
                  const currentDayStr = format(day, 'yyyy-MM-dd');
                  return currentDayStr >= blockStartStr && currentDayStr <= blockEndStr;
                });

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[100px] p-2 border border-gray-200 rounded-lg cursor-pointer transition-colors ${
                      !isCurrentMonth ? 'bg-gray-50 opacity-50' : 'bg-white hover:bg-gray-50'
                    } ${isCurrentDay ? 'ring-2 ring-blue-500' : ''} ${hasFullDayBlock ? 'bg-red-50/50' : ''}`}
                    onClick={() => {
                      setSelectedDate(day);
                      setView('day');
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={`text-sm font-semibold ${
                        isCurrentDay ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      {hasFullDayBlock && (
                        <span className="text-[8px] px-1 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">
                          BLOQUEADO
                        </span>
                      )}
                      {totalAvailableSlots > 0 && isCurrentMonth && !hasFullDayBlock && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-bold" title={`${totalAvailableSlots} horários livres`}>
                          {totalAvailableSlots}L
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 3).map((apt) => (
                        <div
                          key={apt.id}
                          className="text-[10px] p-1 bg-blue-100 text-blue-900 rounded truncate"
                          title={`${apt.patient.name} - ${format(new Date(apt.startTime), 'HH:mm')} | Dr(a). ${apt.doctor?.name || apt.staff?.name || 'N/A'}`}
                        >
                          {format(new Date(apt.startTime), 'HH:mm')} - {apt.patient.name}
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-[10px] text-gray-500 font-medium">
                          +{dayAppointments.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getViewTitle = () => {
    if (view === 'day') {
      return format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
    } else if (view === 'week') {
      const weekStart = startOfWeek(selectedDate, { locale: ptBR });
      const weekEnd = endOfWeek(selectedDate, { locale: ptBR });
      return `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM/yyyy')}`;
    } else {
      return format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda Médica</h1>
          <p className="text-gray-600">Gerencie os horários e consultas da clínica.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/agenda/configuracao"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-sm border border-gray-200"
          >
            <Settings className="h-5 w-5 mr-2" />
            Configurar Agenda
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-100"
          >
            <Plus className="h-5 w-5 mr-2" />
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* Controles de Visualização e Filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Seletor de Visualização */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('day')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                view === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <List className="h-4 w-4" />
              Dia
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                view === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Grid3x3 className="h-4 w-4" />
              Semana
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                view === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Mês
            </button>
          </div>

          {/* Filtro por Profissional - Para Admin e Recepcionista */}
          {canViewAllSchedules && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Filtrar por:</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos os profissionais</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!canViewAllSchedules && userStaffId && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                Sua agenda
              </span>
            </div>
          )}
        </div>

        {/* Navegação de Data */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-semibold">
              <CalendarIcon className="h-4 w-4" />
              <span className="capitalize">{getViewTitle()}</span>
            </div>
            <button
              onClick={() => navigateDate('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Ir para Hoje
          </button>
        </div>
      </div>

      {/* Renderização da Visualização Selecionada */}
      {view === 'day' && renderDayView()}
      {view === 'week' && renderWeekView()}
      {view === 'month' && renderMonthView()}

      {/* Modal Novo Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Novo Agendamento</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateAppointment} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
                  <select
                    required
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Selecione um paciente</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.cpf})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Médico(a)</label>
                  <select
                    required
                    value={formData.doctorId}
                    onChange={(e) => setFormData({ ...formData, doctorId: e.target.value, procedureId: '' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Selecione um médico</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Procedimento <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.procedureId}
                    onChange={(e) => setFormData({ ...formData, procedureId: e.target.value })}
                    disabled={!formData.doctorId || loadingProcedures}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {loadingProcedures 
                        ? 'Carregando procedimentos...' 
                        : !formData.doctorId 
                        ? 'Selecione um médico primeiro' 
                        : availableProcedures.length === 0
                        ? 'Nenhum procedimento disponível'
                        : 'Selecione um procedimento'}
                    </option>
                    {availableProcedures.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.grossAmount)}
                      </option>
                    ))}
                  </select>
                  {!formData.doctorId && (
                    <p className="mt-1 text-xs text-gray-500">Selecione um médico para ver os procedimentos disponíveis</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim (Estimado)</label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações (Opcional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                    placeholder="Ex: Primeira consulta, trazer exames..."
                  />
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
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Faturamento */}
      {billingModalOpen && selectedAppointmentForBilling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Faturar Agendamento</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {format(new Date(selectedAppointmentForBilling.startTime), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <button 
                onClick={() => {
                  setBillingModalOpen(false);
                  setBillingData({ amount: '', method: 'Dinheiro', description: '' });
                  setBillingInfo(null);
                  setSelectedAppointmentForBilling(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {loadingBillingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Paciente</p>
                      <p className="font-semibold text-gray-900">{selectedAppointmentForBilling.patient?.name || 'N/A'}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Profissional</p>
                      <p className="font-semibold text-gray-900">
                        {selectedAppointmentForBilling.staff?.name || selectedAppointmentForBilling.doctor?.name || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Procedimento</p>
                      <p className="font-semibold text-gray-900">
                        {billingInfo?.procedureName || selectedAppointmentForBilling.type || 'Consulta'}
                      </p>
                      {billingInfo?.suggestedAmount && (
                        <p className="text-xs text-gray-400 mt-1">
                          Valor sugerido: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(billingInfo.suggestedAmount)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={billingData.amount}
                      onChange={(e) => {
                        // Permitir apenas números, vírgula e ponto
                        const value = e.target.value.replace(/[^\d,.-]/g, '');
                        // Converter vírgula para ponto internamente, mas exibir vírgula
                        setBillingData(prev => ({ ...prev, amount: value }));
                      }}
                      onBlur={(e) => {
                        // Converter vírgula para ponto para cálculo
                        const numericValue = e.target.value.replace(',', '.');
                        if (numericValue && !isNaN(Number(numericValue))) {
                          // Formatar com 2 decimais
                          const formatted = Number(numericValue).toFixed(2).replace('.', ',');
                          setBillingData(prev => ({ ...prev, amount: formatted }));
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="0,00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Método de Pagamento <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={billingData.method}
                      onChange={(e) => setBillingData(prev => ({ ...prev, method: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    >
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="PIX">PIX</option>
                      <option value="Transferência">Transferência</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações (opcional)
                    </label>
                    <textarea
                      value={billingData.description}
                      onChange={(e) => setBillingData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      rows={3}
                      placeholder="Observações sobre o pagamento..."
                    />
                  </div>

                </>
              )}
            </div>

            {/* Footer fixo */}
            <div className="p-6 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBillingModalOpen(false);
                  setBillingData({ amount: '', method: 'Dinheiro', description: '' });
                  setBillingInfo(null);
                  setSelectedAppointmentForBilling(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                disabled={processingBilling}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcessBilling}
                disabled={processingBilling || !billingData.amount || Number(billingData.amount.replace(',', '.')) <= 0}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingBilling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4" />
                    Confirmar Faturamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
