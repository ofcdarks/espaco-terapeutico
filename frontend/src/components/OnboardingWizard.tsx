import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowRight, Check, User, Building, Stethoscope } from "lucide-react";

const CATEGORIES = [
  { value: "psicologo", label: "Psicólogo(a)", icon: "🧠" },
  { value: "terapeuta", label: "Terapeuta", icon: "💚" },
  { value: "psicanalista", label: "Psicanalista", icon: "📖" },
  { value: "sexologo", label: "Sexólogo(a)", icon: "❤️" },
  { value: "constelador", label: "Constelador(a)", icon: "⭐" },
];

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ category: "psicologo", phone: "", registrationNumber: "", specialty: "", sessionDuration: 50, sessionPrice: 0, clinicName: "", clinicCity: "", clinicState: "", onlineService: true });

  const handleFinish = async () => {
    try {
      await authApi.updateProfile({ ...form, onboardingComplete: true } as any);
      toast.success("Configuração concluída! Bem-vindo ao Espaço Terapêutico.");
      onComplete();
    } catch { toast.error("Erro ao salvar"); }
  };

  const steps = [
    // Step 1: Category
    <div key="cat" className="text-center">
      <h2 className="text-xl font-semibold mb-2">Bem-vindo, {user?.name?.split(" ")[0]}! 👋</h2>
      <p className="text-sm text-surface-500 mb-6">Qual é a sua área de atuação?</p>
      <div className="grid grid-cols-1 gap-2 max-w-xs mx-auto">
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => { setForm(f => ({ ...f, category: c.value })); setStep(1); }}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${form.category === c.value ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-surface-200 dark:border-surface-700 hover:border-brand-300"}`}>
            <span className="text-xl">{c.icon}</span>
            <span className="font-medium text-sm">{c.label}</span>
          </button>
        ))}
      </div>
    </div>,
    // Step 2: Professional info
    <div key="pro">
      <h2 className="text-xl font-semibold mb-2 text-center">Seus dados profissionais</h2>
      <p className="text-sm text-surface-500 mb-6 text-center">Informações básicas do seu perfil</p>
      <div className="space-y-3 max-w-sm mx-auto">
        <div><label className="text-xs font-medium text-surface-500 mb-1 block">Telefone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-premium w-full" /></div>
        <div><label className="text-xs font-medium text-surface-500 mb-1 block">CRP / Registro profissional</label><input value={form.registrationNumber} onChange={e => setForm(f => ({ ...f, registrationNumber: e.target.value }))} className="input-premium w-full" /></div>
        <div><label className="text-xs font-medium text-surface-500 mb-1 block">Especialidade</label><input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} className="input-premium w-full" placeholder="Ex: TCC, Psicanálise" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Duração sessão (min)</label><input type="number" value={form.sessionDuration} onChange={e => setForm(f => ({ ...f, sessionDuration: +e.target.value }))} className="input-premium w-full" /></div>
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Valor sessão (R$)</label><input type="number" step="0.01" value={form.sessionPrice} onChange={e => setForm(f => ({ ...f, sessionPrice: +e.target.value }))} className="input-premium w-full" /></div>
        </div>
      </div>
    </div>,
    // Step 3: Clinic
    <div key="clinic">
      <h2 className="text-xl font-semibold mb-2 text-center">Seu consultório</h2>
      <p className="text-sm text-surface-500 mb-6 text-center">Opcional — pode preencher depois</p>
      <div className="space-y-3 max-w-sm mx-auto">
        <div><label className="text-xs font-medium text-surface-500 mb-1 block">Nome do consultório</label><input value={form.clinicName} onChange={e => setForm(f => ({ ...f, clinicName: e.target.value }))} className="input-premium w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Cidade</label><input value={form.clinicCity} onChange={e => setForm(f => ({ ...f, clinicCity: e.target.value }))} className="input-premium w-full" /></div>
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Estado</label><input value={form.clinicState} onChange={e => setForm(f => ({ ...f, clinicState: e.target.value }))} className="input-premium w-full" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.onlineService} onChange={e => setForm(f => ({ ...f, onlineService: e.target.checked }))} className="w-4 h-4 rounded" /> Atendo online</label>
      </div>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? "bg-brand-500 w-12" : "bg-surface-300 dark:bg-surface-700 w-8"}`} />
          ))}
        </div>

        <div className="glass-card p-8">{steps[step]}</div>

        <div className="flex justify-between mt-6">
          {step > 0 ? <button onClick={() => setStep(s => s - 1)} className="btn-ghost">Voltar</button> : <div />}
          {step < 2 ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary flex items-center gap-2">Próximo <ArrowRight size={14} /></button>
          ) : (
            <button onClick={handleFinish} className="btn-primary flex items-center gap-2"><Check size={14} /> Concluir</button>
          )}
        </div>
      </div>
    </div>
  );
}
