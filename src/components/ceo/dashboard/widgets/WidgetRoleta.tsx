import { Target } from "lucide-react";
import { Panel, StatCard, BarList, fmtNum } from "@/components/ds";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";

/** Widget 1 — Roleta e Leads. Só apresentação: mesmos números e detalhes de antes. */
export default function WidgetRoleta({ model }: { model: CeoDashboardController }) {
  const { leadsDistribuidos, filaCeoCount, presentesHoje, novoInteresse, leadsPorCorretor, setKpiDetail, setDispatchOpen } = model;
  const comLeads = leadsPorCorretor.filter((c) => c.count > 0);
  const semLeads = leadsPorCorretor.length - comLeads.length;
  return (
    <Panel title="Roleta e Leads" subtitle="Distribuição e presença dos corretores" icon={Target}
      footer={semLeads > 0 ? `${semLeads} corretores sem leads no período` : undefined}>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard size="sm" label="Enviados p/ Roleta" value={fmtNum(Math.max(leadsDistribuidos, 0))}
          onClick={() => setKpiDetail({ type: "enviados_roleta", label: "Enviados p/ Roleta" })} />
        <StatCard size="sm" label="Fila CEO" value={fmtNum(filaCeoCount)} tone={filaCeoCount > 0 ? "warning" : undefined}
          sub={filaCeoCount > 0 ? "Clique para distribuir" : "Fila vazia"}
          onClick={filaCeoCount > 0 ? () => setDispatchOpen(true) : undefined} />
        <StatCard size="sm" label="Corretores na Roleta" value={fmtNum(presentesHoje)} sub="presentes hoje"
          onClick={() => setKpiDetail({ type: "presentes_hoje", label: "Corretores na Roleta" })} />
        <StatCard size="sm" label="Novo interesse" value={fmtNum(novoInteresse)} />
      </div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leads por corretor</p>
      <BarList items={comLeads.map((c) => ({ label: c.nome, value: c.count }))} emptyText="Nenhum lead no período." />
    </Panel>
  );
}
