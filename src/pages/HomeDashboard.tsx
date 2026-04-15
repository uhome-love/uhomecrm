import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

/**
 * HomeDashboard — pure redirect hub.
 * Routes "/" to the correct role-specific dashboard.
 * Never renders dashboard content itself.
 */
export default function HomeDashboard() {
  const { user } = useAuth();
  const { isAdmin, isGestor, isBackoffice, isRh, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (roleLoading || !user) return;
    const currentPath = window.location.pathname;
    if (currentPath !== "/" && currentPath !== "/index.html" && currentPath !== "/index") return;

    if (isAdmin) {
      navigate("/ceo", { replace: true });
    } else if (isBackoffice) {
      navigate("/backoffice", { replace: true });
    } else if (isRh) {
      navigate("/rh", { replace: true });
    } else if (isGestor) {
      navigate("/gerente/dashboard", { replace: true });
    } else {
      navigate("/corretor", { replace: true });
    }
  }, [isAdmin, isGestor, isBackoffice, isRh, roleLoading, navigate, user]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <img src="/images/uhome-logo-128.png" alt="Uhome" className="h-16 w-16 animate-pulse" />
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
