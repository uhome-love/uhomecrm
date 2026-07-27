import { AlertTriangle, Clock, XCircle, Layers, PhoneOff, TrendingDown, CalendarX } from "lucide-react";
import { usePerformanceDashboard, type PerfSeveridade } from "@/hooks/usePerformance";

const META: Record<PerfSeveridade, { label: string; icon: any; tone: string }> = {
  sla_vermelho:        { label: "SLA vermelho",        icon: Clock,       tone: "text-red-600 bg-red-500/10 border-red-500/30" },
  no_show_alto:        { label: "No-show alto",        icon: XCircle,     tone: "text-orange-600 bg-orange-500/10 border-orange-500/30" },
  wip_negociacao_alto: { label: "WIP em Negociação",   icon: Layers,      tone: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  baixo_esforco_oa:    { label: "Baixo esforço em OA", icon: PhoneOff,    tone: "text-purple-600 bg-purple-500/10 border-purple-500/30" },
  vgv_zerado:          { label: "VGV zerado",          icon: TrendingDown,tone: "text-slate-600 bg-slate-500/10 border-slate-500/30" },
  presenca_baixa:      { label: "Presença baixa",      icon: CalendarX,   tone: "text-rose-600 bg-rose-500/10 border-rose-500/30" },
};

function detalhe(sev: PerfSeveridade, ctx: any): string {
  switch (sev) {
    case "sla_vermelho":
      return ctx.sla_mediana_min ? `Mediana ${Math.round(ctx.sla_mediana_min / 60)}h para primeiro contato` : "SLA acima do alvo";
    case "no_show_alto":
      return `${ctx.qtd_no_show} no-shows no período`;
    case "wip_negociacao_alto":
      return `${ctx.qtd_negociacao} negócios em negociação`;
    case "baixo_esforco_oa":
      return `Só ${ctx.qtd_tentativas_oa} tentativas em Oferta Ativa`;
    case "vgv_zerado":
      return "Sem VGV vendido nem visitas realizadas";
    case "presenca_baixa":
      return `Presença ${Math.round((ctx.presenca_pct || 0) * 100)}%`;
  }
}

export default function DiagnosticoResumoCard({ inicio, fim }: { inicio?: string; fim?: string }) {
  const { data, isLoading } = usePerformanceDashboard(inicio, fim);

  if (isLoading || !data) return null;
  if (!data.diagnostico || data.diagnostico.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        Diagnóstico · Top {data.diagnostico.length}
        <span className="text-xs font-normal text-muted-foreground ml-auto">
          Sinais que exigem atenção neste período
        </span>
      </h3>
      <ul className="space-y-2">
        {data.diagnostico.map((d) => {
          const m = META[d.severidade];
          const Icon = m.icon;
          return (
            <li
              key={`${d.profile_id}-${d.severidade}`}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${m.tone}`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{d.nome}</div>
                <div className="text-xs text-muted-foreground">{detalhe(d.severidade, d.contexto)}</div>
              </div>
              <span className="text-xs font-semibold whitespace-nowrap">{m.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
