import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Modal } from "@/components/common";
import { CalendarClock, Check, Clock, Trash2, Plus, Globe, MessageCircle, Palette, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' });
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function AgendaPublica() {
  const [config, setConfig] = useState<any>({ isEnabled: false, slug: '', whatsapp: '', minAdvanceDays: 1, maxAdvanceDays: 30, welcomeMessage: 'Escolha um horário disponível.', confirmationType: 'whatsapp' });
  const [avail, setAvail] = useState<any[]>([]);
  const [tab, setTab] = useState('config');
  const [showAdd, setShowAdd] = useState(false);
  const [newSlot, setNewSlot] = useState({ dayOfWeek: 1, startTime: '08:00', endTime: '18:00', slotDuration: 50 });

  const loadData = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([
        fetch(`${API}/api/scheduling/config`, { headers: auth() }).then(r => r.json()),
        fetch(`${API}/api/scheduling/availability`, { headers: auth() }).then(r => r.json()),
      ]);
      setConfig({ isEnabled: !!c.is_enabled, slug: c.slug || '', whatsapp: c.whatsapp || '', minAdvanceDays: c.min_advance_days || 1, maxAdvanceDays: c.max_advance_days || 30, welcomeMessage: c.welcome_message || '', confirmationType: c.confirmation_type || 'whatsapp' });
      setAvail(Array.isArray(a) ? a : []);
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveConfig = async () => {
    await fetch(`${API}/api/scheduling/config`, { method: 'POST', headers: auth(), body: JSON.stringify(config) });
    toast.success("Configurações salvas!");
  };

  const addSlot = async () => {
    await fetch(`${API}/api/scheduling/availability`, { method: 'POST', headers: auth(), body: JSON.stringify(newSlot) });
    setShowAdd(false); toast.success("Horário adicionado!"); loadData();
  };

  const removeSlot = async (id: string) => {
    await fetch(`${API}/api/scheduling/availability/${id}`, { method: 'DELETE', headers: auth() });
    toast.success("Horário removido"); loadData();
  };

  const publicUrl = config.slug ? `${window.location.origin}/agendar/${config.slug}` : '';
  const copyUrl = () => { if (publicUrl) { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); } };

  const tabs = [
    { id: 'config', label: 'Configurações', icon: CalendarClock },
    { id: 'horarios', label: 'Horários', icon: Clock },
    { id: 'aparencia', label: 'Aparência', icon: Palette },
  ];

  return (
    <MainLayout>
      <PageHeader title="Agendamento Online" subtitle="Configure sua agenda para pacientes agendarem automaticamente" />

      <div className={`glass-card p-4 mb-6 flex items-start gap-3 ${config.isEnabled ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'}`}>
        <CalendarClock size={18} className={config.isEnabled ? 'text-emerald-600' : 'text-amber-600'} />
        <div className="flex-1">
          <p className="text-sm font-medium">{config.isEnabled ? 'Agenda Online Ativa' : 'Agenda Desativada'}</p>
          <p className="text-xs text-surface-500">{config.isEnabled ? 'Pacientes podem agendar consultas diretamente' : 'Ative para começar a receber agendamentos online'}</p>
          {config.isEnabled && publicUrl && (
            <div className="flex items-center gap-2 mt-2">
              <code className="text-xs bg-white/50 dark:bg-white/5 px-2 py-1 rounded">{publicUrl}</code>
              <button onClick={copyUrl} className="text-brand-600 dark:text-brand-300"><Copy size={12} /></button>
            </div>
          )}
        </div>
        <button onClick={() => { setConfig((c: any) => ({ ...c, isEnabled: !c.isEnabled })); setTimeout(saveConfig, 100); }}
          className={`h-8 px-4 rounded-lg text-xs font-medium ${config.isEnabled ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' : 'bg-emerald-600 text-white'}`}>
          {config.isEnabled ? 'Desativar' : <><Check size={12} /> Ativar</>}
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-850'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><MessageCircle size={14} /> Informações</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">URL Personalizada *</label>
                <input value={config.slug} onChange={e => setConfig((c: any) => ({ ...c, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} className="input-premium w-full" placeholder="dr-rudy" /></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">WhatsApp</label>
                <input value={config.whatsapp} onChange={e => setConfig((c: any) => ({ ...c, whatsapp: e.target.value }))} className="input-premium w-full" placeholder="(14) 99999-9999" /></div>
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock size={14} /> Janela de Agendamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Antecedência Mínima (dias)</label>
                <input type="number" value={config.minAdvanceDays} onChange={e => setConfig((c: any) => ({ ...c, minAdvanceDays: +e.target.value }))} className="input-premium w-full" /></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Antecedência Máxima (dias)</label>
                <input type="number" value={config.maxAdvanceDays} onChange={e => setConfig((c: any) => ({ ...c, maxAdvanceDays: +e.target.value }))} className="input-premium w-full" /></div>
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Mensagem de Boas-Vindas</h3>
            <textarea value={config.welcomeMessage} onChange={e => setConfig((c: any) => ({ ...c, welcomeMessage: e.target.value }))} className="input-premium w-full h-20 py-2 resize-none" />
          </div>
          <div className="flex justify-end"><button onClick={saveConfig} className="btn-primary flex items-center gap-2"><Check size={14} /> Salvar</button></div>
        </div>
      )}

      {tab === 'horarios' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Horários Disponíveis</h3>
            <button onClick={() => setShowAdd(true)} className="btn-primary h-8 text-xs flex items-center gap-1.5"><Plus size={12} /> Adicionar Horário</button>
          </div>

          {avail.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Clock size={32} className="mx-auto mb-3 text-surface-300" />
              <p className="text-sm font-medium mb-1">Nenhum horário configurado</p>
              <p className="text-xs text-surface-500 mb-4">Adicione os dias e horários que você atende</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary h-8 text-xs">Adicionar Horário</button>
            </div>
          ) : (
            <div className="grid gap-3">
              {DAYS.map((day, dow) => {
                const slots = avail.filter((a: any) => a.day_of_week === dow);
                if (slots.length === 0) return null;
                return (
                  <div key={dow} className="glass-card p-4">
                    <h4 className="text-sm font-semibold mb-2">{day}</h4>
                    <div className="space-y-1.5">
                      {slots.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-50 dark:bg-surface-850">
                          <span className="text-sm">{s.start_time} — {s.end_time} <span className="text-xs text-surface-500">({s.slot_duration}min)</span></span>
                          <button onClick={() => removeSlot(s.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 w-7 h-7 rounded-lg flex items-center justify-center"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Adicionar Horário" size="sm">
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Dia da Semana</label>
                <select value={newSlot.dayOfWeek} onChange={e => setNewSlot(s => ({ ...s, dayOfWeek: +e.target.value }))} className="input-premium w-full">
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-surface-500 mb-1 block">Início</label>
                  <input type="time" value={newSlot.startTime} onChange={e => setNewSlot(s => ({ ...s, startTime: e.target.value }))} className="input-premium w-full" /></div>
                <div><label className="text-xs font-medium text-surface-500 mb-1 block">Fim</label>
                  <input type="time" value={newSlot.endTime} onChange={e => setNewSlot(s => ({ ...s, endTime: e.target.value }))} className="input-premium w-full" /></div>
              </div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Duração da consulta (min)</label>
                <input type="number" value={newSlot.slotDuration} onChange={e => setNewSlot(s => ({ ...s, slotDuration: +e.target.value }))} className="input-premium w-full" /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancelar</button>
                <button onClick={addSlot} className="btn-primary">Adicionar</button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {tab === 'aparencia' && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Personalização Visual</h3>
          <p className="text-xs text-surface-500">A página usa as cores do Espaço Terapêutico automaticamente.</p>
          {publicUrl && <a href={publicUrl} target="_blank" rel="noopener" className="btn-primary h-8 text-xs flex items-center gap-1.5 mt-4 w-fit"><ExternalLink size={12} /> Ver Página Pública</a>}
        </div>
      )}
    </MainLayout>
  );
}
