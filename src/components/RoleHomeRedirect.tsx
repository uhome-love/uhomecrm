import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * Redireciona "/" direto para a home do papel, mostrando apenas um loader
 * enquanto o papel é resolvido — nunca a dashboard errada.
 */
export default function RoleHomeRedirect() {
  const { user } = useAuth();
  const { roles, isAdmin, isDiretor, isGestor, isBackoffice, isRh, loading, error } = useUserRole();

  // Enquanto não temos papéis resolvidos (e sem erro), seguimos em loading — nunca
  // caímos no fallback de corretor por um instante.
  const aguardando = !user || loading || (roles.length === 0 && !error);

  if (aguardando) {
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
