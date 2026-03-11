import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, ShieldCheck, Target } from "lucide-react";
import type { PipelineLead } from "@/hooks/usePipeline";
import { formatBRL, formatBRLCompact } from "@/lib/utils";

interface Stage {
  id: string;
  nome: string;
  tipo: string;
}

// Map stage tipo to probability %
const STAGE_PROBABILITY: Record<string, number> = {
  novo: 10,
  atendimento: 15,
  qualificacao: 25,
  visita_marcada: 40,
  visita_realizada: 60,
  negociacao: 75,
  proposta: 85,
  assinatura: 95,
};

const EXCLUDED_TYPES = ["venda", "descarte", "caiu"];

const formatCurrency = (v: number) => v >= 100_000 ? formatBRLCompact(v) : formatBRL(v);

interface Props {
  leads: PipelineLead[];
  stages: Stage[];
}

export default function ForecastPonderadoPanel({ leads, stages }: Props) {
  const forecast = useMemo(() => {
    const stageMap = new Map(stages.map(s => [s.id, s]));

    // Filter out excluded stages
    const activeLeads = leads.filter(l => {
      const stage = stageMap.get(l.stage_id);
      return stage && !EXCLUDED_TYPES.includes(stage.tipo);
    });

    let conservadorVGV = 0;
    let conservadorCount = 0;
    let provavelVGV = 0;
    let provavelCount = 0;
    let otimistaVGV = 0;
    let otimistaCount = 0;

    for (const lead of activeLeads) {
      const stage = stageMap.get(lead.stage_id)!;
      const vgv = lead.valor_estimado || 0;
      const prob = STAGE_PROBABILITY[stage.tipo] ?? 20;

      // Otimista: all active VGV
      otimistaVGV += vgv;
      otimistaCount++;

      // Provável: weighted
      provavelVGV += vgv * (prob / 100);
      provavelCount++;

      // Conservador: only >= 75%
      if (prob >= 75) {
        conservadorVGV += vgv;
        conservadorCount++;
      }
    }

    return {
      conservador: { vgv: conservadorVGV, count: conservadorCount },
      provavel: { vgv: Math.round(provavelVGV), count: provavelCount },
      otimista: { vgv: otimistaVGV, count: otimistaCount },
    };
  }, [leads, stages]);

  const cards = [
    {
      key: "conservador",
      label: "Conservador",
      emoji: "🔵",
      icon: ShieldCheck,
      vgv: forecast.conservador.vgv,
      count: forecast.conservador.count,
      color: "text-blue-500",
      bg: "bg-blue-500/10 border-blue-500/20",
      tooltip: "Soma do VGV de negócios com probabilidade ≥ 75% (Negociação, Proposta, Assinatura). Exclui negócios Caiu e Assinado.",
    },
    {
      key: "provavel",
      label: "Provável",
      emoji: "🟡",
      icon: Target,
      vgv: forecast.provavel.vgv,
      count: forecast.provavel.count,
      color: "text-amber-500",
      bg: "bg-amber-500/10 border-amber-500/20",
      tooltip: "Soma do VGV × probabilidade de cada negócio ativo. A probabilidade é calculada pelo estágio do funil (ex: Visita Marcada = 40%, Proposta = 85%).",
    },
    {
      key: "otimista",
      label: "Otimista",
      emoji: "🟢",
      icon: TrendingUp,
      vgv: forecast.otimista.vgv,
      count: forecast.otimista.count,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      tooltip: "Soma total do VGV de todos os negócios ativos no funil. Exclui negócios Caiu e Assinado.",
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {cards.map(c => (
          <Tooltip key={c.key}>
            <TooltipTrigger asChild>
              <div className={`rounded-lg border p-2.5 sm:p-3 cursor-default transition-colors hover:bg-muted/30 ${c.bg}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{c.emoji}</span>
                  <span className={`text-[10px] sm:text-xs font-semibold ${c.color}`}>{c.label}</span>
                </div>
                <p className="text-sm sm:text-lg font-bold text-foreground leading-tight">
                  {formatCurrency(c.vgv)}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {c.count} {c.count === 1 ? "negócio" : "negócios"}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[260px] text-xs">
              {c.tooltip}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
