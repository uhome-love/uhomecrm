import { Button } from "@/components/ui/button";
import { Users, Building2, Target, Megaphone } from "lucide-react";
import { Panel, StatCard, fmtNum } from "@/components/ds";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { SectionLabel, ORIGIN_COLORS, FALLBACK_COLORS } from "./DesktopPrimitives";

const pctDe = (v: number, total: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : "—");

function Barra({ label, value, max, color, pct }: { label: string; value: number; max: number; color: string; pct?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate text-foreground" title={label}>{label}</span>
        <span className="shrink-0 tabular-nums">
          <strong className="text-foreground">{fmtNum(value)}</strong>
          {pct && <span className="text-muted-foreground"> · {pct}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Soma({ total, totalMkt }: { total: number; totalMkt: number }) {
  return (
    <span>
      Soma: <strong className="tabular-nums text-foreground">{fmtNum(total)}</strong>
      {total !== totalMkt && <> · Total marketing: <strong className="tabular-nums text-foreground">{fmtNum(totalMkt)}</strong></>}
    </span>
  );
}

/** Roleta de Leads — formato antigo (linha de números + 3 cartões), acabamento DS v4. Só apresentação. */
export default function DesktopLeads({ model }: { model: CeoDashboardController }) {
  const { filaCeoCount, setDispatchOpen, setBulkEmpOpen, setKpiDetail, showAllCorretorLeads, setShowAllCorretorLeads, campanhas, origens, leadsPorEmpreendimento, leadsPorCorretor, totalLeadsPeriodo, leadsReaproveitadosOA, novoInteresse, presentesHoje, leadsDistribuidos } = model;
  const somaEmp = leadsPorEmpreendimento.reduce((s, x) => s + x.count, 0);
  const somaOrig = origens.reduce((s, x) => s + x.count, 0);
  const comLeads = leadsPorCorretor.filter((x) => x.count > 0);
  const somaCor = leadsPorCorretor.reduce((s, x) => s + x.count, 0);
  const semLeads = leadsPorCorretor.length - comLeads.length;
  const media = comLeads.length > 0 ? (somaCor / comLeads.length).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : null;
  const maxEmp = Math.max(...leadsPorEmpreendimento.map((x) => x.count), 1);
  const maxOrig = Math.max(...origens.map((x) => x.count), 1);
  const maxCor = Math.max(...leadsPorCorretor.map((x) => x.count), 1);
  const listaH = "h-[264px] overflow-y-auto pr-1 space-y-3";

  return (
    <section>
      <SectionLabel icon={Target}>Roleta de Leads</SectionLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <StatCard size="sm" label="Leads gerados" value={fmtNum(totalLeadsPeriodo)} accent sub="Meta, TikTok, LP, ImovelWeb..."
          onClick={() => setKpiDetail({ type: "total_leads", label: "Leads Gerados" })} />
        <StatCard size="sm" label="Fila CEO" value={fmtNum(filaCeoCount)} tone={filaCeoCount > 0 ? "warning" : undefined}
          sub={filaCeoCount > 0 ? "aguardando · clique para distribuir" : "Fila vazia"}
          onClick={filaCeoCount > 0 ? () => setDispatchOpen(true) : undefined} />
        <StatCard size="sm" label="Enviados p/ Roleta" value={fmtNum(Math.max(leadsDistribuidos, 0))} sub="no período"
          onClick={() => setKpiDetail({ type: "enviados_roleta", label: "Enviados p/ Roleta" })} />
        <StatCard size="sm" label="Reaproveitados (OA)" value={fmtNum(leadsReaproveitadosOA)} sub="Leads da Oferta Ativa"
          onClick={() => setKpiDetail({ type: "reaproveitados_oa", label: "Reaproveitados (OA)" })} />
        <StatCard size="sm" label="Novo interesse" value={fmtNum(novoInteresse)} sub="Leads com novo interesse" />
        <StatCard size="sm" label="Corretores na Roleta" value={fmtNum(presentesHoje)} sub="presentes hoje"
          onClick={() => setKpiDetail({ type: "presentes_hoje", label: "Corretores na Roleta" })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <Panel title="Leads por Empreendimento" icon={Building2}
          actions={campanhas.some((c) => c.empreendimento === "Sem empreendimento") ? (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setBulkEmpOpen(true)}>Corrigir</Button>
          ) : undefined}
          footer={<Soma total={somaEmp} totalMkt={totalLeadsPeriodo} />}>
          <div className={listaH}>
            {leadsPorEmpreendimento.map((l, i) => (
              <Barra key={l.emp} label={l.emp} value={l.count} max={maxEmp} color={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} pct={pctDe(l.count, somaEmp)} />
            ))}
            {leadsPorEmpreendimento.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nada no período.</p>}
          </div>
        </Panel>

        <Panel title="Leads por Origem" icon={Megaphone} footer={<Soma total={somaOrig} totalMkt={totalLeadsPeriodo} />}>
          <div className={listaH}>
            {origens.map((o, i) => (
              <Barra key={o.origem} label={o.origem} value={o.count} max={maxOrig}
                color={ORIGIN_COLORS[o.origem] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} pct={pctDe(o.count, somaOrig)} />
            ))}
            {origens.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nada no período.</p>}
          </div>
        </Panel>

        <Panel title="Leads por Corretor" icon={Users}
          actions={media ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary" title={semLeads > 0 ? `${semLeads} corretores sem leads no período` : undefined}>{comLeads.length} com leads · média {media}</span> : undefined}
          footer={<div className="flex items-center justify-between gap-2">
            {comLeads.length > 6 ? (
              <button className="font-medium text-primary hover:underline" onClick={() => setShowAllCorretorLeads(!showAllCorretorLeads)}>
                {showAllCorretorLeads ? "Ver menos" : `Ver mais (${comLeads.length})`}
              </button>
            ) : <span />}
            <Soma total={somaCor} totalMkt={totalLeadsPeriodo} />
          </div>}>
          <div className={listaH}>
            {(showAllCorretorLeads ? comLeads : comLeads.slice(0, 6)).map((c, i) => (
              <Barra key={`${c.nome}-${i}`} label={c.nome} value={c.count} max={maxCor} color={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
            ))}
            {comLeads.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nenhum lead no período.</p>}
            {semLeads > 0 && (showAllCorretorLeads || comLeads.length <= 6) && <p className="text-xs text-muted-foreground">{semLeads} corretores sem leads no período</p>}
          </div>
        </Panel>
      </div>
    </section>
  );
}
