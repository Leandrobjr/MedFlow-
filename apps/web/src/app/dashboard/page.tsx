'use client';

import { useAuth } from '@/hooks/use-auth';
import { appointmentService, Appointment } from '@/services/appointment-service';
import { patientService } from '@/services/data-service';
import { Calendar, Clock, MessageSquare, Play, X, Loader2, FileText } from 'lucide-react';
import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  const fetchAppointments = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Buscar consultas do dia
      const data = await appointmentService.getAll({ date: today });
      setAppointments(data);
      setAppointmentsCount(data.length);
    } catch (error) {
      console.error('Erro ao carregar consultas:', error);
      toast.error('Erro ao carregar consultas do dia');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAppointment = async (appointmentId: string) => {
    setUpdatingStatus(appointmentId);
    try {
      // 1. Atualizar status para in_progress
      await appointmentService.updateStatus(appointmentId, 'in_progress');
      
      // 2. Buscar appointment para obter patientId
      const appointment = await appointmentService.getById(appointmentId);
      
      // 3. Redirecionar para PEP com patientId e appointmentId
      router.push(`/dashboard/pep?patientId=${appointment.patientId}&appointmentId=${appointmentId}`);
      
      toast.success('Atendimento iniciado!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao iniciar atendimento');
      setUpdatingStatus(null);
    }
  };

  const handleContinueAppointment = async (appointmentId: string) => {
    try {
      // Buscar appointment para obter patientId
      const appointment = await appointmentService.getById(appointmentId);
      
      // Redirecionar para PEP com patientId e appointmentId
      router.push(`/dashboard/pep?patientId=${appointment.patientId}&appointmentId=${appointmentId}`);
      
      toast.success('Retornando ao atendimento...');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao acessar atendimento');
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm('Tem certeza que deseja cancelar este atendimento?')) {
      return;
    }

    setUpdatingStatus(appointmentId);
    try {
      await appointmentService.updateStatus(appointmentId, 'cancelled');
      toast.success('Atendimento cancelado!');
      fetchAppointments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao cancelar atendimento');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    const statusMap: Record<string, { label: string; bg: string; text: string }> = {
      scheduled: { label: 'AGENDADO', bg: 'bg-blue-50', text: 'text-blue-700' },
      confirmed: { label: 'AGUARDANDO', bg: 'bg-green-50', text: 'text-green-700' },
      in_progress: { label: 'EM ATENDIMENTO', bg: 'bg-yellow-50', text: 'text-yellow-700' },
      completed: { label: 'FINALIZADO', bg: 'bg-gray-50', text: 'text-gray-700' },
      cancelled: { label: 'Cancelado', bg: 'bg-red-50', text: 'text-red-700' },
      canceled: { label: 'Cancelado', bg: 'bg-red-50', text: 'text-red-700' },
    };

    const statusInfo = statusMap[statusLower] || { label: status, bg: 'bg-gray-50', text: 'text-gray-700' };
    
    return (
      <div className={`px-3 py-1 ${statusInfo.bg} ${statusInfo.text} text-[10px] font-bold rounded-full uppercase`}>
        {statusInfo.label}
      </div>
    );
  };

  const getAppointmentType = (appointment: Appointment) => {
    // Usar campo type se existir, senão usar default
    const type = appointment.type || 'Consulta de Rotina';
    // Capitalizar primeira letra
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-gray-900">
          Olá, {user?.name?.split(' ')[0] || 'Doutor(a)'}!
        </h2>
        <p className="text-gray-600">
          Hoje é {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Consultas Hoje */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-blue-50">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500">Consultas Hoje</p>
          {loading ? (
            <div className="flex items-center mt-2">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <p className="text-2xl font-bold text-gray-900 mt-1">{appointmentsCount}</p>
          )}
        </div>

        {/* Espaço para CHAT (futuro) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md border-dashed">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-purple-50">
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500">Chat</p>
          <p className="text-sm text-gray-400 mt-1 italic">Em breve</p>
        </div>
      </div>

      {/* Próximas Consultas - Estendido até o final */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Próximas Consultas
          </h3>
          <button 
            onClick={() => router.push('/dashboard/agenda')}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Ver todas
          </button>
        </div>
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Carregando consultas...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="p-8 text-center text-gray-400 italic">
              Nenhuma consulta agendada para hoje.
            </div>
          ) : (
            appointments.map((appointment) => {
              const startTime = parseISO(appointment.startTime);
              const statusLower = appointment.status.toLowerCase();
              // Apenas DOCTOR pode iniciar atendimento
              const isDoctor = user?.role === 'doctor' || user?.role === 'DOCTOR';
              const canStart = isDoctor && statusLower === 'confirmed';
              const canContinue = isDoctor && statusLower === 'in_progress';
              const canCancel = statusLower !== 'completed' && statusLower !== 'cancelled' && statusLower !== 'canceled';

              return (
                <div key={appointment.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="text-sm font-bold text-gray-400 min-w-[60px]">
                      {format(startTime, 'HH:mm')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {appointment.patient?.name || 'Paciente'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {getAppointmentType(appointment)}
                      </p>
                      {appointment.staff && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {appointment.staff.name}
                          {appointment.staff.specialty && ` - ${appointment.staff.specialty}`}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {getStatusBadge(appointment.status)}
                        {canStart && (
                          <button
                            onClick={() => handleStartAppointment(appointment.id)}
                            disabled={updatingStatus === appointment.id}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {updatingStatus === appointment.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            ) : (
                              <Play className="h-3 w-3 mr-1.5" />
                            )}
                            Iniciar Atendimento
                          </button>
                        )}
                        {canContinue && (
                          <button
                            onClick={() => handleContinueAppointment(appointment.id)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors"
                          >
                            <FileText className="h-3 w-3 mr-1.5" />
                            Continuar Atendimento
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => handleCancelAppointment(appointment.id)}
                            disabled={updatingStatus === appointment.id}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {updatingStatus === appointment.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            ) : (
                              <X className="h-3 w-3 mr-1.5" />
                            )}
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
