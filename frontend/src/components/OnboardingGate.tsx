import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingWizard } from "./OnboardingWizard";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading || !isAuthenticated || !user) { setChecked(true); return; }
    const localDone = localStorage.getItem("onboarding_done");
    const profileDone = (user as any)?.onboardingComplete;
    if (!localDone && !profileDone) setShowOnboarding(true);
    setChecked(true);
  }, [loading, isAuthenticated, user]);

  if (!checked) return null;
  if (showOnboarding && isAuthenticated) {
    return <OnboardingWizard onComplete={() => { localStorage.setItem("onboarding_done", "true"); setShowOnboarding(false); }} />;
  }
  return <>{children}</>;
}
