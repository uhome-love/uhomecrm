import { useEffect, useState } from "react";
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
  // Failsafe: se em 6s nada resolver, segue para o fallback em vez de travar no loader.
  const [expirou, setExpirou] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setExpirou(true), 6000);
    return () => window.clearTimeout(t);
  }, []);

  const aguardando = !expirou && (!user || loading || (roles.length === 0 && !error));

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
    ? "/corretor"
    : isRh
    ? "/rh"
    : isDiretor
    ? "/diretora"
    : isGestor
    ? "/gerente/cockpit"
    : "/corretor";

  return <Navigate to={destino} replace />;
}
