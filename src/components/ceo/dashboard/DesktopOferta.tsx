import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, XCircle, Phone, CalendarCheck, DollarSign, Users, BarChart3, Building2, Target, Megaphone, UserCheck, Activity, Eye } from "lucide-react";
import { StateWrapper } from "@/components/ui/StateWrapper";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import type { KpiDetailType } from "@/components/ceo/KpiDetailDialog";
import { MiniKpi, SectionLabel, HBar, formatBRLCompact, ORIGIN_COLORS, FALLBACK_COLORS } from "./DesktopPrimitives";

export default function DesktopOferta({ model }: { model: CeoDashboardController }) {
  const { setKpiDetail, kpis, prevKpis, teams, corretoresRank, metasDiaTotal, reload, errors, delta, ceoMetas, totalTeam } = model;
  return (<>
<section>
        <SectionLabel icon={Phone}>Oferta Ativa</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniKpi label="Total Ligações" value={kpis.ligacoes.toLocaleString("pt-BR")} variant="highlight"
            delta={delta(kpis.ligacoes, prevKpis?.ligacoes)}
            sub={ceoMetas.meta_ligacoes > 0 ? `${Math.round((kpis.ligacoes / ceoMetas.meta_ligacoes) * 100)}% da meta` : undefined}
            onClick={() => setKpiDetail({ type: "tentativas", label: "Ligações" })} />
          <MiniKpi label="Aproveitados" value={kpis.aproveitados} variant="success"
            delta={delta(kpis.aproveitados, prevKpis?.aproveitados)}
            sub={`Taxa: ${kpis.taxaConversao}%`}
            onClick={() => setKpiDetail({ type: "aproveitados", label: "Aproveitados" })} />

          <MiniKpi label="Metas do Dia" value={`${metasDiaTotal.ligacoes} lig`}
            sub={`${metasDiaTotal.aproveitados} aprov · ${metasDiaTotal.visitasMarcadas} VM`} />
          <MiniKpi label="Taxa Aproveitamento" value={`${kpis.taxaConversao}%`}
            variant={kpis.taxaConversao >= 10 ? "success" : kpis.taxaConversao >= 5 ? "warning" : "default"} />
        </div>

        <Card className="bg-[#f7f7fb] dark:bg-card border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold">Performance por Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <StateWrapper
              error={errors.teams}
              empty={teams.length === 0}
              emptyTitle="Sem dados de equipe no período"
              onRetry={reload}
              errorTitle="Falha ao carregar a performance por equipe"
            >
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left pb-2 font-medium">Equipe</th>
                    <th className="text-right pb-2 font-medium">Ligações</th>
                    <th className="text-right pb-2 font-medium">Aprov.</th>
                    <th className="text-right pb-2 font-medium">Taxa</th>
                    <th className="text-right pb-2 font-medium">V.M</th>
                    <th className="text-right pb-2 font-medium">V.R</th>
                    <th className="text-right pb-2 font-medium">Prop.</th>
                    <th className="text-right pb-2 font-medium">VGV</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.sort((a, b) => b.ligacoes - a.ligacoes).map(t => (
                    <tr key={t.gerente_id} className="border-b border-[#e8e8f0]/50 dark:border-border hover:bg-white/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 font-medium text-foreground">{t.gerente_nome}</td>
                      <td className="py-2 text-right font-semibold text-primary">{t.ligacoes}</td>
                      <td className="py-2 text-right text-success font-semibold">{t.aproveitados}</td>
                      <td className="py-2 text-right">{t.taxa}%</td>
                      <td className="py-2 text-right">{t.visitasMarcadas}</td>
                      <td className="py-2 text-right">{t.visitasRealizadas}</td>
                      <td className="py-2 text-right">{t.propostas}</td>
                      <td className="py-2 text-right font-semibold">{formatBRLCompact(t.vgv)}</td>
                    </tr>
                  ))}
                  {teams.length > 0 && (
                    <tr className="bg-primary/5 font-semibold">
                      <td className="py-2 text-primary">Total</td>
                      <td className="py-2 text-right text-primary">{totalTeam.ligacoes}</td>
                      <td className="py-2 text-right text-success">{totalTeam.aproveitados}</td>
                      <td className="py-2 text-right">{totalTeam.ligacoes > 0 ? Math.round((totalTeam.aproveitados / totalTeam.ligacoes) * 100) : 0}%</td>
                      <td className="py-2 text-right">{totalTeam.visitasMarcadas}</td>
                      <td className="py-2 text-right">{totalTeam.visitasRealizadas}</td>
                      <td className="py-2 text-right">{totalTeam.propostas}</td>
                      <td className="py-2 text-right">{formatBRLCompact(totalTeam.vgv)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </StateWrapper>
          </CardContent>
        </Card>

        {/* Top Corretores */}
        {(corretoresRank.length > 0 || errors.teams) && (
          <Card className="mt-3 bg-[#f7f7fb] dark:bg-card border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold">Top Corretores — Oferta Ativa</CardTitle>
            </CardHeader>
            <CardContent>
              <StateWrapper
                error={errors.teams}
                empty={corretoresRank.length === 0}
                emptyTitle="Sem corretores no período"
                onRetry={reload}
                errorTitle="Falha ao carregar o ranking de corretores"
              >
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left pb-2 font-medium">#</th>
                      <th className="text-left pb-2 font-medium">Corretor</th>
                      <th className="text-left pb-2 font-medium">Equipe</th>
                      <th className="text-right pb-2 font-medium">Lig.</th>
                      <th className="text-right pb-2 font-medium">Aprov.</th>
                      <th className="text-right pb-2 font-medium">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...corretoresRank].sort((a, b) => b.ligacoes - a.ligacoes).slice(0, 10).map((c, i) => (
                      <tr key={c.corretor_id} className="border-b border-[#e8e8f0]/50 dark:border-border">
                        <td className="py-1.5 font-bold text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 font-medium text-foreground">{c.nome}</td>
                        <td className="py-1.5 text-muted-foreground">{c.gerente_nome}</td>
                        <td className="py-1.5 text-right font-semibold text-primary">{c.ligacoes}</td>
                        <td className="py-1.5 text-right text-success font-semibold">{c.aproveitados}</td>
                        <td className="py-1.5 text-right">{c.taxa}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </StateWrapper>
            </CardContent>
          </Card>
        )}
      </section>
  </>);
}
