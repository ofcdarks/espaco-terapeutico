import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute, ErrorBoundary } from "./components/common";
import { OnboardingWizard } from "./components/OnboardingWizard";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Agenda from "./pages/Agenda";
import Pacientes from "./pages/Pacientes";
import PacienteDetalhe from "./pages/PacienteDetalhe";
import Prontuarios from "./pages/Prontuarios";
import Financeiro from "./pages/Financeiro";
import Documentos from "./pages/Documentos";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Teleconsulta from "./pages/Teleconsulta";
import VideoRoom from "./pages/VideoRoom";
import PatientWaiting from "./pages/PatientWaiting";
import Portal from "./pages/Portal";
import Admin from "./pages/Admin";
import Contratos from "./pages/Contratos";
import AssinarContrato from "./pages/AssinarContrato";
import NotFound from "./pages/NotFound";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const alreadyDone = localStorage.getItem("onboarding_done") === "true";
  const [dismissed, setDismissed] = useState(alreadyDone || !!(user as any)?.onboardingComplete);

  if (!dismissed && user) {
    return <OnboardingWizard onComplete={() => setDismissed(true)} />;
  }
  return <>{children}</>;
}

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><ErrorBoundary><OnboardingGate>{children}</OnboardingGate></ErrorBoundary></ProtectedRoute>
);

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <Toaster position="top-right" toastOptions={{ style: { borderRadius: "12px", fontSize: "13px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" } }} />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/teleconsulta/entrar/:sessionId" element={<PatientWaiting />} />
              <Route path="/portal/:patientId" element={<Portal />} />
              <Route path="/assinar/:id" element={<AssinarContrato />} />
              <Route path="/" element={<P><Dashboard /></P>} />
              <Route path="/agenda" element={<P><Agenda /></P>} />
              <Route path="/pacientes" element={<P><Pacientes /></P>} />
              <Route path="/pacientes/:id" element={<P><PacienteDetalhe /></P>} />
              <Route path="/prontuarios" element={<P><Prontuarios /></P>} />
              <Route path="/financeiro" element={<P><Financeiro /></P>} />
              <Route path="/documentos" element={<P><Documentos /></P>} />
              <Route path="/contratos" element={<P><Contratos /></P>} />
              <Route path="/relatorios" element={<P><Relatorios /></P>} />
              <Route path="/configuracoes" element={<P><Configuracoes /></P>} />
              <Route path="/teleconsulta" element={<P><Teleconsulta /></P>} />
              <Route path="/teleconsulta/sala/:sessionId" element={<P><VideoRoom /></P>} />
              <Route path="/admin" element={<P><Admin /></P>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
