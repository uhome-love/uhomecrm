import { Target } from "lucide-react";
import { Panel, fmtNum } from "@/components/ds";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { MetricStrip, CompactBars } from "./WidgetParts";

/** Widget 1 — Roleta e Leads. Só apresentação: mesmos números e detalhes de antes. */
export default function WidgetRoleta({ model }: { model: CeoDashboardController }) {
  const { leadsDistribuidos, filaCeoCount, presentesHoje, novoInteresse, leadsPorCorretor, setKpiDetail, setDispatchOpen } = model;
  const comLeads = leadsPorCorretor.filter((c) => c.count > 0);
  const semLeads = leadsPorCorretor.length - comLeads.length;
  return (
    <Panel title="Roleta e Leads" subtitle="Distribuição e presença dos corretores" icon={Target}>
      <div className="space-y-5">
        <MetricStrip items={[
          { label: "Enviados p/ Roleta", value: fmtNum(Math.max(leadsDistribuidos, 0)), onClick: () => setKpiDetail({ type: "enviados_roleta", label: "Enviados p/ Roleta" }) },
          { label: "Fila CEO", value: fmtNum(filaCeoCount), tone: filaCeoCount > 0 ? "warning" : undefined, sub: filaCeoCount > 0 ? "Clique para distribuir" : "Fila vazia", onClick: filaCeoCount > 0 ? () => setDispatchOpen(true) : undefined },
          { label: "Corretores na Roleta", value: fmtNum(presentesHoje), sub: "presentes hoje", onClick: () => setKpiDetail({ type: "presentes_hoje", label: "Corretores na Roleta" }) },
          { label: "Novo interesse", value: fmtNum(novoInteresse) },
        ]} />
        <CompactBars title="Leads por corretor" cols={2} limit={8}
          items={comLeads.map((c) => ({ label: c.nome, value: c.count }))}
          action={semLeads > 0 ? <span className="text-xs text-muted-foreground">{semLeads} corretores sem leads no período</span> : undefined} />
      </div>
    </Panel>
  );
}
