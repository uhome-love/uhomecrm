import { useCallback } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import ReportTabs, { type ReportTabKey } from "@/components/relatorios/ReportTabs";
import ReportFilters, { type PeriodKey } from "@/components/relatorios/ReportFilters";
import ReportPlaceholder from "@/components/relatorios/ReportPlaceholder";
import type { DateRange } from "react-day-picker";

const TAB_LABELS: Record<ReportTabKey, string> = {
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

  const activeTab = (params.get("tab") as ReportTabKey) || "vendas";
  const period = (params.get("periodo") as PeriodKey) || "mes";
  const equipe = params.get("equipe") || "todas";
  const corretor = params.get("corretor") || "todos";
  const segmento = params.get("segmento") || "Todos";

  const dateFrom = params.get("de") || undefined;
  const dateTo = params.get("ate") || undefined;
  const dateRange: DateRange | undefined =
    dateFrom ? { from: new Date(dateFrom), to: dateTo ? new Date(dateTo) : undefined } : undefined;

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
    <div className="min-h-full" style={{ backgroundColor: "#f0f0f5" }}>
      <ReportTabs
        activeTab={activeTab}
        onTabChange={(tab) => update({ tab })}
      />

      <ReportFilters
        period={period}
        onPeriodChange={(p) => update({ periodo: p })}
        dateRange={dateRange}
        onDateRangeChange={(r) =>
          update({
            de: r?.from ? r.from.toISOString().slice(0, 10) : "",
            ate: r?.to ? r.to.toISOString().slice(0, 10) : "",
          })
        }
        equipe={equipe}
        onEquipeChange={(v) => update({ equipe: v })}
        corretor={corretor}
        onCorretorChange={(v) => update({ corretor: v })}
        segmento={segmento}
        onSegmentoChange={(v) => update({ segmento: v })}
        isAdmin={isAdmin}
      />

      <div className="p-4">
        <ReportPlaceholder name={TAB_LABELS[activeTab] || activeTab} />
      </div>
    </div>
  );
}
