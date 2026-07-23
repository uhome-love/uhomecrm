/**
 * OfertaAtivaAoVivo — página raiz do "Mutirão Inteligente" (Fase 1).
 * Roteia por role:
 *  - corretor  → CorretorScreen (com Onboarding)
 *  - gestor/admin/diretor → PainelAoVivo por padrão; opção Placar TV via ?view=tv
 *  - admin → também mostra AdminSessaoPanel se não existir sessão ao vivo
 */
import { useMemo } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useMutiraoSession } from "@/hooks/useMutiraoSession";
import { CorretorScreen } from "@/components/oferta-ativa-ao-vivo/CorretorScreen";
import { PainelAoVivo } from "@/components/oferta-ativa-ao-vivo/PainelAoVivo";
import { PlacarTv } from "@/components/oferta-ativa-ao-vivo/PlacarTv";
import { AdminSessaoPanel } from "@/components/oferta-ativa-ao-vivo/AdminSessaoPanel";
import { Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfertaAtivaAoVivo() {
  const { user } = useAuth();
  const { isGestor, isAdmin, isDiretor, loading: roleLoading } = useUserRole();
  const [params, setParams] = useSearchParams();
  const view = params.get("view");
  const ms = useMutiraoSession();

  if (roleLoading || ms.sessaoLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const isManagerish = isGestor || isAdmin || isDiretor;
  const isAdminScope = isAdmin || isDiretor;

  // Placar TV (fullscreen)
  if (view === "tv" && isManagerish) {
    return <PlacarTv sessaoId={ms.sessaoId} />;
  }

  // Sem sessão ativa
  if (!ms.sessao) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-border p-8 text-center bg-card">
          <Radio className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Nenhum Mutirão ao vivo agora</h2>
          <p className="text-muted-foreground">
            Quando um mutirão inteligente começar, ele aparecerá aqui automaticamente.
          </p>
        </div>
        {isAdmin && <AdminSessaoPanel />}
      </div>
    );
  }

  // Sessão ativa
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Toggle rápido painel/tv para gestores */}
      {isManagerish && (
        <div className="flex justify-end px-4 pt-3 gap-2">
          <Button
            size="sm"
            variant={view === "corretor" ? "default" : "outline"}
            onClick={() => setParams((p) => { p.set("view", "corretor"); return p; })}
          >
            Como corretor
          </Button>
          <Button
            size="sm"
            variant={!view ? "default" : "outline"}
            onClick={() => setParams((p) => { p.delete("view"); return p; })}
          >
            Painel Ao Vivo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/oferta-ativa-ao-vivo?view=tv`, "_blank")}
          >
            📺 Placar TV
          </Button>
        </div>
      )}

      {isManagerish && view !== "corretor" ? (
        <PainelAoVivo sessaoId={ms.sessaoId!} />
      ) : (
        <CorretorScreen ms={ms} />
      )}

      {isAdmin && <div className="max-w-4xl mx-auto p-4"><AdminSessaoPanel /></div>}
    </div>
  );
}
