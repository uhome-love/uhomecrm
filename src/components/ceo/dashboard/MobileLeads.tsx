import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { Button } from "@/components/ui/button";
import { MobileSection, MobileKpiRail, MobileDisclosure, MobileDataRow } from "./MobilePrimitives";

export default function MobileLeads({ model: m }: { model: CeoDashboardController }) {
  const detail = (type: Parameters<typeof m.setKpiDetail>[0] extends infer _T ? "total_leads" | "reaproveitados_oa" | "enviados_roleta" | "presentes_hoje" : never, label: string) => () => m.setKpiDetail({ type, label });
  const empSum = m.leadsPorEmpreendimento.reduce((s, x) => s + x.count, 0);
  const corretorSum = m.leadsPorCorretor.reduce((s, x) => s + x.count, 0);
  return <MobileSection title="Roleta de leads" suffix={<span className="text-[11px] text-muted-foreground">{m.periodoLabel}</span>}>
    <MobileKpiRail label="Indicadores de leads" items={[
      { label: "Leads Gerados (Mkt)", value: m.totalLeadsPeriodo, sub: "Meta, TikTok, LP, ImovelWeb...", tone: "primary", onClick: detail("total_leads", "Leads Gerados") },
      { label: "Reaproveitados (OA)", value: m.leadsReaproveitadosOA, sub: "Leads da Oferta Ativa", tone: "warning", onClick: detail("reaproveitados_oa", "Reaproveitados (OA)") },
      { label: "Enviados p/ Roleta", value: m.leadsDistribuidos > 0 ? m.leadsDistribuidos : 0, sub: m.filaCeoCount > 0 ? `${m.filaCeoCount} na fila` : "Fila vazia", onClick: detail("enviados_roleta", "Enviados p/ Roleta") },
      { label: "Novo Interesse", value: m.novoInteresse, sub: "Leads com novo interesse" },
      { label: "Corretores na Roleta", value: m.presentesHoje, sub: `${m.presentesHoje} presentes hoje`, onClick: detail("presentes_hoje", "Corretores na Roleta") },
    ]} />
    <MobileDisclosure title="Leads por Empreendimento">
      {m.campanhas.some((c) => c.empreendimento === "Sem empreendimento") && <Button variant="outline" className="mb-2 h-11" onClick={() => m.setBulkEmpOpen(true)}>Corrigir</Button>}
      {m.leadsPorEmpreendimento.slice(0, 10).map((lead) => <MobileDataRow key={lead.emp} label={lead.emp} value={lead.count} />)}
      {m.leadsPorEmpreendimento.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : <MobileDataRow label="Soma" value={empSum} sub={empSum !== m.totalLeadsPeriodo ? `Total marketing: ${m.totalLeadsPeriodo}` : undefined} />}
    </MobileDisclosure>
    <MobileDisclosure title="Leads por Origem">
      {m.origens.slice(0, 8).map((origem) => <MobileDataRow key={origem.origem} label={origem.origem} value={origem.count} />)}
      {m.origens.length === 0 && <p className="text-sm text-muted-foreground">Sem dados</p>}
    </MobileDisclosure>
    <MobileDisclosure title="Leads por Corretor">
      {(m.showAllCorretorLeads ? m.leadsPorCorretor : m.leadsPorCorretor.slice(0, 6)).map((corretor, index) => <MobileDataRow key={`${corretor.nome}-${index}`} label={corretor.nome} value={corretor.count} />)}
      {m.leadsPorCorretor.length > 6 && <Button variant="ghost" className="h-11 w-full text-primary" onClick={() => m.setShowAllCorretorLeads(!m.showAllCorretorLeads)}>{m.showAllCorretorLeads ? "Ver menos" : `Ver mais (${m.leadsPorCorretor.length})`}</Button>}
      {m.leadsPorCorretor.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : <MobileDataRow label="Soma" value={corretorSum} sub={corretorSum !== m.totalLeadsPeriodo ? `Total marketing: ${m.totalLeadsPeriodo}` : undefined} />}
    </MobileDisclosure>
  </MobileSection>;
}