import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, SearchInput, EmptyState, TableSkeleton, Modal, ConfirmDialog } from "@/components/common";
import { useRecords, usePatients } from "@/hooks/useData";
import { FileText, Edit, Trash2, Eye, Brain, Search } from "lucide-react";
import { formatDate, useDebounce } from "@/lib/utils";
import { aiApi } from "@/lib/api";
import { toast } from "sonner";
import type { ConsultationRecord } from "@/types";

// CID-10 common codes for mental health
const CID10 = [
  "F32.0 - Episódio depressivo leve","F32.1 - Episódio depressivo moderado","F32.2 - Episódio depressivo grave",
  "F33 - Transtorno depressivo recorrente","F41.0 - Transtorno de pânico","F41.1 - Ansiedade generalizada",
  "F41.2 - Transtorno misto ansioso e depressivo","F42 - Transtorno obsessivo-compulsivo","F43.0 - Reação aguda ao estresse",
  "F43.1 - Transtorno de estresse pós-traumático","F43.2 - Transtornos de adaptação","F50.0 - Anorexia nervosa",
  "F50.2 - Bulimia nervosa","F51.0 - Insônia","F60.3 - Transtorno de personalidade borderline",
  "F84.0 - Autismo infantil","F90 - Transtornos hipercinéticos (TDAH)","F10 - Uso de álcool",
  "F12 - Uso de canabinóides","F19 - Uso de múltiplas drogas","Z63.0 - Problemas de relacionamento",
  "Z73.0 - Esgotamento (Burnout)","R45.8 - Outros sintomas relativos ao estado emocional",
];

export default function Prontuarios() {
  const { data: records, loading, create, update, remove } = useRecords();
  const { data: patients } = usePatients();
  const [search, setSearch] = useState(""); const dSearch = useDebounce(search, 300);
  const [showForm, setShowForm] = useState(false); const [viewing, setViewing] = useState<ConsultationRecord|null>(null);
  const [editing, setEditing] = useState<ConsultationRecord|null>(null); const [deleteTarget, setDeleteTarget] = useState<string|null>(null);
  const [cidSearch, setCidSearch] = useState(""); const [showCid, setShowCid] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [form, setForm] = useState({ patientId:"", date: new Date().toISOString().split("T")[0], diagnosis:"", treatment:"", observations:"", prescriptions:"" });

  const filtered = records.filter(r => r.patientName?.toLowerCase().includes(dSearch.toLowerCase()) || r.diagnosis?.toLowerCase().includes(dSearch.toLowerCase()));
  const cidFiltered = useMemo(() => CID10.filter(c => c.toLowerCase().includes(cidSearch.toLowerCase())).slice(0, 8), [cidSearch]);

  const openNew = () => { setEditing(null); setForm({ patientId:"", date: new Date().toISOString().split("T")[0], diagnosis:"", treatment:"", observations:"", prescriptions:"" }); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === form.patientId);
    if (editing) await update({ id: editing.id, ...form, patientName: patient?.name || "" } as any);
    else await create({ ...form, patientName: patient?.name || "" } as any);
    setShowForm(false);
  };

  const analyzeWithAI = async () => {
    if (!viewing) return;
    setAnalyzing(true);
    try {
      const analysis = await aiApi.analyzeSession({
        transcription: [viewing.diagnosis, viewing.treatment, viewing.observations, viewing.prescriptions].filter(Boolean).join("\n"),
        patientName: viewing.patientName, sessionDuration: 50,
      });
      toast.success("Análise concluída");
      // Show analysis in a simple alert for now
      
      setAnalysisResult(analysis);
    } catch (err: any) { toast.error(err.message || "Erro na análise IA"); }
    setAnalyzing(false);
  };

      {/* AI Analysis Modal */}
      <Modal open={!!analysisResult} onClose={() => setAnalysisResult(null)} title="Análise IA da Sessão" size="lg">
        {analysisResult && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-brand-50 dark:bg-brand-600/10">
              <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Resumo</h4>
              <p className="text-sm">{analysisResult.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850">
                <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Estado Emocional</h4>
                <p className="text-sm font-medium">{analysisResult.emotionalState}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850">
                <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Pré-Diagnóstico</h4>
                <p className="text-sm font-medium">{analysisResult.preDiagnosis || "—"}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850">
              <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Notas Clínicas</h4>
              <p className="text-sm">{analysisResult.therapeuticNotes}</p>
            </div>
            {analysisResult.suggestedFollowUp?.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Sugestões</h4>
                <ul className="text-sm space-y-1">{analysisResult.suggestedFollowUp.map((s: string, i: number) => (
                  <li key={i}>• {s}</li>
                ))}</ul>
              </div>
            )}
          </div>
        )}
      </Modal>
  if (loading) return <MainLayout><PageHeader title="Prontuários" /><TableSkeleton /></MainLayout>;
  return (
    <MainLayout>
      <PageHeader title="Prontuários" subtitle={`${records.length} registros`} action={{ label: "Novo Prontuário", onClick: openNew }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por paciente ou CID..." />
      </PageHeader>
      {filtered.length === 0 ? <EmptyState icon={FileText} title="Nenhum prontuário" description="Registre suas notas clínicas" action={{ label: "Novo Prontuário", onClick: openNew }} /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 page-enter">{filtered.map(r => (
          <div key={r.id} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3"><div><p className="font-medium">{r.patientName}</p><p className="text-xs text-surface-500">{formatDate(r.date)}</p></div>
              <div className="flex gap-1">
                <button onClick={() => { setViewing(r); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 transition-all" aria-label="Ver"><Eye size={14} /></button>
                <button onClick={() => { setEditing(r); setForm({ patientId:r.patientId, date:r.date, diagnosis:r.diagnosis||"", treatment:r.treatment||"", observations:r.observations||"", prescriptions:r.prescriptions||"" }); setShowForm(true); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 transition-all" aria-label="Editar"><Edit size={14} /></button>
                <button onClick={() => setDeleteTarget(r.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 transition-all" aria-label="Remover"><Trash2 size={14} /></button>
              </div></div>
            {r.diagnosis && <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2">{r.diagnosis}</p>}
            {r.observations && <p className="text-xs text-surface-500 mt-2 line-clamp-2">{r.observations}</p>}
          </div>))}</div>)}

      <ConfirmDialog open={!!deleteTarget} title="Remover prontuário" description="Esta ação não pode ser desfeita." confirmLabel="Remover"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />

      {/* View modal with AI analyze button */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.patientName || ""} size="lg">
        {viewing && <>
          <p className="text-sm text-surface-500 mb-5">{formatDate(viewing.date)}</p>
          {viewing.diagnosis && <div className="mb-4"><h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Diagnóstico / CID-10</h4><p className="text-sm">{viewing.diagnosis}</p></div>}
          {viewing.treatment && <div className="mb-4"><h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Tratamento / Plano</h4><p className="text-sm">{viewing.treatment}</p></div>}
          {viewing.observations && <div className="mb-4"><h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Observações da Sessão</h4><p className="text-sm whitespace-pre-wrap">{viewing.observations}</p></div>}
          {viewing.prescriptions && <div className="mb-4"><h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Prescrições</h4><p className="text-sm">{viewing.prescriptions}</p></div>}
          <button onClick={analyzeWithAI} disabled={analyzing} className="btn-primary flex items-center gap-2 mt-4">
            <Brain size={14} />{analyzing ? "Analisando..." : "Analisar com IA"}
          </button>
        </>}
      </Modal>

      {/* Form modal with CID-10 autocomplete */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Editar Prontuário" : "Novo Prontuário"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="r-patient" className="text-xs font-medium text-surface-500 mb-1 block">Paciente *</label>
              <select id="r-patient" value={form.patientId} onChange={e => setForm(f => ({...f, patientId: e.target.value}))} className="input-premium w-full" required>
                <option value="">Selecione...</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div><label htmlFor="r-date" className="text-xs font-medium text-surface-500 mb-1 block">Data</label>
              <input id="r-date" type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className="input-premium w-full" /></div>
          </div>

          {/* CID-10 with autocomplete */}
          <div className="relative">
            <label className="text-xs font-medium text-surface-500 mb-1 block">Diagnóstico / CID-10</label>
            <div className="relative">
              <input value={form.diagnosis} onChange={e => { setForm(f => ({...f, diagnosis: e.target.value})); setCidSearch(e.target.value); setShowCid(true); }}
                onFocus={() => setShowCid(true)} onBlur={() => setTimeout(() => setShowCid(false), 200)}
                className="input-premium w-full" placeholder="Digite o CID ou busque..." />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" />
            </div>
            {showCid && cidSearch.length > 0 && cidFiltered.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded-xl shadow-elevated max-h-48 overflow-y-auto">
                {cidFiltered.map(c => (
                  <button key={c} type="button" onClick={() => { setForm(f => ({...f, diagnosis: c})); setShowCid(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">{c}</button>
                ))}
              </div>
            )}
          </div>

          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Tratamento / Plano Terapêutico</label>
            <textarea value={form.treatment} onChange={e => setForm(f => ({...f, treatment: e.target.value}))} className="input-premium w-full h-20 py-2 resize-none" /></div>
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Observações da Sessão</label>
            <textarea value={form.observations} onChange={e => setForm(f => ({...f, observations: e.target.value}))} className="input-premium w-full h-24 py-2 resize-none" placeholder="Descreva o que aconteceu na sessão..." /></div>
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Prescrições / Encaminhamentos</label>
            <textarea value={form.prescriptions} onChange={e => setForm(f => ({...f, prescriptions: e.target.value}))} className="input-premium w-full h-16 py-2 resize-none" /></div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing ? "Salvar" : "Criar"}</button></div>
        </form>
      </Modal>
      {/* AI Analysis Modal */}
      <Modal open={!!analysisResult} onClose={() => setAnalysisResult(null)} title="Análise IA da Sessão" size="lg">
        {analysisResult && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-brand-50 dark:bg-brand-600/10">
              <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Resumo</h4>
              <p className="text-sm">{analysisResult.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850">
                <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Estado Emocional</h4>
                <p className="text-sm font-medium">{analysisResult.emotionalState}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850">
                <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Pré-Diagnóstico</h4>
                <p className="text-sm font-medium">{analysisResult.preDiagnosis || "—"}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850">
              <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Notas Clínicas</h4>
              <p className="text-sm">{analysisResult.therapeuticNotes}</p>
            </div>
            {analysisResult.suggestedFollowUp?.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Sugestões</h4>
                <ul className="text-sm space-y-1">{analysisResult.suggestedFollowUp.map((s: string, i: number) => (
                  <li key={i}>• {s}</li>
                ))}</ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </MainLayout>);
}
