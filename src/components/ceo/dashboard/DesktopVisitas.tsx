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

export default function DesktopVisitas({ model }: { model: CeoDashboardController }) {
  const { setKpiDetail, kpis, pipelineStages, agendaVisitas, agendaVisitasPrev, reload, errors, delta, ceoMetas, funnelTotal } = model;
  return (<>
<section>
        <SectionLabel icon={BarChart3}>Gestão de Leads</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Funil do Pipeline - 2/3 */}
          <Card className="lg:col-span-2 bg-[#f7f7fb] dark:bg-card border-border shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-xs font-semibold">Funil do Pipeline</CardTitle>
                <span className="text-[10px] text-muted-foreground">Visão global · todas as equipes</span>
              </div>

            </CardHeader>
            <CardContent>
              <StateWrapper
                error={errors.pipeline}
                empty={pipelineStages.length === 0}
                emptyTitle="Sem etapas no período"
                onRetry={reload}
                errorTitle="Falha ao carregar o funil do pipeline"
              >
              <div className="space-y-1.5">
                {pipelineStages.map((s, idx) => {
                  const maxCount = Math.max(...pipelineStages.map(x => x.count), 1);
                  const pct = Math.round((s.count / maxCount) * 100);
                  const stageColor = s.tipo === "descarte" ? "#ef4444" : s.tipo === "convertido" ? "#10b981" : `hsl(${240 - idx * 15}, 70%, ${55 + idx * 3}%)`;
                  return (
                    <div key={s.id} className="flex items-center gap-2 group/stage">
                      <span className="text-[10px] text-muted-foreground w-28 truncate group-hover/stage:text-foreground transition-colors">{s.nome}</span>
                      <div className="flex-1 h-6 rounded-lg bg-[#e8e8f0]/50 dark:bg-muted/50 relative overflow-hidden">
                        <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: stageColor, opacity: 0.8 }} />
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-foreground">{s.count}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground w-10 text-right">{Math.round((s.count / funnelTotal) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
              </StateWrapper>
            </CardContent>
          </Card>

          {/* Agenda de Visitas - 1/3 */}
          <Card className="bg-[#f7f7fb] dark:bg-card border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <CalendarCheck className="h-3.5 w-3.5 text-primary" /> Agenda de Visitas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const dNovos = delta(agendaVisitas.agendadas, agendaVisitasPrev?.agendadas);
                return (
                  <button
                    type="button"
                    onClick={() => setKpiDetail({ type: "novos_agendamentos", label: "Novos agendamentos" })}
                    className="w-full bg-white dark:bg-muted/50 rounded-xl p-3 text-center border border-[#e8e8f0] dark:border-border hover:border-primary/30 transition-colors"
                  >
                    <p className="text-3xl font-[800] text-primary">{agendaVisitas.agendadas}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Novos agendamentos no período</p>
                    {dNovos != null && (
                      <p className={`text-[9px] font-semibold mt-0.5 ${Math.round(dNovos) === 0 ? "text-muted-foreground" : dNovos > 0 ? "text-success" : "text-danger"}`}>
                        {Math.round(dNovos) === 0 ? "→" : dNovos > 0 ? "▲" : "▼"} {Math.abs(Math.round(dNovos))}% vs. anterior
                      </p>
                    )}
                  </button>
                );
              })()}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: "Total", value: agendaVisitas.total, color: "text-primary", type: "visitas_criadas" as const, prev: agendaVisitasPrev?.total },
                  { label: "A realizar", value: agendaVisitas.aRealizar, color: "text-warning", type: "visitas_marcadas" as const, prev: agendaVisitasPrev?.aRealizar },
                  { label: "Realizadas", value: agendaVisitas.realizadas, color: "text-success", type: "visitas_realizadas" as const, prev: agendaVisitasPrev?.realizadas },
                  { label: "No Show", value: agendaVisitas.noShow, color: "text-danger", type: "visitas_no_show" as const, prev: agendaVisitasPrev?.noShow, invert: true },

                ]).map(card => {
                  const d = delta(card.value, card.prev);
                  const positive = d != null && (card.invert ? d < 0 : d > 0);
                  return (
                    <button
                      key={card.label}
                      type="button"
                      onClick={() => setKpiDetail({ type: card.type, label: card.label })}
                      className="bg-white dark:bg-muted/50 rounded-xl p-3 text-center border border-[#e8e8f0] dark:border-border hover:border-primary/30 transition-colors"
                    >
                      <p className={`text-2xl font-[800] ${card.color}`}>{card.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}</p>
                      {d != null && (
                        <p className={`text-[9px] font-semibold mt-0.5 ${Math.round(d) === 0 ? "text-muted-foreground" : positive ? "text-success" : "text-danger"}`}>
                          {Math.round(d) === 0 ? "→" : d > 0 ? "▲" : "▼"} {Math.abs(Math.round(d))}% vs. anterior
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {ceoMetas.meta_visitas_realizadas > 0 && (
                <div className="bg-white dark:bg-muted/50 rounded-xl p-3 border border-[#e8e8f0] dark:border-border">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Meta Visitas Realizadas</span>
                    <span className="font-semibold text-foreground">{Math.round((kpis.visitasRealizadas / ceoMetas.meta_visitas_realizadas) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#e8e8f0] dark:bg-muted/60 overflow-hidden">
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min((kpis.visitasRealizadas / ceoMetas.meta_visitas_realizadas) * 100, 100)}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
  </>);
}
