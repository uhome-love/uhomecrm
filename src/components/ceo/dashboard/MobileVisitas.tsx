import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import type { KpiDetailType } from "@/components/ceo/KpiDetailDialog";
import { StateWrapper } from "@/components/ui/StateWrapper";
import { MobileKpi, MobileSection, MobileDisclosure, MobileDataRow } from "./MobilePrimitives";

export default function MobileVisitas({ model: m }: { model: CeoDashboardController }) {
  const detail = (type: KpiDetailType, label: string) => () => m.setKpiDetail({ type, label });
  const statuses = [
    { label: "Total", value: m.agendaVisitas.total, prev: m.agendaVisitasPrev?.total, type: "visitas_criadas" as const, tone: "primary" as const },
    { label: "A realizar", value: m.agendaVisitas.aRealizar, prev: m.agendaVisitasPrev?.aRealizar, type: "visitas_marcadas" as const, tone: "warning" as const },
    { label: "Realizadas", value: m.agendaVisitas.realizadas, prev: m.agendaVisitasPrev?.realizadas, type: "visitas_realizadas" as const, tone: "success" as const },
    { label: "No Show", value: m.agendaVisitas.noShow, prev: m.agendaVisitasPrev?.noShow, type: "visitas_no_show" as const, tone: "danger" as const, invert: true },
  ];
  return <MobileSection title="Agenda de visitas">
    <MobileKpi label="Novos agendamentos" value={m.agendaVisitas.agendadas} sub="No período" tone="primary" delta={m.delta(m.agendaVisitas.agendadas, m.agendaVisitasPrev?.agendadas)} onClick={detail("novos_agendamentos", "Novos agendamentos")} />
    <div className="grid grid-cols-2 gap-2.5 [&>button]:min-h-[124px] [&>button>strong]:text-[26px]">
      {statuses.map((s) => <MobileKpi key={s.label} label={s.label} value={s.value} tone={s.tone} delta={m.delta(s.value, s.prev)} invertDelta={s.invert} onClick={detail(s.type, s.label)} />)}
    </div>
    {(m.ceoMetas.meta_visitas_realizadas ?? 0) > 0 && <MobileDataRow label="Meta Visitas Realizadas" value={`${Math.round((m.kpis.visitasRealizadas / (m.ceoMetas.meta_visitas_realizadas ?? 1)) * 100)}%`} />}
    <MobileDisclosure title="Funil do Pipeline">
      <p className="mb-3 text-xs text-muted-foreground">Visão global · todas as equipes</p>
      <StateWrapper error={m.errors.pipeline} empty={m.pipelineStages.length === 0} emptyTitle="Sem etapas no período" onRetry={m.reload} errorTitle="Falha ao carregar o funil do pipeline">
        {m.pipelineStages.map((stage) => <MobileDataRow key={stage.id} label={stage.nome} value={stage.count} sub={`${Math.round((stage.count / m.funnelTotal) * 100)}%`} />)}
      </StateWrapper>
    </MobileDisclosure>
  </MobileSection>;
}