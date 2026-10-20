import { ChevronRight } from "lucide-react";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import type { KpiDetailType } from "@/components/ceo/KpiDetailDialog";
import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { Button } from "@/components/ui/button";
import { StateWrapper } from "@/components/ui/StateWrapper";
import { MobileSection, MobileKpiRail, MobileDisclosure, MobileDataRow } from "./MobilePrimitives";

export default function MobileNegocios({ model: m }: { model: CeoDashboardController }) {
  const money = (value: number) => fmtMoney(value, "short");
  const detail = (type: KpiDetailType, label: string) => () => m.setKpiDetail({ type, label });
  const vgvSub = m.kpis.vgvAssinado === 0 && m.vgvMesAtual.vgv > 0
    ? `sem assinatura no período · mês: ${money(m.vgvMesAtual.vgv)}`
    : (m.ceoMetas.meta_vgv_assinado ?? 0) > 0 ? `${Math.round((m.kpis.vgvAssinado / (m.ceoMetas.meta_vgv_assinado ?? 1)) * 100)}% da meta · ${m.periodoLabel}` : `no período ${m.periodoLabel}`;
  return <MobileSection title="Gestão de negócios">
    <MobileKpiRail label="Indicadores de negócios" items={[
      { label: "VGV Assinado", value: money(m.kpis.vgvAssinado), tone: "success", delta: m.delta(m.kpis.vgvAssinado, m.prevKpis?.vgvAssinado), sub: vgvSub, onClick: detail("vgv_assinado", "VGV Assinado") },
      { label: "Total de Negócios", value: m.totalNeg, sub: "situação atual do pipeline", tone: "primary", onClick: detail("negocios", "Negócios ativos") },
      { label: "VGV em Contrato Gerado", value: m.vgvContrato > 0 ? money(m.vgvContrato) : "sem valor", sub: `${m.countContrato} negócio${m.countContrato !== 1 ? "s" : ""} · situação atual`, onClick: detail("contratos", "Negócios em contrato") },
      { label: "Propostas", value: m.kpis.propostas, delta: m.delta(m.kpis.propostas, m.prevKpis?.propostas), sub: (m.ceoMetas.meta_propostas ?? 0) > 0 ? `meta: ${m.ceoMetas.meta_propostas}` : `no período ${m.periodoLabel}`, onClick: detail("propostas", "Propostas") },
    ]} />
    <MobileDisclosure title="Funil de Negócios e conversões">
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">Documentação, Em Negociação e Contrato = situação atual do pipeline (não filtram por período) · Ganho = vendas assinadas em {m.periodoLabel}</p>
      <StateWrapper error={m.errors.negocios} onRetry={m.reload} errorTitle="Falha ao carregar o funil de negócios">
        {m.negFunnelOrder.map((fase) => {
          const data = m.negocioFases.find((f) => f.fase === fase);
          const type: KpiDetailType | null = fase === "proposta" ? "negociacao" : fase === "contrato_gerado" ? "contratos" : fase === "ganho" ? "vgv_assinado" : null;
          const content = <MobileDataRow label={m.negFunnelLabels[fase] || fase} value={data?.count ?? 0} sub={data?.vgv ? money(data.vgv) : "—"} />;
          return type ? <Button key={fase} variant="ghost" onClick={detail(type, m.negFunnelLabels[fase] || fase)} className="block h-auto w-full rounded-none p-0 text-left [&>div]:w-full">{content}</Button> : <div key={fase}>{content}</div>;
        })}
        {m.conversoes.map((c) => <MobileDataRow key={c.label} label={c.label} value={c.value} sub={c.sub} />)}
      </StateWrapper>
    </MobileDisclosure>
    <MobileDisclosure title={`Vendas assinadas no período · ${m.vendasPeriodo.length}`}>
      <p className="mb-3 text-xs font-semibold text-success">{m.vendasPeriodo.length} venda{m.vendasPeriodo.length !== 1 ? "s" : ""} · {money(m.kpis.vgvAssinado)}</p>
      {m.vendasPeriodo.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma venda assinada no período.</p>}
      {m.vendasPeriodo.map((sale) => {
        const content = <div className="flex w-full items-center justify-between gap-3 border-t border-border py-4">
          <div className="min-w-0"><p className="break-words text-[15px] font-semibold text-foreground">{sale.cliente}</p><p className="mt-1 break-words text-xs text-muted-foreground">{sale.empreendimento}</p><p className="mt-1 text-xs text-muted-foreground">{sale.corretor} · {sale.dataAssinatura ? formatBRT(`${sale.dataAssinatura}T12:00:00-03:00`, "dd/MM/yy") : "—"}</p><p className="mt-2 text-sm font-bold text-success">{money(sale.vgv)}</p></div>
          {sale.leadId && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </div>;
        return sale.leadId ? <Button key={sale.id} variant="ghost" className="h-auto w-full whitespace-normal rounded-none p-0 text-left" onClick={() => m.navigate(`/pipeline-leads?lead=${sale.leadId}`)}>{content}</Button> : <div key={sale.id}>{content}</div>;
      })}
    </MobileDisclosure>
  </MobileSection>;
}