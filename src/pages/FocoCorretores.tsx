import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Target, BarChart3 } from "lucide-react";
import { FocoAlocacaoTab } from "@/components/foco/FocoAlocacaoTab";
import { FocoDadosTab } from "@/components/foco/FocoDadosTab";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

type Tab = "alocacao" | "dados";

/**
 * /foco-corretores — CEO/Diretor/Gestor definem quais empreendimentos cada
 * corretor atende (aba Alocação) e visualizam a matriz de performance
 * corretor × empreendimento (aba Dados).
 *
 * Fase 3 do plano "Foco Corretores + Mapeador Meta".
 */
export default function FocoCorretores() {
  const { isAdmin, isDiretor, isGestor, loading } = useUserRole();
  const [tab, setTab] = useState<Tab>("alocacao");

  if (loading) return null;
  if (!(isAdmin || isDiretor || isGestor)) return <Navigate to="/" replace />;

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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab("alocacao")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition",
                tab === "alocacao" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              )}
            >
              <Target className="h-3.5 w-3.5" /> Alocação
            </button>
            <button
              onClick={() => setTab("dados")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition",
                tab === "dados" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Dados
            </button>
          </div>
        </CardContent>
      </Card>

      {tab === "alocacao" ? <FocoAlocacaoTab /> : <FocoDadosTab />}
    </div>
  );
}
