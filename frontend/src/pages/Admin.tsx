import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, StatCard, Modal, ConfirmDialog, LoadingState } from "@/components/common";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";
import { Shield, Users, BarChart3, Settings, Package, Trash2, Edit, UserCheck, Crown, Brain, MessageCircle, Video, FileText, Key, Save } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "users", label: "Usuários", icon: Users },
  { id: "plans", label: "Planos", icon: Package },
  { id: "config", label: "APIs & Config", icon: Settings },
];

export default function Admin() {
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [config, setConfig] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planForm, setPlanForm] = useState({ name:"", description:"", price:0, interval:"monthly", maxPatients:-1, maxAppointmentsMonth:-1, hasAI:false, hasTelehealth:false, hasWhatsapp:false, hasTranscription:false });
  const [deleteTarget, setDeleteTarget] = useState<{type:string;id:string;name:string}|null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const refresh = async () => {
    try {
      const [s, u, p, c] = await Promise.all([
        adminApi.stats(), adminApi.listUsers(), adminApi.listPlans(), adminApi.getConfig(),
      ]);
      setStats(s); setUsers(u.data||[]); setPlans(p||[]); setConfig(c||{});
    } catch { toast.error("Erro ao carregar dados admin"); }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const saveConfigFn = async () => {
    setSavingConfig(true);
    try { await adminApi.saveConfig(config); toast.success("Configurações salvas!"); }
    catch (e:any) { toast.error(e.message); }
    setSavingConfig(false);
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) await adminApi.updatePlan(editingPlan.id, planForm);
    else await adminApi.createPlan(planForm);
    toast.success(editingPlan ? "Plano atualizado" : "Plano criado");
    setShowPlanForm(false); refresh();
  };

  const toggleAdmin = async (userId: string, current: boolean) => {
    await adminApi.updateUser(userId, { isAdmin: !current });
    toast.success("Permissão alterada"); refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "user") await adminApi.deleteUser(deleteTarget.id);
    if (deleteTarget.type === "plan") await adminApi.deletePlan(deleteTarget.id);
    toast.success("Removido"); setDeleteTarget(null); refresh();
  };

  if (loading) return <MainLayout><LoadingState /></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title="Painel Administrativo" subtitle="Gerenciamento do SaaS">
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg">
          <Shield size={14} /> Admin
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.id?"bg-white dark:bg-surface-700 shadow-sm":"text-surface-500 hover:text-foreground"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard ──────────────────────────────────────── */}
      {tab === "dashboard" && stats && (
        <div className="space-y-6 page-enter">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Profissionais" value={stats.totalUsers} color="brand" />
            <StatCard icon={Crown} label="Assinaturas Ativas" value={stats.activeSubscriptions} color="emerald" />
            <StatCard icon={Users} label="Total Pacientes" value={stats.totalPatients} color="amber" />
            <StatCard icon={FileText} label="Transcrições" value={stats.totalTranscripts} color="brand" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-5"><p className="text-xs text-surface-500">Total Consultas (plataforma)</p><p className="text-2xl font-semibold mt-1">{stats.totalAppointments}</p></div>
            <div className="glass-card p-5"><p className="text-xs text-surface-500">Receita Total (plataforma)</p><p className="text-2xl font-semibold mt-1 text-emerald-500">{formatCurrency(stats.totalRevenue)}</p></div>
          </div>
        </div>
      )}

      {/* ── Users ──────────────────────────────────────────── */}
      {tab === "users" && (
        <div className="glass-card overflow-x-auto page-enter">
          <table className="table-premium">
            <thead><tr><th>Profissional</th><th>Categoria</th><th>Pacientes</th><th>Plano</th><th>Admin</th><th className="w-10"></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><div><p className="font-medium text-sm">{u.name}</p><p className="text-xs text-surface-500">{u.email}</p></div></td>
                  <td className="text-sm capitalize">{u.category}</td>
                  <td className="text-sm">{u.patientCount}</td>
                  <td>{u.plan ? <span className="badge badge-brand">{u.plan.name}</span> : <span className="badge badge-neutral">Sem plano</span>}</td>
                  <td>
                    <button onClick={() => toggleAdmin(u.id, u.isAdmin)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${u.isAdmin ? "bg-amber-50 dark:bg-amber-500/10 text-amber-500" : "text-surface-400 hover:text-amber-500"}`}
                      title={u.isAdmin ? "Remover admin" : "Tornar admin"}>
                      <Shield size={14} />
                    </button>
                  </td>
                  <td>
                    <button onClick={() => setDeleteTarget({ type:"user", id:u.id, name:u.name })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 transition-all"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Plans ──────────────────────────────────────────── */}
      {tab === "plans" && (
        <div className="page-enter">
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditingPlan(null); setPlanForm({ name:"",description:"",price:0,interval:"monthly",maxPatients:-1,maxAppointmentsMonth:-1,hasAI:false,hasTelehealth:false,hasWhatsapp:false,hasTranscription:false }); setShowPlanForm(true); }}
              className="btn-primary flex items-center gap-2 text-sm"><Package size={14}/>Novo Plano</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(p => (
              <div key={p.id} className="glass-card p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{p.name}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingPlan(p); setPlanForm(p); setShowPlanForm(true); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600"><Edit size={14}/></button>
                    <button onClick={() => setDeleteTarget({type:"plan",id:p.id,name:p.name})} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
                <p className="text-3xl font-bold text-brand-600 dark:text-brand-300">{formatCurrency(p.price)}<span className="text-sm font-normal text-surface-500">/{p.interval==="monthly"?"mês":"ano"}</span></p>
                {p.description && <p className="text-sm text-surface-500 mt-2">{p.description}</p>}
                <div className="mt-4 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">{p.maxPatients===-1?"∞":p.maxPatients} pacientes</div>
                  <div className="flex items-center gap-2">{p.maxAppointmentsMonth===-1?"∞":p.maxAppointmentsMonth} consultas/mês</div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {p.hasAI && <span className="badge badge-brand"><Brain size={10}/>IA</span>}
                    {p.hasTelehealth && <span className="badge badge-info"><Video size={10}/>Teleconsulta</span>}
                    {p.hasWhatsapp && <span className="badge badge-success"><MessageCircle size={10}/>WhatsApp</span>}
                    {p.hasTranscription && <span className="badge badge-warning"><FileText size={10}/>Transcrição</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Config (APIs) ──────────────────────────────────── */}
      {tab === "config" && (
        <div className="max-w-2xl page-enter space-y-6">
          {/* Laozhang AI */}
          <div className="glass-card p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><Brain size={18} className="text-brand-600"/>IA — Análise de Sessão (Laozhang / OpenAI)</h3>
            <p className="text-xs text-surface-500 mb-4">API para analisar transcrições e gerar relatórios clínicos automaticamente.</p>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">API URL</label>
                <input value={config['ai.api_url']||''} onChange={e=>setConfig(c=>({...c,'ai.api_url':e.target.value}))} className="input-premium w-full" placeholder="https://api.laozhang.ai/v1/chat/completions"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">API Key</label>
                <input type="password" value={config['ai.api_key']||''} onChange={e=>setConfig(c=>({...c,'ai.api_key':e.target.value}))} className="input-premium w-full" placeholder="sk-..."/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Modelo</label>
                <select value={config['ai.model']||'deepseek-v3'} onChange={e=>setConfig(c=>({...c,'ai.model':e.target.value}))} className="input-premium w-full">
                  <option value="deepseek-v3">DeepSeek V3 (Laozhang)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
                  <option value="gpt-4o">GPT-4o (OpenAI)</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                </select></div>
            </div>
          </div>

          {/* Downsub */}
          <div className="glass-card p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><FileText size={18} className="text-amber-500"/>Downsub — Transcrição de Áudio</h3>
            <p className="text-xs text-surface-500 mb-4">API para transcrever gravações de sessão em texto. Alternativa à Web Speech API com maior precisão.</p>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">API URL</label>
                <input value={config['downsub.api_url']||''} onChange={e=>setConfig(c=>({...c,'downsub.api_url':e.target.value}))} className="input-premium w-full" placeholder="https://api.downsub.com/v1/transcribe"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">API Key</label>
                <input type="password" value={config['downsub.api_key']||''} onChange={e=>setConfig(c=>({...c,'downsub.api_key':e.target.value}))} className="input-premium w-full"/></div>
            </div>
          </div>

          {/* WhatsApp Global */}
          <div className="glass-card p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><MessageCircle size={18} className="text-green-500"/>WhatsApp — Configuração Global</h3>
            <p className="text-xs text-surface-500 mb-4">URL padrão da Evolution API para novos profissionais. Cada profissional pode sobrescrever nas configurações próprias.</p>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">URL padrão da Evolution API</label>
                <input value={config['whatsapp.default_url']||''} onChange={e=>setConfig(c=>({...c,'whatsapp.default_url':e.target.value}))} className="input-premium w-full" placeholder="https://sua-evolution-api.com"/></div>
            </div>
          </div>

          {/* Stripe */}
          <div className="glass-card p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><Key size={18} className="text-purple-500"/>Stripe — Pagamentos</h3>
            <p className="text-xs text-surface-500 mb-4">Configure o Stripe para cobrar assinaturas automaticamente.</p>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Secret Key (sk_live_...)</label>
                <input type="password" value={config["stripe.secret_key"]||""} onChange={e=>setConfig(c=>({...c,"stripe.secret_key":e.target.value}))} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Publishable Key (pk_live_...)</label>
                <input value={config["stripe.publishable_key"]||""} onChange={e=>setConfig(c=>({...c,"stripe.publishable_key":e.target.value}))} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Webhook Secret (whsec_...)</label>
                <input type="password" value={config["stripe.webhook_secret"]||""} onChange={e=>setConfig(c=>({...c,"stripe.webhook_secret":e.target.value}))} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">URL da Plataforma (para redirects)</label>
                <input value={config["platform.url"]||""} onChange={e=>setConfig(c=>({...c,"platform.url":e.target.value}))} className="input-premium w-full" placeholder="https://seudominio.com.br"/></div>
            </div>
          </div>
          {/* Stripe */}
          <div className="glass-card p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><Key size={18} className="text-purple-500"/>Stripe — Pagamentos</h3>
            <p className="text-xs text-surface-500 mb-4">Configure para cobrar assinaturas automaticamente com cartão, boleto ou PIX.</p>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Secret Key</label>
                <input type="password" value={config["stripe.secret_key"]||""} onChange={e=>setConfig(c=>({...c,"stripe.secret_key":e.target.value}))} className="input-premium w-full" placeholder="sk_live_..."/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Publishable Key</label>
                <input value={config["stripe.publishable_key"]||""} onChange={e=>setConfig(c=>({...c,"stripe.publishable_key":e.target.value}))} className="input-premium w-full" placeholder="pk_live_..."/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Webhook Secret</label>
                <input type="password" value={config["stripe.webhook_secret"]||""} onChange={e=>setConfig(c=>({...c,"stripe.webhook_secret":e.target.value}))} className="input-premium w-full" placeholder="whsec_..."/></div>
            </div>
          </div>

          {/* Platform Settings */}
          <div className="glass-card p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><Settings size={18} className="text-surface-500"/>Plataforma</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Nome da Plataforma</label>
                <input value={config['platform.name']||'Espaço Terapêutico'} onChange={e=>setConfig(c=>({...c,'platform.name':e.target.value}))} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Email de Suporte</label>
                <input value={config['platform.support_email']||''} onChange={e=>setConfig(c=>({...c,'platform.support_email':e.target.value}))} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Dias de Trial para novos usuários</label>
                <input type="number" value={config['platform.trial_days']||'14'} onChange={e=>setConfig(c=>({...c,'platform.trial_days':e.target.value}))} className="input-premium w-24"/></div>
            </div>
          </div>

          <button onClick={saveConfigFn} disabled={savingConfig} className="btn-primary flex items-center gap-2 h-11">
            <Save size={16}/>{savingConfig ? "Salvando..." : "Salvar Todas as Configurações"}
          </button>
        </div>
      )}

      {/* Plan form modal */}
      <Modal open={showPlanForm} onClose={() => setShowPlanForm(false)} title={editingPlan ? "Editar Plano" : "Novo Plano"}>
        <form onSubmit={handlePlanSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Nome</label>
              <input value={planForm.name} onChange={e=>setPlanForm(f=>({...f,name:e.target.value}))} className="input-premium w-full" required/></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Preço (R$)</label>
              <input type="number" step="0.01" value={planForm.price} onChange={e=>setPlanForm(f=>({...f,price:+e.target.value}))} className="input-premium w-full"/></div>
          </div>
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Descrição</label>
            <input value={planForm.description} onChange={e=>setPlanForm(f=>({...f,description:e.target.value}))} className="input-premium w-full"/></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Período</label>
              <select value={planForm.interval} onChange={e=>setPlanForm(f=>({...f,interval:e.target.value}))} className="input-premium w-full"><option value="monthly">Mensal</option><option value="yearly">Anual</option><option value="lifetime">Vitalício</option></select></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Max Pacientes (-1=∞)</label>
              <input type="number" value={planForm.maxPatients} onChange={e=>setPlanForm(f=>({...f,maxPatients:+e.target.value}))} className="input-premium w-full"/></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Max Consultas/Mês</label>
              <input type="number" value={planForm.maxAppointmentsMonth} onChange={e=>setPlanForm(f=>({...f,maxAppointmentsMonth:+e.target.value}))} className="input-premium w-full"/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[{k:"hasAI",l:"Análise IA",i:Brain},{k:"hasTelehealth",l:"Teleconsulta",i:Video},{k:"hasWhatsapp",l:"WhatsApp",i:MessageCircle},{k:"hasTranscription",l:"Transcrição",i:FileText}].map(f=>(
              <label key={f.k} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/30">
                <input type="checkbox" checked={(planForm as any)[f.k]} onChange={e=>setPlanForm(pf=>({...pf,[f.k]:e.target.checked}))} className="w-4 h-4 rounded border-surface-300 text-brand-600"/>
                <f.i size={14} className="text-surface-500"/>{f.l}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={()=>setShowPlanForm(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editingPlan?"Salvar":"Criar Plano"}</button></div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title={`Remover ${deleteTarget?.type==="user"?"usuário":"plano"}`} description={`Deseja remover "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`} confirmLabel="Remover"
        onConfirm={handleDelete} onCancel={()=>setDeleteTarget(null)}/>
    </MainLayout>
  );
}
