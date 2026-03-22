import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Clock, Check, AlertCircle, Loader2, ArrowLeft, MessageCircle, User, Phone, Mail } from "lucide-react";

const API = import.meta.env.VITE_API_URL || '';

export default function AgendarPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState<'loading' | 'dates' | 'form' | 'success' | 'error'>('loading');
  const [config, setConfig] = useState<any>({});
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(50);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const from = new Date().toISOString().split('T')[0];
    const to = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    fetch(`${API}/api/scheduling/public/${slug}/slots?from=${from}&to=${to}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setConfig(d.config); setSlots(d.slots); setStep('dates'); })
      .catch(() => { setErrorMsg('Agenda não encontrada ou desativada.'); setStep('error'); });
  }, [slug]);

  const dates = [...new Set(slots.map(s => s.date))].sort();
  const timesForDate = slots.filter(s => s.date === selectedDate);

  const selectSlot = (date: string, time: string, duration: number) => {
    setSelectedDate(date); setSelectedTime(time); setSelectedDuration(duration); setStep('form');
  };

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/api/scheduling/public/${slug}/book`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, time: selectedTime, ...form }),
      });
      if (r.ok) {
        const d = await r.json();
        setConfig((c: any) => ({ ...c, ...d }));
        setStep('success');
      } else {
        const d = await r.json();
        setErrorMsg(d.error || 'Horário não disponível'); setStep('error');
      }
    } catch { setErrorMsg('Erro ao agendar'); setStep('error'); }
  };

  const fmtDate = (d: string) => { const dt = new Date(d + 'T12:00:00'); return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); };

  if (step === 'loading') return <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f2ee' }}><Loader2 className="animate-spin" style={{ color: '#54423b' }} /></div>;

  if (step === 'error') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center max-w-sm">
        <AlertCircle size={40} style={{ color: '#c62828' }} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Ops!</h1>
        <p className="text-sm mb-4" style={{ color: '#b8b0aa' }}>{errorMsg}</p>
        <button onClick={() => { setStep('dates'); setErrorMsg(''); }} className="h-10 px-6 rounded-xl text-sm font-medium" style={{ background: '#54423b', color: '#f5f2ee' }}>Tentar novamente</button>
      </div>
    </div>
  );

  if (step === 'success') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: '#e8f5e9' }}><Check size={28} style={{ color: '#2e7d32' }} /></div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Agendamento Realizado!</h1>
        <p className="text-sm mb-2" style={{ color: '#b8b0aa' }}>Sua consulta foi agendada para:</p>
        <p className="text-lg font-semibold mb-1" style={{ color: '#54423b' }}>{fmtDate(selectedDate)}</p>
        <p className="text-sm mb-6" style={{ color: '#8b7f77' }}>às {selectedTime} ({selectedDuration}min)</p>
        {config.whatsapp && (
          <a href={`https://wa.me/55${config.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Agendei uma consulta para ${fmtDate(selectedDate)} às ${selectedTime}. Nome: ${form.name}`)}`}
            target="_blank" rel="noopener" className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-medium" style={{ background: '#25d366', color: 'white' }}>
            <MessageCircle size={16} /> Confirmar via WhatsApp
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#f5f2ee' }}>
      <div className="max-w-lg mx-auto p-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#54423b' }}><Calendar size={22} color="#e8d8c3" /></div>
          <h1 className="text-lg font-semibold" style={{ color: '#2a2523' }}>Agendar Consulta</h1>
          {config.welcomeMessage && <p className="text-sm mt-1" style={{ color: '#b8b0aa' }}>{config.welcomeMessage}</p>}
        </div>

        {step === 'form' ? (
          <div>
            <button onClick={() => setStep('dates')} className="flex items-center gap-1 text-xs mb-4" style={{ color: '#54423b' }}><ArrowLeft size={12} /> Voltar</button>
            <div className="rounded-xl p-4 mb-6" style={{ background: '#54423b', color: '#e8d8c3' }}>
              <p className="text-xs opacity-70">Horário selecionado:</p>
              <p className="font-semibold">{fmtDate(selectedDate)} às {selectedTime}</p>
            </div>
            <div className="rounded-2xl p-6" style={{ background: 'white', border: '1px solid #e8d8c3' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: '#2a2523' }}>Seus dados</h2>
              <form onSubmit={book} className="space-y-3">
                <div><label className="text-xs mb-1 block" style={{ color: '#b8b0aa' }}>Nome completo *</label>
                  <div className="relative"><User size={14} className="absolute left-3 top-3" style={{ color: '#b8b0aa' }} />
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full h-10 rounded-xl pl-9 pr-3 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3' }} /></div></div>
                <div><label className="text-xs mb-1 block" style={{ color: '#b8b0aa' }}>WhatsApp</label>
                  <div className="relative"><Phone size={14} className="absolute left-3 top-3" style={{ color: '#b8b0aa' }} />
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full h-10 rounded-xl pl-9 pr-3 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3' }} placeholder="(11) 99999-9999" /></div></div>
                <div><label className="text-xs mb-1 block" style={{ color: '#b8b0aa' }}>E-mail</label>
                  <div className="relative"><Mail size={14} className="absolute left-3 top-3" style={{ color: '#b8b0aa' }} />
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full h-10 rounded-xl pl-9 pr-3 text-sm" style={{ background: '#f5f2ee', border: '1px solid #e8d8c3' }} /></div></div>
                <button type="submit" className="w-full h-11 rounded-xl font-medium text-sm mt-2" style={{ background: '#54423b', color: '#f5f2ee' }}>Confirmar Agendamento</button>
              </form>
            </div>
          </div>
        ) : (
          <div>
            {dates.length === 0 ? (
              <div className="text-center py-12"><Clock size={32} className="mx-auto mb-3" style={{ color: '#b8b0aa' }} /><p className="text-sm" style={{ color: '#8b7f77' }}>Nenhum horário disponível no momento.</p></div>
            ) : (
              <div className="space-y-4">
                {dates.map(date => (
                  <div key={date} className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e8d8c3' }}>
                    <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(84,66,59,0.05)', borderBottom: '1px solid #e8d8c3' }}>
                      <Calendar size={14} style={{ color: '#54423b' }} />
                      <span className="text-sm font-medium capitalize" style={{ color: '#2a2523' }}>{fmtDate(date)}</span>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2">
                      {slots.filter(s => s.date === date).map((s, i) => (
                        <button key={i} onClick={() => selectSlot(s.date, s.time, s.duration)}
                          className="h-9 px-4 rounded-lg text-sm font-medium transition-all hover:shadow-md"
                          style={{ background: '#f5f2ee', border: '1px solid #e8d8c3', color: '#54423b' }}>
                          {s.time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
