import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/common";
import { Link2, Plus, Copy, Check, Trash2, Clock, UserCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
const API = import.meta.env.VITE_API_URL || '';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' });

export default function LinksCadastro() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const refresh = async () => {
    try { const r = await fetch(`${API}/api/registration-links`, { headers: auth() }); setLinks(await r.json()); } catch {}
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const createLink = async () => {
    const r = await fetch(`${API}/api/registration-links`, { method: 'POST', headers: auth() });
    const d = await r.json();
    toast.success("Link criado!"); refresh();
  };

  const copyLink = (url: string, id: string) => { navigator.clipboard.writeText(url); setCopied(id); setTimeout(() => setCopied(""), 2000); toast.success("Link copiado!"); };

  const handleDelete = async () => {
    if (deleteTarget) { await fetch(`${API}/api/registration-links/${deleteTarget}`, { method: 'DELETE', headers: auth() }); toast.success("Link removido"); setDeleteTarget(null); refresh(); }
  };

  const isExpired = (d: string) => new Date(d) < new Date();
  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <MainLayout>
      <PageHeader title="Links de Cadastro" subtitle={`Crie links para seus pacientes se cadastrarem sozinhos (${links.length} links)`} action={{ label: "Novo Link de Cadastro", onClick: createLink }} />

      <div className="glass-card p-4 mb-6 flex items-start gap-3 bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Links de Uso Único</p>
          <p className="text-xs text-amber-700 dark:text-amber-400/70">Cada link é exclusivo para um único paciente. Após o cadastro, o link é invalidado automaticamente.</p>
        </div>
      </div>

      {links.length === 0 ? (
        <EmptyState icon={Link2} title="Nenhum link criado" description="Crie links de cadastro e envie para seus pacientes por WhatsApp" action={{ label: "Criar Link", onClick: createLink }} />
      ) : (
        <div className="space-y-4 page-enter">
          {links.map(l => (
            <div key={l.id} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                {l.usedAt ? (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><UserCheck size={12} /> Já foi usado</span>
                ) : isExpired(l.expiresAt) ? (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"><Clock size={12} /> Expirado</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"><Clock size={12} /> Ativo</span>
                )}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/15 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mb-1">LINK PARA ENVIAR AO PACIENTE</p>
                  <code className="text-xs break-all">{l.url}</code>
                </div>
                <button onClick={() => copyLink(l.url, l.id)} className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand-600 text-white shrink-0">
                  {copied === l.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

              <div className="flex items-center gap-6 text-xs text-surface-500 mb-3">
                <span>📅 Criado em: {fmt(l.createdAt)}</span>
                <span>⏰ Válido até: {fmt(l.expiresAt)}</span>
              </div>

              {l.usedAt && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/15 mb-2">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">✅ Usado em: {fmt(l.usedAt)}</p>
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => copyLink(l.url, l.id)} className="btn-primary h-8 text-xs flex items-center gap-1.5"><Copy size={12} /> Copiar Link</button>
                <button onClick={() => setDeleteTarget(l.id)} className="btn-ghost h-8 text-xs text-red-500 flex items-center gap-1.5"><Trash2 size={12} /> Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!deleteTarget} title="Remover link" description="O link será invalidado." confirmLabel="Remover" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </MainLayout>
  );
}
