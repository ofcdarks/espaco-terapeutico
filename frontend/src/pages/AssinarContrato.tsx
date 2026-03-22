import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { FileSignature, Check, AlertCircle, Loader2 } from "lucide-react";
const API = import.meta.env.VITE_API_URL || '';

export default function AssinarContrato() {
  const { id } = useParams();
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/contracts/${id}/public`).then(r => r.json()).then(d => { setContract(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault(); setSigning(true);
    try {
      const res = await fetch(`${API}/api/contracts/${id}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientName: name, cpf: cpf.replace(/\D/g, '') }) });
      if (!res.ok) { const err = await res.json(); toast.error(err.error); setSigning(false); return; }
      setSigned(true);
    } catch { toast.error("Erro ao assinar"); }
    setSigning(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{background:'#f5f2ee'}}><Loader2 className="animate-spin" style={{color:'#54423b'}} /></div>;
  if (!contract || contract.error) return <div className="min-h-screen flex items-center justify-center" style={{background:'#f5f2ee'}}><div className="text-center"><AlertCircle size={40} style={{color:'#c62828'}} className="mx-auto mb-4"/><p style={{color:'#2a2523'}} className="font-semibold">Contrato não encontrado</p></div></div>;

  if (contract.status === 'assinado' || signed) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#f5f2ee'}}>
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{background:'#e8f5e9'}}><Check size={28} style={{color:'#2e7d32'}} /></div>
        <h1 className="text-xl font-semibold mb-2" style={{color:'#2a2523'}}>Contrato Assinado</h1>
        <p className="text-sm" style={{color:'#b8b0aa'}}>O contrato "{contract.title}" foi assinado com sucesso. Você pode fechar esta página.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4" style={{background:'#f5f2ee', color:'#2a2523'}}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 pt-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{background:'#54423b'}}><FileSignature size={22} color="#e8d8c3" /></div>
          <h1 className="text-lg font-semibold">{contract.title}</h1>
          <p className="text-sm" style={{color:'#b8b0aa'}}>Leia o contrato abaixo e assine digitalmente</p>
        </div>

        <div className="rounded-2xl p-6 sm:p-8 mb-6" style={{background:'white', border:'1px solid #e8d8c3'}}>
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{fontFamily:'Georgia, serif'}}>{contract.content}</div>
        </div>

        <div className="rounded-2xl p-6" style={{background:'white', border:'1px solid #e8d8c3'}}>
          <h2 className="font-semibold mb-4 flex items-center gap-2"><FileSignature size={16} style={{color:'#54423b'}} /> Assinatura Digital</h2>
          <form onSubmit={handleSign} className="space-y-4">
            <div><label className="text-xs font-medium mb-1 block" style={{color:'#b8b0aa'}}>Seu nome completo *</label>
              <input value={name} onChange={e => setName(e.target.value)} required className="w-full h-10 rounded-xl px-3.5 text-sm" style={{background:'#f5f2ee', border:'1px solid #e8d8c3'}} /></div>
            <div><label className="text-xs font-medium mb-1 block" style={{color:'#b8b0aa'}}>CPF *</label>
              <input value={cpf} onChange={e => setCpf(e.target.value)} required className="w-full h-10 rounded-xl px-3.5 text-sm" style={{background:'#f5f2ee', border:'1px solid #e8d8c3'}} /></div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1 w-4 h-4 rounded" style={{accentColor:'#54423b'}} />
              <span>Li e concordo com todos os termos do contrato acima.</span>
            </label>
            <button type="submit" disabled={!agreed || signing} className="w-full h-11 rounded-xl font-medium text-sm transition-all disabled:opacity-50" style={{background:'#54423b', color:'#f5f2ee'}}>
              {signing ? "Assinando..." : "Assinar Contrato"}
            </button>
            <p className="text-[10px] text-center" style={{color:'#b8b0aa'}}>Ao assinar, um hash criptográfico será gerado como prova de autenticidade.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
