import { useState } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type View = "login" | "register" | "forgot" | "reset";

export default function Auth() {
  const { isAuthenticated, signIn, signUp, error, clearError } = useAuth();
  const [view, setView] = useState<View>("login");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", resetToken: "", newPassword: "" });

  if (isAuthenticated) return <Navigate to="/" replace />;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, [k]: e.target.value })); clearError(); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { await signIn(form.email, form.password); } catch {}
    setLoading(false);
  };
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error("Senhas não conferem"); return; }
    setLoading(true);
    try { await signUp(form.email, form.password, form.name); } catch {}
    setLoading(false);
  };
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const res: any = await authApi.forgotPassword(form.email);
      toast.success(res.message || "Verifique seu email");
      if (res._devToken) { setForm(f => ({ ...f, resetToken: res._devToken })); setView("reset"); }
    } catch (err: any) { toast.error(err.message); }
    setLoading(false);
  };
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await authApi.resetPassword(form.resetToken, form.newPassword);
      toast.success("Senha redefinida! Faça login.");
      setView("login");
    } catch (err: any) { toast.error(err.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-[480px] bg-surface-950 flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30"><div className="absolute top-20 -left-20 w-80 h-80 bg-brand-500 rounded-full blur-[120px]" /><div className="absolute bottom-40 right-0 w-60 h-60 bg-brand-300 rounded-full blur-[100px]" /></div>
        <div className="relative z-10 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center"><span className="text-white font-bold text-sm">ET</span></div><span className="text-white font-semibold text-lg">Espaço Terapêutico</span></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-semibold text-white leading-tight mb-4">Gerencie seu consultório com excelência</h2>
          <p className="text-surface-400 text-sm leading-relaxed">Agenda inteligente, prontuários seguros, teleconsulta integrada e gestão financeira completa.</p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[{ n: "500+", l: "Profissionais" },{ n: "50k+", l: "Sessões" },{ n: "99.9%", l: "Uptime" },{ n: "LGPD", l: "Compliance" }].map(s => (
              <div key={s.l} className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-2xl font-semibold text-white">{s.n}</p><p className="text-xs text-surface-400 mt-0.5">{s.l}</p></div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-surface-600">© 2025 Espaço Terapêutico</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[400px]">
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              {error && <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400" role="alert">{error}</div>}

              {view === "login" && (<>
                <h2 className="text-2xl font-semibold mb-1">Bem-vindo de volta</h2>
                <p className="text-sm text-surface-500 mb-8">Entre com suas credenciais</p>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div><label htmlFor="login-email" className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Email</label>
                    <input id="login-email" type="email" value={form.email} onChange={set("email")} className="input-premium w-full" placeholder="seu@email.com" required autoComplete="email" /></div>
                  <div><label htmlFor="login-pw" className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Senha</label>
                    <div className="relative"><input id="login-pw" type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} className="input-premium w-full pr-10" required autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" aria-label={showPw ? "Esconder senha" : "Mostrar senha"}>{showPw ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>
                  <button type="button" onClick={() => setView("forgot")} className="text-xs text-brand-600 hover:text-brand-400">Esqueci minha senha</button>
                  <button type="submit" disabled={loading} className="btn-primary w-full h-11 flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={18} className="animate-spin"/> : <>Entrar <ArrowRight size={16}/></>}
                  </button>
                </form>
                <p className="text-center text-sm text-surface-500 mt-6">Não tem conta? <button onClick={() => setView("register")} className="text-brand-600 font-medium ml-1">Criar conta</button></p>
              </>)}

              {view === "register" && (<>
                <h2 className="text-2xl font-semibold mb-1">Criar sua conta</h2>
                <p className="text-sm text-surface-500 mb-8">Preencha os dados para começar</p>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div><label htmlFor="reg-name" className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Nome completo</label>
                    <input id="reg-name" value={form.name} onChange={set("name")} className="input-premium w-full" required autoComplete="name" /></div>
                  <div><label htmlFor="reg-email" className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Email</label>
                    <input id="reg-email" type="email" value={form.email} onChange={set("email")} className="input-premium w-full" required autoComplete="email" /></div>
                  <div><label htmlFor="reg-pw" className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Senha</label>
                    <input id="reg-pw" type="password" value={form.password} onChange={set("password")} className="input-premium w-full" required minLength={6} autoComplete="new-password" /></div>
                  <div><label htmlFor="reg-confirm" className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Confirmar senha</label>
                    <input id="reg-confirm" type="password" value={form.confirm} onChange={set("confirm")} className="input-premium w-full" required autoComplete="new-password" /></div>
                  <button type="submit" disabled={loading} className="btn-primary w-full h-11 flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={18} className="animate-spin"/> : <>Criar conta <ArrowRight size={16}/></>}
                  </button>
                </form>
                <p className="text-center text-sm text-surface-500 mt-6">Já tem conta? <button onClick={() => setView("login")} className="text-brand-600 font-medium ml-1">Fazer login</button></p>
              </>)}

              {view === "forgot" && (<>
                <button onClick={() => setView("login")} className="flex items-center gap-1 text-sm text-surface-500 hover:text-foreground mb-6"><ArrowLeft size={14}/> Voltar ao login</button>
                <h2 className="text-2xl font-semibold mb-1">Esqueceu sua senha?</h2>
                <p className="text-sm text-surface-500 mb-8">Informe seu email para receber o link de recuperação</p>
                <form onSubmit={handleForgot} className="space-y-4">
                  <div><label htmlFor="forgot-email" className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Email</label>
                    <input id="forgot-email" type="email" value={form.email} onChange={set("email")} className="input-premium w-full" required /></div>
                  <button type="submit" disabled={loading} className="btn-primary w-full h-11 flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={18} className="animate-spin"/> : "Enviar link de recuperação"}
                  </button>
                </form>
              </>)}

              {view === "reset" && (<>
                <h2 className="text-2xl font-semibold mb-1">Redefinir senha</h2>
                <p className="text-sm text-surface-500 mb-8">Defina sua nova senha</p>
                <form onSubmit={handleReset} className="space-y-4">
                  <div><label htmlFor="reset-token" className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Token de recuperação</label>
                    <input id="reset-token" value={form.resetToken} onChange={set("resetToken")} className="input-premium w-full" required /></div>
                  <div><label htmlFor="reset-pw" className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Nova senha</label>
                    <input id="reset-pw" type="password" value={form.newPassword} onChange={set("newPassword")} className="input-premium w-full" required minLength={6} /></div>
                  <button type="submit" disabled={loading} className="btn-primary w-full h-11 flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={18} className="animate-spin"/> : "Redefinir senha"}
                  </button>
                </form>
              </>)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
