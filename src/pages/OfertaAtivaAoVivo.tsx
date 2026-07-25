/**
 * OfertaAtivaAoVivo — página raiz do "Mutirão Inteligente" (Fase 1).
 * Abas no topo:
 *  - Como corretor
 *  - Painel Ao Vivo (gestor/admin/diretor)
 *  - Placar TV (gestor/admin/diretor)
 *  - ⚙️ Configurações (admin/diretor) → AdminSessaoPanel
 */
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

type View = "corretor" | "painel" | "tv" | "config";

export default function OfertaAtivaAoVivo() {
  const { user } = useAuth();
  const { isGestor, isAdmin, isDiretor, loading: roleLoading } = useUserRole();
  const [params, setParams] = useSearchParams();
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

  const raw = (params.get("view") as View | null) ?? (isManagerish ? "painel" : "corretor");
  const view: View = raw === "config" && !isAdminScope
    ? (isManagerish ? "painel" : "corretor")
    : (raw === "painel" || raw === "tv") && !isManagerish
      ? "corretor"
      : raw;

  const setView = (v: View) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (v === "corretor" && !isManagerish) next.delete("view");
    else next.set("view", v);
    return next;
  });

  // Placar TV (fullscreen dedicado, sem chrome)
  if (view === "tv") {
    return <PlacarTv sessaoId={ms.sessaoId} />;
  }

  const tab = (v: View, label: string) => (
    <Button
      key={v}
      size="sm"
      variant={view === v ? "default" : "outline"}
      onClick={() => setView(v)}
    >
      {label}
    </Button>
  );

  const Tabs = (
    <div className="flex flex-wrap justify-end px-4 pt-3 gap-2">
      {tab("corretor", "Como corretor")}
      {isManagerish && tab("painel", "Painel Ao Vivo")}
      {isManagerish && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`/placar-tv`, "_blank")}
        >
          📺 Placar TV
        </Button>
      )}
      {isAdminScope && tab("config", "⚙️ Configurações")}
    </div>
  );

  // Configurações sempre acessível para admin, mesmo sem sessão
  if (view === "config") {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        {Tabs}
        <div className="max-w-4xl mx-auto p-4">
          <AdminSessaoPanel />
        </div>
      </div>
    );
  }

  // Sem sessão ativa
  if (!ms.sessao) {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        {Tabs}
        <div className="p-6 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-border p-8 text-center bg-card">
            <Radio className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Nenhum Mutirão ao vivo agora</h2>
            <p className="text-muted-foreground">
              Quando um mutirão inteligente começar, ele aparecerá aqui automaticamente.
            </p>
            {isAdminScope && (
              <Button className="mt-6" onClick={() => setView("config")}>
                Ir para Configurações
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Sessão ativa
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {Tabs}
      {view === "painel" && isManagerish ? (
        <PainelAoVivo sessaoId={ms.sessaoId!} />
      ) : (
        <CorretorScreen ms={ms} />
      )}
    </div>
  );
}
