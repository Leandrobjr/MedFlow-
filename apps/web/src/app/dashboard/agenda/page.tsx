'use client';

import React, { useState, useEffect } from 'react';
import { appointmentService, Appointment } from '@/services/appointment-service';
import { patientService, staffService, Patient, Staff } from '@/services/data-service';
import { Calendar as CalendarIcon, Plus, Clock, User, ChevronLeft, ChevronRight, Loader2, CheckCircle2, XCircle, MoreVertical, Trash2, Edit, Settings, Grid3x3, CalendarDays, List } from 'lucide-react';
import Link from 'next/link';
import { format, addDays, subDays, startOfDay, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, addWeeks, subWeeks, addMonths, subMonths, getWeek, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

type ViewType = 'day' | 'week' | 'month';

export default function AgendaPage() {
  const [view, setView] = useState<ViewType>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  
  // Form state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
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
      
      // Apenas adicionar doctorId se um profissional específico foi selecionado
      if (selectedStaffId && selectedStaffId.trim() !== '') {
        params.doctorId = selectedStaffId;
      }
      
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

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, view, selectedStaffId]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const validateAppointment = (): boolean => {
    if (!formData.patientId) {
      toast.error('Selecione um paciente');
      return false;
    }
    if (!formData.doctorId) {
      toast.error('Selecione um médico');
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
    setFormData({ patientId: '', doctorId: '', startTime: '', endTime: '', notes: '' });
  };

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
    
    // Debug temporário
    if (process.env.NODE_ENV === 'development') {
      console.log('[Agenda Diária] Debug:', {
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        totalAppointments: appointments.length,
        dayAppointmentsCount: dayAppointments.length,
        appointmentsDates: appointments.map(apt => ({
          patient: apt.patient.name,
          date: format(new Date(apt.startTime), 'yyyy-MM-dd'),
          time: format(new Date(apt.startTime), 'HH:mm'),
        })),
      });
    }
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
            <p>Carregando consultas...</p>
          </div>
        ) : dayAppointments.length === 0 ? (
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
                        apt.status === 'PENDING' || apt.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                        apt.status === 'CANCELED' || apt.status === 'canceled' ? 'bg-red-100 text-red-700' :
                        apt.status === 'COMPLETED' || apt.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {apt.status === 'scheduled' ? 'AGENDADO' :
                         apt.status === 'confirmed' ? 'CONFIRMADO' :
                         apt.status === 'canceled' ? 'CANCELADO' :
                         apt.status === 'completed' ? 'REALIZADO' :
                         apt.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(apt.status === 'PENDING' || apt.status === 'scheduled') && (
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

                      return (
                        <div
                          key={day.toISOString()}
                          className="p-1 border-r border-gray-100 last:border-r-0 min-h-[60px]"
                        >
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

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[100px] p-2 border border-gray-200 rounded-lg cursor-pointer transition-colors ${
                      !isCurrentMonth ? 'bg-gray-50 opacity-50' : 'bg-white hover:bg-gray-50'
                    } ${isCurrentDay ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => {
                      setSelectedDate(day);
                      setView('day');
                    }}
                  >
                    <div className={`text-sm font-semibold mb-1 ${
                      isCurrentDay ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {format(day, 'd')}
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

          {/* Filtro por Profissional */}
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
                    onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Selecione um médico</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
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
    </div>
  );
}
