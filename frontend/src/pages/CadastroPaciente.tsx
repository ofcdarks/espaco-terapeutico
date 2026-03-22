import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { UserPlus, Check, AlertCircle, Loader2 } from "lucide-react";
const API = import.meta.env.VITE_API_URL || '';

export default function CadastroPaciente() {
  const { linkId } = useParams();
  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', cpf: '', birthDate: '' });

  useEffect(() => {
    fetch(`${API}/api/registration-links/${linkId}/info`).then(r => {
      if (r.ok) setStep('form');
      else r.json().then(d => { setError(d.error); setStep('error'); });
    }).catch(() => setStep('error'));
  }, [linkId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch(`${API}/api/registration-links/${linkId}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (r.ok) setStep('success');
    else { const d = await r.json(); setError(d.error || 'Erro ao cadastrar'); setStep('error'); }
  };

  if (step === 'loading') return <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f2ee' }}><Loader2 className="animate-spin" style={{ color: '#54423b' }} /></div>;

  if (step === 'success') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: '#e8f5e9' }}><Check size={28} style={{ color: '#2e7d32' }} /></div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Cadastro Realizado!</h1>
        <p className="text-sm" style={{ color: '#b8b0aa' }}>Seus dados foram enviados ao profissional. Você pode fechar esta página.</p>
      </div>
    </div>
  );

  if (step === 'error') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center max-w-sm">
        <AlertCircle size={40} style={{ color: '#c62828' }} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Link inválido</h1>
        <p className="text-sm" style={{ color: '#b8b0aa' }}>{error || 'Este link não é mais válido. Solicite um novo ao seu profissional.'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#54423b' }}><UserPlus size={22} color="#e8d8c3" /></div>
          <h1 className="text-lg font-semibold" style={{ color: '#2a2523' }}>Cadastro de Paciente</h1>
          <p className="text-sm" style={{ color: '#b8b0aa' }}>Preencha seus dados para o acompanhamento</p>
        </div>
        <div className="rounded-2xl p-6" style={{ background: 'white', border: '1px solid #e8d8c3' }}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><label className="text-xs font-medium mb-1 block" style={{ color: '#b8b0aa' }}>Nome completo *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full h-10 rounded-xl px-3.5 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3' }} /></div>
            <div><label className="text-xs font-medium mb-1 block" style={{ color: '#b8b0aa' }}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full h-10 rounded-xl px-3.5 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3' }} /></div>
            <div><label className="text-xs font-medium mb-1 block" style={{ color: '#b8b0aa' }}>Telefone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full h-10 rounded-xl px-3.5 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3' }} placeholder="(11) 99999-9999" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium mb-1 block" style={{ color: '#b8b0aa' }}>CPF</label>
                <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} className="w-full h-10 rounded-xl px-3.5 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3' }} /></div>
              <div><label className="text-xs font-medium mb-1 block" style={{ color: '#b8b0aa' }}>Data nascimento</label>
                <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="w-full h-10 rounded-xl px-3.5 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3' }} /></div>
            </div>
            <button type="submit" className="w-full h-11 rounded-xl font-medium text-sm" style={{ background: '#54423b', color: '#f5f2ee' }}>Enviar Cadastro</button>
          </form>
        </div>
      </div>
    </div>
  );
}
