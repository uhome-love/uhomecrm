import { StatCard, type Delta } from "@/components/ds";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { formatBRLCompact } from "./DesktopPrimitives";

/** Faixa de destaque (DS v4). Só apresentação: reaproveita os mesmos números e detalhes das seções. */
function toDelta(d: number | null): Delta | undefined {
  if (d == null || !Number.isFinite(d)) return undefined;
  const r = Math.round(d);
  return { value: `${r > 0 ? "+" : ""}${r}%`, direction: d >= 0 ? "up" : "down", good: r === 0 ? undefined : "up", label: "vs. anterior" };
}

export default function DesktopTopKpis({ model }: { model: CeoDashboardController }) {
  const { kpis, prevKpis, delta, totalLeadsPeriodo, totalNeg, setKpiDetail } = model;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <StatCard label="Leads gerados" value={totalLeadsPeriodo.toLocaleString("pt-BR")}
        onClick={() => setKpiDetail({ type: "total_leads", label: "Leads Gerados" })} />
      <StatCard label="Visitas realizadas" value={kpis.visitasRealizadas.toLocaleString("pt-BR")}
        delta={toDelta(delta(kpis.visitasRealizadas, prevKpis?.visitasRealizadas))} />
      <StatCard label="Negócios" value={totalNeg.toLocaleString("pt-BR")}
        onClick={() => setKpiDetail({ type: "negocios", label: "Negócios ativos" })} />
      <StatCard label="VGV assinado" value={formatBRLCompact(kpis.vgvAssinado)} accent
        delta={toDelta(delta(kpis.vgvAssinado, prevKpis?.vgvAssinado))}
        onClick={() => setKpiDetail({ type: "vgv_assinado", label: "VGV Assinado" })} />
      <StatCard label="Ligações (Oferta Ativa)" value={kpis.ligacoes.toLocaleString("pt-BR")}
        delta={toDelta(delta(kpis.ligacoes, prevKpis?.ligacoes))} />
    </div>
  );
}
