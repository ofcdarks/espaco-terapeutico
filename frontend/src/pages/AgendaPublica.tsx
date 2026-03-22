import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/common";
import { CalendarClock, AlertTriangle, Check, Globe, MessageCircle, Clock, Palette } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

export default function AgendaPublica() {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [config, setConfig] = useState({ slug: '', whatsapp: '', minDays: 3, maxDays: 90, welcomeMsg: 'Bem-vindo! Escolha um horário disponível para nossa conversa.', instructions: 'Após escolher o horário, você será direcionado para o WhatsApp para confirmar o agendamento.' });
  const [tab, setTab] = useState('config');

  const publicUrl = `${window.location.origin}/agendar/${config.slug || 'minha-agenda'}`;

  const save = async () => {
    try { await authApi.updateProfile({ clinicSlug: config.slug, publicBookingEnabled: active } as any); toast.success("Configurações salvas!"); }
    catch { toast.error("Erro ao salvar"); }
  };

  const tabs = [
    { id: 'config', label: 'Configurações', icon: CalendarClock },
    { id: 'horarios', label: 'Horários', icon: Clock },
    { id: 'aparencia', label: 'Aparência', icon: Palette },
  ];

  return (
    <MainLayout>
      <PageHeader title="Página de Agendamento Público" subtitle="Configure sua página para que pacientes agendem consultas diretamente" />

      <div className={`glass-card p-4 mb-6 flex items-start gap-3 ${active ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'}`}>
        <CalendarClock size={18} className={active ? 'text-emerald-600' : 'text-amber-600'} />
        <div className="flex-1">
          <p className="text-sm font-medium">{active ? 'Página Ativa' : 'Página Desativada'}</p>
          <p className="text-xs text-surface-500">{active ? 'Pacientes podem agendar consultas diretamente' : 'Ative a página pública abaixo para começar a receber agendamentos'}</p>
        </div>
        <button onClick={() => setActive(!active)} className={`h-8 px-4 rounded-lg text-xs font-medium flex items-center gap-1.5 ${active ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' : 'bg-emerald-600 text-white'}`}>
          {active ? 'Desativar' : <><Check size={12} /> Ativar página pública</>}
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-brand-600 text-white dark:bg-brand-300 dark:text-brand-900' : 'text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-850'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><MessageCircle size={14} /> Informações de Contato</h3>
            <p className="text-xs text-surface-500 mb-4">Configure WhatsApp e URL pública personalizada</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Número do WhatsApp *</label>
                <input value={config.whatsapp} onChange={e => setConfig(c => ({ ...c, whatsapp: e.target.value }))} className="input-premium w-full" placeholder="(14) 99999-9999" /></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">URL Personalizada *</label>
                <input value={config.slug} onChange={e => setConfig(c => ({ ...c, slug: e.target.value }))} className="input-premium w-full" placeholder="dr-rudy" />
                <p className="text-[10px] text-surface-400 mt-1">Use letras minúsculas, números e hífens</p></div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Clock size={14} /> Janela de Agendamento</h3>
            <p className="text-xs text-surface-500 mb-4">Configure o período em que pacientes podem agendar consultas</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Antecedência Mínima (dias)</label>
                <input type="number" value={config.minDays} onChange={e => setConfig(c => ({ ...c, minDays: +e.target.value }))} className="input-premium w-full" /></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Antecedência Máxima (dias)</label>
                <input type="number" value={config.maxDays} onChange={e => setConfig(c => ({ ...c, maxDays: +e.target.value }))} className="input-premium w-full" /></div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-1">Mensagens Personalizadas</h3>
            <p className="text-xs text-surface-500 mb-4">Customize as mensagens que seus pacientes verão</p>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Mensagem de Boas-Vindas</label>
                <textarea value={config.welcomeMsg} onChange={e => setConfig(c => ({ ...c, welcomeMsg: e.target.value }))} className="input-premium w-full h-20 py-2 resize-none" /></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Instruções de Agendamento</label>
                <textarea value={config.instructions} onChange={e => setConfig(c => ({ ...c, instructions: e.target.value }))} className="input-premium w-full h-20 py-2 resize-none" /></div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={save} className="btn-primary flex items-center gap-2"><Check size={14} /> Salvar Configurações</button>
          </div>
        </div>
      )}

      {tab === 'horarios' && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Horários Disponíveis</h3>
          <p className="text-xs text-surface-500">Configure os horários da sua agenda em Configurações → Agenda. Os horários livres aparecerão automaticamente na página pública.</p>
        </div>
      )}

      {tab === 'aparencia' && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Personalização Visual</h3>
          <p className="text-xs text-surface-500">A página pública usa automaticamente as cores da sua marca configuradas no sistema.</p>
        </div>
      )}
    </MainLayout>
  );
}
