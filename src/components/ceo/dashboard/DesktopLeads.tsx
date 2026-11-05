import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, Target, Megaphone } from "lucide-react";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { MiniKpi, SectionLabel, HBar, ORIGIN_COLORS, FALLBACK_COLORS } from "./DesktopPrimitives";


export default function DesktopLeads({ model }: { model: CeoDashboardController }) {
  const { filaCeoCount, setBulkEmpOpen, setKpiDetail, showAllCorretorLeads, setShowAllCorretorLeads, campanhas, origens, leadsPorEmpreendimento, leadsPorCorretor, totalLeadsPeriodo, leadsReaproveitadosOA, novoInteresse, presentesHoje, hoje, leadsDistribuidos } = model;
  return (<>
<section>
        <SectionLabel icon={Target}>Roleta de Leads</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <MiniKpi label="Leads Gerados (Mkt)" value={totalLeadsPeriodo} variant="highlight"
            sub="Meta, TikTok, LP, ImovelWeb..."
            onClick={() => setKpiDetail({ type: "total_leads", label: "Leads Gerados" })} />
          <MiniKpi label="Reaproveitados (OA)" value={leadsReaproveitadosOA} variant="warning"
            sub="Leads da Oferta Ativa"
            onClick={() => setKpiDetail({ type: "reaproveitados_oa", label: "Reaproveitados (OA)" })} />
          <MiniKpi label="Enviados p/ Roleta" value={leadsDistribuidos > 0 ? leadsDistribuidos : 0}
            sub={filaCeoCount > 0 ? `${filaCeoCount} na fila` : "Fila vazia"}
            onClick={() => setKpiDetail({ type: "enviados_roleta", label: "Enviados p/ Roleta" })} />
          <MiniKpi label="Novo Interesse" value={novoInteresse}
            sub="Leads com novo interesse" />
          <MiniKpi label="Corretores na Roleta" value={presentesHoje} sub={`${presentesHoje} presentes hoje`}
            onClick={() => setKpiDetail({ type: "presentes_hoje", label: "Corretores na Roleta" })} />
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Leads por Campanha/Empreendimento */}
          <Card className="bg-[var(--ceo-desktop-surface)] dark:bg-card border-border shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-primary" /> Leads por Empreendimento
                </CardTitle>
                {campanhas.some(c => c.empreendimento === "Sem empreendimento") && (
                  <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setBulkEmpOpen(true)}>Corrigir</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {leadsPorEmpreendimento.slice(0, 10).map((l, idx) => {
                  const max = Math.max(...leadsPorEmpreendimento.map(x => x.count), 1);
                  const color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return <HBar key={l.emp} label={l.emp} value={l.count} max={max} color={color} />;
                })}
                {leadsPorEmpreendimento.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
              </div>
              {leadsPorEmpreendimento.length > 0 && (
                <p className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground text-right">
                  Soma: <span className="font-semibold text-foreground">{leadsPorEmpreendimento.reduce((s, x) => s + x.count, 0)}</span>
                  {leadsPorEmpreendimento.reduce((s, x) => s + x.count, 0) !== totalLeadsPeriodo && (
                    <> · Total marketing: <span className="font-semibold text-foreground">{totalLeadsPeriodo}</span></>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Leads por Origem */}
          <Card className="bg-[var(--ceo-desktop-surface)] dark:bg-card border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-primary" /> Leads por Origem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {origens.slice(0, 8).map((o, idx) => {
                  const max = Math.max(...origens.map(x => x.count), 1);
                  const color = ORIGIN_COLORS[o.origem] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return <HBar key={o.origem} label={o.origem} value={o.count} max={max} color={color} />;
                })}
                {origens.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
              </div>
            </CardContent>
          </Card>

          {/* Leads por Corretor */}
          <Card className="bg-[var(--ceo-desktop-surface)] dark:bg-card border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-primary" /> Leads por Corretor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`space-y-2.5 ${showAllCorretorLeads ? "" : ""}`}>
                {(showAllCorretorLeads ? leadsPorCorretor : leadsPorCorretor.slice(0, 6)).map((c, idx) => {
                  const max = Math.max(...leadsPorCorretor.map(x => x.count), 1);
                  const color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return <HBar key={`${c.nome}-${idx}`} label={c.nome} value={c.count} max={max} color={color} />;
                })}
                {leadsPorCorretor.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
              </div>
              {leadsPorCorretor.length > 6 && (
                <Button variant="ghost" size="sm" className="w-full mt-2 text-[10px] text-primary hover:text-primary/80" onClick={() => setShowAllCorretorLeads(!showAllCorretorLeads)}>
                  {showAllCorretorLeads ? "Ver menos" : `Ver mais (${leadsPorCorretor.length})`}
                </Button>
              )}
              {leadsPorCorretor.length > 0 && (
                <p className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground text-right">
                  Soma: <span className="font-semibold text-foreground">{leadsPorCorretor.reduce((s, x) => s + x.count, 0)}</span>
                  {leadsPorCorretor.reduce((s, x) => s + x.count, 0) !== totalLeadsPeriodo && (
                    <> · Total marketing: <span className="font-semibold text-foreground">{totalLeadsPeriodo}</span></>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
  </>);
}
