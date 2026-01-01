'use client';

import { useAuth } from '@/hooks/use-auth';
import { Calendar, Users, DollarSign, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DashboardPage() {
  const { user } = useAuth();

  const stats = [
    { label: 'Consultas Hoje', value: '12', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', change: '+20%', positive: true },
    { label: 'Novos Pacientes', value: '4', icon: Users, color: 'text-green-600', bg: 'bg-green-50', change: '+10%', positive: true },
    { label: 'Faturamento (Mês)', value: 'R$ 15.400', icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', change: '-5%', positive: false },
  ];

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className={`flex items-center text-xs font-bold ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                {stat.positive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                {stat.change}
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Próximas Consultas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-600" />
              Próximas Consultas
            </h3>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700">Ver todas</button>
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="text-sm font-bold text-gray-400">09:00</div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Paciente de Exemplo {i}</p>
                  <p className="text-xs text-gray-500">Consulta de Rotina</p>
                </div>
                <div className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full uppercase">
                  Pendente
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Atividades Recentes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Atividades Recentes</h3>
          </div>
          <div className="p-6 text-center text-gray-400 italic">
            Nenhuma atividade registrada hoje.
          </div>
        </div>
      </div>
    </div>
  );
}
