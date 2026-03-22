import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, EmptyState } from "@/components/common";
import { MessageSquare, Plus, Filter, RefreshCw, AlertTriangle, Mail } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function MensagensAgendadas() {
  const [filter, setFilter] = useState('todos');
  const location = useLocation();
  const isEmail = location.pathname.includes('email');
  const icon = isEmail ? Mail : MessageSquare;
  const title = isEmail ? 'Agendamentos de E-mail' : 'Agendamentos de Mensagens';
  const subtitle = isEmail ? 'Gerencie seus envios agendados por e-mail' : 'Gerencie seus envios agendados do WhatsApp';

  const filters = ['Todos', 'Pendente', 'Enviado', 'Falhou', 'Cancelado'];

  return (
    <MainLayout>
      <PageHeader title={title} subtitle={subtitle} action={{ label: "Novo Agendamento", onClick: () => {} }} />

      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs text-surface-500 flex items-center gap-1"><Filter size={12} /> Filtros:</span>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f.toLowerCase())}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.toLowerCase() ? 'bg-brand-600 text-white dark:bg-brand-300 dark:text-brand-900' : 'text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-850'}`}>
            {f}
          </button>
        ))}
        <button className="ml-auto text-xs text-surface-500 flex items-center gap-1 hover:text-brand-600"><RefreshCw size={12} /> Atualizar</button>
      </div>

      {!isEmail && (
        <div className="glass-card p-4 mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Nenhum WhatsApp Conectado</p>
            <p className="text-xs text-red-700 dark:text-red-400/70">Configure seu WhatsApp em Configurações para enviar lembretes automáticos.</p>
          </div>
        </div>
      )}

      <EmptyState icon={icon} title="Nenhum agendamento encontrado"
        description={`Comece criando seu primeiro agendamento de ${isEmail ? 'e-mail' : 'mensagem'}`}
        action={{ label: "Criar Agendamento", onClick: () => {} }} />
    </MainLayout>
  );
}
