import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, SearchInput, EmptyState, TableSkeleton, Modal, ConfirmDialog } from "@/components/common";
import { useDocuments, usePatients } from "@/hooks/useData";
import { documentGenApi } from "@/lib/api";
import { FileCheck, Edit, Trash2, Eye, Printer, Wand2 } from "lucide-react";
import { formatDate, useDebounce } from "@/lib/utils";
import { toast } from "sonner";
import type { Document } from "@/types";
const DOC_TYPES: Record<string,{label:string;class:string}> = { recibo:{label:"Recibo",class:"badge-success"}, atestado:{label:"Atestado",class:"badge-info"}, declaracao:{label:"Declaração",class:"badge-brand"}, relatorio:{label:"Relatório",class:"badge-warning"}, receituario:{label:"Receituário",class:"badge-neutral"} };
const TEMPLATES: Record<string,string> = {
  recibo: "RECIBO\n\nRecebi de {paciente}, CPF {cpf}, o valor de R$ _______ referente a sessão de psicoterapia realizada em {data}.\n\n{cidade}, {data_extenso}\n\n\n___________________________\n{profissional}\n{crp}",
  atestado: "ATESTADO\n\nAtesto para os devidos fins que {paciente}, CPF {cpf}, encontra-se em acompanhamento psicológico desde _________, com sessões _________ (semanais/quinzenais).\n\n{cidade}, {data_extenso}\n\n\n___________________________\n{profissional}\n{crp}",
  declaracao: "DECLARAÇÃO DE COMPARECIMENTO\n\nDeclaro para os devidos fins que {paciente}, CPF {cpf}, compareceu a esta clínica no dia {data}, no horário de _____ às _____, para sessão de psicoterapia.\n\n{cidade}, {data_extenso}\n\n\n___________________________\n{profissional}\n{crp}",
};
export default function Documentos() {
  const { data: documents, loading, create, update, remove } = useDocuments();
  const { data: patients } = usePatients();
  const [search, setSearch] = useState(""); const dSearch = useDebounce(search, 300);
  const [showForm, setShowForm] = useState(false); const [viewing, setViewing] = useState<Document|null>(null);
  const [editing, setEditing] = useState<Document|null>(null); const [deleteTarget, setDeleteTarget] = useState<string|null>(null);
  const [form, setForm] = useState({ type: "recibo", patientId: "", title: "", content: "", date: new Date().toISOString().split("T")[0] });
  const filtered = documents.filter(d => d.title?.toLowerCase().includes(dSearch.toLowerCase()) || d.patientName?.toLowerCase().includes(dSearch.toLowerCase()));

  const openNew = (type = "recibo") => { setEditing(null); setForm({ type, patientId: "", title: DOC_TYPES[type]?.label || "", content: "", date: new Date().toISOString().split("T")[0] }); setShowForm(true); };
  const applyTemplate = () => { const tpl = TEMPLATES[form.type]; if (tpl) setForm(f => ({...f, content: tpl})); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Use generate endpoint for variable replacement
    try {
      if (!editing) {
        await documentGenApi.generate({ patientId: form.patientId, type: form.type, title: form.title, customContent: form.content, date: form.date });
        toast.success("Documento gerado com variáveis preenchidas!");
      } else {
        const patient = patients.find(p => p.id === form.patientId);
        await update({ id: editing.id, ...form, patientName: patient?.name || "" } as any);
      }
      setShowForm(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const printDoc = (id: string) => { window.open(documentGenApi.getPrintUrl(id), '_blank'); };

  if (loading) return <MainLayout><PageHeader title="Documentos" /><TableSkeleton /></MainLayout>;
  return (
    <MainLayout>
      <PageHeader title="Documentos" subtitle={`${documents.length} documentos`} action={{ label: "Novo Documento", onClick: () => openNew() }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." />
      </PageHeader>
      {filtered.length===0 ? <EmptyState icon={FileCheck} title="Nenhum documento" description="Crie recibos, atestados e declarações com templates" action={{ label: "Novo Documento", onClick: () => openNew() }}/> : (
        <div className="glass-card overflow-x-auto page-enter"><table className="table-premium"><thead><tr><th>Documento</th><th>Paciente</th><th className="hidden sm:table-cell">Data</th><th>Tipo</th><th className="w-24"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{filtered.map(d => { const dt = DOC_TYPES[d.type]||DOC_TYPES.recibo; return (
            <tr key={d.id}><td className="font-medium text-sm">{d.title}</td><td className="text-sm">{d.patientName}</td><td className="text-xs text-surface-500 hidden sm:table-cell">{formatDate(d.date)}</td>
              <td><span className={`badge ${dt.class}`}>{dt.label}</span></td>
              <td><div className="flex gap-1">
                <button onClick={() => printDoc(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-emerald-500 transition-all" title="Imprimir / PDF"><Printer size={14}/></button>
                <button onClick={() => setViewing(d)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 transition-all" title="Ver"><Eye size={14}/></button>
                <button onClick={() => { setEditing(d); setForm({ type:d.type, patientId:d.patientId, title:d.title, content:d.content, date:d.date }); setShowForm(true); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 transition-all" title="Editar"><Edit size={14}/></button>
                <button onClick={() => setDeleteTarget(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 transition-all" title="Remover"><Trash2 size={14}/></button>
              </div></td></tr>);})}</tbody></table></div>)}

      <ConfirmDialog open={!!deleteTarget} title="Remover documento" description="Esta ação não pode ser desfeita." confirmLabel="Remover" onConfirm={async()=>{if(deleteTarget) await remove(deleteTarget); setDeleteTarget(null);}} onCancel={()=>setDeleteTarget(null)}/>
      <Modal open={!!viewing} onClose={()=>setViewing(null)} title={viewing?.title||""}>
        {viewing && <><span className={`badge ${DOC_TYPES[viewing.type]?.class} mb-2`}>{DOC_TYPES[viewing.type]?.label}</span><p className="text-sm text-surface-500 mb-4">{viewing.patientName} · {formatDate(viewing.date)}</p><div className="whitespace-pre-wrap text-sm leading-relaxed">{viewing.content}</div><div className="flex gap-3 mt-4"><button onClick={()=>printDoc(viewing.id)} className="btn-primary flex items-center gap-2"><Printer size={14}/>Imprimir / PDF</button></div></>}
      </Modal>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editing?"Editar Documento":"Novo Documento"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Tipo</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,title:DOC_TYPES[e.target.value]?.label||""}))} className="input-premium w-full">{Object.entries(DOC_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Paciente *</label><select value={form.patientId} onChange={e=>setForm(f=>({...f,patientId:e.target.value}))} className="input-premium w-full" required><option value="">Selecione...</option>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Título</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="input-premium w-full" required/></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Data</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="input-premium w-full"/></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-surface-500">Conteúdo</label>
              <button type="button" onClick={applyTemplate} className="text-xs text-brand-600 hover:text-brand-400 flex items-center gap-1"><Wand2 size={12}/>Usar template</button>
            </div>
            <p className="text-[10px] text-surface-400 mb-1">Variáveis: {"{paciente}"} {"{cpf}"} {"{data}"} {"{data_extenso}"} {"{profissional}"} {"{crp}"} {"{consultorio}"} {"{cidade}"}</p>
            <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} className="input-premium w-full h-48 py-2 resize-none font-mono text-xs"/>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={()=>setShowForm(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing?"Salvar":"Gerar Documento"}</button></div>
        </form>
      </Modal>
    </MainLayout>);
}
