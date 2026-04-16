import { useCallback } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import ReportTabs from "@/components/relatorios/ReportTabs";
import ReportFilters from "@/components/relatorios/ReportFilters";
import ReportPlaceholder from "@/components/relatorios/ReportPlaceholder";
import RelatorioVendas from "@/components/relatorios/RelatorioVendas";

const TAB_LABELS: Record<string, string> = {
  vendas: "Vendas",
  leads: "Leads",
  negocios: "Negócios",
  "oferta-ativa": "Oferta Ativa",
  conversao: "Conversão",
  empreendimentos: "Empreendimentos",
  origem: "Origem",
  interacao: "Interação",
  visitas: "Visitas",
  tarefas: "Tarefas",
  mega: "✦ Mega",
};

export default function ReportCenter() {
  const { isAdmin, isGestor, isCorretor, loading } = useUserRole();
  const [params, setParams] = useSearchParams();

  const activeTab = params.get("tab") || "vendas";
  const filters = {
    periodo: params.get("periodo") || "mes",
    dataInicio: params.get("de") || undefined,
    dataFim: params.get("ate") || undefined,
    equipe: params.get("equipe") || "",
    corretor: params.get("corretor") || "",
    segmento: params.get("segmento") || "",
  };

  const userRole = isAdmin ? "admin" : isGestor ? "gestor" : "corretor";

  const update = useCallback(
    (patch: Record<string, string>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => {
          if (v) next.set(k, v);
          else next.delete(k);
        });
        return next;
      });
    },
    [setParams]
  );

  if (loading) return null;
  if (isCorretor && !isGestor && !isAdmin) return <Navigate to="/pipeline-leads" replace />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#f0f0f5" }}>
      <ReportTabs
        activeTab={activeTab}
        onTabChange={(tab) => update({ tab })}
      />
      <ReportFilters
        filters={filters}
        onFiltersChange={(f) =>
          update({
            periodo: f.periodo,
            de: f.dataInicio || "",
            ate: f.dataFim || "",
            equipe: f.equipe,
            corretor: f.corretor,
            segmento: f.segmento,
          })
        }
        userRole={userRole}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {activeTab === "vendas" ? (
          <RelatorioVendas filters={filters} userRole={userRole} />
        ) : (
          <ReportPlaceholder tabName={TAB_LABELS[activeTab] || activeTab} />
        )}
      </div>
    </div>
  );
}
