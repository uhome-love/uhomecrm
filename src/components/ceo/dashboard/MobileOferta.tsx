import { ChevronDown } from "lucide-react";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import type { KpiDetailType } from "@/components/ceo/KpiDetailDialog";
import { fmtMoney } from "@/lib/fmtMoney";
import { StateWrapper } from "@/components/ui/StateWrapper";
import { MobileSection, MobileKpiRail, MobileDisclosure, MobileDataRow } from "./MobilePrimitives";

export default function MobileOferta({ model: m }: { model: CeoDashboardController }) {
  const detail = (type: KpiDetailType, label: string) => () => m.setKpiDetail({ type, label });
  return <MobileSection title="Oferta Ativa">
    <MobileKpiRail label="Indicadores de Oferta Ativa" items={[
      { label: "Total Ligações", value: m.kpis.ligacoes.toLocaleString("pt-BR"), tone: "primary", delta: m.delta(m.kpis.ligacoes, m.prevKpis?.ligacoes), sub: (m.ceoMetas.meta_ligacoes ?? 0) > 0 ? `${Math.round((m.kpis.ligacoes / (m.ceoMetas.meta_ligacoes ?? 1)) * 100)}% da meta` : undefined, onClick: detail("tentativas", "Ligações") },
      { label: "Aproveitados", value: m.kpis.aproveitados, tone: "success", delta: m.delta(m.kpis.aproveitados, m.prevKpis?.aproveitados), sub: `Taxa: ${m.kpis.taxaConversao}%`, onClick: detail("aproveitados", "Aproveitados") },
      { label: "Metas do Dia", value: `${m.metasDiaTotal.ligacoes} lig`, sub: `${m.metasDiaTotal.aproveitados} aprov · ${m.metasDiaTotal.visitasMarcadas} VM` },
      { label: "Taxa Aproveitamento", value: `${m.kpis.taxaConversao}%`, tone: m.kpis.taxaConversao >= 10 ? "success" : m.kpis.taxaConversao >= 5 ? "warning" : undefined },
    ]} />
    <h3 className="pt-3 text-[19px] font-bold text-foreground">Performance por Equipe</h3>
    <StateWrapper error={m.errors.teams} empty={m.teams.length === 0} emptyTitle="Sem dados de equipe no período" onRetry={m.reload} errorTitle="Falha ao carregar a performance por equipe">
      <div className="space-y-3">
        {[...m.teams].sort((a, b) => b.ligacoes - a.ligacoes).map((team, index) => <details key={team.gerente_id} open={index === 0 || undefined} className="group/team rounded-xl border border-border bg-card">
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{team.gerente_nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("")}</span>
            <div className="min-w-0 flex-1"><p className="break-words text-[15px] font-semibold text-foreground">{team.gerente_nome}</p><p className="mt-1 text-[11px] text-muted-foreground">{team.ligacoes} ligações · {team.aproveitados} aproveitados</p></div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground group-open/team:rotate-180" />
          </summary>
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3"><span className="text-xs text-muted-foreground">VGV</span><strong className="text-xl tabular-nums text-success">{fmtMoney(team.vgv, "short")}</strong></div>
            <div className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4">{[
              ["Ligações", team.ligacoes], ["Aproveitados", team.aproveitados], ["Taxa", `${team.taxa}%`], ["Visitas agendadas", team.visitasMarcadas], ["Realizadas", team.visitasRealizadas], ["Propostas", team.propostas],
            ].map(([label, value]) => <div key={label}><strong className="text-[17px] tabular-nums text-foreground">{value}</strong><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>)}</div>
          </div>
        </details>)}
        <MobileDisclosure title="Total das equipes">
          {[["Ligações", m.totalTeam.ligacoes], ["Aproveitados", m.totalTeam.aproveitados], ["Taxa", `${m.totalTeam.ligacoes > 0 ? Math.round((m.totalTeam.aproveitados / m.totalTeam.ligacoes) * 100) : 0}%`], ["Visitas agendadas", m.totalTeam.visitasMarcadas], ["Realizadas", m.totalTeam.visitasRealizadas], ["Propostas", m.totalTeam.propostas], ["VGV", fmtMoney(m.totalTeam.vgv, "short")]].map(([label, value]) => <MobileDataRow key={label} label={String(label)} value={value} />)}
        </MobileDisclosure>
      </div>
    </StateWrapper>
    {(m.corretoresRank.length > 0 || m.errors.teams) && <MobileDisclosure title="Top Corretores — Oferta Ativa">
      <StateWrapper error={m.errors.teams} empty={m.corretoresRank.length === 0} emptyTitle="Sem corretores no período" onRetry={m.reload} errorTitle="Falha ao carregar o ranking de corretores">
        {[...m.corretoresRank].sort((a, b) => b.ligacoes - a.ligacoes).slice(0, 10).map((corretor, index) => <div key={corretor.corretor_id} className="border-t border-border py-4">
          <p className="break-words text-sm font-semibold text-foreground">{index + 1} · {corretor.nome}</p><p className="mt-1 text-xs text-muted-foreground">{corretor.gerente_nome}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">{[["Ligações", corretor.ligacoes], ["Aproveitados", corretor.aproveitados], ["Taxa", `${corretor.taxa}%`]].map(([label, value]) => <div key={label}><strong className="text-base tabular-nums text-foreground">{value}</strong><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>)}</div>
        </div>)}
      </StateWrapper>
    </MobileDisclosure>}
  </MobileSection>;
}