import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

/**
 * Redireciona "/" direto para a home do papel, mostrando apenas um loader
 * enquanto o papel é resolvido — nunca a dashboard errada.
 */
export default function RoleHomeRedirect() {
  const { isAdmin, isDiretor, isGestor, isBackoffice, isRh, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <img src="/images/uhome-logo-128.png" alt="Uhome" className="h-16 w-16 animate-pulse" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const destino = isAdmin
    ? "/ceo"
    : isBackoffice
    ? "/backoffice"
    : isRh
    ? "/rh"
    : isDiretor
    ? "/ceo"
    : isGestor
    ? "/gerente/dashboard"
    : "/corretor";

  return <Navigate to={destino} replace />;
}
