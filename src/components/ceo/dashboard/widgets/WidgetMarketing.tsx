import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, fmtNum } from "@/components/ds";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { MetricStrip, CompactBars } from "./WidgetParts";

/** Widget 2 — Marketing. Só apresentação: mesmos números e detalhes de antes. */
export default function WidgetMarketing({ model }: { model: CeoDashboardController }) {
  const { totalLeadsPeriodo, leadsReaproveitadosOA, origens, leadsPorEmpreendimento, campanhas, setKpiDetail, setBulkEmpOpen, isAdmin, navigate } = model;
  const semEmp = campanhas.some((c) => c.empreendimento === "Sem empreendimento");
  return (
    <Panel title="Marketing" subtitle="Origem dos leads e empreendimentos" icon={Megaphone}
      actions={isAdmin ? <Button variant="outline" size="sm" onClick={() => navigate("/marketing")}>Ver Marketing</Button> : undefined}>
      <div className="space-y-5">
        <MetricStrip items={[
          { label: "Leads gerados", value: fmtNum(totalLeadsPeriodo), accent: true, onClick: () => setKpiDetail({ type: "total_leads", label: "Leads Gerados" }) },
          { label: "Reaproveitados (OA)", value: fmtNum(leadsReaproveitadosOA), onClick: () => setKpiDetail({ type: "reaproveitados_oa", label: "Reaproveitados (OA)" }) },
          { label: "Origens ativas", value: fmtNum(origens.length) },
          { label: "Top origem", value: origens[0]?.origem || "—" },
        ]} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CompactBars title="Por origem" limit={4} items={origens.map((o) => ({ label: o.origem, value: o.count }))} />
          <CompactBars title="Por empreendimento" limit={4} items={leadsPorEmpreendimento.map((l) => ({ label: l.emp, value: l.count }))}
            action={semEmp ? <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setBulkEmpOpen(true)}>Corrigir</Button> : undefined} />
        </div>
      </div>
    </Panel>
  );
}
