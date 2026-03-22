import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/common";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, whatsappApi } from "@/lib/api";
import { toast } from "sonner";
import { User, Lock, Building, Sun, Moon, MessageCircle, CheckCircle, Crown, Smartphone, QrCode } from "lucide-react";
const TABS = [{id:"perfil",label:"Perfil",icon:User},{id:"consultorio",label:"Consultório",icon:Building},{id:"whatsapp",label:"WhatsApp",icon:MessageCircle},{id:"seguranca",label:"Segurança",icon:Lock},{id:"2fa",label:"2FA",icon:Lock},{id:"assinatura",label:"Assinatura",icon:Crown},{id:"aparencia",label:"Aparência",icon:Sun}];
const CATEGORIES = [{value:"psicologo",label:"Psicólogo(a)"},{value:"terapeuta",label:"Terapeuta"},{value:"psicanalista",label:"Psicanalista"},{value:"sexologo",label:"Sexólogo(a)"},{value:"constelador",label:"Constelador(a)"}];
export default function Configuracoes() {
  const { user } = useAuth();
  const [tab, setTab] = useState("perfil");
  const [profile, setProfile] = useState<Record<string,any>>({});
  const [pwForm, setPwForm] = useState({currentPassword:"",newPassword:"",confirm:""});
  const [waForm, setWaForm] = useState({apiUrl:"",apiKey:"",instanceName:"default",enabled:true,reminderTemplate:""});
  const [saving, setSaving] = useState(false);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));

  useEffect(() => { authApi.me().then(setProfile).catch(()=>{}); whatsappApi.getConfig().then((c:any) => { if(c) setWaForm(c); }).catch(()=>{}); }, []);

  const saveProfile = async () => { setSaving(true); try { await authApi.updateProfile(profile); toast.success("Perfil atualizado"); } catch(e:any){ toast.error(e.message); } setSaving(false); };
  const saveWhatsApp = async () => { setSaving(true); try { await whatsappApi.saveConfig(waForm); toast.success("WhatsApp configurado!"); } catch(e:any){ toast.error(e.message); } setSaving(false); };
  const changePassword = async (e: React.FormEvent) => { e.preventDefault(); if(pwForm.newPassword!==pwForm.confirm){toast.error("Senhas não conferem");return;} try{await authApi.changePassword(pwForm.currentPassword,pwForm.newPassword);toast.success("Senha alterada");setPwForm({currentPassword:"",newPassword:"",confirm:""});}catch(e:any){toast.error(e.message);} };
  const toggleTheme = () => { const n=!isDark; setIsDark(n); document.documentElement.classList.toggle("dark",n); localStorage.setItem("theme",n?"dark":"light"); };
  const set = (k:string) => (e: any) => setProfile((p:any)=>({...p,[k]:e.target.value}));

  return (
    <MainLayout>
      <PageHeader title="Configurações" subtitle="Gerencie seu perfil e preferências"/>
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 page-enter">
        <nav className="flex sm:flex-col sm:w-56 gap-1 overflow-x-auto sm:overflow-visible shrink-0" role="tablist">
          {TABS.map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all ${tab===t.id?"bg-brand-100 dark:bg-brand-600/10 text-brand-600 dark:text-brand-300 font-medium":"text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"}`}><t.icon size={16}/>{t.label}</button>)}
        </nav>
        <div className="flex-1 max-w-xl" role="tabpanel">
          {tab==="perfil" && <div className="glass-card p-6 space-y-5"><h3 className="font-semibold">Informações Pessoais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Nome</label><input value={profile.name||""} onChange={set("name")} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Categoria</label><select value={profile.category||"psicologo"} onChange={set("category")} className="input-premium w-full">{CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Telefone</label><input value={profile.phone||""} onChange={set("phone")} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">CRP</label><input value={profile.registrationNumber||""} onChange={set("registrationNumber")} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Especialidade</label><input value={profile.specialty||""} onChange={set("specialty")} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Duração sessão (min)</label><input type="number" value={profile.sessionDuration||50} onChange={set("sessionDuration")} className="input-premium w-full"/></div>
              <div className="sm:col-span-2"><label className="text-xs font-medium text-surface-500 mb-1 block">Bio</label><textarea value={profile.bio||""} onChange={set("bio")} className="input-premium w-full h-20 py-2 resize-none"/></div>
            </div><button onClick={saveProfile} disabled={saving} className="btn-primary">{saving?"Salvando...":"Salvar"}</button></div>}

          {tab==="consultorio" && <div className="glass-card p-6 space-y-5"><h3 className="font-semibold">Dados do Consultório</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className="text-xs font-medium text-surface-500 mb-1 block">Nome</label><input value={profile.clinicName||""} onChange={set("clinicName")} className="input-premium w-full"/></div>
              <div className="sm:col-span-2"><label className="text-xs font-medium text-surface-500 mb-1 block">Endereço</label><input value={profile.clinicAddress||""} onChange={set("clinicAddress")} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Cidade</label><input value={profile.clinicCity||""} onChange={set("clinicCity")} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Estado</label><input value={profile.clinicState||""} onChange={set("clinicState")} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Valor sessão (R$)</label><input type="number" step="0.01" value={profile.sessionPrice||""} onChange={set("sessionPrice")} className="input-premium w-full"/></div>
            </div><button onClick={saveProfile} disabled={saving} className="btn-primary">{saving?"Salvando...":"Salvar"}</button></div>}

          {tab==="whatsapp" && <div className="glass-card p-6 space-y-5"><h3 className="font-semibold flex items-center gap-2"><MessageCircle size={18} className="text-green-500"/>WhatsApp (Evolution API)</h3>
            <p className="text-xs text-surface-500">Integre com Evolution API ou Z-API para enviar lembretes automáticos de consulta via WhatsApp.</p>
            <div className="space-y-4">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">URL da API</label><input value={waForm.apiUrl} onChange={e=>setWaForm(f=>({...f,apiUrl:e.target.value}))} className="input-premium w-full" placeholder="https://sua-evolution-api.com"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">API Key</label><input type="password" value={waForm.apiKey} onChange={e=>setWaForm(f=>({...f,apiKey:e.target.value}))} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Nome da Instância</label><input value={waForm.instanceName} onChange={e=>setWaForm(f=>({...f,instanceName:e.target.value}))} className="input-premium w-full"/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Template de Lembrete</label>
                <p className="text-[10px] text-surface-400 mb-1">Variáveis: {"{paciente}"} {"{data}"} {"{hora}"}</p>
                <textarea value={waForm.reminderTemplate} onChange={e=>setWaForm(f=>({...f,reminderTemplate:e.target.value}))} className="input-premium w-full h-20 py-2 resize-none"/></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={waForm.enabled} onChange={e=>setWaForm(f=>({...f,enabled:e.target.checked}))} className="w-4 h-4 rounded"/>Habilitado</label>
            </div><button onClick={saveWhatsApp} disabled={saving} className="btn-primary flex items-center gap-2"><CheckCircle size={14}/>{saving?"Salvando...":"Salvar Configuração"}</button></div>}

          {tab==="seguranca" && <div className="glass-card p-6"><h3 className="font-semibold mb-5">Alterar Senha</h3>
            <form onSubmit={changePassword} className="space-y-4 max-w-sm">
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Senha Atual</label><input type="password" value={pwForm.currentPassword} onChange={e=>setPwForm(f=>({...f,currentPassword:e.target.value}))} className="input-premium w-full" required/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Nova Senha</label><input type="password" value={pwForm.newPassword} onChange={e=>setPwForm(f=>({...f,newPassword:e.target.value}))} className="input-premium w-full" required minLength={6}/></div>
              <div><label className="text-xs font-medium text-surface-500 mb-1 block">Confirmar</label><input type="password" value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))} className="input-premium w-full" required/></div>
              <button type="submit" className="btn-primary">Alterar Senha</button>
            </form></div>}

          {tab==="2fa" && <div className="glass-card p-6"><h3 className="font-semibold mb-5 flex items-center gap-2"><Smartphone size={18} className="text-brand-600"/>Autenticação de Dois Fatores</h3>
            <p className="text-sm text-surface-500 mb-4">Adicione uma camada extra de segurança com um app autenticador (Google Authenticator, Authy).</p>
            <div className="space-y-4">
              <button onClick={async()=>{try{const r=await fetch("/api/auth/2fa/setup",{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("accessToken")}`}});const d=await r.json();if(d.qrCode){const el=document.getElementById("qr2fa");if(el) el.innerHTML=`<img src="${d.qrCode}" class="w-48 h-48 mx-auto rounded-xl"/><p class="text-xs text-surface-500 mt-2 text-center">Chave: ${d.secret}</p>`; }}catch{toast.error("Erro")}}} className="btn-primary flex items-center gap-2"><QrCode size={14}/>Gerar QR Code</button>
              <div id="qr2fa"></div>
              <div className="flex gap-2 items-end"><div className="flex-1"><label className="text-xs font-medium text-surface-500 mb-1 block">Código do app (6 dígitos)</label><input id="2fa-code" maxLength={6} className="input-premium w-full" placeholder="000000"/></div>
              <button onClick={async()=>{const code=(document.getElementById("2fa-code")as HTMLInputElement).value;try{await fetch("/api/auth/2fa/verify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("accessToken")}`},body:JSON.stringify({token:code})});toast.success("2FA ativado!")}catch{toast.error("Código inválido")}}} className="btn-primary h-10">Ativar</button></div>
            </div></div>}

          {tab==="assinatura" && <div className="glass-card p-6"><h3 className="font-semibold mb-5 flex items-center gap-2"><Crown size={18} className="text-amber-500"/>Assinatura</h3>
            <p className="text-sm text-surface-500 mb-4">Gerencie seu plano e pagamento.</p>
            <div className="space-y-3">
              <button onClick={async()=>{try{const r=await fetch("/api/stripe/subscription",{headers:{Authorization:`Bearer ${localStorage.getItem("accessToken")}`}});const d=await r.json();if(d.plan){toast.success(`Plano: ${d.plan.name} — Status: ${d.subscription.status}`)}else{toast.info("Sem assinatura ativa")}}catch{}}} className="btn-secondary">Ver meu plano</button>
              <button onClick={async()=>{try{const r=await fetch("/api/stripe/portal",{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("accessToken")}`}});const d=await r.json();if(d.url) window.open(d.url,"_blank")}catch{toast.error("Stripe não configurado")}}} className="btn-primary">Gerenciar Pagamento (Stripe)</button>
            </div></div>}
          {tab==="aparencia" && <div className="glass-card p-6"><h3 className="font-semibold mb-5">Aparência</h3>
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50">
              <div className="flex items-center gap-3">{isDark?<Moon size={18} className="text-brand-400"/>:<Sun size={18} className="text-amber-500"/>}<div><p className="text-sm font-medium">{isDark?"Escuro":"Claro"}</p><p className="text-xs text-surface-500">Preferência visual</p></div></div>
              <button onClick={toggleTheme} className={`w-12 h-6 rounded-full transition-all relative ${isDark?"bg-brand-600":"bg-surface-300"}`} role="switch" aria-checked={isDark}><div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isDark?"left-[26px]":"left-0.5"}`}/></button>
            </div></div>}
        </div>
      </div>
    </MainLayout>);
}
