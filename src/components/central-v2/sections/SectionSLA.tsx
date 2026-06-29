import { Gauge, Clock, Zap, AlertTriangle } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { SectionHeading } from "@/components/central-v2/shared/SectionHeading";
import { KpiGrid, type KpiCardData } from "@/components/central-v2/shared/KpiCard";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { cn } from "@/lib/utils";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface Faixas {
  ate5?: number;
  de5a30?: number;
  de30a120?: number;
  mais120?: number;
  sem_contato?: number;
}

/** Formata minutos em "Xm" ou "Xh Ym" / "Xd". */
function fmtMin(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v < 1) return "<1 min";
  if (v < 60) return `${Math.round(v)} min`;
  const h = v / 60;
  if (h < 24) {
    const hh = Math.floor(h);
    const mm = Math.round(v - hh * 60);
    return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
  }
  return `${(h / 24).toFixed(1)} dias`;
}

const FAIXA_DEFS: { key: keyof Faixas; label: string; tone: string }[] = [
  { key: "ate5", label: "Até 5 min", tone: "bg-emerald-500" },
  { key: "de5a30", label: "5 – 30 min", tone: "bg-primary" },
  { key: "de30a120", label: "30 min – 2 h", tone: "bg-amber-500" },
  { key: "mais120", label: "Mais de 2 h", tone: "bg-rose-500" },
  { key: "sem_contato", label: "Sem contato", tone: "bg-muted-foreground/50" },
];

export function SectionSLA({ query }: Props) {
  const data = query.data;
  const loading = query.isLoading && !data;

  const distribuidos = safeGet<number>(data ?? {}, "distribuidos", "SLA distribuidos") ?? 0;
  const taxaContato = safeGet<number>(data ?? {}, "taxa_contato", "SLA taxa_contato");
  const aceiteAvg = safeGet<number>(data ?? {}, "aceite_avg_min", "SLA aceite_avg");
  const aceiteMed = safeGet<number>(data ?? {}, "aceite_med_min", "SLA aceite_med");
  const contatoAvg = safeGet<number>(data ?? {}, "contato_avg_min", "SLA contato_avg");
  const contatoMed = safeGet<number>(data ?? {}, "contato_med_min", "SLA contato_med");
  const faixas = safeGet<Faixas>(data ?? {}, "faixas", "SLA faixas") ?? {};

  const kpis: KpiCardData[] = [
    { label: "Leads distribuídos", value: distribuidos.toLocaleString("pt-BR"), icon: Gauge },
    {
      label: "Taxa de contato",
      value: taxaContato != null ? taxaContato.toFixed(0) : "—",
      suffix: taxaContato != null ? "%" : undefined,
      icon: Zap,
      hint: "Leads que receberam ao menos 1 contato",
    },
    {
      label: "Tempo médio p/ aceite",
      value: fmtMin(aceiteAvg),
      icon: Clock,
      hint: `Mediana ${fmtMin(aceiteMed)}`,
    },
    {
      label: "Tempo médio p/ 1º contato",
      value: fmtMin(contatoAvg),
      icon: AlertTriangle,
      hint: `Mediana ${fmtMin(contatoMed)}`,
    },
  ];

  const totalFaixas = FAIXA_DEFS.reduce((s, f) => s + (faixas[f.key] ?? 0), 0);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        icon={Gauge}
        title="Tempo de Resposta (SLA)"
        subtitle="Velocidade entre a distribuição do lead e o primeiro contato do corretor"
      />

      {query.error ? (
        <SectionError query={query} label="Tempo de Resposta" />
      ) : (
        <>
          <KpiGrid items={kpis} loading={loading} skeletonCount={4} cols={4} />

          <div className="central-card flex flex-col gap-3 p-4">
            <span className="text-sm font-medium text-foreground">
              Distribuição do 1º contato por faixa de tempo
            </span>
            {loading ? (
              <div className="h-32 animate-pulse rounded-lg bg-muted" />
            ) : totalFaixas === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sem leads distribuídos no período.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {FAIXA_DEFS.map((f) => {
                  const v = faixas[f.key] ?? 0;
                  const pct = totalFaixas > 0 ? (v / totalFaixas) * 100 : 0;
                  return (
                    <div key={f.key} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs text-muted-foreground">{f.label}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", f.tone)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-foreground">
                        {v.toLocaleString("pt-BR")}{" "}
                        <span className="text-muted-foreground">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
