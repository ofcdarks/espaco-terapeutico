import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { UserPlus, Check, AlertCircle, Loader2, Phone, Mail, User, Calendar, CreditCard } from "lucide-react";
const API = import.meta.env.VITE_API_URL || '';

export default function CadastroPaciente() {
  const { linkId } = useParams();
  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', cpf: '', birthDate: '' });

  useEffect(() => {
    fetch(`${API}/api/registration-links/${linkId}/info`).then(r => {
      if (r.ok) setStep('form');
      else r.json().then(d => { setError(d.error || 'Link inválido'); setStep('error'); }).catch(() => setStep('error'));
    }).catch(() => { setError('Erro de conexão'); setStep('error'); });
  }, [linkId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/api/registration-links/${linkId}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (r.ok) setStep('success');
      else { const d = await r.json(); setError(typeof d.error === 'string' ? d.error : 'Erro ao cadastrar'); setStep('error'); }
    } catch { setError('Erro de conexão'); setStep('error'); }
  };

  if (step === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f2ee' }}>
      <Loader2 className="animate-spin" size={32} style={{ color: '#54423b' }} />
    </div>
  );

  if (step === 'success') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: '#e8f5e9' }}>
          <Check size={36} style={{ color: '#2e7d32' }} />
        </div>
        <h1 className="text-2xl font-semibold mb-3" style={{ color: '#2a2523' }}>Cadastro Realizado!</h1>
        <p className="text-sm mb-6" style={{ color: '#b8b0aa' }}>Seus dados foram enviados ao profissional. Você pode fechar esta página.</p>
        <div className="p-4 rounded-xl" style={{ background: 'rgba(84,66,59,0.05)', border: '1px solid #e8d8c3' }}>
          <p className="text-xs" style={{ color: '#8b7f77' }}>O profissional entrará em contato para agendar sua primeira sessão.</p>
        </div>
      </div>
    </div>
  );

  if (step === 'error') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center max-w-sm">
        <AlertCircle size={48} style={{ color: '#c62828' }} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Link Inválido</h1>
        <p className="text-sm" style={{ color: '#b8b0aa' }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: '#54423b' }}>
            <UserPlus size={24} color="#e8d8c3" />
          </div>
          <h1 className="text-xl font-semibold" style={{ color: '#2a2523' }}>Cadastro de Paciente</h1>
          <p className="text-sm mt-1" style={{ color: '#b8b0aa' }}>Preencha seus dados para iniciar o acompanhamento</p>
        </div>

        <div className="rounded-2xl p-6 shadow-sm" style={{ background: 'white', border: '1px solid #e8d8c3' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: '#54423b' }}>Nome completo *</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-3" style={{ color: '#b8b0aa' }} />
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  className="w-full h-11 rounded-xl pl-10 pr-4 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3', color: '#2a2523' }} placeholder="Maria Silva Santos" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: '#54423b' }}>E-mail</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-3" style={{ color: '#b8b0aa' }} />
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full h-11 rounded-xl pl-10 pr-4 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3', color: '#2a2523' }} placeholder="maria@email.com" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: '#54423b' }}>Telefone / WhatsApp</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-3" style={{ color: '#b8b0aa' }} />
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full h-11 rounded-xl pl-10 pr-4 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3', color: '#2a2523' }} placeholder="(11) 99999-9999" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#54423b' }}>CPF</label>
                <div className="relative">
                  <CreditCard size={15} className="absolute left-3 top-3" style={{ color: '#b8b0aa' }} />
                  <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))}
                    className="w-full h-11 rounded-xl pl-10 pr-4 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3', color: '#2a2523' }} placeholder="000.000.000-00" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#54423b' }}>Data de Nascimento</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-3" style={{ color: '#b8b0aa' }} />
                  <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
                    className="w-full h-11 rounded-xl pl-10 pr-4 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3', color: '#2a2523' }} />
                </div>
              </div>
            </div>

            <button type="submit" className="w-full h-12 rounded-xl font-medium text-sm mt-2 transition-all hover:opacity-90" style={{ background: '#54423b', color: '#f5f2ee' }}>
              Enviar Cadastro
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] mt-4" style={{ color: '#b8b0aa' }}>Seus dados estão protegidos conforme a LGPD</p>
      </div>
    </div>
  );
}
