import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { StateWrapper } from "@/components/ui/StateWrapper";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import type { KpiDetailType } from "@/components/ceo/KpiDetailDialog";
import { MiniKpi, SectionLabel, formatBRLCompact } from "./DesktopPrimitives";


export default function DesktopNegocios({ model }: { model: CeoDashboardController }) {
  const { navigate, setKpiDetail, kpis, prevKpis, negocioFases, vendasPeriodo, vgvMesAtual, reload, errors, delta, ceoMetas, totalNeg, vgvContrato, countContrato, periodoLabel, conversoes, negFunnelOrder, negFunnelLabels, negFunnelColors } = model;
  return (<>
<section>
        <SectionLabel icon={DollarSign}>Gestão de Negócios</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniKpi label="Total de Negócios" value={totalNeg} variant="highlight"
            sub="situação atual do pipeline"
            onClick={() => setKpiDetail({ type: "negocios", label: "Negócios ativos" })} />
          <MiniKpi label="VGV em Contrato Gerado" value={vgvContrato > 0 ? formatBRLCompact(vgvContrato) : "sem valor"}
            sub={`${countContrato} negócio${countContrato !== 1 ? "s" : ""} · situação atual`}
            onClick={() => setKpiDetail({ type: "contratos", label: "Negócios em contrato" })} />
          <MiniKpi label="VGV Assinado" value={formatBRLCompact(kpis.vgvAssinado)} variant="success"
            delta={delta(kpis.vgvAssinado, prevKpis?.vgvAssinado)}
            sub={
              kpis.vgvAssinado === 0 && vgvMesAtual.vgv > 0
                ? `sem assinatura no período · mês: ${formatBRLCompact(vgvMesAtual.vgv)}`
                : ceoMetas.meta_vgv_assinado > 0
                  ? `${Math.round((kpis.vgvAssinado / ceoMetas.meta_vgv_assinado) * 100)}% da meta · ${periodoLabel}`
                  : `no período ${periodoLabel}`
            }
            onClick={() => setKpiDetail({ type: "vgv_assinado", label: "VGV Assinado" })} />
          <MiniKpi label="Propostas" value={kpis.propostas}
            delta={delta(kpis.propostas, prevKpis?.propostas)}
            sub={ceoMetas.meta_propostas > 0 ? `meta: ${ceoMetas.meta_propostas}` : `no período ${periodoLabel}`}
            onClick={() => setKpiDetail({ type: "propostas", label: "Propostas" })} />
        </div>

        <Card className="bg-[var(--ceo-desktop-surface)] dark:bg-card border-border shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-semibold">Funil de Negócios</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Documentação, Em Negociação e Contrato = situação atual do pipeline (não filtram por período) · Ganho = vendas assinadas em {periodoLabel}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <StateWrapper
              error={errors.negocios}
              onRetry={reload}
              errorTitle="Falha ao carregar o funil de negócios"
              className="space-y-4"
            >
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
              {negFunnelOrder.map((fase, idx) => {
                const data = negocioFases.find((f) => f.fase === fase);
                const count = data?.count || 0;
                const vgv = data?.vgv || 0;
                const maxCount = Math.max(...negocioFases.map((f) => f.count), 1);
                const widthPct = maxCount > 0 ? Math.max((count / maxCount) * 100, 18) : 18;
                const color = negFunnelColors[fase] || "var(--ceo-chart-fallback)";
                const isCaiu = fase.toLowerCase().includes("caiu") || fase.toLowerCase().includes("perdid");
                const detailType: KpiDetailType | null =
                  fase === "proposta" ? "negociacao" : fase === "contrato_gerado" ? "contratos" : fase === "ganho" ? "vgv_assinado" : null;
                return (
                  <button
                    key={fase}
                    type="button"
                    disabled={!detailType}
                    onClick={() => detailType && setKpiDetail({ type: detailType, label: negFunnelLabels[fase] || fase })}
                    className={`flex flex-col items-center text-center gap-2 rounded-lg p-1 ${detailType ? "hover:bg-[var(--ceo-desktop-solid-60)] dark:hover:bg-[var(--ceo-desktop-solid-04)] transition-colors" : "cursor-default"}`}
                  >
                    <span className="text-2xl font-[800] leading-none" style={{ color }}>
                      {count}
                    </span>
                    <div className="w-full flex justify-center">
                      <div
                        className="h-3 rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${widthPct}%`,
                          minWidth: "20px",
                          backgroundColor: color,
                          opacity: isCaiu ? 0.7 : 1,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground leading-tight">
                      {negFunnelLabels[fase] || fase}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {vgv > 0 ? formatBRLCompact(vgv) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Taxas de conversão do período */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              {conversoes.map(c => (
                <div key={c.label} className="bg-[var(--ceo-desktop-solid)] dark:bg-muted/50 rounded-lg px-3 py-2 border border-[var(--ceo-desktop-line)] dark:border-border">
                  <p className="text-[10px] text-muted-foreground truncate">{c.label}</p>
                  <p className="text-base font-[800] text-foreground leading-tight">{c.value}</p>
                  <p className="text-[9px] text-muted-foreground/70 truncate">{c.sub}</p>
                </div>
              ))}
            </div>
            </StateWrapper>
          </CardContent>
        </Card>

        {/* Vendas assinadas no período */}
        <Card className="bg-[var(--ceo-desktop-surface)] dark:bg-card border-border shadow-none mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-success" /> Vendas assinadas no período
              <span className="text-[10px] font-normal text-muted-foreground">
                {vendasPeriodo.length} venda{vendasPeriodo.length !== 1 ? "s" : ""} · {formatBRLCompact(kpis.vgvAssinado)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vendasPeriodo.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-4 text-center">Nenhuma venda assinada no período.</p>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[var(--ceo-desktop-surface)] dark:bg-card">
                    <tr className="text-[10px] text-muted-foreground text-left">
                      <th className="py-1.5 pr-2 font-medium">Cliente</th>
                      <th className="py-1.5 pr-2 font-medium">Empreendimento</th>
                      <th className="py-1.5 pr-2 font-medium">Corretor</th>
                      <th className="py-1.5 pr-2 font-medium text-right">VGV</th>
                      <th className="py-1.5 font-medium text-right">Assinatura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasPeriodo.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => v.leadId && navigate(`/pipeline-leads?lead=${v.leadId}`)}
                        className={`border-t border-[var(--ceo-desktop-line)] dark:border-border ${v.leadId ? "cursor-pointer hover:bg-[var(--ceo-desktop-solid-60)] dark:hover:bg-[var(--ceo-desktop-solid-04)]" : ""}`}
                      >
                        <td className="py-1.5 pr-2 font-medium text-foreground truncate max-w-[160px]">{v.cliente}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground truncate max-w-[160px]">{v.empreendimento}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground truncate max-w-[140px]">{v.corretor}</td>
                        <td className="py-1.5 pr-2 text-right font-semibold text-success">{formatBRLCompact(v.vgv)}</td>
                        <td className="py-1.5 text-right text-muted-foreground">
                          {v.dataAssinatura ? format(new Date(v.dataAssinatura + "T12:00:00"), "dd/MM/yy") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
  </>);
}
