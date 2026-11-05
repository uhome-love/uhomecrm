import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, StatCard, BarList, fmtNum } from "@/components/ds";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";

/** Widget 2 — Marketing. Só apresentação: mesmos números e detalhes de antes. */
export default function WidgetMarketing({ model }: { model: CeoDashboardController }) {
  const { totalLeadsPeriodo, leadsReaproveitadosOA, origens, leadsPorEmpreendimento, campanhas, setKpiDetail, setBulkEmpOpen, isAdmin, navigate } = model;
  const semEmp = campanhas.some((c) => c.empreendimento === "Sem empreendimento");
  return (
    <Panel title="Marketing" subtitle="Origem dos leads e empreendimentos" icon={Megaphone}
      actions={isAdmin ? <Button variant="outline" size="sm" onClick={() => navigate("/marketing")}>Ver Marketing</Button> : undefined}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="grid grid-cols-2 gap-3 content-start [&>*:first-child]:col-span-2">
        <StatCard size="sm" label="Leads gerados" value={fmtNum(totalLeadsPeriodo)} accent
          onClick={() => setKpiDetail({ type: "total_leads", label: "Leads Gerados" })} />
        <StatCard size="sm" label="Reaproveitados (OA)" value={fmtNum(leadsReaproveitadosOA)}
          onClick={() => setKpiDetail({ type: "reaproveitados_oa", label: "Reaproveitados (OA)" })} />
        <StatCard size="sm" label="Origens ativas" value={fmtNum(origens.length)} sub={origens[0] ? `Top: ${origens[0].origem}` : undefined} />
      </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por origem</p>
          <BarList items={origens.map((o) => ({ label: o.origem, value: o.count }))} limit={5} />
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por empreendimento</p>
            {semEmp && <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setBulkEmpOpen(true)}>Corrigir</Button>}
          </div>
          <BarList items={leadsPorEmpreendimento.map((l) => ({ label: l.emp, value: l.count }))} limit={5} />
        </div>
      </div>
    </Panel>
  );
}
