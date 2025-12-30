'use client';

import React, { useState, useEffect } from 'react';
import { appointmentService, Appointment } from '@/services/appointment-service';
import { patientService, staffService, Patient, Staff } from '@/services/data-service';
import { Calendar as CalendarIcon, Plus, Clock, User, ChevronLeft, ChevronRight, Loader2, CheckCircle2, XCircle, MoreVertical, Trash2, Edit } from 'lucide-react';
import { format, addDays, subDays, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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
      const data = await appointmentService.getAll({ 
        date: format(selectedDate, 'yyyy-MM-dd') 
      });
      setAppointments(data);
    } catch (error) {
      toast.error('Erro ao carregar agenda');
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
  }, [selectedDate]);

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
    
    // Validar se horário de fim é depois do início
    const start = new Date(`2000-01-01T${formData.startTime}`);
    const end = new Date(`2000-01-01T${formData.endTime}`);
    if (end <= start) {
      toast.error('Horário de término deve ser depois do horário de início');
      return false;
    }
    
    // Verificar conflito local (mesmo médico, mesmo horário)
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const newStart = new Date(`${dateStr}T${formData.startTime}:00`);
    const newEnd = new Date(`${dateStr}T${formData.endTime}:00`);
    
    const hasConflict = appointments.some(apt => {
      if (apt.doctorId !== formData.doctorId) return false;
      if (apt.status === 'CANCELED') return false;
      
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
      // Ajustar data selecionada no formData e converter doctorId para staffId
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const payload = {
        patientId: formData.patientId,
        staffId: formData.doctorId, // Backend espera staffId
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda Médica</h1>
          <p className="text-gray-600">Gerencie os horários e consultas da clínica.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-100"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Agendamento
        </button>
      </div>

      {/* Date Selector */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-semibold">
            <CalendarIcon className="h-4 w-4" />
            <span className="capitalize">
              {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
          </div>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <button
          onClick={() => setSelectedDate(new Date())}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Ir para Hoje
        </button>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
            <p>Carregando consultas...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400 text-center">
            <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-gray-500">Nenhuma consulta para este dia</p>
            <p className="text-sm">Clique em "Novo Agendamento" para começar.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {appointments.map((apt) => (
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
                      Dr(a). {apt.doctor.name}
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

