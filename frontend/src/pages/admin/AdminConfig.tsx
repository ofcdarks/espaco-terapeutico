import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { LoadingState } from "@/components/common";
import { Save, Key, Brain, MessageCircle, Video, Globe, Mail } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' });

const CONFIG_GROUPS = [
  { title: 'IA / Análise de Sessão (Laozhang / OpenAI)', icon: Brain, color: 'text-brand-500', keys: [
    { key: 'ai_api_url', label: 'URL da API', placeholder: 'https://api.laozhang.ai/v1/chat/completions', type: 'url' },
    { key: 'ai_api_key', label: 'API Key', placeholder: 'sk-...', type: 'password' },
    { key: 'ai_model', label: 'Modelo', placeholder: 'deepseek-v3 / gpt-4o / claude-3-sonnet', type: 'text' },
  ]},
  { title: 'Transcrição (Downsub)', icon: MessageCircle, color: 'text-blue-500', keys: [
    { key: 'downsub_api_url', label: 'URL da API', placeholder: 'https://api.downsub.com/v1', type: 'url' },
    { key: 'downsub_api_key', label: 'API Key', placeholder: 'Sua chave Downsub', type: 'password' },
  ]},
  { title: 'Teleconsulta (Jitsi)', icon: Video, color: 'text-emerald-500', keys: [
    { key: 'jitsi_domain', label: 'Domínio Jitsi', placeholder: 'meet.jit.si (ou jitsi.seudominio.com)', type: 'text' },
  ]},
  { title: 'Plataforma', icon: Globe, color: 'text-amber-500', keys: [
    { key: 'platform_name', label: 'Nome da Plataforma', placeholder: 'Espaço Terapêutico', type: 'text' },
    { key: 'support_email', label: 'Email de Suporte', placeholder: 'contato@seudominio.com', type: 'email' },
    { key: 'trial_days', label: 'Dias de Trial', placeholder: '14', type: 'number' },
  ]},
];

export default function AdminConfig() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/config`, { headers: headers() })
      .then(r => r.json()).then((items: any[]) => {
        const map: Record<string, string> = {};
        items.forEach(i => { map[i.key] = i.value; });
        setConfig(map);
      }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const items = Object.entries(config).map(([key, value]) => ({ key, value }));
      await fetch(`${API}/api/admin/config/bulk`, { method: 'POST', headers: headers(), body: JSON.stringify(items) });
      toast.success("Configurações salvas!");
    } catch { toast.error("Erro ao salvar"); }
    setSaving(false);
  };

  if (loading) return <AdminLayout><LoadingState /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-semibold">Configurações API</h1><p className="text-surface-500 text-sm mt-1">Chaves de API e integrações da plataforma</p></div>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} />{saving ? "Salvando..." : "Salvar Tudo"}</button>
      </div>

      <div className="space-y-6">
        {CONFIG_GROUPS.map(group => (
          <div key={group.title} className="glass-card p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><group.icon size={18} className={group.color} />{group.title}</h3>
            <div className="space-y-4">
              {group.keys.map(k => (
                <div key={k.key} className="grid grid-cols-3 gap-4 items-center">
                  <label className="text-sm text-surface-600 dark:text-surface-400">{k.label}</label>
                  <div className="col-span-2">
                    <input type={k.type} value={config[k.key] || ''} onChange={e => setConfig(c => ({ ...c, [k.key]: e.target.value }))}
                      placeholder={k.placeholder} className="input-premium w-full" />
                    <p className="text-[10px] text-surface-400 mt-0.5 font-mono">{k.key}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 mt-6">
        <h3 className="font-semibold mb-2">Como funciona</h3>
        <div className="text-sm text-surface-500 space-y-2">
          <p><strong className="text-foreground">Laozhang AI:</strong> Usada para analisar transcrições de sessões. Compatível com qualquer API OpenAI-compatible (Laozhang, OpenRouter, OpenAI direto). A chave fica segura no servidor — nunca vai ao navegador do usuário.</p>
          <p><strong className="text-foreground">Downsub:</strong> Usada para transcrever áudio das sessões automaticamente. O profissional grava a sessão, envia o áudio, e recebe a transcrição. Opcional — o profissional pode digitar manualmente.</p>
          <p><strong className="text-foreground">Jitsi:</strong> O domínio padrão <code className="text-xs bg-surface-100 dark:bg-surface-800 px-1 rounded">meet.jit.si</code> é gratuito. Para maior privacidade, instale Jitsi na sua VPS.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
