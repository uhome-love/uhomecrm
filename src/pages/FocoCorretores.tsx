import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Target, BarChart3, Building2 } from "lucide-react";
import { FocoAlocacaoTab } from "@/components/foco/FocoAlocacaoTab";
import { FocoDadosTab } from "@/components/foco/FocoDadosTab";
import { FocoEmpreendimentosTab } from "@/components/foco/FocoEmpreendimentosTab";
import { ProdutosNaoIdentificadosCard } from "@/components/foco/ProdutosNaoIdentificadosCard";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

type Tab = "alocacao" | "dados" | "empreendimentos";

/**
 * /foco-corretores — CEO/Diretor/Gestor definem quais empreendimentos cada
 * corretor atende (aba Alocação), visualizam performance (Dados) e o CEO
 * habilita/desabilita empreendimentos (Empreendimentos).
 */
export default function FocoCorretores() {
  const { isAdmin, isDiretor, isGestor, loading } = useUserRole();
  const [tab, setTab] = useState<Tab>("alocacao");

  if (loading) return null;
  if (!(isAdmin || isDiretor || isGestor)) return <Navigate to="/" replace />;

  const canManageEmpreendimentos = isAdmin || isDiretor;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: "alocacao", label: "Alocação", icon: <Target className="h-3.5 w-3.5" />, visible: true },
    { id: "dados", label: "Dados", icon: <BarChart3 className="h-3.5 w-3.5" />, visible: true },
    { id: "empreendimentos", label: "Empreendimentos", icon: <Building2 className="h-3.5 w-3.5" />, visible: canManageEmpreendimentos },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" /> Foco Corretores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Defina os empreendimentos que cada corretor atende e acompanhe a performance por produto.
        </p>
      </div>

      <Card>
        <CardContent className="p-2">
          <div className="flex items-center gap-1 flex-wrap">
            {tabs.filter((t) => t.visible).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition",
                  tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {tab === "alocacao" && (
        <>
          <ProdutosNaoIdentificadosCard />
          <FocoAlocacaoTab />
        </>
      )}
      {tab === "dados" && <FocoDadosTab />}
      {tab === "empreendimentos" && canManageEmpreendimentos && <FocoEmpreendimentosTab />}
    </div>
  );
}

