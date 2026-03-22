import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingWizard } from "./OnboardingWizard";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    // Show if: localStorage doesn't have flag AND user hasn't completed onboarding
    const localDone = localStorage.getItem("onboarding_done");
    const profileDone = (user as any)?.onboardingComplete;
    if (!localDone && !profileDone) {
      setShowOnboarding(true);
    }
    setChecked(true);
  }, [loading, isAuthenticated, user]);

  if (!checked || loading) return <>{children}</>;
  
  if (showOnboarding && isAuthenticated) {
    return <OnboardingWizard onComplete={() => { setShowOnboarding(false); }} />;
  }

  return <>{children}</>;
}
